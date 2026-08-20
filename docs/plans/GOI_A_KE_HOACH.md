# GÓI A — KẾ HOẠCH DỮ LIỆU KHÁCH HÀNG, MARKETING VÀ BÁN DỊCH VỤ

> **STATUS 20/08/2026: CUS-01→CUS-08 đã hoàn tất code staged; A6 go-live readiness ở mục 20 đang thực hiện bằng `5.6 Sol / High`.** Chưa phase customer-data nào được bật production; activation gate phải fail-closed nếu project/schema/secrets/policy/flag dependency chưa khớp.
> Đề bài gốc: `docs/reference/PHIEU_GIAO_VIEC_01_GOI_A.md`. Hiện trạng duy nhất: `docs/HANDOFF.md`.
> Đây là kế hoạch thi hành, không phải tuyên bố các tính năng bên dưới đã có trên production.

## 0. Quyết định của chủ dự án sau buổi review

Chủ đầu tư không chỉ cần web đặt vé. Họ cần biết khách:

- đến từ chiến dịch/kênh nào;
- dừng ở section nào, bỏ qua phần nào, cuộn tới đâu;
- bấm vào điểm đến, gói dịch vụ hoặc lời kêu gọi nào;
- quan tâm gì, định đi khi nào, ngân sách và nhóm đi ra sao;
- sau đó có thể được phục vụ hoặc bán thêm dịch vụ phù hợp;
- dữ liệu marketing từ các kênh khác nhau có thể đổ về một hồ sơ và một phễu chung.

Ngày 18/08/2026, chủ dự án duyệt **ưu tiên data-first** này và yêu cầu bắt đầu thực hiện. Nó là phần mở rộng có chủ đích so với phiếu Gói A ngày 17/08, thay thế yêu cầu “dừng hỏi lại” đối với riêng phạm vi customer data/marketing. Các ràng buộc chưa được dỡ bỏ:

1. Chưa thu dữ liệu người thật hoặc gửi truyền thông thật khi pháp nhân xử lý dữ liệu chưa được chốt.
2. Quyền phục vụ/gửi vé và quyền nhận marketing là hai consent độc lập.
3. Không phá ERP đang chạy; không tạo nguồn vé hoặc nguồn công suất thứ hai.
4. Mỗi phase chỉ được gọi là xong khi có bằng chứng, commit và push GitHub.

---

## 1. Baseline đã kiểm tra

### 1.1 Có rồi — phải tái sử dụng

| Năng lực | Hiện trạng | Quyết định |
|---|---|---|
| Vé và check-in | `erp_tickets`, T8; có `channel = 'website'`, cổng đối chiếu và ghi lượt chấp nhận/từ chối | Dùng làm chuẩn vé duy nhất; web không tạo bảng vé cạnh tranh |
| Sức chứa | `erp_capacity_thresholds`, T11a; công suất giờ tính từ phương tiện × ghế × vòng quay | Đọc làm nguồn công suất duy nhất; chỉ bổ sung lịch bán/khung giờ và phần tiêu thụ |
| Đặt chỗ demo | `bookings`, `booking_contacts`, `booking_lines`, `payment_intents`, `passes`, `redemptions` | Chỉ khai thác thiết kế/logic phù hợp; không dùng nguyên trạng vì khóa vào `demo_run_id` và có chuẩn vé/công suất riêng |
| Nguồn chiến dịch demo | `campaigns`, `qr_sources` | Có thể dùng làm tài liệu thiết kế; cần mô hình production không phụ thuộc demo run |
| Nhật ký analytics demo | `analytics_events` | Không phải kho hành vi production: bắt buộc `demo_run_id`, chưa có collector web, chỉ có writer gián tiếp khi tạo booking sandbox |
| Ý định hành trình | `/plan` tính được lịch trình và nhiều thuộc tính nhu cầu | Khách thường nhận `persisted: false`; phải tạo đường lưu ẩn danh có kiểm soát |
| ERP đọc analytics | `/ops/page.tsx` đọc bảng demo | Đang bị ẩn bởi `NEXT_PUBLIC_LEGACY_OPS_ENABLED`; không dùng làm màn hình Customer 360 mới |

### 1.2 Chưa có — phải xây

- ID phiên ẩn danh ổn định, ID hành trình khách và cơ chế hợp nhất có kiểm soát.
- Bộ ghi page view, section view, active dwell, scroll depth, CTA/service click và conversion.
- Consent riêng cho vận hành dịch vụ, analytics và marketing; lịch sử thay đổi consent.
- Customer 360/CRM trong ERP: nhu cầu, lịch sử tương tác, nguồn vào, đơn/vé và gợi ý hành động.
- Phễu đa kênh và mô hình attribution có phiên bản.
- Ingestion có idempotency cho QR, UTM, form/lead, quảng cáo và kênh đối tác.
- Quy tắc retention, xóa/ẩn danh hóa và export dữ liệu theo chủ thể.
- Cơ chế recommendation dựa trên rule minh bạch trước khi cân nhắc ML.

### 1.3 Bằng chứng hiện tại

- GitHub app đã kiểm tra ngày 18/08/2026 tại commit `854b8a28367c701c2d902753719a45a183895447` trước khi sửa kế hoạch này.
- Production `https://ninhbinhjourney.vercel.app` trả HTTP 200 cho `/`, `/erp` và `/api/health`; deployment `dpl_Afhu2aUcxBbbKq5z1wxdzFitxNhT` ở trạng thái `Ready`.
- Repo có 38 migration, cuối là `202608070038_erp_sop_go_no_go.sql`. Lần đối chiếu Supabase production gần nhất được ghi nhận là 07/08/2026 và khớp tới migration 038. CUS-00 chưa tái kiểm tra remote DB vì máy làm việc hiện tại chưa có Supabase CLI; không được suy diễn rằng remote hôm nay đã được kiểm lại.

---

## 2. Kiến trúc mục tiêu: một dòng dữ liệu, nhiều cách sử dụng

```text
Web / QR / đặt vé / quầy / đối tác / chiến dịch
                    │
                    ▼
        Ingestion + chuẩn hoá + chống trùng
                    │
          ┌─────────┴─────────┐
          ▼                   ▼
  Event timeline        Identity & consent
  (hành vi)             (ẩn danh → tự nguyện)
          └─────────┬─────────┘
                    ▼
           Customer 360 trong ERP
          ┌─────────┼──────────┐
          ▼         ▼          ▼
        Phễu     Gợi ý       Phân khúc /
      marketing  dịch vụ     kích hoạt kênh
```

