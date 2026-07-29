# Phân tích hợp nhất tài liệu khách hàng cung cấp

## 1. Phạm vi nguồn đầu vào

Tài liệu này gom bốn nguồn mà khách hàng đã cung cấp thành một nền tri thức chung cho thiết kế hệ thống:

1. **Đề án TrangAn.vn v3** — định hướng hạ tầng kinh tế số, dữ liệu điểm đến, kết nối chuỗi giá trị và quản trị liên vùng.
2. **Playbook Tam Chúc** — mô hình chỉ huy, SOP, ngưỡng phản ứng, biểu mẫu, diễn tập và điều kiện Go/No-Go.
3. **Tam Chuc Operational Blueprint** — kiến trúc năng lực, nền tảng công nghệ, IPD, CDE/GIS và mô hình bàn giao đa bên.
4. **Tràng An OS · Flow Board / App Khách** — bản đồ luồng giữa khách, hướng dẫn viên, lái đò, tài xế, điều hành, nhà bán, đại lý và khách sạn tại `https://grow.claude.vn/tam/app_khach`.

Các nguồn trên là dữ liệu tham khảo nghiệp vụ, không phải đặc tả sản phẩm hoàn chỉnh. Kiến trúc cuối cùng phải được kiểm chứng bằng dữ liệu, quy trình và người chịu trách nhiệm thực tế tại từng cơ sở.

## 2. Điều đáng giữ lại từ từng nguồn

### Đề án TrangAn.vn v3

- Xem nền tảng như hạ tầng điều phối điểm đến, không chỉ là website giới thiệu.
- Tổ chức dữ liệu theo sáu lớp: thương hiệu, tri thức điểm đến, tiêu chuẩn dữ liệu, kết nối dịch vụ, vận hành/cảnh báo và phân tích quyết định.
- Cần cơ chế quản trị dữ liệu, phân quyền, nhật ký thay đổi và người duyệt.
- AI chỉ tóm tắt, phát hiện bất thường và đề xuất; quyết định quan trọng phải do con người phê duyệt.

### Hai tài liệu Tam Chúc

- Quản trị đa bên theo mô hình “chặt ở điểm giao — linh hoạt trong nội bộ — chặt ở nghiệm thu”.
- Mỗi quyết định chỉ có một người chịu trách nhiệm cuối cùng; các lệnh quan trọng cần đọc lại để xác nhận.
- Mọi cảnh báo phải gắn với ngưỡng và hành động đã định trước: xanh, vàng, cam, đỏ.
- Bàn giao ca/công việc cần thời gian, vị trí, checklist, ảnh hoặc bằng chứng và chữ ký xác nhận.
- Bốn điểm nghẽn cần ưu tiên tại Tam Chúc: bến thuyền Khách Điện, dốc Tháp Ngọc, không gian Tam Thế và luồng VIP/đại biểu.
- Nguyên tắc luồng cốt lõi: không đưa khách vào nhanh hơn khả năng thoát của điểm nghẽn phía trước.
- “Tam Phòng”: con người, rào chắn/vật lý và công nghệ phải cùng hiện diện trong phương án an toàn.
- Điều kiện Go/No-Go là cổng bắt buộc. Một hạng mục an toàn không đạt có thể chặn mở cửa hoặc cần phê duyệt rủi ro bằng văn bản.
- KPI tham chiếu: thời gian chờ thuyền/xe điện dưới 15 phút; phản ứng y tế khu vực núi dưới 4 phút; đối soát nguồn tiền 100%; phục hồi môi trường sau sự kiện đúng hạn.

### Tràng An OS · Flow Board

- Điểm mạnh là các bề mặt công việc theo vai trò và các sự kiện bàn giao rõ ràng.
- Các luồng nên giữ: yêu cầu hướng dẫn viên, phân chuyến, xác nhận đón khách, check-in đoàn, điều phối lái đò, đơn hàng/hoa hồng và quét vé/SOS.
- Hệ thống không nên triển khai ngay thành mười ứng dụng rời. Nên dùng bốn sổ cái dùng chung:
  - Vé, đơn hàng và quyền lợi khách.
  - Chuyến đi, phương tiện và điều phối.
  - Sự cố, nhiệm vụ và nhật ký vận hành.
  - Hoa hồng, công nợ và đối soát.
