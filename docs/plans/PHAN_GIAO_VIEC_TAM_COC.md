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

   > **Giá vé — chủ dự án chốt 29/08/2026:** trẻ **dưới 1m3 không mua vé**, từ 1m3 trở lên tính giá thường. Vì thế `child` có nghĩa hẹp và cố định là *khách dưới 1m3*, **không phải "trẻ em" theo tuổi**: một em mười hai tuổi cao 1m4 vẫn là một vé thường. Chữ dùng với khách phải là **"Từ 1m3 trở lên" / "Dưới 1m3"**, không phải "người lớn / trẻ em" — gọi sai thì phụ huynh chọn nhầm và mình thu thiếu tiền mà không ai biết. **Miễn phí không có nghĩa là không chiếm chỗ:** sức chứa vẫn trừ theo tổng đầu người, và vé của em bé vẫn phát ra để còn đếm được ở cổng. Quy tắc này áp cho cả **TC-06** (khách đoàn) và **TC-10** (căn cước hành trình) — đừng định nghĩa lại ở đó.
3. Bundle: một hold giữ chỗ tại **mọi** tài nguyên có ngưỡng trong package, trong **cùng một transaction**, và mọi hàm khóa các hàng khung giờ theo **cùng một chiều** để tránh deadlock.

   > **Đính chính 29/08/2026 — bản đầu ghi "khóa theo thứ tự `slot_id` tăng dần", điều đó không làm được.** Lúc `customer_create_booking_hold` bắt đầu thì hàng khung giờ **chưa tồn tại** — chính hàm ấy tạo ra chúng — nên chưa có `slot_id` nào để mà sắp. Khóa thật sự dùng là **`(giờ bắt đầu, cơ sở)`**: biết trước, lại đúng là khóa duy nhất của `customer_booking_slots`. Vì vậy `customer_confirm_simulated_booking` đã đổi sang thứ tự đó (`202608290053`), chứ không phải hàm giữ chỗ đổi sang `slot_id`.
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

---

## 3b. Đợt hai — chốt trong buổi trao đổi 29/08/2026

Sáu nhiệm vụ dưới đây sinh ra từ một buổi bàn với chủ dự án, không phải từ khảo sát kỹ thuật. Chúng **chưa được xếp thứ tự trong đợt TC hiện tại** — làm sau TC-03, hoặc chen vào khi chủ dự án đổi ưu tiên.

**Một sợi chỉ xuyên suốt cả sáu:** mỗi khách một mã định danh, mọi thứ khác treo vào đó. Đừng làm từng cái rời rạc.

---

### TC-09 — Đồng ý phục vụ và đồng ý tiếp thị

| | |
|---|---|
| **Model** | **Opus 5 / High** cho tầng chặn, **Sonnet 5** cho giao diện |
| **Vì sao tách hai** | Chặn ở tầng dữ liệu là chuyện đúng/sai; ô tick là chuyện trình bày. |
| **Tiên quyết** | Không. Bảng `customer_consents` đã có sẵn. |

**Phải làm**

1. Hai loại đồng ý tách bạch, bảng đã có: **phục vụ** (ghi lại chuyến đi của chính khách để phục vụ chuyến đó) và **tiếp thị** (gửi gợi ý, thông báo, thư).
2. Tầng chặn nằm ở **repository, không ở giao diện**: mọi đường gửi ra ngoài (`customer_outbound_actions`) phải đọc đồng ý tiếp thị trước khi xếp hàng. Không đồng ý thì không có hàng nào được tạo — chứ không phải tạo rồi lọc lúc gửi.
3. Ghi lại **thời điểm và cách khách đồng ý**, để về sau trả lời được câu "vì sao người này nhận được thư".

**⛔ Điểm chủ dự án phải quyết — chưa làm cho tới khi có câu trả lời**

Chủ dự án đề nghị **tích sẵn ô đồng ý** lúc khách đăng ký. Nghị định 13/2023/NĐ-CP quy định sự đồng ý phải là hành động khẳng định; **im lặng hoặc không thao tác không được coi là đồng ý**. Ô tích sẵn cho phần **tiếp thị** vì thế không có giá trị pháp lý — và khi có khiếu nại thì bằng chứng "khách đã đồng ý" cũng không đứng vững.

