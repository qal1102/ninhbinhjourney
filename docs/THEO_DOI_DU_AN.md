# THEO DÕI DỰ ÁN — NINH BÌNH JOURNEY

> **File này viết cho người.** Hai người dùng nó: chủ dự án và Claude (vai kiểm tra + giao việc).
> File kỹ thuật cho AI thực thi là `docs/PROMPT_THEO_PHASE.md`. File hiện trạng chi tiết là `docs/HANDOFF.md`.
>
> **Cập nhật lần cuối: 21/08/2026.**

---

## 1. Dự án đang ở đâu — đọc một phút

Hệ thống có **ba mảng**, và hiện tại chúng không cùng một mức chín.

| Mảng | Là cái gì | Đang ở mức nào |
|---|---|---|
| **ERP nội bộ** | Phần mềm quản lý cho nhân viên: vé, ca trực, kế toán, sự cố, nhân sự | 🟢 **Chạy thật.** 12 module có nghiệp vụ thật, 3 module ghi rõ "giai đoạn sau". Chủ đầu tư đã dùng thử |
| **Web cho khách** | Trang giới thiệu, bản đồ, dựng lịch trình, đặt vé | 🟡 **Đang chạy, vừa mở bán.** Thương mại Trung thu vừa bật lên production trưa 21/08 |
| **Lớp dữ liệu khách** | Đo hành vi khách, hồ sơ khách, phễu marketing, gợi ý bán thêm | 🔴 **Vừa bật nhưng có lỗi đã xác nhận.** Đang thu dữ liệu thật rồi |

**Câu tóm gọn nhất:** phần nền ERP vững, phần lớp khách vừa được bật lên production rất nhanh và **đang chạy trước khi được kiểm chứng xong**. Đó là chỗ rủi ro lúc này.

### Chuyện quan trọng vừa xảy ra ngày 21/08

Trong lúc rà soát, phát hiện **sáu mật khẩu ERP nằm nguyên văn trong kho mã công khai**, và production không đặt mật khẩu riêng — nghĩa là ai đọc được kho mã cũng đăng nhập được với vai trò giám đốc.

✅ **Đã xử lý:** xoay toàn bộ sáu mật khẩu, mật khẩu cũ đã chết. Mật khẩu giám đốc mới là `Ninhbinh@2026` — **cần một lần redeploy nữa mới có hiệu lực** (việc P0).

---

## 2. Đang chặn — cần người quyết, AI không tự làm được

| Việc đang chặn | Ai quyết | Nó chặn cái gì |
|---|---|---|
| Thẩm quyền bán vé trực tuyến | Chủ đầu tư | Không bán vé thu tiền thật được. Hiện chỉ thanh toán mô phỏng |
| Pháp nhân đứng tên xử lý dữ liệu khách | Chủ đầu tư | **Gấp** — production đang thu dữ liệu khách rồi, mà trang riêng tư đã nêu đích danh Xuân Trường trong khi câu hỏi này chưa có câu trả lời |
| Ngày vận hành thử mục tiêu | Chủ đầu tư | Không lập được lịch ngược, không biết việc nào kịp việc nào không |
| Tên thương hiệu chính thức | Chủ đầu tư | Còn hoãn được, nhưng tên đang nằm cứng trong mã nguồn 9 chỗ |

Ba câu đầu đã gửi chủ đầu tư từ 17/08 (`docs/reference/CAC_DIEM_CAN_QUYET_DINH_TAM_COC.md`), **chưa có hồi âm**.

---

## 3. Việc sắp tới — thứ tự đề nghị

Làm từ trên xuống. Đừng nhảy cóc.

| # | Việc | Vì sao làm bây giờ | Giao cho | Biết là xong khi nào |
|---|---|---|---|---|
| **P0** ✅ | Redeploy để mật khẩu giám đốc mới có hiệu lực | Lỗ hổng chưa đóng hẳn | Model rẻ | Đăng nhập được bằng `Ninhbinh@2026` |
| **P1** ✅ | Vá 2 lỗi trên bảng điều hành phễu | Số hiển thị đang sai, chủ đầu tư nhìn vào sẽ mất tin | Model mạnh | Hold hết hạn không còn bị đếm là đang giữ chỗ |
| **P4-A** | Kiểm 5 cáo buộc bảo mật lớp khách | Production **đang thu dữ liệu thật**. Nếu đúng thì đang rò rỉ | Model mạnh nhất | Mỗi cáo buộc có kết luận đúng/sai kèm bằng chứng |
| **P4-B** | Kiểm 7 cáo buộc nghiệp vụ | Có cái nghi là lỗi kiến trúc, sửa càng muộn càng đắt | Model mạnh nhất | Như trên |
| **P2** | Sửa tài liệu cho khớp sự thật | Tài liệu đang nói production còn trống, sẽ lừa phiên làm việc sau | Model trung bình | Không còn câu nào nói "chưa apply" |
| **P3** | Dọn cấu trúc tài liệu | Mỗi phiên đang đốt 60–70K token chỉ để đọc trạng thái | Model trung bình | Đọc 2 file là biết làm gì |
| **P5** | Chấm 7 dòng nghiệm thu của đề bài | Đây là món nợ với chủ đầu tư, chưa ai làm | Model mạnh | Có bảng 7 dòng, mỗi dòng đạt/chưa kèm lý do |

Chi tiết từng việc và prompt để dán: `docs/PROMPT_THEO_PHASE.md`.

---

## 4. Lỗi đã xác nhận — chắc chắn có thật

