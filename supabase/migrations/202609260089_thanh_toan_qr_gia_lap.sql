-- Thanh toán bằng mã QR, bản giả lập · 26/09/2026
--
-- Chủ dự án muốn luồng giống ngoài đời: trang đặt chỗ hiện một mã QR, khách
-- quét bằng điện thoại, bấm xác nhận là xong, và trong ERP ghi rõ đơn ấy
-- "đã thanh toán bằng QR". Không cần tiền thật: không nối ngân hàng, không
-- có tài khoản nhận tiền nào.
--
-- ## Vì sao cần một cách trả mới, không dùng lại 'simulation'
--
-- 'simulation' là lối cũ "nhận vé ngay, chưa trừ tiền": khách bấm một nút,
-- không quét gì. Gọi chung hai thứ ấy là "QR" thì báo cáo nói sai về quá khứ.
-- Nên thêm 'qr-transfer' riêng, dáng giống hệt 'simulation': cùng nhà cung
-- cấp giả lập, xong ngay ('succeeded'), không có người thu, không huỷ.
--
-- ## Sửa đúng hai dòng trong customer_confirm_booking
--
--   1. Nhận thêm 'qr-transfer' trong danh sách cách trả.
--   2. Mã sự kiện nhà cung cấp mang tiền tố 'qr-' để nhìn sổ là biết.
--
-- Thân hàm lấy bằng pg_get_functiondef từ CHÍNH PRODUCTION ngày 26/09/2026
-- (trùng khít bản 064), rồi sửa đúng hai dòng trên. `create or replace` giữ
-- nguyên quyền gọi hàm như 064. Cổng quét, bản kê ngoại tuyến và đối soát
-- cuối ca chỉ đụng tới 'pay-on-site' đang chờ thu, nên vé trả bằng QR đi qua
-- cổng như vé đã trả — không phải sửa hàm nào khác. Không đổi dữ liệu, không
-- backfill: nới ràng buộc, thay một hàm, thêm bảng "hẹn trả" ở cuối tệp.

begin;

alter table public.customer_payment_attempts
  drop constraint if exists customer_payment_attempts_mode_check;
alter table public.customer_payment_attempts
  add constraint customer_payment_attempts_mode_check
  check (mode in ('simulation', 'pay-on-site', 'qr-transfer'));

alter table public.customer_payment_attempts
  drop constraint if exists customer_payment_attempts_mode_shape_check;
alter table public.customer_payment_attempts
  add constraint customer_payment_attempts_mode_shape_check
  check (
    (
      mode in ('simulation', 'qr-transfer')
      and provider = 'destinationos-simulation'
      and status = 'succeeded'
      and collected_by_account_id is null
      and collected_at is null
      and cancelled_by_account_id is null
      and cancel_reason is null
    )
    or (
      mode = 'pay-on-site'
      and provider = 'on-site-counter'
      and (
        (status = 'pending' and collected_by_account_id is null and collected_at is null
          and cancelled_by_account_id is null and cancel_reason is null)
        or (status = 'succeeded' and collected_by_account_id is not null and collected_at is not null
          and cancelled_by_account_id is null and cancel_reason is null)
        or (status = 'cancelled' and collected_by_account_id is null and collected_at is null
          and cancelled_by_account_id is not null and cancel_reason is not null)
      )
    )
  );

