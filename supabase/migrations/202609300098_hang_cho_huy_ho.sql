-- Hàng chờ bến đò: nhân viên huỷ hẳn một lượt thay khách (khách báo ở bến là
-- không đi nữa, hay lượt đã bỏ mà khách không quay lại). Trước đó lượt "bỏ
-- lượt" nằm mãi trong danh sách "khách quay lại thì gọi lại" tới hết ngày.
-- Chỉ thêm một lối chuyển: cho / da-goi / bo-luot → khach-huy.
--
-- "Đang gọi tới số" tính theo mọi lượt đã từng được gọi (có `goi_luc`), để
-- một lượt đã gọi rồi bị huỷ không kéo con số ấy lùi về trước.

begin;

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
      xong_luc = case when p_trang_thai in ('da-len', 'bo-luot', 'khach-huy') then pg_catalog.now() else null end,
      nguoi_xu_ly = p_nguoi
    where id = p_id and tenant_id = p_tenant_id and site_id = p_site_id
      and ngay = public.hang_cho_ngay_vn()
      and (
        (p_trang_thai in ('da-len', 'bo-luot') and trang_thai = 'da-goi')
        or (p_trang_thai = 'da-goi' and trang_thai = 'bo-luot')
        or (p_trang_thai = 'khach-huy' and trang_thai in ('cho', 'da-goi', 'bo-luot'))
      )
    returning 1
  )
  select exists (select 1 from doi);
$ham$;

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
    'goi_toi_so', (select max(so_thu_tu) from hom_nay where goi_luc is not null),
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

revoke all on function public.erp_hang_cho_danh_dau(uuid, uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.erp_hang_cho_danh_dau(uuid, uuid, uuid, text, text) to service_role;

commit;
