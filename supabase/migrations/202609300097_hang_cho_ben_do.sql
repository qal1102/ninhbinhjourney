-- Hàng chờ ảo ở bến đò (tài liệu khách hàng: "hàng chờ ảo Tam Cốc").
--
-- Khách tới bến quét mã dán ở bến (hay mở /xep-hang/tam-coc), lấy một số thứ
-- tự trên điện thoại rồi đi dạo; trang tự báo còn bao nhiêu nhóm phía trước,
-- chờ chừng bao lâu, và báo to khi tới lượt. Nhân viên bến gọi lượt trong ERP
-- (màn Sức chứa của cơ sở).
--
-- Khách không đăng nhập. Máy chủ phát cho khách một chuỗi bí mật ngẫu nhiên;
-- kho chỉ giữ băm SHA-256 của chuỗi ấy (`ma_bam`), nên đọc được bảng cũng
-- không mạo danh được khách. Mỗi máy (băm mã máy, `may_bam`) chỉ giữ một số
-- còn hiệu lực một lúc, để một người không lấy cả chục số chiếm chỗ.
--
-- Số thứ tự đánh lại từ 1 mỗi ngày theo giờ Việt Nam. Lượt của ngày cũ còn
-- "cho" không bị ai đọc nữa (mọi hàm chỉ nhìn ngày hôm nay), không cần dọn.

begin;

create table public.hang_cho_cau_hinh (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  dang_nhan boolean not null default true,
  loi_tam_dung text check (loi_tam_dung is null or char_length(loi_tam_dung) <= 200),
  -- Tốc độ lên thuyền khi chưa đo được (khách mỗi phút). Tam Cốc: 300
  -- khách/giờ theo ngưỡng sức chứa bến đò = 5 khách/phút.
  khach_moi_phut numeric(6, 2) not null default 5 check (khach_moi_phut > 0 and khach_moi_phut <= 100),
  phut_giu_luot smallint not null default 10 check (phut_giu_luot between 3 and 60),
  cap_nhat_luc timestamptz not null default now(),
  cap_nhat_boi text,
  primary key (tenant_id, site_id)
);

create table public.hang_cho_luot (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  ngay date not null,
  so_thu_tu integer not null check (so_thu_tu > 0),
  so_khach smallint not null check (so_khach between 1 and 6),
  ngon_ngu text not null default 'vi' check (ngon_ngu in ('vi', 'en')),
  ma_bam text not null unique check (ma_bam ~ '^[0-9a-f]{64}$'),
  may_bam text not null check (may_bam ~ '^[0-9a-f]{64}$'),
  trang_thai text not null default 'cho'
    check (trang_thai in ('cho', 'da-goi', 'da-len', 'bo-luot', 'khach-huy')),
  tao_luc timestamptz not null default now(),
  goi_luc timestamptz,
  xong_luc timestamptz,
  nguoi_xu_ly text,
  unique (tenant_id, site_id, ngay, so_thu_tu)
);

create index hang_cho_luot_hom_nay on public.hang_cho_luot (tenant_id, site_id, ngay, trang_thai, so_thu_tu);
create index hang_cho_luot_may on public.hang_cho_luot (may_bam, ngay);

alter table public.hang_cho_cau_hinh enable row level security;
alter table public.hang_cho_luot enable row level security;
revoke all on table public.hang_cho_cau_hinh from public, anon, authenticated;
revoke all on table public.hang_cho_luot from public, anon, authenticated;
grant select, insert, update on table public.hang_cho_cau_hinh to service_role;
grant select, insert, update on table public.hang_cho_luot to service_role;

-- Bến đò Tam Cốc là nơi duy nhất có hàng chờ lúc này.
insert into public.hang_cho_cau_hinh (tenant_id, site_id)
values ('00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000005')
on conflict do nothing;

create or replace function public.hang_cho_ngay_vn()
returns date
language sql
stable
set search_path = ''
as $ham$
  select (pg_catalog.now() at time zone 'Asia/Ho_Chi_Minh')::date;
$ham$;

