-- CUS-06: customer booking holds derived from T11a capacity and website
-- tickets issued into the existing T8 gate contract.
--
-- Legacy demo-run bookings remain untouched. These tables are the staged,
-- anonymous-first commerce boundary and are writable only through service-role
-- RPCs. They never store raw contact data or payment credentials.

begin;

create table if not exists public.customer_product_capacity_templates (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  site_id uuid not null references public.sites(id) on delete restrict,
  local_start_time time not null,
  duration_minutes integer not null default 60 check (duration_minutes between 15 and 720),
  source_kind text not null default 'catalog-staged' check (source_kind = 'catalog-staged'),
  source_note text not null check (char_length(source_note) between 8 and 500),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, product_id, site_id),
  foreign key (product_id, site_id)
    references public.product_sites(product_id, site_id) on delete restrict
);

create table if not exists public.customer_booking_slots (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete restrict,
  capacity_threshold_id uuid not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  capacity_snapshot integer not null check (capacity_snapshot > 0),
  threshold_version integer not null check (threshold_version > 0),
  capacity_source_kind text not null check (capacity_source_kind in ('estimate', 'customer', 'measured')),
  status text not null default 'open' check (status in ('open', 'paused')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (capacity_threshold_id, tenant_id)
    references public.erp_capacity_thresholds(id, tenant_id) on delete restrict,
  unique (tenant_id, site_id, starts_at),
  unique (id, tenant_id),
  check (ends_at > starts_at)
);

create index if not exists customer_booking_slots_availability_idx
  on public.customer_booking_slots(tenant_id, starts_at, status);

create table if not exists public.customer_orders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  profile_id uuid not null,
  product_id uuid not null references public.products(id) on delete restrict,
  order_code text not null check (order_code ~ '^NBJ-[A-Z0-9]{12}$'),
  visit_date date not null,
  party_size integer not null check (party_size between 1 and 20),
  unit_price_vnd integer not null check (unit_price_vnd >= 0),
  total_vnd integer not null check (total_vnd = unit_price_vnd * party_size),
  currency text not null default 'VND' check (currency = 'VND'),
  status text not null default 'holding' check (status in ('holding', 'confirmed', 'expired', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (profile_id, tenant_id)
    references public.customer_profiles(id, tenant_id) on delete restrict,
  unique (tenant_id, order_code),
  unique (id, tenant_id)
);

create index if not exists customer_orders_profile_created_idx
  on public.customer_orders(tenant_id, profile_id, created_at desc);

create table if not exists public.customer_order_lines (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  order_id uuid not null,
  product_id uuid not null references public.products(id) on delete restrict,
  quantity integer not null check (quantity between 1 and 20),
  unit_price_vnd integer not null check (unit_price_vnd >= 0),
  total_vnd integer not null check (total_vnd = unit_price_vnd * quantity),
  ledger_type text not null check (ledger_type = 'service-commerce'),
  created_at timestamptz not null default now(),
  foreign key (order_id, tenant_id)
    references public.customer_orders(id, tenant_id) on delete restrict,
  unique (order_id, product_id)
);

create table if not exists public.customer_booking_holds (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  order_id uuid not null,
  profile_id uuid not null,
  idempotency_key uuid not null,
  payload_digest text not null check (payload_digest ~ '^[0-9a-f]{64}$'),
  status text not null default 'active' check (status in ('active', 'converted', 'expired', 'cancelled')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  converted_at timestamptz,
  foreign key (order_id, tenant_id)
    references public.customer_orders(id, tenant_id) on delete restrict,
  foreign key (profile_id, tenant_id)
    references public.customer_profiles(id, tenant_id) on delete restrict,
  unique (tenant_id, idempotency_key),
  unique (order_id),
  unique (id, tenant_id),
  check ((status = 'converted') = (converted_at is not null))
);

create index if not exists customer_booking_holds_expiry_idx
  on public.customer_booking_holds(tenant_id, status, expires_at);

create table if not exists public.customer_booking_hold_slots (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  hold_id uuid not null,
  slot_id uuid not null,
  quantity integer not null check (quantity between 1 and 20),
  created_at timestamptz not null default now(),
  foreign key (hold_id, tenant_id)
    references public.customer_booking_holds(id, tenant_id) on delete restrict,
  foreign key (slot_id, tenant_id)
    references public.customer_booking_slots(id, tenant_id) on delete restrict,
  primary key (hold_id, slot_id)
);

create index if not exists customer_booking_hold_slots_capacity_idx
  on public.customer_booking_hold_slots(tenant_id, slot_id, hold_id);

create table if not exists public.customer_payment_attempts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  order_id uuid not null,
  hold_id uuid not null,
  idempotency_key uuid not null,
  provider text not null default 'destinationos-simulation' check (provider = 'destinationos-simulation'),
  provider_event_id text not null check (char_length(provider_event_id) between 8 and 100),
  mode text not null default 'simulation' check (mode = 'simulation'),
  status text not null check (status = 'succeeded'),
  amount_vnd integer not null check (amount_vnd >= 0),
  currency text not null default 'VND' check (currency = 'VND'),
  occurred_at timestamptz not null,
  created_at timestamptz not null default now(),
  foreign key (order_id, tenant_id)
    references public.customer_orders(id, tenant_id) on delete restrict,
  foreign key (hold_id, tenant_id)
    references public.customer_booking_holds(id, tenant_id) on delete restrict,
  unique (tenant_id, idempotency_key),
  unique (provider, provider_event_id),
  unique (id, tenant_id)
);

create table if not exists public.customer_order_tickets (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  order_id uuid not null,
  slot_id uuid not null,
  ticket_id uuid not null references public.erp_tickets(id) on delete restrict,
  site_id uuid not null references public.sites(id) on delete restrict,
  entries_allowed integer not null check (entries_allowed between 1 and 20),
  created_at timestamptz not null default now(),
  foreign key (order_id, tenant_id)
    references public.customer_orders(id, tenant_id) on delete restrict,
  foreign key (slot_id, tenant_id)
    references public.customer_booking_slots(id, tenant_id) on delete restrict,
  primary key (order_id, ticket_id),
  unique (order_id, site_id),
  unique (ticket_id)
);

create table if not exists public.customer_commerce_audit_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  profile_id uuid,
  order_id uuid,
  hold_id uuid,
  payment_attempt_id uuid,
  event_type text not null check (event_type in ('hold-created', 'payment-simulated', 'tickets-issued')),
  metadata jsonb not null default '{}'::jsonb check (
    jsonb_typeof(metadata) = 'object'
    and pg_catalog.octet_length(metadata::text) <= 4096
    and not public.customer_json_contains_pii(metadata)
  ),
  occurred_at timestamptz not null default now(),
  foreign key (profile_id, tenant_id)
    references public.customer_profiles(id, tenant_id) on delete restrict,
  foreign key (order_id, tenant_id)
    references public.customer_orders(id, tenant_id) on delete restrict,
  foreign key (hold_id, tenant_id)
    references public.customer_booking_holds(id, tenant_id) on delete restrict,
  foreign key (payment_attempt_id, tenant_id)
    references public.customer_payment_attempts(id, tenant_id) on delete restrict
);

create index if not exists customer_commerce_audit_profile_idx
  on public.customer_commerce_audit_events(tenant_id, profile_id, occurred_at desc);

drop trigger if exists customer_order_lines_append_only on public.customer_order_lines;
create trigger customer_order_lines_append_only
before update or delete on public.customer_order_lines
for each row execute function public.customer_append_only();

drop trigger if exists customer_hold_slots_append_only on public.customer_booking_hold_slots;
create trigger customer_hold_slots_append_only
before update or delete on public.customer_booking_hold_slots
for each row execute function public.customer_append_only();

drop trigger if exists customer_payment_attempts_append_only on public.customer_payment_attempts;
create trigger customer_payment_attempts_append_only
before update or delete on public.customer_payment_attempts
for each row execute function public.customer_append_only();

drop trigger if exists customer_order_tickets_append_only on public.customer_order_tickets;
create trigger customer_order_tickets_append_only
before update or delete on public.customer_order_tickets
for each row execute function public.customer_append_only();

drop trigger if exists customer_commerce_audit_append_only on public.customer_commerce_audit_events;
create trigger customer_commerce_audit_append_only
before update or delete on public.customer_commerce_audit_events
for each row execute function public.customer_append_only();

create or replace function public.customer_booking_payload_digest(
  p_product_id uuid,
  p_visit_date date,
  p_party_size integer
)
returns text
language sql
immutable
security invoker
set search_path = ''
as $$
  select encode(
    extensions.digest(
      p_product_id::text || ':' || p_visit_date::text || ':' || p_party_size::text,
      'sha256'
    ),
    'hex'
  );
$$;

create or replace function public.customer_create_booking_hold(
  p_tenant_id uuid,
  p_request_id uuid,
  p_anonymous_id uuid,
  p_product_id uuid,
  p_visit_date date,
  p_party_size integer,
  p_occurred_at timestamptz
)
returns table (
  order_id uuid,
  order_code text,
  hold_id uuid,
  hold_status text,
  expires_at timestamptz,
  total_vnd integer,
  currency text,
  slots jsonb,
  inserted boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_source_profile_id uuid;
  v_profile_id uuid;
  v_product public.products;
  v_existing_hold public.customer_booking_holds;
  v_existing_order public.customer_orders;
  v_order public.customer_orders;
  v_hold public.customer_booking_holds;
  v_template public.customer_product_capacity_templates;
  v_threshold public.erp_capacity_thresholds;
  v_slot public.customer_booking_slots;
  v_starts_at timestamptz;
  v_ends_at timestamptz;
  v_reserved integer;
  v_template_count integer := 0;
  v_payload_digest text;
  v_slots jsonb;
begin
  if p_tenant_id is null or p_request_id is null or p_anonymous_id is null
     or p_product_id is null or p_visit_date is null
     or p_party_size not between 1 and 20 or p_occurred_at is null
     or p_occurred_at > now() + interval '5 minutes'
     or p_visit_date < (now() at time zone 'Asia/Ho_Chi_Minh')::date
     or p_visit_date > (now() at time zone 'Asia/Ho_Chi_Minh')::date + 90 then
    raise exception using errcode = '22023', message = 'CUSTOMER_BOOKING_INPUT_INVALID';
  end if;

  -- Serialize retries before any side effect so concurrent use of one key is
  -- a replay, never a leaked unique-constraint failure.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_tenant_id::text || ':booking:' || p_request_id::text, 0)
  );

  insert into public.customer_profiles as existing (tenant_id, anonymous_id)
  values (p_tenant_id, p_anonymous_id)
  on conflict (tenant_id, anonymous_id) do update set
    updated_at = greatest(existing.updated_at, now())
  returning existing.id into v_source_profile_id;
  v_profile_id := public.customer_canonical_profile_id(p_tenant_id, v_source_profile_id);
  if v_profile_id is null then
    raise exception using errcode = 'P0002', message = 'CUSTOMER_PROFILE_NOT_FOUND';
  end if;

  v_payload_digest := public.customer_booking_payload_digest(
    p_product_id, p_visit_date, p_party_size
  );
  select hold.* into v_existing_hold
  from public.customer_booking_holds hold
  where hold.tenant_id = p_tenant_id and hold.idempotency_key = p_request_id;
  if v_existing_hold.id is not null then
    if public.customer_canonical_profile_id(
         p_tenant_id, v_existing_hold.profile_id
       ) <> v_profile_id
       or v_existing_hold.payload_digest <> v_payload_digest then
      raise exception using errcode = '23505', message = 'CUSTOMER_BOOKING_ID_COLLISION';
    end if;
    select customer_order.* into v_existing_order
    from public.customer_orders customer_order
    where customer_order.id = v_existing_hold.order_id
      and customer_order.tenant_id = p_tenant_id;
    if v_existing_hold.status = 'active' and v_existing_hold.expires_at <= now() then
      update public.customer_booking_holds
      set status = 'expired'
      where id = v_existing_hold.id
      returning * into v_existing_hold;
      update public.customer_orders
      set status = 'expired', updated_at = now()
      where id = v_existing_order.id
      returning * into v_existing_order;
    end if;
    select coalesce(jsonb_agg(jsonb_build_object(
      'slot_id', slot.id,
      'site_id', slot.site_id,
      'starts_at', slot.starts_at,
      'ends_at', slot.ends_at,
      'capacity_source', slot.capacity_source_kind,
      'threshold_version', slot.threshold_version
    ) order by slot.starts_at, slot.site_id), '[]'::jsonb)
    into v_slots
    from public.customer_booking_hold_slots hold_slot
    join public.customer_booking_slots slot on slot.id = hold_slot.slot_id
    where hold_slot.hold_id = v_existing_hold.id;
    return query select
      v_existing_order.id, v_existing_order.order_code, v_existing_hold.id,
      v_existing_hold.status,
      v_existing_hold.expires_at, v_existing_order.total_vnd,
      v_existing_order.currency, v_slots, false;
    return;
  end if;

  if (
    select count(*)
    from public.customer_booking_holds hold
    where hold.tenant_id = p_tenant_id
      and hold.profile_id = v_profile_id
      and hold.created_at > now() - interval '1 hour'
  ) >= 10 then
    raise exception using errcode = '54000', message = 'CUSTOMER_BOOKING_RATE_LIMITED';
  end if;

  select product.* into v_product
  from public.products product
  where product.id = p_product_id
    and product.tenant_id = p_tenant_id
    and product.active
    and product.ledger_type = 'service-commerce';
  if v_product.id is null then
    raise exception using errcode = 'P0002', message = 'CUSTOMER_PRODUCT_UNAVAILABLE';
  end if;

  insert into public.customer_orders (
    tenant_id, profile_id, product_id, order_code, visit_date, party_size,
    unit_price_vnd, total_vnd, currency, status
  ) values (
    p_tenant_id, v_profile_id, v_product.id,
    'NBJ-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)),
    p_visit_date, p_party_size, v_product.demo_price_vnd,
    v_product.demo_price_vnd * p_party_size, 'VND', 'holding'
  ) returning * into v_order;

  insert into public.customer_order_lines (
    tenant_id, order_id, product_id, quantity, unit_price_vnd, total_vnd, ledger_type
  ) values (
    p_tenant_id, v_order.id, v_product.id, p_party_size,
    v_product.demo_price_vnd, v_product.demo_price_vnd * p_party_size,
    'service-commerce'
  );

  insert into public.customer_booking_holds (
    tenant_id, order_id, profile_id, idempotency_key, payload_digest,
    status, expires_at
  ) values (
    p_tenant_id, v_order.id, v_profile_id, p_request_id, v_payload_digest,
    'active', now() + interval '15 minutes'
  ) returning * into v_hold;

  for v_template in
    select template.*
    from public.customer_product_capacity_templates template
    where template.tenant_id = p_tenant_id
      and template.product_id = p_product_id
      and template.active
    order by template.local_start_time, template.site_id
  loop
    v_template_count := v_template_count + 1;
    select threshold.* into v_threshold
    from public.erp_capacity_thresholds threshold
    where threshold.tenant_id = p_tenant_id
      and threshold.site_id = v_template.site_id
      and threshold.effective_from <= p_visit_date
    order by threshold.hourly_capacity asc, threshold.effective_from desc,
      threshold.threshold_code
    limit 1
    for share;
    if v_threshold.id is null then
      raise exception using errcode = 'P0002', message = 'CUSTOMER_CAPACITY_SOURCE_MISSING';
    end if;

    v_starts_at := (p_visit_date + v_template.local_start_time)
      at time zone 'Asia/Ho_Chi_Minh';
    v_ends_at := v_starts_at + make_interval(mins => v_template.duration_minutes);
    if v_starts_at <= now() + interval '5 minutes' then
      raise exception using errcode = '22023', message = 'CUSTOMER_BOOKING_SLOT_PAST';
    end if;

    insert into public.customer_booking_slots as booking_slot (
      tenant_id, site_id, capacity_threshold_id,
      starts_at, ends_at, capacity_snapshot, threshold_version,
      capacity_source_kind, status
    ) values (
      p_tenant_id, v_template.site_id, v_threshold.id,
      v_starts_at, v_ends_at, v_threshold.hourly_capacity, v_threshold.version,
      v_threshold.source_kind, 'open'
    )
    on conflict (tenant_id, site_id, starts_at) do nothing;

    select slot.* into v_slot
    from public.customer_booking_slots slot
    where slot.tenant_id = p_tenant_id
      and slot.site_id = v_template.site_id
      and slot.starts_at = v_starts_at
    for update;
    if v_slot.status <> 'open' then
      raise exception using errcode = 'P0001', message = 'CUSTOMER_BOOKING_SLOT_PAUSED';
    end if;
    if v_slot.threshold_version <> v_threshold.version
       or v_slot.capacity_threshold_id <> v_threshold.id
       or v_slot.capacity_snapshot <> v_threshold.hourly_capacity then
      update public.customer_booking_slots
      set capacity_threshold_id = v_threshold.id,
          capacity_snapshot = v_threshold.hourly_capacity,
          threshold_version = v_threshold.version,
          capacity_source_kind = v_threshold.source_kind,
          updated_at = now()
      where id = v_slot.id
      returning * into v_slot;
    end if;

    select coalesce(sum(hold_slot.quantity), 0)::integer into v_reserved
    from public.customer_booking_hold_slots hold_slot
    join public.customer_booking_holds hold on hold.id = hold_slot.hold_id
    where hold_slot.tenant_id = p_tenant_id
      and hold_slot.slot_id = v_slot.id
      and (
        hold.status = 'converted'
        or (hold.status = 'active' and hold.expires_at > now())
      );
    if v_reserved + p_party_size > v_slot.capacity_snapshot then
      raise exception using errcode = 'P0001', message = 'CUSTOMER_CAPACITY_UNAVAILABLE';
    end if;
    insert into public.customer_booking_hold_slots (
      tenant_id, hold_id, slot_id, quantity
    ) values (p_tenant_id, v_hold.id, v_slot.id, p_party_size);
  end loop;

  if v_template_count = 0 then
    raise exception using errcode = 'P0002', message = 'CUSTOMER_CAPACITY_SOURCE_MISSING';
  end if;

  insert into public.customer_commerce_audit_events (
    tenant_id, profile_id, order_id, hold_id, event_type, metadata, occurred_at
  ) values (
    p_tenant_id, v_profile_id, v_order.id, v_hold.id, 'hold-created',
    jsonb_build_object(
      'visit_date', p_visit_date,
      'party_size', p_party_size,
      'slot_count', v_template_count,
      'mode', 'simulation'
    ), p_occurred_at
  );

  select coalesce(jsonb_agg(jsonb_build_object(
    'slot_id', slot.id,
    'site_id', slot.site_id,
    'starts_at', slot.starts_at,
    'ends_at', slot.ends_at,
    'capacity_source', slot.capacity_source_kind,
    'threshold_version', slot.threshold_version
  ) order by slot.starts_at, slot.site_id), '[]'::jsonb)
  into v_slots
  from public.customer_booking_hold_slots hold_slot
  join public.customer_booking_slots slot on slot.id = hold_slot.slot_id
  where hold_slot.hold_id = v_hold.id;

  return query select
    v_order.id, v_order.order_code, v_hold.id, v_hold.status,
    v_hold.expires_at, v_order.total_vnd, v_order.currency, v_slots, true;
