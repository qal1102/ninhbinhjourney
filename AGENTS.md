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
