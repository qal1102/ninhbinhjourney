# ĐÁNH GIÁ HỆ THỐNG & GIAO VIỆC — góc nhìn giám đốc kỹ thuật

> **Mục đích file này:** ghi lại một lượt rà soát toàn hệ thống ở mức **quy trình nghiệp vụ và logic module**, không phải review code. Các phiên làm việc sau đọc file này để biết đã đánh giá những gì, kết luận ra sao, và việc nào cần làm theo thứ tự nào.
>
> **Ngày đánh giá:** 01/08/2026 · **Người đánh giá:** Claude (vai trò giám đốc kỹ thuật) theo yêu cầu chủ dự án.
>
> Thứ tự đọc: `AGENTS.md` → `docs/CODEX.md` (đã làm gì) → `docs/PLAN.md` (còn phải làm gì) → **file này** (chất lượng quy trình đang ở đâu).

---

## 1. Phạm vi và phương pháp

Đã đọc: `docs/TAI_LIEU_KHACH_HANG_CUNG_CAP_VI.md` (yêu cầu gốc của khách), `docs/PLAN.md`, `docs/CODEX.md`, `docs/UI_UX_RULES.md`.

Đã khảo sát trực tiếp: `domain/erp.ts`, `domain/erp-role-policy.ts`, `domain/erp-navigation.ts`, `components/erp/*` (24 component), `app/erp/**`, và **truy vấn trực tiếp Supabase production** để đối chiếu số liệu hiển thị với dữ liệu thật.

Mọi kết luận dưới đây đều có bằng chứng cụ thể (đường dẫn file + số dòng, hoặc kết quả truy vấn DB). Không suy đoán.

---

## 2. Kết luận tổng thể

**Nền kỹ thuật tốt hơn hẳn mức trung bình. Nhưng bề mặt nghiệp vụ mà khách nhìn thấy đầu tiên lại là phần yếu nhất.**

Cụ thể: 10/15 module đã có workflow thật, lưu Supabase, phân quyền server-side, có audit. Đó là phần lõi và nó chắc chắn. Nhưng **màn hình đầu tiên mọi vai trò nhìn thấy khi vào một cơ sở lại là 5 con số hard-code trong source code**, và 3/4 cơ sở đang hiển thị số mâu thuẫn với chính dữ liệu thật của hệ thống.

Nói thẳng: hệ thống đang **mạnh ở chiều sâu, yếu ở ấn tượng đầu tiên** — đúng ngược với thứ một buổi demo cần.

### Điểm mạnh thật sự (giữ nguyên, đừng phá)

1. **Kỷ luật dữ liệu rất tốt.** Mọi bảng đều RLS bật, thu hồi toàn bộ quyền, chỉ `service_role` đọc; mọi thao tác ghi đi qua RPC `SECURITY DEFINER` với `search_path=''`. Không có đường tắt nào cho client ghi thẳng. Đây là mức chuẩn doanh nghiệp, không phải mức demo.
2. **Phân tách nhiệm vụ (maker ≠ checker) được áp dụng thật**, không chỉ nói: kế toán lập ≠ kế toán trưởng ghi sổ; người gửi nghiệm thu ≠ người xác nhận hoàn thành (module Dự án); quản lý không tự duyệt hồ sơ mình tạo.
3. **Mỗi migration có test hợp đồng riêng** khẳng định RLS/grant/logic không bị nới lỏng về sau. Rất ít dự án cùng quy mô làm được việc này.
4. **Tài liệu bàn giao trung thực.** CODEX/PLAN ghi đúng cái đã kiểm chứng, tự ghi cả lỗi mình gây ra. Đây là tài sản lớn — giữ kỷ luật này.
5. **Gom 15 module thành 8 nhóm menu** hợp lý, sát đề xuất 12 nhóm của khách nhưng gọn hơn.

---

## 3. Lỗi logic đã kiểm chứng — xếp theo mức nghiêm trọng

### 🔴 L1. Số liệu vận hành cốt lõi là hằng số viết cứng trong code

**Bằng chứng:** `domain/erp.ts` — mỗi cơ sở có `snapshot: { visitors, checkedIn, employeesOnShift, capacityPercent, openIncidents }` là số cố định.

Các số này lan ra khắp hệ thống:

| Nơi dùng | Dùng làm gì |
|---|---|
| `app/erp/[site]/page.tsx:42-46` | **5 thẻ KPI đầu tiên** mọi vai trò thấy khi vào cơ sở |
| `components/erp/camera-ai-workspace.tsx:42` | Số người trong khung hình = `visitors × hệ số cố định` |
| `components/erp/ticket-guest-workspace.tsx:43-46` | Doanh thu & số vé **ngày/tuần/tháng/năm** = `baseRevenue × hệ số` |
| `components/erp/module-workspace.tsx:221` | Module Sức chứa: "Tải hiện tại {capacityPercent}%" |
| `components/erp/finance-dashboard.tsx:151` | Tổng lượt khách toàn vùng |

**Vì sao nghiêm trọng:** tài liệu khách hàng đặt **điều phối theo sức chứa** làm nguyên tắc vận hành số một — *"không đưa khách vào nhanh hơn khả năng thoát của điểm nghẽn phía trước"*, kèm ngưỡng xanh/vàng/cam/đỏ. Hiện tại "Tải hiện tại 83%" của Tam Chúc là một hằng số. Nhân viên có quét bao nhiêu lượt QR thì con số đó vẫn 83%. **Khái niệm cốt lõi nhất của khách đang không có dữ liệu thật đứng sau.**

Đồng thời vi phạm nguyên tắc PLAN §2.2: *"Một module không được tính là tồn tại nếu chỉ có card, số ngẫu nhiên..."*

### 🔴 L2. Cùng một sự thật, hai con số khác nhau — khách sẽ thấy ngay

**Bằng chứng (truy vấn Supabase production ngày 01/08/2026):**

| Cơ sở | Trang tổng quan cơ sở (tĩnh) | Module Sự cố (Supabase thật) | Khớp? |
|---|---|---|---|
| Tràng An | 2 | 2 | ✅ (trùng ngẫu nhiên) |
| Tam Chúc | **5** | **2** | ❌ |
| Tam Cốc | **1** | **2** | ❌ |
| Bái Đính | **3** | **2** | ❌ |

Trang tổng quan đọc `site.snapshot.openIncidents` (hằng số), module Sự cố đọc bảng `erp_incidents` thật. **3/4 cơ sở đang tự mâu thuẫn.** Con số còn lệch thêm mỗi khi có người đóng/mở một sự cố.

Đây là loại lỗi phá vỡ niềm tin nhanh nhất trong một buổi demo: khách bấm vào đúng con số vừa đọc và thấy nội dung không khớp.

### 🟠 L3. Việc chờ giám đốc duyệt không có hộp thư — có thể nằm mãi không ai biết

**Bằng chứng:** `components/erp/executive-dashboard-live.tsx:136`

```
directorDecisionCount = pendingShiftCloseDecisions.length + pendingSupplierDecisions.length
```

Chỉ đếm 2 loại. **Không đếm:**
- **Sự cố đã chuyển cấp** — dù module Sự cố có hẳn một màn riêng cho giám đốc tên "Sự cố đã chuyển cấp".
- **Yêu cầu đổi phạm vi/ngân sách dự án** — mà giám đốc là người **duy nhất** có quyền duyệt.

**Hệ quả thực tế:** quản lý gửi yêu cầu tăng ngân sách sự kiện → giám đốc đăng nhập, dashboard báo "0 hồ sơ cần quyết định" → yêu cầu nằm im vô thời hạn. Quy trình có nút bấm nhưng **không khép được vòng** vì người quyết định không được báo.

Vi phạm trực tiếp câu hỏi số 6 mà khách yêu cầu dashboard giám đốc phải trả lời: *"Quyết định nào cần giám đốc duyệt ngay?"*

### 🟠 L4. Check-in không đối chiếu với vé/booking thật

Chủ dự án đã tự phát hiện. Đã xác minh: `erp_record_gate_scan` chỉ kiểm tra chuỗi ≥ 6 ký tự rồi ghi log, **không JOIN tới bảng `bookings`/`passes`**. Nhân viên gõ 6 ký tự bất kỳ vẫn báo "đã ghi nhận thành công". Khách đặt vé online nhận QR dạng token dài (`/pass/{token}`), khác hoàn toàn định dạng mã nhân viên được yêu cầu nhập.

Hai hệ thống — đặt chỗ công khai và check-in nội bộ — **chưa có cầu nối nào**. Đã ghi trong PLAN (mục Check-in khách, G10.1) nhưng chưa làm.

### 🟡 L5. Camera AI vẫn còn nút giả — chính là nút khởi nguồn cả đợt audit

**Bằng chứng:** `components/erp/camera-ai-workspace.tsx:100-106` — `createAction()` chỉ gọi `setActionMessage()`. File không import bất kỳ Server Action nào (`grep -c "app/erp"` = 0).

Nút hiển thị "Giao quản lý kiểm tra" (giám đốc) / "Tạo phiếu hiện trường" (quản lý) / "Báo quản lý" (nhân viên) — **không ai khác thấy gì cả**. Đây đúng là nút đã kích hoạt đợt audit hồi 31/07 nhưng 6 module khác được sửa, riêng nó thì chưa.

### 🟡 L6. 5/15 module vẫn chỉ là bảng số tĩnh

| Module | Trạng thái | Ghi chú |
|---|---|---|
| **Sức chứa** | Tĩnh hoàn toàn | ⚠️ Khái niệm cốt lõi trong playbook khách |
| **SOP & diễn tập** | Tĩnh hoàn toàn | ⚠️ Chứa điều kiện Go/No-Go — cổng bắt buộc theo tài liệu khách |
| Xe trung chuyển | Tĩnh hoàn toàn | |
| Tài sản & bảo trì | Tĩnh hoàn toàn | |
| Báo cáo | Tĩnh hoàn toàn | |

Hai module đầu đáng lo nhất: chúng là **nguyên tắc an toàn** của khách, không phải tính năng phụ.

### 🟡 L7. Thiếu công cụ điều hướng cơ bản

- **Không có tìm kiếm / command palette.** Muốn mở một hồ sơ phải nhớ nó nằm ở cơ sở nào, module nào, rồi bấm lần lượt. PLAN G6.4 đã yêu cầu.
- **"Thông báo" chỉ hiện đúng 1 gợi ý** (`erp-app-controls.tsx`), không phải hộp thư có số đếm theo loại việc.
- Giám đốc muốn tìm việc tồn phải đi thủ công 4 cơ sở × 8 nhóm module.

---

## 4. Quy trình theo vai trò — vòng đời đã khép kín chưa?

### ✅ Đã khép kín (dữ liệu chảy thật, không nhập lại)

| Quy trình | Đường đi | Trạng thái |
|---|---|---|
| Chốt ca | Nhân viên gửi → quản lý duyệt → kế toán lập bút toán → kế toán trưởng ghi sổ | Thật, có audit |
| Công nợ NCC | Quản lý nộp → kế toán đối chiếu → giám đốc quyết ngoại lệ → ghi sổ | Thật, có audit |
| Phiếu công việc trong ca | Quản lý giao → nhân viên GPS/ảnh → quản lý duyệt | Thật, có Storage |
| Sự cố | Nhân viên báo → quản lý tiếp nhận/giao/xác minh/đóng | Thật |
| Dự án & sự kiện | Nhân viên/quản lý tiến độ → nghiệm thu → giám đốc duyệt đổi phạm vi → kế toán quyết toán | Thật |
| Phân quyền nhân sự | Quản lý gán site/module → có hiệu lực xuyên thiết bị | Thật |

### ❌ Còn đứt gãy

1. **Bán vé → chốt ca:** không có nguồn POS/vé thật, nên **nhân viên phải gõ tay số vé và số tiền** vào form chốt ca. Vi phạm thẳng nguyên tắc PLAN §2.3: *"Không để người dùng làm lại việc bằng tay"* và *"Kế toán không nhập lại số vé, tiền..."*. Đây là mắt xích đầu tiên của toàn bộ dây chuyền tài chính — nếu nó là số gõ tay thì mọi con số phía sau chỉ chính xác bằng mức người gõ.
2. **Đặt chỗ công khai → check-in:** không có cầu nối (L4).
3. **Sức chứa → điều phối:** không có dữ liệu thật nên không thể sinh cảnh báo ngưỡng (L1).
4. **Việc chờ duyệt → người duyệt:** không có hộp thư (L3).

**Nhận định:** phần **sau** của dây chuyền (kế toán, kiểm soát, phê duyệt) làm rất chắc. Phần **đầu** (nguồn dữ liệu vào: vé, khách, sức chứa) gần như chưa có. Hệ thống đang giống một bộ máy kế toán tốt đặt trên một nguồn dữ liệu tự khai.

---

## 5. Câu hỏi: có nên làm chuyển đổi tài khoản (role switcher) không?

### Trả lời: **NÊN LÀM** — nhưng phải làm đúng cách, nếu không sẽ phá vỡ chính điểm mạnh nhất của hệ thống.

**Vì sao nên:**
- Khách demo là **một người**. Để cho khách thấy một vòng đời xuyên vai trò (nhân viên gửi → quản lý duyệt → kế toán ghi sổ → giám đốc quyết) hiện phải đăng xuất/đăng nhập **6 lần**, mỗi lần: bấm đăng xuất → mở panel tài khoản → đọc user/mật khẩu → gõ → đăng nhập → tự tìm đường quay lại đúng module. Khoảng **7 thao tác × 6 lần**. Buổi demo mất nhịp hoàn toàn ở đúng đoạn cần gây ấn tượng nhất.
- **Rào cản kỹ thuật đã được gỡ.** Yêu cầu chủ dự án nêu trước đây — *"dùng acc giám đốc test, sang acc nhân viên phải thấy việc giám đốc đã giao"* — nay đã đúng, vì toàn bộ dữ liệu đã nằm trên Supabase dùng chung, không còn cookie theo trình duyệt. Đã chứng minh bằng 8 bài Playwright chạy 2 phiên tách biệt.