Phần **phục vụ** thì khác hẳn: khách trả tiền mua dịch vụ, việc ghi lại họ đã vào cổng nào bằng vé của chính họ là **thực hiện hợp đồng**. Không cần hỏi, và không nên hỏi.

Đề xuất thay thế, giữ được tỉ lệ đồng ý cao mà không tích sẵn: một dòng duy nhất lúc đặt chỗ, nói thẳng khách được gì — *"Cho phép chúng tôi nhắn khi có khung giờ đẹp hoặc chỗ vắng gần bạn."* Ô để trống, khách tự tick.

**Cấm:** gửi bất cứ thứ gì ra ngoài khi chưa có đồng ý tiếp thị, kể cả "chỉ một lần".

**Xong khi:** có bài kiểm chứng minh không đồng ý thì **không một hàng nào** vào `customer_outbound_actions`; và rút lại đồng ý thì mọi hàng đang chờ bị dừng.

---

### TC-10 — Căn cước hành trình: mỗi người một mã

| | |
|---|---|
| **Model** | **Opus 5 / High** |
| **Vì sao** | Nối một chuỗi đã tồn tại nhưng chưa ai đọc, và chạm vào dữ liệu định danh có luật điều chỉnh. |
| **Tiên quyết** | TC-09 (phần phục vụ). |

**Vốn đã có — không xây lại**

Chuỗi từ cổng về khách **đã thông suốt**, chỉ chưa có gì đọc nó lên:

```
erp_gate_scan_events.ticket_id → erp_tickets → customer_order_tickets
  → customer_orders.profile_id → customer_profiles / customer_identities
```

`customer_journeys`, `customer_events`, `customer_segments` đều đã có, kèm ràng buộc `customer_json_contains_pii` khoá cứng ở tầng cơ sở dữ liệu.

**Phải làm**

1. **Mỗi người một mã, không phải mỗi đoàn một mã.** Chủ dự án chốt như vậy. Đoàn mười người là mười mã có liên kết đoàn, không phải một mã đại diện.
2. Tên khách đi kèm mã, để nhân viên biết mình đang giúp ai.
3. Đọc chuỗi trên thành **hộ chiếu chuyến đi**: đã qua những đâu, ngày nào, gói nào.
4. Phần khách nhìn thấy là **một tấm bản đồ Ninh Bình của riêng họ**, sáng dần theo nơi đã đi qua; nơi chưa tới còn mờ. Vừa là quà, vừa là lời mời quay lại, và nó tự giải thích hệ thống đang ghi gì mà không cần một dòng chính sách nào.
5. Chữ dùng với khách: **"những nơi bạn đã đi qua"**. Không dùng "soát vé", "quét mã", "điểm chạm" — đó là chữ của cái cổng, không phải chữ nói với khách.

**Giấy tờ tuỳ thân — ranh giới cứng**

Luật lưu trú yêu cầu ghi đúng danh tính khách. Vì thế:

- Lưu **tối thiểu**, niêm phong bằng mã hoá (`customer_identities` đã có sẵn khoá), **không** để lẫn vào các bảng hành trình.
- Quầy vé có thể chụp lại làm căn cứ, nhưng **phải có hạn xoá** — cần chủ dự án chốt số ngày.
- Không một trường giấy tờ nào được chảy sang bảng gợi ý, phân khúc hay đánh giá.

**Cấm:** suy diễn tuổi từ hành vi (`GOI_A_KE_HOACH.md` mục 8). Số người lớn / trẻ em lấy từ chính lúc mua vé (TC-03), không đoán.

**Để sau, đã bàn nhưng chưa xếp:** ảnh khoảnh khắc chụp tại điểm check-in gắn vào hộ chiếu chuyến đi, gửi về email hoặc số điện thoại khách đã đăng ký.

---

### TC-11 — Dự báo giờ chạm trần và gợi ý điều hướng

| | |
|---|---|
| **Model** | **Opus 5 / High** |
| **Vì sao** | Dự báo sai làm quản lý điều khách sai; sai lặng lẽ còn tệ hơn không có. |
| **Tiên quyết** | TC-02 (đã xong). |

