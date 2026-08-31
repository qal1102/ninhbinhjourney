-- TC-22 — Đặt chỗ trước, trả tiền tại điểm.
--
-- Vì sao: hệ thống chưa gánh được thanh toán thật. Chủ dự án chốt hướng tạm:
-- khách chọn "trả tiền tại điểm", hệ thống vẫn phát vé và xuất QR ngay; tới
-- nơi, nhân viên quét chính mã đó, thu tiền, rồi mới cho vào.
--
-- Hai thứ phải đi kèm, không được bỏ:
--
-- (1) **Bắt buộc để lại số điện thoại hoặc email.** Không có nó thì ai cũng
--     giữ được hàng chục chỗ rồi bỏ, và số liệu sức chứa lệch mà không ai
--     truy ra được. Liên hệ KHÔNG lưu thô: dùng đúng kho `customer_identities`
--     đã có (băm + mã hoá + phiên bản khoá), không dựng chỗ chứa thứ hai.
--
-- (2) **Cổng chặn tới khi thu đủ.** Vé chưa trả tiền quét ra kết quả riêng
--     `payment-due`, KHÔNG trừ lượt vào. Nhập nhèm cho vào rồi ghi nợ là cách
--     chắc chắn nhất để mất tiền mà không ai chịu trách nhiệm.
--
-- Cách tìm ràng buộc phải sửa — hỏi thẳng cơ sở dữ liệu, đừng grep mã nguồn
-- (bài học TC-15, bản đầu sót đúng một chỗ vì tìm bằng chuỗi):
--   select conname, pg_get_constraintdef(oid)
--   from pg_constraint
--   where conrelid = 'public.customer_payment_attempts'::regclass and contype = 'c';
-- Ba ràng buộc khoá cứng đã tìm ra bằng câu trên:
--   customer_payment_attempts_provider_check  = 'destinationos-simulation'
--   customer_payment_attempts_mode_check      = 'simulation'
--   customer_payment_attempts_status_check    = 'succeeded'
-- Ba cái đó khoá cứng có chủ đích, để không ai lỡ tay khai một khoản thu thật.
-- Nay nới ra vừa đủ cho một lối thu tiền mặt tại quầy, và thêm một ràng buộc
-- ghép để không sinh ra tổ hợp vô nghĩa.

begin;

-- 1. Kho ghi nhận thanh toán: mở đúng một lối "thu tại điểm".

alter table public.customer_payment_attempts
  drop constraint if exists customer_payment_attempts_provider_check;
alter table public.customer_payment_attempts
  add constraint customer_payment_attempts_provider_check
  check (provider in ('destinationos-simulation', 'on-site-counter'));

alter table public.customer_payment_attempts
  drop constraint if exists customer_payment_attempts_mode_check;
alter table public.customer_payment_attempts
  add constraint customer_payment_attempts_mode_check
  check (mode in ('simulation', 'pay-on-site'));

alter table public.customer_payment_attempts
  drop constraint if exists customer_payment_attempts_status_check;
alter table public.customer_payment_attempts
  add constraint customer_payment_attempts_status_check
  check (status in ('succeeded', 'pending'));

alter table public.customer_payment_attempts
  add column if not exists collected_by_account_id text
    references public.erp_account_registry(account_id) on delete restrict;
alter table public.customer_payment_attempts
  add column if not exists collected_at timestamptz;

-- Ràng buộc ghép: ba cột trên chỉ có đúng hai tổ hợp có nghĩa.
--
-- Nới riêng lẻ ba ràng buộc ở trên là đủ để lọt một hàng kiểu
-- `provider='destinationos-simulation', mode='pay-on-site', status='pending'`
-- — một khoản mô phỏng đang chờ thu tiền mặt, thứ không tồn tại ngoài đời.
-- Và một khoản thu tại điểm đã `succeeded` mà không ghi ai thu thì đúng bằng
-- việc mất dấu tiền.
alter table public.customer_payment_attempts
  drop constraint if exists customer_payment_attempts_mode_shape_check;
alter table public.customer_payment_attempts
  add constraint customer_payment_attempts_mode_shape_check
  check (
    (
      mode = 'simulation'
      and provider = 'destinationos-simulation'
      and status = 'succeeded'
      and collected_by_account_id is null
      and collected_at is null
    )
    or (
      mode = 'pay-on-site'
      and provider = 'on-site-counter'
      and (
        (status = 'pending' and collected_by_account_id is null and collected_at is null)
        or (status = 'succeeded' and collected_by_account_id is not null and collected_at is not null)
      )
    )
  );

