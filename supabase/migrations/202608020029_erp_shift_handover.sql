-- T9: hand a shift over to the next one, on the record.
--
-- One of the client's eight pilot acceptance criteria, and the system had
-- nothing for it. Shift close (migration 003) settles the money for a shift;
-- nothing carried the operational state across the boundary -- what is still
-- open, what is broken, how much cash is physically in the drawer, and who
-- accepted responsibility for all of it at what minute. Today that handover
-- happens verbally, which is exactly where accountability disappears.
--
-- On "vai trò trưởng ca": deliberately NOT a sixth global role. In real
-- operations shift leader is a duty for one shift at one station, not a job
-- title somebody holds permanently -- the same employee leads Cổng A this
-- morning and works the pier tomorrow. Modelling it in the account registry
-- would make it permanent and wrong. Being shift leader here means being named
-- on the handover for that shift, and the RPCs check that name.
--
-- Same separation of duties as everywhere else in this system: the person
-- handing over cannot be the person accepting. A handover signed by one person
-- is not a handover.

begin;

create table if not exists public.erp_shift_handovers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete restrict,
  business_date date not null,
  shift_label text not null check (char_length(trim(shift_label)) between 3 and 80),
  station_code text not null check (char_length(trim(station_code)) between 2 and 40),

  outgoing_account_id text not null check (char_length(outgoing_account_id) between 2 and 100),
  outgoing_display_name text not null check (char_length(outgoing_display_name) between 1 and 200),
  incoming_account_id text not null check (char_length(incoming_account_id) between 2 and 100),
  incoming_display_name text not null check (char_length(incoming_display_name) between 1 and 200),

  cash_counted_vnd bigint not null check (cash_counted_vnd >= 0),
  cash_expected_vnd bigint not null check (cash_expected_vnd >= 0),
  cash_difference_vnd bigint generated always as (cash_counted_vnd - cash_expected_vnd) stored,

  open_incident_codes text[] not null default '{}'::text[],
  equipment_note text not null default '' check (char_length(equipment_note) <= 2000),
  handover_note text not null check (char_length(trim(handover_note)) between 4 and 2000),

  status text not null default 'submitted' check (
    status in ('submitted', 'accepted', 'disputed')
  ),
  decision_note text,
  decided_at timestamptz,
  version integer not null default 1 check (version > 0),
  idempotency_key text not null check (char_length(trim(idempotency_key)) between 8 and 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- The whole point: two different people.
  check (outgoing_account_id <> incoming_account_id),
  check (
    (status = 'submitted' and decided_at is null)
    or (status in ('accepted', 'disputed') and decided_at is not null)
  ),
  check (status <> 'disputed' or char_length(trim(coalesce(decision_note, ''))) >= 4),
  unique (tenant_id, idempotency_key),
  -- One handover per station per shift per day. A second attempt is either a
  -- retry (caught by the idempotency key) or a mistake.
  unique (tenant_id, site_id, business_date, shift_label, station_code)
);

create index if not exists erp_shift_handovers_site_date_idx
  on public.erp_shift_handovers(site_id, business_date desc, created_at desc);
create index if not exists erp_shift_handovers_incoming_idx
  on public.erp_shift_handovers(incoming_account_id, status);

create table if not exists public.erp_shift_handover_events (
  id uuid primary key default gen_random_uuid(),
  handover_id uuid not null references public.erp_shift_handovers(id) on delete restrict,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  sequence_number integer not null check (sequence_number > 0),
  event_type text not null check (
    event_type in ('handover.submitted', 'handover.accepted', 'handover.disputed')
  ),
  actor_account_id text not null check (char_length(actor_account_id) between 2 and 100),
  actor_display_name text not null,
  note text not null default '' check (char_length(note) <= 2000),
  occurred_at timestamptz not null default now(),
  unique (handover_id, sequence_number)
);

create or replace function public.erp_shift_handover_submit(
  p_tenant_id uuid,
  p_site_id uuid,
  p_business_date date,
  p_shift_label text,
  p_station_code text,
  p_outgoing_account_id text,
  p_outgoing_display_name text,
  p_incoming_account_id text,
  p_incoming_display_name text,
  p_cash_counted_vnd bigint,
  p_cash_expected_vnd bigint,
  p_open_incident_codes text[],
  p_equipment_note text,
  p_handover_note text,
  p_idempotency_key text
)
returns public.erp_shift_handovers
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.erp_shift_handovers;
  v_key text := trim(coalesce(p_idempotency_key, ''));
