-- ERP supplier invoice to accounts-payable liability workflow.
--
-- This forward-only slice keeps purchase/acceptance/invoice source data
-- separate from accounting journals. Source capture, three-way matching,
-- exception routing, maker preparation, checker posting, audit and
-- idempotency are enforced in PostgreSQL. Bank payment is intentionally not
-- represented here; it belongs to the next AP settlement slice.

begin;

create table if not exists public.erp_ap_suppliers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete restrict,
  supplier_code text not null check (char_length(trim(supplier_code)) between 3 and 40),
  legal_name text not null check (char_length(trim(legal_name)) between 2 and 200),
  tax_code text not null check (regexp_replace(tax_code, '[^0-9]', '', 'g') ~ '^([0-9]{10}|[0-9]{13})$'),
  tax_code_normalized text generated always as (
    regexp_replace(tax_code, '[^0-9]', '', 'g')
  ) stored,
  payment_terms_days integer not null default 0 check (payment_terms_days between 0 and 365),
  status text not null default 'active' check (status in ('active', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, supplier_code),
  unique (tenant_id, site_id, tax_code_normalized),
  unique (id, tenant_id, site_id)
);

create table if not exists public.erp_ap_posting_rules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  expense_category text not null check (char_length(trim(expense_category)) between 3 and 80),
  debit_account_code text not null check (
    debit_account_code ~ '^(154|153|211|242|627[0-9]*|632[0-9]*|641[0-9]*|642[0-9]*)$'
  ),
  debit_account_name text not null check (char_length(trim(debit_account_name)) between 3 and 160),
  input_vat_account_code text not null default '1331' check (input_vat_account_code = '1331'),
  input_vat_account_name text not null default 'Thuế GTGT được khấu trừ của hàng hóa, dịch vụ',
  payable_account_code text not null default '331' check (payable_account_code = '331'),
  payable_account_name text not null default 'Phải trả cho người bán',
  match_tolerance_vnd bigint not null default 0 check (match_tolerance_vnd between 0 and 1000000000),
  director_exception_threshold_vnd bigint not null default 50000000 check (
    director_exception_threshold_vnd between 0 and 1000000000000
  ),
  effective_from date not null,
  effective_until date,
  status text not null default 'active' check (status in ('active', 'retired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, expense_category, effective_from),
  unique (id, tenant_id),
  check (effective_until is null or effective_until >= effective_from)
);

create table if not exists public.erp_ap_supplier_invoices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete restrict,
  supplier_id uuid not null,
  posting_rule_id uuid not null,
  case_code text not null check (char_length(trim(case_code)) between 8 and 80),
  request_reference text not null check (char_length(trim(request_reference)) between 3 and 100),
  purchase_order_reference text not null default '' check (char_length(purchase_order_reference) <= 100),
  contract_reference text check (contract_reference is null or char_length(trim(contract_reference)) between 3 and 100),
  purchase_order_total_vnd bigint not null check (purchase_order_total_vnd >= 0),
  acceptance_reference text not null default '' check (char_length(acceptance_reference) <= 100),
  accepted_total_vnd bigint not null check (accepted_total_vnd >= 0),
  supplier_tax_code_snapshot text not null,
  supplier_tax_code_normalized text generated always as (
    regexp_replace(supplier_tax_code_snapshot, '[^0-9]', '', 'g')
  ) stored,
  invoice_series text not null check (char_length(trim(invoice_series)) between 1 and 50),
  invoice_number text not null check (char_length(trim(invoice_number)) between 1 and 50),
  invoice_series_normalized text generated always as (
    upper(regexp_replace(invoice_series, '[^0-9A-Za-z]', '', 'g'))
  ) stored,
  invoice_number_normalized text generated always as (
    upper(regexp_replace(invoice_number, '[^0-9A-Za-z]', '', 'g'))
  ) stored,
  invoice_date date not null,
  due_date date not null,
  net_vnd bigint not null check (net_vnd >= 0),
  vat_vnd bigint not null check (vat_vnd >= 0),
  total_vnd bigint not null check (total_vnd > 0),
  currency text not null default 'VND' check (currency = 'VND'),
  cost_center text not null check (char_length(trim(cost_center)) between 2 and 80),
  project_code text check (project_code is null or char_length(trim(project_code)) between 2 and 80),
  match_status text not null check (match_status in ('matched', 'exception')),
  exception_codes text[] not null default '{}'::text[],
  exception_note text,
  exception_approved_by_account_id text,
  exception_approved_at timestamptz,
  status text not null check (
    status in (
      'match-exception',
      'ready-for-accounting',
      'accounting-review',
      'accounting-returned',
      'director-exception',
      'posted',
      'reversed'
    )
  ),
  owner_role text not null check (
    owner_role in ('manager', 'accountant', 'chief-accountant', 'director', 'none')
  ),
  version integer not null default 1 check (version > 0),
  manager_account_id text not null,
  accountant_account_id text,
  accountant_note text,
  checker_account_id text,
  checker_note text,
  journal_id uuid,
  submitted_at timestamptz not null default now(),
  posted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, case_code),
  unique (
    tenant_id,
    supplier_tax_code_normalized,
    invoice_series_normalized,
    invoice_number_normalized
  ),
  unique (id, tenant_id, site_id),
  foreign key (supplier_id, tenant_id, site_id)
    references public.erp_ap_suppliers(id, tenant_id, site_id)
    on delete restrict,
  foreign key (posting_rule_id, tenant_id)
    references public.erp_ap_posting_rules(id, tenant_id)
    on delete restrict,
  foreign key (manager_account_id, tenant_id)
    references public.erp_account_registry(account_id, tenant_id)
    on delete restrict,
  foreign key (accountant_account_id, tenant_id)
    references public.erp_account_registry(account_id, tenant_id)
    on delete restrict,
  foreign key (checker_account_id, tenant_id)
    references public.erp_account_registry(account_id, tenant_id)
    on delete restrict,
  foreign key (exception_approved_by_account_id, tenant_id)
    references public.erp_account_registry(account_id, tenant_id)
    on delete restrict,
  check (due_date >= invoice_date),
  check (net_vnd + vat_vnd = total_vnd),
  check (
    (match_status = 'matched' and cardinality(exception_codes) = 0)
    or
    (match_status = 'exception' and cardinality(exception_codes) > 0)
  ),
  check (
    (status = 'posted' and owner_role = 'none' and journal_id is not null and posted_at is not null)
    or status <> 'posted'
  ),
  check (
    (status = 'accounting-review' and owner_role = 'chief-accountant' and journal_id is not null)
    or status <> 'accounting-review'
  ),
  check (
    (status = 'director-exception' and owner_role = 'director')
    or status <> 'director-exception'
  )
);

create table if not exists public.erp_ap_supplier_invoice_lines (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null,
  tenant_id uuid not null,
  site_id uuid not null,
  line_number integer not null check (line_number > 0),
  description text not null check (char_length(trim(description)) between 3 and 500),
  quantity numeric(18, 4) not null check (quantity > 0),
  unit_price_vnd bigint not null check (unit_price_vnd >= 0),
  net_vnd bigint not null check (net_vnd > 0),
  vat_vnd bigint not null check (vat_vnd >= 0),
  created_at timestamptz not null default now(),
  foreign key (invoice_id, tenant_id, site_id)
    references public.erp_ap_supplier_invoices(id, tenant_id, site_id)
    on delete restrict,
  unique (invoice_id, line_number)
);

create table if not exists public.erp_ap_audit_events (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null,
  tenant_id uuid not null,
  site_id uuid not null,
  sequence_number integer not null check (sequence_number > 0),
  event_type text not null check (char_length(trim(event_type)) between 3 and 100),
  from_status text,
  to_status text not null,
  actor_account_id text not null,
  actor_role text not null check (
    actor_role in ('manager', 'accountant', 'chief-accountant', 'director', 'system')
  ),
  note text not null default '' check (char_length(note) <= 2000),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  command_scope text not null check (char_length(trim(command_scope)) between 3 and 100),
  idempotency_key text not null check (char_length(trim(idempotency_key)) between 8 and 200),
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  foreign key (invoice_id, tenant_id, site_id)
    references public.erp_ap_supplier_invoices(id, tenant_id, site_id)
    on delete restrict,
  unique (invoice_id, sequence_number),
  unique (tenant_id, command_scope, idempotency_key)
);

create table if not exists public.erp_ap_command_receipts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  command_scope text not null check (char_length(trim(command_scope)) between 3 and 100),
  idempotency_key text not null check (char_length(trim(idempotency_key)) between 8 and 200),
  actor_account_id text not null,
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  invoice_id uuid not null,
  resulting_version integer not null check (resulting_version > 0),
  response jsonb not null check (jsonb_typeof(response) = 'object'),
  created_at timestamptz not null default now(),
  foreign key (actor_account_id, tenant_id)
    references public.erp_account_registry(account_id, tenant_id)
    on delete restrict,
  unique (tenant_id, command_scope, idempotency_key)
);

create index if not exists erp_ap_supplier_invoice_queue_idx
  on public.erp_ap_supplier_invoices (
    tenant_id,
    owner_role,
    status,
    due_date,
    updated_at desc
  );
create index if not exists erp_ap_supplier_invoice_site_idx
  on public.erp_ap_supplier_invoices (site_id, status, due_date);
create index if not exists erp_ap_audit_invoice_idx
  on public.erp_ap_audit_events (invoice_id, sequence_number);

alter table public.erp_accounting_journals
  drop constraint if exists erp_accounting_journals_source_type_check;
alter table public.erp_accounting_journals
  alter column source_workflow_id drop not null;
alter table public.erp_accounting_journals
  add column if not exists source_supplier_invoice_id uuid;
alter table public.erp_accounting_journals
  add constraint erp_accounting_journals_source_supplier_invoice_fk
  foreign key (source_supplier_invoice_id, tenant_id, site_id)
  references public.erp_ap_supplier_invoices(id, tenant_id, site_id)
  on delete restrict;
alter table public.erp_accounting_journals
  add constraint erp_accounting_journals_source_identity_check
  check (
    (
      source_type = 'shift-close'
      and source_workflow_id is not null
      and source_supplier_invoice_id is null
    )
    or
    (
      source_type = 'supplier-invoice'
      and source_workflow_id is null
      and source_supplier_invoice_id is not null
    )
  );

create unique index if not exists erp_accounting_one_open_journal_per_ap_invoice_idx
  on public.erp_accounting_journals (tenant_id, source_supplier_invoice_id)
  where source_type = 'supplier-invoice'
    and reversal_of_journal_id is null
    and status in ('draft', 'pending-checker', 'checker-returned');
create index if not exists erp_accounting_journal_ap_source_idx
  on public.erp_accounting_journals (
    tenant_id,
    source_supplier_invoice_id,
    created_at desc
  )
  where source_type = 'supplier-invoice';

