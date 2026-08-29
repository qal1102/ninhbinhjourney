# NHẬT KÝ THI CÔNG — ĐỢT TC (THÍ ĐIỂM TAM CỐC)

> **File này ghi VIỆC ĐÃ LÀM, không ghi hiện trạng hệ thống.**
>
> `AGENTS.md` cấm tạo thêm tài liệu trạng thái — một rừng 17 tài liệu chồng chéo chính là thứ cấu trúc hiện tại thay thế. Ranh giới giữ đúng như sau:
>
> | Câu hỏi | Đọc file nào |
> |---|---|
> | Hệ thống **đang** ra sao? | `docs/HANDOFF.md` — **nguồn sự thật duy nhất** |
> | Tôi **phải làm gì** tiếp? | `docs/plans/PHAN_GIAO_VIEC_TAM_COC.md` |
> | Ai **đã chạm** vào đâu, bằng model nào, bắt được lỗi gì? | **File này** |
> | Hệ thống được **thiết kế** theo nguyên tắc nào? | `docs/reference/SO_TAY_HE_THONG_VI.md` |
>
> Nếu file này và `HANDOFF.md` mâu thuẫn nhau về hiện trạng thì **HANDOFF đúng** — và mâu thuẫn đó phải được sửa ngay, không để lại. Đây là bẫy #6: hai nguồn sự thật về cùng một thứ thì cả hai đều sai.

---

## Cách ghi một mục

Xong một nhiệm vụ TC thì thêm một mục theo đúng khuôn dưới đây, **mới nhất lên trên**. Viết cho người chưa đọc dự án bao giờ.

```
## TC-xx — <tên nhiệm vụ>
**Ngày:** dd/mm/yyyy · **Model:** <model + mức> · **Commit:** `<sha>` · **Trạng thái:** ✅ xong | 🟡 dở | ⛔ dừng

### Đã làm
- Câu ngắn, có đường dẫn file thật.

### Đã kiểm chứng thật
- Ghi rõ chạy ở đâu: PostgreSQL cục bộ / production / chỉ đọc chuỗi SQL.
- Số bài test, số pass, số skip.

### KHÔNG chứng minh được điều gì
- Bắt buộc có. Một mục "đã xong" không kèm giới hạn là một mục đáng ngờ.

### Lỗi thật bắt được khi làm
- Lỗi chỉ lộ ra khi chạy thật quý hơn lỗi đọc code thấy được. Ghi lại cả cách phát hiện.

### Để lại cho phiên sau
- Việc dở, quyết định treo, thứ cố ý chưa làm.
```

**Bốn luật khi ghi:**

1. **Ghi cả cái chưa chứng minh được.** Cột "KHÔNG chứng minh được" là cột có giá trị nhất trong file. Tài liệu này từng ghi T15 là "còn thiếu" trong khi mã nguồn đã đầy đủ từ commit `a3c9cc5` — sai suốt hai ngày.
2. **Test xanh không phải bằng chứng.** Yêu cầu nguyên văn của chủ dự án: *"tao không quan tâm mấy cái test xanh test đỏ… thứ tao quan tâm nhất là liệu có hoạt động không, show khách được chưa."* Ghi ảnh chụp thật, ID deployment, kết quả truy vấn — không ghi mỗi số bài test.
3. **Nói rõ chạy ở đâu.** "Migration apply sạch" trên container cục bộ và trên Supabase production là hai câu khác nhau. Nhầm chỗ này đã tạo ra một tuyên bố "đã lên production" sai suốt một đợt làm việc.
4. **Không chép lại hiện trạng từ HANDOFF sang đây.** Dẫn chiếu, đừng nhân bản.

---

## Bối cảnh khởi đầu đợt TC

**26/08/2026 — lập kế hoạch, chưa viết mã.**

Đọc lại toàn bộ repo một lượt để giao việc: 49 migration / 21.880 dòng SQL, 124 bảng, 127 function, 161 policy, 55.370 dòng TypeScript, 133 file test. Đối chiếu với bộ tài liệu chiến lược chủ đầu tư gửi 25/08 (4 infographic + 3 PDF).

