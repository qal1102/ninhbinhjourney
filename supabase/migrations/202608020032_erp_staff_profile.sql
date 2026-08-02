-- T14 bước 1: hồ sơ nhân sự thật, sửa được theo đúng cấp.
--
-- Trước migration này, sổ tài khoản (`erp_account_registry`) chỉ sửa được
-- qua `erp_admin_upsert_account` -- và RPC đó chỉ system-admin gọi được, vì
-- nó cũng là nơi đổi cả `status` (khoá/mở tài khoản). Kết quả: một quản lý
-- không tự sửa được chức danh hay số điện thoại cho nhân sự cơ sở mình, dù
-- đó là việc hằng ngày -- mọi thay đổi hồ sơ đều phải qua giám đốc.
--
-- RPC mới ở đây tách hẳn khỏi status/vai trò: nó không nhận tham số nào có
-- thể khoá tài khoản hay đổi quyền, nên một quản lý gọi được nó nhưng không
-- thể tự nâng quyền qua đường vòng, dù có lỡ trộn logic ở tầng ứng dụng.
--
-- Cố ý CHƯA làm ở đây: màn hình danh sách nhân sự trong module "Nhân sự &
-- ca trực" (`staff-access-manager.tsx`) vẫn liệt kê từ `demo-data.ts`, chưa
-- từ registry -- đó là T14 bước 2, một việc tách riêng vì nó sửa một màn
-- hình đang hoạt động, không phải mở đường ghi dữ liệu mới.

begin;

-- 1. Hai trường hồ sơ còn thiếu ---------------------------------------------

alter table public.erp_account_registry
  add column if not exists phone text,
  add column if not exists started_at date;

alter table public.erp_account_registry
  drop constraint if exists erp_account_registry_phone_check;
alter table public.erp_account_registry
  add constraint erp_account_registry_phone_check
  check (phone is null or phone ~ '^[0-9+][0-9 ()+-]{6,19}$');

-- 2. Một quản lý và một tài khoản có chung ít nhất một cơ sở? ---------------

create or replace function public.erp_manager_shares_site_with_account(
  p_tenant_id uuid,
  p_manager_account_id text,
  p_target_account_id text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.erp_account_role_assignments manager_grant
    join public.erp_account_role_assignments target_grant
      on target_grant.tenant_id = manager_grant.tenant_id
     and target_grant.account_id = trim(coalesce(p_target_account_id, ''))
     and target_grant.status = 'active'
     and target_grant.effective_from <= now()
     and (
       target_grant.effective_until is null
       or target_grant.effective_until > now()
     )
     and (
       manager_grant.site_id is null
       or manager_grant.site_id = target_grant.site_id
     )
    where manager_grant.tenant_id = p_tenant_id
      and manager_grant.account_id = trim(coalesce(p_manager_account_id, ''))
      and manager_grant.role = 'regional-manager'
      and manager_grant.status = 'active'
      and manager_grant.effective_from <= now()
      and (
        manager_grant.effective_until is null
        or manager_grant.effective_until > now()
      )
  );
$$;

-- 3. Sửa hồ sơ, tách hẳn khỏi status/vai trò --------------------------------

create or replace function public.erp_manager_update_profile(
  p_tenant_id uuid,
  p_actor_account_id text,
  p_account_id text,
  p_display_name text,
  p_job_title text,
  p_phone text,
  p_employment_type text
)
returns public.erp_account_registry
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.erp_account_registry;
  v_account text := trim(coalesce(p_account_id, ''));
  v_actor text := trim(coalesce(p_actor_account_id, ''));
  v_phone text := nullif(trim(coalesce(p_phone, '')), '');
begin
  if not (
    public.erp_account_has_active_role(p_tenant_id, v_actor, 'system-admin', null)
    or public.erp_manager_shares_site_with_account(p_tenant_id, v_actor, v_account)
  ) then
    raise exception using errcode = '42501', message = 'PROFILE_MANAGER_SCOPE_REQUIRED';
  end if;

  if char_length(trim(coalesce(p_display_name, ''))) not between 2 and 120
     or char_length(trim(coalesce(p_job_title, ''))) not between 2 and 160
     or p_employment_type not in ('permanent', 'seasonal', 'management', 'finance', 'executive')
     or (v_phone is not null and char_length(v_phone) not between 7 and 20) then
    raise exception using errcode = '22023', message = 'PROFILE_INPUT_INVALID';
  end if;

  update public.erp_account_registry set
    display_name = trim(p_display_name),
    job_title = trim(p_job_title),
    phone = v_phone,
    employment_type = p_employment_type,
    updated_at = now()
  where account_id = v_account and tenant_id = p_tenant_id
  returning * into v_row;

  if v_row.account_id is null then
    raise exception using errcode = 'P0002', message = 'PROFILE_ACCOUNT_NOT_FOUND';
  end if;

  -- Reuses 'account.updated' (migration 027) rather than opening a new audit
  -- action: a manager editing a job title and a system-admin editing one are
  -- the same kind of event, just from two different levels of authority --
  -- the actor id on the row already says which.
  insert into public.erp_account_admin_audit (
    tenant_id, actor_account_id, target_account_id, action, detail
  ) values (
    p_tenant_id, v_actor, v_account,
    'account.updated',
    jsonb_build_object('display_name', v_row.display_name, 'job_title', v_row.job_title)
  );

  return v_row;
end;
$$;

-- 4. Khoá --------------------------------------------------------------

revoke all on function public.erp_manager_shares_site_with_account(uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.erp_manager_update_profile(uuid, text, text, text, text, text, text)
  from public, anon, authenticated;

grant execute on function public.erp_manager_shares_site_with_account(uuid, text, text)
  to service_role;
grant execute on function public.erp_manager_update_profile(uuid, text, text, text, text, text, text)
  to service_role;

commit;
