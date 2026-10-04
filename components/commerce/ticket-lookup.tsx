"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import { CONTACT } from "@/content/contact";
import { DESTINATIONS } from "@/content/destinations";
import { PACKAGES } from "@/content/packages";
import { goiHienThi } from "@/content/packages-en";
import { LuuAnhVe } from "@/components/commerce/luu-anh-ve";
import type { CustomerTicketLookupTicket } from "@/domain/customer-booking";

type LookupResponse =
  | {
      accepted: true;
      found: true;
      order: {
        code: string;
        product_id: string;
        visit_date: string;
        party_size: number;
        adults: number | null;
        children: number | null;
        total_vnd: number;
        currency: string;
      };
      payment: {
        mode: "simulation" | "pay-on-site" | null;
        status: "succeeded" | "pending" | null;
        amount_due_vnd: number;
      };
      tickets: CustomerTicketLookupTicket[];
    }
  | { accepted: true; found: false; throttled: boolean; message: string }
  | { accepted: false; error?: { code?: string; message?: string } };

/*
 * Câu khách đọc do TRANG NÀY viết, không lấy nguyên văn của máy chủ.
 *
 * Đo ngày 10/09/2026 trên máy cục bộ, gõ một mã đúng khuôn rồi bấm "Mở vé của
 * tôi", khách nhận đúng hai câu này:
 *   "Kho liên hệ chưa có khóa mã hóa và khóa băm hợp lệ."
 *   "Chỉ nhận yêu cầu tra cứu first-party từ cùng origin."
 * Cả hai là chữ viết cho người trực máy chủ đọc. Khách mất vé đang đứng ở
 * cổng thì đọc xong chẳng biết làm gì tiếp, mà trang cũng không chỉ cho họ
 * một đường nào.
 *
 * Chặn từng câu một là chạy theo đuôi: mỗi lần kho dữ liệu thêm một thông báo
 * mới là một câu nữa lọt ra. Nên đổi hẳn luật: máy chủ chọn MÃ LỖI, trang chọn
 * CÂU CHỮ. Thêm mã mới ở máy chủ mà quên khai vào đây thì khách rơi về câu
 * chung bên dưới — vẫn tử tế, vẫn có số điện thoại để gọi.
 */
const LOOKUP_ERROR_MESSAGE: Record<string, { vi: string; en: string }> = {
  CUSTOMER_LOOKUP_CODE_MALFORMED: {
    vi: "Mã đặt chỗ có dạng NBJ- và mười hai ký tự. Mời bạn xem lại.",
    en: "A booking code looks like NBJ- followed by twelve characters. Please check it.",
  },
  CUSTOMER_LOOKUP_INPUT_INVALID: {
    vi: "Chưa đọc được mã đặt chỗ hoặc liên hệ bạn vừa nhập. Mời bạn nhập lại mã bắt đầu bằng NBJ, cùng số điện thoại hoặc email đã dùng lúc đặt.",
    en: "We could not read that code or contact. Please enter the code starting with NBJ, with the phone or email you used when booking.",
  },
};

const LOOKUP_FALLBACK_MESSAGE = {
  vi: `Lúc này chưa mở được vé. Mời bạn thử lại sau ít phút, hoặc gọi ${CONTACT.phoneLabel} để chúng tôi mở vé giúp.`,
  en: `We cannot open your ticket right now. Please try again in a few minutes, or call us on ${CONTACT.phoneLabel} and we will open it for you.`,
};

const LOOKUP_NETWORK_MESSAGE = {
  vi: `Đường truyền đang trục trặc. Mời bạn thử lại sau ít phút, hoặc gọi ${CONTACT.phoneLabel} để chúng tôi mở vé giúp.`,
  en: `The connection is having trouble. Please try again in a few minutes, or call ${CONTACT.phoneLabel} and we will open your ticket.`,
};

/**
 * Mã QR của vé chứa ĐÚNG mã vé trần, không kèm địa chỉ web nào.
 *
 * Máy trực cổng đọc nội dung QR rồi đối chiếu thẳng với mã vé; nhét thêm một
 * đường dẫn vào đây là tấm vé không quét được. Cách vẽ lấy nguyên của màn hình
 * đặt chỗ, dùng lại gói `qrcode` đã có trong dự án.
 */
