-- T1: make erp_account_registry agree with the org chart the app has been
-- running since V12, and repair the damage the disagreement caused.
--
-- V12 (01/08/2026) split one regional manager into four site managers in
-- lib/erp/demo-data.ts. Nothing updated the registry underneath Supabase, so
-- it stayed a snapshot of the old org chart: one manager account, holding
-- 'regional-manager' on all four sites.
--
-- That is not cosmetic drift. erp_ap_submit_supplier_invoice and
-- erp_ap_resubmit_supplier_invoice gate on erp_account_has_active_role(...,
-- 'regional-manager', site), which reads this registry -- so on production
-- three of the four site managers could not file a supplier invoice at all:
--
--   manager-trang-an  -> true
--   manager-tam-chuc  -> false
--   manager-tam-coc   -> false
--   manager-bai-dinh  -> false
--
-- It stayed invisible because tests/e2e/prod-smoke-ap.spec.ts logs in with the
-- one account that still worked. That spec now runs all four.
--
-- Data-only. Four things, in order:
--   1. register the three missing managers,
--   2. give each of them 'regional-manager' on their own site only,
--   3. revoke manager-trang-an's three assignments outside Tràng An, so the
--      database stops claiming a scope the app denies,
--   4. re-attribute the seeded supplier invoices and their seeded audit trail
--      to the manager who actually runs that site.
--
-- Step 3 revokes rather than deletes: a role someone genuinely held until
-- today is history, and this system's whole argument is that history is not
-- rewritten. Step 4 does rewrite, but only rows this repository fabricated
-- itself (metadata->>'seed' = 'true'), never a row a real action produced.

begin;

-- 1. The three managers V12 created in code but never registered.
insert into public.erp_account_registry (
  account_id,
  tenant_id,
  display_name,
  job_title,
  employment_type,
  status
) values
  (
    'manager-tam-chuc',
    '00000000-0000-4000-8000-000000000001',
    'Trần Đức Long',
    'Quản lý vận hành Tam Chúc',
    'management',
    'active'
  ),
  (
    'manager-tam-coc',
    '00000000-0000-4000-8000-000000000001',
    'Phạm Anh Tuấn',
    'Quản lý vận hành Tam Cốc',
    'management',
    'active'
  ),
  (
    'manager-bai-dinh',
    '00000000-0000-4000-8000-000000000001',
    'Đặng Thị Hương',
    'Quản lý vận hành Bái Đính',
    'management',
    'active'
  )
on conflict (account_id) do nothing;

-- The incumbent stopped being a regional manager when the region was split.
update public.erp_account_registry
set job_title = 'Quản lý vận hành Tràng An',
    updated_at = now()
where account_id = 'manager-trang-an'
  and tenant_id = '00000000-0000-4000-8000-000000000001'
  and job_title <> 'Quản lý vận hành Tràng An';

-- 2. Each new manager gets the role on exactly one site. 'regional-manager'
-- is the role name the AP RPCs check; renaming it would mean rewriting those
-- functions and their contract tests for no behavioural gain, so the name
-- stays and the *scope* is what got narrowed.
insert into public.erp_account_role_assignments (
  id,
  tenant_id,
  account_id,
  role,
  site_id,
  effective_from,
  effective_until,
  status
) values
  (
    '71000000-0000-4000-8000-000000000014',
    '00000000-0000-4000-8000-000000000001',
    'manager-tam-chuc',
    'regional-manager',
    '10000000-0000-4000-8000-000000000009',
    '2026-08-01T00:00:00+07:00',
    null,
    'active'
  ),
  (
    '71000000-0000-4000-8000-000000000015',
    '00000000-0000-4000-8000-000000000001',
    'manager-tam-coc',
    'regional-manager',
    '10000000-0000-4000-8000-000000000005',
    '2026-08-01T00:00:00+07:00',
    null,
    'active'
  ),
  (
    '71000000-0000-4000-8000-000000000016',
    '00000000-0000-4000-8000-000000000001',
    'manager-bai-dinh',
    'regional-manager',
    '10000000-0000-4000-8000-000000000003',
    '2026-08-01T00:00:00+07:00',
    null,
    'active'
  )
