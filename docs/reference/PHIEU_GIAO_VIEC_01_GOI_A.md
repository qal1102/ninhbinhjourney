# PHIẾU GIAO VIỆC SỐ 01 — XÂY LỚP KHÁCH HÀNG (GÓI A)

> **Nguồn:** bản PDF do chủ dự án giao, chép lại nguyên văn vào repo ngày 17/08/2026 để mọi phiên làm việc sau đọc được mà không cần file ngoài.
> Đây là **đề bài**, không phải hiện trạng. Hiện trạng nằm ở `docs/HANDOFF.md`. Kế hoạch thi hành nằm ở `docs/plans/GOI_A_KE_HOACH.md`.

Dự án Ninh Binh Journey — thí điểm Tam Cốc (tháng 8/2026)

| | |
|---|---|
| **Người giao việc** | Chủ dự án |
| **Người thực hiện** | Claude Code (máy cục bộ, làm việc trực tiếp trong repo) |
| **Repo** | ninhbinhjourney (Next.js 16, React 19, Supabase/Postgres, Tailwind, Vitest, Playwright) |
| **Phạm vi đợt này** | Gói A — lớp khách hàng tối thiểu ra khách: đặt vé theo khung giờ, vé QR, soát vé ngoại tuyến, QR động đo nguồn, bảng điều hành phễu |
| **Ngoài phạm vi** | Zalo, hàng chờ ảo phía khách, Wallet, loyalty, kiosk, Wi-Fi portal, CDP, cổng thanh toán thật — chưa được làm khi chưa có phiếu giao việc mới |

---

## 1. Bối cảnh và điều chỉnh ưu tiên

Tài liệu `docs/HANDOFF.md` hiện ghi ưu tiên số một là ERP nội bộ. Phiếu này điều chỉnh: kể từ đợt này, ưu tiên là xây lớp khách hàng (Gói A) phục vụ thí điểm Tam Cốc, với hai điều kiện bắt buộc: **không phá vỡ bất kỳ chức năng ERP nào đang chạy**, và **tái sử dụng tối đa phần lõi đã có** (đối chiếu vé T8, sức chứa theo giờ T11a) thay vì xây nguồn dữ liệu thứ hai.

Yêu cầu nghiệp vụ gốc nằm trong file `docs/reference/Bao_cao_tong_the_he_sinh_thai_so_du_lich_Ninh_Binh.docx` (chủ dự án sẽ copy vào repo trước khi bắt đầu).

Các nguyên tắc rút gọn phải tuân thủ:

- Một nguồn tồn kho duy nhất; công suất bằng điểm nghẽn nhỏ nhất nhân hệ số an toàn.
- Mọi lượt khách có một mã hành trình.
- Định danh là **tự nguyện và tăng dần** — mã giao dịch trước, số điện thoại hoặc email chỉ khi khách cần lưu vé.
- Quyền phục vụ tách khỏi quyền nhận truyền thông.
- Luồng soát vé phải chạy được khi mất mạng.

## 2. Ràng buộc chung (áp dụng cho mọi nhiệm vụ)

- Đọc `docs/HANDOFF.md` và `docs/reference/SO_TAY_HE_THONG_VI.md` trước khi viết bất kỳ dòng mã nào; làm đúng văn hóa repo: mỗi migration kèm bài kiểm tra hợp đồng riêng, RLS bật trên bảng mới, không dữ liệu bịa trong giao diện, module chưa có nghiệp vụ phải ghi rõ.
- Chạy toàn bộ bộ kiểm tra hiện có (lint, typecheck, build, Vitest) trước khi báo cáo hoàn thành; không được làm hỏng các bài kiểm tra đang xanh.
- Toàn bộ giai đoạn này chạy với **dữ liệu giả lập gắn nhãn thử nghiệm**: không thu dữ liệu khách thật, không gửi tin nhắn hay email thật, không nối cổng thanh toán thật. Lý do: các quyết định về pháp nhân dữ liệu, thẩm quyền bán vé và hợp đồng thanh toán đang chờ phê duyệt.
- Thiết kế **không khóa vào hạ tầng hiện tại**: chỉ dùng chuẩn Postgres thông dụng, cấu hình tên thương hiệu và tên miền qua biến môi trường, để sẵn khả năng chuyển máy chủ dữ liệu về nhà cung cấp trong nước.
- Giao diện khách bằng tiếng Việt, ưu tiên màn hình điện thoại; mỗi thao tác của khách **không quá ba bước**.
- Kết thúc mỗi nhiệm vụ phải cập nhật `docs/HANDOFF.md` theo đúng văn phong hiện có: cái gì đã kiểm chứng thật, cái gì chưa, lỗi nào bắt được trong lúc làm.

## 3. Danh mục nhiệm vụ và tiêu chí hoàn thành

### A0 — Khảo sát và kế hoạch (bắt buộc làm trước, chưa viết mã)

Đọc HANDOFF, sổ tay hệ thống, mã nguồn T8 (`erp_tickets`, luồng check-in) và T11a (cấu hình sức chứa), cùng báo cáo nghiệp vụ trong `docs/reference`.

**Đầu ra:** file `docs/plans/GOI_A_KE_HOACH.md` nêu rõ phần tái sử dụng, phần xây mới, **quyết định kỹ thuật quan trọng nhất** (vé lớp khách dùng chung bảng `erp_tickets` hay bảng mới có cầu nối — phải chọn và nêu lý do), thứ tự làm và rủi ro.

**Chủ dự án duyệt kế hoạch này rồi mới sang A1.**

### A1 — Mô hình dữ liệu lớp khách

