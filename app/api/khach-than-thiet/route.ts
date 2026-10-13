import { createHash } from "node:crypto";
import { z } from "zod";
import { isSameOriginCustomerRequest } from "@/domain/customer-identity";
import { laMaGanDuoc } from "@/domain/khach-than-thiet";
import {
  ganMaVaoSo,
  KhachThanThietError,
  tomTatTheoMa,
  traBangSo,
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
  z.object({ hanh_dong: z.literal("tra-so"), so_dien_thoai: z.string().trim().min(9).max(20) }).strict(),
]);

/*
 * Tra chỉ bằng số (13/10/2026, chủ dự án: "tra cứu bằng sđt được"). Không có
 * tin nhắn xác nhận, nên chặn dò số hàng loạt: mỗi IP 8 lượt trong 10 phút.
 * Bộ đếm nằm trong bộ nhớ của từng máy chủ, chỉ là hàng rào mỏng; kết quả đã
 * che mã vé và không có mã quà nên lộ cũng không lấy được vé.
 */
const LUOT_TRA_SO = new Map<string, number[]>();
const KHUNG_TRA_SO_MS = 10 * 60_000;
function conLuotTraSo(request: Request, bayGio = Date.now()): boolean {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "khong-ro";
  const khoa = createHash("sha256").update(`tra-so:${ip}`).digest("hex").slice(0, 24);
  const cu = (LUOT_TRA_SO.get(khoa) ?? []).filter((t) => bayGio - t < KHUNG_TRA_SO_MS);
  if (cu.length >= 8) {
    LUOT_TRA_SO.set(khoa, cu);
    return false;
  }
  cu.push(bayGio);
  LUOT_TRA_SO.set(khoa, cu);
  if (LUOT_TRA_SO.size > 5_000) LUOT_TRA_SO.delete(LUOT_TRA_SO.keys().next().value as string);
  return true;
}

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
  if (parsed.data.hanh_dong === "tra-so") {
    if (!conLuotTraSo(request)) {
      return Response.json(
        { accepted: false, error: { message: "Bạn tra nhiều lần quá, mời thử lại sau ít phút." } },
        { status: 429, headers: NO_STORE },
      );
    }
    try {
      return Response.json({ accepted: true, ketQua: await traBangSo(parsed.data.so_dien_thoai) }, { headers: NO_STORE });
    } catch (error) {
      return traLoi(error);
    }
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
