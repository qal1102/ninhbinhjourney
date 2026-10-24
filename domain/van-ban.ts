import type { ErpRole, ErpSiteId } from "@/domain/erp";

/**
 * Văn bản & hợp đồng (24/10/2026, chủ dự án: "AI đóng vai người gác cổng, check
 * văn bản có hợp lệ không rồi mới đưa lên hệ thống… file xuất ra luôn là PDF,
 * phải được mã hoá… chỉ file PDF mẫu đã tải xuống từ hệ thống mới được phép
 * tải lên").
 *
 * Mỗi mẫu có phần chữ cố định (điều khoản) và các ô. Ô của hệ thống (số văn
 * bản, cơ sở, số thuyền…) điền sẵn lúc phát hành, khoá lại; ô của đối tác để
 * trống cho người ký điền bằng trình đọc PDF. Khi tải lên, cổng soát ba lớp:
 *
 * 1. Kỹ thuật (máy chủ, `lib/van-ban`): đúng tệp hệ thống phát hành, chữ ký
 *    HMAC khớp, phần chữ cố định không bị sửa, chưa nộp lần nào.
 * 2. Luật (tệp này, `kiemKhongAi`): ô bắt buộc, khuôn số, ngày hợp lệ, rồi đối
 *    chiếu với dữ liệu có sẵn: sổ người chèo, danh mục nhà cung cấp, các văn
 *    bản đã nhận trước đó. Luật quyết định nhận hay trả.
 * 3. AI soát nghĩa: chỉ góp ý; thấy điều nghiêm trọng thì giữ lại chờ người
 *    duyệt, nhưng không bao giờ tự cho một văn bản qua cổng.
 */

export type LoaiVanBan = "hop-dong-nguoi-cheo" | "hop-dong-nha-cung-cap" | "bien-ban-nghiem-thu";

export const LOAI_VAN_BAN: readonly LoaiVanBan[] = ["hop-dong-nguoi-cheo", "hop-dong-nha-cung-cap", "bien-ban-nghiem-thu"];

export type KieuO = "chu" | "so" | "tien" | "ngay" | "chon" | "dien-thoai" | "cccd" | "mst" | "phan-tram";

export type OVanBan = {
  khoa: string;
  nhan: string;
  kieu: KieuO;
  batBuoc: boolean;
  /** `he-thong`: điền sẵn lúc phát hành và khoá; `doi-tac`: người ký điền. */
  ai: "he-thong" | "doi-tac";
  chon?: readonly string[];
  /** Ô chữ dài (nội dung) chiếm hai dòng trên bản PDF. */
  dai?: boolean;
};

export type DieuKhoan = { tieuDe: string; doan: readonly string[] };

export type MauVanBan = {
  loai: LoaiVanBan;
  ten: string;
  moTa: string;
  phienBan: number;
  /** Tiền tố số văn bản: HĐ-NC-2026-0001. */
  tienTo: string;
  tieuDe: string;
  dieuKhoan: readonly DieuKhoan[];
  o: readonly OVanBan[];
  benA: string;
  benB: string;
  /** Vai được phát hành mẫu và được nhận văn bản loại này vào hệ thống. */
  vaiPhatHanh: readonly ErpRole[];
};

export const BEN_PHAT_HANH = "Công ty CP Du lịch Ninh Bình Journey (pháp nhân mẫu)";

