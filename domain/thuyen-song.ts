import { DUONG_TAM_COC, DUONG_TRANG_AN, type DiemLonLat } from "@/domain/thuyen-duong-song";

/**
 * Thuyền trên sông: tuyến thật, vị trí dọc tuyến, và bến thuyền.
 *
 * Hai loại thuyền trên bản đồ:
 * - **Thuyền có định vị thật**: người chèo mở trang `/erp/thuyen` trên điện
 *   thoại, vị trí gửi lên vài giây một lần.
 * - **Thuyền ước tính**: dựng từ lượt khách qua cổng thật (`chuyenTuLuotVao`),
 *   cứ đủ chỗ một thuyền là một thuyền rời bến, rồi đi đúng lịch tuyến. Đó là
 *   con số trả lời được "bao nhiêu thuyền đang trên sông, còn bao nhiêu ở
 *   bến", không phải định vị từng thuyền.
 *
 * Mọi vị trí là hàm thuần của thời gian nên trình duyệt tính lại ở từng khung
 * hình, thuyền trượt liên tục chứ không nhảy cóc.
 */

export type CoSoThuyen = "trang-an" | "tam-coc";

export type MocTuyen = { ten: string; lonLat: DiemLonLat; nghiPhut: number };

export type TuyenThuyen = {
  coSo: CoSoThuyen;
  ten: string;
  duong: readonly DiemLonLat[];
  /** Tam Cốc đi tới Hang Ba rồi quay về theo đường cũ; Tràng An là một vòng. */
  khuHoi: boolean;
  /** Thời gian trọn chuyến, kể cả lúc nghỉ ở các mốc. */
  phutTronChuyen: number;
  /** Mốc dọc tuyến; `nghiPhut` > 0 là chỗ khách lên bờ (đền, phủ). */
  moc: readonly MocTuyen[];
};

export const TUYEN_THUYEN: Record<CoSoThuyen, TuyenThuyen> = {
  "trang-an": {
    coSo: "trang-an",
    ten: "Tràng An · Tuyến 1",
    duong: DUONG_TRANG_AN,
    khuHoi: false,
    phutTronChuyen: 180,
    moc: [
      { ten: "Bến Tràng An", lonLat: [105.91799, 20.25331], nghiPhut: 0 },
      { ten: "Đền Trình", lonLat: [105.9068, 20.25695], nghiPhut: 10 },
      { ten: "Đền Trần", lonLat: [105.89858, 20.25521], nghiPhut: 15 },
      { ten: "Phủ Khống", lonLat: [105.90431, 20.2682], nghiPhut: 12 },
    ],
  },
  "tam-coc": {
    coSo: "tam-coc",
    ten: "Tam Cốc · ba hang trên sông Ngô Đồng",
    duong: DUONG_TAM_COC,
    khuHoi: true,
    phutTronChuyen: 120,
    moc: [
      { ten: "Bến Văn Lâm", lonLat: [105.9376, 20.2166], nghiPhut: 0 },
      { ten: "Hang Cả", lonLat: [105.93091, 20.22808], nghiPhut: 0 },
      { ten: "Hang Hai", lonLat: [105.91963, 20.23184], nghiPhut: 0 },
      { ten: "Hang Ba", lonLat: [105.91867, 20.23387], nghiPhut: 8 },
    ],
  },
};

export function laCoSoThuyen(x: string): x is CoSoThuyen {
  return x === "trang-an" || x === "tam-coc";
}

const R = 6371000;
const RAD = Math.PI / 180;

export function khoangCachMet(a: DiemLonLat, b: DiemLonLat): number {
  const dLat = (b[1] - a[1]) * RAD;
  const dLon = (b[0] - a[0]) * RAD;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * RAD) * Math.cos(b[1] * RAD) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

/** Hướng đi theo độ, 0 là bắc, quay theo chiều kim đồng hồ. */
export function huongDo(a: DiemLonLat, b: DiemLonLat): number {
  const y = Math.sin((b[0] - a[0]) * RAD) * Math.cos(b[1] * RAD);
  const x = Math.cos(a[1] * RAD) * Math.sin(b[1] * RAD) - Math.sin(a[1] * RAD) * Math.cos(b[1] * RAD) * Math.cos((b[0] - a[0]) * RAD);
  return (Math.atan2(y, x) / RAD + 360) % 360;
}

