-- Thuyền trên sông: vị trí thuyền của từng người chèo đò, xem trên bản đồ sống
-- (chủ dự án duyệt "cách A" ngày 03/10/2026: dùng điện thoại người chèo).
--
-- Người chèo mở `/erp/thuyen`, bấm "Bắt đầu chuyến": điện thoại gửi vị trí vài
-- giây một lần cho tới khi bấm "Về bến". Quản lý cơ sở và giám đốc xem bản đồ
-- sống ở màn Sức chứa của Tràng An, Tam Cốc.
--
-- Vị trí nhân viên là dữ liệu cá nhân, nên luật nằm ngay trong kho:
-- - chỉ ghi khi chuyến đang mở, và chỉ đúng người chèo của chuyến ấy được gửi;
-- - mỗi chuyến tối đa một điểm mỗi 3 giây; điểm sai số trên 200 m bị bỏ;
-- - chuyến quá 6 giờ coi như đã về bến (quên bấm), thôi nhận vị trí;
-- - điểm cũ hơn 2 ngày tự xoá mỗi lần có điểm mới, không cần lịch chạy.
-- Không có hàm xem lịch sử đi lại của một người: bản đồ chỉ đọc chuyến đang mở
-- và vệt 20 phút gần nhất.

begin;

create table public.erp_chuyen_thuyen (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete restrict,
  account_id text not null,
  so_thuyen text not null check (char_length(btrim(so_thuyen)) between 1 and 20),
  so_khach smallint not null default 0 check (so_khach between 0 and 12),
  bat_dau timestamptz not null default now(),
  ket_thuc timestamptz,
  foreign key (account_id, tenant_id)
    references public.erp_account_registry(account_id, tenant_id) on delete restrict
);
-- Mỗi người chỉ một chuyến đang mở.
create unique index erp_chuyen_thuyen_mot_chuyen_mo
  on public.erp_chuyen_thuyen (tenant_id, account_id) where ket_thuc is null;
create index erp_chuyen_thuyen_dang_mo
  on public.erp_chuyen_thuyen (tenant_id, site_id) where ket_thuc is null;

create table public.erp_vi_tri_thuyen (
  id bigint generated always as identity primary key,
  chuyen_id uuid not null references public.erp_chuyen_thuyen(id) on delete cascade,
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  do_chinh_xac real check (do_chinh_xac is null or do_chinh_xac >= 0),
  toc_do real,
  huong real,
  ghi_luc timestamptz not null default now()
);
create index erp_vi_tri_thuyen_theo_chuyen on public.erp_vi_tri_thuyen (chuyen_id, ghi_luc desc);
create index erp_vi_tri_thuyen_theo_luc on public.erp_vi_tri_thuyen (ghi_luc);

alter table public.erp_chuyen_thuyen enable row level security;
alter table public.erp_vi_tri_thuyen enable row level security;
revoke all on table public.erp_chuyen_thuyen, public.erp_vi_tri_thuyen from public, anon, authenticated;
grant select, insert, update on table public.erp_chuyen_thuyen to service_role;
grant select, insert, delete on table public.erp_vi_tri_thuyen to service_role;

-- Bắt đầu một chuyến. Đang có chuyến mở thì trả lại chính chuyến ấy (bấm hai lần
-- hay mở lại trang không đẻ chuyến thứ hai).
create or replace function public.erp_thuyen_bat_dau(
  p_tenant_id uuid, p_site_id uuid, p_account_id text, p_so_thuyen text, p_so_khach integer
)
returns public.erp_chuyen_thuyen
language plpgsql
security definer
set search_path = ''
as $ham$
declare
  v_chuyen public.erp_chuyen_thuyen;
begin
  update public.erp_chuyen_thuyen set ket_thuc = bat_dau + interval '6 hours'
  where tenant_id = p_tenant_id and account_id = p_account_id and ket_thuc is null
    and bat_dau < now() - interval '6 hours';

  select * into v_chuyen from public.erp_chuyen_thuyen
  where tenant_id = p_tenant_id and account_id = p_account_id and ket_thuc is null;
  if v_chuyen.id is not null then
    return v_chuyen;
  end if;

  insert into public.erp_chuyen_thuyen (tenant_id, site_id, account_id, so_thuyen, so_khach)
  values (p_tenant_id, p_site_id, p_account_id, pg_catalog.upper(pg_catalog.btrim(p_so_thuyen)),
    greatest(0, least(12, coalesce(p_so_khach, 0))))
  returning * into v_chuyen;
  return v_chuyen;
end;
$ham$;

