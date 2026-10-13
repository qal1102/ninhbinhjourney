-- Giá vé một nguồn: web và quầy cùng một bảng giá (13/10/2026).
--
-- Chủ dự án: "giá vé ở ngoài và trong phải đồng nhất". Trước migration này
-- có ba nguồn giá không dính gì nhau: bảng giá quầy `erp_counter_price_list`
-- (giám đốc sửa ở màn Giá vé quầy), cột `products.demo_price_vnd` (máy chủ
-- tính tiền đơn web theo cột này) và `content/packages.ts` (web hiển thị).
-- Vé Tràng An ở quầy 250.000 đ, còn gói có Tràng An trên web 890.000 đ.
--
-- Từ đây bảng giá quầy là nguồn duy nhất:
-- 1. `customer_product_unit_price`: giá một khách người lớn của một sản phẩm
--    vào một ngày = tổng giá vé người lớn đang áp dụng ngày ấy của các điểm
--    trong sản phẩm (điểm không bán vé như Hoa Lư thì 0 đ). Sản phẩm là dịch
--    vụ chứ không phải vé (Bàn Trăng) đánh dấu `gia_theo_ve_cong = false` và
--    giữ giá riêng.
-- 2. `customer_create_booking_hold` chép NGUYÊN VĂN bản 056, chỉ đổi ba chỗ
--    `v_product.demo_price_vnd` thành giá tính theo ngày đi.
-- 3. `customer_product_prices`: web đọc giá hiện hành của mọi sản phẩm.
-- 4. `demo_price_vnd` vẫn được giữ khớp (trigger sau mỗi lần đổi giá quầy)
--    cho những chỗ cũ còn đọc cột này, như lịch sử mẫu.
-- 5. Bốn vé lẻ bán trên web, đúng giá quầy, dùng chung khung giờ với gói.
-- 6. `customer_lookup_by_phone`: khách tra vé và lượt đi chỉ bằng số điện
--    thoại. Trả đủ cho máy chủ web; máy chủ che mã vé và bỏ mã quà trước
--    khi đưa ra trình duyệt (không có tin nhắn xác nhận nên ai biết số cũng
--    tra được).

begin;

alter table public.products
  add column if not exists gia_theo_ve_cong boolean not null default true;

update public.products set gia_theo_ve_cong = false
where id = '40000000-0000-4000-8000-000000000005' and gia_theo_ve_cong;

create or replace function public.customer_product_unit_price(
  p_tenant_id uuid,
  p_product_id uuid,
  p_on date
)
returns integer
language sql
stable
security definer
set search_path = ''
as $ham$
  select case
    when not product.gia_theo_ve_cong then product.demo_price_vnd
    else coalesce((
      select sum(gia.unit_price_vnd)::integer
      from public.product_sites ps
      cross join lateral (
        select list.unit_price_vnd
        from public.erp_counter_price_list list
        where list.tenant_id = p_tenant_id
          and list.site_id = ps.site_id
          and list.product = 'adult'
          and list.effective_from <= coalesce(p_on, (now() at time zone 'Asia/Ho_Chi_Minh')::date)
        order by list.effective_from desc, list.revision desc
        limit 1
      ) gia
      where ps.product_id = product.id
    ), 0)
  end
  from public.products product
  where product.id = p_product_id and product.tenant_id = p_tenant_id;
$ham$;

