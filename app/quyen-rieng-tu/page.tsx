import type { Metadata } from "next";
import Link from "next/link";
import { ProtectedMailLink } from "@/components/discovery/protected-mail-link";
import { CONTACT } from "@/content/contact";

export const metadata: Metadata = {
  title: "Quyền riêng tư | Ninh Bình Journey",
  description: "Cách Xuân Trường xử lý dữ liệu khách trên Ninh Bình Journey.",
};

const purposes = [
  {
    title: "Giữ và phục vụ hành trình",
    status: "Chỉ khi bạn yêu cầu",
    body: "Lưu lịch trình đã tạo, liên hệ đã bảo vệ và yêu cầu nhận lại hành trình. Quyền này không cho phép gửi nội dung quảng bá.",
  },
  {
    title: "Phân tích trải nghiệm",
    status: "Tự chọn",
    body: "Ghi lại bạn xem trang nào, xem bao lâu, cuộn tới đâu, bấm nút nào. Chúng tôi không ghi chữ bạn gõ, giọng nói, email hay số điện thoại vào phần này.",
  },
  {
    title: "Thông tin giới thiệu",
    status: "Mặc định tắt",
    body: "Chỉ dùng khi bạn tự bật. Bạn tắt đi là chúng tôi thôi gửi tin quảng cáo ngay; phần phục vụ chuyến đi của bạn không bị ảnh hưởng.",
  },
] as const;

/*
 * A15-PHAP-LY-01 · 17/09/2026. Mọi dòng dưới đây đã đối chiếu với bản quét có
 * chữ ký trên vanban.chinhphu.vn, không chép qua trang tổng hợp:
 * - Luật 91/2025/QH15: Điều 9 (đồng ý), khoản 2 Điều 10 (rút lại bằng văn
 *   bản), Điều 20 (chuyển dữ liệu xuyên biên giới), Điều 38 (hiệu lực).
 * - Nghị định 356/2025/NĐ-CP: Điều 5 (thời hạn), khoản 3 Điều 6 (không đặt
 *   sẵn mặc định đồng ý), Điều 42 (hiệu lực).
 * Nơi đặt máy chủ: vùng cơ sở dữ liệu đã đo bằng Supabase CLI; vùng chạy hàm
 * của Vercel CHƯA đo nên chỉ ghi "ngoài Việt Nam", đừng tự điền tên vùng.
 * Trang này cố ý không nhắc tới hồ sơ đánh giá tác động chuyển dữ liệu ra
 * nước ngoài: đó là việc pháp lý A15-ERP-08, không phải việc của mã.
 * Email chỉ ghép trên trình duyệt qua `ProtectedMailLink`; đừng viết địa chỉ
 * thẳng vào trang này.
 */
const processingLocations = [
  {
    role: "Cơ sở dữ liệu",
    place: "Tokyo, Nhật Bản",
    body: "Dịch vụ Supabase, nơi website lưu dữ liệu khách.",
  },
  {
    role: "Máy chủ web",
    place: "Ngoài Việt Nam",
    body: "Hạ tầng Vercel. Dữ liệu bạn gửi từ website đi qua đây trước khi được lưu.",
  },
] as const;

const requestDeadlines = [
  {
    request: "Xem, sửa hoặc đề nghị cung cấp dữ liệu",
    days: "10 ngày",
    shared: "15 ngày nếu cần bên xử lý hoặc bên thứ ba cùng sửa",
  },
  {
    request: "Rút lại sự đồng ý, hạn chế hoặc phản đối xử lý",
    days: "15 ngày",
    shared: "20 ngày nếu cần bên xử lý hoặc bên thứ ba cùng ngừng xử lý",
  },
  {
    request: "Xóa dữ liệu",
    days: "20 ngày",
    shared: "30 ngày nếu cần bên xử lý hoặc bên thứ ba cùng xóa",
  },
] as const;

