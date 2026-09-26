/**
 * Báo cáo & dự báo của một cơ sở — phần suy luận, thuần, kiểm được.
 *
 * Số đầu vào đọc từ `erp_bao_cao_co_so` (migration 093), đã cộng theo ngày giờ
 * Việt Nam. Ở đây chỉ gộp tuần, tính trung bình theo thứ và dự báo bảy ngày.
 *
 * Cách dự báo cố ý đơn giản và nói ra được bằng một câu: **trung bình cùng thứ
 * trong bốn tuần gần nhất, nhân với xu hướng bốn tuần so với bốn tuần trước
 * đó; không bao giờ thấp hơn số khách đã đặt trước cho ngày ấy.** Một mô hình
 * không giải thích được cho quản lý thì quản lý không dám dựa vào để xếp ca.
 */

export type NgayBaoCao = {
  ngay: string;
  khachVao: number;
  khachCoVe: number;
  khachWeb: number;
  khachWebDaVao: number;
  tienQuay: number;
  phieuQuay: number;
};

export type SoLieuBaoCao = {
  ngay: NgayBaoCao[];
  gio: Array<{ gio: number; khach: number }>;
  daDat: Array<{ ngay: string; khach: number }>;
  sucChuaGio: number | null;
};

export type TuanBaoCao = { tuDen: string; bat: string; khach: number; tienQuay: number; soNgay: number };
export type DuBaoNgay = {
  ngay: string;
  thu: string;
  khach: number;
  thap: number;
  cao: number;
  daDat: number;
  /** Giờ đông nhất dự kiến, tính theo tỉ trọng giờ cao điểm của 28 ngày qua. */
  gioCaoDiem: number | null;
  khachGioCaoDiem: number;
  /** Phần trăm sức chứa một giờ; null khi không có ngưỡng. */
  phanTramSucChua: number | null;
};

const TEN_THU = ["Chủ nhật", "Thứ hai", "Thứ ba", "Thứ tư", "Thứ năm", "Thứ sáu", "Thứ bảy"] as const;

function soAm(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function laNgay(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value);
}

/** Thứ trong tuần của một ngày "YYYY-MM-DD", không phụ thuộc múi giờ máy chủ. */
export function thuCua(ngay: string): number {
  const [y, m, d] = ngay.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function tenThu(ngay: string): string {
  return TEN_THU[thuCua(ngay)];
}

export function congNgay(ngay: string, soNgay: number): string {
  const [y, m, d] = ngay.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + soNgay)).toISOString().slice(0, 10);
}

/** Đọc kết quả hàm trong kho; dòng hỏng bỏ qua, số hỏng là 0. */
export function docSoLieuBaoCao(value: unknown): SoLieuBaoCao {
  const goc = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const mang = (key: string) => (Array.isArray(goc[key]) ? (goc[key] as unknown[]) : []);
  const doiTuong = (item: unknown) => (item && typeof item === "object" ? (item as Record<string, unknown>) : null);
  return {
    ngay: mang("ngay").flatMap((item) => {
      const hang = doiTuong(item);
      if (!hang || !laNgay(hang.ngay)) return [];
      return [{
        ngay: hang.ngay.slice(0, 10),
        khachVao: soAm(hang.khach_vao),
        khachCoVe: soAm(hang.khach_co_ve),
        khachWeb: soAm(hang.khach_web),
        khachWebDaVao: soAm(hang.khach_web_da_vao),
        tienQuay: soAm(hang.tien_quay),
        phieuQuay: soAm(hang.phieu_quay),
      }];
    }),
    gio: mang("gio").flatMap((item) => {
      const hang = doiTuong(item);
      const gio = Number(hang?.gio);
      if (!hang || !Number.isInteger(gio) || gio < 0 || gio > 23) return [];
      return [{ gio, khach: soAm(hang.khach) }];
    }),
    daDat: mang("da_dat").flatMap((item) => {
      const hang = doiTuong(item);
      if (!hang || !laNgay(hang.ngay)) return [];
      return [{ ngay: hang.ngay.slice(0, 10), khach: soAm(hang.khach) }];
    }),
    sucChuaGio: soAm(goc.suc_chua_gio) || null,
  };
}

