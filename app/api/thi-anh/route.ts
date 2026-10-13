import { isSameOriginCustomerRequest } from "@/domain/customer-identity";
import { laDiaDiemThiAnh } from "@/domain/thi-anh";
import { conLuot } from "@/lib/gioi-han-luot";
import { SuKienError } from "@/lib/customer-data/su-kien-repository";
import { anhCuaToi, guiAnhDuThi } from "@/lib/customer-data/thi-anh-repository";

/**
 * Thi ảnh (migration 127). POST dạng biểu mẫu có tệp: gửi ảnh dự thi. POST
 * JSON `{ hanh_dong: "cua-toi", so_dien_thoai }`: ảnh của số này, trạng thái,
 * mã nhận giải. Mỗi IP 12 lượt trong 30 phút.
 */

const NO_STORE = { "Cache-Control": "no-store" } as const;

function traLoi(error: unknown) {
  const loi = error instanceof SuKienError ? error : null;
  const status = loi?.code === "CONFIGURATION_MISSING" ? 503 : loi?.code === "INPUT_INVALID" ? 400 : loi?.code === "REFUSED" ? 409 : 500;
  return Response.json({ accepted: false, error: { message: loi?.message ?? "Chưa gửi được, xin thử lại." } }, { status, headers: NO_STORE });
}

function chuoi(form: FormData, ten: string) {
  const v = form.get(ten);
  return typeof v === "string" ? v.trim() : "";
}

export async function POST(request: Request) {
  if (!isSameOriginCustomerRequest(request)) {
    return Response.json({ accepted: false, error: { message: "Yêu cầu không đến từ trang Ninh Bình Journey." } }, { status: 403, headers: NO_STORE });
  }
  if (!conLuot(request, "thi-anh", 12, 30 * 60_000)) {
    return Response.json({ accepted: false, error: { message: "Bạn gửi nhiều lần quá. Mời bạn quay lại sau ít phút." } }, { status: 429, headers: NO_STORE });
  }
  try {
    if ((request.headers.get("content-type") ?? "").includes("application/json")) {
      const body = (await request.json().catch(() => null)) as { hanh_dong?: unknown; so_dien_thoai?: unknown } | null;
      if (body?.hanh_dong !== "cua-toi" || typeof body.so_dien_thoai !== "string") {
        return Response.json({ accepted: false, error: { message: "Mời bạn nhập số điện thoại." } }, { status: 400, headers: NO_STORE });
      }
      return Response.json({ accepted: true, anh: await anhCuaToi(body.so_dien_thoai) }, { headers: NO_STORE });
    }
    const form = await request.formData();
    const anh = form.get("anh");
    const dauMa = chuoi(form, "dau_ma");
    const ten = chuoi(form, "ten");
    if (!(anh instanceof File) || !laDiaDiemThiAnh(dauMa) || !ten || chuoi(form, "dong_y_the_le") !== "co") {
      return Response.json({ accepted: false, error: { message: "Mời bạn chọn ảnh, nơi chụp, tên hiển thị và đồng ý thể lệ." } }, { status: 400, headers: NO_STORE });
    }
    const ket = await guiAnhDuThi({
      phone: chuoi(form, "so_dien_thoai"),
      marketing: chuoi(form, "dong_y_tiep_thi") === "co",
      ten: ten.slice(0, 60),
      chuThich: chuoi(form, "chu_thich").slice(0, 300),
      dauMa,
      anh,
    });
    return Response.json({ accepted: true, ...ket }, { headers: NO_STORE });
  } catch (error) {
    return traLoi(error);
  }
}
