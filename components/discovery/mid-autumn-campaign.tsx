import Image from "next/image";
import { Reveal } from "@/components/shared/reveal";
import { RevealHeading } from "@/components/shared/reveal-heading";
import {
  SeasonalExperienceBrowser,
  type SeasonalGroup,
} from "@/components/discovery/seasonal-experience-browser";

type Language = "en" | "vi";

const campaign = {
  vi: {
    eyebrow: "Rằm tháng Tám · 25.09.2026",
    title: "Trăng lên trên dòng Ngô Đồng.",
    body: "Trung thu năm nay ở Tam Cốc có bàn tối bên sông, có quà mang về, có chuyến đi cho hai người.",
    primaryCta: "Khám phá theo dịp",
    planningCta: "Lên hành trình mùa trăng",
    collectionLabel: "Bộ quà mùa trăng 2026",
    collectionTitle: "Nguyệt Viên",
    collectionBody: "Bánh và trà làm ở địa phương, đóng hộp gọn để mang về, biếu gia đình hoặc tặng đối tác.",
    browser: {
      explore: "Khám phá mùa trăng theo dịp",
      openDetail: "Mở chi tiết",
      close: "Đóng",
      fromPrice: "Từ",
      actions: {
        booking: "Xem lịch và giữ chỗ",
        contact: "Mở lời kết nối",
        gift: "Hỏi về bộ quà",
        planning: "Đưa vào hành trình",
      },
      call: "Gọi tư vấn",
      email: "Gửi email",
      contactNote: "Xuân Trường gọi lại để chốt ngày, số người và cách làm trước khi bắt tay vào việc",
      conceptLabel: "Ý tưởng mở",
      conceptNotice: "Đây là ý tưởng để mở lời trao đổi. Hiện chưa có hợp tác hay tài trợ nào được ký.",
      editorialLabel: "Biên tập · 2026",
      editorialNotice: "Bộ ảnh ý tưởng cho hồ sơ mời hợp tác thương hiệu · Ninh Bình 2026.",
      selectStory: "Chọn câu chuyện",
      previousStory: "Câu chuyện trước",
      nextStory: "Câu chuyện tiếp theo",
      galleryLabel: "Các khung hình",
      bookingClosedBadge: "Đã khép mùa 2026",
      bookingClosedTitle: "Bàn Trăng đã đóng, hẹn Trung thu 2027",
      bookingClosedReason:
        "Bàn Trăng chỉ giữ chỗ 18–27/09/2026; mốc này đã qua nên không giữ bàn được nữa.",
      bookingClosedCta: "Xem các gói đang mở",
    },
    groups: [
      {
        id: "moon-gifts",
        eyebrow: "Quà mùa trăng",
        title: "Quà Trung thu mang về từ Ninh Bình",
        body: "Có ba cỡ hộp, từ hộp nhỏ biếu người thân tới bộ quà tặng đối tác. Thiệp, số lượng và cách giao hàng đều trao đổi thêm được.",
        ratio: "portrait",
        layout: "catalog",
        items: [
          {
            id: "trang-non",
            kicker: "Hai bánh · hộp gọn",
            title: "Trăng Non",
            body: "Hộp nhỏ dễ xách theo sau chuyến Tam Cốc, để biếu người thân hay gửi lời cảm ơn.",
            image: "/images/campaigns/mid-autumn-2026/experiences/mooncake-editorial-hero.webp",
            price: "390.000 VND",
            action: "gift",
          },
          {
            id: "trang-an",
            kicker: "Bốn bánh · trà tuyển chọn",
            title: "Trăng An",
            body: "Cỡ vừa, hợp biếu gia đình hoặc tặng đối tác.",
            image: "/images/campaigns/mid-autumn-2026/experiences/mooncake-gift-box.webp",
            price: "890.000 VND",
            action: "gift",
          },
          {
            id: "nguyet-vien",
            kicker: "Sáu bánh · trà · hộp lưu niệm",
            title: "Nguyệt Viên",
            body: "Bộ quà lớn nhất mùa 2026, dành cho những dịp cần trang trọng.",
            image: "/images/campaigns/mid-autumn-2026/experiences/mooncake-flavour-guide.webp",
            price: "1.590.000 VND",
            action: "gift",
          },
        ],
      },
      {
        id: "dining",
        eyebrow: "Bàn tối & ẩm thực",
        title: "Ăn tối giữa cảnh núi sông",
        body: "Có bàn riêng cho hai người trên sông, có tiệc nhỏ bên hồ cho cả nhóm. Mỗi lựa chọn mở theo ngày và số khách.",
        ratio: "landscape",
        layout: "feature",
        items: [
          {
            id: "moon-table-ngo-dong",
            kicker: "19:00–21:30 · hai khách",
            title: "Bàn Trăng bên Ngô Đồng",
            body: "Bữa tối món theo mùa, trà và bánh dùng tại chỗ, về còn được tặng một hộp Trăng Non.",
            image: "/images/campaigns/mid-autumn-2026/experiences/moonlit-river-table.webp",
            price: "2.480.000 VND / bàn",
            action: "booking",
            href: "/packages/ban-trang-tam-coc-2026?lang=vi&source=mid-autumn-2026",
          },
          {
            id: "golden-hour-table",
            kicker: "Hoàng hôn · thực đơn theo mùa",
            title: "Bữa tối giữa sắc vàng Tam Cốc",
            body: "Ăn tối lúc hoàng hôn, món nấu từ rau trái địa phương.",
            image: "/images/campaigns/mid-autumn-2026/experiences/seasonal-dining-sunset.webp",
            action: "contact",
          },
          {
            id: "waterfront-feast",
            kicker: "Nhóm riêng · theo quy mô",
            title: "Tiệc nhỏ bên mặt nước",
            body: "Cho gia đình, nhóm bạn hay một buổi gặp mặt cần chỗ riêng, có người phục vụ từ đầu tới cuối.",
            image: "/images/campaigns/mid-autumn-2026/experiences/waterfront-feast.webp",
            action: "contact",
          },
          {
            id: "mountain-symphony-dinner",
            kicker: "Ẩm thực · âm nhạc · cảnh quan",
            title: "Bữa tối có nhạc sống",
            body: "Ý tưởng bữa tối ngoài trời có ban nhạc chơi sống, bàn đặt dưới chân núi đá.",
            image: "/images/campaigns/mid-autumn-2026/experiences/mountain-symphony-dinner.webp",
            action: "contact",
            concept: true,
          },
        ],
      },
      {
        id: "nights",
        eyebrow: "Lễ hội & đêm diễn",
        title: "Ý tưởng cho mùa lễ hội",
        body: "Mấy ý tưởng còn đang phác thảo: trình diễn ánh sáng, nhạc, hoa và múa địa phương. Ý nào cũng cần bàn thêm với địa phương, nghệ sĩ và đối tác.",
        ratio: "landscape",
        layout: "stories",
        items: [
          {
            id: "lotus-drone-show",
            kicker: "Bầu trời đêm · hoa sen",
            title: "Sen nở trên trời Ninh Bình",
            body: "Màn trình diễn drone vẽ hình hoa sen nở và dòng nước chảy trên bầu trời đêm.",
            image: "/images/campaigns/mid-autumn-2026/experiences/lotus-drone-show.webp",
            action: "contact",
            concept: true,
          },
          {
            id: "cliff-light-show",
            kicker: "Ánh sáng · vách núi",
            title: "Dấu thời gian trên đá",
            body: "Chiếu ánh sáng lên vách núi, kể chuyện núi đá hình thành và các triều vua ở Hoa Lư.",
            image: "/images/campaigns/mid-autumn-2026/experiences/cliff-light-show.webp",
            action: "contact",
            concept: true,
          },
          {
            id: "traditional-dance-night",
            kicker: "Vũ điệu · âm nhạc bản địa",
            title: "Nhịp di sản",
            body: "Đêm diễn múa dựa trên điệu múa truyền thống, khán giả ngồi gần sân khấu.",
            image: "/images/campaigns/mid-autumn-2026/experiences/traditional-dance-night.webp",
            action: "contact",
            concept: true,
          },
          {
            id: "flower-festival",
            kicker: "Mùa hoa · đường dạo",
            title: "Lối hoa giữa miền di sản",
            body: "Lối đi bộ trồng hoa theo mùa, dọc đường có gian hàng thủ công và chỗ cho trẻ con chơi.",
            image: "/images/campaigns/mid-autumn-2026/experiences/flower-festival.webp",
            action: "contact",
            concept: true,
          },
        ],
      },
      {
        id: "private-moments",
        eyebrow: "Những dịp riêng",
        title: "Dịp riêng của bạn",
        body: "Một đêm cắm trại, một bộ ảnh cưới, hay một buổi dạo đêm. Bạn kể mình muốn gì, chúng tôi lên lịch trình riêng.",
        ratio: "landscape",
        layout: "mosaic",
        items: [
          {
            id: "heritage-glamping",
            kicker: "Cắm trại · trời sao",
            title: "Một đêm ngoài hiên núi",
            body: "Ngủ lại một đêm trong lều giữa núi, có bữa tối nhẹ, sáng dậy thong thả.",
            image: "/images/campaigns/mid-autumn-2026/experiences/heritage-glamping.webp",
            action: "planning",
            concept: true,
          },
          {
            id: "heritage-wedding",
            kicker: "Ảnh cưới · địa điểm riêng",
            title: "Chụp ảnh cưới ở Ninh Bình",
            body: "Chúng tôi đi xem trước địa điểm, chọn giờ có nắng đẹp và tìm ekip chụp cho bạn.",
            image: "/images/campaigns/mid-autumn-2026/experiences/heritage-wedding.webp",
            action: "contact",
            concept: true,
          },
          {
            id: "heritage-walking-path",
            kicker: "Đường dạo · sau hoàng hôn",
            title: "Đi dạo sau hoàng hôn",
            body: "Buổi tối đi bộ nhẹ nhàng từ chỗ ăn tối qua phố cổ tới điểm ngắm cảnh.",
            image: "/images/campaigns/mid-autumn-2026/experiences/heritage-walking-path.webp",
            action: "planning",
            concept: true,
          },
        ],
      },
      {
        id: "collaborations",
        eyebrow: "Hợp tác",
        title: "Mời hợp tác cùng Ninh Bình",
        body: "Dành cho thương hiệu, nhà sáng tạo và doanh nghiệp muốn làm một sản phẩm, một sự kiện hay một chiến dịch gắn với Ninh Bình.",
        ratio: "landscape",
        layout: "index",
        items: [
          {
            id: "international-gathering",
            kicker: "Gặp gỡ quốc tế · kết nối địa phương",
            title: "Hội thảo, gặp mặt quốc tế",
            body: "Chỗ tổ chức hội thảo, gặp mặt cho khách quốc tế, có người lo đón tiếp và dẫn đi tham quan.",
            image: "/images/campaigns/mid-autumn-2026/experiences/international-gathering.webp",
            action: "contact",
            concept: true,
          },
          {
            id: "destination-photoshoot",
            kicker: "Biên tập hình ảnh · sản xuất tại điểm đến",
            title: "Quay phim, chụp ảnh tại Ninh Bình",
            body: "Tìm bối cảnh, xin phép và lo hậu cần cho đoàn quay quảng cáo hoặc chụp bộ sưu tập.",
            image: "/images/campaigns/mid-autumn-2026/experiences/destination-photoshoot.webp",
            action: "contact",
            concept: true,
          },
          {
            id: "ninh-binh-fragrance",
            kicker: "Hương thơm · ký ức điểm đến",
            title: "Nước hoa mùi sen Ninh Bình",
            body: "Ý tưởng cùng làm một mùi hương lấy cảm hứng từ sen và đầm nước Ninh Bình.",
            image: "/images/campaigns/mid-autumn-2026/experiences/ninh-binh-fragrance.webp",
            action: "contact",
            concept: true,
          },
          {
            id: "local-gift-atelier",
            kicker: "Thủ công · quà tặng doanh nghiệp",
            title: "Xưởng quà từ Ninh Bình",
            body: "Chúng tôi tìm sản vật, nghệ nhân và người thiết kế để làm bộ quà tặng doanh nghiệp.",
            image: "/images/campaigns/mid-autumn-2026/experiences/local-gift-atelier.webp",
            action: "contact",
            concept: true,
          },
        ],
      },
    ] satisfies SeasonalGroup[],
  },
  en: {
    eyebrow: "The eighth lunar full moon · 25 September 2026",
    title: "Moonrise over the Ngo Dong River.",
    body: "This Mid-Autumn season holds more than a box of cakes: a river table, a night performance among limestone peaks, a journey for two, or an idea made tangible together.",
    primaryCta: "Explore by occasion",
    planningCta: "Plan a moonlit journey",
    collectionLabel: "Mid-Autumn collection 2026",
    collectionTitle: "Nguyet Vien",
    collectionBody: "Local flavours in a composed presentation — to carry home, share with family, or offer as a thoughtful greeting to a partner.",
    browser: {
      explore: "Explore the season by occasion",
      openDetail: "Open details",
      close: "Close",
      fromPrice: "From",
      actions: {
        booking: "View dates and hold a table",
        contact: "Start a conversation",
        gift: "Enquire about this gift",
        planning: "Add to my journey",
      },
      call: "Call the team",
      email: "Send an email",
      contactNote: "The Xuan Truong team will confirm timing, scale and the most suitable arrangement before delivery",
      conceptLabel: "Open concept",
      conceptNotice: "This is an independent creative proposal intended to begin a conversation; it does not announce an established commercial partnership or sponsorship.",
      editorialLabel: "Editorial · 2026",
      editorialNotice: "An independent editorial series for brand outreach · Ninh Binh 2026.",
      selectStory: "Select story",
      previousStory: "Previous story",
      nextStory: "Next story",
      galleryLabel: "Campaign frames",
      bookingClosedBadge: "2026 season closed",
      bookingClosedTitle: "Moon Table closed — see you in 2027",
      bookingClosedReason:
        "The Moon Table only held bookings 18–27 Sep 2026; that window has now passed.",
      bookingClosedCta: "Browse open packages",
    },
    groups: [
      {
        id: "moon-gifts",
        eyebrow: "Gifts of the moon",
        title: "A little of Ninh Binh to take home.",
        body: "Three gift formats, from a quiet gesture to a family or corporate presentation. Cards, quantities and collection can be arranged with the team.",
        ratio: "portrait",
        layout: "catalog",
        items: [
          { id: "trang-non", kicker: "Two cakes · compact box", title: "Trang Non", body: "A thoughtful gift light enough to carry home from Tam Coc.", image: "/images/campaigns/mid-autumn-2026/experiences/mooncake-editorial-hero.webp", price: "VND 390,000", action: "gift" },
          { id: "trang-an", kicker: "Four cakes · selected tea", title: "Trang An", body: "A balanced presentation for family and partners: generous, composed and never needlessly grand.", image: "/images/campaigns/mid-autumn-2026/experiences/mooncake-gift-box.webp", price: "VND 890,000", action: "gift" },
          { id: "nguyet-vien", kicker: "Six cakes · tea · keepsake box", title: "Nguyet Vien", body: "The signature 2026 gift for gatherings that call for a more formal gesture.", image: "/images/campaigns/mid-autumn-2026/experiences/mooncake-flavour-guide.webp", price: "VND 1,590,000", action: "gift" },
        ],
      },
      {
        id: "dining",
        eyebrow: "Tables & dining",
        title: "When the landscape becomes part of dinner.",
        body: "From a private river table to a gathering by the lake, each experience begins with a date, a party size and the rhythm of your journey.",
        ratio: "landscape",
        layout: "feature",
        items: [
          { id: "moon-table-ngo-dong", kicker: "7:00–9:30 pm · two guests", title: "Moon Table by the Ngo Dong", body: "A seasonal dinner, tea and mooncake at the table, followed by a Trang Non box to take home.", image: "/images/campaigns/mid-autumn-2026/experiences/moonlit-river-table.webp", price: "VND 2,480,000 / table", action: "booking", href: "/packages/ban-trang-tam-coc-2026?lang=en&source=mid-autumn-2026" },
          { id: "golden-hour-table", kicker: "Golden hour · seasonal menu", title: "Dinner in the Tam Coc light", body: "A slow table where local produce and the final light of day tell one story.", image: "/images/campaigns/mid-autumn-2026/experiences/seasonal-dining-sunset.webp", action: "contact" },
          { id: "waterfront-feast", kicker: "Private group · arranged to scale", title: "A gathering by the water", body: "For families, friends or an intimate meeting in need of its own setting and considered service.", image: "/images/campaigns/mid-autumn-2026/experiences/waterfront-feast.webp", action: "contact" },
          { id: "mountain-symphony-dinner", kicker: "Food · music · landscape", title: "A symphony between earth and sky", body: "An open idea for a dinner with live music among the limestone silhouettes of Ninh Binh.", image: "/images/campaigns/mid-autumn-2026/experiences/mountain-symphony-dinner.webp", action: "contact", concept: true },
        ],
      },
      {
        id: "nights",
        eyebrow: "Festivals & nights",
        title: "Heritage, seen in another light.",
        body: "Open sketches for light, music, flowers and local performance — ready to be developed with communities, artists and partners.",
        ratio: "landscape",
        layout: "stories",
        items: [
          { id: "lotus-drone-show", kicker: "Night sky · lotus", title: "Lotus over Ninh Binh", body: "A drone performance shaped by the movement of lotus petals and water.", image: "/images/campaigns/mid-autumn-2026/experiences/lotus-drone-show.webp", action: "contact", concept: true },
          { id: "cliff-light-show", kicker: "Light · limestone", title: "Time written on stone", body: "A light-led story of geology, history and memory across the natural landscape.", image: "/images/campaigns/mid-autumn-2026/experiences/cliff-light-show.webp", action: "contact", concept: true },
          { id: "traditional-dance-night", kicker: "Dance · local music", title: "Rhythms of heritage", body: "Traditional movement reimagined in a contemporary setting close to its audience.", image: "/images/campaigns/mid-autumn-2026/experiences/traditional-dance-night.webp", action: "contact", concept: true },
          { id: "flower-festival", kicker: "Seasonal flowers · promenade", title: "A garden through heritage", body: "A seasonal walking landscape connecting craft, nature and moments for families.", image: "/images/campaigns/mid-autumn-2026/experiences/flower-festival.webp", action: "contact", concept: true },
        ],
      },
      {
        id: "private-moments",
        eyebrow: "Private occasions",
        title: "A day belonging only to those present.",
        body: "A night under the stars, a wedding portrait or an evening walk can begin as a wish and become a journey of its own.",
        ratio: "landscape",
        layout: "mosaic",
        items: [
          { id: "heritage-glamping", kicker: "Camp · night sky", title: "A night beneath the peaks", body: "A short stay in nature with a light dinner and an unhurried morning.", image: "/images/campaigns/mid-autumn-2026/experiences/heritage-glamping.webp", action: "planning", concept: true },
          { id: "heritage-wedding", kicker: "Wedding portrait · private setting", title: "A promise among the karsts", body: "Location scouting, timing and local production for imagery that remains true to Ninh Binh.", image: "/images/campaigns/mid-autumn-2026/experiences/heritage-wedding.webp", action: "contact", concept: true },
          { id: "heritage-walking-path", kicker: "Promenade · after sunset", title: "A walk through light", body: "An easy evening route connecting dinner, the old town and a final view in one journey.", image: "/images/campaigns/mid-autumn-2026/experiences/heritage-walking-path.webp", action: "planning", concept: true },
        ],
      },
      {
        id: "collaborations",
        eyebrow: "Create together",
        title: "Ninh Binh is an open invitation.",
        body: "For brands, makers, businesses and communities ready to create a product, a gathering or a story rooted in this place.",
        ratio: "landscape",
        layout: "index",
        items: [
          { id: "international-gathering", kicker: "International exchange · local connection", title: "A round table in heritage", body: "A considered setting for international conversations that need local depth and a distinctive welcome.", image: "/images/campaigns/mid-autumn-2026/experiences/international-gathering.webp", action: "contact", concept: true },
          { id: "destination-photoshoot", kicker: "Editorial · destination production", title: "Ninh Binh in a new frame", body: "Locations, production and local narratives for an editorial campaign or collection.", image: "/images/campaigns/mid-autumn-2026/experiences/destination-photoshoot.webp", action: "contact", concept: true },
          { id: "ninh-binh-fragrance", kicker: "Scent · memory of place", title: "A fragrance of Ninh Binh", body: "A co-creation beginning with lotus, limestone, water and the memory of a journey.", image: "/images/campaigns/mid-autumn-2026/experiences/ninh-binh-fragrance.webp", action: "contact", concept: true },
          { id: "local-gift-atelier", kicker: "Craft · corporate gifting", title: "The Ninh Binh gift atelier", body: "One point of connection for produce, makers and design to become a gift with a clear story.", image: "/images/campaigns/mid-autumn-2026/experiences/local-gift-atelier.webp", action: "contact", concept: true },
        ],
      },
    ] satisfies SeasonalGroup[],
  },
} as const;