Các biên bắt buộc:

- Thu thập web đi qua endpoint server-side cùng domain; trình duyệt không ghi thẳng bảng.
- Raw event là append-only; dữ liệu suy ra như segment, attribution và recommendation có `version` và tính lại được.
- Event ẩn danh không chứa phone/email/tên trong `properties`.
- Hợp nhất định danh chỉ qua giao dịch hoặc consent rõ ràng; không fingerprint thiết bị.
- Connector ngoài hệ thống chỉ nhận đúng trường đã được phê duyệt, có audit và retry idempotent.

---

## 3. KPI tree — đo để ra quyết định bán và vận hành

### North star

**Số hành trình khách đủ tín hiệu để phục vụ phù hợp và tạo doanh thu được xác minh**, không phải tổng page view.

### Các nhánh KPI

| Mục tiêu | KPI chính | KPI chẩn đoán | Không được hiểu sai |
|---|---|---|---|
| Thu hút đúng khách | qualified journey/session theo source/campaign | landing engagement, active dwell, scroll depth | Nhiều view không đồng nghĩa nhiều khách chất lượng |
| Hiểu nhu cầu | tỷ lệ session có intent/interest rõ | điểm đến xem lâu, service click, plan generated | Dwell chỉ là tín hiệu, không phải consent hay ý định mua chắc chắn |
| Chuyển đổi | QR/open → plan → hold → payment → ticket → check-in | drop-off theo bước, khung giờ, thiết bị, nguồn | Không cộng số từ hai nguồn khác nhau nếu chưa dedupe |
| Bán thêm | attach rate và doanh thu dịch vụ phụ trên booking | recommendation shown/clicked/accepted | Click gợi ý không phải doanh thu |
| Giữ quan hệ | tỷ lệ khách tự nguyện để lại liên hệ và opt-in marketing | save/send itinerary, return visit, repeat booking | Liên hệ để nhận vé không tự động là opt-in marketing |
| Hiệu quả marketing | verified revenue/conversion theo campaign/source | first-touch, last-touch, assisted touch | Attribution là mô hình có phiên bản, không phải sự thật tuyệt đối |
| Chất lượng dữ liệu | event hợp lệ, trùng, muộn, mất source, identity merge lỗi | ingestion latency, dead-letter count | Dashboard không được che lỗi dữ liệu bằng số 0 |

Baseline ban đầu là **“chưa đo được”**, không tự điền 0. Mỗi KPI chỉ có số sau khi event contract tương ứng được triển khai và kiểm chứng.

---

## 4. Tracking plan v1

Mỗi event dùng `event_name` ổn định; thay đổi ý nghĩa phải tăng `schema_version`, không đổi nghĩa âm thầm.

### 4.1 Acquisition và navigation

| Event | Khi ghi | Thuộc tính bắt buộc | Dùng cho |
|---|---|---|---|
| `page_viewed` | route được render và tab đang visible | `page_path`, `page_type`, `referrer_class`, UTM đã chuẩn hoá | traffic, landing, source |
| `qr_opened` | `/q/[code]` xác thực code và redirect | `qr_source_id`, `campaign_id`, `placement_id`, `destination_path` | offline-to-online, attribution |
| `section_viewed` | section đạt ≥50% diện tích trong viewport trong ≥1 giây | `section_id`, `page_path`, `position`, `visible_ms` | nội dung đã thực sự thấy |
| `section_engaged` | section có active dwell đạt ngưỡng | `section_id`, `active_ms`, `max_visible_ratio` | phần khách dừng lại |
| `scroll_depth_reached` | lần đầu vượt 25/50/75/90% phần nội dung cuộn được | `depth_percent`, `page_path` | điểm rơi nội dung |
| `content_clicked` | click card/link/nút không phải conversion | `element_id`, `content_id`, `content_type`, `section_id` | quan tâm nội dung |

### 4.2 Intent, recommendation và commerce

| Event | Khi ghi | Thuộc tính bắt buộc | Dùng cho |
|---|---|---|---|
| `destination_viewed` | mở chi tiết điểm đến | `destination_id`, `source_section_id` | interest profile |
| `service_viewed` | mở chi tiết dịch vụ/gói | `service_id`, `category`, `price_band` | nhu cầu bán thêm |
| `plan_started` | bắt đầu nhập yêu cầu lịch trình | `entry_point` | đầu phễu plan |
| `plan_generated` | server tạo lịch trình thành công | `journey_intent_id`, nhóm tuổi/budget/pace đã phân lớp, không lưu prompt raw mặc định | hồ sơ nhu cầu ẩn danh |
| `recommendation_shown` | rule engine thực sự render gợi ý | `recommendation_id`, `rule_version`, `service_id`, `reason_code`, `slot` | đo chất lượng gợi ý |
| `recommendation_clicked` | khách bấm gợi ý | các ID ở event shown + `position` | CTR gợi ý |
| `recommendation_accepted` | dịch vụ được thêm vào đơn | `recommendation_id`, `order_id`, `service_id`, `quantity` | attach rate thật |
| `booking_started` | mở bước đặt chỗ | `site_id`, `service_id`, `visit_date` | commerce funnel |
| `slot_hold_created` | server giữ chỗ thành công | `order_id`, `slot_id`, `expires_at`, `party_size` | tồn kho/phễu |
| `payment_completed` | provider callback được xác thực | `order_id`, `payment_id`, `amount`, `currency`, `provider` | doanh thu xác minh |
| `ticket_issued` | đã insert vé chuẩn T8 | `order_id`, `ticket_id`, `channel` | giao vé |
| `ticket_checked_in` | cổng T8 chấp nhận | `ticket_id`, `site_id`, `scan_mode` | visit conversion |

### 4.3 Identity và consent

| Event | Khi ghi | Lưu ý |
|---|---|---|
| `contact_submitted` | khách chủ động gửi contact để nhận/lưu dịch vụ | Event chỉ giữ `customer_profile_id`, `purpose`; contact mã hoá/chuẩn hoá ở kho identity riêng |
| `identity_linked` | server nối anonymous profile vào profile có danh | Ghi phương thức và lý do; không ghi giá trị contact raw |
| `consent_updated` | đồng ý/rút lại từng purpose | Ghi `purpose`, `status`, `policy_version`, `channel`, thời điểm và evidence |
| `marketing_message_outcome` | connector trả sent/delivered/open/click/bounce/unsubscribe | Dùng `external_delivery_id`; chỉ được tạo khi có marketing consent hợp lệ tại thời điểm gửi |

