-- ERP-DE-XUAT-01 · 14/09/2026
--
-- Đề xuất & phê duyệt: nhân viên tạo yêu cầu, quản lý duyệt, khoản lớn lên
-- giám đốc, khoản tiền do kế toán chi.
--
-- ## Lời chủ dự án
--
-- "ngoài ra đã đầy đủ mấy cái như tạo yêu cầu chưa?" — rà ngày 14/09/2026 thì
-- ERP mới có yêu cầu đổi phạm vi dự án, báo sự cố, báo cáo hiện trường và hồ
-- sơ hoá đơn nhà cung cấp. Chưa có: xin nghỉ, đổi ca, tạm ứng, đề xuất mua,
-- yêu cầu sửa chữa, và nhân viên xin huỷ phiếu quầy bán nhầm.
--
-- ## Luồng, theo đúng chuẩn lập – duyệt của dự án
--
--   nhân viên gửi (submitted)
--     → quản lý cơ sở duyệt  → approved
--        · khoản tiền vượt ngưỡng thì → pending-director → giám đốc duyệt → approved
--     → quản lý từ chối (bắt buộc ghi lý do) → rejected
--     → người gửi tự rút khi chưa ai xét → cancelled
--   approved
--     · tạm ứng, đề xuất mua: kế toán ghi đã chi / đã mua → completed
--     · sửa chữa: quản lý ghi đã sửa xong → completed
--     · xin huỷ phiếu quầy: duyệt là huỷ luôn phiếu, trong CÙNG giao dịch, bằng
--       chính `erp_void_counter_sale` — không có đường huỷ thứ hai
--     · nghỉ phép, đổi ca: duyệt là xong
--
-- Không ai tự duyệt, tự chi đề xuất của chính mình. Giám đốc không tạo đề xuất
-- (không còn ai trên để duyệt). Ngưỡng lên giám đốc nằm ở đúng một hàm
-- `erp_staff_request_director_threshold_vnd`, đổi chính sách thì đổi một chỗ.
--
-- ## Sổ sách
--
-- Đề xuất không xoá; nội dung, người gửi, số tiền không sửa sau khi gửi (khoá
-- bằng trigger). Mọi bước ghi thêm một dòng vào `erp_staff_request_events`,
-- bảng chỉ ghi thêm, hiện trong Nhật ký hệ thống.
--
-- Chỉ tạo mới và thêm một nhánh vào `erp_audit_timeline`; không đụng dữ liệu cũ.

begin;

-- 1. Bảng ---------------------------------------------------------------------------------------

create table if not exists public.erp_staff_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete restrict,
  request_code text not null check (request_code ~ '^DX-[0-9A-F]{10}$'),
  request_type text not null check (
    request_type in ('nghi-phep', 'doi-ca', 'tam-ung', 'de-xuat-mua', 'sua-chua', 'huy-phieu-quay')
  ),
  status text not null default 'submitted' check (
    status in ('submitted', 'pending-director', 'approved', 'rejected', 'cancelled', 'completed')
  ),
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  amount_vnd bigint check (amount_vnd is null or amount_vnd between 1 and 10000000000),
  requested_by_account_id text not null check (char_length(requested_by_account_id) between 2 and 100),
  requested_by_name text not null check (char_length(requested_by_name) between 1 and 200),
  acting_director_account_id text,
  last_actor_account_id text,
  last_actor_name text,
  last_note text check (last_note is null or char_length(last_note) <= 500),
  request_key text not null check (char_length(request_key) between 8 and 128),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, tenant_id),
  unique (tenant_id, request_code),
  unique (tenant_id, request_key),
  -- Khoản tiền bắt buộc có số; việc không dính tiền thì không có số.
  check (
    (request_type in ('tam-ung', 'de-xuat-mua') and amount_vnd is not null)
    or (request_type = 'sua-chua')
    or (request_type in ('nghi-phep', 'doi-ca', 'huy-phieu-quay') and amount_vnd is null)
  )
);

create index if not exists erp_staff_requests_site_status_idx
  on public.erp_staff_requests (tenant_id, site_id, status, created_at desc);
create index if not exists erp_staff_requests_requester_idx
  on public.erp_staff_requests (tenant_id, requested_by_account_id, created_at desc);

create table if not exists public.erp_staff_request_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete restrict,
  request_id uuid not null,
  event_type text not null check (
    event_type in (
      'staff-request.submitted', 'staff-request.escalated', 'staff-request.approved',
      'staff-request.rejected', 'staff-request.cancelled', 'staff-request.completed'
    )
  ),
  from_status text,
  to_status text not null,
  actor_account_id text not null check (char_length(actor_account_id) between 2 and 100),
  actor_display_name text,
  actor_job_title text,
  actor_site_scope text,
  actor_snapshot_at_write boolean not null default true,
  acting_director_account_id text,
  note text check (note is null or char_length(note) <= 600),
  occurred_at timestamptz not null default now(),
  foreign key (request_id, tenant_id)
    references public.erp_staff_requests(id, tenant_id) on delete restrict
);

create index if not exists erp_staff_request_events_request_idx
  on public.erp_staff_request_events (tenant_id, request_id, occurred_at);

drop trigger if exists erp_staff_request_events_actor_snapshot on public.erp_staff_request_events;
create trigger erp_staff_request_events_actor_snapshot
  before insert on public.erp_staff_request_events
  for each row execute function public.erp_audit_fill_actor_snapshot();

