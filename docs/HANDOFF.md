# NINH BÌNH JOURNEY — BÀN GIAO

> **Đây là tài liệu duy nhất bắt buộc đọc trước khi làm việc.** Mọi tài liệu khác trong `docs/reference/` chỉ đọc khi bắt đầu đúng đầu việc cần tới nó; `docs/archive/` là lịch sử, không dùng để kết luận hiện trạng.
>
> Cập nhật: **18/08/2026** — CUS-02 đã hoàn tất collector first-party và qua browser gate desktop/mobile + full local gate. Cả collector lẫn ingestion vẫn mặc định off; production chưa thu event khách.
>
> Muốn hiểu **hệ thống này làm gì và theo nguyên tắc nào** (để nắm dự án, hoặc để đưa cho khách): đọc `docs/reference/SO_TAY_HE_THONG_VI.md`. File đang đọc chỉ nói **hiện trạng**.

---

## 0. ✅ T0 xong 02/08 — toàn bộ đợt T1–T14/T6b/T13 đã lên production, đã kiểm chứng thật

> **Trạng thái public web mới nhất 07/08:** W5 sửa sai địa danh trong 3 cinematic panel, dựng lại thẻ tuyến theo từng chặng và thay tương tác “Mười nơi nữa” **đã commit/push/deploy production**. Commit app `31419a4`, deployment app `dpl_HU8nyRaynxFPgV7tRJy8kuMKrvgx` (`Ready`) đã nhận alias `https://ninhbinhjourney.vercel.app`; smoke production ghi ở mục 2.6. Commit tài liệu sau đó có thể tạo thêm một deployment không đổi app.

> **Trạng thái ERP mới nhất 07/08:** T11b ở commit `58e8802`, đã push `main` và deploy production `dpl_EDmSydtVcUTkBEJFEPf6gXFqtJ6A` (`READY`, alias `https://ninhbinhjourney.vercel.app`). Migration `202608070038_erp_sop_go_no_go.sql` khớp local/remote. 20/20 checklist seed đều mang nhãn `demo-unapproved`, đúng 5 mục/cơ sở; 4 quản lý đều có quyền SOP; 4 bảng bật RLS; 2 RPC là `security definer`. Round-trip trong transaction xác minh submit → chặn GO khi lỗi trọng yếu → chấp nhận rủi ro có văn bản, sau đó `ROLLBACK`. Smoke production chỉ-đọc **4/4 pass** trên mobile + desktop cho quản lý/giám đốc; xem ảnh production cũng không thấy tràn ngang hay vỡ phân cấp. Query cuối vẫn **0 assessment / 0 result / 0 audit**, không để lại dữ liệu thử.

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

> ⚠️ **Đã bị điều chỉnh từ 17/08/2026.** Phiếu giao việc số 01 (`docs/reference/PHIEU_GIAO_VIEC_01_GOI_A.md`) đảo ưu tiên: **lớp khách hàng Gói A đi trước**, với hai điều kiện cứng — không phá vỡ bất kỳ chức năng ERP nào đang chạy, và tái sử dụng tối đa phần lõi đã có (T8, T11a) thay vì xây nguồn dữ liệu thứ hai. Thứ tự ưu tiên gốc ở trên (và câu tương ứng ở `AGENTS.md`) **giữ lại làm lịch sử, không còn là luật hiện hành.** Buổi demo ERP đã diễn ra và chủ đầu tư đã dùng thử cả ERP lẫn web — mối quan tâm họ nêu là **năng lực thu và dùng dữ liệu khách du lịch**, xem `docs/plans/GOI_A_KE_HOACH.md` mục 4.

> ✅ **Chốt tiếp ngày 18/08/2026:** chủ dự án duyệt hướng data-first: đo section/dwell/scroll/click, gom nguồn marketing, dựng Customer 360 và recommendation để bán dịch vụ. Thứ tự hiện hành là CUS-01 → CUS-08 trong kế hoạch Gói A; CUS-00 đã đóng. Chỉ dùng dữ liệu giả lập cho tới khi pháp nhân dữ liệu và consent được duyệt.

---

## 2. Hiện trạng — đã đổi những gì trong đợt vừa rồi

### 2.1 Nền tảng

- Postgres/Supabase, RLS bật trên 100% bảng, RPC nghiệp vụ chỉ `service_role` gọi được, mỗi migration có một bài kiểm tra hợp đồng riêng.
- **38 migration, toàn bộ đã chạy trên production** (mục 0). Ngày 07/08 đã đối chiếu `supabase migration list --linked`: local/remote khớp đến `202608070038`.
- Phân tách nhiệm vụ thật ở mọi luồng: kế toán lập ≠ người duyệt, quản lý không tự duyệt hồ sơ mình tạo, người bàn giao ca ≠ người nhận ca, người đề nghị chi ≠ người duyệt chi.
- Sự cố quá hạn SLA tự chuyển cấp mỗi phút bằng `pg_cron`.
- **491 bài test cục bộ pass, 1 bài được đánh dấu skip có chủ đích**, `lint`/`typecheck`/`build` sạch ở cổng T11b; smoke production T11b **4/4 pass** trên hai viewport.

### 2.2 Module: 12 thật / 3 nói thẳng là chưa làm

| Có nghiệp vụ thật (12) | Ghi rõ "Giai đoạn sau" (3) |
|---|---|
| Vé & đặt chỗ · Check-in khách · **Sức chứa & luồng khách** · Camera AI · Báo cáo hiện trường · Dự án & sự kiện · Sự cố · Nhân sự & ca trực · Chấm công · Đối tác & NCC · **SOP & diễn tập** · Tài chính & đối soát | **Xe trung chuyển** · **Tài sản** · **Báo cáo & dự báo** |

Ba module chưa làm **trước đây hiển thị dữ liệu bịa** — tên tài xế, phiếu việc, số tệp đính kèm. Đã gỡ sạch. Giờ mỗi module nói rõ sẽ làm gì và **cần dữ liệu gì trước**, kèm nhãn "Giai đoạn sau" ngay trong menu. Có bài test đọc thẳng mã nguồn để không ai gắn nhãn "live" cho một module không có nghiệp vụ.

**T11a — nền sức chứa theo giờ (đã lên production 07/08):** migration `202608070037_erp_capacity_thresholds.sql` đã chạy trên Supabase production. Mỗi cơ sở có một cấu hình khởi tạo mang nhãn `ước-lượng`; PostgreSQL tự sinh `hourly_capacity = floor(phương tiện × chỗ × 60 ÷ phút/vòng)`, mỗi ngưỡng có 4 quy tắc xanh/vàng/cam/đỏ với hành động, người chịu trách nhiệm và SLA. UI hiển thị nguyên phép tính, nguồn, phiên bản và nhật ký cấu hình bất biến; chỉ giám đốc được cập nhật, có khoá dòng + kiểm tra phiên bản ở RPC. Số tải hiện tại chỉ là **lượt check-in T8 được chấp nhận trong giờ — proxy thượng nguồn, không phải occupancy/cảm biến/realtime**, và màn hình nói thẳng điều đó. Đã xác minh: `typecheck`, `lint`, `build` sạch; toàn bộ Vitest **474 pass, 1 skip có chủ đích**; query production thấy 4 ngưỡng, mỗi ngưỡng đủ 4 rule, 4 seed audit và RLS bật trên cả 3 bảng; smoke production chỉ-đọc **6/6 pass** cho giám đốc/quản lý/nhân viên/kế toán trên mobile + desktop. Bản vá `5c20b06` hiển thị tiền dạng gọn trên mobile nhưng giữ số đầy đủ từ `sm` trở lên. T11 chỉ hoàn tất khi batch T11b ngay dưới đây cũng qua deployment và smoke.