### 4.4 Quy tắc đo “khách đứng ở đâu bao lâu”

- Dùng `IntersectionObserver`; section có `section_id` cố định, không lấy text làm ID.
- Chỉ cộng thời gian khi tab visible, cửa sổ có focus và section đạt ít nhất 50% visible.
- Tạm dừng sau 30 giây không có pointer/keyboard/scroll/touch; hoạt động trở lại thì cộng tiếp.
- Flush khi section rời viewport, route đổi, tab ẩn hoặc `pagehide`; gửi bằng `sendBeacon` khi phù hợp.
- Client gom delta, server dedupe bằng `event_id`; không bắn event mỗi giây.
- `section_engaged` mặc định ở 5 giây active; ngưỡng là cấu hình có version.
- Scroll depth chỉ ghi mốc lần đầu trong một page view; trang quá ngắn không tạo số liệu giả.
- Không ghi raw tọa độ con trỏ, nội dung người dùng gõ, DOM snapshot hoặc session replay ở giai đoạn đầu.

---

## 5. Hợp đồng dữ liệu tối thiểu

Mọi event có envelope:

| Trường | Quy tắc |
|---|---|
| `event_id` | UUID do client/server sinh, unique để chống gửi lặp |
| `event_name` / `schema_version` | tên semantic + phiên bản integer |
| `occurred_at` / `received_at` | thời gian client và server để nhận diện event muộn |
| `anonymous_id` | random first-party ID; xoay được; không fingerprint |
| `session_id` / `page_view_id` | scope phiên và page view |
| `customer_profile_id` | nullable; server resolve, client không tự tuyên bố |
| `journey_id` / `order_id` / `ticket_id` | nullable, chỉ gắn khi quan hệ tồn tại thật |
| `source_context` | UTM, QR, referrer, partner; chuẩn hoá và giữ first/last touch riêng |
| `consent_snapshot` | version trạng thái consent áp dụng tại lúc event được nhận |
| `properties` | JSON schema whitelist theo từng event; reject trường lạ nhạy cảm |

Nguồn sự thật dự kiến:

- `customer_profiles`: profile ẩn danh/có danh, trạng thái hợp nhất.
- `customer_identities`: phone/email đã chuẩn hoá, bảo vệ riêng.
- `customer_consents`: lịch sử consent append-only theo purpose.
- `customer_sessions`: phiên first-party và attribution đầu/cuối.
- `customer_events`: timeline raw append-only, partition/retention sẵn sàng.
- `customer_journeys`: liên kết plan, order, ticket và visit thành một hành trình.
- `marketing_sources` / `marketing_campaigns` / `marketing_touchpoints`: chuẩn hoá nguồn đa kênh.
- `customer_segments` / `customer_recommendations`: dữ liệu suy ra, luôn có rule/model version.

Tên bảng cuối cùng được khóa ở CUS-01 sau khi viết migration contract. Không đổi hay `alter` bảng ERP hiện có trong CUS-01.

---

## 6. Phân loại dữ liệu, consent và retention

| Lớp | Ví dụ | Xử lý |
|---|---|---|
| Public/config | campaign code, service ID, section ID | Có thể dùng rộng trong analytics |
| Pseudonymous behavior | anonymous ID, session, page/section/click | First-party; retention mặc định đề xuất 13 tháng; có cơ chế opt-out |
| Service data | order, ticket, visit date, contact để gửi vé | Chỉ dùng để thực hiện giao dịch/chăm sóc liên quan; retention theo nghĩa vụ vận hành/kế toán được duyệt |
| Marketing consent data | opt-in purpose/channel/policy evidence | Append-only; rút consent phải chặn activation tiếp theo |
| Direct PII | phone, email, tên | Kho identity riêng; mã hoá/che log; RBAC; không nằm trong event properties |
| Sensitive/free text | prompt raw, ghi chú sức khoẻ, trẻ em | Không thu mặc định; nếu nghiệp vụ bắt buộc phải có purpose và chính sách riêng |

Ba consent không được gộp:

1. `essential_service` — xử lý để dựng/lưu/gửi hành trình, vé hoặc đơn.
2. `product_analytics` — đo hành vi first-party; cần cơ chế chính sách/opt-out theo quyết định pháp lý.
3. `marketing_communications` — nhận quảng bá theo từng channel; mặc định off.

`booking_contacts.consent_at` hiện có không được tái diễn giải thành marketing consent.

---

## 7. Kết nối marketing đa kênh

### Thứ tự kết nối

1. **Owned first-party:** UTM/referrer, QR động, form lưu/gửi lịch trình, booking/ticket/check-in.
2. **Paid media:** import campaign/ad/adset và cost; click ID chỉ lưu khi được phép.
3. **CRM/messaging:** outbound request + delivery/outcome + unsubscribe.
4. **Đối tác/đại lý:** source/partner code và order referral.

Mỗi connector phải có:

- `external_event_id` hoặc idempotency key;
- mapping version từ payload ngoài sang taxonomy nội bộ;
- cursor/checkpoint, retry có backoff và dead-letter;
- timestamp của nguồn và timestamp nhận;
- audit ai cấu hình connector;
- secret ở server, không xuất sang trình duyệt;
- reconciliation report: nhận bao nhiêu, hợp lệ, trùng, lỗi, muộn.

Không chọn nhà cung cấp CRM/CDP ở CUS-00. Customer 360 trong Postgres là nguồn trung tâm; HubSpot/PostHog/Meta/Google/Zalo hoặc hệ khác là adapter thay thế được, không được trở thành nơi duy nhất giữ lịch sử khách.

---

## 8. Recommendation cho marketing và bán dịch vụ

Làm rule-based trước để giải thích được vì sao hệ thống gợi ý:

