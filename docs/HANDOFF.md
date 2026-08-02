# NINH BÌNH JOURNEY — BÀN GIAO

> **Đây là tài liệu duy nhất bắt buộc đọc trước khi làm việc.** Mọi tài liệu khác trong `docs/reference/` chỉ đọc khi bắt đầu đúng đầu việc cần tới nó; `docs/archive/` là lịch sử, không dùng để kết luận hiện trạng.
>
> Cập nhật: **02/08/2026** — sau đợt làm T1–T10, W3, buổi chốt thiết kế danh tính/hồ sơ/nhật ký, **và đợt đẩy toàn bộ lên production** (T0 xong, mục 0).
>
> Muốn hiểu **hệ thống này làm gì và theo nguyên tắc nào** (để nắm dự án, hoặc để đưa cho khách): đọc `docs/reference/SO_TAY_HE_THONG_VI.md`. File đang đọc chỉ nói **hiện trạng**.

---

## 0. ✅ T0 xong 02/08 — toàn bộ đợt T1–T14/T6b/T13 đã lên production, đã kiểm chứng thật

**8 migration (025→032) đã áp dụng lên Supabase production, code đã push + deploy, đã xác minh bằng Playwright chạy thật trên `https://ninhbinhjourney.vercel.app`.** Đây là lần đầu tiên toàn bộ đợt T1–T10/W3/T6b/T14/T13 chạy qua production — trước đó `origin/main` đứng yên ở commit từ trước T1 suốt cả đợt làm việc, nên **không có gì trong mục 2 dưới đây từng được kiểm chứng thật cho tới hôm nay.**

**Bốn lỗi thật bị bắt và vá ngay trong lần đẩy đầu tiên này — không phải lỗi migration hay lỗi thiết kế, mà là lỗi chỉ lộ ra khi chạy thật:**

1. **Migration 025 tự đâm vào trigger bảo vệ của chính hệ thống.** Bước sửa `manager_account_id` sai (do lỗi registry cũ) đụng `erp_ap_invoice_integrity` và `erp_ap_audit_immutable` — hai trigger coi các cột đó là bất biến. Vá bằng cách tắt đúng trigger cho đúng một câu lệnh sửa dữ liệu, bật lại ngay trong cùng transaction. *(commit `41e7516`)*
2. **Hai file `"use server"` khác cũng vi phạm quy tắc "chỉ export hàm async"** — `account-actions.ts` và `shift-handover-actions.ts` — làm **mọi POST từ mọi trang module** gãy với "found object", vì `ModuleWorkspace` import tất cả workspace con không điều kiện nên Turbopack gộp chung mọi file action vào một chunk. Bắt được nhờ `prod-smoke-ap.spec.ts` chạy thật (đăng xuất cũng gãy). *(commit `11564ee`)*
3. **Mật khẩu tạm không bao giờ ở lại đủ lâu để đọc được.** `GrantLoginForm` chuyển sang nhánh "đã cấp đăng nhập" ngay khi `revalidatePath` chạy xong — nuốt mất thông báo chứa mật khẩu trước khi giám đốc kịp sao chép. Bắt được nhờ spec T6b mới viết. *(commit `c625b7f`)*
4. **`prod-smoke-ap.spec.ts` tự nó có một khoảng trống:** form gửi hoá đơn nằm trong `<details>` đóng mặc định, spec chưa từng mở nó trước khi thao tác — vì đây cũng là lần đầu spec chạy thật. *(commit `e9f843b`)*

**Đã xác minh trực tiếp, không suy đoán:**

- ✅ Cả 4 quản lý có `erp_account_has_active_role(..., 'regional-manager', site)` = true, đúng cơ sở (SQL trực tiếp qua `supabase db query --linked`).
- ✅ `erp_employee_access` có khoá `(employee_account_id, site_id)`; `erp_tickets` có 8 dòng mẫu; `erp_account_registry` có đủ `email`/`must_change_password`/`phone`/`started_at`.
- ✅ `manager-trang-an` chỉ còn active ở Tràng An; hoá đơn NCC đã re-attribute đúng người quản lý từng cơ sở.
- ✅ `ERP_REGISTRY_SITE_SCOPE=true` đã đặt trên Vercel production (biến duy nhất còn thiếu trước đó).
- ✅ `erp_demo_rebase_timeline()` đã gọi — trả `ALREADY_CURRENT`, dữ liệu mẫu không cần dịch ngày.
- ✅ **`tests/e2e/prod-smoke-ap.spec.ts`: 16/16 pass trên production** — mọi vai trò, cả 4 quản lý qua được cửa phân quyền hoá đơn NCC (đúng lỗi mục 3 cũ, giờ đã hết).
- ✅ **`tests/e2e/prod-smoke-t6b-auth.spec.ts` (mới): pass** — tự tạo một tài khoản thử, cấp vai trò, cấp đăng nhập, đăng nhập bằng mật khẩu tạm, bị bắt đổi mật khẩu, đổi xong vào `/erp` bình thường, đăng nhập lại lần hai đi thẳng vào `/erp` (chứng minh `must_change_password` đã tắt thật). **Tự dọn dẹp** — tài khoản thử bị chuyển `suspended` ở cuối spec, đã xác minh lại bằng SQL.

