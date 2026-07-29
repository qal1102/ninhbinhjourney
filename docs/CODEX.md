# CODEX — Nhật ký bàn giao Ninh Bình Journey

> File này là nguồn bàn giao chính thức giữa các cửa sổ trò chuyện Codex. Khi bắt đầu phiên mới, đọc toàn bộ file này trước khi sửa dự án. Sau mỗi thay đổi quan trọng phải cập nhật trạng thái và thêm một mục vào nhật ký cuối file.
>
> Thứ tự đọc bắt buộc: `AGENTS.md` → `docs/CODEX.md` → `docs/PLAN.md`. CODEX ghi điều đã làm/trạng thái thật; PLAN ghi toàn bộ việc còn lại và tiêu chí để gọi là hoàn tất.

## Cập nhật gần nhất

- Thời gian: 29/07/2026 — 15:17, múi giờ Asia/Saigon
- Production chính: https://ninhbinhjourney.vercel.app
- ERP: https://ninhbinhjourney.vercel.app/erp
- Bản deploy gần nhất: https://ninhbinhjourney-9z6oe8yp9-goldencard.vercel.app
- Trạng thái build local mới nhất: thành công với Next.js 16.2.11
- Trạng thái kiểm tra local mới nhất: `npm run typecheck`, `npm run lint`, `npm run build` và **128/128** unit/security/integration test đều qua. Pre-deploy browser matrix chạy trong output cô lập: **60 passed, 14 skipped đúng điều kiện project/viewport**, không có test fail.
- Thay đổi mới nhất: đã harden phiếu công việc từ giao việc → GPS check-in → tiến độ → bằng chứng → bàn giao → quản lý xem ảnh/kết quả/audit rồi duyệt hoặc trả. Ảnh bàn giao/gửi lại phải là bằng chứng mới; GPS accuracy phải trong `1–250 m`; storage object không ghi đè. GPS chỉ cập nhật khi ca mở và web/PWA hoạt động, không phải theo dõi nền.
- Lỗi P0 `invalid-use-server-value` đã đóng: type/initial state được chuyển sang `domain/erp-shift-close-action-state.ts`; `app/erp/workflow-actions.ts` hiện chỉ export async server actions.
- Trạng thái deploy: **đã live**. App subtree `ea1b1517b32876a9e40bbfcf655b6137d064df9e` đã push fast-forward lên `qal1102/ninhbinhjourney/main`; Vercel deployment `dpl_73igvZzmW9KxGcKCC6UTYVJTbMLG` đang giữ alias chính.
- Production smoke gần nhất: `/`, `/erp`, `/api/health` đều `200`; **6/6** browser assertions qua trên mobile/desktop cho intro bốn chữ, đổi ngôn ngữ và màn đăng nhập ERP không overflow/lỗi accessibility nghiêm trọng.

## Công việc đang dở — phải đọc trước khi sửa

1. Kế hoạch tổng thể nằm ở [`PLAN.md`](./PLAN.md). Nền Supabase của `G2` đã hoạt động; `G2` còn staging/health/rotate PAT. `G8` đã xong normal path, ngoại lệ giám đốc, trả lại/gửi lại, stale-version và integration test remote outage/retry; bước tiếp theo là checker/journal/period lock. `G10.4` đã có một vòng đời nhân viên/quản lý bền; còn phải tách task khỏi attendance/shift, hỗ trợ nhiều task, missed punch/OT/leave, bảng công khóa/payroll và chính sách retention GPS.
2. Migration `202607280003_erp_shift_close_workflow.sql`, `202607290004_erp_workday_lifecycle.sql` và `202607290005_erp_workday_resubmission_integrity.sql` đã có trên remote; không chạy lại bằng thao tác thủ công.
3. Normal path và material exception đã qua Supabase. Bài ngoại lệ dùng năm browser context độc lập cho bốn vai trò cùng một quản lý giữ version cũ. Remote outage/retry đã có integration test fail-closed và idempotency; bài tiếp theo là checker/journal/period lock.
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
| Quản lý Tràng An | `ql.trangan` | `Quanly@2026` |
| Nhân viên Tràng An | `nv.trangan` | `Nhanvien@2026` |
| Kế toán tổng hợp | `ketoan` | `Ketoan@2026` |
| Nhân viên thời vụ Tràng An | `tv.trangan` | `Thoivu@2026` |

