import Image from "next/image";
import { Reveal } from "@/components/shared/reveal";
import { RevealHeading } from "@/components/shared/reveal-heading";

type Language = "en" | "vi";

const copy = {
  vi: {
    eyebrow: "Mùa trăng tại Ninh Bình",
    title: "Một mùa Trung thu để mang về — và ở lại lâu hơn.",
    body: "Từ hộp bánh dành cho người thân đến một bàn tối bên hồ, Xuân Trường mở ra một cách mới để chạm vào Ninh Bình trong mùa trăng.",
    collectionLabel: "Seasonal collection",
    collectionTitle: "Bộ quà Xuân Trường",
    collectionBody: "Một đề xuất quà tặng lấy cảm hứng từ đá vôi, sen và ánh trăng của vùng Tràng An.",
    planningCta: "Lên hành trình Trung thu",
    routesCta: "Xem các hành trình sẵn có",
    servicesLabel: "Dịch vụ trong mùa",
    services: [
      {
        title: "Bộ quà mang về",
        body: "Mooncake collection là điểm khởi đầu cho một lời chào mùa trăng tại Xuân Trường.",
        image: "/images/campaigns/mid-autumn-2026/mooncake/mooncake-collection-01.webp",
      },
      {
        title: "Bàn tối dưới trăng",
        body: "Fine-dining và mâm bánh được đặt vào một buổi tối riêng tư, chậm rãi hơn nhịp tham quan ban ngày.",
        image: "/images/campaigns/mid-autumn-2026/mooncake/romantic-dining-set.webp",
      },
      {
        title: "Một điểm hẹn cho gia đình",
        body: "Gợi ý kết hợp hành trình di sản ban ngày với khoảnh khắc sum vầy khi đèn lên.",
        image: "/images/campaigns/mid-autumn-2026/mooncake/mooncake-collection-09.webp",
      },
    ],
    conceptEyebrow: "Collaboration concepts",
    conceptTitle: "Một lời mời gửi tới những nhà mốt cùng trân trọng thiên nhiên, thủ công và ký ức.",
    conceptBody: "Ninh Bình là nền cho những cuộc gặp gỡ có chủ đích: một capsule, một buổi giới thiệu riêng, hay một câu chuyện được kể đúng mùa.",
    conceptTag: "Đề xuất hợp tác",
    conceptNotice: "Các visual dưới đây là concept/đề xuất sáng tạo độc lập, không xác nhận quan hệ hợp tác hoặc tài trợ với các nhãn hàng được nêu.",
  },
  en: {
    eyebrow: "Mid-Autumn in Ninh Binh",
    title: "A Mid-Autumn season to take home — and linger in.",
    body: "From a mooncake gift for someone close to a dinner beside the water, Xuan Truong opens a new way to encounter Ninh Binh under the full moon.",
    collectionLabel: "Seasonal collection",
    collectionTitle: "The Xuan Truong collection",
    collectionBody: "A gift proposal shaped by limestone, lotus and the moonlight of Trang An.",
    planningCta: "Plan a Mid-Autumn escape",
    routesCta: "View ready-made routes",
    servicesLabel: "In-season experiences",
    services: [
      {
        title: "A gift to take home",
        body: "The mooncake collection becomes the opening gesture of a Mid-Autumn stay at Xuan Truong.",
        image: "/images/campaigns/mid-autumn-2026/mooncake/mooncake-collection-01.webp",
      },
      {
        title: "Dinner under the moon",
        body: "Fine dining and mooncakes are placed within a private evening that moves more slowly than the day route.",
        image: "/images/campaigns/mid-autumn-2026/mooncake/romantic-dining-set.webp",
      },
      {
        title: "A family rendezvous",
        body: "A suggestion to pair a heritage day with a gathering once the lanterns come on.",
        image: "/images/campaigns/mid-autumn-2026/mooncake/mooncake-collection-09.webp",
      },
    ],
    conceptEyebrow: "Collaboration concepts",
    conceptTitle: "An invitation to houses that share a respect for nature, craft and memory.",
    conceptBody: "Ninh Binh can hold an intentional meeting: a capsule, a private presentation, or a story told in its right season.",
    conceptTag: "Collaboration proposal",
    conceptNotice: "The visuals below are independent creative concepts and do not confirm a commercial partnership or sponsorship with the named brands.",
  },
} satisfies Record<Language, Record<string, unknown>>;

const brandConcepts = [
  { name: "Bottega Veneta", image: "/images/campaigns/mid-autumn-2026/brand-proposals/bottega-veneta-concept.webp" },
  { name: "Celine", image: "/images/campaigns/mid-autumn-2026/brand-proposals/celine-concept.webp" },
  { name: "Chanel", image: "/images/campaigns/mid-autumn-2026/brand-proposals/chanel-concept.webp" },
  { name: "Hermès", image: "/images/campaigns/mid-autumn-2026/brand-proposals/hermes-concept.webp" },
  { name: "Prada", image: "/images/campaigns/mid-autumn-2026/brand-proposals/prada-concept.webp" },
];

