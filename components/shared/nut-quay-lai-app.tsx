"use client";

/**
 * Nút quay lại khi web được cài thành ứng dụng (12/10/2026, chủ dự án: "trên
 * PWA không có nút back nữa").
 *
 * Mở từ màn hình chính thì không còn thanh trình duyệt, iPhone cũng không có
 * nút lùi của hệ điều hành. Nút này chỉ hiện ở chế độ ứng dụng (CSS
 * `display-mode: standalone`, xem `globals.css`), nên trong trình duyệt thường
 * không thừa thêm nút nào. Không có trang trước trong ứng dụng, hay đang ở
 * chính trang gốc, thì về trang gốc của khu vực ấy.
 *
 * Không dùng hook của router: thanh đầu trang này còn được dựng ở những nơi
 * không có App Router (bài kiểm dựng trang tĩnh).
 */
export function NutQuayLaiApp({ veTrang, tone = "sang" }: { veTrang: string; tone?: "sang" | "toi" }) {
  return (
    <button
      type="button"
      aria-label="Quay lại"
      data-nut-quay-lai-app
      onClick={() => {
        if (window.location.pathname !== veTrang && window.history.length > 1) window.history.back();
        else if (window.location.pathname !== veTrang) window.location.assign(veTrang);
      }}
      className={`nut-quay-lai-app h-11 w-11 shrink-0 items-center justify-center rounded-xl border text-xl font-black leading-none ${
        tone === "toi" ? "border-white/25 bg-white/10 text-white" : "border-[#ced8d1] bg-white text-[#183f34]"
      }`}
    >
      <span aria-hidden="true">‹</span>
    </button>
  );
}
