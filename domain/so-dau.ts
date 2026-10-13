/**
 * Sổ dấu (13/10/2026): khách đóng dấu bằng cách quét mã QR dán ở từng điểm,
 * cả Cố đô Hoa Lư vốn không bán vé, và một dấu cho lời hứa giữ di sản Tràng
 * An. Không cần đăng nhập, không gửi gì về máy chủ: dấu nằm trong bộ nhớ của
 * trình duyệt. Chỗ còn thiếu dấu thì trang mời mua vé điểm ấy, nên sổ dấu là
 * một lối dẫn khách từ điểm này sang điểm khác mà không thu dữ liệu nào.
 *
 * `khoa` chỉ để mã trên tấm dán không đoán được bằng cách gõ tên điểm; nó
 * không phải bảo mật (ai chụp tấm dán cũng có). Vì thế dấu ở đây không đổi
 * ra quà; quà thật vẫn tính theo lượt qua cổng của vé đã gắn số.
 */

export type MaDau = "trang-an" | "tam-coc" | "tam-chuc" | "bai-dinh" | "hoa-lu" | "loi-hua";

export type Dau = {
  ma: MaDau;
  /** Đuôi trong đường dẫn `/dau/<ma>-<khoa>`; `null` là dấu không đóng bằng QR. */
  khoa: string | null;
  ten: { vi: string; en: string };
  /** Chữ trên mặt dấu, viết hoa, ngắn. */
  chuDau: string;
  /** Vé lẻ bán điểm này (mời mua khi còn thiếu dấu); điểm không bán vé thì `null`. */
  veSlug: string | null;
  /** Trang điểm đến để xem trước. */
  diemDen: string | null;
};

export const SO_DAU: readonly Dau[] = [
  { ma: "trang-an", khoa: "t7a", ten: { vi: "Tràng An", en: "Trang An" }, chuDau: "TRÀNG AN", veSlug: "ve-trang-an", diemDen: "trang-an" },
  { ma: "tam-coc", khoa: "c4n", ten: { vi: "Tam Cốc – Bích Động", en: "Tam Coc – Bich Dong" }, chuDau: "TAM CỐC", veSlug: "ve-tam-coc", diemDen: "tam-coc-bich-dong" },
  { ma: "bai-dinh", khoa: "d9b", ten: { vi: "Chùa Bái Đính", en: "Bai Dinh Pagoda" }, chuDau: "BÁI ĐÍNH", veSlug: "ve-bai-dinh", diemDen: "bai-dinh" },
  { ma: "tam-chuc", khoa: "h2m", ten: { vi: "Tam Chúc", en: "Tam Chuc" }, chuDau: "TAM CHÚC", veSlug: "ve-tam-chuc", diemDen: "tam-chuc" },
  { ma: "hoa-lu", khoa: "l5h", ten: { vi: "Cố đô Hoa Lư", en: "Hoa Lu Ancient Capital" }, chuDau: "HOA LƯ", veSlug: null, diemDen: "hoa-lu-ancient-capital" },
  { ma: "loi-hua", khoa: null, ten: { vi: "Lời hứa giữ di sản", en: "Heritage promise" }, chuDau: "LỜI HỨA", veSlug: null, diemDen: null },
];

/** Khoá bộ nhớ trình duyệt; đổi cấu trúc thì tăng số. */
export const KHOA_LUU_SO_DAU = "nbj-so-dau-v1";

export type SoDau = Partial<Record<MaDau, string>>;

const CAC_MA = new Set<string>(SO_DAU.map((d) => d.ma));

export function dauTheoMa(ma: string): Dau | undefined {
  return SO_DAU.find((d) => d.ma === ma);
}

/** `hoa-lu-l5h` → dấu Hoa Lư; sai khoá hay sai tên thì `undefined`. */
export function dauTuDuongDan(tham: string): Dau | undefined {
  const chuan = decodeURIComponent(tham).trim().toLowerCase();
  return SO_DAU.find((d) => d.khoa !== null && chuan === `${d.ma}-${d.khoa}`);
}

/** Đường dẫn in trên tấm dán QR của một điểm. */
export function duongDanDau(goc: string, dau: Dau): string | null {
  return dau.khoa ? `${goc.replace(/\/$/, "")}/dau/${dau.ma}-${dau.khoa}` : null;
}

/** Đọc sổ dấu đã lưu; hỏng hay lạ thì coi như sổ trống. */
export function docSoDau(raw: string | null | undefined): SoDau {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const so: SoDau = {};
    for (const [ma, ngay] of Object.entries(parsed as Record<string, unknown>)) {
      if (CAC_MA.has(ma) && typeof ngay === "string" && /^\d{4}-\d{2}-\d{2}/.test(ngay)) so[ma as MaDau] = ngay;
    }
    return so;
  } catch {
    return {};
  }
}

/** Thêm một dấu; đã có thì giữ ngày đóng lần đầu. */
export function themDau(so: SoDau, ma: MaDau, ngayIso: string): { so: SoDau; moi: boolean } {
  if (so[ma]) return { so, moi: false };
  return { so: { ...so, [ma]: ngayIso }, moi: true };
}

/** Điểm bán vé chưa có dấu: lối mời mua vé tiếp. */
export function diemConThieu(so: SoDau): Dau[] {
  return SO_DAU.filter((d) => d.veSlug && !so[d.ma]);
}

export function soDauDaCo(so: SoDau): number {
  return SO_DAU.filter((d) => so[d.ma]).length;
}

/** Năm lời hứa giữ di sản Tràng An (di sản thế giới hỗn hợp UNESCO 2014). */
export const LOI_HUA: readonly { vi: string; en: string }[] = [
  { vi: "Không thả rác, vỏ chai, túi ni lông xuống sông và hang.", en: "No litter, bottles or plastic bags in the river or caves." },
  { vi: "Mặc áo phao suốt chuyến thuyền, ngồi yên khi qua hang thấp.", en: "Wear the life jacket for the whole boat trip and stay seated in low caves." },
  { vi: "Giữ yên lặng ở đền, phủ; không leo lên tượng, bia đá.", en: "Keep quiet at temples; do not climb statues or stone steles." },
  { vi: "Không bẻ cành, hái lá, nhặt đá hay thả cá lạ xuống sông.", en: "Do not break branches, pick leaves, take stones or release fish." },
  { vi: "Trả công người chèo đúng giá niêm yết, tiền boa tuỳ lòng.", en: "Pay rowers the posted fare; tips are your choice." },
];
