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

- [ ] **V1. Bỏ số tĩnh ở trang tổng quan cơ sở** — thay 5 thẻ KPI bằng số đếm thật từ Supabase (sự cố mở, nhân sự trong ca theo chấm công, lượt qua cổng theo `erp_gate_scan_events`). Chỗ nào chưa có nguồn thật thì **nói thẳng "chưa có nguồn dữ liệu"** thay vì bịa số. Xử lý L1 + L2. *(Ước tính: nhỏ — chủ yếu là truy vấn đếm.)*
- [ ] **V2. Gom việc chờ giám đốc duyệt vào một chỗ** — thêm sự cố chuyển cấp và yêu cầu đổi phạm vi dự án vào `directorDecisionCount`, kèm link đi thẳng tới hồ sơ. Xử lý L3. *(Nhỏ.)*
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
