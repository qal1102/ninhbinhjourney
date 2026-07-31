# PLAN — Kế hoạch hoàn thiện Ninh Bình Journey và ERP

> Đây là danh sách việc còn lại để đưa toàn bộ sản phẩm tới mức sẵn sàng nghiệm thu.
> `docs/CODEX.md` trả lời **đã làm gì, đang ở trạng thái nào**. File này trả lời **còn phải làm gì, làm theo thứ tự nào và dựa vào đâu để gọi là xong**.

## 0. Cách dùng file này trong mọi cuộc trò chuyện

1. Đọc toàn bộ `docs/CODEX.md` để nắm lịch sử, trạng thái source, dữ liệu, test, deploy và lỗi đang mở.
2. Đọc toàn bộ file `docs/PLAN.md` này trước khi chọn việc tiếp theo.
3. Chỉ lấy việc có trạng thái `[~]`, `[ ]` hoặc `[!]` theo đúng thứ tự ưu tiên; không tự mở rộng module khi workflow hiện tại chưa đóng vòng.
4. Trước khi sửa, ghi rõ mã việc đang làm, ví dụ `G8.3`.
5. Sau khi sửa:
   - chạy đúng bộ kiểm thử được ghi tại tiêu chí nghiệm thu;
   - cập nhật trạng thái trong PLAN;
   - cập nhật trạng thái hiện tại và nhật ký trong CODEX;
   - ghi đúng điều đã kiểm chứng, không gọi dữ liệu demo là dữ liệu thật hoặc realtime.
6. Không đánh dấu `[x]` chỉ vì giao diện đã có. Một việc chỉ hoàn tất khi có bằng chứng về chức năng, quyền, dữ liệu, lỗi, mobile và kiểm thử.

### Ký hiệu trạng thái

- `[x]` Hoàn tất và đã có bằng chứng kiểm tra.
- `[~]` Đang làm hoặc đã có một phần nhưng chưa đạt tiêu chí nghiệm thu.
- `[ ]` Chưa bắt đầu hoặc chưa đủ bằng chứng.
- `[!]` Đang bị chặn bởi quyền truy cập, dữ liệu khách hàng, hạ tầng hoặc quyết định của chủ dự án.
- `[?]` Cần khách hàng/chủ dự án xác nhận trước khi triển khai.

## 1. Bảng đếm tổng thể

Kế hoạch còn **18 gói công việc cấp cao**:

| Mã | Gói công việc | Trạng thái hiện tại |
|---|---|---|
| G0 | Hồ sơ bàn giao và quy tắc tiếp tục | `[x]` |
| G1 | Ổn định source hiện tại và xử lý lỗi đang mở | `[x]` |
| G2 | Supabase, secret và môi trường chạy thật | `[~]` |
| G3 | Chuẩn hóa dữ liệu nguồn, nội dung và ngôn ngữ | `[ ]` |
| G4 | Hoàn thiện trải nghiệm website du lịch công khai | `[ ]` |
| G5 | Hoàn thiện hành trình, booking và dịch vụ cho du khách | `[ ]` |
| G6 | Nền tảng ERP: tài khoản, quyền, cơ sở, ca và master data | `[~]` |
| G7 | Trung tâm tài liệu: PDF, Excel, CSV, scan, OCR và AI | `[ ]` |
| G8 | Golden path vé–chốt ca–kế toán–ngoại lệ | `[~]` |
| G9 | Kế toán và kiểm soát tài chính trọn vòng đời | `[~]` |
| G10 | Các workflow vận hành còn lại theo tám nhóm module | `[~]` |
| G11 | Màn giám đốc, báo cáo quản trị và dự báo | `[ ]` |
| G12 | Trợ lý điều hành văn bản/giọng nói và tự động hóa có kiểm soát | `[ ]` |
| G13 | Tích hợp nguồn thật, realtime và Camera AI | `[ ]` |
| G14 | Mobile, PWA, thông báo và offline | `[~]` |
| G15 | Bảo mật, tuân thủ, độ tin cậy và vận hành hệ thống | `[ ]` |
| G16 | Kiểm thử toàn bộ vòng đời, UAT và audit cuối | `[ ]` |
| G17 | Phát hành production, quan sát, backup và bàn giao | `[~]` |

Tổng hợp cập nhật ngày 31/07/2026:

- Hoàn tất: **2/18**.
- Đang làm/đã có một phần: **7/18** (`G9` chuyển từ `[ ]` sang `[~]` sau khi xác minh batch AP–NCC chưa commit đã có nền trên Supabase remote).
- Bị chặn: **0/18**.
- Chưa hoàn tất còn lại: **9/18**.

Con số này đo mức **sẵn sàng vận hành/ready**, không phủ nhận những giao diện và tính năng demo đã có.

## 2. Các nguyên tắc không được phá vỡ

### 2.1. Hai sản phẩm, hai giọng nói

1. Website công khai ở `/` dành cho du khách.
2. ERP nội bộ ở `/erp`, không trộn vào trang chủ và không tạo một deployment riêng chỉ vì đây là route ẩn.
3. Website công khai dùng tiếng Việt giàu hình ảnh, mời gọi, gợi ý và gần gũi như một lá thư dẫn người đọc đi qua Ninh Bình:
   - ưu tiên cảnh sắc, nhịp đi, thời điểm, cảm giác và lời khuyên có ích;
   - không dùng câu sáo rỗng kiểu “trải nghiệm đẳng cấp”, “hành trình khác biệt”, “giải pháp toàn diện” nếu không nói rõ khác ở đâu;
   - tiếng Anh, nếu có, phải được biên tập như ngôn ngữ bản địa, không dịch từng chữ bằng máy.
4. ERP dùng tiếng Việt nghiêm túc, ngắn và đúng nghiệp vụ:
   - tên hành động phải cho biết kết quả, ví dụ “Xác nhận và chuyển kế toán”;
   - trạng thái phải nói đúng hồ sơ đang ở đâu và đang chờ ai;
   - không đưa lời giải thích về “bản demo”, “trải nghiệm”, “màn hình này giúp…” vào phần nội dung chính.
5. Giải thích chỉ xuất hiện khi người dùng chủ động bấm nút `?` trợ giúp theo ngữ cảnh.

### 2.2. Không có chức năng trang trí

1. Một module không được tính là tồn tại nếu chỉ có một card, một dòng mô tả, số ngẫu nhiên hoặc nút không tạo thay đổi thật.
2. Mỗi module phải có tối thiểu:
   - danh sách hoặc tổng quan có nguồn dữ liệu;
   - trạng thái loading, empty, error và permission denied;
   - chi tiết một hồ sơ có mã duy nhất;
   - hành động đúng vai trò;
   - lịch sử/audit;
   - tìm kiếm hoặc bộ lọc cần thiết;
   - liên kết tới bước trước và bước sau của workflow;
   - kiểm thử click qua hành động chính.
3. Sau khi nối Supabase, refresh, đăng xuất/đăng nhập lại và mở thiết bị khác vẫn phải thấy cùng hồ sơ theo đúng quyền.
4. Chỉ gọi là realtime khi có subscription/event thật, timestamp/freshness, reconnect và cách xử lý event trùng hoặc mất kết nối.

### 2.3. Không để người dùng làm lại việc bằng tay

1. Dữ liệu đã nhập ở bộ phận nguồn phải chảy sang bộ phận tiếp theo trên cùng mã hồ sơ.
2. Kế toán không nhập lại số vé, tiền, bảng công, nghiệm thu hoặc tài liệu mà bộ phận khác đã gửi.
3. Mọi số tổng hợp phải truy xuống được nguồn, thời điểm, người xác nhận và trạng thái đối soát.
4. Hệ thống chỉ hỏi người dùng phần dữ liệu chưa có hoặc cần phán đoán; không bắt họ điền lại trường đã biết.
5. Các thao tác lặp lại phải hỗ trợ mẫu, sao chép kỳ trước, import, quét tài liệu hoặc tự điền có xác nhận.

### 2.4. Trợ giúp theo ngữ cảnh

1. Mỗi trang/module có nút `?` dễ thấy nhưng không lấn át công việc chính.
2. Khi mở, trợ giúp trả lời tối đa các ý:
   - màn hình này dùng để xử lý việc gì;
   - ai được xem và ai được thao tác;
   - dữ liệu đến từ đâu và cập nhật đến lúc nào;
   - quy trình trước/sau là gì;
   - ý nghĩa thuật ngữ/chỉ số;
   - phải làm gì khi thiếu dữ liệu hoặc gặp lỗi.
3. Nội dung trợ giúp phải theo đúng module và vai trò, không dùng một đoạn chung cho toàn ERP.
4. Trợ giúp đóng bằng nút đóng, backdrop và Escape; có thể tìm kiếm, mở trên mobile và không làm mất dữ liệu form đang nhập.
5. Nội dung trợ giúp có version, người phụ trách và ngày rà soát; không hard-code kiến thức pháp lý dễ lỗi thời mà không ghi nguồn/ngày hiệu lực.
6. Thiết kế dữ liệu tối thiểu gồm bài trợ giúp, thuật ngữ và binding theo route/module/role/workflow version; cùng module có thể giải thích khác cho nhân viên và kế toán.
7. Desktop dùng drawer/dialog; mobile dùng bottom sheet; hỗ trợ keyboard, focus trap, screen reader và cache offline cho module hiện trường.
8. Có tìm kiếm và phản hồi “Có hữu ích không?” để biết phần nào người dùng vẫn không hiểu; không thu nội dung form nhạy cảm vào analytics trợ giúp.

## 3. Định nghĩa “READY”

### 3.1. Website công khai chỉ được gọi là ready khi

