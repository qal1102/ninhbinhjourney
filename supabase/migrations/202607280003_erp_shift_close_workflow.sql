-- Ninh Binh internal operations: persistent ticket-shift close workflow.
--
-- The application currently authenticates ERP demo accounts with a signed
-- server cookie rather than Supabase Auth. Actor identifiers are therefore
-- immutable demo account IDs (text), while tenant/site scope remains linked to
-- the shared UUID catalog. Mutations are only available through service-role
-- RPCs so each state change and its audit event commit atomically.

begin;

create table if not exists public.erp_shift_close_workflows (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete restrict,
  business_code text not null check (char_length(business_code) between 5 and 80),
  shift_date date not null,
  shift_label text not null check (char_length(shift_label) between 2 and 80),
  station_code text not null check (char_length(station_code) between 2 and 80),
  employee_account_id text not null check (char_length(employee_account_id) between 2 and 100),
  employee_display_name text not null check (char_length(employee_display_name) between 2 and 120),
  shift_started_at timestamptz not null,
  shift_ended_at timestamptz not null,
  tickets_sold integer not null default 0 check (tickets_sold >= 0),
  tickets_checked_in integer not null default 0 check (tickets_checked_in >= 0),
  tickets_refunded integer not null default 0 check (tickets_refunded >= 0),
  tickets_voided integer not null default 0 check (tickets_voided >= 0),
  product_mix jsonb not null default '{}'::jsonb check (jsonb_typeof(product_mix) = 'object'),
  cash_vnd bigint not null default 0 check (cash_vnd >= 0),
  card_vnd bigint not null default 0 check (card_vnd >= 0),
  bank_transfer_vnd bigint not null default 0 check (bank_transfer_vnd >= 0),
  qr_vnd bigint not null default 0 check (qr_vnd >= 0),
  gross_sales_vnd bigint not null default 0 check (gross_sales_vnd >= 0),
  refund_vnd bigint not null default 0 check (refund_vnd >= 0),
  net_sales_vnd bigint not null default 0 check (net_sales_vnd >= 0),
  expected_settlement_vnd bigint not null default 0 check (expected_settlement_vnd >= 0),
  actual_settlement_vnd bigint not null default 0 check (actual_settlement_vnd >= 0),
  difference_vnd bigint not null default 0,
  finance_code text not null check (char_length(finance_code) between 2 and 80),
  evidence jsonb not null default '[]'::jsonb check (jsonb_typeof(evidence) = 'array'),
  note text not null default '' check (char_length(note) <= 2000),
  status text not null default 'submitted' check (
    status in (
      'submitted',
      'manager-returned',
      'manager-approved',
      'accounting-review',
      'posted',
      'exception-pending-director',
      'director-approved',
      'director-rejected'
    )
  ),
  version integer not null default 1 check (version > 0),
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 200),
  submitted_at timestamptz,
  manager_account_id text,
  manager_display_name text,
  manager_decision text check (
    manager_decision is null or manager_decision in ('approve', 'return')
  ),
  manager_note text,
  manager_reviewed_at timestamptz,
  accountant_account_id text,
  accountant_display_name text,
  accountant_decision text check (
    accountant_decision is null
    or accountant_decision in ('review', 'post', 'escalate', 'return')
  ),
  accountant_note text,
  accountant_reviewed_at timestamptz,
  director_account_id text,
  director_display_name text,
  director_decision text check (
    director_decision is null or director_decision in ('approve', 'reject')
  ),
  director_note text,
  director_reviewed_at timestamptz,
  review_metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(review_metadata) = 'object'),
  created_by_account_id text not null check (char_length(created_by_account_id) between 2 and 100),
  created_by_role text not null check (
    created_by_role in ('employee', 'manager', 'accountant', 'director', 'system')
  ),
  updated_by_account_id text not null check (char_length(updated_by_account_id) between 2 and 100),
  updated_by_role text not null check (
    updated_by_role in ('employee', 'manager', 'accountant', 'director', 'system')
  ),
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, business_code),
  unique (tenant_id, idempotency_key),
  unique (id, tenant_id, site_id),
  check (shift_ended_at >= shift_started_at),
  check (tickets_checked_in <= tickets_sold),
  check (tickets_refunded + tickets_voided <= tickets_sold),
  check (cash_vnd + card_vnd + bank_transfer_vnd + qr_vnd = actual_settlement_vnd),
  check (refund_vnd <= gross_sales_vnd),
  check (net_sales_vnd = gross_sales_vnd - refund_vnd),
  check (expected_settlement_vnd = net_sales_vnd),
  check (difference_vnd = actual_settlement_vnd - expected_settlement_vnd),
  check (
    (manager_account_id is null and manager_display_name is null and manager_decision is null and manager_reviewed_at is null)
    or
    (manager_account_id is not null and manager_display_name is not null and manager_decision is not null and manager_reviewed_at is not null)
  ),
  check (
    (accountant_account_id is null and accountant_display_name is null and accountant_decision is null and accountant_reviewed_at is null)
    or
    (accountant_account_id is not null and accountant_display_name is not null and accountant_decision is not null and accountant_reviewed_at is not null)
  ),
  check (
    (director_account_id is null and director_display_name is null and director_decision is null and director_reviewed_at is null)
    or
    (director_account_id is not null and director_display_name is not null and director_decision is not null and director_reviewed_at is not null)
  )
);

