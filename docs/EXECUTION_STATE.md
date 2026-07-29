# Execution State

> **Snapshot lịch sử ngày 27/07/2026.** Các đường dẫn `/demo/ops` và kết luận phạm vi bên dưới thuộc kiến trúc trước khi chốt ERP tại `/erp`. Đọc [`CODEX.md`](./CODEX.md) để biết source hiện tại và [`PLAN.md`](./PLAN.md) để biết việc còn lại.

- Overall status: INTERACTIVE DEMO READY; LIVE PILOT INTEGRATION PENDING
- Last updated: 2026-07-27
- Working branch: existing `main` worktree; owner-owned changes preserved
- Public demo entry: `/`
- Executive internal-management preview: `/demo/ops`
- Protected operations entry: `/ops`
- Production deployment: existing baseline only; current implementation not deployed

| Checkpoint | Status | Evidence | Remaining |
|---|---|---|---|
| C0 Baseline | PASS | Existing app and delivery target inspected. | — |
| C1 Secure shared core | CODE COMPLETE / REMOTE PENDING | Supabase schema, run scoping, RLS/RBAC contracts, auth helpers, environment validation, API boundaries, and security tests exist. | Apply and exercise against a dedicated remote Supabase project. |
| C2 Discover | PASS | Catalog, detail, local geographic fallback, filtering, sources, corrected editorial media. | Client content approval. |
| C3 Journey | PASS | Intent, route generation, editable itinerary, persisted API/domain flow; homepage CTA enters `/plan`. | Remote persistence/UAT. |
| C4 Commerce | PASS AS SANDBOX DEMO | Packages, quote, checkout, booking, pass and QR flows exist without real payment claims. | Payment/ledger integration is a later approved scope. |
| C5 DestinationOS | DEMO READY / PILOT PENDING | `/demo/ops` plus protected bookings, capacity, check-in, incidents, copilot, audit and demo-room routes. | Two-site source-system integration and remote auth. |
| C6 Operations AI | PROTOTYPE | Human-confirmed incident parsing/copilot and source-linked SOP summaries. | Organizational SOP approval and evaluation with real operators. |
| C7 Experience polish | PASS FOR CURRENT SCOPE | Shorter homepage, four-word intro, Fraunces soft axis, logo, corrected images, language fix, responsive/a11y audit. | Client visual/content sign-off. |
| C8 Pilot freeze | NOT STARTED | — | Freeze contracts after data workshop and UAT. |
| C9 Delivery | NOT STARTED | Existing Vercel target known. | Deploy only after owner approval and environment setup. |

## Exact next action

Run the client review from `/demo/ops`, approve the two-site KPI/incident story, then hold a data-mapping workshop and provision Supabase. This is the shortest path from visual demo to an operational pilot; expanding into finance, HR, assets or procurement before those inputs would create a speculative ERP.
