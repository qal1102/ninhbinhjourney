-- V3 in docs/DANH_GIA_HE_THONG_VA_GIAO_VIEC.md: a director-only demo role
-- switch that grants a REAL server-side session for the target account
-- (the signed ERP session cookie's userId itself changes) rather than an
-- in-browser role variable, so every downstream permission check already
-- in this codebase applies unmodified. This migration only adds the audit
-- trail for that switch -- who switched, to whom, when, and whether it was
-- the start or the return to director. It does not grant, store or check
-- any permission by itself.

begin;

create table if not exists public.erp_role_switch_audit (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  director_account_id text not null check (char_length(director_account_id) between 2 and 100),
  director_name text not null check (char_length(director_name) between 1 and 200),
  target_account_id text not null check (char_length(target_account_id) between 2 and 100),
  target_name text not null check (char_length(target_name) between 1 and 200),
  target_role text not null check (char_length(target_role) between 2 and 40),
  action text not null check (action in ('started', 'ended')),
  created_at timestamptz not null default now()
);

create index if not exists erp_role_switch_audit_director_idx
  on public.erp_role_switch_audit(director_account_id, created_at desc);

create or replace function public.erp_record_role_switch(
  p_tenant_id uuid,
  p_director_account_id text,
  p_director_name text,
  p_target_account_id text,
  p_target_name text,
  p_target_role text,
  p_action text
)
returns public.erp_role_switch_audit
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.erp_role_switch_audit;
  v_director_id text := trim(coalesce(p_director_account_id, ''));
  v_director_name text := trim(coalesce(p_director_name, ''));
  v_target_id text := trim(coalesce(p_target_account_id, ''));
  v_target_name text := trim(coalesce(p_target_name, ''));
  v_target_role text := lower(trim(coalesce(p_target_role, '')));
  v_action text := lower(trim(coalesce(p_action, '')));
begin
  if char_length(v_director_id) not between 2 and 100
     or char_length(v_director_name) < 1
     or char_length(v_target_id) not between 2 and 100
     or char_length(v_target_name) < 1
     or v_target_role not in ('employee', 'manager', 'accountant', 'chief-accountant')
     or v_action not in ('started', 'ended') then
    raise exception using errcode = '42501', message = 'ROLE_SWITCH_ACTOR_INVALID';
  end if;
  if not exists (select 1 from public.tenants t where t.id = p_tenant_id) then
    raise exception using errcode = '23503', message = 'ROLE_SWITCH_TENANT_MISMATCH';
  end if;

  insert into public.erp_role_switch_audit (
    tenant_id, director_account_id, director_name,
    target_account_id, target_name, target_role, action
  ) values (
    p_tenant_id, v_director_id, v_director_name,
    v_target_id, v_target_name, v_target_role, v_action
  )
  returning * into v_row;

  return v_row;
end;
$$;

alter table public.erp_role_switch_audit enable row level security;
revoke all on table public.erp_role_switch_audit from public, anon, authenticated, service_role;
grant select on table public.erp_role_switch_audit to service_role;
create policy erp_role_switch_audit_service_read on public.erp_role_switch_audit
for select to service_role using (true);

revoke all on function public.erp_record_role_switch(uuid, text, text, text, text, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.erp_record_role_switch(uuid, text, text, text, text, text, text)
  to service_role;

commit;
