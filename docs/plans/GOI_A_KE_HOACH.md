# GÓI A — KHẢO SÁT VÀ KẾ HOẠCH (A0)

> **Trạng thái: BẢN NHÁP, A0 CHƯA ĐÓNG.** Đề bài ở `docs/reference/PHIEU_GIAO_VIEC_01_GOI_A.md`. Hiện trạng hệ thống ở `docs/HANDOFF.md`.
> Ghi ngày 17/08/2026, sau khi đọc HANDOFF, AGENTS.md, migration nền, migration T8/T11a và toàn bộ mã nguồn web công khai.
> **Chưa được duyệt, chưa được sang A1.** Hai đầu vào còn thiếu ghi ở mục 7.

**Quy ước từ ngữ trong file này** — hai nghĩa hay bị lẫn:

- **Chủ đầu tư** = phía đã ngồi test ERP + web, góp ý và đặt câu hỏi cho mình.
- **Khách du lịch** = người sẽ vào web đặt vé.

---

## 1. Phát hiện lớn nhất: lớp khách hàng của Gói A đã được thiết kế sẵn, đang nằm chết

Migration nền `202607240001_secure_shared_core.sql` đã chứa gần đủ mô hình dữ liệu Gói A yêu cầu. Toàn bộ đang bị cờ `NEXT_PUBLIC_LEGACY_OPS_ENABLED` khoá 404 từ đợt T2, và hàng việc **T12 đang xếp lịch xoá chúng đi**.

| Nhiệm vụ trong phiếu | Bảng đã có | Mã nguồn đã có |
|---|---|---|
| A1 tồn kho khung giờ | `capacity_slots` | `app/api/capacity/` |
| A1 đơn đặt chỗ | `bookings`, `booking_contacts`, `booking_lines` | `services/supabase/booking-service.ts` |
| A2 thanh toán giả lập | `payment_intents`, `payment_events` | `services/adapters/sandbox-payment.ts` — đã có HMAC ký/verify, đã chừa sẵn `LivePaymentAdapter` |
| A2 vé QR | `passes`, `pass_entitlements` | `app/pass/[token]/`, `app/checkout/`, `components/commerce/` |
| A3 soát vé | `redemptions` | `app/api/check-in/inspect/`, `app/api/check-in/redeem/` |
| A4 QR động đo nguồn | `qr_sources`, `campaigns` | — (chưa có route `/q/[mã]`) |
| A5 phễu | `analytics_events` | chỉ `/ops/page.tsx` đọc, **không nơi nào ghi** |

### Nhưng không dùng lại nguyên trạng được — ba lỗi cấu trúc

1. **Gắn chết vào phiên trình diễn.** `capacity_slots` và `passes` đều có `demo_run_id uuid not null references demo_runs(id) on delete cascade`. Xoá một demo run là bay sạch vé và đơn đặt chỗ. Đây là lý do gốc khiến cả lớp này chết: nó được dựng cho kịch bản trình diễn, không phải cho vận hành thật.
2. **Nguồn công suất thứ hai.** `capacity_slots.capacity` là số nguyên nhập tự do, không dẫn xuất từ đâu. Phiếu cấm tuyệt đối điều này, và nó trùng đúng **bẫy #6** trong HANDOFF ("hai nguồn sự thật về cùng một thứ thì cả hai đều sai").
3. **Chuẩn mã vé thứ hai.** `passes` không nối gì tới `erp_tickets` (T8). Vi phạm thẳng dòng nghiệm thu *"vé đặt trên web và vé phát tại quầy dùng cùng một chuẩn mã"*.

Ngoài ra `passes.created_by` là `not null references auth.users(id)` — khách du lịch ẩn danh không điền được cột này.

---

## 2. Quyết định kỹ thuật quan trọng nhất

Phiếu bắt phải chọn và nêu lý do: **vé lớp khách dùng chung bảng `erp_tickets`, hay bảng mới có cầu nối?**

### Chọn: dùng chung `erp_tickets` làm chuẩn vé duy nhất; lớp khách là bảng mới bọc quanh nó

Cụ thể:

