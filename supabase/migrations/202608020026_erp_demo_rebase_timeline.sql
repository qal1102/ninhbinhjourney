-- T5: bring the demo fixtures back to today, in one call.
--
-- Every seeded record carries a fixed date from the day it was written. A week
-- later the whole product opens red: incidents past SLA and auto-escalated by
-- the pg_cron job from migration 024, supplier invoices past due, festival
-- milestones behind schedule, shift closes filed "days ago". None of that is a
-- defect, and none of it can be explained away in front of a client either.
--
-- `erp_demo_rebase_timeline()` shifts the fixtures forward by a whole number of
-- days so the newest seeded incident lands on today, and clears the escalation
-- the clock produced on the way. Whole days, so shift labels ("Ca sáng
-- 07:00–12:00"), weekday-shaped scheduling and time-of-day text stay coherent.
--
-- Three limits, deliberate:
--   * It only touches rows this repository seeded, matched by their fixed id
--     patterns. A record created by a real action keeps its real timestamps --
--     rewriting those would be falsifying operating history.
--   * It never moves anything backwards. Running it twice on the same day is a
--     no-op, so it is safe to wire into a pre-demo routine.
--   * It is service-role only, like every other RPC here, and there is no
--     button for it. Reshaping data is not something a director should be able
--     to do by mis-clicking during a demo.

begin;

create or replace function public.erp_demo_rebase_timeline()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant constant uuid := '00000000-0000-4000-8000-000000000001';
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
        where entry->>'action' is distinct from 'Chuyển cấp tự động'
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

revoke all on function public.erp_demo_rebase_timeline() from public;
revoke all on function public.erp_demo_rebase_timeline() from anon;
revoke all on function public.erp_demo_rebase_timeline() from authenticated;
grant execute on function public.erp_demo_rebase_timeline() to service_role;

commit;