CREATE OR REPLACE FUNCTION public.customer_confirm_booking(p_tenant_id uuid, p_payment_request_id uuid, p_hold_id uuid, p_anonymous_id uuid, p_occurred_at timestamp with time zone, p_payment_mode text, p_identity_type text, p_identity_digest text, p_identity_ciphertext text, p_encryption_key_version text)
 RETURNS TABLE(order_id uuid, order_code text, order_status text, payment_attempt_id uuid, payment_status text, payment_mode text, amount_due_vnd integer, tickets jsonb, inserted boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_source_profile_id uuid;
  v_profile_id uuid;
  v_existing_payment public.customer_payment_attempts;
  v_hold public.customer_booking_holds;
  v_order public.customer_orders;
  v_payment public.customer_payment_attempts;
  v_hold_slot public.customer_booking_hold_slots;
  v_slot public.customer_booking_slots;
  v_ticket_id uuid;
  v_ticket_code text;
  v_tickets jsonb;
  v_ticket_count integer := 0;
  v_group record;
  v_mode text := trim(coalesce(p_payment_mode, ''));
  v_on_site boolean;
  v_has_contact boolean;
  v_identity_type text := trim(coalesce(p_identity_type, ''));
  v_identity_digest text := lower(trim(coalesce(p_identity_digest, '')));
  v_outstanding integer;
  v_identity_id uuid;
begin
  if p_tenant_id is null or p_payment_request_id is null or p_hold_id is null
     or p_anonymous_id is null or p_occurred_at is null
     or p_occurred_at > now() + interval '5 minutes' then
    raise exception using errcode = '22023', message = 'CUSTOMER_PAYMENT_INPUT_INVALID';
  end if;
  if v_mode not in ('simulation', 'pay-on-site', 'qr-transfer') then
    raise exception using errcode = '22023', message = 'CUSTOMER_PAYMENT_MODE_INVALID';
  end if;
  v_on_site := v_mode = 'pay-on-site';

  -- Liên hệ có đủ và đúng dạng hay không. Tách phép ĐO ra khỏi phép BẮT BUỘC,
  -- vì từ TC-25 hai chuyện ấy không còn là một: trả tại điểm thì bắt buộc,
  -- còn trả ngay thì được phép để lại nếu khách muốn.
  v_has_contact := v_identity_type in ('phone', 'email')
    and v_identity_digest ~ '^[0-9a-f]{64}$'
    and char_length(coalesce(p_identity_ciphertext, '')) between 24 and 4096
    and char_length(trim(coalesce(p_encryption_key_version, ''))) between 1 and 40;

  -- Trả tiền tại điểm thì BẮT BUỘC có liên hệ. Đây là điều kiện duy nhất giữ
  -- cho một chỗ chưa trả tiền còn truy được về một người thật.
  if v_on_site and not v_has_contact then
    raise exception using errcode = '22023', message = 'CUSTOMER_PAYMENT_CONTACT_REQUIRED';
  end if;

  -- Gửi lên một liên hệ méo mó thì phải TỪ CHỐI, không được lặng lẽ bỏ qua.
  -- Bỏ qua nghĩa là khách tưởng mình đã để lại số, tới lúc mất vé mới biết
  -- trang tra cứu chẳng có gì để đối chiếu — và lúc ấy thì muộn rồi.
  if not v_has_contact
     and (coalesce(v_identity_type, '') <> ''
          or coalesce(v_identity_digest, '') <> ''
          or coalesce(p_identity_ciphertext, '') <> ''
          or trim(coalesce(p_encryption_key_version, '')) <> '') then
    raise exception using errcode = '22023', message = 'CUSTOMER_PAYMENT_CONTACT_INVALID';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_tenant_id::text || ':payment:' || p_payment_request_id::text, 0)
  );

  select profile.id into v_source_profile_id
  from public.customer_profiles profile
  where profile.tenant_id = p_tenant_id and profile.anonymous_id = p_anonymous_id;
  v_profile_id := public.customer_canonical_profile_id(p_tenant_id, v_source_profile_id);
  if v_profile_id is null then
    raise exception using errcode = 'P0002', message = 'CUSTOMER_PROFILE_NOT_FOUND';
  end if;

  select payment.* into v_existing_payment
  from public.customer_payment_attempts payment
  where payment.tenant_id = p_tenant_id
    and payment.idempotency_key = p_payment_request_id;
  if v_existing_payment.id is not null then
    select hold.* into v_hold
    from public.customer_booking_holds hold
    where hold.id = v_existing_payment.hold_id and hold.tenant_id = p_tenant_id;
    if v_existing_payment.hold_id <> p_hold_id
       or public.customer_canonical_profile_id(
         p_tenant_id, v_hold.profile_id
       ) <> v_profile_id then
      raise exception using errcode = '23505', message = 'CUSTOMER_PAYMENT_ID_COLLISION';
    end if;
    select customer_order.* into v_order
    from public.customer_orders customer_order
    where customer_order.id = v_existing_payment.order_id
      and customer_order.tenant_id = p_tenant_id;
    select coalesce(jsonb_agg(jsonb_build_object(
      'ticket_id', ticket.id,
      'ticket_code', ticket.ticket_code,
      'site_id', ticket.site_id,
      'valid_on', ticket.valid_on,
      'entries_allowed', ticket.entries_allowed,
      'guest_group', ticket.product,
      'status', ticket.status
    ) order by ticket.site_id, ticket.product), '[]'::jsonb)
    into v_tickets
    from public.customer_order_tickets bridge
    join public.erp_tickets ticket on ticket.id = bridge.ticket_id
    where bridge.order_id = v_order.id;
    return query select
      v_order.id, v_order.order_code, v_order.status, v_existing_payment.id,
      v_existing_payment.status, v_existing_payment.mode,
      case when v_existing_payment.status = 'pending' then v_existing_payment.amount_vnd else 0 end,
      v_tickets, false;
    return;
  end if;

  select hold.* into v_hold
  from public.customer_booking_holds hold
  where hold.id = p_hold_id and hold.tenant_id = p_tenant_id
  for update;
  if v_hold.id is null then
    raise exception using errcode = 'P0002', message = 'CUSTOMER_BOOKING_HOLD_NOT_FOUND';
  end if;
  if public.customer_canonical_profile_id(
       p_tenant_id, v_hold.profile_id
     ) <> v_profile_id then
    raise exception using errcode = '42501', message = 'CUSTOMER_BOOKING_OWNERSHIP_REQUIRED';
  end if;
  if v_hold.status = 'converted' then
    raise exception using errcode = '23505', message = 'CUSTOMER_ORDER_ALREADY_CONFIRMED';
  end if;
  if v_hold.status <> 'active' or v_hold.expires_at <= now() then
    raise exception using errcode = '22023', message = 'CUSTOMER_BOOKING_HOLD_EXPIRED';
  end if;

  select customer_order.* into v_order
  from public.customer_orders customer_order
  where customer_order.id = v_hold.order_id and customer_order.tenant_id = p_tenant_id
  for update;
  if v_order.status <> 'holding' then
    raise exception using errcode = '23505', message = 'CUSTOMER_ORDER_STATE_INVALID';
  end if;

  -- Chặn giữ chỗ tràn lan: đếm theo LIÊN HỆ, không theo phiên trình duyệt.
  --
  -- Trần 10 lượt giữ mỗi giờ đã có ở hàm tạo lượt giữ đếm theo hồ sơ phiên —
  -- mà xoá cookie là có hồ sơ mới, nên nó chỉ cản được người vô tình. Số điện
  -- thoại thì đắt hơn nhiều: cùng một số băm ra cùng một chuỗi, dù đổi máy hay
  -- đổi trình duyệt. Ba đơn còn nợ tiền cùng lúc là đủ cho một gia đình đặt
  -- nhiều chặng, và đủ chật để một người rảnh rỗi không khoá nổi cả ngày vé.
  if v_on_site then
    select count(*) into v_outstanding
    from public.customer_payment_attempts payment
    join public.customer_orders customer_order
      on customer_order.id = payment.order_id
     and customer_order.tenant_id = payment.tenant_id
    join public.customer_identities identity
      on identity.profile_id = customer_order.profile_id
     and identity.tenant_id = customer_order.tenant_id
    where payment.tenant_id = p_tenant_id
      and payment.status = 'pending'
      and identity.identity_type = v_identity_type
      and identity.identity_digest = v_identity_digest
      and customer_order.visit_date >= (now() at time zone 'Asia/Ho_Chi_Minh')::date;
    if v_outstanding >= 3 then
      raise exception using errcode = '54000', message = 'CUSTOMER_PAYMENT_UNPAID_LIMIT';
    end if;
  end if;

  -- TC-25: lưu liên hệ khi CÓ liên hệ, không phụ thuộc cách trả tiền.
  --
  -- Trần ba đơn còn nợ ở trên vẫn chỉ tính cho lối trả tại điểm, đúng như cũ:
  -- nó đếm những chỗ đang giữ mà chưa trả đồng nào, còn một đơn trả ngay thì
  -- không nợ gì để mà chặn.
  if v_has_contact then
    -- Kho liên hệ dùng chung, không dựng bảng thứ hai. Khoá duy nhất là
    -- (tenant, loại, băm) nên cùng một số điện thoại chỉ có đúng một hàng dù
    -- đi qua bao nhiêu phiên; bảng này chỉ ghi thêm, không sửa không xoá.
    insert into public.customer_identities (
      tenant_id, profile_id, identity_type, identity_digest,
      identity_ciphertext, encryption_key_version
    ) values (
      p_tenant_id, v_profile_id, v_identity_type, v_identity_digest,
      p_identity_ciphertext, trim(p_encryption_key_version)
    )
    on conflict (tenant_id, identity_type, identity_digest) do nothing
    returning id into v_identity_id;

    -- TC-24: `do nothing` không trả hàng nào khi liên hệ ĐÃ có sẵn, mà khoá
    -- duy nhất là (tenant, loại, băm) nên hàng ấy chắc chắn đang tồn tại. Đọc
    -- lại đúng hàng đó, để mỗi đơn trả tại điểm đều trỏ về đúng một liên hệ.
    if v_identity_id is null then
      select identity.id into v_identity_id
      from public.customer_identities identity
      where identity.tenant_id = p_tenant_id
        and identity.identity_type = v_identity_type
        and identity.identity_digest = v_identity_digest;
    end if;
  end if;

  for v_hold_slot in
    select hold_slot.*
    from public.customer_booking_hold_slots hold_slot
    join public.customer_booking_slots slot on slot.id = hold_slot.slot_id
    where hold_slot.hold_id = v_hold.id and slot.tenant_id = p_tenant_id
    order by slot.starts_at, slot.site_id
  loop
    select slot.* into v_slot
    from public.customer_booking_slots slot
    where slot.id = v_hold_slot.slot_id and slot.tenant_id = p_tenant_id
    for update;
  end loop;

  insert into public.customer_payment_attempts (
    tenant_id, order_id, hold_id, idempotency_key, provider,
    provider_event_id, mode, status, amount_vnd, currency, occurred_at
  ) values (
    p_tenant_id, v_order.id, v_hold.id, p_payment_request_id,
    case when v_on_site then 'on-site-counter' else 'destinationos-simulation' end,
    case when v_on_site then 'onsite-' when v_mode = 'qr-transfer' then 'qr-' else 'sim-' end || p_payment_request_id::text,
    v_mode,
    case when v_on_site then 'pending' else 'succeeded' end,
    v_order.total_vnd, v_order.currency, p_occurred_at
  ) returning * into v_payment;

  update public.customer_booking_holds
  set status = 'converted', converted_at = now()
  where id = v_hold.id;
  update public.customer_orders
  set status = 'confirmed',
      identity_id = v_identity_id,
      updated_at = now()
  where id = v_order.id
  returning * into v_order;

  for v_hold_slot in
    select hold_slot.*
    from public.customer_booking_hold_slots hold_slot
    join public.customer_booking_slots slot on slot.id = hold_slot.slot_id
    where hold_slot.hold_id = v_hold.id and slot.tenant_id = p_tenant_id
    order by slot.starts_at, slot.site_id
  loop
    select slot.* into v_slot
    from public.customer_booking_slots slot
    where slot.id = v_hold_slot.slot_id;
    -- TC-03: moi chang phat ve theo tung nhom tuoi.
    for v_group in
      select nhom.ten, nhom.so_khach
      from (values ('adult'::text, v_order.adults), ('child'::text, v_order.children))
        as nhom(ten, so_khach)
      where nhom.so_khach > 0
      order by nhom.ten
    loop
      v_ticket_code := 'WEB-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
      insert into public.erp_tickets (
        tenant_id, site_id, ticket_code, product, guest_name, guest_phone,
        booking_reference, channel, valid_on, entries_allowed, entries_used,
        status, issued_at
      ) values (
        p_tenant_id, v_slot.site_id, v_ticket_code, v_group.ten, '', '',
        v_order.order_code, 'website', v_order.visit_date,
        v_group.so_khach, 0, 'issued', p_occurred_at
      ) returning id into v_ticket_id;
      insert into public.customer_order_tickets (
        tenant_id, order_id, slot_id, ticket_id, site_id,
        guest_group, entries_allowed
      ) values (
        p_tenant_id, v_order.id, v_slot.id, v_ticket_id,
        v_slot.site_id, v_group.ten, v_group.so_khach
      );
      v_ticket_count := v_ticket_count + 1;
    end loop;
  end loop;

  insert into public.customer_commerce_audit_events (
    tenant_id, profile_id, order_id, hold_id, payment_attempt_id,
    event_type, metadata, occurred_at
  ) values
    (
      p_tenant_id, v_profile_id, v_order.id, v_hold.id, v_payment.id,
      case when v_on_site then 'payment-due-on-site' else 'payment-simulated' end,
      jsonb_build_object('amount_vnd', v_order.total_vnd, 'currency', 'VND', 'mode', v_mode),
      p_occurred_at
    ),
    (
      p_tenant_id, v_profile_id, v_order.id, v_hold.id, v_payment.id,
      'tickets-issued',
      jsonb_build_object('ticket_count', v_ticket_count, 'channel', 'website'),
      p_occurred_at
    );

  select coalesce(jsonb_agg(jsonb_build_object(
    'ticket_id', ticket.id,
    'ticket_code', ticket.ticket_code,
    'site_id', ticket.site_id,
    'valid_on', ticket.valid_on,
    'entries_allowed', ticket.entries_allowed,
    'guest_group', ticket.product,
    'status', ticket.status
  ) order by ticket.site_id, ticket.product), '[]'::jsonb)
  into v_tickets
  from public.customer_order_tickets bridge
  join public.erp_tickets ticket on ticket.id = bridge.ticket_id
  where bridge.order_id = v_order.id;

  return query select
    v_order.id, v_order.order_code, v_order.status, v_payment.id,
    v_payment.status, v_payment.mode,
    case when v_on_site then v_order.total_vnd else 0 end,
    v_tickets, true;
