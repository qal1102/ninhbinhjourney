# Ninh Binh Journey UI/UX Rules

This file is the standing design brief for Codex work on the Ninh Binh Journey site. Use it before changing visible UI.

**Phạm vi:** mọi mục cho tới *Voice Rules / Intro Rule / Pre-Ship Audit (web công khai)* viết cho **web du khách**. Giao diện **ERP nội bộ** có mục riêng ở cuối file — *ERP Rules (giao diện nội bộ)* — thêm ngày 25/08/2026. Đọc đúng mục cho bề mặt mình đang sửa.

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

## Creative Direction Matrix — chốt 15/09/2026

Chủ dự án không nghiệm thu một website chỉ vì có nhiều `Reveal`, fade hay parallax rải đều. Web công khai phải đọc như **nhiều thế giới có mục đích khác nhau**, mỗi thế giới có một kỹ năng chủ đạo và một nhịp thị giác riêng. Cấu trúc điều hướng cấp một là: **Du lịch Ninh Bình · Hợp tác thương hiệu · Sự kiện theo mùa · Đặt chỗ**. Du lịch là cửa mặc định; các chương còn lại chỉ mở khi khách chủ động chọn.

| Bề mặt | Vibe và vật liệu | Kỹ năng/chuyển động chủ đạo | Không được làm |
| --- | --- | --- | --- |
| Trang chủ / Du lịch Ninh Bình | Đá vôi, mặt nước, sương, xanh rêu và vàng nắng; nhịp phim tài liệu du lịch | Spatial mask/aperture, cinematic handoff, pinned route story và camera ảnh đổi theo địa danh | Biến toàn trang thành một dãy card; dùng cùng một fade cho mọi khối |
| Hợp tác thương hiệu | Tạp chí thời trang cao cấp: ảnh dọc lớn, khoảng trắng rộng, nhịp bất đối xứng, finale có chủ đích | Chuyển chương ngang–dọc, shared-image/page transition, hover typography và chapter index | Tự động đổ toàn bộ logo/ảnh lên trang chủ; viết một đề xuất thành quan hệ hợp tác đã xác nhận |
| Sự kiện theo mùa | Mùa, lịch, giấy hộp quà, ánh trăng và bàn tiệc; ấm hơn trang du lịch | Lunar/orbit navigation, editorial shelf, reveal theo lớp vật liệu và timeline theo ngày | Dùng nguyên motion của trang thương hiệu; giấu giá/lịch/CTA trong hiệu ứng |
| Packages / Booking | Điềm tĩnh, rõ, được một concierge dẫn đường; cảm giác dịch vụ hơn biểu mẫu | Shared-element continuity, route/timeline draw và microinteraction báo tiến độ có nguyên nhân | Dùng spectacle làm chậm thao tác; thay đổi số liệu hay trạng thái chỉ để trang trí |
| Explore / bản đồ | Bản đồ sống, định hướng và khoảng cách; ưu tiên cảm giác đang di chuyển trong không gian | Marker–card–camera đồng bộ, FLIP ảnh sang detail và focus handoff | Hai state riêng cho card và map; cuộn lồng hoặc canvas ăn thao tác một ngón |
| Trang điểm đến | Một khung editorial chung nhưng motif lấy từ chính địa điểm: nước, hang, núi hoặc di sản | Một signature transition theo `visual motif` của địa điểm, cộng timeline/dữ kiện thật | Nhân bản mười lăm trang giống hệt nhau rồi chỉ đổi ảnh và tên |

Mỗi route/chương mới phải có tối thiểu: **một macro-transition nhận ra ngay, một microinteraction phục vụ thao tác, một lối vào/ra có continuity**, cùng fallback reduced-motion đầy đủ. Có thể dùng chung primitives kỹ thuật nhưng không dùng chung toàn bộ choreography. Reference chỉ dùng để học nguyên lý — interactive navigation, page transition, parallax experience và custom step booking — không sao chép nguyên thương hiệu, layout hay code của website khác.