export function MidAutumnCampaign({ lang, source }: { lang: Language; source: string }) {
  const t = campaign[lang];
  const campaignSource = source || "mid-autumn-2026";
  const planHref = `/plan?lang=${lang}&source=${encodeURIComponent(campaignSource)}`;

  return (
    <section id="mid-autumn" data-customer-section="home-mid-autumn" className="scroll-mt-20 overflow-x-clip bg-[#17231f] pb-24 text-[#FBFAF6] sm:pb-32 lg:pb-40">
      <div className="border-y border-white/12 lg:grid lg:min-h-[88svh] lg:grid-cols-[0.78fr_1.22fr]">
        <div className="flex items-end bg-[#13251f] px-5 py-16 sm:px-8 sm:py-20 lg:py-24 lg:pl-[max(2rem,calc((100vw-80rem)/2))] lg:pr-12">
          <Reveal className="max-w-xl">
            <p className="text-[0.64rem] font-extrabold uppercase tracking-[0.3em] text-[#E7B96A]">{t.eyebrow}</p>
            <RevealHeading as="h2" text={t.title} className="font-display mt-6 max-w-2xl text-5xl leading-[0.92] sm:text-7xl lg:text-[5.35rem]" />
            <p className="mt-7 max-w-lg text-base leading-8 text-white/68 sm:text-lg">{t.body}</p>
            <div className="mt-10 grid max-w-lg border-y border-white/18 sm:grid-cols-2">
              <a href="#seasonal-moon-gifts" className="group flex min-h-14 items-center justify-between border-b border-white/18 py-3 text-sm font-extrabold text-white transition hover:text-[#E7B96A] sm:border-b-0 sm:border-r sm:pr-5">
                {t.primaryCta}<span aria-hidden="true" className="text-xl transition-transform duration-500 group-hover:translate-x-1.5">↘</span>
              </a>
              <a data-customer-track="mid-autumn-plan" data-customer-content-id="mid-autumn-seasonal-plan" data-customer-content-type="secondary-cta" href={planHref} className="group flex min-h-14 items-center justify-between py-3 text-sm font-extrabold text-white transition hover:text-[#E7B96A] sm:pl-5">
                {t.planningCta}<span aria-hidden="true" className="text-xl transition-transform duration-500 group-hover:translate-x-1.5">→</span>
              </a>
            </div>
          </Reveal>
        </div>

        <Reveal delayMs={120} className="grid min-h-[660px] grid-rows-[1fr_auto] bg-[#24362f] lg:min-h-0">
          <div className="relative min-h-[480px] overflow-hidden lg:min-h-0">
            {/*
              WEB-PERF-01 (31/08): bỏ `priority` -- khối Trung Thu này nằm
              sau hero, băng video mở đầu và PinnedStory, tức đã dưới ít
              nhất hai màn hình đầu. Đặt priority ở đây tranh băng thông
              tải trang với đúng những ảnh/video thật sự cần tải ngay.
            */}
            <Image src="/images/campaigns/mid-autumn-2026/experiences/mooncake-editorial-hero.webp" alt={t.collectionTitle} fill sizes="(min-width: 1024px) 62vw, 100vw" className="object-cover object-[center_42%]" />
            <span aria-hidden="true" className="absolute inset-0 ring-1 ring-inset ring-white/10" />
            <span aria-hidden="true" className="absolute right-5 top-5 font-display text-7xl leading-none text-white/78 mix-blend-difference sm:right-8 sm:top-7 sm:text-8xl">2026</span>
          </div>
          <div className="grid gap-4 border-t border-white/12 bg-[#20342d] p-6 sm:grid-cols-[0.7fr_1.3fr] sm:items-end sm:p-8">
            <div>
              <p className="text-[0.58rem] font-extrabold uppercase tracking-[0.24em] text-[#E7B96A]">{t.collectionLabel}</p>
              <h3 className="font-display mt-3 text-4xl leading-none sm:text-5xl">{t.collectionTitle}</h3>
            </div>
            <p className="max-w-lg text-sm leading-6 text-white/66 sm:text-base sm:leading-7">{t.collectionBody}</p>
          </div>
        </Reveal>
      </div>

      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <SeasonalExperienceBrowser groups={t.groups as unknown as SeasonalGroup[]} copy={t.browser} lang={lang} source={campaignSource} />
      </div>
    </section>
  );
}