end;
$function$;


-- ## Chống giữ chỗ bừa
--
-- Luật chủ dự án chốt: giữ chỗ 15 phút, trong 15 phút quét mã QR là xong;
-- quá hạn thì chỗ tự nhả. Một số điện thoại cứ giữ rồi bỏ nhiều lần thì
-- thôi đặt trên web, mời tới quầy tại điểm mà đặt.
--
-- Mỗi lần khách mở mã QR thanh toán, ghi một dòng "đã hẹn trả" gắn với lượt
-- giữ và bản băm số liệu liên hệ (không bao giờ số thô). Lượt giữ nào quá hạn
-- mà chưa thành đơn là một lần bỏ. Ba lần bỏ trong bảy ngày thì hàm từ chối
-- mở mã mới. Đếm theo liên hệ, không theo phiên trình duyệt: xoá cookie là
-- có phiên mới, còn số điện thoại thì vẫn là số ấy.

create table if not exists public.customer_qr_payment_intents (
  hold_id uuid primary key,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  identity_digest text not null check (identity_digest ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  foreign key (hold_id, tenant_id)
    references public.customer_booking_holds(id, tenant_id) on delete restrict
);

create index if not exists customer_qr_payment_intents_theo_lien_he
  on public.customer_qr_payment_intents (tenant_id, identity_digest, expires_at);

alter table public.customer_qr_payment_intents enable row level security;
revoke all on public.customer_qr_payment_intents from public, anon, authenticated;

create or replace function public.customer_qr_open_payment_intent(
  p_tenant_id uuid,
  p_hold_id uuid,
  p_anonymous_id uuid,
  p_identity_digest text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $ham$
declare
  v_digest text := lower(trim(coalesce(p_identity_digest, '')));
  v_source_profile_id uuid;
  v_profile_id uuid;
  v_hold public.customer_booking_holds;
  v_bo integer;
begin
  if p_tenant_id is null or p_hold_id is null or p_anonymous_id is null
     or v_digest !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = '22023', message = 'CUSTOMER_PAYMENT_INPUT_INVALID';
  end if;

  -- Khoá theo liên hệ: hai tab cùng số mở mã một lúc không lách được trần.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_tenant_id::text || ':qr-intent:' || v_digest, 0)
  );

  select profile.id into v_source_profile_id
  from public.customer_profiles profile
  where profile.tenant_id = p_tenant_id and profile.anonymous_id = p_anonymous_id;
  v_profile_id := public.customer_canonical_profile_id(p_tenant_id, v_source_profile_id);
  if v_profile_id is null then
    raise exception using errcode = 'P0002', message = 'CUSTOMER_PROFILE_NOT_FOUND';
  end if;

  select hold.* into v_hold
  from public.customer_booking_holds hold
  where hold.id = p_hold_id and hold.tenant_id = p_tenant_id;
  if v_hold.id is null then
    raise exception using errcode = 'P0002', message = 'CUSTOMER_BOOKING_HOLD_NOT_FOUND';
  end if;
  if public.customer_canonical_profile_id(p_tenant_id, v_hold.profile_id) <> v_profile_id then
    raise exception using errcode = '42501', message = 'CUSTOMER_BOOKING_OWNERSHIP_REQUIRED';
  end if;
  if v_hold.status = 'converted' then
    raise exception using errcode = '23505', message = 'CUSTOMER_ORDER_ALREADY_CONFIRMED';
  end if;
  if v_hold.status <> 'active' or v_hold.expires_at <= now() then
    raise exception using errcode = '22023', message = 'CUSTOMER_BOOKING_HOLD_EXPIRED';
  end if;

  -- Mở lại mã cho CHÍNH lượt giữ này (tải lại trang) thì không tính thêm.
  if not exists (
    select 1 from public.customer_qr_payment_intents intent
    where intent.hold_id = p_hold_id
  ) then
    select count(*) into v_bo
    from public.customer_qr_payment_intents intent
    join public.customer_booking_holds hold
      on hold.id = intent.hold_id and hold.tenant_id = intent.tenant_id
    where intent.tenant_id = p_tenant_id
      and intent.identity_digest = v_digest
      and intent.created_at > now() - interval '7 days'
      and hold.status <> 'converted'
      and hold.expires_at <= now();
    if v_bo >= 3 then
      raise exception using errcode = '42501', message = 'CUSTOMER_QR_LAPSE_LIMIT';
    end if;

    insert into public.customer_qr_payment_intents (hold_id, tenant_id, identity_digest, expires_at)
    values (p_hold_id, p_tenant_id, v_digest, v_hold.expires_at);
  end if;

  return jsonb_build_object('hold_id', p_hold_id, 'expires_at', v_hold.expires_at);
end;
$ham$;

revoke all on function public.customer_qr_open_payment_intent(uuid, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.customer_qr_open_payment_intent(uuid, uuid, uuid, text) to service_role;

commit;