## Những phần ERP đã có

### Tổng quan giám đốc

- Phần đầu màn hình cho biết phạm vi toàn vùng/bốn cơ sở, kỳ dữ liệu, khách dự kiến, doanh thu và thời điểm cập nhật; tách rõ khách dự kiến với khách đã check-in.
- Hàng chỉ số vận hành có độ phủ nhân sự, số lao động thời vụ và sự cố đang mở; ma trận bốn cơ sở cho phép so sánh khách, check-in, doanh thu, tải, nhân sự và sự cố trong một lượt nhìn.
- Hàng đợi quyết định đứng trước phần phân tích tài chính, có mã hồ sơ, mức độ, người phụ trách, hạn xử lý, tác động và khuyến nghị; hành động hiện mới mở đúng hồ sơ/module, chưa phải approve/reject có lưu bền.
- Tài chính hợp nhất ngay tại `/erp`, không bắt buộc mở màn tài chính riêng.
- Một bộ lọc dùng chung: Ngày, Tháng, Quý, Năm.
- Năm chỉ số: Doanh thu, Chi phí ghi nhận, Lợi nhuận vận hành, Tiền đã thu, Phải trả đến hạn.
- Mặc định chỉ hiện số chính. Bấm chỉ số nào mới bung chi tiết của chỉ số đó.
- Chi tiết gồm so kỳ trước, cùng kỳ lịch sử, kế hoạch, cơ cấu nguồn/cơ sở và mô tả nguồn dữ liệu.
- Đổi kỳ sẽ tự đóng chi tiết cũ để tránh trộn dữ liệu giữa hai kỳ.
- Có thêm khách hôm nay, lượt check-in, nhân sự trong ca, việc gấp, quyết định chuyển cấp, tình trạng từng cơ sở và dự án/sự kiện.
- Luồng hoạt động cuối màn hình dùng mốc giờ xác định sẵn của dữ liệu demo, không còn gắn nhãn realtime hoặc tạo tín hiệu ngẫu nhiên.
- Toàn bộ số tài chính Ngày/Tháng/Quý/Năm dùng chung `ERP_FINANCE_REPORT`; tổng quan, màn tài chính sâu và tài chính từng cơ sở không còn giữ ba bộ số riêng.
- Có kiểm thử bất biến bắt buộc doanh thu = chi phí + lợi nhuận, cơ cấu cộng đúng tổng và bốn cơ sở cộng đúng toàn vùng.

### Màn hình theo vai trò, workforce và kế toán

- Quản lý có dashboard riêng theo cơ sở: KPI ca hiện tại, hàng việc cần xử lý và độ phủ nhân sự gồm kế hoạch, đang trong ca, thời vụ và vắng mặt.
- Nhân viên thấy việc của mình, trạng thái vào/ra ca lấy từ dữ liệu chấm công của phiên, trạm làm việc, khung ca và thao tác nhanh phù hợp quyền.
- Nhân viên thời vụ có `employmentType`, ngày bắt đầu/kết thúc quyền, quản lý trực tiếp, trạm, ca và `trainedModuleIds`; quản lý chỉ được gán các module vừa thuộc nhóm cho phép gán vừa nằm trong danh sách đã đào tạo.
- Kế toán có `/erp/finance` riêng với chín hồ sơ mẫu bao phủ doanh thu/chốt ca, chênh lệch QR, công nợ NCC, thiếu nghiệm thu, hoàn ứng sự kiện, lương, tài sản cố định, lỗi hóa đơn điện tử và đóng kỳ.
- Mỗi hồ sơ kế toán có chứng từ đã nhận/còn thiếu, chiều hạch toán, bút toán cân đối, maker–checker và timeline; các bộ lọc, mở chi tiết và thao tác gửi kiểm tra hiện chỉ chạy bằng client state, chưa có checker inbox hoặc sổ cái dùng chung.
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

