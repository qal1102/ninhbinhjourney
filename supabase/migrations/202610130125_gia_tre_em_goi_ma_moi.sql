-- Giá trẻ em, gói rẻ hơn mua lẻ, mã mời bạn (13/10/2026).
--
-- Chủ dự án 13/10: "giá trẻ em sửa trước… gói rẻ hơn mua lẻ… mã mời", trong
-- đợt chương trình kéo khách quay lại (HANDOFF mục C). Không gửi tin nhắn nào:
-- mọi thứ ở đây là khách tự mở, tự dùng.
--
-- 1. Giá trẻ em. Luật cũ "trẻ dưới 1m3 miễn phí" (chủ dự án chốt 29/08) lệch
--    thực tế: ở Tràng An trẻ dưới 1m miễn phí, trẻ 1m–1m3 trả 120.000 đ
--    (trang hướng dẫn của Vietnam Airlines); Tam Chúc tính trẻ 1m–1m3 bằng
--    50% người lớn. Từ nay dòng `child` của bảng giá quầy là trẻ 1m–1m3 và
--    có giá; trẻ dưới 1m đi cùng người lớn, không cần vé. Giá mới đặt qua
--    đúng bảng giá quầy (thêm dòng, không sửa dòng cũ), nên quầy và web đổi
--    cùng lúc và giám đốc vẫn sửa được ở màn Bảng giá.
-- 2. Gói rẻ hơn mua lẻ. Gói có 2 điểm bán vé giảm 10%, từ 3 điểm giảm 15%,
--    làm tròn xuống nghìn đồng. Trước đây gói bằng đúng tổng vé, khách không
--    có lý do mua gói. Thêm gói "Tràng An sáng, Tam Cốc chiều" để dẫn khách
--    Tràng An sang điểm thứ hai (khung chiều Tam Cốc vắng hơn buổi sáng).
-- 3. Mã mời. Mỗi số điện thoại đã gắn có một mã `MOI-XXXXXX`. Bạn mua trên
--    web bằng mã ấy được giảm 10%. Người mời được cộng một lượt tích khi bạn
--    đã qua cổng và để lại số khác số người mời; tối đa 5 lượt mỗi 365 ngày.
--    Lượt cộng dùng chung mốc quà đã có (2 lượt quà, 4 và 8 lượt vé miễn phí).
--
-- `customer_create_booking_hold` chép NGUYÊN VĂN bản 124 rồi đổi đúng ba chỗ:
-- lấy thêm giá trẻ em, nhận mã mời, tổng tiền trừ phần giảm. Thêm tham số nên
-- phải bỏ bản cũ (cùng tên khác số tham số thì PostgREST không chọn được).
-- `customer_loyalty_refresh` chép nguyên bản 119, cộng thêm lượt bạn mời.

begin;

-- 1. Giá trẻ em 1m–1m3 ------------------------------------------------------------------

insert into public.erp_counter_price_list (
  tenant_id, site_id, product, unit_price_vnd, effective_from, note, created_by_account_id
)
select '00000000-0000-4000-8000-000000000001', v.site_id::uuid, 'child', v.gia, date '2026-10-13', v.ghi, 'system'
from (values
  ('10000000-0000-4000-8000-000000000001', 120000, 'Trẻ 1m–1m3, theo giá niêm yết Tràng An. Trẻ dưới 1m đi cùng người lớn, không cần vé.'),
  ('10000000-0000-4000-8000-000000000005', 100000, 'Trẻ 1m–1m3, bằng nửa giá người lớn. Trẻ dưới 1m đi cùng người lớn, không cần vé.'),
  ('10000000-0000-4000-8000-000000000009', 100000, 'Trẻ 1m–1m3, bằng nửa giá người lớn như Tam Chúc niêm yết. Trẻ dưới 1m không cần vé.'),
  ('10000000-0000-4000-8000-000000000003', 30000, 'Trẻ 1m–1m3, bằng nửa giá xe điện người lớn. Trẻ dưới 1m đi cùng người lớn, không cần vé.')
) as v(site_id, gia, ghi)
where exists (select 1 from public.sites site where site.id = v.site_id::uuid)
  and not exists (
    select 1 from public.erp_counter_price_list list
    where list.tenant_id = '00000000-0000-4000-8000-000000000001'
      and list.site_id = v.site_id::uuid and list.product = 'child'
      and list.effective_from = date '2026-10-13' and list.unit_price_vnd = v.gia
  );

