-- ERP accounting maker-checker slice.
--
-- This forward-only migration keeps the signed ERP session bridge used by the
-- current application, but moves actor scope, journal state, approval,
-- posting, reversal, period locking, audit and idempotency enforcement into
-- PostgreSQL. Direct client writes remain denied; only service-role RPCs may
-- mutate these records after the application server verifies the session.

begin;

create table if not exists public.erp_account_registry (
  account_id text primary key check (char_length(account_id) between 2 and 100),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  auth_user_id uuid unique references auth.users(id) on delete set null,
  display_name text not null check (char_length(display_name) between 2 and 120),
  job_title text not null check (char_length(job_title) between 2 and 160),
  employment_type text not null check (
    employment_type in ('permanent', 'seasonal', 'management', 'finance', 'executive')
  ),
  status text not null default 'active' check (
    status in ('active', 'suspended', 'revoked')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id, tenant_id)
);

create table if not exists public.erp_account_role_assignments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  account_id text not null,
  role text not null check (
    role in (
      'employee',
      'regional-manager',
      'accountant-maker',
      'accounting-checker',
      'director'
    )
  ),
  site_id uuid references public.sites(id) on delete cascade,
  effective_from timestamptz not null default now(),
  effective_until timestamptz,
  status text not null default 'active' check (
    status in ('active', 'revoked')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (account_id, tenant_id)
    references public.erp_account_registry(account_id, tenant_id)
    on delete cascade,
  check (effective_until is null or effective_until > effective_from)
);

create unique index if not exists erp_account_role_assignment_identity_idx
  on public.erp_account_role_assignments (
    tenant_id,
    account_id,
    role,
    coalesce(site_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );
create index if not exists erp_account_role_active_idx
  on public.erp_account_role_assignments (
    tenant_id,
    account_id,
    role,
    status,
    effective_from,
    effective_until
  );

create table if not exists public.erp_accounting_periods (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  period_key text not null check (period_key ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  starts_on date not null,
  ends_on date not null,
  status text not null default 'open' check (status in ('open', 'locked')),
  version integer not null default 1 check (version > 0),
  locked_by_account_id text,
  locked_at timestamptz,
  lock_reason text,
  reopened_by_account_id text,
  reopened_at timestamptz,
  reopen_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, period_key),
  unique (id, tenant_id),
  check (ends_on >= starts_on),
  check (
    (
      status = 'open'
      and locked_by_account_id is null
      and locked_at is null
      and lock_reason is null
    )
    or
    (
      status = 'locked'
      and locked_by_account_id is not null
      and locked_at is not null
      and char_length(trim(lock_reason)) between 4 and 2000
    )
  )
);

create table if not exists public.erp_accounting_journals (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete restrict,
  journal_code text not null check (char_length(journal_code) between 5 and 100),
  source_type text not null default 'shift-close' check (
    source_type = 'shift-close'
  ),
  source_workflow_id uuid not null,
  source_version integer not null check (source_version > 0),
  business_date date not null,
  period_key text not null,
  status text not null default 'draft' check (
    status in ('draft', 'pending-checker', 'checker-returned', 'posted')
  ),
  version integer not null default 1 check (version > 0),
  maker_account_id text not null,
  maker_note text not null default '' check (char_length(maker_note) <= 2000),
  checker_account_id text,
  checker_note text,
  submitted_at timestamptz,
  approved_at timestamptz,
  posted_at timestamptz,
  reversal_of_journal_id uuid references public.erp_accounting_journals(id) on delete restrict,
  supersedes_journal_id uuid references public.erp_accounting_journals(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, journal_code),
  unique (id, tenant_id, site_id),
  foreign key (source_workflow_id, tenant_id, site_id)
    references public.erp_shift_close_workflows(id, tenant_id, site_id)
    on delete restrict,
  foreign key (tenant_id, period_key)
    references public.erp_accounting_periods(tenant_id, period_key)
    on delete restrict,
  foreign key (maker_account_id, tenant_id)
    references public.erp_account_registry(account_id, tenant_id)
    on delete restrict,
  foreign key (checker_account_id, tenant_id)
    references public.erp_account_registry(account_id, tenant_id)
    on delete restrict,
  check (checker_account_id is null or checker_account_id <> maker_account_id),
  check (reversal_of_journal_id is null or reversal_of_journal_id <> id),
  check (supersedes_journal_id is null or supersedes_journal_id <> id),
  check (
    status <> 'pending-checker'
    or submitted_at is not null
  ),
  check (
    status <> 'posted'
    or (
      checker_account_id is not null
      and approved_at is not null
      and posted_at is not null
    )
  )
);

create unique index if not exists erp_accounting_one_open_journal_per_source_idx
  on public.erp_accounting_journals (tenant_id, source_workflow_id)
  where reversal_of_journal_id is null
    and status in ('draft', 'pending-checker', 'checker-returned');
create unique index if not exists erp_accounting_one_reversal_per_journal_idx
  on public.erp_accounting_journals (reversal_of_journal_id)
  where reversal_of_journal_id is not null;
create index if not exists erp_accounting_journal_queue_idx
  on public.erp_accounting_journals (
    tenant_id,
    status,
    period_key,
    site_id,
    updated_at desc
  );
create index if not exists erp_accounting_journal_source_idx
  on public.erp_accounting_journals (
    tenant_id,
    source_workflow_id,
    created_at desc
  );

create table if not exists public.erp_accounting_journal_lines (
  id uuid primary key default gen_random_uuid(),
  journal_id uuid not null,
  tenant_id uuid not null,
  site_id uuid not null,
  line_number integer not null check (line_number > 0),
  account_code text not null check (char_length(account_code) between 3 and 40),
  account_name text not null check (char_length(account_name) between 3 and 160),
  debit_vnd bigint not null default 0 check (debit_vnd >= 0),
  credit_vnd bigint not null default 0 check (credit_vnd >= 0),
  dimensions jsonb not null default '{}'::jsonb check (
    jsonb_typeof(dimensions) = 'object'
  ),
  created_at timestamptz not null default now(),
  foreign key (journal_id, tenant_id, site_id)
    references public.erp_accounting_journals(id, tenant_id, site_id)
    on delete restrict,
  unique (journal_id, line_number),
  check (
    (debit_vnd > 0 and credit_vnd = 0)
    or (credit_vnd > 0 and debit_vnd = 0)
  )
);

create index if not exists erp_accounting_lines_account_idx
  on public.erp_accounting_journal_lines (
    tenant_id,
    account_code,
    journal_id
  );

create table if not exists public.erp_accounting_audit_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  site_id uuid references public.sites(id) on delete restrict,
  entity_type text not null check (
    entity_type in ('journal', 'period', 'shift-close')
  ),
  entity_id uuid not null,
  sequence_number integer not null check (sequence_number > 0),
  event_type text not null check (char_length(event_type) between 3 and 100),
  actor_account_id text not null check (
    char_length(actor_account_id) between 2 and 100
  ),
  actor_role text not null check (
    actor_role in ('accountant-maker', 'accounting-checker', 'system')
  ),
  from_status text,
  to_status text not null check (char_length(to_status) between 2 and 80),
  note text not null default '' check (char_length(note) <= 2000),
  metadata jsonb not null default '{}'::jsonb check (
    jsonb_typeof(metadata) = 'object'
  ),
  idempotency_key text not null check (
    char_length(idempotency_key) between 8 and 200
  ),
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (tenant_id, entity_type, entity_id, sequence_number),
  unique (tenant_id, entity_type, entity_id, idempotency_key)
);

create index if not exists erp_accounting_audit_timeline_idx
  on public.erp_accounting_audit_events (
    tenant_id,
    entity_type,
    entity_id,
    sequence_number
  );

