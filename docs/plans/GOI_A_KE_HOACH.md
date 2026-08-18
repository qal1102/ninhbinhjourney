# GÓI A — KẾ HOẠCH DỮ LIỆU KHÁCH HÀNG, MARKETING VÀ BÁN DỊCH VỤ

> **Trạng thái: CUS-00/A0 ĐÃ ĐÓNG NGÀY 18/08/2026 — kế hoạch và hợp đồng đo lường đã được chủ dự án duyệt hướng ưu tiên.**
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
| **CUS-03** | **5.6 Terra / High**; nâng **Sol / High** nếu chạm RLS | Lưu intent `/plan` và Customer 360 ERP | anonymous journey persistence + timeline/profile view | ordinary visitor persist được; ERP RBAC; không cần contact; số có provenance |
| **CUS-04** | **5.6 Terra / High** | QR động và attribution | `/q/[code]`, campaign/source admin, first/last touch | redirect/đổi đích/dedupe; source sống qua route; không open redirect |
| **CUS-05** | **5.6 Sol / High** | Progressive identity và CRM | lưu/gửi hành trình, contact vault, consent UI, segmentation | essential ≠ marketing; revoke test; masking/RBAC/audit |
| **CUS-06** | **5.6 Sol / High** | Gói A booking trên lõi ERP | slot/order/hold/payment giả lập/issue T8 ticket | concurrency không oversell; T11a là nguồn công suất; không alter lõi ERP |
| **CUS-07** | **5.6 Terra / High**; nâng **Sol / High** cho outbound consent/security | Recommendation + omnichannel adapters | rule engine, ERP action queue, connector contract | explainable; frequency cap; opt-out; idempotent outbound |
| **CUS-08** | **5.6 Sol / High** | Offline gate + unified funnel + release | A3 scan offline, dashboard xuyên nguồn, full acceptance | sync không mất/trùng; dashboard reconciliation; full regression + production smoke |

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
