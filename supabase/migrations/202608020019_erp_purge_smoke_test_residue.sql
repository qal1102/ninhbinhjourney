-- Dọn dữ liệu rác do các bài prod-smoke tạo ra và không bao giờ dọn lại,
-- rồi khôi phục dữ liệu demo mà một bài test một chiều đã tiêu hết.
--
-- Phát hiện trong đợt kiểm toán migration ngày 02/08/2026:
--
--   1. erp_project_change_requests: 23/23 dòng đều là rác test, trong đó
--      13 dòng đang ở trạng thái 'pending' -- tức đang được đếm vào hộp thư
--      quyết định của giám đốc (V2) và con số trên chuông thông báo (V5).
--      Bảng này chưa bao giờ có dữ liệu seed thật; toàn bộ là do
--      prod-smoke-project-workflow / prod-smoke-director-decision-inbox
--      tạo ra mỗi lần chạy, mỗi viewport một dòng.
--
--   2. erp_incidents: 10 dòng 'INC-TC-CAM...' ở Tam Chúc do
--      prod-smoke-camera-ai-incident tạo (V4), 9 dòng còn đang mở, thổi
--      phồng KPI "sự cố đang mở" của cơ sở đó.
--
--   3. Ngược lại, 3 sự cố seed của Tràng An đã bị đẩy hết sang 'closed':
--      prod-smoke-incidents đi một chiều qua chuỗi trạng thái và không có
--      RPC nào đưa ngược lại được, nên chạy đủ số lần là cạn dữ liệu demo.
--
-- Sau migration này, các bài test tương ứng đã được sửa để tự dọn phần
-- mình tạo ra, nên đây là lần dọn một lần, không phải việc lặp lại.
--
-- Chỉ đụng dữ liệu, không đổi schema. Xoá theo điều kiện hẹp và có thể
-- kiểm chứng được ('PROD-SMOKE%' và 'INC-%-CAM%'), không xoá theo khoảng
-- thời gian hay xoá cả bảng.

begin;

-- 1. Rác từ bài test yêu cầu đổi phạm vi dự án -------------------------
delete from public.erp_project_change_requests
where summary like 'PROD-SMOKE%';

-- Giữ lại đúng một yêu cầu thật để hộp thư quyết định của giám đốc vẫn có
-- nội dung để demo -- và để bài prod-smoke đối chiếu chéo số đếm vẫn có
-- cái để đếm.
insert into public.erp_project_change_requests (
  event_id, tenant_id, site_id, kind, summary,
  proposed_budget_billion, note, status,
  requested_by_account_id, requested_by_name
) values (
  '20000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  'budget',
  'Xin bổ sung ngân sách dựng sân khấu nổi bến Tràng An',
  15.30,
  'Đơn giá thép và nhân công dựng sân khấu nổi tăng so với dự toán đầu kỳ; cần bổ sung 1,5 tỷ để giữ đúng mốc khai mạc 14/08.',
  'pending',
  'manager-trang-an',
  'Lê Hoàng Nam'
);

-- 2. Sự cố do bài test Camera AI tạo ------------------------------------
delete from public.erp_incidents
where id like 'INC-%-CAM%';

-- 3. Khôi phục 3 sự cố seed của Tràng An --------------------------------
-- reported_at_ts đặt lệch so với now() đúng bằng số phút mà bản seed gốc
-- ghi ở cột elapsed_minutes (migration 011), để đồng hồ SLA sống của V13
-- đọc ra đúng con số ban đầu rồi chạy tiếp từ đó.

update public.erp_incidents set
  status = 'reported',
  escalated = true,
  escalation_reason = 'Cần quyết định mở làn dự phòng trong 30 phút để giữ lối tiếp cận cho tổ y tế.',
  assignee_id = null,
  assignee_name = 'Chưa giao',
  assignee_team = 'Tổ y tế & an toàn',
  sop_completed_steps = 2,
  next_action = 'Quản lý tiếp nhận và giao tổ y tế',
  timeline = '[{"id":"TL-071-02","at":"09:18","actor":"Hệ thống","action":"Chuyển cấp P2","note":"Đã gửi quản lý cơ sở và giám đốc vì cần điều chỉnh luồng khách."},{"id":"TL-071-01","at":"09:16","actor":"Đỗ Thị Lan","action":"Báo sự cố","note":"Ghi nhận vị trí, tình trạng ban đầu và gọi tổ y tế."}]'::jsonb,
  reported_at_ts = now() - interval '4 minutes',
  updated_at = now()
where id = 'INC-TA-071';

update public.erp_incidents set
  status = 'in-progress',
  escalated = false,
  escalation_reason = null,
  assignee_id = 'employee-trang-an-01',
  assignee_name = 'Đỗ Thị Lan',
  assignee_team = 'Đón khách & cổng vé',
  sop_completed_steps = 4,
  next_action = 'Hoàn tất ảnh sau xử lý và chuyển quản lý xác minh',
  timeline = '[{"id":"TL-069-03","at":"09:06","actor":"Đỗ Thị Lan","action":"Cập nhật xử lý","note":"Đã mở hàng chờ phụ; thời gian chờ giảm còn 9 phút."},{"id":"TL-069-02","at":"09:04","actor":"Quản lý Tràng An","action":"Giao xử lý","note":"Giao Đỗ Thị Lan phụ trách tại hiện trường."},{"id":"TL-069-01","at":"09:02","actor":"Camera AI · CAM 02","action":"Tạo cảnh báo","note":"Mật độ hàng chờ vượt ngưỡng vận hành."}]'::jsonb,
  reported_at_ts = now() - interval '7 minutes',
  updated_at = now()
where id = 'INC-TA-069';

-- 064 vốn đã 'closed' trong bản seed; chỉ đặt lại mốc thời gian để
-- "Hoàn tất trong 6 phút" hiển thị đúng như thiết kế của V13.
update public.erp_incidents set
  status = 'closed',
  escalated = false,
  escalation_reason = null,
  assignee_id = 'employee-trang-an-01',
  assignee_name = 'Đỗ Thị Lan',
  assignee_team = 'Chăm sóc khách hàng',
  sop_completed_steps = 5,
  next_action = 'Không còn việc cần xử lý',
  timeline = '[{"id":"TL-064-02","at":"08:27","actor":"Quản lý Tràng An","action":"Xác minh và đóng","note":"Đủ thông tin người nhận và biên bản bàn giao."},{"id":"TL-064-01","at":"08:21","actor":"Quầy hỗ trợ 01","action":"Báo tài sản thất lạc","note":"Niêm phong và chuyển quầy hỗ trợ đối chiếu."}]'::jsonb,
  reported_at_ts = now() - interval '6 minutes',
  updated_at = now()
where id = 'INC-TA-064';

commit;
