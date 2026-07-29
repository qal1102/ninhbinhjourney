-- Ninh Binh internal operations: shared assignments, attendance, live signals,
-- finance ledger and decision inbox. Additive to secure_shared_core.

begin;

create table if not exists public.erp_site_assignments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  module_ids text[] not null default '{}',
  status text not null default 'active' check (status in ('active', 'revoked')),
  assigned_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (site_id, user_id)
);

create table if not exists public.erp_attendance_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null check (event_type in ('check-in', 'check-out')),
  latitude double precision check (latitude is null or latitude between -90 and 90),
  longitude double precision check (longitude is null or longitude between -180 and 180),
  accuracy_meters double precision check (accuracy_meters is null or accuracy_meters >= 0),
  source text not null default 'gps' check (source in ('gps', 'supervisor', 'device')),
  happened_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.erp_operational_signals (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  site_id uuid references public.sites(id) on delete cascade,
  signal_type text not null check (signal_type in (
    'ticket-sold', 'guest-check-in', 'capacity-threshold', 'incident',
    'vehicle-status', 'handover', 'reconciliation', 'decision', 'camera-alert'
  )),
  severity text not null default 'info' check (severity in ('info', 'attention', 'critical')),
  title text not null check (char_length(title) between 2 and 160),
  summary text not null default '',
  payload jsonb not null default '{}'::jsonb,
  source_system text not null default 'manual',
  external_event_id text,
  happened_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.erp_finance_ledger_entries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  entry_type text not null check (entry_type in ('revenue', 'cost', 'refund', 'commission')),
  channel text not null check (channel in ('ticket', 'transport', 'dining-retail', 'partner', 'other')),
  amount_vnd bigint not null check (amount_vnd >= 0),
  currency text not null default 'VND' check (currency = 'VND'),
  reconciliation_status text not null default 'pending' check (reconciliation_status in ('pending', 'matched', 'exception')),
  source_system text not null,
  external_reference text,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null,
  reconciled_at timestamptz,
  reconciled_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.erp_decision_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  site_id uuid references public.sites(id) on delete cascade,
  priority text not null check (priority in ('normal', 'high', 'critical')),
  status text not null default 'open' check (status in ('open', 'acknowledged', 'approved', 'rejected', 'closed')),
  title text not null check (char_length(title) between 2 and 180),
  summary text not null,
  recommended_action text,
  source_signal_id uuid references public.erp_operational_signals(id) on delete set null,
  assigned_to uuid references auth.users(id),
  due_at timestamptz,
  decided_at timestamptz,
  decided_by uuid references auth.users(id),
  decision_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.erp_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth_secret text not null,
  user_agent text,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, endpoint)
);

-- Camera credentials stay in the camera gateway or a secrets manager. This
-- table stores only the safe playback reference returned by that gateway.
create table if not exists public.erp_camera_sources (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 100),
  zone text not null check (char_length(zone) between 2 and 140),
  provider text not null,
  stream_kind text not null check (stream_kind in ('hls', 'webrtc', 'rtsp-gateway')),
  stream_reference text not null,
  capabilities text[] not null default '{}',
  status text not null default 'offline' check (status in ('online', 'degraded', 'offline', 'maintenance')),
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (site_id, name)
);