1. Không có link hỏng, nút chết, ảnh sai địa danh, văn bản placeholder, lỗi ngôn ngữ hoặc thành phần tràn ngang.
2. Intro đủ bốn nhịp theo nội dung đã duyệt, font mềm, khoảng delay dễ đọc, bỏ qua được và tôn trọng reduced motion.
3. Logo, menu, chuyển ngôn ngữ, khám phá điểm đến, bản đồ, route builder, hành trình, gói dịch vụ và booking sandbox chạy xuyên suốt.
4. Nội dung tiếng Việt được đọc lại thủ công theo giọng marketing đã chốt; tiếng Anh được kiểm tra riêng.
5. Mobile 320 px đến desktop lớn dùng được bằng chạm/bàn phím; không bắt kéo ngang.
6. Không có lỗi accessibility mức serious/critical; dialog, map và focus đúng.
7. Có SEO metadata, sitemap, robots, structured data phù hợp, preview chia sẻ và URL canonical.
8. Build, test, kiểm tra hiệu năng và smoke production đều qua trên bản deploy cuối.

### 3.2. ERP chỉ được gọi là ready khi

1. Tất cả tài khoản dùng auth thật; quyền được kiểm tra ở server/database, không chỉ ẩn nút trên giao diện.
2. Mỗi vai trò thấy đúng cơ sở, ca, trạm, thời hạn và capability.
3. Mỗi module quan trọng có workflow bền vững trên Supabase, audit bất biến và dữ liệu dùng chung giữa các tài khoản.
4. Giám đốc chỉ thấy ngoại lệ/việc cần quyết định; quản lý chỉ thấy việc cơ sở; nhân viên chỉ thấy việc mình; kế toán nhận đúng hồ sơ đã được xác nhận.
5. Tài chính cân đối, truy được nguồn và có maker–checker; không ai tự lập rồi tự duyệt trái quy tắc.
6. Mobile dùng được theo chiều dọc, thao tác chính trong ít bước, PWA/notification/offline có hành vi rõ.
7. Tài liệu PDF/Excel/CSV/ảnh scan được nhập, kiểm tra, version, tìm kiếm, liên kết hồ sơ và xuất lại.
8. Mọi hành động thất bại không tạo trạng thái giả thành công; retry/idempotency ngăn gửi trùng.
9. Có monitoring, backup, khôi phục, audit truy cập và quy trình xử lý sự cố.
10. UAT theo toàn bộ vai trò và vòng đời thật đã được ký xác nhận.

## 4. G0 — Hồ sơ bàn giao và quy tắc tiếp tục `[x]`

### Việc phải có

- [x] `docs/CODEX.md` là nhật ký những gì đã làm, test/deploy thực tế và lỗi đang mở.
- [x] `docs/PLAN.md` là backlog còn lại, có mã, thứ tự và tiêu chí nghiệm thu.
- [x] `AGENTS.md` yêu cầu cuộc trò chuyện mới đọc cả hai file.
- [x] Không ghi token, service secret, mật khẩu production hoặc khóa API thật vào hai tài liệu.

### Tiêu chí nghiệm thu

- Một cuộc trò chuyện mới chỉ cần đọc `AGENTS.md`, `CODEX.md` và `PLAN.md` là biết:
  - hai bề mặt sản phẩm;
  - source đang ở đâu;
  - việc nào đã làm;
  - lỗi/blocker nào đang tồn tại;
  - việc kế tiếp có mã gì;
  - không được tuyên bố điều gì khi chưa kiểm chứng.

## 5. G1 — Ổn định source hiện tại và xử lý lỗi đang mở `[x]`

### G1.1. Chốt trạng thái source

- [x] Kiểm tra `git status`, phân biệt thay đổi của chủ dự án và thay đổi Codex; không xóa hoặc reset file không thuộc phạm vi.
- [x] Kiểm tra không có process test/dev bị treo từ lượt trước; port 3100 đã được dọn sau audit.
- [x] Quét source/docs ngoài dependency và artifact: không tìm thấy management PAT hoặc `SUPABASE_SECRET_KEY` có giá trị.
- [x] Chạy lại typecheck, lint, unit/security test và build từ trạng thái source sau sửa P0: tất cả qua ngày 28/07/2026.

### G1.2. Sửa lỗi mutation ERP vừa được E2E phát hiện

- [x] Đã tái hiện lỗi khi quản lý duyệt chốt ca: POST tới route module trả HTTP 500 và hồ sơ vẫn ở “Chờ quản lý”.
- [x] Đã xác định nguyên nhân trực tiếp trong log Next.js 16: `app/erp/workflow-actions.ts` có `"use server"` nhưng export object `INITIAL_SHIFT_CLOSE_ACTION_STATE`; module server action chỉ được export async function (`invalid-use-server-value`).
- [x] Chuyển type/initial state sang `domain/erp-shift-close-action-state.ts`; giữ `workflow-actions.ts` chỉ export async server actions, không export state/object.
- [x] Tái kiểm tra chấm công/attendance refresh sau khi bỏ lỗi bundle server action: targeted và full E2E đều qua.
- [x] Sửa nguyên nhân, không sửa test để che lỗi.
- [x] Kiểm tra mọi action trong phạm vi local `demo-cookie`:
  - không hiển thị thành công khi database/cookie thất bại;
  - không rơi vào màn “Dữ liệu chưa thể đồng bộ”;
  - dữ liệu form không mất vô cớ;
  - gửi trùng không tạo hai hồ sơ.
- [x] Happy path, fail-closed/idempotency/version đã có unit/security/E2E; vẫn cần kiểm thử trình duyệt riêng cho mất kết nối và giữ form khi `G15` làm resilience.
- [x] Chạy lại E2E quản lý và golden path xuyên vai trò: targeted 3/3; full ERP desktop/mobile 33 pass, 0 fail, 5 skip theo breakpoint.

### G1.3. Hoàn tất sửa thanh menu desktop ERP

- [x] Source đã đổi menu thành một hàng, trigger/link cùng chiều cao, caret SVG căn giữa, chỉ mở một dropdown và neo dropdown cuối về phải.
- [x] Kiểm tra bằng browser ở 1024, 1280, 1440 và 1920 px; có ảnh audit trong artifact local.
- [x] Xác nhận bằng geometry assertion và visual review: không cắt panel, không chồng panel, không xuống dòng, không tràn ngang.
- [x] Tách `ErpDesktopNavigation` thành client component; Tab/Enter/Escape, chỉ một dropdown và click ngoài vùng đều có E2E.
- [x] Xác nhận menu hamburger mobile không bị ảnh hưởng qua full ERP E2E và kiểm tra overflow.

### G1.4. Đồng bộ tài liệu trạng thái

- [x] Đánh dấu `BUILD_STATUS.md` và `EXECUTION_STATE.md` là snapshot lịch sử, dẫn về CODEX/PLAN để không mâu thuẫn.
- [x] Test fail tạm thời và kết quả sửa lại đã được ghi vào CODEX; trạng thái cuối của G1 không còn test fail.

### Tiêu chí nghiệm thu G1

- `npm run typecheck`, `npm run lint`, `npm run test:run`, `npm run build` đều qua.
- E2E mục tiêu cho chấm công, quản lý duyệt và golden path qua trên desktop; mobile smoke không tràn ngang.
- Không còn global error page trong hành động hợp lệ.
- Full ERP + navigation E2E đã chạy lại từ đầu ngày 28/07/2026: **34 pass, 0 fail, 6 skip**. Sáu lượt skip là bài chỉ áp dụng cho breakpoint còn lại, không phải lỗi.

## 6. G2 — Supabase, secret và môi trường chạy thật `[~]`

### Trạng thái đã biết

- Supabase project đã xác định và đang healthy.
- Migration `202607240001_secure_shared_core.sql` và `202607270002_erp_realtime_core.sql` đã được chạy từ lượt trước.
- Migration `202607280003_erp_shift_close_workflow.sql` đã apply và verify remote.
- Management PAT nằm ngoài app trong root `.secrets`, bị Git bỏ qua và ACL giới hạn. PAT không nằm trong source/docs/env nhưng đã từng xuất hiện trong chat, vì vậy vẫn phải thu hồi/rotate.
- Sites project thử nghiệm ngày 16/07/2026 chưa từng có production URL thành công. Chủ dự án đã chốt production canonical là Vercel project hiện hữu `goldencard/ninhbinhjourney`; hai mapping Sites stale được retire khỏi Git và chặn quay lại bằng `.gitignore`.
- Vercel Production đã có Supabase URL, publishable key, server secret dạng sensitive, `ERP_PERSISTENCE_MODE=supabase`, production flags và site URL.

### G2.1. Secret an toàn

- [x] PAT được đặt ngoài app trong `.secrets`, root `.gitignore` chặn và ACL chỉ cho tài khoản máy hiện tại; Codex không in giá trị vào log/tài liệu.
- [x] Dùng PAT để chạy/kiểm tra migration; không lưu PAT trong `.env`, source, docs hoặc `NEXT_PUBLIC_*`.
- [ ] Thu hồi/rotate PAT sau khi hoàn tất.
- [x] Lấy publishable key cho client và secret/server key cho server bằng Management API mà không in giá trị.
- [x] Lưu runtime secret trong encrypted/sensitive environment của Vercel; không tạo `.env.local` chứa key thật.
- [x] Repository dùng `import "server-only"`; source scan không thấy PAT/server secret có giá trị và không có biến secret mang tiền tố `NEXT_PUBLIC_*`. Cần giữ check này trong gate phát hành.

### G2.2. Migration và dữ liệu

- [x] Review local migration 003 và contract: `create table if not exists`, constraint/RPC/audit/RLS/grant/revoke/seed idempotent; production rollback sẽ dùng forward-fix, không xóa dữ liệu.
- [x] Chạy migration 003 lên project.
- [x] Preflight read-only xác nhận hai bảng migration 003 chưa tồn tại; lần apply payload sai kiểu không tạo thay đổi remote.
- [x] Kiểm tra bảng, RPC, RLS, grant/revoke, seed và security advisor; 29 cảnh báo còn lại thuộc function schema cũ, không thuộc migration 003.
- [x] Kiểm tra anon/authenticated không thể đọc bảng hoặc gọi RPC demo service-role.
- [x] Kiểm tra service server-side tạo/chuyển workflow atomic, khóa version, audit và idempotency.
- [x] Chạy test tích hợp với khóa thật nhưng không in khóa ra log.

