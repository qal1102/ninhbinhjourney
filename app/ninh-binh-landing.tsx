"use client";

import Image from "next/image";
import { useMemo, useState } from "react";

export type Language = "en" | "vi";

type DestinationId =
  | "trang_an"
  | "bai_dinh"
  | "tam_chuc"
  | "hoa_lu_old_town"
  | "tam_coc"
  | "hang_mua";

type Localized = Record<Language, string>;

type Destination = {
  id: DestinationId;
  sourceKeys: string[];
  name: Localized;
  coords: string;
  tagline: Localized;
  description: Localized;
  tags: Record<Language, string[]>;
  duration: Localized;
  marker: { x: string; y: string };
  imagePosition: string;
  accent: string;
};

type ItineraryStop = {
  id: DestinationId | "local_lunch";
  time: string;
  title: Localized;
  transport: Localized;
  duration: Localized;
  distance: Localized;
  tags: Record<Language, string[]>;
};

type Props = {
  initialLang: Language;
  source: string;
  presentationMode: boolean;
};

const copy = {
  en: {
    nav: ["Here", "Stories", "Companion", "Journey"],
    conceptBadge: "Concept Demo",
    introTop: "Ninh Binh",
    introWords: ["Nature.", "Heritage.", "Wonder."],
    title: "Ninh Binh",
    subtitle: "A journey between mountains, water and timeless heritage",
    cta: "Begin your journey",
    mapCta: "Explore map",
    youAreHere: "You are here",
    source: "QR source",
    sourceFallback: "Welcome point",
    mapTitle: "Ninh Binh after the merger",
    mapBody:
      "A calm orientation map for the first scan, shaped around heritage water routes, spiritual landmarks, evening streets and limestone viewpoints.",
    currentScan: "Current scan",
    discover: "Discover",
    add: "Add to journey",
    added: "Added",
    stories: "Places with a story",
    storiesIntro:
      "Six chapters, paced like a day moving through water, stone, incense and lantern light.",
    aiLabel: "AI Journey Companion",
    aiTitle: "Let's shape your journey",
    aiBody:
      "Choose a few preferences, then create a local mock route. No AI provider is connected in this phase.",
    input: "Tell me what you are looking for...",
    create: "Create journey",
    creating: "Shaping route...",
    voice: "Voice",
    journey: "Your Ninh Binh journey",
    journeyNote: "Generated locally from your selected preferences.",
    directions: "Directions",
    replace: "Replace",
    remove: "Remove",
    packageTitle: "Make this journey easier",
    packageName: "Heritage & Evening Experience",
    packageFit: "Best fit for a relaxed family day.",
    view: "View experience",
    reserve: "Reserve experience",
    packageDetail:
      "A discreet bundle for visitors who want fewer decisions: boat journey, local lunch, private transfer, Bai Dinh visit and an evening in Hoa Lu Old Town.",
    noPayment: "No real payment will be processed.",
    checkoutTitle: "Review journey",
    guests: "Number of guests",
    transport: "Add transport",
    meal: "Add meal",
    contact: "Contact information",
    demoPayment: "Demo payment",
    close: "Close",
    confirm: "Confirm demo reservation",
  },
  vi: {
    nav: ["Vị trí", "Câu chuyện", "Đồng hành", "Lịch trình"],
    conceptBadge: "Bản demo ý tưởng",
    introTop: "Ninh Bình",
    introWords: ["Thiên nhiên.", "Di sản.", "Kỳ quan."],
    title: "Ninh Bình",
    subtitle: "Hành trình giữa núi, nước và di sản vượt thời gian",
    cta: "Bắt đầu hành trình",
    mapCta: "Khám phá bản đồ",
    youAreHere: "Bạn đang ở đây",
    source: "Nguồn QR",
    sourceFallback: "Điểm chào đón",
    mapTitle: "Ninh Bình sau sáp nhập",
    mapBody:
      "Bản đồ định hướng nhẹ nhàng cho lần quét đầu tiên, xoay quanh tuyến nước di sản, điểm tâm linh, phố đêm và các góc nhìn núi đá vôi.",
    currentScan: "Điểm quét hiện tại",
    discover: "Khám phá",
    add: "Thêm vào lịch trình",
    added: "Đã thêm",
    stories: "Những điểm đến có câu chuyện",
    storiesIntro:
      "Sáu chương trải nghiệm, chậm rãi như một ngày đi qua nước, đá, hương trầm và ánh đèn lồng.",
    aiLabel: "Bạn đồng hành AI",
    aiTitle: "Cùng định hình hành trình",
    aiBody:
      "Chọn vài sở thích, sau đó tạo một tuyến mô phỏng cục bộ. Giai đoạn này chưa kết nối nhà cung cấp AI.",
    input: "Bạn đang tìm kiếm điều gì...",
    create: "Tạo lịch trình",
    creating: "Đang định hình tuyến...",
    voice: "Giọng nói",
    journey: "Lịch trình Ninh Bình của bạn",
    journeyNote: "Được tạo cục bộ từ các sở thích đã chọn.",
    directions: "Chỉ đường",
    replace: "Đổi điểm",
    remove: "Xóa",
    packageTitle: "Làm hành trình nhẹ nhàng hơn",
    packageName: "Trải nghiệm Di sản & Phố cổ buổi tối",
    packageFit: "Phù hợp cho một ngày thư thả cùng gia đình.",
    view: "Xem trải nghiệm",
    reserve: "Giữ chỗ trải nghiệm",
    packageDetail:
      "Một gói gợi ý kín đáo cho du khách muốn bớt phải lựa chọn: đi thuyền, ăn trưa địa phương, xe riêng, thăm Bái Đính và buổi tối ở Phố cổ Hoa Lư.",
    noPayment: "Không có thanh toán thật nào được xử lý.",
    checkoutTitle: "Xem lại lịch trình",
    guests: "Số lượng khách",
    transport: "Thêm phương tiện",
    meal: "Thêm bữa ăn",
    contact: "Thông tin liên hệ",
    demoPayment: "Thanh toán mô phỏng",
    close: "Đóng",
    confirm: "Xác nhận giữ chỗ mô phỏng",
  },
} satisfies Record<Language, Record<string, string | string[]>>;