- **Mỗi vé bán ra trên web ghi thành một dòng `erp_tickets`.** Bảng T8 đã có sẵn `channel text not null check (channel in ('quay-ve', 'website', 'doi-tac', 'moi'))` — đường cho web đã được chừa từ đầu, và chú thích đầu migration T8 nói thẳng: *"the visitor-facing QR flow (W1) is built on top of this, later."*
- **Đơn hàng, giữ chỗ, hồ sơ khách du lịch, phiên thanh toán → bảng mới**, theo khuôn `erp_*` đã được kiểm chứng (RLS bật, khoá dòng, cột `version`, audit chỉ-thêm bất biến). Khung giờ của một vé nằm ở bảng đơn mới, **không** `alter table erp_tickets`.
- **Tồn kho khung giờ suy ra từ `erp_capacity_thresholds`** (T11a), không có bảng công suất thứ hai — xem mục 3.

### Lý do

1. Nghiệm thu đợt yêu cầu vé web và vé quầy cùng một chuẩn mã. Hai bảng vé là hai chuẩn, không cách nào lách.
2. A3 (soát vé mất mạng) dựng trên cổng đối chiếu T8, mà cổng đó đọc `erp_tickets`. Vé web không nằm trong đó thì A3 phải viết cổng thứ hai — nhân đôi cả logic chống quét trùng lẫn logic ghi lượt từ chối.
3. Ràng buộc A1 *"không sửa bảng ERP hiện có ngoài việc đọc"* vẫn giữ được, nếu hiểu "sửa bảng" là **đổi lược đồ** (`alter table`) chứ không phải **ghi dòng** (`insert`). Đường ghi đi qua một RPC mới, `erp_tickets` không đổi một cột nào.
4. Số vé bán trên `/erp` (T13, `getTicketSalesSummary()`) tự động có luôn vé web, không phải cộng tay hai nguồn.

**Hệ quả cần chấp nhận:** `erp_tickets` không có cột giá. Doanh thu phải nằm ở bảng đơn mới, không nhét vào `erp_tickets` — giữ đúng quyết định T13 là bảng vé chỉ đếm vé, không quy ra tiền.

---

## 3. Tồn kho khung giờ — không được đẻ nguồn công suất thứ hai

`erp_capacity_thresholds` (T11a) đã có sẵn công thức, PostgreSQL tự sinh:

```
hourly_capacity = floor(vehicle_count × seats_per_vehicle × 60 ÷ round_trip_minutes)
```

Đúng nguyên tắc phiếu nêu: *"công suất bằng điểm nghẽn nhỏ nhất nhân hệ số an toàn"*.

**Hướng làm:** tồn kho một khung giờ = `hourly_capacity` của điểm nghẽn nhỏ nhất tại cơ sở đó × hệ số an toàn, trừ đi số chỗ đã giữ và đã bán trong khung. Bảng đơn mới **chỉ lưu phần đã tiêu thụ**, không bao giờ lưu bản sao của sức chứa. Đổi cấu hình sức chứa ở `/erp` là tồn kho web đổi theo ngay, không cần đồng bộ gì.

**Cần lưu ý khi làm:** `erp_capacity_thresholds` là công suất **theo giờ cho một điểm nghẽn**, chưa có khái niệm khung giờ theo ngày, cũng chưa có giờ mở/đóng cửa. A1 phải bổ sung lịch khung giờ (giờ mở, giờ đóng, độ dài khung, ngày áp dụng) — đây là **phần xây mới thật sự**, không phải phần tái sử dụng.

---

## 4. Hiện trạng web công khai — và vì sao "thu data khách du lịch" đang bằng 0

Phần này trả lời trực tiếp điều chủ đầu tư quan tâm nhất sau buổi demo: *năng lực thu và dùng dữ liệu khách du lịch*.

### 4.1 Đang chạy thật (chỉ đọc một chiều)

| Trang | Làm được gì |
|---|---|
| `/` | Trang chủ, 3 câu chuyện + 3 lối vào, đã rút từ 11.365px xuống 7.259px |
| `/explore` | Bản đồ Leaflet + bộ lọc, danh mục đầy đủ điểm đến |
| `/destination/[slug]` | Trang chi tiết từng điểm |
| `/packages`, `/packages/[slug]` | Tuyến dựng sẵn |
| `/plan` | Dựng lịch trình từ giọng nói hoặc chữ, có kiểm giờ mở cửa, sức đi bộ, ngân sách |

Nội dung nằm cứng trong `content/destinations.ts` + `content/packages.ts` — đổi giá tour phải sửa code (đó là W4).

