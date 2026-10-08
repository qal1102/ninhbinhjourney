import { z } from "zod";
import { isSameOriginCustomerRequest } from "@/domain/customer-identity";
import { bamKhoa, traLoiCauHoi } from "@/lib/hoi-dap/tra-loi";

/** Khung hỏi đáp trên web khách (`components/shared/hoi-dap-noi.tsx`). */

const MAX_BODY_BYTES = 6 * 1024;

const YeuCau = z
  .object({
    cau: z.string().trim().min(1).max(300),
    lang: z.enum(["vi", "en"]),
    mucId: z.string().max(80).optional(),
    lichSu: z
      .array(z.object({ vai: z.enum(["khach", "tro-ly"]), chu: z.string().max(1000) }))
      .max(6)
      .optional(),
  })
  .strict();

const KHONG_LUU = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
  if (!isSameOriginCustomerRequest(request)) {
    return Response.json({ error: "ORIGIN_REJECTED" }, { status: 403, headers: KHONG_LUU });
  }
  if (Number(request.headers.get("content-length") ?? "0") > MAX_BODY_BYTES) {
    return Response.json({ error: "PAYLOAD_TOO_LARGE" }, { status: 413, headers: KHONG_LUU });
  }
  const parsed = YeuCau.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "INVALID_REQUEST" }, { status: 400, headers: KHONG_LUU });
  }
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "khong-ro";
  const kq = await traLoiCauHoi({ ...parsed.data, khoaKhach: bamKhoa(ip) });
  return Response.json(kq, { headers: KHONG_LUU });
}
