-- T6b bước 1: mỗi người một mật khẩu riêng, qua Supabase Auth thật.
--
-- `erp_account_registry.auth_user_id` đã tồn tại từ migration 006 nhưng
-- chưa ai ghi vào nó và app chưa từng đọc nó để đăng nhập. Migration này chỉ
-- mở đường ghi (RPC `erp_admin_link_auth_user`) và đường tự đóng cờ đổi mật
-- khẩu lần đầu (`erp_confirm_password_changed`) -- không đổi RLS, không đổi
-- luồng đăng nhập cũ. Tài khoản chưa được liên kết vẫn đăng nhập bằng mật
-- khẩu dùng chung như trước, nên dừng ở đây hệ thống vẫn chạy được.
--
-- Cố ý CHƯA làm trong migration này: viết lại 143 policy RLS quanh
-- `auth.uid()`. Đó là T6c, việc lớn nhất và dễ bỏ dở nhất, tách riêng theo
-- đúng nguyên tắc "mỗi bước tự đứng được" đã ghi ở
-- docs/reference/KE_HOACH_HOP_NHAT_TAI_KHOAN.md.

begin;

-- 1. Nhận dạng thêm ------------------------------------------------------

alter table public.erp_account_registry
  add column if not exists email text,
  add column if not exists must_change_password boolean not null default true;

alter table public.erp_account_registry
  drop constraint if exists erp_account_registry_email_check;
alter table public.erp_account_registry
  add constraint erp_account_registry_email_check
  check (email is null or email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$');

create unique index if not exists erp_account_registry_email_idx
  on public.erp_account_registry (lower(email))
  where email is not null;

-- 2. Hành động kiểm toán mới ----------------------------------------------

alter table public.erp_account_admin_audit
  drop constraint if exists erp_account_admin_audit_action_check;
alter table public.erp_account_admin_audit
  add constraint erp_account_admin_audit_action_check
  check (
    action in (
      'account.created',
      'account.updated',
      'account.status.changed',
      'account.role.granted',
      'account.role.revoked',
      'account.auth.linked',
      'account.auth.password_changed'
    )
  );

-- 3. Liên kết một tài khoản registry với một auth.users thật --------------

-- Chỉ system-admin gọi được, sau khi đã tạo user bên Supabase Auth qua Admin
-- API (server-side, dùng service role -- không có SQL nào tạo được
-- auth.users đúng cách). RPC này chỉ ghi cầu nối và bật cờ bắt đổi mật khẩu.
create or replace function public.erp_admin_link_auth_user(
  p_tenant_id uuid,
  p_actor_account_id text,
  p_account_id text,
  p_auth_user_id uuid,
  p_email text
)
returns public.erp_account_registry
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.erp_account_registry;
  v_account text := trim(coalesce(p_account_id, ''));
  v_email text := lower(trim(coalesce(p_email, '')));
begin
  perform public.erp_admin_requires_system_admin(p_tenant_id, p_actor_account_id);

  if p_auth_user_id is null or char_length(v_email) < 3 then
    raise exception using errcode = '22023', message = 'ACCOUNT_ADMIN_INPUT_INVALID';
  end if;

  update public.erp_account_registry set
    auth_user_id = p_auth_user_id,
    email = v_email,
    must_change_password = true,
    updated_at = now()
  where account_id = v_account and tenant_id = p_tenant_id
  returning * into v_row;

  if v_row.account_id is null then
    raise exception using errcode = 'P0002', message = 'ACCOUNT_ADMIN_ACCOUNT_NOT_FOUND';
  end if;

  insert into public.erp_account_admin_audit (
    tenant_id, actor_account_id, target_account_id, action, detail
  ) values (
    p_tenant_id, trim(p_actor_account_id), v_account,
    'account.auth.linked',
    jsonb_build_object('email', v_email)
  );

  return v_row;
exception
  when unique_violation then
    raise exception using errcode = '23505', message = 'ACCOUNT_ADMIN_EMAIL_ALREADY_LINKED';
end;
$$;

-- 4. Tự đóng cờ "bắt đổi mật khẩu" sau khi đổi thành công ------------------

-- Cố ý khoá theo auth_user_id, không theo account_id truyền tự do: chỉ chính
-- phiên Supabase Auth vừa đổi mật khẩu mới tắt được cờ của chính mình, không
-- ai gọi hộ được cho người khác.
create or replace function public.erp_confirm_password_changed(
  p_tenant_id uuid,
  p_auth_user_id uuid
)
returns public.erp_account_registry
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.erp_account_registry;
begin
  if p_auth_user_id is null then
    raise exception using errcode = '22023', message = 'ACCOUNT_ADMIN_INPUT_INVALID';
  end if;

  update public.erp_account_registry set
    must_change_password = false,
    updated_at = now()
  where auth_user_id = p_auth_user_id and tenant_id = p_tenant_id
  returning * into v_row;

  if v_row.account_id is null then
    raise exception using errcode = 'P0002', message = 'ACCOUNT_ADMIN_ACCOUNT_NOT_FOUND';
  end if;

  insert into public.erp_account_admin_audit (
    tenant_id, actor_account_id, target_account_id, action, detail
  ) values (
    p_tenant_id, v_row.account_id, v_row.account_id,
    'account.auth.password_changed',
    '{}'::jsonb
  );

  return v_row;
end;
$$;

-- 5. Khoá --------------------------------------------------------------

revoke all on function public.erp_admin_link_auth_user(uuid, text, text, uuid, text)
  from public, anon, authenticated;
revoke all on function public.erp_confirm_password_changed(uuid, uuid)
  from public, anon, authenticated;

grant execute on function public.erp_admin_link_auth_user(uuid, text, text, uuid, text)
  to service_role;
grant execute on function public.erp_confirm_password_changed(uuid, uuid)
  to service_role;

commit;
