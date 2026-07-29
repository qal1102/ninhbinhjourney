# Yêu cầu nghiệp vụ kế toán cho ERP vận hành du lịch

> Tài liệu này chuyển các yêu cầu pháp lý và kiểm soát nội bộ thành yêu cầu sản phẩm cho bản demo/thiết kế hệ thống. Đây không phải ý kiến tư vấn pháp lý hoặc thuế. Khi triển khai thật, doanh nghiệp và đơn vị tư vấn phải xác nhận chế độ kế toán, chính sách thuế, danh mục tài khoản và quy trình phê duyệt áp dụng cho pháp nhân cụ thể.

## 1. Mục tiêu

Kế toán không nhập lại toàn bộ hoạt động từ giấy, Excel, POS và tin nhắn. Mỗi nghiệp vụ tại Tràng An, Tam Chúc, Tam Cốc và Bái Đính phải tạo được một hồ sơ nguồn có người chịu trách nhiệm, chứng từ, chiều quản trị và lịch sử xử lý. Kế toán nhận hồ sơ đó để kiểm tra, đối soát, lập bút toán nháp, chuyển người kiểm tra và theo dõi đến khi ghi sổ/đóng kỳ.

Luồng chuẩn:

`Nhân viên phát sinh → Quản lý xác nhận → Kế toán kiểm tra/lập → Người kiểm tra duyệt → Thanh toán/ghi sổ → Đối soát → Khóa kỳ`

Giám đốc chỉ nhận ngoại lệ đã được xác minh: khoản chi vượt ngưỡng, chênh lệch không xử lý được, thiếu tiền, rủi ro thuế hoặc quyết định ảnh hưởng ngân sách. Giám đốc không phải đọc toàn bộ hàng việc kế toán.

## 2. Cơ sở quy định được kiểm tra tại ngày 28/07/2026

