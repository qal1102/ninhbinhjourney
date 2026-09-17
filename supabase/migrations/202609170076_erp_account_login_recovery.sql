-- A15-ACC-01 · 17/09/2026 · audit 15/09/2026, TK-01 → TK-04
--
-- Cấp đăng nhập cho một tài khoản là hai bước ở hai hệ thống: tạo người dùng
-- bên Supabase Auth (chỉ Admin API làm được, không SQL nào tạo được đúng
-- cách), rồi nối vào registry bằng `erp_admin_link_auth_user` (migration 031).
-- Audit chỉ ra bốn chỗ kẹt, đều đúng khi đọc mã:
--
-- 1. Bước nối hỏng sau khi bước tạo đã chạy thì còn lại một người dùng Auth
--    mồ côi mang đúng email ấy. Cấp lại cùng email thì Auth báo "đã đăng ký",
--    màn hình dịch thành "email đã dùng cho tài khoản khác" — trong khi chẳng
--    có tài khoản nào khác.
-- 2. Không có lối cấp lại mật khẩu tạm: đóng tab trước khi chép là mất.
-- 3. Không có lối gỡ đăng nhập: kẹt thì phải vào thẳng Supabase xử tay.
--
-- Migration này thêm ba hàm cho quản trị hệ thống, đều tự kiểm quyền lần hai
-- bằng `erp_admin_requires_system_admin` và ghi Nhật ký:
--
-- - `erp_admin_find_login_by_email` — tra người dùng Auth theo email và cho
--   biết nó đang nối vào tài khoản nào (hoặc không nối vào đâu), kèm mã tài
--   khoản ERP ghi trong metadata lúc tạo. Máy chủ dùng để phân biệt các trường
--   hợp khi Auth báo "đã đăng ký": mồ côi do chính ERP tạo (dùng lại), đã nối
--   chính tài khoản này, đã nối tài khoản khác, hoặc người dùng Auth không do
--   ERP tạo (không đụng vào).
-- - `erp_admin_mark_login_password_reset` — gọi SAU khi Auth đã đổi mật khẩu:
--   bật lại cờ bắt đổi mật khẩu và ghi Nhật ký. Thứ tự này có chủ đích: nếu
--   Auth hỏng thì không có dòng Nhật ký nào nói đã cấp lại; nếu hàm này hỏng
--   thì mật khẩu mới chưa ai biết, bấm lại là xong.
-- - `erp_admin_unlink_auth_user` — gỡ nối, xoá email khỏi registry (để email
--   dùng lại được), bật lại cờ cho lần cấp sau, ghi Nhật ký kèm email cũ, và
--   trả về id người dùng Auth để máy chủ xoá bên Auth. Xoá bên Auth có hỏng
--   thì người đó vẫn không vào được ERP (phiên tra registry theo id ấy), và
--   lần cấp lại cùng email sẽ nhận ra mồ côi mà dùng lại.
--
-- Không ai tự cấp lại mật khẩu hay tự gỡ đăng nhập của chính mình ở đây: tự
-- gỡ là tự khoá mình ngoài hệ thống; tự đổi mật khẩu đã có trang riêng.
--
-- Không đổi bảng nào ngoài việc mở rộng danh sách hành động của Nhật ký quản
-- trị tài khoản (giữ nguyên bảy mã cũ đọc từ production ngày 17/09/2026).

begin;

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
      'account.auth.password_changed',
      'account.auth.password_reset',
      'account.auth.unlinked'
    )
  );

