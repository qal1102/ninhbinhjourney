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
    body: "Mùa trăng năm nay mở ra nhiều hơn một hộp bánh: một bàn tối bên sông, một đêm diễn giữa núi đá, một chuyến đi dành riêng cho hai người, hay một ý tưởng được cùng nhau làm thành hình.",
    primaryCta: "Khám phá theo dịp",
    planningCta: "Lên hành trình mùa trăng",
    collectionLabel: "Bộ quà mùa trăng 2026",
    collectionTitle: "Nguyệt Viên",
    collectionBody: "Hương vị địa phương trong một dáng quà thanh nhã — để mang về sau chuyến đi, gửi tới gia đình, hoặc thay lời chào dành cho đối tác.",
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
      contactNote: "Đội ngũ Xuân Trường sẽ xác nhận lịch, quy mô và phương án phù hợp trước khi triển khai",
      conceptLabel: "Ý tưởng mở",
      conceptNotice: "Đây là đề xuất sáng tạo độc lập để bắt đầu trao đổi, không phải thông báo về một quan hệ hợp tác hoặc tài trợ đã được xác lập.",
    },
    groups: [
      {
        id: "moon-gifts",
        eyebrow: "Quà mùa trăng",
        title: "Một phần Ninh Bình để mang về.",
        body: "Ba quy cách quà từ lời thăm hỏi nhỏ đến bộ quà dành cho gia đình và đối tác. Mỗi lựa chọn có thể trao đổi thêm về thiệp, số lượng và cách bàn giao.",
        ratio: "portrait",
        items: [
          {
            id: "trang-non",
            kicker: "Hai bánh · hộp gọn",
            title: "Trăng Non",
            body: "Một món quà vừa đủ để mang theo sau chuyến Tam Cốc, dành cho người thân hoặc một lời cảm ơn giản dị.",
            image: "/images/campaigns/mid-autumn-2026/experiences/mooncake-editorial-hero.webp",
            price: "390.000 VND",
            action: "gift",
          },
          {
            id: "trang-an",
            kicker: "Bốn bánh · trà tuyển chọn",
            title: "Trăng An",
            body: "Một dáng quà cân bằng cho gia đình và đối tác: đủ đầy, trang nhã và không phô trương.",
            image: "/images/campaigns/mid-autumn-2026/experiences/mooncake-gift-box.webp",
            price: "890.000 VND",
            action: "gift",
          },
          {
            id: "nguyet-vien",
            kicker: "Sáu bánh · trà · hộp lưu niệm",
            title: "Nguyệt Viên",
            body: "Bộ quà chủ đạo của mùa 2026, dành cho những cuộc gặp cần một dấu ấn trang trọng hơn.",
            image: "/images/campaigns/mid-autumn-2026/experiences/mooncake-flavour-guide.webp",
            price: "1.590.000 VND",
            action: "gift",
          },
        ],
      },
      {
        id: "dining",
        eyebrow: "Bàn tối & ẩm thực",
        title: "Khi phong cảnh trở thành một phần của bữa tối.",
        body: "Từ bàn riêng trên sông đến tiệc nhỏ bên hồ, mỗi trải nghiệm được mở theo ngày, số khách và nhịp đi riêng của hành trình.",
        ratio: "landscape",
        items: [
          {
            id: "moon-table-ngo-dong",
            kicker: "19:00–21:30 · hai khách",
            title: "Bàn Trăng bên Ngô Đồng",
            body: "Bữa tối theo mùa, trà và bánh dùng tại chỗ, khép lại bằng một hộp Trăng Non mang về.",
            image: "/images/campaigns/mid-autumn-2026/experiences/moonlit-river-table.webp",
            price: "2.480.000 VND / bàn",
            action: "booking",
            href: "/packages/ban-trang-tam-coc-2026?lang=vi&source=mid-autumn-2026",
          },
          {
            id: "golden-hour-table",
            kicker: "Hoàng hôn · thực đơn theo mùa",
            title: "Bữa tối giữa sắc vàng Tam Cốc",
            body: "Một bàn ăn chậm, nơi rau trái địa phương và ánh chiều cùng kể câu chuyện về vùng đất.",
            image: "/images/campaigns/mid-autumn-2026/experiences/seasonal-dining-sunset.webp",
            action: "contact",
          },
          {
            id: "waterfront-feast",
            kicker: "Nhóm riêng · theo quy mô",
            title: "Tiệc nhỏ bên mặt nước",
            body: "Dành cho gia đình, nhóm bạn hoặc một cuộc gặp thân mật cần không gian riêng và cách phục vụ trọn vẹn.",
            image: "/images/campaigns/mid-autumn-2026/experiences/waterfront-feast.webp",
            action: "contact",
          },
          {
            id: "mountain-symphony-dinner",
            kicker: "Ẩm thực · âm nhạc · cảnh quan",
            title: "Giao hưởng giữa đất trời",
            body: "Một ý tưởng bàn tối có âm nhạc sống, đặt giữa đường nét núi đá và khoảng trời mở của Ninh Bình.",
            image: "/images/campaigns/mid-autumn-2026/experiences/mountain-symphony-dinner.webp",
            action: "contact",
            concept: true,
          },
        ],
      },
      {
        id: "nights",
        eyebrow: "Lễ hội & đêm diễn",
        title: "Di sản được nhìn thấy trong một ánh sáng khác.",
        body: "Những phác thảo cho mùa lễ hội: trình diễn ánh sáng, âm nhạc, hoa và nghệ thuật bản địa. Mỗi ý tưởng đều mở để cùng địa phương, nghệ sĩ và đối tác phát triển.",
        ratio: "landscape",
        items: [
          {
            id: "lotus-drone-show",
            kicker: "Bầu trời đêm · hoa sen",
            title: "Sen nở trên trời Ninh Bình",
            body: "Một màn trình diễn drone lấy chuyển động của cánh sen và dòng nước làm ngôn ngữ thị giác.",
            image: "/images/campaigns/mid-autumn-2026/experiences/lotus-drone-show.webp",
            action: "contact",
            concept: true,
          },
          {
            id: "cliff-light-show",
            kicker: "Ánh sáng · vách núi",
            title: "Dấu thời gian trên đá",
            body: "Trình diễn ánh sáng kể chuyện địa chất, lịch sử và những lớp ký ức trên cảnh quan tự nhiên.",
            image: "/images/campaigns/mid-autumn-2026/experiences/cliff-light-show.webp",
            action: "contact",
            concept: true,
          },
          {
            id: "traditional-dance-night",
            kicker: "Vũ điệu · âm nhạc bản địa",
            title: "Nhịp di sản",
            body: "Một đêm diễn đưa chất liệu múa truyền thống vào không gian đương đại, gần gũi với người xem.",
            image: "/images/campaigns/mid-autumn-2026/experiences/traditional-dance-night.webp",
            action: "contact",
            concept: true,
          },
          {
            id: "flower-festival",
            kicker: "Mùa hoa · đường dạo",
            title: "Lối hoa giữa miền di sản",
            body: "Không gian đi bộ theo mùa, kết nối cảnh quan, thủ công và những điểm dừng dành cho gia đình.",
            image: "/images/campaigns/mid-autumn-2026/experiences/flower-festival.webp",
            action: "contact",
            concept: true,
          },
        ],
      },
      {
        id: "private-moments",
        eyebrow: "Những dịp riêng",
        title: "Một ngày chỉ thuộc về những người có mặt.",
        body: "Chuyến nghỉ dưới trời sao, bộ ảnh cưới hay một đường dạo ban đêm — có thể bắt đầu từ một ý thích rồi được đội ngũ thiết kế thành hành trình riêng.",
        ratio: "landscape",
        items: [
          {
            id: "heritage-glamping",
            kicker: "Cắm trại · trời sao",
            title: "Một đêm ngoài hiên núi",
            body: "Trải nghiệm lưu trú ngắn giữa thiên nhiên, với bữa tối nhẹ và buổi sáng bắt đầu thật chậm.",
            image: "/images/campaigns/mid-autumn-2026/experiences/heritage-glamping.webp",
            action: "planning",
            concept: true,
          },
          {
            id: "heritage-wedding",
            kicker: "Ảnh cưới · địa điểm riêng",
            title: "Lời hẹn giữa non nước",
            body: "Khảo sát bối cảnh, chọn khung giờ và kết nối ekip để một bộ ảnh giữ được vẻ tự nhiên của Ninh Bình.",
            image: "/images/campaigns/mid-autumn-2026/experiences/heritage-wedding.webp",
            action: "contact",
            concept: true,
          },
          {
            id: "heritage-walking-path",
            kicker: "Đường dạo · sau hoàng hôn",
            title: "Dạo bước trong miền sáng",
            body: "Một cung đi bộ nhẹ vào buổi tối, phù hợp để nối bữa ăn, phố cổ và điểm ngắm cảnh trong cùng hành trình.",
            image: "/images/campaigns/mid-autumn-2026/experiences/heritage-walking-path.webp",
            action: "planning",
            concept: true,
          },
        ],
      },
      {
        id: "collaborations",
        eyebrow: "Cùng tạo dấu ấn",
        title: "Ninh Bình là một lời mời mở.",
        body: "Dành cho thương hiệu, nhà sáng tạo, doanh nghiệp và cộng đồng muốn cùng làm nên một sản phẩm, một cuộc gặp hay một câu chuyện có gốc rễ tại vùng đất này.",
        ratio: "landscape",
        items: [
          {
            id: "international-gathering",
            kicker: "Gặp gỡ quốc tế · kết nối địa phương",
            title: "Bàn tròn giữa miền di sản",
            body: "Không gian gặp gỡ cho những cuộc trao đổi quốc tế cần chiều sâu địa phương và cách đón tiếp riêng.",
            image: "/images/campaigns/mid-autumn-2026/experiences/international-gathering.webp",
            action: "contact",
            concept: true,
          },
          {
            id: "destination-photoshoot",
            kicker: "Biên tập hình ảnh · sản xuất tại điểm đến",
            title: "Ninh Bình trong khung hình mới",
            body: "Kết nối bối cảnh, sản xuất và câu chuyện địa phương cho chiến dịch hình ảnh hoặc bộ sưu tập.",
            image: "/images/campaigns/mid-autumn-2026/experiences/destination-photoshoot.webp",
            action: "contact",
            concept: true,
          },
          {
            id: "ninh-binh-fragrance",
            kicker: "Hương thơm · ký ức điểm đến",
            title: "Một mùi hương của Ninh Bình",
            body: "Ý tưởng đồng sáng tạo sản phẩm lấy sen, đá vôi, mặt nước và ký ức chuyến đi làm điểm khởi đầu.",
            image: "/images/campaigns/mid-autumn-2026/experiences/ninh-binh-fragrance.webp",
            action: "contact",
            concept: true,
          },
          {
            id: "local-gift-atelier",
            kicker: "Thủ công · quà tặng doanh nghiệp",
            title: "Xưởng quà từ Ninh Bình",
            body: "Một đầu mối để kết nối sản vật, nghệ nhân và thiết kế thành bộ quà có câu chuyện rõ ràng.",
            image: "/images/campaigns/mid-autumn-2026/experiences/local-gift-atelier.webp",
            action: "contact",
            concept: true,
          },
          {
            id: "bottega-veneta-concept",
            kicker: "Đề xuất thương hiệu · thời trang",
            title: "Bottega Veneta · The Green Passage",
            body: "Một phác thảo độc lập về chất liệu, màu xanh và chuyển động giữa cảnh quan Ninh Bình.",
            image: "/images/campaigns/mid-autumn-2026/brand-proposals/bottega-veneta-concept.webp",
            action: "contact",
            concept: true,
          },
          {
            id: "hermes-concept",
            kicker: "Đề xuất thương hiệu · thủ công",
            title: "Hermès · Crafted by the River",
            body: "Ý tưởng gặp gỡ giữa tinh thần thủ công, sắc cam và nhịp chậm của một hành trình trên sông.",
            image: "/images/campaigns/mid-autumn-2026/brand-proposals/hermes-concept.webp",
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
    },
    groups: [
      {
        id: "moon-gifts",
        eyebrow: "Gifts of the moon",
        title: "A little of Ninh Binh to take home.",
        body: "Three gift formats, from a quiet gesture to a family or corporate presentation. Cards, quantities and collection can be arranged with the team.",
        ratio: "portrait",
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
        items: [
          { id: "international-gathering", kicker: "International exchange · local connection", title: "A round table in heritage", body: "A considered setting for international conversations that need local depth and a distinctive welcome.", image: "/images/campaigns/mid-autumn-2026/experiences/international-gathering.webp", action: "contact", concept: true },
          { id: "destination-photoshoot", kicker: "Editorial · destination production", title: "Ninh Binh in a new frame", body: "Locations, production and local narratives for an editorial campaign or collection.", image: "/images/campaigns/mid-autumn-2026/experiences/destination-photoshoot.webp", action: "contact", concept: true },
          { id: "ninh-binh-fragrance", kicker: "Scent · memory of place", title: "A fragrance of Ninh Binh", body: "A co-creation beginning with lotus, limestone, water and the memory of a journey.", image: "/images/campaigns/mid-autumn-2026/experiences/ninh-binh-fragrance.webp", action: "contact", concept: true },
          { id: "local-gift-atelier", kicker: "Craft · corporate gifting", title: "The Ninh Binh gift atelier", body: "One point of connection for produce, makers and design to become a gift with a clear story.", image: "/images/campaigns/mid-autumn-2026/experiences/local-gift-atelier.webp", action: "contact", concept: true },
          { id: "bottega-veneta-concept", kicker: "Brand proposal · fashion", title: "Bottega Veneta · The Green Passage", body: "An independent sketch in material, green and movement through the Ninh Binh landscape.", image: "/images/campaigns/mid-autumn-2026/brand-proposals/bottega-veneta-concept.webp", action: "contact", concept: true },
          { id: "hermes-concept", kicker: "Brand proposal · craft", title: "Hermès · Crafted by the River", body: "An open meeting of craft, orange and the quiet pace of a river journey.", image: "/images/campaigns/mid-autumn-2026/brand-proposals/hermes-concept.webp", action: "contact", concept: true },
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
    <section id="mid-autumn" data-customer-section="home-mid-autumn" className="overflow-hidden bg-[#17231f] py-16 text-[#FBFAF6] sm:py-24 lg:py-28">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <Reveal>
            <p className="text-xs font-extrabold uppercase tracking-[0.28em] text-[#E7B96A]">{t.eyebrow}</p>
            <RevealHeading as="h2" text={t.title} className="font-display mt-5 max-w-2xl text-5xl leading-[0.96] sm:text-7xl" />
            <p className="mt-6 max-w-xl text-lg leading-8 text-white/72">{t.body}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a href="#seasonal-moon-gifts" className="rounded-full bg-[#E7B96A] px-6 py-3 text-center font-semibold text-[#183F34] transition hover:bg-[#f0c87c]">{t.primaryCta}</a>
              <a data-customer-track="mid-autumn-plan" data-customer-content-id="mid-autumn-seasonal-plan" data-customer-content-type="secondary-cta" href={planHref} className="rounded-full border border-white/30 px-6 py-3 text-center font-semibold text-white transition hover:bg-white/10">{t.planningCta}</a>
            </div>
          </Reveal>

          <Reveal delayMs={120} className="overflow-hidden rounded-[18px] border border-white/12 bg-[#21362e] shadow-2xl shadow-black/30">
            <div className="relative aspect-[4/3] overflow-hidden sm:aspect-[16/11]">
              <Image src="/images/campaigns/mid-autumn-2026/experiences/mooncake-editorial-hero.webp" alt={t.collectionTitle} fill priority sizes="(min-width: 1024px) 55vw, 100vw" className="object-cover object-[center_42%]" />
            </div>
            <div className="border-t border-white/10 p-6 sm:p-8">
              <p className="text-xs font-extrabold uppercase tracking-[0.24em] text-[#E7B96A]">{t.collectionLabel}</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-[auto_1fr] sm:items-start sm:gap-7">
                <h3 className="font-display text-4xl leading-none sm:text-5xl">{t.collectionTitle}</h3>
                <p className="max-w-lg text-sm leading-6 text-white/68 sm:text-base sm:leading-7">{t.collectionBody}</p>
              </div>
            </div>
          </Reveal>
        </div>

        <SeasonalExperienceBrowser groups={t.groups as unknown as SeasonalGroup[]} copy={t.browser} lang={lang} source={campaignSource} />
      </div>
    </section>
  );
}