- [Thông tư 99/2025/TT-BTC về chế độ kế toán doanh nghiệp](https://vbpl.vn/TW/Pages/vbpq-van-ban-goc.aspx?ItemID=187356), áp dụng từ 01/01/2026 và thay Thông tư 200. Bộ Tài chính cũng nêu yêu cầu doanh nghiệp ban hành quy chế hạch toán, tăng kiểm soát và đối chiếu trong [bản giới thiệu chính sách](https://www.mof.gov.vn/tin-tuc-tai-chinh/tin-chinh-sach-tai-chinh/quy-dinh-moi-ve-che-do-ke-toan-doanh-nghiep).
- [Luật Kế toán 88/2015/QH13](https://vbpl.vn/botuphap/Pages/vbpq-toanvan.aspx?ItemID=95924) và [Luật 56/2024/QH15 sửa đổi](https://vanban.chinhphu.vn/?docid=212484&pageid=27160): chứng từ phải có nội dung bắt buộc, dữ liệu điện tử phải toàn vẹn và tra cứu được, ghi sổ phải dựa trên chứng từ, sửa đổi phải để lại dấu vết.
- [Nghị định 174/2016/NĐ-CP](https://vanban.chinhphu.vn/?docid=187897&pageid=27160): hồ sơ kế toán phải được quản lý, đưa vào lưu trữ và giữ theo đúng nhóm thời hạn luật định. Hệ thống không được coi file tạm trong trình duyệt là kho lưu trữ kế toán.
- [Nghị định 123/2020/NĐ-CP](https://vanban.chinhphu.vn/?docid=201365&lang=vi&pageid=27160), [Nghị định 70/2025/NĐ-CP](https://vanban.chinhphu.vn/?docid=213179&lang=vi&pageid=27160) và [Thông tư 32/2025/TT-BTC](https://vbpl.vn/botaichinh/Pages/vbpq-thuoctinh.aspx?ItemID=178309): cần theo dõi trạng thái hóa đơn điện tử, truyền lỗi, điều chỉnh/thay thế và liên kết giao dịch bán hàng trực tiếp với hóa đơn.
- [Nghị định 320/2025/NĐ-CP về thuế TNDN](https://vanban.chinhphu.vn/?classid=1&docid=216219&pageid=27160&typegroupid=4) và [hướng dẫn của Bộ Tài chính](https://www.mof.gov.vn/tin-tuc-tai-chinh/tin-chinh-sach-tai-chinh/cac-khoan-chi-phi-duoc-tru-khi-tinh-thue-tndn-phai-co-du-hoa-don-chung-tu-theo-quy-dinh): hồ sơ chi phí phải đủ hóa đơn/chứng từ và bằng chứng thanh toán không dùng tiền mặt khi thuộc trường hợp áp dụng. Ngưỡng và hiệu lực phải được cấu hình theo phiên bản chính sách, không đóng cứng vĩnh viễn trong mã nguồn.
- [Bộ luật Lao động 45/2019/QH14](https://vanban.chinhphu.vn/?classid=1&docid=198540&pageid=27160&typegroupid=3) và [Luật Bảo hiểm xã hội 41/2024/QH15](https://vanban.chinhphu.vn/?classid=1&docid=211199&orggroupid=1&pageid=27160): bảng lương phải nối được với hợp đồng, ca công, làm thêm, phụ cấp, khấu trừ và dữ liệu bảo hiểm áp dụng.

## 3. Vai trò và phạm vi công việc

| Vai trò | Việc phải làm trên hệ thống | Không nên được làm |
|---|---|---|
| Nhân viên hiện trường/quầy vé | Check-in, bán vé, ghi nhận tiền thu, chấm công, hoàn thành việc, nộp ảnh/chứng từ nguồn | Sửa số đã được quản lý xác nhận; lập hoặc duyệt bút toán |
| Quản lý cơ sở | Xác nhận chốt ca, nghiệm thu dịch vụ, duyệt bảng công, phân loại chênh lệch, trả hồ sơ thiếu cho nhân viên | Tự ghi sổ; duyệt khoản do chính mình lập nếu vi phạm phân tách nhiệm vụ |
| Kế toán tổng hợp | Nhận hồ sơ từ bốn cơ sở, kiểm tra bộ chứng từ, đối soát, gắn mã tài khoản/chiều quản trị, lập bút toán và đề nghị thanh toán | Điều phối camera/sức chứa/nhân sự; tự duyệt bút toán do mình lập |
| Kế toán trưởng/người kiểm tra | Kiểm tra độc lập bút toán, chính sách thuế, kỳ hạch toán và hồ sơ thanh toán | Thay chứng từ nguồn mà không trả việc và ghi lý do |
| Giám đốc | Duyệt ngoại lệ đã chuyển cấp, ngân sách/vượt ngưỡng và xem báo cáo hợp nhất | Xử lý từng chứng từ thông thường hoặc xem “việc đến hạn” của nhân viên |
| Kiểm soát/kiểm toán | Đọc lịch sử, truy vết từ báo cáo đến bút toán và chứng từ, xuất hồ sơ kiểm tra | Xóa hoặc sửa giao dịch nguồn |

Tài khoản demo hiện có thêm `ketoan / Ketoan@2026` cho vai trò kế toán tổng hợp. Kế toán trưởng/người kiểm tra đang được thể hiện trong luồng maker–checker nhưng chưa có tài khoản demo riêng.

## 4. Hồ sơ tối thiểu của một nghiệp vụ

Mỗi hồ sơ cần có:

- Mã duy nhất, loại nghiệp vụ, pháp nhân/cơ sở, bộ phận, dự án/sự kiện, sản phẩm hoặc kênh bán.
- Ngày phát sinh, ngày chứng từ, kỳ hạch toán, hạn xử lý và trạng thái.
- Người tạo, người xác nhận nguồn, người lập, người kiểm tra, người duyệt ngoại lệ.
- Giá trị trước thuế, thuế, tổng thanh toán, loại tiền, phương thức thanh toán và đối tượng liên quan.
- Chứng từ nguồn, tài liệu còn thiếu, phiên bản file, checksum hoặc dấu hiệu bảo đảm toàn vẹn khi triển khai thật.
- Định khoản nháp gồm tài khoản Nợ/Có và tổng Nợ bằng tổng Có.
- Timeline bất biến: ai làm gì, lúc nào, từ trạng thái nào sang trạng thái nào, lý do và bằng chứng.
- Liên kết ngược đến ca vé, lượt QR, báo cáo hiện trường, bảng công, hợp đồng, nghiệm thu, tài sản hoặc dự án đã tạo số liệu.

## 5. Các ca nghiệp vụ cần chạy được

### Doanh thu vé và check-in

1. Nhân viên mở ca, bán vé/nhận thanh toán và ghi lượt QR.
2. Cuối ca gửi số vé theo loại, tiền mặt, POS/chuyển khoản, hoàn/hủy và chênh lệch.
3. Quản lý xác nhận ca hoặc trả lại kèm lý do.
4. Kế toán khớp bốn nguồn: bảng kê vé, QR/cổng, POS/ngân hàng và tiền nộp quỹ.
5. Chỉ hồ sơ khớp mới được lập bút toán doanh thu/thuế; chênh lệch tạo việc có SLA và người giải trình.

### Công nợ nhà cung cấp và thanh toán

1. Nhu cầu/đơn đặt hàng hoặc hợp đồng đã được duyệt.
2. Quản lý xác nhận dịch vụ/hàng hóa đã nhận bằng biên bản nghiệm thu.
3. Kế toán nhận hóa đơn và thực hiện đối chiếu hợp đồng–nghiệm thu–hóa đơn.
4. Hồ sơ thiếu bị trả đúng bộ phận; hồ sơ đủ được lập công nợ và đề nghị thanh toán.
5. Người kiểm tra duyệt; thanh toán lưu bằng chứng ngân hàng; cuối cùng đối soát và ghi sổ.

### Chi phí và hoàn ứng

- Liên kết tạm ứng ban đầu, người nhận, mục đích, dự án/mã chi phí, hóa đơn/chứng từ và số tiền hoàn lại.
- Cảnh báo khoản quá hạn hoàn ứng, trùng hóa đơn, sai kỳ, vượt ngân sách hoặc thiếu bằng chứng thanh toán.

### Lương và bảng công

- Nhân viên chấm công; quản lý xác nhận ca, làm thêm, nghỉ, phụ cấp và ngoại lệ.
- Kế toán chỉ nhận bảng công đã khóa theo đơn vị; kiểm tra biến động với kỳ trước; lập batch lương, khấu trừ và nghĩa vụ liên quan.
- Không cho phép kế toán sửa ca gốc. Nếu sai phải trả việc cho quản lý và giữ lịch sử.

### Tài sản và bảo trì

- Từ mua sắm/nghiệm thu tạo hồ sơ tài sản có mã, vị trí, người quản lý, nguyên giá, ngày sẵn sàng sử dụng và hồ sơ nguồn.
- Bảo trì, điều chuyển, kiểm kê, dừng sử dụng/thanh lý phải nối vào cùng lịch sử tài sản.
- Chính sách ghi nhận, thời gian khấu hao và tài khoản áp dụng phải cấu hình theo pháp nhân/chính sách được phê duyệt.

### Hóa đơn điện tử

- Theo dõi chưa phát hành, đã phát hành, truyền thành công, truyền lỗi, cần điều chỉnh/thay thế và đã hoàn tất.
- Hóa đơn phải liên kết giao dịch gốc; không để người dùng “đổi trạng thái” mà không có phản hồi từ nhà cung cấp hóa đơn/cơ quan thuế khi tích hợp thật.

### Đóng kỳ

- Checklist tối thiểu: ngân hàng/quỹ, doanh thu–vé–QR, công nợ phải thu/phải trả, lương, tài sản/khấu hao, dồn tích/phân bổ, hóa đơn lỗi và cân đối phát sinh.
- Mỗi ngoại lệ có người phụ trách và hạn. Khóa kỳ chỉ sau khi người có quyền xác nhận; mở lại kỳ phải có lý do và audit.

## 6. Trạng thái triển khai trong bản hiện tại

Đã có trong UI demo:

- Bàn làm việc riêng cho kế toán, hàng việc toàn vùng và bộ lọc theo cơ sở/loại hồ sơ.
- Chín hồ sơ mẫu bao phủ doanh thu, phải trả, hoàn ứng, lương, tài sản, hóa đơn điện tử và đóng kỳ.
- Bộ chứng từ đủ/thiếu, chiều quản trị, định khoản cân đối, maker–checker, timeline và thao tác chuyển trạng thái trong phiên.
- Quyền kế toán chỉ đọc hồ sơ vận hành nguồn; không có nút chốt ca, tạo báo giá, báo cáo hiện trường, nhân sự hay camera.
- Unit/E2E kiểm tra quyền, cân đối Nợ–Có, luồng thao tác và mobile không tràn ngang.

Chưa được phép coi là đã vận hành thật:

- Trạng thái thao tác kế toán hiện chỉ ở client state, chưa lưu bền.
- Chưa có tài khoản kế toán trưởng riêng và chữ ký/phê duyệt điện tử.
- Chưa nối POS, ngân hàng, hóa đơn điện tử, phần mềm lương hoặc sổ cái thật.
- Chưa chạy migration kế toán/Supabase production và chưa có kho lưu trữ hồ sơ tuân thủ.

## 7. Ưu tiên kỹ thuật tiếp theo

1. Thiết kế schema bất biến cho `source_events`, `accounting_cases`, `documents`, `journal_entries`, `journal_lines`, `approvals`, `payments`, `reconciliations`, `period_locks` và `audit_events`.
2. RLS theo pháp nhân/cơ sở/vai trò; tách quyền lập–kiểm tra–duyệt; cấm cập nhật trực tiếp sự kiện đã xác nhận.
3. Lưu file vào Storage có version, checksum, metadata, chính sách lưu trữ và log truy cập.
4. Nối một golden path thật trước: chốt ca vé → quản lý xác nhận → kế toán đối soát → người kiểm tra duyệt → ghi sổ.
5. Sau golden path mới nối NCC/AP, bảng lương, tài sản, hóa đơn điện tử và đóng kỳ.
