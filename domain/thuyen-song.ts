import { DUONG_TAM_COC, DUONG_TRANG_AN, type DiemLonLat } from "@/domain/thuyen-duong-song";

/**
 * Thuyền trên sông: tuyến thật, vị trí dọc tuyến, và thuyền mô phỏng.
 *
 * Thuyền thật lấy vị trí từ điện thoại người chèo đò (trang `/erp/thuyen`).
 * Người chấm hay khách xem thử không có ai đang chèo, nên bản đồ có thêm
 * **thuyền mô phỏng**, ghi rõ chữ "mô phỏng": vị trí tính thẳng từ đồng hồ dọc
 * theo đường sông thật, không ghi một dòng nào vào kho. Vì là hàm thuần của
 * thời gian, trình duyệt tính lại được ở mỗi khung hình nên thuyền trượt liên
 * tục chứ không nhảy cóc.
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
  /** Mô phỏng: cứ chừng này phút có một thuyền rời bến. */
  phutGiuaHaiThuyen: number;
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
    phutGiuaHaiThuyen: 9,
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
    phutGiuaHaiThuyen: 7,
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

function quangTheoPhut(tuyen: TuyenThuyen, phut: number, heSoToc = 1): { quang: number; nghiTai: string | null } {
  const dai = doDaiTuyen(tuyen);
  const tongDuong = tuyen.khuHoi ? dai * 2 : dai;
  const nghi = nghiCua(tuyen);
  const tongNghi = nghi.reduce((t, n) => t + n.phut, 0);
  const phutDi = Math.max(10, (tuyen.phutTronChuyen - tongNghi) * heSoToc);
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

export type ThuyenTrenBanDo = {
  id: string;
  nhan: string;
  moPhong: boolean;
  lonLat: DiemLonLat;
  huong: number;
  /** Phút đã đi kể từ lúc rời bến. */
  phutDaDi: number;
  ghiChu: string;
};

/** Hệ số tốc độ riêng của mỗi thuyền mô phỏng (0,9–1,1), cố định theo số thứ tự. */
function heSoToc(stt: number): number {
  const x = Math.sin(stt * 12.9898) * 43758.5453;
  return 0.9 + (x - Math.floor(x)) * 0.2;
}

/**
 * Các thuyền mô phỏng đang trên sông lúc `bayGioMs`. Thuyền thứ `stt` rời bến
 * lúc `stt × phutGiuaHaiThuyen` phút kể từ mốc 0 (Unix), nên ai mở bản đồ lúc
 * nào cũng thấy cùng một đội thuyền ở cùng một chỗ.
 */
export function thuyenMoPhong(coSo: CoSoThuyen, bayGioMs: number): ThuyenTrenBanDo[] {
  const tuyen = TUYEN_THUYEN[coSo];
  const phutHienTai = bayGioMs / 60000;
  const sttMoiNhat = Math.floor(phutHienTai / tuyen.phutGiuaHaiThuyen);
  const soThuyen = Math.ceil((tuyen.phutTronChuyen * 1.15) / tuyen.phutGiuaHaiThuyen) + 1;
  const dai = doDaiTuyen(tuyen);
  const out: ThuyenTrenBanDo[] = [];
  for (let stt = sttMoiNhat; stt > sttMoiNhat - soThuyen; stt--) {
    const phutDaDi = phutHienTai - stt * tuyen.phutGiuaHaiThuyen;
    const he = heSoToc(stt);
    const { quang, nghiTai } = quangTheoPhut(tuyen, phutDaDi, he);
    const tongDuong = tuyen.khuHoi ? dai * 2 : dai;
    if (phutDaDi < 0 || quang >= tongDuong - 1) continue;
    const chieuVe = tuyen.khuHoi && quang > dai;
    const theoChieuDi = chieuVe ? dai * 2 - quang : quang;
    const diem = diemTaiQuang(tuyen, theoChieuDi);
    out.push({
      id: `mo-phong-${coSo}-${stt}`,
      nhan: String(Math.abs(stt) % 1000).padStart(3, "0"),
      moPhong: true,
      lonLat: diem.lonLat,
      huong: chieuVe ? (diem.huong + 180) % 360 : diem.huong,
      phutDaDi,
      ghiChu: nghiTai ? `Khách đang lên ${nghiTai}` : chieuVe ? "Đang về bến" : "Đang đi",
    });
  }
  return out;
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
