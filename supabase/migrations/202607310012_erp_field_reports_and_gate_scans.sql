-- Persist two more decorative actions to Supabase: field-report photo
-- submission and ticket gate QR scanning.
--
-- `field-report-workspace.tsx` ("Gửi báo cáo") built a report object and
-- called setReports() on local React state; the photo was only ever read
-- via FileReader into a base64 string kept in memory, never uploaded
-- anywhere, despite the success toast saying "đã chuyển quản lý". A page
-- reload or a different account lost the report and the photo completely.
--
-- `ticket-guest-workspace.tsx` ("Quét và ghi nhận QR", check-in mode) did
-- the same: a client-side length check plus a toast, no persistence at all.
--
-- This migration gives both a real, shared home. Field-report photos reuse
-- the same private-bucket-with-signed-URL pattern already proven by
-- `erp-workday-evidence` (migration 202607290004), in a separate bucket
-- (`erp-field-reports`) since these are ad-hoc reports, not tied to a
-- specific workday task/geofence check the way workday evidence is.
--
-- The reports table is named `erp_field_operation_reports`, not
-- `erp_field_reports`: a first apply attempt failed because an earlier,
-- unrelated migration already created a differently-shaped
-- `erp_field_reports` table on the remote database (reporter_user_id,
-- work_item_id, task_title, progress_percent, image_paths[], reviewed_by/
-- reviewed_at) that nothing in this app reads or writes. Reusing that
-- name/shape would either collide or silently adopt an incompatible
-- schema, so this migration uses its own table instead -- same pattern as
-- `erp_staff_attendance_events` avoiding the pre-existing
-- `erp_attendance_events` in migration 202607310009.

begin;

create sequence if not exists public.erp_field_operation_report_code_seq
  start with 852;

create table if not exists public.erp_field_operation_reports (
  id uuid primary key default gen_random_uuid(),
  report_code text not null unique check (char_length(report_code) between 3 and 40),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  area text not null check (char_length(area) between 1 and 200),
  category text not null check (char_length(category) between 1 and 100),
  task text not null check (char_length(task) between 1 and 300),
  employee_account_id text not null check (char_length(employee_account_id) between 2 and 100),
  employee_name text not null check (char_length(employee_name) between 1 and 200),
  progress integer not null check (progress in (25, 50, 75, 100)),
  status text not null check (status in ('Đang xử lý', 'Chờ quản lý xác nhận', 'Đã xác nhận', 'Hoàn thành')),
  note text not null check (char_length(note) between 1 and 2000),
  finance_code text not null check (char_length(finance_code) between 1 and 60),
  storage_path text,
  mime_type text,
  size_bytes integer check (size_bytes is null or size_bytes > 0),
  sha256 text,
  created_at timestamptz not null default now()
);

create index if not exists erp_field_operation_reports_site_created_idx
  on public.erp_field_operation_reports(site_id, created_at desc);

create table if not exists public.erp_gate_scan_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  code text not null check (char_length(code) between 6 and 60),
  scanned_by_account_id text not null check (char_length(scanned_by_account_id) between 2 and 100),
  scanned_by_name text not null check (char_length(scanned_by_name) between 1 and 200),
  scanned_at timestamptz not null default now()
);

create index if not exists erp_gate_scan_events_site_idx
  on public.erp_gate_scan_events(site_id, scanned_at desc);
create index if not exists erp_gate_scan_events_code_idx
  on public.erp_gate_scan_events(site_id, code, scanned_at desc);

create or replace function public.erp_submit_field_operation_report(
  p_tenant_id uuid,
  p_site_id uuid,
  p_area text,
  p_category text,
  p_task text,
  p_employee_account_id text,
  p_employee_name text,
  p_progress integer,
  p_note text,
  p_finance_code text,
  p_storage_path text,
  p_mime_type text,
  p_size_bytes integer,
  p_sha256 text
)
returns public.erp_field_operation_reports
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.erp_field_operation_reports;
  v_employee_id text := trim(coalesce(p_employee_account_id, ''));
  v_employee_name text := trim(coalesce(p_employee_name, ''));
  v_status text;
