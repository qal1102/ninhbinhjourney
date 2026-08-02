-- T6 + T7: one account can hold more than one site, and somebody can be put
-- in charge of accounts without editing source code.
--
-- Two structural facts made both impossible:
--
--   1. `erp_employee_access` is keyed on `employee_account_id` alone, with a
--      single nullable `site_id`. One row per person, one site per person.
--      "Quản lý X phụ trách ba khu" is not something this table can express,
--      no matter what the UI offers. The primary key becomes
--      (employee_account_id, site_id), and revoking a site deletes that one
--      row instead of blanking the person's only row.
--
--   2. Creating or suspending an account meant editing lib/erp/demo-data.ts
--      and deploying. `erp_account_registry` already has everything needed --
--      `status` (active/suspended/revoked) and `auth_user_id` pointing at
--      Supabase Auth -- but nothing could write to it. Three RPCs now can,
--      and only for an actor holding `system-admin`.
--
-- On `system-admin` being separate from `director`: creating accounts and
-- granting roles is a technical power -- whoever holds it can give themselves
-- every other power. Keeping it distinct is what lets an audit line answer
-- "in what capacity was he acting?" when the same person approves a payment
-- and edits permissions. The director is granted both, which is normal; the
-- log can still tell the two apart.
--
-- Not in this migration, on purpose: Supabase Auth login (bước 4 of
-- docs/reference/KE_HOACH_HOP_NHAT_TAI_KHOAN.md). That is the expensive step
-- and the one the previous architecture migration died in the middle of.
-- Everything here stands on its own if the next step never happens.

begin;

-- 1. Multi-site access ------------------------------------------------------

-- A row with no site carries no grant; it is the old table's way of saying
-- "revoked". Under the new key that state is simply the absence of a row.
delete from public.erp_employee_access where site_id is null;

alter table public.erp_employee_access
  drop constraint if exists erp_employee_access_pkey;

alter table public.erp_employee_access
  alter column site_id set not null;

-- The old guard ("no site means no modules") is left in place: with site_id
-- NOT NULL it can no longer fail, and dropping a check by its auto-generated
-- name is exactly the kind of thing that removes the wrong constraint.
alter table public.erp_employee_access
  add constraint erp_employee_access_pkey
  primary key (employee_account_id, site_id);

create index if not exists erp_employee_access_account_idx
  on public.erp_employee_access(employee_account_id);

-- 2. system-admin as a real role -------------------------------------------

alter table public.erp_account_role_assignments
  drop constraint if exists erp_account_role_assignments_role_check;

alter table public.erp_account_role_assignments
  add constraint erp_account_role_assignments_role_check
  check (
    role in (
      'employee',
      'regional-manager',
      'accountant-maker',
      'accounting-checker',
      'director',
      'system-admin'
    )
  );

insert into public.erp_account_role_assignments (
  id, tenant_id, account_id, role, site_id, effective_from, effective_until, status
) values (
  '71000000-0000-4000-8000-000000000017',
  '00000000-0000-4000-8000-000000000001',
  'director-001',
  'system-admin',
  null,
  '2024-01-01T00:00:00+07:00',
  null,
  'active'
)
on conflict (id) do nothing;

-- 3. Administration audit ---------------------------------------------------

create table if not exists public.erp_account_admin_audit (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  actor_account_id text not null check (char_length(actor_account_id) between 2 and 100),
  target_account_id text not null check (char_length(target_account_id) between 2 and 100),
  action text not null check (
    action in (
      'account.created',
      'account.updated',
      'account.status.changed',
      'account.role.granted',
      'account.role.revoked'
    )
  ),
  detail jsonb not null default '{}'::jsonb check (jsonb_typeof(detail) = 'object'),
  created_at timestamptz not null default now()
);

create index if not exists erp_account_admin_audit_target_idx
  on public.erp_account_admin_audit(target_account_id, created_at desc);

-- 4. Administration RPCs ----------------------------------------------------

