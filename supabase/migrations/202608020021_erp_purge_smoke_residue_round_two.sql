-- Dọn nốt yêu cầu đổi phạm vi rác phát sinh trong lúc chính đợt sửa test
-- ngày 02/08/2026 đang chạy đi chạy lại trên production.
--
-- Vì sao cần lần hai: migration 019 đã dọn sạch, nhưng các lần chạy thử
-- trong lúc sửa bài test lại sinh thêm. Đợt này cũng chỉ ra một hệ quả cụ
-- thể của việc để rác tồn: bảng điều khiển giám đốc chỉ hiển thị 4 mục đầu
-- (`executive-dashboard-live.tsx` slice(0, 4) — đúng thiết kế, đây là ô xem
-- nhanh), nên 8 yêu cầu rác đọng lại đã đẩy yêu cầu thật ra khỏi tầm nhìn
-- và làm chính bài kiểm chứng đỏ. Rác không chỉ xấu, nó che mất việc thật.
--
-- Từ sau migration này, bài prod-smoke-director-decision-inbox tự từ chối
-- yêu cầu nó tạo ra, và prod-smoke-project-workflow tự trả lại ngân sách,
-- nên hàng chờ giữ được ngắn. Quy tắc bắt buộc đã ghi trong AGENTS.md.
--
-- Chỉ dữ liệu, điều kiện hẹp và kiểm chứng được.

begin;

delete from public.erp_project_change_requests
where summary like 'PROD-SMOKE%';

commit;