- Marketplace, AR, postcard, trợ lý hành trình và nội dung tăng trưởng thuộc giai đoạn sau; không được làm loãng ERP vận hành.

## 3. Mô hình hệ thống thống nhất

Hệ thống được chia thành ba lớp rõ ràng:

### Lớp khách hàng

Website công khai và hành trình số dành cho du khách: khám phá, lên lịch, mua vé, nhận quyền lợi, bản đồ, hỗ trợ trong chuyến và phản hồi.

### Lớp vận hành theo cơ sở

Mỗi cơ sở là một không gian riêng: Tràng An, Tam Chúc, Tam Cốc, Bái Đính. Nhân viên chỉ thấy cơ sở và nghiệp vụ được giao; quản lý phân công người và quyền; giám đốc có thể đi từ toàn vùng xuống từng cơ sở.

### Lớp điều hành toàn vùng

Giám đốc theo dõi tài chính, hiệu quả, sức chứa, SLA, rủi ro, dự báo và quyết định đang chờ. Dữ liệu phải truy được ngược về giao dịch, công việc và người chịu trách nhiệm.

## 4. Nhóm nghiệp vụ đề xuất

Không bê nguyên bản đồ 38 module vào giao diện. Phiên bản vận hành nên gom thành 12 nhóm:

1. Vé và đặt chỗ.
2. Khách và check-in.
3. Sức chứa và phân luồng.
4. Sự cố và điều phối.
5. Nhân sự và ca trực.
6. Chấm công theo cơ sở.
7. Phương tiện, bến và chuyến.
8. Tài sản, bảo trì và nghiệm thu.
9. Đối tác và nhà cung ứng.
10. SOP, diễn tập và điều kiện mở cửa.
11. Tài chính và đối soát.
12. Báo cáo và dự báo.

Mỗi nhóm dùng cùng một cấu trúc: chỉ số, hàng việc, người phụ trách, thời hạn, ngưỡng, bằng chứng, lịch sử và bước tiếp theo.

## 5. Các đối tượng dữ liệu cốt lõi

- `Site`, `Zone`, `Gate`, `Route`, `CapacityWindow`.
- `User`, `Role`, `Assignment`, `Shift`, `AttendanceEvent`.
- `Booking`, `Ticket`, `Entitlement`, `CheckInEvent`.
- `Trip`, `Vehicle`, `Berth`, `Driver`, `BoatOperator`.
- `Task`, `Incident`, `SOP`, `Threshold`, `Escalation`, `Handover`.
- `Asset`, `WorkOrder`, `Inspection`, `Evidence`, `Acceptance`.
- `Vendor`, `Contract`, `Commitment`, `Invoice`, `Reconciliation`.
- `RevenueEntry`, `CostEntry`, `CommissionEntry`, `DebtEntry`.
- `Notification`, `Decision`, `Approval`, `AuditEvent`.

Các sự kiện quan trọng gồm: vé phát hành, khách qua cổng, ngưỡng bị vượt, sự cố được nhận, nhiệm vụ được giao, người nhận xác nhận, bàn giao ca, nghiệm thu hoàn tất, đối soát lệch và quyết định được duyệt.

## 6. Dashboard giám đốc

Màn hình đầu tiên phải trả lời được sáu câu hỏi trong vài giây:

1. Doanh thu, chi phí, lợi nhuận và biên lợi nhuận đang ra sao so với tháng/quý/năm trước?
2. Cơ sở nào tạo giá trị tốt, cơ sở nào đang giảm và nguyên nhân là gì?
3. Điểm nào sắp vượt sức chứa hoặc SLA?
4. Sự cố nào chưa có người nhận hoặc sắp quá hạn?
5. 30/60/90 ngày tới có khả năng tăng hay giảm do đặt chỗ, mùa vụ, thời tiết, công suất hoặc bảo dưỡng?
6. Quyết định nào cần giám đốc duyệt ngay?