end;
$$;

create or replace function public.customer_confirm_simulated_booking(
  p_tenant_id uuid,
  p_payment_request_id uuid,
  p_hold_id uuid,
  p_anonymous_id uuid,
  p_occurred_at timestamptz
)
returns table (
  order_id uuid,
  order_code text,
  order_status text,
  payment_attempt_id uuid,
  payment_status text,
  tickets jsonb,
  inserted boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_source_profile_id uuid;
  v_profile_id uuid;
  v_existing_payment public.customer_payment_attempts;
  v_hold public.customer_booking_holds;
  v_order public.customer_orders;
  v_payment public.customer_payment_attempts;
  v_hold_slot public.customer_booking_hold_slots;
  v_slot public.customer_booking_slots;
  v_ticket_id uuid;
  v_ticket_code text;
  v_tickets jsonb;
  v_ticket_count integer := 0;
begin
  if p_tenant_id is null or p_payment_request_id is null or p_hold_id is null
     or p_anonymous_id is null or p_occurred_at is null
     or p_occurred_at > now() + interval '5 minutes' then
    raise exception using errcode = '22023', message = 'CUSTOMER_PAYMENT_INPUT_INVALID';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_tenant_id::text || ':payment:' || p_payment_request_id::text, 0)
  );

  select profile.id into v_source_profile_id
  from public.customer_profiles profile
  where profile.tenant_id = p_tenant_id and profile.anonymous_id = p_anonymous_id;
  v_profile_id := public.customer_canonical_profile_id(p_tenant_id, v_source_profile_id);
  if v_profile_id is null then
    raise exception using errcode = 'P0002', message = 'CUSTOMER_PROFILE_NOT_FOUND';
  end if;

  select payment.* into v_existing_payment
  from public.customer_payment_attempts payment
  where payment.tenant_id = p_tenant_id
    and payment.idempotency_key = p_payment_request_id;
  if v_existing_payment.id is not null then
    select hold.* into v_hold
    from public.customer_booking_holds hold
    where hold.id = v_existing_payment.hold_id and hold.tenant_id = p_tenant_id;
    if v_existing_payment.hold_id <> p_hold_id
       or public.customer_canonical_profile_id(
         p_tenant_id, v_hold.profile_id
       ) <> v_profile_id then
      raise exception using errcode = '23505', message = 'CUSTOMER_PAYMENT_ID_COLLISION';
    end if;
    select customer_order.* into v_order
    from public.customer_orders customer_order
    where customer_order.id = v_existing_payment.order_id
      and customer_order.tenant_id = p_tenant_id;
    select coalesce(jsonb_agg(jsonb_build_object(
      'ticket_id', ticket.id,
      'ticket_code', ticket.ticket_code,
      'site_id', ticket.site_id,
      'valid_on', ticket.valid_on,
      'entries_allowed', ticket.entries_allowed,
      'status', ticket.status
    ) order by ticket.site_id), '[]'::jsonb)
    into v_tickets
    from public.customer_order_tickets bridge
    join public.erp_tickets ticket on ticket.id = bridge.ticket_id
    where bridge.order_id = v_order.id;
    return query select
      v_order.id, v_order.order_code, v_order.status, v_existing_payment.id,
      v_existing_payment.status, v_tickets, false;
    return;
  end if;

  select hold.* into v_hold
  from public.customer_booking_holds hold
  where hold.id = p_hold_id and hold.tenant_id = p_tenant_id
  for update;
  if v_hold.id is null then
    raise exception using errcode = 'P0002', message = 'CUSTOMER_BOOKING_HOLD_NOT_FOUND';
  end if;
  if public.customer_canonical_profile_id(
       p_tenant_id, v_hold.profile_id
     ) <> v_profile_id then
    raise exception using errcode = '42501', message = 'CUSTOMER_BOOKING_OWNERSHIP_REQUIRED';
  end if;
  if v_hold.status = 'converted' then
    raise exception using errcode = '23505', message = 'CUSTOMER_ORDER_ALREADY_CONFIRMED';
  end if;
  if v_hold.status <> 'active' or v_hold.expires_at <= now() then
    raise exception using errcode = '22023', message = 'CUSTOMER_BOOKING_HOLD_EXPIRED';
  end if;

  select customer_order.* into v_order
  from public.customer_orders customer_order
  where customer_order.id = v_hold.order_id and customer_order.tenant_id = p_tenant_id
  for update;
  if v_order.status <> 'holding' then
    raise exception using errcode = '23505', message = 'CUSTOMER_ORDER_STATE_INVALID';
  end if;

  for v_hold_slot in
    select hold_slot.*
    from public.customer_booking_hold_slots hold_slot
    where hold_slot.hold_id = v_hold.id
    order by hold_slot.slot_id
  loop
    select slot.* into v_slot
    from public.customer_booking_slots slot
    where slot.id = v_hold_slot.slot_id and slot.tenant_id = p_tenant_id
    for update;
  end loop;

  insert into public.customer_payment_attempts (
    tenant_id, order_id, hold_id, idempotency_key, provider,
    provider_event_id, mode, status, amount_vnd, currency, occurred_at
  ) values (
    p_tenant_id, v_order.id, v_hold.id, p_payment_request_id,
    'destinationos-simulation', 'sim-' || p_payment_request_id::text,
    'simulation', 'succeeded', v_order.total_vnd, v_order.currency, p_occurred_at
  ) returning * into v_payment;

  update public.customer_booking_holds
  set status = 'converted', converted_at = now()
  where id = v_hold.id;
  update public.customer_orders
  set status = 'confirmed', updated_at = now()
  where id = v_order.id
  returning * into v_order;

  for v_hold_slot in
    select hold_slot.*
    from public.customer_booking_hold_slots hold_slot
    where hold_slot.hold_id = v_hold.id
    order by hold_slot.slot_id
  loop
    select slot.* into v_slot
    from public.customer_booking_slots slot
    where slot.id = v_hold_slot.slot_id;
    v_ticket_code := 'WEB-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
    insert into public.erp_tickets (
      tenant_id, site_id, ticket_code, product, guest_name, guest_phone,
      booking_reference, channel, valid_on, entries_allowed, entries_used,
      status, issued_at
    ) values (
      p_tenant_id, v_slot.site_id, v_ticket_code, 'group', '', '',
      v_order.order_code, 'website', v_order.visit_date,
      v_order.party_size, 0, 'issued', p_occurred_at
    ) returning id into v_ticket_id;
    insert into public.customer_order_tickets (
      tenant_id, order_id, slot_id, ticket_id, site_id, entries_allowed
    ) values (
      p_tenant_id, v_order.id, v_slot.id, v_ticket_id,
      v_slot.site_id, v_order.party_size
    );
    v_ticket_count := v_ticket_count + 1;
  end loop;

  insert into public.customer_commerce_audit_events (
    tenant_id, profile_id, order_id, hold_id, payment_attempt_id,
    event_type, metadata, occurred_at
  ) values
    (
      p_tenant_id, v_profile_id, v_order.id, v_hold.id, v_payment.id,
      'payment-simulated',
      jsonb_build_object('amount_vnd', v_order.total_vnd, 'currency', 'VND', 'mode', 'simulation'),
      p_occurred_at
    ),
    (
      p_tenant_id, v_profile_id, v_order.id, v_hold.id, v_payment.id,
      'tickets-issued',
      jsonb_build_object('ticket_count', v_ticket_count, 'channel', 'website'),
      p_occurred_at
    );

  select coalesce(jsonb_agg(jsonb_build_object(
    'ticket_id', ticket.id,
    'ticket_code', ticket.ticket_code,
    'site_id', ticket.site_id,
    'valid_on', ticket.valid_on,
    'entries_allowed', ticket.entries_allowed,
    'status', ticket.status
  ) order by ticket.site_id), '[]'::jsonb)
  into v_tickets
  from public.customer_order_tickets bridge
  join public.erp_tickets ticket on ticket.id = bridge.ticket_id
  where bridge.order_id = v_order.id;

  return query select
    v_order.id, v_order.order_code, v_order.status, v_payment.id,
    v_payment.status, v_tickets, true;
