# NINH BÌNH JOURNEY — BÀN GIAO

> **Đọc xong tệp này là bắt tay làm được.** Tệp cố tình ngắn. Lịch sử đầy đủ tới 26/09/2026 (524KB, khoảng 150.000 token) nằm nguyên văn ở `docs/archive/HANDOFF_DAY_DU_DEN_2026-09-26.md`. **Đừng đọc cả tệp lưu trữ.** Cần chi tiết một việc thì `grep` đúng mã việc (ví dụ `A15-QUYEN-01`, `2ap`, `TC-12`) rồi đọc vài dòng quanh đó.
>
> Sau mỗi đầu việc: sửa mục A, C của tệp này và thêm **một dòng** vào mục F. Không kể lể dài ở đây; lý lẽ dài để trong commit hoặc chú thích mã. Không tạo tài liệu trạng thái mới.

---

## A. Hiện trạng thật (27/09/2026)

- **Production:** https://ninhbinhjourney.vercel.app, deploy từ `main`. Repo `qal1102/ninhbinhjourney`, Supabase ref `vzewjfcwhovsxslqfpjt` (Tokyo, `ap-northeast-1`).
- **Vùng chạy hàm máy chủ:** `vercel.json` đặt `"regions": ["hnd1"]` (Tokyo, cùng chỗ với kho). Trước 27/09 hàm chạy ở Washington (`iad1`); đo tiêu đề `X-Vercel-Id` thấy `hkg1::iad1`, trang không gọi kho vẫn mất 0,5 giây byte đầu, mỗi truy vấn kho thêm một vòng Mỹ–Tokyo. Kiểm lại bằng `curl -D -`: phải thấy `::hnd1::`.
- **Migration:** production có tới `202609290096` (094, 095, 096 áp theo lời cho phép của chủ dự án; 096 áp 29/09). Riêng `061` cố ý bỏ.
- **Tài khoản:** đúng 13 tài khoản nhân sự mẫu. 095 đã dọn 10 tài khoản rác của kiểm thử cũ (`qa-t6b-check-*`, `qa-t14b-*`, "Test" `employee-tamchuc-002`), các dòng phân vai và nhật ký của chúng, cùng 8 đăng nhập Supabase Auth thử. Supabase Auth hiện 0 người dùng: giám đốc đăng nhập bằng lối tài khoản trình diễn. Tạo tài khoản và cấp đăng nhập làm ngay trong ERP ở `/erp/tai-khoan`.
- **Phân quyền một nguồn (28/09):** vai và cơ sở của MỌI tài khoản (kể cả 13 tài khoản mẫu) lấy từ sổ tài khoản, tức màn `/erp/tai-khoan`; `demo-data.ts` chỉ còn góp mật khẩu dùng chung, hạn thời vụ, việc đã đào tạo. Luật ở `domain/quyen-hieu-luc.ts`: giám đốc mọi thứ; quản lý mọi module ở cơ sở mình; kế toán bộ tài chính; nhân viên theo việc quản lý giao ở màn Nhân sự, chưa giao thì có chấm công + báo cáo hiện trường. Mọi chỗ giao việc, giao ca, bàn giao đọc người qua `lib/erp/tai-khoan-hieu-luc.ts`, nên người tạo mới làm việc được ngay.
  - Tạo tài khoản một bước: họ tên, chức danh, vai, cơ sở, email tuỳ chọn → ra tên đăng nhập (mã tài khoản, ví dụ `nguyen-van-ba`) và mật khẩu tạm. Email trống thì dùng `<mã>@taikhoan.ninhbinhjourney.vn` (không gửi thư). Đăng nhập bằng mã hoặc email.
  - Chặn: nhân viên/quản lý phải có cơ sở; giám đốc/quản trị chỉ toàn vùng; một người một vai nghiệp vụ; giám đốc không tự thu hồi vai Giám đốc.
  - Biến `ERP_REGISTRY_SITE_SCOPE` trên Vercel không còn được đọc.
  - Đã gỡ `prod-smoke-t6b-auth` và `prod-smoke-t14b-directory`: hỏng sẵn và mỗi lần chạy để lại một tài khoản rác không xoá được. Logic được phủ bằng bài tích hợp chạy ở máy.
- **Phễu khách** (`/erp/marketing`): chọn 7/30/90 ngày hoặc một dịp đã qua, so với kỳ liền trước hoặc cùng dịp năm trước. Đếm trong kho bằng `erp_phieu_khach` (094); ô "Qua cổng" chỉ tính vé đơn web, lượt vé quầy ghi riêng.
- **ERP có 13 module, module nào cũng chạy thật:**
  - Vé & đặt chỗ, Check-in, Sức chứa & luồng khách (gồm điều phối xe điện), Camera AI, Báo cáo hiện trường.
  - Dự án & sự kiện, Sự cố, Nhân sự, Chấm công, Đối tác & NCC, SOP.
  - Tài chính & đối soát, **Báo cáo & dự báo**.
  - "Xe trung chuyển" và "Tài sản" là vỏ, đã gỡ (091). Không còn trạng thái "Giai đoạn sau".
