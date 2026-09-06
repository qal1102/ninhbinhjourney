-- TC-23 — Lấy lại vé bằng mã đặt chỗ cộng liên hệ đã dùng khi đặt.
--
-- Vì sao: TC-22 phát vé và mã QR ngay trên màn hình, nhưng hệ thống KHÔNG gửi
-- được tin nhắn hay email xác nhận — phần gửi ra ngoài mới là hàng đợi mô
-- phỏng, chưa đấu nhà cung cấp nào. Nghĩa là khách đóng tab là mất sạch: tới
-- cổng không có gì đưa cho nhân viên quét. Đó là lỗi chặn luồng.
--
-- Hướng đã chốt: chưa mua dịch vụ gửi tin. Thay vào đó mở một lối tự tra cứu,
-- giá 0 đồng, khách nhập mã đặt chỗ cùng liên hệ đã để lại là lấy lại được vé.
--
-- Ba điều kiện an toàn, không cái nào bỏ được:
--
-- (1) **Chỉ mã đặt chỗ thì KHÔNG mở vé.** Mã in trên màn hình, chụp lại được,
--     nhìn qua vai cũng đọc được. Phải kèm đúng số điện thoại hoặc email đã
--     dùng lúc đặt.
--
-- (2) **So khớp bằng chuỗi băm, không bao giờ giải mã.** Liên hệ nằm trong kho
--     chung `customer_identities` (băm HMAC + mã hoá AES + phiên bản khoá).
--     Hàm này chỉ nhận chuỗi băm đã tính sẵn ở lớp ứng dụng, và chỉ so chuỗi
--     với chuỗi. Không dựng kho liên hệ thứ hai, và bản rõ không đi qua đây.
--
-- (3) **Sai mã và sai liên hệ trả về CÙNG một câu.** Hàm này trả đúng một hình
--     dạng `found = false` cho cả hai, không có nhánh nào nói "mã có thật
--     nhưng số điện thoại sai" — câu ấy chính là thứ biến một mã nhặt được
--     thành một cuộc dò số điện thoại.
--
-- Một chỗ phải vá kèm, nếu không lối tra cứu sai âm thầm: TC-22 gắn liên hệ
-- vào đơn bằng cách suy ra từ hồ sơ phiên (`profile_id`). Khoá duy nhất của
-- kho liên hệ là (tenant, loại, băm), nên một số điện thoại chỉ nằm dưới ĐÚNG
-- MỘT hồ sơ — hồ sơ đầu tiên từng dùng nó. Khách đặt lần hai từ máy khác sinh
-- ra hồ sơ khác, `on conflict do nothing` giữ nguyên hồ sơ cũ, và đơn thứ hai
-- không còn đường nối về liên hệ nữa. Tra cứu sẽ báo "không tìm thấy" cho
-- đúng người đã trả thông tin thật. Nay đơn trỏ thẳng vào hàng liên hệ bằng
-- `customer_orders.identity_id` — một tham chiếu tới kho đã có, không phải một
-- bản sao liên hệ.

begin;

-- 1. Đơn trỏ thẳng vào đúng hàng liên hệ đã dùng khi đặt.
--
-- Cột này là KHOÁ NGOẠI, không phải chỗ chứa liên hệ: nó không giữ số điện
-- thoại, không giữ bản mã, chỉ giữ id của hàng trong kho chung. Để trống ở mọi
-- đơn trả ngay — thu một dữ liệu cá nhân không dùng tới vẫn là một khoản nợ.
alter table public.customer_orders
  add column if not exists identity_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conname = 'customer_orders_identity_fk'
      and conrelid = 'public.customer_orders'::regclass
  ) then
    alter table public.customer_orders
      add constraint customer_orders_identity_fk
      foreign key (identity_id, tenant_id)
      references public.customer_identities(id, tenant_id) on delete restrict;
  end if;
end;
$$;

-- 2. Nhật ký mỗi lần tra cứu — cũng chính là bộ đếm chặn dò mã.
--
-- Bảng này KHÔNG giữ một chữ nào đọc được: mã đặt chỗ băm SHA-256, liên hệ đã
-- là chuỗi băm HMAC từ lớp ứng dụng. Không có cột jsonb, nên không có đường
-- nào lọt một số điện thoại vào đây rồi bị `customer_json_contains_pii` chặn
-- giữa đường — bài học TC-22, khi một UUID trông vừa đủ giống số điện thoại
-- Việt Nam đã làm cả migration đứng lại.
--
-- Đây là cách đếm mà dự án vẫn dùng cho mọi trần (giữ chỗ theo giờ, đơn còn
-- nợ theo liên hệ): đếm hàng có thật trong một cửa sổ thời gian, không giữ bộ
-- đếm trong bộ nhớ tiến trình — máy chủ có bao nhiêu bản chạy song song thì
-- một bộ đếm trong bộ nhớ cũng chỉ đúng cho một bản.
create table if not exists public.customer_ticket_lookup_attempts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  order_code_digest text not null check (order_code_digest ~ '^[0-9a-f]{64}$'),
  identity_type text not null check (identity_type in ('phone', 'email')),
  identity_digest text not null check (identity_digest ~ '^[0-9a-f]{64}$'),
  outcome text not null check (outcome in ('matched', 'rejected', 'throttled')),
  occurred_at timestamptz not null default now()
);

