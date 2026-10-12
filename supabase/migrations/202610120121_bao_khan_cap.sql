-- Báo khẩn cấp ít nhập liệu (12/10/2026).
--
-- Chủ dự án: "Báo cáo hiện trường / khẩn cấp ít nhập liệu: GPS tự lấy, chụp
-- ảnh, nộp; cấp trên rung + thông báo bám màn tới khi bấm 'Đã nhận'; quá 2
-- phút máy người báo mở cuộc gọi." Quyết định cùng ngày: thông báo đẩy rung +
-- tự gọi điện khi cấp trên chưa nhận sau 2 phút, không dùng SMS trả phí.
--
-- Một lần báo là MỘT hồ sơ sự cố P1 trong `erp_incidents` (cùng chỗ với mọi
-- sự cố khác, không có nguồn sự thật thứ hai) cộng một dòng `erp_khan_cap`
-- giữ phần riêng của báo động: loại, toạ độ, ảnh, ai đã nhận, đã gọi chưa.
-- "Đã nhận" là cấp trên xác nhận đã thấy; xử lý sự cố vẫn đi theo luồng sự cố.
--
-- Cấp trên của một cơ sở: giám đốc, và quản lý vùng được phân công cơ sở ấy
-- (`erp_account_role_assignments`). Số gọi lấy từ hồ sơ tài khoản
-- (`erp_account_registry.phone`, nhân viên tự ghi ở màn Hồ sơ).
--
-- Thêm bảng đăng ký thông báo đẩy (`erp_push_dang_ky`) để báo động tới được
-- máy cấp trên cả khi app đang đóng.

begin;

-- 1. Bảng --------------------------------------------------------------------------------

create table if not exists public.erp_khan_cap (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete restrict,
  ma text not null check (ma ~ '^KC-[A-Z0-9]{8}$'),
  incident_id text references public.erp_incidents(id) on delete restrict,
  loai text not null check (loai in ('nguoi-gap-nan', 'tai-nan', 'chay-no', 'an-ninh', 'thien-tai', 'khac')),
  ghi_chu text not null default '' check (char_length(ghi_chu) <= 300),
  vi_do numeric(9, 6) check (vi_do is null or vi_do between -90 and 90),
  kinh_do numeric(9, 6) check (kinh_do is null or kinh_do between -180 and 180),
  sai_so_m integer check (sai_so_m is null or sai_so_m between 0 and 100000),
  anh_path text check (anh_path is null or char_length(anh_path) between 5 and 300),
  nguoi_bao_account_id text not null check (char_length(nguoi_bao_account_id) between 2 and 100),
  nguoi_bao_ten text not null check (char_length(nguoi_bao_ten) between 1 and 200),
  bao_luc timestamptz not null default now(),
  request_key text not null check (char_length(request_key) between 8 and 128),
  nhan_boi_account_id text,
  nhan_boi_ten text,
  nhan_luc timestamptz,
  goi_luc timestamptz,
  goi_toi_ten text,
  unique (tenant_id, ma),
  unique (tenant_id, request_key),
  check ((nhan_luc is null) = (nhan_boi_account_id is null))
);

create index if not exists erp_khan_cap_mo_idx
  on public.erp_khan_cap (tenant_id, site_id, bao_luc desc)
  where nhan_luc is null;

alter table public.erp_khan_cap enable row level security;

-- Báo động chỉ đi tới: ghi thêm, nhận một lần, ghi đã gọi một lần.
create or replace function public.erp_khan_cap_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $ham$
begin
  if tg_op = 'DELETE' then
    raise exception using errcode = '55000', message = 'KHAN_CAP_APPEND_ONLY';
  end if;
  if (new.id, new.tenant_id, new.site_id, new.ma, new.incident_id, new.loai, new.ghi_chu,
      new.vi_do, new.kinh_do, new.sai_so_m, new.anh_path, new.nguoi_bao_account_id,
      new.nguoi_bao_ten, new.bao_luc, new.request_key)
     is distinct from
     (old.id, old.tenant_id, old.site_id, old.ma, old.incident_id, old.loai, old.ghi_chu,
      old.vi_do, old.kinh_do, old.sai_so_m, old.anh_path, old.nguoi_bao_account_id,
      old.nguoi_bao_ten, old.bao_luc, old.request_key)
     or (old.nhan_luc is not null and (new.nhan_luc, new.nhan_boi_account_id, new.nhan_boi_ten)
         is distinct from (old.nhan_luc, old.nhan_boi_account_id, old.nhan_boi_ten))
     or (old.goi_luc is not null and (new.goi_luc, new.goi_toi_ten) is distinct from (old.goi_luc, old.goi_toi_ten)) then
    raise exception using errcode = '55000', message = 'KHAN_CAP_APPEND_ONLY';
  end if;
  return new;