**Chưa làm, có chủ đích:** `NEXT_PUBLIC_ERP_SHOW_DEMO_PASSWORDS` để trống (đúng — chỉ bật lúc trình diễn, tắt khi bàn giao). `NEXT_PUBLIC_LEGACY_OPS_ENABLED` để trống (đúng). `SUPABASE_SECRET_KEY` đã có sẵn từ trước, xác nhận vẫn hoạt động đúng vì `/erp/tai-khoan` gọi `client.auth.admin.createUser` thành công trong spec T6b.

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
- **33 migration, toàn bộ đã chạy trên production** (mục 0).
- Phân tách nhiệm vụ thật ở mọi luồng: kế toán lập ≠ người duyệt, quản lý không tự duyệt hồ sơ mình tạo, người bàn giao ca ≠ người nhận ca, người đề nghị chi ≠ người duyệt chi.
- Sự cố quá hạn SLA tự chuyển cấp mỗi phút bằng `pg_cron`.
- **389 bài test cục bộ**, `lint`/`typecheck`/`build` sạch; **25 lượt Playwright chạy thật trên production** (mục 0) đều xanh.

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

- ✅ **T6b bước 1 — đăng nhập Supabase Auth thật, đã xác minh trên production 02/08** (`tests/e2e/prod-smoke-t6b-auth.spec.ts`, xem mục 0). Trước đây: [`app/erp/actions.ts`](../app/erp/actions.ts) đăng nhập chỉ đọc mảng cứng `demo-data.ts`, còn `/erp/tai-khoan` ghi vào registry mà không nơi nào đọc lại để đăng nhập — tài khoản giám đốc tạo ra có tên, chức danh, vai trò đúng cơ sở, **và không đăng nhập được.** Nay đã vá:
  - `loginErpAction` nhận cả hai dạng: định danh có "@" đi qua `supabase.auth.signInWithPassword`, không có "@" vẫn đi qua đường mật khẩu chung cũ — **hai đường cùng tồn tại, không đường nào bị gỡ**, nên tài khoản demo cũ không hỏng khi việc này lên production.
  - `/erp/tai-khoan` có nút "Cấp đăng nhập": nhập email → `client.auth.admin.createUser` tạo `auth.users` thật (không migration nào làm được việc này, phải qua GoTrue admin API) → `erp_admin_link_auth_user` (migration 031) ghi cầu nối + bật `must_change_password`. Mật khẩu tạm hiện một lần trên màn hình, giám đốc tự chuyển cho người đó qua kênh khác — **dự án chưa có hạ tầng gửi email**, đây là quyết định phạm vi có chủ đích, không phải thiếu sót.
  - `getCurrentErpUser()` dựng phiên thẳng từ registry (`buildCurrentUserFromRegistry`) khi có phiên Supabase Auth — **không đọc `demo-data.ts`** — nên một tài khoản chỉ tồn tại trong registry (chưa từng có dòng nào trong `demo-data.ts`) giờ đăng nhập và thấy đúng site/module được cấp.
  - `/erp/doi-mat-khau` bắt đổi mật khẩu trước khi vào bất kỳ trang nào khác, khi `must_change_password = true`.
  - **Tìm thấy khi làm:** `user.managedSiteIds` (không phải `user.siteIds`) là thứ `workflow-actions.ts:313` kiểm khi duyệt chốt ca cho quản lý — trước đây nó giữ nguyên `demo-data.ts.managedSiteIds` gốc dù `siteIds` đã được T7 nới rộng qua registry, nên một quản lý được giám đốc cấp thêm cơ sở qua `/erp/tai-khoan` vẫn có thể bị từ chối duyệt ở cơ sở mới với thông báo "Hồ sơ nằm ngoài cơ sở bạn quản lý". Đã sửa cả hai đường dựng phiên (registry và demo-data) để `managedSiteIds` luôn bằng `siteIds`.
  - **Test:** `tests/security/erp-auth-bridge-migration-contract.test.ts` (migration 031), `tests/integration/erp-auth-actions.test.ts` (10 bài), `tests/e2e/prod-smoke-t6b-auth.spec.ts` (production thật — tạo tài khoản, cấp vai trò, cấp đăng nhập, đăng nhập bằng mật khẩu tạm, đổi mật khẩu, đăng nhập lại, tự dọn dẹp).
  - **Đã kiểm chứng trên production 02/08** — xem mục 0. Trong lúc kiểm, bắt được và vá luôn lỗi mật khẩu tạm biến mất (mục 0, phát hiện 3).
  - **Cố ý chưa làm:** **T6c (RLS thật)** — vẫn service role + tự kiểm bằng TypeScript. 143 policy chưa bảo vệ gì cho `/erp`. Việc lớn nhất, tách riêng theo đúng nguyên tắc "mỗi bước tự đứng được".

