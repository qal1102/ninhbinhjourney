-- T11a: hourly bottleneck capacity from explicit physical assumptions.
--
-- The previous ERP capacity screen deliberately rendered no figures because
-- none had a defensible source. This slice adds a real configuration ledger:
-- every threshold exposes vehicles, seats per vehicle and round-trip minutes,
-- and PostgreSQL derives hourly throughput from those inputs. The initial
-- records are clearly marked `estimate`; a director can later replace them
-- with client-supplied or measured values without editing source code.
--
-- Accepted T8 gate scans are the first upstream demand signal. They are not a
-- sensor at the bottleneck, so the application labels them as a proxy rather
-- than pretending the value is realtime occupancy.

begin;

create table if not exists public.erp_capacity_thresholds (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete restrict,
  threshold_code text not null check (char_length(trim(threshold_code)) between 4 and 40),
  bottleneck_name text not null check (char_length(trim(bottleneck_name)) between 3 and 160),
  bottleneck_kind text not null check (
    bottleneck_kind in ('boat-pier', 'ticket-gate', 'electric-shuttle')
  ),
  vehicle_count integer not null check (vehicle_count between 1 and 10000),
  seats_per_vehicle integer not null check (seats_per_vehicle between 1 and 500),
  round_trip_minutes numeric(8,2) not null check (round_trip_minutes between 1 and 1440),
  hourly_capacity integer generated always as (
    floor(
      (vehicle_count::numeric * seats_per_vehicle::numeric * 60::numeric)
      / round_trip_minutes
    )::integer
  ) stored,
  watch_percent integer not null default 70 check (watch_percent between 1 and 99),
  restrict_percent integer not null default 85 check (restrict_percent between 2 and 100),
  stop_percent integer not null default 100 check (stop_percent between 3 and 120),
  source_kind text not null check (
    source_kind in ('estimate', 'customer', 'measured')
  ),
  source_note text not null check (char_length(trim(source_note)) between 8 and 1000),
  effective_from date not null default current_date,
  version integer not null default 1 check (version >= 1),
  updated_by_account_id text not null check (char_length(trim(updated_by_account_id)) between 2 and 100),
  updated_by_display_name text not null check (char_length(trim(updated_by_display_name)) between 2 and 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, threshold_code),
  unique (id, tenant_id),
  check (watch_percent < restrict_percent and restrict_percent < stop_percent)
);

create index if not exists erp_capacity_thresholds_site_idx
  on public.erp_capacity_thresholds(tenant_id, site_id, effective_from desc);

create table if not exists public.erp_capacity_response_rules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  threshold_id uuid not null references public.erp_capacity_thresholds(id) on delete cascade,
  level text not null check (level in ('green', 'yellow', 'orange', 'red')),
  action_text text not null check (char_length(trim(action_text)) between 8 and 1000),
  owner_role text not null check (owner_role in ('employee', 'manager', 'director')),
  sla_minutes integer check (sla_minutes is null or sla_minutes between 1 and 1440),
  created_at timestamptz not null default now(),
  unique (threshold_id, level)
);

create index if not exists erp_capacity_response_rules_threshold_idx
  on public.erp_capacity_response_rules(threshold_id, level);

create table if not exists public.erp_capacity_audit_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete restrict,
  threshold_id uuid not null references public.erp_capacity_thresholds(id) on delete restrict,
  action text not null check (action in ('threshold.seeded', 'threshold.updated')),
  actor_account_id text not null check (char_length(trim(actor_account_id)) between 2 and 100),
  actor_display_name text not null check (char_length(trim(actor_display_name)) between 2 and 200),
  detail jsonb not null default '{}'::jsonb check (jsonb_typeof(detail) = 'object'),
  created_at timestamptz not null default now()
);

create index if not exists erp_capacity_audit_events_threshold_idx
  on public.erp_capacity_audit_events(threshold_id, created_at desc);

create or replace function public.erp_capacity_audit_immutable()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception using errcode = '42501', message = 'CAPACITY_AUDIT_IMMUTABLE';
end;
$$;

drop trigger if exists erp_capacity_audit_immutable on public.erp_capacity_audit_events;
create trigger erp_capacity_audit_immutable
before update or delete on public.erp_capacity_audit_events
for each row execute function public.erp_capacity_audit_immutable();

create or replace function public.erp_capacity_update_threshold(
  p_tenant_id uuid,
  p_threshold_id uuid,
  p_actor_account_id text,
  p_actor_display_name text,
  p_expected_version integer,
  p_vehicle_count integer,
  p_seats_per_vehicle integer,
  p_round_trip_minutes numeric,
  p_source_kind text,
  p_source_note text
)
returns public.erp_capacity_thresholds
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before public.erp_capacity_thresholds;
  v_after public.erp_capacity_thresholds;
  v_actor text := trim(coalesce(p_actor_account_id, ''));
  v_actor_name text := trim(coalesce(p_actor_display_name, ''));