**Vốn đã có:** trần sức chứa từng giờ, số chỗ đã giữ, dấu thời gian từng lượt giữ — đủ để tính tốc độ lấp đầy và suy ra giờ chạm trần. Ngưỡng đã có bốn mức phản ứng kèm người chịu trách nhiệm và hạn xử lý.

**Cái đang thiếu:** bảng gợi ý **chưa đọc một dòng nào** về sức chứa.

**Phải làm**

1. Tính giờ dự kiến chạm trần từ tốc độ giữ chỗ thật. **Không đủ dữ liệu thì nói thẳng là chưa đoán được** — không bịa một con số cho có.
2. Nối sức chứa vào `customer_recommendations` như một tín hiệu **thường trực**, không phải cái phanh gấp lúc gần đầy.
3. **Không xếp hạng theo lượng khách.** Xếp theo *hợp với người này* và *còn chỗ lúc này*. Xếp theo lượt ghé là đẩy người về đúng chỗ đang đông, rồi chính hệ thống vừa đẩy họ tới lại phải quay ra chặn.

**Giao diện — quản lý và giám đốc**

Một câu tiếng Việt, một con số, một nút. Ví dụ: *"Tràng An giữ chỗ nhanh gấp đôi hôm qua, khoảng 14 giờ là kín. Vân Long còn trống hơn nửa."*

**Cấm:** hiện phần trăm tải, tên ngưỡng, phiên bản ngưỡng cho người vận hành. Đó là bẫy ERP-UX-01 đã sập một lần.

**Xong khi:** dự báo đối chiếu được với số thật của một ngày đã qua, và sai số được ghi ra chứ không giấu.

---

### TC-12 — Hệ sinh thái đánh giá cả tỉnh

| | |
|---|---|
| **Model** | **Sonnet 5**, riêng luật chống spam là **Opus 5 / High** |
| **Tiên quyết** | TC-10. |

**Phải làm**

1. **Chỉ mã đã đặt chân tới mới được đánh giá.** Đây là lợi thế bản đồ đại chúng không có: hệ thống biết ai thật sự đã qua cổng. Đánh giá có dấu chân nặng ký hơn hẳn, nên phần lớn spam tự rụng mà không cần xoá tay.
2. Bản đồ toàn tỉnh: nơi đang được ưa chuộng, và **nơi hay mà ít người biết** — mục thứ hai mới tạo ra giá trị mới.
3. **Quyền xoá có hạn mức, theo vai:**
   - Quản trị hệ thống: xoá hàng loạt, dùng cho đợt spam.
   - Quản lý chăm sóc khách hàng / marketing: **hạn mức nhỏ, 10–20 lượt**, không được xoá sạch.
   - Mọi lượt xoá ghi lại ai xoá và vì sao.
4. **Không được xoá đến mức toàn 5 sao.** Chủ dự án nói đúng: bảng điểm toàn năm sao trông giả. Giữ lại các đánh giá 2–3 sao thật.

**Cấm:** để chủ sạp tự xoá đánh giá xấu của chính mình. Làm vậy thì điểm số vô nghĩa, và khách nhận ra rất nhanh.

---

### TC-13 — Chăm sóc đặc biệt và báo xuống ca trực

| | |
|---|---|
| **Model** | **Sonnet 5** |
| **Tiên quyết** | TC-03. |

**Phải làm**

1. Đánh dấu nhu cầu cần chăm sóc riêng: trẻ nhỏ, người cao tuổi, người khuyết tật. **Khách tự khai**, không suy diễn.
2. Báo trước cho ca trực: hôm nay có những khách nào cần để ý.
3. **Đường báo phải hợp với cách người ta làm việc thật.** Nhiều nhân viên hiện trường không dùng điện thoại trong giờ. Vì thế thông báo đi tới **tổng đài hoặc phòng điều hành**, người ở đó đọc lên bộ đàm. Gửi thẳng vào điện thoại nhân viên là thiết kế cho người ngồi bàn giấy.

---

### TC-14 — Trợ lý lập lịch trình luôn hiện

| | |
|---|---|
| **Model** | **Sonnet 5** |
| **Tiên quyết** | TC-11, để gợi ý biết chỗ nào còn trống. |

Ô cho khách nói mong muốn bằng lời thường **đã có** và đã lưu thành `intent` (sở thích, nhịp, thời lượng, ngày đi). Việc còn lại là cho nó hiện thường trực chứ không nằm khuất.

