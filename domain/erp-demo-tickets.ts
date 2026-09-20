/**
 * A15-ERP-07 — vé mẫu chỉ được xuất hiện khi hệ thống đang chạy để trình diễn.
 *
 * Màn hình check-in là nơi nhân viên đứng ở cổng dùng thật. Tám tấm vé mẫu
 * nằm chung ở đó có hai cái hại, cả hai đều đã thấy trong lúc dùng: ngày đông
 * khách rất dễ bấm nhầm vé mẫu thay vì vé khách đưa, và khi hệ thống đi vào
 * vận hành thật thì một cái nút "kéo vé mẫu về" nằm giữa màn hình làm người
 * ta tưởng số liệu cũng là mẫu nốt.
 *
 * Hàm thuần, nhận thẳng biến môi trường để bài kiểm ép được mọi trường hợp.
 *
 * **Mặc định là HIỆN** — cố ý. Hôm nay production đang là bản trình diễn cho
 * khách xem, và chính giám đốc dùng nút ấy để chạy thử trọn vòng quét mã. Tắt
 * lặng lẽ là lấy mất một công cụ đang dùng được mà không ai báo. Muốn ẩn hẳn
 * thì đặt `ERP_DEMO_TICKETS_ENABLED=false` (một biến trên Vercel, không phải
 * một lần sửa mã).
 */
export function resolveDemoTicketsEnabled(raw: string | undefined): boolean {
  const value = raw?.trim().toLowerCase();
  if (value === "false" || value === "0" || value === "off") return false;
  return true;
}

/** Câu nói khi ai đó gọi thẳng lệnh kéo vé mẫu trong lúc cờ đang tắt. */
export const DEMO_TICKETS_DISABLED_MESSAGE =
  "Hệ thống đang chạy ở chế độ vận hành thật nên không dùng vé mẫu ạ.";
