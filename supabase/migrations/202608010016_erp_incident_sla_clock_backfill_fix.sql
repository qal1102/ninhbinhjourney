-- Corrects a mistake in the previous migration (202608010015). That
-- migration backfilled `reported_at_ts` as `now() - elapsed_minutes`, using
-- the moment the migration itself was *applied* as the anchor. That is
-- wrong for any row whose `updated_at` already sat further in the past than
-- the migration-apply time minus its elapsed_minutes: closed incidents from
-- the original seed (migration 011, applied 2026-07-31) ended up with a
-- `reported_at_ts` *after* their real `updated_at` (their actual close
-- time), which made the closed-case elapsed calculation in
-- `incident-repository.ts` go negative and clamp to 0 -- "Hoan tat trong 0
-- phut" for a case that really took several minutes.
--
-- Verified directly against production right after 202608010015 applied
-- (docs/DANH_GIA_HE_THONG_VA_GIAO_VIEC.md V13): e.g. INC-TA-064 had
-- reported_at_ts = 2026-08-01 12:45 (today, migration-apply time) but
-- updated_at = 2026-07-31 17:28 (its real close time from yesterday's
-- seed insert) -- reported_at_ts was after updated_at.
--
-- The correct anchor is each row's own `updated_at` (its last real
-- activity: seed insert time if never transitioned, or the last manager/
-- employee transition otherwise), not the time this migration happens to
-- run. `elapsed_minutes` is already dropped, so the only remaining source
-- for the original per-incident offsets (4 / 7 / 6 minutes) is the stable
-- `-071` / `-069` / `-064` id suffix every seeded incident uses (migration
-- 011). This migration touches exactly those 12 seeded rows -- the only
-- rows that exist in this table today, since nothing in the product can
-- create a new incident yet (that lands with V4, the Camera AI wiring).

begin;

update public.erp_incidents
set reported_at_ts = updated_at - (
  case
    when id like '%-071' then interval '4 minutes'
    when id like '%-069' then interval '7 minutes'
    when id like '%-064' then interval '6 minutes'
  end
)
where id like '%-071' or id like '%-069' or id like '%-064';

commit;
