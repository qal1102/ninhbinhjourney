-- CUS-04: first-party dynamic QR registry and aggregate scan provenance.
-- A scan records only a source and time. The anonymous customer/session link is
-- created separately by the consent-gated CUS-01 event route after redirect.

begin;

create table if not exists public.marketing_campaigns (
  id uuid primary key,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  code text not null check (code ~ '^[A-Z0-9][A-Z0-9_-]{2,47}$'),
  name text not null check (
    char_length(name) between 2 and 160
    and not public.customer_json_contains_pii(jsonb_build_object('value', name))
  ),
  status text not null check (status in ('draft', 'active', 'paused')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, code),
  unique (id, tenant_id)
);

create table if not exists public.marketing_qr_sources (
  id uuid primary key,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  campaign_id uuid not null,
  code text not null check (code ~ '^[A-Z0-9][A-Z0-9_-]{2,47}$'),
  placement_id text not null check (placement_id ~ '^[A-Z0-9][A-Z0-9_-]{2,47}$'),
  placement_label text not null check (
    char_length(placement_label) between 2 and 160
    and not public.customer_json_contains_pii(jsonb_build_object('value', placement_label))
  ),
  destination_path text not null check (
    char_length(destination_path) between 1 and 1024
    and destination_path like '/%'
    and destination_path not like '//%'
    and position('://' in destination_path) = 0
    and destination_path !~ '[[:cntrl:]]'
  ),
  status text not null check (status in ('active', 'paused', 'retired')),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (campaign_id, tenant_id)
    references public.marketing_campaigns(id, tenant_id) on delete restrict,
  unique (code),
  unique (id, tenant_id)
);

create index if not exists marketing_qr_sources_tenant_campaign_idx
  on public.marketing_qr_sources(tenant_id, campaign_id, created_at desc);

create table if not exists public.marketing_qr_scans (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  qr_source_id uuid not null,
  destination_path text not null,
  occurred_at timestamptz not null default now(),
  foreign key (qr_source_id, tenant_id)
    references public.marketing_qr_sources(id, tenant_id) on delete restrict
);

create index if not exists marketing_qr_scans_source_time_idx
  on public.marketing_qr_scans(tenant_id, qr_source_id, occurred_at desc);

create table if not exists public.marketing_qr_audit_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  qr_source_id uuid,
  campaign_id uuid,
  actor_account_id uuid not null,
  event_type text not null check (event_type in ('campaign-created', 'qr-created', 'qr-destination-updated')),
  before_state jsonb not null default '{}'::jsonb check (
    jsonb_typeof(before_state) = 'object'
    and not public.customer_json_contains_pii(before_state)
  ),
  after_state jsonb not null default '{}'::jsonb check (
    jsonb_typeof(after_state) = 'object'
    and not public.customer_json_contains_pii(after_state)
  ),
  occurred_at timestamptz not null default now(),
  foreign key (qr_source_id, tenant_id)
    references public.marketing_qr_sources(id, tenant_id) on delete restrict,
  foreign key (campaign_id, tenant_id)
    references public.marketing_campaigns(id, tenant_id) on delete restrict
);

drop trigger if exists marketing_qr_scans_append_only on public.marketing_qr_scans;
create trigger marketing_qr_scans_append_only
before update or delete on public.marketing_qr_scans
for each row execute function public.customer_append_only();

drop trigger if exists marketing_qr_audit_append_only on public.marketing_qr_audit_events;
create trigger marketing_qr_audit_append_only
before update or delete on public.marketing_qr_audit_events
for each row execute function public.customer_append_only();

