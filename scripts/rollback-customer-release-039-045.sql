-- Emergency rollback for the pre-activation 039-045 customer release only.
-- This script is intentionally fail-closed: once any customer/business row
-- exists beyond the staged catalog/rule seeds, a database backup and a
-- data-preserving forward migration are required instead.

begin;

do $$
declare
  v_table text;
  v_count bigint;
  v_function record;
begin
  foreach v_table in array array[
    'customer_profiles',
    'customer_identities',
    'customer_consents',
    'customer_sessions',
    'customer_events',
    'customer_journeys',
    'marketing_campaigns',
    'marketing_qr_sources',
    'marketing_qr_scans',
    'marketing_qr_audit_events',
    'customer_itinerary_delivery_requests',
    'customer_segments',
    'customer_identity_audit_events',
    'customer_booking_slots',
    'customer_orders',
    'customer_order_lines',
    'customer_booking_holds',
    'customer_booking_hold_slots',
    'customer_payment_attempts',
    'customer_order_tickets',
    'customer_commerce_audit_events',
    'customer_recommendations',
    'customer_outbound_actions',
    'customer_outbound_action_events',
    'erp_gate_offline_manifests',
    'erp_gate_offline_sync_batches',
    'erp_gate_offline_sync_items'
  ] loop
    if to_regclass('public.' || v_table) is not null then
      execute format('select count(*) from public.%I', v_table) into v_count;
      if v_count <> 0 then
        raise exception using
          errcode = '55000',
          message = 'CUSTOMER_RELEASE_ROLLBACK_REFUSED_NONEMPTY',
          detail = format('public.%I contains %s row(s)', v_table, v_count);
      end if;
    end if;
  end loop;

  if to_regclass('public.customer_product_capacity_templates') is not null then
    select count(*) into v_count
    from public.customer_product_capacity_templates
    where source_kind <> 'catalog-staged';
    if v_count <> 0 then
      raise exception using errcode = '55000', message = 'CUSTOMER_RELEASE_ROLLBACK_REFUSED_LIVE_CAPACITY';
    end if;
  end if;

  if to_regclass('public.customer_recommendation_rules') is not null then
    select count(*) into v_count
    from public.customer_recommendation_rules
    where approved_by <> 'xuan-truong-policy-pending';
    if v_count <> 0 then
      raise exception using errcode = '55000', message = 'CUSTOMER_RELEASE_ROLLBACK_REFUSED_APPROVED_RULES';
    end if;
  end if;

  for v_function in
    select p.oid::regprocedure::text as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = any(array[
        'customer_append_only',
        'customer_audit_360_access',
        'customer_booking_payload_digest',
        'customer_canonical_profile_id',
        'customer_confirm_simulated_booking',
        'customer_create_anonymous_journey',
        'customer_create_booking_hold',
        'customer_ingest_event',
        'customer_json_contains_pii',
        'customer_link_encrypted_identity',
        'customer_record_consent',
        'customer_record_web_preferences',
        'customer_refresh_recommendations',
        'customer_stage_recommendation_outbound',
        'customer_submit_progressive_identity',
        'erp_gate_actor_can_scan',
        'erp_gate_scan_ticket_at',
        'erp_prepare_offline_gate_manifest',
        'erp_sync_offline_gate_batch',
        'marketing_create_campaign',
        'marketing_create_qr_source',
        'marketing_resolve_qr_redirect',
        'marketing_update_qr_destination'
      ])
  loop
    execute format('drop function if exists %s cascade', v_function.signature);
  end loop;
end;
$$;

