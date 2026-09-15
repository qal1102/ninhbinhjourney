"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Reveal } from "@/components/shared/reveal";
import { RevealHeading } from "@/components/shared/reveal-heading";
import { findFlipStart, type FlipStart } from "@/components/shared/flip-image";
import { useNinhBinhHour, type DayBand } from "@/components/shared/ninh-binh-hour";
import {
  TrangAnScrollStory,
  type TrangAnStoryBeat,
} from "@/components/discovery/trang-an-scroll-story";
import { DestinationZigzag } from "@/components/discovery/destination-zigzag";
import { DestinationIndex } from "@/components/discovery/destination-index";
import { JourneyCta } from "@/components/discovery/journey-cta";
import { JOURNEY_CONCIERGE_OPEN_EVENT, JourneyConcierge } from "@/components/discovery/journey-concierge";
import { MidAutumnCampaign } from "@/components/discovery/mid-autumn-campaign";
import { PackageShowcase } from "@/components/discovery/package-showcase";
import { RouteShowcaseCard } from "@/components/discovery/route-showcase-card";
import { CinematicVideo, type CinematicClip } from "@/components/shared/cinematic-video";
import type { ExperienceSurfaceAttributes } from "@/config/experience";
import { CONTACT as contactInfo } from "@/content/contact";
import { ProtectedMailLink } from "@/components/discovery/protected-mail-link";
import {
  destinationFacts,
  destinationPageHref,
  destinations,
  type Destination,
  type DestinationId,
  type Language,
  type Localized,
} from "@/content/landing-destinations";

// Giữ đường nhập cũ cho các tệp đang lấy kiểu từ trang chủ.
export type { Destination, DestinationId, Language } from "@/content/landing-destinations";

export type MapCopy = {
  add: string;
  added: string;
  discover: string;
  welcome: string;
  welcomeDescription: string;
  youAreHere: string;
  nearMe: string;
  locating: string;
  locationFound: string;
  locationOutside: string;
  locationDenied: string;
};

type ItineraryStop = {
  id: DestinationId | "local_lunch";
  time: string;
  title: Localized;
  note: Localized;
  duration: Localized;
  distance: Localized;
  tags: Record<Language, string[]>;
};

type Props = {
  initialLang: Language;
  source: string;
  presentationMode: boolean;
  bookingEnabled: boolean;
  surfaceAttributes: ExperienceSurfaceAttributes;
};

const TourismMap = dynamic(() => import("./tourism-map"), {
  loading: () => (
    <div className="grid h-[560px] min-h-[70vh] place-items-center rounded-[8px] bg-[#D7E6DD] text-[#183F34]">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#A8CEC1] border-t-[#183F34]" />
    </div>
  ),
  ssr: false,
});

const copy = {
  en: {
    // Nhan thu hai tung la "Stories", tro toi khoi `#stories` da xoa.
    // Gio no tro toi danh muc diem den, nen phai goi dung ten.
    nav: ["Places", "Routes", "Packages", "Moon season"],
    introTop: "Ninh Binh",
    introWords: ["Nature.", "Heritage.", "Wonder."],
    title: "Ninh Binh",
    subtitle: "A journey between mountains, water and timeless heritage",
    footerNote: "Ninh Binh Journey · A journey between mountains, water and timeless heritage.",
    /*
     * TC-23: the only entry point for a guest who booked, closed the tab and
     * now has nothing to show at the gate. It stays a quiet footer line on
     * purpose -- no third navigation layer on this page.
     */
    footerLookup: "Already booked? Open your ticket again",
    begin: "Plan my journey",
    exploreMap: "Explore map",
    /*
     * Duong thu ba vao gioi thieu trang chu: khong them nut thu ba ngang
     * hang voi hai nut tren (tranh dung lai kieu "ba lop dieu huong bang
     * nhau" da bi chu du an loai hai lan tren chinh trang nay, xem
     * UI_UX_RULES.md#known-incident). Day chi la mot dong chu ngan, chi
     * xuong khoi #packages ngay tren trang, va noi dung doi theo
     * `bookingEnabled` de khong hua giu cho khi chua bat that.
     */
    heroPackagesCue: "Explore five ready-made journeys",
    heroPackagesCuePlain: "Explore five ready-made journeys",
    /*
     * Dong gio thuc tai Ninh Binh. Moi khung gio mot chi tiet CHI NINH
     * BINH moi noi duoc -- dat phep thu o UI_UX_RULES.md#voice-rules:
     * doi "Ninh Binh" thanh "Ha Long" ma cau van dung thi cau do la cau
     * chung chung, phai viet lai. "Mat song", "ben Trang An", "trien lua
     * Tam Coc", "Thung Nham", "vom hang" deu khong the chuyen cho.
     */
    hourLead: "In Ninh Bình it is",
    hourPhrases: {
      dawn: "and the mist has not lifted off the river",
      morning: "and the boats left Tràng An early",
      midday: "and the sun stands straight above the limestone",
      afternoon: "and late light runs gold across the Tam Cốc fields",
      dusk: "and the birds are coming back to Thung Nham",
      night: "and there is only an oar, somewhere under the caves",
    },
    journeysLabel: "Curated Ninh Binh",
    journeysTitle: "Stories, not stops",
    journeysBody:
      "Each route tells its own thread: water first, temples next, then forest and lantern light as the day slows down. Drag through, and pick the one that sounds like the day you want.",
    viewRoute: "View route",
    /*
     * Khoi "gói trải nghiệm" dat ngay sau dai tuyen goi y, truoc JourneyCta
     * -- xem PackageShowcase o components/discovery/package-showcase.tsx.
     * Chu o day chi la khung/nhan cua khoi; ten/gia/lich tung goi lay
     * THANG tu content/packages.ts, khong bia them o day.
     */
    packagesLabel: "Ready-made packages",
    packagesTitle: "Five journeys, with the route and price mapped out.",
    packagesIntro:
      "Begin at Tràng An before the boats gather, or keep Tam Cốc for the late light. Each journey already has its timing, entry points and a clear way to reserve.",
    packagesBookingNote: "Choose a date to continue your reservation. No payment will be collected.",
    packagesBookingNotePlain: "The routes and prices are ready to browse; online reservation is not yet open.",
    packagesCta: "View this package",
    packagesViewAll: "See all five packages",
    packagesPricePerGuest: "per adult",
    // WEB-STRUCT-02: loi dat cho qua dien thoai, ngoai nut vao tung goi.
    // So/email that lay tu `content/contact.ts`, khong dat trong bang chu.
    packagesCallCta: "Call to reserve directly",
    packagesEmailCta: "Email to reserve",
    packagesCallNote: "Prefer to book by phone? Call Xuân Trường directly.",
    exploreRouteStop: "Explore this stop",
    routeStopLabel: "Stop",
    addRoute: "Add route",
    youAreHere: "You are here",
    qrSource: "QR source",
    welcomePoint: "Ninh Binh welcome point",
    mapTitle: "Interactive tourism map",
    mapBody:
      "All four core zones of the Tràng An heritage site fit inside this frame, along with the old capital at Hoa Lư and the stone cathedral at Phát Diệm out toward the coast. Touch a point and let that place tell its own story.",
    nearby: "Explore nearby",
    discover: "Discover",
    add: "Add to journey",
    added: "Added",
    stories: "Destination stories",
    storiesIntro:
      "Three stories to begin with. Read them slowly — these places have waited thousands of years, and they are in no hurry.",
    signatureStories: "Signature route",
    hiddenGems: "Quieter corners of Ninh Bình",
    hiddenGemsIntro:
      "Vân Long wetland, Am Tiên cave, Bích Động pagoda, Thái Vi temple. Quieter, and mostly missed by anyone giving Ninh Bình two days.",
    seeAllDestinations: "See all destinations",
    /*
     * WEB-STRUCT-02: khoi "diem noi bat" ngan, dat truoc danh muc day du
     * (DestinationZigzag/DestinationIndex) -- xem `FEATURED_DESTINATION_IDS`.
     * Chu lay dung du kien da co trong `zigzagIntro`/`hourPhrases` phia
     * tren (486 bac da Hang Mua, hang song Ngo Dong o Tam Coc), khong bia
     * moi.
     */
    featuredLabel: "Signature stops",
    featuredTitle: "Six places to begin with, before the other nine",
    featuredIntro:
      "Trang An opens by boat, Hang Mua closes with 486 stone steps, and Hoa Lu Old Town holds onto its lantern light once the sun goes down. These are the six names that keep coming up when people talk about Ninh Bình — the full list of fifteen sits just below.",
    featuredCta: "See all fifteen destinations",
    destinationPage: "Open this place's own page",
    /*
     * WEB-STRUCT-02: loi moi hop tac cho nhan hang/doanh nghiep. Khong nhac
     * ten thuong hieu nao o day. Tu 13/09/2026 trang cung khong con khoi
     * thuong hieu nao (BRAND-LEGAL-01 trong docs/HANDOFF.md).
     */
    partnersLabel: "For brands & businesses",
    partnersTitle: "Want to film at Trang An, or host dinner by the Ngô Đồng?",
    partnersBody:
      "Ninh Bình Journey works directly with brands and businesses that want to hold an event, shoot commercial footage or partner with us for a season here in Ninh Bình — from the still water of Trang An to the rice-lined banks of Tam Cốc. Call Xuân Trường directly, and the team will work out the location, schedule and scale before anything is booked.",
    partnersCategory1Title: "Private events",
    partnersCategory1Body: "A wedding, a launch or a gathering right on the water at Trang An.",
    partnersCategory2Title: "Commercial shoots",
    partnersCategory2Body: "Film and photo crews that need limestone peaks, caves and river settings.",
    partnersCategory3Title: "Seasonal partnership",
    partnersCategory3Body: "Shape a seasonal programme for Ninh Bình.",
    partnersCall: "Call to discuss",
    partnersEmail: "Send a partnership email",
    /*
     * `zigzag*` gio chi con dung cho VAI DIEM DAU (xem `ZIGZAG_FEATURED`).
     * `index*` la khoi danh sach cho phan con lai. Khong bia con so nao o
     * day -- khong co du lieu that ve so ngay khach o lai.
     */
    indexLabel: "The rest of the map",
    // QA-P2-09: danh sach nay co ca Hang Mua va Co do Hoa Lu, hai noi dong
    // khach nhat -- cau cu goi ca muoi noi la "cho bi gach dau tien" la noi sai.
    indexTitle: "Ten more, from Hang Múa to the Cúc Phương forest.",
    indexIntro:
      "Hang Múa and the Hoa Lư ancient capital are busy all year. Vân Long wetland and Am Tiên cave are usually the first to go when the trip is short, which is exactly why they are still quiet.",
    indexHint: "Move through the names. The image and journey rhythm change with each place.",
    indexOpen: "Open this place",
    zigzagLabel: "Every destination",
    zigzagTitle: "Fifteen places, fifteen different rhythms.",
    zigzagIntro:
      "Hang Múa asks for 486 stone steps. Tam Cốc asks for two hours in a boat, through the three caves the Ngô Đồng cut for itself. Vân Long asks for nothing at all, except that you sit still and stay quiet long enough for the langurs to come down.",
    zigzagCtaTitle: "Not sure where to begin?",
    zigzagCtaBody:
      "Fifteen places sit within one small region, yet each asks for a rhythm of its own. Tell us how many days you have, who travels with you and how unhurried you would like it to be — the arranging is ours to do.",
    zigzagCtaPrimary: "Plan a journey with us",
    zigzagCtaSecondary: "View our ready-made packages",
    zigzagCtaOffer:
      "Pick a date and hold your place right here. Payment is simulated and nothing is charged — but the place is really held.",
    zigzagCtaOfferPlain:
      "Describe what you have in mind in ordinary words; we will build the itinerary from there.",
    companionLabel: "Journey Builder",
    companionTitle: "Shape a day at your own pace",
    companionBody:
      "Tell us how many hours you have, who is coming, and whether water or mountains call you more. The route takes shape from there — and nothing is booked until you say so.",
    prompt: "Tell me what kind of journey you want...",
    create: "Create journey",
    creating: "Composing your route...",
    itinerary: "Your Ninh Binh journey",
    itineraryNote: "Selected destinations and generated stops appear here.",
    directions: "Directions",
    replace: "Replace",
    remove: "Remove",
    experienceTitle: "Make this journey easier",
    experienceName: "Heritage & Evening Experience",
    experienceFit: "A calm fit for families, couples and first-time visitors.",
    experienceBody:
      "Boat journey, local lunch, private transfer, Bai Dinh visit and a lantern evening at Hoa Lu Old Town.",
    viewExperience: "View experience",
    reserve: "Reserve this experience",
    checkoutTitle: "Reservation details",
    checkoutIntro: "Review the journey and payment options. No real payment is processed.",
    guests: "Guests",
    transport: "Private transfer",
    meal: "Local lunch",
    contact: "Contact details",
    paymentOptions: "Payment options",
    close: "Close",
    confirm: "Confirm simulated reservation",
    detailClose: "Close detail",
    historyTitle: "History",
    significanceTitle: "Why it matters",
    bestTimeTitle: "Best time",
    crowdTitle: "Crowd tip",
    transferTitle: "Getting there",
    feeTitle: "Entrance note",
    practicalTitle: "Practical notes",
    pairWithTitle: "Pairs well with",
    highlightsTitle: "What to see",
    selected: "Selected",
    welcome: "Welcome location",
    welcomeDescription:
      "No QR source was supplied, so the map starts from a neutral Ninh Binh welcome point.",
    mapHint: "Tap any marker for story, timing and route actions.",
    nearMe: "Near me",
    locating: "Finding your position...",
    locationFound: "Map centered near you.",
    locationOutside: "You seem outside the region, so the map returns to Trang An.",
    locationDenied: "Location permission was not granted.",
  },
  vi: {
    nav: ["Điểm đến", "Tuyến đi", "Gói có sẵn", "Mùa Trăng"],
    introTop: "Ninh Bình",
    introWords: ["Thiên nhiên.", "Di sản.", "Kỳ quan."],
    title: "Ninh Bình",
    subtitle: "Hành trình giữa núi, nước và di sản vượt thời gian",
    footerNote: "Ninh Bình Journey · Hành trình giữa núi, nước và di sản vượt thời gian.",
    footerLookup: "Đã đặt chỗ rồi? Mở lại vé của bạn",
    begin: "Lập hành trình",
    exploreMap: "Khám phá bản đồ",
    heroPackagesCue: "Xem năm hành trình đã chuẩn bị sẵn",
    heroPackagesCuePlain: "Xem năm hành trình đã chuẩn bị sẵn",
    hourLead: "Ở Ninh Bình bây giờ",
    hourPhrases: {
      dawn: "sương chưa tan khỏi mặt sông",
      morning: "thuyền đã rời bến Tràng An từ sớm",
      midday: "nắng đứng bóng trên vách đá vôi",
      afternoon: "nắng xiên vàng dọc triền lúa Tam Cốc",
      dusk: "đàn chim đang về Thung Nham",
      night: "chỉ còn tiếng mái chèo khua dưới vòm hang",
    },
    journeysLabel: "Ninh Bình tuyển chọn",
    journeysTitle: "Câu chuyện, không chỉ điểm dừng",
    journeysBody:
      "Mỗi tuyến là một mạch kể: nước trước, chùa sau, rồi rừng và ánh đèn lồng khi ngày chậm lại. Kéo qua, chọn mạch nào giống ngày bạn đang mong.",
    viewRoute: "Xem tuyến",
    packagesLabel: "Gói trải nghiệm",
    packagesTitle: "Năm hành trình đã có tuyến đi và mức giá rõ ràng.",
    packagesIntro:
      "Khởi hành ở Tràng An trước giờ đông thuyền, hoặc để Tam Cốc cho buổi chiều nhiều nắng. Mỗi hành trình đã có khung giờ, điểm vào và cách giữ chỗ rõ ràng.",
    packagesBookingNote: "Chọn ngày để tiếp tục giữ chỗ. Website không thu tiền.",
    packagesBookingNotePlain: "Tuyến đi và mức giá đã sẵn sàng để xem; đặt trực tuyến chưa mở.",
    packagesCta: "Xem gói này",
    packagesViewAll: "Xem cả năm gói",
    packagesPricePerGuest: "mỗi người lớn",
    packagesCallCta: "Gọi đặt chỗ trực tiếp",
    packagesEmailCta: "Gửi email đặt chỗ",
    packagesCallNote: "Muốn đặt qua điện thoại? Gọi thẳng cho Xuân Trường.",
    exploreRouteStop: "Khám phá điểm này",
    routeStopLabel: "Chặng",
    addRoute: "Thêm tuyến",
    youAreHere: "Bạn đang ở đây",
    qrSource: "Nguồn QR",
    welcomePoint: "Điểm chào đón Ninh Bình",
    mapTitle: "Bản đồ du lịch tương tác",
    mapBody:
      "Bốn vùng lõi của di sản Tràng An nằm gọn trong khung hình này, cùng cố đô Hoa Lư và nhà thờ đá Phát Diệm ngoài phía biển. Chạm một điểm để nơi ấy tự kể chuyện của mình.",
    nearby: "Khám phá gần đây",
    discover: "Khám phá",
    add: "Thêm vào lịch trình",
    added: "Đã thêm",
    stories: "Câu chuyện điểm đến",
    storiesIntro:
      "Ba câu chuyện để bắt đầu. Đọc chậm thôi — những nơi này đã chờ hàng nghìn năm, không vội.",
    signatureStories: "Tuyến nổi bật",
    hiddenGems: "Những góc lặng của Ninh Bình",
    hiddenGemsIntro:
      "Đầm Vân Long, động Am Tiên, chùa Bích Động, đền Thái Vi. Vắng hơn, và phần lớn khách đi Ninh Bình hai ngày sẽ không kịp tới.",
    seeAllDestinations: "Xem tất cả điểm đến",
    featuredLabel: "Điểm đến nổi bật",
    featuredTitle: "Sáu nơi để bắt đầu, trước chín điểm còn lại",
    featuredIntro:
      "Tràng An mở đầu bằng thuyền, Hang Múa khép bằng 486 bậc đá, Phố cổ Hoa Lư giữ lại ánh đèn lồng cho lúc trời tối. Đây là sáu cái tên khách nào cũng nhắc tới khi rời Ninh Bình — muốn xem trọn cả mười lăm nơi, danh mục đầy đủ nằm ngay bên dưới.",
    featuredCta: "Xem toàn bộ mười lăm điểm đến",
    destinationPage: "Mở trang riêng của điểm này",
    partnersLabel: "Dành cho doanh nghiệp",
    partnersTitle: "Muốn quay hình ở Tràng An, hay đặt tiệc bên sông Ngô Đồng?",
    partnersBody:
      "Ninh Bình Journey làm việc trực tiếp với nhãn hàng và doanh nghiệp muốn tổ chức sự kiện, quay hình thương mại hoặc đồng hành theo mùa tại Ninh Bình — từ mặt nước Tràng An tới triền lúa Tam Cốc. Gọi thẳng cho Xuân Trường, đội ngũ sẽ bàn địa điểm, lịch trình và quy mô phù hợp trước khi triển khai.",
    partnersCategory1Title: "Sự kiện riêng",
    partnersCategory1Body: "Tiệc, lễ ra mắt hoặc buổi họp mặt ngay bên mặt nước Tràng An.",
    partnersCategory2Title: "Quay chụp thương mại",
    partnersCategory2Body: "Đoàn phim và ê-kíp ảnh cần bối cảnh núi đá vôi, hang động, sông nước.",
    partnersCategory3Title: "Tài trợ theo mùa",
    partnersCategory3Body: "Cùng xây dựng một chương trình theo mùa tại Ninh Bình.",
    partnersCall: "Gọi trao đổi hợp tác",
    partnersEmail: "Gửi email hợp tác",
    indexLabel: "Phần còn lại của bản đồ",
    indexTitle: "Mười nơi nữa, từ Hang Múa tới rừng Cúc Phương.",
    indexIntro:
      "Hang Múa và Cố đô Hoa Lư đông khách quanh năm. Đầm Vân Long, động Am Tiên thì hay bị gạch đầu tiên khi lịch trình ngắn lại, và cũng chính vì thế mà còn vắng.",
    indexHint: "Rê qua từng tên. Ảnh và nhịp chuyến đi sẽ đổi theo từng nơi.",
    indexOpen: "Mở điểm đến",
    zigzagLabel: "Toàn bộ điểm đến",
    zigzagTitle: "Mười lăm nơi, mười lăm nhịp thở khác nhau.",
    zigzagIntro:
      "Hang Múa đòi 486 bậc đá. Tam Cốc đòi hai tiếng ngồi thuyền qua ba cái hang sông Ngô Đồng khoét ra. Còn Vân Long thì chẳng đòi gì, ngoài việc ngồi thật yên và im lặng đủ lâu để đàn voọc chịu xuống.",
    zigzagCtaTitle: "Chưa biết nên bắt đầu từ đâu?",
    zigzagCtaBody:
      "Mười lăm nơi gói trong một vùng đất không rộng, mà mỗi nơi một nhịp riêng. Bạn cho chúng tôi biết mình có mấy ngày, đi với ai, muốn thong thả tới đâu — còn lại cứ để chúng tôi sắp.",
    zigzagCtaPrimary: "Lập hành trình cùng chúng tôi",
    zigzagCtaSecondary: "Xem các gói có sẵn",
    zigzagCtaOffer:
      "Chọn ngày rồi giữ chỗ ngay trên trang. Thanh toán ở đây là mô phỏng, không thu tiền thật, nhưng chỗ thì giữ thật.",
    zigzagCtaOfferPlain:
      "Bạn cứ nói mình muốn đi kiểu gì; chúng tôi dựng lịch trình từ đó.",
    companionLabel: "Bộ lập tuyến hành trình",
    companionTitle: "Sắp một ngày theo nhịp của bạn",
    companionBody:
      "Kể chúng tôi nghe bạn có mấy giờ, đi cùng ai, thích nước hay thích núi hơn. Tuyến đi sẽ tự thành hình từ đó — và chưa có gì được giữ chỗ khi bạn chưa gật đầu.",
    prompt: "Bạn muốn một hành trình như thế nào...",
    create: "Tạo lịch trình",
    creating: "Đang sắp xếp tuyến...",
    itinerary: "Lịch trình Ninh Bình của bạn",
    itineraryNote: "Các điểm đã chọn và chặng được tạo sẽ xuất hiện tại đây.",
    directions: "Chỉ đường",
    replace: "Đổi điểm",
    remove: "Xóa",
    experienceTitle: "Làm hành trình nhẹ nhàng hơn",
    experienceName: "Trải nghiệm Di sản & Phố cổ buổi tối",
    experienceFit: "Phù hợp cho gia đình, cặp đôi và du khách lần đầu đến Ninh Bình.",
    experienceBody:
      "Đi thuyền, ăn trưa địa phương, xe riêng, thăm Bái Đính và buổi tối đèn lồng tại Phố cổ Hoa Lư.",
    viewExperience: "Xem trải nghiệm",
    reserve: "Giữ chỗ trải nghiệm",
    checkoutTitle: "Thông tin giữ chỗ",
    checkoutIntro: "Xem lại hành trình và phương thức thanh toán. Không xử lý thanh toán thật.",
    guests: "Số khách",
    transport: "Xe riêng",
    meal: "Bữa trưa địa phương",
    contact: "Thông tin liên hệ",
    paymentOptions: "Phương thức thanh toán",
    close: "Đóng",
    confirm: "Xác nhận giữ chỗ mô phỏng",
    detailClose: "Đóng chi tiết",
    historyTitle: "Lịch sử",
    significanceTitle: "Vì sao đáng đi",
    bestTimeTitle: "Thời điểm đẹp",
    crowdTitle: "Mẹo tránh đông",
    transferTitle: "Di chuyển",
    feeTitle: "Ghi chú vé",
    practicalTitle: "Lưu ý thực tế",
    pairWithTitle: "Nên ghép với",
    highlightsTitle: "Đáng xem",
    selected: "Đã chọn",
    welcome: "Điểm chào đón",
    welcomeDescription:
      "URL chưa có nguồn QR, vì vậy bản đồ bắt đầu tại một điểm chào đón trung tính của Ninh Bình.",
    mapHint: "Chạm vào marker để xem câu chuyện, thời điểm và thao tác thêm vào lịch trình.",
    nearMe: "Gần tôi",
    locating: "Đang tìm vị trí của bạn...",
    locationFound: "Bản đồ đã đưa về gần vị trí của bạn.",
    locationOutside: "Có vẻ bạn đang ngoài vùng, bản đồ sẽ quay về Tràng An.",
    locationDenied: "Bạn chưa cấp quyền vị trí.",
  },
  // `Record<DayBand, string>` la de cho `hourPhrases` -- bang cau theo
  // khung gio trong ngay, tra cuu bang `ninhBinhHour.band`.
} satisfies Record<Language, Record<string, string | string[] | Record<DayBand, string>>>;

