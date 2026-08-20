-- CUS-07: transparent, versioned customer recommendations and a consent-gated
-- outbound action queue. This migration deliberately contains no provider
-- credential, sender identity, webhook, or external send capability.

begin;

create table if not exists public.customer_recommendation_rules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  rule_key text not null check (rule_key ~ '^[a-z0-9-]{3,80}$'),
  rule_version text not null check (rule_version ~ '^[a-z0-9.-]{3,80}$'),
  target_product_id uuid not null references public.products(id) on delete restrict,
  reason_code text not null check (reason_code ~ '^[a-z0-9_]{3,80}$'),
  criteria jsonb not null check (
    jsonb_typeof(criteria) = 'object'
    and pg_catalog.octet_length(criteria::text) <= 2048
    and not public.customer_json_contains_pii(criteria)
  ),
  active boolean not null default true,
  approved_by text not null default 'xuan-truong-policy-pending',
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (tenant_id, rule_key, rule_version)
);

create table if not exists public.customer_recommendations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  profile_id uuid not null,
  journey_id uuid not null,
  rule_id uuid not null references public.customer_recommendation_rules(id) on delete restrict,
  target_product_id uuid not null references public.products(id) on delete restrict,
  rule_version text not null check (rule_version ~ '^[a-z0-9.-]{3,80}$'),
  reason_code text not null check (reason_code ~ '^[a-z0-9_]{3,80}$'),
  status text not null default 'available' check (status in ('available', 'shown', 'clicked', 'accepted', 'suppressed', 'expired')),
  evidence jsonb not null default '{}'::jsonb check (
    jsonb_typeof(evidence) = 'object'
    and pg_catalog.octet_length(evidence::text) <= 4096
    and not public.customer_json_contains_pii(evidence)
  ),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (profile_id, tenant_id) references public.customer_profiles(id, tenant_id) on delete restrict,
  foreign key (journey_id, tenant_id) references public.customer_journeys(id, tenant_id) on delete restrict,
  unique (tenant_id, profile_id, journey_id, rule_id)
);

create index if not exists customer_recommendations_profile_idx
  on public.customer_recommendations(tenant_id, profile_id, status, created_at desc);

create table if not exists public.customer_outbound_actions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  profile_id uuid not null,
  recommendation_id uuid not null references public.customer_recommendations(id) on delete restrict,
  identity_id uuid not null,
  channel text not null check (channel in ('email', 'sms', 'zalo')),
  action_type text not null default 'recommendation' check (action_type in ('recommendation')),
  status text not null check (status in ('staged', 'suppressed', 'simulated-delivered', 'failed', 'dead-letter', 'cancelled')),
  suppression_reason text check (suppression_reason in ('marketing-consent-required', 'frequency-cap', 'opted-out')),
  idempotency_key uuid not null,
  template_code text not null check (template_code ~ '^[a-z0-9-]{3,80}$'),
  payload jsonb not null default '{}'::jsonb check (
    jsonb_typeof(payload) = 'object'
    and pg_catalog.octet_length(payload::text) <= 4096
    and not public.customer_json_contains_pii(payload)
  ),
  policy_version text not null check (char_length(trim(policy_version)) between 3 and 80),
  created_by_account_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (profile_id, tenant_id) references public.customer_profiles(id, tenant_id) on delete restrict,
  foreign key (identity_id, tenant_id) references public.customer_identities(id, tenant_id) on delete restrict,
  unique (tenant_id, idempotency_key)
);

create index if not exists customer_outbound_actions_frequency_idx
  on public.customer_outbound_actions(tenant_id, profile_id, channel, created_at desc);

create table if not exists public.customer_outbound_action_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  action_id uuid not null references public.customer_outbound_actions(id) on delete restrict,
  event_type text not null check (event_type in ('staged', 'suppressed', 'simulated-delivered', 'failed', 'dead-letter', 'cancelled')),
  outcome_code text not null check (outcome_code ~ '^[a-z0-9-]{3,80}$'),
  adapter_name text not null check (adapter_name ~ '^[a-z0-9-]{3,80}$'),
  adapter_version text not null check (adapter_version ~ '^[a-z0-9.-]{3,80}$'),
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb check (
    jsonb_typeof(metadata) = 'object'
    and pg_catalog.octet_length(metadata::text) <= 2048
    and not public.customer_json_contains_pii(metadata)
  )
);

drop trigger if exists customer_outbound_action_events_append_only on public.customer_outbound_action_events;
create trigger customer_outbound_action_events_append_only
before update or delete on public.customer_outbound_action_events
for each row execute function public.customer_append_only();

create or replace function public.customer_refresh_recommendations(
  p_tenant_id uuid,
  p_profile_id uuid,
  p_occurred_at timestamptz default now()
)
returns table (recommendation_id uuid, inserted boolean)
language plpgsql security definer set search_path = ''
as $$
declare
  v_profile_id uuid;
  v_journey public.customer_journeys;
  v_rule public.customer_recommendation_rules;
  v_matches boolean;
  v_inserted_id uuid;