const chipGroups = [
  { id: "3h", en: "3 hours", vi: "3 giờ" },
  { id: "1d", en: "1 day", vi: "1 ngày" },
  { id: "2d", en: "2 days", vi: "2 ngày" },
  { id: "nature", en: "Nature", vi: "Thiên nhiên" },
  { id: "culture", en: "Culture", vi: "Văn hóa" },
  { id: "spiritual", en: "Spiritual", vi: "Tâm linh" },
  { id: "family", en: "Family", vi: "Gia đình" },
  { id: "relaxed", en: "Relaxed", vi: "Thư thả" },
  { id: "adventure", en: "Adventure", vi: "Khám phá" },
] as const;

const destinations: Destination[] = [
  {
    id: "trang_an",
    sourceKeys: ["trang_an", "trang_an_boat_station"],
    name: { en: "Trang An", vi: "Tràng An" },
    coords: "20.2503 N, 105.8970 E",
    tagline: {
      en: "Where mountains meet the quiet water",
      vi: "Nơi núi đá gặp mặt nước tĩnh lặng",
    },
    description: {
      en: "A slow boat journey through limestone valleys, caves and temple silhouettes, designed for visitors who want Ninh Binh to open gently.",
      vi: "Một chuyến thuyền chậm qua thung lũng đá vôi, hang nước và bóng đền cổ, dành cho du khách muốn Ninh Bình mở ra thật dịu.",
    },
    tags: {
      en: ["Nature", "Heritage", "3-4 hours"],
      vi: ["Thiên nhiên", "Di sản", "3-4 giờ"],
    },
    duration: { en: "3-4 hours", vi: "3-4 giờ" },
    marker: { x: "40%", y: "48%" },
    imagePosition: "50% 48%",
    accent: "#A8CEC1",
  },
  {
    id: "bai_dinh",
    sourceKeys: ["bai_dinh", "bai_dinh_main_gate"],
    name: { en: "Bai Dinh", vi: "Bái Đính" },
    coords: "20.2768 N, 105.8656 E",
    tagline: {
      en: "A spacious rhythm of bells, stone and hillside air",
      vi: "Nhịp chuông, đá và gió núi trong một không gian rộng mở",
    },
    description: {
      en: "Grand courtyards, long corridors and quiet viewpoints make this a spiritual stop with room to breathe.",
      vi: "Sân rộng, hành lang dài và các điểm nhìn yên tĩnh tạo nên một điểm dừng tâm linh có nhiều khoảng thở.",
    },
    tags: {
      en: ["Spiritual", "Culture", "2-3 hours"],
      vi: ["Tâm linh", "Văn hóa", "2-3 giờ"],
    },
    duration: { en: "2-3 hours", vi: "2-3 giờ" },
    marker: { x: "33%", y: "36%" },
    imagePosition: "44% 45%",
    accent: "#E7B96A",
  },
  {
    id: "tam_chuc",
    sourceKeys: ["tam_chuc", "tam_chuc_boat_station"],
    name: { en: "Tam Chuc", vi: "Tam Chúc" },
    coords: "20.5736 N, 105.9133 E",
    tagline: {
      en: "Lake light, temple roofs and a gentler northern breeze",
      vi: "Ánh hồ, mái chùa và làn gió bắc dịu nhẹ",
    },
    description: {
      en: "A contemplative lake-and-temple landscape for travelers seeking quiet scale and a softer pace.",
      vi: "Không gian hồ và chùa dành cho những ai muốn một trải nghiệm tĩnh, rộng và chậm hơn.",
    },
    tags: {
      en: ["Lake", "Spiritual", "Half day"],
      vi: ["Mặt hồ", "Tâm linh", "Nửa ngày"],
    },
    duration: { en: "Half day", vi: "Nửa ngày" },
    marker: { x: "55%", y: "22%" },
    imagePosition: "58% 50%",
    accent: "#D7E6DD",
  },
  {
    id: "hoa_lu_old_town",
    sourceKeys: ["hoa_lu_old_town"],
    name: { en: "Hoa Lu Old Town", vi: "Phố cổ Hoa Lư" },
    coords: "20.2579 N, 105.9741 E",
    tagline: {
      en: "Lantern reflections after a day on the water",
      vi: "Ánh đèn lồng sau một ngày theo dòng nước",
    },
    description: {
      en: "An easy evening chapter for food, walking streets, warm light and soft reflections.",
      vi: "Một chương buổi tối nhẹ nhàng với ẩm thực, phố đi bộ, ánh sáng ấm và mặt nước phản chiếu.",
    },
    tags: {
      en: ["Evening", "Family", "1-2 hours"],
      vi: ["Buổi tối", "Gia đình", "1-2 giờ"],
    },
    duration: { en: "1-2 hours", vi: "1-2 giờ" },
    marker: { x: "50%", y: "58%" },
    imagePosition: "46% 55%",
    accent: "#E7B96A",
  },
  {
    id: "tam_coc",
    sourceKeys: ["tam_coc"],
    name: { en: "Tam Coc", vi: "Tam Cốc" },
    coords: "20.2169 N, 105.9368 E",
    tagline: {
      en: "Rice fields, river bends and a softer countryside rhythm",
      vi: "Đồng lúa, khúc sông và nhịp quê dịu hơn",
    },
    description: {
      en: "A countryside route with water, rice fields and limestone forms sitting close to daily life.",
      vi: "Một tuyến làng quê với mặt nước, đồng lúa và núi đá vôi nằm gần nhịp sống thường ngày.",
    },
    tags: {
      en: ["Countryside", "Boat", "2-3 hours"],
      vi: ["Làng quê", "Thuyền", "2-3 giờ"],
    },
    duration: { en: "2-3 hours", vi: "2-3 giờ" },
    marker: { x: "62%", y: "70%" },
    imagePosition: "62% 55%",
    accent: "#A8CEC1",
  },
  {
    id: "hang_mua",
    sourceKeys: ["hang_mua"],
    name: { en: "Hang Mua", vi: "Hang Múa" },
    coords: "20.2290 N, 105.9360 E",
    tagline: {
      en: "A climb toward the wide green geometry of Ninh Binh",
      vi: "Một cung leo lên hình khối xanh rộng mở của Ninh Bình",
    },
    description: {
      en: "A viewpoint chapter for active travelers, best when the day softens and the river catches light.",
      vi: "Một chương ngắm cảnh cho du khách thích vận động, đẹp nhất khi ngày dịu xuống và dòng sông bắt sáng.",
    },
    tags: {
      en: ["Viewpoint", "Adventure", "2 hours"],
      vi: ["Ngắm cảnh", "Khám phá", "2 giờ"],
    },
    duration: { en: "2 hours", vi: "2 giờ" },
    marker: { x: "58%", y: "64%" },
    imagePosition: "55% 45%",
    accent: "#E7B96A",
  },
];