create table if not exists public.erp_accounting_command_receipts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  command_scope text not null check (char_length(command_scope) between 3 and 100),
  idempotency_key text not null check (
    char_length(idempotency_key) between 8 and 200
  ),
  actor_account_id text not null,
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  entity_type text not null check (entity_type in ('journal', 'period')),
  entity_id uuid not null,
  resulting_version integer not null check (resulting_version > 0),
  response jsonb not null check (jsonb_typeof(response) = 'object'),
  created_at timestamptz not null default now(),
  foreign key (actor_account_id, tenant_id)
    references public.erp_account_registry(account_id, tenant_id)
    on delete restrict,
  unique (tenant_id, command_scope, idempotency_key)
);

insert into public.erp_account_registry (
  account_id,
  tenant_id,
  display_name,
  job_title,
  employment_type,
  status
) values
  (
    'director-001',
    '00000000-0000-4000-8000-000000000001',
    'Nguyễn Minh Anh',
    'Giám đốc điều hành',
    'executive',
    'active'
  ),
  (
    'manager-trang-an',
    '00000000-0000-4000-8000-000000000001',
    'Lê Hoàng Nam',
    'Quản lý vận hành toàn vùng',
    'management',
    'active'
  ),
  (
    'accountant-001',
    '00000000-0000-4000-8000-000000000001',
    'Phạm Thu Trang',
    'Kế toán tổng hợp',
    'finance',
    'active'
  ),
  (
    'chief-accountant-001',
    '00000000-0000-4000-8000-000000000001',
    'Nguyễn Hải Yến',
    'Kế toán trưởng',
    'finance',
    'active'
  ),
  (
    'employee-trang-an-01',
    '00000000-0000-4000-8000-000000000001',
    'Đỗ Thị Lan',
    'Nhân viên đón khách',
    'permanent',
    'active'
  ),
  (
    'employee-trang-an-02',
    '00000000-0000-4000-8000-000000000001',
    'Bùi Quốc Huy',
    'Điều phối bến thuyền',
    'permanent',
    'active'
  ),
  (
    'employee-trang-an-seasonal-01',
    '00000000-0000-4000-8000-000000000001',
    'Nguyễn Thảo My',
    'Nhân viên thời vụ hỗ trợ cổng',
    'seasonal',
    'active'
  ),
  (
    'employee-tam-chuc-01',
    '00000000-0000-4000-8000-000000000001',
    'Vũ Ngọc Mai',
    'Nhân viên xe trung chuyển',
    'permanent',
    'active'
  ),
  (
    'employee-tam-coc-01',
    '00000000-0000-4000-8000-000000000001',
    'Nguyễn Văn Sơn',
    'Điều phối bến đò',
    'permanent',
    'active'
  ),
  (
    'employee-bai-dinh-01',
    '00000000-0000-4000-8000-000000000001',
    'Lương Thanh Tùng',
    'Nhân viên điều phối xe điện',
    'permanent',
    'active'
  )
on conflict (account_id) do nothing;

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
    '71000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000001',
    'director-001',
    'director',
    null,
    '2024-01-01T00:00:00+07:00',
    null,
    'active'
  ),
  (
    '71000000-0000-4000-8000-000000000002',
    '00000000-0000-4000-8000-000000000001',
    'manager-trang-an',
    'regional-manager',
    '10000000-0000-4000-8000-000000000001',
    '2024-01-01T00:00:00+07:00',
    null,
    'active'
  ),
  (
    '71000000-0000-4000-8000-000000000003',
    '00000000-0000-4000-8000-000000000001',
    'manager-trang-an',
    'regional-manager',
    '10000000-0000-4000-8000-000000000009',
    '2024-01-01T00:00:00+07:00',
    null,
    'active'
  ),
  (
    '71000000-0000-4000-8000-000000000004',
    '00000000-0000-4000-8000-000000000001',
    'manager-trang-an',
    'regional-manager',
    '10000000-0000-4000-8000-000000000005',
    '2024-01-01T00:00:00+07:00',
    null,
    'active'
  ),
  (
    '71000000-0000-4000-8000-000000000005',
    '00000000-0000-4000-8000-000000000001',
    'manager-trang-an',
    'regional-manager',
    '10000000-0000-4000-8000-000000000003',
    '2024-01-01T00:00:00+07:00',
    null,
    'active'
  ),
  (
    '71000000-0000-4000-8000-000000000006',
    '00000000-0000-4000-8000-000000000001',
    'accountant-001',
    'accountant-maker',
    null,
    '2024-01-01T00:00:00+07:00',
    null,
    'active'
  ),
  (
    '71000000-0000-4000-8000-000000000007',
    '00000000-0000-4000-8000-000000000001',
    'chief-accountant-001',
    'accounting-checker',
    null,
    '2024-01-01T00:00:00+07:00',
    null,
    'active'
  ),
  (
    '71000000-0000-4000-8000-000000000008',
    '00000000-0000-4000-8000-000000000001',
    'employee-trang-an-01',
    'employee',
    '10000000-0000-4000-8000-000000000001',
    '2024-01-01T00:00:00+07:00',
    null,
    'active'
  ),
  (
    '71000000-0000-4000-8000-000000000009',
    '00000000-0000-4000-8000-000000000001',
    'employee-trang-an-02',
    'employee',
    '10000000-0000-4000-8000-000000000001',
    '2024-01-01T00:00:00+07:00',
    null,
    'active'
  ),
  (
    '71000000-0000-4000-8000-000000000010',
    '00000000-0000-4000-8000-000000000001',
    'employee-trang-an-seasonal-01',
    'employee',
    '10000000-0000-4000-8000-000000000001',
    '2026-07-20T00:00:00+07:00',
    '2026-08-31T23:59:59+07:00',
    'active'
  ),
  (
    '71000000-0000-4000-8000-000000000011',
    '00000000-0000-4000-8000-000000000001',
    'employee-tam-chuc-01',
    'employee',
    '10000000-0000-4000-8000-000000000009',
    '2024-01-01T00:00:00+07:00',
    null,
    'active'
  ),
  (
    '71000000-0000-4000-8000-000000000012',
    '00000000-0000-4000-8000-000000000001',
    'employee-tam-coc-01',
    'employee',
    '10000000-0000-4000-8000-000000000005',
    '2024-01-01T00:00:00+07:00',
    null,
    'active'
  ),
  (
    '71000000-0000-4000-8000-000000000013',
    '00000000-0000-4000-8000-000000000001',
    'employee-bai-dinh-01',
    'employee',
    '10000000-0000-4000-8000-000000000003',
    '2024-01-01T00:00:00+07:00',
    null,
    'active'
  )
on conflict (id) do nothing;

insert into public.erp_accounting_periods (
  id,
  tenant_id,
  period_key,
  starts_on,
  ends_on,
  status,
  version
) values (
  '72000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000001',
  '2026-07',
  '2026-07-01',
  '2026-07-31',
  'open',
  1
)
on conflict (tenant_id, period_key) do nothing;

create or replace function public.erp_account_has_active_role(
  p_tenant_id uuid,
  p_account_id text,
  p_role text,
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
    from public.erp_account_registry account
    join public.erp_account_role_assignments assignment
      on assignment.tenant_id = account.tenant_id
     and assignment.account_id = account.account_id
    where account.tenant_id = p_tenant_id
      and account.account_id = trim(coalesce(p_account_id, ''))
      and account.status = 'active'
      and assignment.role = p_role
      and assignment.status = 'active'
      and assignment.effective_from <= now()
      and (
        assignment.effective_until is null
        or assignment.effective_until > now()
      )
      and (
        assignment.site_id is null
        or assignment.site_id = p_site_id
      )
      and (
        assignment.site_id is null
        or exists (
          select 1
          from public.sites site
          where site.id = assignment.site_id
            and site.tenant_id = assignment.tenant_id
        )
      )
  );
$$;

