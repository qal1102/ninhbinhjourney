-- A6 production audit hotfix: migration 034 created three finance tables
-- without RLS. Supabase's default public-schema grants therefore exposed full
-- CRUD (including TRUNCATE) to anon and authenticated. The application reads
-- these tables with the server-only service-role client and performs mutations
-- through guarded SECURITY DEFINER RPCs, so no browser role needs table access.

begin;

alter table public.erp_bank_statement_lines enable row level security;
alter table public.erp_cash_deposits enable row level security;
alter table public.erp_cash_deposit_shifts enable row level security;

revoke all on table
  public.erp_bank_statement_lines,
  public.erp_cash_deposits,
  public.erp_cash_deposit_shifts
from public, anon, authenticated, service_role;

grant select on table
  public.erp_bank_statement_lines,
  public.erp_cash_deposits,
  public.erp_cash_deposit_shifts
to service_role;

commit;
