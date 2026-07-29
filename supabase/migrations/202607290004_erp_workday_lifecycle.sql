-- Persistent employee workday lifecycle with explicit foreground GPS,
-- server-verified geofenced evidence and an immutable audit trail.
--
-- ERP demo identities are authenticated by the application server. Direct
-- client access is denied; the service role calls the RPCs below after the
-- signed ERP session and role scope have been checked by server actions.

begin;

create table if not exists public.erp_workday_site_geofences (
  site_id uuid primary key references public.sites(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  center_latitude double precision not null check (center_latitude between -90 and 90),
  center_longitude double precision not null check (center_longitude between -180 and 180),
  radius_meters integer not null check (radius_meters between 50 and 10000),
  updated_at timestamptz not null default now(),
  unique (site_id, tenant_id)
);

insert into public.erp_workday_site_geofences (
  site_id, tenant_id, center_latitude, center_longitude, radius_meters
) values
  ('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', 20.25245, 105.91755, 900),
  ('10000000-0000-4000-8000-000000000009', '00000000-0000-4000-8000-000000000001', 20.55790, 105.78170, 1500),
  ('10000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000001', 20.21540, 105.93600, 800),
  ('10000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000001', 20.27780, 105.86400, 1400)
on conflict (site_id) do update set
  center_latitude = excluded.center_latitude,
  center_longitude = excluded.center_longitude,
  radius_meters = excluded.radius_meters,
  updated_at = now();

create table if not exists public.erp_workday_workflows (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete restrict,
  business_code text not null check (char_length(business_code) between 5 and 80),
  business_date date not null,
  employee_account_id text not null check (char_length(employee_account_id) between 2 and 100),
  employee_display_name text not null check (char_length(employee_display_name) between 2 and 120),
  manager_account_id text not null check (char_length(manager_account_id) between 2 and 100),
  manager_display_name text not null check (char_length(manager_display_name) between 2 and 120),
  module_id text not null check (char_length(module_id) between 2 and 80),
  station_code text not null check (char_length(station_code) between 2 and 120),
  shift_label text not null check (char_length(shift_label) between 2 and 80),
  task_title text not null check (char_length(task_title) between 4 and 180),
  instructions text not null check (char_length(instructions) between 4 and 1000),
  priority text not null default 'normal' check (priority in ('normal', 'high', 'critical')),
  due_at timestamptz not null,
  evidence_required boolean not null default false,
  status text not null default 'assigned' check (
    status in ('assigned', 'checked-in', 'in-progress', 'submitted', 'manager-returned', 'approved')
  ),
  progress_percent integer not null default 0 check (progress_percent between 0 and 100),
  latest_update_note text not null default '' check (char_length(latest_update_note) <= 2000),
  result_note text not null default '' check (char_length(result_note) <= 2000),
  evidence jsonb not null default '[]'::jsonb check (jsonb_typeof(evidence) = 'array'),
  check_in_at timestamptz,
  check_out_at timestamptz,
  check_in_latitude double precision check (check_in_latitude between -90 and 90),
  check_in_longitude double precision check (check_in_longitude between -180 and 180),
  check_in_accuracy_meters double precision check (check_in_accuracy_meters is null or check_in_accuracy_meters >= 0),
  manager_note text not null default '' check (char_length(manager_note) <= 2000),
  version integer not null default 1 check (version > 0),
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, business_code),
  unique (tenant_id, idempotency_key),
  unique (tenant_id, site_id, business_date, employee_account_id),
  unique (id, tenant_id, site_id),
  check (due_at > created_at),
  check (
    (check_in_at is null and check_in_latitude is null and check_in_longitude is null)
    or
    (check_in_at is not null and check_in_latitude is not null and check_in_longitude is not null)
  )
);

create table if not exists public.erp_workday_audit_events (
  id uuid primary key default gen_random_uuid(),
  workday_id uuid not null,
  tenant_id uuid not null,
  site_id uuid not null,
  sequence_number integer not null check (sequence_number > 0),
  event_type text not null check (
    event_type in ('manager.assign', 'employee.check-in', 'employee.progress', 'employee.submit', 'manager.review')
  ),
  from_status text,
  to_status text not null,
  actor_account_id text not null check (char_length(actor_account_id) between 2 and 100),
  actor_display_name text not null check (char_length(actor_display_name) between 2 and 120),
  actor_role text not null check (actor_role in ('employee', 'manager')),
  note text not null default '' check (char_length(note) <= 2000),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 200),
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  foreign key (workday_id, tenant_id, site_id)
    references public.erp_workday_workflows(id, tenant_id, site_id)
    on delete cascade,
  unique (workday_id, sequence_number),
  unique (workday_id, idempotency_key)
);

