/**
 * Khách thích gì (13/10/2026, migration 126): đọc số gộp từ quầy, web và
 * cổng, rồi rút ra vài điều giám đốc làm được ngay. Chỉ số gộp, không ai bị
 * nhận ra; ô dưới `SO_TOI_THIEU` lượt ghi "dưới 5" thay vì con số.
 */

export const SO_TOI_THIEU = 5;

export type LoaiNhom = "gia-dinh-co-tre" | "mot-minh" | "hai-nguoi" | "nhom-ban";

export const TEN_LOAI_NHOM: Record<LoaiNhom, string> = {
  "gia-dinh-co-tre": "Gia đình có trẻ em",
  "hai-nguoi": "Hai người",
  "nhom-ban": "Nhóm từ ba người lớn",
  "mot-minh": "Đi một mình",
};

export type MucDatTruoc = "trong-ngay" | "1-3-ngay" | "4-7-ngay" | "tren-7-ngay";

export const TEN_DAT_TRUOC: Record<MucDatTruoc, string> = {
  "trong-ngay": "Trong ngày",
  "1-3-ngay": "1–3 ngày",
  "4-7-ngay": "4–7 ngày",
  "tren-7-ngay": "Trên 7 ngày",
};

export type GioCoSo = {
  siteId: string;
  ten: string;
  tong: number;
  theoGio: Record<number, number>;
  /** Giờ đông nhất và vắng nhất trong 7–16 giờ (giờ mở cửa chính). */
  gioDong: number | null;
  gioVang: number | null;
};

export type KhachThichGi = {
  tu: string;
  den: string;
  soNgay: number;
  nhom: { loai: LoaiNhom; luot: number; khach: number; phanTram: number }[];
  luotMua: number;
  luotWeb: number;
  nguoiLon: number;
  treEm: number;
  goi: { slug: string; ten: string; don: number; khach: number; treEm: number; tien: number }[];
  datTruoc: { muc: MucDatTruoc; so: number; phanTram: number }[];
  gio: GioCoSo[];
  /** Thứ trong tuần theo ISO (1 = thứ Hai … 7 = Chủ nhật) → lượt qua cổng. */
  thu: Record<number, number>;
  hoSoWeb: number;
  hoSoTuHaiDon: number;
  kenh: { daiLy: number; maMoi: number; web: number };
};

