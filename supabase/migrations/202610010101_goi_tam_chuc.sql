-- Gói "Tam Chúc: chùa trên hồ" (chủ dự án cho phép 01/10/2026).
--
-- Soát 30/09: Tam Chúc là cơ sở có cổng duy nhất không nằm trong gói nào, nên
-- trang Gói không có lối đặt, và kiosk Tam Chúc phải mời khách ra quầy. Gói
-- mới chỉ một chặng Tam Chúc, năm chuyến 07:30 · 09:00 · 10:30 · 13:30 ·
-- 15:00. Mỗi chuyến giữ chỗ 90 phút (thuyền qua hồ tới Khánh Điện), ăn vào
-- ngưỡng sẵn có của bến thuyền Khánh Điện (TC-PIER-01) như mọi giờ khác.
-- Giá 650.000 đ/khách là giá minh hoạ như các gói còn lại.
--
-- Chỉ thêm dòng mới, không đổi bảng, không đổi hàm.

begin;

insert into public.products (
  id, tenant_id, region_id, name, slug, product_type, ledger_type,
  demo_price_vnd, duration_minutes, entitlement_templates, active
) values (
  '40000000-0000-4000-8000-000000000006',
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000002',
  'Tam Chúc: chùa trên hồ',
  'tam-chuc-chua-tren-ho',
  'package',
  'service-commerce',
  650000,
  240,
  '[{"siteSlug":"tam-chuc","quantity":1}]'::jsonb,
  true
)
on conflict (id) do nothing;

insert into public.product_sites (product_id, site_id, stop_order)
values ('40000000-0000-4000-8000-000000000006', '10000000-0000-4000-8000-000000000009', 1)
on conflict (product_id, site_id) do nothing;

insert into public.customer_product_capacity_templates (
  tenant_id, product_id, site_id, departure_time, local_start_time,
  duration_minutes, source_kind, source_note, active
)
select
  '00000000-0000-4000-8000-000000000001',
  '40000000-0000-4000-8000-000000000006',
  '10000000-0000-4000-8000-000000000009',
  gio::time, gio::time, 90, 'customer-approved',
  'Chuyến ' || gio || ' gói Tam Chúc: chùa trên hồ, chủ dự án cho phép 01/10/2026.', true
from unnest(array['07:30', '09:00', '10:30', '13:30', '15:00']) as gio
on conflict do nothing;

commit;
