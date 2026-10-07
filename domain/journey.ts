import {
  DESTINATIONS,
  NINH_BINH_TOURISM_CORE,
  type DestinationCatalogItem,
  type MobilityLevel,
} from "@/content/destinations";
import type {
  Itinerary,
  ItineraryItem,
  JourneyIntent,
  JourneyIntentDraft,
} from "@/domain/models";
import { JourneyIntentSchema } from "@/domain/schemas";

export const REQUIRED_VIETNAMESE_SAMPLE =
  "Tôi có một ngày ở Ninh Bình, đi cùng bố mẹ, muốn lịch trình nhẹ nhàng, ít đi bộ và ngân sách khoảng 2 triệu.";

const mobilityRank: Record<MobilityLevel, number> = {
  low: 1,
  moderate: 2,
  high: 3,
};

const travelMinutes: Record<string, Record<string, number>> = {
  "trang-an": {
    "hoa-lu-ancient-capital": 20,
    "bai-dinh": 30,
    "hoa-lu-old-town": 25,
    "tam-coc-bich-dong": 30,
    "van-long": 50,
    "thung-nham": 40,
  },
  "hoa-lu-ancient-capital": {
    "trang-an": 20,
    "bai-dinh": 25,
    "hoa-lu-old-town": 25,
    "tam-coc-bich-dong": 30,
    "van-long": 40,
  },
  "bai-dinh": {
    "trang-an": 30,
    "hoa-lu-ancient-capital": 25,
    "van-long": 35,
  },
  "tam-coc-bich-dong": {
    "trang-an": 30,
    "hang-mua": 15,
    "thung-nham": 20,
    "hoa-lu-old-town": 25,
  },
  "hang-mua": {
    "tam-coc-bich-dong": 15,
    "thung-nham": 25,
    "hoa-lu-old-town": 20,
  },
  "thung-nham": {
    "tam-coc-bich-dong": 20,
    "hang-mua": 25,
    "trang-an": 40,
  },
  "van-long": {
    "bai-dinh": 35,
    "hoa-lu-ancient-capital": 40,
    "trang-an": 50,
  },
  "hoa-lu-old-town": {
    "trang-an": 25,
    "tam-coc-bich-dong": 25,
    "hang-mua": 20,
  },
};

// Nhãn tiếng Việt cho ba hằng số nhịp đi và ba mức đi bộ. Chúng đi vào câu
// giải thích hiện trên từng chặng, nên phải đọc lọt tai trong một câu tiếng
// Việt, không phải tên biến.
const PACE_REASON_LABEL: Record<JourneyIntent["pace"], string> = {
  relaxed: "kiểu đi thong thả bạn muốn",
  balanced: "kiểu đi vừa phải bạn muốn",
  active: "kiểu đi nhiều bạn muốn",
};

const MOBILITY_REASON_LABEL: Record<MobilityLevel, string> = {
  low: "đi lại nhẹ chân",
  moderate: "đi bộ vừa phải",
  high: "cần đi bộ nhiều",
};

const packagePricePerAdult = {
  relaxed: 790_000,
  balanced: 890_000,
  active: 1_290_000,
} as const;

function normalizedText(text: string) {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[đĐ]/g, "d")
    .toLocaleLowerCase("vi-VN");
}

function numberBeforeKeyword(text: string, keyword: string) {
  const match = text.match(new RegExp(`(\\d+)\\s*${keyword}`));
  return match ? Number(match[1]) : undefined;
}

/**
 * Người Việt nói "hai ngày", "ba người lớn" nhiều hơn viết "2 ngày", "3 người
 * lớn". Chỉ đọc chữ số là bỏ sót đúng cách nói thường ngày.
 *
 * Bảng cố tình dừng ở mười, và cố tình **thiếu vài chữ đọc được thành số**:
 * "tư" thì đứng trong "ngày tư", "thứ tư" nhiều hơn là số bốn, còn "linh",
 * "lẻ" thì chỉ có nghĩa khi ghép. Thêm chúng vào là đổi một chỗ đoán trúng
 * lấy nhiều chỗ đoán sai.
 */
const VIETNAMESE_NUMBER_WORDS: Record<string, number> = {
  mot: 1,
  hai: 2,
  ba: 3,
  bon: 4,
  nam: 5,
  sau: 6,
  bay: 7,
  tam: 8,
  chin: 9,
  muoi: 10,
};

/**
 * Đếm số đứng trước một từ khoá, nhận cả chữ số lẫn chữ viết.
 *
 * Bắt buộc số phải **dính liền** từ khoá. Chữ "năm" còn nghĩa là năm tháng,
 * "tám" nằm sẵn trong "Tam Cốc", "ba" là bố — nên chỉ khi nó đứng ngay trước
 * "ngày"/"người" thì mới chắc chắn nó là một con số.
 */
function countBeforeKeyword(text: string, keyword: string) {
  const digits = numberBeforeKeyword(text, keyword);
  if (digits !== undefined) return digits;
  const words = Object.keys(VIETNAMESE_NUMBER_WORDS).join("|");
  const match = text.match(new RegExp(`\\b(${words})\\s+${keyword}`));
  return match ? VIETNAMESE_NUMBER_WORDS[match[1]] : undefined;
}