export const MAU_VAN_BAN: Record<LoaiVanBan, MauVanBan> = {
  "hop-dong-nguoi-cheo": {
    loai: "hop-dong-nguoi-cheo",
    ten: "Hợp đồng chèo đò",
    moTa: "Người chèo nhận thuyền ở bến Tràng An hay Tam Cốc. Nhận vào hệ thống thì sổ người chèo cập nhật loại hợp đồng và ngày hết hạn.",
    phienBan: 1,
    tienTo: "HĐ-NC",
    tieuDe: "HỢP ĐỒNG CHÈO ĐÒ CHỞ KHÁCH THAM QUAN",
    benA: BEN_PHAT_HANH,
    benB: "Người chèo đò",
    vaiPhatHanh: ["director", "manager"],
    o: [
      { khoa: "so_van_ban", nhan: "Số hợp đồng", kieu: "chu", batBuoc: true, ai: "he-thong" },
      { khoa: "co_so", nhan: "Bến", kieu: "chu", batBuoc: true, ai: "he-thong" },
      { khoa: "so_thuyen", nhan: "Thuyền số", kieu: "chu", batBuoc: true, ai: "he-thong" },
      { khoa: "ho_ten", nhan: "Họ và tên người chèo", kieu: "chu", batBuoc: true, ai: "doi-tac" },
      { khoa: "ngay_sinh", nhan: "Ngày sinh (dd/mm/yyyy)", kieu: "ngay", batBuoc: true, ai: "doi-tac" },
      { khoa: "so_cccd", nhan: "Số căn cước (12 số)", kieu: "cccd", batBuoc: true, ai: "doi-tac" },
      { khoa: "dia_chi", nhan: "Nơi ở", kieu: "chu", batBuoc: true, ai: "doi-tac", dai: true },
      { khoa: "so_dien_thoai", nhan: "Số điện thoại", kieu: "dien-thoai", batBuoc: true, ai: "doi-tac" },
      { khoa: "loai_hop_dong", nhan: "Loại hợp đồng", kieu: "chon", batBuoc: true, ai: "doi-tac", chon: ["Dài hạn", "Thời vụ"] },
      { khoa: "tu_ngay", nhan: "Làm từ ngày", kieu: "ngay", batBuoc: true, ai: "doi-tac" },
      { khoa: "den_ngay", nhan: "Đến ngày (thời vụ bắt buộc)", kieu: "ngay", batBuoc: false, ai: "doi-tac" },
      { khoa: "tien_cong", nhan: "Tiền công mỗi chuyến (đồng)", kieu: "tien", batBuoc: true, ai: "doi-tac" },
      { khoa: "ngay_ky", nhan: "Ngày ký", kieu: "ngay", batBuoc: true, ai: "doi-tac" },
    ],
    dieuKhoan: [
      {
        tieuDe: "Điều 1. Công việc",
        doan: [
          "Bên B nhận chèo thuyền được giao ở bến ghi trên, chở khách theo đúng tuyến khu du lịch công bố, nhận lượt theo hàng gọi xoay vòng của bến.",
          "Bên B mặc áo phao, nhắc khách mặc áo phao suốt chuyến, không chở quá số khách in trên thuyền.",
        ],
      },
      {
        tieuDe: "Điều 2. Tiền công và cách trả",
        doan: [
          "Tiền công tính theo chuyến đã về bến, mức ghi trên. Bên A trả vào ngày 05 hằng tháng cho số chuyến của tháng trước, theo số liệu chuyến trong hệ thống điều hành.",
          "Khách cho thêm là của Bên B. Bên B không đòi thêm tiền khách dưới bất cứ hình thức nào.",
        ],
      },
      {
        tieuDe: "Điều 3. Thời hạn",
        doan: [
          "Hợp đồng dài hạn có thể để trống ngày kết thúc. Hợp đồng thời vụ ghi rõ ngày kết thúc và theo quy định nội bộ không quá 12 tháng.",
          "Qua ngày kết thúc, Bên B ra khỏi hàng gọi lượt của bến cho tới khi ký hợp đồng mới.",
        ],
      },
      {
        tieuDe: "Điều 4. Giữ gìn di sản",
        doan: [
          "Bên B không xả rác, không để khách cho cá ăn, không cho thuyền vào hang khi bến báo nước cao. Vi phạm lần thứ hai Bên A được chấm dứt hợp đồng trước hạn.",
        ],
      },
    ],
  },
  "hop-dong-nha-cung-cap": {
    loai: "hop-dong-nha-cung-cap",
    ten: "Hợp đồng nhà cung cấp",
    moTa: "Hàng hoá hay dịch vụ mua của nhà cung cấp. Biên bản nghiệm thu về sau phải dẫn đúng số hợp đồng này và không vượt giá trị của nó.",
    phienBan: 1,
    tienTo: "HĐ-NCC",
    tieuDe: "HỢP ĐỒNG CUNG CẤP HÀNG HOÁ, DỊCH VỤ",
    benA: BEN_PHAT_HANH,
    benB: "Nhà cung cấp",
    vaiPhatHanh: ["director", "manager", "chief-accountant", "accountant"],
    o: [
      { khoa: "so_van_ban", nhan: "Số hợp đồng", kieu: "chu", batBuoc: true, ai: "he-thong" },
      { khoa: "co_so", nhan: "Cơ sở sử dụng", kieu: "chu", batBuoc: true, ai: "he-thong" },
      { khoa: "ten_ncc", nhan: "Tên nhà cung cấp", kieu: "chu", batBuoc: true, ai: "doi-tac", dai: true },
      { khoa: "mst_ncc", nhan: "Mã số thuế", kieu: "mst", batBuoc: true, ai: "doi-tac" },
      { khoa: "dia_chi_ncc", nhan: "Địa chỉ", kieu: "chu", batBuoc: true, ai: "doi-tac", dai: true },
      { khoa: "nguoi_dai_dien", nhan: "Người đại diện", kieu: "chu", batBuoc: true, ai: "doi-tac" },
      { khoa: "noi_dung", nhan: "Hàng hoá, dịch vụ cung cấp", kieu: "chu", batBuoc: true, ai: "doi-tac", dai: true },
      { khoa: "gia_tri", nhan: "Giá trị trước thuế (đồng)", kieu: "tien", batBuoc: true, ai: "doi-tac" },
      { khoa: "thue_suat", nhan: "Thuế suất GTGT (%)", kieu: "phan-tram", batBuoc: true, ai: "doi-tac" },
      { khoa: "tu_ngay", nhan: "Hiệu lực từ ngày", kieu: "ngay", batBuoc: true, ai: "doi-tac" },
      { khoa: "den_ngay", nhan: "Đến ngày", kieu: "ngay", batBuoc: true, ai: "doi-tac" },
      { khoa: "ngay_ky", nhan: "Ngày ký", kieu: "ngay", batBuoc: true, ai: "doi-tac" },
    ],
    dieuKhoan: [
      {
        tieuDe: "Điều 1. Hàng hoá, dịch vụ",
        doan: ["Bên B cung cấp cho Bên A đúng hàng hoá, dịch vụ ghi trên, đúng chất lượng hai bên đã thống nhất, giao tại cơ sở ghi trên."],
      },
      {
        tieuDe: "Điều 2. Giá trị và thanh toán",
        doan: [
          "Giá trị hợp đồng là giá trị trước thuế ghi trên, cộng thuế GTGT theo thuế suất ghi trên.",
          "Bên A thanh toán theo từng lần nghiệm thu, trong 30 ngày kể từ khi nhận hoá đơn hợp lệ. Tổng các lần nghiệm thu không vượt giá trị hợp đồng.",
        ],
      },
      {
        tieuDe: "Điều 3. Nghiệm thu",
        doan: ["Mỗi lần giao hàng hay hoàn thành dịch vụ, hai bên lập biên bản nghiệm thu dẫn số hợp đồng này. Biên bản không đạt thì chưa thanh toán."],
      },
      {
        tieuDe: "Điều 4. Hiệu lực",
        doan: ["Hợp đồng có hiệu lực trong khoảng ngày ghi trên. Bên nào muốn chấm dứt trước hạn báo bên kia bằng văn bản trước 30 ngày."],
      },
    ],
  },
  "bien-ban-nghiem-thu": {
    loai: "bien-ban-nghiem-thu",
    ten: "Biên bản nghiệm thu",
    moTa: "Phát hành từ một hợp đồng nhà cung cấp đã có trong hệ thống. Cổng đối chiếu ngày nghiệm thu với hiệu lực hợp đồng và cộng dồn giá trị đã nghiệm thu.",
    phienBan: 1,
    tienTo: "BB-NT",
    tieuDe: "BIÊN BẢN NGHIỆM THU",
    benA: BEN_PHAT_HANH,
    benB: "Nhà cung cấp",
    vaiPhatHanh: ["director", "manager", "chief-accountant", "accountant"],
    o: [
      { khoa: "so_van_ban", nhan: "Số biên bản", kieu: "chu", batBuoc: true, ai: "he-thong" },
      { khoa: "co_so", nhan: "Cơ sở", kieu: "chu", batBuoc: true, ai: "he-thong" },
      { khoa: "can_cu_hop_dong", nhan: "Căn cứ hợp đồng số", kieu: "chu", batBuoc: true, ai: "he-thong" },
      { khoa: "ten_ncc", nhan: "Nhà cung cấp", kieu: "chu", batBuoc: true, ai: "he-thong", dai: true },
      { khoa: "mst_ncc", nhan: "Mã số thuế", kieu: "mst", batBuoc: true, ai: "he-thong" },
      { khoa: "noi_dung", nhan: "Nội dung nghiệm thu", kieu: "chu", batBuoc: true, ai: "doi-tac", dai: true },
      { khoa: "gia_tri", nhan: "Giá trị nghiệm thu trước thuế (đồng)", kieu: "tien", batBuoc: true, ai: "doi-tac" },
      { khoa: "ngay_nghiem_thu", nhan: "Ngày nghiệm thu", kieu: "ngay", batBuoc: true, ai: "doi-tac" },
      { khoa: "ket_luan", nhan: "Kết luận", kieu: "chon", batBuoc: true, ai: "doi-tac", chon: ["Đạt", "Không đạt"] },
      { khoa: "dai_dien_a", nhan: "Đại diện Bên A", kieu: "chu", batBuoc: true, ai: "doi-tac" },
      { khoa: "dai_dien_b", nhan: "Đại diện Bên B", kieu: "chu", batBuoc: true, ai: "doi-tac" },
    ],
    dieuKhoan: [
      {
        tieuDe: "1. Thành phần",
        doan: ["Hai bên có tên trên cùng kiểm tra hàng hoá, dịch vụ đã giao theo hợp đồng dẫn ở trên."],
      },
      {
        tieuDe: "2. Kết quả",
        doan: [
          "Khối lượng và chất lượng như nội dung ghi trên. Kết luận Đạt thì Bên B được lập hoá đơn đúng giá trị nghiệm thu.",
          "Kết luận Không đạt thì Bên B sửa, giao lại và hai bên lập biên bản mới.",
        ],
      },
    ],
  },
};