const legalBasis = [
  {
    name: "Luật Bảo vệ dữ liệu cá nhân số 91/2025/QH15",
    detail: "Quốc hội thông qua ngày 26/06/2025, có hiệu lực từ 01/01/2026.",
  },
  {
    name: "Nghị định 356/2025/NĐ-CP",
    detail:
      "Chính phủ ban hành ngày 31/12/2025, quy định chi tiết một số điều và biện pháp thi hành Luật Bảo vệ dữ liệu cá nhân, có hiệu lực từ 01/01/2026.",
  },
] as const;

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#f4f0e7] text-[#17251f]">
      <header className="border-b border-[#d7d5cd] bg-[#fbfaf6]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
          <Link href="/" className="font-display text-lg tracking-[0.12em] text-[#183f34]">NINH BÌNH</Link>
          <Link href="/plan" className="rounded-full px-4 py-2 text-sm font-bold">Lập hành trình</Link>
        </div>
      </header>

      <article className="mx-auto max-w-6xl px-5 py-12 sm:px-8 sm:py-16">
        <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-[#56766a]">Thông báo xử lý dữ liệu · phiên bản 17.09.2026</p>
        <h1 className="font-display mt-4 max-w-4xl text-5xl leading-[0.98] text-[#183f34] sm:text-7xl">Bạn quyết định dữ liệu của mình được dùng thế nào.</h1>
        <p className="mt-6 max-w-3xl text-lg leading-8 text-[#596b63]">
          Xuân Trường vận hành Ninh Bình Journey và chịu trách nhiệm với dữ liệu được gửi qua website. Chúng tôi chỉ ghi nhận cách website được sử dụng sau khi bạn đồng ý; việc phục vụ hành trình và việc gửi thông tin giới thiệu luôn là hai lựa chọn riêng.
        </p>

        <section className="mt-12 grid gap-4 lg:grid-cols-3">
          {purposes.map((purpose) => (
            <article key={purpose.title} className="rounded-3xl border border-[#d5ddd8] bg-white p-6">
              <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#6b7d74]">{purpose.status}</p>
              <h2 className="font-display mt-3 text-3xl text-[#183f34]">{purpose.title}</h2>
              <p className="mt-4 text-sm leading-7 text-[#5d6b64]">{purpose.body}</p>
            </article>
          ))}
        </section>

        <section className="mt-12 grid gap-8 rounded-[2rem] bg-[#183f34] p-6 text-white sm:p-9 lg:grid-cols-2">
          <div>
            <h2 className="font-display text-3xl">Dữ liệu được bảo vệ thế nào</h2>
            <ul className="mt-5 space-y-3 text-sm leading-7 text-white/78">
              <li>Website dùng một mã ngẫu nhiên để phân biệt các phiên truy cập, không tạo dấu vân tay thiết bị.</li>
              <li>Email và số điện thoại được bảo vệ trước khi lưu, đồng thời được tách khỏi dữ liệu hành vi.</li>
              <li>Chỉ người có đúng vai trò vận hành mới được xem thông tin cần thiết để phục vụ yêu cầu của bạn.</li>
              <li>Mọi thay đổi về lựa chọn quyền riêng tư đều được ghi lại để có thể kiểm tra khi cần.</li>
            </ul>
          </div>
          <div>
            <h2 className="font-display text-3xl">Thời hạn lưu giữ</h2>
            <ul className="mt-5 space-y-3 text-sm leading-7 text-white/78">
              <li>Dữ liệu thao tác trên trang (không gắn tên): tối đa 13 tháng.</li>
              <li>Yêu cầu nhận lại hành trình và liên hệ phục vụ: 90 ngày sau ngày đi dự kiến, trừ khi phát sinh giao dịch cần thời hạn khác.</li>
              <li>Đồng ý nhận tin quảng cáo: tới khi bạn tắt, hoặc sau 24 tháng không tương tác, tuỳ điều nào tới trước.</li>
              <li>Dữ liệu giao dịch, vé và kế toán sẽ có thời hạn riêng theo nghĩa vụ vận hành khi luồng bán thật được phê duyệt.</li>
            </ul>
          </div>
        </section>

        <section aria-labelledby="noi-xu-ly-du-lieu" className="mt-12 grid gap-8 border-t border-[#d7d5cd] pt-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-[#56766a]">Nơi dữ liệu được xử lý</p>
            <h2 id="noi-xu-ly-du-lieu" className="font-display mt-3 text-4xl text-[#183f34]">Máy chủ đặt ngoài Việt Nam</h2>
            <p className="mt-4 leading-8 text-[#596b63]">
              Cơ sở dữ liệu và máy chủ web của Ninh Bình Journey đều nằm ngoài lãnh thổ Việt Nam. Vì vậy dữ liệu cá nhân bạn gửi qua website được chuyển ra nước ngoài để lưu trữ và xử lý, tức là chuyển dữ liệu cá nhân xuyên biên giới theo Điều 20 Luật Bảo vệ dữ liệu cá nhân.
            </p>
          </div>
          <dl className="grid gap-4 sm:grid-cols-2">
            {processingLocations.map((location) => (
              <div key={location.role} className="rounded-3xl border border-[#d5ddd8] bg-white p-6">
                <dt className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#6b7d74]">{location.role}</dt>
                <dd className="font-display mt-3 text-3xl text-[#183f34]">{location.place}</dd>
                <dd className="mt-3 text-sm leading-7 text-[#5d6b64]">{location.body}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="mt-12 max-w-3xl">
          <h2 className="font-display text-4xl text-[#183f34]">Bạn có thể đổi ý</h2>
          <p className="mt-4 leading-8 text-[#596b63]">
            Nút “Quyền riêng tư” cho phép bạn tắt phân tích trải nghiệm hoặc ngừng nhận gợi ý ngay trên website. Yêu cầu xem, xuất, sửa, xóa hoặc hạn chế xử lý dữ liệu được tiếp nhận trực tiếp bởi đầu mối vận hành Xuân Trường.
          </p>
          <p className="mt-4 rounded-2xl border border-[#d7c69e] bg-[#fff8e9] p-4 text-sm leading-6 text-[#695631]">
            Việc tắt các lựa chọn không cần thiết không ảnh hưởng đến khả năng xem nội dung, lập hành trình hoặc gửi yêu cầu đặt chỗ. Khi có giao dịch, chúng tôi sẽ thông báo rõ dữ liệu cần dùng trước khi bạn xác nhận.
          </p>
        </section>

        <section className="mt-8 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
          <div id="lien-he" className="scroll-mt-6 rounded-3xl border border-[#d5ddd8] bg-white p-6 sm:p-8">
            <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#6b7d74]">Đầu mối nhận yêu cầu</p>
            <h2 id="gui-yeu-cau-du-lieu" className="font-display mt-3 text-3xl text-[#183f34] sm:text-4xl">Gửi yêu cầu về dữ liệu</h2>
            <p className="mt-4 text-sm leading-7 text-[#5d6b64]">
              Cách chắc nhất là gửi thư, vì yêu cầu rút lại sự đồng ý hoặc hạn chế xử lý phải thể hiện bằng văn bản, kể cả dạng điện tử (khoản 2 Điều 10 Luật Bảo vệ dữ liệu cá nhân). Xin ghi rõ bạn cần gì, kèm email hoặc số điện thoại bạn đã dùng trên website. Cần hỏi thêm, bạn cứ gọi cho chúng tôi.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <ProtectedMailLink
                subject="Yêu cầu về dữ liệu cá nhân"
                className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#183f34] px-5 text-sm font-bold text-white transition hover:bg-[#245545] motion-reduce:transition-none"
              >
                Gửi thư yêu cầu
              </ProtectedMailLink>
              <a
                href={CONTACT.phoneHref}
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-[#bec9c3] px-5 text-sm font-bold text-[#183f34] transition hover:bg-[#f4f0e7] motion-reduce:transition-none"
              >
                Gọi {CONTACT.phoneLabel}
              </a>
            </div>
          </div>

          <div className="rounded-3xl border border-[#d5ddd8] bg-white p-6 sm:p-8">
            <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#6b7d74]">Thời hạn phản hồi</p>
            <h2 id="thoi-han-phan-hoi" className="font-display mt-3 text-3xl text-[#183f34] sm:text-4xl">Bao lâu bạn nhận được trả lời</h2>
            <p className="mt-4 text-sm leading-7 text-[#5d6b64]">
              Nhận yêu cầu của bạn, chúng tôi trả lời trong 02 ngày làm việc và báo rõ thủ tục. Việc thực hiện theo thời hạn tại Điều 5 Nghị định 356/2025/NĐ-CP:
            </p>
            <dl className="mt-5 divide-y divide-[#e3e6e1] border-y border-[#e3e6e1]">
              {requestDeadlines.map((row) => (
                <div key={row.request} className="grid gap-1 py-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,12rem)] sm:gap-6">
                  <dt className="text-sm font-bold leading-6 text-[#183f34]">{row.request}</dt>
                  <dd className="sm:text-right">
                    <span className="font-display block text-2xl leading-tight text-[#183f34]">{row.days}</span>
                    <span className="mt-1 block text-xs leading-5 text-[#6b7d74]">{row.shared}</span>
                  </dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 text-xs leading-6 text-[#6b7d74]">
              Yêu cầu phức tạp có thể gia hạn một lần, không quá 10, 15 hoặc 20 ngày theo đúng thứ tự ba loại ở trên, và chúng tôi báo bạn lý do gia hạn. Riêng yêu cầu rút lại sự đồng ý, hạn chế hoặc phản đối xử lý không áp dụng cho những trường hợp Điều 19 của Luật cho phép xử lý không cần sự đồng ý.
            </p>
          </div>
        </section>

        <section aria-labelledby="can-cu-phap-ly" className="mt-12 grid gap-8 border-t border-[#d7d5cd] pt-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-[#56766a]">Căn cứ pháp lý</p>
            <h2 id="can-cu-phap-ly" className="font-display mt-3 text-4xl text-[#183f34]">Hai văn bản làm căn cứ</h2>
          </div>
          <div>
            <ul className="space-y-4">
              {legalBasis.map((document) => (
                <li key={document.name} className="border-l-2 border-[#d7c69e] pl-4">
                  <p className="font-bold leading-7 text-[#183f34]">{document.name}</p>
                  <p className="mt-1 text-sm leading-7 text-[#5d6b64]">{document.detail}</p>
                </li>
              ))}
            </ul>
            <p className="mt-6 leading-8 text-[#596b63]">
              Điều 9 của Luật nói rõ: sự đồng ý phải thể hiện cho từng mục đích, không được kèm điều kiện buộc đồng ý với mục đích khác, và im lặng hoặc không phản hồi không được coi là đồng ý. Khoản 3 Điều 6 Nghị định 356/2025/NĐ-CP không cho đặt sẵn chế độ mặc định đồng ý, nên ô nhận thông tin giới thiệu luôn để trống cho tới khi bạn tự tích.
            </p>
          </div>
        </section>
      </article>
    </main>
  );
}
