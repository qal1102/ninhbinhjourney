"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import { CONTACT } from "@/content/contact";
import { DESTINATIONS } from "@/content/destinations";
import { PACKAGES } from "@/content/packages";
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
const LOOKUP_ERROR_MESSAGE: Record<string, string> = {
  CUSTOMER_LOOKUP_CODE_MALFORMED:
    "Mã đặt chỗ có dạng NBJ- rồi mười hai ký tự, bạn xem lại giúp em ạ.",
  CUSTOMER_LOOKUP_INPUT_INVALID:
    "Em chưa đọc được mã đặt chỗ hoặc liên hệ bạn vừa nhập ạ. Mời bạn nhập lại mã bắt đầu bằng NBJ, cùng số điện thoại hoặc email đã dùng lúc đặt.",
};

const LOOKUP_FALLBACK_MESSAGE =
  `Lúc này em chưa mở được vé giúp bạn ạ. Mời bạn thử lại sau ít phút, hoặc gọi bên em theo số ${CONTACT.phoneLabel} để đội ngũ mở vé ngay cho bạn.`;

const LOOKUP_NETWORK_MESSAGE =
  `Đường truyền đang trục trặc ạ. Bạn thử lại giúp em sau ít phút, hoặc gọi số ${CONTACT.phoneLabel} để bên em mở vé giúp bạn.`;

/**
 * Mã QR của vé chứa ĐÚNG mã vé trần, không kèm địa chỉ web nào.
 *
 * Máy trực cổng đọc nội dung QR rồi đối chiếu thẳng với mã vé; nhét thêm một
 * đường dẫn vào đây là tấm vé không quét được. Cách vẽ lấy nguyên của màn hình
 * đặt chỗ, dùng lại gói `qrcode` đã có trong dự án.
 */
function TicketQrCode({ ticketCode }: { ticketCode: string }) {
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
      alt={`Mã QR để quét ở cổng, mã vé ${ticketCode}`}
      className="size-28 shrink-0 rounded-xl bg-white p-1"
    />
  );
}

const GUEST_GROUP_LABEL: Record<CustomerTicketLookupTicket["guestGroup"], string> = {
  adult: "Từ 1m3 trở lên",
  child: "Dưới 1m3",
  group: "Cả đoàn",
};

function siteName(siteId: string) {
  return DESTINATIONS.find((item) => item.id === siteId)?.name.vi ?? "Điểm tham quan";
}

function productName(productId: string) {
  return PACKAGES.find((item) => item.id === productId)?.name ?? "Gói dịch vụ";
}