export const TEN_CO_SO: Record<ErpSiteId, string> = {
  "trang-an": "Tràng An",
  "tam-coc": "Tam Cốc",
  "bai-dinh": "Bái Đính",
  "tam-chuc": "Tam Chúc",
};

export function vaiPhatHanhDuoc(loai: LoaiVanBan, vai: ErpRole) {
  return MAU_VAN_BAN[loai].vaiPhatHanh.includes(vai);
}

// ---------- Đọc giá trị ô ----------

/** "dd/mm/yyyy" → "yyyy-mm-dd"; sai ngày (31/02) thì null. */
export function docNgay(chu: string | undefined): string | null {
  const m = /^\s*(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})\s*$/.exec(chu ?? "");
  if (!m) return null;
  const [d, t, n] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const ngay = new Date(Date.UTC(n, t - 1, d));
  if (ngay.getUTCFullYear() !== n || ngay.getUTCMonth() !== t - 1 || ngay.getUTCDate() !== d) return null;
  return ngay.toISOString().slice(0, 10);
}

export function vietNgay(iso: string) {
  const [n, t, d] = iso.split("-");
  return `${d}/${t}/${n}`;
}

/** "180.000.000", "180,000,000 đ", "180000000" → 180000000. */
export function docTien(chu: string | undefined): number | null {
  const sach = (chu ?? "").replace(/(đồng|đ|vnd|VNĐ)/gi, "").replace(/[\s.,]/g, "");
  if (!/^\d{1,13}$/.test(sach)) return null;
  return Number(sach);
}

