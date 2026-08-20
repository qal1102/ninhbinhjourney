\set ON_ERROR_STOP on

do $$
declare
  v_tenant constant uuid := '00000000-0000-4000-8000-000000000001';
  v_site constant uuid := '10000000-0000-4000-8000-000000000001';
  v_device constant uuid := '20000000-0000-4000-8000-000000000001';
  v_batch constant uuid := '30000000-0000-4000-8000-000000000001';
  v_manifest jsonb;
  v_scans jsonb;
  v_first jsonb;
  v_replay jsonb;
begin
  v_manifest := public.erp_prepare_offline_gate_manifest(v_tenant, v_site, 'director', v_device);
  if (v_manifest ->> 'ticket_count')::integer <> 1
     or jsonb_array_length(v_manifest -> 'tickets') <> 1
     or v_manifest::text ~* 'Private Guest|0900000000|BOOKING-PRIVATE' then
    raise exception 'RUNTIME_MANIFEST_ASSERTION_FAILED';
  end if;

  v_scans := jsonb_build_array(
    jsonb_build_object(
      'idempotency_key', '40000000-0000-4000-8000-000000000001',
      'code', 'OFFLINE-VALID-001', 'scanned_at', now(), 'local_result', 'accepted'
    ),
    jsonb_build_object(
      'idempotency_key', '40000000-0000-4000-8000-000000000002',
      'code', 'OFFLINE-VALID-001', 'scanned_at', now(), 'local_result', 'exhausted'
    )
  );

  v_first := public.erp_sync_offline_gate_batch(
    v_tenant, (v_manifest ->> 'manifest_id')::uuid, v_batch, v_device,
    'director', 'Runtime Director', v_scans
  );
  if (v_first ->> 'replayed_batch')::boolean
     or (v_first ->> 'item_count')::integer <> 2
     or (v_first ->> 'accepted_count')::integer <> 1
     or (v_first ->> 'refused_count')::integer <> 1
     or (v_first ->> 'diverged_count')::integer <> 0
     or jsonb_array_length(v_first -> 'items') <> 2 then
    raise exception 'RUNTIME_FIRST_BATCH_ASSERTION_FAILED: %', v_first;
  end if;

  v_replay := public.erp_sync_offline_gate_batch(
    v_tenant, (v_manifest ->> 'manifest_id')::uuid, v_batch, v_device,
    'director', 'Runtime Director', v_scans
  );
  if not (v_replay ->> 'replayed_batch')::boolean
     or jsonb_array_length(v_replay -> 'items') <> 2 then
    raise exception 'RUNTIME_REPLAY_RECEIPT_ASSERTION_FAILED: %', v_replay;
  end if;

  perform set_config('cus08.scan_allowed', 'off', true);
  begin
    perform public.erp_sync_offline_gate_batch(
      v_tenant, (v_manifest ->> 'manifest_id')::uuid, v_batch, v_device,
      'director', 'Runtime Director', v_scans
    );
    raise exception 'RUNTIME_REVOKED_ACTOR_WAS_NOT_REFUSED';
  exception
    when insufficient_privilege then
      if sqlerrm <> 'GATE_OFFLINE_ACTOR_REQUIRED' then raise; end if;
  end;
  perform set_config('cus08.scan_allowed', 'on', true);

  if (select entries_used from public.erp_tickets where ticket_code = 'OFFLINE-VALID-001') <> 1
     or (select count(*) from public.erp_gate_scan_events) <> 2
     or (select count(*) from public.erp_gate_offline_sync_items) <> 2 then
    raise exception 'RUNTIME_EXACTLY_ONCE_ASSERTION_FAILED';
  end if;

  begin
    perform public.erp_gate_scan_ticket_at(
      v_tenant, v_site, 'DIFFERENT-CODE', 'director', 'Runtime Director',
      '40000000-0000-4000-8000-000000000001', now()
    );
    raise exception 'RUNTIME_COLLISION_WAS_NOT_REFUSED';
  exception
    when unique_violation then
      if sqlerrm <> 'GATE_SCAN_IDEMPOTENCY_CONFLICT' then raise; end if;
  end;

  begin
    update public.erp_gate_offline_sync_batches set item_count = item_count where id = v_batch;
    raise exception 'RUNTIME_APPEND_ONLY_WAS_NOT_ENFORCED';
  exception
    when insufficient_privilege then
      if sqlerrm <> 'CUSTOMER_HISTORY_IMMUTABLE' then raise; end if;
  end;
end;
$$;

select 'CUS08_POSTGRES_RUNTIME_OK' as result;
