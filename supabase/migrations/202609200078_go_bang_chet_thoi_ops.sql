-- Dọn mô hình dữ liệu chết của `/ops` · 20/09/2026
--
-- ## Vì sao gỡ
--
-- `202607270002_erp_realtime_core.sql` dựng bộ bảng đầu tiên cho màn hình
-- `/ops`. Kiến trúc ấy bị bỏ giữa chừng và ERP được xây lại dưới tên khác. Kế
-- hoạch 02/08/2026 (`docs/reference/KE_HOACH_HOP_NHAT_TAI_KHOAN.md`, mục 0)
-- đã đặt tên cho việc này và để lại đúng một câu: "~20 bảng chết: chưa xoá
-- vội. Đánh dấu và để lại một migration dọn riêng sau khi chốt." Đây là
-- migration dọn ấy.
--
-- Bảng cũ → bảng đang thật sự dùng:
--
--   erp_field_reports        → erp_field_operation_reports (14 hàng)
--   erp_attendance_events    → erp_staff_attendance_events (11 hàng)
--   erp_ticket_scans         → erp_gate_scan_events
--   erp_projects, erp_project_work_items → erp_project_events, erp_project_action_items
--   erp_partners + 3 bảng con → erp_ap_suppliers và hệ AP
--   erp_ticket_shift_closures → erp_shift_close_workflows
--   erp_finance_ledger_entries → erp_accounting_journals + erp_accounting_journal_lines
--   erp_camera_*, erp_decision_items, erp_operational_signals, erp_push_subscriptions
--     → chưa từng có bảng thay thế; tính năng chưa dựng.
--
-- Giữ tên cũ không phải là vô hại: đã có hai lần migration gãy giữa chừng vì
-- một bảng mới trùng tên bảng cũ (`erp_field_reports` thiếu cột `report_code`,
-- `erp_project_work_items` thiếu cột `milestone_id` — xem nhật ký 31/08).
--
-- ## Đã kiểm gì trước khi viết câu `drop` (20/09/2026, đo thẳng trên production)
--
-- Với TỪNG bảng dưới đây:
--   - 0 hàng (`pg_stat_user_tables`);
--   - không tệp nào trong `app/ components/ domain/ lib/ content/ config/
--     scripts/` nhắc tên;
--   - không thân hàm nào trong `pg_proc` nhắc tên;
--   - không biểu thức policy nào, không view nào nhắc tên;
--   - không trigger nào gắn lên chúng, nên không bỏ lại hàm mồ côi;
--   - khoá ngoại trỏ tới chúng CHỈ đến từ chính nhóm bảng này.
--
-- `erp_site_assignments` sinh cùng migration 002 và cũng rỗng, nhưng **giữ
-- lại**: còn hai hàm nhắc tên nó. Bốn bảng `bookings`, `passes`, `quotes`,
-- `incidents` cũng chưa gỡ ở đây — mã nguồn còn nhắc tới chúng, phải soát
-- riêng. Hạ tầng Supabase Auth (`user_profiles`, `tenant_memberships`) giữ
-- nguyên theo đúng kế hoạch 02/08.
--
-- ## Không cascade — cố ý
--
-- Thứ tự dưới đây gỡ bảng con trước bảng cha. Không dùng `cascade`: nếu có
-- một phụ thuộc nào mà năm lớp kiểm ở trên không thấy, câu lệnh phải gãy ra
-- tiếng chứ không được lặng lẽ kéo theo thứ khác.

begin;

-- Chốt an toàn: còn một hàng dữ liệu ở bất cứ bảng nào thì dừng cả migration.
-- Bảng rỗng là căn cứ để gỡ; nếu giữa lúc soát và lúc áp mà có dữ liệu thật
-- chảy vào, căn cứ ấy không còn đúng nữa.
do $$
declare
  v_ten text;
  v_so bigint;
begin
  foreach v_ten in array array[
    'erp_attendance_events', 'erp_camera_events', 'erp_camera_sources',
    'erp_decision_items', 'erp_field_reports', 'erp_finance_ledger_entries',
    'erp_operational_signals', 'erp_partner_documents', 'erp_partner_feedback',
    'erp_partner_quotes', 'erp_partners', 'erp_project_work_items',
    'erp_projects', 'erp_push_subscriptions', 'erp_ticket_scans',
    'erp_ticket_shift_closures'
  ] loop
    if to_regclass('public.' || v_ten) is null then
      continue;
    end if;
    execute format('select count(*) from public.%I', v_ten) into v_so;
    if v_so > 0 then
      raise exception using
        errcode = '22023',
        message = format('BANG_CON_DU_LIEU: %s có %s hàng, không gỡ', v_ten, v_so);
    end if;
  end loop;
end;
$$;

-- Bảng con trước, bảng cha sau.
drop table if exists public.erp_field_reports;
drop table if exists public.erp_project_work_items;
drop table if exists public.erp_projects;

drop table if exists public.erp_partner_documents;
drop table if exists public.erp_partner_feedback;
drop table if exists public.erp_partner_quotes;
drop table if exists public.erp_partners;

drop table if exists public.erp_camera_events;
drop table if exists public.erp_camera_sources;

drop table if exists public.erp_decision_items;
drop table if exists public.erp_operational_signals;

drop table if exists public.erp_attendance_events;
drop table if exists public.erp_finance_ledger_entries;
drop table if exists public.erp_push_subscriptions;
drop table if exists public.erp_ticket_scans;
drop table if exists public.erp_ticket_shift_closures;

commit;