| Tín hiệu | Gợi ý ví dụ | Guardrail |
|---|---|---|
| Xem lâu điểm đến + ngân sách phù hợp | gói tuyến liên quan | cần `recommendation_shown` trước khi tính click |
| Nhóm có trẻ em / pace chậm do khách tự chọn | dịch vụ ít di chuyển, khung giờ phù hợp | không suy diễn tuổi/sức khoẻ từ hành vi |
| Khung giờ gần đầy | giờ thay thế hoặc dịch vụ chờ | đọc T11a, không bịa tồn kho |
| Có vé nhưng chưa chọn dịch vụ phụ | add-on trước chuyến đi | chỉ gửi ngoài web khi có marketing consent |
| Đã check-in | dịch vụ tại chỗ/hậu chuyến | giới hạn tần suất; không spam |

Mỗi rule có `rule_version`, `reason_code`, thời hạn hiệu lực và người phê duyệt. ERP phải cho thấy “vì sao gợi ý”, số lần shown/clicked/accepted và doanh thu thật; không dùng nhãn “AI” nếu chỉ là rule.

---

## 9. Các phase thi hành, model khuyến nghị và gate

**Quy tắc bàn giao model:** trước khi bắt đầu mỗi phase, phải ghi model/mức reasoning khuyến nghị vào `docs/HANDOFF.md` và báo cho chủ dự án. Nếu phiên đang chạy không tự đổi model được, dừng ở ranh giới phase để chủ dự án đổi thủ công. Không đổi giữa chừng khi migration hoặc transaction test đang dở.

| Phase | Model khuyến nghị | Mục tiêu | Đầu ra chính | Gate trước khi push |
|---|---|---|---|---|
| **CUS-00** | **5.6 Terra / Medium** | Khóa baseline, KPI, taxonomy, privacy và thứ tự | Tài liệu này + HANDOFF | diff sạch, dẫn chứng source/deploy, không tuyên bố code đã có |
| **CUS-01 — code hoàn tất 18/08** | **5.6 Sol / High** | Identity, consent và event backbone | migration + contract tests + server ingestion API | ✅ RLS/grant; idempotency; PII guard; consent tách biệt; PostgreSQL transaction test. Chưa apply Supabase production |
| **CUS-02 — code hoàn tất 18/08** | **5.6 Terra / High** | Thu hành vi web | SDK first-party + section/dwell/scroll/click + source context | ✅ unit + Playwright desktop/mobile; consent gate; `sendBeacon` khi rời/trang điều hướng. Chưa bật production |
| **CUS-03 — code hoàn tất 18/08** | **5.6 Terra / High**; nâng **Sol / High** nếu chạm RLS | Lưu intent `/plan` và Customer 360 ERP | anonymous journey persistence + timeline/profile view | ✅ migration 040 + RPC/idempotency/PII/RBAC; PostgreSQL 15 thật và full gate pass. Staged: 039/040/flags chưa bật production |
| **CUS-04 — code hoàn tất 18/08** | **5.6 Terra / High** | QR động và attribution | `/q/[code]`, campaign/source admin, first/last touch | ✅ migration 041 + RLS/RPC/append-only scan/audit; PostgreSQL 15 thật; route/UI/test staged. Chưa apply/bật production |
| **CUS-05 — code hoàn tất 18/08** | **5.6 Sol / High** | Progressive identity và CRM | lưu/gửi hành trình, contact vault, consent UI, segmentation | ✅ essential ≠ marketing; revoke; masking/RBAC/audit; staged, chưa bật production |
| **CUS-06 — code hoàn tất 20/08** | **5.6 Sol / High** | Gói A booking trên lõi ERP | slot/order/hold/payment giả lập/issue T8 ticket | ✅ PostgreSQL concurrency không oversell; shared slot theo site+giờ; T11a là nguồn công suất; phát vé T8; không alter lõi ERP. Staged, chưa bật production |
| **CUS-07 — code hoàn tất 20/08** | **5.6 Terra / High**; nâng **Sol / High** cho outbound thật | Recommendation + omnichannel adapters | rule engine, ERP action queue, connector contract | ✅ explainable/versioned; consent fail-closed; frequency cap; idempotent queue mô phỏng. Chưa outbound/live |
| **CUS-08 — code hoàn tất 20/08** | **5.6 Sol / High** | Offline gate + unified funnel + staged release | A3 scan offline, dashboard xuyên nguồn, full acceptance | ✅ PostgreSQL exactly-once/replay + Playwright offline + funnel fixture + full local gate. ⏸ Production apply/flags/smoke chờ đầu vào |

**Luna chỉ dùng cho việc cơ học đã khóa contract** như đổi tên hàng loạt, dựng fixture, cập nhật copy hoặc bổ sung test lặp; không giao Luna tự quyết migration, RLS, identity merge, consent, concurrency, offline reconciliation hay release gate.

Mỗi phase hoàn chỉnh phải: cập nhật `docs/HANDOFF.md`, commit riêng, push `main`, ghi SHA và cái chưa chứng minh. Khi chuyển phase phải báo lại model khuyến nghị trước khi viết code.

---

## 10. Definition of Ready cho CUS-01

CUS-01 được phép bắt đầu vì các quyết định kỹ thuật sau đã khóa:

- Data-first/customer behavior/omnichannel là ưu tiên đã được chủ dự án duyệt.
- T8 là chuẩn vé; T11a là chuẩn công suất; không tạo nguồn thứ hai.
- Anonymous-first, progressive identity, không fingerprint.
- Essential service và marketing consent tách riêng.
- Event đi server-side, raw append-only, derived data có version.
- CUS-01 chỉ tạo backbone và dữ liệu giả lập; chưa gửi/thu contact người thật.

Các đầu vào khách hàng còn thiếu **không chặn CUS-01/CUS-02 với dữ liệu giả lập**, nhưng chặn production có người thật:

1. Pháp nhân kiểm soát/xử lý dữ liệu, nơi lưu trữ và thời hạn retention được duyệt.
2. Chủ sở hữu vận hành, người được xem PII, SLA xử lý yêu cầu xóa/export.
3. Nội dung/policy consent và kênh marketing được phép.
4. Thẩm quyền bán vé, ngày vận hành, payment provider thật.
5. Báo cáo chiến lược gốc chưa có trong repo để đối chiếu toàn văn.

---

## 11. Kết luận CUS-00

**PASS cho baseline và thiết kế đo lường; chưa có tính năng customer analytics production nào được tuyên bố hoàn thành.**

Gate cục bộ ngày 18/08/2026 trên source nền hiện hành:

- `npm run typecheck`: pass.
- `npm run lint`: pass.
- `npm run test:run`: 69 file pass, 1 file skip; 491 test pass, 1 test skip có chủ đích.
- `npm run build`: pass; Next.js dựng đủ 34/34 static page và hoàn tất route manifest.
- `git diff --check`: pass.

`npm ci` báo 7 advisory trong dependency tree (4 moderate, 3 high). CUS-00 không tự chạy `npm audit fix` vì nâng dependency nằm ngoài phase và phải được kiểm chứng riêng; advisory này không được coi là đã xử lý.

CUS-01 đã được thực hiện sau baseline này; việc kế tiếp là CUS-02 gắn collector vào web. Thứ tự đó quan trọng: nếu gắn click/dwell trước khi có schema, consent và idempotency thì chỉ tạo một đống log không thể tin cậy hoặc sử dụng an toàn.

---

## 12. Kết quả CUS-01 — code hoàn tất, chờ apply production

Đã xây:

- migration `202608180039_customer_data_backbone.sql` với 5 bảng production-shaped: profile ẩn danh, identity digest+ciphertext, consent history, session và event;
- ba RPC chỉ `service_role`: ingest event, nối identity đã mã hóa, ghi consent;
- event/session idempotency và collision guard; event/consent/identity history append-only;
- PII guard đệ quy ở cả TypeScript và PostgreSQL; event properties/source dùng whitelist;
- endpoint same-origin `/api/customer-events`, giới hạn 32 KiB, fail closed khi `CUSTOMER_DATA_INGESTION_ENABLED` chưa bằng `true`;
- 22 bài targeted mới cho migration/domain/API và câu tiếng Việt cho toàn bộ mã từ chối mới.

Bằng chứng 18/08/2026:

- PostgreSQL 15 thật: migration apply sạch; transaction test trả lần đầu `inserted=true`, gửi lại cùng payload `false`; direct insert, PII và sửa history đều bị chặn; identity/consent round-trip pass; toàn bộ rollback, không để dữ liệu.
- Hai lỗi chỉ lộ khi chạy PostgreSQL thật đã được bắt và sửa: không được schema-qualify SQL construct `greatest`, và output parameter `event_id` làm `on conflict (event_id)` mơ hồ.
- `npm run typecheck`: pass; `npm run lint`: pass; Vitest 72 file/513 test pass, 1 file/1 test skip có chủ đích; `npm run build`: pass, có route `/api/customer-events`.

**Chưa chứng minh:** migration 039 chưa apply/verify trên Supabase production; endpoint chưa bật và chưa có collector web, nên production chưa thu event khách. Đây là staged release có chủ đích, không phải customer analytics đã live.

**Ranh giới model tiếp theo:** trước khi làm CUS-02, chuyển sang **5.6 Terra / High**. CUS-02 là instrumentation web và browser lifecycle; chỉ nâng lại Sol nếu phát sinh thay đổi schema/RLS ngoài contract CUS-01.

---

## 13. Kết quả CUS-02 — code hoàn tất, chưa bật production

Đã xây:

- `CustomerBehaviorTracker` ở root layout, chỉ xét các route khách công khai; ERP, `/ops` và route nội bộ bị loại từ đầu.
- Ghi `page_viewed`, `section_viewed` (≥1 giây), `section_engaged` (≥5 giây active), mốc scroll 25/50/75/90 và `content_clicked` trên CTA có semantic ID.
- Active dwell chỉ cộng khi section ≥50% visible, tab đang visible/focus và người dùng còn hoạt động trong 30 giây; không ghi raw pointer, form field, prompt, referrer URL hoặc session replay.
- Attribution chỉ giữ whitelist UTM/QR/campaign/partner/click ID đã kiểm PII và `referrer_class`; `source` cũ được ánh xạ vào `utm_source` nếu an toàn.
- Consent gate kép: public build flag `NEXT_PUBLIC_CUSTOMER_ANALYTICS_ENABLED=true` **và** consent local có `product_analytics=granted`; thiếu một trong hai thì tracker không tạo ID và không gửi request.
- CTA điều hướng gửi bằng `sendBeacon`; event còn lại dùng `fetch(..., keepalive: true)`. Mọi event vẫn đi qua API CUS-01 và idempotency server-side.

Bằng chứng 18/08/2026:

- Unit test cho route scope, attribution whitelist/PII và consent parser pass.
- Playwright với build flag chỉ bật trong test, API intercept (không ghi Supabase): desktop + Pixel 7 đều pass hai case: không consent = 0 request; có consent = page/section/active dwell/scroll/CTA payload đúng.
- Full gate: `typecheck`, `lint`, `build` pass; Vitest 73 file/517 test pass, 1 file/1 test skip có chủ đích. Static build vẫn dựng 35/35 page.
- Hai lỗi browser/build thật đã bắt và sửa: tracker dùng `useSearchParams` phải ở `Suspense` riêng để không phá static destination page; CTA handler phải được đăng ký capture-phase trước navigation, và link dùng `sendBeacon` để event không bị hủy lúc đổi trang.

**Chưa live:** cả `NEXT_PUBLIC_CUSTOMER_ANALYTICS_ENABLED` lẫn `CUSTOMER_DATA_INGESTION_ENABLED` phải giữ tắt trên production. Consent đang là contract local để test collector; CUS-05 sẽ thay bằng consent UI + history server-side. CUS-01 migration 039 vẫn chưa apply/verify Supabase production.

**Ranh giới model tiếp theo:** trước CUS-03, dùng **5.6 Terra / High**. CUS-03 lưu anonymous intent `/plan` và dựng Customer 360; nâng lại **Sol / High** nếu cần thay đổi migration/RLS hoặc hợp đồng identity/consent đã khóa.

---

## 14. Kết quả CUS-03 — code hoàn tất, chưa bật production

Đã xây:

- migration `202608180040_customer_anonymous_journeys.sql`: `customer_journeys` append-only, liên kết `(profile_id, tenant_id)` với profile anonymous-first CUS-01; summary/source/itinerary đều bị PII guard và giới hạn kích thước;
- RPC `customer_create_anonymous_journey` chỉ cho `service_role`, tạo/tái dùng anonymous profile, idempotent khi gửi lại đúng cùng journey ID và từ chối collision;
- `/api/journeys` giữ nguyên demo room cũ; visitor thường chỉ được persist khi `CUSTOMER_JOURNEY_PERSISTENCE_ENABLED=true` **và** request same-origin. Chỉ gửi summary cấu trúc, itinerary snapshot và attribution whitelist — không gửi raw prompt, contact hay lý do tự do;
- cookie `nbj-customer-journey-anonymous-id` HttpOnly/SameSite=Lax để các bản tạo tiếp theo nối cùng profile; CUS-03 cố ý chưa ghi đè bản gốc khi khách sửa browser, vì chưa có revision contract;
- `/erp/khach-hang` và nav chỉ xuất hiện cho `director`; Customer 360 đọc từ `customer_journeys` + `customer_events`, nêu rõ khi kho tắt/rỗng thay vì hiển thị số minh họa.

Bằng chứng 18/08/2026:

- PostgreSQL 15 tạm với vai trò Supabase tương đương: apply lần lượt 039 + 040 sạch; RPC lần đầu `inserted=true`, cùng payload trả `false`; PII, update append-only và direct insert dưới `service_role` bị chặn. Container test đã xóa, không để dữ liệu.
- Targeted domain/API/migration contract pass; full `typecheck`, `lint`, `test:run` = 76 file/528 test pass + 1 skip có chủ đích; `build` 35/35 routes, gồm `/erp/khach-hang`; Playwright `/plan` 6/6 pass trên desktop/mobile.
- Full regression bắt một thiếu sót thật: 4 mã lỗi RPC CUS-03 chưa có câu tiếng Việt chung. Đã bổ sung vào `rpc-error-messages.ts` trước khi rerun gate.

**Chưa live:** không apply migration 039/040 hay bật `CUSTOMER_DATA_INGESTION_ENABLED`, `NEXT_PUBLIC_CUSTOMER_ANALYTICS_ENABLED`, `CUSTOMER_JOURNEY_PERSISTENCE_ENABLED` trên production. Do đó không có dữ liệu khách thật được thu hay hiện. CUS-04 tiếp tục bằng **5.6 Terra / High**; chỉ nâng **Sol / High** nếu cần sửa RLS/RPC/identity-consent contract đã khóa.

---

## 15. Kết quả CUS-04 — code hoàn tất, chưa bật production

Đã xây:

- migration `202608180041_marketing_dynamic_qr.sql`: campaign/source registry, scan tổng hợp append-only và audit append-only. Bốn bảng bật RLS; direct table write bị chặn, RPC chỉ `service_role`;
- `/q/[code]` chỉ hoạt động khi `CUSTOMER_QR_ROUTING_ENABLED=true`; QR chỉ redirect tới path nội bộ đã kiểm tra. URL attribution dùng code công khai thay UUID, không nhận contact, IP, cookie hay referrer. Routing tắt trả 404, không resolve và không ghi scan;
- `/erp/marketing` chỉ cho director: tạo campaign/QR, xem scan thực và đổi destination bằng optimistic version lock. Không có dữ liệu minh họa;
- `CustomerBehaviorTracker` chỉ tạo `qr_opened` sau analytics consent hiện hữu và chỉ chứa code công khai + destination path.

Bằng chứng 18/08/2026:

- PostgreSQL 15 tạm apply sạch 039 + 040 + 041; tạo campaign/QR, resolve để ghi scan, đổi đích, stale version, external destination và direct `service_role` write đều được kiểm tra. Container đã xóa, không để dữ liệu.
- Full `typecheck`, `lint`, `test:run` = 81 file/541 test pass + 1 skip có chủ đích; `build` 35/35 routes gồm `/q/[code]` và `/erp/marketing`; Playwright tracking desktop/mobile 6/6 pass.

**Chưa live:** migration 039/040/041 chưa apply/verify Supabase production; `CUSTOMER_DATA_INGESTION_ENABLED`, `NEXT_PUBLIC_CUSTOMER_ANALYTICS_ENABLED`, `CUSTOMER_JOURNEY_PERSISTENCE_ENABLED` và `CUSTOMER_QR_ROUTING_ENABLED` đều tắt. Máy hiện tại không có Supabase CLI hay linked-project metadata nên không được đoán đích apply. CUS-05 chuyển sang **5.6 Sol / High** để nối consent UI/history server-side và contact vault.

---

## 16. Kết quả CUS-05 — code hoàn tất, policy Xuân Trường ở trạng thái staged

Đã xây:

- migration `202608180042_customer_progressive_identity.sql`: thứ tự consent tất định bằng `sequence_no`, delivery request append-only, segment có phiên bản, audit identity/Customer 360 và các RPC chỉ `service_role`;
- consent center server-side cho analytics và marketing độc lập; collector chỉ bắt đầu sau analytics grant, còn revoke marketing làm segment `marketing-reachable` mất hiệu lực ngay;
- contact vault nhận đúng một email hoặc số điện thoại, chuẩn hóa rồi lưu HMAC digest + AES-256-GCM ciphertext; không có API/UI giải mã;
- progressive identity nối anonymous journey với protected contact, chỉ auto-merge profile anonymous vào profile đã nhận diện có cùng digest; xung đột profile đã nhận diện phải review thủ công;
- yêu cầu nhận hành trình chỉ ở trạng thái `staged`, không tuyên bố đã gửi email/SMS; marketing mặc định tắt và tách khỏi essential service;
- `/erp/khach-hang` director-only hiển thị loại contact, consent, segment và delivery status; mỗi lần đọc được audit ở PostgreSQL;
- `/quyen-rieng-tu` ghi Xuân Trường là pháp nhân vận hành/đơn vị kiểm soát dữ liệu của bản dự thảo, nêu thời hạn 13 tháng / 90 ngày sau ngày đi / tới revoke hoặc 24 tháng không tương tác, đồng thời nói rõ chưa phải policy pháp lý được duyệt để mở production.

Bằng chứng 18/08/2026:

- PostgreSQL 15 thật apply sạch 039 + 040 + 042; transaction test xác minh grant/revoke, protected contact, segment deactivation, delivery request và director audit gate; container đã xóa, không để dữ liệu;
- full `typecheck`, `lint`, `test:run` = 85 file/558 test pass + 1 skip có chủ đích; `build` pass và tạo đủ route `/api/customer-consents`, `/api/customer-contact`, `/quyen-rieng-tu`;
- Playwright CUS-05 desktop + Pixel 7 = 6/6; hồi quy CUS-02 tracker + CUS-03 planner = 12/12. Ảnh desktop/mobile reduced-motion đã kiểm trực tiếp, không có horizontal overflow;
- PostgreSQL thật bắt hai lỗi contract trước commit: conflict target mơ hồ và nhiều consent cùng transaction có `now()` giống nhau. Đã sửa bằng named constraint và `sequence_no` identity để latest-state không phụ thuộc timestamp hòa.