- **Trang đầu giám đốc (`/erp`):**
  - Bốn ô lớn: Khách hôm nay, Tiền thu hôm nay (quầy + web), Công việc hiện trường, Bút toán.
  - Bảng vé ghi "gồm số liệu mẫu"; khối tiền 30 ngày tách quầy và web.
  - Khối "Cần giám đốc quyết định", ma trận bốn cơ sở (số khai lúc chốt ca; cơ sở chưa có hồ sơ ca, phiếu việc, bút toán hay công nợ nào thì thu về một dòng "Chưa chốt ca, chưa có phiếu việc hay bút toán").
  - Một dòng mời "Mở Hướng dẫn" (`loi-vao-huong-dan`) sau khối "Việc nên làm trước". "Bản đồ mọi chức năng" đã dời vào màn Hướng dẫn.
  - "Việc nên làm trước" chỉ hiện khi có việc chờ.
- **Màn Hướng dẫn `/erp/huong-dan` (29/09, thay vòng dẫn cũ).** Chủ dự án thấy vòng dẫn bám đầu mọi màn "ngáo", muốn kiểu Trợ lý: bấm là "dịch chuyển" tới đúng chỗ. Nay:
  - Màn riêng, lối vào ở thanh đầu trang (nút "Hướng dẫn"), ngăn kéo điện thoại, trang đầu, và Trợ lý ("Mở hướng dẫn"). Chỉ giám đốc; đang xem thử vai khác thì màn mời quay về giám đốc.
  - Hai phần: **vòng khách 7 bước** (`VONG_KHACH` trong `domain/huong-dan.ts`: đặt vé + trả QR → đơn trong Khách hàng → bấm mã vé "→ quét", xác thực ở cổng Tràng An → hộ chiếu → bán 1 vé quầy → phễu 7 ngày → trang đầu) và **19 việc tra cứu** (`BAN_DO_CHUC_NANG` trong `domain/ban-do-chuc-nang.ts`, việc vai khác đi bằng "Làm thử như …" chuyển vai).
  - **Cách khoanh:** mọi nút đi kèm `?chi=<mã việc>`. `components/shared/chi-diem.tsx` (gắn trong `ErpShell` và trang `/checkout`) tìm phần tử `data-chi="<điểm>"`, viền cam nhấp nháy (tắt nhịp khi giảm chuyển động), cuộn tới, và hiện thẻ nhỏ góc dưới: "Bây giờ: …" (lấy từ `data-chi-loi` của phần tử), "← Hướng dẫn", "Sang bước N →", nút × tắt. Trang đặt vé và quầy vé tự dời `data-chi` theo từng bước (khung giờ → giữ chỗ → số điện thoại → QR → vé; tiền → tích ô → bán → phiếu thu). Bấm mã vé đang khoanh thì màn soát vé mở kèm `diem=quet-ve` (`DIEM_SAU_KHI_BAM`). Không thấy điểm sau 5 giây thì thẻ nói thẳng.
  - Chạy trên dữ liệu thật như ngày thường. Không lưu tiến độ vào kho: dấu "✓ Đã mở" nằm trong `localStorage` (`lib/huong-dan-da-mo.ts`). Bảng `erp_huong_dan_tien_do` và hai hàm RPC đọc/ghi tiến độ còn trong kho, không mã nào gọi (gỡ bằng migration khi chủ dự án cho phép).
  - **Luật giữ đúng:** đổi tên nút hay khối trên màn nào có trong kịch bản thì sửa cả `cacViec` lẫn `data-chi-loi`. Bài `tests/unit/huong-dan.test.ts` canh mọi điểm trong kịch bản đều có `data-chi` thật trong mã.
  - **Lối tắt phục vụ trình diễn** (giữ nguyên): `/checkout?package=…&ngay=hom-nay` mở sẵn hôm nay; mã vé ở màn Khách hàng mở `/erp/<cơ sở>/check-in-khach?ma=<mã>` điền sẵn; trang thanh toán có dòng "Mở trang thanh toán trên máy này".
  - **Giới hạn giờ trình diễn:** bước 1 dùng gói "Nhịp chậm Ninh Bình" (chỉ bán chặng Tràng An, chuyến 08:00 · 09:30 · 11:00 · 13:00 · 14:30 · 16:00 sau `096`), nên đi trọn vòng tới cổng Tràng An làm được tới khoảng 15:55. Muộn hơn thì đặt cho ngày mai (thẻ tự khoanh ô ngày khi hôm nay hết khung), bước 3 sẽ báo "Vé không dùng cho hôm nay". Không mở chuyến chiều cho "Gia đình khám phá": chặng Bái Đính cách 5 giờ 30 sẽ rơi vào buổi tối.
  - **Bẫy đã gặp (đừng lặp lại):** đổi cấu trúc `await` của `ErpShell` hay trang đầu (gộp thêm một lượt đọc vào `Promise.all`, hay thêm một `await` riêng) làm nút "Duyệt phương án ngoại lệ" có lúc kẹt "đang gửi" dù máy chủ đã duyệt xong (2/8 lần). Chưa tìm ra gốc trong Next. Thành phần khoanh điểm cố ý là client, không đọc gì ở máy chủ. Bài `erp-access` "ticket shift follows employee…" là bài canh, chạy `--repeat-each=8` khi đụng khung hay trang đầu.
