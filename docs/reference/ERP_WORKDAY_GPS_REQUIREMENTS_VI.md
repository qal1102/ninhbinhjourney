# Yêu cầu phiếu công việc, GPS và bằng chứng hiện trường

Ngày cập nhật: 29/07/2026.

## 1. Mục tiêu

Một nhân viên trong một ca phải biết rõ:

1. Hôm nay làm ở cơ sở nào, trạm nào, ca nào.
2. Ai giao việc, việc cụ thể là gì, hạn và yêu cầu hoàn thành.
3. Khi nào đã vào ca, đang làm đến đâu và vướng mắc gì.
4. Ảnh nào chứng minh kết quả, được gửi lúc nào và GPS của thiết bị khi gửi ở đâu.
5. Khi bàn giao thì ai kiểm tra, đã đạt hay cần bổ sung gì.

Quản lý phải giao đúng người/đúng cơ sở/đúng nghiệp vụ, thấy vị trí mới nhất trong ca, mở bản đồ, duyệt hoặc trả lại cùng một phiếu. Hệ thống không theo dõi bí mật ngoài ca.

## 2. Ranh giới kỹ thuật và quyền riêng tư

- Geolocation trên web yêu cầu HTTPS và người dùng cấp quyền rõ ràng.
- Chỉ bắt đầu `watchPosition` sau khi nhân viên chủ động bấm vào ca; trên màn hình luôn hiện “GPS trong ca đang bật”.
- Tạm dừng theo dõi khi đã bàn giao; nếu quản lý trả lại thì theo dõi mở lại cho tới lần gửi mới.
- Web/PWA có thể bị trình duyệt hoặc hệ điều hành tạm dừng khi chạy nền. Không được quảng cáo là GPS nền liên tục như ứng dụng native.
- Mỗi vị trí có tọa độ, độ chính xác, thời gian, khoảng cách đến geofence và cờ trong/ngoài vùng. Quản lý phải thấy độ mới; không dùng một chấm không có timestamp.
- Ảnh dùng vị trí mới tối đa 10 phút, độ chính xác trong `1–250 m` và được máy chủ/trigger tính lại khoảng cách. Đây là vị trí thiết bị lúc gửi, không phải chứng thực tuyệt đối thời điểm chụp hoặc chống giả GPS.
- Sơ đồ vị trí được vẽ trong hệ thống; không nhúng bản đồ bên thứ ba chứa tọa độ chính xác của nhân viên.
- Trước mở người dùng thật phải chốt với khách hàng: nội dung đồng ý, mục đích xử lý, thời gian lưu GPS/ảnh, vai trò được xem, quy trình rút lại quyền và xóa dữ liệu theo Nghị định 13/2023/NĐ-CP.

Nguồn chuẩn:

- W3C Geolocation API: https://www.w3.org/TR/geolocation/
- MDN `watchPosition`: https://developer.mozilla.org/en-US/docs/Web/API/Geolocation/watchPosition
- Nghị định 13/2023/NĐ-CP: https://vanban.chinhphu.vn/?pageid=27160&docid=207759

## 3. Công việc phải đúng mô hình từng cơ sở

### Tràng An

- Đón đoàn, xác thực mã và quyền lợi tại cổng.
- Kiểm tra thuyền, áo phao, mái chèo và người chèo đò trước tuyến.
- Điều phối hàng chờ, ghép khách và phân thuyền.
- Người chèo đò bàn giao số lượt, số khách, tình trạng hang/tuyến, vật cản và ảnh tại bến.

Nguồn tham khảo chính thức:

- Cổng du lịch Ninh Bình mô tả tuyến thuyền cố định và sức chứa 4–5 người/thuyền: https://visitninhbinh.com.vn/vi/trang-an-dip-le-30-4-co-gi-dang-de-kham-pha-va-trai-nghiem-8607
- Sở Văn hóa và Thể thao Ninh Bình nêu các nhóm lao động trực tiếp gồm người chèo đò, bán hàng, an ninh và dịch vụ: https://vhtt.ninhbinh.gov.vn/vi/tuyen-truyen-phat-trien-du-lich/trang-an-di-san-kep-the-gioi-va-hanh-trinh-gin-giu-gia-tri-ben-vung-1798.html

### Tam Cốc

- Kiểm tra thuyền, áo phao, số khách và tình trạng tuyến sông Ngô Đồng qua ba hang.
- Điều phối khách/thuyền tại bến, theo dõi thời gian chờ.
- Người chèo đò bàn giao số chuyến, số khách, tình trạng thuyền.
- Ghi nhận rác, vật cản hoặc điểm ảnh hưởng luồng thuyền.

