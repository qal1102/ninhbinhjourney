-- DestinationOS + Ninh Bình Journey
-- C1: secure tenant-aware, run-scoped shared core.
-- This migration is additive and is designed for the dedicated client-demo project.

begin;

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.tenants (
  id uuid primary key,
  name text not null,
  slug text not null unique,
  status text not null check (status in ('active', 'inactive')),
  created_at timestamptz not null default now()
);

create table if not exists public.regions (
  id uuid primary key,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  slug text not null,
  scope_type text not null check (scope_type in ('tourism-core', 'administrative')),
  map_bounds jsonb not null,
  default_locale text not null check (default_locale in ('vi', 'en')),
  created_at timestamptz not null default now(),
  unique (tenant_id, slug)
);

create table if not exists public.operators (
  id uuid primary key,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  slug text not null,
  operator_type text not null check (operator_type in ('destination-operator', 'site-operator', 'vendor')),
  created_at timestamptz not null default now(),
  unique (tenant_id, slug)
);

create table if not exists public.sites (
  id uuid primary key,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  region_id uuid not null references public.regions(id) on delete cascade,
  operator_id uuid not null references public.operators(id),
  name text not null,
  slug text not null,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  tags text[] not null default '{}',
  mobility_level text not null check (mobility_level in ('low', 'moderate', 'high')),
  suggested_minutes integer not null check (suggested_minutes > 0),
  demo_opening_windows jsonb not null default '[]'::jsonb,
  content_source_ids text[] not null default '{}',
  source_url text,
  source_reviewed_at date,
  created_at timestamptz not null default now(),
  unique (tenant_id, slug)
);

create table if not exists public.campaigns (
  id uuid primary key,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  region_id uuid not null references public.regions(id) on delete cascade,
  name text not null,
  slug text not null,
  campaign_type text not null check (campaign_type in ('qr', 'editorial', 'concept-collaboration', 'direct')),
  status text not null check (status in ('live-demo', 'concept', 'inactive')),
  created_at timestamptz not null default now(),
  unique (tenant_id, slug)
);

create table if not exists public.qr_sources (
  id uuid primary key,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  region_id uuid not null references public.regions(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id),
  site_id uuid references public.sites(id),
  code text not null unique,
  placement_label text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  region_id uuid not null references public.regions(id) on delete cascade,
  name text not null,
  slug text not null,
  product_type text not null check (product_type in ('ticket', 'transport', 'experience', 'package')),
  ledger_type text not null check (ledger_type in ('service-commerce', 'donation', 'sponsorship')),
  demo_price_vnd integer not null check (demo_price_vnd >= 0),
  duration_minutes integer not null check (duration_minutes > 0),
  entitlement_templates jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (tenant_id, slug)
);

