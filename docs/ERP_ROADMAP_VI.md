# Lộ trình hệ thống quản trị và điều hành điểm đến

## Trạng thái hiện tại

Phiên bản trải nghiệm đã hoạt động tại `/erp` với ba vai trò giám đốc, quản lý và nhân viên; bốn nhánh Tràng An, Tam Chúc, Tam Cốc, Bái Đính; phân công nghiệp vụ, chấm công, dashboard tài chính/vận hành và PWA.

Đây là bản kiểm chứng sản phẩm với số liệu minh họa. Để thành hệ thống vận hành đa thiết bị, cần chuyển dữ liệu khỏi cookie trình duyệt sang cơ sở dữ liệu dùng chung, kết nối nguồn thật và nghiệm thu quy trình tại hiện trường.

Thiết kế nghiệp vụ tổng hợp từ bốn nguồn khách hàng nằm tại [TAI_LIEU_KHACH_HANG_CUNG_CAP_VI.md](./TAI_LIEU_KHACH_HANG_CUNG_CAP_VI.md).

## Giai đoạn 1 — Pilot nền vận hành (6–8 tuần sau khi nhận đủ đầu vào)

### Sprint 1: dữ liệu gốc và phân quyền

- Cơ sở, vùng, cổng, bến, tuyến và sức chứa.
- Người dùng, vai trò, ca, phân công và RLS/RBAC.
- Danh mục SOP, ngưỡng, SLA, người phê duyệt và nhật ký kiểm toán.
- Đăng nhập doanh nghiệp và quản trị thiết bị/PWA.

### Sprint 2: hiện trường và bàn giao

- Nhiệm vụ, sự cố, bằng chứng, escalation và bàn giao ca.
- Chấm công, nhân sự trong ca, điều phối phương tiện.
- Go/No-Go, checklist nghiệm thu và lịch diễn tập.
- Push notification theo ngưỡng và trách nhiệm.

### Sprint 3: dữ liệu khách và lãnh đạo

- Kết nối vé, QR/check-in và dự báo sức chứa.
- Dashboard ngày/tuần/tháng; tài chính và đối soát nguồn.
- Báo cáo quản trị, truy vết từ KPI xuống giao dịch.
- UAT theo vai trò và pilot tại một cơ sở trước khi nhân rộng.

## Giai đoạn 2 — Tích hợp tài chính và hệ sinh thái

Ưu tiên connector theo giá trị và độ sẵn sàng dữ liệu:

1. Vé, cổng soát và thanh toán.
2. POS, doanh thu, hoàn/đổi và đối soát.
3. Xe điện, thuyền, tài xế/lái đò và điều phối chuyến.
4. HR/ca, tài sản, bảo trì và mua sắm.
5. Nhà cung ứng, đại lý, khách sạn, hướng dẫn viên và hoa hồng.
6. GIS, thời tiết và cảm biến đếm ẩn danh tại điểm nghẽn.

Mỗi connector cần hợp đồng dữ liệu, môi trường thử nghiệm, xử lý lỗi, đối soát và UAT riêng; thông thường 2–4 tuần tùy chất lượng API và dữ liệu.

## Giai đoạn 3 — Dự báo và tối ưu

- Dự báo nhu cầu, sức chứa, nhân sự và doanh thu có backtest.
- Đo sai số theo chu kỳ; hiển thị độ tin cậy và các biến đầu vào.
- Gợi ý phân ca, mở/tạm dừng luồng và bảo dưỡng phòng ngừa.
- AI tóm tắt báo cáo, chuyển giọng nói thành phiếu việc và nêu nguyên nhân; người có thẩm quyền vẫn duyệt quyết định.

## Đầu vào cần khách hàng xác nhận

- Sơ đồ tổ chức, phạm vi bốn cơ sở và danh sách người duyệt.
- Bản đồ vùng/cổng/bến/tuyến; sức chứa và ngưỡng xanh–vàng–cam–đỏ.
- SOP thật, RACI, checklist mở cửa, biểu mẫu bàn giao và SLA.
- Mẫu vé/QR, log check-in, danh mục giá và quy tắc hoàn/đổi.
- Dữ liệu doanh thu, chi phí, kênh bán, hoa hồng và kỳ đối soát.
- Ca trực, phương tiện, tài sản, lịch bảo trì và nhà cung ứng.
- Hệ thống hiện có, tài liệu API, file xuất mẫu và người sở hữu dữ liệu.
- Bộ KPI mà ban lãnh đạo dùng để ra quyết định tháng/quý/năm.

## Nguyên tắc không thay đổi

- Website khách ở `/`; hệ thống nội bộ ở `/erp`.
- Nhân viên chỉ thấy cơ sở và nghiệp vụ được giao.
- Một số liệu phải truy được về nguồn, thời điểm và trạng thái đối soát.
- Một cảnh báo phải có ngưỡng, hành động, người nhận và thời hạn.
- Một quyết định quan trọng chỉ có một người chịu trách nhiệm cuối cùng.
- Không tuyên bố thời gian thực, AI hay dự báo chính xác khi chưa có dữ liệu và phép đo.