-- Ghi một điểm vị trí. Trả true nếu đã ghi, false nếu bỏ qua (quá dày, sai số
-- lớn). Chuyến không mở hoặc không phải của người gửi thì báo lỗi.
create or replace function public.erp_thuyen_gui_vi_tri(
  p_tenant_id uuid, p_chuyen_id uuid, p_account_id text,
  p_lat double precision, p_lng double precision,
  p_do_chinh_xac real, p_toc_do real, p_huong real
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $ham$
declare
  v_chuyen public.erp_chuyen_thuyen;
  v_cuoi timestamptz;
begin
  select * into v_chuyen from public.erp_chuyen_thuyen
  where id = p_chuyen_id and tenant_id = p_tenant_id;
  if v_chuyen.id is null or v_chuyen.account_id <> p_account_id then
    raise exception using errcode = 'P0002', message = 'THUYEN_KHONG_CO_CHUYEN';
  end if;
  if v_chuyen.ket_thuc is not null or v_chuyen.bat_dau < now() - interval '6 hours' then
    raise exception using errcode = '22023', message = 'THUYEN_CHUYEN_DA_DONG';
  end if;
  if p_lat is null or p_lng is null or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception using errcode = '22023', message = 'THUYEN_VI_TRI_SAI';
  end if;
  if p_do_chinh_xac is not null and p_do_chinh_xac > 200 then
    return false;
  end if;
  select max(ghi_luc) into v_cuoi from public.erp_vi_tri_thuyen where chuyen_id = p_chuyen_id;
  if v_cuoi is not null and v_cuoi > now() - interval '3 seconds' then
    return false;
  end if;

  insert into public.erp_vi_tri_thuyen (chuyen_id, lat, lng, do_chinh_xac, toc_do, huong)
  values (p_chuyen_id, p_lat, p_lng, p_do_chinh_xac, p_toc_do, p_huong);

  delete from public.erp_vi_tri_thuyen where ghi_luc < now() - interval '2 days';
  return true;
end;
$ham$;

create or replace function public.erp_thuyen_ve_ben(p_tenant_id uuid, p_chuyen_id uuid, p_account_id text)
returns public.erp_chuyen_thuyen
language plpgsql
security definer
set search_path = ''
as $ham$
declare
  v_chuyen public.erp_chuyen_thuyen;
begin
  update public.erp_chuyen_thuyen set ket_thuc = now()
  where id = p_chuyen_id and tenant_id = p_tenant_id and account_id = p_account_id and ket_thuc is null
  returning * into v_chuyen;
  if v_chuyen.id is null then
    select * into v_chuyen from public.erp_chuyen_thuyen
    where id = p_chuyen_id and tenant_id = p_tenant_id and account_id = p_account_id;
    if v_chuyen.id is null then
      raise exception using errcode = 'P0002', message = 'THUYEN_KHONG_CO_CHUYEN';
    end if;
  end if;
  return v_chuyen;
end;
$ham$;

-- Bản đồ sống: các chuyến đang mở ở một cơ sở, mỗi chuyến kèm vệt 20 phút gần
-- nhất (tối đa 240 điểm) và tên người chèo.
create or replace function public.erp_thuyen_tren_song(p_tenant_id uuid, p_site_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $ham$
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'id', chuyen.id,
    'so_thuyen', chuyen.so_thuyen,
    'so_khach', chuyen.so_khach,
    'bat_dau', chuyen.bat_dau,
    'nguoi_cheo', account.display_name,
    'vet', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'lat', diem.lat, 'lng', diem.lng, 'luc', diem.ghi_luc, 'do_chinh_xac', diem.do_chinh_xac
      ) order by diem.ghi_luc)
      from (
        select * from public.erp_vi_tri_thuyen vt
        where vt.chuyen_id = chuyen.id and vt.ghi_luc > now() - interval '20 minutes'
        order by vt.ghi_luc desc
        limit 240
      ) diem
    ), '[]'::jsonb)
  ) order by chuyen.bat_dau), '[]'::jsonb)
  from public.erp_chuyen_thuyen chuyen
  join public.erp_account_registry account
    on account.account_id = chuyen.account_id and account.tenant_id = chuyen.tenant_id
  where chuyen.tenant_id = p_tenant_id and chuyen.site_id = p_site_id
    and chuyen.ket_thuc is null and chuyen.bat_dau > now() - interval '6 hours';
$ham$;

-- Chuyến đang mở của một người (để trang người chèo mở lại đúng chuyến).
create or replace function public.erp_thuyen_chuyen_cua_toi(p_tenant_id uuid, p_account_id text)
returns public.erp_chuyen_thuyen
language sql
stable
security definer
set search_path = ''
as $ham$
  select * from public.erp_chuyen_thuyen
  where tenant_id = p_tenant_id and account_id = p_account_id and ket_thuc is null
    and bat_dau > now() - interval '6 hours'
  limit 1;
$ham$;

revoke all on function public.erp_thuyen_bat_dau(uuid, uuid, text, text, integer) from public, anon, authenticated;
revoke all on function public.erp_thuyen_gui_vi_tri(uuid, uuid, text, double precision, double precision, real, real, real) from public, anon, authenticated;
revoke all on function public.erp_thuyen_ve_ben(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.erp_thuyen_tren_song(uuid, uuid) from public, anon, authenticated;
revoke all on function public.erp_thuyen_chuyen_cua_toi(uuid, text) from public, anon, authenticated;
grant execute on function public.erp_thuyen_bat_dau(uuid, uuid, text, text, integer) to service_role;
grant execute on function public.erp_thuyen_gui_vi_tri(uuid, uuid, text, double precision, double precision, real, real, real) to service_role;
grant execute on function public.erp_thuyen_ve_ben(uuid, uuid, text) to service_role;
grant execute on function public.erp_thuyen_tren_song(uuid, uuid) to service_role;
grant execute on function public.erp_thuyen_chuyen_cua_toi(uuid, text) to service_role;

commit;