function TicketQrCode({ ticketCode, lang }: { ticketCode: string; lang: "vi" | "en" }) {
  const [qrDataUrl, setQrDataUrl] = useState("");

  useEffect(() => {
    let alive = true;
    void QRCode.toDataURL(ticketCode, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 320,
      color: { dark: "#183f34", light: "#ffffff" },
    })
      .then((url) => {
        if (alive) setQrDataUrl(url);
      })
      .catch(() => {
        if (alive) setQrDataUrl("");
      });
    return () => {
      alive = false;
    };
  }, [ticketCode]);

  if (!qrDataUrl) {
    return <div className="size-28 shrink-0 rounded-xl bg-white/10" aria-hidden />;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={qrDataUrl}
      alt={lang === "en" ? `QR code for the gate, ticket ${ticketCode}` : `Mã QR để quét ở cổng, mã vé ${ticketCode}`}
      className="size-28 shrink-0 rounded-xl bg-white p-1"
    />
  );
}

const GUEST_GROUP_LABEL: Record<CustomerTicketLookupTicket["guestGroup"], { vi: string; en: string }> = {
  adult: { vi: "Từ 1m3 trở lên", en: "1.3 m and taller" },
  child: { vi: "Dưới 1m3", en: "Under 1.3 m" },
  group: { vi: "Cả đoàn", en: "Whole group" },
};

function siteName(siteId: string, lang: "vi" | "en") {
  return DESTINATIONS.find((item) => item.id === siteId)?.name[lang] ?? (lang === "en" ? "Site" : "Điểm tham quan");
}

function productName(productId: string, lang: "vi" | "en") {
  const goi = PACKAGES.find((item) => item.id === productId);
  return goi ? goiHienThi(goi, lang).name : lang === "en" ? "Package" : "Gói dịch vụ";
}