create table if not exists public.erp_shift_close_audit_events (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null,
  tenant_id uuid not null,
  site_id uuid not null,
  sequence_number integer not null check (sequence_number > 0),
  event_type text not null check (char_length(event_type) between 3 and 100),
  from_status text check (
    from_status is null
    or from_status in (
      'submitted',
      'manager-returned',
      'manager-approved',
      'accounting-review',
      'posted',
      'exception-pending-director',
      'director-approved',
      'director-rejected'
    )
  ),
  to_status text not null check (
    to_status in (
      'submitted',
      'manager-returned',
      'manager-approved',
      'accounting-review',
      'posted',
      'exception-pending-director',
      'director-approved',
      'director-rejected'
    )
  ),
  actor_account_id text not null check (char_length(actor_account_id) between 2 and 100),
  actor_display_name text not null check (char_length(actor_display_name) between 2 and 120),
  actor_role text not null check (
    actor_role in ('employee', 'manager', 'accountant', 'director', 'system')
  ),
  note text not null default '' check (char_length(note) <= 2000),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 200),
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  foreign key (workflow_id, tenant_id, site_id)
    references public.erp_shift_close_workflows(id, tenant_id, site_id)
    on delete cascade,
  unique (workflow_id, sequence_number),
  unique (workflow_id, idempotency_key)
);

create index if not exists erp_shift_close_site_status_idx
  on public.erp_shift_close_workflows(site_id, status, shift_date desc);
create index if not exists erp_shift_close_tenant_queue_idx
  on public.erp_shift_close_workflows(tenant_id, status, updated_at desc);
create index if not exists erp_shift_close_employee_idx
  on public.erp_shift_close_workflows(employee_account_id, shift_date desc);
create index if not exists erp_shift_close_audit_timeline_idx
  on public.erp_shift_close_audit_events(workflow_id, sequence_number);

create or replace function public.erp_validate_shift_close_scope_and_version()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.sites s
    where s.id = new.site_id
      and s.tenant_id = new.tenant_id
  ) then
    raise exception using
      errcode = '23503',
      message = 'SHIFT_CLOSE_SITE_TENANT_MISMATCH';
  end if;

  if tg_op = 'UPDATE' then
    if new.id <> old.id
       or new.tenant_id <> old.tenant_id
       or new.site_id <> old.site_id
       or new.business_code <> old.business_code
       or new.idempotency_key <> old.idempotency_key then
      raise exception using
        errcode = '22023',
        message = 'SHIFT_CLOSE_IDENTITY_IS_IMMUTABLE';
    end if;
    if new.version <> old.version + 1 then
      raise exception using
        errcode = '40001',
        message = 'SHIFT_CLOSE_VERSION_MUST_INCREMENT';
    end if;
    new.updated_at := now();
  end if;

  return new;
end;
$$;

drop trigger if exists erp_shift_close_scope_and_version
  on public.erp_shift_close_workflows;
create trigger erp_shift_close_scope_and_version
before insert or update on public.erp_shift_close_workflows
for each row execute function public.erp_validate_shift_close_scope_and_version();

