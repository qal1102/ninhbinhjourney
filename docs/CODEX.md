# CODEX — Nhật ký bàn giao Ninh Bình Journey

> File này là nguồn bàn giao chính thức giữa các cửa sổ trò chuyện Codex. Khi bắt đầu phiên mới, đọc toàn bộ file này trước khi sửa dự án. Sau mỗi thay đổi quan trọng phải cập nhật trạng thái và thêm một mục vào nhật ký cuối file.
>
> Thứ tự đọc bắt buộc: `AGENTS.md` → `docs/CODEX.md` → `docs/PLAN.md` → [`docs/DANH_GIA_HE_THONG_VA_GIAO_VIEC.md`](./DANH_GIA_HE_THONG_VA_GIAO_VIEC.md). CODEX ghi điều đã làm/trạng thái thật; PLAN ghi toàn bộ việc còn lại và tiêu chí để gọi là hoàn tất; file đánh giá ghi **chất lượng quy trình nghiệp vụ đang ở đâu** và danh sách việc ưu tiên (V1–V11) theo góc nhìn giám đốc kỹ thuật.

## Cập nhật gần nhất

- Thời gian: 01/08/2026 — múi giờ Asia/Saigon
- Production chính: https://ninhbinhjourney.vercel.app
- ERP: https://ninhbinhjourney.vercel.app/erp
- Production alias đang phục vụ: https://ninhbinhjourney.vercel.app — **giờ đã chạy source batch AP–NCC** (commit `bd105e4` + `331bb1d`, đã push lên `qal1102/ninhbinhjourney/main` ngày 31/07/2026). Vercel Git-integration tự tạo deployment `dpl_HfdkxgSwDubYZDE4Kt9YukegdxXK` (xác nhận qua `vercel inspect`, không phải đoán) và đã gắn alias production. Chỉ mới smoke ở mức HTTP status, **chưa** đăng nhập kiểm tra vai trò thật trên production.
- **[Claude Sonnet A — phiên ERP 31/07/2026]** Tiếp nhận working tree đã có sẵn G9.3 AP–NCC (domain/repository/server action/UI/2 migration) chưa commit từ trước; xác minh source thật, xác minh trực tiếp trên Supabase remote, viết bổ sung E2E multi-role còn thiếu, rồi commit. Phiên song song khác (cũng Claude Sonnet, do chủ dự án vận hành riêng) làm việc trên phần website công khai; hai phạm vi không giao nhau nhưng cùng chỉnh `docs/CODEX.md` nên các mục dưới đây chỉ nói về phạm vi ERP đã kiểm chứng trong phiên này.
- **[Claude Sonnet — phiên tiếp nối 31/07/2026, máy Windows sạch]** Clone lại `qal1102/ninhbinhjourney` từ GitHub vào máy mới (không có checkout cũ, không có `.secrets`/PAT nội bộ trên máy này). `git log`/`git status` xác nhận commit AP `bd105e4` **đã có sẵn trên `origin/main`** — sửa lại ghi chú "chưa push" ở các mục bên dưới cho khớp thực tế. Cài Node.js LTS + `npm install` sạch, chạy lại `typecheck`/`lint`/`test:run`/`build` từ đầu: phát hiện thật một test fail (`erp-accounting-migration-contract.test.ts`, case "seeds real role assignments...") do file migration 006 được lưu trong git với line ending CRLF trong khi test so khớp chuỗi có `\n` literal — không phải lỗi môi trường clone (đã xác nhận bằng `git diff` rỗng sau khi tắt `core.autocrlf` và `reset --hard`, chứng minh CRLF nằm sẵn trong blob đã commit). Sửa test để chuẩn hoá `\r\n` → `\n` ngay sau khi đọc file thay vì sửa migration hoặc nới lỏng nội dung kiểm tra; chạy lại toàn bộ: **169/170** (1 skip có điều kiện), khớp đúng con số CODEX từng ghi. `npm run build` qua sạch ra thẳng `.next` mặc định, không gặp lại `EPERM` đã ghi nhận trước đó (máy sạch, không có process khoá file). Đã sửa các dòng "chưa commit" còn sót trong mục "File quan trọng" và "Việc nên làm tiếp theo" bên dưới cho khớp trạng thái đã push thật. Sau khi chủ dự án tự đăng nhập GitHub trên máy này (Git Credential Manager, xác thực qua trình duyệt), đã push commit `331bb1d` lên `origin/main` thành công (`git fetch` xác nhận `origin/main` == `331bb1d`). Cài thêm Vercel CLI, đăng nhập bằng device-code flow (tài khoản `quanganh-1102`), `vercel link` vào `goldencard/ninhbinhjourney`, rồi dùng `vercel ls`/`vercel inspect` xác nhận Git-integration đã tự tạo deployment `dpl_HfdkxgSwDubYZDE4Kt9YukegdxXK` (Ready, target production) và alias `https://ninhbinhjourney.vercel.app` đã trỏ đúng deployment này. Smoke HTTP sau deploy: `/`, `/erp`, `/erp/login`, `/api/health` đều `200`; **chưa** đăng nhập vai trò thật để xác nhận `SupplierApControlCenter` hiển thị đúng dữ liệu Supabase trên production — việc này vẫn còn treo.
- Trạng thái kiểm tra local đã xác minh trong phiên này: `npm run typecheck` qua, `npm run lint` qua toàn bộ, `npm run test:run` qua **169/170** (1 skip có điều kiện, 27/28 file). Test riêng AP (`erp-supplier-ap.test.ts`, `erp-supplier-ap-action-guards.test.ts`, `erp-supplier-ap-migration-contract.test.ts`, `erp-ap-exception-routing-migration-contract.test.ts`) qua **21/21**.
- `npm run build` cục bộ trước đây fail với `EPERM: operation not permitted, unlink .next/...` (khóa file trên `.next`, nguyên nhân gốc chưa xác định — không phải do một cửa sổ Cursor cụ thể, đã loại trừ). Phiên này thêm lối vòng không phá hành vi mặc định: `next.config.ts` đọc `distDir` từ biến môi trường `NEXT_BUILD_DIST_DIR` (mặc định vẫn `.next` nếu không set). Build ra thư mục thay thế (`NEXT_BUILD_DIST_DIR=.next-build2 npm run build`) chạy sạch, xác nhận source không có lỗi build thật; đã thêm `.next-build*/**` vào ignore của ESLint (dòng ignore trong `.gitignore` đã có sẵn từ trước) vì lần đầu quên thêm khiến lint quét nhầm type helper sinh ra trong thư mục build thay thế, ra hơn 700 lỗi giả — đã sửa và lint lại sạch.
- **Đã xác minh trực tiếp trên Supabase remote (đọc RLS/grant/schema/row count, không sửa dữ liệu):** cả hai migration mới `202607290007_erp_supplier_ap_workflow.sql` và `202607300008_erp_ap_exception_routing.sql` đã được apply — 6 bảng `erp_ap_*`, các RPC (`erp_ap_submit_supplier_invoice`, `erp_ap_resubmit_supplier_invoice`, `erp_ap_escalate_supplier_invoice`, `erp_ap_decide_supplier_exception`, `erp_accounting_prepare_supplier_invoice`, `erp_accounting_review_supplier_invoice_journal`) chỉ cấp EXECUTE cho `service_role`/`postgres`, RLS bật trên cả 6 bảng, không có grant bảng cho `anon`/`authenticated`, trigger `erp_ap_route_exception_owner` tồn tại.
- **Đã chạy Playwright E2E multi-role thật trên Supabase remote (`tests/e2e/erp-supplier-ap-workflow.spec.ts`, dùng khóa runtime lấy tạm qua Management API, không ghi ra file):** quản lý bổ sung PO/nghiệm thu thiếu → kế toán nhận đúng hồ sơ; kế toán chuyển ngoại lệ tiền tệ trọng yếu (62 triệu) lên giám đốc → giám đốc chấp thuận → hồ sơ tự quay về kế toán → kế toán lập công nợ → kế toán trưởng ghi sổ độc lập. Do chạy thật, 2 hồ sơ seed đã bị đổi trạng thái vĩnh viễn trên remote: `AP-TA-202607-024` dừng ở "Chờ kế toán trưởng" (cố ý giữ để demo inbox, giống pattern journal điều chỉnh cũ), `AP-TC-202607-027` đã tới "Đã ghi nhận công nợ". Phát hiện trong lúc chạy: timeout mặc định 8s của assertion quá ngắn cho round-trip Server Action → Supabase RPC thật (đã tăng lên 20s cho các bước ghi thật trong spec); không phải lỗi sản phẩm.
- **Đã smoke đăng nhập vai trò thật trên production (`tests/e2e/prod-smoke-ap.spec.ts`, đọc-only, không bấm nút mutating):** kế toán (`ketoan`), kế toán trưởng (`ketoantruong`), giám đốc (`giamdoc`) và quản lý (`ql.vanhanh`) đều đăng nhập được và thấy đúng `SupplierApControlCenter`/`/erp/finance` với dữ liệu Supabase thật — `AP-TA-202607-024`, `AP-TC-202607-027` cùng sổ Nợ/Có cân đối (`959.200.000 đ`/`959.200.000 đ`) hiển thị đúng như đã ghi ở batch trước. **4/4 desktop-chromium pass.** Chưa xác minh: mobile-chromium project của bài E2E AP gốc (`erp-supplier-ap-workflow.spec.ts`) chưa chạy (bài đó mutating nên không lặp lại được trên cùng seed).
- Thay đổi trước đó (29/07, đã deploy): thay toàn bộ chín hồ sơ kế toán hard-code bằng journal thật trên Supabase; bổ sung kế toán trưởng/checker, sổ Nợ/Có, trả hồ sơ, ghi sổ, hoàn bút, bút toán điều chỉnh, khóa/mở kỳ và audit xuyên tài khoản.
- Trạng thái deploy: **batch AP–NCC (31/07/2026) giờ đã live** cùng với batch kế toán maker-checker (29/07/2026). Deployment `dpl_HfdkxgSwDubYZDE4Kt9YukegdxXK` đang `Ready` và là bản gắn alias production hiện hành, xác nhận qua `vercel inspect` — không phải suy đoán từ HTTP 200.
- Production smoke gần nhất: (1) trước batch AP — `/`, `/erp`, `/api/health` đều `200`; kế toán trưởng mở được `Kiểm soát & sổ cái`, thấy đúng journal chờ kiểm tra và nút `Duyệt và ghi sổ`; giám đốc mở được dashboard từ dữ liệu shared; Pixel 7 có hamburger và overflow ngang `0 px`. (2) sau khi deploy batch AP (phiên này) — chỉ mới smoke HTTP: `/`, `/erp`, `/erp/login`, `/api/health` đều `200`; **chưa** đăng nhập lại để xác nhận các màn hình vai trò cũ vẫn đúng và màn AP mới hiển thị đúng dữ liệu thật trên production.
- **[Claude Sonnet — audit + fix module giả 31/07/2026]** Theo yêu cầu chủ dự án, audit toàn bộ `components/erp/*.tsx` tìm hành động "trang trí" (không lưu bền, không xuyên tài khoản) kiểu nút "Giao quản lý kiểm tra" đã phát hiện ở Camera AI. Kết quả đầy đủ nằm trong nhật ký chi tiết bên dưới; tóm tắt: sự cố, dự án/sự kiện, quét QR vé và báo cáo ảnh ngoài kế hoạch đều giả (không server action/không lưu); **nguy hiểm hơn**, `attendance-panel.tsx` và `staff-access-manager.tsx` gọi Server Action thật, kiểm tra quyền đàng hoàng, nhưng chỉ ghi vào **cookie theo từng trình duyệt** — quản lý cấp quyền cho nhân viên xong nhân viên đăng nhập máy khác vẫn không có quyền đó. Đã sửa 2 module rủi ro cao này: thêm migration `202607310009_erp_staff_access_and_attendance.sql`, 2 repository mới (`lib/erp/staff-access-repository.ts`, `lib/erp/attendance-repository.ts`) theo đúng pattern `demo-cookie`/`supabase` sẵn có, nối vào `app/erp/actions.ts`. Đã áp dụng migration lên Supabase remote và xác minh RLS/grant qua CLI. Deploy (`dpl_78vsxc9N9b6gt7S5JvXbW3dNt2AX`) và smoke production đã hoàn tất sau đó cùng phiên (Playwright hai tài khoản tách biệt, `prod-smoke-staff-access.spec.ts`, 1/1 pass) — xem nhật ký chi tiết bên dưới, bao gồm một regression tự phát hiện (bảng quyền mới trống hoàn toàn) và migration seed sửa nó.
- **[Claude Sonnet — fix module rủi ro #2 (Sự cố) 01/08/2026]** Tiếp tục danh sách ưu tiên từ audit 31/07: `incident-workflow-workspace.tsx` (module "An toàn & sự cố") 100% giả — mọi chuyển trạng thái chỉ `setCases()` trên mảng hard-code, sinh lại mỗi lần mount. Đã xây `lib/erp/incident-repository.ts` (pattern `demo-cookie`/`supabase` như các repository khác) và migration `202607310011_erp_incidents.sql`: bảng `erp_incidents` (evidence/timeline lưu jsonb ngay trên row vì chưa có luồng thêm evidence và mỗi dòng timeline luôn ghi cùng lúc với chuyển trạng thái), RPC `erp_incident_manager_transition` (chỉ quản lý, đi đúng chuỗi reported → acknowledged → in-progress → verification → closed) và `erp_incident_employee_progress` (chỉ đúng nhân viên được giao, từ hồ sơ đang mở). Backend sự cố có sẵn (`app/api/incidents`, RPC `confirm_incident_draft`) thuộc hệ thống "operator run"/QR demo riêng (`demo_runs`), không có khái niệm tenant/site/giám đốc nên không nối vào được — xác nhận lại kết luận đã ghi trong audit 31/07. Đã áp dụng migration lên Supabase remote, xác minh trực tiếp: RLS bật, chỉ `service_role` có `SELECT`, hai RPC chỉ cấp EXECUTE cho `service_role`, 12 hồ sơ demo (3/cơ sở × 4 cơ sở) đã seed đúng. Đã push commit `354e994` lên `main`, Vercel tự deploy (`dpl_6V43vi4GxYPusfqtNG8L7CGNDbbo`, xác nhận `Ready`/production/alias qua `vercel inspect`). Đã smoke thật trên production bằng Playwright hai tài khoản tách biệt hoàn toàn (`tests/e2e/prod-smoke-incidents.spec.ts`): quản lý (`ql.vanhanh`) tiếp nhận `INC-TA-071` tại Tràng An → giám đốc (`giamdoc`) ở phiên đăng nhập khác (context trình duyệt riêng) thấy đúng trạng thái "Đã tiếp nhận" và dòng thời gian mới ghi tên thật của quản lý — **1/1 pass**, xác minh thêm trực tiếp qua `supabase db query` (`status=acknowledged`, `version=2`). Bài test này chủ đích thay đổi dữ liệu production vĩnh viễn một bước (giống tiền lệ `erp-supplier-ap-workflow.spec.ts`) vì luồng sự cố là state machine một chiều, không có RPC "revert". **Còn treo lúc đó:** `project-event-workspace.tsx`, QR scan (`ticket-guest-workspace.tsx`) và ảnh báo cáo ngoài kế hoạch (`field-report-workspace.tsx`) — cả QR scan và báo cáo ảnh đã được sửa ngay sau đó cùng ngày, xem mục bên dưới.
- **[Claude Sonnet — fix module rủi ro #3 (QR scan + báo cáo ảnh) 01/08/2026]** Tiếp tục danh sách ưu tiên từ audit 31/07: `ticket-guest-workspace.tsx` ("Quét và ghi nhận QR", chế độ check-in) chỉ kiểm tra độ dài mã rồi toast, không lưu; `field-report-workspace.tsx` ("Gửi báo cáo") build object rồi `setReports()` cục bộ, ảnh chỉ đọc base64 giữ trong state, không hề upload dù toast nói "đã chuyển quản lý". Đã xây `lib/erp/gate-scan-repository.ts` và `lib/erp/field-report-repository.ts` (pattern `demo-cookie`/`supabase` sẵn có) cùng migration `202607310012_erp_field_reports_and_gate_scans.sql`: bảng `erp_gate_scan_events` (RPC `erp_record_gate_scan`, tự gộp lượt quét trùng mã trong 2 phút thay vì ghi log trùng) và bảng `erp_field_operation_reports` (RPC `erp_submit_field_operation_report`) cộng bucket Storage riêng tư `erp-field-reports` (5 MB, chỉ ảnh JPEG/PNG/WebP/HEIC/HEIF) — tái dùng đúng mẫu private-bucket-plus-signed-URL đã chứng minh ở `erp-workday-evidence` (migration 202607290004).
  - **Va chạm tên phát hiện khi apply lần đầu:** migration fail với `column "report_code" of relation "erp_field_reports" does not exist` — hoá ra bảng `erp_field_reports` **đã tồn tại sẵn** trên remote (từ một migration rất sớm khác, dạng `reporter_user_id`/`work_item_id`/`progress_percent`/`image_paths[]`), nhưng không có code nào trong app đọc/ghi bảng đó — cùng dạng va chạm với `erp_attendance_events` ở migration 009. Transaction tự rollback sạch. Đổi tên bảng mới thành `erp_field_operation_reports`, apply lại thành công lần hai; thêm test khẳng định migration không chạm `public.erp_field_reports`.
  - Xác minh trực tiếp trên Supabase remote sau apply: RLS bật cả 2 bảng, chỉ `service_role` có `SELECT`, 2 RPC chỉ cấp EXECUTE cho `service_role`, bucket `erp-field-reports` đúng cấu hình (`public=false`, `file_size_limit=5242880`, đúng danh sách mime), 12 báo cáo demo đã seed.
  - Thêm 2 Server Action trong `app/erp/actions.ts` (`submitFieldReportAction`, `recordGateScanAction`) cùng khuôn kiểm tra vai trò/cơ sở/module như các action ERP khác (`submitFieldReportAction` còn kiểm tra `canSubmitFieldOperation(role)`). Chuyển `field-report-workspace.tsx` và `ticket-guest-workspace.tsx` từ tự sinh state cục bộ sang nhận dữ liệu qua prop server-fetch, gọi Server Action rồi `router.refresh()` — đúng pattern `attendance-panel.tsx`. Thêm khối "Quét gần nhất · toàn cơ sở" vào `ticket-guest-workspace.tsx` để tự chứng minh trực quan việc lưu bền xuyên tài khoản ngay trên UI.
  - Quality gate: `typecheck`/`lint` sạch, `test:run` **225/226** (207 gốc + 18 test mới, 1 skip có điều kiện), `build` qua sạch.
  - Commit `fae235b` đã push lên `main`; Vercel tự deploy (`dpl_AQfwdFZ8xAxtKyCYe9mY9dkxnyMN`, xác nhận `Ready`/production/alias qua `vercel inspect`).
  - **Đã smoke thật trên production bằng Playwright hai tài khoản tách biệt hoàn toàn** (`tests/e2e/prod-smoke-field-reports-and-gate-scans.spec.ts`, kèm ảnh PNG thật qua `setInputFiles`): (1) nhân viên (`nv.trangan`) gửi báo cáo ảnh tại Tràng An → giám đốc (`giamdoc`) ở phiên đăng nhập khác thấy đúng hồ sơ, đúng tên nhân viên, đúng nội dung; (2) nhân viên quét một mã QR → quản lý (`ql.vanhanh`) ở phiên khác thấy đúng mã trong "Quét gần nhất". **2/2 pass**, xác minh thêm trực tiếp qua `supabase db query`: báo cáo có `has_photo=true` (ảnh thật đã lên Storage, không chỉ base64 trong bộ nhớ), lượt quét QR đã ghi đúng người quét.
  - **Còn treo lúc đó:** `project-event-workspace.tsx` — mục cuối cùng trong danh sách audit 31/07, quy mô lớn hơn hẳn. Đã xây xong ngay sau đó cùng ngày, xem mục bên dưới.
- **[Claude Sonnet — xây module cuối cùng (Dự án & sự kiện) từ đầu 01/08/2026]** Mục cuối trong danh sách audit 31/07. Khác 3 mục trước (đều có sẵn 1 nút cụ thể để nối RPC thật vào), `project-event-workspace.tsx` **không có bất kỳ hành động nào cả, kể cả giả** — toàn bộ tĩnh hard-code. Theo yêu cầu chủ dự án, xây **đầy đủ theo đúng phạm vi PLAN.md mô tả** (không phải bản rút gọn): WBS ba cấp (sự kiện → nhóm việc → gói việc), dependency giữa các gói việc (chặn gửi nghiệm thu nếu còn phụ thuộc chưa xong), quy trình đổi phạm vi (quản lý gửi → giám đốc duyệt, áp thẳng vào ngân sách/ngày sự kiện khi duyệt), nghiệm thu kiểu maker/checker (người xác nhận hoàn thành phải khác người gửi nghiệm thu), và quyết toán chi phí thật (kế toán, chỉ cho gói việc đã hoàn thành + thuộc nhóm cần quyết toán, cộng dồn vào ngân sách sự kiện).
  - Trước khi code, đã dừng lại dùng chế độ lập kế hoạch (Plan mode) để trình bày thiết kế 7 bảng/5 RPC và xin xác nhận trước khi viết migration lớn, vì đây là quyết định kiến trúc nhiều hơn hẳn 3 lần sửa trước.
  - Thêm `supabase/migrations/202607310013_erp_project_workflow.sql`: 7 bảng (`erp_project_events`, `erp_project_milestones`, `erp_project_action_items`, `erp_project_work_item_dependencies`, `erp_project_change_requests`, `erp_project_settlements`, `erp_project_audit_events`) và 5 RPC. Cố ý đơn giản hơn workflow AP (không advisory lock, không idempotency-key command receipt) vì đây là dữ liệu quy mô demo, dùng pattern optimistic-version như incident/staff-access là đủ.
  - **Va chạm tên phát hiện khi apply lần đầu:** migration fail với `column "milestone_id" does not exist` — bảng `erp_project_work_items` **đã tồn tại sẵn** trên remote (từ một migration rất sớm khác, dạng `project_id`/`workstream`/`owner_user_id`/`evidence` jsonb, thuộc một bảng `erp_projects` riêng không dùng ở đây), không có code nào trong app đọc/ghi. Cùng dạng va chạm với `erp_attendance_events` (migration 009) và `erp_field_reports` (migration 012) — lần thứ ba gặp đúng kiểu lỗi này. Transaction tự rollback sạch, xác nhận không còn bảng nào bị tạo dở trước khi thử lại. Đổi tên bảng mới thành `erp_project_action_items`, apply lại thành công; thêm test khẳng định migration không chạm bảng cũ.
  - Thêm `lib/erp/project-repository.ts` (dual-mode `demo-cookie`/`supabase` như các repository khác) và `app/erp/project-actions.ts` (5 Server Action, file riêng theo đúng tiền lệ `supplier-ap-actions.ts`), cùng 5 capability mới trong `domain/erp-role-policy.ts` (`project.work.update`, `project.work.accept`, `project.change.request`, `project.change.decide`, `project.settlement.record`).
  - Viết lại hoàn toàn `project-event-workspace.tsx`: nhận dữ liệu qua prop server-fetch, giữ tinh thần thị giác bản gốc (banner nâu, 4 thẻ số liệu) nhưng thêm đủ khối hành động theo vai trò — cập nhật tiến độ/báo chặn/gửi nghiệm thu, xác nhận nghiệm thu, gửi/duyệt đổi phạm vi, ghi quyết toán.
  - Test mới: `tests/integration/erp-project-actions.test.ts` (18 case) và `tests/security/erp-project-workflow-migration-contract.test.ts` (10 case, gồm case khẳng định không đụng bảng `erp_project_work_items`/`erp_projects` cũ). Quality gate: `typecheck`/`lint` sạch, `test:run` **255/256** (225 gốc + 30 mới, 1 skip có điều kiện), `build` qua sạch.
  - Xác minh trực tiếp trên Supabase remote sau apply: RLS bật cả 7 bảng, chỉ `service_role` có `SELECT`/`EXECUTE`, seed đúng 4 sự kiện + 16 nhóm việc + 12 gói việc + 2 phụ thuộc mẫu, đã cấp module `du-an-su-kien` cho 1 nhân viên demo mỗi cơ sở (trước đó ở chế độ Supabase không ai có module này).
  - Commit `e79f178` đã push lên `main`; Vercel tự deploy (`dpl_A6f29LgWAMsL33NcAjfJ8NDscBmZ`, xác nhận `Ready`/production/alias qua `vercel inspect`).
  - **Xác nhận thật trên production bằng Playwright hai tài khoản tách biệt hoàn toàn** (`tests/e2e/prod-smoke-project-workflow.spec.ts`, viết để chạy lại an toàn nhiều lần — đọc trạng thái hiện tại thay vì giả định điểm xuất phát cố định): (1) nhân viên (`nv.trangan`) bắt đầu xử lý gói việc `EV-TA-041` tại Tràng An → quản lý (`ql.vanhanh`) ở phiên khác thấy đúng "Đang xử lý"; (2) quản lý gửi yêu cầu tăng ngân sách sự kiện → giám đốc (`giamdoc`) ở phiên khác duyệt → ngân sách sự kiện đổi đúng, nhìn thấy ở phiên giám đốc. **2/2 pass**, xác minh thêm trực tiếp qua `supabase db query` (`budget_billion=12.90`, `version=2`). Bài test đầu tiên fail vì đọc DOM ngay sau khi bấm Duyệt trong khi `router.refresh()` chưa kịp áp dụng — sửa bằng `expect.poll` thay vì đọc một lần; xác nhận qua truy vấn DB rằng RPC đã chạy đúng ngay từ lần đầu, lỗi chỉ ở khâu chờ UI, không phải lỗi sản phẩm.
  - **Trong lúc chờ deploy, chủ dự án tự phát hiện và nêu một vấn đề khác** (ngoài phạm vi audit "nút giả"): màn "Check-in khách" (`ticket-guest-workspace.tsx`) yêu cầu nhân viên quét/nhập mã QR nhưng **không đối chiếu với booking/pass thật** — `erp_record_gate_scan` chỉ kiểm tra độ dài chuỗi ≥ 6 ký tự rồi ghi log, không JOIN gì tới bảng `bookings`/`passes` của luồng đặt chỗ công khai (khách nhận QR Pass là token dài ngẫu nhiên từ `/pass/[token]`, hoàn toàn khác định dạng mã nhân viên được yêu cầu nhập). Đã khảo sát và xác nhận: đây là khoảng trống đã tự ghi trong PLAN.md từ trước (mục "Check-in khách": *"Chưa đối chiếu mã quét với vé/pass thật"*; mục G10.1 "Booking & Check-in" `[ ]` chưa bắt đầu) — không phải phát hiện mới, nhưng đúng và quan trọng. Chủ dự án chọn ưu tiên hoàn tất việc đang làm trước, xử lý booking/check-in ở phiên sau.
  - **Còn treo:** khoảng trống của từng module đã sửa (không có luồng tạo mới sự kiện/gói việc, chưa RCA/CAPA, chưa đối chiếu vé thật, v.v. — xem cột "Khoảng trống chính" trong bảng G10 của PLAN.md); và việc nối check-in ERP với booking/pass thật (G10.1) chưa bắt đầu.
- **[Claude Sonnet — V12 01/08/2026]** Sửa sơ đồ tổ chức tài khoản: mỗi cơ sở nay có đúng 1 quản lý (`ql.tamchuc`/`ql.tamcoc`/`ql.baidinh` thêm mới, `ql.vanhanh` thu về chỉ còn Tràng An), chứng minh được trên production rằng quản lý một cơ sở không vào được cơ sở khác. Chi tiết đầy đủ ở mục "Nhật ký thay đổi" bên dưới và mục 23 của file đánh giá. Trong lúc kiểm chứng ban đầu tưởng phát hiện thêm 2 lỗi (L17/L18) — **sau đó xác định L17 không có thật, do chính phiên làm việc quên set `PLAYWRIGHT_BASE_URL` nên Playwright âm thầm test nhầm vào server cục bộ thay vì production** (xem đính chính đầu tiên trong "Nhật ký thay đổi"); L18 là bug thật trong mã (đã sửa, đúng) nhưng chưa từng thực sự gây mất quyền trên production. V20 đã đóng, không cần làm.
- **[Claude Sonnet — V3 01/08/2026]** Xây xong chuyển vai trò demo cho giám đốc (đổi phiên đăng nhập thật, không phải cờ UI), đúng 5 điều kiện đã duyệt. Migration đã áp dụng lên Supabase production, cờ `ERP_DEMO_ROLE_SWITCH=true` đã bật, đã kiểm chứng 2/2 pass trên production thật. Chi tiết ở mục 24 file đánh giá.
- **[Claude Sonnet — V13 01/08/2026]** Sửa đồng hồ SLA sự cố (`elapsed_minutes` từng là số cứng ghi một lần lúc seed, không bao giờ tính lại — L8). Giờ tính tại thời điểm đọc từ cột `reported_at_ts` thật (đang mở thì chạy theo `now()`, đã đóng thì đông cứng theo `updated_at`). Áp 2 migration lên Supabase production (migration thứ hai tự sửa một lỗi neo mốc thời gian sai do chính migration thứ nhất gây ra, phát hiện bằng cách tự truy vấn lại production ngay sau khi apply — xem mục 25 file đánh giá). Đã xác nhận 2/2 pass trên production thật (desktop + mobile).
- **[Claude Sonnet — V4 01/08/2026]** Nối nút giả cuối cùng ở Camera AI (module cuối trong đợt audit "hành động trang trí" 31/07, L5) vào module Sự cố có sẵn thay vì xây bảng mới — cảnh báo mật độ do camera phát hiện tạo thành một hồ sơ `erp_incidents` thật (P3/P4, không chuyển cấp, chưa giao ai, đi đúng quy trình tiếp nhận có sẵn). Migration mới chỉ thêm 1 RPC, không đổi schema bảng. Đã xác nhận 2/2 pass trên production thật (desktop + mobile, ~21s). Chi tiết ở mục 26 file đánh giá.
- **[Claude Sonnet — V5 01/08/2026]** Chuông thông báo giờ là hộp thư thật theo từng loại việc (không còn 1 câu tổng hợp — L7/UX#2), không cần migration. **Phát hiện phụ quan trọng trong lúc kiểm chứng:** cookie phiên đăng nhập (`path: "/erp"`) chưa từng tới được `/api/erp/assistant` (path không khớp theo RFC 6265) — chuông thông báo **và** trợ lý điều hành bằng giọng nói/văn bản đều luôn nhận 401 trên production từ trước tới giờ, lỗi có thật, không phải do V5 gây ra, chỉ là chưa ai kiểm chứng runtime trước đây. Đã sửa `path` thành `/` cho đúng cookie phiên này. Quét lại 28 bài `prod-smoke-*` liên quan — 28/28 pass. Chi tiết ở mục 27 file đánh giá.

## Công việc đang dở — phải đọc trước khi sửa

1. Kế hoạch tổng thể nằm ở [`PLAN.md`](./PLAN.md). Nền Supabase của `G2` đã hoạt động; `G2` còn staging/health/rotate PAT. `G8` đã có cả checker/journal/reversal/period lock cho nguồn chốt ca. `G9.3` AP–NCC (nộp hóa đơn nhà cung cấp → đối chiếu PO/nghiệm thu → kế toán lập bút toán → kế toán trưởng ghi sổ → giám đốc quyết ngoại lệ tiền tệ) đã có domain/repository/server action/UI/2 migration trên remote, test cục bộ xanh và **E2E Supabase multi-role đã chạy thật, đã commit và đã push lên `main`**; còn **chưa deploy**. Việc kế tiếp thật sự vẫn là các nguồn còn lại của `G9`: thu chi/ngân hàng, hoàn ứng, lương, tài sản, hóa đơn và báo cáo quản trị; không dựng lại bằng số stock.
2. Migration `202607280003_erp_shift_close_workflow.sql`, `202607290004_erp_workday_lifecycle.sql`, `202607290005_erp_workday_resubmission_integrity.sql`, `202607290006_erp_accounting_maker_checker.sql`, `202607290007_erp_supplier_ap_workflow.sql` và `202607300008_erp_ap_exception_routing.sql` đã có trên remote (007/008 vừa được xác minh trực tiếp trong phiên 31/07); không chạy lại bằng thao tác thủ công.
3. Normal path, material exception, maker–checker, hoàn bút và lập bút toán điều chỉnh đã qua Supabase. Remote hiện cố ý giữ một bút toán điều chỉnh ở trạng thái chờ kế toán trưởng để có dữ liệu thật khi demo inbox.
4. Management PAT hiện nằm ngoài app tại `D:\Ninh Binh\ninhbinh\.secrets\supabase-management.pat`, bị root `.gitignore` chặn và ACL chỉ cho tài khoản máy hiện tại. PAT đã từng xuất hiện trong chat nên chủ dự án vẫn phải thu hồi/rotate; không sao chép nó sang source/docs/env.
5. Vercel Production đã có URL, publishable key, server secret, `ERP_PERSISTENCE_MODE=supabase`, production flags và site URL. Bucket riêng tư `erp-workday-evidence` đã có cho ảnh công việc; chưa có môi trường staging, trung tâm tài liệu chung hoặc health check connector.

## Mục tiêu sản phẩm đã chốt

Dự án gồm hai bề mặt tách biệt:

1. Trang công khai dành cho du khách tại `/` và các luồng khám phá, lập hành trình, đặt dịch vụ.
2. ERP nội bộ ẩn tại `/erp`, đăng nhập theo vai trò nhân viên, quản lý, kế toán và giám đốc. Người dùng chỉ thấy đúng cơ sở và nghiệp vụ được phân công.

ERP hướng tới giảm nhập tay và giảm số lần bấm khi vận hành các cơ sở Tràng An, Tam Chúc, Tam Cốc và Bái Đính. Màn giám đốc ưu tiên ngoại lệ, tài chính, khách, nhân sự, dự án và quyết định cần xử lý; không đưa lời giải thích nội bộ hoặc copy kiểu bản demo lên production.

Yêu cầu chất lượng mới đã chốt:

- Website công khai phải dùng tiếng Việt có cảm xúc, mời gọi và cụ thể như một lá thư về điểm đến; ERP phải dùng tiếng Việt nghiêm túc, đúng nghiệp vụ. Cả hai không dùng khẩu hiệu sáo rỗng hoặc câu robot.
- Sau khi nối Supabase, mọi module phải có dữ liệu dùng chung và hành động thật; không chấp nhận card/một dòng/nút trang trí.
- Mỗi vòng đời theo vai trò phải click được từ đầu đến cuối, lưu bền, đúng quyền và có audit.
- Mỗi module có nút `?` trợ giúp theo ngữ cảnh ở góc; chỉ mở khi người dùng cần, giải thích mục đích, vai trò, nguồn dữ liệu, bước trước/sau và thuật ngữ mà không làm rối UI chính.
- ERP phải hỗ trợ hồ sơ PDF, Excel, CSV, ảnh scan/camera, OCR và AI trích xuất có người xác nhận; không cho AI tự ghi sổ hoặc duyệt hành động nhạy cảm.

## Đọc trong 2 phút — dự án này là gì?

**Ninh Bình Journey** là một hệ thống gồm website du lịch cho khách và web quản trị nội bộ cho đơn vị vận hành nhiều khu du lịch. Hai phần dùng chung thương hiệu nhưng tách riêng về người dùng và mục đích:

| Phần | URL | Người dùng | Mục đích |
|---|---|---|---|
| Website công khai | `/` | Du khách | Khám phá điểm đến, lập hành trình, xem gói và đặt dịch vụ |
| ERP nội bộ | `/erp` | Nhân viên, quản lý, kế toán, giám đốc | Theo dõi và xử lý vận hành theo từng cơ sở |

ERP không phải một dashboard chung cho tất cả mọi người:

- **Nhân viên** chỉ thấy cơ sở và module được quản lý phân công; dùng để chấm công, check-in khách, nhận việc và gửi báo cáo/bằng chứng.
- **Nhân viên thời vụ** vẫn thuộc vai trò nhân viên nhưng có thời hạn truy cập, ca/trạm làm việc và danh sách module đã được đào tạo; khi hết hạn thì không còn quyền vào cơ sở/module.
- **Quản lý cơ sở** điều phối nhân viên, ca làm, hiện trường, sự cố, vé, tài sản và đối tác trong phạm vi được giao.
- **Kế toán** xem hồ sơ nguồn từ các cơ sở, kiểm tra chứng từ, chuẩn bị bút toán, đối soát, công nợ và đóng kỳ; không được dùng form tác nghiệp hiện trường.
- **Giám đốc** xem toàn vùng, tập trung vào số tổng hợp, ngoại lệ, việc cần quyết định, tài chính, khách, nhân sự và dự án; chỉ mở chi tiết khi cần.

Luồng demo ngắn nhất để hiểu hệ thống:

1. Mở `/erp`, đăng nhập tài khoản giám đốc.
2. Xem tổng quan khách, check-in, nhân sự, việc gấp, tài chính và trạng thái bốn cơ sở.
3. Bấm một cơ sở như Bái Đính hoặc Tam Chúc để mở các nhóm nghiệp vụ riêng của cơ sở đó.
4. Mở Camera AI, Tài chính, Nhân sự hoặc Dự án bằng menu hay trợ lý điều hành.
5. Đăng nhập quản lý, kế toán, nhân viên chính thức hoặc nhân viên thời vụ để thấy giao diện, phạm vi cơ sở và quyền đã thu hẹp theo trách nhiệm.

Ranh giới hiện tại phải nói rõ khi demo:

- Giao diện, phân quyền demo, navigation, responsive, PWA, voice command và các phép cân đối tài chính đã chạy và có kiểm thử.
- Dữ liệu doanh thu, khách, camera, dự báo và hồ sơ nghiệp vụ hiện là dữ liệu demo có chủ đích, chưa phải dữ liệu thật từ thiết bị hay phần mềm kế toán.
- Golden path chốt ca đã chạy trên Supabase cho cả normal path và material exception qua bốn vai trò. Return/resubmit, double-click và stale-version đã có bằng chứng E2E; remote outage/retry và checker/journal production vẫn chưa đủ để gọi toàn bộ workflow là hoàn tất.
- Vòng đời công việc trong ca đã chạy trên Supabase qua hai phiên đăng nhập riêng: giao việc, GPS/geofence, tiến độ, ảnh riêng tư, bàn giao, bản đồ quản lý và duyệt. Việc GPS nền, missed punch/OT/leave và payroll handoff chưa hoàn tất.
- Các thao tác ở sự cố, kế toán case cũ, ảnh, báo giá và nhiều module khác vẫn là client/local/demo state hoặc read-only; chưa có shared persistence đầy đủ.
- Supabase production runtime, Storage tài liệu, realtime thật và tích hợp camera/POS/QR vẫn phải hoàn thiện theo PLAN.

## Tài khoản demo hiện tại

| Vai trò | Tài khoản | Mật khẩu |
|---|---|---|
| Giám đốc | `giamdoc` | `Giamdoc@2026` |
| Quản lý Tràng An | `ql.vanhanh` | `Quanly@2026` |
| Quản lý Tam Chúc | `ql.tamchuc` | `Quanly@2026` |
| Quản lý Tam Cốc | `ql.tamcoc` | `Quanly@2026` |
| Quản lý Bái Đính | `ql.baidinh` | `Quanly@2026` |
| Nhân viên Tràng An | `nv.trangan` | `Nhanvien@2026` |
| Kế toán tổng hợp | `ketoan` | `Ketoan@2026` |
| Kế toán trưởng | `ketoantruong` | `Ketoantruong@2026` |
| Nhân viên thời vụ Tràng An | `tv.trangan` | `Thoivu@2026` |

Từ 01/08/2026 (V12), mỗi cơ sở có một quản lý riêng, `managedSiteIds` chỉ đúng 1 cơ sở mỗi người. Alias cũ `ql.trangan` vẫn đăng nhập được để không làm gãy kịch bản đã gửi trước đây, ánh xạ tới quản lý Tràng An (`ql.vanhanh`) — không còn phụ trách cả bốn cơ sở như trước.

## Những phần ERP đã có

### Tổng quan giám đốc

- Tổng quan mới chỉ cộng dữ liệu chốt ca, phiếu công việc và journal thật trong phạm vi bốn cơ sở; không còn dùng `ERP_FINANCE_REPORT`, workforce summary hay quyết định hard-code trên đường màn hình chính.
- Giám đốc thấy ngày nghiệp vụ mới nhất, số vé, doanh thu đã khai báo, chênh lệch ca, nhân sự/việc quá hạn, ngoại lệ cần giám đốc và hồ sơ chờ kế toán trưởng.
- Ma trận bốn cơ sở giúp đối chiếu doanh thu, vé, số hồ sơ ca và trạng thái công việc trong một lượt nhìn; bấm chi tiết đi thẳng tới đúng module/hồ sơ nguồn.
- Chi phí và lợi nhuận chỉ xuất hiện khi đã có journal ghi sổ vào đúng tài khoản. Nếu nguồn chưa đủ, hệ thống nói rõ chưa đủ dữ liệu thay vì dựng số dự báo hoặc lợi nhuận giả.

### Màn hình theo vai trò, workforce và kế toán

- Quản lý có dashboard riêng theo cơ sở: KPI ca hiện tại, hàng việc cần xử lý và độ phủ nhân sự gồm kế hoạch, đang trong ca, thời vụ và vắng mặt.
- Nhân viên thấy việc của mình, trạng thái vào/ra ca lấy từ dữ liệu chấm công của phiên, trạm làm việc, khung ca và thao tác nhanh phù hợp quyền.
- Nhân viên thời vụ có `employmentType`, ngày bắt đầu/kết thúc quyền, quản lý trực tiếp, trạm, ca và `trainedModuleIds`; quản lý chỉ được gán các module vừa thuộc nhóm cho phép gán vừa nằm trong danh sách đã đào tạo.
- Kế toán có `/erp/finance` riêng để nhận hồ sơ chốt ca đã được quản lý xác nhận, kiểm nguồn, lập journal cân Nợ/Có và gửi kế toán trưởng; không thể tự ghi sổ bút toán mình lập.
- Kế toán trưởng dùng cùng trung tâm kiểm soát để duyệt/trả, ghi sổ, hoàn bút, mở bút toán điều chỉnh và khóa/mở kỳ. Inbox, trial balance, sổ tài khoản và lịch sử đều đọc từ Supabase.
- Kế toán chỉ đọc các hồ sơ nguồn tại module nghiệp vụ. `module-workspace` hiện còn dùng adapter vai trò để ẩn một số form cũ; cần thay bằng capability check trực tiếp khi chuẩn hóa workflow.

### Golden path chốt ca đang triển khai

- Domain `domain/erp-shift-close.ts` định nghĩa hồ sơ, phép tính chênh lệch, journal đề nghị, hàng đợi và transition:
  - nhân viên gửi;
  - quản lý duyệt/trả;
  - kế toán nhận kiểm tra/ghi sổ/chuyển ngoại lệ/trả;
  - giám đốc chỉ duyệt hoặc trả ngoại lệ đã được kế toán chuyển cấp.
- `lib/erp/shift-close-repository.ts` có hai chế độ rõ:
  - `demo-cookie`: signed, compressed, HttpOnly, dùng chung qua logout/login trên cùng trình duyệt;
  - `supabase`: server secret, đọc bảng và gọi RPC atomic, không fallback ngầm nếu lỗi.
- `app/erp/workflow-actions.ts` kiểm user/site/module/ca/capability ở server; UI mới nằm tại `components/erp/shift-close-workflow.tsx`.
- Dashboard quản lý, kế toán và giám đốc đã đọc hàng đợi từ repository thay vì dùng quyết định tài chính/chênh lệch hard-code.
- Dữ liệu seed local/SQL gồm Tràng An chờ quản lý, Tam Chúc chờ kế toán và Bái Đính có ngoại lệ 18 triệu đồng.
- Migration 003 đã apply remote và contract test vẫn qua. RLS chặn anon/authenticated; hai RPC chỉ cho service-role; seed và audit đã được xác minh.
- Server Action trả về bản ghi đã commit để UI cập nhật ngay, thay vì chờ revalidate nhiều route. Thẻ hồ sơ dùng khóa ổn định theo `record.id`, giữ trạng thái mở khi version thay đổi để kế toán xử lý liên tiếp.
- Normal path Supabase đã qua: nhân viên gửi → quản lý duyệt → kế toán nhận kiểm tra → kế toán liên kết bút toán → nhân viên đọc lại trạng thái đã đối soát.
- Hồ sơ bị quản lý trả hiển thị nguyên nhân cho đúng nhân viên; nhân viên bổ sung nội dung rồi gửi lại cùng `record.id`, không tạo hồ sơ mới. Xác nhận gửi lại vẫn hiện sau refresh.
- Nhánh material exception Supabase đã qua: nhân viên gửi → quản lý trả → nhân viên gửi lại → quản lý duyệt → kế toán kiểm tra/chuyển cấp → giám đốc duyệt → kế toán ghi sổ. Double-click chỉ tạo một hồ sơ, quản lý giữ version cũ bị chặn và audit có đủ tám sự kiện.

### Vòng đời công việc trong ca

- `domain/erp-workday.ts` giữ state machine và audit của cùng một phiếu: `assigned` → `checked-in` → `in-progress` → `submitted` → `approved`; quản lý có thể trả về `manager-returned` và nhân viên gửi lại cùng `record.id`.
- `domain/erp-workday-catalog.ts` tách nhiệm vụ theo mô hình vận hành: Tràng An/Tam Cốc có bến và người chèo đò; Tam Chúc có xe điện, bến thuyền, Tam Quan Nội và khách xá; Bái Đính có xe điện, luồng chiêm bái và tiện ích công cộng.
- Quản lý chỉ giao được công việc thuộc cơ sở mình quản lý và module nhân viên đã được cấp/đào tạo. Mô hình dữ liệu và UI hỗ trợ một quản lý có nhiều cơ sở bằng bộ chọn site.
- Nhân viên chỉ đọc/chuyển phiếu của chính mình; phiếu cũ không được thao tác như việc hôm nay. Nhân viên hết hạn hoặc bị thu hồi site/module không thể nhận việc nhờ fallback quyền cũ.
- GPS check-in và các lần cập nhật bắt buộc độ chính xác hữu hạn trong `1–250 m`. `watchPosition` chỉ báo “đã đồng bộ” sau khi máy chủ xác nhận; phiếu bị trả mở lại theo dõi và lần gửi lại bắt buộc GPS/bằng chứng mới.
- Ảnh JPEG/PNG/WebP/HEIC tối đa 5 MB đi vào bucket riêng tư, dùng signed URL 10 phút. Object dùng UUID riêng, SHA-256 và `upsert: false`; không xóa ảnh khi kết quả transition còn mơ hồ.
- Máy chủ và trigger database kiểm lại tọa độ, miền latitude/longitude, độ chính xác, tuổi vị trí, geofence và tính bất biến của evidence. Copy chỉ nói “GPS của thiết bị lúc gửi ảnh”; browser GPS không chứng minh tuyệt đối ảnh được chụp tại đó hoặc chống giả vị trí.
- Quản lý phải thấy kết quả bàn giao, ảnh preview, metadata GPS và audit trước nút duyệt/trả. Sơ đồ vị trí được vẽ nội bộ; không gửi tọa độ chính xác của nhân viên sang OpenStreetMap.
- Migration 004 có bốn geofence, ba bảng workflow/audit/location, ba RPC service-role, optimistic version, idempotency và RLS. Migration 005 harden ảnh final/resubmit, accuracy và trạng thái trả lại; publication đã có nhưng UI hiện vẫn polling 20 giây, chưa được gọi là realtime subscription.
- Giới hạn phải nói đúng: web/PWA không bảo đảm theo dõi nền khi tab/app bị hệ điều hành tạm dừng. Chưa có consent version, retention/purge, audit ai mở vị trí, geofence theo từng trạm hoặc device attestation.

### Công nợ phải trả nhà cung cấp (AP) — đã commit/push, chưa deploy

- `domain/erp-supplier-ap.ts` định nghĩa hồ sơ hóa đơn NCC, đối chiếu 3 chiều (PO, nghiệm thu, hóa đơn) qua `evaluateSupplierApMatch`, đề nghị bút toán Nợ chi phí + thuế GTGT đầu vào (`1331`) / Có `331 — Phải trả người bán` qua `supplierApLiabilityProposal`, và `canActOnSupplierAp` khớp đúng owner theo từng trạng thái.
- Vòng đời: quản lý lập hồ sơ nguồn (PO/nghiệm thu/hóa đơn do quản lý khai báo, **chưa đối chiếu với một module PR/PO/nghiệm thu thật có persistence riêng** — hệ thống đó chưa tồn tại) → khớp tự động hoặc `match-exception` quay lại quản lý bổ sung → kế toán nhận, kiểm tra, lập bút toán (`ready-for-accounting`/`accounting-returned` → `accounting-review`) → kế toán trưởng ghi sổ hoặc trả → nếu ngoại lệ tiền tệ đạt ngưỡng vật chất, bắt buộc kế toán xác minh trước khi chuyển giám đốc quyết (`director-exception`), giám đốc trả về đúng owner nguồn.
- `lib/erp/supplier-ap-repository.ts` theo đúng pattern `demo-cookie`/`supabase` như các module trước, fail-closed khi thiếu cấu hình, không fallback ngầm.
- `app/erp/supplier-ap-actions.ts` kiểm actor/role/site/module/version/idempotency ở server trước mọi lệnh; test `tests/integration/erp-supplier-ap-action-guards.test.ts` xác nhận chặn: session hết hạn, role thiếu capability, quản lý ngoài site, supplier khác site, và chỉ đúng hành động được uỷ quyền cho từng vai trò.
- UI `components/erp/supplier-ap-control-center.tsx` đã thay hẳn `PartnerCommercialWorkspace` cũ tại module `doi-tac-nha-cung-ung` (menu "Đối tác & nhà cung ứng"). **`PartnerCommercialWorkspace` cũ là dữ liệu demo hard-code hoàn toàn** (mảng đối tác tĩnh, báo giá/hợp đồng/phản hồi khách/SLA không có backend) — bị xoá theo đúng nguyên tắc "không giữ chức năng trang trí" ở PLAN §2.2, không phải xoá nhầm. Hệ quả: module này hiện **chỉ còn phủ phía nhà cung cấp (AP)**; phần báo giá/hợp đồng/phản hồi khách hàng thương mại không còn UI nào, kể cả bản demo — nếu vẫn cần, phải làm lại thành workflow thật theo `PLAN.md` G10.7 dòng "Customer/partner follow-up, SLA phản hồi và sales pipeline".
- Đã nối vào tổng quan giám đốc (`executive-dashboard-live.tsx`: số hóa đơn NCC đã ghi nhận, giá trị chờ giám đốc quyết), trợ lý điều hành (`assistant/route.ts`: intent `supplier-payables`, đếm việc cần làm theo vai trò) và nút trợ giúp `?` theo vai trò (`module-context-help.tsx`).
- Test cục bộ đã qua: unit khớp/bút toán/owner (`tests/unit/erp-supplier-ap.test.ts`), integration action guard (`tests/integration/erp-supplier-ap-action-guards.test.ts`), contract tĩnh cho migration 007/008 (`tests/security/erp-supplier-ap-migration-contract.test.ts`, `tests/security/erp-ap-exception-routing-migration-contract.test.ts`) — tổng 21/21. E2E multi-role trên Supabase thật (`tests/e2e/erp-supplier-ap-workflow.spec.ts`, desktop-chromium) đã chạy — xem mục "Cập nhật gần nhất"; mobile-chromium cho bài này chưa chạy.
- Còn thiếu theo đúng `PLAN.md` G9.3: tách nguồn tiền mặt/POS/thẻ/chuyển khoản, giai đoạn thanh toán thật (payment proposal, dual approval, bằng chứng ngân hàng), và một module PR/PO/nghiệm thu có persistence để 3-way match đối chiếu với dữ liệu hệ thống thay vì số quản lý tự khai.

### Nghiệp vụ theo cơ sở

- Vé & đặt chỗ: doanh thu, số vé, cơ cấu sản phẩm, chính sách, giao dịch và chốt ca.
- Check-in khách: nhận mã QR từ đầu đọc/ô nhập, ghi nhận lượt qua cổng và ngoại lệ.
- Báo cáo hiện trường: nhân viên chụp/chọn ảnh, nhập công việc, tiến độ, vướng mắc và mã hạch toán; có modal xem chi tiết.
- Nhân sự & ca trực: chấm công GPS, phân quyền module, việc đang làm, deadline, kết quả, vé/doanh thu và bằng chứng theo từng người.
- An toàn & sự cố: workspace theo từng cơ sở có mức P1–P4, SLA, SOP, bằng chứng và timeline; nhân viên chỉ thấy hồ sơ được giao, quản lý điều phối vòng đời, giám đốc chỉ nhận ngoại lệ chuyển cấp. Trạng thái xử lý hiện vẫn là state cục bộ.
- Đối tác & nhà cung cấp: hồ sơ, hợp đồng, báo giá, công nợ, phản hồi khách, SLA nhân viên và chính sách sản phẩm.
- Camera AI: danh sách camera theo cơ sở, mở camera bằng click hoặc trợ lý; nguồn hình hiện vẫn là mô phỏng và phải được ghi rõ.
- Dự án & sự kiện: ngân sách, tiến độ, mốc hạn và việc khẩn.
- Tài chính chi tiết: `/erp/finance` cho sổ sâu, biểu đồ, cơ cấu, đối soát và dự báo đối với giám đốc; cùng URL mở bàn làm việc chứng từ–hạch toán đối với kế toán.

### Trợ lý và mobile

- Trợ lý điều hành dạng floating chat, hỗ trợ nhập văn bản và nhận giọng nói trên trình duyệt tương thích.
- Có thể mở trực tiếp tài chính, nhân sự, dự án, camera theo cơ sở/khu vực và báo cáo hiện trường.
- Menu desktop và hamburger mobile đã gộp thành 8 nhóm nghiệp vụ; URL module, deep-link, phân quyền và lệnh voice cũ được giữ nguyên.
- Các workspace ERP mới đã được kiểm tra không tràn ngang; nội dung dùng cuộn dọc.
- PWA manifest và service worker đã có.

## Trạng thái dữ liệu và Supabase

Quan trọng: production runtime đã bật Supabase cho chốt ca, vòng đời công việc/ảnh/GPS và journal kế toán. QR, báo giá, dự án, sự cố và phần lớn module khác vẫn là dữ liệu local/read-only; không được suy rộng rằng toàn ERP đã lưu bền hoặc realtime.

Supabase project đã được xác định trong lượt trước:

- Project ref: `vzewjfcwhovsxslqfpjt`.
- Trạng thái khi kiểm tra: `ACTIVE_HEALTHY`, vùng `ap-northeast-1`.
- Project URL: `https://vzewjfcwhovsxslqfpjt.supabase.co`.
- Không ghi API key/PAT vào tài liệu. Management PAT từng xuất hiện trong chat phải được rotate sau khi dùng.

Migration:

- `202607240001_secure_shared_core.sql`: đã apply remote sau khi sửa alias SQL `window` thành `opening_window`.
- `202607270002_erp_realtime_core.sql`: đã apply remote.
- `202607280003_erp_shift_close_workflow.sql`: đã apply remote ngày 28/07/2026.
- `202607290004_erp_workday_lifecycle.sql`: đã apply remote ngày 29/07/2026.
- `202607290005_erp_workday_resubmission_integrity.sql`: đã apply remote ngày 29/07/2026 sau preflight; xác minh trigger/function hoạt động, `service_role` được gọi location RPC còn `anon`/`authenticated` bị chặn và trigger function không gọi trực tiếp được.
- `202607290006_erp_accounting_maker_checker.sql`: đã apply remote ngày 29/07/2026; tạo registry tài khoản/vai trò, kỳ kế toán, journal header/lines, audit, command receipt và bốn RPC service-only.
- `202607290007_erp_supplier_ap_workflow.sql`: đã apply remote (xác minh trực tiếp bằng schema/RLS/grant query ngày 31/07/2026, chưa rõ ngày apply thật vì chưa có nhật ký gốc). Tạo 6 bảng `erp_ap_suppliers`, `erp_ap_posting_rules`, `erp_ap_supplier_invoices`, `erp_ap_supplier_invoice_lines`, `erp_ap_audit_events`, `erp_ap_command_receipts`; RLS bật cả 6 bảng, không grant cho `anon`/`authenticated`; các RPC nghiệp vụ (`erp_ap_submit_supplier_invoice`, `erp_ap_resubmit_supplier_invoice`, `erp_ap_escalate_supplier_invoice`, `erp_ap_decide_supplier_exception`, `erp_accounting_prepare_supplier_invoice`, `erp_accounting_review_supplier_invoice_journal`) chỉ cấp EXECUTE cho `service_role`; ràng buộc unique chặn hóa đơn trùng theo `(tenant, mã số thuế đã chuẩn hóa, series, số hóa đơn)`. Seed remote hiện có 4 supplier, 5 invoice, 5 dòng chi phí, 5 audit event.
- `202607300008_erp_ap_exception_routing.sql`: đã apply remote (xác minh cùng đợt 31/07/2026). Thêm trigger `erp_ap_route_exception_owner` trên `erp_ap_supplier_invoices`: ngoại lệ tiền tệ đạt ngưỡng vật chất bắt buộc kế toán xác minh trước khi lên giám đốc; giám đốc trả về sẽ quay lại đúng owner nguồn.
- Remote hiện có `erp_shift_close_workflows`, `erp_shift_close_audit_events`, seed ba workflow và hai RPC `erp_demo_create_shift_close`/`erp_demo_transition_shift_close`.
- Remote có thêm `erp_workday_workflows`, `erp_workday_audit_events`, `erp_workday_location_events`, bốn geofence, bucket riêng tư `erp-workday-evidence` và ba RPC workday.
- Migration 003 tạo `erp_shift_close_workflows`, `erp_shift_close_audit_events`, hai RPC atomic service-role, RLS/grant/revoke, optimistic version, idempotency và seed ba cơ sở.
- `tests/security/erp-shift-close-migration-contract.test.ts` có 9 contract test cho schema/RPC/quyền/transition/audit/seed.
- `types/database.generated.ts` đã cập nhật theo migration 003.

Runtime source:

- `.env.example` có `SUPABASE_SECRET_KEY` và `ERP_PERSISTENCE_MODE=demo-cookie`, không chứa giá trị thật.
- `ERP_PERSISTENCE_MODE=supabase` yêu cầu URL + server secret và fail closed nếu thiếu/lỗi.
- `demo-cookie` chỉ dùng cho demo cùng trình duyệt; không phải shared persistence đa thiết bị.
- Vercel Production đã cấu hình `NEXT_PUBLIC_SUPABASE_URL`, publishable key, `SUPABASE_SECRET_KEY` dạng sensitive, `ERP_PERSISTENCE_MODE=supabase`, production flags và site URL; không ghi giá trị secret vào tài liệu.
- Security Advisor trả 29 cảnh báo function-executable của schema cũ (22 authenticated, 7 anon); không cảnh báo nào thuộc bảng/RPC migration 003. Đây vẫn là backlog security của shared core, không được bỏ quên.

Chưa hoàn tất:

- Rotate Management PAT đã từng xuất hiện trong chat; file local hiện vẫn giữ ngoài repo để phục vụ quản trị có kiểm soát.
- Tạo staging tách biệt, health check và chính sách backup/restore.
- Supabase Auth/MFA/provisioning; hiện vẫn dùng signed demo session.
- Workday đã có bucket private, UUID và SHA-256; trung tâm tài liệu chung vẫn thiếu versioning, retention, scan/OCR và malware/content validation.
- Kế toán hiện đã có maker–checker/journal/period lock cho nguồn chốt ca; còn phải nối các nguồn ngân hàng, AP/NCC, lương, tài sản, hóa đơn và báo cáo quản trị.
- Tách `Shift/Attendance` khỏi `TaskAssignment`, hỗ trợ nhiều task/người/ca, bàn giao quản lý, consent/retention/access log GPS và geofence theo trạm.
- Các workflow khác vẫn local/read-only; Supabase core schema không tự động làm module hoạt động.

## Cấu trúc menu ERP đã triển khai

Navigation hiện nhóm các module như sau:

| Menu chính | Nội dung |
|---|---|
| Booking & Check-in | Vé, đặt chỗ, QR, lượt khách, chính sách và kết ca |
| Điều hành hiện trường | Sức chứa, Camera AI, báo cáo ảnh và phân luồng |
| An toàn & sự cố | Sự cố, cảnh báo, SOP, diễn tập và bàn giao |
| Nhân sự & ca làm | Phân công, chấm công, tiến độ, deadline và kết quả |
| Phương tiện & tài sản | Xe/thuyền, điều phối, bảo trì và tài sản |
| Dự án & sự kiện | Festival, ngân sách, tiến độ, deadline, nhà thầu và việc khẩn |
| Nhà cung cấp & công nợ | Đối tác bán hàng, NCC, báo giá, hợp đồng, nghiệm thu và công nợ |
| Tài chính & báo cáo | Doanh thu, chi phí, lợi nhuận, đối soát vé–tiền, so sánh và dự báo |

**Dự án & sự kiện** được giữ thành nhóm riêng vì theo dõi festival, ngân sách, deadline và việc khẩn là nhu cầu trọng tâm, không thuộc đúng ngữ nghĩa của tài sản hay nhà cung cấp.

Ranh giới cần giữ: đối soát NCC/hóa đơn thuộc Nhà cung cấp & công nợ; đối soát tiền quầy, POS, QR và vé bán thuộc Tài chính & báo cáo.

## Kiểm thử gần nhất

- `npm run typecheck`: qua.
- `npm run lint`: qua toàn bộ source.
- `npm run test:run`: **14 file, 97/97 unit/security test qua**.
- `npm run build`: qua với Next.js 16.2.11 sau thay đổi golden path/nav/runtime fix.
- Targeted E2E cho attendance, quản lý duyệt và golden path: **3/3 qua**.
- Full public + ERP + navigation E2E desktop/mobile: **57 pass, 0 fail, 11 skip**. Các lượt skip đúng điều kiện breakpoint hoặc chỉ áp dụng khi bật Supabase; không phải lỗi.
- Supabase normal-path integration E2E: **1/1 qua trong 14,9 giây** với ba browser context độc lập; cùng một mã ca đi từ nhân viên đến trạng thái kế toán đã ghi sổ rồi được nhân viên đọc lại.
- Supabase material-exception E2E: **1/1 qua trong 29,3 giây** với năm browser context cho bốn vai trò và một quản lý giữ version cũ; xác nhận double-click chỉ tạo một hồ sơ, return/resubmit dùng cùng mã, giám đốc là phê duyệt bắt buộc và audit có tám sự kiện.
- Navigation audit đo hình học và chụp ảnh ở 1024/1280/1440/1920 px: một hàng, panel nằm trong viewport, chỉ một nhóm mở; Tab/Enter/Escape và click ngoài đều qua.
- Lỗi `invalid-use-server-value` đã sửa; không còn global error page trong các hành động hợp lệ được bộ ERP E2E bao phủ.
- Production smoke sau deploy trên `https://ninhbinhjourney.vercel.app`: **12/12 qua** ở mobile và desktop.

## Kết quả audit vai trò, workflow và module

Hai tài liệu chi tiết:

- [`ERP_ROLE_MODULE_AUDIT_VI.md`](./ERP_ROLE_MODULE_AUDIT_VI.md): ma trận vai trò/quyền, mức trưởng thành workflow, đối chiếu chuẩn vận hành và thứ tự ưu tiên.
- [`ERP_ACCOUNTING_REQUIREMENTS_VI.md`](./ERP_ACCOUNTING_REQUIREMENTS_VI.md): yêu cầu kế toán Việt Nam áp dụng từ 2026, hồ sơ/chứng từ, maker–checker và các case demo đã xây.

Kết luận hiện tại:

- Tám nhóm menu đang hợp lý về mặt nghiệp vụ; không nên tiếp tục tăng số nhóm chỉ để làm demo trông lớn. Khoảng trống chính là chiều sâu và sự nối liền của workflow.
- Vai trò giám đốc, quản lý, kế toán, nhân viên chính thức và nhân viên thời vụ đã có màn hình/phạm vi khác nhau, nhưng action-level permission vẫn còn thô ở một số workspace; quản lý cơ sở hiện được thấy phần lớn module của cơ sở.
- Golden path vé/chốt ca normal path và ngoại lệ giám đốc đều đã qua Supabase; return/resubmit, double-click và stale-version đã có E2E. Chấm công chưa nối bảng lương; NCC/nghiệm thu chưa nối AP; dự án/tài sản chưa tự sinh chứng từ; sự cố vẫn dùng dữ liệu/state cục bộ.
- Luồng kế toán chốt ca đã có tài khoản checker, inbox và journal thật. AP/NCC, bảng lương, tài sản, hóa đơn và các quyết định vận hành khác vẫn chưa có workflow bền tương đương.
- Cấu trúc module phù hợp các mẫu doanh nghiệp lớn về RBAC, incident/SOP, time management, procurement–AP, asset lifecycle và management-by-exception ở mức thiết kế. Hệ thống chưa đạt mức production enterprise cho đến khi có dữ liệu dùng chung, tích hợp nguồn, phân quyền hành động, audit và vận hành ngoại tuyến/lỗi đầy đủ.

## File quan trọng

- `docs/PLAN.md`: backlog được đánh số, bảng đếm còn lại, tiêu chí ready và thứ tự bắt buộc.
- `components/erp/executive-dashboard.tsx`: tổng quan giám đốc.
- `components/erp/role-home-dashboard.tsx`: dashboard quản lý, nhân viên và kế toán theo vai trò.
- `components/erp/erp-desktop-navigation.tsx`: menu desktop một hàng, dropdown theo nhóm và xử lý keyboard/click ngoài.
- `components/erp/accounting-control-center.tsx`: hàng đợi maker/checker, journal, hoàn bút, kỳ kế toán, trial balance và sổ tài khoản.
- `components/erp/incident-workflow-workspace.tsx`: vòng đời sự cố theo vai trò.
- `components/erp/executive-finance-overview.tsx`: tài chính hợp nhất và drill-down theo kỳ.
- `components/erp/finance-dashboard.tsx`: màn tài chính chi tiết.
- `components/erp/module-workspace.tsx`: điều phối workspace theo module.
- `components/erp/field-report-workspace.tsx`: báo cáo ảnh hiện trường.
- `components/erp/ticket-guest-workspace.tsx`: vé, QR và chốt ca.
- `components/erp/partner-commercial-workspace.tsx`: đối tác, báo giá và phản hồi.
- `components/erp/staff-performance-workspace.tsx`: tiến độ nhân sự.
- `components/erp/voice-command-center.tsx`: trợ lý văn bản/giọng nói.
- `domain/erp.ts`: danh mục cơ sở, module và quyền mặc định.
- `domain/erp-role-policy.ts`: capability và phạm vi module theo vai trò.
- `domain/erp-accounting.ts`: domain journal/kỳ kế toán, kiểm cân Nợ/Có, quyền maker–checker và hoàn bút.
- `domain/erp-shift-close.ts`: domain golden path chốt ca, transition, queue và journal đề nghị.
- `domain/erp-navigation.ts`: tám nhóm menu và bộ lọc module theo quyền.
- `app/erp/workflow-actions.ts`: năm async server actions golden path, gồm action gửi lại hồ sơ bị trả; không còn export state/object.
- `domain/erp-shift-close-action-state.ts`: type và initial state dùng chung cho form/action, tách khỏi module `"use server"`.
- `components/erp/shift-close-workflow.tsx`: form/hàng đợi theo nhân viên, quản lý, kế toán, giám đốc.
- `lib/erp/shift-close-repository.ts`: persistence `demo-cookie`/`supabase`, version/idempotency/audit.
- `lib/erp/accounting-repository.ts`: đọc journal/kỳ/audit và gọi bốn RPC kế toán theo chế độ `demo-cookie`/`supabase`.
- `app/erp/accounting-actions.ts`: action máy chủ kiểm actor, role, site/module, version và idempotency trước mọi lệnh kế toán.
- `supabase/migrations/202607290006_erp_accounting_maker_checker.sql`: schema/RPC maker–checker đã apply và verify remote.
- `supabase/migrations/202607280003_erp_shift_close_workflow.sql`: schema/RPC golden path đã apply và verify remote.
- `tests/security/erp-shift-close-migration-contract.test.ts`: contract test migration 003.
- `domain/erp-operating-data.ts`: nguồn dữ liệu tài chính hợp nhất, workforce và dữ liệu vận hành demo.
- `tests/unit/erp-finance-data.test.ts`: kiểm thử cân đối tài chính.
- `tests/unit/erp-role-policy.test.ts`: kiểm thử capability/phạm vi role.
- `tests/unit/erp-accounting.test.ts`: kiểm thử hồ sơ và bút toán kế toán.
- `tests/unit/erp-workforce.test.ts`: kiểm thử quyền thời vụ/đào tạo.
- `tests/e2e/erp-access.spec.ts`: kiểm thử ERP và mobile.
- `docs/ERP_ROLE_MODULE_AUDIT_VI.md`: audit vai trò, workflow và module.
- `docs/ERP_ACCOUNTING_REQUIREMENTS_VI.md`: yêu cầu và case kế toán.
- `domain/erp-supplier-ap.ts`: domain đối chiếu 3 chiều, đề nghị bút toán phải trả và owner theo trạng thái AP — đã commit và đã push (`bd105e4`).
- `lib/erp/supplier-ap-repository.ts`: persistence `demo-cookie`/`supabase` cho hồ sơ AP — đã commit và đã push.
- `app/erp/supplier-ap-actions.ts`: server action kiểm actor/role/site/module/version/idempotency cho lệnh AP — đã commit và đã push.
- `components/erp/supplier-ap-control-center.tsx`: UI hàng đợi/hồ sơ AP theo vai trò, thay thế `partner-commercial-workspace.tsx` đã xoá — đã commit và đã push.
- `supabase/migrations/202607290007_erp_supplier_ap_workflow.sql`: schema/RPC AP — đã xác minh có trên remote, đã commit và đã push vào git.
- `supabase/migrations/202607300008_erp_ap_exception_routing.sql`: trigger định tuyến ngoại lệ AP — đã xác minh có trên remote, đã commit và đã push vào git.
- `tests/unit/erp-supplier-ap.test.ts`, `tests/integration/erp-supplier-ap-action-guards.test.ts`, `tests/security/erp-supplier-ap-migration-contract.test.ts`, `tests/security/erp-ap-exception-routing-migration-contract.test.ts`: test AP — đã commit và đã push.

## Việc nên làm tiếp theo

Danh sách đầy đủ và tiêu chí nghiệm thu nằm ở `docs/PLAN.md`. Thứ tự ngay trước mắt:

1. Batch AP–NCC đã commit, đã push (`bd105e4`, `331bb1d`, `a4b283d`) và **đã deploy production**, đã smoke đăng nhập 4 vai trò thật (`tests/e2e/prod-smoke-ap.spec.ts`, 4/4 pass) — coi như đóng vòng. Việc còn lại chỉ là mobile-chromium cho `erp-supplier-ap-workflow.spec.ts` gốc (không bắt buộc để tính là done, vì bài đó mutating và không lặp lại được trên cùng seed).
2. `G9.2, G9.4–G9.7`: nối nguồn thu/chi/ngân hàng, hoàn ứng, bảng lương, tài sản và hóa đơn vào cùng journal; AP đã có nền, còn thiếu giai đoạn thanh toán thật (payment proposal, dual approval, bằng chứng ngân hàng) và một module PR/PO/nghiệm thu có persistence riêng.
3. `G10.4/G10.6`: tách task khỏi ca/chấm công, hỗ trợ nhiều việc/người/ca và thay dữ liệu dự án/event stock bằng workflow Supabase thật.
4. Song song đóng phần còn lại của `G2`: rotate PAT, staging, health/backup; sau đó thực hiện `G3` audit nội dung và dữ liệu nguồn trước khi mở rộng module.

## Đánh giá tài liệu chuyên môn ngày 28/07/2026

Đã đọc `C:\Users\ADM\Downloads\Danh_gia_va_dinh_huong_demo_he_thong_Xuan_Truong.docx`. Nhận định tổng quát: tài liệu đúng hướng khoảng 80–85% nếu mục tiêu là polish một prototype để trình diễn năng lực; đây chưa phải quyết định triển khai tự động.

Các kết luận đúng và nên dùng làm tiêu chuẩn:

- Tách rõ chất lượng demo và mức sẵn sàng rollout.
- Không thêm module mới tràn lan; ưu tiên 3–5 workflow chạy trọn vòng đời.
- Nhóm lại menu, phân vai, progressive disclosure và mobile hiện trường.
- Dữ liệu mock phải dùng chung một nguồn, cộng khớp và liên kết chéo.
- Trợ lý phải tiến từ điều hướng/trả lời sang hiểu lệnh → preview → xác nhận → thực hiện → audit.
- Sự cố, tài sản, dự án, chứng từ cần hồ sơ, hành động, timeline và bằng chứng.

Những phần tài liệu đã lạc hậu so với source hiện tại:

- Tổng quan tài chính đã có Ngày/Tháng/Quý/Năm và drill-down tại chỗ.
- Vé, QR, hiện trường, nhân sự và đối tác đã có nhiều màn chi tiết/các form thao tác hơn thời điểm tài liệu đánh giá.
- Phân quyền theo tài khoản, cơ sở và module đã tồn tại; không phải mọi vai trò dùng cùng một dashboard.
- Mobile hamburger, PWA, voice fallback và kiểm thử E2E đã có.

Các vấn đề tài liệu nêu vẫn tồn tại thật:

- Menu quá dài đã được xử lý bằng tám nhóm nghiệp vụ; cần tiếp tục theo dõi usability khi có người dùng thật.
- Nhiều thao tác chỉ thay state/cookie trong phiên, chưa tạo workflow xuyên màn hình hoặc lưu bền.
- Trợ lý chủ yếu điều hướng/trả lời theo catalog, chưa có preview/xác nhận/thực hiện/audit.
- Ảnh báo cáo mẫu đang tái dùng ảnh phong cảnh của cơ sở thay vì bằng chứng đúng công việc.
- Lỗi nhiều nguồn tài chính đã được xử lý bằng `ERP_FINANCE_REPORT` và kiểm thử cân đối; dữ liệu vẫn là demo cho đến khi nối nguồn thật.
- Chưa có reset scenario, offline sync, trạng thái lỗi/loading/empty đầy đủ và ba workflow trọn vòng đời.

Các đề xuất không nên áp dụng máy móc:

- Điểm 7,1/10 và dự báo 8,8–9,2/10 là đánh giá chủ quan, không phải phép đo.
- Role switcher chỉ phù hợp công cụ demo ẩn; production phải giữ tài khoản và quyền thật như hiện tại.
- Không dùng một state machine duy nhất cho mọi nghiệp vụ. Sự cố/work order có thể dùng vòng đời chung, nhưng tài chính cần maker–checker; check-in/chấm công là event gần như bất biến.
- TanStack Query, MSW hoặc state-machine library là tùy chọn, không phải điều kiện bắt buộc. Chỉ thêm khi giúp hoàn thiện workflow cụ thể.
- Kế hoạch 14 ngày là tham khảo và khá tham vọng nếu muốn đạt đủ độ sâu, dữ liệu nhất quán, AI, mobile và kiểm thử.
- Phần đánh giá website công khai còn nông dù tài liệu ghi phạm vi gồm cả website và ERP.

## Quy trình cập nhật file này

Sau mỗi thay đổi quan trọng:

1. Cập nhật mục **Cập nhật gần nhất**.
2. Sửa các phần trạng thái bị ảnh hưởng; không chỉ thêm changelog.
3. Ghi test/build/deploy thực sự đã chạy.
4. Cập nhật mã việc/trạng thái/bằng chứng tương ứng trong `docs/PLAN.md`.
5. Nếu có quyết định chưa chốt, ghi rõ “chưa triển khai”.
6. Thêm một dòng vào **Nhật ký thay đổi** bên dưới, mới nhất ở trên.

## Nhật ký thay đổi

### 02/08/2026 — [Claude Opus] V15: sự cố quá hạn SLA tự chuyển cấp (việc đầu tiên trong hệ thống chạy theo thời gian)

- **Vấn đề (mục 10.2, L8):** V13 đã làm đồng hồ SLA chạy thật, nhưng chuyển cấp vẫn chỉ xảy ra khi có người bấm nút — ngược hoàn toàn với lý do SLA tồn tại, và là lý do KPI "phản ứng dưới 4 phút" của khách không đo được. Rộng hơn: trước migration này **không một thứ gì trong hệ thống xảy ra theo thời gian**.
- **Đã làm:** migration `202608020024_erp_incident_auto_escalation.sql` bật `pg_cron`, chạy `erp_incident_escalate_overdue()` mỗi phút. Đặt cờ `escalated`, ghi lý do có số liệu ("Quá hạn SLA 10 phút (trễ 78 phút)"), và ghi rõ **"Hệ thống"** là người thực hiện thay vì gán ngược lên một con người chưa từng chạm hồ sơ.
- **Cố ý không làm:** không đổi `severity` (chuyển cấp ≠ mức nghiêm trọng, tự nâng P3 thành P2 là làm sai lệch dữ liệu); không đụng `next_action` (thuộc máy trạng thái chuyển bước của quản lý). Áp dụng cả khi đang `in-progress` — quá hạn là quá hạn, kể cả khi đã có người xử lý.
- **Kiểm chứng, phần quan trọng nhất là nó tự chạy chứ không phải gọi tay:** sau khi áp migration **không gọi RPC bằng tay**; kiểm `cron.job_run_details` thấy job chạy đúng lịch, `status = succeeded`, và 4 sự cố `INC-*-069` quá hạn đã tự chuyển cấp (hộp thư giám đốc 4 → 8). **Tính bình đẳng khi chạy lại kiểm bằng thực tế:** sau nhiều lượt cron liên tiếp, 0 lượt lỗi, số dòng nhật ký của `INC-TC-069` giữ nguyên 4, số đã chuyển cấp giữ nguyên 8 — bộ lọc `escalated = false` hoạt động đúng (thiếu nó thì một ngày cron chôn lịch sử thật dưới 1440 dòng giống hệt nhau).
- `tests/e2e/prod-smoke-incident-auto-escalation.spec.ts` **6/6 pass** trên production; `typecheck`/`lint`/`test:run` (307 pass, +8 bài contract)/`build` sạch.
- **Giới hạn nói thẳng:** bài Playwright không chứng minh được việc job chạy đúng lịch (SLA ngắn nhất 5 phút, ngồi chờ trong test là vô lý) — bằng chứng phần đó nằm ở `cron.job_run_details`. Bài Playwright chứng minh phần trình duyệt thấy được: dữ liệu thật, đúng người thực hiện, có lý do dùng được, tới đúng vai trò.
- Đã đánh dấu `[x]` V15 ở mục 12, thêm mục 30 file đánh giá. **Đợt 2 chỉ còn V16 (Bàn giao ca).**

### 02/08/2026 — [Claude Opus] Kiểm toán 22 migration, dọn rác dữ liệu production và bắt các bài test tự dọn

- **Yêu cầu:** rà lại toàn bộ migration ("sai 1-2 cái là sai cả hệ thống"), kiểm tra spam và độ mượt. Kiểm trực tiếp trên Supabase production chứ không chỉ đọc file.
- **Phần lược đồ — sạch:** 22/22 migration đã áp dụng đúng thứ tự và khớp file repo; 22/22 nguyên khối `begin;`/`commit;`; RLS bật trên 100% bảng `public`; 143 policy nhưng **0 policy cho `anon`**; **0 function thiếu `search_path`**; toàn bộ RPC nghiệp vụ ERP chỉ `service_role` gọi được; cột `elapsed_minutes` bị xoá ở migration 015 **không còn RPC nào tham chiếu**. Bảng đời đầu (migration 001/002) vẫn giữ grant DML mặc định của Supabase cho `anon`/`authenticated` nhưng không khai thác được vì RLS bật và không có policy `anon` nào — ghi nhận, không phải lỗi.
- **Phần dữ liệu — có rác thật:** 13 yêu cầu đổi phạm vi `PROD-SMOKE...` đang chờ duyệt trong hộp thư giám đốc; 10 sự cố do bài test Camera AI tạo ở Tam Chúc (9 còn mở, thổi phồng KPI); ngân sách seed 12,8 tỷ của "Lễ hội Tràng An 2026" đã trôi lên 13,8 tỷ vì mỗi lần chạy cộng 0,1 và không trả lại; cả 3 sự cố seed của Tràng An bị một bài test đi một chiều đẩy hết sang `closed`.
- **Hậu quả cụ thể:** bảng điều khiển giám đốc chỉ hiện 4 mục đầu (`slice(0, 4)`, đúng thiết kế), nên 8 yêu cầu rác tồn đọng đã đẩy yêu cầu thật ra khỏi tầm nhìn và làm chính bài kiểm chứng đỏ. Rác che mất việc thật, không chỉ xấu.
- **Lỗi thật tìm được:** các bài test gọi `page.reload()` ngay sau Server Action — lần điều hướng cuối là POST nên reload gửi lại POST, sinh ra những cặp yêu cầu trùng cách nhau 15ms trong cơ sở dữ liệu. Đã đổi sang điều hướng tường minh.
- **Đã xử lý:** migration `019`–`022` (chỉ dữ liệu, điều kiện hẹp kiểm chứng được, không xoá theo khoảng thời gian, không truncate) xoá rác, khôi phục 3 sự cố Tràng An, đặt lại ngân sách 12,8 tỷ, giữ 1 yêu cầu thật cho demo. Sửa 4 bài prod-smoke để tự dọn: bài hộp thư tự từ chối yêu cầu nó tạo (khẳng định luôn là nó rời khỏi hộp thư — mạnh hơn bài cũ), bài ngân sách tự gửi yêu cầu trả lại con số cũ và duyệt nốt nên một lượt chạy cân bằng, bài Camera AI và bài sự cố tự đóng sự cố chúng mở, bài sự cố **tự tạo sự cố của mình** thay vì ăn dần dữ liệu seed.
- **Đã ghi quy tắc thường trực vào `AGENTS.md`** (hai mục mới: "A production test must clean up after itself" và "Leave the workspace clean") để phiên sau bắt buộc theo, kèm yêu cầu dọn artifact Playwright và tắt tiến trình nền/giải phóng cổng sau khi xong.
- **Gộp bài test để bớt tranh chấp:** `prod-smoke-incidents.spec.ts` đã được gộp vào `prod-smoke-camera-ai-incident.spec.ts`. Hai file cùng tạo và đóng sự cố ở Tam Chúc (cơ sở duy nhất có camera ở trạng thái "Cần chú ý", nên cả hai buộc phải dùng) đã đua với `prod-smoke-site-overview-kpis` — bài này đọc số "Sự cố mở" từ hai trang liên tiếp rồi so sánh. Giờ chỉ còn một bài ghi dữ liệu, và bài đối chiếu KPI đọc lại cặp số trước khi kết luận lệch: điều cần khẳng định là hai màn hình nói cùng một con số tại cùng một thời điểm, không phải production đứng yên trong lúc mình nhìn.
- **Trạng thái nền sau khi dọn, kiểm chứng bằng `supabase db query`:** 12 sự cố (đúng 3 mỗi cơ sở), 0 dòng camera test, 0 yêu cầu rác, 1 yêu cầu chờ duyệt thật, ngân sách Tràng An 12,80 tỷ.

### 02/08/2026 — [Claude Opus] V14: quản lý cơ sở được phân quyền thật

- **Vấn đề (mục 11.3, L13):** `demo-session.ts` gán thẳng toàn bộ 15 module cho mọi tài khoản `role === "manager"` ở mọi cơ sở họ phụ trách; `initialModuleIds` của cả 4 quản lý là `[]` và bị bỏ qua. Chỉ nhân viên mới thực sự bị phân quyền, và không có câu trả lời cho "cấp quyền cho quản lý thế nào?".
- **Đã sửa:** phạm vi cơ sở vẫn lấy từ sơ đồ tổ chức (`managedSiteIds`) vì đó là quyết định tổ chức, nhưng **danh sách module chuyển sang đọc từ `erp_employee_access`** — đúng kho mà nhân viên đang dùng. `staff-access-repository.ts` nay chứa cả quản lý; sàn lọc "không được `nhan-su`/`bao-cao`" thu hẹp lại thành chỉ áp cho nhân viên. Bộ quyền mặc định **khác nhau theo từng cơ sở** (13/13/12/13 module), **không quản lý nào có `bao-cao`** — phân tích toàn vùng thuộc giám đốc và kế toán. Giám đốc giữ nguyên toàn quyền.
- Màn hình `/erp/<cơ sở>/nhan-su` thêm khối "Quản lý phụ trách", **chỉ giám đốc thấy**. Server Action chặn hai đường leo thang: quản lý không sửa được quyền của bất kỳ quản lý nào kể cả của chính mình, và không cấp được quyền ở cơ sở họ không phụ trách.
- **Migration:** `202608020018_erp_manager_module_access_seed.sql` — chỉ dữ liệu, `on conflict do nothing`.
- **Kiểm chứng:** `typecheck`/`lint`/`test:run` (299 pass, +11 test mới)/`build` sạch → dry-run rồi áp migration lên production, xác minh trực tiếp qua `supabase db query` (đúng cơ sở, đúng số module, `bao-cao=false` cả bốn, bộ quyền thật sự khác nhau giữa các quản lý) → deploy Vercel Ready → Playwright thật trên production, bài mới `tests/e2e/prod-smoke-manager-module-grant.spec.ts`: **8/8 pass**. Quản lý Tràng An bị chặn `denied=module` ở `bao-cao`; quản lý Tam Cốc vào được `xe-trung-chuyen` nhưng bị chặn ở `sop-dien-tap` (cùng vai trò, khác quyền — đúng điều L13 nói là không làm được); giám đốc vẫn xem được tất cả và thấy khối cấp quyền hiện đúng "13/15 nghiệp vụ" đọc thật từ Supabase.
- Đã đánh dấu `[x]` V14 ở mục 12, thêm mục 28 file đánh giá.

### 01/08/2026 — [Claude Sonnet] V5: hộp thư "việc của tôi" theo vai trò, và một lỗi cookie có thật phát hiện được trong lúc kiểm chứng

- **Vấn đề (mục 6 UX#2, mục 11.7 L7):** chuông thông báo (`erp-app-controls.tsx`) chỉ gọi `intent: "urgent"` và hiện đúng 1 câu tổng hợp, không phải hộp thư có số đếm theo từng loại việc.
- **Đã sửa:** thêm `intent: "inbox"` mới vào `/api/erp/assistant` (giữ nguyên `intent: "urgent"` — `voice-command-center.tsx` vẫn dùng cho câu trả lời giọng nói, không đụng vào), trả về danh sách hạng mục thật theo vai trò (nhân viên/quản lý/kế toán/kế toán trưởng/giám đốc, mỗi vai trò 2-4 hạng mục cụ thể — chi tiết ở mục 27 file đánh giá). Không cần migration, chỉ gộp lại dữ liệu đã có sẵn cộng thêm `getIncidentCases`/`listPendingProjectChangeRequests` (đã xây từ V2).
- **Lỗi có thật phát hiện trong lúc kiểm chứng trên production:** chuông mãi báo "Chưa đọc được hàng việc lúc này." — truy ra bằng cách bắt request thật thấy cookie phiên đăng nhập hoàn toàn không có trong header `Cookie` của `/api/erp/assistant`. Nguyên nhân: `cookieOptions()` trong `demo-session.ts` đặt `path: "/erp"`; theo RFC 6265, cookie đó **không** khớp request `/api/erp/assistant` (path bắt đầu bằng `/api`, không phải `/erp`, dù chuỗi "erp" xuất hiện ở giữa). Lỗi này có từ trước, không phải do V5 gây ra — chỉ là chưa từng có bài Playwright nào đọc nội dung thật của chuông trên production. Hệ quả rộng hơn cả V5: `voice-command-center.tsx` (trợ lý điều hành, dùng chung endpoint) cũng luôn nhận 401 trên production.
- **Đã sửa:** đổi `path: "/erp"` thành `path: "/"` cho đúng cookie phiên này (các cookie dữ liệu demo-cookie khác giữ nguyên `/erp`, không ảnh hưởng production vì production chạy Supabase trực tiếp).
- **Kiểm chứng:** `typecheck`/`lint`/`test:run` (288 pass)/`build` sạch cục bộ → push → deploy Vercel production → Playwright thật trên production, bài mới `tests/e2e/prod-smoke-erp-inbox.spec.ts` (đối chiếu chéo số "Sự cố đã chuyển cấp" giữa chuông và dashboard giám đốc — hai đường tính khác nhau phải ra cùng một số, đúng tinh thần phòng lỗi kiểu L2): **2/2 pass**. Quét lại rộng hơn 7 file/28 bài `prod-smoke-*` để chắc chắn việc mở rộng `path` cookie không phá gì khác: **28/28 pass**.
- **Phát hiện phụ, không phải do sửa cookie:** `prod-smoke-role-switch.spec.ts` có lỗ hổng test có sẵn (chỉ thao tác đúng bản desktop của `RoleSwitchControl`, không mở hamburger trên mobile) — đã sửa bài test để chọn đúng vùng theo `page.viewportSize()` thay vì `isVisible()` (từng bị đua thời gian dưới tải song song). Không đụng mã sản phẩm.
- Đã đánh dấu `[x]` V5 ở mục 7, thêm mục 27 file đánh giá. Đợt 2 (V4+V5) đã xong hoàn toàn.

### 01/08/2026 — [Claude Sonnet] V4: nút giả cuối cùng ở Camera AI

- **Vấn đề (mục 3 file đánh giá, L5):** `camera-ai-workspace.tsx`'s `createAction()` chỉ gọi `setActionMessage()` — nút "Giao quản lý kiểm tra"/"Tạo phiếu hiện trường"/"Báo quản lý" không đi qua Server Action nào, không lưu bền, không ai khác thấy. Đây là nút đã khởi động cả đợt audit "hành động trang trí" 31/07; các module khác đã sửa trước, đây là module cuối cùng còn lại.
- **Đã sửa theo đúng khuyến nghị mục giao việc V4:** nối vào module Sự cố có sẵn (`erp_incidents`) thay vì xây bảng mới. Migration `202608010017_erp_incident_camera_report.sql` thêm RPC `erp_incident_report_from_camera` (không đổi schema bảng nào). Mọi hồ sơ tạo từ camera luôn ở mức P3 (camera "Cần chú ý") hoặc P4, **không chuyển cấp**, **chưa giao ai** — quản lý tiếp nhận qua đúng luồng `reported → acknowledged → in-progress → verification → closed` có sẵn, không có đường tắt hay cấp độ riêng nào cho nguồn camera.
- `lib/erp/incident-repository.ts` thêm `reportIncidentFromCamera` (đúng khuôn dual-mode demo-cookie/Supabase như mọi hàm khác trong file); `app/erp/actions.ts` thêm `reportIncidentFromCameraAction` (kiểm tra vai trò/cơ sở/module `su-co` giống 2 action sự cố đã có); `camera-ai-workspace.tsx` gọi action thật, có trạng thái chờ.
- **Kiểm chứng:** `typecheck`/`lint`/`test:run` (288 pass, +13 test mới)/`build` sạch cục bộ → dry-run rồi áp migration lên Supabase production, xác nhận trực tiếp qua `supabase db query --linked` (RPC `SECURITY DEFINER`, chỉ `service_role`/`postgres` có `EXECUTE`) → push → deploy Vercel production → Playwright thật trên production (`PLAYWRIGHT_BASE_URL` set tường minh), bài mới `tests/e2e/prod-smoke-camera-ai-incident.spec.ts`: **2/2 pass** (desktop + mobile, ~21–22s) — quản lý Tam Chúc tạo phiếu từ camera "Cần chú ý" → phiên trình duyệt hoàn toàn mới thấy đúng hồ sơ trong module Sự cố. Xác nhận thêm qua `supabase db query`: hồ sơ thật, `severity=P3`, `escalated=false`, `assignee_id=null`.
- **Lưu ý cho phiên sau:** Tràng An có `capacityPercent=68%` nên không camera nào ở trạng thái "Cần chú ý" (ngưỡng là `>= 80%`) — mọi kiểm chứng luồng này phải dùng Tam Chúc (83%).
- Đã đánh dấu `[x]` V4 ở mục 7, thêm mục 26 file đánh giá. Đợt 2 giờ chỉ còn V5 (hộp thư "việc của tôi").

### 01/08/2026 — [Claude Sonnet] V13: đồng hồ SLA sự cố chạy thật

- **Vấn đề (mục 10.2 file đánh giá, L8):** `elapsed_minutes` trên `erp_incidents` là số nguyên ghi cứng một lần lúc seed, không bao giờ tính lại; `reported_at` chỉ là chuỗi hiển thị "HH:MM" không có ngày, không đủ để tính lại thời gian trôi qua. Một sự cố báo từ nhiều ngày trước vẫn hiển thị "còn 1 phút" mãi mãi, và không có cách nào tự phát hiện quá hạn.
- **Đã sửa:** migration `202608010015_erp_incident_sla_clock.sql` thêm cột `reported_at_ts timestamptz` (mốc thời gian báo cáo thật), backfill một lần từ `elapsed_minutes` cũ rồi xoá hẳn cột đó. `lib/erp/incident-repository.ts` giờ tính `elapsedMinutes` **tại thời điểm đọc**, ở đúng một chỗ (`withLiveElapsed`): đang mở thì `now() - reported_at_ts` (chạy thật), đã đóng thì `updated_at - reported_at_ts` (đông cứng đúng lúc đóng — hai RPC chuyển trạng thái đã sẵn `updated_at = now()` ở mọi bước). Áp dụng cho cả 2 chế độ lưu trữ (demo-cookie và Supabase).
- **Tự phát hiện và tự sửa một lỗi ngay trong lúc làm:** migration 015 backfill `reported_at_ts = now() - elapsed_minutes`, dùng thời điểm chạy migration làm mốc — sai với hàng nào có `updated_at` thật đã nằm xa hơn trong quá khứ (ví dụ sự cố đã đóng từ lúc seed migration 011 ngày 31/07). Kiểm tra lại ngay bằng `supabase db query --linked` sau khi apply 015 phát hiện `reported_at_ts` đứng sau `updated_at`, phép trừ ra âm bị kẹp về 0, hiển thị sai "Hoàn tất trong 0 phút". Đã viết thêm migration `202608010016_erp_incident_sla_clock_backfill_fix.sql` neo lại đúng vào `updated_at` của từng hàng, dùng quy ước hậu tố id `-071/-069/-064` để khôi phục đúng offset gốc (4/7/6 phút).
- **Kiểm chứng:** `typecheck`/`lint`/`test:run` (275 pass, +8 test hợp đồng migration mới)/`build` sạch cục bộ → dry-run rồi áp cả 2 migration lên Supabase production, xác nhận trực tiếp qua `supabase db query --linked` (cột `elapsed_minutes` đã biến mất; sự cố đã đóng đúng 6 phút cố định; sự cố đang mở đúng ~1170 phút đã trôi qua kể từ lúc seed hôm 31/07 — bằng chứng đồng hồ chạy thật) → push → deploy Vercel production → Playwright thật trên production (`PLAYWRIGHT_BASE_URL` set tường minh trong cùng lệnh), bài mới `tests/e2e/prod-smoke-incident-sla-clock.spec.ts`: **2/2 pass** (desktop + mobile, 4.7–5.3s).
- Việc còn lại của L8 chưa nằm trong V13: tự động chuyển cấp khi quá hạn SLA (cần cơ chế chạy nền/cron) — đây là V15, chưa làm.
- Đã đánh dấu `[x]` V13 ở mục 7 và mục 12, thêm mục 25 file đánh giá.

### 01/08/2026 — [Claude Sonnet] Đính chính: L17 không tồn tại — lỗi tự kiểm chứng của chính phiên trước; xây xong V3

- **Đính chính quan trọng cho mục ngay bên dưới ("Sửa L18... xác nhận L17 là lỗi hệ thống"):** toàn bộ kết luận "L17 là lỗi hệ thống nghiêm trọng" trong mục đó là **sai**, do chính phiên làm việc trước tự gây ra khi kiểm chứng, không phải lỗi sản phẩm. Chi tiết đầy đủ ở mục 23.3 file đánh giá; tóm tắt: mọi lệnh `npx playwright test` điều tra "L17" đều **thiếu `PLAYWRIGHT_BASE_URL`**, nên Playwright âm thầm dựng và chạy nhắm vào server cục bộ (chế độ `demo-cookie`, trạng thái sống trong cookie riêng từng trình duyệt theo đúng thiết kế — không có gì để chia sẻ giữa các phiên) thay vì production thật. Phát hiện ra nhờ debug V3 (biến `ERP_DEMO_ROLE_SWITCH` luôn đọc rỗng dù đã set đúng trên Vercel — mâu thuẫn này lộ ra là đang test nhầm server) và đối chiếu thời gian chạy (các bài "L17" chạy 1–3 giây, đặc trưng loopback cục bộ; cùng bài chạy đúng cách trên production mất 10–20 giây).
- Đã chạy lại **cả 6 bài** từng bị đánh dấu `test.fixme()` với `PLAYWRIGHT_BASE_URL=https://ninhbinhjourney.vercel.app` tường minh — **cả 6 đều PASS thật trên production.** Đã bỏ `test.fixme()` và mọi ghi chú sai trong 4 file: `prod-smoke-project-workflow.spec.ts` (2 bài), `prod-smoke-director-decision-inbox.spec.ts`, `prod-smoke-staff-access.spec.ts`, `prod-smoke-field-reports-and-gate-scans.spec.ts` (2 bài). Cũng chạy lại đúng cách `prod-smoke-site-overview-kpis.spec.ts` (V12) để xác nhận không bị ảnh hưởng bởi cùng lỗi — 4/4 pass với thời gian thực (5–17s), kết luận V12 vẫn đứng vững.
- **L18 vẫn là một bug thật trong mã nguồn** (đọc thấy trực tiếp trong `updateEmployeeAccessAction`, không phụ thuộc môi trường test) và **fix vẫn đúng, vẫn giữ** — nhưng kết luận "nv.trangan đã mất quyền trên production" là sai, cùng nguyên nhân môi trường test ở trên (server cục bộ khởi tạo từ `initialModuleIds`, trước khi sửa chưa có `du-an-su-kien`). Đính chính: đây là vá phòng ngừa một lỗi có thật nhưng **chưa từng xảy ra trên production**, không phải khắc phục sự cố đã xảy ra.
- **V20 (tìm nguyên nhân gốc L17) đóng lại — không cần làm nữa**, vì L17 không tồn tại.
- **Bài học ghi lại, đọc trước khi chạy Playwright nhắm production ở bất kỳ phiên nào sau này:** luôn viết tường minh `PLAYWRIGHT_BASE_URL="https://ninhbinhjourney.vercel.app"` trong **cùng lệnh** gọi `npx playwright test` — công cụ Bash không giữ biến môi trường giữa các lệnh nên phải set lại mỗi lần, không set một lần rồi dùng lại được. Thiếu biến này, Playwright không báo lỗi gì cả, chỉ âm thầm chạy nhắm vào local. Nghi ngờ ngay nếu một bài "production" chạy xong dưới 2 giây.
- **Đã xây xong và kiểm chứng V3** (chuyển vai trò demo cho giám đốc) trong cùng phiên, đúng 5 điều kiện đã chốt ở mục 5 file đánh giá — chi tiết đầy đủ ở mục dưới đây và mục 24 file đánh giá.
- Đã sửa mục 23 file đánh giá thành bản đúng (không xoá bản cũ, viết thêm phần đính chính rõ ràng ngay trong mục 23.2/23.3), đánh dấu `[x]` V3 trong mục 7, thêm mục 24.

### 01/08/2026 — [Claude Sonnet] V3: chuyển vai trò demo cho giám đốc — phiên đăng nhập thật, không phải cờ UI

- Xây theo đúng 5 điều kiện chủ dự án đã duyệt trước đó (mục 5 file đánh giá): (1) đổi thẳng `userId` trong cookie phiên ký sẵn sang tài khoản đích, giữ id giám đốc gốc ở trường mới `actingAsFor` — không phải biến vai trò hiển thị, nên mọi kiểm tra quyền có sẵn (`accountCanAccessSite`/`accountCanAccessModule`) áp dụng y hệt như tài khoản đó tự đăng nhập; (2) chỉ giám đốc, chỉ khi `ERP_DEMO_ROLE_SWITCH=true`, kiểm tra lại ở tầng thấp nhất (`startRoleSwitch` trong `demo-session.ts`) chứ không chỉ ẩn nút; (3) băng thông báo cố định trên mọi trang khi đang xem thử, có nút quay lại; (4) ghi nhật ký mọi lượt chuyển vào bảng Supabase riêng; (5) không cấp thêm quyền nào — dùng đúng luồng đọc quyền sẵn có.
- File mới: `lib/erp/role-switch-audit-repository.ts` (dual-mode demo-cookie/supabase theo đúng pattern mọi repository khác), `components/erp/role-switch-control.tsx` (chọn tài khoản, chỉ giám đốc thấy), `components/erp/role-switch-banner.tsx` (băng cố định), `supabase/migrations/202608010014_erp_role_switch_audit.sql` (bảng `erp_role_switch_audit` + RPC `erp_record_role_switch`, RLS/grant cùng khuôn mọi migration khác). Sửa `lib/erp/demo-session.ts` (thêm `actingAsFor` vào session payload, `startRoleSwitch`/`endRoleSwitch`/`isRoleSwitchEnabled`, `CurrentErpUser.actingAs`), `app/erp/actions.ts` (`switchDemoRoleAction`/`endRoleSwitchAction`), gắn control vào `erp-shell.tsx` (desktop) và `erp-mobile-menu.tsx` (di động).
- Test mới: `tests/integration/erp-demo-role-switch.test.ts` (7 case, chạy thật `startRoleSwitch`/`endRoleSwitch`/`getCurrentErpUser` với `next/headers` giả lập cookie, không mock chính logic cần kiểm — xác nhận chặn khi tắt cờ, chặn khi không phải giám đốc, chặn chuyển sang giám đốc khác, chặn chuyển chồng, và xác nhận quyền tài khoản đích áp dụng đúng thật sự thu hẹp so với giám đốc), `tests/security/erp-role-switch-audit-migration-contract.test.ts` (5 case). Sửa 3 test tích hợp cũ (`erp-staff-access-and-attendance-actions.test.ts`, `erp-incident-actions.test.ts`, `erp-field-report-and-gate-scan-actions.test.ts`) để mock thêm `startRoleSwitch`/`endRoleSwitch`/`role-switch-audit-repository` vì `app/erp/actions.ts` import tĩnh.
- Quality gate: `typecheck`/`lint` sạch, `test:run` **267/268** (255 gốc + 12 mới, 1 skip có điều kiện), `build` qua sạch. CRLF dính ở `erp-mobile-menu.tsx`/`erp-shell.tsx` khi Edit ghi trên máy Windows (như nhiều lần trước) — đã chuẩn hoá trước khi build lại.
- Áp dụng migration lên Supabase production qua `npx supabase db push` (dry-run trước, chỉ đúng 1 migration mới); xác minh trực tiếp bằng `supabase db query --linked`: RLS bật, chỉ `service_role` có `SELECT` trên bảng, chỉ `service_role`/`postgres` có `EXECUTE` trên RPC, `anon`/`authenticated` không có gì.
- Bật `ERP_DEMO_ROLE_SWITCH=true` trên Vercel production (`vercel env add`, môi trường Production) sau khi chủ dự án xác nhận làm cả migration lẫn bật cờ trong cùng lượt — commit `755e0d9` đã push trước đó, deploy lại (`vercel --prod`) để áp dụng biến môi trường mới.
- **Xác nhận thật trên production, đúng cách với `PLAYWRIGHT_BASE_URL` tường minh** (`tests/e2e/prod-smoke-role-switch.spec.ts`): quản lý không thấy nút "Xem theo vai trò" (giám đốc mới thấy); giám đốc chuyển sang xem như `nv.trangan` → bị chặn `/erp/tam-chuc` (chưa được phân công cơ sở) và `/erp/trang-an/nhan-su` (chưa được cấp module) đúng y hệt nhân viên thật, có băng thông báo tên+vai trò+tên giám đốc, quay lại giám đốc khôi phục đầy đủ quyền toàn vùng. **2/2 pass.**
- Chưa làm: màn hình đọc lại nhật ký chuyển vai trò (đã ghi bảng, chưa có UI xem) — đủ dùng cho demo/kiểm toán trực tiếp qua Supabase, chưa cấp thiết.
- Đã đánh dấu `[x]` V3 trong `docs/DANH_GIA_HE_THONG_VA_GIAO_VIEC.md` (mục 7), thêm mục 24 ghi chi tiết.

### 01/08/2026 — [Claude Sonnet] Sửa L18 (quyền module bị âm thầm xoá); xác nhận L17 là lỗi hệ thống, không riêng module Dự án — cần quyền Supabase để điều tra tiếp

> ⚠️ **Đã đính chính ở mục ngay phía trên (cùng ngày).** Kết luận "L17 là lỗi hệ thống" trong mục này **sai** — nguyên nhân là lỗi tự kiểm chứng (thiếu `PLAYWRIGHT_BASE_URL`), không phải lỗi sản phẩm. Giữ nguyên mục này làm hồ sơ đầy đủ, không xoá.

- Theo yêu cầu chủ dự án "fix hết mấy cái đó đi", tiếp tục 2 phát hiện phụ ghi ở phiên V12 trước (mục 23 file đánh giá).
- **L18 — đã sửa.** Nguyên nhân: `updateEmployeeAccessAction` (`app/erp/actions.ts`) dựng lại toàn bộ `moduleIds` chỉ từ các checkbox mà `staff-access-manager.tsx` hiển thị được (giao của `employeeAssignable` và `trainedModuleIds` tĩnh trong `demo-data.ts`) — module nào được cấp ngoài tập đó (như `du-an-su-kien`, seed thẳng vào Supabase khi xây module Dự án, chưa từng có trong `trainedModuleIds`) sẽ bị xoá ở lần lưu tiếp theo cho nhân viên đó, vì bất kỳ lý do gì. Đã sửa action để giữ nguyên các module không hiển thị được thay vì xoá; thêm `du-an-su-kien` vào `trainedModuleIds`/`initialModuleIds` của 1 nhân viên mỗi cơ sở để ô "Dự án" hiện ra được. Xác nhận trên production: ô "Dự án" của `nv.trangan` đã tự hiện ra và đang tick (quyền vẫn còn trong Supabase, chỉ là form không hiển thị/không giữ được trước khi sửa) — lưu lại một lần để chốt; `nv.trangan` vào `/erp/trang-an/du-an-su-kien` và bấm "Bắt đầu xử lý" thành công.
- **L17 — điều tra thêm, phạm vi lớn hơn nhiều so với ghi nhận ban đầu.** Rà lại 4 bài `prod-smoke-*` khác từng có "X/X pass" trong CODEX các phiên trước (`prod-smoke-project-workflow.spec.ts` cả 2 bài, `prod-smoke-staff-access.spec.ts`, `prod-smoke-field-reports-and-gate-scans.spec.ts` cả 2 bài) — **tất cả đều fail cùng một kiểu**: dữ liệu ghi ở một phiên đăng nhập chỉ đọc lại được bởi chính phiên đó (kể cả F5 thật), phiên khác — kể cả cùng tài khoản, trình duyệt khác — không bao giờ thấy, dù chờ 45+ giây. Đây không còn là lỗi riêng module Dự án mà là lỗi ở tầng đọc/ghi Supabase dùng chung cho toàn bộ ERP.
- Thử điều tra sâu hơn bằng cách gọi thẳng Supabase REST/RPC, bỏ qua Next.js/Vercel hoàn toàn — **bị chặn**: `vercel env pull` tải được `.env` production nhưng `SUPABASE_SECRET_KEY` bị Vercel đánh dấu "sensitive" nên chỉ trả về placeholder `[SENSITIVE]`, không phải khoá thật; đây là giới hạn nền tảng của Vercel (không cho đọc lại biến môi trường nhạy cảm qua CLI sau khi tạo), không phải việc có thể lách qua từ phiên làm việc này.
- Đã đánh dấu `test.fixme()` cho toàn bộ 6 assertion bị ảnh hưởng (2 file mới: `prod-smoke-staff-access.spec.ts`, `prod-smoke-field-reports-and-gate-scans.spec.ts`), kèm ghi chú nguyên nhân + liên kết tới mục 23 file đánh giá ngay trong từng file — không xoá, không ép qua.
- Kiểm chứng L18: `typecheck`/`lint`/`test:run` (255 pass)/`build` sạch cục bộ, không dính CRLF lần này → push → `vercel inspect` xác nhận deployment mới **Ready** → xác nhận trực tiếp trên production bằng thao tác qua UI thật (không phải chỉ đọc code).
- Đã cập nhật mục 23 file đánh giá: đánh dấu `[x]` V21 (L18), viết lại L17 với bảng 6 bài test bị ảnh hưởng và kết luận **V20 (tìm nguyên nhân gốc L17) cần chủ dự án cấp quyền Supabase Dashboard hoặc khoá `service_role` thật** — không thể tự điều tra thêm từ phiên này. Đã nêu rõ V20 là ưu tiên cao nhất hiện tại, cao hơn V3, nhưng theo chỉ đạo tiếp tục làm việc, chuyển sang V3 trong lúc chờ quyền truy cập; V3 (đổi phiên đăng nhập thật) không bị ảnh hưởng bởi L17 vì đó là đổi danh tính đang đăng nhập, không phải đọc lại dữ liệu đã ghi ở phiên khác.

### 01/08/2026 — [Claude Sonnet] Sửa V12: mỗi cơ sở một quản lý riêng; phát hiện 2 lỗi có sẵn không liên quan trong lúc kiểm chứng

- Tiếp tục danh sách ưu tiên sau khi V1/V2 xong. Chọn **V12** (sơ đồ tổ chức tài khoản, L14) — `manager-trang-an` trước đây có `managedSiteIds` bằng cả 4 cơ sở và cả 6 nhân viên đều báo cáo về đúng một quản lý đó, nên "quản lý chỉ thấy cơ sở mình phụ trách" chưa từng chứng minh được trên production.
- `lib/erp/demo-data.ts`: thu `manager-trang-an` (`ql.vanhanh`/`ql.trangan`) về đúng Tràng An; thêm `manager-tam-chuc` (`ql.tamchuc`), `manager-tam-coc` (`ql.tamcoc`), `manager-bai-dinh` (`ql.baidinh`), mỗi người đúng 1 cơ sở; sửa `supervisorId` của 3 nhân viên Tam Chúc/Tam Cốc/Bái Đính về đúng quản lý cơ sở mình; sửa `jobTitle` từ "Quản lý vận hành toàn vùng" thành "Quản lý vận hành {cơ sở}". Không cần migration Supabase — danh tính tài khoản là mảng TS tĩnh, quyền module nhân viên vẫn đọc Supabase như cũ qua `getAccessState()`.
- Sửa ăn theo cho nhất quán: `role-home-dashboard.tsx` (dòng tiêu đề chỉ nói "toàn vùng · N cơ sở" khi thật sự > 1 cơ sở, trước đó luôn nói vậy kể cả với nhân viên/quản lý 1 cơ sở); `managerAccountId` trong seed AP demo-cookie cục bộ ở `supplier-ap-repository.ts` (trước hard-code `"manager-trang-an"` cho mọi cơ sở, chỉ ảnh hưởng chế độ demo-cookie, không phải production); khối gợi ý tài khoản trên `/erp/login`.
- Viết lại `tests/unit/erp-workforce.test.ts` — bài cũ khẳng định chính sơ đồ sai (một quản lý vùng, không có `ql.tamchuc`/`ql.tamcoc`/`ql.baidinh`) là hành vi đúng; nay khẳng định mỗi cơ sở có đúng 1 quản lý và mọi nhân viên báo cáo đúng người quản lý cơ sở mình.
- Rà tác động phụ trước khi đổi: `tests/e2e/erp-access.spec.ts` (bài lớn nhất dùng `ql.trangan`) toàn bộ chỉ thao tác trong Tràng An nên không cần sửa. Sửa 2 bài `prod-smoke-*` có thao tác quản lý ở Bái Đính/cả 4 cơ sở để dùng đúng quản lý cơ sở tương ứng; thêm bài mới trong `prod-smoke-site-overview-kpis.spec.ts` khẳng định trực tiếp cách ly (quản lý Tam Chúc bị chặn ở `/erp/trang-an` và ngược lại) — logout giữa các lượt đổi tài khoản trong cùng bài dùng `context.clearCookies()` thay vì bấm nút UI (đáng tin hơn khi đổi 4 tài khoản liên tiếp).
- Kiểm chứng: `typecheck`/`lint`/`test:run` (255 pass)/`build` sạch cục bộ (CRLF xuất hiện lại ở 5 file khi Edit ghi trên máy Windows, đã chuẩn hoá `\r\n`→`\n` trước khi build lại) → push → `vercel inspect` xác nhận deployment `dpl_FM4z1ZGBSfgfSjv4iS95u2ZzPjoW` **Ready** → Playwright thật trên production: `prod-smoke-site-overview-kpis.spec.ts` **4/4 pass** (gồm bài cách ly mới).
- **Phát hiện tình cờ, không do V12 gây ra — đã điều tra kỹ để loại trừ:** khi dựng lại `prod-smoke-director-decision-inbox.spec.ts` với tài khoản quản lý Bái Đính mới, bài "quản lý gửi yêu cầu đổi phạm vi → giám đốc thấy ở phiên khác" fail. Tái hiện y hệt với `ql.vanhanh`/Tràng An (tài khoản, cơ sở hoàn toàn không đổi) và độc lập trên `prod-smoke-project-workflow.spec.ts` (file không sửa dòng nào, trước đó CODEX từng ghi 2/2 pass) → **L17: yêu cầu đổi phạm vi dự án chỉ hiện lại với đúng phiên vừa gửi, phiên khác (kể cả cùng tài khoản, context mới) không bao giờ thấy dù chờ 45+ giây**, dù route xác nhận `Cache-Control: no-store`/`X-Vercel-Cache: MISS` (không phải cache) và RLS đọc cho `service_role` là `using (true)` (không phải quyền). Chưa tìm ra nguyên nhân gốc, cần truy cập log/connection Supabase trực tiếp. Mức độ nghiêm trọng cao vì đây đúng là cơ chế V2 (hộp thư quyết định giám đốc) và module Dự án dựa vào.
- Cùng lúc phát hiện **L18: `nv.trangan` đã mất quyền module `du-an-su-kien`** trên production, và giao diện `staff-access-manager.tsx` không thể cấp lại — vì ô "Dự án" không nằm trong `trainedModuleIds` tĩnh của bất kỳ nhân viên nào, nên form chỉ gửi lại đúng các ô nó hiển thị và **âm thầm xoá quyền ẩn** ở bất kỳ lần lưu nào. Quyền đó được seed thẳng vào Supabase khi xây module Dự án (không qua UI), không đồng bộ vào `trainedModuleIds`.
- Đã đánh dấu `test.fixme()` cho 3 assertion bị ảnh hưởng (2 trong `prod-smoke-project-workflow.spec.ts`, 1 trong `prod-smoke-director-decision-inbox.spec.ts`) kèm ghi chú nguyên nhân ngay trong file — không xoá, không ép qua bằng thủ thuật test.
- Đã đánh dấu `[x]` V12 trong `docs/DANH_GIA_HE_THONG_VA_GIAO_VIEC.md` (mục 12), thêm mục 23 ghi chi tiết V12 + L17/L18, thêm việc mới **V20** (tìm nguyên nhân gốc L17, ưu tiên cao ngang V3) và **V21** (L18).

### 01/08/2026 — [Claude Sonnet] Sửa V1: KPI trang tổng quan cơ sở dùng số đếm thật hoặc nói thẳng "chưa có nguồn dữ liệu"

- Tiếp tục danh sách ưu tiên từ file đánh giá sau khi xong V2. Chọn **V1** — 5 thẻ KPI ở `app/erp/[site]/page.tsx` (trang đầu tiên mọi vai trò thấy khi vào một cơ sở) đọc `ERP_SITES[].snapshot`, hằng số viết cứng trong `domain/erp.ts`. Bằng chứng L2 đã xác nhận bằng truy vấn thật: 3/4 cơ sở tự mâu thuẫn giữa số "Sự cố mở" ở trang tổng quan và số thật ở module Sự cố.
- Thêm `countEmployeesOnShift(siteId)` vào `lib/erp/attendance-repository.ts` — gộp `erp_staff_attendance_events` theo `userId`, lấy sự kiện gần nhất mỗi người bằng `createdAt`, đếm ai đang `type === "check-in"`. Dùng chung `getAttendanceState()` sẵn có nên chạy đúng cho cả 2 chế độ lưu trữ.
- Thêm `countGateScansToday(siteId)` vào `lib/erp/gate-scan-repository.ts` — đếm `erp_gate_scan_events` trong ngày hiện tại theo giờ Việt Nam (biên ngày tính từ `vietnamDateKey()` của `workday-repository.ts` cộng offset `+07:00`, không phải so khớp chuỗi ngày vì bảng không có cột `business_date`). Chế độ `supabase` dùng `count: "exact", head: true`; chế độ `demo-cookie` đếm thẳng mảng trong state (không bị giới hạn bởi `READ_LIMIT = 8` của `getRecentGateScans` — hàm đó chỉ dành cho hiển thị "quét gần nhất", không phải đếm).
- `app/erp/[site]/page.tsx`: 3/5 KPI đổi sang số thật (Sự cố mở dùng đúng `getIncidentCases(site.id)` lọc `status !== "closed"` — **cùng truy vấn module Sự cố dùng**, nên hai màn không thể lệch nữa). 2 KPI còn lại (Khách dự kiến, Tải hiện tại) **chưa có nguồn dữ liệu thật nào** — hiển thị `"—"` kèm chú thích nhỏ "Chưa có nguồn dữ liệu" thay vì bịa số, đúng nguyên tắc đã ghi trong file đánh giá.
- **Phạm vi cố ý giới hạn:** không đụng tới `domain/erp.ts`'s `snapshot` hay các nơi khác vẫn đọc nó (`camera-ai-workspace.tsx`, `finance-dashboard.tsx`, module Sức chứa trong `module-workspace.tsx`, mô phỏng doanh thu trong `ticket-guest-workspace.tsx`) — đó là việc lớn hơn thuộc V7/V8, không phải V1.
- **Phát hiện phụ khi viết test:** module Sự cố narrow theo vai trò — **giám đốc** chỉ thấy sự cố *đã chuyển cấp và còn mở* (`visibleCases` lọc `escalated && status !== "closed"`, đúng chủ đích của V2), nên "hồ sơ đang mở" trên màn hình director là tập con, không phải tổng toàn cơ sở. Trang tổng quan cố tình hiển thị tổng thật (mọi vai trò cùng thấy một số), nên với **quản lý** (không bị narrow) hai số khớp tuyệt đối, còn với giám đốc thì khác nhau *một cách hợp lý* — không phải lỗi L2 tái diễn.
- Kiểm chứng: `typecheck`/`lint`/`test:run` (255 pass/1 skip)/`build` sạch cục bộ → push → `vercel inspect` xác nhận deployment `ninhbinhjourney-pa4stpld8` **Ready** → Playwright thật trên production. Bài mới `tests/e2e/prod-smoke-site-overview-kpis.spec.ts` (3 test, dùng tài khoản **quản lý** cho bài so khớp Sự cố mở vì lý do narrow ở trên): số Sự cố mở khớp đúng module ở cả 4 cơ sở; 2 KPI chưa có nguồn hiện đúng "Chưa có nguồn dữ liệu"; Nhân sự trong ca là số thật (assert không rơi trùng ngẫu nhiên vào hằng số cũ 84/112). **3/3 pass.**
- Lần chạy đầu 1/3 fail do race condition **trong chính bài test** (đọc `innerText()` ngay sau `goto()`, bắt trúng màn "Đang chuẩn bị trải nghiệm / Loading…" — cùng loại flake đã ghi nhận ở đợt kiểm chứng trước) — sửa bằng `expect(...).toBeVisible()` trước khi đọc text, không sửa sản phẩm. Chạy lại **3/3 pass**.
- Đã đánh dấu `[x]` V1 trong `docs/DANH_GIA_HE_THONG_VA_GIAO_VIEC.md` (mục 7), thêm mục 22 ghi chi tiết.

### 01/08/2026 — [Claude Sonnet] Sửa V2: giám đốc thấy sự cố chuyển cấp + yêu cầu đổi phạm vi dự án trong hộp thư quyết định

- Chủ dự án yêu cầu tự chọn việc ưu tiên nhất từ file đánh giá để sửa tiếp. Chọn **V2** vì đã được chính đợt kiểm chứng production trước đó (mục 20.4 file đánh giá) nâng lên **ưu tiên số 1**: `directorDecisionCount` trên `app/erp/page.tsx`/`executive-dashboard-live.tsx` trước đây chỉ cộng `pendingShiftCloseDecisions.length + pendingSupplierDecisions.length`, bỏ sót sự cố đã chuyển cấp và yêu cầu đổi phạm vi dự án — có bằng chứng chạy thật: trang `/erp` ghi "0 hồ sơ cần quyết định" trong khi `/erp/tam-chuc/su-co` có sự cố đã chuyển cấp, đã được quản lý xác minh, đang quá SLA.
- Thêm `listEscalatedIncidents(siteIds)` vào `lib/erp/incident-repository.ts` (lọc `escalated && status !== "closed"` qua toàn bộ site, gọi song song) và `listPendingProjectChangeRequests(siteIds)` + type `ProjectChangeRequestWithSite` vào `lib/erp/project-repository.ts` (lọc `status === "pending"`, bắt lỗi từng site riêng — site chưa có sự kiện dự án chỉ đóng góp mảng rỗng thay vì làm hỏng cả trang giám đốc). Đặt hàm trong repository thay vì viết logic gộp ngay trong `page.tsx`, đúng kiến trúc repository-pattern sẵn có của dự án.
- `app/erp/page.tsx`: gọi 2 hàm trên song song với các fetch cũ khi `user.role === "director"`, truyền qua props mới `escalatedIncidents`/`pendingProjectChangeRequests` cho `ExecutiveDashboard`.
- `executive-dashboard-live.tsx`: `directorDecisionCount` cộng đủ 4 loại; phần tiêu đề "Cần giám đốc quyết định" đổi từ một câu 2 số thành `<dl>` 4 số riêng (gộp 4 số vào một câu sẽ không đọc nổi); thêm 2 khối thẻ mới (sự cố chuyển cấp — link `/erp/{site}/su-co`, kèm nhãn "Quá SLA"/"Còn N phút"; yêu cầu đổi phạm vi — link `/erp/{site}/du-an-su-kien`, kèm loại yêu cầu và người gửi) cùng khuôn với khối thẻ ngoại lệ NCC đã có. Chỉ sửa `ExecutiveDashboard` (màn giám đốc) — đã kiểm tra `role-home-dashboard.tsx` không có khái niệm "quyết định" tương tự nên không cần đổi.
- Kiểm chứng: `typecheck`/`lint`/`test:run` (255 pass/1 skip)/`build` sạch cục bộ → push → `vercel inspect` xác nhận deployment `ninhbinhjourney-a1sa8p5ea` **Ready** → Playwright thật trên production. Bài mới `tests/e2e/prod-smoke-director-decision-inbox.spec.ts` (2 test): (1) xác nhận số liệu + khối "Sự cố đã chuyển cấp" hiện đúng trên `/erp` khớp sự cố chuyển cấp thật đang có; (2) **xuyên 2 phiên tách biệt** — quản lý gửi yêu cầu đổi phạm vi mới tại Bái Đính (không duyệt, để lại pending theo đúng tiền lệ dự án) → giám đốc ở phiên khác thấy ngay trong hộp thư, link đúng `/erp/bai-dinh/du-an-su-kien`. **2/2 pass.**
- Hồi quy: `prod-smoke-project-workflow.spec.ts` **2/2 pass**, không ảnh hưởng. `prod-smoke-incidents.spec.ts` **fail nhưng không phải do thay đổi này** — bài đó tự ghi rõ trong comment là one-shot (đã chuyển `INC-TA-071` từ "reported" sang "acknowledged" vĩnh viễn ở lần chạy trước), chạy lại luôn fail vì trạng thái đầu vào không còn khớp giả định của bài test. Đây là nợ kỹ thuật có sẵn của bộ test (chưa idempotent), không phải lỗi sản phẩm — ghi lại để phiên sau không tưởng nhầm là regression.
- Đã đánh dấu `[x]` V2 trong `docs/DANH_GIA_HE_THONG_VA_GIAO_VIEC.md` (mục 7 và mục 20.7), thêm mục 21 ghi chi tiết.

### 01/08/2026 — [Claude Sonnet] Thay bản đồ giả cuối cùng trên `/explore` bằng Leaflet thật

- Chủ dự án yêu cầu dứt điểm mọi "bản đồ giả bố" sau đợt kiểm chứng trước đó phát hiện `/explore` vẫn là SVG vẽ tay (P8/W18 trong file đánh giá). Đây là bản đồ giả **cuối cùng** còn sót — bản đồ trang chủ và bản đồ lịch trình đã sửa trong batch trước.
- Thêm `components/discovery/explore-map.tsx`: Leaflet thật, nạp động `dynamic(..., { ssr: false })` đúng khuôn `app/tourism-map.tsx` và `components/journey/itinerary-route-map.tsx`. Marker đánh số theo `divIcon` dùng lại class `nb-marker`/`nb-marker-active` có sẵn trong `globals.css`; tự `fitBounds` theo đúng tập điểm đang lọc (0/1/nhiều điểm đều xử lý riêng).
- Sửa `explore-experience.tsx`: xoá hẳn `LocalTourismMap` (khối `<svg viewBox="0 0 100 100">` + toán quy đổi toạ độ sang phần trăm + nhãn "Local geographic fallback"/"WGS 84 · product scope, not an official boundary") và `pointPosition`. Kiểu `returnFocusRef`/`selectDestination` nới từ `HTMLButtonElement` sang `HTMLElement` vì marker Leaflet không phải `<button>` — nút "Tập trung trên bản đồ" ở chế độ danh sách vẫn hoạt động y hệt cũ vì `HTMLButtonElement` là subtype. Chọn điểm qua marker dùng `event.target.getElement()` (Leaflet tự gắn `tabindex="0"`/`role="button"` cho marker nên bàn phím vẫn dùng được) để giữ đúng hành vi "focus quay lại nút vừa bấm khi đóng khung chi tiết" như bản cũ.
- `tests/e2e/public-surfaces.spec.ts`: bài `"discovery remains usable without interacting with a network tile map"` trước đây **coi bản đồ giả là hành vi mong muốn** — đổi tên thành `"discovery list mode works without waiting on the map"` (khẳng định vẫn đúng: chế độ danh sách không phụ thuộc mạng) và thêm bài mới `"discovery map mode renders a real interactive map, not a static canvas"` khẳng định `.leaflet-container` + `.leaflet-marker-icon` hiển thị thật.
- Kiểm chứng: `typecheck`/`lint`/`test:run` (255 pass/1 skip)/`build` sạch cục bộ. Playwright cục bộ 12/12 pass. Push → `vercel inspect` xác nhận deployment `ninhbinhjourney-h0266i1yu` **Ready** → Playwright thật trên `https://ninhbinhjourney.vercel.app`: **30/30 pass, cả desktop-chromium và mobile-chromium**.
- Quét lại toàn bộ `app/` + `components/` bằng `grep -rl "viewBox=\"0 0 100 100\""`: **không còn kết quả nào** — không còn bản đồ giả nào trong web công khai.
- Đã đánh dấu `[x]` W18 trong `docs/DANH_GIA_HE_THONG_VA_GIAO_VIEC.md` mục P8.

### 01/08/2026 — [Claude Opus] Sửa trình lập hành trình công khai và bản đồ; rà soát web ngoài

- **Lỗi chặn thật, đã kiểm chứng bằng mã nguồn:** `/plan` không dùng được với khách thường. `app/api/journeys/route.ts` yêu cầu cookie `nbj-active-run` (chỉ do `/api/demo-runs*` cấp) **và** một phiên Supabase ẩn danh; không có middleware nào và **không nơi nào gọi `signInAnonymously`**. Khách vào từ trang chủ không có cả hai → bấm "Xác nhận và tạo hành trình" luôn trả `DEMO_ROOM_NOT_JOINED`. Đây là kiến trúc "demo room" cũ của `/ops` chặn ngang luồng công khai. Lưu ý: `/api/quotes` **vẫn còn** cùng ràng buộc này — luồng báo giá/đặt gói chưa được sửa trong batch này.
- Sửa: demo room giờ **chỉ cần khi muốn LƯU** hành trình. Không có room thì API vẫn sinh + kiểm tra lịch trình đầy đủ và trả về kèm `persisted: false`, bỏ qua truy vấn `capacity_slots` (vốn scope theo `demo_run_id`). Có room thì giữ nguyên hành vi cũ + `persisted: true`.
- Sửa tiếp trong `plan-experience.tsx`: `visitDate` trước đây **hard-code `"2026-08-15"`** cho mọi hành trình — nay khách tự chọn ngày (mặc định hôm nay + 7, `min` = hôm nay). Ngày được tính trong sự kiện bấm "Hiểu yêu cầu" chứ không phải trong `useEffect`, vừa tránh lệch hydration vừa không vi phạm rule `react-hooks/set-state-in-effect`. Bỏ việc điền sẵn câu mẫu vào ô nhập (chuyển thành placeholder), Việt hóa các nhãn còn tiếng Anh.
- `itinerary-editor.tsx`: khi hành trình chưa lưu, thao tác Lên/Xuống/Thay/Xóa **tính lại tại chỗ** bằng chính `rebuildItineraryWithSites` của domain thay vì gọi PATCH (sẽ luôn 403). Link "Dùng hành trình này" bỏ tham số `?journey=` khi chưa lưu vì `/journey/{id}` không tồn tại.
- **Bản đồ:** thay khối SVG trang trí (`Route reveal · local tourism-core canvas` — một đa giác vẽ tay không phải hình Ninh Bình, vi phạm `UI_UX_RULES.md` "use a real interactive map, not a fake text map") bằng `components/journey/itinerary-route-map.tsx` — Leaflet thật, marker đánh số, polyline nối theo thứ tự, `fitBounds` theo các điểm dừng, nạp động `ssr: false` đúng pattern `app/ninh-binh-landing.tsx`.
- **Lỗi nhãn bản đồ:** `app/tourism-map.tsx` gắn tooltip cố định `copy.youAreHere` ("Bạn đang ở đây") lên **cả marker chào đón lẫn điểm đến đang chọn** — bấm vào Tràng An là hiện "Bạn đang ở đây" dù khách đang ngồi ở Hà Nội, và hai badge có thể hiện cùng lúc. Nay nhãn đó **chỉ thuộc marker định vị GPS thật**; điểm đến đang chọn hiện tên của chính nó; marker chào đón chỉ hiện nhãn khi chưa chọn điểm nào. Bổ sung memo hóa icon Leaflet (trước đây tạo `L.divIcon` mới mỗi lần render).
- Kiểm chứng: `typecheck`/`lint` sạch, `test:run` **255 pass / 1 skip**, `build` sạch. **Không verify được cục bộ** vì máy này không có `NEXT_PUBLIC_SUPABASE_*` nên `/plan` render `SetupState` — đã theo cadence của dự án: push → `vercel inspect` xác nhận deployment `ninhbinhjourney-fku1ibrhm` **Ready** → chạy Playwright thật trên `https://ninhbinhjourney.vercel.app`. Bài mới `tests/e2e/public-journey-planner.spec.ts` (3 case: khách thường tạo được hành trình, tự chọn ngày, sửa hành trình chưa lưu) cùng `public-surfaces.spec.ts`: **28/28 pass trên cả desktop-chromium và mobile-chromium.**
- Đã ghi Phần III + mục 18–19 của `docs/DANH_GIA_HE_THONG_VA_GIAO_VIEC.md`: rà soát web công khai, định hướng thanh toán/nội dung/thuyết minh, và giải thích `/ops` là gì.
- **Kiểm chứng toàn hệ thống trên production (chỉ đọc, không bấm nút ghi) — chi tiết đầy đủ ở mục 20 của file đánh giá.** Tóm tắt: phân quyền ERP **đạt** (ẩn danh → `/erp/login`; nhân viên vào module/cơ sở chưa được cấp đều bị chuyển hướng kèm thông báo; `/api/erp/assistant` khi chưa đăng nhập → 401). Xác nhận **L1** (tổng quan đúng là hằng số: `Tải hiện tại 68/83/61/74%`, `Sự cố mở 2/5/1/3`), **L2** (Tam Chúc tổng quan "Sự cố mở 5" vs module sự cố "1 hồ sơ đang mở"), và **L3 ở mức nghiêm trọng hơn dự đoán** — trang giám đốc ghi "0 hồ sơ cần quyết định" trong khi Tam Chúc có "Cần quyết định 1 · Đã được quản lý xác minh" và "Sát hoặc quá SLA 1". Đề nghị nâng V2 lên ưu tiên số 1. Web công khai: `/api/quotes` xác nhận chết bằng runtime (HTTP 409 `DEMO_ROOM_NOT_JOINED`); `/checkout` chặn ở production; Hang Múa bị bộ lọc mặc định ẩn khỏi `/explore` (7/8 điểm, không báo gì); `/explore` vẫn dùng bản đồ SVG giả; `/destination/<slug lạ>` và `/journey/<id lạ>` trả **HTTP 200** kèm nội dung 404; `/pass`/`/booking` sai định danh báo lỗi **bằng tiếng Anh** sau ~12s. Việc phát sinh: W15–W18.
- **Bẫy đã làm tôi báo sai 3 lần, ghi lại cho phiên sau:** `page.waitForURL(/\/erp(\/|$)/)` sau khi bấm đăng nhập **cũng khớp `/erp/login`**, nên bài test đọc nhầm trang đăng nhập và kết luận "phân quyền hỏng". Dùng `waitForURL(url => !url.pathname.startsWith("/erp/login"))`. Khi một kết quả mâu thuẫn với điều đã kiểm chứng ở phiên trước, **nghi ngờ bài test trước**.

### 01/08/2026 — [Claude Sonnet] Sửa ticket-guest-workspace.tsx (QR scan) và field-report-workspace.tsx (ảnh báo cáo) từ state cục bộ sang Supabase

- Tiếp tục danh sách ưu tiên từ audit 31/07/2026 — sau khi sửa staff-access/attendance (rủi ro cao nhất) và incident-workflow (ưu tiên #2), đây là ưu tiên #3: `ticket-guest-workspace.tsx` (nút "Quét và ghi nhận QR", chế độ check-in) chỉ kiểm tra độ dài mã trên client rồi toast, không có Server Action, không lưu; `field-report-workspace.tsx` (nút "Gửi báo cáo") build object rồi `setReports()` cục bộ, ảnh chỉ đọc qua `FileReader` thành base64 giữ trong state — không hề upload lên Supabase Storage dù toast nói "đã chuyển quản lý".
- Thêm `supabase/migrations/202607310012_erp_field_reports_and_gate_scans.sql`: bảng `erp_gate_scan_events` + RPC `erp_record_gate_scan` (gộp lượt quét trùng mã trong cùng 2 phút thành một sự kiện thay vì ghi log trùng — tự vệ khỏi double-tap chứ không phải chống gian lận vé thật, việc đó thuộc phạm vi ticketing lớn hơn chưa làm); bảng `erp_field_operation_reports` + RPC `erp_submit_field_operation_report` cộng bucket Storage riêng tư `erp-field-reports` (5 MB, chỉ JPEG/PNG/WebP/HEIC/HEIF) — tái dùng đúng mẫu private-bucket-plus-signed-URL đã chứng minh ở `erp-workday-evidence` (migration `202607290004`). RLS bật cả 2 bảng, toàn bộ quyền thu hồi, chỉ `service_role` có `SELECT` và EXECUTE trên 2 RPC.
- **Va chạm tên phát hiện khi apply lần đầu:** migration fail với `column "report_code" of relation "erp_field_reports" does not exist` — một bảng `erp_field_reports` khác đã tồn tại sẵn trên remote (từ migration rất sớm, dạng `reporter_user_id`/`work_item_id`/`progress_percent`/`image_paths[]`) mà không có code nào trong app đọc/ghi — cùng dạng va chạm với `erp_attendance_events` ở migration 009. Transaction tự rollback sạch, không có gì bị hỏng. Đổi tên bảng mới thành `erp_field_operation_reports` (cùng sequence, RPC, index, policy), apply lại thành công; thêm test khẳng định migration không chạm `public.erp_field_reports`.
- Thêm `lib/erp/gate-scan-repository.ts` và `lib/erp/field-report-repository.ts` theo đúng pattern `demo-cookie`/`supabase` sẵn có. Ở chế độ `demo-cookie`, ảnh không được lưu qua request (không có backend Storage thật ở chế độ local) — chỉ metadata báo cáo được lưu cookie, khác với chế độ `supabase` (mặc định trên production) upload ảnh thật.
- Thêm 2 Server Action trong `app/erp/actions.ts` (`submitFieldReportAction` — kiểm tra thêm `canSubmitFieldOperation(role)`, `recordGateScanAction`) cùng khuôn kiểm tra vai trò/cơ sở/module như các action ERP khác. Chuyển cả 2 component từ tự sinh state cục bộ sang nhận dữ liệu qua prop server-fetch (`app/erp/[site]/[module]/page.tsx` → `module-workspace.tsx`), gọi Server Action rồi `router.refresh()` — đúng pattern `attendance-panel.tsx`. Thêm khối "Quét gần nhất · toàn cơ sở" vào `ticket-guest-workspace.tsx` để tự chứng minh trực quan việc lưu bền xuyên tài khoản.
- Test mới: `tests/integration/erp-field-report-and-gate-scan-actions.test.ts` (10 case) và `tests/security/erp-field-reports-and-gate-scans-migration-contract.test.ts` (8 case, gồm case khẳng định không đụng bảng `erp_field_reports` cũ). Sửa 2 test tích hợp cũ (`erp-staff-access-and-attendance-actions.test.ts`, `erp-incident-actions.test.ts`) để mock thêm 2 repository mới vì `app/erp/actions.ts` import tĩnh, không mock sẽ vỡ do `import "server-only"`.
- Quality gate: `typecheck`/`lint` sạch, `test:run` **225/226** (207 gốc + 18, 1 skip có điều kiện), `build` qua sạch.
- Apply migration lên Supabase remote qua CLI (dry-run xác nhận đúng 1 file trước khi push thật cả hai lần — lần đầu fail do va chạm tên, lần hai thành công). Xác minh trực tiếp sau apply qua `supabase db query` (đọc-only): RLS bật cả 2 bảng, chỉ `service_role` có `SELECT`/`EXECUTE`, bucket `erp-field-reports` đúng cấu hình (`public=false`, 5 MB, đúng mime list), 12 báo cáo demo đã seed.
- Commit `fae235b` đã push lên `main`; Vercel Git-integration tự deploy (`dpl_AQfwdFZ8xAxtKyCYe9mY9dkxnyMN`, xác nhận `Ready`/production/alias qua `vercel inspect`).
- **Xác nhận thật trên production bằng Playwright** (`tests/e2e/prod-smoke-field-reports-and-gate-scans.spec.ts`, hai browser context tách biệt hoàn toàn cho mỗi kịch bản, ảnh PNG thật qua `setInputFiles`): (1) nhân viên (`nv.trangan`) gửi báo cáo ảnh tại Tràng An → giám đốc (`giamdoc`) ở phiên đăng nhập khác thấy đúng hồ sơ, đúng tên nhân viên, đúng nội dung ghi chú và mã hạch toán; (2) nhân viên quét một mã QR ngẫu nhiên → quản lý (`ql.vanhanh`) ở phiên khác thấy đúng mã trong "Quét gần nhất". **2/2 pass**, xác minh thêm trực tiếp qua `supabase db query`: báo cáo test có `storage_path` khác null (ảnh thật đã lên Storage, không chỉ base64 trong bộ nhớ trình duyệt), lượt quét QR ghi đúng người quét.
- **Còn treo:** `project-event-workspace.tsx` — module "Dự án & sự kiện" hoàn toàn tĩnh, không có nút hành động nào (kể cả giả), chưa có repository/action file nào tồn tại. Đây là mục cuối trong danh sách audit 31/07/2026, quy mô khác hẳn 3 mục đã sửa (không phải nối một nút có sẵn vào Supabase mà phải thiết kế WBS/dependency/change/readiness/acceptance/settlement từ đầu).

### 01/08/2026 — [Claude Sonnet] Sửa incident-workflow-workspace.tsx (module Sự cố) từ useState cục bộ sang Supabase

- Tiếp tục danh sách ưu tiên đã ghi trong mục audit 31/07/2026 bên dưới — module rủi ro cao nhất (`staff-access-manager.tsx`/`attendance-panel.tsx`) đã sửa xong ở phiên trước; đây là mục ưu tiên #2, `incident-workflow-workspace.tsx`, **giả 100%**: mọi chuyển trạng thái (quản lý tiếp nhận/giao/yêu cầu xác minh/đóng, nhân viên báo đã xử lý) chỉ gọi `setCases()` trên mảng 3 phần tử hard-code sinh lại mỗi lần mount — không Server Action, không repository.
- Repo có sẵn một backend sự cố thật khác (`app/api/incidents/route.ts`, RPC `confirm_incident_draft`) nhưng đọc kỹ migration `202607240001_secure_shared_core.sql` xác nhận nó thuộc hệ thống "operator run"/QR check-in demo công khai (`demo_runs`, `demo_run_members`, vai trò `check-in-agent`/`site-supervisor`/`icc-operator`) — không có khái niệm tenant/site/quản lý/giám đốc của ERP, không thể ghép vào module này mà không làm biến dạng mô hình dữ liệu. Quyết định giữ nguyên như audit đã ghi: xây repository riêng cho ERP thay vì ép nối.
- Thêm `supabase/migrations/202607310011_erp_incidents.sql`: bảng `erp_incidents` (evidence và timeline lưu dạng `jsonb` ngay trên row, không tách bảng riêng — vì chưa có luồng nào cho phép thêm evidence và mỗi dòng timeline luôn được ghi cùng lúc với chuyển trạng thái, nên jsonb append trên 1 row là đủ, tránh bảng join thừa); RPC `erp_incident_manager_transition` (chỉ vai trò `manager`, đi đúng chuỗi `reported → acknowledged → in-progress → verification → closed`, tự gán nhân viên mặc định theo cơ sở khi chuyển sang `in-progress` nếu chưa có ai phụ trách) và `erp_incident_employee_progress` (chỉ đúng nhân viên đang được giao mới báo đã xử lý, chỉ từ hồ sơ đang mở). RLS bật, toàn bộ quyền thu hồi, chỉ `service_role` có `SELECT` và EXECUTE trên 2 RPC. Seed 12 hồ sơ demo (3/cơ sở × 4 cơ sở), giữ nguyên đúng nội dung mà `createCases()` cũ từng sinh ra để không đổi kịch bản demo hiện có.
- Thêm `lib/erp/incident-repository.ts` theo đúng pattern `demo-cookie`/`supabase` sẵn có của dự án (nhánh cookie tự chứa, không phụ thuộc runtime khác). Thêm 2 Server Action trong `app/erp/actions.ts` (`transitionIncidentAction`, `progressIncidentAction`) với khuôn kiểm tra vai trò/cơ sở/module giống hệt các action `updateEmployeeAccessAction`/`recordAttendanceAction` đã có.
- Chuyển `incident-workflow-workspace.tsx` từ tự sinh state cục bộ sang nhận `cases` qua prop (`app/erp/[site]/[module]/page.tsx` → `module-workspace.tsx` → component), gọi Server Action rồi `router.refresh()` — đúng pattern `attendance-panel.tsx` đang dùng.
- Test mới: `tests/integration/erp-incident-actions.test.ts` (10 case: chặn sai vai trò, chặn ngoài phạm vi quản lý/module, thành công + revalidate, xử lý lỗi conflict) và `tests/security/erp-incidents-migration-contract.test.ts` (8 case: khóa RLS/grant, chỉ role đúng mới chuyển được trạng thái, ghi timeline atomically, seed đúng 12 hồ sơ, khẳng định không đụng bảng/RPC `confirm_incident_draft`/`demo_runs` cũ). Sửa `tests/integration/erp-staff-access-and-attendance-actions.test.ts` để mock thêm `@/lib/erp/incident-repository` (module mới `app/erp/actions.ts` import tĩnh, nếu không mock thì `import "server-only"` làm vỡ test chạy trong Vitest).
- Quality gate: `typecheck`/`lint` sạch, `test:run` **207/208** (190 gốc + 10 + 8, 1 skip có điều kiện), `build` qua sạch không lỗi.
- **Apply migration lên Supabase remote qua CLI**, dry-run xác nhận chỉ đúng 1 file mới sẽ chạy trước khi push thật. Xác minh trực tiếp sau apply qua `supabase db query` (đọc-only): `relrowsecurity = true`, chỉ `service_role` có `SELECT` trên bảng, chỉ `service_role`/`postgres` (chủ sở hữu) có `EXECUTE` trên 2 RPC, 12 hồ sơ đã seed đúng.
- **Phát hiện và tự sửa lỗi line-ending trước khi push:** Edit tool ghi `components/erp/module-workspace.tsx` (chỉnh sửa 3 dòng thật) ra CRLF trong khi file gốc là LF, làm diff hiện sai thành hơn 1000 dòng thay đổi. Phát hiện qua `git diff --stat`, chuẩn hoá lại về LF bằng Node trước khi commit, xác nhận diff thật chỉ còn 7 dòng, rồi mới `git commit --amend` (chưa push nên amend an toàn) và push.
- Commit `354e994` đã push lên `main`; Vercel Git-integration tự deploy (`dpl_6V43vi4GxYPusfqtNG8L7CGNDbbo`, xác nhận `Ready`/production/alias qua `vercel inspect`, tạo lúc 00:31 giờ Việt Nam ngay sau khi push).
- **Xác nhận thật trên production bằng Playwright** (`tests/e2e/prod-smoke-incidents.spec.ts`, hai browser context tách biệt hoàn toàn, mô phỏng đúng 2 tài khoản/2 phiên khác nhau): quản lý (`ql.vanhanh`) mở `/erp/trang-an/su-co`, bấm "Tiếp nhận & giữ SLA" cho `INC-TA-071` (từ "Mới báo" sang "Đã tiếp nhận") → giám đốc (`giamdoc`) đăng nhập ở context hoàn toàn mới, mở cùng trang, thấy đúng hồ sơ đã chuyển "Đã tiếp nhận" và dòng thời gian mới ghi tên thật "Lê Hoàng Nam". **1/1 pass**, xác minh thêm trực tiếp bằng `supabase db query`: `status=acknowledged`, `version=2`, `next_action` đúng bước kế tiếp. Bài test này chủ đích để lại `INC-TA-071` ở trạng thái "Đã tiếp nhận" vĩnh viễn trên production (không có RPC "revert" vì đây là state machine một chiều theo đúng thiết kế nghiệp vụ sự cố thật) — cùng tiền lệ với `erp-supplier-ap-workflow.spec.ts` đã ghi trước đó.
- **Còn treo:** `project-event-workspace.tsx` (chưa có gì để nối — đúng như PLAN đã ghi, không có repository/action file nào), QR scan (`ticket-guest-workspace.tsx`) và ảnh báo cáo ngoài kế hoạch (`field-report-workspace.tsx`) vẫn còn giả — chưa đụng tới trong phiên này.

### 31/07/2026 — [Claude Sonnet] Sửa staff-access và attendance từ cookie sang Supabase, apply migration remote

- Tiếp nối mục audit ngay dưới đây: sau khi xác nhận `attendance-panel.tsx` và `staff-access-manager.tsx` gọi Server Action thật nhưng chỉ ghi vào signed cookie riêng trình duyệt (không xuyên tài khoản/thiết bị), đã sửa cả hai để lưu bền qua Supabase — ưu tiên hơn `incident-workflow-workspace.tsx`/`project-event-workspace.tsx`/QR-scan/field-report (những module đó giả lộ liễu hơn nhưng ít rủi ro hiểu lầm hơn vì không có Server Action thật đứng sau).
- Thêm `supabase/migrations/202607310009_erp_staff_access_and_attendance.sql`: bảng `erp_employee_access` (1 hàng/nhân viên, site+module hiện tại, version tự tăng), `erp_employee_access_audit` (lịch sử cấp/thu hồi quyền), `erp_staff_attendance_events` (ledger check-in/check-out với `idempotency_key`); RPC `erp_update_employee_access` (chỉ manager/director, ghi audit kể cả khi thu hồi) và `erp_record_attendance_event` (dedupe theo idempotency key, chặn check-in đúp/check-out không có check-in mở); RLS bật, chỉ `service_role` EXECUTE, không grant bảng cho `anon`/`authenticated`.
- **Va chạm tên phát hiện khi apply lần đầu:** migration fail với `column "user_account_id" does not exist` ở bước tạo index — hoá ra bảng `erp_attendance_events` **đã tồn tại sẵn** trên remote (từ một migration rất sớm, khớp type speculative `ErpAttendanceEventRow` trong `types/database.generated.ts`: `user_id uuid`, `happened_at`, không có `business_date`/`idempotency_key`), nhưng không có code nào trong app đọc/ghi bảng đó. Transaction tự rollback sạch, không có gì bị hỏng. Đổi tên bảng mới thành `erp_staff_attendance_events` để không đụng/không âm thầm dùng nhầm schema cũ; thêm test khẳng định migration không chạm `public.erp_attendance_events`.
- Viết `lib/erp/staff-access-repository.ts` và `lib/erp/attendance-repository.ts` theo đúng pattern `demo-cookie`/`supabase` (copy nguyên cơ chế cookie cũ làm nhánh demo, thêm nhánh Supabase gọi RPC). Sửa `lib/erp/demo-session.ts` để `getCurrentErpUser()` đọc quyền qua repository mới thay vì cookie cục bộ; các type (`EmployeeAccess`, `ErpAccessState`, `AttendanceEvent`, `AttendanceState`...) vẫn re-export từ `demo-session.ts` nên toàn bộ import cũ ở component không phải sửa.
- Sửa `app/erp/actions.ts`: `updateEmployeeAccessAction` và `recordAttendanceAction` gọi thẳng hàm repository theo từng thao tác (`updateEmployeeAccessGrant`, `recordAttendanceEvent`) thay vì đọc-sửa-ghi lại toàn bộ state; sửa 4 file khác chỉ đổi đường import (`workday-actions.ts`, `workflow-actions.ts`, `app/erp/page.tsx`, `app/erp/[site]/[module]/page.tsx`) vì hàm đọc `getAccessState`/`getAttendanceState` giữ nguyên chữ ký.
- Test mới: `tests/integration/erp-staff-access-and-attendance-actions.test.ts` (10 case: chặn sai vai trò, chặn ngoài phạm vi, chặn giành nhân viên cơ sở khác trừ giám đốc, lọc đúng module được đào tạo, revoke, GPS ngoài geofence, conflict chấm công đúp) và `tests/security/erp-staff-access-and-attendance-migration-contract.test.ts` (7 case, theo đúng khuôn các contract test trước, gồm case khẳng định không đụng bảng cũ). Sửa 3 test tích hợp cũ (`erp-workday-action-guards`, `erp-workday-checkin-fallback`, `erp-shift-close-remote-outage`) vì mock `getAccessState`/`getAttendanceState` từ `demo-session` không còn đúng chỗ sau khi tách repository.
- Quality gate: `typecheck`/`lint` sạch, `test:run` **187/188** (169 gốc + 10 + 7 + 1 skip), `build` qua sạch.
- **Apply migration lên Supabase remote qua CLI** (`npx supabase login` bằng tài khoản chủ project `anhlq11002@gmail.com` sau khi phát hiện lần đăng nhập đầu vào nhầm tài khoản Supabase khác chỉ thấy project "Goldencard-ERP"; `supabase link --project-ref vzewjfcwhovsxslqfpjt`). Bảng lịch sử migration của CLI trống hoàn toàn dù 8 migration trước đã apply thật qua Management API — đã `supabase migration repair --status applied` cho cả 8 version trước khi push, để `db push` chỉ chạy đúng 1 file mới (xác nhận bằng `--dry-run`) thay vì thử chạy lại cả 9 file. Xác minh sau apply: 3 bảng tồn tại, RLS bật cả 3, 2 RPC tồn tại, chỉ `service_role`/`postgres` có EXECUTE, `anon`/`authenticated` không có grant bảng nào — toàn bộ qua `supabase db query` đọc-only.
- Thêm `/supabase/.temp/` vào `.gitignore` (CLI tự tạo, chứa chuỗi kết nối pooler Postgres, không được commit).
- Commit `36b2850` (source) đã push lên `main`; Vercel Git-integration tự deploy (`dpl_78vsxc9N9b6gt7S5JvXbW3dNt2AX`, xác nhận `Ready`/production/alias qua `vercel inspect`).
- **Phát hiện regression sau khi migration 009 lên production:** bảng `erp_employee_access` mới tạo trống hoàn toàn, nghĩa là **mọi nhân viên tạm thời mất hết quyền site/module** cho tới khi quản lý gán lại thủ công qua UI mới — trước đây hành vi "có quyền mặc định" đến miễn phí từ default của chế độ demo-cookie (`lib/erp/demo-data.ts`). Vá bằng migration mới `202607310010_erp_employee_access_initial_seed.sql` (chỉ chèn dữ liệu, `on conflict do nothing`, không đụng schema, không đè quyền quản lý đã lỡ thay đổi) seed đúng 6 tài khoản nhân viên demo về đúng site/module gốc. Đã apply lên remote, xác nhận qua `supabase db query` đọc lại đúng 6 hàng.
- **Xác nhận thật trên production bằng Playwright** (`tests/e2e/prod-smoke-staff-access.spec.ts`, browser context tách biệt hoàn toàn cho quản lý và nhân viên, mô phỏng đúng 2 thiết bị khác nhau): quản lý (`ql.vanhanh`) thu hồi module "Sự cố" của `employee-trang-an-01` → nhân viên (`nv.trangan`) đăng nhập ở context mới truy cập `/erp/trang-an/su-co` bị redirect `?denied=module` đúng như kỳ vọng. Test tự khôi phục lại quyền ban đầu ở bước cuối. **1/1 pass** — đây là bằng chứng trực tiếp, không suy diễn, rằng thay đổi của quản lý giờ xuyên tài khoản/thiết bị thật.
- **Còn treo:** `incident-workflow-workspace.tsx`, `project-event-workspace.tsx`, QR scan (`ticket-guest-workspace.tsx`) và field-report vẫn còn giả — chưa đụng tới trong phiên này, xem danh sách ưu tiên ở mục audit.

### 31/07/2026 — [Claude Sonnet] Audit toàn hệ thống tìm hành động trang trí (không lưu bền, không xuyên tài khoản)

- Theo yêu cầu chủ dự án ("logic hệ thống đã ngon lành chưa, sát thực tế không") và sau khi phát hiện `camera-ai-workspace.tsx` có nút "Giao quản lý kiểm tra" chỉ đổi state cục bộ, đã dùng 6 agent Explore đọc toàn bộ 24 component `components/erp/*.tsx` (trừ 4 file đã xác minh thật: `accounting-control-center.tsx`, `shift-close-workflow.tsx`, `workday-lifecycle.tsx`, `supplier-ap-control-center.tsx`) để phân loại từng nút hành động là **THẬT** (gọi Server Action → repository → Supabase, tài khoản khác thấy được) hay **GIẢ** (chỉ đổi `useState` cục bộ, không ai khác thấy).
- **Toàn bộ module "An toàn & sự cố" (`incident-workflow-workspace.tsx`) là giả 100%**: mọi chuyển trạng thái (nhân viên báo → quản lý tiếp nhận/giao/xác nhận → giám đốc thấy escalation) chỉ là `setCases()` trên mảng 3 phần tử hard-code, sinh lại mỗi lần mount. Đáng chú ý: repo **có sẵn** một backend sự cố thật khác (`app/api/incidents/route.ts`, gọi RPC `confirm_incident_draft` trên Supabase) nhưng thuộc hệ thống "operator run" riêng (role `check-in-agent`/`site-supervisor`/`icc-operator`), **không được nối** với module ERP đang xem.
- **Module "Dự án & sự kiện" (`project-event-workspace.tsx`) không có nút hành động nào cả** — kể cả giả — toàn bộ là dữ liệu tĩnh hard-code trong `domain/erp-operating-data.ts` và ngay trong component; khớp đúng PLAN.md ghi `[ ]` chưa bắt đầu, chưa có repository/action file nào cho project/event.
- **"Quét và ghi nhận QR"** (`ticket-guest-workspace.tsx`) và **"Gửi báo cáo"** (`field-report-workspace.tsx`) đều giả: QR scan chỉ set toast; báo cáo hiện trường build object rồi `setReports()` cục bộ, ảnh chỉ đọc qua `FileReader` thành base64 giữ trong state, **không hề upload lên Supabase Storage** dù thông báo thành công nói rõ "đã chuyển quản lý".
- **Phát hiện nguy hiểm hơn cả nút giả lộ liễu**: `attendance-panel.tsx` (chấm công GPS) và `staff-access-manager.tsx` (quản lý gán site/module cho nhân viên) đều gọi **Server Action thật**, có kiểm tra role/geofence/version đàng hoàng — nhưng cả hai cùng ghi xuống **signed cookie theo từng trình duyệt** (`lib/erp/demo-session.ts`), không phải Supabase. Hệ quả: quản lý bấm "Lưu phân công" cấp quyền module cho nhân viên, nhưng khi nhân viên đó đăng nhập ở máy/trình duyệt khác, quyền **không hề thay đổi** — quản lý chỉ thấy ảo giác đã lưu thành công trên chính trình duyệt của mình. Đây là loại lỗi nguy hiểm nhất vì code "trông" hoàn toàn nghiêm túc.
- Ngược lại, xác nhận **KHÔNG có** nút giả trên 4 màn giám đốc xem hằng ngày (`executive-dashboard-live.tsx`, `executive-finance-overview.tsx`, `finance-dashboard.tsx`) — hai nút quyết định thật duy nhất ("Duyệt phương án ngoại lệ"/"Trả kế toán làm rõ" cho ngoại lệ chốt ca) đều nối Server Action → repository → Supabase thật. Trợ lý điều hành (`voice-command-center.tsx` + `app/api/erp/assistant/route.ts`) cũng sạch: chỉ điều hướng hoặc trả lời bằng dữ liệu Supabase thật, nhiều nhánh (sức chứa, sự cố, dự báo) còn chủ động từ chối bịa số khi thiếu dữ liệu thay vì giả vờ.
- **Danh sách việc nên ưu tiên trước khi cho khách tự bấm qua nhiều tài khoản** (không phải role-switcher — vấn đề này tồn tại kể cả đăng nhập tách biệt bình thường): (1) `staff-access-manager.tsx`/`attendance-panel.tsx` — nối Supabase thay vì cookie, mức độ ưu tiên cao nhất vì trông giống đã xong; (2) `incident-workflow-workspace.tsx` — hoặc nối vào backend `app/api/incidents` có sẵn, hoặc nói rõ đây là demo UI; (3) `ticket-guest-workspace.tsx`/`field-report-workspace.tsx` — QR scan và upload ảnh cần thật; (4) `project-event-workspace.tsx` — chưa có gì để nối, đúng như PLAN đã ghi.
- Cập nhật bảng module ở `PLAN.md` G10 cho các dòng liên quan để phản ánh đúng mức độ (xem sửa đổi kèm theo).

### 31/07/2026 — [Claude Sonnet] Smoke đăng nhập vai trò thật trên production cho batch AP–NCC

- Viết `tests/e2e/prod-smoke-ap.spec.ts`: 4 bài đọc-only (không bấm nút mutating nào, chỉ đăng nhập → điều hướng → assert nội dung thật → đăng xuất) cho kế toán, kế toán trưởng, giám đốc và quản lý, target thẳng `PLAYWRIGHT_BASE_URL=https://ninhbinhjourney.vercel.app`.
- Lượt chạy đầu fail 3/4 vì locator `getByText` không `exact` khớp trùng nhiều phần tử (`AP-TA-202607-024` lẫn với text dài hơn chứa cùng chuỗi con) — tự nó đã chứng minh gián tiếp là dữ liệu thật đang hiển thị; sửa locator dùng `{ exact: true }` rồi chạy lại: **4/4 desktop-chromium pass**.
- Xem trực tiếp screenshot `prod-accountant-finance.png`: `/erp/finance` của tài khoản `ketoan` hiển thị đúng 5 hồ sơ AP theo cơ sở (Tam Chúc, Tràng An, Tam Cốc, Bái Đính), sổ Nợ/Có cân đối `959.200.000 đ`/`959.200.000 đ`, và các bút toán nguồn có đủ định khoản, người lập, trạng thái kiểm tra — khớp đúng những gì `PLAN.md`/`CODEX.md` đã mô tả, không phải suy đoán từ text assertion.
- Đóng vòng batch AP–NCC: đã commit, đã push, đã deploy, đã smoke đăng nhập thật 4 vai trò trên production. Việc còn lại ngoài phạm vi "đóng vòng" là mobile-chromium cho bài E2E gốc (mutating, không bắt buộc) và các nguồn G9 còn lại (`G9.2, G9.4–G9.7`).
- File test mới được giữ lại trong repo làm smoke tái sử dụng cho các lần deploy sau (không phải file dùng một lần rồi xoá).

### 31/07/2026 — [Claude Sonnet] Push batch AP–NCC lên GitHub và deploy production qua Vercel Git-integration

- Tiếp nối phiên ngay dưới đây: sau khi chủ dự án tự đăng nhập GitHub trên máy Windows này (Git Credential Manager, xác thực qua trình duyệt vì lệnh chạy trong PowerShell không tự động hoá được không cho phép prompt tương tác), push commit `331bb1d` lên `origin/main` thành công; `git fetch` xác nhận `origin/main` == `331bb1d`, mang theo cả batch AP–NCC (`bd105e4`) mà trước đó chỉ mới có trên remote nhưng chưa deploy.
- Cài Vercel CLI (`npm install -g vercel`), đăng nhập bằng device-code flow (không cần nhập gì thủ công trong phiên này — trình duyệt đã có sẵn phiên đăng nhập), xác nhận tài khoản `quanganh-1102` có quyền trên tổ chức `goldencard`.
- `vercel link` vào đúng project `goldencard/ninhbinhjourney`. `vercel ls ninhbinhjourney` cho thấy một deployment production mới tạo ~8 phút trước (đúng thời điểm push); `vercel inspect` xác nhận deployment `dpl_HfdkxgSwDubYZDE4Kt9YukegdxXK` có `status: Ready`, `target: production`, và nằm trong danh sách alias của `https://ninhbinhjourney.vercel.app` — tức Git-integration đã tự build/deploy/promote mà không cần thao tác thủ công nào từ Vercel CLI.
- Trước khi có bằng chứng CLI này, đã thử xác minh gián tiếp bằng cách so sánh hash tên file `_next/static/chunks/*.js` của trang chủ trước/sau khi đợi ~4 phút — không thấy đổi, dẫn tới nghi ngờ sai là auto-deploy không chạy. Bài học: cách đo gián tiếp qua asset hash không đáng tin (có thể do cache/độ trễ đo not đúng lúc); `vercel inspect` là nguồn xác nhận đáng tin, nên dùng ngay khi có quyền truy cập thay vì đoán qua HTTP.
- Production smoke sau deploy mới dừng ở mức HTTP: `/`, `/erp`, `/erp/login`, `/api/health` đều `200`. **Chưa** đăng nhập vai trò kế toán/kế toán trưởng/giám đốc thật trên production để xác nhận `SupplierApControlCenter` và các màn cũ vẫn đúng — đây vẫn là việc còn treo, không được coi HTTP 200 là đủ theo đúng bài học đã ghi nhận từ batch 29/07.
- Cập nhật `CODEX.md` (mục "Cập nhật gần nhất", trạng thái deploy, "Việc nên làm tiếp theo") và `PLAN.md` (bằng chứng G9.3) cho khớp trạng thái đã push + đã deploy thật.

### 31/07/2026 — [Claude Sonnet] Xác minh clone sạch trên máy Windows mới, sửa test CRLF thật, sửa tài liệu "chưa push" sai

- Máy này chưa từng có checkout dự án; clone `https://github.com/qal1102/ninhbinhjourney.git` lần đầu, không có `.secrets`/PAT/`.env.local` nào từ trước.
- `git log`/`git status` trên clone sạch xác nhận `origin/main` đã có commit AP `bd105e4` — nghĩa là batch AP–NCC **đã được push** từ trước, mâu thuẫn với ghi chú "chưa push" ở đầu file do một phiên trước để lại (có thể do phiên song song push mà không quay lại cập nhật CODEX). Đã sửa toàn bộ chỗ ghi sai trong mục "Cập nhật gần nhất", "Công việc đang dở" và "File quan trọng".
- Cài Node.js LTS và Git (máy chưa có), `npm install` sạch, chạy `typecheck` → qua, `lint` → qua, `test:run` → phát hiện 1 fail thật ở `tests/security/erp-accounting-migration-contract.test.ts` (case seed role assignment), `build` chưa chạy tới lúc đó.
- Điều tra nguyên nhân: `supabase/migrations/202607290006_erp_accounting_maker_checker.sql` được commit với line ending CRLF (không phải do clone trên Windows — đã loại trừ bằng cách tắt `core.autocrlf`, đặt `core.eol=lf` rồi `git reset --hard HEAD`: `git diff` vẫn rỗng và file vẫn CRLF, chứng minh CRLF nằm sẵn trong blob đã commit; kiểm tra chéo các file khác trong repo — kể cả `package.json`, `domain/erp-accounting.ts` — cũng đều CRLF, nên đây là quy ước lưu trữ nhất quán của toàn repo, không phải hỏng do checkout). Test lại dùng chuỗi literal có `\n` nên không khớp `\r\n` thật trong file.
- Sửa `tests/security/erp-accounting-migration-contract.test.ts`: chuẩn hoá `sql` bằng `.replace(/\r\n/g, "\n")` ngay sau `readFileSync`, không đổi nội dung migration (SQL không phụ thuộc line ending) và không nới lỏng assertion nào khác. Chạy lại `test:run`: **169/170** (1 skip có điều kiện) — khớp đúng con số CODEX từng công bố cho batch AP.
- `npm run build` sau đó qua sạch, ra thẳng `.next` mặc định, không gặp lại `EPERM` từng ghi nhận trên máy khác.
- Sửa các câu "chưa commit" còn sót trong danh sách "File quan trọng" của module AP và trong "Việc nên làm tiếp theo" cho khớp trạng thái đã push thật.
- Đã commit thay đổi test-fix + tài liệu trong phiên này; **chưa push** — chờ xác nhận chủ dự án trước khi push vì CODEX ghi nhận có phiên song song khác đang cùng sửa `docs/CODEX.md`.

### 31/07/2026 — [Claude Sonnet A] E2E Supabase multi-role cho AP–NCC và commit batch G9.3

- Tiếp nối mục nhật ký ngay dưới đây (batch AP–NCC phát hiện chưa commit); phiên này viết bổ sung phần còn thiếu là E2E Supabase multi-role, rồi commit toàn bộ batch.
- Né lỗi khóa file `.next` (đã ghi nhận từ trước, nguyên nhân gốc chưa rõ) bằng cách cho `next.config.ts` đọc `distDir` qua biến môi trường `NEXT_BUILD_DIST_DIR` khi có, mặc định vẫn `.next`. `npm run build` ra thư mục thay thế chạy sạch, xác nhận source không có lỗi build thật. Thêm `.next-build*/**` vào ignore của ESLint (dòng ignore trong `.gitignore` đã có sẵn từ trước) sau khi phát hiện lint quét nhầm ~700 lỗi giả từ type helper sinh trong thư mục build thay thế.
- Viết `tests/e2e/erp-supplier-ap-workflow.spec.ts`: một bài xác nhận bàn giao quản lý → kế toán bền qua session, một bài đi xuyên giám đốc quyết ngoại lệ → kế toán lập công nợ → kế toán trưởng ghi sổ độc lập.
- Lấy khóa runtime Supabase tạm thời qua Supabase Management API bằng PAT sẵn có trong `.secrets` (chỉ trong bộ nhớ tiến trình, không ghi ra file, không in giá trị), chạy Playwright thật nhắm vào project remote sau khi được chủ dự án xác nhận chấp nhận thay đổi vĩnh viễn dữ liệu seed.
- Lượt chạy đầu phát hiện timeout mặc định 8s của Playwright quá ngắn cho round-trip Server Action → Supabase RPC thật (hành động vẫn thành công, chỉ UI cập nhật chậm hơn 8s); đã tăng lên 20s cho các bước ghi thật. Một assertion khác (đợi thông báo thoáng qua "Đã chấp thuận ngoại lệ") bị race vì `revalidatePath` lọc luôn thẻ hồ sơ khỏi danh sách giám đốc trước khi kịp đọc — sửa bằng cách assert kết quả cuối (thẻ biến mất khỏi hàng giám đốc) thay vì thông báo tạm thời.
- Kết quả thật trên Supabase remote sau khi hoàn tất: `AP-TA-202607-024` dừng ở "Chờ kế toán trưởng" (cố ý, giống pattern giữ một bút toán demo inbox); `AP-TC-202607-027` đã tới "Đã ghi nhận công nợ" qua đủ 4 vai trò (kế toán → giám đốc → kế toán → kế toán trưởng). Vì chạy trên seed dùng một lần, bài test này không lặp lại được nguyên trạng trên cùng project; cần reseed hoặc project khác để chạy lại từ đầu.
- Chạy lại `npm run typecheck`, `npm run lint`, `npm run test:run` sau toàn bộ thay đổi: đều qua sạch (**169/170**, 1 skip có điều kiện).
- Trong lúc làm việc phát hiện `docs/CODEX.md`, `.gitignore` và `app/layout.tsx` bị một phiên Claude Sonnet khác (do chủ dự án vận hành song song, phạm vi website công khai) chỉnh sửa cùng lúc; chủ dự án xác nhận đây là chủ đích, hai phạm vi không giao nhau, chỉ cần ký tên agent khi ghi log để phân biệt.
- Commit toàn bộ batch G9.3 (source AP–NCC có sẵn từ trước + bài E2E mới + hai sửa cấu hình build/lint). Chưa push, chưa deploy.

### 31/07/2026 — Đồng bộ tài liệu với source thật, xác minh remote cho batch AP–NCC chưa commit

- Phiên này bắt đầu bằng việc đọc lại `AGENTS.md` → `CODEX.md` → `PLAN.md` theo đúng quy tắc bàn giao, rồi đối chiếu với `git status` thật của working tree.
- Phát hiện một khối thay đổi lớn chưa commit (`domain/erp-supplier-ap.ts`, `lib/erp/supplier-ap-repository.ts`, `app/erp/supplier-ap-actions.ts`, `components/erp/supplier-ap-control-center.tsx`, 2 migration mới và 4 file test) triển khai đúng `G9.3` AP–NCC mà CODEX từng ghi là việc kế tiếp, nhưng CODEX/PLAN trước đó không hề nhắc tới — vi phạm quy tắc "cập nhật CODEX+PLAN sau mỗi thay đổi quan trọng" của chính tài liệu này.
- Trước khi sửa gì, xác nhận với chủ dự án rằng các cửa sổ Cursor/Codex đang mở trên máy hiện đang rảnh (không có agent nào đang chạy đồng thời) để tránh xung đột ghi đè.
- Chạy `npm run typecheck`, `npm run lint`, `npm run test:run`: qua sạch (**169/170**, 1 skip có điều kiện); 4 file test AP riêng qua **21/21**.
- `npm run build` cục bộ fail với `EPERM` trên `.next` do khóa file (không phải lỗi code); đã thử xóa `.next` và retry có chờ nhưng toàn bộ ~998 file vẫn bị khóa dù không có tiến trình `node`/dev-server nào chạy. Chưa gỡ được cục bộ; coi là giới hạn môi trường đã biết, cần đóng cửa sổ Cursor đang mở hoặc dùng Vercel remote build để xác nhận.
- Dùng Supabase Management API (đọc-only, không sửa dữ liệu, không in secret) xác minh trực tiếp trên remote: 6 bảng `erp_ap_*` tồn tại với RLS bật và không có grant `anon`/`authenticated`; các RPC nghiệp vụ AP chỉ cấp EXECUTE cho `service_role`; trigger định tuyến ngoại lệ migration 008 tồn tại; seed đã có 4 supplier, 5 invoice, 5 dòng chi phí, 5 audit event. Kết luận: migration 007/008 đã apply an toàn trên remote, đúng pattern bảo mật của các migration trước.
- Xác nhận `partner-commercial-workspace.tsx` bị xoá là dữ liệu demo hard-code hoàn toàn (không có backend), việc thay bằng `SupplierApControlCenter` là chủ đích theo nguyên tắc "không giữ chức năng trang trí"; ghi rõ hệ quả là phần báo giá/hợp đồng/phản hồi khách thương mại hiện không còn UI nào, kể cả bản demo.
- Cập nhật `CODEX.md` (mục cập nhật gần nhất, công việc đang dở, trạng thái Supabase, mô tả module AP mới, file quan trọng, việc nên làm tiếp theo) và `PLAN.md` (`G9` → `[~]`, chi tiết `G9.3`, dòng module AP trong bảng G10) cho khớp đúng trạng thái đã kiểm chứng. Chưa commit, chưa deploy batch AP–NCC; chưa chạy E2E Supabase multi-role cho luồng này.

### 29/07/2026 — Đóng lỗi đồng bộ production sau migration kế toán

- Production smoke sau deploy đầu phát hiện cả giám đốc và kế toán trưởng rơi vào fail-closed `Dữ liệu chưa thể đồng bộ`; không coi HTTP `200` là đủ và không để bản lỗi làm mốc hoàn tất.
- Xác định bốn biến Vercel cũ bị dính chuỗi `\r\n` do cách nhập trước đây: persistence mode, Supabase URL, publishable key và site URL; server key sensitive cũng không dùng được. Ghi đè từ Supabase Management API bằng stdin không newline, không in hoặc lưu giá trị vào source/docs; xóa snapshot env tạm ngay sau chẩn đoán.
- Remote-read test sau khi dùng key trong bộ nhớ tìm ra lỗi thứ hai: migration 006 thêm `system.accounting-posted`/`system.accounting-reversed`, còn reader chốt ca cũ từ chối actor `system`. Tách audit actor/action hệ thống khỏi vai trò đăng nhập và thêm integration test remote có điều kiện.
- Push subtree `6bccdec7cde016736fde85da2e305cac49075609`, deploy production mới rồi smoke đọc-only qua trên kế toán trưởng, giám đốc và Pixel 7; journal remote không bị thay đổi trong smoke.

### 29/07/2026 — Thay hồ sơ kế toán stock bằng maker–checker và sổ thật

- Bổ sung vai trò `chief-accountant`; roster hiện có một quản lý vận hành phụ trách cả bốn cơ sở, một kế toán viên, một kế toán trưởng, giám đốc và nhân viên đúng cơ sở/công việc.
- Thay chín case hard-code bằng trung tâm kế toán đọc Supabase: lập journal từ chốt ca, gửi kiểm tra, trả lại, ghi sổ, hoàn bút, lập bút toán điều chỉnh, khóa/mở kỳ, trial balance, sổ tài khoản và audit.
- Apply migration 006 và xác minh remote có bảy bảng, mười tài khoản, mười ba phân công vai trò, bốn RPC service-only, direct-post guard và một kỳ mở. Kịch bản thật đã đi qua lập → duyệt/ghi sổ → hoàn bút → bút toán điều chỉnh chờ checker.
- Dashboard giám đốc, quản lý, kế toán và chuông/trợ lý chỉ dùng dữ liệu chốt ca, công việc và journal thực có; khi thiếu nguồn chi phí/lợi nhuận, UI báo thiếu dữ liệu thay vì dựng số.
- Quality gate của batch: typecheck, full lint, **145/145** unit/security/integration, clean production build và targeted maker–checker Playwright **2/2 desktop/mobile** qua. E2E cũ có assertion stock nên phải cập nhật theo workflow mới trước khi gọi full browser matrix xanh.

### 29/07/2026 — Chốt GitHub/Vercel làm production canonical

- Chủ dự án xác nhận cần cập nhật trực tiếp `https://ninhbinhjourney.vercel.app`; ChatGPT Sites không phải production target.
- Retire cả root và nested `.openai/hosting.json` khỏi Git, thêm ignore để mapping stale không quay lại; giữ lịch sử Sites bên dưới làm bằng chứng, không coi đó là trạng thái hiện hành.
- Quét staged source không thấy PAT/server secret; pre-deploy Playwright matrix qua **60**, skip **14** theo điều kiện project/viewport, không có failure.
- Push fast-forward app subtree `ea1b1517b32876a9e40bbfcf655b6137d064df9e` lên `qal1102/ninhbinhjourney/main`; Git integration tạo production deployment đầu tiên `dpl_3916tN52YkTKV5ibLyrjxCgBM2Ez`.
- Smoke đầu phát hiện `/api/health` trả `503` do hai public flag Vercel lưu sai định dạng. Ghi lại chính xác `NEXT_PUBLIC_EXPERIENCE_MODE=production` và `NEXT_PUBLIC_BRAND_CONCEPTS_ENABLED=false`, không chạm Supabase secret, rồi redeploy cùng source.
- Runtime deployment `dpl_73igvZzmW9KxGcKCC6UTYVJTbMLG` qua smoke **6/6**. Push commit tài liệu `b402194a13a2fd773797a6c888168d3bc1e54a83` tạo docs-inclusive deployment `dpl_tHVcspBUYUj74YiaiDwSM9M4RzWv`; tại lần kiểm tra 15:20, deployment `Ready`, `/`, `/erp`, `/api/health` đều `200` và final alias smoke qua **4/4** mobile/desktop.

### 29/07/2026 — Deploy UI bị chặn bởi Sites project không còn truy cập được

- Đối chiếu rollout gốc xác nhận Codex đã tạo đúng Sites project `Ninh Binh AI Journey` ngày 16/07/2026. Version 1 save thành công nhưng deploy thất bại vì push parent root thiếu `package.json`; source sau đó đã được sửa sang subtree `ninhbinhjourney/`, còn lần save tiếp theo thất bại vì token hết hạn. Project chưa từng có production URL Sites thành công.
- Đọc lại cả hai `.openai/hosting.json` và gọi đúng project ID đã lưu; connector authority hiện tại tiếp tục trả `404 project_not_found`.
- Kiểm tra metadata xác nhận connector registration vẫn là connector cũ, nhưng ChatGPT identity hiện tại không xuất hiện trong rollout tạo site ngày 16/07; khả năng phù hợp nhất là project thuộc identity/workspace cũ hoặc đã bị xóa. Không ghi email, account ID hay token vào repo.
- Kiểm tra trực tiếp browser và Vercel metadata: project `goldencard/ninhbinhjourney` cùng alias chính vẫn `Ready / Latest`, nhưng đó là dirty snapshot lúc 10:58 dựa trên commit `464aa8b`; các thay đổi ERP sau thời điểm đó chưa live.
- Trước checkpoint, source có 11 file tracked sửa đổi và 192 file app chưa được theo dõi; SHA `464aa8b` vì vậy không đại diện cho UI/ERP mới.
- Đã quét staged source không thấy PAT/server secret, commit toàn bộ 203 file app thành checkpoint `ef2e5d1`, rồi tạo branch subtree đóng băng `codex/sites-release-20260729` tại `68945ab2f54d72c74650cc2c37541ce3f954dc61`. Root của snapshot có đủ `.openai/hosting.json`, `package.json` và `app/`.
- Không tự thay project ID, tạo site trùng hoặc fallback sang target khác. Source local vẫn build/test xanh; migration 004/005 đã live nhưng UI mới chưa lên production.
- Cần khôi phục authority của Sites project cũ hoặc thực hiện chuyển hosting có kiểm soát trước khi push source, save version và deploy.

### 29/07/2026 — Harden GPS/evidence, quyền giao việc và màn duyệt của quản lý

- Quản lý nay xem được nội dung bàn giao, ảnh signed preview, metadata và audit trước khi duyệt/trả; bỏ iframe/link OpenStreetMap để không gửi tọa độ nhân viên sang bên thứ ba.
- Mỗi lần bàn giao hoặc gửi lại phiếu bắt buộc một ảnh/GPS mới nếu task yêu cầu evidence; trả lại sẽ xóa checkout cũ, mở lại GPS và ghi checkout mới khi gửi lại.
- Chặn accuracy rỗng/âm/ngoài `1–250 m`, phiếu ngày cũ, nhân viên hết hạn và quyền site/module đã bị thu hồi; GPS badge chỉ báo active sau khi máy chủ xác nhận.
- Ảnh dùng object UUID riêng, SHA-256, `upsert: false`; giữ object khi kết quả transition chưa rõ để không làm gãy evidence đã commit.
- Apply migration 005 sau preflight. Remote verification: trigger và integrity function có hiệu lực; location RPC chỉ `service_role` được execute; tổng số workflow giữ nguyên `2`.
- Thay thời gian giả “Cập nhật lúc 10:20” ở header module bằng nút `?` giải thích mục đích và trách nhiệm theo vai trò; desktop/mobile assertion hoàn tất nhưng Playwright runner Windows còn lỗi teardown.
- Quality gate cuối batch: typecheck, lint, build và **21 file / 128 test** qua. Không chạy full Playwright theo từng chỉnh sửa; full matrix để release candidate/pre-deploy/CI.

### 29/07/2026 — Chuẩn hóa nhịp kiểm thử theo batch và mức rủi ro

- Không chạy lại toàn bộ Playwright sau mỗi chỉnh sửa nhỏ.
- Trong lúc triển khai chỉ chạy lint/typecheck và unit/security/integration đúng phạm vi; Playwright targeted chạy sau khi hoàn tất một workflow.
- Full browser, mobile, visual, accessibility và cross-role matrix chuyển về release candidate, pre-deploy hoặc CI/nightly; production smoke chỉ chạy sau deploy.
- Nếu có dấu hiệu server test cũ, phải cô lập/dọn môi trường trước khi chạy lại; không dùng force-click hoặc sửa test để che lỗi sản phẩm.

### 29/07/2026 — Chứng minh chốt ca không báo thành công giả khi Supabase gián đoạn

- Thêm integration test gọi Server Action và repository thật, chỉ thay Supabase/session bằng mô hình lỗi có kiểm soát.
- Nhánh lỗi trước commit trả trạng thái lỗi, không có `recordId`, không ghi cookie và giữ nguyên toàn bộ FormData để thử lại.
- Nhánh remote đã commit nhưng lần đọc lại mất kết nối trả lỗi ở lượt đầu; các lượt retry dùng cùng idempotency key, trả cùng một hồ sơ và chỉ có một bản ghi.
- Targeted integration qua **2/2**; full Vitest tại thời điểm thêm test qua **17 file, 108/108**; typecheck và ESLint file mới đều qua.

### 29/07/2026 — Phiếu công việc trong ca, GPS/geofence và ảnh hiện trường bền

- Thêm state machine `erp-workday`, catalog công việc riêng cho Tràng An, Tam Cốc, Tam Chúc và Bái Đính, capability giao/thực hiện/duyệt cùng server action kiểm role, site, module, actor, version và idempotency.
- Thêm UI nhân viên từ nhận việc → GPS vào ca → báo tiến độ → ảnh đúng khu vực → bàn giao; quản lý giao đúng nhân viên/module, lọc theo cơ sở, xem freshness/khoảng cách/bản đồ và duyệt hoặc trả lại.
- Apply migration 004 lên Supabase: một seed, bốn geofence, ba bảng workflow/audit/location, ba RPC atomic, RLS, realtime publication và bucket ảnh riêng tư 5 MB. Xác minh remote có `1` workday, `1` audit, `4` geofence, `1` private bucket và `3` RPC ngay sau migration.
- E2E hai browser context qua toàn bộ vòng đời và chạy lại trên fixture hoàn thành vẫn qua; mobile Pixel 7 không tràn ngang. Phát hiện và sửa race condition khi nhịp GPS `revalidatePath` hủy response multipart tải ảnh.
- Khôi phục đúng ranh giới giữa hai luồng: ảnh theo nhiệm vụ nằm trong workday; báo cáo hiện trường ngoài kế hoạch vẫn dùng workspace riêng. Regression đăng nhập nhân viên → nhập mã hạch toán → tải ảnh → nhận mã `IMG-*` → mở chi tiết qua **1/1 desktop + 1/1 Pixel 7**, không tràn ngang.
- Quality gates hiện tại: lint/build qua, **106/106** unit/security qua, targeted Supabase desktop E2E **1/1** qua và mobile workday smoke **1 pass, 1 skip đúng điều kiện**.
- Chưa gọi đây là GPS nền: chỉ cập nhật khi ca mở và web/PWA đang hoạt động. Còn phải hoàn thiện consent/retention policy, missed punch/OT/leave, khóa bảng công/payroll, offline queue và UAT thực địa.
- Code UI/server chưa phát hành vì Sites project ID lưu trong `.openai/hosting.json` trả `404 project_not_found`. Migration 004 đã có trên remote; không được demo production UI mới cho tới khi sửa mapping/deploy và chạy production smoke.

### 29/07/2026 — Hoàn tất nhánh ngoại lệ, trả lại/gửi lại và chống xung đột chốt ca

- Thêm Server Action để nhân viên bổ sung và gửi lại đúng hồ sơ bị quản lý trả; UI hiển thị lý do trả, nội dung bổ sung và xác nhận sau refresh.
- Bổ sung kiểm tra `expectedVersion` trước mọi action quản lý, kế toán và giám đốc để trả thông báo xung đột rõ ràng cho phiên cũ.
- Thêm unit test cho vòng trả lại → gửi lại → duyệt và E2E local/Supabase cho return/resubmit, double-click, stale manager và material exception bắt buộc giám đốc.
- Supabase exception E2E qua với năm context, bốn vai trò và tám audit event. Full E2E qua **57 pass, 0 fail, 11 skip**; unit/security qua **97/97**; build Next.js 16.2.11 qua.
- Sửa kịch bản nhân viên thời vụ chờ đăng xuất hoàn tất trước khi đăng nhập quản lý, loại bỏ race condition của test ở tải cao.
- Deploy production `ninhbinhjourney-qaiikjas8-goldencard.vercel.app`; smoke alias chính qua **12/12** trên mobile/desktop. Assertion hàng đợi giám đốc đọc số hồ sơ động từ Supabase thay vì đóng cứng số 3.

### 28/07/2026 — Hoàn tất nền Supabase production và normal path đa tài khoản

- Di chuyển Management PAT khỏi `.gitignore` của app vào `D:\Ninh Binh\ninhbinh\.secrets`, chặn toàn thư mục bằng root `.gitignore` và giới hạn ACL; không ghi giá trị credential vào source/docs/log.
- Apply migration 003; xác minh hai bảng workflow/audit, hai RPC atomic, seed, RLS, grant/revoke, idempotency và service-role. Security Advisor không báo cảnh báo nào liên quan migration 003.
- Cấu hình Supabase runtime an toàn trên Vercel Production và bật `ERP_PERSISTENCE_MODE=supabase`.
- Sửa action chấm công không còn kẹt pending; sửa chốt ca để Server Action trả chính bản ghi đã commit, UI upsert theo version và giữ thẻ hồ sơ mở giữa các bước kế toán.
- Thêm E2E Supabase ba browser context; normal path nhân viên → quản lý → kế toán → nhân viên qua trong 14,9 giây.
- Chạy typecheck, full lint, 96/96 unit/security, build và full public + ERP + navigation E2E: 56 pass, 0 fail, 8 skip theo điều kiện.
- Deploy production `ninhbinhjourney-ojdx75fis-goldencard.vercel.app`; alias chính qua 12/12 smoke test mobile/desktop.

### 28/07/2026 — Bắt đầu G2 và xác minh đường cấu hình Vercel trực tiếp

- Xác nhận máy chưa có Supabase CLI và clipboard hiện không chứa PAT; không lấy lại token từ chat, không ghi token vào command, file hay log.
- Đối chiếu tài liệu Supabase hiện hành: dùng Management API để chạy SQL, lấy publishable/secret key và security advisor; secret key chỉ dùng server-side.
- Xác minh `.vercel/project.json` link đúng `goldencard/ninhbinhjourney`; `vercel ls` truy cập được các deployment hiện tại dù Sites project riêng vẫn 404.
- `vercel env ls` chỉ thấy `ERP_DEMO_SESSION_SECRET` ở Production; cần bổ sung URL, publishable key, server secret và `ERP_PERSISTENCE_MODE=supabase` sau khi có PAT tạm qua clipboard.
- Review local migration 003 và secret boundary; migration contract đã qua, repository có `server-only`, không tìm thấy PAT hoặc server secret có giá trị trong source/docs.
- Tìm thấy PAT hợp lệ tại file chủ dự án chỉ định và thêm root `.gitignore` để credential không bị commit. Preflight Management API xác nhận migration 003 chưa tồn tại trên remote.
- Lượt apply đầu bị Management API từ chối do payload SQL bị nhận sai kiểu; remote vẫn nguyên trạng. Trước khi retry bằng payload UTF-8 chặt chẽ, file PAT không còn tồn tại; chưa có lệnh xóa/di chuyển file và migration chưa được áp dụng.

### 28/07/2026 — Hoàn tất G1 và audit thanh menu ERP bằng browser

- Tách thanh menu desktop khỏi server shell sang `ErpDesktopNavigation`; giữ nguyên tám nhóm nghiệp vụ, URL, quyền và hamburger mobile.
- Bổ sung đóng dropdown bằng `Escape` có trả focus về trigger và đóng khi click ngoài; hành vi Tab/Enter và chỉ một nhóm mở được kiểm tra tự động.
- Thêm `tests/e2e/erp-navigation.spec.ts`, đo một hàng/overflow/panel viewport và chụp ảnh ở 1024, 1280, 1440, 1920 px; visual review xác nhận không còn lệch hàng, chồng panel hoặc cắt menu.
- Chạy lại typecheck, full lint, 96/96 unit/security, build và toàn bộ ERP + navigation E2E: 34 pass, 0 fail, 6 skip theo breakpoint.
- Dọn process test ở port 3100, quét không thấy management PAT/server secret có giá trị trong source/docs, và đánh dấu `BUILD_STATUS.md`/`EXECUTION_STATE.md` là snapshot lịch sử. `G1` hoàn tất; chuyển sang `G2` Supabase.

### 28/07/2026 — Đóng lỗi P0 server action và đưa toàn bộ ERP E2E về xanh

- Tách `ShiftCloseActionState` và `INITIAL_SHIFT_CLOSE_ACTION_STATE` sang `domain/erp-shift-close-action-state.ts`; module `app/erp/workflow-actions.ts` có `"use server"` hiện chỉ export bốn async actions đúng ràng buộc Next.js 16.
- Xác nhận `npm run typecheck`, `npm run lint`, `npm run test:run` (14 file, 96/96) và `npm run build` đều qua.
- Chạy targeted E2E cho chấm công GPS, quản lý xử lý ca và golden path xuyên nhân viên → quản lý → kế toán → giám đốc → hạch toán: 3/3 qua.
- Cập nhật assertion phân quyền module theo đúng UI riêng từng vai trò: quản lý thấy hàng đợi ca chờ xác nhận; nhân viên thấy form gửi chốt vé và tiền thu. Không thay đổi source để che lỗi test.
- Chạy lại toàn bộ `tests/e2e/erp-access.spec.ts` trên mobile/desktop: 33 pass, 0 fail, 5 skip theo breakpoint. `G1.2` hoàn tất; việc kế tiếp là `G1.3` visual/browser audit thanh menu desktop.

### 28/07/2026 — Tạo PLAN tổng thể, bổ sung golden path chốt ca và ghi nhận E2E đang đỏ

- Tạo `docs/PLAN.md` gồm 18 gói công việc cấp cao, bảng đếm trạng thái, thứ tự bắt buộc và Definition of Done cho website công khai, ERP, Supabase, tài liệu PDF/Excel/CSV, camera scan/OCR/AI, mobile, bảo mật, UAT và deploy.
- Cập nhật `AGENTS.md` để mọi cuộc trò chuyện mới bắt buộc đọc cả CODEX và PLAN; CODEX là lịch sử/trạng thái, PLAN là backlog còn lại.
- Ghi yêu cầu chất lượng: website công khai dùng tiếng Việt giàu cảm xúc nhưng cụ thể; ERP nghiêm túc, không khẩu hiệu; mỗi module phải hoạt động thật trên dữ liệu dùng chung và có nút `?` trợ giúp theo ngữ cảnh.
- Source local đã có golden path chốt ca xuyên nhân viên → quản lý → kế toán → giám đốc khi có ngoại lệ, gồm domain, repository cookie/Supabase, server actions, UI, dashboard, migration 003, seed và contract test.
- Sửa source navigation desktop ERP thành một hàng, cùng chiều cao/caret, chỉ một dropdown mở; visual browser audit còn chờ.
- Xác nhận typecheck, targeted lint/unit/security và build qua; full ERP E2E hiện 24 pass, 9 fail, 5 skip.
- Tái hiện lỗi action chốt ca HTTP 500 và xác định root cause Next.js: module `"use server"` export `INITIAL_SHIFT_CLOSE_ACTION_STATE` không phải async function. Đây là P0 tiếp theo.
- Tại thời điểm của mục nhật ký này, migration 003 chưa apply remote và source mới chưa deploy; các việc đó đã hoàn tất ở mục mới hơn phía trên. Sites mapping vẫn `404 project_not_found`; Management PAT phải rotate sau khi dùng.

### 28/07/2026 — Deploy tạm thời source hiện tại lên Vercel

- Deploy trực tiếp project `goldencard/ninhbinhjourney` qua Vercel CLI (`vercel deploy --prod --yes`) từ source local hiện tại.
- Build chạy trên Vercel thành công; alias production `https://ninhbinhjourney.vercel.app` trỏ sang deployment mới.
- Smoke nhanh: `/` và `/erp` đều trả `200` trên alias chính và URL deployment.
- Build local trên máy hiện tại không chạy được do khóa file trong `.next` (`EPERM`); không chặn deploy vì Vercel build remote qua.

### 28/07/2026 — Audit toàn bộ vai trò/workflow/module và bổ sung kế toán

- Bổ sung vai trò kế toán tổng hợp với phạm vi module/capability riêng, dashboard nguồn và bàn làm việc gồm chín hồ sơ chứng từ–hạch toán; thêm voice/deep-link cho nghiệp vụ kế toán.
- Bổ sung mô hình nhân sự chính thức/thời vụ/nhà thầu, thời hạn quyền, quản lý trực tiếp, trạm, ca và module đã đào tạo; thêm tài khoản nhân viên thời vụ để kiểm tra thực tế.
- Tách màn hình theo vai trò cho quản lý/nhân viên/kế toán; bổ sung workspace sự cố theo mức độ, SLA, SOP, bằng chứng và timeline.
- Làm lại tổng quan giám đốc theo ngoại lệ và quyết định: tách khách dự kiến/check-in, thêm độ phủ workforce, ma trận bốn cơ sở và hàng quyết định có mã hồ sơ/tác động/khuyến nghị.
- Tạo `docs/ERP_ROLE_MODULE_AUDIT_VI.md` và `docs/ERP_ACCOUNTING_REQUIREMENTS_VI.md`; kết luận tám nhóm module đúng hướng nhưng workflow xuyên vai trò/shared persistence vẫn là khoảng trống ưu tiên.
- Xác nhận typecheck, lint, build, 81/81 unit test và 32/32 ERP E2E áp dụng đều qua; 4 bài desktop-only skip đúng thiết kế.
- Chưa deploy/smoke được source mới vì Sites project trong `.openai/hosting.json` đang stale/không khả dụng (`404 project_not_found`); không có URL/version mới. Approval, maker–checker, quyết định và đóng sự cố hiện vẫn là demo/local state hoặc deep-link, chưa được coi là workflow production.

### 28/07/2026 — Hợp nhất dữ liệu tài chính và gộp menu ERP

- Tạo một nguồn tài chính chung cho Ngày/Tháng/Quý/Năm; đồng bộ tổng quan giám đốc, `/erp/finance` và tài chính từng cơ sở.
- Sửa các phép cân đối: doanh thu bằng chi phí cộng lợi nhuận; tổng cơ cấu và tổng bốn cơ sở khớp toàn vùng.
- Thêm 3 unit test bất biến để ngăn dữ liệu tài chính lệch trở lại.
- Gộp 15 module thành 8 nhóm nghiệp vụ trên desktop và mobile, giữ nguyên URL, quyền và voice deep-link.
- Xác nhận typecheck, lint, build, 66 unit test và 28 ERP E2E áp dụng đều qua.
- Deploy production `ninhbinhjourney-jsykoavor-goldencard.vercel.app` và xác nhận 6/6 production smoke test áp dụng qua trên alias chính.
- Bổ sung phần “Đọc trong 2 phút” để người mới hiểu ngay hai bề mặt sản phẩm, ba vai trò, luồng demo và ranh giới giữa chức năng đã chạy với tích hợp còn mô phỏng.

### 28/07/2026 — Đối chiếu tài liệu đánh giá chuyên môn

- Đọc bản `Danh_gia_va_dinh_huong_demo_he_thong_Xuan_Truong.docx` và đối chiếu với source hiện tại.
- Kết luận tài liệu đúng hướng 80–85% cho mục tiêu demo, nhưng một số nhận định đã lạc hậu sau các thay đổi mới.
- Ghi nhận lỗi ưu tiên mới: các bộ số tài chính hard-code đang không thống nhất giữa tổng quan, màn tài chính sâu và từng cơ sở.
- Chưa tự động triển khai roadmap 14 ngày hoặc đổi menu/role switcher theo tài liệu.

### 27/07/2026 — Tạo hồ sơ bàn giao Codex

- Tạo `docs/CODEX.md` làm nguồn trạng thái chung cho các cửa sổ trò chuyện.
- Thêm quy tắc bắt buộc đọc/cập nhật file vào `AGENTS.md`.
- Ghi lại trạng thái production, ERP, Supabase, kiểm thử và đề xuất gộp menu hiện tại.

### 27/07/2026 — Gộp tài chính vào tổng quan giám đốc

- Thay các link tài chính trùng lặp bằng một khối Tài chính hợp nhất.
- Thêm kỳ Ngày/Tháng/Quý/Năm và drill-down theo đúng chỉ số được bấm.
- Deploy production và xác nhận smoke test mobile/desktop 2/2 qua.

### 27/07/2026 — Bổ sung workspace vận hành chi tiết

- Thêm báo cáo ảnh hiện trường, QR/check-in, vé & chốt ca, tiến độ nhân sự, đối tác/NCC/báo giá/phản hồi.
- Bổ sung schema Supabase tương ứng, kiểm thử responsive và deploy production.