begin
  select * into v_before
  from public.erp_capacity_thresholds threshold
  where threshold.id = p_threshold_id
    and threshold.tenant_id = p_tenant_id
  for update;

  if v_before.id is null then
    raise exception using errcode = 'P0002', message = 'CAPACITY_THRESHOLD_NOT_FOUND';
  end if;

  if not public.erp_account_has_active_role(
    p_tenant_id,
    v_actor,
    'director',
    v_before.site_id
  ) then
    raise exception using errcode = '42501', message = 'CAPACITY_DIRECTOR_REQUIRED';
  end if;

  if v_before.version <> p_expected_version then
    raise exception using errcode = '40001', message = 'CAPACITY_VERSION_CONFLICT';
  end if;

  if char_length(v_actor_name) not between 2 and 200
     or p_vehicle_count not between 1 and 10000
     or p_seats_per_vehicle not between 1 and 500
     or p_round_trip_minutes not between 1 and 1440
     or p_source_kind not in ('estimate', 'customer', 'measured')
     or char_length(trim(coalesce(p_source_note, ''))) not between 8 and 1000 then
    raise exception using errcode = '22023', message = 'CAPACITY_INPUT_INVALID';
  end if;

  update public.erp_capacity_thresholds set
    vehicle_count = p_vehicle_count,
    seats_per_vehicle = p_seats_per_vehicle,
    round_trip_minutes = p_round_trip_minutes,
    source_kind = p_source_kind,
    source_note = trim(p_source_note),
    version = version + 1,
    updated_by_account_id = v_actor,
    updated_by_display_name = v_actor_name,
    updated_at = now()
  where id = v_before.id
  returning * into v_after;

  insert into public.erp_capacity_audit_events (
    tenant_id,
    site_id,
    threshold_id,
    action,
    actor_account_id,
    actor_display_name,
    detail
  ) values (
    p_tenant_id,
    v_after.site_id,
    v_after.id,
    'threshold.updated',
    v_actor,
    v_actor_name,
    jsonb_build_object(
      'before', jsonb_build_object(
        'vehicle_count', v_before.vehicle_count,
        'seats_per_vehicle', v_before.seats_per_vehicle,
        'round_trip_minutes', v_before.round_trip_minutes,
        'hourly_capacity', v_before.hourly_capacity,
        'source_kind', v_before.source_kind,
        'source_note', v_before.source_note,
        'version', v_before.version
      ),
      'after', jsonb_build_object(
        'vehicle_count', v_after.vehicle_count,
        'seats_per_vehicle', v_after.seats_per_vehicle,
        'round_trip_minutes', v_after.round_trip_minutes,
        'hourly_capacity', v_after.hourly_capacity,
        'source_kind', v_after.source_kind,
        'source_note', v_after.source_note,
        'version', v_after.version
      )
    )
  );

  return v_after;
end;
$$;

-- One conservative, transparent starting assumption per operating site.
-- These are configuration seeds, not claims about live fleets. The UI shows
-- the formula and the `estimate` source beside every result.
insert into public.erp_capacity_thresholds (
  id, tenant_id, site_id, threshold_code, bottleneck_name, bottleneck_kind,
  vehicle_count, seats_per_vehicle, round_trip_minutes,
  watch_percent, restrict_percent, stop_percent,
  source_kind, source_note, effective_from,
  updated_by_account_id, updated_by_display_name
) values
  (
    '82000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    'TA-PIER-01', 'Bến thuyền trung tâm', 'boat-pier',
    600, 4, 180, 70, 85, 100,
    'estimate',
    'Giả định khởi tạo T11: số thuyền hoạt động đồng thời và vòng tuyến chưa được khách xác nhận; thay bằng số đo sau khi T8 tích lũy đủ dữ liệu.',
    '2026-08-07', 'system', 'Hệ thống'
  ),
  (
    '82000000-0000-4000-8000-000000000002',
    '00000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000005',
    'TCO-PIER-01', 'Bến đò Tam Cốc', 'boat-pier',
    300, 2, 120, 70, 85, 100,
    'estimate',
    'Giả định khởi tạo T11: số thuyền hoạt động đồng thời và vòng tuyến chưa được khách xác nhận; thay bằng số đo sau khi T8 tích lũy đủ dữ liệu.',
    '2026-08-07', 'system', 'Hệ thống'
  ),
  (
    '82000000-0000-4000-8000-000000000003',
    '00000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000009',
    'TC-PIER-01', 'Bến thuyền Khách Điện', 'boat-pier',
    24, 48, 60, 70, 85, 100,
    'estimate',
    'Giả định khởi tạo T11 từ điểm nghẽn ưu tiên trong Playbook Tam Chúc; đội tàu và thời gian vòng chưa được đơn vị vận hành xác nhận.',
    '2026-08-07', 'system', 'Hệ thống'
  ),
  (
    '82000000-0000-4000-8000-000000000004',
    '00000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000003',
    'BD-SHUTTLE-01', 'Bãi xe điện trung tâm', 'electric-shuttle',
    60, 12, 30, 70, 85, 100,
    'estimate',
    'Giả định khởi tạo T11: số xe hoạt động đồng thời, số ghế và vòng quay chưa được khách xác nhận; thay bằng số vận hành đã đo.',
    '2026-08-07', 'system', 'Hệ thống'
  )
