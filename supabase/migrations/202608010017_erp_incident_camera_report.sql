-- V4 (docs/DANH_GIA_HE_THONG_VA_GIAO_VIEC.md muc 3 L5, muc 7 dot 2): the
-- last decorative button found in the original 31/07 audit.
-- `camera-ai-workspace.tsx`'s `createAction()` only called `setActionMessage()`
-- -- "Giao quan ly kiem tra" / "Tao phieu hien truong" / "Bao quan ly" never
-- reached any Server Action, so nobody else (not even the same account on
-- reload) ever saw the report.
--
-- Fix chosen by the audit: wire this into the existing incident module
-- (`erp_incidents`, migration 011) rather than build a new table for
-- "camera alerts" -- a camera-flagged density issue *is* an incident, it
-- just starts from a camera instead of a person typing a report. Migration
-- 011 only shipped two RPCs, both transitions on an *existing* row (there
-- was no "create a new incident" path yet, since every incident so far
-- came from the fixed 12-row seed). This migration adds that missing
-- create path, scoped specifically to camera-originated reports.

begin;

create or replace function public.erp_incident_report_from_camera(
  p_tenant_id uuid,
  p_site_id uuid,
  p_actor_account_id text,
  p_actor_name text,
  p_actor_role text,
  p_camera_name text,
  p_zone text,
  p_note text,
  p_people_count integer,
  p_camera_status text
)
returns public.erp_incidents
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.erp_incidents;
  v_id text;
  v_site_code text;
  v_severity text;
  v_sla integer;
  v_action_label text;
  v_note_text text;
  v_evidence jsonb;
  v_entry jsonb;
  v_camera_name text := trim(coalesce(p_camera_name, ''));
  v_zone text := trim(coalesce(p_zone, ''));
begin
  if char_length(trim(coalesce(p_actor_account_id, ''))) not between 2 and 100
     or char_length(trim(coalesce(p_actor_name, ''))) < 1
     or lower(trim(coalesce(p_actor_role, ''))) not in ('director', 'manager', 'employee') then
    raise exception using errcode = '42501', message = 'INCIDENT_ACTOR_INVALID';
  end if;

  if not exists (select 1 from public.tenants where id = p_tenant_id) then
    raise exception using errcode = '42501', message = 'INCIDENT_TENANT_MISMATCH';
  end if;

  if char_length(v_camera_name) < 1 or char_length(v_zone) < 1 then
    raise exception using errcode = '22023', message = 'INCIDENT_CAMERA_INPUT_INVALID';
  end if;

  v_site_code := case p_site_id::text
    when '10000000-0000-4000-8000-000000000001' then 'TA'
    when '10000000-0000-4000-8000-000000000009' then 'TC'
    when '10000000-0000-4000-8000-000000000005' then 'TCO'
    when '10000000-0000-4000-8000-000000000003' then 'BD'
    else null
  end;
  if v_site_code is null then
    raise exception using errcode = '22023', message = 'INCIDENT_SITE_INVALID';
  end if;

  v_severity := case when p_camera_status = 'attention' then 'P3' else 'P4' end;
  v_sla := case v_severity when 'P3' then 10 else 15 end;
  v_id := 'INC-' || v_site_code || '-CAM' || to_char(clock_timestamp(), 'YYMMDDHH24MISSMS');

  v_action_label := case lower(trim(p_actor_role))
    when 'director' then 'Giao quản lý kiểm tra'
    when 'manager' then 'Tạo phiếu hiện trường'
    else 'Báo quản lý'
  end;
  v_note_text := case lower(trim(p_actor_role))
    when 'director' then 'Giám đốc giao quản lý cơ sở kiểm tra cảnh báo camera.'
    when 'manager' then 'Quản lý tạo phiếu kiểm tra hiện trường từ cảnh báo camera.'
    else 'Nhân viên báo quản lý về cảnh báo camera.'
  end;

  v_evidence := jsonb_build_array(jsonb_build_object(
    'id', gen_random_uuid()::text,
    'kind', 'Ảnh hiện trường',
    'label', 'Khung hình từ ' || v_camera_name,
    'addedBy', 'Camera AI · ' || v_camera_name,
    'addedAt', to_char(now() at time zone 'Asia/Ho_Chi_Minh', 'HH24:MI')
  ));

  v_entry := jsonb_build_object(
    'id', gen_random_uuid()::text,
    'at', to_char(now() at time zone 'Asia/Ho_Chi_Minh', 'HH24:MI'),
    'actor', p_actor_name,
    'action', v_action_label,
    'note', v_note_text
  );

  insert into public.erp_incidents (
    id, tenant_id, site_id, title, area, summary, severity, status, escalated,
    reported_at, reported_at_ts, sla_minutes, reporter,
    assignee_id, assignee_name, assignee_team, sop_code, sop_title,
    sop_completed_steps, sop_total_steps, next_action, evidence, timeline
  ) values (
    v_id, p_tenant_id, p_site_id,
    'Cảnh báo camera tại ' || v_zone,
    v_zone,
    coalesce(nullif(trim(p_note), ''), 'Camera AI ghi nhận bất thường tại khu vực này.')
      || ' Mật độ ghi nhận: ' || coalesce(p_people_count, 0) || ' người.',
    v_severity, 'reported', false,
    to_char(now() at time zone 'Asia/Ho_Chi_Minh', 'HH24:MI'), now(), v_sla,
    'Camera AI · ' || v_camera_name,
    null, 'Chưa giao', 'Chưa giao',
    'SOP-CAM-01', 'Kiểm tra và xác minh cảnh báo camera AI', 0, 4,
    'Quản lý xác minh hiện trường và giao xử lý nếu cần',
    v_evidence, jsonb_build_array(v_entry)
  )
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.erp_incident_report_from_camera(
  uuid, uuid, text, text, text, text, text, text, integer, text
) from public, anon, authenticated, service_role;
grant execute on function public.erp_incident_report_from_camera(
  uuid, uuid, text, text, text, text, text, text, integer, text
) to service_role;

commit;
