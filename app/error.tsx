"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="grid min-h-screen place-items-center bg-[#f4f0e7] p-6 text-[#151a17]">
      <section className="max-w-xl rounded-3xl border border-[#d7d5cd] bg-white p-8 text-center">
        <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#8a2f22]">
          Unable to load this view
        </p>
        <h1 className="font-display mt-3 text-4xl text-[#183f34]">
          Dữ liệu chưa thể đồng bộ.
        </h1>
        <p className="mt-4 leading-7 text-[#59654b]">
          Kiểm tra kết nối rồi thử lại. Không có thay đổi nào được xác nhận chỉ
          vì màn hình này báo lỗi.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-6 min-h-11 rounded-full bg-[#183f34] px-6 font-bold text-white"
        >
          Thử lại / Retry
        </button>
      </section>
    </main>
  );
}
