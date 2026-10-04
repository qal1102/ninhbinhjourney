/**
 * Giúp giọng đọc của máy kể chuyện bớt giọng máy (thuyết minh trang điểm đến).
 *
 * Hai chỗ làm giọng đọc nghe "robot" nhất, sửa được mà không cần dịch vụ nào:
 *
 * 1. **Chọn sai giọng.** Máy thường có nhiều giọng tiếng Việt: Edge trên
 *    Windows có "HoaiMy Online (Natural)" đọc gần như người thật, cạnh giọng
 *    "An" đời cũ đọc từng chữ. Lấy giọng đầu danh sách là hay rơi vào giọng
 *    cũ. Ở đây xếp hạng giọng, giọng tự nhiên lên trước.
 * 2. **Đọc thô chữ viết.** "Thế kỷ XI" bị đọc thành "ích i", "968–1010" đọc
 *    liền một mạch, "km" đọc từng chữ cái. Chuẩn hoá thành chữ người ta nói.
 *
 * Ngắt nghỉ (sau tên, giữa các đoạn) do thành phần đọc lo, theo `DoanDoc`.
 */

export type NgonNguDoc = "vi" | "en";

/** Đủ dùng cho việc xếp hạng; khớp với `SpeechSynthesisVoice`. */
export type GiongMay = { name: string; lang: string; localService?: boolean; voiceURI?: string };

const LA_MA: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100 };

/** "XIX" → 19. Chuỗi không phải số La Mã hợp lệ thì trả null. */
export function soLaMa(chu: string): number | null {
  if (!/^[IVXLC]+$/.test(chu)) return null;
  let tong = 0;
  for (let i = 0; i < chu.length; i++) {
    const a = LA_MA[chu[i]];
    const b = LA_MA[chu[i + 1]] ?? 0;
    tong += a < b ? -a : a;
  }
  return tong > 0 && tong < 400 ? tong : null;
}

const DON_VI_VI: [RegExp, string][] = [
  [/(\d)\s?km²/g, "$1 ki-lô-mét vuông"],
  [/(\d)\s?m²/g, "$1 mét vuông"],
  [/(\d)\s?km\b/g, "$1 ki-lô-mét"],
  [/(\d)\s?ha\b/g, "$1 héc-ta"],
  [/(\d)\s?m\b/g, "$1 mét"],
  [/(\d)\s?°C/g, "$1 độ"],
];

const DON_VI_EN: [RegExp, string][] = [
  [/(\d)\s?km²/g, "$1 square kilometres"],
  [/(\d)\s?km\b/g, "$1 kilometres"],
  [/(\d)\s?ha\b/g, "$1 hectares"],
  [/(\d)\s?m\b/g, "$1 metres"],
];

/** Từ viết tắt đọc theo cách người Việt vẫn nói. */
const VIET_TAT_VI: Record<string, string> = {
  UNESCO: "U-nét-xcô",
  IUCN: "I U C N",
};

/** Chuyển một câu sang dạng giọng đọc nói tự nhiên. */
export function chuanHoaDeDoc(cau: string, lang: NgonNguDoc): string {
  let s = cau;
  // Thế kỷ / thế kỉ / century đi với số La Mã.
  s = s.replace(/(thế k[ỷỉ]|Thế k[ỷỉ])\s+([IVXLC]+)\b/g, (goc, chu: string, so: string) => {
    const n = soLaMa(so);
    return n === null ? goc : `${chu} ${n}`;
  });
  s = s.replace(/\b([IVXLC]+)(th|st|nd|rd)? century/g, (goc, so: string) => {
    const n = soLaMa(so);
    return n === null ? goc : `${n}${n % 10 === 1 && n !== 11 ? "st" : n % 10 === 2 && n !== 12 ? "nd" : n % 10 === 3 && n !== 13 ? "rd" : "th"} century`;
  });
  // Khoảng số: "968–1010", "3-4" → "968 đến 1010".
  s = s.replace(/(\d)\s?[–—-]\s?(\d)/g, lang === "vi" ? "$1 đến $2" : "$1 to $2");
  for (const [re, thay] of lang === "vi" ? DON_VI_VI : DON_VI_EN) s = s.replace(re, thay);
  if (lang === "vi") {
    for (const [tat, doc] of Object.entries(VIET_TAT_VI)) s = s.replace(new RegExp(`\\b${tat}\\b`, "g"), doc);
  }
  // Ngoặc đơn: giọng máy đọc một hơi không ngắt; đổi thành dấu phẩy để có chỗ nghỉ.
  s = s
    .replace(/\s*\(([^)]*)\)/g, ", $1,")
    .replace(/,(\s*,)+/g, ",")
    .replace(/,\s*([.;:!?])/g, "$1");
  // Gạch dài giữa câu cũng là một chỗ ngắt.
  s = s.replace(/\s[–—]\s/g, ", ");
  return s.replace(/\s{2,}/g, " ").trim();
}