/** Quãng đường cộng dồn tại từng điểm của tuyến, tính bằng mét. */
export function quangCongDon(duong: readonly DiemLonLat[]): number[] {
  const out = [0];
  for (let i = 1; i < duong.length; i++) out.push(out[i - 1] + khoangCachMet(duong[i - 1], duong[i]));
  return out;
}

const QUANG = new Map<CoSoThuyen, number[]>();
function quangCua(tuyen: TuyenThuyen): number[] {
  let q = QUANG.get(tuyen.coSo);
  if (!q) {
    q = quangCongDon(tuyen.duong);
    QUANG.set(tuyen.coSo, q);
  }
  return q;
}

export function doDaiTuyen(tuyen: TuyenThuyen): number {
  const q = quangCua(tuyen);
  return q[q.length - 1];
}

/** Điểm trên tuyến ở quãng `met` (tính từ bến, theo chiều đi), kèm hướng mũi thuyền. */
export function diemTaiQuang(tuyen: TuyenThuyen, met: number): { lonLat: DiemLonLat; huong: number } {
  const q = quangCua(tuyen);
  const d = tuyen.duong;
  const m = Math.max(0, Math.min(q[q.length - 1], met));
  let lo = 0;
  let hi = q.length - 1;
  while (hi - lo > 1) {
    const giua = (lo + hi) >> 1;
    if (q[giua] <= m) lo = giua;
    else hi = giua;
  }
  const doan = q[hi] - q[lo] || 1;
  const t = (m - q[lo]) / doan;
  const lonLat: DiemLonLat = [d[lo][0] + (d[hi][0] - d[lo][0]) * t, d[lo][1] + (d[hi][1] - d[lo][1]) * t];
  return { lonLat, huong: huongDo(d[lo], d[hi]) };
}

/** Quãng (mét, theo chiều đi) gần nhất của một mốc trên tuyến. */
function quangCuaMoc(tuyen: TuyenThuyen, moc: MocTuyen): number {
  const q = quangCua(tuyen);
  let best = 0;
  let bd = Infinity;
  tuyen.duong.forEach((p, i) => {
    const d = khoangCachMet(p, moc.lonLat);
    if (d < bd) {
      bd = d;
      best = q[i];
    }
  });
  return best;
}

/**
 * Lịch một chuyến: quãng đã đi theo phút kể từ lúc rời bến, có nghỉ ở mốc.
 * Thời gian đi thật = trọn chuyến trừ tổng thời gian nghỉ; tốc độ đều trên
 * phần đi. Tuyến khứ hồi đi hết đường rồi quay lại, nên quãng "đi được" chạy
 * từ 0 tới 2 × độ dài.
 */
const NGHI = new Map<CoSoThuyen, { ten: string; quang: number; phut: number }[]>();
function nghiCua(tuyen: TuyenThuyen) {
  let n = NGHI.get(tuyen.coSo);
  if (!n) {
    n = tuyen.moc
      .filter((m) => m.nghiPhut > 0)
      .map((m) => ({ ten: m.ten, quang: quangCuaMoc(tuyen, m), phut: m.nghiPhut }))
      .sort((a, b) => a.quang - b.quang);
    NGHI.set(tuyen.coSo, n);
  }
  return n;
}

/**
 * Quãng đã đi sau `phut` phút kể từ lúc rời bến. `phutMotVong` là thời gian
 * trọn chuyến đọc từ màn Sức chứa (người vận hành sửa được); thiếu thì dùng số
 * của tuyến.
 */
function quangTheoPhut(
  tuyen: TuyenThuyen,
  phut: number,
  heSoToc = 1,
  phutMotVong = tuyen.phutTronChuyen,
): { quang: number; nghiTai: string | null } {
  const dai = doDaiTuyen(tuyen);
  const tongDuong = tuyen.khuHoi ? dai * 2 : dai;
  const nghi = nghiCua(tuyen);
  const tongNghi = nghi.reduce((t, n) => t + n.phut, 0);
  const phutDi = Math.max(10, (phutMotVong - tongNghi) * heSoToc);
  const metMoiPhut = tongDuong / phutDi;
  let conLai = phut;
  let quang = 0;
  for (const n of nghi) {
    const toi = (n.quang - quang) / metMoiPhut;
    if (conLai <= toi) return { quang: quang + conLai * metMoiPhut, nghiTai: null };
    conLai -= toi;
    quang = n.quang;
    if (conLai <= n.phut) return { quang, nghiTai: n.ten };
    conLai -= n.phut;
  }
  return { quang: Math.min(tongDuong, quang + conLai * metMoiPhut), nghiTai: null };
}