begin
  if char_length(trim(coalesce(p_outgoing_account_id, ''))) < 2
     or char_length(trim(coalesce(p_incoming_account_id, ''))) < 2
     or char_length(v_key) < 8
     or char_length(trim(coalesce(p_handover_note, ''))) < 4 then
    raise exception using errcode = '22023', message = 'SHIFT_HANDOVER_INPUT_INVALID';
  end if;
  if trim(p_outgoing_account_id) = trim(p_incoming_account_id) then
    raise exception using errcode = '22023', message = 'SHIFT_HANDOVER_SAME_PERSON';
  end if;
  if not exists (
    select 1 from public.sites s where s.id = p_site_id and s.tenant_id = p_tenant_id
  ) then
    raise exception using errcode = '23503', message = 'SHIFT_HANDOVER_SITE_TENANT_MISMATCH';
  end if;

  -- A retry of the same submission returns the original rather than failing,
  -- so a shift leader on a bad connection is not left guessing.
  select * into v_row
  from public.erp_shift_handovers
  where tenant_id = p_tenant_id and idempotency_key = v_key;
  if v_row.id is not null then
    return v_row;
  end if;

  insert into public.erp_shift_handovers (
    tenant_id, site_id, business_date, shift_label, station_code,
    outgoing_account_id, outgoing_display_name,
    incoming_account_id, incoming_display_name,
    cash_counted_vnd, cash_expected_vnd,
    open_incident_codes, equipment_note, handover_note,
    status, idempotency_key
  ) values (
    p_tenant_id, p_site_id, p_business_date, trim(p_shift_label), trim(p_station_code),
    trim(p_outgoing_account_id), trim(p_outgoing_display_name),
    trim(p_incoming_account_id), trim(p_incoming_display_name),
    p_cash_counted_vnd, p_cash_expected_vnd,
    coalesce(p_open_incident_codes, '{}'::text[]),
    coalesce(trim(p_equipment_note), ''), trim(p_handover_note),
    'submitted', v_key
  )
  returning * into v_row;

  insert into public.erp_shift_handover_events (
    handover_id, tenant_id, sequence_number, event_type,
    actor_account_id, actor_display_name, note
  ) values (
    v_row.id, p_tenant_id, 1, 'handover.submitted',
    v_row.outgoing_account_id, v_row.outgoing_display_name, v_row.handover_note
  );

  return v_row;
end;
$$;

create or replace function public.erp_shift_handover_decide(
  p_tenant_id uuid,
  p_handover_id uuid,
  p_expected_version integer,
  p_actor_account_id text,
  p_actor_display_name text,
  p_accept boolean,
  p_note text
)
returns public.erp_shift_handovers
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.erp_shift_handovers;
  v_actor text := trim(coalesce(p_actor_account_id, ''));
  v_note text := coalesce(trim(p_note), '');
  v_next integer;
begin
  select * into v_row
  from public.erp_shift_handovers
  where id = p_handover_id and tenant_id = p_tenant_id
  for update;
  if v_row.id is null then
    raise exception using errcode = 'P0002', message = 'SHIFT_HANDOVER_NOT_FOUND';
  end if;
  if v_row.status <> 'submitted' then
    raise exception using errcode = '22023', message = 'SHIFT_HANDOVER_ALREADY_DECIDED';
  end if;
  if v_row.version <> p_expected_version then
    raise exception using errcode = '40001', message = 'SHIFT_HANDOVER_VERSION_CONFLICT';
  end if;
  -- Only the person taking the shift on can accept it. Otherwise "handover"
  -- means nothing: the outgoing leader could close their own record.
  if v_actor <> v_row.incoming_account_id then
    raise exception using errcode = '42501', message = 'SHIFT_HANDOVER_WRONG_ACTOR';
  end if;
  if not p_accept and char_length(v_note) < 4 then
    raise exception using errcode = '22023', message = 'SHIFT_HANDOVER_DISPUTE_NEEDS_REASON';
  end if;

  update public.erp_shift_handovers set
    status = case when p_accept then 'accepted' else 'disputed' end,
    decision_note = nullif(v_note, ''),
    decided_at = now(),
    version = version + 1,
    updated_at = now()
  where id = v_row.id
  returning * into v_row;

  select coalesce(max(sequence_number), 0) + 1 into v_next
  from public.erp_shift_handover_events
  where handover_id = v_row.id;

  insert into public.erp_shift_handover_events (
    handover_id, tenant_id, sequence_number, event_type,
    actor_account_id, actor_display_name, note
  ) values (
    v_row.id, p_tenant_id, v_next,
    case when p_accept then 'handover.accepted' else 'handover.disputed' end,
    v_actor, trim(coalesce(p_actor_display_name, v_actor)), v_note
  );

  return v_row;
end;
$$;

alter table public.erp_shift_handovers enable row level security;
alter table public.erp_shift_handover_events enable row level security;

revoke all on table public.erp_shift_handovers
  from public, anon, authenticated, service_role;
revoke all on table public.erp_shift_handover_events
  from public, anon, authenticated, service_role;
grant select on table public.erp_shift_handovers to service_role;
grant select on table public.erp_shift_handover_events to service_role;

drop policy if exists erp_shift_handovers_service_read on public.erp_shift_handovers;
create policy erp_shift_handovers_service_read
on public.erp_shift_handovers
for select
to service_role
using (tenant_id = '00000000-0000-4000-8000-000000000001'::uuid);

drop policy if exists erp_shift_handover_events_service_read
  on public.erp_shift_handover_events;
create policy erp_shift_handover_events_service_read
on public.erp_shift_handover_events
for select
to service_role
using (tenant_id = '00000000-0000-4000-8000-000000000001'::uuid);

revoke all on function public.erp_shift_handover_submit(
  uuid, uuid, date, text, text, text, text, text, text,
  bigint, bigint, text[], text, text, text
) from public, anon, authenticated;
revoke all on function public.erp_shift_handover_decide(
  uuid, uuid, integer, text, text, boolean, text
) from public, anon, authenticated;

grant execute on function public.erp_shift_handover_submit(
  uuid, uuid, date, text, text, text, text, text, text,
  bigint, bigint, text[], text, text, text
) to service_role;
grant execute on function public.erp_shift_handover_decide(
  uuid, uuid, integer, text, text, boolean, text
) to service_role;

commit;
