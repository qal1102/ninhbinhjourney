import Link from "next/link";
import type { DirectorTicketOverview } from "@/lib/erp/ticket-overview-repository";

/**
 * ERP-UX-06d — "hôm nay bán được bao nhiêu vé" phải trả lời được ngay ở trang
 * đầu, không bắt giám đốc đi vào từng cơ sở rồi mở đúng một nghiệp vụ mới
 * thấy. Số ở đây đếm từ vé đã phát hành thật, không phải con số người trực tự
 * khai trong hồ sơ chốt ca.
 */

function formatVnd(value: number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatChange(percent: number | null, previous: number, unit: string) {
  if (percent === null) {
    return previous === 0 ? `Kỳ trước chưa bán ${unit} nào` : "Chưa so sánh được";
  }
  const sign = percent > 0 ? "+" : "";
  return `${sign}${percent.toLocaleString("vi-VN")}% so với kỳ trước (${previous.toLocaleString("vi-VN")})`;
}

export function DirectorTicketPanel({
  overview,
}: {
  overview: DirectorTicketOverview | null;
}) {
  if (!overview) {
    return (
      <section className="rounded-2xl border border-[#e6d3c9] bg-[#fdf6f2] p-5 shadow-sm sm:p-6">
        <p className="text-xs font-black uppercase tracking-[0.17em] text-[#96604a]">
          Vé đã bán
        </p>
        <h2 className="mt-2 text-2xl font-black text-[#4a2f22]">
          Chưa đọc được kho vé lúc này
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-[#75574a]">
          Phần còn lại của trang vẫn dùng bình thường. Bạn tải lại trang giúp
          em; nếu vẫn vậy thì kho vé đang trục trặc chứ không phải hôm nay
          không bán được vé nào.
        </p>
      </section>
    );
  }

  if (!overview.available) {
    return (
      <section className="rounded-2xl border border-[#dbe2de] bg-white p-5 shadow-sm sm:p-6">
        <p className="text-xs font-black uppercase tracking-[0.17em] text-[#477565]">
          Vé đã bán
        </p>
        <h2 className="mt-2 text-2xl font-black text-[#20342c]">
          Máy này đang chạy bản chạy thử cục bộ
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-[#697770]">
          Bản chạy thử không nối vào kho vé thật, nên ở đây không có con số nào
          để đưa lên. Thà để trống còn hơn dựng một con số cho đẹp mắt.
        </p>
      </section>
    );
  }

  const [today, week, month] = overview.windows;
  const busiest = overview.bySite[0];

  return (
    <section
      data-testid="director-ticket-overview"
      className="rounded-2xl border border-[#dbe2de] bg-white p-5 shadow-sm sm:p-6"
    >
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.17em] text-[#477565]">
            Vé đã bán · cả bốn cơ sở
          </p>
          <h2 className="mt-2 text-2xl font-black text-[#20342c]">
            Hôm nay {today.current.toLocaleString("vi-VN")} vé
          </h2>
        </div>
        <p className="text-xs text-[#7c8882]">
          Đếm từ vé đã phát hành, không phải số người trực tự khai lúc chốt ca.
        </p>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {[today, week, month].map((window) => (
          <article
            key={window.label}
            className="rounded-xl border border-[#e3e9e5] bg-[#f6f9f7] p-4"
          >
            <p className="text-xs font-bold text-[#6d7c74]">{window.label}</p>
            <p className="mt-2 text-3xl font-black tracking-[-0.03em] text-[#1e3229]">
              {window.current.toLocaleString("vi-VN")}
            </p>
            <p
              className={`mt-2 text-xs font-bold ${
                window.changePercent === null
                  ? "text-[#7c8882]"
                  : window.changePercent >= 0
                    ? "text-[#2d735b]"
                    : "text-[#8b3d31]"
              }`}
            >
              {formatChange(window.changePercent, window.previous, "vé")}
            </p>
          </article>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.15em] text-[#607b70]">
            Từng cơ sở · 30 ngày
          </p>
          {overview.bySite.length === 0 ? (
            <p className="mt-3 text-sm text-[#7b8881]">
              Bạn chưa được phân công cơ sở nào.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {overview.bySite.map((site) => (
                <li key={site.siteId}>
                  <Link
                    href={`/erp/${site.siteId}/ve-dat-cho`}
                    className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-[#e3e9e5] px-4 text-sm transition hover:border-[#a8bbb2] hover:bg-[#f4f8f6]"
                  >
                    <span className="font-bold text-[#33483f]">
                      {site.shortName}
                    </span>
                    <span className="text-[#66756e]">
                      hôm nay{" "}
                      <strong className="text-[#1e3229]">
                        {site.today.toLocaleString("vi-VN")}
                      </strong>{" "}
                      · 30 ngày{" "}
                      <strong className="text-[#1e3229]">
                        {site.month.toLocaleString("vi-VN")}
                      </strong>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {busiest && busiest.month > 0 ? (
            <p className="mt-3 text-xs leading-5 text-[#7c8882]">
              Ba mươi ngày qua {busiest.shortName} bán được nhiều vé nhất. Bấm
              vào tên cơ sở để xem từng tấm vé và lượt quét ở cổng.
            </p>
          ) : null}
        </div>

        <div>
          <p className="text-xs font-black uppercase tracking-[0.15em] text-[#607b70]">
            Khách đến từ đâu · 30 ngày
          </p>
          {overview.byChannel.length === 0 ? (
            <p className="mt-3 text-sm text-[#7b8881]">
              Ba mươi ngày qua chưa phát hành tấm vé nào.
            </p>
          ) : (
            <div className="mt-3 space-y-3">
              {overview.byChannel.map((channel) => (
                <div key={channel.channel}>
                  <div className="flex justify-between gap-3 text-sm">
                    <span className="font-bold text-[#33483f]">
                      {channel.channelLabel}
                    </span>
                    <span className="text-[#66756e]">
                      {channel.count.toLocaleString("vi-VN")} vé ·{" "}
                      {channel.sharePercent.toLocaleString("vi-VN")}%
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#edf1ee]">
                    <div
                      className="h-full rounded-full bg-[#397a62]"
                      style={{ width: `${channel.sharePercent}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-5 rounded-xl border border-[#e3e9e5] bg-[#f6f9f7] p-4">
            <p className="text-xs font-bold text-[#6d7c74]">
              Tiền khách trả qua web · 30 ngày
            </p>
            <p className="mt-2 text-2xl font-black tracking-[-0.03em] text-[#1e3229]">
              {formatVnd(overview.webRevenue30dVnd)}
            </p>
            <p className="mt-2 text-xs leading-5 text-[#7c8882]">
              {overview.webOrders30d.toLocaleString("vi-VN")} đơn đã xác nhận.
              Chỉ tính đơn đặt qua web, vì vé bán tại quầy chưa lưu giá ở đâu
              cả — gộp chung vào là ra một con số không có thật.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
