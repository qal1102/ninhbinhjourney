-- TC-01: công suất nhiều điểm nghẽn + hệ số an toàn.
--
-- Khách hàng yêu cầu công suất mỗi khung giờ là **MIN của mọi điểm nghẽn**, chứ
-- không phải một con số duy nhất cho cả cơ sở. Logic MIN đó **đã chạy sẵn** từ
-- `202608200043` — nó đã `order by ... asc limit 1` để lấy ngưỡng nhỏ nhất.
-- Cái thiếu nằm ở ba chỗ khác, và migration này vá đúng ba chỗ đó.
--
-- 1. `bottleneck_kind` chỉ nhận 3 giá trị, trong khi khách liệt kê khoảng 10.
-- 2. Công thức vòng quay `xe × chỗ × 60 ÷ phút` **không hợp** với bãi đỗ (số chỗ
--    tĩnh), khu vực chờ (sức chứa đứng) hay tổ cứu hộ (số người trực). Nhồi ba
--    thứ đó vào công thức vòng quay là bịa số. Vì thế có `capacity_model`.
-- 3. Không có hệ số an toàn.
--
-- **Không đổi ý nghĩa `hourly_capacity`.** Cột đó là năng lực vòng quay thuần
-- tuý và `/erp/release` cùng màn hình T11a đang đọc nó. Thêm `effective_capacity`
-- là cột thứ hai, tính từ đúng nhánh mô hình rồi nhân hệ số an toàn.
--
-- **Bất biến quan trọng nhất của migration này:** với mọi hàng đang có,
-- `capacity_model = 'round-trip'` và `safety_factor = 1.000`, nên
-- `effective_capacity = hourly_capacity`. Việc chuyển `customer_create_booking_hold`
-- sang đọc `effective_capacity` do đó **không đổi một con số nào hôm nay**. Bài
-- kiểm tra hợp đồng khẳng định đúng bất biến này.

begin;

-- Nới loại điểm nghẽn. Giữ nguyên 3 giá trị cũ: 4 hàng seed đang dùng
-- 'boat-pier' và 'electric-shuttle', bỏ đi là gãy dữ liệu thật.
alter table public.erp_capacity_thresholds
  drop constraint if exists erp_capacity_thresholds_bottleneck_kind_check;

alter table public.erp_capacity_thresholds
  add constraint erp_capacity_thresholds_bottleneck_kind_check
  check (bottleneck_kind in (
    'boat-pier', 'ticket-gate', 'electric-shuttle',
    'parking', 'waiting-area', 'cave-channel', 'drop-off', 'rescue', 'boat-crew'
  ));

alter table public.erp_capacity_thresholds
  add column if not exists capacity_model text not null default 'round-trip';

alter table public.erp_capacity_thresholds
  drop constraint if exists erp_capacity_thresholds_capacity_model_check;
alter table public.erp_capacity_thresholds
  add constraint erp_capacity_thresholds_capacity_model_check
  check (capacity_model in ('round-trip', 'static'));

alter table public.erp_capacity_thresholds
  add column if not exists static_capacity integer;

alter table public.erp_capacity_thresholds
  drop constraint if exists erp_capacity_thresholds_static_capacity_check;
alter table public.erp_capacity_thresholds
  add constraint erp_capacity_thresholds_static_capacity_check
  check (static_capacity is null or static_capacity between 1 and 100000);

-- Mô hình tĩnh mà không có số chỗ thì không tính được gì. Ép ở cơ sở dữ liệu,
-- không ép ở TypeScript.
alter table public.erp_capacity_thresholds
  drop constraint if exists erp_capacity_thresholds_static_requires_capacity;
alter table public.erp_capacity_thresholds
  add constraint erp_capacity_thresholds_static_requires_capacity
  check (capacity_model <> 'static' or static_capacity is not null);

-- Hệ số an toàn chỉ được phép **hạ** công suất, không bao giờ nâng: khoảng
-- (0, 1]. Mặc định 1.000 để hàng cũ giữ nguyên hành vi; giám đốc tự đặt.
alter table public.erp_capacity_thresholds
  add column if not exists safety_factor numeric(4,3) not null default 1.000;

alter table public.erp_capacity_thresholds
  drop constraint if exists erp_capacity_thresholds_safety_factor_check;
alter table public.erp_capacity_thresholds
  add constraint erp_capacity_thresholds_safety_factor_check
  check (safety_factor > 0 and safety_factor <= 1);

alter table public.erp_capacity_thresholds
  add column if not exists effective_capacity integer generated always as (
    floor(
      (case when capacity_model = 'static'
            then coalesce(static_capacity, 0)::numeric
            else (vehicle_count::numeric * seats_per_vehicle::numeric * 60::numeric)
                 / round_trip_minutes
       end) * safety_factor
    )::integer
  ) stored;