-- Migration 045 replaces this pre-existing T8 function with a wrapper around
-- erp_gate_scan_ticket_at(). Restore the original online implementation instead
-- of dropping it with the functions introduced by the customer release.
create or replace function public.erp_gate_scan_ticket(
  p_tenant_id uuid,
  p_site_id uuid,
  p_code text,
  p_actor_account_id text,
  p_actor_name text,
  p_idempotency_key text
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
  v_today date := (now() at time zone 'Asia/Ho_Chi_Minh')::date;
begin
  if char_length(v_code) < 6
     or char_length(v_actor_id) not between 2 and 100
     or char_length(v_actor_name) < 1 then
    raise exception using errcode = '22023', message = 'GATE_SCAN_CODE_INVALID';
  end if;
  if not exists (
    select 1 from public.sites s where s.id = p_site_id and s.tenant_id = p_tenant_id
  ) then
    raise exception using errcode = '23503', message = 'GATE_SCAN_SITE_TENANT_MISMATCH';
  end if;

  if v_key is not null then
    select * into v_existing
    from public.erp_gate_scan_events
    where tenant_id = p_tenant_id and idempotency_key = v_key;
    if v_existing.id is not null then
      return jsonb_build_object(
        'result', v_existing.result,
        'code', v_existing.code,
        'scanned_at', v_existing.scanned_at,
        'replayed', true
      );
    end if;
  end if;

  select * into v_ticket
  from public.erp_tickets
  where tenant_id = p_tenant_id and ticket_code = v_code
  for update;

  if v_ticket.id is null then
    v_result := 'not-found';
  elsif v_ticket.status = 'void' then
    v_result := 'void';
  elsif v_ticket.site_id <> p_site_id then
    v_result := 'wrong-site';
  elsif v_ticket.valid_on <> v_today then
    v_result := 'wrong-day';
  elsif v_ticket.entries_used >= v_ticket.entries_allowed then
    v_result := 'exhausted';
  else
    v_result := 'accepted';
    update public.erp_tickets set
      entries_used = entries_used + 1,
      status = case
        when entries_used + 1 >= entries_allowed then 'used'
        else 'partially-used'
      end,
      updated_at = now()
    where id = v_ticket.id
    returning * into v_ticket;
  end if;

  insert into public.erp_gate_scan_events (
    tenant_id, site_id, code, scanned_by_account_id, scanned_by_name,
    ticket_id, result, idempotency_key
  ) values (
    p_tenant_id, p_site_id, v_code, v_actor_id, v_actor_name,
    case when v_ticket.id is null then null else v_ticket.id end,
    v_result, v_key
  )
  returning * into v_event;

  return jsonb_build_object(
    'result', v_result,
    'code', v_code,
    'scanned_at', v_event.scanned_at,
    'replayed', false,
    'ticket', case
      when v_ticket.id is null then null
      else jsonb_build_object(
        'ticket_code', v_ticket.ticket_code,
        'product', v_ticket.product,
        'guest_name', v_ticket.guest_name,
        'guest_phone', v_ticket.guest_phone,
        'booking_reference', v_ticket.booking_reference,
        'channel', v_ticket.channel,
        'valid_on', v_ticket.valid_on,
        'entries_allowed', v_ticket.entries_allowed,
        'entries_used', v_ticket.entries_used,
        'status', v_ticket.status
      )
    end
  );
end;
$$;

revoke all on function public.erp_gate_scan_ticket(uuid, uuid, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.erp_gate_scan_ticket(uuid, uuid, text, text, text, text)
  to service_role;

drop table if exists public.erp_gate_offline_sync_items cascade;
drop table if exists public.erp_gate_offline_sync_batches cascade;
drop table if exists public.erp_gate_offline_manifests cascade;
drop table if exists public.customer_outbound_action_events cascade;
drop table if exists public.customer_outbound_actions cascade;
drop table if exists public.customer_recommendations cascade;
drop table if exists public.customer_recommendation_rules cascade;
drop table if exists public.customer_commerce_audit_events cascade;
drop table if exists public.customer_order_tickets cascade;
drop table if exists public.customer_payment_attempts cascade;
drop table if exists public.customer_booking_hold_slots cascade;
drop table if exists public.customer_booking_holds cascade;
drop table if exists public.customer_order_lines cascade;
drop table if exists public.customer_orders cascade;
drop table if exists public.customer_booking_slots cascade;
drop table if exists public.customer_product_capacity_templates cascade;
drop table if exists public.customer_identity_audit_events cascade;
drop table if exists public.customer_segments cascade;
drop table if exists public.customer_itinerary_delivery_requests cascade;
drop table if exists public.marketing_qr_audit_events cascade;
drop table if exists public.marketing_qr_scans cascade;
drop table if exists public.marketing_qr_sources cascade;
drop table if exists public.marketing_campaigns cascade;
drop table if exists public.customer_journeys cascade;
drop table if exists public.customer_events cascade;
drop table if exists public.customer_sessions cascade;
drop table if exists public.customer_consents cascade;
drop table if exists public.customer_identities cascade;
drop table if exists public.customer_profiles cascade;

commit;