Nguồn tham khảo chính thức: https://visitninhbinh.com.vn/vi/kinh-nghiem-du-lich-tam-coc-ninh-binh-dip-tet-chi-tiet-de-ap-dung-7040

### Tam Chúc

- Điều phối xe điện giữa Trung tâm Hội nghị quốc tế Vesak và Tam Quan Nội.
- Kiểm vé, khung giờ và số khách lên thuyền/du thuyền.
- Theo dõi mật độ và luồng đi bộ/xe điện tại Tam Quan Nội.
- Bàn giao khách xá, phòng chờ, suất ăn/đồ uống và yêu cầu đoàn.
- Không gán nhiệm vụ “chèo đò” của Tràng An/Tam Cốc cho nhân viên Tam Chúc.

Nguồn tham khảo chính thức:

- Danh mục dịch vụ Tam Chúc: https://tamchuc.com.vn/dich-vu/
- Sản phẩm kết hợp thuyền và xe điện: https://tamchuc.com.vn/thong-bao-trien-khaimo-ban-san-pham-moi

### Bái Đính

- Điều phối xe điện đưa đón khách.
- Hướng dẫn luồng khách tại khu chùa mới và các điểm lên/xuống xe.
- Kiểm tra lối đi, biển hướng dẫn, điểm nghỉ và điều kiện an toàn trước mở cửa.
- Bàn giao khu dịch vụ, ăn uống, nhà vệ sinh và tiện ích công cộng.
- Không gán nhiệm vụ “chèo đò” cho nhân viên Bái Đính.

Nguồn tham khảo chính thức: https://chuabaidinhninhbinh.vn/

## 4. Quyền và phạm vi

- Nhân viên: chỉ đọc và thực hiện phiếu có `employee_account_id` của mình, tại site/module còn hiệu lực.
- Quản lý: giao và duyệt trong `managedSiteIds`; một quản lý có thể quản lý nhiều site.
- Công việc chỉ xuất hiện trong danh mục chọn nếu nhân viên được gán site, có module tương ứng và module nằm trong danh sách đã đào tạo.
- Kế toán và giám đốc không nhận việc thường của nhân viên. Dữ liệu workday chỉ đi lên các vai trò này khi có báo cáo tổng hợp hoặc ngoại lệ được chuyển cấp.
- Mọi chuyển trạng thái dùng version và idempotency; phiên cũ hoặc gửi lặp không được tạo hai kết quả.

## 5. Dữ liệu và kiểm thử đã có

- Migration: `202607290004_erp_workday_lifecycle.sql` và `202607290005_erp_workday_resubmission_integrity.sql`.
- Bảng: `erp_workday_workflows`, `erp_workday_audit_events`, `erp_workday_location_events`, `erp_workday_site_geofences`.
- Storage: bucket riêng tư `erp-workday-evidence`, tối đa 5 MB, JPEG/PNG/WebP/HEIC/HEIF.
- RPC service-role: giao việc, chuyển trạng thái, ghi vị trí trong ca.
- E2E Supabase trước hardening đã qua với hai browser context: quản lý giao → nhân viên GPS vào ca → báo 50% → gửi ảnh → bàn giao → quản lý xem sơ đồ → duyệt → nhân viên đọc kết quả.
- Sau hardening, quản lý phải xem ảnh/kết quả/audit trước duyệt; ảnh final và ảnh gửi lại phải là evidence mới; object có UUID, SHA-256 và không ghi đè. Unit/security/integration thuộc batch đã qua.
- Mobile Pixel 7 không có horizontal overflow trên màn workday.

## 6. Việc còn lại trước khi dùng thật

- Chốt consent/retention và thông báo quyền riêng tư với khách hàng/pháp chế.
- Tách `Shift/Attendance` khỏi `TaskAssignment`; hiện một phiếu đang đồng thời đại diện task và mốc mở/đóng theo dõi.
- Geofence chi tiết theo zone/station thay vì một vòng tròn chung cho cả cơ sở.
- Missed punch, OT, nghỉ phép, đổi ca, nhiều việc/người/ngày và bàn giao ca tổng.
- Khóa bảng công, duyệt ngoại lệ và nối payroll/kế toán.
- Offline queue cho GPS/ảnh, retry có idempotency và hiển thị trạng thái đồng bộ.
- UAT thực địa trên iOS/Android ở bốn cơ sở; đo sai số GPS tại cổng, bến, khu mái che và vùng tín hiệu yếu.
