import Link from "next/link";
import {
  getExperienceSurfaceAttributes,
  readPublicEnvironment,
} from "@/config/experience";
import { isCustomerBookingEnabled } from "@/lib/customer-data/booking-repository";
import { PlanExperience } from "@/components/journey/plan-experience";
import { SetupState } from "@/components/shared/setup-state";
import { DESTINATIONS } from "@/content/destinations";
import { NutNgonNgu } from "@/components/shared/nut-ngon-ngu";
import { NuiSuong } from "@/components/shared/nui-suong";
import { ch } from "@/lib/ngon-ngu";
import { docNgonNgu } from "@/lib/ngon-ngu-server";

export const metadata = {
  title: "Lập hành trình | Ninh Bình Journey",
  description:
    "Bạn kể mình muốn đi thế nào, chúng tôi dựng lịch trình Ninh Bình vừa giờ giấc, vừa sức đi bộ.",
  alternates: { canonical: "/plan" },
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function PlanPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const environment = readPublicEnvironment();
  if (environment.status === "missing") {
    return <SetupState environment={environment} surface="Journey builder" />;
  }

  // Đọc ngôn ngữ đúng cách trang chủ đang đọc (`app/page.tsx`): ưu tiên
  // `?lang=` trên đường dẫn, sau đó tới cookie `ninh-binh-lang` mà nút đổi
  // ngôn ngữ ngoài trang chủ đặt xuống. Mọi liên kết dẫn vào đây đều mang
  // sẵn `lang`, trước nay trang này bỏ qua nó.
  const params = (await searchParams) ?? {};
  const lang = await docNgonNgu(params);

  // "Thêm vào hành trình" ở trang điểm đến và trang Khám phá dẫn tới đây kèm
  // `?add=<mã điểm>`. Trước 27/09/2026 trang này không đọc tham số ấy: khách
  // bấm xong chỉ thấy một trang trống, điểm vừa chọn biến mất.
  const maDiem = firstParam(params.add);
  const diem = maDiem ? DESTINATIONS.find((d) => d.id === maDiem) : undefined;

  const surfaceAttributes = getExperienceSurfaceAttributes(environment, {
    customerBookingEnabled: isCustomerBookingEnabled(),
  });

  return (
    <main lang={lang}
      {...surfaceAttributes}
      className="min-h-screen bg-[#f4f0e7] text-[#151a17]"
    >
      <header className="border-b border-[#d7d5cd] bg-[#fbfaf6]">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
          <Link
            href="/"
            className="font-display text-lg tracking-[0.12em] text-[#183f34]"
          >
            NINH BÌNH
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href="/explore"
              className="rounded-full px-4 py-2 text-sm font-bold"
            >
              {ch(lang, "Khám phá", "Explore")}
            </Link>
            <NutNgonNgu lang={lang} />
          </div>
        </div>
      </header>
      <NuiSuong hat="lap-hanh-trinh" />
      <section data-customer-section="planner-builder" className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-14">
        <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-[#356957]">
          {ch(lang, "Lập hành trình", "Plan my day")}
        </p>
        <h1 className="font-display mt-4 max-w-5xl text-5xl leading-[0.96] text-[#183f34] sm:text-7xl">
          {ch(lang, "Lập lịch trình một ngày", "Plan a day in Ninh Binh")}
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-[#59654b]">
          {ch(
            lang,
            "Kể ngày bạn muốn đi: đi với ai, thích gì, đi bộ được bao nhiêu. Lịch xếp theo giờ mở cửa từng nơi và sức chân của cả nhóm.",
            "Tell us about your day: who comes along, what you like, how far you can walk. The plan follows each place's opening hours and the group's pace.",
          )}
        </p>
        <div className="mt-10">
          <PlanExperience
            lang={lang}
            diemMuonGhe={diem ? { id: diem.id, ten: diem.name[lang], mucDiBo: diem.mobilityLevel } : undefined}
            showDemoCommand={environment.config.voiceDemoFallbackEnabled}
            identityCollectionEnabled={
              process.env.CUSTOMER_IDENTITY_COLLECTION_ENABLED === "true"
            }
          />
        </div>
      </section>
    </main>
  );
}
