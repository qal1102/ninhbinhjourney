-- Dọn dứt điểm phần rác còn lại sau khi đã sửa xong các bài prod-smoke
-- ngày 02/08/2026, và trả ngân sách Tràng An về đúng con số seed lần cuối.
--
-- Vì sao còn sót sau migration 019/020/021:
--
--   * 5 sự cố 'INC-...-CAM...' vẫn đang mở là của những lần chạy thử bị
--     lỗi giữa chừng — tạo xong sự cố rồi hỏng trước khi kịp đóng lại.
--     Bài test bây giờ đã đóng hết những gì nó mở, nhưng những dòng sinh
--     ra trước lúc đó thì phải dọn tay.
--
--   * Ngân sách "Lễ hội Tràng An 2026" trôi tiếp lên 13,4 tỷ vì mấy lần
--     chạy hỏng đã cộng 0,1 rồi hỏng đúng ở chặng trả lại. Bài test giờ
--     chạy trọn vẹn nên cân bằng, đây là lần đặt lại cuối.
--
-- Xoá toàn bộ dòng 'INC-%-CAM%' (kể cả đã đóng) để đưa bảng sự cố về đúng
-- 12 dòng seed. Từ nay mỗi đợt chạy chỉ để lại sự cố ở trạng thái đã đóng,
-- không ảnh hưởng KPI nào; nếu tồn quá nhiều thì dọn lại đúng theo cách này.

begin;

delete from public.erp_incidents
where id like 'INC-%-CAM%';

delete from public.erp_project_change_requests
where summary like 'PROD-SMOKE%';

update public.erp_project_events
set budget_billion = 12.8, updated_at = now()
where id = '20000000-0000-4000-8000-000000000001'
  and budget_billion <> 12.8;

commit;