### 4.2 Có mã nguồn nhưng chết trên production

- `/checkout` → in ra *"Online checkout is not configured"*, vì `config/experience.ts` chặn `sandboxPaymentEnabled` ở chế độ production.
- `/api/quotes`, `/api/bookings` → ném `DEMO_ROOM_NOT_JOINED` nếu thiếu cookie `nbj-active-run`.
- `/demo/join` — đường **duy nhất** cấp cookie đó — trả 404 sau cờ `NEXT_PUBLIC_LEGACY_OPS_ENABLED` (đợt T2).
- `/pass/[token]`, `/booking/[code]` → không có đường nào sinh ra token/code, nên là ngõ cụt.

### 4.3 Chỗ đau nhất

`/plan` là nơi khách du lịch khai nhiều nhất về mình: đi với ai, mấy người, ngân sách bao nhiêu, nhịp đi thế nào, chịu đi bộ bao xa, định đi ngày nào. Nhưng `app/api/journeys/route.ts` chỉ ghi vào Supabase khi có cookie demo room:

> *"A demo room is required only to PERSIST a journey. Ordinary visitors who never joined one still get a fully generated, validated itinerary back — it simply lives in the browser instead of Supabase."*

Không có cookie → trả `persisted: false` và **vứt đi**. Mà production không cấp được cookie đó nữa.

**Kết luận: mỗi lượt khách du lịch dùng `/plan`, hệ thống mất trắng một hồ sơ nhu cầu hoàn chỉnh.** Cộng thêm: `analytics_events` không nơi nào ghi, và toàn bộ web công khai không có một ô email hay số điện thoại nào.

### 4.4 Ba việc rẻ nhất để biến năng lực này thành thứ nhìn thấy được

Xếp theo tỉ lệ tác động / công sức, **chưa xếp vào A1–A6**, cần chủ dự án chốt có làm trước hay không:

1. **Gỡ lệ thuộc demo room ở `/plan`.** Bảng `journey_intents` + `itineraries` đã có, RPC `save_generated_journey` đã có; vướng đúng ràng buộc `demo_run_id not null` → một migration hẹp. Sau đó mỗi lịch trình dựng ra là một bản ghi thật.
2. **Một màn hình ERP đọc số đó ra** — hôm nay bao nhiêu lượt dựng lịch trình, điểm đến nào được chọn nhiều, ngân sách trung bình, ngày nào đang được nhắm đông. Data không ai nhìn thấy thì với chủ đầu tư nó không tồn tại (**bẫy #5**: xây nửa dưới rồi dừng thì nửa dưới đó không tồn tại với người dùng).
3. **Ô "Gửi lịch trình này cho tôi", đúng một trường liên hệ** — chỗ khách du lịch từ ẩn danh thành có danh, đúng nguyên tắc "định danh tự nguyện và tăng dần".

**Việc 1 và 2 không vướng pháp lý** vì không thu danh tính, chỉ là ý định ẩn danh. **Việc 3 thì vướng** — phiếu và điểm 6 của `CAC_DIEM_CAN_QUYET_DINH_TAM_COC.md` đều nói chưa thu dữ liệu khách thật khi chưa chốt pháp nhân xử lý dữ liệu. Đây là cái cớ tự nhiên nhất để hối chủ đầu tư trả lời điểm 6.

---

## 5. Mâu thuẫn phát hiện được — phiếu §6 bắt dừng lại hỏi

| # | Mâu thuẫn | Đề xuất xử lý |
|---|---|---|
| 1 | **Ưu tiên ngược nhau.** `HANDOFF.md` mục 1 và `AGENTS.md` dòng 14 đều ghi "ERP trước, web sau, không đánh đổi chất lượng ERP để làm web". Phiếu đảo lại. | Phiếu đã tự nhận là "điều chỉnh", nên đây là ghi đè có khai báo, không phải xung đột ngầm. Nhưng **phải sửa thẳng hai chỗ đó** ghi rõ "từ 17/08/2026 ưu tiên là Gói A", nếu không phiên sau kế thừa mâu thuẫn — đúng **bẫy #6** áp cho tài liệu. |
| 2 | **T12 định xoá đúng thứ Gói A cần.** Hàng việc T12 là "dọn ~20 bảng chết của `/ops`", HANDOFF đã ghi "điều kiện đã đạt, làm được rồi". Đó chính là đống bảng ở mục 1. | **Hoãn T12** cho tới khi Gói A thu hoạch xong thiết kế. Ghi lý do vào HANDOFF mục 4. |
| 3 | A1 yêu cầu "không sửa bảng ERP hiện có ngoài việc đọc", nhưng vé web phải nằm trong `erp_tickets`. | Đã xử lý ở mục 2: `insert` qua RPC mới, không `alter table`. Cần chủ dự án xác nhận cách hiểu này. |

---

## 6. Rủi ro

| Rủi ro | Mức | Ghi chú |
|---|---|---|
| **T6c chưa làm — 143 policy RLS chưa bảo vệ `/erp`**, hệ thống chạy bằng service role + tự kiểm bằng TypeScript | 🔴 Cao | Với ERP nội bộ tạm chấp nhận được. Với lớp khách công khai, khách du lịch ẩn danh chạm thẳng vào bảng qua Supabase client — **đây là bề mặt đầu tiên khiến việc đó thành nguy hiểm thật.** Bảng lớp khách phải bật RLS đúng ngay từ A1, không đợi T6c. |
| **Không có chế độ ngoại tuyến ở bất kỳ đâu** (HANDOFF mục 2.4) | 🔴 Cao | A3 là hạ tầng hoàn toàn mới: service worker + hàng đợi cục bộ + hoà giải khi đồng bộ. Đây là hạng mục nặng nhất Gói A, không phải "nối vào cái đã có". |
| Khung giờ theo ngày chưa tồn tại trong T11a | 🟡 Vừa | Xem mục 3. |
| `next build` cục bộ không bắt được lỗi `"use server"` export sai | 🟡 Vừa | **Bẫy #7 và #11**, đã sập hai lần. Mỗi lần thêm file action mới phải grep toàn repo. |
| Bộ Playwright nuốt luôn spec `prod-smoke-*` nếu chạy không kèm đường dẫn | 🟡 Vừa | HANDOFF mục 2.7a. Luôn đặt `PLAYWRIGHT_BASE_URL` tường minh. |
| Chưa chốt tên thương hiệu (điểm 5) | 🟢 Thấp | Phiếu đã xử lý: đọc tên từ biến cấu hình. |

---

## 7. Hai đầu vào còn thiếu — A0 chưa đóng được

1. **`docs/reference/Bao_cao_tong_the_he_sinh_thai_so_du_lich_Ninh_Binh.docx` chưa có trong repo.** Phiếu ghi chủ dự án sẽ copy vào trước khi bắt đầu. Đây là yêu cầu nghiệp vụ gốc, A0 phải đối chiếu với nó trước khi kết luận phần "xây mới".
2. **Chưa có nội dung góp ý và câu hỏi thật của chủ đầu tư sau buổi demo.** Cần: vài góp ý nhỏ đó là gì (ERP hay web, màn hình nào), và câu hỏi họ đặt ra nguyên văn. Cùng một mối quan tâm "data khách du lịch dùng được gì" nhưng ba cách hỏi dẫn tới ba việc khác nhau:
   - Hỏi *"thu được những gì"* → việc 2 mục 4.4 (màn hình ERP đọc nhu cầu khách).
   - Hỏi *"rồi bán thêm được gì"* → việc 3 mục 4.4 (phễu + liên hệ).
   - Hỏi *"lấy ở đâu ra"* → A4 (`/q/[mã]` đo nguồn quét).

---

## 8. Thứ tự làm đề xuất

Chờ chủ dự án chốt giữa hai hướng:

- **Hướng A — bám phiếu.** A1 → A2 → A3 → A4 → A5 → A6.
- **Hướng B — chen 4.4 lên trước.** Làm việc 1 + 2 của mục 4.4 (rẻ, vài ngày, có thứ chạy được để trả lời chủ đầu tư ngay), rồi mới vào A1.

**Nghiêng về hướng B**, vì hai lý do: nó trả lời đúng câu chủ đầu tư đang hỏi bằng chức năng chạy được thay vì bằng lời hứa, và nó không đụng gì tới phạm vi A1–A6 nên không phải làm lại. Nhưng đây là **mở rộng ngoài phạm vi Gói A**, mà phiếu §6 cấm tự quyết — nên phải chủ dự án gật.
