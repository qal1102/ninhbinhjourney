-- Persist the "An toàn & sự cố" (incident) workflow to Supabase instead of
-- local useState() that resets on every mount.
--
-- `incident-workflow-workspace.tsx` was 100% decorative: every status
-- transition (manager tiếp nhận/giao/xác minh/đóng, employee báo đã xử lý)
-- only called setCases() on a hard-coded 3-item array per site, invisible to
-- any other account or even the same account on a page reload. A different,
-- unrelated `confirm_incident_draft` RPC already exists in this database,
-- but it belongs to the public-facing "operator run" / QR check-in demo
-- subsystem (`demo_runs`, roles check-in-agent/site-supervisor/icc-operator)
-- and has no concept of ERP tenants, sites, directors or managers -- it is
-- not a fit for this module, so this migration gives the ERP module its own
-- table instead of forcing an incompatible join onto that system.
--
-- Evidence and timeline are stored as jsonb arrays on the incident row
-- rather than as separate tables: nothing in the product lets a user add
-- evidence yet (still read-only, same as before this migration), and every
-- timeline entry is always written atomically together with its status
-- transition, so a single-row jsonb append is sufficient and avoids an
-- unused join table.

begin;

create table if not exists public.erp_incidents (
  id text primary key check (char_length(id) between 3 and 40),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  area text not null check (char_length(area) between 1 and 200),
  summary text not null check (char_length(summary) between 1 and 2000),
  severity text not null check (severity in ('P1', 'P2', 'P3', 'P4')),
  status text not null check (status in ('reported', 'acknowledged', 'in-progress', 'verification', 'closed')),
  escalated boolean not null default false,
  escalation_reason text,
  reported_at text not null check (char_length(reported_at) between 1 and 20),
  sla_minutes integer not null check (sla_minutes > 0),
  elapsed_minutes integer not null check (elapsed_minutes >= 0),
  reporter text not null check (char_length(reporter) between 1 and 200),
  assignee_id text check (assignee_id is null or char_length(assignee_id) between 2 and 100),
  assignee_name text not null,
  assignee_team text not null,
  sop_code text not null,
  sop_title text not null,
  sop_completed_steps integer not null check (sop_completed_steps >= 0),
  sop_total_steps integer not null check (sop_total_steps > 0),
  next_action text not null,
  evidence jsonb not null default '[]'::jsonb,
  timeline jsonb not null default '[]'::jsonb,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (sop_completed_steps <= sop_total_steps)
);

create index if not exists erp_incidents_site_status_idx
  on public.erp_incidents(site_id, status, severity);
create index if not exists erp_incidents_assignee_idx
  on public.erp_incidents(assignee_id);

create or replace function public.erp_incident_manager_transition(
  p_tenant_id uuid,
  p_incident_id text,
  p_actor_account_id text,
  p_actor_name text,
  p_actor_role text
)
returns public.erp_incidents
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.erp_incidents;
  v_role text := lower(trim(coalesce(p_actor_role, '')));
  v_actor_id text := trim(coalesce(p_actor_account_id, ''));
  v_actor_name text := trim(coalesce(p_actor_name, ''));
  v_next_status text;
  v_action text;
  v_note text;
  v_next_action_text text;
  v_assignee_id text;
  v_assignee_name text;
  v_entry jsonb;
