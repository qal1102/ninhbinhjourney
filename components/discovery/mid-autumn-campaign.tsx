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
    body: "Mùa trăng bắt đầu từ nhiều hơn một hộp bánh: một bàn bên sông, một chuyến đi cho hai người và những ý tưởng cho buổi tối.",
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
      editorialLabel: "Biên tập · 2026",
      editorialNotice: "Bộ hình biên tập độc lập cho hồ sơ kết nối thương hiệu · Ninh Bình 2026.",
      selectStory: "Chọn câu chuyện",
      previousStory: "Câu chuyện trước",
      nextStory: "Câu chuyện tiếp theo",
      galleryLabel: "Các khung hình",
      bookingClosedBadge: "Đã khép mùa 2026",
      bookingClosedTitle: "Bàn Trăng đã khép — hẹn mùa trăng 2027",
      bookingClosedReason:
        "Bàn Trăng chỉ giữ chỗ 18–27/09/2026; mốc này đã qua nên không giữ bàn được nữa.",
      bookingClosedCta: "Xem các gói đang mở",
    },
    groups: [
      {
        id: "moon-gifts",
        eyebrow: "Quà mùa trăng",
        title: "Một phần Ninh Bình để mang về.",
        body: "Ba quy cách quà từ lời thăm hỏi nhỏ đến bộ quà dành cho gia đình và đối tác. Mỗi lựa chọn có thể trao đổi thêm về thiệp, số lượng và cách bàn giao.",
        ratio: "portrait",
        layout: "catalog",
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
        layout: "feature",
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
        layout: "stories",
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
        layout: "mosaic",
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
        layout: "index",
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