export function vietTien(so: number) {
  return `${new Intl.NumberFormat("vi-VN").format(so)} đ`;
}

export function chuanTen(chu: string) {
  return chu
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function soThang(tu: string, den: string) {
  const a = new Date(`${tu}T00:00:00Z`);
  const b = new Date(`${den}T00:00:00Z`);
  return (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth()) + (b.getUTCDate() >= a.getUTCDate() ? 0 : -1);
}

function tuoiVao(ngaySinh: string, ngay: string) {
  const s = new Date(`${ngaySinh}T00:00:00Z`);
  const d = new Date(`${ngay}T00:00:00Z`);
  let tuoi = d.getUTCFullYear() - s.getUTCFullYear();
  if (d.getUTCMonth() < s.getUTCMonth() || (d.getUTCMonth() === s.getUTCMonth() && d.getUTCDate() < s.getUTCDate())) tuoi -= 1;
  return tuoi;
}

// ---------- Soát không AI ----------

export type MucDo = "loi" | "canh-bao" | "dat";

export type PhatHien = {
  /** Khoá ô liên quan, hoặc tên chung ("doi-chieu"). */
  muc: string;
  mucDo: MucDo;
  noi: string;
  /** `luat`: soát chính văn bản; `doi-chieu`: so với dữ liệu có sẵn trong hệ thống. */
  nguon: "luat" | "doi-chieu";
};

/** Văn bản đã nhận vào hệ thống, dùng để đối chiếu văn bản mới. */
export type VanBanDaCo = {
  id: string;
  loai: LoaiVanBan;
  soVanBan: string;
  coSo: ErpSiteId | null;
  giaTri: Record<string, string>;
  ketQua: "nhan" | "cho-duyet";
  laMau: boolean;
};

export type NguCanhSoat = {
  /** "yyyy-mm-dd" theo giờ Việt Nam. */
  homNay: string;
  coSo: ErpSiteId | null;
  nguoiCheo: readonly { soThuyen: string; hoTen: string }[];
  /** `false` khi chưa đọc được sổ (máy không có kho): đối chiếu sổ bỏ qua, có ghi rõ. */
  coSoNguoiCheo: boolean;
  danhMucNcc: readonly { ten: string; mst: string; coSo: ErpSiteId }[];
  daCo: readonly VanBanDaCo[];
};

export function kiemKhongAi(loai: LoaiVanBan, giaTri: Record<string, string>, nc: NguCanhSoat): PhatHien[] {
  const mau = MAU_VAN_BAN[loai];
  const kq: PhatHien[] = [];
  const them = (muc: string, mucDo: MucDo, noi: string, nguon: PhatHien["nguon"] = "luat") => kq.push({ muc, mucDo, noi, nguon });
  const g = (k: string) => (giaTri[k] ?? "").trim();

  for (const o of mau.o) {
    const v = g(o.khoa);
    if (!v) {
      if (o.batBuoc) them(o.khoa, "loi", `Chưa điền "${o.nhan}".`);
      continue;
    }
    switch (o.kieu) {
      case "ngay":
        if (!docNgay(v)) them(o.khoa, "loi", `"${o.nhan}" ghi "${v}", không phải ngày hợp lệ (dd/mm/yyyy).`);
        break;
      case "tien": {
        const so = docTien(v);
        if (so === null || so <= 0) them(o.khoa, "loi", `"${o.nhan}" ghi "${v}", không đọc được thành số tiền.`);
        break;
      }
      case "cccd":
        if (!/^\d{12}$/.test(v.replace(/\s/g, ""))) them(o.khoa, "loi", `Số căn cước phải đủ 12 chữ số, đang ghi ${v.replace(/\D/g, "").length} số.`);
        break;
      case "dien-thoai":
        if (!/^0[35789]\d{8}$/.test(v.replace(/[\s.]/g, ""))) them(o.khoa, "loi", `Số điện thoại "${v}" không đúng dạng di động Việt Nam (10 số, đầu 03/05/07/08/09).`);
        break;
      case "mst":
        if (!/^\d{10}(-\d{3})?$/.test(v.replace(/\s/g, ""))) them(o.khoa, "loi", `Mã số thuế "${v}" phải là 10 số, hoặc 10 số kèm "-" và 3 số chi nhánh.`);
        break;
      case "phan-tram":
        if (!["0", "5", "8", "10"].includes(v.replace(/\s*%\s*$/, ""))) them(o.khoa, "loi", `Thuế suất "${v}" không thuộc các mức 0, 5, 8, 10%.`);
        break;
      case "chon":
        if (o.chon && !o.chon.some((c) => chuanTen(c) === chuanTen(v))) them(o.khoa, "loi", `"${o.nhan}" chỉ nhận ${o.chon.join(" hoặc ")}, đang ghi "${v}".`);
        break;
      case "chu":
        if (o.khoa === "ho_ten" && v.split(/\s+/).length < 2) them(o.khoa, "loi", "Họ tên phải có cả họ và tên.");
        break;
    }
  }

  const ngayKy = docNgay(g("ngay_ky"));
  if (ngayKy && ngayKy > nc.homNay) them("ngay_ky", "loi", `Ngày ký ${g("ngay_ky")} ở tương lai.`);

  if (loai === "hop-dong-nguoi-cheo") kiemNguoiCheo(giaTri, nc, them);
  if (loai === "hop-dong-nha-cung-cap") kiemNcc(giaTri, nc, them);
  if (loai === "bien-ban-nghiem-thu") kiemNghiemThu(giaTri, nc, them);

  if (!kq.some((p) => p.mucDo !== "dat")) them("chung", "dat", "Mọi ô bắt buộc đã điền, đúng khuôn, khớp dữ liệu hệ thống.");
  return kq;
}

type Them = (muc: string, mucDo: MucDo, noi: string, nguon?: PhatHien["nguon"]) => void;

function kiemNguoiCheo(giaTri: Record<string, string>, nc: NguCanhSoat, them: Them) {
  const g = (k: string) => (giaTri[k] ?? "").trim();
  const tu = docNgay(g("tu_ngay"));
  const den = docNgay(g("den_ngay"));
  const sinh = docNgay(g("ngay_sinh"));
  const thoiVu = chuanTen(g("loai_hop_dong")) === "thoi vu";

  if (thoiVu && !g("den_ngay")) them("den_ngay", "loi", "Hợp đồng thời vụ phải ghi ngày kết thúc.");
  if (tu && den && den < tu) them("den_ngay", "loi", `Ngày kết thúc ${g("den_ngay")} trước ngày bắt đầu ${g("tu_ngay")}.`);
  if (thoiVu && tu && den && den >= tu && soThang(tu, den) >= 12) {
    them("den_ngay", "loi", `Hợp đồng thời vụ dài ${soThang(tu, den)} tháng, quá 12 tháng theo Điều 3.`);
  }
  if (sinh && tu) {
    const tuoi = tuoiVao(sinh, tu);
    if (tuoi < 18) them("ngay_sinh", "loi", `Người chèo mới ${tuoi} tuổi vào ngày bắt đầu, chưa đủ 18.`);
    else if (tuoi > 65) them("ngay_sinh", "canh-bao", `Người chèo ${tuoi} tuổi vào ngày bắt đầu, nên khám sức khoẻ trước khi nhận thuyền.`);
  }
  const ngayKy = docNgay(g("ngay_ky"));
  if (ngayKy && tu && ngayKy > tu) them("ngay_ky", "canh-bao", "Ngày ký sau ngày bắt đầu làm: người chèo đã chèo khi chưa có hợp đồng.");
  const tien = docTien(g("tien_cong"));
  if (tien !== null && tien > 0 && (tien < 50_000 || tien > 1_500_000)) {
    them("tien_cong", "canh-bao", `Tiền công ${vietTien(tien)} mỗi chuyến nằm ngoài khoảng thường gặp 50.000–1.500.000 đ.`);
  }

  const soThuyen = g("so_thuyen").toUpperCase();
  const hoTen = g("ho_ten");
  if (nc.coSoNguoiCheo && soThuyen) {
    const trongSo = nc.nguoiCheo.find((n) => n.soThuyen.trim().toUpperCase() === soThuyen);
    if (!trongSo) them("so_thuyen", "canh-bao", `Thuyền số ${soThuyen} chưa có trong sổ người chèo; nhận vào sẽ thêm thuyền này vào sổ.`, "doi-chieu");
    else if (hoTen && chuanTen(trongSo.hoTen) !== chuanTen(hoTen)) {
      them("ho_ten", "loi", `Sổ người chèo ghi thuyền số ${soThuyen} là của ${trongSo.hoTen}, hợp đồng lại ghi ${hoTen}.`, "doi-chieu");
    } else if (hoTen) them("so_thuyen", "dat", `Thuyền số ${soThuyen} trong sổ đúng là của ${trongSo.hoTen}.`, "doi-chieu");
  } else if (!nc.coSoNguoiCheo) {
    them("so_thuyen", "canh-bao", "Chưa đọc được sổ người chèo nên chưa đối chiếu được tên với số thuyền.", "doi-chieu");
  }

  const cccd = g("so_cccd").replace(/\s/g, "");
  if (/^\d{12}$/.test(cccd)) {
    const trung = nc.daCo.find(
      (v) => v.loai === "hop-dong-nguoi-cheo" && (v.giaTri.so_cccd ?? "").replace(/\s/g, "") === cccd && chuanTen(v.giaTri.ho_ten ?? "") !== chuanTen(hoTen),
    );
    if (trung) them("so_cccd", "loi", `Số căn cước này đã đứng tên ${trung.giaTri.ho_ten} ở hợp đồng ${trung.soVanBan}.`, "doi-chieu");
  }
  if (tu && soThuyen) {
    const chong = nc.daCo.find((v) => {
      if (v.loai !== "hop-dong-nguoi-cheo" || v.coSo !== nc.coSo) return false;
      if ((v.giaTri.so_thuyen ?? "").trim().toUpperCase() !== soThuyen) return false;
      if (chuanTen(v.giaTri.ho_ten ?? "") === chuanTen(hoTen)) return false;
      const vTu = docNgay(v.giaTri.tu_ngay);
      const vDen = docNgay(v.giaTri.den_ngay);
      return Boolean(vTu && vTu <= (den ?? "9999-12-31") && (vDen ?? "9999-12-31") >= tu);
    });
    if (chong) them("tu_ngay", "loi", `Thuyền số ${soThuyen} đang có hợp đồng ${chong.soVanBan} của ${chong.giaTri.ho_ten} trùng khoảng ngày này.`, "doi-chieu");
  }
}

function kiemNcc(giaTri: Record<string, string>, nc: NguCanhSoat, them: Them) {
  const g = (k: string) => (giaTri[k] ?? "").trim();
  const tu = docNgay(g("tu_ngay"));
  const den = docNgay(g("den_ngay"));
  if (tu && den && den < tu) them("den_ngay", "loi", `Ngày hết hiệu lực ${g("den_ngay")} trước ngày bắt đầu ${g("tu_ngay")}.`);
  if (tu && den && den >= tu && soThang(tu, den) > 36) them("den_ngay", "canh-bao", `Hợp đồng kéo dài ${soThang(tu, den)} tháng, quá 3 năm: nên chia kỳ.`);
  if (g("noi_dung") && g("noi_dung").length < 12) them("noi_dung", "canh-bao", "Nội dung hàng hoá, dịch vụ quá ngắn để nghiệm thu về sau.");

  const mst = g("mst_ncc").replace(/\s/g, "");
  if (/^\d{10}(-\d{3})?$/.test(mst)) {
    const ncc = nc.danhMucNcc.find((n) => n.mst === mst);
    if (!ncc) them("mst_ncc", "canh-bao", `Mã số thuế ${mst} chưa có trong danh mục nhà cung cấp; cần lập hồ sơ nhà cung cấp trước lần thanh toán đầu.`, "doi-chieu");
    else if (g("ten_ncc") && chuanTen(ncc.ten) !== chuanTen(g("ten_ncc"))) {
      them("ten_ncc", "loi", `Danh mục ghi mã số thuế ${mst} là "${ncc.ten}", hợp đồng ghi "${g("ten_ncc")}".`, "doi-chieu");
    } else them("mst_ncc", "dat", `Nhà cung cấp có trong danh mục: ${ncc.ten}.`, "doi-chieu");

    const trung = nc.daCo.find((v) => {
      if (v.loai !== "hop-dong-nha-cung-cap" || (v.giaTri.mst_ncc ?? "").trim() !== mst) return false;
      return chuanTen(v.giaTri.noi_dung ?? "") === chuanTen(g("noi_dung")) && Boolean(g("noi_dung"));
    });
    if (trung) them("noi_dung", "canh-bao", `Đã có hợp đồng ${trung.soVanBan} cùng nhà cung cấp, cùng nội dung: xem có phải ký trùng không.`, "doi-chieu");
  }
}

function kiemNghiemThu(giaTri: Record<string, string>, nc: NguCanhSoat, them: Them) {
  const g = (k: string) => (giaTri[k] ?? "").trim();
  const soHd = g("can_cu_hop_dong");
  const hd = nc.daCo.find((v) => v.loai === "hop-dong-nha-cung-cap" && v.soVanBan === soHd && v.ketQua === "nhan");
  if (!hd) {
    them("can_cu_hop_dong", "loi", `Không thấy hợp đồng ${soHd || "(trống)"} trong các văn bản đã nhận vào hệ thống.`, "doi-chieu");
    return;
  }
  them("can_cu_hop_dong", "dat", `Hợp đồng ${hd.soVanBan} của ${hd.giaTri.ten_ncc} có trong hệ thống.`, "doi-chieu");
  if ((hd.giaTri.mst_ncc ?? "").trim() !== g("mst_ncc").replace(/\s/g, "")) {
    them("mst_ncc", "loi", `Mã số thuế khác hợp đồng ${hd.soVanBan} (${hd.giaTri.mst_ncc}).`, "doi-chieu");
  }
  const ngay = docNgay(g("ngay_nghiem_thu"));
  const tu = docNgay(hd.giaTri.tu_ngay);
  const den = docNgay(hd.giaTri.den_ngay);
  if (ngay && tu && ngay < tu) them("ngay_nghiem_thu", "loi", `Nghiệm thu ngày ${g("ngay_nghiem_thu")}, trước khi hợp đồng có hiệu lực (${hd.giaTri.tu_ngay}).`, "doi-chieu");
  if (ngay && den && ngay > den) them("ngay_nghiem_thu", "canh-bao", `Nghiệm thu sau ngày hợp đồng hết hiệu lực (${hd.giaTri.den_ngay}).`, "doi-chieu");
  if (ngay && ngay > nc.homNay) them("ngay_nghiem_thu", "loi", `Ngày nghiệm thu ${g("ngay_nghiem_thu")} ở tương lai.`);

  const giaTriHd = docTien(hd.giaTri.gia_tri) ?? 0;
  const daNghiemThu = nc.daCo
    .filter((v) => v.loai === "bien-ban-nghiem-thu" && v.giaTri.can_cu_hop_dong === soHd && chuanTen(v.giaTri.ket_luan ?? "") === "dat")
    .reduce((t, v) => t + (docTien(v.giaTri.gia_tri) ?? 0), 0);
  const lanNay = docTien(g("gia_tri"));
  if (lanNay !== null && lanNay > 0) {
    const conLai = giaTriHd - daNghiemThu;
    if (lanNay > conLai) {
      them(
        "gia_tri",
        "loi",
        `Hợp đồng ${vietTien(giaTriHd)}, đã nghiệm thu ${vietTien(daNghiemThu)}, chỉ còn ${vietTien(Math.max(conLai, 0))}; biên bản này ghi ${vietTien(lanNay)}.`,
        "doi-chieu",
      );
    } else {
      them("gia_tri", "dat", `Còn ${vietTien(conLai - lanNay)} chưa nghiệm thu sau biên bản này (hợp đồng ${vietTien(giaTriHd)}).`, "doi-chieu");
    }
  }
  if (chuanTen(g("ket_luan")) === "khong dat") {
    them("ket_luan", "canh-bao", "Kết luận Không đạt: nhận vào để lưu, nhưng không dùng biên bản này để thanh toán.");
  }
}

// ---------- Cổng kỹ thuật và quyết định ----------

export type BuocCong = { muc: string; dat: boolean; noi: string };

export type NhanXetAi = {
  trangThai: "co" | "khong-bat" | "loi";
  tomTat: string;
  diem: { muc: string; mucDo: "nghiem-trong" | "luu-y"; noi: string }[];
  moHinh?: string;
};

export type QuyetDinh = "nhan-duoc" | "cho-duyet" | "tra-lai";

/**
 * Luật quyết, AI chỉ giữ lại: cổng kỹ thuật trượt hay luật có lỗi thì trả;
 * AI thấy điều nghiêm trọng thì chờ người duyệt; còn lại nhận được.
 */
export function quyetDinh(cong: readonly BuocCong[], khongAi: readonly PhatHien[], ai: NhanXetAi | null): QuyetDinh {
  if (cong.some((b) => !b.dat)) return "tra-lai";
  if (khongAi.some((p) => p.mucDo === "loi")) return "tra-lai";
  if (ai?.trangThai === "co" && ai.diem.some((d) => d.mucDo === "nghiem-trong")) return "cho-duyet";
  return "nhan-duoc";
}

/** Vai nhận văn bản vào hệ thống và duyệt văn bản AI giữ lại. */
export function vaiDuyetDuoc(loai: LoaiVanBan, vai: ErpRole) {
  return vaiPhatHanhDuoc(loai, vai);
}

// ---------- Bản điền thử ----------

export type KieuBanThu = "trong" | "dien-dung" | "dien-sai" | "bi-sua";

export const TEN_KIEU_BAN: Record<KieuBanThu, string> = {
  trong: "Mẫu trống để đối tác điền",
  "dien-dung": "Bản đã điền đúng (để thử)",
  "dien-sai": "Bản điền sai vài chỗ (để thử)",
  "bi-sua": "Bản bị sửa điều khoản (để thử)",
};

/**
 * Giá trị đối tác điền, dựng sẵn cho bản thử. Người chấm không cần mở trình
 * soạn PDF vẫn đi được trọn đường: tải về, nộp lại, thấy cổng nhận hay trả.
 */
export function giaTriThu(
  loai: LoaiVanBan,
  kieu: Exclude<KieuBanThu, "trong">,
  ctx: { homNay: string; heThong: Record<string, string>; hoTenTrongSo?: string | null; giaTriHopDong?: number | null; noiDungHopDong?: string | null },
): Record<string, string> {
  const homNay = ctx.homNay;
  const lui = (ngay: number) => vietNgay(new Date(Date.parse(`${homNay}T00:00:00Z`) - ngay * 86_400_000).toISOString().slice(0, 10));
  const toi = (ngay: number) => vietNgay(new Date(Date.parse(`${homNay}T00:00:00Z`) + ngay * 86_400_000).toISOString().slice(0, 10));
  const sai = kieu === "dien-sai";
  // Hợp đồng nhà cung cấp mẫu: hiệu lực từ đầu tháng sau tới hết tháng ấy năm sau, như hợp đồng thật hay ghi.
  const [nam, thang] = homNay.split("-").map(Number);
  const dauThangSau = vietNgay(new Date(Date.UTC(nam, thang, 1)).toISOString().slice(0, 10));
  const cuoiThangNamSau = vietNgay(new Date(Date.UTC(nam + 1, thang, 0)).toISOString().slice(0, 10));
  if (loai === "hop-dong-nguoi-cheo") {
    return {
      ho_ten: sai ? "Trần Văn Mạnh" : (ctx.hoTenTrongSo ?? "Phạm Văn Hoà"),
      ngay_sinh: "14/03/1986",
      so_cccd: sai ? "03708600123" : "037086001234",
      dia_chi: "Thôn Đam Khê, xã Trường Yên, tỉnh Ninh Bình",
      so_dien_thoai: sai ? "0123 456 789" : "0912 000 111",
      loai_hop_dong: "Thời vụ",
      tu_ngay: lui(3),
      den_ngay: sai ? lui(10) : toi(150),
      tien_cong: "180.000",
      ngay_ky: lui(5),
    };
  }
  if (loai === "hop-dong-nha-cung-cap") {
    return {
      ten_ncc: "Công ty Dịch vụ Tràng An Xanh",
      mst_ncc: sai ? "27001234" : "2700123456",
      dia_chi_ncc: "Số 18 đường Tràng An, phường Hoa Lư, tỉnh Ninh Bình",
      nguoi_dai_dien: "Bùi Thị Hạnh",
      noi_dung: "Thu gom rác trên sông và vệ sinh bến thuyền Tràng An, hai lượt mỗi ngày",
      gia_tri: "96.000.000",
      thue_suat: sai ? "12" : "8",
      tu_ngay: dauThangSau,
      den_ngay: sai ? lui(30) : cuoiThangNamSau,
      ngay_ky: lui(1),
    };
  }
  const giaTriHd = ctx.giaTriHopDong ?? 0;
  // Bản đúng nghiệm thu đúng một tháng của hợp đồng mười hai tháng, làm tròn nghìn.
  const motThang = Math.max(1_000_000, Math.round(giaTriHd / 12 / 1000) * 1000);
  return {
    noi_dung: `${(ctx.noiDungHopDong ?? "Hàng hoá, dịch vụ theo hợp đồng").replace(/[.,;]\s*$/, "")}: phần việc tháng ${thang}/${nam}`,
    gia_tri: new Intl.NumberFormat("vi-VN").format(sai ? giaTriHd + 25_000_000 : motThang),
    ngay_nghiem_thu: sai ? toi(4) : lui(1),
    ket_luan: "Đạt",
    dai_dien_a: "Nguyễn Thị Thu Trang",
    dai_dien_b: sai ? "" : "Bùi Thị Hạnh",
  };
}

/** Câu điều khoản bị đổi ở bản thử "bị sửa": đổi hạn trả tiền, mức người chấm dễ nhận ra. */
export const SUA_DIEU_KHOAN: Record<LoaiVanBan, { cu: string; moi: string }> = {
  "hop-dong-nguoi-cheo": { cu: "Bên A trả vào ngày 05 hằng tháng", moi: "Bên A trả vào ngày 25 hằng tháng" },
  "hop-dong-nha-cung-cap": { cu: "trong 30 ngày kể từ khi nhận hoá đơn hợp lệ", moi: "trong 3 ngày kể từ khi nhận hoá đơn hợp lệ" },
  "bien-ban-nghiem-thu": { cu: "Bên B được lập hoá đơn đúng giá trị nghiệm thu", moi: "Bên B được lập hoá đơn gấp đôi giá trị nghiệm thu" },
};