Hồ sơ khách khởi tạo ẩn danh và hợp nhất được khi khách để lại số điện thoại hoặc email; đơn đặt chỗ theo ngày và khung giờ; tồn kho khung giờ đọc từ cấu hình sức chứa T11a, **tuyệt đối không tạo nguồn công suất thứ hai**; cơ chế giữ chỗ có thời hạn 10 phút khi khách bấm thanh toán, hết hạn tự trả chỗ, dùng khóa dòng để hai phiên đặt song song không bao giờ bán vượt.

**Hoàn thành khi:** migration chạy sạch, bài kiểm tra hợp đồng xanh, RLS bật, có bài kiểm tra đặt chỗ đồng thời chứng minh không bán vượt, không sửa bảng ERP hiện có ngoài việc đọc.

### A2 — Luồng đặt vé công khai trên web

Trang đặt vé: chọn ngày, khung giờ (hiển thị số chỗ còn), số khách người lớn và trẻ em, **một trường liên hệ duy nhất** để nhận vé; thanh toán qua lớp trừu tượng `PaymentProvider` với bản giả lập đủ ba tình huống thành công, thất bại, quá hạn; phát hành mỗi khách một vé QR có chữ ký chống giả, mở lại được bằng đường dẫn riêng kể cả khi mạng yếu.

**Hoàn thành khi:** kiểm tra đầu-cuối bằng Playwright đi trọn luồng đặt và nhận vé với thanh toán giả lập.

### A3 — Soát vé hoạt động khi mất mạng

Trang quét cho nhân viên trong ERP, dựng trên luồng đối chiếu vé T8: nạp trước danh sách vé hợp lệ của khung giờ trong ca; khi mất mạng vẫn quét được, ghi hàng đợi cục bộ và tự đồng bộ khi có mạng; chống quét trùng ở cả máy trạm lẫn máy chủ; ghi nhận cả lượt bị từ chối kèm lý do.

**Hoàn thành khi:** có bài kiểm tra mô phỏng mất mạng, quét một lô vé ngoại tuyến rồi đồng bộ đủ, không trùng, không mất.

### A4 — Mã QR động đo nguồn

Đường dẫn chuyển hướng dạng `/q/[mã]`: mỗi mã gắn vị trí, chiến dịch và đích đến; đổi đích không phải in lại mã; ghi lượt quét theo thời điểm và nguồn.

**Hoàn thành khi:** tạo, đổi đích và đếm lượt quét hoạt động, có kiểm tra tự động.

### A5 — Bảng điều hành phễu trong ERP

Một trang cho quản lý: quét mã, mở trang, giữ chỗ, thanh toán, soát vé theo ngày, khung giờ và nguồn; lượng bán so với công suất từng khung giờ. Chỉ hiển thị số liệu thật từ cơ sở dữ liệu, ghi rõ nguồn từng con số.

**Hoàn thành khi:** số trên bảng khớp dữ liệu kiểm tra tạo ra trong A2 và A3.

### A6 — Cập nhật bàn giao và tổng nghiệm thu

Chạy toàn bộ kiểm tra của repo; cập nhật `docs/HANDOFF.md`; đối chiếu với danh mục nghiệm thu rút gọn tại mục 5 và ghi rõ từng dòng đạt hay chưa.

## 4. Xử lý các quyết định đang chờ

| Quyết định đang chờ | Cách xử lý trong đợt này |
|---|---|
| Hợp đồng cổng thanh toán | Chỉ xây lớp trừu tượng và bản giả lập; chừa sẵn chỗ nối cho cổng trong nước phổ biến. |
| Tên thương hiệu, tên miền | Dùng tên hiện tại làm tên tạm; mọi chỗ hiển thị tên đọc từ biến cấu hình, đổi một chỗ là đổi toàn hệ thống. |
| Pháp nhân dữ liệu, nơi đặt máy chủ | Chỉ dữ liệu giả lập; không thu dữ liệu thật; thiết kế sẵn khả năng di chuyển cơ sở dữ liệu. |
| Thẩm quyền bán vé trực tuyến | Mọi trang phía khách gắn nhãn bản thử nghiệm nội bộ, chưa mở công khai. |

## 5. Nghiệm thu đợt (rút gọn từ checklist MVP của báo cáo)

- [ ] Vé đặt trên web và vé phát tại quầy dùng **cùng một chuẩn mã**.
- [ ] Hai phiên đặt chỗ song song **không bao giờ bán vượt** công suất khung giờ.
- [ ] Soát vé có chế độ mất mạng và tự đồng bộ, chống quét trùng, ghi cả lượt từ chối.
- [ ] Mã QR động đo đúng nguồn và đổi đích không in lại.
- [ ] Bảng điều hành hiển thị phễu từ quét mã tới soát vé, **không có số bịa**.
- [ ] Toàn bộ kiểm tra của repo xanh; `HANDOFF.md` được cập nhật trung thực.
- [ ] Khách không điền biểu mẫu dài: **tối đa một trường liên hệ** trong luồng mua vé.

## 6. Cách làm việc và báo cáo

Làm tuần tự A0 đến A6, mỗi nhiệm vụ tự đứng được. **Dừng và hỏi lại chủ dự án** khi gặp một trong ba tình huống:

1. Phải sửa bảng hoặc nghiệp vụ ERP hiện có.
2. Phát hiện mâu thuẫn giữa phiếu này và tài liệu trong repo.
3. Một nhiệm vụ kéo theo phạm vi ngoài Gói A.

**Không tự mở rộng phạm vi trong bất kỳ tình huống nào.**