-- 2. Khoá cứng ---------------------------------------------------------------------------------

create or replace function public.erp_staff_request_append_only()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception using errcode = '55000', message = 'STAFF_REQUEST_APPEND_ONLY';
end;
$$;

drop trigger if exists erp_staff_request_events_append_only on public.erp_staff_request_events;
create trigger erp_staff_request_events_append_only
  before update or delete on public.erp_staff_request_events
  for each row execute function public.erp_staff_request_append_only();

-- Đề xuất không xoá; chỉ đổi trạng thái và dấu người thao tác cuối, không đổi nội dung.
create or replace function public.erp_staff_request_guard_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception using errcode = '55000', message = 'STAFF_REQUEST_APPEND_ONLY';
  end if;
  if (
    new.id, new.tenant_id, new.site_id, new.request_code, new.request_type, new.details,
    new.amount_vnd, new.requested_by_account_id, new.requested_by_name,
    new.acting_director_account_id, new.request_key, new.created_at
  ) is distinct from (
    old.id, old.tenant_id, old.site_id, old.request_code, old.request_type, old.details,
    old.amount_vnd, old.requested_by_account_id, old.requested_by_name,
    old.acting_director_account_id, old.request_key, old.created_at
  ) then
    raise exception using errcode = '55000', message = 'STAFF_REQUEST_APPEND_ONLY';
  end if;
  if not (
    (old.status = 'submitted' and new.status in ('pending-director', 'approved', 'rejected', 'cancelled'))
    or (old.status = 'pending-director' and new.status in ('approved', 'rejected'))
    or (old.status = 'approved' and new.status = 'completed')
  ) then
    raise exception using errcode = '55000', message = 'STAFF_REQUEST_APPEND_ONLY';
  end if;
  return new;
end;
$$;

drop trigger if exists erp_staff_requests_guard_update on public.erp_staff_requests;
create trigger erp_staff_requests_guard_update
  before update or delete on public.erp_staff_requests
  for each row execute function public.erp_staff_request_guard_update();

-- 3. Quyền và chính sách ---------------------------------------------------------------------------

-- Khoản tạm ứng, đề xuất mua, sửa chữa VƯỢT mức này thì quản lý duyệt xong còn phải lên giám đốc.
create or replace function public.erp_staff_request_director_threshold_vnd()
returns bigint
language sql
immutable
set search_path = ''
as $$
  select 5000000::bigint;
$$;

create or replace function public.erp_staff_request_actor_can_submit(
  p_tenant_id uuid,
  p_site_id uuid,
  p_actor_account_id text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    public.erp_account_has_active_role(p_tenant_id, trim(p_actor_account_id), 'employee', p_site_id)
    or public.erp_account_has_active_role(p_tenant_id, trim(p_actor_account_id), 'regional-manager', p_site_id)
    or public.erp_account_has_active_role(p_tenant_id, trim(p_actor_account_id), 'accountant-maker', null)
    or public.erp_account_has_active_role(p_tenant_id, trim(p_actor_account_id), 'accounting-checker', null);
$$;

create or replace function public.erp_staff_request_actor_can_manage(
  p_tenant_id uuid,
  p_site_id uuid,
  p_actor_account_id text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    public.erp_account_has_active_role(p_tenant_id, trim(p_actor_account_id), 'director', null)
    or public.erp_account_has_active_role(p_tenant_id, trim(p_actor_account_id), 'regional-manager', p_site_id);
$$;

create or replace function public.erp_staff_request_actor_is_accountant(
  p_tenant_id uuid,
  p_actor_account_id text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    public.erp_account_has_active_role(p_tenant_id, trim(p_actor_account_id), 'accountant-maker', null)
    or public.erp_account_has_active_role(p_tenant_id, trim(p_actor_account_id), 'accounting-checker', null);
$$;

-- 4. Đọc ---------------------------------------------------------------------------------------

create or replace function public.erp_staff_request_json(
  p_tenant_id uuid,
  p_request_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'request_code', request.request_code,
    'site_id', request.site_id,
    'request_type', request.request_type,
    'status', request.status,
    'details', request.details,
    'amount_vnd', request.amount_vnd,
    'requested_by_account_id', request.requested_by_account_id,
    'requested_by_name', request.requested_by_name,
    'last_actor_name', request.last_actor_name,
    'last_note', request.last_note,
    'created_at', request.created_at,
    'updated_at', request.updated_at,
    'needs_director', request.request_type in ('tam-ung', 'de-xuat-mua', 'sua-chua')
      and coalesce(request.amount_vnd, 0) > public.erp_staff_request_director_threshold_vnd(),
    'events', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'event_type', event.event_type,
            'from_status', event.from_status,
            'to_status', event.to_status,
            'actor_name', event.actor_display_name,
            'note', event.note,
            'occurred_at', event.occurred_at
          )
          order by event.occurred_at, event.id
        )
        from public.erp_staff_request_events event
        where event.tenant_id = request.tenant_id and event.request_id = request.id
      ),
      '[]'::jsonb
    )
  )
  from public.erp_staff_requests request
  where request.tenant_id = p_tenant_id and request.id = p_request_id;
$$;