create index if not exists customer_ticket_lookup_attempts_identity_idx
  on public.customer_ticket_lookup_attempts(tenant_id, identity_digest, occurred_at desc);
create index if not exists customer_ticket_lookup_attempts_code_idx
  on public.customer_ticket_lookup_attempts(tenant_id, order_code_digest, occurred_at desc);

drop trigger if exists customer_ticket_lookup_attempts_append_only
  on public.customer_ticket_lookup_attempts;
create trigger customer_ticket_lookup_attempts_append_only
before update or delete on public.customer_ticket_lookup_attempts
for each row execute function public.customer_append_only();

alter table public.customer_ticket_lookup_attempts enable row level security;

revoke all on table public.customer_ticket_lookup_attempts
  from public, anon, authenticated, service_role;
grant select on table public.customer_ticket_lookup_attempts to service_role;

-- 3. Xác nhận đơn — giữ nguyên từng chữ của TC-22, thêm đúng một đường nối.
--
-- ⚠ Chép lại trọn hàm là có chủ đích: `create or replace` thay cả thân hàm,
-- nên bỏ sót một dòng là mất một nhánh nghiệp vụ. Thân hàm dưới đây lấy
-- nguyên văn từ `202608310057_customer_pay_on_site.sql`, chỉ khác ba chỗ đã
-- ghi rõ bằng chú thích TC-23. Chữ ký không đổi, nên không cần `drop`.
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
  v_identity_id uuid;
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
    case when v_on_site then 'onsite-' else 'sim-' end || p_payment_request_id::text,
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
$$;

revoke all on function public.customer_confirm_booking(
  uuid, uuid, uuid, uuid, timestamptz, text, text, text, text, text
) from public, anon, authenticated;
grant execute on function public.customer_confirm_booking(
  uuid, uuid, uuid, uuid, timestamptz, text, text, text, text, text
) to service_role;

