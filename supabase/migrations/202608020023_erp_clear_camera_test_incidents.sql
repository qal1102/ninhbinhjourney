-- Dọn sự cố do bài kiểm chứng Camera AI tạo ra, trả bảng sự cố về đúng 12
-- dòng seed trước khi bàn giao.
--
-- Khác với migration 019/022 (dọn rác tồn đọng nhiều tháng, trong đó có
-- những dòng đang mở làm sai KPI), lần này toàn bộ đều đã ở trạng thái
-- 'closed' — bài test giờ tự đóng những gì nó mở, đúng như quy tắc mới
-- trong AGENTS.md. Chúng không ảnh hưởng KPI nào, chỉ là lịch sử không có
-- ý nghĩa nghiệp vụ tích lại sau một buổi chạy đi chạy lại.
--
-- Đây là cách dọn được khuyến nghị khi tồn dư kiểu này lớn dần: xoá theo
-- một điều kiện hẹp và kiểm chứng được, không xoá theo khoảng thời gian và
-- không truncate. Không cần chạy lại thường xuyên.

begin;

delete from public.erp_incidents
where id like 'INC-%-CAM%';

commit;