/*
 * Ba nhip nay CHI dung du kien that da kiem chung, khong viet tho mood.
 * Ban dau tung viet ba cau cung mot khuon ("Tam Chuc khong voi" / "Van
 * Long khong pho dien" / "Thung Nham la luc...") -- vua sao rong, vua
 * dung dung loi "khong X, khong Y" ma UI_UX_RULES.md cam. Nguon:
 *  - Van Long: Mongabay 2021 (Danh sach Xanh IUCN, Ramsar, 234-275 ca
 *    the vooc mong trang con lai) -- xem `press` trong content/destinations.ts
 *  - Cuc Phuong: vuon quoc gia dau tien cua Viet Nam (`history`)
 *  - Phat Diem: mai go Viet + kien truc da Cong giao (`history`)
 * Ba diem nay cung co chu dich khac han bo ba o khoi "Cau chuyen diem
 * den" ben duoi (Trang An / Bai Dinh / Tam Chuc) -- khong lap lai.
 */

/*
 * WEB-PERF-01 (31/08): trang chủ từng chạy BA băng video nền (13,4 MB
 * tổng cộng, cả ba `eager`), theo đúng yêu cầu chủ dự án chỉ giữ lại
 * video đầu tiên. Hai video còn lại (`tam-coc-river.mp4`,
 * `trang-an-heritage.mp4`) đã bị bỏ khỏi trang và xoá khỏi `public/` --
 * không còn chỗ nào khác trong mã nguồn dùng tới. Băng còn lại vẫn giữ
 * đúng cách boot: `eager` để tận dụng khung intro khoá màn hình vài giây
 * đầu trang, không cần rải `eagerDelayMs` nữa vì chỉ còn một trình phát.
 *
 * Nguồn do chủ dự án chọn, đã cắt sẵn thành MP4 không audio để demo
 * không còn iframe/nút play YouTube. Cắt đúng 12-30 giây, H.264 1280px,
 * `faststart`, không audio -- file đã cắt sẵn nên loop chính xác mà
 * không cần `start`/`end` hay postMessage tua lại.
 *
 * Mapping được rà lại 07/08 từ tiêu đề nguồn gốc + frame thật + phản hồi
 * trực tiếp của chủ dự án: nguồn OA4lO9rrk4Q ghi tiêu đề gốc Hang Mua
 * Peak and Tam Coc.
 */
const cinematicClip: Record<Language, CinematicClip> = {
  vi: {
    src: "/videos/cinematic/ninh-binh-water.mp4",
    poster: "/images/destinations/hang-mua.png",
    eyebrow: "Đỉnh Ngọa Long · Hang Múa",
    headline: "486 bậc đá đưa lên đỉnh Ngọa Long, nơi cả thung lũng Tam Cốc mở ra dưới chân.",
  },
  en: {
    src: "/videos/cinematic/ninh-binh-water.mp4",
    poster: "/images/destinations/hang-mua.png",
    eyebrow: "Ngọa Long peak · Hang Múa",
    headline: "486 stone steps lead to Ngọa Long peak, with the whole Tam Cốc valley below.",
  },
};

const trangAnStory: Record<
  Language,
  {
    sectionLabel: string;
    title: string;
    progressLabel: string;
    beats: TrangAnStoryBeat[];
  }