Quan trọng: production runtime đã bật Supabase cho golden path chốt ca và remote đã có vòng đời công việc/ảnh/GPS. QR, báo giá và phần lớn module khác vẫn là dữ liệu demo/local/read-only; không được suy rộng rằng toàn ERP đã lưu bền hoặc realtime.

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
- Kế toán trưởng/checker thật, journal header/lines, period lock và maker–checker xuyên tài khoản.
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
- Luồng kế toán còn cần tài khoản checker/inbox và journal thật. Hàng ngoại lệ chốt ca đã có approve/reject/lý do/audit trong thiết kế mới; các quyết định vận hành khác vẫn chủ yếu deep-link/local.
- Cấu trúc module phù hợp các mẫu doanh nghiệp lớn về RBAC, incident/SOP, time management, procurement–AP, asset lifecycle và management-by-exception ở mức thiết kế. Hệ thống chưa đạt mức production enterprise cho đến khi có dữ liệu dùng chung, tích hợp nguồn, phân quyền hành động, audit và vận hành ngoại tuyến/lỗi đầy đủ.

## File quan trọng

- `docs/PLAN.md`: backlog được đánh số, bảng đếm còn lại, tiêu chí ready và thứ tự bắt buộc.
- `components/erp/executive-dashboard.tsx`: tổng quan giám đốc.
- `components/erp/role-home-dashboard.tsx`: dashboard quản lý, nhân viên và kế toán theo vai trò.
- `components/erp/erp-desktop-navigation.tsx`: menu desktop một hàng, dropdown theo nhóm và xử lý keyboard/click ngoài.
- `components/erp/accounting-workbench.tsx`: hàng đợi và hồ sơ kế toán.
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
- `domain/erp-accounting.ts`: chín hồ sơ kế toán demo, chứng từ, bút toán và timeline.
- `domain/erp-shift-close.ts`: domain golden path chốt ca, transition, queue và journal đề nghị.
- `domain/erp-navigation.ts`: tám nhóm menu và bộ lọc module theo quyền.
- `app/erp/workflow-actions.ts`: năm async server actions golden path, gồm action gửi lại hồ sơ bị trả; không còn export state/object.
- `domain/erp-shift-close-action-state.ts`: type và initial state dùng chung cho form/action, tách khỏi module `"use server"`.
- `components/erp/shift-close-workflow.tsx`: form/hàng đợi theo nhân viên, quản lý, kế toán, giám đốc.
- `lib/erp/shift-close-repository.ts`: persistence `demo-cookie`/`supabase`, version/idempotency/audit.
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

## Việc nên làm tiếp theo

Danh sách đầy đủ và tiêu chí nghiệm thu nằm ở `docs/PLAN.md`. Thứ tự ngay trước mắt:

1. `G8.3–G9`: thêm checker/journal/period lock thật và chứng từ nguồn để kế toán không nhập lại; không làm lại outage/normal/exception/return/conflict đã có test.
2. `G10.4`: tách task khỏi ca/chấm công trước khi cho phép nhiều việc trong một ca; chốt privacy/retention GPS.
3. Song song đóng phần còn lại của `G2`: rotate PAT, staging, health/backup; sau đó thực hiện `G3` audit nội dung và dữ liệu nguồn trước khi mở rộng module.

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

### 29/07/2026 — Chốt GitHub/Vercel làm production canonical

- Chủ dự án xác nhận cần cập nhật trực tiếp `https://ninhbinhjourney.vercel.app`; ChatGPT Sites không phải production target.
- Retire cả root và nested `.openai/hosting.json` khỏi Git, thêm ignore để mapping stale không quay lại; giữ lịch sử Sites bên dưới làm bằng chứng, không coi đó là trạng thái hiện hành.
- Quét staged source không thấy PAT/server secret; pre-deploy Playwright matrix qua **60**, skip **14** theo điều kiện project/viewport, không có failure.
- Push fast-forward app subtree `ea1b1517b32876a9e40bbfcf655b6137d064df9e` lên `qal1102/ninhbinhjourney/main`; Git integration tạo production deployment đầu tiên `dpl_3916tN52YkTKV5ibLyrjxCgBM2Ez`.
- Smoke đầu phát hiện `/api/health` trả `503` do hai public flag Vercel lưu sai định dạng. Ghi lại chính xác `NEXT_PUBLIC_EXPERIENCE_MODE=production` và `NEXT_PUBLIC_BRAND_CONCEPTS_ENABLED=false`, không chạm Supabase secret, rồi redeploy cùng source.
- Deployment cuối `dpl_73igvZzmW9KxGcKCC6UTYVJTbMLG` (`ninhbinhjourney-9z6oe8yp9-goldencard.vercel.app`) ở trạng thái `Ready` và giữ alias chính. `/`, `/erp`, `/api/health` đều `200`; production Playwright smoke qua **6/6** trên mobile/desktop.

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