/**
 * Phút theo lịch để tới quãng `quangDi` (0 tới tổng đường, tuyến khứ hồi
 * tính cả lượt về), cộng thời gian nghỉ ở các mốc đã qua. Nghịch đảo của
 * `quangTheoPhut` với hệ số tốc độ 1.
 */
function phutTheoQuang(tuyen: TuyenThuyen, quangDi: number, phutMotVong = tuyen.phutTronChuyen): number {
  const dai = doDaiTuyen(tuyen);
  const tongDuong = tuyen.khuHoi ? dai * 2 : dai;
  const nghi = nghiCua(tuyen);
  const tongNghi = nghi.reduce((t, n) => t + n.phut, 0);
  const metMoiPhut = tongDuong / Math.max(10, phutMotVong - tongNghi);
  let phut = 0;
  let quang = 0;
  for (const n of nghi) {
    if (quangDi <= n.quang) return phut + (quangDi - quang) / metMoiPhut;
    phut += (n.quang - quang) / metMoiPhut + n.phut;
    quang = n.quang;
  }
  return phut + (Math.min(quangDi, tongDuong) - quang) / metMoiPhut;
}

/** Quá xa tuyến thì không ước: có thể người chèo bật định vị khi chưa xuống thuyền. */
const LECH_TUYEN_TOI_DA_MET = 300;

/**
 * Ước còn bao nhiêu phút nữa thuyền có định vị về tới bến.
 *
 * Chiếu vị trí lên tuyến. Một điểm có thể ứng với nhiều quãng: tuyến khứ hồi
 * (Tam Cốc) đi và về cùng đường, tuyến vòng (Tràng An) bắt đầu và kết thúc ở
 * cùng bến. Chọn quãng mà lịch tuyến khớp nhất với thời gian thuyền đã đi, rồi
 * lấy phần lịch còn lại (đường còn lại cộng chỗ nghỉ chưa tới). Thuyền đi
 * chậm hơn lịch thì giờ về lùi theo, vì tính từ chỗ thuyền đang thật sự ở.
 */
export function uocPhutVeBen(
  coSo: CoSoThuyen,
  lonLat: DiemLonLat,
  phutDaDi: number,
  phutMotVong?: number,
): { phutConLai: number; lechTuyenMet: number } | null {
  const tuyen = TUYEN_THUYEN[coSo];
  const vong = phutMotVong ?? tuyen.phutTronChuyen;
  const q = quangCua(tuyen);
  const d = tuyen.duong;
  const kx = Math.cos(lonLat[1] * RAD) * RAD * R;
  const ky = RAD * R;
  const ung: { quang: number; lech: number }[] = [];
  for (let i = 1; i < d.length; i++) {
    const ax = (d[i - 1][0] - lonLat[0]) * kx;
    const ay = (d[i - 1][1] - lonLat[1]) * ky;
    const bx = (d[i][0] - lonLat[0]) * kx;
    const by = (d[i][1] - lonLat[1]) * ky;
    const dx = bx - ax;
    const dy = by - ay;
    const dai2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / dai2));
    const lech = Math.hypot(ax + dx * t, ay + dy * t);
    ung.push({ quang: q[i - 1] + (q[i] - q[i - 1]) * t, lech });
  }
  const gan = Math.min(...ung.map((u) => u.lech));
  if (gan > LECH_TUYEN_TOI_DA_MET) return null;
  const dai = q[q.length - 1];
  const cacQuang = ung
    .filter((u) => u.lech <= gan + 40)
    .flatMap((u) => (tuyen.khuHoi ? [u.quang, 2 * dai - u.quang] : [u.quang]));
  let tot = cacQuang[0];
  for (const c of cacQuang) {
    if (Math.abs(phutTheoQuang(tuyen, c, vong) - phutDaDi) < Math.abs(phutTheoQuang(tuyen, tot, vong) - phutDaDi)) tot = c;
  }
  const tongDuong = tuyen.khuHoi ? dai * 2 : dai;
  const phutConLai = Math.max(0, phutTheoQuang(tuyen, tongDuong, vong) - phutTheoQuang(tuyen, tot, vong));
  return { phutConLai, lechTuyenMet: Math.round(gan) };
}

