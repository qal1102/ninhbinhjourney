import Link from "next/link";
import { readPublicEnvironment } from "@/config/experience";
import { PlanExperience } from "@/components/journey/plan-experience";
import { SetupState } from "@/components/shared/setup-state";

export const metadata = {
  title: "Lập hành trình | Ninh Bình Journey",
  description:
    "Voice và text fallback cho lịch trình Ninh Bình có kiểm tra thời gian, đi bộ và khung giờ.",
};

export default function PlanPage() {
  const environment = readPublicEnvironment();
  if (environment.status === "missing") {
    return <SetupState environment={environment} surface="Journey builder" />;
  }

  return (
    <main className="min-h-screen bg-[#f4f0e7] text-[#151a17]">
      <header className="border-b border-[#d7d5cd] bg-[#fbfaf6]">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
          <Link
            href="/"
            className="font-display text-lg tracking-[0.12em] text-[#183f34]"
          >
            NINH BÌNH
          </Link>
          <Link
            href="/explore"
            className="rounded-full px-4 py-2 text-sm font-bold"
          >
            Khám phá
          </Link>
        </div>
      </header>
      <section className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-14">
        <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-[#356957]">
          Intent → rules → validated itinerary
        </p>
        <h1 className="font-display mt-4 max-w-5xl text-5xl leading-[0.96] text-[#183f34] sm:text-7xl">
          Một lịch trình biết giới hạn của nó.
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-[#59654b]">
          Ngôn ngữ giúp hiểu ý định; luật cấu hình quyết định thời gian, điểm
          đến, mức đi bộ và khả dụng. Bạn luôn xác nhận trước khi dữ liệu được
          lưu.
        </p>
        <div className="mt-10">
          <PlanExperience
            showDemoCommand={environment.config.voiceDemoFallbackEnabled}
          />
        </div>
      </section>
    </main>
  );
}
