# PHÂN GIAO VIỆC — THÍ ĐIỂM TAM CỐC (đợt TC)

> **Đọc file này là đủ để bắt tay làm một nhiệm vụ TC. Không cần đọc lại toàn bộ dự án.**
>
> - Hiện trạng thật của hệ thống: `docs/HANDOFF.md` — chỉ đọc khi cần kiểm chứng một tuyên bố cụ thể.
> - Việc đã làm trong đợt này: `docs/plans/NHAT_KY_THI_CONG.md` — đọc trước khi bắt đầu để biết ai đã chạm gì.
> - Đề bài gốc của khách: `docs/reference/PHIEU_GIAO_VIEC_01_GOI_A.md` + báo cáo chiến lược 11/08/2026 (4 infographic + 3 PDF chủ đầu tư gửi 25/08).
> - Luật giao diện: `docs/reference/UI_UX_RULES.md` (web công khai ở đầu file, **ERP Rules ở cuối file**).
> - Quyết định treo của chủ đầu tư: `docs/reference/CAC_DIEM_CAN_QUYET_DINH_TAM_COC.md`.
>
> **Lập ngày 26/08/2026** sau một lượt đọc toàn bộ repo: 49 migration / 21.880 dòng SQL, 124 bảng, 127 function, 161 policy, 55.370 dòng TypeScript, 133 file test. Mọi con số và tên cột trong file này đã được đọc từ mã nguồn thật, không suy từ tài liệu.

---

## 0. Bảng phân model — đọc trước khi viết dòng đầu tiên

Dự án trước dùng bí danh `5.6 Sol / Terra / Luna`. Từ đợt này gọi thẳng tên model đang chạy, giữ bí danh cũ để đọc được tài liệu cũ:

| Bí danh cũ | Model dùng từ nay | Giao việc gì |
|---|---|---|
| Sol | **Opus 5 / High** | Migration, RLS, policy, concurrency, khóa dòng, identity/consent, thanh toán, kích hoạt production, rollback, xóa dữ liệu. **Mọi thứ khó hoàn tác.** |
| Terra | **Sonnet 5** | UI/UX, instrumentation trình duyệt, repository khi hợp đồng đã khóa, viết test, copy tiếng Việt, khảo sát mã nguồn. |
| Luna | **Haiku 4.5** | Việc cơ học khi hợp đồng đã khóa: đổi tên hàng loạt, dựng fixture, thêm mã lỗi vào từ điển, chạy chụp ảnh, định dạng tài liệu. |

**Ba luật cứng về model:**

1. **Không đổi model giữa chừng một migration hoặc một transaction test đang dở.** Dừng ở ranh giới nhiệm vụ.
2. **Haiku không bao giờ tự quyết** schema, concurrency, consent, RLS, offline reconciliation hay release gate. Haiku chỉ thi hành hợp đồng đã có người khác khóa.
3. Nhiệm vụ ghi **hai model** (ví dụ `Opus 5 → Sonnet 5`) nghĩa là **tách hai lượt**: lượt một khóa hợp đồng dữ liệu, lượt hai làm giao diện. Không gộp.

---

## 1. Mười quyết định đã chốt trong đợt này

Chủ đầu tư gửi bộ tài liệu chiến lược 25/08 nhưng **các tài liệu đó mâu thuẫn nhau ở vài chỗ**, và 8 câu hỏi tại `CAC_DIEM_CAN_QUYET_DINH_TAM_COC.md` vẫn chưa có trả lời. File đó đã ghi sẵn cơ chế: *"nếu không có ý kiến khác, phía công nghệ triển khai theo phương án đề xuất."* Dưới đây là các quyết định áp dụng cơ chế đó. **Model sau không được tự đảo ngược; muốn đổi phải hỏi chủ dự án.**

### QĐ-01 — Định danh: giữ ẩn danh trước, KHÔNG thu CCCD/hộ chiếu

Tài liệu khách tự mâu thuẫn:
- Infographic *"Định danh – Check-in – Hàng chờ ảo"* đòi CCCD/hộ chiếu và *"Một giấy tờ = một vé hợp lệ trong cùng khung giờ"*.
- Báo cáo tổng thể mục 14, **quyết định lãnh đạo số 1**: *"không bắt buộc mọi khách cung cấp dữ liệu cá nhân"*; PDF chiến lược mục I: *"Bắt buộc dùng mã giao dịch, không nhất thiết bắt buộc khai đầy đủ danh tính."*