create or replace function public.erp_accounting_journal_is_balanced(
  p_journal_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    count(*) >= 2
    and sum(line.debit_vnd) = sum(line.credit_vnd)
    and sum(line.debit_vnd) > 0
  from public.erp_accounting_journal_lines line
  where line.journal_id = p_journal_id;
$$;

create or replace function public.erp_accounting_write_audit(
  p_tenant_id uuid,
  p_site_id uuid,
  p_entity_type text,
  p_entity_id uuid,
  p_event_type text,
  p_actor_account_id text,
  p_actor_role text,
  p_from_status text,
  p_to_status text,
  p_note text,
  p_metadata jsonb,
  p_idempotency_key text,
  p_request_hash text
)
returns public.erp_accounting_audit_events
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.erp_accounting_audit_events;
  v_sequence integer;
begin
  select coalesce(max(event.sequence_number), 0) + 1
  into v_sequence
  from public.erp_accounting_audit_events event
  where event.tenant_id = p_tenant_id
    and event.entity_type = p_entity_type
    and event.entity_id = p_entity_id;

  insert into public.erp_accounting_audit_events (
    tenant_id,
    site_id,
    entity_type,
    entity_id,
    sequence_number,
    event_type,
    actor_account_id,
    actor_role,
    from_status,
    to_status,
    note,
    metadata,
    idempotency_key,
    request_hash
  ) values (
    p_tenant_id,
    p_site_id,
    p_entity_type,
    p_entity_id,
    v_sequence,
    p_event_type,
    p_actor_account_id,
    p_actor_role,
    p_from_status,
    p_to_status,
    trim(coalesce(p_note, '')),
    coalesce(p_metadata, '{}'::jsonb),
    p_idempotency_key,
    p_request_hash
  )
  returning * into v_event;

  return v_event;
end;
$$;

create or replace function public.erp_validate_accounting_period_update()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception using
      errcode = '22023',
      message = 'ACCOUNTING_PERIOD_DELETE_NOT_ALLOWED';
  end if;
  if new.id <> old.id
     or new.tenant_id <> old.tenant_id
     or new.period_key <> old.period_key
     or new.starts_on <> old.starts_on
     or new.ends_on <> old.ends_on
     or new.created_at <> old.created_at then
    raise exception using
      errcode = '22023',
      message = 'ACCOUNTING_PERIOD_IDENTITY_IMMUTABLE';
  end if;
  if new.version <> old.version + 1 then
    raise exception using
      errcode = '40001',
      message = 'ACCOUNTING_PERIOD_VERSION_MUST_INCREMENT';
  end if;
  if not (
    (old.status = 'open' and new.status = 'locked')
    or (old.status = 'locked' and new.status = 'open')
  ) then
    raise exception using
      errcode = '22023',
      message = 'ACCOUNTING_PERIOD_TRANSITION_NOT_ALLOWED';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists erp_accounting_period_integrity
  on public.erp_accounting_periods;
create trigger erp_accounting_period_integrity
before update or delete on public.erp_accounting_periods
for each row execute function public.erp_validate_accounting_period_update();

create or replace function public.erp_validate_accounting_journal_update()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception using
      errcode = '22023',
      message = 'ACCOUNTING_JOURNAL_DELETE_NOT_ALLOWED';
  end if;
  if old.status = 'posted' then
    raise exception using
      errcode = '22023',
      message = 'ACCOUNTING_POSTED_JOURNAL_IMMUTABLE';
  end if;
  if new.id <> old.id
     or new.tenant_id <> old.tenant_id
     or new.site_id <> old.site_id
     or new.journal_code <> old.journal_code
     or new.source_type <> old.source_type
     or new.source_workflow_id <> old.source_workflow_id
     or new.business_date <> old.business_date
     or new.period_key <> old.period_key
     or new.maker_account_id <> old.maker_account_id
     or new.reversal_of_journal_id is distinct from old.reversal_of_journal_id
     or new.supersedes_journal_id is distinct from old.supersedes_journal_id
     or new.created_at <> old.created_at then
    raise exception using
      errcode = '22023',
      message = 'ACCOUNTING_JOURNAL_IDENTITY_IMMUTABLE';
  end if;
  if new.version <> old.version + 1 then
    raise exception using
      errcode = '40001',
      message = 'ACCOUNTING_JOURNAL_VERSION_MUST_INCREMENT';
  end if;
  if not (
    (old.status = 'draft' and new.status = 'posted')
    or (
      old.status = 'pending-checker'
      and new.status in ('checker-returned', 'posted')
    )
    or (
      old.status = 'checker-returned'
      and new.status = 'pending-checker'
    )
  ) then
    raise exception using
      errcode = '22023',
      message = 'ACCOUNTING_JOURNAL_TRANSITION_NOT_ALLOWED';
  end if;
  if new.status = 'posted' then
    if new.checker_account_id is null
       or new.checker_account_id = new.maker_account_id then
      raise exception using
        errcode = '42501',
        message = 'ACCOUNTING_MAKER_CHECKER_SEPARATION_REQUIRED';
    end if;
    if not public.erp_accounting_journal_is_balanced(new.id) then
      raise exception using
        errcode = '23514',
        message = 'ACCOUNTING_JOURNAL_NOT_BALANCED';
    end if;
    if not exists (
      select 1
      from public.erp_accounting_periods period
      where period.tenant_id = new.tenant_id
        and period.period_key = new.period_key
        and period.status = 'open'
    ) then
      raise exception using
        errcode = '22023',
        message = 'ACCOUNTING_PERIOD_IS_LOCKED';
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists erp_accounting_journal_integrity
  on public.erp_accounting_journals;
create trigger erp_accounting_journal_integrity
before update or delete on public.erp_accounting_journals
for each row execute function public.erp_validate_accounting_journal_update();

create or replace function public.erp_protect_accounting_journal_lines()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_old_status text;
  v_new_status text;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    select journal.status
    into v_old_status
    from public.erp_accounting_journals journal
    where journal.id = old.journal_id;
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    select journal.status
    into v_new_status
    from public.erp_accounting_journals journal
    where journal.id = new.journal_id;
  end if;
  if v_old_status = 'posted' or v_new_status = 'posted' then
    raise exception using
      errcode = '22023',
      message = 'ACCOUNTING_POSTED_JOURNAL_LINES_IMMUTABLE';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists erp_accounting_journal_line_integrity
  on public.erp_accounting_journal_lines;
create trigger erp_accounting_journal_line_integrity
before insert or update or delete on public.erp_accounting_journal_lines
for each row execute function public.erp_protect_accounting_journal_lines();

create or replace function public.erp_protect_accounting_audit()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception using
    errcode = '22023',
    message = 'ACCOUNTING_AUDIT_IS_APPEND_ONLY';
end;
$$;

drop trigger if exists erp_accounting_audit_immutable
  on public.erp_accounting_audit_events;
create trigger erp_accounting_audit_immutable
before update or delete on public.erp_accounting_audit_events
for each row execute function public.erp_protect_accounting_audit();

create or replace function public.erp_require_posted_accounting_journal()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.status = 'posted' and old.status is distinct from 'posted' then
    if not exists (
      select 1
      from public.erp_accounting_journals journal
      where journal.tenant_id = new.tenant_id
        and journal.site_id = new.site_id
        and journal.source_type = 'shift-close'
        and journal.source_workflow_id = new.id
        and journal.reversal_of_journal_id is null
        and journal.status = 'posted'
        and journal.checker_account_id is not null
        and not exists (
          select 1
          from public.erp_accounting_journals reversal
          where reversal.reversal_of_journal_id = journal.id
            and reversal.status = 'posted'
        )
    ) then
      raise exception using
        errcode = '42501',
        message = 'SHIFT_CLOSE_POST_REQUIRES_CHECKER_APPROVED_JOURNAL';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists erp_shift_close_requires_posted_journal
  on public.erp_shift_close_workflows;
create trigger erp_shift_close_requires_posted_journal
before update on public.erp_shift_close_workflows
for each row execute function public.erp_require_posted_accounting_journal();

create or replace function public.erp_accounting_prepare_shift_close(
  p_workflow_id uuid,
  p_expected_source_version integer,
  p_actor_account_id text,
  p_note text,
  p_idempotency_key text,
  p_request_hash text
)
returns public.erp_accounting_journals
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_workflow public.erp_shift_close_workflows;
  v_actor public.erp_account_registry;
  v_period public.erp_accounting_periods;
  v_journal public.erp_accounting_journals;
  v_receipt public.erp_accounting_command_receipts;
  v_previous_journal_status text;
  v_source_from_status text;
  v_supersedes_journal_id uuid;
  v_journal_id uuid;
  v_journal_code text;
  v_sequence integer;
  v_now timestamptz := now();
  v_note text := trim(coalesce(p_note, ''));
  v_key text := trim(coalesce(p_idempotency_key, ''));
  v_hash text := trim(coalesce(p_request_hash, ''));
  v_period_key text;
begin
  if p_workflow_id is null
     or p_expected_source_version is null
     or p_expected_source_version < 1
     or char_length(trim(coalesce(p_actor_account_id, ''))) not between 2 and 100
     or char_length(v_note) not between 4 and 2000
     or char_length(v_key) not between 8 and 200
     or v_hash !~ '^[0-9a-f]{64}$' then
    raise exception using
      errcode = '22023',
      message = 'ACCOUNTING_PREPARE_INPUT_INVALID';
  end if;

  select *
  into v_workflow
  from public.erp_shift_close_workflows workflow
  where workflow.id = p_workflow_id
  for update;
  if v_workflow.id is null then
    raise exception using
      errcode = 'P0002',
      message = 'ACCOUNTING_SHIFT_CLOSE_NOT_FOUND';
  end if;

  select *
  into v_actor
  from public.erp_account_registry account
  where account.account_id = trim(p_actor_account_id)
    and account.tenant_id = v_workflow.tenant_id;
  if v_actor.account_id is null
     or not public.erp_account_has_active_role(
       v_workflow.tenant_id,
       v_actor.account_id,
       'accountant-maker',
       v_workflow.site_id
     ) then
    raise exception using
      errcode = '42501',
      message = 'ACCOUNTING_MAKER_ROLE_REQUIRED';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      v_workflow.tenant_id::text || ':prepare-shift-close:' || v_key,
      0
    )
  );
  select *
  into v_receipt
  from public.erp_accounting_command_receipts receipt
  where receipt.tenant_id = v_workflow.tenant_id
    and receipt.command_scope = 'prepare-shift-close'
    and receipt.idempotency_key = v_key;
  if v_receipt.id is not null then
    if v_receipt.actor_account_id <> v_actor.account_id
       or v_receipt.request_hash <> v_hash
       or v_receipt.entity_type <> 'journal' then
      raise exception using
        errcode = '22023',
        message = 'ACCOUNTING_IDEMPOTENCY_CONFLICT';
    end if;
    select *
    into v_journal
    from pg_catalog.jsonb_populate_record(
      null::public.erp_accounting_journals,
      v_receipt.response
    );
    return v_journal;
  end if;

  if v_workflow.version <> p_expected_source_version then
    raise exception using
      errcode = '40001',
      message = 'ACCOUNTING_SOURCE_VERSION_CONFLICT';
  end if;
  if v_workflow.status not in (
    'manager-approved',
    'accounting-review',
    'director-approved'
  ) then
    raise exception using
      errcode = '22023',
      message = 'ACCOUNTING_SOURCE_NOT_READY';
  end if;
  v_source_from_status := v_workflow.status;
  if v_workflow.gross_sales_vnd <= 0 then
    raise exception using
      errcode = '23514',
      message = 'ACCOUNTING_SOURCE_AMOUNT_INVALID';
  end if;

  v_period_key := to_char(v_workflow.shift_date, 'YYYY-MM');
  select *
  into v_period
  from public.erp_accounting_periods period
  where period.tenant_id = v_workflow.tenant_id
    and period.period_key = v_period_key
  for share;
  if v_period.id is null then
    raise exception using
      errcode = 'P0002',
      message = 'ACCOUNTING_PERIOD_NOT_FOUND';
  end if;
  if v_period.status <> 'open' then
    raise exception using
      errcode = '22023',
      message = 'ACCOUNTING_PERIOD_IS_LOCKED';
  end if;

  select *
  into v_journal
  from public.erp_accounting_journals journal
  where journal.tenant_id = v_workflow.tenant_id
    and journal.source_workflow_id = v_workflow.id
    and journal.reversal_of_journal_id is null
  order by journal.created_at desc, journal.id desc
  limit 1
  for update;

  v_previous_journal_status := v_journal.status;
  if v_journal.id is not null and v_journal.status = 'pending-checker' then
    raise exception using
      errcode = '22023',
      message = 'ACCOUNTING_JOURNAL_ALREADY_PENDING_CHECKER';
  end if;
  if v_journal.id is not null
     and v_journal.status = 'checker-returned'
     and v_journal.maker_account_id <> v_actor.account_id then
    raise exception using
      errcode = '42501',
      message = 'ACCOUNTING_RETURNED_JOURNAL_WRONG_MAKER';
  end if;
  if v_journal.id is not null and v_journal.status = 'posted' then
    if not exists (
      select 1
      from public.erp_accounting_journals reversal
      where reversal.reversal_of_journal_id = v_journal.id
        and reversal.status = 'posted'
    ) then
      raise exception using
        errcode = '22023',
        message = 'ACCOUNTING_SOURCE_ALREADY_POSTED';
    end if;
    v_supersedes_journal_id := v_journal.id;
    v_journal.id := null;
    v_previous_journal_status := null;
  end if;

  if v_journal.id is null then
    v_journal_id := gen_random_uuid();
    v_journal_code := left(
      'JV-' || v_workflow.business_code
      || case
        when v_supersedes_journal_id is null then ''
        else '-C' || upper(substr(v_journal_id::text, 1, 8))
      end,
      100
    );
    insert into public.erp_accounting_journals (
      id,
      tenant_id,
      site_id,
      journal_code,
      source_type,
      source_workflow_id,
      source_version,
      business_date,
      period_key,
      status,
      version,
      maker_account_id,
      maker_note,
      submitted_at,
      supersedes_journal_id
    ) values (
      v_journal_id,
      v_workflow.tenant_id,
      v_workflow.site_id,
      v_journal_code,
      'shift-close',
      v_workflow.id,
      v_workflow.version + 1,
      v_workflow.shift_date,
      v_period_key,
      'pending-checker',
      1,
      v_actor.account_id,
      v_note,
      v_now,
      v_supersedes_journal_id
    )
    returning * into v_journal;
  elsif v_journal.status = 'checker-returned' then
    delete from public.erp_accounting_journal_lines line
    where line.journal_id = v_journal.id;
    update public.erp_accounting_journals
    set source_version = v_workflow.version + 1,
        status = 'pending-checker',
        version = version + 1,
        maker_note = v_note,
        checker_account_id = null,
        checker_note = null,
        submitted_at = v_now,
        approved_at = null,
        posted_at = null
    where id = v_journal.id
    returning * into v_journal;
  else
    raise exception using
      errcode = '22023',
      message = 'ACCOUNTING_JOURNAL_STATE_NOT_PREPARABLE';
  end if;

  insert into public.erp_accounting_journal_lines (
    journal_id,
    tenant_id,
    site_id,
    line_number,
    account_code,
    account_name,
    debit_vnd,
    credit_vnd,
    dimensions
  )
  select
    v_journal.id,
    v_journal.tenant_id,
    v_journal.site_id,
    proposed.line_number,
    proposed.account_code,
    proposed.account_name,
    proposed.debit_vnd,
    proposed.credit_vnd,
    jsonb_build_object(
      'siteId', v_journal.site_id,
      'sourceType', 'shift-close',
      'sourceWorkflowId', v_journal.source_workflow_id,
      'channel', proposed.channel
    )
  from (
    values
      (
        1,
        '1111',
        'Tiền mặt tại quầy',
        v_workflow.cash_vnd,
        0::bigint,
        'cash'
      ),
      (
        2,
        '1121',
        'Tiền thẻ/POS chờ hoặc đã về ngân hàng',
        v_workflow.card_vnd,
        0::bigint,
        'card-pos'
      ),
      (
        3,
        '1121',
        'Tiền chuyển khoản ngân hàng',
        v_workflow.bank_transfer_vnd,
        0::bigint,
        'bank-transfer'
      ),
      (
        4,
        '1121',
        'Tiền QR chờ hoặc đã về ngân hàng',
        v_workflow.qr_vnd,
        0::bigint,
        'qr'
      ),
      (
        5,
        '5212',
        'Hoàn vé và giảm doanh thu',
        v_workflow.refund_vnd,
        0::bigint,
        'refund'
      ),
      (
        6,
        '1388',
        'Chênh lệch thiếu chờ xử lý',
        greatest(-v_workflow.difference_vnd, 0::bigint),
        0::bigint,
        'shortage'
      ),
      (
        7,
        '5111',
        'Doanh thu vé và dịch vụ',
        0::bigint,
        v_workflow.gross_sales_vnd,
        'revenue'
      ),
      (
        8,
        '3388',
        'Chênh lệch thừa chờ xử lý',
        0::bigint,
        greatest(v_workflow.difference_vnd, 0::bigint),
        'overage'
      )
  ) as proposed(
    line_number,
    account_code,
    account_name,
    debit_vnd,
    credit_vnd,
    channel
  )
  where proposed.debit_vnd > 0 or proposed.credit_vnd > 0;

  if not public.erp_accounting_journal_is_balanced(v_journal.id) then
    raise exception using
      errcode = '23514',
      message = 'ACCOUNTING_JOURNAL_NOT_BALANCED';
  end if;

  update public.erp_shift_close_workflows
  set status = 'accounting-review',
      version = version + 1,
      accountant_account_id = v_actor.account_id,
      accountant_display_name = v_actor.display_name,
      accountant_decision = 'review',
      accountant_note = v_note,
      accountant_reviewed_at = v_now,
      review_metadata = review_metadata || jsonb_build_object(
        'accountingJournalId', v_journal.id,
        'accountingJournalCode', v_journal.journal_code,
        'accountingMakerAccountId', v_actor.account_id
      ),
      updated_by_account_id = v_actor.account_id,
      updated_by_role = 'accountant',
      updated_at = v_now
  where id = v_workflow.id
  returning * into v_workflow;

  select coalesce(max(event.sequence_number), 0) + 1
  into v_sequence
  from public.erp_shift_close_audit_events event
  where event.workflow_id = v_workflow.id;
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
    v_sequence,
    'accountant.reconcile',
    v_source_from_status,
    'accounting-review',
    v_actor.account_id,
    v_actor.display_name,
    'accountant',
    v_note,
    jsonb_build_object(
      'decision', 'review',
      'journalId', v_journal.id,
      'journalCode', v_journal.journal_code,
      'sourceVersion', v_workflow.version
    ),
    left('acct-prepare:' || v_key, 200),
    v_now
  );

  perform public.erp_accounting_write_audit(
    v_journal.tenant_id,
    v_journal.site_id,
    'journal',
    v_journal.id,
    case
      when v_previous_journal_status = 'checker-returned'
        then 'journal.resubmitted'
      else 'journal.submitted'
    end,
    v_actor.account_id,
    'accountant-maker',
    v_previous_journal_status,
    'pending-checker',
    v_note,
    jsonb_build_object(
      'sourceType', 'shift-close',
      'sourceWorkflowId', v_workflow.id,
      'sourceVersion', v_workflow.version,
      'supersedesJournalId', v_journal.supersedes_journal_id
    ),
    v_key,
    v_hash
  );

  insert into public.erp_accounting_command_receipts (
    tenant_id,
    command_scope,
    idempotency_key,
    actor_account_id,
    request_hash,
    entity_type,
    entity_id,
    resulting_version,
    response
  ) values (
    v_journal.tenant_id,
    'prepare-shift-close',
    v_key,
    v_actor.account_id,
    v_hash,
    'journal',
    v_journal.id,
    v_journal.version,
    to_jsonb(v_journal)
  );

  return v_journal;