begin
  if char_length(v_employee_id) not between 2 and 100
     or char_length(v_employee_name) < 1
     or p_progress not in (25, 50, 75, 100) then
    raise exception using errcode = '42501', message = 'FIELD_REPORT_ACTOR_INVALID';
  end if;
  if not exists (
    select 1 from public.sites s where s.id = p_site_id and s.tenant_id = p_tenant_id
  ) then
    raise exception using errcode = '23503', message = 'FIELD_REPORT_SITE_TENANT_MISMATCH';
  end if;

  v_status := case when p_progress = 100 then 'Chờ quản lý xác nhận' else 'Đang xử lý' end;

  insert into public.erp_field_operation_reports (
    report_code, tenant_id, site_id, area, category, task,
    employee_account_id, employee_name, progress, status, note, finance_code,
    storage_path, mime_type, size_bytes, sha256
  ) values (
    'IMG-' || to_char(nextval('public.erp_field_operation_report_code_seq'), 'FM0000'),
    p_tenant_id, p_site_id, p_area, p_category, p_task,
    v_employee_id, v_employee_name, p_progress, v_status, p_note, p_finance_code,
    p_storage_path, p_mime_type, p_size_bytes, p_sha256
  )
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.erp_record_gate_scan(
  p_tenant_id uuid,
  p_site_id uuid,
  p_code text,
  p_actor_account_id text,
  p_actor_name text
)
returns public.erp_gate_scan_events
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.erp_gate_scan_events;
  v_code text := upper(trim(coalesce(p_code, '')));
  v_actor_id text := trim(coalesce(p_actor_account_id, ''));
  v_actor_name text := trim(coalesce(p_actor_name, ''));
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

  -- Re-scanning the same code within 2 minutes (accidental double-tap) is
  -- treated as a no-op: return the existing event instead of logging a
  -- duplicate entry.
  select * into v_row
  from public.erp_gate_scan_events
  where site_id = p_site_id and code = v_code and scanned_at > now() - interval '2 minutes'
  order by scanned_at desc
  limit 1;
  if v_row.id is not null then return v_row; end if;

  insert into public.erp_gate_scan_events (
    tenant_id, site_id, code, scanned_by_account_id, scanned_by_name
  ) values (
    p_tenant_id, p_site_id, v_code, v_actor_id, v_actor_name
  )
  returning * into v_row;

  return v_row;
end;
$$;

alter table public.erp_field_operation_reports enable row level security;
alter table public.erp_gate_scan_events enable row level security;

revoke all on table public.erp_field_operation_reports from public, anon, authenticated, service_role;
revoke all on table public.erp_gate_scan_events from public, anon, authenticated, service_role;
grant select on table public.erp_field_operation_reports to service_role;
grant select on table public.erp_gate_scan_events to service_role;

create policy erp_field_operation_reports_service_read on public.erp_field_operation_reports
for select to service_role using (true);
create policy erp_gate_scan_events_service_read on public.erp_gate_scan_events
for select to service_role using (true);

revoke all on function public.erp_submit_field_operation_report(uuid, uuid, text, text, text, text, text, integer, text, text, text, text, integer, text)
  from public, anon, authenticated, service_role;