/** Ngày hôm nay theo giờ Việt Nam, tách riêng để chỗ nào cũng đếm giống nhau. */
function todayInVietnam(now: Date) {
  const shifted = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

function isoDate(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** 31 tháng 2 là ngày không có thật; nhận vào là dựng lịch trình cho hư không. */
function isRealDate(year: number, month: number, day: number) {
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/**
 * Đọc ngày khách hẹn tới, khi họ nói thẳng ra một ngày cụ thể.
 *
 * "Ngày 12 tháng 10 tôi tới" trước đây rơi sạch. Bộ đọc chỉ dò SỐ NGÀY ĐI, mà
 * ở câu ấy con số đứng SAU chữ "ngày" nên không khớp vào đâu cả — khách nêu
 * đúng ngày mình tới, rồi màn hình lặng lẽ chọn hộ một ngày cách hôm nay bảy
 * hôm. Màn hình vẫn luôn chờ sẵn `draft.visitDate`; chỉ là chưa ai điền.
 *
 * Chỉ nhận ba lối viết chắc chắn là ngày tháng: "ngày 12 tháng 10", "12 tháng
 * 10", "12/10". Cả ba đều đòi con số đứng SAU chữ "ngày", hoặc kẹp giữa dấu
 * gạch chéo — nên "đi 3 ngày" và "2 ngày 1 đêm" không lọt vào đây được, và
 * hàng rào cũ (số đứng TRƯỚC từ khoá mới là số đếm) vẫn nguyên vẹn.
 *
 * Lối gạch chéo còn một cái bẫy riêng: "tôi có 1/2 ngày" là nửa ngày, không
 * phải mùng một tháng hai. Nên ngay sau nó mà là một chữ đơn vị thì bỏ qua.
 *
 * Thiếu năm thì lấy lần tới gần nhất. Gõ "12 tháng 10" vào tháng mười một là
 * khách hẹn tháng mười SANG NĂM; ô "Ngày đi" trên màn hình chặn mọi ngày trước
 * hôm nay, nên trả về một ngày đã qua là đẩy khách vào một ô không bấm tiếp
 * được.
 */
const DATE_UNIT_GUARD = "(?!\\s*(?:ngay|gio|tieng|nguoi|tuan|thang|nam|dem)\\b)";

function parseVisitDate(text: string, now: Date) {
  const match =
    text.match(/\bngay\s*(\d{1,2})\s*(?:thang|\/)\s*(\d{1,2})(?:\s*(?:nam|\/)\s*(\d{4}))?/) ??
    text.match(/\b(\d{1,2})\s*thang\s*(\d{1,2})(?:\s*(?:nam|\/)\s*(\d{4}))?/) ??
    text.match(
      new RegExp(`\\b(\\d{1,2})/(\\d{1,2})(?:/(\\d{4}))?${DATE_UNIT_GUARD}`),
    );
  if (!match) return undefined;

  const day = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return undefined;

  const spokenYear = match[3] ? Number(match[3]) : undefined;
  if (spokenYear !== undefined) {
    if (spokenYear < 2000 || spokenYear > 2100) return undefined;
    return isRealDate(spokenYear, month, day)
      ? { date: isoDate(spokenYear, month, day), confidence: 0.97 }
      : undefined;
  }

  const today = todayInVietnam(now);
  const todayIso = isoDate(today.year, today.month, today.day);
  for (const year of [today.year, today.year + 1]) {
    if (!isRealDate(year, month, day)) continue;
    const candidate = isoDate(year, month, day);
    if (candidate >= todayIso) return { date: candidate, confidence: 0.9 };
  }
  return undefined;
}

const SO_BANG_CHU = Object.keys(VIETNAMESE_NUMBER_WORDS).join("|");
const SO_TIENG_ANH: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
};

function docSo(token: string) {
  if (/^\d+$/.test(token)) return Number(token);
  return VIETNAMESE_NUMBER_WORDS[token] ?? SO_TIENG_ANH[token];
}

/**
 * Dò cụm từ trên chữ CÓ DẤU, ranh giới là chữ cái Unicode (`\b` của JavaScript
 * coi "é", "ư" là ký tự ngắt từ). Dùng cho những chữ mà bỏ dấu đi thì trùng
 * nghĩa khác: "con" (trẻ) với "còn", "đền" với "đến", "hang" với "hàng".
 */
function coTuCoDau(coDau: string, mau: string) {
  return new RegExp(`(?<![\\p{L}\\d])(?:${mau})(?![\\p{L}])`, "u").test(coDau);
}

/** Số trẻ em: "2 bé", "hai cháu", "2 đứa con", "con 5 tuổi", "2 kids". */
function demTreEm(text: string, coDau: string): number | undefined {
  const theoSo = text.match(
    new RegExp(
      `\\b(\\d+|${SO_BANG_CHU}|one|two|three|four|five)\\s+(?:dua\\s+)?(?:tre(?:\\s+(?:em|con|nho))?|be|chau|nhoc|kids?|children|child)\\b`,
    ),
  );
  if (theoSo) return docSo(theoSo[1]);
  const con = coDau.match(
    /(?<![\p{L}\d])(\d+|một|hai|ba|bốn|năm)\s+(?:đứa\s+)?con(?![\p{L}])/u,
  );
  if (con) return docSo(normalizedText(con[1]));
  if (
    coTuCoDau(
      coDau,
      "con nhỏ|con trai|con gái|đứa con|với con|cùng con|cho con|con \\d+ tuổi|bé|cháu|em bé|trẻ con|trẻ nhỏ|trẻ em|nhóc",
    ) ||
    /\b(?:kids?|child|children|son|daughter|baby|toddler)\b/.test(text)
  ) {
    return 1;
  }
  return undefined;
}

/**
 * Cả đoàn bao nhiêu người, khi khách đếm gộp: "gia đình 4 người", "nhóm 5",
 * "3 đứa bạn", "tôi với 2 người bạn" (ba người, tính cả người nói).
 */
function demTongNguoi(text: string): number | undefined {
  const nguoi = text.match(
    new RegExp(
      `\\b(\\d+|${SO_BANG_CHU})\\s+nguoi\\b(?!\\s+(?:lon|cao tuoi|gia|yeu|ban))`,
    ),
  );
  if (nguoi) return docSo(nguoi[1]);
  const ban = text.match(
    new RegExp(
      `\\b(voi|cung)?\\s*(\\d+|${SO_BANG_CHU})\\s+(?:dua\\s+|nguoi\\s+)?ban\\b(?!\\s+(?:trai|gai))`,
    ),
  );
  if (ban) return (docSo(ban[2]) ?? 0) + (ban[1] ? 1 : 0) || undefined;
  const nhom = text.match(
    new RegExp(
      `\\b(?:nhom|doan|gia dinh|nha|ca nha)\\s+(?:minh\\s+|toi\\s+)?(\\d+|${SO_BANG_CHU})\\b`,
    ),
  );
  if (nhom) return docSo(nhom[1]);
  const tiengAnh = text.match(
    /\b(\d+|one|two|three|four|five|six|seven|eight)\s+(?:people|persons|of us)\b|\bfamily of (\d+|three|four|five|six)\b/,
  );
  if (tiengAnh) return docSo(tiengAnh[1] ?? tiengAnh[2]);
  const banAnh = text.match(/\b(with\s+)?(\d+|two|three|four|five)\s+friends\b/);
  if (banAnh) return (docSo(banAnh[2]) ?? 0) + (banAnh[1] ? 1 : 0) || undefined;
  return undefined;
}

/**
 * Tên điểm khách nhắc tới đầu tiên. Chỉ những nơi máy xếp lịch được
 * (`DESTINATIONS`); "phố cổ" đứng trước "Hoa Lư" để "phố cổ Hoa Lư" không bị
 * đọc thành cố đô.
 */
const TEN_DIEM: ReadonlyArray<readonly [RegExp, string]> = [
  [/\bpho co(?: hoa lu)?\b|\bold town\b/, "hoa-lu-old-town"],
  [/\btrang an\b/, "trang-an"],
  [/\bbai dinh\b/, "bai-dinh"],
  [/\btam coc\b|\bbich dong\b/, "tam-coc-bich-dong"],
  [/\bhang mua\b|\bmua cave\b/, "hang-mua"],
  [/\b(?:co do )?hoa lu\b/, "hoa-lu-ancient-capital"],
  [/\bthung nham\b/, "thung-nham"],
  [/\bvan long\b/, "van-long"],
  [/\btam chuc\b/, "tam-chuc"],
];

function diemDuocNhac(text: string) {
  let som: { viTri: number; slug: string } | undefined;
  for (const [mau, slug] of TEN_DIEM) {
    const viTri = text.search(mau);
    if (viTri >= 0 && (!som || viTri < som.viTri)) som = { viTri, slug };
  }
  return som
    ? DESTINATIONS.find((destination) => destination.slug === som.slug)?.id
    : undefined;
}

/**
 * Giờ bắt đầu theo buổi khách nói. "Tôi" bỏ dấu cũng là "toi", nên buổi tối
 * chỉ nhận khi đi kèm "buổi", "nay", "mai".
 */
function docBuoi(text: string) {
  if (/\bbuoi trua\b|\btrua nay\b|\btrua mai\b|\bnoon\b/.test(text)) return 11 * 60;
  if (/\bbuoi chieu\b|\bchieu nay\b|\bchieu mai\b|\bdi chieu\b|\bafternoon\b/.test(text)) return 13 * 60;
  if (/\bbuoi toi\b|\btoi nay\b|\btoi mai\b|\bevening\b/.test(text)) return 17 * 60;
  return undefined;
}

const THU_TRONG_TUAN: Record<string, number> = {
  "2": 1, hai: 1, "3": 2, ba: 2, "4": 3, tu: 3, "5": 4, nam: 4, "6": 5, sau: 5, "7": 6, bay: 6,
};
const THU_TIENG_ANH: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
};

/**
 * Ngày nói miệng: "hôm nay", "mai", "ngày kia", "thứ 7 này", "chủ nhật tuần
 * sau", "cuối tuần này". Trước 07/10/2026 máy chỉ đọc "12/10" và "12 tháng
 * 10", nên "ngày mai" rơi sạch và lịch lặng lẽ đặt một ngày cách đó bảy hôm.
 */
function docNgayNoiMieng(text: string, now: Date) {
  const homNay = todayInVietnam(now);
  const goc = Date.UTC(homNay.year, homNay.month - 1, homNay.day);
  const thuHomNay = new Date(goc).getUTCDay();
  const cong = (soNgay: number, confidence = 0.9) => {
    const ngay = new Date(goc + soNgay * 24 * 60 * 60 * 1000);
    return {
      date: isoDate(ngay.getUTCFullYear(), ngay.getUTCMonth() + 1, ngay.getUTCDate()),
      confidence,
    };
  };
  if (/\bhom nay\b|\btoday\b/.test(text)) return cong(0);
  if (/\bngay kia\b|\bngay mot\b|\bday after tomorrow\b/.test(text)) return cong(2);
  if (/\b(?:ngay|sang|chieu|toi|trua) mai\b|\bmai (?:minh|toi|di|em|anh|chi|nha)\b|\btomorrow\b/.test(text)) {
    return cong(1);
  }
  const thu =
    text.match(/\b(?:thu\s*(2|3|4|5|6|7|hai|ba|tu|nam|sau|bay)|t([2-7]))\b(\s+tuan\s+(?:sau|toi))?/) ??
    undefined;
  const chuNhat = text.match(/\b(?:chu nhat|cn)\b(\s+tuan\s+(?:sau|toi))?/);
  const anh = text.match(/\b(next\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/);
  let dich: number | undefined;
  let tuanSau = false;
  if (thu) {
    dich = THU_TRONG_TUAN[thu[1] ?? thu[2]];
    tuanSau = Boolean(thu[3]);
  } else if (chuNhat) {
    dich = 0;
    tuanSau = Boolean(chuNhat[1]);
  } else if (anh) {
    dich = THU_TIENG_ANH[anh[2]];
    tuanSau = Boolean(anh[1]);
  }
  if (dich !== undefined) {
    if (!tuanSau) return cong((dich - thuHomNay + 7) % 7);
    // "Tuần sau" là tuần lịch kế tiếp, tính từ thứ hai.
    const toiThuHai = (1 - thuHomNay + 7) % 7 || 7;
    return cong(toiThuHai + ((dich + 6) % 7));
  }
  if (/\bcuoi tuan\b|\bweekend\b/.test(text)) {
    return cong(thuHomNay === 6 || thuHomNay === 0 ? 0 : 6 - thuHomNay, 0.75);
  }
  return undefined;
}

export function parseJourneyIntent(input: {
  text: string;
  locale: "vi" | "en";
  /** Mốc "hôm nay" cho phép bài kiểm ghim một ngày cố định. */
  today?: Date;
}): JourneyIntentDraft {
  const rawText = input.text.trim();
  const text = normalizedText(rawText);
  const coDau = rawText.normalize("NFC").toLocaleLowerCase("vi-VN");
  const draft: JourneyIntentDraft = {
    locale: input.locale,
    rawText,
    fieldConfidence: {},
  };

  // Nửa ngày phải xét trước mọi phép đếm ngày: "nửa" không phải một con số,
  // mà nếu để lọt xuống dưới thì chữ "ngày" trong câu lại kéo về trọn một ngày.
  //
  // "1/2 ngày" cũng là nửa ngày, và nó còn tệ hơn nếu để lọt: phép đếm bên
  // dưới đọc số DÍNH LIỀN chữ "ngày", tức đọc trúng số 2 của mẫu số, rồi trả
  // về HAI ngày. Khách viết nửa ngày mà trang đáp "Bạn nói chuyến này đi 2
  // ngày" — đúng kiểu trang không nghe mình nói.
  if (
    /\bnua ngay\b/.test(text) ||
    /\b1\s*\/\s*2\s*ngay\b/.test(text) ||
    /\bhalf[- ]?day\b/.test(text)
  ) {
    draft.durationMinutes = 300;
    draft.tripDays = 1;
    draft.fieldConfidence.durationMinutes = 0.97;
  } else {
    const days =
      countBeforeKeyword(text, "ngay") ?? countBeforeKeyword(text, "days?");
    const weekend = /\bcuoi tuan\b/.test(text) || /\bweekend\b/.test(text);
    if (days && days >= 1) {
      // Máy dựng được đúng một ngày, nên thời lượng luôn là một ngày. Con số
      // ngày khách nói giữ riêng ở `tripDays` để màn hình nói thật, chứ nhân
      // nó lên thành 1.200 phút thì ra một "ngày" hai mươi tiếng không có thật.
      draft.durationMinutes = 600;
      draft.tripDays = days;
      draft.fieldConfidence.durationMinutes = days === 1 ? 0.99 : 0.7;
    } else if (weekend) {
      // Cuối tuần ở đây hiểu là hai ngày. Đây là suy đoán, không phải điều
      // khách nói thẳng, nên độ chắc để thấp và màn hình vẫn cho sửa lại.
      draft.durationMinutes = 600;
      draft.tripDays = 2;
      draft.fieldConfidence.durationMinutes = 0.6;
    } else if (/\bone day\b|\bca ngay\b|\btron ngay\b|\bfull day\b|\ball day\b|\bwhole day\b/.test(text)) {
      draft.durationMinutes = 600;
      draft.tripDays = 1;
      draft.fieldConfidence.durationMinutes = 0.99;
    } else {
      const hours =
        numberBeforeKeyword(text, "gio") ?? numberBeforeKeyword(text, "hours?");
      if (hours) {
        draft.durationMinutes = hours * 60;
        draft.fieldConfidence.durationMinutes = 0.95;
      }
    }
  }

  // Đếm người. Soát 07/10/2026 trên production: sáu câu khách hay gõ thì cả
  // sáu bị hiểu sai — "vợ chồng với con 5 tuổi" ra hai người lớn, "4 người có
  // 2 bé" ra bốn người lớn, "3 đứa bạn" ra một người. Thứ tự đọc: số nói thẳng
  // ra trước, rồi tổng số người trừ đi trẻ em, cuối cùng mới tới cách nói
  // (vợ chồng, một mình, bố mẹ).
  const adults =
    countBeforeKeyword(text, "nguoi lon") ?? countBeforeKeyword(text, "adults?");
  const children = demTreEm(text, coDau);
  const seniorsSaid =
    countBeforeKeyword(text, "nguoi cao tuoi") ??
    countBeforeKeyword(text, "seniors?");
  const tongNguoi = demTongNguoi(text);
  // "Cặp đôi" và "đi một mình" là hai cách nói phổ biến nhất mà máy vẫn chưa
  // hiểu. Số khách nói thẳng ra vẫn được ưu tiên hơn con số suy từ cách nói.
  const couple =
    /\bcap doi\b|\bvo chong\b|\bnguoi yeu\b|\bban gai\b|\bban trai\b|\bvoi vo\b|\bvoi chong\b/.test(
      text,
    ) ||
    /\bcouple\b|\bhoneymoon\b|\bmy (?:wife|husband|partner|girlfriend|boyfriend)\b/.test(text);
  const solo = /\bmot minh\b/.test(text) || /\bsolo\b|\balone\b/.test(text);
  // "Bố mẹ già", "ông bà": người lớn tuổi đi cùng. Chỉ "bố mẹ" trơn thì giữ
  // cách hiểu cũ (ba người lớn) vì chưa chắc bố mẹ đã cao tuổi.
  const coNguoiGia =
    /\b(?:bo me|ba me|cha me) (?:gia|lon tuoi|cao tuoi|yeu)\b|\bong ba\b|\bnguoi gia\b|\bgrandparents?\b|\belderly\b/.test(
      text,
    );
  const seniors = seniorsSaid ?? (coNguoiGia ? 2 : undefined);
  const treEm = children ?? 0;
  const nguoiGia = seniors ?? 0;
  if (/\bbo me\b|\bba me\b|\bcha me\b|\bparents?\b/.test(text)) {
    draft.party = {
      adults: adults ?? (coNguoiGia ? 1 : 3),
      children: treEm,
      seniors: nguoiGia,
    };
    draft.partyContext = ["travelling-with-parents"];
    draft.fieldConfidence.party = adults ? 0.96 : 0.82;
  } else if (tongNguoi && tongNguoi >= 1 && adults === undefined) {
    // "Gia đình 4 người có 2 bé": bốn người là cả đoàn, trẻ em nằm trong đó.
    draft.party = {
      adults: Math.max(1, tongNguoi - treEm - nguoiGia),
      children: treEm,
      seniors: nguoiGia,
    };
    if (couple && tongNguoi - treEm === 2) draft.partyContext = ["couple"];
    draft.fieldConfidence.party = 0.85;
  } else if (couple) {
    draft.party = { adults: adults ?? 2, children: treEm, seniors: nguoiGia };
    draft.partyContext = treEm > 0 ? [] : ["couple"];
    draft.fieldConfidence.party = adults ? 0.96 : 0.88;
  } else if (solo) {
    draft.party = { adults: adults ?? 1, children: treEm, seniors: nguoiGia };
    draft.partyContext = ["solo"];
    draft.fieldConfidence.party = adults ? 0.96 : 0.9;
  } else if (adults || children || seniors) {
    // Có trẻ mà không nói người lớn: nhà đi chơi thì thường hai bố mẹ, còn
    // không thì ít nhất một người lớn dẫn đi.
    const giaDinh = /\bgia dinh\b|\bca nha\b|\bfamily\b/.test(text);
    draft.party = {
      adults: adults ?? (nguoiGia > 0 && treEm === 0 ? 0 : giaDinh ? 2 : 1),
      children: treEm,
      seniors: nguoiGia,
    };
    draft.fieldConfidence.party = adults ? 0.95 : 0.8;
  }

  // Mức đi bộ. Câu "không leo được" phải xét trước "leo núi", không thì
  // "không leo núi được" lại đọc thành người thích leo.
  if (
    /\bit di bo\b|\bdi bo it\b|\bchan yeu\b|\bdau chan\b|\bdau goi\b|\bkhong (?:the |muon |thich |nen |duoc )?leo\b|\bngai leo\b|\bkhong di (?:bo )?(?:duoc )?(?:nhieu|xa)\b|\bxe lan\b|\bxe day\b|\bmang thai\b|\bco bau\b|\bgia yeu\b|\blow walking\b|\bless walking\b|\bcan(?:no|')t (?:walk|climb)\b|\bno (?:climbing|hiking)\b|\bwheelchair\b/.test(
      text,
    ) ||
    (coNguoiGia && !/\bleo nui\b|\bhiking\b/.test(text))
  ) {
    draft.walkingTolerance = "low";
    draft.fieldConfidence.walkingTolerance = coNguoiGia ? 0.8 : 0.95;
  } else if (
    /\bdi bo nhieu\b|\bleo nui\b|\bleo bac\b|\bleo hang mua\b|\btrekking\b|\bhiking\b|\bactive walking\b|\bclimb/.test(
      text,
    )
  ) {
    draft.walkingTolerance = "high";
    draft.fieldConfidence.walkingTolerance = 0.9;
  } else if (/\bdi bo vua phai\b|\bsome walking\b|\bmoderate walking\b/.test(text)) {
    draft.walkingTolerance = "moderate";
    draft.fieldConfidence.walkingTolerance = 0.9;
  }

  if (
    /\bnhe nhang\b|\bthu tha\b|\bthong tha\b|\bdi cham\b|\bcham thoi\b|\bcham rai\b|\bkhong voi\b|\bnghi ngoi\b|\bthu gian\b|\brelaxed?\b|\bslow\b|\bchill\b/.test(
      text,
    )
  ) {
    draft.pace = "relaxed";
    draft.fieldConfidence.pace = 0.95;
  } else if (
    /\bnang dong\b|\bnhieu noi\b|\bdi nhieu\b|\btranh thu\b|\bdi het\b|\bcang nhieu cang tot\b|\bactive pace\b|\bas much as\b/.test(
      text,
    )
  ) {
    draft.pace = "active";
    draft.fieldConfidence.pace = 0.9;
  } else if (/\bvua phai\b|\bcan bang\b|\bmoderate pace\b|\bsteady\b|\bbalanced\b/.test(text)) {
    draft.pace = "balanced";
    draft.fieldConfidence.pace = 0.9;
  } else if (coNguoiGia || draft.walkingTolerance === "low") {
    // Không nói nhịp nhưng có người già hay chân yếu: đi thong thả là suy ra
    // được, độ chắc để thấp cho màn hình ghi là đoán.
    draft.pace = "relaxed";
    draft.fieldConfidence.pace = 0.7;
  }

  const million = text.match(/(\d+(?:[.,]\d+)?)\s*(?:trieu|million)/);
  const explicitVnd = text.match(/(\d[\d.,]{3,})\s*(?:vnd|dong)/);
  if (million) {
    draft.budgetVnd = {
      target: Math.round(Number(million[1].replace(",", ".")) * 1_000_000),
      tolerancePercent: 20,
    };
    draft.fieldConfidence.budgetVnd = 0.97;
  } else if (explicitVnd) {
    draft.budgetVnd = {
      target: Number(explicitVnd[1].replace(/[.,]/g, "")),
      tolerancePercent: 20,
    };
    draft.fieldConfidence.budgetVnd = 0.95;
  }

  // Sở thích. "Đền", "sông", "hang" phải đọc trên chữ CÓ DẤU: bỏ dấu đi thì
  // "đến Ninh Bình" thành "den", "hàng chờ" thành "hang".
  const interests: string[] = [];
  if (/\bdi san\b|\bheritage\b|\blich su\b|\bco do\b|\bhistory\b/.test(text)) {
    interests.push("heritage");
  }
  if (
    /\bthien nhien\b|\bnature\b|\bboats?\b|\bcaves?\b|\briver\b/.test(text) ||
    coTuCoDau(coDau, "thuyền|đò|hang|sông|núi|chim|rừng|cánh đồng|lúa")
  ) {
    interests.push("nature");
  }
  if (
    /\bnhiep anh\b|\bchup anh\b|\bchup hinh\b|\bsong ao\b|\bcheck ?in\b|\bhoang hon\b|\bbinh minh\b|\bphotograph|\bphotos?\b|\bsunset\b|\bsunrise\b/.test(
      text,
    )
  ) {
    interests.push("photography");
  }
  if (/\bam thuc\b|\bdac san\b|\bde nui\b|\bcom chay\b|\bfood\b/.test(text)) {
    interests.push("food");
  }
  if (
    /\btam linh\b|\bspiritual|\bpagodas?\b|\btemples?\b/.test(text) ||
    coTuCoDau(coDau, "chùa|đền|lễ phật|cầu an")
  ) {
    interests.push("spirituality");
  }
  if (interests.length > 0) {
    draft.interests = interests;
    draft.fieldConfidence.interests = 0.9;
  }

  // Tên điểm khách nhắc tới đầu tiên thì xếp đầu lịch (vẫn qua luật đi bộ,
  // giờ mở cửa như điểm khách bấm chọn ở trang điểm đến).
  const diemNhac = diemDuocNhac(text);
  if (diemNhac) {
    draft.startSiteId = diemNhac;
    draft.fieldConfidence.startSiteId = 0.9;
  }

  const buoi = docBuoi(text);
  if (buoi) {
    draft.batDauPhut = buoi;
    draft.fieldConfidence.batDauPhut = 0.85;
    // "Đi buổi chiều" mà không nói mấy tiếng: một buổi, không phải trọn ngày.
    if (!draft.durationMinutes) {
      draft.durationMinutes = buoi >= 17 * 60 ? 180 : 300;
      draft.fieldConfidence.durationMinutes = 0.7;
    }
  }

  const visitDate =
    parseVisitDate(text, input.today ?? new Date()) ??
    docNgayNoiMieng(text, input.today ?? new Date());
  if (visitDate) {
    draft.visitDate = visitDate.date;
    draft.fieldConfidence.visitDate = visitDate.confidence;
  }

  // Age/family wording must never fabricate disability or medical needs.
  draft.accessibilityNeeds = [];
  return draft;
}

export function confirmJourneyIntent(input: {
  draft: JourneyIntentDraft;
  demoRunId: string;
  id: string;
  durationMinutes: number;
  party: JourneyIntent["party"];
  partyContext: string[];
  pace: JourneyIntent["pace"];
  walkingTolerance: JourneyIntent["walkingTolerance"];
  budgetVnd?: JourneyIntent["budgetVnd"];
  visitDate?: string;
}) {
  return JourneyIntentSchema.parse({
    id: input.id,
    demoRunId: input.demoRunId,
    locale: input.draft.locale,
    rawText: input.draft.rawText,
    durationMinutes: input.durationMinutes,
    party: input.party,
    partyContext: input.partyContext,
    interests: input.draft.interests ?? [],
    pace: input.pace,
    walkingTolerance: input.walkingTolerance,
    budgetVnd: input.budgetVnd,
    accessibilityNeeds: input.draft.accessibilityNeeds ?? [],
    startSiteId: input.draft.startSiteId,
    visitDate: input.visitDate ?? input.draft.visitDate,
    fieldConfidence: input.draft.fieldConfidence,
  });
}

function timeParts(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function openingWindow(destination: DestinationCatalogItem) {
  const [start, end] = destination.demoOpeningWindow
    .split("–")
    .map(timeParts);
  return { start, end };
}

function isoAt(date: string, minuteOfDay: number) {
  const hours = Math.floor(minuteOfDay / 60).toString().padStart(2, "0");
  const minutes = (minuteOfDay % 60).toString().padStart(2, "0");
  return `${date}T${hours}:${minutes}:00+07:00`;
}

function getTravelMinutes(previousSlug: string | undefined, slug: string) {
  if (!previousSlug) return 0;
  return travelMinutes[previousSlug]?.[slug] ?? 45;
}

export type ItineraryGenerationOptions = {
  idFactory?: () => string;
  unavailableSiteIds?: ReadonlySet<string>;
  visitDate?: string;
  /**
   * Điểm khách đã tự chọn trước khi vào trang lập lịch. Nó đứng đầu hàng ưu
   * tiên nhưng vẫn qua đủ luật (mức đi bộ, giờ mở cửa, tổng thời gian): khách
   * chọn Hang Múa mà nói đi bộ ít thì lịch không lén xếp Hang Múa vào, trang
   * lập lịch nói lý do.
   */
  uuTienSiteId?: string;
  /** Phút trong ngày bắt đầu lịch; mặc định 8 giờ sáng. */
  batDauPhut?: number;
};

export function generateItinerary(
  intent: JourneyIntent,
  options: ItineraryGenerationOptions = {},
): Itinerary {
  const idFactory = options.idFactory ?? (() => crypto.randomUUID());
  const unavailable = options.unavailableSiteIds ?? new Set<string>();
  const visitDate = options.visitDate ?? intent.visitDate ?? "2026-08-15";
  const maxMobility = mobilityRank[intent.walkingTolerance];
  const priorities =
    intent.walkingTolerance === "low"
      ? [
          "trang-an",
          "hoa-lu-ancient-capital",
          "van-long",
          "hoa-lu-old-town",
        ]
      : intent.pace === "active"
        ? ["tam-coc-bich-dong", "hang-mua", "thung-nham", "hoa-lu-old-town"]
        : ["trang-an", "hoa-lu-ancient-capital", "bai-dinh", "hoa-lu-old-town"];
  const uuTien = options.uuTienSiteId
    ? DESTINATIONS.find((destination) => destination.id === options.uuTienSiteId)?.slug
    : undefined;
  const candidates = (uuTien ? [uuTien, ...priorities.filter((slug) => slug !== uuTien)] : priorities)
    .map((slug) => DESTINATIONS.find((destination) => destination.slug === slug))
    .filter((destination): destination is DestinationCatalogItem =>
      Boolean(destination),
    )
    .filter(
      (destination) =>
        mobilityRank[destination.mobilityLevel] <= maxMobility &&
        !unavailable.has(destination.id),
    );

  const batDau = options.batDauPhut ?? 8 * 60;
  let cursor = batDau;
  let previousSlug: string | undefined;
  const items: ItineraryItem[] = [];

  for (const destination of candidates) {
    const travel = getTravelMinutes(previousSlug, destination.slug);
    const window = openingWindow(destination);
    const startMinute = Math.max(cursor + travel, window.start);
    const endMinute = startMinute + destination.suggestedMinutes;
    const elapsed = endMinute - batDau;
    if (endMinute > window.end || elapsed > intent.durationMinutes) continue;

    items.push({
      id: idFactory(),
      siteId: destination.id,
      startAt: isoAt(visitDate, startMinute),
      endAt: isoAt(visitDate, endMinute),
      travelMinutesFromPrevious: travel,
      // Câu này hiện nguyên văn trên từng chặng của lịch trình. Trước đây nó
      // ghép thẳng tên hằng số tiếng Anh vào giữa một câu tiếng Việt — khách
      // đọc được "khớp nhịp balanced" và "giới hạn đi bộ low". Chữ "nhịp
      // balanced" là ví dụ cấm được nêu đích danh trong
      // .claude/skills/viet-tieng-viet/SKILL.md.
      reason:
        intent.walkingTolerance === "low"
          ? `${destination.name.vi} ${MOBILITY_REASON_LABEL[destination.mobilityLevel]}, hợp với mức đi bộ bạn nêu; khung giờ mở cửa vẫn còn kịp.`
          : `${destination.name.vi} khớp ${PACE_REASON_LABEL[intent.pace]} và nằm trong khung giờ mở cửa.`,
    });
    cursor = endMinute;
    previousSlug = destination.slug;
    if (items.length >= 3) break;
  }

  const partyAdults = intent.party.adults + intent.party.seniors;
  const estimatedPriceVnd =
    packagePricePerAdult[intent.pace] * Math.max(1, partyAdults);
  const itinerary: Itinerary = {
    id: idFactory(),
    demoRunId: intent.demoRunId,
    tenantId: "00000000-0000-4000-8000-000000000001",
    regionId: NINH_BINH_TOURISM_CORE.id,
    intentId: intent.id,
    items,
    totalMinutes: items.length > 0 ? cursor - batDau : 0,
    estimatedPriceVnd,
    validation: { valid: true, issues: [] },
    explanation:
      "Lịch trình xếp theo giờ mở cửa, tổng thời gian, mức đi bộ và quãng đường trước, rồi mới tới ngân sách và sở thích.",
  };
  itinerary.validation = validateItinerary({ itinerary, intent, unavailable });
  return itinerary;
}

export function validateItinerary(input: {
  itinerary: Itinerary;
  intent: JourneyIntent;
  unavailable?: ReadonlySet<string>;
}): Itinerary["validation"] {
  const issues: Itinerary["validation"]["issues"] = [];
  const configuredIds = new Set(DESTINATIONS.map((destination) => destination.id));
  const unavailable = input.unavailable ?? new Set<string>();
  let previousEnd = 0;
  let lastEnd = 0;
  let firstStart = Number.POSITIVE_INFINITY;

  for (const item of input.itinerary.items) {
    const destination = DESTINATIONS.find(
      (candidate) => candidate.id === item.siteId,
    );
    if (!configuredIds.has(item.siteId) || !destination) {
      issues.push({
        code: "UNKNOWN_SITE",
        message: "Lịch trình có một điểm chưa có trong danh sách của chúng tôi.",
        itemId: item.id,
      });
      continue;
    }
    if (unavailable.has(item.siteId)) {
      issues.push({
        code: "SITE_UNAVAILABLE",
        message: `${destination.name.vi} đang đóng cửa vào giờ đã chọn.`,
        itemId: item.id,
      });
    }
    if (
      mobilityRank[destination.mobilityLevel] >
      mobilityRank[input.intent.walkingTolerance]
    ) {
      issues.push({
        code: "MOBILITY_CONFLICT",
        message: `${destination.name.vi} phải đi bộ nhiều hơn mức bạn chọn.`,
        itemId: item.id,
      });
    }
    const start = Date.parse(item.startAt);
    const end = Date.parse(item.endAt);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
      issues.push({
        code: "INVALID_TIME",
        message: `${destination.name.vi} có giờ bắt đầu hoặc kết thúc bị sai.`,
        itemId: item.id,
      });
    }
    if (previousEnd > 0 && start < previousEnd) {
      issues.push({
        code: "OVERLAP",
        message: `${destination.name.vi} trùng giờ với điểm trước.`,
        itemId: item.id,
      });
    }
    const window = openingWindow(destination);
    const startMinute = timeParts(item.startAt.slice(11, 16));
    const endMinute = timeParts(item.endAt.slice(11, 16));
    if (startMinute < window.start || endMinute > window.end) {
      issues.push({
        code: "OUTSIDE_DEMO_WINDOW",
        message: `${destination.name.vi} nằm ngoài giờ mở cửa ${destination.demoOpeningWindow}.`,
        itemId: item.id,
      });
    }
    previousEnd = end;
    lastEnd = Math.max(lastEnd, end);
    firstStart = Math.min(firstStart, start);
  }

  if (input.itinerary.items.length === 0) {
    issues.push({
      code: "NO_FEASIBLE_STOPS",
      message:
        "Chưa có điểm nào đáp ứng đồng thời thời lượng, giờ mở cửa và mức đi bộ.",
    });
  } else {
    const elapsedMinutes = Math.round((lastEnd - firstStart) / 60_000);
    if (elapsedMinutes > input.intent.durationMinutes) {
      issues.push({
        code: "DURATION_EXCEEDED",
        message: `Lịch trình dài hơn ${input.intent.durationMinutes} phút bạn có.`,
      });
    }
  }

  return { valid: issues.length === 0, issues };
}

export function revalidateEditedItinerary(input: {
  itinerary: Itinerary;
  intent: JourneyIntent;
  unavailableSiteIds?: ReadonlySet<string>;
}) {
  const validation = validateItinerary({
    itinerary: input.itinerary,
    intent: input.intent,
    unavailable: input.unavailableSiteIds,
  });
  return { ...input.itinerary, validation };
}

export function rebuildItineraryWithSites(input: {
  itinerary: Itinerary;
  intent: JourneyIntent;
  siteIds: string[];
  idFactory?: () => string;
}): Itinerary {
  const idFactory = input.idFactory ?? (() => crypto.randomUUID());
  const visitDate =
    input.intent.visitDate ?? input.itinerary.items[0]?.startAt.slice(0, 10) ?? "2026-08-15";
  let cursor = 8 * 60;
  let previousSlug: string | undefined;
  const items: ItineraryItem[] = [];

  for (const siteId of input.siteIds) {
    const destination = DESTINATIONS.find((item) => item.id === siteId);
    if (!destination) {
      items.push({
        id: idFactory(),
        siteId,
        startAt: isoAt(visitDate, cursor),
        endAt: isoAt(visitDate, cursor + 1),
        travelMinutesFromPrevious: 0,
        reason: "Điểm này chưa có trong danh sách.",
      });
      cursor += 1;
      continue;
    }
    const travel = getTravelMinutes(previousSlug, destination.slug);
    const window = openingWindow(destination);
    const startMinute = Math.max(cursor + travel, window.start);
    const endMinute = startMinute + destination.suggestedMinutes;
    items.push({
      id: idFactory(),
      siteId,
      startAt: isoAt(visitDate, startMinute),
      endAt: isoAt(visitDate, endMinute),
      travelMinutesFromPrevious: travel,
      reason: `${destination.name.vi} giữ đúng thứ tự bạn xếp; giờ mở cửa, đường đi và mức đi bộ đã được tính lại.`,
    });
    cursor = endMinute;
    previousSlug = destination.slug;
  }

  const rebuilt: Itinerary = {
    ...input.itinerary,
    items,
    totalMinutes: items.length > 0 ? cursor - 8 * 60 : 0,
    explanation:
      "Lịch trình đã tính lại theo chỗ bạn sửa. Còn chỗ nào vướng, chúng tôi báo ngay bên dưới.",
  };
  return revalidateEditedItinerary({
    itinerary: rebuilt,
    intent: input.intent,
  });
}
