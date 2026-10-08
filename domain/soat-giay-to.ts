import { z } from "zod";
import type { SupplierApSupplier } from "@/domain/erp-supplier-ap";

/**
 * Soát giấy tờ bằng AI (08/10/2026). Chủ dự án muốn AI "báo cáo khi giấy tờ
 * chưa đúng hoặc chưa đủ, cảnh báo thiếu con dấu, chữ ký…, tự đọc hình ảnh
 * rồi tự điền giúp".
 *
 * Chia việc rõ: AI CHỈ ĐỌC ảnh thành các trường (`TrichXuat`); còn kết luận
 * đúng/sai/thiếu do các luật dưới đây quyết, chạy giống nhau mọi lần và đọc
 * được. AI không tự phán "hợp lệ". Đây là bước soát sơ bộ cho người nộp và kế
 * toán, không thay việc kế toán kiểm tra theo luồng hồ sơ NCC (đề nghị → hợp
 * đồng → nghiệm thu → hoá đơn → kế toán → người kiểm tra), và không tra cứu
 * hoá đơn với cơ quan thuế: dự án chưa nối hệ thống hoá đơn điện tử thật.
 */

export const LOAI_GIAY_TO = ["hoa-don", "nghiem-thu", "hop-dong", "danh-sach-doan", "khac"] as const;
export type LoaiGiayTo = (typeof LOAI_GIAY_TO)[number];

export const TEN_LOAI: Record<LoaiGiayTo, string> = {
  "hoa-don": "Hoá đơn GTGT",
  "nghiem-thu": "Biên bản nghiệm thu",
  "hop-dong": "Hợp đồng",
  "danh-sach-doan": "Danh sách đoàn khách",
  khac: "Giấy tờ khác",
};

const chu = z.string().nullable();
const so = z.number().nullable();
const co = z.boolean().nullable();

/** Những gì AI đọc được trên ảnh. Bên cung cấp/bán là `BenBan`, bên nhận/mua là `BenMua`. */
export const TrichXuat = z.object({
  loai: z.enum(LOAI_GIAY_TO),
  docRo: z.boolean(),
  soChungTu: chu,
  kyHieu: chu,
  ngay: chu,
  maCqt: chu,
  tenBenBan: chu,
  mstBenBan: chu,
  tenBenMua: chu,
  mstBenMua: chu,
  noiDung: chu,
  tienTruocThue: so,
  thueSuat: so,
  tienThue: so,
  tongTien: so,
  canCu: chu,
  coChuKyBenBan: co,
  coChuKySoBenBan: co,
  coDauBenBan: co,
  coChuKyBenMua: co,
  coDauBenMua: co,
  soNguoi: so,
  danhSachTen: z.array(z.string()),
  ghiChu: z.string(),
});
export type TrichXuat = z.infer<typeof TrichXuat>;

export const HUONG_DAN_DOC = `Bạn đọc ảnh giấy tờ kế toán, hành chính của một doanh nghiệp du lịch Việt Nam và trích đúng những gì NHÌN THẤY, không đoán, không sửa số.
- loai: hoa-don (hoá đơn GTGT/bán hàng), nghiem-thu (biên bản nghiệm thu/bàn giao), hop-dong (hợp đồng, phụ lục), danh-sach-doan (danh sách khách đoàn), khac.
- docRo: false khi ảnh mờ, mất góc, che chữ đến mức không chắc số liệu.
- soChungTu: số hoá đơn / số biên bản / số hợp đồng. kyHieu: ký hiệu hoá đơn. ngay: ngày lập/ký dạng YYYY-MM-DD. maCqt: mã của cơ quan thuế nếu có.
- Bên bán/cung cấp/bên B cung cấp dịch vụ là "BenBan"; bên mua/nhận dịch vụ là "BenMua". MST giữ nguyên chữ số và dấu gạch.
- Số tiền là số nguyên đồng, bỏ dấu chấm ngăn cách. thueSuat là phần trăm (8 cho 8%). Biên bản nghiệm thu: giá trị nghiệm thu đặt vào tienTruocThue.
- canCu: hợp đồng/đơn hàng được dẫn chiếu (ví dụ "hợp đồng số 03/2026/HĐDV").
- coChuKySoBenBan: có khung chữ ký số ("Ký bởi", "Signature Valid"). coChuKy...: có chữ ký tay. coDau...: có con dấu tròn đỏ. Không thấy thì false; phần không áp dụng thì null.
- soNguoi, danhSachTen: chỉ với danh sách đoàn.
- ghiChu: điều bất thường thấy được (tẩy xoá, sửa tay, chữ không khớp), một câu; không có thì chuỗi rỗng.
Ô để trống hay không có thì null.`;

