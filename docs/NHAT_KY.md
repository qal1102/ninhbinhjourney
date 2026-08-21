# NHẬT KÝ — NINH BÌNH JOURNEY

Ghi chép từng ngày, từng công việc để truy vết.

---

## 21/08/2026

| Thời gian | Việc | Bằng chứi |
|---|---|---|
| Sáng | Phát hiện 6 mật khẩu ERP lộ trong kho mã | Đọc `lib/erp/demo-data.ts` dòng 33–44 |
| Sáng | Xoay toàn bộ 6 mật khẩu, mật khẩu mới giám đốc: Ninhbinh@2026 | Commit `xxx` (deploy lên staging) |
| Trưa | Bật thương mại Trung thu lên production | Deployment `c01c671` Ready |
| Trưa | Áp toàn bộ migration lớp khách (039–048) lên production | `supabase migration list --linked` khớp |
| Trưa | Rà soát toàn dự án 6 góc soi | 66 phát hiện, 3 đã tự xác minh, 63 chờ P4 |
| Chiều | **P0: Redeploy để mật khẩu Ninhbinh@2026 có hiệu lực** | ✅ Đăng nhập `giamdoc` / `Ninhbinh@2026` thành công, xác minh endpoint health OK |
| Chiều | **P1: Vá bảng phễu — hold quá hạn không còn bị đếm là đang giữ chỗ (khớp luật RPC sức chứa), thêm cảnh báo "số liệu bị cắt" khi chạm trần 5000 dòng.** Bác bỏ phần "thêm lọc thời gian cho holds/orders": lọc vậy sẽ thổi bay ca đặt trước | 616 test pass, typecheck + lint sạch; 4 test mới khoá lại hành vi |

---

## 18/08/2026

Hoàn tất mã CUS-01 → CUS-08 (lớp dữ liệu khách).

---

## 17/08/2026

Nhận đề bài Gói A từ chủ dự án (`PHIEU_GIAO_VIEC_01_GOI_A.md`).

---

## 07/08/2026

ERP T11a + T11b lên production (sức chứa theo giờ, cổng SOP Go/No-Go).

---

## 02/08/2026

Toàn bộ T1–T14 lên production, kiểm chứng thật.
