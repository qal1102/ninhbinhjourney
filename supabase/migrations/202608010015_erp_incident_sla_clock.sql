-- V13 (docs/DANH_GIA_HE_THONG_VA_GIAO_VIEC.md muc 10.2, L8 / 12, V13): the
-- SLA clock was frozen. `elapsed_minutes` was a plain integer written once
-- at insert/seed time and never recalculated -- `incident-repository.ts`
-- read it straight back out, so an incident reported three days ago still
-- showed "con 1 phut" forever. There was also no real report timestamp to
-- recompute from: `reported_at` is a display-only "HH:MM" string with no
-- date, which cannot answer "how long ago was that".
--
-- Fix: add a real `reported_at_ts timestamptz`, the actual moment the
-- incident was reported, and drop `elapsed_minutes` entirely so nothing can
-- read the frozen value again. From now on, elapsed time is always computed
-- at read time in `incident-repository.ts`, from `now() - reported_at_ts`
-- while a case is open, or from `updated_at - reported_at_ts` once it is
-- closed (so "Hoan tat trong N phut" stays a fixed historical fact instead
-- of continuing to grow after the case is done). `updated_at` already exists
-- on this table and is already set to `now()` by both transition RPCs on
-- every status change, including the final close, so no new column is
-- needed for that half of the calculation.
--
-- Existing rows are backfilled so the clock keeps ticking from where it
-- already was, instead of jumping: `reported_at_ts` is set to
-- `now() - elapsed_minutes` at apply time, using the frozen value one last
-- time only to seed a real timestamp before it is dropped.

begin;

alter table public.erp_incidents
  add column if not exists reported_at_ts timestamptz;

update public.erp_incidents
set reported_at_ts = now() - (elapsed_minutes || ' minutes')::interval
where reported_at_ts is null;

alter table public.erp_incidents
  alter column reported_at_ts set not null,
  alter column reported_at_ts set default now();

alter table public.erp_incidents
  drop column elapsed_minutes;

commit;