create index if not exists customer_payment_attempts_pending_idx
  on public.customer_payment_attempts(tenant_id, order_id)
  where status = 'pending';

-- 2. Nhật ký thương mại: thêm hai loại sự kiện có thật.
--
-- Cố ý KHÔNG dùng lại 'payment-simulated' cho khoản thu tại điểm. Một khoản
-- tiền mặt thật mà ghi vào sổ là "mô phỏng" thì sổ nói dối, và người đọc sổ
-- sau này không có cách nào phân biệt.
alter table public.customer_commerce_audit_events
  drop constraint if exists customer_commerce_audit_events_event_type_check;
alter table public.customer_commerce_audit_events
  add constraint customer_commerce_audit_events_event_type_check
  check (
    event_type in (
      'hold-created',
      'payment-simulated',
      'payment-due-on-site',
      'payment-collected-on-site',
      'tickets-issued'
    )
  );

-- 3. Cổng soát vé: thêm kết quả "chưa thu tiền".
--
-- Tách hẳn khỏi 'void' và 'exhausted': vé này hợp lệ, đúng ngày, đúng cơ sở và
-- còn lượt — chỉ là chưa trả tiền. Báo nhầm sang một trong hai kết quả kia là
-- đẩy nhân viên đi tìm một vấn đề không tồn tại, đúng bài học TC-06.
alter table public.erp_gate_scan_events
  drop constraint if exists erp_gate_scan_events_result_check;
alter table public.erp_gate_scan_events
  add constraint erp_gate_scan_events_result_check
  check (
    result in (
      'accepted',
      'not-found',
      'wrong-site',
      'wrong-day',
      'exhausted',
      'already-entered',
      'payment-due',
      'void',
      'legacy-uncheckable'
    )
  );

-- 4. Xác nhận đơn — nay có hai lối trả tiền.
--
-- Tên cũ `customer_confirm_simulated_booking` phải bỏ: nó chỉ đúng cho một
-- trong hai lối, và một cái tên nói sai một nửa thì tệ hơn không có tên.
--
-- ⚠ Bẫy TC-01: `create or replace` khớp theo (tên, kiểu tham số). Thêm tham số
-- là sinh ra một bản nạp chồng chứ không thay bản cũ, và rồi hai bản cùng sống.
-- Phải `drop function` tường minh.
drop function if exists public.customer_confirm_simulated_booking(
  uuid, uuid, uuid, uuid, timestamptz
);

create or replace function public.customer_confirm_booking(
  p_tenant_id uuid,
  p_payment_request_id uuid,
  p_hold_id uuid,
  p_anonymous_id uuid,
  p_occurred_at timestamptz,
  p_payment_mode text,
  p_identity_type text,
  p_identity_digest text,
  p_identity_ciphertext text,
  p_encryption_key_version text
)
returns table (
  order_id uuid,
  order_code text,
  order_status text,
  payment_attempt_id uuid,
  payment_status text,
  payment_mode text,
  amount_due_vnd integer,
  tickets jsonb,
  inserted boolean
)
language plpgsql
security definer
set search_path = ''
as $$
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
  v_identity_type text := trim(coalesce(p_identity_type, ''));
  v_identity_digest text := lower(trim(coalesce(p_identity_digest, '')));
  v_outstanding integer;