create or replace function public.erp_demo_create_shift_close(
  p_payload jsonb,
  p_actor_account_id text,
  p_actor_display_name text,
  p_actor_role text,
  p_idempotency_key text
)
returns public.erp_shift_close_workflows
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_workflow public.erp_shift_close_workflows;
  v_tenant_id uuid;
  v_site_id uuid;
  v_shift_date date;
  v_shift_started_at timestamptz;
  v_shift_ended_at timestamptz;
  v_status text := lower(trim(coalesce(p_payload->>'status', 'submitted')));
  v_actor_role text := lower(trim(coalesce(p_actor_role, '')));
  v_actor_account_id text := trim(coalesce(p_actor_account_id, ''));
  v_actor_display_name text := trim(coalesce(p_actor_display_name, ''));
  v_idempotency_key text := trim(coalesce(p_idempotency_key, ''));
  v_business_code text := trim(coalesce(p_payload->>'business_code', ''));
  v_cash_vnd bigint := coalesce((p_payload->>'cash_vnd')::bigint, 0);
  v_card_vnd bigint := coalesce((p_payload->>'card_vnd')::bigint, 0);
  v_bank_transfer_vnd bigint := coalesce((p_payload->>'bank_transfer_vnd')::bigint, 0);
  v_qr_vnd bigint := coalesce((p_payload->>'qr_vnd')::bigint, 0);
  v_gross_sales_vnd bigint;
  v_refund_vnd bigint := coalesce((p_payload->>'refund_vnd')::bigint, 0);
  v_net_sales_vnd bigint;
  v_expected_settlement_vnd bigint;
  v_actual_settlement_vnd bigint;
  v_difference_vnd bigint;
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception using errcode = '22023', message = 'SHIFT_CLOSE_PAYLOAD_MUST_BE_AN_OBJECT';
  end if;

  begin
    v_tenant_id := nullif(p_payload->>'tenant_id', '')::uuid;
    v_site_id := nullif(p_payload->>'site_id', '')::uuid;
    v_shift_date := nullif(p_payload->>'shift_date', '')::date;
    v_shift_started_at := nullif(p_payload->>'shift_started_at', '')::timestamptz;
    v_shift_ended_at := nullif(p_payload->>'shift_ended_at', '')::timestamptz;
  exception
    when invalid_text_representation or datetime_field_overflow then
      raise exception using errcode = '22023', message = 'SHIFT_CLOSE_SCOPE_OR_TIME_IS_INVALID';
  end;

  if v_tenant_id is null
     or v_site_id is null
     or v_shift_date is null
     or v_shift_started_at is null
     or v_shift_ended_at is null then
    raise exception using errcode = '22023', message = 'SHIFT_CLOSE_SCOPE_AND_TIME_ARE_REQUIRED';
  end if;
  if v_status <> 'submitted'
     or v_actor_role <> 'employee' then
    raise exception using errcode = '22023', message = 'SHIFT_CLOSE_CREATE_ROLE_OR_STATUS_IS_INVALID';
  end if;
  if char_length(v_actor_account_id) not between 2 and 100
     or char_length(v_actor_display_name) not between 2 and 120
     or char_length(v_idempotency_key) not between 8 and 200
     or char_length(v_business_code) not between 5 and 80
     or v_actor_account_id <> trim(coalesce(p_payload->>'employee_account_id', '')) then
    raise exception using errcode = '22023', message = 'SHIFT_CLOSE_ACTOR_OR_IDEMPOTENCY_IS_INVALID';
  end if;
  if jsonb_typeof(coalesce(p_payload->'product_mix', '{}'::jsonb)) <> 'object'
     or jsonb_typeof(coalesce(p_payload->'evidence', '[]'::jsonb)) <> 'array' then
    raise exception using errcode = '22023', message = 'SHIFT_CLOSE_PRODUCT_MIX_OR_EVIDENCE_IS_INVALID';
  end if;

  v_gross_sales_vnd := coalesce(
    (p_payload->>'gross_sales_vnd')::bigint,
    v_cash_vnd + v_card_vnd + v_bank_transfer_vnd + v_qr_vnd
  );
  v_net_sales_vnd := coalesce(
    (p_payload->>'net_sales_vnd')::bigint,
    v_gross_sales_vnd - v_refund_vnd
  );
  v_expected_settlement_vnd := coalesce(
    (p_payload->>'expected_settlement_vnd')::bigint,
    v_net_sales_vnd
  );
  v_actual_settlement_vnd := coalesce(
    (p_payload->>'actual_settlement_vnd')::bigint,
    v_expected_settlement_vnd
  );
  v_difference_vnd := coalesce(
    (p_payload->>'difference_vnd')::bigint,
    v_actual_settlement_vnd - v_expected_settlement_vnd
  );

  select *
  into v_workflow
  from public.erp_shift_close_workflows
  where tenant_id = v_tenant_id
    and idempotency_key = v_idempotency_key;

  if v_workflow.id is not null then
    if v_workflow.site_id <> v_site_id
       or v_workflow.business_code <> v_business_code
       or v_workflow.employee_account_id <> trim(coalesce(p_payload->>'employee_account_id', '')) then
      raise exception using errcode = '22023', message = 'SHIFT_CLOSE_IDEMPOTENCY_CONFLICT';
    end if;
    return v_workflow;
  end if;

  insert into public.erp_shift_close_workflows (
    tenant_id,
    site_id,
    business_code,
    shift_date,
    shift_label,
    station_code,
    employee_account_id,
    employee_display_name,
    shift_started_at,
    shift_ended_at,
    tickets_sold,
    tickets_checked_in,
    tickets_refunded,
    tickets_voided,
    product_mix,
    cash_vnd,
    card_vnd,
    bank_transfer_vnd,
    qr_vnd,
    gross_sales_vnd,
    refund_vnd,
    net_sales_vnd,
    expected_settlement_vnd,
    actual_settlement_vnd,
    difference_vnd,
    finance_code,
    evidence,
    note,
    status,
    version,
    idempotency_key,
    submitted_at,
    review_metadata,
    created_by_account_id,
    created_by_role,
    updated_by_account_id,
    updated_by_role
  ) values (
    v_tenant_id,
    v_site_id,
    v_business_code,
    v_shift_date,
    trim(coalesce(p_payload->>'shift_label', '')),
    trim(coalesce(p_payload->>'station_code', '')),
    trim(coalesce(p_payload->>'employee_account_id', '')),
    trim(coalesce(p_payload->>'employee_display_name', '')),
    v_shift_started_at,
    v_shift_ended_at,
    coalesce((p_payload->>'tickets_sold')::integer, 0),
    coalesce((p_payload->>'tickets_checked_in')::integer, 0),
    coalesce((p_payload->>'tickets_refunded')::integer, 0),
    coalesce((p_payload->>'tickets_voided')::integer, 0),
    coalesce(p_payload->'product_mix', '{}'::jsonb),
    v_cash_vnd,
    v_card_vnd,
    v_bank_transfer_vnd,
    v_qr_vnd,
    v_gross_sales_vnd,
    v_refund_vnd,
    v_net_sales_vnd,
    v_expected_settlement_vnd,
    v_actual_settlement_vnd,
    v_difference_vnd,
    trim(coalesce(p_payload->>'finance_code', '')),
    coalesce(p_payload->'evidence', '[]'::jsonb),
    trim(coalesce(p_payload->>'note', '')),
    v_status,
    1,
    v_idempotency_key,
    now(),
    jsonb_build_object(
      'created',
      jsonb_build_object(
        'actorAccountId', v_actor_account_id,
        'actorDisplayName', v_actor_display_name,
        'actorRole', v_actor_role
      )
    ),
    v_actor_account_id,
    v_actor_role,
    v_actor_account_id,
    v_actor_role
  )
  on conflict (tenant_id, idempotency_key) do nothing
  returning * into v_workflow;

  if v_workflow.id is null then
    select *
    into v_workflow
    from public.erp_shift_close_workflows
    where tenant_id = v_tenant_id
      and idempotency_key = v_idempotency_key;

    if v_workflow.id is null
       or v_workflow.site_id <> v_site_id
       or v_workflow.business_code <> v_business_code
       or v_workflow.employee_account_id <> trim(coalesce(p_payload->>'employee_account_id', '')) then
      raise exception using errcode = '22023', message = 'SHIFT_CLOSE_IDEMPOTENCY_CONFLICT';
    end if;
    return v_workflow;
  end if;

  insert into public.erp_shift_close_audit_events (
    workflow_id,
    tenant_id,
    site_id,
    sequence_number,
    event_type,
    from_status,
    to_status,
    actor_account_id,
    actor_display_name,
    actor_role,
    note,
    metadata,
    idempotency_key
  ) values (
    v_workflow.id,
    v_workflow.tenant_id,
    v_workflow.site_id,
    1,
    'employee.submit',
    null,
    v_status,
    v_actor_account_id,
    v_actor_display_name,
    v_actor_role,
    v_workflow.note,
    jsonb_build_object(
      'businessCode', v_workflow.business_code,
      'version', v_workflow.version,
      'ticketsSold', v_workflow.tickets_sold,
      'netSalesVnd', v_workflow.net_sales_vnd,
      'differenceVnd', v_workflow.difference_vnd
    ),
    v_idempotency_key
  );

  return v_workflow;