export function TicketLookup({ lang = "vi", children }: { lang?: "vi" | "en"; children?: React.ReactNode }) {
  const t = (vi: string, en: string) => (lang === "en" ? en : vi);
  const [orderCode, setOrderCode] = useState("");
  const [contact, setContact] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<Extract<LookupResponse, { found: true }> | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setMessage("");
    setResult(null);
    try {
      const response = await fetch("/api/customer-ticket-lookup", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_code: orderCode.trim(), contact: contact.trim() }),
      });
      const payload = (await response.json().catch(() => null)) as LookupResponse | null;
      if (payload && payload.accepted && payload.found) {
        setResult(payload);
        return;
      }
      // Nhánh "chưa tìm ra chuyến nào" và nhánh "bạn thử hơi nhiều lần" là hai
      // câu duy nhất lấy nguyên của máy chủ. Chúng phải nằm ở đó chứ không nằm
      // đây: sai mã và sai liên hệ bắt buộc đọc GIỐNG HỆT nhau, và chỉ máy chủ
      // mới biết đủ để giữ cho hai đường ấy không lệch một chữ nào.
      if (payload && payload.accepted === true && payload.found === false) {
        setMessage(lang === "en" ? "No booking matches that code and contact. Please check both and try again." : payload.message || LOOKUP_FALLBACK_MESSAGE.vi);
        return;
      }
      const code = payload && payload.accepted === false ? payload.error?.code : undefined;
      setMessage((code && LOOKUP_ERROR_MESSAGE[code]?.[lang]) || LOOKUP_FALLBACK_MESSAGE[lang]);
    } catch {
      setMessage(LOOKUP_NETWORK_MESSAGE[lang]);
    } finally {
      setPending(false);
    }
  }

  const ticketsBySite = new Map<string, CustomerTicketLookupTicket[]>();
  for (const ticket of result?.tickets ?? []) {
    const bucket = ticketsBySite.get(ticket.siteId);
    if (bucket) bucket.push(ticket);
    else ticketsBySite.set(ticket.siteId, [ticket]);
  }

  return (
    <div className="mx-auto max-w-3xl">
      {/* Trang này trước đây không có lấy một liên kết nào — không logo, không
          nav, không đường về. Khách vào đây mà không nhớ ra mã đặt chỗ thì hết
          đường, chỉ còn nút back của trình duyệt. Nhánh "chưa mở đặt chỗ" ngay
          bên cạnh (app/tra-cuu-ve/page.tsx) vẫn luôn có lối ra; nhánh chính
          thì không. Hai đường ra ở đây là hai việc khách thật sự làm tiếp: về
          trang chủ, hoặc đi xem gói để đặt chuyến mới. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label={t("Điều hướng trang", "Page navigation")} className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm font-bold">
          <Link href="/" className="text-[#183f34]">
            ← {t("Về trang chủ", "Home")}
          </Link>
          <Link href="/packages" className="text-[#356957]">
            {t("Xem các gói hành trình", "See the packages")}
          </Link>
        </nav>
        {children}
      </div>
      <p className="mt-8 text-xs font-extrabold uppercase tracking-[0.22em] text-[#9a6328]">
        {t("Ninh Bình Journey · Vé của bạn", "Ninh Binh Journey · Your tickets")}
      </p>
      <h1 className="font-display mt-3 text-4xl leading-tight text-[#183f34] sm:text-5xl">
        {t("Mở lại vé đã đặt", "Open a ticket you booked")}
      </h1>
      <p className="mt-4 max-w-xl leading-7 text-[#59654b]">
        {t("Nhập mã đặt chỗ cùng số điện thoại hoặc email đã dùng lúc đặt, vé và mã QR hiện lại ngay. Tới cổng, nhân viên quét thẳng trên màn hình của bạn.", "Enter your booking code with the phone or email you used, and your tickets and QR codes appear right here. You can open this page at the gate and staff scan it straight from your screen.")}
      </p>

      <div className="mt-6 rounded-2xl border border-[#ddb77d] bg-[#fff8eb] p-5 text-[#6c4b1f]">
        <p className="font-extrabold">{t("Bản này chưa gửi tin nhắn hay email xác nhận", "This version sends no text or email confirmation")}</p>
        <p className="mt-2 text-sm leading-6">
          {t("Đặt xong bạn sẽ không nhận được tin nhắn nào, nên đây là chỗ lấy lại vé. Cần cả mã đặt chỗ lẫn số điện thoại hoặc email đã để lại.", "You will not receive any message after booking. This page is how you get your ticket back, and it needs the two things only you have: the booking code and the contact you left. The code alone is not enough to open a ticket.")}
        </p>
      </div>

      <form onSubmit={submit} className="mt-8 grid gap-4 rounded-[2rem] bg-[#183f34] p-6 text-white sm:p-8">
        <label className="grid gap-1 text-xs font-bold text-white/70">
          {t("Mã đặt chỗ", "Booking code")}
          <input
            required
            value={orderCode}
            onChange={(event) => setOrderCode(event.target.value)}
            autoComplete="off"
            spellCheck={false}
            placeholder="NBJ-A1B2C3D4E5F6"
            className="min-h-12 rounded-xl border border-white/25 bg-white/10 px-4 font-mono text-base font-medium tracking-[0.08em] text-white placeholder:font-sans placeholder:tracking-normal placeholder:text-white/35"
          />
          <span className="mt-1 font-normal leading-5 text-white/55">
            {t("Mã hiện ngay sau khi đặt xong, bắt đầu bằng NBJ. Gõ chữ thường hay hoa đều được.", "Shown right after booking, starting with NBJ. Upper or lower case both work.")}
          </span>
        </label>
        <label className="grid gap-1 text-xs font-bold text-white/70">
          {t("Số điện thoại hoặc email đã dùng lúc đặt", "Phone or email used when booking")}
          <input
            required
            value={contact}
            onChange={(event) => setContact(event.target.value)}
            // Ô này nhận CẢ số điện thoại lẫn email, nên không được ghim
            // `inputMode="tel"`: điện thoại sẽ bật bàn phím số và khách dùng
            // email không gõ nổi dấu @.
            autoComplete="off"
            spellCheck={false}
            placeholder={t("0912 345 678 hoặc ban@vidu.com", "0912 345 678 or you@example.com")}
            className="min-h-12 rounded-xl border border-white/25 bg-white/10 px-4 text-base font-medium text-white placeholder:text-white/35"
          />
          <span className="mt-1 font-normal leading-5 text-white/55">
            {t("Số hay email này chỉ dùng để đối chiếu, không hiện ra ở đâu.", "Used only to match your booking; never shown anywhere.")}
          </span>
        </label>
        <button
          type="submit"
          disabled={pending}
          className="min-h-12 rounded-full bg-[#e7c78d] px-6 font-extrabold text-[#183f34] transition-colors hover:bg-[#f0d6a5] disabled:opacity-50"
        >
          {pending ? t("Đang tìm chuyến của bạn…", "Finding your booking…") : t("Mở vé của tôi", "Open my tickets")}
        </button>
        {message ? (
          <p role="status" className="rounded-xl bg-white/10 p-4 text-sm leading-6 text-white/85">
            {message}
          </p>
        ) : null}
      </form>

      {result ? (
        <section data-testid="ticket-lookup-result" className="mt-8 rounded-[2rem] border border-[#dde1db] bg-white p-6 sm:p-8">
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#557568]">
            {t("Chuyến của bạn", "Your booking")}
          </p>
          <h2 className="font-display mt-2 text-3xl text-[#183f34]">
            {productName(result.order.product_id, lang)}
          </h2>
          <dl className="mt-5 grid gap-3 border-y border-[#e4e7e1] py-5 text-sm sm:grid-cols-2">
            <div className="flex justify-between gap-4 sm:block">
              <dt className="text-[#6b786f]">{t("Mã đặt chỗ", "Booking code")}</dt>
              <dd className="font-mono font-bold tracking-[0.08em] text-[#183f34] sm:mt-1">{result.order.code}</dd>
            </div>
            <div className="flex justify-between gap-4 sm:block">
              <dt className="text-[#6b786f]">{t("Ngày đi", "Date")}</dt>
              <dd className="font-bold text-[#183f34] sm:mt-1">
                {new Date(`${result.order.visit_date}T00:00:00`).toLocaleDateString(lang === "en" ? "en-GB" : "vi-VN", { dateStyle: "long" })}
              </dd>
            </div>
            <div className="flex justify-between gap-4 sm:block">
              <dt className="text-[#6b786f]">{t("Số khách", "Guests")}</dt>
              <dd className="font-bold text-[#183f34] sm:mt-1">
                {result.order.party_size} {t("khách", "guests")}
                {result.order.children ? t(` · ${result.order.children} trẻ dưới 1m3`, ` · ${result.order.children} under 1.3 m`) : ""}
              </dd>
            </div>
            <div className="flex justify-between gap-4 sm:block">
              <dt className="text-[#6b786f]">{t("Tổng tiền", "Total")}</dt>
              <dd className="font-bold text-[#183f34] sm:mt-1">
                {result.order.total_vnd.toLocaleString("vi-VN")} VND
              </dd>
            </div>
          </dl>

          {result.payment.status === "pending" ? (
            <div className="mt-6 rounded-2xl border border-[#ddb77d] bg-[#fff8eb] p-5 text-[#6c4b1f]">
              <p className="font-extrabold">{t("Còn trả tại điểm:", "To pay on site:")} {result.payment.amount_due_vnd.toLocaleString("vi-VN")} VND</p>
              <p className="mt-2 text-sm leading-6">
                {t("Tới nơi, đưa mã bên dưới cho nhân viên quét rồi trả tiền tại quầy. Thu đủ là cổng mở.", "At the site, show the code below, pay at the counter, and the gate opens.")}
              </p>
            </div>
          ) : (
            <div className="mt-6 rounded-2xl border border-[#cfe0d4] bg-[#edf3ee] p-5 text-[#274c40]">
              <p className="font-extrabold">{t("Chuyến này không còn khoản nào phải trả", "Nothing left to pay")}</p>
              <p className="mt-2 text-sm leading-6">
                {t("Đưa mã bên dưới cho nhân viên ở cổng là vào được ngay.", "Just show the code below at the gate and walk in.")}
              </p>
            </div>
          )}

          <p className="mt-8 text-xs font-extrabold uppercase tracking-[0.18em] text-[#557568]">{t("Vé của bạn", "Your tickets")}</p>
          <ul className="mt-3 space-y-4">
            {[...ticketsBySite.entries()].map(([siteId, ticketsForSite]) => (
              <li key={siteId} className="rounded-2xl border border-[#dde1db] p-4">
                <p className="font-bold text-[#183f34]">{siteName(siteId, lang)}</p>
                <ul className="mt-3 space-y-3 border-t border-[#e4e7e1] pt-3">
                  {ticketsForSite.map((ticket) => (
                    <li key={ticket.ticketId} className="flex items-center gap-3">
                      <TicketQrCode ticketCode={ticket.ticketCode} lang={lang} />
                      <div className="min-w-0">
                        <code className="text-lg font-extrabold tracking-[0.08em] text-[#9a6328]">
                          {ticket.ticketCode}
                        </code>
                        <p className="mt-1 text-sm text-[#59654b]">
                          {GUEST_GROUP_LABEL[ticket.guestGroup][lang]} · {ticket.entriesAllowed} {t("lượt vào", "entries")}
                          {ticket.entriesUsed > 0 ? t(` · đã vào ${ticket.entriesUsed}`, ` · ${ticket.entriesUsed} used`) : ""}
                        </p>
                        <p className="mt-1 text-sm text-[#6b786f]">
                          {t("Hiệu lực", "Valid on")} {new Date(`${ticket.validOn}T00:00:00`).toLocaleDateString(lang === "en" ? "en-GB" : "vi-VN")}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>

          <LuuAnhVe
            orderCode={result.order.code}
            productName={productName(result.order.product_id, lang)}
            tickets={result.tickets}
            tone="light"
            lang={lang}
          />
          <p className="mt-4 text-sm leading-6 text-[#6b786f]">
            {t("Mời bạn lưu ảnh vé về máy, để lúc ở cổng sóng yếu vẫn mở được mã.", "Save the ticket image so you can open the code even with a weak signal at the gate.")}
          </p>
          <Link href="/ho-so" className="mt-3 inline-block text-sm font-bold text-[#356957] underline underline-offset-4">
            {t("Xem hộ chiếu Ninh Bình: đi đủ các vùng để mở quà", "See your Ninh Binh passport: visit every area to unlock gifts")}
          </Link>
        </section>
      ) : null}
    </div>
  );
}