end;
$ham$;

drop trigger if exists erp_khan_cap_guard on public.erp_khan_cap;
create trigger erp_khan_cap_guard
  before update or delete on public.erp_khan_cap
  for each row execute function public.erp_khan_cap_guard();

create table if not exists public.erp_push_dang_ky (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  account_id text not null check (char_length(account_id) between 2 and 100),
  endpoint text not null check (endpoint ~ '^https://' and char_length(endpoint) <= 1000),
  p256dh text not null check (char_length(p256dh) between 20 and 200),
  auth text not null check (char_length(auth) between 8 and 100),
  tao_luc timestamptz not null default now(),
  unique (endpoint)
);
create index if not exists erp_push_dang_ky_account_idx on public.erp_push_dang_ky (tenant_id, account_id);
alter table public.erp_push_dang_ky enable row level security;

-- 2. Ai là cấp trên của một cơ sở -----------------------------------------------------------

create or replace function public.erp_khan_cap_cap_tren(p_tenant_id uuid, p_site_id uuid)
returns table (account_id text, ten text, vai text, dien_thoai text)
language sql
stable
security definer
set search_path = ''
as $ham$
  select account.account_id, account.display_name,
         case when public.erp_account_has_active_role(p_tenant_id, account.account_id, 'regional-manager', p_site_id)
              then 'manager' else 'director' end,
         account.phone
  from public.erp_account_registry account
  where account.tenant_id = p_tenant_id
    and account.status = 'active'
    and (
      exists (
        select 1 from public.erp_account_role_assignments a
        where a.tenant_id = p_tenant_id and a.account_id = account.account_id
          and a.role = 'regional-manager' and a.site_id = p_site_id and a.status = 'active'
          and a.effective_from <= now() and (a.effective_until is null or a.effective_until > now())
      )
      or public.erp_account_has_active_role(p_tenant_id, account.account_id, 'director', null)
    )
  -- Quản lý của cơ sở gọi trước giám đốc; người có số điện thoại trước.
  order by 3 desc, (account.phone is null), account.display_name;
$ham$;

create or replace function public.erp_khan_cap_xem(p_tenant_id uuid, p_row public.erp_khan_cap)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $ham$
  select jsonb_build_object(
    'ma', p_row.ma,
    'site_id', p_row.site_id,
    'site_name', (select site.name from public.sites site where site.id = p_row.site_id),
    'incident_id', p_row.incident_id,
    'loai', p_row.loai,
    'ghi_chu', p_row.ghi_chu,
    'vi_do', p_row.vi_do,
    'kinh_do', p_row.kinh_do,
    'sai_so_m', p_row.sai_so_m,
    'anh_path', p_row.anh_path,
    'nguoi_bao_account_id', p_row.nguoi_bao_account_id,
    'nguoi_bao_ten', p_row.nguoi_bao_ten,
    'bao_luc', p_row.bao_luc,
    'nhan_boi_ten', p_row.nhan_boi_ten,
    'nhan_luc', p_row.nhan_luc,
    'goi_luc', p_row.goi_luc,
    'goi_toi_ten', p_row.goi_toi_ten,
    'cap_tren', coalesce((
      select jsonb_agg(jsonb_build_object('account_id', c.account_id, 'ten', c.ten, 'vai', c.vai, 'dien_thoai', c.dien_thoai))
      from public.erp_khan_cap_cap_tren(p_tenant_id, p_row.site_id) c
    ), '[]'::jsonb)
  );
