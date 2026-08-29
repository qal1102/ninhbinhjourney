-- TC-02 lượt 1: nhiều khung giờ cho một sản phẩm, và khách chọn đúng khung.
--
-- Hôm nay một sản phẩm chỉ giữ được **một** khung giờ tại mỗi cơ sở, vì khóa
-- chính của `customer_product_capacity_templates` là `(tenant_id, product_id,
-- site_id)`. Muốn bán 09:00 và 14:00 cùng một tour thì không có chỗ để ghi.
--
-- Và vì không có khung để chọn, `customer_create_booking_hold` **giữ hết mọi
-- khung đang bật** của sản phẩm. Với một khung thì không ai thấy sai; với hai
-- khung thì một người đặt buổi sáng cũng ăn luôn chỗ buổi chiều.
--
-- Migration này sửa đúng ba chỗ đó và **không seed một dòng dữ liệu nào**.
--
-- Ba điều KHÔNG làm, để khỏi ai đọc nhầm:
--
-- 1. Không đụng tới `hourly_capacity` hay `effective_capacity` — TC-01 vừa
--    khóa chúng lại, và số chỗ hiển thị cho khách vẫn là `effective_capacity`.
-- 2. Không cho khách chọn giờ khác nhau ở hai cơ sở trong cùng một gói. Gói
--    nhiều chặng là việc của TC-03; ở đây một khung giờ áp cho mọi cơ sở của
--    gói, đúng như hành vi hiện tại.
-- 3. Không tự tạo `customer_booking_slots`. Hàng slot vẫn chỉ sinh ra lúc có
--    người thật giữ chỗ, y như trước.
--
-- **Bẫy đã biết:** `202608210048` dùng `on conflict (tenant_id, product_id,
-- site_id)` — đúng khóa chính cũ. Sau migration này chỉ mục đó không còn, nên
-- tệp ấy **không chạy lại được**. Nó đã áp dụng xong và Supabase không chạy
-- lại migration cũ, nên không hỏng gì; nhưng đừng chép lại câu `on conflict`
-- đó cho lần seed sau. Câu đúng bây giờ phải kèm `local_start_time`.

begin;

-- 1. Một sản phẩm, một cơ sở, NHIỀU khung giờ.
--
-- Nới khóa chính là thao tác an toàn với dữ liệu đang có: mọi hàng cũ vẫn duy
-- nhất theo bộ khóa rộng hơn. Khóa ngoại `(product_id, site_id)` giữ nguyên,
-- nên một khung giờ vẫn không thể trỏ tới cặp sản phẩm–cơ sở không tồn tại.
alter table public.customer_product_capacity_templates
  drop constraint if exists customer_product_capacity_templates_pkey;

alter table public.customer_product_capacity_templates
  add constraint customer_product_capacity_templates_pkey
  primary key (tenant_id, product_id, site_id, local_start_time);

-- 2. `source_kind` đang khóa cứng đúng một giá trị.
--
-- `check (source_kind = 'catalog-staged')` nghĩa là mỗi lần lịch bán được ai
-- đó duyệt thì lại phải thêm một migration mới chỉ để nới một chuỗi. Thêm
-- 'customer-approved' để ghi được lịch đã duyệt mà không cần vậy nữa.
alter table public.customer_product_capacity_templates
  drop constraint if exists customer_product_capacity_templates_source_kind_check;

alter table public.customer_product_capacity_templates
  add constraint customer_product_capacity_templates_source_kind_check
  check (source_kind in ('catalog-staged', 'customer-approved'));

-- 3. Dấu vân tay của một yêu cầu phải tính cả khung giờ.
--
-- Nếu không, hai yêu cầu "cùng sản phẩm, cùng ngày, cùng số khách" nhưng khác
-- khung giờ sẽ có cùng dấu vân tay. Hậu quả cụ thể: khách giữ chỗ 09:00 rồi
-- đổi ý sang 14:00, hàm sẽ coi đó là **lặp yêu cầu cũ** và trả về đúng phiếu
-- giữ chỗ 09:00 — im lặng, không báo lỗi, và khách tin là mình đã đổi được.
--
-- Thêm tham số bằng `create or replace` chỉ tạo ra một hàm nạp chồng thứ hai;
-- phải bỏ hàm cũ đi một cách tường minh. Đây đúng là chỗ đã sập một lần ở
-- TC-01 với `erp_capacity_update_threshold`.
drop function if exists public.customer_booking_payload_digest(uuid, date, integer);

create or replace function public.customer_booking_payload_digest(
  p_product_id uuid,
  p_visit_date date,
  p_party_size integer,
  p_slot_starts_at timestamptz default null
)
returns text
language sql
immutable
security invoker
set search_path = ''
as $$
  select encode(
    extensions.digest(
      p_product_id::text || ':' || p_visit_date::text || ':' || p_party_size::text
        || ':' || coalesce(p_slot_starts_at::text, 'moi-khung'),
      'sha256'
    ),
    'hex'
  );
$$;

-- 4. Hàm giữ chỗ nhận thêm khung giờ.
--
-- Cùng lý do nạp chồng như trên: bỏ chữ ký 7 tham số cũ trước đã.
drop function if exists public.customer_create_booking_hold(
  uuid, uuid, uuid, uuid, date, integer, timestamptz
);

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
        or (p_visit_date + template.local_start_time) at time zone 'Asia/Ho_Chi_Minh' = p_slot_starts_at
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
-- 5. RPC chỉ đọc: các khung giờ của một sản phẩm trong một ngày, kèm số chỗ còn lại.
--
-- Đây là thứ màn hình chọn giờ cần, và cố ý **không tạo, không sửa, không
-- khóa** bất cứ hàng nào — gọi bao nhiêu lần cũng không để lại dấu vết.
--
-- Số chỗ lấy từ `effective_capacity` của ngưỡng nhỏ nhất còn hiệu lực tại cơ
-- sở đó, **đúng ngưỡng mà `customer_create_booking_hold` sẽ chọn**. Cố ý không
-- đọc `capacity_snapshot` của hàng slot đã có: hàm giữ chỗ luôn làm mới ảnh
-- chụp đó theo ngưỡng hiện tại, nên đọc ngưỡng mới là con số khách sẽ thực sự
-- gặp. Đọc ảnh chụp cũ sẽ hứa một số rồi bán theo số khác.
--
-- `remaining` chặn dưới ở 0: nếu giám đốc vừa hạ ngưỡng xuống dưới số đã giữ,
-- con số đúng là "hết chỗ", không phải một số âm.
create or replace function public.customer_list_product_slots(
  p_tenant_id uuid,
  p_product_id uuid,
  p_visit_date date
)
returns table (
  site_id uuid,
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
  order by moc.starts_at, template.site_id;
$$;

revoke all on function public.customer_booking_payload_digest(
  uuid, date, integer, timestamptz
) from public, anon, authenticated;
grant execute on function public.customer_booking_payload_digest(
  uuid, date, integer, timestamptz
) to service_role;

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
