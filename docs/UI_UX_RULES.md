# Ninh Binh Journey UI/UX Rules

This file is the standing design brief for Codex work on the Ninh Binh Journey site. Use it before changing visible UI.

## Reference Stack

- shadcn/ui: component composition, spacing, forms, sheets, dialogs, buttons.
- Radix Primitives: accessible dialog, popover, tooltip, focus, escape-key and backdrop behavior.
- Motion / Framer Motion patterns: restrained transitions, reveal timing, reduced-motion support.
- Cal.com: booking, reservation and multi-step action patterns.
- Twenty CRM and Dub: clean product state, action density, empty/loading/error states.
- Magic UI: occasional motion inspiration only. Do not let the site become a generic AI/SaaS landing page.

## Product Direction

The site is premium editorial tourism, not SaaS marketing.

- First impression should feel cinematic, local, warm, green, sunlit and heritage-led.
- Use real or generated editorial images as primary visual material.
- Avoid generic glass cards, purple gradients, bokeh/orbs, stock tech language and decorative UI with no job.
- Copy should be concrete: timing, crowd advice, transfer notes, history, why it matters.

## Interaction Rules

- Every primary CTA must visibly do something.
- Language switch must update the UI immediately, persist after refresh, and preserve URL source parameters.
- Map markers, story cards and detail panels must be connected.
- Add to journey must update selected state and itinerary.
- Replace and remove must work locally.
- Reserve must open a simulated checkout modal only; do not imply real payment.

## Dialog And Layering Rules

Map, canvas, iframe and third-party widgets often create high stacking contexts. Dialogs must always win.

- Dialog overlays use z-index above 1000.
- Dialog backdrop click closes the dialog.
- Escape closes the dialog.
- Body scroll is locked while dialog is open.
- Inner dialog clicks must not close the dialog.
- Dialog content must be usable on mobile and desktop.
- Never let Leaflet popups, controls or tiles appear above a modal.

## Editorial Image Rules

- Destination detail images should use a stable wide aspect, not a narrow column crop.
- Use `object-position` per image where needed.
- Avoid heavy dark overlays unless text sits directly over image.
- Do not stretch or blur small images into huge containers.
- Use Next Image sizes that match the rendered layout.

## Map Rules

- Leaflet must load client-side only.
- Use a real interactive map, not a fake text map.
- Source query parameter must focus/highlight the matching QR marker.
- If no source exists, fallback should feel intentional, not broken.
- Geolocation must be opt-in unless the browser already granted permission.
- Map controls must not overlap important content or modal layers.

## Motion Rules

- Opening screen may be cinematic: sequential title words, dark field, white type.
- Motion should be short, purposeful and skippable by time.
- Always support `prefers-reduced-motion`.
- Do not block core interactions with long decorative animation.

## Mobile Rules

- Build mobile first.
- Text must fit buttons and cards.
- Tap targets should be comfortable.
- Avoid nested cards.
- Keep maps and modals usable with one hand.

## Pre-Ship Audit

Before finishing visible UI work:

- Check `?lang=vi` and `?lang=en`.
- Check a source URL such as `?lang=vi&source=trang_an`.
- Open a map popup, then Discover, and confirm the modal appears above the map.
- Close modals by close button, backdrop and Escape.
- Add a destination and confirm itinerary state changes.
- Run `npm run lint`.
- Run `npm run build`.