### G2.3. Môi trường

- [x] Chủ dự án xác nhận dùng project Vercel hiện hữu `goldencard/ninhbinhjourney`; migration khỏi Sites mapping chưa từng live đã được phê duyệt và thực hiện có kiểm soát.
- [~] Cấu hình production/staging env; Production đã xong, staging còn thiếu:
  - `NEXT_PUBLIC_SUPABASE_URL`;
  - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`;
  - `SUPABASE_SECRET_KEY` chỉ server;
  - `ERP_PERSISTENCE_MODE=supabase`;
  - session/cookie secrets;
  - site URL;
  - storage, push và connector secrets khi có.
- [ ] Tách staging và production project/data.
- [ ] Có health check cho database, storage và connector.

### Tiêu chí nghiệm thu G2

- Không có secret thật trong git.
- Migration remote và security checks qua.
- Hai browser context khác nhau thấy cùng hồ sơ đúng quyền.
- Hosting runtime dùng `supabase`, không fallback ngầm sang cookie khi lỗi.
- Có URL staging hoạt động trước production.

## 7. G3 — Chuẩn hóa dữ liệu nguồn, nội dung và ngôn ngữ `[ ]`

### G3.1. Nguồn sự thật

- [ ] Lập data dictionary cho cơ sở, địa danh, sản phẩm, giá, tuyến, thời gian, sức chứa, KPI, tài khoản kế toán, trạng thái và mã hồ sơ.
- [ ] Mỗi trường có owner, nguồn, tần suất cập nhật, đơn vị, timezone, nullable rule và độ nhạy.
- [ ] Phân biệt rõ dữ liệu thật, dữ liệu seed demo và dữ liệu dự báo.
- [ ] Loại các bộ số hard-code trùng nhau; một chỉ số chỉ có một nguồn tính.
- [ ] Mọi ảnh điểm đến có tên địa danh đúng, nguồn/quyền sử dụng và focal point.

### G3.2. Biên tập website du lịch

- [ ] Audit toàn bộ chuỗi tiếng Việt và tiếng Anh ở `/`, destination, explore, plan, package, checkout, booking, journey, pass và error states.
- [ ] Xóa câu robot, CTA mơ hồ, câu khoe công nghệ và khẩu hiệu không có thông tin.
- [ ] Viết lại tiếng Việt theo cấu trúc:
  - một câu gợi cảm giác;
  - một thông tin địa phương cụ thể;
  - một gợi ý thời điểm/nhịp đi;
  - một CTA mềm nhưng rõ hành động.
- [ ] Có glossary tên riêng: Tràng An, Tam Cốc, Bái Đính, Tam Chúc, Hoa Lư, Hang Múa… và quy tắc dấu câu/chữ hoa.
- [ ] Review thủ công bởi người Việt; review riêng bản tiếng Anh.

### G3.3. Biên tập ERP

- [ ] Audit từng label, trạng thái, validation, thông báo, empty/error/help.
- [ ] Dùng thuật ngữ đúng phòng ban; tránh “xử lý”, “xác nhận”, “phê duyệt” chung chung khi có thể nói chính xác đối tượng.
- [ ] Mỗi status trả lời “đang chờ ai/làm gì”.
- [ ] Thông báo thành công ghi mã hồ sơ và bước tiếp theo.
- [ ] Thông báo lỗi ghi cách khắc phục, không lộ lỗi database/secret.
- [ ] Tách nội dung trợ giúp ra khỏi UI chính sang nút `?`.

### Tiêu chí nghiệm thu G3

- Không còn placeholder/demo explanation/sáo ngữ trong production UI.
- Danh sách chuỗi được review có người, ngày và trạng thái.
- Ảnh và số liệu có nguồn rõ.

## 8. G4 — Hoàn thiện website du lịch công khai `[ ]`

### G4.1. Intro và nhận diện

- [ ] Giữ đúng bốn nhịp mở đầu theo nội dung cuối được duyệt; nếu ưu tiên Việt hóa thì bốn nhịp phải là tiếng Việt có nghĩa, không ghép từ cho đẹp.
- [ ] Chọn font mềm, có độ tương phản nét và hỗ trợ dấu tiếng Việt đầy đủ.
- [ ] Thêm delay đủ để từng chữ không đè/chồng; tổng thời gian ngắn và không chặn người dùng.
- [ ] Có skip theo thời gian/click, reduced motion và không chạy lại gây phiền trong cùng phiên.
- [ ] Logo Ninh Bình sắc nét ở header, favicon, PWA và social preview.

### G4.2. Header, menu và ngôn ngữ

- [ ] Desktop/mobile nav căn hàng, đủ contrast và sticky hợp lý.
- [ ] Hamburger hoạt động, focus trap đúng và không che CTA.
- [ ] Chuyển VI/EN cập nhật tức thì, giữ qua refresh và giữ query/source.
- [ ] Không có link dẫn tới trang rỗng.

### G4.3. Hero và nhịp nội dung

- [ ] Hero dùng ảnh đúng địa danh, crop đúng và tải nhanh.
- [ ] Copy đủ tình, cụ thể và không biến thành landing page SaaS.
- [ ] Mỗi section có một nhiệm vụ: truyền cảm hứng, giúp chọn, giúp lập lịch hoặc giúp đặt dịch vụ.
- [ ] Giảm card/nested card; ưu tiên ảnh, khoảng trắng và typography editorial.
- [ ] CTA chính/phụ rõ và đều hoạt động.

### G4.4. Điểm đến và bản đồ

- [ ] Bái Đính, Tam Cốc, Tràng An, Tam Chúc dùng đúng ảnh/nội dung.
- [ ] Map marker ↔ story card ↔ detail panel đồng bộ.
- [ ] `?source=` focus đúng điểm; fallback có chủ đích.
- [ ] Popup/modal luôn nằm trên Leaflet; đóng bằng nút, backdrop, Escape.
- [ ] Geolocation opt-in, có trạng thái từ chối/quá thời gian.
- [ ] Nội dung điểm đến có thời lượng, thời điểm, đông/vắng, di chuyển, phù hợp nhóm khách và lưu ý.

### G4.5. Route builder và hành trình

- [ ] “Build a route” tạo được tuyến có kết quả rõ.
- [ ] Add/replace/remove/reorder hoạt động và cập nhật tổng thời gian.
- [ ] Kiểm tra giờ mở cửa, thời gian di chuyển, trùng lịch và điểm đóng cửa.
- [ ] Có empty/loading/error và fallback khi API/map lỗi.
- [ ] Lưu/khôi phục hành trình sau refresh; chia sẻ link không lộ dữ liệu cá nhân.

### G4.6. Chất lượng kỹ thuật

- [ ] SEO metadata, sitemap, robots, canonical, Open Graph, structured data.
- [ ] Ảnh responsive, sizes đúng, không tải ảnh quá lớn.
- [ ] Font preload/subset hợp lý, không layout shift.
- [ ] Keyboard, screen reader, contrast, focus và reduced motion.
- [ ] Kiểm tra Chrome, Edge, Safari/iOS và Android.
- [ ] Mục tiêu lab: không lỗi console, không request 404, Lighthouse Accessibility/SEO/Best Practices từ 90 trở lên; hiệu năng được ghi theo thiết bị/mạng cụ thể.

### Tiêu chí nghiệm thu G4

- Bộ E2E public chạy trên mobile/desktop.
- Content review VI/EN được chốt.
- Screenshot audit ở các breakpoint.
- Production smoke qua cho `/`, destination, explore, plan và language/source URL.

## 9. G5 — Hành trình, booking và dịch vụ du khách `[ ]`

### G5.1. Luồng khám phá đến booking

- [ ] Điểm đến/gói dịch vụ có giá, điều kiện, quyền lợi, thời lượng và tình trạng rõ.
- [ ] Chọn ngày/số khách/sản phẩm có validation.
- [ ] Quote, checkout, booking, pass và QR dùng cùng mã giao dịch.
- [ ] Sandbox phải nói rõ chưa thu tiền thật; khi tích hợp payment mới đổi copy.
- [ ] Booking confirmation, email/SMS/push và trang xem lại có trạng thái lỗi/retry.

### G5.2. Quản lý thay đổi

- [ ] Chính sách hoàn/đổi/hủy hiển thị trước xác nhận.
- [ ] Sửa booking, hủy, hoàn và no-show có workflow/audit.
- [ ] Inventory/slot ngăn bán vượt sức chứa.
- [ ] Giá/khuyến mại/hoa hồng có hiệu lực theo ngày và kênh.

### G5.3. Dữ liệu cá nhân

- [ ] Thu tối thiểu dữ liệu cần thiết, có consent và retention.
- [ ] Mask thông tin nhạy cảm trên màn vận hành.
- [ ] Pass/QR token không đoán được, có expiry và chống dùng lại.

### Tiêu chí nghiệm thu G5

- E2E từ khám phá → hành trình → quote → checkout sandbox → booking → pass → check-in.
- Các nhánh hết chỗ, mã sai, thanh toán lỗi mô phỏng, hủy/hoàn đều có test.

## 10. G6 — Nền tảng ERP: tài khoản, quyền, cơ sở, ca và master data `[~]`

### G6.1. Auth và tổ chức

- [ ] Chuyển demo account sang Supabase Auth/SSO hoặc cơ chế doanh nghiệp đã duyệt.
- [ ] Mô hình tenant/pháp nhân, bốn cơ sở, bộ phận, trạm, ca và line manager.
- [ ] Mời/kích hoạt/khóa/đặt lại mật khẩu/MFA/session/device.
- [ ] Không để mật khẩu demo mặc định trong production.

### G6.2. Capability và phân tách nhiệm vụ

- [ ] Quyền theo role + site + module + action + active shift + thời hạn + training.
- [ ] Tách create/review/approve/post/close/export/admin.
- [ ] Kế toán lập ≠ checker duyệt; quản lý không tự duyệt hồ sơ mình tạo.
- [ ] Nhân viên thời vụ hết ca/hết hạn mất quyền tự động.
- [ ] RLS và server action kiểm cùng một policy; test denied trực tiếp qua API.

### G6.3. Master data

- [ ] Danh mục site/zone/gate/station/route/product/ticket/channel/vendor/asset/project/cost center/account code/SOP/SLA.
- [ ] Version/effective date, import/export, owner và approval khi thay đổi nhạy cảm.
- [ ] Không cho xóa master đã được giao dịch tham chiếu; dùng inactive/archive.

### G6.4. Shell dùng chung

- [ ] Menu chỉ hiện module có quyền; mỗi module click vào có dữ liệu/chức năng thật.
- [ ] Search/command palette mở hồ sơ bằng mã, tên, khách, NCC, tài sản, dự án.
- [ ] Notification center đúng người, đúng mức độ; giám đốc không nhận việc thường.
- [ ] Nút `?` trợ giúp theo module/role.
- [ ] Breadcrumb, recent items, favorites và quick action giảm số lần bấm.

### Tiêu chí nghiệm thu G6

- Ma trận role/capability được khách hàng duyệt.
- Automated tests cho mọi allow/deny quan trọng.
- Tài khoản bị khóa/hết hạn/đổi phân công có hiệu lực tức thì.

## 11. G7 — Trung tâm tài liệu: PDF, Excel, CSV, scan, OCR và AI `[ ]`

### G7.1. Loại tài liệu và nhập liệu

- [ ] Upload PDF, PDF nhiều trang, XLS/XLSX, CSV, JPG/PNG/HEIC theo giới hạn cấu hình.
- [ ] Kéo thả, chọn file, import hàng loạt và camera scan trên điện thoại.
- [ ] Camera scan hỗ trợ crop, xoay, làm phẳng phối cảnh, tăng tương phản, ghép nhiều trang và chụp lại.
- [ ] Kiểm tra MIME thực, dung lượng, file hỏng, mật khẩu PDF, macro và malware.
- [ ] Có progress, pause/retry và offline upload queue.

### G7.2. Storage và tính toàn vẹn

- [ ] Supabase Storage bucket private theo tenant/site/module.
- [ ] Signed URL ngắn hạn, RLS/object policy, checksum, version và immutable original.
- [ ] Metadata: loại, số, ngày, đối tác, số tiền, tiền tệ, kỳ, người tải, nguồn, hồ sơ liên kết.
- [ ] Retention/legal hold/archive/delete có phê duyệt và audit.
- [ ] Không dùng ảnh/file trong browser state làm kho lưu trữ chính thức.

### G7.3. OCR và AI

- [ ] OCR tiếng Việt cho ảnh/PDF; giữ text theo trang và bounding boxes.
- [ ] AI phân loại hóa đơn, hợp đồng, nghiệm thu, bảng kê, bảng công, báo giá, SOP.
- [ ] AI trích xuất trường có confidence và chỉ rõ vị trí nguồn.
- [ ] Người dùng xem song song tài liệu–dữ liệu trích xuất, sửa và xác nhận.
- [ ] Trường tài chính/thuế không được tự post khi chưa có người xác nhận.
- [ ] Phát hiện trùng file/hóa đơn, thiếu trang, sai tổng, sai nhà cung cấp hoặc sai kỳ.
- [ ] Redaction dữ liệu nhạy cảm trước khi gửi model ngoài; lưu model/version/prompt/evaluation.

### G7.4. Excel/CSV

- [ ] Template import có schema/version và ví dụ.
- [ ] Preview mapping cột; validate theo dòng; tải file lỗi có cột lý do.
- [ ] Idempotency tránh import trùng; cho phép dry-run.
- [ ] Export đúng bộ lọc, timezone, locale, encoding UTF-8 BOM khi cần.
- [ ] Dữ liệu import tạo hồ sơ/audit, không ghi thẳng phá workflow.

### G7.5. Tìm kiếm và trợ giúp

- [ ] Full-text search OCR + metadata + mã hồ sơ.
- [ ] Filter theo cơ sở, loại, đối tác, kỳ, trạng thái, số tiền và thiếu chứng từ.
- [ ] Preview/annotation/comment/mention.
- [ ] Nút `?` giải thích loại tài liệu cần nộp, chất lượng ảnh và bước tiếp theo.

### Tiêu chí nghiệm thu G7

- Test matrix tối thiểu: PDF text, PDF scan, PDF nhiều trang, PDF hỏng/có mật khẩu, XLSX, CSV dấu phẩy/chấm phẩy, Unicode Việt, ảnh camera mờ/nghiêng.
- Không người không quyền nào đọc được object URL.
- AI extraction có bộ đánh giá chính xác; sai phải sửa được và giữ lịch sử.

## 12. G8 — Golden path vé–chốt ca–kế toán–ngoại lệ `[~]`

### Đã có ở local

- [x] Domain trạng thái và transition theo role.
- [x] Repository có `demo-cookie` và `supabase`, idempotency, version conflict và audit.
- [x] Migration 003 có workflow/audit tables và RPC atomic service-role.
- [x] Form nhân viên gửi số vé/tiền; quản lý duyệt/trả; kế toán review/post/escalate; giám đốc quyết định ngoại lệ.
- [x] Dashboard quản lý/kế toán/giám đốc đã đọc hàng đợi thật từ repository.
- [x] Unit/security contract test và production build đã qua ở lượt triển khai local.

### Còn phải làm

#### G8.1. Sửa lỗi và xác nhận local

- [x] Sửa global error khi mutation/chấm công.
- [x] E2E xuyên vai trò qua hoàn toàn trong local `demo-cookie` mode; Supabase đa context thuộc G8.2.
- [x] Kiểm tra normal path không làm phiền giám đốc.
- [x] Kiểm tra material exception bắt buộc giám đốc rồi mới post.
- [x] Kiểm tra return/resubmit, double-click và stale version trên local lẫn Supabase.
- [x] Integration test mô phỏng remote outage/retry: giữ nguyên FormData, không báo thành công giả, không fallback cookie và retry sau commit chỉ trả đúng một hồ sơ/idempotency key.

#### G8.2. Chạy trên Supabase

- [x] Apply migration 003.
- [x] Cấu hình server secret và `ERP_PERSISTENCE_MODE=supabase` trên Production.
- [x] Test normal path bằng ba browser context độc lập: nhân viên, quản lý và kế toán; cùng mã ca đã đi đến `posted` và được nhân viên đọc lại.
- [x] Thêm context giám đốc cho nhánh material exception trên Supabase; bài test dùng năm context cho bốn vai trò và một phiên quản lý giữ version cũ, kết thúc với tám audit event.
- [x] Kiểm tra RLS/RPC trực tiếp, audit sequence, version và idempotency.
- [x] Source fail closed, không fallback cookie khi cấu hình/lệnh remote lỗi; integration test đã mô phỏng lỗi trước commit và mất phản hồi sau commit.

#### G8.3. Hoàn thiện nghiệp vụ

- [ ] Tách tiền mặt, POS, thẻ, bank transfer và QR theo nguồn; đính kèm settlement/bảng kê.
- [ ] Số vé theo loại, hoàn, hủy, check-in và tồn ấn chỉ.
- [ ] Cash count/biên bản bàn giao/tiền nộp quỹ.
- [ ] Ngưỡng chênh lệch cấu hình theo site/kênh/kỳ, không đóng cứng.
- [x] Kế toán trưởng/checker cho bút toán; posting/reversal/period lock. Migration 006 đã chạy trên remote, có action/RPC theo vai trò và lịch sử bất biến.
- [x] Link từ báo cáo giám đốc xuống hồ sơ chốt ca, bút toán và hàng đợi cần xử lý. Trung tâm tài liệu nguồn dùng chung vẫn thuộc G7/G9.

### Tiêu chí nghiệm thu G8

- Nhân viên tạo một lần; các vai trò sau không nhập lại số.
- Cùng mã hồ sơ xuất hiện đúng hàng đợi trên thiết bị khác.
- Trạng thái, người chịu trách nhiệm, SLA, tài liệu và audit đúng sau mọi bước.
- Journal cân Nợ/Có và không post khi thiếu duyệt.

## 13. G9 — Kế toán và kiểm soát tài chính trọn vòng đời `[ ]`

### G9.1. Nền kế toán

- [ ] Xác nhận pháp nhân, chế độ tài khoản, chính sách thuế và kỳ theo tư vấn của khách hàng.
- [ ] Chart of accounts/cost center/project/site/channel/product có effective date.
- [x] Journal header/lines, approval, posting, reversal và period lock cho nguồn chốt ca; reconciliation đa nguồn vẫn còn ở G9.2–G9.7.
- [x] Maker–checker xuyên hai tài khoản kế toán viên/kế toán trưởng; người lập không thể tự kiểm tra hoặc tự ghi sổ.
- [x] Audit journal/period bất biến và trigger chặn sửa/xóa bút toán đã ghi sổ; giao dịch nguồn đã xác nhận chỉ sửa bằng hoàn bút và bút toán thay thế.

### G9.2. Doanh thu, tiền và ngân hàng

- [ ] Vé/check-in/POS/QR/bank/cash settlement.
- [ ] Doanh thu theo sản phẩm, site, kênh; thuế và hóa đơn liên kết.
- [ ] Bank statement import/API, auto-match có confidence và manual review.
- [ ] Cash over/short, chargeback, refund, canceled/void ticket.

### G9.3. Nhà cung cấp và phải trả

- [~] PR → duyệt → PO/hợp đồng → nhận/nghiệm thu → invoice → 3-way match → payment → posting. Đoạn invoice → 3-way match → journal phải trả → posting đã chạy trên Supabase (migration 007/008, đã commit git) và đã có E2E multi-role thật xác nhận xuyên bốn vai trò; PO/nghiệm thu vẫn là số quản lý tự khai trong form, chưa có module PR/PO/nghiệm thu riêng để đối chiếu với dữ liệu hệ thống; giai đoạn thanh toán thật (payment) chưa có.
- [~] Hồ sơ thiếu trả đúng owner, có SLA và notification. Owner routing theo trạng thái đã có (`canActOnSupplierAp`, trigger định tuyến ngoại lệ migration 008) và đã nối vào bộ đếm việc cần làm của trợ lý điều hành; chưa có trường SLA/deadline hay notification riêng cho hồ sơ AP.
- [x] Phát hiện invoice trùng, sai MST/số/ngày/tổng/thuế, vượt PO hoặc thiếu nghiệm thu. `evaluateSupplierApMatch` kiểm MST, ngày, tổng khớp, vượt PO, thiếu nghiệm thu; ràng buộc unique DB theo `(tenant, MST chuẩn hóa, series, số hóa đơn)` chặn hóa đơn trùng ở tầng database. Unit + contract test qua.
- [ ] Payment proposal, dual approval và bằng chứng ngân hàng.

**Bằng chứng 31/07/2026 (đã commit, đã push, đã deploy production):** `domain/erp-supplier-ap.ts`, `lib/erp/supplier-ap-repository.ts`, `app/erp/supplier-ap-actions.ts`, `components/erp/supplier-ap-control-center.tsx` cùng migration `202607290007_erp_supplier_ap_workflow.sql`/`202607300008_erp_ap_exception_routing.sql` đã xác minh trực tiếp trên Supabase remote: 6 bảng `erp_ap_*` với RLS bật, không grant `anon`/`authenticated`, RPC chỉ `service_role`, seed 4 supplier/5 invoice/5 dòng/5 audit event. Test cục bộ 21/21 (unit, integration action-guard, 2 contract test migration). `tests/e2e/erp-supplier-ap-workflow.spec.ts` đã chạy thật trên Supabase remote xuyên 4 vai trò (quản lý, kế toán, giám đốc, kế toán trưởng), đưa 2 hồ sơ seed tới trạng thái "Chờ kế toán trưởng" và "Đã ghi nhận công nợ"; bài test dùng dữ liệu seed một lần nên không lặp lại được nguyên trạng trên cùng project. `npm run build` cục bộ xác nhận qua bằng cách build ra `distDir` thay thế (né lỗi khóa file `.next` chưa rõ nguyên nhân gốc — xem `CODEX.md`). Commit `bd105e4` (batch AP–NCC) và `331bb1d` (fix test CRLF + đồng bộ tài liệu) đã push lên `qal1102/ninhbinhjourney/main` ngày 31/07/2026; Vercel Git-integration tự tạo deployment `dpl_HfdkxgSwDubYZDE4Kt9YukegdxXK` và đã gắn alias vào `https://ninhbinhjourney.vercel.app`. Smoke sau deploy mới dừng ở mức HTTP: `/`, `/erp`, `/erp/login`, `/api/health` đều `200` — **chưa** đăng nhập kiểm tra vai trò kế toán/giám đốc thật để xác nhận `SupplierApControlCenter` hiển thị đúng dữ liệu trên production (theo đúng nguyên tắc CODEX "không coi HTTP 200 là đủ").

