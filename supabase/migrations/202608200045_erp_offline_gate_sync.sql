-- CUS-08 / A3: offline gate manifests and idempotent reconciliation on top of
-- the existing T8 ticket source. No ticket, capacity, or customer profile is
-- duplicated. The manifest exposes only SHA-256 ticket-code digests and
-- remaining-entry counts; guest identity never leaves the server.

begin;

create table if not exists public.erp_gate_offline_manifests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete restrict,
  device_id uuid not null,
  actor_account_id text not null check (char_length(actor_account_id) between 2 and 100),
  service_date date not null,
  ticket_count integer not null check (ticket_count >= 0),
  snapshot_digest text not null check (snapshot_digest ~ '^[0-9a-f]{64}$'),
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  unique (id, tenant_id),
  check (expires_at > issued_at and expires_at <= issued_at + interval '12 hours')
);

create index if not exists erp_gate_offline_manifests_device_idx
  on public.erp_gate_offline_manifests(tenant_id, site_id, device_id, issued_at desc);

create table if not exists public.erp_gate_offline_sync_batches (
  id uuid primary key,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete restrict,
  manifest_id uuid not null,
  device_id uuid not null,
  actor_account_id text not null check (char_length(actor_account_id) between 2 and 100),
  item_count integer not null check (item_count between 1 and 200),
  accepted_count integer not null check (accepted_count >= 0),
  refused_count integer not null check (refused_count >= 0),
  replayed_count integer not null check (replayed_count >= 0),
  diverged_count integer not null check (diverged_count >= 0),
  completed_at timestamptz not null default now(),
  foreign key (manifest_id, tenant_id)
    references public.erp_gate_offline_manifests(id, tenant_id) on delete restrict,
  unique (id, tenant_id),
  check (accepted_count + refused_count = item_count),
  check (replayed_count <= item_count and diverged_count <= item_count)
);

create table if not exists public.erp_gate_offline_sync_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  batch_id uuid not null,
  manifest_id uuid not null,
  scan_event_id uuid not null references public.erp_gate_scan_events(id) on delete restrict,
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 128),
  sequence_no integer not null check (sequence_no between 1 and 200),
  client_scanned_at timestamptz not null,
  server_scanned_at timestamptz not null,
  local_result text not null check (local_result in ('accepted', 'not-found', 'exhausted')),
  server_result text not null check (server_result in ('accepted', 'not-found', 'wrong-site', 'wrong-day', 'exhausted', 'void')),
  reconciliation_status text not null check (reconciliation_status in ('matched', 'diverged')),
  replayed boolean not null,
  created_at timestamptz not null default now(),
  foreign key (batch_id, tenant_id)
    references public.erp_gate_offline_sync_batches(id, tenant_id) on delete restrict,
  foreign key (manifest_id, tenant_id)
    references public.erp_gate_offline_manifests(id, tenant_id) on delete restrict,
  unique (tenant_id, idempotency_key),
  unique (batch_id, sequence_no)
);

create index if not exists erp_gate_offline_sync_items_reconciliation_idx
  on public.erp_gate_offline_sync_items(tenant_id, reconciliation_status, client_scanned_at desc);

drop trigger if exists erp_gate_offline_manifests_immutable on public.erp_gate_offline_manifests;
create trigger erp_gate_offline_manifests_immutable
before update or delete on public.erp_gate_offline_manifests
for each row execute function public.customer_append_only();

drop trigger if exists erp_gate_offline_sync_batches_immutable on public.erp_gate_offline_sync_batches;
create trigger erp_gate_offline_sync_batches_immutable
before update or delete on public.erp_gate_offline_sync_batches
for each row execute function public.customer_append_only();

drop trigger if exists erp_gate_offline_sync_items_immutable on public.erp_gate_offline_sync_items;
create trigger erp_gate_offline_sync_items_immutable
before update or delete on public.erp_gate_offline_sync_items
for each row execute function public.customer_append_only();