const baseItinerary: ItineraryStop[] = [
  {
    id: "trang_an",
    time: "08:00",
    title: { en: "Trang An", vi: "Tràng An" },
    transport: { en: "Boat journey", vi: "Chuyến thuyền" },
    duration: { en: "3 hours", vi: "3 giờ" },
    distance: { en: "Start here", vi: "Bắt đầu tại đây" },
    tags: { en: ["Nature", "Heritage"], vi: ["Thiên nhiên", "Di sản"] },
  },
  {
    id: "local_lunch",
    time: "11:30",
    title: { en: "Local lunch", vi: "Bữa trưa địa phương" },
    transport: { en: "Rice field restaurant", vi: "Nhà hàng gần đồng lúa" },
    duration: { en: "75 min", vi: "75 phút" },
    distance: { en: "15 min transfer", vi: "15 phút di chuyển" },
    tags: { en: ["Relaxed", "Family"], vi: ["Thư thả", "Gia đình"] },
  },
  {
    id: "bai_dinh",
    time: "13:30",
    title: { en: "Bai Dinh", vi: "Bái Đính" },
    transport: { en: "Electric cart and temple walk", vi: "Xe điện và đi bộ trong chùa" },
    duration: { en: "2.5 hours", vi: "2,5 giờ" },
    distance: { en: "35 min transfer", vi: "35 phút di chuyển" },
    tags: { en: ["Culture", "Spiritual"], vi: ["Văn hóa", "Tâm linh"] },
  },
  {
    id: "hoa_lu_old_town",
    time: "18:00",
    title: { en: "Hoa Lu Old Town", vi: "Phố cổ Hoa Lư" },
    transport: { en: "Lantern evening", vi: "Buổi tối đèn lồng" },
    duration: { en: "90 min", vi: "90 phút" },
    distance: { en: "25 min transfer", vi: "25 phút di chuyển" },
    tags: { en: ["Evening", "Food"], vi: ["Buổi tối", "Ẩm thực"] },
  },
];