> = {
  en: {
    sectionLabel: "Tràng An · Route 1",
    title: "Follow one water route into Tràng An",
    progressLabel: "Journey rhythm",
    beats: [
      {
        id: "den-trinh",
        image: "/images/destinations/intro-trang-an-rain.png",
        imagePosition: "54% 50%",
        alt: "A rowing boat moving between the limestone mountains of Tràng An",
        stopLabel: "Đền Trình",
        eyebrow: "Departure · around 3–4 hours",
        headline: "Route 1: nine caves, three sacred sites.",
        body: "Boats leave Đền Trình for a 3–4 hour circuit. Route 1 passes nine caves — the most in Tràng An — so it is the one to choose when you can give the water a full half-day.",
      },
      {
        id: "hang-toi",
        image: "/images/destinations/intro-trang-an-rain.png",
        imagePosition: "34% 50%",
        alt: "Still water and limestone peaks along the Tràng An boat route",
        stopLabel: "Hang Tối · 320 m",
        eyebrow: "Hang Địa Linh → Hang Tối",
        headline: "Hang Tối runs for 320 metres.",
        body: "After Hang Địa Linh, the boat enters the longest cave on this route. For 320 metres, the view narrows to water and limestone.",
      },
      {
        id: "den-tran",
        image: "/images/destinations/trang-an.jpg",
        imagePosition: "33% 58%",
        alt: "A waterside pavilion beneath the limestone cliffs of Tràng An",
        stopLabel: "Đền Trần",
        eyebrow: "Hang Sáng → Hang Nấu Rượu",
        headline: "From Hang Nấu Rượu, the route continues to Đền Trần.",
        body: "Hang Nấu Rượu carries the story of water once drawn to make wine for the king. From there, boats call at Đền Trần before continuing to Hang Ba Giọt.",
      },
      {
        id: "phu-khong",
        image: "/images/destinations/trang-an.jpg",
        imagePosition: "62% 50%",
        alt: "Evening light across the water and limestone cliffs at Tràng An",
        stopLabel: "Phủ Khống",
        eyebrow: "Hang Ba Giọt → Hang Sơn Dương",
        headline: "Phủ Khống sits in the second half of the journey.",
        body: "After Hang Ba Giọt, Hang Seo and Hang Sơn Dương, boats call at Phủ Khống and Chùa Báo Hiếu. Their names keep this from becoming scenery without memory.",
      },
      {
        id: "quy-hau",
        image: "/images/destinations/intro-trang-an-rain.png",
        imagePosition: "66% 50%",
        alt: "A small rowing boat returning across the quiet water of Tràng An",
        stopLabel: "Hang Quy Hậu",
        eyebrow: "Chùa Báo Hiếu → return to the wharf",
        headline: "Hang Quy Hậu carries the boat back to the wharf.",
        body: "The circuit closes after Hang Khống and Hang Trần. By then, nine caves are no longer a number on a route card; they are the measure of the whole journey.",
      },
    ],
  },
  vi: {
    sectionLabel: "Tràng An · Tuyến 1",
    title: "Theo một tuyến nước vào Tràng An",
    progressLabel: "Nhịp hành trình",
    beats: [
      {
        id: "den-trinh",
        image: "/images/destinations/intro-trang-an-rain.png",
        imagePosition: "54% 50%",
        alt: "Thuyền chèo giữa những dãy núi đá vôi ở Tràng An",
        stopLabel: "Đền Trình",
        eyebrow: "Khởi hành · khoảng 3–4 giờ",
        headline: "Tuyến 1: chín hang, ba điểm tâm linh.",
        body: "Thuyền rời Đền Trình cho một vòng tuyến khoảng 3–4 giờ. Tuyến 1 đi qua chín hang — nhiều nhất ở Tràng An — nên hợp với người muốn dành trọn một buổi trên mặt nước.",
      },
      {
        id: "hang-toi",
        image: "/images/destinations/intro-trang-an-rain.png",
        imagePosition: "34% 50%",
        alt: "Mặt nước tĩnh và núi đá vôi trên tuyến thuyền Tràng An",
        stopLabel: "Hang Tối · 320 m",
        eyebrow: "Hang Địa Linh → Hang Tối",
        headline: "Hang Tối dài 320 mét.",
        body: "Sau Hang Địa Linh, thuyền vào hang dài nhất tuyến. Trong 320 mét, khung nhìn thu lại chỉ còn mặt nước và vòm đá.",
      },
      {
        id: "den-tran",
        image: "/images/destinations/trang-an.jpg",
        imagePosition: "33% 58%",
        alt: "Thủy đình bên mặt nước dưới vách núi đá vôi Tràng An",
        stopLabel: "Đền Trần",
        eyebrow: "Hang Sáng → Hang Nấu Rượu",
        headline: "Từ Hang Nấu Rượu, tuyến đi tiếp tới Đền Trần.",
        body: "Hang Nấu Rượu gắn với tích lấy nước nấu rượu tiến vua. Từ đây, thuyền ghé Đền Trần trước khi đi tiếp tới Hang Ba Giọt.",
      },
      {
        id: "phu-khong",
        image: "/images/destinations/trang-an.jpg",
        imagePosition: "62% 50%",
        alt: "Ánh chiều trên mặt nước và vách núi Tràng An",
        stopLabel: "Phủ Khống",
        eyebrow: "Hang Ba Giọt → Hang Sơn Dương",
        headline: "Phủ Khống nằm ở nửa sau hành trình.",
        body: "Qua Hang Ba Giọt, Hang Seo và Hang Sơn Dương, thuyền ghé Phủ Khống rồi Chùa Báo Hiếu. Những địa danh giữ cho chuyến đi không chỉ còn là phong cảnh.",
      },
      {
        id: "quy-hau",
        image: "/images/destinations/intro-trang-an-rain.png",
        imagePosition: "66% 50%",
        alt: "Thuyền nhỏ trở về trên mặt nước yên ở Tràng An",
        stopLabel: "Hang Quy Hậu",
        eyebrow: "Chùa Báo Hiếu → trở về bến",
        headline: "Hang Quy Hậu đưa thuyền về bến.",
        body: "Tuyến khép lại sau Hang Khống và Hang Trần. Đến lúc ấy, chín hang không còn là một con số trên bảng tuyến; đó là thước đo của cả hành trình.",
      },
    ],
  },
};

const paymentMethods = ["Visa", "Mastercard", "JCB", "VietQR", "MoMo", "ZaloPay", "Pay at counter"];
const paymentMethodsVi = ["Visa", "Mastercard", "JCB", "VietQR", "MoMo", "ZaloPay", "Thanh toán tại quầy"];

/*
 * `homepageStories` / `HOMEPAGE_STORY_COUNT` / `totalDestinationCount` da
 * bi xoa 05/08 cung luc voi danh sach the lap o `#stories` -- ba diem dau
 * duoc dung lai NGUYEN VAN trong `DestinationZigzag` ngay ben duoi.
 *
 * Danh muc 15 diem gio chia lam hai nhip: `ZIGZAG_FEATURED` diem dau di
 * qua `DestinationZigzag` (anh lon so le), phan con lai di qua
 * `DestinationIndex` (danh sach ten lon, anh bam con tro).
 */
const ZIGZAG_FEATURED = 5;

/*
 * WEB-STRUCT-02 (31/08): sau muc "Ba cau chuyen de bat dau" bi xoa han
 * 05/08, trang chu khong con mot loi gioi thieu ngan nao dan vao danh
 * muc 15 diem den ben duoi -- khach phai tu boi qua ca DestinationZigzag
 * lan DestinationIndex moi biet noi nao la "hot" nhat. Sau id nay CHON
 * TRONG SO CHIN DIEM `tier: "signature"` da co san (khong bia diem moi,
 * khong bia so lieu): Trang An, Tam Coc, Hang Mua, Bai Dinh, Co do Hoa Lu
 * va Pho co Hoa Lu -- sau cai ten xuat hien trong hau het moi tuyen goi y
 * (`routeCollections`) va ca nam goi ban (`content/packages.ts`), tuc la
 * dung nhung diem khach thuc su se di chu khong phai chon ngau nhien.
 * Tam Chuc (cung signature) khong dua vao day vi thuoc Ha Nam, khong phai
 * Ninh Binh that (xem `outsideTourismCore` trong `content/destinations.ts`
 * va muc W3 o HANDOFF.md) -- de trong o day de tranh nhan "diem noi bat
 * Ninh Binh" bi hieu nham.
 */
const FEATURED_DESTINATION_IDS: DestinationId[] = [
  "trang_an",
  "tam_coc",
  "hang_mua",
  "bai_dinh",
  "hoa_lu_ancient_capital",
  "hoa_lu_old_town",
];

/*
 * VIET LAI LAN HAI, 06/08 -- lan nay theo luat "GOI TEN, DUNG TA" moi
 * them vao UI_UX_RULES.md sau khi doi chieu voi muave.disantrangan.vn.
 *
 * Ban truoc (05/08) van bi che thang, va che dung: "Kinh do cu nam giua,
 * hai ngoi chua lon kep hai dau" la TA HINH HOC chu khong phai viet;
 * "Ca buoi sang chi co tieng mai cheo" la khong khi suong, khong mang
 * mot thong tin nao. Loi goc: dung DANH TU CHUNG (nui da voi, mat nuoc,
 * mai cheo) trong khi trang doi thu dung DANH TU RIENG CO LICH SU DINH
 * KEM (Phu Khong, Hang Dot, Duc Thanh Quy Minh Dai Vuong).
 *
 * Ban nay: moi tuyen deu co ten rieng + con so + moc lich su, TAT CA da
 * tra nguon that ngay 06/08 (Wikipedia tieng Viet, bao Nhan Dan,
 * VietnamPlus, cong thong tin tinh Ninh Binh, Vietnam Airlines Travel
 * Guide). Nguon ghi trong REFERENCE_SITE_ANALYSIS.md. KHONG duoc them
 * con so nao vao day ma chua tra nguon.
 */
const routeCollections = [
  {
    id: "water-first",
    kicker: { en: "By water", vi: "Đi bằng nước" },
    title: {
      en: "Nine caves at Tràng An. Three at Tam Cốc. Two journeys by water.",
      vi: "Chín hang Tràng An. Ba hang Tam Cốc. Hai hành trình bằng nước.",
    },
    body: {
      en: "Route 1 at Tràng An runs through nine caves and three shrines; Hang Tối alone is 320 metres long, while Hang Nấu Rượu carries the story of wine brewed for the king. Tam Cốc is a different route: the Ngô Đồng cut hang Cả, hang Hai and hang Ba through the limestone. Leave Thung Nham for late afternoon.",
      vi: "Tuyến 1 Tràng An đi qua chín hang và ba điểm tâm linh; riêng Hang Tối dài 320 mét, còn Hang Nấu Rượu giữ tích nấu rượu tiến vua. Tam Cốc là một tuyến khác: sông Ngô Đồng xuyên núi thành hang Cả, hang Hai, hang Ba. Thung Nham dành cho cuối chiều.",
    },
    stops: ["trang_an", "tam_coc", "thung_nham"] as DestinationId[],
  },
  {
    id: "temple-scale",
    kicker: { en: "From the 10th century", vi: "Từ thế kỷ X" },
    title: {
      en: "Six kings, three dynasties, and five hundred stone arhats",
      vi: "Sáu vị vua, ba triều đại, và năm trăm pho tượng đá",
    },
    body: {
      en: "In 968 Đinh Bộ Lĩnh put down the twelve warlords, took the throne and made Hoa Lư the capital of Đại Cồ Việt: three hundred hectares of inner and outer citadel. Bái Đính answers in another age — the old pagoda founded by Nguyễn Minh Không in 1136, and the new one's arhat corridor running almost three kilometres past five hundred Ninh Vân stone figures. Tam Chúc carries the route north to Điện Tam Thế, where the 2019 Vesak celebrations were held.",
      vi: "Năm 968, Đinh Bộ Lĩnh dẹp xong loạn mười hai sứ quân, lên ngôi và chọn Hoa Lư làm kinh đô Đại Cồ Việt: ba trăm hecta thành Nội và thành Ngoại. Bái Đính nối sang một thời khác — chùa cổ do quốc sư Nguyễn Minh Không lập năm 1136, còn hành lang La Hán của chùa mới dài gần ba cây số với năm trăm pho tượng đá Ninh Vân. Tam Chúc đưa tuyến lên phía bắc tới Điện Tam Thế, nơi diễn ra Đại lễ Vesak năm 2019.",
    },
    stops: ["bai_dinh", "hoa_lu_ancient_capital", "tam_chuc"] as DestinationId[],
  },
  {
    id: "quiet-west",
    kicker: { en: "Westward", vi: "Ngả về phía tây" },
    title: {
      en: "Vietnam's first national park, and fewer than three hundred langurs left",
      vi: "Vườn quốc gia đầu tiên của Việt Nam, và chưa tới ba trăm con voọc còn lại",
    },
    body: {
      en: "Cúc Phương was declared in 1962, before Vietnam had a second national park to compare it with. Vân Long is the only wetland reserve in the country on the IUCN Green List, and most of the world's remaining Delacour's langurs live on those cliffs. At the bear sanctuary the order reverses: the animals were here first, and visitors keep to their side.",
      vi: "Cúc Phương được lập năm 1962, khi Việt Nam còn chưa có vườn quốc gia thứ hai để mà so. Vân Long là khu đất ngập nước duy nhất của cả nước có tên trong Danh sách Xanh IUCN, và phần lớn số voọc mông trắng còn lại của thế giới sống trên đúng những vách núi ấy. Tới khu bảo tồn gấu thì thứ tự đảo lại: con vật ở đây trước, khách giữ phần mình.",
    },
    stops: ["cuc_phuong", "van_long", "bear_sanctuary"] as DestinationId[],
  },
  {
    id: "lantern-night",
    kicker: { en: "Into the evening", vi: "Về chiều" },
    title: {
      en: "486 steps up Ngọa Long, two hundred down into Am Tiên",
      vi: "Bốn trăm tám mươi sáu bậc lên Ngọa Long, hai trăm bậc xuống Am Tiên",
    },
    body: {
      en: "Hang Múa charges 486 stone steps along the flank of Ngọa Long and hands back the whole Tam Cốc valley. Động Am Tiên asks the opposite: two hundred steps down into a closed valley where the dowager empress Dương Vân Nga took vows at the end of her life, and where Đinh Tiên Hoàng once kept tigers to punish the condemned. Come down to Hoa Lư Old Town as the lanterns go up.",
      vi: "Hang Múa bắt trả bằng 486 bậc đá dọc sườn Ngọa Long, đổi lại là cả thung lũng Tam Cốc dưới chân. Động Am Tiên thì đòi ngược lại: hơn hai trăm bậc xuống một thung kín, nơi Thái hậu Dương Vân Nga về tu những năm cuối đời, và cũng là nơi Đinh Tiên Hoàng từng nuôi hổ báo để trị tội. Xuống tới Phố cổ Hoa Lư thì đèn lồng vừa lên.",
    },
    stops: ["hang_mua", "am_tien", "hoa_lu_old_town"] as DestinationId[],
  },
];