/** Gộp theo tuần, tuần cuối kết thúc ở ngày cuối cùng có trong chuỗi. */
export function tongTheoTuan(ngay: readonly NgayBaoCao[], soTuan = 8): TuanBaoCao[] {
  const tuan: TuanBaoCao[] = [];
  for (let i = 0; i < soTuan; i += 1) {
    const cuoi = ngay.length - i * 7;
    const dau = Math.max(0, cuoi - 7);
    if (cuoi <= 0) break;
    const doan = ngay.slice(dau, cuoi);
    tuan.unshift({
      bat: doan[0].ngay,
      tuDen: doan[doan.length - 1].ngay,
      khach: doan.reduce((t, d) => t + d.khachVao, 0),
      tienQuay: doan.reduce((t, d) => t + d.tienQuay, 0),
      soNgay: doan.length,
    });
  }
  return tuan;
}

/** Trung bình khách vào theo thứ, trong `soTuan` tuần cuối. Chỉ số 0 = Chủ nhật. */
export function trungBinhTheoThu(ngay: readonly NgayBaoCao[], soTuan = 4): number[] {
  const doan = ngay.slice(-soTuan * 7);
  const tong = Array(7).fill(0) as number[];
  const dem = Array(7).fill(0) as number[];
  for (const d of doan) {
    const thu = thuCua(d.ngay);
    tong[thu] += d.khachVao;
    dem[thu] += 1;
  }
  return tong.map((t, i) => (dem[i] ? Math.round(t / dem[i]) : 0));
}

/** Xu hướng: bốn tuần gần nhất so với bốn tuần trước đó, kẹp trong [0,7; 1,3]. */
export function xuHuong(ngay: readonly NgayBaoCao[]): number {
  const gan = ngay.slice(-28).reduce((t, d) => t + d.khachVao, 0);
  const truoc = ngay.slice(-56, -28).reduce((t, d) => t + d.khachVao, 0);
  if (truoc <= 0 || gan <= 0) return 1;
  return Math.min(1.3, Math.max(0.7, gan / truoc));
}

/**
 * Dự báo bảy ngày kể từ `tuNgay`. Khoảng thấp–cao là ±15%, nhưng không bao
 * giờ thấp hơn số đã đặt trước: khách đã trả tiền rồi thì chắc chắn có.
 */
export function duBao7Ngay(soLieu: SoLieuBaoCao, tuNgay: string): DuBaoNgay[] {
  const theoThu = trungBinhTheoThu(soLieu.ngay);
  const heSo = xuHuong(soLieu.ngay);
  const tongGio = soLieu.gio.reduce((t, g) => t + g.khach, 0);
  const dinh = soLieu.gio.reduce<{ gio: number; khach: number } | null>(
    (tot, g) => (!tot || g.khach > tot.khach ? g : tot),
    null,
  );
  const tiTrongDinh = dinh && tongGio > 0 ? dinh.khach / tongGio : 0;

  return Array.from({ length: 7 }, (_, i) => {
    const ngay = congNgay(tuNgay, i);
    const daDat = soLieu.daDat.find((d) => d.ngay === ngay)?.khach ?? 0;
    const uocTinh = Math.round(theoThu[thuCua(ngay)] * heSo);
    const khach = Math.max(uocTinh, daDat);
    const khachGioCaoDiem = Math.round(khach * tiTrongDinh);
    return {
      ngay,
      thu: tenThu(ngay),
      khach,
      thap: Math.max(daDat, Math.round(khach * 0.85)),
      cao: Math.max(daDat, Math.round(khach * 1.15)),
      daDat,
      gioCaoDiem: dinh?.gio ?? null,
      khachGioCaoDiem,
      phanTramSucChua: soLieu.sucChuaGio ? Math.round((khachGioCaoDiem / soLieu.sucChuaGio) * 100) : null,
    };
  });
}

/** Tỉ lệ khách đặt web không tới, trên các ngày đã qua. null khi chưa có đơn web. */
export function tiLeKhongDen(ngay: readonly NgayBaoCao[]): number | null {
  const dat = ngay.reduce((t, d) => t + d.khachWeb, 0);
  if (dat === 0) return null;
  const vao = ngay.reduce((t, d) => t + d.khachWebDaVao, 0);
  return Math.round(((dat - vao) / dat) * 1000) / 10;
}