begin
  v_profile_id := public.customer_canonical_profile_id(p_tenant_id, p_profile_id);
  if v_profile_id is null then
    raise exception using errcode = 'P0002', message = 'CUSTOMER_PROFILE_NOT_FOUND';
  end if;
  if p_occurred_at < now() - interval '7 days' or p_occurred_at > now() + interval '5 minutes' then
    raise exception using errcode = '22023', message = 'CUSTOMER_RECOMMENDATION_TIME_INVALID';
  end if;
  select journey.* into v_journey from public.customer_journeys journey
  where journey.tenant_id = p_tenant_id and journey.profile_id in (p_profile_id, v_profile_id)
  order by journey.created_at desc limit 1;
  if v_journey.id is null then return; end if;

  for v_rule in
    select * from public.customer_recommendation_rules rule
    where rule.tenant_id = p_tenant_id and rule.active
    order by rule.rule_key
  loop
    v_matches := case v_rule.rule_key
      when 'family-explicit' then coalesce((v_journey.intent_summary #>> '{party,children}')::integer, 0) > 0
      when 'slow-pace' then coalesce(v_journey.intent_summary ->> 'pace', '') = 'relaxed'
        or coalesce(v_journey.intent_summary ->> 'walking_tolerance', '') = 'low'
      when 'active-photography' then coalesce(v_journey.intent_summary ->> 'pace', '') = 'active'
        and coalesce(v_journey.intent_summary -> 'interests', '[]'::jsonb) ? 'photography'
      else false
    end;
    if v_matches and not exists (
      select 1 from public.customer_orders purchase
      where purchase.tenant_id = p_tenant_id and purchase.profile_id = v_profile_id
        and purchase.product_id = v_rule.target_product_id and purchase.status = 'confirmed'
    ) then
      insert into public.customer_recommendations as recommendation (
        tenant_id, profile_id, journey_id, rule_id, target_product_id, rule_version,
        reason_code, evidence, expires_at
      ) values (
        p_tenant_id, v_profile_id, v_journey.id, v_rule.id, v_rule.target_product_id,
        v_rule.rule_version, v_rule.reason_code,
        jsonb_build_object('journey_id', v_journey.id, 'rule_key', v_rule.rule_key),
        p_occurred_at + interval '30 days'
      ) on conflict (tenant_id, profile_id, journey_id, rule_id) do nothing
      returning recommendation.id into v_inserted_id;
      if v_inserted_id is not null then
        return query select v_inserted_id, true;
      end if;
    end if;
  end loop;
end;
$$;

create or replace function public.customer_stage_recommendation_outbound(
  p_tenant_id uuid, p_recommendation_id uuid, p_identity_id uuid, p_channel text,
  p_idempotency_key uuid, p_template_code text, p_policy_version text,
  p_actor_account_id text, p_occurred_at timestamptz default now()
)
returns table (action_id uuid, action_status text, inserted boolean)
language plpgsql security definer set search_path = ''
as $$
declare
  v_recommendation public.customer_recommendations;
  v_identity public.customer_identities;
  v_existing public.customer_outbound_actions;
  v_marketing_status text;
  v_status text;
  v_suppression text;
  v_action_id uuid;
begin
  if not public.erp_account_has_active_role(p_tenant_id, trim(coalesce(p_actor_account_id, '')), 'director', null) then
    raise exception using errcode = '42501', message = 'CUSTOMER_OUTBOUND_DIRECTOR_REQUIRED';
  end if;
  if p_channel not in ('email', 'sms', 'zalo') or p_idempotency_key is null
     or trim(coalesce(p_template_code, '')) !~ '^[a-z0-9-]{3,80}$'
     or char_length(trim(coalesce(p_policy_version, ''))) not between 3 and 80 then
    raise exception using errcode = '22023', message = 'CUSTOMER_OUTBOUND_INPUT_INVALID';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(p_tenant_id::text || ':' || p_recommendation_id::text || ':' || p_channel));
  select * into v_existing from public.customer_outbound_actions action
    where action.tenant_id = p_tenant_id and action.idempotency_key = p_idempotency_key;
  if v_existing.id is not null then
    if v_existing.recommendation_id <> p_recommendation_id or v_existing.identity_id <> p_identity_id or v_existing.channel <> p_channel then
      raise exception using errcode = '23505', message = 'CUSTOMER_OUTBOUND_ID_COLLISION';
    end if;
    return query select v_existing.id, v_existing.status, false; return;
  end if;
  select * into v_recommendation from public.customer_recommendations recommendation
    where recommendation.id = p_recommendation_id and recommendation.tenant_id = p_tenant_id for update;
  if v_recommendation.id is null or v_recommendation.expires_at <= p_occurred_at then
    raise exception using errcode = 'P0002', message = 'CUSTOMER_RECOMMENDATION_UNAVAILABLE';
  end if;
  select * into v_identity from public.customer_identities identity
    where identity.id = p_identity_id and identity.tenant_id = p_tenant_id
      and identity.profile_id = v_recommendation.profile_id;
  if v_identity.id is null or (p_channel = 'email' and v_identity.identity_type <> 'email')
     or (p_channel in ('sms', 'zalo') and v_identity.identity_type <> 'phone') then
    raise exception using errcode = '42501', message = 'CUSTOMER_OUTBOUND_IDENTITY_REQUIRED';
  end if;
  select consent.status into v_marketing_status from public.customer_consents consent
    where consent.tenant_id = p_tenant_id and consent.profile_id = v_recommendation.profile_id
      and consent.purpose = 'marketing_communications'
    order by consent.occurred_at desc, consent.created_at desc limit 1;
  -- `IS DISTINCT FROM` intentionally treats an absent consent as not granted.
  -- Plain `<>` would yield NULL and accidentally fall through to staging.
  if v_marketing_status is distinct from 'granted' then
    v_status := 'suppressed'; v_suppression := case when v_marketing_status = 'revoked' then 'opted-out' else 'marketing-consent-required' end;
  elsif (select count(*) from public.customer_outbound_actions action
      where action.tenant_id = p_tenant_id and action.profile_id = v_recommendation.profile_id
        and action.channel = p_channel and action.created_at > p_occurred_at - interval '7 days'
        and action.status in ('staged', 'simulated-delivered')) >= 2 then
    v_status := 'suppressed'; v_suppression := 'frequency-cap';
  else
    v_status := 'staged'; v_suppression := null;
  end if;
  insert into public.customer_outbound_actions (
    tenant_id, profile_id, recommendation_id, identity_id, channel, status, suppression_reason,
    idempotency_key, template_code, payload, policy_version, created_by_account_id
  ) values (
    p_tenant_id, v_recommendation.profile_id, p_recommendation_id, p_identity_id, p_channel,
    v_status, v_suppression, p_idempotency_key, trim(p_template_code),
    jsonb_build_object('recommendation_id', p_recommendation_id, 'rule_version', v_recommendation.rule_version),
    trim(p_policy_version), trim(p_actor_account_id)
  ) returning id into v_action_id;
  insert into public.customer_outbound_action_events (tenant_id, action_id, event_type, outcome_code, adapter_name, adapter_version)
  values (p_tenant_id, v_action_id, v_status, coalesce(v_suppression, 'simulation-staged'), 'outbound-simulation', '1.0');
  return query select v_action_id, v_status, true;
end;
$$;

insert into public.customer_recommendation_rules (
  tenant_id, rule_key, rule_version, target_product_id, reason_code, criteria
) values
  ('00000000-0000-4000-8000-000000000001', 'family-explicit', '1.0', '40000000-0000-4000-8000-000000000003', 'explicit_party_children', '{"requires":"party.children>0"}'),
  ('00000000-0000-4000-8000-000000000001', 'slow-pace', '1.0', '40000000-0000-4000-8000-000000000002', 'explicit_relaxed_or_low_walking', '{"requires":"pace=relaxed OR walking_tolerance=low"}'),
  ('00000000-0000-4000-8000-000000000001', 'active-photography', '1.0', '40000000-0000-4000-8000-000000000004', 'explicit_active_photography', '{"requires":"pace=active AND interests includes photography"}')
on conflict (tenant_id, rule_key, rule_version) do update set
  target_product_id = excluded.target_product_id, reason_code = excluded.reason_code,
  criteria = excluded.criteria, active = true;

alter table public.customer_recommendation_rules enable row level security;
alter table public.customer_recommendations enable row level security;
alter table public.customer_outbound_actions enable row level security;
alter table public.customer_outbound_action_events enable row level security;
revoke all on table public.customer_recommendation_rules, public.customer_recommendations,
  public.customer_outbound_actions, public.customer_outbound_action_events
  from public, anon, authenticated, service_role;
grant select on table public.customer_recommendation_rules, public.customer_recommendations,
  public.customer_outbound_actions, public.customer_outbound_action_events to service_role;
revoke all on function public.customer_refresh_recommendations(uuid, uuid, timestamptz),
  public.customer_stage_recommendation_outbound(uuid, uuid, uuid, text, uuid, text, text, text, timestamptz)
  from public, anon, authenticated, service_role;
grant execute on function public.customer_refresh_recommendations(uuid, uuid, timestamptz),
  public.customer_stage_recommendation_outbound(uuid, uuid, uuid, text, uuid, text, text, text, timestamptz)
  to service_role;

commit;
