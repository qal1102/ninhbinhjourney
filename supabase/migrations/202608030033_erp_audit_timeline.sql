-- T15: nhật ký tập trung — ai đã làm gì, theo tên và khu vực.
--
-- Tám bảng nhật ký đang nằm rời nhau, mỗi bảng một hình dạng, và không bảng nào
-- trả lời được câu hỏi thật sự cần: "cho tôi xem mọi việc anh Long đã làm".
--
-- Hai vấn đề phải giải cùng lúc, vì giải một cái thôi là hỏng:
--
-- 1. **Ảnh chụp danh tính tại thời điểm thao tác.** Bốn bảng chỉ lưu
--    `actor_account_id`. Tra tên lúc hiển thị nghe có vẻ đủ, nhưng anh Long
--    chuyển từ Tam Chúc sang Bái Đính là **toàn bộ lịch sử cũ của anh ấy hiện
--    thành Bái Đính** — sai nơi, sai bối cảnh, và hỏng đúng cái việc quy trách
--    nhiệm. Ngược lại chỉ lưu tên thì hai anh Long lẫn nhau. Phải lưu **cả hai**.
--
--    Cách làm ở đây là trigger `before insert`, **không** sửa từng RPC. Có
--    khoảng ba chục RPC ghi vào tám bảng này; sửa từng cái là ba chục cơ hội
--    quên một chỗ, và một chỗ quên thì dòng nhật ký đó mất bối cảnh vĩnh viễn.
--    Trigger thì không có đường nào lách qua, kể cả RPC viết sau này.
--
-- 2. **Phạm vi nhìn chặn ở máy chủ.** Nhân viên chỉ thấy việc mình làm; quản lý
--    thấy việc người của cơ sở mình làm **cộng** việc tác động lên cơ sở mình
--    (kể cả do kế toán ở nơi khác làm); giám đốc thấy tất cả. Lọc ở giao diện
--    chỉ là giấu — người biết sửa địa chỉ web vẫn đọc được hết. Nên phạm vi
--    tính **bên trong** `erp_audit_timeline`, từ chính phiếu cấp vai trò của
--    người xem, không nhận tham số nào cho phép tự nới.
--
-- Dòng cũ có được backfill, nhưng đánh dấu `actor_snapshot_at_write = false` để
-- màn hình nói thẳng: tên đó là tên **hiện tại**, không phải tên lúc thao tác.
-- Không giả vờ dữ liệu cũ có thứ nó chưa từng có.

begin;

-- 1. Cột ảnh chụp danh tính -------------------------------------------------
--
-- `actor_site_scope` là khu vực **của người thao tác** lúc đó, khác với
-- `site_id` của dòng (khu vực bị tác động). Một kế toán toàn vùng duyệt hoá đơn
-- Tam Chúc thì `site_id = tam-chuc` còn `actor_site_scope = null` (toàn vùng).

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'erp_account_admin_audit',
    'erp_accounting_audit_events',
    'erp_ap_audit_events',
    'erp_employee_access_audit',
    'erp_project_audit_events',
    'erp_shift_close_audit_events',
    'erp_workday_audit_events'
  ]
  loop
    execute format(
      'alter table public.%I
         add column if not exists actor_display_name text,
         add column if not exists actor_job_title text,
         add column if not exists actor_site_scope text,
         add column if not exists actor_snapshot_at_write boolean not null default true',
      v_table
    );
  end loop;
end;
$$;

-- `erp_role_switch_audit` đã tự lưu tên giám đốc và tên người bị xem thử, và
-- cột định danh của nó tên khác (`director_account_id`). Không ép nó vào cùng
-- khuôn — chỉ thêm phần còn thiếu và xử lý riêng ở view.
alter table public.erp_role_switch_audit
  add column if not exists director_job_title text,
  add column if not exists actor_snapshot_at_write boolean not null default true;

-- 2. Trigger chụp danh tính lúc ghi ------------------------------------------

create or replace function public.erp_audit_fill_actor_snapshot()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_display_name text;
  v_job_title text;
  v_sites text;
begin
  select registry.display_name, registry.job_title
    into v_display_name, v_job_title
  from public.erp_account_registry registry
  where registry.tenant_id = new.tenant_id
    and registry.account_id = new.actor_account_id;

  select string_agg(grant_row.site_id::text, ',' order by grant_row.site_id::text)
    into v_sites
  from (
    select distinct assignment.site_id
    from public.erp_account_role_assignments assignment
    where assignment.tenant_id = new.tenant_id
      and assignment.account_id = new.actor_account_id
      and assignment.status = 'active'
      and assignment.site_id is not null
      and assignment.effective_from <= now()
      and (
        assignment.effective_until is null
        or assignment.effective_until > now()
      )
  ) as grant_row;

  -- Chỉ điền chỗ còn trống: hai bảng chốt ca và phiếu việc đã tự ghi
  -- `actor_display_name` trong RPC của chúng, và tên RPC ghi mới là tên đúng
  -- theo ngữ cảnh nghiệp vụ.
  new.actor_display_name :=
    coalesce(new.actor_display_name, v_display_name, new.actor_account_id);
  new.actor_job_title := coalesce(new.actor_job_title, v_job_title);
  new.actor_site_scope := coalesce(new.actor_site_scope, v_sites);
  return new;
end;
$$;

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'erp_account_admin_audit',
    'erp_accounting_audit_events',
    'erp_ap_audit_events',
    'erp_employee_access_audit',
    'erp_project_audit_events',
    'erp_shift_close_audit_events',
    'erp_workday_audit_events'
  ]
  loop
    execute format(
      'drop trigger if exists %I on public.%I',
      v_table || '_actor_snapshot', v_table
    );
    execute format(
      'create trigger %I before insert on public.%I
         for each row execute function public.erp_audit_fill_actor_snapshot()',
      v_table || '_actor_snapshot', v_table
    );
  end loop;
