import Image from "next/image";

type Language = "en" | "vi";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const copy = {
  en: {
    nav: ["Here", "Stories", "AI Companion", "Itinerary"],
    heroKicker: "Prototype - QR visitor journey",
    title: "Ninh Binh",
    subtitle: "A journey between mountains, water and timeless heritage",
    cta: "Begin your journey",
    mapCta: "Explore map",
    youAreHere: "You are here",
    source: "QR source",
    sourceFallback: "Welcome point",
    mapTitle: "A soft map for the first scan",
    mapBody:
      "This Phase 1 placeholder keeps orientation simple: heritage water routes, spiritual landmarks, evening streets, and nearby viewpoints.",
    discover: "Discover",
    add: "Add to my journey",
    stories: "Places with a story",
    storiesIntro:
      "Slow chapters for the places most visitors ask about first.",
    aiTitle: "Let's shape your journey",
    aiBody:
      "Tell me how much time you have and what kind of experience you enjoy.",
    input: "Tell me what you are looking for...",
    voice: "Voice",
    send: "Send",
    journey: "Your Ninh Binh journey",
    packageTitle: "Make this journey easier",
    packageName: "Heritage & Evening Experience",
    packageFit: "Best fit for a relaxed family day.",
    view: "View experience",
    reserve: "Reserve this experience",
  },
  vi: {
    nav: ["Ở đây", "Câu chuyện", "Bạn đồng hành AI", "Lịch trình"],
    heroKicker: "Prototype - hành trình mở từ QR",
    title: "Ninh Bình",
    subtitle: "Hành trình giữa núi, nước và di sản vượt thời gian",
    cta: "Bắt đầu hành trình",
    mapCta: "Khám phá bản đồ",
    youAreHere: "Bạn đang ở đây",
    source: "Nguồn QR",
    sourceFallback: "Điểm chào đón",
    mapTitle: "Bản đồ mềm cho lần chạm đầu tiên",
    mapBody:
      "Placeholder Phase 1 giúp du khách định hướng nhanh: tuyến nước di sản, điểm tâm linh, phố đêm và các điểm ngắm cảnh gần kề.",
    discover: "Khám phá",
    add: "Thêm vào hành trình",
    stories: "Những điểm đến có câu chuyện",
    storiesIntro:
      "Các chương chậm rãi cho những nơi du khách thường muốn biết trước tiên.",
    aiTitle: "Cùng định hình hành trình",
    aiBody:
      "Hãy cho tôi biết bạn có bao nhiêu thời gian và thích trải nghiệm như thế nào.",
    input: "Bạn đang tìm kiếm điều gì...",
    voice: "Giọng nói",
    send: "Gửi",
    journey: "Hành trình Ninh Bình của bạn",
    packageTitle: "Làm hành trình nhẹ nhàng hơn",
    packageName: "Trải nghiệm Di sản & Phố cổ buổi tối",
    packageFit: "Phù hợp cho một ngày thư thả cùng gia đình.",
    view: "Xem trải nghiệm",
    reserve: "Giữ chỗ trải nghiệm",
  },
} satisfies Record<Language, Record<string, string | string[]>>;