Dự báo phải hiển thị khoảng dự báo, độ tin cậy, các biến đầu vào và nguyên nhân. Không gắn nhãn “AI” cho số liệu chưa có mô hình và dữ liệu thật.

## 7. Tự động hóa có ích

- Đơn đặt chỗ đã xác nhận tự đi vào dự báo sức chứa và nhu cầu nhân sự.
- Khi mật độ vượt ngưỡng, hệ thống tạo việc dừng luồng phía trước, phân tuyến và gọi nguồn lực gần nhất.
- Báo cáo bằng giọng nói được chuyển thành phiếu sự cố có vị trí, thời gian và mức ưu tiên để người dùng duyệt.
- Công việc quá hạn hoặc chưa được nhận chỉ hiện cho cấp cần can thiệp; không làm lãnh đạo ngập trong chi tiết bình thường.
- Cuối ca tự tổng hợp việc mở, sự cố, bằng chứng và người tiếp nhận thành biên bản bàn giao.
- Dữ liệu bán vé, quầy, đại lý, phương tiện và nhà bán tự tạo hàng đối soát; chênh lệch được đẩy tới đúng người.
- PWA cho phép cài hệ thống lên màn hình chính; thông báo vượt ngưỡng phải dựa trên push subscription và chính sách gửi thực tế.

## 8. Lộ trình triển khai

### Giai đoạn 1 — Nền vận hành

- Đăng nhập, phân quyền theo vai trò/cơ sở/nghiệp vụ.
- Nhân sự, ca, chấm công, nhiệm vụ, sự cố, bàn giao.
- Vé/check-in, sức chứa, phương tiện và báo cáo ngày.
- PWA, trung tâm thông báo và nhật ký kiểm toán.

### Giai đoạn 2 — Tài chính và tích hợp

- Sổ doanh thu/chi phí, công nợ, hoa hồng, đối soát.
- Kết nối hệ thống vé, thanh toán, thiết bị quét, GPS/GIS và dữ liệu thời tiết.
- Dashboard tháng/quý/năm và cảnh báo lệch kế hoạch.

### Giai đoạn 3 — Dự báo và hệ sinh thái

- Mô hình dự báo có backtest và theo dõi sai số.
- Portal đối tác, đại lý, khách sạn, hướng dẫn viên và đơn vị vận chuyển.
- Hành trình khách, marketplace và các tính năng tăng trưởng đã được chứng minh giá trị.

## 9. Những điều không được tuyên bố quá sớm

- Không gọi dữ liệu là thời gian thực nếu chưa có kết nối nguồn và dấu thời gian đáng tin cậy.
- Không gọi dự báo là AI nếu chỉ là số liệu minh họa hoặc quy tắc tĩnh.
- Không coi cookie trình duyệt là cơ chế phân quyền sản xuất hay dữ liệu dùng chung đa thiết bị.
- Không thu dữ liệu nhận dạng khuôn mặt khi mục tiêu chỉ cần đếm mật độ ẩn danh.
- Không gộp tiền công đức/tài trợ tôn giáo với doanh thu vé, vận chuyển và dịch vụ.
- Không tự động ra quyết định an toàn hoặc nghi lễ khi chưa có người có thẩm quyền duyệt.

## 10. Tiêu chí nghiệm thu pilot

- Một nhân viên mới có thể nhận ca, xem đúng việc và gửi bằng chứng trong dưới 10 phút hướng dẫn.
- Quản lý biết ngay việc chưa nhận, sắp quá hạn và người chịu trách nhiệm.
- Bàn giao ca không cần tổng hợp lại từ tin nhắn rời rạc.
- Giám đốc đi từ KPI tổng hợp về giao dịch/sự cố nguồn trong tối đa ba thao tác.
- Mỗi cảnh báo có ngưỡng, hành động, người nhận, thời hạn và kết quả.
- Mỗi số tài chính truy được về nguồn và trạng thái đối soát.
- Dự báo có sai số đo được và được so lại với thực tế theo chu kỳ.
- Hệ thống hoạt động tốt trên điện thoại, cài được như PWA và không để lộ dữ liệu ngoài phạm vi được cấp.
