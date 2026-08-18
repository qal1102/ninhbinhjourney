-- CUS-03: persist the intentional, anonymous planner journey without storing
-- raw prompts or direct contact data. Customer 360 reads this alongside the
-- append-only CUS-01 event timeline through the server role only.

begin;

create table if not exists public.customer_journeys (
  id uuid primary key,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  profile_id uuid not null,
  intent_summary jsonb not null check (
    jsonb_typeof(intent_summary) = 'object'
    and pg_catalog.octet_length(intent_summary::text) <= 8192
    and not public.customer_json_contains_pii(intent_summary)
  ),
  itinerary_snapshot jsonb not null check (
    jsonb_typeof(itinerary_snapshot) = 'object'
    and pg_catalog.octet_length(itinerary_snapshot::text) <= 16384
    and not public.customer_json_contains_pii(itinerary_snapshot)
  ),
  source_context jsonb not null default '{}'::jsonb check (
    jsonb_typeof(source_context) = 'object'
    and pg_catalog.octet_length(source_context::text) <= 4096
    and not public.customer_json_contains_pii(source_context)
  ),
  created_at timestamptz not null default now(),
  foreign key (profile_id, tenant_id)
    references public.customer_profiles(id, tenant_id) on delete restrict,
  unique (id, tenant_id)
);

create index if not exists customer_journeys_profile_created_idx
  on public.customer_journeys(tenant_id, profile_id, created_at desc);
create index if not exists customer_journeys_created_idx
  on public.customer_journeys(tenant_id, created_at desc);

drop trigger if exists customer_journeys_append_only on public.customer_journeys;
create trigger customer_journeys_append_only
before update or delete on public.customer_journeys
for each row execute function public.customer_append_only();

create or replace function public.customer_create_anonymous_journey(
  p_tenant_id uuid,
  p_journey_id uuid,
  p_anonymous_id uuid,
  p_intent_summary jsonb,
  p_itinerary_snapshot jsonb,
  p_source_context jsonb
)
returns table (
  journey_id uuid,
  profile_id uuid,
  inserted boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid;
  v_inserted_journey_id uuid;
  v_existing public.customer_journeys;
  v_intent jsonb := coalesce(p_intent_summary, '{}'::jsonb);
  v_itinerary jsonb := coalesce(p_itinerary_snapshot, '{}'::jsonb);
  v_source jsonb := coalesce(p_source_context, '{}'::jsonb);
begin
  if p_tenant_id is null or p_journey_id is null or p_anonymous_id is null then
    raise exception using errcode = '22023', message = 'CUSTOMER_JOURNEY_ID_REQUIRED';
  end if;

  if jsonb_typeof(v_intent) <> 'object'
     or jsonb_typeof(v_itinerary) <> 'object'
     or jsonb_typeof(v_source) <> 'object'
     or pg_catalog.octet_length(v_intent::text) > 8192
     or pg_catalog.octet_length(v_itinerary::text) > 16384
     or pg_catalog.octet_length(v_source::text) > 4096 then
    raise exception using errcode = '22023', message = 'CUSTOMER_JOURNEY_PAYLOAD_INVALID';
  end if;

  if public.customer_json_contains_pii(v_intent)
     or public.customer_json_contains_pii(v_itinerary)
     or public.customer_json_contains_pii(v_source) then
    raise exception using errcode = '22023', message = 'CUSTOMER_JOURNEY_PII_FORBIDDEN';
  end if;

  insert into public.customer_profiles as existing (tenant_id, anonymous_id)
  values (p_tenant_id, p_anonymous_id)
  on conflict (tenant_id, anonymous_id) do update set
    updated_at = greatest(existing.updated_at, now())
  returning existing.id into v_profile_id;

  insert into public.customer_journeys as journey (
    id, tenant_id, profile_id, intent_summary, itinerary_snapshot, source_context
  ) values (
    p_journey_id, p_tenant_id, v_profile_id, v_intent, v_itinerary, v_source
  )
  on conflict on constraint customer_journeys_pkey do nothing
  returning journey.id into v_inserted_journey_id;

  if v_inserted_journey_id is null then
    select * into v_existing
    from public.customer_journeys journey
    where journey.id = p_journey_id;

    if v_existing.tenant_id is distinct from p_tenant_id
       or v_existing.profile_id is distinct from v_profile_id
       or v_existing.intent_summary is distinct from v_intent
       or v_existing.itinerary_snapshot is distinct from v_itinerary
       or v_existing.source_context is distinct from v_source then
      raise exception using errcode = '23505', message = 'CUSTOMER_JOURNEY_ID_COLLISION';
    end if;
  end if;

  return query select p_journey_id, v_profile_id, v_inserted_journey_id is not null;
end;
$$;

alter table public.customer_journeys enable row level security;

revoke all on table public.customer_journeys
  from public, anon, authenticated, service_role;
grant select on table public.customer_journeys to service_role;

revoke all on function public.customer_create_anonymous_journey(
  uuid, uuid, uuid, jsonb, jsonb, jsonb
) from public, anon, authenticated, service_role;
grant execute on function public.customer_create_anonymous_journey(
  uuid, uuid, uuid, jsonb, jsonb, jsonb
) to service_role;

commit;
