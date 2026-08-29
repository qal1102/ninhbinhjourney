-- TC-02 vá gấp: một chuyến có nhiều chặng thì khách chọn GIỜ KHỞI HÀNH,
-- không phải chọn từng chặng.
--
-- Lỗi do chính `202608290050` gây ra, phát hiện ngày 29/08 khi rà lịch bán thật.
--
-- Gói "Gia đình khám phá" đi hai nơi trong một ngày: Tràng An 08:00 rồi Bái
-- Đính 13:30. Trước TC-02, hàm giữ chỗ duyệt mọi lịch bán đang bật nên giữ cả
-- hai chặng. Sau TC-02, khách chọn "08:00" thì bộ lọc chỉ khớp đúng dòng Tràng
-- An — **chặng Bái Đính không được giữ chỗ một lần nào**. Khách trả tiền một
-- chuyến hai nơi và chỉ có chỗ ở một nơi.
--
-- Tệ hơn nữa là màn hình: hai chặng của **cùng một chuyến** hiện ra thành hai
-- "khung giờ" để khách chọn một. Đó không phải hai lựa chọn, đó là một hành
-- trình bị cắt đôi.
--
-- Đã đo trên production trước khi vá: `GET /api/customer-booking-slots` cho
-- gói này trả về đúng hai khung rời nhau, mỗi khung một cơ sở.
--
-- Cách vá: thêm `departure_time` — chuyến khởi hành lúc mấy giờ. Mọi chặng
-- của cùng một chuyến mang cùng `departure_time`, còn `local_start_time` vẫn
-- là giờ riêng của từng chặng. Khách chọn chuyến; hệ thống giữ đủ mọi chặng.
--
-- Không seed một dòng dữ liệu nào. Lịch bán là việc của người vận hành.

begin;

-- 1. Thêm cột, lấp dữ liệu cũ, rồi mới siết `not null`.
--    Mỗi sản phẩm hiện có đúng một chuyến, nên giờ khởi hành của nó chính là
--    giờ của chặng sớm nhất.
alter table public.customer_product_capacity_templates
  add column if not exists departure_time time;

update public.customer_product_capacity_templates as target
set departure_time = som_nhat.gio
from (
  select tenant_id, product_id, min(local_start_time) as gio
  from public.customer_product_capacity_templates
  group by tenant_id, product_id
) as som_nhat
where target.tenant_id = som_nhat.tenant_id
  and target.product_id = som_nhat.product_id
  and target.departure_time is null;

alter table public.customer_product_capacity_templates
  alter column departure_time set not null;

-- Một chuyến không thể ghé cùng một cơ sở hai lần. Ràng buộc này là thứ chặn
-- việc lỡ tay tạo hai chặng trùng cơ sở trong một chuyến.
create unique index if not exists customer_product_capacity_templates_wave_idx
  on public.customer_product_capacity_templates
  (tenant_id, product_id, departure_time, site_id);

-- Chặng không thể khởi hành trước cả chuyến.
alter table public.customer_product_capacity_templates
  drop constraint if exists customer_product_capacity_templates_departure_check;
alter table public.customer_product_capacity_templates
  add constraint customer_product_capacity_templates_departure_check
  check (local_start_time >= departure_time);