alter table public.erp_ap_supplier_invoices
  add constraint erp_ap_supplier_invoices_journal_fk
  foreign key (journal_id, tenant_id, site_id)
  references public.erp_accounting_journals(id, tenant_id, site_id)
  on delete restrict;

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
  if old.source_type = 'supplier-invoice'
     and coalesce(
       pg_catalog.current_setting('app.erp_ap_mutation', true),
       ''
     ) <> 'allowed' then
    raise exception using
      errcode = '22023',
      message = 'AP_JOURNAL_REQUIRES_AP_WORKFLOW';
  end if;
  if old.status = 'posted' then
    raise exception using
      errcode = '22023',
      message = 'ACCOUNTING_POSTED_JOURNAL_IMMUTABLE';
  end if;
  if new.id is distinct from old.id
     or new.tenant_id is distinct from old.tenant_id
     or new.site_id is distinct from old.site_id
     or new.journal_code is distinct from old.journal_code
     or new.source_type is distinct from old.source_type
     or new.source_workflow_id is distinct from old.source_workflow_id
     or new.source_supplier_invoice_id is distinct from old.source_supplier_invoice_id
     or new.business_date is distinct from old.business_date
     or new.period_key is distinct from old.period_key
     or new.maker_account_id is distinct from old.maker_account_id
     or new.reversal_of_journal_id is distinct from old.reversal_of_journal_id
     or new.supersedes_journal_id is distinct from old.supersedes_journal_id
     or new.created_at is distinct from old.created_at then
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

create or replace function public.erp_validate_ap_invoice_update()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception using
      errcode = '22023',
      message = 'AP_INVOICE_DELETE_NOT_ALLOWED';
  end if;
  if old.status in ('posted', 'reversed') then
    raise exception using
      errcode = '22023',
      message = 'AP_POSTED_SOURCE_IMMUTABLE';
  end if;
  if new.id is distinct from old.id
     or new.tenant_id is distinct from old.tenant_id
     or new.site_id is distinct from old.site_id
     or new.supplier_id is distinct from old.supplier_id
     or new.case_code is distinct from old.case_code
     or new.supplier_tax_code_snapshot is distinct from old.supplier_tax_code_snapshot
     or new.invoice_series is distinct from old.invoice_series
     or new.invoice_number is distinct from old.invoice_number
     or new.invoice_date is distinct from old.invoice_date
     or new.net_vnd is distinct from old.net_vnd
     or new.vat_vnd is distinct from old.vat_vnd
     or new.total_vnd is distinct from old.total_vnd
     or new.currency is distinct from old.currency
     or new.manager_account_id is distinct from old.manager_account_id
     or new.created_at is distinct from old.created_at then
    raise exception using
      errcode = '22023',
      message = 'AP_INVOICE_IDENTITY_IMMUTABLE';
  end if;
  if new.version <> old.version + 1 then
    raise exception using
      errcode = '40001',
      message = 'AP_INVOICE_VERSION_MUST_INCREMENT';
  end if;
  if not (
    (old.status = 'match-exception' and new.status in ('match-exception', 'ready-for-accounting', 'director-exception'))
    or (old.status = 'director-exception' and new.status in ('match-exception', 'ready-for-accounting'))
    or (old.status = 'ready-for-accounting' and new.status = 'accounting-review')
    or (old.status = 'accounting-returned' and new.status = 'accounting-review')
    or (old.status = 'accounting-review' and new.status in ('accounting-returned', 'posted'))
  ) then
    raise exception using
      errcode = '22023',
      message = 'AP_INVOICE_TRANSITION_NOT_ALLOWED';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists erp_ap_invoice_integrity
  on public.erp_ap_supplier_invoices;
create trigger erp_ap_invoice_integrity
before update or delete on public.erp_ap_supplier_invoices
for each row execute function public.erp_validate_ap_invoice_update();

create or replace function public.erp_protect_ap_invoice_lines()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_invoice_id uuid;
  v_status text;
begin
  v_invoice_id := case when tg_op = 'DELETE' then old.invoice_id else new.invoice_id end;
  select invoice.status
  into v_status
  from public.erp_ap_supplier_invoices invoice
  where invoice.id = v_invoice_id;
  if v_status is null then
    raise exception using errcode = 'P0002', message = 'AP_INVOICE_NOT_FOUND';
  end if;
  if v_status not in ('match-exception', 'ready-for-accounting') then
    raise exception using
      errcode = '22023',
      message = 'AP_INVOICE_LINES_IMMUTABLE_AFTER_ACCOUNTING';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists erp_ap_invoice_line_integrity
  on public.erp_ap_supplier_invoice_lines;
create trigger erp_ap_invoice_line_integrity
before insert or update or delete on public.erp_ap_supplier_invoice_lines
for each row execute function public.erp_protect_ap_invoice_lines();

create or replace function public.erp_protect_ap_audit()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception using
    errcode = '22023',
    message = 'AP_AUDIT_IS_APPEND_ONLY';
end;
$$;

drop trigger if exists erp_ap_audit_immutable
  on public.erp_ap_audit_events;
create trigger erp_ap_audit_immutable
before update or delete on public.erp_ap_audit_events
for each row execute function public.erp_protect_ap_audit();

create or replace function public.erp_ap_write_audit(
  p_invoice_id uuid,
  p_tenant_id uuid,
  p_site_id uuid,
  p_event_type text,
  p_from_status text,
  p_to_status text,
  p_actor_account_id text,
  p_actor_role text,
  p_note text,
  p_metadata jsonb,
  p_command_scope text,
  p_idempotency_key text,
  p_request_hash text
)
returns public.erp_ap_audit_events
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.erp_ap_audit_events;
  v_sequence integer;
begin
  select coalesce(max(event.sequence_number), 0) + 1
  into v_sequence
  from public.erp_ap_audit_events event
  where event.invoice_id = p_invoice_id;

  insert into public.erp_ap_audit_events (
    invoice_id,
    tenant_id,
    site_id,
    sequence_number,
    event_type,
    from_status,
    to_status,
    actor_account_id,
    actor_role,
    note,
    metadata,
    command_scope,
    idempotency_key,
    request_hash
  ) values (
    p_invoice_id,
    p_tenant_id,
    p_site_id,
    v_sequence,
    p_event_type,
    p_from_status,
    p_to_status,
    p_actor_account_id,
    p_actor_role,
    trim(coalesce(p_note, '')),
    coalesce(p_metadata, '{}'::jsonb),
    trim(p_command_scope),
    p_idempotency_key,
    p_request_hash
  )
  returning * into v_event;

  return v_event;
end;
$$;

create or replace function public.erp_ap_match_exception_codes(
  p_supplier_tax_code text,
  p_purchase_order_reference text,
  p_purchase_order_total_vnd bigint,
  p_acceptance_reference text,
  p_accepted_total_vnd bigint,
  p_invoice_date date,
  p_due_date date,
  p_net_vnd bigint,
  p_vat_vnd bigint,
  p_total_vnd bigint,
  p_tolerance_vnd bigint
)
returns text[]
language plpgsql
stable
set search_path = ''
as $$
declare
  v_exceptions text[] := '{}'::text[];
  v_tolerance bigint := greatest(coalesce(p_tolerance_vnd, 0), 0);
begin
  if char_length(trim(coalesce(p_purchase_order_reference, ''))) = 0 then
    v_exceptions := array_append(v_exceptions, 'missing-purchase-order');
  end if;
  if char_length(trim(coalesce(p_acceptance_reference, ''))) = 0 then
    v_exceptions := array_append(v_exceptions, 'missing-acceptance');
  end if;
  if regexp_replace(coalesce(p_supplier_tax_code, ''), '[^0-9]', '', 'g')
     !~ '^([0-9]{10}|[0-9]{13})$' then
    v_exceptions := array_append(v_exceptions, 'invalid-supplier-tax-code');
  end if;
  if p_invoice_date is null
     or p_due_date is null
     or p_invoice_date > current_date
     or p_due_date < p_invoice_date then
    v_exceptions := array_append(v_exceptions, 'invalid-invoice-date');
  end if;
  if coalesce(p_net_vnd, -1) < 0
     or coalesce(p_vat_vnd, -1) < 0
     or coalesce(p_total_vnd, 0) <= 0
     or p_net_vnd + p_vat_vnd <> p_total_vnd then
    v_exceptions := array_append(v_exceptions, 'invoice-total-mismatch');
  end if;
  if coalesce(p_purchase_order_total_vnd, -1) < 0
     or p_total_vnd > p_purchase_order_total_vnd + v_tolerance then
    v_exceptions := array_append(v_exceptions, 'invoice-over-purchase-order');
  end if;
  if coalesce(p_accepted_total_vnd, -1) < 0
     or p_total_vnd > p_accepted_total_vnd + v_tolerance then
    v_exceptions := array_append(v_exceptions, 'invoice-over-acceptance');
  end if;
  return v_exceptions;
end;
$$;

create or replace function public.erp_ap_submit_supplier_invoice(
  p_site_id uuid,
  p_supplier_id uuid,
  p_request_reference text,
  p_purchase_order_reference text,
  p_contract_reference text,
  p_purchase_order_total_vnd bigint,
  p_acceptance_reference text,
  p_accepted_total_vnd bigint,
  p_invoice_series text,
  p_invoice_number text,
  p_invoice_date date,
  p_due_date date,
  p_net_vnd bigint,
  p_vat_vnd bigint,
  p_total_vnd bigint,
  p_expense_category text,
  p_description text,
  p_cost_center text,
  p_project_code text,
  p_actor_account_id text,
  p_note text,
  p_idempotency_key text,
  p_request_hash text
)
returns public.erp_ap_supplier_invoices
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_supplier public.erp_ap_suppliers;
  v_rule public.erp_ap_posting_rules;
  v_actor public.erp_account_registry;
  v_invoice public.erp_ap_supplier_invoices;
  v_receipt public.erp_ap_command_receipts;
  v_invoice_id uuid := gen_random_uuid();
  v_exceptions text[];
  v_status text;
  v_owner_role text;
  v_note text := trim(coalesce(p_note, ''));
  v_key text := trim(coalesce(p_idempotency_key, ''));
  v_hash text := trim(coalesce(p_request_hash, ''));
  v_now timestamptz := now();
