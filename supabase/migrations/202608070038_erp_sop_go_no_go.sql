-- T11b: daily opening readiness and human Go/No-Go decision.
--
-- The Playbook Tam Chuc supplies stable SOP codes and a Go/No-Go pattern, but
-- it is not an approved policy pack for this organization. Seeded checklist
-- items are therefore labelled `demo-unapproved` and every surface repeats:
-- "Demo operational summary — requires organizational approval".
--
-- A site manager submits the daily assessment. A different actor holding the
-- director role decides. A critical failure cannot be called GO; the only
-- override is an explicit written risk acceptance stored in the audit trail.

begin;

create table if not exists public.erp_sop_opening_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete restrict,
  item_code text not null check (char_length(trim(item_code)) between 5 and 60),
  sop_code text not null check (char_length(trim(sop_code)) between 5 and 40),
  title text not null check (char_length(trim(title)) between 5 and 200),
  operational_summary text not null check (
    char_length(trim(operational_summary)) between 12 and 1200
  ),
  source_reference text not null check (
    char_length(trim(source_reference)) between 8 and 300
  ),
  source_notice text not null default
    'Demo operational summary — requires organizational approval'
    check (source_notice =
      'Demo operational summary — requires organizational approval'),
  approval_status text not null default 'demo-unapproved' check (
    approval_status in ('demo-unapproved', 'approved', 'retired')
  ),
  version integer not null default 1 check (version >= 1),
  effective_from date,
  approved_by_account_id text,
  approved_at timestamptz,
  is_critical boolean not null default true,
  sort_order integer not null check (sort_order between 1 and 100),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, site_id, item_code),
  unique (id, tenant_id),
  check (
    approval_status <> 'approved'
    or (
      effective_from is not null
      and char_length(trim(coalesce(approved_by_account_id, ''))) >= 2
      and approved_at is not null
    )
  )
);

create index if not exists erp_sop_opening_items_site_idx
  on public.erp_sop_opening_items(tenant_id, site_id, active, sort_order);

create table if not exists public.erp_sop_opening_assessments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete restrict,
  assessment_code text not null check (
    char_length(trim(assessment_code)) between 10 and 60
  ),
  business_date date not null,
  status text not null check (
    status in ('submitted', 'go', 'no-go', 'risk-accepted')
  ),
  version integer not null default 1 check (version >= 1),
  submitted_by_account_id text not null check (
    char_length(trim(submitted_by_account_id)) between 2 and 100
  ),
  submitted_by_display_name text not null check (
    char_length(trim(submitted_by_display_name)) between 2 and 200
  ),
  submitted_at timestamptz not null,
  decision_due_at timestamptz not null,
  decision_sla_minutes integer not null default 15 check (
    decision_sla_minutes between 1 and 1440
  ),
  decision_by_account_id text,
  decision_by_display_name text,
  decided_at timestamptz,
  decision_note text,
  risk_acceptance text,
  last_submit_idempotency_key text not null check (
    char_length(trim(last_submit_idempotency_key)) between 8 and 200
  ),
  last_submit_request_hash text not null check (
    last_submit_request_hash ~ '^[0-9a-f]{64}$'
  ),
  decision_idempotency_key text,
  decision_request_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, site_id, business_date),
  unique (tenant_id, assessment_code),
  unique (tenant_id, last_submit_idempotency_key),
  unique (tenant_id, decision_idempotency_key),
  unique (id, tenant_id),
  check (
    (status = 'submitted'
      and decision_by_account_id is null
      and decision_by_display_name is null
      and decided_at is null
      and decision_note is null
      and risk_acceptance is null)
    or
    (status <> 'submitted'
      and char_length(trim(coalesce(decision_by_account_id, ''))) between 2 and 100
      and char_length(trim(coalesce(decision_by_display_name, ''))) between 2 and 200
      and decided_at is not null
      and char_length(trim(coalesce(decision_note, ''))) between 8 and 2000)
  ),
  check (
    (status = 'risk-accepted'
      and char_length(trim(coalesce(risk_acceptance, ''))) between 40 and 4000)
    or
    (status <> 'risk-accepted' and risk_acceptance is null)
  ),
  check (
    (decision_idempotency_key is null and decision_request_hash is null)
    or
    (char_length(trim(coalesce(decision_idempotency_key, ''))) between 8 and 200
      and decision_request_hash ~ '^[0-9a-f]{64}$')
  )
);

