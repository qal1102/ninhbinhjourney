,# NINH BÌNH JOURNEY — BÀN GIAO

> **Đây là tài liệu duy nhất bắt buộc đọc trước khi làm việc.** Mọi tài liệu khác trong `docs/reference/` chỉ đọc khi bắt đầu đúng đầu việc cần tới nó; `docs/archive/` là lịch sử, không dùng để kết luận hiện trạng.
>
> Cập nhật: **02/08/2026**. Mọi con số dưới đây kiểm trực tiếp trên Supabase production hoặc mã nguồn cùng ngày.

---

## 1. Khách hàng cần gì, và ưu tiên ra sao

Hai thứ, **không ngang nhau**:

1. **Phần mềm quản lý nội bộ (ERP) — đây là thứ khách cần nhất.** Phải đạt mức *production-ready* cho buổi demo. Toàn bộ nỗ lực tập trung ở đây.
2. **Web cho khách du lịch quét QR để trải nghiệm.** Quan trọng, nhưng **để sau**. Không đánh đổi chất lượng ERP để làm web.

Nguyên tắc chọn việc: **việc nào làm buổi demo ERP thuyết phục hơn thì làm trước.** Việc nào chỉ đẹp trên giấy thì bỏ qua.

---

## 2. Hiện trạng thật — cái gì chạy thật, cái gì không

### 2.1 Nền tảng: tốt thật, không phải sơn phết

- Postgres/Supabase, **RLS bật trên 100% bảng**, 143 policy, **0 policy cấp cho `anon`**, **0 hàm thiếu `search_path`**, RPC nghiệp vụ chỉ `service_role` gọi được.
- **24 migration**, tất cả nguyên khối `begin;`/`commit;`, mỗi cái có một bài kiểm tra hợp đồng riêng.
- Phân tách nhiệm vụ thật: kế toán lập ≠ người duyệt, quản lý không tự duyệt hồ sơ mình tạo, ngoại lệ đẩy lên giám đốc. Có khoá phiên bản, idempotency key, nhật ký kiểm toán không sửa được.
- Dữ liệu chảy thật xuyên tài khoản — đã kiểm nhiều lần bằng hai trình duyệt tách biệt trên production thật.
- **Đã có cơ chế chạy theo thời gian** (từ 02/08): sự cố quá hạn SLA tự chuyển cấp mỗi phút bằng `pg_cron`, ghi rõ "Hệ thống" thực hiện, chạy lại không nhân bản dữ liệu.
- 307 bài test cục bộ + 56 bài `prod-smoke-*` chạy trên production thật.

### 2.2 Module: 10 thật / 5 rỗng

| Có nghiệp vụ thật (10) | Chỉ là bảng số tĩnh (5) |
|---|---|
| Vé & đặt chỗ · Check-in khách · Camera AI · Báo cáo hiện trường · Dự án & sự kiện · Sự cố · Nhân sự · Chấm công · Đối tác & NCC · Tài chính & đối soát | **Sức chứa** · **Xe trung chuyển** · **Tài sản** · **SOP & diễn tập** · **Báo cáo & dự báo** |

Hai trong năm module rỗng (**Sức chứa**, **SOP**) đúng là hai thứ tài liệu khách nhấn mạnh nhất.

### 2.3 Ba sự thật về kiến trúc mà nhìn bên ngoài không thấy

**a) `/ops` không phải hệ thống thứ hai — nó là một cuộc chuyển kiến trúc bị bỏ dở.**

`auth.users` = **0**, `user_profiles` = **0**, `tenant_memberships` = **0**, `erp_site_assignments` = **0**. Không ai đăng nhập được vào `/ops`, dù màn hình đăng nhập vẫn công khai trên production.

Và cả mô hình dữ liệu của nó cũng rỗng: `incidents`, `bookings`, `passes`, `quotes`, `erp_projects`, `erp_ticket_scans`, `erp_attendance_events`, `erp_camera_*`, `erp_decision_items`, `erp_operational_signals`, `erp_partners*`, `erp_finance_ledger_entries` — **0 dòng tất cả**. Trên 81 bảng, khoảng **20 bảng là xác chết**: dựng ở migration 002 cho `/ops`, rồi bị bỏ và xây lại dưới tên khác cho `/erp`.