end;
$$;

create or replace function public.erp_demo_transition_shift_close(
  p_workflow_id uuid,
  p_expected_version integer,
  p_to_status text,
  p_actor_account_id text,
  p_actor_display_name text,
  p_actor_role text,
  p_action text,
  p_note text,
  p_review_metadata jsonb,
  p_idempotency_key text
)
returns public.erp_shift_close_workflows
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_workflow public.erp_shift_close_workflows;
  v_existing_event public.erp_shift_close_audit_events;
  v_from_status text;
  v_to_status text := lower(trim(coalesce(p_to_status, '')));
  v_actor_role text := lower(trim(coalesce(p_actor_role, '')));
  v_actor_account_id text := trim(coalesce(p_actor_account_id, ''));
  v_actor_display_name text := trim(coalesce(p_actor_display_name, ''));
  v_action text := lower(trim(coalesce(p_action, '')));
  v_decision text := lower(trim(coalesce(p_review_metadata->>'decision', '')));
  v_note text := trim(coalesce(p_note, ''));
  v_idempotency_key text := trim(coalesce(p_idempotency_key, ''));
  v_review_metadata jsonb := coalesce(p_review_metadata, '{}'::jsonb);
  v_role_review jsonb;
  v_sequence_number integer;
  v_now timestamptz := now();
  v_allowed boolean := false;