-- 2. Giá một sản phẩm: người lớn, trẻ em, giá mua lẻ, phần trăm giảm ---------------------

create or replace function public.customer_product_price_parts(
  p_tenant_id uuid,
  p_product_id uuid,
  p_on date
)
returns table (nguoi_lon integer, tre_em integer, gia_le integer, giam integer)
language sql
stable
security definer
set search_path = ''
as $ham$
  with sp as (
    select product.gia_theo_ve_cong, product.demo_price_vnd
    from public.products product
    where product.id = p_product_id and product.tenant_id = p_tenant_id
  ),
  diem as (
    select
      coalesce((
        select list.unit_price_vnd from public.erp_counter_price_list list
        where list.tenant_id = p_tenant_id and list.site_id = ps.site_id
          and list.product = 'adult' and list.effective_from <= ngay.d
        order by list.effective_from desc, list.revision desc limit 1
      ), 0) as lon,
      coalesce((
        select list.unit_price_vnd from public.erp_counter_price_list list
        where list.tenant_id = p_tenant_id and list.site_id = ps.site_id
          and list.product = 'child' and list.effective_from <= ngay.d
        order by list.effective_from desc, list.revision desc limit 1
      ), 0) as nho
    from public.product_sites ps
    cross join (select coalesce(p_on, (now() at time zone 'Asia/Ho_Chi_Minh')::date) as d) ngay
    where ps.product_id = p_product_id
  ),
  tong as (
    select coalesce(sum(diem.lon), 0)::bigint as lon,
           coalesce(sum(diem.nho), 0)::bigint as nho,
           count(*) filter (where diem.lon > 0) as so_diem
    from diem
  ),
  muc as (
    select tong.*, case when tong.so_diem >= 3 then 15 when tong.so_diem = 2 then 10 else 0 end as pct
    from tong
  )
  select
    case when not sp.gia_theo_ve_cong then sp.demo_price_vnd
         when muc.pct = 0 then muc.lon::integer
         else (muc.lon * (100 - muc.pct) / 100000 * 1000)::integer end,
    case when not sp.gia_theo_ve_cong then 0
         when muc.pct = 0 then muc.nho::integer
         else (muc.nho * (100 - muc.pct) / 100000 * 1000)::integer end,
    case when not sp.gia_theo_ve_cong then sp.demo_price_vnd else muc.lon::integer end,
    case when not sp.gia_theo_ve_cong then 0 else muc.pct end
  from sp cross join muc;
$ham$;

-- Giữ tên và tham số cũ (124): trigger đồng bộ và các chỗ cũ vẫn gọi hàm này.
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
  select parts.nguoi_lon from public.customer_product_price_parts(p_tenant_id, p_product_id, p_on) parts;
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
    'price_vnd', parts.nguoi_lon,
    'child_price_vnd', parts.tre_em,
    'full_price_vnd', parts.gia_le,
    'discount_pct', parts.giam,
    'from_gate_prices', product.gia_theo_ve_cong
  ) order by product.slug), '[]'::jsonb)
  from public.products product
  cross join lateral public.customer_product_price_parts(p_tenant_id, product.id, null) parts
  where product.tenant_id = p_tenant_id and product.active;
$ham$;

-- 3. Gói "Tràng An sáng, Tam Cốc chiều" ----------------------------------------------------

