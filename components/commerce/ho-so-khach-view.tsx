import Image from "next/image";
import Link from "next/link";
import type { HoSoKhach } from "@/domain/ho-so-khach";
import { tripPassportPlaces } from "@/domain/trip-passport";

/**
 * Hộ chiếu Ninh Bình của một khách: nơi đã vào, nhiệm vụ, quà và các chuyến
 * đã đặt. Dùng chung cho trang khách (/ho-so) và màn hình "Khách thấy gì"
 * của giám đốc, nên chỉ nhận dữ liệu qua props, không tự đọc gì.
 */
export function HoSoKhachView({ hoSo, xemThu = false }: { hoSo: HoSoKhach; xemThu?: boolean }) {
  const noi = tripPassportPlaces();
  const daDen = new Map(hoSo.noiDaDen.map((item) => [item.siteId, item]));
  return (
    <div data-testid="ho-so-khach" className="text-[#151a17]">
      <section className="rounded-3xl bg-[#183f34] p-6 text-white sm:p-8">
        <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#e7c78d]">Hộ chiếu Ninh Bình</p>
        <h2 className="font-display mt-3 text-3xl leading-tight sm:text-4xl">
          {hoSo.noiDaDen.length === 0
            ? "Chuyến đi của bạn bắt đầu từ cổng đầu tiên"
            : `Bạn đã qua ${hoSo.noiDaDen.length} trên ${noi.length} cổng`}
        </h2>
        <p className="mt-3 leading-7 text-white/75">
          Mỗi lần nhân viên quét vé ở cổng, nơi ấy sáng lên ở đây. Đi đủ các vùng thì mở thêm quà cho chuyến sau.
        </p>
        <dl className="mt-6 grid grid-cols-3 gap-3 text-center">
          <div className="rounded-2xl bg-white/10 px-2 py-3">
            <dt className="text-xs text-white/60">Chuyến đã đặt</dt>
            <dd className="font-display mt-1 text-2xl text-[#e7c78d]">{hoSo.don.length}</dd>
          </div>
          <div className="rounded-2xl bg-white/10 px-2 py-3">
            <dt className="text-xs text-white/60">Ngày đã đi</dt>
            <dd className="font-display mt-1 text-2xl text-[#e7c78d]">{hoSo.soNgayDi}</dd>
          </div>
          <div className="rounded-2xl bg-white/10 px-2 py-3">
            <dt className="text-xs text-white/60">Nhiệm vụ xong</dt>
            <dd className="font-display mt-1 text-2xl text-[#e7c78d]">{hoSo.soNhiemVuXong}/{hoSo.nhiemVu.length}</dd>
          </div>
        </dl>
      </section>

      <section className="mt-6">
        <h3 className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#557568]">Những nơi đã sáng</h3>
        <ul className={`mt-3 grid grid-cols-2 gap-3 ${xemThu ? "" : "sm:grid-cols-4"}`}>
          {noi.map((diem) => {
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
                    <span className="absolute right-2 top-2 rounded-full bg-[#d58c35] px-2 py-0.5 text-xs font-extrabold text-[#151a17]">Đã đến</span>
                  ) : null}
                </div>
                <div className="p-3">
                  <p className="font-bold text-[#183f34]">{diem.shortName.vi}</p>
                  <p className="mt-0.5 text-xs text-[#6b786f]">
                    {den
                      ? `${new Date(den.lanDau).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}${den.soLan > 1 ? ` · ${den.soLan} lượt` : ""}`
                      : "Chưa ghé"}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mt-8">
        <h3 className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#557568]">Nhiệm vụ và quà</h3>
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
                  <p className="font-bold text-[#183f34]">{nv.ten}</p>
                  <p className="mt-1 text-sm text-[#59654b]">{nv.moTa}</p>
                </div>
                <span className="shrink-0 text-sm font-extrabold text-[#356957]">{nv.duoc}/{nv.can}</span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#e7ebe8]" aria-hidden="true">
                <div className="h-full rounded-full bg-[#d58c35]" style={{ width: `${(nv.duoc / nv.can) * 100}%` }} />
              </div>
              <p className="mt-3 text-sm">
                <span className="font-bold text-[#6c4b1f]">Quà: </span>
                <span className="text-[#27362f]">{nv.phanThuong}</span>
              </p>
              {nv.maUuDai ? (
                <p className="mt-2 text-sm text-[#27362f]">
                  Đọc mã <code className="rounded-lg bg-[#183f34] px-2 py-1 font-extrabold tracking-[0.06em] text-[#e7c78d]">{nv.maUuDai}</code> ở quầy vé để nhận.
                </p>
              ) : null}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs leading-5 text-[#6b786f]">
          Quà là ưu đãi minh hoạ của bản trình diễn. Mã giữ nguyên dù bạn mở hồ sơ bao nhiêu lần.
        </p>
      </section>

      <section className="mt-8">
        <h3 className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#557568]">Các chuyến đã đặt</h3>
        {hoSo.don.length === 0 ? (
          <p className="mt-3 text-sm text-[#59654b]">Chưa có chuyến nào.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {hoSo.don.map((don) => (
              <li key={don.orderCode} className="rounded-2xl border border-[#dde1db] bg-white p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-bold text-[#183f34]">{don.productName}</p>
                  <code className="text-sm font-extrabold tracking-[0.06em] text-[#9a6328]">{don.orderCode}</code>
                </div>
                <p className="mt-1 text-sm text-[#59654b]">
                  Ngày {new Date(`${don.visitDate}T00:00:00`).toLocaleDateString("vi-VN")} · {don.partySize} khách · {don.totalVnd.toLocaleString("vi-VN")} đ
                </p>
                <p className="mt-1 text-sm font-bold text-[#356957]">{don.paymentLabel}</p>
                {don.tickets.length > 0 ? (
                  <p className="mt-2 text-xs text-[#6b786f]">
                    {don.tickets.map((ve) => `${ve.ticketCode} (đã vào ${ve.entriesUsed}/${ve.entriesAllowed})`).join(" · ")}
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
            Đặt chuyến tiếp theo
          </Link>
          <Link
            href="/tra-cuu-ve"
            className="flex min-h-12 items-center justify-center rounded-full border border-[#183f34] px-6 font-extrabold text-[#183f34]"
          >
            Mở lại vé và mã QR
          </Link>
        </div>
      )}
    </div>
  );
}