Nghiệm thu hai tầng: (1) hàng rào kỹ thuật về overflow, focus, scroll geometry, reduced-motion; (2) agent chính tự xem ảnh và chuyển động thật ở desktop/mobile. Tầng (1) xanh không được dùng để tự tuyên bố tầng (2) đạt. Nếu người xem khó chỉ ra trang này khác bản trước ở đâu, phase chưa đạt.

## Mobile Rules

- Build mobile first.
- Text must fit buttons and cards.
- Tap targets should be comfortable.
- Avoid nested cards.
- Keep maps and modals usable with one hand.

## Voice Rules (Giọng văn)

Reference site: heritagevietnamairlines.com and comparable premium travel editorial sites — not generic AI/SaaS copy. Applies to **prose**: subtitles, section intros, destination `description`/`story`, editorial copy. Does **not** apply to UI micro-copy (button labels, nav items) or to the one-shot animated intro words (see Intro Rule below) — those must stay short and literal.

Test: read the sentence with "Ninh Bình" swapped for "Hạ Long". If it still reads true, it is generic — rewrite it with something only Ninh Bình can claim (a named place, a real number, a specific season/behavior).

Four techniques to use:
- Từ láy (reduplicative words) for texture and rhythm.
- Vế đối (parallel, balanced clauses) — "đá vôi hàng triệu năm tuổi, dấu chân người ở từ thời tiền sử" not a flat list.
- Long-short-long sentence rhythm, not uniform sentence length.
- Đính chính định kiến — name the assumption, then correct it, then invite ("Không phải ai cũng... — chỉ có...").

Five patterns to ban:
- Stacked abstract nouns as a prose lead ("Trải nghiệm — Kết nối — Giá trị").
- "Không X, không Y" used as ad-parallelism rather than a real correction.
- Selling with raw numbers in emotional copy (save numbers for spec sheets, not story copy).
- Internal/technical/product jargon leaking into user-facing text (see incident below).
- Em-dash fragments used to replace periods throughout a paragraph.

**Known incident, 03/08 — và kết cục 04/08.** A UI section titled literally "Three ways in. Pick one." / "Ba lối vào. Chọn một." shipped as an instructional list-style header — it read like a bot menu, not an invitation. Bản vá đợt đầu chỉ viết lại tiêu đề theo lối đính-chính-định-kiến ("No two journeys start the same way." / "Không ai bắt đầu một chuyến đi giống ai.") và **giữ lại khung ba thẻ**, với lý do "nó giải quyết một vấn đề điều hướng có thật".

**Ngày hôm sau khung ba thẻ cũng bị loại.** Chủ dự án chê lần hai — *"3 cái đường là cái gì"* — và khối bị gỡ hẳn khỏi trang chủ (`HANDOFF.md` mục 2.6, đợt tám 04/08). Đã kiểm lại 25/08: không còn chuỗi nào trong `app/`, `components/`, `content/`.

Hai bài học, đừng gộp làm một:
- Một pattern có thể **đúng cấu trúc mà vẫn sai giọng** — kiểm riêng phần tiêu đề, không chỉ kiểm khối có tồn tại hay không.
- Và một pattern có thể **sai từ gốc dù đã sửa giọng**. "Thẻ điều hướng đánh số để chỉ đường vào" đã bị loại ở dự án này. Xem thêm luật ERP bên dưới trước khi định dựng lại thứ tương tự ở bất kỳ bề mặt nào.

## Yêu cầu chủ dự án — ghi lại 05–06/08, còn hiệu lực

Ghi ra đây theo đúng yêu cầu ("nhớ note lại mấy yêu cầu của t"). Đây là **quyết định của chủ dự án**, không phải gợi ý — model sau không được tự ý đảo ngược.