const chips = [
  { id: "nature", en: "Nature", vi: "Thiên nhiên" },
  { id: "culture", en: "Culture", vi: "Văn hóa" },
  { id: "spiritual", en: "Spiritual", vi: "Tâm linh" },
  { id: "family", en: "Family", vi: "Gia đình" },
  { id: "relaxed", en: "Relaxed", vi: "Thư thả" },
  { id: "adventure", en: "Adventure", vi: "Khám phá" },
] as const;

const durations = [
  { id: "3h", en: "3 hours", vi: "3 giờ" },
  { id: "1d", en: "1 day", vi: "1 ngày" },
  { id: "2d", en: "2 days", vi: "2 ngày" },
] as const;

const baseStops: ItineraryStop[] = [
  {
    id: "trang_an",
    time: "08:00",
    title: { en: "Trang An", vi: "Tràng An" },
    note: { en: "Boat journey", vi: "Chuyến thuyền" },
    duration: { en: "3 hours", vi: "3 giờ" },
    distance: { en: "Start here", vi: "Bắt đầu tại đây" },
    tags: { en: ["Nature", "Heritage"], vi: ["Thiên nhiên", "Di sản"] },
  },
  {
    id: "local_lunch",
    time: "11:30",
    title: { en: "Local lunch", vi: "Bữa trưa địa phương" },
    note: { en: "Rice-field restaurant", vi: "Nhà hàng gần đồng lúa" },
    duration: { en: "75 min", vi: "75 phút" },
    distance: { en: "15 min transfer", vi: "15 phút di chuyển" },
    tags: { en: ["Relaxed", "Family"], vi: ["Thư thả", "Gia đình"] },
  },
  {
    id: "bai_dinh",
    time: "13:30",
    title: { en: "Bai Dinh", vi: "Bái Đính" },
    note: { en: "Electric cart and temple walk", vi: "Xe điện và đi bộ trong chùa" },
    duration: { en: "2.5 hours", vi: "2,5 giờ" },
    distance: { en: "35 min transfer", vi: "35 phút di chuyển" },
    tags: { en: ["Culture", "Spiritual"], vi: ["Văn hóa", "Tâm linh"] },
  },
  {
    id: "hoa_lu_old_town",
    time: "18:00",
    title: { en: "Hoa Lu Old Town", vi: "Phố cổ Hoa Lư" },
    note: { en: "Lantern evening", vi: "Buổi tối đèn lồng" },
    duration: { en: "90 min", vi: "90 phút" },
    distance: { en: "25 min transfer", vi: "25 phút di chuyển" },
    tags: { en: ["Evening", "Food"], vi: ["Buổi tối", "Ẩm thực"] },
  },
];

function normalizeSource(source: string) {
  return source.trim().toLowerCase().replaceAll("-", "_");
}

function buildHref(lang: Language, source: string, presentationMode: boolean) {
  const params = new URLSearchParams();
  params.set("lang", lang);
  if (source) params.set("source", source);
  if (presentationMode) params.set("presentation", "1");
  return `/?${params.toString()}`;
}

function languageUrl(lang: Language, source: string, presentationMode: boolean) {
  if (typeof window === "undefined") return buildHref(lang, source, presentationMode);

  const params = new URLSearchParams(window.location.search);
  params.set("lang", lang);
  if (source) params.set("source", source);
  if (presentationMode) params.set("presentation", "1");

  return `/?${params.toString()}${window.location.hash}`;
}

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function stopFromDestination(destination: Destination, time = "16:30"): ItineraryStop {
  return {
    id: destination.id,
    time,
    title: destination.name,
    note: destination.category,
    duration: destination.duration,
    distance: { en: "Local transfer", vi: "Di chuyển nội vùng" },
    tags: destination.tags,
  };
}

function createRoute(duration: string, selected: string[]) {
  if (duration === "3h") {
    if (selected.includes("adventure")) return [stopFromDestination(destinations.find((d) => d.id === "hang_mua")!, "07:30"), stopFromDestination(destinations.find((d) => d.id === "tam_coc")!, "09:45")];
    if (selected.includes("nature")) return [stopFromDestination(destinations.find((d) => d.id === "van_long")!, "07:30"), stopFromDestination(destinations.find((d) => d.id === "thung_nham")!, "10:00")];
    return [baseStops[0], baseStops[1]];
  }
  if (selected.includes("adventure")) {
    return [baseStops[0], stopFromDestination(destinations.find((d) => d.id === "hang_mua")!, "15:30"), baseStops[3]];
  }
  if (selected.includes("nature")) {
    return [stopFromDestination(destinations.find((d) => d.id === "tam_coc")!, "08:00"), stopFromDestination(destinations.find((d) => d.id === "bich_dong")!, "10:45"), stopFromDestination(destinations.find((d) => d.id === "thung_nham")!, "16:30")];
  }
  if (selected.includes("spiritual")) {
    return [baseStops[2], stopFromDestination(destinations.find((d) => d.id === "bich_dong")!, "11:30"), stopFromDestination(destinations.find((d) => d.id === "tam_chuc")!, "15:45")];
  }
  if (duration === "2d") {
    return [...baseStops, stopFromDestination(destinations.find((d) => d.id === "cuc_phuong")!, "09:00"), stopFromDestination(destinations.find((d) => d.id === "bear_sanctuary")!, "14:00")];
  }
  return baseStops;
}

/*
 * WEB-PERF-01 (31/08): man mo dau tung chay lai o MOI lan dung lai
 * component -- F5 hay bam "quay lai" deu mat vi state chi song trong bo
 * nho React, khong nho gi qua lan dung. Chu du an muon dung dung MOT lan
 * cho moi luot vao tham: F5 va quay lai van phai nho, nhung mo tab/cua so
 * moi thi duoc chay lai -- day dung nghia la `sessionStorage`, khong phai
 * `localStorage` (song vinh vien) cung khong phai cookie (di kem request).
 *
 * `useSyncExternalStore` (khong phai `useState` + doc trong `useEffect`)
 * de tranh hydration mismatch: may chu dung HTML khong co
 * `sessionStorage` nen luon phai "chua xem", con trinh duyet co the da
 * xem tu truoc. Ham snapshot may chu (tham so thu ba) luon tra `false`
 * de khop voi lan dung dau tien, sau do React tu doi sang gia tri that
 * cua trinh duyet ngay khi commit -- khong can goi `setState` trong than
 * `useEffect` (luat lint `react-hooks/set-state-in-effect` cam dieu do).
 */
const INTRO_SESSION_KEY = "nbj-intro-played";

function subscribeIntroPlayedNoop() {
  return () => {};
}

function hasIntroPlayedThisSession() {
  try {
    return window.sessionStorage.getItem(INTRO_SESSION_KEY) === "1";
  } catch {
    // Riêng tư (Safari ITP chặn, chế độ ẩn danh nghiêm ngặt) hoặc quota
    // đầy: coi như chưa xem -- thà intro chạy lại còn hơn một lỗi chặn
    // cả trang vì đụng `sessionStorage`.
    return false;
  }
}

function markIntroPlayed() {
  try {
    window.sessionStorage.setItem(INTRO_SESSION_KEY, "1");
  } catch {
    // Xem chú thích trong `hasIntroPlayedThisSession` -- im lặng bỏ qua.
  }
}