-- 4. Tra cứu vé — một lời gọi, một câu trả lời, một hàng nhật ký.
--
-- Trần đếm hai chiều, vì hai kiểu dò khác hẳn nhau:
--   · theo LIÊN HỆ (10 lượt/giờ) chặn người cầm một số điện thoại đi dò hàng
--     nghìn mã đặt chỗ;
--   · theo MÃ ĐẶT CHỖ (20 lượt/giờ) chặn người nhặt được một mã rồi đi dò số
--     điện thoại — trần theo liên hệ không cản được kiểu này, vì mỗi số chỉ
--     bị đếm đúng một lượt.
-- Trần thứ hai có cái giá của nó: ai đó cố tình bắn 20 lượt sai vào một mã sẽ
-- khoá chính chủ trong một giờ. Chấp nhận, và ghi rõ ở đây: mất một giờ còn
-- hơn mất vé vào tay người dò trúng số.
--
-- Hàm ghi nhật ký ở CẢ BA lối ra và không `raise` ở lối nào — `raise` cuộn
-- ngược giao dịch, mà cuộn ngược thì hàng nhật ký vừa ghi cũng bay theo, và
-- bộ đếm chống dò tự xoá chính mình sau mỗi lần chạm trần.
--
-- Lượt bị chặn vẫn ghi vào nhật ký nhưng KHÔNG tính vào trần. Tính vào thì
-- người gõ nhầm mấy lần rồi sốt ruột bấm thêm sẽ tự đẩy mốc hết hạn của mình
-- ra xa mãi, còn kẻ đi dò thì vẫn chỉ có đúng 10 lượt được đếm mỗi giờ —
-- nghĩa là tính vào chỉ phạt đúng người đang cần vé.
create or replace function public.customer_lookup_order_tickets(
  p_tenant_id uuid,
  p_order_code text,
  p_identity_type text,
  p_identity_digest text,
  p_occurred_at timestamptz
)
returns table (
  found boolean,
  throttled boolean,
  order_code text,
  product_id uuid,
  visit_date date,
  party_size integer,
  adults integer,
  children integer,
  total_vnd integer,
  currency text,
  order_status text,
  payment_mode text,
  payment_status text,
  amount_due_vnd integer,
  tickets jsonb
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text := upper(trim(coalesce(p_order_code, '')));
  v_identity_type text := trim(coalesce(p_identity_type, ''));
  v_identity_digest text := lower(trim(coalesce(p_identity_digest, '')));
  v_code_digest text;
  v_order public.customer_orders;
  v_identity public.customer_identities;
  v_payment public.customer_payment_attempts;
  v_tickets jsonb;
begin
  if p_tenant_id is null or p_occurred_at is null
     or p_occurred_at > now() + interval '5 minutes'
     or p_occurred_at < now() - interval '1 hour' then
    raise exception using errcode = '22023', message = 'CUSTOMER_LOOKUP_INPUT_INVALID';
  end if;
  if v_identity_type not in ('phone', 'email')
     or v_identity_digest !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = '22023', message = 'CUSTOMER_LOOKUP_INPUT_INVALID';
  end if;

  -- Mã sai khuôn vẫn đi hết đường như mã đúng khuôn: trả về đúng một câu, và
  -- vẫn tính vào trần. Cắt sớm ở đây là tự khai "mã này không thể có thật".
  v_code_digest := encode(extensions.digest(v_code, 'sha256'), 'hex');

  if (
    select count(*) from public.customer_ticket_lookup_attempts attempt
    where attempt.tenant_id = p_tenant_id
      and attempt.identity_digest = v_identity_digest
      and attempt.outcome <> 'throttled'
      and attempt.occurred_at > now() - interval '1 hour'
  ) >= 10
  or (
    select count(*) from public.customer_ticket_lookup_attempts attempt
    where attempt.tenant_id = p_tenant_id
      and attempt.order_code_digest = v_code_digest
      and attempt.outcome <> 'throttled'
      and attempt.occurred_at > now() - interval '1 hour'
  ) >= 20 then
    insert into public.customer_ticket_lookup_attempts (
      tenant_id, order_code_digest, identity_type, identity_digest, outcome, occurred_at
    ) values (
      p_tenant_id, v_code_digest, v_identity_type, v_identity_digest, 'throttled', p_occurred_at
    );
    return query select
      false, true, null::text, null::uuid, null::date, null::integer, null::integer,
      null::integer, null::integer, null::text, null::text, null::text, null::text,
      null::integer, null::jsonb;
    return;
  end if;

  select customer_order.* into v_order
  from public.customer_orders customer_order
  where customer_order.tenant_id = p_tenant_id
    and customer_order.order_code = v_code
    and customer_order.status = 'confirmed';

  -- Liên hệ phải khớp bằng chuỗi băm, và phải là chính hàng liên hệ đã gắn
  -- vào đơn. So theo hồ sơ phiên thì một người dùng chung máy với người khác
  -- có thể mở được vé của nhau; so theo `identity_id` thì không.
  if v_order.id is not null and v_order.identity_id is not null then
    select identity.* into v_identity
    from public.customer_identities identity
    where identity.id = v_order.identity_id
      and identity.tenant_id = p_tenant_id
      and identity.identity_type = v_identity_type
      and identity.identity_digest = v_identity_digest;
  end if;

  if v_identity.id is null then
    insert into public.customer_ticket_lookup_attempts (
      tenant_id, order_code_digest, identity_type, identity_digest, outcome, occurred_at
    ) values (
      p_tenant_id, v_code_digest, v_identity_type, v_identity_digest, 'rejected', p_occurred_at
    );
    return query select
      false, false, null::text, null::uuid, null::date, null::integer, null::integer,
      null::integer, null::integer, null::text, null::text, null::text, null::text,
      null::integer, null::jsonb;
    return;
  end if;

  select payment.* into v_payment
  from public.customer_payment_attempts payment
  where payment.tenant_id = p_tenant_id
    and payment.order_id = v_order.id
  order by case when payment.status = 'pending' then 0 else 1 end,
           payment.occurred_at desc
  limit 1;

  select coalesce(jsonb_agg(jsonb_build_object(
    'ticket_id', ticket.id,
    'ticket_code', ticket.ticket_code,
    'site_id', ticket.site_id,
    'valid_on', ticket.valid_on,
    'entries_allowed', ticket.entries_allowed,
    'entries_used', ticket.entries_used,
    'guest_group', ticket.product,
    'status', ticket.status
  ) order by ticket.site_id, ticket.product), '[]'::jsonb)
  into v_tickets
  from public.customer_order_tickets bridge
  join public.erp_tickets ticket on ticket.id = bridge.ticket_id
  where bridge.order_id = v_order.id and bridge.tenant_id = p_tenant_id;

  insert into public.customer_ticket_lookup_attempts (
    tenant_id, order_code_digest, identity_type, identity_digest, outcome, occurred_at
  ) values (
    p_tenant_id, v_code_digest, v_identity_type, v_identity_digest, 'matched', p_occurred_at
  );

  return query select
    true, false, v_order.order_code, v_order.product_id, v_order.visit_date,
    v_order.party_size, v_order.adults, v_order.children, v_order.total_vnd,
    v_order.currency, v_order.status, v_payment.mode, v_payment.status,
    case when v_payment.status = 'pending' then v_payment.amount_vnd else 0 end,
    v_tickets;
end;
$$;

revoke all on function public.customer_lookup_order_tickets(
  uuid, text, text, text, timestamptz
) from public, anon, authenticated;
grant execute on function public.customer_lookup_order_tickets(
  uuid, text, text, text, timestamptz
) to service_role;

commit;
