import Link from "next/link";
import { BrandLockup } from "@/components/shared/brand-lockup";

export const metadata = {
  title: "Demo trung tâm điều hành | Ninh Bình DestinationOS",
  description:
    "Bản xem trước dữ liệu minh hoạ cho điều hành liên cơ sở Tam Chúc và Bái Đính.",
};

const sites = [
  {
    name: "Bái Đính",
    utilization: 68,
    expected: 612,
    checkedIn: 412,
    wait: 8,
    incidents: 1,
    status: "Theo dõi",
    statusClass: "bg-[#f5dfb4] text-[#6d4812]",
  },
  {
    name: "Tam Chúc",
    utilization: 54,
    expected: 528,
    checkedIn: 286,
    wait: 5,
    incidents: 0,
    status: "Ổn định",
    statusClass: "bg-[#dceee6] text-[#24594a]",
  },
] as const;

const signals = [
  {
    time: "09:20",
    site: "Bái Đính",
    title: "Ca 13:30 đạt ngưỡng theo dõi",
    detail: "Kịch bản gợi ý mở thêm điểm đón và kiểm tra xe điện trước giờ cao điểm.",
    level: "P3 · capacity",
  },
  {
    time: "09:08",
    site: "Tam Chúc",
    title: "Luồng xe trung chuyển trở lại bình thường",
    detail: "Điều phối viên đã xác nhận đủ xe cho hai khung giờ tiếp theo.",
    level: "Resolved · transport",
  },
  {
    time: "08:42",
    site: "Liên cơ sở",
    title: "34 khách có hành trình nối hai điểm",
    detail: "Danh sách bàn giao đang chờ xác nhận từ đầu mối Bái Đính.",
    level: "Handoff · journey",
  },
] as const;