create index if not exists erp_capacity_thresholds_effective_idx
  on public.erp_capacity_thresholds(tenant_id, site_id, effective_capacity);

-- Nhật ký ngưỡng mới chỉ nhận hai hành động: 'threshold.seeded' và
-- 'threshold.updated'. Bảng này bất biến (có trigger chặn update/delete), nên
-- một hành động chưa khai báo không hỏng âm thầm — nó làm **cả lời gọi tạo
-- ngưỡng thất bại**. Bắt được đúng như vậy ở lượt chạy thử trên PostgreSQL
-- thật: đọc chuỗi SQL không thấy, vì lỗi nằm ở một bảng khác bảng đang sửa.
alter table public.erp_capacity_audit_events
  drop constraint if exists erp_capacity_audit_events_action_check;
alter table public.erp_capacity_audit_events
  add constraint erp_capacity_audit_events_action_check
  check (action in ('threshold.seeded', 'threshold.updated', 'threshold.created'));

-- RPC sửa ngưỡng: thêm ba tham số mới, **mặc định NULL nghĩa là "giữ nguyên"**.
--
-- `create or replace` khớp theo (tên + kiểu tham số), nên thêm tham số sẽ tạo ra
-- một hàm **thứ hai** chứ không thay hàm cũ — hai bản cùng tồn tại đúng là loại
-- bẫy hai nguồn sự thật. Vì thế phải `drop` bản 10 tham số một cách tường minh.
-- Bản mới có mặc định nên lời gọi 10 tham số cũ vẫn chạy nguyên vẹn.
drop function if exists public.erp_capacity_update_threshold(
  uuid, uuid, text, text, integer, integer, integer, numeric, text, text
);

create or replace function public.erp_capacity_update_threshold(
  p_tenant_id uuid,
  p_threshold_id uuid,
  p_actor_account_id text,
  p_actor_display_name text,
  p_expected_version integer,
  p_vehicle_count integer,
  p_seats_per_vehicle integer,
  p_round_trip_minutes numeric,
  p_source_kind text,
  p_source_note text,
  p_capacity_model text default null,
  p_static_capacity integer default null,
  p_safety_factor numeric default null
)
returns public.erp_capacity_thresholds
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before public.erp_capacity_thresholds;
  v_after public.erp_capacity_thresholds;
  v_actor text := trim(coalesce(p_actor_account_id, ''));
  v_actor_name text := trim(coalesce(p_actor_display_name, ''));
  v_model text;
  v_static integer;
  v_safety numeric;
begin
  select * into v_before
  from public.erp_capacity_thresholds threshold
  where threshold.id = p_threshold_id
    and threshold.tenant_id = p_tenant_id
  for update;

  if v_before.id is null then
    raise exception using errcode = 'P0002', message = 'CAPACITY_THRESHOLD_NOT_FOUND';
  end if;

  if not public.erp_account_has_active_role(
    p_tenant_id,
    v_actor,
    'director',
    v_before.site_id
  ) then
    raise exception using errcode = '42501', message = 'CAPACITY_DIRECTOR_REQUIRED';
  end if;

  if v_before.version <> p_expected_version then
    raise exception using errcode = '40001', message = 'CAPACITY_VERSION_CONFLICT';
  end if;

  v_model := coalesce(p_capacity_model, v_before.capacity_model);
  v_safety := coalesce(p_safety_factor, v_before.safety_factor);
  -- Mô hình tĩnh thì số chỗ tĩnh là bắt buộc; mô hình vòng quay thì phải xoá nó
  -- đi, nếu không hàng dữ liệu mang theo một con số không ai đọc tới.
  v_static := case when v_model = 'static'
                   then coalesce(p_static_capacity, v_before.static_capacity)
                   else null end;

  if char_length(v_actor_name) not between 2 and 200
     or p_vehicle_count not between 1 and 10000
     or p_seats_per_vehicle not between 1 and 500
     or p_round_trip_minutes not between 1 and 1440
     or p_source_kind not in ('estimate', 'customer', 'measured')
     or char_length(trim(coalesce(p_source_note, ''))) not between 8 and 1000
     or v_model not in ('round-trip', 'static')
     or v_safety is null or v_safety <= 0 or v_safety > 1
     or (v_model = 'static' and (v_static is null or v_static not between 1 and 100000)) then
    raise exception using errcode = '22023', message = 'CAPACITY_INPUT_INVALID';
  end if;

  update public.erp_capacity_thresholds set
    vehicle_count = p_vehicle_count,
    seats_per_vehicle = p_seats_per_vehicle,
    round_trip_minutes = p_round_trip_minutes,
    capacity_model = v_model,
    static_capacity = v_static,
    safety_factor = v_safety,
    source_kind = p_source_kind,
    source_note = trim(p_source_note),
    version = version + 1,
    updated_by_account_id = v_actor,
    updated_by_display_name = v_actor_name,
    updated_at = now()
  where id = v_before.id
  returning * into v_after;

  insert into public.erp_capacity_audit_events (
    tenant_id, site_id, threshold_id, action,
    actor_account_id, actor_display_name, detail
  ) values (
    p_tenant_id, v_after.site_id, v_after.id, 'threshold.updated',
    v_actor, v_actor_name,
    jsonb_build_object(
      'before', jsonb_build_object(
        'vehicle_count', v_before.vehicle_count,
        'seats_per_vehicle', v_before.seats_per_vehicle,
        'round_trip_minutes', v_before.round_trip_minutes,
        'hourly_capacity', v_before.hourly_capacity,
        'capacity_model', v_before.capacity_model,
        'static_capacity', v_before.static_capacity,
        'safety_factor', v_before.safety_factor,
        'effective_capacity', v_before.effective_capacity,
        'source_kind', v_before.source_kind,
        'source_note', v_before.source_note,
        'version', v_before.version
      ),
      'after', jsonb_build_object(
        'vehicle_count', v_after.vehicle_count,
        'seats_per_vehicle', v_after.seats_per_vehicle,
        'round_trip_minutes', v_after.round_trip_minutes,
        'hourly_capacity', v_after.hourly_capacity,
        'capacity_model', v_after.capacity_model,
        'static_capacity', v_after.static_capacity,
        'safety_factor', v_after.safety_factor,
        'effective_capacity', v_after.effective_capacity,
        'source_kind', v_after.source_kind,
        'source_note', v_after.source_note,
        'version', v_after.version
      )
    )
  );

  return v_after;