insert into public.products (
  id, tenant_id, region_id, name, slug, product_type, ledger_type,
  demo_price_vnd, duration_minutes, entitlement_templates, active
) values (
  '40000000-0000-4000-8000-000000000015', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002',
  'Tràng An sáng, Tam Cốc chiều', 'trang-an-tam-coc-trong-ngay', 'package', 'service-commerce', 405000, 540,
  '[{"siteSlug":"trang-an","quantity":1},{"siteSlug":"tam-coc-bich-dong","quantity":1}]'::jsonb, true
) on conflict (id) do nothing;

insert into public.product_sites (product_id, site_id, stop_order) values
  ('40000000-0000-4000-8000-000000000015', '10000000-0000-4000-8000-000000000001', 1),
  ('40000000-0000-4000-8000-000000000015', '10000000-0000-4000-8000-000000000005', 2)
on conflict (product_id, site_id) do nothing;

-- Thuyền Tràng An buổi sáng, đò Tam Cốc đầu giờ chiều (cùng khung với vé lẻ
-- Tam Cốc, nên hai bên dùng chung sức chứa).
insert into public.customer_product_capacity_templates (
  tenant_id, product_id, site_id, departure_time, local_start_time,
  duration_minutes, source_kind, source_note, active
)
select '00000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000015', v.site_id::uuid,
  v.di::time, v.gio::time, 60, 'customer-approved',
  'Gói Tràng An sáng, Tam Cốc chiều, chương trình kéo khách 13/10/2026.', true
from (values
  ('07:30', '10000000-0000-4000-8000-000000000001', '07:30'),
  ('07:30', '10000000-0000-4000-8000-000000000005', '13:00'),
  ('08:00', '10000000-0000-4000-8000-000000000001', '08:00'),
  ('08:00', '10000000-0000-4000-8000-000000000005', '14:00')
) as v(di, site_id, gio)
on conflict do nothing;

-- Giá đã lưu của mọi gói về đúng giá mới (gói 2 điểm giảm 10%).
update public.products product
set demo_price_vnd = public.customer_product_unit_price(product.tenant_id, product.id, null)
where product.gia_theo_ve_cong
  and product.demo_price_vnd <> public.customer_product_unit_price(product.tenant_id, product.id, null);

-- 4. Mã mời ------------------------------------------------------------------------------

create table if not exists public.customer_referral_codes (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  identity_id uuid not null,
  code text not null check (code ~ '^MOI-[A-Z0-9]{6}$'),
  created_at timestamptz not null default now(),
  primary key (tenant_id, identity_id),
  unique (tenant_id, code),
  foreign key (identity_id, tenant_id)
    references public.customer_identities(id, tenant_id) on delete restrict
);
alter table public.customer_referral_codes enable row level security;

alter table public.customer_orders
  add column if not exists child_unit_price_vnd integer not null default 0
    check (child_unit_price_vnd >= 0),
  add column if not exists giam_vnd integer not null default 0
    check (giam_vnd >= 0),
  add column if not exists ma_moi text
    check (ma_moi is null or ma_moi ~ '^MOI-[A-Z0-9]{6}$');

-- Tổng = người lớn + trẻ 1m–1m3 − phần giảm của mã mời. Đơn cũ có giá trẻ 0
-- và không giảm, nên vẫn đúng ràng buộc mới.
alter table public.customer_orders drop constraint if exists customer_orders_total_check;
alter table public.customer_orders add constraint customer_orders_total_check
  check (total_vnd = unit_price_vnd * adults + child_unit_price_vnd * children - giam_vnd and total_vnd >= 0);

create index if not exists customer_orders_ma_moi_idx
  on public.customer_orders (tenant_id, ma_moi) where ma_moi is not null;

