-- 116 — Người chèo giới thiệu khách và nhận hoa hồng.
--
-- Chủ dự án 07/10/2026: hồ sơ người chèo chưa đủ chi tiết, "họ recommend hoặc
-- sale thì có được hoa hồng không?". Không dựng sổ hoa hồng thứ hai: mỗi người
-- chèo được cấp một mã trong sổ đại lý (099), khách quét QR `/dl/<mã>` rồi đặt
-- thì đơn ghi cho người ấy, hoa hồng tính theo đúng luật `erp_dai_ly_thang`
-- (đơn đã trả, khách đã qua cổng, theo tháng ngày đi) và chi qua luồng bút toán
-- chờ kế toán trưởng duyệt (102).
--
-- 1. `dai_ly.loai`: 'dai-ly' (lữ hành, homestay) hay 'nguoi-cheo'.
-- 2. `erp_nguoi_cheo.dai_ly_id`: mã giới thiệu của người chèo, nếu đã cấp.
-- 3. `erp_nguoi_cheo_cap_ma`: giám đốc, quản lý bến cấp mã cho một người.
-- 4. Người chèo mẫu (111) mỗi người một mã mẫu, nhận 1% đơn mẫu qua đúng cơ
--    chế băm `mau_tu`/`mau_den` của đại lý mẫu — không thêm nguồn sinh mẫu nào.

begin;

alter table public.dai_ly
  add column loai text not null default 'dai-ly' check (loai in ('dai-ly', 'nguoi-cheo'));

alter table public.erp_nguoi_cheo add column dai_ly_id uuid;
alter table public.erp_nguoi_cheo
  add constraint erp_nguoi_cheo_dai_ly_fk
  foreign key (dai_ly_id, tenant_id) references public.dai_ly (id, tenant_id) on delete restrict;
create unique index erp_nguoi_cheo_mot_ma on public.erp_nguoi_cheo (dai_ly_id) where dai_ly_id is not null;

-- Mã gợi ý: DO + bến + số thuyền ("DOTA07", "DOTC12").
create or replace function public.nguoi_cheo_ma_goi_y(p_site_id uuid, p_so_thuyen text)
returns text
language sql
immutable
set search_path = ''
as $ham$
  -- `rpad` cắt bớt chuỗi dài hơn 4, nên chỉ đệm khi ngắn ("DOTA01" mà cắt là "DOTA").
  select pg_catalog.rpad(
    'DO'
      || case p_site_id
        when '10000000-0000-4000-8000-000000000001'::uuid then 'TA'
        when '10000000-0000-4000-8000-000000000005'::uuid then 'TC'
        else 'NB'
      end
      || pg_catalog.left(pg_catalog.upper(pg_catalog.regexp_replace(p_so_thuyen, '[^A-Za-z0-9]', '', 'g')), 10),
    greatest(4, pg_catalog.length('DO' || 'NB' || pg_catalog.left(pg_catalog.regexp_replace(p_so_thuyen, '[^A-Za-z0-9]', '', 'g'), 10))),
    '0');
$ham$;

create or replace function public.erp_nguoi_cheo_cap_ma(
  p_tenant_id uuid,
  p_nguoi_cheo_id uuid,
  p_ty_le numeric,
  p_tao_boi text
)
returns text
language plpgsql
security definer
set search_path = ''
as $ham$
declare
  v_nguoi public.erp_nguoi_cheo%rowtype;
  v_goc text;
  v_ma text;
  v_lan integer := 0;
  v_id uuid;
begin
  select * into v_nguoi from public.erp_nguoi_cheo
  where tenant_id = p_tenant_id and id = p_nguoi_cheo_id
  for update;
  if not found then
    raise exception 'NGUOI_CHEO_KHONG_CO' using errcode = 'P0002';
  end if;
  if v_nguoi.dai_ly_id is not null then
    return (select ma from public.dai_ly where id = v_nguoi.dai_ly_id);
  end if;
  if p_ty_le is null or p_ty_le < 0 or p_ty_le > 30 then
    raise exception 'TY_LE_SAI' using errcode = '22023';
  end if;

  v_goc := public.nguoi_cheo_ma_goi_y(v_nguoi.site_id, v_nguoi.so_thuyen);
  v_ma := v_goc;
  while exists (select 1 from public.dai_ly where tenant_id = p_tenant_id and ma = v_ma) loop
    v_lan := v_lan + 1;
    v_ma := pg_catalog.left(v_goc, 14) || v_lan::text;
  end loop;

  insert into public.dai_ly (tenant_id, ma, ten, nguoi_lien_he, dien_thoai, ty_le_hoa_hong, loai, tao_boi)
  values (
    p_tenant_id,
    v_ma,
    pg_catalog.left('Người chèo ' || v_nguoi.ho_ten || ' · thuyền ' || v_nguoi.so_thuyen, 120),
    pg_catalog.left(v_nguoi.ho_ten, 80),
    v_nguoi.so_dien_thoai,
    p_ty_le,
    'nguoi-cheo',
    p_tao_boi
  )
  returning id into v_id;

  update public.erp_nguoi_cheo set dai_ly_id = v_id, sua_luc = now() where id = v_nguoi.id;
  return v_ma;
end;
$ham$;

-- Người chèo mẫu: mỗi người một mã mẫu 5%, nhận phần băm [19 + i, 20 + i) của
-- đơn mẫu (đại lý mẫu 099 giữ [0, 19)). 24 người dùng tới 43.
with nguoi as (
  select id, tenant_id, site_id, so_thuyen, ho_ten,
    (row_number() over (order by site_id, so_thuyen) - 1)::integer as thu_tu
  from public.erp_nguoi_cheo
  where la_mau and dai_ly_id is null
),
moi as (
  insert into public.dai_ly (tenant_id, ma, ten, nguoi_lien_he, ty_le_hoa_hong, loai, la_mau, mau_tu, mau_den, tao_boi)
  select tenant_id, public.nguoi_cheo_ma_goi_y(site_id, so_thuyen),
    pg_catalog.left('Người chèo ' || ho_ten || ' · thuyền ' || so_thuyen || ' (mẫu)', 120),
    pg_catalog.left(ho_ten, 80), 5, 'nguoi-cheo', true, 19 + thu_tu, 20 + thu_tu, 'he-thong'
  from nguoi
  where thu_tu < 57
  on conflict (tenant_id, ma) do nothing
  returning id, tenant_id, ma
)
update public.erp_nguoi_cheo nguoi_cheo
set dai_ly_id = moi.id
from moi
where nguoi_cheo.tenant_id = moi.tenant_id
  and nguoi_cheo.la_mau
  and nguoi_cheo.dai_ly_id is null
  and public.nguoi_cheo_ma_goi_y(nguoi_cheo.site_id, nguoi_cheo.so_thuyen) = moi.ma;

revoke all on function public.nguoi_cheo_ma_goi_y(uuid, text) from public, anon, authenticated;
revoke all on function public.erp_nguoi_cheo_cap_ma(uuid, uuid, numeric, text) from public, anon, authenticated;
grant execute on function public.nguoi_cheo_ma_goi_y(uuid, text) to service_role;
grant execute on function public.erp_nguoi_cheo_cap_ma(uuid, uuid, numeric, text) to service_role;

commit;