end;
$$;

-- RPC tạo ngưỡng mới.
--
-- **Trước migration này sản phẩm không có đường nào tạo ngưỡng** — chỉ có RPC
-- sửa. Nên bốn hàng seed (đúng một ngưỡng mỗi cơ sở) là tất cả những gì từng
-- tồn tại, và "MIN của nhiều điểm nghẽn" thực chất chạy trên một tập một phần
-- tử. Không có hàm này thì việc nới `bottleneck_kind` ở trên vô nghĩa.
--
-- QĐ-02 cấm seed ngưỡng bằng migration: số công suất thật phải do người vận
-- hành nhập qua màn hình T11a kèm nguồn và ghi chú. Vì thế đây là hàm tạo, và
-- migration này **không chèn một hàng dữ liệu nào**.
create or replace function public.erp_capacity_create_threshold(
  p_tenant_id uuid,
  p_site_id uuid,
  p_actor_account_id text,
  p_actor_display_name text,
  p_threshold_code text,
  p_bottleneck_name text,
  p_bottleneck_kind text,
  p_capacity_model text,
  p_vehicle_count integer,
  p_seats_per_vehicle integer,
  p_round_trip_minutes numeric,
  p_static_capacity integer,
  p_safety_factor numeric,
  p_source_kind text,
  p_source_note text
)
returns public.erp_capacity_thresholds
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_after public.erp_capacity_thresholds;
  v_actor text := trim(coalesce(p_actor_account_id, ''));
  v_actor_name text := trim(coalesce(p_actor_display_name, ''));
  v_code text := upper(trim(coalesce(p_threshold_code, '')));
  v_safety numeric := coalesce(p_safety_factor, 1.000);
  v_static integer := case when p_capacity_model = 'static' then p_static_capacity else null end;