create index if not exists erp_sop_opening_assessments_queue_idx
  on public.erp_sop_opening_assessments(
    tenant_id, status, decision_due_at, business_date desc
  );

create table if not exists public.erp_sop_opening_results (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  assessment_id uuid not null,
  item_id uuid not null,
  result text not null check (result in ('pass', 'fail', 'not-applicable')),
  note text not null default '',
  evidence_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (assessment_id, item_id),
  foreign key (assessment_id, tenant_id)
    references public.erp_sop_opening_assessments(id, tenant_id)
    on delete cascade,
  foreign key (item_id, tenant_id)
    references public.erp_sop_opening_items(id, tenant_id)
    on delete restrict,
  check (
    result = 'pass'
    or char_length(trim(note)) between 8 and 1200
  ),
  check (
    evidence_reference is null
    or char_length(trim(evidence_reference)) between 4 and 1000
  )
);

create index if not exists erp_sop_opening_results_assessment_idx
  on public.erp_sop_opening_results(assessment_id, result);

create table if not exists public.erp_sop_audit_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete restrict,
  assessment_id uuid not null,
  action text not null check (
    action in (
      'assessment.submitted',
      'assessment.resubmitted',
      'assessment.go',
      'assessment.no-go',
      'assessment.risk-accepted'
    )
  ),
  from_status text,
  to_status text not null,
  actor_account_id text not null check (
    char_length(trim(actor_account_id)) between 2 and 100
  ),
  actor_display_name text not null check (
    char_length(trim(actor_display_name)) between 2 and 200
  ),
  detail jsonb not null default '{}'::jsonb check (
    jsonb_typeof(detail) = 'object'
  ),
  idempotency_key text not null check (
    char_length(trim(idempotency_key)) between 8 and 200
  ),
  created_at timestamptz not null default now(),
  unique (tenant_id, idempotency_key),
  foreign key (assessment_id, tenant_id)
    references public.erp_sop_opening_assessments(id, tenant_id)
    on delete restrict
);

create index if not exists erp_sop_audit_events_assessment_idx
  on public.erp_sop_audit_events(assessment_id, created_at desc);

create or replace function public.erp_sop_audit_immutable()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception using errcode = '42501', message = 'SOP_AUDIT_IMMUTABLE';
end;
$$;

drop trigger if exists erp_sop_audit_immutable on public.erp_sop_audit_events;
create trigger erp_sop_audit_immutable
before update or delete on public.erp_sop_audit_events
for each row execute function public.erp_sop_audit_immutable();

create or replace function public.erp_sop_submit_opening_assessment(
  p_tenant_id uuid,
  p_site_id uuid,
  p_business_date date,
  p_actor_account_id text,
  p_actor_display_name text,
  p_expected_version integer,
  p_results jsonb,
  p_idempotency_key text,
  p_request_hash text
)
returns public.erp_sop_opening_assessments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_assessment public.erp_sop_opening_assessments;
  v_previous_status text;
  v_expected_count integer;
  v_submitted_count integer;
  v_unique_count integer;
  v_known_count integer;
  v_actor text := trim(coalesce(p_actor_account_id, ''));
  v_actor_name text := trim(coalesce(p_actor_display_name, ''));
  v_key text := trim(coalesce(p_idempotency_key, ''));
  v_hash text := trim(coalesce(p_request_hash, ''));
  v_site_code text;
  v_action text;
  v_now timestamptz := now();