create or replace function public.erp_admin_find_login_by_email(
  p_tenant_id uuid,
  p_actor_account_id text,
  p_email text
)
returns table (auth_user_id uuid, linked_account_id text, created_for_account_id text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
begin
  perform public.erp_admin_requires_system_admin(p_tenant_id, p_actor_account_id);

  if char_length(v_email) < 3 then
    raise exception using errcode = '22023', message = 'ACCOUNT_ADMIN_INPUT_INVALID';
  end if;

  -- Không lọc registry theo tenant: một người dùng Auth đã nối ở bất kỳ đâu
  -- đều không phải mồ côi, không được đem nối lần nữa.
  return query
    select auth_user.id, registry.account_id, auth_user.raw_user_meta_data ->> 'erp_account_id'
    from auth.users auth_user
    left join public.erp_account_registry registry
      on registry.auth_user_id = auth_user.id
    where lower(auth_user.email) = v_email
    limit 1;
end;
$$;

create or replace function public.erp_admin_mark_login_password_reset(
  p_tenant_id uuid,
  p_actor_account_id text,
  p_account_id text
)
returns public.erp_account_registry
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.erp_account_registry;
  v_account text := trim(coalesce(p_account_id, ''));
begin
  perform public.erp_admin_requires_system_admin(p_tenant_id, p_actor_account_id);

  if v_account = trim(coalesce(p_actor_account_id, '')) then
    raise exception using errcode = '42501', message = 'ACCOUNT_ADMIN_SELF_LOGIN_CHANGE';
  end if;

  update public.erp_account_registry set
    must_change_password = true,
    updated_at = now()
  where account_id = v_account
    and tenant_id = p_tenant_id
    and auth_user_id is not null
  returning * into v_row;

  if v_row.account_id is null then
    if exists (
      select 1 from public.erp_account_registry
      where account_id = v_account and tenant_id = p_tenant_id
    ) then
      raise exception using errcode = 'P0002', message = 'ACCOUNT_ADMIN_LOGIN_NOT_LINKED';
    end if;
    raise exception using errcode = 'P0002', message = 'ACCOUNT_ADMIN_ACCOUNT_NOT_FOUND';
  end if;

  insert into public.erp_account_admin_audit (
    tenant_id, actor_account_id, target_account_id, action, detail
  ) values (
    p_tenant_id, trim(p_actor_account_id), v_account,
    'account.auth.password_reset',
    jsonb_build_object('email', v_row.email)
  );

  return v_row;
end;
$$;

create or replace function public.erp_admin_unlink_auth_user(
  p_tenant_id uuid,
  p_actor_account_id text,
  p_account_id text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_account text := trim(coalesce(p_account_id, ''));
  v_auth_user_id uuid;
  v_email text;
begin
  perform public.erp_admin_requires_system_admin(p_tenant_id, p_actor_account_id);

  if v_account = trim(coalesce(p_actor_account_id, '')) then
    raise exception using errcode = '42501', message = 'ACCOUNT_ADMIN_SELF_LOGIN_CHANGE';
  end if;

  select registry.auth_user_id, registry.email
    into v_auth_user_id, v_email
  from public.erp_account_registry registry
  where registry.account_id = v_account and registry.tenant_id = p_tenant_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'ACCOUNT_ADMIN_ACCOUNT_NOT_FOUND';
  end if;
  if v_auth_user_id is null then
    raise exception using errcode = 'P0002', message = 'ACCOUNT_ADMIN_LOGIN_NOT_LINKED';
  end if;

  update public.erp_account_registry set
    auth_user_id = null,
    email = null,
    must_change_password = true,
    updated_at = now()
  where account_id = v_account and tenant_id = p_tenant_id;

  insert into public.erp_account_admin_audit (
    tenant_id, actor_account_id, target_account_id, action, detail
  ) values (
    p_tenant_id, trim(p_actor_account_id), v_account,
    'account.auth.unlinked',
    jsonb_build_object('email', v_email)
  );

  return v_auth_user_id;
end;
$$;

revoke all on function public.erp_admin_find_login_by_email(uuid, text, text) from public, anon, authenticated;
revoke all on function public.erp_admin_mark_login_password_reset(uuid, text, text) from public, anon, authenticated;
revoke all on function public.erp_admin_unlink_auth_user(uuid, text, text) from public, anon, authenticated;
grant execute on function public.erp_admin_find_login_by_email(uuid, text, text) to service_role;
grant execute on function public.erp_admin_mark_login_password_reset(uuid, text, text) to service_role;
grant execute on function public.erp_admin_unlink_auth_user(uuid, text, text) to service_role;

commit;
