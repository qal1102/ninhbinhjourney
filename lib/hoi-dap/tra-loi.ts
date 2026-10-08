import "server-only";

import { createHash } from "node:crypto";
import { CONTACT } from "@/content/contact";
import { z } from "zod";
import { PACKAGES } from "@/content/packages";
import { goiDaHetMua, goiHienThi } from "@/content/packages-en";
import { boDau, coYDatVe, loiChuaCoThongTin, mucTheoId, timMuc, traLoiThang, type MucHoiDap } from "@/domain/hoi-dap";
import { coMoHinhAi, hoiMoHinh } from "@/lib/ai/goi-mo-hinh";
import type { NgonNgu } from "@/lib/ngon-ngu";

/**
 * Trả lời một câu hỏi của khách, rẻ nhất trước:
 * 1. Bấm câu gợi ý hoặc câu khớp rõ một mục trong sổ: trả lời ngay, không AI.
 * 2. Câu đã hỏi gần đây: lấy lại câu trả lời đã nhớ.
 * 3. Câu lạ: hỏi AI, gửi kèm tối đa 4 mục khớp nhất làm tư liệu và danh sách
 *    gói. Dữ kiện của web (giá, gói, luật đặt) chỉ lấy trong tư liệu; chuyện
 *    du lịch Ninh Bình nói chung (món ăn, thời tiết, đi lại) thì AI được trả
 *    lời bằng hiểu biết chung, kèm lời nhắc hỏi lại tại chỗ (chủ dự án
 *    08/10/2026: "câu lạ nó không thèm trả lời, toàn kêu gọi số điện thoại").
 * 4. Khách nhờ đặt ("đặt giúp mình gói gia đình thứ bảy, 2 lớn 1 bé"): AI
 *    điền bản nháp đơn, máy chủ kiểm lại rồi trả đường tới trang đặt vé đã
 *    điền sẵn; khách chỉ còn chọn chuyến, để tên và trả tiền (giả lập).
 * Không có AI, hết lượt hay lỗi: trả mục khớp nhất, hoặc mời gọi điện.
 *
 * Bộ nhớ và giới hạn lượt nằm trong bộ nhớ của từng hàm máy chủ: đủ để chặn
 * một người bấm liên tục làm cạn lượt miễn phí lúc demo, không phải giới hạn
 * chính xác toàn cục.
 */

export type NguonTraLoi = "so" | "ai" | "nho" | "chua-co" | "gioi-han";

export type BanNhapDatVe = {
  goi: string;
  tenGoi: string;
  ngay: string | null;
  gio: string | null;
  nguoiLon: number;
  treEm: number;
  href: string;
};