export default function NinhBinhLanding({
  initialLang,
  source,
  presentationMode,
  bookingEnabled,
  surfaceAttributes,
}: Props) {
  const [lang, setLang] = useState<Language>(initialLang);
  const t = copy[lang];
  const trailerWords = useMemo(() => [t.introTop as string, ...(t.introWords as string[]).map((word) => word.replace(/\.$/, ""))], [t.introTop, t.introWords]);
  const [selectedChips, setSelectedChips] = useState<string[]>(["culture", "relaxed", "family"]);
  const [selectedDuration, setSelectedDuration] = useState("1d");
  const [selectedIds, setSelectedIds] = useState<DestinationId[]>([]);
  const [itinerary, setItinerary] = useState<ItineraryStop[]>(baseStops);
  const [loading, setLoading] = useState(false);
  const [detailId, setDetailId] = useState<DestinationId | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [introVisible, setIntroVisible] = useState(true);
  const heroSceneRef = useRef<HTMLElement>(null);
  const introAlreadyPlayed = useSyncExternalStore(
    subscribeIntroPlayedNoop,
    hasIntroPlayedThisSession,
    () => false,
  );
  const showIntro = introVisible && !introAlreadyPlayed;
  const modalOpen = Boolean(detailId || checkoutOpen);
  const ninhBinhHour = useNinhBinhHour();

  /* HERO-CONTINUITY-11: local transform/opacity-only scroll state. */
  useEffect(() => {
    const scene = heroSceneRef.current;
    if (!scene) return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    const paint = () => {
      frame = 0;
      if (media.matches) {
        scene.dataset.motion = "reduced";
        scene.style.setProperty("--hero-progress", "0");
        return;
      }
      const rect = scene.getBoundingClientRect();
      const progress = Math.max(0, Math.min(1, -rect.top / Math.max(rect.height, 1)));
      scene.dataset.motion = "full";
      scene.style.setProperty("--hero-progress", progress.toFixed(4));
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(paint);
    };
    paint();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    media.addEventListener("change", paint);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      media.removeEventListener("change", paint);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  /*
   * Hieu ung "anh no ra": tam anh khach vua bam bay tu cho cu toi dung vi
   * tri anh lon trong khung chi tiet, roi bien mat de lo anh that ben
   * duoi. Lam bang mot BAN SAO `position: fixed` chu khong dich chuyen
   * chinh the goc -- dich the goc se pha bo cuc cua hang zigzag va lam
   * ScrollTrigger phai tinh lai toan bo.
   *
   * `flipStart` giu vi tri xuat phat; `heroRef` la dich den, do sau khi
   * khung chi tiet da dung xong. Khi bat giam chuyen dong thi khong bao
   * gio dat `flipStart`, nen khong co gi bay ca.
   */
  const [flipStart, setFlipStart] = useState<FlipStart | null>(null);
  const [flipDone, setFlipDone] = useState(true);
  const heroRef = useRef<HTMLDivElement>(null);
  const flipCloneRef = useRef<HTMLDivElement>(null);

  // Kéo chuột thật cho route-rail. Trước đó chỉ có CSS cursor:grab -- con
  // trỏ hứa hẹn kéo được nhưng không có xử lý nào chạy, mouse-drag không
  // làm gì cả (chỉ touch/trackpad mới cuộn ngang tự nhiên). Bấm-kéo bằng
  // pointer event, và chặn click "giả" khi vừa kéo xong để không mở nhầm
  // chi tiết điểm đến ngay sau một cú kéo.
  const railRef = useRef<HTMLDivElement>(null);
  const railDrag = useRef({ dragging: false, startX: 0, startScrollLeft: 0, moved: false });
  const [routeProgress, setRouteProgress] = useState(0);

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;

    function measure() {
      const max = rail!.scrollWidth - rail!.clientWidth;
      setRouteProgress(max > 0 ? Math.max(0, Math.min(1, rail!.scrollLeft / max)) : 0);
    }

    rail.addEventListener("scroll", measure, { passive: true });
    const resize = new ResizeObserver(measure);
    resize.observe(rail);
    const frame = window.requestAnimationFrame(measure);
    return () => {
      rail.removeEventListener("scroll", measure);
      resize.disconnect();
      window.cancelAnimationFrame(frame);
    };
  }, []);

  /*
   * WEB-PERF-01 (31/08): `TourismMap` đã tách chunk bằng `next/dynamic`
   * (`ssr: false`) từ trước, nhưng vẫn được yêu cầu tải NGAY khi trang
   * dựng xong dù khối bản đồ nằm sau cả hero, video mở đầu, PinnedStory
   * và khối Trung Thu -- tức khách phải cuộn qua vài màn hình mới tới.
   * Hoãn việc gắn `TourismMap` (và do đó việc tải chunk Leaflet) tới khi
   * khối bản đồ sắp vào khung nhìn, cùng kỹ thuật `IntersectionObserver`
   * đã dùng cho video ở `components/shared/cinematic-video.tsx`.
   */
  const mapWrapRef = useRef<HTMLDivElement>(null);
  const [mapNearViewport, setMapNearViewport] = useState(false);

  useEffect(() => {
    if (mapNearViewport) return;
    const wrap = mapWrapRef.current;
    if (!wrap) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setMapNearViewport(true);
          io.disconnect();
        }
      },
      { rootMargin: "800px 0px" },
    );
    io.observe(wrap);
    return () => io.disconnect();
  }, [mapNearViewport]);

  function handleRailPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "touch") return;
    const rail = railRef.current;
    if (!rail) return;
    railDrag.current = { dragging: true, startX: event.clientX, startScrollLeft: rail.scrollLeft, moved: false };
    rail.style.userSelect = "none";
  }

  function handleRailPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const rail = railRef.current;
    const drag = railDrag.current;
    if (!rail || !drag.dragging) return;
    const delta = event.clientX - drag.startX;
    if (Math.abs(delta) > 4) drag.moved = true;
    rail.scrollLeft = drag.startScrollLeft - delta;
  }

  function endRailDrag() {
    const rail = railRef.current;
    if (rail) rail.style.userSelect = "";
    railDrag.current.dragging = false;
  }

  function handleRailClickCapture(event: React.MouseEvent<HTMLDivElement>) {
    if (railDrag.current.moved) {
      event.preventDefault();
      event.stopPropagation();
      railDrag.current.moved = false;
    }
  }

  function handleRouteCardPointerMove(event: React.PointerEvent<HTMLElement>) {
    if (event.pointerType !== "mouse" || railDrag.current.dragging) return;
    const card = event.currentTarget;
    const rect = card.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    card.style.setProperty("--route-tilt-x", `${(0.5 - y) * 5}deg`);
    card.style.setProperty("--route-tilt-y", `${(x - 0.5) * 7}deg`);
    card.style.setProperty("--route-glare-x", `${x * 100}%`);
    card.style.setProperty("--route-glare-y", `${y * 100}%`);
  }

  function resetRouteCardTilt(event: React.PointerEvent<HTMLElement>) {
    const card = event.currentTarget;
    card.style.setProperty("--route-tilt-x", "0deg");
    card.style.setProperty("--route-tilt-y", "0deg");
  }

  const sourceDestinationId = useMemo<DestinationId | "welcome">(() => {
    const normalized = normalizeSource(source);
    return destinations.find((destination) => destination.sourceKeys.includes(normalized))?.id ?? "welcome";
  }, [source]);
  const [focusedDestinationId, setFocusedDestinationId] = useState<DestinationId | "welcome">(sourceDestinationId);

  useEffect(() => {
    window.localStorage.setItem("ninh-binh-lang", lang);
    document.cookie = `ninh-binh-lang=${lang}; path=/; max-age=31536000; SameSite=Lax`;
    document.documentElement.lang = lang;
  }, [lang]);

  /*
   * Bay ban sao tu vi tri anh nguon toi dung o anh lon cua khung chi tiet.
   *
   * Dung `useLayoutEffect` chu khong phai `useEffect`: phai dat ban sao
   * vao dung cho TRUOC khi trinh duyet ve khung dau tien, neu khong khach
   * se thay no nhay mot cai o goc man hinh roi moi bay.
   *
   * Anh that trong khung chi tiet duoc giu mo (opacity 0) cho toi khi bay
   * xong -- neu khong thi no da nam san o dich, va ban sao bay qua chi
   * lam thua.
   */
  useLayoutEffect(() => {
    if (!flipStart || flipDone) return;
    const clone = flipCloneRef.current;
    const hero = heroRef.current;
    if (!clone || !hero) return;

    const target = hero.getBoundingClientRect();
    const animation = clone.animate(
      [
        {
          top: `${flipStart.rect.top}px`,
          left: `${flipStart.rect.left}px`,
          width: `${flipStart.rect.width}px`,
          height: `${flipStart.rect.height}px`,
          borderRadius: flipStart.borderRadius,
        },
        {
          top: `${target.top}px`,
          left: `${target.left}px`,
          width: `${target.width}px`,
          height: `${target.height}px`,
          borderRadius: "8px",
        },
      ],
      { duration: 560, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "forwards" },
    );

    let cancelled = false;
    function finish() {
      if (!cancelled) setFlipDone(true);
    }
    animation.addEventListener("finish", finish);
    // Luoi an toan: neu vi ly do nao do su kien `finish` khong bao gio ban
    // (tab bi an, animation bi huy), van phai lo anh that ra chu khong de
    // khung chi tiet trong khong.
    const guard = window.setTimeout(finish, 900);

    return () => {
      cancelled = true;
      animation.removeEventListener("finish", finish);
      window.clearTimeout(guard);
      animation.cancel();
    };
  }, [flipStart, flipDone]);

  useEffect(() => {
    if (introAlreadyPlayed) return;
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timeout = window.setTimeout(() => {
      setIntroVisible(false);
      markIntroPlayed();
    }, prefersReducedMotion ? 900 : 7200);

    return () => window.clearTimeout(timeout);
  }, [introAlreadyPlayed]);

  useEffect(() => {
    if (!modalOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setDetailId(null);
        setCheckoutOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [modalOpen]);

  const activeLabel = useMemo(() => {
    if (focusedDestinationId === "welcome") return t.welcomePoint as string;
    return destinations.find((destination) => destination.id === focusedDestinationId)?.name[lang] ?? (t.welcomePoint as string);
  }, [focusedDestinationId, lang, t.welcomePoint]);

  const detailDestination = detailId ? destinations.find((destination) => destination.id === detailId) : null;
  const detailFacts = detailId ? destinationFacts[detailId] : null;

  function toggleChip(id: string) {
    setSelectedChips((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function addDestination(id: DestinationId) {
    const destination = destinations.find((item) => item.id === id);
    if (!destination) return;
    setFocusedDestinationId(id);
    setSelectedIds((current) => (current.includes(id) ? current : [...current, id]));
    setItinerary((current) => (current.some((stop) => stop.id === id) ? current : [...current, stopFromDestination(destination)]));
    scrollToId("itinerary");
  }

  function addRoute(stops: DestinationId[]) {
    const routeStops = stops
      .map((id, index) => {
        const destination = destinations.find((item) => item.id === id);
        if (!destination) return null;
        return stopFromDestination(destination, ["08:00", "11:15", "16:30"][index] ?? "18:00");
      })
      .filter((stop): stop is ItineraryStop => Boolean(stop));

    setFocusedDestinationId(stops[0] ?? "welcome");
    setSelectedIds((current) => Array.from(new Set([...current, ...stops])));
    setItinerary(routeStops);
    scrollToId("itinerary");
  }

  function openDetail(id: DestinationId) {
    // Phai do vi tri anh nguon TRUOC khi khung chi tiet mo, vi luc do
    // trang bi khoa cuon va bo cuc co the doi.
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const start = reduced ? null : findFlipStart(id);
    setFlipStart(start);
    setFlipDone(!start);
    setFocusedDestinationId(id);
    setDetailId(id);
  }

  function focusDestination(id: DestinationId) {
    setFocusedDestinationId(id);
    scrollToId("map");
  }

  function createJourney() {
    setLoading(true);
    window.setTimeout(() => {
      const route = createRoute(selectedDuration, selectedChips);
      const selectedStops = selectedIds
        .map((id) => destinations.find((destination) => destination.id === id))
        .filter((destination): destination is Destination => Boolean(destination))
        .filter((destination) => !route.some((stop) => stop.id === destination.id))
        .map((destination) => stopFromDestination(destination));
      setItinerary([...route, ...selectedStops]);
      setLoading(false);
      scrollToId("itinerary");
    }, 750);
  }

  function replaceStop(index: number) {
    const replacement = destinations.find((destination) => !itinerary.some((stop) => stop.id === destination.id)) ?? destinations[index % destinations.length];
    setItinerary((current) => current.map((stop, stopIndex) => (stopIndex === index ? stopFromDestination(replacement, stop.time) : stop)));
    setSelectedIds((current) => (current.includes(replacement.id) ? current : [...current, replacement.id]));
    setFocusedDestinationId(replacement.id);
  }

  function removeStop(index: number) {
    setItinerary((current) => current.filter((_, stopIndex) => stopIndex !== index));
  }

  function switchLanguage(nextLang: Language) {
    if (nextLang === lang) return;

    setLang(nextLang);
    const nextUrl = languageUrl(nextLang, source, presentationMode);
    window.history.replaceState(null, "", nextUrl);
  }

  return (
    <main
      {...surfaceAttributes}
      className="min-h-screen bg-[#FBFAF6] text-[#1D2925]"
    >
      {/*
        INTRO -- KHONG CO DUONG BO QUA. Co y, theo yeu cau chu du an 05/08.
        Truoc day co ca nut "Bo qua intro" LAN bam-cho-nao-cung-tat.
        Ca hai da go: man intro 6,5 giay nay la khoang thoi gian duy nhat
        de trinh phat video kip boot xong TRUOC khi khach cuon toi -- cat
        ngan no la cum nut khoi dong cua YouTube lai dap vao mat khach
        (xem chu thich trong cinematic-video.tsx).

        Chay DUNG MOT LAN cho moi luot vao tham (WEB-PERF-01, 31/08): F5
        va bam "quay lai" deu giu nguyen `sessionStorage` cua tab nen
        khong chay lai; mo tab/cua so moi la mot luot vao tham khac nen
        van chay. Doi ngon ngu cung khong lam no chay lai (switchLanguage
        doi state noi bo + history.replaceState, khong dieu huong, nen
        `key` o app/page.tsx khong doi). Xem `showIntro`/`introAlreadyPlayed`
        va cac ham `*IntroPlayed*` phia tren dinh nghia component.

        Tu go bo bang `onAnimationEnd` thay vi hen gio cung 6500ms: duoi
        prefers-reduced-motion, CSS rut animation con 1400ms, hen gio cung
        se giu mot lop phu vo hinh them 5 giay khong ly do. Han hen gio
        7200ms/900ms trong effect phia tren chi la luoi an toan neu
        `animationend` vi ly do nao do khong ban.
      */}
      {showIntro ? (
        <div
          className="opening-screen"
          data-testid="opening-intro"
          onAnimationEnd={(event) => {
            if (event.target === event.currentTarget) {
              setIntroVisible(false);
              markIntroPlayed();
            }
          }}
        >
          <Image
            src="/images/destinations/intro-trang-an-rain.png"
            alt=""
            fill
            priority
            sizes="100vw"
            className="opening-image object-cover"
          />
          {/*
            Ba lop mau lay tu chinh phong canh: xanh rong/da voi, vang
            nang muon va dat nung di san. Day la color-grade thuần CSS
            tren anh that, khong phai mot man WebGL doc lap chen vao intro.
          */}
          <div className="opening-palette" aria-hidden="true" />
          <div className="opening-vignette" />
          <div className="opening-sequence">
            {trailerWords.map((word, index) => (
              <span key={`${word}-${index}`}>{word}</span>
            ))}
          </div>
          <div className="opening-lockup">
            <p>Ninh Bình</p>
            <div />
            <span>{trailerWords.slice(1).join(" · ")}</span>
          </div>
        </div>
      ) : null}
      <section ref={heroSceneRef} data-customer-section="home-hero" data-hero-scene data-motion="static" className="hero-identity-scene relative overflow-hidden bg-[#183F34] text-[#FBFAF6]">
        <Image
          src="/images/destinations/trang-an.jpg"
          alt={lang === "en" ? "Ninh Binh limestone landscape" : "Phong cảnh núi đá vôi Ninh Bình"}
          fill
          priority
          sizes="100vw"
          className="hero-scene-image object-cover"
        />
        <div className="hero-scene-scrim absolute inset-0" />
        {/* The opening rain frame returns as a clipped limestone aperture. */}
        <div className="hero-depth-window pointer-events-none absolute" data-hero-depth-window aria-hidden="true">
          <Image src="/images/destinations/intro-trang-an-rain.png" alt="" fill sizes="(max-width: 767px) 118vw, 54vw" className="hero-depth-image object-cover" />
          <span className="hero-depth-grade" />
        </div>
        <svg className="hero-depth-lines pointer-events-none absolute" aria-hidden="true" viewBox="0 0 720 900" preserveAspectRatio="xMidYMid slice">
          <path className="hero-depth-contour" d="M71 900V386c0-84 29-148 86-192 49-38 98-40 146-8 28-91 92-146 191-166 85-17 150 13 195 90" fill="none" />
          <path className="hero-depth-river" d="M134 716c126-82 212-27 289-75 78-49 127-164 243-168" fill="none" />
        </svg>
        {/*
          Tong mau anh mo dau doi theo GIO THAT o Ninh Binh: hung vang luc
          rang, trong luc trua, ho phach luc chieu, cham luc dem. Khong bia
          so lieu nao -- chi la dong ho, va anh thi van la anh that.
          `ninhBinhHour` la `null` cho toi khi mount xong tren may khach
          (tranh lech HTML may chu), luc do khong ve lop nao ca.
        */}
        {ninhBinhHour ? (
          <div className={`pointer-events-none absolute inset-0 hero-tod hero-tod-${ninhBinhHour.band}`} />
        ) : null}
        <div className="absolute inset-x-0 top-0 z-20 mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
          <a href="#top" className="flex items-center gap-2" aria-label="Ninh Bình Journey">
            <Image
              src="/brand/ninh-binh-mark.png"
              alt=""
              width={42}
              height={42}
              className="h-10 w-10 rounded-full object-cover shadow-lg shadow-black/20"
            />
            <span className="font-display hidden text-lg tracking-[0.08em] sm:inline">
              Ninh Bình
            </span>
          </a>
          <nav aria-label="Primary" className="hidden gap-6 text-sm text-[#FBFAF6]/82 md:flex">
            {(t.nav as string[]).map((item, index) => (
              // Neo thu hai truoc day tro toi `#stories` -- khoi do da xoa
              // han 05/08 nen lien ket roi vao hu khong. Gio tro toi danh
              // muc diem den, dung voi nhan moi cua no.
              <a key={item} href={`#${["destinations-highlights", "curated-routes", "packages", "mid-autumn"][index]}`} className="transition hover:text-[#E7B96A]">
                {item}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-2">
          {/*
            QA-P2-09: tren dien thoai, thanh dieu huong `md:flex` an di va menu
            trang chi con nam sau nut noi ten "Tro ly hanh trinh" -- nguoi tim
            menu khong bam vao do. Nut "Muc luc" dung dung cho nguoi ta tim menu
            va mo chinh hop thoai muc luc ay.
          */}
          <button
            type="button"
            onClick={(event) => event.currentTarget.dispatchEvent(new Event(JOURNEY_CONCIERGE_OPEN_EVENT, { bubbles: true }))}
            aria-haspopup="dialog"
            aria-controls="journey-concierge-dialog"
            className="inline-flex min-h-10 items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3.5 text-sm font-semibold text-[#FBFAF6] backdrop-blur transition hover:bg-white/20 md:hidden"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M4 7h16M4 12h16M4 17h10" />
            </svg>
            {lang === "vi" ? "Mục lục" : "Menu"}
          </button>
          <div className="flex rounded-full border border-white/25 bg-white/10 p-1 text-sm backdrop-blur">
            <button type="button" className={`rounded-full px-3 py-1.5 ${lang === "en" ? "bg-[#FBFAF6] text-[#183F34]" : ""}`} onClick={() => switchLanguage("en")}>EN</button>
            <button type="button" className={`rounded-full px-3 py-1.5 ${lang === "vi" ? "bg-[#FBFAF6] text-[#183F34]" : ""}`} onClick={() => switchLanguage("vi")}>VI</button>
          </div>
          </div>
        </div>
        <div id="top" className="hero-scene-content relative z-10 mx-auto flex h-full max-w-7xl flex-col justify-end px-4 pb-[calc(4rem+var(--nbj-consent-offset,0px))] pt-28 min-[280px]:px-5 sm:px-8 lg:pb-[calc(6rem+var(--nbj-consent-offset,0px))]">
          {/*
            Nhan "Client demonstration · Supabase shared core" da GO HAN
            05/08. Day la ngon ngu KY THUAT NOI BO lot thang ra mat khach
            du lich: "Supabase shared core" khong co nghia gi voi nguoi
            xem, va con lam trang trong nhu mot ban thu nghiem chua xong.
            Dung bug nay da tung bi bat mot lan (xem HANDOFF 03/08: "Ninh
            Binh tourism core", "Intent -> rules -> validated itinerary",
            "Trang thai: idle") -- lan nay la cho con sot lai.
          */}
          <h1 className="hero-signature-title fade-up break-words font-display text-[clamp(3.25rem,14vw,9rem)] leading-[0.9]" data-hero-title={t.title}><span>{t.title}</span></h1>
          <div className="hero-copy-safe">
            <p className="fade-up mt-6 max-w-2xl text-xl leading-8 text-[#FBFAF6]/88 sm:text-2xl">{t.subtitle}</p>
          {/*
            Gio that tai Ninh Binh. Bien trang tu mot to roi thanh mot noi
            DANG TON TAI -- va vi moi khung gio keo theo mot chi tiet rieng
            cua chinh vung nay, dong nay khong the copy sang site khac.
            Chi hien sau khi mount (xem chu thich trong ninh-binh-hour.tsx).
          */}
          {ninhBinhHour ? (
            <p className="mt-5 text-sm text-[#FBFAF6]/72 sm:text-base">
              <span className="tabular-nums text-[#E7B96A]">
                {t.hourLead as string} {ninhBinhHour.clock}
              </span>
              , {(t.hourPhrases as Record<DayBand, string>)[ninhBinhHour.band]}.
            </p>
          ) : null}
          <div className="fade-up mt-9 flex flex-col gap-3 sm:flex-row">
            <a data-customer-track="home-hero-plan" data-customer-content-id="journey-planner" data-customer-content-type="primary-cta" href={`/plan?lang=${lang}${source ? `&source=${encodeURIComponent(source)}` : ""}`} className="rounded-full bg-[#E7B96A] px-6 py-3 text-center font-semibold text-[#183F34] shadow-xl shadow-black/20 transition hover:bg-[#f0c87c]">{t.begin}</a>
            <a data-customer-track="home-hero-explore" data-customer-content-id="explore-map" data-customer-content-type="secondary-cta" href={`/explore?lang=${lang}${source ? `&source=${encodeURIComponent(source)}` : ""}`} className="rounded-full border border-white/35 px-6 py-3 text-center font-semibold text-white transition hover:bg-white/12">{t.exploreMap}</a>
          </div>
          <a
            data-customer-track="home-hero-packages"
            data-customer-content-id="packages-catalog"
            data-customer-content-type="tertiary-cta"
            href="#packages"
            className="fade-up mt-5 inline-flex max-w-full w-fit items-center gap-2 text-sm font-semibold leading-6 text-[#E7B96A] underline decoration-[#E7B96A]/40 underline-offset-4 transition hover:decoration-[#E7B96A]"
          >
            {bookingEnabled ? t.heroPackagesCue : t.heroPackagesCuePlain} <span aria-hidden="true">↓</span>
          </a>
          </div>
        </div>
        <div className="hero-handoff" data-hero-handoff aria-hidden="true">
          <span />
          <svg viewBox="0 0 520 50" preserveAspectRatio="none"><path d="M0 31C77 31 93 9 151 9c62 0 68 31 132 31 69 0 87-29 155-29 34 0 58 7 82 18" /></svg>
          <i />
        </div>
      </section>

      {/*
        `eager`: man intro khoa man hinh vai giay ngay dau trang, tan dung
        dung khoang do de trinh phat boot xong truoc khi khach cuon toi.
        Truoc 31/08 con hai bang video nua o duoi trang (rai deu 2,2s /
        4,2s de khong nap ca ba cung luc); chu du an chi muon giu dung
        video dau nen hai bang do da bi bo, xem chu thich o dinh nghia
        `cinematicClip` phia tren.
      */}
      <div className="hero-cinematic-handoff" data-hero-cinematic-handoff>
        <CinematicVideo clip={cinematicClip[lang]} eager />
      </div>

      <TrangAnScrollStory {...trangAnStory[lang]} />

      <JourneyConcierge lang={lang} />

      <section id="map" data-customer-section="home-map" className="scroll-mt-20 px-4 py-16 min-[280px]:px-5 sm:px-8 lg:py-24">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.72fr_1.28fr] lg:items-center">
          <Reveal>
            <p className="text-sm uppercase tracking-[0.24em] text-[#3F7568]">{t.youAreHere}</p>
            <RevealHeading as="h2" text="Ninh Bình" className="font-display mt-3 text-5xl text-[#183F34] sm:text-6xl" />
            <div className="mt-6 rounded-[8px] border border-[#A8CEC1]/60 bg-white/80 p-5 shadow-sm">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#6D756F]">{t.qrSource}</p>
              <p className="mt-2 text-xl text-[#183F34]">{activeLabel}</p>
            </div>
            <p className="mt-7 max-w-xl text-lg leading-8 text-[#4d5b55]">{t.mapBody}</p>
            <p className="mt-3 max-w-xl text-sm font-semibold text-[#3F7568]">{t.mapHint}</p>
            {/* Trước đây nút này cuộn xuống danh mục ngay bên dưới. Danh mục
                đã chuyển sang /explore nên nút phải dẫn tới đó, không cuộn tới
                một chỗ không còn nữa. */}
            <a
              href={`/explore?lang=${lang}${source ? `&source=${encodeURIComponent(source)}` : ""}`}
              className="mt-7 inline-flex rounded-full bg-[#183F34] px-5 py-3 font-semibold text-white transition hover:bg-[#24594a]"
            >
              {t.nearby}
            </a>
          </Reveal>
          <div
            ref={mapWrapRef}
            className="relative z-0 isolate overflow-hidden rounded-[8px] border border-[#A8CEC1]/70 bg-[#F6F1E7] p-3 shadow-xl shadow-[#183F34]/10"
          >
            {mapNearViewport ? (
              <TourismMap
                activeDestinationId={focusedDestinationId}
                copy={{
                  add: t.add as string,
                  added: t.added as string,
                  discover: t.discover as string,
                  locationDenied: t.locationDenied as string,
                  locationFound: t.locationFound as string,
                  locationOutside: t.locationOutside as string,
                  locating: t.locating as string,
                  nearMe: t.nearMe as string,
                  welcome: t.welcome as string,
                  welcomeDescription: t.welcomeDescription as string,
                  youAreHere: t.youAreHere as string,
                }}
                destinations={destinations}
                lang={lang}
                onAdd={addDestination}
                onDiscover={openDetail}
                selectedIds={selectedIds}
              />
            ) : (
              <div className="grid h-[560px] min-h-[70vh] place-items-center rounded-[8px] bg-[#D7E6DD] text-[#183F34]">
                <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#A8CEC1] border-t-[#183F34]" />
              </div>
            )}
          </div>
        </div>
      </section>

      {/*
        Khoi `#stories` ("Ba cau chuyen de bat dau...") DA XOA HAN 05/08
        theo yeu cau chu du an. Hai ly do, ca hai deu dung:
         - Cau chu noi "Ba cau chuyen" nhung ba the that da bi go truoc do
           (chung lap lai nguyen van voi zigzag) -- nen dong chu tu no da
           thanh sai.
         - Ngay ca khi sua so, no van chi la mot man chu bat khach doc
           them truoc khi thay noi dung that. Danh muc ngay ben duoi tu
           gioi thieu duoc.
        Cac khoa chu `stories` / `storiesIntro` / `hiddenGemsIntro` van
        con trong bang `copy` vi `/explore` dung chung -- dung xoa chung.
      */}

      {/*
        WEB-STRUCT-02 (31/08): khoi "diem noi bat" ngan -- chu du an yeu
        cau "sắp xếp lại 1 chút kiểu như các địa điểm hot ở Ninh Bình".
        Chi 6/15 diem (`FEATURED_DESTINATION_IDS`, chon trong so 9 diem
        `tier: "signature"` da co, khong bia diem moi), dan thang vao danh
        muc day du ngay ben duoi qua neo `#destinations`. Chu lay tu
        `tagline`/`category` da co trong mang `destinations`, khong tu che
        cau moi cho tung the.
      */}
      <section
        id="destinations-highlights"
        data-customer-section="home-featured-destinations"
        className="scroll-mt-20 bg-[#FBFAF6] px-4 py-16 min-[280px]:px-5 sm:px-8 lg:py-20"
      >
        <div className="mx-auto max-w-7xl">
          <Reveal className="max-w-3xl">
            <p className="text-sm font-extrabold uppercase tracking-[0.24em] text-[#3F7568]">{t.featuredLabel}</p>
            <RevealHeading
              as="h2"
              text={t.featuredTitle as string}
              className="font-display mt-4 text-4xl leading-tight text-[#183F34] sm:text-6xl"
            />
            <p className="mt-5 text-lg leading-relaxed text-[#4A5751]">{t.featuredIntro}</p>
          </Reveal>
          <div className="mt-10 flex gap-5 overflow-x-auto pb-2 [scrollbar-width:none] sm:gap-6">
            {FEATURED_DESTINATION_IDS.map((id) => destinations.find((place) => place.id === id))
              .filter((place): place is Destination => Boolean(place))
              .map((place) => (
                <button
                  key={place.id}
                  type="button"
                  data-customer-track={`home-featured-${place.id}`}
                  data-customer-content-id={place.id}
                  data-customer-content-type="destination"
                  onClick={() => openDetail(place.id)}
                  className="group relative w-64 shrink-0 overflow-hidden rounded-[10px] text-left shadow-lg shadow-[#183F34]/12 sm:w-72"
                >
                  <div className="relative aspect-[4/5] w-full">
                    <Image
                      src={place.image}
                      alt={place.name[lang]}
                      fill
                      sizes="288px"
                      className="object-cover transition duration-500 group-hover:scale-105"
                      style={{ objectPosition: place.imagePosition }}
                    />
                    <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(12,28,23,0),rgba(12,28,23,.16)_55%,rgba(12,28,23,.88))]" />
                    <div className="absolute inset-x-0 bottom-0 p-4 text-white sm:p-5">
                      <p className="text-[0.65rem] font-extrabold uppercase tracking-[0.18em] text-[#E7B96A]">
                        {place.category[lang]}
                      </p>
                      <p className="font-display mt-1 text-2xl leading-none">{place.name[lang]}</p>
                      <p className="mt-2 text-sm leading-5 text-white/78">{place.tagline[lang]}</p>
                    </div>
                  </div>
                </button>
              ))}
          </div>
          <div className="mt-8 text-center">
            <a
              href="#destinations"
              className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[#183F34]/30 px-6 font-semibold text-[#183F34] transition hover:bg-[#183F34]/6"
            >
              {t.featuredCta} <span aria-hidden="true">→</span>
            </a>
          </div>
        </div>
      </section>

      {/*
        Danh muc diem den chia lam HAI NHIP, co chu dich (05/08).
        Truoc do ca 15 diem di qua cung mot khuon zigzag: 9.540px lien
        tuc, tuc 44% ca trang, va doc rat deu deu -- den diem thu bay thi
        moi hang deu giong hang truoc.
        Gio: `ZIGZAG_FEATURED` diem dau giu nguyen zigzag anh lon (phan
        nay dep va da duoc chu du an khen), phan con lai chuyen sang
        `DestinationIndex` -- danh sach ten lon, anh bam con tro tren may
        de ban, anh vuong nho tren dien thoai. Hai nhip khac nhau doc nhu
        mot to tap chi, VA van giu du ca 15 diem tren trang chu, khong
        cat bot noi dung nao.
      */}
      <div id="destinations" className="scroll-mt-24" aria-hidden="true" />
      <DestinationZigzag
        items={destinations.slice(0, ZIGZAG_FEATURED).map((place) => ({
          id: place.id,
          name: place.name[lang],
          image: place.image,
          imagePosition: place.imagePosition,
          category: place.category[lang],
          duration: place.duration[lang],
          tagline: place.tagline[lang],
          description: place.description[lang],
          highlights: place.highlights[lang],
        }))}
        copy={{
          sectionLabel: t.zigzagLabel as string,
          sectionTitle: t.zigzagTitle as string,
          sectionIntro: t.zigzagIntro as string,
          explore: t.discover as string,
          add: t.add as string,
          added: t.added as string,
        }}
        onExplore={(id) => openDetail(id as DestinationId)}
        onAdd={(id) => addDestination(id as DestinationId)}
        isAdded={(id) => selectedIds.includes(id as DestinationId)}
      />

      <DestinationIndex
        items={destinations.slice(ZIGZAG_FEATURED).map((place, index) => ({
          id: place.id,
          ordinal: String(ZIGZAG_FEATURED + index + 1).padStart(2, "0"),
          name: place.name[lang],
          image: place.image,
          imagePosition: place.imagePosition,
          category: place.category[lang],
          duration: place.duration[lang],
          tagline: place.tagline[lang],
        }))}
        copy={{
          sectionLabel: t.indexLabel as string,
          sectionTitle: t.indexTitle as string,
          sectionIntro: t.indexIntro as string,
          hint: t.indexHint as string,
          openLabel: t.indexOpen as string,
        }}
        onSelect={(id) => openDetail(id as DestinationId)}
      />

      {/*
        Ba tuyen goi y tung nam ngay sau hero, truoc ca video, ban do va
        danh muc diem den. Tren dien thoai no bat khach doc ba man chu dai
        truoc khi biet trang co nhung noi nao. Dat o day de khach xem het
        danh muc truoc, roi moi ghep cac diem thanh mot hanh trinh.

        The cu dung anh lam nen cho TOAN BO chu va khoa chieu cao 520px:
        tren desktop van chat, tren mobile thi body + tag + hai nut bi ep
        vao mot goc. Bo cuc moi tach anh va noi dung thanh hai mat phang;
        khong khoa chieu cao, nen chu duoc phep tho theo do dai that.
      */}
      <section id="curated-routes" data-customer-section="home-curated-routes" className="route-showcase scroll-mt-20 overflow-hidden bg-[#F6F1E7] py-16 text-[#1D2925] sm:py-20 lg:py-24">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <Reveal className="grid gap-6 lg:grid-cols-[0.78fr_1.22fr] lg:items-end">
            <div>
              <p className="text-sm font-extrabold uppercase tracking-[0.24em] text-[#3F7568]">{t.journeysLabel}</p>
              <RevealHeading
                as="h2"
                text={t.journeysTitle as string}
                className="font-display mt-4 max-w-3xl text-5xl leading-[0.98] text-[#183F34] sm:text-7xl"
              />
            </div>
            <div className="max-w-2xl lg:justify-self-end">
              <p className="text-lg leading-8 text-[#4d5b55]">{t.journeysBody}</p>
            </div>
          </Reveal>
        </div>

        <div
          ref={railRef}
          className="route-rail mt-12 flex items-stretch snap-x snap-mandatory gap-5 overflow-x-auto px-5 pb-5 sm:gap-6 sm:px-8 lg:px-[max(2rem,calc((100vw-80rem)/2+2rem))]"
          onPointerDown={handleRailPointerDown}
          onPointerMove={handleRailPointerMove}
          onPointerUp={endRailDrag}
          onPointerLeave={endRailDrag}
          onClickCapture={handleRailClickCapture}
        >
          {routeCollections.map((route, index) => {
            const routeStops = route.stops
              .map((id) => destinations.find((destination) => destination.id === id))
              .filter((destination): destination is Destination => Boolean(destination))
              .map((destination) => ({
                id: destination.id,
                name: destination.name[lang],
                image: destination.image,
                imagePosition: destination.imagePosition,
                category: destination.category[lang],
                duration: destination.duration[lang],
              }));
            return (
              <RouteShowcaseCard
                key={route.id}
                index={index}
                kicker={route.kicker[lang]}
                title={route.title[lang]}
                body={route.body[lang]}
                stops={routeStops}
                copy={{
                  exploreStop: t.exploreRouteStop as string,
                  addRoute: t.addRoute as string,
                  stopLabel: t.routeStopLabel as string,
                }}
                onExploreStop={(id) => openDetail(id as DestinationId)}
                onAddRoute={() => addRoute(route.stops)}
                onPointerMove={handleRouteCardPointerMove}
                onPointerLeave={resetRouteCardTilt}
              />
            );
          })}
        </div>
        <div className="mx-auto mt-5 flex max-w-7xl items-center gap-4 px-5 text-[0.68rem] font-extrabold uppercase tracking-[0.2em] text-[#3F7568] sm:px-8">
          <span>{String(Math.min(routeCollections.length, Math.round(routeProgress * (routeCollections.length - 1)) + 1)).padStart(2, "0")}</span>
          <div className="route-progress-track h-px flex-1 overflow-hidden bg-[#A8CEC1]/65" aria-hidden="true">
            <span
              className="block h-full origin-left bg-[#183F34] transition-transform duration-300"
              style={{ transform: `scaleX(${Math.max(0.06, routeProgress)})` }}
            />
          </div>
          <span>{String(routeCollections.length).padStart(2, "0")}</span>
          <span className="hidden text-[#6D756F] sm:inline">{lang === "vi" ? "Kéo để chuyển tuyến" : "Drag to change route"}</span>
        </div>
      </section>

      {/*
        Khoi "gói trải nghiệm" (WEB-BOOK-01): dat ngay sau dai tuyen goi y,
        truoc JourneyCta -- khach vua xem xong 15 diem den + cac tuyen goi
        y, gio thay ngay 5 goi CO GIA, CO LICH, bam la vao duoc /packages.
        Truoc dot nay trang chu khong co duong nao toi /packages hay
        /checkout ca; JourneyCta ben duoi co nut "secondary" tro toi
        /packages nhung nam cuoi trang va khong co du lieu goi nao di kem.
      */}
      <PackageShowcase
        lang={lang}
        source={source}
        copy={{
          label: t.packagesLabel as string,
          title: t.packagesTitle as string,
          intro: t.packagesIntro as string,
          bookingNote: (bookingEnabled ? t.packagesBookingNote : t.packagesBookingNotePlain) as string,
          cta: t.packagesCta as string,
          viewAll: t.packagesViewAll as string,
          pricePerGuest: t.packagesPricePerGuest as string,
          callCta: t.packagesCallCta as string,
          emailCta: t.packagesEmailCta as string,
          callNote: t.packagesCallNote as string,
        }}
      />

      <JourneyCta
        copy={{
          title: t.zigzagCtaTitle as string,
          body: t.zigzagCtaBody as string,
          primary: t.zigzagCtaPrimary as string,
          secondary: t.zigzagCtaSecondary as string,
          /*
           * Truoc day dong nay doc `clientDemo` (tuc
           * NEXT_PUBLIC_EXPERIENCE_MODE=client-demo, thanh toan sandbox) va
           * chu thich cu noi o production /checkout tra ve "Online checkout
           * is not configured". Da kiem lai bang curl len production hom
           * nay: /checkout tra ve nhanh "Gói A · giữ chỗ trên lõi ERP", tuc
           * la dat cho THAT dang bat -- chu thich cu sai, vi thu quyet dinh
           * that KHONG PHAI `clientDemo` ma la bien moi truong
           * CUSTOMER_BOOKING_ENABLED (xem
           * lib/customer-data/booking-repository.ts#isCustomerBookingEnabled,
           * dung chung mot ham voi /packages va /checkout). `clientDemo` gio
           * bo han khoi Props vi khong con noi nao trong file nay dung toi.
           *
           * WEB-BOOK-01, loi bat duoc khi soat tay: chinh viec doi cong tac
           * tu `clientDemo` sang `bookingEnabled` da BAT LEN mot loi hua sai.
           * Cau cu viet "dat qua website giam 10% so voi gia tai quay, thanh
           * toan bang ma QR ngay tren trinh duyet" -- ca hai ve deu khong co
           * that: khong cho nao trong ma nay giam 10%, va
           * customer-booking-checkout noi ro thanh toan la MO PHONG, khong
           * thu tien, khong co QR thanh toan (QR o day la ma ve, hien ra SAU
           * khi da xac nhan). Ky truoc cau nay bi `clientDemo` che lai nen
           * khong ai thay. Da viet lai cho dung viec that.
           */
          offer: (bookingEnabled ? t.zigzagCtaOffer : t.zigzagCtaOfferPlain) as string,
        }}
      />

      <section id="ai" data-customer-section="home-itinerary-brief" className="scroll-mt-20 px-4 py-16 min-[280px]:px-5 sm:px-8 lg:py-24">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <Reveal>
            <p className="text-sm uppercase tracking-[0.24em] text-[#3F7568]">{t.companionLabel}</p>
            <RevealHeading
              as="h2"
              text={t.companionTitle as string}
              className="font-display mt-3 text-4xl text-[#183F34] sm:text-6xl"
            />
            <p className="mt-5 max-w-xl text-lg leading-8 text-[#4d5b55]">{t.companionBody}</p>
          </Reveal>
          <Reveal delayMs={120} className="rounded-[8px] border border-[#A8CEC1]/70 bg-white p-5 shadow-xl shadow-[#183F34]/10">
            <div className="grid grid-cols-1 gap-2 min-[280px]:grid-cols-3">
              {durations.map((duration) => (
                <button key={duration.id} type="button" onClick={() => setSelectedDuration(duration.id)} className={`rounded-full border px-3 py-2 text-sm font-semibold ${selectedDuration === duration.id ? "border-[#183F34] bg-[#183F34] text-white" : "border-[#A8CEC1] text-[#183F34]"}`}>
                  {duration[lang]}
                </button>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-1 gap-2 min-[280px]:grid-cols-2 sm:grid-cols-3">
              {chips.map((chip) => {
                const selected = selectedChips.includes(chip.id);
                return (
                  <button key={chip.id} type="button" aria-pressed={selected} onClick={() => toggleChip(chip.id)} className={`rounded-full border px-3 py-2 text-sm transition ${selected ? "border-[#183F34] bg-[#183F34] text-white" : "border-[#A8CEC1] text-[#183F34] hover:bg-[#F6F1E7]"}`}>
                    {chip[lang]}
                  </button>
                );
              })}
            </div>
            <textarea className="mt-5 min-h-32 w-full resize-none rounded-[8px] border border-[#A8CEC1] bg-[#FBFAF6] p-4 text-[#1D2925] outline-none transition focus:border-[#3F7568]" placeholder={t.prompt as string} defaultValue={lang === "en" ? "I have one day, travel with my parents, and prefer a relaxed cultural route." : "Tôi có một ngày, đi cùng bố mẹ và muốn một lịch trình văn hóa nhẹ nhàng."} />
            <div className="mt-4 flex justify-end">
              <button type="button" onClick={createJourney} disabled={loading} className="w-full min-w-0 rounded-full bg-[#183F34] px-5 py-2 font-semibold text-white transition hover:bg-[#24594a] disabled:cursor-wait disabled:opacity-75 min-[280px]:w-auto min-[280px]:min-w-44">
                {loading ? t.creating : t.create}
              </button>
            </div>
          </Reveal>
        </div>
      </section>

      <section id="itinerary" data-customer-section="home-itinerary-result" className="scroll-mt-20 overflow-x-clip bg-[#F6F1E7] px-4 py-16 min-[280px]:px-5 sm:px-8 lg:py-24">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1.05fr_.95fr]">
          <div>
            <Reveal>
              <p className="text-sm uppercase tracking-[0.24em] text-[#3F7568]">{t.itinerary}</p>
              <RevealHeading
                as="h2"
                text={t.itinerary as string}
                className="font-display mt-3 text-[clamp(2.25rem,7vw,3.75rem)] leading-tight text-[#183F34] [text-wrap:balance]"
              />
              <p className="mt-3 text-[#58665F]">{t.itineraryNote}</p>
            </Reveal>
            <div className="mt-6 overflow-hidden rounded-[8px] border border-[#A8CEC1]/70 bg-[#FBFAF6]">
              {itinerary.map((stop, index) => (
                <article key={`${stop.time}-${stop.id}-${index}`} className="grid min-w-0 gap-4 border-b border-[#A8CEC1]/40 p-3 last:border-b-0 min-[280px]:p-4 sm:grid-cols-[88px_minmax(0,1fr)_auto]">
                  <p className="font-semibold text-[#183F34]">{stop.time}</p>
                  <div className="min-w-0">
                    <h3 className="break-words font-display text-2xl leading-tight text-[#183F34]">{stop.title[lang]}</h3>
                    <p className="mt-1 break-words text-sm text-[#6D756F]">{stop.note[lang]} · {stop.distance[lang]}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {stop.tags[lang].map((tag) => <span key={tag} className="rounded-full bg-[#F6F1E7] px-3 py-1 text-xs text-[#3F7568]">{tag}</span>)}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-start gap-2 sm:justify-end">
                    <span className="rounded-full bg-[#F6F1E7] px-3 py-2 text-sm text-[#3F7568]">{stop.duration[lang]}</span>
                    <button
                      type="button"
                      onClick={() => (stop.id === "local_lunch" ? scrollToId("map") : focusDestination(stop.id))}
                      className="rounded-full border border-[#A8CEC1] px-3 py-2 text-sm text-[#183F34]"
                    >
                      {t.directions}
                    </button>
                    <button type="button" onClick={() => replaceStop(index)} className="rounded-full border border-[#A8CEC1] px-3 py-2 text-sm text-[#183F34]">{t.replace}</button>
                    <button type="button" onClick={() => removeStop(index)} className="rounded-full border border-[#A94442]/30 px-3 py-2 text-sm text-[#A94442]">{t.remove}</button>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <aside id="experience" className="min-w-0 rounded-[8px] bg-[#183F34] p-4 text-[#FBFAF6] shadow-xl shadow-[#183F34]/20 min-[280px]:p-6">
            <div className="relative mb-6 aspect-[16/10] overflow-hidden rounded-[8px]">
              <Image src="/images/destinations/hoa-lu-old-town.jpg" alt={t.experienceName as string} fill sizes="(min-width: 1024px) 40vw, 100vw" className="object-cover" />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent,rgba(24,63,52,.55))]" />
            </div>
            <p className="text-sm uppercase tracking-[0.24em] text-[#A8CEC1]">{t.experienceTitle}</p>
            <h2 className="break-words font-display mt-4 text-[clamp(2rem,10vw,2.5rem)] leading-tight">{t.experienceName}</h2>
            <p className="mt-4 leading-7 text-[#FBFAF6]/78">{t.experienceBody}</p>
            <p className="mt-6 rounded-[8px] bg-white/10 p-4 text-[#FBFAF6]/86">{t.experienceFit}</p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button type="button" onClick={() => openDetail("hoa_lu_old_town")} className="rounded-full border border-white/30 px-5 py-3 font-semibold transition hover:bg-white/10">{t.viewExperience}</button>
              <button type="button" onClick={() => setCheckoutOpen(true)} className="rounded-full bg-[#E7B96A] px-5 py-3 font-semibold text-[#183F34] transition hover:bg-[#f0c87c]">{t.reserve}</button>
            </div>
          </aside>
        </div>
      </section>

      {/*
        WEB-STRUCT-02 (31/08): loi moi hop tac cho nhan hang/doanh nghiep
        -- chu du an yeu cau "liên hệ hợp tác với các nhãn hàng bla bla".
        Khoi nay khong nhac ten thuong hieu nao; tu 13/09/2026 trang cung
        khong con khoi thuong hieu nao (BRAND-LEGAL-01 trong docs/HANDOFF.md), chi moi nhan hang/doanh nghiep that lien he qua dung so dien
        thoai/email o `content/contact.ts`.
      */}
      <section
        id="partnerships"
        data-customer-section="home-business-partnerships"
        className="scroll-mt-20 bg-[#183F34] px-4 py-16 text-white min-[280px]:px-5 sm:px-8 lg:py-20"
      >
        <div className="mx-auto max-w-6xl">
          <Reveal className="max-w-3xl">
            <p className="text-sm font-extrabold uppercase tracking-[0.24em] text-[#A8CEC1]">{t.partnersLabel}</p>
            <RevealHeading
              as="h2"
              text={t.partnersTitle as string}
              className="font-display mt-4 text-4xl leading-tight sm:text-6xl"
            />
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-white/78">{t.partnersBody}</p>
          </Reveal>
          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {[
              [t.partnersCategory1Title, t.partnersCategory1Body],
              [t.partnersCategory2Title, t.partnersCategory2Body],
              [t.partnersCategory3Title, t.partnersCategory3Body],
            ].map(([title, body]) => (
              <div key={title as string} className="rounded-[10px] border border-white/15 bg-white/6 p-5">
                <p className="font-display text-xl">{title}</p>
                <p className="mt-2 text-sm leading-6 text-white/72">{body}</p>
              </div>
            ))}
          </div>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
            <a
              href={contactInfo.phoneHref}
              data-customer-track="home-partnerships-call"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#E7B96A] px-6 font-semibold text-[#183F34] transition hover:bg-[#f0c87c]"
            >
              {t.partnersCall} · {contactInfo.phoneLabel}
            </a>
            <ProtectedMailLink
              subject={
                lang === "vi"
                  ? "Hợp tác cùng Ninh Bình Journey"
                  : "Partnership enquiry — Ninh Binh Journey"
              }
              track="home-partnerships-email"
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/35 px-6 font-semibold text-white transition hover:bg-white/12"
            >
              {t.partnersEmail}
            </ProtectedMailLink>
          </div>
        </div>
      </section>

      <MidAutumnCampaign lang={lang} source={source} />

      <footer className="border-t border-[#e2ded2] bg-[#FBFAF6] px-5 py-10 text-center sm:px-8">
        <p className="font-display text-lg text-[#183F34]">{t.footerNote}</p>
        <a
          href={`/tra-cuu-ve?lang=${lang}${source ? `&source=${encodeURIComponent(source)}` : ""}`}
          className="mt-3 inline-block text-sm font-semibold text-[#356957] underline decoration-[#356957]/40 underline-offset-4 transition hover:text-[#183F34]"
        >
          {t.footerLookup}
        </a>
      </footer>

      {/*
        Tren dien thoai khoi chi tiet nay tung gan nhu TRAN VIEN: chi 16px
        le hai ben va 24px tren duoi, goc bo 8px gan nhu khong thay -- mo
        ra thi giong nhu vua chuyen sang mot trang khac chu khong phai mot
        lop phu, va neu khong co nut Dong thi khach khong biet duong ra.
        Sua 06/08 theo phan hoi truc tiep: chua le tren 64px de LUON nhin
        thay lop nen mo phia tren (tin hieu "day la mot lop, cham ra ngoai
        la dong"), bo goc 16px cho ro, va ha chieu cao toi thieu cua anh
        tu 320px xuong 240px de anh khong chiem nua man hinh.
      */}
      {detailDestination && detailFacts ? (
        <div
          className="fixed inset-0 z-[1200] overflow-y-auto bg-[#1D2925]/82 px-4 pb-8 pt-16 backdrop-blur-md sm:py-10"
          role="dialog"
          aria-modal="true"
          aria-labelledby="destination-detail-title"
          onMouseDown={() => setDetailId(null)}
        >
          <article
            className="relative mx-auto w-full max-w-6xl overflow-hidden rounded-[16px] bg-[#FBFAF6] shadow-2xl sm:rounded-[8px]"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setDetailId(null)}
              className="absolute right-4 top-4 z-10 rounded-full border border-white/40 bg-[#1D2925]/70 px-4 py-2 text-sm font-bold text-white backdrop-blur transition hover:bg-[#183F34]"
              aria-label={t.detailClose as string}
            >
              {t.close}
            </button>
            {/*
              `min-h` khong quyet dinh chieu cao that: khoi chu ben duoi
              duoc dinh vi tuyet doi, nen neu chu cao hon khung thi no
              tran len va bi `overflow-hidden` CAT MAT dong dau. Da xay ra
              that khi ha 320px xuong 240px: dong the loai bi cat, con
              tieu de thi doi len dung cho nut Dong (chup duoc 06/08).
              Nen: khung du cao, chu nho lai tren dien thoai, VA khoi chu
              chua san le phai de khong bao gio dung vao nut Dong.
            */}
            <div ref={heroRef} className="relative min-h-[300px] overflow-hidden sm:min-h-[440px]">
              <Image
                src={detailDestination.image}
                alt={detailDestination.name[lang]}
                fill
                sizes="(min-width: 1280px) 1120px, 100vw"
                quality={95}
                className="object-cover"
                style={{
                  objectPosition: detailDestination.imagePosition,
                  // Giu mo cho toi khi ban sao bay xong. Khong dung
                  // `visibility` de trinh duyet van tai anh song song.
                  opacity: flipDone ? 1 : 0,
                }}
              />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(29,41,37,.1),rgba(29,41,37,.78))]" />
              <div className="absolute inset-x-0 bottom-0 p-5 pr-24 text-white sm:p-8 sm:pr-8 lg:p-10">
                <p className="text-[0.7rem] font-extrabold uppercase tracking-[0.2em] text-[#E7B96A] sm:text-xs">{detailDestination.category[lang]} · {detailDestination.duration[lang]}</p>
                <h2 id="destination-detail-title" className="font-display mt-2 max-w-4xl text-3xl leading-tight sm:mt-3 sm:text-6xl lg:text-7xl">{detailDestination.name[lang]}</h2>
                <p className="mt-3 max-w-3xl text-base leading-7 text-white/88 sm:mt-4 sm:text-lg sm:leading-8">{detailDestination.description[lang]}</p>
              </div>
            </div>
            <div className="grid gap-6 p-5 sm:p-8 lg:grid-cols-[0.72fr_1.28fr] lg:p-10">
              <aside className="h-fit rounded-[8px] border border-[#A8CEC1]/70 bg-[#F6F1E7] p-5 lg:sticky lg:top-6">
                <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#3F7568]">{t.bestTimeTitle}</p>
                <p className="mt-2 leading-7 text-[#1D2925]">{detailFacts.bestTime[lang]}</p>
                <div className="mt-5 grid gap-3">
                  {[
                    [t.crowdTitle, detailFacts.crowdTip[lang]],
                    [t.transferTitle, detailFacts.gettingThere[lang]],
                    [t.feeTitle, detailFacts.entranceFee[lang]],
                  ].map(([label, value]) => (
                    <div key={label as string} className="rounded-[8px] bg-white/80 p-3">
                      <p className="text-xs font-extrabold uppercase tracking-[0.15em] text-[#3F7568]">{label}</p>
                      <p className="mt-2 text-sm leading-6 text-[#1D2925]">{value}</p>
                    </div>
                  ))}
                </div>
                {detailFacts.operatorNote ? (
                  <p className="mt-5 rounded-[8px] border border-[#E7B96A]/70 bg-[#FFF8E8] p-4 text-sm font-semibold leading-6 text-[#183F34]">{detailFacts.operatorNote[lang]}</p>
                ) : null}
                <div className="mt-5 flex flex-wrap gap-2">{detailDestination.tags[lang].map((tag) => <span key={tag} className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-[#3F7568]">{tag}</span>)}</div>
                <div className="mt-6 grid gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setDetailId(null);
                      window.setTimeout(() => addDestination(detailDestination.id), 0);
                    }}
                    className="rounded-full bg-[#183F34] px-5 py-3 font-semibold text-white"
                  >
                    {selectedIds.includes(detailDestination.id) ? t.selected : t.add}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDetailId(null);
                      window.setTimeout(() => focusDestination(detailDestination.id), 0);
                    }}
                    className="rounded-full border border-[#A8CEC1] bg-white px-5 py-3 font-semibold text-[#183F34]"
                  >
                    {t.directions}
                  </button>
                  {/* Mỗi điểm đến nay có trang riêng; khung này vẫn là lối xem
                      nhanh ngay trên trang chủ, còn trang riêng là địa chỉ để
                      chia sẻ và để máy tìm kiếm lập chỉ mục. */}
                  <Link
                    href={destinationPageHref(detailDestination.id)}
                    className="rounded-full px-5 py-3 text-center font-semibold text-[#183F34] underline decoration-[#A8CEC1] underline-offset-4 hover:decoration-[#183F34]"
                  >
                    {t.destinationPage}
                  </Link>
                </div>
              </aside>
              <div>
                <div className="grid gap-4 md:grid-cols-2">
                  <section className="rounded-[8px] bg-[#F6F1E7] p-5">
                    <h3 className="text-sm font-extrabold uppercase tracking-[0.18em] text-[#3F7568]">{t.historyTitle}</h3>
                    <p className="mt-3 leading-8 text-[#1D2925]">{detailDestination.history[lang]}</p>
                  </section>
                  <section className="rounded-[8px] border border-[#A8CEC1]/70 bg-white p-5">
                    <h3 className="text-sm font-extrabold uppercase tracking-[0.18em] text-[#3F7568]">{t.significanceTitle}</h3>
                    <p className="mt-3 leading-8 text-[#1D2925]">{detailFacts.significance[lang]}</p>
                  </section>
                </div>
                <section className="mt-6">
                  <h3 className="text-sm font-extrabold uppercase tracking-[0.18em] text-[#3F7568]">{t.highlightsTitle}</h3>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {detailDestination.highlights[lang].map((highlight) => (
                      <span key={highlight} className="rounded-[8px] border border-[#A8CEC1]/70 bg-white px-4 py-3 text-sm font-semibold text-[#183F34]">
                        {highlight}
                      </span>
                    ))}
                  </div>
                </section>
                <section className="mt-6 rounded-[8px] bg-[#F6F1E7] p-5">
                  <h3 className="text-sm font-extrabold uppercase tracking-[0.18em] text-[#3F7568]">{t.practicalTitle}</h3>
                  <ul className="mt-3 grid list-disc gap-2 pl-5">
                    {detailFacts.practical[lang].map((item) => (
                      <li key={item} className="text-sm leading-6 text-[#1D2925]">{item}</li>
                    ))}
                  </ul>
                </section>
                <section className="mt-6">
                  <h3 className="text-sm font-extrabold uppercase tracking-[0.18em] text-[#3F7568]">{t.pairWithTitle}</h3>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {detailFacts.pairWith.map((id) => {
                      const pair = destinations.find((destination) => destination.id === id);
                      if (!pair) return null;
                      return (
                        <button key={id} type="button" onClick={() => openDetail(id)} className="rounded-full border border-[#A8CEC1] bg-white px-4 py-2 text-sm font-semibold text-[#183F34] transition hover:bg-[#F6F1E7]">
                          {pair.name[lang]}
                        </button>
                      );
                    })}
                  </div>
                </section>
              </div>
            </div>
          </article>
        </div>
      ) : null}

      {/*
        Ban sao bay. Nam TREN khung chi tiet (z 1300 > 1200) va khong bat
        chuot, nen no chi la mot lop hinh anh thuan tuy -- bam xuyen qua
        van dong duoc khung chi tiet nhu binh thuong.
        Chi ton tai trong ~0,56 giay giua luc bam va luc anh that hien ra.
      */}
      {flipStart && !flipDone ? (
        <div
          ref={flipCloneRef}
          aria-hidden="true"
          className="pointer-events-none fixed z-[1300] overflow-hidden"
          style={{
            top: flipStart.rect.top,
            left: flipStart.rect.left,
            width: flipStart.rect.width,
            height: flipStart.rect.height,
            borderRadius: flipStart.borderRadius,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={flipStart.src}
            alt=""
            className="h-full w-full object-cover"
            style={{ objectPosition: flipStart.objectPosition }}
          />
        </div>
      ) : null}

      {checkoutOpen ? (
        <div
          className="fixed inset-0 z-[1200] grid place-items-center bg-[#1D2925]/82 px-5 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
          aria-labelledby="checkout-title"
          onMouseDown={() => setCheckoutOpen(false)}
        >
          <div className="w-full max-w-lg rounded-[8px] bg-[#FBFAF6] p-6 shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.22em] text-[#3F7568]">{t.paymentOptions}</p>
                <h2 id="checkout-title" className="font-display mt-2 text-4xl text-[#183F34]">{t.checkoutTitle}</h2>
              </div>
              <button type="button" onClick={() => setCheckoutOpen(false)} className="rounded-full border border-[#A8CEC1] px-3 py-1.5 text-sm text-[#183F34]">{t.close}</button>
            </div>
            <p className="mt-4 leading-7 text-[#6D756F]">{t.checkoutIntro}</p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              {[t.guests, t.transport, t.meal, t.contact].map((step) => <div key={step as string} className="rounded-[8px] border border-[#A8CEC1]/70 bg-white p-3 text-sm text-[#1D2925]">{step}</div>)}
            </div>
            <div className="mt-5 rounded-[8px] border border-[#A8CEC1]/70 bg-white p-4">
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#3F7568]">{t.paymentOptions}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {(lang === "en" ? paymentMethods : paymentMethodsVi).map((method) => <span key={method} className="rounded-full bg-[#F6F1E7] px-3 py-1 text-sm text-[#183F34]">{method}</span>)}
              </div>
            </div>
            <button type="button" onClick={() => setCheckoutOpen(false)} className="mt-5 w-full rounded-full bg-[#183F34] px-5 py-3 font-semibold text-white">{t.confirm}</button>
          </div>
        </div>
      ) : null}
    </main>
  );
}