end;
$$;

create or replace function public.erp_accounting_review_journal(
  p_journal_id uuid,
  p_expected_version integer,
  p_actor_account_id text,
  p_decision text,
  p_note text,
  p_idempotency_key text,
  p_request_hash text
)
returns public.erp_accounting_journals
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_journal public.erp_accounting_journals;
  v_workflow public.erp_shift_close_workflows;
  v_actor public.erp_account_registry;
  v_receipt public.erp_accounting_command_receipts;
  v_decision text := lower(trim(coalesce(p_decision, '')));
  v_note text := trim(coalesce(p_note, ''));
  v_key text := trim(coalesce(p_idempotency_key, ''));
  v_hash text := trim(coalesce(p_request_hash, ''));
  v_now timestamptz := now();
  v_sequence integer;
begin
  if p_journal_id is null
     or p_expected_version is null
     or p_expected_version < 1
     or v_decision not in ('approve', 'return')
     or char_length(trim(coalesce(p_actor_account_id, ''))) not between 2 and 100
     or char_length(v_note) not between 4 and 2000
     or char_length(v_key) not between 8 and 200
     or v_hash !~ '^[0-9a-f]{64}$' then
    raise exception using
      errcode = '22023',
      message = 'ACCOUNTING_REVIEW_INPUT_INVALID';
  end if;

  select *
  into v_journal
  from public.erp_accounting_journals journal
  where journal.id = p_journal_id
  for update;
  if v_journal.id is null then
    raise exception using
      errcode = 'P0002',
      message = 'ACCOUNTING_JOURNAL_NOT_FOUND';
  end if;

  select *
  into v_actor
  from public.erp_account_registry account
  where account.account_id = trim(p_actor_account_id)
    and account.tenant_id = v_journal.tenant_id;
  if v_actor.account_id is null
     or not public.erp_account_has_active_role(
       v_journal.tenant_id,
       v_actor.account_id,
       'accounting-checker',
       v_journal.site_id
     ) then
    raise exception using
      errcode = '42501',
      message = 'ACCOUNTING_CHECKER_ROLE_REQUIRED';
  end if;
  if v_actor.account_id = v_journal.maker_account_id then
    raise exception using
      errcode = '42501',
      message = 'ACCOUNTING_MAKER_CHECKER_SEPARATION_REQUIRED';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      v_journal.tenant_id::text || ':review-journal:' || v_key,
      0
    )
  );
  select *
  into v_receipt
  from public.erp_accounting_command_receipts receipt
  where receipt.tenant_id = v_journal.tenant_id
    and receipt.command_scope = 'review-journal'
    and receipt.idempotency_key = v_key;
  if v_receipt.id is not null then
    if v_receipt.actor_account_id <> v_actor.account_id
       or v_receipt.request_hash <> v_hash
       or v_receipt.entity_type <> 'journal' then
      raise exception using
        errcode = '22023',
        message = 'ACCOUNTING_IDEMPOTENCY_CONFLICT';
    end if;
    select *
    into v_journal
    from pg_catalog.jsonb_populate_record(
      null::public.erp_accounting_journals,
      v_receipt.response
    );
    return v_journal;
  end if;

  if v_journal.version <> p_expected_version then
    raise exception using
      errcode = '40001',
      message = 'ACCOUNTING_JOURNAL_VERSION_CONFLICT';
  end if;
  if v_journal.status <> 'pending-checker' then
    raise exception using
      errcode = '22023',
      message = 'ACCOUNTING_JOURNAL_NOT_PENDING_CHECKER';
  end if;
  if not public.erp_accounting_journal_is_balanced(v_journal.id) then
    raise exception using
      errcode = '23514',
      message = 'ACCOUNTING_JOURNAL_NOT_BALANCED';
  end if;

  if v_decision = 'return' then
    update public.erp_accounting_journals
    set status = 'checker-returned',
        version = version + 1,
        checker_account_id = v_actor.account_id,
        checker_note = v_note,
        approved_at = null,
        posted_at = null
    where id = v_journal.id
    returning * into v_journal;
  else
    if not exists (
      select 1
      from public.erp_accounting_periods period
      where period.tenant_id = v_journal.tenant_id
        and period.period_key = v_journal.period_key
        and period.status = 'open'
    ) then
      raise exception using
        errcode = '22023',
        message = 'ACCOUNTING_PERIOD_IS_LOCKED';
    end if;

    select *
    into v_workflow
    from public.erp_shift_close_workflows workflow
    where workflow.id = v_journal.source_workflow_id
    for update;
    if v_workflow.id is null then
      raise exception using
        errcode = 'P0002',
        message = 'ACCOUNTING_SHIFT_CLOSE_NOT_FOUND';
    end if;
    if v_workflow.version <> v_journal.source_version then
      raise exception using
        errcode = '40001',
        message = 'ACCOUNTING_SOURCE_VERSION_CONFLICT';
    end if;
    if v_workflow.status <> 'accounting-review' then
      raise exception using
        errcode = '22023',
        message = 'ACCOUNTING_SOURCE_NOT_IN_REVIEW';
    end if;
    if v_workflow.difference_vnd <> 0
       and v_workflow.director_decision is distinct from 'approve' then
      raise exception using
        errcode = '42501',
        message = 'ACCOUNTING_DIRECTOR_APPROVAL_REQUIRED_FOR_DIFFERENCE';
    end if;

    update public.erp_accounting_journals
    set status = 'posted',
        version = version + 1,
        checker_account_id = v_actor.account_id,
        checker_note = v_note,
        approved_at = v_now,
        posted_at = v_now
    where id = v_journal.id
    returning * into v_journal;

    update public.erp_shift_close_workflows
    set status = 'posted',
        version = version + 1,
        review_metadata = review_metadata || jsonb_build_object(
          'postedJournalId', v_journal.id,
          'postedJournalCode', v_journal.journal_code,
          'accountingCheckerAccountId', v_actor.account_id
        ),
        updated_by_account_id = v_actor.account_id,
        updated_by_role = 'system',
        closed_at = v_now,
        updated_at = v_now
    where id = v_workflow.id
    returning * into v_workflow;

    select coalesce(max(event.sequence_number), 0) + 1
    into v_sequence
    from public.erp_shift_close_audit_events event
    where event.workflow_id = v_workflow.id;
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
      v_sequence,
      'system.accounting-posted',
      'accounting-review',
      'posted',
      v_actor.account_id,
      v_actor.display_name,
      'system',
      v_note,
      jsonb_build_object(
        'journalId', v_journal.id,
        'journalCode', v_journal.journal_code,
        'checkerAccountId', v_actor.account_id,
        'sourceVersion', v_workflow.version
      ),
      left('acct-post:' || v_key, 200),
      v_now
    );
  end if;

  perform public.erp_accounting_write_audit(
    v_journal.tenant_id,
    v_journal.site_id,
    'journal',
    v_journal.id,
    case
      when v_decision = 'approve'
        then 'journal.approved-and-posted'
      else 'journal.returned'
    end,
    v_actor.account_id,
    'accounting-checker',
    'pending-checker',
    v_journal.status,
    v_note,
    jsonb_build_object(
      'decision', v_decision,
      'sourceWorkflowId', v_journal.source_workflow_id,
      'sourceVersion', v_journal.source_version
    ),
    v_key,
    v_hash
  );

  insert into public.erp_accounting_command_receipts (
    tenant_id,
    command_scope,
    idempotency_key,
    actor_account_id,
    request_hash,
    entity_type,
    entity_id,
    resulting_version,
    response
  ) values (
    v_journal.tenant_id,
    'review-journal',
    v_key,
    v_actor.account_id,
    v_hash,
    'journal',
    v_journal.id,
    v_journal.version,
    to_jsonb(v_journal)
  );

  return v_journal;
