-- Persist employee site/module access grants and attendance check-in/out
-- events to Supabase instead of a per-browser signed cookie.
--
-- Both `staff-access-manager.tsx` and `attendance-panel.tsx` already call
-- validated Next.js Server Actions, but those actions previously wrote only
-- to `nbj-erp-demo-access` / `nbj-erp-demo-attendance` cookies scoped to the
-- acting browser. A manager granting an employee a module, or an employee
-- checking in, was invisible to any other device/session. This migration
-- gives both flows real shared persistence, matching the pattern already
-- used by shift-close/workday/accounting/supplier-AP. Direct client access
-- is denied; the service role calls the RPCs below after the signed ERP
-- session and role scope have been checked by server actions.
--
-- The attendance table is named `erp_staff_attendance_events`, not
-- `erp_attendance_events`: an earlier migration already created a
-- differently-shaped `erp_attendance_events` table (uuid `user_id`, no
-- `business_date`/`idempotency_key`) that nothing in this app reads or
-- writes. Reusing that name/shape would either collide or silently adopt
-- an incompatible schema, so this migration uses its own table instead of
-- touching that pre-existing, unrelated one.

begin;

create table if not exists public.erp_employee_access (
  employee_account_id text primary key check (char_length(employee_account_id) between 2 and 100),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  site_id uuid references public.sites(id) on delete set null,
  module_ids text[] not null default '{}'::text[],
  version integer not null default 1 check (version > 0),
  updated_by_account_id text check (updated_by_account_id is null or char_length(updated_by_account_id) between 2 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (site_id is not null or module_ids = '{}'::text[]),
  check (array_length(module_ids, 1) is null or array_length(module_ids, 1) <= 20)
);

create table if not exists public.erp_employee_access_audit (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  employee_account_id text not null check (char_length(employee_account_id) between 2 and 100),
  site_id uuid not null references public.sites(id) on delete cascade,
  actor_account_id text not null check (char_length(actor_account_id) between 2 and 100),
  action text not null check (action in ('employee.access.updated', 'employee.site.revoked')),
  module_ids text[] not null default '{}'::text[],
  created_at timestamptz not null default now()
);

create index if not exists erp_employee_access_audit_site_idx
  on public.erp_employee_access_audit(site_id, created_at desc);
create index if not exists erp_employee_access_audit_employee_idx
  on public.erp_employee_access_audit(employee_account_id, created_at desc);

create table if not exists public.erp_staff_attendance_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete restrict,
  user_account_id text not null check (char_length(user_account_id) between 2 and 100),
  event_type text not null check (event_type in ('check-in', 'check-out')),
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  accuracy_meters double precision check (accuracy_meters is null or accuracy_meters >= 0),
  source text not null default 'gps' check (source in ('gps', 'demo-location')),
  business_date date not null,
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 200),
  created_at timestamptz not null default now(),
  unique (tenant_id, idempotency_key)
);

create index if not exists erp_staff_attendance_user_site_date_idx
  on public.erp_staff_attendance_events(user_account_id, site_id, business_date, created_at desc);
create index if not exists erp_staff_attendance_site_date_idx
  on public.erp_staff_attendance_events(site_id, business_date desc, created_at desc);

create or replace function public.erp_update_employee_access(
  p_tenant_id uuid,
  p_employee_account_id text,
  p_site_context_id uuid,
  p_site_active boolean,
  p_module_ids text[],
  p_actor_account_id text,
  p_actor_role text
)
returns public.erp_employee_access
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.erp_employee_access;
  v_role text := lower(trim(coalesce(p_actor_role, '')));
  v_employee_id text := trim(coalesce(p_employee_account_id, ''));
  v_actor_id text := trim(coalesce(p_actor_account_id, ''));
  v_modules text[] := coalesce(p_module_ids, '{}'::text[]);
  v_action text;
  v_site_id uuid := case when p_site_active then p_site_context_id else null end;
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

  insert into public.erp_employee_access (
    employee_account_id, tenant_id, site_id, module_ids,
    version, updated_by_account_id
  ) values (
    v_employee_id, p_tenant_id, v_site_id,
    case when p_site_active then v_modules else '{}'::text[] end,
    1, v_actor_id
  )
  on conflict (employee_account_id) do update set
    tenant_id = excluded.tenant_id,
    site_id = excluded.site_id,
    module_ids = excluded.module_ids,
    version = public.erp_employee_access.version + 1,
    updated_by_account_id = excluded.updated_by_account_id,
    updated_at = now()
  returning * into v_row;

  insert into public.erp_employee_access_audit (
    tenant_id, employee_account_id, site_id, actor_account_id, action, module_ids
  ) values (
    p_tenant_id, v_employee_id, p_site_context_id, v_actor_id, v_action,
    case when p_site_active then v_modules else '{}'::text[] end
  );

  return v_row;