revoke all on function public.erp_record_gate_scan(uuid, uuid, text, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.erp_submit_field_operation_report(uuid, uuid, text, text, text, text, text, integer, text, text, text, text, integer, text)
  to service_role;
grant execute on function public.erp_record_gate_scan(uuid, uuid, text, text, text)
  to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'erp-field-reports',
  'erp-field-reports',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Seed data: the same 3 demo reports per site the component used to
-- generate client-side via initialReports(site) (only the site's hero
-- photo differed between sites there); storage_path stays null for these
-- since they were never real uploads -- the UI falls back to the site's
-- own photo for display, same as before this migration.
insert into public.erp_field_operation_reports (
  report_code, tenant_id, site_id, area, category, task,
  employee_account_id, employee_name, progress, status, note, finance_code
) values
  ('IMG-TA-0842', '00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Cổng bán vé A', 'Đầu ca', 'Mở quầy và kiểm tra thiết bị', 'demo-seed', 'Đỗ Thị Lan', 100, 'Đã xác nhận', 'Hai máy quét hoạt động, tiền lẻ và ấn chỉ đã bàn giao đủ.', 'OPS-GATE-A'),
  ('IMG-TA-0918', '00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Bến trung tâm', 'Tiến độ', 'Bổ sung biển phân luồng', 'demo-seed', 'Nguyễn Văn Hải', 75, 'Đang xử lý', 'Đã lắp 3/4 biển; biển cuối chờ tổ kỹ thuật khoan chân đế.', 'OPS-FLOW-02'),
  ('IMG-TA-0951', '00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Quầy hỗ trợ khách', 'Kết quả', 'Xử lý hàng chờ đoàn trường học', 'demo-seed', 'Trần Minh Anh', 100, 'Hoàn thành', 'Đoàn 42 khách đã nhận đủ vòng và vào tuyến, không phát sinh hoàn vé.', 'CS-GROUP'),
  ('IMG-TC-0842', '00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000009', 'Cổng bán vé A', 'Đầu ca', 'Mở quầy và kiểm tra thiết bị', 'demo-seed', 'Đỗ Thị Lan', 100, 'Đã xác nhận', 'Hai máy quét hoạt động, tiền lẻ và ấn chỉ đã bàn giao đủ.', 'OPS-GATE-A'),
  ('IMG-TC-0918', '00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000009', 'Bến trung tâm', 'Tiến độ', 'Bổ sung biển phân luồng', 'demo-seed', 'Nguyễn Văn Hải', 75, 'Đang xử lý', 'Đã lắp 3/4 biển; biển cuối chờ tổ kỹ thuật khoan chân đế.', 'OPS-FLOW-02'),
  ('IMG-TC-0951', '00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000009', 'Quầy hỗ trợ khách', 'Kết quả', 'Xử lý hàng chờ đoàn trường học', 'demo-seed', 'Trần Minh Anh', 100, 'Hoàn thành', 'Đoàn 42 khách đã nhận đủ vòng và vào tuyến, không phát sinh hoàn vé.', 'CS-GROUP'),
  ('IMG-TCO-0842', '00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000005', 'Cổng bán vé A', 'Đầu ca', 'Mở quầy và kiểm tra thiết bị', 'demo-seed', 'Đỗ Thị Lan', 100, 'Đã xác nhận', 'Hai máy quét hoạt động, tiền lẻ và ấn chỉ đã bàn giao đủ.', 'OPS-GATE-A'),
  ('IMG-TCO-0918', '00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000005', 'Bến trung tâm', 'Tiến độ', 'Bổ sung biển phân luồng', 'demo-seed', 'Nguyễn Văn Hải', 75, 'Đang xử lý', 'Đã lắp 3/4 biển; biển cuối chờ tổ kỹ thuật khoan chân đế.', 'OPS-FLOW-02'),
  ('IMG-TCO-0951', '00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000005', 'Quầy hỗ trợ khách', 'Kết quả', 'Xử lý hàng chờ đoàn trường học', 'demo-seed', 'Trần Minh Anh', 100, 'Hoàn thành', 'Đoàn 42 khách đã nhận đủ vòng và vào tuyến, không phát sinh hoàn vé.', 'CS-GROUP'),
  ('IMG-BD-0842', '00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000003', 'Cổng bán vé A', 'Đầu ca', 'Mở quầy và kiểm tra thiết bị', 'demo-seed', 'Đỗ Thị Lan', 100, 'Đã xác nhận', 'Hai máy quét hoạt động, tiền lẻ và ấn chỉ đã bàn giao đủ.', 'OPS-GATE-A'),
  ('IMG-BD-0918', '00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000003', 'Bến trung tâm', 'Tiến độ', 'Bổ sung biển phân luồng', 'demo-seed', 'Nguyễn Văn Hải', 75, 'Đang xử lý', 'Đã lắp 3/4 biển; biển cuối chờ tổ kỹ thuật khoan chân đế.', 'OPS-FLOW-02'),
  ('IMG-BD-0951', '00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000003', 'Quầy hỗ trợ khách', 'Kết quả', 'Xử lý hàng chờ đoàn trường học', 'demo-seed', 'Trần Minh Anh', 100, 'Hoàn thành', 'Đoàn 42 khách đã nhận đủ vòng và vào tuyến, không phát sinh hoàn vé.', 'CS-GROUP')
on conflict (report_code) do nothing;

commit;