-- Every one of these refuses unless the actor holds an active `system-admin`
-- assignment, checked through the same helper the accounting and AP RPCs use.
create or replace function public.erp_admin_requires_system_admin(
  p_tenant_id uuid,
  p_actor_account_id text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.erp_account_has_active_role(
    p_tenant_id,
    trim(coalesce(p_actor_account_id, '')),
    'system-admin',
    null
  ) then
    raise exception using errcode = '42501', message = 'ACCOUNT_ADMIN_ROLE_REQUIRED';
  end if;
end;
$$;

create or replace function public.erp_admin_upsert_account(
  p_tenant_id uuid,
  p_actor_account_id text,
  p_account_id text,
  p_display_name text,
  p_job_title text,
  p_employment_type text,
  p_status text
)
returns public.erp_account_registry
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.erp_account_registry;
  v_account text := trim(coalesce(p_account_id, ''));
  v_existed boolean;
begin
  perform public.erp_admin_requires_system_admin(p_tenant_id, p_actor_account_id);

  if char_length(v_account) not between 2 and 100
     or char_length(trim(coalesce(p_display_name, ''))) not between 2 and 120
     or char_length(trim(coalesce(p_job_title, ''))) not between 2 and 160
     or p_employment_type not in ('permanent', 'seasonal', 'management', 'finance', 'executive')
     or p_status not in ('active', 'suspended', 'revoked') then
    raise exception using errcode = '22023', message = 'ACCOUNT_ADMIN_INPUT_INVALID';
  end if;

  select exists (
    select 1 from public.erp_account_registry account
    where account.account_id = v_account and account.tenant_id = p_tenant_id
  ) into v_existed;

  insert into public.erp_account_registry (
    account_id, tenant_id, display_name, job_title, employment_type, status
  ) values (
    v_account, p_tenant_id, trim(p_display_name), trim(p_job_title),
    p_employment_type, p_status
  )
  on conflict (account_id) do update set
    display_name = excluded.display_name,
    job_title = excluded.job_title,
    employment_type = excluded.employment_type,
    status = excluded.status,
    updated_at = now()
  returning * into v_row;

  insert into public.erp_account_admin_audit (
    tenant_id, actor_account_id, target_account_id, action, detail
  ) values (
    p_tenant_id, trim(p_actor_account_id), v_account,
    case when v_existed then 'account.updated' else 'account.created' end,
    jsonb_build_object(
      'display_name', v_row.display_name,
      'job_title', v_row.job_title,
      'employment_type', v_row.employment_type,
      'status', v_row.status
    )
  );

  return v_row;
end;
$$;

create or replace function public.erp_admin_set_account_status(
  p_tenant_id uuid,
  p_actor_account_id text,
  p_account_id text,
  p_status text
)
returns public.erp_account_registry
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.erp_account_registry;
  v_account text := trim(coalesce(p_account_id, ''));
begin
  perform public.erp_admin_requires_system_admin(p_tenant_id, p_actor_account_id);

  if p_status not in ('active', 'suspended', 'revoked') then
    raise exception using errcode = '22023', message = 'ACCOUNT_ADMIN_INPUT_INVALID';
  end if;
  -- Locking yourself out is not a recoverable mistake in a system with no
  -- other way back in.
  if v_account = trim(coalesce(p_actor_account_id, '')) and p_status <> 'active' then
    raise exception using errcode = '22023', message = 'ACCOUNT_ADMIN_CANNOT_LOCK_SELF';
  end if;

  update public.erp_account_registry set
    status = p_status,
    updated_at = now()
  where account_id = v_account and tenant_id = p_tenant_id
  returning * into v_row;

  if v_row.account_id is null then
    raise exception using errcode = 'P0002', message = 'ACCOUNT_ADMIN_ACCOUNT_NOT_FOUND';
  end if;

  insert into public.erp_account_admin_audit (
    tenant_id, actor_account_id, target_account_id, action, detail
  ) values (
    p_tenant_id, trim(p_actor_account_id), v_account,
    'account.status.changed',
    jsonb_build_object('status', p_status)
  );

  return v_row;
end;
$$;

create or replace function public.erp_admin_set_role_assignment(
  p_tenant_id uuid,
  p_actor_account_id text,
  p_account_id text,
  p_role text,
  p_site_id uuid,
  p_active boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_account text := trim(coalesce(p_account_id, ''));
  v_actor text := trim(coalesce(p_actor_account_id, ''));
  v_id uuid;
begin
  perform public.erp_admin_requires_system_admin(p_tenant_id, v_actor);

  if p_role not in (
    'employee', 'regional-manager', 'accountant-maker',
    'accounting-checker', 'director', 'system-admin'
  ) then
    raise exception using errcode = '22023', message = 'ACCOUNT_ADMIN_INPUT_INVALID';
  end if;
  if not exists (
    select 1 from public.erp_account_registry account
    where account.account_id = v_account and account.tenant_id = p_tenant_id
  ) then
    raise exception using errcode = 'P0002', message = 'ACCOUNT_ADMIN_ACCOUNT_NOT_FOUND';
  end if;
  if p_site_id is not null and not exists (
    select 1 from public.sites s where s.id = p_site_id and s.tenant_id = p_tenant_id
  ) then
    raise exception using errcode = '23503', message = 'ACCOUNT_ADMIN_SITE_TENANT_MISMATCH';
  end if;
  -- Same reasoning as locking yourself out: an admin who revokes their own
  -- admin role has no way to grant it back.
  if v_account = v_actor and p_role = 'system-admin' and not p_active then
    raise exception using errcode = '22023', message = 'ACCOUNT_ADMIN_CANNOT_LOCK_SELF';
  end if;

  if p_active then
    insert into public.erp_account_role_assignments (
      tenant_id, account_id, role, site_id, effective_from, status
    ) values (
      p_tenant_id, v_account, p_role, p_site_id, now(), 'active'
    )
    on conflict (
      tenant_id, account_id, role,
      coalesce(site_id, '00000000-0000-0000-0000-000000000000'::uuid)
    ) do update set
      status = 'active',
      effective_until = null,
      updated_at = now()
    returning id into v_id;
  else
    update public.erp_account_role_assignments set
      status = 'revoked',
      effective_until = now(),
      updated_at = now()
    where tenant_id = p_tenant_id
      and account_id = v_account
      and role = p_role
      and coalesce(site_id, '00000000-0000-0000-0000-000000000000'::uuid)
        = coalesce(p_site_id, '00000000-0000-0000-0000-000000000000'::uuid)
    returning id into v_id;
  end if;

  insert into public.erp_account_admin_audit (
    tenant_id, actor_account_id, target_account_id, action, detail
  ) values (
    p_tenant_id, v_actor, v_account,
    case when p_active then 'account.role.granted' else 'account.role.revoked' end,
    jsonb_build_object('role', p_role, 'site_id', p_site_id)
  );

  return jsonb_build_object(
    'assignment_id', v_id,
    'account_id', v_account,
    'role', p_role,
    'site_id', p_site_id,
    'active', p_active
  );
end;
$$;

-- 5. Multi-site aware module grant -----------------------------------------

-- The return type changes (a revoke now deletes the row, so there is nothing
-- to return), which `create or replace` cannot do.
drop function if exists public.erp_update_employee_access(
  uuid, text, uuid, boolean, text[], text, text
);

create function public.erp_update_employee_access(
  p_tenant_id uuid,
  p_employee_account_id text,
  p_site_context_id uuid,
  p_site_active boolean,
  p_module_ids text[],
  p_actor_account_id text,
  p_actor_role text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text := lower(trim(coalesce(p_actor_role, '')));
  v_employee_id text := trim(coalesce(p_employee_account_id, ''));
  v_actor_id text := trim(coalesce(p_actor_account_id, ''));
  v_modules text[] := coalesce(p_module_ids, '{}'::text[]);
  v_action text;
  v_module_ids text[] := '{}'::text[];
  v_version integer := 0;
begin
  if v_role not in ('manager', 'director')
     or char_length(v_employee_id) not between 2 and 100
     or char_length(v_actor_id) not between 2 and 100
     or p_site_context_id is null then
    raise exception using errcode = '42501', message = 'EMPLOYEE_ACCESS_ACTOR_INVALID';
  end if;
  if array_length(v_modules, 1) is not null and array_length(v_modules, 1) > 20 then
    raise exception using errcode = '22023', message = 'EMPLOYEE_ACCESS_TOO_MANY_MODULES';
  end if;
  if not exists (
    select 1 from public.sites s where s.id = p_site_context_id and s.tenant_id = p_tenant_id
  ) then
    raise exception using errcode = '23503', message = 'EMPLOYEE_ACCESS_SITE_TENANT_MISMATCH';
  end if;

  v_action := case when p_site_active then 'employee.access.updated' else 'employee.site.revoked' end;

  if p_site_active then
    insert into public.erp_employee_access (
      employee_account_id, tenant_id, site_id, module_ids, version, updated_by_account_id
    ) values (
      v_employee_id, p_tenant_id, p_site_context_id, v_modules, 1, v_actor_id
    )
    on conflict (employee_account_id, site_id) do update set
      tenant_id = excluded.tenant_id,
      module_ids = excluded.module_ids,
      version = public.erp_employee_access.version + 1,
      updated_by_account_id = excluded.updated_by_account_id,
      updated_at = now()
    returning module_ids, version into v_module_ids, v_version;
  else
    -- Revoking one site must leave every other site this person holds intact.
    -- Under the old single-row key that was not expressible at all.
    delete from public.erp_employee_access
    where employee_account_id = v_employee_id
      and site_id = p_site_context_id
      and tenant_id = p_tenant_id;
  end if;

  insert into public.erp_employee_access_audit (
    tenant_id, employee_account_id, site_id, actor_account_id, action, module_ids
  ) values (
    p_tenant_id, v_employee_id, p_site_context_id, v_actor_id, v_action,
    case when p_site_active then v_modules else '{}'::text[] end
  );

  return jsonb_build_object(
    'employee_account_id', v_employee_id,
    'site_id', case when p_site_active then p_site_context_id else null end,
    'module_ids', to_jsonb(v_module_ids),
    'version', v_version,
    'action', v_action
  );
end;
$$;

-- 6. Locks ------------------------------------------------------------------

alter table public.erp_account_admin_audit enable row level security;

revoke all on table public.erp_account_admin_audit
  from public, anon, authenticated, service_role;
grant select on table public.erp_account_admin_audit to service_role;

drop policy if exists erp_account_admin_audit_service_read
  on public.erp_account_admin_audit;
create policy erp_account_admin_audit_service_read
on public.erp_account_admin_audit
for select
to service_role
using (tenant_id = '00000000-0000-4000-8000-000000000001'::uuid);

revoke all on function public.erp_admin_requires_system_admin(uuid, text)
  from public, anon, authenticated;
revoke all on function public.erp_admin_upsert_account(uuid, text, text, text, text, text, text)
  from public, anon, authenticated;
revoke all on function public.erp_admin_set_account_status(uuid, text, text, text)
  from public, anon, authenticated;
revoke all on function public.erp_admin_set_role_assignment(uuid, text, text, text, uuid, boolean)
  from public, anon, authenticated;
revoke all on function public.erp_update_employee_access(uuid, text, uuid, boolean, text[], text, text)
  from public, anon, authenticated;

grant execute on function public.erp_admin_upsert_account(uuid, text, text, text, text, text, text)
  to service_role;
grant execute on function public.erp_admin_set_account_status(uuid, text, text, text)
  to service_role;
grant execute on function public.erp_admin_set_role_assignment(uuid, text, text, text, uuid, boolean)
  to service_role;
grant execute on function public.erp_update_employee_access(uuid, text, uuid, boolean, text[], text, text)
  to service_role;

commit;
