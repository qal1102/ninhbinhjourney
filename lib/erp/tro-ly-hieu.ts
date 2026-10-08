import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { ErpSiteId } from "@/domain/erp";
import { phanTichCauNoi, type BanNhap, type LoaiGhi, type NguoiTrongDanhBa } from "@/domain/tro-ly-ghi";

/**
 * Hiểu một câu nói thành bản nháp việc / ghi chú / nhật ký.
 *
 * Ba tầng, tầng trên lỗi thì rơi xuống tầng dưới, màn hình không bao giờ kẹt:
 * 1. `ANTHROPIC_API_KEY` có thì hỏi Claude.
 * 2. Không có Claude mà có `AI_API_KEY` thì hỏi một mô hình theo chuẩn OpenAI
 *    (`/chat/completions`). Mặc định là Gemini ở gói miễn phí của Google AI
 *    Studio; đổi sang Groq, OpenRouter hay Ollama chạy trên máy chỉ cần đặt
 *    `AI_BASE_URL` và `AI_MODEL`, không sửa mã.
 * 3. Còn lại hiểu bằng luật (`domain/tro-ly-ghi.ts`): miễn phí, không gửi câu
 *    nói ra ngoài.
 * Mô hình lỗi, chậm quá 8 giây, từ chối hay trả sai khuôn đều quay về luật.
 *
 * Gửi cho mô hình: câu nói, giờ hiện tại, và danh bạ rút gọn (mã, tên, vai,
 * cơ sở) để mô hình chọn đúng người nhận. Gói miễn phí của Google được dùng
 * dữ liệu gửi lên để cải thiện sản phẩm, nên chỉ hợp với dữ liệu mẫu.
 */

export type BoHieu = "luat" | "claude" | "ai";

const AI_BASE_URL_MAC_DINH = "https://generativelanguage.googleapis.com/v1beta/openai";
const AI_MODEL_MAC_DINH = "gemini-3.5-flash-lite";
const CHO_TOI_DA_MS = 8_000;

export function boHieuDangDung(): BoHieu {
  if (process.env.ANTHROPIC_API_KEY?.trim()) return "claude";
  if (process.env.AI_API_KEY?.trim()) return "ai";
  return "luat";
}

const CO_SO = ["trang-an", "tam-coc", "bai-dinh", "tam-chuc"] as const;

const BanNhapMoHinh = z.object({
  loai: z.enum(["viec", "ghi-chu", "nhat-ky"]),
  noi_dung: z.string(),
  nguoi_nhan_id: z.string().nullable(),
  ten_nghe: z.string().nullable(),
  han: z.string().nullable(),
  ngay: z.string(),
  co_so: z.enum(CO_SO).nullable(),
  khan: z.boolean(),
});
type BanNhapMoHinh = z.infer<typeof BanNhapMoHinh>;

const HUONG_DAN = `Bạn đọc một câu nói tiếng Việt của nhân sự khu du lịch Ninh Bình (Tràng An, Tam Cốc, Bái Đính, Tam Chúc) và điền bản nháp.
- loai: "viec" khi người nói giao hay nhờ người khác làm; "ghi-chu" khi tự ghi hay tự nhắc mình; "nhat-ky" khi kể lại việc đã làm trong ngày.
- noi_dung: việc cần làm hoặc điều cần ghi, câu ngắn, viết hoa chữ đầu, bỏ phần người nhận, bỏ thời gian và bỏ lời đệm như "nhé", "giúp".
- nguoi_nhan_id: chỉ với "viec", chọn đúng một mã trong danh bạ; không chắc là ai thì để null và ghi tên nghe được vào ten_nghe.
- han: thời điểm ISO 8601 có múi +07:00. Nói ngày mà không nói giờ thì 17:00; "sáng" 09:00, "trưa" 12:00, "chiều" 15:00, "tối" 19:00. Không nói thời gian thì null.
- ngay: ngày của nhật ký hay ngày nói tới, dạng YYYY-MM-DD, mặc định hôm nay.
- co_so: cơ sở được nhắc tới, nếu có.
- khan: true khi câu có "gấp", "khẩn", "ngay lập tức", "ưu tiên".`;

function ngayVn(d: Date) {
  return new Date(d.getTime() + 7 * 3_600_000).toISOString().slice(0, 10);
}

function loiNguoiDung(cau: string, bayGio: Date, danhBa: readonly NguoiTrongDanhBa[], loaiEp?: LoaiGhi) {
  const danhBaChu = danhBa.map((p) => `${p.id} | ${p.ten} | ${p.vai} | ${p.coSo.join(",") || "toàn vùng"}`).join("\n");
  return `Danh bạ (mã | tên | vai | cơ sở):\n${danhBaChu}\n\nBây giờ: ${new Date(bayGio.getTime() + 7 * 3_600_000).toISOString().slice(0, 16)} giờ Việt Nam.${
    loaiEp ? `\nNgười nói đã chọn loại: ${loaiEp}.` : ""
  }\n\nCâu nói: ${cau}`;
}