on conflict (id) do nothing;

-- 3. Close out the old regional scope. erp_account_has_active_role requires
-- status = 'active' and effective_until in the future, so this takes effect
-- immediately while leaving the row readable as "held this until 01/08/2026".
update public.erp_account_role_assignments
set status = 'revoked',
    effective_until = '2026-08-01T00:00:00+07:00',
    updated_at = now()
where tenant_id = '00000000-0000-4000-8000-000000000001'
  and account_id = 'manager-trang-an'
  and role = 'regional-manager'
  and status = 'active'
  and site_id is not null
  and site_id <> '10000000-0000-4000-8000-000000000001';

-- 4. Every supplier invoice at the other three sites currently names the
-- Tràng An manager, because that was the only account the registry allowed.
-- In a system whose core claim is maker <> checker, an invoice attributed to
-- someone who does not run that site is a false record, not a cosmetic one.
--
-- `erp_ap_invoice_integrity` (migration 007) treats manager_account_id as
-- part of an invoice's immutable identity -- correct for every normal
-- transition, and exactly why a raw update here raises
-- AP_INVOICE_IDENTITY_IMMUTABLE instead of silently succeeding. This is the
-- one legitimate exception: a one-time correction of a wrong value the
-- registry bug itself produced, not a business transition. The trigger is
-- off only for this single statement, inside the same transaction as
-- everything else in this migration.
alter table public.erp_ap_supplier_invoices
  disable trigger erp_ap_invoice_integrity;

update public.erp_ap_supplier_invoices as invoice
set manager_account_id = site_manager.account_id,
    updated_at = now()
from (values
  ('10000000-0000-4000-8000-000000000009'::uuid, 'manager-tam-chuc'),
  ('10000000-0000-4000-8000-000000000005'::uuid, 'manager-tam-coc'),
  ('10000000-0000-4000-8000-000000000003'::uuid, 'manager-bai-dinh')
) as site_manager(site_id, account_id)
where invoice.site_id = site_manager.site_id
  and invoice.tenant_id = '00000000-0000-4000-8000-000000000001'
  and invoice.manager_account_id = 'manager-trang-an';

alter table public.erp_ap_supplier_invoices
  enable trigger erp_ap_invoice_integrity;

-- The matching audit lines, restricted to rows this repository seeded. A line
-- written by a real submission is left exactly as it happened, even if it
-- names the wrong manager -- that is evidence of the defect, and the fix for
-- it is that the defect can no longer recur.
--
-- `erp_ap_audit_immutable` (migration 007) refuses every update or delete on
-- this table, unconditionally -- the whole point of an append-only audit
-- trail. That has to give way for this one seeded-row correction the same
-- way the invoice trigger did above, and for the same reason: this is not a
-- business event being rewritten, it is a seeding bug being repaired.
alter table public.erp_ap_audit_events
  disable trigger erp_ap_audit_immutable;

update public.erp_ap_audit_events as event
set actor_account_id = site_manager.account_id
from (values
  ('10000000-0000-4000-8000-000000000009'::uuid, 'manager-tam-chuc'),
  ('10000000-0000-4000-8000-000000000005'::uuid, 'manager-tam-coc'),
  ('10000000-0000-4000-8000-000000000003'::uuid, 'manager-bai-dinh')
) as site_manager(site_id, account_id)
where event.site_id = site_manager.site_id
  and event.tenant_id = '00000000-0000-4000-8000-000000000001'
  and event.actor_account_id = 'manager-trang-an'
  and event.actor_role = 'manager'
  and event.metadata->>'seed' = 'true';

alter table public.erp_ap_audit_events
  enable trigger erp_ap_audit_immutable;

commit;