create table if not exists public.erp_workday_location_events (
  id uuid primary key default gen_random_uuid(),
  workday_id uuid not null,
  tenant_id uuid not null,
  site_id uuid not null,
  employee_account_id text not null check (char_length(employee_account_id) between 2 and 100),
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  accuracy_meters double precision check (accuracy_meters is null or accuracy_meters >= 0),
  distance_meters integer not null check (distance_meters >= 0),
  inside_geofence boolean not null,
  recorded_at timestamptz not null,
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 200),
  created_at timestamptz not null default now(),
  foreign key (workday_id, tenant_id, site_id)
    references public.erp_workday_workflows(id, tenant_id, site_id)
    on delete cascade,
  unique (workday_id, idempotency_key)
);

create index if not exists erp_workday_site_queue_idx
  on public.erp_workday_workflows(site_id, status, business_date desc);
create index if not exists erp_workday_employee_idx
  on public.erp_workday_workflows(employee_account_id, business_date desc);
create index if not exists erp_workday_manager_idx
  on public.erp_workday_workflows(manager_account_id, business_date desc);
create index if not exists erp_workday_audit_timeline_idx
  on public.erp_workday_audit_events(workday_id, sequence_number);
create index if not exists erp_workday_location_timeline_idx
  on public.erp_workday_location_events(workday_id, recorded_at desc);

create or replace function public.erp_workday_distance_meters(
  p_latitude double precision,
  p_longitude double precision,
  p_center_latitude double precision,
  p_center_longitude double precision
)
returns double precision
language sql
immutable
strict
set search_path = ''
as $$
  select 6371000 * 2 * asin(
    least(
      1,
      sqrt(
        power(sin(radians(p_latitude - p_center_latitude) / 2), 2)
        + cos(radians(p_center_latitude))
        * cos(radians(p_latitude))
        * power(sin(radians(p_longitude - p_center_longitude) / 2), 2)
      )
    )
  );
$$;

create or replace function public.erp_validate_workday_scope_and_version()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.sites s
    where s.id = new.site_id and s.tenant_id = new.tenant_id
  ) then
    raise exception using errcode = '23503', message = 'WORKDAY_SITE_TENANT_MISMATCH';
  end if;
  if tg_op = 'UPDATE' then
    if new.id <> old.id
       or new.tenant_id <> old.tenant_id
       or new.site_id <> old.site_id
       or new.business_code <> old.business_code
       or new.business_date <> old.business_date
       or new.employee_account_id <> old.employee_account_id
       or new.manager_account_id <> old.manager_account_id
       or new.idempotency_key <> old.idempotency_key then
      raise exception using errcode = '22023', message = 'WORKDAY_IDENTITY_IS_IMMUTABLE';
    end if;
    if new.version <> old.version + 1 then
      raise exception using errcode = '40001', message = 'WORKDAY_VERSION_MUST_INCREMENT';
    end if;
    new.updated_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists erp_workday_scope_and_version on public.erp_workday_workflows;
create trigger erp_workday_scope_and_version
before insert or update on public.erp_workday_workflows
for each row execute function public.erp_validate_workday_scope_and_version();

create or replace function public.erp_demo_assign_workday(
  p_payload jsonb,
  p_actor_account_id text,
  p_actor_display_name text,
  p_actor_role text,
  p_idempotency_key text
)
returns public.erp_workday_workflows
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_workday public.erp_workday_workflows;
  v_tenant_id uuid := (p_payload->>'tenant_id')::uuid;
  v_site_id uuid := (p_payload->>'site_id')::uuid;
  v_key text := trim(coalesce(p_idempotency_key, ''));