begin
  if p_workflow_id is null or p_expected_version is null or p_expected_version < 1 then
    raise exception using errcode = '22023', message = 'SHIFT_CLOSE_ID_AND_VERSION_ARE_REQUIRED';
  end if;
  if v_actor_role not in ('employee', 'manager', 'accountant', 'director')
     or char_length(v_actor_account_id) not between 2 and 100
     or char_length(v_actor_display_name) not between 2 and 120 then
    raise exception using errcode = '22023', message = 'SHIFT_CLOSE_TRANSITION_ACTOR_IS_INVALID';
  end if;
  if v_action !~ '^[a-z0-9][a-z0-9._-]{2,99}$'
     or char_length(v_note) > 2000
     or char_length(v_idempotency_key) not between 8 and 200
     or jsonb_typeof(v_review_metadata) <> 'object' then
    raise exception using errcode = '22023', message = 'SHIFT_CLOSE_TRANSITION_METADATA_IS_INVALID';
  end if;
  if not (
    (v_actor_role = 'employee' and v_action = 'employee.submit')
    or (v_actor_role = 'manager' and v_action = 'manager.review')
    or (v_actor_role = 'accountant' and v_action = 'accountant.reconcile')
    or (v_actor_role = 'director' and v_action = 'director.decide')
  ) then
    raise exception using errcode = '22023', message = 'SHIFT_CLOSE_ACTION_DOES_NOT_MATCH_ACTOR_ROLE';
  end if;

  select *
  into v_workflow
  from public.erp_shift_close_workflows
  where id = p_workflow_id
  for update;

  if v_workflow.id is null then
    raise exception using errcode = 'P0002', message = 'SHIFT_CLOSE_WORKFLOW_NOT_FOUND';
  end if;

  select *
  into v_existing_event
  from public.erp_shift_close_audit_events
  where workflow_id = p_workflow_id
    and idempotency_key = v_idempotency_key;

  if v_existing_event.id is not null then
    if v_existing_event.event_type <> v_action then
      raise exception using errcode = '22023', message = 'SHIFT_CLOSE_IDEMPOTENCY_CONFLICT';
    end if;
    return v_workflow;
  end if;

  if v_workflow.version <> p_expected_version then
    raise exception using
      errcode = '40001',
      message = 'SHIFT_CLOSE_VERSION_CONFLICT',
      detail = format('Expected version %s but current version is %s', p_expected_version, v_workflow.version);
  end if;

  v_from_status := v_workflow.status;
  v_allowed :=
    (
      v_actor_role = 'employee'
      and v_actor_account_id = v_workflow.employee_account_id
      and v_from_status = 'manager-returned'
      and v_to_status = 'submitted'
    )
    or (
      v_actor_role = 'manager'
      and v_from_status = 'submitted'
      and (
        (v_decision = 'approve' and v_to_status = 'manager-approved')
        or (v_decision = 'return' and v_to_status = 'manager-returned')
      )
    )
    or (
      v_actor_role = 'accountant'
      and v_from_status in (
        'manager-approved',
        'accounting-review',
        'director-approved',
        'director-rejected'
      )
      and (
        (v_decision = 'review' and v_to_status = 'accounting-review')
        or (v_decision = 'return' and v_to_status = 'manager-returned')
        or (
          v_decision = 'escalate'
          and v_to_status = 'exception-pending-director'
          and abs(v_workflow.difference_vnd) > 1000
        )
        or (
          v_decision = 'post'
          and v_to_status = 'posted'
          and (
            abs(v_workflow.difference_vnd) <= 1000
            or v_from_status = 'director-approved'
          )
        )
      )
    )
    or (
      v_actor_role = 'director'
      and v_from_status = 'exception-pending-director'
      and (
        (v_decision = 'approve' and v_to_status = 'director-approved')
        or (v_decision = 'reject' and v_to_status = 'director-rejected')
      )
    );

  if not v_allowed then
    raise exception using
      errcode = '22023',
      message = 'SHIFT_CLOSE_TRANSITION_NOT_ALLOWED',
      detail = format('%s cannot move %s to %s', v_actor_role, v_from_status, v_to_status);
  end if;

  v_role_review :=
    v_review_metadata
    || jsonb_build_object(
      'action', v_action,
      'note', v_note,
      'actorAccountId', v_actor_account_id,
      'actorDisplayName', v_actor_display_name,
      'recordedAt', v_now
    );

  update public.erp_shift_close_workflows
  set status = v_to_status,
      version = version + 1,
      submitted_at = case
        when v_to_status = 'submitted' then coalesce(submitted_at, v_now)
        else submitted_at
      end,
      manager_account_id = case
        when v_actor_role = 'manager'
          then v_actor_account_id
        else manager_account_id
      end,
      manager_display_name = case
        when v_actor_role = 'manager'
          then v_actor_display_name
        else manager_display_name
      end,
      manager_decision = case
        when v_actor_role = 'manager' then v_decision
        else manager_decision
      end,
      manager_note = case
        when v_actor_role = 'manager'
          then v_note
        else manager_note
      end,
      manager_reviewed_at = case
        when v_actor_role = 'manager'
          then v_now
        else manager_reviewed_at
      end,
      accountant_account_id = case
        when v_actor_role = 'accountant' then v_actor_account_id
        else accountant_account_id
      end,
      accountant_display_name = case
        when v_actor_role = 'accountant' then v_actor_display_name
        else accountant_display_name
      end,
      accountant_decision = case
        when v_actor_role = 'accountant' then v_decision
        else accountant_decision
      end,
      accountant_note = case
        when v_actor_role = 'accountant' then v_note
        else accountant_note
      end,
      accountant_reviewed_at = case
        when v_actor_role = 'accountant' then v_now
        else accountant_reviewed_at
      end,
      director_account_id = case
        when v_actor_role = 'director' then v_actor_account_id
        else director_account_id
      end,
      director_display_name = case
        when v_actor_role = 'director' then v_actor_display_name
        else director_display_name
      end,
      director_decision = case
        when v_actor_role = 'director' then v_decision
        else director_decision
      end,
      director_note = case
        when v_actor_role = 'director' then v_note
        else director_note
      end,
      director_reviewed_at = case
        when v_actor_role = 'director' then v_now
        else director_reviewed_at
      end,
      review_metadata =
        review_metadata
        || v_review_metadata
        || jsonb_build_object(v_actor_role, v_role_review),
      updated_by_account_id = v_actor_account_id,
      updated_by_role = v_actor_role,
      updated_at = v_now
  where id = p_workflow_id
  returning * into v_workflow;

  select coalesce(max(sequence_number), 0) + 1
  into v_sequence_number
  from public.erp_shift_close_audit_events
  where workflow_id = p_workflow_id;

  insert into public.erp_shift_close_audit_events (
    workflow_id,
    tenant_id,
    site_id,
    sequence_number,
    event_type,
    from_status,
    to_status,
    actor_account_id,
    actor_display_name,
    actor_role,
    note,
    metadata,
    idempotency_key,
    occurred_at
  ) values (
    v_workflow.id,
    v_workflow.tenant_id,
    v_workflow.site_id,
    v_sequence_number,
    v_action,
    v_from_status,
    v_to_status,
    v_actor_account_id,
    v_actor_display_name,
    v_actor_role,
    v_note,
    v_review_metadata || jsonb_build_object(
      'previousVersion', p_expected_version,
      'newVersion', v_workflow.version
    ),
    v_idempotency_key,
    v_now
  );

  return v_workflow;