begin
  if p_tenant_id is null or p_payment_request_id is null or p_hold_id is null
     or p_anonymous_id is null or p_occurred_at is null
     or p_occurred_at > now() + interval '5 minutes' then
    raise exception using errcode = '22023', message = 'CUSTOMER_PAYMENT_INPUT_INVALID';
  end if;
  if v_mode not in ('simulation', 'pay-on-site') then
    raise exception using errcode = '22023', message = 'CUSTOMER_PAYMENT_MODE_INVALID';
  end if;
  v_on_site := v_mode = 'pay-on-site';

  -- Trả tiền tại điểm thì BẮT BUỘC có liên hệ. Đây là điều kiện duy nhất giữ
  -- cho một chỗ chưa trả tiền còn truy được về một người thật.
  if v_on_site then
    if v_identity_type not in ('phone', 'email')
       or v_identity_digest !~ '^[0-9a-f]{64}$'
       or char_length(coalesce(p_identity_ciphertext, '')) not between 24 and 4096
       or char_length(trim(coalesce(p_encryption_key_version, ''))) not between 1 and 40 then
      raise exception using errcode = '22023', message = 'CUSTOMER_PAYMENT_CONTACT_REQUIRED';
    end if;
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
    on conflict (tenant_id, identity_type, identity_digest) do nothing;
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
    case when v_on_site then 'onsite-' else 'sim-' end || p_payment_request_id::text,
    v_mode,
    case when v_on_site then 'pending' else 'succeeded' end,
    v_order.total_vnd, v_order.currency, p_occurred_at
  ) returning * into v_payment;

  update public.customer_booking_holds
  set status = 'converted', converted_at = now()
  where id = v_hold.id;
  update public.customer_orders
  set status = 'confirmed', updated_at = now()
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
$$;

revoke all on function public.customer_confirm_booking(
  uuid, uuid, uuid, uuid, timestamptz, text, text, text, text, text
) from public, anon, authenticated;
grant execute on function public.customer_confirm_booking(
  uuid, uuid, uuid, uuid, timestamptz, text, text, text, text, text
) to service_role;

-- 4b. Lớp đệm giữ tên cũ sống thêm một nhịp.
--
-- Migration lên trước, mã nguồn lên sau — luôn luôn theo thứ tự đó. Nhưng đổi
-- tên hàm thì thứ tự nào cũng gãy: áp trước thì bản web đang chạy gọi một cái
-- tên vừa biến mất; deploy trước thì bản web mới gọi một cái tên chưa có.
--
-- Lớp đệm này cắt nút thắt: trong quãng giữa, **cả hai tên đều chạy**. Nó
-- không có bản sao logic nào — chỉ gọi thẳng hàm thật với lối trả tiền mô
-- phỏng, đúng hành vi cũ từng chữ. Bỏ được sau khi mã nguồn đã lên và ổn định.
create or replace function public.customer_confirm_simulated_booking(
  p_tenant_id uuid,
  p_payment_request_id uuid,
  p_hold_id uuid,
  p_anonymous_id uuid,
  p_occurred_at timestamptz
)
returns table (
  order_id uuid,
  order_code text,
  order_status text,
  payment_attempt_id uuid,
  payment_status text,
  tickets jsonb,
  inserted boolean
)
language sql
security definer
set search_path = ''
as $$
  select
    ket_qua.order_id, ket_qua.order_code, ket_qua.order_status,
    ket_qua.payment_attempt_id, ket_qua.payment_status,
    ket_qua.tickets, ket_qua.inserted
  from public.customer_confirm_booking(
    p_tenant_id, p_payment_request_id, p_hold_id, p_anonymous_id, p_occurred_at,
    'simulation', null, null, null, null
  ) as ket_qua;
$$;

revoke all on function public.customer_confirm_simulated_booking(
  uuid, uuid, uuid, uuid, timestamptz
) from public, anon, authenticated;
grant execute on function public.customer_confirm_simulated_booking(
  uuid, uuid, uuid, uuid, timestamptz
) to service_role;

