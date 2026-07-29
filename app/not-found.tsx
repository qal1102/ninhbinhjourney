import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#f4f0e7] p-6 text-[#151a17]">
      <section className="max-w-xl text-center">
        <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#356957]">
          404 · Not found
        </p>
        <h1 className="font-display mt-4 text-5xl text-[#183f34]">
          Không tìm thấy điểm dừng này.
        </h1>
        <p className="mt-4 leading-7 text-[#59654b]">
          Liên kết có thể đã hết hạn hoặc không thuộc phòng dữ liệu hiện tại.
        </p>
        <Link
          href="/explore"
          className="mt-6 inline-flex min-h-11 items-center rounded-full bg-[#183f34] px-6 font-bold text-white"
        >
          Khám phá / Explore
        </Link>
      </section>
    </main>
  );
}