export type ThuyenTrenBanDo = {
  id: string;
  nhan: string;
  /** Ước từ lượt qua cổng (true) hay theo điện thoại người chèo (false). */
  uocTinh: boolean;
  lonLat: DiemLonLat;
  huong: number;
  /** Phút đã đi kể từ lúc rời bến. */
  phutDaDi: number;
  ghiChu: string;
};

/** Hệ số tốc độ riêng của mỗi thuyền (0,9–1,1), cố định theo một con số. */
function heSoToc(hat: number): number {
  const x = Math.sin(hat * 12.9898) * 43758.5453;
  return 0.9 + (x - Math.floor(x)) * 0.2;
}

/* ---------- Bến thuyền: ước từ lượt khách qua cổng ---------- */

/**
 * Từ lúc qua cổng tới lúc thuyền rời bến: đi bộ xuống bến, mặc áo phao, chờ
 * thuyền tới lượt. Ở Tràng An thuyền gọi lượt xoay vòng (số 1 tới hết đội rồi
 * quay lại) và đủ khách là đi, nên khoảng chờ ngắn và đều.
 */
export const PHUT_TU_CONG_TOI_BEN = 8;
/** Hai lượt qua cổng cách nhau quá chừng này phút thì không chung một thuyền. */
const PHUT_GOM_MOT_THUYEN = 4;
/** Giờ thuyền chạy theo giờ Việt Nam (6:30–17:30), để báo "ngoài giờ". */
export const GIO_CHAY = { mo: 6.5, dong: 17.5 } as const;

/** Đội thuyền đọc từ ngưỡng sức chứa của bến (màn Sức chứa), kèm nguồn. */
export type DoiThuyen = {
  soThuyen: number;
  choMoiThuyen: number;
  phutMotVong: number;
  nguon: string;
  loaiNguon: "estimate" | "customer" | "measured";
};

/** Một chuyến ước tính: một nhóm khách lên chung thuyền, giờ rời bến, giờ về. */
export type ChuyenUocTinh = {
  id: string;
  soKhach: number;
  roiBenLuc: number;
  veBenLuc: number;
  heSo: number;
};

export type ThuyenUocTinh = ThuyenTrenBanDo & {
  soKhach: number;
  roiBenLuc: number;
  veBenLuc: number;
};

const GIO_VN = new Intl.DateTimeFormat("vi-VN", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Asia/Ho_Chi_Minh",
});

export function gioVietNam(ms: number): string {
  return GIO_VN.format(new Date(ms));
}

/** Giờ hiện tại ở Ninh Bình dạng số thập phân (10,5 là 10:30). */
export function gioTrongNgay(ms: number): number {
  const d = new Date(ms + 7 * 3_600_000);
  return d.getUTCHours() + d.getUTCMinutes() / 60;
}

export function trongGioChay(ms: number): boolean {
  const g = gioTrongNgay(ms);
  return g >= GIO_CHAY.mo && g < GIO_CHAY.dong;
}

/** Mốc 0 giờ (giờ Việt Nam) của ngày `yyyy-mm-dd`, tính bằng mili giây. */
export function dauNgayVietNam(ngay: string): number {
  return Date.parse(`${ngay}T00:00:00+07:00`);
}

/** Ngày `yyyy-mm-dd` theo giờ Việt Nam của một thời điểm. */
export function ngayCuaLuc(ms: number): string {
  return new Date(ms + 7 * 3_600_000).toISOString().slice(0, 10);
}

/**
 * Ngày bản đồ nên dựng: hôm nay, trừ lúc trước giờ thuyền chạy sáng sớm thì
 * lấy hôm qua (lúc ấy hôm nay chưa có lượt nào, xem lại hôm qua có ích hơn).
 */
export function ngayNenXem(bayGioMs: number): string {
  const homNay = ngayCuaLuc(bayGioMs);
  if (gioTrongNgay(bayGioMs) >= GIO_CHAY.mo) return homNay;
  return ngayCuaLuc(dauNgayVietNam(homNay) - 3_600_000);
}

