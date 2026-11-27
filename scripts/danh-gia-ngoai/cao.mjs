// Lấy đánh giá mới của bốn cơ sở trên Google Maps và Tripadvisor, nhờ Gemini
// chia khen chê theo chủ đề, rồi ghi một tệp JSON cho màn "Khách nói gì trên
// mạng" của ERP đọc. Chạy bằng GitHub Actions (`.github/workflows/danh-gia-ngoai.yml`).
//
// Giữ chi phí bằng 0:
// - Apify gói miễn phí cho 5 USD mỗi tháng; hết hạn mức thì Apify tự chặn tới
//   kỳ sau, không tính thêm tiền. Mỗi lượt chỉ lấy đánh giá mới hơn lần trước.
// - Gemini dùng hạn mức miễn phí; mỗi yêu cầu gửi cả lô đánh giá.
// - Không lưu tên người viết: tắt dữ liệu cá nhân ở cả hai nguồn.
//
// Biến môi trường: APIFY_TOKEN (bắt buộc), GEMINI_API_KEY (không có thì vẫn
// lưu đánh giá, chỉ thiếu phần chủ đề), GEMINI_MODEL, DU_LIEU_TEP, SO_TOI_DA_MOI_MUC.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DAY_MS = 24 * 60 * 60 * 1000;
export const GIU_TOI_DA = 3000;
export const GIU_LAN_CHAY = 30;
const LO_PHAN_LOAI = 25;
const PHAN_LOAI_BU_TOI_DA = 50;
export const CAM_XUC = ["tich-cuc", "trung-lap", "tieu-cuc"];

const thuMuc = dirname(fileURLToPath(import.meta.url));

export async function docCauHinh() {
  return JSON.parse(await readFile(resolve(thuMuc, "../../config/danh-gia-ngoai.json"), "utf8"));
}

export function duLieuRong() {
  return { phienBan: 1, capNhat: null, banGhi: [], lanChay: [] };
}

export async function docDuLieuCu(duongDan) {
  try {
    const tho = JSON.parse(await readFile(duongDan, "utf8"));
    if (!tho || !Array.isArray(tho.banGhi)) return duLieuRong();
    return { ...duLieuRong(), ...tho, lanChay: Array.isArray(tho.lanChay) ? tho.lanChay : [] };
  } catch {
    return duLieuRong();
  }
}

/** Ngày bắt đầu lấy cho một mục: bản ghi mới nhất trừ 2 ngày, lần đầu thì 14 ngày. */
export function ngayBatDau(banGhi, coSo, nguon, bayGio = new Date()) {
  let moiNhat = 0;
  for (const bg of banGhi) {
    if (bg.coSo !== coSo || bg.nguon !== nguon) continue;
    const t = Date.parse(bg.ngay);
    if (Number.isFinite(t) && t > moiNhat) moiNhat = t;
  }
  const moc = moiNhat ? moiNhat - 2 * DAY_MS : bayGio.getTime() - 14 * DAY_MS;
  return new Date(moc).toISOString().slice(0, 10);
}

function chuoi(v) {
  return typeof v === "string" ? v.trim() : "";
}

function saoHopLe(v) {
  const n = Number(v);
  return Number.isInteger(n) && n >= 1 && n <= 5 ? n : null;
}

function lienKetAnToan(v) {
  const s = chuoi(v);
  return s.startsWith("https://") ? s : null;
}

function ngonNgu(v) {
  const s = chuoi(v).toLowerCase();
  return s ? s.split(/[-_]/)[0] : "khac";
}

export function chuanHoaGoogle(item, coSo) {
  const ma = chuoi(item?.reviewId);
  const ngay = Date.parse(item?.publishedAtDate);
  const noiDung = chuoi(item?.text);
  if (!ma || !Number.isFinite(ngay)) return null;
  return {
    id: `google:${ma}`,
    nguon: "google",
    coSo,
    sao: saoHopLe(item.stars),
    ngay: new Date(ngay).toISOString(),
    ngonNgu: ngonNgu(item.originalLanguage),
    noiDung,
    lienKet: lienKetAnToan(item.reviewUrl),
  };
}

export function chuanHoaTripadvisor(item, coSo) {
  const ma = chuoi(String(item?.id ?? ""));
  const ngay = Date.parse(item?.publishedDate);
  const tieuDe = chuoi(item?.title);
  const than = chuoi(item?.text);
  if (!ma || !Number.isFinite(ngay)) return null;
  return {
    id: `tripadvisor:${ma}`,
    nguon: "tripadvisor",
    coSo,
    sao: saoHopLe(item.rating),
    ngay: new Date(ngay).toISOString(),
    ngonNgu: ngonNgu(item.originalLanguage || item.lang),
    noiDung: tieuDe && than ? `${tieuDe}. ${than}` : tieuDe || than,
    lienKet: lienKetAnToan(item.url),
  };
}

