-- Gỡ hai module vỏ khỏi quyền đã giao: "xe-trung-chuyen" và "tai-san-bao-tri".
--
-- Cả hai chưa từng có nghiệp vụ (chỉ hiện "Giai đoạn sau") và đã gỡ khỏi mã
-- ngày 26/09/2026. Điều phối xe điện ở Tam Chúc, Bái Đính là việc điều luồng
-- khách, nên ai đang giữ quyền xe trung chuyển được chuyển sang "suc-chua"
-- (người đã có thì không nhân đôi). Quyền tài sản bỏ hẳn. Mã đọc quyền đã tự
-- lọc mã lạ, nên migration này chỉ làm sạch kho, không phải điều kiện để web
-- chạy.
--
-- Chỉ chạm hàng đang chứa một trong hai mã; không đổi site, version hay ai
-- được giao gì khác.

begin;

update public.erp_employee_access access
set module_ids = coalesce((
      select array_agg(distinct module_id order by module_id)
      from unnest(array_replace(access.module_ids, 'xe-trung-chuyen', 'suc-chua')) as module_id
      where module_id <> 'tai-san-bao-tri'
    ), '{}'::text[]),
    updated_at = now()
where access.module_ids && array['xe-trung-chuyen', 'tai-san-bao-tri']::text[];

commit;
