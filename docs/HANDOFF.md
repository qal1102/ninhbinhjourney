# NINH BÌNH JOURNEY — BÀN GIAO

> **Đây là tài liệu duy nhất bắt buộc đọc trước khi làm việc.** Mọi tài liệu khác trong `docs/reference/` chỉ đọc khi bắt đầu đúng đầu việc cần tới nó; `docs/archive/` là lịch sử, không dùng để kết luận hiện trạng.
>
> Cập nhật: **02/08/2026** — sau đợt làm T1–T10, W3, và buổi chốt thiết kế danh tính / hồ sơ / nhật ký với chủ dự án (hàng việc ở mục 4 đã đảo thứ tự theo đó).
>
> Muốn hiểu **hệ thống này làm gì và theo nguyên tắc nào** (để nắm dự án, hoặc để đưa cho khách): đọc `docs/reference/SO_TAY_HE_THONG_VI.md`. File đang đọc chỉ nói **hiện trạng**.

---

## 0. ⚠️ VIỆC PHẢI LÀM ĐẦU TIÊN Ở PHIÊN SAU

**Sáu migration (025 → 030) đã viết xong, đã có bài kiểm tra hợp đồng, nhưng CHƯA được đẩy lên Supabase production.** Phiên trước bị môi trường chặn lệnh `supabase db push`, không phải vì migration có vấn đề.

Cho tới khi đẩy xong, **toàn bộ mục 2 và 3 dưới đây mô tả mã nguồn, không mô tả production.** Không được nói bất kỳ mục nào trong số này là "đã chạy thật" trước khi kiểm chứng.

```
npx supabase db push --linked
```

| Migration | Nội dung | Rủi ro |
|---|---|---|
| `025_erp_account_registry_site_managers` | Chỉ dữ liệu. Vá lỗi AP ở mục 3 | Thấp |
| `026_erp_demo_rebase_timeline` | Thêm 1 RPC, không đổi bảng | Thấp |
| `027_erp_account_administration` | **Đổi khoá chính `erp_employee_access`** + 3 RPC quản trị | **Cao nhất** — kiểm kỹ |
| `028_erp_ticket_validation` | Bảng `erp_tickets` + cột mới cho `erp_gate_scan_events` | Trung bình |
| `029_erp_shift_handover` | 2 bảng mới | Thấp |
| `030_erp_ap_payment_settlement` | Sửa trigger + check của `erp_ap_supplier_invoices` | **Cao** — chạm hoá đơn thật |

**Sau khi đẩy, theo đúng thứ tự:**

1. Xác minh trực tiếp trên Supabase: cả 4 quản lý đều `erp_account_has_active_role(..., 'regional-manager', site)` = true; `erp_employee_access` có khoá `(employee_account_id, site_id)`; `erp_tickets` có dữ liệu mẫu.
2. Đặt biến môi trường trên Vercel:
   - `ERP_REGISTRY_SITE_SCOPE=true` — **chỉ bật sau khi 025 và 027 đã chạy.** Bật sớm thì `manager-trang-an` sẽ nhận lại cả 4 cơ sở theo dữ liệu registry cũ.
   - `NEXT_PUBLIC_ERP_SHOW_DEMO_PASSWORDS` — `true` khi trình diễn, **bắt buộc bỏ khi bàn giao**.
   - `NEXT_PUBLIC_LEGACY_OPS_ENABLED` — để trống. Chỉ bật khi cần xem lại mã `/ops`.
3. Chạy `PLAYWRIGHT_BASE_URL=<url production> npx playwright test tests/e2e/prod-smoke-ap.spec.ts` — bài này giờ chạy cả 4 quản lý và là bài duy nhất chứng minh mục 3 đã hết.
4. Gọi `erp_demo_rebase_timeline()` trước buổi trình diễn.

---

## 1. Khách hàng cần gì, và ưu tiên ra sao

Hai thứ, **không ngang nhau**:

