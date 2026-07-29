-- Forward-only hardening for workday evidence, GPS accuracy and returned work.
-- Migration 004 is already live and must remain immutable.

begin;

create or replace function public.erp_enforce_workday_resubmission_integrity()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_old_evidence_count integer := jsonb_array_length(old.evidence);
  v_new_evidence_count integer := jsonb_array_length(new.evidence);
  v_evidence jsonb;
  v_geofence public.erp_workday_site_geofences%rowtype;
  v_latitude double precision;
  v_longitude double precision;
  v_accuracy double precision;
  v_captured_at timestamptz;
  v_distance double precision;
begin
  if v_new_evidence_count = v_old_evidence_count then
    if new.evidence <> old.evidence then
      raise exception using
        errcode = '22023',
        message = 'WORKDAY_EVIDENCE_IMMUTABLE';
    end if;
  elsif v_new_evidence_count = v_old_evidence_count + 1 then
    if (new.evidence - (v_new_evidence_count - 1)) <> old.evidence then
      raise exception using
        errcode = '22023',
        message = 'WORKDAY_EVIDENCE_IMMUTABLE';
    end if;
  else
    raise exception using
      errcode = '22023',
      message = 'WORKDAY_EVIDENCE_APPEND_INVALID';
  end if;

  if old.status = 'submitted' and new.status = 'manager-returned' then
    new.check_out_at := null;
  elsif old.status = 'manager-returned' and new.status = 'submitted' then
    new.check_out_at := now();
  end if;

  if old.status = 'assigned' and new.status = 'checked-in' then
    if new.check_in_latitude is null
       or new.check_in_latitude not between -90 and 90
       or new.check_in_longitude is null
       or new.check_in_longitude not between -180 and 180
       or new.check_in_accuracy_meters is null
       or not (
         new.check_in_accuracy_meters > 0
         and new.check_in_accuracy_meters <= 250
       ) then
      raise exception using
        errcode = '22023',
        message = 'WORKDAY_CHECK_IN_ACCURACY_INVALID';
    end if;
  end if;

  if v_new_evidence_count > v_old_evidence_count then
    if v_new_evidence_count <> v_old_evidence_count + 1 then
      raise exception using
        errcode = '22023',
        message = 'WORKDAY_EVIDENCE_APPEND_INVALID';
    end if;
    v_evidence := new.evidence -> (v_new_evidence_count - 1);
    if char_length(trim(coalesce(v_evidence->>'id', ''))) = 0
       or char_length(trim(coalesce(v_evidence->>'storagePath', ''))) = 0 then
      raise exception using
        errcode = '22023',
        message = 'WORKDAY_EVIDENCE_IDENTITY_INVALID';
    end if;
    begin
      v_latitude := (v_evidence->>'latitude')::double precision;
      v_longitude := (v_evidence->>'longitude')::double precision;
      v_accuracy := (v_evidence->>'accuracy')::double precision;
      v_captured_at := (v_evidence->>'capturedAt')::timestamptz;
    exception when others then
      raise exception using
        errcode = '22023',
        message = 'WORKDAY_EVIDENCE_LOCATION_INVALID';
    end;
    if v_latitude is null
       or v_latitude not between -90 and 90
       or v_longitude is null
       or v_longitude not between -180 and 180
       or v_accuracy is null
       or not (v_accuracy > 0 and v_accuracy <= 250)
       or v_captured_at is null
       or v_captured_at < now() - interval '10 minutes'
       or v_captured_at > now() + interval '2 minutes' then
      raise exception using
        errcode = '22023',
        message = 'WORKDAY_EVIDENCE_LOCATION_INVALID';
    end if;
    select * into v_geofence
    from public.erp_workday_site_geofences
    where site_id = new.site_id
      and tenant_id = new.tenant_id;
    if v_geofence.site_id is null then
      raise exception using
        errcode = 'P0002',
        message = 'WORKDAY_GEOFENCE_NOT_FOUND';
    end if;
    v_distance := public.erp_workday_distance_meters(
      v_latitude,
      v_longitude,
      v_geofence.center_latitude,
      v_geofence.center_longitude
    );
    if v_distance is null or v_distance > v_geofence.radius_meters then
      raise exception using
        errcode = '22023',
        message = 'WORKDAY_EVIDENCE_OUTSIDE_GEOFENCE';
    end if;
    if exists (
      select 1
      from jsonb_array_elements(old.evidence) as prior(item)
      where prior.item->>'id' = v_evidence->>'id'
         or prior.item->>'storagePath' = v_evidence->>'storagePath'
    ) then
      raise exception using
        errcode = '22023',
        message = 'WORKDAY_EVIDENCE_MUST_BE_NEW';
    end if;
    v_evidence := v_evidence || jsonb_build_object(
      'distanceMeters', round(v_distance)::integer,
      'siteVerified', true
    );
    new.evidence := jsonb_set(
      new.evidence,
      array[(v_new_evidence_count - 1)::text],
      v_evidence,
      false
    );
  end if;

  if new.status = 'submitted'
     and old.status in ('checked-in', 'in-progress', 'manager-returned')
     and new.evidence_required then
    if v_new_evidence_count <> v_old_evidence_count + 1 then
      raise exception using
        errcode = '22023',
        message = 'WORKDAY_FINAL_EVIDENCE_REQUIRED';
    end if;
    if old.status = 'manager-returned' then
      if v_captured_at is null or v_captured_at <= old.updated_at then
        raise exception using
          errcode = '22023',
          message = 'WORKDAY_RETURNED_EVIDENCE_NOT_FRESH';
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists erp_workday_resubmission_integrity
  on public.erp_workday_workflows;
