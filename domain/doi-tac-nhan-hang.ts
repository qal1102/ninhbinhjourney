/**
 * Sổ liên hệ nhãn hàng đối tác.
 *
 * ## Nó trả lời câu hỏi nào
 *
 * Chủ dự án hỏi: *"cái liên hệ các nhãn hàng hợp tác campaign và tất cả các
 * thứ sẽ có trong tương lai"*. Một danh bạ thuần tuý — tên, số điện thoại —
 * thì sổ tay giấy làm được rồi, chẳng cần một màn hình.
 *
 * Nên sổ này phải trả lời được đúng một câu mà sổ tay không trả lời được:
 * **hôm nay nên gọi lại cho ai.** Mọi trường dữ liệu ở đây đều phục vụ câu ấy;
 * trường nào không phục vụ nó thì không có mặt.
 *
 * ## Vì sao nguội đi mới là chuyện đáng báo
 *
 * Hợp tác nhãn hàng chết không phải vì bị từ chối, mà vì **im lặng**: gọi một
 * lần, hẹn "để bàn thêm", rồi ba tháng sau không ai nhớ. Vậy nên mỗi dòng
 * mang theo ngày trao đổi gần nhất, và sổ tự đẩy những mối đã nguội lên đầu.
 *
 * ## Không có tên nhãn hàng nào nằm trong mã nguồn
 *
 * Tên đối tác là **dữ liệu người dùng nhập**, không phải hằng số. Đây là ranh
 * giới đã có sẵn của dự án (xem `tests/security/no-third-party-brands.test.ts`)
 * và tệp này không được phá: không danh sách mẫu, không dữ liệu gieo sẵn.
 */

export const CAC_GIAI_DOAN = [
  "nham-truoc",
  "da-lien-he",
  "dang-ban",
  "da-chot",
  "khep-lai",
] as const;

export type GiaiDoanDoiTac = (typeof CAC_GIAI_DOAN)[number];

export type DoiTacNhanHang = {
  id: string;
  ten: string;
  nganhHang: string;
  nguoiBenHo: string;
  cachLienHe: string;
  nguoiPhuTrach: string;
  giaiDoan: GiaiDoanDoiTac;
  /** Mã dịp trong `domain/lich-mua-vu.ts`, hoặc rỗng nếu chưa nhắm dịp nào. */
  dipNhamToi: string;
  /** Ngày trao đổi gần nhất, dạng `YYYY-MM-DD`; rỗng là chưa gọi lần nào. */
  lanTraoDoiCuoi: string;
  ghiChu: string;
  capNhatLuc: string;
};

type MoTaGiaiDoan = {
  ten: string;
  /** Một câu nói rõ việc tiếp theo phải làm, không phải định nghĩa lại cái tên. */
  viecTiepTheo: string;
  /** Giai đoạn còn sống thì mới có chuyện "nguội". */
  conSong: boolean;
  /** Bao nhiêu ngày im lặng thì coi là nguội. */
  soNgayNguoi: number;
};

export const MO_TA_GIAI_DOAN: Record<GiaiDoanDoiTac, MoTaGiaiDoan> = {
  "nham-truoc": {
    ten: "Mới nhắm",
    viecTiepTheo: "Chưa ai gọi. Tìm đúng người phụ trách trước khi gửi gì.",
    conSong: true,
    soNgayNguoi: 14,
  },
  "da-lien-he": {
    ten: "Đã gọi, chờ hồi âm",
    viecTiepTheo: "Đã chạm được. Nhắc lại một lượt nếu quá hai tuần chưa thấy trả lời.",
    conSong: true,
    soNgayNguoi: 14,
  },
  "dang-ban": {
    ten: "Đang bàn cụ thể",
    viecTiepTheo: "Đang nóng. Chốt cho được phạm vi và ngày, đừng để nguội.",
    conSong: true,
    soNgayNguoi: 7,
  },
  "da-chot": {
    ten: "Đã chốt",
    viecTiepTheo: "Đã có hợp tác. Giữ liên lạc để còn lần sau.",
    conSong: true,
    soNgayNguoi: 60,
  },
  "khep-lai": {
    ten: "Khép lại",
    viecTiepTheo: "Lần này không đi tiếp. Ghi lý do để sang mùa khác còn biết đường.",
    conSong: false,
    soNgayNguoi: Number.POSITIVE_INFINITY,
  },
};

export function laGiaiDoan(gia: unknown): gia is GiaiDoanDoiTac {
  return typeof gia === "string" && (CAC_GIAI_DOAN as readonly string[]).includes(gia);
}

/** Số ngày giữa hai ngày lịch, tính theo múi giờ Việt Nam. */
function ngayVN(luc: Date) {
  const day = new Date(luc.getTime() + 7 * 3600 * 1000);
  return Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate());
}

function moc(iso: string) {
  const [nam, thang, ngay] = iso.split("-").map(Number);
  return Date.UTC(nam, (thang ?? 1) - 1, ngay ?? 1);
}

/**
 * Bao nhiêu ngày kể từ lần trao đổi gần nhất. `null` khi chưa trao đổi lần nào
 * — khác hẳn với "vừa trao đổi hôm nay", nên không được trả về 0.
 */
