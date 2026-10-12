"use client";

import { usePathname, useRouter } from "next/navigation";

/**
 * Nút quay lại khi web được cài thành ứng dụng (12/10/2026, chủ dự án: "trên
 * PWA không có nút back nữa").
 *
 * Mở từ màn hình chính thì không còn thanh trình duyệt, iPhone cũng không có
 * nút lùi của hệ điều hành. Nút này chỉ hiện ở chế độ ứng dụng (CSS
 * `display-mode: standalone`, xem `globals.css`), nên trong trình duyệt thường
 * không thừa thêm nút nào. Không có trang trước trong ứng dụng thì về trang
 * gốc của khu vực ấy.
 */
export function NutQuayLaiApp({ veTrang, tone = "sang" }: { veTrang: string; tone?: "sang" | "toi" }) {
  const router = useRouter();
  const pathname = usePathname();
  if (pathname === veTrang) return null;
  return (
    <button
      type="button"
      aria-label="Quay lại"
      data-nut-quay-lai-app
      onClick={() => {
        if (window.history.length > 1) router.back();
        else router.push(veTrang);
      }}
      className={`nut-quay-lai-app h-11 w-11 shrink-0 items-center justify-center rounded-xl border text-xl font-black leading-none ${
        tone === "toi" ? "border-white/25 bg-white/10 text-white" : "border-[#ced8d1] bg-white text-[#183f34]"
      }`}
    >
      <span aria-hidden="true">‹</span>
    </button>
  );
}