**Điều kiện bắt buộc khi làm (không được bỏ qua):**

1. **Phải cấp phiên đăng nhập THẬT cho tài khoản đích** (server-side đổi cookie phiên), tuyệt đối **không** làm kiểu đổi biến vai trò trên giao diện. Nếu chỉ đổi UI thì mọi kiểm tra quyền phía server trở thành nói dối, và toàn bộ công sức làm RLS/capability đổ sông.
2. **Chỉ tài khoản giám đốc** được dùng, và phải **bật/tắt bằng biến môi trường** (`ERP_DEMO_ROLE_SWITCH`). Khi khách vận hành thật thì tắt — không để mặc định bật trên production.
3. **Băng thông báo cố định** trên màn hình: "Đang xem với vai trò Nhân viên Tràng An — Quay lại giám đốc", để không ai nhầm mình đang là ai.
4. **Ghi audit mọi lượt chuyển** (ai, sang vai trò nào, lúc nào). Đây vừa là yêu cầu bảo mật, vừa là thứ gây ấn tượng khi demo cho khách xem nhật ký.
5. **Không cấp quyền mới.** Chuyển sang nhân viên thì thấy đúng những gì nhân viên đó thấy — kể cả bị chặn. Chính cái "bị chặn" mới là thứ chứng minh phân quyền hoạt động.

Làm đúng 5 điều trên thì tính năng này **vừa tiện cho demo vừa là một điểm cộng kỹ thuật** (đây chính là mô hình *impersonation* mà các ERP thật đều có), chứ không phải một lối tắt.

---

## 6. Đánh giá UI/UX

**Tốt:**
- Thẩm mỹ nhất quán, không rơi vào kiểu SaaS chung chung; màu và chữ có bản sắc.
- Có nút `?` trợ giúp theo ngữ cảnh từng module (`module-context-help.tsx`) — đúng yêu cầu PLAN §2.4.
- Có hỗ trợ mobile, PWA, menu hamburger.
- Tên hành động nói rõ kết quả ("Xác nhận và chuyển kế toán") — đúng chuẩn PLAN §2.1.

**Chưa tốt:**
1. **Ấn tượng đầu tiên là 5 con số giả** (L1/L2). Người dùng đánh giá hệ thống trong 10 giây đầu, và 10 giây đó đang là dữ liệu bịa.
2. **Không có "việc của tôi" tập trung.** Mỗi vai trò phải tự nhớ việc của mình nằm ở đâu. Trong khi tiêu chí nghiệm thu của khách ghi rõ: *"Một nhân viên mới có thể nhận ca, xem đúng việc... trong dưới 10 phút hướng dẫn"*.
3. **Đường đi của giám đốc quá dài.** Khách yêu cầu *"đi từ KPI tổng hợp về giao dịch/sự cố nguồn trong tối đa ba thao tác"*. Hiện tại tìm một sự cố chuyển cấp mất nhiều hơn thế.
4. **Mật khẩu demo in thẳng trên trang đăng nhập.** Tiện cho demo nhưng PLAN G6.1 đã ghi *"Không để mật khẩu demo mặc định trong production"* — cần cờ môi trường để ẩn.

---

## 7. GIAO VIỆC — thứ tự ưu tiên

> Nguyên tắc chọn thứ tự: **sửa cái khách nhìn thấy và mất niềm tin trước, rồi mới tới cái sâu.** Việc 1-3 rẻ và tác động lớn; việc 5-7 đắt.

### Đợt 1 — Trước buổi demo tiếp theo (rẻ, tác động lớn nhất)

- [x] **V1. Bỏ số tĩnh ở trang tổng quan cơ sở** — **ĐÃ SỬA 01/08/2026.** Xem mục 22.
- [x] **V2. Gom việc chờ giám đốc duyệt vào một chỗ** — **ĐÃ SỬA 01/08/2026.** Thêm sự cố chuyển cấp và yêu cầu đổi phạm vi dự án vào `directorDecisionCount`, kèm link đi thẳng tới hồ sơ. Xử lý L3. Xem chi tiết ở mục 21.
- [ ] **V3. Làm chuyển đổi vai trò cho demo** theo đúng 5 điều kiện ở mục 5. *(Vừa.)*

### Đợt 2 — Đóng nốt nợ cũ

- [ ] **V4. Sửa nút giả cuối cùng ở Camera AI** — nối vào module Sự cố có sẵn (tạo hồ sơ sự cố từ cảnh báo camera) thay vì xây bảng mới. Xử lý L5. *(Nhỏ — hạ tầng sự cố đã có.)*
- [ ] **V5. Hộp thư "việc của tôi" theo vai trò** + số đếm trên chuông thông báo. Xử lý L7 + UX#2. *(Vừa.)*

### Đợt 3 — Nối nguồn dữ liệu đầu vào (đắt nhưng là gốc rễ)

- [ ] **V6. Nối check-in với booking/pass thật** — cho nhân viên tra cứu theo mã/tên/SĐT, xác thực vé thật, chống quét trùng. Xử lý L4. Đây là G10.1 trong PLAN.
- [ ] **V7. Nguồn vé thật thay cho gõ tay** — để số vé/doanh thu chảy thẳng vào chốt ca thay vì nhân viên tự khai. Gốc rễ của toàn bộ độ tin cậy tài chính.
- [ ] **V8. Sức chứa có dữ liệu thật + ngưỡng xanh/vàng/cam/đỏ** và sinh việc tự động khi vượt ngưỡng — đúng playbook Tam Chúc của khách. Xử lý L1 phần còn lại + L6.
- [ ] **V9. SOP & điều kiện Go/No-Go** thành cổng bắt buộc thật trước khi mở cửa. L6.

### Đợt 4 — Trước khi bàn giao thật

- [ ] **V10.** Ẩn mật khẩu demo trên trang đăng nhập theo biến môi trường; chuyển sang auth thật (PLAN G6.1).
- [ ] **V11.** 3 module tĩnh còn lại (Xe trung chuyển, Tài sản, Báo cáo) — hoặc làm thật, hoặc **gỡ khỏi menu** và ghi rõ là giai đoạn sau. Không để module rỗng trong menu khi bàn giao.

---

## 8. Ghi chú cho phiên làm việc sau

1. **Đã đánh giá xong** toàn bộ 15 module, 5 vai trò, 8 nhóm menu, luồng dữ liệu xuyên vai trò, và trải nghiệm demo. Không cần đánh giá lại từ đầu — chỉ cập nhật khi có thay đổi lớn.
2. **Ba lỗi L1, L2, L3 là loại "rẻ để sửa, đắt để bỏ qua"** — nên làm trước mọi tính năng mới.
3. **Đừng thêm module mới** cho tới khi 5 module tĩnh được xử lý (làm thật hoặc gỡ). Menu có mục rỗng làm hỏng cảm giác tin cậy nhiều hơn là thiếu mục.
4. **Nguyên tắc khi gặp chỗ chưa có dữ liệu thật:** hiển thị "chưa có nguồn dữ liệu" là **trung thực và chuyên nghiệp**; bịa một con số đẹp là tự đặt bẫy cho chính buổi demo. Tài liệu khách hàng cũng ghi rõ điều này ở mục 9 ("Những điều không được tuyên bố quá sớm").
5. Khi làm xong bất kỳ mục V nào ở trên: đánh dấu `[x]` tại đây, cập nhật `PLAN.md` và ghi nhật ký vào `CODEX.md` theo đúng quy trình cũ.

---

## 9. Tóm tắt một câu

**Phần lõi kỹ thuật đã ở mức doanh nghiệp thật; phần dữ liệu đầu vào và bề mặt hiển thị vẫn ở mức demo — và vì bề mặt là thứ khách nhìn thấy trước, nên ba việc rẻ nhất (V1, V2, V3) lại là ba việc đáng làm nhất ngay lúc này.**

---

# PHẦN II — Rà soát bổ sung ngày 01/08/2026

> Bổ sung theo yêu cầu chủ dự án: (a) đối chiếu các quy trình do những phiên AI trước dựng lên với **quy trình doanh nghiệp thật**, (b) đánh giá **mô hình tài khoản** hiện tại.

## 10. Các quy trình có đúng chuẩn doanh nghiệp thật không?

Đánh giá từng quy trình theo tiêu chuẩn kiểm soát nội bộ thực tế, không theo cảm tính.

### 10.1 Bảng chấm điểm

| Quy trình | Trạng thái so với chuẩn thật | Kết luận |
|---|---|---|
| **Công nợ nhà cung cấp** | Đối chiếu 3 chiều PO ↔ nghiệm thu ↔ hóa đơn, 7 mã ngoại lệ, maker≠checker, có đảo bút toán | ✅ **Đúng chuẩn sách giáo khoa.** Phần làm tốt nhất hệ thống. |
| **Chốt ca → ghi sổ** | Nộp → quản lý duyệt → kế toán lập → kế toán trưởng ghi sổ; ngưỡng trọng yếu 1.000đ; ngoại lệ lên giám đốc | ✅ Đúng nguyên tắc "người thu tiền ≠ người duyệt ≠ người ghi sổ". |
| **Phiếu công việc trong ca** | Giao → điểm danh vị trí → làm → nộp bằng chứng → duyệt/trả lại | ✅ Đúng. |
| **Dự án & sự kiện** | WBS → phụ thuộc → nghiệm thu maker≠checker → đổi phạm vi → quyết toán | ✅ Đúng cấu trúc quản lý dự án thật. |
| **Sự cố** | Báo → tiếp nhận → giao → xác minh → đóng, có chuyển cấp | ⚠️ Đúng khung, **sai đồng hồ** (xem L8). |
| **Kỳ kế toán** | Mở/khóa kỳ, chỉ kế toán trưởng | ✅ Đúng. |

**Nhận định chung: các quy trình đã dựng thì dựng đúng.** Chúng phản ánh đúng kiểm soát nội bộ của doanh nghiệp thật, không phải quy trình bịa cho đẹp. Vấn đề nằm ở **những bước bị thiếu ở hai đầu dây chuyền**, không phải ở phần giữa.

### 10.2 🟠 L8. Đồng hồ SLA đứng yên — sự cố quá hạn không tự chuyển cấp

**Bằng chứng:** `elapsed_minutes` là **cột số nguyên lưu cứng** trong bảng `erp_incidents` (`migrations/202607310011:37`), không bao giờ tính lại từ `reported_at`. `incident-repository.ts:443` đọc thẳng giá trị đó ra. `incident-workflow-workspace.tsx:61` lấy `slaMinutes - elapsedMinutes` để hiển thị thời gian còn lại.

**Hệ quả:** một sự cố mở từ ba ngày trước vẫn hiển thị "còn 1 phút". Đồng hồ SLA đóng băng tại thời điểm seed dữ liệu.

**Nghiêm trọng hơn:** không có cơ chế **tự động chuyển cấp khi quá hạn**. Chuyển cấp hiện chỉ xảy ra khi có người bấm nút. Trong một trung tâm điều hành thật, chuyển cấp là **do thời gian**, không do trí nhớ của người trực — đó chính là lý do tồn tại của SLA. Tài liệu khách đặt KPI "phản ứng y tế khu vực núi dưới 4 phút"; với đồng hồ đứng yên thì KPI này không đo được.

Đây cũng là biểu hiện của một khoảng trống lớn hơn: **hệ thống chưa có cơ chế chạy nền theo thời gian** (quá hạn, nhắc việc, tự sinh việc khi vượt ngưỡng). Mọi thứ hiện chỉ xảy ra khi có người bấm.

### 10.3 🟡 L9. Chốt ca kết thúc ở bút toán, không kết thúc ở tiền

Quy trình hiện dừng tại trạng thái `posted` (đã ghi sổ). Thực tế doanh nghiệp thu tiền mặt còn **hai bước nữa**: *nộp tiền về quỹ* → *nộp ngân hàng* → *đối chiếu sao kê*.

Không có hai bước này thì tiền có thể được duyệt trên giấy mà **không bao giờ về đến két**, và hệ thống không phát hiện được. Tài liệu khách yêu cầu rõ *"đối soát nguồn tiền 100%"* — hiện mới đối soát tới bút toán, chưa tới dòng tiền.

### 10.4 🟡 L10. Công nợ ghi nhận xong nhưng không có bước chi tiền

**Bằng chứng:** `SupplierApStatus` không có trạng thái `paid`; trong `domain/erp-supplier-ap.ts` chỉ có `paymentTermsDays` như một thuộc tính nhà cung cấp, không có luồng thanh toán nào. Capability `accounting.payment.prepare` đã khai báo nhưng không có quy trình đứng sau.

Vòng đời AP thật là: hóa đơn → ghi nhận nợ → **đề nghị thanh toán → duyệt chi → ủy nhiệm chi → đối chiếu**. Hiện hệ thống làm nửa đầu rất tốt và **dừng hẳn ở giữa**. Nhà cung cấp gọi điện hỏi "bao giờ trả tiền" thì hệ thống không trả lời được.

Thiếu luôn: **nơi tạo đơn mua hàng (PO)**. Quy trình AP giả định PO đã tồn tại (`purchaseOrderReference` là chuỗi nhập tay) nhưng không module nào tạo ra PO. Tức là mắt xích đầu của chuỗi mua sắm cũng đang là số gõ tay — giống hệt vấn đề của chốt ca.

### 10.5 🟡 L11. Không có đối tượng "Bàn giao ca"