begin
  if lower(trim(coalesce(p_actor_role, ''))) <> 'manager'
     or char_length(trim(coalesce(p_actor_account_id, ''))) not between 2 and 100
     or char_length(trim(coalesce(p_actor_display_name, ''))) not between 2 and 120
     or char_length(v_key) not between 8 and 200 then
    raise exception using errcode = '22023', message = 'WORKDAY_ASSIGN_ACTOR_OR_KEY_INVALID';
  end if;
  select * into v_workday
  from public.erp_workday_workflows
  where tenant_id = v_tenant_id and idempotency_key = v_key;
  if v_workday.id is not null then return v_workday; end if;
  if coalesce(p_payload->>'manager_account_id', '') <> p_actor_account_id
     or coalesce(p_payload->>'status', '') <> 'assigned'
     or coalesce(p_payload->>'employee_account_id', '') = p_actor_account_id then
    raise exception using errcode = '22023', message = 'WORKDAY_ASSIGN_PAYLOAD_INVALID';
  end if;

  insert into public.erp_workday_workflows (
    tenant_id, site_id, business_code, business_date,
    employee_account_id, employee_display_name,
    manager_account_id, manager_display_name,
    module_id, station_code, shift_label, task_title, instructions,
    priority, due_at, evidence_required, status, idempotency_key
  ) values (
    v_tenant_id, v_site_id, trim(p_payload->>'business_code'),
    (p_payload->>'business_date')::date,
    trim(p_payload->>'employee_account_id'), trim(p_payload->>'employee_display_name'),
    trim(p_payload->>'manager_account_id'), trim(p_payload->>'manager_display_name'),
    trim(p_payload->>'module_id'), trim(p_payload->>'station_code'),
    trim(p_payload->>'shift_label'), trim(p_payload->>'task_title'),
    trim(p_payload->>'instructions'), lower(trim(p_payload->>'priority')),
    (p_payload->>'due_at')::timestamptz,
    coalesce((p_payload->>'evidence_required')::boolean, false),
    'assigned', v_key
  )
  returning * into v_workday;

  insert into public.erp_workday_audit_events (
    workday_id, tenant_id, site_id, sequence_number, event_type,
    from_status, to_status, actor_account_id, actor_display_name,
    actor_role, note, metadata, idempotency_key
  ) values (
    v_workday.id, v_workday.tenant_id, v_workday.site_id, 1, 'manager.assign',
    null, 'assigned', p_actor_account_id, p_actor_display_name,
    'manager', 'Giao việc cho ' || v_workday.employee_display_name,
    jsonb_build_object('businessCode', v_workday.business_code), v_key
  );
  return v_workday;
exception
  when unique_violation then
    raise exception using errcode = '23505', message = 'WORKDAY_ALREADY_ASSIGNED';
end;
$$;

create or replace function public.erp_demo_transition_workday(
  p_workday_id uuid,
  p_expected_version integer,
  p_to_status text,
  p_actor_account_id text,
  p_actor_display_name text,
  p_actor_role text,
  p_action text,
  p_note text,
  p_mutation jsonb,
  p_idempotency_key text
)
returns public.erp_workday_workflows
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_workday public.erp_workday_workflows;
  v_existing public.erp_workday_audit_events;
  v_geofence public.erp_workday_site_geofences;
  v_from text;
  v_to text := lower(trim(coalesce(p_to_status, '')));
  v_role text := lower(trim(coalesce(p_actor_role, '')));
  v_action text := lower(trim(coalesce(p_action, '')));
  v_note text := trim(coalesce(p_note, ''));
  v_key text := trim(coalesce(p_idempotency_key, ''));
  v_mutation jsonb := coalesce(p_mutation, '{}'::jsonb);
  v_evidence jsonb;
  v_distance double precision;
  v_lat double precision;
  v_lon double precision;
  v_accuracy double precision;
  v_captured_at timestamptz;
  v_sequence integer;
  v_now timestamptz := now();
  v_progress integer;
