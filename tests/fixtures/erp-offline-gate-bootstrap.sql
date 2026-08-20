\set ON_ERROR_STOP on

create role anon noinherit;
create role authenticated noinherit;
create role service_role noinherit;
create schema extensions;
create extension pgcrypto with schema extensions;

create table public.tenants (
  id uuid primary key
);

create table public.sites (
  id uuid primary key,
  tenant_id uuid not null references public.tenants(id)
);

create table public.erp_employee_access (
  employee_account_id text primary key,
  tenant_id uuid not null references public.tenants(id),
  site_id uuid references public.sites(id),
  module_ids text[] not null default '{}'::text[]
);

create or replace function public.erp_account_has_active_role(
  p_tenant_id uuid,
  p_account_id text,
  p_role text,
  p_site_id uuid
)
returns boolean
language sql
stable
as $$
  select trim(coalesce(p_account_id, '')) = 'director'
    and p_role = 'director'
    and coalesce(current_setting('cus08.scan_allowed', true), 'on') <> 'off';
$$;

create or replace function public.customer_append_only()
returns trigger
language plpgsql
as $$
begin
  raise exception using errcode = '42501', message = 'CUSTOMER_HISTORY_IMMUTABLE';
end;
$$;

create table public.erp_tickets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  site_id uuid not null references public.sites(id),
  ticket_code text not null,
  product text not null,
  guest_name text not null default '',
  guest_phone text not null default '',
  booking_reference text not null default '',
  channel text not null,
  valid_on date not null,
  entries_allowed integer not null default 1,
  entries_used integer not null default 0,
  status text not null default 'issued',
  issued_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, ticket_code)
);

create table public.erp_gate_scan_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  site_id uuid not null references public.sites(id),
  code text not null,
  scanned_by_account_id text not null,
  scanned_by_name text not null,
  scanned_at timestamptz not null default now(),
  ticket_id uuid references public.erp_tickets(id),
  result text not null default 'accepted',
  idempotency_key text,
  unique (tenant_id, idempotency_key)
);

insert into public.tenants(id)
values ('00000000-0000-4000-8000-000000000001');

insert into public.sites(id, tenant_id)
values (
  '10000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000001'
);

insert into public.erp_tickets (
  tenant_id, site_id, ticket_code, product, guest_name, guest_phone,
  booking_reference, channel, valid_on, entries_allowed
)
values (
  '00000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  'OFFLINE-VALID-001', 'adult', 'Private Guest', '0900000000',
  'BOOKING-PRIVATE', 'website',
  (now() at time zone 'Asia/Ho_Chi_Minh')::date, 1
);