Ba cái này đã tự kiểm bằng lệnh, không phải nghi ngờ.

| Lỗi | Hậu quả thật | Trạng thái |
|---|---|---|
| Mật khẩu ERP lộ trong kho mã công khai | Ai cũng vào được `/erp` quyền giám đốc | ✅ Đã xoay, chờ P0 redeploy |
| Cổng thu dữ liệu khách mở cho cả internet | Cửa "chỉ nhận từ web nhà mình" giả header là lọt. Bất kỳ ai cũng bơm dữ liệu rác vào được | ⏳ Chờ vá |
| Bảng phễu đếm sai | Chỗ đã hết hạn giữ vẫn hiện "đang giữ chỗ" — lệch với luật sức chứa của bộ đặt chỗ | ✅ Đã vá P1, có test khoá lại |
| Bảng phễu cắt âm thầm ở 5000 dòng | Chạm trần thì hiển thị như thể đã đếm đủ | ✅ Đã vá P1, màn hình nay nói rõ "số liệu bị cắt" |

**Còn 63 cáo buộc khác chưa ai kiểm.** Đợt rà soát tìm ra 66 vấn đề nhưng phần kiểm chứng bị dừng giữa chừng vì hết hạn mức chi tiêu. Kinh nghiệm cho thấy loại này rụng khoảng một phần ba khi soi kỹ — nên **chưa được coi là lỗi thật cho tới khi P4 xong**.

---

## 5. Đã xong — nhật ký theo mốc

| Ngày | Việc | Bằng chứng |
|---|---|---|
| 21/08 | **P0 hoàn tất: redeploy mật khẩu giám đốc mới** | Đăng nhập `giamdoc` / `Ninhbinh@2026` ✅, endpoint health OK |
| 21/08 | Xoay 6 mật khẩu ERP bị lộ | Deployment `1lmt6eez3` Ready, mật khẩu cũ đã chết |
| 21/08 | Rà soát toàn dự án, 6 góc soi | 66 phát hiện, 3 đã tự xác minh |
| 21/08 | Bật thương mại Trung thu lên production | Commit `5273196` → `c01c671` |
| 21/08 | Áp toàn bộ migration lớp khách lên production | `supabase migration list --linked`: 039→048 khớp |
| 20/08 | Xong code CUS-06, 07, 08 | Đặt chỗ, gợi ý bán thêm, soát vé offline |
| 18/08 | Xong code CUS-01 → 05 | Nền dữ liệu khách, đo hành vi, QR động, hồ sơ khách |
| 18/08 | Chủ dự án duyệt hướng data-first | Ghi ở `GOI_A_KE_HOACH.md` mục 0 |
| 17/08 | Nhận đề bài Gói A từ chủ dự án | `PHIEU_GIAO_VIEC_01_GOI_A.md` |
| 07/08 | ERP T11a + T11b lên production | Sức chứa theo giờ, cổng SOP Go/No-Go |
| 02/08 | Toàn bộ đợt T1–T14 lên production, kiểm chứng thật | HANDOFF mục 0 |

Nhật ký đầy đủ từng ngày: `docs/NHAT_KY.md` (sẽ có sau khi làm P3).

---

## 6. Sức khỏe dự án — nhìn nhanh

| Chỉ số | Số thật | Ý nghĩa |
|---|---|---|
| Bộ kiểm tra cục bộ | **607 test pass**, 1 skip có chủ đích | 🟢 Xanh hết |
| Kiểm kiểu dữ liệu + chuẩn mã | Sạch | 🟢 |
| Migration đã lên production | 48 | 🟢 Local khớp remote |
| Module ERP có nghiệp vụ thật | 12 / 15 | 🟡 3 module ghi rõ "giai đoạn sau" |
| Lỗi đã xác nhận chưa vá | 2 | 🔴 |
| Cáo buộc chưa kiểm | 63 | 🔴 |
| Dòng nghiệm thu đã chấm | 0 / 7 | 🔴 Chưa ai làm |
| Câu hỏi chờ chủ đầu tư | 8, trong đó 3 chặn tiến độ | 🔴 Gửi từ 17/08, chưa hồi âm |

**Cảnh báo đáng chú ý nhất:** bộ test xanh 607/607 nhưng vẫn lọt cả ba lỗi đã xác nhận. Đó đúng là bẫy số 1 mà dự án đã tự ghi lại: *"test xanh vẫn giấu được lỗi"*. Test xanh không đồng nghĩa đúng.

---

## 7. Cách dùng file này

**Chủ dự án:** đọc mục 1 (đang ở đâu), mục 2 (cần quyết gì), mục 3 (sắp làm gì). Ba mục đó đủ để theo dõi.

**Sau mỗi lần giao việc xong:**
1. Thêm một dòng vào mục 5 — ngày, việc, bằng chứng
2. Đổi trạng thái dòng tương ứng ở mục 3
3. Nếu phát hiện lỗi mới thì thêm vào mục 4
4. Cập nhật ngày ở đầu file

**Ranh giới ba file trạng thái — không tạo file thứ tư:**

| File | Trả lời câu gì | Ai đọc |
|---|---|---|
| `THEO_DOI_DU_AN.md` (file này) | Dự án đang ở đâu, sắp làm gì | Người |
| `HANDOFF.md` | Hiện trạng kỹ thuật hôm nay | AI |
| `PROMPT_THEO_PHASE.md` | Phase sau làm gì, model nào, prompt ra sao | AI |
| `NHAT_KY.md` | Hôm đó đã làm gì | Cả hai, khi cần truy vết |
