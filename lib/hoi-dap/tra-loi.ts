import "server-only";

import { createHash } from "node:crypto";
import { CONTACT } from "@/content/contact";
import { boDau, loiChuaCoThongTin, mucTheoId, timMuc, traLoiThang, type MucHoiDap } from "@/domain/hoi-dap";
import { coMoHinhAi, hoiMoHinh } from "@/lib/ai/goi-mo-hinh";
import type { NgonNgu } from "@/lib/ngon-ngu";

/**
 * Trả lời một câu hỏi của khách, rẻ nhất trước:
 * 1. Bấm câu gợi ý hoặc câu khớp rõ một mục trong sổ: trả lời ngay, không AI.
 * 2. Câu đã hỏi gần đây: lấy lại câu trả lời đã nhớ.
 * 3. Câu lạ: hỏi AI, chỉ gửi kèm tối đa 4 mục khớp nhất làm tư liệu, dặn chỉ
 *    trả lời trong tư liệu. Không có AI, hết lượt hay lỗi: trả mục khớp nhất,
 *    hoặc mời gọi điện.
 *
 * Bộ nhớ và giới hạn lượt nằm trong bộ nhớ của từng hàm máy chủ: đủ để chặn
 * một người bấm liên tục làm cạn lượt miễn phí lúc demo, không phải giới hạn
 * chính xác toàn cục.
 */

export type NguonTraLoi = "so" | "ai" | "nho" | "chua-co" | "gioi-han";

export type KetQuaHoiDap = {
  traLoi: string;
  nguon: NguonTraLoi;
  lienKet: { href: string; nhan: string }[];
};

export type TinCu = { vai: "khach" | "tro-ly"; chu: string };

const NHO_TOI_DA = 300;
const nho = new Map<string, KetQuaHoiDap>();

const PHUT = 60_000;
const NGAY = 24 * 60 * PHUT;
export const GIOI_HAN_AI = { moiPhut: 5, moiNgay: 40 } as const;
const luotAi = new Map<string, number[]>();

function lienKetCua(muc: MucHoiDap | undefined, lang: NgonNgu) {
  return muc?.lienKet ? [{ href: muc.lienKet.href, nhan: muc.lienKet.nhan[lang] }] : [];
}

function tuSo(muc: MucHoiDap, lang: NgonNgu): KetQuaHoiDap {
  return { traLoi: muc.traLoi[lang], nguon: "so", lienKet: lienKetCua(muc, lang) };
}

/** Còn lượt AI không; còn thì ghi một lượt. Khoá là IP đã băm. */
export function layLuotAi(khoa: string, bayGio = Date.now()): boolean {
  const cu = (luotAi.get(khoa) ?? []).filter((t) => bayGio - t < NGAY);
  if (cu.filter((t) => bayGio - t < PHUT).length >= GIOI_HAN_AI.moiPhut || cu.length >= GIOI_HAN_AI.moiNgay) {
    luotAi.set(khoa, cu);
    return false;
  }
  cu.push(bayGio);
  luotAi.set(khoa, cu);
  if (luotAi.size > 5_000) luotAi.delete(luotAi.keys().next().value as string);
  return true;
}

export function bamKhoa(ip: string): string {
  return createHash("sha256").update(`hoi-dap:${ip}`).digest("hex").slice(0, 24);
}