end;
$$;

create or replace function public.erp_accounting_reverse_journal(
  p_journal_id uuid,
  p_expected_version integer,
  p_actor_account_id text,
  p_reason text,
  p_idempotency_key text,
  p_request_hash text
)
returns public.erp_accounting_journals
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_original public.erp_accounting_journals;
  v_reversal public.erp_accounting_journals;
  v_workflow public.erp_shift_close_workflows;
  v_actor public.erp_account_registry;
  v_receipt public.erp_accounting_command_receipts;
  v_reversal_id uuid := gen_random_uuid();
  v_reason text := trim(coalesce(p_reason, ''));
  v_key text := trim(coalesce(p_idempotency_key, ''));
  v_hash text := trim(coalesce(p_request_hash, ''));
  v_now timestamptz := now();
  v_sequence integer;
begin
  if p_journal_id is null
     or p_expected_version is null
     or p_expected_version < 1
     or char_length(trim(coalesce(p_actor_account_id, ''))) not between 2 and 100
     or char_length(v_reason) not between 4 and 2000
     or char_length(v_key) not between 8 and 200
     or v_hash !~ '^[0-9a-f]{64}$' then
    raise exception using
      errcode = '22023',
      message = 'ACCOUNTING_REVERSAL_INPUT_INVALID';
  end if;

  select *
  into v_original
  from public.erp_accounting_journals journal
  where journal.id = p_journal_id
  for update;
  if v_original.id is null then
    raise exception using
      errcode = 'P0002',
      message = 'ACCOUNTING_JOURNAL_NOT_FOUND';
  end if;

  select *
  into v_actor
  from public.erp_account_registry account
  where account.account_id = trim(p_actor_account_id)
    and account.tenant_id = v_original.tenant_id;
  if v_actor.account_id is null
     or not public.erp_account_has_active_role(
       v_original.tenant_id,
       v_actor.account_id,
       'accounting-checker',
       v_original.site_id
     ) then
    raise exception using
      errcode = '42501',
      message = 'ACCOUNTING_CHECKER_ROLE_REQUIRED';
  end if;
  if v_actor.account_id = v_original.maker_account_id then
    raise exception using
      errcode = '42501',
      message = 'ACCOUNTING_MAKER_CHECKER_SEPARATION_REQUIRED';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      v_original.tenant_id::text || ':reverse-journal:' || v_key,
      0
    )
  );
  select *
  into v_receipt
  from public.erp_accounting_command_receipts receipt
  where receipt.tenant_id = v_original.tenant_id
    and receipt.command_scope = 'reverse-journal'
    and receipt.idempotency_key = v_key;
  if v_receipt.id is not null then
    if v_receipt.actor_account_id <> v_actor.account_id
       or v_receipt.request_hash <> v_hash
       or v_receipt.entity_type <> 'journal' then
      raise exception using
        errcode = '22023',
        message = 'ACCOUNTING_IDEMPOTENCY_CONFLICT';
    end if;
    select *
    into v_reversal
    from pg_catalog.jsonb_populate_record(
      null::public.erp_accounting_journals,
      v_receipt.response
    );
    return v_reversal;
  end if;

  if v_original.version <> p_expected_version then
    raise exception using
      errcode = '40001',
      message = 'ACCOUNTING_JOURNAL_VERSION_CONFLICT';
  end if;
  if v_original.status <> 'posted'
     or v_original.reversal_of_journal_id is not null then
    raise exception using
      errcode = '22023',
      message = 'ACCOUNTING_ONLY_POSTED_ORIGINAL_CAN_BE_REVERSED';
  end if;
  if exists (
    select 1
    from public.erp_accounting_journals reversal
    where reversal.reversal_of_journal_id = v_original.id
      and reversal.status = 'posted'
  ) then
    raise exception using
      errcode = '22023',
      message = 'ACCOUNTING_JOURNAL_ALREADY_REVERSED';
  end if;
  if not exists (
    select 1
    from public.erp_accounting_periods period
    where period.tenant_id = v_original.tenant_id
      and period.period_key = v_original.period_key
      and period.status = 'open'
  ) then
    raise exception using
      errcode = '22023',
      message = 'ACCOUNTING_PERIOD_IS_LOCKED';
  end if;

  select *
  into v_workflow
  from public.erp_shift_close_workflows workflow
  where workflow.id = v_original.source_workflow_id
  for update;
  if v_workflow.id is null then
    raise exception using
      errcode = 'P0002',
      message = 'ACCOUNTING_SHIFT_CLOSE_NOT_FOUND';
  end if;
  if v_workflow.status <> 'posted' then
    raise exception using
      errcode = '22023',
      message = 'ACCOUNTING_POSTED_SOURCE_REQUIRED_FOR_REVERSAL';
  end if;

  insert into public.erp_accounting_journals (
    id,
    tenant_id,
    site_id,
    journal_code,
    source_type,
    source_workflow_id,
    source_version,
    business_date,
    period_key,
    status,
    version,
    maker_account_id,
    maker_note,
    checker_account_id,
    checker_note,
    submitted_at,
    reversal_of_journal_id
  ) values (
    v_reversal_id,
    v_original.tenant_id,
    v_original.site_id,
    left(
      'RV-' || v_original.journal_code || '-'
      || upper(substr(v_reversal_id::text, 1, 8)),
      100
    ),
    v_original.source_type,
    v_original.source_workflow_id,
    v_workflow.version,
    v_original.business_date,
    v_original.period_key,
    'draft',
    1,
    v_original.maker_account_id,
    'Bút toán đảo của ' || v_original.journal_code,
    v_actor.account_id,
    v_reason,
    v_now,
    v_original.id
  )
  returning * into v_reversal;

  insert into public.erp_accounting_journal_lines (
    journal_id,
    tenant_id,
    site_id,
    line_number,
    account_code,
    account_name,
    debit_vnd,
    credit_vnd,
    dimensions
  )
  select
    v_reversal.id,
    original_line.tenant_id,
    original_line.site_id,
    original_line.line_number,
    original_line.account_code,
    original_line.account_name,
    original_line.credit_vnd,
    original_line.debit_vnd,
    original_line.dimensions || jsonb_build_object(
      'reversalOfJournalId', v_original.id,
      'reversalOfLineId', original_line.id
    )
  from public.erp_accounting_journal_lines original_line
  where original_line.journal_id = v_original.id
  order by original_line.line_number;

  if not public.erp_accounting_journal_is_balanced(v_reversal.id) then
    raise exception using
      errcode = '23514',
      message = 'ACCOUNTING_REVERSAL_NOT_BALANCED';
  end if;

  update public.erp_accounting_journals
  set status = 'posted',
      version = version + 1,
      approved_at = v_now,
      posted_at = v_now
  where id = v_reversal.id
  returning * into v_reversal;

  update public.erp_shift_close_workflows
  set status = 'accounting-review',
      version = version + 1,
      review_metadata = review_metadata || jsonb_build_object(
        'reversedJournalId', v_original.id,
        'reversalJournalId', v_reversal.id,
        'reversalReason', v_reason,
        'reversedByAccountId', v_actor.account_id
      ),
      updated_by_account_id = v_actor.account_id,
      updated_by_role = 'system',
      closed_at = null,
      updated_at = v_now
  where id = v_workflow.id
  returning * into v_workflow;

  select coalesce(max(event.sequence_number), 0) + 1
  into v_sequence
  from public.erp_shift_close_audit_events event
  where event.workflow_id = v_workflow.id;
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
    v_sequence,
    'system.accounting-reversed',
    'posted',
    'accounting-review',
    v_actor.account_id,
    v_actor.display_name,
    'system',
    v_reason,
    jsonb_build_object(
      'originalJournalId', v_original.id,
      'reversalJournalId', v_reversal.id,
      'sourceVersion', v_workflow.version
    ),
    left('acct-reverse:' || v_key, 200),
    v_now
  );

  perform public.erp_accounting_write_audit(
    v_original.tenant_id,
    v_original.site_id,
    'journal',
    v_original.id,
    'journal.reversal-created',
    v_actor.account_id,
    'accounting-checker',
    'posted',
    'posted',
    v_reason,
    jsonb_build_object('reversalJournalId', v_reversal.id),
    v_key,
    v_hash
  );
  perform public.erp_accounting_write_audit(
    v_reversal.tenant_id,
    v_reversal.site_id,
    'journal',
    v_reversal.id,
    'journal.reversal-posted',
    v_actor.account_id,
    'accounting-checker',
    'draft',
    'posted',
    v_reason,
    jsonb_build_object('reversalOfJournalId', v_original.id),
    v_key,
    v_hash
  );

  insert into public.erp_accounting_command_receipts (
    tenant_id,
    command_scope,
    idempotency_key,
    actor_account_id,
    request_hash,
    entity_type,
    entity_id,
    resulting_version,
    response
  ) values (
    v_reversal.tenant_id,
    'reverse-journal',
    v_key,
    v_actor.account_id,
    v_hash,
    'journal',
    v_reversal.id,
    v_reversal.version,
    to_jsonb(v_reversal)
  );

  return v_reversal;
