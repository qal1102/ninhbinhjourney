import { TRIP_PASSPORT_PLACE_IDS } from "@/domain/trip-passport";

/**
 * Hồ sơ khách: mỗi người một hồ sơ, tự điền theo những nơi họ thật sự vào.
 *
 * Chủ dự án muốn: vé phát ra là khách có một hồ sơ; đi tới đâu, quét cổng ở
 * đâu, hồ sơ tự ghi; đi đủ các vùng khác nhau của Ninh Bình thì có phần
 * thưởng nhỏ; và từ hồ sơ đặt tiếp được chuyến sau.
 *
 * Hàm thuần, không gọi mạng. Nguồn duy nhất là đơn và lượt quét cổng đã
 * được nhận (`erp_gate_scan_events.result = 'accepted'`). Chỉ bốn nơi có cổng
 * ghi nhận lượt vào mới tính được — cùng lý do với căn cước hành trình ở
 * `domain/trip-passport.ts`: hứa một điểm không bao giờ sáng là hứa suông.
 *
 * Phần thưởng là **ưu đãi minh hoạ của bản trình diễn**, đọc ra ở quầy; chưa
 * có cơ chế trừ tiền tự động.
 */

const TRANG_AN = TRIP_PASSPORT_PLACE_IDS[0];
const BAI_DINH = TRIP_PASSPORT_PLACE_IDS[1];
const TAM_COC = TRIP_PASSPORT_PLACE_IDS[2];
const TAM_CHUC = TRIP_PASSPORT_PLACE_IDS[3];

export type LuotVao = { siteId: string; scannedAt: string };

export type DonTrongHoSo = {
  orderCode: string;
  productName: string;
  visitDate: string;
  partySize: number;
  totalVnd: number;
  paymentLabel: string;
  tickets: Array<{ ticketCode: string; siteId: string; validOn: string; entriesAllowed: number; entriesUsed: number }>;
};

type DuLieuNhiemVu = { noiDaDen: Set<string>; soNgayDi: number };

type NhiemVuKhai = {
  id: string;
  ten: string;
  moTa: string;
  /** Tiến độ: đã được bao nhiêu trên bao nhiêu. */
  tienDo: (d: DuLieuNhiemVu) => { duoc: number; can: number };
  phanThuong: string;
  /** Hai chữ đầu mã ưu đãi, để nhân viên quầy nhìn là biết nhiệm vụ nào. */
  tienTo: string;
};

function dem(noi: Set<string>, can: readonly string[]) {
  return { duoc: can.filter((id) => noi.has(id)).length, can: can.length };
}

export const CAC_NHIEM_VU: readonly NhiemVuKhai[] = [
  {
    id: "buoc-dau",
    ten: "Bước chân đầu tiên",
    moTa: "Qua cổng ở bất kỳ điểm nào.",
    tienDo: (d) => ({ duoc: Math.min(d.noiDaDen.size, 1), can: 1 }),
    phanThuong: "Một ly trà sen ở quầy đón khách",
    tienTo: "BD",
  },
  {
    id: "hai-dong-nuoc",
    ten: "Hai dòng nước",
    moTa: "Ngồi thuyền ở cả Tràng An lẫn Tam Cốc.",
    tienDo: (d) => dem(d.noiDaDen, [TRANG_AN, TAM_COC]),
    phanThuong: "Giảm 5% cho lần đặt kế tiếp",
    tienTo: "HN",
  },
  {
    id: "hai-tieng-chuong",
    ten: "Hai tiếng chuông",
    moTa: "Lên chùa Bái Đính và Tam Chúc.",
    tienDo: (d) => dem(d.noiDaDen, [BAI_DINH, TAM_CHUC]),
    phanThuong: "Giảm 5% cho lần đặt kế tiếp",
    tienTo: "HC",
  },
  {
    id: "tron-bon-cua",
    ten: "Trọn bốn cửa",
    moTa: "Đi đủ Tràng An, Bái Đính, Tam Cốc và Tam Chúc.",
    tienDo: (d) => dem(d.noiDaDen, TRIP_PASSPORT_PLACE_IDS),
    phanThuong: "Giảm 15% chuyến sau và một bộ bưu thiếp Ninh Bình",
    tienTo: "BC",
  },
  {
    id: "quay-lai",
    ten: "Quay lại Ninh Bình",
    moTa: "Qua cổng vào hai ngày khác nhau.",
    tienDo: (d) => ({ duoc: Math.min(d.soNgayDi, 2), can: 2 }),
    phanThuong: "Giảm 10% cho lần đặt kế tiếp",
    tienTo: "QL",
  },
];

export type NhiemVu = {
  id: string;
  ten: string;
  moTa: string;
  duoc: number;
  can: number;
  xong: boolean;
  phanThuong: string;
  /** Chỉ có khi đã xong. */
  maUuDai: string | null;
};

export type HoSoKhach = {
  don: DonTrongHoSo[];
  noiDaDen: Array<{ siteId: string; lanDau: string; soLan: number }>;
  soNgayDi: number;
  nhiemVu: NhiemVu[];
  soNhiemVuXong: number;
};

function ngayViet(iso: string) {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: "Asia/Ho_Chi_Minh" });
}

/**
 * Mã ưu đãi cố định theo hồ sơ và nhiệm vụ: mở lại hồ sơ bao nhiêu lần vẫn ra
 * đúng một mã, không cần bảng lưu. Băm đơn giản là đủ, vì đây là mã minh hoạ
 * đọc ở quầy, không phải thứ đổi ra tiền tự động.
 */
export function maUuDai(khoaHoSo: string, tienTo: string) {
  let h = 2166136261;
  for (const ch of `${khoaHoSo}:${tienTo}`) {
    h ^= ch.codePointAt(0) ?? 0;
    h = Math.imul(h, 16777619) >>> 0;
  }
  return `NBJ-${tienTo}${h.toString(36).toUpperCase().padStart(6, "0").slice(-6)}`;
}

export function tinhHoSo(input: { khoaHoSo: string; don: DonTrongHoSo[]; luotVao: LuotVao[] }): HoSoKhach {
  const coCong = new Set<string>(TRIP_PASSPORT_PLACE_IDS);
  const theoNoi = new Map<string, { lanDau: string; soLan: number }>();
  const ngay = new Set<string>();
  for (const luot of [...input.luotVao].sort((a, b) => a.scannedAt.localeCompare(b.scannedAt))) {
    if (!coCong.has(luot.siteId)) continue;
    ngay.add(ngayViet(luot.scannedAt));
    const cu = theoNoi.get(luot.siteId);
    if (cu) cu.soLan += 1;
    else theoNoi.set(luot.siteId, { lanDau: luot.scannedAt, soLan: 1 });
  }
  const d: DuLieuNhiemVu = { noiDaDen: new Set(theoNoi.keys()), soNgayDi: ngay.size };
  const nhiemVu = CAC_NHIEM_VU.map((nv) => {
    const { duoc, can } = nv.tienDo(d);
    const xong = duoc >= can;
    return {
      id: nv.id,
      ten: nv.ten,
      moTa: nv.moTa,
      duoc,
      can,
      xong,
      phanThuong: nv.phanThuong,
      maUuDai: xong ? maUuDai(input.khoaHoSo, nv.tienTo) : null,
    };
  });
  return {
    don: input.don,
    noiDaDen: [...theoNoi.entries()].map(([siteId, v]) => ({ siteId, ...v })),
    soNgayDi: ngay.size,
    nhiemVu,
    soNhiemVuXong: nhiemVu.filter((nv) => nv.xong).length,
  };
}