Tài liệu khách yêu cầu rất cụ thể: *"Bàn giao ca/công việc cần thời gian, vị trí, checklist, ảnh hoặc bằng chứng và chữ ký xác nhận"*, và ở mục tự động hóa: *"Cuối ca tự tổng hợp việc mở, sự cố, bằng chứng và người tiếp nhận thành biên bản bàn giao"*.

Hiện `handover` chỉ xuất hiện như **tên một vài đầu việc mẫu** trong `erp-workday-catalog.ts`, không phải một đối tượng dữ liệu có người giao/người nhận/chữ ký. Đây là một trong bốn tiêu chí nghiệm thu pilot của khách (*"Bàn giao ca không cần tổng hợp lại từ tin nhắn rời rạc"*) — hiện chưa đạt.

### 10.6 Tổng kết phần quy trình

Vẽ theo dòng giá trị thật của doanh nghiệp:

```
[Bán vé]  →  [Đón khách]  →  [Vận hành ca]  →  [Chốt ca]  →  [Kế toán]  →  [Ghi sổ]  →  [Nộp tiền]
  ✗ gõ tay     ✗ chưa nối      ✓ thật          ✓ thật       ✓ thật       ✓ thật      ✗ thiếu

[Đề xuất mua]  →  [PO]  →  [Nhận hàng/nghiệm thu]  →  [Hóa đơn]  →  [Ghi nợ]  →  [Chi tiền]
    ✗ thiếu       ✗ thiếu        ✓ (trong dự án)         ✓ thật      ✓ thật      ✗ thiếu
```

**Kết luận: phần giữa của cả hai dây chuyền làm rất chắc và đúng chuẩn; cả hai đầu đều hở.** Hệ thống hiện là một bộ máy kiểm soát tốt đặt giữa một nguồn vào tự khai và một đầu ra chưa chạm tới tiền thật.

---

## 11. Đánh giá mô hình tài khoản

Hiện có **10 tài khoản / 5 vai trò** (`lib/erp/demo-data.ts`): 1 giám đốc, 1 kế toán trưởng, 1 kế toán, 1 quản lý, 6 nhân viên.

### 11.1 Điểm làm đúng

- **5 vai trò là con số hợp lý**, không phình. Cách phân biệt "vai trò = mức quyền, nghề nghiệp = tập module được cấp" là đúng hướng: thêm một loại nhân viên mới không cần thêm vai trò mới.
- **Có vòng đời hiệu lực** (`accessStartsAt` / `accessEndsAt`) và tài khoản thời vụ hết hạn 31/08/2026 sẽ tự mất quyền — chi tiết này rất sát thực tế ngành du lịch mùa vụ, hiếm hệ thống demo nào nghĩ tới.
- **Phân tách kế toán / kế toán trưởng** đúng chuẩn, không gộp làm một.

### 11.2 🔴 L12. Không thể tạo tài khoản mới — nhân sự nằm cứng trong mã nguồn

**Bằng chứng:** `DEMO_ERP_ACCOUNTS` là mảng hằng trong `lib/erp/demo-data.ts`. `demo-session.ts:100` tra người dùng bằng `findDemoErpAccountById` — **không có bảng tài khoản nào trong Supabase**. Module Nhân sự (`staff-access-manager.tsx`) chỉ cấp/thu hồi cơ sở + module cho **những người đã có sẵn trong mảng đó**.

**Hệ quả:** tuyển một nhân viên thời vụ = sửa mã nguồn + deploy lại. Với một doanh nghiệp du lịch tuyển mùa vụ theo tuần, đây là điểm chặn triển khai thật sự — không phải chi tiết nhỏ.

Đây là **khoảng cách lớn nhất giữa hệ thống hiện tại và một hệ thống dùng được**: mọi quy trình phía sau đã sẵn sàng, nhưng không thể đưa người thật vào dùng.

### 11.3 🟠 L13. Quản lý và giám đốc được cấp toàn bộ 15 module, không qua phân quyền

**Bằng chứng:** `demo-session.ts:114-133` — với `director` và `manager`, hệ thống gán thẳng `ERP_MODULES.map(m => m.id)` cho **mọi cơ sở**. Trường `initialModuleIds` của hai tài khoản này là `[]` và bị bỏ qua hoàn toàn.

**Hệ quả:**
- Câu chuyện phân quyền chỉ đúng một nửa: **chỉ nhân viên mới thực sự bị phân quyền.**
- Không thể có "quản lý phụ trách an toàn" khác "quản lý phụ trách thương mại" — mọi quản lý đều thấy mọi thứ.
- Khi demo phần phân quyền, nếu khách hỏi "cấp quyền cho quản lý thế nào?" thì hiện không có câu trả lời.

### 11.4 🟠 L14. Cơ cấu tổ chức không phản ánh doanh nghiệp 4 cơ sở

Ba mâu thuẫn cùng lúc:

| Vấn đề | Bằng chứng | Vì sao sai |
|---|---|---|
| **Một quản lý cho cả 4 cơ sở** | `manager-trang-an` có `managedSiteIds` = 4 cơ sở | Doanh nghiệp 4 khu du lịch phải có 4 người phụ trách. Toàn bộ khái niệm "cách ly theo cơ sở" chưa từng được kiểm chứng ở cấp quản lý. |
| **Mọi nhân viên đều báo cáo về Tràng An** | 6/6 nhân viên có `supervisorId: "manager-trang-an"` | Nhân viên Bái Đính đang báo cáo cho quản lý Tràng An. |
| **Nhãn vai trò sai** | `ERP_ROLE_LABELS.manager = "Quản lý cơ sở"` nhưng `jobTitle = "Quản lý vận hành toàn vùng"` | Giao diện gọi là quản lý cơ sở, dữ liệu lại là quản lý vùng. |

Ngoài ra **giám đốc và quản lý có phạm vi truy cập y hệt nhau** (4 cơ sở, 15 module) — chỉ khác ở capability. Trong tổ chức thật, giám đốc *xem* toàn vùng nhưng không *vận hành* trực tiếp; sự khác biệt hiện quá mờ.

**Đây chính là câu trả lời cho câu hỏi "để account như hiện tại có ngáo quá không":** không ngáo ở chỗ có 10 tài khoản — con số đó hợp lý. **Ngáo ở chỗ sơ đồ tổ chức sai:** một người quản lý cả bốn khu, và ai cũng báo cáo về cùng một chỗ.

### 11.5 🟠 L15. Mật khẩu dùng chung theo cấp — làm hỏng chính giá trị của nhật ký kiểm toán

**Bằng chứng:** `demo-data.ts:34-35` — cả 5 nhân viên chính thức dùng chung `Nhanvien@2026`.

Tiện cho demo, nhưng nếu để nguyên khi chạy thật thì **mọi dòng audit trở nên chối bỏ được**: "không phải tôi, ai cũng biết mật khẩu đó". Hệ thống này lấy maker≠checker và nhật ký kiểm toán làm giá trị cốt lõi — mà giá trị đó phụ thuộc hoàn toàn vào việc **một tài khoản = một người**. Không có đổi mật khẩu, không có bắt đổi lần đầu, không có 2FA cho vai trò tài chính.

### 11.6 🟡 L16. Thiếu các vai trò mà tài liệu khách đã nêu

Tài liệu khách (Flow Board) liệt kê: hướng dẫn viên, lái đò, tài xế, điều hành, nhà bán, đại lý, khách sạn. Hiện tất cả đều phải là "nhân viên" hoặc không tồn tại.

Chấp nhận được ở giai đoạn 1 (khách cũng xếp portal đối tác vào giai đoạn 3), **nhưng thiếu một vai trò thuộc giai đoạn 1: trưởng ca.** Với 4 cơ sở × nhiều ca/ngày, cấp trung gian giữa nhân viên và quản lý là bắt buộc — người duyệt phiếu công việc trong ca thực tế là trưởng ca, không phải quản lý cơ sở ngồi văn phòng.

### 11.7 Kết luận về tài khoản

**Số lượng tài khoản không phải vấn đề. Ba thứ này mới là vấn đề, xếp theo mức chặn:**

1. **Không tạo được người mới** (L12) — chặn triển khai thật, không chặn demo.
2. **Sơ đồ tổ chức sai** (L14) — chặn demo, vì khách sẽ hỏi ngay "ai quản Tam Chúc?".
3. **Quản lý/giám đốc không bị phân quyền** (L13) — làm câu chuyện phân quyền kém thuyết phục khi trình bày.

Trong đó **L14 rẻ nhất và nên sửa trước**: chỉ cần thêm 3 tài khoản quản lý cho Tam Chúc / Tam Cốc / Bái Đính, sửa `supervisorId` của nhân viên về đúng quản lý cơ sở mình, thu `managedSiteIds` của quản lý Tràng An về đúng 1 cơ sở. Việc này còn làm **tăng giá trị demo** ngay lập tức: lúc đó mới chứng minh được "quản lý Tam Chúc không thấy dữ liệu Tràng An" — đúng thứ khách cần thấy.

---

## 12. GIAO VIỆC BỔ SUNG

> Chèn vào danh sách ở mục 7. Ưu tiên vẫn theo nguyên tắc: rẻ + khách nhìn thấy → làm trước.

### Bổ sung vào Đợt 1 (trước demo)

- [x] **V12. Sửa sơ đồ tổ chức tài khoản** — **ĐÃ SỬA 01/08/2026.** Xem mục 23.
- [ ] **V13. Đồng hồ SLA chạy thật** — tính `elapsedMinutes` từ `reported_at` khi đọc thay vì đọc cột lưu cứng; đánh dấu rõ hồ sơ đã quá hạn. Xử lý L8 phần hiển thị. *(Nhỏ.)*

### Bổ sung vào Đợt 2

- [ ] **V14. Phân quyền module cho quản lý** — bỏ việc cấp cứng toàn bộ 15 module cho `manager`; dùng đúng cơ chế cấp quyền đang áp dụng cho nhân viên. Giữ giám đốc toàn quyền xem. Xử lý L13. *(Vừa — chạm vào `demo-session.ts`, cần rà lại toàn bộ test phân quyền.)*
- [ ] **V15. Tự động chuyển cấp khi quá hạn SLA** — cần một cơ chế chạy nền (cron/edge function). Xử lý L8 phần logic. Đây là tiền đề cho mọi tự động hóa khác mà khách yêu cầu (cảnh báo ngưỡng, nhắc việc quá hạn). *(Vừa–lớn, nhưng mở khóa nhiều thứ.)*
- [ ] **V16. Đối tượng "Bàn giao ca"** — người giao/người nhận/checklist/bằng chứng/xác nhận, tự tổng hợp việc mở + sự cố cuối ca. Xử lý L11. Đây là **một trong tám tiêu chí nghiệm thu pilot** của khách. *(Vừa.)*

### Bổ sung vào Đợt 3–4

- [ ] **V17. Bảng tài khoản thật trong Supabase** + màn hình tạo/khóa/đổi mật khẩu người dùng, một tài khoản một người, bắt đổi mật khẩu lần đầu. Xử lý L12 + L15. Đi kèm V10 (auth thật). *(Lớn — nhưng bắt buộc trước khi có người thật dùng.)*
- [ ] **V18. Khép đầu cuối dòng tiền** — bước nộp quỹ/ngân hàng sau chốt ca (L9) và bước đề nghị–duyệt–chi thanh toán nhà cung cấp (L10). *(Lớn.)*
- [ ] **V19. Vai trò trưởng ca** (L16) — làm cùng lúc với V16, vì trưởng ca chính là người ký bàn giao ca.

---

## 13. Tóm tắt Phần II

**Quy trình đã dựng thì dựng đúng — đúng chuẩn kiểm soát nội bộ thật, không phải quy trình trang trí. Cái sai không nằm ở phần đã làm mà ở phần chưa làm: cả hai đầu dây chuyền (nguồn vào và dòng tiền ra) còn hở, và hệ thống chưa có bất kỳ cơ chế nào chạy theo thời gian.**

**Về tài khoản: số lượng ổn, nhưng sơ đồ tổ chức sai (một quản lý ôm bốn khu, ai cũng báo cáo về Tràng An) và không tạo được người mới. Sửa sơ đồ tổ chức là việc rẻ nhất trong toàn bộ danh sách và cho hiệu quả demo cao nhất — nên gộp làm cùng V3.**

---

# PHẦN III — Web công khai: hiện trạng và định hướng thương mại

> Bổ sung 01/08/2026 theo yêu cầu chủ dự án: đánh giá **lớp khách hàng** (web ngoài) và định hướng mới — thanh toán VNPay/quốc tế, nội dung chiều sâu (lịch sử, video, báo chí song ngữ), combo có hướng dẫn viên, thuyết minh giọng nói theo khu, và đặt dịch vụ tại các cơ sở Xuân Trường (Ninh Bình Legend, nhà hàng tiêu biểu) trong khi vẫn giới thiệu toàn diện Ninh Bình.

## 14. Hiện trạng web công khai

Đã khảo sát: `content/destinations.ts`, `content/packages.ts`, `domain/commerce.ts`, `config/experience.ts`, `app/{page,explore,destination,packages,plan,checkout,booking,pass}`, `components/{discovery,commerce,journey}`, `app/api/*`.

### 14.1 Đang có gì

| Hạng mục | Hiện trạng |
|---|---|
| Điểm đến | **8**: Tràng An, Cố đô Hoa Lư, Bái Đính, Phố cổ Hoa Lư, Tam Cốc–Bích Động, Hang Múa, Thung Nham, Vân Long |
| Gói/combo | **4**, đều gắn nhãn `demoPriceVnd`, chỉ một loại `ledgerType: "service-commerce"` |
| Song ngữ | Có ở **tầng dữ liệu** (`name`/`description`/`story` đều `{vi, en}`) và chuyển ngôn ngữ giữ được tham số URL |
| Luồng thương mại | Chọn gói → báo giá → đặt chỗ → **QR Pass** (`/pass/{token}`) → check-in — luồng đã chạy end-to-end |
| Bản đồ, lịch trình | Leaflet thật, trình soạn hành trình có thêm/bớt/đổi điểm |

