import { CONTACT } from "@/content/contact";
import { DESTINATION_PAGE_SLUGS, destinationFacts, destinations, type DestinationId } from "@/content/landing-destinations";
import { PACKAGES } from "@/content/packages";
import { giaGoi, goiHienThi } from "@/content/packages-en";
import { BAN_DO_CHUC_NANG, CHUC_NANG_WEB, TEN_NHOM_WEB } from "@/domain/ban-do-chuc-nang";
import { ERP_MODULES, ERP_ROLE_LABELS, ERP_SITES } from "@/domain/erp";
import type { NgonNgu } from "@/lib/ngon-ngu";

/**
 * Sổ hỏi đáp của web khách (08/10/2026). Chủ dự án muốn khách bấm vào một
 * khung là hỏi được, và "đưa sẵn nội dung cho AI để đỡ tốn lượt".
 *
 * Mọi câu trả lời lấy từ nội dung đã có trong dự án: gói (`content/packages`),
 * điểm đến (`content/landing-destinations`), luật đặt chỗ đang chạy
 * (`domain/customer-booking`, trang đặt vé), số điện thoại (`content/contact`).
 * Không có chính sách hoàn huỷ hay giá vé cổng trong dự án, nên sổ không có mục
 * ấy; câu hỏi như vậy được trả lời là chưa có thông tin và mời gọi điện.
 *
 * Mục `thang` trả lời ngay, không gọi AI. Mục gói và điểm đến dài, nên khi có
 * AI thì gửi vài mục khớp nhất làm tư liệu để AI trả lời đúng ý câu hỏi.
 */

type Chu = Record<NgonNgu, string>;

export type MucHoiDap = {
  id: string;
  /** Câu hỏi mẫu, cũng là nhãn của nút gợi ý. */
  hoi: Chu;
  traLoi: Chu;
  /** Từ khoá đã bỏ dấu; tên riêng nặng gấp đôi. */
  tuKhoa: string[];
  tenRieng: string[];
  /** Từ hay cụm từ nói thẳng ý câu hỏi ("tre em", "thanh toan"), nặng gấp đôi. */
  tuChinh?: string[];
  thang: boolean;
  lienKet?: { href: string; nhan: Chu };
  /** Mục dựng từ bản đồ chức năng: của web khách hay của ERP. */
  pham?: "web" | "erp";
};