begin
  if p_site_id is null
     or p_supplier_id is null
     or char_length(trim(coalesce(p_request_reference, ''))) not between 3 and 100
     or char_length(trim(coalesce(p_invoice_series, ''))) not between 1 and 50
     or char_length(trim(coalesce(p_invoice_number, ''))) not between 1 and 50
     or char_length(trim(coalesce(p_expense_category, ''))) not between 3 and 80
     or char_length(trim(coalesce(p_description, ''))) not between 3 and 500
     or char_length(trim(coalesce(p_cost_center, ''))) not between 2 and 80
     or char_length(trim(coalesce(p_actor_account_id, ''))) not between 2 and 100
     or char_length(v_note) not between 4 and 2000
     or char_length(v_key) not between 8 and 200
     or v_hash !~ '^[0-9a-f]{64}$'
     or coalesce(p_net_vnd, -1) < 0
     or coalesce(p_vat_vnd, -1) < 0
     or coalesce(p_total_vnd, 0) <= 0
     or p_net_vnd + p_vat_vnd <> p_total_vnd
     or p_invoice_date is null
     or p_due_date is null
     or p_invoice_date > current_date
     or p_due_date < p_invoice_date then
    raise exception using errcode = '22023', message = 'AP_SUBMIT_INPUT_INVALID';
  end if;

  select *
  into v_supplier
  from public.erp_ap_suppliers supplier
  where supplier.id = p_supplier_id
    and supplier.site_id = p_site_id
    and supplier.status = 'active';
  if v_supplier.id is null then
    raise exception using errcode = 'P0002', message = 'AP_SUPPLIER_NOT_FOUND';
  end if;

  select *
  into v_actor
  from public.erp_account_registry account
  where account.account_id = trim(p_actor_account_id)
    and account.tenant_id = v_supplier.tenant_id;
  if v_actor.account_id is null
     or not public.erp_account_has_active_role(
       v_supplier.tenant_id,
       v_actor.account_id,
       'regional-manager',
       v_supplier.site_id
     ) then
    raise exception using errcode = '42501', message = 'AP_MANAGER_ROLE_REQUIRED';
  end if;

  select *
  into v_rule
  from public.erp_ap_posting_rules rule
  where rule.tenant_id = v_supplier.tenant_id
    and rule.expense_category = trim(p_expense_category)
    and rule.status = 'active'
    and rule.effective_from <= p_invoice_date
    and (rule.effective_until is null or rule.effective_until >= p_invoice_date)
  order by rule.effective_from desc
  limit 1;
  if v_rule.id is null then
    raise exception using errcode = 'P0002', message = 'AP_POSTING_RULE_NOT_FOUND';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      v_supplier.tenant_id::text || ':ap-submit:' || v_key,
      0
    )
  );
  select *
  into v_receipt
  from public.erp_ap_command_receipts receipt
  where receipt.tenant_id = v_supplier.tenant_id
    and receipt.command_scope = 'submit-supplier-invoice'
    and receipt.idempotency_key = v_key;
  if v_receipt.id is not null then
    if v_receipt.actor_account_id <> v_actor.account_id
       or v_receipt.request_hash <> v_hash then
      raise exception using errcode = '22023', message = 'AP_IDEMPOTENCY_CONFLICT';
    end if;
    select *
    into v_invoice
    from pg_catalog.jsonb_populate_record(
      null::public.erp_ap_supplier_invoices,
      v_receipt.response
    );
    return v_invoice;
  end if;

  v_exceptions := public.erp_ap_match_exception_codes(
    v_supplier.tax_code,
    p_purchase_order_reference,
    p_purchase_order_total_vnd,
    p_acceptance_reference,
    p_accepted_total_vnd,
    p_invoice_date,
    p_due_date,
    p_net_vnd,
    p_vat_vnd,
    p_total_vnd,
    v_rule.match_tolerance_vnd
  );
  v_status := case
    when cardinality(v_exceptions) = 0 then 'ready-for-accounting'
    else 'match-exception'
  end;
  v_owner_role := case
    when cardinality(v_exceptions) = 0 then 'accountant'
    else 'manager'
  end;

  insert into public.erp_ap_supplier_invoices (
    id,
    tenant_id,
    site_id,
    supplier_id,
    posting_rule_id,
    case_code,
    request_reference,
    purchase_order_reference,
    contract_reference,
    purchase_order_total_vnd,
    acceptance_reference,
    accepted_total_vnd,
    supplier_tax_code_snapshot,
    invoice_series,
    invoice_number,
    invoice_date,
    due_date,
    net_vnd,
    vat_vnd,
    total_vnd,
    cost_center,
    project_code,
    match_status,
    exception_codes,
    exception_note,
    status,
    owner_role,
    manager_account_id,
    submitted_at
  ) values (
    v_invoice_id,
    v_supplier.tenant_id,
    v_supplier.site_id,
    v_supplier.id,
    v_rule.id,
    left(
      'AP-' || v_supplier.supplier_code || '-'
      || to_char(p_invoice_date, 'YYYYMM') || '-'
      || upper(substr(v_invoice_id::text, 1, 6)),
      80
    ),
    trim(p_request_reference),
    trim(coalesce(p_purchase_order_reference, '')),
    nullif(trim(coalesce(p_contract_reference, '')), ''),
    p_purchase_order_total_vnd,
    trim(coalesce(p_acceptance_reference, '')),
    p_accepted_total_vnd,
    v_supplier.tax_code,
    trim(p_invoice_series),
    trim(p_invoice_number),
    p_invoice_date,
    p_due_date,
    p_net_vnd,
    p_vat_vnd,
    p_total_vnd,
    trim(p_cost_center),
    nullif(trim(coalesce(p_project_code, '')), ''),
    case when cardinality(v_exceptions) = 0 then 'matched' else 'exception' end,
    v_exceptions,
    case when cardinality(v_exceptions) = 0 then null else v_note end,
    v_status,
    v_owner_role,
    v_actor.account_id,
    v_now
  )
  returning * into v_invoice;

  insert into public.erp_ap_supplier_invoice_lines (
    invoice_id,
    tenant_id,
    site_id,
    line_number,
    description,
    quantity,
    unit_price_vnd,
    net_vnd,
    vat_vnd
  ) values (
    v_invoice.id,
    v_invoice.tenant_id,
    v_invoice.site_id,
    1,
    trim(p_description),
    1,
    p_net_vnd,
    p_net_vnd,
    p_vat_vnd
  );

  perform public.erp_ap_write_audit(
    v_invoice.id,
    v_invoice.tenant_id,
    v_invoice.site_id,
    case
      when v_status = 'ready-for-accounting' then 'invoice.submitted-and-matched'
      else 'invoice.submitted-with-exception'
    end,
    null,
    v_status,
    v_actor.account_id,
    'manager',
    v_note,
    jsonb_build_object(
      'exceptionCodes', to_jsonb(v_exceptions),
      'purchaseOrderReference', v_invoice.purchase_order_reference,
      'acceptanceReference', v_invoice.acceptance_reference
    ),
    'submit-supplier-invoice',
    v_key,
    v_hash
  );

  insert into public.erp_ap_command_receipts (
    tenant_id,
    command_scope,
    idempotency_key,
    actor_account_id,
    request_hash,
    invoice_id,
    resulting_version,
    response
  ) values (
    v_invoice.tenant_id,
    'submit-supplier-invoice',
    v_key,
    v_actor.account_id,
    v_hash,
    v_invoice.id,
    v_invoice.version,
    to_jsonb(v_invoice)
  );

  return v_invoice;
exception
  when unique_violation then
    raise exception using errcode = '23505', message = 'AP_DUPLICATE_INVOICE';
end;
$$;

create or replace function public.erp_ap_resubmit_supplier_invoice(
  p_invoice_id uuid,
  p_expected_version integer,
  p_purchase_order_reference text,
  p_purchase_order_total_vnd bigint,
  p_acceptance_reference text,
  p_accepted_total_vnd bigint,
  p_actor_account_id text,
  p_note text,
  p_idempotency_key text,
  p_request_hash text
)
returns public.erp_ap_supplier_invoices
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invoice public.erp_ap_supplier_invoices;
  v_supplier public.erp_ap_suppliers;
  v_rule public.erp_ap_posting_rules;
  v_actor public.erp_account_registry;
  v_receipt public.erp_ap_command_receipts;
  v_exceptions text[];
  v_status text;
  v_note text := trim(coalesce(p_note, ''));
  v_key text := trim(coalesce(p_idempotency_key, ''));
  v_hash text := trim(coalesce(p_request_hash, ''));
begin
  if p_invoice_id is null
     or p_expected_version is null
     or p_expected_version < 1
     or char_length(trim(coalesce(p_actor_account_id, ''))) not between 2 and 100
     or char_length(v_note) not between 4 and 2000
     or char_length(v_key) not between 8 and 200
     or v_hash !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = '22023', message = 'AP_RESUBMIT_INPUT_INVALID';
  end if;

  select *
  into v_invoice
  from public.erp_ap_supplier_invoices invoice
  where invoice.id = p_invoice_id
  for update;
  if v_invoice.id is null then
    raise exception using errcode = 'P0002', message = 'AP_INVOICE_NOT_FOUND';
  end if;

  select * into v_supplier
  from public.erp_ap_suppliers supplier
  where supplier.id = v_invoice.supplier_id;
  select * into v_rule
  from public.erp_ap_posting_rules rule
  where rule.id = v_invoice.posting_rule_id;
  select * into v_actor
  from public.erp_account_registry account
  where account.account_id = trim(p_actor_account_id)
    and account.tenant_id = v_invoice.tenant_id;
  if v_actor.account_id is null
     or not public.erp_account_has_active_role(
       v_invoice.tenant_id,
       v_actor.account_id,
       'regional-manager',
       v_invoice.site_id
     ) then
    raise exception using errcode = '42501', message = 'AP_MANAGER_ROLE_REQUIRED';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_invoice.tenant_id::text || ':ap-resubmit:' || v_key, 0)
  );
  select *
  into v_receipt
  from public.erp_ap_command_receipts receipt
  where receipt.tenant_id = v_invoice.tenant_id
    and receipt.command_scope = 'resubmit-supplier-invoice'
    and receipt.idempotency_key = v_key;
  if v_receipt.id is not null then
    if v_receipt.actor_account_id <> v_actor.account_id
       or v_receipt.request_hash <> v_hash then
      raise exception using errcode = '22023', message = 'AP_IDEMPOTENCY_CONFLICT';
    end if;
    select * into v_invoice
    from pg_catalog.jsonb_populate_record(
      null::public.erp_ap_supplier_invoices,
      v_receipt.response
    );
    return v_invoice;
  end if;

  if v_invoice.version <> p_expected_version then
    raise exception using errcode = '40001', message = 'AP_INVOICE_VERSION_CONFLICT';
  end if;
  if v_invoice.status <> 'match-exception'
     or v_invoice.owner_role <> 'manager' then
    raise exception using errcode = '22023', message = 'AP_INVOICE_NOT_RETURNED_TO_MANAGER';
  end if;

  v_exceptions := public.erp_ap_match_exception_codes(
    v_supplier.tax_code,
    p_purchase_order_reference,
    p_purchase_order_total_vnd,
    p_acceptance_reference,
    p_accepted_total_vnd,
    v_invoice.invoice_date,
    v_invoice.due_date,
    v_invoice.net_vnd,
    v_invoice.vat_vnd,
    v_invoice.total_vnd,
    v_rule.match_tolerance_vnd
  );
  v_status := case
    when cardinality(v_exceptions) = 0 then 'ready-for-accounting'
    else 'match-exception'
  end;

  update public.erp_ap_supplier_invoices
  set purchase_order_reference = trim(coalesce(p_purchase_order_reference, '')),
      purchase_order_total_vnd = p_purchase_order_total_vnd,
      acceptance_reference = trim(coalesce(p_acceptance_reference, '')),
      accepted_total_vnd = p_accepted_total_vnd,
      match_status = case when cardinality(v_exceptions) = 0 then 'matched' else 'exception' end,
      exception_codes = v_exceptions,
      exception_note = case when cardinality(v_exceptions) = 0 then null else v_note end,
      status = v_status,
      owner_role = case when cardinality(v_exceptions) = 0 then 'accountant' else 'manager' end,
      version = version + 1
  where id = v_invoice.id
  returning * into v_invoice;

  perform public.erp_ap_write_audit(
    v_invoice.id,
    v_invoice.tenant_id,
    v_invoice.site_id,
    case when v_status = 'ready-for-accounting' then 'invoice.resubmitted-and-matched' else 'invoice.resubmitted-with-exception' end,
    'match-exception',
    v_status,
    v_actor.account_id,
    'manager',
    v_note,
    jsonb_build_object('exceptionCodes', to_jsonb(v_exceptions)),
    'resubmit-supplier-invoice',
    v_key,
    v_hash
  );

  insert into public.erp_ap_command_receipts (
    tenant_id, command_scope, idempotency_key, actor_account_id,
    request_hash, invoice_id, resulting_version, response
  ) values (
    v_invoice.tenant_id, 'resubmit-supplier-invoice', v_key,
    v_actor.account_id, v_hash, v_invoice.id, v_invoice.version, to_jsonb(v_invoice)
  );
  return v_invoice;