-- 5. Cổng soát vé biết vé nào chưa trả tiền.
--
-- Chỉ thêm đúng một nhánh vào chuỗi quyết định, đặt ngay sau "sai ngày": vé
-- sai ngày thì tiền nong chưa phải chuyện phải nói. Đặt sau "đã vào rồi" thì
-- vô nghĩa — người chưa trả tiền không thể đã vào, vì chính nhánh này chặn.
--
-- Nhánh này KHÔNG trừ lượt vào. Trừ trước rồi thu sau là tự mở đường cho một
-- người vào cửa mà không ai cầm được đồng nào.
create or replace function public.erp_gate_scan_ticket_at(
  p_tenant_id uuid,
  p_site_id uuid,
  p_code text,
  p_actor_account_id text,
  p_actor_name text,
  p_idempotency_key text,
  p_scanned_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text := upper(trim(coalesce(p_code, '')));
  v_actor_id text := trim(coalesce(p_actor_account_id, ''));
  v_actor_name text := trim(coalesce(p_actor_name, ''));
  v_key text := nullif(trim(coalesce(p_idempotency_key, '')), '');
  v_ticket public.erp_tickets;
  v_existing public.erp_gate_scan_events;
  v_result text;
  v_event public.erp_gate_scan_events;
  v_visit_date date := (p_scanned_at at time zone 'Asia/Ho_Chi_Minh')::date;
  v_member public.erp_visitor_group_members;
  v_group_has_ticket boolean := false;
  v_payment_due integer := 0;
begin
  -- TC-06: mot ma QR duy nhat phai lam duoc ca hai viec.
  --
  -- May quet o cong doc no de cho khach vao; dien thoai cua chinh khach quet
  -- no de mo trang tu ghi ten. Muon dien thoai mo duoc thi ma QR phai chua mot
  -- dia chi web — va luc do may quet o cong se go NGUYEN CA DIA CHI vao o quet.
  --
  -- Cat lay doan cuoi de hai duong cung ve mot ma. Ma ve va ma thanh vien deu
  -- khong bao gio chua dau '/', nen luat nay khong dung toi mot ma hop le nao.
  --
  -- Phia may quet ngoai tuyen bam ma truoc khi doi chieu, nen no phai cat y
  -- het cach nay: xem `normalizeScannedCode` trong `lib/erp/offline-gate-store.ts`.
  -- Hai ben lech nhau mot ky tu la ma QR chay duoc online va truot offline.
  if position('/' in v_code) > 0 then
    v_code := upper(trim(regexp_replace(
      rtrim(split_part(split_part(v_code, '?', 1), '#', 1), '/'),
      '^.*/', ''
    )));
  end if;

  if char_length(v_code) < 6 or char_length(v_code) > 60
     or char_length(v_actor_id) not between 2 and 100
     or char_length(v_actor_name) < 1
     or v_key is null or char_length(v_key) > 128
     or p_scanned_at < now() - interval '36 hours'
     or p_scanned_at > now() + interval '5 minutes' then
    raise exception using errcode = '22023', message = 'GATE_SCAN_CODE_INVALID';
  end if;
  if not exists (select 1 from public.sites site where site.id = p_site_id and site.tenant_id = p_tenant_id) then
    raise exception using errcode = '23503', message = 'GATE_SCAN_SITE_TENANT_MISMATCH';
  end if;

  select * into v_existing from public.erp_gate_scan_events event
  where event.tenant_id = p_tenant_id and event.idempotency_key = v_key;
  if v_existing.id is not null then
    if v_existing.site_id <> p_site_id or v_existing.code <> v_code
       or v_existing.scanned_by_account_id <> v_actor_id then
      raise exception using errcode = '23505', message = 'GATE_SCAN_IDEMPOTENCY_CONFLICT';
    end if;
    return jsonb_build_object(
      'event_id', v_existing.id, 'result', v_existing.result,
      'code', v_existing.code, 'scanned_at', v_existing.scanned_at,
      'replayed', true, 'ticket', null
    );
  end if;

  select * into v_ticket from public.erp_tickets ticket
  where ticket.tenant_id = p_tenant_id and ticket.ticket_code = v_code for update;

  -- TC-06: khong phai ma ve thi thu xem co phai ma thanh vien khong.
  if v_ticket.id is null then
    select * into v_member from public.erp_visitor_group_members m
    where m.tenant_id = p_tenant_id and m.member_code = v_code;
    if v_member.id is not null then
      -- Ve cua doan tai chinh co so nay, dung nhom chieu cao cua nguoi nay.
      select ticket.* into v_ticket
      from public.erp_visitor_groups g
      join public.customer_order_tickets bridge
        on bridge.order_id = g.order_id and bridge.tenant_id = g.tenant_id
      join public.erp_tickets ticket on ticket.id = bridge.ticket_id
      where g.id = v_member.group_id
        and g.tenant_id = p_tenant_id
        and bridge.site_id = p_site_id
        and bridge.guest_group = v_member.guest_group
      for update of ticket;
      if v_ticket.id is null then
        -- Doan co ve, chi la khong phai o cua nay. Noi dung nhu vay thi nhan
        -- vien biet phai chi khach di dau, thay vi tuong ma gia.
        select exists (
          select 1
          from public.erp_visitor_groups g
          join public.customer_order_tickets bridge
            on bridge.order_id = g.order_id and bridge.tenant_id = g.tenant_id
          where g.id = v_member.group_id and g.tenant_id = p_tenant_id
        ) into v_group_has_ticket;
      end if;
    end if;
  end if;

  -- TC-22: ve nay co dang no tien khong.
  --
  -- So thanh toan CHI GHI THEM (trigger `customer_append_only`), nen mot khoan
  -- da thu khong the la hang cu duoc sua lai — no la mot hang moi. Vi vay "con
  -- no" = co hang cho thu, VA chua co hang da thu nao cho cung don.
  if v_ticket.id is not null then
    select coalesce(cho_thu.amount_vnd, 0) into v_payment_due
    from public.customer_order_tickets bridge
    join public.customer_payment_attempts cho_thu
      on cho_thu.order_id = bridge.order_id
     and cho_thu.tenant_id = bridge.tenant_id
     and cho_thu.mode = 'pay-on-site'
     and cho_thu.status = 'pending'
    where bridge.ticket_id = v_ticket.id
      and bridge.tenant_id = p_tenant_id
      and not exists (
        select 1 from public.customer_payment_attempts da_thu
        where da_thu.order_id = bridge.order_id
          and da_thu.tenant_id = bridge.tenant_id
          and da_thu.mode = 'pay-on-site'
          and da_thu.status = 'succeeded'
      )
    limit 1;
    v_payment_due := coalesce(v_payment_due, 0);
  end if;

  if v_ticket.id is null then
    v_result := case when v_group_has_ticket then 'wrong-site' else 'not-found' end;
  elsif v_ticket.status = 'void' then v_result := 'void';
  elsif v_ticket.site_id <> p_site_id then v_result := 'wrong-site';
  elsif v_ticket.valid_on <> v_visit_date then v_result := 'wrong-day';
  elsif v_payment_due > 0 then
    -- Ve that, dung ngay, dung cua, con luot — chi la chua tra tien. Khong tru
    -- luot vao: thu xong nhan vien quet lai, luc do moi la mot luot vao that.
    v_result := 'payment-due';
  elsif v_member.id is not null and exists (
    select 1 from public.erp_gate_scan_events event
    where event.tenant_id = p_tenant_id
      and event.ticket_id = v_ticket.id
      and event.member_id = v_member.id
      and event.result = 'accepted'
  ) then
    -- Nguoi nay da vao roi. Ve doan co the con thua luot, nen KHONG phai
    -- 'exhausted' — noi sai o day la day nhan vien di tim mot van de khong co.
    v_result := 'already-entered';
  elsif v_ticket.entries_used >= v_ticket.entries_allowed then v_result := 'exhausted';
  else
    v_result := 'accepted';
    update public.erp_tickets set
      entries_used = entries_used + 1,
      status = case when entries_used + 1 >= entries_allowed then 'used' else 'partially-used' end,
      updated_at = now()
    where id = v_ticket.id returning * into v_ticket;
  end if;

  insert into public.erp_gate_scan_events (
    tenant_id, site_id, code, scanned_by_account_id, scanned_by_name,
    ticket_id, member_id, result, idempotency_key
  ) values (
    p_tenant_id, p_site_id, v_code, v_actor_id, v_actor_name,
    case when v_ticket.id is null then null else v_ticket.id end,
    case when v_member.id is null then null else v_member.id end,
    v_result, v_key
  ) returning * into v_event;

  return jsonb_build_object(
    'event_id', v_event.id, 'result', v_result, 'code', v_code,
    'scanned_at', v_event.scanned_at, 'replayed', false,
    'payment_due_vnd', v_payment_due,
    'member', case when v_member.id is null then null else jsonb_build_object(
      'member_index', v_member.member_index,
      'guest_group', v_member.guest_group,
      'display_name', v_member.display_name
    ) end,
    'ticket', case when v_ticket.id is null then null else jsonb_build_object(
      'ticket_code', v_ticket.ticket_code, 'product', v_ticket.product,
      'guest_name', v_ticket.guest_name, 'guest_phone', v_ticket.guest_phone,
      'booking_reference', v_ticket.booking_reference, 'channel', v_ticket.channel,
      'valid_on', v_ticket.valid_on, 'entries_allowed', v_ticket.entries_allowed,
      'entries_used', v_ticket.entries_used, 'status', v_ticket.status
    ) end
  );
end;
$$;

-- 6. Bản kê ngoại tuyến không mang vé còn nợ tiền.
--
-- Thiếu đúng dòng này là thủng một lỗ tiền: mất mạng thì máy ở cổng đối chiếu
-- theo bản kê, và một tấm vé chưa trả tiền nằm trong bản kê sẽ được cho vào
-- như thường. Thu tiền là việc phải có mạng — nói thẳng như vậy còn hơn để
-- khách đi qua rồi mới biết.
create or replace function public.erp_prepare_offline_gate_manifest(
  p_tenant_id uuid,
  p_site_id uuid,
  p_actor_account_id text,
  p_device_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_manifest_id uuid := gen_random_uuid();
  v_service_date date := (now() at time zone 'Asia/Ho_Chi_Minh')::date;
  v_expires_at timestamptz;
  v_tickets jsonb;
  v_count integer;
  v_digest text;
begin
  if p_device_id is null or not public.erp_gate_actor_can_scan(p_tenant_id, p_site_id, p_actor_account_id) then
    raise exception using errcode = '42501', message = 'GATE_OFFLINE_ACTOR_REQUIRED';
  end if;
  if not exists (select 1 from public.sites site where site.id = p_site_id and site.tenant_id = p_tenant_id) then
    raise exception using errcode = '23503', message = 'GATE_SCAN_SITE_TENANT_MISMATCH';
  end if;

  v_expires_at := least(
    now() + interval '12 hours',
    ((v_service_date + 1)::timestamp at time zone 'Asia/Ho_Chi_Minh')
  );

  with ve_con_hieu_luc as (
    select ticket.id, upper(trim(ticket.ticket_code)) as ma,
           ticket.entries_allowed - ticket.entries_used as con_lai
    from public.erp_tickets ticket
    where ticket.tenant_id = p_tenant_id
      and ticket.site_id = p_site_id
      and ticket.valid_on = v_service_date
      and ticket.status in ('issued', 'partially-used')
      and ticket.entries_used < ticket.entries_allowed
      -- TC-22: ve con no tien thi khong phat ra ngoai tuyen. Doc y het cach
      -- cua o quet: co hang cho thu, va chua co hang da thu nao cho don do.
      and not exists (
        select 1
        from public.customer_order_tickets bridge
        join public.customer_payment_attempts cho_thu
          on cho_thu.order_id = bridge.order_id
         and cho_thu.tenant_id = bridge.tenant_id
         and cho_thu.mode = 'pay-on-site'
         and cho_thu.status = 'pending'
        where bridge.ticket_id = ticket.id
          and bridge.tenant_id = ticket.tenant_id
          and not exists (
            select 1 from public.customer_payment_attempts da_thu
            where da_thu.order_id = bridge.order_id
              and da_thu.tenant_id = bridge.tenant_id
              and da_thu.mode = 'pay-on-site'
              and da_thu.status = 'succeeded'
          )
      )
  ),
  moi_ma as (
    select ma, con_lai from ve_con_hieu_luc
    union all
    -- Ma thanh vien chua dung, thuoc dung tam ve cua nhom chieu cao cua ho.
    select member.member_code, ve.con_lai
    from public.erp_visitor_group_members member
    join public.erp_visitor_groups grp
      on grp.id = member.group_id and grp.tenant_id = member.tenant_id
    join public.customer_order_tickets bridge
      on bridge.order_id = grp.order_id and bridge.tenant_id = grp.tenant_id
      and bridge.guest_group = member.guest_group
    join ve_con_hieu_luc ve on ve.id = bridge.ticket_id
    where member.tenant_id = p_tenant_id
      and not exists (
        select 1 from public.erp_gate_scan_events event
        where event.tenant_id = member.tenant_id
          and event.member_id = member.id
          and event.ticket_id = ve.id
          and event.result = 'accepted'
      )
  )
  select
    coalesce(jsonb_agg(jsonb_build_object(
      'code_digest', encode(extensions.digest(ma, 'sha256'), 'hex'),
      'entries_remaining', con_lai
    ) order by ma), '[]'::jsonb),
    count(*)::integer
  into v_tickets, v_count
  from moi_ma;

  v_digest := encode(extensions.digest(v_tickets::text, 'sha256'), 'hex');

  insert into public.erp_gate_offline_manifests (
    id, tenant_id, site_id, device_id, actor_account_id, service_date,
    ticket_count, snapshot_digest, expires_at
  ) values (
    v_manifest_id, p_tenant_id, p_site_id, p_device_id, trim(p_actor_account_id),
    v_service_date, v_count, v_digest, v_expires_at
  );

  return jsonb_build_object(
    'manifest_id', v_manifest_id,
    'site_id', p_site_id,
    'device_id', p_device_id,
    'service_date', v_service_date,
    'issued_at', now(),
    'expires_at', v_expires_at,
    'ticket_count', v_count,
    'snapshot_digest', v_digest,
    'tickets', v_tickets
  );
end;
$$;

-- 7. Nhân viên thu tiền tại điểm.
--
-- Tách hẳn khỏi việc cho khách vào, dù trên màn hình chỉ là một cú chạm. Thu
-- tiền là một sự kiện tiền bạc, cho vào là một sự kiện cổng — ghi chung một
-- dòng thì tới lúc đối soát không ai tách lại được.
--
-- Chỉ người đang được phân công gác đúng cổng đó mới bấm được, dùng lại đúng
-- `erp_gate_actor_can_scan` chứ không dựng luật quyền thứ hai.
create or replace function public.erp_collect_on_site_payment(
  p_tenant_id uuid,
  p_site_id uuid,
  p_code text,
  p_actor_account_id text,
  p_occurred_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text := upper(trim(coalesce(p_code, '')));
  v_actor_id text := trim(coalesce(p_actor_account_id, ''));
  v_ticket public.erp_tickets;
  v_member public.erp_visitor_group_members;
  v_payment public.customer_payment_attempts;
  v_order public.customer_orders;
begin
  if p_occurred_at is null
     or p_occurred_at > now() + interval '5 minutes'
     or p_occurred_at < now() - interval '36 hours' then
    raise exception using errcode = '22023', message = 'PAYMENT_COLLECT_INPUT_INVALID';
  end if;
  if not public.erp_gate_actor_can_scan(p_tenant_id, p_site_id, v_actor_id) then
    raise exception using errcode = '42501', message = 'PAYMENT_COLLECT_ACTOR_REQUIRED';
  end if;

  -- Cùng luật cắt địa chỉ web như ô quét, vì nhân viên bấm nút này ngay sau
  -- khi vừa quét — nếu hai bên hiểu mã khác nhau thì thu tiền một đằng, cho
  -- vào một nẻo.
  if position('/' in v_code) > 0 then
    v_code := upper(trim(regexp_replace(
      rtrim(split_part(split_part(v_code, '?', 1), '#', 1), '/'),
      '^.*/', ''
    )));
  end if;

  select * into v_ticket from public.erp_tickets ticket
  where ticket.tenant_id = p_tenant_id and ticket.ticket_code = v_code;
  if v_ticket.id is null then
    select * into v_member from public.erp_visitor_group_members m
    where m.tenant_id = p_tenant_id and m.member_code = v_code;
    if v_member.id is not null then
      select ticket.* into v_ticket
      from public.erp_visitor_groups g
      join public.customer_order_tickets bridge
        on bridge.order_id = g.order_id and bridge.tenant_id = g.tenant_id
      join public.erp_tickets ticket on ticket.id = bridge.ticket_id
      where g.id = v_member.group_id
        and g.tenant_id = p_tenant_id
        and bridge.site_id = p_site_id
        and bridge.guest_group = v_member.guest_group;
    end if;
  end if;
  if v_ticket.id is null then
    raise exception using errcode = 'P0002', message = 'PAYMENT_COLLECT_TICKET_NOT_FOUND';
  end if;

  -- Tìm khoản đang chờ thu của đơn mang tấm vé này.
  select payment.* into v_payment
  from public.customer_order_tickets bridge
  join public.customer_payment_attempts payment
    on payment.order_id = bridge.order_id
   and payment.tenant_id = bridge.tenant_id
  where bridge.ticket_id = v_ticket.id
    and bridge.tenant_id = p_tenant_id
    and payment.mode = 'pay-on-site'
    and payment.status = 'pending'
  limit 1;

  if v_payment.id is null then
    raise exception using errcode = 'P0002', message = 'PAYMENT_COLLECT_NOTHING_DUE';
  end if;

  select customer_order.* into v_order
  from public.customer_orders customer_order
  where customer_order.id = v_payment.order_id and customer_order.tenant_id = p_tenant_id;

  -- ⚠ Sổ thanh toán CHỈ GHI THÊM — trigger `customer_append_only` chặn mọi
  -- `update`/`delete`. Bản đầu của hàm này sửa thẳng hàng chờ thu thành "đã
  -- thu" và bị chặn ngay trong lượt chạy thử trên production. Ràng buộc đó
  -- đúng, không phải chướng ngại: một khoản tiền đã ghi thì không được phép
  -- biến thành khoản khác.
  --
  -- Nên việc thu tiền là **một hàng mới**: hàng chờ thu ở lại làm bằng chứng
  -- "khách đã chọn trả tại điểm, số tiền bấy nhiêu", hàng mới ghi "ai thu,
  -- lúc nào". Đọc sổ theo thứ tự là thấy đủ câu chuyện.
  --
  -- Khoá chống thu hai lần chính là `unique (tenant_id, idempotency_key)`:
  -- lấy luôn id của hàng chờ thu làm khoá. Hai nhân viên cùng bấm trên hai
  -- máy thì người sau đụng khoá duy nhất — chặn ở cơ sở dữ liệu, không phải
  -- bằng một câu `if` đọc trước rồi ghi sau (hai người cùng đọc "chưa thu"
  -- rồi cùng ghi là chuyện có thật ở cổng đông khách).
  begin
    insert into public.customer_payment_attempts (
      tenant_id, order_id, hold_id, idempotency_key, provider,
      provider_event_id, mode, status, amount_vnd, currency, occurred_at,
      collected_by_account_id, collected_at
    ) values (
      p_tenant_id, v_order.id, v_payment.hold_id, v_payment.id,
      'on-site-counter', 'collect-' || v_payment.id::text,
      'pay-on-site', 'succeeded', v_payment.amount_vnd, v_payment.currency,
      p_occurred_at, v_actor_id, p_occurred_at
    ) returning * into v_payment;
  exception when unique_violation then
    -- Đã có người thu rồi. Nói đúng như vậy chứ không báo lỗi: nhân viên bấm
    -- hai lần là chuyện thường, bắt họ đoán thì tệ hơn.
    select payment.* into v_payment
    from public.customer_payment_attempts payment
    where payment.tenant_id = p_tenant_id
      and payment.order_id = v_order.id
      and payment.mode = 'pay-on-site'
      and payment.status = 'succeeded'
    limit 1;
    return jsonb_build_object(
      'collected', false,
      'already_collected', true,
      'amount_vnd', v_payment.amount_vnd,
      'order_code', v_order.order_code,
      'collected_by', v_payment.collected_by_account_id,
      'collected_at', v_payment.collected_at
    );
  end;

  insert into public.customer_commerce_audit_events (
    tenant_id, profile_id, order_id, hold_id, payment_attempt_id,
    event_type, metadata, occurred_at
  ) values (
    p_tenant_id, v_order.profile_id, v_order.id, v_payment.hold_id, v_payment.id,
    'payment-collected-on-site',
    -- Cố ý KHÔNG nhét `site_id` vào đây. Bộ canh dữ liệu cá nhân
    -- (`customer_json_contains_pii`) soi chuỗi trong metadata, và một UUID
    -- kiểu `10000000-0000-4000-8000-...` trông vừa đủ giống một số điện thoại
    -- Việt Nam để bị chặn — đã đụng thật trong lượt chạy thử. Cơ sở nào thì
    -- tra ngược từ nhật ký quét cổng, không cần chép lại vào sổ tiền.
    jsonb_build_object('amount_vnd', v_payment.amount_vnd, 'currency', 'VND'),
    p_occurred_at
  );

  return jsonb_build_object(
    'collected', true,
    'already_collected', false,
    'amount_vnd', v_payment.amount_vnd,
    'order_code', v_order.order_code,
    'collected_by', v_payment.collected_by_account_id,
    'collected_at', v_payment.collected_at
  );
end;
$$;

revoke all on function public.erp_collect_on_site_payment(
  uuid, uuid, text, text, timestamptz
) from public, anon, authenticated;
grant execute on function public.erp_collect_on_site_payment(
  uuid, uuid, text, text, timestamptz
) to service_role;

commit;