### G9.4. Chi phí, tạm ứng và hoàn ứng

- [ ] Request/approval/disbursement/expense claim/settlement.
- [ ] Liên kết project/event/cost code; budget control.
- [ ] Quá hạn, thiếu chứng từ, trùng hóa đơn, vượt chính sách.

### G9.5. Bảng công và lương

- [ ] Shift/time event → timesheet → quản lý duyệt → bảng công khóa → payroll batch.
- [ ] OT, nghỉ, phụ cấp, phạt/khấu trừ theo chính sách được duyệt.
- [ ] Kế toán không sửa time event gốc; trả về quản lý.
- [ ] Payroll variance và hồ sơ bảo hiểm/thuế theo phạm vi đã xác nhận.

### G9.6. Tài sản

- [ ] Nghiệm thu mua sắm tạo asset candidate.
- [ ] Ghi tăng, phân bổ/khấu hao, điều chuyển, kiểm kê, bảo trì, dừng/thanh lý.
- [ ] Truy từ tài sản tới PO/invoice/acceptance/payment.

### G9.7. Hóa đơn điện tử và đóng kỳ

- [ ] Trạng thái phát hành/truyền/lỗi/điều chỉnh/thay thế lấy từ connector thật.
- [ ] Checklist close: quỹ/ngân hàng, doanh thu–vé–QR, AP/AR, lương, tài sản, accrual, hóa đơn lỗi.
- [x] Lock/reopen kỳ có quyền kế toán trưởng, lý do và audit.
- [ ] Trial balance và sổ tài khoản đã có từ journal thật; còn P&L, cash, AP aging, budget vs actual và các chiều quản trị sau khi có đủ nguồn nghiệp vụ.