-- Người xem thấy gì: giám đốc thấy hết; quản lý thấy cơ sở mình; kế toán thấy khoản
-- tiền của mọi cơ sở; ai cũng thấy đề xuất của chính mình.
create or replace function public.erp_staff_requests_for_viewer(
  p_tenant_id uuid,
  p_viewer_account_id text,
  p_limit integer default 100
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    jsonb_agg(public.erp_staff_request_json(p_tenant_id, visible.id) order by visible.created_at desc),
    '[]'::jsonb
  )
  from (
    select request.id, request.created_at
    from public.erp_staff_requests request
    where request.tenant_id = p_tenant_id
      and (
        request.requested_by_account_id = trim(coalesce(p_viewer_account_id, ''))
        or public.erp_staff_request_actor_can_manage(p_tenant_id, request.site_id, p_viewer_account_id)
        or (
          request.request_type in ('tam-ung', 'de-xuat-mua')
          and public.erp_staff_request_actor_is_accountant(p_tenant_id, p_viewer_account_id)
        )
      )
    order by request.created_at desc
    limit least(greatest(coalesce(p_limit, 100), 1), 300)
  ) visible;
$$;

-- 5. Ghi ---------------------------------------------------------------------------------------

create or replace function public.erp_create_staff_request(
  p_tenant_id uuid,
  p_site_id uuid,
  p_actor_account_id text,
  p_actor_name text,
  p_acting_director_account_id text,
  p_request_type text,
  p_details jsonb,
  p_amount_vnd bigint,
  p_request_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id text := trim(coalesce(p_actor_account_id, ''));
  v_actor_name text := trim(coalesce(p_actor_name, ''));
  v_director text := nullif(trim(coalesce(p_acting_director_account_id, '')), '');
  v_key text := nullif(trim(coalesce(p_request_key, '')), '');
  v_type text := trim(coalesce(p_request_type, ''));
  v_today date := (now() at time zone 'Asia/Ho_Chi_Minh')::date;
  v_details jsonb := coalesce(p_details, '{}'::jsonb);
  v_clean jsonb;
  v_existing public.erp_staff_requests;
  v_request public.erp_staff_requests;
  v_from date;
  v_to date;
  v_code text;
  v_sale public.erp_counter_sales;
begin
  if p_tenant_id is null or p_site_id is null
     or char_length(v_actor_id) not between 2 and 100
     or char_length(v_actor_name) not between 1 and 200
     or v_key is null or char_length(v_key) not between 8 and 128
     or jsonb_typeof(v_details) <> 'object'
     or v_type not in ('nghi-phep', 'doi-ca', 'tam-ung', 'de-xuat-mua', 'sua-chua', 'huy-phieu-quay') then
    raise exception using errcode = '22023', message = 'STAFF_REQUEST_INPUT_INVALID';
  end if;

  if not exists (
    select 1 from public.sites site where site.id = p_site_id and site.tenant_id = p_tenant_id
  ) then
    raise exception using errcode = '23503', message = 'GATE_SCAN_SITE_TENANT_MISMATCH';
  end if;

  if not public.erp_staff_request_actor_can_submit(p_tenant_id, p_site_id, v_actor_id) then
    raise exception using errcode = '42501', message = 'STAFF_REQUEST_SUBMIT_NOT_ALLOWED';
  end if;

  -- Gửi lại cùng khoá (mạng lỡ nhịp, bấm hai lần) thì trả đúng đề xuất cũ.
  select * into v_existing from public.erp_staff_requests request
  where request.tenant_id = p_tenant_id and request.request_key = v_key;
  if v_existing.id is not null then
    if v_existing.requested_by_account_id <> v_actor_id then
      raise exception using errcode = '22023', message = 'STAFF_REQUEST_INPUT_INVALID';
    end if;
    return public.erp_staff_request_json(p_tenant_id, v_existing.id);
  end if;

  -- Kiểm từng loại, và chỉ giữ đúng những trường của loại ấy: không lưu rác màn hình gửi kèm.
  if v_type = 'nghi-phep' then
    begin
      v_from := (v_details ->> 'from_date')::date;
      v_to := (v_details ->> 'to_date')::date;
    exception when others then
      raise exception using errcode = '22023', message = 'STAFF_REQUEST_DETAILS_INVALID';
    end;
    if v_from is null or v_to is null or v_to < v_from or v_to - v_from > 60
       or v_from < v_today - 30 or v_from > v_today + 365
       or char_length(trim(coalesce(v_details ->> 'reason', ''))) not between 5 and 500
       or p_amount_vnd is not null then
      raise exception using errcode = '22023', message = 'STAFF_REQUEST_DETAILS_INVALID';
    end if;
    v_clean := jsonb_build_object('from_date', v_from, 'to_date', v_to, 'reason', trim(v_details ->> 'reason'));
  elsif v_type = 'doi-ca' then
    begin
      v_from := (v_details ->> 'shift_date')::date;
    exception when others then
      raise exception using errcode = '22023', message = 'STAFF_REQUEST_DETAILS_INVALID';
    end;
    if v_from is null or v_from < v_today or v_from > v_today + 90
       or char_length(trim(coalesce(v_details ->> 'current_shift', ''))) not between 1 and 100
       or char_length(trim(coalesce(v_details ->> 'desired_shift', ''))) not between 1 and 100
       or char_length(trim(coalesce(v_details ->> 'cover_name', ''))) > 200
       or char_length(trim(coalesce(v_details ->> 'reason', ''))) not between 5 and 500
       or p_amount_vnd is not null then
      raise exception using errcode = '22023', message = 'STAFF_REQUEST_DETAILS_INVALID';
    end if;
    v_clean := jsonb_build_object(
      'shift_date', v_from,
      'current_shift', trim(v_details ->> 'current_shift'),
      'desired_shift', trim(v_details ->> 'desired_shift'),
      'cover_name', nullif(trim(coalesce(v_details ->> 'cover_name', '')), ''),
      'reason', trim(v_details ->> 'reason')
    );
  elsif v_type = 'tam-ung' then
    if p_amount_vnd is null or p_amount_vnd not between 1 and 100000000
       or char_length(trim(coalesce(v_details ->> 'purpose', ''))) not between 5 and 500 then
      raise exception using errcode = '22023', message = 'STAFF_REQUEST_DETAILS_INVALID';
    end if;
    v_clean := jsonb_build_object('purpose', trim(v_details ->> 'purpose'));
  elsif v_type = 'de-xuat-mua' then
    if p_amount_vnd is null or p_amount_vnd not between 1 and 10000000000
       or char_length(trim(coalesce(v_details ->> 'items', ''))) not between 3 and 1000
       or char_length(trim(coalesce(v_details ->> 'supplier', ''))) > 200
       or char_length(trim(coalesce(v_details ->> 'reason', ''))) not between 5 and 500 then
      raise exception using errcode = '22023', message = 'STAFF_REQUEST_DETAILS_INVALID';
    end if;
    v_clean := jsonb_build_object(
      'items', trim(v_details ->> 'items'),
      'supplier', nullif(trim(coalesce(v_details ->> 'supplier', '')), ''),
      'reason', trim(v_details ->> 'reason')
    );
  elsif v_type = 'sua-chua' then
    if (p_amount_vnd is not null and p_amount_vnd not between 1 and 10000000000)
       or char_length(trim(coalesce(v_details ->> 'location', ''))) not between 2 and 200
       or char_length(trim(coalesce(v_details ->> 'problem', ''))) not between 5 and 1000
       or coalesce(v_details ->> 'urgency', '') not in ('thuong', 'gap') then
      raise exception using errcode = '22023', message = 'STAFF_REQUEST_DETAILS_INVALID';
    end if;
    v_clean := jsonb_build_object(
      'location', trim(v_details ->> 'location'),
      'problem', trim(v_details ->> 'problem'),
      'urgency', v_details ->> 'urgency'
    );
  else
    -- huy-phieu-quay: phiếu phải có thật ở cơ sở này, còn hiệu lực, bán trong hôm nay.
    v_code := upper(trim(coalesce(v_details ->> 'sale_code', '')));
    if v_code !~ '^PT-[0-9A-F]{12}$'
       or char_length(trim(coalesce(v_details ->> 'reason', ''))) not between 10 and 500
       or p_amount_vnd is not null then
      raise exception using errcode = '22023', message = 'STAFF_REQUEST_DETAILS_INVALID';
    end if;
    select * into v_sale from public.erp_counter_sales sale
    where sale.tenant_id = p_tenant_id and sale.site_id = p_site_id and sale.sale_code = v_code;
    if v_sale.id is null then
      raise exception using errcode = 'P0002', message = 'COUNTER_SALE_NOT_FOUND';
    end if;
    if v_sale.status <> 'completed' or v_sale.business_date <> v_today then
      raise exception using errcode = '55000', message = 'COUNTER_SALE_VOID_DAY_CLOSED';
    end if;
    if exists (
      select 1 from public.erp_staff_requests request
      where request.tenant_id = p_tenant_id and request.request_type = 'huy-phieu-quay'
        and request.status in ('submitted', 'pending-director')
        and request.details ->> 'sale_code' = v_code
    ) then
      raise exception using errcode = '55000', message = 'STAFF_REQUEST_DUPLICATE_VOID';
    end if;
    v_clean := jsonb_build_object(
      'sale_code', v_code,
      'sale_total_vnd', v_sale.total_vnd,
      'reason', trim(v_details ->> 'reason')
    );
  end if;

  insert into public.erp_staff_requests (
    tenant_id, site_id, request_code, request_type, details, amount_vnd,
    requested_by_account_id, requested_by_name, acting_director_account_id, request_key
  ) values (
    p_tenant_id, p_site_id,
    'DX-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
    v_type, v_clean, p_amount_vnd, v_actor_id, v_actor_name, v_director, v_key
  ) returning * into v_request;

  insert into public.erp_staff_request_events (
    tenant_id, site_id, request_id, event_type, from_status, to_status,
    actor_account_id, actor_display_name, acting_director_account_id, note
  ) values (
    p_tenant_id, p_site_id, v_request.id, 'staff-request.submitted', null, 'submitted',
    v_actor_id, v_actor_name, v_director,
    left(
      'Gửi đề xuất ' || v_request.request_code
        || coalesce(', số tiền ' || p_amount_vnd || ' đ', '') || '.'
        || case when v_director is not null
             then ' Thao tác bởi giám đốc ' || v_director || ' khi xem thử.'
             else '' end,
      600
    )
  );

  return public.erp_staff_request_json(p_tenant_id, v_request.id);

exception
  when unique_violation then
    select * into v_existing from public.erp_staff_requests request
    where request.tenant_id = p_tenant_id and request.request_key = v_key;
    if v_existing.id is not null and v_existing.requested_by_account_id = v_actor_id then
      return public.erp_staff_request_json(p_tenant_id, v_existing.id);
    end if;
    raise;
end;
$$;

create or replace function public.erp_decide_staff_request(
  p_tenant_id uuid,
  p_request_code text,
  p_actor_account_id text,
  p_actor_name text,
  p_acting_director_account_id text,
  p_decision text,
  p_note text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id text := trim(coalesce(p_actor_account_id, ''));
  v_actor_name text := trim(coalesce(p_actor_name, ''));
  v_director text := nullif(trim(coalesce(p_acting_director_account_id, '')), '');
  v_code text := upper(trim(coalesce(p_request_code, '')));
  v_note text := trim(coalesce(p_note, ''));
  v_request public.erp_staff_requests;
  v_to text;
  v_event text;
  v_is_director boolean;
begin
  if p_tenant_id is null
     or char_length(v_actor_id) not between 2 and 100
     or char_length(v_actor_name) not between 1 and 200
     or v_code !~ '^DX-[0-9A-F]{10}$'
     or coalesce(p_decision, '') not in ('approve', 'reject')
     or char_length(v_note) > 500 then
    raise exception using errcode = '22023', message = 'STAFF_REQUEST_INPUT_INVALID';
  end if;
  if p_decision = 'reject' and char_length(v_note) < 5 then
    raise exception using errcode = '22023', message = 'STAFF_REQUEST_REASON_REQUIRED';
  end if;

  select * into v_request from public.erp_staff_requests request
  where request.tenant_id = p_tenant_id and request.request_code = v_code
  for update;
  if v_request.id is null then
    raise exception using errcode = 'P0002', message = 'STAFF_REQUEST_NOT_FOUND';
  end if;

  if v_request.requested_by_account_id = v_actor_id then
    raise exception using errcode = '42501', message = 'STAFF_REQUEST_OWN_REQUEST';
  end if;

  v_is_director := public.erp_account_has_active_role(p_tenant_id, v_actor_id, 'director', null);

  if v_request.status = 'submitted' then
    if not public.erp_staff_request_actor_can_manage(p_tenant_id, v_request.site_id, v_actor_id) then
      raise exception using errcode = '42501', message = 'STAFF_REQUEST_DECIDE_NOT_ALLOWED';
    end if;
  elsif v_request.status = 'pending-director' then
    if not v_is_director then
      raise exception using errcode = '42501', message = 'STAFF_REQUEST_DIRECTOR_ONLY';
    end if;
  else
    raise exception using errcode = '55000', message = 'STAFF_REQUEST_NOT_PENDING';
  end if;

  if p_decision = 'reject' then
    v_to := 'rejected';
    v_event := 'staff-request.rejected';
  elsif v_request.status = 'submitted'
        and not v_is_director
        and v_request.request_type in ('tam-ung', 'de-xuat-mua', 'sua-chua')
        and coalesce(v_request.amount_vnd, 0) > public.erp_staff_request_director_threshold_vnd() then
    v_to := 'pending-director';
    v_event := 'staff-request.escalated';
  else
    v_to := 'approved';
    v_event := 'staff-request.approved';
  end if;

  -- Xin huỷ phiếu quầy: duyệt là huỷ phiếu ngay trong giao dịch này. Huỷ không được
  -- (khách đã qua cổng, người duyệt chính là người bán…) thì cả lượt duyệt cuộn lại.
  if v_to = 'approved' and v_request.request_type = 'huy-phieu-quay' then
    perform public.erp_void_counter_sale(
      p_tenant_id, v_request.site_id, v_actor_id, v_actor_name, v_director,
      v_request.details ->> 'sale_code',
      left('Theo đề xuất ' || v_request.request_code || ': ' || (v_request.details ->> 'reason'), 500)
    );
  end if;

  update public.erp_staff_requests request
  set status = v_to,
      last_actor_account_id = v_actor_id,
      last_actor_name = v_actor_name,
      last_note = nullif(v_note, ''),
      updated_at = now()
  where request.id = v_request.id and request.tenant_id = p_tenant_id;

  insert into public.erp_staff_request_events (
    tenant_id, site_id, request_id, event_type, from_status, to_status,
    actor_account_id, actor_display_name, acting_director_account_id, note
  ) values (
    p_tenant_id, v_request.site_id, v_request.id, v_event, v_request.status, v_to,
    v_actor_id, v_actor_name, v_director,
    left(
      case v_event
        when 'staff-request.rejected' then 'Từ chối đề xuất ' || v_request.request_code || '. Lý do: ' || v_note
        when 'staff-request.escalated' then 'Quản lý đồng ý, chuyển giám đốc vì vượt ngưỡng: ' || v_request.request_code || '.'
          || case when v_note <> '' then ' ' || v_note else '' end
        else 'Duyệt đề xuất ' || v_request.request_code || '.'
          || case when v_note <> '' then ' ' || v_note else '' end
      end
        || case when v_director is not null
             then ' Thao tác bởi giám đốc ' || v_director || ' khi xem thử.'
             else '' end,
      600
    )
  );

  return public.erp_staff_request_json(p_tenant_id, v_request.id);
end;
$$;

create or replace function public.erp_cancel_staff_request(
  p_tenant_id uuid,
  p_request_code text,
  p_actor_account_id text,
  p_actor_name text,
  p_acting_director_account_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id text := trim(coalesce(p_actor_account_id, ''));
  v_actor_name text := trim(coalesce(p_actor_name, ''));
  v_director text := nullif(trim(coalesce(p_acting_director_account_id, '')), '');
  v_code text := upper(trim(coalesce(p_request_code, '')));
  v_request public.erp_staff_requests;
begin
  if p_tenant_id is null
     or char_length(v_actor_id) not between 2 and 100
     or char_length(v_actor_name) not between 1 and 200
     or v_code !~ '^DX-[0-9A-F]{10}$' then
    raise exception using errcode = '22023', message = 'STAFF_REQUEST_INPUT_INVALID';
  end if;

  select * into v_request from public.erp_staff_requests request
  where request.tenant_id = p_tenant_id and request.request_code = v_code
  for update;
  if v_request.id is null then
    raise exception using errcode = 'P0002', message = 'STAFF_REQUEST_NOT_FOUND';
  end if;
  if v_request.requested_by_account_id <> v_actor_id then
    raise exception using errcode = '42501', message = 'STAFF_REQUEST_CANCEL_NOT_ALLOWED';
  end if;
  if v_request.status <> 'submitted' then
    raise exception using errcode = '55000', message = 'STAFF_REQUEST_NOT_PENDING';
  end if;

  update public.erp_staff_requests request
  set status = 'cancelled', last_actor_account_id = v_actor_id, last_actor_name = v_actor_name,
      last_note = null, updated_at = now()
  where request.id = v_request.id and request.tenant_id = p_tenant_id;

  insert into public.erp_staff_request_events (
    tenant_id, site_id, request_id, event_type, from_status, to_status,
    actor_account_id, actor_display_name, acting_director_account_id, note
  ) values (
    p_tenant_id, v_request.site_id, v_request.id, 'staff-request.cancelled', 'submitted', 'cancelled',
    v_actor_id, v_actor_name, v_director,
    'Người gửi tự rút đề xuất ' || v_request.request_code || ' khi chưa ai xét.'
  );

  return public.erp_staff_request_json(p_tenant_id, v_request.id);
end;
$$;

create or replace function public.erp_complete_staff_request(
  p_tenant_id uuid,
  p_request_code text,
  p_actor_account_id text,
  p_actor_name text,
  p_acting_director_account_id text,
  p_note text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id text := trim(coalesce(p_actor_account_id, ''));
  v_actor_name text := trim(coalesce(p_actor_name, ''));
  v_director text := nullif(trim(coalesce(p_acting_director_account_id, '')), '');
  v_code text := upper(trim(coalesce(p_request_code, '')));
  v_note text := trim(coalesce(p_note, ''));
  v_request public.erp_staff_requests;
begin
  if p_tenant_id is null
     or char_length(v_actor_id) not between 2 and 100
     or char_length(v_actor_name) not between 1 and 200
     or v_code !~ '^DX-[0-9A-F]{10}$' then
    raise exception using errcode = '22023', message = 'STAFF_REQUEST_INPUT_INVALID';
  end if;
  if char_length(v_note) not between 5 and 500 then
    raise exception using errcode = '22023', message = 'STAFF_REQUEST_COMPLETION_NOTE_REQUIRED';
  end if;

  select * into v_request from public.erp_staff_requests request
  where request.tenant_id = p_tenant_id and request.request_code = v_code
  for update;
  if v_request.id is null then
    raise exception using errcode = 'P0002', message = 'STAFF_REQUEST_NOT_FOUND';
  end if;
  if v_request.status <> 'approved' or v_request.request_type not in ('tam-ung', 'de-xuat-mua', 'sua-chua') then
    raise exception using errcode = '55000', message = 'STAFF_REQUEST_NOT_COMPLETABLE';
  end if;
  if v_request.requested_by_account_id = v_actor_id then
    raise exception using errcode = '42501', message = 'STAFF_REQUEST_OWN_REQUEST';
  end if;
  if (v_request.request_type in ('tam-ung', 'de-xuat-mua')
        and not public.erp_staff_request_actor_is_accountant(p_tenant_id, v_actor_id))
     or (v_request.request_type = 'sua-chua'
        and not public.erp_staff_request_actor_can_manage(p_tenant_id, v_request.site_id, v_actor_id)) then
    raise exception using errcode = '42501', message = 'STAFF_REQUEST_COMPLETE_NOT_ALLOWED';
  end if;

  update public.erp_staff_requests request
  set status = 'completed', last_actor_account_id = v_actor_id, last_actor_name = v_actor_name,
      last_note = v_note, updated_at = now()
  where request.id = v_request.id and request.tenant_id = p_tenant_id;

  insert into public.erp_staff_request_events (
    tenant_id, site_id, request_id, event_type, from_status, to_status,
    actor_account_id, actor_display_name, acting_director_account_id, note
  ) values (
    p_tenant_id, v_request.site_id, v_request.id, 'staff-request.completed', 'approved', 'completed',
    v_actor_id, v_actor_name, v_director,
    left(
      'Hoàn tất đề xuất ' || v_request.request_code || '. ' || v_note
        || case when v_director is not null
             then ' Thao tác bởi giám đốc ' || v_director || ' khi xem thử.'
             else '' end,
      600
    )
  );

  return public.erp_staff_request_json(p_tenant_id, v_request.id);
end;
$$;

-- 6. Nhật ký hệ thống: thêm một nhánh cho đề xuất ----------------------------------------------
--
-- Chữ ký giữ nguyên. Thân hàm chép nguyên văn bản `202609130070` và chỉ thêm nhánh.

create or replace function public.erp_audit_timeline(
  p_tenant_id uuid,
  p_viewer_account_id text,
  p_search text default null,
  p_site_id uuid default null,
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_limit integer default 200,
  -- Lọc về đúng một người, cho trang hồ sơ. Đây là bộ lọc **thu hẹp** chồng
  -- lên phạm vi đã tính; không có đường nào nó nới rộng ra được.
  p_actor_account_id text default null
)
returns table (
  source text,
  occurred_at timestamptz,
  site_id uuid,
  actor_account_id text,
  actor_display_name text,
  actor_job_title text,
  actor_site_scope text,
  actor_snapshot_at_write boolean,
  action text,
  entity_type text,
  entity_id text,
  note text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_sees_everything boolean;
  v_site_ids uuid[];
  v_search text := nullif(trim(coalesce(p_search, '')), '');
  v_limit integer := least(greatest(coalesce(p_limit, 200), 1), 500);
begin
  select scope.sees_everything, scope.site_ids
    into v_sees_everything, v_site_ids
  from public.erp_audit_viewer_scope(p_tenant_id, p_viewer_account_id) as scope;

  v_sees_everything := coalesce(v_sees_everything, false);
  v_site_ids := coalesce(v_site_ids, array[]::uuid[]);

  return query
  with unified as (
    select 'Tài khoản & phân quyền'::text as source, event.created_at as occurred_at,
           null::uuid as site_id, event.actor_account_id, event.actor_display_name,
           event.actor_job_title, event.actor_site_scope, event.actor_snapshot_at_write,
           event.action, 'account'::text as entity_type, event.target_account_id as entity_id,
           null::text as note
    from public.erp_account_admin_audit event
    where event.tenant_id = p_tenant_id
    union all
    select 'Sổ kế toán', event.occurred_at, event.site_id, event.actor_account_id,
           event.actor_display_name, event.actor_job_title, event.actor_site_scope,
           event.actor_snapshot_at_write, event.event_type, event.entity_type,
           event.entity_id::text, event.note
    from public.erp_accounting_audit_events event
    where event.tenant_id = p_tenant_id
    union all
    select 'Hóa đơn nhà cung cấp', event.occurred_at, event.site_id, event.actor_account_id,
           event.actor_display_name, event.actor_job_title, event.actor_site_scope,
           event.actor_snapshot_at_write, event.event_type, 'ap-invoice', event.invoice_id::text,
           event.note
    from public.erp_ap_audit_events event
    where event.tenant_id = p_tenant_id
    union all
    select 'Phân quyền nhân sự', event.created_at, event.site_id, event.actor_account_id,
           event.actor_display_name, event.actor_job_title, event.actor_site_scope,
           event.actor_snapshot_at_write, event.action, 'employee-access',
           event.employee_account_id, null
    from public.erp_employee_access_audit event
    where event.tenant_id = p_tenant_id
    union all
    select 'Dự án & sự kiện', event.created_at, event.site_id, event.actor_account_id,
           event.actor_display_name, event.actor_job_title, event.actor_site_scope,
           event.actor_snapshot_at_write, event.action, 'project-work-item',
           coalesce(event.work_item_id::text, event.event_id::text), event.note
    from public.erp_project_audit_events event
    where event.tenant_id = p_tenant_id
    union all
    select 'Chốt ca', event.occurred_at, event.site_id, event.actor_account_id,
           event.actor_display_name, event.actor_job_title, event.actor_site_scope,
           event.actor_snapshot_at_write, event.event_type, 'shift-close',
           event.workflow_id::text, event.note
    from public.erp_shift_close_audit_events event
    where event.tenant_id = p_tenant_id
    union all
    select 'Phiếu việc', event.occurred_at, event.site_id, event.actor_account_id,
           event.actor_display_name, event.actor_job_title, event.actor_site_scope,
           event.actor_snapshot_at_write, event.event_type, 'workday',
           event.workday_id::text, event.note
    from public.erp_workday_audit_events event
    where event.tenant_id = p_tenant_id
    union all
    select 'Xem theo vai trò', event.created_at, null::uuid, event.director_account_id,
           event.director_name, event.director_job_title, null::text,
           event.actor_snapshot_at_write, 'role-switch.' || event.action, 'account',
           event.target_account_id, event.target_name
    from public.erp_role_switch_audit event
    where event.tenant_id = p_tenant_id
    union all
    -- QA-ERP-POS-04: bán và huỷ vé tại quầy. Mã phiếu thu làm mã bản ghi,
    -- vì đó là thứ người ta đọc trên tờ giấy in cho khách.
    select 'Bán vé tại quầy', event.occurred_at, event.site_id, event.actor_account_id,
           event.actor_display_name, event.actor_job_title, event.actor_site_scope,
           event.actor_snapshot_at_write, event.event_type, 'counter-sale',
           sale.sale_code, event.note
    from public.erp_counter_sale_events event
    join public.erp_counter_sales sale
      on sale.id = event.sale_id and sale.tenant_id = event.tenant_id
    where event.tenant_id = p_tenant_id
    union all
    -- QA-ERP-POS-05: mỗi lần giám đốc đặt giá quầy. Hàng giá gieo sẵn của
    -- hệ thống không tính là thao tác của ai nên không hiện.
    select 'Bảng giá quầy', price.created_at, price.site_id, price.created_by_account_id,
           coalesce(price.created_by_name, price.created_by_account_id), null::text, null::text,
           price.created_by_name is not null, 'counter-price.set', 'counter-price',
           price.product,
           left(
             case price.product when 'adult' then 'Người lớn' else 'Trẻ dưới 1m3' end
             || ': ' || price.unit_price_vnd || ' đ, áp dụng từ '
             || to_char(price.effective_from, 'DD/MM/YYYY') || '.'
             || case when price.note <> '' then ' ' || price.note else '' end,
             600
           )
    from public.erp_counter_price_list price
    where price.tenant_id = p_tenant_id and price.created_by_account_id <> 'system'
    union all
    -- ERP-DE-XUAT-01: đề xuất & phê duyệt. Mã đề xuất làm mã bản ghi, vì đó là
    -- mã người gửi và người duyệt cùng đọc trên màn hình.
    select 'Đề xuất', event.occurred_at, event.site_id, event.actor_account_id,
           event.actor_display_name, event.actor_job_title, event.actor_site_scope,
           event.actor_snapshot_at_write, event.event_type, 'staff-request',
           request.request_code, event.note
    from public.erp_staff_request_events event
    join public.erp_staff_requests request
      on request.id = event.request_id and request.tenant_id = event.tenant_id
    where event.tenant_id = p_tenant_id
  )
  select unified.*
  from unified
  where
    -- Phạm vi. Quản lý thấy việc **tác động lên cơ sở mình** cộng việc **người
    -- của cơ sở mình** làm ở bất kỳ đâu; vế sau là lý do có mệnh đề exists.
    (
      v_sees_everything
      or unified.actor_account_id = p_viewer_account_id
      or (
        cardinality(v_site_ids) > 0
        and (
          unified.site_id = any (v_site_ids)
          or exists (
            select 1
            from public.erp_account_role_assignments assignment
            where assignment.tenant_id = p_tenant_id
              and assignment.account_id = unified.actor_account_id
              and assignment.status = 'active'
              and assignment.site_id = any (v_site_ids)
              and assignment.effective_from <= now()
              and (
                assignment.effective_until is null
                or assignment.effective_until > now()
              )
          )
        )
      )
    )
    and (p_actor_account_id is null or unified.actor_account_id = p_actor_account_id)
    and (p_site_id is null or unified.site_id = p_site_id)
    and (p_from is null or unified.occurred_at >= p_from)
    and (p_to is null or unified.occurred_at <= p_to)
    -- Tìm theo **tên trong nhật ký** (tên lúc thao tác) hoặc tên hiện tại
    -- trong sổ: đổi tên rồi vẫn tìm ra việc làm dưới tên cũ, và ngược lại.
    and (
      v_search is null
      or unified.actor_display_name ilike '%' || v_search || '%'
      or unified.actor_account_id ilike '%' || v_search || '%'
      or exists (
        select 1
        from public.erp_account_registry registry
        where registry.tenant_id = p_tenant_id
          and registry.account_id = unified.actor_account_id
          and registry.display_name ilike '%' || v_search || '%'
      )
    )
  order by unified.occurred_at desc
  limit v_limit;
end;
$$;

-- 7. Khoá cửa --------------------------------------------------------------------------------------

alter table public.erp_staff_requests enable row level security;
alter table public.erp_staff_request_events enable row level security;
revoke all on table public.erp_staff_requests from public, anon, authenticated, service_role;
revoke all on table public.erp_staff_request_events from public, anon, authenticated, service_role;

revoke all on function public.erp_staff_request_append_only() from public, anon, authenticated, service_role;
revoke all on function public.erp_staff_request_guard_update() from public, anon, authenticated, service_role;

revoke all on function public.erp_staff_request_director_threshold_vnd() from public, anon, authenticated;
grant execute on function public.erp_staff_request_director_threshold_vnd() to service_role;
revoke all on function public.erp_staff_request_actor_can_submit(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.erp_staff_request_actor_can_submit(uuid, uuid, text) to service_role;
revoke all on function public.erp_staff_request_actor_can_manage(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.erp_staff_request_actor_can_manage(uuid, uuid, text) to service_role;
revoke all on function public.erp_staff_request_actor_is_accountant(uuid, text) from public, anon, authenticated;
grant execute on function public.erp_staff_request_actor_is_accountant(uuid, text) to service_role;
revoke all on function public.erp_staff_request_json(uuid, uuid) from public, anon, authenticated;
grant execute on function public.erp_staff_request_json(uuid, uuid) to service_role;
revoke all on function public.erp_staff_requests_for_viewer(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.erp_staff_requests_for_viewer(uuid, text, integer) to service_role;
revoke all on function public.erp_create_staff_request(uuid, uuid, text, text, text, text, jsonb, bigint, text) from public, anon, authenticated;
grant execute on function public.erp_create_staff_request(uuid, uuid, text, text, text, text, jsonb, bigint, text) to service_role;
revoke all on function public.erp_decide_staff_request(uuid, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.erp_decide_staff_request(uuid, text, text, text, text, text, text) to service_role;
revoke all on function public.erp_cancel_staff_request(uuid, text, text, text, text) from public, anon, authenticated;
grant execute on function public.erp_cancel_staff_request(uuid, text, text, text, text) to service_role;
revoke all on function public.erp_complete_staff_request(uuid, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.erp_complete_staff_request(uuid, text, text, text, text, text) to service_role;

commit;