/**
 * Dựng các chuyến từ lượt khách qua cổng. Làm một lần mỗi khi có dữ liệu mới,
 * rồi {@link thuyenLucNay} chỉ việc đặt thuyền lên tuyến ở từng khung hình.
 *
 * Lượt qua cổng xếp theo giờ; khách lên thuyền theo thứ tự tới, đủ số chỗ thì
 * thuyền rời bến, hoặc nhóm sau tới cách quá {@link PHUT_GOM_MOT_THUYEN} phút
 * thì thuyền trước đi luôn. Thuyền rời bến {@link PHUT_TU_CONG_TOI_BEN} phút
 * sau lượt cuối của nó, rồi đi đúng lịch tuyến (nghỉ ở đền như khách lên lễ).
 *
 * Cách gom chỉ nhìn các lượt đã tới, nên một thuyền đã rời bến không bao giờ
 * bị lượt đến sau đổi đi: dựng lại khi có thêm dữ liệu, thuyền cũ đứng yên chỗ.
 *
 * Đây là **ước tính**, không phải định vị: nó nói được bao nhiêu thuyền đang
 * trên sông và chừng ở đoạn nào, dựa trên một con số thật là lượt qua cổng.
 * Thuyền có định vị thật là thuyền của người chèo mở trang `/erp/thuyen`.
 */
export function chuyenTuLuotVao(
  coSo: CoSoThuyen,
  luotVao: readonly number[],
  choMoiThuyen: number,
  phutMotVong = TUYEN_THUYEN[coSo].phutTronChuyen,
): ChuyenUocTinh[] {
  const tuyen = TUYEN_THUYEN[coSo];
  const tongNghi = nghiCua(tuyen).reduce((t, n) => t + n.phut, 0);
  const cho = Math.max(1, Math.round(choMoiThuyen));
  const nhom: { dau: number; cuoi: number; so: number }[] = [];
  for (const luc of [...luotVao].sort((a, b) => a - b)) {
    const cuoi = nhom[nhom.length - 1];
    if (cuoi && cuoi.so < cho && luc - cuoi.cuoi <= PHUT_GOM_MOT_THUYEN * 60_000) {
      cuoi.so += 1;
      cuoi.cuoi = luc;
    } else {
      nhom.push({ dau: luc, cuoi: luc, so: 1 });
    }
  }
  return nhom.map((n) => {
    const heSo = heSoToc(n.dau / 60_000);
    const roiBenLuc = n.cuoi + PHUT_TU_CONG_TOI_BEN * 60_000;
    const phutTron = tongNghi + Math.max(10, phutMotVong - tongNghi) * heSo;
    return { id: `uoc-${coSo}-${n.dau}`, soKhach: n.so, roiBenLuc, veBenLuc: roiBenLuc + phutTron * 60_000, heSo };
  });
}

/** Các thuyền đang trên sông lúc `bayGioMs`, đặt đúng chỗ dọc tuyến. */
export function thuyenLucNay(
  coSo: CoSoThuyen,
  chuyen: readonly ChuyenUocTinh[],
  bayGioMs: number,
  phutMotVong = TUYEN_THUYEN[coSo].phutTronChuyen,
): ThuyenUocTinh[] {
  const tuyen = TUYEN_THUYEN[coSo];
  const dai = doDaiTuyen(tuyen);
  const out: ThuyenUocTinh[] = [];
  for (const c of chuyen) {
    if (c.roiBenLuc > bayGioMs || bayGioMs >= c.veBenLuc) continue;
    const phutDaDi = (bayGioMs - c.roiBenLuc) / 60_000;
    const { quang, nghiTai } = quangTheoPhut(tuyen, phutDaDi, c.heSo, phutMotVong);
    const chieuVe = tuyen.khuHoi && quang > dai;
    const diem = diemTaiQuang(tuyen, chieuVe ? dai * 2 - quang : quang);
    out.push({
      id: c.id,
      nhan: gioVietNam(c.roiBenLuc),
      uocTinh: true,
      lonLat: diem.lonLat,
      huong: chieuVe ? (diem.huong + 180) % 360 : diem.huong,
      phutDaDi,
      ghiChu: nghiTai ? `Khách đang lên ${nghiTai}` : chieuVe ? "Đang về bến" : "Đang đi",
      soKhach: c.soKhach,
      roiBenLuc: c.roiBenLuc,
      veBenLuc: c.veBenLuc,
    });
  }
  return out;
}

