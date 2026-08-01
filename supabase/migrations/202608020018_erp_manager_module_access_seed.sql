-- V14: give each site manager a real module grant instead of the hard-coded
-- all-15 they used to receive directly in lib/erp/demo-session.ts.
--
-- Before this, `erp_employee_access` only ever held employee rows, because
-- managers never went through the grant mechanism at all: getCurrentErpUser()
-- handed role === 'manager' the full ERP_MODULES list for every managed site.
-- That made the permission story only half true (L13 in
-- docs/DANH_GIA_HE_THONG_VA_GIAO_VIEC.md) and left "how do you permission a
-- manager?" with no answer during a demo.
--
-- With this seed in place the app reads a manager's modules from the same
-- table it reads an employee's from, and a director can widen or narrow them
-- per person in /erp/<site>/nhan-su.
--
-- Data-only (no schema change) and idempotent: on conflict do nothing, so it
-- never overwrites a grant a director has already made. The module lists
-- mirror lib/erp/demo-data.ts -- base set for every manager, plus what each
-- site actually operates (shuttle fleet, maintained estate, drill book).
-- `bao-cao` is deliberately granted to none of them: regional forecasting
-- belongs to the director and accounting.

begin;

insert into public.erp_employee_access (
  employee_account_id, tenant_id, site_id, module_ids, version
) values
  (
    'manager-trang-an',
    '00000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    array[
      've-dat-cho', 'check-in-khach', 'suc-chua', 'camera-ai',
      'bao-cao-hien-truong', 'du-an-su-kien', 'su-co', 'nhan-su',
      'cham-cong', 'doi-tac-nha-cung-ung', 'tai-chinh-doi-soat',
      'tai-san-bao-tri', 'sop-dien-tap'
    ],
    1
  ),
  (
    'manager-tam-chuc',
    '00000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000009',
    array[
      've-dat-cho', 'check-in-khach', 'suc-chua', 'camera-ai',
      'bao-cao-hien-truong', 'du-an-su-kien', 'su-co', 'nhan-su',
      'cham-cong', 'doi-tac-nha-cung-ung', 'tai-chinh-doi-soat',
      'sop-dien-tap', 'xe-trung-chuyen'
    ],
    1
  ),
  (
    'manager-tam-coc',
    '00000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000005',
    array[
      've-dat-cho', 'check-in-khach', 'suc-chua', 'camera-ai',
      'bao-cao-hien-truong', 'du-an-su-kien', 'su-co', 'nhan-su',
      'cham-cong', 'doi-tac-nha-cung-ung', 'tai-chinh-doi-soat',
      'xe-trung-chuyen'
    ],
    1
  ),
  (
    'manager-bai-dinh',
    '00000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000003',
    array[
      've-dat-cho', 'check-in-khach', 'suc-chua', 'camera-ai',
      'bao-cao-hien-truong', 'du-an-su-kien', 'su-co', 'nhan-su',
      'cham-cong', 'doi-tac-nha-cung-ung', 'tai-chinh-doi-soat',
      'xe-trung-chuyen', 'tai-san-bao-tri'
    ],
    1
  )
on conflict (employee_account_id) do nothing;

commit;