- ✅ **T14 bước 1 — hồ sơ nhân sự sửa được theo đúng cấp, đã xác minh migration 032 chạy trên production.** Đặc tả đầy đủ ở `SO_TAY_HE_THONG_VI.md` mục 6. Đã làm:
  - Migration `032`: `erp_account_registry` thêm `phone`, `started_at`; RPC `erp_manager_update_profile` — **không có tham số `status` hay `role` nào cả**, nên không có đường nào cho một quản lý tự nâng quyền qua RPC này dù tầng ứng dụng có lỡ sai; gọi được nếu là `system-admin` hoặc chia sẻ ít nhất một cơ sở với người được sửa (`erp_manager_shares_site_with_account`).
  - `/erp/ho-so/[accountId]` — 4 khối đúng như sổ tay (danh tính/công việc/quyền hạn/hoạt động), form sửa chỉ hiện khi được phép, nhân viên chỉ xem không sửa được. Vào được từ tên mình trên thanh điều hướng (`erp-shell.tsx`) hoặc nút "Xem hồ sơ" ở `/erp/tai-khoan`.
  - Khối "Hoạt động" đọc `erp_account_admin_audit` lọc theo `target_account_id` — **đây là bản xem trước một phần của T15**, chỉ có sự kiện quản trị tài khoản (tạo, sửa hồ sơ, cấp/thu hồi vai trò), chưa có thao tác nghiệp vụ (duyệt chi, xử lý sự cố...). Trang tự ghi rõ điều này, không nhận vơ là nhật ký đầy đủ.
  - **Test:** `tests/security/erp-staff-profile-migration-contract.test.ts` (migration 032), `tests/integration/erp-profile-actions.test.ts` (6 bài). `typecheck`/`lint`/`test:run` (392 bài)/`build` sạch cục bộ.
  - **Chưa kiểm chứng trên production** — migration 032 xếp hàng sau 031 ở mục 0.
  - **Cố ý chưa làm — T14 bước 2:** `staff-access-manager.tsx` và `role-switch-control.tsx` vẫn liệt kê nhân sự từ `DEMO_ERP_ACCOUNTS`, không từ registry. Một nhân viên chỉ tồn tại trong registry giờ **đăng nhập được** (T6b) và **có hồ sơ sửa được** (T14 bước 1) — nhưng chưa hiện ra trong hai màn hình đó để được cấp module hay xuất hiện khi giám đốc chọn người xem-thử. Đây là một việc sửa lại một màn hình đang hoạt động, tách riêng có chủ đích khỏi việc mở đường ghi dữ liệu mới ở bước 1.
- **Không có chế độ ngoại tuyến** ở bất kỳ đâu.

### 2.7 Dữ liệu còn nhét cứng trong mã nguồn — rà ngày 02/08

Yêu cầu của chủ dự án: **thêm một nhân viên, đổi một giá vé, xoá dữ liệu tập dượt — đều phải làm được bằng thao tác trên màn hình, không sửa code.** Phần lớn nghiệp vụ ERP đã đạt (sự cố, vé, quét cổng, bàn giao ca, dự án, công nợ, bút toán, chấm công, phân quyền — đều nằm trong Supabase, xoá được bằng migration hẹp). Còn đúng ba chỗ chưa đạt:

| Chỗ | Hệ quả | Vá bằng |
|---|---|---|
| `lib/erp/demo-data.ts` (315 dòng) — tên, chức danh, mật khẩu, quyền ban đầu của mọi tài khoản | Thêm một nhân viên thật = sửa code + deploy | **T6b bước 1 xong**, T14b còn dở |
| ~~`domain/erp-operating-data.ts`~~ — số tài chính và nhân sự cứng | ~~Xem hàng dưới~~ | **T13 xong — đã xoá cả file** |
| `content/destinations.ts` + `content/packages.ts` (564 dòng) | Đổi giá tour = sửa code | **W4** |

✅ **T13 xong 02/08.** [`components/erp/ticket-guest-workspace.tsx`](../components/erp/ticket-guest-workspace.tsx) từng hiện doanh thu tuần/tháng/năm = một số cứng nhân hằng số bịa, nhãn tháng cứng "Tháng 7". Đã thay bằng **số vé thật đếm từ `erp_tickets.issued_at`** (T8 đã tạo bảng này) qua hàm mới `getTicketSalesSummary()` trong `gate-scan-repository.ts`: 4 khung ngày/tuần/tháng/năm dạng cửa sổ trượt, so với đúng khung liền trước (`changePercent`, `null` khi khung trước bằng 0 — không chia cho không), cơ cấu sản phẩm và "vé phát hành gần nhất" cũng lấy thẳng từ bảng đó. **Không hiện số VNĐ** — `erp_tickets` không có cột giá, nên hiện đúng cái đo được (số vé), không bịa thêm một bảng giá để quy đổi ra tiền.

Cùng lúc xoá **`domain/erp-operating-data.ts`** (nguồn của số bịa) và hai file dùng nó — `executive-finance-overview.tsx`, `finance-dashboard.tsx` — xác nhận cả hai không màn hình nào import (code chết thật, không phải chỉ nghi ngờ). Gỡ luôn 4 bài test chỉ kiểm tra các số bịa đó tự nhất quán với nhau (`erp-finance-data.test.ts` xoá hẳn, 1 bài trong `erp-workforce.test.ts` gỡ riêng, 4 bài còn lại của file đó vẫn giữ vì kiểm `demo-data.ts` thật).

**Đây là bẫy số 4 ở mục 5 tái diễn lần hai** — đợt T3 soát 5 module *planned* nhưng bỏ sót số bịa trong module *live*; giờ soát lại đúng module đó lại lòi thêm.

