-- T8: make the gate check a ticket instead of counting keystrokes.
--
-- `erp_gate_scan_events` has held nothing but `code text` (6–60 chars) since it
-- was written: no foreign key to anything, no uniqueness, no idempotency key.
-- Typing ABC123 recorded a visitor. Scanning the same real ticket ten times
-- recorded ten visitors, minus a two-minute double-tap window that also
-- silently swallowed a genuine second person on a group pass. Every figure
-- downstream of the gate -- daily visitors, capacity load, the revenue a shift
-- close is reconciled against -- inherits that.
--
-- This adds the missing half: tickets that exist, an entry allowance that is
-- decremented under a row lock, and a scan log that records refusals as
-- faithfully as admissions. A scan that is refused is the product working, so
-- it is evidence and it is kept.
--
-- What this deliberately does NOT do: issue tickets from the public web. The
-- visitor-facing QR flow (W1) is built on top of this, later. Today the ticket
-- source is the counter and the seeded fixtures.

begin;

create table if not exists public.erp_tickets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete restrict,
  ticket_code text not null check (char_length(trim(ticket_code)) between 6 and 40),
  product text not null check (product in ('adult', 'child', 'combo', 'group', 'guest')),
  guest_name text not null default '' check (char_length(guest_name) <= 200),
  guest_phone text not null default '' check (char_length(guest_phone) <= 30),
  guest_phone_normalized text generated always as (
    regexp_replace(guest_phone, '[^0-9]', '', 'g')
  ) stored,
  booking_reference text not null default '' check (char_length(booking_reference) <= 100),
  channel text not null check (channel in ('quay-ve', 'website', 'doi-tac', 'moi')),
  valid_on date not null,
  -- A group pass legitimately admits several people; a single ticket admits
  -- one. The gate enforces the number instead of guessing from a time window.
  entries_allowed integer not null default 1 check (entries_allowed between 1 and 200),
  entries_used integer not null default 0 check (entries_used >= 0),
  status text not null default 'issued' check (
    status in ('issued', 'partially-used', 'used', 'void')
  ),
  issued_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, ticket_code),
  check (entries_used <= entries_allowed)
);

create index if not exists erp_tickets_site_date_idx
  on public.erp_tickets(site_id, valid_on desc);
create index if not exists erp_tickets_guest_idx
  on public.erp_tickets(tenant_id, guest_phone_normalized);
create index if not exists erp_tickets_name_idx
  on public.erp_tickets(tenant_id, guest_name);

-- The scan log gains the three things it never had: what ticket it hit, what
-- the gate decided, and a key that makes a retry harmless.
alter table public.erp_gate_scan_events
  add column if not exists ticket_id uuid references public.erp_tickets(id) on delete restrict,
  add column if not exists result text,
  add column if not exists idempotency_key text;

update public.erp_gate_scan_events
set result = 'legacy-uncheckable'
where result is null;

alter table public.erp_gate_scan_events
  alter column result set not null,
  alter column result set default 'accepted';

alter table public.erp_gate_scan_events
  drop constraint if exists erp_gate_scan_events_result_check;
alter table public.erp_gate_scan_events
  add constraint erp_gate_scan_events_result_check
  check (
    result in (
      'accepted',
      'not-found',
      'wrong-site',
      'wrong-day',
      'exhausted',
      'void',
      -- Everything recorded before T8, when the gate could not check anything.
      'legacy-uncheckable'
    )
  );

-- Two scans carrying the same key are the same scan. This is what makes a
-- flaky network at the gate safe: the retry returns the first outcome instead
-- of admitting a second person.
create unique index if not exists erp_gate_scan_events_idempotency_idx
  on public.erp_gate_scan_events(tenant_id, idempotency_key)
  where idempotency_key is not null;

