"use client";

import Link from "next/link";
import QRCode from "qrcode";
import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import type { PackageCatalogItem } from "@/content/packages";
import { khungBanGoi } from "@/content/packages-en";
import type { CustomerProductTimeSlot } from "@/domain/customer-booking";
import { WEB_BOOKING_MAX_PARTY_SIZE } from "@/domain/customer-booking";
import type { VisitorGroupStatus } from "@/domain/visitor-group";
import { getOrCreateCustomerAnonymousId } from "@/lib/customer-data/browser-tracking";
import { formatVietnameseDate } from "@/lib/vietnamese-date";
import { maVung, type NgonNgu } from "@/lib/ngon-ngu";
import { BenDoTienTrinh } from "./ben-do-tien-trinh";
import { LuuAnhVe } from "@/components/commerce/luu-anh-ve";
import { VeLapLanh } from "@/components/commerce/ve-lap-lanh";
import { ChuyenCuaBan } from "@/components/commerce/chuyen-cua-ban";
import { chuanHoaMaMoi, giamMaMoi } from "@/domain/ma-moi";
import { goiYChoNhom, loaiNhom, NHAN_NHOM, type SoNoiBat } from "@/domain/goi-y";
import { DESTINATIONS } from "@/content/destinations";
import { batNgoaiTuyen, luuVeTrenMay } from "@/lib/ve-luu-may";
import { CO_SO_THEO_UUID, DuBaoDoDong } from "@/components/commerce/du-bao-do-dong";
import { MaCaNgay } from "@/components/commerce/ma-ca-ngay";

type VisitorGroupApiResponse =
  | { accepted: true; group: VisitorGroupStatus }
  | { accepted: false; error?: { message?: string } };

// Mã QR riêng của đúng một người trong đoàn, và nó phải làm được **hai việc**.
//
// Điện thoại của chính khách quét nó để mở trang tự ghi tên — nên nội dung phải
// là một địa chỉ web. Máy quét ở cổng cũng đọc chính mã này, và nó sẽ gõ nguyên
// cả địa chỉ vào ô quét; máy chủ cắt lấy đoạn cuối để hai đường cùng về một mã
// (`normalizeScannedCode` trong `lib/erp/offline-gate-store.ts`, và luật cùng
// tên trong `erp_gate_scan_ticket_at`). Đổi đường dẫn ở đây thì phải đổi cả hai
// chỗ kia, nếu không mã QR vẫn mở được trang mà **không vào được cổng**.
//
// Cách vẽ lấy nguyên của `pass-experience.tsx`, dùng lại gói `qrcode` đã có
// trong dự án, không phát minh thêm cách khác.
function MemberQrCode({ memberCode, lang }: { memberCode: string; lang: NgonNgu }) {
  const [qrDataUrl, setQrDataUrl] = useState("");

  useEffect(() => {
    let active = true;
    void QRCode.toDataURL(`${window.location.origin}/doan/${memberCode}`, {
      width: 168,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#151A17", light: "#F4F0E7" },
    }).then((url) => {
      if (active) setQrDataUrl(url);
    });
    return () => {
      active = false;
    };
  }, [memberCode]);

  if (!qrDataUrl) {
    return <div className="grid size-16 shrink-0 place-items-center rounded-xl bg-[#f4f0e7] text-[10px] text-[#6b786f]">{lang === "en" ? "Making…" : "Đang tạo…"}</div>;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={qrDataUrl}
      alt={lang === "en" ? `QR code to add your name, member code ${memberCode}` : `Mã QR để tự khai tên, mã thành viên ${memberCode}`}
      className="size-16 shrink-0 rounded-xl bg-[#f4f0e7]"
    />
  );
}

// Vé hiện bằng thẻ VeLapLanh (D2): mã QR chứa đúng mã vé trần, như trước.
const NHOM_KHACH_VE: Record<ConfirmationResult["tickets"][number]["guestGroup"], Record<NgonNgu, string>> = {
  adult: { vi: "Từ 1m3 trở lên", en: "1.3 m and taller" },
  child: { vi: "Trẻ 1m–1m3", en: "Child 1–1.3 m" },
  group: { vi: "Cả đoàn", en: "Whole group" },
};

function tenDiem(siteId: string, lang: NgonNgu) {
  return DESTINATIONS.find((item) => item.id === siteId)?.name[lang] ?? (lang === "en" ? "Site" : "Điểm tham quan");
}

type HoldResult = {
  order: { id: string; code: string };
  hold: { id: string; status: string; expires_at: string };
  amount: { total_vnd: number; discount_vnd?: number; currency: "VND" };
  slots: Array<{
    slotId: string;
    siteId: string;
    startsAt: string;
    endsAt: string;
    capacitySource: "estimate" | "customer" | "measured";
    thresholdVersion: number;
  }>;
};

type ConfirmationResult = {
  order: { id: string; code: string; status: "confirmed" };
  // TC-22 mở lối trả tại điểm, nên hai trường này KHÔNG còn một giá trị duy
  // nhất nữa: một đơn trả tại điểm về đây là `pending` / `pay-on-site`.
  payment: {
    id: string;
    status: "succeeded" | "pending";
    mode: "simulation" | "pay-on-site" | "qr-transfer";
    amount_due_vnd: number;
  };
  tickets: Array<{
    ticketId: string;
    ticketCode: string;
    siteId: string;
    validOn: string;
    entriesAllowed: number;
    guestGroup: "adult" | "child" | "group";
    status: string;
  }>;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

// F2 chọn giờ theo độ đông (11/10/2026). Ba mức khác nhau cả độ sáng lẫn chữ, không chỉ màu.
const DO_DONG: Record<CustomerProductTimeSlot["doDong"], { vi: string; en: string; chip: string; thanh: string }> = {
  vang: { vi: "Vắng", en: "Quiet", chip: "bg-[#dcebe4] text-[#1f5a45]", thanh: "bg-[#4e8a73]" },
  vua: { vi: "Vừa", en: "Moderate", chip: "bg-[#f3e3bf] text-[#6b5520]", thanh: "bg-[#b8913f]" },
  dong: { vi: "Đông", en: "Busy", chip: "bg-[#f6d2be] text-[#8a3a12]", thanh: "bg-[#c2672f]" },
};

// Nói theo cách khách hiểu, không theo cách bảng dữ liệu gọi. "child" ở đây
// là trẻ 1m–1m3, có vé giá trẻ em (migration 125). Vé cũ phát trước TC-03 gộp cả
// đoàn vào một tấm, vẫn ghi đúng số khách chứ không gọi nhầm thành vé thường.
function formatGuestGroupSummary(tickets: ConfirmationResult["tickets"], lang: NgonNgu) {
  const adultTicket = tickets.find((ticket) => ticket.guestGroup === "adult");
  const childTicket = tickets.find((ticket) => ticket.guestGroup === "child");
  const groupTicket = tickets.find((ticket) => ticket.guestGroup === "group");
  const parts: string[] = [];
  const en = lang === "en";
  if (adultTicket) parts.push(en ? `${adultTicket.entriesAllowed} tickets` : `${adultTicket.entriesAllowed} vé`);
  if (childTicket) parts.push(en ? `${childTicket.entriesAllowed} child tickets (1–1.3 m)` : `${childTicket.entriesAllowed} vé trẻ 1m–1m3`);
  if (groupTicket) parts.push(en ? `${groupTicket.entriesAllowed} guests` : `${groupTicket.entriesAllowed} khách`);
  return parts.join(" · ");
}

// "T11a" là số hiệu một phiếu việc trong hàng đợi nội bộ, không phải chữ khách
// hiểu được. Khách chỉ cần biết con số sức chứa này lấy từ đâu ra.
const SOURCE_LABEL = {
  estimate: { vi: "Số chỗ ước tính", en: "Estimated seats" },
  customer: { vi: "Số chỗ do điểm tham quan báo", en: "Seats reported by the site" },
  measured: { vi: "Số chỗ đã đếm thực tế", en: "Seats actually counted" },
} as const;

// TC-15 — nhu cầu chăm sóc thay cho tuổi, đúng chủ đích của domain/visitor-group.ts.
// Giữ nguyên bốn giá trị và nhãn này, vì máy trực cổng đọc theo đúng chữ trong danh sách.
type CareNeedValue = VisitorGroupStatus["members"][number]["careNeed"];

const CARE_NEED_OPTIONS: Array<{ value: CareNeedValue; label: string; labelEn: string }> = [
  { value: "none", label: "Không cần gì thêm", labelEn: "Nothing extra" },
  { value: "young-child", label: "Đi cùng trẻ nhỏ", labelEn: "With a small child" },
  { value: "elderly", label: "Người cao tuổi", labelEn: "Older traveller" },
  { value: "mobility", label: "Khó đi lại", labelEn: "Limited mobility" },
];

const NGAY_VIET_NAM = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" });

/**
 * Ngày theo giờ Việt Nam, dạng `YYYY-MM-DD`. Trước 05/10/2026 hàm lấy múi giờ
 * của máy đang chạy: máy chủ (UTC) dựng ô ngày lùi một ngày so với trình duyệt
 * khách từ 0 tới 7 giờ sáng, React báo lệch (#418) và ô ngày cho chọn cả hôm
 * qua. Việt Nam không đổi giờ theo mùa nên cộng ngày bằng mili giây là đúng.
 */
function localIsoDate(daysFromToday: number) {
  return NGAY_VIET_NAM.format(new Date(Date.now() + daysFromToday * 86_400_000));
}

function formatCountdown(seconds: number) {
  const safe = Math.max(0, seconds);
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
}

function formatSlotTime(iso: string) {
  // Giờ 24h như "08:00" đọc được bằng cả hai thứ tiếng.
  return new Date(iso).toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
  });
}

type SlotsApiResponse =
  | { accepted: true; slots: CustomerProductTimeSlot[] }
  | { accepted: false; error?: { message?: string } };

async function responsePayload(response: Response, lang: NgonNgu = "vi") {
  const payload = await response.json().catch(() => null) as
    | { error?: { message?: string } }
    | null;
  if (!response.ok) {
    throw new Error(payload?.error?.message ?? (lang === "en" ? "The booking system did not answer. Please try again." : "Hệ thống đặt chỗ chưa trả lời, mời bạn thử lại."));
  }
  return payload;
}

