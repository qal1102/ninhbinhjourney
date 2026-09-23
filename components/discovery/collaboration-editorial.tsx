"use client";

import Image from "next/image";
import { WorldSwitcher } from "@/components/discovery/world-switcher";
import Link from "next/link";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useEffect, useRef, useState } from "react";
import { ProtectedMailLink } from "@/components/discovery/protected-mail-link";
import { CONTACT as contact } from "@/content/contact";

type Language = "en" | "vi";

type DossierChapter = {
  id: "celine" | "chanel" | "prada" | "bottega" | "hermes";
  brand: string;
  image: string;
  tone: string;
  kicker: Record<Language, string>;
  title: Record<Language, string>;
  body: Record<Language, string>;
};

const chapters: readonly DossierChapter[] = [
  {
    id: "celine",
    brand: "Celine",
    image: "/images/campaigns/mid-autumn-2026/brand-proposals/celine-concept.webp",
    tone: "#ece8df",
    kicker: { vi: "01 · áo dài · hồ sen · sớm mai", en: "01 · ao dai · lotus lake · morning" },
    title: { vi: "Áo dài bên hồ sen lúc sớm", en: "A study in stillness." },
    body: { vi: "Ý tưởng bộ ảnh ở Tràng An: áo dài màu kem, nền đen, mặt hồ lúc sáng sớm.", en: "Black, a cream ao dai and first light on the water form an independent image study for Trang An." },
  },
  {
    id: "chanel",
    brand: "Chanel",
    image: "/images/campaigns/mid-autumn-2026/brand-proposals/chanel-concept.webp",
    tone: "#f0ede7",
    kicker: { vi: "02 · tweed · ngọc trai · mùa sen", en: "02 · tweed · pearls · lotus season" },
    title: { vi: "Sen và ngọc trai trước núi đá", en: "Flowers against ancient stone." },
    body: { vi: "Vải tweed, ngọc trai và hoa sen trong một khung ảnh thử, núi đá Ninh Bình vẫn là phần chính.", en: "Tweed, pearls and lotus meet in an experimental frame that leaves Ninh Binh limestone in the leading role." },
  },
  {
    id: "prada",
    brand: "Prada",
    image: "/images/campaigns/mid-autumn-2026/brand-proposals/prada-concept.webp",
    tone: "#dce2d6",
    kicker: { vi: "03 · phom dáng · mặt nước · núi đá", en: "03 · silhouette · water · limestone" },
    title: { vi: "Dáng áo gọn trên mặt nước", en: "A sharper kind of calm." },
    body: { vi: "Người mẫu đứng giữa mặt nước phẳng lặng. Đây là ý tưởng tự đề xuất, chưa ai đặt hàng.", en: "A precise silhouette stands by still water; this is an uncommissioned editorial proposal, not an existing campaign." },
  },
  {
    id: "bottega",
    brand: "Bottega Veneta",
    image: "/images/campaigns/mid-autumn-2026/brand-proposals/bottega-veneta-concept.webp",
    tone: "#d7dfce",
    kicker: { vi: "04 · bề mặt đan · sắc xanh · ánh chiều", en: "04 · weave · green · evening light" },
    title: { vi: "Đồ đan và nghề cói Kim Sơn", en: "Beauty in the making." },
    body: { vi: "Ý tưởng ghép đồ đan với nghề cói Kim Sơn và thuyền chèo tay. Đây là gợi ý để bàn, chưa phải hợp tác.", en: "Woven surfaces, Kim Son and paddle rhythm are prompts for a creative conversation, never a confirmation of collaboration." },
  },
  {
    id: "hermes",
    brand: "Hermès",
    image: "/images/campaigns/mid-autumn-2026/brand-proposals/hermes-concept.webp",
    tone: "#a64c27",
    kicker: { vi: "05 · da thuộc · lụa · dòng Ngô Đồng", en: "05 · leather · silk · Ngo Dong River" },
    title: { vi: "Thuyền nan qua Tam Cốc", en: "Far away, then home." },
    body: { vi: "Túi da màu mật ong, khăn lụa cam trên thuyền nan qua Tam Cốc. Đây là ý tưởng tự làm, Hermès không liên quan và chưa chấp thuận.", en: "Honeyed leather, orange silk and a sampan through Tam Coc close the dossier as an independent study, with no affiliation or endorsement from Hermès." },
  },
] as const;