begin
  if v_role <> 'manager'
     or char_length(v_actor_id) not between 2 and 100
     or char_length(v_actor_name) < 1 then
    raise exception using errcode = '42501', message = 'INCIDENT_ACTOR_INVALID';
  end if;

  select * into v_row
  from public.erp_incidents
  where id = p_incident_id and tenant_id = p_tenant_id
  for update;
  if v_row.id is null then
    raise exception using errcode = 'P0002', message = 'INCIDENT_NOT_FOUND';
  end if;

  if v_row.status = 'reported' then
    v_next_status := 'acknowledged';
    v_action := 'Tiếp nhận sự cố';
    v_note := 'Quản lý đã kiểm tra thông tin ban đầu và nhận điều phối.';
    v_next_action_text := 'Giao tổ phụ trách và chốt mốc cập nhật';
  elsif v_row.status = 'acknowledged' then
    v_next_status := 'in-progress';
    v_action := 'Giao xử lý';
    v_note := 'Đã giao đúng tổ phụ trách và thông báo mốc cập nhật tiếp theo.';
    v_next_action_text := 'Cập nhật hiện trường và bằng chứng sau xử lý';
  elsif v_row.status = 'in-progress' then
    v_next_status := 'verification';
    v_action := 'Yêu cầu xác minh';
    v_note := 'Hiện trường báo đã xử lý; chờ quản lý kiểm tra kết quả và bằng chứng.';
    v_next_action_text := 'Quản lý kiểm tra hiện trường và đủ bằng chứng';
  elsif v_row.status = 'verification' then
    v_next_status := 'closed';
    v_action := 'Xác minh và đóng';
    v_note := 'Kết quả đạt yêu cầu, đủ bằng chứng và không còn rủi ro tồn đọng.';
    v_next_action_text := 'Không còn việc cần xử lý';
  else
    raise exception using errcode = '22023', message = 'INCIDENT_NO_TRANSITION';
  end if;

  if v_next_status = 'in-progress' and v_row.assignee_id is null then
    case v_row.site_id::text
      when '10000000-0000-4000-8000-000000000001' then
        v_assignee_id := 'employee-trang-an-01';
        v_assignee_name := 'Đỗ Thị Lan';
      when '10000000-0000-4000-8000-000000000009' then
        v_assignee_id := 'employee-tam-chuc-01';
        v_assignee_name := 'Vũ Ngọc Mai';
      when '10000000-0000-4000-8000-000000000005' then
        v_assignee_id := 'employee-tam-coc-01';
        v_assignee_name := 'Nguyễn Văn Sơn';
      when '10000000-0000-4000-8000-000000000003' then
        v_assignee_id := 'employee-bai-dinh-01';
        v_assignee_name := 'Lương Thanh Tùng';
      else
        v_assignee_id := null;
        v_assignee_name := v_row.assignee_name;
    end case;
  else
    v_assignee_id := v_row.assignee_id;
    v_assignee_name := v_row.assignee_name;
  end if;

  v_entry := jsonb_build_object(
    'id', gen_random_uuid()::text,
    'at', to_char(now() at time zone 'Asia/Ho_Chi_Minh', 'HH24:MI'),
    'actor', v_actor_name,
    'action', v_action,
    'note', v_note
  );

  update public.erp_incidents set
    status = v_next_status,
    assignee_id = v_assignee_id,
    assignee_name = v_assignee_name,
    next_action = v_next_action_text,
    timeline = jsonb_build_array(v_entry) || v_row.timeline,
    version = v_row.version + 1,
    updated_at = now()
  where id = p_incident_id
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.erp_incident_employee_progress(
  p_tenant_id uuid,
  p_incident_id text,
  p_actor_account_id text,
  p_actor_name text
)
returns public.erp_incidents
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.erp_incidents;
  v_actor_id text := trim(coalesce(p_actor_account_id, ''));
  v_actor_name text := trim(coalesce(p_actor_name, ''));
  v_entry jsonb;
begin
  if char_length(v_actor_id) not between 2 and 100 or char_length(v_actor_name) < 1 then
    raise exception using errcode = '42501', message = 'INCIDENT_ACTOR_INVALID';
  end if;

  select * into v_row
  from public.erp_incidents
  where id = p_incident_id and tenant_id = p_tenant_id
  for update;
  if v_row.id is null then
    raise exception using errcode = 'P0002', message = 'INCIDENT_NOT_FOUND';
  end if;
  if v_row.assignee_id is null or v_row.assignee_id <> v_actor_id then
    raise exception using errcode = '42501', message = 'INCIDENT_NOT_ASSIGNED';
  end if;
  if v_row.status in ('closed', 'verification') then
    raise exception using errcode = '22023', message = 'INCIDENT_NO_TRANSITION';
  end if;

  v_entry := jsonb_build_object(
    'id', gen_random_uuid()::text,
    'at', to_char(now() at time zone 'Asia/Ho_Chi_Minh', 'HH24:MI'),
    'actor', v_actor_name,
    'action', 'Báo đã xử lý',
    'note', 'Đã hoàn thành checklist và chuyển quản lý xác minh kết quả.'
  );

  update public.erp_incidents set
    status = 'verification',
    sop_completed_steps = sop_total_steps,
    next_action = 'Chờ quản lý kiểm tra hiện trường và bằng chứng',
    timeline = jsonb_build_array(v_entry) || v_row.timeline,
    version = version + 1,
    updated_at = now()
  where id = p_incident_id
  returning * into v_row;

  return v_row;
