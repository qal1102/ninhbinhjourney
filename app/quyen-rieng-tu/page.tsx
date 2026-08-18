import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Quyền riêng tư | Ninh Bình Journey",
  description: "Dự thảo cách Xuân Trường xử lý dữ liệu khách trên Ninh Bình Journey.",
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
    body: "Đo trang, phần nội dung, thời gian xem chủ động, độ sâu cuộn và nút đã chọn. Không thu nội dung bạn gõ, âm thanh, email hay số điện thoại trong event hành vi.",
  },
  {
    title: "Thông tin giới thiệu",
    status: "Mặc định tắt",
    body: "Chỉ được dùng khi bạn tự bật. Rút lại quyền sẽ làm phân khúc marketing mất hiệu lực ngay; quyền phục vụ hành trình vẫn độc lập.",
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
        <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-[#56766a]">Dự thảo vận hành · phiên bản 18.08.2026</p>
        <h1 className="font-display mt-4 max-w-4xl text-5xl leading-[0.98] text-[#183f34] sm:text-7xl">Dữ liệu của bạn vẫn là lựa chọn của bạn.</h1>
        <p className="mt-6 max-w-3xl text-lg leading-8 text-[#596b63]">
          Pháp nhân vận hành được xác định cho bản dự thảo này là Xuân Trường, đồng thời là đơn vị kiểm soát dữ liệu của Ninh Bình Journey. Bản này mô tả cách hệ thống đang được xây và thử nghiệm; chưa phải thông báo pháp lý đã phê duyệt để mở thu dữ liệu người thật.
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
            <h2 className="font-display text-3xl">Dữ liệu được giữ ở đâu</h2>
            <ul className="mt-5 space-y-3 text-sm leading-7 text-white/78">
              <li>Hành vi ẩn danh dùng mã first-party ngẫu nhiên, không fingerprint thiết bị.</li>
              <li>Email hoặc số điện thoại được chuẩn hóa, băm HMAC để chống trùng và mã hóa AES-GCM trước khi lưu.</li>
              <li>Customer 360 chỉ hiện loại liên hệ đã bảo vệ; giao diện hiện tại không có đường giải mã giá trị gốc.</li>
              <li>Lịch sử consent và audit chỉ ghi thêm, không sửa hoặc xóa trực tiếp.</li>
            </ul>
          </div>
          <div>
            <h2 className="font-display text-3xl">Thời hạn dự kiến</h2>
            <ul className="mt-5 space-y-3 text-sm leading-7 text-white/78">
              <li>Event hành vi ẩn danh: tối đa 13 tháng.</li>
              <li>Yêu cầu nhận lại hành trình và liên hệ phục vụ: 90 ngày sau ngày đi dự kiến, trừ khi phát sinh giao dịch cần thời hạn khác.</li>
              <li>Quyền marketing: tới khi rút lại hoặc 24 tháng không có tương tác, tùy thời điểm nào đến trước.</li>
              <li>Dữ liệu giao dịch, vé và kế toán sẽ có thời hạn riêng theo nghĩa vụ vận hành khi luồng bán thật được phê duyệt.</li>
            </ul>
          </div>
        </section>

        <section className="mt-12 max-w-3xl">
          <h2 className="font-display text-4xl text-[#183f34]">Bạn có thể đổi ý</h2>
          <p className="mt-4 leading-8 text-[#596b63]">
            Nút “Quyền riêng tư” cho phép tắt analytics và rút quyền marketing. Yêu cầu xem, xuất, sửa, xóa hoặc hạn chế xử lý sẽ được bổ sung kênh tiếp nhận chính thức trước khi bật production; Xuân Trường phải duyệt đầu mối phụ trách và thời hạn phản hồi trước mốc đó.
          </p>
          <p className="mt-4 rounded-2xl border border-[#d7c69e] bg-[#fff8e9] p-4 text-sm leading-6 text-[#695631]">
            Hiện hệ thống vẫn ở chế độ staged: các migration customer-data và cờ thu dữ liệu production chưa bật, không có email hoặc SMS marketing thật được gửi từ phần này.
          </p>
        </section>
      </article>
    </main>
  );
}
