import { z } from "zod";
import cauHinh from "@/config/danh-gia-ngoai.json";

/**
 * Đánh giá của khách trên Google Maps và Tripadvisor về bốn cơ sở.
 *
 * Dữ liệu do `scripts/danh-gia-ngoai/cao.mjs` lấy theo lịch (GitHub Actions)
 * và ghi lên nhánh `du-lieu-danh-gia`; màn ERP chỉ đọc. Đây là nguồn ngoài,
 * tách khỏi "Lời khách đã tới đánh giá" (khách đã qua cổng chấm trong web),
 * không gộp hai nguồn thành một con số.
 */

export type MaChuDe = keyof typeof cauHinh.chuDe;
export type MaNguon = keyof typeof cauHinh.nguon;
export type CamXuc = "tich-cuc" | "trung-lap" | "tieu-cuc";

export const CHU_DE = cauHinh.chuDe as Record<MaChuDe, string>;
export const NGUON = Object.fromEntries(
  Object.entries(cauHinh.nguon).map(([ma, n]) => [ma, n.ten]),
) as Record<MaNguon, string>;

const MA_CHU_DE = Object.keys(CHU_DE) as [MaChuDe, ...MaChuDe[]];
const MA_NGUON = Object.keys(NGUON) as [MaNguon, ...MaNguon[]];

/** Tệp dữ liệu nằm trên nhánh riêng của repo công khai; đổi được bằng biến môi trường. */
export const DUONG_DAN_DU_LIEU_MAC_DINH = `https://raw.githubusercontent.com/qal1102/ninhbinhjourney/${cauHinh.nhanhDuLieu}/${cauHinh.tepDuLieu}`;

const banGhiSchema = z.object({
  id: z.string().min(1),
  nguon: z.enum(MA_NGUON),
  coSo: z.string().min(1),
  sao: z.number().int().min(1).max(5).nullable(),
  ngay: z.string().refine((s) => Number.isFinite(Date.parse(s))),
  ngonNgu: z.string(),
  noiDung: z.string(),
  lienKet: z.string().nullable().optional(),
  camXuc: z.enum(["tich-cuc", "trung-lap", "tieu-cuc"]).optional(),
  chuDe: z.array(z.object({ k: z.enum(MA_CHU_DE), tot: z.boolean() })).optional(),
  banDich: z.string().optional(),
});

const lanChaySchema = z.object({
  luc: z.string(),
  them: z.number(),
  phanLoai: z.number(),
  loi: z.array(z.string()),
});

const duLieuSchema = z.object({
  capNhat: z.string().nullable(),
  banGhi: z.array(z.unknown()),
  lanChay: z.array(lanChaySchema).default([]),
});

export type DanhGiaNgoai = z.infer<typeof banGhiSchema>;
export type LanChay = z.infer<typeof lanChaySchema>;
export type DuLieuDanhGiaNgoai = { capNhat: string | null; banGhi: DanhGiaNgoai[]; lanChay: LanChay[] };

/** Đọc tệp JSON; dòng hỏng thì bỏ riêng dòng ấy, không bỏ cả tệp. */
export function docDuLieuDanhGia(tho: unknown): DuLieuDanhGiaNgoai | null {
  const ra = duLieuSchema.safeParse(tho);
  if (!ra.success) return null;
  const banGhi: DanhGiaNgoai[] = [];
  for (const dong of ra.data.banGhi) {
    const bg = banGhiSchema.safeParse(dong);
    if (bg.success) banGhi.push(bg.data);
  }
  return { capNhat: ra.data.capNhat, banGhi, lanChay: ra.data.lanChay };
}

/** Cảm xúc: lấy kết quả AI; chưa phân loại thì suy từ số sao. */
export function camXucCua(bg: Pick<DanhGiaNgoai, "camXuc" | "sao">): CamXuc | null {
  if (bg.camXuc) return bg.camXuc;
  if (bg.sao == null) return null;
  if (bg.sao >= 4) return "tich-cuc";
  if (bg.sao === 3) return "trung-lap";
  return "tieu-cuc";
}

