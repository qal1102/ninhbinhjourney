import { describe, expect, it } from "vitest";
import { laCauHoiDanhTinhAi, loTenMoHinh, traLoiDanhTinhAi } from "@/domain/danh-tinh-ai";

describe("danh tính trợ lý AI", () => {
  it.each([
    "Bạn là AI gì?",
    "bạn là ai",
    "Đây là AI ở đâu vậy",
    "đây là AI gì",
    "mày dùng mô hình nào",
    "Bạn là ChatGPT à?",
    "có phải bạn dùng Gemini không",
    "trợ lý này chạy bằng Claude hả",
    "Ai tạo ra bạn?",
    "bạn được hãng nào phát triển",
    "AI gì vậy?",
    "What AI are you?",
    "who made you",
    "Are you ChatGPT?",
    "are you based on GPT-4?",
    "which model do you use",
  ])("nhận ra câu hỏi danh tính: %s", (cau) => {
    expect(laCauHoiDanhTinhAi(cau)).toBe(true);
  });

  it.each([
    "Tràng An là gì?",
    "Có ai ở đâu bán vé Tam Cốc không",
    "Gói nào hợp cho người già?",
    "Trẻ em dưới 1m có cần vé không",
    "Đi cùng ai thì được giảm giá",
    "What is Bai Dinh pagoda?",
    "doanh thu hôm nay bao nhiêu",
    "giao việc cho Lan kiểm tra áo phao",
  ])("không nhầm câu thường: %s", (cau) => {
    expect(laCauHoiDanhTinhAi(cau)).toBe(false);
  });

  it("bắt câu trả lời tự xưng tên mô hình hay hãng", () => {
    expect(loTenMoHinh("Mình là Gemini, một mô hình của Google.")).toBe(true);
    expect(loTenMoHinh("Tôi là Claude, do Anthropic phát triển.")).toBe(true);
    expect(loTenMoHinh("I'm ChatGPT, made by OpenAI.")).toBe(true);
    expect(loTenMoHinh("Mình được phát triển bởi Google.")).toBe(true);
    expect(loTenMoHinh("Tràng An mở cửa từ 7 giờ sáng, đi thuyền khoảng 2 tiếng.")).toBe(false);
    expect(loTenMoHinh("Bạn có thể xem đường đi trên Google Maps.")).toBe(false);
  });

  it("câu trả lời cố định không nêu tên mô hình", () => {
    for (const lang of ["vi", "en"] as const) {
      for (const phamVi of ["web", "erp"] as const) {
        const cau = traLoiDanhTinhAi(lang, phamVi);
        expect(cau).toMatch(/Ninh B[iì]nh Journey/);
        expect(cau).not.toMatch(/claude|gemini|gpt|openai|anthropic|google/i);
        expect(loTenMoHinh(cau)).toBe(false);
      }
    }
  });
});