/** Gọn cho bài kiểm: dựng chuyến rồi đặt thuyền ở một thời điểm. */
export function thuyenTuLuotVao(
  coSo: CoSoThuyen,
  luotVao: readonly number[],
  bayGioMs: number,
  choMoiThuyen: number,
): { trenSong: ThuyenUocTinh[]; chuyen: ChuyenUocTinh[] } {
  const chuyen = chuyenTuLuotVao(coSo, luotVao, choMoiThuyen);
  return { trenSong: thuyenLucNay(coSo, chuyen, bayGioMs), chuyen };
}

export type BangBen = {
  doiThuyen: number;
  trenSong: number;
  coDinhVi: number;
  /** Đội thuyền trừ số đang trên sông: thuyền còn ở bến, chờ tới lượt. */
  oBen: number;
  roiBen30Phut: number;
  veBen30Phut: number;
  /** Đã qua cổng nhưng thuyền của họ chưa rời bến. */
  khachXuongBen: number;
  daRoiBen: number;
  khachQuaCong: number;
  /** Phần đội thuyền đang trên sông, 0–1. */
  tiLeDung: number;
};

/**
 * Bảng bến lúc `bayGioMs`: bao nhiêu thuyền còn ở bến, bao nhiêu đang trên
 * sông, sắp về. Thuyền có định vị thật cộng thêm vào số trên sông (người chèo
 * mở chuyến riêng, không lấy từ lượt qua cổng).
 */
export function bangBen(input: {
  doi: DoiThuyen;
  chuyen: readonly ChuyenUocTinh[];
  luotVao: readonly number[];
  soThuyenCoDinhVi: number;
  /** Thuyền có định vị ước về bến trong 30 phút tới (`uocPhutVeBen`). */
  veBen30PhutCoDinhVi?: number;
  bayGioMs: number;
}): BangBen {
  const { doi, bayGioMs: t } = input;
  const nuaGio = 30 * 60_000;
  const daRoi = input.chuyen.filter((c) => c.roiBenLuc <= t);
  const dangDi = daRoi.filter((c) => t < c.veBenLuc);
  const trenSong = dangDi.length + input.soThuyenCoDinhVi;
  const khachQuaCong = input.luotVao.filter((x) => x <= t).length;
  const khachDaLen = daRoi.reduce((s, c) => s + c.soKhach, 0);
  return {
    doiThuyen: doi.soThuyen,
    trenSong,
    coDinhVi: input.soThuyenCoDinhVi,
    oBen: Math.max(0, doi.soThuyen - trenSong),
    roiBen30Phut: daRoi.filter((c) => t - c.roiBenLuc <= nuaGio).length,
    veBen30Phut: dangDi.filter((c) => c.veBenLuc - t <= nuaGio).length + (input.veBen30PhutCoDinhVi ?? 0),
    khachXuongBen: Math.max(0, khachQuaCong - khachDaLen),
    daRoiBen: daRoi.length,
    khachQuaCong,
    tiLeDung: doi.soThuyen > 0 ? Math.min(1, trenSong / doi.soThuyen) : 0,
  };
}

/* ---------- Thuyền thật: dữ liệu kho trả về ---------- */

export type DiemThuyenThat = { lonLat: DiemLonLat; luc: number; doChinhXac: number | null };

export type ChuyenThuyenThat = {
  id: string;
  soThuyen: string;
  nguoiCheo: string;
  soKhach: number;
  batDau: number;
  vet: DiemThuyenThat[];
};

