-- Lượt giữ chỗ quá 15 phút chưa trả tiền thì xoá hẳn, mỗi phút một lần.
--
-- Chủ dự án ngày 26/09/2026: "quá 15 phút mà vẫn giữ chỗ thì hết 15 phút xoá
-- luôn nó đi, tạo đơn khác". Trước đây lượt giữ chỉ bị đánh dấu hết hạn khi
-- chính khách ấy bấm lại, nên màn Khách hàng còn sáu đơn từ 15/09 ghi "Đang
-- giữ chỗ" (một đơn 45 khách, 35.550.000 đ). Sức chứa vốn đã tính đúng; đây là
-- chuyện rác trong sổ.
--
-- Xoá gì: lượt giữ chưa thành đơn đã quá giờ, đơn đang giữ của nó, dòng đơn,
-- chỗ đã giữ theo khung giờ, và dòng nhật ký "hold-created". Không bao giờ
-- chạm đơn đã xác nhận, đơn trả tại điểm (lượt giữ đã chuyển), hay đơn có
-- bất kỳ lượt trả tiền nào.
--
-- Bốn bảng con khoá cứng "chỉ thêm" (CUSTOMER_HISTORY_IMMUTABLE). Khoá vẫn
-- đứng: nó chỉ nhả cho lệnh XOÁ, chỉ khi biến giao dịch `nbj.cho_phep_xoa` do
-- chính hàm dọn đặt, và chỉ khi dòng ấy thuộc đúng một lượt giữ quá hạn chưa
-- thành đơn. Biến giao dịch không đặt được từ PostgREST.
--
-- Luật "ba lượt giữ bỏ dở trong bảy ngày thì tới quầy" (089) đếm trên sổ hẹn
-- trả QR. Sổ ấy nay không khoá ngoại sang lượt giữ nữa (lượt giữ bị xoá mà sổ
-- còn), và "bỏ dở" là hẹn đã quá giờ mà không có lượt giữ nào thành đơn.
-- Khách vẫn đặt lại ngay bằng đúng số ấy cho tới khi chạm trần ba lần.

begin;

-- 1. Khoá "chỉ thêm" nhả đúng hai khe hẹp. (Khe 'lich-su-mau' dùng ở 092.)
create or replace function public.customer_append_only()
returns trigger
language plpgsql
security definer
set search_path = ''
as $ham$
declare
  v_hang jsonb;
  v_giu uuid;
  v_don uuid;
  v_khe text := coalesce(current_setting('nbj.cho_phep_xoa', true), '');
begin
  -- Hai nhánh tách hẳn: PostgreSQL không hứa dừng sớm ở "a and exists(...)",
  -- nên câu dò lượt giữ chỉ được chạy khi đúng khe giữ quá hạn.
  if tg_op = 'DELETE' and v_khe = 'giu-qua-han' then
    v_hang := to_jsonb(old);
    v_giu := nullif(v_hang ->> 'hold_id', '')::uuid;
    v_don := nullif(v_hang ->> 'order_id', '')::uuid;
    if v_giu is null and v_don is not null then
      select hold.id into v_giu from public.customer_booking_holds hold where hold.order_id = v_don;
    end if;
    if exists (
      select 1
      from public.customer_booking_holds hold
      join public.customer_orders customer_order on customer_order.id = hold.order_id
      where hold.id = v_giu
        and hold.status in ('active', 'expired')
        and hold.converted_at is null
        and hold.expires_at <= now()
        and customer_order.status in ('holding', 'expired')
        and not exists (
          select 1 from public.customer_payment_attempts payment
          where payment.order_id = customer_order.id
        )
    ) then
      return old;
    end if;
  elsif tg_op = 'DELETE' and v_khe = 'lich-su-mau' then
    v_hang := to_jsonb(old);
    if coalesce(v_hang ->> 'id', '') like 'de000000%'
       or coalesce(v_hang ->> 'order_id', '') like 'de000000%'
       or coalesce(v_hang ->> 'hold_id', '') like 'de000000%' then
      return old;
    end if;
  end if;
  raise exception using errcode = '42501', message = 'CUSTOMER_HISTORY_IMMUTABLE';
