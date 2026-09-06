"use client";

import Link from "next/link";
import QRCode from "qrcode";
import { useEffect, useRef, useState } from "react";
import type { PackageCatalogItem } from "@/content/packages";
import type { CustomerProductTimeSlot } from "@/domain/customer-booking";
import type { VisitorGroupStatus } from "@/domain/visitor-group";
import { getOrCreateCustomerAnonymousId } from "@/lib/customer-data/browser-tracking";

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
function MemberQrCode({ memberCode }: { memberCode: string }) {
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
    return <div className="grid size-16 shrink-0 place-items-center rounded-xl bg-[#f4f0e7] text-[10px] text-[#6b786f]">Đang tạo…</div>;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={qrDataUrl}
      alt={`Mã QR để tự khai tên, mã thành viên ${memberCode}`}
      className="size-16 shrink-0 rounded-xl bg-[#f4f0e7]"
    />
  );
}

// Mã QR của vé chứa đúng mã vé trần (ví dụ `WEB-A1B2C3D4E5F6`), khác hẳn
// `MemberQrCode` ở trên vốn chứa một địa chỉ web. Máy quét ở cổng đọc thẳng
// nội dung QR rồi đối chiếu với mã vé — nhét thêm đường dẫn vào đây là vé
// không quét được nữa.
//
// Cách vẽ giữ nguyên `MemberQrCode`, dùng lại gói `qrcode` đã có trong dự án.
function TicketQrCode({ ticketCode }: { ticketCode: string }) {
  const [qrDataUrl, setQrDataUrl] = useState("");

  useEffect(() => {
    let active = true;
    void QRCode.toDataURL(ticketCode, {
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
  }, [ticketCode]);

  if (!qrDataUrl) {
    return <div className="grid size-16 shrink-0 place-items-center rounded-xl bg-[#f4f0e7] text-[10px] text-[#6b786f]">Đang tạo…</div>;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={qrDataUrl}
      alt={`Mã QR để quét ở cổng, mã vé ${ticketCode}`}
      className="size-16 shrink-0 rounded-xl bg-[#f4f0e7]"
    />
  );
}

type HoldResult = {
  order: { id: string; code: string };
  hold: { id: string; status: string; expires_at: string };
  amount: { total_vnd: number; currency: "VND" };
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
    mode: "simulation" | "pay-on-site";
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

// Nói theo cách khách hiểu, không theo cách bảng dữ liệu gọi. "child" ở đây
// nghĩa hẹp là trẻ dưới 1m3 — nhóm không mất vé. Vé cũ phát trước TC-03 gộp cả
// đoàn vào một tấm, vẫn ghi đúng số khách chứ không gọi nhầm thành vé thường.
function formatGuestGroupSummary(tickets: ConfirmationResult["tickets"]) {
  const adultTicket = tickets.find((ticket) => ticket.guestGroup === "adult");
  const childTicket = tickets.find((ticket) => ticket.guestGroup === "child");
  const groupTicket = tickets.find((ticket) => ticket.guestGroup === "group");
  const parts: string[] = [];
  if (adultTicket) parts.push(`${adultTicket.entriesAllowed} vé`);
  if (childTicket) parts.push(`${childTicket.entriesAllowed} trẻ dưới 1m3 (không mất vé)`);
  if (groupTicket) parts.push(`${groupTicket.entriesAllowed} khách`);
  return parts.join(" · ");
}

const SOURCE_LABEL = {
  estimate: "Ước tính vận hành T11a",
  customer: "Số liệu doanh nghiệp cung cấp",
  measured: "Số liệu đã đo",
} as const;

// TC-15 — nhu cầu chăm sóc thay cho tuổi, đúng chủ đích của domain/visitor-group.ts.
// Giữ nguyên bốn giá trị và nhãn này, vì máy trực cổng đọc theo đúng chữ trong danh sách.
type CareNeedValue = VisitorGroupStatus["members"][number]["careNeed"];

const CARE_NEED_OPTIONS: Array<{ value: CareNeedValue; label: string }> = [
  { value: "none", label: "Không cần gì thêm" },
  { value: "young-child", label: "Đi cùng trẻ nhỏ" },
  { value: "elderly", label: "Người cao tuổi" },
  { value: "mobility", label: "Khó đi lại" },
];

function localIsoDate(daysFromToday: number) {
  const date = new Date();
  date.setDate(date.getDate() + daysFromToday);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatCountdown(seconds: number) {
  const safe = Math.max(0, seconds);
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
}

function formatSlotTime(iso: string) {
  return new Date(iso).toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
  });
}

type SlotsApiResponse =
  | { accepted: true; slots: CustomerProductTimeSlot[] }
  | { accepted: false; error?: { message?: string } };

async function responsePayload(response: Response) {
  const payload = await response.json().catch(() => null) as
    | { error?: { message?: string } }
    | null;
  if (!response.ok) {
    throw new Error(payload?.error?.message ?? "Kho đặt chỗ chưa phản hồi. Hãy thử lại.");
  }
  return payload;
}

export function CustomerBookingCheckout({
  packageItem,
}: {
  packageItem: PackageCatalogItem;
}) {
  // Mặc định: gói cố định tổng khách thì mọi chỗ tính là người lớn cho tới
  // khi khách tự đổi tỉ lệ; gói thường mặc định hai người lớn như trước đây.
  const [adults, setAdults] = useState(() => (packageItem.fixedPartySize ? Math.max(1, packageItem.fixedPartySize) : 2));
  const [children, setChildren] = useState(0);
  const partySize = adults + children;
  const [visitDate, setVisitDate] = useState(() => packageItem.bookingStartDate ?? localIsoDate(1));
  const [slots, setSlots] = useState<CustomerProductTimeSlot[] | null>(null);
  const [slotsLoading, setSlotsLoading] = useState(true);
  const [slotsError, setSlotsError] = useState("");
  const [selectedSlotStartsAt, setSelectedSlotStartsAt] = useState<string | null>(null);
  const [hold, setHold] = useState<HoldResult | null>(null);
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [pending, setPending] = useState<"hold" | "confirm" | null>(null);
  const [message, setMessage] = useState("");
  const holdRequestId = useRef(crypto.randomUUID());
  const paymentRequestId = useRef(crypto.randomUUID());

  // TC-06 — khách đoàn: trưởng đoàn khai tối thiểu tên mình sau khi vé đã
  // phát; không bắt buộc, và bỏ qua không ảnh hưởng gì tới việc vào cổng.
  const [leaderName, setLeaderName] = useState("");
  const [leaderPhone, setLeaderPhone] = useState("");
  // TC-22: khách chọn trả tiền tại điểm thay vì trả ngay trên trang.
  const [payAtSite, setPayAtSite] = useState(false);
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

  useEffect(() => {
    if (!hold) return;
    const update = () => {
      setRemainingSeconds(Math.max(0, Math.ceil((new Date(hold.hold.expires_at).getTime() - Date.now()) / 1000)));
    };
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [hold]);

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
              || "Chưa lấy được khung giờ còn trống, mời bạn thử lại.",
          );
          return;
        }
        setSlots(payload.slots);
      } catch {
        if (!cancelled) {
          setSlots(null);
          setSlotsError("Chưa lấy được khung giờ còn trống, mời bạn thử lại.");
        }
      } finally {
        if (!cancelled) setSlotsLoading(false);
      }
    }
    void loadSlots();
    return () => {
      cancelled = true;
    };
  }, [packageItem.id, visitDate]);

  const selectedSlot = slots?.find((slot) => slot.startsAt === selectedSlotStartsAt) ?? null;
  const partySizeExceedsSlot = Boolean(selectedSlot && partySize > selectedSlot.remaining);
  const partySizeInvalid = adults < 1 || partySize < 1 || partySize > 45;

  // Bàn Trăng khoá tổng số chỗ: đổi được bao nhiêu khách có vé, bao nhiêu trẻ
  // dưới 1m3, nhưng tổng luôn đúng bằng fixedPartySize. Sản phẩm khác thì hai ô
  // độc lập, chỉ ràng buộc tối thiểu một khách có vé và tổng không vượt quá 20.
  function updateAdults(rawValue: number) {
    if (!Number.isFinite(rawValue)) return;
    const nextAdults = clamp(Math.trunc(rawValue), 1, 45);
    if (packageItem.fixedPartySize) {
      const total = packageItem.fixedPartySize;
      const boundedAdults = clamp(nextAdults, 1, total);
      setAdults(boundedAdults);
      setChildren(total - boundedAdults);
    } else {
      setAdults(nextAdults);
      setChildren((previousChildren) => clamp(previousChildren, 0, Math.max(0, 45 - nextAdults)));
    }
    invalidateHold();
  }

  function updateChildren(rawValue: number) {
    if (!Number.isFinite(rawValue)) return;
    const nextChildren = clamp(Math.trunc(rawValue), 0, 44);
    if (packageItem.fixedPartySize) {
      const total = packageItem.fixedPartySize;
      const boundedChildren = clamp(nextChildren, 0, Math.max(0, total - 1));
      setChildren(boundedChildren);
      setAdults(total - boundedChildren);
    } else {
      setChildren(nextChildren);
      setAdults((previousAdults) => clamp(previousAdults, 1, Math.max(1, 45 - nextChildren)));
    }
    invalidateHold();
  }

  function invalidateHold() {
    setHold(null);
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
      setMessage("Mời bạn chọn một khung giờ trước khi giữ chỗ.");
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
        }),
      });
      const payload = await responsePayload(response) as HoldResult;
      setHold(payload);
      setConfirmation(null);
      paymentRequestId.current = crypto.randomUUID();
      setMessage("Đã giữ chỗ thật trong kho công suất. Thời hạn 15 phút bắt đầu từ lúc này.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể giữ chỗ lúc này.");
    } finally {
      setPending(null);
    }
  }

  async function confirmBooking() {
    if (!hold || remainingSeconds <= 0) return;
    // TC-22: chọn trả tiền tại điểm thì phải có liên hệ. Chặn ngay ở đây để
    // khách thấy lý do tại chỗ, thay vì bấm xong mới nhận một câu từ chối.
    if (payAtSite && contact.trim().length < 6) {
      setMessage("Bạn để lại giúp em số điện thoại hoặc email, để đội ngũ liên lạc được khi có việc ạ.");
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
          payment_mode: payAtSite ? "pay-on-site" : "simulation",
          ...(payAtSite ? { contact: contact.trim() } : {}),
        }),
      });
      const payload = await responsePayload(response) as ConfirmationResult;
      setConfirmation(payload);
      setMessage(
        payAtSite
          ? "Đã giữ chỗ. Vé và mã QR có ngay bên dưới; tới nơi bạn đưa mã cho nhân viên, trả tiền rồi vào ạ."
          : "Đặt chỗ đã xác nhận. Vé bên dưới là vé thật mà cổng vận hành đọc trực tiếp.",
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể xác nhận đặt chỗ lúc này.");
    } finally {
      setPending(null);
    }
  }

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
            || "Chưa tạo được mã đoàn, mời bạn thử lại.",
        );
        return;
      }
      setGroup(payload.group);
    } catch {
      setGroupMessage("Chưa tạo được mã đoàn, mời bạn thử lại.");
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
            || "Chưa lưu được, mời bạn thử lại.",
        );
        return;
      }
      setGroup(payload.group);
      setMemberEdits({});
      setMemberDetailsMessage("Đã lưu tên cả đoàn.");
    } catch {
      setMemberDetailsMessage("Chưa lưu được, mời bạn thử lại.");
    } finally {
      setMemberDetailsPending(false);
    }
  }

  return (
    <div className="grid gap-7 lg:grid-cols-[1.05fr_0.78fr]">
      <section className="overflow-hidden rounded-[2rem] border border-[#d4d1c7] bg-white shadow-[0_24px_70px_rgba(24,63,52,0.08)]">
        <div className="border-b border-[#e5e1d8] bg-[#fbfaf6] p-6 sm:p-8">
          <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-[#9a6328]">
            Giữ chỗ trên công suất ERP
          </p>
          <h2 className="font-display mt-3 text-4xl leading-tight text-[#183f34] sm:text-5xl">
            Chọn ngày. Chúng tôi giữ chỗ trong 15 phút.
          </h2>
          <p className="mt-4 max-w-2xl leading-7 text-[#59654b]">
            Không cần tài khoản, tên, email hay số điện thoại. Phiên ẩn danh chỉ nối đơn với hành trình của bạn; không tự đăng ký nhận marketing.
          </p>
        </div>

        <div className="p-6 sm:p-8">
          <label className="block max-w-xs text-sm font-bold text-[#27362f]">
            Ngày trải nghiệm
            <input
              aria-label="Ngày trải nghiệm"
              type="date"
              value={visitDate}
              min={packageItem.bookingStartDate ?? localIsoDate(1)}
              max={packageItem.bookingEndDate ?? localIsoDate(90)}
              onChange={(event) => {
                setVisitDate(event.target.value);
                invalidateHold();
              }}
              className="mt-2 min-h-12 w-full rounded-xl border border-[#bec7bf] bg-white px-4 font-normal"
            />
          </label>

          <div className="mt-7">
            <p className="text-sm font-bold text-[#27362f]">Khung giờ</p>
            {slotsLoading ? (
              <p className="mt-3 text-sm text-[#6b786f]">Đang tải khung giờ còn trống…</p>
            ) : slotsError ? (
              <p role="alert" className="mt-3 text-sm text-[#9a3b2f]">{slotsError}</p>
            ) : !slots || slots.length === 0 ? (
              <p className="mt-3 text-sm text-[#6b786f]">Ngày này chưa mở khung giờ nào, mời bạn chọn ngày khác.</p>
            ) : (
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {slots.map((slot) => {
                  const selected = slot.startsAt === selectedSlotStartsAt;
                  const timeLabel = formatSlotTime(slot.startsAt);
                  const statusLabel = slot.blockedReason === "paused"
                    ? "Đang tạm dừng nhận khách"
                    : slot.blockedReason === "full"
                      ? "Đã hết chỗ"
                      : `Còn ${slot.remaining} chỗ`;
                  return (
                    <button
                      key={slot.startsAt}
                      type="button"
                      aria-pressed={selected}
                      aria-label={`Khung ${timeLabel}, ${statusLabel.toLowerCase()}`}
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
                      <span className="block text-lg font-extrabold">{timeLabel}</span>
                      <span className="mt-1 block text-xs font-normal">{statusLabel}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mt-7 max-w-xs">
            <p className="text-sm font-bold text-[#27362f]">Số khách</p>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <label className="block text-xs font-bold text-[#59654b]">
                Từ 1m3 trở lên
                <input
                  aria-label="Số khách cao từ 1m3 trở lên"
                  type="number"
                  min={1}
                  max={packageItem.fixedPartySize ?? 45}
                  value={adults}
                  onChange={(event) => updateAdults(Number(event.target.value))}
                  className="mt-1 min-h-12 w-full rounded-xl border border-[#bec7bf] bg-white px-4 font-normal text-[#27362f]"
                />
              </label>
              <label className="block text-xs font-bold text-[#59654b]">
                Dưới 1m3
                <input
                  aria-label="Số trẻ cao dưới 1m3"
                  type="number"
                  min={0}
                  max={packageItem.fixedPartySize ? Math.max(0, packageItem.fixedPartySize - 1) : 44}
                  value={children}
                  onChange={(event) => updateChildren(Number(event.target.value))}
                  className="mt-1 min-h-12 w-full rounded-xl border border-[#bec7bf] bg-white px-4 font-normal text-[#27362f]"
                />
              </label>
            </div>
            {packageItem.fixedPartySize ? (
              <span className="mt-2 block text-xs font-normal text-[#6b786f]">
                Bàn đã đặt sẵn cho {packageItem.fixedPartySize} khách. Trẻ dưới 1m3 không mất vé, và tổng số chỗ vẫn giữ nguyên ạ.
              </span>
            ) : (
              <span className="mt-2 block text-xs font-normal text-[#6b786f]">
                Trẻ dưới 1m3 không mất vé, nhưng vẫn được giữ một chỗ trên thuyền. Mỗi lượt đặt tối đa 20 khách.
              </span>
            )}
            {partySizeExceedsSlot ? (
              <span className="mt-2 block text-xs font-normal text-[#9a3b2f]">
                Khung giờ này còn {selectedSlot?.remaining} chỗ, ít hơn số khách bạn chọn. Mời bạn giảm số khách hoặc chọn khung khác.
              </span>
            ) : null}
          </div>

          <div className="mt-7 rounded-2xl border border-[#ddb77d] bg-[#fff8eb] p-5 text-[#6c4b1f]">
            <p className="font-extrabold">Thanh toán mô phỏng — không thu tiền</p>
            <p className="mt-2 text-sm leading-6">
              Hệ thống không hỏi số thẻ, tài khoản ngân hàng hay dữ liệu thanh toán thật. Nút xác nhận chỉ kiểm chứng vòng đời order → payment mô phỏng → vé T8.
            </p>
          </div>

          {hold ? (
            <div className="mt-7">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#557568]">Các điểm đã khóa công suất</p>
                  <p className="mt-2 text-sm text-[#59654b]">Điểm không có ngưỡng T11a vẫn thuộc lịch trình nhưng không bị ghi nhận giả là đã giữ sức chứa.</p>
                </div>
                <div className="rounded-2xl bg-[#183f34] px-5 py-3 text-right text-white">
                  <p className="text-xs uppercase tracking-[0.16em] text-white/60">Còn lại</p>
                  <p className="font-display mt-1 text-3xl text-[#e7c78d]">{formatCountdown(remainingSeconds)}</p>
                </div>
              </div>
              <ul className="mt-4 grid gap-3">
                {hold.slots.map((slot) => (
                  <li key={slot.slotId} className="rounded-2xl border border-[#dde1db] p-4">
                    <div className="flex flex-wrap justify-between gap-2">
                      <strong>{new Date(slot.startsAt).toLocaleString("vi-VN", { dateStyle: "medium", timeStyle: "short" })}</strong>
                      <span className="text-xs font-bold text-[#557568]">T11a v{slot.thresholdVersion}</span>
                    </div>
                    <p className="mt-2 text-sm text-[#59654b]">{SOURCE_LABEL[slot.capacitySource]}</p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {message ? <p role="status" className="mt-6 rounded-xl bg-[#edf3ee] p-4 text-sm leading-6 text-[#274c40]">{message}</p> : null}
        </div>
      </section>

      <aside className="h-fit rounded-[2rem] bg-[#183f34] p-6 text-white shadow-[0_24px_70px_rgba(12,38,31,0.2)] sm:p-8">
        <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-[#e7c78d]">Gói đã chọn</p>
        <h2 className="font-display mt-3 text-4xl leading-tight">{packageItem.name}</h2>
        <p className="mt-3 leading-7 text-white/65">{packageItem.durationLabel} · {packageItem.audience}</p>
        <dl className="mt-7 space-y-4 border-y border-white/15 py-5 text-sm">
          <div className="flex justify-between gap-4"><dt className="text-white/55">Đơn giá mỗi vé</dt><dd>{packageItem.demoPriceVnd.toLocaleString("vi-VN")} VND</dd></div>
          <div className="flex justify-between gap-4"><dt className="text-white/55">Số vé</dt><dd>{adults}</dd></div>
          {children > 0 ? (
            <div className="flex justify-between gap-4"><dt className="text-white/55">Trẻ dưới 1m3</dt><dd>{children} · không mất vé</dd></div>
          ) : null}
          <div className="flex justify-between gap-4 text-lg font-bold"><dt>Tổng</dt><dd className="text-[#e7c78d]">{(hold?.amount.total_vnd ?? packageItem.demoPriceVnd * Math.max(0, adults)).toLocaleString("vi-VN")} VND</dd></div>
        </dl>

        {confirmation ? (
          <div className="mt-6" data-testid="customer-booking-confirmed">
            <p className="rounded-2xl bg-[#dceadd] p-4 font-bold text-[#183f34]">Đã xác nhận · {confirmation.order.code}</p>

            {/* TC-23: nói thẳng hệ thống chưa gửi được tin nhắn, và chỉ cho
                khách đúng một đường lấy lại vé. Tuyệt đối không viết chữ nào
                ngụ ý "chúng tôi đã gửi tin cho bạn" — điều đó chưa làm được. */}
            <div className="mt-5 rounded-2xl border border-[#e7c78d]/45 bg-[#e7c78d]/12 p-4">
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#e7c78d]">
                Xin bạn giữ lấy mã này
              </p>
              <p className="font-display mt-2 text-2xl tracking-[0.06em] text-[#e7c78d]">
                {confirmation.order.code}
              </p>
              <p className="mt-3 text-sm leading-6 text-white/75">
                Bên em đang đấu nối Zalo; xong việc đó thì mã đặt chỗ tự về máy bạn. Còn bây
                giờ hệ thống chưa gửi được tin nhắn hay email nào, nên bạn chụp lại màn hình
                này giúp em ạ.
                {confirmation.payment.mode === "pay-on-site" ? (
                  <>
                    {" "}
                    Lỡ mất trang, mời bạn vào{" "}
                    <Link
                      href="/tra-cuu-ve"
                      className="font-bold text-[#e7c78d] underline decoration-[#e7c78d]/50 underline-offset-4"
                    >
                      tra cứu vé
                    </Link>{" "}
                    rồi nhập mã trên cùng số điện thoại hoặc email bạn vừa để lại là vé hiện lại
                    đầy đủ.
                  </>
                ) : (
                  <>
                    {" "}
                    Lối trả ngay không nhận liên hệ của bạn, nên trang tra cứu chưa có gì để đối
                    chiếu — tấm ảnh chụp màn hình là bản lưu duy nhất của bạn ạ.
                  </>
                )}
              </p>
            </div>

            <p className="mt-5 text-xs font-extrabold uppercase tracking-[0.18em] text-white/55">Vé của bạn</p>
            <p className="mt-1 text-sm leading-6 text-white/70">Tới cổng, bạn đưa mã cho nhân viên quét là vào được ngay ạ.</p>
            <ul className="mt-3 space-y-3">
              {Array.from(
                confirmation.tickets.reduce((bySite, ticket) => {
                  const forSite = bySite.get(ticket.siteId) ?? [];
                  forSite.push(ticket);
                  bySite.set(ticket.siteId, forSite);
                  return bySite;
                }, new Map<string, ConfirmationResult["tickets"]>()),
              ).map(([siteId, ticketsForSite]) => (
                <li key={siteId} className="rounded-2xl border border-white/15 bg-white/8 p-4">
                  <p className="text-sm font-bold text-white/85">{formatGuestGroupSummary(ticketsForSite)}</p>
                  <ul className="mt-3 space-y-3 border-t border-white/10 pt-3">
                    {ticketsForSite.map((ticket) => (
                      <li key={ticket.ticketId} className="flex items-center gap-3">
                        <TicketQrCode ticketCode={ticket.ticketCode} />
                        <div className="min-w-0">
                          <code className="text-lg font-extrabold tracking-[0.08em] text-[#e7c78d]">{ticket.ticketCode}</code>
                          <p className="mt-1 text-sm text-white/62">{ticket.entriesAllowed} lượt vào · hiệu lực {new Date(`${ticket.validOn}T00:00:00`).toLocaleDateString("vi-VN")}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>

            <div className="mt-8 border-t border-white/15 pt-6">
              {!group ? (
                <>
                  <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-white/55">Nếu bạn đi theo đoàn</p>
                  <p className="mt-2 text-sm leading-6 text-white/70">
                    Mời trưởng đoàn ghi tên vào đây, mỗi người trong đoàn sẽ có một mã riêng để tự quét vào cổng. Không ghi cũng không sao — cả đoàn vẫn vào bằng đúng những tấm vé bên trên.
                  </p>
                  <form onSubmit={createVisitorGroup} className="mt-4 space-y-3">
                    <label className="block text-xs font-bold text-white/70">
                      Tên trưởng đoàn
                      <input
                        required
                        value={leaderName}
                        onChange={(event) => setLeaderName(event.target.value)}
                        placeholder="Ví dụ: Nguyễn Văn A"
                        className="mt-1 min-h-12 w-full rounded-xl border border-white/25 bg-white/10 px-4 font-normal text-white placeholder:text-white/40"
                      />
                    </label>
                    <label className="block text-xs font-bold text-white/70">
                      Số điện thoại (không bắt buộc)
                      <input
                        type="tel"
                        value={leaderPhone}
                        onChange={(event) => setLeaderPhone(event.target.value)}
                        placeholder="Để trống nếu bạn muốn"
                        className="mt-1 min-h-12 w-full rounded-xl border border-white/25 bg-white/10 px-4 font-normal text-white placeholder:text-white/40"
                      />
                    </label>
                    <label className="block text-xs font-bold text-white/70">
                      Đặt tên cho đoàn (không bắt buộc)
                      <input
                        value={groupLabel}
                        onChange={(event) => setGroupLabel(event.target.value)}
                        placeholder="Ví dụ: Đoàn Hà Nội, công ty ABC Travel"
                        className="mt-1 min-h-12 w-full rounded-xl border border-white/25 bg-white/10 px-4 font-normal text-white placeholder:text-white/40"
                      />
                    </label>
                    {groupMessage ? <p role="alert" className="text-sm text-[#f4b8a4]">{groupMessage}</p> : null}
                    <button
                      type="submit"
                      disabled={groupPending}
                      className="min-h-12 w-full rounded-full bg-white/15 px-6 font-extrabold text-white transition-colors hover:bg-white/25 disabled:opacity-50"
                    >
                      {groupPending ? "Đang tạo mã đoàn…" : "Tạo mã cho cả đoàn"}
                    </button>
                  </form>
                </>
              ) : (
                <>
                  <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-white/55">Mã đoàn của bạn</p>
                  <div className="mt-2 flex flex-wrap items-baseline gap-3">
                    <p className="font-display text-3xl text-[#e7c78d]">{group.groupCode}</p>
                    {group.groupLabel ? (
                      <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-white/75">{group.groupLabel}</span>
                    ) : null}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-white/70">
                    Trưởng đoàn gửi mã này cho cả đoàn. Mỗi người quét mã riêng để ghi tên mình vào chuyến đi — không quét vẫn vào cổng bình thường như mọi khách khác.
                  </p>
                  <ul className="mt-5 grid gap-3 sm:grid-cols-2">
                    {group.members.map((member) => {
                      const hasEntered = member.entries.length > 0;
                      return (
                        <li key={member.memberCode} className="flex gap-3 rounded-2xl bg-white/8 p-4">
                          <MemberQrCode memberCode={member.memberCode} />
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-bold text-white/90">{member.displayName || "Chưa ghi tên"}</p>
                            <p className="mt-1 text-xs text-white/55">
                              {member.guestGroup === "child" ? "Dưới 1m3" : "Từ 1m3 trở lên"}
                            </p>
                            <p className={`mt-2 text-xs font-bold ${hasEntered ? "text-[#9ee6b8]" : "text-white/45"}`}>
                              {hasEntered ? "Đã vào cổng" : "Chưa vào cổng"}
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
                    {groupRefreshing ? "Đang cập nhật…" : "Cập nhật trạng thái cả đoàn"}
                  </button>

                  <div className="mt-8 border-t border-white/10 pt-6">
                    <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-white/55">Điền hộ cho cả đoàn</p>
                    <p className="mt-2 text-sm leading-6 text-white/70">
                      Muốn ghi tên và nhu cầu chăm sóc cho cả đoàn cùng lúc, mời trưởng đoàn điền vào đây rồi lưu một lần.
                      Trưởng đoàn chỉ cần ghi tên gọi cho từng người thôi ạ — ai tự quét mã riêng khai tên mình, tên đó
                      thay cho tên trưởng đoàn ghi ở đây.
                    </p>
                    <form onSubmit={saveMemberDetails} className="mt-4">
                      <div className="max-h-[28rem] space-y-3 overflow-y-auto rounded-2xl border border-white/10 p-3">
                        {group.members.map((member) => {
                          const edit = memberEdits[member.memberIndex];
                          return (
                            <div key={member.memberCode} className="rounded-xl bg-white/8 p-3">
                              <p className="text-xs font-bold text-white/55">
                                Khách số {member.memberIndex} · {member.guestGroup === "child" ? "Dưới 1m3" : "Từ 1m3 trở lên"}
                              </p>
                              <label className="mt-2 block text-xs font-bold text-white/70">
                                Tên gọi
                                <input
                                  value={edit?.displayName ?? member.displayName}
                                  onChange={(event) => updateMemberEdit(member.memberIndex, member, { displayName: event.target.value })}
                                  placeholder="Chưa ghi tên"
                                  className="mt-1 min-h-11 w-full rounded-lg border border-white/25 bg-white/10 px-3 text-sm font-normal text-white placeholder:text-white/40"
                                />
                              </label>
                              <label className="mt-2 block text-xs font-bold text-white/70">
                                Nhu cầu chăm sóc
                                <select
                                  value={edit?.careNeed ?? member.careNeed}
                                  onChange={(event) => updateMemberEdit(member.memberIndex, member, { careNeed: event.target.value as CareNeedValue })}
                                  className="mt-1 min-h-11 w-full rounded-lg border border-white/25 bg-white/10 px-3 text-sm font-normal text-white"
                                >
                                  {CARE_NEED_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value} className="text-[#151a17]">
                                      {option.label}
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
                        {memberDetailsPending ? "Đang lưu…" : "Lưu tên cả đoàn"}
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
              {pending === "hold" ? "Đang khóa chỗ…" : "Giữ chỗ 15 phút"}
            </button>
          </>
        ) : (
          <>
          {/* TC-22: hai lối trả tiền, khách tự chọn. Mặc định vẫn là trả
              ngay trên trang; trả tại điểm là lối tạm trong lúc hệ thống
              chưa gánh được thanh toán thật. */}
          <fieldset className="mt-7 rounded-2xl border border-[#d7d5cd] bg-white/60 p-4">
            <legend className="px-2 text-xs font-extrabold uppercase tracking-[0.16em] text-[#356957]">Trả tiền thế nào</legend>
            <label className="flex min-h-11 items-start gap-3 text-sm">
              <input type="radio" name="cach-tra-tien" checked={!payAtSite} onChange={() => setPayAtSite(false)} className="mt-1" />
              <span><strong className="font-bold">Trả ngay trên trang</strong> — thanh toán mô phỏng, không thu tiền thật.</span>
            </label>
            <label className="mt-3 flex min-h-11 items-start gap-3 text-sm">
              <input type="radio" name="cach-tra-tien" checked={payAtSite} onChange={() => setPayAtSite(true)} className="mt-1" />
              <span><strong className="font-bold">Trả tại điểm</strong> — giữ chỗ trước, tới nơi đưa mã cho nhân viên rồi trả tiền.</span>
            </label>
            {payAtSite ? (
              <label className="mt-4 grid gap-1 text-xs font-bold text-[#5f6f66]">
                Số điện thoại hoặc email
                <input
                  value={contact}
                  onChange={(event) => setContact(event.target.value)}
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="0912 345 678"
                  className="min-h-11 rounded-xl border border-[#cbd7d1] bg-white px-3 text-sm font-medium"
                />
                <span className="mt-1 font-normal leading-5 text-[#6f7a73]">
                  Chỉ dùng để đội ngũ liên lạc khi có việc, và để một chỗ giữ mà không tới còn truy được về ai. Số của bạn được mã hoá trước khi lưu.
                </span>
              </label>
            ) : null}
          </fieldset>
          <button
            type="button"
            onClick={confirmBooking}
            disabled={pending !== null || remainingSeconds <= 0}
            className="mt-4 min-h-12 w-full rounded-full bg-[#d58c35] px-6 font-extrabold text-[#151a17] disabled:opacity-50"
          >
            {pending === "confirm" ? "Đang phát hành vé…" : remainingSeconds <= 0 ? "Giữ chỗ đã hết hạn" : payAtSite ? "Giữ chỗ, trả tiền tại điểm" : "Xác nhận thanh toán mô phỏng"}
          </button>
          </>
        )}
        <p className="mt-5 text-xs leading-5 text-white/45">Gửi lại cùng một yêu cầu không tạo thêm đơn, khoản thanh toán hay vé thứ hai.</p>
      </aside>
    </div>
  );
}
