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

## Ballena Cabo

Reference:
- https://ballenacabo.com/

Observed patterns:
- Restrained black/white palette, no aggressive animation — quality photography and whitespace do the work.
- One philosophy line repeated across the site as an identity anchor ("A reflection between sea and desert"), not a different tagline per section.
- Dual logo lockups (light/dark) that adapt to whatever background sits behind them.

How to adapt:
- Pick a single Ninh Binh anchor line and reuse it verbatim in the hero, meta description and footer — not a fresh line each place. Gives the brand one voice instead of several competing ones.
- Restraint is itself a design choice, not a lack of one — validates the existing ban on decorative glass cards / gradients / orbs.

## Normal is Boring

Reference:
- https://normalisboring.es/
- https://www.awwwards.com/sites/normal-is-boring

Observed patterns:
- Strict two-color (black/white) luxury real-estate system, GSAP-driven scroll motion.
- Three abstract value pillars (Elegancia / Autenticidad / Funcionalidad) as a dedicated section.

How to adapt:
- Monochrome palette does not fit our brief ("cinematic, local, warm, green, sunlit, heritage-led") — do not import it.
- The three-pillar-of-abstract-nouns pattern is exactly the lead-with-abstract-nouns pattern already banned in `UI_UX_RULES.md#voice-rules` — skip, do not reintroduce it via a "values section".

## Tengile MalaMala Collection

Reference:
- https://tengilemalamala.com/
- https://www.awwwards.com/sites/tengile-malamala-collection

Observed patterns:
- Interactive timeline telling the property's history (stewardship since 1927) instead of a paragraph of prose.
- Large press/testimonial block (a named National Geographic filmmaker quote) given full visual weight, not a small caption.
- Preloader animation, horizontal nav over big background imagery, microinteractions throughout the gallery.

How to adapt:
- **Best-fit idea for this site.** Trang An, Hoa Lu Ancient Capital and Bai Dinh each carry centuries of real history currently told as a flat `story` paragraph — a scroll- or click-driven timeline (key dates: dynasty founding, UNESCO 2014 inscription, etc.) would show off exactly what makes Ninh Binh different from a beach/safari listing, and reuses data already gathered for `press`/`source`.
- Give `press` entries (already in `content/destinations.ts`) the same visual weight as Tengile's testimonial block — a large pull-quote, not a small side note. Presentation change only, data model already supports it.

## Heritage Saunas

Reference:
- https://heritagesaunas.co.nz/
- https://www.awwwards.com/sites/heritage-saunas

Observed patterns:
- Dedicated "Craft" page explaining how the product is actually made (dovetailed log-build technique), separate from the sales pages.
- Honest scarcity framing: "Ten builds a year. No more." — a real production constraint stated plainly, not invented urgency.
- Press quotes from The Guardian and Architectural Digest given prominent placement.
- Interactive product configurator for customizing a build.

How to adapt:
- A real production constraint (boat capacity per day at Trang An, seasonal bird-watching windows at Van Long) can be framed the same honest way — state the limit plainly, do not invent a countdown or fake urgency. Fits the existing no-fabricated-data principle.
- The product configurator maps to the itinerary/journey builder already built — no new feature needed there, just note the parallel.
- Skip the literal 3D configurator UI pattern itself; it solves a problem (customizing a physical product) this site does not have.

## Implementation Notes

- Prefer CSS or Motion-style timing for lightweight hero intro. Avoid adding GSAP unless the interaction needs complex timelines.
- Respect `prefers-reduced-motion`.
- Intro must not block the app too long and must not prevent language switching after it exits.
- If the user asks for a “Douglus-like” intro, include all four identity words, not only `Ninh Bình`.