end;
$$;

create or replace function public.erp_ap_escalate_supplier_invoice(
  p_invoice_id uuid,
  p_expected_version integer,
  p_actor_account_id text,
  p_note text,
  p_idempotency_key text,
  p_request_hash text
)
returns public.erp_ap_supplier_invoices
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invoice public.erp_ap_supplier_invoices;
  v_rule public.erp_ap_posting_rules;
  v_actor public.erp_account_registry;
  v_receipt public.erp_ap_command_receipts;
  v_variance bigint;
  v_note text := trim(coalesce(p_note, ''));
  v_key text := trim(coalesce(p_idempotency_key, ''));
  v_hash text := trim(coalesce(p_request_hash, ''));
begin
  if p_invoice_id is null
     or p_expected_version is null
     or p_expected_version < 1
     or char_length(trim(coalesce(p_actor_account_id, ''))) not between 2 and 100
     or char_length(v_note) not between 4 and 2000
     or char_length(v_key) not between 8 and 200
     or v_hash !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = '22023', message = 'AP_ESCALATE_INPUT_INVALID';
  end if;

  select *
  into v_invoice
  from public.erp_ap_supplier_invoices invoice
  where invoice.id = p_invoice_id
  for update;
  if v_invoice.id is null then
    raise exception using errcode = 'P0002', message = 'AP_INVOICE_NOT_FOUND';
  end if;
  select * into v_rule
  from public.erp_ap_posting_rules rule
  where rule.id = v_invoice.posting_rule_id;
  select * into v_actor
  from public.erp_account_registry account
  where account.account_id = trim(p_actor_account_id)
    and account.tenant_id = v_invoice.tenant_id;
  if v_actor.account_id is null
     or not public.erp_account_has_active_role(
       v_invoice.tenant_id,
       v_actor.account_id,
       'accountant-maker',
       v_invoice.site_id
     ) then
    raise exception using errcode = '42501', message = 'AP_ACCOUNTANT_ROLE_REQUIRED';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_invoice.tenant_id::text || ':ap-escalate:' || v_key, 0)
  );
  select * into v_receipt
  from public.erp_ap_command_receipts receipt
  where receipt.tenant_id = v_invoice.tenant_id
    and receipt.command_scope = 'escalate-supplier-invoice'
    and receipt.idempotency_key = v_key;
  if v_receipt.id is not null then
    if v_receipt.actor_account_id <> v_actor.account_id
       or v_receipt.request_hash <> v_hash then
      raise exception using errcode = '22023', message = 'AP_IDEMPOTENCY_CONFLICT';
    end if;
    select * into v_invoice
    from pg_catalog.jsonb_populate_record(
      null::public.erp_ap_supplier_invoices,
      v_receipt.response
    );
    return v_invoice;
  end if;

  if v_invoice.version <> p_expected_version then
    raise exception using errcode = '40001', message = 'AP_INVOICE_VERSION_CONFLICT';
  end if;
  if v_invoice.status <> 'match-exception' then
    raise exception using errcode = '22023', message = 'AP_INVOICE_NOT_MATCH_EXCEPTION';
  end if;
  if not (
    v_invoice.exception_codes <@ array[
      'invoice-over-purchase-order',
      'invoice-over-acceptance'
    ]::text[]
  ) then
    raise exception using errcode = '22023', message = 'AP_EXCEPTION_MUST_RETURN_TO_MANAGER';
  end if;
  v_variance := greatest(
    v_invoice.total_vnd - v_invoice.purchase_order_total_vnd,
    v_invoice.total_vnd - v_invoice.accepted_total_vnd,
    0
  );
  if v_variance < v_rule.director_exception_threshold_vnd then
    raise exception using errcode = '22023', message = 'AP_EXCEPTION_BELOW_DIRECTOR_THRESHOLD';
  end if;

  update public.erp_ap_supplier_invoices
  set status = 'director-exception',
      owner_role = 'director',
      accountant_account_id = v_actor.account_id,
      accountant_note = v_note,
      version = version + 1
  where id = v_invoice.id
  returning * into v_invoice;

  perform public.erp_ap_write_audit(
    v_invoice.id, v_invoice.tenant_id, v_invoice.site_id,
    'invoice.exception-escalated', 'match-exception', 'director-exception',
    v_actor.account_id, 'accountant', v_note,
    jsonb_build_object('varianceVnd', v_variance, 'exceptionCodes', to_jsonb(v_invoice.exception_codes)),
    'escalate-supplier-invoice',
    v_key, v_hash
  );
  insert into public.erp_ap_command_receipts (
    tenant_id, command_scope, idempotency_key, actor_account_id,
    request_hash, invoice_id, resulting_version, response
  ) values (
    v_invoice.tenant_id, 'escalate-supplier-invoice', v_key,
    v_actor.account_id, v_hash, v_invoice.id, v_invoice.version, to_jsonb(v_invoice)
  );
  return v_invoice;
end;
$$;

create or replace function public.erp_ap_decide_supplier_exception(
  p_invoice_id uuid,
  p_expected_version integer,
  p_actor_account_id text,
  p_decision text,
  p_note text,
  p_idempotency_key text,
  p_request_hash text
)
returns public.erp_ap_supplier_invoices
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invoice public.erp_ap_supplier_invoices;
  v_actor public.erp_account_registry;
  v_receipt public.erp_ap_command_receipts;
  v_decision text := lower(trim(coalesce(p_decision, '')));
  v_note text := trim(coalesce(p_note, ''));
  v_key text := trim(coalesce(p_idempotency_key, ''));
  v_hash text := trim(coalesce(p_request_hash, ''));
  v_to_status text;
begin
  if p_invoice_id is null
     or p_expected_version is null
     or p_expected_version < 1
     or v_decision not in ('approve', 'return')
     or char_length(trim(coalesce(p_actor_account_id, ''))) not between 2 and 100
     or char_length(v_note) not between 4 and 2000
     or char_length(v_key) not between 8 and 200
     or v_hash !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = '22023', message = 'AP_DIRECTOR_DECISION_INPUT_INVALID';
  end if;

  select * into v_invoice
  from public.erp_ap_supplier_invoices invoice
  where invoice.id = p_invoice_id
  for update;
  if v_invoice.id is null then
    raise exception using errcode = 'P0002', message = 'AP_INVOICE_NOT_FOUND';
  end if;
  select * into v_actor
  from public.erp_account_registry account
  where account.account_id = trim(p_actor_account_id)
    and account.tenant_id = v_invoice.tenant_id;
  if v_actor.account_id is null
     or not public.erp_account_has_active_role(
       v_invoice.tenant_id,
       v_actor.account_id,
       'director',
       v_invoice.site_id
     ) then
    raise exception using errcode = '42501', message = 'AP_DIRECTOR_ROLE_REQUIRED';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_invoice.tenant_id::text || ':ap-director:' || v_key, 0)
  );
  select * into v_receipt
  from public.erp_ap_command_receipts receipt
  where receipt.tenant_id = v_invoice.tenant_id
    and receipt.command_scope = 'decide-supplier-exception'
    and receipt.idempotency_key = v_key;
  if v_receipt.id is not null then
    if v_receipt.actor_account_id <> v_actor.account_id
       or v_receipt.request_hash <> v_hash then
      raise exception using errcode = '22023', message = 'AP_IDEMPOTENCY_CONFLICT';
    end if;
    select * into v_invoice
    from pg_catalog.jsonb_populate_record(
      null::public.erp_ap_supplier_invoices,
      v_receipt.response
    );
    return v_invoice;
  end if;

  if v_invoice.version <> p_expected_version then
    raise exception using errcode = '40001', message = 'AP_INVOICE_VERSION_CONFLICT';
  end if;
  if v_invoice.status <> 'director-exception' then
    raise exception using errcode = '22023', message = 'AP_INVOICE_NOT_DIRECTOR_EXCEPTION';
  end if;

  v_to_status := case when v_decision = 'approve' then 'ready-for-accounting' else 'match-exception' end;
  update public.erp_ap_supplier_invoices
  set status = v_to_status,
      owner_role = case when v_decision = 'approve' then 'accountant' else 'manager' end,
      exception_approved_by_account_id = case when v_decision = 'approve' then v_actor.account_id else null end,
      exception_approved_at = case when v_decision = 'approve' then now() else null end,
      exception_note = v_note,
      version = version + 1
  where id = v_invoice.id
  returning * into v_invoice;

  perform public.erp_ap_write_audit(
    v_invoice.id, v_invoice.tenant_id, v_invoice.site_id,
    case when v_decision = 'approve' then 'invoice.exception-approved' else 'invoice.exception-returned' end,
    'director-exception', v_to_status,
    v_actor.account_id, 'director', v_note,
    jsonb_build_object('decision', v_decision, 'exceptionCodes', to_jsonb(v_invoice.exception_codes)),
    'decide-supplier-exception',
    v_key, v_hash
  );
  insert into public.erp_ap_command_receipts (
    tenant_id, command_scope, idempotency_key, actor_account_id,
    request_hash, invoice_id, resulting_version, response
  ) values (
    v_invoice.tenant_id, 'decide-supplier-exception', v_key,
    v_actor.account_id, v_hash, v_invoice.id, v_invoice.version, to_jsonb(v_invoice)
  );
  return v_invoice;
end;
$$;

create or replace function public.erp_accounting_prepare_supplier_invoice(
  p_invoice_id uuid,
  p_expected_source_version integer,
  p_actor_account_id text,
  p_note text,
  p_idempotency_key text,
  p_request_hash text
)
returns public.erp_ap_supplier_invoices
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invoice public.erp_ap_supplier_invoices;
  v_rule public.erp_ap_posting_rules;
  v_supplier public.erp_ap_suppliers;
  v_actor public.erp_account_registry;
  v_period public.erp_accounting_periods;
  v_journal public.erp_accounting_journals;
  v_receipt public.erp_ap_command_receipts;
  v_period_key text;
  v_note text := trim(coalesce(p_note, ''));
  v_key text := trim(coalesce(p_idempotency_key, ''));
  v_hash text := trim(coalesce(p_request_hash, ''));
  v_now timestamptz := now();
  v_last_line_number integer;
  v_source_from_status text;