export type TrangThaiMuc = "dat" | "thieu" | "sai" | "can-xem";
export type MucSoat = { ten: string; trangThai: TrangThaiMuc; chiTiet: string };
export type KetQuaSoat = { ketLuan: "dat" | "thieu" | "can-xem"; muc: MucSoat[] };

const MST = /^\d{10}(-\d{3})?$/;

function ngayDoc(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function vnd(n: number) {
  return `${n.toLocaleString("vi-VN")} đ`;
}

function coChu(v: string | null | undefined): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function kiemMst(ten: string, mst: string | null, batBuoc: boolean): MucSoat {
  if (!coChu(mst)) return { ten, trangThai: batBuoc ? "thieu" : "can-xem", chiTiet: "Không thấy mã số thuế." };
  const gon = mst.replace(/\s/g, "");
  return MST.test(gon)
    ? { ten, trangThai: "dat", chiTiet: gon }
    : { ten, trangThai: "sai", chiTiet: `"${mst}" không đúng dạng 10 số hoặc 10 số kèm -3 số.` };
}

function kiemNgay(ten: string, ngay: string | null, homNay: string): MucSoat {
  if (!coChu(ngay) || !/^\d{4}-\d{2}-\d{2}$/.test(ngay)) return { ten, trangThai: "thieu", chiTiet: "Không đọc được ngày." };
  if (ngay > homNay) return { ten, trangThai: "sai", chiTiet: `Ngày ${ngayDoc(ngay)} ở sau hôm nay (${ngayDoc(homNay)}).` };
  return { ten, trangThai: "dat", chiTiet: ngayDoc(ngay) };
}

function kiemCo(ten: string, gia: boolean | null, khiThieu: TrangThaiMuc, chiTietThieu: string, chiTietCo = "Có."): MucSoat {
  return gia ? { ten, trangThai: "dat", chiTiet: chiTietCo } : { ten, trangThai: khiThieu, chiTiet: chiTietThieu };
}

function kiemTien(t: TrichXuat): MucSoat[] {
  const muc: MucSoat[] = [];
  const { tienTruocThue: net, tienThue: vat, tongTien: tong, thueSuat } = t;
  if (net === null || vat === null || tong === null) {
    muc.push({ ten: "Số tiền", trangThai: "thieu", chiTiet: "Thiếu tiền hàng, tiền thuế hoặc tổng thanh toán." });
    return muc;
  }
  muc.push(
    Math.abs(net + vat - tong) <= 1
      ? { ten: "Cộng tiền", trangThai: "dat", chiTiet: `${vnd(net)} + ${vnd(vat)} = ${vnd(tong)}` }
      : { ten: "Cộng tiền", trangThai: "sai", chiTiet: `${vnd(net)} + ${vnd(vat)} = ${vnd(net + vat)}, nhưng hoá đơn ghi tổng ${vnd(tong)}.` },
  );
  if (thueSuat !== null) {
    const dung = Math.round((net * thueSuat) / 100);
    muc.push(
      Math.abs(dung - vat) <= 1
        ? { ten: "Tiền thuế theo thuế suất", trangThai: "dat", chiTiet: `${thueSuat}% × ${vnd(net)} = ${vnd(vat)}` }
        : { ten: "Tiền thuế theo thuế suất", trangThai: "can-xem", chiTiet: `${thueSuat}% × ${vnd(net)} = ${vnd(dung)}, hoá đơn ghi ${vnd(vat)}.` },
    );
  }
  return muc;
}

export function kiemGiayTo(t: TrichXuat, homNay: string, dsNcc: readonly SupplierApSupplier[] = []): KetQuaSoat {
  const muc: MucSoat[] = [
    t.docRo
      ? { ten: "Ảnh đọc được", trangThai: "dat", chiTiet: "Chữ và số rõ." }
      : { ten: "Ảnh đọc được", trangThai: "can-xem", chiTiet: "Ảnh mờ hoặc mất góc, số liệu dưới đây có thể sai; nên chụp lại." },
  ];

  if (t.loai === "hoa-don") {
    muc.push(
      coChu(t.kyHieu) && coChu(t.soChungTu)
        ? { ten: "Ký hiệu và số hoá đơn", trangThai: "dat", chiTiet: `${t.kyHieu} · số ${t.soChungTu}` }
        : { ten: "Ký hiệu và số hoá đơn", trangThai: "thieu", chiTiet: "Thiếu ký hiệu hoặc số hoá đơn." },
      kiemNgay("Ngày lập", t.ngay, homNay),
      coChu(t.tenBenBan) ? { ten: "Tên người bán", trangThai: "dat", chiTiet: t.tenBenBan } : { ten: "Tên người bán", trangThai: "thieu", chiTiet: "Không thấy tên người bán." },
      kiemMst("MST người bán", t.mstBenBan, true),
      coChu(t.tenBenMua) ? { ten: "Tên người mua", trangThai: "dat", chiTiet: t.tenBenMua } : { ten: "Tên người mua", trangThai: "thieu", chiTiet: "Không thấy tên đơn vị mua." },
      kiemMst("MST người mua", t.mstBenMua, true),
      coChu(t.noiDung) ? { ten: "Hàng hoá, dịch vụ", trangThai: "dat", chiTiet: t.noiDung } : { ten: "Hàng hoá, dịch vụ", trangThai: "thieu", chiTiet: "Không thấy nội dung hàng hoá, dịch vụ." },
      ...kiemTien(t),
      t.coChuKySoBenBan || t.coChuKyBenBan
        ? { ten: "Chữ ký người bán", trangThai: "dat", chiTiet: t.coChuKySoBenBan ? "Có chữ ký số." : "Có chữ ký tay." }
        : { ten: "Chữ ký người bán", trangThai: "thieu", chiTiet: "Chưa thấy chữ ký số hay chữ ký của người bán." },
      coChu(t.maCqt)
        ? { ten: "Mã của cơ quan thuế", trangThai: "dat", chiTiet: t.maCqt }
        : { ten: "Mã của cơ quan thuế", trangThai: "can-xem", chiTiet: "Hoá đơn không có mã của cơ quan thuế: hỏi lại người bán có thuộc diện dùng hoá đơn không mã không." },
    );
    if (coChu(t.mstBenBan)) {
      const ncc = dsNcc.find((n) => n.taxCode.replace(/\D/g, "") === t.mstBenBan!.replace(/\D/g, ""));
      muc.push(
        ncc
          ? { ten: "Nhà cung cấp trong danh mục", trangThai: "dat", chiTiet: `${ncc.code} · ${ncc.name}` }
          : { ten: "Nhà cung cấp trong danh mục", trangThai: "can-xem", chiTiet: "MST người bán chưa có trong danh mục nhà cung cấp của bạn." },
      );
    }
  } else if (t.loai === "nghiem-thu") {
    muc.push(
      coChu(t.soChungTu) ? { ten: "Số biên bản", trangThai: "dat", chiTiet: t.soChungTu } : { ten: "Số biên bản", trangThai: "can-xem", chiTiet: "Biên bản chưa có số." },
      kiemNgay("Ngày nghiệm thu", t.ngay, homNay),
      coChu(t.tenBenBan) && coChu(t.tenBenMua)
        ? { ten: "Hai bên", trangThai: "dat", chiTiet: `${t.tenBenBan} → ${t.tenBenMua}` }
        : { ten: "Hai bên", trangThai: "thieu", chiTiet: "Thiếu tên bên cung cấp hoặc bên nhận." },
      coChu(t.noiDung) ? { ten: "Nội dung nghiệm thu", trangThai: "dat", chiTiet: t.noiDung } : { ten: "Nội dung nghiệm thu", trangThai: "thieu", chiTiet: "Không thấy nội dung, khối lượng nghiệm thu." },
      t.tienTruocThue !== null
        ? { ten: "Giá trị nghiệm thu", trangThai: "dat", chiTiet: vnd(t.tienTruocThue) }
        : { ten: "Giá trị nghiệm thu", trangThai: "can-xem", chiTiet: "Không thấy giá trị; kế toán cần số này để đối chiếu với hoá đơn." },
      coChu(t.canCu) ? { ten: "Căn cứ hợp đồng", trangThai: "dat", chiTiet: t.canCu } : { ten: "Căn cứ hợp đồng", trangThai: "can-xem", chiTiet: "Không dẫn chiếu hợp đồng hay đơn hàng." },
      kiemCo("Chữ ký bên nhận", t.coChuKyBenMua, "thieu", "Bên nhận dịch vụ chưa ký."),
      kiemCo("Chữ ký bên cung cấp", t.coChuKyBenBan || t.coChuKySoBenBan, "thieu", "Bên cung cấp chưa ký."),
      kiemCo("Con dấu bên cung cấp", t.coDauBenBan, "can-xem", "Chưa thấy dấu của bên cung cấp; với doanh nghiệp nên có."),
    );
  } else if (t.loai === "hop-dong") {
    muc.push(
      coChu(t.soChungTu) ? { ten: "Số hợp đồng", trangThai: "dat", chiTiet: t.soChungTu } : { ten: "Số hợp đồng", trangThai: "can-xem", chiTiet: "Hợp đồng chưa có số." },
      kiemNgay("Ngày ký", t.ngay, homNay),
      kiemMst("MST bên cung cấp", t.mstBenBan, true),
      kiemMst("MST bên mua", t.mstBenMua, false),
      t.tienTruocThue !== null || t.tongTien !== null
        ? { ten: "Giá trị hợp đồng", trangThai: "dat", chiTiet: vnd((t.tongTien ?? t.tienTruocThue)!) }
        : { ten: "Giá trị hợp đồng", trangThai: "can-xem", chiTiet: "Không thấy giá trị hợp đồng." },
      kiemCo("Chữ ký hai bên", Boolean((t.coChuKyBenBan || t.coChuKySoBenBan) && t.coChuKyBenMua), "thieu", "Thiếu chữ ký của ít nhất một bên."),
      kiemCo("Con dấu hai bên", Boolean(t.coDauBenBan && t.coDauBenMua), "can-xem", "Thiếu dấu của ít nhất một bên."),
    );
  } else if (t.loai === "danh-sach-doan") {
    const soTen = t.danhSachTen.filter((x) => x.trim()).length;
    muc.push(
      soTen > 0 ? { ten: "Họ tên khách", trangThai: "dat", chiTiet: `${soTen} người có tên.` } : { ten: "Họ tên khách", trangThai: "thieu", chiTiet: "Không đọc được tên khách nào." },
      t.soNguoi === null || t.soNguoi === soTen
        ? { ten: "Khớp số người", trangThai: "dat", chiTiet: t.soNguoi === null ? "Danh sách không ghi tổng." : `${t.soNguoi} người.` }
        : { ten: "Khớp số người", trangThai: "sai", chiTiet: `Ghi ${t.soNguoi} người nhưng đọc được ${soTen} tên.` },
    );
  } else {
    muc.push({ ten: "Loại giấy tờ", trangThai: "can-xem", chiTiet: "Chưa nhận ra đây là hoá đơn, biên bản, hợp đồng hay danh sách đoàn." });
  }

  if (coChu(t.ghiChu)) muc.push({ ten: "Điều bất thường", trangThai: "can-xem", chiTiet: t.ghiChu });

  const ketLuan = muc.some((m) => m.trangThai === "thieu" || m.trangThai === "sai")
    ? "thieu"
    : muc.some((m) => m.trangThai === "can-xem")
      ? "can-xem"
      : "dat";
  return { ketLuan, muc };
}

/**
 * Đối chiếu chéo các giấy tờ cùng một bộ hồ sơ NCC: cùng nhà cung cấp, giá trị
 * nghiệm thu bằng tiền hàng trên hoá đơn, nghiệm thu không sau hoá đơn, hoá
 * đơn và nghiệm thu dẫn đúng hợp đồng.
 */
export function doiChieuBo(ds: readonly TrichXuat[]): MucSoat[] {
  const hd = ds.find((t) => t.loai === "hoa-don");
  const nt = ds.find((t) => t.loai === "nghiem-thu");
  const hdg = ds.find((t) => t.loai === "hop-dong");
  const muc: MucSoat[] = [];
  const mst = (x?: string | null) => (x ?? "").replace(/\D/g, "");
  const coHai = [hd, nt, hdg].filter(Boolean);
  if (coHai.length < 2) return muc;

  const dsMst = coHai.map((t) => mst(t!.mstBenBan)).filter(Boolean);
  if (dsMst.length >= 2) {
    muc.push(
      new Set(dsMst).size === 1
        ? { ten: "Cùng một nhà cung cấp", trangThai: "dat", chiTiet: `MST ${dsMst[0]} trên mọi giấy tờ.` }
        : { ten: "Cùng một nhà cung cấp", trangThai: "sai", chiTiet: `MST bên cung cấp khác nhau: ${[...new Set(dsMst)].join(", ")}.` },
    );
  }
  if (hd && nt && hd.tienTruocThue !== null && nt.tienTruocThue !== null) {
    muc.push(
      hd.tienTruocThue === nt.tienTruocThue
        ? { ten: "Nghiệm thu khớp hoá đơn", trangThai: "dat", chiTiet: `Cùng ${vnd(hd.tienTruocThue)} trước thuế.` }
        : {
            ten: "Nghiệm thu khớp hoá đơn",
            trangThai: "sai",
            chiTiet: `Nghiệm thu ${vnd(nt.tienTruocThue)}, hoá đơn ${vnd(hd.tienTruocThue)} trước thuế.`,
          },
    );
  }
  if (hd?.ngay && nt?.ngay) {
    muc.push(
      nt.ngay <= hd.ngay
        ? { ten: "Thứ tự ngày", trangThai: "dat", chiTiet: `Nghiệm thu ${ngayDoc(nt.ngay)} trước hoá đơn ${ngayDoc(hd.ngay)}.` }
        : { ten: "Thứ tự ngày", trangThai: "can-xem", chiTiet: `Hoá đơn ${ngayDoc(hd.ngay)} lập trước nghiệm thu ${ngayDoc(nt.ngay)}.` },
    );
  }
  if (hdg?.soChungTu && nt?.canCu) {
    muc.push(
      boDauSo(nt.canCu).includes(boDauSo(hdg.soChungTu))
        ? { ten: "Nghiệm thu dẫn đúng hợp đồng", trangThai: "dat", chiTiet: hdg.soChungTu }
        : { ten: "Nghiệm thu dẫn đúng hợp đồng", trangThai: "can-xem", chiTiet: `Biên bản dẫn "${nt.canCu}", hợp đồng là số ${hdg.soChungTu}.` },
    );
  }
  return muc;
}

function boDauSo(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/\s/g, "");
}

