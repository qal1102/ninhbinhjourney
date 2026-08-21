import Image from "next/image";
import { Reveal } from "@/components/shared/reveal";
import { RevealHeading } from "@/components/shared/reveal-heading";

type Language = "en" | "vi";

const copy = {
  vi: {
    eyebrow: "Rằm tháng Tám · 25.09.2026",
    title: "Trăng lên trên dòng Ngô Đồng.",
    body: "Khi chuyến thuyền qua Hang Cả, Hang Hai, Hang Ba khép lại, mùa trăng bắt đầu theo một nhịp khác: một hộp bánh mang về, một bàn tối cho hai người, một buổi Ninh Bình còn lưu lại sau ngày đi.",
    collectionLabel: "Bộ quà mùa trăng 2026",
    collectionTitle: "Nguyệt Viên",
    collectionBody: "Ba cỡ hộp, từ một lời thăm hỏi nhỏ đến món quà dành cho gia đình và đối tác. Mức giá được đặt giữa phân khúc quà tặng địa phương và bộ sưu tập khách sạn năm sao.",
    planningCta: "Xem Bàn Trăng",
    routesCta: "Lên hành trình mùa trăng",
    servicesLabel: "Bốn lựa chọn cho mùa đoàn viên",
    services: [
      {
        kicker: "Hai bánh · hộp gọn",
        title: "Trăng Non",
        body: "Một món quà vừa đủ để mang theo sau chuyến Tam Cốc, dành cho người thân hoặc một lời cảm ơn giản dị.",
        price: "390.000 VND",
        image: "/images/campaigns/mid-autumn-2026/mooncake/mooncake-collection-01.webp",
      },
      {
        kicker: "Bốn bánh · trà tuyển chọn",
        title: "Trăng An",
        body: "Cỡ quà cân bằng cho gia đình và đối tác; đủ đầy mà không biến một lời chúc thành món quà phô trương.",
        price: "890.000 VND",
        image: "/images/campaigns/mid-autumn-2026/mooncake/mooncake-collection-05.webp",
      },
      {
        kicker: "Sáu bánh · trà · hộp lưu niệm",
        title: "Nguyệt Viên",
        body: "Bộ quà chủ đạo của mùa 2026, dành cho những cuộc gặp cần một dấu ấn trang trọng hơn.",
        price: "1.590.000 VND",
        image: "/images/campaigns/mid-autumn-2026/mooncake/mooncake-collection-09.webp",
      },
      {
        kicker: "19:00–21:30 · hai khách",
        title: "Bàn Trăng bên Ngô Đồng",
        body: "Một bàn tối theo mùa, trà và bánh dùng tại chỗ, rồi khép lại bằng hộp Trăng Non mang về. Giữ chỗ thật trên ERP; thanh toán vẫn là mô phỏng.",
        price: "2.480.000 VND / bàn",
        image: "/images/campaigns/mid-autumn-2026/mooncake/romantic-dining-set.webp",
        href: "/packages/ban-trang-tam-coc-2026?source=mid-autumn-2026",
        cta: "Xem lịch và giữ bàn",
      },
    ],
    conceptEyebrow: "Collaboration concepts",
    conceptTitle: "Một lời mời gửi tới những nhà mốt cùng trân trọng thiên nhiên, thủ công và ký ức.",
    conceptBody: "Ninh Bình là nền cho những cuộc gặp gỡ có chủ đích: một capsule, một buổi giới thiệu riêng, hay một câu chuyện được kể đúng mùa.",
    conceptTag: "Đề xuất hợp tác",
    conceptNotice: "Các visual dưới đây là concept/đề xuất sáng tạo độc lập, không xác nhận quan hệ hợp tác hoặc tài trợ với các nhãn hàng được nêu.",
  },
  en: {
    eyebrow: "The eighth lunar full moon · 25 September 2026",
    title: "Moonrise over the Ngo Dong River.",
    body: "Once the boat has passed Hang Ca, Hang Hai and Hang Ba, the evening finds another rhythm: a mooncake box to take home, a table for two, and a little of Ninh Binh that lingers beyond the journey.",
    collectionLabel: "Mid-Autumn collection 2026",
    collectionTitle: "Nguyet Vien",
    collectionBody: "Three gift formats, from a thoughtful gesture to a family or corporate presentation. The pricing sits between a regional premium gift and a five-star hotel collection.",
    planningCta: "Discover the Moon Table",
    routesCta: "Plan a moonlit journey",
    servicesLabel: "Four ways to mark the full moon",
    services: [
      {
        kicker: "Two cakes · compact box",
        title: "Trang Non",
        body: "A gift light enough to carry home from Tam Coc, made for family or a quiet word of thanks.",
        price: "VND 390,000",
        image: "/images/campaigns/mid-autumn-2026/mooncake/mooncake-collection-01.webp",
      },
      {
        kicker: "Four cakes · selected tea",
        title: "Trang An",
        body: "A balanced presentation for family and partners: generous, composed, and never needlessly grand.",
        price: "VND 890,000",
        image: "/images/campaigns/mid-autumn-2026/mooncake/mooncake-collection-05.webp",
      },
      {
        kicker: "Six cakes · tea · keepsake box",
        title: "Nguyet Vien",
        body: "The signature 2026 gift, intended for family gatherings and meetings that call for a more formal gesture.",
        price: "VND 1,590,000",
        image: "/images/campaigns/mid-autumn-2026/mooncake/mooncake-collection-09.webp",
      },
      {
        kicker: "7:00–9:30 pm · two guests",
        title: "Moon Table by the Ngo Dong",
        body: "A seasonal table, tea and mooncake at dinner, followed by a Trang Non box to take home. Capacity is held in the ERP; payment remains a simulation.",
        price: "VND 2,480,000 / table",
        image: "/images/campaigns/mid-autumn-2026/mooncake/romantic-dining-set.webp",
        href: "/packages/ban-trang-tam-coc-2026?source=mid-autumn-2026",
        cta: "View dates and hold a table",
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
  const dinnerHref = `/packages/ban-trang-tam-coc-2026?lang=${lang}&source=mid-autumn-2026`;

  return (
    <section id="mid-autumn" data-customer-section="home-mid-autumn" className="overflow-hidden bg-[#17231f] py-16 text-[#FBFAF6] sm:py-24 lg:py-28">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="grid gap-8 lg:grid-cols-[0.92fr_1.08fr] lg:items-end">
          <Reveal>
            <p className="text-xs font-extrabold uppercase tracking-[0.28em] text-[#E7B96A]">{t.eyebrow as string}</p>
            <RevealHeading as="h2" text={t.title as string} className="font-display mt-5 max-w-2xl text-5xl leading-[0.96] sm:text-7xl" />
            <p className="mt-6 max-w-xl text-lg leading-8 text-white/72">{t.body as string}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a data-customer-track="mid-autumn-dinner" data-customer-content-id="ban-trang-tam-coc-2026" data-customer-content-type="service" href={dinnerHref} className="rounded-full bg-[#E7B96A] px-6 py-3 text-center font-semibold text-[#183F34] transition hover:bg-[#f0c87c]">
                {t.planningCta as string}
              </a>
              <a data-customer-track="mid-autumn-plan" data-customer-content-id="mid-autumn-seasonal-plan" data-customer-content-type="secondary-cta" href={planHref} className="rounded-full border border-white/30 px-6 py-3 text-center font-semibold text-white transition hover:bg-white/10">
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
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {(t.services as Array<{ kicker: string; title: string; body: string; price: string; image: string; href?: string; cta?: string }>).map((service, index) => (
              <Reveal key={service.title} delayMs={index * 90}>
                <article className="group h-full overflow-hidden rounded-[12px] border border-white/10 bg-white/[0.045]">
                  <div className="relative aspect-[4/5] overflow-hidden">
                    <Image src={service.image} alt={service.title} fill sizes="(min-width: 768px) 33vw, 100vw" className="object-cover transition duration-700 group-hover:scale-[1.035]" />
                    <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_36%,rgba(8,17,13,.84))]" />
                    <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6">
                      <p className="text-[0.62rem] font-extrabold uppercase tracking-[0.2em] text-[#E7B96A]">{service.kicker}</p>
                      <p className="font-display text-3xl leading-none">{service.title}</p>
                      <p className="mt-3 text-sm leading-6 text-white/72">{service.body}</p>
                      <p className="mt-4 font-semibold text-[#F1D39D]">{service.price}</p>
                      {service.href && service.cta ? (
                        <a data-customer-track="mid-autumn-offer" data-customer-content-id="ban-trang-tam-coc-2026" data-customer-content-type="service" href={dinnerHref} className="mt-4 inline-flex border-b border-[#E7B96A] pb-1 text-sm font-bold text-white">
                          {service.cta} →
                        </a>
                      ) : null}
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
