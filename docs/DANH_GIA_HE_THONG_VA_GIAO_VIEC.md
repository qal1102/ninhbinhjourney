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

- [ ] **V12. Sửa sơ đồ tổ chức tài khoản** — thêm 3 quản lý cơ sở (Tam Chúc, Tam Cốc, Bái Đính), mỗi người `managedSiteIds` đúng 1 cơ sở; sửa `supervisorId` của 6 nhân viên về đúng quản lý cơ sở mình; thống nhất nhãn vai trò. Xử lý L14. *(Nhỏ — sửa dữ liệu, không sửa kiến trúc. Làm cùng V3 thì bộ chuyển vai trò demo được ngay giá trị lớn nhất: chứng minh cách ly theo cơ sở.)*
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