begin
  if p_invoice_id is null
     or p_expected_source_version is null
     or p_expected_source_version < 1
     or char_length(trim(coalesce(p_actor_account_id, ''))) not between 2 and 100
     or char_length(v_note) not between 4 and 2000
     or char_length(v_key) not between 8 and 200
     or v_hash !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = '22023', message = 'AP_ACCOUNTING_PREPARE_INPUT_INVALID';
  end if;

  select * into v_invoice
  from public.erp_ap_supplier_invoices invoice
  where invoice.id = p_invoice_id
  for update;
  if v_invoice.id is null then
    raise exception using errcode = 'P0002', message = 'AP_INVOICE_NOT_FOUND';
  end if;
  select * into v_rule
  from public.erp_ap_posting_rules rule
  where rule.id = v_invoice.posting_rule_id;
  select * into v_supplier
  from public.erp_ap_suppliers supplier
  where supplier.id = v_invoice.supplier_id;
  select * into v_actor
  from public.erp_account_registry account
  where account.account_id = trim(p_actor_account_id)
    and account.tenant_id = v_invoice.tenant_id;
  if v_actor.account_id is null
     or not public.erp_account_has_active_role(
       v_invoice.tenant_id,
       v_actor.account_id,
       'accountant-maker',
       v_invoice.site_id
     ) then
    raise exception using errcode = '42501', message = 'AP_ACCOUNTANT_ROLE_REQUIRED';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_invoice.tenant_id::text || ':ap-prepare:' || v_key, 0)
  );
  select * into v_receipt
  from public.erp_ap_command_receipts receipt
  where receipt.tenant_id = v_invoice.tenant_id
    and receipt.command_scope = 'prepare-supplier-invoice'
    and receipt.idempotency_key = v_key;
  if v_receipt.id is not null then
    if v_receipt.actor_account_id <> v_actor.account_id
       or v_receipt.request_hash <> v_hash then
      raise exception using errcode = '22023', message = 'AP_IDEMPOTENCY_CONFLICT';
    end if;
    select * into v_invoice
    from pg_catalog.jsonb_populate_record(
      null::public.erp_ap_supplier_invoices,
      v_receipt.response
    );
    return v_invoice;
  end if;

  if v_invoice.version <> p_expected_source_version then
    raise exception using errcode = '40001', message = 'AP_INVOICE_VERSION_CONFLICT';
  end if;
  if v_invoice.status not in ('ready-for-accounting', 'accounting-returned')
     or v_invoice.owner_role <> 'accountant' then
    raise exception using errcode = '22023', message = 'AP_INVOICE_NOT_READY_FOR_ACCOUNTING';
  end if;
  if v_invoice.match_status <> 'matched'
     and v_invoice.exception_approved_at is null then
    raise exception using errcode = '22023', message = 'AP_MATCH_OR_DIRECTOR_APPROVAL_REQUIRED';
  end if;
  if v_invoice.exception_approved_at is not null
     and not (
       v_invoice.exception_codes <@ array[
         'invoice-over-purchase-order',
         'invoice-over-acceptance'
       ]::text[]
     ) then
    raise exception using errcode = '22023', message = 'AP_NON_MONETARY_EXCEPTION_NOT_APPROVABLE';
  end if;
  if not exists (
    select 1
    from public.erp_ap_supplier_invoice_lines line
    where line.invoice_id = v_invoice.id
    having sum(line.net_vnd) = v_invoice.net_vnd
       and sum(line.vat_vnd) = v_invoice.vat_vnd
  ) then
    raise exception using errcode = '23514', message = 'AP_INVOICE_LINES_DO_NOT_MATCH_HEADER';
  end if;
  v_source_from_status := v_invoice.status;

  v_period_key := to_char(v_invoice.invoice_date, 'YYYY-MM');
  select * into v_period
  from public.erp_accounting_periods period
  where period.tenant_id = v_invoice.tenant_id
    and period.period_key = v_period_key
  for share;
  if v_period.id is null then
    raise exception using errcode = 'P0002', message = 'ACCOUNTING_PERIOD_NOT_FOUND';
  end if;
  if v_period.status <> 'open' then
    raise exception using errcode = '22023', message = 'ACCOUNTING_PERIOD_IS_LOCKED';
  end if;

  select * into v_journal
  from public.erp_accounting_journals journal
  where journal.tenant_id = v_invoice.tenant_id
    and journal.source_type = 'supplier-invoice'
    and journal.source_supplier_invoice_id = v_invoice.id
    and journal.reversal_of_journal_id is null
  order by journal.created_at desc, journal.id desc
  limit 1
  for update;
  if v_journal.id is not null and v_journal.status = 'pending-checker' then
    raise exception using errcode = '22023', message = 'AP_JOURNAL_ALREADY_PENDING_CHECKER';
  end if;
  if v_journal.id is not null and v_journal.status = 'posted' then
    raise exception using errcode = '22023', message = 'AP_INVOICE_ALREADY_POSTED';
  end if;

  perform pg_catalog.set_config('app.erp_ap_mutation', 'allowed', true);

  if v_journal.id is null then
    insert into public.erp_accounting_journals (
      tenant_id,
      site_id,
      journal_code,
      source_type,
      source_workflow_id,
      source_supplier_invoice_id,
      source_version,
      business_date,
      period_key,
      status,
      version,
      maker_account_id,
      maker_note,
      submitted_at
    ) values (
      v_invoice.tenant_id,
      v_invoice.site_id,
      left('AP-' || v_invoice.case_code, 100),
      'supplier-invoice',
      null,
      v_invoice.id,
      v_invoice.version + 1,
      v_invoice.invoice_date,
      v_period_key,
      'pending-checker',
      1,
      v_actor.account_id,
      v_note,
      v_now
    )
    returning * into v_journal;
  elsif v_journal.status = 'checker-returned' then
    delete from public.erp_accounting_journal_lines line
    where line.journal_id = v_journal.id;
    update public.erp_accounting_journals
    set source_version = v_invoice.version + 1,
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
    raise exception using errcode = '22023', message = 'AP_JOURNAL_STATE_NOT_PREPARABLE';
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
    line.line_number,
    v_rule.debit_account_code,
    v_rule.debit_account_name,
    line.net_vnd,
    0,
    jsonb_build_object(
      'siteId', v_invoice.site_id,
      'sourceType', 'supplier-invoice',
      'supplierId', v_supplier.id,
      'supplierCode', v_supplier.supplier_code,
      'invoiceId', v_invoice.id,
      'invoiceNumber', v_invoice.invoice_number,
      'purchaseOrderReference', v_invoice.purchase_order_reference,
      'acceptanceReference', v_invoice.acceptance_reference,
      'expenseCategory', v_rule.expense_category,
      'costCenter', v_invoice.cost_center,
      'projectCode', v_invoice.project_code
    )
  from public.erp_ap_supplier_invoice_lines line
  where line.invoice_id = v_invoice.id
  order by line.line_number;

  select coalesce(max(line.line_number), 0) into v_last_line_number
  from public.erp_ap_supplier_invoice_lines line
  where line.invoice_id = v_invoice.id;

  if v_invoice.vat_vnd > 0 then
    insert into public.erp_accounting_journal_lines (
      journal_id, tenant_id, site_id, line_number,
      account_code, account_name, debit_vnd, credit_vnd, dimensions
    ) values (
      v_journal.id, v_journal.tenant_id, v_journal.site_id, v_last_line_number + 1,
      v_rule.input_vat_account_code, v_rule.input_vat_account_name,
      v_invoice.vat_vnd, 0,
      jsonb_build_object(
        'siteId', v_invoice.site_id,
        'sourceType', 'supplier-invoice',
        'supplierId', v_supplier.id,
        'invoiceId', v_invoice.id,
        'invoiceNumber', v_invoice.invoice_number,
        'taxTreatment', 'input-vat-review-required'
      )
    );
  end if;

  insert into public.erp_accounting_journal_lines (
    journal_id, tenant_id, site_id, line_number,
    account_code, account_name, debit_vnd, credit_vnd, dimensions
  ) values (
    v_journal.id, v_journal.tenant_id, v_journal.site_id,
    v_last_line_number + case when v_invoice.vat_vnd > 0 then 2 else 1 end,
    v_rule.payable_account_code, v_rule.payable_account_name,
    0, v_invoice.total_vnd,
    jsonb_build_object(
      'siteId', v_invoice.site_id,
      'sourceType', 'supplier-invoice',
      'supplierId', v_supplier.id,
      'supplierCode', v_supplier.supplier_code,
      'invoiceId', v_invoice.id,
      'invoiceNumber', v_invoice.invoice_number,
      'dueDate', v_invoice.due_date
    )
  );

  if not public.erp_accounting_journal_is_balanced(v_journal.id) then
    raise exception using errcode = '23514', message = 'AP_JOURNAL_NOT_BALANCED';
  end if;

  update public.erp_ap_supplier_invoices
  set status = 'accounting-review',
      owner_role = 'chief-accountant',
      version = version + 1,
      accountant_account_id = v_actor.account_id,
      accountant_note = v_note,
      checker_account_id = null,
      checker_note = null,
      journal_id = v_journal.id
  where id = v_invoice.id
  returning * into v_invoice;

  perform public.erp_ap_write_audit(
    v_invoice.id, v_invoice.tenant_id, v_invoice.site_id,
    'invoice.liability-prepared',
    v_source_from_status,
    'accounting-review',
    v_actor.account_id, 'accountant', v_note,
    jsonb_build_object('journalId', v_journal.id, 'journalCode', v_journal.journal_code),
    'prepare-supplier-invoice',
    v_key, v_hash
  );
  perform public.erp_accounting_write_audit(
    v_journal.tenant_id, v_journal.site_id, 'journal', v_journal.id,
    'journal.prepared-from-supplier-invoice',
    v_actor.account_id, 'accountant-maker',
    case when v_journal.version = 1 then null else 'checker-returned' end,
    'pending-checker', v_note,
    jsonb_build_object(
      'sourceSupplierInvoiceId', v_invoice.id,
      'sourceVersion', v_invoice.version,
      'supplierCode', v_supplier.supplier_code
    ),
    v_key, v_hash
  );

  insert into public.erp_ap_command_receipts (
    tenant_id, command_scope, idempotency_key, actor_account_id,
    request_hash, invoice_id, resulting_version, response
  ) values (
    v_invoice.tenant_id, 'prepare-supplier-invoice', v_key,
    v_actor.account_id, v_hash, v_invoice.id, v_invoice.version, to_jsonb(v_invoice)
  );
  return v_invoice;
end;
$$;

create or replace function public.erp_accounting_review_supplier_invoice_journal(
  p_invoice_id uuid,
  p_expected_source_version integer,
  p_expected_journal_version integer,
  p_actor_account_id text,
  p_decision text,
  p_note text,
  p_idempotency_key text,
  p_request_hash text
)
returns public.erp_ap_supplier_invoices
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invoice public.erp_ap_supplier_invoices;
  v_journal public.erp_accounting_journals;
  v_actor public.erp_account_registry;
  v_receipt public.erp_ap_command_receipts;
  v_decision text := lower(trim(coalesce(p_decision, '')));
  v_note text := trim(coalesce(p_note, ''));
  v_key text := trim(coalesce(p_idempotency_key, ''));
  v_hash text := trim(coalesce(p_request_hash, ''));
  v_now timestamptz := now();
  v_to_status text;