const archive = [
  { brand: "BVLGARI", title: { vi: "Salon bên mặt hồ", en: "A lakeside salon" }, images: ["/images/campaigns/mid-autumn-2026/luxury-editorial/bvlgari-night-salon.webp"] },
  { brand: "Dior", title: { vi: "Ghi chú hương sen", en: "A lotus note" }, images: ["/images/campaigns/mid-autumn-2026/luxury-editorial/dior-lotus-beauty.webp", "/images/campaigns/mid-autumn-2026/luxury-editorial/dior-lotus-atelier.webp"] },
  { brand: "Gucci", title: { vi: "Khúc nhạc lúc hoàng hôn", en: "From evening song to gathering" }, images: ["/images/campaigns/mid-autumn-2026/luxury-editorial/gucci-sunset-music.webp", "/images/campaigns/mid-autumn-2026/luxury-editorial/gucci-evening-gala.webp"] },
  { brand: "Rolex", title: { vi: "Thời gian theo chân người đi", en: "Time kept by the traveller" }, images: ["/images/campaigns/mid-autumn-2026/luxury-editorial/rolex-river-explorer.webp"] },
  { brand: "Vacheron Constantin", title: { vi: "Đi qua các triều vua", en: "A slower passage through history" }, images: ["/images/campaigns/mid-autumn-2026/luxury-editorial/vacheron-constantin-heritage.webp"] },
  { brand: "Cartier", title: { vi: "Màu đỏ, sáng và tối", en: "Red, held across two moments" }, images: ["/images/campaigns/mid-autumn-2026/luxury-editorial/cartier-heritage-watch.webp", "/images/campaigns/mid-autumn-2026/luxury-editorial/cartier-night-gala.webp"] },
  { brand: "Bottega Veneta", title: { vi: "Tay người thợ", en: "Where material meets its maker" }, images: ["/images/campaigns/mid-autumn-2026/luxury-editorial/bottega-kim-son-craft.webp"] },
  { brand: "Hermès", title: { vi: "Chiều muộn trên sông", en: "The river keeps the final light" }, images: ["/images/campaigns/mid-autumn-2026/luxury-editorial/hermes-on-the-river.webp", "/images/campaigns/mid-autumn-2026/luxury-editorial/hermes-golden-pavilion.webp"] },
] as const;

const copy = {
  vi: {
    back: "Trở về hành trình du lịch", booking: "Đi tới đặt chỗ", seasonal: "Xem trang Trung thu",
    eyebrow: "Hồ sơ ý tưởng hợp tác · Ninh Bình", title: "Năm nhà mốt, năm ý tưởng chụp ảnh ở Ninh Bình",
    intro: "Hồ sơ này trình bày theo kiểu tạp chí, để mở lời bàn chuyện làm ảnh, làm sự kiện ở Ninh Bình. Ảnh và tên nhãn hàng dưới đây đều là ý tưởng chúng tôi tự làm, chưa ai đặt hàng, và không nhãn hàng nào có liên quan.",
    // Câu từ chối liên quan giữ nguyên văn cả hai thứ tiếng: đây là hợp đồng
    // pháp lý của trang, `tests/security/no-third-party-brands.test.ts` canh.
    legal: "Xin nói rõ: tất cả là ý tưởng chúng tôi tự đề xuất (independent creative study / uncommissioned concept / no affiliation or endorsement). Không có hợp tác, tài trợ, chấp thuận hay chứng thực nào được xác nhận.",
    index: "Năm ý tưởng", archiveEyebrow: "Ảnh phác thảo", archiveTitle: "Tám ảnh phác thảo để tham khảo",
    archiveBody: "Ảnh nào ở đây cũng là ý tưởng tự làm. Tên nhãn hàng chỉ để hình dung phong cách, chưa có chiến dịch hay hợp tác nào.",
    contact: "Liên hệ trao đổi", call: "Gọi đội ngũ", closing: "Kể chúng tôi nghe bạn định làm gì",
  },
  en: {
    back: "Return to Ninh Binh travel", booking: "Go to reservations", seasonal: "Open Mid-Autumn chapter",
    eyebrow: "Independent creative dossier · Ninh Binh", title: "Five fashion houses. One landscape of limestone, water and making.",
    intro: "A magazine-form dossier for considering creative possibilities in Ninh Binh. The names and images below are independent studies, uncommissioned concepts, and do not state a relationship with any brand.",
    legal: "CLEAR NOTICE: independent creative study / uncommissioned concept / no affiliation or endorsement. No collaboration, sponsorship, approval or endorsement is confirmed.",
    index: "Index of five chapters", archiveEyebrow: "Contact sheet · image archive", archiveTitle: "Eight visual notes to be read as material, never as a promise.",
    archiveBody: "Every frame in this archive is an independent editorial concept. Brand names locate the visual study only; no campaign, partnership or endorsement exists.",
    contact: "Start a conversation", call: "Call the team", closing: "Begin with the setting, then consider the scale.",
  },
} as const;

