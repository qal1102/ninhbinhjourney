import { HoSoKhachView } from "@/components/commerce/ho-so-khach-view";
import type { HoSoKhach } from "@/domain/ho-so-khach";

/**
 * "Khách thấy gì" — cho giám đốc đứng ở chỗ khách khi trình diễn.
 *
 * Bên trái: lối mở từng màn hình khách sẽ gặp, theo đúng thứ tự một chuyến
 * đi. Bên phải: hộ chiếu của một khách thật đặt trong khung điện thoại, dựng
 * bằng chính thành phần trang /ho-so đang dùng, nên thấy gì ở đây là khách
 * thấy y như vậy.
 */

const CAC_MAN_HINH = [
  { buoc: "1", ten: "Trang chủ", moTa: "Khách quét QR ở bến, ở khách sạn thì vào đây.", href: "/" },
  { buoc: "2", ten: "Chọn gói và giữ chỗ", moTa: "Chọn ngày, giờ, số khách; giữ chỗ 15 phút.", href: "/packages" },
  { buoc: "3", ten: "Quét QR thanh toán", moTa: "Mã QR hiện ra sau khi giữ chỗ; quét là xong.", href: "/checkout?package=heritage-day" },
  { buoc: "4", ten: "Tra cứu vé", moTa: "Mất trang thì mở lại vé bằng mã đặt chỗ và số điện thoại.", href: "/tra-cuu-ve" },
  { buoc: "5", ten: "Hộ chiếu Ninh Bình", moTa: "Nơi đã qua cổng, nhiệm vụ và quà cho chuyến sau.", href: "/ho-so" },
] as const;

export function KhachThayGi({ hoSo, maKhach }: { hoSo: HoSoKhach | null; maKhach: string | null }) {
  return (
    <section id="khach-thay-gi" data-testid="khach-thay-gi" className="mt-6 rounded-3xl border border-[#dfe4dc] bg-white p-5 sm:p-7">
      <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#557568]">Khách thấy gì</p>
      <h2 className="mt-2 text-2xl font-black text-[#20342c]">Đứng ở chỗ khách mà xem</h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-[#5f7068]">
        Năm màn hình một khách gặp từ lúc quét mã tới lúc nhận quà. Bấm để mở đúng trang khách thấy, ở thẻ mới.
      </p>
      <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
        <ol className="grid content-start gap-3">
          {CAC_MAN_HINH.map((m) => (
            <li key={m.buoc}>
              <a
                href={m.href}
                target="_blank"
                rel="noopener"
                className="flex min-h-14 items-start gap-3 rounded-2xl border border-[#e2e7e0] p-3 hover:border-[#35594b]"
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#183f34] text-sm font-black text-[#e7c78d]">{m.buoc}</span>
                <span>
                  <span className="block font-bold text-[#20342c]">{m.ten}</span>
                  <span className="block text-sm text-[#5f7068]">{m.moTa}</span>
                </span>
              </a>
            </li>
          ))}
        </ol>
        <div>
          <p className="text-sm font-bold text-[#20342c]">
            Hộ chiếu của khách {maKhach ? maKhach.slice(0, 8) : ""} trên điện thoại
          </p>
          <div className="mx-auto mt-3 max-w-[400px] rounded-[2.2rem] border-[10px] border-[#1d2521] bg-[#f4f0e7] shadow-[0_20px_50px_rgba(0,0,0,0.18)]">
            <div className="max-h-[720px] overflow-y-auto rounded-[1.6rem] p-3">
              {hoSo ? (
                <HoSoKhachView hoSo={hoSo} xemThu />
              ) : (
                <p className="p-6 text-sm leading-6 text-[#59654b]">
                  Chưa có khách nào đặt chỗ trên web, nên chưa có hộ chiếu để xem. Đặt thử một vé ở bước 2 là hộ chiếu hiện ra ở đây.
                </p>
              )}
            </div>
          </div>
          <p className="mt-3 text-xs leading-5 text-[#6b786f]">
            Muốn xem khách khác, bấm &ldquo;Xem như khách&rdquo; ở dòng đơn tương ứng phía trên.
          </p>
        </div>
      </div>
    </section>
  );
}
