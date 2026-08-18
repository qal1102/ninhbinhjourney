-- CUS-01: anonymous-first customer identity, consent and event backbone.
--
-- This migration deliberately does not attach a browser collector yet. It
-- establishes the production-shaped contract behind a server-only ingestion
-- endpoint: idempotent events, first-party anonymous profiles, immutable
-- consent history and encrypted identity references. Direct PII is rejected
-- from event/source JSON at both the application and database boundaries.

begin;

create or replace function public.customer_json_contains_pii(p_value jsonb)
returns boolean
language plpgsql
immutable
security invoker
set search_path = ''
as $$
declare
  v_key text;
  v_child jsonb;
  v_text text;
begin
  if p_value is null then
    return false;
  end if;

  if jsonb_typeof(p_value) = 'object' then
    for v_key, v_child in select key, value from pg_catalog.jsonb_each(p_value)
    loop
      if lower(v_key) ~ '(email|e_mail|phone|mobile|telephone|full_?name|first_?name|last_?name|contact|address|raw_?text|prompt|message)' then
        return true;
      end if;
      if public.customer_json_contains_pii(v_child) then
        return true;
      end if;
    end loop;
    return false;
  end if;

  if jsonb_typeof(p_value) = 'array' then
    for v_child in select value from pg_catalog.jsonb_array_elements(p_value)
    loop
      if public.customer_json_contains_pii(v_child) then
        return true;
      end if;
    end loop;
    return false;
  end if;

  if jsonb_typeof(p_value) = 'string' then
    v_text := p_value #>> '{}';
    if v_text ~* '(^|[^[:alnum:]._%+-])[[:alnum:]._%+-]+@[[:alnum:].-]+\.[[:alpha:]]{2,}($|[^[:alnum:]._%+-])'
       or v_text ~ '(^|[^0-9])(\+?84|0)[0-9 .-]{8,12}($|[^0-9])' then
      return true;
    end if;
  end if;

  return false;
end;
$$;

create table if not exists public.customer_profiles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  anonymous_id uuid not null,
  status text not null default 'anonymous' check (
    status in ('anonymous', 'identified', 'merged')
  ),
  canonical_profile_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, anonymous_id),
  unique (id, tenant_id),
  foreign key (canonical_profile_id, tenant_id)
    references public.customer_profiles(id, tenant_id) on delete restrict,
  check (canonical_profile_id is null or canonical_profile_id <> id),
  check (
    (status = 'merged' and canonical_profile_id is not null)
    or (status <> 'merged' and canonical_profile_id is null)
  )
);

create index if not exists customer_profiles_tenant_updated_idx
  on public.customer_profiles(tenant_id, updated_at desc);

create table if not exists public.customer_identities (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  profile_id uuid not null,
  identity_type text not null check (identity_type in ('phone', 'email')),
  identity_digest text not null check (identity_digest ~ '^[0-9a-f]{64}$'),
  identity_ciphertext text not null check (
    char_length(identity_ciphertext) between 24 and 4096
  ),
  encryption_key_version text not null check (
    char_length(trim(encryption_key_version)) between 1 and 40
  ),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (profile_id, tenant_id)
    references public.customer_profiles(id, tenant_id) on delete restrict,
  unique (tenant_id, identity_type, identity_digest),
  unique (id, tenant_id)
);

create index if not exists customer_identities_profile_idx
  on public.customer_identities(tenant_id, profile_id, created_at desc);

create table if not exists public.customer_consents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  profile_id uuid not null,
  purpose text not null check (
    purpose in ('essential_service', 'product_analytics', 'marketing_communications')
  ),
  status text not null check (status in ('granted', 'denied', 'revoked')),
  channel text not null check (channel in ('web', 'erp', 'import', 'api')),
  policy_version text not null check (
    char_length(trim(policy_version)) between 1 and 80
  ),
  evidence jsonb not null default '{}'::jsonb check (
    jsonb_typeof(evidence) = 'object'
    and pg_catalog.octet_length(evidence::text) <= 4096
    and not public.customer_json_contains_pii(evidence)
  ),
  occurred_at timestamptz not null,
  created_at timestamptz not null default now(),
  foreign key (profile_id, tenant_id)
    references public.customer_profiles(id, tenant_id) on delete restrict,
  unique (id, tenant_id)
);