- **Trả tiền xong thì đồng hồ giữ chỗ dừng (29/09).** Trước đó khối "Còn lại" trên trang đặt vé vẫn đếm về 00:00 cạnh tấm vé đã trả, và quét lại mã QR sau khi trả thì trang thanh toán vẫn đếm ngược, quá 15 phút còn báo "mã hết hạn". Nay trang đặt vé đổi khối ấy thành "Đã thanh toán"/"Đã xác nhận", ẩn lời nhắc 15 phút; trang `/thanh-toan/[phiếu]` hỏi kho trước (`docKetQuaQr`, mở phiếu với `choPhepHetHan` chỉ để đọc), đã trả thì hiện vé ngay.
- **Đặt vé web nhận đặt cho chính hôm nay** (trước đây ô ngày tự chặn từ ngày mai, dù máy chủ vẫn cho). Khung giờ bắt đầu trong vòng 5 phút tới hoặc đã qua bị khoá với nhãn "Đã qua giờ" (`mergeProductSlotRows(rows, now)`, cùng mốc 5 phút với `customer_create_booking_hold`).
- **Lịch sử mẫu (092):** cửa sổ trượt 60 ngày ở bốn cơ sở có cổng, gồm vé quầy, đơn web trả QR, lượt qua cổng.
  - Nguồn `data_origin = 'demo-history'`, mọi mã bắt đầu `de000000`.
  - Được cộng vào số và luôn ghi rõ "gồm số liệu mẫu". Vé gieo cũ `demo-seed` vẫn bị loại khỏi số.
  - `pg_cron` mỗi tháng chạy `erp_lich_su_mau_lam_moi(60)`: xoá mẫu cũ hơn 60 ngày, sinh tiếp tới hiện tại. **Không sinh liên tục.**
  - Muốn số tươi trước buổi trình diễn: chạy `select public.erp_lich_su_mau_lam_moi(60);`.
  - Gỡ sạch mọi mẫu: `select public.erp_lich_su_mau_xoa();`. Công tắc: `erp_lich_su_mau_cau_hinh.bat`.
- **Đặt vé web:**
  - Giữ chỗ 15 phút, QR là lối chính: mã QR trỏ tới `/thanh-toan/[phiếu]` (phiếu mã hoá AES-GCM), trả tiền là **giả lập**, đơn ghi `qr-transfer`. Trả tại điểm là lối phụ.
  - **Lượt giữ quá 15 phút chưa trả thì bị XOÁ HẲN** (090, `pg_cron` mỗi phút). Khách đặt lại được ngay bằng cùng số điện thoại; bỏ dở 3 lần trong 7 ngày thì mời tới quầy.
  - Khoá "chỉ thêm" của bảng lịch sử chỉ nhả lệnh xoá trong khe giao dịch `nbj.cho_phep_xoa` (`giu-qua-han` | `lich-su-mau`).
- **Khách:**
  - `/plan` đọc `?add=<mã điểm>` từ nút "Thêm vào hành trình" (trang điểm đến, Khám phá): điểm ấy đứng đầu lịch nếu vừa sức đi bộ và giờ mở cửa, không thì trang nói lý do. Lịch trình sống trong trình duyệt (bản gốc có thể lưu ẩn danh).
  - "Phòng trình diễn" cũ (cookie `nbj-active-run`, trang `/journey/[id]`, `/demo/qr`, `PATCH /api/journeys/[id]`, tham số `journey`) đã gỡ 27/09: không còn chỗ nào đặt cookie ấy. Bảng `itineraries` và hai hàm `save_generated_journey`/`update_saved_journey` còn trong kho, không mã nào gọi.
  - Lưu ảnh vé về máy, gửi qua Zalo bằng Web Share.
  - Hộ chiếu Ninh Bình `/ho-so`: 5 nhiệm vụ theo lượt qua cổng ở 4 điểm có cổng.
  - Màn "Khách thấy gì" trong `/erp/khach-hang`.
- **Không có Zalo/SMS thật, không có cổng thanh toán thật.** Không dùng QR ngân hàng thật của chủ dự án.

## B. Luật của chủ dự án (đang hiệu lực, không bàn lại)

