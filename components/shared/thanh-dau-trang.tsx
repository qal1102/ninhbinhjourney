import Image from "next/image";
import Link from "next/link";
import { NutNgonNgu } from "@/components/shared/nut-ngon-ngu";
import type { NgonNgu } from "@/lib/ngon-ngu";

/**
 * Thanh đầu trang chung cho các trang làm việc của web khách: Khám phá, Lập
 * lịch, Gói, Đặt vé, Tra vé, Hộ chiếu, Thuyết minh, Hàng chờ, Quyền riêng tư.
 *
 * Soát 07/10/2026 đếm được năm kiểu đầu trang khác nhau; khách sang trang khác
 * là mất lối về các phần chính. Chủ dự án giao em tự quyết: ba trang ảnh lớn
 * (trang chủ, trang mùa, trang điểm đến) giữ đầu trang riêng vì là thiết kế
 * toàn màn có chủ đích; mọi trang còn lại dùng thanh này. Nút quay lại đúng cấp
 * của từng trang vẫn nằm ngay dưới, trong nội dung trang.
 */

export type MucDauTrang = "kham-pha" | "lap-lich" | "goi" | "mua" | "ve";

// `ngan`: nhãn trên điện thoại, để năm lối vừa một hàng 360px không phải vuốt.
const MUC: ReadonlyArray<{ id: MucDauTrang; href: string; vi: string; en: string; nganVi: string; nganEn: string }> = [
  { id: "kham-pha", href: "/explore", vi: "Khám phá", en: "Explore", nganVi: "Khám phá", nganEn: "Explore" },
  { id: "lap-lich", href: "/plan", vi: "Lập lịch", en: "Plan", nganVi: "Lập lịch", nganEn: "Plan" },
  { id: "goi", href: "/packages", vi: "Gói tham quan", en: "Packages", nganVi: "Gói", nganEn: "Tours" },
  { id: "mua", href: "/seasonal", vi: "Theo mùa", en: "Seasonal", nganVi: "Theo mùa", nganEn: "Seasons" },
  { id: "ve", href: "/tra-cuu-ve", vi: "Vé của tôi", en: "My tickets", nganVi: "Vé", nganEn: "Tickets" },
];

export function ThanhDauTrang({
  lang,
  hienTai,
  tone = "light",
  veTrangChu = "/",
  them,
  doiDuongDan,
}: {
  lang: NgonNgu;
  hienTai?: MucDauTrang;
  tone?: "light" | "dark";
  /** Đường về trang chủ, khi trang cần giữ `source` của lượt ghé. */
  veTrangChu?: string;
  /** Thứ nhỏ cạnh nút ngôn ngữ, ví dụ nhãn "Bản trình diễn". */
  them?: React.ReactNode;
  /** Giữ ngữ cảnh lượt ghé (`source`…) trên các lối chính, như trang Khám phá. */
  doiDuongDan?: (href: string) => string;
}) {
  const toi = tone === "dark";
  const chu = toi ? "text-white" : "text-[#183f34]";
  const muc = (dangO: boolean) =>
    `inline-flex min-h-10 shrink-0 items-center rounded-full px-2 text-sm font-bold transition min-[380px]:px-2.5 sm:px-3.5 ${
      dangO
        ? toi
          ? "bg-white/15 text-white"
          : "bg-[#183f34] text-white"
        : toi
          ? "text-white/80 hover:bg-white/10"
          : "text-[#183f34] hover:bg-[#e9e5da]"
    }`;
  const lienKet = MUC.map((m) => (
    <Link
      key={m.id}
      href={doiDuongDan ? doiDuongDan(m.href) : lang === "en" ? `${m.href}?lang=en` : m.href}
      aria-current={hienTai === m.id ? "page" : undefined}
      className={muc(hienTai === m.id)}
    >
      <span className="lg:hidden">{lang === "en" ? m.nganEn : m.nganVi}</span>
      <span className="hidden lg:inline">{lang === "en" ? m.en : m.vi}</span>
    </Link>
  ));

  return (
    <header
      data-thanh-dau-trang
      className={`border-b ${toi ? "border-white/15 bg-[#132f27]" : "border-[#d7d5cd] bg-[#fbfaf6]"}`}
    >
      {/* Một thanh điều hướng: máy tính nằm giữa hàng, điện thoại xuống hàng
          riêng và vuốt ngang được, không đẩy trang tràn ra. */}
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-2.5 sm:px-8">
        <Link href={veTrangChu} className={`inline-flex min-h-11 shrink-0 items-center gap-2.5 ${chu}`}>
          <Image src="/brand/ninh-binh-mark.png" alt="" width={32} height={32} className="h-8 w-8 rounded-full object-cover" />
          <span className="font-display text-lg tracking-[0.12em]">NINH BÌNH</span>
        </Link>
        <div className="flex shrink-0 items-center gap-2 lg:order-last">
          {them}
          <NutNgonNgu lang={lang} tone={tone} />
        </div>
        <nav
          aria-label={lang === "en" ? "Main sections" : "Các phần chính"}
          className="order-last -mx-1 flex w-full gap-0 overflow-x-auto min-[380px]:gap-0.5 sm:gap-1 pb-1 [scrollbar-width:none] lg:order-none lg:mx-0 lg:w-auto lg:pb-0"
        >
          {lienKet}
        </nav>
      </div>
    </header>
  );
}