-- Ảnh chụp hàng chờ hôm nay: đủ cho trang khách và màn ERP tự tính giờ chờ.
-- Tốc độ đo = số khách đã lên thuyền trong 30 phút qua; ít hơn 6 khách thì
-- dùng tốc độ khai trong cấu hình (đo trên vài khách là đoán mò).
create or replace function public.hang_cho_tong_quan(p_tenant_id uuid, p_site_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $ham$
  with cau_hinh as (
    select * from public.hang_cho_cau_hinh
    where tenant_id = p_tenant_id and site_id = p_site_id
  ),
  hom_nay as (
    select * from public.hang_cho_luot
    where tenant_id = p_tenant_id and site_id = p_site_id and ngay = public.hang_cho_ngay_vn()
  )
  select case when not exists (select 1 from cau_hinh) then null else pg_catalog.jsonb_build_object(
    'dang_nhan', (select dang_nhan from cau_hinh),
    'loi_tam_dung', (select loi_tam_dung from cau_hinh),
    'khach_moi_phut_khai', (select khach_moi_phut from cau_hinh),
    'phut_giu_luot', (select phut_giu_luot from cau_hinh),
    'so_nhom_cho', (select count(*) from hom_nay where trang_thai = 'cho'),
    'so_khach_cho', (select coalesce(sum(so_khach), 0) from hom_nay where trang_thai = 'cho'),
    'dang_goi', coalesce((select pg_catalog.jsonb_agg(so_thu_tu order by so_thu_tu) from hom_nay where trang_thai = 'da-goi'), '[]'::jsonb),
    'goi_toi_so', (select max(so_thu_tu) from hom_nay where trang_thai in ('da-goi', 'da-len', 'bo-luot')),
    'so_cap', (select max(so_thu_tu) from hom_nay),
    'khach_len_30_phut', (select coalesce(sum(so_khach), 0) from hom_nay
      where trang_thai = 'da-len' and xong_luc >= pg_catalog.now() - interval '30 minutes'),
    'da_len_hom_nay', (select coalesce(sum(so_khach), 0) from hom_nay where trang_thai = 'da-len'),
    'nhom_da_len', (select count(*) from hom_nay where trang_thai = 'da-len'),
    'nhom_bo_luot', (select count(*) from hom_nay where trang_thai = 'bo-luot'),
    'nhom_huy', (select count(*) from hom_nay where trang_thai = 'khach-huy'),
    'phut_cho_tb', (select round(avg(extract(epoch from (goi_luc - tao_luc)) / 60)::numeric, 1)
      from hom_nay where goi_luc is not null)
  ) end;
$ham$;

create or replace function public.hang_cho_lay_so(
  p_tenant_id uuid,
  p_site_id uuid,
  p_so_khach integer,
  p_ngon_ngu text,
  p_ma_bam text,
  p_may_bam text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $ham$
declare
  v_cau_hinh public.hang_cho_cau_hinh%rowtype;
  v_ngay date := public.hang_cho_ngay_vn();
  v_cu public.hang_cho_luot%rowtype;
  v_so integer;
  v_id uuid;
begin
  -- Khoá dòng cấu hình: hai khách bấm cùng lúc không nhận trùng số.
  select * into v_cau_hinh from public.hang_cho_cau_hinh
  where tenant_id = p_tenant_id and site_id = p_site_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'HANG_CHO_KHONG_CO';
  end if;
  if not v_cau_hinh.dang_nhan then
    raise exception using errcode = 'P0001', message = 'HANG_CHO_TAM_DUNG';
  end if;
  if p_so_khach is null or p_so_khach < 1 or p_so_khach > 6 then
    raise exception using errcode = '22023', message = 'HANG_CHO_SO_KHACH';
  end if;

  -- Máy này đang giữ một số còn hiệu lực thì trả lại đúng số đó.
  select * into v_cu from public.hang_cho_luot
  where may_bam = p_may_bam and ngay = v_ngay and site_id = p_site_id
    and trang_thai in ('cho', 'da-goi')
  order by so_thu_tu desc limit 1;
  if found then
    return pg_catalog.jsonb_build_object('id', v_cu.id, 'so_thu_tu', v_cu.so_thu_tu, 'da_co', true);
  end if;

  if (select count(*) from public.hang_cho_luot
      where tenant_id = p_tenant_id and site_id = p_site_id and ngay = v_ngay and trang_thai = 'cho') >= 400 then
    raise exception using errcode = 'P0001', message = 'HANG_CHO_DAY';
  end if;

  select coalesce(max(so_thu_tu), 0) + 1 into v_so from public.hang_cho_luot
  where tenant_id = p_tenant_id and site_id = p_site_id and ngay = v_ngay;

  insert into public.hang_cho_luot (tenant_id, site_id, ngay, so_thu_tu, so_khach, ngon_ngu, ma_bam, may_bam)
  values (p_tenant_id, p_site_id, v_ngay, v_so, p_so_khach,
    case when p_ngon_ngu = 'en' then 'en' else 'vi' end, p_ma_bam, p_may_bam)
  returning id into v_id;
  return pg_catalog.jsonb_build_object('id', v_id, 'so_thu_tu', v_so, 'da_co', false);
end;
$ham$;

-- Khách xem lượt của mình. Lượt ngày cũ trả về như đã hết hạn.
create or replace function public.hang_cho_xem(p_ma_bam text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $ham$
  select pg_catalog.jsonb_build_object(
    'so_thu_tu', luot.so_thu_tu,
    'so_khach', luot.so_khach,
    'trang_thai', case when luot.ngay < public.hang_cho_ngay_vn() and luot.trang_thai in ('cho', 'da-goi')
      then 'het-ngay' else luot.trang_thai end,
    'tao_luc', luot.tao_luc,
    'goi_luc', luot.goi_luc,
    'nhom_truoc', (select count(*) from public.hang_cho_luot truoc
      where truoc.tenant_id = luot.tenant_id and truoc.site_id = luot.site_id and truoc.ngay = luot.ngay
        and truoc.trang_thai = 'cho' and truoc.so_thu_tu < luot.so_thu_tu),
    'khach_truoc', (select coalesce(sum(truoc.so_khach), 0) from public.hang_cho_luot truoc
      where truoc.tenant_id = luot.tenant_id and truoc.site_id = luot.site_id and truoc.ngay = luot.ngay
        and truoc.trang_thai = 'cho' and truoc.so_thu_tu < luot.so_thu_tu),
    'site_id', luot.site_id,
    'tong_quan', public.hang_cho_tong_quan(luot.tenant_id, luot.site_id)
  )
  from public.hang_cho_luot luot
  where luot.ma_bam = p_ma_bam;
$ham$;

create or replace function public.hang_cho_huy(p_ma_bam text)
returns boolean
language sql
security definer
set search_path = ''
as $ham$
  with doi as (
    update public.hang_cho_luot
    set trang_thai = 'khach-huy', xong_luc = pg_catalog.now()
    where ma_bam = p_ma_bam and trang_thai in ('cho', 'da-goi')
    returning 1
  )
  select exists (select 1 from doi);
$ham$;

-- ERP: gọi n nhóm kế tiếp theo đúng thứ tự số.
create or replace function public.erp_hang_cho_goi(
  p_tenant_id uuid,
  p_site_id uuid,
  p_so_nhom integer,
  p_nguoi text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $ham$
declare
  v_so integer;
begin
  if p_so_nhom is null or p_so_nhom < 1 or p_so_nhom > 20 then
    raise exception using errcode = '22023', message = 'HANG_CHO_SO_NHOM';
  end if;
  perform 1 from public.hang_cho_cau_hinh
  where tenant_id = p_tenant_id and site_id = p_site_id for update;
  with ke_tiep as (
    select id from public.hang_cho_luot
    where tenant_id = p_tenant_id and site_id = p_site_id
      and ngay = public.hang_cho_ngay_vn() and trang_thai = 'cho'
    order by so_thu_tu
    limit p_so_nhom
  ), doi as (
    update public.hang_cho_luot luot
    set trang_thai = 'da-goi', goi_luc = pg_catalog.now(), nguoi_xu_ly = p_nguoi
    from ke_tiep where luot.id = ke_tiep.id
    returning 1
  )
  select count(*) into v_so from doi;
  return v_so;
end;
$ham$;

-- ERP: khép một lượt (đã lên thuyền / bỏ lượt), hay đưa lượt bỏ lỡ về gọi lại.
create or replace function public.erp_hang_cho_danh_dau(
  p_tenant_id uuid,
  p_site_id uuid,
  p_id uuid,
  p_trang_thai text,
  p_nguoi text
)
returns boolean
language sql
security definer
set search_path = ''
as $ham$
  with doi as (
    update public.hang_cho_luot
    set trang_thai = p_trang_thai,
      goi_luc = case when p_trang_thai = 'da-goi' then pg_catalog.now() else goi_luc end,
      xong_luc = case when p_trang_thai in ('da-len', 'bo-luot') then pg_catalog.now() else null end,
      nguoi_xu_ly = p_nguoi
    where id = p_id and tenant_id = p_tenant_id and site_id = p_site_id
      and ngay = public.hang_cho_ngay_vn()
      and (
        (p_trang_thai in ('da-len', 'bo-luot') and trang_thai = 'da-goi')
        or (p_trang_thai = 'da-goi' and trang_thai = 'bo-luot')
      )
    returning 1
  )
  select exists (select 1 from doi);
$ham$;

create or replace function public.erp_hang_cho_cai_dat(
  p_tenant_id uuid,
  p_site_id uuid,
  p_dang_nhan boolean,
  p_loi_tam_dung text,
  p_nguoi text
)
returns boolean
language sql
security definer
set search_path = ''
as $ham$
  with doi as (
    update public.hang_cho_cau_hinh
    set dang_nhan = p_dang_nhan,
      loi_tam_dung = case when p_dang_nhan then null else nullif(pg_catalog.btrim(p_loi_tam_dung), '') end,
      cap_nhat_luc = pg_catalog.now(),
      cap_nhat_boi = p_nguoi
    where tenant_id = p_tenant_id and site_id = p_site_id
    returning 1
  )
  select exists (select 1 from doi);
$ham$;

-- ERP: danh sách lượt hôm nay còn cần người để mắt (chờ, đã gọi, bỏ lượt) và
-- 20 lượt khép gần nhất.
create or replace function public.erp_hang_cho_danh_sach(p_tenant_id uuid, p_site_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $ham$
  select pg_catalog.jsonb_build_object(
    'tong_quan', public.hang_cho_tong_quan(p_tenant_id, p_site_id),
    'luot', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'id', chon.id, 'so_thu_tu', chon.so_thu_tu, 'so_khach', chon.so_khach,
        'ngon_ngu', chon.ngon_ngu, 'trang_thai', chon.trang_thai,
        'tao_luc', chon.tao_luc, 'goi_luc', chon.goi_luc, 'xong_luc', chon.xong_luc
      ) order by chon.so_thu_tu)
      from (
        select * from public.hang_cho_luot
        where tenant_id = p_tenant_id and site_id = p_site_id and ngay = public.hang_cho_ngay_vn()
          and trang_thai in ('cho', 'da-goi', 'bo-luot')
        union all
        select * from (
          select * from public.hang_cho_luot
          where tenant_id = p_tenant_id and site_id = p_site_id and ngay = public.hang_cho_ngay_vn()
            and trang_thai in ('da-len', 'khach-huy')
          order by xong_luc desc nulls last
          limit 20
        ) khep
      ) chon
    ), '[]'::jsonb)
  );
$ham$;

revoke all on function public.hang_cho_ngay_vn() from public, anon, authenticated;
revoke all on function public.hang_cho_tong_quan(uuid, uuid) from public, anon, authenticated;
revoke all on function public.hang_cho_lay_so(uuid, uuid, integer, text, text, text) from public, anon, authenticated;
revoke all on function public.hang_cho_xem(text) from public, anon, authenticated;
revoke all on function public.hang_cho_huy(text) from public, anon, authenticated;
revoke all on function public.erp_hang_cho_goi(uuid, uuid, integer, text) from public, anon, authenticated;
revoke all on function public.erp_hang_cho_danh_dau(uuid, uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.erp_hang_cho_cai_dat(uuid, uuid, boolean, text, text) from public, anon, authenticated;
revoke all on function public.erp_hang_cho_danh_sach(uuid, uuid) from public, anon, authenticated;
grant execute on function public.hang_cho_ngay_vn() to service_role;
grant execute on function public.hang_cho_tong_quan(uuid, uuid) to service_role;
grant execute on function public.hang_cho_lay_so(uuid, uuid, integer, text, text, text) to service_role;
grant execute on function public.hang_cho_xem(text) to service_role;
grant execute on function public.hang_cho_huy(text) to service_role;
grant execute on function public.erp_hang_cho_goi(uuid, uuid, integer, text) to service_role;
grant execute on function public.erp_hang_cho_danh_dau(uuid, uuid, uuid, text, text) to service_role;
grant execute on function public.erp_hang_cho_cai_dat(uuid, uuid, boolean, text, text) to service_role;
grant execute on function public.erp_hang_cho_danh_sach(uuid, uuid) to service_role;

commit;