-- 2. Hàm giữ chỗ lọc theo GIỜ KHỞI HÀNH của chuyến, không theo giờ của chặng.
--    Đây là đúng một dòng khác so với `202608290050`; phần còn lại giữ nguyên.
create or replace function public.customer_create_booking_hold(
  p_tenant_id uuid,
  p_request_id uuid,
  p_anonymous_id uuid,
  p_product_id uuid,
  p_visit_date date,
  p_party_size integer,
  p_occurred_at timestamptz,
  p_slot_starts_at timestamptz default null
)
returns table (
  order_id uuid,
  order_code text,
  hold_id uuid,
  hold_status text,
  expires_at timestamptz,
  total_vnd integer,
  currency text,
  slots jsonb,
  inserted boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_source_profile_id uuid;
  v_profile_id uuid;
  v_product public.products;
  v_existing_hold public.customer_booking_holds;
  v_existing_order public.customer_orders;
  v_order public.customer_orders;
  v_hold public.customer_booking_holds;
  v_template public.customer_product_capacity_templates;
  v_threshold public.erp_capacity_thresholds;
  v_slot public.customer_booking_slots;
  v_starts_at timestamptz;
  v_ends_at timestamptz;
  v_reserved integer;
  v_template_count integer := 0;
  v_payload_digest text;
  v_slots jsonb;
begin
  if p_tenant_id is null or p_request_id is null or p_anonymous_id is null
     or p_product_id is null or p_visit_date is null
     or p_party_size not between 1 and 20 or p_occurred_at is null
     or p_occurred_at > now() + interval '5 minutes'
     or p_visit_date < (now() at time zone 'Asia/Ho_Chi_Minh')::date
     or p_visit_date > (now() at time zone 'Asia/Ho_Chi_Minh')::date + 90 then
    raise exception using errcode = '22023', message = 'CUSTOMER_BOOKING_INPUT_INVALID';
  end if;

  -- Serialize retries before any side effect so concurrent use of one key is
  -- a replay, never a leaked unique-constraint failure.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_tenant_id::text || ':booking:' || p_request_id::text, 0)
  );

  insert into public.customer_profiles as existing (tenant_id, anonymous_id)
  values (p_tenant_id, p_anonymous_id)
  on conflict (tenant_id, anonymous_id) do update set
    updated_at = greatest(existing.updated_at, now())
  returning existing.id into v_source_profile_id;
  v_profile_id := public.customer_canonical_profile_id(p_tenant_id, v_source_profile_id);
  if v_profile_id is null then
    raise exception using errcode = 'P0002', message = 'CUSTOMER_PROFILE_NOT_FOUND';
  end if;

  v_payload_digest := public.customer_booking_payload_digest(
    p_product_id, p_visit_date, p_party_size, p_slot_starts_at
  );
  select hold.* into v_existing_hold
  from public.customer_booking_holds hold
  where hold.tenant_id = p_tenant_id and hold.idempotency_key = p_request_id;
  if v_existing_hold.id is not null then
    if public.customer_canonical_profile_id(
         p_tenant_id, v_existing_hold.profile_id
       ) <> v_profile_id
       or v_existing_hold.payload_digest <> v_payload_digest then
      raise exception using errcode = '23505', message = 'CUSTOMER_BOOKING_ID_COLLISION';
    end if;
    select customer_order.* into v_existing_order
    from public.customer_orders customer_order
    where customer_order.id = v_existing_hold.order_id
      and customer_order.tenant_id = p_tenant_id;
    if v_existing_hold.status = 'active' and v_existing_hold.expires_at <= now() then
      update public.customer_booking_holds
      set status = 'expired'
      where id = v_existing_hold.id
      returning * into v_existing_hold;
      update public.customer_orders
      set status = 'expired', updated_at = now()
      where id = v_existing_order.id
      returning * into v_existing_order;
    end if;
    select coalesce(jsonb_agg(jsonb_build_object(
      'slot_id', slot.id,
      'site_id', slot.site_id,
      'starts_at', slot.starts_at,
      'ends_at', slot.ends_at,
      'capacity_source', slot.capacity_source_kind,
      'threshold_version', slot.threshold_version
    ) order by slot.starts_at, slot.site_id), '[]'::jsonb)
    into v_slots
    from public.customer_booking_hold_slots hold_slot
    join public.customer_booking_slots slot on slot.id = hold_slot.slot_id
    where hold_slot.hold_id = v_existing_hold.id;
    return query select
      v_existing_order.id, v_existing_order.order_code, v_existing_hold.id,
      v_existing_hold.status,
      v_existing_hold.expires_at, v_existing_order.total_vnd,
      v_existing_order.currency, v_slots, false;
    return;
  end if;

  if (
    select count(*)
    from public.customer_booking_holds hold
    where hold.tenant_id = p_tenant_id
      and hold.profile_id = v_profile_id
      and hold.created_at > now() - interval '1 hour'
  ) >= 10 then
    raise exception using errcode = '54000', message = 'CUSTOMER_BOOKING_RATE_LIMITED';
  end if;

  select product.* into v_product
  from public.products product
  where product.id = p_product_id
    and product.tenant_id = p_tenant_id
    and product.active
    and product.ledger_type = 'service-commerce';
  if v_product.id is null then
    raise exception using errcode = 'P0002', message = 'CUSTOMER_PRODUCT_UNAVAILABLE';
  end if;

  insert into public.customer_orders (
    tenant_id, profile_id, product_id, order_code, visit_date, party_size,
    unit_price_vnd, total_vnd, currency, status
  ) values (
    p_tenant_id, v_profile_id, v_product.id,
    'NBJ-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)),
    p_visit_date, p_party_size, v_product.demo_price_vnd,
    v_product.demo_price_vnd * p_party_size, 'VND', 'holding'
  ) returning * into v_order;

  insert into public.customer_order_lines (
    tenant_id, order_id, product_id, quantity, unit_price_vnd, total_vnd, ledger_type
  ) values (
    p_tenant_id, v_order.id, v_product.id, p_party_size,
    v_product.demo_price_vnd, v_product.demo_price_vnd * p_party_size,
    'service-commerce'
  );

  insert into public.customer_booking_holds (
    tenant_id, order_id, profile_id, idempotency_key, payload_digest,
    status, expires_at
  ) values (
    p_tenant_id, v_order.id, v_profile_id, p_request_id, v_payload_digest,
    'active', now() + interval '15 minutes'
  ) returning * into v_hold;

  for v_template in
    select template.*
    from public.customer_product_capacity_templates template
    where template.tenant_id = p_tenant_id
      and template.product_id = p_product_id
      and template.active
      -- Khong truyen khung gio thi giu nguyen hanh vi cu: giu moi khung dang bat.
      and (
        p_slot_starts_at is null
        -- GIO KHOI HANH cua chuyen, khong phai gio cua tung chang. Doi cho nay
        -- ve local_start_time la cat doi hanh trinh nhieu chang mot lan nua.
        or (p_visit_date + template.departure_time) at time zone 'Asia/Ho_Chi_Minh' = p_slot_starts_at
      )
    order by template.local_start_time, template.site_id
  loop
    v_template_count := v_template_count + 1;
    select threshold.* into v_threshold
    from public.erp_capacity_thresholds threshold
    where threshold.tenant_id = p_tenant_id
      and threshold.site_id = v_template.site_id
      and threshold.effective_from <= p_visit_date
    order by threshold.effective_capacity asc, threshold.effective_from desc,
      threshold.threshold_code
    limit 1
    for share;
    if v_threshold.id is null then
      raise exception using errcode = 'P0002', message = 'CUSTOMER_CAPACITY_SOURCE_MISSING';
    end if;

    v_starts_at := (p_visit_date + v_template.local_start_time)
      at time zone 'Asia/Ho_Chi_Minh';
    v_ends_at := v_starts_at + make_interval(mins => v_template.duration_minutes);
    if v_starts_at <= now() + interval '5 minutes' then
      raise exception using errcode = '22023', message = 'CUSTOMER_BOOKING_SLOT_PAST';
    end if;

    insert into public.customer_booking_slots as booking_slot (
      tenant_id, site_id, capacity_threshold_id,
      starts_at, ends_at, capacity_snapshot, threshold_version,
      capacity_source_kind, status
    ) values (
      p_tenant_id, v_template.site_id, v_threshold.id,
      v_starts_at, v_ends_at, v_threshold.effective_capacity, v_threshold.version,
      v_threshold.source_kind, 'open'
    )
    on conflict (tenant_id, site_id, starts_at) do nothing;

    select slot.* into v_slot
    from public.customer_booking_slots slot
    where slot.tenant_id = p_tenant_id
      and slot.site_id = v_template.site_id
      and slot.starts_at = v_starts_at
    for update;
    if v_slot.status <> 'open' then
      raise exception using errcode = 'P0001', message = 'CUSTOMER_BOOKING_SLOT_PAUSED';
    end if;
    if v_slot.threshold_version <> v_threshold.version
       or v_slot.capacity_threshold_id <> v_threshold.id
       or v_slot.capacity_snapshot <> v_threshold.effective_capacity then
      update public.customer_booking_slots
      set capacity_threshold_id = v_threshold.id,
          capacity_snapshot = v_threshold.effective_capacity,
          threshold_version = v_threshold.version,
          capacity_source_kind = v_threshold.source_kind,
          updated_at = now()
      where id = v_slot.id
      returning * into v_slot;
    end if;

    select coalesce(sum(hold_slot.quantity), 0)::integer into v_reserved
    from public.customer_booking_hold_slots hold_slot
    join public.customer_booking_holds hold on hold.id = hold_slot.hold_id
    where hold_slot.tenant_id = p_tenant_id
      and hold_slot.slot_id = v_slot.id
      and (
        hold.status = 'converted'
        or (hold.status = 'active' and hold.expires_at > now())
      );
    if v_reserved + p_party_size > v_slot.capacity_snapshot then
      raise exception using errcode = 'P0001', message = 'CUSTOMER_CAPACITY_UNAVAILABLE';
    end if;
    insert into public.customer_booking_hold_slots (
      tenant_id, hold_id, slot_id, quantity
    ) values (p_tenant_id, v_hold.id, v_slot.id, p_party_size);
  end loop;

  if v_template_count = 0 then
    -- Hai nguyen nhan khac han nhau, dung chung mot thong diep thi nguoi doc
    -- khong biet minh phai sua gi: san pham chua co lich ban nao, hay khach
    -- chon dung mot khung gio khong duoc mo.
    if p_slot_starts_at is not null then
      raise exception using errcode = 'P0002', message = 'CUSTOMER_BOOKING_SLOT_NOT_OFFERED';
    end if;
    raise exception using errcode = 'P0002', message = 'CUSTOMER_CAPACITY_SOURCE_MISSING';
  end if;

  insert into public.customer_commerce_audit_events (
    tenant_id, profile_id, order_id, hold_id, event_type, metadata, occurred_at
  ) values (
    p_tenant_id, v_profile_id, v_order.id, v_hold.id, 'hold-created',
    jsonb_build_object(
      'visit_date', p_visit_date,
      'party_size', p_party_size,
      'slot_count', v_template_count,
      'mode', 'simulation'
    ), p_occurred_at
  );

  select coalesce(jsonb_agg(jsonb_build_object(
    'slot_id', slot.id,
    'site_id', slot.site_id,
    'starts_at', slot.starts_at,
    'ends_at', slot.ends_at,
    'capacity_source', slot.capacity_source_kind,
    'threshold_version', slot.threshold_version
  ) order by slot.starts_at, slot.site_id), '[]'::jsonb)
  into v_slots
  from public.customer_booking_hold_slots hold_slot
  join public.customer_booking_slots slot on slot.id = hold_slot.slot_id
  where hold_slot.hold_id = v_hold.id;

  return query select
    v_order.id, v_order.order_code, v_hold.id, v_hold.status,
    v_hold.expires_at, v_order.total_vnd, v_order.currency, v_slots, true;