### G9.8. Giảm làm tay

- [ ] Auto-code theo nguồn có rule/confidence.
- [ ] Recurring entry, template, mass action có preview.
- [ ] Document OCR prefill và duplicate detection.
- [ ] Exception-first queue; kế toán không phải mở từng hồ sơ khớp hoàn toàn.
- [ ] Export Excel/CSV/PDF và connector tới phần mềm kế toán hiện hữu.

### Tiêu chí nghiệm thu G9

- Ít nhất một hồ sơ thật cho mỗi lifecycle chạy xuyên nguồn–kế toán–checker–post.
- Báo cáo cộng khớp ledger và truy xuống chứng từ.
- Không role nào vượt segregation of duties.

## 14. G10 — Các workflow vận hành theo tám nhóm module `[~]`

> Giữ tám nhóm menu; hoàn thiện chiều sâu. Mỗi mục dưới đây phải có hồ sơ, trạng thái, owner, SLA, bằng chứng, audit, notification và contextual help.

### Hiện trạng 15 module để không nhầm UI với chức năng hoàn tất

| Module hiện tại | Mức hiện tại | Khoảng trống chính |
|---|---|---|
| Vé & đặt chỗ | `[~]` Golden path chốt ca local/Supabase (`ShiftCloseSiteWorkflow`) đang làm; số vé/doanh thu/danh sách giao dịch trên màn "Vé & doanh thu" vẫn là dữ liệu demo tĩnh (`ERP_SITE_FINANCE`), chưa phải nguồn vé/POS thật | Nguồn vé/POS thật, evidence, checker, post thật, Supabase E2E |
| Check-in khách | `[~]` Nút "Quét và ghi nhận QR" của `ticket-guest-workspace.tsx` **đã nối Supabase thật** ngày 01/08/2026 (migration `202607310012_erp_field_reports_and_gate_scans.sql`, bảng `erp_gate_scan_events`, RPC `erp_record_gate_scan`) — trước đó chỉ toast cục bộ, không lưu; đã deploy và smoke thật bằng Playwright hai tài khoản tách biệt (`prod-smoke-field-reports-and-gate-scans.spec.ts`, 1/1 pass). Chưa đối chiếu mã quét với vé/pass thật (chưa có nguồn vé thật để đối chiếu) | Pass thật, chống replay, partial group, offline/reconcile |
| Sức chứa | `[ ]` Chủ yếu số/card | Event nguồn, threshold, dispatch, owner/SLA và hậu kiểm |
| Camera AI | `[ ]` Feed mô phỏng; nút "Giao quản lý kiểm tra" của giám đốc là **giả** — chỉ đổi toast cục bộ, quản lý không bao giờ thấy (xác nhận 31/07) | Gateway thật, quyền, health, event, privacy, xác minh và retention |
| Báo cáo hiện trường | `[~]` Ảnh **workday** (task trong ca) đã lưu Storage/geofence thật. `field-report-workspace.tsx` (báo cáo ảnh ngoài kế hoạch) **đã nối Supabase Storage thật** ngày 01/08/2026 (migration `202607310012_erp_field_reports_and_gate_scans.sql`, bảng `erp_field_operation_reports`, RPC `erp_submit_field_operation_report`, bucket riêng tư `erp-field-reports`) — trước đó ảnh chỉ đọc base64 giữ trong state, không upload; đã deploy và smoke thật trên production bằng Playwright hai tài khoản tách biệt kèm ảnh thật (`prod-smoke-field-reports-and-gate-scans.spec.ts`, 1/1 pass, xác minh `storage_path` khác null trực tiếp qua `supabase db query`) | Offline queue, retention, downstream accounting link |
| Sự cố | `[~]` Chuyển trạng thái (quản lý tiếp nhận/giao/yêu cầu xác minh/đóng, nhân viên báo đã xử lý) **đã nối Supabase thật** ngày 31/07/2026 (migration `202607310011_erp_incidents.sql`, bảng `erp_incidents`, RPC `erp_incident_manager_transition`/`erp_incident_employee_progress`) — đã deploy và smoke thật bằng Playwright hai tài khoản tách biệt (`prod-smoke-incidents.spec.ts`, 1/1 pass). Vẫn dùng `erp-incident-repository.ts` riêng cho ERP thay vì backend `app/api/incidents` có sẵn, vì backend đó thuộc hệ thống "operator run" (`demo_runs`) không có khái niệm tenant/site/giám đốc | Không có luồng tạo hồ sơ sự cố mới (12 hồ sơ demo cố định, chỉ chuyển trạng thái); evidence vẫn read-only, chưa cho upload; chưa có RCA/CAPA post-incident |
| SOP & diễn tập | `[ ]` Chủ yếu card/read-only | Version/approval/effective date, acknowledgment, drill và CAPA |
| Nhân sự | `[~]` Profile + phiếu giao việc Supabase (workday) thật. `staff-access-manager.tsx` ("Lưu phân công" site/module cho nhân viên) **đã nối Supabase thật** ngày 31/07/2026 (migration `202607310009`+seed `202607310010`, bảng `erp_employee_access`/`erp_employee_access_audit`, RPC `erp_update_employee_access`) — trước đó chỉ ghi signed cookie theo trình duyệt quản lý, quyền nhân viên ở máy khác không đổi; **đã deploy và smoke thật trên production** bằng Playwright hai tài khoản tách biệt (`prod-smoke-staff-access.spec.ts`, 1/1 pass) | Auth thật, roster nhiều việc/ca, contract/training lifecycle, HR/payroll link |
| Chấm công | `[~]` Workday GPS bền (task trong ca) qua Supabase thật. `attendance-panel.tsx` (nút "Xác nhận vào/ra ca bằng GPS", check-in tổng quát khác record workday) **đã nối Supabase thật** ngày 31/07/2026 (bảng `erp_staff_attendance_events`, RPC `erp_record_attendance_event`) — trước đó chỉ ghi signed cookie; **đã deploy và smoke thật trên production** cùng đợt với phân quyền nhân sự ở trên | Missed punch, OT/leave, duyệt ngoại lệ, lock và payroll |
| Xe trung chuyển | `[ ]` Chủ yếu card/read-only | Fleet/trip/dispatch/pre-check/meter/delay/incident |
| Tài sản & bảo trì | `[ ]` Chủ yếu card/read-only | Asset master, work order, part, downtime, acceptance và accounting |
| Dự án & sự kiện | `[~]` **Đã xây từ đầu trên Supabase** ngày 01/08/2026 (migration `202607310013_erp_project_workflow.sql`): WBS 3 cấp (sự kiện → nhóm việc → gói việc), dependency giữa gói việc, yêu cầu đổi phạm vi (quản lý gửi → giám đốc duyệt), nghiệm thu kiểu maker/checker (người xác nhận phải khác người gửi), quyết toán chi phí thật (kế toán, cộng dồn vào ngân sách sự kiện). Đã deploy và smoke thật trên production bằng Playwright hai tài khoản tách biệt (`prod-smoke-project-workflow.spec.ts`, 2/2 pass) | Không có luồng tạo sự kiện/gói việc mới (dữ liệu WBS cố định theo seed); chưa có readiness checklist chi tiết theo hạng mục; chưa có báo cáo tổng hợp ngân sách xuyên nhiều sự kiện |
| Đối tác & nhà cung cấp | `[~]` AP invoice→match→journal→post trên Supabase (chưa commit); phía báo giá/hợp đồng/phản hồi khách thương mại đã bị gỡ bỏ demo cũ, hiện không còn UI | Onboarding, RFQ/PO/receipt/payment, portal; module PR/PO/nghiệm thu thật; workflow báo giá/hợp đồng/phản hồi khách nếu vẫn cần |
| Tài chính & đối soát | `[~]` Báo cáo demo + golden path local | Subledger, bank, maker–checker, journal/post/reversal/lock |
| Báo cáo & dự báo | `[~]` Số demo xác định sẵn | Semantic metrics, lineage, report scheduling và forecast có backtest |