begin
  if p_site_id is null
     or p_business_date is null
     or p_results is null
     or p_business_date <> timezone('Asia/Ho_Chi_Minh', v_now)::date
     or char_length(v_actor) not between 2 and 100
     or char_length(v_actor_name) not between 2 and 200
     or char_length(v_key) not between 8 and 200
     or v_hash !~ '^[0-9a-f]{64}$'
     or jsonb_typeof(p_results) <> 'array' then
    raise exception using errcode = '22023', message = 'SOP_ASSESSMENT_INPUT_INVALID';
  end if;

  if not public.erp_account_has_active_role(
    p_tenant_id, v_actor, 'regional-manager', p_site_id
  ) then
    raise exception using errcode = '42501', message = 'SOP_MANAGER_ROLE_REQUIRED';
  end if;

  select upper(regexp_replace(site.slug, '[^a-zA-Z0-9]', '', 'g'))
  into v_site_code
  from public.sites site
  where site.id = p_site_id
    and site.tenant_id = p_tenant_id;
  if v_site_code is null then
    raise exception using errcode = '23503', message = 'SOP_SITE_TENANT_MISMATCH';
  end if;

  select count(*) into v_expected_count
  from public.erp_sop_opening_items item
  where item.tenant_id = p_tenant_id
    and item.site_id = p_site_id
    and item.active = true;
  if v_expected_count = 0 then
    raise exception using errcode = '22023', message = 'SOP_CHECKLIST_NOT_CONFIGURED';
  end if;

  select
    count(*),
    count(distinct entry.item_id),
    count(item.id)
  into v_submitted_count, v_unique_count, v_known_count
  from jsonb_to_recordset(p_results) as entry(
    item_id uuid,
    result text,
    note text,
    evidence_reference text
  )
  left join public.erp_sop_opening_items item
    on item.id = entry.item_id
   and item.tenant_id = p_tenant_id
   and item.site_id = p_site_id
   and item.active = true;

  if v_submitted_count <> v_expected_count
     or v_unique_count <> v_expected_count
     or v_known_count <> v_expected_count
     or exists (
       select 1
       from jsonb_to_recordset(p_results) as entry(
         item_id uuid,
         result text,
         note text,
         evidence_reference text
       )
       where entry.result not in ('pass', 'fail', 'not-applicable')
          or (
            entry.result <> 'pass'
            and char_length(trim(coalesce(entry.note, ''))) not between 8 and 1200
          )
          or (
            entry.evidence_reference is not null
            and char_length(trim(entry.evidence_reference)) not between 4 and 1000
          )
     )
     or exists (
       select 1
       from jsonb_to_recordset(p_results) as entry(
         item_id uuid,
         result text,
         note text,
         evidence_reference text
       )
       join public.erp_sop_opening_items item
         on item.id = entry.item_id
        and item.tenant_id = p_tenant_id
       where item.is_critical = true
         and entry.result = 'not-applicable'
     ) then
    raise exception using errcode = '22023', message = 'SOP_CHECKLIST_RESULT_INVALID';
  end if;

  select * into v_assessment
  from public.erp_sop_opening_assessments assessment
  where assessment.tenant_id = p_tenant_id
    and assessment.site_id = p_site_id
    and assessment.business_date = p_business_date
  for update;

  if v_assessment.id is not null
     and v_assessment.last_submit_idempotency_key = v_key then
    if v_assessment.last_submit_request_hash <> v_hash
       or v_assessment.submitted_by_account_id <> v_actor then
      raise exception using errcode = '22023', message = 'SOP_IDEMPOTENCY_CONFLICT';
    end if;
    return v_assessment;
  end if;

  if v_assessment.id is null then
    if coalesce(p_expected_version, 0) <> 0 then
      raise exception using errcode = '40001', message = 'SOP_ASSESSMENT_VERSION_CONFLICT';
    end if;
    v_action := 'assessment.submitted';
    insert into public.erp_sop_opening_assessments (
      tenant_id,
      site_id,
      assessment_code,
      business_date,
      status,
      submitted_by_account_id,
      submitted_by_display_name,
      submitted_at,
      decision_due_at,
      decision_sla_minutes,
      last_submit_idempotency_key,
      last_submit_request_hash
    ) values (
      p_tenant_id,
      p_site_id,
      'GNG-' || left(v_site_code, 12) || '-' || to_char(p_business_date, 'YYYYMMDD'),
      p_business_date,
      'submitted',
      v_actor,
      v_actor_name,
      v_now,
      v_now + interval '15 minutes',
      15,
      v_key,
      v_hash
    )
    returning * into v_assessment;
    v_previous_status := null;
  else
    if v_assessment.version <> p_expected_version then
      raise exception using errcode = '40001', message = 'SOP_ASSESSMENT_VERSION_CONFLICT';
    end if;
    if v_assessment.status = 'submitted' then
      raise exception using errcode = '22023', message = 'SOP_ASSESSMENT_ALREADY_SUBMITTED';
    end if;
    if v_assessment.status in ('go', 'risk-accepted') then
      raise exception using errcode = '22023', message = 'SOP_ASSESSMENT_ALREADY_FINAL';
    end if;
    v_previous_status := v_assessment.status;
    v_action := 'assessment.resubmitted';
    update public.erp_sop_opening_assessments set
      status = 'submitted',
      version = version + 1,
      submitted_by_account_id = v_actor,
      submitted_by_display_name = v_actor_name,
      submitted_at = v_now,
      decision_due_at = v_now + interval '15 minutes',
      decision_by_account_id = null,
      decision_by_display_name = null,
      decided_at = null,
      decision_note = null,
      risk_acceptance = null,
      last_submit_idempotency_key = v_key,
      last_submit_request_hash = v_hash,
      decision_idempotency_key = null,
      decision_request_hash = null,
      updated_at = v_now
    where id = v_assessment.id
    returning * into v_assessment;
  end if;

  delete from public.erp_sop_opening_results result_row
  where result_row.assessment_id = v_assessment.id;

  insert into public.erp_sop_opening_results (
    tenant_id,
    assessment_id,
    item_id,
    result,
    note,
    evidence_reference
  )
  select
    p_tenant_id,
    v_assessment.id,
    entry.item_id,
    entry.result,
    trim(coalesce(entry.note, '')),
    nullif(trim(coalesce(entry.evidence_reference, '')), '')
  from jsonb_to_recordset(p_results) as entry(
    item_id uuid,
    result text,
    note text,
    evidence_reference text
  );

  insert into public.erp_sop_audit_events (
    tenant_id,
    site_id,
    assessment_id,
    action,
    from_status,
    to_status,
    actor_account_id,
    actor_display_name,
    detail,
    idempotency_key
  ) values (
    p_tenant_id,
    p_site_id,
    v_assessment.id,
    v_action,
    v_previous_status,
    'submitted',
    v_actor,
    v_actor_name,
    jsonb_build_object(
      'version', v_assessment.version,
      'decisionDueAt', v_assessment.decision_due_at,
      'results', p_results
    ),
    v_key
  );

  return v_assessment;