export function laKhachViet(bg: Pick<DanhGiaNgoai, "ngonNgu">) {
  return bg.ngonNgu === "vi";
}

/** Phần trăm hài lòng, làm tròn; không có lời nào có cảm xúc thì null. */
export function tyLeHaiLong(ds: readonly DanhGiaNgoai[]): number | null {
  const coCamXuc = ds.map(camXucCua).filter((c): c is CamXuc => c !== null);
  if (coCamXuc.length === 0) return null;
  return Math.round((coCamXuc.filter((c) => c === "tich-cuc").length / coCamXuc.length) * 100);
}

export function diemTrungBinh(ds: readonly DanhGiaNgoai[]): number | null {
  const sao = ds.map((bg) => bg.sao).filter((s): s is number => s != null);
  if (sao.length === 0) return null;
  return Math.round((sao.reduce((a, b) => a + b, 0) / sao.length) * 10) / 10;
}

export type DemChuDe = { ma: MaChuDe; ten: string; khen: number; che: number };

export function demTheoChuDe(ds: readonly DanhGiaNgoai[]): DemChuDe[] {
  const dem = new Map<MaChuDe, DemChuDe>(MA_CHU_DE.map((ma) => [ma, { ma, ten: CHU_DE[ma], khen: 0, che: 0 }]));
  for (const bg of ds) {
    for (const c of bg.chuDe ?? []) {
      const o = dem.get(c.k);
      if (o) o[c.tot ? "khen" : "che"] += 1;
    }
  }
  return [...dem.values()].filter((o) => o.khen + o.che > 0).sort((a, b) => b.khen + b.che - (a.khen + a.che));
}

export type TongCoSo = {
  coSo: string;
  soLoi: number;
  diem: number | null;
  haiLong: number | null;
  biCheNhieuNhat: DemChuDe | null;
};

export function tongTheoCoSo(ds: readonly DanhGiaNgoai[], cacCoSo: readonly string[]): TongCoSo[] {
  return cacCoSo.map((coSo) => {
    const cua = ds.filter((bg) => bg.coSo === coSo);
    const che = demTheoChuDe(cua).filter((c) => c.che > 0).sort((a, b) => b.che - a.che)[0] ?? null;
    return { coSo, soLoi: cua.length, diem: diemTrungBinh(cua), haiLong: tyLeHaiLong(cua), biCheNhieuNhat: che };
  });
}

/** Một câu kết luận dựng từ số, không gọi AI: khen gì nhất, chê gì nhất, khách nào hài lòng hơn. */
export function cauKetLuan(ds: readonly DanhGiaNgoai[]): string | null {
  const chuDe = demTheoChuDe(ds);
  if (chuDe.length === 0) return null;
  const khen = [...chuDe].sort((a, b) => b.khen - a.khen)[0];
  const che = [...chuDe].sort((a, b) => b.che - a.che)[0];
  const phan: string[] = [];
  if (khen.khen > 0) phan.push(`Được khen nhiều nhất về ${khen.ten.toLowerCase()} (${khen.khen} lượt)`);
  if (che.che > 0) phan.push(`bị chê nhiều nhất về ${che.ten.toLowerCase()} (${che.che} lượt)`);
  let cau = phan.join(", ");
  if (!cau) return null;
  cau = `${cau.charAt(0).toUpperCase()}${cau.slice(1)}.`;
  const viet = tyLeHaiLong(ds.filter(laKhachViet));
  const ngoai = tyLeHaiLong(ds.filter((bg) => !laKhachViet(bg)));
  if (viet != null && ngoai != null && viet !== ngoai) {
    cau += ` Khách ${ngoai > viet ? "quốc tế" : "Việt"} hài lòng hơn ${Math.abs(ngoai - viet)} điểm phần trăm.`;
  }
  return cau;
}

/** Lọc theo khoảng ngày tính tới mốc `bayGio`. */
export function trongKhoang(ds: readonly DanhGiaNgoai[], soNgay: number, bayGio: Date): DanhGiaNgoai[] {
  const tu = bayGio.getTime() - soNgay * 24 * 60 * 60 * 1000;
  return ds.filter((bg) => Date.parse(bg.ngay) >= tu);
}