create index if not exists customer_consents_profile_purpose_idx
  on public.customer_consents(tenant_id, profile_id, purpose, occurred_at desc, created_at desc);

create table if not exists public.customer_sessions (
  id uuid primary key,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  profile_id uuid not null,
  anonymous_id uuid not null,
  started_at timestamptz not null,
  last_seen_at timestamptz not null,
  first_touch jsonb not null default '{}'::jsonb check (
    jsonb_typeof(first_touch) = 'object'
    and pg_catalog.octet_length(first_touch::text) <= 4096
    and not public.customer_json_contains_pii(first_touch)
  ),
  last_touch jsonb not null default '{}'::jsonb check (
    jsonb_typeof(last_touch) = 'object'
    and pg_catalog.octet_length(last_touch::text) <= 4096
    and not public.customer_json_contains_pii(last_touch)
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (profile_id, tenant_id)
    references public.customer_profiles(id, tenant_id) on delete restrict,
  unique (id, tenant_id),
  check (last_seen_at >= started_at)
);

create index if not exists customer_sessions_profile_idx
  on public.customer_sessions(tenant_id, profile_id, last_seen_at desc);

create table if not exists public.customer_events (
  event_id uuid primary key,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  profile_id uuid not null,
  session_id uuid not null,
  page_view_id uuid,
  event_name text not null check (event_name in (
    'page_viewed',
    'qr_opened',
    'section_viewed',
    'section_engaged',
    'scroll_depth_reached',
    'content_clicked',
    'destination_viewed',
    'service_viewed',
    'plan_started',
    'plan_generated',
    'recommendation_shown',
    'recommendation_clicked',
    'recommendation_accepted',
    'booking_started',
    'slot_hold_created',
    'payment_completed',
    'ticket_issued',
    'ticket_checked_in',
    'contact_submitted',
    'identity_linked',
    'consent_updated',
    'marketing_message_outcome'
  )),
  schema_version integer not null check (schema_version between 1 and 1000),
  occurred_at timestamptz not null,
  received_at timestamptz not null default now(),
  source_context jsonb not null default '{}'::jsonb check (
    jsonb_typeof(source_context) = 'object'
    and pg_catalog.octet_length(source_context::text) <= 4096
    and not public.customer_json_contains_pii(source_context)
  ),
  consent_snapshot jsonb not null check (
    jsonb_typeof(consent_snapshot) = 'object'
    and pg_catalog.octet_length(consent_snapshot::text) <= 4096
    and not public.customer_json_contains_pii(consent_snapshot)
  ),
  properties jsonb not null default '{}'::jsonb check (
    jsonb_typeof(properties) = 'object'
    and pg_catalog.octet_length(properties::text) <= 16384
    and not public.customer_json_contains_pii(properties)
  ),
  foreign key (profile_id, tenant_id)
    references public.customer_profiles(id, tenant_id) on delete restrict,
  foreign key (session_id, tenant_id)
    references public.customer_sessions(id, tenant_id) on delete restrict,
  unique (event_id, tenant_id)
);

create index if not exists customer_events_tenant_time_idx
  on public.customer_events(tenant_id, occurred_at desc, event_id);
create index if not exists customer_events_profile_time_idx
  on public.customer_events(tenant_id, profile_id, occurred_at desc);
create index if not exists customer_events_session_time_idx
  on public.customer_events(tenant_id, session_id, occurred_at, event_id);
create index if not exists customer_events_name_time_idx
  on public.customer_events(tenant_id, event_name, occurred_at desc);

create or replace function public.customer_append_only()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception using errcode = '42501', message = 'CUSTOMER_HISTORY_IMMUTABLE';
end;
$$;

drop trigger if exists customer_identities_append_only on public.customer_identities;
create trigger customer_identities_append_only
before update or delete on public.customer_identities
for each row execute function public.customer_append_only();

drop trigger if exists customer_consents_append_only on public.customer_consents;
create trigger customer_consents_append_only
before update or delete on public.customer_consents
for each row execute function public.customer_append_only();

drop trigger if exists customer_events_append_only on public.customer_events;
create trigger customer_events_append_only
before update or delete on public.customer_events
for each row execute function public.customer_append_only();

create or replace function public.customer_ingest_event(
  p_tenant_id uuid,
  p_event_id uuid,
  p_event_name text,
  p_schema_version integer,
  p_occurred_at timestamptz,
  p_anonymous_id uuid,
  p_session_id uuid,
  p_page_view_id uuid,
  p_source_context jsonb,
  p_consent_snapshot jsonb,
  p_properties jsonb
)
returns table (
  profile_id uuid,
  session_id uuid,
  event_id uuid,
  inserted boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid;
  v_session_profile_id uuid;
  v_inserted_event_id uuid;
  v_existing public.customer_events;
  v_source jsonb := coalesce(p_source_context, '{}'::jsonb);
  v_consent jsonb := coalesce(p_consent_snapshot, '{}'::jsonb);
  v_properties jsonb := coalesce(p_properties, '{}'::jsonb);
  v_analytics_status text;
begin
  if p_event_id is null or p_anonymous_id is null or p_session_id is null then
    raise exception using errcode = '22023', message = 'CUSTOMER_EVENT_ID_REQUIRED';
  end if;

  if p_event_name not in (
    'page_viewed', 'qr_opened', 'section_viewed', 'section_engaged',
    'scroll_depth_reached', 'content_clicked', 'destination_viewed',
    'service_viewed', 'plan_started', 'plan_generated',
    'recommendation_shown', 'recommendation_clicked',
    'recommendation_accepted', 'booking_started', 'slot_hold_created',
    'payment_completed', 'ticket_issued', 'ticket_checked_in',
    'contact_submitted', 'identity_linked', 'consent_updated',
    'marketing_message_outcome'
  ) or p_schema_version <> 1 then
    raise exception using errcode = '22023', message = 'CUSTOMER_EVENT_SCHEMA_UNSUPPORTED';
  end if;

  if p_occurred_at < now() - interval '7 days'
     or p_occurred_at > now() + interval '5 minutes' then
    raise exception using errcode = '22023', message = 'CUSTOMER_EVENT_TIME_INVALID';
  end if;

  if jsonb_typeof(v_source) <> 'object'
     or jsonb_typeof(v_consent) <> 'object'
     or jsonb_typeof(v_properties) <> 'object'
     or pg_catalog.octet_length(v_source::text) > 4096
     or pg_catalog.octet_length(v_consent::text) > 4096
     or pg_catalog.octet_length(v_properties::text) > 16384 then
    raise exception using errcode = '22023', message = 'CUSTOMER_EVENT_PAYLOAD_INVALID';
  end if;

  if public.customer_json_contains_pii(v_source)
     or public.customer_json_contains_pii(v_consent)
     or public.customer_json_contains_pii(v_properties) then
    raise exception using errcode = '22023', message = 'CUSTOMER_EVENT_PII_FORBIDDEN';
  end if;

  v_analytics_status := v_consent ->> 'product_analytics';
  if p_event_name <> 'consent_updated'
     and v_analytics_status not in ('granted', 'not-required') then
    raise exception using errcode = '42501', message = 'CUSTOMER_ANALYTICS_CONSENT_REQUIRED';
  end if;

  insert into public.customer_profiles as existing (
    tenant_id, anonymous_id
  ) values (
    p_tenant_id, p_anonymous_id
  )
  on conflict (tenant_id, anonymous_id) do update set
    updated_at = greatest(existing.updated_at, now())
  returning existing.id into v_profile_id;

  insert into public.customer_sessions as existing (
    id,
    tenant_id,
    profile_id,
    anonymous_id,
    started_at,
    last_seen_at,
    first_touch,
    last_touch
  ) values (
    p_session_id,
    p_tenant_id,
    v_profile_id,
    p_anonymous_id,
    p_occurred_at,
    p_occurred_at,
    v_source,
    v_source
  )
  on conflict (id) do update set
    last_seen_at = greatest(existing.last_seen_at, excluded.last_seen_at),
    last_touch = excluded.last_touch,
    updated_at = now()
  where existing.tenant_id = excluded.tenant_id
    and existing.profile_id = excluded.profile_id
    and existing.anonymous_id = excluded.anonymous_id
  returning existing.profile_id into v_session_profile_id;

  if v_session_profile_id is null then
    raise exception using errcode = '23505', message = 'CUSTOMER_SESSION_ID_COLLISION';
  end if;

  insert into public.customer_events as inserted_event (
    event_id,
    tenant_id,
    profile_id,
    session_id,
    page_view_id,
    event_name,
    schema_version,
    occurred_at,
    source_context,
    consent_snapshot,
    properties
  ) values (
    p_event_id,
    p_tenant_id,
    v_profile_id,
    p_session_id,
    p_page_view_id,
    p_event_name,
    p_schema_version,
    p_occurred_at,
    v_source,
    v_consent,
    v_properties
  )
  on conflict on constraint customer_events_pkey do nothing
  returning inserted_event.event_id into v_inserted_event_id;

  if v_inserted_event_id is null then
    select * into v_existing
    from public.customer_events existing
    where existing.event_id = p_event_id;

    if v_existing.tenant_id is distinct from p_tenant_id
       or v_existing.profile_id is distinct from v_profile_id
       or v_existing.session_id is distinct from p_session_id
       or v_existing.page_view_id is distinct from p_page_view_id
       or v_existing.event_name is distinct from p_event_name
       or v_existing.schema_version is distinct from p_schema_version
       or v_existing.occurred_at is distinct from p_occurred_at
       or v_existing.source_context is distinct from v_source
       or v_existing.consent_snapshot is distinct from v_consent
       or v_existing.properties is distinct from v_properties then
      raise exception using errcode = '23505', message = 'CUSTOMER_EVENT_ID_COLLISION';
    end if;
  end if;

  return query select
    v_profile_id,
    p_session_id,
    p_event_id,
    v_inserted_event_id is not null;
end;
$$;

create or replace function public.customer_link_encrypted_identity(
  p_tenant_id uuid,
  p_profile_id uuid,
  p_identity_type text,
  p_identity_digest text,
  p_identity_ciphertext text,
  p_encryption_key_version text,
  p_verified_at timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_identity_id uuid;
  v_existing_profile_id uuid;
begin
  perform 1
  from public.customer_profiles profile
  where profile.id = p_profile_id
    and profile.tenant_id = p_tenant_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'CUSTOMER_PROFILE_NOT_FOUND';
  end if;

  if p_identity_type not in ('phone', 'email')
     or p_identity_digest !~ '^[0-9a-f]{64}$'
     or char_length(p_identity_ciphertext) not between 24 and 4096
     or char_length(trim(coalesce(p_encryption_key_version, ''))) not between 1 and 40 then
    raise exception using errcode = '22023', message = 'CUSTOMER_IDENTITY_INPUT_INVALID';
  end if;

  select identity.profile_id into v_existing_profile_id
  from public.customer_identities identity
  where identity.tenant_id = p_tenant_id
    and identity.identity_type = p_identity_type
    and identity.identity_digest = p_identity_digest;

  if v_existing_profile_id is not null and v_existing_profile_id <> p_profile_id then
    raise exception using errcode = '23505', message = 'CUSTOMER_IDENTITY_MERGE_REQUIRED';
  end if;

  insert into public.customer_identities (
    tenant_id,
    profile_id,
    identity_type,
    identity_digest,
    identity_ciphertext,
    encryption_key_version,
    verified_at
  ) values (
    p_tenant_id,
    p_profile_id,
    p_identity_type,
    p_identity_digest,
    p_identity_ciphertext,
    trim(p_encryption_key_version),
    p_verified_at
  )
  on conflict (tenant_id, identity_type, identity_digest) do nothing
  returning id into v_identity_id;

  if v_identity_id is null then
    select identity.id into v_identity_id
    from public.customer_identities identity
    where identity.tenant_id = p_tenant_id
      and identity.identity_type = p_identity_type
      and identity.identity_digest = p_identity_digest;
  end if;

  update public.customer_profiles set
    status = 'identified',
    updated_at = now()
  where id = p_profile_id
    and tenant_id = p_tenant_id
    and status = 'anonymous';

  return v_identity_id;
end;
$$;

create or replace function public.customer_record_consent(
  p_tenant_id uuid,
  p_profile_id uuid,
  p_purpose text,
  p_status text,
  p_channel text,
  p_policy_version text,
  p_evidence jsonb,
  p_occurred_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_consent_id uuid;
  v_evidence jsonb := coalesce(p_evidence, '{}'::jsonb);
begin
  perform 1
  from public.customer_profiles profile
  where profile.id = p_profile_id
    and profile.tenant_id = p_tenant_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'CUSTOMER_PROFILE_NOT_FOUND';
  end if;

  if p_purpose not in ('essential_service', 'product_analytics', 'marketing_communications')
     or p_status not in ('granted', 'denied', 'revoked')
     or p_channel not in ('web', 'erp', 'import', 'api')
     or char_length(trim(coalesce(p_policy_version, ''))) not between 1 and 80
     or p_occurred_at > now() + interval '5 minutes'
     or jsonb_typeof(v_evidence) <> 'object'
     or pg_catalog.octet_length(v_evidence::text) > 4096 then
    raise exception using errcode = '22023', message = 'CUSTOMER_CONSENT_INPUT_INVALID';
  end if;

  if public.customer_json_contains_pii(v_evidence) then
    raise exception using errcode = '22023', message = 'CUSTOMER_CONSENT_PII_FORBIDDEN';
  end if;

  insert into public.customer_consents (
    tenant_id,
    profile_id,
    purpose,
    status,
    channel,
    policy_version,
    evidence,
    occurred_at
  ) values (
    p_tenant_id,
    p_profile_id,
    p_purpose,
    p_status,
    p_channel,
    trim(p_policy_version),
    v_evidence,
    p_occurred_at
  )
  returning id into v_consent_id;

  return v_consent_id;
end;
$$;

alter table public.customer_profiles enable row level security;
alter table public.customer_identities enable row level security;
alter table public.customer_consents enable row level security;
alter table public.customer_sessions enable row level security;
alter table public.customer_events enable row level security;

revoke all on table public.customer_profiles
  from public, anon, authenticated, service_role;
revoke all on table public.customer_identities
  from public, anon, authenticated, service_role;
revoke all on table public.customer_consents
  from public, anon, authenticated, service_role;
revoke all on table public.customer_sessions
  from public, anon, authenticated, service_role;
revoke all on table public.customer_events
  from public, anon, authenticated, service_role;

grant select on table public.customer_profiles to service_role;
grant select on table public.customer_identities to service_role;
grant select on table public.customer_consents to service_role;
grant select on table public.customer_sessions to service_role;
grant select on table public.customer_events to service_role;

revoke all on function public.customer_json_contains_pii(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.customer_append_only()
  from public, anon, authenticated, service_role;
revoke all on function public.customer_ingest_event(
  uuid, uuid, text, integer, timestamptz, uuid, uuid, uuid, jsonb, jsonb, jsonb
) from public, anon, authenticated, service_role;
revoke all on function public.customer_link_encrypted_identity(
  uuid, uuid, text, text, text, text, timestamptz
) from public, anon, authenticated, service_role;
revoke all on function public.customer_record_consent(
  uuid, uuid, text, text, text, text, jsonb, timestamptz
) from public, anon, authenticated, service_role;

grant execute on function public.customer_ingest_event(
  uuid, uuid, text, integer, timestamptz, uuid, uuid, uuid, jsonb, jsonb, jsonb
) to service_role;
grant execute on function public.customer_link_encrypted_identity(
  uuid, uuid, text, text, text, text, timestamptz
) to service_role;
grant execute on function public.customer_record_consent(
  uuid, uuid, text, text, text, text, jsonb, timestamptz
) to service_role;

commit;
