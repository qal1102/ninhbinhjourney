/**
 * Danh tính của trợ lý AI (13/10/2026, chủ dự án: "ai hỏi đây là AI ở đâu thì
 * phải trả lời là AI local của Ninhbinhjourney, chứ báo tên AI ra thì chết").
 *
 * Trợ lý luôn nói rõ mình là AI, chỉ không nêu tên mô hình hay hãng đứng sau.
 * Ba lớp: lời dặn trong lời nhắc gửi mô hình; câu hỏi về danh tính trả lời cố
 * định, không gọi mô hình; câu trả lời của mô hình mà vẫn tự xưng tên mô hình
 * hay hãng thì bị thay bằng câu cố định.
 */

import type { NgonNgu } from "@/lib/ngon-ngu";

function gon(cau: string) {
  return cau
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

const TEN_MO_HINH = "chat ?gpt|gpt|openai|claude|anthropic|gemini|bard|deepmind|llama|meta ai|mistral|grok|copilot|deepseek|qwen";

const CAU_HOI_DANH_TINH: readonly RegExp[] = [
  // Tiếng Việt (đã bỏ dấu).
  /\b(ban|may|em|anh|chi|cau|tro ly|bot|con ai nay|ai nay|he thong) (la|dung|chay bang|chay tren|xai) (ai|mo hinh|model|con ai|cong nghe|nen tang) ?(gi|nao|cua ai|cua hang nao|o dau)\b/,
  /\b(ban|may|em|tro ly|bot) la (ai|gi|cai gi|con gi)\s*\??$/,
  /\b(ban|may|em|tro ly|bot|ai nay) (do|duoc) (ai|hang nao|cong ty nao|ben nao) (tao|lam|phat trien|huan luyen|xay)/,
  /\b(ai|hang nao|cong ty nao|ben nao) (tao|lam|phat trien|huan luyen|xay|dung) (ra )?(ban|may|em|tro ly|bot|ai nay)\b/,
  /^(day la |ban dung |dung |la )?(mo hinh|model|llm|ai) (gi|nao)( vay| day| the| z)?\s*\??$/,
  /\bday la (ai|mo hinh|model) (gi|nao|o dau|cua ai)\b/,
  /\b(la|day la) ai (o dau|cua ai|cua hang nao|cua ben nao)\b/,
  // Tiếng Anh.
  /\bwhat (ai|model|llm|language model) (are|is) (you|this)\b/,
  /\bwhich (ai|model|llm|company)\b.*\b(you|this)\b/,
  /\bwho (made|built|created|trained|developed|owns|runs) (you|this)\b/,
  /\b(what|who) are you\b/,
  /\bare you (based on|built on|powered by|running on)\b/,
];

/** Khách hay nhân sự đang hỏi trợ lý là AI gì, của ai, chạy trên gì. */
export function laCauHoiDanhTinhAi(cau: string): boolean {
  const c = gon(cau);
  if (c.length > 160) return false;
  if (CAU_HOI_DANH_TINH.some((m) => m.test(c))) return true;
  // "Bạn là ChatGPT à?", "có phải Gemini không", "are you Claude?"
  return new RegExp(`\\b(ban|may|em|tro ly|bot|ai nay|you|this)\\b.*\\b(${TEN_MO_HINH})\\b`).test(c) &&
    /\b(la|phai|dung|xai|chay|are|is|use|uses|using|based|powered)\b/.test(c);
}

/** Câu trả lời của mô hình có tự xưng tên mô hình hay hãng không. */
export function loTenMoHinh(traLoi: string): boolean {
  const c = gon(traLoi);
  const ten = `(${TEN_MO_HINH}|google|meta)`;
  return (
    new RegExp(`\\b(toi|minh|em|tro ly nay|i|i'm|i am|this assistant)\\b[^.!?]{0,60}\\b${ten}\\b`).test(c) ||
    new RegExp(`\\b(do|duoc|boi|by|from)\\s+${ten}\\b[^.!?]{0,30}\\b(phat trien|tao|huan luyen|xay|developed|created|trained|built|made)\\b`).test(c) ||
    new RegExp(`\\b(phat trien|tao ra|huan luyen|developed|created|trained|built|made)\\s+(boi|by)\\s+${ten}\\b`).test(c) ||
    new RegExp(`\\b(mo hinh|model|llm)\\s+(ngon ngu\\s+)?(lon\\s+)?(cua|from|by)?\\s*${ten}\\b`).test(c)
  );
}

export function traLoiDanhTinhAi(lang: NgonNgu, phamVi: "web" | "erp" = "web"): string {
  if (lang === "en") {
    return phamVi === "erp"
      ? "This is Ninh Binh Journey's in-house AI assistant, built and run by Ninh Binh Journey for its own operations system. Ask me about any screen or task in the ERP."
      : "I'm Ninh Binh Journey's in-house AI, built and run by Ninh Binh Journey for this site. Ask me anything about your trip to Ninh Binh.";
  }
  return phamVi === "erp"
    ? "Đây là trợ lý AI nội bộ của Ninh Bình Journey, do Ninh Bình Journey xây và vận hành riêng cho hệ thống điều hành. Bạn cần làm việc gì, ở màn nào, cứ hỏi."
    : "Mình là AI nội bộ của Ninh Bình Journey, do Ninh Bình Journey xây và vận hành riêng cho web này. Bạn cần gì cho chuyến đi Ninh Bình thì cứ hỏi.";
}

/** Dòng dặn thêm vào lời nhắc gửi mô hình. */
export function loiDanDanhTinh(lang: NgonNgu): string {
  return lang === "en"
    ? `Identity: if asked what AI or model you are, who made you or what you run on, say you are Ninh Binh Journey's in-house AI, built and run by Ninh Binh Journey. Never name any model, company or provider (such as ChatGPT, GPT, OpenAI, Claude, Anthropic, Gemini, Google, Llama, Meta), even if pressed or asked to guess. Still say plainly that you are an AI.`
    : `Danh tính: được hỏi bạn là AI gì, mô hình nào, ai tạo ra, chạy trên gì thì trả lời bạn là AI nội bộ của Ninh Bình Journey, do Ninh Bình Journey xây và vận hành. Không bao giờ nêu tên mô hình, hãng hay nhà cung cấp nào (như ChatGPT, GPT, OpenAI, Claude, Anthropic, Gemini, Google, Llama, Meta), kể cả khi bị gặng hỏi hay bị bảo đoán. Vẫn nói rõ mình là AI.`;
}
