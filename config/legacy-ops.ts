/**
 * The `/ops` stack is an architecture migration that was abandoned halfway.
 *
 * On production its login screen is public, and behind it: `auth.users` = 0,
 * `user_profiles` = 0, `tenant_memberships` = 0. Nobody can sign in, and the
 * ~20 tables it reads (`bookings`, `passes`, `incidents`, `quotes`,
 * `capacity_slots`, …) are all empty, because the working system was rebuilt
 * under different table names as `/erp`. See mục 2.3a of docs/HANDOFF.md.
 *
 * A visitor who reaches it therefore finds a second, broken login for the same
 * product. That costs more trust than the whole stack is worth, so it is off
 * by default and stays in the repository behind this flag: the check-in and
 * QR-pass ideas living in there are the starting point for T8/W1, and deleting
 * the code before that work exists would be throwing away the design.
 *
 * Set NEXT_PUBLIC_LEGACY_OPS_ENABLED=true only to work on that code locally.
 * Anything other than the exact string "true" leaves it disabled, so a typo
 * fails closed rather than exposing it.
 */
export function isLegacyOpsEnabled(): boolean {
  return process.env.NEXT_PUBLIC_LEGACY_OPS_ENABLED === "true";
}

/**
 * Path prefixes served only by the abandoned stack. Everything listed here is
 * unreachable, not merely unfinished:
 *   /ops, /demo/ops   – its console and the console's marketing entry point
 *   /demo/join        – joins a `demo_runs` room; that table is empty
 *   /api/demo-runs    – the only API those two call
 *
 * Deliberately NOT listed: `/api/journeys` (the public /plan page uses it),
 * `/demo/qr/*` (a QR landing that hands off to /plan and touches none of the
 * dead tables) and `/pass/*` (kept visible until W1 rebuilds the pass on top
 * of the ERP check-in module, so the gap stays in front of us).
 */
export const LEGACY_OPS_PATH_PREFIXES = [
  "/ops",
  "/demo/ops",
  "/demo/join",
  "/api/demo-runs",
] as const;

export function isLegacyOpsPath(pathname: string): boolean {
  return LEGACY_OPS_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
