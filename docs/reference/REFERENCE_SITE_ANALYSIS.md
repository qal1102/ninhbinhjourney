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

## Mua vé Di sản Tràng An (đối thủ trực tiếp — trang chính thức của BQL)

Reference:
- https://muave.disantrangan.vn/home/vi
- https://muave.disantrangan.vn/gioi-thieu/vi
- https://muave.disantrangan.vn/hanh-trinh-di-san/vi

**Đây là trang chính thức của Ban Quản lý Khu du lịch sinh thái Tràng An — không phải một trang tham khảo thẩm mỹ, mà là đối thủ trực tiếp trên đúng địa bàn.** Chủ dự án chỉ định đọc để học cách hành văn, ngày 06/08.

### Đo được (Playwright, không phải đọc mô tả)

- Trang chủ cao **4.748px**, gồm 8 khối: hero carousel → thanh đặt vé → Dịch Vụ (giá vé) → 4 mùa → UNESCO → Ấn tượng từ du khách → form liên hệ → footer.
- Font: **SF Pro Display** (font hệ thống của Apple) — không phải một lựa chọn thiết kế, chỉ là mặc định.
- Bảng màu: trắng + đúng hai sắc xanh `#1A6733` / `#0F7A3A`. Không có sắc nhấn thứ hai.
- Class kiểu Bootstrap (`container my-5`), lưới đều, thẻ bo góc. Không có chuyển động theo cuộn nào đáng kể.

### Họ hơn ta ở đâu — nói thẳng

**Hành văn của họ hay hơn hẳn, và lý do rất cụ thể: họ GỌI TÊN, còn ta MÔ TẢ.**

Văn của ta dùng danh từ chung — "núi đá vôi", "mặt nước", "mái chèo", "vách đá". Văn của họ dùng **danh từ riêng có lịch sử đính kèm**:

> "Tuyến 1 là tuyến tham quan du khách có thể chiêm ngưỡng nhiều hang động nhất — **9 hang** — trong đó có một hang động đi xuyên 2 chiều và 3 điểm tâm linh. Là hành trình tìm hiểu lịch sử **triều đại nhà Đinh** qua các di tích và truyền thuyết về **Đền Trình, Phủ Khống**… Đây cũng là tuyến duy nhất bạn có thể khám phá **Đền Trần — trái tim của Di sản**."

> "Du khách cũng sẽ được chiêm ngưỡng mùa kết trái của **cây thị 1000 năm tuổi tại Phủ Khống**."

> "nơi thờ **Đức Thánh Quý Minh Đại Vương** tại Đền Suối Tiên — **vị tướng thời Hùng Vương thứ 18**. Hàng năm vào **ngày 17, 18/3 âm lịch**, Tràng An lại nô nức tổ chức lễ hội."

Sáu kỹ thuật rút ra, dùng được ngay:

1. **Gọi tên riêng thay vì tả chung.** Phủ Khống, Hang Đột, Hành Cung Vũ Lâm, Thủy Đình, núi Phượng Hoàng — mỗi cái tên tự mang theo một câu chuyện. Đây là điểm khác biệt lớn nhất.
2. **Con số làm điểm neo, không phải để khoe.** "9 hang", "hơn 1000m", "1000 năm tuổi", "Hùng Vương thứ 18".
3. **Neo vào triều đại.** Nhà Đinh, nhà Trần, loạn 12 sứ quân — biến phong cảnh thành lịch sử.
4. **Dùng lịch âm.** "Tháng 4-6 (âm lịch)", "ngày 17, 18/3 âm lịch" — đúng nhịp của người Việt đi lễ, và không trang nước ngoài nào bắt chước được.
5. **Tiêu đề đảo tính từ lên trước.** "Rực rỡ Mùa Hè", "Lắng đọng Mùa Đông", "Nên thơ Mùa Thu" — một công thức nhất quán, dễ nhớ.
6. **Định danh vai trò cho một địa điểm.** "Đền Trần — trái tim của Di sản", "hang động đẹp và dài nhất Tràng An".

### Chỗ họ dở — đừng bê nguyên

