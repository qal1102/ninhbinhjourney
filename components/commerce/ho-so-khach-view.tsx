import Image from "next/image";
import Link from "next/link";
import type { HoSoKhach } from "@/domain/ho-so-khach";
import { tripPassportPlaces } from "@/domain/trip-passport";
import { PACKAGES } from "@/content/packages";
import { goiHienThi } from "@/content/packages-en";

/*
 * Chữ tiếng Anh cho nhiệm vụ, quà và cách trả. Máy chủ dựng hồ sơ bằng tiếng
 * Việt (`domain/ho-so-khach.ts`); khách chọn EN thì tra theo mã tại đây, không
 * có mã thì giữ nguyên chữ gốc.
 */
const NHIEM_VU_EN: Record<string, { ten: string; moTa: string; qua: string }> = {
  "buoc-dau": { ten: "First step", moTa: "Pass the gate at any site.", qua: "A cup of lotus tea at the welcome desk" },
  "hai-dong-nuoc": { ten: "Two rivers", moTa: "Take a boat at both Trang An and Tam Coc.", qua: "5% off your next booking" },
  "hai-tieng-chuong": { ten: "Two temple bells", moTa: "Visit both Bai Dinh and Tam Chuc pagodas.", qua: "5% off your next booking" },
  "tron-bon-cua": { ten: "All four gates", moTa: "Visit Trang An, Bai Dinh, Tam Coc and Tam Chuc.", qua: "15% off your next trip and a set of Ninh Binh postcards" },
  "quay-lai": { ten: "Back to Ninh Binh", moTa: "Pass a gate on two different days.", qua: "10% off your next booking" },
};
const CACH_TRA_EN: Record<string, string> = {
  "Đã thanh toán bằng QR": "Paid by QR code",
  "Đã thu tiền mặt tại điểm": "Paid in cash on site",
  "Đã huỷ vì khách không đến": "Cancelled, guest did not come",
  "Chờ thu tại điểm": "To pay on site",
};
/**
 * Dấu mộc (KY_NANG_GIAO_DIEN D1): con dấu tròn màu son như dấu nhập cảnh trên
 * hộ chiếu, ghi đúng ngày khách qua cổng lần đầu. Mở hộ chiếu thì các dấu lần
 * lượt dập xuống (`.dau-moc` trong globals.css); giảm chuyển động thì dấu nằm
 * yên sẵn. Chữ "Đã đến" vẫn đọc được bằng trình đọc màn hình.
 */
function DauMoc({ id, ngay, thuTu, nhan }: { id: string; ngay: string; thuTu: number; nhan: string }) {
  // Ghép tay "29.09": định dạng theo vùng trả "29-09" hay "29/09" tuỳ trình duyệt.
  const phan = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Ho_Chi_Minh" })
    .formatToParts(new Date(ngay));
  const lay = (loai: string) => phan.find((p) => p.type === loai)?.value ?? "";
  const ngayThang = `${lay("day")}.${lay("month")}`;
  const nam = lay("year");
  const vong = `dau-moc-${id}`;
  return (
    <span className="dau-moc" style={{ animationDelay: `${0.25 + thuTu * 0.22}s` }}>
      <span className="sr-only">{nhan}</span>
      <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">
        <defs>
          <path id={vong} d="M50 50 m-33 0 a33 33 0 1 1 66 0 a33 33 0 1 1 -66 0" />
        </defs>
        <circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" strokeWidth="3.2" />
        <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="1.1" />
        <text fontSize="8.6" fontWeight="800" letterSpacing="1.6" fill="currentColor">
          <textPath href={`#${vong}`} textLength="205" lengthAdjust="spacing">NINH BÌNH JOURNEY · {nhan.toUpperCase()} ·</textPath>
        </text>
        <text x="50" y="53" textAnchor="middle" fontSize="15" fontWeight="800" fill="currentColor">{ngayThang}</text>
        <text x="50" y="66" textAnchor="middle" fontSize="9" fontWeight="700" letterSpacing="1.5" fill="currentColor">{nam}</text>
      </svg>
    </span>
  );
}

function tenGoi(ten: string, lang: "vi" | "en") {
  if (lang === "vi") return ten;
  const goi = PACKAGES.find((item) => item.name === ten);
  return goi ? goiHienThi(goi, "en").name : ten;
}