**Về nội dung / chữ nghĩa**
- **Nội dung do chủ dự án và phiên làm việc hiện tại viết. Model khác KHÔNG được tự sửa chữ.** Lý do nêu thẳng: các bản viết trước "ngáo đá máy móc", không bắt được giọng heritagevietnamairlines.com.
- Chuẩn hành văn phải đạt: **muave.disantrangan.vn** (xem `REFERENCE_SITE_ANALYSIS.md`). Yêu cầu nguyên văn: *"hành văn hay hơn nhiều… học cách hành văn của bọn nó đi"*.
- Cấm tuyệt đối kiểu liệt kê danh từ chồng nhau làm tiêu đề ("Chùa lớn, cố đô, hồ chùa") — đã bị chê "lộn xộn".
- Cấm chữ kỹ thuật nội bộ lọt ra mặt khách. Đã sập 2 lần: "Ninh Binh tourism core" (03/08), "Client demonstration · Supabase shared core" (06/08).

**Về intro đầu trang**
- Chạy **đúng một lần mỗi lần tải trang**, chỉ lặp lại khi F5 hoặc mở lại trang.
- **KHÔNG có đường bỏ qua** — không nút, không bấm-để-tắt. Khung 6,5 giây này là thời gian duy nhất để ba trình phát video kịp boot xong.

**Về video**
- Tự phát, **không có dấu play**, không viền đen ở bất kỳ khổ màn hình nào.
- **Không gắn dòng ghi nguồn YouTube.** Chỉ dùng để demo cho đỡ trống, không dùng kinh doanh — chuyện bản quyền tạm gác lại theo quyết định của chủ dự án. Không lặp lại lời cảnh báo này.

**Về mức độ và cách kiểm chứng**
- **Số lượng "skill" phải nhiều hơn và trang phải đẹp hơn muave.disantrangan.vn.**
- Yêu cầu nguyên văn: *"tao không quan tâm mấy cái test xanh test đỏ… thứ tao quan tâm nhất là liệu có hoạt động không, show khách được chưa"*. **Bắt buộc tự soi bằng ảnh chụp thật (Playwright, desktop + mobile + reduced-motion) trước khi tuyên bố xong.** Test xanh không phải bằng chứng.
- Ưu tiên tốc độ: cần bản demo được càng sớm càng tốt, khách chờ lâu sẽ chán.

## Voice Rule bổ sung 06/08 — GỌI TÊN, ĐỪNG TẢ

Bài học rút ra khi đối chiếu trực tiếp với muave.disantrangan.vn, và nó giải thích chính xác vì sao văn cũ của ta nhạt:

**Ta dùng danh từ chung; họ dùng danh từ riêng có lịch sử đính kèm.**

- ❌ "mái chèo khua vào vách đá dựng đứng"
- ✅ "cây thị 1000 năm tuổi tại Phủ Khống"
- ❌ "một ngôi đền bên mặt nước"
- ✅ "Đền Trần — trái tim của Di sản"

Bốn thứ phải có trong mỗi đoạn mô tả một địa điểm:
1. **Ít nhất một danh từ riêng** (tên đền, hang, phủ, nhân vật lịch sử).
2. **Một con số hoặc mốc thời gian đã kiểm chứng** — 9 hang, hơn 1000m, năm 968, Hùng Vương thứ 18.
3. **Một neo lịch sử** nếu có (triều đại, sự kiện, tích truyện).
4. **Lịch âm** khi nói về lễ hội, không dùng lịch dương.

Vẫn giữ nguyên toàn bộ danh sách cấm ở `#voice-rules` phía trên — đặc biệt là sáo ngữ ("bức tranh hoàn hảo", "chốn bồng lai tiên cảnh") mà chính trang tham chiếu cũng mắc. **Học phần gọi tên và con số, không học phần sáo ngữ.**

**Đính chính một lập luận sai của chính tài liệu này (ghi lại để không ai lặp lại):** bản đầu của mục này có chê trang tham chiếu là "sáo ngữ" như một cách gỡ gạc. Chủ dự án bác thẳng, và đúng: *sáo ngữ của họ nằm trên nền dữ kiện thật, còn văn của ta thì rỗng không.* Một câu sáo nhưng có "cây thị 1000 năm tuổi tại Phủ Khống" vẫn hơn một câu sạch chữ mà không nói được gì. **Ưu tiên số một là dữ kiện; văn phong là thứ hai.**