end;
$$;

create or replace function public.erp_accounting_change_period(
  p_period_key text,
  p_expected_version integer,
  p_actor_account_id text,
  p_action text,
  p_reason text,
  p_idempotency_key text,
  p_request_hash text
)
returns public.erp_accounting_periods
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_period public.erp_accounting_periods;
  v_actor public.erp_account_registry;
  v_receipt public.erp_accounting_command_receipts;
  v_action text := lower(trim(coalesce(p_action, '')));
  v_reason text := trim(coalesce(p_reason, ''));
  v_key text := trim(coalesce(p_idempotency_key, ''));
  v_hash text := trim(coalesce(p_request_hash, ''));
  v_now timestamptz := now();
begin
  if trim(coalesce(p_period_key, '')) !~ '^[0-9]{4}-(0[1-9]|1[0-2])$'
     or p_expected_version is null
     or p_expected_version < 1
     or v_action not in ('lock', 'reopen')
     or char_length(trim(coalesce(p_actor_account_id, ''))) not between 2 and 100
     or char_length(v_reason) not between 4 and 2000
     or char_length(v_key) not between 8 and 200
     or v_hash !~ '^[0-9a-f]{64}$' then
    raise exception using
      errcode = '22023',
      message = 'ACCOUNTING_PERIOD_COMMAND_INPUT_INVALID';
  end if;

  select *
  into v_actor
  from public.erp_account_registry account
  where account.account_id = trim(p_actor_account_id);
  if v_actor.account_id is null
     or v_actor.status <> 'active' then
    raise exception using
      errcode = '42501',
      message = 'ACCOUNTING_CHECKER_ROLE_REQUIRED';
  end if;

  select *
  into v_period
  from public.erp_accounting_periods period
  where period.tenant_id = v_actor.tenant_id
    and period.period_key = trim(p_period_key)
  for update;
  if v_period.id is null then
    raise exception using
      errcode = 'P0002',
      message = 'ACCOUNTING_PERIOD_NOT_FOUND';
  end if;
  if not public.erp_account_has_active_role(
    v_period.tenant_id,
    v_actor.account_id,
    'accounting-checker',
    null
  ) then
    raise exception using
      errcode = '42501',
      message = 'ACCOUNTING_CHECKER_ROLE_REQUIRED';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      v_period.tenant_id::text || ':change-period:' || v_key,
      0
    )
  );
  select *
  into v_receipt
  from public.erp_accounting_command_receipts receipt
  where receipt.tenant_id = v_period.tenant_id
    and receipt.command_scope = 'change-period'
    and receipt.idempotency_key = v_key;
  if v_receipt.id is not null then
    if v_receipt.actor_account_id <> v_actor.account_id
       or v_receipt.request_hash <> v_hash
       or v_receipt.entity_type <> 'period' then
      raise exception using
        errcode = '22023',
        message = 'ACCOUNTING_IDEMPOTENCY_CONFLICT';
    end if;
    select *
    into v_period
    from pg_catalog.jsonb_populate_record(
      null::public.erp_accounting_periods,
      v_receipt.response
    );
    return v_period;
  end if;

  if v_period.version <> p_expected_version then
    raise exception using
      errcode = '40001',
      message = 'ACCOUNTING_PERIOD_VERSION_CONFLICT';
  end if;

  if v_action = 'lock' then
    if v_period.status <> 'open' then
      raise exception using
        errcode = '22023',
        message = 'ACCOUNTING_PERIOD_ALREADY_LOCKED';
    end if;
    if exists (
      select 1
      from public.erp_accounting_journals journal
      where journal.tenant_id = v_period.tenant_id
        and journal.period_key = v_period.period_key
        and journal.status in (
          'draft',
          'pending-checker',
          'checker-returned'
        )
    ) then
      raise exception using
        errcode = '22023',
        message = 'ACCOUNTING_PERIOD_HAS_OPEN_JOURNALS';
    end if;
    update public.erp_accounting_periods
    set status = 'locked',
        version = version + 1,
        locked_by_account_id = v_actor.account_id,
        locked_at = v_now,
        lock_reason = v_reason,
        reopened_by_account_id = null,
        reopened_at = null,
        reopen_reason = null
    where id = v_period.id
    returning * into v_period;
  else
    if v_period.status <> 'locked' then
      raise exception using
        errcode = '22023',
        message = 'ACCOUNTING_PERIOD_ALREADY_OPEN';
    end if;
    update public.erp_accounting_periods
    set status = 'open',
        version = version + 1,
        locked_by_account_id = null,
        locked_at = null,
        lock_reason = null,
        reopened_by_account_id = v_actor.account_id,
        reopened_at = v_now,
        reopen_reason = v_reason
    where id = v_period.id
    returning * into v_period;
  end if;

  perform public.erp_accounting_write_audit(
    v_period.tenant_id,
    null,
    'period',
    v_period.id,
    case
      when v_action = 'lock' then 'period.locked'
      else 'period.reopened'
    end,
    v_actor.account_id,
    'accounting-checker',
    case
      when v_action = 'lock' then 'open'
      else 'locked'
    end,
    v_period.status,
    v_reason,
    jsonb_build_object(
      'periodKey', v_period.period_key,
      'version', v_period.version
    ),
    v_key,
    v_hash
  );

  insert into public.erp_accounting_command_receipts (
    tenant_id,
    command_scope,
    idempotency_key,
    actor_account_id,
    request_hash,
    entity_type,
    entity_id,
    resulting_version,
    response
  ) values (
    v_period.tenant_id,
    'change-period',
    v_key,
    v_actor.account_id,
    v_hash,
    'period',
    v_period.id,
    v_period.version,
    to_jsonb(v_period)
  );

  return v_period;