create or replace function public.customer_product_prices(p_tenant_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $ham$
  select coalesce(jsonb_agg(jsonb_build_object(
    'slug', product.slug,
    'price_vnd', public.customer_product_unit_price(p_tenant_id, product.id, null),
    'from_gate_prices', product.gia_theo_ve_cong
  ) order by product.slug), '[]'::jsonb)
  from public.products product
  where product.tenant_id = p_tenant_id and product.active;
$ham$;

create or replace function public.customer_products_sync_price()
returns trigger
language plpgsql
security definer
set search_path = ''
as $ham$
begin
  update public.products product
  set demo_price_vnd = public.customer_product_unit_price(product.tenant_id, product.id, null)
  where product.tenant_id = new.tenant_id
    and product.gia_theo_ve_cong
    and exists (
      select 1 from public.product_sites ps
      where ps.product_id = product.id and ps.site_id = new.site_id
    );
  return null;
end;
$ham$;

drop trigger if exists customer_products_sync_price on public.erp_counter_price_list;
create trigger customer_products_sync_price
  after insert on public.erp_counter_price_list
  for each row execute function public.customer_products_sync_price();

-- Vé lẻ: một điểm, giá đúng giá quầy, khung giờ trùng khung của gói cùng điểm.
insert into public.products (
  id, tenant_id, region_id, name, slug, product_type, ledger_type,
  demo_price_vnd, duration_minutes, entitlement_templates, active
) values
  ('40000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002',
   'Vé Tràng An', 've-trang-an', 'ticket', 'service-commerce', 250000, 180,
   '[{"siteSlug":"trang-an","quantity":1}]'::jsonb, true),
  ('40000000-0000-4000-8000-000000000012', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002',
   'Vé Tam Cốc – Bích Động', 've-tam-coc', 'ticket', 'service-commerce', 200000, 120,
   '[{"siteSlug":"tam-coc-bich-dong","quantity":1}]'::jsonb, true),
  ('40000000-0000-4000-8000-000000000013', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002',
   'Vé Tam Chúc', 've-tam-chuc', 'ticket', 'service-commerce', 200000, 240,
   '[{"siteSlug":"tam-chuc","quantity":1}]'::jsonb, true),
  ('40000000-0000-4000-8000-000000000014', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002',
   'Vé Bái Đính', 've-bai-dinh', 'ticket', 'service-commerce', 60000, 180,
   '[{"siteSlug":"bai-dinh","quantity":1}]'::jsonb, true)
on conflict (id) do nothing;

insert into public.product_sites (product_id, site_id, stop_order) values
  ('40000000-0000-4000-8000-000000000011', '10000000-0000-4000-8000-000000000001', 1),
  ('40000000-0000-4000-8000-000000000012', '10000000-0000-4000-8000-000000000005', 1),
  ('40000000-0000-4000-8000-000000000013', '10000000-0000-4000-8000-000000000009', 1),
  ('40000000-0000-4000-8000-000000000014', '10000000-0000-4000-8000-000000000003', 1)
on conflict (product_id, site_id) do nothing;

insert into public.customer_product_capacity_templates (
  tenant_id, product_id, site_id, departure_time, local_start_time,
  duration_minutes, source_kind, source_note, active
)
select '00000000-0000-4000-8000-000000000001', v.product_id::uuid, v.site_id::uuid,
  gio::time, gio::time, v.phut, 'customer-approved',
  'Khung giờ vé lẻ ' || v.ten || ' bán trên web, chủ dự án giao 13/10/2026.', true
from (values
  ('40000000-0000-4000-8000-000000000011', '10000000-0000-4000-8000-000000000001', 'Tràng An', 60,
   array['07:30', '08:00', '09:00', '10:00', '11:00', '13:00', '14:00', '15:00']),
  ('40000000-0000-4000-8000-000000000012', '10000000-0000-4000-8000-000000000005', 'Tam Cốc', 60,
   array['07:00', '08:00', '09:00', '10:00', '13:00', '14:00', '15:30']),
  ('40000000-0000-4000-8000-000000000013', '10000000-0000-4000-8000-000000000009', 'Tam Chúc', 90,
   array['07:30', '09:00', '10:30', '13:30', '15:00']),
  ('40000000-0000-4000-8000-000000000014', '10000000-0000-4000-8000-000000000003', 'Bái Đính', 60,
   array['07:30', '09:30', '11:00', '13:30', '15:00'])
) as v(product_id, site_id, ten, phut, gios)
cross join lateral unnest(v.gios) as gio
on conflict do nothing;

-- Giá cũ của các gói vé về đúng tổng giá quầy ngay bây giờ.
update public.products product
set demo_price_vnd = public.customer_product_unit_price(product.tenant_id, product.id, null)
where product.gia_theo_ve_cong
  and product.demo_price_vnd <> public.customer_product_unit_price(product.tenant_id, product.id, null);

-- Tra bằng số điện thoại (đã băm ở máy chủ web).
create or replace function public.customer_lookup_by_phone(
  p_tenant_id uuid,
  p_identity_digest text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $ham$
declare
  v_identity public.customer_identities;
begin
  if p_tenant_id is null or coalesce(p_identity_digest, '') !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = '22023', message = 'LOYALTY_INPUT_INVALID';
  end if;
  select identity.* into v_identity
  from public.customer_identities identity
  where identity.tenant_id = p_tenant_id
    and identity.identity_type = 'phone'
    and identity.identity_digest = p_identity_digest;
  if v_identity.id is null then
    return jsonb_build_object('found', false);
  end if;
  return jsonb_build_object(
    'found', true,
    'loyalty', public.customer_loyalty_refresh(p_tenant_id, v_identity.id, true),
    'web_tickets', coalesce((
      select jsonb_agg(jsonb_build_object(
        'order_code', customer_order.order_code,
        'product', product.name,
        'code', ticket.ticket_code,
        'site', site.name,
        'valid_on', ticket.valid_on,
        'status', ticket.status,
        'entries_allowed', ticket.entries_allowed,
        'entries_used', ticket.entries_used
      ) order by ticket.valid_on desc, ticket.ticket_code)
      from public.customer_orders customer_order
      join public.products product on product.id = customer_order.product_id
      join public.customer_order_tickets order_ticket
        on order_ticket.tenant_id = customer_order.tenant_id and order_ticket.order_id = customer_order.id
      join public.erp_tickets ticket on ticket.id = order_ticket.ticket_id and ticket.tenant_id = customer_order.tenant_id
      join public.sites site on site.id = ticket.site_id
      where customer_order.tenant_id = p_tenant_id
        and customer_order.status = 'confirmed'
        and (customer_order.identity_id = v_identity.id
             or public.customer_canonical_profile_id(p_tenant_id, customer_order.profile_id)
                = public.customer_canonical_profile_id(p_tenant_id, v_identity.profile_id))
    ), '[]'::jsonb)
  );
end;
$ham$;

create or replace function public.customer_create_booking_hold(
  p_tenant_id uuid,
  p_request_id uuid,
  p_anonymous_id uuid,
  p_product_id uuid,
  p_visit_date date,
  p_party_size integer,
  p_occurred_at timestamptz,
  p_slot_starts_at timestamptz default null,
  -- TC-03: tach nguoi lon / tre em. De trong thi moi khach tinh la nguoi
  -- lon, dung bang hanh vi truoc TC-03 — moi loi goi cu van chay y nhu truoc.
  p_adults integer default null,
  p_children integer default null
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
  v_adults integer;
  v_children integer;
  v_unit_price integer;
begin
  if p_tenant_id is null or p_request_id is null or p_anonymous_id is null
     or p_product_id is null or p_visit_date is null
     or p_party_size not between 1 and 45 or p_occurred_at is null
     or p_occurred_at > now() + interval '5 minutes'
     or p_visit_date < (now() at time zone 'Asia/Ho_Chi_Minh')::date
     or p_visit_date > (now() at time zone 'Asia/Ho_Chi_Minh')::date + 90 then
    raise exception using errcode = '22023', message = 'CUSTOMER_BOOKING_INPUT_INVALID';
  end if;

  -- TC-15: tran 45 khach mot luot dat.
  --
  -- Khong phai con so tuy tien: mot xe khach lon o Viet Nam la 45 cho, va
  -- chu du an noi thang la co doan 32 nguoi. Van phai co tran, vi tran o day
  -- chan mot cu go nham thanh mot luot giu 10.000 cho.

  -- TC-03: hai nhom tuoi phai cong dung bang tong so khach.
  --
  -- Khong suy dien, khong tu lam tron. So tre em quyet dinh cho ngoi tren
  -- thuyen va nguoi di kem, nen mot con so sai o day di thang ra toi cong.
  -- Bat buoc it nhat mot nguoi lon: tre em khong di mot minh.
  v_adults := coalesce(p_adults, p_party_size);
  v_children := coalesce(p_children, 0);
  if v_adults < 1 or v_children < 0 or v_adults + v_children <> p_party_size then
    raise exception using errcode = '22023', message = 'CUSTOMER_BOOKING_PARTY_MIX_INVALID';
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
    p_product_id, p_visit_date, p_party_size, p_slot_starts_at,
    v_adults, v_children
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
  -- 124: giá theo bảng giá quầy áp dụng cho ngày đi, không theo cột demo_price_vnd.
  v_unit_price := public.customer_product_unit_price(p_tenant_id, v_product.id, p_visit_date);

  insert into public.customer_orders (
    tenant_id, profile_id, product_id, order_code, visit_date, party_size,
    adults, children, unit_price_vnd, total_vnd, currency, status
  ) values (
    p_tenant_id, v_profile_id, v_product.id,
    'NBJ-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)),
    p_visit_date, p_party_size, v_adults, v_children, v_unit_price,
    -- Tinh theo so khach CO VE. Tre duoi 1m3 khong mua ve.
    v_unit_price * v_adults, 'VND', 'holding'
  ) returning * into v_order;

  -- Hai dong tach bach, hai muc gia khac han nhau.
  --
  -- Chu du an chot 29/08/2026: tre DUOI 1m3 khong mua ve, tu 1m3 tro len tinh
  -- gia thuong. Dong 'child' vi the co don gia bang khong.
  --
  -- Van ghi ra thanh mot dong rieng chu khong bo di, vi ba ly do: don hang
  -- phai doc duoc la co bao nhieu tre nho di cung, ke toan phai thay ro doan
  -- nay duoc mien bao nhieu, va sau nay chu du an doi y ve gia thi chi phai
  -- sua dung mot so o day.
  insert into public.customer_order_lines (
    tenant_id, order_id, product_id, guest_group, quantity,
    unit_price_vnd, total_vnd, ledger_type
  ) values (
    p_tenant_id, v_order.id, v_product.id, 'adult', v_adults,
    v_unit_price, v_unit_price * v_adults,
    'service-commerce'
  );
  if v_children > 0 then
    insert into public.customer_order_lines (
      tenant_id, order_id, product_id, guest_group, quantity,
      unit_price_vnd, total_vnd, ledger_type
    ) values (
      p_tenant_id, v_order.id, v_product.id, 'child', v_children,
      0, 0,
      'service-commerce'
    );
  end if;

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
    -- Thu tu nay la THU TU KHOA, khong phai chuyen trinh bay.
    -- local_start_time cong voi p_visit_date ra dung starts_at, nen
    -- (gio, co so) la mot thu tu toan phan tren bang khung gio va moi giao
    -- dich deu di theo mot chieu. customer_confirm_simulated_booking khoa
    -- theo dung thu tu nay — hai ham di nguoc chieu nhau la cong thuc
    -- cua deadlock.
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
    -- TC-03: tao va khoa hang khung gio trong DUNG MOT cau lenh.
    --
    -- do nothing roi select ... for update co hai lo. Mot: neu mot giao
    -- dich khac vua chen dung hang nay ma chua commit thi do nothing bo
    -- qua, con select chua nhin thay hang — khung gio thanh null va ca luot
    -- giu cho hong theo mot cach rat kho doc. Hai: hai cau lenh la hai thoi
    -- diem khoa khac nhau. do update cho giao dich kia xong roi tra ve hang
    -- that, da khoa san.
    on conflict (tenant_id, site_id, starts_at) do update
      set updated_at = now()
    returning booking_slot.* into v_slot;
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
    -- Tru theo p_party_size, KHONG theo v_adults. Tre duoi 1m3 khong mua ve
    -- nhung van ngoi mot cho tren thuyen. Tru theo so ve ban ra la ban vuot
    -- suc chua that, va cho thieu chi lo ra luc ca doan da toi ben.
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
      'adults', v_adults,
      'children', v_children,
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


revoke all on function public.customer_product_unit_price(uuid, uuid, date) from public, anon, authenticated;
grant execute on function public.customer_product_unit_price(uuid, uuid, date) to service_role;
revoke all on function public.customer_product_prices(uuid) from public, anon, authenticated;
grant execute on function public.customer_product_prices(uuid) to service_role;
revoke all on function public.customer_products_sync_price() from public, anon, authenticated, service_role;
revoke all on function public.customer_lookup_by_phone(uuid, text) from public, anon, authenticated;
grant execute on function public.customer_lookup_by_phone(uuid, text) to service_role;

commit;