function href(pathname: string, lang: Language, source: string) {
  const params = new URLSearchParams({ lang });
  if (source) params.set("source", source);
  return `${pathname}?${params.toString()}`;
}

export function CollaborationEditorial({ lang, source }: { lang: Language; source: string }) {
  const t = copy[lang];
  const rootRef = useRef<HTMLElement>(null);
  const [activeId, setActiveId] = useState<DossierChapter["id"]>("celine");
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const sections = Array.from(root.querySelectorAll<HTMLElement>("[data-dossier-chapter]"));
    const observer = new IntersectionObserver((entries) => {
      const next = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      const id = next?.target.getAttribute("data-dossier-chapter") as DossierChapter["id"] | null;
      if (id) setActiveId(id);
    }, { threshold: [0.15, 0.45, 0.7], rootMargin: "-18% 0px -40% 0px" });
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    gsap.registerPlugin(ScrollTrigger);
    const media = gsap.matchMedia();
    media.add("(min-width: 1024px) and (prefers-reduced-motion: no-preference)", () => {
      root.querySelectorAll<HTMLElement>("[data-dossier-chapter]").forEach((chapter, index) => {
        const image = chapter.querySelector<HTMLElement>("[data-dossier-image]");
        const copyBlock = chapter.querySelector<HTMLElement>("[data-dossier-copy]");
        if (image) {
          gsap.fromTo(
            image,
            { clipPath: "inset(11% 9% 11% 9%)", scale: 1.08 },
            {
              clipPath: "inset(0% 0% 0% 0%)",
              scale: 1,
              ease: "none",
              scrollTrigger: { trigger: chapter, start: "top 82%", end: "center 44%", scrub: 0.65 },
            },
          );
        }
        // Copy stays fully opaque at every scroll position. The dossier may
        // move like a magazine, but it must never trade readability for an
        // entrance animation or leave stale inline opacity after a motion
        // preference changes.
        if (copyBlock) {
          gsap.fromTo(
            copyBlock,
            { y: 34 },
            {
              y: 0,
              ease: "none",
              scrollTrigger: { trigger: chapter, start: "top 84%", end: "top 42%", scrub: 0.45 },
            },
          );
        }
        if (index % 2 && image) {
          gsap.to(image, {
            yPercent: 5,
            ease: "none",
            scrollTrigger: { trigger: chapter, start: "top bottom", end: "bottom top", scrub: 0.65 },
          });
        }
      });
    });
    return () => media.revert();
  }, []);

  return (
    <main ref={rootRef} data-collaboration-dossier data-dossier-active={activeId} className="min-h-screen bg-[#e9e4d9] text-[#1a2922]">
      <WorldSwitcher hienTai="collaboration" lang={lang} source={source} tone="sang" />

      <section className="border-b border-[#1a2922]/15 px-5 pb-16 pt-16 sm:px-8 sm:pb-24 sm:pt-28">
        <div className="mx-auto grid max-w-[90rem] gap-10 lg:grid-cols-[1.18fr_.82fr] lg:items-end">
          <div><p className="text-[0.62rem] font-extrabold uppercase tracking-[0.31em] text-[#6d5034]">{t.eyebrow}</p><h1 className="font-display mt-6 max-w-5xl text-5xl leading-[0.87] text-[#183f34] sm:text-7xl lg:text-[6.2rem]">{t.title}</h1></div>
          <div className="border-l border-[#a66b3d] pl-5"><p className="text-base leading-8 text-[#516158] sm:text-lg">{t.intro}</p><p data-collaboration-disclaimer className="mt-7 text-[0.63rem] font-extrabold uppercase leading-6 tracking-[0.15em] text-[#765536]">{t.legal}</p></div>
        </div>
      </section>

      <div className="relative mx-auto max-w-[90rem] lg:grid lg:grid-cols-[14rem_minmax(0,1fr)]">
        <aside className="z-30 border-b border-[#1a2922]/15 bg-[#e9e4d9]/95 lg:sticky lg:top-[4.6rem] lg:h-[calc(100svh-4.6rem)] lg:border-b-0 lg:border-r">
          <nav aria-label={t.index} className="flex overflow-x-auto px-5 py-4 [scrollbar-width:none] lg:flex-col lg:gap-1 lg:px-7 lg:py-10">
            <p className="mr-7 shrink-0 text-[0.58rem] font-extrabold uppercase tracking-[0.24em] text-[#6d5034] lg:mb-5">{t.index}</p>
            {chapters.map((chapter, index) => <a key={chapter.id} href={`#dossier-${chapter.id}`} aria-current={activeId === chapter.id ? "step" : undefined} className={`group shrink-0 border-l-2 px-3 py-2 text-left transition motion-reduce:transition-none lg:w-full ${activeId === chapter.id ? "border-[#a65b32] text-[#183f34]" : "border-transparent text-[#68736b] hover:border-[#a65b32]/45 hover:text-[#183f34]"}`}><span className="mr-2 text-[0.58rem] font-bold tracking-[0.18em]">{String(index + 1).padStart(2, "0")}</span><span className="font-display text-lg">{chapter.brand}</span></a>)}
          </nav>
          <div aria-hidden="true" className="hidden h-px bg-[#1a2922]/15 lg:block"><span className="block h-px bg-[#a65b32] transition-[width] duration-500 motion-reduce:transition-none" style={{ width: `${((chapters.findIndex((chapter) => chapter.id === activeId) + 1) / chapters.length) * 100}%` }} /></div>
        </aside>

        <section aria-label={t.index} className="overflow-hidden">
          {/*
            Khung ảnh giữ khổ DỌC 4:5 ở mọi bề rộng. Bản cũ đổi sang 16:10 từ
            `sm` trở lên, mà ảnh nguồn đều là ảnh người đứng — `object-cover`
            trong một khung ngang thì cắt mất đầu và chân, đúng chỗ chủ dự án
            nói "mấy cái hình ở hợp tác thương hiệu lệch rồi". Chỉ đạo sáng tạo
            cũng đã ghi rõ: "Ảnh dọc lớn… khổ dọc là bắt buộc — bố cục tạp chí
            dựa vào nó".
          */}
          {chapters.map((chapter, index) => {
            const finale = chapter.id === "hermes";
            return <article key={chapter.id} id={`dossier-${chapter.id}`} data-dossier-chapter={chapter.id} data-dossier-final={finale || undefined} className={`relative grid min-h-[88svh] scroll-mt-24 overflow-hidden px-5 py-14 sm:px-8 sm:py-20 lg:grid-cols-12 lg:items-center lg:px-12 xl:px-16 ${finale ? "bg-[#a64c27] text-[#fff4e9]" : "text-[#1a2922]"}`} style={finale ? undefined : { backgroundColor: chapter.tone }}>
              <span aria-hidden="true" className={`pointer-events-none absolute right-[-.08em] top-[-.22em] font-display text-[42vw] leading-none ${finale ? "text-[#f9d4a6]/15" : "text-[#1a2922]/[0.045]"}`}>{String(index + 1).padStart(2, "0")}</span>
              <div data-dossier-copy className={`relative z-10 lg:col-span-4 ${index % 2 ? "lg:order-2 lg:col-start-9" : ""}`}><p className={`text-[0.62rem] font-extrabold uppercase tracking-[0.24em] ${finale ? "text-[#ffe0ba]" : "text-[#765536]"}`}>{chapter.kicker[lang]}</p><p className="font-display mt-5 text-5xl leading-[0.86] sm:text-7xl">{chapter.brand}</p><h2 className="font-display mt-5 max-w-md text-3xl leading-[0.96] sm:text-5xl">{chapter.title[lang]}</h2><p className={`mt-6 max-w-md text-base leading-8 ${finale ? "text-white/80" : "text-[#526057]"}`}>{chapter.body[lang]}</p><p className={`mt-8 border-t pt-4 text-[0.59rem] font-bold uppercase leading-5 tracking-[0.15em] ${finale ? "border-white/35 text-[#ffe0ba]" : "border-[#1a2922]/20 text-[#765536]"}`}>Independent creative study · Uncommissioned concept · No affiliation or endorsement</p></div>
              <div className={`relative z-10 mt-10 aspect-[4/5] overflow-hidden bg-black/10 shadow-[0_32px_110px_rgba(28,33,27,.25)] lg:col-span-7 lg:mt-0 ${index % 2 ? "lg:order-1 lg:col-start-1" : "lg:col-start-6"}`}><Image data-dossier-image src={chapter.image} alt={`${chapter.brand} — ${chapter.title[lang]}`} fill loading="lazy" sizes="(min-width: 1024px) 57vw, 100vw" className="object-cover" /><span aria-hidden="true" className="absolute inset-0 ring-1 ring-inset ring-black/10" /></div>
            </article>;
          })}
        </section>
      </div>

      <section data-luxury-contact-sheet className="overflow-hidden bg-[#12100e] px-5 py-16 text-[#f5eee3] sm:px-8 sm:py-24">
        <div className="mx-auto max-w-[90rem]"><p className="text-[0.62rem] font-extrabold uppercase tracking-[0.3em] text-[#d6aa6d]">{t.archiveEyebrow}</p><h2 className="font-display mt-5 max-w-5xl text-5xl leading-[0.9] sm:text-7xl">{t.archiveTitle}</h2><p className="mt-6 max-w-3xl text-base leading-8 text-white/65">{t.archiveBody}</p></div>
        <div className="mx-auto mt-14 flex max-w-[90rem] gap-4 overflow-x-auto pb-3 [scrollbar-color:#d6aa6d_transparent] [scrollbar-width:thin] sm:mt-18">
          {archive.flatMap((study) => study.images.map((image, index) => <figure key={image} data-archive-frame className="w-[15rem] shrink-0 sm:w-[18rem]"><div className="relative aspect-[4/5] overflow-hidden bg-white/10"><Image src={image} alt={`${study.brand} — ${study.title[lang]}`} fill loading="lazy" sizes="288px" className="object-cover transition duration-700 motion-reduce:transition-none hover:scale-[1.035]" /></div><figcaption className="mt-3 flex items-baseline justify-between gap-3 text-[0.6rem] uppercase tracking-[0.14em] text-white/72"><span>{study.brand}</span><span>{String(index + 1).padStart(2, "0")}</span></figcaption></figure>))}
        </div>
      </section>

      <section className="bg-[#183f34] px-5 py-16 text-white sm:px-8 sm:py-24"><div className="mx-auto grid max-w-[90rem] gap-8 lg:grid-cols-[1fr_auto] lg:items-end"><div className="max-w-3xl"><p className="text-[0.62rem] font-extrabold uppercase tracking-[0.28em] text-[#e7c78d]">Ninh Binh Journey</p><h2 className="font-display mt-5 text-4xl leading-[0.95] sm:text-6xl">{t.closing}</h2></div><div className="flex flex-col gap-3 sm:flex-row lg:flex-col"><ProtectedMailLink subject={lang === "vi" ? "Trao đổi về hồ sơ ý tưởng Ninh Bình" : "Ninh Binh creative dossier"} className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#e7c78d] px-6 text-sm font-bold text-[#183f34] transition hover:bg-[#f0d39c]">{t.contact}</ProtectedMailLink><a href={contact.phoneHref} className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/35 px-6 text-sm font-bold transition hover:bg-white/10">{t.call} · {contact.phoneLabel}</a></div></div><div className="mx-auto mt-10 max-w-[90rem] border-t border-white/15 pt-5 text-sm text-white/70"><Link href={href("/seasonal/mid-autumn", lang, source)} transitionTypes={["portal-enter"]} className="underline underline-offset-4">{t.seasonal}</Link></div></section>
    </main>
  );
}
