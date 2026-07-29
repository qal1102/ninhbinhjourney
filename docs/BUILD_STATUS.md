# Build Status

> **Snapshot lịch sử ngày 27/07/2026.** Không dùng file này để kết luận trạng thái source hiện tại. Trạng thái mới nhất nằm ở [`CODEX.md`](./CODEX.md); backlog và tiêu chí hoàn tất nằm ở [`PLAN.md`](./PLAN.md).

## Current acceptance state

- Recorded: 2026-07-27
- Public visitor experience: READY FOR CLIENT DEMO at `/`
- Role-based internal management preview: READY at `/erp`
- Production deployment: LIVE at `https://ninhbinhjourney.vercel.app`
- Live operational data: NOT CONNECTED; the current ERP numbers are illustrative

## Verified evidence

| Check | Result | Evidence |
|---|---|---|
| `npm run typecheck` | PASS | TypeScript exit code 0. |
| `npm run lint` | PASS | ESLint exit code 0. |
| `npm run test:run` | PASS | 7 files, 34 unit/security tests passed. |
| `npm run build` | PASS | Next.js 16.2.11 production build completed, including `/erp` and `/manifest.webmanifest`. |
| Local Playwright suite | PASS | 33 browser checks passed; 1 desktop run intentionally skipped for a mobile-only hamburger test. |
| Production smoke test | PASS | Director login/dashboard and PWA manifest/service worker passed on the production alias. |
| Production HTTP check | PASS | `/`, `/erp/login`, `/manifest.webmanifest` and `/sw.js` returned HTTP 200 with the expected content types. |

## Delivered in the current pass

- Consolidated the four client-provided inputs in `docs/TAI_LIEU_KHACH_HANG_CUNG_CAP_VI.md`.
- Reframed `/erp` as the internal management product while preserving the visitor homepage at `/`.
- Kept each site as a separate operational branch: Tràng An, Tam Chúc, Tam Cốc and Bái Đính.
- Added role- and site-based access, manager assignment controls and GPS attendance.
- Expanded the director dashboard with finance, month/quarter/year comparisons, a 12-month chart, site profitability and 30/60/90-day forecasts with reasons.
- Added operational modules for vendors, SOP/drills, Go/No-Go readiness, finance/reconciliation and reporting/forecasting.
- Added an installable PWA manifest, service worker, application icons, device notification permission flow and an in-app notification center.
- Rebuilt the director surface for vertical-only mobile use, added a hamburger menu, direct finance drill-down, a live-signal preview and Vietnamese voice commands with text fallback.
- Added the Supabase-ready ERP Realtime migration for site assignments, attendance, signals, finance entries, decisions and push subscriptions; applying it is pending the target project URL/key/link.
- Removed most demo/explanatory language from production UI and softened the Vietnamese management copy.

## Remaining before a live pilot

1. Provision the production Postgres/Supabase project and move authentication, access state, attendance and audit events out of signed browser cookies.
2. Create named operator accounts and verify RBAC/RLS with the client organization chart.
3. Receive and map real ticket/check-in, POS/finance, shift, asset, vehicle, incident and SOP data from each site.
4. Agree real capacity thresholds, SLA owners, Go/No-Go checklist and escalation rules during an operations workshop.
5. Configure Web Push subscriptions/VAPID and server-side notification policies.
6. Run UAT and one controlled on-site pilot before making any real-time or predictive-performance claim.

No real operational, financial or predictive numbers are claimed by the current preview.