end;
$$;

insert into public.customer_product_capacity_templates (
  tenant_id, product_id, site_id, local_start_time, duration_minutes,
  source_kind, source_note
) values
  (
    '00000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    '08:00', 60, 'catalog-staged',
    'Khung Tràng An lấy từ lịch gói demo; cần Xuân Trường duyệt lịch bán thật.'
  ),
  (
    '00000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000001',
    '08:00', 60, 'catalog-staged',
    'Khung Tràng An lấy từ lịch gói demo; cần Xuân Trường duyệt lịch bán thật.'
  ),
  (
    '00000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000003',
    '10000000-0000-4000-8000-000000000001',
    '08:00', 60, 'catalog-staged',
    'Khung Tràng An lấy từ lịch gói demo; cần Xuân Trường duyệt lịch bán thật.'
  ),
  (
    '00000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000003',
    '10000000-0000-4000-8000-000000000003',
    '13:30', 60, 'catalog-staged',
    'Khung Bái Đính lấy từ lịch gói demo; cần Xuân Trường duyệt lịch bán thật.'
  ),
  (
    '00000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000004',
    '10000000-0000-4000-8000-000000000005',
    '14:00', 60, 'catalog-staged',
    'Khung Tam Cốc lấy từ lịch gói demo; cần Xuân Trường duyệt lịch bán thật.'
  )