end;
$$;

alter table public.erp_account_registry enable row level security;
alter table public.erp_account_role_assignments enable row level security;
alter table public.erp_accounting_periods enable row level security;
alter table public.erp_accounting_journals enable row level security;
alter table public.erp_accounting_journal_lines enable row level security;
alter table public.erp_accounting_audit_events enable row level security;
alter table public.erp_accounting_command_receipts enable row level security;

revoke all on table public.erp_account_registry
  from public, anon, authenticated, service_role;
revoke all on table public.erp_account_role_assignments
  from public, anon, authenticated, service_role;
revoke all on table public.erp_accounting_periods
  from public, anon, authenticated, service_role;
revoke all on table public.erp_accounting_journals
  from public, anon, authenticated, service_role;
revoke all on table public.erp_accounting_journal_lines
  from public, anon, authenticated, service_role;
revoke all on table public.erp_accounting_audit_events
  from public, anon, authenticated, service_role;
revoke all on table public.erp_accounting_command_receipts
  from public, anon, authenticated, service_role;

grant select on table public.erp_account_registry to service_role;
grant select on table public.erp_account_role_assignments to service_role;
grant select on table public.erp_accounting_periods to service_role;
grant select on table public.erp_accounting_journals to service_role;
grant select on table public.erp_accounting_journal_lines to service_role;
grant select on table public.erp_accounting_audit_events to service_role;
grant select on table public.erp_accounting_command_receipts to service_role;