**Chốt: theo báo cáo tổng thể.** Lý do xếp theo sức nặng:
1. Báo cáo tổng thể là văn bản cấp quyết định lãnh đạo, infographic là bản tóm tắt trình bày.
2. Điểm 6 (pháp nhân xử lý dữ liệu) **chưa có trả lời** → thu giấy tờ tùy thân lúc này là thu dữ liệu nhạy cảm khi chưa có chủ thể chịu trách nhiệm. Vi phạm chính ràng buộc đang có hiệu lực.
3. `customer_events` có PII guard đệ quy ở **cả TypeScript lẫn PostgreSQL**; `customer_identities` chỉ lưu HMAC digest + AES-256-GCM ciphertext và **không có API/UI giải mã**. Đảo sang thu giấy tờ là phá hợp đồng của cả CUS-01 → CUS-05.

**Chống mua trùng làm bằng cách khác:** khóa duy nhất trên `(tenant_id, slot_id, contact_digest)` khi khách để lại liên hệ. Đủ chặn một số điện thoại mua hai vé cùng khung giờ, mà không thu giấy tờ. Khách không để lại liên hệ vẫn mua được — đúng tầng 1 Access của mô hình ba tầng.

### QĐ-02 — Công suất: mở rộng, không viết lại

Đã kiểm mã nguồn: logic MIN **đã chạy sẵn**. `202608200043` dòng 413 chọn ngưỡng bằng `order by threshold.hourly_capacity asc` → tự lấy điểm nghẽn nhỏ nhất. Bảng `erp_capacity_thresholds` đã có `bottleneck_name` và `bottleneck_kind`.

Thiếu đúng ba thứ, và **không cái nào cần viết lại kiến trúc**:

| Thiếu | Hiện trạng đã đọc | Chốt cách vá |
|---|---|---|
| Loại điểm nghẽn | `check (bottleneck_kind in ('boat-pier','ticket-gate','electric-shuttle'))` — đúng **3 loại**; khách cần ~10 | Nới `check`, thêm: `parking`, `waiting-area`, `cave-channel`, `drop-off`, `rescue`, `boat-crew` |
| Số ngưỡng thật | Seed chỉ **1 ngưỡng/cơ sở** (`TA-PIER-01`, `TC-PIER-01`, `TCO-PIER-01`, `BD-SHUTTLE-01`) → MIN của một phần tử | Nhập cấu hình qua màn hình T11a, **không seed bằng migration** |
| Hệ số an toàn | Không có. `hourly_capacity` là generated column `floor(vehicle_count × seats_per_vehicle × 60 / round_trip_minutes)` | Thêm `safety_factor numeric(4,3) default 1.000` |

**Một điểm kỹ thuật thật, đừng bỏ qua:** công thức vòng quay hợp với thuyền / xe điện / bến. **Không hợp** với bãi xe (số chỗ đỗ tĩnh), khu vực chờ (sức chứa đứng), cứu hộ (số người trực). Nhồi ba thứ đó vào `vehicle_count × seats × 60 / round_trip_minutes` là bịa số. → thêm `capacity_model text check (capacity_model in ('round-trip','static'))` và `static_capacity integer`, rồi tính `effective_capacity` từ đúng nhánh. Chi tiết ở TC-01.

### QĐ-03 — Khung giờ: phải bỏ khóa chính hiện tại

`customer_product_capacity_templates` có `primary key (tenant_id, product_id, site_id)` → **một sản phẩm chỉ có đúng một khung giờ tại một cơ sở**. Đây là chặn cứng ở tầng schema, không phải thiếu giao diện.

Nguyên tắc cứng số 1 của khách là *"một khách = một định danh + một vé + một khung giờ + một tuyến"*, số 2 là *"một khung giờ = một hạn mức cứng"*. Không bỏ khóa này thì không đạt được cả hai.

**Chốt:** đổi PK thành `(tenant_id, product_id, site_id, local_start_time)`, và checkout cho khách **chọn khung giờ**. Hiện `components/commerce/customer-booking-checkout.tsx` chỉ có ngày + số khách; hold loop qua **tất cả** template đang active.

### QĐ-04 — Người lớn / trẻ em: làm ở tầng đơn, tận dụng T8 sẵn có

`erp_tickets.product` **đã có sẵn** `check (product in ('adult','child','combo','group','guest'))`. Tầng vé không thiếu gì. Thiếu ở tầng đặt chỗ: `CustomerBookingHoldRequestSchema` chỉ có `party_size: 1..20`, không tách nhóm tuổi.