begin
  if p_invoice_id is null
     or p_expected_source_version is null
     or p_expected_source_version < 1
     or p_expected_journal_version is null
     or p_expected_journal_version < 1
     or v_decision not in ('approve', 'return')
     or char_length(trim(coalesce(p_actor_account_id, ''))) not between 2 and 100
     or char_length(v_note) not between 4 and 2000
     or char_length(v_key) not between 8 and 200
     or v_hash !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = '22023', message = 'AP_ACCOUNTING_REVIEW_INPUT_INVALID';
  end if;

  select * into v_invoice
  from public.erp_ap_supplier_invoices invoice
  where invoice.id = p_invoice_id
  for update;
  if v_invoice.id is null then
    raise exception using errcode = 'P0002', message = 'AP_INVOICE_NOT_FOUND';
  end if;
  select * into v_journal
  from public.erp_accounting_journals journal
  where journal.id = v_invoice.journal_id
    and journal.source_type = 'supplier-invoice'
    and journal.source_supplier_invoice_id = v_invoice.id
  for update;
  if v_journal.id is null then
    raise exception using errcode = 'P0002', message = 'AP_JOURNAL_NOT_FOUND';
  end if;
  select * into v_actor
  from public.erp_account_registry account
  where account.account_id = trim(p_actor_account_id)
    and account.tenant_id = v_invoice.tenant_id;
  if v_actor.account_id is null
     or not public.erp_account_has_active_role(
       v_invoice.tenant_id,
       v_actor.account_id,
       'accounting-checker',
       v_invoice.site_id
     ) then
    raise exception using errcode = '42501', message = 'AP_CHECKER_ROLE_REQUIRED';
  end if;
  if v_actor.account_id = v_journal.maker_account_id then
    raise exception using errcode = '42501', message = 'ACCOUNTING_MAKER_CHECKER_SEPARATION_REQUIRED';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_invoice.tenant_id::text || ':ap-review:' || v_key, 0)
  );
  select * into v_receipt
  from public.erp_ap_command_receipts receipt
  where receipt.tenant_id = v_invoice.tenant_id
    and receipt.command_scope = 'review-supplier-invoice-journal'
    and receipt.idempotency_key = v_key;
  if v_receipt.id is not null then
    if v_receipt.actor_account_id <> v_actor.account_id
       or v_receipt.request_hash <> v_hash then
      raise exception using errcode = '22023', message = 'AP_IDEMPOTENCY_CONFLICT';
    end if;
    select * into v_invoice
    from pg_catalog.jsonb_populate_record(
      null::public.erp_ap_supplier_invoices,
      v_receipt.response
    );
    return v_invoice;
  end if;

  if v_invoice.version <> p_expected_source_version then
    raise exception using errcode = '40001', message = 'AP_INVOICE_VERSION_CONFLICT';
  end if;
  if v_journal.version <> p_expected_journal_version then
    raise exception using errcode = '40001', message = 'ACCOUNTING_JOURNAL_VERSION_CONFLICT';
  end if;
  if v_invoice.status <> 'accounting-review'
     or v_invoice.owner_role <> 'chief-accountant'
     or v_journal.status <> 'pending-checker'
     or v_journal.source_version <> v_invoice.version then
    raise exception using errcode = '22023', message = 'AP_INVOICE_NOT_PENDING_CHECKER';
  end if;
  if not public.erp_accounting_journal_is_balanced(v_journal.id) then
    raise exception using errcode = '23514', message = 'AP_JOURNAL_NOT_BALANCED';
  end if;

  perform pg_catalog.set_config('app.erp_ap_mutation', 'allowed', true);

  if v_decision = 'approve' then
    if not exists (
      select 1
      from public.erp_accounting_periods period
      where period.tenant_id = v_journal.tenant_id
        and period.period_key = v_journal.period_key
        and period.status = 'open'
    ) then
      raise exception using errcode = '22023', message = 'ACCOUNTING_PERIOD_IS_LOCKED';
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
    v_to_status := 'posted';
    update public.erp_ap_supplier_invoices
    set status = 'posted',
        owner_role = 'none',
        version = version + 1,
        checker_account_id = v_actor.account_id,
        checker_note = v_note,
        posted_at = v_now
    where id = v_invoice.id
    returning * into v_invoice;
  else
    update public.erp_accounting_journals
    set status = 'checker-returned',
        version = version + 1,
        checker_account_id = v_actor.account_id,
        checker_note = v_note,
        approved_at = null,
        posted_at = null
    where id = v_journal.id
    returning * into v_journal;
    v_to_status := 'accounting-returned';
    update public.erp_ap_supplier_invoices
    set status = 'accounting-returned',
        owner_role = 'accountant',
        version = version + 1,
        checker_account_id = v_actor.account_id,
        checker_note = v_note
    where id = v_invoice.id
    returning * into v_invoice;
  end if;

  perform public.erp_ap_write_audit(
    v_invoice.id, v_invoice.tenant_id, v_invoice.site_id,
    case when v_decision = 'approve' then 'invoice.liability-posted' else 'invoice.liability-returned' end,
    'accounting-review', v_to_status,
    v_actor.account_id, 'chief-accountant', v_note,
    jsonb_build_object('journalId', v_journal.id, 'journalCode', v_journal.journal_code, 'decision', v_decision),
    'review-supplier-invoice-journal',
    v_key, v_hash
  );
  perform public.erp_accounting_write_audit(
    v_journal.tenant_id, v_journal.site_id, 'journal', v_journal.id,
    case when v_decision = 'approve' then 'journal.approved-and-posted' else 'journal.returned' end,
    v_actor.account_id, 'accounting-checker',
    'pending-checker', v_journal.status, v_note,
    jsonb_build_object('sourceSupplierInvoiceId', v_invoice.id, 'sourceVersion', p_expected_source_version),
    v_key, v_hash
  );
  insert into public.erp_ap_command_receipts (
    tenant_id, command_scope, idempotency_key, actor_account_id,
    request_hash, invoice_id, resulting_version, response
  ) values (
    v_invoice.tenant_id, 'review-supplier-invoice-journal', v_key,
    v_actor.account_id, v_hash, v_invoice.id, v_invoice.version, to_jsonb(v_invoice)
  );
  return v_invoice;
end;
$$;

create or replace function public.erp_ap_block_period_lock()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.status = 'open' and new.status = 'locked' and exists (
    select 1
    from public.erp_ap_supplier_invoices invoice
    where invoice.tenant_id = new.tenant_id
      and to_char(invoice.invoice_date, 'YYYY-MM') = new.period_key
      and invoice.status not in ('posted', 'reversed')
  ) then
    raise exception using
      errcode = '22023',
      message = 'ACCOUNTING_PERIOD_HAS_OPEN_AP_INVOICES';
  end if;
  return new;
end;
$$;

drop trigger if exists erp_accounting_period_ap_close_guard
  on public.erp_accounting_periods;
create trigger erp_accounting_period_ap_close_guard
before update on public.erp_accounting_periods
for each row execute function public.erp_ap_block_period_lock();

-- Keep the currently active and immediately following accounting period
-- available without reopening a locked period. Ongoing period creation remains
-- an explicit chief-accountant workflow in the next close-management slice.
insert into public.erp_accounting_periods (
  id,
  tenant_id,
  period_key,
  starts_on,
  ends_on,
  status,
  version
)
select
  gen_random_uuid(),
  '00000000-0000-4000-8000-000000000001',
  to_char(period_start, 'YYYY-MM'),
  period_start::date,
  (period_start + interval '1 month - 1 day')::date,
  'open',
  1
from generate_series(
  date_trunc('month', current_date),
  date_trunc('month', current_date) + interval '1 month',
  interval '1 month'
) as period_start
on conflict (tenant_id, period_key) do nothing;

insert into public.erp_ap_posting_rules (
  id,
  tenant_id,
  expense_category,
  debit_account_code,
  debit_account_name,
  match_tolerance_vnd,
  director_exception_threshold_vnd,
  effective_from,
  status
) values
  (
    '85000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000001',
    'transport-service',
    '6277',
    'Chi phí dịch vụ mua ngoài',
    500000,
    50000000,
    '2026-01-01',
    'active'
  ),
  (
    '85000000-0000-4000-8000-000000000002',
    '00000000-0000-4000-8000-000000000001',
    'food-service',
    '632',
    'Giá vốn dịch vụ',
    500000,
    50000000,
    '2026-01-01',
    'active'
  ),
  (
    '85000000-0000-4000-8000-000000000003',
    '00000000-0000-4000-8000-000000000001',
    'maintenance-service',
    '6277',
    'Chi phí dịch vụ mua ngoài',
    500000,
    50000000,
    '2026-01-01',
    'active'
  ),
  (
    '85000000-0000-4000-8000-000000000004',
    '00000000-0000-4000-8000-000000000001',
    'event-service',
    '6418',
    'Chi phí bán hàng khác',
    500000,
    50000000,
    '2026-01-01',
    'active'
  ),
  (
    '85000000-0000-4000-8000-000000000005',
    '00000000-0000-4000-8000-000000000001',
    'tools-and-equipment',
    '153',
    'Công cụ, dụng cụ',
    500000,
    50000000,
    '2026-01-01',
    'active'
  )
on conflict (id) do nothing;

insert into public.erp_ap_suppliers (
  id,
  tenant_id,
  site_id,
  supplier_code,
  legal_name,
  tax_code,
  payment_terms_days,
  status
) values
  (
    '86000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    'NCC-TA-018',
    'Công ty Dịch vụ Tràng An Xanh',
    '2700123456',
    30,
    'active'
  ),
  (
    '86000000-0000-4000-8000-000000000002',
    '00000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000009',
    'NCC-TC-011',
    'Công ty Vận tải Minh Long',
    '0700123456',
    30,
    'active'
  ),
  (
    '86000000-0000-4000-8000-000000000003',
    '00000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000005',
    'NCC-TCO-006',
    'Hợp tác xã Dịch vụ Tam Cốc',
    '2700765432',
    15,
    'active'
  ),
  (
    '86000000-0000-4000-8000-000000000004',
    '00000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000003',
    'NCC-BD-021',
    'Công ty Vận hành Bái Đính',
    '2700987654',
    30,
    'active'
  )
on conflict (id) do nothing;

