-- Khách thích gì: số gộp cho giám đốc (13/10/2026).
--
-- Chủ dự án 13/10: "lấy data khách nghiên cứu sở thích của họ rồi dùng nó để
-- sau này kinh doanh ngon hơn". Hàm này chỉ đọc và chỉ trả số gộp: đi cùng ai,
-- có trẻ em không, mua gì, đặt trước bao lâu, giờ nào và thứ mấy đông, bao
-- nhiêu khách quay lại, khách tới qua đại lý hay mã mời. Không trả tên, số
-- điện thoại hay mã của khách nào. Ô dưới 5 lượt do màn hình ẩn đi.
--
-- Nguồn: phiếu bán lẻ ở quầy (`erp_counter_sales`, sale_kind = 'single'), đơn
-- web đã xác nhận (`customer_orders`), lượt quét cổng được nhận
-- (`erp_gate_scan_events`). Ngày theo giờ Việt Nam.

begin;

create or replace function public.erp_khach_thich_gi(
  p_tenant_id uuid,
  p_tu date,
  p_den date
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $ham$
  with
  quay as (
    select sale.adults, sale.children
    from public.erp_counter_sales sale
    where sale.tenant_id = p_tenant_id and sale.status = 'completed' and sale.sale_kind = 'single'
      and sale.business_date between p_tu and p_den
  ),
  web as (
    select customer_order.*
    from public.customer_orders customer_order
    where customer_order.tenant_id = p_tenant_id and customer_order.status = 'confirmed'
      and customer_order.visit_date between p_tu and p_den
  ),
  nhom as (
    select 'quay' as kenh, adults, children from quay
    union all
    select 'web', adults, children from web
  ),
  phan_loai as (
    select kenh, adults + children as khach,
      case
        when children > 0 then 'gia-dinh-co-tre'
        when adults = 1 then 'mot-minh'
        when adults = 2 then 'hai-nguoi'
        else 'nhom-ban'
      end as loai
    from nhom
  ),
  quet as (
    select scan.site_id,
      extract(hour from scan.scanned_at at time zone 'Asia/Ho_Chi_Minh')::integer as gio,
      extract(isodow from scan.scanned_at at time zone 'Asia/Ho_Chi_Minh')::integer as thu
    from public.erp_gate_scan_events scan
    where scan.tenant_id = p_tenant_id and scan.result = 'accepted'
      and (scan.scanned_at at time zone 'Asia/Ho_Chi_Minh')::date between p_tu and p_den
  ),
  ho_so as (
    select public.customer_canonical_profile_id(p_tenant_id, web.profile_id) as profile_id, count(*) as so_don
    from web group by 1
  )
  select jsonb_build_object(
    'tu', p_tu,
    'den', p_den,
    'nhom_khach', coalesce((
      select jsonb_agg(jsonb_build_object('kenh', kenh, 'loai', loai, 'luot', luot, 'khach', khach) order by kenh, loai)
      from (select kenh, loai, count(*) as luot, sum(khach) as khach from phan_loai group by kenh, loai) g
    ), '[]'::jsonb),
    'khach', jsonb_build_object(
      'nguoi_lon', (select coalesce(sum(adults), 0) from nhom),
      'tre_em', (select coalesce(sum(children), 0) from nhom),
      'luot_mua', (select count(*) from nhom),
      'luot_web', (select count(*) from web)
    ),
    'goi', coalesce((
      select jsonb_agg(jsonb_build_object(
        'slug', g.slug, 'ten', g.ten, 'don', g.don, 'khach', g.khach, 'tre_em', g.tre_em, 'tien', g.tien
      ) order by g.don desc, g.slug)
      from (
        select product.slug, product.name as ten, count(*) as don,
          sum(web.party_size) as khach, sum(web.children) as tre_em, sum(web.total_vnd) as tien
        from web join public.products product on product.id = web.product_id
        group by product.slug, product.name
      ) g
    ), '[]'::jsonb),
    'dat_truoc', coalesce((
      select jsonb_object_agg(muc, so)
      from (
        select case
            when web.visit_date - (web.created_at at time zone 'Asia/Ho_Chi_Minh')::date <= 0 then 'trong-ngay'
            when web.visit_date - (web.created_at at time zone 'Asia/Ho_Chi_Minh')::date <= 3 then '1-3-ngay'
            when web.visit_date - (web.created_at at time zone 'Asia/Ho_Chi_Minh')::date <= 7 then '4-7-ngay'
            else 'tren-7-ngay'
          end as muc, count(*) as so
        from web group by 1
      ) d
    ), '{}'::jsonb),
    'gio', coalesce((
      select jsonb_agg(jsonb_build_object('site_id', g.site_id, 'ten', site.name, 'theo_gio', g.theo_gio, 'tong', g.tong) order by site.name)
      from (
        select site_id, jsonb_object_agg(gio, so order by gio) as theo_gio, sum(so) as tong
        from (select site_id, gio, count(*) as so from quet group by site_id, gio) x
        group by site_id
      ) g
      join public.sites site on site.id = g.site_id
    ), '[]'::jsonb),
    'thu', coalesce((
      select jsonb_object_agg(thu, so order by thu) from (select thu, count(*) as so from quet group by thu) t
    ), '{}'::jsonb),
    'so_ngay', greatest(1, p_den - p_tu + 1),
    'quay_lai', jsonb_build_object(
      'ho_so', (select count(*) from ho_so),
      'tu_hai_don', (select count(*) from ho_so where so_don >= 2)
    ),
    'kenh', jsonb_build_object(
      'dai_ly', (select count(*) from web join public.dai_ly_don don on don.order_id = web.id),
      'ma_moi', (select count(*) from web where web.ma_moi is not null),
      'web', (select count(*) from web)
    )
  );
$ham$;

revoke all on function public.erp_khach_thich_gi(uuid, date, date) from public, anon, authenticated;
grant execute on function public.erp_khach_thich_gi(uuid, date, date) to service_role;

commit;