/** Một câu cần đọc, kèm khoảng nghỉ (mili giây) sau câu ấy. */
export type CauDoc = { chu: string; nghiSau: number };

/** Nghỉ sau tên nơi, giữa hai đoạn, giữa hai câu trong một đoạn. */
export const NGHI = { sauTen: 700, giuaDoan: 450, giuaCau: 120 } as const;

/**
 * Chia tên và các đoạn thành từng câu để đọc. Chrome tự ngắt câu đọc dài quá
 * chừng mười lăm giây, nên phải đọc từng câu; nghỉ dài hơn ở cuối đoạn để
 * người nghe có nhịp như nghe người kể.
 */
export function chiaCauDoc(ten: string, doan: readonly string[], lang: NgonNguDoc): CauDoc[] {
  const out: CauDoc[] = [{ chu: chuanHoaDeDoc(ten, lang), nghiSau: NGHI.sauTen }];
  for (const d of doan) {
    const cau = d
      .split(/(?<=[.!?…])\s+/)
      .map((c) => c.trim())
      .filter(Boolean)
      .map((c) => chuanHoaDeDoc(c, lang));
    cau.forEach((c, i) => out.push({ chu: c, nghiSau: i === cau.length - 1 ? NGHI.giuaDoan : NGHI.giuaCau }));
  }
  return out.filter((c) => c.chu.length > 0);
}

const TU_NHIEN = /natural|neural|online|enhanced|premium|wavenet|siri/i;
const GIONG_HAY: Record<NgonNguDoc, RegExp> = {
  vi: /hoaimy|namminh|linh|google/i,
  en: /sonia|libby|ryan|thomas|google uk|daniel|serena/i,
};
const GIONG_THO = /compact|espeak|robot/i;

export function giongTuNhien(g: GiongMay): boolean {
  return TU_NHIEN.test(g.name);
}

/**
 * Các giọng hợp ngôn ngữ, xếp từ nghe tự nhiên nhất. Tiếng Anh ưu tiên giọng
 * Anh (en-GB) như phần chữ của trang, rồi mới tới giọng tiếng Anh khác.
 */
export function xepGiong<T extends GiongMay>(giong: readonly T[], lang: NgonNguDoc): T[] {
  const diem = (g: T) => {
    const l = g.lang.toLowerCase().replace("_", "-");
    if (!l.startsWith(lang)) return -Infinity;
    let d = 0;
    if (TU_NHIEN.test(g.name)) d += 50;
    if (GIONG_HAY[lang].test(g.name)) d += 20;
    if (l === (lang === "vi" ? "vi-vn" : "en-gb")) d += 5;
    if (GIONG_THO.test(g.name)) d -= 30;
    return d;
  };
  return giong
    .map((g, i) => ({ g, d: diem(g), i }))
    .filter((x) => x.d > -Infinity)
    .sort((a, b) => b.d - a.d || a.i - b.i)
    .map((x) => x.g);
}

/** Tên giọng gọn để hiện trong ô chọn: "Microsoft HoaiMy Online (Natural) - Vietnamese (Vietnam)" → "HoaiMy · tự nhiên". */
export function tenGiongGon(g: GiongMay, lang: NgonNguDoc): string {
  const goc = g.name.replace(/^(Microsoft|Google|Apple)\s+/i, "").split(/\s[-–]\s|\s\(/)[0].replace(/\s+Online$/i, "").trim();
  const nhan = goc || g.name;
  if (!giongTuNhien(g)) return nhan;
  return `${nhan} · ${lang === "vi" ? "tự nhiên" : "natural"}`;
}