export function dauVaoApify(muc, tuNgay, soToiDa) {
  if (muc.nguon === "google") {
    return {
      startUrls: [{ url: `https://www.google.com/maps/search/${encodeURIComponent(muc.timKiem)}` }],
      maxReviews: soToiDa,
      reviewsSort: "newest",
      reviewsStartDate: tuNgay,
      language: "vi",
      reviewsOrigin: "google",
      personalData: false,
    };
  }
  if (muc.nguon === "tripadvisor") {
    return {
      startUrls: [{ url: muc.url }],
      maxItemsPerQuery: soToiDa,
      lastReviewDate: tuNgay,
      scrapeReviewerInfo: false,
      disableMachineTranslations: true,
    };
  }
  throw new Error(`Nguồn chưa hỗ trợ: ${muc.nguon}`);
}

async function goiApify(actor, dauVao, token) {
  const url = `https://api.apify.com/v2/acts/${actor}/run-sync-get-dataset-items?timeout=280&clean=true`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(dauVao),
    signal: AbortSignal.timeout(300_000),
  });
  if (!res.ok) throw new Error(`Apify ${actor} trả ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const ketQua = await res.json();
  return Array.isArray(ketQua) ? ketQua : [];
}

/** Gộp bản ghi mới vào cũ, bỏ trùng theo mã; giữ phần phân loại đã có. */
export function gop(cu, moi) {
  const theoMa = new Map(cu.map((bg) => [bg.id, bg]));
  const themMoi = [];
  for (const bg of moi) {
    if (!bg) continue;
    const daCo = theoMa.get(bg.id);
    if (daCo) continue;
    theoMa.set(bg.id, bg);
    themMoi.push(bg);
  }
  const tatCa = [...theoMa.values()].sort((a, b) => Date.parse(b.ngay) - Date.parse(a.ngay)).slice(0, GIU_TOI_DA);
  return { tatCa, themMoi };
}

export function loiNhacPhanLoai(lo, chuDe) {
  const danhSach = Object.entries(chuDe)
    .map(([k, ten]) => `- ${k}: ${ten}`)
    .join("\n");
  const banGhi = lo.map((bg) => ({ id: bg.id, sao: bg.sao, ngonNgu: bg.ngonNgu, noiDung: bg.noiDung.slice(0, 1500) }));
  return [
    "Bạn đọc đánh giá của du khách về các điểm du lịch ở Ninh Bình và Hà Nam.",
    "Với mỗi đánh giá, trả về:",
    "- camXuc: tich-cuc, trung-lap hoặc tieu-cuc (dựa vào nội dung, số sao chỉ để tham khảo).",
    "- chuDe: các chủ đề được nhắc tới, mỗi chủ đề ghi tot=true nếu khen, tot=false nếu chê. Chỉ dùng mã trong danh sách. Không nhắc thì để mảng rỗng.",
    "- banDich: nếu đánh giá không viết bằng tiếng Việt thì dịch sang tiếng Việt tự nhiên, gọn; nếu đã là tiếng Việt thì để chuỗi rỗng.",
    "Danh sách chủ đề:",
    danhSach,
    "Đánh giá (JSON):",
    JSON.stringify(banGhi),
  ].join("\n");
}

export function luocDoPhanLoai(chuDe) {
  return {
    type: "ARRAY",
    items: {
      type: "OBJECT",
      properties: {
        id: { type: "STRING" },
        camXuc: { type: "STRING", enum: CAM_XUC },
        chuDe: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: { k: { type: "STRING", enum: Object.keys(chuDe) }, tot: { type: "BOOLEAN" } },
            required: ["k", "tot"],
          },
        },
        banDich: { type: "STRING" },
      },
      required: ["id", "camXuc", "chuDe"],
    },
  };
}

/** Lọc câu trả lời của mô hình: chỉ nhận mã có trong lô, cảm xúc và chủ đề hợp lệ. */
export function docKetQuaPhanLoai(ketQua, maTrongLo, chuDe) {
  const ra = new Map();
  if (!Array.isArray(ketQua)) return ra;
  for (const dong of ketQua) {
    if (!dong || !maTrongLo.has(dong.id) || !CAM_XUC.includes(dong.camXuc)) continue;
    const daGap = new Set();
    const cacChuDe = (Array.isArray(dong.chuDe) ? dong.chuDe : []).filter((c) => {
      if (!c || !(c.k in chuDe) || typeof c.tot !== "boolean" || daGap.has(c.k)) return false;
      daGap.add(c.k);
      return true;
    });
    const banDich = chuoi(dong.banDich).slice(0, 2000);
    ra.set(dong.id, { camXuc: dong.camXuc, chuDe: cacChuDe.map((c) => ({ k: c.k, tot: c.tot })), ...(banDich ? { banDich } : {}) });
  }
  return ra;
}

async function goiGemini(lo, chuDe, khoa, moHinh) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${moHinh}:generateContent`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": khoa },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: loiNhacPhanLoai(lo, chuDe) }] }],
      generationConfig: { responseMimeType: "application/json", responseSchema: luocDoPhanLoai(chuDe), temperature: 0.2 },
    }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) throw new Error(`Gemini trả ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = await res.json();
  const chu = json?.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  return JSON.parse(chu);
}

async function phanLoai(banGhi, chuDe, khoa, moHinh, loi) {
  let xong = 0;
  for (let i = 0; i < banGhi.length; i += LO_PHAN_LOAI) {
    const lo = banGhi.slice(i, i + LO_PHAN_LOAI).filter((bg) => bg.noiDung);
    if (lo.length === 0) continue;
    try {
      const ketQua = docKetQuaPhanLoai(await goiGemini(lo, chuDe, khoa, moHinh), new Set(lo.map((bg) => bg.id)), chuDe);
      for (const bg of lo) {
        const kq = ketQua.get(bg.id);
        if (kq) {
          Object.assign(bg, kq);
          xong += 1;
        }
      }
    } catch (error) {
      loi.push(`Phân loại: ${error instanceof Error ? error.message : String(error)}`);
      break;
    }
    // Hạn mức miễn phí tính theo phút: nghỉ giữa các lô.
    if (i + LO_PHAN_LOAI < banGhi.length) await new Promise((r) => setTimeout(r, 7000));
  }
  return xong;
}

export async function chay({ env = process.env, bayGio = new Date() } = {}) {
  const cauHinh = await docCauHinh();
  const duongDan = resolve(env.DU_LIEU_TEP || "du-lieu/danh-gia-ngoai.json");
  const token = env.APIFY_TOKEN;
  if (!token) throw new Error("Thiếu APIFY_TOKEN trong Secrets của repo.");
  const soToiDa = Math.max(1, Math.min(100, Number(env.SO_TOI_DA_MOI_MUC) || 30));

  const cu = await docDuLieuCu(duongDan);
  const loi = [];
  const moi = [];
  for (const muc of cauHinh.muc) {
    const nguon = cauHinh.nguon[muc.nguon];
    if (!nguon) continue;
    try {
      const tuNgay = ngayBatDau(cu.banGhi, muc.coSo, muc.nguon, bayGio);
      const ketQua = await goiApify(nguon.actor, dauVaoApify(muc, tuNgay, soToiDa), token);
      const chuanHoa = muc.nguon === "google" ? chuanHoaGoogle : chuanHoaTripadvisor;
      moi.push(...ketQua.map((item) => chuanHoa(item, muc.coSo)));
    } catch (error) {
      loi.push(`${muc.coSo}/${muc.nguon}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const { tatCa, themMoi } = gop(cu.banGhi, moi);
  let daPhanLoai = 0;
  if (env.GEMINI_API_KEY) {
    const chuaPhanLoai = [...themMoi, ...tatCa.filter((bg) => !bg.camXuc && !themMoi.includes(bg)).slice(0, PHAN_LOAI_BU_TOI_DA)];
    daPhanLoai = await phanLoai(chuaPhanLoai, cauHinh.chuDe, env.GEMINI_API_KEY, env.GEMINI_MODEL || "gemini-3.5-flash-lite", loi);
  } else {
    loi.push("Chưa có GEMINI_API_KEY: đánh giá mới chưa được chia chủ đề.");
  }

  const lan = { luc: bayGio.toISOString(), them: themMoi.length, phanLoai: daPhanLoai, loi };
  const duLieu = {
    phienBan: 1,
    capNhat: bayGio.toISOString(),
    banGhi: tatCa,
    lanChay: [lan, ...cu.lanChay].slice(0, GIU_LAN_CHAY),
  };
  await mkdir(dirname(duongDan), { recursive: true });
  await writeFile(duongDan, `${JSON.stringify(duLieu)}\n`, "utf8");
  return lan;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  chay()
    .then((lan) => {
      console.log(`Thêm ${lan.them} đánh giá, phân loại ${lan.phanLoai}.`);
      for (const dong of lan.loi) console.warn(`Lưu ý: ${dong}`);
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    });
}
