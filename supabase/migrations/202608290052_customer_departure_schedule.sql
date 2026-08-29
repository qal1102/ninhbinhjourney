-- Lịch bán: mở thêm giờ khởi hành cho các gói thường ngày.
--
-- Quyết định của chủ dự án ngày 29/08/2026: **mùa trăng giữ đúng một khung cho
-- gói Trung thu, các gói khác chạy xuyên suốt trong ngày.**
--
-- Vì sao là migration dữ liệu chứ không phải người vận hành tự nhập: chưa có
-- màn hình nào trong sản phẩm sửa được lịch bán. Khi màn hình đó ra đời, đây
-- là chỗ phải ngừng thêm dòng.
--
-- Ranh giới đã tra trước khi xếp lịch, không đoán:
--
-- - Chỉ **bốn** cơ sở có ngưỡng sức chứa thật: Tràng An 800, Bái Đính 1.440,
--   Tam Cốc 300, Tam Chúc 1.152. Cố đô Hoa Lư, Phố cổ Hoa Lư, Hang Múa, Thung
--   Nham, Vân Long **chưa có ngưỡng nào**. Danh mục có hứa hai chặng cho "Di
--   sản trong một ngày" và "Cinematic Ninh Bình", nhưng chặng thứ hai của cả
--   hai rơi vào cơ sở chưa đo sức chứa — **không mở bán ở đó**, vì bán một chỗ
--   mà không có nguồn sức chứa là bịa. Ghi lại đây để phiên sau biết còn nợ.
-- - Ô sức chứa dùng chung giữa các gói: `customer_booking_slots` khóa theo
--   (cơ sở, giờ), nên ba gói cùng khởi hành 08:00 tại Tràng An **ăn chung**
--   800 chỗ của giờ đó. Đó là đúng ý đồ, không phải trùng lặp.
--
-- Giờ chọn theo đúng nhịp mà danh mục đã tuyên bố với khách:
--
-- - "Di sản trong một ngày" (nhịp cân bằng, trọn ngày) — thêm 09:00 và 10:00.
--   Tour cả ngày không khởi hành buổi chiều được.
-- - "Nhịp chậm Ninh Bình" (nhịp thong thả) — thêm 09:30, 11:00, 13:00. Rải
--   đều nhất, vì đây là gói duy nhất bán sự thong thả.
-- - "Gia đình khám phá" (hai chặng) — thêm một chuyến 09:30, chặng Bái Đính
--   dời tương ứng sang 15:00, giữ nguyên khoảng cách 5 giờ 30 giữa hai chặng
--   đúng như chuyến 08:00 đang chạy. Nhà có trẻ nhỏ cần khoảng nghỉ đó.
-- - "Cinematic Ninh Bình" (săn ánh sáng) — thêm 15:30. Chỉ buổi chiều, vì cả
--   gói dựa vào ánh sáng cuối ngày.
-- - "Bàn Trăng bên Ngô Đồng" — **không thêm dòng nào**. Một bàn tối, một khung
--   19:00, đúng như đã bán.
--
-- `source_kind = 'customer-approved'` — đây là lịch chủ dự án duyệt, khác với
-- lịch dựng sẵn theo danh mục. Chính là giá trị mà `202608290050` nới ra để
-- dùng cho việc này.

begin;

insert into public.customer_product_capacity_templates (
  tenant_id, product_id, site_id, departure_time, local_start_time,
  duration_minutes, source_kind, source_note, active
) values
  -- Di sản trong một ngày · Tràng An
  ('00000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001',
   '10000000-0000-4000-8000-000000000001', '09:00', '09:00', 60, 'customer-approved',
   'Chuyến 09:00 mở thêm cho gói trọn ngày, chủ dự án duyệt 29/08/2026.', true),
  ('00000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001',
   '10000000-0000-4000-8000-000000000001', '10:00', '10:00', 60, 'customer-approved',
   'Chuyến 10:00 mở thêm cho gói trọn ngày, chủ dự án duyệt 29/08/2026.', true),

  -- Nhịp chậm Ninh Bình · Tràng An
  ('00000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000002',
   '10000000-0000-4000-8000-000000000001', '09:30', '09:30', 60, 'customer-approved',
   'Chuyến 09:30 cho gói thong thả, chủ dự án duyệt 29/08/2026.', true),
  ('00000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000002',
   '10000000-0000-4000-8000-000000000001', '11:00', '11:00', 60, 'customer-approved',
   'Chuyến 11:00 cho gói thong thả, chủ dự án duyệt 29/08/2026.', true),
  ('00000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000002',
   '10000000-0000-4000-8000-000000000001', '13:00', '13:00', 60, 'customer-approved',
   'Chuyến 13:00 cho gói thong thả, chủ dự án duyệt 29/08/2026.', true),

  -- Gia đình khám phá · chuyến 09:30, hai chặng
  ('00000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000003',
   '10000000-0000-4000-8000-000000000001', '09:30', '09:30', 60, 'customer-approved',
   'Chuyến 09:30, chặng Tràng An. Chủ dự án duyệt 29/08/2026.', true),
  ('00000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000003',
   '10000000-0000-4000-8000-000000000003', '09:30', '15:00', 60, 'customer-approved',
   'Chuyến 09:30, chặng Bái Đính lúc 15:00 — giữ đúng khoảng nghỉ 5 giờ 30 như chuyến 08:00.', true),

  -- Cinematic Ninh Bình · Tam Cốc
  ('00000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000004',
   '10000000-0000-4000-8000-000000000005', '15:30', '15:30', 60, 'customer-approved',
   'Chuyến 15:30 cho gói săn ánh sáng cuối ngày, chủ dự án duyệt 29/08/2026.', true)
on conflict (tenant_id, product_id, site_id, local_start_time) do nothing;

commit;