end;
$$;

-- Close the nullable-site mutation gap from migration 002. Tenant-wide
-- decisions may only be created or changed directly by tenant admins; site
-- decisions require both an internal management role and the assigned site.
drop policy if exists erp_decision_insert on public.erp_decision_items;
create policy erp_decision_insert
on public.erp_decision_items
for insert
to authenticated
with check (
  (
    site_id is null
    and public.has_tenant_role(tenant_id, array['admin'])
  )
  or
  (
    site_id is not null
    and public.has_tenant_role(
      tenant_id,
      array['site-supervisor', 'icc-operator', 'admin']
    )
    and public.can_manage_erp_site(site_id)
    and exists (
      select 1
      from public.sites s
      where s.id = erp_decision_items.site_id
        and s.tenant_id = erp_decision_items.tenant_id
    )
  )
);

drop policy if exists erp_decision_update on public.erp_decision_items;
create policy erp_decision_update
on public.erp_decision_items
for update
to authenticated
using (
  (
    site_id is null
    and public.has_tenant_role(tenant_id, array['admin'])
  )
  or
  (
    site_id is not null
    and public.has_tenant_role(
      tenant_id,
      array['site-supervisor', 'icc-operator', 'admin']
    )
    and public.can_manage_erp_site(site_id)
    and exists (
      select 1
      from public.sites s
      where s.id = erp_decision_items.site_id
        and s.tenant_id = erp_decision_items.tenant_id
    )
  )
)
with check (
  (
    site_id is null
    and public.has_tenant_role(tenant_id, array['admin'])
  )
  or
  (
    site_id is not null
    and public.has_tenant_role(
      tenant_id,
      array['site-supervisor', 'icc-operator', 'admin']
    )
    and public.can_manage_erp_site(site_id)
    and exists (
      select 1
      from public.sites s
      where s.id = erp_decision_items.site_id
        and s.tenant_id = erp_decision_items.tenant_id
    )
  )
);

alter table public.erp_shift_close_workflows enable row level security;
alter table public.erp_shift_close_audit_events enable row level security;

revoke all on table public.erp_shift_close_workflows
  from public, anon, authenticated, service_role;
revoke all on table public.erp_shift_close_audit_events
  from public, anon, authenticated, service_role;
grant select on table public.erp_shift_close_workflows to service_role;
grant select on table public.erp_shift_close_audit_events to service_role;

create policy erp_shift_close_service_read
on public.erp_shift_close_workflows
for select
to service_role
using (true);

create policy erp_shift_close_audit_service_read
on public.erp_shift_close_audit_events
for select
to service_role
using (true);

revoke all on function public.erp_validate_shift_close_scope_and_version()
  from public, anon, authenticated, service_role;
revoke all on function public.erp_demo_create_shift_close(jsonb, text, text, text, text)
  from public, anon, authenticated, service_role;
revoke all on function public.erp_demo_transition_shift_close(uuid, integer, text, text, text, text, text, text, jsonb, text)
  from public, anon, authenticated, service_role;
grant execute on function public.erp_demo_create_shift_close(jsonb, text, text, text, text)
  to service_role;
grant execute on function public.erp_demo_transition_shift_close(uuid, integer, text, text, text, text, text, text, jsonb, text)
  to service_role;

