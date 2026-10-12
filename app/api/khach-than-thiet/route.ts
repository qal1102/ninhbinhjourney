import { z } from "zod";
import { isSameOriginCustomerRequest } from "@/domain/customer-identity";
import { laMaGanDuoc } from "@/domain/khach-than-thiet";
import {
  ganMaVaoSo,
  KhachThanThietError,
  tomTatTheoMa,
  xemDayDuBangSo,
} from "@/lib/customer-data/khach-than-thiet-repository";

/**
 * Khách thân thiết trên trang khách (migration 119).
 *
 * GET `?ma=`: cầm mã vé thì thấy đã gắn số chưa, mấy lượt, mốc kế. POST
 * `gan`: gắn mã vào số điện thoại (bắt buộc đồng ý dịch vụ, tiếp thị là ô
 * riêng). POST `xem`: nhập lại đúng số để thấy voucher và mọi vé.
 *
 * Cầm mã là đủ để gắn, như cầm tấm vé (TC-20): mã mười ký tự ngẫu nhiên, và
 * một mã đã gắn thì số khác không gắn đè được.
 */

const NO_STORE = { "Cache-Control": "no-store" } as const;
const Ma = z.string().trim().min(6).max(40).refine(laMaGanDuoc);

const YeuCau = z.discriminatedUnion("hanh_dong", [
  z
    .object({
      hanh_dong: z.literal("gan"),
      ma: z.array(Ma).min(1).max(4),
      so_dien_thoai: z.string().trim().min(9).max(20),
      dong_y_dich_vu: z.literal(true),
      dong_y_tiep_thi: z.boolean(),
    })
    .strict(),
  z.object({ hanh_dong: z.literal("xem"), ma: Ma, so_dien_thoai: z.string().trim().min(9).max(20) }).strict(),
]);

function traLoi(error: unknown) {
  const loi = error instanceof KhachThanThietError ? error : null;
  const status =
    loi?.code === "NOT_FOUND" ? 404
      : loi?.code === "CONFIGURATION_MISSING" ? 503
        : loi?.code === "INPUT_INVALID" ? 400
          : loi?.code === "REFUSED" ? 409
            : 500;
  return Response.json(
    { accepted: false, error: { message: loi?.message ?? "Chưa xử lý được, xin thử lại." } },
    { status, headers: NO_STORE },
  );
}

export async function GET(request: Request) {
  const ma = Ma.safeParse(new URL(request.url).searchParams.get("ma") ?? "");
  if (!ma.success) {
    return Response.json({ accepted: false, error: { message: "Mã vé chưa hợp lệ." } }, { status: 400, headers: NO_STORE });
  }
  try {
    return Response.json({ accepted: true, tomTat: await tomTatTheoMa(ma.data) }, { headers: NO_STORE });
  } catch (error) {
    return traLoi(error);
  }
}

export async function POST(request: Request) {
  if (!isSameOriginCustomerRequest(request)) {
    return Response.json({ accepted: false, error: { message: "Yêu cầu không hợp lệ." } }, { status: 403, headers: NO_STORE });
  }
  const raw = await request.text();
  if (raw.length > 2048) {
    return Response.json({ accepted: false, error: { message: "Yêu cầu vượt giới hạn." } }, { status: 413, headers: NO_STORE });
  }
  let body: unknown = null;
  try {
    body = JSON.parse(raw);
  } catch {
    body = null;
  }
  const parsed = YeuCau.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { accepted: false, error: { message: "Mời bạn nhập số điện thoại và tích ô đồng ý dùng số để giữ vé, tích điểm." } },
      { status: 400, headers: NO_STORE },
    );
  }
  try {
    const tomTat =
      parsed.data.hanh_dong === "gan"
        ? await ganMaVaoSo({
            codes: parsed.data.ma,
            phone: parsed.data.so_dien_thoai,
            marketing: parsed.data.dong_y_tiep_thi,
            kenh: "web",
          })
        : await xemDayDuBangSo({ code: parsed.data.ma, phone: parsed.data.so_dien_thoai });
    return Response.json({ accepted: true, tomTat }, { headers: NO_STORE });
  } catch (error) {
    return traLoi(error);
  }
}