end;
$$;

create or replace function public.erp_sop_decide_opening_assessment(
  p_tenant_id uuid,
  p_assessment_id uuid,
  p_actor_account_id text,
  p_actor_display_name text,
  p_expected_version integer,
  p_decision text,
  p_decision_note text,
  p_risk_acceptance text,
  p_idempotency_key text,
  p_request_hash text
)
returns public.erp_sop_opening_assessments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_assessment public.erp_sop_opening_assessments;
  v_actor text := trim(coalesce(p_actor_account_id, ''));
  v_actor_name text := trim(coalesce(p_actor_display_name, ''));
  v_decision text := lower(trim(coalesce(p_decision, '')));
  v_note text := trim(coalesce(p_decision_note, ''));
  v_risk text := trim(coalesce(p_risk_acceptance, ''));
  v_key text := trim(coalesce(p_idempotency_key, ''));
  v_hash text := trim(coalesce(p_request_hash, ''));
  v_critical_failures integer;
  v_now timestamptz := now();
begin
  if p_assessment_id is null
     or p_expected_version is null
     or p_expected_version < 1
     or char_length(v_actor) not between 2 and 100
     or char_length(v_actor_name) not between 2 and 200
     or v_decision not in ('go', 'no-go', 'risk-accepted')
     or char_length(v_note) not between 8 and 2000
     or char_length(v_key) not between 8 and 200
     or v_hash !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = '22023', message = 'SOP_DECISION_INPUT_INVALID';
  end if;

  select * into v_assessment
  from public.erp_sop_opening_assessments assessment
  where assessment.id = p_assessment_id
    and assessment.tenant_id = p_tenant_id
  for update;
  if v_assessment.id is null then
    raise exception using errcode = 'P0002', message = 'SOP_ASSESSMENT_NOT_FOUND';
  end if;

  if not public.erp_account_has_active_role(
    p_tenant_id, v_actor, 'director', v_assessment.site_id
  ) then
    raise exception using errcode = '42501', message = 'SOP_DIRECTOR_ROLE_REQUIRED';
  end if;
  if v_actor = v_assessment.submitted_by_account_id then
    raise exception using errcode = '42501', message = 'SOP_MAKER_CHECKER_SEPARATION_REQUIRED';
  end if;

  if v_assessment.decision_idempotency_key = v_key then
    if v_assessment.decision_request_hash <> v_hash
       or v_assessment.decision_by_account_id <> v_actor then
      raise exception using errcode = '22023', message = 'SOP_IDEMPOTENCY_CONFLICT';
    end if;
    return v_assessment;
  end if;

  if v_assessment.version <> p_expected_version then
    raise exception using errcode = '40001', message = 'SOP_ASSESSMENT_VERSION_CONFLICT';
  end if;
  if v_assessment.status <> 'submitted' then
    raise exception using errcode = '22023', message = 'SOP_ASSESSMENT_ALREADY_DECIDED';
  end if;

  select count(*) into v_critical_failures
  from public.erp_sop_opening_results result_row
  join public.erp_sop_opening_items item on item.id = result_row.item_id
  where result_row.assessment_id = v_assessment.id
    and item.is_critical = true
    and result_row.result <> 'pass';

  if v_decision = 'go' and v_critical_failures > 0 then
    raise exception using errcode = '22023', message = 'SOP_CRITICAL_ITEM_BLOCKS_GO';
  end if;
  if v_decision = 'risk-accepted'
     and (v_critical_failures = 0 or char_length(v_risk) not between 40 and 4000) then
    raise exception using errcode = '22023', message = 'SOP_RISK_ACCEPTANCE_INVALID';
  end if;
  if v_decision <> 'risk-accepted' and char_length(v_risk) > 0 then
    raise exception using errcode = '22023', message = 'SOP_RISK_ACCEPTANCE_INVALID';
  end if;

  update public.erp_sop_opening_assessments set
    status = v_decision,
    version = version + 1,
    decision_by_account_id = v_actor,
    decision_by_display_name = v_actor_name,
    decided_at = v_now,
    decision_note = v_note,
    risk_acceptance = case when v_decision = 'risk-accepted' then v_risk else null end,
    decision_idempotency_key = v_key,
    decision_request_hash = v_hash,
    updated_at = v_now
  where id = v_assessment.id
  returning * into v_assessment;

  insert into public.erp_sop_audit_events (
    tenant_id,
    site_id,
    assessment_id,
    action,
    from_status,
    to_status,
    actor_account_id,
    actor_display_name,
    detail,
    idempotency_key
  ) values (
    p_tenant_id,
    v_assessment.site_id,
    v_assessment.id,
    'assessment.' || v_decision,
    'submitted',
    v_decision,
    v_actor,
    v_actor_name,
    jsonb_build_object(
      'version', v_assessment.version,
      'criticalFailures', v_critical_failures,
      'decisionNote', v_note,
      'riskAcceptance', case when v_decision = 'risk-accepted' then v_risk else null end
    ),
    v_key
  );

  return v_assessment;