export function boDau(chu: string): string {
  return chu
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const TU_DEM = new Set(
  (
    "la co khong toi minh o the nao gi bao nhieu cho va cua duoc a nhe oi ban em anh chi thi ma nay do roi can muon hoi xin vay voi " +
    "the a an is are how what do does i to of in for can my me we you it on at be with about please much many which"
  ).split(" "),
);
// "an" (Tràng An) và "a" là chữ đệm tiếng Anh: giữ "an" vì tên riêng, bỏ khỏi danh sách đệm.
TU_DEM.delete("an");

export function tachTu(chu: string): string[] {
  return boDau(chu)
    .split(" ")
    .filter((t) => t.length > 0 && !TU_DEM.has(t));
}

const dienThoai = CONTACT.phoneLabel;

const CO_DINH: MucHoiDap[] = [
  {
    id: "dat-ve",
    hoi: { vi: "Đặt vé thế nào?", en: "How do I book?" },
    traLoi: {
      vi: "Chọn một gói ở trang Gói đi sẵn (hoặc lập hành trình), chọn ngày và chuyến, giữ chỗ 15 phút rồi thanh toán bằng mã QR hoặc trả tại quầy. Đây là bản thử: thanh toán chỉ giả lập, không trừ tiền thật.",
      en: "Pick a package (or build a journey), choose the date and departure, hold seats for 15 minutes, then pay by QR code or at the counter. This is a demo: payment is simulated and no money is taken.",
    },
    tuKhoa: ["dat", "ve", "book", "booking", "mua", "giu", "cho", "reserve", "ticket", "dang", "ky"],
    tenRieng: [],
    tuChinh: ["dat ve","dat cho","book","booking"],
    thang: true,
    lienKet: { href: "/packages", nhan: { vi: "Xem các gói", en: "See packages" } },
  },
  {
    id: "tre-em",
    hoi: { vi: "Trẻ em có mất vé không?", en: "Do children need a ticket?" },
    traLoi: {
      vi: "Trẻ dưới 1m3 không mất vé. Mỗi đơn cần ít nhất một người lớn, và một đơn đặt trên web tối đa 45 người.",
      en: "Children under 1.3 m go free. Each booking needs at least one adult, and one web booking covers up to 45 people.",
    },
    tuKhoa: ["tre", "em", "con", "be", "chau", "child", "children", "kid", "kids", "nho", "1m3", "nguoi", "lon", "45"],
    tenRieng: [],
    tuChinh: ["tre em","tre","children","child","kid","kids","1m3"],
    thang: true,
  },
  {
    id: "thanh-toan",
    hoi: { vi: "Thanh toán bằng gì?", en: "How do I pay?" },
    traLoi: {
      vi: "Trả bằng mã QR ngay khi đặt, hoặc trả tại quầy khi tới. Đây là bản thử: quét QR chỉ giả lập, không trừ tiền thật.",
      en: "Pay by QR code when booking, or at the counter on arrival. This is a demo: the QR payment is simulated and no money is taken.",
    },
    tuKhoa: ["thanh", "toan", "tra", "tien", "qr", "chuyen", "khoan", "pay", "payment", "card", "the", "quay", "counter"],
    tenRieng: [],
    tuChinh: ["thanh toan","pay","payment","qr"],
    thang: true,
  },
  {
    id: "giu-cho",
    hoi: { vi: "Giữ chỗ được bao lâu?", en: "How long is a hold kept?" },
    traLoi: {
      vi: "Chỗ được giữ 15 phút để thanh toán. Chuyến sắp chạy trong 5 phút tới thì không nhận giữ chỗ nữa.",
      en: "Seats are held for 15 minutes while you pay. Departures starting within the next 5 minutes can no longer be held.",
    },
    tuKhoa: ["giu", "cho", "hold", "15", "phut", "het", "han", "minutes", "expire"],
    tenRieng: [],
    tuChinh: ["giu cho","hold"],
    thang: true,
  },
  {
    id: "tra-cuu-ve",
    hoi: { vi: "Tra cứu vé đã đặt ở đâu?", en: "Where can I find my ticket?" },
    traLoi: {
      vi: "Vào trang Tra cứu vé, nhập mã đơn (dạng NBJ-…) cùng số điện thoại hoặc email đã dùng khi đặt để xem lại vé.",
      en: "Open the ticket lookup page and enter your booking code (NBJ-…) with the phone number or email you booked with.",
    },
    tuKhoa: ["tra", "cuu", "xem", "lai", "ve", "ma", "don", "lookup", "find", "my", "ticket", "code", "qr"],
    tenRieng: [],
    tuChinh: ["tra cuu","lookup","ma don","my ticket"],
    thang: true,
    lienKet: { href: "/tra-cuu-ve", nhan: { vi: "Tra cứu vé", en: "Find my ticket" } },
  },
  {
    id: "lap-hanh-trinh",
    hoi: { vi: "Đi mấy ngày thì hợp?", en: "Can you plan my trip?" },
    traLoi: {
      vi: "Trang Lập hành trình nhận lời kể thường ngày như \"2 ngày, đi với bố mẹ, thích đi chậm\" rồi xếp các điểm theo giờ, kèm gói hợp nhất để đặt.",
      en: "The journey planner takes plain words such as \"2 days, with my parents, slow pace\" and lays out the places by hour, with the best-fitting package to book.",
    },
    tuKhoa: ["lich", "trinh", "hanh", "ngay", "may", "plan", "trip", "itinerary", "days", "route", "goi", "y", "suggest"],
    tenRieng: [],
    tuChinh: ["lich trinh","hanh trinh","plan","itinerary"],
    thang: true,
    lienKet: { href: "/plan", nhan: { vi: "Lập hành trình", en: "Plan a journey" } },
  },
  {
    id: "lien-he",
    hoi: { vi: "Gọi cho ai khi cần?", en: "How do I contact you?" },
    traLoi: {
      vi: `Gọi ${dienThoai} để hỏi thêm hay nhờ đặt giúp.`,
      en: `Call ${dienThoai} for questions or help with a booking.`,
    },
    tuKhoa: ["lien", "he", "goi", "dien", "thoai", "so", "hotline", "contact", "phone", "call", "email", "ho", "tro", "help"],
    tenRieng: [],
    tuChinh: ["lien he","so dien thoai","hotline","contact","phone","call"],
    thang: true,
  },
  {
    id: "gia-ve-cong",
    hoi: { vi: "Giá vé tham quan bao nhiêu?", en: "How much are entrance tickets?" },
    traLoi: {
      vi: "Giá vé cổng và thuyền có thể đổi theo mùa, nên kiểm tra tại cổng khi tới. Giá các gói trên web là giá minh hoạ của bản thử.",
      en: "Gate and boat prices can change by season, so check at the gate on arrival. Package prices on this site are illustrative demo prices.",
    },
    tuKhoa: ["gia", "ve", "bao", "nhieu", "tien", "price", "cost", "fee", "entrance", "cong", "thuyen"],
    tenRieng: [],
    tuChinh: ["gia ve","bao nhieu tien","entrance","price","cost"],
    thang: true,
  },
];

function tuGoi(): MucHoiDap[] {
  return PACKAGES.map((goi) => {
    const vi = goiHienThi(goi, "vi");
    const en = goiHienThi(goi, "en");
    const viet = (g: typeof vi, lang: NgonNgu) =>
      [
        lang === "en"
          ? `${g.name}: ${g.durationLabel}, ${giaGoi(goi, "en")} (illustrative demo price). For: ${g.audience}.`
          : `${g.name}: ${g.durationLabel}, ${giaGoi(goi, "vi")} (giá minh hoạ của bản thử). Hợp với: ${g.audience}.`,
        g.inclusions.length ? (lang === "en" ? `Includes: ${g.inclusions.join("; ")}.` : `Gồm: ${g.inclusions.join("; ")}.`) : "",
        g.exclusions.length ? (lang === "en" ? `Not included: ${g.exclusions.join("; ")}.` : `Không gồm: ${g.exclusions.join("; ")}.`) : "",
        g.schedule.length ? (lang === "en" ? `Schedule: ${g.schedule.join("; ")}.` : `Lịch: ${g.schedule.join("; ")}.`) : "",
      ]
        .filter(Boolean)
        .join(" ");
    return {
      id: `goi-${goi.slug}`,
      hoi: { vi: `Gói ${vi.name}`, en: `${en.name} package` },
      traLoi: { vi: viet(vi, "vi"), en: viet(en, "en") },
      tuKhoa: [...tachTu(vi.audience), ...tachTu(en.audience), "goi", "tour", "package", "gia"],
      tenRieng: [...new Set([...tachTu(vi.name), ...tachTu(en.name)])],
      thang: false,
      lienKet: { href: `/packages/${goi.slug}`, nhan: { vi: `Gói ${vi.name}`, en: en.name } },
    };
  });
}

function tuDiemDen(): MucHoiDap[] {
  return destinations.flatMap((d) => {
    const f = destinationFacts[d.id as DestinationId];
    if (!f) return [];
    const viet = (lang: NgonNgu) =>
      [
        f.significance[lang],
        (lang === "en" ? "Best time: " : "Nên đi: ") + f.bestTime[lang],
        (lang === "en" ? "Crowds: " : "Đông khách: ") + f.crowdTip[lang],
        (lang === "en" ? "Getting there: " : "Đường đi: ") + f.gettingThere[lang],
        (lang === "en" ? "Tickets: " : "Vé: ") + f.entranceFee[lang],
        ...f.practical[lang],
      ].join(" ");
    return [
      {
        id: `diem-${d.id}`,
        hoi: { vi: `Đi ${d.name.vi} có gì?`, en: `What about ${d.name.en}?` },
        traLoi: { vi: viet("vi"), en: viet("en") },
        tuKhoa: ["diem", "den", "tham", "quan", "place", "visit", "di", "dau", "where", ...tachTu(d.category.vi), ...tachTu(d.category.en)],
        tenRieng: [...new Set([...tachTu(d.name.vi), ...tachTu(d.name.en)])],
        thang: false,
        lienKet: { href: `/destination/${DESTINATION_PAGE_SLUGS[d.id as DestinationId]}`, nhan: { vi: d.name.vi, en: d.name.en } },
      },
    ];
  });
}

/**
 * Mỗi chức năng của web và ERP thành một mục (10/10/2026, chủ dự án: "hỏi bất
 * kì cái gì về web và ERP đều trả lời được, không phải cứ reply không biết").
 * Lấy nguyên từ bản đồ chức năng của màn Dạo một vòng, nên thêm chức năng ở đó
 * là AI biết luôn. Chữ chỉ có tiếng Việt; AI dịch khi khách hỏi tiếng Anh.
 * Mục chức năng không bao giờ trả thẳng (`thang: false`).
 */
function tuChucNang(): MucHoiDap[] {
  const tuKhoaCua = (...chu: string[]) => [...new Set(chu.flatMap(tachTu).filter((t) => t.length > 1))];
  const web = CHUC_NANG_WEB.map((cn): MucHoiDap => {
    const chu = `${cn.moTa} Cách làm: ${cn.cacViec.join(" ")} Trang: ${cn.duongDan}`;
    return {
      id: `web-${cn.id}`,
      hoi: { vi: cn.ten, en: cn.ten },
      traLoi: { vi: chu, en: chu },
      tuKhoa: tuKhoaCua(cn.ten, cn.moTa),
      tenRieng: [],
      thang: false,
      pham: "web",
      lienKet: { href: cn.duongDan, nhan: { vi: "Mở trang này", en: "Open this page" } },
    };
  });
  const erp = BAN_DO_CHUC_NANG.flatMap((nhom) =>
    nhom.chucNang.map((cn): MucHoiDap => {
      const duongDan = cn.duongDan.replace("{site}", "trang-an");
      const chu = `${cn.moTa} Vai làm: ${ERP_ROLE_LABELS[cn.vai]}. Màn: ${duongDan}. Các bước: ${cn.cacViec.join(" ")}`;
      return {
        id: `erp-${cn.id}`,
        hoi: { vi: cn.ten, en: cn.ten },
        traLoi: { vi: chu, en: chu },
        tuKhoa: tuKhoaCua(cn.ten, cn.moTa, nhom.ten, "erp he thong dieu hanh"),
        tenRieng: [],
        thang: false,
        pham: "erp",
        lienKet: { href: duongDan, nhan: { vi: "Mở màn này", en: "Open this screen" } },
      };
    }),
  );
  const moDun = ERP_MODULES.map((m): MucHoiDap => {
    const chu = `Module "${m.name}" của ERP, có ở từng cơ sở (Tràng An, Tam Cốc, Tam Chúc, Bái Đính): ${m.description} Màn: /erp/trang-an/${m.id}.`;
    return {
      id: `erp-module-${m.id}`,
      hoi: { vi: m.name, en: m.name },
      traLoi: { vi: chu, en: chu },
      tuKhoa: tuKhoaCua(m.name, m.description, "module erp"),
      tenRieng: [],
      thang: false,
      pham: "erp",
      lienKet: { href: `/erp/trang-an/${m.id}`, nhan: { vi: "Mở module này", en: "Open this module" } },
    };
  });
  return [...web, ...erp, ...moDun];
}

export const SO_HOI_DAP: readonly MucHoiDap[] = [...CO_DINH, ...tuGoi(), ...tuDiemDen(), ...tuChucNang()];

/**
 * Bản đồ gọn của cả web lẫn ERP, gửi kèm mọi lần hỏi AI để AI biết hệ thống
 * có những gì, kể cả khi câu hỏi không trúng mục nào trong sổ.
 */
export function banDoHeThong(): string {
  const web = (Object.keys(TEN_NHOM_WEB) as (keyof typeof TEN_NHOM_WEB)[])
    .filter((nhom) => nhom !== "hieu-ung")
    .map((nhom) => `- ${TEN_NHOM_WEB[nhom]}: ${CHUC_NANG_WEB.filter((c) => c.nhom === nhom).map((c) => `${c.ten} (${c.duongDan})`).join("; ")}`)
    .join("\n");
  const erp = BAN_DO_CHUC_NANG.map(
    (nhom) => `- ${nhom.ten}: ${nhom.chucNang.map((c) => `${c.ten} [${ERP_ROLE_LABELS[c.vai]}, ${c.duongDan.replace("{site}", "trang-an")}]`).join("; ")}`,
  ).join("\n");
  return [
    "WEB KHÁCH (ninhbinhjourney.vercel.app, ai cũng xem được):",
    web,
    "",
    `ERP, HỆ THỐNG ĐIỀU HÀNH NỘI BỘ (/erp, nhân sự đăng nhập; giám đốc xem được mọi vai qua "Xem theo vai trò"; hướng dẫn bấm thử ở /erp/huong-dan):`,
    `Cơ sở: ${ERP_SITES.map((s) => s.shortName).join(", ")}. Vai: ${Object.values(ERP_ROLE_LABELS).join(", ")}.`,
    `${ERP_MODULES.length} module ở mỗi cơ sở: ${ERP_MODULES.map((m) => m.name).join(", ")}.`,
    erp,
  ].join("\n");
}


export function diemKhop(cau: string, muc: MucHoiDap): number {
  const tu = tachTu(cau);
  if (tu.length === 0) return 0;
  const chuoi = ` ${tu.join(" ")} `;
  let diem = 0;
  // Tên riêng nhiều chữ (Tràng An, Tam Cốc) phải khớp trọn cụm mới tính.
  const tenCum = muc.tenRieng.join(" ");
  if (tenCum && chuoi.includes(` ${tenCum} `)) diem += 3 * muc.tenRieng.length;
  else for (const t of muc.tenRieng) if (t.length > 2 && tu.includes(t)) diem += 1;
  for (const k of muc.tuChinh ?? []) if (k.includes(" ") ? chuoi.includes(` ${k} `) : tu.includes(k)) diem += 2;
  for (const t of new Set(muc.tuKhoa)) if (tu.includes(t)) diem += 1;
  return diem;
}

export function timMuc(
  cau: string,
  toiDa = 4,
  loc: (muc: MucHoiDap) => boolean = () => true,
): { muc: MucHoiDap; diem: number }[] {
  return SO_HOI_DAP.filter(loc)
    .map((muc) => ({ muc, diem: diemKhop(cau, muc) }))
    .filter((k) => k.diem > 0)
    .sort((a, b) => b.diem - a.diem)
    .slice(0, toiDa);
}

function khopTuChinh(cau: string, muc: MucHoiDap): boolean {
  const tu = tachTu(cau);
  const chuoi = ` ${tu.join(" ")} `;
  return (muc.tuChinh ?? []).some((k) => (k.includes(" ") ? chuoi.includes(` ${k} `) : tu.includes(k)));
}

/**
 * Trả lời thẳng từ sổ khi câu hỏi rõ ràng rơi vào một mục `thang`: trúng một
 * từ chính của mục, khớp ít nhất 2 điểm và hơn hẳn mục kế. Chỉ trùng chữ
 * chung chung ("vé", "tiền") thì không đủ: "huỷ vé có hoàn tiền không" từng
 * bị trả nhầm sang mục giá vé.
 */
export function traLoiThang(cau: string): MucHoiDap | null {
  // Chỉ so trong sổ soạn tay; mục chức năng dài, để AI diễn đạt.
  const [dau, ke] = timMuc(cau, 2, (m) => !m.pham);
  if (!dau || !dau.muc.thang || dau.diem < 2 || !khopTuChinh(cau, dau.muc)) return null;
  if (ke && ke.diem >= dau.diem) return null;
  return dau.muc;
}

export function mucTheoId(id: string): MucHoiDap | undefined {
  return SO_HOI_DAP.find((m) => m.id === id);
}

/**
 * Câu dự phòng khi không hỏi được AI (hết lượt, AI lỗi) và câu hỏi không khớp
 * mục nào: nói web giúp được những gì và mở lối đi tiếp, không đáp suông
 * "chưa có thông tin".
 */
export function loiChuaCoThongTin(lang: NgonNgu): string {
  return lang === "en"
    ? `I could not answer that one right now. I can help with packages and prices, booking and payment, planning a day, the 15 places on the map, tickets, the boat queue and audio guide, and the internal ERP. Try asking again in other words, or call ${dienThoai} to talk to the team.`
    : `Câu này mình chưa trả lời được ngay lúc này. Mình giúp được về gói và giá, đặt vé và thanh toán, lập lịch đi, 15 điểm đến trên bản đồ, tra vé, hàng chờ bến đò, nghe thuyết minh, và hệ thống điều hành ERP. Bạn thử hỏi lại theo cách khác, hoặc gọi ${dienThoai} để nói chuyện với đội ngũ.`;
}

/**
 * Câu muốn đặt luôn ("đặt giúp mình 2 vé gói gia đình thứ bảy") chứ không
 * phải hỏi cách đặt ("đặt vé thế nào"): có chữ đặt/book/giữ chỗ và kèm số,
 * ngày hay lời nhờ. Câu như vậy không trả lời thẳng từ sổ mà để AI điền đơn.
 */
export function coYDatVe(cau: string): boolean {
  const tu = boDau(cau).split(" ");
  const dat = tu.some((t) => ["dat", "book", "giu", "reserve", "mua"].includes(t));
  if (!dat) return false;
  return tu.some(
    (t) =>
      /^\d+$/.test(t) ||
      ["giup", "ho", "mai", "nay", "toi", "minh", "thu", "chu", "nhat", "tuan", "nguoi", "khach", "be", "tre", "for", "me", "tomorrow", "saturday", "sunday", "people", "adults", "kids"].includes(t),
  );
}