**Về thu âm trình duyệt — đã khép lại 29/08:** trình duyệt **không cho** trang web bật micro âm thầm. Bắt buộc hiện hộp xin phép, và trong lúc thu thì tab hiện chấm đỏ, hệ điều hành cũng báo. Không có đường vòng. Chủ dự án đã chốt bỏ hướng này, dùng tín hiệu sẵn có: khách xem gói nào lâu, xem rồi không đặt, vừa qua cổng nào lúc mấy giờ. Khách rời Tràng An lúc 11 giờ trưa thì không cần nghe lén cũng biết họ sắp đi ăn.

---

### Hai điều đã chốt, áp cho cả sáu nhiệm vụ

**Cố đô Hoa Lư và Phố cổ Hoa Lư không quản sức chứa.** Hai nơi này không bán vé. Chúng là **đích để gợi ý và để dẫn khách tới mua thứ khác**, không phải tài sản cần đo tải. Ở đó còn có hàng quán do người khác thuê và vận hành, nên mình không cầm toàn bộ — quản một khu vực khác hẳn quản một hai sạp hàng. Đừng dựng ngưỡng T11a cho chúng: không bán vé thì không có gì để giữ chỗ, dựng ra là bịa một điểm nghẽn không tồn tại.

**Không xếp hạng theo độ nổi tiếng.** Ghi lại một lần cho khỏi quên vì sao: xếp theo lượt ghé thì nơi đông càng đông, nơi vắng vĩnh viễn không ngoi lên được dù đang trống chỗ — và tới lúc nơi đông chạm trần thì chính hệ thống vừa đẩy khách tới đó phải quay ra chặn họ lại.

## 3c. Đợt ba — chốt trong buổi trao đổi 30/08/2026

Sinh ra từ chính lúc chủ dự án dùng thử TC-06 và hỏi lại. Bảy nhiệm vụ, **một sợi chỉ chung: mã QR chỉ chứa một mã, còn nhìn thấy gì thì tuỳ ai quét.**

---

### Nguyên tắc nền, áp cho cả bảy — mã QR không chứa dữ liệu

Chủ dự án hỏi: *"cứ 1 cái ID của khách như thế thì QR nó đã zip lại gần hết nội dung của khách rồi."* Đúng ý, nhưng phải làm **ngược lại**: QR chỉ mang **một mã**, không mang nội dung.

Hai lý do, lý do thứ hai nặng hơn:

1. Một mã QR chỉ nhét được khoảng hai tới ba nghìn ký tự — không đủ cho một hành trình.
2. **Ai chụp được cái QR là có toàn bộ dữ liệu.** Một tấm ảnh đăng lên mạng là xong. Dữ liệu nằm trong QR thì không có cách nào thu hồi.

Cách đạt đúng điều chủ dự án muốn:

| Ai quét | Nhìn thấy gì |
|---|---|
| Chính khách | Hộ chiếu chuyến đi — bản đồ Ninh Bình sáng dần theo nơi đã qua |
| Nhân viên cổng | Đúng ba dòng: hợp lệ, người thứ mấy trong đoàn, có cần để ý không |
| Quản lý | Thêm trạng thái cả đoàn, ai đã vào ai chưa |

Cùng một mã, ba màn hình. Cách này khiến hệ thống **ghi ít dữ liệu đi**, không nhiều thêm: một dòng cho mỗi người, mọi thứ còn lại suy ra từ nhật ký quét vốn đã có.

**Khoảnh khắc đáng làm nhất:** khách giơ điện thoại ở cổng, cổng cho vào, và cùng lúc đó màn hình của họ sáng thêm một điểm trên bản đồ. Một lần quét, hai việc, không tốn thêm dữ liệu nào.

### Câu hỏi "làm sao biết ai là ai" — trả lời một lần cho khỏi hỏi lại

Chủ dự án hỏi: *"vd 1 cái điện thoại cũ vậy scan mã cũng biết được à?"*

**Danh tính nằm ở mã, không nằm ở thiết bị.** Điện thoại cũ, điện thoại mượn, máy quét cầm tay — đều đọc ra cùng một mã và hệ thống xử lý y hệt nhau. Đây là thiết kế có chủ ý: nếu danh tính phụ thuộc thiết bị thì một cái điện thoại hết pin là khách không vào được.