on conflict (tenant_id, threshold_code) do nothing;

insert into public.erp_capacity_response_rules (
  tenant_id, threshold_id, level, action_text, owner_role, sla_minutes
)
select
  threshold.tenant_id,
  threshold.id,
  rule.level,
  rule.action_text,
  rule.owner_role,
  rule.sla_minutes
from public.erp_capacity_thresholds threshold
cross join (
  values
    ('green', 'Giữ nhịp tiếp nhận hiện tại và theo dõi lượt cổng trong khung giờ.', 'employee', null::integer),
    ('yellow', 'Chuẩn bị làn chờ dự phòng, kiểm tra nhân lực và xác nhận đường thoát phía trước.', 'manager', 10),
    ('orange', 'Giảm luồng vào từ điểm kiểm soát phía trước và điều phối thêm nguồn lực tới điểm nghẽn.', 'manager', 5),
    ('red', 'Tạm dừng đưa khách vào điểm nghẽn, kích hoạt SOP phân luồng và báo giám đốc.', 'director', 1)
) as rule(level, action_text, owner_role, sla_minutes)
where threshold.tenant_id = '00000000-0000-4000-8000-000000000001'
on conflict (threshold_id, level) do nothing;

insert into public.erp_capacity_audit_events (
  tenant_id, site_id, threshold_id, action,
  actor_account_id, actor_display_name, detail
)
select
  threshold.tenant_id,
  threshold.site_id,
  threshold.id,
  'threshold.seeded',
  'system',
  'Hệ thống',
  jsonb_build_object(
    'threshold_code', threshold.threshold_code,
    'vehicle_count', threshold.vehicle_count,
    'seats_per_vehicle', threshold.seats_per_vehicle,
    'round_trip_minutes', threshold.round_trip_minutes,
    'hourly_capacity', threshold.hourly_capacity,
    'source_kind', threshold.source_kind,
    'version', threshold.version
  )
from public.erp_capacity_thresholds threshold
where threshold.tenant_id = '00000000-0000-4000-8000-000000000001'
  and not exists (
    select 1
    from public.erp_capacity_audit_events event
    where event.threshold_id = threshold.id
      and event.action = 'threshold.seeded'
  );

alter table public.erp_capacity_thresholds enable row level security;
alter table public.erp_capacity_response_rules enable row level security;
alter table public.erp_capacity_audit_events enable row level security;

revoke all on table public.erp_capacity_thresholds
  from public, anon, authenticated, service_role;
revoke all on table public.erp_capacity_response_rules
  from public, anon, authenticated, service_role;
revoke all on table public.erp_capacity_audit_events
  from public, anon, authenticated, service_role;

grant select on table public.erp_capacity_thresholds to service_role;
grant select on table public.erp_capacity_response_rules to service_role;
grant select on table public.erp_capacity_audit_events to service_role;

create policy erp_capacity_thresholds_service_read
on public.erp_capacity_thresholds for select to service_role
using (tenant_id = '00000000-0000-4000-8000-000000000001'::uuid);

create policy erp_capacity_response_rules_service_read
on public.erp_capacity_response_rules for select to service_role
using (tenant_id = '00000000-0000-4000-8000-000000000001'::uuid);

create policy erp_capacity_audit_events_service_read
on public.erp_capacity_audit_events for select to service_role
using (tenant_id = '00000000-0000-4000-8000-000000000001'::uuid);

revoke all on function public.erp_capacity_audit_immutable()
  from public, anon, authenticated, service_role;
revoke all on function public.erp_capacity_update_threshold(
  uuid, uuid, text, text, integer, integer, integer, numeric, text, text
) from public, anon, authenticated, service_role;
grant execute on function public.erp_capacity_update_threshold(
  uuid, uuid, text, text, integer, integer, integer, numeric, text, text
) to service_role;

commit;