1. **Phần mềm quản lý nội bộ (ERP) — đây là thứ khách cần nhất.** Phải đạt mức *production-ready* cho buổi demo.
2. **Web cho khách du lịch quét QR.** Quan trọng, nhưng **để sau**. Không đánh đổi chất lượng ERP để làm web.

Nguyên tắc chọn việc: **việc nào làm buổi demo ERP thuyết phục hơn thì làm trước.**

---

## 2. Hiện trạng — đã đổi những gì trong đợt vừa rồi

### 2.1 Nền tảng

- Postgres/Supabase, RLS bật trên 100% bảng, RPC nghiệp vụ chỉ `service_role` gọi được, mỗi migration có một bài kiểm tra hợp đồng riêng.
- **30 migration** (24 đã chạy trên production, 6 chờ đẩy — mục 0).
- Phân tách nhiệm vụ thật ở mọi luồng: kế toán lập ≠ người duyệt, quản lý không tự duyệt hồ sơ mình tạo, người bàn giao ca ≠ người nhận ca, người đề nghị chi ≠ người duyệt chi.
- Sự cố quá hạn SLA tự chuyển cấp mỗi phút bằng `pg_cron`.
- **364 bài test cục bộ**, `lint`/`typecheck`/`build` sạch.

### 2.2 Module: 10 thật / 5 nói thẳng là chưa làm

| Có nghiệp vụ thật (10) | Ghi rõ "Giai đoạn sau" (5) |
|---|---|
| Vé & đặt chỗ · Check-in khách · Camera AI · Báo cáo hiện trường · Dự án & sự kiện · Sự cố · Nhân sự & ca trực · Chấm công · Đối tác & NCC · Tài chính & đối soát | **Sức chứa** · **Xe trung chuyển** · **Tài sản** · **SOP & diễn tập** · **Báo cáo & dự báo** |

Năm module chưa làm **trước đây hiển thị dữ liệu bịa** — tên tài xế, phiếu việc, số tệp đính kèm. Đã gỡ sạch. Giờ mỗi module nói rõ sẽ làm gì và **cần dữ liệu gì trước**, kèm nhãn "Giai đoạn sau" ngay trong menu. Có bài test đọc thẳng mã nguồn để không ai gắn nhãn "live" cho một module không có nghiệp vụ.

### 2.3 Đã sửa trong đợt này

| ID | Việc | Ghi chú |
|---|---|---|
| **T1** | Vá registry + lỗi AP; dịch **166 mã lỗi RPC** sang câu tiếng Việt hành động được | Trước đây mọi từ chối đều hiện "kho công nợ chưa phản hồi" — không phân biệt được hết quyền với sập hệ thống |
| **T2** | `/ops`, `/demo/ops`, `/demo/join`, `/api/demo-runs` trả 404 sau cờ `NEXT_PUBLIC_LEGACY_OPS_ENABLED`; hai liên kết ở trang chủ giờ mở `/erp/login` | Mã nguồn giữ lại — thiết kế check-in/QR trong đó là điểm bắt đầu của T8/W1 |
| **T3** | 5 module rỗng: bỏ toàn bộ dữ liệu bịa, gắn nhãn, nêu rõ dữ liệu còn thiếu | |
| **T4** | Đổi thẳng giữa hai vai trò, không phải quay về giám đốc; trang đăng nhập không in mật khẩu nữa | Mật khẩu chung in công khai làm mọi dòng nhật ký kiểm toán chối bỏ được |
| **T5** | `erp_demo_rebase_timeline()` kéo dữ liệu mẫu về hôm nay, chỉ chạm đúng bản ghi seed, không lùi thời gian | |
| **T6+T7** | Registry thành nguồn danh tính; **một người giữ được nhiều cơ sở**; vai trò `system-admin` tách khỏi `director`; module `/erp/tai-khoan` | Đăng nhập Supabase Auth **chưa làm** — bước 4 của kế hoạch, đắt nhất |
| **T8** | Bảng `erp_tickets`; cổng đối chiếu vé thật, trừ lượt dưới khoá dòng, khoá chống trùng, **ghi cả lượt bị từ chối**; tra cứu theo tên/SĐT/mã đặt chỗ | Trước đây gõ `ABC123` là ghi nhận một khách |
| **T9** | Bàn giao ca có ký nhận hai người, kèm tiền mặt, sự cố còn mở, thiết bị | Một trong tám tiêu chí nghiệm thu pilot |
| **T10** | **Nửa NCC**: `posted → payment-requested → paid`, người đề nghị ≠ người duyệt chi | Nửa tiền mặt chưa làm — mục 4 |
| **W3** | Tam Chúc lên web, khai đúng là thuộc Hà Nam thay vì kéo vào trong ranh giới bản đồ | |