const destinations = [
  {
    id: "trang_an",
    name: { en: "Trang An", vi: "Tràng An" },
    coords: "20.2503 N, 105.8970 E",
    tagline: {
      en: "Where mountains meet the quiet water",
      vi: "Nơi núi đá gặp mặt nước tĩnh lặng",
    },
    description: {
      en: "A slow boat journey through limestone valleys, caves, and temple silhouettes.",
      vi: "Một chuyến thuyền chậm qua thung lũng đá vôi, hang nước và bóng đền cổ.",
    },
    tags: ["Nature", "Heritage", "3-4 hours"],
    color: "from-[#183F34] via-[#3F7568] to-[#A8CEC1]",
  },
  {
    id: "bai_dinh",
    name: { en: "Bai Dinh", vi: "Bái Đính" },
    coords: "20.2768 N, 105.8656 E",
    tagline: {
      en: "A spacious rhythm of bells, stone and hillside air",
      vi: "Nhịp chuông, đá và gió núi trong một không gian rộng mở",
    },
    description: {
      en: "A spiritual stop with grand courtyards, long corridors, and calm viewpoints.",
      vi: "Một điểm dừng tâm linh với sân rộng, hành lang dài và tầm nhìn yên tĩnh.",
    },
    tags: ["Spiritual", "Culture", "2-3 hours"],
    color: "from-[#4A3F2D] via-[#8F7444] to-[#E7B96A]",
  },
  {
    id: "tam_chuc",
    name: { en: "Tam Chuc", vi: "Tam Chúc" },
    coords: "20.5736 N, 105.9133 E",
    tagline: {
      en: "Lake light, temple roofs and a gentler northern breeze",
      vi: "Ánh hồ, mái chùa và làn gió bắc dịu nhẹ",
    },
    description: {
      en: "A contemplative lake-and-temple landscape for travelers seeking quiet scale.",
      vi: "Không gian hồ và chùa dành cho những ai muốn một trải nghiệm tĩnh và rộng.",
    },
    tags: ["Lake", "Spiritual", "Half day"],
    color: "from-[#1D2925] via-[#3F7568] to-[#D7E6DD]",
  },
  {
    id: "hoa_lu_old_town",
    name: { en: "Hoa Lu Old Town", vi: "Phố cổ Hoa Lư" },
    coords: "20.2579 N, 105.9741 E",
    tagline: {
      en: "Lantern reflections after a day on the water",
      vi: "Ánh đèn lồng sau một ngày theo dòng nước",
    },
    description: {
      en: "An easy evening chapter for food, walking streets, and soft reflections.",
      vi: "Một chương buổi tối nhẹ nhàng với ẩm thực, phố đi bộ và mặt nước phản chiếu.",
    },
    tags: ["Evening", "Family", "1-2 hours"],
    color: "from-[#183F34] via-[#7C5C38] to-[#E7B96A]",
  },
];

const markers = [
  ["Trang An", "22%", "45%"],
  ["Bai Dinh", "36%", "31%"],
  ["Tam Chuc", "53%", "18%"],
  ["Hoa Lu Old Town", "47%", "55%"],
  ["Hang Mua", "58%", "65%"],
  ["Tam Coc", "68%", "72%"],
  ["Hoa Lu Ancient Capital", "40%", "43%"],
] as const;

const itinerary = [
  ["08:00", "Trang An", "Boat journey", "3 hours"],
  ["11:30", "Local lunch", "Rice field restaurant", "75 min"],
  ["13:30", "Bai Dinh", "Electric cart + temple walk", "2.5 hours"],
  ["18:00", "Hoa Lu Old Town", "Lantern evening", "90 min"],
] as const;

const chips = ["3 hours", "1 day", "2 days", "Nature", "Culture", "Spiritual", "Family", "Relaxed", "Adventure"];

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function sourceLabel(source: string | undefined) {
  if (!source) return undefined;
  return source.replaceAll("_", " ");
}