export default function ExecutiveOpsDemoPage() {
  return (
    <main className="min-h-screen bg-[#eef0eb] text-[#151a17] lg:grid lg:grid-cols-[16rem_1fr]">
      <aside className="border-b border-white/10 bg-[#151a17] p-5 text-white lg:min-h-screen lg:border-b-0 lg:border-r lg:p-6">
        <BrandLockup href="/demo/ops" inverse product="DestinationOS" />
        <div className="mt-5 rounded-2xl border border-[#e7b96a]/30 bg-[#e7b96a]/10 p-4">
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#e7c78d]">
            Dữ liệu minh hoạ
          </p>
          <p className="mt-2 text-sm leading-6 text-white/76">
            Kịch bản UI để trình bày luồng quản lý; không phải số liệu vận hành
            thật của hai cơ sở.
          </p>
        </div>
        <nav
          aria-label="Điều hướng bản demo"
          className="mt-5 flex gap-2 overflow-x-auto pb-2 text-sm font-bold lg:flex-col lg:overflow-visible"
        >
          {[
            ["#overview", "Tổng quan"],
            ["#sites", "Hai cơ sở"],
            ["#signals", "Tín hiệu & sự cố"],
            ["#readiness", "Sẵn sàng dữ liệu"],
          ].map(([href, label]) => (
            <a
              key={href}
              href={href}
              className="shrink-0 rounded-xl px-4 py-3 text-white/76 transition hover:bg-white/8 hover:text-white"
            >
              {label}
            </a>
          ))}
        </nav>
        <div className="mt-6 border-t border-white/10 pt-5">
          <Link
            href="/ops/login"
            className="inline-flex min-h-11 items-center rounded-full bg-[#e7b96a] px-5 text-sm font-extrabold text-[#183f34]"
          >
            Đăng nhập vận hành thật
          </Link>
          <Link href="/" className="mt-4 block text-sm font-bold text-white/76">
            ← Về trang chủ
          </Link>
        </div>
      </aside>

      <div className="min-w-0 px-5 py-7 sm:px-8 lg:px-10 lg:py-10">
        <header id="overview" className="mx-auto max-w-7xl scroll-mt-6">
          <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-[#59654b]">
                Executive command preview · 15/08/2026
              </p>
              <h1 className="font-display mt-3 max-w-4xl text-4xl leading-none text-[#183f34] sm:text-6xl">
                Một màn hình để thấy Tam Chúc và Bái Đính đang vận hành ra sao.
              </h1>
            </div>
            <p className="max-w-sm rounded-2xl border border-[#d7d5cd] bg-white p-4 text-sm leading-6 text-[#59654b]">
              Thời điểm chụp kịch bản: <strong>09:30</strong>
              <br />Nguồn: dữ liệu demo cục bộ
            </p>
          </div>

          <section className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Chỉ số điều hành tổng quan">
            {[
              ["Khách dự kiến", "1.140", "Hai cơ sở"],
              ["Đã check-in", "698", "61% kế hoạch"],
              ["Hành trình liên cơ sở", "34", "Chờ 1 bàn giao"],
              ["Sự cố đang mở", "1", "Không có P1/P2"],
            ].map(([label, value, note]) => (
              <article key={label} className="rounded-2xl border border-[#d7d5cd] bg-white p-5 shadow-sm">
                <p className="text-sm text-[#59654b]">{label}</p>
                <p className="font-display mt-3 text-4xl text-[#183f34]">{value}</p>
                <p className="mt-2 text-xs font-bold text-[#526058]">{note}</p>
              </article>
            ))}
          </section>
        </header>

        <section id="sites" className="mx-auto mt-7 max-w-7xl scroll-mt-6 rounded-3xl bg-[#183f34] p-5 text-white sm:p-7">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#a8cec1]">
                Two-site live board
              </p>
              <h2 className="font-display mt-2 text-3xl sm:text-5xl">Hai cơ sở, cùng một nhịp điều hành.</h2>
            </div>
            <p className="text-sm text-white/76">Cập nhật minh hoạ lúc 09:30</p>
          </div>
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {sites.map((site) => (
              <article key={site.name} className="rounded-2xl border border-white/12 bg-white/[0.06] p-5 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/76">Operating site</p>
                    <h3 className="font-display mt-2 text-4xl">{site.name}</h3>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-extrabold ${site.statusClass}`}>
                    {site.status}
                  </span>
                </div>
                <div className="mt-6 grid grid-cols-3 gap-3 border-y border-white/10 py-4">
                  <div>
                    <p className="text-xs text-white/76">Check-in</p>
                    <p className="mt-1 text-2xl font-bold">{site.checkedIn}</p>
                    <p className="text-xs text-white/72">/{site.expected}</p>
                  </div>
                  <div>
                    <p className="text-xs text-white/76">Chờ TB</p>
                    <p className="mt-1 text-2xl font-bold">{site.wait}</p>
                    <p className="text-xs text-white/72">phút</p>
                  </div>
                  <div>
                    <p className="text-xs text-white/76">Sự cố mở</p>
                    <p className="mt-1 text-2xl font-bold">{site.incidents}</p>
                    <p className="text-xs text-white/72">ca</p>
                  </div>
                </div>
                <div className="mt-5">
                  <div className="flex justify-between text-xs text-white/76">
                    <span>Sử dụng sức chứa</span>
                    <span>{site.utilization}%</span>
                  </div>
                  <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-[#8fc6b5]" style={{ width: `${site.utilization}%` }} />
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section id="signals" className="mx-auto mt-7 grid max-w-7xl scroll-mt-6 gap-6 xl:grid-cols-[1.2fr_.8fr]">
          <div className="rounded-3xl border border-[#d7d5cd] bg-white p-5 sm:p-7">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#59654b]">Signal feed</p>
                <h2 className="font-display mt-2 text-3xl text-[#183f34]">Việc cần biết ngay</h2>
              </div>
              <span className="rounded-full bg-[#eef0eb] px-3 py-1 text-xs font-bold text-[#526058]">3 cập nhật</span>
            </div>
            <ol className="mt-5 divide-y divide-[#e1e2dc]">
              {signals.map((signal) => (
                <li key={`${signal.time}-${signal.title}`} className="grid gap-3 py-5 first:pt-0 sm:grid-cols-[4rem_1fr_auto]">
                  <p className="font-bold text-[#356957]">{signal.time}</p>
                  <div>
                    <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#6a745f]">{signal.site}</p>
                    <h3 className="mt-1 font-bold text-[#183f34]">{signal.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-[#59654b]">{signal.detail}</p>
                  </div>
                  <span className="h-fit w-fit rounded-full border border-[#c8d6cf] px-3 py-1 text-xs font-bold text-[#526058]">
                    {signal.level}
                  </span>
                </li>
              ))}
            </ol>
          </div>

          <aside className="rounded-3xl bg-[#e2ece6] p-5 sm:p-7">
            <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#356957]">Leadership lens</p>
            <h2 className="font-display mt-2 text-3xl text-[#183f34]">Từ số liệu sang quyết định.</h2>
            <ul className="mt-5 space-y-3 text-sm leading-6 text-[#4d5b55]">
              <li className="rounded-2xl bg-white/72 p-4"><strong>Điều phối:</strong> ưu tiên xe điện cho ca Bái Đính 13:30.</li>
              <li className="rounded-2xl bg-white/72 p-4"><strong>Liên cơ sở:</strong> xác nhận đầu mối nhận 34 khách nối tuyến.</li>
              <li className="rounded-2xl bg-white/72 p-4"><strong>Minh bạch:</strong> mọi thay đổi sức chứa và xử lý sự cố phải có audit trail.</li>
            </ul>
          </aside>
        </section>

        <section id="readiness" className="mx-auto mt-7 max-w-7xl scroll-mt-6 rounded-3xl border border-[#d7d5cd] bg-[#f5f1e8] p-5 sm:p-7">
          <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#76501b]">Data readiness</p>
          <h2 className="font-display mt-2 text-3xl text-[#183f34] sm:text-5xl">Demo được ngay; vận hành thật cần kết nối nguồn.</h2>
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl bg-white p-5">
              <h3 className="font-bold text-[#183f34]">Đã có trong sản phẩm</h3>
              <p className="mt-3 text-sm leading-7 text-[#59654b]">Phân quyền operator, sức chứa theo ca, check-in QR, đặt chỗ, sự cố, phối hợp, nhật ký audit và phòng demo dùng chung.</p>
            </div>
            <div className="rounded-2xl bg-white p-5">
              <h3 className="font-bold text-[#183f34]">Cần khách hàng cung cấp để chạy thật</h3>
              <p className="mt-3 text-sm leading-7 text-[#59654b]">Nguồn vé/cổng soát, năng lực xe trung chuyển, danh sách ca trực, quy trình SOP, thiết bị hiện trường, dữ liệu POS và quyền truy cập hệ thống hiện có.</p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