create or replace function public.marketing_create_campaign(
  p_tenant_id uuid,
  p_campaign_id uuid,
  p_actor_account_id uuid,
  p_code text,
  p_name text,
  p_status text
)
returns table (campaign_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_tenant_id is null or p_campaign_id is null or p_actor_account_id is null then
    raise exception using errcode = '22023', message = 'MARKETING_CAMPAIGN_ID_REQUIRED';
  end if;
  if p_code !~ '^[A-Z0-9][A-Z0-9_-]{2,47}$'
     or char_length(p_name) not between 2 and 160
     or p_status not in ('draft', 'active', 'paused')
     or public.customer_json_contains_pii(jsonb_build_object('value', p_name)) then
    raise exception using errcode = '22023', message = 'MARKETING_CAMPAIGN_INPUT_INVALID';
  end if;

  insert into public.marketing_campaigns (id, tenant_id, code, name, status)
  values (p_campaign_id, p_tenant_id, p_code, p_name, p_status);
  insert into public.marketing_qr_audit_events (
    tenant_id, campaign_id, actor_account_id, event_type, after_state
  ) values (
    p_tenant_id, p_campaign_id, p_actor_account_id, 'campaign-created',
    jsonb_build_object('code', p_code, 'status', p_status)
  );
  return query select p_campaign_id;
end;
$$;

create or replace function public.marketing_create_qr_source(
  p_tenant_id uuid,
  p_qr_source_id uuid,
  p_actor_account_id uuid,
  p_campaign_id uuid,
  p_code text,
  p_placement_id text,
  p_placement_label text,
  p_destination_path text,
  p_status text
)
returns table (qr_source_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_campaign public.marketing_campaigns;
begin
  select * into v_campaign from public.marketing_campaigns
  where id = p_campaign_id and tenant_id = p_tenant_id;
  if v_campaign.id is null then
    raise exception using errcode = '22023', message = 'MARKETING_CAMPAIGN_NOT_FOUND';
  end if;
  if p_qr_source_id is null or p_actor_account_id is null
     or p_code !~ '^[A-Z0-9][A-Z0-9_-]{2,47}$'
     or p_placement_id !~ '^[A-Z0-9][A-Z0-9_-]{2,47}$'
     or char_length(p_placement_label) not between 2 and 160
     or p_destination_path !~ '^/'
     or p_destination_path like '//%'
     or position('://' in p_destination_path) > 0
     or char_length(p_destination_path) > 1024
     or p_destination_path ~ '[[:cntrl:]]'
     or p_status not in ('active', 'paused')
     or public.customer_json_contains_pii(jsonb_build_object('value', p_placement_label)) then
    raise exception using errcode = '22023', message = 'MARKETING_QR_INPUT_INVALID';
  end if;

  insert into public.marketing_qr_sources (
    id, tenant_id, campaign_id, code, placement_id, placement_label, destination_path, status
  ) values (
    p_qr_source_id, p_tenant_id, p_campaign_id, p_code, p_placement_id,
    p_placement_label, p_destination_path, p_status
  );
  insert into public.marketing_qr_audit_events (
    tenant_id, qr_source_id, campaign_id, actor_account_id, event_type, after_state
  ) values (
    p_tenant_id, p_qr_source_id, p_campaign_id, p_actor_account_id, 'qr-created',
    jsonb_build_object('code', p_code, 'destination_path', p_destination_path, 'status', p_status)
  );
  return query select p_qr_source_id;
end;
$$;

create or replace function public.marketing_update_qr_destination(
  p_tenant_id uuid,
  p_qr_source_id uuid,
  p_actor_account_id uuid,
  p_expected_version integer,
  p_destination_path text
)
returns table (version integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_source public.marketing_qr_sources;
  v_before_destination_path text;
begin
  select * into v_source from public.marketing_qr_sources
  where id = p_qr_source_id and tenant_id = p_tenant_id for update;
  if v_source.id is null then
    raise exception using errcode = '22023', message = 'MARKETING_QR_NOT_FOUND';
  end if;
  if p_expected_version <> v_source.version then
    raise exception using errcode = '40001', message = 'MARKETING_QR_VERSION_CONFLICT';
  end if;
  if p_destination_path !~ '^/'
     or p_destination_path like '//%'
     or position('://' in p_destination_path) > 0
     or char_length(p_destination_path) > 1024
     or p_destination_path ~ '[[:cntrl:]]' then
    raise exception using errcode = '22023', message = 'MARKETING_QR_INPUT_INVALID';
  end if;

  v_before_destination_path := v_source.destination_path;
  update public.marketing_qr_sources
  set destination_path = p_destination_path,
      version = marketing_qr_sources.version + 1,
      updated_at = now()
  where id = p_qr_source_id and tenant_id = p_tenant_id
  returning * into v_source;
  insert into public.marketing_qr_audit_events (
    tenant_id, qr_source_id, campaign_id, actor_account_id, event_type, before_state, after_state
  ) values (
    p_tenant_id, v_source.id, v_source.campaign_id, p_actor_account_id, 'qr-destination-updated',
    jsonb_build_object('destination_path', v_before_destination_path, 'version', p_expected_version),
    jsonb_build_object('destination_path', v_source.destination_path, 'version', v_source.version)
  );
  return query select v_source.version;
end;
$$;

create or replace function public.marketing_resolve_qr_redirect(
  p_tenant_id uuid,
  p_code text
)
returns table (
  qr_source_id uuid,
  qr_code text,
  campaign_id uuid,
  campaign_code text,
  placement_id text,
  destination_path text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_source public.marketing_qr_sources;
  v_campaign public.marketing_campaigns;
begin
  select * into v_source from public.marketing_qr_sources
  where tenant_id = p_tenant_id and code = p_code;
  if v_source.id is null then
    raise exception using errcode = '22023', message = 'MARKETING_QR_NOT_FOUND';
  end if;
  select * into v_campaign from public.marketing_campaigns
  where id = v_source.campaign_id and tenant_id = p_tenant_id;
  if v_source.status <> 'active' or v_campaign.status <> 'active' then
    raise exception using errcode = '42501', message = 'MARKETING_QR_NOT_ACTIVE';
  end if;

  insert into public.marketing_qr_scans (tenant_id, qr_source_id, destination_path)
  values (p_tenant_id, v_source.id, v_source.destination_path);
  return query select v_source.id, v_source.code, v_campaign.id, v_campaign.code, v_source.placement_id, v_source.destination_path;
end;
$$;

alter table public.marketing_campaigns enable row level security;
alter table public.marketing_qr_sources enable row level security;
alter table public.marketing_qr_scans enable row level security;
alter table public.marketing_qr_audit_events enable row level security;

revoke all on table public.marketing_campaigns, public.marketing_qr_sources,
  public.marketing_qr_scans, public.marketing_qr_audit_events
  from public, anon, authenticated, service_role;
grant select on table public.marketing_campaigns, public.marketing_qr_sources,
  public.marketing_qr_scans, public.marketing_qr_audit_events to service_role;

revoke all on function public.marketing_create_campaign(uuid, uuid, uuid, text, text, text),
  public.marketing_create_qr_source(uuid, uuid, uuid, uuid, text, text, text, text, text),
  public.marketing_update_qr_destination(uuid, uuid, uuid, integer, text),
  public.marketing_resolve_qr_redirect(uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.marketing_create_campaign(uuid, uuid, uuid, text, text, text),
  public.marketing_create_qr_source(uuid, uuid, uuid, uuid, text, text, text, text, text),
  public.marketing_update_qr_destination(uuid, uuid, uuid, integer, text),
  public.marketing_resolve_qr_redirect(uuid, text)
  to service_role;

commit;