export default async function Home({ searchParams }: PageProps) {
  const params = (await searchParams) ?? {};
  const requestedLang = firstParam(params.lang);
  const lang: Language = requestedLang === "vi" ? "vi" : "en";
  const t = copy[lang];
  const source = sourceLabel(firstParam(params.source));
  const nav = t.nav as string[];
  const langHref = (target: Language) =>
    `/?lang=${target}${source ? `&source=${encodeURIComponent(source.replaceAll(" ", "_"))}` : ""}`;

  return (
    <main className="min-h-screen bg-[#FBFAF6] text-[#1D2925]">
      <section className="relative min-h-screen overflow-hidden bg-[#183F34] text-[#FBFAF6]">
        <Image
          src="/hero-ninh-binh.png"
          alt="Morning mist over Ninh Binh limestone mountains and water"
          fill
          priority
          sizes="100vw"
          className="float-slow object-cover opacity-80"
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(24,63,52,.35),rgba(24,63,52,.58)_48%,rgba(29,41,37,.88))]" />
        <div className="absolute inset-x-0 top-0 z-10 mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
          <a href="#top" className="font-display text-xl tracking-[0.16em]">
            NB
          </a>
          <nav aria-label="Primary" className="hidden gap-6 text-sm text-[#FBFAF6]/80 md:flex">
            {nav.map((item, index) => (
              <a key={item} href={["#here", "#stories", "#ai", "#itinerary"][index]} className="transition hover:text-[#E7B96A]">
                {item}
              </a>
            ))}
          </nav>
          <div className="flex rounded-full border border-white/25 bg-white/10 p-1 text-sm backdrop-blur">
            <a className={`rounded-full px-3 py-1.5 ${lang === "en" ? "bg-[#FBFAF6] text-[#183F34]" : ""}`} href={langHref("en")}>
              EN
            </a>
            <a className={`rounded-full px-3 py-1.5 ${lang === "vi" ? "bg-[#FBFAF6] text-[#183F34]" : ""}`} href={langHref("vi")}>
              VI
            </a>
          </div>
        </div>
        <div id="top" className="relative z-10 mx-auto flex min-h-screen max-w-6xl flex-col justify-end px-5 pb-16 pt-28 sm:px-8 lg:pb-24">
          <p className="fade-up mb-5 w-fit rounded-full border border-white/25 bg-white/10 px-4 py-2 text-xs uppercase tracking-[0.24em] text-[#FBFAF6]/85 backdrop-blur">
            {t.heroKicker}
          </p>
          <h1 className="fade-up font-display text-6xl leading-[0.9] text-[#FBFAF6] sm:text-8xl lg:text-[9rem]">
            {t.title}
          </h1>
          <p className="fade-up mt-6 max-w-2xl text-xl leading-8 text-[#FBFAF6]/88 sm:text-2xl">
            {t.subtitle}
          </p>
          <div className="fade-up mt-9 flex flex-col gap-3 sm:flex-row">
            <a href="#here" className="rounded-full bg-[#E7B96A] px-6 py-3 text-center font-semibold text-[#183F34] shadow-xl shadow-black/20 transition hover:bg-[#f0c87c] focus:outline focus:outline-2 focus:outline-offset-4 focus:outline-[#E7B96A]">
              {t.cta}
            </a>
            <a href="#stories" className="rounded-full border border-white/35 px-6 py-3 text-center font-semibold text-white transition hover:bg-white/12 focus:outline focus:outline-2 focus:outline-offset-4 focus:outline-white">
              {t.mapCta}
            </a>
          </div>
        </div>
      </section>

      <section id="here" className="px-5 py-16 sm:px-8 lg:py-24">
        <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[0.82fr_1.18fr] lg:items-center">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-[#3F7568]">{t.youAreHere}</p>
            <h2 className="font-display mt-3 text-5xl text-[#183F34] sm:text-6xl">Ninh Binh</h2>
            <div className="mt-6 rounded-[8px] border border-[#A8CEC1]/60 bg-white/70 p-5 shadow-sm">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#6D756F]">{t.source}</p>
              <p className="mt-2 text-xl capitalize text-[#183F34]">{source ?? t.sourceFallback}</p>
            </div>
            <p className="mt-7 max-w-xl text-lg leading-8 text-[#4d5b55]">{t.mapBody}</p>
          </div>

          <div className="relative overflow-hidden rounded-[8px] border border-[#A8CEC1]/60 bg-[#F6F1E7] p-5 shadow-xl shadow-[#183F34]/10">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(231,185,106,.25),transparent_28%),radial-gradient(circle_at_80%_75%,rgba(168,206,193,.35),transparent_30%)]" />
            <div className="relative">
              <p className="mb-4 text-sm uppercase tracking-[0.22em] text-[#3F7568]">{t.mapTitle}</p>
              <div className="relative aspect-[4/5] sm:aspect-[16/11]">
                <svg viewBox="0 0 720 520" role="img" aria-label="Stylized Ninh Binh map placeholder" className="h-full w-full">
                  <path d="M116 340 C150 178 244 78 386 92 C532 106 642 220 604 350 C568 472 402 474 282 430 C206 402 86 426 116 340Z" fill="#D7E6DD" stroke="#3F7568" strokeWidth="4" />
                  <path d="M78 395 C176 354 262 338 350 355 C448 374 526 354 642 288" fill="none" stroke="#3F7568" strokeWidth="18" strokeLinecap="round" opacity=".28" />
                  <path d="M104 405 C204 366 266 374 350 390 C446 408 544 362 650 314" fill="none" stroke="#183F34" strokeWidth="3" strokeDasharray="8 12" opacity=".55" />
                  <path d="M238 170 L286 96 L332 172 ZM416 196 L472 106 L526 200 ZM308 300 L354 224 L402 304 Z" fill="#183F34" opacity=".2" />
                </svg>
                {markers.map(([name, left, top], index) => (
                  <button
                    key={name}
                    type="button"
                    className={`pulse-soft absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-[#E7B96A] p-2 text-left shadow-lg transition hover:scale-110 focus:outline focus:outline-2 focus:outline-offset-4 focus:outline-[#183F34] ${index === 0 ? "bg-[#183F34]" : ""}`}
                    style={{ left, top }}
                    aria-label={`${name} marker`}
                  >
                    <span className="block h-2.5 w-2.5 rounded-full bg-white" />
                  </button>
                ))}
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {destinations.slice(0, 2).map((place) => (
                  <article key={place.id} className="rounded-[8px] bg-white/78 p-4">
                    <p className="font-display text-2xl text-[#183F34]">{place.name[lang]}</p>
                    <p className="mt-1 text-sm text-[#6D756F]">{place.tagline[lang]}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {place.tags.slice(0, 2).map((tag) => (
                        <span key={tag} className="rounded-full bg-[#F6F1E7] px-3 py-1 text-xs text-[#3F7568]">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="stories" className="bg-[#183F34] px-5 py-16 text-[#FBFAF6] sm:px-8 lg:py-24">
        <div className="mx-auto max-w-6xl">
          <p className="text-sm uppercase tracking-[0.24em] text-[#A8CEC1]">{t.stories}</p>
          <h2 className="font-display mt-3 max-w-3xl text-4xl leading-tight sm:text-6xl">{t.storiesIntro}</h2>
          <div className="mt-10 grid gap-5">
            {destinations.map((place, index) => (
              <article key={place.id} className="group relative min-h-[72vh] overflow-hidden rounded-[8px] bg-[#1D2925] shadow-2xl shadow-black/25">
                <div className={`absolute inset-0 bg-gradient-to-br ${place.color} opacity-90 transition duration-700 group-hover:scale-[1.03]`} />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_18%,rgba(251,250,246,.24),transparent_22%),linear-gradient(180deg,transparent,rgba(29,41,37,.78))]" />
                <div className="relative flex min-h-[72vh] flex-col justify-end p-6 sm:p-10 lg:p-12">
                  <p className="text-xs uppercase tracking-[0.24em] text-[#FBFAF6]/70">{place.coords}</p>
                  <h3 className="font-display mt-4 text-5xl leading-none sm:text-7xl">{place.name[lang]}</h3>
                  <p className="mt-5 max-w-2xl text-xl leading-8 text-[#FBFAF6]/88">{place.tagline[lang]}</p>
                  <p className="mt-3 max-w-xl leading-7 text-[#FBFAF6]/76">{place.description[lang]}</p>
                  <div className="mt-6 flex flex-wrap gap-2">
                    {place.tags.map((tag) => (
                      <span key={tag} className="rounded-full border border-white/24 bg-white/10 px-3 py-1 text-sm backdrop-blur">
                        {tag}
                      </span>
                    ))}
                  </div>
                  <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                    <a href="#ai" className="rounded-full bg-[#FBFAF6] px-5 py-3 text-center font-semibold text-[#183F34] transition hover:bg-[#E7B96A]">
                      {t.discover}
                    </a>
                    <a href="#itinerary" className="rounded-full border border-white/35 px-5 py-3 text-center font-semibold transition hover:bg-white/12">
                      {t.add}
                    </a>
                  </div>
                </div>
                <span className="absolute right-6 top-6 font-display text-6xl text-white/10 sm:text-8xl">0{index + 1}</span>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="ai" className="px-5 py-16 sm:px-8 lg:py-24">
        <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-[#3F7568]">AI Journey Companion</p>
            <h2 className="font-display mt-3 text-4xl text-[#183F34] sm:text-6xl">{t.aiTitle}</h2>
            <p className="mt-5 max-w-xl text-lg leading-8 text-[#4d5b55]">{t.aiBody}</p>
          </div>
          <div className="rounded-[8px] border border-[#A8CEC1]/70 bg-white p-5 shadow-xl shadow-[#183F34]/10">
            <div className="flex flex-wrap gap-2">
              {chips.map((chip) => (
                <button key={chip} type="button" className="rounded-full border border-[#A8CEC1] px-3 py-2 text-sm text-[#183F34] transition hover:bg-[#F6F1E7] focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[#3F7568]">
                  {chip}
                </button>
              ))}
            </div>
            <label className="mt-5 block" htmlFor="journey-prompt">
              <span className="sr-only">{t.input}</span>
              <textarea id="journey-prompt" className="min-h-32 w-full resize-none rounded-[8px] border border-[#A8CEC1] bg-[#FBFAF6] p-4 text-[#1D2925] outline-none transition focus:border-[#3F7568]" placeholder={t.input as string} defaultValue={lang === "en" ? "I have one day, I am travelling with my parents, and I prefer a relaxed cultural route." : "Tôi có một ngày, đi cùng bố mẹ và muốn một lịch trình văn hóa nhẹ nhàng."} />
            </label>
            <div className="mt-4 flex justify-end gap-3">
              <button type="button" className="rounded-full border border-[#A8CEC1] px-4 py-2 text-[#183F34]">{t.voice}</button>
              <button type="button" className="rounded-full bg-[#183F34] px-5 py-2 font-semibold text-white">{t.send}</button>
            </div>
          </div>
        </div>
      </section>

      <section id="itinerary" className="bg-[#F6F1E7] px-5 py-16 sm:px-8 lg:py-24">
        <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1.05fr_.95fr]">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-[#3F7568]">{t.journey}</p>
            <div className="mt-6 overflow-hidden rounded-[8px] border border-[#A8CEC1]/70 bg-[#FBFAF6]">
              {itinerary.map(([time, title, transport, duration]) => (
                <article key={`${time}-${title}`} className="grid grid-cols-[84px_1fr] gap-4 border-b border-[#A8CEC1]/40 p-4 last:border-b-0 sm:grid-cols-[110px_1fr_auto]">
                  <p className="font-semibold text-[#183F34]">{time}</p>
                  <div>
                    <h3 className="font-display text-2xl text-[#183F34]">{title}</h3>
                    <p className="mt-1 text-sm text-[#6D756F]">{transport}</p>
                  </div>
                  <p className="hidden rounded-full bg-[#F6F1E7] px-3 py-2 text-sm text-[#3F7568] sm:block">{duration}</p>
                </article>
              ))}
            </div>
          </div>

          <aside className="rounded-[8px] bg-[#183F34] p-6 text-[#FBFAF6] shadow-xl shadow-[#183F34]/20">
            <p className="text-sm uppercase tracking-[0.24em] text-[#A8CEC1]">{t.packageTitle}</p>
            <h2 className="font-display mt-4 text-4xl">{t.packageName}</h2>
            <ul className="mt-6 space-y-3 text-[#FBFAF6]/85">
              {["Boat journey", "Local lunch", "Private transfer", "Bai Dinh visit", "Evening at Hoa Lu Old Town"].map((item) => (
                <li key={item} className="flex gap-3">
                  <span className="mt-2 h-1.5 w-1.5 rounded-full bg-[#E7B96A]" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <p className="mt-6 rounded-[8px] bg-white/10 p-4 text-[#FBFAF6]/86">{t.packageFit}</p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <a href="#stories" className="rounded-full border border-white/30 px-5 py-3 text-center font-semibold transition hover:bg-white/10">{t.view}</a>
              <a href="#ai" className="rounded-full bg-[#E7B96A] px-5 py-3 text-center font-semibold text-[#183F34] transition hover:bg-[#f0c87c]">{t.reserve}</a>
            </div>
            <p className="mt-5 text-xs uppercase tracking-[0.18em] text-[#A8CEC1]">Demo recommendation - no payment in Phase 1</p>
          </aside>
        </div>
      </section>
    </main>
  );
}