**Về "vai trò trưởng ca" trong T9 — làm khác đề bài, có lý do:** không thêm vai trò toàn cục thứ sáu. Ngoài đời trưởng ca là *nhiệm vụ của một ca tại một vị trí*, không phải chức danh giữ mãi — cùng một nhân viên sáng nay chỉ huy cổng, mai làm ở bến. Đưa vào registry là biến nó thành vĩnh viễn và sai. Ở đây, trưởng ca = người được ghi tên trên phiếu bàn giao, và RPC kiểm đúng cái tên đó.

### 2.4 Vẫn chưa dùng được với người thật

- 🔴 **Module quản lý tài khoản hiện là một hành động trang trí.** [`app/erp/actions.ts:78`](../app/erp/actions.ts) đăng nhập bằng `findDemoErpAccountByUsername` — đọc mảng cứng trong `lib/erp/demo-data.ts`. Còn `/erp/tai-khoan` ghi vào bảng `erp_account_registry` dưới Supabase. **Hai nơi không nối với nhau: tài khoản giám đốc tạo ra có tên, chức danh, vai trò đúng cơ sở — và không đăng nhập được.** Đây chính là loại lỗi T3 đi gỡ, lần này nằm ở chỗ đắt nhất. T6b vá đúng chỗ này.
- **Đăng nhập vẫn là mật khẩu chung theo cấp**, chưa nối Supabase Auth.
- **Không có chế độ ngoại tuyến** ở bất kỳ đâu.
- **RLS vẫn chưa bảo vệ ERP.** `/erp` chạy bằng service role và tự kiểm quyền bằng TypeScript; 143 policy đang bảo vệ mô hình `auth.uid()` mà `/erp` không dùng. Câu "RLS 100%" chỉ đúng sau bước 4.

### 2.7 Dữ liệu còn nhét cứng trong mã nguồn — rà ngày 02/08

Yêu cầu của chủ dự án: **thêm một nhân viên, đổi một giá vé, xoá dữ liệu tập dượt — đều phải làm được bằng thao tác trên màn hình, không sửa code.** Phần lớn nghiệp vụ ERP đã đạt (sự cố, vé, quét cổng, bàn giao ca, dự án, công nợ, bút toán, chấm công, phân quyền — đều nằm trong Supabase, xoá được bằng migration hẹp). Còn đúng ba chỗ chưa đạt:

| Chỗ | Hệ quả | Vá bằng |
|---|---|---|
| `lib/erp/demo-data.ts` (315 dòng) — tên, chức danh, mật khẩu, quyền ban đầu của mọi tài khoản | Thêm một nhân viên thật = sửa code + deploy | **T6b** |
| `domain/erp-operating-data.ts` — số tài chính và nhân sự cứng | Xem hàng dưới | **T13** |
| `content/destinations.ts` + `content/packages.ts` (564 dòng) | Đổi giá tour = sửa code | **W4** |

🔴 **Số tài chính bịa đang hiển thị trên màn hình soát vé.** [`components/erp/ticket-guest-workspace.tsx:49-54`](../components/erp/ticket-guest-workspace.tsx): doanh thu tuần/tháng/năm = một số cứng nhân với hằng số bịa (`* 6.4`, `* 20`, `* 150`); các dòng "+5,2% so với tuần trước" là chuỗi ký tự, không tính từ gì; nhãn tháng cứng là "Tháng 7". **Đây là bẫy số 4 ở mục 5 tái diễn** — đợt T3 soát 5 module rỗng nhưng bỏ sót một module *live*. Cùng lúc, `executive-finance-overview.tsx` và `finance-dashboard.tsx` là **code chết** (không màn hình nào import) và chứa thêm một mớ số bịa nữa.

