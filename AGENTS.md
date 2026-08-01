<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Ninh Binh Journey UI/UX

Before changing public UI, read `docs/UI_UX_RULES.md` and `docs/REFERENCE_SITE_ANALYSIS.md`, then apply them as the standing design checklist.

- This is premium editorial tourism, not generic SaaS.
- Dialogs must always layer above Leaflet and close via button, backdrop and Escape.
- Language switching must update immediately, persist after refresh and preserve URL source parameters.
- Motion must support reduced motion.
- Run `npm run lint` and `npm run build` before shipping visible UI changes.

## Codex handoff and plan

At the start of every new task or conversation, read both `docs/CODEX.md` and `docs/PLAN.md` completely before making changes.

- Treat `docs/CODEX.md` as the canonical handoff for current status, production URLs, verified behavior, pending decisions, data limitations and next work.
- Treat `docs/PLAN.md` as the canonical numbered backlog and readiness gate. Select work by its plan ID, and do not mark a UI-only shell as a completed functional module.
- After every material code, UI, configuration, schema, test or deployment change, update the current-state sections and append a dated entry to its change log before handing off.
- After every material change, also update the affected PLAN item status and its verification evidence.
- Record what was actually verified. Never describe demo/local state as persistent or realtime unless the production integration has been verified.

## Test cadence

Use risk-based test layers; do not rerun the full browser matrix after every small edit.

- During implementation, run targeted lint/typecheck and the nearest unit, security or integration tests.
- After a complete workflow batch, run only the Playwright specs that exercise that workflow and its affected viewports.
- Run the full Playwright, visual, accessibility and cross-role matrix at release-candidate, pre-deploy or scheduled CI/nightly gates.
- Run production smoke only after a deployment.
- If a test failure may come from a stale local server or test environment, cleanly isolate the environment before rerunning; do not change product code or use forced clicks to hide an invalid test.
- Always set `PLAYWRIGHT_BASE_URL` explicitly in the same command when testing production. Omitting it silently spins up a local server and tests that instead, which has already produced a false "critical bug" report.

## A production test must clean up after itself

Production smoke tests run against the real Supabase database, so anything they create is real business data that a client sees. **A spec that writes must leave the system exactly as it found it.** This is not optional tidiness — the 02/08/2026 audit found 13 fake change requests sitting in the director's decision inbox, 9 fake open incidents inflating a site KPI, and an event budget that had silently drifted from the seeded 12,8 tỷ to 13,8 tỷ, all from specs that created data and walked away. Migrations 019 and 020 exist only to undo that.

Before adding or changing any spec that writes to production, satisfy all four:

1. **Nothing may be left pending or open.** Anything that lands in someone's inbox, decision queue, notification bell or "đang mở" count must be decided, closed or reverted before the spec ends. Assert that it is gone — that assertion is usually stronger than the one you started with.
2. **Numbers must come back.** If the spec moves a figure (budget, quota, balance), it must move it back in the same run, through the product's own workflow. A per-run delta compounds forever and quietly corrupts the demo.
3. **Provision your own subject; never consume seeded data.** Workflows here are one-way state machines with no revert RPC, so a spec that walks a seeded record forward can only pass a fixed number of times and then destroys the demo fixture. Create the record the spec needs, then close it out.
4. **Never assume a starting state you did not create.** Read current state and act from it, or provision it yourself.

Where a row genuinely cannot be removed (no delete RPC, and do not add one just for tests), leave it in a terminal state and say so in a comment. If test residue still builds up, purge it with a data-only migration that deletes on a narrow, verifiable predicate — never by time range or by truncating a table.

## Leave the workspace clean

When a task is done, do not leave the machine loaded down:

- Delete generated test residue — `artifacts/playwright/` traces, screenshots, videos and `test-results/`. They are large, they are regenerated on demand, and they are not committed.
- Stop every background process and dev server you started, and free the ports you opened. Never leave a `next dev`, a Playwright server or a watch process running after handing off.
- Do not leave scratch files in the repo; use the session scratchpad directory.
- Check `git status` before handing off: only intended changes should be there.