on conflict (tenant_id, product_id, site_id) do update set
  local_start_time = excluded.local_start_time,
  duration_minutes = excluded.duration_minutes,
  source_note = excluded.source_note,
  active = true,
  updated_at = now();

alter table public.customer_product_capacity_templates enable row level security;
alter table public.customer_booking_slots enable row level security;
alter table public.customer_orders enable row level security;
alter table public.customer_order_lines enable row level security;
alter table public.customer_booking_holds enable row level security;
alter table public.customer_booking_hold_slots enable row level security;
alter table public.customer_payment_attempts enable row level security;
alter table public.customer_order_tickets enable row level security;
alter table public.customer_commerce_audit_events enable row level security;

revoke all on table
  public.customer_product_capacity_templates,
  public.customer_booking_slots,
  public.customer_orders,
  public.customer_order_lines,
  public.customer_booking_holds,
  public.customer_booking_hold_slots,
  public.customer_payment_attempts,
  public.customer_order_tickets,
  public.customer_commerce_audit_events
  from public, anon, authenticated, service_role;

grant select on table
  public.customer_product_capacity_templates,
  public.customer_booking_slots,
  public.customer_orders,
  public.customer_order_lines,
  public.customer_booking_holds,
  public.customer_booking_hold_slots,
  public.customer_payment_attempts,
  public.customer_order_tickets,
  public.customer_commerce_audit_events
  to service_role;

revoke all on function
  public.customer_booking_payload_digest(uuid, date, integer),
  public.customer_create_booking_hold(uuid, uuid, uuid, uuid, date, integer, timestamptz),
  public.customer_confirm_simulated_booking(uuid, uuid, uuid, uuid, timestamptz)
  from public, anon, authenticated, service_role;

grant execute on function
  public.customer_create_booking_hold(uuid, uuid, uuid, uuid, date, integer, timestamptz),
  public.customer_confirm_simulated_booking(uuid, uuid, uuid, uuid, timestamptz)
  to service_role;

commit;