function so(x: unknown): number | null {
  const n = typeof x === "string" ? Number(x) : x;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

/** Dữ liệu bến API `/api/erp/thuyen?phan=ben` trả về. */
/** Một người trong sổ người chèo của bến (migration 111). */
export type NguoiCheo = {
  id: string;
  soThuyen: string;
  hoTen: string;
  soDienThoai: string | null;
  laMau: boolean;
};

export type DuLieuBen = { ngay: string; doi: DoiThuyen | null; luotVao: number[]; nguoiCheo: NguoiCheo[] };

/** Xếp sổ theo số thuyền (số trước, chữ sau): thứ tự gọi lượt đầu ngày. */
export function xepSoNguoiCheo(so: readonly NguoiCheo[]): NguoiCheo[] {
  return [...so].sort((a, b) => a.soThuyen.localeCompare(b.soThuyen, "vi", { numeric: true }));
}

/**
 * Người chèo của từng chuyến ước tính, theo lượt gọi xoay vòng ở bến: thuyền
 * rời bến thì người đứng đầu hàng chờ nhận khách; về bến xong người ấy quay
 * lại cuối hàng. Một người không bao giờ chèo hai thuyền cùng lúc; hàng chờ
 * trống lúc thuyền rời bến thì chuyến ấy không có ai trong sổ (không đoán).
 * Kết quả chỉ phụ thuộc vào sổ và các chuyến đã rời bến, nên chạy lại cho cùng
 * một kết quả.
 */
export function ganNguoiCheo(chuyen: readonly ChuyenUocTinh[], so: readonly NguoiCheo[]): Map<string, NguoiCheo> {
  const ket = new Map<string, NguoiCheo>();
  const hang = xepSoNguoiCheo(so);
  const dangCheo: { nguoi: NguoiCheo; veLuc: number }[] = [];
  for (const c of [...chuyen].sort((a, b) => a.roiBenLuc - b.roiBenLuc || a.id.localeCompare(b.id))) {
    // Ai đã về bến trước lúc thuyền này rời thì vào cuối hàng, theo giờ về.
    dangCheo.sort((a, b) => a.veLuc - b.veLuc);
    while (dangCheo.length && dangCheo[0].veLuc <= c.roiBenLuc) hang.push(dangCheo.shift()!.nguoi);
    const nguoi = hang.shift();
    if (!nguoi) continue;
    ket.set(c.id, nguoi);
    dangCheo.push({ nguoi, veLuc: c.veBenLuc });
  }
  return ket;
}

function docNguoiCheo(raw: unknown): NguoiCheo[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((x): NguoiCheo[] => {
    if (!x || typeof x !== "object") return [];
    const r = x as Record<string, unknown>;
    if (typeof r.id !== "string" || typeof r.soThuyen !== "string" || typeof r.hoTen !== "string") return [];
    return [{
      id: r.id,
      soThuyen: r.soThuyen,
      hoTen: r.hoTen,
      soDienThoai: typeof r.soDienThoai === "string" && r.soDienThoai ? r.soDienThoai : null,
      laMau: r.laMau === true,
    }];
  });
}

/** Đọc phần bến từ API; thiếu hay sai dạng thì trả rỗng, không đoán. */
export function docBenTuApi(raw: unknown): DuLieuBen | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.ngay !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(r.ngay)) return null;
  const luotVao = Array.isArray(r.luotVao) ? r.luotVao.flatMap((x) => (typeof x === "number" && Number.isFinite(x) ? [x] : [])) : [];
  let doi: DoiThuyen | null = null;
  if (r.doi && typeof r.doi === "object") {
    const d = r.doi as Record<string, unknown>;
    const soThuyen = so(d.soThuyen);
    const choMoiThuyen = so(d.choMoiThuyen);
    const phutMotVong = so(d.phutMotVong);
    const loai = d.loaiNguon;
    if (soThuyen !== null && soThuyen > 0 && choMoiThuyen !== null && choMoiThuyen > 0 && phutMotVong !== null && phutMotVong > 0) {
      doi = {
        soThuyen,
        choMoiThuyen,
        phutMotVong,
        nguon: typeof d.nguon === "string" ? d.nguon : "",
        loaiNguon: loai === "customer" || loai === "measured" ? loai : "estimate",
      };
    }
  }
  return { ngay: r.ngay, doi, luotVao, nguoiCheo: docNguoiCheo(r.nguoiCheo) };
}