export function TicketLookup() {
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
        setMessage(payload.message || LOOKUP_FALLBACK_MESSAGE);
        return;
      }
      const code = payload && payload.accepted === false ? payload.error?.code : undefined;
      setMessage((code && LOOKUP_ERROR_MESSAGE[code]) || LOOKUP_FALLBACK_MESSAGE);
    } catch {
      setMessage(LOOKUP_NETWORK_MESSAGE);
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
      <nav aria-label="Điều hướng trang" className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm font-bold">
        <Link href="/" className="text-[#183f34]">
          ← Về trang chủ
        </Link>
        <Link href="/packages" className="text-[#356957]">
          Xem các gói hành trình
        </Link>
      </nav>
      <p className="mt-8 text-xs font-extrabold uppercase tracking-[0.22em] text-[#9a6328]">
        Ninh Bình Journey · Vé của bạn
      </p>
      <h1 className="font-display mt-3 text-4xl leading-tight text-[#183f34] sm:text-5xl">
        Mở lại vé đã đặt
      </h1>
      <p className="mt-4 max-w-xl leading-7 text-[#59654b]">
        Bạn nhập mã đặt chỗ cùng số điện thoại hoặc email đã dùng lúc đặt, vé và mã QR hiện lại
        ngay trên trang này ạ. Mời bạn cứ mở trang này ở cổng, nhân viên quét thẳng trên màn
        hình của bạn.
      </p>

      <div className="mt-6 rounded-2xl border border-[#ddb77d] bg-[#fff8eb] p-5 text-[#6c4b1f]">
        <p className="font-extrabold">Hệ thống chưa gửi tin nhắn hay email xác nhận</p>
        <p className="mt-2 text-sm leading-6">
          Bên em đang đấu nối Zalo; xong việc đó thì mã đặt chỗ tự về máy bạn. Từ giờ tới lúc
          ấy, đặt xong bạn không nhận được tin nhắn nào cả. Trang này là đường lấy lại vé, và
          nó cần đúng hai thứ chỉ bạn có: mã đặt chỗ và liên hệ đã để lại. Chỉ một mình mã đặt
          chỗ thì em xin phép chưa mở vé được ạ.
        </p>
      </div>

      <form onSubmit={submit} className="mt-8 grid gap-4 rounded-[2rem] bg-[#183f34] p-6 text-white sm:p-8">
        <label className="grid gap-1 text-xs font-bold text-white/70">
          Mã đặt chỗ
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
            Mã hiện ngay sau khi bạn đặt xong, mở đầu bằng NBJ. Gõ thường hay hoa đều được ạ.
          </span>
        </label>
        <label className="grid gap-1 text-xs font-bold text-white/70">
          Số điện thoại hoặc email đã dùng lúc đặt
          <input
            required
            value={contact}
            onChange={(event) => setContact(event.target.value)}
            // Ô này nhận CẢ số điện thoại lẫn email, nên không được ghim
            // `inputMode="tel"`: điện thoại sẽ bật bàn phím số và khách dùng
            // email không gõ nổi dấu @.
            autoComplete="off"
            spellCheck={false}
            placeholder="0912 345 678 hoặc ban@vidu.com"
            className="min-h-12 rounded-xl border border-white/25 bg-white/10 px-4 text-base font-medium text-white placeholder:text-white/35"
          />
          <span className="mt-1 font-normal leading-5 text-white/55">
            Trang này không hiện lại số hay email của ai; nó chỉ đem chuỗi đã mã hoá ra đối chiếu.
          </span>
        </label>
        <button
          type="submit"
          disabled={pending}
          className="min-h-12 rounded-full bg-[#e7c78d] px-6 font-extrabold text-[#183f34] transition-colors hover:bg-[#f0d6a5] disabled:opacity-50"
        >
          {pending ? "Đang tìm chuyến của bạn…" : "Mở vé của tôi"}
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
            Chuyến của bạn
          </p>
          <h2 className="font-display mt-2 text-3xl text-[#183f34]">
            {productName(result.order.product_id)}
          </h2>
          <dl className="mt-5 grid gap-3 border-y border-[#e4e7e1] py-5 text-sm sm:grid-cols-2">
            <div className="flex justify-between gap-4 sm:block">
              <dt className="text-[#6b786f]">Mã đặt chỗ</dt>
              <dd className="font-mono font-bold tracking-[0.08em] text-[#183f34] sm:mt-1">{result.order.code}</dd>
            </div>
            <div className="flex justify-between gap-4 sm:block">
              <dt className="text-[#6b786f]">Ngày đi</dt>
              <dd className="font-bold text-[#183f34] sm:mt-1">
                {new Date(`${result.order.visit_date}T00:00:00`).toLocaleDateString("vi-VN", { dateStyle: "long" })}
              </dd>
            </div>
            <div className="flex justify-between gap-4 sm:block">
              <dt className="text-[#6b786f]">Số khách</dt>
              <dd className="font-bold text-[#183f34] sm:mt-1">
                {result.order.party_size} khách
                {result.order.children ? ` · ${result.order.children} trẻ dưới 1m3` : ""}
              </dd>
            </div>
            <div className="flex justify-between gap-4 sm:block">
              <dt className="text-[#6b786f]">Tổng tiền</dt>
              <dd className="font-bold text-[#183f34] sm:mt-1">
                {result.order.total_vnd.toLocaleString("vi-VN")} VND
              </dd>
            </div>
          </dl>

          {result.payment.status === "pending" ? (
            <div className="mt-6 rounded-2xl border border-[#ddb77d] bg-[#fff8eb] p-5 text-[#6c4b1f]">
              <p className="font-extrabold">Còn trả tại điểm: {result.payment.amount_due_vnd.toLocaleString("vi-VN")} VND</p>
              <p className="mt-2 text-sm leading-6">
                Tới nơi, bạn đưa mã bên dưới cho nhân viên quét rồi trả tiền tại quầy. Nhân viên
                thu đủ thì cổng mở ngay ạ.
              </p>
            </div>
          ) : (
            <div className="mt-6 rounded-2xl border border-[#cfe0d4] bg-[#edf3ee] p-5 text-[#274c40]">
              <p className="font-extrabold">Chuyến này không còn khoản nào phải trả</p>
              <p className="mt-2 text-sm leading-6">
                Bạn chỉ cần đưa mã bên dưới cho nhân viên ở cổng là vào được ngay ạ.
              </p>
            </div>
          )}

          <p className="mt-8 text-xs font-extrabold uppercase tracking-[0.18em] text-[#557568]">Vé của bạn</p>
          <ul className="mt-3 space-y-4">
            {[...ticketsBySite.entries()].map(([siteId, ticketsForSite]) => (
              <li key={siteId} className="rounded-2xl border border-[#dde1db] p-4">
                <p className="font-bold text-[#183f34]">{siteName(siteId)}</p>
                <ul className="mt-3 space-y-3 border-t border-[#e4e7e1] pt-3">
                  {ticketsForSite.map((ticket) => (
                    <li key={ticket.ticketId} className="flex items-center gap-3">
                      <TicketQrCode ticketCode={ticket.ticketCode} />
                      <div className="min-w-0">
                        <code className="text-lg font-extrabold tracking-[0.08em] text-[#9a6328]">
                          {ticket.ticketCode}
                        </code>
                        <p className="mt-1 text-sm text-[#59654b]">
                          {GUEST_GROUP_LABEL[ticket.guestGroup]} · {ticket.entriesAllowed} lượt vào
                          {ticket.entriesUsed > 0 ? ` · đã vào ${ticket.entriesUsed}` : ""}
                        </p>
                        <p className="mt-1 text-sm text-[#6b786f]">
                          Hiệu lực {new Date(`${ticket.validOn}T00:00:00`).toLocaleDateString("vi-VN")}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>

          <p className="mt-6 text-sm leading-6 text-[#6b786f]">
            Mời bạn chụp lại màn hình này giúp em, để lúc ở cổng sóng yếu vẫn có mã trong máy ạ.
          </p>
        </section>
      ) : null}
    </div>
  );
}
