import { NextResponse } from "next/server";
import { z } from "zod";
import type { ErpSiteId } from "@/domain/erp";
import { MAU_VAN_BAN, TEN_CO_SO, docTien, giaTriThu, vaiPhatHanhDuoc, type LoaiVanBan } from "@/domain/van-ban";
import { getCurrentErpUser } from "@/lib/erp/demo-session";
import { soNguoiCheo } from "@/lib/erp/thuyen-repository";
import { absoluteUrl } from "@/lib/site-url";
import { taoMaPhatHanh } from "@/lib/van-ban/ky-so";
import { pdfNgoaiHeThong, phatHanhPdf } from "@/lib/van-ban/pdf-van-ban";
import { VanBanLoi, danhSachVanBan, giuSoPhatHanh, kyPhatHanh, vanBanDaCo } from "@/lib/van-ban/van-ban-repository";

/**
 * Phát hành một mẫu văn bản thành PDF đã ký và mã hoá (màn `/erp/van-ban`).
 * Mỗi lần tải là một dòng trong sổ phát hành, có số văn bản riêng: cổng chỉ
 * nhận lại đúng tệp mang mã của dòng ấy.
 */

export const maxDuration = 30;

const YeuCau = z.object({
  loai: z.enum(["hop-dong-nguoi-cheo", "hop-dong-nha-cung-cap", "bien-ban-nghiem-thu"]),
  kieu: z.enum(["trong", "dien-dung", "dien-sai", "bi-sua", "ngoai"]),
  coSo: z.enum(["trang-an", "tam-coc", "bai-dinh", "tam-chuc"]).optional(),
  soThuyen: z
    .string()
    .trim()
    .regex(/^[0-9A-Za-z-]{1,20}$/)
    .optional(),
  canCu: z.string().trim().max(40).optional(),
});

function homNayVn() {
  return new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10);
}

function tenTep(loai: LoaiVanBan, so: string) {
  const goc = `${MAU_VAN_BAN[loai].ten} ${so}`
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
  return `${goc.replace(/[^A-Za-z0-9-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "")}.pdf`;
}

export async function POST(request: Request) {
  const user = await getCurrentErpUser();
  if (!user) return NextResponse.json({ message: "Phiên đăng nhập đã hết hạn." }, { status: 401 });
  const parsed = YeuCau.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ message: "Yêu cầu chưa đủ thông tin." }, { status: 400 });
  const { loai, kieu } = parsed.data;
  if (!vaiPhatHanhDuoc(loai, user.role)) {
    return NextResponse.json({ message: "Tài khoản của bạn không phát hành được loại văn bản này." }, { status: 403 });
  }

  const mau = MAU_VAN_BAN[loai];
  let coSo: ErpSiteId | null = parsed.data.coSo ?? null;
  const heThong: Record<string, string> = {};
  let hoTenTrongSo: string | null = null;
  let giaTriHopDong: number | null = null;
  let noiDungHopDong: string | null = null;

  if (loai === "hop-dong-nguoi-cheo") {
    if (coSo !== "trang-an" && coSo !== "tam-coc") return NextResponse.json({ message: "Chọn bến Tràng An hoặc Tam Cốc." }, { status: 400 });
    if (!parsed.data.soThuyen) return NextResponse.json({ message: "Chọn hoặc gõ số thuyền." }, { status: 400 });
    heThong.so_thuyen = parsed.data.soThuyen.toUpperCase();
    const so = await soNguoiCheo(coSo).catch(() => []);
    hoTenTrongSo = so.find((n) => n.soThuyen.trim().toUpperCase() === heThong.so_thuyen)?.hoTen ?? null;
  } else if (loai === "bien-ban-nghiem-thu") {
    const hd = vanBanDaCo(await danhSachVanBan()).find((v) => v.loai === "hop-dong-nha-cung-cap" && v.ketQua === "nhan" && v.soVanBan === parsed.data.canCu);
    if (!hd) return NextResponse.json({ message: "Chọn một hợp đồng nhà cung cấp đã có trong hệ thống." }, { status: 400 });
    coSo = hd.coSo;
    heThong.can_cu_hop_dong = hd.soVanBan;
    heThong.ten_ncc = hd.giaTri.ten_ncc ?? "";
    heThong.mst_ncc = hd.giaTri.mst_ncc ?? "";
    giaTriHopDong = docTien(hd.giaTri.gia_tri);
    noiDungHopDong = hd.giaTri.noi_dung ?? null;
  }
  if (!coSo) return NextResponse.json({ message: "Chọn cơ sở." }, { status: 400 });
  if (user.role !== "director" && !user.siteIds.includes(coSo)) {
    return NextResponse.json({ message: "Cơ sở này nằm ngoài phạm vi của bạn." }, { status: 403 });
  }
  heThong.co_so = TEN_CO_SO[coSo];

  if (kieu === "ngoai") {
    // Bản tự soạn ngoài hệ thống để thử cổng: không ghi sổ, không ký, không mã hoá.
    const so = `${mau.tienTo}-TU-SOAN`;
    const bytes = await pdfNgoaiHeThong({
      id: "VB-TUSOAN",
      loai,
      soVanBan: so,
      heThong: { ...heThong, so_van_ban: so },
      doiTac: giaTriThu(loai, "dien-dung", { homNay: homNayVn(), heThong, hoTenTrongSo, giaTriHopDong, noiDungHopDong }),
      phatHanhLuc: new Date().toISOString(),
      phatHanhBoi: "người ngoài",
      urlTraMa: absoluteUrl("/erp/van-ban"),
    });
    return new NextResponse(Buffer.from(bytes), {
      headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${tenTep(loai, "tu-soan")}"`, "Cache-Control": "no-store" },
    });
  }

  const id = taoMaPhatHanh();
  try {
    const { soVanBan, phatHanhLuc } = await giuSoPhatHanh({
      id,
      loai,
      phienBan: mau.phienBan,
      tienTo: mau.tienTo,
      coSo,
      heThong,
      kieu,
      nguoi: { id: user.id, ten: user.name },
    });
    heThong.so_van_ban = soVanBan;
    const { bytes, maBamNoiDung, maBamTep } = await phatHanhPdf({
      id,
      loai,
      soVanBan,
      heThong,
      doiTac: kieu === "trong" ? undefined : giaTriThu(loai, kieu === "dien-sai" ? "dien-sai" : "dien-dung", { homNay: homNayVn(), heThong, hoTenTrongSo, giaTriHopDong, noiDungHopDong }),
      suaDieuKhoan: kieu === "bi-sua",
      phatHanhLuc,
      phatHanhBoi: user.name,
      urlTraMa: absoluteUrl(`/erp/van-ban?ma=${id}`),
    });
    await kyPhatHanh(id, maBamNoiDung, maBamTep);
    return new NextResponse(Buffer.from(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${tenTep(loai, soVanBan)}"`,
        "Cache-Control": "no-store",
        "X-Van-Ban-Ma": id,
        "X-Van-Ban-So": encodeURIComponent(soVanBan),
      },
    });
  } catch (error) {
    if (error instanceof VanBanLoi) return NextResponse.json({ message: error.message }, { status: 400 });
    console.error("Van ban issue failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ message: "Chưa dựng được tệp PDF. Xin thử lại." }, { status: 500 });
  }
}