**Điểm xuất phát kế thừa** (chi tiết ở `HANDOFF.md`, không chép lại):
- T1–T17, W1–W5, CUS-01→08 và A6 đã có mã nguồn; 039→048 đã apply Supabase production `vzewjfcwhovsxslqfpjt`.
- A6 **chưa đóng**: thiếu smoke production A3/A5 sau kích hoạt → thành TC-00.
- `ERP-UX-01` mở ngày 25/08 → thành TC-04.
- Production **không có PITR, không có physical backup**. Sau khi có dữ liệu thật, chỉ được rollback bằng forward migration bảo toàn dữ liệu.

**Bảy phát hiện từ lượt đọc mã nguồn này** — đều đã kiểm từ file thật, và đều làm đổi cách giao việc:

| # | Phát hiện | Hệ quả |
|---|---|---|
| 1 | Logic **MIN điểm nghẽn đã chạy sẵn** — `202608200043` dòng 413 `order by hourly_capacity asc` | TC-01 là mở rộng, không phải xây mới. Rẻ hơn nhiều so với ước lượng ban đầu |
| 2 | `bottleneck_kind` chỉ cho **3 giá trị**, seed chỉ **1 ngưỡng/cơ sở** | MIN đang chạy trên tập một phần tử — đúng kỹ thuật, vô nghĩa nghiệp vụ |
| 3 | `customer_product_capacity_templates` có `primary key (tenant_id, product_id, site_id)` | **Một sản phẩm chỉ được một khung giờ.** Chặn cứng ở schema, không phải thiếu giao diện |
| 4 | `erp_tickets.product` **đã có sẵn** `'adult'`, `'child'`, `'group'`, và `channel` đã có `'doi-tac'` | Tầng vé không thiếu gì; thiếu ở tầng đặt chỗ. TC-03 không cần đụng T8 |
| 5 | Checkout công khai chỉ có **ngày + số khách**; hold **loop qua mọi template active** | Khách không chọn được giờ — trái nguyên tắc cứng số 1 của khách hàng |
| 6 | **Hai migration cùng số 039**, cả hai đã apply production | Cấm đổi tên. Ghi thành QĐ-09 |
| 7 | **26 file** dùng `SUPABASE_SECRET_KEY`; 161 policy chưa bảo vệ `/erp` | Quy mô thật của T6c/TC-08, lớn hơn con số "143 policy" ghi trong tài liệu cũ |

**Mười quyết định đã chốt** để gỡ các điểm treo: xem `PHAN_GIAO_VIEC_TAM_COC.md` mục 1. Nặng nhất là **QĐ-01** — giữ mô hình ẩn danh trước, **không thu CCCD/hộ chiếu**, vì hai tài liệu của chính khách hàng mâu thuẫn nhau và quyết định lãnh đạo số 1 trong báo cáo tổng thể có sức nặng cao hơn infographic.

**Chưa làm gì cả trong đợt này.** Mọi mã nguồn còn nguyên trạng; hai file thay đổi duy nhất là tài liệu. Việc kế tiếp là **TC-00** bằng **Opus 5 / High**.

---

## Nhật ký

## TC-01 — Công suất nhiều điểm nghẽn + hệ số an toàn
**Ngày:** 26/08/2026 · **Model:** Opus 5 / High · **Commit:** `<sha>` · **Trạng thái:** 🟡 mã xong, **migration CHƯA áp production, mã CHƯA deploy**

### Đã làm
- Migration `202608260049_erp_capacity_multi_bottleneck.sql`: nới `bottleneck_kind` từ 3 lên 9 giá trị; thêm `capacity_model`, `static_capacity`, `safety_factor`, và cột sinh `effective_capacity`; ràng buộc chéo *tĩnh thì bắt buộc có số chỗ*; nới `check` trên `erp_capacity_audit_events.action`.
- RPC `erp_capacity_update_threshold` nhận thêm ba tham số, **đều có mặc định NULL nghĩa là giữ nguyên**, và bản 10 tham số cũ bị `drop` tường minh — `create or replace` khớp theo kiểu tham số nên không drop thì hai bản hàm cùng tồn tại.
- **RPC mới `erp_capacity_create_threshold`.**
- `customer_create_booking_hold` chuyển sang đọc `effective_capacity` — **4 chỗ**, không phải 2 như phiếu giao việc ghi.
- Tầng ứng dụng: `CapacityModel`/`CapacityBottleneckKind`, `calculateEffectiveCapacity`, repository đọc/ghi cột mới, hành động máy chủ tạo ngưỡng, màn hình T11a có form thêm điểm nghẽn và hiện đúng công thức theo mô hình.

