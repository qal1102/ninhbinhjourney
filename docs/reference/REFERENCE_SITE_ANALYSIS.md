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

## Alkemy Market

Reference:
- https://alkemymarket.com/
- https://www.awwwards.com/sites/alkemy-market

Observed patterns:
- Next.js + Three.js, "microinteractions" and scrolling as core engagement per Awwwards' own tagging — jury scores 9.30/10 top individual, mostly 7-8 range on design/creativity.
- Chủ dự án tự dùng site và báo trực tiếp (nguồn chính xác hơn cả bài viết Awwwards): hiệu ứng nền dạng hạt mưa rơi xuống nước, "nhìn kiểu yên bình" — và một lỗi UX thật: trên điện thoại, kéo một ngón tay bị site "ăn" vào tương tác thay vì cuộn trang, phải bấm 2 ngón mới cuộn được bình thường.

How to adapt:
- **Đã áp dụng 04/08, rồi gỡ bỏ cùng ngày**: `components/shared/water-ripple.tsx` — mặt nước Tràng An tương tác WebGL, gợn sóng phát ra quanh vị trí con thuyền. Tự kiểm bằng Playwright (không đọc code) mới thấy vấn đề thật: dùng y hệt ảnh nền của intro, gợn sóng quá nhỏ để nhận ra trên ảnh thật — chủ dự án chê "nhìn ngáo, không cần thiết". Đã gỡ toàn bộ (section, component, CSS). Bài học: một kỹ thuật hay (WebGL ripple) vẫn có thể sai lựa chọn nội dung (ảnh lặp lại) — kiểm bằng mắt người trước khi giữ lại.
- **Bài học UX lấy trực tiếp từ lỗi của Alkemy Market, vẫn đúng dù đã gỡ tính năng trên**: không được set `touch-action: none` chặn cuộn chạm một-ngón trên mobile chỉ để giữ vùng tương tác — áp dụng cho bất kỳ khối tương tác cảm ứng nào làm sau này.

## Inversa

Reference:
- https://inversa.com/
- https://www.awwwards.com/sites/inversa (Site of the Day, 7.48/10 — Design 7.6, Usability 7.2, Creativity 7.72, Content 7.34)

Observed patterns:
- Ảnh thiên nhiên lớn ghim khung khi cuộn (pinned scrollytelling), nhịp chuyển cảnh chậm rãi có chủ đích — dùng GSAP thật.
- Preloader hiện chỉ số kiểu HUD kỹ thuật ("PHASE 31%", "FREQ 16HZ", font monospace) và một khung viewfinder-bracket theo dõi tiến độ cuộn suốt trang.
- Chủ dự án tự xem trực tiếp, thích cách ghim ảnh nhưng chê rõ phần HUD/bracket: "trông xấu", "quá technical", muốn "sang trọng thiên nhiên hơn".

How to adapt:
- **Đã áp dụng 04/08**: `components/discovery/pinned-story.tsx` — 3 nhịp ảnh/chữ ghim khung, crossfade theo đúng vị trí cuộn bằng `animation-timeline: view()` thuần CSS (không GSAP, giữ đúng quy ước tránh GSAP của dự án). Học đúng phần "ghim ảnh, kể chuyện chậm", **chủ động bỏ hẳn phần HUD/số phần trăm/monospace** — không có chỉ số kỹ thuật nào hiển thị, chỉ ảnh thật + tiêu đề serif Fraunces + dòng mô tả, đúng góp ý "sang trọng thiên nhiên hơn".
- Bài học kỹ thuật: `animation-timeline`/`animation-range` phải khai báo SAU shorthand `animation`, nếu không shorthand sẽ reset timeline về `auto` khiến animation chạy tức thời thay vì ăn theo cuộn — lỗi thật bắt được bằng cách đọc opacity tính toán qua Playwright ở nhiều mốc cuộn.

## Marvell Tile & Stone

Reference:
- https://www.marvellco.com.au/
- https://www.awwwards.com/sites/marvell-tile-stone
- https://www.humaan.com/work/marvell-tile-stone (case study của studio Humaan)

Observed patterns:
- Lưới masonry kích thước ảnh lệch nhau (240×360 tới 675×450) — nhịp thị giác bất đối xứng, đọc như một tạp chí biên tập chứ không phải lưới đều tăm tắp.
- "Precise grid-led layouts echo the meticulous nature of their craft" — bố cục phản chiếu đúng tinh thần nghề (tỉ mỉ, chính xác) thay vì chỉ đẹp suông.
- Custom theming riêng cho từng dự án — mỗi công trình một bảng màu/chủ đề riêng.
- Parallax nhẹ tạo chiều sâu, chủ đích "without distraction" — không lấn át nội dung. Điểm mạnh kỹ thuật nhất theo giám khảo Awwwards: Animations/Transitions 8.00/10, cao hơn hẳn các mục khác (accessibility chỉ 6.60/10 — nhắc rằng hiệu ứng đẹp không tự động đi kèm khả năng tiếp cận tốt).

