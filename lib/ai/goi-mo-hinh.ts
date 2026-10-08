import "server-only";

/**
 * Gọi một mô hình theo chuẩn OpenAI (`/chat/completions`): mặc định Gemini ở
 * gói miễn phí của Google AI Studio; Groq, OpenRouter hay Ollama trên máy chỉ
 * cần đổi `AI_BASE_URL` và `AI_MODEL`, không sửa mã.
 *
 * Chuỗi nhiều mẫu (08/10/2026, chủ dự án sợ "AI hết lượt lúc demo"): mỗi mẫu
 * Gemini có hạn mức riêng, nên mẫu này báo hết lượt (429), quá tải (503) hay
 * lỗi máy chủ thì hỏi mẫu kế tiếp trong `AI_MODEL` (phân cách bằng dấu phẩy).
 * Cả chuỗi dùng chung một quỹ thời gian; hết quỹ thì ném lỗi để nơi gọi quay
 * về tầng miễn phí của nó.
 */

const AI_BASE_URL_MAC_DINH = "https://generativelanguage.googleapis.com/v1beta/openai";
export const CHUOI_MO_HINH_MAC_DINH = ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite", "gemini-3.5-flash"] as const;

export function coMoHinhAi(): boolean {
  return Boolean(process.env.AI_API_KEY?.trim());
}

export function chuoiMoHinh(): string[] {
  const dat = (process.env.AI_MODEL ?? "")
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);
  return dat.length ? dat : [...CHUOI_MO_HINH_MAC_DINH];
}

export type NoiDungTin = string | ({ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } })[];
export type TinNhan = { role: "system" | "user" | "assistant"; content: NoiDungTin };

export class LoiMoHinh extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
  }
}

/** Lỗi đáng thử mẫu khác: hết lượt, quá tải, máy chủ lỗi, mẫu không có. */
function nenThuMauKhac(status: number) {
  return status === 404 || status === 429 || status >= 500;
}

export async function hoiMoHinh(opts: {
  tinNhan: TinNhan[];
  /** JSON Schema khi cần trả về đúng khuôn; bỏ trống thì trả chữ. */
  khuon?: { ten: string; schema: Record<string, unknown> };
  toiDaToken?: number;
  quyThoiGianMs?: number;
}): Promise<{ noiDung: string; moHinh: string }> {
  const khoa = process.env.AI_API_KEY?.trim();
  if (!khoa) throw new LoiMoHinh("Chưa có AI_API_KEY.");
  const goc = (process.env.AI_BASE_URL?.trim() || AI_BASE_URL_MAC_DINH).replace(/\/+$/, "");
  const hetHan = Date.now() + (opts.quyThoiGianMs ?? 8_000);
  let loiCuoi: LoiMoHinh = new LoiMoHinh("Không mẫu nào trả lời.");

  for (const moHinh of chuoiMoHinh()) {
    const conLai = hetHan - Date.now();
    if (conLai < 400) break;
    let res: Response;
    try {
      res = await fetch(`${goc}/chat/completions`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${khoa}` },
        body: JSON.stringify({
          model: moHinh,
          temperature: 0,
          ...(opts.toiDaToken ? { max_tokens: opts.toiDaToken } : {}),
          messages: opts.tinNhan,
          ...(opts.khuon
            ? { response_format: { type: "json_schema", json_schema: { name: opts.khuon.ten, strict: true, schema: opts.khuon.schema } } }
            : {}),
        }),
        signal: AbortSignal.timeout(conLai),
        cache: "no-store",
      });
    } catch (error) {
      // Hết giờ thì dừng cả chuỗi; lỗi mạng lẻ thì thử mẫu kế.
      loiCuoi = new LoiMoHinh(`${moHinh}: ${error instanceof Error ? error.message : "lỗi mạng"}`);
      if (error instanceof Error && error.name === "TimeoutError") break;
      continue;
    }
    if (!res.ok) {
      loiCuoi = new LoiMoHinh(`${moHinh} ${res.status}: ${(await res.text()).slice(0, 160)}`, res.status);
      if (nenThuMauKhac(res.status)) continue;
      throw loiCuoi;
    }
    const body = (await res.json()) as { choices?: { message?: { content?: string | null } }[] };
    const noiDung = body.choices?.[0]?.message?.content?.trim();
    if (noiDung) return { noiDung, moHinh };
    loiCuoi = new LoiMoHinh(`${moHinh}: trả lời rỗng`);
  }
  throw loiCuoi;
}