### Đã kiểm chứng thật
- **Chạy trọn migration trên PostgreSQL 17 thật** (production, trong một transaction, kết thúc bằng `rollback`), kèm 9 phép đo — tất cả đạt:

  | Phép đo | Kết quả |
  |---|---|
  | Bất biến 4 hàng đang chạy | `effective = hourly`, 4/4 |
  | Ngưỡng tĩnh 250 chỗ | `effective = 250` |
  | Hệ số 0,8 trên 40 chỗ/giờ | `effective = 32` |
  | MIN qua nhiều mô hình | chọn đúng 32 trong {300, 250, 32} |
  | Tĩnh thiếu số chỗ | chặn `22023` |
  | Hệ số > 1 | chặn `22023` |
  | Nhân viên tạo ngưỡng | chặn `42501` |
  | Trùng mã ngưỡng | chặn `23505` |
  | Lời gọi 10 tham số cũ | vẫn chạy, không đổi mô hình/hệ số |

- Cục bộ: `typecheck` sạch, `lint` sạch, `test:run` **630 pass + 1 skip**, `build` sạch. Bài kiểm hợp đồng mới 13/13.

### KHÔNG chứng minh được điều gì
- **Migration CHƯA được áp lên production.** Mọi thứ ở trên chạy rồi rollback, nên schema production **vẫn nguyên trạng 048**.
- **Mã nguồn CHƯA deploy, và cố ý không đẩy.** Màn hình T11a mới `select` `capacity_model`/`effective_capacity`; deploy trước khi áp migration là làm gãy màn hình sức chứa trên production. Thứ tự bắt buộc: **migration trước, mã sau**.
- **Chưa có ai bấm thật trên giao diện.** Form thêm điểm nghẽn mới chỉ qua typecheck/lint/build, chưa chạy Playwright và chưa chụp ảnh.
- **Chưa chứng minh MIN đúng trên production** — phép đo MIN chạy trên dữ liệu do chính lượt thử tạo ra rồi rollback.

### Lỗi thật bắt được khi làm
1. **`erp_capacity_audit_events.action` có `check` chỉ nhận `'threshold.seeded'` và `'threshold.updated'`.** RPC tạo ngưỡng ghi `'threshold.created'` nên **cả lời gọi thất bại**. Đọc SQL không thấy vì lỗi nằm ở một bảng khác bảng đang sửa; chỉ lộ ra ở lượt chạy thật. Đúng lý do ràng buộc #4 tồn tại.
2. **Phiếu giao việc ghi thiếu.** Nó nói đổi `hourly_capacity` ở "dòng 413 và 434". Thực tế có **bốn** chỗ — còn hai chỗ nữa ở nhánh làm mới ảnh chụp khi ngưỡng đổi phiên bản. Tìm ra nhờ `grep` rồi `diff`, không chép tay.
3. **Sản phẩm không hề có đường tạo ngưỡng.** Chỉ có RPC sửa, nên mỗi cơ sở đúng một ngưỡng và "MIN của mọi điểm nghẽn" chạy trên tập một phần tử — đúng kỹ thuật, vô nghĩa nghiệp vụ. Nới `bottleneck_kind` mà không có hàm tạo thì hoàn toàn vô ích. Đây là phần phiếu giao việc không lường trước.
4. **Thiếu câu tiếng Việt cho mã lỗi mới** `CAPACITY_THRESHOLD_CODE_TAKEN` — bị chính bài kiểm `erp-rpc-error-messages` của dự án bắt. Hàng rào hoạt động đúng.
5. **Ngưỡng tĩnh vẫn mang một `hourly_capacity` vô nghĩa** (ví dụ 1), vì ba cột vòng quay là NOT NULL. Không sửa được ở schema mà không đổi ý nghĩa `hourly_capacity` — điều bị cấm. Đã xử ở tầng hiển thị: mô hình tĩnh **không in** công thức vòng quay.

### Để lại cho phiên sau
- **Chặn cứng:** `npx supabase db push --linked` bị cổng an toàn của Claude Code từ chối. Em **không** dùng `db query --file` để áp cùng nội dung đó vì như vậy là lách đúng ý định vừa chặn. Cần chủ dự án tự chạy, hoặc cấp quyền.
- Sau khi áp migration: đẩy mã, deploy, rồi mới chạy smoke T11a.
- Kiểm lại `prod-smoke-t11-capacity-ui.spec.ts` sau khi deploy — màn hình đã đổi bố cục.

