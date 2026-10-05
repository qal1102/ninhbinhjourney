import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { ErpSiteId } from "@/domain/erp";
import { phanTichCauNoi, type BanNhap, type LoaiGhi, type NguoiTrongDanhBa } from "@/domain/tro-ly-ghi";

/**
 * Hiểu một câu nói thành bản nháp việc / ghi chú / nhật ký.
 *
 * Mặc định dùng bộ hiểu bằng luật (`domain/tro-ly-ghi.ts`): miễn phí, không
 * gửi câu nói ra ngoài. Khi môi trường có `ANTHROPIC_API_KEY`, máy chủ hỏi
 * Claude để hiểu câu lạ hơn; Claude lỗi, chậm quá 8 giây hay từ chối thì
 * quay về bộ hiểu bằng luật, nên màn hình không bao giờ kẹt. Bật Claude chỉ
 * cần thêm biến môi trường trên Vercel, không sửa mã.
 *
 * Gửi cho Claude: câu nói, giờ hiện tại, và danh bạ rút gọn (mã, tên, vai,
 * cơ sở) để Claude chọn đúng người nhận.
 */

export type BoHieu = "luat" | "claude";

export function boHieuDangDung(): BoHieu {
  return process.env.ANTHROPIC_API_KEY?.trim() ? "claude" : "luat";
}

const CO_SO = ["trang-an", "tam-coc", "bai-dinh", "tam-chuc"] as const;

const BanNhapClaude = z.object({
  loai: z.enum(["viec", "ghi-chu", "nhat-ky"]),
  noi_dung: z.string(),
  nguoi_nhan_id: z.string().nullable(),
  ten_nghe: z.string().nullable(),
  han: z.string().nullable(),
  ngay: z.string(),
  co_so: z.enum(CO_SO).nullable(),
  khan: z.boolean(),
});

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

async function hoiClaude(cau: string, bayGio: Date, danhBa: readonly NguoiTrongDanhBa[], loaiEp?: LoaiGhi) {
  const client = new Anthropic({ timeout: 8_000, maxRetries: 1 });
  const danhBaChu = danhBa.map((p) => `${p.id} | ${p.ten} | ${p.vai} | ${p.coSo.join(",") || "toàn vùng"}`).join("\n");
  const response = await client.messages.parse({
    model: "claude-opus-5-5",
    max_tokens: 16000,
    output_config: { effort: "low", format: zodOutputFormat(BanNhapClaude) },
    system: [{ type: "text", text: HUONG_DAN, cache_control: { type: "ephemeral" } }],
    messages: [
      {
        role: "user",
        content: `Danh bạ (mã | tên | vai | cơ sở):\n${danhBaChu}\n\nBây giờ: ${new Date(bayGio.getTime() + 7 * 3_600_000).toISOString().slice(0, 16)} giờ Việt Nam.${
          loaiEp ? `\nNgười nói đã chọn loại: ${loaiEp}.` : ""
        }\n\nCâu nói: ${cau}`,
      },
    ],
  });
  if (response.stop_reason === "refusal" || !response.parsed_output) return null;
  return response.parsed_output;
}

export async function hieuCauNoi(
  cau: string,
  ngu: { bayGio: Date; danhBa: readonly NguoiTrongDanhBa[]; loaiEp?: LoaiGhi },
): Promise<{ banNhap: BanNhap; boHieu: BoHieu }> {
  const theoLuat = phanTichCauNoi(cau, ngu);
  if (boHieuDangDung() !== "claude") return { banNhap: theoLuat, boHieu: "luat" };

  try {
    const c = await hoiClaude(cau, ngu.bayGio, ngu.danhBa, ngu.loaiEp);
    if (!c) return { banNhap: theoLuat, boHieu: "luat" };
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
      boHieu: "claude",
      banNhap: {
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
      },
    };
  } catch (error) {
    if (error instanceof Anthropic.APIError) console.error("Claude assistant failed", error.status, error.message);
    else console.error("Claude assistant failed", error);
    return { banNhap: theoLuat, boHieu: "luat" };
  }
}
