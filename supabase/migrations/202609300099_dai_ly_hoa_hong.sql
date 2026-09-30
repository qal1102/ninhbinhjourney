-- Cổng đại lý kèm hoa hồng (tài liệu khách hàng: "cổng đại lý, hoa hồng").
--
-- Mỗi đại lý có một mã (ví dụ HONGHA) và một đường dẫn riêng /dl/<mã>. Khách
-- mở đường dẫn ấy thì trình duyệt nhớ mã đại lý 30 ngày; giữ chỗ trên web lúc
-- đó thì đơn được ghi cho đại lý (`dai_ly_don`). Đơn quá hạn chưa trả bị xoá
-- hẳn (090) thì dòng ghi ấy xoá theo (on delete cascade).
--
-- Luật hoa hồng: chỉ tính trên đơn đã trả mà khách ĐÃ QUA CỔNG ít nhất một vé,
-- theo tháng của ngày đi; tiền = tổng tiền đơn × tỷ lệ của đại lý, làm tròn
-- tới đồng. Đơn đã trả mà khách chưa tới thì là "chờ khách tới", chưa phải
-- trả. Kế toán ghi "đã chi" từng tháng đã khép (`dai_ly_chi_tra`), mỗi đại lý
-- mỗi tháng một lần.
--
-- Hai đại lý mẫu (`la_mau`) nhận một phần cố định của đơn web trong lịch sử
-- mẫu (092, mã bắt đầu de000000) theo băm của mã đơn, tính ngay lúc đọc: lịch
-- sử mẫu trượt theo tháng thì phần của đại lý mẫu trượt theo, không phải gắn
-- lại. Màn hình ghi rõ "đại lý mẫu".
--
-- Đại lý xem cổng của mình bằng đường dẫn có khoá; kho chỉ giữ băm SHA-256
-- của khoá (`khoa_bam`).

begin;

create table public.dai_ly (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  ma text not null check (ma ~ '^[A-Z0-9]{4,16}$'),
  ten text not null check (char_length(btrim(ten)) between 2 and 120),
  nguoi_lien_he text check (nguoi_lien_he is null or char_length(nguoi_lien_he) <= 80),
  dien_thoai text check (dien_thoai is null or dien_thoai ~ '^[0-9 +.-]{6,20}$'),
  ty_le_hoa_hong numeric(4, 2) not null check (ty_le_hoa_hong >= 0 and ty_le_hoa_hong <= 30),
  khoa_bam text check (khoa_bam is null or khoa_bam ~ '^[0-9a-f]{64}$'),
  trang_thai text not null default 'hop-tac' check (trang_thai in ('hop-tac', 'tam-ngung')),
  la_mau boolean not null default false,
  mau_tu smallint check (mau_tu is null or mau_tu between 0 and 99),
  mau_den smallint check (mau_den is null or mau_den between 1 and 100),
  tao_luc timestamptz not null default now(),
  tao_boi text,
  cap_nhat_luc timestamptz not null default now(),
  unique (tenant_id, ma),
  unique (id, tenant_id)
);

create table public.dai_ly_don (
  order_id uuid primary key,
  tenant_id uuid not null,
  dai_ly_id uuid not null,
  gan_luc timestamptz not null default now(),
  foreign key (order_id, tenant_id) references public.customer_orders(id, tenant_id) on delete cascade,
  foreign key (dai_ly_id, tenant_id) references public.dai_ly(id, tenant_id) on delete restrict
);
create index dai_ly_don_dai_ly on public.dai_ly_don (tenant_id, dai_ly_id);

create table public.dai_ly_chi_tra (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  dai_ly_id uuid not null,
  thang date not null check (extract(day from thang) = 1),
  so_tien bigint not null check (so_tien >= 0),
  ghi_chu text check (ghi_chu is null or char_length(ghi_chu) <= 200),
  tao_luc timestamptz not null default now(),
  tao_boi text not null,
  foreign key (dai_ly_id, tenant_id) references public.dai_ly(id, tenant_id) on delete restrict,
  unique (dai_ly_id, thang)
);

alter table public.dai_ly enable row level security;
alter table public.dai_ly_don enable row level security;
alter table public.dai_ly_chi_tra enable row level security;
revoke all on table public.dai_ly, public.dai_ly_don, public.dai_ly_chi_tra from public, anon, authenticated;
grant select, insert, update on table public.dai_ly to service_role;
grant select, insert on table public.dai_ly_don to service_role;
grant select, insert on table public.dai_ly_chi_tra to service_role;

