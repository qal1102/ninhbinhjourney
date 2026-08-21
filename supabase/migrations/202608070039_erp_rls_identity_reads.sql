-- T6c-a: first authenticated RLS slice for ERP identity and grant reads.
--
-- Real Supabase Auth sessions may read only the registry, role and module
-- grant rows allowed by their active account/role assignments. Legacy demo
-- sessions remain on the server-only compatibility path until their accounts
-- receive individual Auth credentials. No authenticated direct writes are
-- opened in this migration; mutations keep going through the existing
-- guarded service-role RPCs.

begin;
create or replace function public.erp_rls_account_id(
  p_tenant_id uuid
)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select account.account_id
  from public.erp_account_registry account
  where account.tenant_id = p_tenant_id
    and account.auth_user_id = (select auth.uid())
    and account.status = 'active'
  limit 1
$$;
create or replace function public.erp_rls_has_active_role(
  p_tenant_id uuid,
  p_roles text[],
  p_site_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.erp_account_role_assignments assignment
    where assignment.tenant_id = p_tenant_id
      and assignment.account_id = public.erp_rls_account_id(p_tenant_id)
      and assignment.role = any(coalesce(p_roles, '{}'::text[]))
      and assignment.status = 'active'
      and assignment.effective_from <= now()
      and (
        assignment.effective_until is null
        or assignment.effective_until > now()
      )
      and (
        (p_site_id is null and assignment.site_id is null)
        or (
          p_site_id is not null
          and (assignment.site_id is null or assignment.site_id = p_site_id)
        )
      )
  )
$$;
create or replace function public.erp_rls_can_view_account(
  p_tenant_id uuid,
  p_target_account_id text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    public.erp_rls_account_id(p_tenant_id) = p_target_account_id
    or public.erp_rls_has_active_role(
      p_tenant_id,
      array['system-admin']::text[],
      null
    )
    or exists (
      select 1
      from public.erp_account_role_assignments viewer
      join public.erp_account_role_assignments target
        on target.tenant_id = viewer.tenant_id
       and target.account_id = p_target_account_id
       and target.status = 'active'
       and target.effective_from <= now()
       and (target.effective_until is null or target.effective_until > now())
       and target.site_id = viewer.site_id
      where viewer.tenant_id = p_tenant_id
        and viewer.account_id = public.erp_rls_account_id(p_tenant_id)
        and viewer.role = 'regional-manager'
        and viewer.status = 'active'
        and viewer.site_id is not null
        and viewer.effective_from <= now()
        and (viewer.effective_until is null or viewer.effective_until > now())
    )
$$;
revoke all on function public.erp_rls_account_id(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.erp_rls_has_active_role(uuid, text[], uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.erp_rls_can_view_account(uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.erp_rls_account_id(uuid)
  to authenticated, service_role;
grant execute on function public.erp_rls_has_active_role(uuid, text[], uuid)
  to authenticated, service_role;
grant execute on function public.erp_rls_can_view_account(uuid, text)
  to authenticated, service_role;
grant select on table public.erp_account_registry to authenticated;
grant select on table public.erp_account_role_assignments to authenticated;
grant select on table public.erp_account_admin_audit to authenticated;
grant select on table public.erp_employee_access to authenticated;
grant select on table public.erp_employee_access_audit to authenticated;
drop policy if exists erp_account_registry_authenticated_read
  on public.erp_account_registry;
create policy erp_account_registry_authenticated_read
on public.erp_account_registry for select to authenticated
using (
  public.erp_rls_can_view_account(tenant_id, account_id)
);
drop policy if exists erp_account_role_authenticated_read
  on public.erp_account_role_assignments;
create policy erp_account_role_authenticated_read
on public.erp_account_role_assignments for select to authenticated
using (
  public.erp_rls_can_view_account(tenant_id, account_id)
);
drop policy if exists erp_account_admin_audit_authenticated_read
  on public.erp_account_admin_audit;
create policy erp_account_admin_audit_authenticated_read
on public.erp_account_admin_audit for select to authenticated
using (
  public.erp_rls_can_view_account(tenant_id, target_account_id)
);
drop policy if exists erp_employee_access_authenticated_read
  on public.erp_employee_access;
create policy erp_employee_access_authenticated_read
on public.erp_employee_access for select to authenticated
using (
  employee_account_id = public.erp_rls_account_id(tenant_id)
  or public.erp_rls_has_active_role(
    tenant_id,
    array['regional-manager', 'director', 'system-admin']::text[],
    site_id
  )
);
drop policy if exists erp_employee_access_audit_authenticated_read
  on public.erp_employee_access_audit;
create policy erp_employee_access_audit_authenticated_read
on public.erp_employee_access_audit for select to authenticated
using (
  employee_account_id = public.erp_rls_account_id(tenant_id)
  or public.erp_rls_has_active_role(
    tenant_id,
    array['regional-manager', 'director', 'system-admin']::text[],
    site_id
  )
);
commit;