create table if not exists public.erp_camera_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  camera_source_id uuid not null references public.erp_camera_sources(id) on delete cascade,
  event_type text not null check (event_type in ('density', 'queue', 'barrier-crossing', 'lifejacket', 'offline', 'other')),
  severity text not null default 'info' check (severity in ('info', 'attention', 'critical')),
  confidence numeric(5,4) check (confidence is null or confidence between 0 and 1),
  anonymous_count integer check (anonymous_count is null or anonymous_count >= 0),
  snapshot_path text,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'open' check (status in ('open', 'acknowledged', 'closed')),
  occurred_at timestamptz not null default now(),
  acknowledged_at timestamptz,
  acknowledged_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.erp_projects (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 180),
  project_type text not null check (project_type in ('event', 'festival', 'capital', 'maintenance', 'campaign')),
  status text not null default 'planning' check (status in ('planning', 'active', 'at-risk', 'completed', 'cancelled')),
  starts_on date,
  ends_on date,
  budget_vnd bigint not null default 0 check (budget_vnd >= 0),
  committed_vnd bigint not null default 0 check (committed_vnd >= 0 and committed_vnd <= budget_vnd),
  expected_guests integer check (expected_guests is null or expected_guests >= 0),
  progress_percent integer not null default 0 check (progress_percent between 0 and 100),
  owner_user_id uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.erp_project_work_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  project_id uuid not null references public.erp_projects(id) on delete cascade,
  code text not null,
  title text not null check (char_length(title) between 2 and 220),
  workstream text not null,
  priority text not null default 'normal' check (priority in ('normal', 'high', 'critical')),
  status text not null default 'open' check (status in ('open', 'in-progress', 'blocked', 'review', 'completed')),
  owner_user_id uuid references auth.users(id),
  due_at timestamptz,
  progress_percent integer not null default 0 check (progress_percent between 0 and 100),
  escalation_level text not null default 'none' check (escalation_level in ('none', 'manager', 'director')),
  evidence jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, code)
);

create table if not exists public.erp_field_reports (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  reporter_user_id uuid not null references auth.users(id) on delete cascade,
  work_item_id uuid references public.erp_project_work_items(id) on delete set null,
  area text not null,
  category text not null check (category in ('shift-open', 'progress', 'result', 'incident', 'shift-handover')),
  task_title text not null,
  progress_percent integer not null check (progress_percent between 0 and 100),
  finance_code text not null,
  note text not null,
  image_paths text[] not null check (cardinality(image_paths) > 0),
  status text not null default 'submitted' check (status in ('draft', 'submitted', 'confirmed', 'rejected')),
  captured_at timestamptz not null default now(),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.erp_ticket_scans (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  qr_token_hash text not null,
  booking_reference text,
  gate_code text not null,
  product_code text,
  quantity integer not null default 1 check (quantity > 0),
  result text not null check (result in ('accepted', 'rejected', 'partial', 'duplicate')),
  reason text,
  recorded_by uuid not null references auth.users(id),
  scanned_at timestamptz not null default now(),
  unique (site_id, qr_token_hash, scanned_at)
);

create table if not exists public.erp_ticket_shift_closures (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  employee_user_id uuid not null references auth.users(id) on delete cascade,
  shift_started_at timestamptz not null,
  shift_ended_at timestamptz not null,
  tickets_sold integer not null check (tickets_sold >= 0),
  product_mix jsonb not null default '{}'::jsonb,
  cash_vnd bigint not null default 0 check (cash_vnd >= 0),
  card_transfer_vnd bigint not null default 0 check (card_transfer_vnd >= 0),
  refund_vnd bigint not null default 0 check (refund_vnd >= 0),
  difference_vnd bigint not null default 0,
  finance_code text not null,
  note text not null default '',
  status text not null default 'submitted' check (status in ('draft', 'submitted', 'matched', 'exception')),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  check (shift_ended_at >= shift_started_at)
);

create table if not exists public.erp_partners (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  code text not null,
  name text not null,
  partner_type text not null check (partner_type in ('sales-partner', 'supplier', 'contractor')),
  owner_user_id uuid references auth.users(id),
  status text not null default 'active' check (status in ('prospect', 'active', 'suspended', 'closed')),
  payment_terms_days integer not null default 0 check (payment_terms_days >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, code)
);

create table if not exists public.erp_partner_documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  partner_id uuid not null references public.erp_partners(id) on delete cascade,
  document_type text not null,
  document_number text,
  storage_path text not null,
  status text not null default 'submitted' check (status in ('missing', 'submitted', 'approved', 'expired', 'rejected')),
  valid_from date,
  valid_until date,
  uploaded_by uuid not null references auth.users(id),
  reviewed_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.erp_partner_quotes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  partner_id uuid not null references public.erp_partners(id) on delete cascade,
  quote_code text not null,
  product_snapshot jsonb not null,
  quantity integer not null check (quantity > 0),
  subtotal_vnd bigint not null check (subtotal_vnd >= 0),
  discount_vnd bigint not null default 0 check (discount_vnd >= 0),
  total_vnd bigint not null check (total_vnd >= 0),
  terms text not null,
  valid_until date not null,
  status text not null default 'draft' check (status in ('draft', 'review', 'sent', 'accepted', 'rejected', 'expired')),
  created_by uuid not null references auth.users(id),
  approved_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, quote_code)
);