create or replace function public.erp_gate_actor_can_scan(
  p_tenant_id uuid,
  p_site_id uuid,
  p_actor_account_id text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    public.erp_account_has_active_role(p_tenant_id, trim(p_actor_account_id), 'director', null)
    or public.erp_account_has_active_role(p_tenant_id, trim(p_actor_account_id), 'regional-manager', p_site_id)
    or (
      public.erp_account_has_active_role(p_tenant_id, trim(p_actor_account_id), 'employee', p_site_id)
      and exists (
        select 1 from public.erp_employee_access access
        where access.tenant_id = p_tenant_id
          and access.employee_account_id = trim(p_actor_account_id)
          and access.site_id = p_site_id
          and 'check-in-khach' = any(access.module_ids)
      )
    );
$$;

create or replace function public.erp_prepare_offline_gate_manifest(
  p_tenant_id uuid,
  p_site_id uuid,
  p_actor_account_id text,
  p_device_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_manifest_id uuid := gen_random_uuid();
  v_service_date date := (now() at time zone 'Asia/Ho_Chi_Minh')::date;
  v_expires_at timestamptz;
  v_tickets jsonb;
  v_count integer;
  v_digest text;
begin
  if p_device_id is null or not public.erp_gate_actor_can_scan(p_tenant_id, p_site_id, p_actor_account_id) then
    raise exception using errcode = '42501', message = 'GATE_OFFLINE_ACTOR_REQUIRED';
  end if;
  if not exists (select 1 from public.sites site where site.id = p_site_id and site.tenant_id = p_tenant_id) then
    raise exception using errcode = '23503', message = 'GATE_SCAN_SITE_TENANT_MISMATCH';
  end if;

  v_expires_at := least(
    now() + interval '12 hours',
    ((v_service_date + 1)::timestamp at time zone 'Asia/Ho_Chi_Minh')
  );
  select
    coalesce(jsonb_agg(jsonb_build_object(
      'code_digest', encode(extensions.digest(upper(trim(ticket.ticket_code)), 'sha256'), 'hex'),
      'entries_remaining', ticket.entries_allowed - ticket.entries_used
    ) order by ticket.ticket_code), '[]'::jsonb),
    count(*)::integer
  into v_tickets, v_count
  from public.erp_tickets ticket
  where ticket.tenant_id = p_tenant_id
    and ticket.site_id = p_site_id
    and ticket.valid_on = v_service_date
    and ticket.status in ('issued', 'partially-used')
    and ticket.entries_used < ticket.entries_allowed;
  v_digest := encode(extensions.digest(v_tickets::text, 'sha256'), 'hex');

  insert into public.erp_gate_offline_manifests (
    id, tenant_id, site_id, device_id, actor_account_id, service_date,
    ticket_count, snapshot_digest, expires_at
  ) values (
    v_manifest_id, p_tenant_id, p_site_id, p_device_id, trim(p_actor_account_id),
    v_service_date, v_count, v_digest, v_expires_at
  );

  return jsonb_build_object(
    'manifest_id', v_manifest_id,
    'site_id', p_site_id,
    'device_id', p_device_id,
    'service_date', v_service_date,
    'issued_at', now(),
    'expires_at', v_expires_at,
    'ticket_count', v_count,
    'snapshot_digest', v_digest,
    'tickets', v_tickets
  );
end;
$$;

-- One decision function is shared by online and offline scans. The existing
-- six-argument T8 RPC below remains the public online contract and delegates
-- here with server time. Offline sync supplies the captured client time.
create or replace function public.erp_gate_scan_ticket_at(
  p_tenant_id uuid,
  p_site_id uuid,
  p_code text,
  p_actor_account_id text,
  p_actor_name text,
  p_idempotency_key text,
  p_scanned_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text := upper(trim(coalesce(p_code, '')));
  v_actor_id text := trim(coalesce(p_actor_account_id, ''));
  v_actor_name text := trim(coalesce(p_actor_name, ''));
  v_key text := nullif(trim(coalesce(p_idempotency_key, '')), '');
  v_ticket public.erp_tickets;
  v_existing public.erp_gate_scan_events;
  v_result text;
  v_event public.erp_gate_scan_events;
  v_visit_date date := (p_scanned_at at time zone 'Asia/Ho_Chi_Minh')::date;
begin
  if char_length(v_code) < 6 or char_length(v_code) > 60
     or char_length(v_actor_id) not between 2 and 100
     or char_length(v_actor_name) < 1
     or v_key is null or char_length(v_key) > 128
     or p_scanned_at < now() - interval '36 hours'
     or p_scanned_at > now() + interval '5 minutes' then
    raise exception using errcode = '22023', message = 'GATE_SCAN_CODE_INVALID';
  end if;
  if not exists (select 1 from public.sites site where site.id = p_site_id and site.tenant_id = p_tenant_id) then
    raise exception using errcode = '23503', message = 'GATE_SCAN_SITE_TENANT_MISMATCH';
  end if;

  select * into v_existing from public.erp_gate_scan_events event
  where event.tenant_id = p_tenant_id and event.idempotency_key = v_key;
  if v_existing.id is not null then
    if v_existing.site_id <> p_site_id or v_existing.code <> v_code
       or v_existing.scanned_by_account_id <> v_actor_id then
      raise exception using errcode = '23505', message = 'GATE_SCAN_IDEMPOTENCY_CONFLICT';
    end if;
    return jsonb_build_object(
      'event_id', v_existing.id, 'result', v_existing.result,
      'code', v_existing.code, 'scanned_at', v_existing.scanned_at,
      'replayed', true, 'ticket', null
    );
  end if;

  select * into v_ticket from public.erp_tickets ticket
  where ticket.tenant_id = p_tenant_id and ticket.ticket_code = v_code for update;
  if v_ticket.id is null then v_result := 'not-found';
  elsif v_ticket.status = 'void' then v_result := 'void';
  elsif v_ticket.site_id <> p_site_id then v_result := 'wrong-site';
  elsif v_ticket.valid_on <> v_visit_date then v_result := 'wrong-day';
  elsif v_ticket.entries_used >= v_ticket.entries_allowed then v_result := 'exhausted';
  else
    v_result := 'accepted';
    update public.erp_tickets set
      entries_used = entries_used + 1,
      status = case when entries_used + 1 >= entries_allowed then 'used' else 'partially-used' end,
      updated_at = now()
    where id = v_ticket.id returning * into v_ticket;
  end if;

  insert into public.erp_gate_scan_events (
    tenant_id, site_id, code, scanned_by_account_id, scanned_by_name,
    ticket_id, result, idempotency_key
  ) values (
    p_tenant_id, p_site_id, v_code, v_actor_id, v_actor_name,
    case when v_ticket.id is null then null else v_ticket.id end, v_result, v_key
  ) returning * into v_event;

  return jsonb_build_object(
    'event_id', v_event.id, 'result', v_result, 'code', v_code,
    'scanned_at', v_event.scanned_at, 'replayed', false,
    'ticket', case when v_ticket.id is null then null else jsonb_build_object(
      'ticket_code', v_ticket.ticket_code, 'product', v_ticket.product,
      'guest_name', v_ticket.guest_name, 'guest_phone', v_ticket.guest_phone,
      'booking_reference', v_ticket.booking_reference, 'channel', v_ticket.channel,
      'valid_on', v_ticket.valid_on, 'entries_allowed', v_ticket.entries_allowed,
      'entries_used', v_ticket.entries_used, 'status', v_ticket.status
    ) end
  );
end;
$$;

create or replace function public.erp_gate_scan_ticket(
  p_tenant_id uuid, p_site_id uuid, p_code text, p_actor_account_id text,
  p_actor_name text, p_idempotency_key text
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select public.erp_gate_scan_ticket_at(
    p_tenant_id, p_site_id, p_code, p_actor_account_id,
    p_actor_name, p_idempotency_key, now()
  );
$$;

create or replace function public.erp_sync_offline_gate_batch(
  p_tenant_id uuid,
  p_manifest_id uuid,
  p_batch_id uuid,
  p_device_id uuid,
  p_actor_account_id text,
  p_actor_name text,
  p_scans jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_manifest public.erp_gate_offline_manifests;
  v_existing public.erp_gate_offline_sync_batches;
  v_item record;
  v_decision jsonb;
  v_server_result text;
  v_reconciliation text;
  v_count integer;
  v_accepted integer := 0;
  v_refused integer := 0;
  v_replayed integer := 0;
  v_diverged integer := 0;
  v_results jsonb := '[]'::jsonb;
begin
  if p_batch_id is null or p_device_id is null or jsonb_typeof(p_scans) <> 'array' then
    raise exception using errcode = '22023', message = 'GATE_OFFLINE_BATCH_INVALID';
  end if;
  v_count := jsonb_array_length(p_scans);
  if v_count not between 1 and 200 then
    raise exception using errcode = '22023', message = 'GATE_OFFLINE_BATCH_INVALID';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(p_tenant_id::text || ':' || p_batch_id::text));
  select * into v_existing from public.erp_gate_offline_sync_batches batch
  where batch.id = p_batch_id and batch.tenant_id = p_tenant_id;
  if v_existing.id is not null then
    if v_existing.manifest_id <> p_manifest_id or v_existing.device_id <> p_device_id
       or v_existing.actor_account_id <> trim(p_actor_account_id) then
      raise exception using errcode = '23505', message = 'GATE_OFFLINE_BATCH_COLLISION';
    end if;
    if not public.erp_gate_actor_can_scan(p_tenant_id, v_existing.site_id, p_actor_account_id) then
      raise exception using errcode = '42501', message = 'GATE_OFFLINE_ACTOR_REQUIRED';
    end if;
    select coalesce(jsonb_agg(jsonb_build_object(
      'idempotency_key', item.idempotency_key,
      'local_result', item.local_result,
      'server_result', item.server_result,
      'reconciliation_status', item.reconciliation_status,
      'replayed', item.replayed
    ) order by item.sequence_no), '[]'::jsonb)
    into v_results
    from public.erp_gate_offline_sync_items item
    where item.batch_id = v_existing.id and item.tenant_id = p_tenant_id;
    return jsonb_build_object(
      'batch_id', v_existing.id, 'item_count', v_existing.item_count,
      'accepted_count', v_existing.accepted_count, 'refused_count', v_existing.refused_count,
      'replayed_count', v_existing.replayed_count, 'diverged_count', v_existing.diverged_count,
      'replayed_batch', true, 'items', v_results
    );
  end if;
  select * into v_manifest from public.erp_gate_offline_manifests manifest
  where manifest.id = p_manifest_id and manifest.tenant_id = p_tenant_id;
  if v_manifest.id is null or v_manifest.device_id <> p_device_id
     or v_manifest.actor_account_id <> trim(p_actor_account_id)
     or now() > v_manifest.expires_at + interval '24 hours' then
    raise exception using errcode = '42501', message = 'GATE_OFFLINE_MANIFEST_INVALID';
  end if;
  if not public.erp_gate_actor_can_scan(p_tenant_id, v_manifest.site_id, p_actor_account_id) then
    raise exception using errcode = '42501', message = 'GATE_OFFLINE_ACTOR_REQUIRED';
  end if;

  -- Validate the whole payload before the first T8 side effect.
  for v_item in select value, ordinality from jsonb_array_elements(p_scans) with ordinality
  loop
    if coalesce(v_item.value ->> 'idempotency_key', '') !~ '^[A-Za-z0-9:_-]{8,128}$'
       or char_length(trim(coalesce(v_item.value ->> 'code', ''))) not between 6 and 60
       or coalesce(v_item.value ->> 'local_result', '') not in ('accepted', 'not-found', 'exhausted')
       or (v_item.value ->> 'scanned_at') is null
       or (v_item.value ->> 'scanned_at')::timestamptz < v_manifest.issued_at - interval '5 minutes'
       or (v_item.value ->> 'scanned_at')::timestamptz > v_manifest.expires_at + interval '5 minutes' then
      raise exception using errcode = '22023', message = 'GATE_OFFLINE_ITEM_INVALID';
    end if;
  end loop;

  for v_item in select value, ordinality from jsonb_array_elements(p_scans) with ordinality
  loop
    v_decision := public.erp_gate_scan_ticket_at(
      p_tenant_id, v_manifest.site_id, v_item.value ->> 'code',
      p_actor_account_id, p_actor_name, v_item.value ->> 'idempotency_key',
      (v_item.value ->> 'scanned_at')::timestamptz
    );
    v_server_result := v_decision ->> 'result';
    v_reconciliation := case when v_server_result = v_item.value ->> 'local_result' then 'matched' else 'diverged' end;
    if v_server_result = 'accepted' then v_accepted := v_accepted + 1; else v_refused := v_refused + 1; end if;
    if coalesce((v_decision ->> 'replayed')::boolean, false) then v_replayed := v_replayed + 1; end if;
    if v_reconciliation = 'diverged' then v_diverged := v_diverged + 1; end if;

    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'idempotency_key', v_item.value ->> 'idempotency_key',
      'local_result', v_item.value ->> 'local_result', 'server_result', v_server_result,
      'reconciliation_status', v_reconciliation, 'replayed', coalesce((v_decision ->> 'replayed')::boolean, false),
      'event_id', v_decision ->> 'event_id', 'client_scanned_at', v_item.value ->> 'scanned_at',
      'server_scanned_at', v_decision ->> 'scanned_at', 'sequence_no', v_item.ordinality
    ));
  end loop;

  insert into public.erp_gate_offline_sync_batches (
    id, tenant_id, site_id, manifest_id, device_id, actor_account_id, item_count,
    accepted_count, refused_count, replayed_count, diverged_count
  ) values (
    p_batch_id, p_tenant_id, v_manifest.site_id, p_manifest_id, p_device_id,
    trim(p_actor_account_id), v_count, v_accepted, v_refused, v_replayed, v_diverged
  );

  for v_item in select value, ordinality from jsonb_array_elements(v_results) with ordinality
  loop
    insert into public.erp_gate_offline_sync_items (
      tenant_id, batch_id, manifest_id, scan_event_id, idempotency_key, sequence_no,
      client_scanned_at, server_scanned_at, local_result, server_result,
      reconciliation_status, replayed
    ) values (
      p_tenant_id, p_batch_id, p_manifest_id, (v_item.value ->> 'event_id')::uuid,
      v_item.value ->> 'idempotency_key', (v_item.value ->> 'sequence_no')::integer,
      (v_item.value ->> 'client_scanned_at')::timestamptz,
      (v_item.value ->> 'server_scanned_at')::timestamptz,
      v_item.value ->> 'local_result', v_item.value ->> 'server_result',
      v_item.value ->> 'reconciliation_status', (v_item.value ->> 'replayed')::boolean
    );
  end loop;

  return jsonb_build_object(
    'batch_id', p_batch_id, 'item_count', v_count,
    'accepted_count', v_accepted, 'refused_count', v_refused,
    'replayed_count', v_replayed, 'diverged_count', v_diverged,
    'replayed_batch', false, 'items', v_results
  );
end;
$$;

alter table public.erp_gate_offline_manifests enable row level security;
alter table public.erp_gate_offline_sync_batches enable row level security;
alter table public.erp_gate_offline_sync_items enable row level security;

revoke all on table public.erp_gate_offline_manifests,
  public.erp_gate_offline_sync_batches, public.erp_gate_offline_sync_items
  from public, anon, authenticated, service_role;
grant select on table public.erp_gate_offline_manifests,
  public.erp_gate_offline_sync_batches, public.erp_gate_offline_sync_items
  to service_role;

revoke all on function public.erp_gate_actor_can_scan(uuid, uuid, text),
  public.erp_prepare_offline_gate_manifest(uuid, uuid, text, uuid),
  public.erp_gate_scan_ticket_at(uuid, uuid, text, text, text, text, timestamptz),
  public.erp_sync_offline_gate_batch(uuid, uuid, uuid, uuid, text, text, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.erp_prepare_offline_gate_manifest(uuid, uuid, text, uuid),
  public.erp_sync_offline_gate_batch(uuid, uuid, uuid, uuid, text, text, jsonb)
  to service_role;

commit;
