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

**Known incident, 03/08:** a UI section titled literally "Three ways in. Pick one." / "Ba lối vào. Chọn một." shipped as an instructional list-style header — it read like a bot menu, not an invitation. Fixed by keeping the three-card layout (it solves a real navigation problem) and rewriting only the header using the đính-chính-định-kiến pattern: "No two journeys start the same way." / "Không ai bắt đầu một chuyến đi giống ai." Lesson: a UI pattern can be structurally right and still fail on voice — check the header text specifically, not just whether the section exists.

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

## Pre-Ship Audit

Before finishing visible UI work:

- Check `?lang=vi` and `?lang=en`.
- Check a source URL such as `?lang=vi&source=trang_an`.
- Open a map popup, then Discover, and confirm the modal appears above the map.
- Close modals by close button, backdrop and Escape.
- Add a destination and confirm itinerary state changes.
- Run `npm run lint`.
- Run `npm run build`.