drop policy if exists erp_account_registry_service_read
  on public.erp_account_registry;
create policy erp_account_registry_service_read
on public.erp_account_registry
for select
to service_role
using (true);

drop policy if exists erp_account_role_service_read
  on public.erp_account_role_assignments;
create policy erp_account_role_service_read
on public.erp_account_role_assignments
for select
to service_role
using (true);

drop policy if exists erp_accounting_period_service_read
  on public.erp_accounting_periods;
create policy erp_accounting_period_service_read
on public.erp_accounting_periods
for select
to service_role
using (true);

drop policy if exists erp_accounting_journal_service_read
  on public.erp_accounting_journals;
create policy erp_accounting_journal_service_read
on public.erp_accounting_journals
for select
to service_role
using (true);

drop policy if exists erp_accounting_line_service_read
  on public.erp_accounting_journal_lines;
create policy erp_accounting_line_service_read
on public.erp_accounting_journal_lines
for select
to service_role
using (true);

drop policy if exists erp_accounting_audit_service_read
  on public.erp_accounting_audit_events;
create policy erp_accounting_audit_service_read
on public.erp_accounting_audit_events
for select
to service_role
using (true);

drop policy if exists erp_accounting_receipt_service_read
  on public.erp_accounting_command_receipts;
create policy erp_accounting_receipt_service_read
on public.erp_accounting_command_receipts
for select
to service_role
using (true);

revoke all on function public.erp_account_has_active_role(uuid, text, text, uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.erp_accounting_journal_is_balanced(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.erp_accounting_write_audit(
  uuid, uuid, text, uuid, text, text, text, text, text, text, jsonb, text, text
) from public, anon, authenticated, service_role;
revoke all on function public.erp_validate_accounting_period_update()
  from public, anon, authenticated, service_role;
revoke all on function public.erp_validate_accounting_journal_update()
  from public, anon, authenticated, service_role;
revoke all on function public.erp_protect_accounting_journal_lines()
  from public, anon, authenticated, service_role;
revoke all on function public.erp_protect_accounting_audit()
  from public, anon, authenticated, service_role;
revoke all on function public.erp_require_posted_accounting_journal()
  from public, anon, authenticated, service_role;

revoke all on function public.erp_accounting_prepare_shift_close(
  uuid, integer, text, text, text, text
) from public, anon, authenticated, service_role;
revoke all on function public.erp_accounting_review_journal(
  uuid, integer, text, text, text, text, text
) from public, anon, authenticated, service_role;
revoke all on function public.erp_accounting_reverse_journal(
  uuid, integer, text, text, text, text
) from public, anon, authenticated, service_role;
revoke all on function public.erp_accounting_change_period(
  text, integer, text, text, text, text, text
) from public, anon, authenticated, service_role;

grant execute on function public.erp_accounting_prepare_shift_close(
  uuid, integer, text, text, text, text
) to service_role;
grant execute on function public.erp_accounting_review_journal(
  uuid, integer, text, text, text, text, text
) to service_role;
grant execute on function public.erp_accounting_reverse_journal(
  uuid, integer, text, text, text, text
) to service_role;
grant execute on function public.erp_accounting_change_period(
  text, integer, text, text, text, text, text
) to service_role;

commit;