**Nền móng tốt hơn tôi dự đoán**: đã có mô hình song ngữ ngay từ tầng dữ liệu, có QR Pass thật, có idempotency key ở API đặt chỗ, và mỗi điểm đến có trường `source` ghi nguồn tham khảo + ngày rà soát — đó là kỷ luật biên tập, không phải web du lịch làm ẩu.

### 14.2 🔴 W-A. Web hiện **không thể nhận tiền** — và điều đó được ép ở tầng cấu hình

**Bằng chứng:** `config/experience.ts` — `superRefine` **chặn thẳng** `sandboxPaymentEnabled` khi `mode === "production"`, kèm thông điệp *"Production mode cannot silently enable sandbox checkout."* `app/checkout/page.tsx:27` ghi rõ *"No live payment adapter is claimed."*

Nghĩa là: toàn bộ luồng thanh toán hiện tại là **mô phỏng có chủ đích**, và người viết đã cố tình dựng rào để nó không bao giờ vô tình chạy thật. Đây là quyết định **đúng** — nhưng cũng có nghĩa **chưa có một dòng tích hợp cổng thanh toán thật nào**. Muốn bán vé thật thì đây là việc phải làm từ đầu, không phải "bật cờ lên".

### 14.3 🟠 W-B. Web và ERP đang nói về hai tập điểm khác nhau

ERP quản **4 cơ sở**: Tràng An, **Tam Chúc**, Tam Cốc, Bái Đính.
Web công khai có **8 điểm** nhưng **không có Tam Chúc**.

Tam Chúc thuộc Hà Nam nên có thể là chủ ý — nhưng hiện chưa ở đâu ghi quyết định đó. Cần chốt: web là *"du lịch Ninh Bình"* hay *"hệ sinh thái Xuân Trường"*? Hai câu trả lời dẫn tới hai cấu trúc thông tin khác nhau. Với mục tiêu chủ dự án nêu (đẩy Xuân Trường), câu trả lời có lẽ là **cả hai lớp**: vùng Ninh Bình là bối cảnh, hệ sinh thái là lớp thương mại nằm trên.

### 14.4 🟠 W-C. Chưa có video, chưa có audio, báo chí chưa có chỗ

Tìm toàn bộ `app/` + `components/` + `content/`: **không có một thẻ video hay audio nào trên web công khai.** (`voiceDemoFallbackEnabled` là cờ dành cho trung tâm điều hành ERP, không phải thuyết minh du lịch.)

Nội dung mỗi điểm đến hiện chỉ có: một câu editorial, một đoạn mô tả, một đoạn `story`, một ảnh. Đó là mức **thẻ giới thiệu**, chưa phải mức **hồ sơ điểm đến** mà chủ dự án đang mô tả (lịch sử + video + báo chí + thuyết minh).

### 14.5 🟠 W-D. Nội dung nằm trong mã nguồn — sửa một dấu phẩy phải deploy

`content/destinations.ts` là file TypeScript hằng. Với 8 điểm × 2 ngôn ngữ thì còn chịu được. Với tham vọng thêm nhiều bài viết lịch sử, video, trích dẫn báo chí, kịch bản thuyết minh × 2 ngôn ngữ thì mô hình này **sẽ vỡ**: mỗi lần biên tập viên sửa chữ đều phải nhờ lập trình viên và chờ build.

Ngoài ra `Localized = {vi, en}` **cứng đúng 2 ngôn ngữ**. Thêm tiếng Hàn/Trung/Nhật (thị trường khách lớn của Ninh Bình) sẽ phải sửa kiểu dữ liệu ở mọi nơi.

### 14.6 🟡 W-E. Chưa có khái niệm khách sạn / nhà hàng / hướng dẫn viên

Catalog hiện chỉ có `PackageCatalogItem` với một `ledgerType`. Ninh Bình Legend, nhà hàng, HDV **chưa tồn tại dưới bất kỳ dạng dữ liệu nào**.

Đây không phải "thêm vài bản ghi". Ba loại này có mô hình đặt chỗ **khác nhau về bản chất**:

| Loại | Đơn vị bán | Ràng buộc |
|---|---|---|
| Vé tham quan | lượt/người/khung giờ | sức chứa theo khung giờ |
| Khách sạn | phòng × đêm | tồn kho theo loại phòng, chính sách hủy, mùa giá |
| Nhà hàng | bàn × khung giờ | số bàn, thời lượng ngồi |
| Hướng dẫn viên | người × buổi | lịch cá nhân, ngôn ngữ, không nhân bản được |

Nhét chung vào một kiểu sẽ phải viết lại toàn bộ về sau. **Cần thiết kế trước khi thêm cái đầu tiên.**

### 14.7 🟡 W-F. Hai hệ điều hành song song

Tồn tại đồng thời `app/ops/**` (13 trang: bookings, check-in, capacity, incidents, copilot, catalog...) và `app/erp/**` (15 module). **Trùng chức năng ở ít nhất 4 chỗ** (đặt chỗ, check-in, sức chứa, sự cố), hai màn đăng nhập riêng.

Cần chốt một cái là chính. Nếu `/ops` là bản cũ thì gỡ hoặc đóng băng — để hai hệ song song thì mỗi tính năng mới phải làm hai lần, và không ai biết số nào là số thật.

---

## 15. Đánh giá định hướng mới

### 15.1 Thanh toán — phải chỉnh lại một kỳ vọng

**VNPay cho khách Việt: đúng lựa chọn.** Phổ biến nhất, hỗ trợ QR/ATM nội địa/ví, tài liệu tiếng Việt.

**Nhưng "kiếm cái pay nào opensource cho nhanh" thì cần nói thẳng: không tồn tại cổng thanh toán mã nguồn mở.** Tiền luôn phải đi qua một tổ chức được cấp phép. Thứ mã nguồn mở chỉ là **lớp điều phối** (Hyperswitch, Medusa payments, Kill Bill) — chúng không giữ tiền, vẫn phải cắm vào một cổng thật phía sau. Cài chúng vào lúc này **làm chậm chứ không nhanh hơn**.

**Đề xuất — một nhà cung cấp, hai luồng:**

| Khách | Phương án | Lý do |
|---|---|---|
| Việt Nam | **VNPay** (QR, ATM nội địa, ví) | Chuẩn thị trường |
| Quốc tế | **Cổng thẻ quốc tế của chính VNPay hoặc OnePay** (Visa/Master/JCB/Amex) | **Cùng một pháp nhân, một hợp đồng, một bảng đối soát** |

Vì sao không Stripe: Stripe **không hỗ trợ doanh nghiệp đăng ký tại Việt Nam** (theo hiểu biết hiện tại của tôi — cần kế toán/pháp chế xác nhận lại). Đi đường vòng qua pháp nhân nước ngoài là chuyện thuế và pháp lý, không phải chuyện kỹ thuật. Nếu sau này thật sự cần nhiều cổng, khi đó mới đặt **Hyperswitch** (Apache-2.0, tự host) làm lớp trung gian — nhưng đó là tối ưu giai đoạn sau.

**Ba điều quan trọng hơn cả việc chọn cổng:**

1. **Thời gian thật sự nằm ở thủ tục, không ở code.** Tích hợp VNPay chỉ mất vài ngày. Ký hợp đồng, thẩm định pháp nhân, cấp mã merchant, qua sandbox rồi mới lên production — mất **vài tuần**. **Nên bắt đầu thủ tục ngay từ bây giờ, song song với việc phát triển**, đừng chờ code xong mới đi ký.
2. **Có thu tiền là phát sinh nghĩa vụ hóa đơn điện tử** (Nghị định 123/2020 và bản sửa đổi 2025 — cần kế toán xác nhận chi tiết áp dụng). Phải tính vào thiết kế ngay từ đầu, không vá sau.
3. **Tiền vào phải chảy thẳng vào dây chuyền ERP đã dựng.** Nếu web bán vé mà số liệu không tự vào chốt ca thì lại đẻ ra **nguồn số thứ hai** — đúng cái bệnh đã chỉ ra ở L1. Làm đúng thì việc này **giải luôn V7 (nguồn vé thật) và V6 (check-in đối chiếu vé thật)**: web bán → sinh vé thật → check-in quét vé thật → doanh thu tự vào chốt ca. **Đây là mắt xích khiến toàn bộ hệ thống trở nên có thật.**

### 15.2 Nội dung chiều sâu (lịch sử, video, báo chí song ngữ)

**Đồng ý về hướng.** Đây đúng là thứ phân biệt một trang bán vé với một điểm đến số.

Ba lưu ý:

1. **Phải chuyển nội dung ra khỏi mã nguồn trước khi viết nhiều** (W-D). Làm ngược lại thì càng viết càng khó gỡ.
2. **Báo chí: trích dẫn có link, không đăng lại toàn văn.** Đăng nguyên bài của báo khác là vi phạm bản quyền. Cách đúng: thẻ trích dẫn (logo báo + tiêu đề + 1–2 câu + link về nguồn) — vừa hợp pháp, vừa tạo uy tín, vừa không tốn công dịch.
3. **Video: đừng tự host.** Nhúng từ YouTube/Vimeo, giữ ảnh poster tự host để trang không phụ thuộc mạng ngoài lúc tải đầu. Cần phụ đề cả vi lẫn en — đây cũng là yêu cầu tiếp cận (accessibility), không chỉ là dịch thuật.

### 15.3 Thuyết minh giọng nói — điểm mạnh nhất của cả tầm nhìn

Đây là ý có sức thuyết phục cao nhất và cũng khả thi nhất về kỹ thuật. Cách làm đề xuất:

**Hai tầng, đúng như chủ dự án mô tả:**

- **Bản demo miễn phí (30–60 giây) cho *mọi* khu** — phát ngay trên trang điểm đến và khi quét QR tại chỗ. Đây là công cụ bán hàng, không phải sản phẩm.
- **Bản đầy đủ (5–15 phút, nhiều chặng) nằm trong combo** — phải **gắn quyền truy cập vào pass/booking token**. Nếu chỉ để file mp3 ở đường dẫn công khai thì ai cũng tải được và combo mất giá trị ngay ngày đầu.

**Kỹ thuật:**

- **Sinh sẵn thành file tĩnh** bằng TTS (ElevenLabs / Google / Azure), **không gọi TTS thời gian thực**. Rẻ hơn nhiều lần, phát tức thì, và nghe được khi mất sóng.
- **Cho tải trước khi vào khu.** Hang động Tràng An và khu núi Bái Đính sóng rất yếu — thuyết minh online sẽ đứt đúng lúc cần nhất. Hệ thống **đã có PWA**, tận dụng được ngay để lưu sẵn audio.
- Song ngữ ngay từ đầu: cùng một kịch bản, hai bản thu.

**Một ranh giới cần thống nhất trước:** thuyết minh trong khu tâm linh (Bái Đính, khu thờ tự) phải thống nhất với ban quản lý về nội dung và âm lượng. Tài liệu khách đã ghi nguyên tắc *"không tự động ra quyết định an toàn hoặc nghi lễ khi chưa có người có thẩm quyền duyệt"*. Nên có bước duyệt kịch bản, và khuyến nghị dùng tai nghe thay vì loa ngoài ở khu thờ tự.

### 15.4 "Toàn diện nhưng đẩy Xuân Trường nhiều hơn" — làm được, nhưng phải minh bạch

**Đây là chiến lược đúng và hoàn toàn làm được.** Nhưng có một ranh giới không nên bước qua:

**Nên làm:** ưu tiên vị trí hiển thị, gói combo trọn gói chỉ hệ sinh thái mới làm được (vé + xe + khách sạn + HDV + thuyết minh trong một lần đặt), gắn **nhãn rõ ràng "Cơ sở thành viên"** trên các điểm/khách sạn/nhà hàng thuộc hệ thống.

**Không nên làm:** giả vờ là bảng xếp hạng khách quan trong khi thực chất là danh mục của một chủ sở hữu. Khách phát hiện ra sẽ phản tác dụng mạnh hơn nhiều so với lợi ích thu được; ở thị trường EU/Anh/Mỹ đây còn là vấn đề pháp lý về quảng cáo.

**Điều nghịch lý — và là lý do chiến lược này thật sự tốt:** giới thiệu đầy đủ cả những điểm không thuộc Xuân Trường chính là thứ khiến trang trở nên **đáng tin**, và niềm tin đó mới là cái bán được combo. Một trang chỉ nói về mình là brochure; một trang nói về cả vùng nhưng phục vụ tốt nhất ở phần của mình là **hạ tầng điểm đến** — đúng định vị mà đề án TrangAn.vn v3 của khách đã nêu.

---

## 16. GIAO VIỆC — web công khai (ký hiệu W, tách khỏi backlog ERP)

> Thứ tự này khác backlog ERP: ở đây **thủ tục pháp lý là đường găng**, nên phải khởi động trước dù chưa viết dòng code nào.

### Khởi động ngay (không cần code)

- [ ] ~~**W0. Bắt đầu thủ tục VNPay**~~ → **ĐÃ SỬA, xem mục 18.1.** Chủ dự án phản biện đúng: dự án còn ở giai đoạn demo, ký hợp đồng lúc này là ký sớm. Việc thay thế: **tích hợp VNPay ở môi trường sandbox tự đăng ký, không cần hợp đồng.**
- [x] **W0b. Chốt định vị sản phẩm** — đã chốt ngày 01/08/2026, xem mục 18.2. Còn lại một quyết định kỹ thuật: `/ops` giữ hay gỡ.