→ Việc cần làm không phải "chọn một trong hai", mà là **hoàn tất cuộc chuyển đó cho tử tế**.

**b) Có ba nguồn sự thật về phân quyền, và chúng đang lệch nhau.**

| Nguồn | Trạng thái |
|---|---|
| `lib/erp/demo-data.ts` | App đang dùng — 10 tài khoản cứng trong mã nguồn |
| `erp_employee_access` | App đang dùng — **một dòng/người, MỘT cơ sở duy nhất** |
| `erp_account_registry` + `erp_account_role_assignments` | **App chưa từng đọc**, nhưng **RPC kế toán và NCC lại chặn quyền bằng nó** |

Chính chỗ lệch này đang gây ra một lỗi thật (mục 3).

**c) Thứ khó nhất cho việc quản lý tài khoản thì đã có sẵn, chỉ chưa nối.**

`erp_account_registry` đã có `auth_user_id uuid references auth.users(id)` — **cầu nối sang Supabase Auth**; có `status` (active/suspended/revoked) — **khoá tài khoản**. `erp_account_role_assignments` là **một dòng cho mỗi (tài khoản × vai trò × cơ sở)** — tức **đã hỗ trợ một quản lý phụ trách nhiều khu**. Bảng app đang dùng thì không làm được điều đó.

### 2.4 Chưa dùng được với người thật

- **Không tạo được tài khoản** — 10 người nằm cứng trong mã nguồn, tuyển người mới phải deploy.
- **Mật khẩu dùng chung theo cấp**, và **in thẳng trên `/erp/login` production**. Mọi dòng nhật ký kiểm toán vì thế đều chối bỏ được — làm hỏng đúng giá trị cốt lõi của hệ thống.
- **Thiếu vai trò trưởng ca**; **chưa có bàn giao ca** (một trong tám tiêu chí nghiệm thu pilot của khách).
- **Không có chế độ ngoại tuyến** ở bất kỳ đâu — bến thuyền, hang động, khu núi sóng chập chờn là chuyện thường ngày.

### 2.5 Hai đầu dòng tiền đều hở

- **Cổng soát vé không kiểm vé.** `erp_gate_scan_events` chỉ có `code text` (6–60 ký tự), **không khoá ngoại tới vé/booking, không ràng buộc `unique`, không idempotency key**. Gõ `ABC123` là ghi nhận một lượt khách; quét 10 lần thành 10 lượt.
- **Chốt ca dừng ở `posted`** — không có nộp quỹ → ngân hàng → đối chiếu sao kê.
- **Công nợ NCC dừng ở `posted`** — **không có trạng thái `paid`**. Ghi nhận nợ ai rất chặt, nhưng không bao giờ ghi nhận đã trả.

→ Hệ thống kiểm soát rất chặt **khúc giữa**, hở **cả hai đầu**.

### 2.6 Web công khai

- **Không bán được hàng, và bị chặn ở tầng cấu hình:** `config/experience.ts` cấm chế độ production bật sandbox checkout, và không có cổng thanh toán thật. Trang gói ghi thẳng *"online booking unavailable"*.
- **Web 8 điểm / ERP 4 cơ sở**, giao nhau 3. **Tam Chúc không xuất hiện lần nào trên web** dù là cơ sở dùng nhiều nhất trong ERP.
- **Luồng QR khách du lịch (`/pass/[token]`, `/demo/qr/...`) nằm trong stack `/ops` đã chết, và bảng `passes`/`bookings` đều rỗng** → yêu cầu thứ hai của khách hiện **chưa có gì chạy được**. Nó phải được dựng lại dựa trên module check-in của ERP, không phải vá stack cũ.

---

## 3. 🔴 Lỗi nghiêm trọng đang tồn tại trên production

**3/4 quản lý cơ sở không dùng được module Đối tác & NCC.**

RPC `erp_ap_submit_supplier_invoice` chặn bằng `erp_account_has_active_role(...)`, tra bảng `erp_account_registry`. Chạy đúng hàm đó trên production:

| Tài khoản | Gửi được hoá đơn NCC? |
|---|---|
| `manager-trang-an` | ✅ true |
| `manager-tam-chuc` | ❌ **false** |
| `manager-tam-coc` | ❌ **false** |
| `manager-bai-dinh` | ❌ **false** |

**Nguyên nhân:** V12 (01/08) tách một quản lý vùng thành bốn quản lý cơ sở trong `demo-data.ts`, nhưng không cập nhật registry dưới Supabase. Registry vẫn là ảnh chụp cũ: chỉ 1 quản lý, và người đó giữ `regional-manager` trên **cả 4 cơ sở**.

**Hai hệ quả kèm theo:**
- **Toàn bộ hoá đơn NCC ở cả 4 cơ sở đang mang tên `manager-trang-an`** — ghi sai người chịu trách nhiệm trong một hệ thống lấy maker≠checker làm giá trị cốt lõi.
- App nói *"quản lý Tràng An chỉ thấy Tràng An"*, cơ sở dữ liệu nói *"là quản lý vùng của cả bốn"*. **Hai tầng mâu thuẫn về quyền.**

**Vì sao chưa ai thấy:** `prod-smoke-ap.spec.ts` đăng nhập bằng đúng tài khoản duy nhất còn chạy được. Test xanh, tính năng hỏng ở 3/4 cơ sở.

---

## 4. HÀNG VIỆC — làm theo thứ tự này

### Đợt 1 — Chặn buổi demo, phải xong trước

| ID | Việc | Ghi chú |
|---|---|---|
| **T1** | **Vá registry + lỗi AP** (mục 3): thêm 3 quản lý còn thiếu, cấp vai trò đúng cơ sở, thu hẹp `manager-trang-an` về Tràng An, sửa dữ liệu hoá đơn gắn sai tên. **Sửa `prod-smoke-ap.spec.ts` chạy đủ 4 quản lý.** | Chỉ dữ liệu. Nhỏ. **Làm đầu tiên.** |
| **T2** | **Gỡ `/ops` và `/demo/ops` khỏi production.** Giữ mã nguồn sau cờ môi trường. **Không xoá bảng vội** (bước T9). | 0 tài khoản, 0 dữ liệu → không mất gì. Rẻ nhất, tác động lớn nhất lên niềm tin |
| **T3** | **5 module rỗng: làm thật hoặc gỡ khỏi menu**, ghi rõ "giai đoạn sau" | Menu có mục rỗng làm hỏng niềm tin hơn là thiếu mục |
| **T4** | **Chuyển vai trò nhanh:** cho nhảy thẳng giữa hai vai trò (bỏ ràng buộc phải quay về giám đốc), thanh trình diễn luôn hiện, **ẩn mật khẩu trên trang đăng nhập theo biến môi trường**. Phải tắt được khi bàn giao. | Khách đã nêu trực tiếp |
| **T5** | **Làm mới mốc thời gian dữ liệu demo** trước mỗi buổi trình bày | Không có thì mở ra toàn màu đỏ quá hạn |

### Đợt 2 — Để gọi được là "production ready"

| ID | Việc | Ghi chú |
|---|---|---|
| **T6** | **Tài khoản thật:** registry thành nguồn sự thật duy nhất → module quản lý tài khoản (tạo/khoá/gán vai trò) → đăng nhập Supabase Auth, mật khẩu riêng từng người, bắt đổi lần đầu | Thiết kế chi tiết 5 bước: `docs/reference/KE_HOACH_HOP_NHAT_TAI_KHOAN.md`. **Chỉ đọc khi bắt đầu T6.** |
| **T7** | **Phân quyền nhiều cơ sở:** bỏ giới hạn một-cơ-sở, thêm vai trò `system-admin`, bỏ nhánh cấp cứng 15 module cho giám đốc | Đi liền T6 |
| **T8** | **Cổng soát vé kiểm vé thật:** nối với vé/booking, ràng buộc `unique` chống quét trùng, tra cứu theo mã/tên/SĐT | Đây cũng là nền cho luồng QR của khách du lịch |
| **T9** | **Bàn giao ca** + **vai trò trưởng ca** | Một trong tám tiêu chí nghiệm thu pilot của khách |
| **T10** | **Đóng dòng tiền:** nộp quỹ → ngân hàng → đối chiếu sau chốt ca; đề nghị → duyệt → chi cho NCC (thêm trạng thái `paid`) | Đắt, nhưng là gốc rễ |
| **T11** | **Sức chứa có ngưỡng thật + SOP Go/No-Go** | Đúng hai thứ khách nhấn mạnh nhất |
| **T12** | **Dọn ~20 bảng chết** của `/ops` và policy đi kèm | **Chỉ làm sau T6/T7**, vì vài bảng còn bị hàm/policy cũ tham chiếu |