---

## TC-04 — ERP-UX-01: mạch dẫn theo vai
**Ngày:** 26/08/2026 · **Model:** Opus 5 / High *(phiếu giao việc ghi Sonnet 5; chạy bằng model cao hơn không vi phạm — luật chỉ cấm hạ xuống Haiku)* · **Commit:** `<sha>` · **Trạng thái:** ✅ xong

### Đã làm
Bảy trong tám nguyên nhân ghi ở `ERP-UX-01` đã được xử lý.

- **Bỏ đánh số 01–08 và 8 màu vô nghĩa** trên lưới thẻ `/erp/[site]`. Đánh số hứa một trình tự không có thật — các nghiệp vụ này chạy song song. Màu trước đây mỗi module một sắc, không mã hoá gì. Thứ duy nhất còn màu là nhãn "Giai đoạn sau", vì nó mã hoá đúng một điều.
- **Gộp về một bộ tên.** Lưới thẻ nay gom theo đúng `ERP_MODULE_GROUPS` mà thanh điều hướng đang dùng, nên chỉ còn **một** cách sắp xếp phải học. Bỏ luôn danh sách "ưu tiên giám đốc" nhét cứng tại chỗ và tiêu đề *"Tài chính, rủi ro và dự án"* vốn gắn lên một nhóm có cả sức chứa lẫn camera — tiêu đề không khớp nội dung (nguyên nhân #5).
- **Hạ trọng số ô chưa đo được, không ẩn.** Hai ô `—` nay viền đứt, chữ nhỏ, mờ hơn; số có nguồn nổi lên trước. Giữ **nguyên văn** chuỗi "Chưa có nguồn dữ liệu" — đó là từ vựng sẵn có của dự án và đang được `prod-smoke-site-overview-kpis` khẳng định.
- **Đưa trợ lý ra khỏi vùng nội dung.** Đây là chỗ ảnh chụp dạy lại em: thoạt đầu chỉ hạ `z-[1000]` → `z-[90]` cho nó nằm dưới lớp menu, rồi chừa `padding` đáy. Ảnh chụp thật cho thấy **vẫn sai** — nút nổi đè lên thẻ chốt ca và giấu mất huy hiệu "Chuyển giám đốc". Nút nổi thì luôn che một thứ gì đó. Nay nó là nút bình thường trên thanh đầu trang; không còn lớp nổi nào đè nội dung.
- **Trang giám đốc có mạch dẫn.** Tiêu đề đổi từ một phép tính ("3 ca · 1 phiếu công việc") thành **tên người đang đăng nhập**, đúng khuôn trang nhân viên. Thêm khối **"Việc cần làm trước tiên"**: đúng một việc, một nút chính, kèm dải "Vào cơ sở" — trước đây giám đốc đăng nhập xong **không có một liên kết nào** tới module (nguyên nhân #1). Thứ tự ưu tiên theo mức chặn nghiệp vụ, không theo thời gian tạo: cổng Go/No-Go chặn mở cửa cả cơ sở nên đứng trước, kế đến sự cố quá SLA.
- **Đồng hồ đếm ngược có lối thoát.** Thẻ SLA vốn đã là liên kết nhưng không có gì nói ra; nay có "Xử lý →" (nguyên nhân #7).
- **Hết ô KPI trùng một bản ghi.** Trang Sự cố khi chỉ có một hồ sơ mở thì bốn ô đều bằng 1, cộng huy hiệu là **năm con số 1 cho một bản ghi**. Nay dưới ngưỡng 2 hồ sơ thì thay bằng một câu; **không ẩn số liệu** — danh sách đầy đủ vẫn ngay bên dưới.
- **Trang quản lý:** kiểm rồi, **không sửa gì**. Nó đã sẵn có danh tính, một nút chính và danh sách việc ưu tiên — tức đã theo khuôn trang nhân viên từ trước. Phiếu giao việc ghi "giám đốc **và** quản lý", nhưng chỉ vai giám đốc thật sự thiếu.

### Đã kiểm chứng thật
- `typecheck` sạch, `lint` sạch, `test:run` **612 pass + 1 skip**, `build` sạch.
- **Ảnh chụp thật** 2 vai (`giamdoc`, `nv.trangan`) × desktop 1440 × Pixel 7, **reduced-motion**, 10 ảnh: **tràn ngang = 0 ở cả 10**.
- Playwright cục bộ: `erp-assistant-thread`, `erp-navigation`, `erp-context-help`, `erp-access` → **41 pass**, 11 skip, **2 fail**.
- **Hai bài đỏ đó đã được chứng minh là có sẵn từ trước:** em `git stash` toàn bộ thay đổi rồi chạy lại trên bản gốc — **đỏ y hệt**. Không phải hồi quy do TC-04. Đã mở thành `ERP-UX-02`.
- Trước khi chụp, em phát hiện máy chủ cục bộ **vẫn đang phục vụ bản build cũ** (`taskkill` PID chiếm cổng 3100 mới dừng được). Đã đối chiếu `_buildManifest.js` theo `BUILD_ID` để chắc ảnh chụp là của bản mới — đúng cảnh báo "môi trường cũ" trong `AGENTS.md`.

### KHÔNG chứng minh được điều gì
- **Chưa chứng minh chủ dự án hết thấy rối.** Đây là thay đổi kiến trúc thông tin; thước đo thật là buổi dùng thử tiếp theo, không phải ảnh chụp hay số bài test.
- **Chưa chạm production.** Toàn bộ đo trên bản build cục bộ chế độ `demo-cookie`.
- **Nguyên nhân #6 vẫn còn:** bốn sự cố "Khách cần hỗ trợ y tế tại cổng chính" giống hệt nhau từng chữ, chỉ khác tên cơ sở. Đây là **dữ liệu seed**, không phải lỗi giao diện — sửa ở tầng hiển thị là che mất một dữ liệu sai. Cố ý để lại.
- **Chiều cao trang mobile giảm** (`/erp` giám đốc 3.734px so với 8.765px ghi ngày 25/08) nhưng em **không nhận công**: TC-04 không gỡ nội dung nào khỏi `/erp`, nên chênh lệch này nhiều khả năng do lượng dữ liệu khác nhau giữa hai lần đo.

### Lỗi thật bắt được khi làm
1. **Bản vá đầu tiên của em cho nút trợ lý là sai**, và chỉ ảnh chụp mới chỉ ra. Hạ z-index giải quyết đúng nửa vấn đề (lúc menu mở); nửa còn lại — nút đè lên nội dung lúc cuộn giữa trang — vẫn nguyên. Phiếu giao việc viết là *"đưa ra khỏi vùng nội dung"*, em đọc thành *"xếp lớp lại cho đúng"*. **Nếu chỉ chạy test thì bản vá sai đó đã xanh.**
2. **Em suýt đổi một chuỗi không cần đổi.** Sửa "Chưa có nguồn dữ liệu" thành câu khác nghe ấm hơn, nhưng đó là từ vựng chuẩn của dự án và đang có một smoke production khẳng định. Đã trả lại nguyên văn.
3. **`erp-navigation` đỏ do chính thay đổi của em**, và là lỗi thật của bài kiểm: nó bấm `getByRole("heading", { name: "Tràng An" })` mà không `exact`. Trước đây vai giám đốc thấy tiêu đề khác hẳn nên khớp lỏng **tình cờ** vẫn trúng một phần tử. Đã sửa bài kiểm, không sửa sản phẩm.
4. **Máy chủ cục bộ phục vụ bản build cũ** suốt một lượt chụp. `pkill` không hạ được tiến trình Next trên Windows; phải `taskkill //PID //F` theo PID lấy từ `netstat`.

### Để lại cho phiên sau
- `ERP-UX-02` — hai bài mobile đỏ có sẵn. Một bài khẳng định chuỗi `"Doanh thu & hiệu quả"` **không còn tồn tại trong mã nguồn** (trang `/erp/finance` đã viết lại, khả năng từ T13); bài kia là luồng giọng nói không điều hướng tới `/erp/trang-an/du-an-su-kien` — **cái này có thể là lỗi sản phẩm thật**, cần soi riêng.
- Nguyên nhân #6 (4 sự cố seed trùng chữ) — sửa ở tầng dữ liệu, không phải giao diện.

---

## TC-00 — Đóng A6: canary và smoke production A3/A5
**Ngày:** 26/08/2026 · **Model:** Opus 5 / High · **Commit:** *(chưa commit)* · **Trạng thái:** ✅ xong — smoke production 6/6 xanh

### Đã làm
- Chạy smoke A6 thật lên `https://ninhbinhjourney.vercel.app` → **đỏ ở bước đăng nhập**, không phải ở phần nghiệp vụ.
- Truy nguyên tới gốc: `lib/erp/demo-data.ts:33-44` phân giải mật khẩu *biến môi trường trước, mặc định sau*; production đã đặt cả sáu `ERP_DEMO_*_PASSWORD` từ 22/08; **121 chỗ trong 27 spec** chép cứng đúng chuỗi mặc định.
- Loại trừ giả thuyết cạnh tranh trước khi kết luận: `director-001` **không có** `workforceProfile` → `isDemoErpAccountActive` luôn trả `true`, tài khoản không hề bị khoá.
- Dựng `tests/e2e/support/erp-credentials.ts` làm nguồn duy nhất, phân giải **cùng quy tắc với sản phẩm**; thay toàn bộ 121 chỗ chép cứng ở 29 file.
- Sửa mục 2.4 `HANDOFF.md` — chỗ tự mâu thuẫn với mục 4 suốt từ 21/08.
- Mở hai mã việc mới: `ERP-SMOKE-01` (chặn hiện tại) và `ERP-SMOKE-02` (bom hẹn giờ 01/09).
- **Viết hai spec smoke production còn thiếu.** Phiếu giao việc ghi TC-00 là "chạy smoke A3/A5", nhưng đọc mã nguồn thì **cả hai đều chưa từng tồn tại ở dạng smoke production**: `erp-offline-gate.spec.ts` `page.route(...)` cả `/manifests` lẫn `/sync` nên chạy trọn vẹn với máy chủ giả — trỏ vào production vẫn chỉ kiểm giao diện; còn A5 (`/erp/marketing`) **không có spec nào ở bất kỳ tầng nào**. Đã thêm `tests/e2e/prod-smoke-a3-offline-gate.spec.ts` và `tests/e2e/prod-smoke-a5-funnel.spec.ts`, cả hai chỉ đọc, cùng khuôn cổng chặn với smoke A6 (bắt buộc `PLAYWRIGHT_BASE_URL` đúng host + biến bật tường minh).
  - A3 **không bấm "Nạp vé cho ca"** — nút đó ghi một manifest thật và dự án **không có RPC xoá manifest**, nên theo `AGENTS.md` đây là thao tác ghi không dọn được. Spec còn chặn ở tầng mạng mọi request không phải GET tới `/api/erp/offline-gate/**` và **fail nếu có** — không tin vào việc "mình sẽ không bấm nhầm".
  - A5 **cố ý không khẳng định một con số nào**. Nó kiểm *tính trung thực*: có dữ liệu thì hiện bảng, chưa có thì phải nói thẳng "Chưa có sự kiện thật trong cửa sổ 7 ngày" / "Chưa có slot CUS-06". Một bảng rỗng im lặng bị coi là đỏ.

### Đã kiểm chứng thật
- **Production, chỉ đọc, không ghi gì:**
  - `/api/health` → `experienceMode=production`, `dataMode=supabase-shared`.
  - `POST /api/erp/offline-gate/manifests` (Origin đúng, body hợp lệ, không phiên) → **401 `ERP_SESSION_REQUIRED`**. Route kiểm cờ **trước** kiểm phiên, nên đây là bằng chứng `ERP_OFFLINE_GATE_ENABLED` **đang BẬT**. Probe dừng trước `prepareOfflineGateManifest` → **không tạo manifest**.
  - `supabase migration list --linked` → local/remote khớp **toàn bộ 49 migration**, gồm `202608200045`. Xác nhận luôn QĐ-09: **hai** migration số 039 cùng tồn tại và cùng đã apply.
  - `vercel env ls production` → chỉ đọc **tên biến**. Không `env pull`, không ghi giá trị nào xuống đĩa.
- **Cục bộ:** `npm run typecheck` sạch, `npm run lint` sạch, `npm run test:run` **612 pass + 1 skip**, `npm run build` sạch.
- **Smoke production 6/6 XANH** (3 spec × desktop + Pixel 7), chạy với `PLAYWRIGHT_BASE_URL` tường minh, tổng 19,7 giây:
  - **A6** — giám đốc đọc verdict thật ở `/erp/release`: **`ĐỦ ĐIỀU KIỆN KỸ THUẬT ĐỂ LẬP CANARY`**, đủ **7 nhóm "Schema sẵn sàng"**. Đây là lần đầu điều này được **đo** sau kích hoạt 21/08; trước đó chỉ là kỳ vọng ghi trong tài liệu.
  - **A3** — console ngoại tuyến sống thật ở `/erp/tam-coc/check-in-khach` trên cả hai khổ màn hình; nút "Ghi vào hàng đợi" **bị khoá** khi chưa nạp bộ vé (fail-closed đúng thiết kế); chốt chặn tầng mạng **không kích hoạt lần nào** → không có một request ghi nào.
  - **A5** — bảng phễu hiện ra, tức `CUSTOMER_FUNNEL_DASHBOARD_ENABLED` **bật** *và* `getCustomerFunnelReport()` **không ném lỗi** trên production; không rơi vào nhánh "Kho QR chưa sẵn sàng"; các khối trống đều **nói thẳng lý do**; không tràn ngang.
- **Bước 5 — đối chiếu batch divergence.** Truy vấn trực tiếp production (chỉ đọc): `erp_gate_offline_manifests` **0**, `erp_gate_offline_sync_batches` **0**, `erp_gate_offline_sync_items` **0**, item `reconciliation_status = 'diverged'` **0**. Không có gì để đối soát vì **chưa từng có ca ngoại tuyến nào chạy thật**. Con số 0 manifest đồng thời chứng minh **hai lượt A3 vừa rồi không để lại dữ liệu nào** — bằng dữ liệu, không chỉ bằng chốt chặn trong spec.

### KHÔNG chứng minh được điều gì
- **`canary-ready` KHÔNG phải là "đã go-live".** Chính trang `/erp/release` tự giới hạn: nó chỉ được phép kết luận *"đủ điều kiện kỹ thuật để lập canary"*, **không thay** phê duyệt policy, cũng **không thay** nghiệm thu người dùng. A6 xanh nghĩa là cổng kỹ thuật đã mở, không phải sản phẩm đã được duyệt bán.
- **Cổng ngoại tuyến chưa từng chạy một ca thật.** 0 manifest / 0 batch trên production. A3 chứng minh **màn hình sống và fail-closed đúng**; nó **không** chứng minh việc quét khi mất mạng rồi đối soát lại hoạt động với dữ liệu thật. Bài đó chỉ có thể làm tại hiện trường, có thiết bị và bộ vé thật, và **sẽ ghi dữ liệu** — nên phải có phương án dọn trước khi làm.
- **Đối soát batch chưa được kiểm.** Không có `diverged` nào để đọc vì chưa có gì được đồng bộ. Đây là "chưa có dữ liệu", **không phải** "đã chứng minh không lệch".
- **A5 chưa kiểm tính đúng của con số.** Bài cố ý chỉ kiểm *tính trung thực* của màn hình. Việc phễu có đếm đúng hay không cần đối chiếu với `customer_events` — chưa làm.
- **Chưa đọc giá trị 10 cờ.** Mới có bằng chứng hành vi cho `ERP_OFFLINE_GATE_ENABLED` và `CUSTOMER_FUNNEL_DASHBOARD_ENABLED` (cả hai **bật**). Các cờ còn lại chỉ biết là **tồn tại**.

### Lỗi thật bắt được khi làm
1. **27 spec smoke production mất đường đăng nhập suốt 4 ngày mà không ai biết**, vì chưa ai chạy lại smoke sau khi đặt biến môi trường ngày 22/08. Chỉ lộ ra khi chạy thật lên production — đọc code không thấy, vì bản thân code không sai; sai là ở chỗ **hai nơi cùng giữ một hằng số**.
2. **Triệu chứng giả:** production trả "Tên đăng nhập hoặc mật khẩu không đúng" trông y như hệ thống hỏng. Nếu dừng ở đó và báo cáo, đây đã là báo cáo "lỗi nghiêm trọng" giả thứ hai của dự án.
3. **Bom hẹn giờ 01/09/2026** (`ERP-SMOKE-02`) — chỉ tìm ra nhờ đang truy nguyên chuyện khác.
4. **Tài liệu sai ở mục 2.4** — nói migration 045 chưa apply, trong khi remote đã có từ 21/08 và chính mục 4 ghi ngược lại.
5. **Lỗi trong chính spec A5 tôi vừa viết:** `getByText("Profile chưa gắn nguồn")` trúng **hai** phần tử, vì đoạn dẫn của bảng cũng chứa nguyên cụm đó; Playwright từ chối ở strict mode. Thiếu `exact: true`. Chỉ lộ ra khi chạy thật với DOM production.
6. **Một báo động giả, và nó dạy đúng bài học của cả buổi.** Lượt chạy thứ hai **cả 6 bài đỏ** ở bước đăng nhập, cùng triệu chứng hệt lượt đầu tiên buổi sáng. Nhưng lần này nguyên nhân khác hẳn: gõ lệch mật khẩu ở ô nhập ẩn. Phân biệt được nhờ **đo trước khi đoán** — `/api/health` không đổi, dấu thời gian `ERP_DEMO_DIRECTOR_PASSWORD` vẫn là bản 4 ngày trước, và đường đăng nhập là hàm tất định (sha256 + `timingSafeEqual`, **không khoá tạm, không giới hạn số lần thử**). Server không đổi + hàm tất định + kết quả đổi ⇒ đầu vào đã khác. Đã vá bằng cách cho script hỏi hai lần và báo số ký tự nhận được.

**Bài học ghi lại:** *"Tên đăng nhập hoặc mật khẩu không đúng"* trên production xuất hiện **hai lần trong một buổi với hai nguyên nhân hoàn toàn khác nhau** — một lần là lỗi hạ tầng thật, một lần là gõ nhầm. Cùng triệu chứng không có nghĩa là cùng nguyên nhân. Đây chính là cơ chế đã sinh ra báo cáo "lỗi nghiêm trọng" giả trước đây.

### Để lại cho phiên sau
- **Cách chạy lại bộ smoke này** — cần `ERP_DEMO_DIRECTOR_PASSWORD` thật, chỉ chủ dự án có. **Không** `vercel env pull` (ghi secret xuống đĩa). Đường dễ nhất, tự hỏi mật khẩu, tự xoá biến sau khi chạy kể cả khi đỏ:

  ```powershell
  powershell -ExecutionPolicy Bypass -File d:\ninhbinh\scripts\run-prod-smoke-tc00.ps1
  ```

  Bản Bash tương đương, nếu chạy tay:

  ```bash
  ERP_DEMO_DIRECTOR_PASSWORD='<mật-khẩu>' \
  PLAYWRIGHT_BASE_URL=https://ninhbinhjourney.vercel.app \
  NBJ_A6_RELEASE_SMOKE=1 NBJ_A6_RELEASE_EXPECTATION=canary-ready \
  NBJ_A3_OFFLINE_SMOKE=1 NBJ_A5_FUNNEL_SMOKE=1 \
  npx playwright test \
    tests/e2e/prod-smoke-customer-release-readiness.spec.ts \
    tests/e2e/prod-smoke-a3-offline-gate.spec.ts \
    tests/e2e/prod-smoke-a5-funnel.spec.ts --reporter=list
  ```

- **Nếu A6 ra `blocked` thay vì `canary-ready`:** đừng bật thêm cờ nào để "chữa". Đọc đúng nhóm schema/cờ mà `/erp/release` chỉ ra, vì thứ tự dependency đã mã hoá trong `domain/customer-release-readiness.ts` và bật sai thứ tự làm verdict fail-closed **đúng như thiết kế**.
- `ERP-SMOKE-02` cố ý chưa vá — còn 5 ngày trước khi tự đỏ (tính từ 26/08).
- **Ca ngoại tuyến thật tại hiện trường vẫn là việc chưa ai làm.** Nó **sẽ ghi** manifest + batch vào production và dự án **không có RPC xoá manifest** — phải chốt phương án dọn *trước*, không phải sau.
- `git stash@{0}` (T6c) và `git stash@{1}` vẫn chưa xử lý.
- **Việc kế tiếp: TC-01** (công suất nhiều điểm nghẽn + hệ số an toàn) bằng **Opus 5 / High**. TC-04 chen được song song bằng **Sonnet 5**, không có tiên quyết.

---