const packageItems = {
  en: [
    "Boat journey",
    "Local lunch",
    "Private transfer",
    "Bai Dinh visit",
    "Evening at Hoa Lu Old Town",
  ],
  vi: [
    "Chuyến thuyền",
    "Bữa trưa địa phương",
    "Xe riêng",
    "Thăm Bái Đính",
    "Buổi tối tại Phố cổ Hoa Lư",
  ],
};

function normalizeSource(source: string) {
  return source.trim().toLowerCase().replaceAll("-", "_");
}

function sourceLabel(source: string, lang: Language) {
  if (!source) return copy[lang].sourceFallback as string;
  const normalized = normalizeSource(source);
  const match = destinations.find((place) => place.sourceKeys.includes(normalized));
  return match ? match.name[lang] : source.replaceAll("_", " ");
}

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function buildHref(lang: Language, source: string, presentationMode: boolean) {
  const params = new URLSearchParams();
  params.set("lang", lang);
  if (source) params.set("source", source);
  if (presentationMode) params.set("presentation", "1");
  return `/?${params.toString()}`;
}

function createPreferenceRoute(selected: string[]): ItineraryStop[] {
  if (selected.includes("3h")) {
    return baseItinerary.slice(0, 2);
  }
  if (selected.includes("adventure")) {
    return [
      baseItinerary[0],
      {
        id: "hang_mua",
        time: "15:30",
        title: { en: "Hang Mua", vi: "Hang Múa" },
        transport: { en: "Viewpoint climb", vi: "Leo lên điểm ngắm cảnh" },
        duration: { en: "2 hours", vi: "2 giờ" },
        distance: { en: "25 min transfer", vi: "25 phút di chuyển" },
        tags: { en: ["Viewpoint", "Adventure"], vi: ["Ngắm cảnh", "Khám phá"] },
      },
      baseItinerary[3],
    ];
  }
  if (selected.includes("spiritual")) {
    return [
      baseItinerary[2],
      {
        id: "tam_chuc",
        time: "15:45",
        title: { en: "Tam Chuc", vi: "Tam Chúc" },
        transport: { en: "Lake temple route", vi: "Tuyến hồ và chùa" },
        duration: { en: "2.5 hours", vi: "2,5 giờ" },
        distance: { en: "55 min transfer", vi: "55 phút di chuyển" },
        tags: { en: ["Lake", "Spiritual"], vi: ["Mặt hồ", "Tâm linh"] },
      },
      baseItinerary[3],
    ];
  }
  return baseItinerary;
}

