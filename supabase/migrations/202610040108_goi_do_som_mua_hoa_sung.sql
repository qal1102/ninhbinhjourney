-- Gói "Đò sớm mùa hoa súng" ở Tam Cốc (chủ dự án duyệt 04/10/2026: làm sự
-- kiện mùa sau Trung thu là mùa hoa súng và lễ Sắc Hồng Tam Cốc).
--
-- Hoa súng trên sông Ngô Đồng nở từ cuối tháng 10 tới tháng 12, mỗi ngày chỉ
-- khoảng 7–10 giờ sáng (Tuổi Trẻ 26/10/2025), nên gói chỉ có chuyến sớm:
-- 06:30 · 07:00 · 07:30 · 08:00 · 08:30, mỗi chuyến giữ 120 phút ở bến Văn
-- Lâm, ăn vào đúng ngưỡng bến đò Tam Cốc (TCO-PIER-01) như mọi giờ khác.
-- Giá 390.000 đ/khách là giá minh hoạ như các gói còn lại.
--
-- Gói bán theo mùa lặp lại hằng năm: khung ngày bán tính từ Lịch mùa vụ ở
-- tầng ứng dụng (`domain/mua-hoa-sung.ts`) và API giữ chỗ từ chối ngày ngoài
-- mùa, nên ở đây không ghi năm nào.
--
-- Chỉ thêm dòng mới, không đổi bảng, không đổi hàm.

begin;

insert into public.products (
  id, tenant_id, region_id, name, slug, product_type, ledger_type,
  demo_price_vnd, duration_minutes, entitlement_templates, active
) values (
  '40000000-0000-4000-8000-000000000007',
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000002',
  'Đò sớm mùa hoa súng',
  'do-som-mua-hoa-sung',
  'package',
  'service-commerce',
  390000,
  120,
  '[{"siteSlug":"tam-coc-bich-dong","quantity":1}]'::jsonb,
  true
)
on conflict (id) do nothing;

insert into public.product_sites (product_id, site_id, stop_order)
values ('40000000-0000-4000-8000-000000000007', '10000000-0000-4000-8000-000000000005', 1)
on conflict (product_id, site_id) do nothing;

insert into public.customer_product_capacity_templates (
  tenant_id, product_id, site_id, departure_time, local_start_time,
  duration_minutes, source_kind, source_note, active
)
select
  '00000000-0000-4000-8000-000000000001',
  '40000000-0000-4000-8000-000000000007',
  '10000000-0000-4000-8000-000000000005',
  gio::time, gio::time, 120, 'customer-approved',
  'Chuyến ' || gio || ' gói Đò sớm mùa hoa súng, chủ dự án duyệt 04/10/2026.', true
from unnest(array['06:30', '07:00', '07:30', '08:00', '08:30']) as gio
on conflict do nothing;

commit;