insert into public.dai_ly (tenant_id, ma, ten, nguoi_lien_he, ty_le_hoa_hong, la_mau, mau_tu, mau_den, tao_boi)
values
  ('00000000-0000-4000-8000-000000000001', 'HONGHA', 'Lữ hành Hồng Hà (đại lý mẫu)', 'Chị Lan', 8, true, 0, 12, 'he-thong'),
  ('00000000-0000-4000-8000-000000000001', 'VANLONG', 'Homestay Vân Long (đại lý mẫu)', 'Anh Tùng', 5, true, 12, 19, 'he-thong')
on conflict do nothing;

-- Đơn thuộc đại lý: dòng ghi thật, cộng phần băm của lịch sử mẫu cho đại lý mẫu.
create or replace function public.dai_ly_don_thuoc(p_tenant_id uuid)
returns table (order_id uuid, dai_ly_id uuid, la_mau boolean)
language sql
stable
security definer
set search_path = ''
as $ham$
  select link.order_id, link.dai_ly_id, false
  from public.dai_ly_don link
  where link.tenant_id = p_tenant_id
  union all
  select orders.id, agency.id, true
  from public.customer_orders orders
  join public.dai_ly agency
    on agency.tenant_id = orders.tenant_id and agency.la_mau
    and agency.mau_tu is not null and agency.mau_den is not null
    and (pg_catalog.abs(pg_catalog.hashtext(orders.id::text)) % 100) >= agency.mau_tu
    and (pg_catalog.abs(pg_catalog.hashtext(orders.id::text)) % 100) < agency.mau_den
  where orders.tenant_id = p_tenant_id
    and orders.id::text like 'de000000%'
    and not exists (select 1 from public.dai_ly_don link where link.order_id = orders.id);
$ham$;

-- Từng đơn của đại lý kèm "đã có khách qua cổng chưa".
create or replace function public.dai_ly_don_chi_tiet(p_tenant_id uuid, p_tu date, p_den date)
returns table (
  dai_ly_id uuid, order_id uuid, order_code text, visit_date date, party_size integer,
  total_vnd integer, status text, created_at timestamptz, da_toi boolean, la_mau boolean
)
language sql
stable
security definer
set search_path = ''
as $ham$
  select thuoc.dai_ly_id, orders.id, orders.order_code, orders.visit_date, orders.party_size,
    orders.total_vnd, orders.status, orders.created_at,
    exists (
      select 1
      from public.customer_order_tickets bridge
      join public.erp_gate_scan_events scan
        on scan.ticket_id = bridge.ticket_id and scan.tenant_id = bridge.tenant_id and scan.result = 'accepted'
      where bridge.order_id = orders.id and bridge.tenant_id = orders.tenant_id
    ),
    thuoc.la_mau
  from public.dai_ly_don_thuoc(p_tenant_id) thuoc
  join public.customer_orders orders on orders.id = thuoc.order_id and orders.tenant_id = p_tenant_id
  where orders.visit_date >= p_tu and orders.visit_date < p_den;
$ham$;

-- Bảng hoa hồng một tháng (theo ngày đi), mỗi đại lý một dòng.
create or replace function public.erp_dai_ly_thang(p_tenant_id uuid, p_thang date)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $ham$
  with don as (
    select * from public.dai_ly_don_chi_tiet(
      p_tenant_id, date_trunc('month', p_thang)::date, (date_trunc('month', p_thang) + interval '1 month')::date)
    where status = 'confirmed'
  )
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'id', agency.id, 'ma', agency.ma, 'ten', agency.ten, 'nguoi_lien_he', agency.nguoi_lien_he,
    'dien_thoai', agency.dien_thoai, 'ty_le', agency.ty_le_hoa_hong, 'trang_thai', agency.trang_thai,
    'la_mau', agency.la_mau, 'co_khoa', agency.khoa_bam is not null,
    'don', (select count(*) from don where don.dai_ly_id = agency.id),
    'khach', (select coalesce(sum(party_size), 0) from don where don.dai_ly_id = agency.id),
    'doanh_thu', (select coalesce(sum(total_vnd), 0) from don where don.dai_ly_id = agency.id),
    'don_toi', (select count(*) from don where don.dai_ly_id = agency.id and don.da_toi),
    'khach_toi', (select coalesce(sum(party_size), 0) from don where don.dai_ly_id = agency.id and don.da_toi),
    'doanh_thu_toi', (select coalesce(sum(total_vnd), 0) from don where don.dai_ly_id = agency.id and don.da_toi),
    'hoa_hong', (select pg_catalog.round(coalesce(sum(total_vnd), 0) * agency.ty_le_hoa_hong / 100)
      from don where don.dai_ly_id = agency.id and don.da_toi),
    'da_chi', (select so_tien from public.dai_ly_chi_tra chi
      where chi.dai_ly_id = agency.id and chi.thang = date_trunc('month', p_thang)::date),
    'chi_luc', (select tao_luc from public.dai_ly_chi_tra chi
      where chi.dai_ly_id = agency.id and chi.thang = date_trunc('month', p_thang)::date)
  ) order by agency.la_mau, agency.tao_luc), '[]'::jsonb)
  from public.dai_ly agency
  where agency.tenant_id = p_tenant_id;
