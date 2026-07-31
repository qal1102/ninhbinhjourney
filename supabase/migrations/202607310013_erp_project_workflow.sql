-- Build the "Dự án & sự kiện" (project/event) module from scratch on
-- Supabase. Unlike every other decorative-action fix in this batch,
-- `project-event-workspace.tsx` had no action at all -- not even a fake
-- one -- to wire up: all data (`ERP_PROJECT_EVENTS`, `workBySite`,
-- `milestones`) was hard-coded directly in the component. This migration
-- gives it a real WBS (event -> milestone -> work item), dependencies
-- between work items, a change-request approval flow, a maker/checker
-- style acceptance step, and cost settlement -- matching the gap PLAN.md
-- already documented for this module.
--
-- Deliberately simpler than the supplier-AP workflow (no advisory locks,
-- no idempotency-key command receipts): this is demo-scale data, and the
-- optimistic-version pattern already used by incidents/staff-access is
-- sufficient here.
--
-- The work-item table is named `erp_project_action_items`, not
-- `erp_project_work_items`: a first apply attempt failed because an
-- earlier, unrelated migration already created a differently-shaped
-- `erp_project_work_items` table (project_id, workstream, owner_user_id,
-- escalation_level, evidence jsonb -- part of a separate `erp_projects`
-- table this module doesn't use) that nothing in this app reads or
-- writes. Reusing that name/shape would either collide or silently adopt
-- an incompatible schema, so this migration uses its own table --
-- same pattern as `erp_staff_attendance_events` avoiding the pre-existing
-- `erp_attendance_events` (migration 202607310009) and
-- `erp_field_operation_reports` avoiding the pre-existing
-- `erp_field_reports` (migration 202607310012).

begin;

create table if not exists public.erp_project_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  event_date date not null,
  budget_billion numeric(10, 2) not null check (budget_billion > 0),
  committed_billion numeric(10, 2) not null default 0 check (committed_billion >= 0),
  expected_guests integer not null check (expected_guests > 0),
  next_milestone text not null check (char_length(next_milestone) between 1 and 300),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (site_id)
);

create table if not exists public.erp_project_milestones (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.erp_project_events(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 150),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (event_id, name)
);