### Ba câu đã bị loại, giữ lại làm ví dụ phản diện

| Bị loại | Vì sao |
|---|---|
| "Kinh đô cũ nằm giữa, hai ngôi chùa lớn kẹp hai đầu" | Tả hình học. "Kẹp hai đầu" nghe như mô tả một cái bánh mì. |
| "Cả buổi sáng chỉ có tiếng mái chèo" | Không khí suông, không một thông tin nào. Đổi "Ninh Bình" thành "Hạ Long" vẫn đúng — tức là hỏng theo đúng phép thử ở `#voice-rules`. |
| "Vua chọn nơi này vì núi che được. Rồi cháu con thấy chật, và dời đi." | Cố tỏ ra văn vẻ trên một dữ kiện chưa nắm chắc. Vừa rỗng vừa xấc. |

Bản thay thế cho câu thứ ba, sau khi tra nguồn: *"Ba trăm hecta, hai vòng thành, sáu vị vua. Rồi triều Lý dời đô, và Hoa Lư ở lại với núi."* — cùng độ dài, nhưng ba con số và hai danh từ riêng.

### Quy trình bắt buộc trước khi viết một dòng mô tả địa điểm

1. **Tra nguồn trước, viết sau.** Không viết rồi mới đi tìm dữ kiện cho khớp.
2. Ưu tiên nguồn: Wikipedia tiếng Việt → báo nhà nước (Nhân Dân, VietnamPlus, Báo Ninh Bình) → cổng thông tin tỉnh/xã → trang chính thức của khu di tích. Blog du lịch chỉ dùng để đối chiếu, không dùng làm nguồn duy nhất cho một con số.
3. **Ghi dữ kiện + nguồn vào bảng "Kho dữ kiện đã tra nguồn" ở `REFERENCE_SITE_ANALYSIS.md`** trước khi đưa vào code.
4. Con số nào không tra được thì **bỏ hẳn**, không viết ước lượng.

## Intro Rule (one-shot, do not touch lightly)

- `introTop` / `introWords` (currently "Ninh Binh" / "Nature. Heritage. Wonder." and vi equivalent) are a locked, tested sequence — an e2e spec asserts the exact words and timing. This is **not** prose and the swap-test above does not apply to it.
- Must render exactly once per page load (on mount), never re-triggered by click/scroll elsewhere on the page.
- Do not duplicate the same words a second time anywhere in the static hero below the intro overlay — if a kicker line above the H1 already shows them, do not also render them in a second band/grid further down. **Fixed 03/08, commit `3311280`:** a second 3-column band below the subtitle repeated the same four words right after the kicker line; removed, kicker line kept. If this resurfaces, remove the second occurrence, not the first.

## ERP Rules (giao diện nội bộ) — thêm 25/08/2026

Mọi mục phía trên file này viết cho **web du khách**. Cho tới 25/08/2026 dự án **không có một dòng luật giao diện nào cho ERP** — trong khi `HANDOFF.md` mục 1 đặt ERP ở mức "phải đạt production-ready". Mục này lấp chỗ trống đó.

Nguồn: đợt soi ERP bằng ảnh chụp thật ngày 25/08 (giám đốc + nhân viên, desktop 1440 + Pixel 7, reduced-motion). Bối cảnh sản phẩm: chủ dự án dùng thử 03/08 và nhận xét *"sử dụng xong cảm thấy không hiểu gì hết, mọi thứ lung tung mặc dù cũng nhiều thứ đấy"*.

**Không mâu thuẫn với `SO_TAY_HE_THONG_VI.md` mục 4.** Bốn nguyên tắc ở đó — nhất là ③ "số nào hiện lên cũng phải có nguồn" — đứng trên mọi luật hình thức dưới đây.

### Khuôn gốc: một màn hình trả lời "giờ tôi làm gì", không phải "có bao nhiêu"