function huongDan(lang: NgonNgu) {
  return lang === "en"
    ? `You answer visitor questions for Ninh Binh Journey, a demo travel site for Ninh Binh, Vietnam.
Answer ONLY from the MATERIAL below. If the material does not contain the answer, say so in one sentence and suggest calling ${CONTACT.phoneLabel}.
Never invent prices, opening hours, policies or facts. Prices in the material are illustrative demo prices; say so when you quote one.
Reply in English, 1-3 short sentences, plain text, no markdown, address the visitor as "you".
Answer the question directly with no preamble or greeting. Only suggest calling when the material lacks the answer.`
    : `Bạn trả lời câu hỏi của khách cho Ninh Bình Journey, web du lịch Ninh Bình (bản thử).
CHỈ trả lời dựa trên TƯ LIỆU bên dưới. Tư liệu không có câu trả lời thì nói một câu là chưa có thông tin và mời gọi ${CONTACT.phoneLabel}.
Không bịa giá, giờ mở cửa, chính sách hay sự kiện. Giá trong tư liệu là giá minh hoạ của bản thử; nhắc điều đó khi nêu giá.
Trả lời bằng tiếng Việt có dấu, viết hoa đầu câu và tên riêng như văn bình thường, không dùng markdown. 1–3 câu ngắn, gọi khách là "bạn", không xưng "em", không thêm "ạ".
Trả lời thẳng vào câu hỏi, không thêm câu giới thiệu hay lời chào. Chỉ mời gọi điện khi tư liệu không có câu trả lời.`;
}

export async function traLoiCauHoi(opts: {
  cau: string;
  lang: NgonNgu;
  mucId?: string;
  lichSu?: TinCu[];
  khoaKhach: string;
}): Promise<KetQuaHoiDap> {
  const { cau, lang } = opts;

  if (opts.mucId) {
    const muc = mucTheoId(opts.mucId);
    if (muc) return tuSo(muc, lang);
  }

  const thang = traLoiThang(cau);
  if (thang) return tuSo(thang, lang);

  const khoaNho = `${lang}:${boDau(cau)}`;
  const daNho = nho.get(khoaNho);
  if (daNho) return { ...daNho, nguon: "nho" };

  const khop = timMuc(cau, 4);
  const duPhong = (): KetQuaHoiDap =>
    khop[0] ? tuSo(khop[0].muc, lang) : { traLoi: loiChuaCoThongTin(lang), nguon: "chua-co", lienKet: [] };

  if (!coMoHinhAi()) return duPhong();
  if (!layLuotAi(opts.khoaKhach)) {
    const kq = duPhong();
    return kq.nguon === "chua-co" ? { ...kq, nguon: "gioi-han" } : kq;
  }

  // Câu không khớp mục nào: vẫn gửi bốn mục chung nhất để AI biết web có gì.
  const tuLieu = (khop.length ? khop.map((k) => k.muc) : (["dat-ve", "lien-he", "lap-hanh-trinh", "gia-ve-cong"].map(mucTheoId).filter(Boolean) as MucHoiDap[]))
    .map((m, i) => `[${i + 1}] ${m.hoi[lang]}\n${m.traLoi[lang]}`)
    .join("\n\n");
  const lichSu = (opts.lichSu ?? []).slice(-4).map((t) => ({
    role: t.vai === "khach" ? ("user" as const) : ("assistant" as const),
    content: t.chu.slice(0, 400),
  }));

  try {
    const { noiDung } = await hoiMoHinh({
      tinNhan: [
        { role: "system", content: `${huongDan(lang)}\n\n${lang === "en" ? "MATERIAL" : "TƯ LIỆU"}:\n${tuLieu}` },
        ...lichSu,
        { role: "user", content: cau },
      ],
      toiDaToken: 400,
      quyThoiGianMs: 9_000,
    });
    const kq: KetQuaHoiDap = {
      traLoi: noiDung.replace(/[*_#`]/g, "").slice(0, 900),
      nguon: "ai",
      // Chỉ kèm liên kết của mục khớp rõ; câu không dính gì tới sổ thì thôi.
      lienKet: khop.filter((k) => k.diem >= 2 && k.diem >= khop[0].diem * 0.7).slice(0, 2).flatMap((k) => lienKetCua(k.muc, lang)),
    };
    if (nho.size >= NHO_TOI_DA) nho.delete(nho.keys().next().value as string);
    // Câu tiếp nối phụ thuộc lịch sử, không nhớ chung cho mọi người.
    if (!lichSu.length) nho.set(khoaNho, kq);
    return kq;
  } catch (error) {
    console.error("Q&A model failed", error instanceof Error ? error.message : error);
    return duPhong();
  }
}