$ham$;

-- 3. Báo ----------------------------------------------------------------------------------------

create or replace function public.erp_bao_khan_cap(
  p_tenant_id uuid,
  p_site_id uuid,
  p_actor_account_id text,
  p_actor_name text,
  p_loai text,
  p_ghi_chu text,
  p_vi_do numeric,
  p_kinh_do numeric,
  p_sai_so_m integer,
  p_anh_path text,
  p_request_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $ham$
declare
  v_actor text := trim(coalesce(p_actor_account_id, ''));
  v_name text := trim(coalesce(p_actor_name, ''));
  v_key text := trim(coalesce(p_request_key, ''));
  v_note text := left(regexp_replace(trim(coalesce(p_ghi_chu, '')), '\s+', ' ', 'g'), 300);
  v_existing public.erp_khan_cap;
  v_row public.erp_khan_cap;
  v_site_code text;
  v_ten_loai text;
  v_incident public.erp_incidents;
  v_toa_do text;
begin
  if p_tenant_id is null or p_site_id is null
     or char_length(v_actor) not between 2 and 100 or char_length(v_name) not between 1 and 200
     or char_length(v_key) not between 8 and 128
     or p_loai not in ('nguoi-gap-nan', 'tai-nan', 'chay-no', 'an-ninh', 'thien-tai', 'khac')
     or (p_vi_do is null) <> (p_kinh_do is null) then
    raise exception using errcode = '22023', message = 'KHAN_CAP_INPUT_INVALID';
  end if;

  -- Ai làm việc ở cơ sở ấy (hay giám đốc) là báo được.
  if not (
    public.erp_account_has_active_role(p_tenant_id, v_actor, 'director', null)
    or exists (
      select 1 from public.erp_account_role_assignments a
      join public.erp_account_registry r on r.tenant_id = a.tenant_id and r.account_id = a.account_id and r.status = 'active'
      where a.tenant_id = p_tenant_id and a.account_id = v_actor and a.status = 'active'
        and (a.site_id = p_site_id or a.site_id is null)
        and a.effective_from <= now() and (a.effective_until is null or a.effective_until > now())
    )
  ) then
    raise exception using errcode = '42501', message = 'KHAN_CAP_ACTOR_NOT_AT_SITE';
  end if;

  select * into v_existing from public.erp_khan_cap k
  where k.tenant_id = p_tenant_id and k.request_key = v_key;
  if v_existing.id is not null then
    if v_existing.nguoi_bao_account_id <> v_actor then
      raise exception using errcode = '22023', message = 'KHAN_CAP_INPUT_INVALID';
    end if;
    return public.erp_khan_cap_xem(p_tenant_id, v_existing);
  end if;

  v_site_code := case p_site_id::text
    when '10000000-0000-4000-8000-000000000001' then 'TA'
    when '10000000-0000-4000-8000-000000000009' then 'TC'
    when '10000000-0000-4000-8000-000000000005' then 'TCO'
    when '10000000-0000-4000-8000-000000000003' then 'BD'
    else null
  end;
  if v_site_code is null then
    raise exception using errcode = '22023', message = 'KHAN_CAP_SITE_INVALID';
  end if;

  v_ten_loai := case p_loai
    when 'nguoi-gap-nan' then 'Người gặp nạn'
    when 'tai-nan' then 'Tai nạn, bị thương'
    when 'chay-no' then 'Cháy, nổ'
    when 'an-ninh' then 'Mất an ninh, ẩu đả'
    when 'thien-tai' then 'Mưa lũ, sạt lở'
    else 'Khẩn cấp khác'
  end;
  v_toa_do := case when p_vi_do is null then 'chưa lấy được vị trí'
    else 'vị trí ' || round(p_vi_do, 5) || ', ' || round(p_kinh_do, 5)
         || coalesce(' (sai số ' || p_sai_so_m || ' m)', '') end;

  insert into public.erp_incidents (
    id, tenant_id, site_id, title, area, summary, severity, status, escalated, escalation_reason,
    reported_at, reported_at_ts, sla_minutes, reporter,
    assignee_id, assignee_name, assignee_team, sop_code, sop_title,
    sop_completed_steps, sop_total_steps, next_action, evidence, timeline
  ) values (
    'INC-' || v_site_code || '-KC' || to_char(clock_timestamp(), 'YYMMDDHH24MISSMS'),
    p_tenant_id, p_site_id,
    'Báo khẩn cấp: ' || v_ten_loai,
    left(v_toa_do, 200),
    left(coalesce(nullif(v_note, ''), v_ten_loai) || '. Báo từ điện thoại, ' || v_toa_do || '.', 2000),
    'P1', 'reported', true, 'Báo khẩn cấp từ hiện trường',
    to_char(now() at time zone 'Asia/Ho_Chi_Minh', 'HH24:MI'), now(), 5,
    v_name,
    null, 'Chưa giao', 'Chưa giao',
    'SOP-KC-01', 'Ứng phó báo khẩn cấp tại hiện trường', 0, 4,
    'Cấp trên bấm Đã nhận, tới hiện trường hoặc gọi lại người báo',
    case when p_anh_path is null then '[]'::jsonb else jsonb_build_array(jsonb_build_object(
      'id', gen_random_uuid()::text, 'kind', 'Ảnh hiện trường', 'label', 'Ảnh chụp lúc báo khẩn cấp',
      'addedBy', v_name, 'addedAt', to_char(now() at time zone 'Asia/Ho_Chi_Minh', 'HH24:MI')
    )) end,
    jsonb_build_array(jsonb_build_object(
      'id', gen_random_uuid()::text,
      'at', to_char(now() at time zone 'Asia/Ho_Chi_Minh', 'HH24:MI'),
      'actor', v_name,
      'action', 'Báo khẩn cấp',
      'note', v_ten_loai || ', ' || v_toa_do || '.'
    ))
  ) returning * into v_incident;

  insert into public.erp_khan_cap (
    tenant_id, site_id, ma, incident_id, loai, ghi_chu, vi_do, kinh_do, sai_so_m, anh_path,
    nguoi_bao_account_id, nguoi_bao_ten, request_key
  ) values (
    p_tenant_id, p_site_id,
    'KC-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
    v_incident.id, p_loai, v_note, p_vi_do, p_kinh_do, p_sai_so_m, nullif(trim(coalesce(p_anh_path, '')), ''),
    v_actor, v_name, v_key
  ) returning * into v_row;

  return public.erp_khan_cap_xem(p_tenant_id, v_row);
end;
$ham$;

-- 4. Xem: báo động đang mở mà tài khoản này phải thấy -----------------------------------------

create or replace function public.erp_khan_cap_dang_mo(p_tenant_id uuid, p_actor_account_id text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $ham$
  select coalesce(jsonb_agg(public.erp_khan_cap_xem(p_tenant_id, k) order by k.bao_luc desc), '[]'::jsonb)
  from public.erp_khan_cap k
  where k.tenant_id = p_tenant_id
    and k.nhan_luc is null
    and k.bao_luc > now() - interval '12 hours'
    and k.nguoi_bao_account_id <> trim(coalesce(p_actor_account_id, ''))
    and exists (
      select 1 from public.erp_khan_cap_cap_tren(p_tenant_id, k.site_id) c
      where c.account_id = trim(coalesce(p_actor_account_id, ''))
    );
$ham$;

-- Người báo xem lại báo động của mình (đã có ai nhận chưa).
create or replace function public.erp_khan_cap_cua_toi(p_tenant_id uuid, p_actor_account_id text, p_ma text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $ham$
  select public.erp_khan_cap_xem(p_tenant_id, k)
  from public.erp_khan_cap k
  where k.tenant_id = p_tenant_id and k.ma = upper(trim(coalesce(p_ma, '')))
    and (
      k.nguoi_bao_account_id = trim(coalesce(p_actor_account_id, ''))
      or exists (select 1 from public.erp_khan_cap_cap_tren(p_tenant_id, k.site_id) c
                 where c.account_id = trim(coalesce(p_actor_account_id, '')))
    );
$ham$;

-- 5. Nhận, và ghi đã gọi ------------------------------------------------------------------------

create or replace function public.erp_nhan_khan_cap(
  p_tenant_id uuid,
  p_actor_account_id text,
  p_actor_name text,
  p_ma text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $ham$
declare
  v_actor text := trim(coalesce(p_actor_account_id, ''));
  v_row public.erp_khan_cap;
begin
  select * into v_row from public.erp_khan_cap k
  where k.tenant_id = p_tenant_id and k.ma = upper(trim(coalesce(p_ma, '')))
  for update;
  if v_row.id is null then
    raise exception using errcode = 'P0002', message = 'KHAN_CAP_NOT_FOUND';
  end if;
  if not exists (select 1 from public.erp_khan_cap_cap_tren(p_tenant_id, v_row.site_id) c where c.account_id = v_actor) then
    raise exception using errcode = '42501', message = 'KHAN_CAP_NOT_SUPERVISOR';
  end if;
  -- Người khác đã nhận trước: trả lại như cũ, không ghi đè tên.
  if v_row.nhan_luc is null then
    update public.erp_khan_cap
    set nhan_luc = now(), nhan_boi_account_id = v_actor, nhan_boi_ten = left(trim(coalesce(p_actor_name, v_actor)), 200)
    where id = v_row.id
    returning * into v_row;
  end if;
  return public.erp_khan_cap_xem(p_tenant_id, v_row);
end;
$ham$;

create or replace function public.erp_ghi_goi_khan_cap(
  p_tenant_id uuid,
  p_actor_account_id text,
  p_ma text,
  p_goi_toi_ten text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $ham$
declare
  v_row public.erp_khan_cap;
begin
  select * into v_row from public.erp_khan_cap k
  where k.tenant_id = p_tenant_id and k.ma = upper(trim(coalesce(p_ma, '')))
    and k.nguoi_bao_account_id = trim(coalesce(p_actor_account_id, ''))
  for update;
  if v_row.id is null then
    raise exception using errcode = 'P0002', message = 'KHAN_CAP_NOT_FOUND';
  end if;
  if v_row.goi_luc is null then
    update public.erp_khan_cap
    set goi_luc = now(), goi_toi_ten = left(nullif(trim(coalesce(p_goi_toi_ten, '')), ''), 200)
    where id = v_row.id
    returning * into v_row;
  end if;
  return public.erp_khan_cap_xem(p_tenant_id, v_row);
end;
$ham$;

-- 6. Khoá cửa ------------------------------------------------------------------------------------

revoke all on table public.erp_khan_cap from public, anon, authenticated;
revoke all on table public.erp_push_dang_ky from public, anon, authenticated;
grant select, insert, delete on table public.erp_push_dang_ky to service_role;
revoke all on function public.erp_khan_cap_guard() from public, anon, authenticated, service_role;
revoke all on function public.erp_khan_cap_xem(uuid, public.erp_khan_cap) from public, anon, authenticated, service_role;

revoke all on function public.erp_khan_cap_cap_tren(uuid, uuid) from public, anon, authenticated;
grant execute on function public.erp_khan_cap_cap_tren(uuid, uuid) to service_role;
revoke all on function public.erp_bao_khan_cap(uuid, uuid, text, text, text, text, numeric, numeric, integer, text, text) from public, anon, authenticated;
grant execute on function public.erp_bao_khan_cap(uuid, uuid, text, text, text, text, numeric, numeric, integer, text, text) to service_role;
revoke all on function public.erp_khan_cap_dang_mo(uuid, text) from public, anon, authenticated;
grant execute on function public.erp_khan_cap_dang_mo(uuid, text) to service_role;
revoke all on function public.erp_khan_cap_cua_toi(uuid, text, text) from public, anon, authenticated;
grant execute on function public.erp_khan_cap_cua_toi(uuid, text, text) to service_role;
revoke all on function public.erp_nhan_khan_cap(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.erp_nhan_khan_cap(uuid, text, text, text) to service_role;
revoke all on function public.erp_ghi_goi_khan_cap(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.erp_ghi_goi_khan_cap(uuid, text, text, text) to service_role;

commit;