$ham$;

-- Các đơn gần đây của một đại lý (cho cổng đại lý và màn chi tiết ERP).
create or replace function public.dai_ly_don_gan_day(p_tenant_id uuid, p_dai_ly_id uuid, p_gioi_han integer)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $ham$
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'order_code', chon.order_code, 'visit_date', chon.visit_date, 'party_size', chon.party_size,
    'total_vnd', chon.total_vnd, 'status', chon.status, 'da_toi', chon.da_toi, 'la_mau', chon.la_mau,
    'created_at', chon.created_at
  ) order by chon.created_at desc), '[]'::jsonb)
  from (
    select * from public.dai_ly_don_chi_tiet(p_tenant_id, (public.hang_cho_ngay_vn() - 120), (public.hang_cho_ngay_vn() + 400))
    where dai_ly_id = p_dai_ly_id
    order by created_at desc
    limit least(greatest(coalesce(p_gioi_han, 20), 1), 100)
  ) chon;
$ham$;

-- Khách tới qua /dl/<mã>: đại lý còn hợp tác thì trả tên, không thì null.
create or replace function public.dai_ly_con_hop_tac(p_tenant_id uuid, p_ma text)
returns text
language sql
stable
security definer
set search_path = ''
as $ham$
  select ten from public.dai_ly
  where tenant_id = p_tenant_id and ma = p_ma and trang_thai = 'hop-tac';
$ham$;

-- Ghi đơn vừa giữ chỗ cho đại lý. Chỉ đơn mới (trong 2 giờ), chỉ một lần.
create or replace function public.dai_ly_gan_don(p_tenant_id uuid, p_ma text, p_order_id uuid)
returns boolean
language sql
security definer
set search_path = ''
as $ham$
  with gan as (
    insert into public.dai_ly_don (order_id, tenant_id, dai_ly_id)
    select orders.id, orders.tenant_id, agency.id
    from public.customer_orders orders
    join public.dai_ly agency on agency.tenant_id = orders.tenant_id and agency.ma = p_ma and agency.trang_thai = 'hop-tac'
    where orders.id = p_order_id and orders.tenant_id = p_tenant_id
      and orders.created_at >= pg_catalog.now() - interval '2 hours'
    on conflict (order_id) do nothing
    returning 1
  )
  select exists (select 1 from gan);
$ham$;