Mọi trạng thái trên chỉ là baseline. Không chuyển một dòng sang `[x]` nếu chưa đạt Definition of Done cấp module ở mục G10.9.

### G10.1. Booking & Check-in

- [ ] Product/rate/inventory/channel/booking/guest/pass/QR/check-in/refund/cancel.
- [ ] Đoàn, đại lý, hướng dẫn viên, quyền lợi và ngoại lệ cổng.
- [ ] Chống QR trùng, offline scan/reconcile và capacity.
- [ ] Kết ca nối G8/G9.

### G10.2. Điều hành hiện trường

- [ ] Capacity by zone, queue/wait time, crowd alert, dispatch task.
- [ ] Báo cáo ảnh có location/time/task/evidence/AI quality check.
- [ ] Camera/sensor event tạo case, người nhận xác minh và feedback.
- [ ] Daily opening/closing/handover checklist.

### G10.3. An toàn & sự cố

- [ ] Report → triage P1–P4 → assign → SLA → contain → resolve → verify → close → review.
- [ ] SOP/checklist theo loại; evidence bắt buộc theo bước.
- [ ] Tách quyền report/update/resolve/close.
- [ ] Escalation giám đốc chỉ khi severity/ngưỡng/overdue.
- [ ] Post-incident action và theo dõi khắc phục.

**Bằng chứng 31/07/2026:** migration `202607310011_erp_incidents.sql` đã có trên remote (bảng `erp_incidents`, RLS bật, chỉ `service_role` có `SELECT`, hai RPC `erp_incident_manager_transition`/`erp_incident_employee_progress` chỉ cấp EXECUTE cho `service_role` — xác minh trực tiếp qua `supabase db query`, không phải suy đoán). Escalation lên giám đốc (lọc `escalated && status !== closed`) và chuyển cấp quyền theo vai trò (chỉ quản lý mới tiếp nhận/giao/đóng, chỉ đúng nhân viên được giao mới báo đã xử lý) đã chạy qua Supabase thật. Đã smoke thật trên production bằng Playwright hai tài khoản tách biệt (`prod-smoke-incidents.spec.ts`): quản lý tiếp nhận `INC-TA-071` → giám đốc ở phiên đăng nhập khác thấy đúng trạng thái và dòng thời gian mới, 1/1 pass. Giới hạn còn lại: 12 hồ sơ demo cố định, không có luồng report tạo hồ sơ mới; evidence vẫn read-only (không upload thật); chưa có RCA/CAPA sau khi đóng hồ sơ.

### G10.4. Nhân sự & ca làm

- [ ] Workforce profile, contract/employment type, training/certification.
- [ ] Shift/assignment/station, check-in/out, missed punch, OT, leave, handover.
- [x] Task/deadline/progress/evidence và audit đã chạy bền cho một phiếu/người/ngày; performance history dài hạn còn thiếu.
- [x] Quản lý phân công theo site/module/training; nhân viên chỉ thấy và chuyển trạng thái phiếu của mình.
- [x] Quản lý xem kết quả, ảnh signed preview, GPS metadata và audit trước khi duyệt/trả; gửi lại bắt buộc evidence mới.
- [x] Lọc việc đúng ngày, chặn nhân viên hết hạn/quyền bị thu hồi và harden evidence object không ghi đè.
- [ ] Tách `Shift/Attendance` khỏi `TaskAssignment`; hiện unique một phiếu/người/site/ngày nên chưa hỗ trợ nhiều task trong cùng ca.
- [ ] Bảng công khóa nối payroll.

**Bằng chứng 29/07/2026:** migration 004 và hardening migration 005 đã có trên remote với workflow/audit/location/geofence, trigger integrity và bucket ảnh riêng tư. Supabase E2E trước hardening qua hai phiên đăng nhập cho giao việc → GPS vào ca → tiến độ → evidence → bàn giao → sơ đồ quản lý → duyệt; batch hardening có 128 unit/security/integration test qua. Giới hạn: GPS chỉ cập nhật khi ca mở và web/PWA đang hoạt động; chưa có background tracking, consent/retention/access-view audit, station-level geofence, missed punch/OT/leave hoặc payroll handoff.

**Regression báo cáo ngoài kế hoạch 29/07/2026:** workspace báo cáo hiện trường vẫn tách khỏi bằng chứng của phiếu công việc. Luồng nhân viên nhập mã hạch toán → tải ảnh → nhận mã `IMG-*` → mở lại chi tiết qua **1/1 desktop + 1/1 Pixel 7** và không tràn ngang.

### G10.5. Phương tiện & tài sản

- [ ] Asset/vehicle/boat master, owner/location/status/meter.
- [ ] Dispatch/trip/capacity/operator, pre-use safety check.
- [ ] Preventive maintenance/work order/spare part/downtime.
- [ ] Acceptance/transfer/inventory/disposal và accounting link.

### G10.6. Dự án & sự kiện

- [ ] Project/event charter, WBS, milestone, dependency, budget/commitment/actual.
- [ ] Task/owner/deadline/readiness/risk/issue/change request.
- [ ] Contractor, acceptance, payment milestone.
- [ ] Forecast at completion và escalation có lý do.

### G10.7. Nhà cung cấp & công nợ

- [ ] Vendor onboarding/KYC/document expiry/evaluation.
- [ ] RFQ/quotation comparison/negotiation/approval/contract.
- [ ] PR/PO/delivery/acceptance/invoice/payment/status communication.
- [ ] Customer/partner follow-up, SLA phản hồi và sales pipeline nếu thuộc phạm vi.

### G10.8. Tài chính & báo cáo

- [ ] Thực hiện G9; báo cáo theo site/kỳ/chỉ tiêu.
- [ ] Drill-down đúng nguồn; export/schedule/distribution có quyền.
- [ ] Variance comment, forecast assumption và approval.

### G10.9. Ma trận chức năng module bắt buộc

Với **mỗi** module, phải điền và nghiệm thu bảng sau trong tài liệu/module test:

| Hạng mục | Câu hỏi phải trả lời |
|---|---|
| Người dùng | Ai tạo, ai xem, ai sửa, ai duyệt, ai chỉ đọc? |
| Đầu vào | Dữ liệu nhập tay, import, thiết bị hay module nào gửi tới? |
| Hồ sơ | Mã duy nhất, trạng thái, owner, SLA, bằng chứng là gì? |
| Hành động | Nút nào tạo thay đổi thật và điều kiện thực hiện? |
| Bàn giao | Bước sau thuộc vai trò/module nào? |
| Ngoại lệ | Thiếu dữ liệu, quá hạn, trùng, xung đột xử lý thế nào? |
| Dữ liệu | Lưu bảng/bucket nào, refresh/thiết bị khác có thấy không? |
| Audit | Ai làm gì, lúc nào, từ trạng thái nào sang trạng thái nào? |
| Mobile | Thao tác chính có làm bằng một tay, không kéo ngang không? |
| Trợ giúp `?` | Giải thích đúng gì cho vai trò hiện tại? |
| Kiểm thử | Unit/integration/E2E nào chứng minh nó chạy? |

### Tiêu chí nghiệm thu G10

- Không còn module chỉ là card/read-only nếu người dùng được kỳ vọng thao tác.
- Mỗi vai trò có ít nhất một vòng đời công việc thật qua mỗi nhóm liên quan.
- Hành động và notification tới đúng người.

## 15. G11 — Màn giám đốc, báo cáo quản trị và dự báo `[ ]`

### G11.1. Daily executive cockpit

- [ ] Freshness, phạm vi và trạng thái nguồn ở đầu màn.
- [ ] 3–5 quyết định thật tối đa: mã, severity, countdown, impact, owner, recommendation, approve/reject/delegate.
- [ ] Pulse: khách dự kiến/đã vào/peak, doanh thu/tiền về, nhân sự actual/planned, sự cố.
- [ ] Ma trận bốn cơ sở cùng đơn vị, site cần chú ý lên trước.
- [ ] Tài chính ngày/tháng/quý/năm, click mới drill-down.
- [ ] Dự án/rủi ro/sự kiện phía dưới.

### G11.2. Số liệu

- [ ] Doanh thu, chi phí, lợi nhuận, tiền, công nợ, khách, năng suất có công thức và source.
- [ ] So kỳ trước, cùng kỳ, kế hoạch và rolling average.
- [ ] Drill từ KPI → site → hồ sơ → giao dịch/tài liệu.
- [ ] Không trộn forecast với actual; hiển thị confidence/assumption.

### G11.3. Dự báo

- [ ] Chỉ dùng sau khi có dữ liệu lịch sử đủ.
- [ ] Backtest và đo sai số theo site/kỳ.
- [ ] Nêu biến đầu vào: mùa, lịch, thời tiết, booking, capacity, event.
- [ ] Không dùng dự báo để tự động duyệt tài chính/an toàn.

### Tiêu chí nghiệm thu G11

- Giám đốc mở điện thoại hiểu tình hình và việc cần quyết định trong một màn nhìn đầu.
- Không thấy việc thường của nhân viên hoặc hàng kế toán chưa được chuyển cấp.
- Mọi quyết định lưu audit và quay lại đúng owner.

## 16. G12 — Trợ lý điều hành và tự động hóa có kiểm soát `[ ]`

### G12.1. Điều hướng

- [ ] Text/voice nhận đúng site, module, hồ sơ, camera và kỳ báo cáo.
- [ ] Phân quyền trước khi điều hướng; không tiết lộ mục không có quyền.
- [ ] Hiển thị gợi ý lệnh theo vai trò.
- [ ] Mobile microphone permission/error/fallback text.

### G12.2. Hỏi đáp có nguồn

- [ ] Trả số từ query thật, ghi kỳ/freshness/source.
- [ ] Tóm tắt SOP/tài liệu có citation tới trang/đoạn nội bộ.
- [ ] Không bịa khi thiếu dữ liệu; đề nghị mở màn phù hợp.

### G12.3. Thực hiện hành động

- [ ] Chu trình: hiểu lệnh → preview → xác nhận → thực hiện → audit.
- [ ] Hành động nhạy cảm yêu cầu xác nhận và capability.
- [ ] Ví dụ: tạo task, mở camera, lọc báo cáo, soạn phiếu; không tự post/chi tiền/đóng P1.
- [ ] Idempotency và undo/reversal khi nghiệp vụ cho phép.

### G12.4. Đánh giá

- [ ] Bộ câu lệnh theo role/site/accent/biến thể tiếng Việt.
- [ ] Đo intent accuracy, wrong-action rate, permission leakage và latency.
- [ ] Log an toàn, redaction PII và retention.

## 17. G13 — Tích hợp nguồn thật, realtime và Camera AI `[ ]`

### G13.1. Connector framework

- [ ] Mỗi connector có contract/schema/version, auth, rate limit, idempotency, retry/backoff, dead-letter, replay và health.
- [ ] Lưu source event bất biến trước khi chuyển đổi.
- [ ] Reconciliation giữa nguồn và ERP.
- [ ] Dashboard integration health cho quản trị, không lẫn vào công việc thường.

### G13.2. Thứ tự tích hợp

1. Vé/booking/QR/check-in.
2. POS/cash/bank/payment settlement.
3. Hóa đơn điện tử/phần mềm kế toán.
4. HR/chấm công/payroll.
5. Xe/thuyền/tài sản/bảo trì.
6. Camera gateway/sensor/capacity.
7. Weather/GIS/event calendar.

### G13.3. Realtime

- [ ] Subscription đúng bảng/scope.
- [ ] Reconnect, catch-up, duplicate/out-of-order handling.
- [ ] Freshness indicator và degraded mode.
- [ ] Push chỉ gửi khi rule/owner/severity đúng; dedupe/throttle/escalation.

### G13.4. Camera AI

- [ ] Camera registry theo site/zone, trạng thái online/offline và last frame.
- [ ] Stream/proxy an toàn, không đưa credential camera ra client.
- [ ] Quyền xem theo role/site; audit người mở.
- [ ] AI detection có model/version/confidence, privacy mask và retention.
- [ ] Alert phải có người xác minh; click mở đúng camera/thời điểm/evidence.
- [ ] Không gọi feed mô phỏng là “trực tiếp”.

## 18. G14 — Mobile, PWA, thông báo và offline `[~]`

### Đã có một phần

- [x] Manifest, service worker, hamburger và một số kiểm thử overflow.
- [x] Voice/text floating assistant và một số deep-link.
- [x] Luồng workday nhân viên trên Pixel 7 không tràn ngang; camera input và geolocation permission hoạt động trong E2E.
- [x] Luồng báo cáo ảnh hiện trường ngoài kế hoạch trên Pixel 7 gửi/xem lại được mã hồ sơ và mã hạch toán, không tràn ngang.
- [~] Nút `?` contextual đã có trên mọi trang module và assertion desktop/Pixel 7 hoàn tất; runner Playwright Windows còn treo ở teardown nên chưa đóng gate browser.

### Còn phải làm

- [ ] Audit 320/360/390/430 px cho toàn bộ public và ERP.
- [ ] Không kéo ngang; bảng chuyển thành card/column hoặc có pattern mobile có chủ đích.
- [ ] One-hand: quick actions, bottom reach, tap target, camera/QR.
- [ ] Form dài có autosave/draft và không mất khi app background.
- [ ] Offline policy theo module:
  - read cache nào được phép;
  - action nào xếp hàng;
  - conflict resolution;
  - dữ liệu nhạy cảm có được lưu local không.
- [ ] Service worker version/update/rollback; không cache HTML lỗi hoặc dữ liệu người khác.
- [ ] Web Push subscription, permission timing, preference, quiet hours, dedupe và deep-link.
- [ ] iOS/Android install, standalone, safe area, keyboard, camera, mic, geolocation.
- [ ] Nút `?` trợ giúp mở tốt trên mobile.

### Tiêu chí nghiệm thu G14

- Field employee hoàn thành check-in, báo cáo ảnh, task và sự cố trên điện thoại không cần desktop.
- Manager/director xem và quyết định ngoại lệ trên điện thoại trong ít bước.
- Offline/reconnect không tạo trùng.

## 19. G15 — Bảo mật, tuân thủ, độ tin cậy và vận hành `[ ]`

### G15.1. Security

- [ ] Threat model cho public, ERP, file, AI, connector, camera.
- [ ] RLS/server authorization/action-level tests.
- [ ] CSRF, XSS, SSRF, upload, path traversal, rate limit, brute force và session fixation.
- [ ] MFA cho vai trò nhạy cảm; session/device revoke.
- [ ] Secret scanning/dependency audit/CSP/security headers.
- [ ] Pentest trước production.

### G15.2. Privacy và lưu trữ

- [ ] Phân loại PII/tài chính/camera/nhân sự.
- [ ] Consent, masking, retention, legal hold, export và deletion theo chính sách.
- [ ] Access log tới hồ sơ/file/camera.
- [ ] Môi trường demo không dùng dữ liệu cá nhân thật chưa được ẩn danh.

### G15.3. Audit và chống chối bỏ

- [ ] Append-only audit event cho action nhạy cảm.
- [ ] Actor, role, delegated authority, device/session, before/after, reason, evidence.
- [ ] Clock/timezone nhất quán Asia/Ho_Chi_Minh + UTC storage.
- [ ] Export audit phục vụ kiểm tra.

### G15.4. Reliability

- [ ] SLO, error budget và alert.
- [ ] Database backup/PITR; storage versioning/backup.
- [ ] Restore drill có thời gian và bằng chứng.
- [ ] Job queue retry/dead-letter.
- [ ] Graceful degradation khi Supabase/connector/AI/camera lỗi.
- [ ] Runbook incident, on-call owner và status communication.

## 20. G16 — Kiểm thử toàn bộ vòng đời, UAT và audit cuối `[ ]`

### G16.1. Automated quality gates

