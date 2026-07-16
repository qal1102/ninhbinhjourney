# Reference Site Analysis

These notes capture patterns to reuse thoughtfully in Ninh Binh Journey. Do not copy the sites literally.

## Travel Next Level

Reference:
- https://travelnextlvl.de/en
- https://www.awwwards.com/sites/travel-next-level

Observed patterns:
- Fullscreen, minimal, photographic travel direction.
- Big editorial headlines with simple navigation.
- Repeated discovery language: hidden gems, curiosity, extraordinary places.
- Horizontal/drag-to-navigate destination moments.
- Awwwards categorizes it around clean, fullscreen, photographic, typography and 3D/interaction patterns.

How to adapt:
- Use large destination imagery as the frame, not as decoration.
- Keep section headings short and emotional, then add practical detail underneath.
- Use “drag/slide” energy selectively for destination browsing, not every section.

## Snami Travel

Reference:
- https://www.snamitravel.com/
- https://www.awwwards.com/sites/snami-travel

Observed patterns:
- Luxury editorial travel system: contrast, restraint, large image crops, confident typography.
- Copy is sensory and designed: “stories, not stops”, “emotion, precision, and place”.
- Collection structure: hotels, villas, day tours, bespoke multi-days.
- Awwwards notes black/white palette and GSAP/CSS/Javascript microinteractions.

How to adapt:
- Make Ninh Binh feel curated rather than listed.
- Use “signature routes”, “quiet gems”, “journey rhythm” and concierge-style detail.
- Let whitespace, image hierarchy and timing feel premium.

## Douglus

Reference:
- https://douglus.site/
- https://www.awwwards.com/sites/douglus-creative-developer

Observed patterns:
- Intro loader is typographic and sequential: one word, then identity lockup.
- Main site text exposes `BUILD`, separated letters `D O U G L U S`, and footer line `Creative Developer · 2026`.
- Awwwards lists minimal, horizontal layout, animation and GSAP.

How to adapt:
- Use the same principle, not the same content: cinematic title sequence.
- Sequence should be: `Ninh Bình` → `Nature` → `Heritage` → `Wonder`.
- Final lockup should hold briefly: large `Ninh Bình`, underline, then `Nature · Heritage · Wonder`.
- Use a Ninh Binh image background with dark cinematic overlay instead of a pure black field.

## Implementation Notes

- Prefer CSS or Motion-style timing for lightweight hero intro. Avoid adding GSAP unless the interaction needs complex timelines.
- Respect `prefers-reduced-motion`.
- Intro must not block the app too long and must not prevent language switching after it exits.
- If the user asks for a “Douglus-like” intro, include all four identity words, not only `Ninh Bình`.