-- Cổng đại lý: đúng mã và đúng khoá thì trả hồ sơ đại lý.
create or replace function public.dai_ly_mo_cong(p_tenant_id uuid, p_ma text, p_khoa_bam text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $ham$
  select pg_catalog.jsonb_build_object('id', id, 'ma', ma, 'ten', ten, 'ty_le', ty_le_hoa_hong, 'trang_thai', trang_thai, 'la_mau', la_mau)
  from public.dai_ly
  where tenant_id = p_tenant_id and ma = p_ma and khoa_bam is not null and khoa_bam = p_khoa_bam;
$ham$;

create or replace function public.erp_dai_ly_tao(
  p_tenant_id uuid, p_ma text, p_ten text, p_nguoi_lien_he text, p_dien_thoai text,
  p_ty_le numeric, p_khoa_bam text, p_nguoi text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $ham$
declare
  v_id uuid;
begin
  insert into public.dai_ly (tenant_id, ma, ten, nguoi_lien_he, dien_thoai, ty_le_hoa_hong, khoa_bam, tao_boi)
  values (p_tenant_id, p_ma, pg_catalog.btrim(p_ten), nullif(pg_catalog.btrim(p_nguoi_lien_he), ''),
    nullif(pg_catalog.btrim(p_dien_thoai), ''), p_ty_le, p_khoa_bam, p_nguoi)
  returning id into v_id;
  return v_id;
exception when unique_violation then
  raise exception using errcode = '23505', message = 'DAI_LY_TRUNG_MA';
end;
$ham$;

create or replace function public.erp_dai_ly_cap_nhat(
  p_tenant_id uuid, p_id uuid, p_ty_le numeric, p_trang_thai text, p_khoa_bam text
)
returns boolean
language sql
security definer
set search_path = ''
as $ham$
  with doi as (
    update public.dai_ly
    set ty_le_hoa_hong = coalesce(p_ty_le, ty_le_hoa_hong),
      trang_thai = coalesce(p_trang_thai, trang_thai),
      khoa_bam = coalesce(p_khoa_bam, khoa_bam),
      cap_nhat_luc = pg_catalog.now()
    where id = p_id and tenant_id = p_tenant_id
    returning 1
  )
  select exists (select 1 from doi);
$ham$;

-- Ghi đã chi hoa hồng một tháng đã khép. Số tiền lấy đúng số kho tính ra lúc
-- ghi, không nhận số gõ tay.
create or replace function public.erp_dai_ly_ghi_chi(
  p_tenant_id uuid, p_id uuid, p_thang date, p_ghi_chu text, p_nguoi text
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $ham$
declare
  v_thang date := date_trunc('month', p_thang)::date;
  v_so bigint;
begin
  if v_thang >= date_trunc('month', public.hang_cho_ngay_vn())::date then
    raise exception using errcode = '22023', message = 'DAI_LY_THANG_CHUA_KHEP';
  end if;
  select (item ->> 'hoa_hong')::bigint into v_so
  from pg_catalog.jsonb_array_elements(public.erp_dai_ly_thang(p_tenant_id, v_thang)) item
  where item ->> 'id' = p_id::text;
  if v_so is null then
    raise exception using errcode = 'P0002', message = 'DAI_LY_KHONG_CO';
  end if;
  insert into public.dai_ly_chi_tra (tenant_id, dai_ly_id, thang, so_tien, ghi_chu, tao_boi)
  values (p_tenant_id, p_id, v_thang, v_so, nullif(pg_catalog.btrim(p_ghi_chu), ''), p_nguoi);
  return v_so;
exception when unique_violation then
  raise exception using errcode = '23505', message = 'DAI_LY_DA_CHI';
end;
$ham$;

revoke all on function public.dai_ly_don_thuoc(uuid) from public, anon, authenticated;
revoke all on function public.dai_ly_don_chi_tiet(uuid, date, date) from public, anon, authenticated;
revoke all on function public.erp_dai_ly_thang(uuid, date) from public, anon, authenticated;
revoke all on function public.dai_ly_don_gan_day(uuid, uuid, integer) from public, anon, authenticated;
revoke all on function public.dai_ly_con_hop_tac(uuid, text) from public, anon, authenticated;
revoke all on function public.dai_ly_gan_don(uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.dai_ly_mo_cong(uuid, text, text) from public, anon, authenticated;
revoke all on function public.erp_dai_ly_tao(uuid, text, text, text, text, numeric, text, text) from public, anon, authenticated;
revoke all on function public.erp_dai_ly_cap_nhat(uuid, uuid, numeric, text, text) from public, anon, authenticated;
revoke all on function public.erp_dai_ly_ghi_chi(uuid, uuid, date, text, text) from public, anon, authenticated;
grant execute on function public.dai_ly_don_thuoc(uuid) to service_role;
grant execute on function public.dai_ly_don_chi_tiet(uuid, date, date) to service_role;
grant execute on function public.erp_dai_ly_thang(uuid, date) to service_role;
grant execute on function public.dai_ly_don_gan_day(uuid, uuid, integer) to service_role;
grant execute on function public.dai_ly_con_hop_tac(uuid, text) to service_role;
grant execute on function public.dai_ly_gan_don(uuid, text, uuid) to service_role;
grant execute on function public.dai_ly_mo_cong(uuid, text, text) to service_role;
grant execute on function public.erp_dai_ly_tao(uuid, text, text, text, text, numeric, text, text) to service_role;
grant execute on function public.erp_dai_ly_cap_nhat(uuid, uuid, numeric, text, text) to service_role;
grant execute on function public.erp_dai_ly_ghi_chi(uuid, uuid, date, text, text) to service_role;

commit;