**T11b — cổng SOP Go/No-Go (đã lên production 07/08):** quản lý cơ sở phải xác nhận đủ từng mục và checklist mới không mặc định “Đạt”; giám đốc khác người gửi mới được quyết định `GO`, `NO-GO` hoặc chấp nhận rủi ro bằng văn bản. PostgreSQL khoá dòng, kiểm phiên bản/idempotency, chặn `GO` nếu còn lỗi trọng yếu, bắt nội dung chấp nhận rủi ro tối thiểu 40 ký tự và ghi audit chỉ-thêm. Inbox giám đốc nhận hồ sơ đang chờ. 20 mục seed có mã/nguồn trang Playbook nhưng **đều ghi đúng `Demo operational summary — requires organizational approval`, chưa có ngày hiệu lực và không được gọi là SOP tổ chức đã phê duyệt**. Migration `038`, app commit `58e8802`, deployment và bằng chứng xác minh ghi ở mục 0; smoke chỉ-đọc nên không submit hồ sơ giả. **T11 hoàn tất đúng phạm vi hàng việc. Chưa có SOP tổ chức chính thức, phiên bản/ngày hiệu lực đã duyệt hoặc lịch diễn tập; đó là dữ liệu và workflow mở rộng riêng, không được suy diễn từ T11.**

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
  - ✅ **T14 bước 2 — xong, xem T14b ở mục 4.** `staff-access-manager.tsx` và `role-switch-control.tsx` giờ đọc `lib/erp/staff-directory.ts`, nguồn duy nhất cho cả hai màn hình — không còn liệt kê từ `DEMO_ERP_ACCOUNTS`. (Tài liệu này từng ghi "cố ý chưa làm" dù T14b đã xong — sửa lại 05/08, cùng bẫy #6 với T15 ở trên.)
- ✅ **T15 — nhật ký tập trung toàn hệ thống, đã xác minh trên production 05/08.** Xem chi tiết ở mục 4. `/erp/nhat-ky` gộp 7 bảng nhật ký nghiệp vụ (kế toán, hoá đơn NCC, chốt ca, phiếu việc, dự án, phân quyền nhân sự, quản trị tài khoản) thành một dòng thời gian qua RPC `erp_audit_timeline`, mỗi dòng chụp cả tên/chức danh/khu vực **lẫn** mã tài khoản tại thời điểm thao tác, phạm vi nhìn tính ở máy chủ theo vai trò người xem (nhân viên thấy việc mình, quản lý thấy việc cơ sở mình, giám đốc thấy tất cả). Khối "Hoạt động" ở `/erp/ho-so/[accountId]` (T14) giờ chỉ còn là bộ lọc-theo-người của cùng nguồn này, không phải một nhật ký riêng.
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
- **1 spec production cũng đỏ vì đúng lý do đó:** `prod-smoke-field-reports-and-gate-scans.spec.ts` gõ mã bịa rồi khẳng định "Đã ghi nhận" — đỏ trên production từ khi T8 lên. Viết lại để giữ **cả hai** tính chất mà không tiêu gì: mã lạ phải bị từ chối, **và** lượt bị từ chối vẫn được ghi lại nên phiên khác nhìn thấy — đúng điều bài cũ muốn chứng minh (trạng thái máy chủ thật, không phải state trong React).
- **1 spec production đã chết:** `prod-smoke-camera-ai-incident.spec.ts` bấm đúng nút T17 gỡ đi, không bao giờ chạy được nữa. **Đã xoá.** Tính chất nó canh giữ (số camera không được biến thành sự cố thật) giờ do `erp-camera-ai-simulation.spec.ts` canh, và spec đó **đã chạy trên production**. RPC `erp_incident_report_from_camera` cùng bài kiểm tra hợp đồng của nó **giữ nguyên** cho T17b.

Kết quả: **42 xanh / 8 skip / 0 đỏ** cục bộ từ một bản build sạch, và **34 lượt xanh / 0 đỏ trên production thật** (toàn bộ `prod-smoke-*`, chạy sau khi T14b lên). Đã xác minh bằng SQL: 9 tài khoản `qa-%` do các spec tạo ra đều ở trạng thái `suspended`, không còn cái nào hoạt động. Lưu ý cho phiên sau: `npx playwright test` **không kèm đường dẫn** sẽ nuốt luôn các spec `prod-smoke-*` và chúng đỏ hàng loạt vì đang trỏ vào máy cục bộ — chỉ định spec, hoặc đặt `PLAYWRIGHT_BASE_URL`.

### 2.7b Trợ lý điều hành bằng giọng nói

Nút tròn góc dưới phải mọi màn hình ERP (`components/erp/voice-command-center.tsx`). Nhận giọng nói bằng **Web Speech API của trình duyệt** (`vi-VN`) — không gọi dịch vụ AI ngoài nào, không gửi âm thanh đi đâu, nên không có chi phí và không có vấn đề dữ liệu rời hệ thống.

Đã nâng ngày 02/08 theo yêu cầu chủ dự án ("làm giống bọn Zalo gửi voice, tự chuyển ra text, nghe được keyword rồi mở thư mục giùm giám đốc"):

- **Chữ hiện dần khi đang nói** (`interimResults = true`) kèm sóng âm và đồng hồ đếm — trước đó im lặng rồi nhảy ra cả câu, người dùng không biết máy có nghe không.
- **Luồng hội thoại giữ lại lịch sử** (bong bóng "Tin nhắn thoại · 0:03" cho câu nói, bong bóng xanh cho phản hồi), lưu trong `sessionStorage`, còn nguyên sau khi chuyển trang. Trước đó chỉ hiện đúng kết quả cuối rồi mất.
- Mở màn hình xong vẫn ghi lại một dòng "Đã mở …" nên mở lại trợ lý là biết mình vừa làm gì.

Phần nhận từ khoá → điều hướng (`resolveErpNavigationCommand`, 15 module × 4 cơ sở) **đã có từ trước và không đổi**; `tests/unit/erp-voice-command.test.ts` giữ nguyên. Điều quan trọng cần nói thẳng: **đây là so khớp từ khoá, không phải mô hình ngôn ngữ** — nói ngoài bộ từ đã khai báo thì trợ lý trả lời "chưa tìm thấy màn hình phù hợp" chứ không đoán. Các câu hỏi số liệu đi qua `app/api/erp/assistant/route.ts`, đọc dữ liệu thật trong phạm vi tài khoản và **từ chối trả lời khi thiếu một vế** thay vì dựng số.

Chưa kiểm thử tự động được phần micro: Chromium headless không có đường ra dịch vụ nhận dạng. `tests/e2e/erp-assistant-thread.spec.ts` (3 bài × 2 khổ màn hình, đã chạy trên production thật) kiểm phần còn lại — cùng một hàm `execute` mà giọng nói gọi vào.

`domain/erp.ts` giữ 4 cơ sở + danh sách module trong code — **không tính là lỗi**, đó là cấu hình phần mềm, cố ý không cho sửa từ giao diện. Riêng `ErpSite.snapshot` (visitors/checkedIn/employeesOnShift/openIncidents/capacityPercent) trong cùng file **giờ không còn nơi nào đọc** sau khi sửa T13 — an toàn vì không hiển thị sai ở đâu nữa, nhưng nên xoá khỏi type trong một đợt dọn sau, gộp cùng lúc xử lý Camera AI.

### 2.5 Dòng tiền: cả hai đầu đã có đường, một đầu chưa chạy thật với người dùng

- ✅ **Công nợ NCC**: ghi nhận nợ → đề nghị chi → duyệt chi → **đã trả** (T10).
- 🟡 **Tiền mặt sau chốt ca — T10b, code xong 05/08, chưa chạy round-trip thật với người dùng.** Xem chi tiết ở mục 4.

### 2.6 Web công khai

- Không bán được hàng, bị chặn ở tầng cấu hình (`config/experience.ts` cấm production bật sandbox checkout, và không có cổng thanh toán thật).
- **Luồng QR khách du lịch (`/pass/[token]`) vẫn chưa dựng lại.** T8 đã tạo nền (`erp_tickets`); W1 là việc nối luồng khách vào đó.

**Dựng lại trang chủ 03/08 — chủ dự án tự dùng thử rồi nhận xét thẳng: "nhiều thứ đấy nhưng dùng xong không hiểu gì hết, lung tung".** Không phải thiếu chức năng — trang chủ (`app/ninh-binh-landing.tsx`) cao **11.365px**, làm việc của năm trang gộp lại (ảnh mở đầu → câu chuyện → bản đồ → toàn bộ 9 điểm đến dạng thẻ lớn → lưới 6 điểm phụ → công cụ dựng tuyến → lịch trình), không nói cho khách biết nên bắt đầu từ đâu, và **trùng với `/explore`** vốn đã có bản đồ + bộ lọc tốt hơn.

Đã sửa:
- Thêm khối **"Ba lối vào. Chọn một."** ngay dưới ảnh mở đầu: Xem bản đồ (`/explore`) · Kể về ngày bạn (`/plan`) · Lấy tuyến dựng sẵn (`/packages`). Đây là phần đổi cảm giác nhiều nhất — khách vào biết ngay có ba việc có thể làm, không phải đọc hết trang mới biết.
- Trang chủ chỉ còn dựng **3 câu chuyện** (trước là 10 thẻ lớn + 6 thẻ nhỏ = 16), rồi dẫn sang `/explore` bằng một nút "Xem tất cả điểm đến (N)" — hết trùng, danh mục đầy đủ chỉ còn một chỗ.
- Nút "Khám phá gần đây" từng cuộn xuống danh mục đã bị gỡ; giờ dẫn thẳng sang `/explore`.
- Gỡ ngôn ngữ nội bộ lọt ra mặt khách: `Ninh Bình tourism core`, `Intent → rules → validated itinerary`, `Có khung giờ demo`, `Trạng thái: idle`. Khách không hiểu và không nên thấy.

Kết quả: cao **7.259px** (giảm ~36%). Đã xác minh: `npm run lint`/`build` sạch, 28/28 e2e công khai xanh (`public-surfaces.spec.ts`, `public-journey-planner.spec.ts`), tự chụp ảnh trang chủ cả hai khổ màn hình. **Cố ý chưa làm trong đợt này:** phần "Câu chuyện điểm đến", bản đồ nhúng và công cụ dựng tuyến trên trang chủ vẫn giữ nguyên — chỉ sắp xếp lại thứ tự và cắt phần trùng, chưa đánh giá lại từng phần trong đó. Nếu vẫn còn cảm giác rối sau đợt này, cần chủ dự án chỉ rõ đang rối ở khúc nào (mở đầu, hay công cụ dựng tuyến, hay điều hướng) để sửa đúng chỗ thay vì đoán.

**03/08 (đợt hai, sau khi hợp nhất hai lịch sử git) — sửa tiêu đề "Ba lối vào. Chọn một.", viết lại mô tả 9 điểm đến, thêm trích dẫn báo chí.**

Đúng cái khối vừa ghi công ở trên bị chính chủ dự án chê ngay ngày hôm sau: *"ba lối vào chọn 1 nghe đần độn vc như kiểu con bot hướng dẫn ấy"*. Cấu trúc ba thẻ (bản đồ / kể ngày bạn / tuyến dựng sẵn, đánh số 01–02–03) vẫn đúng — nó giải quyết thật vấn đề "vào trang không biết bắt đầu từ đâu". Cái sai chỉ là **tiêu đề dịch thẳng kiểu liệt kê UI** ("Three ways in. Pick one." → "Ba lối vào. Chọn một."), đọc như lệnh máy chứ không phải lời mời. Đã sửa riêng dòng tiêu đề, giữ nguyên khung ba thẻ:
- VI: "Ba lối vào. Chọn một." → "Không ai bắt đầu một chuyến đi giống ai."
- EN: "Three ways in. Pick one." → "No two journeys start the same way."

Cùng đợt: viết lại `description`/`story` cho toàn bộ 9 điểm đến trong `content/destinations.ts` theo bốn kỹ thuật giọng văn ghi ở `docs/reference/UI_UX_RULES.md#voice-rules` (từ láy, vế đối, câu dài-ngắn-dài, đính chính định kiến), tham chiếu giọng heritagevietnamairlines.com. Thêm trường `press` (trích dẫn UNESCO + Forbes cho Tràng An, Hoa Lư, Tam Cốc–Bích Động) với cờ `verbatim` bắt buộc — `true` chỉ khi nguyên văn từng chữ, `false` cho sự thật đã kiểm chứng nhưng không đọc được nguyên văn (trang UNESCO trả 403).

**03/08 (đợt bốn) — thêm `press` cho 4/6 điểm đến còn thiếu, đã tự đọc từng nguồn qua WebFetch.** Bái Đính (Vietnam Airlines Travel Guide — hành lang La Hán), Thung Nham (Nhân Dân — 5.000 tổ chim/40 loài), Vân Long (Mongabay — trích lời chuyên gia Tilo Nadler *nguyên văn*, cộng dữ kiện IUCN Green List/Ramsar), Tam Chúc (VietnamPlus + Buddhistdoor Global — diện tích, Điện Tam Thế, Đại lễ Vesak 2019). **Hang Múa và Phố cổ Hoa Lư — không đủ nguồn để đứng tên `press`, nên viết lại bằng giọng riêng thay vì trích dẫn.** Vẫn mượn dữ kiện đọc được (tích vua Trần Thái Tông xem múa hát giải thích tên "Hang Múa"; Phố cổ Hoa Lư dựng theo dáng kinh đô Đại Cồ Việt thế kỷ X, có gian hàng thủ công từ các làng nghề trong tỉnh) để viết lại `description`/`story` — không ngoặc kép, không ghi `publisher`/`url`, có ghi chú trong code giải thích vì sao. Nếu sau này tìm được nguồn xứng đáng, bổ sung `press` theo đúng luật ở type.

**03/08 (đợt ba) — đã gỡ: `introWords` lặp hai lần, chỉ dẫn "kéo ngang" thừa.** Khối in `introWords` từng xuất hiện hai lần trong hero tĩnh sau màn intro (dòng kicker trên `<h1>` + một dải 3 cột lặp lại y hệt bên dưới subtitle) — đã gỡ dải thừa, giữ dòng kicker. `dragHint` ("Kéo ngang để xem tuyến") từng lặp lại đúng ý `journeysBody` ngay phía trên nó ("Kéo qua các tuyến...") — đã bỏ hẳn, vì các thẻ tuyến vốn đã hở mép (carousel snap-scroll) nên tự gợi ý được thao tác kéo.

**Nghiên cứu thiết kế 03/08 — 4 trang awwwards mới, xem chi tiết ở `docs/reference/REFERENCE_SITE_ANALYSIS.md`.** Cả bốn việc đã xong, xem chi tiết bên dưới: (1) ✅ timeline lịch sử tương tác, (2) ✅ pull-quote báo chí, (3) ✅ câu neo triết lý, (4) ✅ khung khan hiếm trung thực.

**03/08 (đợt sáu) — 3 việc còn lại trong danh sách nghiên cứu awwwards.**

- **Pull-quote báo chí:** `app/destination/[slug]/page.tsx` giờ tách hai kiểu hiển thị theo cờ `verbatim`. `verbatim: true` (trích nguyên văn thật — Forbes cho Tràng An, Tilo Nadler cho Vân Long) render thành khối lớn: dấu ngoặc kép cỡ lớn, chữ `font-display` 2xl–3xl, nền `#f4f0e7`, tên tờ báo in hoa đậm. `verbatim: false` (dữ kiện tổng hợp, không phải câu nguyên văn — phần lớn trích dẫn UNESCO) giữ kiểu cũ, nhỏ và khiêm tốn hơn — cố ý phân biệt bằng thị giác để người đọc nhận ra đâu là lời trích thật, đâu là dữ kiện diễn giải, không đánh đồng hai loại.
- **Câu neo triết lý:** chốt dùng nguyên văn subtitle đã có sẵn — "Hành trình giữa núi, nước và di sản vượt thời gian." / "A journey between mountains, water and timeless heritage." — thay vì bịa thêm một câu mới. Đưa câu này vào ba chỗ: subtitle trang chủ (không đổi), `app/layout.tsx` (`metadata.description`, đồng thời bỏ tiêu đề "Ninh Binh AI Journey" — chữ "AI" là thuật ngữ nội bộ lọt ra mặt khách — đổi thành "Ninh Bình Journey"), và một `<footer>` mới cuối trang chủ lặp lại đúng câu này. Không có test nào khóa tiêu đề/mô tả cũ, đã kiểm trước khi sửa.
- **Khung khan hiếm trung thực:** thêm trường `realLimit?: Localized` vào `DestinationCatalogItem`, cùng luật với `press`/`timeline` — chỉ điền khi có giới hạn thật đã kiểm chứng, không phải đồng hồ đếm ngược giả. Tràng An: "mỗi thuyền chở tối đa 4 khách, chèo tay dọc một tuyến cố định — giờ cao điểm phải xếp hàng thật" (đã tra nhiều nguồn, số 4 khách/thuyền được nhiều nguồn xác nhận; **cố ý không dùng** con số "2000 thuyền/ngày" tìm thấy vì chỉ từ một reviewer, không đủ tin cậy). Vân Long: "voọc mông trắng dễ gặp nhất mùa khô tháng 11–4, rõ nhất sáng sớm/chiều muộn" (nhiều nguồn đồng thuận). Render thành ô nổi bật màu hổ phách "Giới hạn thật" ở đầu panel "Thông tin vận hành".

**Lỗi thật bắt được khi tự kiểm bằng Playwright (không phải chỉ đọc code):** hai trích dẫn `press` của Vân Long dùng chung một bài Mongabay — `key={entry.url + entry.year}` bị trùng, React cảnh báo "two children with the same key" ngay trên console khi mở trang. Vá bằng cách thêm `index` vào key. Nếu chỉ đọc mã nguồn tĩnh sẽ không thấy lỗi này — phải chạy dev server thật.

Đã xác minh: `tsc --noEmit`/lint/build sạch, chạy dev server thật + Playwright chụp ảnh Tràng An/Vân Long/trang chủ (desktop), **28/28 `public-surfaces.spec.ts` + `public-journey-planner.spec.ts` xanh** trên bản build local — kể cả bài khóa `introWords`.

**03/08 (đợt bảy) — hai lỗi trải nghiệm thật, chủ dự án tự phát hiện trên web: "4 chữ nằm ngang phè" và "web nằm im lìm".** Cả hai đều xác minh được bằng Playwright giả lập, không phải cảm tính.

**Bug 1 — bản dự phòng khi trình duyệt bật "giảm chuyển động" xấu hơn hẳn bản có chuyển động.** Emulate `reducedMotion: "reduce"` (đúng thứ Windows bật khi tắt "Show animations in Windows" — máy tính thường gặp, điện thoại thường không) thì `@media (prefers-reduced-motion: reduce)` trong `globals.css` biến bốn chữ `introWords` thành một hàng ngang chữ nhỏ, `flex-wrap`, không ảnh nền, ẩn hẳn khối `opening-lockup` (tiêu đề "Ninh Bình" lớn). Đây đúng là "nằm ngang phè" chủ dự án mô tả — chụp ảnh xác nhận trước/sau ở `D:/diag` (không commit, chỉ dùng để đối chiếu). Sửa bằng cách **tái dùng khối `opening-lockup` đã đẹp sẵn** làm khung hình tĩnh: ẩn hẳn `.opening-sequence` (chuyển động tuần tự vốn không có dạng tĩnh nào hợp lý), hiện `.opening-lockup` ngay lập tức không animation — cùng chất lượng hình ảnh với bản có chuyển động, chỉ khác đứng yên.

**Bug 2 — không có animation nào gắn với việc cuộn trang.** Rà toàn bộ `app/ninh-binh-landing.tsx`: `fade-up`/`reveal-panel` là CSS `animation: ... both` chạy đúng một lần lúc phần tử được mount, **không hề dùng `IntersectionObserver`**. Nghĩa là sau ~1-2 giây tải trang xong, mọi thứ bên dưới màn hình đầu tiên đứng yên tuyệt đối khi cuộn — không phải thiếu tính năng hay chữ nghĩa, mà là trải nghiệm cuộn trang chết cứng. Đây là nguyên nhân chính của cảm giác "tầm thường, fresher cũng làm được".

Vá bằng component mới `components/shared/reveal.tsx` (`<Reveal>`) — thuần `IntersectionObserver`, không thêm thư viện (đúng khuyến nghị "tránh GSAP trừ khi thật cần" ở `REFERENCE_SITE_ANALYSIS.md#implementation-notes`), tự tắt hẳn (state khởi tạo qua `useState(prefersReducedMotion)`, không phải `setState` trong effect — tránh lỗi lint `react-hooks/set-state-in-effect`) khi trình duyệt bật giảm chuyển động. Gắn vào 6 khối tiêu đề chính của trang chủ (Ba lối vào, Câu chuyện không chỉ điểm dừng, bản đồ, Câu chuyện điểm đến, Bộ lập tuyến, Lịch trình) và so le 3 thẻ "Ba lối vào" (`delayMs={index * 90}`) — cố ý dừng ở mức tiêu đề khối, không bọc từng thẻ nhỏ lẻ tẻ để giữ diff gọn và rủi ro thấp.

Đã xác minh: `tsc`/lint/build sạch (phải sửa một lỗi lint thật khi viết `Reveal` lần đầu — gọi `setVisible` đồng bộ trong effect), Playwright emulate `reducedMotion: reduce` chụp lại xác nhận khối `opening-lockup` hiện đúng ảnh nền + tiêu đề lớn, Playwright cuộn trang xác nhận thẻ "03 · Lấy tuyến dựng sẵn" hiện dần đúng lúc cuộn tới, **28/28 `public-surfaces.spec.ts` + `public-journey-planner.spec.ts` xanh** (kể cả accessibility scan không bị ảnh hưởng bởi phần tử `opacity: 0` trước khi observer kích hoạt).

**03/08 (đợt năm) — timeline lịch sử tương tác cho Tràng An, Cố đô Hoa Lư, Bái Đính.** Học từ Tengile MalaMala (mục nghiên cứu ở trên): thay đoạn văn phẳng bằng dòng thời gian bấm-chuyển, mỗi mốc một câu chuyện ngắn. Thêm trường `timeline?: { year, label, detail }[]` (kiểu `Localized`) vào `DestinationCatalogItem`, cùng luật như `press` — chỉ mốc đã kiểm chứng qua nguồn thật, không suy đoán ngày tháng:
- Tràng An: hơn 30.000 năm (dấu tích người ở trong hang) → thế kỷ X (Cố đô Hoa Lư nằm trong vùng lõi) → 2014 (UNESCO ghi danh).
- Cố đô Hoa Lư: 968 (Đinh Bộ Lĩnh lập kinh đô Đại Cồ Việt) → 968–1010 (ba triều Đinh/Tiền Lê/đầu Lý) → 1010 (Lý Thái Tổ dời đô Thăng Long) → 2014 (UNESCO). Đã xác minh mốc 968/1010 qua Wikipedia tiếng Việt + báo Ninh Bình trước khi đưa vào code.
- Bái Đính: 1136 (quốc sư Nguyễn Minh Không lập chùa cổ trong hang núi Đính) → 2003 (khởi công quần thể mới) → 2012 (9 kỷ lục, dữ kiện đã có sẵn trong `press`).

Component mới `components/discovery/destination-timeline.tsx` — client component, danh sách nút năm dạng tab (`role="tab"`/`aria-selected`, cuộn ngang được, mobile-first), chọn năm nào hiện chi tiết năm đó, dùng lại class `.fade-up` có sẵn thay vì thêm animation mới. Không GSAP, đúng khuyến nghị đã ghi ở `REFERENCE_SITE_ANALYSIS.md#implementation-notes`. Gắn vào `app/destination/[slug]/page.tsx`, chỉ hiện khi `destination.timeline` có dữ liệu — 6 điểm còn lại không có mục thừa.

Đã xác minh: `tsc --noEmit`/lint/build sạch, chạy dev server thật + Playwright chụp ảnh trang Tràng An (desktop bấm chuyển tab đổi đúng nội dung, mobile cuộn ngang không vỡ layout), curl kiểm cả 3 trang có timeline render đúng và Hang Múa (không có `timeline`) không hiện mục thừa.

**04/08 (đợt tám) — lỗi nền tảng lớn nhất về thị giác được tìm ra bằng cách DÙNG web như khách lạ, không đọc code: hai font chính của site chưa từng được cài.** `--font-heading` trỏ tới `"Sora"`, `--font-body` trỏ tới `"Manrope"` — cả hai không có trong `package.json`, chỉ `@fontsource-variable/fraunces` là thật. Hệ quả: màn intro (hardcode `"Fraunces Variable"` trực tiếp) nhìn như trang giải thưởng, còn **toàn bộ phần còn lại của site rơi về Segoe UI đậm** — đúng cảm giác "tầm thường, fresher cũng làm được" chủ dự án mô tả mà không ai gọi tên được. Bài học ghi thẳng vào comment trong `globals.css`: đổi font phải cài package + import ở `app/layout.tsx` trước. Đã sửa: `--font-heading` → Fraunces (đồng bộ intro, thêm `font-variation-settings` opsz/SOFT cho tiêu đề), cài + import `@fontsource-variable/manrope` cho `--font-body` (có subset tiếng Việt).

Cùng đợt, đi bộ qua từng trang bằng Playwright như khách lạ và sửa những gì mắt người thấy:
- **Bỏ hẳn khối "Ba lối vào" (3 thẻ điều hướng) ở trang chủ** — chủ dự án chê lần hai ("3 cái đường là cái gì"); nó lặp lại đúng các đường đã có ở hero + nav, bắt khách đọc thêm một màn chữ. Test không khóa khối này (đã kiểm trước khi xóa).
- **Vết chữ kỹ thuật/tiếng Anh lộ ra mắt khách**: `/explore` "Bản đồ dùng lớp ngữ cảnh local... tile mạng không khả dụng" → viết lại thành lời người; thẻ điểm đến "đi bộ low" → "đi bộ ít/vừa/nhiều" (map `mobilityLabel`); nav "Lập hành trình / Plan" → "Lập hành trình" (test cập nhật theo); `/plan` "luật cấu hình quyết định..." → lời mời tự nhiên; `/packages` nhãn "1 NGÀY · BALANCED" → `PACE_LABEL` tiếng Việt (thư thả/cân bằng/năng động), dòng tóm tắt itinerary-editor "đi bộ moderate · nhịp balanced" → tiếng Việt.
- **Đợt "ngâm thơ" cho copy trang chủ còn gượng** (theo đúng yêu cầu vần điệu lên xuống): `journeysBody` (bỏ từ "collection"), `mapBody` ("Ở đây núi không đứng một mình: sông luồn giữa đá, đền nép dưới cây..."), `storiesIntro` ("...những nơi này đã chờ hàng nghìn năm, không vội"), `hiddenGems`/`hiddenGemsIntro` ("nơi tiếng chèo khua nước còn nghe rõ hơn tiếng người"), `companionBody` (bỏ "ghép cục bộ từ dữ liệu mẫu đã biên tập" — jargon). Cả VI lẫn EN.

Đã xác minh: tsc/lint/build sạch, chụp ảnh so sánh trước–sau trên production build thật (hero, /explore, /destination/trang-an — toàn site giờ cùng một chất serif Fraunces với intro, pull-quote Forbes nhìn như tạp chí), **28/28 e2e công khai xanh** sau khi cập nhật một test đang khẳng định đúng cái nhãn song ngữ đã bỏ.

**04/08 (đợt chín) — chủ dự án chốt "demo thì cứ bạo tay, public sau làm nhẹ nhàng lại": khối "mở ra khi cuộn" + mặt nước tương tác WebGL thật, không dùng thư viện.** Tham chiếu kỹ thuật `animation-timeline: view()` (CSS scroll-driven animation, chạy trên compositor thread, không JS) — đã tra cứu trước khi code, không tự chế.

- **`.scroll-open-frame`** (globals.css): khung cao 100vh, ảnh bên trong bắt đầu ở scale 0.7 + bo góc 40px, tự giãn ra scale 1 + bo góc 0 khi cuộn qua đúng đoạn "entry" của phần tử. `@supports (animation-timeline: view())` bọc ngoài — trình duyệt chưa hỗ trợ thì rơi về trạng thái tĩnh đã mở sẵn, không vỡ layout. Tắt hẳn dưới `prefers-reduced-motion`.
- **`components/shared/water-ripple.tsx`** — component mới, thuần WebGL1 (không three.js/pixi, không thư viện mới trong `package.json`). Shader gợn sóng: mỗi lần chạm/di/click phát một "giọt" (vị trí uv + thời điểm), fragment shader cộng dồn tối đa 8 giọt còn hiệu lực thành độ lệch UV dạng sóng tắt dần theo khoảng cách và thời gian, cộng một chuyển động nền rất nhẹ để mặt nước không bao giờ đứng im tuyệt đối.
  - Dùng ảnh có sẵn `intro-trang-an-rain.png` (đã có thuyền thật giữa khung) — không tự bịa asset thuyền không tồn tại.
  - **3 lỗi thật bắt được khi tự kiểm bằng ảnh chụp Playwright, không phải đọc code suông:** (1) thiếu `gl.pixelStorei(UNPACK_FLIP_Y_WEBGL, true)` → cả ảnh trong canvas bị lộn ngược (WebGL đọc gốc dưới-trái, `<img>` đọc gốc trên-trái) — chụp ảnh so sánh mới lộ ra; (2) container gắn `touch-none` chặn cuộn chạm trên điện thoại — đúng lỗi chủ dự án đoán trước từ tham chiếu alkemymarket.com; đã gỡ, giờ chạm vẫn cuộn trang bình thường, đồng thời tạo gợn sóng "ăn theo"; (3) prop `wakeSource` truyền object literal thẳng từ JSX tạo tham chiếu mới mỗi lần render → effect dựng lại WebGL liên tục — đổi thành hai prop số nguyên thủy (`wakeSourceX`/`wakeSourceY`).
  - **Đổi hướng theo phản hồi trực tiếp:** bản đầu là "mưa rơi ngẫu nhiên khắp mặt nước" (giọt rơi random cả trên vách núi — sai vật lý, đã ghim `WATER_Y_MAX` giới hạn vùng nước). Chủ dự án góp ý đổi vibes: **thuyền tự rẽ nước nhẹ nhàng** hợp hơn mưa — sửa thành nguồn sóng nền phát đều quanh đúng vị trí thuyền (nhịp ~500-900ms như mái chèo), giữ nguyên toàn bộ hạ tầng giọt sóng đã xây.
- Nối `WaterRipple` vào `.scroll-open-frame` giữa khối "Câu chuyện, không chỉ điểm dừng" và bản đồ trên trang chủ. Copy mới `touchWaterLabel`/`touchWaterTitle` (VI/EN).

Cùng đợt, 2 bug tương tác thật chủ dự án tự bắt được khi dùng web (không phải đọc code): **"chỗ slide đầu trang có kéo được quái đâu"** — `route-rail` chỉ có CSS `cursor:grab`, không có xử lý kéo chuột nào chạy thật; đã thêm pointer-event drag-to-scroll thật + chặn click giả ngay sau một cú kéo. **"dưới các hình ảnh cũng nhấn không được, phải bấm đúng nút Khám phá"** — `story-card`/`route-card` chỉ có nút con nhỏ mở được chi tiết, thân ảnh vô dụng; đã thêm `onClick` lên cả thẻ, hai nút bên trong `stopPropagation` để không bấm trùng hai lần. Sửa lần đầu gắn `role="button"` lên `<article>` bọc 2 nút thật — bị axe báo "serious" (nested interactive controls); gỡ role/tabIndex thừa, giữ đúng onClick cho chuột vì nút thật đã đủ cho bàn phím.

Đã xác minh: tsc/lint/build sạch, Playwright chụp ảnh thật xác nhận cả 3 lỗi trên (kéo chuột đổi `scrollLeft` thật, ảnh lộn ngược rồi hết lộn ngược, gợn sóng không còn lan lên núi), 28/28 e2e công khai xanh.

**04/08 (đợt mười) — chủ dự án chê thẳng "web vẫn chán, kém, lỗi vặt nhiều" và yêu cầu tự dùng web như khách lạ (Playwright, không đọc code) để tìm lý do thật, đồng thời gỡ bỏ khối mặt nước tương tác vừa làm ("nhìn ngáo").**

Tự soi production bằng Playwright (chụp ảnh nhiều mốc cuộn, không đọc code trước) bắt được:
- **`WaterRipple` dùng y hệt ảnh nền của intro** (`intro-trang-an-rain.png`) — kéo xuống gặp lại đúng ảnh vừa xem, gợn sóng quá nhỏ để nhận ra trên ảnh thật → nhìn như lỗi lặp khối, không phải hiệu ứng. **Đã gỡ toàn bộ**: section trong `ninh-binh-landing.tsx`, `components/shared/water-ripple.tsx`, CSS `.scroll-open-frame`/`.scroll-open-media` trong `globals.css`, copy `touchWaterLabel`/`touchWaterTitle`. Commit `936e3c0`.
- **Intro khóa cuộn quá lâu** — sau ~4 giây (đã load xong + cuộn nhiều lần) vẫn còn kẹt trong intro, có khung hình hoàn toàn trống chữ. Ghi nhận, chưa sửa trong đợt này (ngoài phạm vi yêu cầu hiện tại).
- Chủ dự án tự xem `https://inversa.com/` (Awwwards SOTD, 7.48/10) — thích hướng ghim ảnh cuộn (pinned scrollytelling) nhưng chê rõ 2 điểm: chỉ số "PHASE/FREQ" kiểu HUD kỹ thuật trên preloader, và khung viewfinder-bracket theo dõi tiến độ cuộn — "trông xấu", "quá technical", muốn "sang trọng thiên nhiên hơn".

**Xây `components/discovery/pinned-story.tsx` — 3 nhịp ảnh/chữ ghim khung, tự crossfade theo đúng vị trí cuộn, thuần CSS (`animation-timeline: view()`, named timeline `--pinned-story` đặt trên khối cha cao 300vh), không GSAP, không thư viện mới.** Nội dung 3 nhịp dùng ảnh thật chưa từng lên full-bleed ở đâu khác (`tam-chuc.jpg`, `van-long.png`, `thung-nham.png` — đều đã có sẵn dữ kiện đã kiểm trong `content/destinations.ts`, không bịa), copy theo đúng Voice Rules (từ láy, vế đối, đính chính định kiến) — **không có số phần trăm, không HUD, không monospace**, đúng góp ý "sang trọng thiên nhiên hơn".

3 lỗi thật bắt được khi tự kiểm bằng Playwright (đọc opacity tính toán thật ở nhiều mốc cuộn, không suy diễn từ code):
1. **`animation-timeline` khai báo TRƯỚC shorthand `animation: ... both` bị chính shorthand đó reset về `auto`** — cả 3 nhịp đứng yên ở trạng thái cuối bất kể cuộn tới đâu (giống hệt lỗi từng gặp ở đợt trước, tái phạm vì viết mới). Sửa: khai báo `animation-timeline`/`animation-range` SAU shorthand.
2. **Ảnh và chữ dùng chung một animation-range rộng để crossfade mượt → 2 tiêu đề của 2 nhịp kề nhau chồng lên nhau, không đọc được** — bắt được qua chụp ảnh mobile thật (390px), không thấy trên desktop vì mẫu chụp tình cờ né đúng điểm chồng. Sửa: tách `.pinned-story-media` (ảnh, được phép crossfade rộng/mềm) khỏi `.pinned-story-caption` (chữ, khung hẹp hơn hẳn, có "khoảng lặng" giữa 2 nhịp để không bao giờ chồng — xác minh lại bằng cách quét opacity tính toán mỗi 50px cuộn suốt toàn bộ section, 0 điểm chồng).
3. **Turbopack cache CSS cũ sau nhiều lần sửa `globals.css` liên tiếp** — `getComputedStyle` báo `animation-name: none` dù CSS nguồn đã đúng; `rm -rf .next` + khởi động lại dev server mới thấy đúng. Bài học: khi CSS scroll-timeline "không chạy" mà code nhìn đúng, nghi ngờ cache trước khi sửa lại logic.

**Tiện thể sửa một lỗi hydration mismatch có thật, có từ trước (không phải do đợt này gây ra) trong `components/shared/reveal.tsx`**: `useState(prefersReducedMotion)` đọc `matchMedia` ngay trong lazy initializer — chạy lại ở lần render đầu tiên trên client và lệch với HTML server (luôn `false` vì không có `window`) khi trình duyệt có `prefers-reduced-motion: reduce`. Bắt được qua console log thật của Next.js dev overlay ("1 Issue"), không phải đọc code. Sửa: luôn khởi tạo `false`, bỏ hẳn nhánh set-state-trong-effect (CSS `.reveal-on-scroll { opacity: 1 }` dưới `@media (prefers-reduced-motion)` đã ép hiện toàn bộ rồi, không cần state riêng cho trường hợp này nữa).

Đã xác minh: tsc/lint/build sạch, 22/22 e2e công khai xanh (bao gồm axe accessibility cho `/`), quét opacity thật qua Playwright ở cả desktop và mobile xác nhận không còn điểm chồng chữ, reduced-motion fallback xếp chồng bình thường không vỡ layout, không còn cảnh báo hydration.

**04/08 (đợt mười một) — chủ dự án xem production và chê thẳng "cái đống nó làm ra là cái quái gì". Tự chụp lại production mới thấy đúng: khối vừa đẩy lên hỏng nặng.** Ba lỗi bắt được bằng cách quét ảnh thật ở nhiều mốc cuộn (không đọc code):
1. **Hai tấm ảnh phong cảnh chồng mờ lên nhau thành một đống nhòe** — dissolve bằng `opacity` giữa hai ảnh chi tiết thì luôn ra bùn, không bao giờ sang. Đây là lỗi thiết kế gốc, không phải lỗi tinh chỉnh.
2. **Nhiều đoạn dài không có chữ nào** — chính "khoảng lặng" thêm vào ở đợt trước để chống đè chữ đã tạo ra vùng chết.
3. **Chữ mờ nằm trên nền ảnh rối, không đọc nổi** — scrim quá nhạt.

**Sửa gốc, đổi cả kỹ thuật lẫn nội dung:**
- **Bỏ `animation-timeline: view()` thuần CSS, chuyển sang GSAP ScrollTrigger** (`npm i gsap`). Lý do thật, không phải sở thích: `animation-timeline` **chỉ chạy trên Chrome/Edge** — Safari/Firefox rơi về bố cục tĩnh, tức là khách dùng iPhone xem bản không có hiệu ứng nào. Chủ dự án nói thẳng "cần GSAP thì bỏ GSAP vào, sao không dùng" — đúng. Đã cập nhật lại khuyến nghị cũ trong `REFERENCE_SITE_ANALYSIS.md#implementation-notes`.
- **Ảnh không dissolve nữa mà `clip-path` wipe**: tấm mới lộ dần đè lên tấm cũ, không bao giờ có hai ảnh cùng bán trong suốt → không thể nhòe. Đúng kỹ thuật đã ghi từ MERSI mà trước đó không dùng.
- **Nguyên tắc dàn cảnh bắt buộc: mọi wipe chỉ chạy khi màn hình KHÔNG có chữ.** Giữ chữ cũ → tắt chữ → wipe ảnh → hiện chữ mới từng dòng. Nếu không, đường wipe cắt ngang giữa dòng tiêu đề (đã chụp được và sửa).
- **Hai lớp scrim thay vì một** (dọc ở đáy + ngang bên trái) — ảnh Phát Diệm có trời sáng đúng chỗ chữ căn lề, chỉ gradient dọc thì chữ trắng chìm hẳn.
- **Viết lại toàn bộ nội dung 3 nhịp bằng dữ kiện thật.** Bản cũ do tôi bịa thơ mood, ba câu cùng một khuôn ("Tam Chúc không vội" / "Vân Long không phô diễn" / "Thung Nham là lúc..."), trong đó hai câu dùng đúng lối "không X, không Y" mà `UI_UX_RULES.md#voice-rules` **cấm** — chủ dự án chê "vừa không có skills vừa sáo rỗng", đúng. Bản mới đổi sang Vân Long / Cúc Phương / Phát Diệm (khác hẳn bộ ba Tràng An/Bái Đính/Tam Chúc ở khối dưới, không lặp) và chỉ dùng dữ kiện đã kiểm chứng:
  - Vân Long: Danh sách Xanh IUCN + Ramsar + "cả thế giới còn chưa tới 300 con voọc mông trắng" — Mongabay 2021, đã có sẵn trong `press` của `content/destinations.ts`.
  - Cúc Phương: "vườn quốc gia đầu tiên của Việt Nam" (đã có trong `history`); **mốc năm 1962 tra lại Wikipedia + Vietnam Airlines + Tổng cục Du lịch trước khi đưa vào code** — không lấy từ trí nhớ.
  - Phát Diệm: mái gỗ Việt + kiến trúc đá Công giáo (đã có trong `history`).
- **Lỗi dàn cảnh thật bắt được sau khi chuyển GSAP**: đặt fade-out ngay tại vị trí 0 của timeline nên nhịp 1 **chưa bao giờ đạt opacity 1** (đo được 0.27/0.41/0.55 qua Playwright — mắt thường dễ tưởng là do ảnh tối). Đã thêm mốc "hold" ở đầu mỗi đoạn; đo lại được 1.00/1.00/1.00.

**Bẫy môi trường lặp lại lần thứ ba, ghi ra để phiên sau khỏi mất thời gian:** Turbopack cache CSS cũ rất dai khi sửa `globals.css` nhiều lần liên tiếp — `getComputedStyle` trả về giá trị của bản CSS trước đó, làm tưởng logic sai. **Triệu chứng nhận dạng: số đo khớp chính xác với bộ giá trị cũ.** Cách xử lý: `rm -rf .next` rồi khởi động lại dev server.

Đã xác minh: tsc/lint/build sạch, 22/22 e2e công khai xanh (gồm axe cho `/`), quét Playwright xác nhận 0 khung có hai khối chữ chồng nhau, 0 khung wipe cắt ngang chữ, 0 lỗi JS; mobile 390px đọc được; reduced-motion rơi về xếp chồng dọc với toàn bộ chữ opacity 1.

**06/08 (đã lên production) — sửa dứt điểm khoảng đen đầu intro và tăng màu mà không đổi nội dung.** Giữ nguyên chuỗi khóa `Ninh Bình → Thiên nhiên → Di sản → Kỳ quan`, đúng bốn delay 0,35 / 1,55 / 2,75 / 3,95 giây và tổng 6,5 giây. Ảnh nền giờ hiện ngay từ frame đầu (`opacity: 1`), tăng sáng/bão hòa vừa phải; thêm một lớp color-grade CSS gồm xanh rừng, xanh mặt nước và vàng nắng lấy từ chính ảnh Tràng An. Bốn nhịp chữ dùng kem / xanh non / vàng di sản / vàng nắng thay vì cùng một màu trắng. Không thêm WebGL, canvas hay video vào intro — đây là chỉnh màu trên ảnh thật, nhẹ và có fallback reduced-motion đứng yên. Ảnh chụp thật desktop + Pixel 7 đã kiểm tra, không tràn ngang; `typecheck`, lint, build sạch; `public-surfaces.spec.ts` cục bộ **24/24 xanh**, đồng thời khóa thêm điều kiện lớp màu tồn tại và ảnh không được mở đầu ở opacity thấp.

**06/08 (đã lên production) — dọn lại nhịp trang chủ bằng ảnh chụp thật, không suy từ JSX.** Ảnh full-page Pixel 7 cho thấy phần đầu đang kể cùng một ý quá nhiều lần: intro bốn nhịp → hero in lại `Thiên nhiên. Di sản. Kỳ quan.` → ba thẻ tuyến chữ dày → video/story/map, nên khách phải đi qua nhiều màn hình trước khi tới danh mục có thể chọn. Đã sửa:

- Gỡ hẳn dòng `introWords` khỏi hero; chuỗi này chỉ còn xuất hiện đúng một lần trong intro. Tên `Ninh Bình`, subtitle, giờ địa phương và hai hành động chính của hero giữ nguyên.
- Chuyển toàn bộ ba tuyến gợi ý từ ngay dưới hero xuống **sau `DestinationIndex`**: khách xem đủ các điểm đến trước, rồi mới ghép chúng thành tuyến. Không xóa tuyến hay cắt nội dung.
- Thẻ tuyến cũ khóa `height: 520px`, dùng ảnh làm nền cho toàn bộ tiêu đề/body/tag/nút nên chữ bị ép cả trên desktop lẫn mobile. Bố cục mới tách ảnh và chữ thành hai mặt phẳng: desktop là spread hai cột rộng 1040px, mobile xếp ảnh trên–chữ dưới, chiều cao tự giãn theo nội dung thật; rail vẫn kéo chuột/chạm và scroll-snap như trước.
- Đã chụp riêng hero + khối tuyến trên Desktop Chrome và Pixel 7, rồi chụp lại full-page mobile để kiểm thứ tự bằng mắt. `typecheck`, lint, build sạch; `public-surfaces.spec.ts` **24/24 xanh** ở hai viewport. Test mới khóa cả hai quyết định: hero không được lặp slogan intro và `#curated-routes` phải đứng sau `#destination-index`.

**Bằng chứng deploy 06/08:** commit app `99f4c0a` đã push fast-forward vào đúng `qal1102/ninhbinhjourney:main`; Vercel deployment `dpl_4DbCFVVU8mVCfvUvqWveFQQkAUFE` (`target=production`, `status=Ready`) đã nhận alias `https://ninhbinhjourney.vercel.app`, alias trả HTTP 200. Chạy `PLAYWRIGHT_BASE_URL=https://ninhbinhjourney.vercel.app` trực tiếp trên production: **22/24 pass** ở desktop + mobile, gồm toàn bộ bài intro, thứ tự tuyến, overflow, axe accessibility, bản đồ và ảnh full-page. Hai lượt đỏ là cùng một bài `NBJ-I06 production mode hides concept and demonstration controls` ở hai viewport: production đang **cố ý** build `NEXT_PUBLIC_EXPERIENCE_MODE=client-demo` qua `vercel.json` (quyết định có lịch sử ở commit `54b9079`, để luồng demo/checkout hoạt động), còn bài test giả định mode `production`; nút `Run demo command` vì thế hiện đúng cấu hình. Không đổi mode vận hành chỉ để làm test xanh trong một đợt UI.

**06/08 (batch show-off, đã lên production) — bỏ hoàn toàn YouTube player khỏi ba khung cinematic và thêm interaction nhìn thấy được.** Chủ dự án chốt đây là bản demo ngắn hạn và yêu cầu tự host ngay. Đã làm:

- Ba nguồn đang dùng `OA4lO9rrk4Q` / `0NHfpdPHFE4` / `ZDCPQDr4YHE` được cắt đúng `12–30s` / `12–29s` / `12–30s`, bỏ audio, mã hóa H.264 `yuv420p`, cạnh ngang 1280px, 30fps, `faststart`. Ba asset mới: `public/videos/cinematic/ninh-binh-water.mp4` (3,71 MB), `tam-coc-river.mp4` (5,57 MB), `trang-an-heritage.mp4` (4,17 MB); tổng khoảng 13,5 MB. File nguồn tải tạm khoảng 29 MB đã xoá khỏi working tree sau khi mã hóa, không commit.
- `cinematicClips` chuyển từ `youTubeId` sang `src`: production không còn iframe, play overlay, thanh điều khiển hay postMessage tua video. `CinematicVideo` được vá nhánh MP4 thật: `autoPlay`, reveal theo `canPlay`, observer chạy lại sau khi `<video>` mount; thêm parallax theo scroll bằng CSS variable (không render React theo từng pixel) và lớp light-prism chuyển xanh/vàng. Reduced-motion tắt cả parallax lẫn animation prism.
- Rail tuyến có progress trực tiếp `01→04`, chỉ số hiện tại đổi theo `scrollLeft`; card desktop tilt 3D và glare theo vị trí con trỏ, tự trả về phẳng khi rời card; mobile giữ scroll-snap và không chạy tilt. Nền section có color-field chuyển động, reduced-motion có fallback tĩnh.
- Đã xem frame thật của cả ba MP4 và chụp component thật trên Desktop Chrome + Pixel 7 (cinematic và route showcase, kể cả trạng thái card thứ hai + progress giữa rail). Test mới khóa đúng hợp đồng: 3 cinematic panel = 3 `<video>` local, 0 iframe, `controls=false`, đúng ba pathname asset; targeted Playwright **4/4 xanh** ở desktop + mobile. `typecheck`, lint và build production sạch trước khi ship.

**Bằng chứng ship batch show-off 06/08:** commit app `f5c3925` đã push fast-forward vào `qal1102/ninhbinhjourney:main`; Vercel deployment `dpl_9ifDJSFhCoXSiCJmi5SbkrAfFkEb` (`target=production`, `status=Ready`) đã nhận alias `https://ninhbinhjourney.vercel.app`. Smoke Playwright chạy trực tiếp trên alias production **6/6 xanh** ở Desktop Chrome + Pixel 7: ba MP4 local/0 iframe/không controls, hero không lặp slogan, tuyến nằm sau danh mục điểm đến, không overflow và không có axe violation mức critical/serious.

**07/08 (W5, đã lên production) — sửa lỗi định danh media do chủ dự án bắt bằng mắt và thay hai tương tác đang phô kỹ thuật nhưng kể sai nội dung.** Lỗi gốc không nằm ở codec hay trình phát: batch 06/08 đặt tên file/copy theo câu chuyện muốn kể mà không có bảng ánh xạ nguồn → địa danh. Hậu quả nhìn thấy được: video Tràng An đứng tên Cố đô Hoa Lư; cảnh đỉnh Ngọa Long đứng tên Tuyến 1 Tràng An; một cảnh Tràng An khác đứng tên sông Ngô Đồng/Tam Cốc; ảnh Phố cổ Hoa Lư làm bìa cho tiêu đề Hang Múa–Am Tiên; thẻ tuyến đầu còn nói sai “cả ngày không đặt chân xuống đất” dù tuyến có Thung Nham.

- Đã truy lại tiêu đề nguồn gốc, không suy từ tên MP4: `OA4lO9rrk4Q` = “Hang Mua Peak and Tam Coc”; `ZDCPQDr4YHE` = “Trang An, Ninh Binh”; `0NHfpdPHFE4` chỉ ghi chung “Ninh Binh”, nên theo nhận diện trực tiếp của chủ dự án chỉ gắn ở cấp **Quần thể danh thắng Tràng An**, không đoán tên ngôi đền trong frame. Mapping mới: clip 1 = **Đỉnh Ngọa Long · Hang Múa**; clip 2 = **Tràng An · UNESCO 2014**; clip 3 = **Tuyến 1 · Tràng An** với Đền Trình/Đền Trần/Phủ Khống. Poster reduced-motion cũng đổi về đúng địa danh, không còn trường hợp video đúng nhưng fallback kể sai.
- `components/discovery/route-showcase-card.tsx` (mới): một tuyến nhiều chặng giờ có ảnh/tên/thể loại/thời lượng **đổi theo chặng đang chọn** bằng nút hover/focus/tap; ảnh mở bằng `clip-path`, reduced-motion tắt chuyển cảnh. Phố cổ Hoa Lư hiện thẳng nhãn “Phố cổ Hoa Lư · chặng 03”; Tam Cốc chọn vào là ảnh sông/ruộng Tam Cốc, không dùng ảnh Tràng An làm bìa. Nút cũ “Xem tuyến” thực chất mở chi tiết chặng đầu đã bỏ; nút mới nói đúng việc “Khám phá điểm này”, còn “Thêm tuyến” giữ nguyên.
- `components/discovery/destination-index.tsx` dựng lại theo split-screen editorial học từ MERSI: danh sách tên ở trái, preview bám khung ở phải, đổi bằng clip reveal và có số thứ tự/tên/tagline rõ; bỏ tấm ảnh bay theo con trỏ vốn che danh sách và không tạo thêm thông tin. Mobile giữ ảnh thu nhỏ trong từng hàng và mở chi tiết bằng một chạm — không bắt người dùng chạm hai lần chỉ để xem hiệu ứng.
- Copy tuyến nước bỏ câu sai/khó hiểu, chốt: “Chín hang Tràng An. Ba hang Tam Cốc. Hai hành trình bằng nước.” Route chiều sắp đúng thứ tự Hang Múa → Am Tiên → Phố cổ Hoa Lư. Card Bái Đính/Hoa Lư bổ sung chặng Tam Chúc bằng dữ kiện Vesak 2019 đã tra nguồn từ đợt 03/08, không để một stop xuất hiện mà phần kể không nhắc tới.
- Đã tự chụp và soi frame thật: 3 cinematic desktop có video đang chạy; route Tam Cốc + Phố cổ desktop; destination index desktop; index + Phố cổ mobile reduced-motion. Kiểm trực tiếp `?lang=en&source=trang_an`: không overflow ở 390/1440px, đổi ngôn ngữ giữ `source`; popup Leaflet → Discover mở dialog `z-index:1200`; dialog đóng bằng Escape/backdrop/nút; Add to journey đổi sang Selected.
- Xác minh trên **production build cục bộ** (`npm run build` + `next start`, không phải URL production): typecheck/lint/build sạch; `tests/e2e/public-surfaces.spec.ts` **28/28 xanh** với 4 worker ở Desktop Chrome + mobile. Thêm hàng rào mới khóa đúng nhãn 3 cinematic và việc chọn Tam Cốc/Phố cổ phải đổi `data-active-stop` + ảnh đúng. Một lỗi test-only được vá: selector `EN` phải `exact:true`, nếu không `next dev` bắt nhầm “Open Next.js Dev Tools”.
- **Bằng chứng ship production 07/08:** commit app `31419a4` push fast-forward lên `qal1102/ninhbinhjourney:main`; Vercel deployment `dpl_HU8nyRaynxFPgV7tRJy8kuMKrvgx` (`target=production`, `status=Ready`) nhận alias chính. `PLAYWRIGHT_BASE_URL=https://ninhbinhjourney.vercel.app` chạy trực tiếp trên production: **25/28 xanh ở lượt song song**, gồm toàn bộ test mới cho 3 cinematic + đổi chặng Tam Cốc/Phố cổ, không overflow và axe sạch. Một lượt mobile intro timeout khi 4 worker cùng tải MP4; chạy lại riêng serial **2/2 xanh** desktop/mobile, xác nhận tải chậm chứ không phải lỗi intro. Hai lượt đỏ còn lại là cùng bài `NBJ-I06` cố đòi ẩn demo controls, trong khi `vercel.json` chủ động build `NEXT_PUBLIC_EXPERIENCE_MODE=client-demo`; đây là ngoại lệ cấu hình đã ghi từ deploy `99f4c0a`, không thay mode chỉ để làm test xanh. Tính theo hành vi cần kiểm của W5: **26/26 lượt liên quan đều đã xanh trên production**.

**Việc mở cho phiên sau, từ cùng đợt review "dùng như người":** (a) thẻ danh sách `/explore` vẫn chỉ có nút con bấm được; riêng route card đã đổi thành một cụm đa hành động theo từng chặng nên **không được** gắn click lên cả `<article>` — làm vậy sẽ xung đột với các nút chặng; (b) câu neo `subtitle` giờ xuất hiện ở hero + footer + meta — đợt sau khi thêm trang mới nhớ giữ đúng một câu này.

**Danh sách để chủ dự án xem và quyết khi về nhà — chưa phải cam kết sẽ bê hết vào web:**

- **Trolltunga** (reference chủ dự án đã nêu): chỉ học cách intro dùng ảnh thiên nhiên có màu và nhịp khóa tên thương hiệu; bản 06/08 đã lấy đúng hướng màu sắc, nhưng giữ nguyên nội dung intro Ninh Bình theo yêu cầu. Cần chủ dự án gửi lại đúng URL nếu muốn đối chiếu từng frame vì tài liệu hiện chưa lưu link.
- **Travel Next Level** — https://travelnextlvl.de/en / Awwwards: https://www.awwwards.com/sites/travel-next-level — đáng xem nhất cho ảnh full-screen, typography lớn và rail kéo ngang. Phần rail đã áp dụng; có thể học tiếp cách chuyển trạng thái giữa danh mục và trang chi tiết.
- **Snami Travel** — https://www.snamitravel.com/ / Awwwards: https://www.awwwards.com/sites/snami-travel — chuẩn luxury editorial, khoảng trắng và crop ảnh rất chắc; phù hợp nhất để chỉnh tiếp nhịp chữ/ảnh, không phù hợp nếu bê nguyên palette đen-trắng.
- **Tengile MalaMala** — https://tengilemalamala.com/ / Awwwards: https://www.awwwards.com/sites/tengile-malamala-collection — timeline lịch sử và press quote cỡ lớn là hai ý hợp Ninh Bình nhất; cả hai đã có bản triển khai trên trang chi tiết, nên lần review tới chủ yếu là đánh giá chất lượng hình ảnh/nhịp chuyển.
- **Inversa** — https://inversa.com/ / Awwwards: https://www.awwwards.com/sites/inversa — pinned scrollytelling đẹp, đã áp dụng phần ghim ảnh bằng GSAP; cố ý bỏ HUD, chỉ số kỹ thuật và bracket vì sai chất thiên nhiên sang trọng.
- **Marvell Tile & Stone** — https://www.marvellco.com.au/ / Awwwards: https://www.awwwards.com/sites/marvell-tile-stone — đáng cân nhắc tiếp cho gallery lệch nhịp, ảnh dọc và parallax nhẹ; hợp khối hidden gems hơn danh mục điểm đến chính.
- **MERSI Architecture** — https://www.mersi-architecture.com/ / Awwwards: https://www.awwwards.com/sites/mersi — split-screen/clip-path và bố cục ảnh dọc rất có chất show-off; không nên đổi toàn site sang cuộn ngang vì rủi ro mobile và điều hướng lớn.
- **Alkemy Market** — https://alkemymarket.com/ / Awwwards: https://www.awwwards.com/sites/alkemy-market — chỉ giữ làm bài học kỹ thuật Three.js/microinteraction. Ripple nước đã thử rồi gỡ vì nhìn không hợp ảnh thật và dễ ăn mất thao tác cuộn một ngón trên mobile; không làm lại nếu chưa có concept khác đủ rõ.

**Các thay đổi đang cân nhắc cho lượt sau, theo thứ tự nên review:**

1. Mở vùng click cho card `/explore`, nhưng vẫn giữ semantic link/nút đúng và không làm nested interactive element. **Không áp dụng cho route card**: W5 đã biến nó thành bộ chọn nhiều chặng, cả thẻ không còn một đích duy nhất.
2. Đẩy theme riêng cho từng điểm đến bằng accent lấy từ ảnh (underline, số thứ tự, progress, quote) để khi chuyển Trang An → Cúc Phương → Phát Diệm có cảm giác đổi chương, không phải đổi template.
3. Thử một gallery hidden-gems bất đối xứng theo Marvell, ưu tiên ảnh dọc và parallax rất nhẹ; chỉ giữ nếu screenshot mobile không làm nội dung bị ép khung.
4. Thử split reveal bằng `clip-path` cho đúng một transition/khối ảnh theo MERSI, không biến nó thành hiệu ứng lặp khắp trang.
5. Sau khi chủ dự án chọn reference: review lại toàn bộ trang bằng screenshot Desktop + Pixel 7, đặc biệt mật độ chữ, khoảng trắng và vùng bấm; mọi hiệu ứng mới phải có reduced-motion và không chặn cuộn một ngón.

Chi tiết quan sát/kỹ thuật của từng reference vẫn nằm ở `docs/reference/REFERENCE_SITE_ANALYSIS.md`; danh sách trên chỉ là shortlist để ra quyết định nhanh, tránh hiểu nhầm rằng tất cả đều sẽ được triển khai.

**Bối cảnh git đáng ghi lại một lần:** dự án được làm trên hai máy, một máy dùng repo bọc ngoài + `git subtree` để đẩy (sinh hash commit khác dù nội dung giống hệt tại điểm đồng bộ 31/07), một máy clone thẳng repo này. Lịch sử tưởng như "không có tổ tiên chung" nhưng đã xác minh cây thư mục trùng khít tại thời điểm rẽ nhánh — không phải mất dữ liệu hay bị ghi đè. Máy bọc-ngoài từ nay chuyển sang clone thẳng như thế này để tránh lặp lại nhầm lẫn.

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

> ✅ **CUS-01 hoàn tất phần code ngày 18/08/2026:** migration `202608180039_customer_data_backbone.sql`, event contract, repository và `/api/customer-events`. PostgreSQL 15 thật đã apply migration sạch; transaction test chứng minh event lần đầu insert, gửi lại idempotent, collision/PII/direct write/history mutation bị chặn, identity digest+ciphertext và consent append-only ghi được; tất cả rollback sạch. Full gate: typecheck/lint/build pass, 72 file/513 test pass + 1 skip có chủ đích.
>
> **CUS-01 chưa live:** migration 039 chưa được apply/verify trên Supabase production và `CUSTOMER_DATA_INGESTION_ENABLED` chưa bật. CUS-02 đã có browser collector ở ngay dưới, nhưng build flag cũng mặc định tắt; push/deploy hiện không tự thu dữ liệu người thật và endpoint vẫn fail closed 503.
>
> ✅ **CUS-02 hoàn tất phần code ngày 18/08/2026:** `CustomerBehaviorTracker` chỉ chạy trên surface khách công khai; page/section/active dwell/scroll/CTA có semantic event, source whitelist và PII guard; tracking chỉ chạy khi build flag **và** analytics consent đều có. Dwell yêu cầu 50% visible + tab active/focus; người dùng im lặng 30 giây thì dừng cộng. CTA điều hướng dùng `sendBeacon`, event thường dùng `fetch keepalive`. Playwright build riêng bật flag + intercept API (không chạm DB) pass desktop và Pixel 7: không consent = 0 request; có consent = đủ event đúng shape. Full gate: typecheck/lint/build pass, 73 file/517 test pass + 1 skip. Chưa bật production.
>
> 🟦 **Việc kế tiếp — CUS-03: lưu anonymous intent `/plan` và Customer 360 ERP. Model khuyến nghị trước khi bắt đầu: `5.6 Terra / High`; nâng `5.6 Sol / High` nếu phải đổi migration/RLS/identity-consent contract.** Mục tiêu: khách thường tạo plan được persist ẩn danh thay vì `persisted:false`, ERP đọc timeline/provenance mà không cần contact. Không bắt đầu collector/CRM mới bằng Luna; Luna chỉ dùng fixture/test lặp sau khi luồng chính đã khóa.
>
> **Chưa live:** migration 039 chưa apply/verify Supabase production; `CUSTOMER_DATA_INGESTION_ENABLED` và `NEXT_PUBLIC_CUSTOMER_ANALYTICS_ENABLED` chưa bật. Consent hiện là contract local để kiểm collector; CUS-05 mới nối consent UI/history server-side. Bảng model toàn bộ CUS-00→CUS-08 ở `docs/plans/GOI_A_KE_HOACH.md` mục 9. Mỗi lần chuyển phase phải báo chủ dự án trước để đổi model thủ công nếu phiên không tự đổi được.

| # | ID | Việc | Ghi chú |
|---|---|---|---|
| — | **T14b** | ✅ **Danh bạ nhân sự đọc từ registry** | `lib/erp/staff-directory.ts` là nguồn duy nhất cho cả hai màn hình. **Phần khó không nằm ở danh sách:** `startRoleSwitch`/`endRoleSwitch` và nhánh cookie của `getCurrentErpUser` đều tra qua `findDemoErpAccountById`, nên chỉ đổi danh sách thì tên hiện ra mà bấm "Xem thử" vẫn báo "Không tìm thấy tài khoản" — đã thêm `resolveSwitchIdentity` tra ở cả hai kho. Registry **không giữ hồ sơ đào tạo**: tài khoản còn hồ sơ mẫu giữ nguyên giới hạn `trainedModuleIds`, tài khoản mới được mọi module `employeeAssignable` và màn hình nói thẳng là chưa có hồ sơ đào tạo. 8 unit test + `prod-smoke-t14b-directory.spec.ts` (tự dọn dẹp) + 3 spec hồi quy — **8/8 xanh trên production**, đã xác minh bằng SQL rằng cả 8 tài khoản thử đều `suspended` |
| — | **T15** | ✅ **Nhật ký tập trung: ai làm gì, theo tên và khu vực** | Migration `202608030033_erp_audit_timeline.sql` — **đã xác minh có trên production 05/08** (`supabase migration list --linked` khớp local/remote, 4 hàm `erp_audit_fill_actor_snapshot`/`erp_audit_viewer_scope`/`erp_audit_timeline`/`erp_headcount_by_site` đều tồn tại qua `pg_proc`). Trigger `before insert` chụp `actor_display_name`/`actor_job_title`/`actor_site_scope` trên 7 bảng nhật ký rời rạc, gộp qua RPC `erp_audit_timeline` thành một dòng thời gian, phạm vi nhìn tính ở máy chủ theo vai trò người xem. Màn hình `/erp/nhat-ky` đã nối vào cả nav desktop (`erp-shell.tsx`) lẫn mobile (`erp-mobile-menu.tsx`). Dòng cũ backfill có đánh dấu `actor_snapshot_at_write = false`. Có `tests/security/erp-audit-timeline-migration-contract.test.ts` + `tests/e2e/prod-smoke-t15-audit-timeline.spec.ts`. **Tài liệu này từng ghi sai là "còn thiếu" dù code đã đầy đủ từ commit `a3c9cc5` (03/08) — sửa lại đúng sự thật ngày 05/08, đúng bẫy #6 (một khái niệm chỉ được có một nguồn sự thật, kể cả giữa code và tài liệu bàn giao)** |
| — | **T17** | ✅ **Camera AI: kịch bản mô phỏng khai báo rõ** | Mục 2.7. Chủ dự án chọn hướng "script, không cắm API vì chưa có camera AI". Đã dựng `domain/erp-camera-ai.ts` (thuần tính toán, không chạm cơ sở dữ liệu), số = sức chứa thiết kế × hệ số tải, tất định theo khung 5 phút, kịch bản chỉ chạy cho giám đốc và **trần cứng 2 sự kiện**. 10 unit test + 4 e2e × 2 khổ màn hình, chạy cục bộ. **Nút tạo sự cố vẫn tắt.** Việc còn lại — nguồn đếm người thật (tích hợp camera hoặc nhân viên tự nhập) — tách thành **T17b**, chưa xếp hàng vì chưa cần cho vận hành |
| — | **T10b** | 🟡 **Đóng nốt đầu tiền mặt: nộp quỹ → ngân hàng → đối chiếu sao kê** | **Nhập tay xong, code + schema đã lên production 05/08 — chưa chạy round-trip thật với người dùng.** Migration `202608050034`/`202608050035` (`erp_bank_statement_lines`, `erp_cash_deposits`, `erp_cash_deposit_shifts`; RPC `erp_cash_submit_deposit`/`erp_cash_record_statement_line`/`erp_cash_match_deposit`/`erp_cash_decide_exception`/`erp_accounting_review_cash_deposit_journal`) nối vào đúng sổ kế toán dùng chung (`erp_accounting_journals`, khuôn migration 007 đã mở cho `supplier-invoice`) — khớp đúng số dựng bút toán Nợ 1121/Có 1111 ngay, lệch số tạo `exception` với người giải trình + hạn 24h, kế toán trưởng/giám đốc duyệt ngoại lệ kèm bút toán chênh lệch 1388/3388 đúng mã shift-close đã dùng, kế toán trưởng ghi sổ cuối (maker ≠ checker, ép ở cả bảng lẫn RPC). UI `components/erp/cash-deposit-reconciliation-center.tsx` nối vào `/erp/finance`, hỗ trợ kế toán tổng hợp nhiều cơ sở. **Đã xác minh:** schema/RPC tồn tại đúng trên production qua `pg_proc`/`pg_tables`/constraint thật (không suy đoán); 18 bài kiểm tra hợp đồng đọc thẳng SQL đã deploy; `typecheck`/`lint`/`test:run` (448 bài)/`build` sạch; **prod-smoke chỉ-đọc** (`prod-smoke-t10b-cash-reconciliation-ui.spec.ts`) xác nhận khối "Đối soát tiền mặt" dựng đúng trên production cho tài khoản `ketoan`, không lỗi runtime. **Chưa xác minh — round-trip ghi thật (nộp quỹ → khớp → ghi sổ) chưa chạy trên production**, vì cần dựng cả một chuỗi ca chốt → quản lý duyệt → kế toán lập bút toán → kế toán trưởng ghi sổ làm tiền đề (ca `posted` thật), và không có RPC hoàn tác — tạo một ca giả để test sẽ để lại một bút toán thật vĩnh viễn trong sổ. Việc này tách riêng có chủ đích, chưa xếp hàng. **Hai lỗi thật bắt được trước khi commit, không suy đoán:** (1) `<script dangerouslySetInnerHTML>` để gộp checkbox — script gắn qua `innerHTML` không chạy theo spec trình duyệt; (2) export một hằng số (`INITIAL_CASH_DEPOSIT_ACTION_STATE`) từ file `"use server"` — đúng bẫy #7/#11, qua lọt `next build` cục bộ nhưng vỡ thật trên production (`/erp/finance` bắt error boundary "Dữ liệu chưa thể đồng bộ") cho tới khi tự chạy prod-smoke thật mới bắt được, hoá ra là do `listEligibleShiftsForDeposit` dùng sai tên cột (`shift_code`/`business_date`/`station` thay vì `business_code`/`shift_date`/`station_code` — bẫy PostgREST runtime, TypeScript không bắt được). Nửa `bank-api` chưa có RPC nào — cột/constraint đã chừa chỗ nhưng **không được tuyên bố chạy được cho tới khi cắm credential ngân hàng thật**, còn chờ khách cho biết ngân hàng nào |
| — | **W5** | ✅ **Sửa định danh media + dựng lại route/index public** | **Đã lên production 07/08.** Ba cinematic đã ánh xạ lại bằng tiêu đề nguồn + frame thật; route đổi ảnh theo từng chặng; “Mười nơi nữa” thành split-screen sticky preview. Commit app `31419a4`, deployment `dpl_HU8nyRaynxFPgV7tRJy8kuMKrvgx`; smoke chi tiết ở mục 2.6 |
| — | **T11** | ✅ **Sức chứa thật + SOP Go/No-Go đã deploy/smoke** | T11a có ngưỡng theo mô hình vật lý và proxy T8. T11b có workflow quản lý gửi → giám đốc quyết định, critical fail chặn GO, risk acceptance bằng văn bản, row lock/version/idempotency/audit. Migration `038`, round-trip `ROLLBACK`, deployment `dpl_EDmSydtVcUTkBEJFEPf6gXFqtJ6A` và smoke 4/4 đã xác minh production; không để lại dữ liệu thử. SOP tổ chức chính thức và lịch diễn tập vẫn chưa có, không nằm trong tuyên bố hoàn tất này |
| 6 | **T6c** | **RLS thật thay cho service role + TypeScript** | Việc lớn nhất, dễ bỏ dở nhất, tách khỏi T6b có chủ đích. Viết lại 143 policy theo `erp_account_role_assignments`. Chỉ bắt đầu khi đủ thời gian đi hết |
| 7 | **T12** | **Dọn ~20 bảng chết của `/ops`** | ⛔ **DỪNG — đừng làm T12 lúc này.** Điều kiện cũ (T6/T7 chạy thật) đã đạt, nhưng khảo sát A0 ngày 17/08 phát hiện **~20 bảng "chết" đó chính là lớp khách hàng Gói A**: `capacity_slots`, `bookings`, `booking_lines`, `payment_intents`, `passes`, `redemptions`, `qr_sources`, `analytics_events`. Xoá trước khi Gói A thu hoạch xong thiết kế là mất trắng phần việc đã làm. Chi tiết ở `docs/plans/GOI_A_KE_HOACH.md` mục 1 |
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
| **`PHIEU_GIAO_VIEC_01_GOI_A.md`** | **Bắt đầu bất kỳ nhiệm vụ A0–A6 nào.** Đề bài gốc của Gói A (lớp khách hàng, thí điểm Tam Cốc) do chủ dự án giao 17/08/2026, kèm 7 dòng nghiệm thu đợt và 3 tình huống bắt buộc dừng lại hỏi |
| `CAC_DIEM_CAN_QUYET_DINH_TAM_COC.md` | Cần biết quyết định nào của chủ đầu tư đang chặn việc gì. 8 câu hỏi phía mình đã gửi, **chưa có câu trả lời**; điểm 2/6/8 chặn tiến độ trực tiếp |
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