Hệ quả phải nói ra: **ai cầm mã thì được đối xử như người đó** — đúng như một tấm vé giấy. Đưa mã cho người khác là chuyển chỗ cho người đó, và **không gian lận được số chỗ** vì cả đoàn tiêu chung một hạn mức. Đây là tiện ích, không phải lỗ hổng — xem TC-20.

---

### TC-15 — Đoàn thật: xe 32 chỗ, trưởng đoàn làm gốc

| | |
|---|---|
| **Model** | **Opus 5 / High** |
| **Tiên quyết** | TC-06 (đã lên production 30/08). |
| **Vì sao** | Nới trần số người chạm vào ràng buộc của bảng đơn hàng, và luồng điền hộ chạm vào dữ liệu cá nhân của người thứ ba. |

**Vốn đã có sau TC-06 — không xây lại:** mã đoàn, mã riêng từng người, mã mang sẵn nhóm chiều cao, trạng thái ai đã vào đâu, và **mỗi người ghi hành trình của riêng mình**. Chủ dự án nói *"hôm nay có người mệt ở nhà thì họ sẽ không sang đến những địa điểm mà những người còn lại đi"* — điều này **đã đúng sẵn**: ai không quét thì mục `entries` của người đó rỗng.

**Phải làm**

1. **Nới trần 20 người.** Một xe 32 chỗ không lọt qua `customer_orders.party_size between 1 and 20`. Đây là **quyết định kinh doanh chủ dự án đã ra** khi nói "xe 32 người", nên nới — nhưng nới có số trần mới rõ ràng, đừng bỏ trần.
2. **Nhãn đoàn đọc được bằng mắt.** Chủ dự án nói *"đoàn tới từ Hà Nội ID bao nhiêu"*, nên ngoài mã máy còn cần một nhãn người đặt: nơi xuất phát, tên đoàn.
3. **Hai đường điền thông tin, trưởng đoàn chọn:**
   - Trưởng đoàn điền hộ cả đoàn.
   - Gửi link, mỗi người tự điền — đường này đã có từ TC-06 (`/doan/[ma]`).
4. **Trưởng đoàn làm gốc lịch trình.** Đã đúng sẵn: cả đoàn treo vào một đơn, một giờ khởi hành. Đi đâu thì cả đoàn đi đó.

**⛔ Điểm phải cân nhắc — điền hộ là điền dữ liệu của người khác**

Trưởng đoàn điền tên 31 người còn lại nghĩa là **một người khai dữ liệu cá nhân của 31 người chưa được hỏi**. Đề xuất giảm rủi ro mà vẫn tiện: trường bắt buộc chỉ là **tên gọi**; những gì nhạy hơn để trống và người đó tự bổ sung qua link của mình.

**Về tuổi:** thay vì hỏi tuổi thật, hỏi thứ mình thật sự cần cho vận hành — *"có cần hỗ trợ gì không: đi cùng trẻ nhỏ / người cao tuổi / khó đi lại"*. Được đúng giá trị vận hành mà thu ít dữ liệu hơn hẳn, và nối thẳng vào TC-13.

**Cấm:** bắt cả 32 người điền mới cho vào cổng. Ai chưa điền vẫn đi tham quan bình thường — nguyên tắc cứng của TC-06, không được nới.

---

### TC-16 — Quét bằng camera điện thoại nhân viên

| | |
|---|---|
| **Model** | **Sonnet 5** |
| **Tiên quyết** | Không. |

Chủ dự án: *"dùng đth cho nhân viên scan bằng app = account của nhân viên đã được gán công việc kiểm soát cổng A-B-C-D... không cần phải máy scan qua lằng nhằng."*

**Vốn đã có — ba phần tư việc:** `erp_gate_actor_can_scan` đã kiểm đúng tài khoản ấy có quyền ở đúng cơ sở ấy; mỗi lượt quét **đã ghi ai quét, tên gì, lúc nào**; và bản quét ngoại tuyến đã chạy — mất mạng vẫn quét, có mạng lại thì đồng bộ và đối soát.

**Thiếu đúng một thứ: cái camera.** Màn hình hiện chỉ có ô gõ tay.