end;
$$;

-- Daily opening is now a base site-management responsibility, not a special
-- Tam Chuc-only demo card. Append the module without replacing any grant a
-- director has already configured.
with changed_grants as (
  update public.erp_employee_access access set
    module_ids = array_append(access.module_ids, 'sop-dien-tap'),
    version = access.version + 1,
    updated_by_account_id = 'system-t11b',
    updated_at = now()
  where access.tenant_id = '00000000-0000-4000-8000-000000000001'
    and not access.module_ids @> array['sop-dien-tap']::text[]
    and exists (
      select 1
      from public.erp_account_role_assignments assignment
      where assignment.tenant_id = access.tenant_id
        and assignment.account_id = access.employee_account_id
        and assignment.site_id = access.site_id
        and assignment.role = 'regional-manager'
        and assignment.status = 'active'
        and assignment.effective_from <= now()
        and (assignment.effective_until is null or assignment.effective_until > now())
    )
  returning access.*
)
insert into public.erp_employee_access_audit (
  tenant_id,
  employee_account_id,
  site_id,
  actor_account_id,
  action,
  module_ids
)
select
  grant_row.tenant_id,
  grant_row.employee_account_id,
  grant_row.site_id,
  'system-t11b',
  'employee.access.updated',
  grant_row.module_ids
from changed_grants grant_row;

-- Five concise readiness summaries per site. They adapt the supplied Tam Chuc
-- playbook into a demo checklist; none is represented as approved policy.
insert into public.erp_sop_opening_items (
  id,
  tenant_id,
  site_id,
  item_code,
  sop_code,
  title,
  operational_summary,
  source_reference,
  approval_status,
  version,
  effective_from,
  is_critical,
  sort_order
)
select
  gen_random_uuid(),
  '00000000-0000-4000-8000-000000000001'::uuid,
  site.id,
  upper(left(regexp_replace(site.slug, '[^a-zA-Z0-9]', '', 'g'), 8)) || '-' || template.item_suffix,
  template.sop_code,
  template.title,
  template.operational_summary,
  template.source_reference,
  'demo-unapproved',
  1,
  null,
  template.is_critical,
  template.sort_order
