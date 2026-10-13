"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentErpUser } from "@/lib/erp/demo-session";
import { rutThamSuKien, taoSuKien } from "@/lib/customer-data/su-kien-repository";
import { duyetAnh } from "@/lib/customer-data/thi-anh-repository";
import { ERP_SHIFT_CLOSE_SITE_UUID_BY_SLUG } from "@/lib/erp/shift-close-repository";

/**
 * Sự kiện và thi ảnh (`/erp/su-kien`, `/erp/thi-anh`, migration 127). Chỉ
 * giám đốc tạo sự kiện, rút thăm, duyệt ảnh và chấm giải; kho kiểm lại vai.
 */

export type SuKienActionState = { status: "idle" | "success" | "error"; message: string };

async function giamDoc() {
  const user = await getCurrentErpUser();
  if (!user) throw new Error("Phiên đăng nhập đã hết hạn.");
  if (user.role !== "director") throw new Error("Chỉ giám đốc làm được việc này.");
  return user;
}

function loi(error: unknown): SuKienActionState {
  if (error instanceof z.ZodError) return { status: "error", message: error.issues[0]?.message ?? "Dữ liệu chưa đúng." };
  if (error instanceof Error) return { status: "error", message: error.message };
  return { status: "error", message: "Chưa làm được, xin thử lại." };
}

/** Giờ nhập từ ô `datetime-local` là giờ Việt Nam. */
const GioVN = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Chọn đủ ngày và giờ.")
  .transform((v) => `${v}:00+07:00`);

const SuKienMoi = z.object({
  ten: z.string().trim().min(3, "Tên sự kiện ít nhất 3 ký tự.").max(160),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9][a-z0-9-]{2,59}$/, "Đường dẫn chỉ gồm chữ thường không dấu, số và gạch nối, 3–60 ký tự."),
  khachMoi: z.string().trim().min(1, "Ghi khách mời (có thể ghi \"công bố sau\").").max(160),
  moTa: z.string().trim().max(2000),
  coSo: z.string().trim(),
  dienRaLuc: GioVN,
  hanDangKy: GioVN,
  soGiai: z.coerce.number().int().min(1, "Ít nhất 1 giải.").max(200, "Tối đa 200 giải."),
  giaiThuong: z.string().trim().min(3, "Ghi giải thưởng.").max(500),
  soDangKyKhuyenMai: z.string().trim().max(120),
});

export async function taoSuKienAction(_truoc: SuKienActionState, formData: FormData): Promise<SuKienActionState> {
  try {
    const user = await giamDoc();
    const v = SuKienMoi.parse(Object.fromEntries(["ten", "slug", "khachMoi", "moTa", "coSo", "dienRaLuc", "hanDangKy", "soGiai", "giaiThuong", "soDangKyKhuyenMai"].map((k) => [k, formData.get(k) ?? ""])));
    const siteId = (ERP_SHIFT_CLOSE_SITE_UUID_BY_SLUG as Record<string, string>)[v.coSo] ?? null;
    await taoSuKien({
      actorAccountId: user.id,
      slug: v.slug,
      ten: v.ten,
      moTa: v.moTa,
      khachMoi: v.khachMoi,
      siteId,
      dienRaLuc: v.dienRaLuc,
      hanDangKy: v.hanDangKy,
      soGiai: v.soGiai,
      giaiThuong: v.giaiThuong,
      soDangKyKhuyenMai: v.soDangKyKhuyenMai || null,
    });
    revalidatePath("/erp/su-kien");
    return { status: "success", message: `Đã mở sự kiện. Trang khách: /su-kien/${v.slug}` };
  } catch (error) {
    return loi(error);
  }
}

export async function rutThamAction(_truoc: SuKienActionState, formData: FormData): Promise<SuKienActionState> {
  try {
    const user = await giamDoc();
    const slug = z.string().trim().min(3).parse(formData.get("slug"));
    const ket = await rutThamSuKien({ slug, actorAccountId: user.id });
    revalidatePath("/erp/su-kien");
    revalidatePath(`/su-kien/${slug}`);
    const trung = ket?.danhSach?.filter((d) => d.trung !== null).length ?? 0;
    return { status: "success", message: `Đã rút thăm: ${trung} người trúng. Kết quả và hạt giống đã công bố ở trang sự kiện.` };
  } catch (error) {
    return loi(error);
  }
}

export async function duyetAnhAction(_truoc: SuKienActionState, formData: FormData): Promise<SuKienActionState> {
  try {
    const user = await giamDoc();
    const id = z.string().uuid().parse(formData.get("id"));
    const trangThai = z.enum(["da-duyet", "tu-choi"]).parse(formData.get("trang_thai"));
    const giaiTho = String(formData.get("giai") ?? "");
    const giai = z.enum(["", "nhat", "nhi", "ba", "khuyen-khich"]).parse(giaiTho) || null;
    await duyetAnh({ actorAccountId: user.id, id, trangThai, giai: trangThai === "da-duyet" ? giai : null });
    revalidatePath("/erp/thi-anh");
    revalidatePath("/thi-anh");
    return { status: "success", message: trangThai === "tu-choi" ? "Đã không dùng ảnh này." : giai ? "Đã duyệt và chấm giải." : "Đã duyệt, ảnh hiện ở trang thi ảnh." };
  } catch (error) {
    return loi(error);
  }
}
