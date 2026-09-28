-- Thêm hai chuyến chiều cho gói "Nhịp chậm Ninh Bình" tại Tràng An: 14:30 và 16:00.
--
-- Chủ dự án duyệt ngày 28/09/2026 ("okay" cho câu hỏi thêm khung giờ chiều).
-- Lý do: vòng dẫn trình diễn trong ERP đi trọn một vòng khách (đặt vé hôm nay →
-- trả QR → quét cổng Tràng An). Trước migration này chuyến muộn nhất có Tràng
-- An là 13:00, nên người chấm thử vào buổi chiều không đặt được vé cho hôm nay
-- và bước quét cổng báo "Vé không dùng cho hôm nay".
--
-- Vì sao gói này, không phải "Gia đình khám phá": gói gia đình có hai chặng,
-- chặng Bái Đính cách chặng Tràng An 5 giờ 30 (xem 202608290052) và gói cam kết
-- kết thúc trước 17:00; chuyến chiều sẽ đẩy chặng Bái Đính sang buổi tối. Gói
-- "Nhịp chậm" chỉ bán chặng Tràng An (Phố cổ Hoa Lư chưa có ngưỡng sức chứa nên
-- không bán ở đây) và vốn được xếp "rải đều nhất" trong ngày.
--
-- Vì sao 14:30 và 16:00: nối tiếp nhịp 08:00 · 09:30 · 11:00 · 13:00 sẵn có;
-- chuyến dài 60 phút nên chuyến 16:00 xong lúc 17:00, đúng giờ đóng minh hoạ
-- 07:00–17:00 của Tràng An.
--
-- Chỉ thêm dòng lịch bán, không đổi bảng, không đổi hàm, không chạm hàng nào có
-- sẵn. Ô sức chứa dùng chung theo (cơ sở, giờ) nên hai giờ mới ăn vào đúng 800
-- chỗ mỗi giờ của Tràng An, như mọi giờ khác.

begin;

insert into public.customer_product_capacity_templates (
  tenant_id, product_id, site_id, departure_time, local_start_time,
  duration_minutes, source_kind, source_note, active
) values
  ('00000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000002',
   '10000000-0000-4000-8000-000000000001', '14:30', '14:30', 60, 'customer-approved',
   'Chuyến 14:30 cho gói thong thả, chủ dự án duyệt 28/09/2026 để trình diễn được buổi chiều.', true),
  ('00000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000002',
   '10000000-0000-4000-8000-000000000001', '16:00', '16:00', 60, 'customer-approved',
   'Chuyến 16:00 cho gói thong thả, chủ dự án duyệt 28/09/2026 để trình diễn được buổi chiều.', true)
on conflict (tenant_id, product_id, site_id, local_start_time) do nothing;

commit;