begin
  if p_workday_id is null or p_expected_version is null or p_expected_version < 1
     or v_role not in ('employee', 'manager')
     or char_length(trim(coalesce(p_actor_account_id, ''))) not between 2 and 100
     or char_length(trim(coalesce(p_actor_display_name, ''))) not between 2 and 120
     or char_length(v_note) > 2000
     or char_length(v_key) not between 8 and 200
     or jsonb_typeof(v_mutation) <> 'object' then
    raise exception using errcode = '22023', message = 'WORKDAY_TRANSITION_INPUT_INVALID';
  end if;

  select * into v_workday
  from public.erp_workday_workflows
  where id = p_workday_id
  for update;
  if v_workday.id is null then
    raise exception using errcode = 'P0002', message = 'WORKDAY_NOT_FOUND';
  end if;
  select * into v_existing
  from public.erp_workday_audit_events
  where workday_id = p_workday_id and idempotency_key = v_key;
  if v_existing.id is not null then
    if v_existing.event_type <> v_action then
      raise exception using errcode = '22023', message = 'WORKDAY_IDEMPOTENCY_CONFLICT';
    end if;
    return v_workday;
  end if;
  if v_workday.version <> p_expected_version then
    raise exception using errcode = '40001', message = 'WORKDAY_VERSION_CONFLICT';
  end if;
  v_from := v_workday.status;

  if v_role = 'employee' and p_actor_account_id <> v_workday.employee_account_id then
    raise exception using errcode = '42501', message = 'WORKDAY_WRONG_EMPLOYEE';
  end if;
  if v_role = 'manager' and p_actor_account_id <> v_workday.manager_account_id then
    raise exception using errcode = '42501', message = 'WORKDAY_WRONG_MANAGER';
  end if;
  if not (
    (v_role = 'employee' and v_action = 'employee.check-in' and v_from = 'assigned' and v_to = 'checked-in')
    or (v_role = 'employee' and v_action = 'employee.progress' and v_from in ('checked-in', 'in-progress') and v_to = 'in-progress')
    or (v_role = 'employee' and v_action = 'employee.submit' and v_from in ('checked-in', 'in-progress', 'manager-returned') and v_to = 'submitted')
    or (v_role = 'manager' and v_action = 'manager.review' and v_from = 'submitted' and v_to in ('manager-returned', 'approved'))
  ) then
    raise exception using errcode = '22023', message = 'WORKDAY_TRANSITION_NOT_ALLOWED';
  end if;

  select * into v_geofence
  from public.erp_workday_site_geofences
  where site_id = v_workday.site_id and tenant_id = v_workday.tenant_id;
  if v_geofence.site_id is null then
    raise exception using errcode = 'P0002', message = 'WORKDAY_GEOFENCE_NOT_FOUND';
  end if;

  if v_action = 'employee.check-in' then
    v_lat := (v_mutation->>'latitude')::double precision;
    v_lon := (v_mutation->>'longitude')::double precision;
    v_accuracy := nullif(v_mutation->>'accuracy', '')::double precision;
    v_distance := public.erp_workday_distance_meters(
      v_lat, v_lon, v_geofence.center_latitude, v_geofence.center_longitude
    );
    if v_distance > v_geofence.radius_meters or (v_accuracy is not null and v_accuracy > 250) then
      raise exception using errcode = '22023', message = 'WORKDAY_CHECK_IN_OUTSIDE_GEOFENCE';
    end if;
  end if;

  if v_action = 'employee.progress' then
    v_progress := (v_mutation->>'progress_percent')::integer;
    if v_progress < greatest(1, v_workday.progress_percent) or v_progress > 99
       or char_length(trim(coalesce(v_mutation->>'latest_update_note', ''))) < 4 then
      raise exception using errcode = '22023', message = 'WORKDAY_PROGRESS_INVALID';
    end if;
  end if;

  v_evidence := v_mutation->'evidence';
  if v_evidence is not null and jsonb_typeof(v_evidence) <> 'null' then
    if jsonb_typeof(v_evidence) <> 'object' then
      raise exception using errcode = '22023', message = 'WORKDAY_EVIDENCE_INVALID';
    end if;
    v_lat := (v_evidence->>'latitude')::double precision;
    v_lon := (v_evidence->>'longitude')::double precision;
    v_accuracy := nullif(v_evidence->>'accuracy', '')::double precision;
    v_captured_at := (v_evidence->>'capturedAt')::timestamptz;
    v_distance := public.erp_workday_distance_meters(
      v_lat, v_lon, v_geofence.center_latitude, v_geofence.center_longitude
    );
    if v_captured_at < v_now - interval '10 minutes'
       or v_captured_at > v_now + interval '2 minutes'
       or v_distance > v_geofence.radius_meters
       or (v_accuracy is not null and v_accuracy > 250) then
      raise exception using errcode = '22023', message = 'WORKDAY_EVIDENCE_OUTSIDE_GEOFENCE';
    end if;
    v_evidence := v_evidence || jsonb_build_object(
      'distanceMeters', round(v_distance)::integer,
      'siteVerified', true
    );
  else
    v_evidence := null;
  end if;

  if v_action = 'employee.submit'
     and v_workday.evidence_required
     and jsonb_array_length(v_workday.evidence)
       + (case when v_evidence is null then 0 else 1 end) = 0 then
    raise exception using errcode = '22023', message = 'WORKDAY_EVIDENCE_REQUIRED';
  end if;

  update public.erp_workday_workflows
  set status = v_to,
      progress_percent = case
        when v_action = 'employee.progress' then v_progress
        when v_action = 'employee.submit' then 100
        else progress_percent
      end,
      latest_update_note = case
        when v_action = 'employee.progress' then trim(v_mutation->>'latest_update_note')
        when v_action = 'employee.submit' then trim(v_mutation->>'result_note')
        else latest_update_note
      end,
      result_note = case
        when v_action = 'employee.submit' then trim(v_mutation->>'result_note')
        else result_note
      end,
      evidence = case
        when v_evidence is null then evidence else evidence || jsonb_build_array(v_evidence)
      end,
      check_in_at = case when v_action = 'employee.check-in' then v_now else check_in_at end,
      check_out_at = case when v_action = 'employee.submit' then coalesce(check_out_at, v_now) else check_out_at end,
      check_in_latitude = case when v_action = 'employee.check-in' then v_lat else check_in_latitude end,
      check_in_longitude = case when v_action = 'employee.check-in' then v_lon else check_in_longitude end,
      check_in_accuracy_meters = case when v_action = 'employee.check-in' then v_accuracy else check_in_accuracy_meters end,
      manager_note = case when v_action = 'manager.review' then v_note else manager_note end,
      version = version + 1
  where id = p_workday_id
  returning * into v_workday;

  select coalesce(max(sequence_number), 0) + 1 into v_sequence
  from public.erp_workday_audit_events where workday_id = p_workday_id;
  insert into public.erp_workday_audit_events (
    workday_id, tenant_id, site_id, sequence_number, event_type,
    from_status, to_status, actor_account_id, actor_display_name,
    actor_role, note, metadata, idempotency_key, occurred_at
  ) values (
    v_workday.id, v_workday.tenant_id, v_workday.site_id, v_sequence, v_action,
    v_from, v_to, p_actor_account_id, p_actor_display_name, v_role, v_note,
    jsonb_build_object('previousVersion', p_expected_version, 'newVersion', v_workday.version),
    v_key, v_now
  );
  return v_workday;
