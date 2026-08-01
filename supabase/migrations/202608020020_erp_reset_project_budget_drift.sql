-- Trả ngân sách "Lễ hội Tràng An 2026" về đúng con số seed ban đầu.
--
-- prod-smoke-project-workflow chứng minh luồng "quản lý xin tăng ngân sách →
-- giám đốc duyệt → ngân sách đổi xuyên tài khoản" bằng cách cộng thêm 0,1 tỷ
-- mỗi lần chạy, và không bao giờ trả lại. Sau 10 lần chạy (2 viewport mỗi
-- đợt), ngân sách seed 12,8 tỷ đã trôi thành 13,8 tỷ — số liệu demo sai lệch
-- dần mà không ai nhận ra.
--
-- Bài test đã được sửa để tự trả ngân sách về chỗ cũ ngay trong cùng một lần
-- chạy, nên đây là lần đặt lại một lần.
--
-- Ba sự kiện còn lại vẫn đúng bằng giá trị seed (đã kiểm chứng bằng
-- supabase db query trước khi viết migration này), nên không đụng tới.

begin;

update public.erp_project_events
set budget_billion = 12.8, updated_at = now()
where id = '20000000-0000-4000-8000-000000000001'
  and budget_billion <> 12.8;

commit;