🔴 **Phát hiện mới, nghiêm trọng hơn, chưa vá — module Camera AI.** Trong lúc rà theo cùng nguyên tắc, phát hiện `components/erp/camera-ai-workspace.tsx` toàn bộ số đếm người (`people`), độ tin cậy (`confidence`), trạng thái camera và cả hai "sự kiện AI" hiển thị ở "Sự kiện gần đây" đều là **số bịa cứng trong code** (tính từ `site.snapshot.visitors * hằng số`, hoặc chuỗi ký tự cố định). Khung hình đã tự nhận là mô phỏng ("Khung hình mô phỏng", nhãn "DEMO ·"), nhưng **số đếm người và độ tin cậy thì không** — hiện ra giống hệt một chỉ số AI đo thật.

**Chỗ nguy hiểm nhất không phải là hiển thị:** nút "Báo quản lý"/"Tạo phiếu hiện trường" gọi `reportIncidentFromCameraAction` với `peopleCount: feed.people` (số bịa) — **tức là số bịa này được ghi thành một sự cố thật, vĩnh viễn, trong nhật ký sự cố.** Đây không còn là một con số hiển thị sai, mà là dữ liệu giả lọt vào hồ sơ nghiệp vụ thật.

✅ **Đã chặn tạm ngày 02/08, theo quyết định chủ dự án.** `components/erp/camera-ai-workspace.tsx`: đã gỡ hẳn nút "Báo quản lý"/"Tạo phiếu hiện trường" và lời gọi `reportIncidentFromCameraAction` khỏi màn hình — khối "Phân tích hiện trường" giờ chỉ còn một thông báo giải thích vì sao số đếm người/độ tin cậy đang tạm khoá, và trỏ người dùng sang **Báo cáo hiện trường**/**Sự cố & điều phối** (hai đường báo sự cố thật, không đổi) nếu thấy bất thường qua hình ảnh. Số đếm người vẫn hiện trên thẻ camera và khối thống kê tổng — **chỉ chặn đường nó biến thành sự cố thật**, chưa dọn hiển thị, vì đó là phần cần quyết định hướng dài hạn ở dưới. `reportIncidentFromCameraAction` (action) và bài test của nó **giữ nguyên, không xoá** — đây là năng lực thật, chỉ tạm không có nơi gọi tới cho đến khi T17 xong.

**Sửa đúng cách cho phần còn lại chưa làm trong đợt này** — có chủ đích, không phải bỏ sót: cần quyết định sản phẩm (dựng tích hợp camera thật, hay đổi luồng thành nhân viên tự quan sát camera rồi tự nhập số — hai hướng khác hẳn nhau), không phải một chỗ chỉ cần đổi nguồn dữ liệu như các chỗ khác. `erp_camera_sources`/`erp_camera_events` là hai trong số ~20 bảng chết của `/ops` (mục mô tả T12) — tức là **một mô hình dữ liệu camera thật từng được thiết kế, rồi bỏ dở**, đúng dạng "cuộc chuyển kiến trúc bỏ dở" ở bẫy #3 mục 5.

✅ **Đã dựng lại thành kịch bản mô phỏng khai báo rõ, ngày 02/08 — theo quyết định chủ dự án ("script cũng được, làm quái gì đã có camera AI đâu mà API vào").** Hướng chọn là hướng thứ ba, rẻ và trung thực hơn cả hai hướng nêu trên: **không giả vờ có AI, nhưng cũng không để màn hình trống**.

- `domain/erp-camera-ai.ts` (mới) giữ toàn bộ logic, thuần tính toán, **không đọc/không ghi cơ sở dữ liệu**. Không có đường nào từ file này chạm tới sự cố, chấm công hay sổ sách.
- Số người hết bịa theo nghĩa "hằng số nhân bừa": mỗi khu vực có **sức chứa thiết kế khai báo** (`designCapacity`), số hiển thị luôn là `designCapacity × hệ số tải`. Tự giải thích được, không bao giờ vượt sức chứa, và cùng loại số với ngưỡng T11 — vẫn là ước lượng cần khách xác nhận trước go-live.
- **Tất định theo khung 5 phút**, gieo hạt bằng `${siteId}:${bucket}`: F5 không nhảy số, hai máy đặt cạnh nhau không mâu thuẫn nhau. Bản cũ sinh số mới mỗi lần render — nhìn là biết giả.
- **Chống tràn ở tầng dữ liệu, không phải tầng giao diện:** `buildCameraEventScript` trả `[]` cho mọi vai trò trừ giám đốc, và không nhánh nào trả quá `CAMERA_SCRIPT_MAX_EVENTS = 2`. Sự kiện hiện dần (12 giây và 45 giây sau khi mở màn hình) rồi dừng hẳn — không có lịch lặp lại nào.
- Màn hình tự nhận mình là mô phỏng ở ngay dải trên cùng, thẻ "Độ trễ hình ảnh" bỏ con số "1,4 giây" bịa và ghi "—".
- **Nút tạo sự cố từ camera vẫn tắt** và sẽ tắt cho tới khi có nguồn đếm người thật. Số mô phỏng, dù đã đẹp hơn, vẫn không được phép trở thành hồ sơ nghiệp vụ.

Đã xác minh: `tests/unit/erp-camera-ai.test.ts` (10 bài — tính tất định, trần 2 sự kiện quét qua 500 khung × 4 cơ sở, chặn theo vai trò, số luôn nằm trong sức chứa) và `tests/e2e/erp-camera-ai-simulation.spec.ts` (4 bài × 2 khổ màn hình: nhãn mô phỏng hiện ra, số không đổi sau khi F5, quản lý không thấy kịch bản còn giám đốc thấy đúng 1 sự kiện sau ~12 giây, không còn nút tạo sự cố). **Đã xác minh trên production thật** (`https://ninhbinhjourney.vercel.app`, deploy `oisk3b6mu`): 14/14 lượt xanh gồm cả spec trợ lý, cả hai khổ màn hình. Cả hai spec chỉ đọc — không gọi hành động ghi nào, nên không để lại gì.

### 2.7a Bộ Playwright cục bộ đã đỏ suốt từ T13 — đã dựng lại

Phát hiện khi làm T14b: chạy `npx playwright test` trên máy thì **12 bài đỏ**, và đỏ từ trước đợt này. Nguy hiểm hơn con số: một bộ test đỏ thường trực không chặn được hồi quy nào — nó suýt che mất đúng một lỗi thật do T14b gây ra (mất tên đăng nhập trên thẻ nhân sự), chỉ lộ ra vì tôi so bộ đỏ trước/sau thay vì nhìn số bài xanh.

Nguyên nhân, không cái nào là lỗi sản phẩm:

- **8 bài** khẳng định những thứ T13/T17 đã **cố ý xoá** — số bịa ở trang chủ giám đốc (`11.450 khách · 1,84 tỷ`), màn hình "Tài chính hợp nhất" (`38,6 tỷ`/`13,6 tỷ`), nút tạo sự cố từ camera, chuỗi `+15,3% so với bình quân năm 2023–2025`. Đã đổi thành **khẳng định ngược**: các số đó phải *không* quay lại.
- **1 bài** khẳng định gõ mã `QR-TEST-2026-001` là "Đã ghi nhận" — tức là khẳng định **đúng cái lỗi T8 đã vá**. Để nguyên còn nguy hiểm hơn đỏ: ai đó "sửa cho xanh" là mất luôn tính chất bảo mật. Đã đảo thành hàng rào cho T8.
- **1 bài** giả định hoá đơn `AP-TA-202607-024` đã ở trạng thái "Sẵn sàng hạch toán" — vi phạm đúng điều AGENTS.md cấm: *giả định trạng thái mình không tự tạo ra*. Giờ spec tự đưa hồ sơ tới trạng thái đó bằng luồng của sản phẩm.
- **2 bài** dùng `.first()` trên toàn trang, bắt trúng link ẩn trong portal menu di động. Đã khoanh vào `main`.
- **3 bài** `/plan` đỏ vì **`playwright.config.ts` đặt `NEXT_PUBLIC_*` ở `webServer.env`** — mà Next nhúng các biến đó **lúc build**, không đọc lúc chạy. Bản build thiếu chúng thì `/plan` trả màn hình "thiếu cấu hình". Đã sửa `webServer.command` thành `npm run build && npm run start`.
- **1 spec production đã chết:** `prod-smoke-camera-ai-incident.spec.ts` bấm đúng nút T17 gỡ đi, không bao giờ chạy được nữa. **Đã xoá.** Tính chất nó canh giữ (số camera không được biến thành sự cố thật) giờ do `erp-camera-ai-simulation.spec.ts` canh, và spec đó **đã chạy trên production**. RPC `erp_incident_report_from_camera` cùng bài kiểm tra hợp đồng của nó **giữ nguyên** cho T17b.

Kết quả: **42 xanh / 8 skip / 0 đỏ** từ một bản build sạch. Lưu ý cho phiên sau: `npx playwright test` **không kèm đường dẫn** sẽ nuốt luôn các spec `prod-smoke-*` và chúng đỏ hàng loạt vì đang trỏ vào máy cục bộ — chỉ định spec, hoặc đặt `PLAYWRIGHT_BASE_URL`.

### 2.7b Trợ lý điều hành bằng giọng nói

Nút tròn góc dưới phải mọi màn hình ERP (`components/erp/voice-command-center.tsx`). Nhận giọng nói bằng **Web Speech API của trình duyệt** (`vi-VN`) — không gọi dịch vụ AI ngoài nào, không gửi âm thanh đi đâu, nên không có chi phí và không có vấn đề dữ liệu rời hệ thống.

Đã nâng ngày 02/08 theo yêu cầu chủ dự án ("làm giống bọn Zalo gửi voice, tự chuyển ra text, nghe được keyword rồi mở thư mục giùm giám đốc"):

- **Chữ hiện dần khi đang nói** (`interimResults = true`) kèm sóng âm và đồng hồ đếm — trước đó im lặng rồi nhảy ra cả câu, người dùng không biết máy có nghe không.
- **Luồng hội thoại giữ lại lịch sử** (bong bóng "Tin nhắn thoại · 0:03" cho câu nói, bong bóng xanh cho phản hồi), lưu trong `sessionStorage`, còn nguyên sau khi chuyển trang. Trước đó chỉ hiện đúng kết quả cuối rồi mất.
- Mở màn hình xong vẫn ghi lại một dòng "Đã mở …" nên mở lại trợ lý là biết mình vừa làm gì.

Phần nhận từ khoá → điều hướng (`resolveErpNavigationCommand`, 15 module × 4 cơ sở) **đã có từ trước và không đổi**; `tests/unit/erp-voice-command.test.ts` giữ nguyên. Điều quan trọng cần nói thẳng: **đây là so khớp từ khoá, không phải mô hình ngôn ngữ** — nói ngoài bộ từ đã khai báo thì trợ lý trả lời "chưa tìm thấy màn hình phù hợp" chứ không đoán. Các câu hỏi số liệu đi qua `app/api/erp/assistant/route.ts`, đọc dữ liệu thật trong phạm vi tài khoản và **từ chối trả lời khi thiếu một vế** thay vì dựng số.

Chưa kiểm thử tự động được phần micro: Chromium headless không có đường ra dịch vụ nhận dạng. `tests/e2e/erp-assistant-thread.spec.ts` (3 bài × 2 khổ màn hình, đã chạy trên production thật) kiểm phần còn lại — cùng một hàm `execute` mà giọng nói gọi vào.

`domain/erp.ts` giữ 4 cơ sở + danh sách module trong code — **không tính là lỗi**, đó là cấu hình phần mềm, cố ý không cho sửa từ giao diện. Riêng `ErpSite.snapshot` (visitors/checkedIn/employeesOnShift/openIncidents/capacityPercent) trong cùng file **giờ không còn nơi nào đọc** sau khi sửa T13 — an toàn vì không hiển thị sai ở đâu nữa, nhưng nên xoá khỏi type trong một đợt dọn sau, gộp cùng lúc xử lý Camera AI.

### 2.5 Dòng tiền: một đầu đã đóng, một đầu còn hở

- ✅ **Công nợ NCC**: ghi nhận nợ → đề nghị chi → duyệt chi → **đã trả** (T10).
- ❌ **Tiền mặt sau chốt ca**: vẫn dừng ở `posted`. Chưa có nộp quỹ → ngân hàng → đối chiếu sao kê.

### 2.6 Web công khai

- Không bán được hàng, bị chặn ở tầng cấu hình (`config/experience.ts` cấm production bật sandbox checkout, và không có cổng thanh toán thật).
- **Luồng QR khách du lịch (`/pass/[token]`) vẫn chưa dựng lại.** T8 đã tạo nền (`erp_tickets`); W1 là việc nối luồng khách vào đó.

---

## 3. ✅ Lỗi nghiêm trọng cũ — đã vá và xác minh xong trên production 02/08

**3/4 quản lý cơ sở từng không dùng được module Đối tác & NCC trên production.** Đã hết — xem mục 0.

RPC `erp_ap_submit_supplier_invoice` chặn bằng `erp_account_has_active_role(...)`, tra `erp_account_registry`. V12 (01/08) tách một quản lý vùng thành bốn quản lý cơ sở trong mã nguồn nhưng không cập nhật registry.

| Tài khoản | Gửi được hoá đơn NCC? (trước vá) | Sau vá, xác minh trên production |
|---|---|---|
| `manager-trang-an` | ✅ true | ✅ true |
| `manager-tam-chuc` / `manager-tam-coc` / `manager-bai-dinh` | ❌ false | ✅ **true** |

Vá bằng migration `025` (thêm 3 quản lý, thu hẹp `manager-trang-an` về Tràng An, sửa hoá đơn gắn sai tên, sửa dòng nhật ký seed). `tests/e2e/prod-smoke-ap.spec.ts` chạy cả 4 quản lý, **16/16 pass trên production thật** 02/08.

---

## 4. HÀNG VIỆC CÒN LẠI

**T0, T6b bước 1, T14 bước 1, T13 đã xong và đã xác minh trên production — xem mục 0.** Hàng dưới đây là phần chưa làm.

| # | ID | Việc | Ghi chú |
|---|---|---|---|
| — | **T14b** | ✅ **Danh bạ nhân sự đọc từ registry** | `lib/erp/staff-directory.ts` là nguồn duy nhất cho cả hai màn hình. **Phần khó không nằm ở danh sách:** `startRoleSwitch`/`endRoleSwitch` và nhánh cookie của `getCurrentErpUser` đều tra qua `findDemoErpAccountById`, nên chỉ đổi danh sách thì tên hiện ra mà bấm "Xem thử" vẫn báo "Không tìm thấy tài khoản" — đã thêm `resolveSwitchIdentity` tra ở cả hai kho. Registry **không giữ hồ sơ đào tạo**: tài khoản còn hồ sơ mẫu giữ nguyên giới hạn `trainedModuleIds`, tài khoản mới được mọi module `employeeAssignable` và màn hình nói thẳng là chưa có hồ sơ đào tạo. 8 unit test + `prod-smoke-t14b-directory.spec.ts` (tự dọn dẹp) + 3 spec hồi quy — **8/8 xanh trên production**, đã xác minh bằng SQL rằng cả 8 tài khoản thử đều `suspended` |
| 2 | **T15** | **Nhật ký tập trung: ai làm gì, theo tên và khu vực** | Đã có một bản xem trước một phần ở `/erp/ho-so` (chỉ sự kiện quản trị tài khoản, xem mục 2.4). Còn thiếu: gộp cả nhật ký nghiệp vụ (duyệt chi, xử lý sự cố...) đang nằm rải rác — vài bảng đã snapshot `actor_display_name`, vài bảng chỉ có `actor_account_id`. Chưa có màn hình xem tập trung toàn hệ thống. Yêu cầu đầy đủ ở `SO_TAY_HE_THONG_VI.md` mục 5. **Hai bẫy: (a)** phải lưu **cả** ảnh chụp tên/chức danh/khu vực **lẫn** mã tài khoản — chỉ lưu tên thì hai anh Long lẫn nhau, chỉ lưu mã thì đổi cơ sở là viết lại lịch sử; **(b)** phạm vi nhìn phải chặn ở máy chủ, lọc ở giao diện chỉ là giấu |
| — | **T17** | ✅ **Camera AI: kịch bản mô phỏng khai báo rõ** | Mục 2.7. Chủ dự án chọn hướng "script, không cắm API vì chưa có camera AI". Đã dựng `domain/erp-camera-ai.ts` (thuần tính toán, không chạm cơ sở dữ liệu), số = sức chứa thiết kế × hệ số tải, tất định theo khung 5 phút, kịch bản chỉ chạy cho giám đốc và **trần cứng 2 sự kiện**. 10 unit test + 4 e2e × 2 khổ màn hình, chạy cục bộ. **Nút tạo sự cố vẫn tắt.** Việc còn lại — nguồn đếm người thật (tích hợp camera hoặc nhân viên tự nhập) — tách thành **T17b**, chưa xếp hàng vì chưa cần cho vận hành |
| 4 | **T10b** | **Đóng nốt đầu tiền mặt:** nộp quỹ → ngân hàng → đối chiếu sao kê sau chốt ca | Chủ dự án đã quyết **làm cả hai nguồn**: `statement_source` = `manual` \| `bank-api`, cùng một bộ đối khớp. **Nhập tay làm trước và làm trọn** (kể cả khi có API vẫn phải có đường nhập tay: API rớt, giao dịch về chậm, khoản nộp quầy không khớp dạng sao kê). Nửa API chỉ viết adapter — **không được tuyên bố chạy được cho tới khi cắm credential thật**. Còn chờ khách cho biết ngân hàng nào |
| 5 | **T11** | **Sức chứa có ngưỡng thật + SOP Go/No-Go** | Chủ dự án đồng ý cho **tự tính ước lượng trước** vì chưa có số. Bắt buộc: tính bằng mô hình vật lý *(số phương tiện × chỗ/phương tiện ÷ thời gian vòng)*, **hiện phép tính ra màn hình**, và mỗi ngưỡng mang nhãn nguồn `ước-lượng` / `khách-cung-cấp` / `đo-thực-tế`. Đặt ngưỡng **theo giờ tại điểm nghẽn** (bến đò, cửa soát vé, bãi xe điện), không theo tổng ngày — chỗ vỡ trận là 9–10h sáng chứ không phải tổng khách. T8 chạy vài tuần là thay được bằng số đo thật |
| 6 | **T6c** | **RLS thật thay cho service role + TypeScript** | Việc lớn nhất, dễ bỏ dở nhất, tách khỏi T6b có chủ đích. Viết lại 143 policy theo `erp_account_role_assignments`. Chỉ bắt đầu khi đủ thời gian đi hết |
| 7 | **T12** | **Dọn ~20 bảng chết của `/ops`** | **Hoãn có lý do:** phải sau khi T6/T7 chạy thật trên production — **điều kiện này đã đạt (mục 0), làm được rồi** |
| 8 | **T16** | **Migration xoá dữ liệu mồi để nhập dữ liệu thật** | **Làm cuối cùng**, khi không còn gì nhét cứng (T14b + W4 xong — `demo-data.ts` chỉ hết vai trò hoàn toàn khi T14b dứt điểm luôn hai màn hình liệt kê còn lại). Xoá theo điều kiện hẹp (`id like 'INC-%'`, `metadata->>'seed' = 'true'`), **không truncate, không xoá theo khoảng thời gian**. Giữ nguyên cấu hình. Xem `SO_TAY_HE_THONG_VI.md` mục 7 |
| — | **W1** | Dựng lại luồng QR pass **trên `erp_tickets`** (T8 đã tạo nền) | |
| — | **W2** | Quyết định mô hình thanh toán thật | Quyết định kinh doanh |
| — | **W4** | Đưa nội dung ra khỏi mã nguồn | Chặn T16 |

---

## 5. Mười hai cái bẫy đã sập ít nhất một lần — đừng lặp lại

1. **Test xanh vẫn giấu được lỗi.** Bài AP chỉ chạy một tài khoản nên không thấy 3/4 quản lý hỏng. **Bài kiểm chứng phân quyền phải chạy với mọi vai trò/cơ sở tương đương, không chỉ một đại diện.**
2. **`RLS 100%` không có nghĩa ERP đang được cơ sở dữ liệu bảo vệ.** Xem mục 2.4.
3. **Cuộc chuyển kiến trúc bỏ dở để lại 20 bảng chết.** Mọi việc lớn phải chia sao cho **dừng ở bất kỳ bước nào hệ thống vẫn chạy được**. Đó là lý do `ERP_REGISTRY_SITE_SCOPE` là một cờ riêng chứ không bật thẳng.
4. **Số liệu bịa trong một module thật sẽ phá hỏng cả những module đúng.** Nếu chưa có nguồn dữ liệu, màn hình phải nói thẳng là chưa có — đừng vẽ số cho đẹp. **Đã tái diễn:** đợt T3 soát 5 module *planned* nhưng bỏ sót số bịa nằm trong một module *live* (mục 2.7). Lần soát sau phải quét cả module đang chạy.
5. **Xây được nửa dưới rồi dừng thì nửa dưới đó không tồn tại với người dùng.** T6/T7 dựng xong sổ tài khoản và màn hình quản trị, nhưng cửa đăng nhập vẫn đọc mảng cứng — nên tài khoản giám đốc tạo ra **không đăng nhập được**, và cả module thành trang trí. Một tính năng chỉ tính là có khi **đi hết từ giao diện xuống dữ liệu và quay lại**. Đây chính là lý do T6b được làm ngay sau T0, không phải để cuối.
6. **Hai nguồn sự thật về cùng một thứ thì cả hai đều sai.** `demo-data.ts` và `erp_account_registry` cùng khai "ai là ai" — chính chỗ này đẻ ra lỗi AP ở mục 3. Mỗi khái niệm chỉ được có một nguồn. **Cùng dạng bẫy này còn ẩn ở `user.managedSiteIds` vs `user.siteIds`** trong `demo-session.ts` — hai trường tưởng cùng một nghĩa nhưng một trường bị bỏ quên không cập nhật theo registry; đã vá khi làm T6b (mục 2.4), nhưng bất kỳ trường "gần giống" nào khác giữa hai đường dựng phiên (demo-data / registry) đều đáng nghi ngờ tương tự.
7. **Một file `"use server"` chỉ được export hàm async.** Thêm một `export const` (dù chỉ là giá trị khởi tạo cho `useActionState`) vào `app/erp/actions.ts` làm `next build` gãy ở một trang không liên quan (`/erp/finance`) với thông báo "found object" — vì file đó được import xuyên suốt qua `erp-shell.tsx` vào mọi trang. Kiểu state/giá trị khởi tạo cho một action phải khai báo ở phía component gọi nó (`"use client"`), không khai báo cùng file với action.
8. **`vi.mock` phải theo kịp mọi import mới của file đang test, kể cả import gián tiếp.** Thêm một import tĩnh mới vào `app/erp/actions.ts` (dù chỉ dùng ở một hàm) làm ba bài test tích hợp không liên quan gãy ngay, vì `import "server-only"` ở đầu module thật bị load thay vì bị mock. Thêm tính năng vào một file hành động dùng chung phải rà lại **mọi** bài test đang mock file đó.
9. **Số bịa nguy hiểm nhất không phải lúc nó hiển thị sai — mà lúc nó được một nút bấm ghi thành dữ liệu nghiệp vụ thật.** Soát T13 chỉ định tìm số bịa *hiển thị*, nhưng lòi ra Camera AI: `feed.people` (số bịa) được gửi thẳng vào `reportIncidentFromCameraAction`, tạo một **sự cố thật** mang số liệu giả. Từ nay, mỗi lần thấy một con số tính từ dữ liệu bịa, phải lần theo xem nó có bị một hành động (nút bấm, submit, RPC) đóng dấu thành sự thật hay không — không dừng lại ở "màn hình hiện sai".
10. **Một migration data-only vẫn có thể tự đâm vào trigger của chính hệ thống.** Migration 025 sửa `manager_account_id`/`erp_ap_audit_events` — hai cột hai trigger từ migration 007 coi là bất biến/chỉ-thêm. Không phát hiện được cục bộ vì bài test hợp đồng chỉ đọc chuỗi SQL, không chạy nó. **Khi một migration data-only sửa dữ liệu ở một bảng nghiệp vụ đã có, phải tự hỏi bảng đó có trigger bảo vệ gì không, trước khi đẩy** — `pg_trigger`/đọc migration tạo bảng đó là đủ, không cần đợi lỗi thật trên production mới biết.
11. **Lỗi "use server chỉ export hàm async" có thể trốn khỏi `next build` cục bộ, nhưng vẫn nổ khi chạy thật.** Bẫy #7 đã ghi việc này một lần (`app/erp/actions.ts`), nhưng `account-actions.ts` và `shift-handover-actions.ts` mắc y hệt lỗi đó và `next build` cục bộ **không bắt được** — vì `ModuleWorkspace` gộp mọi file `"use server"` của mọi module vào một chunk chung, và việc kiểm export xấu chỉ nổ lúc một action trong chunk đó thật sự bị gọi (một POST), không phải lúc dựng trang tĩnh. **Sau lần đầu gặp lỗi này, phải grep toàn bộ file `"use server"` trong repo tìm export không phải `type`/`async function` — không dừng lại ở file vừa sửa.**
12. **State phía client có thể "biến mất" ngay sau khi hành động vừa thành công, nếu component đổi nhánh hiển thị theo dữ liệu server vừa làm mới.** `GrantLoginForm` chuyển sang nhánh "đã cấp đăng nhập" ngay khi `revalidatePath` chạy xong, nuốt mất thông báo chứa mật khẩu tạm (`useActionState`'s `state`) vì nhánh mới không render nó. Bất kỳ UI nào vừa **ghi xong một thứ chỉ hiện một lần** (mật khẩu tạm, mã OTP, link tải một lần...) đều phải kiểm `state.status === "success"` **trước** khi quyết định đổi nhánh theo props mới từ server.

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