/** Giá trị điền sẵn vào form "Gửi hoá đơn kèm PO và nghiệm thu" (`CreateInvoiceForm`). */
export type DienHoaDonNcc = {
  supplierId?: string;
  invoiceSeries?: string;
  invoiceNumber?: string;
  invoiceDate?: string;
  netVnd?: number;
  vatVnd?: number;
  totalVnd?: number;
  description?: string;
  contractReference?: string;
  acceptanceReference?: string;
  acceptedTotalVnd?: number;
};

export const KHOA_DIEN_HOA_DON = "nbj-dien-hoa-don-ncc";

export function dienHoaDonNcc(ds: readonly TrichXuat[], dsNcc: readonly SupplierApSupplier[]): { siteId?: string; dien: DienHoaDonNcc } {
  const hd = ds.find((t) => t.loai === "hoa-don");
  const nt = ds.find((t) => t.loai === "nghiem-thu");
  const hdg = ds.find((t) => t.loai === "hop-dong");
  const mst = (hd ?? nt ?? hdg)?.mstBenBan?.replace(/\D/g, "");
  const ncc = mst ? dsNcc.find((n) => n.taxCode.replace(/\D/g, "") === mst) : undefined;
  const hopDong = hdg?.soChungTu ?? nt?.canCu?.match(/s[oố]\s*([^\s,;]+)/iu)?.[1];
  const dien: DienHoaDonNcc = {
    ...(ncc ? { supplierId: ncc.id } : {}),
    ...(hd?.kyHieu ? { invoiceSeries: hd.kyHieu } : {}),
    ...(hd?.soChungTu ? { invoiceNumber: hd.soChungTu } : {}),
    ...(hd?.ngay ? { invoiceDate: hd.ngay } : {}),
    ...(hd?.tienTruocThue != null ? { netVnd: hd.tienTruocThue } : {}),
    ...(hd?.tienThue != null ? { vatVnd: hd.tienThue } : {}),
    ...(hd?.tongTien != null ? { totalVnd: hd.tongTien } : {}),
    ...(hd?.noiDung ?? nt?.noiDung ? { description: (hd?.noiDung ?? nt?.noiDung)!.slice(0, 500) } : {}),
    ...(hopDong ? { contractReference: hopDong.slice(0, 100) } : {}),
    ...(nt?.soChungTu ? { acceptanceReference: nt.soChungTu.slice(0, 100) } : {}),
    ...(nt?.tienTruocThue != null ? { acceptedTotalVnd: nt.tienTruocThue } : {}),
  };
  return { siteId: ncc?.siteId, dien };
}