end;
$ham$;

revoke all on function public.customer_append_only() from public, anon, authenticated;

-- 2. Sổ hẹn trả QR đứng riêng, không khoá ngoại sang lượt giữ.
alter table public.customer_qr_payment_intents
  drop constraint if exists customer_qr_payment_intents_hold_id_tenant_id_fkey;

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
    where intent.tenant_id = p_tenant_id
      and intent.identity_digest = v_digest
      and intent.created_at > now() - interval '7 days'
      and intent.expires_at <= now()
      -- Lượt giữ bỏ dở bị xoá sau 15 phút (090), nên "không thành đơn" nghĩa
      -- là không còn lượt giữ nào đã chuyển thành đơn mang mã ấy.
      and not exists (
        select 1 from public.customer_booking_holds hold
        where hold.id = intent.hold_id and hold.tenant_id = intent.tenant_id
          and hold.status = 'converted'
      );
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

-- 3. Hàm dọn.
create or replace function public.customer_booking_expire_lapsed_holds()
returns integer
language plpgsql
security definer
set search_path = ''
as $ham$
declare
  v_so integer;
begin
  create temporary table if not exists pg_temp.nbj_giu_qua_han (hold_id uuid, order_id uuid) on commit drop;
  delete from pg_temp.nbj_giu_qua_han;
  insert into pg_temp.nbj_giu_qua_han (hold_id, order_id)
  select hold.id, hold.order_id
  from public.customer_booking_holds hold
  join public.customer_orders customer_order on customer_order.id = hold.order_id
  where hold.status in ('active', 'expired')
    and hold.converted_at is null
    and hold.expires_at <= now()
    and customer_order.status in ('holding', 'expired')
    and not exists (
      select 1 from public.customer_payment_attempts payment
      where payment.order_id = customer_order.id
    )
    -- Đơn đã có phiếu đoàn thì để người thật xử lý; xoá sẽ vướng khoá ngoại
    -- và làm hỏng cả lượt dọn mỗi phút.
    and not exists (
      select 1 from public.erp_visitor_groups visitor_group
      where visitor_group.order_id = customer_order.id
    );
  select count(*) into v_so from pg_temp.nbj_giu_qua_han;
  if v_so = 0 then
    return 0;
  end if;

  perform set_config('nbj.cho_phep_xoa', 'giu-qua-han', true);
  delete from public.customer_commerce_audit_events event
  using pg_temp.nbj_giu_qua_han lapsed
  where event.order_id = lapsed.order_id or event.hold_id = lapsed.hold_id;
  delete from public.customer_booking_hold_slots hold_slot
  using pg_temp.nbj_giu_qua_han lapsed
  where hold_slot.hold_id = lapsed.hold_id;
  delete from public.customer_order_lines line
  using pg_temp.nbj_giu_qua_han lapsed
  where line.order_id = lapsed.order_id;
  delete from public.customer_booking_holds hold
  using pg_temp.nbj_giu_qua_han lapsed
  where hold.id = lapsed.hold_id;
  delete from public.customer_orders customer_order
  using pg_temp.nbj_giu_qua_han lapsed
  where customer_order.id = lapsed.order_id;
  perform set_config('nbj.cho_phep_xoa', '', true);
  return v_so;
end;
$ham$;

revoke all on function public.customer_booking_expire_lapsed_holds() from public, anon, authenticated, service_role;
grant execute on function public.customer_booking_expire_lapsed_holds() to service_role;

-- Dọn luôn phần tồn từ trước tới giờ.
select public.customer_booking_expire_lapsed_holds();

do $$
declare
  v_job record;
begin
  for v_job in select jobid from cron.job where jobname = 'customer-booking-expire-lapsed-holds' loop
    perform cron.unschedule(v_job.jobid);
  end loop;
end;
$$;

select cron.schedule(
  'customer-booking-expire-lapsed-holds',
  '* * * * *',
  $cron$select public.customer_booking_expire_lapsed_holds();$cron$
);

commit;