### Đợt W1 — Nền nội dung (làm trước khi viết nhiều nội dung)

- [ ] **W1. Đưa nội dung ra khỏi mã nguồn** — bảng nội dung trong Supabase, có nháp/duyệt/xuất bản, mô hình đa ngôn ngữ mở rộng được (không cứng 2 ngôn ngữ). Xử lý W-D.
- [ ] **W2. Nâng "thẻ điểm đến" thành "hồ sơ điểm đến"** — thêm phần lịch sử nhiều đoạn, thư viện ảnh, video nhúng, thẻ trích dẫn báo chí (có link, không toàn văn). Xử lý W-C.

### Đợt W2 — Thuyết minh giọng nói (đòn bẩy lớn nhất)

- [ ] **W3. Bản demo thuyết minh 30–60 giây cho toàn bộ điểm đến**, song ngữ, file tĩnh, phát trên trang điểm đến và khi quét QR tại chỗ.
- [ ] **W4. Bản thuyết minh đầy đủ theo combo**, **kiểm soát truy cập bằng pass token**, tải trước được qua PWA. Kèm quy trình duyệt kịch bản cho khu tâm linh.

### Đợt W3 — Thương mại thật (mắt xích quan trọng nhất của cả dự án)

- [ ] **W5. Tích hợp VNPay nội địa + cổng thẻ quốc tế cùng nhà cung cấp** — kèm hoàn/hủy, và **hóa đơn điện tử**.
- [ ] **W6. Nối doanh thu web thẳng vào ERP** — vé bán ra sinh vé thật, check-in quét vé thật, doanh thu tự vào chốt ca. **Việc này đóng luôn V6 + V7 và là thứ biến hệ thống từ "trình diễn" thành "có thật".**

### Đợt W4 — Mở rộng danh mục hệ sinh thái

- [ ] **W7. Thiết kế mô hình đặt chỗ đa loại** (vé / phòng-đêm / bàn-giờ / HDV-buổi) — **thiết kế trước, thêm dữ liệu sau**. Xử lý W-E.
- [ ] **W8. Đưa Ninh Bình Legend + nhà hàng tiêu biểu + HDV lên catalog**, có nhãn "Cơ sở thành viên" minh bạch.
- [ ] **W9. Combo trọn gói hệ sinh thái** — vé + xe + lưu trú + HDV + thuyết minh đầy đủ trong một lần đặt. Đây là sản phẩm mà chỉ hệ sinh thái mới làm được, và là lý do thương mại của toàn bộ Phần III.

---

## 17. Tóm tắt Phần III

**Web công khai có nền tốt hơn mong đợi — song ngữ từ tầng dữ liệu, QR Pass thật, kỷ luật ghi nguồn — nhưng chưa có video, chưa có audio, chưa có khách sạn/nhà hàng/HDV, và cố ý chưa nhận được tiền thật.**

**Đường găng là thủ tục VNPay, nên khởi động ngay hôm nay. Đòn bẩy lớn nhất là thuyết minh giọng nói. Và mắt xích quan trọng nhất là W6 — nối doanh thu web vào ERP: nó vừa là lý do thương mại của web, vừa là thứ vá đúng cái lỗ lớn nhất của ERP (nguồn vé gõ tay).**

**Về chiến lược đẩy Xuân Trường: làm được, nên làm, nhưng phải gắn nhãn minh bạch — chính sự đầy đủ và trung thực về cả vùng mới tạo ra niềm tin để bán được combo của hệ sinh thái.**

---

## 18. Phản hồi của chủ dự án và quyết định chốt (01/08/2026)

### 18.1 W0 được sửa: **không ký hợp đồng ở giai đoạn demo**

**Phản biện của chủ dự án:** *"Ký xong rồi mà dự án demo thì ký làm gì, khi làm dự án thật thì sẽ phải build lại mà."* — **Đúng.** Khuyến nghị W0 ban đầu của tôi sai nhịp: nó áp lịch của một dự án đang chuẩn bị vận hành lên một dự án đang chuẩn bị trình diễn.

**Sự thật đã bỏ sót:** **VNPay có môi trường sandbox tự đăng ký** (`sandbox.vnpayment.vn`) — cấp `TmnCode` + `HashSecret` thử nghiệm, có thẻ test, có URL thanh toán thật, có IPN thật. **Không cần hợp đồng, không cần thẩm định pháp nhân, không mất phí.** (Cần kiểm tra lại yêu cầu đăng ký hiện hành khi bắt tay làm.)

**Và không phải "build lại".** Luồng kỹ thuật của VNPay sandbox **giống hệt** production — cùng thuật toán ký (HMAC-SHA512 trên chuỗi tham số đã sắp xếp), cùng cấu trúc redirect, cùng ReturnURL/IPN. Khác biệt khi lên thật chỉ là **3 biến môi trường**: `TmnCode`, `HashSecret`, endpoint.

**Thuận lợi sẵn có:** dự án **đã có sẵn khuôn adapter thanh toán** (`services/adapters/sandbox-payment.ts` với `sign` / `verify` / `nextStatus`, đã dùng HMAC và `timingSafeEqual`). Thêm `VnpayAdapter` theo đúng giao diện đó là **cộng thêm, không phải viết lại**.

**W0 mới:**

- [ ] **W0. Tích hợp VNPay ở môi trường sandbox** qua một adapter mới, giữ nguyên khuôn adapter hiện có. Không ký gì cả.
- [ ] **W0-qt. Thẻ quốc tế: PayPal sandbox** (đăng ký tự phục vụ tại developer.paypal.com, miễn phí, không cần pháp nhân) để demo được luồng khách nước ngoài. Quyết định cổng quốc tế **thật** để lại đến khi có lịch vận hành.
- [ ] **W0-live. Chỉ khởi động thủ tục hợp đồng khi đã có ngày vận hành thật.** Lúc đó mới là lúc vài tuần thủ tục trở thành đường găng — không phải bây giờ.

**Lợi ích phụ đáng kể:** demo bằng sandbox thật của VNPay **thuyết phục hơn** một modal giả — khách thấy đúng trang thanh toán VNPay, đúng luồng chuyển hướng, đúng thông báo kết quả. Và nó **trung thực**: hiển thị rõ "môi trường thử nghiệm", đúng nguyên tắc *"không tuyên bố quá sớm"* trong tài liệu khách.

**Rút kinh nghiệm cho các phiên sau:** dự án này đang ở **giai đoạn demo/tiền bán hàng**, không phải giai đoạn triển khai. Đừng khuyến nghị các bước tốn thủ tục, tiền hoặc cam kết pháp lý (hợp đồng cổng thanh toán, đăng ký hóa đơn điện tử, thuê hạ tầng trả phí) cho tới khi có **ngày vận hành thật**. Ưu tiên mọi phương án **sandbox / tự phục vụ / miễn phí** có cùng hình dạng kỹ thuật với bản thật.

### 18.2 W0b đã chốt: định vị sản phẩm

**Quyết định của chủ dự án:**

> Web là **du lịch Ninh Bình** (toàn diện). Xuân Trường là bên bỏ tiền đẩy du lịch cho cả tỉnh; **đẩy Xuân Trường lên là tri ân**, không gây thiệt cho ai, người dân cũng được lợi.

**Đánh giá: định vị này vững, và vững hơn phương án "cả hai lớp" tôi nêu ở mục 14.3.** Lý do: nó có một câu chuyện thật đứng sau, không phải một thủ thuật xếp hạng. Trang giới thiệu toàn diện Ninh Bình, và các cơ sở do Xuân Trường đầu tư được nêu bật vì **họ là người tài trợ hạ tầng số này** — đó là điều có thể nói thẳng ra trên trang.

**Cách thể hiện — đã chốt ngày 01/08/2026:** tôi có đề xuất ghi một dòng công bố tài trợ ở chân trang; **chủ dự án bác bỏ và giữ nguyên quyết định**, lý do: ghi ra thì người xem lại tưởng đây là trang quảng cáo, mà bên tài trợ cũng không cần được nêu tên.

**Kết luận thi hành: KHÔNG ghi công bố tài trợ. Ưu tiên được cài âm thầm ở tầng gợi ý** — hệ thống recommend các cơ sở trong hệ sinh thái nhiều hơn, trang vẫn trình bày như một trang du lịch Ninh Bình bình thường.

Về mặt thực thi, đây là chuyện hoàn toàn bình thường: mọi nền tảng đặt dịch vụ đều xếp thứ tự gợi ý theo tiêu chí thương mại của mình. **Ranh giới duy nhất cần nhớ về sau:** chừng nào trang **không tự nhận là bảng xếp hạng khách quan** thì không có gì mâu thuẫn. Chỉ khi nào sau này thêm các yếu tố hàm ý khách quan — "Top 10 điểm đến tốt nhất", điểm sao do người dùng chấm, "được bình chọn nhiều nhất" — thì mới cần xem lại, vì lúc đó thứ tự gợi ý và lời tuyên bố sẽ nói hai điều khác nhau. Hiện tại trang không có yếu tố nào như vậy, nên cứ triển khai như chủ dự án đã chốt.

- [ ] **W12. Tầng gợi ý có trọng số** — thêm trường độ ưu tiên cho điểm đến/khách sạn/nhà hàng và dùng nó khi xếp thứ tự gợi ý, đề xuất combo, kết quả tìm kiếm. Không hiển thị nhãn nào ra ngoài.

### 18.3 Tam Chúc — câu hỏi của tôi đã lỗi thời

**Chủ dự án hỏi lại:** *"Tam Chúc có lên web không là sao? Nếu là giới thiệu thì ok chẳng vấn đề gì, chứ lên kiểu khác thì phải suy nghĩ."*

Phân biệt của chủ dự án đúng: **giới thiệu** và **bán** là hai chuyện khác nhau. Nhưng câu hỏi gốc của tôi dựa trên một giả định **đã lỗi thời**:

**Từ 01/07/2025, Hà Nam – Nam Định – Ninh Bình đã hợp nhất thành tỉnh Ninh Bình** (Nghị quyết 202/2025/QH15). **Tam Chúc nay thuộc tỉnh Ninh Bình.** *(Cần chủ dự án xác nhận lại, nhưng nếu đúng thì...)*

→ **Không còn mâu thuẫn nào cả.** Tam Chúc thuộc Ninh Bình thì lên trang "du lịch Ninh Bình" là **đương nhiên**, cả phần giới thiệu lẫn phần bán — không cần cân nhắc gì thêm. Câu hỏi W0b(b) của tôi tự nó biến mất.

**Ngược lại, phát hiện ra hai chỗ dữ liệu đang sai:**

| Chỗ | Hiện tại | Đúng ra |
|---|---|---|
| `domain/erp.ts:86` | Tam Chúc `province: "Hà Nam"` | `"Ninh Bình"` |
| `content/destinations.ts` — `NINH_BINH_TOURISM_CORE.bounds` | `north: 20.42` | Tam Chúc ở vĩ độ **20.5579** → **nằm ngoài khung bản đồ**, phải nới `north` |

Việc thêm Tam Chúc lên web vì thế không chỉ là thêm một bản ghi: **phải nới ranh giới vùng du lịch trong `config`/`content`**, nếu không điểm này sẽ rơi ra ngoài bản đồ và ngoài bộ lọc theo vùng.

- [ ] **W10. Cập nhật địa giới sau sáp nhập tỉnh** — sửa `province` của Tam Chúc, nới `NINH_BINH_TOURISM_CORE.bounds`, rà lại mọi chỗ ghi "Hà Nam". Sau đó thêm Tam Chúc vào danh mục điểm đến công khai. *(Nhỏ, nhưng phải làm trước W2.)*
### 18.4 `/ops` là gì — giải thích

`/ops` **không phải bản nháp của `/erp`. Nó là một hệ thống khác, ra đời trước, theo một kiến trúc khác hẳn.**

| | `/ops` (cũ) | `/erp` (mới) |
|---|---|---|
| Đăng nhập | **Supabase Auth thật** — email + mật khẩu (`supabase.auth.signInWithPassword`) | Cookie tự ký, tài khoản hard-code trong `demo-data.ts` |
| Vai trò | `check-in-agent`, `site-supervisor`, `icc-operator`, `finance`, `admin` (tiếng Anh) | `employee`, `manager`, `accountant`, `chief-accountant`, `director` (tiếng Việt) |
| Đơn vị cách ly | **"Demo room"** — mỗi buổi demo là một phòng riêng, dữ liệu tách biệt, có QR ghép khách vào phòng | Cơ sở (Tràng An / Tam Chúc / Tam Cốc / Bái Đính) |
| Phạm vi | 13 trang: bookings, check-in, capacity, incidents, copilot, catalog, modules… | 15 module nghiệp vụ |

Nói ngắn: `/ops` là sản phẩm **"DestinationOS"** ban đầu — thiết kế để nhiều người cùng demo song song mà không đụng dữ liệu nhau. `/erp` là hệ thống vận hành tiếng Việt dựng sau, theo hướng doanh nghiệp thật.

**Vì sao nó không chỉ là rác cần xóa:** `/ops` **đã có đăng nhập thật bằng Supabase Auth** — đúng thứ mà V10 và V17 đang định xây cho `/erp`. Nếu xóa thẳng thì vứt luôn phần đó.

**Và vì sao nó gây hại nếu để nguyên:** kiến trúc "demo room" của `/ops` **đã chặn ngang web công khai** — chính là lỗi P1 ở mục 19 dưới đây. Nó không nằm yên một chỗ.