end;
$$;

-- 3. Backfill dòng cũ, và nói thẳng rằng đó là backfill ----------------------
--
-- `erp_ap_audit_events` và `erp_accounting_audit_events` có trigger chặn mọi
-- UPDATE (nhật ký chỉ ghi thêm, đúng như vậy). Tắt đúng một lần cho đúng câu
-- lệnh sửa, bật lại ngay trong cùng transaction — đây là bẫy #10 trong
-- docs/HANDOFF.md, migration 025 đã vấp một lần.

alter table public.erp_ap_audit_events disable trigger erp_ap_audit_immutable;
alter table public.erp_accounting_audit_events
  disable trigger erp_accounting_audit_immutable;

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'erp_account_admin_audit',
    'erp_accounting_audit_events',
    'erp_ap_audit_events',
    'erp_employee_access_audit',
    'erp_project_audit_events',
    'erp_shift_close_audit_events',
    'erp_workday_audit_events'
  ]
  loop
    execute format(
      'update public.%I as target
          set actor_display_name = coalesce(
                target.actor_display_name, registry.display_name, target.actor_account_id
              ),
              actor_job_title = coalesce(target.actor_job_title, registry.job_title),
              actor_snapshot_at_write = false
        from public.erp_account_registry registry
       where registry.tenant_id = target.tenant_id
         and registry.account_id = target.actor_account_id
         and target.actor_display_name is null',
      v_table
    );
    -- Dòng có mã tài khoản không còn trong sổ: vẫn phải đọc được, hiện bằng mã.
    execute format(
      'update public.%I
          set actor_display_name = actor_account_id,
              actor_snapshot_at_write = false
        where actor_display_name is null',
      v_table
    );
  end loop;
end;
$$;

alter table public.erp_ap_audit_events enable trigger erp_ap_audit_immutable;
alter table public.erp_accounting_audit_events
  enable trigger erp_accounting_audit_immutable;

update public.erp_role_switch_audit
   set actor_snapshot_at_write = false
 where director_job_title is null;

-- 4. Phạm vi nhìn, tính ở máy chủ -------------------------------------------

create or replace function public.erp_audit_viewer_scope(
  p_tenant_id uuid,
  p_viewer_account_id text
)
returns table (sees_everything boolean, site_ids uuid[])
language sql
stable
security definer
set search_path = ''
as $$
  select
    bool_or(assignment.role in ('director', 'system-admin')) as sees_everything,
    coalesce(
      array_agg(distinct assignment.site_id)
        filter (
          where assignment.role = 'regional-manager'
            and assignment.site_id is not null
        ),
      array[]::uuid[]
    ) as site_ids
  from public.erp_account_role_assignments assignment
  where assignment.tenant_id = p_tenant_id
    and assignment.account_id = trim(coalesce(p_viewer_account_id, ''))
    and assignment.status = 'active'
    and assignment.effective_from <= now()
    and (
      assignment.effective_until is null
      or assignment.effective_until > now()
    );
$$;

-- 5. Dòng thời gian hợp nhất -------------------------------------------------

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

-- 6. Đếm nhân sự theo khu vực ------------------------------------------------
--
-- "khu vực nào có bao nhiêu nhân viên" — cùng phạm vi nhìn với dòng thời gian.

create or replace function public.erp_headcount_by_site(
  p_tenant_id uuid,
  p_viewer_account_id text
)
returns table (site_id uuid, role text, headcount bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_sees_everything boolean;
  v_site_ids uuid[];
begin
  select scope.sees_everything, scope.site_ids
    into v_sees_everything, v_site_ids
  from public.erp_audit_viewer_scope(p_tenant_id, p_viewer_account_id) as scope;

  v_sees_everything := coalesce(v_sees_everything, false);
  v_site_ids := coalesce(v_site_ids, array[]::uuid[]);

  return query
  select assignment.site_id, assignment.role, count(distinct assignment.account_id)
  from public.erp_account_role_assignments assignment
  join public.erp_account_registry registry
    on registry.tenant_id = assignment.tenant_id
   and registry.account_id = assignment.account_id
   and registry.status = 'active'
  where assignment.tenant_id = p_tenant_id
    and assignment.status = 'active'
    and assignment.site_id is not null
    and assignment.effective_from <= now()
    and (
      assignment.effective_until is null
      or assignment.effective_until > now()
    )
    and (v_sees_everything or assignment.site_id = any (v_site_ids))
  group by assignment.site_id, assignment.role
  order by assignment.site_id, assignment.role;
end;
$$;

-- 7. Khoá --------------------------------------------------------------------

revoke all on function public.erp_audit_fill_actor_snapshot() from public, anon, authenticated;
revoke all on function public.erp_audit_viewer_scope(uuid, text) from public, anon, authenticated;
revoke all on function public.erp_audit_timeline(uuid, text, text, uuid, timestamptz, timestamptz, integer, text)
  from public, anon, authenticated;
revoke all on function public.erp_headcount_by_site(uuid, text) from public, anon, authenticated;

grant execute on function public.erp_audit_viewer_scope(uuid, text) to service_role;
grant execute on function public.erp_audit_timeline(uuid, text, text, uuid, timestamptz, timestamptz, integer, text)
  to service_role;
grant execute on function public.erp_headcount_by_site(uuid, text) to service_role;

commit;