create table if not exists public.product_sites (
  product_id uuid not null references public.products(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  stop_order integer not null default 0 check (stop_order >= 0),
  primary key (product_id, site_id)
);

create table if not exists public.sops (
  id uuid primary key,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  code text not null unique,
  title text not null,
  category text not null check (
    category in (
      'crowd-capacity', 'weather', 'medical', 'transport', 'water-safety',
      'fire-safety', 'infrastructure', 'security', 'lost-person', 'other'
    )
  ),
  summary text not null,
  steps jsonb not null,
  approval_policy text not null check (approval_policy in ('operator', 'supervisor', 'two-door')),
  source_document text not null,
  source_page integer,
  approval_note text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  locale text not null default 'vi' check (locale in ('vi', 'en')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tenant_memberships (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (
    role in (
      'check-in-agent', 'site-supervisor', 'icc-operator', 'finance',
      'content', 'admin', 'ritual-authority'
    )
  ),
  status text not null default 'active' check (status in ('active', 'revoked')),
  created_at timestamptz not null default now(),
  unique (tenant_id, user_id, role)
);

create table if not exists public.demo_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  region_id uuid not null references public.regions(id),
  operator_id uuid not null references public.operators(id),
  owner_user_id uuid not null references auth.users(id),
  label text not null check (char_length(label) between 2 and 80),
  status text not null default 'active' check (status in ('active', 'read-only', 'expired')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expires_at > created_at)
);

create table if not exists public.demo_run_members (
  demo_run_id uuid not null references public.demo_runs(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  campaign_id uuid references public.campaigns(id),
  qr_source_id uuid references public.qr_sources(id),
  role text not null check (
    role in (
      'visitor', 'check-in-agent', 'site-supervisor', 'icc-operator',
      'finance', 'content', 'admin', 'ritual-authority'
    )
  ),
  status text not null default 'active' check (status in ('active', 'revoked')),
  joined_at timestamptz not null default now(),
  primary key (demo_run_id, user_id)
);

create table if not exists public.demo_join_tokens (
  id uuid primary key default gen_random_uuid(),
  demo_run_id uuid not null references public.demo_runs(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  qr_source_id uuid references public.qr_sources(id),
  token_hash text not null unique,
  intended_role text not null default 'visitor' check (intended_role = 'visitor'),
  expires_at timestamptz not null,
  used_at timestamptz,
  used_by uuid references auth.users(id),
  revoked_at timestamptz,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.capacity_slots (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  demo_run_id uuid not null references public.demo_runs(id) on delete cascade,
  site_id uuid not null references public.sites(id),
  slot_date date not null,
  start_time time not null,
  end_time time not null,
  capacity integer not null check (capacity >= 0),
  reserved integer not null default 0 check (reserved >= 0),
  checked_in integer not null default 0 check (checked_in >= 0),
  status text not null default 'available' check (status in ('available', 'paused', 'closed')),
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  unique (demo_run_id, site_id, slot_date, start_time),
  check (end_time > start_time),
  check (reserved <= capacity),
  check (checked_in <= reserved)
);

create table if not exists public.journey_intents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  demo_run_id uuid not null references public.demo_runs(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  locale text not null check (locale in ('vi', 'en')),
  raw_text text not null check (char_length(raw_text) between 2 and 4000),
  structured_intent jsonb not null,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.itineraries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  demo_run_id uuid not null references public.demo_runs(id) on delete cascade,
  region_id uuid not null references public.regions(id),
  intent_id uuid not null references public.journey_intents(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  total_minutes integer not null check (total_minutes > 0),
  estimated_price_vnd integer not null check (estimated_price_vnd >= 0),
  validation jsonb not null,
  explanation text not null,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.itinerary_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  demo_run_id uuid not null references public.demo_runs(id) on delete cascade,
  itinerary_id uuid not null references public.itineraries(id) on delete cascade,
  site_id uuid not null references public.sites(id),
  created_by uuid not null references auth.users(id),
  item_order integer not null check (item_order >= 0),
  start_at timestamptz not null,
  end_at timestamptz not null,
  travel_minutes_from_previous integer not null default 0 check (travel_minutes_from_previous >= 0),
  reason text not null,
  unique (itinerary_id, item_order),
  check (end_at > start_at)
);

create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  demo_run_id uuid not null references public.demo_runs(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  itinerary_id uuid references public.itineraries(id),
  slot_date date not null,
  party_size integer not null check (party_size between 1 and 20),
  selections jsonb not null,
  subtotal_vnd integer not null check (subtotal_vnd >= 0),
  total_vnd integer not null check (total_vnd >= 0),
  currency text not null default 'VND' check (currency = 'VND'),
  status text not null default 'active' check (status in ('active', 'consumed', 'expired', 'cancelled')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  demo_run_id uuid not null references public.demo_runs(id) on delete cascade,
  region_id uuid not null references public.regions(id),
  operator_id uuid not null references public.operators(id),
  created_by uuid not null references auth.users(id),
  quote_id uuid not null references public.quotes(id),
  itinerary_id uuid references public.itineraries(id),
  campaign_id uuid references public.campaigns(id),
  qr_source_id uuid references public.qr_sources(id),
  code text not null unique,
  status text not null check (status in ('pending', 'confirmed', 'partially-used', 'used', 'cancelled', 'expired')),
  visit_date date not null,
  customer_display_name text not null,
  masked_contact text not null,
  party_size integer not null check (party_size between 1 and 20),
  subtotal_vnd integer not null check (subtotal_vnd >= 0),
  total_vnd integer not null check (total_vnd >= 0),
  currency text not null default 'VND' check (currency = 'VND'),
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (demo_run_id, idempotency_key)
);

create table if not exists public.booking_contacts (
  booking_id uuid primary key references public.bookings(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  demo_run_id uuid not null references public.demo_runs(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  contact_kind text not null check (contact_kind in ('email', 'phone')),
  contact_value text not null,
  consent_at timestamptz not null
);

create table if not exists public.booking_lines (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  demo_run_id uuid not null references public.demo_runs(id) on delete cascade,
  booking_id uuid not null references public.bookings(id) on delete cascade,
  product_id uuid not null references public.products(id),
  quantity integer not null check (quantity > 0),
  unit_price_vnd integer not null check (unit_price_vnd >= 0),
  total_vnd integer not null check (total_vnd >= 0),
  ledger_type text not null check (ledger_type in ('service-commerce', 'donation', 'sponsorship')),
  check (total_vnd = quantity * unit_price_vnd)
);

create table if not exists public.payment_intents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  demo_run_id uuid not null references public.demo_runs(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  quote_id uuid not null references public.quotes(id),
  booking_id uuid references public.bookings(id),
  provider text not null default 'destinationos-sandbox',
  provider_intent_id text not null,
  callback_secret_hash text not null,
  mode text not null default 'simulation' check (mode = 'simulation'),
  status text not null check (status in ('pending', 'succeeded', 'failed', 'cancelled', 'expired')),
  amount_vnd integer not null check (amount_vnd >= 0),
  currency text not null default 'VND' check (currency = 'VND'),
  idempotency_key text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_intent_id),
  unique (demo_run_id, idempotency_key)
);

create table if not exists public.payment_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  demo_run_id uuid not null references public.demo_runs(id) on delete cascade,
  payment_intent_id uuid not null references public.payment_intents(id) on delete cascade,
  provider text not null,
  provider_event_id text not null,
  event_type text not null,
  payload_digest text not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (provider, provider_event_id)
);

create table if not exists public.passes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  demo_run_id uuid not null references public.demo_runs(id) on delete cascade,
  booking_id uuid not null unique references public.bookings(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  token_hash text not null unique,
  token_hint text not null,
  status text not null check (status in ('active', 'partially-used', 'used', 'cancelled', 'expired')),
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create table if not exists public.pass_entitlements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  demo_run_id uuid not null references public.demo_runs(id) on delete cascade,
  pass_id uuid not null references public.passes(id) on delete cascade,
  site_id uuid not null references public.sites(id),
  product_id uuid not null references public.products(id),
  quantity integer not null check (quantity > 0),
  redeemed_quantity integer not null default 0 check (redeemed_quantity >= 0),
  unique (pass_id, site_id, product_id),
  check (redeemed_quantity <= quantity)
);

create table if not exists public.redemptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  demo_run_id uuid not null references public.demo_runs(id) on delete cascade,
  pass_id uuid not null references public.passes(id),
  entitlement_id uuid not null references public.pass_entitlements(id),
  site_id uuid not null references public.sites(id),
  quantity integer not null check (quantity > 0),
  actor_user_id uuid not null references auth.users(id),
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  unique (demo_run_id, idempotency_key)
);

create table if not exists public.incidents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  demo_run_id uuid not null references public.demo_runs(id) on delete cascade,
  region_id uuid not null references public.regions(id),
  site_id uuid not null references public.sites(id),
  category text not null check (
    category in (
      'crowd-capacity', 'weather', 'medical', 'transport', 'water-safety',
      'fire-safety', 'infrastructure', 'security', 'lost-person', 'other'
    )
  ),
  severity text not null check (severity in ('P1', 'P2', 'P3', 'P4')),
  status text not null check (status in ('open', 'acknowledged', 'in-progress', 'resolved', 'closed')),
  transcript text not null,
  summary text not null,
  wait_time_minutes integer check (wait_time_minutes is null or wait_time_minutes >= 0),
  sop_id uuid references public.sops(id),
  created_by uuid not null references auth.users(id),
  confirmed_by uuid not null references auth.users(id),
  assigned_to uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.resource_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  demo_run_id uuid not null references public.demo_runs(id) on delete cascade,
  incident_id uuid not null references public.incidents(id) on delete cascade,
  resource_type text not null,
  quantity integer not null check (quantity > 0),
  status text not null default 'requested' check (status in ('requested', 'assigned', 'fulfilled', 'cancelled')),
  requested_by uuid not null references auth.users(id),
  assigned_to uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  demo_run_id uuid not null references public.demo_runs(id) on delete cascade,
  actor_user_id uuid references auth.users(id),
  actor_kind text not null check (actor_kind in ('user', 'system')),
  action text not null,
  entity_type text not null,
  entity_id uuid not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  demo_run_id uuid not null references public.demo_runs(id) on delete cascade,
  actor_user_id uuid references auth.users(id),
  event_type text not null,
  campaign_id uuid references public.campaigns(id),
  qr_source_id uuid references public.qr_sources(id),
  entity_type text,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists tenant_memberships_user_idx on public.tenant_memberships(user_id, tenant_id, status);
create index if not exists demo_run_members_user_idx on public.demo_run_members(user_id, demo_run_id, status);
create index if not exists demo_runs_tenant_idx on public.demo_runs(tenant_id, status, expires_at);
create index if not exists demo_join_tokens_run_idx on public.demo_join_tokens(demo_run_id, expires_at);
create index if not exists capacity_slots_run_idx on public.capacity_slots(demo_run_id, slot_date, site_id);
create index if not exists journey_intents_run_idx on public.journey_intents(demo_run_id, created_by);
create index if not exists itineraries_run_idx on public.itineraries(demo_run_id, created_by);
create index if not exists quotes_run_idx on public.quotes(demo_run_id, created_by, status);
create index if not exists bookings_run_idx on public.bookings(demo_run_id, created_at desc);
create index if not exists payments_run_idx on public.payment_intents(demo_run_id, status);
create index if not exists passes_run_idx on public.passes(demo_run_id, booking_id);
create index if not exists redemptions_run_idx on public.redemptions(demo_run_id, created_at desc);
create index if not exists incidents_run_idx on public.incidents(demo_run_id, status, severity);
create index if not exists audit_run_idx on public.audit_events(demo_run_id, created_at desc);
create index if not exists analytics_run_idx on public.analytics_events(demo_run_id, created_at desc);

create or replace function public.current_user_is_anonymous()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(((select auth.jwt())->>'is_anonymous')::boolean, false);
$$;

create or replace function public.has_tenant_role(p_tenant_id uuid, p_roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select auth.uid()) is not null
    and not public.current_user_is_anonymous()
    and exists (
      select 1
      from public.tenant_memberships tm
      where tm.tenant_id = p_tenant_id
        and tm.user_id = (select auth.uid())
        and tm.status = 'active'
        and tm.role = any(p_roles)
    );
$$;

create or replace function public.is_active_run_member(p_demo_run_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.demo_run_members drm
    join public.demo_runs dr on dr.id = drm.demo_run_id
    where drm.demo_run_id = p_demo_run_id
      and drm.user_id = (select auth.uid())
      and drm.status = 'active'
      and dr.status in ('active', 'read-only')
  );
$$;

create or replace function public.is_internal_run_member(p_demo_run_id uuid, p_roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    not public.current_user_is_anonymous()
    and exists (
      select 1
      from public.demo_run_members drm
      join public.demo_runs dr on dr.id = drm.demo_run_id
      join public.tenant_memberships tm
        on tm.tenant_id = dr.tenant_id
       and tm.user_id = drm.user_id
       and tm.status = 'active'
       and tm.role = drm.role
      where drm.demo_run_id = p_demo_run_id
        and drm.user_id = (select auth.uid())
        and drm.status = 'active'
        and drm.role = any(p_roles)
    );
$$;

create or replace function public.can_read_run_row(p_demo_run_id uuid, p_owner_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_active_run_member(p_demo_run_id)
    and (
      p_owner_user_id = (select auth.uid())
      or public.is_internal_run_member(
        p_demo_run_id,
        array['check-in-agent', 'site-supervisor', 'icc-operator', 'finance', 'admin']
      )
    );
$$;

create or replace function public.can_mutate_own_run_row(p_demo_run_id uuid, p_owner_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_owner_user_id = (select auth.uid())
    and exists (
      select 1
      from public.demo_run_members drm
      join public.demo_runs dr on dr.id = drm.demo_run_id
      where drm.demo_run_id = p_demo_run_id
        and drm.user_id = (select auth.uid())
        and drm.status = 'active'
        and drm.role = 'visitor'
        and dr.status = 'active'
        and dr.expires_at > now()
    );
$$;

create or replace function public.create_demo_run(p_label text, p_expires_in_minutes integer default 120)
returns public.demo_runs
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_tenant_id uuid := '00000000-0000-4000-8000-000000000001'::uuid;
  v_region_id uuid := '00000000-0000-4000-8000-000000000002'::uuid;
  v_operator_id uuid := '00000000-0000-4000-8000-000000000003'::uuid;
  v_run public.demo_runs;
begin
  if v_user_id is null or public.current_user_is_anonymous() then
    raise exception using errcode = '42501', message = 'Named operator authentication is required';
  end if;
  if not public.has_tenant_role(v_tenant_id, array['admin']) then
    raise exception using errcode = '42501', message = 'Demo administrator membership is required';
  end if;
  if char_length(trim(p_label)) < 2 then
    raise exception using errcode = '22023', message = 'Demo room label is too short';
  end if;

  insert into public.demo_runs (
    tenant_id, region_id, operator_id, owner_user_id, label, expires_at
  ) values (
    v_tenant_id,
    v_region_id,
    v_operator_id,
    v_user_id,
    trim(p_label),
    now() + make_interval(mins => greatest(30, least(p_expires_in_minutes, 240)))
  )
  returning * into v_run;

  insert into public.demo_run_members (demo_run_id, tenant_id, user_id, role)
  values (v_run.id, v_tenant_id, v_user_id, 'admin');

  insert into public.capacity_slots (
    tenant_id, demo_run_id, site_id, slot_date, start_time, end_time, capacity, updated_by
  ) values
    (v_tenant_id, v_run.id, '10000000-0000-4000-8000-000000000001', '2026-08-15', '08:00', '12:00', 24, v_user_id),
    (v_tenant_id, v_run.id, '10000000-0000-4000-8000-000000000002', '2026-08-15', '09:00', '12:00', 30, v_user_id),
    (v_tenant_id, v_run.id, '10000000-0000-4000-8000-000000000003', '2026-08-15', '13:30', '16:30', 36, v_user_id),
    (v_tenant_id, v_run.id, '10000000-0000-4000-8000-000000000004', '2026-08-15', '18:00', '21:00', 50, v_user_id),
    (v_tenant_id, v_run.id, '10000000-0000-4000-8000-000000000005', '2026-08-15', '14:00', '17:00', 28, v_user_id),
    (v_tenant_id, v_run.id, '10000000-0000-4000-8000-000000000006', '2026-08-15', '15:00', '18:00', 20, v_user_id),
    (v_tenant_id, v_run.id, '10000000-0000-4000-8000-000000000007', '2026-08-15', '15:00', '18:00', 24, v_user_id),
    (v_tenant_id, v_run.id, '10000000-0000-4000-8000-000000000008', '2026-08-15', '08:00', '11:00', 18, v_user_id),
    (v_tenant_id, v_run.id, '10000000-0000-4000-8000-000000000009', '2026-08-15', '09:00', '17:00', 42, v_user_id);

  insert into public.audit_events (
    tenant_id, demo_run_id, actor_user_id, actor_kind, action, entity_type, entity_id, metadata
  ) values (
    v_tenant_id, v_run.id, v_user_id, 'user', 'demo.run-created', 'demo_run', v_run.id,
    jsonb_build_object('expiresAt', v_run.expires_at)
  );

  return v_run;
end;
$$;

create or replace function public.issue_demo_join_token(
  p_demo_run_id uuid,
  p_raw_token text,
  p_qr_source_code text,
  p_expires_in_minutes integer default 30
)
returns table(token_id uuid, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_run public.demo_runs;
  v_qr_source_id uuid;
begin
  select * into v_run from public.demo_runs where id = p_demo_run_id for update;
  if v_run.id is null then
    raise exception using errcode = 'P0002', message = 'Demo room was not found';
  end if;
  if v_run.owner_user_id <> v_user_id
     or not public.has_tenant_role(v_run.tenant_id, array['admin']) then
    raise exception using errcode = '42501', message = 'Only the room owner can issue join tokens';
  end if;
  if v_run.status <> 'active' or v_run.expires_at <= now() then
    raise exception using errcode = '22023', message = 'Demo room is not active';
  end if;
  if char_length(p_raw_token) < 32 then
    raise exception using errcode = '22023', message = 'Join token does not meet the entropy requirement';
  end if;

  select id into v_qr_source_id
  from public.qr_sources
  where code = p_qr_source_code;

  if v_qr_source_id is null then
    raise exception using errcode = '22023', message = 'Unknown QR source';
  end if;

  return query
  insert into public.demo_join_tokens (
    demo_run_id, tenant_id, qr_source_id, token_hash, expires_at, created_by
  ) values (
    p_demo_run_id,
    v_run.tenant_id,
    v_qr_source_id,
    encode(extensions.digest(p_raw_token, 'sha256'), 'hex'),
    least(v_run.expires_at, now() + make_interval(mins => greatest(5, least(p_expires_in_minutes, 60)))),
    v_user_id
  )
  returning id, demo_join_tokens.expires_at;
end;
$$;

create or replace function public.join_demo_run(p_raw_token text)
returns table(
  demo_run_id uuid,
  tenant_id uuid,
  qr_source_code text,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_token public.demo_join_tokens;
  v_run public.demo_runs;
begin
  if v_user_id is null or not public.current_user_is_anonymous() then
    raise exception using errcode = '42501', message = 'Anonymous visitor authentication is required';
  end if;

  select * into v_token
  from public.demo_join_tokens
  where token_hash = encode(extensions.digest(p_raw_token, 'sha256'), 'hex')
  for update;

  if v_token.id is null
     or v_token.revoked_at is not null
     or v_token.used_at is not null
     or v_token.expires_at <= now() then
    raise exception using errcode = '22023', message = 'Join token is invalid, expired, or already used';
  end if;

  select * into v_run from public.demo_runs where id = v_token.demo_run_id for update;
  if v_run.status <> 'active' or v_run.expires_at <= now() then
    raise exception using errcode = '22023', message = 'Demo room is expired or read-only';
  end if;

  insert into public.demo_run_members (
    demo_run_id, tenant_id, user_id, campaign_id, qr_source_id, role
  )
  select
    v_run.id, v_run.tenant_id, v_user_id, qs.campaign_id, v_token.qr_source_id, 'visitor'
  from public.qr_sources qs
  where qs.id = v_token.qr_source_id;

  update public.demo_join_tokens
  set used_at = now(), used_by = v_user_id
  where id = v_token.id;

  insert into public.audit_events (
    tenant_id, demo_run_id, actor_user_id, actor_kind, action, entity_type, entity_id, metadata
  ) values (
    v_run.tenant_id, v_run.id, v_user_id, 'user', 'demo.visitor-joined', 'demo_run', v_run.id,
    jsonb_build_object('qrSourceId', v_token.qr_source_id)
  );

  return query
  select v_run.id, v_run.tenant_id, qs.code, v_run.expires_at
  from public.qr_sources qs
  where qs.id = v_token.qr_source_id;
end;
$$;

create or replace function public.reset_demo_run(p_demo_run_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_run public.demo_runs;
begin
  select * into v_run from public.demo_runs where id = p_demo_run_id for update;
  if v_run.id is null then
    raise exception using errcode = 'P0002', message = 'Demo room was not found';
  end if;
  if v_run.owner_user_id <> v_user_id
     or not public.has_tenant_role(v_run.tenant_id, array['admin']) then
    raise exception using errcode = '42501', message = 'Only the authorized room owner can reset this room';
  end if;
  if v_run.status <> 'active' or v_run.expires_at <= now() then
    raise exception using errcode = '22023', message = 'Demo room is expired or read-only';
  end if;

  delete from public.resource_requests where demo_run_id = p_demo_run_id;
  delete from public.incidents where demo_run_id = p_demo_run_id;
  delete from public.redemptions where demo_run_id = p_demo_run_id;
  delete from public.pass_entitlements where demo_run_id = p_demo_run_id;
  delete from public.passes where demo_run_id = p_demo_run_id;
  delete from public.payment_events where demo_run_id = p_demo_run_id;
  delete from public.payment_intents where demo_run_id = p_demo_run_id;
  delete from public.booking_contacts where demo_run_id = p_demo_run_id;
  delete from public.booking_lines where demo_run_id = p_demo_run_id;
  delete from public.bookings where demo_run_id = p_demo_run_id;
  delete from public.quotes where demo_run_id = p_demo_run_id;
  delete from public.itinerary_items where demo_run_id = p_demo_run_id;
  delete from public.itineraries where demo_run_id = p_demo_run_id;
  delete from public.journey_intents where demo_run_id = p_demo_run_id;
  delete from public.analytics_events where demo_run_id = p_demo_run_id;
  delete from public.audit_events where demo_run_id = p_demo_run_id;

  update public.capacity_slots
  set reserved = 0,
      checked_in = 0,
      status = 'available',
      capacity = case
        when site_id = '10000000-0000-4000-8000-000000000001'::uuid then 24
        when site_id = '10000000-0000-4000-8000-000000000002'::uuid then 30
        when site_id = '10000000-0000-4000-8000-000000000003'::uuid then 36
        when site_id = '10000000-0000-4000-8000-000000000004'::uuid then 50
        when site_id = '10000000-0000-4000-8000-000000000005'::uuid then 28
        when site_id = '10000000-0000-4000-8000-000000000006'::uuid then 20
        when site_id = '10000000-0000-4000-8000-000000000007'::uuid then 24
        when site_id = '10000000-0000-4000-8000-000000000008'::uuid then 18
        when site_id = '10000000-0000-4000-8000-000000000009'::uuid then 42
        else 50
      end,
      updated_by = v_user_id,
      updated_at = now()
  where demo_run_id = p_demo_run_id;

  insert into public.audit_events (
    tenant_id, demo_run_id, actor_user_id, actor_kind, action, entity_type, entity_id, metadata
  ) values (
    v_run.tenant_id, v_run.id, v_user_id, 'user', 'demo.state-reset', 'demo_run', v_run.id,
    jsonb_build_object('scope', 'active-run-only')
  );
end;
$$;

create or replace function public.save_generated_journey(
  p_demo_run_id uuid,
  p_locale text,
  p_raw_text text,
  p_structured_intent jsonb,
  p_itinerary jsonb
)
returns table(intent_id uuid, itinerary_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_run public.demo_runs;
  v_intent_id uuid := gen_random_uuid();
  v_itinerary_id uuid := gen_random_uuid();
  v_item record;
  v_site public.sites;
  v_start_at timestamptz;
  v_end_at timestamptz;
  v_previous_end timestamptz;
  v_item_count integer := 0;
begin
  select * into v_run
  from public.demo_runs
  where id = p_demo_run_id
  for update;

  if v_user_id is null
     or v_run.id is null
     or not public.can_mutate_own_run_row(p_demo_run_id, v_user_id) then
    raise exception using errcode = '42501', message = 'An active visitor room membership is required';
  end if;
  if p_locale not in ('vi', 'en')
     or char_length(trim(p_raw_text)) not between 2 and 4000 then
    raise exception using errcode = '22023', message = 'Journey intent is invalid';
  end if;
  if jsonb_typeof(p_structured_intent) <> 'object'
     or coalesce((p_structured_intent->>'durationMinutes')::integer, 0) <= 0
     or jsonb_typeof(p_itinerary->'items') <> 'array'
     or jsonb_array_length(p_itinerary->'items') not between 1 and 8
     or coalesce((p_itinerary->>'totalMinutes')::integer, 0) <= 0
     or coalesce((p_itinerary->>'estimatedPriceVnd')::integer, -1) < 0 then
    raise exception using errcode = '22023', message = 'Generated journey payload is invalid';
  end if;
  if (p_itinerary->>'totalMinutes')::integer >
     (p_structured_intent->>'durationMinutes')::integer then
    raise exception using errcode = '22023', message = 'Itinerary exceeds the confirmed duration';
  end if;

  insert into public.journey_intents (
    id, tenant_id, demo_run_id, created_by, locale, raw_text,
    structured_intent, confirmed_at
  ) values (
    v_intent_id, v_run.tenant_id, v_run.id, v_user_id, p_locale,
    trim(p_raw_text), p_structured_intent, now()
  );

  insert into public.itineraries (
    id, tenant_id, demo_run_id, region_id, intent_id, created_by,
    total_minutes, estimated_price_vnd, validation, explanation
  ) values (
    v_itinerary_id, v_run.tenant_id, v_run.id, v_run.region_id, v_intent_id,
    v_user_id, (p_itinerary->>'totalMinutes')::integer,
    (p_itinerary->>'estimatedPriceVnd')::integer,
    coalesce(p_itinerary->'validation', '{"valid":true,"issues":[]}'::jsonb),
    left(coalesce(p_itinerary->>'explanation', ''), 2000)
  );

  for v_item in
    select *
    from jsonb_to_recordset(p_itinerary->'items') as item(
      "id" text,
      "siteId" text,
      "startAt" text,
      "endAt" text,
      "travelMinutesFromPrevious" integer,
      "reason" text
    )
  loop
    v_item_count := v_item_count + 1;
    begin
      v_start_at := v_item."startAt"::timestamptz;
      v_end_at := v_item."endAt"::timestamptz;
      select * into v_site
      from public.sites
      where id = v_item."siteId"::uuid
        and tenant_id = v_run.tenant_id
        and region_id = v_run.region_id;
    exception when invalid_text_representation then
      raise exception using errcode = '22023', message = 'Itinerary contains an invalid site or timestamp';
    end;

    if v_site.id is null or v_end_at <= v_start_at then
      raise exception using errcode = '22023', message = 'Itinerary contains an unknown site or invalid time';
    end if;
    if v_previous_end is not null and v_start_at < v_previous_end then
      raise exception using errcode = '22023', message = 'Itinerary items overlap';
    end if;
    if not exists (
      select 1
      from jsonb_array_elements(v_site.demo_opening_windows) as opening_window
      where (opening_window->>'day')::integer =
            extract(dow from v_start_at at time zone 'Asia/Ho_Chi_Minh')::integer
        and (v_start_at at time zone 'Asia/Ho_Chi_Minh')::time >=
            (opening_window->>'start')::time
        and (v_end_at at time zone 'Asia/Ho_Chi_Minh')::time <=
            (opening_window->>'end')::time
    ) then
      raise exception using errcode = '22023', message = 'Itinerary item falls outside the configured demo window';
    end if;

    insert into public.itinerary_items (
      id, tenant_id, demo_run_id, itinerary_id, site_id, created_by,
      item_order, start_at, end_at, travel_minutes_from_previous, reason
    ) values (
      case
        when v_item."id" ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
          then v_item."id"::uuid
        else gen_random_uuid()
      end,
      v_run.tenant_id, v_run.id, v_itinerary_id, v_site.id, v_user_id,
      v_item_count - 1, v_start_at, v_end_at,
      greatest(0, coalesce(v_item."travelMinutesFromPrevious", 0)),
      left(coalesce(v_item."reason", ''), 500)
    );
    v_previous_end := v_end_at;
  end loop;

  insert into public.audit_events (
    tenant_id, demo_run_id, actor_user_id, actor_kind, action,
    entity_type, entity_id, metadata
  ) values (
    v_run.tenant_id, v_run.id, v_user_id, 'user', 'itinerary.created',
    'itinerary', v_itinerary_id,
    jsonb_build_object('intentId', v_intent_id, 'itemCount', v_item_count)
  );

  return query select v_intent_id, v_itinerary_id;
end;
$$;

create or replace function public.update_saved_journey(
  p_itinerary_id uuid,
  p_items jsonb,
  p_total_minutes integer,
  p_validation jsonb,
  p_explanation text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_itinerary public.itineraries;
  v_intent public.journey_intents;
  v_run public.demo_runs;
  v_item record;
  v_site public.sites;
  v_start_at timestamptz;
  v_end_at timestamptz;
  v_previous_end timestamptz;
  v_item_count integer := 0;
begin
  select * into v_itinerary
  from public.itineraries
  where id = p_itinerary_id
  for update;
  select * into v_intent
  from public.journey_intents
  where id = v_itinerary.intent_id;
  select * into v_run
  from public.demo_runs
  where id = v_itinerary.demo_run_id;

  if v_itinerary.id is null
     or v_itinerary.created_by <> v_user_id
     or not public.can_mutate_own_run_row(v_itinerary.demo_run_id, v_user_id) then
    raise exception using errcode = '42501', message = 'Journey update is not authorized';
  end if;
  if jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) not between 1 and 8
     or p_total_minutes <= 0
     or p_total_minutes > (v_intent.structured_intent->>'durationMinutes')::integer then
    raise exception using errcode = '22023', message = 'Edited journey payload is invalid';
  end if;

  delete from public.itinerary_items where itinerary_id = p_itinerary_id;

  for v_item in
    select *
    from jsonb_to_recordset(p_items) as item(
      "id" text,
      "siteId" text,
      "startAt" text,
      "endAt" text,
      "travelMinutesFromPrevious" integer,
      "reason" text
    )
  loop
    v_item_count := v_item_count + 1;
    begin
      v_start_at := v_item."startAt"::timestamptz;
      v_end_at := v_item."endAt"::timestamptz;
      select * into v_site
      from public.sites
      where id = v_item."siteId"::uuid
        and tenant_id = v_run.tenant_id
        and region_id = v_run.region_id;
    exception when invalid_text_representation then
      raise exception using errcode = '22023', message = 'Edited journey contains an invalid site or timestamp';
    end;
    if v_site.id is null
       or v_end_at <= v_start_at
       or (v_previous_end is not null and v_start_at < v_previous_end) then
      raise exception using errcode = '22023', message = 'Edited journey contains an unknown site or overlapping time';
    end if;
    if not exists (
      select 1
      from jsonb_array_elements(v_site.demo_opening_windows) as opening_window
      where (opening_window->>'day')::integer =
            extract(dow from v_start_at at time zone 'Asia/Ho_Chi_Minh')::integer
        and (v_start_at at time zone 'Asia/Ho_Chi_Minh')::time >=
            (opening_window->>'start')::time
        and (v_end_at at time zone 'Asia/Ho_Chi_Minh')::time <=
            (opening_window->>'end')::time
    ) then
      raise exception using errcode = '22023', message = 'Edited journey item falls outside the configured demo window';
    end if;

    insert into public.itinerary_items (
      id, tenant_id, demo_run_id, itinerary_id, site_id, created_by,
      item_order, start_at, end_at, travel_minutes_from_previous, reason
    ) values (
      case
        when v_item."id" ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
          then v_item."id"::uuid
        else gen_random_uuid()
      end,
      v_run.tenant_id, v_run.id, p_itinerary_id, v_site.id, v_user_id,
      v_item_count - 1, v_start_at, v_end_at,
      greatest(0, coalesce(v_item."travelMinutesFromPrevious", 0)),
      left(coalesce(v_item."reason", ''), 500)
    );
    v_previous_end := v_end_at;
  end loop;

  update public.itineraries
  set total_minutes = p_total_minutes,
      validation = p_validation,
      explanation = left(p_explanation, 2000),
      version = version + 1,
      updated_at = now()
  where id = p_itinerary_id;

  insert into public.audit_events (
    tenant_id, demo_run_id, actor_user_id, actor_kind, action,
    entity_type, entity_id, metadata
  ) values (
    v_run.tenant_id, v_run.id, v_user_id, 'user', 'itinerary.updated',
    'itinerary', p_itinerary_id,
    jsonb_build_object('itemCount', v_item_count, 'valid', p_validation->'valid')
  );
end;
$$;

create or replace function public.create_server_quote(
  p_demo_run_id uuid,
  p_itinerary_id uuid,
  p_product_selections jsonb,
  p_visit_date date,
  p_party_size integer
)
returns public.quotes
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_run public.demo_runs;
  v_product public.products;
  v_selection record;
  v_slot public.capacity_slots;
  v_subtotal integer := 0;
  v_quote public.quotes;
  v_normalized jsonb := '[]'::jsonb;
begin
  select * into v_run from public.demo_runs where id = p_demo_run_id;
  if v_user_id is null
     or v_run.id is null
     or not public.can_mutate_own_run_row(p_demo_run_id, v_user_id) then
    raise exception using errcode = '42501', message = 'An active visitor room membership is required';
  end if;
  if p_party_size not between 1 and 20
     or p_visit_date < current_date
     or jsonb_typeof(p_product_selections) <> 'array'
     or jsonb_array_length(p_product_selections) not between 1 and 4 then
    raise exception using errcode = '22023', message = 'Quote request is invalid';
  end if;
  if p_itinerary_id is not null and not exists (
    select 1 from public.itineraries i
    where i.id = p_itinerary_id
      and i.demo_run_id = p_demo_run_id
      and i.created_by = v_user_id
      and coalesce((i.validation->>'valid')::boolean, false)
  ) then
    raise exception using errcode = '22023', message = 'A valid owned itinerary is required';
  end if;

  for v_selection in
    select *
    from jsonb_to_recordset(p_product_selections) as selection(
      "productId" text,
      "quantity" integer
    )
  loop
    if v_selection."quantity" not between 1 and 20 then
      raise exception using errcode = '22023', message = 'Product quantity is invalid';
    end if;
    begin
      select * into v_product
      from public.products
      where id = v_selection."productId"::uuid
        and tenant_id = v_run.tenant_id
        and region_id = v_run.region_id
        and active
        and ledger_type = 'service-commerce';
    exception when invalid_text_representation then
      raise exception using errcode = '22023', message = 'Product selection is invalid';
    end;
    if v_product.id is null then
      raise exception using errcode = '22023', message = 'Product is unavailable or outside service-commerce';
    end if;

    for v_slot in
      select cs.*
      from public.product_sites ps
      join public.capacity_slots cs
        on cs.site_id = ps.site_id
       and cs.demo_run_id = p_demo_run_id
       and cs.slot_date = p_visit_date
      where ps.product_id = v_product.id
      order by cs.start_time
    loop
      if v_slot.status <> 'available'
         or v_slot.capacity - v_slot.reserved < p_party_size then
        raise exception using errcode = 'P0001', message = 'CAPACITY_UNAVAILABLE';
      end if;
    end loop;
    if exists (
      select 1
      from public.product_sites ps
      left join public.capacity_slots cs
        on cs.site_id = ps.site_id
       and cs.demo_run_id = p_demo_run_id
       and cs.slot_date = p_visit_date
      where ps.product_id = v_product.id
        and cs.id is null
    ) then
      raise exception using errcode = 'P0001', message = 'CAPACITY_UNAVAILABLE';
    end if;

    v_subtotal := v_subtotal + (v_product.demo_price_vnd * v_selection."quantity");
    v_normalized := v_normalized || jsonb_build_array(jsonb_build_object(
      'productId', v_product.id,
      'quantity', v_selection."quantity",
      'unitPriceVnd', v_product.demo_price_vnd,
      'totalVnd', v_product.demo_price_vnd * v_selection."quantity",
      'ledgerType', v_product.ledger_type
    ));
  end loop;

  insert into public.quotes (
    tenant_id, demo_run_id, created_by, itinerary_id, slot_date, party_size,
    selections, subtotal_vnd, total_vnd, status, expires_at
  ) values (
    v_run.tenant_id, v_run.id, v_user_id, p_itinerary_id, p_visit_date,
    p_party_size, v_normalized, v_subtotal, v_subtotal, 'active',
    least(v_run.expires_at, now() + interval '15 minutes')
  )
  returning * into v_quote;

  insert into public.audit_events (
    tenant_id, demo_run_id, actor_user_id, actor_kind, action,
    entity_type, entity_id, metadata
  ) values (
    v_run.tenant_id, v_run.id, v_user_id, 'user', 'quote.created',
    'quote', v_quote.id,
    jsonb_build_object('partySize', p_party_size, 'totalVnd', v_subtotal)
  );
  return v_quote;
end;
$$;

create or replace function public.create_sandbox_payment_intent(
  p_quote_id uuid,
  p_idempotency_key text,
  p_provider_intent_id text,
  p_callback_secret text
)
returns public.payment_intents
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_quote public.quotes;
  v_payment public.payment_intents;
begin
  select * into v_quote
  from public.quotes
  where id = p_quote_id
  for update;
  if v_quote.id is null
     or v_quote.created_by <> v_user_id
     or not public.can_mutate_own_run_row(v_quote.demo_run_id, v_user_id) then
    raise exception using errcode = '42501', message = 'Quote is not owned by the active visitor';
  end if;

  select * into v_payment
  from public.payment_intents
  where demo_run_id = v_quote.demo_run_id
    and idempotency_key = p_idempotency_key;
  if v_payment.id is not null then
    return v_payment;
  end if;
  if v_quote.status <> 'active' or v_quote.expires_at <= now() then
    raise exception using errcode = '22023', message = 'QUOTE_EXPIRED';
  end if;
  if char_length(p_idempotency_key) not between 16 and 200
     or char_length(p_provider_intent_id) not between 8 and 200
     or char_length(p_callback_secret) < 32 then
    raise exception using errcode = '22023', message = 'Payment intent request is invalid';
  end if;

  insert into public.payment_intents (
    tenant_id, demo_run_id, created_by, quote_id, provider,
    provider_intent_id, callback_secret_hash, mode, status, amount_vnd,
    idempotency_key, expires_at
  ) values (
    v_quote.tenant_id, v_quote.demo_run_id, v_user_id, v_quote.id,
    'destinationos-sandbox', p_provider_intent_id,
    encode(extensions.digest(p_callback_secret, 'sha256'), 'hex'),
    'simulation', 'pending', v_quote.total_vnd, p_idempotency_key,
    v_quote.expires_at
  )
  returning * into v_payment;

  insert into public.audit_events (
    tenant_id, demo_run_id, actor_user_id, actor_kind, action,
    entity_type, entity_id, metadata
  ) values (
    v_quote.tenant_id, v_quote.demo_run_id, v_user_id, 'user',
    'sandbox-payment.intent-created', 'payment_intent', v_payment.id,
    jsonb_build_object('amountVnd', v_quote.total_vnd, 'mode', 'simulation')
  );
  return v_payment;
end;
$$;

create or replace function public.process_sandbox_payment(
  p_payment_intent_id uuid,
  p_provider_event_id text,
  p_event_type text,
  p_callback_secret text,
  p_pass_token text,
  p_customer_display_name text,
  p_contact_kind text,
  p_contact_value text,
  p_consent_at timestamptz
)
returns table(
  booking_id uuid,
  booking_code text,
  pass_id uuid,
  payment_status text,
  was_duplicate boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_payment public.payment_intents;
  v_quote public.quotes;
  v_run public.demo_runs;
  v_member public.demo_run_members;
  v_booking public.bookings;
  v_pass public.passes;
  v_line record;
  v_slot public.capacity_slots;
  v_template record;
  v_site_id uuid;
  v_event_inserted uuid;
  v_new_status text;
begin
  select * into v_payment
  from public.payment_intents
  where id = p_payment_intent_id
  for update;
  if v_payment.id is null
     or v_payment.created_by <> v_user_id
     or not public.can_mutate_own_run_row(v_payment.demo_run_id, v_user_id) then
    raise exception using errcode = '42501', message = 'Payment intent is not owned by the active visitor';
  end if;
  if v_payment.callback_secret_hash <>
     encode(extensions.digest(p_callback_secret, 'sha256'), 'hex') then
    raise exception using errcode = '42501', message = 'Sandbox callback signature is invalid';
  end if;
  if p_event_type not in ('approved', 'declined', 'cancelled')
     or char_length(p_provider_event_id) not between 8 and 200 then
    raise exception using errcode = '22023', message = 'Sandbox callback event is invalid';
  end if;

  select * into v_booking
  from public.bookings
  where demo_run_id = v_payment.demo_run_id
    and idempotency_key = v_payment.idempotency_key;

  insert into public.payment_events (
    tenant_id, demo_run_id, payment_intent_id, provider, provider_event_id,
    event_type, payload_digest, processed_at
  ) values (
    v_payment.tenant_id, v_payment.demo_run_id, v_payment.id,
    v_payment.provider, p_provider_event_id, p_event_type,
    encode(extensions.digest(
      p_provider_event_id || ':' || p_event_type || ':' || v_payment.id::text,
      'sha256'
    ), 'hex'),
    now()
  )
  on conflict (provider, provider_event_id) do nothing
  returning id into v_event_inserted;

  if v_event_inserted is null then
    if v_booking.id is not null then
      select * into v_pass from public.passes where booking_id = v_booking.id;
    end if;
    return query
    select v_booking.id, v_booking.code, v_pass.id, v_payment.status, true;
    return;
  end if;

  v_new_status := case
    when v_payment.status = 'succeeded' then 'succeeded'
    when p_event_type = 'approved' then 'succeeded'
    when p_event_type = 'declined' then 'failed'
    else 'cancelled'
  end;

  if p_event_type <> 'approved' or v_payment.status = 'succeeded' then
    update public.payment_intents
    set status = v_new_status, updated_at = now()
    where id = v_payment.id;
    insert into public.audit_events (
      tenant_id, demo_run_id, actor_user_id, actor_kind, action,
      entity_type, entity_id, metadata
    ) values (
      v_payment.tenant_id, v_payment.demo_run_id, v_user_id, 'system',
      'sandbox-payment.' || p_event_type, 'payment_intent', v_payment.id,
      jsonb_build_object('providerEventId', p_provider_event_id)
    );
    if v_booking.id is not null then
      select * into v_pass from public.passes where booking_id = v_booking.id;
    end if;
    return query
    select v_booking.id, v_booking.code, v_pass.id, v_new_status, false;
    return;
  end if;

  select * into v_quote
  from public.quotes
  where id = v_payment.quote_id
  for update;
  select * into v_run
  from public.demo_runs
  where id = v_payment.demo_run_id
  for update;
  select * into v_member
  from public.demo_run_members
  where demo_run_id = v_run.id and user_id = v_user_id;

  if v_booking.id is not null then
    select * into v_pass from public.passes where booking_id = v_booking.id;
    update public.payment_intents
    set status = 'succeeded', booking_id = v_booking.id, updated_at = now()
    where id = v_payment.id;
    return query
    select v_booking.id, v_booking.code, v_pass.id, 'succeeded'::text, true;
    return;
  end if;
  if v_quote.status <> 'active'
     or v_quote.expires_at <= now()
     or v_run.status <> 'active'
     or v_run.expires_at <= now()
     or v_payment.expires_at <= now() then
    raise exception using errcode = '22023', message = 'QUOTE_EXPIRED';
  end if;
  if p_contact_kind not in ('email', 'phone')
     or char_length(trim(p_customer_display_name)) not between 2 and 80
     or char_length(trim(p_contact_value)) not between 5 and 160
     or p_consent_at is null
     or char_length(p_pass_token) < 32 then
    raise exception using errcode = '22023', message = 'Checkout details are invalid';
  end if;

  for v_slot in
    select cs.*
    from public.capacity_slots cs
    where cs.demo_run_id = v_quote.demo_run_id
      and cs.slot_date = v_quote.slot_date
      and cs.site_id in (
        select ps.site_id
        from jsonb_to_recordset(v_quote.selections) as selection(
          "productId" text,
          "quantity" integer,
          "unitPriceVnd" integer,
          "totalVnd" integer,
          "ledgerType" text
        )
        join public.product_sites ps
          on ps.product_id = selection."productId"::uuid
      )
    order by cs.site_id, cs.start_time
    for update
  loop
    if v_slot.status <> 'available'
       or v_slot.capacity - v_slot.reserved < v_quote.party_size then
      raise exception using errcode = 'P0001', message = 'CAPACITY_UNAVAILABLE';
    end if;
    update public.capacity_slots
    set reserved = reserved + v_quote.party_size,
        updated_by = v_user_id,
        updated_at = now()
    where id = v_slot.id;
  end loop;

  insert into public.bookings (
    tenant_id, demo_run_id, region_id, operator_id, created_by, quote_id,
    itinerary_id, campaign_id, qr_source_id, code, status, visit_date,
    customer_display_name, masked_contact, party_size, subtotal_vnd,
    total_vnd, idempotency_key
  ) values (
    v_quote.tenant_id, v_quote.demo_run_id, v_run.region_id, v_run.operator_id,
    v_user_id, v_quote.id, v_quote.itinerary_id, v_member.campaign_id,
    v_member.qr_source_id,
    'NBJ-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
    'confirmed', v_quote.slot_date, trim(p_customer_display_name),
    case
      when p_contact_kind = 'email' then
        left(trim(p_contact_value), 1) || '***@' || split_part(trim(p_contact_value), '@', 2)
      else '***' || right(regexp_replace(p_contact_value, '\D', '', 'g'), 4)
    end,
    v_quote.party_size, v_quote.subtotal_vnd, v_quote.total_vnd,
    v_payment.idempotency_key
  )
  returning * into v_booking;

  insert into public.booking_contacts (
    booking_id, tenant_id, demo_run_id, created_by, contact_kind,
    contact_value, consent_at
  ) values (
    v_booking.id, v_booking.tenant_id, v_booking.demo_run_id, v_user_id,
    p_contact_kind, trim(p_contact_value), p_consent_at
  );

  for v_line in
    select *
    from jsonb_to_recordset(v_quote.selections) as line(
      "productId" text,
      "quantity" integer,
      "unitPriceVnd" integer,
      "totalVnd" integer,
      "ledgerType" text
    )
  loop
    insert into public.booking_lines (
      tenant_id, demo_run_id, booking_id, product_id, quantity,
      unit_price_vnd, total_vnd, ledger_type
    ) values (
      v_booking.tenant_id, v_booking.demo_run_id, v_booking.id,
      v_line."productId"::uuid, v_line."quantity",
      v_line."unitPriceVnd", v_line."totalVnd", v_line."ledgerType"
    );
  end loop;

  insert into public.passes (
    tenant_id, demo_run_id, booking_id, created_by, token_hash, token_hint,
    status, expires_at
  ) values (
    v_booking.tenant_id, v_booking.demo_run_id, v_booking.id, v_user_id,
    encode(extensions.digest(p_pass_token, 'sha256'), 'hex'),
    right(p_pass_token, 6), 'active',
    (v_booking.visit_date + 1)::timestamptz
  )
  returning * into v_pass;

  for v_line in
    select *
    from jsonb_to_recordset(v_quote.selections) as line(
      "productId" text,
      "quantity" integer,
      "unitPriceVnd" integer,
      "totalVnd" integer,
      "ledgerType" text
    )
  loop
    for v_template in
      select *
      from jsonb_to_recordset(
        (select entitlement_templates from public.products where id = v_line."productId"::uuid)
      ) as template("siteSlug" text, "quantity" integer)
    loop
      select id into v_site_id
      from public.sites
      where tenant_id = v_booking.tenant_id
        and slug = v_template."siteSlug";
      if v_site_id is null then
        raise exception using errcode = '22023', message = 'Entitlement site is not configured';
      end if;
      insert into public.pass_entitlements (
        tenant_id, demo_run_id, pass_id, site_id, product_id, quantity
      ) values (
        v_booking.tenant_id, v_booking.demo_run_id, v_pass.id, v_site_id,
        v_line."productId"::uuid,
        v_template."quantity" * v_line."quantity"
      );
    end loop;
  end loop;

  update public.payment_intents
  set status = 'succeeded', booking_id = v_booking.id, updated_at = now()
  where id = v_payment.id;
  update public.quotes set status = 'consumed' where id = v_quote.id;

  insert into public.audit_events (
    tenant_id, demo_run_id, actor_user_id, actor_kind, action,
    entity_type, entity_id, metadata
  ) values
    (
      v_booking.tenant_id, v_booking.demo_run_id, v_user_id, 'system',
      'sandbox-payment.approved', 'payment_intent', v_payment.id,
      jsonb_build_object('providerEventId', p_provider_event_id)
    ),
    (
      v_booking.tenant_id, v_booking.demo_run_id, v_user_id, 'user',
      'booking.created', 'booking', v_booking.id,
      jsonb_build_object('totalVnd', v_booking.total_vnd, 'partySize', v_booking.party_size)
    ),
    (
      v_booking.tenant_id, v_booking.demo_run_id, v_user_id, 'system',
      'pass.issued', 'pass', v_pass.id,
      jsonb_build_object('bookingId', v_booking.id)
    );

  insert into public.analytics_events (
    tenant_id, demo_run_id, actor_user_id, event_type, campaign_id,
    qr_source_id, entity_type, entity_id, metadata
  ) values (
    v_booking.tenant_id, v_booking.demo_run_id, v_user_id, 'booking.created',
    v_booking.campaign_id, v_booking.qr_source_id, 'booking', v_booking.id,
    jsonb_build_object('partySize', v_booking.party_size, 'ledgerType', 'service-commerce')
  );

  return query
  select v_booking.id, v_booking.code, v_pass.id, 'succeeded'::text, false;
end;
$$;

create or replace function public.get_pass_snapshot(p_raw_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_pass public.passes;
  v_booking public.bookings;
  v_entitlements jsonb;
begin
  if char_length(p_raw_token) < 32 then
    return null;
  end if;
  select * into v_pass
  from public.passes
  where token_hash = encode(extensions.digest(p_raw_token, 'sha256'), 'hex');
  if v_pass.id is null then
    return null;
  end if;
  select * into v_booking
  from public.bookings
  where id = v_pass.booking_id;
  if not public.can_read_run_row(v_pass.demo_run_id, v_pass.created_by) then
    raise exception using errcode = '42501', message = 'Pass is not visible to the active room member';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', pe.id,
    'siteId', pe.site_id,
    'siteName', s.name,
    'productId', pe.product_id,
    'quantity', pe.quantity,
    'redeemedQuantity', pe.redeemed_quantity
  ) order by s.name), '[]'::jsonb)
  into v_entitlements
  from public.pass_entitlements pe
  join public.sites s on s.id = pe.site_id
  where pe.pass_id = v_pass.id;

  return jsonb_build_object(
    'pass', jsonb_build_object(
      'id', v_pass.id,
      'demoRunId', v_pass.demo_run_id,
      'bookingId', v_pass.booking_id,
      'tokenHint', v_pass.token_hint,
      'status', v_pass.status,
      'issuedAt', v_pass.issued_at,
      'expiresAt', v_pass.expires_at,
      'entitlements', v_entitlements
    ),
    'booking', jsonb_build_object(
      'id', v_booking.id,
      'demoRunId', v_booking.demo_run_id,
      'code', v_booking.code,
      'status', v_booking.status,
      'visitDate', v_booking.visit_date,
      'customerDisplayName', v_booking.customer_display_name,
      'maskedContact', v_booking.masked_contact,
      'partySize', v_booking.party_size,
      'totalVnd', v_booking.total_vnd,
      'currency', v_booking.currency,
      'campaignId', v_booking.campaign_id,
      'qrSourceId', v_booking.qr_source_id,
      'createdAt', v_booking.created_at
    )
  );
end;
$$;

create or replace function public.redeem_pass_entitlement(
  p_lookup_value text,
  p_lookup_kind text,
  p_site_id uuid,
  p_entitlement_id uuid,
  p_quantity integer,
  p_idempotency_key text
)
returns table(
  ok boolean,
  code text,
  redemption_id uuid,
  pass_id uuid,
  entitlement_id uuid,
  booking_code text,
  redeemed_at timestamptz,
  original_actor_user_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_pass public.passes;
  v_booking public.bookings;
  v_entitlement public.pass_entitlements;
  v_redemption public.redemptions;
  v_remaining integer;
  v_all_redeemed boolean;
begin
  if p_lookup_kind = 'pass-token' then
    select * into v_pass
    from public.passes
    where token_hash = encode(extensions.digest(p_lookup_value, 'sha256'), 'hex')
    for update;
  elsif p_lookup_kind = 'booking-code' then
    select p.* into v_pass
    from public.passes p
    join public.bookings b on b.id = p.booking_id
    where b.code = upper(trim(p_lookup_value))
    for update of p;
  else
    return query select false, 'UNKNOWN'::text, null::uuid, null::uuid,
      null::uuid, null::text, null::timestamptz, null::uuid;
    return;
  end if;

  if v_pass.id is null then
    return query select false, 'UNKNOWN'::text, null::uuid, null::uuid,
      null::uuid, null::text, null::timestamptz, null::uuid;
    return;
  end if;
  select * into v_booking from public.bookings where id = v_pass.booking_id for update;
  if not public.is_internal_run_member(
    v_pass.demo_run_id,
    array['check-in-agent','site-supervisor','icc-operator','admin']
  ) then
    raise exception using errcode = '42501', message = 'This operator cannot redeem passes';
  end if;

  select * into v_redemption
  from public.redemptions
  where demo_run_id = v_pass.demo_run_id
    and idempotency_key = p_idempotency_key;
  if v_redemption.id is not null then
    return query select false, 'ALREADY_REDEEMED'::text, v_redemption.id,
      v_redemption.pass_id, v_redemption.entitlement_id, v_booking.code,
      v_redemption.created_at, v_redemption.actor_user_id;
    return;
  end if;
  if v_pass.status = 'expired' or v_pass.expires_at <= now() then
    return query select false, 'EXPIRED'::text, null::uuid, v_pass.id,
      null::uuid, v_booking.code, null::timestamptz, null::uuid;
    return;
  end if;
  if v_pass.status = 'cancelled' or v_booking.status = 'cancelled' then
    return query select false, 'CANCELLED'::text, null::uuid, v_pass.id,
      null::uuid, v_booking.code, null::timestamptz, null::uuid;
    return;
  end if;

  if p_entitlement_id is not null then
    select * into v_entitlement
    from public.pass_entitlements
    where id = p_entitlement_id and pass_id = v_pass.id
    for update;
  else
    select * into v_entitlement
    from public.pass_entitlements
    where pass_id = v_pass.id
      and (p_site_id is null or site_id = p_site_id)
      and redeemed_quantity < quantity
    order by id
    limit 1
    for update;
  end if;

  if v_entitlement.id is null
     or (p_site_id is not null and v_entitlement.site_id <> p_site_id) then
    return query select false, 'NO_ENTITLEMENT'::text, null::uuid, v_pass.id,
      null::uuid, v_booking.code, null::timestamptz, null::uuid;
    return;
  end if;
  v_remaining := v_entitlement.quantity - v_entitlement.redeemed_quantity;
  if p_quantity <= 0 or p_quantity > v_remaining then
    return query select false, 'NO_ENTITLEMENT'::text, null::uuid, v_pass.id,
      v_entitlement.id, v_booking.code, null::timestamptz, null::uuid;
    return;
  end if;

  insert into public.redemptions (
    tenant_id, demo_run_id, pass_id, entitlement_id, site_id, quantity,
    actor_user_id, idempotency_key
  ) values (
    v_pass.tenant_id, v_pass.demo_run_id, v_pass.id, v_entitlement.id,
    v_entitlement.site_id, p_quantity, v_user_id, p_idempotency_key
  )
  returning * into v_redemption;

  update public.pass_entitlements
  set redeemed_quantity = redeemed_quantity + p_quantity
  where id = v_entitlement.id;

  select not exists (
    select 1 from public.pass_entitlements
    where pass_id = v_pass.id and redeemed_quantity < quantity
  ) into v_all_redeemed;

  update public.passes
  set status = case when v_all_redeemed then 'used' else 'partially-used' end
  where id = v_pass.id;
  update public.bookings
  set status = case when v_all_redeemed then 'used' else 'partially-used' end,
      updated_at = now()
  where id = v_booking.id;
  update public.capacity_slots
  set checked_in = checked_in + p_quantity,
      updated_by = v_user_id,
      updated_at = now()
  where demo_run_id = v_pass.demo_run_id
    and site_id = v_entitlement.site_id
    and slot_date = v_booking.visit_date
    and checked_in + p_quantity <= reserved;
  if not found then
    raise exception using errcode = '23514', message = 'Capacity check-in state is inconsistent';
  end if;

  insert into public.audit_events (
    tenant_id, demo_run_id, actor_user_id, actor_kind, action,
    entity_type, entity_id, metadata
  ) values (
    v_pass.tenant_id, v_pass.demo_run_id, v_user_id, 'user',
    'pass.redeemed', 'redemption', v_redemption.id,
    jsonb_build_object(
      'passId', v_pass.id,
      'entitlementId', v_entitlement.id,
      'siteId', v_entitlement.site_id,
      'quantity', p_quantity
    )
  );

  return query select true, 'REDEEMED'::text, v_redemption.id, v_pass.id,
    v_entitlement.id, v_booking.code, v_redemption.created_at, v_user_id;
end;
$$;

create or replace function public.set_capacity_slot(
  p_slot_id uuid,
  p_capacity integer,
  p_status text
)
returns public.capacity_slots
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_slot public.capacity_slots;
  v_before jsonb;
begin
  select * into v_slot
  from public.capacity_slots
  where id = p_slot_id
  for update;
  if v_slot.id is null then
    raise exception using errcode = 'P0002', message = 'Capacity slot was not found';
  end if;
  if not public.is_internal_run_member(
    v_slot.demo_run_id,
    array['site-supervisor','icc-operator','admin']
  ) then
    raise exception using errcode = '42501', message = 'This operator cannot change capacity';
  end if;
  if p_capacity < v_slot.reserved or p_capacity > 10000
     or p_status not in ('available','paused','closed') then
    raise exception using errcode = '22023', message = 'Capacity cannot fall below reservations and status must be valid';
  end if;
  v_before := jsonb_build_object(
    'capacity', v_slot.capacity,
    'status', v_slot.status,
    'reserved', v_slot.reserved
  );
  update public.capacity_slots
  set capacity = p_capacity,
      status = p_status,
      updated_by = v_user_id,
      updated_at = now()
  where id = p_slot_id
  returning * into v_slot;

  insert into public.audit_events (
    tenant_id, demo_run_id, actor_user_id, actor_kind, action,
    entity_type, entity_id, metadata
  ) values (
    v_slot.tenant_id, v_slot.demo_run_id, v_user_id, 'user',
    'capacity.updated', 'capacity_slot', v_slot.id,
    jsonb_build_object(
      'before', v_before,
      'after', jsonb_build_object('capacity', p_capacity, 'status', p_status)
    )
  );
  return v_slot;
end;
$$;

create or replace function public.inspect_pass_access(
  p_lookup_value text,
  p_lookup_kind text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_pass public.passes;
  v_booking public.bookings;
  v_entitlements jsonb;
  v_code text;
begin
  if p_lookup_kind = 'pass-token' then
    select * into v_pass
    from public.passes
    where token_hash = encode(extensions.digest(p_lookup_value, 'sha256'), 'hex');
  elsif p_lookup_kind = 'booking-code' then
    select p.* into v_pass
    from public.passes p
    join public.bookings b on b.id = p.booking_id
    where b.code = upper(trim(p_lookup_value));
  end if;
  if v_pass.id is null then
    return jsonb_build_object('ok', false, 'code', 'UNKNOWN');
  end if;
  if not public.is_internal_run_member(
    v_pass.demo_run_id,
    array['check-in-agent','site-supervisor','icc-operator','admin']
  ) then
    raise exception using errcode = '42501', message = 'This operator cannot inspect passes';
  end if;
  select * into v_booking from public.bookings where id = v_pass.booking_id;
  v_code := case
    when v_pass.status = 'expired' or v_pass.expires_at <= now() then 'EXPIRED'
    when v_pass.status = 'cancelled' or v_booking.status = 'cancelled' then 'CANCELLED'
    when v_pass.status = 'used' then 'ALREADY_REDEEMED'
    else 'VALID'
  end;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', pe.id,
    'siteId', pe.site_id,
    'siteName', s.name,
    'quantity', pe.quantity,
    'redeemedQuantity', pe.redeemed_quantity,
    'remaining', pe.quantity - pe.redeemed_quantity
  ) order by s.name), '[]'::jsonb)
  into v_entitlements
  from public.pass_entitlements pe
  join public.sites s on s.id = pe.site_id
  where pe.pass_id = v_pass.id;
  return jsonb_build_object(
    'ok', v_code = 'VALID',
    'code', v_code,
    'passId', v_pass.id,
    'passStatus', v_pass.status,
    'bookingCode', v_booking.code,
    'partySize', v_booking.party_size,
    'entitlements', v_entitlements
  );
end;
$$;

create or replace function public.confirm_incident_draft(
  p_demo_run_id uuid,
  p_draft jsonb
)
returns public.incidents
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_run public.demo_runs;
  v_incident public.incidents;
  v_site public.sites;
  v_sop public.sops;
  v_severity text := p_draft->>'suggestedSeverity';
  v_category text := p_draft->>'category';
begin
  select * into v_run
  from public.demo_runs
  where id = p_demo_run_id
  for update;
  if v_run.id is null
     or v_run.status <> 'active'
     or not public.is_internal_run_member(
       p_demo_run_id,
       array['check-in-agent','site-supervisor','icc-operator','admin']
     ) then
    raise exception using errcode = '42501', message = 'This operator cannot confirm incident drafts';
  end if;
  if v_severity in ('P1','P2') and not public.is_internal_run_member(
    p_demo_run_id,
    array['site-supervisor','icc-operator','admin']
  ) then
    raise exception using errcode = '42501', message = 'P1/P2 confirmation requires supervisor or ICC authority';
  end if;
  if coalesce((p_draft->>'humanConfirmationRequired')::boolean, false) is not true
     or char_length(trim(p_draft->>'transcript')) not between 2 and 4000
     or v_severity not in ('P1','P2','P3','P4')
     or v_category not in (
       'crowd-capacity','weather','medical','transport','water-safety',
       'fire-safety','infrastructure','security','lost-person','other'
     ) then
    raise exception using errcode = '22023', message = 'Incident draft is incomplete or invalid';
  end if;

  begin
    select * into v_site
    from public.sites
    where id = (p_draft->>'siteId')::uuid
      and tenant_id = v_run.tenant_id
      and region_id = v_run.region_id;
    if p_draft->>'sopId' is not null then
      select * into v_sop
      from public.sops
      where id = (p_draft->>'sopId')::uuid
        and tenant_id = v_run.tenant_id;
    end if;
  exception when invalid_text_representation then
    raise exception using errcode = '22023', message = 'Incident site or SOP is invalid';
  end;
  if v_site.id is null then
    raise exception using errcode = '22023', message = 'Incident requires a configured site';
  end if;

  insert into public.incidents (
    tenant_id, demo_run_id, region_id, site_id, category, severity, status,
    transcript, summary, wait_time_minutes, sop_id, created_by, confirmed_by
  ) values (
    v_run.tenant_id, v_run.id, v_run.region_id, v_site.id, v_category,
    v_severity, 'open', trim(p_draft->>'transcript'),
    left(coalesce(nullif(trim(p_draft->>'notes'), ''), trim(p_draft->>'transcript')), 500),
    case
      when p_draft->>'waitTimeMinutes' is null then null
      else greatest(0, (p_draft->>'waitTimeMinutes')::integer)
    end,
    v_sop.id, v_user_id, v_user_id
  )
  returning * into v_incident;

  if p_draft->'resourceRequest' is not null then
    insert into public.resource_requests (
      tenant_id, demo_run_id, incident_id, resource_type, quantity, requested_by
    ) values (
      v_run.tenant_id, v_run.id, v_incident.id,
      left(p_draft->'resourceRequest'->>'resourceType', 120),
      greatest(1, least(1000, (p_draft->'resourceRequest'->>'quantity')::integer)),
      v_user_id
    );
  end if;

  insert into public.audit_events (
    tenant_id, demo_run_id, actor_user_id, actor_kind, action,
    entity_type, entity_id, metadata
  ) values
    (
      v_run.tenant_id, v_run.id, v_user_id, 'user',
      'incident.draft-created', 'incident', v_incident.id,
      jsonb_build_object('humanConfirmationRequired', true)
    ),
    (
      v_run.tenant_id, v_run.id, v_user_id, 'user',
      'incident.confirmed', 'incident', v_incident.id,
      jsonb_build_object('severity', v_severity, 'sopId', v_sop.id)
    );
  return v_incident;
end;
$$;

create or replace function public.update_incident_coordination(
  p_incident_id uuid,
  p_status text,
  p_assigned_to uuid,
  p_resource_status text
)
returns public.incidents
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_incident public.incidents;
  v_before jsonb;
begin
  select * into v_incident
  from public.incidents
  where id = p_incident_id
  for update;
  if v_incident.id is null then
    raise exception using errcode = 'P0002', message = 'Incident was not found';
  end if;
  if not public.is_internal_run_member(
    v_incident.demo_run_id,
    array['site-supervisor','icc-operator','admin']
  ) then
    raise exception using errcode = '42501', message = 'This operator cannot coordinate incidents';
  end if;
  if p_status not in ('open','acknowledged','in-progress','resolved','closed')
     or (
       p_resource_status is not null
       and p_resource_status not in ('requested','assigned','fulfilled','cancelled')
     ) then
    raise exception using errcode = '22023', message = 'Incident or resource status is invalid';
  end if;
  if p_assigned_to is not null and not exists (
    select 1 from public.demo_run_members
    where demo_run_id = v_incident.demo_run_id
      and user_id = p_assigned_to
      and status = 'active'
      and role in ('check-in-agent','site-supervisor','icc-operator','admin')
  ) then
    raise exception using errcode = '22023', message = 'Assignee is not an active room operator';
  end if;
  v_before := jsonb_build_object(
    'status', v_incident.status,
    'assignedTo', v_incident.assigned_to
  );
  update public.incidents
  set status = p_status,
      assigned_to = p_assigned_to,
      updated_at = now()
  where id = p_incident_id
  returning * into v_incident;
  if p_resource_status is not null then
    update public.resource_requests
    set status = p_resource_status,
        assigned_to = p_assigned_to,
        updated_at = now()
    where incident_id = p_incident_id;
  end if;
  insert into public.audit_events (
    tenant_id, demo_run_id, actor_user_id, actor_kind, action,
    entity_type, entity_id, metadata
  ) values (
    v_incident.tenant_id, v_incident.demo_run_id, v_user_id, 'user',
    'incident.coordination-updated', 'incident', v_incident.id,
    jsonb_build_object(
      'before', v_before,
      'after', jsonb_build_object(
        'status', p_status,
        'assignedTo', p_assigned_to,
        'resourceStatus', p_resource_status
      )
    )
  );
  return v_incident;
end;
$$;

revoke all on function public.create_demo_run(text, integer) from public, anon;
revoke all on function public.issue_demo_join_token(uuid, text, text, integer) from public, anon;
revoke all on function public.join_demo_run(text) from public, anon;
revoke all on function public.reset_demo_run(uuid) from public, anon;
revoke all on function public.save_generated_journey(uuid, text, text, jsonb, jsonb) from public, anon;
revoke all on function public.update_saved_journey(uuid, jsonb, integer, jsonb, text) from public, anon;
revoke all on function public.create_server_quote(uuid, uuid, jsonb, date, integer) from public, anon;
revoke all on function public.create_sandbox_payment_intent(uuid, text, text, text) from public, anon;
revoke all on function public.process_sandbox_payment(uuid, text, text, text, text, text, text, text, timestamptz) from public, anon;
revoke all on function public.get_pass_snapshot(text) from public, anon;
revoke all on function public.redeem_pass_entitlement(text, text, uuid, uuid, integer, text) from public, anon;
revoke all on function public.set_capacity_slot(uuid, integer, text) from public, anon;
revoke all on function public.inspect_pass_access(text, text) from public, anon;
revoke all on function public.confirm_incident_draft(uuid, jsonb) from public, anon;
revoke all on function public.update_incident_coordination(uuid, text, uuid, text) from public, anon;
grant execute on function public.create_demo_run(text, integer) to authenticated;
grant execute on function public.issue_demo_join_token(uuid, text, text, integer) to authenticated;
grant execute on function public.join_demo_run(text) to authenticated;
grant execute on function public.reset_demo_run(uuid) to authenticated;
grant execute on function public.save_generated_journey(uuid, text, text, jsonb, jsonb) to authenticated;
grant execute on function public.update_saved_journey(uuid, jsonb, integer, jsonb, text) to authenticated;
grant execute on function public.create_server_quote(uuid, uuid, jsonb, date, integer) to authenticated;
grant execute on function public.create_sandbox_payment_intent(uuid, text, text, text) to authenticated;
grant execute on function public.process_sandbox_payment(uuid, text, text, text, text, text, text, text, timestamptz) to authenticated;
grant execute on function public.get_pass_snapshot(text) to authenticated;
grant execute on function public.redeem_pass_entitlement(text, text, uuid, uuid, integer, text) to authenticated;
grant execute on function public.set_capacity_slot(uuid, integer, text) to authenticated;
grant execute on function public.inspect_pass_access(text, text) to authenticated;
grant execute on function public.confirm_incident_draft(uuid, jsonb) to authenticated;
grant execute on function public.update_incident_coordination(uuid, text, uuid, text) to authenticated;

insert into public.tenants (id, name, slug, status)
values ('00000000-0000-4000-8000-000000000001', 'DestinationOS Demonstration', 'destinationos-demo', 'active')
on conflict (id) do update set name = excluded.name, status = excluded.status;

insert into public.regions (id, tenant_id, name, slug, scope_type, map_bounds, default_locale)
values (
  '00000000-0000-4000-8000-000000000002',
  '00000000-0000-4000-8000-000000000001',
  'Ninh Bình',
  'ninh-binh-demo',
  'tourism-core',
  '[[19.95,105.72],[20.45,106.12]]'::jsonb,
  'vi'
)
on conflict (id) do update set map_bounds = excluded.map_bounds, scope_type = excluded.scope_type;

insert into public.operators (id, tenant_id, name, slug, operator_type)
values (
  '00000000-0000-4000-8000-000000000003',
  '00000000-0000-4000-8000-000000000001',
  'Ninh Bình Journey Demo Operator',
  'primary-demo',
  'destination-operator'
)
on conflict (id) do update set name = excluded.name;

insert into public.sites (
  id, tenant_id, region_id, operator_id, name, slug, latitude, longitude, tags,
  mobility_level, suggested_minutes, demo_opening_windows, content_source_ids, source_url, source_reviewed_at
) values
  (
    '10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000003',
    'Tràng An', 'trang-an', 20.2503, 105.8970, array['heritage','nature','family'],
    'low', 180, '[{"day":6,"start":"07:00","end":"17:00"}]'::jsonb,
    array['directive-seed'], 'https://whc.unesco.org/en/list/1438/', '2026-07-24'
  ),
  (
    '10000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000003',
    'Cố đô Hoa Lư', 'hoa-lu-ancient-capital', 20.2845, 105.9082, array['heritage','culture','family'],
    'low', 90, '[{"day":6,"start":"08:00","end":"17:00"}]'::jsonb,
    array['directive-seed'], null, '2026-07-24'
  ),
  (
    '10000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000003',
    'Chùa Bái Đính', 'bai-dinh', 20.2768, 105.8656, array['spirituality','culture','family'],
    'moderate', 150, '[{"day":6,"start":"08:00","end":"18:00"}]'::jsonb,
    array['directive-seed'], null, '2026-07-24'
  ),
  (
    '10000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000003',
    'Phố cổ Hoa Lư', 'hoa-lu-old-town', 20.2579, 105.9741, array['food','culture','family'],
    'low', 90, '[{"day":6,"start":"18:00","end":"22:00"}]'::jsonb,
    array['directive-seed'], null, '2026-07-24'
  ),
  (
    '10000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000003',
    'Tam Cốc – Bích Động', 'tam-coc-bich-dong', 20.2169, 105.9368, array['nature','photography','family'],
    'low', 150, '[{"day":6,"start":"07:00","end":"17:00"}]'::jsonb,
    array['directive-seed'], null, '2026-07-24'
  ),
  (
    '10000000-0000-4000-8000-000000000006', '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000003',
    'Hang Múa', 'hang-mua', 20.2290, 105.9361, array['nature','photography'],
    'high', 120, '[{"day":6,"start":"07:00","end":"18:00"}]'::jsonb,
    array['directive-seed'], null, '2026-07-24'
  ),
  (
    '10000000-0000-4000-8000-000000000007', '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000003',
    'Thung Nham', 'thung-nham', 20.2136, 105.9027, array['nature','photography','family'],
    'moderate', 150, '[{"day":6,"start":"08:00","end":"18:00"}]'::jsonb,
    array['directive-seed'], null, '2026-07-24'
  ),
  (
    '10000000-0000-4000-8000-000000000008', '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000003',
    'Vân Long', 'van-long', 20.3636, 105.8773, array['nature','photography','family'],
    'low', 120, '[{"day":6,"start":"07:00","end":"17:00"}]'::jsonb,
    array['directive-seed'], null, '2026-07-24'
  ),
  (
    '10000000-0000-4000-8000-000000000009', '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000003',
    'Tam Chúc', 'tam-chuc', 20.5736, 105.9220, array['spirituality','culture','family'],
    'moderate', 180, '[{"day":6,"start":"07:00","end":"18:00"}]'::jsonb,
    array['directive-seed'], null, '2026-07-27'
  )
on conflict (id) do update
set name = excluded.name,
    latitude = excluded.latitude,
    longitude = excluded.longitude,
    tags = excluded.tags,
    mobility_level = excluded.mobility_level,
    suggested_minutes = excluded.suggested_minutes;

insert into public.campaigns (id, tenant_id, region_id, name, slug, campaign_type, status) values
  ('20000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', 'On-site QR', 'on-site-qr', 'qr', 'live-demo'),
  ('20000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', 'Hospitality welcome', 'hospitality', 'qr', 'live-demo'),
  ('20000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', 'Airport gateway concept', 'airport-concept', 'concept-collaboration', 'concept')
on conflict (id) do update set name = excluded.name, status = excluded.status;

insert into public.qr_sources (id, tenant_id, region_id, campaign_id, site_id, code, placement_label) values
  ('30000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000003', 'BAIDINH-GATE-DEMO', 'Bái Đính welcome point'),
  ('30000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'TRANGAN-WHARF-DEMO', 'Tràng An wharf'),
  ('30000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', null, 'HOTEL-LOBBY-DEMO', 'Partner hotel lobby'),
  ('30000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000003', null, 'AIRPORT-CONCEPT-DEMO', 'Airport gateway concept')
on conflict (id) do update set placement_label = excluded.placement_label, campaign_id = excluded.campaign_id;

insert into public.products (
  id, tenant_id, region_id, name, slug, product_type, ledger_type,
  demo_price_vnd, duration_minutes, entitlement_templates
) values
  ('40000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', 'Di sản trong một ngày', 'heritage-day', 'package', 'service-commerce', 890000, 600, '[{"siteSlug":"trang-an","quantity":1},{"siteSlug":"hoa-lu-ancient-capital","quantity":1}]'),
  ('40000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', 'Nhịp chậm Ninh Bình', 'slow-ninh-binh', 'package', 'service-commerce', 790000, 540, '[{"siteSlug":"trang-an","quantity":1},{"siteSlug":"hoa-lu-old-town","quantity":1}]'),
  ('40000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', 'Gia đình khám phá', 'family-discovery', 'package', 'service-commerce', 1090000, 600, '[{"siteSlug":"trang-an","quantity":1},{"siteSlug":"bai-dinh","quantity":1}]'),
  ('40000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', 'Cinematic Ninh Bình', 'cinematic-sunset', 'package', 'service-commerce', 1290000, 420, '[{"siteSlug":"tam-coc-bich-dong","quantity":1},{"siteSlug":"hoa-lu-old-town","quantity":1}]')
on conflict (id) do update
set name = excluded.name,
    demo_price_vnd = excluded.demo_price_vnd,
    entitlement_templates = excluded.entitlement_templates;

insert into public.product_sites (product_id, site_id, stop_order) values
  ('40000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 1),
  ('40000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', 2),
  ('40000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 1),
  ('40000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000004', 2),
  ('40000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', 1),
  ('40000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000003', 2),
  ('40000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000005', 1),
  ('40000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000004', 2)
on conflict (product_id, site_id) do update set stop_order = excluded.stop_order;

insert into public.sops (
  id, tenant_id, code, title, category, summary, steps, approval_policy,
  source_document, source_page, approval_note
) values
  (
    '50000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001',
    'SOP-FLOW-01', 'Điều tiết luồng và hàng chờ', 'crowd-capacity',
    'Điều tiết theo sức chứa, giữ luồng vào/ra rõ ràng, theo dõi ngưỡng hàng chờ và báo ICC trước khi hình thành điểm chèn ép.',
    '[{"order":1,"instruction":"Xác nhận sức chứa và trạng thái luồng hiện tại.","requiresEvidence":true},{"order":2,"instruction":"Giữ nhóm tiếp theo sau vạch chờ và mở theo nhịp an toàn.","requiresEvidence":false},{"order":3,"instruction":"Báo ICC khi vượt ngưỡng; không tự ý tăng sức chứa.","requiresEvidence":true}]',
    'supervisor', 'Playbook Tam Chuc.pdf', 62,
    'Demo operational summary — requires organizational approval'
  ),
  (
    '50000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001',
    'SOP-EMG-01', 'Thời tiết xấu — tạm dừng đường thủy', 'weather',
    'Khi gió lớn, giông hoặc sét vượt ngưỡng demo, ICC điều phối dừng nhận khách, đưa thuyền về điểm an toàn gần nhất và đối chiếu đủ người/thuyền.',
    '[{"order":1,"instruction":"Phát cảnh báo và dừng nhận khách mới.","requiresEvidence":true},{"order":2,"instruction":"Yêu cầu read-back và đưa thuyền về điểm an toàn gần nhất.","requiresEvidence":true},{"order":3,"instruction":"Đối chiếu thuyền và hành khách trước khi công bố trạng thái.","requiresEvidence":true}]',
    'two-door', 'Playbook Tam Chuc.pdf', 56,
    'Demo operational summary — requires organizational approval'
  ),
  (
    '50000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000001',
    'SOP-EMG-02', 'Cứu hộ dưới nước', 'water-safety',
    'Báo tọa độ, ném phao ngay khi có thể, điều đội cứu hộ gần nhất, giữ khoảng cách an toàn và bàn giao y tế sau khi đưa nạn nhân lên xuồng.',
    '[{"order":1,"instruction":"Báo vị trí và hỗ trợ nổi tức thời nếu an toàn.","requiresEvidence":true},{"order":2,"instruction":"ICC điều đội cứu hộ gần nhất và cảnh giới hiện trường.","requiresEvidence":true},{"order":3,"instruction":"Bàn giao y tế và ghi nhận đầy đủ.","requiresEvidence":true}]',
    'two-door', 'Playbook Tam Chuc.pdf', 57,
    'Demo operational summary — requires organizational approval'
  ),
  (
    '50000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000001',
    'SOP-MED-01', 'Ứng phó y tế và chuyển viện', 'medical',
    'Báo vị trí/tình trạng, giữ an toàn tại chỗ, điều đội y tế gần nhất, sơ cứu theo thẩm quyền và mở hành lang chuyển viện khi trạm y tế quyết định.',
    '[{"order":1,"instruction":"Báo vị trí và tình trạng quan sát được; không chẩn đoán vượt thẩm quyền.","requiresEvidence":true},{"order":2,"instruction":"Điều đội y tế gần nhất và sơ cứu theo chuyên môn.","requiresEvidence":true},{"order":3,"instruction":"Nếu chuyển viện, mở tuyến ưu tiên đã khảo sát và theo dõi bàn giao.","requiresEvidence":true}]',
    'two-door', 'Playbook Tam Chuc.pdf', 60,
    'Demo operational summary — requires organizational approval'
  ),
  (
    '50000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000001',
    'SOP-LOST-01', 'Trẻ em / người đi lạc', 'lost-person',
    'Đưa trẻ tới điểm đoàn tụ công khai có giám sát, ghi nhận đặc điểm, phát thông báo nội bộ và chỉ bàn giao sau xác minh quan hệ.',
    '[{"order":1,"instruction":"Đưa người đi lạc tới điểm đoàn tụ an toàn và báo ICC.","requiresEvidence":true},{"order":2,"instruction":"Ghi nhận mô tả, phát thông tin cho các chốt; không công khai dữ liệu nhạy cảm.","requiresEvidence":true},{"order":3,"instruction":"Xác minh quan hệ trước bàn giao; nâng cấp phối hợp khi quá ngưỡng.","requiresEvidence":true}]',
    'supervisor', 'Playbook Tam Chuc.pdf', 59,
    'Demo operational summary — requires organizational approval'
  ),
  (
    '50000000-0000-4000-8000-000000000006', '00000000-0000-4000-8000-000000000001',
    'SOP-HO-01', 'Bàn giao ca ICC và chốt hiện trường', 'other',
    'Ca cũ chuẩn bị tình trạng nhân sự, thiết bị, sự cố và cảnh báo; hai ca cùng đọc biểu mẫu bàn giao, đi thực địa và ký nhận trước khi ca cũ rời vị trí.',
    '[{"order":1,"instruction":"Ca cũ hoàn tất biểu mẫu bàn giao và liệt kê việc đang mở.","requiresEvidence":true},{"order":2,"instruction":"Hai ca cùng đọc, đi thực địa và xác nhận điểm đặc biệt.","requiresEvidence":true},{"order":3,"instruction":"Chỉ chuyển quyền sau khi ca mới ký nhận.","requiresEvidence":true}]',
    'supervisor', 'Playbook Tam Chuc.pdf', 65,
    'Demo operational summary — requires organizational approval'
  )
on conflict (id) do update
set title = excluded.title,
    summary = excluded.summary,
    steps = excluded.steps,
    source_page = excluded.source_page,
    approval_note = excluded.approval_note;

-- RLS is enabled on every table exposed through the public schema.
alter table public.tenants enable row level security;
alter table public.regions enable row level security;
alter table public.operators enable row level security;
alter table public.sites enable row level security;
alter table public.campaigns enable row level security;
alter table public.qr_sources enable row level security;
alter table public.products enable row level security;
alter table public.product_sites enable row level security;
alter table public.sops enable row level security;
alter table public.user_profiles enable row level security;
alter table public.tenant_memberships enable row level security;
alter table public.demo_runs enable row level security;
alter table public.demo_run_members enable row level security;
alter table public.demo_join_tokens enable row level security;
alter table public.capacity_slots enable row level security;
alter table public.journey_intents enable row level security;
alter table public.itineraries enable row level security;
alter table public.itinerary_items enable row level security;
alter table public.quotes enable row level security;
alter table public.bookings enable row level security;
alter table public.booking_contacts enable row level security;
alter table public.booking_lines enable row level security;
alter table public.payment_intents enable row level security;
alter table public.payment_events enable row level security;
alter table public.passes enable row level security;
alter table public.pass_entitlements enable row level security;
alter table public.redemptions enable row level security;
alter table public.incidents enable row level security;
alter table public.resource_requests enable row level security;
alter table public.audit_events enable row level security;
alter table public.analytics_events enable row level security;

grant usage on schema public to anon, authenticated;
grant select on public.tenants, public.regions, public.sites, public.campaigns, public.qr_sources, public.products, public.product_sites to authenticated;
grant select on public.operators, public.sops to authenticated;
grant select, insert, update on public.user_profiles to authenticated;
grant select on public.tenant_memberships, public.demo_runs, public.demo_run_members, public.demo_join_tokens to authenticated;
grant select, insert, update, delete on
  public.capacity_slots, public.journey_intents, public.itineraries, public.itinerary_items,
  public.quotes, public.bookings, public.booking_contacts, public.booking_lines,
  public.payment_intents, public.payment_events, public.passes, public.pass_entitlements,
  public.redemptions, public.incidents, public.resource_requests, public.audit_events,
  public.analytics_events
to authenticated;
revoke insert, update, delete on public.journey_intents, public.itineraries, public.itinerary_items from authenticated;
revoke insert, update, delete on
  public.quotes, public.bookings, public.booking_contacts, public.booking_lines,
  public.payment_intents, public.payment_events, public.passes,
  public.pass_entitlements, public.audit_events, public.analytics_events
from authenticated;
revoke insert, update, delete on public.redemptions, public.capacity_slots from authenticated;
revoke insert, update, delete on public.incidents, public.resource_requests from authenticated;

create policy tenant_catalog_read on public.tenants for select to authenticated
using ((select auth.uid()) is not null);
create policy region_catalog_read on public.regions for select to authenticated
using ((select auth.uid()) is not null);
create policy site_catalog_read on public.sites for select to authenticated
using ((select auth.uid()) is not null);
create policy campaign_catalog_read on public.campaigns for select to authenticated
using ((select auth.uid()) is not null);
create policy qr_source_catalog_read on public.qr_sources for select to authenticated
using ((select auth.uid()) is not null);
create policy product_catalog_read on public.products for select to authenticated
using ((select auth.uid()) is not null);
create policy product_site_catalog_read on public.product_sites for select to authenticated
using ((select auth.uid()) is not null);
create policy operator_staff_read on public.operators for select to authenticated
using (public.has_tenant_role(tenant_id, array['check-in-agent','site-supervisor','icc-operator','finance','content','admin','ritual-authority']));
create policy sop_staff_read on public.sops for select to authenticated
using (public.has_tenant_role(tenant_id, array['check-in-agent','site-supervisor','icc-operator','admin']));

create policy profile_self_read on public.user_profiles for select to authenticated
using (user_id = (select auth.uid()));
create policy profile_self_insert on public.user_profiles for insert to authenticated
with check (user_id = (select auth.uid()));
create policy profile_self_update on public.user_profiles for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy membership_self_read on public.tenant_memberships for select to authenticated
using (
  user_id = (select auth.uid())
  or public.has_tenant_role(tenant_id, array['admin'])
);
create policy demo_run_member_read on public.demo_runs for select to authenticated
using (public.is_active_run_member(id));
create policy demo_run_owner_update on public.demo_runs for update to authenticated
using (owner_user_id = (select auth.uid()) and public.has_tenant_role(tenant_id, array['admin']))
with check (owner_user_id = (select auth.uid()) and public.has_tenant_role(tenant_id, array['admin']));
create policy demo_member_scoped_read on public.demo_run_members for select to authenticated
using (
  user_id = (select auth.uid())
  or public.is_internal_run_member(demo_run_id, array['site-supervisor','icc-operator','admin'])
);
create policy join_token_owner_read on public.demo_join_tokens for select to authenticated
using (
  created_by = (select auth.uid())
  and public.is_internal_run_member(demo_run_id, array['admin'])
);

create policy capacity_member_read on public.capacity_slots for select to authenticated
using (public.is_active_run_member(demo_run_id));
create policy capacity_operator_insert on public.capacity_slots for insert to authenticated
with check (public.is_internal_run_member(demo_run_id, array['site-supervisor','icc-operator','admin']));
create policy capacity_operator_update on public.capacity_slots for update to authenticated
using (public.is_internal_run_member(demo_run_id, array['site-supervisor','icc-operator','admin']))
with check (public.is_internal_run_member(demo_run_id, array['site-supervisor','icc-operator','admin']));
create policy capacity_admin_delete on public.capacity_slots for delete to authenticated
using (public.is_internal_run_member(demo_run_id, array['admin']));

create policy intent_owner_read on public.journey_intents for select to authenticated
using (created_by = (select auth.uid()) and public.is_active_run_member(demo_run_id));
create policy intent_owner_insert on public.journey_intents for insert to authenticated
with check (public.can_mutate_own_run_row(demo_run_id, created_by));
create policy intent_owner_update on public.journey_intents for update to authenticated
using (public.can_mutate_own_run_row(demo_run_id, created_by))
with check (public.can_mutate_own_run_row(demo_run_id, created_by));

create policy itinerary_scoped_read on public.itineraries for select to authenticated
using (public.can_read_run_row(demo_run_id, created_by));
create policy itinerary_owner_insert on public.itineraries for insert to authenticated
with check (public.can_mutate_own_run_row(demo_run_id, created_by));
create policy itinerary_owner_update on public.itineraries for update to authenticated
using (public.can_mutate_own_run_row(demo_run_id, created_by))
with check (public.can_mutate_own_run_row(demo_run_id, created_by));
create policy itinerary_owner_delete on public.itineraries for delete to authenticated
using (public.can_mutate_own_run_row(demo_run_id, created_by));

create policy itinerary_item_scoped_read on public.itinerary_items for select to authenticated
using (public.can_read_run_row(demo_run_id, created_by));
create policy itinerary_item_owner_insert on public.itinerary_items for insert to authenticated
with check (public.can_mutate_own_run_row(demo_run_id, created_by));
create policy itinerary_item_owner_update on public.itinerary_items for update to authenticated
using (public.can_mutate_own_run_row(demo_run_id, created_by))
with check (public.can_mutate_own_run_row(demo_run_id, created_by));
create policy itinerary_item_owner_delete on public.itinerary_items for delete to authenticated
using (public.can_mutate_own_run_row(demo_run_id, created_by));

create policy quote_scoped_read on public.quotes for select to authenticated
using (public.can_read_run_row(demo_run_id, created_by));
create policy quote_owner_insert on public.quotes for insert to authenticated
with check (public.can_mutate_own_run_row(demo_run_id, created_by));
create policy quote_owner_update on public.quotes for update to authenticated
using (public.can_mutate_own_run_row(demo_run_id, created_by))
with check (public.can_mutate_own_run_row(demo_run_id, created_by));

create policy booking_scoped_read on public.bookings for select to authenticated
using (public.can_read_run_row(demo_run_id, created_by));
create policy booking_owner_insert on public.bookings for insert to authenticated
with check (public.can_mutate_own_run_row(demo_run_id, created_by));
create policy booking_owner_update on public.bookings for update to authenticated
using (
  public.can_mutate_own_run_row(demo_run_id, created_by)
  or public.is_internal_run_member(demo_run_id, array['check-in-agent','site-supervisor','icc-operator','admin'])
)
with check (
  public.can_mutate_own_run_row(demo_run_id, created_by)
  or public.is_internal_run_member(demo_run_id, array['check-in-agent','site-supervisor','icc-operator','admin'])
);

create policy contact_owner_read on public.booking_contacts for select to authenticated
using (
  created_by = (select auth.uid())
  or public.is_internal_run_member(demo_run_id, array['site-supervisor','icc-operator','admin'])
);
create policy contact_owner_insert on public.booking_contacts for insert to authenticated
with check (public.can_mutate_own_run_row(demo_run_id, created_by));

create policy booking_line_scoped_read on public.booking_lines for select to authenticated
using (public.is_active_run_member(demo_run_id));
create policy booking_line_member_insert on public.booking_lines for insert to authenticated
with check (public.is_active_run_member(demo_run_id));

create policy payment_intent_scoped_read on public.payment_intents for select to authenticated
using (public.can_read_run_row(demo_run_id, created_by));
create policy payment_intent_owner_insert on public.payment_intents for insert to authenticated
with check (public.can_mutate_own_run_row(demo_run_id, created_by));
create policy payment_intent_owner_update on public.payment_intents for update to authenticated
using (public.can_mutate_own_run_row(demo_run_id, created_by))
with check (public.can_mutate_own_run_row(demo_run_id, created_by));

create policy payment_event_scoped_read on public.payment_events for select to authenticated
using (public.is_active_run_member(demo_run_id));
create policy payment_event_member_insert on public.payment_events for insert to authenticated
with check (public.is_active_run_member(demo_run_id));
create policy payment_event_member_update on public.payment_events for update to authenticated
using (public.is_active_run_member(demo_run_id))
with check (public.is_active_run_member(demo_run_id));

create policy pass_scoped_read on public.passes for select to authenticated
using (public.can_read_run_row(demo_run_id, created_by));
create policy pass_owner_insert on public.passes for insert to authenticated
with check (public.can_mutate_own_run_row(demo_run_id, created_by));
create policy pass_operator_update on public.passes for update to authenticated
using (
  public.can_mutate_own_run_row(demo_run_id, created_by)
  or public.is_internal_run_member(demo_run_id, array['check-in-agent','site-supervisor','icc-operator','admin'])
)
with check (
  public.can_mutate_own_run_row(demo_run_id, created_by)
  or public.is_internal_run_member(demo_run_id, array['check-in-agent','site-supervisor','icc-operator','admin'])
);

create policy entitlement_scoped_read on public.pass_entitlements for select to authenticated
using (public.is_active_run_member(demo_run_id));
create policy entitlement_member_insert on public.pass_entitlements for insert to authenticated
with check (public.is_active_run_member(demo_run_id));
create policy entitlement_operator_update on public.pass_entitlements for update to authenticated
using (public.is_internal_run_member(demo_run_id, array['check-in-agent','site-supervisor','icc-operator','admin']))
with check (public.is_internal_run_member(demo_run_id, array['check-in-agent','site-supervisor','icc-operator','admin']));

create policy redemption_operator_read on public.redemptions for select to authenticated
using (
  public.is_internal_run_member(demo_run_id, array['check-in-agent','site-supervisor','icc-operator','admin'])
  or exists (
    select 1 from public.passes p
    where p.id = redemptions.pass_id and p.created_by = (select auth.uid())
  )
);
create policy redemption_operator_insert on public.redemptions for insert to authenticated
with check (public.is_internal_run_member(demo_run_id, array['check-in-agent','site-supervisor','icc-operator','admin']));

create policy incident_operator_read on public.incidents for select to authenticated
using (public.is_internal_run_member(demo_run_id, array['check-in-agent','site-supervisor','icc-operator','admin']));
create policy incident_operator_insert on public.incidents for insert to authenticated
with check (public.is_internal_run_member(demo_run_id, array['check-in-agent','site-supervisor','icc-operator','admin']));
create policy incident_operator_update on public.incidents for update to authenticated
using (public.is_internal_run_member(demo_run_id, array['site-supervisor','icc-operator','admin']))
with check (public.is_internal_run_member(demo_run_id, array['site-supervisor','icc-operator','admin']));

create policy resource_operator_read on public.resource_requests for select to authenticated
using (public.is_internal_run_member(demo_run_id, array['check-in-agent','site-supervisor','icc-operator','admin']));
create policy resource_operator_insert on public.resource_requests for insert to authenticated
with check (public.is_internal_run_member(demo_run_id, array['check-in-agent','site-supervisor','icc-operator','admin']));
create policy resource_operator_update on public.resource_requests for update to authenticated
using (public.is_internal_run_member(demo_run_id, array['site-supervisor','icc-operator','admin']))
with check (public.is_internal_run_member(demo_run_id, array['site-supervisor','icc-operator','admin']));

create policy audit_operator_read on public.audit_events for select to authenticated
using (public.is_internal_run_member(demo_run_id, array['check-in-agent','site-supervisor','icc-operator','finance','admin']));
create policy audit_member_insert on public.audit_events for insert to authenticated
with check (public.is_active_run_member(demo_run_id) and actor_user_id = (select auth.uid()));

create policy analytics_operator_read on public.analytics_events for select to authenticated
using (public.is_internal_run_member(demo_run_id, array['site-supervisor','icc-operator','finance','admin']));
create policy analytics_member_insert on public.analytics_events for insert to authenticated
with check (public.is_active_run_member(demo_run_id) and actor_user_id = (select auth.uid()));

alter table public.demo_runs replica identity full;
alter table public.capacity_slots replica identity full;
alter table public.bookings replica identity full;
alter table public.passes replica identity full;
alter table public.pass_entitlements replica identity full;
alter table public.redemptions replica identity full;
alter table public.incidents replica identity full;
alter table public.resource_requests replica identity full;
alter table public.audit_events replica identity full;

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'demo_runs', 'demo_run_members', 'capacity_slots', 'bookings', 'passes',
    'pass_entitlements', 'redemptions', 'incidents', 'resource_requests', 'audit_events'
  ]
  loop
    if not exists (
      select 1
      from pg_publication_tables
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