- [x] Quy ước nhịp test theo tầng: targeted trong lúc code; Playwright theo workflow sau một batch hoàn chỉnh; full browser/visual/a11y chỉ ở release candidate, pre-deploy hoặc CI/nightly.
- [ ] Typecheck, lint, unit, security, migration contract, integration, build.
- [ ] E2E public mobile/desktop.
- [ ] E2E ERP theo role và cross-account/cross-device.
- [ ] Accessibility axe + keyboard + screen reader spot checks.
- [ ] Visual regression cho intro, header, navigation, charts, mobile.
- [ ] Performance/load/concurrency/soak cho check-in peak và dashboard.
- [ ] Upload/OCR/AI document matrix.
- [ ] RLS/permission negative tests.

### G16.2. Vòng đời phải tự đóng vai

Codex/QA phải tự đóng vai và ghi kết quả cho:

1. Du khách lần đầu trên điện thoại mạng chậm.
2. Du khách quay lại sửa hành trình/booking.
3. Nhân viên chính thức đầu ca → làm việc → nộp bằng chứng → cuối ca.
4. Nhân viên thời vụ đúng/hết hạn/ngoài trạm.
5. Quản lý giao việc → duyệt/trả → xử lý sự cố → bàn giao ca.
6. Kế toán nhận nguồn → thiếu chứng từ → trả → nhận lại → đối soát → lập.
7. Kế toán trưởng/checker duyệt/trả/post/reversal.
8. HR/timekeeper xử lý missed punch/OT/leave/payroll handoff.
9. Kỹ thuật xử lý work order/tài sản.
10. Mua sắm/NCC xử lý RFQ–PO–nghiệm thu–invoice.
11. PM sự kiện xử lý milestone/risk/change/budget.
12. Giám đốc xem daily pulse → mở ngoại lệ → quyết định → theo dõi kết quả.
13. Kiểm soát/kiểm toán truy từ báo cáo xuống audit/tài liệu.
14. Quản trị viên khóa user, đổi quyền, xử lý connector/file lỗi.

**Đã tự đóng vai và xác minh 29/07/2026:** persona 3 đã qua cho một phiếu công việc thật trên Supabase và một báo cáo ảnh hiện trường ngoài kế hoạch có mã hạch toán trên desktop/Pixel 7; phần giao việc/xem GPS/bản đồ/duyệt của persona 5 cũng qua. Phần sự cố và bàn giao ca tổng của persona 5 vẫn chưa hoàn tất, nên G16.2 chưa được đánh dấu xong.

Với mỗi persona phải trả lời:

- Họ muốn hoàn thành việc gì?
- Có biết bấm ở đâu mà không được hướng dẫn miệng không?
- Có phải nhập lại dữ liệu không?
- Có bước/nút nào không tạo giá trị không?
- Có thấy thông tin vượt quyền không?
- Có hiểu trạng thái, owner và bước tiếp theo không?
- Nút `?` có giải thích đúng khi họ không hiểu không?
- Mobile có ít bước và không kéo ngang không?

### G16.3. Content audit cuối

- [ ] Tìm toàn repo các câu demo, placeholder, lorem, “trải nghiệm”, “một màn hình”, “nhìn nhanh”, “mở khi cần”, “realtime/live” không có chứng cứ.
- [ ] Đọc thủ công toàn bộ public như khách du lịch.
- [ ] Đọc thủ công toàn bộ ERP như từng vai trò.
- [ ] Xác nhận không có mojibake/lỗi dấu tiếng Việt.

### G16.4. UAT

- [ ] Script UAT theo vai trò và site.
- [ ] Dữ liệu UAT có thể reset/replay nhưng không giả production.
- [ ] Ghi issue severity/owner/due; retest.
- [ ] Sign-off nghiệp vụ, bảo mật, kế toán và vận hành.

### Tiêu chí nghiệm thu G16

- Không còn lỗi P0/P1; P2 có quyết định chấp nhận rõ.
- 100% action chính có automated hoặc UAT evidence.
- Không dead button/link/empty decorative module.

## 21. G17 — Phát hành production và bàn giao `[~]`

### G17.1. Hosting

- [x] Production canonical là `goldencard/ninhbinhjourney`; hai mapping ChatGPT Sites stale đã được retire khỏi source theo quyết định của chủ dự án.
- [x] Đã quét secret và commit toàn bộ 203 file app thành checkpoint `ef2e5d1`. Snapshot Sites `68945ab2f54d72c74650cc2c37541ce3f954dc61` chỉ còn là bằng chứng lịch sử; release Vercel mới phải dùng subtree hiện hành không chứa Sites mapping.
- [x] GitHub release target là `qal1102/ninhbinhjourney`, với `package.json` ở repository root.
- [x] Xác nhận `/erp` là route của cùng app, không deploy nhầm ERP đè lên homepage.
- [x] App subtree runtime và tài liệu bàn giao đã push fast-forward lên `qal1102/ninhbinhjourney/main`; Vercel production alias theo dõi branch này và đã `Ready`.
- [x] Alias chính và TLS hoạt động; `/`, `/erp`, `/api/health` đều `200`; functional smoke qua **6/6** và final alias smoke qua **4/4** mobile/desktop.
- [ ] Staging/approval gate tách biệt và canonical/redirect matrix đầy đủ vẫn còn trong release hardening cuối.

### G17.2. Release

- [ ] Freeze schema/contract, migration backup và rollback/forward-fix plan.
- [x] Supabase server secret lưu dạng sensitive trên Vercel; public/runtime flags đã cấu hình.
- [~] Migration 003, 004 và 005 + seed đã chạy Production; staging và quy trình migrate theo môi trường còn thiếu.
- [~] Public + ERP login/dashboard smoke 12/12 qua; file/OCR và toàn bộ critical workflow production chưa đủ.
- [ ] Observability dashboard và alert hoạt động trước mở người dùng.
- [ ] Rollback test.

### G17.3. Bàn giao vận hành

- [ ] Admin guide, role guide, contextual help và quick-start.
- [ ] Runbook, backup/restore, incident, access review, connector.
- [ ] Training theo role/site.
- [ ] Support/SLA, issue intake và change control.
- [ ] 7/14/30-day hypercare và review adoption.

### G17.4. Đo mức chấp nhận sử dụng

- [ ] Task success, thời gian hoàn thành, số bước/click, error/rework.
- [ ] Tỷ lệ hồ sơ nhập một lần, auto-match, thiếu chứng từ, quá SLA.
- [ ] Active users theo role/site; lý do bỏ dở.
- [ ] Phỏng vấn người dùng, không chỉ nhìn analytics.
- [ ] Backlog cải tiến dựa trên nút thắt thật.

## 22. Đầu vào bắt buộc từ khách hàng/chủ dự án

Các hạng mục sau không được tự bịa:

1. Sơ đồ tổ chức, pháp nhân, site, bộ phận và danh sách role/capability.
2. RACI, ngưỡng phê duyệt, ủy quyền và segregation of duties.
3. SOP, SLA, checklist, incident severity, capacity threshold.
4. Sản phẩm/vé/giá/chính sách hoàn đổi/kênh bán/hoa hồng.
5. Mẫu ca, trạm, chấm công, OT, nghỉ và bảng lương.
6. Danh mục tài khoản, cost center, mã hạch toán, kỳ, chính sách thuế/kế toán đã được tư vấn xác nhận.
7. Quy trình PR/PO/nghiệm thu/invoice/payment và mẫu tài liệu.
8. Danh mục tài sản/phương tiện/bảo trì.
9. Dự án/sự kiện, WBS, ngân sách, nhà thầu và milestone.
10. Mẫu PDF/Excel/CSV/ảnh scan thực tế đã ẩn dữ liệu nhạy cảm.
11. Tài liệu API/file export từ vé, POS, ngân hàng, hóa đơn, HR, camera.
12. Nội dung/ảnh website công khai và quyền sử dụng.
13. KPI ban lãnh đạo thực sự xem ngày/tháng/quý/năm.
14. Chính sách retention, privacy, camera và quyền truy cập.

Mọi mục chưa nhận được phải có trạng thái `[?]`, owner và ngày cần; có thể dùng seed để xây/test nhưng phải ghi rõ là seed.

## 23. Thứ tự thực hiện bắt buộc từ trạng thái hiện tại

Không nhảy thẳng tới polish cuối khi nền dữ liệu/action còn lỗi.

1. `G0` — Hoàn tất hai tài liệu bàn giao và quy tắc đọc.
2. `G1` — Sửa lỗi server action/E2E; xác nhận menu bằng browser; chốt source sạch về mặt kiểm thử.
3. `G2` — Đóng phần còn lại: rotate PAT, staging, health check và backup/restore; migration/runtime Production đã xong.
4. `G8` — Normal path, ngoại lệ giám đốc, return/resubmit và conflict đã qua Supabase; còn remote outage/retry và checker/journal.
5. `G3` — Khóa ngôn ngữ, dữ liệu nguồn và content inventory.
6. Chạy song song có kiểm soát:
   - `G4–G5` cho website công khai;
   - `G6–G7–G9–G10` cho ERP.
7. `G11–G13` chỉ dựa trên dữ liệu/workflow thật đã ổn.
8. `G14–G15` được áp dụng xuyên suốt, không để cuối mới vá mobile/bảo mật.
9. `G16` — Audit và UAT toàn bộ vòng đời.
10. `G17` — Deploy production cuối, smoke, rollback, bàn giao.

## 24. Việc tiếp theo ngay khi mở cuộc trò chuyện mới

1. Đọc CODEX và PLAN.
2. Kiểm tra `git status` và trạng thái process/port test còn chạy.
3. Migration 003, Vercel Supabase runtime, deploy và normal path ba context đã hoàn tất; không làm lại các bước này.
4. Tiếp tục `G8.3`: checker/journal/period lock; không làm lại remote outage/retry, exception, return/resubmit, double-click hoặc stale version đã có test.
5. Nhắc chủ dự án rotate Management PAT đã từng xuất hiện trong chat; không đọc/in token nếu việc đang làm không cần Management API.
6. Sau mỗi thay đổi, cập nhật CODEX + PLAN trước khi kết thúc.
