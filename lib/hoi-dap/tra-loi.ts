import "server-only";

import { createHash } from "node:crypto";
import { CONTACT } from "@/content/contact";
import { z } from "zod";
import { PACKAGES } from "@/content/packages";
import { goiDaHetMua, goiHienThi } from "@/content/packages-en";
import { banDoHeThong, boDau, coYDatVe, loiChuaCoThongTin, mucTheoId, SO_HOI_DAP, timMuc, traLoiThang, type MucHoiDap } from "@/domain/hoi-dap";
import { ERP_ROLE_LABELS, type ErpRole } from "@/domain/erp";
import { tinhTrangHoaSung } from "@/domain/mua-hoa-sung";
import { coMoHinhAi, hoiMoHinh } from "@/lib/ai/goi-mo-hinh";
import { cacChuongMua } from "@/lib/seasonal/cac-mua";
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
 * 5. Hỏi về web hay ERP (10/10/2026, chủ dự án: "hỏi bất kì cái gì về web và
 *    ERP đều có thể trả lời được, không phải cứ reply không biết"): sổ có mọi
 *    chức năng của bản đồ chức năng, mỗi lần hỏi AI đều kèm bản đồ gọn của cả
 *    hệ thống. Trợ lý trong ERP gọi cùng hàm này với `phamVi: "erp"`.
 * Không có AI, hết lượt hay lỗi: trả mục khớp nhất, hoặc nói giúp được gì.
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
// Người chấm hỏi dồn liền tay: 5 lượt/phút cũ chạm trần ngay rồi trả câu dự phòng.
export const GIOI_HAN_AI = { moiPhut: 12, moiNgay: 200 } as const;
const luotAi = new Map<string, number[]>();

function lienKetCua(muc: MucHoiDap | undefined, lang: NgonNgu) {
  return muc?.lienKet ? [{ href: muc.lienKet.href, nhan: muc.lienKet.nhan[lang] }] : [];
}

function tuSo(muc: MucHoiDap, lang: NgonNgu): KetQuaHoiDap {
  return { traLoi: muc.traLoi[lang], nguon: "so", lienKet: lienKetCua(muc, lang) };
}

/** Câu tiếng Việt đủ dài mà không một chữ nào có dấu: mẫu đã bỏ dấu. */
export function thieuDau(chu: string): boolean {
  return chu.length > 40 && !/[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(chu);
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

export type PhamViHoi = "web" | "erp";

/** Trang công khai AI được chỉ tới dù không có mục riêng trong sổ. */
const TRANG_CONG_KHAI: Record<string, { vi: string; en: string }> = {
  "/packages": { vi: "Xem các gói", en: "See packages" },
  "/plan": { vi: "Lập lịch đi", en: "Plan a day" },
  "/explore": { vi: "Khám phá", en: "Explore" },
  "/tra-cuu-ve": { vi: "Tra cứu vé", en: "Find my ticket" },
  "/ho-so": { vi: "Hộ chiếu của tôi", en: "My passport" },
  "/seasonal": { vi: "Sự kiện theo mùa", en: "Seasonal" },
  "/seasonal/hoa-sung": { vi: "Mùa hoa súng", en: "Water lily season" },
  "/erp/huong-dan": { vi: "Dạo một vòng", en: "Guided tour" },
  "/erp/finance": { vi: "Tài chính tổng hợp", en: "Finance" },
};

/** Lịch mùa tính theo hôm nay: mùa hoa súng, lễ Sắc Hồng, mùa nào đang mở hay đã khép. */
function lichMua(bayGio: Date): string {
  const hs = tinhTrangHoaSung(bayGio);
  const ngay = (iso: string) => iso.split("-").reverse().join("/");
  return [
    `Mùa hoa súng Tam Cốc ${hs.mua.nam}: ${ngay(hs.mua.tu)}–${ngay(hs.mua.den)} (ước lượng), hoa nở đẹp nhất khoảng 7:15–9:45 sáng; ${hs.giaiDoan === "sap-toi" ? `còn ${hs.ngayToiMua} ngày nữa vào mùa` : "đang trong mùa"}. Trang /seasonal/hoa-sung, gói "Đò sớm mùa hoa súng" chỉ bán trong mùa.`,
    `Lễ Sắc Hồng: ${ngay(hs.mua.le.tu)}–${ngay(hs.mua.le.den)}${hs.mua.le.chacChan === "du-kien" ? " (dự kiến, chờ công bố)" : ""}.`,
    ...cacChuongMua(bayGio).map((c) => `${c.ten.vi}: ${c.nhanTrangThai.vi} (${c.duongDan}).`),
  ].join("\n");
}

function huongDanErp(bayGio: Date, vai: ErpRole | undefined) {
  const { iso, thu } = homNayVn(bayGio);
  return `Bạn là "Trợ lý AI" trong ERP, hệ thống điều hành nội bộ của Ninh Bình Journey (bản thử, dữ liệu mẫu). Người hỏi là nhân sự đang đăng nhập${vai ? ` với vai ${ERP_ROLE_LABELS[vai]}` : ""}.
Hôm nay ở Việt Nam là ${iso} (${THU[thu]}).
Cách trả lời:
1. Câu về cách dùng ERP (việc X làm ở màn nào, vai nào làm, các bước, ai duyệt, trạng thái nghĩa là gì) trả lời từ TƯ LIỆU và BẢN ĐỒ HỆ THỐNG: nói màn nào, vai nào, các bước chính. Việc của vai khác thì nói vai nào làm; giám đốc làm thử bằng "Xem theo vai trò" trên thanh đầu trang. Điền "manHinh" bằng đường dẫn màn phù hợp nhất lấy đúng từ tư liệu (bắt đầu bằng /erp), không có thì null.
2. Số liệu sống (doanh thu, số khách, công nợ, việc gấp hôm nay) thì không đoán số: bảo người hỏi gõ ngay trong trợ lý "doanh thu hôm nay bao nhiêu", "bao nhiêu khách hôm nay", "việc gấp" hoặc mở màn tương ứng.
3. Câu về web khách, du lịch Ninh Bình, nghiệp vụ chung (kế toán, chấm công, an toàn bến thuyền) hay kiến thức chung: trả lời bằng hiểu biết, ngắn, đúng mực.
4. Không bao giờ chỉ đáp "không biết" hay "chưa có thông tin". Tư liệu không có đúng chi tiết thì nói phần gần nhất hệ thống có, và màn nên mở để xem.
Gọi màn bằng đúng tên có trong tư liệu hay bản đồ hệ thống (ví dụ "màn Tài chính tổng hợp"), không tự đặt tên màn, không ghi đường dẫn dạng /erp/... trong "traLoi": nút mở màn lấy từ "manHinh".
"traLoi" viết tiếng Việt có dấu, không markdown, 1–4 câu; hướng dẫn thao tác thì viết các bước liền nhau kiểu "Mở…, bấm…, rồi…". Gọi người hỏi là "bạn", không xưng "em", không thêm "ạ", không chào. "datVe" luôn null.`;
}

function huongDan(lang: NgonNgu, bayGio: Date, phamVi: PhamViHoi = "web", vai?: ErpRole) {
  if (phamVi === "erp") return huongDanErp(bayGio, vai);
  const { iso, thu } = homNayVn(bayGio);
  return lang === "en"
    ? `You are "AI of Ninh Binh Journey", the AI assistant of a demo travel site for Ninh Binh, Vietnam. Visitors know they are talking to an AI.
Today in Vietnam is ${iso} (weekday index ${thu}, 0 = Sunday).
How to answer:
1. Facts about THIS site (package prices, what a package includes, booking rules, payment, children's tickets, what each page does) come from the MATERIAL, the PACKAGES list and the SYSTEM MAP. Prices are illustrative demo prices; say so when you quote one. If the exact detail is not there, never just say there is no information: say what the site does have that comes closest and which page to open.
Name pages in words, using only names found in the material or system map ("the Packages page"), never invent a page name; never write paths like /packages in "traLoi". Put the single most useful page path from the material or system map in "manHinh" (null if none) and it becomes a button.
2. General questions about travelling in Ninh Binh (local food, weather by season, getting around, what to wear, nearby sights) may be answered from general knowledge. Keep to what is widely known, never name a specific restaurant or a price that is not in the material, never claim an on-site facility (wifi, lockers, parking fees) exists when the material does not say so, and add a short note to check locally.
The visitor is a traveller: do not send them to ERP screens unless they ask about the ERP or staff work.
3. Only give the phone number ${CONTACT.phoneLabel} when the visitor needs a person: refunds or cancellations, complaints, special arrangements.
4. Any other question (maths, a joke, a short poem, general knowledge, chit-chat): answer it properly like a capable general AI, briefly. You may add one light sentence linking back to Ninh Binh, but do not refuse. If asked to insult someone or do something harmful, decline politely in one sentence and keep the tone friendly. No phone number here.
6. Questions about the internal ERP (the operations system for staff at /erp): answer from the SYSTEM MAP and MATERIAL: what it does, which screen, which role. It needs a staff login; inside the ERP the "Dạo một vòng" screen walks through every function.
5. Booking: if the visitor wants you to book, fill "datVe" with the package slug from PACKAGES (pick the closest match), the date as YYYY-MM-DD (resolve words like "Saturday" from today), the departure time HH:MM if they gave one, adults and children (children = under 1.3 m). Leave unknown fields null; if no package fits, set "goi" to null and ask which package. In "traLoi" confirm what you filled and say they only need to pick the departure, leave a name and pay (demo payment) on the next page. If they are not booking, "datVe" is null.
Write "traLoi" in English, usually 1-3 short sentences (a short poem or joke may be a few lines), plain text, address the visitor as "you". Write dates in replies like "Saturday 10 October", never as 2026-10-10. Vary your wording; no greeting.`
    : `Bạn là "AI của Ninh Bình Journey", trợ lý AI của web du lịch Ninh Bình (bản thử). Khách biết mình đang nói chuyện với AI.
Hôm nay ở Việt Nam là ${iso} (${THU[thu]}).
Cách trả lời:
1. Dữ kiện của web này (giá gói, gói gồm gì, luật đặt chỗ, thanh toán, vé trẻ em, trang nào làm gì) lấy từ TƯ LIỆU, DANH SÁCH GÓI và BẢN ĐỒ HỆ THỐNG. Giá là giá minh hoạ của bản thử; nhắc điều đó khi nêu giá. Không có đúng chi tiết thì không bao giờ chỉ đáp "chưa có thông tin": nói điều gần nhất web có và trang nên mở.
Gọi trang bằng đúng tên có trong tư liệu hay bản đồ hệ thống ("trang Gói đi sẵn"), không tự đặt tên trang, không ghi đường dẫn dạng /packages trong "traLoi". Đặt đường dẫn trang hữu ích nhất (lấy đúng từ tư liệu hay bản đồ hệ thống) vào "manHinh", không có thì null; nó thành nút bấm.
2. Câu hỏi chung về du lịch Ninh Bình (đặc sản, thời tiết theo mùa, đi lại, nên mặc gì, chỗ chơi gần) thì trả lời bằng hiểu biết chung, chỉ nói điều phổ biến, không nêu tên quán cụ thể hay giá không có trong tư liệu, không khẳng định tiện ích tại chỗ (wifi, tủ gửi đồ, phí gửi xe) khi tư liệu không nói, và thêm một lời nhắc ngắn nên hỏi lại tại chỗ.
Người hỏi là khách du lịch: đừng chỉ sang màn ERP trừ khi họ hỏi về ERP hay việc của nhân sự.
3. Chỉ đưa số ${CONTACT.phoneLabel} khi khách cần người thật: hoàn tiền, huỷ đơn, khiếu nại, sắp xếp riêng.
4. Mọi câu khác (toán, kể chuyện cười, làm bài thơ ngắn, kiến thức chung, nói chuyện phiếm): trả lời đàng hoàng như một AI đa năng, ngắn gọn. Có thể thêm một câu nhẹ nhàng nối về Ninh Bình, nhưng không từ chối. Bị nhờ chửi người hay làm điều có hại thì từ chối lịch sự trong một câu, giọng vẫn vui vẻ. Không đưa số điện thoại ở đây.
6. Câu về ERP (hệ thống điều hành nội bộ cho nhân sự, ở /erp): trả lời từ BẢN ĐỒ HỆ THỐNG và TƯ LIỆU: làm được gì, màn nào, vai nào. Cần tài khoản nhân sự để vào; trong ERP có màn "Dạo một vòng" hướng dẫn bấm thử từng chức năng.
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
  manHinh: z.string().nullish(),
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
  phamVi?: PhamViHoi;
  vai?: ErpRole;
}): Promise<KetQuaHoiDap> {
  const { cau, lang } = opts;
  const phamVi = opts.phamVi ?? "web";
  // Web khách không dẫn sang màn ERP (cần đăng nhập nhân sự); ERP thì dẫn hết.
  const choDan = (href: string) => phamVi === "erp" || !href.startsWith("/erp");
  const lienKetHop = (muc: MucHoiDap | undefined) => lienKetCua(muc, lang).filter((l) => choDan(l.href));
  const bayGio = opts.bayGio ?? new Date();
  const datVe = coYDatVe(cau);

  if (opts.mucId) {
    const muc = mucTheoId(opts.mucId);
    if (muc) return tuSo(muc, lang);
  }

  const thang = datVe || phamVi === "erp" ? null : traLoiThang(cau);
  if (thang) return tuSo(thang, lang);

  // Nhờ đặt thì không nhớ chung: "thứ bảy này" mỗi tuần một ngày khác.
  const khoaNho = `${phamVi}:${opts.vai ?? ""}:${lang}:${boDau(cau)}`;
  const daNho = datVe ? undefined : nho.get(khoaNho);
  if (daNho) return { ...daNho, nguon: "nho" };

  const khop = timMuc(cau, 5);
  const duPhong = (): KetQuaHoiDap =>
    khop[0]
      ? { traLoi: khop[0].muc.traLoi[lang], nguon: "so", lienKet: lienKetHop(khop[0].muc) }
      : {
          traLoi: loiChuaCoThongTin(lang),
          nguon: "chua-co",
          lienKet:
            phamVi === "erp"
              ? [{ href: "/erp/huong-dan", nhan: "Dạo một vòng" }]
              : [
                  { href: "/packages", nhan: lang === "en" ? "See packages" : "Xem các gói" },
                  { href: "/plan", nhan: lang === "en" ? "Plan a day" : "Lập lịch đi" },
                ],
        };

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
    const hoi = () => hoiMoHinh({
      tinNhan: [
        {
          role: "system",
          content: `${huongDan(lang, bayGio, phamVi, opts.vai)}\n\n${lang === "en" ? "PACKAGES (slug | name | length | schedule)" : "DANH SÁCH GÓI (mã | tên | thời lượng | lịch)"}:\n${danhSachGoi(lang, bayGio)}\n\n${lang === "en" ? "SYSTEM MAP (in Vietnamese)" : "BẢN ĐỒ HỆ THỐNG"}:\n${banDoHeThong()}\n\n${lang === "en" ? "SEASONS (in Vietnamese)" : "LỊCH MÙA"}:\n${lichMua(bayGio)}\n\n${lang === "en" ? "MATERIAL" : "TƯ LIỆU"}:\n${tuLieu}`,
        },
        ...lichSu,
        { role: "user", content: cau },
      ],
      khuon: { ten: "tra_loi", schema: KHUON_TRA_LOI },
      toiDaToken: 900,
      nhietDo: 0.5,
      quyThoiGianMs: 9_000,
    });
    let doc = TraLoiAi.safeParse(JSON.parse((await hoi()).noiDung));
    // Mẫu nhẹ thỉnh thoảng trả tiếng Việt không dấu (soát 10/10/2026: "Chot ca
    // la viec…"). Hỏi lại một lần; vẫn không dấu thì dùng câu trong sổ.
    if (doc.success && lang === "vi" && thieuDau(doc.data.traLoi)) {
      doc = TraLoiAi.safeParse(JSON.parse((await hoi()).noiDung));
      if (doc.success && thieuDau(doc.data.traLoi)) return duPhong();
    }
    if (!doc.success || !doc.data.traLoi.trim()) return duPhong();
    const banNhap = phamVi === "erp" ? undefined : kiemBanNhapDatVe(doc.data.datVe, lang, bayGio);
    // Màn AI chỉ ra chỉ nhận khi trùng một đường dẫn có thật trong sổ.
    const manHinh = doc.data.manHinh?.trim();
    const lienKetAi =
      manHinh && choDan(manHinh)
        ? (SO_HOI_DAP.map((m) => m.lienKet).find((l) => l?.href === manHinh) ??
          (TRANG_CONG_KHAI[manHinh] ? { href: manHinh, nhan: TRANG_CONG_KHAI[manHinh] } : undefined))
        : undefined;
    const kq: KetQuaHoiDap = {
      traLoi: doc.data.traLoi.replace(/[*_#`]/g, "").trim().slice(0, 1400),
      ...(banNhap ? { datVe: banNhap } : {}),
      nguon: "ai",
      // Chỉ kèm liên kết của mục khớp rõ; câu không dính gì tới sổ thì thôi.
      lienKet: [
        ...new Map(
          [
            ...(lienKetAi ? [{ href: lienKetAi.href, nhan: lienKetAi.nhan[lang] }] : []),
            ...khop.filter((k) => k.diem >= 2 && k.diem >= khop[0].diem * 0.7).slice(0, 2).flatMap((k) => lienKetHop(k.muc)),
          ].map((l) => [l.href, l]),
        ).values(),
      ].slice(0, 2),
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