insert into public.erp_ap_supplier_invoices (
  id, tenant_id, site_id, supplier_id, posting_rule_id, case_code,
  request_reference, purchase_order_reference, contract_reference,
  purchase_order_total_vnd, acceptance_reference, accepted_total_vnd,
  supplier_tax_code_snapshot, invoice_series, invoice_number,
  invoice_date, due_date, net_vnd, vat_vnd, total_vnd,
  cost_center, project_code, match_status, exception_codes,
  exception_note, status, owner_role, version, manager_account_id,
  accountant_account_id, accountant_note, checker_account_id,
  checker_note, journal_id, submitted_at, posted_at, created_at, updated_at
) values
  (
    '87000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000009',
    '86000000-0000-4000-8000-000000000002',
    '85000000-0000-4000-8000-000000000001',
    'AP-TC-202607-018',
    'PR-TC-2026-018',
    'PO-TC-2026-018',
    'HD-TC-2026-018',
    220000000,
    'NT-TC-2026-018',
    220000000,
    '0700123456',
    '1C26TML',
    '000018',
    '2026-07-20',
    '2026-08-19',
    200000000,
    20000000,
    220000000,
    'TC-VANHANH',
    null,
    'matched',
    '{}'::text[],
    null,
    'ready-for-accounting',
    'accountant',
    1,
    'manager-trang-an',
    null,
    null,
    null,
    null,
    null,
    '2026-07-27T08:20:00+07:00',
    null,
    '2026-07-27T08:20:00+07:00',
    '2026-07-27T08:20:00+07:00'
  ),
  (
    '87000000-0000-4000-8000-000000000002',
    '00000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    '86000000-0000-4000-8000-000000000001',
    '85000000-0000-4000-8000-000000000002',
    'AP-TA-202607-024',
    'PR-TA-2026-024',
    'PO-TA-2026-024',
    'HD-TA-2026-024',
    118800000,
    '',
    0,
    '2700123456',
    '1C26TAX',
    '000024',
    '2026-07-24',
    '2026-08-23',
    108000000,
    10800000,
    118800000,
    'TA-DICHVU',
    null,
    'exception',
    array['missing-acceptance', 'invoice-over-acceptance'],
    'Bộ phận vận hành chưa gửi biên bản nghiệm thu dịch vụ.',
    'match-exception',
    'manager',
    1,
    'manager-trang-an',
    null,
    null,
    null,
    null,
    null,
    '2026-07-28T09:15:00+07:00',
    null,
    '2026-07-28T09:15:00+07:00',
    '2026-07-28T09:15:00+07:00'
  ),
  (
    '87000000-0000-4000-8000-000000000003',
    '00000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000003',
    '86000000-0000-4000-8000-000000000004',
    '85000000-0000-4000-8000-000000000003',
    'AP-BD-202607-031',
    'PR-BD-2026-031',
    'PO-BD-2026-031',
    'HD-BD-2026-031',
    385000000,
    'NT-BD-2026-031',
    385000000,
    '2700987654',
    '1C26BDV',
    '000031',
    '2026-07-25',
    '2026-08-24',
    350000000,
    35000000,
    385000000,
    'BD-KYTHUAT',
    null,
    'matched',
    '{}'::text[],
    null,
    'ready-for-accounting',
    'accountant',
    1,
    'manager-trang-an',
    null,
    null,
    null,
    null,
    null,
    '2026-07-28T13:30:00+07:00',
    null,
    '2026-07-28T13:30:00+07:00',
    '2026-07-28T13:30:00+07:00'
  ),
  (
    '87000000-0000-4000-8000-000000000004',
    '00000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000005',
    '86000000-0000-4000-8000-000000000003',
    '85000000-0000-4000-8000-000000000001',
    'AP-TCO-202607-009',
    'PR-TCO-2026-009',
    'PO-TCO-2026-009',
    'HD-TCO-2026-009',
    154000000,
    'NT-TCO-2026-009',
    154000000,
    '2700765432',
    '1C26TCO',
    '000009',
    '2026-07-18',
    '2026-08-02',
    140000000,
    14000000,
    154000000,
    'TCO-VANHANH',
    null,
    'matched',
    '{}'::text[],
    null,
    'ready-for-accounting',
    'accountant',
    1,
    'manager-trang-an',
    null,
    null,
    null,
    null,
    null,
    '2026-07-26T10:10:00+07:00',
    null,
    '2026-07-26T10:10:00+07:00',
    '2026-07-26T10:10:00+07:00'
  ),
  (
    '87000000-0000-4000-8000-000000000005',
    '00000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000009',
    '86000000-0000-4000-8000-000000000002',
    '85000000-0000-4000-8000-000000000004',
    'AP-TC-202607-027',
    'PR-TC-2026-027',
    'PO-TC-2026-027',
    'HD-TC-2026-027',
    620000000,
    'NT-TC-2026-027',
    620000000,
    '0700123456',
    '1C26TML',
    '000027',
    '2026-07-27',
    '2026-08-26',
    620000000,
    62000000,
    682000000,
    'TC-SUKIEN',
    'EV-TC-2026-08',
    'exception',
    array['invoice-over-purchase-order', 'invoice-over-acceptance'],
    'Phần phát sinh 62 triệu đã được kế toán kiểm tra và chuyển giám đốc quyết định.',
    'match-exception',
    'manager',
    1,
    'manager-trang-an',
    'accountant-001',
    'Chi phí phát sinh từ thay đổi phạm vi sự kiện, đã có báo cáo tác động.',
    null,
    null,
    null,
    '2026-07-28T15:40:00+07:00',
    null,
    '2026-07-28T15:40:00+07:00',
    '2026-07-28T15:40:00+07:00'
  )
on conflict (id) do nothing;

insert into public.erp_ap_supplier_invoice_lines (
  id, invoice_id, tenant_id, site_id, line_number,
  description, quantity, unit_price_vnd, net_vnd, vat_vnd
) values
  (
    '87100000-0000-4000-8000-000000000001',
    '87000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000009',
    1, 'Dịch vụ xe trung chuyển tháng 7', 1, 200000000, 200000000, 20000000
  ),
  (
    '87100000-0000-4000-8000-000000000002',
    '87000000-0000-4000-8000-000000000002',
    '00000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    1, 'Suất ăn đoàn và phục vụ tại điểm', 1, 108000000, 108000000, 10800000
  ),
  (
    '87100000-0000-4000-8000-000000000003',
    '87000000-0000-4000-8000-000000000003',
    '00000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000003',
    1, 'Bảo dưỡng hệ thống xe điện tháng 7', 1, 350000000, 350000000, 35000000
  ),
  (
    '87100000-0000-4000-8000-000000000004',
    '87000000-0000-4000-8000-000000000004',
    '00000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000005',
    1, 'Điều phối thuyền và bến phục vụ tháng 7', 1, 140000000, 140000000, 14000000
  ),
  (
    '87100000-0000-4000-8000-000000000005',
    '87000000-0000-4000-8000-000000000005',
    '00000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000009',
    1, 'Dịch vụ vận hành sự kiện tháng 8', 1, 620000000, 620000000, 62000000
  )
on conflict (id) do nothing;

-- Seed one chief-accountant queue item.
insert into public.erp_accounting_journals (
  id, tenant_id, site_id, journal_code, source_type,
  source_workflow_id, source_supplier_invoice_id, source_version,
  business_date, period_key, status, version,
  maker_account_id, maker_note, submitted_at, created_at, updated_at
) values (
  '88000000-0000-4000-8000-000000000003',
  '00000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000003',
  'AP-AP-BD-202607-031',
  'supplier-invoice',
  null,
  '87000000-0000-4000-8000-000000000003',
  2,
  '2026-07-25',
  '2026-07',
  'pending-checker',
  1,
  'accountant-001',
  'Đã kiểm tra PO, nghiệm thu, hóa đơn và mã chi phí.',
  '2026-07-28T14:05:00+07:00',
  '2026-07-28T14:05:00+07:00',
  '2026-07-28T14:05:00+07:00'
)
on conflict (id) do nothing;

insert into public.erp_accounting_journal_lines (
  id, journal_id, tenant_id, site_id, line_number,
  account_code, account_name, debit_vnd, credit_vnd, dimensions
) values
  (
    '88100000-0000-4000-8000-000000000031',
    '88000000-0000-4000-8000-000000000003',
    '00000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000003',
    1, '6277', 'Chi phí dịch vụ mua ngoài', 350000000, 0,
    '{"sourceType":"supplier-invoice","supplierCode":"NCC-BD-021","invoiceNumber":"000031","costCenter":"BD-KYTHUAT"}'::jsonb
  ),
  (
    '88100000-0000-4000-8000-000000000032',
    '88000000-0000-4000-8000-000000000003',
    '00000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000003',
    2, '1331', 'Thuế GTGT được khấu trừ của hàng hóa, dịch vụ', 35000000, 0,
    '{"sourceType":"supplier-invoice","supplierCode":"NCC-BD-021","invoiceNumber":"000031"}'::jsonb
  ),
  (
    '88100000-0000-4000-8000-000000000033',
    '88000000-0000-4000-8000-000000000003',
    '00000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000003',
    3, '331', 'Phải trả cho người bán', 0, 385000000,
    '{"sourceType":"supplier-invoice","supplierCode":"NCC-BD-021","invoiceNumber":"000031","dueDate":"2026-08-24"}'::jsonb
  )
on conflict (id) do nothing;

update public.erp_ap_supplier_invoices
set status = 'accounting-review',
    owner_role = 'chief-accountant',
    version = 2,
    accountant_account_id = 'accountant-001',
    accountant_note = 'Đã kiểm tra PO, nghiệm thu, hóa đơn và mã chi phí.',
    journal_id = '88000000-0000-4000-8000-000000000003',
    updated_at = '2026-07-28T14:05:00+07:00'
where id = '87000000-0000-4000-8000-000000000003'
  and status = 'ready-for-accounting'
  and version = 1;

-- Seed one posted liability so the ledger and recorded payable are non-empty.
insert into public.erp_accounting_journals (
  id, tenant_id, site_id, journal_code, source_type,
  source_workflow_id, source_supplier_invoice_id, source_version,
  business_date, period_key, status, version,
  maker_account_id, maker_note, checker_account_id, checker_note,
  submitted_at, approved_at, posted_at, created_at, updated_at
) values (
  '88000000-0000-4000-8000-000000000004',
  '00000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000005',
  'AP-AP-TCO-202607-009',
  'supplier-invoice',
  null,
  '87000000-0000-4000-8000-000000000004',
  2,
  '2026-07-18',
  '2026-07',
  'pending-checker',
  1,
  'accountant-001',
  'Đã kiểm tra hồ sơ nguồn và công nợ nhà cung cấp.',
  null,
  null,
  '2026-07-26T10:35:00+07:00',
  null,
  null,
  '2026-07-26T10:35:00+07:00',
  '2026-07-26T10:35:00+07:00'
)
on conflict (id) do nothing;

insert into public.erp_accounting_journal_lines (
  id, journal_id, tenant_id, site_id, line_number,
  account_code, account_name, debit_vnd, credit_vnd, dimensions
) values
  (
    '88100000-0000-4000-8000-000000000041',
    '88000000-0000-4000-8000-000000000004',
    '00000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000005',
    1, '6277', 'Chi phí dịch vụ mua ngoài', 140000000, 0,
    '{"sourceType":"supplier-invoice","supplierCode":"NCC-TCO-006","invoiceNumber":"000009","costCenter":"TCO-VANHANH"}'::jsonb
  ),
  (
    '88100000-0000-4000-8000-000000000042',
    '88000000-0000-4000-8000-000000000004',
    '00000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000005',
    2, '1331', 'Thuế GTGT được khấu trừ của hàng hóa, dịch vụ', 14000000, 0,
    '{"sourceType":"supplier-invoice","supplierCode":"NCC-TCO-006","invoiceNumber":"000009"}'::jsonb
  ),
  (
    '88100000-0000-4000-8000-000000000043',
    '88000000-0000-4000-8000-000000000004',
    '00000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000005',
    3, '331', 'Phải trả cho người bán', 0, 154000000,
    '{"sourceType":"supplier-invoice","supplierCode":"NCC-TCO-006","invoiceNumber":"000009","dueDate":"2026-08-02"}'::jsonb
  )