create trigger erp_workday_resubmission_integrity
before update on public.erp_workday_workflows
for each row execute function public.erp_enforce_workday_resubmission_integrity();

revoke all on function public.erp_enforce_workday_resubmission_integrity()
  from public, anon, authenticated, service_role;

create or replace function public.erp_demo_record_workday_location(
  p_workday_id uuid,
  p_employee_account_id text,
  p_latitude double precision,
  p_longitude double precision,
  p_accuracy_meters double precision,
  p_recorded_at timestamptz,
  p_idempotency_key text
)
returns public.erp_workday_location_events
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_workday public.erp_workday_workflows;
  v_geofence public.erp_workday_site_geofences;
  v_event public.erp_workday_location_events;
  v_distance double precision;
  v_inside boolean;
  v_key text := trim(coalesce(p_idempotency_key, ''));
begin
  select * into v_event
  from public.erp_workday_location_events
  where workday_id = p_workday_id
    and idempotency_key = v_key;
  if v_event.id is not null then return v_event; end if;

  select * into v_workday
  from public.erp_workday_workflows
  where id = p_workday_id
  for share;
  if v_workday.id is null
     or v_workday.employee_account_id <> trim(coalesce(p_employee_account_id, ''))
     or v_workday.status not in ('checked-in', 'in-progress', 'manager-returned') then
    raise exception using
      errcode = '42501',
      message = 'WORKDAY_LOCATION_NOT_ALLOWED';
  end if;
  if p_latitude is null
     or p_latitude not between -90 and 90
     or p_longitude is null
     or p_longitude not between -180 and 180
     or p_accuracy_meters is null
     or not (p_accuracy_meters > 0 and p_accuracy_meters <= 250)
     or p_recorded_at < now() - interval '10 minutes'
     or p_recorded_at > now() + interval '2 minutes'
     or char_length(v_key) not between 8 and 200 then
    raise exception using
      errcode = '22023',
      message = 'WORKDAY_LOCATION_INPUT_INVALID';
  end if;

  select * into v_geofence
  from public.erp_workday_site_geofences
  where site_id = v_workday.site_id
    and tenant_id = v_workday.tenant_id;
  if v_geofence.site_id is null then
    raise exception using
      errcode = 'P0002',
      message = 'WORKDAY_GEOFENCE_NOT_FOUND';
  end if;

  v_distance := public.erp_workday_distance_meters(
    p_latitude,
    p_longitude,
    v_geofence.center_latitude,
    v_geofence.center_longitude
  );
  v_inside := v_distance <= v_geofence.radius_meters;

  insert into public.erp_workday_location_events (
    workday_id,
    tenant_id,
    site_id,
    employee_account_id,
    latitude,
    longitude,
    accuracy_meters,
    distance_meters,
    inside_geofence,
    recorded_at,
    idempotency_key
  ) values (
    v_workday.id,
    v_workday.tenant_id,
    v_workday.site_id,
    v_workday.employee_account_id,
    p_latitude,
    p_longitude,
    p_accuracy_meters,
    round(v_distance)::integer,
    v_inside,
    p_recorded_at,
    v_key
  )
  returning * into v_event;
  return v_event;
end;
$$;

revoke all on function public.erp_demo_record_workday_location(
  uuid,
  text,
  double precision,
  double precision,
  double precision,
  timestamptz,
  text
) from public, anon, authenticated, service_role;
grant execute on function public.erp_demo_record_workday_location(
  uuid,
  text,
  double precision,
  double precision,
  double precision,
  timestamptz,
  text
) to service_role;

commit;