create table if not exists public.erp_project_action_items (
  id uuid primary key default gen_random_uuid(),
  milestone_id uuid not null references public.erp_project_milestones(id) on delete cascade,
  event_id uuid not null references public.erp_project_events(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  code text not null unique check (char_length(code) between 3 and 30),
  title text not null check (char_length(title) between 1 and 300),
  owner_team text not null check (char_length(owner_team) between 1 and 200),
  assignee_account_id text check (assignee_account_id is null or char_length(assignee_account_id) between 2 and 100),
  due_date date not null,
  status text not null default 'open' check (status in ('open', 'in-progress', 'blocked', 'ready-for-acceptance', 'done')),
  progress_percent integer not null default 0 check (progress_percent between 0 and 100),
  requires_settlement boolean not null default false,
  blocked_reason text,
  submitted_for_acceptance_by text,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists erp_project_action_items_milestone_idx
  on public.erp_project_action_items(milestone_id);
create index if not exists erp_project_action_items_site_status_idx
  on public.erp_project_action_items(site_id, status, due_date);

create table if not exists public.erp_project_work_item_dependencies (
  work_item_id uuid not null references public.erp_project_action_items(id) on delete cascade,
  depends_on_work_item_id uuid not null references public.erp_project_action_items(id) on delete cascade,
  primary key (work_item_id, depends_on_work_item_id),
  check (work_item_id <> depends_on_work_item_id)
);

create table if not exists public.erp_project_change_requests (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.erp_project_events(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  kind text not null check (kind in ('budget', 'deadline', 'scope')),
  summary text not null check (char_length(summary) between 1 and 500),
  proposed_budget_billion numeric(10, 2) check (proposed_budget_billion is null or proposed_budget_billion > 0),
  proposed_event_date date,
  note text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  requested_by_account_id text not null check (char_length(requested_by_account_id) between 2 and 100),
  requested_by_name text not null,
  decided_by_account_id text,
  decided_by_name text,
  decided_at timestamptz,
  decision_note text,
  created_at timestamptz not null default now()
);

create index if not exists erp_project_change_requests_event_idx
  on public.erp_project_change_requests(event_id, status, created_at desc);

create table if not exists public.erp_project_settlements (
  id uuid primary key default gen_random_uuid(),
  work_item_id uuid not null references public.erp_project_action_items(id) on delete cascade,
  event_id uuid not null references public.erp_project_events(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  amount_billion numeric(10, 2) not null check (amount_billion > 0),
  note text not null check (char_length(note) between 1 and 1000),
  finance_code text not null check (char_length(finance_code) between 1 and 60),
  recorded_by_account_id text not null check (char_length(recorded_by_account_id) between 2 and 100),
  recorded_by_name text not null,
  recorded_at timestamptz not null default now()
);

create index if not exists erp_project_settlements_event_idx
  on public.erp_project_settlements(event_id, recorded_at desc);

create table if not exists public.erp_project_audit_events (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.erp_project_events(id) on delete cascade,
  work_item_id uuid references public.erp_project_action_items(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  actor_account_id text not null check (char_length(actor_account_id) between 2 and 100),
  actor_name text not null,
  action text not null,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists erp_project_audit_events_event_idx
  on public.erp_project_audit_events(event_id, created_at desc);

-- ---------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------

create or replace function public.erp_project_update_work_item_progress(
  p_tenant_id uuid,
  p_work_item_code text,
  p_actor_account_id text,
  p_actor_name text,
  p_actor_role text,
  p_next_status text,
  p_progress_percent integer
)
returns public.erp_project_action_items
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.erp_project_action_items;
  v_role text := lower(trim(coalesce(p_actor_role, '')));
  v_actor_id text := trim(coalesce(p_actor_account_id, ''));
  v_actor_name text := trim(coalesce(p_actor_name, ''));
  v_next text := lower(trim(coalesce(p_next_status, '')));
  v_progress integer := p_progress_percent;
  v_pending_deps integer;
  v_action text;
  v_note text;
begin
  if char_length(v_actor_id) not between 2 and 100 or char_length(v_actor_name) < 1 then
    raise exception using errcode = '42501', message = 'PROJECT_ACTOR_INVALID';
  end if;

  select * into v_row
  from public.erp_project_action_items
  where code = p_work_item_code and tenant_id = p_tenant_id
  for update;
  if v_row.id is null then
    raise exception using errcode = 'P0002', message = 'PROJECT_WORK_ITEM_NOT_FOUND';
  end if;

  if v_next = v_row.status and v_row.status in ('open', 'in-progress') then
    if v_role not in ('employee', 'manager')
       or (v_role = 'employee' and v_row.assignee_account_id is distinct from v_actor_id) then
      raise exception using errcode = '42501', message = 'PROJECT_ACTOR_NOT_ALLOWED';
    end if;
    v_progress := coalesce(v_progress, v_row.progress_percent);
    v_action := 'Cập nhật tiến độ';
    v_note := v_progress || '%';
    update public.erp_project_action_items set
      progress_percent = v_progress,
      version = version + 1,
      updated_at = now()
    where id = v_row.id
    returning * into v_row;

  elsif v_row.status = 'open' and v_next = 'in-progress' then
    if v_role not in ('employee', 'manager')
       or (v_role = 'employee' and v_row.assignee_account_id is distinct from v_actor_id) then
      raise exception using errcode = '42501', message = 'PROJECT_ACTOR_NOT_ALLOWED';
    end if;
    v_action := 'Bắt đầu xử lý';
    v_note := null;
    update public.erp_project_action_items set
      status = 'in-progress',
      progress_percent = coalesce(v_progress, greatest(progress_percent, 5)),
      version = version + 1,
      updated_at = now()
    where id = v_row.id
    returning * into v_row;

  elsif v_row.status = 'in-progress' and v_next = 'ready-for-acceptance' then
    if v_role not in ('employee', 'manager')
       or (v_role = 'employee' and v_row.assignee_account_id is distinct from v_actor_id) then
      raise exception using errcode = '42501', message = 'PROJECT_ACTOR_NOT_ALLOWED';
    end if;
    select count(*) into v_pending_deps
    from public.erp_project_work_item_dependencies dep
    join public.erp_project_action_items dep_item on dep_item.id = dep.depends_on_work_item_id
    where dep.work_item_id = v_row.id and dep_item.status <> 'done';
    if v_pending_deps > 0 then
      raise exception using errcode = '22023', message = 'PROJECT_WORK_ITEM_DEPENDENCY_NOT_DONE';
    end if;
    v_action := 'Gửi nghiệm thu';
    v_note := null;
    update public.erp_project_action_items set
      status = 'ready-for-acceptance',
      progress_percent = 100,
      submitted_for_acceptance_by = v_actor_id,
      version = version + 1,
      updated_at = now()
    where id = v_row.id
    returning * into v_row;

  elsif v_row.status = 'ready-for-acceptance' and v_next = 'done' then
    if v_role not in ('manager', 'director') then
      raise exception using errcode = '42501', message = 'PROJECT_ACTOR_NOT_ALLOWED';
    end if;
    if v_row.submitted_for_acceptance_by is not distinct from v_actor_id then
      raise exception using errcode = '42501', message = 'PROJECT_WORK_ITEM_SELF_ACCEPT';
    end if;
    v_action := 'Xác nhận hoàn thành';
    v_note := null;
    update public.erp_project_action_items set
      status = 'done',
      version = version + 1,
      updated_at = now()
    where id = v_row.id
    returning * into v_row;

  elsif v_row.status = 'ready-for-acceptance' and v_next = 'in-progress' then
    if v_role not in ('manager', 'director') then
      raise exception using errcode = '42501', message = 'PROJECT_ACTOR_NOT_ALLOWED';
    end if;
    v_action := 'Trả lại yêu cầu làm thêm';
    v_note := null;
    update public.erp_project_action_items set
      status = 'in-progress',
      submitted_for_acceptance_by = null,
      version = version + 1,
      updated_at = now()
    where id = v_row.id
    returning * into v_row;

  else
    raise exception using errcode = '22023', message = 'PROJECT_WORK_ITEM_NO_TRANSITION';
  end if;

  insert into public.erp_project_audit_events (
    event_id, work_item_id, tenant_id, site_id, actor_account_id, actor_name, action, note
  ) values (
    v_row.event_id, v_row.id, p_tenant_id, v_row.site_id, v_actor_id, v_actor_name, v_action, v_note
  );

  return v_row;
end;
$$;

create or replace function public.erp_project_report_blocker(
  p_tenant_id uuid,
  p_work_item_code text,
  p_actor_account_id text,
  p_actor_name text,
  p_actor_role text,
  p_reason text
)
returns public.erp_project_action_items
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.erp_project_action_items;
  v_role text := lower(trim(coalesce(p_actor_role, '')));
  v_actor_id text := trim(coalesce(p_actor_account_id, ''));
  v_actor_name text := trim(coalesce(p_actor_name, ''));
  v_reason text := trim(coalesce(p_reason, ''));
  v_action text;
begin
  if v_role not in ('employee', 'manager')
     or char_length(v_actor_id) not between 2 and 100
     or char_length(v_actor_name) < 1 then
    raise exception using errcode = '42501', message = 'PROJECT_ACTOR_INVALID';
  end if;

  select * into v_row
  from public.erp_project_action_items
  where code = p_work_item_code and tenant_id = p_tenant_id
  for update;
  if v_row.id is null then
    raise exception using errcode = 'P0002', message = 'PROJECT_WORK_ITEM_NOT_FOUND';
  end if;
  if v_role = 'employee' and v_row.assignee_account_id is distinct from v_actor_id then
    raise exception using errcode = '42501', message = 'PROJECT_ACTOR_NOT_ALLOWED';
  end if;

  if v_row.status = 'in-progress' then
    if char_length(v_reason) < 1 then
      raise exception using errcode = '22023', message = 'PROJECT_BLOCKER_REASON_REQUIRED';
    end if;
    v_action := 'Báo chặn';
    update public.erp_project_action_items set
      status = 'blocked',
      blocked_reason = v_reason,
      version = version + 1,
      updated_at = now()
    where id = v_row.id
    returning * into v_row;
  elsif v_row.status = 'blocked' then
    v_action := 'Gỡ chặn';
    update public.erp_project_action_items set
      status = 'in-progress',
      blocked_reason = null,
      version = version + 1,
      updated_at = now()
    where id = v_row.id
    returning * into v_row;
  else
    raise exception using errcode = '22023', message = 'PROJECT_WORK_ITEM_NO_TRANSITION';
  end if;

  insert into public.erp_project_audit_events (
    event_id, work_item_id, tenant_id, site_id, actor_account_id, actor_name, action, note
  ) values (
    v_row.event_id, v_row.id, p_tenant_id, v_row.site_id, v_actor_id, v_actor_name, v_action, v_row.blocked_reason
  );

  return v_row;
end;
$$;

create or replace function public.erp_project_submit_change_request(
  p_tenant_id uuid,
  p_event_id uuid,
  p_actor_account_id text,
  p_actor_name text,
  p_actor_role text,
  p_kind text,
  p_summary text,
  p_proposed_budget_billion numeric,
  p_proposed_event_date date,
  p_note text
)
returns public.erp_project_change_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.erp_project_change_requests;
  v_event public.erp_project_events;
  v_role text := lower(trim(coalesce(p_actor_role, '')));
  v_actor_id text := trim(coalesce(p_actor_account_id, ''));
  v_actor_name text := trim(coalesce(p_actor_name, ''));
  v_kind text := lower(trim(coalesce(p_kind, '')));
  v_summary text := trim(coalesce(p_summary, ''));
begin
  if v_role <> 'manager'
     or char_length(v_actor_id) not between 2 and 100
     or char_length(v_actor_name) < 1
     or v_kind not in ('budget', 'deadline', 'scope')
     or char_length(v_summary) < 1 then
    raise exception using errcode = '42501', message = 'PROJECT_ACTOR_INVALID';
  end if;
  if v_kind = 'budget' and p_proposed_budget_billion is null then
    raise exception using errcode = '22023', message = 'PROJECT_CHANGE_BUDGET_REQUIRED';
  end if;
  if v_kind = 'deadline' and p_proposed_event_date is null then
    raise exception using errcode = '22023', message = 'PROJECT_CHANGE_DATE_REQUIRED';
  end if;

  select * into v_event
  from public.erp_project_events
  where id = p_event_id and tenant_id = p_tenant_id;
  if v_event.id is null then
    raise exception using errcode = '23503', message = 'PROJECT_EVENT_TENANT_MISMATCH';
  end if;

  insert into public.erp_project_change_requests (
    event_id, tenant_id, site_id, kind, summary, proposed_budget_billion,
    proposed_event_date, note, requested_by_account_id, requested_by_name
  ) values (
    p_event_id, p_tenant_id, v_event.site_id, v_kind, v_summary, p_proposed_budget_billion,
    p_proposed_event_date, p_note, v_actor_id, v_actor_name
  )
  returning * into v_row;

  insert into public.erp_project_audit_events (
    event_id, work_item_id, tenant_id, site_id, actor_account_id, actor_name, action, note
  ) values (
    p_event_id, null, p_tenant_id, v_event.site_id, v_actor_id, v_actor_name, 'Gửi yêu cầu đổi phạm vi', v_summary
  );

  return v_row;
end;
$$;

create or replace function public.erp_project_decide_change_request(
  p_tenant_id uuid,
  p_change_request_id uuid,
  p_actor_account_id text,
  p_actor_name text,
  p_actor_role text,
  p_decision text,
  p_decision_note text
)
returns public.erp_project_change_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.erp_project_change_requests;
  v_role text := lower(trim(coalesce(p_actor_role, '')));
  v_actor_id text := trim(coalesce(p_actor_account_id, ''));
  v_actor_name text := trim(coalesce(p_actor_name, ''));
  v_decision text := lower(trim(coalesce(p_decision, '')));
begin
  if v_role <> 'director'
     or char_length(v_actor_id) not between 2 and 100
     or char_length(v_actor_name) < 1
     or v_decision not in ('approved', 'rejected') then
    raise exception using errcode = '42501', message = 'PROJECT_ACTOR_INVALID';
  end if;

  select * into v_row
  from public.erp_project_change_requests
  where id = p_change_request_id and tenant_id = p_tenant_id
  for update;
  if v_row.id is null then
    raise exception using errcode = 'P0002', message = 'PROJECT_CHANGE_NOT_FOUND';
  end if;
  if v_row.status <> 'pending' then
    raise exception using errcode = '22023', message = 'PROJECT_CHANGE_ALREADY_DECIDED';
  end if;

  update public.erp_project_change_requests set
    status = v_decision,
    decided_by_account_id = v_actor_id,
    decided_by_name = v_actor_name,
    decided_at = now(),
    decision_note = p_decision_note
  where id = p_change_request_id
  returning * into v_row;

  if v_decision = 'approved' then
    update public.erp_project_events set
      budget_billion = coalesce(v_row.proposed_budget_billion, budget_billion),
      event_date = coalesce(v_row.proposed_event_date, event_date),
      version = version + 1,
      updated_at = now()
    where id = v_row.event_id;
  end if;

  insert into public.erp_project_audit_events (
    event_id, work_item_id, tenant_id, site_id, actor_account_id, actor_name, action, note
  ) values (
    v_row.event_id, null, p_tenant_id, v_row.site_id, v_actor_id, v_actor_name,
    case when v_decision = 'approved' then 'Duyệt yêu cầu đổi phạm vi' else 'Từ chối yêu cầu đổi phạm vi' end,
    p_decision_note
  );

  return v_row;
end;
$$;

create or replace function public.erp_project_record_settlement(
  p_tenant_id uuid,
  p_work_item_code text,
  p_actor_account_id text,
  p_actor_name text,
  p_actor_role text,
  p_amount_billion numeric,
  p_note text,
  p_finance_code text
)
returns public.erp_project_settlements
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.erp_project_action_items;
  v_row public.erp_project_settlements;
  v_role text := lower(trim(coalesce(p_actor_role, '')));
  v_actor_id text := trim(coalesce(p_actor_account_id, ''));
  v_actor_name text := trim(coalesce(p_actor_name, ''));
  v_note text := trim(coalesce(p_note, ''));
  v_finance_code text := trim(coalesce(p_finance_code, ''));
begin
  if v_role <> 'accountant'
     or char_length(v_actor_id) not between 2 and 100
     or char_length(v_actor_name) < 1
     or p_amount_billion is null or p_amount_billion <= 0
     or char_length(v_note) < 1
     or char_length(v_finance_code) < 1 then
    raise exception using errcode = '42501', message = 'PROJECT_ACTOR_INVALID';
  end if;

  select * into v_item
  from public.erp_project_action_items
  where code = p_work_item_code and tenant_id = p_tenant_id
  for update;
  if v_item.id is null then
    raise exception using errcode = 'P0002', message = 'PROJECT_WORK_ITEM_NOT_FOUND';
  end if;
  if v_item.status <> 'done' or not v_item.requires_settlement then
    raise exception using errcode = '22023', message = 'PROJECT_SETTLEMENT_NOT_ELIGIBLE';
  end if;

  insert into public.erp_project_settlements (
    work_item_id, event_id, tenant_id, site_id, amount_billion, note, finance_code,
    recorded_by_account_id, recorded_by_name
  ) values (
    v_item.id, v_item.event_id, p_tenant_id, v_item.site_id, p_amount_billion, v_note, v_finance_code,
    v_actor_id, v_actor_name
  )
  returning * into v_row;

  update public.erp_project_events set
    committed_billion = committed_billion + p_amount_billion,
    version = version + 1,
    updated_at = now()
  where id = v_item.event_id;

  insert into public.erp_project_audit_events (
    event_id, work_item_id, tenant_id, site_id, actor_account_id, actor_name, action, note
  ) values (
    v_item.event_id, v_item.id, p_tenant_id, v_item.site_id, v_actor_id, v_actor_name, 'Ghi nhận quyết toán',
    v_finance_code || ' · ' || p_amount_billion || ' tỷ'
  );

  return v_row;
end;
$$;

-- ---------------------------------------------------------------------
-- RLS and grants: service_role read-only on tables, RPC EXECUTE only.
-- ---------------------------------------------------------------------

alter table public.erp_project_events enable row level security;
alter table public.erp_project_milestones enable row level security;
alter table public.erp_project_action_items enable row level security;
alter table public.erp_project_work_item_dependencies enable row level security;
alter table public.erp_project_change_requests enable row level security;
alter table public.erp_project_settlements enable row level security;
alter table public.erp_project_audit_events enable row level security;

revoke all on table public.erp_project_events from public, anon, authenticated, service_role;
revoke all on table public.erp_project_milestones from public, anon, authenticated, service_role;
revoke all on table public.erp_project_action_items from public, anon, authenticated, service_role;
revoke all on table public.erp_project_work_item_dependencies from public, anon, authenticated, service_role;
revoke all on table public.erp_project_change_requests from public, anon, authenticated, service_role;
revoke all on table public.erp_project_settlements from public, anon, authenticated, service_role;
revoke all on table public.erp_project_audit_events from public, anon, authenticated, service_role;

grant select on table public.erp_project_events to service_role;
grant select on table public.erp_project_milestones to service_role;
grant select on table public.erp_project_action_items to service_role;
grant select on table public.erp_project_work_item_dependencies to service_role;
grant select on table public.erp_project_change_requests to service_role;
grant select on table public.erp_project_settlements to service_role;
grant select on table public.erp_project_audit_events to service_role;

create policy erp_project_events_service_read on public.erp_project_events for select to service_role using (true);
create policy erp_project_milestones_service_read on public.erp_project_milestones for select to service_role using (true);
create policy erp_project_action_items_service_read on public.erp_project_action_items for select to service_role using (true);
create policy erp_project_work_item_dependencies_service_read on public.erp_project_work_item_dependencies for select to service_role using (true);
create policy erp_project_change_requests_service_read on public.erp_project_change_requests for select to service_role using (true);
create policy erp_project_settlements_service_read on public.erp_project_settlements for select to service_role using (true);
create policy erp_project_audit_events_service_read on public.erp_project_audit_events for select to service_role using (true);

revoke all on function public.erp_project_update_work_item_progress(uuid, text, text, text, text, text, integer) from public, anon, authenticated, service_role;
revoke all on function public.erp_project_report_blocker(uuid, text, text, text, text, text) from public, anon, authenticated, service_role;
revoke all on function public.erp_project_submit_change_request(uuid, uuid, text, text, text, text, text, numeric, date, text) from public, anon, authenticated, service_role;
revoke all on function public.erp_project_decide_change_request(uuid, uuid, text, text, text, text, text) from public, anon, authenticated, service_role;
revoke all on function public.erp_project_record_settlement(uuid, text, text, text, text, numeric, text, text) from public, anon, authenticated, service_role;

grant execute on function public.erp_project_update_work_item_progress(uuid, text, text, text, text, text, integer) to service_role;
grant execute on function public.erp_project_report_blocker(uuid, text, text, text, text, text) to service_role;
grant execute on function public.erp_project_submit_change_request(uuid, uuid, text, text, text, text, text, numeric, date, text) to service_role;
grant execute on function public.erp_project_decide_change_request(uuid, uuid, text, text, text, text, text) to service_role;
grant execute on function public.erp_project_record_settlement(uuid, text, text, text, text, numeric, text, text) to service_role;

-- ---------------------------------------------------------------------
-- Seed data: the 4 events, 16 milestones (4 per site) and 12 work items
-- (3 per site) the component used to generate from ERP_PROJECT_EVENTS /
-- milestones / workBySite, now shared and persistent. Every work item
-- starts at 'open' or 'in-progress' -- none pre-seeded at
-- ready-for-acceptance/done/blocked, matching the "clean initial state"
-- precedent from the incident/field-report seeds (no fabricated workflow
-- history). Two sample dependencies are seeded to exercise the
-- dependency-gate check.
-- ---------------------------------------------------------------------

insert into public.erp_project_events (
  id, tenant_id, site_id, name, event_date, budget_billion, committed_billion, expected_guests, next_milestone
) values
  ('20000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Lễ hội Tràng An 2026', '2026-08-14', 12.8, 9.4, 35000, 'Chốt phương án phân luồng trước 29/07'),
  ('20000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000009', 'Tuần Văn hóa Tam Chúc', '2026-09-01', 8.6, 5.1, 24000, 'Nghiệm thu sân khấu trước 04/08'),
  ('20000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000005', 'Festival Sắc vàng Tam Cốc', '2026-09-12', 6.2, 3.4, 18000, 'Khóa danh sách nhà cung ứng trước 06/08'),
  ('20000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000003', 'Đêm hội Hoa đăng Bái Đính', '2026-09-26', 9.1, 4.0, 28000, 'Duyệt thiết kế ánh sáng trước 10/08')
on conflict (site_id) do nothing;

insert into public.erp_project_milestones (id, event_id, tenant_id, site_id, name, sort_order) values
  ('21000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Pháp lý & giấy phép', 1),
  ('21000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Nhà thầu & mua sắm', 2),
  ('21000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Vận hành & phân luồng', 3),
  ('21000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'An toàn & diễn tập', 4),
  ('21000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000009', 'Pháp lý & giấy phép', 1),
  ('21000000-0000-4000-8000-000000000006', '20000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000009', 'Nhà thầu & mua sắm', 2),
  ('21000000-0000-4000-8000-000000000007', '20000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000009', 'Vận hành & phân luồng', 3),
  ('21000000-0000-4000-8000-000000000008', '20000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000009', 'An toàn & diễn tập', 4),
  ('21000000-0000-4000-8000-000000000009', '20000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000005', 'Pháp lý & giấy phép', 1),
  ('21000000-0000-4000-8000-000000000010', '20000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000005', 'Nhà thầu & mua sắm', 2),
  ('21000000-0000-4000-8000-000000000011', '20000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000005', 'Vận hành & phân luồng', 3),
  ('21000000-0000-4000-8000-000000000012', '20000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000005', 'An toàn & diễn tập', 4),
  ('21000000-0000-4000-8000-000000000013', '20000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000003', 'Pháp lý & giấy phép', 1),
  ('21000000-0000-4000-8000-000000000014', '20000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000003', 'Nhà thầu & mua sắm', 2),
  ('21000000-0000-4000-8000-000000000015', '20000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000003', 'Vận hành & phân luồng', 3),
  ('21000000-0000-4000-8000-000000000016', '20000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000003', 'An toàn & diễn tập', 4)
on conflict (event_id, name) do nothing;

with inserted_items as (
  insert into public.erp_project_action_items (
    milestone_id, event_id, tenant_id, site_id, code, title, owner_team,
    assignee_account_id, due_date, status, progress_percent, requires_settlement
  ) values
    ('21000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'EV-TA-041', 'Phê duyệt phương án phân luồng 35.000 khách', 'Ban vận hành', 'employee-trang-an-01', '2026-07-29', 'open', 0, false),
    ('21000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'EV-TA-038', 'Chốt hợp đồng sân khấu và ánh sáng', 'Phòng mua sắm', null, '2026-07-30', 'in-progress', 60, true),
    ('21000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'EV-TA-032', 'Diễn tập y tế, cứu hộ và thất lạc trẻ em', 'An ninh & y tế', 'employee-trang-an-01', '2026-08-02', 'in-progress', 40, false),
    ('21000000-0000-4000-8000-000000000006', '20000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000009', 'EV-TC-026', 'Nghiệm thu tải trọng sân khấu mặt nước', 'Kỹ thuật', null, '2026-08-04', 'open', 0, true),
    ('21000000-0000-4000-8000-000000000007', '20000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000009', 'EV-TC-021', 'Khóa lịch xe điện tăng cường', 'Điều phối xe', 'employee-tam-chuc-01', '2026-08-06', 'in-progress', 30, false),
    ('21000000-0000-4000-8000-000000000007', '20000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000009', 'EV-TC-018', 'Xác nhận danh sách 140 tình nguyện viên', 'Nhân sự', 'employee-tam-chuc-01', '2026-08-08', 'in-progress', 45, false),
    ('21000000-0000-4000-8000-000000000010', '20000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000005', 'EV-TM-019', 'Bổ sung nhà cung ứng thuyền trang trí', 'Mua sắm', null, '2026-08-06', 'open', 10, true),
    ('21000000-0000-4000-8000-000000000012', '20000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000005', 'EV-TM-016', 'Chốt phương án thời tiết xấu', 'Ban tổ chức', 'employee-tam-coc-01', '2026-08-09', 'in-progress', 35, false),
    ('21000000-0000-4000-8000-000000000011', '20000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000005', 'EV-TM-011', 'Duyệt tuyến chụp ảnh và vùng hạn chế', 'Vận hành bến', 'employee-tam-coc-01', '2026-08-12', 'open', 0, false),
    ('21000000-0000-4000-8000-000000000013', '20000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000003', 'EV-BD-014', 'Duyệt thiết kế ánh sáng Bảo Tháp', 'Ban nội dung', null, '2026-08-10', 'in-progress', 80, false),
    ('21000000-0000-4000-8000-000000000015', '20000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000003', 'EV-BD-012', 'Khảo sát nguồn điện dự phòng', 'Kỹ thuật', 'employee-bai-dinh-01', '2026-08-12', 'open', 15, false),
    ('21000000-0000-4000-8000-000000000016', '20000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000003', 'EV-BD-009', 'Chốt phương án kiểm soát nến và cháy', 'PCCC', 'employee-bai-dinh-01', '2026-08-14', 'open', 0, false)
  on conflict (code) do nothing
  returning id, code
), dep_pairs(work_code, depends_code) as (
  values ('EV-TC-021', 'EV-TC-026'), ('EV-TM-016', 'EV-TM-019')
)
insert into public.erp_project_work_item_dependencies (work_item_id, depends_on_work_item_id)
select w.id, d.id
from dep_pairs p
join inserted_items w on w.code = p.work_code
join inserted_items d on d.code = p.depends_code
on conflict do nothing;

-- Grant the "Dự án & sự kiện" module to one demo employee per site so the
-- module has at least one non-manager account to log in and test with in
-- Supabase mode (accountants already get it "for free" via
-- ERP_ACCOUNTANT_MODULE_IDS in demo-data.ts, read directly from code, not
-- this table -- see lib/erp/demo-session.ts).
update public.erp_employee_access
set module_ids = array_append(module_ids, 'du-an-su-kien'), updated_at = now()
where tenant_id = '00000000-0000-4000-8000-000000000001'
  and employee_account_id in (
    'employee-trang-an-01', 'employee-tam-chuc-01', 'employee-tam-coc-01', 'employee-bai-dinh-01'
  )
  and not ('du-an-su-kien' = any(module_ids));

commit;