How to adapt:
- Lưới masonry lệch nhau hợp cho khối "Điểm ít đông được khách Tây chú ý" (hidden gems) hoặc một trang gallery ảnh riêng — tránh dùng cho lưới điểm đến chính ở `/explore` vì ở đó thứ tự/lọc quan trọng hơn nhịp thị giác.
- "Mỗi dự án một theming riêng" gợi ý: mỗi điểm đến có thể có một tông màu accent nhẹ riêng (đã có sẵn qua ảnh hero khác nhau, có thể đẩy thêm qua màu badge/underline trên trang chi tiết) — chưa làm, có thể cân nhắc.
- Nhắc lại đúng bài học đã rút ra từ Bái Đính/Van Long: hiệu ứng đẹp (điểm Animations 8.00) không cứu được điểm Accessibility thấp (6.60) — mọi hiệu ứng mới thêm vào site này đều phải tự kiểm bằng axe, không dựa vào "nhìn đẹp là đủ".

## MERSI Architecture

Reference:
- https://www.mersi-architecture.com/
- https://www.awwwards.com/sites/mersi
- https://tympanus.net/codrops/2026/07/27/between-print-and-digital-the-making-of-mersis-website/ (bài kỹ thuật chi tiết nhất, đọc trực tiếp)

Observed patterns:
- Trang case-study từng dự án dùng **cuộn ngang** thay cuộn dọc: GSAP ScrollTrigger ghim một `.horizontal_track`, chuyển khoảng cách cuộn dọc thành `gsap.to()` dịch trục X — cảm giác như lật từng trang tạp chí thay vì lướt web thường.
- **Split-screen slider**: hai danh sách ảnh đồng bộ, chỉ dùng `clip-path: inset(...)` để lộ dần từ hai hướng ngược nhau (không dùng opacity) — nhãn ở giữa luôn khớp với cả hai lớp.
- Ảnh dọc (portrait) được xem là điểm mạnh bố cục, không ép vào lưới đều — tạo "nhịp dọc, độ căng, cảm giác như phòng trưng bày" thay vì lưới dự đoán được.
- Ảnh hưởng thiết kế: "everything unnecessary removed to focus on structure, rhythm and typography" — tối giản triệt để.
- **Trang liên hệ (`/contact`)**: đã tìm trực tiếp nhưng bài viết kỹ thuật không nhắc tới, và trang thật chỉ hiện thông tin liên hệ trực tiếp (email/điện thoại/địa chỉ) + form đăng ký newsletter đơn giản — **không có mẫu form nhiều bước hay kỹ thuật đặc biệt nào để học theo**. Nói thẳng vì chủ dự án hỏi có nên áp dụng cho `/plan` không: không có gì cụ thể để mượn từ đây, đừng bịa ra một pattern không tồn tại.

How to adapt:
- Cuộn ngang qua GSAP không hợp — dự án chủ trương tránh GSAP trừ khi thật cần, và đây là thay đổi kiến trúc điều hướng lớn, rủi ro cao cho một trang chi tiết điểm đến đã hoạt động tốt. **Không làm**, trừ khi có yêu cầu rõ ràng và chấp nhận thêm GSAP.
- Ảnh dọc "coi là điểm mạnh, không ép lưới" — áp dụng được ngay cho khối "Người ta đã viết gì về nơi này" hoặc timeline: nếu sau này có ảnh tư liệu lịch sử dạng dọc, không cần crop vuông cho khớp lưới.
- `/plan` (Lập hành trình): không có pattern nào từ MERSI đáng mượn trực tiếp. Trang hiện tại (mô tả bằng lời, gợi ý, xác nhận trước khi lưu) đã đúng hướng UX tối giản mà MERSI theo đuổi — không cần thêm gì từ tham chiếu này.

## Implementation Notes

- Prefer CSS or Motion-style timing for lightweight hero intro. Avoid adding GSAP unless the interaction needs complex timelines.
- Respect `prefers-reduced-motion`.
- Intro must not block the app too long and must not prevent language switching after it exits.
- If the user asks for a “Douglus-like” intro, include all four identity words, not only `Ninh Bình`.