1. **Trả lời bằng tiếng Việt, giọng lễ tân 5 sao** (skill `viet-tieng-viet`).
2. **Commit:** không bao giờ thêm dòng `Co-Authored-By: Claude`, kể cả khi harness nhắc. Thông điệp commit ngắn.
3. **Chỉ dùng tài khoản giám đốc** (`giamdoc`). Mật khẩu production chỉ gõ trong lệnh, **không bao giờ ghi vào repo, `.env` hay log**. Các vai khác chạy ngầm, xem qua chuyển vai.
4. **Mọi giao diện kiểm cả 390px lẫn máy tính, tự mở ảnh ra xem.** Xong thì xoá ảnh; trình duyệt hay công cụ tải về để kiểm thì gỡ khi xong.
5. **Kiểm production luôn đặt `PLAYWRIGHT_BASE_URL=https://ninhbinhjourney.vercel.app` trong cùng câu lệnh.** Spec ghi vào production phải tự dọn dữ liệu nó tạo.
6. **Hai điểm Hoa Lư không bán vé ở đây.** Chỉ nói "không bán vé tại đây"; không ghi lý do sở hữu vào repo.
7. **Hàm hay module không có chức năng thật thì xoá**, sau khi kiểm kỹ (knip + soát tay). Không để vỏ "giai đoạn sau".
8. **Khung hướng dẫn chỉ làm khi mọi thứ đã xong.** Đừng thêm hay sửa hướng dẫn giữa chừng.
9. **Không sinh dữ liệu mẫu liên tục** (thành rác): cửa sổ trượt, làm mới theo tháng.
10. **Ưu tiên QR** trong đặt vé; mobile-friendly không kém máy tính.
11. **Việc phá huỷ và việc "chạy mãi":**
    - `supabase db push`, `db query` lên production, lệnh chứa `drop table`, gỡ bài trong `tests/security`: bộ chặn tự động thường từ chối.
    - Chủ dự án cho phép thì mới làm, và phải là lời cho phép riêng cho đúng việc đó.
    - Đặt `pg_cron` sinh dữ liệu lặp lại cũng phải hỏi riêng.
    - Không lách bộ chặn.
12. **Thanh toán chỉ giả lập, không bao giờ đề xuất cổng thanh toán thật.** Quét QR → báo thành công → vé vào ERP → khách thành hồ sơ là đúng yêu cầu (dự án không kinh doanh thật).
13. **Ưu tiên thứ người chấm dự án thấy được khi bấm thử.** Đừng tốn công kiểm thử sâu không ai xem. Tạo tài khoản và phân quyền phải làm được ngay trong ERP (`/erp/tai-khoan`).

## C. Việc tiếp theo

**Tự làm được:** hàng đợi tự làm đã hết. Vòng dẫn cũ được thay bằng màn Hướng dẫn 29/09 `2ay`. Việc mới chỉ mở khi chủ dự án giao hoặc khi mục "Chờ chủ dự án quyết" có lời.

**Còn phải kiểm của `2ay`:** đi trọn 7 bước màn Hướng dẫn trên production bằng tay (bước 1 ghi một đơn thật, bước 5 ghi một phiếu quầy thật), trong khung giờ trước 15:55. Trang đặt vé có thẻ chỉ dẫn đã kiểm trên production (chỉ đọc, 2/2); các màn ERP trên production chưa kiểm vì cần mật khẩu giám đốc.

**Đã soát 28/09 và gạch, đừng làm lại** (chủ dự án: việc nào không cần thì gạch khỏi kế hoạch):
- ~~Chốt ca có số~~: ma trận bốn cơ sở ra 0 **không phải lỗi**. Nó chỉ đếm hồ sơ chốt ca thật, và chưa ai chốt ca. Khách và tiền trong ngày theo cơ sở đã có ở khối "Vé đã bán" cùng trang, nên chép vào ma trận là trùng. Còn sinh hồ sơ chốt ca mẫu thì phải có migration và phải ghi số giả vào sổ tài chính bất biến: rủi ro lớn hơn giá trị. Chỉ sửa chữ: cơ sở chưa có hồ sơ ca hiện "Chưa chốt ca" thay vì ba ô "0 vé · 0 đ · 0 đ".
- ~~Tốc độ ERP còn lại~~ (trang đầu khoảng 1,6 giây): chấp nhận được cho buổi chấm. Đo lại cần mật khẩu giám đốc và kho production. Manh mối nếu có ngày cần: `erp_director_ticket_overview` lọc `erp_tickets.issued_at` mà bảng chưa có chỉ mục cột này (chỉ có `(site_id, valid_on)`).
- ~~`ACC-04…07`~~ (nhật ký đăng nhập theo tài khoản, hai lớp cho vai tài chính, thu hồi phiên, bàn giao khi nghỉ): chỉ dùng tài khoản giám đốc, người chấm không kiểm phần quyền.
- ~~`LOI-04`~~: chín trang hồ sơ sâu đủ câu chuyện, trích báo, giới hạn thật. Sáu trang còn lại (Cúc Phương, Phát Diệm, Am Tiên, Bích Động, Thái Vi, bảo tồn gấu) ngắn hơn nhưng đủ giới thiệu, lịch sử, điểm nhấn và lưu ý thực dụng, không có chữ tạm. Viết sâu thêm phải tra nguồn từng dữ kiện, mà web đứng sau ERP.
- ~~`CAN-03`~~: đo Lighthouse điện thoại (giả lập 4G chậm) trên production 28/09. Tốc độ: trang chủ 52, điểm đến 78, `/plan` 78, `/explore` 70. Truy cập, thực hành tốt, SEO đều 93–100; sau đợt `2av` truy cập lên 100 cả bốn trang và trang chủ lên 71 điểm tốc độ (đo lại production). LCP trang chủ còn khoảng 4–5 giây **do màn mở đầu phủ hero ở lượt ghé đầu phiên** (93% là chờ vẽ, ảnh tải xong từ 38 ms): đó là thiết kế, đổi thì hỏi chủ dự án. PageSpeed của Google hết hạn mức chung trong ngày, nên đo bằng Lighthouse chạy ở máy.
- Luật giữ nguyên, không phải việc: ảnh gốc trong `public/images/destinations` nặng 2,5–4 MB mỗi tấm; chỉ dùng qua `next/image`, không bao giờ làm nền CSS hay thẻ `<img>` thô.

