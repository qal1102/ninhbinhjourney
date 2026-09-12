import type { ShiftCloseStatus } from "@/domain/erp-shift-close";

/**
 * Tên tiếng Việt của từng trạng thái hồ sơ chốt ca, dùng chung cho mọi màn
 * hình có nhắc tới trạng thái ấy.
 *
 * Trước đây bảng này nằm riêng trong `shift-close-workflow.tsx`, mà tệp ấy là
 * client component nên màn hình "Tài chính & đối soát" (server component)
 * không lấy sang được. Kết quả: khối "Nguồn doanh thu" in thẳng giá trị lưu
 * trong kho — giám đốc mở màn hình tài chính của cơ sở thì đọc được chữ
 * `submitted` giữa một trang tiếng Việt.
 */
export const SHIFT_CLOSE_STATUS_LABELS: Record<ShiftCloseStatus, string> = {
  submitted: "Chờ quản lý",
  "manager-returned": "Quản lý trả lại",
  "manager-approved": "Chờ kế toán",
  "accounting-review": "Kế toán đang kiểm tra",
  posted: "Đã ghi sổ",
  "exception-pending-director": "Chuyển giám đốc",
  "director-approved": "Ngoại lệ đã duyệt",
  "director-rejected": "Giám đốc trả lại",
};

export const SHIFT_CLOSE_STATUS_TONES: Record<ShiftCloseStatus, string> = {
  submitted: "bg-[#fff0ce] text-[#77531c]",
  "manager-returned": "bg-[#ffe5df] text-[#934336]",
  "manager-approved": "bg-[#e1edf4] text-[#315f79]",
  "accounting-review": "bg-[#e7e6f4] text-[#5c5486]",
  posted: "bg-[#dff1e8] text-[#246249]",
  "exception-pending-director": "bg-[#a94e3f] text-white",
  "director-approved": "bg-[#dff1e8] text-[#246249]",
  "director-rejected": "bg-[#ffe5df] text-[#934336]",
};