`domain/erp.ts` giữ 4 cơ sở + danh sách module trong code — **không tính là lỗi**, đó là cấu hình phần mềm, cố ý không cho sửa từ giao diện.

### 2.5 Dòng tiền: một đầu đã đóng, một đầu còn hở

- ✅ **Công nợ NCC**: ghi nhận nợ → đề nghị chi → duyệt chi → **đã trả** (T10).
- ❌ **Tiền mặt sau chốt ca**: vẫn dừng ở `posted`. Chưa có nộp quỹ → ngân hàng → đối chiếu sao kê.

### 2.6 Web công khai

- Không bán được hàng, bị chặn ở tầng cấu hình (`config/experience.ts` cấm production bật sandbox checkout, và không có cổng thanh toán thật).
- **Luồng QR khách du lịch (`/pass/[token]`) vẫn chưa dựng lại.** T8 đã tạo nền (`erp_tickets`); W1 là việc nối luồng khách vào đó.

---

## 3. 🔴 Lỗi nghiêm trọng — đã có bản vá, chưa đẩy

**3/4 quản lý cơ sở không dùng được module Đối tác & NCC trên production.**

RPC `erp_ap_submit_supplier_invoice` chặn bằng `erp_account_has_active_role(...)`, tra `erp_account_registry`. V12 (01/08) tách một quản lý vùng thành bốn quản lý cơ sở trong mã nguồn nhưng không cập nhật registry.

| Tài khoản | Gửi được hoá đơn NCC? |
|---|---|
| `manager-trang-an` | ✅ true |
| `manager-tam-chuc` / `manager-tam-coc` / `manager-bai-dinh` | ❌ **false** |

**Trạng thái:** migration `025` vá đủ cả bốn phần (thêm 3 quản lý, thu hẹp `manager-trang-an` về Tràng An, sửa hoá đơn gắn sai tên, sửa dòng nhật ký seed). `prod-smoke-ap.spec.ts` đã chạy đủ 4 quản lý. **Vẫn còn nguyên trên production cho tới khi đẩy migration.**

---

## 4. HÀNG VIỆC CÒN LẠI

**Thứ tự đã đảo ngày 02/08 theo yêu cầu chủ dự án.** Lý do đảo: T6b không phải "một việc trong hàng" mà là **điều kiện để ba việc sau nó có nghĩa** — chừng nào tài khoản giám đốc tạo ra chưa đăng nhập được (mục 2.4) thì hồ sơ, chức danh và nhật ký đều bám vào một danh tính giả.

