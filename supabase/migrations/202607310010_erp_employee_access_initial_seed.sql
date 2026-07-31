-- Seed erp_employee_access with each active employee's original demo
-- default site/module grant.
--
-- Migration 202607310009 created erp_employee_access empty. Before this
-- seed, every employee account had zero site/module access in Supabase
-- mode until a manager explicitly re-granted it through the new UI --
-- silently regressing behavior that previously came "for free" from the
-- demo-cookie default (lib/erp/demo-data.ts's initialSiteIds/
-- initialModuleIds). This is data-only (no schema change) and idempotent:
-- on conflict do nothing, so it never overwrites a real grant a manager
-- has already made since 202607310009 was applied.

begin;

insert into public.erp_employee_access (
  employee_account_id, tenant_id, site_id, module_ids, version
) values
  (
    'employee-trang-an-01',
    '00000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    array['ve-dat-cho', 'check-in-khach', 'bao-cao-hien-truong', 'su-co', 'cham-cong'],
    1
  ),
  (
    'employee-trang-an-02',
    '00000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    array['suc-chua', 'bao-cao-hien-truong', 'su-co', 'cham-cong'],
    1
  ),
  (
    'employee-trang-an-seasonal-01',
    '00000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    array['check-in-khach', 'bao-cao-hien-truong', 'su-co', 'cham-cong'],
    1
  ),
  (
    'employee-tam-chuc-01',
    '00000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000009',
    array['xe-trung-chuyen', 'bao-cao-hien-truong', 'su-co', 'cham-cong'],
    1
  ),
  (
    'employee-tam-coc-01',
    '00000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000005',
    array['check-in-khach', 'bao-cao-hien-truong', 'suc-chua', 'cham-cong'],
    1
  ),
  (
    'employee-bai-dinh-01',
    '00000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000003',
    array['xe-trung-chuyen', 'bao-cao-hien-truong', 'suc-chua', 'cham-cong'],
    1
  )
on conflict (employee_account_id) do nothing;

commit;
