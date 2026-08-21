-- A6 production lint hotfix. These CREATE OR REPLACE statements preserve
-- existing signatures, grants, SECURITY DEFINER behavior and search_path while
-- removing PL/pgSQL output-column ambiguity and making the UUID cast explicit.

begin;

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
      select * into v_pass from public.passes p where p.booking_id = v_booking.id;
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
      select * into v_pass from public.passes p where p.booking_id = v_booking.id;
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
    select * into v_pass from public.passes p where p.booking_id = v_booking.id;
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
    from public.pass_entitlements pe
    where pe.id = p_entitlement_id and pe.pass_id = v_pass.id
    for update;
  else
    select * into v_entitlement
    from public.pass_entitlements pe
    where pe.pass_id = v_pass.id
      and (p_site_id is null or pe.site_id = p_site_id)
      and pe.redeemed_quantity < pe.quantity
    order by pe.id
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
    select 1 from public.pass_entitlements pe
    where pe.pass_id = v_pass.id and pe.redeemed_quantity < pe.quantity
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

create or replace function public.erp_demo_rebase_timeline()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant constant uuid := '00000000-0000-4000-8000-000000000001'::uuid;
  v_anchor date;
  v_shift integer;
  v_interval interval;
  v_incidents integer := 0;
  v_invoices integer := 0;
  v_projects integer := 0;
  v_actions integer := 0;
  v_shifts integer := 0;
  v_workdays integer := 0;
  v_deescalated integer := 0;
begin
  -- The newest seeded incident is the anchor: it is the fixture that reads as
  -- "happening right now" in a demo, so today is where it belongs.
  select max((reported_at_ts at time zone 'Asia/Ho_Chi_Minh')::date)
  into v_anchor
  from public.erp_incidents
  where tenant_id = v_tenant
    and id like 'INC-%';

  if v_anchor is null then
    return jsonb_build_object('shifted_days', 0, 'reason', 'NO_SEEDED_INCIDENTS');
  end if;

  v_shift := (now() at time zone 'Asia/Ho_Chi_Minh')::date - v_anchor;
  if v_shift <= 0 then
    return jsonb_build_object('shifted_days', 0, 'reason', 'ALREADY_CURRENT');
  end if;
  v_interval := make_interval(days => v_shift);

  update public.erp_incidents set
    reported_at_ts = reported_at_ts + v_interval,
    created_at = created_at + v_interval,
    updated_at = updated_at + v_interval
  where tenant_id = v_tenant
    and id like 'INC-%';
  get diagnostics v_incidents = row_count;

  -- Undo what the clock did, but only where the case is no longer overdue on
  -- its own SLA after the shift. An incident that is still genuinely past its
  -- deadline stays escalated -- the point is a plausible working day, not a
  -- day with no problems in it.
  update public.erp_incidents set
    escalated = false,
    escalation_reason = null,
    timeline = coalesce(
      (
        select jsonb_agg(entry)
        from jsonb_array_elements(timeline) as entry
        where entry->>'action' is distinct from 'Chuyá»ƒn cáº¥p tá»± Ä‘á»™ng'
      ),
      '[]'::jsonb
    )
  where tenant_id = v_tenant
    and id like 'INC-%'
    and escalated = true
    and status <> 'closed'
    and now() <= reported_at_ts + make_interval(mins => sla_minutes);
  get diagnostics v_deescalated = row_count;

  -- Supplier invoices: the seeded set carries the 87000000- identity block.
  update public.erp_ap_supplier_invoices set
    invoice_date = invoice_date + v_shift,
    due_date = due_date + v_shift,
    submitted_at = submitted_at + v_interval,
    posted_at = case when posted_at is null then null else posted_at + v_interval end,
    created_at = created_at + v_interval,
    updated_at = updated_at + v_interval
  where tenant_id = v_tenant
    and id::text like '87000000-%';
  get diagnostics v_invoices = row_count;

  update public.erp_ap_audit_events set
    occurred_at = occurred_at + v_interval
  where tenant_id = v_tenant
    and id::text like '87200000-%';

  update public.erp_project_events set
    event_date = event_date + v_shift,
    updated_at = now()
  where tenant_id = v_tenant
    and id::text like '20000000-%';
  get diagnostics v_projects = row_count;

  -- Work packages are seeded without fixed ids, so the business code is the
  -- identity that distinguishes a fixture ('EV-TA-041') from anything a real
  -- action creates.
  update public.erp_project_action_items set
    due_date = due_date + v_shift
  where tenant_id = v_tenant
    and code like 'EV-%';
  get diagnostics v_actions = row_count;

  update public.erp_shift_close_workflows set
    shift_date = shift_date + v_shift,
    shift_started_at = shift_started_at + v_interval,
    shift_ended_at = shift_ended_at + v_interval,
    submitted_at = submitted_at + v_interval,
    manager_reviewed_at = case
      when manager_reviewed_at is null then null
      else manager_reviewed_at + v_interval
    end,
    accountant_reviewed_at = case
      when accountant_reviewed_at is null then null
      else accountant_reviewed_at + v_interval
    end,
    created_at = created_at + v_interval,
    updated_at = updated_at + v_interval
  where tenant_id = v_tenant
    and id::text like '61000000-%';
  get diagnostics v_shifts = row_count;

  update public.erp_workday_workflows set
    business_date = business_date + v_shift,
    due_at = due_at + v_interval,
    created_at = created_at + v_interval,
    updated_at = updated_at + v_interval
  where tenant_id = v_tenant
    and id::text like '00000000-0000-4000-9000-%';
  get diagnostics v_workdays = row_count;

  return jsonb_build_object(
    'shifted_days', v_shift,
    'incidents', v_incidents,
    'incidents_deescalated', v_deescalated,
    'supplier_invoices', v_invoices,
    'project_events', v_projects,
    'project_action_items', v_actions,
    'shift_closes', v_shifts,
    'workdays', v_workdays
  );
end;
$$;

commit;

