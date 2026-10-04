-- Tên giám đốc là Đạt (chủ dự án 04/10/2026: "đổi giám đốc thành tên Đạt,
-- chào anh Đạt").
--
-- Tên người đăng nhập trên production đọc từ sổ tài khoản
-- (`erp_account_registry.display_name`), không từ `lib/erp/demo-data.ts`.
-- Migration 006 gieo `director-001` là "Nguyễn Minh Anh", nên chỉ sửa mã thì
-- trang đầu sẽ chào "Chào anh Anh".
--
-- Làm đúng như màn hồ sơ (`erp_manager_update_profile`): đổi họ tên và ghi
-- một dòng `account.updated` vào nhật ký quản trị tài khoản, người làm là
-- chính giám đốc. Chỉ đụng đúng dòng còn mang tên cũ, nên chạy lại không đổi
-- gì, và nếu giám đốc đã tự đổi tên ở màn hồ sơ thì migration này bỏ qua.
-- Bút toán, nhật ký cũ ghi "Nguyễn Minh Anh" là hồ sơ bất biến, giữ nguyên.

begin;

with doi as (
  update public.erp_account_registry
  set display_name = 'Đạt',
      updated_at = now()
  where tenant_id = '00000000-0000-4000-8000-000000000001'
    and account_id = 'director-001'
    and display_name = 'Nguyễn Minh Anh'
  returning tenant_id, account_id, display_name, job_title
)
insert into public.erp_account_admin_audit (
  tenant_id, actor_account_id, target_account_id, action, detail
)
select tenant_id, account_id, account_id, 'account.updated',
  jsonb_build_object('display_name', display_name, 'job_title', job_title)
from doi;

commit;