**Phải làm:** mở camera trong trình duyệt, đọc mã, đổ vào đúng ô quét đang có. Android Chrome đọc được bằng thứ có sẵn của trình duyệt; iPhone cần thêm một thư viện đọc mã — **nói rõ trước khi thêm phụ thuộc**, đừng tự thêm.

**Cấm:** dựng một đường quét thứ hai. Camera chỉ là cách **nhập liệu** mới cho đúng luồng đã có, không phải một luồng song song.

---

### TC-17 — Giấy tờ tuỳ thân: mở đường sẵn, khoá cửa lại

| | |
|---|---|
| **Model** | **Opus 5 / High** |
| **Tiên quyết** | TC-15. |

Chủ dự án: *"cần có 1 cái attachfile nếu cần thiết... tránh việc sau này nhà nước ra quy định phải lấy thông tin khách hàng lưu trú."* Chuẩn bị trước là đúng — luật lưu trú có yêu cầu cơ sở lưu trú ghi nhận danh tính khách và thông báo lưu trú. **Chi tiết pháp lý phải hỏi luật sư, đừng suy từ tài liệu này.**

**Phải làm — năm rào, thiếu một cái là không làm**

1. Kho **riêng, mã hoá**, không đứng chung bảng với hành trình. `customer_identities` đã có sẵn khoá.
2. **Không một trường nào** chảy sang bảng gợi ý, phân khúc hay đánh giá.
3. Mỗi lần thu ghi lại **vì sao thu** — sau này có người hỏi thì trả lời được.
4. **Hạn xoá bắt buộc.** ⛔ Số ngày là chủ dự án chốt, không phải mã nguồn tự đặt.
5. Chỉ thu **khi có lý do**, không thu mặc định cho mọi đoàn.

**Cấm:** để ảnh giấy tờ đi qua bất kỳ đường nào khách khác đọc được; đưa vào QR; đính vào hộ chiếu chuyến đi.

---

### TC-18 — Đoàn mua tại quầy

| | |
|---|---|
| **Model** | **Sonnet 5** |
| **Tiên quyết** | TC-15. |

Chủ dự án: *"nhân viên bán vé tại quầy có thể đăng kí vé qua account của họ và bán luôn tại đó... nó làm ra 1 cái phiếu đoàn xong đưa QR cho khách, khách scan vậy là xong, vẫn là logic đoàn trưởng."*

**Việc phải làm gọn hơn tưởng:** hiện đoàn chỉ treo được vào đơn đặt trên web. Cho quầy thì cho phép treo mã đoàn vào **tấm vé quầy vừa bán**, và tài khoản người bán đã có sẵn để ghi lại ai tạo. Toàn bộ phần còn lại — mã riêng từng người, trạng thái ai đã vào — dùng lại nguyên của TC-06.

---

### TC-19 — Đoàn còn thiếu người

| | |
|---|---|
| **Model** | **Sonnet 5** |
| **Tiên quyết** | TC-15. |

Tám người mà mới sáu người qua cổng sau mười lăm phút — báo cho trưởng đoàn. **Không ghi thêm một dòng dữ liệu nào**: đếm trên nhật ký quét vốn đã có.

Với hướng dẫn viên thì đây là thứ dùng hàng ngày, và nó là lý do thật để họ muốn cả đoàn kích hoạt mã — thuyết phục hơn mọi lời mời.

**Cấm:** báo về điện thoại từng nhân viên hiện trường (bẫy đã ghi ở TC-13). Trưởng đoàn thì báo thẳng được, vì họ đang cầm điện thoại.

---

### TC-20 — Mã chuyển tay được, nói ra thành một tiện ích

| | |
|---|---|
| **Model** | **Haiku 4.5** (chỉ là chữ và một màn hình nhỏ) |
| **Tiên quyết** | TC-15. |

Một người bận không đi, đưa mã cho người khác — hệ thống vẫn đếm đúng một chỗ, vì cả đoàn tiêu chung một hạn mức. **Điều này đã đúng sẵn theo thiết kế TC-06.**

Việc còn lại chỉ là **nói ra**: đây là tiện ích có chủ đích, không phải chuyện tình cờ. Không nói thì đến lúc có người làm vậy, đội vận hành lại tưởng là lỗ hổng và đi vá một thứ đang đúng.