**Chờ chủ dự án quyết, không tự làm:**
- Hiệu ứng web của `A15-CON-LAI` (shader hero, chuyển cảnh, preloader, con trỏ): thuộc phiên sáng tạo, chỉ làm khi chủ dự án mở phiên ấy. Màn mở đầu trang chủ cũng thuộc phần này (xem `CAN-03` ở trên).
- `A15-QUYEN-01` (chủ dự án 28/09: người chấm không có thời gian kiểm phần này, không ưu tiên): phân quyền chưa từng kiểm bằng đăng nhập thật của tài khoản cấp thấp. 28/09 đã soát tĩnh cả 79 server action (bài `tests/security/server-action-tu-kiem-quyen.test.ts`): hàm nào cũng kiểm vai, hàm nhận `siteId` đều kiểm cơ sở ở TypeScript hoặc SQL. Phần đăng nhập thật (cấp đăng nhập tạm cho `employee-trang-an-01` và `manager-tam-coc` qua màn Quản trị tài khoản, thử 4 cơ sở × 13 module và 3 API, rồi gỡ đăng nhập) **bị bộ chặn tự động từ chối** vì tạo đăng nhập trên production; cần chủ dự án quyết cách làm.
- `A15-DEMO-01`: kho demo tách production (tốn tiền).
- `QA-ERP-TICKET-05` phần cuối: luật chia tiền vé gói nhiều điểm về từng cơ sở (không suy ra được từ dữ liệu).
- `ERP-05`: cổng ngoại tuyến cần người cầm máy thật.
- Thực đơn kỹ năng giao diện `docs/reference/KY_NANG_GIAO_DIEN.md`: chờ chọn món, đừng làm cả bảng.

**Đã khép, đừng làm lại:** `A15-ERP-07` (cờ `ERP_DEMO_TICKETS_ENABLED`), `A15-LOI-03`, `QA-PRICE-03` (chủ dự án: "giá tiền cứ để như vậy"), `TC-13`.

**Đã cân nhắc và bỏ:**
- `TC-08` / T6c (RLS thật thay service role): chủ dự án gạch bỏ 21/09. Chỉ mở lại khi tài khoản nhân viên thật sự vào vận hành.
- Mã QR riêng cho từng nhân viên (tài liệu khách mục 7.2): đã có QR vé theo khách và QR động theo điểm; thưởng theo nhân viên chưa có chính sách.
- Dùng QR ngân hàng thật: web không biết tiền về, lại lộ số tài khoản cá nhân.

**Tài liệu khách hàng**, bản gốc `Bao_cao_tong_the_he_sinh_thai_so_du_lich_Ninh_Binh.docx` trên máy chủ dự án (lưu trữ `2am`):
- Chưa có: hàng chờ ảo (Tam Cốc), audio guide, cổng đại lý kèm hoa hồng, chăm sóc sau chuyến đi thật, Zalo Mini App, Wallet, kiosk.

## D. Chỗ nằm của các phần mới (26/09)

| Phần | Tệp chính |
|---|---|
| QR thanh toán giả lập | `lib/customer-data/phieu-qr-thanh-toan.ts`, `app/api/customer-booking-qr-payments/**`, `app/thanh-toan/[phieu]`, `components/commerce/customer-booking-checkout.tsx`, `luu-anh-ve.tsx` |
| Hộ chiếu khách | `domain/ho-so-khach.ts`, `lib/customer-data/ho-so-khach-repository.ts`, `app/ho-so`, `components/commerce/ho-so-khach-view.tsx` |
| Khách thấy gì | `components/customer-data/khach-thay-gi.tsx` (trong `/erp/khach-hang`) |
| Bản đồ chức năng | `domain/ban-do-chuc-nang.ts`, `components/erp/ban-do-chuc-nang-panel.tsx` |
| Trang đầu giám đốc | `app/erp/page.tsx`, `components/erp/executive-dashboard-live.tsx`, `director-ticket-panel.tsx`, `lib/erp/ticket-overview-repository.ts` (RPC `erp_director_ticket_overview`, `erp_doanh_thu_ky`) |
| Báo cáo & dự báo | `domain/bao-cao-co-so.ts`, `lib/erp/bao-cao-repository.ts`, `components/erp/bao-cao-workspace.tsx` (RPC `erp_bao_cao_co_so`) |
| Lịch sử mẫu | migration `202609260092_lich_su_mau_60_ngay.sql` |
| Xoá lượt giữ quá hạn | migration `202609260090_tu_nha_cho_giu_qua_han.sql` |
| Phễu khách theo khoảng | migration `202609270094_phieu_khach_dem_trong_kho.sql`, `domain/customer-funnel.ts` (`chonKhoangPhieu`), `lib/customer-data/funnel-repository.ts`, `components/customer-data/customer-funnel-dashboard.tsx` |

