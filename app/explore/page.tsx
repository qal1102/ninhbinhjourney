import Link from "next/link";
import { ExploreExperience } from "@/components/discovery/explore-experience";
import { readPublicEnvironment } from "@/config/experience";

export const metadata = {
  title: "Khám phá Ninh Bình | Ninh Bình Journey",
  description:
    "Bản đồ và danh sách đi cùng nhau: lọc theo thời gian, mức đi bộ và nhóm khách.",
};

export default function ExplorePage() {
  const environment = readPublicEnvironment();
  const clientDemo =
    environment.status === "ready" &&
    environment.config.mode === "client-demo";
  return (
    <main className="min-h-screen bg-[#f4f0e7] text-[#151a17]">
      <header className="border-b border-[#d7d5cd] bg-[#fbfaf6]">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <Link
            href="/"
            className="font-display text-lg tracking-[0.12em] text-[#183f34]"
          >
            NINH BÌNH
          </Link>
          <nav className="flex items-center gap-2 text-sm font-bold">
            <Link href="/plan" className="rounded-full px-4 py-2">
              Lập hành trình / Plan
            </Link>
            {clientDemo ? (
              <span className="hidden rounded-full bg-[#e8dfcf] px-3 py-1 text-xs text-[#5f593f] sm:inline-flex">
                Client demonstration
              </span>
            ) : null}
          </nav>
        </div>
      </header>
      <section className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-14">
        <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-[#356957]">
          Khám phá Ninh Bình
        </p>
        <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_0.7fr] lg:items-end">
          <h1 className="font-display text-5xl leading-[0.98] text-[#183f34] sm:text-7xl">
            Chọn nhịp đi,
            <br />
            không chỉ chọn điểm.
          </h1>
          <p className="max-w-xl text-lg leading-8 text-[#59654b]">
            Lọc theo thời gian, mức đi bộ và nhóm khách. Bản đồ dùng lớp ngữ
            cảnh local, không hiển thị ranh giới quốc gia và vẫn dùng được khi
            tile mạng không khả dụng.
          </p>
        </div>
        <div className="mt-10">
          <ExploreExperience />
        </div>
      </section>
    </main>
  );
}