end;
$$;

-- 3. RPC đọc trả thêm giờ khởi hành của chuyến.
--
-- Đổi kiểu trả về thì `create or replace` không làm được, phải bỏ hàm cũ.
-- Cột mới `departure_starts_at` là thứ tầng ứng dụng gộp theo: mọi chặng của
-- cùng một chuyến chung một giá trị, nên khách chỉ thấy MỘT lựa chọn cho mỗi
-- chuyến, kèm số chỗ nhỏ nhất trong các chặng.
drop function if exists public.customer_list_product_slots(uuid, uuid, date);

create or replace function public.customer_list_product_slots(
  p_tenant_id uuid,
  p_product_id uuid,
  p_visit_date date
)
returns table (
  site_id uuid,
  departure_starts_at timestamptz,
  local_start_time time,
  starts_at timestamptz,
  ends_at timestamptz,
  effective_capacity integer,
  reserved integer,
  remaining integer,
  capacity_source_kind text,
  slot_status text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    template.site_id,
    ((p_visit_date + template.departure_time)
      at time zone 'Asia/Ho_Chi_Minh') as departure_starts_at,
    template.local_start_time,
    moc.starts_at,
    moc.starts_at + make_interval(mins => template.duration_minutes),
    threshold.effective_capacity,
    coalesce(da_giu.quantity, 0)::integer,
    greatest(threshold.effective_capacity - coalesce(da_giu.quantity, 0), 0)::integer,
    threshold.source_kind,
    coalesce(slot.status, 'open')
  from public.customer_product_capacity_templates template
  cross join lateral (
    select ((p_visit_date + template.local_start_time)
      at time zone 'Asia/Ho_Chi_Minh') as starts_at
  ) moc
  join lateral (
    select threshold_row.*
    from public.erp_capacity_thresholds threshold_row
    where threshold_row.tenant_id = template.tenant_id
      and threshold_row.site_id = template.site_id
      and threshold_row.effective_from <= p_visit_date
    order by threshold_row.effective_capacity asc,
      threshold_row.effective_from desc,
      threshold_row.threshold_code
    limit 1
  ) threshold on true
  left join public.customer_booking_slots slot
    on slot.tenant_id = template.tenant_id
    and slot.site_id = template.site_id
    and slot.starts_at = moc.starts_at
  left join lateral (
    select coalesce(sum(hold_slot.quantity), 0)::integer as quantity
    from public.customer_booking_hold_slots hold_slot
    join public.customer_booking_holds hold on hold.id = hold_slot.hold_id
    where hold_slot.tenant_id = template.tenant_id
      and hold_slot.slot_id = slot.id
      and (
        hold.status = 'converted'
        or (hold.status = 'active' and hold.expires_at > now())
      )
  ) da_giu on true
  where template.tenant_id = p_tenant_id
    and template.product_id = p_product_id
    and template.active
  order by departure_starts_at, moc.starts_at, template.site_id;
$$;

revoke all on function public.customer_create_booking_hold(
  uuid, uuid, uuid, uuid, date, integer, timestamptz, timestamptz
) from public, anon, authenticated;
grant execute on function public.customer_create_booking_hold(
  uuid, uuid, uuid, uuid, date, integer, timestamptz, timestamptz
) to service_role;

revoke all on function public.customer_list_product_slots(
  uuid, uuid, date
) from public, anon, authenticated;
grant execute on function public.customer_list_product_slots(
  uuid, uuid, date
) to service_role;

commit;