export function soNgayImLang(bayGio: Date, doiTac: DoiTacNhanHang): number | null {
  if (!doiTac.lanTraoDoiCuoi) return null;
  const cach = ngayVN(bayGio) - moc(doiTac.lanTraoDoiCuoi);
  return Math.max(0, Math.round(cach / 86_400_000));
}

/** Mối này đã nguội chưa — tức có đáng gọi lại hôm nay không. */
export function daNguoi(bayGio: Date, doiTac: DoiTacNhanHang): boolean {
  const mo = MO_TA_GIAI_DOAN[doiTac.giaiDoan];
  if (!mo.conSong) return false;
  const im = soNgayImLang(bayGio, doiTac);
  // Chưa gọi lần nào thì luôn là việc phải làm — đó là lý do dòng ấy có mặt
  // trong sổ.
  if (im === null) return true;
  return im >= mo.soNgayNguoi;
}

/** Câu ngắn nói lần trao đổi gần nhất cách đây bao lâu. */
export function loiImLang(bayGio: Date, doiTac: DoiTacNhanHang): string {
  const im = soNgayImLang(bayGio, doiTac);
  if (im === null) return "chưa trao đổi lần nào";
  if (im === 0) return "trao đổi hôm nay";
  if (im === 1) return "trao đổi hôm qua";
  return `im lặng ${im} ngày`;
}

const THU_TU_GIAI_DOAN: Record<GiaiDoanDoiTac, number> = {
  "dang-ban": 0,
  "da-lien-he": 1,
  "nham-truoc": 2,
  "da-chot": 3,
  "khep-lai": 4,
};

/**
 * Xếp sổ theo đúng thứ tự nên nhìn: việc phải làm hôm nay lên trước, rồi tới
 * giai đoạn nóng hơn, rồi tới mối im lâu hơn. Xếp theo tên thì đẹp mắt nhưng
 * không nói được gì — và tên nhãn hàng thì chẳng ai cần tra theo vần.
 */
export function xepSoDoiTac(
  bayGio: Date,
  danhSach: readonly DoiTacNhanHang[],
): DoiTacNhanHang[] {
  return [...danhSach].sort((a, b) => {
    const nguoiA = daNguoi(bayGio, a) ? 0 : 1;
    const nguoiB = daNguoi(bayGio, b) ? 0 : 1;
    if (nguoiA !== nguoiB) return nguoiA - nguoiB;
    const gdA = THU_TU_GIAI_DOAN[a.giaiDoan];
    const gdB = THU_TU_GIAI_DOAN[b.giaiDoan];
    if (gdA !== gdB) return gdA - gdB;
    const imA = soNgayImLang(bayGio, a);
    const imB = soNgayImLang(bayGio, b);
    if (imA === null && imB !== null) return -1;
    if (imB === null && imA !== null) return 1;
    if (imA !== null && imB !== null && imA !== imB) return imB - imA;
    return a.ten.localeCompare(b.ten, "vi");
  });
}

/** Bao nhiêu mối đang chờ mình gọi lại. */
export function demViecPhaiLam(bayGio: Date, danhSach: readonly DoiTacNhanHang[]): number {
  return danhSach.filter((d) => daNguoi(bayGio, d)).length;
}

function chu(gia: unknown, toiDa: number): string {
  if (typeof gia !== "string") return "";
  return gia.trim().slice(0, toiDa);
}

/**
 * Dựng một dòng từ dữ liệu kho trả về.
 *
 * Cố ý **chịu được dữ liệu thiếu**: một trường rỗng chỉ làm dòng ấy bớt thông
 * tin, chứ không được làm vỡ cả màn hình đang mở.
 */
export function doiTacFrom(hang: unknown): DoiTacNhanHang | null {
  if (typeof hang !== "object" || hang === null) return null;
  const o = hang as Record<string, unknown>;
  const id = chu(o.id, 64);
  const ten = chu(o.ten, 160);
  if (!id || !ten) return null;
  return {
    id,
    ten,
    nganhHang: chu(o.nganh_hang ?? o.nganhHang, 80),
    nguoiBenHo: chu(o.nguoi_ben_ho ?? o.nguoiBenHo, 120),
    cachLienHe: chu(o.cach_lien_he ?? o.cachLienHe, 200),
    nguoiPhuTrach: chu(o.nguoi_phu_trach ?? o.nguoiPhuTrach, 120),
    giaiDoan: laGiaiDoan(o.giai_doan ?? o.giaiDoan)
      ? ((o.giai_doan ?? o.giaiDoan) as GiaiDoanDoiTac)
      : "nham-truoc",
    dipNhamToi: chu(o.dip_nham_toi ?? o.dipNhamToi, 60),
    lanTraoDoiCuoi: chu(o.lan_trao_doi_cuoi ?? o.lanTraoDoiCuoi, 10),
    ghiChu: chu(o.ghi_chu ?? o.ghiChu, 1000),
    capNhatLuc: chu(o.cap_nhat_luc ?? o.capNhatLuc, 40),
  };
}

export function soDoiTacFrom(du: unknown): DoiTacNhanHang[] {
  if (!Array.isArray(du)) return [];
  return du.map(doiTacFrom).filter((d): d is DoiTacNhanHang => d !== null);
}
