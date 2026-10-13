"use client";

/** Nút in cả trang (tấm dán QR…); khối có `print:hidden` không ra giấy. */
export function NutInTrang({ nhan }: { nhan: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex min-h-11 items-center rounded-xl bg-[#183f34] px-4 text-sm font-black text-white transition hover:bg-[#12332a]"
    >
      {nhan}
    </button>
  );
}