begin
  if not public.erp_account_has_active_role(
    p_tenant_id, v_actor, 'director', p_site_id
  ) then
    raise exception using errcode = '42501', message = 'CAPACITY_DIRECTOR_REQUIRED';
  end if;

  if char_length(v_actor_name) not between 2 and 200
     or char_length(v_code) not between 4 and 40
     or char_length(trim(coalesce(p_bottleneck_name, ''))) not between 3 and 160
     or p_bottleneck_kind not in (
          'boat-pier', 'ticket-gate', 'electric-shuttle',
          'parking', 'waiting-area', 'cave-channel', 'drop-off', 'rescue', 'boat-crew')
     or p_capacity_model not in ('round-trip', 'static')
     or p_vehicle_count not between 1 and 10000
     or p_seats_per_vehicle not between 1 and 500
     or p_round_trip_minutes not between 1 and 1440
     or v_safety <= 0 or v_safety > 1
     or p_source_kind not in ('estimate', 'customer', 'measured')
     or char_length(trim(coalesce(p_source_note, ''))) not between 8 and 1000
     or (p_capacity_model = 'static'
         and (v_static is null or v_static not between 1 and 100000)) then
    raise exception using errcode = '22023', message = 'CAPACITY_INPUT_INVALID';
  end if;

  -- Mã ngưỡng trùng thì dừng hẳn, không im lặng ghi đè cấu hình của người khác.
  -- Bảng đã có `unique (tenant_id, threshold_code)`; bắt trước để trả về một mã
  -- lỗi đọc được thay vì lỗi ràng buộc thô.
  if exists (
    select 1 from public.erp_capacity_thresholds threshold
    where threshold.tenant_id = p_tenant_id
      and threshold.threshold_code = v_code
  ) then
    raise exception using errcode = '23505', message = 'CAPACITY_THRESHOLD_CODE_TAKEN';
  end if;

  insert into public.erp_capacity_thresholds (
    tenant_id, site_id, threshold_code, bottleneck_name, bottleneck_kind,
    capacity_model, vehicle_count, seats_per_vehicle, round_trip_minutes,
    static_capacity, safety_factor, source_kind, source_note,
    updated_by_account_id, updated_by_display_name
  ) values (
    p_tenant_id, p_site_id, v_code, trim(p_bottleneck_name), p_bottleneck_kind,
    p_capacity_model, p_vehicle_count, p_seats_per_vehicle, p_round_trip_minutes,
    v_static, v_safety, p_source_kind, trim(p_source_note),
    v_actor, v_actor_name
  )
  returning * into v_after;

  insert into public.erp_capacity_audit_events (
    tenant_id, site_id, threshold_id, action,
    actor_account_id, actor_display_name, detail
  ) values (
    p_tenant_id, v_after.site_id, v_after.id, 'threshold.created',
    v_actor, v_actor_name,
    jsonb_build_object(
      'after', jsonb_build_object(
        'threshold_code', v_after.threshold_code,
        'bottleneck_name', v_after.bottleneck_name,
        'bottleneck_kind', v_after.bottleneck_kind,
        'capacity_model', v_after.capacity_model,
        'vehicle_count', v_after.vehicle_count,
        'seats_per_vehicle', v_after.seats_per_vehicle,
        'round_trip_minutes', v_after.round_trip_minutes,
        'static_capacity', v_after.static_capacity,
        'safety_factor', v_after.safety_factor,
        'hourly_capacity', v_after.hourly_capacity,
        'effective_capacity', v_after.effective_capacity,
        'source_kind', v_after.source_kind,
        'source_note', v_after.source_note,
        'version', v_after.version
      )
    )
  );

  return v_after;
end;
$$;


-- Chuyển đường giữ chỗ của khách sang đọc `effective_capacity`.
--
-- Thân hàm dưới đây là **bản sao nguyên văn** của `customer_create_booking_hold`
-- trong `202608200043`, chỉ khác **đúng bốn dòng**: mọi tham chiếu
-- `hourly_capacity` đổi thành `effective_capacity` (một ở mệnh đề `order by`
-- chọn điểm nghẽn nhỏ nhất, một ở `insert` chụp công suất, hai ở nhánh làm
-- mới ảnh chụp khi ngưỡng đã đổi phiên bản). Bốn dòng đó được thay bằng `sed`
-- rồi đối chiếu `diff`, không chép tay — 273 dòng chép tay là 273 cơ hội sai.
--
-- Vì mọi hàng hiện có đều `round-trip` và `safety_factor = 1.000`, hai cột
-- bằng nhau từng hàng, nên thay đổi này **không dịch chuyển một con số nào**
-- hôm nay. Nó chỉ mở đường để hệ số an toàn có tác dụng thật khi giám đốc đặt.
--
-- Không tách bước được: nếu màn hình T11a cho đặt hệ số mà đường giữ chỗ vẫn
-- đọc `hourly_capacity` thì hai nơi hiểu công suất theo hai kiểu — đúng bẫy
-- hai nguồn sự thật.
create or replace function public.customer_create_booking_hold(
  p_tenant_id uuid,
  p_request_id uuid,
  p_anonymous_id uuid,
  p_product_id uuid,
  p_visit_date date,
  p_party_size integer,
  p_occurred_at timestamptz
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
    p_product_id, p_visit_date, p_party_size
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

revoke all on function public.erp_capacity_update_threshold(
  uuid, uuid, text, text, integer, integer, integer, numeric, text, text,
  text, integer, numeric
) from public, anon, authenticated;
grant execute on function public.erp_capacity_update_threshold(
  uuid, uuid, text, text, integer, integer, integer, numeric, text, text,
  text, integer, numeric
) to service_role;

revoke all on function public.erp_capacity_create_threshold(
  uuid, uuid, text, text, text, text, text, text, integer, integer,
  numeric, integer, numeric, text, text
) from public, anon, authenticated;
grant execute on function public.erp_capacity_create_threshold(
  uuid, uuid, text, text, text, text, text, text, integer, integer,
  numeric, integer, numeric, text, text
) to service_role;

commit;