create or replace function public.customer_referral_code(p_tenant_id uuid, p_identity_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $ham$
declare
  v_code text;
begin
  select code.code into v_code from public.customer_referral_codes code
  where code.tenant_id = p_tenant_id and code.identity_id = p_identity_id;
  if v_code is not null then
    return v_code;
  end if;
  for i in 1..5 loop
    v_code := 'MOI-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
    begin
      insert into public.customer_referral_codes (tenant_id, identity_id, code)
      values (p_tenant_id, p_identity_id, v_code)
      on conflict (tenant_id, identity_id) do nothing;
      select code.code into v_code from public.customer_referral_codes code
      where code.tenant_id = p_tenant_id and code.identity_id = p_identity_id;
      return v_code;
    exception when unique_violation then
      -- Trùng mã của người khác (rất hiếm): thử mã khác.
      null;
    end;
  end loop;
  raise exception using errcode = '55000', message = 'REFERRAL_CODE_EXHAUSTED';
end;
$ham$;

-- Bạn được mời đã đi: đơn web xác nhận dùng mã của người này, có ít nhất một
-- lượt qua cổng, để lại số điện thoại khác người mời. Tối đa 5 trong 365 ngày.
create or replace function public.customer_referral_successes(p_tenant_id uuid, p_identity_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $ham$
  select least(count(distinct customer_order.id), 5)::integer
  from public.customer_referral_codes code
  join public.customer_identities owner
    on owner.id = code.identity_id and owner.tenant_id = code.tenant_id
  join public.customer_orders customer_order
    on customer_order.tenant_id = code.tenant_id and customer_order.ma_moi = code.code
  where code.tenant_id = p_tenant_id and code.identity_id = p_identity_id
    and customer_order.status = 'confirmed'
    and customer_order.created_at > now() - interval '365 days'
    and customer_order.identity_id is not null
    and customer_order.identity_id <> p_identity_id
    and public.customer_canonical_profile_id(p_tenant_id, customer_order.profile_id)
        <> public.customer_canonical_profile_id(p_tenant_id, owner.profile_id)
    and exists (
      select 1
      from public.customer_order_tickets order_ticket
      join public.erp_gate_scan_events scan
        on scan.tenant_id = order_ticket.tenant_id and scan.ticket_id = order_ticket.ticket_id
      where order_ticket.tenant_id = customer_order.tenant_id
        and order_ticket.order_id = customer_order.id
        and scan.result = 'accepted'
    );
$ham$;

-- Chép nguyên bản 119; thêm lượt bạn mời vào phép đếm mốc và điểm, thêm mã mời.
create or replace function public.customer_loyalty_refresh(
  p_tenant_id uuid,
  p_identity_id uuid,
  p_full boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $ham$
declare
  v_visits integer;
  v_moi integer;
  v_tong integer;
  v_moc record;
  v_hint text;
begin
  select count(*)::integer into v_visits
  from public.customer_loyalty_visits(p_tenant_id, p_identity_id);
  -- 125: bạn được mời đã đi tính như một lượt của người mời.
  v_moi := public.customer_referral_successes(p_tenant_id, p_identity_id);
  v_tong := v_visits + v_moi;

  for v_moc in select * from public.customer_loyalty_milestones() m where m.milestone <= v_tong loop
    insert into public.customer_loyalty_vouchers (
      tenant_id, identity_id, voucher_code, reward_kind, milestone, expires_on
    ) values (
      p_tenant_id, p_identity_id,
      'VC-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
      v_moc.reward_kind, v_moc.milestone,
      ((now() at time zone 'Asia/Ho_Chi_Minh')::date + 365)
    ) on conflict (tenant_id, identity_id, milestone) do nothing;
  end loop;

  select link.contact_hint into v_hint
  from public.customer_loyalty_links link
  where link.tenant_id = p_tenant_id and link.identity_id = p_identity_id
  order by link.linked_at desc limit 1;

  return jsonb_build_object(
    'linked', true,
    'contact_hint', v_hint,
    'visits', v_visits,
    'referrals', v_moi,
    'referral_code', public.customer_referral_code(p_tenant_id, p_identity_id),
    'points', v_tong * 100,
    'next_milestone', (
      select jsonb_build_object('visits', m.milestone, 'reward', m.reward_label, 'remaining', m.milestone - v_tong)
      from public.customer_loyalty_milestones() m
      where m.milestone > v_tong order by m.milestone limit 1
    ),
    'voucher_count', (
      select count(*) from public.customer_loyalty_vouchers v
      where v.tenant_id = p_tenant_id and v.identity_id = p_identity_id and v.status = 'issued'
    ),
    'visit_list', coalesce((
      select jsonb_agg(jsonb_build_object('site', site.name, 'date', visit.visit_date) order by visit.visit_date desc, site.name)
      from public.customer_loyalty_visits(p_tenant_id, p_identity_id) visit
      join public.sites site on site.id = visit.site_id
    ), '[]'::jsonb),
    'vouchers', case when p_full then coalesce((
      select jsonb_agg(jsonb_build_object(
        'code', v.voucher_code, 'kind', v.reward_kind, 'milestone', v.milestone,
        'status', v.status, 'expires_on', v.expires_on, 'redeemed_at', v.redeemed_at,
        'label', (select m.reward_label from public.customer_loyalty_milestones() m where m.milestone = v.milestone)
      ) order by v.milestone)
      from public.customer_loyalty_vouchers v
      where v.tenant_id = p_tenant_id and v.identity_id = p_identity_id
    ), '[]'::jsonb) else null end,
    'tickets', case when p_full then coalesce((
      select jsonb_agg(jsonb_build_object(
        'code', link.source_code, 'kind', link.source_kind, 'site', site.name,
        'valid_on', ticket.valid_on, 'status', ticket.status,
        'entries_allowed', case when link.member_id is null then ticket.entries_allowed else 1 end,
        'entries_used', case when link.member_id is null then ticket.entries_used
          -- Người trong đoàn: đã qua bằng mã riêng, hay cả đoàn qua bằng mã đoàn.
          else (select least(count(*), 1) from public.erp_gate_scan_events scan
                where scan.tenant_id = p_tenant_id and scan.ticket_id = link.ticket_id
                  and (scan.member_id = link.member_id or scan.member_id is null)
                  and scan.result = 'accepted')::integer end
      ) order by link.linked_at desc)
      from public.customer_loyalty_links link
      join public.erp_tickets ticket on ticket.id = link.ticket_id and ticket.tenant_id = link.tenant_id
      join public.sites site on site.id = ticket.site_id
      where link.tenant_id = p_tenant_id and link.identity_id = p_identity_id
    ), '[]'::jsonb) else null end
  );
end;
$ham$;

-- Kiểm mã mời trước khi khách bấm giữ chỗ (trang thanh toán báo ngay mã sai).
create or replace function public.customer_referral_check(p_tenant_id uuid, p_code text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $ham$
  select exists (
    select 1 from public.customer_referral_codes code
    where code.tenant_id = p_tenant_id and code.code = upper(trim(coalesce(p_code, '')))
  );
$ham$;

-- 5. Giữ chỗ: giá trẻ em, mã mời ----------------------------------------------------------

drop function if exists public.customer_create_booking_hold(
  uuid, uuid, uuid, uuid, date, integer, timestamptz, timestamptz, integer, integer
);

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
  p_children integer default null,
  -- 125: ma moi cua mot khach khac, giam 10% don nay.
  p_ma_moi text default null
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
  inserted boolean,
  discount_vnd integer
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
  v_child_price integer;
  v_ma_moi text := nullif(upper(trim(coalesce(p_ma_moi, ''))), '');
  v_giam integer := 0;
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

  -- 125: ma moi phai co that. Sai thi bao ngay, khong lang le bo qua.
  if v_ma_moi is not null and not exists (
    select 1 from public.customer_referral_codes code
    where code.tenant_id = p_tenant_id and code.code = v_ma_moi
  ) then
    raise exception using errcode = '22023', message = 'CUSTOMER_REFERRAL_CODE_INVALID';
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
    -- 125: cung khoa giu cho ma doi ma moi la mot luot dat khac.
    if v_existing_order.ma_moi is distinct from v_ma_moi then
      raise exception using errcode = '23505', message = 'CUSTOMER_BOOKING_ID_COLLISION';
    end if;
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
      v_existing_order.currency, v_slots, false, v_existing_order.giam_vnd;
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
  -- 125: thêm giá trẻ 1m–1m3 (gói đã trừ phần giảm gói ở cả hai giá).
  select parts.nguoi_lon, parts.tre_em into v_unit_price, v_child_price
  from public.customer_product_price_parts(p_tenant_id, v_product.id, p_visit_date) parts;
  -- 125: mã mời giảm 10% đơn vé, làm tròn xuống nghìn. Dịch vụ giá riêng
  -- (Bàn Trăng) không nhận mã mời.
  if v_ma_moi is not null then
    if not v_product.gia_theo_ve_cong then
      raise exception using errcode = '22023', message = 'CUSTOMER_REFERRAL_NOT_APPLICABLE';
    end if;
    v_giam := ((v_unit_price::bigint * v_adults + v_child_price::bigint * v_children) / 10000 * 1000)::integer;
  end if;

  insert into public.customer_orders (
    tenant_id, profile_id, product_id, order_code, visit_date, party_size,
    adults, children, unit_price_vnd, child_unit_price_vnd, giam_vnd, ma_moi,
    total_vnd, currency, status
  ) values (
    p_tenant_id, v_profile_id, v_product.id,
    'NBJ-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)),
    p_visit_date, p_party_size, v_adults, v_children, v_unit_price, v_child_price,
    v_giam, v_ma_moi,
    -- 125: người lớn + trẻ 1m–1m3 − phần giảm của mã mời. Trẻ dưới 1m không có vé.
    v_unit_price * v_adults + v_child_price * v_children - v_giam, 'VND', 'holding'
  ) returning * into v_order;

  -- Hai dong tach bach, hai muc gia khac han nhau.
  --
  -- 125: dong 'child' la tre 1m–1m3, co gia rieng theo bang gia quay. Tre
  -- duoi 1m khong mua ve va khong vao don.
  --
  -- Van ghi ra thanh mot dong rieng chu khong bo di, vi ba ly do: don hang
  -- phai doc duoc la co bao nhieu tre nho di cung, ke toan phai thay ro doan
  -- nay tre tra bao nhieu, va sau nay chu du an doi y ve gia thi chi phai
  -- sua dung bang gia quay.
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
      v_child_price, v_child_price * v_children,
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
    -- Tru theo p_party_size (nguoi lon + tre 1m–1m3): moi nguoi co ve ngoi
    -- mot cho tren thuyen.
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
      'referral', v_ma_moi is not null,
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
    v_hold.expires_at, v_order.total_vnd, v_order.currency, v_slots, true, v_order.giam_vnd;
end;
$$;

-- 6. Khoá cửa -------------------------------------------------------------------------------

revoke all on table public.customer_referral_codes from public, anon, authenticated;
revoke all on function public.customer_product_price_parts(uuid, uuid, date) from public, anon, authenticated;
grant execute on function public.customer_product_price_parts(uuid, uuid, date) to service_role;
revoke all on function public.customer_product_unit_price(uuid, uuid, date) from public, anon, authenticated;
grant execute on function public.customer_product_unit_price(uuid, uuid, date) to service_role;
revoke all on function public.customer_product_prices(uuid) from public, anon, authenticated;
grant execute on function public.customer_product_prices(uuid) to service_role;
revoke all on function public.customer_referral_code(uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function public.customer_referral_successes(uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function public.customer_loyalty_refresh(uuid, uuid, boolean) from public, anon, authenticated, service_role;
revoke all on function public.customer_referral_check(uuid, text) from public, anon, authenticated;
grant execute on function public.customer_referral_check(uuid, text) to service_role;
revoke all on function public.customer_create_booking_hold(
  uuid, uuid, uuid, uuid, date, integer, timestamptz, timestamptz, integer, integer, text
) from public, anon, authenticated;
grant execute on function public.customer_create_booking_hold(
  uuid, uuid, uuid, uuid, date, integer, timestamptz, timestamptz, integer, integer, text
) to service_role;

commit;