export function CustomerBookingCheckout({
  packageItem,
  batDauHomNay = false,
  lang = "vi",
  chuGoi,
  dienSan,
  maMoiBanDau,
  soNoiBat,
  goiDangBan,
}: {
  packageItem: PackageCatalogItem;
  /** `?ngay=hom-nay` từ màn Hướng dẫn trong ERP: mở sẵn ngày đi là hôm nay. */
  batDauHomNay?: boolean;
  /**
   * Đơn AI của khung Hỏi nhanh đã điền (08/10/2026): ngày đi, giờ chuyến,
   * số người lớn, trẻ em. Khách vẫn xem lại, đổi được, và tự bấm giữ chỗ.
   */
  dienSan?: { ngay?: string; gio?: string; nguoiLon?: number; treEm?: number };
  lang?: NgonNgu;
  /** Tên, đối tượng, thời lượng của gói theo ngôn ngữ đang chọn. */
  chuGoi?: { name: string; audience: string; durationLabel: string };
  /** Mã mời trình duyệt nhớ từ đường dẫn `/moi/<mã>` (migration 125). */
  maMoiBanDau?: string;
  /** Số thật cho gợi ý "khách giống bạn hay chọn" (migration 127). */
  soNoiBat?: SoNoiBat | null;
  /** Gói đang bán được gợi ý: mã và tên theo ngôn ngữ. */
  goiDangBan?: readonly { slug: string; ten: string }[];
}) {
  const t = useCallback((vi: string, en: string) => (lang === "en" ? en : vi), [lang]);
  const tenGoi = chuGoi?.name ?? packageItem.name;
  // Mặc định: gói cố định tổng khách thì mọi chỗ tính là người lớn cho tới
  // khi khách tự đổi tỉ lệ; gói thường mặc định hai người lớn như trước đây.
  const [adults, setAdults] = useState(() =>
    packageItem.fixedPartySize ? Math.max(1, packageItem.fixedPartySize) : Math.min(45, Math.max(1, dienSan?.nguoiLon ?? 2)),
  );
  const [children, setChildren] = useState(() =>
    packageItem.fixedPartySize ? 0 : Math.min(45 - Math.max(1, dienSan?.nguoiLon ?? 2), Math.max(0, dienSan?.treEm ?? 0)),
  );
  const partySize = adults + children;
  // 125: mã mời của bạn bè giảm 10%; dịch vụ giá riêng (Bàn Trăng) không nhận.
  const [maMoi, setMaMoi] = useState(maMoiBanDau ?? "");
  const maMoiChuan = chuanHoaMaMoi(maMoi);
  const giaTreEm = packageItem.giaTreEmVnd ?? 0;
  const tamTinh = packageItem.demoPriceVnd * Math.max(0, adults) + giaTreEm * Math.max(0, children);
  const giamDuKien = maMoiChuan && !packageItem.giaRieng ? giamMaMoi(tamTinh) : 0;
  // 127: khách cùng kiểu nhóm (gia đình có trẻ, hai người…) hay chọn gói nào.
  const nhomKhach = loaiNhom(adults, children);
  const goiYNhom = packageItem.fixedPartySize
    ? null
    : goiYChoNhom(soNoiBat ?? null, nhomKhach, packageItem.slug, new Set((goiDangBan ?? []).map((g) => g.slug)));
  const tenGoiYNhom = goiYNhom ? goiDangBan?.find((g) => g.slug === goiYNhom.slug)?.ten : undefined;
  // Gói theo mùa (Bàn Trăng, mùa hoa súng) chỉ nhận đặt trong khung bán của nó.
  const khungBan = useMemo(() => khungBanGoi(packageItem), [packageItem]);
  const [visitDate, setVisitDate] = useState(() => {
    const ngayAi = dienSan?.ngay;
    if (ngayAi && ngayAi >= localIsoDate(0) && (!khungBan.tu || ngayAi >= khungBan.tu) && (!khungBan.den || ngayAi <= khungBan.den)) {
      return ngayAi;
    }
    return khungBan.tu ?? localIsoDate(batDauHomNay ? 0 : 1);
  });
  // Giờ chuyến AI điền chỉ dùng cho lần tải khung giờ đầu tiên.
  const gioMuon = useRef(dienSan?.gio ?? null);
  const [slots, setSlots] = useState<CustomerProductTimeSlot[] | null>(null);
  const [slotsLoading, setSlotsLoading] = useState(true);
  const [slotsError, setSlotsError] = useState("");
  const [selectedSlotStartsAt, setSelectedSlotStartsAt] = useState<string | null>(null);
  const [hold, setHold] = useState<HoldResult | null>(null);
  const giamThat = hold ? (hold.amount.discount_vnd ?? 0) : giamDuKien;
  const tongTien = hold?.amount.total_vnd ?? tamTinh - giamDuKien;
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [pending, setPending] = useState<"hold" | "confirm" | null>(null);
  const [message, setMessage] = useState("");
  const holdRequestId = useRef(crypto.randomUUID());
  const paymentRequestId = useRef(crypto.randomUUID());
  // Khung giờ của lượt giữ vừa khôi phục, chọn lại sau khi tải khung giờ.
  const slotKhoiPhuc = useRef<string | null>(null);
  // Chưa đọc xong bộ nhớ thì khối lưu không được xoá lượt giữ cũ.
  const daDocGiuCho = useRef(false);

  // TC-06 — khách đoàn: trưởng đoàn khai tối thiểu tên mình sau khi vé đã
  // phát; không bắt buộc, và bỏ qua không ảnh hưởng gì tới việc vào cổng.
  const [leaderName, setLeaderName] = useState("");
  const [leaderPhone, setLeaderPhone] = useState("");
  // TC-22: khách chọn trả tiền tại điểm thay vì trả ngay trên trang.
  // TC-25: mặc định là trả tại điểm — lối duy nhất chạy trọn vẹn, có người
  // thu tiền thật và có bảng đối soát cuối ca nhận khoản ấy.
  //
  // 26/09/2026: chủ dự án chốt QR là lối chính — giữ chỗ 15 phút, quét mã
  // trong 15 phút là xong, quá hạn thì chỗ tự nhả. Trả tại điểm lùi xuống
  // làm lối phụ.
  const [payAtSite, setPayAtSite] = useState(false);
  // Mã QR thanh toán đang hiện: đường dẫn nó trỏ tới và ảnh của nó.
  const [qr, setQr] = useState<{ payUrl: string; dataUrl: string } | null>(null);
  // Có liên hệ nào thật sự được gửi lên cùng đơn này không. Đọc lại ô nhập lúc
  // dựng màn hình xác nhận thì sai: khách có thể gõ thêm vào ô sau khi đã đặt
  // xong, và màn hình sẽ hứa một đường tra cứu không tồn tại.
  const [contactSaved, setContactSaved] = useState(false);
  const [contact, setContact] = useState("");
  const [groupLabel, setGroupLabel] = useState("");
  const [group, setGroup] = useState<VisitorGroupStatus | null>(null);
  const [groupPending, setGroupPending] = useState(false);
  const [groupRefreshing, setGroupRefreshing] = useState(false);
  const [groupMessage, setGroupMessage] = useState("");

  // TC-15 — bảng điền hộ: chỉ giữ những dòng trưởng đoàn thật sự đã sửa, để
  // lúc lưu không vô tình ghi đè tên khách đã tự khai bằng một giá trị cũ.
  const [memberEdits, setMemberEdits] = useState<
    Record<number, { displayName: string; careNeed: CareNeedValue }>
  >({});
  const [memberDetailsPending, setMemberDetailsPending] = useState(false);
  const [memberDetailsMessage, setMemberDetailsMessage] = useState("");

  function updateMemberEdit(
    memberIndex: number,
    member: VisitorGroupStatus["members"][number],
    patch: Partial<{ displayName: string; careNeed: CareNeedValue }>,
  ) {
    setMemberEdits((previous) => {
      const base = previous[memberIndex] ?? { displayName: member.displayName, careNeed: member.careNeed };
      return { ...previous, [memberIndex]: { ...base, ...patch } };
    });
  }

  // Đã trả tiền (hay đã xác nhận trả tại điểm) thì chỗ không còn "giữ" nữa:
  // dừng đồng hồ. Trước 29/09/2026 đồng hồ cứ chạy về 00:00 cạnh tấm vé đã
  // trả, khách tưởng vé mình hết hạn.
  useEffect(() => {
    if (!hold || confirmation) return;
    const update = () => {
      setRemainingSeconds(Math.max(0, Math.ceil((new Date(hold.hold.expires_at).getTime() - Date.now()) / 1000)));
    };
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [hold, confirmation]);

  /*
   * Soát như khách thật 13/10/2026: tải lại trang là mất chỗ đang giữ, quay
   * về bước chọn giờ. Trên điện thoại, khách chuyển sang app ngân hàng rồi
   * quay lại thì trình duyệt hay tải lại đúng lúc đang trả tiền. Lượt giữ
   * trên máy chủ vẫn còn 15 phút; chỉ giao diện quên. Lưu lượt dở dang vào
   * sessionStorage của chính thẻ ấy, tải lại thì khôi phục khi còn hạn (vé đã
   * phát thì giữ hai giờ). Khối khôi phục đứng trước khối lưu để đọc trước.
   */
  const khoaGiuCho = `nbj-giu-cho:${packageItem.id}`;
  useEffect(() => {
    let luu: {
      hold?: HoldResult | null;
      confirmation?: ConfirmationResult | null;
      visitDate?: string;
      adults?: number;
      children?: number;
      slot?: string | null;
      contact?: string;
      payAtSite?: boolean;
      qr?: { payUrl: string; dataUrl: string } | null;
      holdRequestId?: string;
      paymentRequestId?: string;
      luuLuc?: number;
    } | null = null;
    try {
      luu = JSON.parse(window.sessionStorage.getItem(khoaGiuCho) ?? "null");
    } catch {
      luu = null;
    }
    if (!luu?.hold) {
      daDocGiuCho.current = true;
      return;
    }
    const conHan = luu.confirmation
      ? Date.now() - (luu.luuLuc ?? 0) < 2 * 60 * 60 * 1000
      : new Date(luu.hold.hold.expires_at).getTime() > Date.now();
    if (!conHan) {
      daDocGiuCho.current = true;
      try {
        window.sessionStorage.removeItem(khoaGiuCho);
      } catch {
        // Trình duyệt chặn bộ nhớ thì thôi.
      }
      return;
    }
    const daLuu = { ...luu, hold: luu.hold };
    const hen = window.setTimeout(() => khoiPhuc(daLuu), 0);
    return () => window.clearTimeout(hen);
    function khoiPhuc(luu: NonNullable<typeof daLuu> & { hold: HoldResult }) {
      daDocGiuCho.current = true;
      if (luu.holdRequestId) holdRequestId.current = luu.holdRequestId;
      if (luu.paymentRequestId) paymentRequestId.current = luu.paymentRequestId;
      if (typeof luu.adults === "number") setAdults(luu.adults);
      if (typeof luu.children === "number") setChildren(luu.children);
      slotKhoiPhuc.current = luu.slot ?? null;
      if (luu.visitDate) setVisitDate(luu.visitDate);
      setHold(luu.hold);
      setContact(luu.contact ?? "");
      setPayAtSite(Boolean(luu.payAtSite));
      if (luu.confirmation) {
        setConfirmation(luu.confirmation);
        setContactSaved(true);
        setMessage(t("Vé bạn vừa mua vẫn ở đây.", "Your ticket is still here."));
      } else {
        setQr(luu.qr ?? null);
        setMessage(t("Chỗ bạn giữ vẫn còn, làm tiếp từ đây.", "Your held seats are still here. Carry on from where you were."));
      }
    }
    // Chỉ khôi phục một lần lúc mở trang.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!daDocGiuCho.current) return;
    try {
      if (!hold) {
        window.sessionStorage.removeItem(khoaGiuCho);
        return;
      }
      window.sessionStorage.setItem(
        khoaGiuCho,
        JSON.stringify({
          hold,
          confirmation,
          visitDate,
          adults,
          children,
          slot: selectedSlotStartsAt,
          contact,
          payAtSite,
          qr,
          holdRequestId: holdRequestId.current,
          paymentRequestId: paymentRequestId.current,
          luuLuc: Date.now(),
        }),
      );
    } catch {
      // Chế độ ẩn danh hay bộ nhớ đầy: không khôi phục được, vẫn đặt bình thường.
    }
  }, [khoaGiuCho, hold, confirmation, visitDate, adults, children, selectedSlotStartsAt, contact, payAtSite, qr]);

  // Bước 1 → 2: đổi ngày thì tải lại khung giờ còn mở, và bỏ khung đang chọn —
  // một khung giờ hợp lệ ở ngày cũ chưa chắc còn đúng ở ngày mới.
  useEffect(() => {
    let cancelled = false;
    async function loadSlots() {
      setSlotsLoading(true);
      setSlotsError("");
      setSelectedSlotStartsAt(null);
      try {
        const response = await fetch(
          `/api/customer-booking-slots?product_id=${encodeURIComponent(packageItem.id)}&visit_date=${encodeURIComponent(visitDate)}`,
          { credentials: "same-origin" },
        );
        const payload = (await response.json().catch(() => null)) as SlotsApiResponse | null;
        if (cancelled) return;
        if (!response.ok || !payload?.accepted) {
          setSlots(null);
          setSlotsError(
            (payload && !payload.accepted && payload.error?.message)
          || t("Chưa lấy được khung giờ còn trống, mời bạn thử lại.", "Could not load the free times. Please try again."),
          );
          return;
        }
        setSlots(payload.slots);
        if (slotKhoiPhuc.current) {
          const daGiu = payload.slots.find((slot) => slot.startsAt === slotKhoiPhuc.current);
          slotKhoiPhuc.current = null;
          if (daGiu) {
            setSelectedSlotStartsAt(daGiu.startsAt);
            gioMuon.current = null;
            return;
          }
        }
        const gio = gioMuon.current;
        gioMuon.current = null;
        if (gio) {
          const khop = payload.slots.find(
            (slot) =>
              slot.bookable &&
              new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit" }).format(new Date(slot.startsAt)) === gio,
          );
          if (khop) setSelectedSlotStartsAt(khop.startsAt);
        }
      } catch {
        if (!cancelled) {
          setSlots(null);
          setSlotsError(t("Chưa lấy được khung giờ còn trống, mời bạn thử lại.", "Could not load the free times. Please try again."));
        }
      } finally {
        if (!cancelled) setSlotsLoading(false);
      }
    }
    void loadSlots();
    return () => {
      cancelled = true;
    };
  }, [packageItem.id, visitDate, t]);

  const selectedSlot = slots?.find((slot) => slot.startsAt === selectedSlotStartsAt) ?? null;
  // F2: gắn nhãn "ít người nhất" chỉ khi các khung thật sự chênh nhau, không thì khung nào cũng như nhau.
  // H1: gói đi qua cơ sở có cổng soát vé thì xem độ đông thường gặp của ngày ấy.
  const coSoDuBao = packageItem.siteIds.map((id) => CO_SO_THEO_UUID[id]).find(Boolean);
  const gioVangNhat = useMemo(() => {
    const mo = (slots ?? []).filter((slot) => slot.bookable && typeof slot.fill === "number");
    if (mo.length < 2) return null;
    const fills = mo.map((slot) => slot.fill);
    if (Math.max(...fills) - Math.min(...fills) < 0.15) return null;
    return mo.reduce((vang, slot) => (slot.fill < vang.fill ? slot : vang)).startsAt;
  }, [slots]);
  // Màn Hướng dẫn khoanh đúng một chỗ cho mỗi bước (components/shared/chi-diem.tsx).
  const hetKhung = Boolean(slots && slots.length > 0 && !slots.some((slot) => slot.bookable));
  const buocChi = confirmation
    ? "xong"
    : qr
      ? "qr"
      : hold
        ? "lien-he"
        : selectedSlot?.bookable
          ? "giu"
          : hetKhung || (!slotsLoading && !slotsError && slots?.length === 0)
            ? "ngay"
            : "gio";
  const chi = (buoc: typeof buocChi, loi: string) =>
    buocChi === buoc ? { "data-chi": "dat-ve", "data-chi-loi": loi } : {};
  const partySizeExceedsSlot = Boolean(selectedSlot && partySize > selectedSlot.remaining);
  const partySizeInvalid =
    adults < 1 || partySize < 1 || partySize > WEB_BOOKING_MAX_PARTY_SIZE;

  // Bàn Trăng khoá tổng số chỗ: đổi được bao nhiêu khách có vé, bao nhiêu trẻ
  // 1m–1m3, nhưng tổng luôn đúng bằng fixedPartySize. Sản phẩm khác thì hai ô
  // độc lập, chỉ ràng buộc tối thiểu một khách có vé và tổng không vượt quá
  // WEB_BOOKING_MAX_PARTY_SIZE.
  function updateAdults(rawValue: number) {
    if (!Number.isFinite(rawValue)) return;
    const nextAdults = clamp(Math.trunc(rawValue), 1, WEB_BOOKING_MAX_PARTY_SIZE);
    if (packageItem.fixedPartySize) {
      const total = packageItem.fixedPartySize;
      const boundedAdults = clamp(nextAdults, 1, total);
      setAdults(boundedAdults);
      setChildren(total - boundedAdults);
    } else {
      setAdults(nextAdults);
      setChildren((previousChildren) =>
        clamp(previousChildren, 0, Math.max(0, WEB_BOOKING_MAX_PARTY_SIZE - nextAdults)),
      );
    }
    invalidateHold();
  }

  function updateChildren(rawValue: number) {
    if (!Number.isFinite(rawValue)) return;
    const nextChildren = clamp(Math.trunc(rawValue), 0, WEB_BOOKING_MAX_PARTY_SIZE - 1);
    if (packageItem.fixedPartySize) {
      const total = packageItem.fixedPartySize;
      const boundedChildren = clamp(nextChildren, 0, Math.max(0, total - 1));
      setChildren(boundedChildren);
      setAdults(total - boundedChildren);
    } else {
      setChildren(nextChildren);
      setAdults((previousAdults) =>
        clamp(previousAdults, 1, Math.max(1, WEB_BOOKING_MAX_PARTY_SIZE - nextChildren)),
      );
    }
    invalidateHold();
  }

  function invalidateHold() {
    setHold(null);
    setQr(null);
    setConfirmation(null);
    setMessage("");
    holdRequestId.current = crypto.randomUUID();
    paymentRequestId.current = crypto.randomUUID();
  }

  function selectSlot(startsAt: string) {
    setSelectedSlotStartsAt(startsAt);
    invalidateHold();
  }

  async function createHold() {
    if (!selectedSlotStartsAt) {
      setMessage(t("Mời bạn chọn một khung giờ trước khi giữ chỗ.", "Please pick a time before holding seats."));
      return;
    }
    if (maMoi.trim() && !maMoiChuan) {
      setMessage(t("Mã mời có dạng MOI- và 6 ký tự, ví dụ MOI-AB12CD. Không có mã thì để trống ô này.", "An invite code looks like MOI- and 6 characters, e.g. MOI-AB12CD. Leave the box empty if you have none."));
      return;
    }
    setPending("hold");
    setMessage("");
    try {
      const anonymousId = getOrCreateCustomerAnonymousId(window.localStorage);
      const response = await fetch("/api/customer-booking-holds", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          request_id: holdRequestId.current,
          anonymous_id: anonymousId,
          product_id: packageItem.id,
          visit_date: visitDate,
          party_size: partySize,
          adults,
          children,
          slot_starts_at: selectedSlotStartsAt,
          ...(maMoiChuan && !packageItem.giaRieng ? { ma_moi: maMoiChuan } : {}),
        }),
      });
      const payload = await responsePayload(response, lang) as HoldResult;
      setHold(payload);
      setQr(null);
      setConfirmation(null);
      paymentRequestId.current = crypto.randomUUID();
      setMessage(t("Chỗ của bạn đã được giữ. Bạn có 15 phút để hoàn tất.", "Your seats are held. You have 15 minutes to finish."));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("Lúc này chưa giữ chỗ được, mời bạn thử lại.", "Could not hold seats right now. Please try again."));
    } finally {
      setPending(null);
    }
  }

  async function confirmBooking() {
    if (!hold || remainingSeconds <= 0) return;
    // TC-22: chọn trả tiền tại điểm thì phải có liên hệ. Chặn ngay ở đây để
    // khách thấy lý do tại chỗ, thay vì bấm xong mới nhận một câu từ chối.
    if (contact.trim().length < 6) {
      setMessage(t("Bạn để lại số điện thoại hoặc email trước đã. Lỡ mất trang, bạn dùng chính số này để mở lại vé.", "Please leave a phone number or email first. If you lose this page, you use it to open your ticket again."));
      return;
    }
    if (!payAtSite) {
      await layMaQr();
      return;
    }
    setPending("confirm");
    setMessage("");
    try {
      const response = await fetch("/api/customer-booking-confirmations", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payment_request_id: paymentRequestId.current,
          hold_id: hold.hold.id,
          payment_mode: "pay-on-site",
          contact: contact.trim(),
        }),
      });
      const payload = await responsePayload(response, lang) as ConfirmationResult;
      setConfirmation(payload);
      setContactSaved(contact.trim().length >= 6);
      setMessage(t("Đã giữ chỗ. Vé và mã QR có ngay bên dưới; tới nơi bạn đưa mã cho nhân viên, trả tiền rồi vào.", "Seats held. Your ticket and QR code are below; at the gate, show the code, pay and go in."));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("Lúc này chưa xác nhận được, mời bạn thử lại.", "Could not confirm right now. Please try again."));
    } finally {
      setPending(null);
    }
  }

  // H3: có vé là lưu ngay trên máy, vào hang mất sóng vẫn mở được ở /tra-cuu-ve.
  // Chỉ lưu một lần khi vé vừa về; đổi số khách sau đó không đổi vé đã phát.
  const luuVeVuaPhat = useEffectEvent((xacNhan: ConfirmationResult) => {
    luuVeTrenMay({
      accepted: true,
      found: true,
      order: {
        code: xacNhan.order.code,
        product_id: packageItem.id,
        visit_date: visitDate,
        party_size: adults + children,
        adults,
        children,
        total_vnd: tongTien,
        currency: "VND",
      },
      payment: { mode: xacNhan.payment.mode === "pay-on-site" ? "pay-on-site" : "simulation", status: xacNhan.payment.status, amount_due_vnd: xacNhan.payment.amount_due_vnd },
      tickets: xacNhan.tickets.map((ve) => ({ ...ve, entriesUsed: 0, status: ve.status === "void" ? "void" : "issued" })),
    });
    batNgoaiTuyen();
  });
  useEffect(() => {
    if (confirmation) luuVeVuaPhat(confirmation);
  }, [confirmation]);

  // Xin mã QR thanh toán cho lượt giữ đang có. Mã trỏ tới trang
  // /thanh-toan/[phiếu]; điện thoại quét mã, bấm xác nhận là xong.
  async function layMaQr() {
    if (!hold) return;
    setPending("confirm");
    setMessage("");
    try {
      const response = await fetch("/api/customer-booking-qr-payments", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hold_id: hold.hold.id,
          payment_request_id: paymentRequestId.current,
          contact: contact.trim(),
          amount_vnd: hold.amount.total_vnd,
          product_id: packageItem.id,
        }),
      });
      const payload = await responsePayload(response, lang) as { pay_url: string };
      // Điện thoại quét mã chưa chắc có cookie ngôn ngữ: gửi kèm trong đường dẫn.
      const payUrl = lang === "en" ? `${payload.pay_url}?lang=en` : payload.pay_url;
      const dataUrl = await QRCode.toDataURL(payUrl, {
        margin: 1,
        width: 440,
        errorCorrectionLevel: "L",
        color: { dark: "#10231d", light: "#ffffff" },
      });
      setQr({ payUrl, dataUrl });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("Lúc này chưa lấy được mã QR, mời bạn thử lại.", "Could not get the QR code right now. Please try again."));
    } finally {
      setPending(null);
    }
  }

  // Đang hiện mã QR thì cứ vài giây hỏi máy chủ "khách trả chưa?". Chỉ đọc:
  // máy này không bao giờ tự xác nhận thay cho lượt quét.
  useEffect(() => {
    if (!qr || !hold || confirmation) return;
    let dung = false;
    const hoi = async () => {
      try {
        const response = await fetch(
          `/api/customer-booking-qr-payments?hold_id=${encodeURIComponent(hold.hold.id)}&payment_request_id=${encodeURIComponent(paymentRequestId.current)}`,
          { credentials: "same-origin", cache: "no-store" },
        );
        const payload = (await response.json().catch(() => null)) as
          | ({ accepted: true; paid: true } & ConfirmationResult)
          | { accepted: true; paid: false }
          | null;
        if (dung || !payload || !("paid" in payload) || !payload.paid) return;
        setConfirmation(payload);
        setContactSaved(true);
        setQr(null);
        setMessage(t("Đã nhận thanh toán qua mã QR. Vé của bạn ở ngay bên dưới.", "Payment received by QR code. Your ticket is right below."));
      } catch {
        // Mạng chập chờn thì lần sau hỏi lại, không làm phiền khách.
      }
    };
    const timer = window.setInterval(() => void hoi(), 2500);
    void hoi();
    return () => {
      dung = true;
      window.clearInterval(timer);
    };
  }, [qr, hold, confirmation, t]);

  async function createVisitorGroup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!confirmation || groupPending) return;
    setGroupPending(true);
    setGroupMessage("");
    try {
      const anonymousId = getOrCreateCustomerAnonymousId(window.localStorage);
      const response = await fetch("/api/customer-visitor-groups", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_id: confirmation.order.id,
          anonymous_id: anonymousId,
          leader_name: leaderName.trim(),
          leader_phone: leaderPhone.trim(),
          group_label: groupLabel.trim(),
        }),
      });
      const payload = (await response.json().catch(() => null)) as VisitorGroupApiResponse | null;
      if (!response.ok || !payload?.accepted) {
        setGroupMessage(
          (payload && !payload.accepted && payload.error?.message)
            || t("Chưa tạo được mã đoàn, mời bạn thử lại.", "Could not create the group code. Please try again."),
        );
        return;
      }
      setGroup(payload.group);
    } catch {
      setGroupMessage(t("Chưa tạo được mã đoàn, mời bạn thử lại.", "Could not create the group code. Please try again."));
    } finally {
      setGroupPending(false);
    }
  }

  async function refreshVisitorGroup() {
    if (!group || groupRefreshing) return;
    setGroupRefreshing(true);
    try {
      const response = await fetch(
        `/api/customer-visitor-groups?group_code=${encodeURIComponent(group.groupCode)}`,
        { credentials: "same-origin" },
      );
      const payload = (await response.json().catch(() => null)) as VisitorGroupApiResponse | null;
      if (response.ok && payload?.accepted) {
        setGroup(payload.group);
      }
    } catch {
      // Giữ nguyên danh sách đang hiện, không xoá dữ liệu chỉ vì một lần tải lại lỗi.
    } finally {
      setGroupRefreshing(false);
    }
  }

  // TC-15 — trưởng đoàn điền hộ tên và nhu cầu chăm sóc, lưu một lần cho mọi
  // dòng đã sửa. Việc khách tự quét mã riêng để ghi tên vẫn đè lên giá trị ở
  // đây — quy tắc đó nằm ở máy chủ, UI chỉ cần nói rõ cho trưởng đoàn biết.
  async function saveMemberDetails(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!group || memberDetailsPending) return;
    const edited = Object.entries(memberEdits);
    if (edited.length === 0) return;
    setMemberDetailsPending(true);
    setMemberDetailsMessage("");
    try {
      const anonymousId = getOrCreateCustomerAnonymousId(window.localStorage);
      const response = await fetch("/api/customer-visitor-groups", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          group_code: group.groupCode,
          anonymous_id: anonymousId,
          members: edited.map(([memberIndex, edit]) => ({
            member_index: Number(memberIndex),
            display_name: edit.displayName.trim(),
            care_need: edit.careNeed,
          })),
        }),
      });
      const payload = (await response.json().catch(() => null)) as VisitorGroupApiResponse | null;
      if (!response.ok || !payload?.accepted) {
        setMemberDetailsMessage(
          (payload && !payload.accepted && payload.error?.message)
            || t("Chưa lưu được, mời bạn thử lại.", "Could not save. Please try again."),
        );
        return;
      }
      setGroup(payload.group);
      setMemberEdits({});
      setMemberDetailsMessage(t("Đã lưu tên cả đoàn.", "Saved the names for the whole group."));
    } catch {
      setMemberDetailsMessage(t("Chưa lưu được, mời bạn thử lại.", "Could not save. Please try again."));
    } finally {
      setMemberDetailsPending(false);
    }
  }

  return (
    <div className="grid gap-7 lg:grid-cols-[1.05fr_0.78fr]">
      <div className="lg:col-span-2">
        <BenDoTienTrinh buoc={buocChi} lang={lang} />
      </div>
      <section className="overflow-hidden rounded-[2rem] border border-[#d4d1c7] bg-white shadow-[0_24px_70px_rgba(24,63,52,0.08)]">
        <div className="border-b border-[#e5e1d8] bg-[#fbfaf6] p-6 sm:p-8">
          <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-[#9a6328]">
            {t("Giữ chỗ theo số chỗ còn trống trong ngày", "Hold seats from what is still free that day")}
          </p>
          <h2 className="font-display mt-3 text-4xl leading-tight text-[#183f34] sm:text-5xl">
            {t("Chọn ngày. Chúng tôi giữ chỗ trong 15 phút.", "Pick a day. We hold your seats for 15 minutes.")}
          </h2>
          <p className="mt-4 max-w-2xl leading-7 text-[#59654b]">
            {t("Bạn không cần tạo tài khoản. Chỉ xin một số điện thoại để gửi lại vé khi cần, và chúng tôi không tự đăng ký cho bạn nhận tin quảng cáo.", "No account needed. We only ask for a phone number so you can get your ticket back, and we never sign you up for marketing.")}
          </p>
        </div>

        <div className="p-6 sm:p-8">
          <label
            className="block max-w-xs text-sm font-bold text-[#27362f]"
            {...chi("ngay", "Ngày này đã hết khung giờ đặt được. Đổi ngày đi sang ngày mai, rồi chọn một khung giờ.")}
          >
            {t("Ngày đi", "Date")}
            <input
              aria-label={t("Ngày đi", "Date")}
              type="date"
              value={visitDate}
              // Nhận đặt cho chính hôm nay: máy chủ vốn cho phép, chỉ ô ngày
              // từng tự chặn. Khung giờ đã qua bị khoá ở danh sách khung giờ.
              min={khungBan.tu ?? localIsoDate(0)}
              max={khungBan.den ?? localIsoDate(90)}
              onChange={(event) => {
                setVisitDate(event.target.value);
                invalidateHold();
              }}
              className="mt-2 min-h-12 w-full rounded-xl border border-[#bec7bf] bg-white px-4 font-normal"
            />
            {visitDate ? (
              <span className="mt-1 block text-xs font-normal text-[#59654b]">
                {lang === "en"
                  ? new Date(`${visitDate}T00:00:00`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
                  : formatVietnameseDate(visitDate)}
              </span>
            ) : null}
          </label>

          <div
            className="mt-7"
            {...chi(
              "gio",
              slotsError
                ? "Chưa tải được khung giờ. Mời bạn tải lại trang."
                : "Bấm một khung giờ còn sáng. Khung đã qua giờ bị mờ, không bấm được.",
            )}
          >
            <p className="text-sm font-bold text-[#27362f]">{t("Khung giờ", "Time")}</p>
            {slotsLoading ? (
              <p className="mt-3 text-sm text-[#6b786f]">{t("Đang tải khung giờ còn trống…", "Loading free times…")}</p>
            ) : slotsError ? (
              <p role="alert" className="mt-3 text-sm text-[#9a3b2f]">{slotsError}</p>
            ) : !slots || slots.length === 0 ? (
              <p className="mt-3 text-sm text-[#6b786f]">{t("Ngày này chưa mở khung giờ nào, mời bạn chọn ngày khác.", "No times are open on this day. Please pick another day.")}</p>
            ) : (
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {slots.map((slot) => {
                  const selected = slot.startsAt === selectedSlotStartsAt;
                  // Máy chủ cũ hay bản giả lập có thể chưa gửi độ đông: thiếu thì không hiện nhãn.
                  const dong = slot.doDong ? DO_DONG[slot.doDong] : null;
                  const coDoDong = Boolean(dong) && typeof slot.fill === "number";
                  const vangNhat = slot.startsAt === gioVangNhat;
                  const timeLabel = formatSlotTime(slot.startsAt);
                  const statusLabel = slot.blockedReason === "passed"
                    ? t("Đã qua giờ", "Already passed")
                    : slot.blockedReason === "paused"
                    ? t("Đang tạm dừng nhận khách", "Paused for now")
                    : slot.blockedReason === "full"
                      ? t("Đã hết chỗ", "Full")
                      : slot.capacitySourceKind === "estimate"
                        // QA-P2-09: bốn khung giờ cùng hiện "Còn 800 chỗ" y hệt nhau vì
                        // sức chứa mới là ước tính. Con số tròn trĩnh ấy trông như đếm
                        // thật; ước tính thì nói ước tính, và chỉ nói số khi sắp hết.
                        ? slot.remaining > 50
                          ? t("Còn nhiều chỗ", "Plenty of seats")
                          : t(`Còn khoảng ${slot.remaining} chỗ`, `About ${slot.remaining} seats left`)
                        : t(`Còn ${slot.remaining} chỗ`, `${slot.remaining} seats left`);
                  return (
                    <button
                      key={slot.startsAt}
                      type="button"
                      aria-pressed={selected}
                      aria-label={slot.bookable && dong
                        ? t(`Khung ${timeLabel}, ${dong.vi.toLowerCase()}, ${statusLabel.toLowerCase()}`, `${timeLabel}, ${dong.en.toLowerCase()}, ${statusLabel.toLowerCase()}`)
                        : t(`Khung ${timeLabel}, ${statusLabel.toLowerCase()}`, `${timeLabel}, ${statusLabel.toLowerCase()}`)}
                      disabled={!slot.bookable}
                      onClick={() => selectSlot(slot.startsAt)}
                      className={`min-h-[4.25rem] rounded-2xl border px-3 py-2 text-left transition-colors ${
                        selected
                          ? "border-[#183f34] bg-[#183f34] text-white"
                          : slot.bookable
                            ? "border-[#bec7bf] bg-white text-[#27362f] hover:border-[#183f34]"
                            : "cursor-not-allowed border-[#e5e1d8] bg-[#f1efe8] text-[#9aa39a]"
                      }`}
                    >
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="text-lg font-extrabold">{timeLabel}</span>
                        {slot.bookable && dong ? (
                          <span aria-hidden="true" className={`rounded-full px-2 py-0.5 text-[0.68rem] font-extrabold ${dong.chip}`}>
                            {t(dong.vi, dong.en)}
                          </span>
                        ) : null}
                      </span>
                      {slot.bookable && dong && coDoDong ? (
                        <span aria-hidden="true" className={`mt-2 block h-1.5 overflow-hidden rounded-full ${selected ? "bg-white/20" : "bg-[#183f34]/10"}`}>
                          <span className={`block h-full rounded-full ${selected ? "bg-[#e7c78d]" : dong.thanh}`} style={{ width: `${Math.max(6, Math.round(slot.fill * 100))}%` }} />
                        </span>
                      ) : null}
                      <span className="mt-1 block text-xs font-normal">{statusLabel}</span>
                      {vangNhat ? (
                        <span className={`mt-1 block text-[0.7rem] font-extrabold ${selected ? "text-[#e7c78d]" : "text-[#1f5a45]"}`}>{t("Ít người nhất trong ngày", "Quietest time of the day")}</span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            )}
            {slots && slots.some((slot) => slot.bookable && slot.doDong) ? (
              <p className="mt-2 text-xs text-[#6b786f]">
                {t("Vắng, vừa, đông tính theo số chỗ đã có người giữ trong khung giờ.", "Quiet, moderate and busy follow how many seats are already held in each time.")}
                {slots.some((slot) => slot.capacitySourceKind === "estimate") ? t(" Số chỗ còn lại là ước tính theo sức chứa của điểm tham quan.", " Seats left are estimated from the site's capacity.") : ""}
              </p>
            ) : null}
            {visitDate && coSoDuBao ? <DuBaoDoDong key={visitDate} lang={lang} coSo={coSoDuBao} ngay={visitDate} coDinh /> : null}
          </div>

          <div className="mt-7 max-w-xs">
            <p className="text-sm font-bold text-[#27362f]">{t("Số khách", "Guests")}</p>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <label className="block text-xs font-bold text-[#59654b]">
                {t("Từ 1m3 trở lên", "1.3 m and taller")}
                <input
                  aria-label={t("Số khách cao từ 1m3 trở lên", "Guests 1.3 m and taller")}
                  type="number"
                  min={1}
                  max={packageItem.fixedPartySize ?? WEB_BOOKING_MAX_PARTY_SIZE}
                  value={adults}
                  onChange={(event) => updateAdults(Number(event.target.value))}
                  className="mt-1 min-h-12 w-full rounded-xl border border-[#bec7bf] bg-white px-4 font-normal text-[#27362f]"
                />
              </label>
              <label className="block text-xs font-bold text-[#59654b]">
                {t("Trẻ 1m–1m3", "Child 1–1.3 m")}
                <input
                  aria-label={t("Số trẻ cao từ 1m tới 1m3", "Children 1 to 1.3 m tall")}
                  type="number"
                  min={0}
                  max={packageItem.fixedPartySize ? Math.max(0, packageItem.fixedPartySize - 1) : WEB_BOOKING_MAX_PARTY_SIZE - 1}
                  value={children}
                  onChange={(event) => updateChildren(Number(event.target.value))}
                  className="mt-1 min-h-12 w-full rounded-xl border border-[#bec7bf] bg-white px-4 font-normal text-[#27362f]"
                />
              </label>
            </div>
            {packageItem.fixedPartySize ? (
              <span className="mt-2 block text-xs font-normal text-[#6b786f]">
                {t(
                  `Bàn đã đặt sẵn cho ${packageItem.fixedPartySize} khách. Trẻ nhỏ đi cùng không tính tiền, và tổng số chỗ vẫn giữ nguyên.`,
                  `The table is set for ${packageItem.fixedPartySize} guests. Children eat free, and the total stays the same.`,
                )}
              </span>
            ) : (
              <span className="mt-2 block text-xs font-normal text-[#6b786f]">
                {t(
                  `Trẻ 1m–1m3 mua vé trẻ em${giaTreEm ? ` (${giaTreEm.toLocaleString("vi-VN")} đ)` : ""}; trẻ dưới 1m đi cùng người lớn, không cần vé. Mỗi lượt đặt tối đa ${WEB_BOOKING_MAX_PARTY_SIZE} khách, vừa một xe lớn. Đoàn đông hơn, mời bạn gọi cho chúng tôi để chúng tôi xếp riêng.`,
                  `Children 1–1.3 m tall take a child ticket${giaTreEm ? ` (${giaTreEm.toLocaleString("vi-VN")} VND)` : ""}; under 1 m go free with an adult. Up to ${WEB_BOOKING_MAX_PARTY_SIZE} guests per booking, one large coach. For bigger groups, please call us and we will arrange it.`,
                )}
              </span>
            )}
            {goiYNhom && tenGoiYNhom && !hold ? (
              <Link
                href={`/checkout?package=${goiYNhom.slug}${lang === "en" ? "&lang=en" : ""}`}
                data-testid="goi-y-nhom"
                className="mt-3 block rounded-xl border border-[#cfe0d6] bg-[#f1f7f3] px-4 py-3 text-sm leading-6 text-[#274c40] transition hover:bg-[#e6f1ea]"
              >
                <span className="font-bold">{NHAN_NHOM[nhomKhach][lang]}:</span>{" "}
                {t(`${goiYNhom.phanTram}% chọn ${tenGoiYNhom}.`, `${goiYNhom.phanTram}% choose ${tenGoiYNhom}.`)}{" "}
                <span className="font-bold underline underline-offset-2">{t("Xem gói này", "See it")}</span>
              </Link>
            ) : null}
            {partySizeExceedsSlot ? (
              <span className="mt-2 block text-xs font-normal text-[#9a3b2f]">
                {t(
                  `Khung giờ này còn ${selectedSlot?.remaining} chỗ, ít hơn số khách bạn chọn. Mời bạn giảm số khách hoặc chọn khung khác.`,
                  `This time has ${selectedSlot?.remaining} seats left, fewer than your group. Please lower the number of guests or pick another time.`,
                )}
              </span>
            ) : null}
          </div>

          {packageItem.giaRieng ? null : (
            <div className="mt-6 max-w-xs" data-testid="o-ma-moi">
              <label className="block text-sm font-bold text-[#27362f]">
                {t("Mã mời của bạn bè", "Friend’s invite code")} <span className="font-normal text-[#6b786f]">{t("(nếu có)", "(optional)")}</span>
                <input
                  value={maMoi}
                  onChange={(event) => {
                    setMaMoi(event.target.value.toUpperCase());
                    invalidateHold();
                  }}
                  placeholder="MOI-AB12CD"
                  autoComplete="off"
                  spellCheck={false}
                  maxLength={12}
                  className="mt-1 min-h-12 w-full rounded-xl border border-[#bec7bf] bg-white px-4 font-normal uppercase tracking-wider text-[#27362f]"
                />
              </label>
              <span className="mt-1 block text-xs text-[#6b786f]">
                {maMoiChuan
                  ? t(`Giảm 10%: bớt ${giamDuKien.toLocaleString("vi-VN")} đ.`, `10% off: ${giamDuKien.toLocaleString("vi-VN")} VND less.`)
                  : t("Bạn bè đã đi gửi mã thì đơn này giảm 10%.", "A code from a friend who has been here takes 10% off.")}
              </span>
            </div>
          )}

          {/* TC-25: khối này trước đây mở đầu bằng "Thanh toán mô phỏng —
              không thu tiền", và đó là câu giết cả luồng. Người đọc dừng ngay
              ở chữ "mô phỏng" rồi bỏ đi, vì tưởng bấm tiếp cũng chẳng ra gì.
              Sự thật ngược lại: chỗ giữ là thật, đơn là thật, vé phát ra nằm
              trong kho vé vận hành và máy quét ở cổng đọc được. Thứ duy nhất
              chưa nối là đường chuyển tiền từ ngân hàng.

              Nên nói cái CÓ trước, rồi mới nói cái chưa có — vẫn đủ thật,
              nhưng không mời người ta bỏ đi ngay từ dòng đầu. */}
          {/* Đã có vé thì thôi nhắc hạn 15 phút: khách đọc câu "quá 15 phút thì
              nhả chỗ" cạnh tấm vé đã trả sẽ tưởng vé mình sắp mất. */}
          {confirmation ? null : (
            <div className="mt-7 rounded-2xl border border-[#ddb77d] bg-[#fff8eb] p-5 text-[#6c4b1f]">
              <p className="font-extrabold">{t("Giữ chỗ 15 phút, quét mã QR là xong", "Hold for 15 minutes, scan a QR code and you are done")}</p>
              <p className="mt-2 text-sm leading-6">
                {t(
                  "Chỗ giữ là thật, vé có mã QR mà máy ở cổng quét được. Quá 15 phút chưa thanh toán thì chỗ tự nhả cho khách khác. Ở bản trình diễn này, bước chuyển khoản là giả lập: quét mã, bấm xác nhận là xong, ",
                  "The hold is real, and the ticket has a QR code the gate scanners read. If you do not pay within 15 minutes, the seats go back to other guests. In this demo the transfer is simulated: scan, press confirm and you are done — ",
                )}
                <strong className="font-bold">{t("không có tiền thật nào bị trừ", "no real money is taken")}</strong>.
              </p>
            </div>
          )}

          {hold ? (
            <div className="mt-7">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#557568]">{t("Các điểm đã giữ chỗ", "Seats held at")}</p>
                  <p className="mt-2 text-sm text-[#59654b]">{t("Điểm nào chưa nhận giữ chỗ trước thì vẫn nằm trong lịch trình, nhưng bạn vào theo lượt bình thường ở cổng.", "Stops that do not take advance holds stay on your route; you just join the normal queue at the gate.")}</p>
                </div>
                {confirmation ? (
                  <div data-testid="giu-cho-da-xong" className="rounded-2xl bg-[#dceadd] px-5 py-3 text-right text-[#183f34]">
                    <p className="text-xs uppercase tracking-[0.16em] text-[#356957]">{t("Chỗ của bạn", "Your seats")}</p>
                    <p className="font-display mt-1 text-2xl">
                      {confirmation.payment.mode === "qr-transfer" ? t("Đã thanh toán", "Paid") : t("Đã xác nhận", "Confirmed")}
                    </p>
                  </div>
                ) : (
                  <div className="rounded-2xl bg-[#183f34] px-5 py-3 text-right text-white">
                    <p className="text-xs uppercase tracking-[0.16em] text-white/60">{t("Còn lại", "Time left")}</p>
                    <p className="font-display mt-1 text-3xl text-[#e7c78d]">{formatCountdown(remainingSeconds)}</p>
                  </div>
                )}
              </div>
              <ul className="mt-4 grid gap-3">
                {hold.slots.map((slot) => (
                  <li key={slot.slotId} className="rounded-2xl border border-[#dde1db] p-4">
                    <div className="flex flex-wrap justify-between gap-2">
                      <strong>{new Date(slot.startsAt).toLocaleString(maVung(lang), { dateStyle: "medium", timeStyle: "short" })}</strong>
                      <span className="text-xs font-bold text-[#557568]">{confirmation ? t("Đã có vé", "Ticketed") : t("Đã giữ chỗ", "Held")}</span>
                    </div>
                    <p className="mt-2 text-sm text-[#59654b]">{SOURCE_LABEL[slot.capacitySource][lang]}</p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {message ? <p role="status" className="mt-6 rounded-xl bg-[#edf3ee] p-4 text-sm leading-6 text-[#274c40]">{message}</p> : null}
        </div>
      </section>

      <aside className="h-fit rounded-[2rem] bg-[#183f34] p-6 text-white shadow-[0_24px_70px_rgba(12,38,31,0.2)] sm:p-8">
        <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-[#e7c78d]">{t("Gói đã chọn", "Your package")}</p>
        <h2 className="font-display mt-3 text-4xl leading-tight">{tenGoi}</h2>
        <p className="mt-3 leading-7 text-white/65">{chuGoi?.durationLabel ?? packageItem.durationLabel} · {chuGoi?.audience ?? packageItem.audience}</p>
        <dl className="mt-7 space-y-4 border-y border-white/15 py-5 text-sm">
          {packageItem.giamPhanTram && packageItem.giaLeVnd ? (
            <div className="flex justify-between gap-4"><dt className="text-white/55">{t("Mua lẻ từng điểm", "Single tickets")}</dt><dd className="text-white/55 line-through">{packageItem.giaLeVnd.toLocaleString("vi-VN")} VND</dd></div>
          ) : null}
          <div className="flex justify-between gap-4">
            <dt className="text-white/55">{t("Người lớn", "Adults")} × {adults}</dt>
            <dd>{packageItem.demoPriceVnd.toLocaleString("vi-VN")} VND{packageItem.giamPhanTram ? <span className="ml-1 text-xs text-[#e7c78d]">−{packageItem.giamPhanTram}%</span> : null}</dd>
          </div>
          {children > 0 ? (
            <div className="flex justify-between gap-4"><dt className="text-white/55">{t("Trẻ 1m–1m3", "Child 1–1.3 m")} × {children}</dt><dd>{giaTreEm ? `${giaTreEm.toLocaleString("vi-VN")} VND` : t("không tính tiền", "free")}</dd></div>
          ) : null}
          {giamThat > 0 ? (
            <div className="flex justify-between gap-4" data-testid="dong-giam-ma-moi"><dt className="text-white/55">{t("Mã mời", "Invite code")}</dt><dd className="text-[#e7c78d]">−{giamThat.toLocaleString("vi-VN")} VND</dd></div>
          ) : null}
          <div className="flex justify-between gap-4 text-lg font-bold"><dt>{t("Tổng", "Total")}</dt><dd className="text-[#e7c78d]" data-testid="tong-tien-don">{tongTien.toLocaleString("vi-VN")} VND</dd></div>
        </dl>

        {confirmation ? (
          <div
            className="mt-6"
            data-testid="customer-booking-confirmed"
            {...chi("xong", "Xong: vé đã phát, đồng hồ giữ chỗ đã dừng. Bấm \"Sang bước 2\" để xem đơn này trong ERP.")}
          >
            <p className="rounded-2xl bg-[#dceadd] p-4 font-bold text-[#183f34]">
              {confirmation.payment.mode === "qr-transfer" ? t("Đã thanh toán bằng QR", "Paid by QR code") : t("Đã xác nhận", "Confirmed")} · {confirmation.order.code}
            </p>

            <ChuyenCuaBan
              batDau={hold?.slots[0]?.startsAt ?? null}
              ngayDi={visitDate}
              diemDen={tenDiem(hold?.slots[0]?.siteId ?? packageItem.siteIds[0], lang)}
              toaDo={DESTINATIONS.find((d) => d.id === (hold?.slots[0]?.siteId ?? packageItem.siteIds[0]))?.coordinates ?? null}
              tenGoi={tenGoi}
              maDon={confirmation.order.code}
              lang={lang}
            />

            {/* Hệ thống chưa gửi tin nhắn hay email nào, nên không viết chữ
                nào ngụ ý "đã gửi cho bạn". Đường giữ vé là ảnh vé lưu về máy
                (nút bên dưới), cộng trang tra cứu vé bằng liên hệ. */}
            <div className="mt-5 rounded-2xl border border-[#e7c78d]/45 bg-[#e7c78d]/12 p-4">
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#e7c78d]">
                {t("Xin bạn giữ lấy mã này", "Please keep this code")}
              </p>
              <p className="font-display mt-2 text-2xl tracking-[0.06em] text-[#e7c78d]">
                {confirmation.order.code}
              </p>
              <p className="mt-3 text-sm leading-6 text-white/75">
                {t("Bạn bấm ", "Press ")}
                <strong className="font-bold text-white">{t("Lưu ảnh vé về máy", "Save ticket image")}</strong>
                {t(
                  " ở dưới: ảnh vé nằm trong thư viện ảnh, tới cổng mở ra cho nhân viên quét là vào.",
                  " below: the ticket goes into your photos, and at the gate you just show it to be scanned.",
                )}
                {/* TC-25: câu này nay tuỳ vào việc khách CÓ để lại liên hệ hay
                    không, chứ không tuỳ vào cách trả tiền. Trước đây lối trả
                    ngay luôn nhận câu "trang tra cứu chưa có gì để đối chiếu",
                    và đó là sự thật của lúc ấy — nhưng là một sự thật đáng lẽ
                    không nên tồn tại. */}
                {contactSaved ? (
                  <>
                    {" "}
                    {t("Lỡ mất trang, mời bạn vào", "If you lose this page, open")}{" "}
                    <Link
                      href="/tra-cuu-ve"
                      className="font-bold text-[#e7c78d] underline decoration-[#e7c78d]/50 underline-offset-4"
                    >
                      {t("tra cứu vé", "ticket lookup")}
                    </Link>{" "}
                    {t(
                      "rồi nhập mã trên cùng số điện thoại hoặc email bạn vừa để lại là vé hiện lại đầy đủ.",
                      "and enter this code with the phone number or email you just left; the full ticket comes back.",
                    )}
                  </>
                ) : (
                  <>
                    {" "}
                    {t(
                      "Lần này bạn không để lại số nào, nên trang tra cứu chưa có gì để đối chiếu — tấm ảnh chụp màn hình là bản lưu duy nhất của bạn.",
                      "You did not leave a number this time, so ticket lookup has nothing to match — a screenshot is your only copy.",
                    )}
                  </>
                )}
              </p>
            </div>

            <MaCaNgay
              maDon={confirmation.order.code}
              noi={[...new Set(confirmation.tickets.map((ve) => ve.siteId))].map((id) => tenDiem(id, lang))}
              ngayDi={visitDate}
              soLuot={adults}
              lang={lang}
              toi
            />

            <p className="mt-5 text-xs font-extrabold uppercase tracking-[0.18em] text-white/55">{t("Vé của bạn", "Your tickets")}</p>
            <p className="mt-1 text-sm leading-6 text-white/70">{t("Tới cổng, bạn đưa mã cho nhân viên quét là vào được ngay.", "At the gate, show the code to be scanned and walk straight in.")}</p>
            <ul className="mt-3 space-y-3">
              {Array.from(
                confirmation.tickets.reduce((bySite, ticket) => {
                  const forSite = bySite.get(ticket.siteId) ?? [];
                  forSite.push(ticket);
                  bySite.set(ticket.siteId, forSite);
                  return bySite;
                }, new Map<string, ConfirmationResult["tickets"]>()),
              ).map(([siteId, ticketsForSite]) => (
                <li key={siteId}>
                  <p className="text-sm font-bold text-white/85">{formatGuestGroupSummary(ticketsForSite, lang)}</p>
                  <ul className="mt-3 space-y-4">
                    {ticketsForSite.map((ticket) => (
                      <li key={ticket.ticketId}>
                        <VeLapLanh
                          ticketCode={ticket.ticketCode}
                          siteName={tenDiem(ticket.siteId, lang)}
                          detail={NHOM_KHACH_VE[ticket.guestGroup][lang]}
                          validOn={ticket.validOn}
                          entriesAllowed={ticket.entriesAllowed}
                          lang={lang}
                        />
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
            <LuuAnhVe
              orderCode={confirmation.order.code}
              productName={tenGoi}
              tickets={confirmation.tickets}
              lang={lang}
            />
            <Link
              href="/ho-so"
              className="mt-3 block text-center text-sm font-bold text-[#e7c78d] underline decoration-[#e7c78d]/50 underline-offset-4"
            >
              {t("Xem hộ chiếu Ninh Bình: đi đủ các vùng để mở quà", "See your Ninh Binh passport: visit every area to unlock gifts")}
            </Link>

            <div className="mt-8 border-t border-white/15 pt-6">
              {!group ? (
                <>
                  <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-white/55">{t("Nếu bạn đi theo đoàn", "Travelling as a group?")}</p>
                  <p className="mt-2 text-sm leading-6 text-white/70">
                    {t("Mời trưởng đoàn ghi tên vào đây, mỗi người trong đoàn sẽ có một mã riêng để tự quét vào cổng. Không ghi cũng không sao — cả đoàn vẫn vào bằng đúng những tấm vé bên trên.", "The group leader can add a name here, and everyone gets their own code for the gate. You can skip it — the whole group still enters with the tickets above.")}
                  </p>
                  <form onSubmit={createVisitorGroup} className="mt-4 space-y-3">
                    <label className="block text-xs font-bold text-white/70">
                      {t("Tên trưởng đoàn", "Group leader's name")}
                      <input
                        required
                        value={leaderName}
                        onChange={(event) => setLeaderName(event.target.value)}
                        placeholder={t("Ví dụ: Nguyễn Văn A", "e.g. Anna Smith")}
                        className="mt-1 min-h-12 w-full rounded-xl border border-white/25 bg-white/10 px-4 font-normal text-white placeholder:text-white/40"
                      />
                    </label>
                    <label className="block text-xs font-bold text-white/70">
                      {t("Số điện thoại (không bắt buộc)", "Phone (optional)")}
                      <input
                        type="tel"
                        value={leaderPhone}
                        onChange={(event) => setLeaderPhone(event.target.value)}
                        placeholder={t("Để trống nếu bạn muốn", "Leave blank if you like")}
                        className="mt-1 min-h-12 w-full rounded-xl border border-white/25 bg-white/10 px-4 font-normal text-white placeholder:text-white/40"
                      />
                    </label>
                    <label className="block text-xs font-bold text-white/70">
                      {t("Đặt tên cho đoàn (không bắt buộc)", "Group name (optional)")}
                      <input
                        value={groupLabel}
                        onChange={(event) => setGroupLabel(event.target.value)}
                        placeholder={t("Ví dụ: Đoàn Hà Nội, công ty ABC Travel", "e.g. Hanoi friends, ABC Travel")}
                        className="mt-1 min-h-12 w-full rounded-xl border border-white/25 bg-white/10 px-4 font-normal text-white placeholder:text-white/40"
                      />
                    </label>
                    {groupMessage ? <p role="alert" className="text-sm text-[#f4b8a4]">{groupMessage}</p> : null}
                    <button
                      type="submit"
                      disabled={groupPending}
                      className="min-h-12 w-full rounded-full bg-white/15 px-6 font-extrabold text-white transition-colors hover:bg-white/25 disabled:opacity-50"
                    >
                      {groupPending ? t("Đang tạo mã đoàn…", "Creating group code…") : t("Tạo mã cho cả đoàn", "Create codes for the group")}
                    </button>
                  </form>
                </>
              ) : (
                <>
                  <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-white/55">{t("Mã đoàn của bạn", "Your group code")}</p>
                  <div className="mt-2 flex flex-wrap items-baseline gap-3">
                    <p className="font-display text-3xl text-[#e7c78d]">{group.groupCode}</p>
                    {group.groupLabel ? (
                      <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-white/75">{group.groupLabel}</span>
                    ) : null}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-white/70">
                    {t("Trưởng đoàn gửi mã này cho cả đoàn. Mỗi người quét mã riêng để ghi tên mình vào chuyến đi — không quét vẫn vào cổng bình thường như mọi khách khác.", "The leader shares this code with the group. Each person scans their own code to add their name — without it they still enter like any other guest.")}
                  </p>
                  {/* TC-19: trang theo dõi của trưởng đoàn dựng xong rồi mà
                      không có lối vào thì coi như chưa có. Đây là chỗ duy
                      nhất mã đoàn hiện ra lần đầu, nên đường dẫn phải nằm
                      ngay cạnh nó. */}
                  <p className="mt-3 text-sm leading-6 text-white/70">
                    {t("Đứng ở cổng mà muốn biết còn ai chưa vào, mời trưởng đoàn mở", "To see who has not gone in yet, the leader can open the")}{" "}
                    <Link
                      href={`/doan/truong/${group.groupCode}`}
                      className="font-bold text-[#e7c78d] underline decoration-[#e7c78d]/50 underline-offset-4"
                    >
                      {t("trang theo dõi đoàn", "group tracker")}
                    </Link>
                    {" "}{t("— trang tự đếm lại sau mỗi nửa phút.", "— it recounts every half minute.")}
                  </p>
                  <ul className="mt-5 grid gap-3 sm:grid-cols-2">
                    {group.members.map((member) => {
                      const hasEntered = member.entries.length > 0;
                      return (
                        <li key={member.memberCode} className="flex gap-3 rounded-2xl bg-white/8 p-4">
                          <MemberQrCode memberCode={member.memberCode} lang={lang} />
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-bold text-white/90">{member.displayName || t("Chưa ghi tên", "No name yet")}</p>
                            <p className="mt-1 text-xs text-white/55">
                              {member.guestGroup === "child" ? "Trẻ 1m–1m3" : "Từ 1m3 trở lên"}
                            </p>
                            {/* "Chưa vào cổng" ở `text-white/45` trên nền
                                `bg-white/8` chỉ được 3,26:1 — cùng một lỗi
                                với khối chọn cách trả tiền. /70 cho 5,5:1. */}
                            <p className={`mt-2 text-xs font-bold ${hasEntered ? "text-[#9ee6b8]" : "text-white/70"}`}>
                              {hasEntered ? t("Đã vào cổng", "Entered") : t("Chưa vào cổng", "Not in yet")}
                            </p>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                  <button
                    type="button"
                    onClick={refreshVisitorGroup}
                    disabled={groupRefreshing}
                    className="mt-4 text-xs font-bold text-white/60 underline decoration-white/30 underline-offset-4 hover:text-white/85 disabled:opacity-50"
                  >
                    {groupRefreshing ? t("Đang cập nhật…", "Updating…") : t("Cập nhật trạng thái cả đoàn", "Refresh the group")}
                  </button>

                  <div className="mt-8 border-t border-white/10 pt-6">
                    <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-white/55">{t("Điền hộ cho cả đoàn", "Fill in for the group")}</p>
                    <p className="mt-2 text-sm leading-6 text-white/70">
                        {t(
                          "Muốn ghi tên và nhu cầu chăm sóc cho cả đoàn cùng lúc, mời trưởng đoàn điền vào đây rồi lưu một lần. Trưởng đoàn chỉ cần ghi tên gọi cho từng người thôi ạ — ai tự quét mã riêng khai tên mình, tên đó thay cho tên trưởng đoàn ghi ở đây.",
                          "To add names and care needs for everyone at once, the leader fills this in and saves once. A first name each is enough — anyone who scans their own code and adds a name replaces what the leader wrote.",
                        )}
                    </p>
                    <form onSubmit={saveMemberDetails} className="mt-4">
                      <div className="max-h-[28rem] space-y-3 overflow-y-auto rounded-2xl border border-white/10 p-3">
                        {group.members.map((member) => {
                          const edit = memberEdits[member.memberIndex];
                          return (
                            <div key={member.memberCode} className="rounded-xl bg-white/8 p-3">
                              <p className="text-xs font-bold text-white/55">
                            {t("Khách số", "Guest")} {member.memberIndex} · {member.guestGroup === "child" ? t("Trẻ 1m–1m3", "Child 1–1.3 m") : t("Từ 1m3 trở lên", "1.3 m and taller")}
                              </p>
                              <label className="mt-2 block text-xs font-bold text-white/70">
                              {t("Tên gọi", "Name")}
                              <input
                                  value={edit?.displayName ?? member.displayName}
                                  onChange={(event) => updateMemberEdit(member.memberIndex, member, { displayName: event.target.value })}
                                  placeholder={t("Chưa ghi tên", "No name yet")}
                                  className="mt-1 min-h-11 w-full rounded-lg border border-white/25 bg-white/10 px-3 text-sm font-normal text-white placeholder:text-white/40"
                                />
                              </label>
                              <label className="mt-2 block text-xs font-bold text-white/70">
                              {t("Nhu cầu chăm sóc", "Care needs")}
                              <select
                                  value={edit?.careNeed ?? member.careNeed}
                                  onChange={(event) => updateMemberEdit(member.memberIndex, member, { careNeed: event.target.value as CareNeedValue })}
                                  className="mt-1 min-h-11 w-full rounded-lg border border-white/25 bg-white/10 px-3 text-sm font-normal text-white"
                                >
                                  {CARE_NEED_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value} className="text-[#151a17]">
                                      {lang === "en" ? option.labelEn : option.label}
                                    </option>
                                  ))}
                                </select>
                              </label>
                            </div>
                          );
                        })}
                      </div>
                      {memberDetailsMessage ? (
                        <p role="status" className="mt-3 text-sm text-white/80">{memberDetailsMessage}</p>
                      ) : null}
                      <button
                        type="submit"
                        disabled={memberDetailsPending || Object.keys(memberEdits).length === 0}
                        className="mt-4 min-h-12 w-full rounded-full bg-white/15 px-6 font-extrabold text-white transition-colors hover:bg-white/25 disabled:opacity-50"
                      >
                        {memberDetailsPending ? t("Đang lưu…", "Saving…") : t("Lưu tên cả đoàn", "Save the group's names")}
                      </button>
                    </form>
                  </div>
                </>
              )}
            </div>
          </div>
        ) : !hold ? (
          <>
            <button
              type="button"
              onClick={createHold}
              {...chi("giu", "Bấm \"Giữ chỗ 15 phút\".")}
              // `partySizeInvalid` hiện không thể xảy ra: hai hàm `updateAdults`
              // và `updateChildren` đã kẹp số ngay lúc khách gõ. Giữ lại làm
              // lưới an toàn cho ngày ai đó nới chỗ kẹp ấy ra — nhưng không kèm
              // câu cảnh báo, vì một câu không bao giờ hiện ra chỉ làm người đọc
              // mã tin rằng nó đã được thử.
              disabled={
                pending !== null
                || partySizeInvalid
                || !visitDate
                || !selectedSlot
                || !selectedSlot.bookable
                || partySizeExceedsSlot
              }
              className="mt-7 min-h-12 w-full rounded-full bg-[#f4f0e7] px-6 font-extrabold text-[#183f34] disabled:opacity-50"
            >
              {pending === "hold" ? t("Đang khóa chỗ…", "Holding seats…") : t("Giữ chỗ 15 phút", "Hold for 15 minutes")}
            </button>
            {/* Soát 07/10/2026: nút mờ mà không nói vì sao, khách tưởng hỏng. */}
            {pending === null && (!visitDate || !selectedSlot) ? (
              <p data-testid="giu-cho-can-gi" className="mt-2 text-center text-sm text-white/75">
                {!visitDate ? t("Mời bạn chọn ngày đi ở trên.", "Pick a date above.") : t("Mời bạn chọn một khung giờ ở trên.", "Pick a time slot above.")}
              </p>
            ) : null}
          </>
        ) : (
          <>
          {qr ? (
            // Mã QR thanh toán. Máy tính: khách giơ điện thoại quét. Điện
            // thoại: không tự quét được màn hình của chính mình, nên có nút mở
            // thẳng trang thanh toán ở thẻ mới — thẻ này vẫn tự chuyển sang vé.
            <div
              data-testid="qr-thanh-toan"
              className="mt-7 rounded-2xl bg-[#f4f0e7] p-5 text-center text-[#27362f]"
              {...chi("qr", "Quét mã bằng điện thoại, hoặc bấm \"Mở trang thanh toán trên máy này\" (trên điện thoại: \"Thanh toán ngay\"), rồi bấm \"Xác nhận chuyển khoản\". Trang này tự chuyển sang vé.")}
            >
              <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#356957]">{t("Quét mã để thanh toán", "Scan to pay")}</p>
              <p className="font-display mt-2 text-3xl text-[#183f34]">{(hold.amount.total_vnd).toLocaleString("vi-VN")} đ</p>
              {/* Điện thoại không tự quét được màn hình của chính nó, nên trên
                  màn hẹp nút mở trang thanh toán đứng TRƯỚC mã QR. */}
              <a
                href={qr.payUrl}
                target="_blank"
                rel="noopener"
                className="mt-4 flex min-h-12 items-center justify-center rounded-full bg-[#183f34] px-5 text-sm font-extrabold text-white lg:hidden"
              >
                {t("Thanh toán ngay", "Pay now")}
              </a>
              <p className="mt-4 text-xs font-bold text-[#59654b] lg:hidden">{t("Hoặc đưa mã này cho người đi cùng quét", "Or let someone with you scan this code")}</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qr.dataUrl}
                alt={t("Mã QR thanh toán, quét bằng camera điện thoại hoặc Zalo", "Payment QR code, scan with your phone camera")}
                className="mx-auto mt-4 aspect-square w-full max-w-[15rem] rounded-2xl border border-[#d7d5cd] bg-white p-3"
              />
              <p className="mt-4 hidden text-sm leading-6 lg:block">
                {t("Mở camera điện thoại hoặc Zalo, quét mã rồi bấm ", "Open your phone camera, scan the code and press ")}
                <strong className="font-bold">{t("Xác nhận chuyển khoản", "Confirm transfer")}</strong>
                {t(". Vé hiện ra ngay trên màn hình này.", ". Your ticket appears right here on this screen.")}
              </p>
              {/* Máy tính mà không có điện thoại bên cạnh (hay gặp khi trình
                  diễn): mở đúng trang ấy ở thẻ mới. Thanh toán ở đây là giả lập. */}
              <a
                href={qr.payUrl}
                target="_blank"
                rel="noopener"
                className="mt-2 hidden min-h-11 items-center text-sm font-bold text-[#356957] underline underline-offset-4 lg:inline-flex"
              >
                {t("Không có điện thoại bên cạnh? Mở trang thanh toán trên máy này", "No phone at hand? Open the payment page on this computer")}
              </a>
              <p role="status" className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-[#356957]">
                <span aria-hidden="true" className="h-2.5 w-2.5 animate-pulse rounded-full bg-[#d58c35] motion-reduce:animate-none" />
                {t("Đang chờ bạn quét mã · còn", "Waiting for your scan ·")} {formatCountdown(remainingSeconds)}{t("", " left")}
              </p>
              <button
                type="button"
                onClick={() => setQr(null)}
                className="mx-auto mt-3 block min-h-11 text-sm font-bold text-[#59654b] underline underline-offset-4"
              >
                {t("Đổi cách trả tiền", "Change how to pay")}
              </button>
            </div>
          ) : (
          <div {...chi("lien-he", "Gõ một số điện thoại bất kỳ, ví dụ 0912345678, rồi bấm \"Lấy mã QR thanh toán\".")}>
          {/* Nền kem đục trên thẻ xanh đậm: chữ trong khối lấy màu nền sáng.
              Trước đây nền trong suốt một nửa, axe đo chữ chỉ đạt 2:1. */}
          <fieldset className="mt-7 rounded-2xl border border-[#d7d5cd] bg-[#f4f0e7] p-4 text-[#27362f]">
            {/* `legend` vắt lên viền trên và KHÔNG được nền fieldset sơn phía
                sau, nên phải tự sơn nền kem cho nó, không thì chữ xanh rơi
                thẳng xuống nền xanh đậm (1,8:1). */}
            <legend className="rounded bg-[#f4f0e7] px-2 text-xs font-extrabold uppercase tracking-[0.16em] text-[#356957]">{t("Trả tiền thế nào", "How to pay")}</legend>
            <label className="flex min-h-11 items-start gap-3 text-sm text-[#27362f]">
              <input type="radio" name="cach-tra-tien" checked={!payAtSite} onChange={() => setPayAtSite(false)} className="mt-1" />
              <span><strong className="font-bold">{t("Quét mã QR (nên chọn)", "QR code (recommended)")}</strong> {t("— quét bằng camera hoặc Zalo trong 15 phút giữ chỗ, vé có ngay.", "— scan with your camera within the 15-minute hold and get your ticket at once.")}</span>
            </label>
            <label className="mt-3 flex min-h-11 items-start gap-3 text-sm text-[#27362f]">
              <input type="radio" name="cach-tra-tien" checked={payAtSite} onChange={() => setPayAtSite(true)} className="mt-1" />
              <span><strong className="font-bold">{t("Trả tại điểm", "Pay on site")}</strong> {t("— giữ chỗ ngay, tới nơi đưa mã cho nhân viên rồi trả tiền mặt.", "— hold now, then show the code at the gate and pay in cash.")}</span>
            </label>
            {/* Liên hệ bắt buộc ở cả hai lối: nó là đường mở lại vé ở trang
                tra cứu, và là thứ để đếm ai giữ chỗ rồi bỏ nhiều lần. */}
            <label className="mt-4 grid gap-1 text-xs font-bold text-[#5f6f66]">
              {t("Số điện thoại hoặc email", "Phone or email")}
              <input
                value={contact}
                onChange={(event) => setContact(event.target.value)}
                // Ô nhận CẢ số điện thoại lẫn email, nên không ghim
                // `inputMode="tel"`: bàn phím số không gõ nổi dấu @.
                placeholder={t("0912 345 678 hoặc ban@email.com", "0912 345 678 or you@email.com")}
                className="min-h-11 rounded-xl border border-[#cbd7d1] bg-white px-3 text-sm font-medium"
              />
              <span className="mt-1 font-normal leading-5 text-[#59654b]">
                {t("Lỡ mất trang, bạn dùng số này để mở lại vé ở mục tra cứu vé. Giữ chỗ rồi bỏ ba lần trong tuần thì số này phải đặt tại quầy. Số của bạn được mã hoá trước khi lưu.", "If you lose this page, this number opens your ticket again in ticket lookup. Hold and abandon three times in a week and this number must book at the counter. It is encrypted before it is stored.")}
              </span>
            </label>
          </fieldset>
          <button
            type="button"
            onClick={confirmBooking}
            disabled={pending !== null || remainingSeconds <= 0}
            className="mt-4 min-h-12 w-full rounded-full bg-[#d58c35] px-6 font-extrabold text-[#151a17] disabled:opacity-50"
          >
            {pending === "confirm"
              ? payAtSite ? t("Đang phát hành vé…", "Issuing tickets…") : t("Đang tạo mã QR…", "Creating QR code…")
              : remainingSeconds <= 0
                ? t("Giữ chỗ đã hết hạn", "Hold has expired")
                : payAtSite ? t("Giữ chỗ, trả tiền tại điểm", "Hold, pay on site") : t("Lấy mã QR thanh toán", "Get payment QR code")}
          </button>
          </div>
          )}
          </>
        )}
        {/* `text-white/45` trên nền #183F34 chỉ đạt 3,67:1. Nâng lên /60 là
            5,3:1 mà vẫn giữ đúng vai trò dòng chú thích mờ. */}
        <p className="mt-5 text-xs leading-5 text-white/60">{t("Lỡ bấm hai lần cũng không sao, bạn vẫn chỉ có một đơn và một bộ vé.", "Pressed twice by mistake? No problem — you still get one order and one set of tickets.")}</p>
      </aside>
    </div>
  );
}