---

### TC-21 — Đối soát cuối ca tự động

| | |
|---|---|
| **Model** | **Sonnet 5** |
| **Tiên quyết** | TC-16. |

Mỗi lượt quét đã ghi cổng nào, ai quét, lúc nào. Ghép với ca trực là ra bảng đối soát cuối ca — **không ai phải ngồi cộng tay**, và không phải ghi thêm dữ liệu nào.

---

### Hệ thống chịu được bao nhiêu — đo thật, ngày 30/08/2026

Chủ dự án hỏi: *"liệu là sẽ có quá nhiều dữ liệu ghi không? hệ thống sẽ chịu tải được bao nhiêu."* Số thật, đọc thẳng từ production:

| | |
|---|---|
| Toàn bộ cơ sở dữ liệu hiện tại | **31 MB** |
| Bảng nặng nhất | **192 kB** |

Ước lượng cho vận hành thật:

- Một dòng nhật ký quét ≈ **300 byte**.
- Một đoàn 32 người đi 4 điểm = 128 dòng ≈ **38 kB**.
- **100 đoàn như vậy mỗi ngày** = 3,8 MB/ngày ≈ **1,4 GB/năm**.

Nghĩa là một năm vận hành nặng thêm khoảng 1,4 GB vào một cơ sở dữ liệu đang 31 MB. Các gói Supabase trả phí bắt đầu từ 8 GB và nới lên được. **Dung lượng không phải chỗ nghẽn.**

**Chỗ nghẽn thật là cách viết truy vấn.** Một nhật ký chỉ ghi thêm, có chỉ mục đúng, vẫn nhanh ở hàng trăm triệu dòng; một báo cáo viết ẩu quét cả bảng thì chậm từ vài triệu dòng. Nguyên tắc: **không bao giờ quét cả nhật ký để trả lời một câu hỏi.**


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
| TC-09 | Đồng ý phục vụ / tiếp thị | Opus 5 / High → Sonnet 5 | **không** | Không |
| TC-10 | Căn cước hành trình mỗi người một mã | Opus 5 / High | TC-09 | **Có** |
| TC-11 | Dự báo giờ chạm trần + điều hướng | Opus 5 / High | TC-02 | **Có** |
| TC-12 | Hệ sinh thái đánh giá cả tỉnh | Sonnet 5 (luật spam: Opus) | TC-10 | **Có** |
| TC-13 | Chăm sóc đặc biệt, báo xuống ca trực | Sonnet 5 | TC-03 | **Có** |
| TC-14 | Trợ lý lập lịch trình luôn hiện | Sonnet 5 | TC-11 | Không |
| TC-15 | Đoàn thật: xe 32 chỗ, trưởng đoàn làm gốc | Opus 5 / High | TC-06 | **Có** |
| TC-16 | Quét bằng camera điện thoại nhân viên | Sonnet 5 | **không** | Không |
| TC-17 | Giấy tờ tuỳ thân niêm phong | Opus 5 / High | TC-15 | **Có** |
| TC-18 | Đoàn mua tại quầy | Sonnet 5 | TC-15 | **Có** |
| TC-19 | Đoàn còn thiếu người | Sonnet 5 | TC-15 | Không |
| TC-20 | Mã chuyển tay được | Haiku 4.5 | TC-15 | Không |
| TC-21 | Đối soát cuối ca tự động | Sonnet 5 | TC-16 | Không |

**Haiku 4.5 dùng ở đâu:** bổ sung mã lỗi vào `rpc-error-messages.ts` sau khi RPC đã khóa; dựng fixture cho test đã có hợp đồng; chạy lượt chụp ảnh theo checklist ERP; định dạng lại tài liệu. **Không giao Haiku một nhiệm vụ TC nguyên vẹn nào.**

---

## 5. Ba câu phải dừng lại hỏi chủ dự án

Giữ nguyên từ phiếu giao việc 01, vẫn còn hiệu lực:

1. Phải sửa bảng hoặc nghiệp vụ ERP hiện có.
2. Phát hiện mâu thuẫn giữa tài liệu và mã nguồn.
3. Một nhiệm vụ kéo theo phạm vi ngoài đợt TC.

**Không tự mở rộng phạm vi trong bất kỳ tình huống nào.**