export function docChuyenTrenSong(raw: unknown): ChuyenThuyenThat[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((x): ChuyenThuyenThat[] => {
    if (!x || typeof x !== "object") return [];
    const r = x as Record<string, unknown>;
    if (typeof r.id !== "string" || typeof r.so_thuyen !== "string") return [];
    const batDau = Date.parse(String(r.bat_dau));
    const vet = Array.isArray(r.vet)
      ? r.vet.flatMap((p): DiemThuyenThat[] => {
          if (!p || typeof p !== "object") return [];
          const d = p as Record<string, unknown>;
          const lat = so(d.lat);
          const lng = so(d.lng);
          const luc = Date.parse(String(d.luc));
          if (lat === null || lng === null || !Number.isFinite(luc)) return [];
          return [{ lonLat: [lng, lat] as const, luc, doChinhXac: so(d.do_chinh_xac) }];
        })
      : [];
    return [{
      id: r.id,
      soThuyen: r.so_thuyen,
      nguoiCheo: typeof r.nguoi_cheo === "string" ? r.nguoi_cheo : "",
      soKhach: so(r.so_khach) ?? 0,
      batDau: Number.isFinite(batDau) ? batDau : 0,
      vet: vet.sort((a, b) => a.luc - b.luc),
    }];
  });
}

/**
 * Đọc danh sách chuyến API `/api/erp/thuyen` trả về. Máy chủ đã chuẩn hoá
 * (camelCase) bằng `docChuyenTrenSong`; đọc lại bằng hàm ấy thì mất sạch vì
 * nó chờ tên cột của kho (`so_thuyen`). Đã sập đúng như thế ở lượt thử
 * production đầu tiên 03/10/2026, cùng kiểu lỗi từng gặp ở hàng chờ ảo.
 */
export function docChuyenTuApi(raw: unknown): ChuyenThuyenThat[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((x): ChuyenThuyenThat[] => {
    if (!x || typeof x !== "object") return [];
    const r = x as Record<string, unknown>;
    if (typeof r.id !== "string" || typeof r.soThuyen !== "string" || !Array.isArray(r.vet)) return [];
    const vet = r.vet.flatMap((p): DiemThuyenThat[] => {
      if (!p || typeof p !== "object") return [];
      const d = p as Record<string, unknown>;
      const ll = d.lonLat;
      if (!Array.isArray(ll) || ll.length !== 2) return [];
      const lon = so(ll[0]);
      const lat = so(ll[1]);
      const luc = so(d.luc);
      if (lon === null || lat === null || luc === null) return [];
      return [{ lonLat: [lon, lat] as const, luc, doChinhXac: so(d.doChinhXac) }];
    });
    return [{
      id: r.id,
      soThuyen: r.soThuyen,
      nguoiCheo: typeof r.nguoiCheo === "string" ? r.nguoiCheo : "",
      soKhach: so(r.soKhach) ?? 0,
      batDau: so(r.batDau) ?? 0,
      vet: vet.sort((a, b) => a.luc - b.luc),
    }];
  });
}

/**
 * Vị trí hiển thị của một thuyền thật ở thời điểm `hienThiMs`. Bản đồ vẽ trễ
 * vài giây so với hiện tại rồi nội suy giữa hai lần điện thoại gửi vị trí, nên
 * thuyền trượt đều thay vì nhảy mỗi lần có điểm mới. Quá điểm cuối thì đứng ở
 * điểm cuối (không đoán mò hướng đi tiếp).
 */
export function viTriNoiSuy(vet: readonly DiemThuyenThat[], hienThiMs: number): { lonLat: DiemLonLat; huong: number } | null {
  if (vet.length === 0) return null;
  if (vet.length === 1 || hienThiMs <= vet[0].luc) {
    const huong = vet.length > 1 ? huongDo(vet[0].lonLat, vet[1].lonLat) : 0;
    return { lonLat: vet[0].lonLat, huong };
  }
  for (let i = 1; i < vet.length; i++) {
    const a = vet[i - 1];
    const b = vet[i];
    if (hienThiMs <= b.luc) {
      const t = (hienThiMs - a.luc) / Math.max(1, b.luc - a.luc);
      return {
        lonLat: [a.lonLat[0] + (b.lonLat[0] - a.lonLat[0]) * t, a.lonLat[1] + (b.lonLat[1] - a.lonLat[1]) * t],
        huong: huongDo(a.lonLat, b.lonLat),
      };
    }
  }
  const cuoi = vet[vet.length - 1];
  return { lonLat: cuoi.lonLat, huong: huongDo(vet[vet.length - 2].lonLat, cuoi.lonLat) };
}

export function phutChu(phut: number): string {
  const p = Math.max(0, Math.floor(phut));
  if (p < 60) return `${p} phút`;
  return p % 60 === 0 ? `${p / 60} giờ` : `${Math.floor(p / 60)} giờ ${p % 60} phút`;
}
