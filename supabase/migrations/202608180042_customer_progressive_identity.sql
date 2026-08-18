-- CUS-05: server-side consent, progressive identity, protected contact vault,
-- staged itinerary delivery requests and versioned customer segments.

begin;

alter table public.customer_consents
  add column if not exists sequence_no bigint generated always as identity;

create index if not exists customer_consents_latest_idx
  on public.customer_consents(
    tenant_id, profile_id, purpose, occurred_at desc, sequence_no desc
  );

create table if not exists public.customer_itinerary_delivery_requests (
  id uuid primary key,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  journey_id uuid not null,
  profile_id uuid not null,
  identity_id uuid not null,
  delivery_channel text not null check (delivery_channel in ('email', 'sms')),
  status text not null default 'staged' check (status in ('staged')),
  idempotency_key uuid not null,
  created_at timestamptz not null default now(),
  foreign key (journey_id, tenant_id)
    references public.customer_journeys(id, tenant_id) on delete restrict,
  foreign key (profile_id, tenant_id)
    references public.customer_profiles(id, tenant_id) on delete restrict,
  foreign key (identity_id, tenant_id)
    references public.customer_identities(id, tenant_id) on delete restrict,
  unique (tenant_id, idempotency_key),
  unique (id, tenant_id)
);

create index if not exists customer_delivery_profile_created_idx
  on public.customer_itinerary_delivery_requests(tenant_id, profile_id, created_at desc);

create table if not exists public.customer_segments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  profile_id uuid not null,
  segment_key text not null check (
    segment_key ~ '^[a-z][a-z0-9-]{2,63}$'
  ),
  rule_version text not null check (
    char_length(trim(rule_version)) between 1 and 40
  ),
  active boolean not null,
  evidence jsonb not null default '{}'::jsonb check (
    jsonb_typeof(evidence) = 'object'
    and pg_catalog.octet_length(evidence::text) <= 2048
    and not public.customer_json_contains_pii(evidence)
  ),
  computed_at timestamptz not null default now(),
  foreign key (profile_id, tenant_id)
    references public.customer_profiles(id, tenant_id) on delete restrict,
  constraint customer_segments_version_unique
    unique (tenant_id, profile_id, segment_key, rule_version),
  unique (id, tenant_id)
);

create index if not exists customer_segments_active_idx
  on public.customer_segments(tenant_id, active, segment_key, computed_at desc);

create table if not exists public.customer_identity_audit_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  profile_id uuid,
  identity_id uuid,
  actor_kind text not null check (actor_kind in ('customer', 'system', 'erp')),
  actor_account_id text,
  event_type text not null check (event_type in (
    'consent-updated',
    'identity-linked',
    'profile-merged',
    'delivery-requested',
    'customer-360-viewed'
  )),
  purpose text not null check (
    char_length(trim(purpose)) between 1 and 80
  ),
  metadata jsonb not null default '{}'::jsonb check (
    jsonb_typeof(metadata) = 'object'
    and pg_catalog.octet_length(metadata::text) <= 2048
    and not public.customer_json_contains_pii(metadata)
  ),
  created_at timestamptz not null default now(),
  foreign key (profile_id, tenant_id)
    references public.customer_profiles(id, tenant_id) on delete restrict,
  foreign key (identity_id, tenant_id)
    references public.customer_identities(id, tenant_id) on delete restrict,
  check (
    (actor_kind = 'erp' and char_length(trim(coalesce(actor_account_id, ''))) > 0)
    or (actor_kind <> 'erp' and actor_account_id is null)
  )
);

create index if not exists customer_identity_audit_created_idx
  on public.customer_identity_audit_events(tenant_id, created_at desc);

drop trigger if exists customer_delivery_requests_append_only
  on public.customer_itinerary_delivery_requests;
create trigger customer_delivery_requests_append_only
before update or delete on public.customer_itinerary_delivery_requests
for each row execute function public.customer_append_only();

drop trigger if exists customer_identity_audit_append_only
  on public.customer_identity_audit_events;
create trigger customer_identity_audit_append_only
before update or delete on public.customer_identity_audit_events
for each row execute function public.customer_append_only();