export function MidAutumnCampaign({ lang, source }: { lang: Language; source: string }) {
  const t = copy[lang];
  const planHref = `/plan?lang=${lang}&source=${encodeURIComponent(source || "mid-autumn-2026")}`;

  return (
    <section id="mid-autumn" data-customer-section="home-mid-autumn" className="overflow-hidden bg-[#17231f] py-16 text-[#FBFAF6] sm:py-24 lg:py-28">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="grid gap-8 lg:grid-cols-[0.92fr_1.08fr] lg:items-end">
          <Reveal>
            <p className="text-xs font-extrabold uppercase tracking-[0.28em] text-[#E7B96A]">{t.eyebrow as string}</p>
            <RevealHeading as="h2" text={t.title as string} className="font-display mt-5 max-w-2xl text-5xl leading-[0.96] sm:text-7xl" />
            <p className="mt-6 max-w-xl text-lg leading-8 text-white/72">{t.body as string}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a data-customer-track="mid-autumn-plan" data-customer-content-id="mid-autumn-seasonal-plan" data-customer-content-type="primary-cta" href={planHref} className="rounded-full bg-[#E7B96A] px-6 py-3 text-center font-semibold text-[#183F34] transition hover:bg-[#f0c87c]">
                {t.planningCta as string}
              </a>
              <a data-customer-track="mid-autumn-routes" data-customer-content-id="mid-autumn-routes" data-customer-content-type="secondary-cta" href="#curated-routes" className="rounded-full border border-white/30 px-6 py-3 text-center font-semibold text-white transition hover:bg-white/10">
                {t.routesCta as string}
              </a>
            </div>
          </Reveal>

          <Reveal delayMs={120} className="relative min-h-[460px] overflow-hidden rounded-[16px] border border-white/10 bg-[#21362e] shadow-2xl shadow-black/30 sm:min-h-[610px]">
            <Image src="/images/campaigns/mid-autumn-2026/mooncake/mooncake-collection-01.webp" alt={t.collectionTitle as string} fill sizes="(min-width: 1024px) 52vw, 100vw" className="object-cover" />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,17,13,.04),rgba(8,17,13,.78))]" />
            <div className="absolute inset-x-0 bottom-0 p-6 sm:p-9">
              <p className="text-xs font-extrabold uppercase tracking-[0.24em] text-[#E7B96A]">{t.collectionLabel as string}</p>
              <h3 className="font-display mt-3 text-4xl leading-none sm:text-5xl">{t.collectionTitle as string}</h3>
              <p className="mt-4 max-w-lg text-sm leading-6 text-white/76 sm:text-base sm:leading-7">{t.collectionBody as string}</p>
            </div>
          </Reveal>
        </div>

        <div className="mt-16 sm:mt-20">
          <Reveal>
            <p className="text-xs font-extrabold uppercase tracking-[0.28em] text-[#A8CEC1]">{t.servicesLabel as string}</p>
          </Reveal>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {(t.services as Array<{ title: string; body: string; image: string }>).map((service, index) => (
              <Reveal key={service.title} delayMs={index * 90}>
                <article className="group overflow-hidden rounded-[12px] border border-white/10 bg-white/[0.045]">
                  <div className="relative aspect-[4/5] overflow-hidden">
                    <Image src={service.image} alt={service.title} fill sizes="(min-width: 768px) 33vw, 100vw" className="object-cover transition duration-700 group-hover:scale-[1.035]" />
                    <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_36%,rgba(8,17,13,.84))]" />
                    <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6">
                      <p className="font-display text-3xl leading-none">{service.title}</p>
                      <p className="mt-3 text-sm leading-6 text-white/72">{service.body}</p>
                    </div>
                  </div>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto mt-20 max-w-7xl px-5 sm:mt-28 sm:px-8">
        <Reveal className="grid gap-6 border-t border-white/12 pt-12 lg:grid-cols-[0.82fr_1.18fr] lg:items-end">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.28em] text-[#E7B96A]">{t.conceptEyebrow as string}</p>
            <RevealHeading as="h2" text={t.conceptTitle as string} className="font-display mt-5 max-w-2xl text-4xl leading-[1.02] sm:text-6xl" />
          </div>
          <p className="max-w-2xl text-lg leading-8 text-white/68 lg:justify-self-end">{t.conceptBody as string}</p>
        </Reveal>
      </div>

      <div className="mt-10 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-4 sm:gap-5 sm:px-8 lg:px-[max(2rem,calc((100vw-80rem)/2+2rem))]">
        {brandConcepts.map((brand, index) => (
          <Reveal key={brand.name} delayMs={index * 70} className="w-[72vw] shrink-0 snap-center sm:w-[310px]">
            <article className="group relative aspect-[4/5] overflow-hidden rounded-[12px] border border-white/10 bg-[#21362e]">
              <Image src={brand.image} alt={`${brand.name} concept`} fill sizes="(min-width: 640px) 310px, 72vw" className="object-cover transition duration-700 group-hover:scale-[1.035]" />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_42%,rgba(8,17,13,.9))]" />
              <div className="absolute inset-x-0 bottom-0 p-5">
                <p className="text-[0.62rem] font-extrabold uppercase tracking-[0.22em] text-[#E7B96A]">{t.conceptTag as string}</p>
                <h3 className="font-display mt-2 text-3xl">{brand.name}</h3>
              </div>
            </article>
          </Reveal>
        ))}
      </div>
      <p className="mx-auto mt-5 max-w-7xl px-5 text-xs leading-5 text-white/48 sm:px-8">{t.conceptNotice as string}</p>
    </section>
  );
}