**Chốt:** thêm `adults` / `children` ở order và line, `party_size = adults + children` để không phá hợp đồng slot đang chạy, rồi phát vé T8 đúng `product='adult'` / `'child'`. Không đụng schema T8.

### QĐ-05 — Hàng chờ ảo: KHÔNG làm đợt này

Grep toàn repo: **0 dòng** liên quan. Chín bước trong infographic cần nhắc khách trước 20 phút và 5 phút → cần kênh gửi tin thật. Outbound CUS-07 hiện **chỉ `staged`/`suppressed`, không có provider, không có sender identity**, và mở outbound thật đang chờ điểm 6 (pháp nhân).

**Thay bằng thứ rẻ hơn nhiều mà đạt phần lớn giá trị:** hiển thị **số chỗ còn lại theo từng khung giờ** lúc khách chọn giờ (TC-02). Khách tự né giờ đông — đúng mục tiêu *"giảm hàng chờ vật lý"* mà không cần hạ tầng nhắn tin. Ghi rõ trong nghiệm thu là **chưa phải hàng chờ ảo**.

### QĐ-06 — Zalo Mini App / Wallet Pass / Wi-Fi Portal / Kiosk / Native App: KHÔNG làm

Không phải việc code, và không cái nào bị chặn bởi năng lực kỹ thuật:

| Hạng mục | Chặn ở đâu |
|---|---|
| Zalo Mini App | Cần Zalo OA + thẩm định doanh nghiệp → phụ thuộc điểm 5 (tên thương hiệu) và điểm 6 (pháp nhân) |
| Apple / Google Wallet | Cần tài khoản Apple Developer + certificate ký pass |
| Wi-Fi Portal | Captive portal là thiết bị mạng tại điểm, không phải ứng dụng web |
| Kiosk | Phần cứng + máy in vé |
| Native App | Chính báo cáo của khách xếp ưu tiên **8/8**: *"chỉ xây khi PWA/Zalo chứng minh nhu cầu"* |

Ghi vào đây để phiên sau không tưởng là bỏ sót và tự ý khởi công.

### QĐ-07 — Cổng đại lý/OTA: khảo sát trước, chưa xây

Grep `ota|agency|partner_code`: **0 kết quả** ở tầng khách. Nhưng `erp_tickets.channel` **đã có sẵn** giá trị `'doi-tac'`, và `HANDOFF.md` mục 4 ghi T12 **đã dừng xóa** ~20 bảng `/ops` (`bookings`, `booking_lines`, `booking_contacts`, `capacity_slots`, `payment_intents`, `passes`, `redemptions`, `qr_sources`, `analytics_events`…) vì phát hiện chúng chính là lớp khách hàng.

**Chốt:** TC-07 là một lượt **khảo sát**, không phải lượt xây. Xây mới trước khi biết ~20 bảng đó có gì là lặp lại đúng cái bẫy T12 vừa tránh.

### QĐ-08 — T6c (RLS thật): giữ trong stash, làm cuối

Có sẵn công việc dở trong `git stash@{0}`: `lib/erp/rls-client.ts` (73 dòng, biên tương thích chọn giữa client phiên và client service-role), 3 file test, 2 repository đã sửa. Bản migration `202608070039` trong stash khác bản trên remote **đúng 12 dòng trắng** — nội dung SQL y hệt, bỏ được.

Hiện **26 file** dùng `SUPABASE_SECRET_KEY`, tức `/erp` chạy bằng service role và 161 policy chưa bảo vệ gì cho ERP. Đây là việc lớn nhất còn lại. **Không chen vào giữa đợt TC.**

### QĐ-09 — Migration trùng số 039: giữ nguyên, cấm sửa

Có **hai** migration mang số 039: `202608070039_erp_rls_identity_reads` và `202608180039_customer_data_backbone`. Cả hai **đã apply production**. Supabase CLI sắp theo tên file đầy đủ nên không lỗi.

**Cấm đổi tên để "cho đẹp".** Đổi tên một migration đã apply sẽ làm lệch `supabase migration list` giữa local và remote, và project **không có PITR, không có physical backup** (`backups=null`, `pitr_enabled=false`). Ghi ra đây vì đây đúng loại việc một model sau sẽ tưởng là dọn dẹp vô hại.

### QĐ-10 — Thứ tự và điểm chen

TC-00 phải xong trước tiên vì mọi thứ sau đều chồng lên production đã bật cờ. **TC-04 (ERP-UX-01) không đụng schema nên chen được bất kỳ lúc nào** — đây là lịch trình thật, không phải xếp hàng cứng.

---