end;
$$;

create or replace function public.erp_demo_record_workday_location(
  p_workday_id uuid,
  p_employee_account_id text,
  p_latitude double precision,
  p_longitude double precision,
  p_accuracy_meters double precision,
  p_recorded_at timestamptz,
  p_idempotency_key text
)
returns public.erp_workday_location_events
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_workday public.erp_workday_workflows;
  v_geofence public.erp_workday_site_geofences;
  v_event public.erp_workday_location_events;
  v_distance double precision;
  v_inside boolean;
begin
  select * into v_event from public.erp_workday_location_events
  where workday_id = p_workday_id and idempotency_key = p_idempotency_key;
  if v_event.id is not null then return v_event; end if;
  select * into v_workday from public.erp_workday_workflows
  where id = p_workday_id for share;
  if v_workday.id is null
     or v_workday.employee_account_id <> trim(coalesce(p_employee_account_id, ''))
     or v_workday.status not in ('checked-in', 'in-progress') then
    raise exception using errcode = '42501', message = 'WORKDAY_LOCATION_NOT_ALLOWED';
  end if;
  if p_recorded_at < now() - interval '10 minutes'
     or p_recorded_at > now() + interval '2 minutes'
     or char_length(trim(coalesce(p_idempotency_key, ''))) not between 8 and 200 then
    raise exception using errcode = '22023', message = 'WORKDAY_LOCATION_INPUT_INVALID';
  end if;
  select * into v_geofence from public.erp_workday_site_geofences
  where site_id = v_workday.site_id and tenant_id = v_workday.tenant_id;
  v_distance := public.erp_workday_distance_meters(
    p_latitude, p_longitude, v_geofence.center_latitude, v_geofence.center_longitude
  );
  v_inside := v_distance <= v_geofence.radius_meters
    and (p_accuracy_meters is null or p_accuracy_meters <= 250);
  insert into public.erp_workday_location_events (
    workday_id, tenant_id, site_id, employee_account_id,
    latitude, longitude, accuracy_meters, distance_meters,
    inside_geofence, recorded_at, idempotency_key
  ) values (
    v_workday.id, v_workday.tenant_id, v_workday.site_id, p_employee_account_id,
    p_latitude, p_longitude, p_accuracy_meters, round(v_distance)::integer,
    v_inside, p_recorded_at, p_idempotency_key
  ) returning * into v_event;
  return v_event;