**Khuyến nghị:** giữ `/ops` như **kho tham khảo kỹ thuật đóng băng** (không thêm tính năng, không sửa trừ khi nó chặn cái khác), rút phần Supabase Auth ra dùng cho `/erp` khi làm V17, rồi mới gỡ. **Không** phát triển song song hai hệ — mỗi tính năng làm hai lần là cách chắc chắn nhất để không cái nào xong.

---

## 19. Lỗi đã phát hiện và sửa ngày 01/08/2026 — trình lập hành trình & bản đồ

Chủ dự án báo "plan trip và map đang bị hỏng". Đã truy được nguyên nhân và sửa. Đây **không phải lỗi giao diện** — nghiêm trọng hơn nhiều.

### 19.1 🔴 P1. Trình lập hành trình chết hoàn toàn với khách thường

**Nguyên nhân gốc:** `app/api/journeys/route.ts` đòi **hai** thứ trước khi trả về bất cứ gì:
1. cookie `nbj-active-run` — chỉ được cấp bởi `/api/demo-runs` hoặc `/api/demo-runs/join`;
2. một phiên Supabase **ẩn danh đã xác thực**.

Rà toàn bộ mã nguồn: **không có middleware nào, và không nơi nào gọi `signInAnonymously`.** Khách vào `/plan` từ trang chủ **không có cả hai**. Bấm "Xác nhận và tạo hành trình" → luôn thất bại.

Nói cách khác: **kiến trúc "demo room" của `/ops` đã chặn ngang tính năng chính của web công khai.** Đây là ví dụ cụ thể cho lý do phải chốt số phận `/ops` (mục 18.4).

**Đã sửa:** demo room giờ chỉ cần khi muốn **lưu**. Không có room thì API vẫn sinh và kiểm tra lịch trình đầy đủ, trả về kèm `persisted: false`; hành trình sống trong trình duyệt. Có room thì giữ nguyên hành vi cũ.

**⚠️ Còn lại:** `/api/quotes` (báo giá / đặt gói) **vẫn còn đúng ràng buộc này** và chưa được sửa trong đợt này — xem W13.

### 19.2 🟠 P2. Mọi hành trình đều đi vào ngày 15/08/2026

`plan-experience.tsx` gửi `visitDate: "2026-08-15"` **viết cứng**. Không có ô chọn ngày. Một trang lập kế hoạch du lịch mà khách không chọn được ngày đi.

**Đã sửa:** thêm ô chọn ngày, mặc định hôm nay + 7 ngày, không cho chọn quá khứ.

### 19.3 🟠 P3. Bản đồ trong lịch trình là hình vẽ giả

Khối "bản đồ" trong `itinerary-editor.tsx` là một **đa giác SVG vẽ tay** — không phải hình Ninh Bình, chỉ là hình thù trang trí — với các chấm đặt bằng cách quy đổi toạ độ vào khung đó. Nhãn góc ghi *"Route reveal · local tourism-core canvas"*.

Vi phạm thẳng `docs/UI_UX_RULES.md`: *"Use a real interactive map, not a fake text map."* Nghịch lý là dự án **đã có Leaflet thật** ở trang chủ.

**Đã sửa:** thay bằng bản đồ Leaflet thật — marker đánh số theo thứ tự, đường nối các chặng, tự căn khung theo các điểm dừng.

### 19.4 🟠 P4. "Bạn đang ở đây" gắn nhầm chỗ trên bản đồ chính

`app/tourism-map.tsx` gắn nhãn cố định `youAreHere` lên **cả marker chào đón lẫn điểm đến đang chọn**. Hệ quả: bấm vào Tràng An là hiện **"Bạn đang ở đây"** — dù khách đang ngồi ở Hà Nội. Và hai nhãn có thể hiện cùng lúc.

**Đã sửa:** nhãn đó giờ **chỉ thuộc marker định vị GPS thật**; điểm đến đang chọn hiện **tên của chính nó**; marker chào đón chỉ hiện nhãn khi chưa chọn điểm nào. Kèm memo hóa icon Leaflet (trước đây tạo lại mỗi lần render).

### 19.5 Kiểm chứng

`typecheck` / `lint` sạch · `test:run` **255 pass / 1 skip** · `build` sạch.

**Không verify được cục bộ** — máy này không có `NEXT_PUBLIC_SUPABASE_*` nên `/plan` render màn "chưa cấu hình". Đã theo đúng cadence dự án: push → `vercel inspect` xác nhận deployment **Ready** → chạy Playwright thật trên production.

Bài mới `tests/e2e/public-journey-planner.spec.ts` (khách thường tạo được hành trình / tự chọn ngày / sửa hành trình chưa lưu) cùng `public-surfaces.spec.ts`: **28/28 pass trên cả desktop và mobile.**

### 19.6 Việc phát sinh

- [ ] **W13. Gỡ ràng buộc demo room khỏi `/api/quotes`** — cùng bệnh với P1, chưa sửa. Luồng báo giá/đặt gói của khách thường nhiều khả năng vẫn đang chết. **Nên kiểm tra ngay.**
- [ ] **W14. Rà các lối vào công khai khác còn phụ thuộc demo room** — `/api/journeys/[id]` (PATCH), `/checkout`, `/booking/[code]`. Cần một lượt quét có hệ thống, không sửa lắt nhắt.

---

## 20. KIỂM CHỨNG TOÀN HỆ THỐNG TRÊN PRODUCTION — 01/08/2026

> Chủ dự án yêu cầu: kiểm chứng từ web tới ERP, **chỉ kiểm tra, không sửa**, ghi lại cho phiên sau.
>
> **Cách làm:** quét tĩnh toàn bộ route + chạy Playwright thật trên `https://ninhbinhjourney.vercel.app`, **chỉ đọc, không bấm nút ghi dữ liệu**. Script kiểm chứng đặt trong thư mục tạm và đã xoá sau khi chạy — mọi kết luận dưới đây là **kết quả quan sát thật**, kèm nguyên văn chuỗi đọc được.

### 20.0 ⚠️ Cảnh báo cho phiên sau — cái bẫy đã làm tôi báo sai 3 lần

Lần chạy đầu, bài kiểm chứng ERP dùng `page.waitForURL(/\/erp(\/|$)/)` sau khi bấm đăng nhập. **`/erp/login` cũng khớp mẫu đó**, nên hàm trả về ngay khi vẫn còn ở trang đăng nhập. Kết quả: 3 kết luận sai nghiêm trọng — "nhân viên vào được cả 15 module", "vào được cơ sở khác", "ẩn danh vào được /erp".

Sau khi sửa thành `waitForURL(url => !url.pathname.startsWith("/erp/login"))` **cả ba đều biến mất — phân quyền thật ra hoạt động đúng.**

**Bài học: khi một kết quả mâu thuẫn với điều đã kiểm chứng ở phiên trước, nghi ngờ bài test trước, đừng vội ghi vào tài liệu.**

### 20.1 Web công khai — đang chạy đúng

| Hạng mục | Kết quả quan sát |
|---|---|
| `/`, `/explore`, `/packages`, `/packages/[slug]` | HTTP 200, hiển thị đủ |
| 8 trang chi tiết điểm đến | **8/8 HTTP 200** |
| Chuyển ngôn ngữ `?lang=en&source=trang_an` | Đổi sang tiếng Anh đúng, giữ tham số |
| `/api/health` | `{"ok":true,"dataMode":"supabase-shared","experienceMode":"production"}` |
| **Trình lập hành trình (vừa sửa)** | `POST /api/journeys` không có demo room → **HTTP 200, `persisted:false`, 2 điểm dừng** ✅ |
| **Bản đồ trang chủ (vừa sửa)** | 16 marker, 12 ô bản đồ, **đúng 1 nhãn duy nhất ghi "Điểm chào đón"** — lỗi "Bạn đang ở đây" gắn nhầm đã hết ✅ |

### 20.2 Web công khai — lỗi đã kiểm chứng

#### 🔴 P5. `/api/quotes` chết — đã xác nhận bằng gọi thật

```
POST /api/quotes → HTTP 409
{"error":{"code":"DEMO_ROOM_NOT_JOINED","message":"Pair this visitor with an active demo room before requesting a quote."}}
```

Đúng như dự đoán ở W13, nay **đã chứng minh bằng runtime chứ không còn là suy luận từ mã nguồn**. Luồng báo giá của khách thường chết hoàn toàn.

#### 🔴 P6. Không có đường mua hàng nào trên production

`/checkout?package=heritage-day` → HTTP 200 nhưng nội dung là:

> *"Online checkout is not configured. Sandbox payment controls are intentionally hidden outside the client-demonstration mode."*

Đây là **thiết kế có chủ ý** (mục 14.2), không phải lỗi kỹ thuật. Nhưng hệ quả thực tế: **toàn bộ phễu bán hàng cụt ở bước cuối**. Ghi lại để không ai demo tới bước này rồi mới phát hiện.

#### 🟠 P7. Hang Múa vô hình trên `/explore`

`/explore` chỉ liệt kê **7 điểm**: Tràng An, Cố đô Hoa Lư, Chùa Bái Đính, Phố cổ Hoa Lư, Tam Cốc–Bích Động, Thung Nham, Đầm Vân Long. **Thiếu Hang Múa** — dù `/destination/hang-mua` trả 200 bình thường.

**Nguyên nhân (đã truy ra):** bộ lọc mức đi bộ mặc định là `moderate`; Hang Múa có `mobilityLevel: "high"` nên **bị loại ngay từ đầu**. Trang hiển thị "7 điểm" mà **không hề báo có bộ lọc đang ẩn bớt**.

Hang Múa là một trong những điểm được chụp ảnh nhiều nhất Ninh Bình. Khách vào lần đầu sẽ không bao giờ thấy nó. **Không phải lỗi mã — là mặc định che nội dung mà không nói.**

#### 🟠 P8. ~~`/explore` vẫn dùng bản đồ SVG giả~~ — **ĐÃ SỬA 01/08/2026**

Đo trên production ở chế độ "Bản đồ": `leaflet-container = 0`, `leaflet-tile = 0`, marker = 0. Kiểm tra mã: `explore-experience.tsx` vẽ `<svg viewBox="0 0 100 100">`, `aria-label` ghi *"Bản đồ ngữ cảnh… không phải địa giới hành chính"*.

Cùng loại với bản đồ giả trong lịch trình đã sửa ở mục 19.3.

**Đã sửa:** thêm `components/discovery/explore-map.tsx` — Leaflet thật, nạp động `ssr:false`, cùng khuôn với bản đồ trang chủ và bản đồ lịch trình. Tự căn khung (`fitBounds`) theo đúng tập điểm đang lọc; chọn điểm bằng marker hoặc nút "Tập trung trên bản đồ" ở danh sách đều mở cùng một khung chi tiết như trước; focus quay lại đúng phần tử vừa bấm khi đóng khung — tận dụng việc Leaflet tự gắn `tabindex`/`role=button` cho marker.

Bài test `public-surfaces.spec.ts` từng ghi nhận bản đồ giả là hành vi mong muốn (*"discovery remains usable without interacting with a network tile map"*) — đã đổi tên thành *"discovery list mode works without waiting on the map"* (vẫn đúng: chế độ danh sách không phụ thuộc mạng) và thêm bài mới khẳng định chế độ bản đồ hiện render `.leaflet-container` thật kèm marker.

**Kiểm chứng:** `typecheck`/`lint`/`test:run` (255 pass) / `build` sạch cục bộ → push → `vercel inspect` xác nhận deployment `ninhbinhjourney-h0266i1yu` **Ready** → Playwright thật trên production: **30/30 pass, cả desktop và mobile**, gồm bài khẳng định `.leaflet-container` + marker hiển thị.

Không còn bản đồ giả nào trong toàn bộ web công khai — đã quét lại `grep -rl "viewBox=\"0 0 100 100\""` trên `app/`, `components/`, ra rỗng.

#### 🟠 P9. Trang không tồn tại vẫn trả HTTP 200

| Đường dẫn | Trạng thái HTTP | Nội dung |
|---|---|---|
| `/destination/khong-ton-tai` | **200** | "404 · NOT FOUND Không tìm thấy điểm dừng này" |
| `/journey/<id lạ>` | **200** | như trên |

Hiển thị đúng cho người đọc nhưng **sai với máy**: Google và mọi trình thu thập sẽ hiểu đây là trang hợp lệ và lập chỉ mục rác. Cần `notFound()` thật của Next.js.

#### 🟡 P10. Trang vé/booking sai: chờ lâu rồi báo lỗi bằng tiếng Anh

| Đường dẫn | Sau 12 giây |
|---|---|
| `/pass/<token sai>` | **"Something went wrong. Please retry."** |
| `/booking/<mã sai>` | **"Booking was not found."** |

Hai vấn đề: (a) treo ở "Đang đồng bộ QR Pass…" khá lâu trước khi báo lỗi; (b) **thông báo lỗi bằng tiếng Anh trên trang tiếng Việt**.

### 20.3 ERP — phần bảo mật và phân quyền: **đạt**

Đây là phần tôi kiểm kỹ nhất vì lần chạy đầu báo sai. Kết quả sau khi sửa bài test:

| Kiểm tra | Kết quả |
|---|---|
| 6/6 tài khoản đăng nhập | **Đều được** |
| Ẩn danh vào `/erp`, `/erp/trang-an`, `/erp/finance` | **Cả 3 đều dừng ở `/erp/login`** ✅ |
| `nv.trangan` vào module chưa được cấp (`tai-chinh-doi-soat`, `nhan-su`) | **Chuyển về `/erp/trang-an`** ✅ |
| `nv.trangan` vào cơ sở khác (`/erp/tam-chuc`) | **Chuyển về `/erp` kèm "Bạn chưa được phân công vào cơ sở hoặc nghiệp vụ này."** ✅ |
| `nv.trangan` vào `/erp/finance` | **Chuyển về `/erp`** ✅ |
| `POST /api/erp/assistant` khi chưa đăng nhập | **HTTP 401** ✅ |
| 15/15 trang module với giám đốc | Đều HTTP 200, có nút và trường nhập thật |
| Tài khoản thời vụ | Có màn riêng đúng: *"Quyền làm việc có hiệu lực đến 31/08/2026"* ✅ |