insert into public.erp_shift_close_workflows (
  id,
  tenant_id,
  site_id,
  business_code,
  shift_date,
  shift_label,
  station_code,
  employee_account_id,
  employee_display_name,
  shift_started_at,
  shift_ended_at,
  tickets_sold,
  tickets_checked_in,
  tickets_refunded,
  tickets_voided,
  product_mix,
  cash_vnd,
  card_vnd,
  bank_transfer_vnd,
  qr_vnd,
  gross_sales_vnd,
  refund_vnd,
  net_sales_vnd,
  expected_settlement_vnd,
  actual_settlement_vnd,
  difference_vnd,
  finance_code,
  evidence,
  note,
  status,
  version,
  idempotency_key,
  submitted_at,
  manager_account_id,
  manager_display_name,
  manager_decision,
  manager_note,
  manager_reviewed_at,
  accountant_account_id,
  accountant_display_name,
  accountant_decision,
  accountant_note,
  accountant_reviewed_at,
  review_metadata,
  created_by_account_id,
  created_by_role,
  updated_by_account_id,
  updated_by_role,
  created_at,
  updated_at
) values
  (
    '61000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    'SC-TA-20260728-01',
    '2026-07-28',
    'Ca sáng 07:00–12:00',
    'TA-GATE-A',
    'employee-trang-an-01',
    'Đỗ Thị Lan',
    '2026-07-28 07:00:00+07',
    '2026-07-28 12:00:00+07',
    462,
    449,
    3,
    2,
    '{"adult":312,"child":102,"combo":48}'::jsonb,
    20000000,
    30800000,
    10000000,
    18600000,
    80000000,
    600000,
    79400000,
    79400000,
    79400000,
    0,
    'REV-TA-GATE-A',
    '[{"type":"shift-sheet","reference":"TA-2807-A"},{"type":"pos-report","reference":"POS-TA-1200"}]'::jsonb,
    '462 vé; doanh thu thuần 79,4 triệu đồng, tiền và báo cáo ca khớp.',
    'submitted',
    1,
    'seed:shift-close:ta:submitted',
    '2026-07-28 12:08:00+07',
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    '{"nextOwnerRole":"manager"}'::jsonb,
    'employee-trang-an-01',
    'employee',
    'employee-trang-an-01',
    'employee',
    '2026-07-28 12:08:00+07',
    '2026-07-28 12:08:00+07'
  ),
  (
    '61000000-0000-4000-8000-000000000002',
    '00000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000009',
    'SC-TC-20260728-01',
    '2026-07-28',
    'Ca sáng 07:00–12:00',
    'TC-GATE-01',
    'employee-tam-chuc-01',
    'Vũ Ngọc Mai',
    '2026-07-28 07:00:00+07',
    '2026-07-28 12:00:00+07',
    337,
    330,
    2,
    1,
    '{"adult":226,"child":74,"shuttleCombo":37}'::jsonb,
    12000000,
    18200000,
    5000000,
    26000000,
    61600000,
    400000,
    61200000,
    61200000,
    61200000,
    0,
    'REV-TC-GATE-01',
    '[{"type":"shift-sheet","reference":"TC-2807-01"},{"type":"qr-report","reference":"QR-TC-1200"}]'::jsonb,
    'Quản lý đã kiểm tra biên bản ca và số thu theo kênh.',
    'manager-approved',
    2,
    'seed:shift-close:tc:manager-approved',
    '2026-07-28 12:06:00+07',
    'manager-tam-chuc',
    'Trần Thu Hà',
    'approve',
    'Số vé, hoàn vé và bốn kênh thanh toán khớp biên bản.',
    '2026-07-28 12:20:00+07',
    null,
    null,
    null,
    null,
    null,
    '{"manager":{"decision":"approve","nextOwnerRole":"accountant"}}'::jsonb,
    'employee-tam-chuc-01',
    'employee',
    'manager-tam-chuc',
    'manager',
    '2026-07-28 12:06:00+07',
    '2026-07-28 12:20:00+07'
  ),
  (
    '61000000-0000-4000-8000-000000000003',
    '00000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000003',
    'SC-BD-20260728-01',
    '2026-07-28',
    'Ca sáng 07:00–12:00',
    'BD-GATE-B',
    'employee-bai-dinh-01',
    'Lương Thanh Tùng',
    '2026-07-28 07:00:00+07',
    '2026-07-28 12:00:00+07',
    708,
    690,
    4,
    2,
    '{"adult":516,"child":126,"electricCarCombo":66}'::jsonb,
    30000000,
    39000000,
    12400000,
    26200000,
    126400000,
    800000,
    125600000,
    125600000,
    107600000,
    -18000000,
    'REV-BD-GATE-B',
    '[{"type":"shift-sheet","reference":"BD-2807-B"},{"type":"qr-report","reference":"QR-BD-1200"},{"type":"exception-note","reference":"EX-BD-18M"}]'::jsonb,
    'Thiếu 18 triệu đồng ở đối soát QR; kế toán đã chuyển ngoại lệ để xử lý.',
    'exception-pending-director',
    3,
    'seed:shift-close:bd:exception',
    '2026-07-28 12:04:00+07',
    'manager-bai-dinh',
    'Hoàng Gia Bảo',
    'approve',
    'Biên bản vận hành đủ; chuyển kế toán đối chiếu kênh QR.',
    '2026-07-28 12:18:00+07',
    'accountant-001',
    'Phạm Thu Trang',
    'escalate',
    'QR thiếu 18 triệu đồng so với báo cáo bán vé; cần xác minh ngân hàng.',
    '2026-07-28 12:45:00+07',
    '{"manager":{"decision":"approve"},"accountant":{"decision":"escalate","exceptionAmountVnd":18000000,"channel":"qr","nextOwnerRole":"director"}}'::jsonb,
    'employee-bai-dinh-01',
    'employee',
    'accountant-001',
    'accountant',
    '2026-07-28 12:04:00+07',
    '2026-07-28 12:45:00+07'
  )