## E. Cách kiểm và lệnh hay dùng

- **Đơn vị, bảo mật:** `npx vitest run` (27/09: 1.682 xanh). Có lint, `npx tsc --noEmit`, `npm run build`.
- **Trình duyệt cục bộ, cả bộ:** `node scripts/run-local-e2e.mjs` (26/09: 434 xanh; bài chập chờn quen thuộc `page-continuity:182`). Chạy vài spec: đặt các cờ `NBJ_E2E_CUSTOMER_BOOKING=1 NBJ_E2E_OFFLINE_GATE=1 NBJ_E2E_CUSTOMER_ANALYTICS=1 NBJ_E2E_CUSTOMER_IDENTITY=1` rồi `npx playwright test <spec>`.
- **Production:** `ERP_DEMO_DIRECTOR_PASSWORD='…' PLAYWRIGHT_BASE_URL=https://ninhbinhjourney.vercel.app npx playwright test <spec>` (một luồng). Muốn chụp màn chỉ đọc: viết script Playwright nhỏ trong scratchpad, đăng nhập `giamdoc`.
- **Thử migration ở máy trước khi xin áp:** máy không có Docker hay psql. Cài `@electric-sql/pglite` vào scratchpad, giả lập `auth` / `cron` / `storage` / role / `supabase_realtime`, chạy cả 93 migration (cách làm ghi trong bộ nhớ `project_thu_migration_bang_pglite`). Gỡ khi xong.
- **Bash trên máy này:** đường dẫn `/erp` truyền qua biến môi trường bị Git Bash đổi, phải đặt `MSYS_NO_PATHCONV=1`. `rm -rf` với biến phải viết `"${S:?}"`. Heredoc dài có dấu nháy dễ vỡ: ghi script ra tệp rồi chạy.
- **Tệp CRLF:** sửa bằng script xong, soát `git ls-files --eol`.

## F. Nhật ký rút gọn (mỗi đợt một dòng; chi tiết `grep` mã trong lưu trữ)

- 29/09 `2ay`: chủ dự án thấy vòng dẫn "ngáo", muốn kiểu Trợ lý dịch chuyển tới chỗ cần. Thay bằng màn Hướng dẫn `/erp/huong-dan`: 7 bước vòng khách + 19 việc tra cứu, "Đưa tôi tới" khoanh viền cam đúng phần tử `data-chi` và thẻ chỉ dẫn "Bây giờ… / Sang bước tiếp". Gỡ vòng dẫn cũ (panel, action, repository, bài kiểm), dời Bản đồ chức năng vào màn mới, Trợ lý có "Mở hướng dẫn" và bỏ lệnh nhanh trỏ tới hai module đã gỡ. Sửa lỗi đã trả tiền mà đồng hồ giữ chỗ vẫn đếm (trang đặt vé và trang quét QR). Kiểm: `tsc`, lint, build, Vitest 1.696, Playwright 32 bài ở máy (Hướng dẫn 8, đặt vé 12, việc đầu tiên 4, bài canh duyệt ngoại lệ 8/8), ảnh 390px/1440px. Áp `096` (chuyến chiều Nhịp chậm).