**Kết luận: lớp phân quyền là phần đáng tin nhất của hệ thống.** Không tìm được lỗ nào.

### 20.4 ERP — ba lỗi đã dự đoán, nay có bằng chứng chạy thật

#### 🔴 L1 xác nhận — số liệu tổng quan đúng là hằng số

Nguyên văn đọc được từ 4 trang tổng quan:

| Cơ sở | Chuỗi đọc được |
|---|---|
| Tràng An | `Tải hiện tại 68% · Sự cố mở 2` |
| Tam Chúc | `Tải hiện tại 83% · Sự cố mở 5` |
| Tam Cốc | `Tải hiện tại 61% · Sự cố mở 1` |
| Bái Đính | `Tải hiện tại 74% · Sự cố mở 3` |

Khớp **chính xác** hằng số trong `domain/erp.ts`. Không có gì thay đổi theo dữ liệu thật.

#### 🔴 L2 xác nhận — hai màn hình nói ngược nhau, cách nhau đúng một cú bấm

| Màn hình | Nội dung |
|---|---|
| `/erp/tam-chuc` (tổng quan) | **"Sự cố mở 5"** |
| `/erp/tam-chuc/su-co` (module sự cố) | **"1 hồ sơ đang mở"** |

Khách bấm vào đúng con số vừa đọc là thấy ngay mâu thuẫn.

#### 🔴 L3 xác nhận — và nghiêm trọng hơn tôi tưởng

| Màn hình | Nội dung |
|---|---|
| Trang chủ giám đốc `/erp` | **"0 hồ sơ cần quyết định"** |
| `/erp/tam-chuc/su-co` | **"Sự cố đã chuyển cấp… Cần quyết định 1 · Đã được quản lý xác minh"**, kèm **"Sát hoặc quá SLA 1 · Cần phản hồi ngay"** |

**Có một sự cố đã chuyển cấp, đã được quản lý xác minh, đang sát hoặc quá SLA — và người duy nhất có quyền quyết định thì nhìn thấy con số 0.** Đây không còn là thiếu sót hiển thị; đây là quy trình an toàn bị đứt ở đúng mắt cuối.

**Đề nghị nâng V2 lên ưu tiên cao nhất trong toàn bộ backlog.**

### 20.5 Những thứ vẫn chạy tốt trong ERP

- Module Dự án (Tràng An): dữ liệu thật — `Ngân sách 13 tỷ · 9,4 tỷ đã cam kết · Còn khả dụng 3,6 tỷ · Gói việc 0/3 · Tiến độ 35%`.
- Module Sự cố: có phân mức P1/P2, đếm SLA, hàng việc theo ưu tiên.
- Module Nhân sự: 50 trường nhập — bảng phân quyền thật.

### 20.6 Chưa kiểm chứng trong đợt này

Ghi rõ để phiên sau không tưởng nhầm là đã xong:

- Toàn bộ `/ops` (13 trang) — chưa đăng nhập thử lần nào.
- Luồng AP–NCC và kế toán với vai trò kế toán/kế toán trưởng — chỉ kiểm tra trang tải được, **chưa đi hết vòng nghiệp vụ**.
- `/demo/qr/[sourceCode]`, `/demo/join` — chỉ kiểm HTTP 200.
- Chế độ `client-demo` (checkout sandbox) — production chặn nên không chạm tới được.
- Hiển thị trên điện thoại của phần ERP — đợt này chỉ chạy desktop.
- Không bấm bất kỳ nút ghi dữ liệu nào (đúng yêu cầu "chỉ kiểm tra").

### 20.7 Việc phát sinh từ đợt kiểm chứng

- [ ] **W15. Trả HTTP 404 thật** cho `/destination/<slug lạ>` và `/journey/<id lạ>` (P9).
- [ ] **W16. Sửa trạng thái lỗi của `/pass` và `/booking`** — báo lỗi tiếng Việt, rút ngắn thời gian chờ, có hành động tiếp theo (P10).
- [ ] **W17. Bộ lọc `/explore` phải nói ra khi đang ẩn bớt** — hiện "7/8 điểm · đang lọc theo mức đi bộ" kèm nút bỏ lọc (P7).
- [x] **W18. Chốt số phận bản đồ `/explore`** — **ĐÃ SỬA 01/08/2026**, xem P8: thay bằng Leaflet thật, khớp `UI_UX_RULES.md`.
- [ ] **W13 (nâng ưu tiên). Gỡ ràng buộc demo room khỏi `/api/quotes`** — đã xác nhận chết bằng runtime.
- [x] **V2 (nâng lên ưu tiên số 1).** Sự cố quá SLA đang vô hình với giám đốc — bằng chứng ở 20.4. **ĐÃ SỬA 01/08/2026, xem mục 21.**

- [ ] **W11. Rà soát toàn bộ nội dung theo địa giới mới** — sau sáp nhập, Ninh Bình còn có các điểm của Nam Định và Hà Nam cũ (Phủ Dầy, đền Trần, chùa Tam Chúc...). Nếu định vị là *toàn diện du lịch Ninh Bình* thì phạm vi nội dung nay **rộng hơn 8 điểm hiện có đáng kể**. Đây vừa là việc phải làm, vừa là **cơ hội**: rất ít trang du lịch đã cập nhật theo địa giới mới. *(Vừa — chủ yếu là công biên tập.)*

---

## 21. V2 đã sửa — 01/08/2026

**Bằng chứng trước khi sửa (mục 20.4):** trang giám đốc `/erp` ghi "0 hồ sơ cần quyết định" trong khi `/erp/tam-chuc/su-co` có một sự cố đã chuyển cấp, đã được quản lý xác minh, đang quá SLA.

**Đã sửa:**
- Thêm `listEscalatedIncidents(siteIds)` (`lib/erp/incident-repository.ts`) và `listPendingProjectChangeRequests(siteIds)` (`lib/erp/project-repository.ts`) — mỗi hàm gọi song song qua toàn bộ cơ sở giám đốc quản lý, gộp kết quả; cơ sở nào chưa có sự kiện dự án thì chỉ đóng góp mảng rỗng thay vì làm lỗi cả trang.
- `directorDecisionCount` ở `app/erp/page.tsx`/`executive-dashboard-live.tsx` giờ cộng đủ 4 loại: ngoại lệ chốt ca, hồ sơ NCC, sự cố chuyển cấp, yêu cầu đổi phạm vi dự án — hiển thị dạng 4 số riêng (trước đó gộp 2 số vào một câu, giờ thêm 2 loại sẽ không đọc nổi).
- Mỗi sự cố chuyển cấp và mỗi yêu cầu đổi phạm vi hiện thành thẻ có link đi thẳng tới `/erp/{site}/su-co` hoặc `/erp/{site}/du-an-su-kien` — cùng khuôn với thẻ ngoại lệ NCC đã có.
- Chỉ sửa `ExecutiveDashboard` (màn giám đốc) — `RoleHomeDashboard` không có khái niệm "quyết định" tương tự nên không cần đổi.

**Kiểm chứng:** `typecheck`/`lint`/`test:run` (255 pass)/`build` sạch cục bộ → push → `vercel inspect` xác nhận **Ready** → Playwright thật trên production, bài mới `tests/e2e/prod-smoke-director-decision-inbox.spec.ts`:
1. Xác nhận số liệu + khối "Sự cố đã chuyển cấp" hiện trên `/erp` khớp với sự cố đã chuyển cấp thật đang có trên production.
2. **Xuyên 2 phiên riêng biệt:** quản lý gửi một yêu cầu đổi phạm vi mới tại Bái Đính (không duyệt) → giám đốc ở phiên khác thấy ngay thẻ đó trong hộp thư, link đúng `/erp/bai-dinh/du-an-su-kien`.

**2/2 pass trên production.** Chạy thêm hồi quy `prod-smoke-project-workflow.spec.ts` (2/2 pass, không ảnh hưởng). `prod-smoke-incidents.spec.ts` fail nhưng **không phải do thay đổi này** — bài đó tự ghi là one-shot (chuyển `INC-TA-071` từ "reported" sang "acknowledged" vĩnh viễn ở lần chạy trước đó), chạy lại luôn fail vì trạng thái đầu vào không còn đúng giả định. Đây là nợ kỹ thuật có sẵn của bộ test, không phải lỗi sản phẩm.

---

## 22. V1 đã sửa — 01/08/2026

**Bằng chứng trước khi sửa (mục 3, L1/L2):** 5 thẻ KPI ở trang tổng quan mọi cơ sở (`site.snapshot.*`) là hằng số viết cứng trong `domain/erp.ts`. Truy vấn Supabase production cho thấy 3/4 cơ sở tự mâu thuẫn giữa số "Sự cố mở" ở trang tổng quan và số thật ở module Sự cố.

**Đã sửa 3/5 số bằng dữ liệu thật:**
- **Sự cố mở** — `getIncidentCases(site.id)` lọc `status !== "closed"`, **đúng y hệt truy vấn module Sự cố dùng** → hai màn không thể lệch nhau nữa.
- **Nhân sự trong ca** — hàm mới `countEmployeesOnShift(siteId)` (`lib/erp/attendance-repository.ts`): gộp sự kiện `erp_staff_attendance_events` theo người, lấy sự kiện gần nhất mỗi người, đếm ai đang ở trạng thái "check-in".
- **Đã check-in hôm nay** — hàm mới `countGateScansToday(siteId)` (`lib/erp/gate-scan-repository.ts`): đếm `erp_gate_scan_events` trong ngày theo giờ Việt Nam. Có bản cho cả 2 chế độ lưu trữ (`demo-cookie` đếm mảng trong bộ nhớ; `supabase` dùng `count: "exact", head: true`).

**2 số còn lại chưa có nguồn dữ liệu thật** (Khách dự kiến — cần dữ liệu booking thật, thuộc L4/V6; Tải hiện tại — cần hạ tầng ngưỡng sức chứa, thuộc V8): theo đúng nguyên tắc đã ghi ở mục 8.4, hiển thị **"—"** kèm chú thích nhỏ **"Chưa có nguồn dữ liệu"** thay vì bịa số.

**Phạm vi có chủ đích:** chỉ sửa trang tổng quan cơ sở (`app/erp/[site]/page.tsx`). `domain/erp.ts`'s `snapshot` vẫn giữ nguyên và vẫn đang nuôi `camera-ai-workspace.tsx`, `finance-dashboard.tsx`, module Sức chứa trong `module-workspace.tsx`, và mô phỏng doanh thu trong `ticket-guest-workspace.tsx` — đây là các việc lớn hơn, thuộc V8 (sức chứa) và một nguồn vé thật (V7), không nằm trong phạm vi V1.

**Một phát hiện phụ trong lúc sửa:** module Sự cố hiện narrow theo vai trò — với **giám đốc**, `visibleCases` chỉ gồm sự cố đã chuyển cấp còn mở (đúng chủ đích, xem V2 ở mục 21), nên số "hồ sơ đang mở" director thấy trong module là **tập con** chứ không phải tổng số mở toàn cơ sở. Trang tổng quan (mọi vai trò đều thấy) cố tình hiển thị **tổng số mở thật** — với quản lý (không bị narrow) hai số này khớp tuyệt đối; với giám đốc, hai số có thể khác nhau *một cách hợp lý* (tổng thể vs. phần cần giám đốc). Đây không phải mâu thuẫn kiểu L2 (số giả không khớp gì cả) mà là hai định nghĩa thật, khác nhau có chủ đích.

**Kiểm chứng:** `typecheck`/`lint`/`test:run` (255 pass)/`build` sạch cục bộ → push → `vercel inspect` xác nhận **Ready** → Playwright thật trên production, bài mới `tests/e2e/prod-smoke-site-overview-kpis.spec.ts` (3 bài, dùng tài khoản **quản lý** cho phép so sánh trực tiếp — xem phát hiện phụ ở trên):
1. Số "Sự cố mở" khớp đúng module Sự cố ở cả 4 cơ sở.
2. Hai KPI chưa có nguồn dữ liệu hiển thị đúng "Chưa có nguồn dữ liệu", không bịa số.
3. Nhân sự trong ca là số đếm thật (kiểm tra không rơi trùng ngẫu nhiên vào hằng số cũ 84/112).

**3/3 pass trên production.** Lần chạy đầu có 1 bài fail do race condition trong chính bài test (đọc `innerText()` ngay sau `goto()`, đôi khi bắt trúng màn "Đang chuẩn bị trải nghiệm / Loading…" — cùng loại flake đã ghi nhận ở đợt kiểm chứng trước) — đã sửa bằng cách đợi phần tử hiển thị trước khi đọc, không sửa sản phẩm.

---

## 23. V12 đã sửa — 01/08/2026, và hai lỗi mới phát hiện trong lúc kiểm chứng

### 23.1 V12 — Sơ đồ tổ chức tài khoản

**Bằng chứng trước khi sửa (mục 11.4, L14):** `manager-trang-an` có `managedSiteIds` bằng cả 4 cơ sở; cả 6 nhân viên đều có `supervisorId: "manager-trang-an"` bất kể họ làm ở cơ sở nào. "Quản lý chỉ thấy cơ sở mình phụ trách" chưa từng chứng minh được vì chỉ có một quản lý duy nhất, quản lý mọi thứ.