export type KetQuaHoiDap = {
  traLoi: string;
  nguon: NguonTraLoi;
  lienKet: { href: string; nhan: string }[];
  datVe?: BanNhapDatVe;
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

const THU = ["Chủ nhật", "Thứ hai", "Thứ ba", "Thứ tư", "Thứ năm", "Thứ sáu", "Thứ bảy"];

function homNayVn(bayGio: Date) {
  const vn = new Date(bayGio.getTime() + 7 * 3_600_000);
  return { iso: vn.toISOString().slice(0, 10), thu: vn.getUTCDay() };
}

function danhSachGoi(lang: NgonNgu, bayGio: Date) {
  return PACKAGES.filter((g) => !goiDaHetMua(g, bayGio))
    .map((g) => {
      const c = goiHienThi(g, lang);
      return `${g.slug} | ${c.name} | ${c.durationLabel} | ${c.schedule.join("; ")}`;
    })
    .join("\n");
}

function huongDan(lang: NgonNgu, bayGio: Date) {
  const { iso, thu } = homNayVn(bayGio);
  return lang === "en"
    ? `You are "AI of Ninh Binh Journey", the AI assistant of a demo travel site for Ninh Binh, Vietnam. Visitors know they are talking to an AI.
Today in Vietnam is ${iso} (weekday index ${thu}, 0 = Sunday).
How to answer:
1. Facts about THIS site (package prices, what a package includes, booking rules, payment, children's tickets) come ONLY from the MATERIAL and the PACKAGES list. Prices are illustrative demo prices; say so when you quote one.
2. General questions about travelling in Ninh Binh (local food, weather by season, getting around, what to wear, nearby sights) may be answered from general knowledge. Keep to what is widely known, never name a specific restaurant or a price that is not in the material, and add a short note to check locally.
3. Only give the phone number ${CONTACT.phoneLabel} when the visitor needs a person: refunds or cancellations, complaints, special arrangements.
4. Any other question (maths, a joke, a short poem, general knowledge, chit-chat): answer it properly like a capable general AI, briefly. You may add one light sentence linking back to Ninh Binh, but do not refuse. If asked to insult someone or do something harmful, decline politely in one sentence and keep the tone friendly. No phone number here.
5. Booking: if the visitor wants you to book, fill "datVe" with the package slug from PACKAGES (pick the closest match), the date as YYYY-MM-DD (resolve words like "Saturday" from today), the departure time HH:MM if they gave one, adults and children (children = under 1.3 m). Leave unknown fields null; if no package fits, set "goi" to null and ask which package. In "traLoi" confirm what you filled and say they only need to pick the departure, leave a name and pay (demo payment) on the next page. If they are not booking, "datVe" is null.
Write "traLoi" in English, usually 1-3 short sentences (a short poem or joke may be a few lines), plain text, address the visitor as "you". Write dates in replies like "Saturday 10 October", never as 2026-10-10. Vary your wording; no greeting.`
    : `Bạn là "AI của Ninh Bình Journey", trợ lý AI của web du lịch Ninh Bình (bản thử). Khách biết mình đang nói chuyện với AI.
Hôm nay ở Việt Nam là ${iso} (${THU[thu]}).
Cách trả lời:
1. Dữ kiện của web này (giá gói, gói gồm gì, luật đặt chỗ, thanh toán, vé trẻ em) CHỈ lấy từ TƯ LIỆU và DANH SÁCH GÓI. Giá là giá minh hoạ của bản thử; nhắc điều đó khi nêu giá.
2. Câu hỏi chung về du lịch Ninh Bình (đặc sản, thời tiết theo mùa, đi lại, nên mặc gì, chỗ chơi gần) thì trả lời bằng hiểu biết chung, chỉ nói điều phổ biến, không nêu tên quán cụ thể hay giá không có trong tư liệu, và thêm một lời nhắc ngắn nên hỏi lại tại chỗ.
3. Chỉ đưa số ${CONTACT.phoneLabel} khi khách cần người thật: hoàn tiền, huỷ đơn, khiếu nại, sắp xếp riêng.
4. Mọi câu khác (toán, kể chuyện cười, làm bài thơ ngắn, kiến thức chung, nói chuyện phiếm): trả lời đàng hoàng như một AI đa năng, ngắn gọn. Có thể thêm một câu nhẹ nhàng nối về Ninh Bình, nhưng không từ chối. Bị nhờ chửi người hay làm điều có hại thì từ chối lịch sự trong một câu, giọng vẫn vui vẻ. Không đưa số điện thoại ở đây.
5. Đặt vé: khách nhờ đặt thì điền "datVe": "goi" là mã gói trong DANH SÁCH GÓI (chọn gói gần nhất), "ngay" dạng YYYY-MM-DD (tự tính "thứ bảy này", "mai" từ hôm nay), "gio" dạng HH:MM nếu khách nói giờ, "nguoiLon" và "treEm" (trẻ dưới 1m3). Không rõ thì để null; không gói nào hợp thì "goi" là null và hỏi khách muốn gói nào. Trong "traLoi" nhắc lại những gì đã điền, nói khách chỉ còn chọn chuyến, để tên và trả tiền (giả lập) ở trang sau. Không phải đặt vé thì "datVe" là null.
"traLoi" viết tiếng Việt có dấu, viết hoa đầu câu và tên riêng, không markdown, thường 1–3 câu ngắn (bài thơ hay chuyện cười ngắn thì được vài dòng), gọi khách là "bạn", không xưng "em", không thêm "ạ". Ngày trong câu trả lời viết kiểu "thứ bảy 10/10", không viết dạng 2026-10-10. Đổi cách nói theo từng câu, không chào.`;
}

const TraLoiAi = z.object({
  traLoi: z.string(),
  datVe: z
    .object({
      goi: z.string().nullable(),
      ngay: z.string().nullable(),
      gio: z.string().nullable(),
      nguoiLon: z.number().int().nullable(),
      treEm: z.number().int().nullable(),
    })
    .nullable(),
});

const KHUON_TRA_LOI: Record<string, unknown> = { ...z.toJSONSchema(TraLoiAi) };
delete KHUON_TRA_LOI.$schema;

/** Kiểm bản nháp đơn AI điền: gói có thật và còn bán, ngày không ở quá khứ, số người hợp lệ. */
export function kiemBanNhapDatVe(
  d: z.infer<typeof TraLoiAi>["datVe"],
  lang: NgonNgu,
  bayGio: Date,
): BanNhapDatVe | undefined {
  if (!d?.goi) return undefined;
  const goi = PACKAGES.find((g) => g.slug === d.goi);
  if (!goi || goiDaHetMua(goi, bayGio)) return undefined;
  const homNay = homNayVn(bayGio).iso;
  const ngay = d.ngay && /^\d{4}-\d{2}-\d{2}$/.test(d.ngay) && d.ngay >= homNay ? d.ngay : null;
  const gio = d.gio && /^([01]\d|2[0-3]):[0-5]\d$/.test(d.gio) ? d.gio : null;
  const nguoiLon = goi.fixedPartySize ?? Math.min(45, Math.max(1, d.nguoiLon ?? 2));
  const treEm = goi.fixedPartySize ? 0 : Math.min(45 - nguoiLon, Math.max(0, d.treEm ?? 0));
  const q = new URLSearchParams({ package: goi.slug, nguoiLon: String(nguoiLon), treEm: String(treEm), lang });
  if (ngay) q.set("ngay", ngay);
  if (gio) q.set("gio", gio);
  return { goi: goi.slug, tenGoi: goiHienThi(goi, lang).name, ngay, gio, nguoiLon, treEm, href: `/checkout?${q}` };
}

export async function traLoiCauHoi(opts: {
  cau: string;
  lang: NgonNgu;
  mucId?: string;
  lichSu?: TinCu[];
  khoaKhach: string;
  bayGio?: Date;
}): Promise<KetQuaHoiDap> {
  const { cau, lang } = opts;
  const bayGio = opts.bayGio ?? new Date();
  const datVe = coYDatVe(cau);

  if (opts.mucId) {
    const muc = mucTheoId(opts.mucId);
    if (muc) return tuSo(muc, lang);
  }

  const thang = datVe ? null : traLoiThang(cau);
  if (thang) return tuSo(thang, lang);

  // Nhờ đặt thì không nhớ chung: "thứ bảy này" mỗi tuần một ngày khác.
  const khoaNho = `${lang}:${boDau(cau)}`;
  const daNho = datVe ? undefined : nho.get(khoaNho);
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
        {
          role: "system",
          content: `${huongDan(lang, bayGio)}\n\n${lang === "en" ? "PACKAGES (slug | name | length | schedule)" : "DANH SÁCH GÓI (mã | tên | thời lượng | lịch)"}:\n${danhSachGoi(lang, bayGio)}\n\n${lang === "en" ? "MATERIAL" : "TƯ LIỆU"}:\n${tuLieu}`,
        },
        ...lichSu,
        { role: "user", content: cau },
      ],
      khuon: { ten: "tra_loi", schema: KHUON_TRA_LOI },
      toiDaToken: 600,
      nhietDo: 0.5,
      quyThoiGianMs: 9_000,
    });
    const doc = TraLoiAi.safeParse(JSON.parse(noiDung));
    if (!doc.success || !doc.data.traLoi.trim()) return duPhong();
    const banNhap = kiemBanNhapDatVe(doc.data.datVe, lang, bayGio);
    const kq: KetQuaHoiDap = {
      traLoi: doc.data.traLoi.replace(/[*_#`]/g, "").trim().slice(0, 900),
      ...(banNhap ? { datVe: banNhap } : {}),
      nguon: "ai",
      // Chỉ kèm liên kết của mục khớp rõ; câu không dính gì tới sổ thì thôi.
      lienKet: [...new Map(khop.filter((k) => k.diem >= 2 && k.diem >= khop[0].diem * 0.7).slice(0, 2).flatMap((k) => lienKetCua(k.muc, lang)).map((l) => [l.href, l])).values()],
    };
    if (nho.size >= NHO_TOI_DA) nho.delete(nho.keys().next().value as string);
    // Câu tiếp nối phụ thuộc lịch sử, không nhớ chung cho mọi người.
    if (!lichSu.length && !datVe && !banNhap) nho.set(khoaNho, kq);
    return kq;
  } catch (error) {
    console.error("Q&A model failed", error instanceof Error ? error.message : error);
    return duPhong();
  }
}