## 2. Ràng buộc áp dụng cho MỌI nhiệm vụ TC

Vi phạm một trong các mục dưới đây là làm hỏng việc, kể cả khi test xanh.

1. **Mỗi migration kèm một bài kiểm tra hợp đồng riêng** trong `tests/security/`. Mẫu: `tests/security/erp-offline-gate-migration-contract.test.ts` — đọc thẳng file `.sql` bằng `readFileSync`, nén khoảng trắng, rồi `expect(compact).toContain(...)`. Kiểm tối thiểu: mở bằng `begin;` đóng bằng `commit;`, mọi bảng mới có `enable row level security`, quyền browser bị `revoke`, RPC chỉ `service_role`.
2. **RLS bật trên 100% bảng mới.** Ghi trực tiếp vào bảng phải bị thu hồi; chỉ RPC `security definer` được ghi.
3. **Mọi mã lỗi RPC mới phải có câu tiếng Việt** trong `lib/erp/rpc-error-messages.ts` (hiện 293 mã). Bỏ sót thì người dùng thấy chuỗi mã trần — lỗi này đã xảy ra ở CUS-03 và bị bắt trong lượt hồi quy cuối.
4. **Chạy migration trên PostgreSQL thật trước khi commit**, không chỉ đọc chuỗi SQL. Hai lỗi ở CUS-01 và hai lỗi ở CUS-05 **chỉ lộ ra khi chạy thật** (`ON CONFLICT` mơ hồ, `now()` đứng yên trong cùng transaction). Xóa container sau khi chạy.
5. **Số nào hiện lên cũng phải có nguồn.** Chưa đo được thì màn hình nói thẳng — `SO_TAY_HE_THONG_VI.md` mục 4 nguyên tắc ③. **Không được ẩn ô "chưa có nguồn dữ liệu" cho gọn**; chỉ được hạ trọng số thị giác (`UI_UX_RULES.md` mục ERP Rules).
6. **Test ghi vào production phải tự dọn.** Bốn điều kiện ở `AGENTS.md`. Bản audit 02/08 tìm thấy 13 yêu cầu đổi phạm vi giả trong hộp thư giám đốc và một ngân sách trôi 1 tỷ — migration 019 và 020 tồn tại chỉ để dọn.
7. **`PLAYWRIGHT_BASE_URL` đặt trong cùng câu lệnh** khi test production. Thiếu nó Playwright tự dựng server cục bộ và test nhầm — đã gây một báo cáo "lỗi nghiêm trọng" giả.
8. **File `"use server"` chỉ được export hàm async.** Đã sập 3 lần (bẫy #7 và #11). Sau khi sửa một file action, grep toàn repo tìm export không phải `type`/`async function`.
9. **Không alter lõi T8 (`erp_tickets`) hay T11a (`erp_capacity_thresholds` phần đang chạy).** Chỉ đọc và chỉ thêm cột mới có default.
10. **Cổng trước khi báo xong:** `npm run verify` (typecheck + lint + test:run + build). Trước khi chạm production: `npm run release:preflight`.
11. **Cập nhật `docs/plans/NHAT_KY_THI_CONG.md`** ngay khi xong một nhiệm vụ, và cập nhật mục 2/4 của `docs/HANDOFF.md`. **Không tạo tài liệu trạng thái thứ ba.**

---

## 3. Danh mục nhiệm vụ

### TC-00 — Đóng A6: canary và smoke production A3/A5

| | |
|---|---|
| **Model** | **Opus 5 / High** |
| **Vì sao** | Còn nguyên quyết định canary, thứ tự bật cờ và rollback trên production **không có backup**. Hạ model ở đây là đánh cược vào dữ liệu thật. |
| **Tiên quyết** | Không. Đây là việc đầu tiên. |
| **Trạng thái kế thừa** | Migration 039→048 **đã apply production**; 10 cờ đã cấu hình Vercel; deployment `dpl_EfHq65vZgcJs89jd5sqYbhX6SVpF` chạy `experienceMode=production`; A6 smoke đọc-only đạt 2/2 với kỳ vọng `canary-ready`. **Chưa có smoke A3/A5 sau kích hoạt** — đây chính là việc. |

**Phải làm**

1. Mở `/erp/release` bằng vai giám đốc trên production, đọc verdict thật. Đối chiếu 7 nhóm schema và 10 cờ.
2. **Sửa một chỗ tài liệu đang tự mâu thuẫn:** `docs/HANDOFF.md` dòng ~125 (mục 2.4) vẫn ghi *"`ERP_OFFLINE_GATE_ENABLED` giữ tắt và migration 045 chưa apply production"*, trong khi mục 4 ghi ngược lại là đã apply và đã cấu hình. Lấy verdict ở bước 1 làm trọng tài rồi sửa mục 2.4. Đây là bẫy #6 — hai nguồn sự thật.
3. Smoke A3 (cổng offline) tại **một cơ sở, một thiết bị**. Chỉ đọc trước; nếu chạy lượt ghi thì phải tự dọn theo AGENTS.
4. Smoke A5 (bảng phễu) chỉ đọc.
5. Đối chiếu batch divergence trước khi nói mở rộng.

> **Cập nhật 26/08 sau lượt TC-00 đầu tiên — đọc trước khi làm lại bước 3 và 4.**
> Hai spec đó **chưa từng tồn tại** khi phiếu này được viết; nay đã có, chỉ đọc, cùng khuôn cổng chặn với A6: `tests/e2e/prod-smoke-a3-offline-gate.spec.ts` và `tests/e2e/prod-smoke-a5-funnel.spec.ts`. `erp-offline-gate.spec.ts` **không thay được A3** — nó mock cả `/manifests` lẫn `/sync`.
> Bước 1 và 2 **đã xong**: mục 2.4 HANDOFF đã sửa, và cờ `ERP_OFFLINE_GATE_ENABLED` đã chứng minh là **BẬT** bằng probe 401-thay-vì-503, không cần đăng nhập.
> Việc còn lại của TC-00 bị chặn ở một thứ duy nhất — mật khẩu giám đốc production, xem `ERP-SMOKE-01` ở mục 4 HANDOFF. **Không** `vercel env pull`.

**Cấm:** bật thêm cờ ngoài thứ tự dependency đã mã hóa trong `/erp/release`; chạy `scripts/rollback-customer-release-039-045.sql` khi đã có dữ liệu nghiệp vụ thật — script tự từ chối, đừng ép.

**Xong khi:** smoke A3 và A5 pass trên production với `PLAYWRIGHT_BASE_URL` tường minh, không để lại dữ liệu; mục 2.4 HANDOFF hết mâu thuẫn; ghi nhật ký kèm ID deployment.

---

### TC-01 — Công suất nhiều điểm nghẽn + hệ số an toàn

| | |
|---|---|
| **Model** | **Opus 5 / High** |
| **Vì sao** | Migration đụng bảng T11a đang chạy production và đổi cách tính con số mà cả booking lẫn cổng SOP đọc. |
| **Tiên quyết** | TC-00 xong. |
| **Đáp ứng** | Infographic 1 của khách — trọn vẹn. |

**Hợp đồng dữ liệu — đã kiểm từ mã nguồn, làm đúng thế này**

Migration mới `2026xxxx0049_erp_capacity_multi_bottleneck.sql`:

1. Nới `bottleneck_kind`: thêm `parking`, `waiting-area`, `cave-channel`, `drop-off`, `rescue`, `boat-crew` vào `check` hiện có. **Giữ nguyên 3 giá trị cũ** — 4 hàng seed đang dùng `boat-pier` và `electric-shuttle`.
2. Thêm `capacity_model text not null default 'round-trip' check (capacity_model in ('round-trip','static'))`.
3. Thêm `static_capacity integer check (static_capacity is null or static_capacity between 1 and 100000)`.
4. Thêm `safety_factor numeric(4,3) not null default 1.000 check (safety_factor > 0 and safety_factor <= 1)`.
5. **Không xóa cột `hourly_capacity`** — nó là generated column đang được `202608200043` dòng 434 và `/erp/release` đọc. Thêm cột generated thứ hai:
   ```
   effective_capacity integer generated always as (
     floor(
       (case when capacity_model = 'static'
             then coalesce(static_capacity, 0)::numeric
             else (vehicle_count::numeric * seats_per_vehicle::numeric * 60::numeric) / round_trip_minutes
        end) * safety_factor
     )::integer
   ) stored
   ```
6. Ràng buộc chéo: `check (capacity_model <> 'static' or static_capacity is not null)`.
7. Sửa RPC cập nhật ngưỡng (`202608070037` dòng ~108) để nhận các tham số mới, giữ kiểm phiên bản và audit bất biến đang có.
8. **Đổi nơi booking đọc:** `202608200043` dòng 413 đang `order by threshold.hourly_capacity asc` → đổi sang `effective_capacity`, và dòng 434 lưu `effective_capacity` vào `capacity_snapshot`.

**Cấm:** đổi ý nghĩa `hourly_capacity`; seed ngưỡng mới bằng migration (số công suất thật phải do người vận hành nhập qua màn hình T11a, nếu không lại là số bịa); đặt `safety_factor` khác 1.000 cho hàng cũ (giữ nguyên hành vi, để giám đốc tự đặt).

**Xong khi:** contract test mới xanh; chạy thật trên PostgreSQL 17 chứng minh MIN chọn đúng ngưỡng nhỏ nhất khi một cơ sở có nhiều ngưỡng khác `capacity_model`; test tranh chấp cũ ở 043 vẫn xanh; màn hình T11a hiện nguyên phép tính, nguồn, phiên bản và hệ số; `npm run verify` sạch.

---

### TC-02 — Nhiều khung giờ và khách tự chọn giờ

| | |
|---|---|
| **Model** | **Opus 5 / High** cho migration + RPC → **Sonnet 5** cho giao diện |
| **Vì sao tách hai lượt** | Đổi khóa chính của bảng đang giữ chỗ là việc concurrency; còn màn hình chọn giờ là việc giao diện. Gộp lại là trộn hai loại rủi ro. |
| **Tiên quyết** | TC-01 xong (số chỗ hiển thị phải là `effective_capacity`). |
| **Đáp ứng** | Nguyên tắc cứng 1 và 2 của khách; thay thế hàng chờ ảo theo QĐ-05. |

**Lượt 1 — Opus 5 / High**

1. `customer_product_capacity_templates` đổi `primary key (tenant_id, product_id, site_id)` → `(tenant_id, product_id, site_id, local_start_time)`. Giữ khóa ngoại `(product_id, site_id) references product_sites`.
2. Nới `source_kind` — hiện là `check (source_kind = 'catalog-staged')`, khóa cứng một giá trị. Thêm `'customer-approved'` để lịch bán được duyệt ghi lại được mà không cần migration mới mỗi lần.
3. `customer_create_booking_hold` (`202608200043` dòng 239) thêm tham số `p_slot_starts_at`. Hiện hàm **loop qua tất cả template active** (dòng 399–408); đổi thành: nếu có `p_slot_starts_at` thì chỉ giữ đúng khung đó tại mỗi site của package.
4. RPC mới chỉ đọc: trả danh sách khung giờ của một sản phẩm trong một ngày kèm **số chỗ còn lại** = `effective_capacity` trừ hold chưa hết hạn trừ khách đã xác nhận.

**Lượt 2 — Sonnet 5**

5. `components/commerce/customer-booking-checkout.tsx`: hiện chỉ có ngày (`aria-label="Ngày trải nghiệm"`) và số khách. Thêm bước chọn khung giờ, **hiện số chỗ còn lại từng khung**.
6. Giữ nguyên nguyên tắc "mỗi thao tác không quá ba bước" ở phiếu giao việc 01. Ngày → giờ → số khách là ba bước, vừa đủ.

**Cấm:** để khách chọn giờ ở một cơ sở rồi giờ khác ở cơ sở thứ hai trong cùng package khi chưa có hợp đồng đa chặng — TC-03 mới xử lý bundle.

**Xong khi:** test tranh chấp chứng minh hai khung giờ khác nhau của cùng cơ sở **không ăn vào nhau**, và hai người tranh cùng khung thì đúng một người thắng; Playwright desktop + Pixel 7 đi trọn luồng; số chỗ còn lại khớp truy vấn thật.

---

### TC-03 — Người lớn/trẻ em và bundle nhiều tài nguyên

| | |
|---|---|
| **Model** | **Opus 5 / High** |
| **Vì sao** | Giữ chỗ đồng thời nhiều tài nguyên trong một transaction là bài toán khóa dòng và thứ tự khóa — sai là deadlock hoặc bán vượt. |
| **Tiên quyết** | TC-02 lượt 1 xong. |
| **Đáp ứng** | Nguyên tắc cứng số 3 (*Bundle = đồng thời còn vé + xe + thuyền + bến*); phiếu giao việc 01 mục A2 (người lớn và trẻ em) — **đang thiếu từ đầu, chưa ai làm**. |

**Phải làm**

1. `CustomerBookingHoldRequestSchema` (`domain/customer-booking.ts`) thêm `adults` và `children`; giữ `party_size` là tổng để không phá hợp đồng slot.
2. Order và line lưu tách hai nhóm; phát vé T8 đúng `product='adult'` / `'child'` — **giá trị này đã tồn tại sẵn** trong `erp_tickets`, không cần migration T8.
3. Bundle: một hold giữ chỗ tại **mọi** tài nguyên có ngưỡng trong package, trong **cùng một transaction**. Khóa theo thứ tự `slot_id` tăng dần để tránh deadlock — mẫu đã có ở `202608200043` dòng 632 và 661.
4. Thiếu bất kỳ thành phần nào → **toàn bộ hold thất bại**, không giữ một phần.

**Cấm:** suy diễn tuổi từ hành vi (`GOI_A_KE_HOACH.md` mục 8 guardrail); giữ chỗ một phần rồi hứa phần còn lại.

**Xong khi:** test thật chứng minh thiếu một thành phần thì không có chỗ nào bị giữ; vé phát ra đúng số lượng và đúng loại từng nhóm tuổi; không deadlock khi chạy song song.

---

### TC-04 — ERP-UX-01: mạch dẫn theo vai

| | |
|---|---|
| **Model** | **Sonnet 5** |
| **Vì sao** | Không đụng schema, không đụng RLS, không đụng concurrency. Đây là kiến trúc thông tin và giao diện. |
| **Tiên quyết** | **Không có — chen được bất kỳ lúc nào.** Nếu có hai phiên chạy song song, đây là việc nên chạy song song. |
| **Đáp ứng** | Tín hiệu sản phẩm mạnh nhất từ trước tới nay. Xem `HANDOFF.md` mục 4 hàng `ERP-UX-01` để có đủ 8 nguyên nhân kèm bằng chứng ảnh. |

**Bắt buộc đọc trước:** `docs/reference/UI_UX_RULES.md` mục **ERP Rules (giao diện nội bộ)** ở cuối file — 10 luật và checklist audit riêng.

**Ba việc rẻ, làm trước:**
1. Bỏ đánh số 01–08 và 8 màu vô nghĩa trên lưới thẻ `/erp/[site]`; gộp tên module về **một** bộ khớp `SO_TAY_HE_THONG_VI.md` mục 3.
2. Hạ trọng số thị giác các ô "0" và "chưa có nguồn dữ liệu" — **không ẩn**.
3. Đưa nút "Trợ lý điều hành" ra khỏi vùng nội dung ở mọi khổ màn hình.

**Việc chính:** mang khuôn phiếu việc của trang nhân viên (danh tính + ca → đúng một việc → thanh 5 bước → một nút chính) sang trang giám đốc và quản lý.

**Cấm tuyệt đối:** dựng lưới thẻ điều hướng đánh số kiểu "chọn một lối vào". Đã thử trên web và bị chủ dự án loại **hai lần** (03/08 chê copy, 04/08 gỡ hẳn khối) — xem `UI_UX_RULES.md` mục *Known incident*.

**Xong khi:** ảnh chụp thật 2 vai × desktop + Pixel 7 + reduced-motion; mỗi màn hình chỉ ra được **một** hành động chính; hết lớp nổi che nội dung; hết ô KPI trùng một bản ghi.

---

### TC-05 — Phân bổ tồn kho theo nhóm

| | |
|---|---|
| **Model** | **Opus 5 / High** |
| **Tiên quyết** | TC-02 và TC-03 xong. |
| **Đáp ứng** | Infographic 1 mục 3 — 70% bán trước / 15% dự phòng điều hành / 10% hạn mức lữ hành / 5% khẩn cấp. |

**Phải làm:** bảng phân bổ theo `(slot, bucket)` với ràng buộc **tổng mọi nhóm ≤ công suất cứng** ép ở PostgreSQL, không ở TypeScript. Đúng câu khách viết: *"Tổng tất cả các nhóm tồn kho không được lớn hơn công suất cứng."*

**Cấm:** để bốn con số 70/15/10/5 cứng trong mã nguồn — đây là quyết định kinh doanh, phải nhập được từ màn hình, giữ lịch sử ai đổi. Bốn số này **chưa ai duyệt**; mặc định phải là 100% vào nhóm bán trước, để chỗ cho giám đốc tự chia.

---

### TC-06 — Khách đoàn

| | |
|---|---|
| **Model** | **Opus 5 / High** |
| **Tiên quyết** | TC-03 xong. |
| **Đáp ứng** | Phần khách nhấn mạnh nhiều nhất: *"Khách đoàn là nguồn dữ liệu lớn nhưng dễ bị thất thoát vì chỉ có thông tin trưởng đoàn."* |

**Hiện có gì:** đúng một thứ — vé nhóm `product='group'` với `entries_allowed = party_size`. **Không có** mã đoàn, danh sách từng người, trưởng đoàn, hay trạng thái check-in từng người.

**Phải làm:** mã đoàn; QR con cho từng thành viên; trạng thái check-in từng người; trưởng đoàn đăng ký **tối thiểu**. Theo đúng cơ chế khách mô tả: *"Khách chưa kích hoạt vẫn được tham quan"* — kích hoạt là tự nguyện, đổi lấy tiện ích, không phải điều kiện vào cổng.

**Cấm:** bắt 100 khách trong đoàn điền biểu mẫu — chính khách viết là không nên; thu giấy tờ tùy thân (QĐ-01).

---

### TC-07 — Khảo sát ~20 bảng `/ops` trước khi quyết cổng đại lý

| | |
|---|---|
| **Model** | **Sonnet 5** (khảo sát) → **Opus 5 / High** nếu quyết định xây |
| **Tiên quyết** | Không. Chạy song song được. |
| **Đầu ra** | **Một tài liệu khảo sát, không có mã nguồn.** |

Đọc `bookings`, `booking_lines`, `booking_contacts`, `capacity_slots`, `payment_intents`, `passes`, `redemptions`, `qr_sources`, `analytics_events` và các bảng demo còn lại. Trả lời đúng ba câu: (a) thiết kế nào tái dùng được cho cổng đại lý/OTA, (b) cái nào đã bị CUS-01→08 thay thế, (c) cái nào xóa được an toàn.

Kết quả quyết định luôn số phận **T12** — đang bị đánh dấu ⛔ DỪNG trong hàng việc.

---

### TC-08 — T6c: RLS thật thay service role

| | |
|---|---|
| **Model** | **Opus 5 / High** — không hạ trong bất kỳ phần nào |
| **Tiên quyết** | Toàn bộ TC-00 → TC-06 xong. |
| **Vì sao cuối** | Việc lớn nhất còn lại, dễ bỏ dở nhất. Làm giữa chừng đợt TC thì mọi nhiệm vụ sau phải gánh một nền đang đổi. |

**Vốn có sẵn:** `git stash@{0}` chứa `lib/erp/rls-client.ts` (biên tương thích chọn giữa client phiên và client service-role), 2 file test bảo mật, 1 unit test, và 2 repository đã sửa. Khôi phục bằng `git stash pop` rồi **bỏ phần migration trong stash** — nó chỉ khác bản remote 12 dòng trắng.

**Quy mô thật:** 26 file đang dùng `SUPABASE_SECRET_KEY`; 161 policy. Chuyển từng nhóm bảng một, mỗi bước dừng lại hệ thống vẫn chạy được — đúng bẫy #3.

---

## 4. Bảng tra nhanh

| ID | Việc | Model | Tiên quyết | Đụng schema |
|---|---|---|---|---|
| TC-00 | Đóng A6, smoke A3/A5 | Opus 5 / High | — | Không |
| TC-01 | Công suất nhiều điểm nghẽn | Opus 5 / High | TC-00 | **Có** |
| TC-02 | Nhiều khung giờ, khách chọn giờ | Opus 5 / High → Sonnet 5 | TC-01 | **Có** |
| TC-03 | Người lớn/trẻ em + bundle | Opus 5 / High | TC-02 | **Có** |
| TC-04 | ERP-UX-01 mạch dẫn | Sonnet 5 | **không** | Không |
| TC-05 | Phân bổ tồn kho | Opus 5 / High | TC-02, TC-03 | **Có** |
| TC-06 | Khách đoàn | Opus 5 / High | TC-03 | **Có** |
| TC-07 | Khảo sát bảng `/ops` | Sonnet 5 | **không** | Không |
| TC-08 | T6c RLS thật | Opus 5 / High | TC-00→06 | Policy |

**Haiku 4.5 dùng ở đâu:** bổ sung mã lỗi vào `rpc-error-messages.ts` sau khi RPC đã khóa; dựng fixture cho test đã có hợp đồng; chạy lượt chụp ảnh theo checklist ERP; định dạng lại tài liệu. **Không giao Haiku một nhiệm vụ TC nguyên vẹn nào.**

---

## 5. Ba câu phải dừng lại hỏi chủ dự án

Giữ nguyên từ phiếu giao việc 01, vẫn còn hiệu lực:

1. Phải sửa bảng hoặc nghiệp vụ ERP hiện có.
2. Phát hiện mâu thuẫn giữa tài liệu và mã nguồn.
3. Một nhiệm vụ kéo theo phạm vi ngoài đợt TC.

**Không tự mở rộng phạm vi trong bất kỳ tình huống nào.**