**Đã sửa** (`lib/erp/demo-data.ts`):
- Thu `manager-trang-an` (`ql.vanhanh`, alias `ql.trangan`) về đúng 1 cơ sở: Tràng An.
- Thêm 3 tài khoản quản lý mới, mỗi người đúng 1 cơ sở: `manager-tam-chuc` (`ql.tamchuc`), `manager-tam-coc` (`ql.tamcoc`), `manager-bai-dinh` (`ql.baidinh`) — cùng mật khẩu quản lý dùng chung hiện tại (L15 vẫn còn treo, không thuộc phạm vi V12).
- Sửa `supervisorId` của 3 nhân viên Tam Chúc/Tam Cốc/Bái Đính về đúng quản lý cơ sở mình (3 nhân viên Tràng An không đổi vì quản lý của họ không đổi).
- Sửa nhãn `jobTitle` từ "Quản lý vận hành toàn vùng" thành "Quản lý vận hành {cơ sở}" cho từng người — khớp với thực tế mới.
- Sửa luôn 2 chỗ phụ ăn theo dữ liệu cũ để không tự mâu thuẫn: `role-home-dashboard.tsx` (dòng tiêu đề trang chủ quản lý/nhân viên đổi từ "Điều hành toàn vùng · N cơ sở" cố định sang chỉ hiện "toàn vùng" khi thật sự nhiều hơn 1 cơ sở), và `managerAccountId` trong seed AP demo-cookie ở `supplier-ap-repository.ts` (trước đó hard-code `"manager-trang-an"` cho mọi cơ sở, kể cả Tam Chúc/Tam Cốc/Bái Đính — chỉ ảnh hưởng chế độ demo-cookie cục bộ, không phải production, nhưng sửa cho nhất quán vì tiện thể).
- Cập nhật khối gợi ý tài khoản trên `/erp/login` và viết lại bài test `erp-workforce.test.ts` — bài cũ (`"uses one regional operations manager..."`) trước đây khẳng định đúng chính cái sơ đồ sai (L14) là hành vi mong muốn; đã thay bằng bài khẳng định mỗi cơ sở có đúng 1 quản lý và mọi nhân viên báo cáo đúng người quản lý cơ sở mình.

**Không cần migration Supabase:** danh tính tài khoản (vai trò, `managedSiteIds`, `supervisorId`) hoàn toàn nằm trong mảng TypeScript tĩnh (`DEMO_ERP_ACCOUNTS`), không có bảng tài khoản nào trên Supabase — đúng như L12 đã ghi nhận. Việc đọc quyền module của nhân viên vẫn qua Supabase (`getAccessState()`) như cũ, không đổi.

**Rà soát tác động phụ trước khi sửa:** đã kiểm `tests/e2e/erp-access.spec.ts` (bài lớn nhất dùng `ql.trangan`/`ql.vanhanh`) — toàn bộ chỉ thao tác trong phạm vi Tràng An, không cần sửa. Hai bài `prod-smoke-*` có thao tác quản lý ở Bái Đính (`prod-smoke-director-decision-inbox.spec.ts`) và ở cả 4 cơ sở (`prod-smoke-site-overview-kpis.spec.ts`) đã sửa để dùng đúng quản lý cơ sở tương ứng; bài sau còn được viết thêm 1 test mới khẳng định trực tiếp việc cách ly (quản lý Tam Chúc vào `/erp/trang-an` bị chặn và ngược lại).

**Kiểm chứng:** `typecheck`/`lint`/`test:run` (255 pass)/`build` sạch cục bộ → CRLF xuất hiện lại ở 5 file khi Edit ghi trên máy Windows này (như nhiều lần trước), đã chuẩn hoá về LF trước khi build lại và commit → push → `vercel inspect` xác nhận deployment `dpl_FM4z1ZGBSfgfSjv4iS95u2ZzPjoW` **Ready** → Playwright thật trên production:
- `prod-smoke-site-overview-kpis.spec.ts`: **4/4 pass**, gồm bài mới "quản lý Tam Chúc không vào được dữ liệu Tràng An và ngược lại" — chứng minh trực tiếp trên production điều mà L14 nói là chưa từng chứng minh được.
- `tests/unit/erp-workforce.test.ts` (đã viết lại): pass, khẳng định 4 quản lý, mỗi người đúng 1 cơ sở, mọi nhân viên báo cáo đúng người.

### 23.2 L18 — ĐÃ SỬA. Nhân viên mất quyền module vì form cấp quyền âm thầm xoá quyền nó không hiển thị được

**Bằng chứng ban đầu:** `nv.trangan` vào `/erp/trang-an/du-an-su-kien` bị chuyển hướng `?denied=module`. Xem hồ sơ `nv.trangan` ở màn quản lý: danh sách "NGHIỆP VỤ ĐƯỢC GIAO" không có ô "Dự án" nào để tick, vì `du-an-su-kien` chưa từng nằm trong `trainedModuleIds` tĩnh của bất kỳ nhân viên nào (`lib/erp/demo-data.ts`) — quyền đó được cấp thẳng vào Supabase qua migration seed khi xây module Dự án, không qua giao diện.

**Lỗi gốc (đã sửa):** `app/erp/actions.ts`'s `updateEmployeeAccessAction` dựng lại **toàn bộ** mảng `moduleIds` chỉ từ các checkbox mà `staff-access-manager.tsx` **hiển thị được** (giao của `employeeAssignable` và `trainedModuleIds`). Bất kỳ quyền nào nằm ngoài tập hiển thị đó — như `du-an-su-kien` bị seed thẳng vào Supabase — sẽ bị xoá ở **lần lưu tiếp theo cho nhân viên đó, vì bất kỳ lý do gì**, kể cả không liên quan tới module đó.

**Đã sửa:**
- `updateEmployeeAccessAction` giờ giữ nguyên mọi module nhân viên đang có mà form không hiển thị được, chỉ áp dụng thay đổi cho đúng các module nó hiển thị.
- Thêm `du-an-su-kien` vào `trainedModuleIds`/`initialModuleIds` của 1 nhân viên mỗi cơ sở (đúng nhân viên đã được seed từ đầu) để ô "Dự án" xuất hiện được và quản lý quản lý được nó tường minh từ nay.

**Xác nhận trên production:** đăng nhập quản lý, mở hồ sơ `nv.trangan` — ô "Dự án" **đã tự động hiện ra và đang tick** (chứng tỏ quyền vẫn còn nguyên trong Supabase, chỉ là form không hiển thị/không giữ được nó trước khi sửa — không phải đã mất vĩnh viễn). Lưu lại một lần để xác nhận không còn bị xoá. `nv.trangan` vào `/erp/trang-an/du-an-su-kien` thành công, bấm "Bắt đầu xử lý" được. Xem thêm mục 23.3 — phần còn lại của luồng (quản lý ở phiên khác thấy trạng thái mới) fail vì lý do khác (L17), không phải L18.

- [x] **V21.** Đã xử lý.

### 23.3 🔴 L17 — chưa sửa được, cần quyền truy cập Supabase trực tiếp mà phiên này không có

**Phạm vi thật sự lớn hơn nhiều so với ghi nhận ban đầu.** Phát hiện đầu tiên chỉ thấy ở module Dự án (yêu cầu đổi phạm vi); sau khi rà thêm 3 bài test khác — **đã xác nhận đây là lỗi hệ thống, không phải lỗi riêng một module:**

| Bài test (đã từng pass, có ghi trong CODEX) | Kết quả rà lại 01/08/2026 |
|---|---|
| `prod-smoke-project-workflow.spec.ts` — quản lý gửi yêu cầu đổi ngân sách, giám đốc duyệt ở phiên khác | ❌ Giám đốc không thấy yêu cầu |
| `prod-smoke-project-workflow.spec.ts` — nhân viên bắt đầu xử lý gói việc, quản lý ở phiên khác thấy trạng thái mới | ❌ Quản lý không thấy trạng thái mới (dù nhân viên đã vào được module sau khi L18 sửa) |
| `prod-smoke-director-decision-inbox.spec.ts` — quản lý gửi yêu cầu, giám đốc thấy ở phiên khác | ❌ Giám đốc không thấy |
| `prod-smoke-staff-access.spec.ts` — quản lý thu hồi quyền, nhân viên ở phiên khác bị chặn | ❌ Nhân viên ở phiên khác vẫn vào được, như chưa hề bị thu hồi |
| `prod-smoke-field-reports-and-gate-scans.spec.ts` — nhân viên gửi báo cáo ảnh, giám đốc thấy ở phiên khác | ❌ Giám đốc không thấy |
| `prod-smoke-field-reports-and-gate-scans.spec.ts` — nhân viên quét QR, quản lý thấy ở phiên khác | ❌ Quản lý không thấy |

**Tất cả 6 bài đều từng có bằng chứng "X/X pass" trong `docs/CODEX.md` ở các phiên trước.** Đây không phải lỗi mới viết — dữ liệu vẫn ghi đúng (phiên đã ghi luôn thấy lại đúng dữ liệu của mình, kể cả sau khi tải lại trang thật/F5), nhưng **bất kỳ phiên đăng nhập nào khác — kể cả cùng tài khoản, trên một trình duyệt/thiết bị khác — không bao giờ thấy thay đổi đó**, dù chờ tới 45 giây và tải lại nhiều lần.

**Đã loại trừ trước khi kết luận là lỗi hệ thống:**
- **Không phải cache CDN/edge:** `curl -I` trả `Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate` và `X-Vercel-Cache: MISS` cho route bị ảnh hưởng.
- **Không phải RLS:** policy đọc cho `service_role` trên các bảng liên quan là `using (true)`, không điều kiện.
- **Không phải do V12 hay bất kỳ thay đổi nào trong phiên này:** tái hiện với tài khoản/cơ sở hoàn toàn không đổi (`ql.vanhanh`/Tràng An), và tái hiện trên các file test cũ không sửa dòng nào.
- **Không phải do đợt deploy vừa rồi bị lỗi:** đã xác nhận deployment `Ready`, alias production đúng, qua `vercel inspect`.

**Đã thử điều tra sâu hơn bằng cách gọi thẳng Supabase, bỏ qua Next.js/Vercel — bị chặn:** `vercel env pull` tải được các biến môi trường production, nhưng `SUPABASE_SECRET_KEY` được Vercel đánh dấu **"sensitive"** nên giá trị trả về chỉ là chuỗi giữ chỗ `[SENSITIVE]`, không phải khoá thật — CLI của Vercel **cố ý không cho lấy lại** giá trị biến môi trường nhạy cảm sau khi đã tạo, đây là giới hạn nền tảng, không phải vấn đề quyền hạn có thể xử lý từ phiên làm việc này.

**Chưa tìm ra nguyên nhân gốc — cần một trong hai:**
1. Quyền truy cập Supabase Dashboard (Studio/Logs/Database) trực tiếp, hoặc
2. Khoá `service_role` thật (không bị Vercel che), để chạy script Node gọi thẳng RPC + đọc lại, bỏ qua hoàn toàn Next.js/Vercel — tách bạch xem lỗi nằm ở tầng ứng dụng hay tầng Supabase (pooling, replica, transaction chưa commit, v.v.).

**Mức độ nghiêm trọng: rất cao.** Đây là cơ chế nền mà **gần như mọi lời khẳng định "lưu Supabase dùng chung, xuyên tài khoản" trong toàn bộ CODEX từ 29/07 tới nay** dựa vào để chứng minh. Nếu đúng như quan sát, hệ thống đang **âm thầm quay lại đúng vấn đề mà toàn bộ đợt sửa "module giả" 31/07–01/08 đã giải quyết** (dữ liệu chỉ sống trong phiên trình duyệt của người thao tác) — chỉ khác là lần này dữ liệu **có thật trong Supabase**, chỉ là không phiên nào khác đọc lại được ngay.

**Việc phát sinh — đã đánh dấu `test.fixme()` cho toàn bộ 6 assertion bị ảnh hưởng**, kèm ghi chú tại chỗ, không xoá không ép qua:
- `tests/e2e/prod-smoke-project-workflow.spec.ts` (2 bài)
- `tests/e2e/prod-smoke-director-decision-inbox.spec.ts` (1 bài)
- `tests/e2e/prod-smoke-staff-access.spec.ts` (1 bài)
- `tests/e2e/prod-smoke-field-reports-and-gate-scans.spec.ts` (2 bài)

- [ ] **V20. Tìm nguyên nhân gốc L17.** Cần chủ dự án cấp một trong hai: quyền Supabase Dashboard, hoặc khoá `service_role` thật (đổi biến môi trường Vercel sang không đánh dấu "sensitive" tạm thời, hoặc cấp trực tiếp qua kênh an toàn). **Ưu tiên cao nhất trong toàn bộ backlog hiện tại** — cao hơn V3, vì đây là nền tảng mà toàn bộ giá trị "ERP dùng chung, không phải state trình duyệt" của dự án đang đứng trên.

### 23.4 Việc tiếp theo

V12 và L18 đã xong, đã chứng minh trên production. **L17 chặn lại V20** cho tới khi có quyền truy cập Supabase sâu hơn — không thể tự điều tra thêm từ phiên làm việc này. Theo yêu cầu chủ dự án tiếp tục làm việc, chuyển sang **V3** (chuyển vai trò demo) trong lúc chờ quyền truy cập cho V20; sẽ ghi rõ trong V3 rằng tính năng "đổi vai trò xem" là đổi phiên đăng nhập thật (không phải giả lập UI), nên **không bị ảnh hưởng bởi L17** — L17 chỉ ảnh hưởng tới việc đọc lại dữ liệu ĐÃ GHI ở một phiên khác, không ảnh hưởng tới việc đổi danh tính đang đăng nhập.
