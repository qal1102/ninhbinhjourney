<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Ninh Binh Journey UI/UX

Before changing public UI, read `docs/UI_UX_RULES.md` and apply it as the standing design checklist.

- This is premium editorial tourism, not generic SaaS.
- Dialogs must always layer above Leaflet and close via button, backdrop and Escape.
- Language switching must update immediately, persist after refresh and preserve URL source parameters.
- Motion must support reduced motion.
- Run `npm run lint` and `npm run build` before shipping visible UI changes.
