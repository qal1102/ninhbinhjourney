import { z } from "zod";
import { getCurrentErpUser } from "@/lib/erp/demo-session";
import { bamKhoa, traLoiCauHoi } from "@/lib/hoi-dap/tra-loi";

/**
 * Hỏi đáp trong ERP (nút Trợ lý, `components/erp/voice-command-center.tsx`):
 * câu hỏi cách làm hay câu trợ lý không khớp lệnh nào thì hỏi AI với tư liệu
 * là bản đồ chức năng của cả hệ thống. Chỉ người đã đăng nhập ERP; giới hạn
 * lượt tính theo tài khoản.
 */

const MAX_BODY_BYTES = 6 * 1024;

const YeuCau = z
  .object({
    cau: z.string().trim().min(1).max(300),
    lichSu: z
      .array(z.object({ vai: z.enum(["khach", "tro-ly"]), chu: z.string().max(1000) }))
      .max(6)
      .optional(),
  })
  .strict();

const KHONG_LUU = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
  const user = await getCurrentErpUser();
  if (!user) {
    return Response.json({ message: "Phiên đăng nhập đã hết hạn." }, { status: 401, headers: KHONG_LUU });
  }
  if (Number(request.headers.get("content-length") ?? "0") > MAX_BODY_BYTES) {
    return Response.json({ message: "Câu hỏi dài quá." }, { status: 413, headers: KHONG_LUU });
  }
  const parsed = YeuCau.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ message: "Câu hỏi không hợp lệ." }, { status: 400, headers: KHONG_LUU });
  }
  const kq = await traLoiCauHoi({
    ...parsed.data,
    lang: "vi",
    phamVi: "erp",
    vai: user.role,
    khoaKhach: bamKhoa(`erp:${user.id}`),
  });
  return Response.json(kq, { headers: KHONG_LUU });
}