function so(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function chu(value: unknown) {
  return typeof value === "string" ? value : "";
}

function phanTram(phan: number, tong: number) {
  return tong > 0 ? Math.round((phan / tong) * 100) : 0;
}

const LOAI: readonly LoaiNhom[] = ["gia-dinh-co-tre", "hai-nguoi", "nhom-ban", "mot-minh"];
const MUC: readonly MucDatTruoc[] = ["trong-ngay", "1-3-ngay", "4-7-ngay", "tren-7-ngay"];

function gioCucTri(theoGio: Record<number, number>) {
  const trong = Object.entries(theoGio)
    .map(([gio, luot]) => [Number(gio), luot] as const)
    .filter(([gio]) => gio >= 7 && gio <= 16);
  if (trong.length === 0) return { gioDong: null, gioVang: null };
  const dong = trong.reduce((a, b) => (b[1] > a[1] ? b : a));
  const vang = trong.reduce((a, b) => (b[1] < a[1] ? b : a));
  return { gioDong: dong[0], gioVang: vang[0] };
}

/** Đọc kết quả `erp_khach_thich_gi`. */
export function docKhachThichGi(raw: unknown): KhachThichGi {
  const r = (raw ?? {}) as Record<string, unknown>;
  const khach = (r.khach ?? {}) as Record<string, unknown>;
  const nhomTho = Array.isArray(r.nhom_khach) ? (r.nhom_khach as Record<string, unknown>[]) : [];
  const luotMua = so(khach.luot_mua);
  const nhom = LOAI.map((loai) => {
    const dong = nhomTho.filter((d) => d.loai === loai);
    const luot = dong.reduce((c, d) => c + so(d.luot), 0);
    const k = dong.reduce((c, d) => c + so(d.khach), 0);
    return { loai, luot, khach: k, phanTram: phanTram(luot, luotMua) };
  });
  const datTho = (r.dat_truoc ?? {}) as Record<string, unknown>;
  const tongDat = MUC.reduce((c, m) => c + so(datTho[m]), 0);
  const datTruoc = MUC.map((muc) => ({ muc, so: so(datTho[muc]), phanTram: phanTram(so(datTho[muc]), tongDat) }));
  const gio = (Array.isArray(r.gio) ? (r.gio as Record<string, unknown>[]) : []).map((g) => {
    const theoGioTho = (g.theo_gio ?? {}) as Record<string, unknown>;
    const theoGio: Record<number, number> = {};
    for (const [k, v] of Object.entries(theoGioTho)) theoGio[Number(k)] = so(v);
    return { siteId: chu(g.site_id), ten: chu(g.ten), tong: so(g.tong), theoGio, ...gioCucTri(theoGio) };
  });
  const thuTho = (r.thu ?? {}) as Record<string, unknown>;
  const thu: Record<number, number> = {};
  for (let i = 1; i <= 7; i += 1) thu[i] = so(thuTho[String(i)]);
  const quayLai = (r.quay_lai ?? {}) as Record<string, unknown>;
  const kenh = (r.kenh ?? {}) as Record<string, unknown>;
  return {
    tu: chu(r.tu),
    den: chu(r.den),
    soNgay: Math.max(1, so(r.so_ngay)),
    nhom,
    luotMua,
    luotWeb: so(khach.luot_web),
    nguoiLon: so(khach.nguoi_lon),
    treEm: so(khach.tre_em),
    goi: (Array.isArray(r.goi) ? (r.goi as Record<string, unknown>[]) : []).map((g) => ({
      slug: chu(g.slug),
      ten: chu(g.ten),
      don: so(g.don),
      khach: so(g.khach),
      treEm: so(g.tre_em),
      tien: so(g.tien),
    })),
    datTruoc,
    gio,
    thu,
    hoSoWeb: so(quayLai.ho_so),
    hoSoTuHaiDon: so(quayLai.tu_hai_don),
    kenh: { daiLy: so(kenh.dai_ly), maMoi: so(kenh.ma_moi), web: so(kenh.web) },
  };
}

/** Số đủ lớn để nói ra; dưới 5 lượt thì không nêu con số. */
export function soHienThi(n: number): string {
  return n < SO_TOI_THIEU ? "dưới 5" : n.toLocaleString("vi-VN");
}

const TEN_THU: Record<number, string> = { 1: "Thứ Hai", 2: "Thứ Ba", 3: "Thứ Tư", 4: "Thứ Năm", 5: "Thứ Sáu", 6: "Thứ Bảy", 7: "Chủ nhật" };

export function tenThu(isoDow: number) {
  return TEN_THU[isoDow] ?? "";
}

/** Cuối tuần đông gấp mấy lần một ngày thường (trung bình mỗi ngày). */
export function heSoCuoiTuan(thu: Record<number, number>): number | null {
  const thuong = [1, 2, 3, 4, 5].reduce((c, i) => c + (thu[i] ?? 0), 0) / 5;
  const cuoi = ((thu[6] ?? 0) + (thu[7] ?? 0)) / 2;
  if (thuong <= 0 || cuoi <= 0) return null;
  return Math.round((cuoi / thuong) * 10) / 10;
}

export type GoiY = { tieuDe: string; viec: string; lienKet?: { nhan: string; href: string } };

/**
 * Điều làm được từ số: mỗi gợi ý dựa trên một con số trong bảng, nói việc
 * cần làm và trỏ tới đúng màn có sẵn. Không có số đủ lớn thì không gợi ý.
 */
export function goiYTuSo(d: KhachThichGi): GoiY[] {
  const goiY: GoiY[] = [];
  const giaDinh = d.nhom.find((n) => n.loai === "gia-dinh-co-tre");
  if (giaDinh && giaDinh.luot >= SO_TOI_THIEU && giaDinh.phanTram >= 20) {
    goiY.push({
      tieuDe: `${giaDinh.phanTram}% lượt mua có trẻ em`,
      viec: "Đưa gói Gia đình khám phá lên đầu trang Mua vé; dặn quầy hỏi chiều cao trẻ (1m–1m3 trả giá trẻ em, dưới 1m không cần vé).",
      lienKet: { nhan: "Bảng giá vé", href: "/erp/bang-gia-quay" },
    });
  }
  const coSoLech = d.gio
    .filter((g) => g.gioDong !== null && g.gioVang !== null && (g.theoGio[g.gioVang] ?? 0) > 0)
    .map((g) => ({ g, lech: (g.theoGio[g.gioDong!] ?? 0) / Math.max(1, g.theoGio[g.gioVang!] ?? 0) }))
    .sort((a, b) => b.lech - a.lech)[0];
  if (coSoLech && coSoLech.g.tong >= SO_TOI_THIEU * 10 && coSoLech.lech >= 1.8) {
    const { g } = coSoLech;
    goiY.push({
      tieuDe: `${g.ten} lúc ${g.gioDong} giờ đông gấp ${Math.round(coSoLech.lech * 10) / 10} lần lúc ${g.gioVang} giờ`,
      viec: `Trang đặt vé đã ghi khung nào vắng; xếp thêm thuyền và người soát vé quanh ${g.gioDong} giờ, mời khách đoàn đi khung ${g.gioVang} giờ.`,
      lienKet: { nhan: "Sức chứa theo giờ", href: "/erp/toan-vung" },
    });
  }
  const cuoiTuan = heSoCuoiTuan(d.thu);
  if (cuoiTuan !== null && cuoiTuan >= 1.3) {
    goiY.push({
      tieuDe: `Thứ Bảy, Chủ nhật đông gấp ${cuoiTuan.toLocaleString("vi-VN")} lần ngày thường`,
      viec: "Kéo khách gần (Hà Nội, Ninh Bình) sang ngày thường: gói hai điểm đã rẻ hơn mua lẻ 10%, mã mời giảm thêm 10%.",
    });
  }
  const satNgay = d.datTruoc.filter((m) => m.muc === "trong-ngay" || m.muc === "1-3-ngay").reduce((c, m) => c + m.so, 0);
  const tongDat = d.datTruoc.reduce((c, m) => c + m.so, 0);
  if (tongDat >= SO_TOI_THIEU * 4 && phanTram(satNgay, tongDat) >= 50) {
    goiY.push({
      tieuDe: `${phanTram(satNgay, tongDat)}% đơn web đặt trước dưới 4 ngày`,
      viec: "Khách quyết định sát ngày đi: quảng cáo chạy từ thứ Tư tới thứ Sáu cho chuyến cuối tuần, không cần chạy trước cả tháng.",
    });
  }
  if (d.hoSoWeb >= SO_TOI_THIEU * 4) {
    const tiLe = phanTram(d.hoSoTuHaiDon, d.hoSoWeb);
    if (tiLe < 20) {
      goiY.push({
        tieuDe: `Chỉ ${tiLe}% khách web đặt từ hai lần`,
        viec: "Mời khách gắn số để tích lượt và gửi mã mời cho bạn (thẻ Khách thân thiết đã có sẵn), dặn quầy nhắc khách lúc đưa vé.",
        lienKet: { nhan: "Khách thân thiết", href: "/erp/khach-hang#khach-than-thiet" },
      });
    }
  }
  if (d.kenh.web >= SO_TOI_THIEU * 4 && d.kenh.daiLy + d.kenh.maMoi < SO_TOI_THIEU) {
    goiY.push({
      tieuDe: "Gần như chưa có đơn nào qua đại lý hay mã mời",
      viec: "Phát đường dẫn đại lý cho khách sạn, homestay đối tác (ăn hoa hồng theo đơn) và nhắc khách cũ gửi mã mời: đây là hai lối khách mang khách tới.",
      lienKet: { nhan: "Đại lý", href: "/erp/dai-ly" },
    });
  }
  return goiY;
}