end;
$$;

create or replace function public.erp_record_attendance_event(
  p_tenant_id uuid,
  p_site_id uuid,
  p_user_account_id text,
  p_event_type text,
  p_latitude double precision,
  p_longitude double precision,
  p_accuracy_meters double precision,
  p_source text,
  p_business_date date,
  p_idempotency_key text
)
returns public.erp_staff_attendance_events
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.erp_staff_attendance_events;
  v_last public.erp_staff_attendance_events;
  v_type text := lower(trim(coalesce(p_event_type, '')));
  v_source text := lower(trim(coalesce(p_source, 'gps')));
  v_user_id text := trim(coalesce(p_user_account_id, ''));
  v_key text := trim(coalesce(p_idempotency_key, ''));
begin
  select * into v_event
  from public.erp_staff_attendance_events
  where tenant_id = p_tenant_id and idempotency_key = v_key;
  if v_event.id is not null then return v_event; end if;

  if v_type not in ('check-in', 'check-out')
     or v_source not in ('gps', 'demo-location')
     or char_length(v_user_id) not between 2 and 100
     or char_length(v_key) not between 8 and 200
     or p_business_date is null then
    raise exception using errcode = '22023', message = 'ATTENDANCE_INPUT_INVALID';
  end if;
  if not exists (
    select 1 from public.sites s where s.id = p_site_id and s.tenant_id = p_tenant_id
  ) then
    raise exception using errcode = '23503', message = 'ATTENDANCE_SITE_TENANT_MISMATCH';
  end if;

  select * into v_last
  from public.erp_staff_attendance_events
  where tenant_id = p_tenant_id
    and user_account_id = v_user_id
    and site_id = p_site_id
    and business_date = p_business_date
  order by created_at desc
  limit 1;

  if v_type = 'check-in' and v_last.event_type = 'check-in' then
    raise exception using errcode = '22023', message = 'ATTENDANCE_ALREADY_CHECKED_IN';
  end if;
  if v_type = 'check-out' and (v_last.id is null or v_last.event_type <> 'check-in') then
    raise exception using errcode = '22023', message = 'ATTENDANCE_NO_OPEN_CHECK_IN';
  end if;

  insert into public.erp_staff_attendance_events (
    tenant_id, site_id, user_account_id, event_type,
    latitude, longitude, accuracy_meters, source,
    business_date, idempotency_key
  ) values (
    p_tenant_id, p_site_id, v_user_id, v_type,
    p_latitude, p_longitude, p_accuracy_meters, v_source,
    p_business_date, v_key
  )
  returning * into v_event;

  return v_event;
end;
$$;

alter table public.erp_employee_access enable row level security;
alter table public.erp_employee_access_audit enable row level security;
alter table public.erp_staff_attendance_events enable row level security;

revoke all on table public.erp_employee_access from public, anon, authenticated, service_role;
revoke all on table public.erp_employee_access_audit from public, anon, authenticated, service_role;
revoke all on table public.erp_staff_attendance_events from public, anon, authenticated, service_role;
grant select on table public.erp_employee_access to service_role;
grant select on table public.erp_employee_access_audit to service_role;
grant select on table public.erp_staff_attendance_events to service_role;

create policy erp_employee_access_service_read on public.erp_employee_access
for select to service_role using (true);
create policy erp_employee_access_audit_service_read on public.erp_employee_access_audit
for select to service_role using (true);
create policy erp_staff_attendance_events_service_read on public.erp_staff_attendance_events
for select to service_role using (true);

revoke all on function public.erp_update_employee_access(uuid, text, uuid, boolean, text[], text, text)
  from public, anon, authenticated, service_role;
revoke all on function public.erp_record_attendance_event(uuid, uuid, text, text, double precision, double precision, double precision, text, date, text)
  from public, anon, authenticated, service_role;
grant execute on function public.erp_update_employee_access(uuid, text, uuid, boolean, text[], text, text)
  to service_role;
grant execute on function public.erp_record_attendance_event(uuid, uuid, text, text, double precision, double precision, double precision, text, date, text)
  to service_role;

commit;