on conflict (id) do nothing;

update public.erp_ap_supplier_invoices
set status = 'accounting-review',
    owner_role = 'chief-accountant',
    version = 2,
    accountant_account_id = 'accountant-001',
    accountant_note = 'Đã kiểm tra hồ sơ nguồn và công nợ nhà cung cấp.',
    journal_id = '88000000-0000-4000-8000-000000000004',
    updated_at = '2026-07-26T10:35:00+07:00'
where id = '87000000-0000-4000-8000-000000000004'
  and status = 'ready-for-accounting'
  and version = 1;

do $$
begin
  if exists (
    select 1
    from public.erp_accounting_periods period
    where period.tenant_id = '00000000-0000-4000-8000-000000000001'
      and period.period_key = '2026-07'
      and period.status = 'open'
  ) then
    perform pg_catalog.set_config('app.erp_ap_mutation', 'allowed', true);

    update public.erp_accounting_journals
    set status = 'posted',
        version = 2,
        checker_account_id = 'chief-accountant-001',
        checker_note = 'Hồ sơ đủ điều kiện ghi nhận công nợ.',
        approved_at = '2026-07-26T11:10:00+07:00',
        posted_at = '2026-07-26T11:10:00+07:00'
    where id = '88000000-0000-4000-8000-000000000004'
      and status = 'pending-checker'
      and version = 1;

    update public.erp_ap_supplier_invoices
    set status = 'posted',
        owner_role = 'none',
        version = 3,
        checker_account_id = 'chief-accountant-001',
        checker_note = 'Hồ sơ đủ điều kiện ghi nhận công nợ.',
        posted_at = '2026-07-26T11:10:00+07:00',
        updated_at = '2026-07-26T11:10:00+07:00'
    where id = '87000000-0000-4000-8000-000000000004'
      and status = 'accounting-review'
      and version = 2;
  end if;
end;
$$;

update public.erp_ap_supplier_invoices
set status = 'director-exception',
    owner_role = 'director',
    version = 2,
    updated_at = '2026-07-28T16:05:00+07:00'
where id = '87000000-0000-4000-8000-000000000005'
  and status = 'match-exception'
  and version = 1;

insert into public.erp_ap_audit_events (
  id, invoice_id, tenant_id, site_id, sequence_number,
  event_type, from_status, to_status, actor_account_id, actor_role,
  note, metadata, command_scope, idempotency_key, request_hash, occurred_at
) values
  (
    '87200000-0000-4000-8000-000000000001',
    '87000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000009',
    1, 'invoice.submitted-and-matched', null, 'ready-for-accounting',
    'manager-trang-an', 'manager',
    'PO, nghiệm thu và hóa đơn đã khớp.',
    '{"seed":true}'::jsonb,
    'submit-supplier-invoice',
    'seed-ap-ready-0001',
    repeat('1', 64),
    '2026-07-27T08:20:00+07:00'
  ),
  (
    '87200000-0000-4000-8000-000000000002',
    '87000000-0000-4000-8000-000000000002',
    '00000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    1, 'invoice.submitted-with-exception', null, 'match-exception',
    'manager-trang-an', 'manager',
    'Thiếu biên bản nghiệm thu.',
    '{"seed":true}'::jsonb,
    'submit-supplier-invoice',
    'seed-ap-exception-0002',
    repeat('2', 64),
    '2026-07-28T09:15:00+07:00'
  ),
  (
    '87200000-0000-4000-8000-000000000003',
    '87000000-0000-4000-8000-000000000003',
    '00000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000003',
    1, 'invoice.liability-prepared', 'ready-for-accounting', 'accounting-review',
    'accountant-001', 'accountant',
    'Đã lập bút toán công nợ và chuyển kế toán trưởng.',
    '{"seed":true,"journalId":"88000000-0000-4000-8000-000000000003"}'::jsonb,
    'prepare-supplier-invoice',
    'seed-ap-checker-0003',
    repeat('3', 64),
    '2026-07-28T14:05:00+07:00'
  ),
  (
    '87200000-0000-4000-8000-000000000004',
    '87000000-0000-4000-8000-000000000004',
    '00000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000005',
    1,
    case
      when (
        select invoice.status
        from public.erp_ap_supplier_invoices invoice
        where invoice.id = '87000000-0000-4000-8000-000000000004'
      ) = 'posted' then 'invoice.liability-posted'
      else 'invoice.liability-prepared'
    end,
    case
      when (
        select invoice.status
        from public.erp_ap_supplier_invoices invoice
        where invoice.id = '87000000-0000-4000-8000-000000000004'
      ) = 'posted' then 'accounting-review'
      else 'ready-for-accounting'
    end,
    (
      select invoice.status
      from public.erp_ap_supplier_invoices invoice
      where invoice.id = '87000000-0000-4000-8000-000000000004'
    ),
    case
      when (
        select invoice.status
        from public.erp_ap_supplier_invoices invoice
        where invoice.id = '87000000-0000-4000-8000-000000000004'
      ) = 'posted' then 'chief-accountant-001'
      else 'accountant-001'
    end,
    case
      when (
        select invoice.status
        from public.erp_ap_supplier_invoices invoice
        where invoice.id = '87000000-0000-4000-8000-000000000004'
      ) = 'posted' then 'chief-accountant'
      else 'accountant'
    end,
    case
      when (
        select invoice.status
        from public.erp_ap_supplier_invoices invoice
        where invoice.id = '87000000-0000-4000-8000-000000000004'
      ) = 'posted' then 'Đã kiểm tra và ghi nhận công nợ.'
      else 'Đã lập bút toán công nợ và chuyển kế toán trưởng.'
    end,
    '{"seed":true,"journalId":"88000000-0000-4000-8000-000000000004"}'::jsonb,
    case
      when (
        select invoice.status
        from public.erp_ap_supplier_invoices invoice
        where invoice.id = '87000000-0000-4000-8000-000000000004'
      ) = 'posted' then 'review-supplier-invoice-journal'
      else 'prepare-supplier-invoice'
    end,
    'seed-ap-posted-0004',
    repeat('4', 64),
    '2026-07-26T11:10:00+07:00'
  ),
  (
    '87200000-0000-4000-8000-000000000005',
    '87000000-0000-4000-8000-000000000005',
    '00000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000009',
    1, 'invoice.exception-escalated', 'match-exception', 'director-exception',
    'accountant-001', 'accountant',
    'Phần phát sinh 62 triệu cần quyết định.',
    '{"seed":true,"varianceVnd":62000000}'::jsonb,
    'escalate-supplier-invoice',
    'seed-ap-director-0005',
    repeat('5', 64),
    '2026-07-28T16:05:00+07:00'
  )
on conflict (id) do nothing;

alter table public.erp_ap_suppliers enable row level security;
alter table public.erp_ap_posting_rules enable row level security;
alter table public.erp_ap_supplier_invoices enable row level security;
alter table public.erp_ap_supplier_invoice_lines enable row level security;
alter table public.erp_ap_audit_events enable row level security;
alter table public.erp_ap_command_receipts enable row level security;

revoke all on table public.erp_ap_suppliers from public, anon, authenticated, service_role;
revoke all on table public.erp_ap_posting_rules from public, anon, authenticated, service_role;
revoke all on table public.erp_ap_supplier_invoices from public, anon, authenticated, service_role;
revoke all on table public.erp_ap_supplier_invoice_lines from public, anon, authenticated, service_role;
revoke all on table public.erp_ap_audit_events from public, anon, authenticated, service_role;
revoke all on table public.erp_ap_command_receipts from public, anon, authenticated, service_role;

grant select on table public.erp_ap_suppliers to service_role;
grant select on table public.erp_ap_posting_rules to service_role;
grant select on table public.erp_ap_supplier_invoices to service_role;
grant select on table public.erp_ap_supplier_invoice_lines to service_role;
grant select on table public.erp_ap_audit_events to service_role;
grant select on table public.erp_ap_command_receipts to service_role;

revoke all on function public.erp_ap_match_exception_codes(
  text, text, bigint, text, bigint, date, date, bigint, bigint, bigint, bigint
) from public, anon, authenticated, service_role;
revoke all on function public.erp_ap_write_audit(
  uuid, uuid, uuid, text, text, text, text, text, text, jsonb, text, text, text
) from public, anon, authenticated, service_role;
revoke all on function public.erp_protect_ap_audit()
  from public, anon, authenticated, service_role;
revoke all on function public.erp_ap_submit_supplier_invoice(
  uuid, uuid, text, text, text, bigint, text, bigint, text, text,
  date, date, bigint, bigint, bigint, text, text, text, text,
  text, text, text, text
) from public, anon, authenticated, service_role;
revoke all on function public.erp_ap_resubmit_supplier_invoice(
  uuid, integer, text, bigint, text, bigint, text, text, text, text
) from public, anon, authenticated, service_role;
revoke all on function public.erp_ap_escalate_supplier_invoice(
  uuid, integer, text, text, text, text
) from public, anon, authenticated, service_role;
revoke all on function public.erp_ap_decide_supplier_exception(
  uuid, integer, text, text, text, text, text
) from public, anon, authenticated, service_role;
revoke all on function public.erp_accounting_prepare_supplier_invoice(
  uuid, integer, text, text, text, text
) from public, anon, authenticated, service_role;
revoke all on function public.erp_accounting_review_supplier_invoice_journal(
  uuid, integer, integer, text, text, text, text, text
) from public, anon, authenticated, service_role;

grant execute on function public.erp_ap_submit_supplier_invoice(
  uuid, uuid, text, text, text, bigint, text, bigint, text, text,
  date, date, bigint, bigint, bigint, text, text, text, text,
  text, text, text, text
) to service_role;
grant execute on function public.erp_ap_resubmit_supplier_invoice(
  uuid, integer, text, bigint, text, bigint, text, text, text, text
) to service_role;
grant execute on function public.erp_ap_escalate_supplier_invoice(
  uuid, integer, text, text, text, text
) to service_role;
grant execute on function public.erp_ap_decide_supplier_exception(
  uuid, integer, text, text, text, text, text
) to service_role;
grant execute on function public.erp_accounting_prepare_supplier_invoice(
  uuid, integer, text, text, text, text
) to service_role;
grant execute on function public.erp_accounting_review_supplier_invoice_journal(
  uuid, integer, integer, text, text, text, text, text
) to service_role;

alter table public.erp_ap_supplier_invoices replica identity full;
alter table public.erp_ap_audit_events replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'erp_ap_supplier_invoices'
  ) then
    alter publication supabase_realtime add table public.erp_ap_supplier_invoices;
  end if;
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'erp_ap_audit_events'
  ) then
    alter publication supabase_realtime add table public.erp_ap_audit_events;
  end if;
end;
$$;

commit;