- Sáo ngữ: "một bức tranh hoàn hảo", "chốn bồng lai tiên cảnh", "như bước ra từ những bức tranh trong các bài thơ về mùa Thu của các thi sĩ".
- Nặng tính từ, nhẹ động từ.
- Khối UNESCO là một đoạn văn hành chính đọc không vào.
- **Ta đã cấm đúng mấy lỗi này ở `UI_UX_RULES.md#voice-rules` từ trước — giữ nguyên lệnh cấm.** Học phần *gọi tên và con số*, không học phần *sáo ngữ*.

### Ta hơn họ ở đâu (tính tới 06/08)

| | Ta | Họ |
|---|---|---|
| Số điểm đến | 15 | 1 (Tràng An) |
| Bản đồ tương tác thật | ✅ Leaflet | ❌ |
| Bộ lập hành trình | ✅ | ❌ |
| Song ngữ | ✅ VI/EN | ✅ VI/EN |
| Màn intro điện ảnh | ✅ | ❌ |
| Video nền tự phát | ✅ 3 khối | ❌ |
| Ghim ảnh kể chuyện theo cuộn | ✅ | ❌ |
| Danh mục ảnh bám con trỏ | ✅ | ❌ |
| Ảnh nở từ thẻ sang chi tiết (FLIP) | ✅ | ❌ |
| Giờ địa phương + tông màu theo buổi | ✅ | ❌ |
| Hạt phim + hiệu chỉnh màu | ✅ | ❌ |
| Font biến thiên theo tốc độ cuộn | ✅ | ❌ |
| Tiêu đề hiện theo từng từ | ✅ | ❌ |
| Bán vé thật | ❌ (chưa có cổng thanh toán) | ✅ |
| Cảm nhận du khách có tên/nơi/ngày | ❌ | ✅ |
| Nội dung theo 4 mùa | ❌ | ✅ |
| Q&A / nội quy / chính sách hoàn vé | ❌ | ✅ |

**Kết luận thẳng:** ta hơn hẳn về kỹ thuật tương tác và thẩm mỹ; họ hơn hẳn về **độ dày nội dung và độ cụ thể địa phương**, cộng với một luồng thương mại thật. Khoảng cách cần lấp không nằm ở hiệu ứng — nằm ở chữ.

### Kho dữ kiện đã tra nguồn — 06/08

**Mọi con số dưới đây đã tra nguồn thật trước khi đưa vào code. Dùng lại được ngay. Đừng thêm con số nào vào site mà chưa có mặt ở bảng này hoặc chưa tự tra nguồn.**