- 28/09 `2ax`: chủ dự án thấy vòng dẫn khó hiểu. Soát như người mới và sửa gốc: lời dẫn đi theo sang mọi màn (trước chỉ ở trang đầu, bấm sang màn khác là mất); mỗi việc một dòng đánh số; bỏ hai lần chuyển vai; bấm mã vé ở màn Khách hàng là mở màn soát vé với mã điền sẵn (trước phải gõ tay 16 ký tự giữa hàng chục vé `WEB-` khác, mà vé web không lưu số điện thoại để tra); nút bước 1 mở sẵn đúng gói, ngày hôm nay; lối thanh toán trên máy tính. Tìm và tránh lỗi kẹt nút duyệt ngoại lệ do đổi cấu trúc `await` trong `ErpShell` (chia đôi qua commit: `bc8ad3e`, `215425e`, `79e083a` đều 8/8; khung mới 2/8; khung giữ nguyên 16/16). Kiểm: `tsc`, lint, build, Vitest 1.712, Playwright 93 bài (9 spec), ảnh 390px/1440px. Màn soát vé mở từ mã vé tự cuộn tới ô quét (điện thoại có khối cổng ngoại tuyến đứng trên). Đã deploy và xem trên production (chỉ đọc): vòng dẫn mới ở bước 1, 193 mã vé bấm được ở màn Khách hàng, màn soát vé điền sẵn mã và nút nằm trong tầm mắt ở 390px, trang đặt vé mở sẵn hôm nay. **Chưa đi trọn 8 bước trên production:** tối 28/09 mọi khung giờ hôm nay đã qua, và bước 1, 6 ghi dữ liệu thật.
- 28/09 `2aw`: viết lại và bật vòng dẫn 8 bước, soát từng tên nút với màn thật; sửa hai chỗ làm gãy kịch bản trình diễn (vé web chỉ đặt được từ ngày mai nên quét cổng hôm nay bị từ chối; gói không có Tràng An). Web nhận đặt hôm nay, khung đã qua khoá "Đã qua giờ". Ma trận thu gọn cơ sở trống. Bỏ các khoá số vòng dẫn không còn chặng nào dùng; xưng "bạn" thay "anh". Kiểm: `tsc`, lint, build, Vitest 1.706, Playwright 75 bài (vòng dẫn, trang đầu ERP, đặt chỗ, bản đồ chức năng), ảnh 390px/1440px. Đã deploy; trên production (đăng nhập giám đốc, chỉ đọc, không bấm vòng dẫn): vòng dẫn mở ở bước 1/8, bốn cơ sở thu gọn, ô ngày cho chọn hôm nay, khung 08:00 và 09:30 hôm nay báo "Đã qua giờ" lúc gần 23 giờ, ngày mai đặt được cả hai. **Chưa đi trọn 8 bước trên production** (bước 1 ghi đơn thật, bước 6 ghi phiếu quầy thật).
- 28/09 `2av`: soát cả hàng đợi, gạch 5 việc không cần (lý do ở mục C). Ma trận bốn cơ sở ghi "Chưa chốt ca" thay vì ba ô 0. Sửa 4 lỗi Lighthouse: ảnh lớn nhất màn đầu trang chủ thôi `lazy`, chữ nguồn trích báo đậm lên (tương phản 5,5–6), bỏ thẻ `<p>` lạc trong `<dl>` ở trang điểm đến, tên đọc của ghim bản đồ chứa số in trên ghim. Kiểm: `tsc`, lint, build, Vitest 1.705, Playwright 27 bài (bản đồ, Khám phá, trang đầu giám đốc), ảnh 390px/1440px. Đã deploy; Lighthouse điện thoại trên production sau deploy (một lượt mỗi trang): truy cập 100 cả bốn trang; tốc độ trang chủ 71 (trước 52–53), LCP 3,8 giây (trước 5,2). Trang đầu giám đốc trên production (đăng nhập thật, chỉ đọc) 390px và 1440px: cả bốn cơ sở ghi "Chưa chốt ca", không còn ô "Vé trong ca" nào.
- 28/09 `2au`: sửa logic phân quyền từ gốc (một nguồn: sổ tài khoản); quản lý có thêm module Báo cáo vốn bị thiếu; người tạo mới giao việc, nhận ca, đăng nhập bằng mã được; màn Tài khoản tạo một bước, hiện "Đang vào được" tính bằng đúng luật thật, thu hồi vai bằng nút ×; màn Nhân sự bỏ ô gán cơ sở riêng. Kiểm: Vitest 1.705, Playwright ERP 78 + 80, ảnh 390px/1440px.
- 28/09 `2at`: dọn tài khoản rác bằng 095 (khẳng định từng con số, quét lại mọi cột chữ và JSON; thử PGlite cả trường hợp lệch số phải huỷ). Production sau áp: 13 tài khoản, 17 phân vai, 2 dòng nhật ký quản trị, 0 đăng nhập Auth, giám đốc đăng nhập bình thường.
- 28/09 `2as`: áp `094`, ghép phễu; bài production phễu 2/2 xanh; phễu bỏ phần trăm quá 100% (nói "có lượt vào thẳng"). Đo ERP đã đăng nhập: đa số màn 0,35–0,65 giây; đọc song song ở trang đầu, Khách hàng (2,7 → 1,4 giây, nhật ký truy cập vẫn đi trước, có bài canh) và màn module (Vé Bái Đính 1,2 → 0,5 giây). Soát tĩnh 79 server action, thêm bài bảo mật canh.
- 27/09 `2ar`: gỡ chuỗi phòng trình diễn chết (`/journey/[id]`, `/demo/qr`, API sửa lịch, tham số `journey`). Sửa nút "Thêm vào hành trình" vốn không làm gì. Chống trễ: hàm máy chủ sang Tokyo, bỏ ảnh gốc 3–4 MB ở hai màn chờ và poster video, middleware bỏ qua tệp tĩnh. Kiểm: Vitest 1.678, lint, build, Playwright 94 bài (lập lịch, giữ ngữ cảnh, danh tính, hero, trang công khai), ảnh 390px và 1440px. Đo production sau deploy: `hkg1::hnd1`, byte đầu trang công khai khoảng 0,33 giây (trước khoảng 0,5); màn ERP chưa đo vì cần mật khẩu giám đốc.
- 27/09 `2aq`: rút gọn HANDOFF (bản cũ vào lưu trữ, sửa mục C cho đúng). Phễu khách chọn 7/30/90 ngày hoặc một dịp, so kỳ trước hoặc cùng dịp năm trước; đếm trong kho (`094`, chưa áp). Kiểm: Vitest 1.682 xanh, lint, build, PGlite 94 migration (7 ngày: 468 lượt web + 6.914 lượt quầy = 7.382, khớp đếm thẳng; 90 ngày 102 ms), ảnh 390px và 1440px. **Chưa kiểm trên production.**
- 26/09 tối `2ap`: áp 090–093; xoá hẳn lượt giữ quá hạn; lịch sử mẫu thành cửa sổ trượt làm mới hàng tháng; ẩn vòng dẫn.
- 26/09 `2ao`: nghĩ lại ERP; bỏ QR nhân viên; gỡ 2 module vỏ; lịch sử mẫu; báo cáo & dự báo thật; trang đầu có số thật.
- 26/09 `2ah`–`2an`: QR thanh toán giả lập, lưu ảnh vé, hộ chiếu, Khách thấy gì, bản đồ chức năng, dọn mã chết (−6.600 dòng), đối chiếu tài liệu khách.
- Trước 26/09: xem mục lục `2a`…`2ag` và các mục 0–4 trong lưu trữ.