create or replace function public.customer_canonical_profile_id(
  p_tenant_id uuid,
  p_profile_id uuid
)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  with recursive chain as (
    select profile.id, profile.canonical_profile_id, 0 as depth
    from public.customer_profiles profile
    where profile.tenant_id = p_tenant_id and profile.id = p_profile_id
    union all
    select parent.id, parent.canonical_profile_id, chain.depth + 1
    from chain
    join public.customer_profiles parent
      on parent.tenant_id = p_tenant_id
     and parent.id = chain.canonical_profile_id
    where chain.depth < 16
  )
  select chain.id
  from chain
  order by chain.depth desc
  limit 1;
$$;

create or replace function public.customer_record_web_preferences(
  p_tenant_id uuid,
  p_anonymous_id uuid,
  p_product_analytics_enabled boolean,
  p_marketing_enabled boolean,
  p_analytics_policy_version text,
  p_marketing_policy_version text,
  p_occurred_at timestamptz
)
returns table (
  profile_id uuid,
  analytics_status text,
  marketing_status text,
  inserted boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_source_profile_id uuid;
  v_profile_id uuid;
  v_current_analytics public.customer_consents;
  v_current_marketing public.customer_consents;
  v_analytics_status text;
  v_marketing_status text;
  v_inserted boolean := false;
  v_has_identity boolean := false;
begin
  if p_tenant_id is null or p_anonymous_id is null
     or p_product_analytics_enabled is null or p_marketing_enabled is null
     or char_length(trim(coalesce(p_analytics_policy_version, ''))) not between 1 and 80
     or char_length(trim(coalesce(p_marketing_policy_version, ''))) not between 1 and 80
     or p_occurred_at is null or p_occurred_at > now() + interval '5 minutes' then
    raise exception using errcode = '22023', message = 'CUSTOMER_PREFERENCES_INPUT_INVALID';
  end if;

  insert into public.customer_profiles as profile (tenant_id, anonymous_id)
  values (p_tenant_id, p_anonymous_id)
  on conflict (tenant_id, anonymous_id) do update set
    updated_at = greatest(profile.updated_at, now())
  returning profile.id into v_source_profile_id;

  v_profile_id := public.customer_canonical_profile_id(p_tenant_id, v_source_profile_id);
  if v_profile_id is null then
    raise exception using errcode = 'P0002', message = 'CUSTOMER_PROFILE_NOT_FOUND';
  end if;

  select consent.* into v_current_analytics
  from public.customer_consents consent
  where consent.tenant_id = p_tenant_id
    and consent.profile_id = v_profile_id
    and consent.purpose = 'product_analytics'
  order by consent.occurred_at desc, consent.sequence_no desc
  limit 1;

  v_analytics_status := case
    when p_product_analytics_enabled then 'granted'
    when v_current_analytics.status in ('granted', 'revoked') then 'revoked'
    else 'denied'
  end;
  if v_current_analytics.id is null
     or v_current_analytics.status <> v_analytics_status
     or v_current_analytics.policy_version <> trim(p_analytics_policy_version) then
    perform public.customer_record_consent(
      p_tenant_id, v_profile_id, 'product_analytics', v_analytics_status,
      'web', trim(p_analytics_policy_version),
      jsonb_build_object('surface', 'privacy-center'), p_occurred_at
    );
    v_inserted := true;
  end if;

  select consent.* into v_current_marketing
  from public.customer_consents consent
  where consent.tenant_id = p_tenant_id
    and consent.profile_id = v_profile_id
    and consent.purpose = 'marketing_communications'
  order by consent.occurred_at desc, consent.sequence_no desc
  limit 1;

  v_marketing_status := case
    when p_marketing_enabled then 'granted'
    when v_current_marketing.status in ('granted', 'revoked') then 'revoked'
    else 'denied'
  end;
  if v_current_marketing.id is null
     or v_current_marketing.status <> v_marketing_status
     or v_current_marketing.policy_version <> trim(p_marketing_policy_version) then
    perform public.customer_record_consent(
      p_tenant_id, v_profile_id, 'marketing_communications', v_marketing_status,
      'web', trim(p_marketing_policy_version),
      jsonb_build_object('surface', 'privacy-center'), p_occurred_at
    );
    v_inserted := true;
  end if;

  select exists (
    select 1 from public.customer_identities identity
    where identity.tenant_id = p_tenant_id and identity.profile_id = v_profile_id
  ) into v_has_identity;

  insert into public.customer_segments as segment (
    tenant_id, profile_id, segment_key, rule_version, active, evidence, computed_at
  ) values (
    p_tenant_id, v_profile_id, 'marketing-reachable', 'cus05-v1',
    v_marketing_status = 'granted' and v_has_identity,
    jsonb_build_object('basis', 'current-marketing-consent-and-protected-contact'), now()
  )
  on conflict on constraint customer_segments_version_unique do update set
    active = excluded.active,
    evidence = excluded.evidence,
    computed_at = excluded.computed_at;

  if v_inserted then
    insert into public.customer_identity_audit_events (
      tenant_id, profile_id, actor_kind, event_type, purpose, metadata
    ) values (
      p_tenant_id, v_profile_id, 'customer', 'consent-updated',
      'update-web-preferences',
      jsonb_build_object(
        'analytics_status', v_analytics_status,
        'marketing_status', v_marketing_status
      )
    );
  end if;

  return query select v_profile_id, v_analytics_status, v_marketing_status, v_inserted;
end;
$$;

create or replace function public.customer_submit_progressive_identity(
  p_tenant_id uuid,
  p_request_id uuid,
  p_journey_id uuid,
  p_anonymous_id uuid,
  p_identity_type text,
  p_identity_digest text,
  p_identity_ciphertext text,
  p_encryption_key_version text,
  p_marketing_enabled boolean,
  p_service_policy_version text,
  p_marketing_policy_version text,
  p_occurred_at timestamptz
)
returns table (
  profile_id uuid,
  identity_id uuid,
  delivery_request_id uuid,
  delivery_status text,
  marketing_status text,
  merged boolean,
  inserted boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_source_profile public.customer_profiles;
  v_source_canonical_id uuid;
  v_target_profile_id uuid;
  v_existing_identity public.customer_identities;
  v_identity_id uuid;
  v_existing_request public.customer_itinerary_delivery_requests;
  v_request_id uuid;
  v_current_marketing public.customer_consents;
  v_marketing_status text;
  v_merged boolean := false;
  v_delivery_channel text;
begin
  if p_tenant_id is null or p_request_id is null or p_journey_id is null
     or p_anonymous_id is null or p_marketing_enabled is null
     or p_identity_type not in ('phone', 'email')
     or p_identity_digest !~ '^[0-9a-f]{64}$'
     or char_length(p_identity_ciphertext) not between 24 and 4096
     or char_length(trim(coalesce(p_encryption_key_version, ''))) not between 1 and 40
     or char_length(trim(coalesce(p_service_policy_version, ''))) not between 1 and 80
     or char_length(trim(coalesce(p_marketing_policy_version, ''))) not between 1 and 80
     or p_occurred_at is null or p_occurred_at > now() + interval '5 minutes' then
    raise exception using errcode = '22023', message = 'CUSTOMER_CONTACT_INPUT_INVALID';
  end if;

  select request.* into v_existing_request
  from public.customer_itinerary_delivery_requests request
  where request.tenant_id = p_tenant_id and request.idempotency_key = p_request_id;
  if v_existing_request.id is not null then
    select profile.id into v_source_canonical_id
    from public.customer_profiles profile
    where profile.tenant_id = p_tenant_id
      and profile.anonymous_id = p_anonymous_id;
    v_source_canonical_id := public.customer_canonical_profile_id(
      p_tenant_id, v_source_canonical_id
    );
    if v_source_canonical_id is null
       or v_existing_request.profile_id <> v_source_canonical_id then
      raise exception using errcode = '42501', message = 'CUSTOMER_JOURNEY_OWNERSHIP_REQUIRED';
    end if;
    select identity.* into v_existing_identity
    from public.customer_identities identity
    where identity.id = v_existing_request.identity_id
      and identity.tenant_id = p_tenant_id;
    if v_existing_request.journey_id <> p_journey_id
       or v_existing_identity.identity_type <> p_identity_type
       or v_existing_identity.identity_digest <> p_identity_digest then
      raise exception using errcode = '23505', message = 'CUSTOMER_CONTACT_ID_COLLISION';
    end if;
    select consent.status into v_marketing_status
    from public.customer_consents consent
    where consent.tenant_id = p_tenant_id
      and consent.profile_id = v_existing_request.profile_id
      and consent.purpose = 'marketing_communications'
    order by consent.occurred_at desc, consent.sequence_no desc
    limit 1;
    return query select
      v_existing_request.profile_id, v_existing_request.identity_id,
      v_existing_request.id, v_existing_request.status,
      coalesce(v_marketing_status, 'denied'), false, false;
    return;
  end if;

  select profile.* into v_source_profile
  from public.customer_profiles profile
  where profile.tenant_id = p_tenant_id and profile.anonymous_id = p_anonymous_id
  for update;
  if v_source_profile.id is null then
    raise exception using errcode = 'P0002', message = 'CUSTOMER_PROFILE_NOT_FOUND';
  end if;

  perform 1 from public.customer_journeys journey
  where journey.tenant_id = p_tenant_id
    and journey.id = p_journey_id
    and journey.profile_id = v_source_profile.id;
  if not found then
    raise exception using errcode = '42501', message = 'CUSTOMER_JOURNEY_OWNERSHIP_REQUIRED';
  end if;

  if (
    select count(*) from public.customer_itinerary_delivery_requests request
    where request.tenant_id = p_tenant_id
      and request.journey_id = p_journey_id
      and request.created_at > now() - interval '1 hour'
  ) >= 5 then
    raise exception using errcode = '54000', message = 'CUSTOMER_CONTACT_RATE_LIMITED';
  end if;

  v_source_canonical_id := public.customer_canonical_profile_id(
    p_tenant_id, v_source_profile.id
  );
  select identity.* into v_existing_identity
  from public.customer_identities identity
  where identity.tenant_id = p_tenant_id
    and identity.identity_type = p_identity_type
    and identity.identity_digest = p_identity_digest
  for update;

  if v_existing_identity.id is not null then
    v_target_profile_id := public.customer_canonical_profile_id(
      p_tenant_id, v_existing_identity.profile_id
    );
    v_identity_id := v_existing_identity.id;
    if v_target_profile_id <> v_source_canonical_id then
      perform 1 from public.customer_profiles profile
      where profile.id = v_source_canonical_id
        and profile.tenant_id = p_tenant_id
        and profile.status = 'anonymous'
      for update;
      if not found or v_target_profile_id = v_source_canonical_id then
        raise exception using errcode = '23505', message = 'CUSTOMER_IDENTITY_MERGE_REVIEW_REQUIRED';
      end if;
      update public.customer_profiles
      set status = 'merged', canonical_profile_id = v_target_profile_id, updated_at = now()
      where id = v_source_canonical_id and tenant_id = p_tenant_id;
      v_merged := true;
      insert into public.customer_identity_audit_events (
        tenant_id, profile_id, identity_id, actor_kind, event_type, purpose, metadata
      ) values (
        p_tenant_id, v_target_profile_id, v_identity_id, 'system',
        'profile-merged', 'same-protected-contact',
        jsonb_build_object('method', p_identity_type)
      );
    end if;
  else
    v_target_profile_id := v_source_canonical_id;
    insert into public.customer_identities (
      tenant_id, profile_id, identity_type, identity_digest,
      identity_ciphertext, encryption_key_version
    ) values (
      p_tenant_id, v_target_profile_id, p_identity_type, p_identity_digest,
      p_identity_ciphertext, trim(p_encryption_key_version)
    )
    returning id into v_identity_id;
    update public.customer_profiles
    set status = 'identified', updated_at = now()
    where id = v_target_profile_id and tenant_id = p_tenant_id and status = 'anonymous';
    insert into public.customer_identity_audit_events (
      tenant_id, profile_id, identity_id, actor_kind, event_type, purpose, metadata
    ) values (
      p_tenant_id, v_target_profile_id, v_identity_id, 'customer',
      'identity-linked', 'save-itinerary',
      jsonb_build_object('method', p_identity_type)
    );
  end if;

  perform public.customer_record_consent(
    p_tenant_id, v_target_profile_id, 'essential_service', 'granted',
    'web', trim(p_service_policy_version),
    jsonb_build_object('surface', 'journey-save', 'delivery_channel', p_identity_type),
    p_occurred_at
  );

  select consent.* into v_current_marketing
  from public.customer_consents consent
  where consent.tenant_id = p_tenant_id
    and consent.profile_id = v_target_profile_id
    and consent.purpose = 'marketing_communications'
  order by consent.occurred_at desc, consent.sequence_no desc
  limit 1;
  v_marketing_status := case
    when p_marketing_enabled then 'granted'
    when v_current_marketing.status in ('granted', 'revoked') then 'revoked'
    else 'denied'
  end;
  if v_current_marketing.id is null
     or v_current_marketing.status <> v_marketing_status
     or v_current_marketing.policy_version <> trim(p_marketing_policy_version) then
    perform public.customer_record_consent(
      p_tenant_id, v_target_profile_id, 'marketing_communications',
      v_marketing_status, 'web', trim(p_marketing_policy_version),
      jsonb_build_object('surface', 'journey-save', 'delivery_channel', p_identity_type),
      p_occurred_at
    );
  end if;

  v_delivery_channel := case when p_identity_type = 'phone' then 'sms' else 'email' end;
  insert into public.customer_itinerary_delivery_requests (
    id, tenant_id, journey_id, profile_id, identity_id,
    delivery_channel, status, idempotency_key
  ) values (
    p_request_id, p_tenant_id, p_journey_id, v_target_profile_id, v_identity_id,
    v_delivery_channel, 'staged', p_request_id
  ) returning id into v_request_id;

  insert into public.customer_segments as segment (
    tenant_id, profile_id, segment_key, rule_version, active, evidence, computed_at
  ) values
    (
      p_tenant_id, v_target_profile_id, 'identified-service-contact', 'cus05-v1',
      true, jsonb_build_object('basis', 'protected-contact'), now()
    ),
    (
      p_tenant_id, v_target_profile_id, 'marketing-reachable', 'cus05-v1',
      v_marketing_status = 'granted',
      jsonb_build_object('basis', 'current-marketing-consent-and-protected-contact'), now()
    )
  on conflict on constraint customer_segments_version_unique do update set
    active = excluded.active,
    evidence = excluded.evidence,
    computed_at = excluded.computed_at;

  insert into public.customer_identity_audit_events (
    tenant_id, profile_id, identity_id, actor_kind, event_type, purpose, metadata
  ) values
    (
      p_tenant_id, v_target_profile_id, v_identity_id, 'customer',
      'consent-updated', 'save-itinerary',
      jsonb_build_object('essential_status', 'granted', 'marketing_status', v_marketing_status)
    ),
    (
      p_tenant_id, v_target_profile_id, v_identity_id, 'customer',
      'delivery-requested', 'save-itinerary',
      jsonb_build_object('delivery_channel', v_delivery_channel, 'status', 'staged')
    );

  return query select
    v_target_profile_id, v_identity_id, v_request_id, 'staged'::text,
    v_marketing_status, v_merged, true;
end;
$$;

create or replace function public.customer_audit_360_access(
  p_tenant_id uuid,
  p_actor_account_id text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_audit_id uuid;
begin
  if not public.erp_account_has_active_role(
    p_tenant_id, trim(coalesce(p_actor_account_id, '')), 'director', null
  ) then
    raise exception using errcode = '42501', message = 'CUSTOMER_360_DIRECTOR_REQUIRED';
  end if;
  insert into public.customer_identity_audit_events (
    tenant_id, actor_kind, actor_account_id, event_type, purpose, metadata
  ) values (
    p_tenant_id, 'erp', trim(p_actor_account_id), 'customer-360-viewed',
    'customer-360-list', jsonb_build_object('scope', 'protected-metadata-only')
  ) returning id into v_audit_id;
  return v_audit_id;
end;
$$;

alter table public.customer_itinerary_delivery_requests enable row level security;
alter table public.customer_segments enable row level security;
alter table public.customer_identity_audit_events enable row level security;

revoke all on table public.customer_itinerary_delivery_requests,
  public.customer_segments, public.customer_identity_audit_events
  from public, anon, authenticated, service_role;
grant select on table public.customer_itinerary_delivery_requests,
  public.customer_segments, public.customer_identity_audit_events
  to service_role;

revoke all on function public.customer_canonical_profile_id(uuid, uuid),
  public.customer_record_web_preferences(uuid, uuid, boolean, boolean, text, text, timestamptz),
  public.customer_submit_progressive_identity(uuid, uuid, uuid, uuid, text, text, text, text, boolean, text, text, timestamptz),
  public.customer_audit_360_access(uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function
  public.customer_record_web_preferences(uuid, uuid, boolean, boolean, text, text, timestamptz),
  public.customer_submit_progressive_identity(uuid, uuid, uuid, uuid, text, text, text, text, boolean, text, text, timestamptz),
  public.customer_audit_360_access(uuid, text)
  to service_role;

commit;
