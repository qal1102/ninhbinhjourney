"use client";

/** In hoặc lưu PDF bằng hộp thoại in của trình duyệt (chọn "Lưu dưới dạng PDF"). */
export function NutInTrang() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="min-h-11 rounded-xl bg-[#183f34] px-5 text-sm font-black text-white"
    >
      In / lưu PDF
    </button>
  );
}