end;
$$;

alter table public.erp_incidents enable row level security;
revoke all on table public.erp_incidents from public, anon, authenticated, service_role;
grant select on table public.erp_incidents to service_role;
create policy erp_incidents_service_read on public.erp_incidents
for select to service_role using (true);

revoke all on function public.erp_incident_manager_transition(uuid, text, text, text, text)
  from public, anon, authenticated, service_role;
revoke all on function public.erp_incident_employee_progress(uuid, text, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.erp_incident_manager_transition(uuid, text, text, text, text)
  to service_role;
grant execute on function public.erp_incident_employee_progress(uuid, text, text, text)
  to service_role;

-- Seed data: the same 3 demo incidents per site the component used to
-- generate client-side via createCases(site), now shared and persistent.
insert into public.erp_incidents (
  id, tenant_id, site_id, title, area, summary, severity, status, escalated,
  escalation_reason, reported_at, sla_minutes, elapsed_minutes, reporter,
  assignee_id, assignee_name, assignee_team, sop_code, sop_title,
  sop_completed_steps, sop_total_steps, next_action, evidence, timeline
) values
  (
    'INC-TA-071', '00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001',
    'Khách cần hỗ trợ y tế tại cổng chính', 'Cổng chính · Làn khách đoàn',
    'Một khách có dấu hiệu choáng khi chờ vào cổng. Nhân viên đã đưa khách sang vùng thoáng và gọi tổ y tế.',
    'P2', 'reported', true,
    'Cần quyết định mở làn dự phòng trong 30 phút để giữ lối tiếp cận cho tổ y tế.',
    '09:16', 5, 4, 'Đỗ Thị Lan',
    null, 'Chưa giao', 'Tổ y tế & an toàn', 'SOP-YT-02', 'Sơ cứu và bảo đảm lối tiếp cận',
    2, 6, 'Quản lý tiếp nhận và giao tổ y tế',
    '[{"id":"EV-071-01","kind":"Ảnh hiện trường","label":"Vị trí khách đang được hỗ trợ","addedBy":"Đỗ Thị Lan","addedAt":"09:17"},{"id":"EV-071-02","kind":"Checklist","label":"Đã mở lối tiếp cận tạm thời","addedBy":"Đỗ Thị Lan","addedAt":"09:18"}]'::jsonb,
    '[{"id":"TL-071-02","at":"09:18","actor":"Hệ thống","action":"Chuyển cấp P2","note":"Đã gửi quản lý cơ sở và giám đốc vì cần điều chỉnh luồng khách."},{"id":"TL-071-01","at":"09:16","actor":"Đỗ Thị Lan","action":"Báo sự cố","note":"Ghi nhận vị trí, tình trạng ban đầu và gọi tổ y tế."}]'::jsonb
  ),
  (
    'INC-TA-069', '00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001',
    'Dòng khách dồn tại điểm đón', 'Điểm đón trung tâm · Làn số 2',
    'Thời gian chờ tăng lên 14 phút sau khi một làn tạm dừng. Nhân viên đang mở hàng chờ phụ và hướng dẫn khách.',
    'P3', 'in-progress', false, null,
    '09:02', 10, 7, 'Camera AI · CAM 02',
    'employee-trang-an-01', 'Đỗ Thị Lan', 'Đón khách & cổng vé', 'SOP-LUONG-03', 'Phân luồng khi thời gian chờ vượt 10 phút',
    4, 5, 'Hoàn tất ảnh sau xử lý và chuyển quản lý xác minh',
    '[{"id":"EV-069-01","kind":"Ảnh hiện trường","label":"Hàng chờ trước khi mở làn phụ","addedBy":"Camera AI · CAM 02","addedAt":"09:02"},{"id":"EV-069-02","kind":"Checklist","label":"Đã đặt biển hướng dẫn và mở hàng chờ phụ","addedBy":"Đỗ Thị Lan","addedAt":"09:06"}]'::jsonb,
    '[{"id":"TL-069-03","at":"09:06","actor":"Đỗ Thị Lan","action":"Cập nhật xử lý","note":"Đã mở hàng chờ phụ; thời gian chờ giảm còn 9 phút."},{"id":"TL-069-02","at":"09:04","actor":"Quản lý Tràng An","action":"Giao xử lý","note":"Giao Đỗ Thị Lan phụ trách tại hiện trường."},{"id":"TL-069-01","at":"09:02","actor":"Camera AI · CAM 02","action":"Tạo cảnh báo","note":"Mật độ hàng chờ vượt ngưỡng vận hành."}]'::jsonb
  ),
  (
    'INC-TA-064', '00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001',
    'Đồ thất lạc đã bàn giao cho khách', 'Quầy hỗ trợ khách',
    'Ví của khách được tìm thấy tại khu chờ, đối chiếu đúng thông tin và đã bàn giao có ký nhận.',
    'P4', 'closed', false, null,
    '08:21', 15, 6, 'Quầy hỗ trợ 01',
    'employee-trang-an-01', 'Đỗ Thị Lan', 'Chăm sóc khách hàng', 'SOP-TS-01', 'Tiếp nhận và bàn giao tài sản thất lạc',
    5, 5, 'Không còn việc cần xử lý',
    '[{"id":"EV-064-01","kind":"Biên bản","label":"Biên bản bàn giao có xác nhận của khách","addedBy":"Đỗ Thị Lan","addedAt":"08:27"}]'::jsonb,
    '[{"id":"TL-064-02","at":"08:27","actor":"Quản lý Tràng An","action":"Xác minh và đóng","note":"Đủ thông tin người nhận và biên bản bàn giao."},{"id":"TL-064-01","at":"08:21","actor":"Quầy hỗ trợ 01","action":"Báo tài sản thất lạc","note":"Niêm phong và chuyển quầy hỗ trợ đối chiếu."}]'::jsonb
  ),
  (
    'INC-TC-071', '00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000009',
    'Khách cần hỗ trợ y tế tại cổng chính', 'Cổng chính · Làn khách đoàn',
    'Một khách có dấu hiệu choáng khi chờ vào cổng. Nhân viên đã đưa khách sang vùng thoáng và gọi tổ y tế.',
    'P2', 'reported', true,
    'Cần quyết định mở làn dự phòng trong 30 phút để giữ lối tiếp cận cho tổ y tế.',
    '09:16', 5, 4, 'Vũ Ngọc Mai',
    null, 'Chưa giao', 'Tổ y tế & an toàn', 'SOP-YT-02', 'Sơ cứu và bảo đảm lối tiếp cận',
    2, 6, 'Quản lý tiếp nhận và giao tổ y tế',
    '[{"id":"EV-071-01","kind":"Ảnh hiện trường","label":"Vị trí khách đang được hỗ trợ","addedBy":"Vũ Ngọc Mai","addedAt":"09:17"},{"id":"EV-071-02","kind":"Checklist","label":"Đã mở lối tiếp cận tạm thời","addedBy":"Vũ Ngọc Mai","addedAt":"09:18"}]'::jsonb,
    '[{"id":"TL-071-02","at":"09:18","actor":"Hệ thống","action":"Chuyển cấp P2","note":"Đã gửi quản lý cơ sở và giám đốc vì cần điều chỉnh luồng khách."},{"id":"TL-071-01","at":"09:16","actor":"Vũ Ngọc Mai","action":"Báo sự cố","note":"Ghi nhận vị trí, tình trạng ban đầu và gọi tổ y tế."}]'::jsonb
  ),
  (
    'INC-TC-069', '00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000009',
    'Dòng khách dồn tại điểm đón', 'Điểm đón trung tâm · Làn số 2',
    'Thời gian chờ tăng lên 14 phút sau khi một làn tạm dừng. Nhân viên đang mở hàng chờ phụ và hướng dẫn khách.',
    'P3', 'in-progress', false, null,
    '09:02', 10, 7, 'Camera AI · CAM 02',
    'employee-tam-chuc-01', 'Vũ Ngọc Mai', 'Điều phối xe trung chuyển', 'SOP-LUONG-03', 'Phân luồng khi thời gian chờ vượt 10 phút',
    4, 5, 'Hoàn tất ảnh sau xử lý và chuyển quản lý xác minh',
    '[{"id":"EV-069-01","kind":"Ảnh hiện trường","label":"Hàng chờ trước khi mở làn phụ","addedBy":"Camera AI · CAM 02","addedAt":"09:02"},{"id":"EV-069-02","kind":"Checklist","label":"Đã đặt biển hướng dẫn và mở hàng chờ phụ","addedBy":"Vũ Ngọc Mai","addedAt":"09:06"}]'::jsonb,
    '[{"id":"TL-069-03","at":"09:06","actor":"Vũ Ngọc Mai","action":"Cập nhật xử lý","note":"Đã mở hàng chờ phụ; thời gian chờ giảm còn 9 phút."},{"id":"TL-069-02","at":"09:04","actor":"Quản lý Tam Chúc","action":"Giao xử lý","note":"Giao Vũ Ngọc Mai phụ trách tại hiện trường."},{"id":"TL-069-01","at":"09:02","actor":"Camera AI · CAM 02","action":"Tạo cảnh báo","note":"Mật độ hàng chờ vượt ngưỡng vận hành."}]'::jsonb
  ),
  (
    'INC-TC-064', '00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000009',
    'Đồ thất lạc đã bàn giao cho khách', 'Quầy hỗ trợ khách',
    'Ví của khách được tìm thấy tại khu chờ, đối chiếu đúng thông tin và đã bàn giao có ký nhận.',
    'P4', 'closed', false, null,
    '08:21', 15, 6, 'Quầy hỗ trợ 01',
    'employee-tam-chuc-01', 'Vũ Ngọc Mai', 'Chăm sóc khách hàng', 'SOP-TS-01', 'Tiếp nhận và bàn giao tài sản thất lạc',
    5, 5, 'Không còn việc cần xử lý',
    '[{"id":"EV-064-01","kind":"Biên bản","label":"Biên bản bàn giao có xác nhận của khách","addedBy":"Vũ Ngọc Mai","addedAt":"08:27"}]'::jsonb,
    '[{"id":"TL-064-02","at":"08:27","actor":"Quản lý Tam Chúc","action":"Xác minh và đóng","note":"Đủ thông tin người nhận và biên bản bàn giao."},{"id":"TL-064-01","at":"08:21","actor":"Quầy hỗ trợ 01","action":"Báo tài sản thất lạc","note":"Niêm phong và chuyển quầy hỗ trợ đối chiếu."}]'::jsonb
  ),
  (
    'INC-TCO-071', '00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000005',
    'Khách cần hỗ trợ y tế tại cổng chính', 'Cổng chính · Làn khách đoàn',
    'Một khách có dấu hiệu choáng khi chờ vào cổng. Nhân viên đã đưa khách sang vùng thoáng và gọi tổ y tế.',
    'P2', 'reported', true,
    'Cần quyết định mở làn dự phòng trong 30 phút để giữ lối tiếp cận cho tổ y tế.',
    '09:16', 5, 4, 'Nguyễn Văn Sơn',
    null, 'Chưa giao', 'Tổ y tế & an toàn', 'SOP-YT-02', 'Sơ cứu và bảo đảm lối tiếp cận',
    2, 6, 'Quản lý tiếp nhận và giao tổ y tế',
    '[{"id":"EV-071-01","kind":"Ảnh hiện trường","label":"Vị trí khách đang được hỗ trợ","addedBy":"Nguyễn Văn Sơn","addedAt":"09:17"},{"id":"EV-071-02","kind":"Checklist","label":"Đã mở lối tiếp cận tạm thời","addedBy":"Nguyễn Văn Sơn","addedAt":"09:18"}]'::jsonb,
    '[{"id":"TL-071-02","at":"09:18","actor":"Hệ thống","action":"Chuyển cấp P2","note":"Đã gửi quản lý cơ sở và giám đốc vì cần điều chỉnh luồng khách."},{"id":"TL-071-01","at":"09:16","actor":"Nguyễn Văn Sơn","action":"Báo sự cố","note":"Ghi nhận vị trí, tình trạng ban đầu và gọi tổ y tế."}]'::jsonb
  ),
  (
    'INC-TCO-069', '00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000005',
    'Dòng khách dồn tại điểm đón', 'Điểm đón trung tâm · Làn số 2',
    'Thời gian chờ tăng lên 14 phút sau khi một làn tạm dừng. Nhân viên đang mở hàng chờ phụ và hướng dẫn khách.',
    'P3', 'in-progress', false, null,
    '09:02', 10, 7, 'Camera AI · CAM 02',
    'employee-tam-coc-01', 'Nguyễn Văn Sơn', 'Điều phối bến đò', 'SOP-LUONG-03', 'Phân luồng khi thời gian chờ vượt 10 phút',
    4, 5, 'Hoàn tất ảnh sau xử lý và chuyển quản lý xác minh',
    '[{"id":"EV-069-01","kind":"Ảnh hiện trường","label":"Hàng chờ trước khi mở làn phụ","addedBy":"Camera AI · CAM 02","addedAt":"09:02"},{"id":"EV-069-02","kind":"Checklist","label":"Đã đặt biển hướng dẫn và mở hàng chờ phụ","addedBy":"Nguyễn Văn Sơn","addedAt":"09:06"}]'::jsonb,
    '[{"id":"TL-069-03","at":"09:06","actor":"Nguyễn Văn Sơn","action":"Cập nhật xử lý","note":"Đã mở hàng chờ phụ; thời gian chờ giảm còn 9 phút."},{"id":"TL-069-02","at":"09:04","actor":"Quản lý Tam Cốc","action":"Giao xử lý","note":"Giao Nguyễn Văn Sơn phụ trách tại hiện trường."},{"id":"TL-069-01","at":"09:02","actor":"Camera AI · CAM 02","action":"Tạo cảnh báo","note":"Mật độ hàng chờ vượt ngưỡng vận hành."}]'::jsonb
  ),
  (
    'INC-TCO-064', '00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000005',
    'Đồ thất lạc đã bàn giao cho khách', 'Quầy hỗ trợ khách',
    'Ví của khách được tìm thấy tại khu chờ, đối chiếu đúng thông tin và đã bàn giao có ký nhận.',
    'P4', 'closed', false, null,
    '08:21', 15, 6, 'Quầy hỗ trợ 01',
    'employee-tam-coc-01', 'Nguyễn Văn Sơn', 'Chăm sóc khách hàng', 'SOP-TS-01', 'Tiếp nhận và bàn giao tài sản thất lạc',
    5, 5, 'Không còn việc cần xử lý',
    '[{"id":"EV-064-01","kind":"Biên bản","label":"Biên bản bàn giao có xác nhận của khách","addedBy":"Nguyễn Văn Sơn","addedAt":"08:27"}]'::jsonb,
    '[{"id":"TL-064-02","at":"08:27","actor":"Quản lý Tam Cốc","action":"Xác minh và đóng","note":"Đủ thông tin người nhận và biên bản bàn giao."},{"id":"TL-064-01","at":"08:21","actor":"Quầy hỗ trợ 01","action":"Báo tài sản thất lạc","note":"Niêm phong và chuyển quầy hỗ trợ đối chiếu."}]'::jsonb
  ),
  (
    'INC-BD-071', '00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000003',
    'Khách cần hỗ trợ y tế tại cổng chính', 'Cổng chính · Làn khách đoàn',
    'Một khách có dấu hiệu choáng khi chờ vào cổng. Nhân viên đã đưa khách sang vùng thoáng và gọi tổ y tế.',
    'P2', 'reported', true,
    'Cần quyết định mở làn dự phòng trong 30 phút để giữ lối tiếp cận cho tổ y tế.',
    '09:16', 5, 4, 'Lương Thanh Tùng',
    null, 'Chưa giao', 'Tổ y tế & an toàn', 'SOP-YT-02', 'Sơ cứu và bảo đảm lối tiếp cận',
    2, 6, 'Quản lý tiếp nhận và giao tổ y tế',
    '[{"id":"EV-071-01","kind":"Ảnh hiện trường","label":"Vị trí khách đang được hỗ trợ","addedBy":"Lương Thanh Tùng","addedAt":"09:17"},{"id":"EV-071-02","kind":"Checklist","label":"Đã mở lối tiếp cận tạm thời","addedBy":"Lương Thanh Tùng","addedAt":"09:18"}]'::jsonb,
    '[{"id":"TL-071-02","at":"09:18","actor":"Hệ thống","action":"Chuyển cấp P2","note":"Đã gửi quản lý cơ sở và giám đốc vì cần điều chỉnh luồng khách."},{"id":"TL-071-01","at":"09:16","actor":"Lương Thanh Tùng","action":"Báo sự cố","note":"Ghi nhận vị trí, tình trạng ban đầu và gọi tổ y tế."}]'::jsonb
  ),
  (
    'INC-BD-069', '00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000003',
    'Dòng khách dồn tại điểm đón', 'Điểm đón trung tâm · Làn số 2',
    'Thời gian chờ tăng lên 14 phút sau khi một làn tạm dừng. Nhân viên đang mở hàng chờ phụ và hướng dẫn khách.',
    'P3', 'in-progress', false, null,
    '09:02', 10, 7, 'Camera AI · CAM 02',
    'employee-bai-dinh-01', 'Lương Thanh Tùng', 'Điều phối xe điện', 'SOP-LUONG-03', 'Phân luồng khi thời gian chờ vượt 10 phút',
    4, 5, 'Hoàn tất ảnh sau xử lý và chuyển quản lý xác minh',
    '[{"id":"EV-069-01","kind":"Ảnh hiện trường","label":"Hàng chờ trước khi mở làn phụ","addedBy":"Camera AI · CAM 02","addedAt":"09:02"},{"id":"EV-069-02","kind":"Checklist","label":"Đã đặt biển hướng dẫn và mở hàng chờ phụ","addedBy":"Lương Thanh Tùng","addedAt":"09:06"}]'::jsonb,
    '[{"id":"TL-069-03","at":"09:06","actor":"Lương Thanh Tùng","action":"Cập nhật xử lý","note":"Đã mở hàng chờ phụ; thời gian chờ giảm còn 9 phút."},{"id":"TL-069-02","at":"09:04","actor":"Quản lý Bái Đính","action":"Giao xử lý","note":"Giao Lương Thanh Tùng phụ trách tại hiện trường."},{"id":"TL-069-01","at":"09:02","actor":"Camera AI · CAM 02","action":"Tạo cảnh báo","note":"Mật độ hàng chờ vượt ngưỡng vận hành."}]'::jsonb
  ),
  (
    'INC-BD-064', '00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000003',
    'Đồ thất lạc đã bàn giao cho khách', 'Quầy hỗ trợ khách',
    'Ví của khách được tìm thấy tại khu chờ, đối chiếu đúng thông tin và đã bàn giao có ký nhận.',
    'P4', 'closed', false, null,
    '08:21', 15, 6, 'Quầy hỗ trợ 01',
    'employee-bai-dinh-01', 'Lương Thanh Tùng', 'Chăm sóc khách hàng', 'SOP-TS-01', 'Tiếp nhận và bàn giao tài sản thất lạc',
    5, 5, 'Không còn việc cần xử lý',
    '[{"id":"EV-064-01","kind":"Biên bản","label":"Biên bản bàn giao có xác nhận của khách","addedBy":"Lương Thanh Tùng","addedAt":"08:27"}]'::jsonb,
    '[{"id":"TL-064-02","at":"08:27","actor":"Quản lý Bái Đính","action":"Xác minh và đóng","note":"Đủ thông tin người nhận và biên bản bàn giao."},{"id":"TL-064-01","at":"08:21","actor":"Quầy hỗ trợ 01","action":"Báo tài sản thất lạc","note":"Niêm phong và chuyển quầy hỗ trợ đối chiếu."}]'::jsonb
  )
on conflict (id) do nothing;

commit;