export default function NinhBinhLanding({
  initialLang,
  source,
  presentationMode,
}: Props) {
  const [selectedChips, setSelectedChips] = useState<string[]>(["1d", "culture", "relaxed", "family"]);
  const [itinerary, setItinerary] = useState<ItineraryStop[]>(baseItinerary);
  const [addedIds, setAddedIds] = useState<DestinationId[]>([]);
  const [loading, setLoading] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [activeDetail, setActiveDetail] = useState<DestinationId>("trang_an");
  const lang = initialLang;
  const t = copy[lang];
  const normalizedSource = normalizeSource(source);
  const currentDestination = useMemo(
    () =>
      destinations.find((place) => place.sourceKeys.includes(normalizedSource)) ??
      destinations[0],
    [normalizedSource],
  );

  function toggleChip(id: string) {
    setSelectedChips((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  function createJourney() {
    setLoading(true);
    window.setTimeout(() => {
      setItinerary(createPreferenceRoute(selectedChips));
      setLoading(false);
      scrollToId("itinerary");
    }, 700);
  }

  function addDestination(id: DestinationId) {
    setAddedIds((current) => (current.includes(id) ? current : [...current, id]));
    const destination = destinations.find((place) => place.id === id);
    if (!destination || itinerary.some((stop) => stop.id === id)) {
      scrollToId("itinerary");
      return;
    }
    setItinerary((current) => [
      ...current,
      {
        id,
        time: "16:30",
        title: destination.name,
        transport: {
          en: "Added from destination story",
          vi: "Được thêm từ câu chuyện điểm đến",
        },
        duration: destination.duration,
        distance: {
          en: "Local route",
          vi: "Tuyến nội vùng",
        },
        tags: destination.tags,
      },
    ]);
    scrollToId("itinerary");
  }

  function replaceStop(index: number) {
    const pool = destinations.filter((destination) => !itinerary.some((stop) => stop.id === destination.id));
    const replacement = pool[0] ?? destinations[(index + 1) % destinations.length];
    setItinerary((current) =>
      current.map((stop, stopIndex) =>
        stopIndex === index
          ? {
              id: replacement.id,
              time: stop.time,
              title: replacement.name,
              transport: { en: "Alternative local route", vi: "Tuyến thay thế nội vùng" },
              duration: replacement.duration,
              distance: { en: "Adjusted transfer", vi: "Di chuyển đã điều chỉnh" },
              tags: replacement.tags,
            }
          : stop,
      ),
    );
  }

  function removeStop(index: number) {
    setItinerary((current) => current.filter((_, stopIndex) => stopIndex !== index));
  }

  function openDestination(id: DestinationId) {
    setActiveDetail(id);
    scrollToId(`destination-${id}`);
  }

  return (
    <main className="min-h-screen bg-[#FBFAF6] text-[#1D2925]">
      <section className="relative min-h-screen overflow-hidden bg-[#183F34] text-[#FBFAF6]">
        <Image
          src="/hero-ninh-binh.png"
          alt={lang === "en" ? "Morning mist over Ninh Binh limestone mountains and water" : "Sương sớm trên núi đá vôi và mặt nước Ninh Bình"}
          fill
          priority
          sizes="100vw"
          className="float-slow object-cover opacity-80"
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(24,63,52,.18),rgba(24,63,52,.58)_48%,rgba(29,41,37,.9))]" />
        <div className="word-reveal pointer-events-none absolute inset-0 z-20 grid place-items-center bg-[#FBFAF6] text-[#183F34]">
          <div className="px-6 text-center">
            <p className="text-sm uppercase tracking-[0.32em] text-[#3F7568]">{t.introTop}</p>
            <div className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-2 font-display text-4xl sm:text-7xl">
              {(t.introWords as string[]).map((word, index) => (
                <span key={word} className="reveal-word" style={{ animationDelay: `${index * 180}ms` }}>
                  {word}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="absolute inset-x-0 top-0 z-10 mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
          <button type="button" onClick={() => scrollToId("top")} className="font-display text-xl tracking-[0.16em]">
            NB
          </button>
          <nav aria-label="Primary" className="hidden gap-6 text-sm text-[#FBFAF6]/80 md:flex">
            {(t.nav as string[]).map((item, index) => (
              <button
                key={item}
                type="button"
                onClick={() => scrollToId(["here", "stories", "ai", "itinerary"][index])}
                className="transition hover:text-[#E7B96A]"
              >
                {item}
              </button>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            {presentationMode ? (
              <span className="hidden rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-xs text-white/85 backdrop-blur sm:inline">
                {t.conceptBadge}
              </span>
            ) : null}
            <div className="flex rounded-full border border-white/25 bg-white/10 p-1 text-sm backdrop-blur">
              <a className={`rounded-full px-3 py-1.5 ${lang === "en" ? "bg-[#FBFAF6] text-[#183F34]" : ""}`} href={buildHref("en", source, presentationMode)}>
                EN
              </a>
              <a className={`rounded-full px-3 py-1.5 ${lang === "vi" ? "bg-[#FBFAF6] text-[#183F34]" : ""}`} href={buildHref("vi", source, presentationMode)}>
                VI
              </a>
            </div>
          </div>
        </div>

        <div id="top" className="relative z-10 mx-auto flex min-h-screen max-w-7xl flex-col justify-end px-5 pb-16 pt-28 sm:px-8 lg:pb-24">
          {presentationMode ? (
            <p className="fade-up mb-5 w-fit rounded-full border border-white/25 bg-white/10 px-4 py-2 text-xs uppercase tracking-[0.24em] text-[#FBFAF6]/85 backdrop-blur">
              {t.conceptBadge}
            </p>
          ) : null}
          <h1 className="fade-up font-display text-6xl leading-[0.9] text-[#FBFAF6] sm:text-8xl lg:text-[9rem]">
            {t.title}
          </h1>
          <p className="fade-up mt-6 max-w-2xl text-xl leading-8 text-[#FBFAF6]/88 sm:text-2xl">
            {t.subtitle}
          </p>
          <div className="fade-up mt-9 flex flex-col gap-3 sm:flex-row">
            <button type="button" onClick={() => scrollToId("ai")} className="rounded-full bg-[#E7B96A] px-6 py-3 text-center font-semibold text-[#183F34] shadow-xl shadow-black/20 transition hover:bg-[#f0c87c] focus:outline focus:outline-2 focus:outline-offset-4 focus:outline-[#E7B96A]">
              {t.cta}
            </button>
            <button type="button" onClick={() => scrollToId("here")} className="rounded-full border border-white/35 px-6 py-3 text-center font-semibold text-white transition hover:bg-white/12 focus:outline focus:outline-2 focus:outline-offset-4 focus:outline-white">
              {t.mapCta}
            </button>
          </div>
        </div>
      </section>

      <section id="here" className="px-5 py-16 sm:px-8 lg:py-24">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
          <div className="reveal-panel">
            <p className="text-sm uppercase tracking-[0.24em] text-[#3F7568]">{t.youAreHere}</p>
            <h2 className="font-display mt-3 text-5xl text-[#183F34] sm:text-6xl">Ninh Bình</h2>
            <div className="mt-6 rounded-[8px] border border-[#A8CEC1]/60 bg-white/70 p-5 shadow-sm">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#6D756F]">{t.source}</p>
              <p className="mt-2 text-xl capitalize text-[#183F34]">{sourceLabel(source, lang)}</p>
            </div>
            <p className="mt-7 max-w-xl text-lg leading-8 text-[#4d5b55]">{t.mapBody}</p>
          </div>

          <div className="relative overflow-hidden rounded-[8px] border border-[#A8CEC1]/60 bg-[#F6F1E7] p-4 shadow-xl shadow-[#183F34]/10 sm:p-6">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(231,185,106,.25),transparent_28%),radial-gradient(circle_at_80%_75%,rgba(168,206,193,.35),transparent_30%)]" />
            <div className="relative">
              <p className="mb-4 text-sm uppercase tracking-[0.22em] text-[#3F7568]">{t.mapTitle}</p>
              <div className="relative aspect-[4/5] sm:aspect-[16/11]">
                <svg viewBox="0 0 760 540" role="img" aria-label={lang === "en" ? "Stylized post-merger Ninh Binh map" : "Bản đồ Ninh Bình sau sáp nhập dạng cách điệu"} className="h-full w-full">
                  <path d="M152 394 C102 318 120 216 196 164 C258 120 305 72 401 92 C505 112 633 118 664 224 C696 333 611 430 500 452 C392 474 221 498 152 394Z" fill="#D7E6DD" stroke="#3F7568" strokeWidth="4" />
                  <path d="M212 166 C280 222 298 316 254 416" fill="none" stroke="#183F34" strokeWidth="2" opacity=".18" />
                  <path d="M404 94 C376 196 406 304 500 452" fill="none" stroke="#183F34" strokeWidth="2" opacity=".18" />
                  <path d="M116 402 C200 358 284 340 372 360 C472 382 558 344 682 286" fill="none" stroke="#3F7568" strokeWidth="20" strokeLinecap="round" opacity=".25" />
                  <path d="M126 416 C224 372 292 380 376 398 C470 418 570 366 690 312" fill="none" stroke="#183F34" strokeWidth="3" strokeDasharray="8 12" opacity=".55" />
                  <path d="M258 172 L306 94 L352 174 ZM452 198 L506 112 L558 204 ZM326 304 L374 222 L424 308 Z" fill="#183F34" opacity=".2" />
                </svg>
                {destinations.map((place) => {
                  const active = place.id === currentDestination.id;
                  return (
                    <button
                      key={place.id}
                      type="button"
                      className={`pulse-soft absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white p-2 text-left shadow-lg transition hover:scale-110 focus:outline focus:outline-2 focus:outline-offset-4 focus:outline-[#183F34] ${active ? "bg-[#183F34]" : "bg-[#E7B96A]"}`}
                      style={{ left: place.marker.x, top: place.marker.y }}
                      aria-label={`${place.name[lang]} marker`}
                      onClick={() => openDestination(place.id)}
                    >
                      <span className="block h-2.5 w-2.5 rounded-full bg-white" />
                      {active ? (
                        <span className="absolute left-1/2 top-7 min-w-28 -translate-x-1/2 rounded-full bg-[#183F34] px-3 py-1 text-center text-xs text-white">
                          {t.currentScan}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                {destinations.slice(0, 3).map((place) => (
                  <button key={place.id} type="button" onClick={() => openDestination(place.id)} className="rounded-[8px] bg-white/78 p-4 text-left transition hover:-translate-y-1 hover:bg-white">
                    <p className="font-display text-2xl text-[#183F34]">{place.name[lang]}</p>
                    <p className="mt-1 text-sm text-[#6D756F]">{place.tagline[lang]}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="stories" className="bg-[#183F34] px-5 py-16 text-[#FBFAF6] sm:px-8 lg:py-24">
        <div className="mx-auto max-w-7xl">
          <p className="text-sm uppercase tracking-[0.24em] text-[#A8CEC1]">{t.stories}</p>
          <h2 className="font-display mt-3 max-w-4xl text-4xl leading-tight sm:text-6xl">{t.storiesIntro}</h2>
          <div className="mt-10 grid gap-6">
            {destinations.map((place, index) => (
              <article
                id={`destination-${place.id}`}
                key={place.id}
                className={`story-card group relative min-h-[78vh] overflow-hidden rounded-[8px] bg-[#1D2925] shadow-2xl shadow-black/25 ${activeDetail === place.id ? "ring-2 ring-[#E7B96A]" : ""}`}
              >
                <Image
                  src="/hero-ninh-binh.png"
                  alt={place.name[lang]}
                  fill
                  sizes="100vw"
                  className="story-image object-cover opacity-72 transition duration-700 group-hover:scale-[1.035]"
                  style={{ objectPosition: place.imagePosition }}
                />
                <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(29,41,37,.88),rgba(29,41,37,.48)_48%,rgba(29,41,37,.14)),linear-gradient(180deg,transparent,rgba(29,41,37,.8))]" />
                <div className="relative flex min-h-[78vh] flex-col justify-end p-6 sm:p-10 lg:p-14">
                  <p className="text-xs uppercase tracking-[0.24em] text-[#FBFAF6]/70">{place.coords}</p>
                  <h3 className="font-display mt-4 max-w-4xl text-5xl leading-none sm:text-7xl lg:text-8xl">{place.name[lang]}</h3>
                  <p className="mt-6 max-w-2xl text-xl leading-8 text-[#FBFAF6]/88 sm:text-2xl">{place.tagline[lang]}</p>
                  <p className="mt-4 max-w-2xl leading-7 text-[#FBFAF6]/76">{place.description[lang]}</p>
                  <div className="mt-7 flex flex-wrap gap-2">
                    {place.tags[lang].map((tag) => (
                      <span key={tag} className="rounded-full border border-white/24 bg-white/10 px-3 py-1 text-sm backdrop-blur">
                        {tag}
                      </span>
                    ))}
                  </div>
                  <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                    <button type="button" onClick={() => setActiveDetail(place.id)} className="rounded-full bg-[#FBFAF6] px-5 py-3 text-center font-semibold text-[#183F34] transition hover:bg-[#E7B96A]">
                      {t.discover}
                    </button>
                    <button type="button" onClick={() => addDestination(place.id)} className="rounded-full border border-white/35 px-5 py-3 text-center font-semibold transition hover:bg-white/12">
                      {addedIds.includes(place.id) ? t.added : t.add}
                    </button>
                  </div>
                </div>
                <span className="absolute right-6 top-6 font-display text-6xl text-white/12 sm:text-8xl">0{index + 1}</span>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="ai" className="px-5 py-16 sm:px-8 lg:py-24">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div className="reveal-panel">
            <p className="text-sm uppercase tracking-[0.24em] text-[#3F7568]">{t.aiLabel}</p>
            <h2 className="font-display mt-3 text-4xl text-[#183F34] sm:text-6xl">{t.aiTitle}</h2>
            <p className="mt-5 max-w-xl text-lg leading-8 text-[#4d5b55]">{t.aiBody}</p>
          </div>
          <div className="rounded-[8px] border border-[#A8CEC1]/70 bg-white p-5 shadow-xl shadow-[#183F34]/10">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {chipGroups.map((chip) => {
                const selected = selectedChips.includes(chip.id);
                return (
                  <button
                    key={chip.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => toggleChip(chip.id)}
                    className={`rounded-full border px-3 py-2 text-sm transition focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[#3F7568] ${selected ? "border-[#183F34] bg-[#183F34] text-white" : "border-[#A8CEC1] text-[#183F34] hover:bg-[#F6F1E7]"}`}
                  >
                    {chip[lang]}
                  </button>
                );
              })}
            </div>
            <label className="mt-5 block" htmlFor="journey-prompt">
              <span className="sr-only">{t.input}</span>
              <textarea
                id="journey-prompt"
                className="min-h-32 w-full resize-none rounded-[8px] border border-[#A8CEC1] bg-[#FBFAF6] p-4 text-[#1D2925] outline-none transition focus:border-[#3F7568]"
                placeholder={t.input as string}
                defaultValue={lang === "en" ? "I have one day, I am travelling with my parents, and I prefer a relaxed cultural route." : "Tôi có một ngày, đi cùng bố mẹ và muốn một lịch trình văn hóa nhẹ nhàng."}
              />
            </label>
            <div className="mt-4 flex justify-end gap-3">
              <button type="button" className="rounded-full border border-[#A8CEC1] px-4 py-2 text-[#183F34]">{t.voice}</button>
              <button type="button" onClick={createJourney} disabled={loading} className="min-w-40 rounded-full bg-[#183F34] px-5 py-2 font-semibold text-white transition hover:bg-[#24594a] disabled:cursor-wait disabled:opacity-75">
                {loading ? t.creating : t.create}
              </button>
            </div>
          </div>
        </div>
      </section>

      <section id="itinerary" className="bg-[#F6F1E7] px-5 py-16 sm:px-8 lg:py-24">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1.05fr_.95fr]">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-[#3F7568]">{t.journey}</p>
            <h2 className="font-display mt-3 text-4xl text-[#183F34] sm:text-6xl">{t.journey}</h2>
            <p className="mt-3 text-[#6D756F]">{t.journeyNote}</p>
            <div className="mt-6 overflow-hidden rounded-[8px] border border-[#A8CEC1]/70 bg-[#FBFAF6]">
              {itinerary.map((stop, index) => (
                <article key={`${stop.time}-${stop.id}-${index}`} className="grid gap-4 border-b border-[#A8CEC1]/40 p-4 last:border-b-0 sm:grid-cols-[88px_1fr_auto]">
                  <p className="font-semibold text-[#183F34]">{stop.time}</p>
                  <div>
                    <h3 className="font-display text-2xl text-[#183F34]">{stop.title[lang]}</h3>
                    <p className="mt-1 text-sm text-[#6D756F]">{stop.transport[lang]} · {stop.distance[lang]}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {stop.tags[lang].map((tag) => (
                        <span key={tag} className="rounded-full bg-[#F6F1E7] px-3 py-1 text-xs text-[#3F7568]">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-start gap-2 sm:justify-end">
                    <span className="rounded-full bg-[#F6F1E7] px-3 py-2 text-sm text-[#3F7568]">{stop.duration[lang]}</span>
                    <button type="button" onClick={() => openDestination(stop.id === "local_lunch" ? "trang_an" : stop.id)} className="rounded-full border border-[#A8CEC1] px-3 py-2 text-sm text-[#183F34]">{t.directions}</button>
                    <button type="button" onClick={() => replaceStop(index)} className="rounded-full border border-[#A8CEC1] px-3 py-2 text-sm text-[#183F34]">{t.replace}</button>
                    <button type="button" onClick={() => removeStop(index)} className="rounded-full border border-[#A94442]/30 px-3 py-2 text-sm text-[#A94442]">{t.remove}</button>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <aside id="experience" className="rounded-[8px] bg-[#183F34] p-6 text-[#FBFAF6] shadow-xl shadow-[#183F34]/20">
            <p className="text-sm uppercase tracking-[0.24em] text-[#A8CEC1]">{t.packageTitle}</p>
            <h2 className="font-display mt-4 text-4xl">{t.packageName}</h2>
            <p className="mt-4 leading-7 text-[#FBFAF6]/78">{t.packageDetail}</p>
            <ul className="mt-6 space-y-3 text-[#FBFAF6]/85">
              {packageItems[lang].map((item) => (
                <li key={item} className="flex gap-3">
                  <span className="mt-2 h-1.5 w-1.5 rounded-full bg-[#E7B96A]" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <p className="mt-6 rounded-[8px] bg-white/10 p-4 text-[#FBFAF6]/86">{t.packageFit}</p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button type="button" onClick={() => scrollToId("experience")} className="rounded-full border border-white/30 px-5 py-3 text-center font-semibold transition hover:bg-white/10">{t.view}</button>
              <button type="button" onClick={() => setCheckoutOpen(true)} className="rounded-full bg-[#E7B96A] px-5 py-3 text-center font-semibold text-[#183F34] transition hover:bg-[#f0c87c]">{t.reserve}</button>
            </div>
            <p className="mt-5 text-xs uppercase tracking-[0.18em] text-[#A8CEC1]">{t.noPayment}</p>
          </aside>
        </div>
      </section>

      {checkoutOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#1D2925]/70 px-5 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="checkout-title">
          <div className="w-full max-w-lg rounded-[8px] bg-[#FBFAF6] p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.22em] text-[#3F7568]">{t.demoPayment}</p>
                <h2 id="checkout-title" className="font-display mt-2 text-4xl text-[#183F34]">{t.checkoutTitle}</h2>
              </div>
              <button type="button" onClick={() => setCheckoutOpen(false)} className="rounded-full border border-[#A8CEC1] px-3 py-1.5 text-sm text-[#183F34]">
                {t.close}
              </button>
            </div>
            <div className="mt-6 space-y-3">
              {[t.guests, t.transport, t.meal, t.contact, t.demoPayment].map((step, index) => (
                <div key={step as string} className="flex items-center gap-3 rounded-[8px] border border-[#A8CEC1]/70 bg-white p-3">
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-[#183F34] text-sm text-white">{index + 1}</span>
                  <span className="text-[#1D2925]">{step}</span>
                </div>
              ))}
            </div>
            <p className="mt-5 rounded-[8px] bg-[#F6F1E7] p-4 font-semibold text-[#A94442]">{t.noPayment}</p>
            <button type="button" onClick={() => setCheckoutOpen(false)} className="mt-5 w-full rounded-full bg-[#183F34] px-5 py-3 font-semibold text-white">
              {t.confirm}
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}