| # | ID | Việc | Ghi chú |
|---|---|---|---|
| 1 | **T0** | **Đẩy 6 migration + đặt biến môi trường + xác minh** | Mục 0. **Trước mọi thứ khác.** |
| 2 | **T6b** | **Đăng nhập Supabase Auth**, mật khẩu riêng từng người, bắt đổi lần đầu; chuyển dần sang RLS thật | Bước 4 trong `KE_HOACH_HOP_NHAT_TAI_KHOAN.md`. Đắt nhất và **dễ bỏ dở nhất**. Sau việc này `demo-data.ts` hết vai trò và module quản trị tài khoản mới thật sự dùng được |
| 3 | **T14** | **Hồ sơ nhân sự & chức danh** | Registry đã có `display_name`/`job_title`/`employment_type`. Cần màn hình hồ sơ + trường bổ sung (SĐT, khu vực phụ trách, ngày vào làm) + bảng phân quyền sửa ở `SO_TAY_HE_THONG_VI.md` mục 6. **Bẫy: chức danh ≠ vai trò** — quản lý sửa được chức danh nhưng cấp vai trò chỉ giám đốc, nếu không thì ai sửa chức danh sẽ tự nâng quyền |
| 4 | **T15** | **Nhật ký tập trung: ai làm gì, theo tên và khu vực** | Hiện lộn xộn — vài bảng đã snapshot `actor_display_name` (chấm công, chốt ca), vài bảng chỉ có `actor_account_id` (`erp_account_admin_audit`, `erp_employee_access_audit`). Chưa có màn hình xem tập trung. Yêu cầu đầy đủ ở `SO_TAY_HE_THONG_VI.md` mục 5. **Hai bẫy: (a)** phải lưu **cả** ảnh chụp tên/chức danh/khu vực **lẫn** mã tài khoản — chỉ lưu tên thì hai anh Long lẫn nhau, chỉ lưu mã thì đổi cơ sở là viết lại lịch sử; **(b)** phạm vi nhìn phải chặn ở máy chủ, lọc ở giao diện chỉ là giấu |
| 5 | **T13** | **Gỡ số tài chính bịa; tính từ dữ liệu thật** | Mục 2.7. Sửa `ticket-guest-workspace.tsx` lấy doanh thu từ vé quét thật (T8 đã ghi lượt kèm giờ); thay `ERP_WORKFORCE_SUMMARY` bằng số đếm từ registry; **xoá** `executive-finance-overview.tsx` + `finance-dashboard.tsx` (code chết) |
| 6 | **T10b** | **Đóng nốt đầu tiền mặt:** nộp quỹ → ngân hàng → đối chiếu sao kê sau chốt ca | Chủ dự án đã quyết **làm cả hai nguồn**: `statement_source` = `manual` \| `bank-api`, cùng một bộ đối khớp. **Nhập tay làm trước và làm trọn** (kể cả khi có API vẫn phải có đường nhập tay: API rớt, giao dịch về chậm, khoản nộp quầy không khớp dạng sao kê). Nửa API chỉ viết adapter — **không được tuyên bố chạy được cho tới khi cắm credential thật**. Còn chờ khách cho biết ngân hàng nào |
| 7 | **T11** | **Sức chứa có ngưỡng thật + SOP Go/No-Go** | Chủ dự án đồng ý cho **tự tính ước lượng trước** vì chưa có số. Bắt buộc: tính bằng mô hình vật lý *(số phương tiện × chỗ/phương tiện ÷ thời gian vòng)*, **hiện phép tính ra màn hình**, và mỗi ngưỡng mang nhãn nguồn `ước-lượng` / `khách-cung-cấp` / `đo-thực-tế`. Đặt ngưỡng **theo giờ tại điểm nghẽn** (bến đò, cửa soát vé, bãi xe điện), không theo tổng ngày — chỗ vỡ trận là 9–10h sáng chứ không phải tổng khách. T8 chạy vài tuần là thay được bằng số đo thật |
| 8 | **T12** | **Dọn ~20 bảng chết của `/ops`** | **Hoãn có lý do:** phải sau khi T6/T7 chạy thật trên production |
| 9 | **T16** | **Migration xoá dữ liệu mồi để nhập dữ liệu thật** | **Làm cuối cùng**, khi không còn gì nhét cứng (T6b + T13 + W4 xong). Xoá theo điều kiện hẹp (`id like 'INC-%'`, `metadata->>'seed' = 'true'`), **không truncate, không xoá theo khoảng thời gian**. Giữ nguyên cấu hình. Xem `SO_TAY_HE_THONG_VI.md` mục 7 |
| — | **W1** | Dựng lại luồng QR pass **trên `erp_tickets`** (T8 đã tạo nền) | |
| — | **W2** | Quyết định mô hình thanh toán thật | Quyết định kinh doanh |
| — | **W4** | Đưa nội dung ra khỏi mã nguồn | Chặn T16 |

---

## 5. Sáu cái bẫy đã sập ít nhất một lần — đừng lặp lại