### Đợt 3 — Web khách du lịch (làm sau ERP)

| ID | Việc |
|---|---|
| **W1** | Dựng lại luồng QR pass **trên nền module check-in của ERP** (phụ thuộc T8), không vá stack `/ops` cũ |
| **W2** | Quyết định mô hình thanh toán thật — **đây là quyết định kinh doanh trước khi là việc kỹ thuật** |
| **W3** | Đồng bộ danh mục điểm giữa web và ERP (Tam Chúc đang thiếu trên web) |
| **W4** | Đưa nội dung ra khỏi mã nguồn |

---

## 5. Ba cái bẫy đã làm sai ít nhất một lần — đừng lặp lại

1. **Test xanh vẫn giấu được lỗi.** Bài AP chỉ chạy một tài khoản nên không thấy 3/4 quản lý hỏng. **Bài kiểm chứng phân quyền phải chạy với mọi vai trò/cơ sở tương đương, không chỉ một đại diện.**
2. **`RLS 100%` không có nghĩa ERP đang được cơ sở dữ liệu bảo vệ.** `/erp` chạy bằng service role và tự kiểm quyền bằng TypeScript; 143 policy đang bảo vệ mô hình `auth.uid()` mà `/erp` không dùng. Chỉ sau T6/T7 câu đó mới đúng.
3. **Cuộc chuyển kiến trúc bỏ dở để lại 20 bảng chết.** Mọi việc lớn phải chia sao cho **dừng ở bất kỳ bước nào hệ thống vẫn chạy được**.

---

## 6. Tài liệu còn lại nằm đâu

**`docs/reference/`** — chỉ đọc khi bắt đầu đúng đầu việc cần tới:

| File | Đọc khi |
|---|---|
| `KE_HOACH_HOP_NHAT_TAI_KHOAN.md` | Bắt đầu T6/T7 |
| `TIEU_CHI_NGHIEM_THU.md` | Cần biết định nghĩa "xong" của từng module (backlog G) |
| `TAI_LIEU_KHACH_HANG_CUNG_CAP_VI.md` | Cần đối chiếu yêu cầu gốc của khách |
| `ERP_ACCOUNTING_REQUIREMENTS_VI.md` | Làm T10 hoặc chạm vào kế toán |
| `ERP_WORKDAY_GPS_REQUIREMENTS_VI.md` | Chạm vào phiếu công việc / chấm công |
| `DATA_SOURCES.md` | Cần biết dữ liệu nào khách phải cung cấp |
| `TRANGAN_PROPOSAL_ANALYSIS_VI.md` | Cần bối cảnh định vị sản phẩm |
| `UI_UX_RULES.md`, `REFERENCE_SITE_ANALYSIS.md` | Sửa giao diện web công khai |

**`docs/archive/`** — lịch sử đánh giá và nhật ký thay đổi. Có giá trị làm bằng chứng, **không dùng để kết luận hiện trạng**. Hiện trạng nằm ở chính file này.

---

## 7. Quy tắc làm việc

Nằm ở `AGENTS.md` (kiểm chứng thật trên production, bài test phải tự dọn dữ liệu, dọn máy sau khi xong, không thêm co-author vào commit). **Đọc `AGENTS.md` + file này là đủ để bắt đầu.**

Sau mỗi đầu việc: cập nhật mục 2, 3, 4 của file này. **Không tạo thêm tài liệu trạng thái mới** — đó chính là lý do trước đây có 17 file và giao việc bị loạn.