/**
 * Hộ chiếu Ninh Bình của một khách: nơi đã vào, nhiệm vụ, quà và các chuyến
 * đã đặt. Dùng chung cho trang khách (/ho-so) và màn hình "Khách thấy gì"
 * của giám đốc, nên chỉ nhận dữ liệu qua props, không tự đọc gì.
 */
export function HoSoKhachView({
  hoSo,
  xemThu = false,
  lang = "vi",
}: {
  hoSo: HoSoKhach;
  xemThu?: boolean;
  lang?: "vi" | "en";
}) {
  const t = (vi: string, en: string) => (lang === "en" ? en : vi);
  const vung = lang === "en" ? "en-GB" : "vi-VN";
  const noi = tripPassportPlaces();
  const daDen = new Map(hoSo.noiDaDen.map((item) => [item.siteId, item]));
  return (
    <div data-testid="ho-so-khach" className="text-[#151a17]">
      <section className="rounded-3xl bg-[#183f34] p-6 text-white sm:p-8">
        <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#e7c78d]">{t("Hộ chiếu Ninh Bình", "Ninh Binh passport")}</p>
        <h2 className="font-display mt-3 text-3xl leading-tight sm:text-4xl">
          {hoSo.noiDaDen.length === 0
            ? t("Chuyến đi của bạn bắt đầu từ cổng đầu tiên", "Your journey starts at the first gate")
            : t(`Bạn đã qua ${hoSo.noiDaDen.length} trên ${noi.length} cổng`, `You have passed ${hoSo.noiDaDen.length} of ${noi.length} gates`)}
        </h2>
        <p className="mt-3 leading-7 text-white/75">
          {t("Mỗi lần nhân viên quét vé ở cổng, nơi ấy sáng lên ở đây. Đi đủ các vùng thì mở thêm quà cho chuyến sau.", "Each time your ticket is scanned at a gate, that place lights up here. Visit every area to unlock gifts for your next trip.")}
        </p>
        <dl className="mt-6 grid grid-cols-3 gap-3 text-center">
          <div className="rounded-2xl bg-white/10 px-2 py-3">
            <dt className="text-xs text-white/60">{t("Chuyến đã đặt", "Trips booked")}</dt>
            <dd className="font-display mt-1 text-2xl text-[#e7c78d]">{hoSo.don.length}</dd>
          </div>
          <div className="rounded-2xl bg-white/10 px-2 py-3">
            <dt className="text-xs text-white/60">{t("Ngày đã đi", "Days travelled")}</dt>
            <dd className="font-display mt-1 text-2xl text-[#e7c78d]">{hoSo.soNgayDi}</dd>
          </div>
          <div className="rounded-2xl bg-white/10 px-2 py-3">
            <dt className="text-xs text-white/60">{t("Nhiệm vụ xong", "Quests done")}</dt>
            <dd className="font-display mt-1 text-2xl text-[#e7c78d]">{hoSo.soNhiemVuXong}/{hoSo.nhiemVu.length}</dd>
          </div>
        </dl>
      </section>

      <section className="mt-6">
        <h3 className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#557568]">{t("Những nơi đã sáng", "Places lit up")}</h3>
        <ul className={`mt-3 grid grid-cols-2 gap-3 ${xemThu ? "" : "sm:grid-cols-4"}`}>
          {noi.map((diem, viTri) => {
            const den = daDen.get(diem.id);
            return (
              <li
                key={diem.id}
                data-da-den={den ? "co" : "chua"}
                className={`overflow-hidden rounded-2xl border ${den ? "border-[#d58c35]" : "border-[#dde1db]"} bg-white`}
              >
                <div className="relative aspect-[4/3]">
                  <Image
                    src={diem.image}
                    alt=""
                    fill
                    sizes="(min-width: 640px) 200px, 45vw"
                    className={`object-cover ${den ? "" : "grayscale opacity-45"}`}
                  />
                  {den ? (
                    <DauMoc id={diem.id} ngay={den.lanDau} thuTu={viTri} nhan={t("Đã đến", "Visited")} />
                  ) : null}
                </div>
                <div className="p-3">
                  <p className="font-bold text-[#183f34]">{diem.shortName[lang]}</p>
                  <p className="mt-0.5 text-xs text-[#6b786f]">
                    {den
                      ? `${new Date(den.lanDau).toLocaleDateString(vung, { timeZone: "Asia/Ho_Chi_Minh" })}${den.soLan > 1 ? t(` · ${den.soLan} lượt`, ` · ${den.soLan} visits`) : ""}`
                      : t("Chưa ghé", "Not yet")}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mt-8">
        <h3 className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#557568]">{t("Nhiệm vụ và quà", "Quests and gifts")}</h3>
        <ul className="mt-3 space-y-3">
          {hoSo.nhiemVu.map((nv) => (
            <li
              key={nv.id}
              data-nhiem-vu={nv.id}
              data-xong={nv.xong ? "co" : "chua"}
              className={`rounded-2xl border p-4 ${nv.xong ? "border-[#d58c35] bg-[#fff8eb]" : "border-[#dde1db] bg-white"}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold text-[#183f34]">{lang === "en" ? (NHIEM_VU_EN[nv.id]?.ten ?? nv.ten) : nv.ten}</p>
                  <p className="mt-1 text-sm text-[#59654b]">{lang === "en" ? (NHIEM_VU_EN[nv.id]?.moTa ?? nv.moTa) : nv.moTa}</p>
                </div>
                <span className="shrink-0 text-sm font-extrabold text-[#356957]">{nv.duoc}/{nv.can}</span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#e7ebe8]" aria-hidden="true">
                <div className="h-full rounded-full bg-[#d58c35]" style={{ width: `${(nv.duoc / nv.can) * 100}%` }} />
              </div>
              <p className="mt-3 text-sm">
                <span className="font-bold text-[#6c4b1f]">{t("Quà: ", "Gift: ")}</span>
                <span className="text-[#27362f]">{lang === "en" ? (NHIEM_VU_EN[nv.id]?.qua ?? nv.phanThuong) : nv.phanThuong}</span>
              </p>
              {nv.maUuDai ? (
                <p className="mt-2 text-sm text-[#27362f]">
                  {t("Đọc mã", "Show code")}{" "}
                  <code className="rounded-lg bg-[#183f34] px-2 py-1 font-extrabold tracking-[0.06em] text-[#e7c78d]">{nv.maUuDai}</code>{" "}
                  {t("ở quầy vé để nhận.", "at the ticket desk to claim it.")}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs leading-5 text-[#6b786f]">
          {t("Quà là ưu đãi minh hoạ của bản trình diễn. Mã giữ nguyên dù bạn mở hồ sơ bao nhiêu lần.", "Gifts are sample offers in this demo. Your code stays the same however often you open the passport.")}
        </p>
      </section>

      <section className="mt-8">
        <h3 className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#557568]">{t("Các chuyến đã đặt", "Your bookings")}</h3>
        {hoSo.don.length === 0 ? (
          <p className="mt-3 text-sm text-[#59654b]">{t("Chưa có chuyến nào.", "No bookings yet.")}</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {hoSo.don.map((don) => (
              <li key={don.orderCode} className="rounded-2xl border border-[#dde1db] bg-white p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-bold text-[#183f34]">{tenGoi(don.productName, lang)}</p>
                  <code className="text-sm font-extrabold tracking-[0.06em] text-[#9a6328]">{don.orderCode}</code>
                </div>
                <p className="mt-1 text-sm text-[#59654b]">
                  {t("Ngày", "Date")} {new Date(`${don.visitDate}T00:00:00`).toLocaleDateString(vung)} · {don.partySize} {t("khách", "guests")} · {don.totalVnd.toLocaleString("vi-VN")} đ
                </p>
                <p className="mt-1 text-sm font-bold text-[#356957]">{lang === "en" ? (CACH_TRA_EN[don.paymentLabel] ?? don.paymentLabel) : don.paymentLabel}</p>
                {don.tickets.length > 0 ? (
                  <p className="mt-2 text-xs text-[#6b786f]">
                    {don.tickets.map((ve) => t(`${ve.ticketCode} (đã vào ${ve.entriesUsed}/${ve.entriesAllowed})`, `${ve.ticketCode} (used ${ve.entriesUsed}/${ve.entriesAllowed})`)).join(" · ")}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {xemThu ? null : (
        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          <Link
            href="/packages"
            className="flex min-h-12 items-center justify-center rounded-full bg-[#d58c35] px-6 font-extrabold text-[#151a17]"
          >
            {t("Đặt chuyến tiếp theo", "Book your next trip")}
          </Link>
          <Link
            href="/tra-cuu-ve"
            className="flex min-h-12 items-center justify-center rounded-full border border-[#183f34] px-6 font-extrabold text-[#183f34]"
          >
            {t("Mở lại vé và mã QR", "Open tickets and QR codes")}
          </Link>
        </div>
      )}
    </div>
  );
}
