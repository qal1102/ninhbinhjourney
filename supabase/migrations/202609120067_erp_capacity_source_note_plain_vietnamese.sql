-- Bóc số hiệu phiếu việc khỏi ghi chú nguồn của ngưỡng sức chứa.
--
-- Bốn hàng ghi chú này do migration 037 gieo, và chúng hiện nguyên văn trên
-- màn hình "Sức chứa" mà giám đốc đọc mỗi ngày. Câu cũ mở đầu bằng "Giả định
-- khởi tạo T11" và kết thúc bằng "sau khi T8 tích lũy đủ dữ liệu" — T11 và T8
-- là số hiệu hai phiếu việc trong nội bộ, không phải tiếng Việt của ai cả.
--
-- Chữa ở đây chứ không chữa ở mã nguồn, vì câu này nằm trong kho dữ liệu:
-- màn hình chỉ in ra `source_note` đọc lên.
--
-- Chỉ sửa chữ, giữ nguyên mọi con số, ngưỡng và lịch sử. Điều kiện lọc bám
-- theo `threshold_code` cùng dấu vết câu cũ, nên chạy lại lần nữa không đổi
-- thêm hàng nào, và một ghi chú đã được người vận hành sửa tay sẽ không bị
-- đè lên.

update public.erp_capacity_thresholds
set source_note =
  'Số thuyền chạy cùng lúc và thời gian một vòng đang là con số ước tính, '
  || 'chưa có đơn vị vận hành xác nhận. Khi bến đếm được số thật thì thay vào đây.'
where threshold_code in ('TA-PIER-01', 'TCO-PIER-01')
  and source_note like 'Giả định khởi tạo T11%';

update public.erp_capacity_thresholds
set source_note =
  'Điểm nghẽn này lấy từ sổ tay vận hành Tam Chúc. Số tàu chạy cùng lúc và '
  || 'thời gian một vòng chưa được đơn vị vận hành xác nhận.'
where threshold_code = 'TC-PIER-01'
  and source_note like 'Giả định khởi tạo T11%';

update public.erp_capacity_thresholds
set source_note =
  'Số xe chạy cùng lúc, số ghế và thời gian một vòng đang là con số ước tính, '
  || 'chưa có đơn vị vận hành xác nhận. Khi bãi xe đếm được số thật thì thay vào đây.'
where threshold_code = 'BD-SHUTTLE-01'
  and source_note like 'Giả định khởi tạo T11%';