**Chưa live:** migration 039–042 và sáu cờ customer-data vẫn tắt trên production. Không bật cho tới khi linked Supabase project được xác minh, khóa mã hóa/HMAC production được cấp, ba policy version được đóng và Xuân Trường phê duyệt đầu mối + SLA cho yêu cầu xem/xuất/sửa/xóa dữ liệu. Việc nêu pháp nhân chưa đồng nghĩa policy đã được pháp chế phê duyệt.

**Ranh giới model tiếp theo:** CUS-06 dùng **5.6 Sol / High** vì phải xử lý slot/order/hold/payment concurrency và nối T8/T11a trong lõi ERP. Chỉ hạ Terra cho phần UI/fixture sau khi contract giao dịch được khóa; không dùng Luna để quyết định schema, concurrency hay accounting boundary.

---

## 17. Kết quả CUS-06 — booking Gói A trên lõi ERP

### Nền bắt buộc tái sử dụng

- `erp_capacity_thresholds` T11a là nguồn công suất. Slot bán chỉ được tạo từ `hourly_capacity`, threshold/version/source đang hiệu lực; không có form nhập một con số capacity song song.
- `erp_tickets` T8 là vé duy nhất tại cổng. Sau payment mô phỏng thành công, CUS-06 insert vé `channel = 'website'` và giữ bảng bridge order → ticket; không tạo một pass/check-in engine cạnh tranh.
- `customer_profiles`/cookie anonymous-first của CUS-01→05 là chủ thể đơn. Không ghi raw contact vào order, event hoặc ticket; hồ sơ đã có protected contact thì Customer 360 tự nối qua canonical profile.
- `products` + `product_sites` của catalog hiện hữu được đọc làm sản phẩm/điểm phục vụ. `bookings`/`capacity_slots`/`payment_intents` cũ chỉ là thiết kế demo phụ thuộc `demo_run_id`, không được dùng làm kho production mới.

### Contract đã xây

1. Quote phải tạo **hold thật có hạn** dưới row lock, không chỉ đọc capacity rồi hứa chỗ. Mỗi retry cùng idempotency key trả đúng hold cũ; payload khác dùng cùng key phải bị từ chối.
2. Sức chứa khả dụng = snapshot T11a trừ các hold chưa hết hạn và số khách đã xác nhận trong đúng site/khung giờ. Hai transaction cạnh tranh không được cùng lấy chỗ cuối.
3. Một package chỉ giữ capacity tại các `product_sites` có threshold T11a. Điểm nội dung không có threshold vẫn nằm trong hành trình nhưng không được bịa là đã kiểm soát sức chứa.
4. Payment CUS-06 chỉ có `simulation`; UI phải nói rõ không thu tiền, không nhận số thẻ/tài khoản. Callback/retry idempotent; hold hết hạn không được phát vé.
5. Payment thành công tạo order/line/audit, chuyển hold thành `converted`, rồi phát một vé T8 cho mỗi site có capacity trong package. Vé nhóm dùng `entries_allowed = party_size`, không lưu raw contact/name vào T8.
6. Mọi bảng CUS-06 bật RLS, direct write bị thu hồi; chỉ RPC `service_role` được ghi. Production flag mặc định tắt và migration chưa apply cho tới khi linked project được xác minh.

### Gate trước khi gọi CUS-06 hoàn tất

- PostgreSQL transaction test thật: idempotency, payload collision, hold expiry, payment replay và direct-write denial.
- Concurrency test thật chứng minh hai hold tranh chỗ cuối chỉ một hold thành công; tổng active hold + confirmed không vượt snapshot T11a.
- Ticket T8 được phát đúng site/party size và cổng T8 đọc được; không sửa schema/lifecycle của T8/T11a.
- UI desktop/mobile nói đúng payment mô phỏng, không cần phòng demo và không thu raw PII.
- Typecheck, lint, Vitest, build và Playwright luồng booking pass; cập nhật HANDOFF, commit phase riêng và push `main`.

### Bằng chứng 20/08/2026

- Migration 043 đã apply thật trên PostgreSQL 17 cô lập cùng core/T8/T11a/039/040/042. Hold và payment retry trả bản ghi cũ; collision bị từ chối; hold hết hạn không tạo payment/vé; role `anon` không direct-write được.
- Shared slot khóa theo `(tenant_id, site_id, starts_at)`, không theo product. Bài race hai package cùng dùng Tràng An, threshold 3 và mỗi hold 2 khách cho kết quả một thành công + một `CUSTOMER_CAPACITY_UNAVAILABLE`; reserved cuối là 2/3.
- Payment mô phỏng phát đúng vé T8 `channel='website'`, `product='group'`, `entries_allowed=party_size`; RPC cổng T8 đọc được vé. Không có `alter table` lên `erp_tickets` hoặc `erp_capacity_thresholds`.
- Checkout anonymous-first không nhận raw contact/payment credential; Customer 360 đọc order/payment/vé theo canonical profile. Playwright desktop/mobile 2/2; public regression với flag mặc định tắt 28/28.
- Typecheck, lint, 88 file/569 Vitest pass + 1 skip, production build 40 route pass. PostgreSQL cluster tạm đã dừng và xóa.

**Chưa live:** 039–043 chưa apply/verify Supabase production; `CUSTOMER_BOOKING_ENABLED` mặc định tắt. Template giờ bán còn mang nhãn `catalog-staged` và cần Xuân Trường duyệt. Không mở flag trước linked-project verification, production secrets và policy approval.

---

## 18. Kết quả CUS-07 — recommendation và omnichannel staged

- Đã thực hiện bằng **5.6 Terra / High** cho rule explainable, UI và adapter contract. Phải chuyển **5.6 Sol / High trước khi** mở outbound thật, secret handling, provider retry/dead-letter hoặc opt-out xuyên kênh.
- Tái sử dụng Customer 360, consent/segment versioned và order/ticket CUS-06; không dựng profile, contact list hay marketing consent thứ hai.
- Đã có recommendation reason code/rule version, ERP action queue, adapter contract, frequency cap, consent fail-closed và idempotency. Queue chỉ staged/suppressed, không gửi thật.
- Chưa gửi email/SMS/Zalo thật khi chưa có provider, credential, sender identity và phê duyệt policy của Xuân Trường. Fixture/test có thể mô phỏng adapter nhưng UI phải ghi rõ.