from public.sites site
cross join (
  values
    (
      'CMD-01',
      'SOP-CMD-03',
      'Chỉ huy và bàn giao đầu ngày',
      'Xác nhận người chỉ huy, người thay thế, kênh liên lạc và các việc còn mở đã được đọc lại trước giờ đón khách.',
      'Playbook Tam Chuc.pdf · PDF p.65 và pp.69–78',
      true,
      1
    ),
    (
      'SAFE-01',
      'SOP-EMG-03',
      'Tam Phòng và đường thoát',
      'Kiểm tra con người, rào chắn/vật lý và công nghệ cùng sẵn sàng; lối thoát và điểm tập kết không bị cản trở.',
      'Playbook Tam Chuc.pdf · PDF pp.35–45 và p.57',
      true,
      2
    ),
    (
      'MED-01',
      'SOP-MED-01',
      'Phản ứng y tế và chuyển tuyến',
      'Xác nhận đầu mối sơ cứu, bộ đàm/điện thoại, phương tiện tiếp cận và hành lang chuyển tuyến có thể kích hoạt.',
      'Playbook Tam Chuc.pdf · PDF p.60',
      true,
      3
    ),
    (
      'FLOW-01',
      'SOP-FLOW-01',
      'Luồng vào không vượt năng lực thoát',
      'Đối chiếu ngưỡng sức chứa theo giờ và phương án giảm/dừng luồng ở điểm kiểm soát phía trước điểm nghẽn.',
      'Playbook Tam Chuc.pdf · PDF p.62',
      true,
      4
    ),
    (
      'COMMS-01',
      'SOP-CMD-03',
      'Thử kênh thông tin vận hành',
      'Thử một lượt liên lạc giữa cổng, điểm nghẽn, y tế và quản lý; ghi tham chiếu biên bản hoặc kênh đã thử.',
      'Playbook Tam Chuc.pdf · PDF p.65 và pp.69–78',
      false,
      5
    )
) as template(
  item_suffix,
  sop_code,
  title,
  operational_summary,
  source_reference,
  is_critical,
  sort_order
)
where site.tenant_id = '00000000-0000-4000-8000-000000000001'
  and site.slug in ('trang-an', 'tam-chuc', 'tam-coc-bich-dong', 'bai-dinh')
on conflict (tenant_id, site_id, item_code) do nothing;

alter table public.erp_sop_opening_items enable row level security;
alter table public.erp_sop_opening_assessments enable row level security;
alter table public.erp_sop_opening_results enable row level security;
alter table public.erp_sop_audit_events enable row level security;

revoke all on table public.erp_sop_opening_items
  from public, anon, authenticated, service_role;
revoke all on table public.erp_sop_opening_assessments
  from public, anon, authenticated, service_role;
revoke all on table public.erp_sop_opening_results
  from public, anon, authenticated, service_role;
revoke all on table public.erp_sop_audit_events
  from public, anon, authenticated, service_role;

grant select on table public.erp_sop_opening_items to service_role;
grant select on table public.erp_sop_opening_assessments to service_role;
grant select on table public.erp_sop_opening_results to service_role;
grant select on table public.erp_sop_audit_events to service_role;

create policy erp_sop_opening_items_service_read
on public.erp_sop_opening_items for select to service_role
using (tenant_id = '00000000-0000-4000-8000-000000000001'::uuid);

create policy erp_sop_opening_assessments_service_read
on public.erp_sop_opening_assessments for select to service_role
using (tenant_id = '00000000-0000-4000-8000-000000000001'::uuid);

create policy erp_sop_opening_results_service_read
on public.erp_sop_opening_results for select to service_role
using (tenant_id = '00000000-0000-4000-8000-000000000001'::uuid);

create policy erp_sop_audit_events_service_read
on public.erp_sop_audit_events for select to service_role
using (tenant_id = '00000000-0000-4000-8000-000000000001'::uuid);

revoke all on function public.erp_sop_audit_immutable()
  from public, anon, authenticated, service_role;
revoke all on function public.erp_sop_submit_opening_assessment(
  uuid, uuid, date, text, text, integer, jsonb, text, text
) from public, anon, authenticated, service_role;
revoke all on function public.erp_sop_decide_opening_assessment(
  uuid, uuid, text, text, integer, text, text, text, text, text
) from public, anon, authenticated, service_role;

grant execute on function public.erp_sop_submit_opening_assessment(
  uuid, uuid, date, text, text, integer, jsonb, text, text
) to service_role;
grant execute on function public.erp_sop_decide_opening_assessment(
  uuid, uuid, text, text, integer, text, text, text, text, text
) to service_role;

commit;