on conflict (id) do nothing;

insert into public.erp_shift_close_audit_events (
  id,
  workflow_id,
  tenant_id,
  site_id,
  sequence_number,
  event_type,
  from_status,
  to_status,
  actor_account_id,
  actor_display_name,
  actor_role,
  note,
  metadata,
  idempotency_key,
  occurred_at,
  created_at
) values
  (
    '62000000-0000-4000-8000-000000000001',
    '61000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    1,
    'employee.submit',
    null,
    'submitted',
    'employee-trang-an-01',
    'Đỗ Thị Lan',
    'employee',
    'Đã gửi hồ sơ chốt ca.',
    '{"ticketsSold":462,"netSalesVnd":79400000,"differenceVnd":0,"version":1}'::jsonb,
    'seed:audit:shift-close:ta:submitted',
    '2026-07-28 12:08:00+07',
    '2026-07-28 12:08:00+07'
  ),
  (
    '62000000-0000-4000-8000-000000000002',
    '61000000-0000-4000-8000-000000000002',
    '00000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000009',
    1,
    'employee.submit',
    null,
    'submitted',
    'employee-tam-chuc-01',
    'Vũ Ngọc Mai',
    'employee',
    'Đã gửi hồ sơ chốt ca.',
    '{"ticketsSold":337,"netSalesVnd":61200000,"differenceVnd":0,"version":1}'::jsonb,
    'seed:audit:shift-close:tc:submitted',
    '2026-07-28 12:06:00+07',
    '2026-07-28 12:06:00+07'
  ),
  (
    '62000000-0000-4000-8000-000000000003',
    '61000000-0000-4000-8000-000000000002',
    '00000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000009',
    2,
    'manager.review',
    'submitted',
    'manager-approved',
    'manager-tam-chuc',
    'Trần Thu Hà',
    'manager',
    'Số vé, hoàn vé và bốn kênh thanh toán khớp biên bản.',
    '{"previousVersion":1,"newVersion":2}'::jsonb,
    'seed:audit:shift-close:tc:manager-approved',
    '2026-07-28 12:20:00+07',
    '2026-07-28 12:20:00+07'
  ),
  (
    '62000000-0000-4000-8000-000000000004',
    '61000000-0000-4000-8000-000000000003',
    '00000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000003',
    1,
    'employee.submit',
    null,
    'submitted',
    'employee-bai-dinh-01',
    'Lương Thanh Tùng',
    'employee',
    'Đã gửi hồ sơ chốt ca.',
    '{"ticketsSold":708,"netSalesVnd":125600000,"version":1}'::jsonb,
    'seed:audit:shift-close:bd:submitted',
    '2026-07-28 12:04:00+07',
    '2026-07-28 12:04:00+07'
  ),
  (
    '62000000-0000-4000-8000-000000000005',
    '61000000-0000-4000-8000-000000000003',
    '00000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000003',
    2,
    'manager.review',
    'submitted',
    'manager-approved',
    'manager-bai-dinh',
    'Hoàng Gia Bảo',
    'manager',
    'Biên bản vận hành đủ; chuyển kế toán đối chiếu kênh QR.',
    '{"previousVersion":1,"newVersion":2}'::jsonb,
    'seed:audit:shift-close:bd:manager-approved',
    '2026-07-28 12:18:00+07',
    '2026-07-28 12:18:00+07'
  ),
  (
    '62000000-0000-4000-8000-000000000006',
    '61000000-0000-4000-8000-000000000003',
    '00000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000003',
    3,
    'accountant.reconcile',
    'manager-approved',
    'exception-pending-director',
    'accountant-001',
    'Phạm Thu Trang',
    'accountant',
    'QR thiếu 18 triệu đồng so với báo cáo bán vé; cần xác minh ngân hàng.',
    '{"previousVersion":2,"newVersion":3,"exceptionAmountVnd":18000000,"channel":"qr","nextOwnerRole":"director"}'::jsonb,
    'seed:audit:shift-close:bd:exception',
    '2026-07-28 12:45:00+07',
    '2026-07-28 12:45:00+07'
  )
on conflict (id) do nothing;

commit;