| Nơi | Dữ kiện | Nguồn |
|---|---|---|
| **Cố đô Hoa Lư** | 968: Đinh Bộ Lĩnh dẹp loạn 12 sứ quân, lên ngôi, đặt quốc hiệu Đại Cồ Việt, đóng đô Hoa Lư · 300 ha, hai vòng thành Nội và Ngoại · 968–1009: sáu vua thuộc ba triều Đinh / Tiền Lê / Lý · 1010 Lý Thái Tổ dời đô Thăng Long · một trong bốn vùng lõi di sản Tràng An | Wikipedia tiếng Việt "Cố đô Hoa Lư"; cổng thông tin tỉnh Ninh Bình |
| **Chùa Bái Đính** | Chùa cổ do quốc sư Nguyễn Minh Không (1059–1141) lập năm 1136 · chùa mới khởi công 2003, hơn 1.000 ha · hành lang La Hán 234 gian, dài gần 3 km, 500 tượng đá xanh nguyên khối Ninh Vân, cao 2,5 m, nặng ~4 tấn | Wikipedia tiếng Việt; Thanh Niên; Vietnam Airlines Travel Guide; cổng thông tin xã Gia Viễn |
| **Tràng An tuyến 1** | 9 hang + 3 điểm tâm linh, ~3–4 giờ · Hang Tối dài 320 m, dài nhất tuyến · Hang Nấu Rượu gắn tích nấu rượu tiến vua · lộ trình: Đền Trình → Hang Địa Linh → Hang Tối → Hang Sáng → Hang Nấu Rượu → Đền Trần → Hang Ba Giọt → Hang Seo → Hang Sơn Dương → Phủ Khống → Chùa Báo Hiếu → Hang Khống → Hang Trần → Hang Quy Hậu | muave.disantrangan.vn (trang chính thức BQL); dulichvietnam.com.vn; Vietravel |
| **Tam Cốc** | Ba hang Cả / Hai / Ba, do sông Ngô Đồng bào mòn xuyên núi đá vôi · Hang Cả dài ~127 m · thuyền ~2 giờ · mùa lúa chín giữa tháng 5 tới đầu tháng 6 | VnExpress Du lịch; Tổng cục Du lịch; MIA.vn |
| **Hang Múa** | 486 bậc đá lên đỉnh núi Ngọa Long · leo 20–40 phút · nhìn xuống thấy Tam Cốc | travel.com.vn; sovaba.travel; visitninhbinh.com.vn |
| **Động Am Tiên** | Cách Đông thành đền Vua Đinh ~400 m · hơn 200 bậc đá · Thái hậu Dương Vân Nga (hoàng hậu hai triều) về tu cuối đời, pháp danh Bảo Quang Hoàng Thái Hậu · Đinh Tiên Hoàng từng nuôi hổ báo tại đây để trị tội · dân quen gọi "Tuyệt Tịnh Cốc" | Báo Nhân Dân; Báo Dân Việt; Sở Tư pháp Ninh Bình |
| **Nhà thờ đá Phát Diệm** | Quần thể ~22 ha · xây 1875–1899, nhà thờ lớn xong 1891 · linh mục Phêrô Trần Lục chủ trì · Phương Đình rộng 21 m, sâu 17 m, cao 25 m · nhà thờ Trái tim Đức Mẹ (nhà thờ đá) dựng 1883, dài 15,30 m rộng 8,50 m cao 6 m · toàn đá và gỗ theo dáng đình chùa Việt | Wikipedia tiếng Việt; VietnamPlus; Sở TT&TT Ninh Bình; Báo Ninh Bình |
| **Cúc Phương** | Vườn quốc gia đầu tiên của Việt Nam, lập 1962 | đã tra ở đợt 04/08 (Wikipedia + Vietnam Airlines + Tổng cục Du lịch) |
| **Vân Long** | Khu đất ngập nước duy nhất của Việt Nam trong Danh sách Xanh IUCN · khu Ramsar · thế giới còn chưa tới 300 voọc mông trắng, phần lớn sống ở đây | Mongabay 2021 (đã có trong `press` của `content/destinations.ts`) |

### Việc nên làm, xếp theo giá trị

1. **Viết lại toàn bộ mô tả 15 điểm đến theo lối gọi tên.** Mỗi điểm phải có ít nhất một danh từ riêng và một con số/mốc lịch sử đã kiểm chứng. Đây là việc đáng giá nhất và chưa làm.
2. **Thêm khối 4 mùa.** Ta có 15 điểm nên làm được thứ họ không làm được: *mùa nào nên đi đâu*. Họ chỉ nói được về một nơi.
3. **Lịch âm + lễ hội theo ngày.** Cần tra nguồn thật cho từng lễ hội trước khi viết.
4. **Cảm nhận du khách** — chỉ khi có cảm nhận THẬT. Bịa là vi phạm nguyên tắc không-dữ-liệu-giả của dự án.

## Implementation Notes

- Prefer CSS or Motion-style timing for lightweight hero intro.
- **GSAP đã được cài từ 04/08 và được phép dùng** (`gsap` + `ScrollTrigger`). Lý do thay đổi quan điểm cũ ("tránh GSAP"): `animation-timeline: view()` thuần CSS **chỉ chạy trên Chrome/Edge** — Safari và Firefox rơi thẳng về bố cục tĩnh, tức là phần lớn khách dùng iPhone xem bản không có hiệu ứng nào. Đó không phải chuyện "tinh gọn" mà là hỏng tính năng với một nửa người dùng. Vẫn giữ nguyên tắc: dùng CSS cho hiệu ứng đơn giản, GSAP khi cần dàn cảnh nhiều bước hoặc cần chạy trên mọi trình duyệt.
- Respect `prefers-reduced-motion`.
- Intro must not block the app too long and must not prevent language switching after it exits.
- If the user asks for a “Douglus-like” intro, include all four identity words, not only `Ninh Bình`.