---

## 19. Kết quả CUS-08 — offline gate, unified funnel và ranh giới release

### A3 — cổng offline trên cùng nguồn vé T8

- `erp_prepare_offline_gate_manifest` chỉ trả SHA-256 ticket-code digest và số lượt còn lại cho đúng site/ca/thiết bị; không preload PII.
- Browser giữ manifest + raw code cần sync trong IndexedDB cục bộ. Scan offline được ghi durable với UUID idempotency; quyết định local là tạm thời và tự sync tối đa 200 item khi mạng trở lại.
- `erp_gate_scan_ticket_at` là decision helper dùng chung cho online và offline. Server khóa row `erp_tickets`, ghi refusal như accepted, chống collision và trả receipt local/server `matched` hoặc `diverged`.
- Batch dùng advisory lock + batch UUID ổn định. Nếu server đã commit nhưng response mất, retry trả đúng receipt cũ; không tăng entry lần hai và client xóa được pending.

### A5 — funnel không bịa số

- `/erp/marketing` đọc campaign/QR scan, page event, journey source, hold, payment, order-ticket bridge, gate event, slot T11a và offline reconciliation hiện hữu.
- Funnel hiển thị QR → page → hold → payment → check-in theo source/campaign; nguồn không khớp để riêng, không gán đoán.
- Mỗi slot hiển thị capacity snapshot, `capacity_source_kind`, threshold version, reserved, sold và checked-in. Hold cũ đã converted vẫn tính sold cho slot, nhưng chỉ hold phát sinh trong cửa sổ mới tính vào funnel kỳ.

### Gate đã chạy ngày 20/08/2026

- `npm run typecheck`, `npm run lint`, full Vitest **589 pass + 1 skip**, `npm run build`: pass.
- Playwright desktop A3: offline queue, reconnect auto-sync, lost response, stable retry và zero pending: **1/1 pass**.
- PostgreSQL 17 thật: migration apply; manifest no-PII; exactly-once; batch replay trả đủ receipt; divergence/idempotency/append-only contract pass. Cluster test đã xóa.
- Funnel repository fixture chứng minh số theo source và slot khớp input, gồm hold converted ngoài kỳ vẫn tính sold.

### Chưa được phép gọi là live/A6 hoàn tất

- Migration 039–045 chưa apply/verify trên linked Supabase production.
- `ERP_OFFLINE_GATE_ENABLED`, `CUSTOMER_FUNNEL_DASHBOARD_ENABLED` và toàn bộ customer-data/booking/recommendation flags giữ tắt.
- Chưa có production smoke A3/A5. Trước activation cần linked project, backup/rollback, secrets, policy/version Xuân Trường, lịch bán/capacity được duyệt và kế hoạch canary tại một cổng. Chỉ sau apply tuần tự + smoke + nghiệm thu người dùng mới đóng A6.

---

## 20. A6 go-live readiness — activation gate trước production

Model: **5.6 Sol / High**. Không hạ Terra/Luna khi còn quyết định migration order, production identity, secrets, rollback hoặc canary.

### Gate đã xây

- `/erp/release` chỉ director mở được; chỉ đọc HEAD contract của 29 bảng thuộc migration 039–045, không tạo event/manifest/receipt và không hiển thị giá trị secret.
- Environment gate kiểm đúng Vercel production project/origin, experience mode, Supabase public/server config, `ERP_PERSISTENCE_MODE=supabase`, ba policy version không còn draft/staged và contact protection key contract.
- Flag gate mã hóa thứ tự ingestion → journey/QR → consent/analytics/identity → booking → recommendation/funnel; offline gate bắt buộc ERP persistence + schema 045. Flag bật khi dependency/schema thiếu bị liệt kê là unsafe.
- `release:assert-project` chặn local Vercel link khác `goldencard/ninhbinhjourney`; `release:preflight` bắt project guard chạy trước full verify.
- Production smoke chỉ đọc bắt buộc URL + expectation tường minh; không được chạy thiếu `PLAYWRIGHT_BASE_URL` rồi suy nhầm local là production.
- Local gate: `release:preflight` pass trọn gói với đúng Vercel project; typecheck/lint/build pass; 595 Vitest pass + 1 skip; Playwright A6 desktop/mobile 4/4 pass. Commit A6 `48d48b3` đã push/deploy; production smoke read-only với expectation `blocked` pass 1/1 và xác nhận gate trả `CHƯA ĐƯỢC BẬT PRODUCTION`.

### Trạng thái đầu vào thật ngày 20/08

- GitHub `app-origin/main` có CUS-08 và production đã thấy offline API route; không có bằng chứng migration 039–045 đã apply.
- Worktree chưa có Supabase CLI/linked-project metadata. Vercel CLI auto-detect từng tạo nhầm project rỗng `codex-cus00-app-sync`; đã xóa link sai, sau đó đối chiếu metadata checkout gốc và guard hiện pass đúng project `goldencard/ninhbinhjourney`.
- Production health đang `experienceMode=client-demo`; policy/key/lịch bán/capacity/provider approval chưa được xác minh. Vì vậy verdict đúng hiện tại là **BLOCKED**, không phải lỗi của gate.

### Trình tự activation bắt buộc

1. ✅ Đã link rõ project `goldencard/ninhbinhjourney`, project guard pass và production route xác nhận deployment source từ commit A6.
2. Xác minh linked Supabase production + backup/rollback; dry-run rồi apply tuần tự 039→045, không bỏ số.
3. Probe `/erp/release` tới khi 7 phase schema xanh nhưng flags vẫn OFF.
4. Cấu hình secrets/policy/version/lịch bán được Xuân Trường duyệt; chuyển experience mode production và redeploy.
5. Bật canary theo dependency, một lớp mỗi lần; chạy smoke read-only trước, sau đó workflow có cleanup/rollback riêng.
6. Canary offline tại một cổng/thiết bị; đối chiếu batch divergence trước khi mở rộng. Chỉ sau nghiệm thu người dùng mới đóng A6.
