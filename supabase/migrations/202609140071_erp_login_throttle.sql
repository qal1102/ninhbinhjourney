-- QA-P2-09 (ERP) · 14/09/2026
--
-- Chặn dò mật khẩu ở màn hình đăng nhập ERP.
--
-- Lượt kiểm 12/09/2026 thấy trang đăng nhập không giới hạn số lần nhập sai.
-- Máy chủ web chạy nhiều bản song song trên Vercel, nên bộ đếm để trong bộ
-- nhớ của một bản thì bản khác không thấy: phải đếm ở kho dữ liệu.
--
-- Bảng chỉ giữ **mã băm HMAC** của khoá đếm (tên đăng nhập, địa chỉ máy),
-- không giữ tên hay IP trần, và tự dọn hàng quá một ngày. Luật khoá (trần, cửa
-- sổ 15 phút) nằm ở `domain/erp-login-throttle.ts`; ở đây chỉ ghi và đọc.
--
-- Đây là bảng nhật ký kỹ thuật, không phải sổ nghiệp vụ, nên được xoá: hàng
-- cũ tự dọn, và đăng nhập đúng thì xoá lượt sai của chính tài khoản ấy.
--
-- Chỉ tạo mới, không đụng bảng hay hàm nào đang có.

begin;

create table if not exists public.erp_login_failures (
  id bigint generated always as identity primary key,
  key_hash text not null check (key_hash ~ '^[0-9a-f]{64}$'),
  scope text not null check (scope in ('account-ip', 'ip', 'account')),
  failed_at timestamptz not null default now()
);

create index if not exists erp_login_failures_key_time_idx
  on public.erp_login_failures (key_hash, failed_at desc);

alter table public.erp_login_failures enable row level security;
revoke all on table public.erp_login_failures from public, anon, authenticated, service_role;

-- Đọc các lần sai gần đây của một nhóm khoá, mỗi khoá tối đa p_limit mốc mới nhất.
create or replace function public.erp_login_recent_failures(
  p_key_hashes text[],
  p_since timestamptz,
  p_limit integer default 30
)
returns table (key_hash text, scope text, failed_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select ranked.key_hash, ranked.scope, ranked.failed_at
  from (
    select
      failure.key_hash,
      failure.scope,
      failure.failed_at,
      row_number() over (partition by failure.key_hash order by failure.failed_at desc) as thu_tu
    from public.erp_login_failures failure
    where failure.key_hash = any (coalesce(p_key_hashes, array[]::text[]))
      and failure.failed_at >= coalesce(p_since, now() - interval '15 minutes')
  ) ranked
  where ranked.thu_tu <= least(greatest(coalesce(p_limit, 30), 1), 100);
$$;

-- Ghi một lần sai cho từng khoá, và dọn hàng quá một ngày.
create or replace function public.erp_login_record_failure(
  p_entries jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entry jsonb;
begin
  if p_entries is null or jsonb_typeof(p_entries) <> 'array' or jsonb_array_length(p_entries) not between 1 and 5 then
    raise exception using errcode = '22023', message = 'LOGIN_THROTTLE_INPUT_INVALID';
  end if;

  for v_entry in select value from jsonb_array_elements(p_entries) loop
    if coalesce(v_entry ->> 'key_hash', '') !~ '^[0-9a-f]{64}$'
       or coalesce(v_entry ->> 'scope', '') not in ('account-ip', 'ip', 'account') then
      raise exception using errcode = '22023', message = 'LOGIN_THROTTLE_INPUT_INVALID';
    end if;
    insert into public.erp_login_failures (key_hash, scope)
    values (v_entry ->> 'key_hash', v_entry ->> 'scope');
  end loop;

  delete from public.erp_login_failures failure
  where failure.failed_at < now() - interval '1 day';
end;
$$;

-- Đăng nhập đúng: xoá lượt sai của đúng các khoá tài khoản vừa vào được.
create or replace function public.erp_login_clear_failures(
  p_key_hashes text[]
)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.erp_login_failures failure
  where failure.key_hash = any (coalesce(p_key_hashes, array[]::text[]))
    and failure.scope in ('account-ip', 'account');
$$;

revoke all on function public.erp_login_recent_failures(text[], timestamptz, integer) from public, anon, authenticated;
grant execute on function public.erp_login_recent_failures(text[], timestamptz, integer) to service_role;
revoke all on function public.erp_login_record_failure(jsonb) from public, anon, authenticated;
grant execute on function public.erp_login_record_failure(jsonb) to service_role;
revoke all on function public.erp_login_clear_failures(text[]) from public, anon, authenticated;
grant execute on function public.erp_login_clear_failures(text[]) to service_role;

commit;
