# CÁC ĐIỂM CẦN QUYẾT ĐỊNH ĐỂ KHỞI ĐỘNG THÍ ĐIỂM TAM CỐC

> **Nguồn:** bản PDF do chủ dự án soạn, gửi cho phía chủ đầu tư. Chép lại nguyên văn vào repo ngày 17/08/2026.
> Đây là **8 câu hỏi phía mình hỏi ngược lại chủ đầu tư**, chưa có câu trả lời. Mỗi điểm đều kèm phương án đề xuất; nếu không có ý kiến khác, phía công nghệ triển khai theo phương án đề xuất.
> Ba điểm **2, 6, 8** chặn tiến độ trực tiếp — xem `docs/plans/GOI_A_KE_HOACH.md` để biết chỗ nào trong kế hoạch bị chúng chặn.

Phản hồi Báo cáo chiến lược tổng thể hệ sinh thái số du lịch Ninh Bình (tháng 8/2026)

Phía công nghệ đã tiếp nhận và thống nhất với khung của Báo cáo chiến lược tổng thể (15 phần), đặc biệt các quyết định lãnh đạo tại mục 14, điều kiện qua cổng mở rộng tại mục 11.2 và danh sách 10 việc khởi động trong 14 ngày tại mục 15.1.

---

### 1. Phạm vi thí điểm tại Tam Cốc gồm những gì: chỉ vé tuyến thuyền, hay kèm một dịch vụ phụ để chứng minh khả năng bán thêm?

**Đề xuất:** Vé tuyến thuyền theo khung giờ là lõi, kèm một hạng mục phụ đơn giản nhất là phiếu đồ uống hoặc đặc sản dùng trong thời gian chờ, để ngay trong thí điểm đã đo được doanh thu bán thêm.

### 2. Việc bán vé trực tuyến chính thức đã đủ điều kiện về thẩm quyền và quy định giá vé chưa? Nếu chưa, cần làm việc với cấp nào và ai chủ trì?

**Đề xuất:** Xác nhận dứt điểm trong giai đoạn thiết kế (ngày 1–30). Trong lúc chờ, hệ thống chạy ở chế độ thử nghiệm nội bộ với dữ liệu giả lập, chưa thu tiền thật. **Đây là điểm ảnh hưởng tiến độ lớn nhất.**

### 3. Trong sáu điều kiện qua cổng mở rộng tại mục 11.2, điều kiện nào là điều kiện cứng nếu kết quả chỉ đạt một phần?

**Đề xuất:** Lấy "trên 90% giao dịch đi qua hệ thống" và "không sự cố dữ liệu nghiêm trọng" làm hai điều kiện cứng; các chỉ số còn lại là chỉ số theo dõi, đạt thấp hơn mục tiêu vẫn có thể mở rộng kèm kế hoạch cải thiện.

### 4. Khung ngân sách của MVP 120 ngày là bao nhiêu; ai là Product Owner duy nhất và ai vận hành hệ thống hằng ngày sau khi bàn giao?

**Đề xuất:** Chốt khung ngân sách theo ba mức để phía công nghệ chọn phương án kỹ thuật tương ứng; bổ nhiệm Product Owner theo đúng mục 12 của báo cáo; cử ít nhất một đầu mối vận hành tham gia từ giai đoạn thiết kế thay vì nhận bàn giao sau.

### 5. Tên thương hiệu của nền tảng là gì?

Báo cáo đã có tên chiến dịch "Một mã – Trọn hành trình Ninh Bình" nhưng chưa chốt tên sản phẩm.

**Đề xuất:** Chốt một tên duy nhất (các phương án đã nêu: Ninh Binh Pass, Visit Ninh Binh, Ninh Binh Journey, Ninh Binh One) để đăng ký tên miền, tài khoản Zalo chính thức và bộ nhận diện mã QR ngay từ đầu, tránh in lại biển bảng.

### 6. Pháp nhân nào đứng tên chủ thể xử lý dữ liệu khách; dữ liệu đặt máy chủ trong nước hay lập hồ sơ chuyển dữ liệu ra nước ngoài theo quy định hiện hành?

**Đề xuất:** Khi vận hành thật, đặt dữ liệu khách tại nhà cung cấp trong nước và giao một đầu mối chịu trách nhiệm bảo vệ dữ liệu; giai đoạn thử nghiệm chỉ dùng dữ liệu giả lập nên chưa phát sinh nghĩa vụ. **Cần chốt pháp nhân đứng tên trước khi thu dữ liệu thật.**

### 7. Nguyên tắc "không bán vé ngoài hệ thống" tại mục 14 sẽ áp dụng với quầy và đại lý hiện hữu ngay từ ngày vận hành, hay có giai đoạn chuyển tiếp?

**Đề xuất:** Quầy áp dụng ngay từ ngày vận hành vì quầy in vé QR trực tiếp từ hệ thống; đại lý có 30 ngày chuyển tiếp để ký lại điều khoản và nhận tài khoản cổng đại lý, sau đó hoa hồng chỉ đối soát trên giao dịch trong hệ thống.

### 8. Ngày vận hành thử mục tiêu là ngày nào; mùa cao điểm gần nhất muốn kịp là dịp nào?

**Đề xuất:** Chốt một ngày cụ thể để lập lịch ngược cho 120 ngày; nếu mục tiêu là mùa cao điểm gần nhất thì các quyết định tại điểm 2 và điểm 4 cần có trong vòng hai tuần.

---

## Ghi chú tiến độ

Phần việc **không phụ thuộc** các quyết định trên (nền vé và khung giờ, soát vé hoạt động khi mất mạng, mã QR động đo nguồn, bảng điều hành) đã được khởi động song song trên nền hệ thống sẵn có.

Các điểm **2, 6 và 8** ảnh hưởng trực tiếp tới tiến độ chung, đề nghị ưu tiên trả lời trước.