1. **Test xanh vẫn giấu được lỗi.** Bài AP chỉ chạy một tài khoản nên không thấy 3/4 quản lý hỏng. **Bài kiểm chứng phân quyền phải chạy với mọi vai trò/cơ sở tương đương, không chỉ một đại diện.**
2. **`RLS 100%` không có nghĩa ERP đang được cơ sở dữ liệu bảo vệ.** Xem mục 2.4.
3. **Cuộc chuyển kiến trúc bỏ dở để lại 20 bảng chết.** Mọi việc lớn phải chia sao cho **dừng ở bất kỳ bước nào hệ thống vẫn chạy được**. Đó là lý do `ERP_REGISTRY_SITE_SCOPE` là một cờ riêng chứ không bật thẳng.
4. **Số liệu bịa trong một module thật sẽ phá hỏng cả những module đúng.** Nếu chưa có nguồn dữ liệu, màn hình phải nói thẳng là chưa có — đừng vẽ số cho đẹp. **Đã tái diễn:** đợt T3 soát 5 module *planned* nhưng bỏ sót số bịa nằm trong một module *live* (mục 2.7). Lần soát sau phải quét cả module đang chạy.
5. **Xây được nửa dưới rồi dừng thì nửa dưới đó không tồn tại với người dùng.** T6/T7 dựng xong sổ tài khoản và màn hình quản trị, nhưng cửa đăng nhập vẫn đọc mảng cứng — nên tài khoản giám đốc tạo ra **không đăng nhập được**, và cả module thành trang trí. Một tính năng chỉ tính là có khi **đi hết từ giao diện xuống dữ liệu và quay lại**.
6. **Hai nguồn sự thật về cùng một thứ thì cả hai đều sai.** `demo-data.ts` và `erp_account_registry` cùng khai "ai là ai" — chính chỗ này đẻ ra lỗi AP ở mục 3. Mỗi khái niệm chỉ được có một nguồn.

---

## 6. Tài liệu còn lại nằm đâu

**`docs/reference/`** — chỉ đọc khi bắt đầu đúng đầu việc cần tới:

| File | Đọc khi |
|---|---|
| **`SO_TAY_HE_THONG_VI.md`** | **Cần hiểu hệ thống này là gì, có chức năng gì, vận hành theo nguyên tắc nào.** Viết cho cả khách hàng lẫn phiên làm việc sau. Mô tả *thiết kế*, không mô tả hiện trạng — hiện trạng chỉ nằm ở file này. Chứa đặc tả đầy đủ của T14 (hồ sơ) và T15 (nhật ký) |
| `KE_HOACH_HOP_NHAT_TAI_KHOAN.md` | Bắt đầu T6b (đăng nhập Supabase Auth) |
| `TIEU_CHI_NGHIEM_THU.md` | Cần biết định nghĩa "xong" của từng module |
| `TAI_LIEU_KHACH_HANG_CUNG_CAP_VI.md` | Cần đối chiếu yêu cầu gốc của khách |
| `ERP_ACCOUNTING_REQUIREMENTS_VI.md` | Làm T10b hoặc chạm vào kế toán |
| `ERP_WORKDAY_GPS_REQUIREMENTS_VI.md` | Chạm vào phiếu công việc / chấm công |
| `DATA_SOURCES.md` | Cần biết dữ liệu nào khách phải cung cấp |
| `TRANGAN_PROPOSAL_ANALYSIS_VI.md` | Cần bối cảnh định vị sản phẩm |
| `UI_UX_RULES.md`, `REFERENCE_SITE_ANALYSIS.md` | Sửa giao diện web công khai |

**`docs/archive/`** — lịch sử. Có giá trị làm bằng chứng, **không dùng để kết luận hiện trạng**.

---

## 7. Quy tắc làm việc

Nằm ở `AGENTS.md` (kiểm chứng thật trên production, bài test phải tự dọn dữ liệu, dọn máy sau khi xong, không thêm co-author vào commit). **Đọc `AGENTS.md` + file này là đủ để bắt đầu.**

Sau mỗi đầu việc: cập nhật mục 0, 2, 3, 4 của file này. **Không tạo thêm tài liệu trạng thái mới.**