Khuôn chuẩn **đã có sẵn trong sản phẩm** — trang nhân viên (`/erp` với vai `employee`): danh tính + ca làm → đúng một việc được giao → thanh tiến trình 5 bước (Nhận việc → Vào ca → Trong ca → Bàn giao → Xác nhận) → **một** nút chính. Đó là mạch dẫn mà các vai khác đang thiếu. Khi dựng màn hình cho vai mới, dùng lại khuôn này trước khi nghĩ ra khuôn khác.

### Luật

- **Mỗi màn hình có đúng một hành động chính.** Nếu không xác định được hành động đó là gì thì màn hình chưa xong.
- **Một khái niệm chỉ có một tên.** Tên module lấy theo `SO_TAY_HE_THONG_VI.md` mục 3 — đó là bộ chuẩn. Không dựng bộ phân loại thứ hai trong thanh nav rồi bắt người dùng tự dịch qua lại.
- **Cấm lưới thẻ điều hướng đánh số kiểu "chọn một lối vào".** Đã bị chủ dự án loại hai lần trên web (xem Known incident 03–04/08 ở trên). Đánh số hứa một trình tự; các module song song thì **không đánh số**. Có trình tự thật thì phải là stepper có trạng thái, không phải lưới thẻ tĩnh.
- **Màu phải mã hoá một thứ gì đó, hoặc không dùng màu.** Nhiều badge nhiều màu không mang nghĩa chỉ tạo nhiễu.
- **Không đếm một bản ghi thành nhiều KPI.** Bốn ô cùng bằng 1 vì cùng trỏ tới một hồ sơ là một dòng danh sách, không phải bốn chỉ số.
- **Ô "chưa có nguồn dữ liệu" ở lại, nhưng không cùng trọng số.** Nguyên tắc ③ bắt phải nói thẳng khi chưa đo được — **không được ẩn đi**. Nhưng ô rỗng không được cùng cỡ chữ, cùng khung, cùng vị trí với con số thật; số cần người đọc phải nổi lên trước.
- **Đồng hồ đếm ngược phải đi kèm nút bấm.** Hiện "Còn 1 phút" mà không có hành động nào trên thẻ là tạo áp lực không lối thoát.
- **Không lớp nổi nào được che nội dung.** Nút nổi (FAB trợ lý) phải nhường chỗ, kể cả khi menu mobile đang mở.
- **Mobile: một tầng cuộn.** Không menu-trong-menu-trong-trang. Menu phải cho thấy đủ các đích chính mà không cuộn lồng.
- **Trang chủ của mọi vai phải có đường vào công việc.** Không được để một vai đăng nhập xong chỉ thấy bảng số mà không có lối tới module.

### Pre-Ship Audit (ERP)

Trước khi tuyên bố xong một thay đổi giao diện ERP:

- Đăng nhập bằng **ít nhất hai vai** khác cấp (ví dụ `giamdoc` + `nv.trangan`), chụp ảnh full-page **desktop + Pixel 7 + reduced-motion**. Luật "test xanh không phải bằng chứng" ở mục *Yêu cầu chủ dự án* áp dụng đầy đủ ở đây.
- Với mỗi ảnh, tự trả lời: hành động chính của màn hình này là gì? Nếu không chỉ ra được, chưa xong.
- Kiểm không có lớp nổi che nội dung ở cả hai khổ màn hình.
- Kiểm không có ô KPI nào là lát cắt trùng của cùng một bản ghi.
- Kiểm tên module trên nav khớp `SO_TAY_HE_THONG_VI.md` mục 3.
- Chạy `npm run lint` và `npm run build`.

## Pre-Ship Audit (web công khai)

Before finishing visible UI work:

- Check `?lang=vi` and `?lang=en`.
- Check a source URL such as `?lang=vi&source=trang_an`.
- Open a map popup, then Discover, and confirm the modal appears above the map.
- Close modals by close button, backdrop and Escape.
- Add a destination and confirm itinerary state changes.
- Run `npm run lint`.
- Run `npm run build`.
