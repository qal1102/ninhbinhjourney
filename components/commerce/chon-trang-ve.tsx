import Link from "next/link";

/**
 * Hai thẻ chọn đầu mục "Vé của tôi" (13/10/2026). Chủ dự án: khách gắn số
 * xong phải thấy được lượt đi và quà ngay trên web, mà lối sang Hộ chiếu chỉ
 * là một dòng chữ nhỏ giữa trang tra vé. Thanh đầu trang đã đủ năm lối ở
 * 360px, nên tách ngay trong mục Vé. Thẻ thứ ba (13/10) là sổ dấu.
 */
export function ChonTrangVe({ dangO, lang = "vi" }: { dangO: "ve" | "luot" | "dau"; lang?: "vi" | "en" }) {
  const t = (vi: string, en: string) => (lang === "en" ? en : vi);
  const duoi = lang === "en" ? "?lang=en" : "";
  const the = [
    { id: "ve", href: `/tra-cuu-ve${duoi}`, ten: t("Lấy lại vé QR", "Reopen QR ticket"), phu: t("Vé đặt trên web", "Web bookings") },
    { id: "luot", href: `/ho-so${duoi}`, ten: t("Lượt đi & quà", "Visits & rewards"), phu: t("Tra bằng số điện thoại", "Look up by phone") },
    // 13/10: sổ dấu không cần đăng nhập, quét mã QR ở từng điểm.
    { id: "dau", href: `/so-dau${duoi}`, ten: t("Sổ dấu", "Stamps"), phu: t("Quét QR ở từng điểm", "Scan QR at each site") },
  ] as const;
  return (
    <nav aria-label={t("Vé đã mua", "My tickets")} className="mx-auto mb-6 grid max-w-3xl grid-cols-3 gap-1 rounded-2xl bg-[#e6e0d2] p-1">
      {the.map((muc) => {
        const chon = muc.id === dangO;
        return (
          <Link
            key={muc.id}
            href={muc.href}
            aria-current={chon ? "page" : undefined}
            data-testid={`chon-trang-ve-${muc.id}`}
            className={`flex min-h-14 flex-col justify-center rounded-xl px-3 py-2 text-center transition-colors motion-reduce:transition-none ${
              chon ? "bg-[#183f34] text-white shadow-sm" : "text-[#183f34] hover:bg-white/70"
            }`}
          >
            <span className="text-sm font-extrabold leading-tight sm:text-base">{muc.ten}</span>
            <span className={`mt-0.5 text-xs leading-tight ${chon ? "text-white/75" : "text-[#5c665f]"}`}>{muc.phu}</span>
          </Link>
        );
      })}
    </nav>
  );
}