create table if not exists public.erp_partner_feedback (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  partner_id uuid references public.erp_partners(id) on delete set null,
  source text not null,
  customer_reference text,
  content text not null,
  priority text not null default 'normal' check (priority in ('normal', 'high', 'critical')),
  status text not null default 'open' check (status in ('open', 'assigned', 'responded', 'closed')),
  assigned_to uuid references auth.users(id),
  response text,
  response_due_at timestamptz,
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists erp_assignments_user_idx on public.erp_site_assignments(user_id, status);
create index if not exists erp_attendance_site_time_idx on public.erp_attendance_events(site_id, happened_at desc);
create index if not exists erp_attendance_user_time_idx on public.erp_attendance_events(user_id, happened_at desc);
create index if not exists erp_signals_tenant_time_idx on public.erp_operational_signals(tenant_id, happened_at desc);
create index if not exists erp_signals_site_time_idx on public.erp_operational_signals(site_id, happened_at desc);
create unique index if not exists erp_signals_external_event_idx on public.erp_operational_signals(tenant_id, source_system, external_event_id) where external_event_id is not null;
create index if not exists erp_finance_site_time_idx on public.erp_finance_ledger_entries(site_id, occurred_at desc);
create index if not exists erp_finance_reconcile_idx on public.erp_finance_ledger_entries(tenant_id, reconciliation_status, occurred_at desc);
create unique index if not exists erp_finance_external_reference_idx on public.erp_finance_ledger_entries(tenant_id, source_system, external_reference) where external_reference is not null;
create index if not exists erp_decisions_open_idx on public.erp_decision_items(tenant_id, status, priority, due_at);
create index if not exists erp_camera_sources_site_idx on public.erp_camera_sources(site_id, status);
create index if not exists erp_camera_events_site_time_idx on public.erp_camera_events(site_id, occurred_at desc);
create index if not exists erp_camera_events_open_idx on public.erp_camera_events(tenant_id, status, severity, occurred_at desc);
create index if not exists erp_projects_site_status_idx on public.erp_projects(site_id, status, starts_on);
create index if not exists erp_project_work_due_idx on public.erp_project_work_items(project_id, status, priority, due_at);
create index if not exists erp_project_work_owner_idx on public.erp_project_work_items(owner_user_id, status, due_at);
create index if not exists erp_field_reports_site_time_idx on public.erp_field_reports(site_id, captured_at desc);
create index if not exists erp_field_reports_reporter_idx on public.erp_field_reports(reporter_user_id, status, captured_at desc);
create index if not exists erp_ticket_scans_site_time_idx on public.erp_ticket_scans(site_id, scanned_at desc);
create index if not exists erp_ticket_closures_site_time_idx on public.erp_ticket_shift_closures(site_id, shift_ended_at desc);
create index if not exists erp_partners_site_status_idx on public.erp_partners(site_id, status, partner_type);
create index if not exists erp_partner_documents_partner_idx on public.erp_partner_documents(partner_id, status, valid_until);
create index if not exists erp_partner_quotes_partner_idx on public.erp_partner_quotes(partner_id, status, created_at desc);
create index if not exists erp_partner_feedback_queue_idx on public.erp_partner_feedback(site_id, status, priority, response_due_at);

create or replace function public.can_access_erp_site(p_site_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.sites s
    where s.id = p_site_id
      and (
        public.has_tenant_role(s.tenant_id, array['admin'])
        or exists (
          select 1
          from public.erp_site_assignments esa
          where esa.site_id = s.id
            and esa.user_id = (select auth.uid())
            and esa.status = 'active'
        )
      )
  );
$$;

create or replace function public.can_manage_erp_site(p_site_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.sites s
    where s.id = p_site_id
      and (
        public.has_tenant_role(s.tenant_id, array['admin'])
        or (
          public.has_tenant_role(s.tenant_id, array['site-supervisor','icc-operator'])
          and exists (
            select 1
            from public.erp_site_assignments esa
            where esa.site_id = s.id
              and esa.user_id = (select auth.uid())
              and esa.status = 'active'
          )
        )
      )
  );
$$;

alter table public.erp_site_assignments enable row level security;
alter table public.erp_attendance_events enable row level security;
alter table public.erp_operational_signals enable row level security;
alter table public.erp_finance_ledger_entries enable row level security;
alter table public.erp_decision_items enable row level security;
alter table public.erp_push_subscriptions enable row level security;
alter table public.erp_camera_sources enable row level security;
alter table public.erp_camera_events enable row level security;
alter table public.erp_projects enable row level security;
alter table public.erp_project_work_items enable row level security;
alter table public.erp_field_reports enable row level security;
alter table public.erp_ticket_scans enable row level security;
alter table public.erp_ticket_shift_closures enable row level security;
alter table public.erp_partners enable row level security;
alter table public.erp_partner_documents enable row level security;
alter table public.erp_partner_quotes enable row level security;
alter table public.erp_partner_feedback enable row level security;

grant select, insert, update, delete on public.erp_site_assignments to authenticated;
grant select, insert on public.erp_attendance_events to authenticated;
grant select, insert on public.erp_operational_signals to authenticated;
grant select, insert, update on public.erp_finance_ledger_entries to authenticated;
grant select, insert, update on public.erp_decision_items to authenticated;
grant select, insert, update, delete on public.erp_push_subscriptions to authenticated;
grant select, insert, update on public.erp_camera_sources to authenticated;
grant select, insert, update on public.erp_camera_events to authenticated;
grant select, insert, update on public.erp_projects to authenticated;
grant select, insert, update on public.erp_project_work_items to authenticated;
grant select, insert, update on public.erp_field_reports to authenticated;
grant select, insert on public.erp_ticket_scans to authenticated;
grant select, insert, update on public.erp_ticket_shift_closures to authenticated;
grant select, insert, update on public.erp_partners to authenticated;
grant select, insert, update on public.erp_partner_documents to authenticated;
grant select, insert, update on public.erp_partner_quotes to authenticated;
grant select, insert, update on public.erp_partner_feedback to authenticated;

create policy erp_assignment_read on public.erp_site_assignments for select to authenticated
using (user_id = (select auth.uid()) or public.can_manage_erp_site(site_id));
create policy erp_assignment_insert on public.erp_site_assignments for insert to authenticated
with check (public.can_manage_erp_site(site_id) and assigned_by = (select auth.uid()));
create policy erp_assignment_update on public.erp_site_assignments for update to authenticated
using (public.can_manage_erp_site(site_id)) with check (public.can_manage_erp_site(site_id));
create policy erp_assignment_delete on public.erp_site_assignments for delete to authenticated
using (public.can_manage_erp_site(site_id));

create policy erp_attendance_read on public.erp_attendance_events for select to authenticated
using (user_id = (select auth.uid()) or public.can_manage_erp_site(site_id));
create policy erp_attendance_insert on public.erp_attendance_events for insert to authenticated
with check (user_id = (select auth.uid()) and public.can_access_erp_site(site_id));

create policy erp_signal_read on public.erp_operational_signals for select to authenticated
using (
  public.has_tenant_role(tenant_id, array['check-in-agent','site-supervisor','icc-operator','finance','admin'])
  and (site_id is null or public.can_access_erp_site(site_id))
);
create policy erp_signal_insert on public.erp_operational_signals for insert to authenticated
with check (
  created_by = (select auth.uid())
  and (site_id is null or public.can_access_erp_site(site_id))
  and public.has_tenant_role(tenant_id, array['check-in-agent','site-supervisor','icc-operator','finance','admin'])
);

create policy erp_finance_read on public.erp_finance_ledger_entries for select to authenticated
using (
  public.can_access_erp_site(site_id)
  and public.has_tenant_role(tenant_id, array['site-supervisor','finance','admin'])
);
create policy erp_finance_insert on public.erp_finance_ledger_entries for insert to authenticated
with check (public.has_tenant_role(tenant_id, array['finance','admin']));
create policy erp_finance_update on public.erp_finance_ledger_entries for update to authenticated
using (public.has_tenant_role(tenant_id, array['finance','admin']))
with check (public.has_tenant_role(tenant_id, array['finance','admin']));

create policy erp_decision_read on public.erp_decision_items for select to authenticated
using (
  public.has_tenant_role(tenant_id, array['site-supervisor','icc-operator','finance','admin'])
  and (site_id is null or public.can_access_erp_site(site_id))
);
create policy erp_decision_insert on public.erp_decision_items for insert to authenticated
with check (
  (site_id is null or public.can_manage_erp_site(site_id))
  and public.has_tenant_role(tenant_id, array['site-supervisor','icc-operator','finance','admin'])
);
create policy erp_decision_update on public.erp_decision_items for update to authenticated
using (site_id is null or public.can_manage_erp_site(site_id))
with check (site_id is null or public.can_manage_erp_site(site_id));

create policy erp_push_self_read on public.erp_push_subscriptions for select to authenticated
using (user_id = (select auth.uid()));
create policy erp_push_self_insert on public.erp_push_subscriptions for insert to authenticated
with check (user_id = (select auth.uid()));
create policy erp_push_self_update on public.erp_push_subscriptions for update to authenticated
using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy erp_push_self_delete on public.erp_push_subscriptions for delete to authenticated
using (user_id = (select auth.uid()));

create policy erp_camera_source_read on public.erp_camera_sources for select to authenticated
using (public.can_access_erp_site(site_id));
create policy erp_camera_source_insert on public.erp_camera_sources for insert to authenticated
with check (public.can_manage_erp_site(site_id));
create policy erp_camera_source_update on public.erp_camera_sources for update to authenticated
using (public.can_manage_erp_site(site_id)) with check (public.can_manage_erp_site(site_id));

create policy erp_camera_event_read on public.erp_camera_events for select to authenticated
using (public.can_access_erp_site(site_id));
create policy erp_camera_event_insert on public.erp_camera_events for insert to authenticated
with check (public.can_manage_erp_site(site_id));
create policy erp_camera_event_update on public.erp_camera_events for update to authenticated
using (public.can_manage_erp_site(site_id)) with check (public.can_manage_erp_site(site_id));

create policy erp_project_read on public.erp_projects for select to authenticated
using (public.can_access_erp_site(site_id));
create policy erp_project_insert on public.erp_projects for insert to authenticated
with check (public.can_manage_erp_site(site_id));
create policy erp_project_update on public.erp_projects for update to authenticated
using (public.can_manage_erp_site(site_id)) with check (public.can_manage_erp_site(site_id));

create policy erp_project_work_read on public.erp_project_work_items for select to authenticated
using (public.can_access_erp_site(site_id));
create policy erp_project_work_insert on public.erp_project_work_items for insert to authenticated
with check (public.can_manage_erp_site(site_id));
create policy erp_project_work_update on public.erp_project_work_items for update to authenticated
using (owner_user_id = (select auth.uid()) or public.can_manage_erp_site(site_id))
with check (owner_user_id = (select auth.uid()) or public.can_manage_erp_site(site_id));

create policy erp_field_report_read on public.erp_field_reports for select to authenticated
using (reporter_user_id = (select auth.uid()) or public.can_manage_erp_site(site_id));
create policy erp_field_report_insert on public.erp_field_reports for insert to authenticated
with check (reporter_user_id = (select auth.uid()) and public.can_access_erp_site(site_id));
create policy erp_field_report_update on public.erp_field_reports for update to authenticated
using (public.can_manage_erp_site(site_id)) with check (public.can_manage_erp_site(site_id));

create policy erp_ticket_scan_read on public.erp_ticket_scans for select to authenticated
using (public.can_access_erp_site(site_id));
create policy erp_ticket_scan_insert on public.erp_ticket_scans for insert to authenticated
with check (recorded_by = (select auth.uid()) and public.can_access_erp_site(site_id));

create policy erp_ticket_closure_read on public.erp_ticket_shift_closures for select to authenticated
using (employee_user_id = (select auth.uid()) or public.can_manage_erp_site(site_id));
create policy erp_ticket_closure_insert on public.erp_ticket_shift_closures for insert to authenticated
with check (employee_user_id = (select auth.uid()) and public.can_access_erp_site(site_id));
create policy erp_ticket_closure_update on public.erp_ticket_shift_closures for update to authenticated
using (public.can_manage_erp_site(site_id)) with check (public.can_manage_erp_site(site_id));

create policy erp_partner_read on public.erp_partners for select to authenticated
using (public.can_access_erp_site(site_id));
create policy erp_partner_insert on public.erp_partners for insert to authenticated
with check (public.can_manage_erp_site(site_id));
create policy erp_partner_update on public.erp_partners for update to authenticated
using (owner_user_id = (select auth.uid()) or public.can_manage_erp_site(site_id))
with check (owner_user_id = (select auth.uid()) or public.can_manage_erp_site(site_id));

create policy erp_partner_document_read on public.erp_partner_documents for select to authenticated
using (public.can_access_erp_site(site_id));
create policy erp_partner_document_insert on public.erp_partner_documents for insert to authenticated
with check (uploaded_by = (select auth.uid()) and public.can_access_erp_site(site_id));
create policy erp_partner_document_update on public.erp_partner_documents for update to authenticated
using (public.can_manage_erp_site(site_id)) with check (public.can_manage_erp_site(site_id));

create policy erp_partner_quote_read on public.erp_partner_quotes for select to authenticated
using (public.can_access_erp_site(site_id));
create policy erp_partner_quote_insert on public.erp_partner_quotes for insert to authenticated
with check (created_by = (select auth.uid()) and public.can_access_erp_site(site_id));
create policy erp_partner_quote_update on public.erp_partner_quotes for update to authenticated
using (created_by = (select auth.uid()) or public.can_manage_erp_site(site_id))
with check (created_by = (select auth.uid()) or public.can_manage_erp_site(site_id));

create policy erp_partner_feedback_read on public.erp_partner_feedback for select to authenticated
using (public.can_access_erp_site(site_id));
create policy erp_partner_feedback_insert on public.erp_partner_feedback for insert to authenticated
with check (public.can_access_erp_site(site_id));
create policy erp_partner_feedback_update on public.erp_partner_feedback for update to authenticated
using (assigned_to = (select auth.uid()) or public.can_manage_erp_site(site_id))
with check (assigned_to = (select auth.uid()) or public.can_manage_erp_site(site_id));

alter table public.erp_attendance_events replica identity full;
alter table public.erp_operational_signals replica identity full;
alter table public.erp_finance_ledger_entries replica identity full;
alter table public.erp_decision_items replica identity full;
alter table public.erp_camera_sources replica identity full;
alter table public.erp_camera_events replica identity full;
alter table public.erp_projects replica identity full;
alter table public.erp_project_work_items replica identity full;
alter table public.erp_field_reports replica identity full;
alter table public.erp_ticket_scans replica identity full;
alter table public.erp_ticket_shift_closures replica identity full;
alter table public.erp_partner_documents replica identity full;
alter table public.erp_partner_quotes replica identity full;
alter table public.erp_partner_feedback replica identity full;

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'erp_attendance_events', 'erp_operational_signals',
    'erp_finance_ledger_entries', 'erp_decision_items',
    'erp_camera_sources', 'erp_camera_events',
    'erp_projects', 'erp_project_work_items',
    'erp_field_reports', 'erp_ticket_scans', 'erp_ticket_shift_closures',
    'erp_partner_documents', 'erp_partner_quotes', 'erp_partner_feedback'
  ]
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = v_table
    ) then
      execute format('alter publication supabase_realtime add table public.%I', v_table);
    end if;
  end loop;
end
$$;

commit;
