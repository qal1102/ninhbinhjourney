import type { NgonNgu } from "@/lib/ngon-ngu";

/**
 * Câu gợi ý của khung hỏi đáp. Tách riêng khỏi `domain/hoi-dap.ts` để trình
 * duyệt chỉ tải mấy nhãn này, không tải cả sổ nội dung gói và điểm đến.
 * `id` trùng mục trong sổ: bấm là máy chủ trả lời thẳng, không tốn lượt AI.
 */
export const CAU_GOI_Y: readonly { id: string; hoi: Record<NgonNgu, string> }[] = [
  { id: "dat-ve", hoi: { vi: "Đặt vé thế nào?", en: "How do I book?" } },
  { id: "tre-em", hoi: { vi: "Trẻ em có mất vé không?", en: "Do children need a ticket?" } },
  { id: "thanh-toan", hoi: { vi: "Thanh toán bằng gì?", en: "How do I pay?" } },
  { id: "lap-hanh-trinh", hoi: { vi: "Đi mấy ngày thì hợp?", en: "Can you plan my trip?" } },
  { id: "lien-he", hoi: { vi: "Gọi cho ai khi cần?", en: "How do I contact you?" } },
];