end;
$$;

alter table public.erp_workday_site_geofences enable row level security;
alter table public.erp_workday_workflows enable row level security;
alter table public.erp_workday_audit_events enable row level security;
alter table public.erp_workday_location_events enable row level security;

revoke all on table public.erp_workday_site_geofences from public, anon, authenticated, service_role;
revoke all on table public.erp_workday_workflows from public, anon, authenticated, service_role;
revoke all on table public.erp_workday_audit_events from public, anon, authenticated, service_role;
revoke all on table public.erp_workday_location_events from public, anon, authenticated, service_role;
grant select on table public.erp_workday_site_geofences to service_role;
grant select on table public.erp_workday_workflows to service_role;
grant select on table public.erp_workday_audit_events to service_role;
grant select on table public.erp_workday_location_events to service_role;

create policy erp_workday_geofence_service_read on public.erp_workday_site_geofences
for select to service_role using (true);
create policy erp_workday_service_read on public.erp_workday_workflows
for select to service_role using (true);
create policy erp_workday_audit_service_read on public.erp_workday_audit_events
for select to service_role using (true);
create policy erp_workday_location_service_read on public.erp_workday_location_events
for select to service_role using (true);

revoke all on function public.erp_workday_distance_meters(double precision, double precision, double precision, double precision)
  from public, anon, authenticated, service_role;
revoke all on function public.erp_validate_workday_scope_and_version()
  from public, anon, authenticated, service_role;
revoke all on function public.erp_demo_assign_workday(jsonb, text, text, text, text)
  from public, anon, authenticated, service_role;
revoke all on function public.erp_demo_transition_workday(uuid, integer, text, text, text, text, text, text, jsonb, text)
  from public, anon, authenticated, service_role;
revoke all on function public.erp_demo_record_workday_location(uuid, text, double precision, double precision, double precision, timestamptz, text)
  from public, anon, authenticated, service_role;
grant execute on function public.erp_demo_assign_workday(jsonb, text, text, text, text)
  to service_role;
grant execute on function public.erp_demo_transition_workday(uuid, integer, text, text, text, text, text, text, jsonb, text)
  to service_role;
grant execute on function public.erp_demo_record_workday_location(uuid, text, double precision, double precision, double precision, timestamptz, text)
  to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'erp-workday-evidence',
  'erp-workday-evidence',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

insert into public.erp_workday_workflows (
  id, tenant_id, site_id, business_code, business_date,
  employee_account_id, employee_display_name,
  manager_account_id, manager_display_name, module_id,
  station_code, shift_label, task_title, instructions, priority,
  due_at, evidence_required, status, idempotency_key
) values (
  '00000000-0000-4000-9000-000000000001',
  '00000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  'CV-TA-' || to_char(current_date, 'YYYYMMDD') || '-001',
  current_date,
  'employee-trang-an-01', 'Đỗ Thị Lan',
  'manager-trang-an', 'Lê Hoàng Nam',
  'check-in-khach', 'Cổng A', '07:30–12:15',
  'Xác thực và đón đoàn tại Cổng A',
  'Kiểm tra mã đoàn, số khách và quyền lợi; ghi nhận ngoại lệ trước khi khách xuống bến.',
  'high', now() + interval '6 hours', true, 'assigned',
  'seed:workday:trang-an:employee-01:v1'
)
on conflict do nothing;

insert into public.erp_workday_audit_events (
  id, workday_id, tenant_id, site_id, sequence_number, event_type,
  from_status, to_status, actor_account_id, actor_display_name,
  actor_role, note, metadata, idempotency_key
) values (
  '00000000-0000-4000-a000-000000000001',
  '00000000-0000-4000-9000-000000000001',
  '00000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  1, 'manager.assign', null, 'assigned',
  'manager-trang-an', 'Lê Hoàng Nam', 'manager',
  'Giao việc cho Đỗ Thị Lan', '{}'::jsonb,
  'seed:workday:trang-an:employee-01:v1'
)
on conflict do nothing;

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'erp_workday_workflows',
    'erp_workday_location_events'
  ]
  loop
    if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
       and not exists (
         select 1 from pg_publication_tables
         where pubname = 'supabase_realtime'
           and schemaname = 'public'
           and tablename = v_table
       ) then
      execute format('alter publication supabase_realtime add table public.%I', v_table);
    end if;
  end loop;
end;
$$;

commit;