---

## 1. Khách hàng cần gì (tóm tắt)

- ERP nội bộ đạt mức production-ready cho buổi demo.
- Từ 17–18/08/2026, lớp khách hàng Gói A đi trước (dữ liệu hành vi, Customer 360, đo nguồn marketing, tín hiệu bán dịch vụ), với hai điều kiện:
  - không phá chức năng ERP đang chạy;
  - không dựng nguồn sự thật thứ hai.
- Kế hoạch gốc: `docs/plans/GOI_A_KE_HOACH.md`; phân giao đợt Tam Cốc: `docs/plans/PHAN_GIAO_VIEC_TAM_COC.md`. Chỉ đọc khi làm đúng đầu việc ấy.

## 5. Mười hai cái bẫy đã sập ít nhất một lần — đừng lặp lại

1. **Test xanh vẫn giấu được lỗi.** Bài kiểm phân quyền phải chạy với mọi vai, mọi cơ sở tương đương, không chỉ một đại diện.
2. **`RLS 100%` không có nghĩa ERP được cơ sở dữ liệu bảo vệ:** ERP vẫn dùng service role và tự kiểm bằng TypeScript (T6c chưa làm).
3. **Việc lớn phải chia sao cho dừng ở bước nào hệ thống vẫn chạy.**
4. **Số bịa trong một module thật phá hỏng cả module đúng.** Chưa có nguồn thì nói thẳng là chưa có. Soát số bịa phải quét cả module đang chạy.
5. **Xây nửa dưới rồi dừng thì nửa đó không tồn tại với người dùng.** Tính năng phải đi hết từ giao diện xuống dữ liệu và quay lại.
6. **Hai nguồn sự thật về cùng một thứ thì cả hai đều sai** (`demo-data.ts` với `erp_account_registry`, `managedSiteIds` với `siteIds`).
7. **Tệp `"use server"` chỉ được export hàm async.** Kiểu hay giá trị khởi tạo cho action để ở phía component.
8. **`vi.mock` phải theo kịp mọi import mới,** kể cả gián tiếp. Import tĩnh thêm vào `app/erp/actions.ts` làm gãy bài tích hợp; dùng `await import()` nạp muộn khi cần.
9. **Số bịa nguy hiểm nhất là khi một nút bấm ghi nó thành dữ liệu thật:** lần theo xem con số có bị hành động nào đóng dấu thành sự thật không.
10. **Migration chỉ sửa dữ liệu vẫn đâm vào trigger bảo vệ.** Trước khi đẩy, soát `pg_trigger` hoặc migration tạo bảng. Chạy thử bằng PGlite.
11. **Lỗi "use server" có thể trốn khỏi `next build`.** Gặp một lần thì grep mọi tệp `"use server"`.
12. **State phía client có thể biến mất khi component đổi nhánh theo dữ liệu server vừa làm mới.** Thứ chỉ hiện một lần (mật khẩu tạm, OTP) phải kiểm `state.status === "success"` trước.

*(Bản đủ lời kể của 12 bẫy: mục 5 trong tệp lưu trữ.)*

## 6. Tài liệu còn lại nằm đâu

- `docs/plans/`: `PHAN_GIAO_VIEC_TAM_COC.md` (đợt TC), `NHAT_KY_THI_CONG.md`, `GOI_A_KE_HOACH.md`.
- `docs/reference/`: chỉ đọc khi đúng việc.
  - `UI_UX_RULES.md` và `REFERENCE_SITE_ANALYSIS.md`: bắt buộc khi sửa giao diện.
  - `SO_TAY_HE_THONG_VI.md`: hệ thống làm gì.
  - `TIEU_CHI_NGHIEM_THU.md`: định nghĩa "xong".
  - `TAI_LIEU_KHACH_HANG_CUNG_CAP_VI.md`, `ERP_ACCOUNTING_REQUIREMENTS_VI.md`, `ERP_WORKDAY_GPS_REQUIREMENTS_VI.md`, `DATA_SOURCES.md`, `KY_NANG_GIAO_DIEN.md`.
- `docs/archive/`: lịch sử, **không dùng để kết luận hiện trạng**. Riêng `HANDOFF_DAY_DU_DEN_2026-09-26.md` là HANDOFF đầy đủ trước khi rút gọn: chỉ `grep` theo mã việc.

## 7. Quy tắc làm việc

- Nằm ở `AGENTS.md`: kiểm chứng thật trên production, bài kiểm phải tự dọn dữ liệu, dọn máy sau khi xong, không thêm co-author vào commit.
- **Đọc `AGENTS.md` và tệp này là đủ để bắt đầu.**