create or replace function public.erp_gate_scan_ticket(
  p_tenant_id uuid,
  p_site_id uuid,
  p_code text,
  p_actor_account_id text,
  p_actor_name text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text := upper(trim(coalesce(p_code, '')));
  v_actor_id text := trim(coalesce(p_actor_account_id, ''));
  v_actor_name text := trim(coalesce(p_actor_name, ''));
  v_key text := nullif(trim(coalesce(p_idempotency_key, '')), '');
  v_ticket public.erp_tickets;
  v_existing public.erp_gate_scan_events;
  v_result text;
  v_event public.erp_gate_scan_events;
  v_today date := (now() at time zone 'Asia/Ho_Chi_Minh')::date;
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

  if v_key is not null then
    select * into v_existing
    from public.erp_gate_scan_events
    where tenant_id = p_tenant_id and idempotency_key = v_key;
    if v_existing.id is not null then
      return jsonb_build_object(
        'result', v_existing.result,
        'code', v_existing.code,
        'scanned_at', v_existing.scanned_at,
        'replayed', true
      );
    end if;
  end if;

  -- Locked for the whole decision: two lanes scanning the same group pass at
  -- the same moment must not both see the last remaining entry.
  select * into v_ticket
  from public.erp_tickets
  where tenant_id = p_tenant_id and ticket_code = v_code
  for update;

  if v_ticket.id is null then
    v_result := 'not-found';
  elsif v_ticket.status = 'void' then
    v_result := 'void';
  elsif v_ticket.site_id <> p_site_id then
    v_result := 'wrong-site';
  elsif v_ticket.valid_on <> v_today then
    v_result := 'wrong-day';
  elsif v_ticket.entries_used >= v_ticket.entries_allowed then
    v_result := 'exhausted';
  else
    v_result := 'accepted';
    update public.erp_tickets set
      entries_used = entries_used + 1,
      status = case
        when entries_used + 1 >= entries_allowed then 'used'
        else 'partially-used'
      end,
      updated_at = now()
    where id = v_ticket.id
    returning * into v_ticket;
  end if;

  -- Refusals are logged too. A gate that only records successes cannot answer
  -- "how many people were turned away and why", which is the first question
  -- asked after a bad day at the entrance.
  insert into public.erp_gate_scan_events (
    tenant_id, site_id, code, scanned_by_account_id, scanned_by_name,
    ticket_id, result, idempotency_key
  ) values (
    p_tenant_id, p_site_id, v_code, v_actor_id, v_actor_name,
    case when v_ticket.id is null then null else v_ticket.id end,
    v_result, v_key
  )
  returning * into v_event;

  return jsonb_build_object(
    'result', v_result,
    'code', v_code,
    'scanned_at', v_event.scanned_at,
    'replayed', false,
    'ticket', case
      when v_ticket.id is null then null
      else jsonb_build_object(
        'ticket_code', v_ticket.ticket_code,
        'product', v_ticket.product,
        'guest_name', v_ticket.guest_name,
        'guest_phone', v_ticket.guest_phone,
        'booking_reference', v_ticket.booking_reference,
        'channel', v_ticket.channel,
        'valid_on', v_ticket.valid_on,
        'entries_allowed', v_ticket.entries_allowed,
        'entries_used', v_ticket.entries_used,
        'status', v_ticket.status
      )
    end
  );
end;
$$;

-- Seed: a handful of tickets per site for today, so the gate has something
-- real to accept and refuse during a demo. `valid_on` is today at apply time;
-- erp_demo_rebase_timeline() does not move these, because a ticket that is not
-- valid today is exactly the refusal a demo should be able to show.
insert into public.erp_tickets (
  tenant_id, site_id, ticket_code, product, guest_name, guest_phone,
  booking_reference, channel, valid_on, entries_allowed, entries_used, status
) values
  ('00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001',
   'TA-2026-000101', 'adult', 'Nguyễn Thị Bích', '0912345678', 'NB-82419', 'website',
   current_date, 1, 0, 'issued'),
  ('00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001',
   'TA-2026-000102', 'group', 'Đoàn THPT Kim Sơn', '0987654321', 'NB-82424', 'doi-tac',
   current_date, 42, 0, 'issued'),
  ('00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001',
   'TA-2026-000103', 'adult', 'Trần Văn Hoà', '0903111222', '', 'quay-ve',
   current_date - 1, 1, 1, 'used'),
  ('00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000009',
   'TC-2026-000201', 'combo', 'Lê Thị Hạnh', '0918222333', 'NB-82431', 'website',
   current_date, 1, 0, 'issued'),
  ('00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000009',
   'TC-2026-000202', 'child', 'Phạm Gia Bảo', '0918222333', 'NB-82431', 'website',
   current_date, 1, 0, 'issued'),
  ('00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000005',
   'TCO-2026-000301', 'adult', 'Vũ Minh Khoa', '0977888999', '', 'quay-ve',
   current_date, 1, 0, 'issued'),
  ('00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000003',
   'BD-2026-000401', 'adult', 'Đinh Thị Ngọc', '0966555444', '', 'quay-ve',
   current_date, 1, 0, 'issued'),
  ('00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000003',
   'BD-2026-000402', 'guest', 'Khách mời Ban quản lý', '', '', 'moi',
   current_date, 2, 0, 'issued')
on conflict (tenant_id, ticket_code) do nothing;

alter table public.erp_tickets enable row level security;

revoke all on table public.erp_tickets
  from public, anon, authenticated, service_role;
grant select on table public.erp_tickets to service_role;

drop policy if exists erp_tickets_service_read on public.erp_tickets;
create policy erp_tickets_service_read
on public.erp_tickets
for select
to service_role
using (tenant_id = '00000000-0000-4000-8000-000000000001'::uuid);

revoke all on function public.erp_gate_scan_ticket(uuid, uuid, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.erp_gate_scan_ticket(uuid, uuid, text, text, text, text)
  to service_role;

commit;
