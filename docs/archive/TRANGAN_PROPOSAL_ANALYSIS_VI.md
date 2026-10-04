# Phân tích “Đề án TrangAn.vn v3” cho hướng sản phẩm

## Kết luận sản phẩm

Đề án xác định rất rõ: TrangAn.vn không phải website du lịch, kênh truyền thông hay hệ thống bán vé đơn lẻ; nó là hạ tầng kinh tế số và nền tảng điều phối chuỗi giá trị du lịch (PDF tr.2). Vì vậy, trang công cộng chỉ là lớp tạo và dẫn nhu cầu. Bề mặt quan trọng đối với khách hàng tổ chức là kho dữ liệu, điều hành/cảnh báo và phân tích hỗ trợ quyết định.

## Sáu lớp cần phản ánh trong kiến trúc

Theo PDF tr.7:

1. Nhận diện và thương hiệu.
2. Tri thức điểm đến.
3. Dữ liệu và tiêu chuẩn.
4. Kết nối dịch vụ.
5. Điều hành và cảnh báo.
6. Phân tích phục vụ quyết định.

Repo hiện đã có bản demo của cả sáu lớp, nhưng mức trưởng thành khác nhau: lớp 1–4 dùng được cho demo visitor; lớp 5 có preview và các luồng `/ops`; lớp 6 mới là executive scenario, chưa có dữ liệu thật để phân tích.

## Những yêu cầu trực tiếp cho màn quản lý Tam Chúc–Bái Đính

Từ mục tiêu “điều hành dựa trên dữ liệu” (tr.6), trụ cột điều hành thông minh (tr.12), Trung tâm dữ liệu và điều hành (tr.13) và KPI (tr.21), màn lãnh đạo nên trả lời:

- Hai cơ sở đang ở mức sức chứa nào theo khung giờ?
- Khách dự kiến, đã đến và đang chờ là bao nhiêu?
- Sự cố nào đang mở, mức độ gì, ai phụ trách, đã quá SLA chưa?
- Có bao nhiêu hành trình/đoàn khách chuyển giữa hai cơ sở và bàn giao đã xác nhận chưa?
- Quyết định nào đã được đưa ra và ai thay đổi dữ liệu?
- Dòng khách có đang tập trung quá mức không?
- Dịch vụ/giá trị địa phương nào được kích hoạt từ hành trình?

`/demo/ops` hiện minh hoạ bốn câu đầu và audit/readiness. Hai câu cuối cần dữ liệu chuỗi giá trị và kết nối thương mại thật.

## Governance và dữ liệu

PDF tr.16 yêu cầu Ban chỉ đạo, đơn vị vận hành, Hội đồng dữ liệu/tri thức và mạng lưới đầu mối cập nhật tại nơi phát sinh. PDF tr.17 chia dữ liệu thành sáu nhóm, trong đó dữ liệu cá nhân và dữ liệu nhạy cảm về an toàn/vận hành không được đối xử như dữ liệu công khai. Thiết kế do đó phải giữ RBAC/RLS, audit, nguồn chịu trách nhiệm và human approval.

## Lộ trình của đề án và lộ trình sản phẩm

PDF tr.19 đặt điều hành thông minh ở giai đoạn 2028–2030 sau nền dữ liệu và kết nối hệ sinh thái. Với bản demo hiện tại, có thể trình diễn sớm nguyên lý điều hành, nhưng không được gọi là hệ thống gần thời gian thực cho tới khi:

- chuẩn dữ liệu và chủ sở hữu dữ liệu được thống nhất;
- ticket/check-in/capacity/incident được kết nối;
- ngưỡng cảnh báo và SOP được cơ quan có thẩm quyền duyệt;
- KPI có đường cơ sở;
- bảo mật, khôi phục và quyền riêng tư được kiểm thử trên hạ tầng thật.

## Nguyên tắc không đánh đổi cần đưa vào acceptance

Từ PDF tr.22:

- không công bố dữ liệu không có nguồn chịu trách nhiệm;
- không tách quảng bá khỏi năng lực quản lý sức chứa;
- không dùng AI thay trách nhiệm xác minh của con người;
- không đổi quyền riêng tư hoặc niềm tin lấy dữ liệu/chuyển đổi;
- coi nền tảng là năng lực vận hành lâu dài, không phải dự án làm một lần.

Đây là lý do demo công khai và dashboard thật được tách thành `/demo/ops` và `/ops`.