async function hoiClaude(cau: string, bayGio: Date, danhBa: readonly NguoiTrongDanhBa[], loaiEp?: LoaiGhi) {
  const client = new Anthropic({ timeout: CHO_TOI_DA_MS, maxRetries: 1 });
  const response = await client.messages.parse({
    model: "claude-opus-5-5",
    max_tokens: 16000,
    output_config: { effort: "low", format: zodOutputFormat(BanNhapMoHinh) },
    system: [{ type: "text", text: HUONG_DAN, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: loiNguoiDung(cau, bayGio, danhBa, loaiEp) }],
  });
  if (response.stop_reason === "refusal" || !response.parsed_output) return null;
  return response.parsed_output;
}

const KHUON_JSON: Record<string, unknown> = { ...z.toJSONSchema(BanNhapMoHinh) };
delete KHUON_JSON.$schema;

/** Hỏi mô hình theo chuẩn OpenAI (Gemini, Groq, OpenRouter, Ollama…). */
async function hoiMoHinhChuanOpenAi(cau: string, bayGio: Date, danhBa: readonly NguoiTrongDanhBa[], loaiEp?: LoaiGhi) {
  const goc = (process.env.AI_BASE_URL?.trim() || AI_BASE_URL_MAC_DINH).replace(/\/+$/, "");
  const res = await fetch(`${goc}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${process.env.AI_API_KEY?.trim()}`,
    },
    body: JSON.stringify({
      model: process.env.AI_MODEL?.trim() || AI_MODEL_MAC_DINH,
      temperature: 0,
      messages: [
        { role: "system", content: HUONG_DAN },
        { role: "user", content: loiNguoiDung(cau, bayGio, danhBa, loaiEp) },
      ],
      response_format: { type: "json_schema", json_schema: { name: "ban_nhap", strict: true, schema: KHUON_JSON } },
    }),
    signal: AbortSignal.timeout(CHO_TOI_DA_MS),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`AI ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const body = (await res.json()) as { choices?: { message?: { content?: string | null } }[] };
  const noiDung = body.choices?.[0]?.message?.content;
  if (!noiDung) return null;
  const parsed = BanNhapMoHinh.safeParse(JSON.parse(noiDung));
  return parsed.success ? parsed.data : null;
}

function banNhapTuMoHinh(
  c: BanNhapMoHinh,
  cau: string,
  theoLuat: BanNhap,
  ngu: { bayGio: Date; danhBa: readonly NguoiTrongDanhBa[]; loaiEp?: LoaiGhi },
): BanNhap {
  const loai = ngu.loaiEp ?? c.loai;
  const nguoi = c.nguoi_nhan_id ? ngu.danhBa.find((p) => p.id === c.nguoi_nhan_id) : undefined;
  const han = c.han && !Number.isNaN(Date.parse(c.han)) ? new Date(c.han).toISOString() : null;
  const ungVien = nguoi ? [{ id: nguoi.id, ten: nguoi.ten }] : theoLuat.ungVien;
  const canXemLai: string[] = [];
  if (loai === "viec" && !nguoi) {
    canXemLai.push(c.ten_nghe ? `Chưa chắc "${c.ten_nghe}" là ai, chọn người nhận.` : "Chưa rõ giao cho ai.");
  }
  if (loai === "viec" && !han) canXemLai.push("Chưa có hạn, mặc định 17:00 hôm nay nếu để trống.");
  if (!c.noi_dung.trim()) canXemLai.push("Chưa nghe rõ nội dung.");
  return {
    loai,
    noiDung: c.noi_dung.trim(),
    nguoiNhanId: loai === "viec" ? (nguoi?.id ?? null) : null,
    ungVien: loai === "viec" ? ungVien : [],
    tenNghe: c.ten_nghe,
    han: loai === "nhat-ky" ? null : han,
    ngay: /^\d{4}-\d{2}-\d{2}$/.test(c.ngay) ? c.ngay : ngayVn(ngu.bayGio),
    coSo: (c.co_so as ErpSiteId | null) ?? theoLuat.coSo,
    khan: c.khan,
    canXemLai,
    cauGoc: cau.trim(),
  };
}

export async function hieuCauNoi(
  cau: string,
  ngu: { bayGio: Date; danhBa: readonly NguoiTrongDanhBa[]; loaiEp?: LoaiGhi },
): Promise<{ banNhap: BanNhap; boHieu: BoHieu }> {
  const theoLuat = phanTichCauNoi(cau, ngu);
  const boHieu = boHieuDangDung();
  if (boHieu === "luat") return { banNhap: theoLuat, boHieu: "luat" };

  try {
    const c =
      boHieu === "claude"
        ? await hoiClaude(cau, ngu.bayGio, ngu.danhBa, ngu.loaiEp)
        : await hoiMoHinhChuanOpenAi(cau, ngu.bayGio, ngu.danhBa, ngu.loaiEp);
    if (!c) return { banNhap: theoLuat, boHieu: "luat" };
    return { boHieu, banNhap: banNhapTuMoHinh(c, cau, theoLuat, ngu) };
  } catch (error) {
    if (error instanceof Anthropic.APIError) console.error("Claude assistant failed", error.status, error.message);
    else console.error(`${boHieu} assistant failed`, error instanceof Error ? error.message : error);
    return { banNhap: theoLuat, boHieu: "luat" };
  }
}
