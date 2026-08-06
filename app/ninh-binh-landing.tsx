"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Reveal } from "@/components/shared/reveal";
import { RevealHeading } from "@/components/shared/reveal-heading";
import { findFlipStart, type FlipStart } from "@/components/shared/flip-image";
import { useNinhBinhHour, type DayBand } from "@/components/shared/ninh-binh-hour";
import { PinnedStory, type PinnedStoryBeat } from "@/components/discovery/pinned-story";
import { DestinationZigzag } from "@/components/discovery/destination-zigzag";
import { DestinationIndex } from "@/components/discovery/destination-index";
import { JourneyCta } from "@/components/discovery/journey-cta";
import { CinematicVideo, type CinematicClip } from "@/components/shared/cinematic-video";

export type Language = "en" | "vi";
export type DestinationId =
  | "trang_an"
  | "bai_dinh"
  | "tam_chuc"
  | "hoa_lu_old_town"
  | "tam_coc"
  | "hang_mua"
  | "hoa_lu_ancient_capital"
  | "cuc_phuong"
  | "phat_diem"
  | "thung_nham"
  | "van_long"
  | "am_tien"
  | "bich_dong"
  | "thai_vi"
  | "bear_sanctuary";

type Localized = Record<Language, string>;

export type Destination = {
  id: DestinationId;
  tier: "signature" | "hidden";
  sourceKeys: string[];
  name: Localized;
  image: string;
  position: [number, number];
  coords: string;
  category: Localized;
  duration: Localized;
  tagline: Localized;
  shortDescription: Localized;
  description: Localized;
  history: Localized;
  highlights: Record<Language, string[]>;
  tags: Record<Language, string[]>;
  imagePosition: string;
};

type DestinationFacts = {
  significance: Localized;
  bestTime: Localized;
  crowdTip: Localized;
  gettingThere: Localized;
  entranceFee: Localized;
  practical: Record<Language, string[]>;
  pairWith: DestinationId[];
  operatorNote?: Localized;
};

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
  clientDemo: boolean;
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
    nav: ["Map", "Destinations", "Builder", "Journey"],
    introTop: "Ninh Binh",
    introWords: ["Nature.", "Heritage.", "Wonder."],
    title: "Ninh Binh",
    subtitle: "A journey between mountains, water and timeless heritage",
    footerNote: "Ninh Binh Journey · A journey between mountains, water and timeless heritage.",
    begin: "Plan my journey",
    exploreMap: "Explore map",
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
    hiddenGems: "The quiet corners few people know",
    hiddenGemsIntro:
      "Vân Long wetland, Am Tiên cave, Bích Động pagoda, Thái Vi temple. Quieter, and mostly missed by anyone giving Ninh Bình two days.",
    seeAllDestinations: "See all destinations",
    /*
     * `zigzag*` gio chi con dung cho VAI DIEM DAU (xem `ZIGZAG_FEATURED`).
     * `index*` la khoi danh sach cho phan con lai. Khong bia con so nao o
     * day -- khong co du lieu that ve so ngay khach o lai.
     */
    indexLabel: "The rest of the map",
    indexTitle: "Ten more, and few people get to all of them.",
    indexIntro:
      "These are the ones that get cut first when the trip is short. Which is also why they are still quiet.",
    indexHint: "Hover a name to see it.",
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
      "Reserving through the website takes 10% off the counter price, paid by QR code right in your browser.",
    zigzagCtaOfferPlain:
      "Describe what you have in mind in ordinary words; we will build the itinerary from there.",
    companionLabel: "Journey Builder",
    companionTitle: "Build a route that feels human",
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
    checkoutTitle: "Simulated checkout",
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
    nav: ["Bản đồ", "Điểm đến", "Lập tuyến", "Lịch trình"],
    introTop: "Ninh Bình",
    introWords: ["Thiên nhiên.", "Di sản.", "Kỳ quan."],
    title: "Ninh Bình",
    subtitle: "Hành trình giữa núi, nước và di sản vượt thời gian",
    footerNote: "Ninh Bình Journey · Hành trình giữa núi, nước và di sản vượt thời gian.",
    begin: "Lập hành trình",
    exploreMap: "Khám phá bản đồ",
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
    hiddenGems: "Những góc lặng ít người biết",
    hiddenGemsIntro:
      "Đầm Vân Long, động Am Tiên, chùa Bích Động, đền Thái Vi. Vắng hơn, và phần lớn khách đi Ninh Bình hai ngày sẽ không kịp tới.",
    seeAllDestinations: "Xem tất cả điểm đến",
    indexLabel: "Phần còn lại của bản đồ",
    indexTitle: "Mười nơi nữa, ít ai kịp đi hết.",
    indexIntro:
      "Đây là những chỗ bị gạch đầu tiên khi lịch trình ngắn lại. Cũng chính vì thế mà chúng còn vắng.",
    indexHint: "Rê chuột lên một cái tên để xem trước.",
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
      "Đặt qua website giảm 10% so với giá tại quầy, thanh toán bằng mã QR ngay trên trình duyệt.",
    zigzagCtaOfferPlain:
      "Bạn cứ nói mình muốn đi kiểu gì; chúng tôi dựng lịch trình từ đó.",
    companionLabel: "Bộ lập tuyến hành trình",
    companionTitle: "Dựng một tuyến đi có nhịp người thật",
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
    checkoutTitle: "Thanh toán mô phỏng",
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
 * Ba bang video dien anh chay nen. Video do chu du an chon.
 *
 * Video Qe1LqAOY9C0 da bi BO vi co watermark cua tac gia dong tren
 * khung hinh: de nguyen thi vuong mat, ma cat di thi thanh xoa dau ten
 * nguoi quay. Ba video con lai nhung nguyen ban qua youtube-nocookie,
 * giu nguyen credit va luot xem cho tac gia.
 *
 * Bat dau tu giay 12 (bo doan dau chua vao hinh), moi doan 17-18 giay
 * roi lap lai -- dung yeu cau cua chu du an.
 *
 * Khi nao co file mp4 tu-host co giay phep thi doi `youTubeId` thanh
 * `src`; component da ho tro san va che do do nhe hon han vi khong phai
 * nhung ca mot trinh phat.
 */
/*
 * `poster` chon tu ba tam CHUA DUNG O DAU tren trang chu (`tam-coc.jpg`,
 * `hero-ninh-binh.png`, `bai-dinh.jpg`) -- co y, de khung tinh khong lap
 * lai bat ky anh nao khach vua nhin thay. Dung `trang-an.jpg` o day la
 * tai pham dung loi da bi che mot lan: khoi moi hien ra lai la tam anh
 * vua xem, nhin nhu loi lap khoi chu khong phai mot canh moi.
 */
const cinematicClips: Record<Language, CinematicClip[]> = {
  vi: [
    {
      youTubeId: "OA4lO9rrk4Q",
      start: 12,
      end: 30,
      poster: "/images/destinations/tam-coc.jpg",
      eyebrow: "Tuyến 1 · Tràng An",
      headline: "Hang Tối dài ba trăm hai mươi mét. Thuyền phải đi hết chừng ấy trong bóng.",
    },
    {
      youTubeId: "0NHfpdPHFE4",
      start: 12,
      end: 29,
      poster: "/hero-ninh-binh.png",
      eyebrow: "Sông Ngô Đồng · Tam Cốc",
      headline: "Sông Ngô Đồng không vòng qua núi. Nó khoét thẳng, thành ba cái hang.",
    },
    {
      youTubeId: "ZDCPQDr4YHE",
      start: 12,
      end: 30,
      poster: "/images/destinations/bai-dinh.jpg",
      eyebrow: "Cố đô Hoa Lư · 968–1010",
      headline: "Ba trăm hecta, hai vòng thành, sáu vị vua. Rồi triều Lý dời đô, và Hoa Lư ở lại với núi.",
    },
  ],
  en: [
    {
      youTubeId: "OA4lO9rrk4Q",
      start: 12,
      end: 30,
      poster: "/images/destinations/tam-coc.jpg",
      eyebrow: "Route 1 · Tràng An",
      headline: "Hang Tối is 320 metres long. The boat goes through all of it in the dark.",
    },
    {
      youTubeId: "0NHfpdPHFE4",
      start: 12,
      end: 29,
      poster: "/hero-ninh-binh.png",
      eyebrow: "The Ngô Đồng river · Tam Cốc",
      headline: "The Ngô Đồng did not go around the mountain. It cut straight through, into three caves.",
    },
    {
      youTubeId: "ZDCPQDr4YHE",
      start: 12,
      end: 30,
      poster: "/images/destinations/bai-dinh.jpg",
      eyebrow: "Hoa Lư, the old capital · 968–1010",
      headline: "Three hundred hectares, two rings of wall, six kings. Then the Lý court left, and Hoa Lư stayed with the mountains.",
    },
  ],
};

const storyBeats: Record<Language, PinnedStoryBeat[]> = {
  en: [
    {
      image: "/images/destinations/van-long.png",
      alt: "A bamboo boat crossing the still water of Van Long wetland",
      eyebrow: "Ramsar site · IUCN Green List",
      headline: "Fewer than 300 Delacour's langurs are left on earth. Most of them live here.",
      body: "This is the only wetland reserve in Vietnam on the IUCN Green List. The boats run without engines and the rowers keep their voices down. Some mornings the langurs come right down to the water; some mornings you sit the whole way and see none.",
    },
    {
      image: "/images/destinations/cuc-phuong.png",
      alt: "Ancient forest canopy in Cuc Phuong National Park",
      eyebrow: "Established 1962",
      headline: "Before Vietnam had a second national park, there was Cuc Phuong.",
      body: "Old-growth forest, trees that stood here before there was a road in, and primate rescue programmes still running today. Step through the gate and the whole region changes register: cooler, slower, a deeper green.",
    },
    {
      image: "/images/destinations/phat-diem.png",
      alt: "Stone and timber architecture at Phat Diem Cathedral",
      eyebrow: "Phát Diệm stone cathedral · 1875–1899",
      headline: "A Catholic cathedral, built to the shape of a Vietnamese village communal house.",
      body: "Father Phêrô Trần Lục spent twenty-four years raising this twenty-two-hectare complex, finishing in 1899. The Phương Đình that stands at its centre is 21 metres across, 17 deep and 25 high — a bell tower carrying the exact silhouette of a village đình, and made of stone and timber rather than concrete.",
    },
  ],
  vi: [
    {
      image: "/images/destinations/van-long.png",
      alt: "Thuyền nan lướt qua mặt nước tĩnh lặng ở Vân Long",
      eyebrow: "Khu Ramsar · Danh sách Xanh IUCN",
      headline: "Cả thế giới còn chưa tới 300 con voọc mông trắng. Phần lớn sống ở đây.",
      body: "Đây là khu đất ngập nước duy nhất của Việt Nam có tên trong Danh sách Xanh IUCN. Thuyền không nổ máy, người chèo cũng không nói to. Có buổi voọc xuống tận mép nước, có buổi ngồi hết chuyến chẳng thấy con nào.",
    },
    {
      image: "/images/destinations/cuc-phuong.png",
      alt: "Tán rừng già trong Vườn quốc gia Cúc Phương",
      eyebrow: "Thành lập năm 1962",
      headline: "Trước khi Việt Nam có vườn quốc gia thứ hai, đã có Cúc Phương.",
      body: "Rừng già, những cây đứng đây từ trước khi có đường vào, và các chương trình cứu hộ linh trưởng vẫn chạy tới hôm nay. Bước qua cổng vườn là cả vùng đổi giọng: mát hơn, chậm hơn, xanh sẫm hơn hẳn.",
    },
    {
      image: "/images/destinations/phat-diem.png",
      alt: "Kiến trúc đá và gỗ tại Nhà thờ đá Phát Diệm",
      eyebrow: "Nhà thờ đá Phát Diệm · 1875–1899",
      headline: "Một nhà thờ Công giáo, dựng theo đúng dáng đình làng Việt.",
      body: "Linh mục Phêrô Trần Lục mất hai mươi tư năm dựng quần thể hai mươi hai hecta này, tới năm 1899 mới xong. Phương Đình đứng giữa rộng 21 mét, sâu 17, cao 25 — một tháp chuông mang nguyên dáng đình làng, và làm bằng đá với gỗ chứ không phải bê tông.",
    },
  ],
};

const destinations: Destination[] = [
  {
    id: "trang_an",
    tier: "signature",
    sourceKeys: ["trang_an", "trang_an_boat_station"],
    name: { en: "Trang An", vi: "Tràng An" },
    image: "/images/destinations/trang-an.jpg",
    position: [20.2503, 105.897],
    coords: "20.2503 N, 105.8970 E",
    category: { en: "Heritage water route", vi: "Tuyến nước di sản" },
    duration: { en: "3-4 hours", vi: "3-4 giờ" },
    tagline: {
      en: "Where limestone mountains meet quiet water",
      vi: "Nơi núi đá vôi gặp mặt nước tĩnh lặng",
    },
    shortDescription: {
      en: "A slow boat journey through caves, valleys and temple silhouettes.",
      vi: "Chuyến thuyền chậm qua hang nước, thung lũng và bóng đền cổ.",
    },
    description: {
      en: "Trang An is the emotional opening of Ninh Binh: water, limestone, rowing boats and a sense that the landscape is unfolding one bend at a time.",
      vi: "Tràng An là phần mở đầu giàu cảm xúc của Ninh Bình: nước, núi đá vôi, thuyền chèo và cảm giác cảnh quan mở ra qua từng khúc quanh.",
    },
    history: {
      en: "Trang An is part of the UNESCO-recognized landscape complex, where traces of settlement, temples and limestone caves sit inside a rare water-and-karst setting.",
      vi: "Tràng An thuộc quần thể danh thắng được UNESCO ghi danh, nơi dấu tích cư trú, đền cổ và hang động đá vôi nằm trong một cảnh quan nước - núi hiếm có.",
    },
    highlights: {
      en: ["Boat routes through caves", "Limestone valleys", "Water temples", "Quiet morning reflections"],
      vi: ["Tuyến thuyền xuyên hang", "Thung lũng đá vôi", "Đền bên mặt nước", "Mặt nước buổi sớm"],
    },
    tags: { en: ["Nature", "Heritage", "Boat"], vi: ["Thiên nhiên", "Di sản", "Thuyền"] },
    imagePosition: "50% 50%",
  },
  {
    id: "bai_dinh",
    tier: "signature",
    sourceKeys: ["bai_dinh", "bai_dinh_main_gate"],
    name: { en: "Bai Dinh", vi: "Bái Đính" },
    image: "/images/destinations/editorial/bai-dinh-editorial.png",
    position: [20.2768, 105.8656],
    coords: "20.2768 N, 105.8656 E",
    category: { en: "Spiritual landmark", vi: "Điểm tâm linh" },
    duration: { en: "2-3 hours", vi: "2-3 giờ" },
    tagline: {
      en: "Bells, stone corridors and hillside air",
      vi: "Chuông, hành lang đá và gió núi",
    },
    shortDescription: {
      en: "Grand courtyards and temple corridors with a quiet sense of scale.",
      vi: "Sân rộng và hành lang chùa với cảm giác không gian khoáng đạt.",
    },
    description: {
      en: "Bai Dinh gives the day a spacious spiritual rhythm, balancing grand architecture with slow movement and open views.",
      vi: "Bái Đính đem lại nhịp tâm linh rộng mở, cân bằng giữa kiến trúc quy mô, bước đi chậm và các tầm nhìn thoáng.",
    },
    history: {
      en: "The area combines older sacred sites with a large contemporary pagoda complex, making it one of the most recognizable spiritual landmarks in northern Vietnam.",
      vi: "Khu vực này kết hợp các dấu tích tâm linh cổ với quần thể chùa quy mô lớn hiện nay, trở thành một điểm nhận diện nổi bật của du lịch tâm linh miền Bắc.",
    },
    highlights: {
      en: ["Bell tower", "Long arhat corridors", "Temple courtyards", "Hillside viewpoints"],
      vi: ["Tháp chuông", "Hành lang La Hán", "Sân chùa rộng", "Điểm nhìn trên sườn núi"],
    },
    tags: { en: ["Spiritual", "Culture", "Family"], vi: ["Tâm linh", "Văn hóa", "Gia đình"] },
    imagePosition: "50% 50%",
  },
  {
    id: "tam_chuc",
    tier: "signature",
    sourceKeys: ["tam_chuc", "tam_chuc_boat_station"],
    name: { en: "Tam Chuc", vi: "Tam Chúc" },
    image: "/images/destinations/tam-chuc.jpg",
    position: [20.5736, 105.9133],
    coords: "20.5736 N, 105.9133 E",
    category: { en: "Lake temple landscape", vi: "Cảnh quan hồ và chùa" },
    duration: { en: "Half day", vi: "Nửa ngày" },
    tagline: {
      en: "Lake light and temple roofs in a softer northern breeze",
      vi: "Ánh hồ và mái chùa trong làn gió bắc dịu nhẹ",
    },
    shortDescription: {
      en: "A contemplative lake-and-temple stop for a slower journey.",
      vi: "Điểm dừng hồ và chùa cho một hành trình chậm hơn.",
    },
    description: {
      en: "Tam Chuc stretches the route north with water, scale and a calm pace for visitors who enjoy contemplative landscapes.",
      vi: "Tam Chúc mở rộng hành trình về phía bắc bằng mặt nước, quy mô và nhịp tĩnh dành cho du khách thích cảnh quan trầm lắng.",
    },
    history: {
      en: "Tam Chuc sits in a broad lake basin connected to a revived Buddhist landscape, now an important spiritual and scenic stop in the expanded regional route.",
      vi: "Tam Chúc nằm trong lòng hồ rộng gắn với không gian Phật giáo được phục dựng, hiện là điểm dừng tâm linh và cảnh quan quan trọng trong tuyến vùng mở rộng.",
    },
    highlights: {
      en: ["Lake approach", "Temple roofs", "Mountain backdrop", "Wide ceremonial spaces"],
      vi: ["Tuyến hồ", "Mái chùa", "Nền núi phía sau", "Không gian nghi lễ rộng"],
    },
    tags: { en: ["Lake", "Spiritual", "Calm"], vi: ["Mặt hồ", "Tâm linh", "Tĩnh lặng"] },
    imagePosition: "50% 50%",
  },
  {
    id: "hoa_lu_old_town",
    tier: "signature",
    sourceKeys: ["hoa_lu_old_town"],
    name: { en: "Hoa Lu Old Town", vi: "Phố cổ Hoa Lư" },
    image: "/images/destinations/hoa-lu-old-town.jpg",
    position: [20.2579, 105.9741],
    coords: "20.2579 N, 105.9741 E",
    category: { en: "Evening street", vi: "Phố đêm" },
    duration: { en: "1-2 hours", vi: "1-2 giờ" },
    tagline: {
      en: "Lantern reflections after a day on the water",
      vi: "Ánh đèn lồng sau một ngày theo dòng nước",
    },
    shortDescription: {
      en: "A warm evening chapter with lanterns, food and gentle walking.",
      vi: "Một chương buổi tối ấm áp với đèn lồng, ẩm thực và dạo bộ.",
    },
    description: {
      en: "Hoa Lu Old Town closes the day softly: lanterns, small boats, food and reflections that make the route feel complete.",
      vi: "Phố cổ Hoa Lư khép lại ngày thật nhẹ: đèn lồng, thuyền nhỏ, ẩm thực và những phản chiếu làm hành trình trọn vẹn hơn.",
    },
    history: {
      en: "The old-town experience is a contemporary cultural evening space inspired by regional architecture, lantern streets and waterside life.",
      vi: "Không gian phố cổ là điểm trải nghiệm văn hóa buổi tối hiện đại, lấy cảm hứng từ kiến trúc vùng, phố đèn lồng và đời sống ven nước.",
    },
    highlights: {
      en: ["Lantern boats", "Evening food stops", "Walking streets", "Water reflections"],
      vi: ["Thuyền đèn lồng", "Điểm ăn tối", "Phố đi bộ", "Ánh phản chiếu trên nước"],
    },
    tags: { en: ["Evening", "Food", "Family"], vi: ["Buổi tối", "Ẩm thực", "Gia đình"] },
    imagePosition: "50% 55%",
  },
  {
    id: "tam_coc",
    tier: "signature",
    sourceKeys: ["tam_coc"],
    name: { en: "Tam Coc", vi: "Tam Cốc" },
    image: "/images/destinations/editorial/tam-coc-editorial.png",
    position: [20.2169, 105.9368],
    coords: "20.2169 N, 105.9368 E",
    category: { en: "Countryside river route", vi: "Tuyến sông làng quê" },
    duration: { en: "2-3 hours", vi: "2-3 giờ" },
    tagline: {
      en: "Rice fields, river bends and rural limestone views",
      vi: "Đồng lúa, khúc sông và núi đá vôi làng quê",
    },
    shortDescription: {
      en: "A countryside river route close to daily life.",
      vi: "Tuyến sông làng quê gần nhịp sống thường ngày.",
    },
    description: {
      en: "Tam Coc is softer and more rural, pairing water routes with rice fields and the everyday texture of Ninh Binh.",
      vi: "Tam Cốc dịu và thôn quê hơn, kết hợp tuyến nước với đồng lúa và chất đời thường của Ninh Bình.",
    },
    history: {
      en: "Tam Coc has long been known for boat routes through three caves and seasonal rice-field views framed by limestone mountains.",
      vi: "Tam Cốc được biết đến lâu đời với tuyến thuyền qua ba hang và cảnh đồng lúa theo mùa nằm giữa khung núi đá vôi.",
    },
    highlights: {
      en: ["Three cave route", "Rice-field views", "Village edges", "Boat photography"],
      vi: ["Tuyến ba hang", "Cảnh đồng lúa", "Rìa làng quê", "Góc chụp thuyền"],
    },
    tags: { en: ["Countryside", "Boat", "Nature"], vi: ["Làng quê", "Thuyền", "Thiên nhiên"] },
    imagePosition: "50% 50%",
  },
  {
    id: "hang_mua",
    tier: "signature",
    sourceKeys: ["hang_mua"],
    name: { en: "Hang Mua", vi: "Hang Múa" },
    image: "/images/destinations/hang-mua.png",
    position: [20.229, 105.936],
    coords: "20.2290 N, 105.9360 E",
    category: { en: "Viewpoint", vi: "Điểm ngắm cảnh" },
    duration: { en: "2 hours", vi: "2 giờ" },
    tagline: {
      en: "A climb toward the wide green geometry of Ninh Binh",
      vi: "Một cung leo lên hình khối xanh rộng mở của Ninh Bình",
    },
    shortDescription: {
      en: "A dramatic viewpoint for active travelers.",
      vi: "Điểm ngắm cảnh ấn tượng cho du khách thích vận động.",
    },
    description: {
      en: "Hang Mua gives the journey altitude, with limestone ridges, river lines and a view that makes the region legible at once.",
      vi: "Hang Múa đem lại độ cao cho hành trình, với sống núi đá vôi, đường sông và góc nhìn giúp đọc được toàn vùng trong một khoảnh khắc.",
    },
    history: {
      en: "The viewpoint is known for its stone stair climb and dragon ridge, offering one of the clearest panoramas over Tam Coc and nearby limestone valleys.",
      vi: "Điểm ngắm cảnh nổi tiếng với lối bậc đá và sống núi rồng, mở ra một trong những góc nhìn rõ nhất xuống Tam Cốc và các thung lũng đá vôi gần kề.",
    },
    highlights: {
      en: ["Dragon stair ridge", "River panorama", "Sunset viewpoint", "Active climb"],
      vi: ["Sống núi rồng", "Toàn cảnh dòng sông", "Điểm ngắm hoàng hôn", "Cung leo vận động"],
    },
    tags: { en: ["Viewpoint", "Adventure", "Sunset"], vi: ["Ngắm cảnh", "Khám phá", "Hoàng hôn"] },
    imagePosition: "50% 50%",
  },
  {
    id: "hoa_lu_ancient_capital",
    tier: "signature",
    sourceKeys: ["hoa_lu_ancient_capital", "co_do_hoa_lu"],
    name: { en: "Hoa Lu Ancient Capital", vi: "Cố đô Hoa Lư" },
    image: "/images/destinations/hoa-lu-ancient-capital.png",
    position: [20.2833, 105.9066],
    coords: "20.2833 N, 105.9066 E",
    category: { en: "Ancient capital", vi: "Cố đô" },
    duration: { en: "1-2 hours", vi: "1-2 giờ" },
    tagline: {
      en: "A historic pause between mountains and dynasties",
      vi: "Một khoảng dừng lịch sử giữa núi và các triều đại",
    },
    shortDescription: {
      en: "Temples and heritage traces from Vietnam's early capital.",
      vi: "Đền thờ và dấu tích di sản của kinh đô xưa.",
    },
    description: {
      en: "Hoa Lu Ancient Capital adds historical depth, grounding the natural drama of Ninh Binh in stories of kings, gates and stone.",
      vi: "Cố đô Hoa Lư thêm chiều sâu lịch sử, đặt vẻ hùng vĩ của Ninh Bình vào câu chuyện vua chúa, cổng thành và đá núi.",
    },
    history: {
      en: "Hoa Lu was Vietnam's capital in the 10th and 11th centuries under the Dinh and early Le dynasties, protected by limestone terrain and river routes.",
      vi: "Hoa Lư từng là kinh đô của Việt Nam vào thế kỷ X-XI dưới thời Đinh và Tiền Lê, được bảo vệ bởi địa thế núi đá vôi và các tuyến sông.",
    },
    highlights: {
      en: ["Dinh King Temple", "Le King Temple", "Ancient gates", "Limestone defensive landscape"],
      vi: ["Đền vua Đinh", "Đền vua Lê", "Cổng cổ", "Địa thế phòng thủ núi đá"],
    },
    tags: { en: ["History", "Culture", "Heritage"], vi: ["Lịch sử", "Văn hóa", "Di sản"] },
    imagePosition: "50% 50%",
  },
  {
    id: "cuc_phuong",
    tier: "signature",
    sourceKeys: ["cuc_phuong"],
    name: { en: "Cuc Phuong", vi: "Cúc Phương" },
    image: "/images/destinations/cuc-phuong.png",
    position: [20.35, 105.6],
    coords: "20.3500 N, 105.6000 E",
    category: { en: "National park", vi: "Vườn quốc gia" },
    duration: { en: "Half day", vi: "Nửa ngày" },
    tagline: {
      en: "Forest shade at the western edge of the journey",
      vi: "Bóng rừng ở rìa tây của hành trình",
    },
    shortDescription: {
      en: "A forest escape for nature-focused visitors.",
      vi: "Một khoảng rừng dành cho du khách yêu thiên nhiên.",
    },
    description: {
      en: "Cuc Phuong brings forest, biodiversity and a cooler rhythm into the Ninh Binh journey.",
      vi: "Cúc Phương đưa rừng, đa dạng sinh học và một nhịp mát lành hơn vào hành trình Ninh Bình.",
    },
    history: {
      en: "Cuc Phuong is Vietnam's first national park, valued for ancient forest, conservation work and a very different ecological layer of the region.",
      vi: "Cúc Phương là vườn quốc gia đầu tiên của Việt Nam, nổi bật bởi rừng già, công tác bảo tồn và một lớp sinh thái rất khác của vùng.",
    },
    highlights: {
      en: ["Ancient trees", "Forest trails", "Primate conservation", "Seasonal butterflies"],
      vi: ["Cây cổ thụ", "Đường mòn trong rừng", "Bảo tồn linh trưởng", "Mùa bướm"],
    },
    tags: { en: ["Forest", "Nature", "Family"], vi: ["Rừng", "Thiên nhiên", "Gia đình"] },
    imagePosition: "50% 50%",
  },
  {
    id: "phat_diem",
    tier: "signature",
    sourceKeys: ["phat_diem", "nha_tho_phat_diem"],
    name: { en: "Phat Diem Cathedral", vi: "Nhà thờ Phát Diệm" },
    image: "/images/destinations/phat-diem.png",
    position: [20.091, 106.083],
    coords: "20.0910 N, 106.0830 E",
    category: { en: "Architectural heritage", vi: "Di sản kiến trúc" },
    duration: { en: "1-2 hours", vi: "1-2 giờ" },
    tagline: {
      en: "Stone, timber and a rare meeting of architectural traditions",
      vi: "Đá, gỗ và cuộc gặp hiếm giữa các truyền thống kiến trúc",
    },
    shortDescription: {
      en: "A distinctive cathedral complex in the expanded region.",
      vi: "Quần thể nhà thờ đặc sắc trong vùng Ninh Bình mở rộng.",
    },
    description: {
      en: "Phat Diem expands the story beyond karsts, adding coastal-delta craft and a memorable architectural voice.",
      vi: "Phát Diệm mở rộng câu chuyện vượt khỏi núi đá, thêm dấu ấn thủ công vùng đồng bằng ven biển và một giọng kiến trúc khó quên.",
    },
    history: {
      en: "Phat Diem Cathedral complex was built with a distinctive blend of Vietnamese timber-roof forms and Catholic stone architecture, creating a rare regional landmark.",
      vi: "Quần thể Nhà thờ Phát Diệm được xây dựng với sự hòa trộn đặc sắc giữa mái gỗ Việt Nam và kiến trúc đá Công giáo, tạo nên một dấu mốc hiếm có của vùng.",
    },
    highlights: {
      en: ["Stone cathedral", "Timber roof forms", "Pond courtyard", "Bell house"],
      vi: ["Nhà thờ đá", "Mái gỗ truyền thống", "Sân hồ", "Phương đình"],
    },
    tags: { en: ["Architecture", "Culture", "Heritage"], vi: ["Kiến trúc", "Văn hóa", "Di sản"] },
    imagePosition: "50% 50%",
  },
  {
    id: "thung_nham",
    tier: "hidden",
    sourceKeys: ["thung_nham", "thung_nham_bird_park"],
    name: { en: "Thung Nham Bird Park", vi: "Vườn chim Thung Nham" },
    image: "/images/destinations/thung-nham.png",
    position: [20.2157, 105.9049],
    coords: "20.2157 N, 105.9049 E",
    category: { en: "Wetland bird valley", vi: "Thung lũng chim nước" },
    duration: { en: "2-3 hours", vi: "2-3 giờ" },
    tagline: {
      en: "The quiet hour when birds return to limestone valleys",
      vi: "Khoảnh khắc đàn chim bay về giữa thung lũng đá vôi",
    },
    shortDescription: {
      en: "A quieter nature stop best timed for late afternoon.",
      vi: "Một điểm thiên nhiên yên hơn, đẹp nhất vào cuối chiều.",
    },
    description: {
      en: "Thung Nham is the softer western branch of the route: water, reeds, karsts and the evening movement of birds returning home.",
      vi: "Thung Nham là nhánh phía tây dịu hơn của hành trình: nước, lau sậy, núi đá và chuyển động buổi chiều của đàn chim bay về tổ.",
    },
    history: {
      en: "The valley is known for wetlands and bird habitat inside the Tam Coc-Bich Dong landscape, giving visitors a slower ecological layer after the busy boat routes.",
      vi: "Thung lũng nổi bật bởi vùng nước và nơi cư trú của chim trong cảnh quan Tam Cốc - Bích Động, tạo thêm một lớp sinh thái chậm rãi sau các tuyến thuyền đông khách.",
    },
    highlights: {
      en: ["Bird garden at dusk", "Wetland boat views", "Limestone valley", "Quiet photography"],
      vi: ["Vườn chim lúc chạng vạng", "Cảnh nước bằng thuyền", "Thung lũng đá vôi", "Góc chụp yên tĩnh"],
    },
    tags: { en: ["Nature", "Birdlife", "Sunset"], vi: ["Thiên nhiên", "Chim nước", "Hoàng hôn"] },
    imagePosition: "50% 50%",
  },
  {
    id: "van_long",
    tier: "hidden",
    sourceKeys: ["van_long", "van_long_nature_reserve"],
    name: { en: "Van Long Nature Reserve", vi: "Đầm Vân Long" },
    image: "/images/destinations/van-long.png",
    position: [20.3642, 105.8623],
    coords: "20.3642 N, 105.8623 E",
    category: { en: "Wetland reserve", vi: "Khu bảo tồn ngập nước" },
    duration: { en: "2 hours", vi: "2 giờ" },
    tagline: {
      en: "Still water, limestone reflections and fewer voices",
      vi: "Mặt nước tĩnh, bóng núi đá và ít tiếng ồn hơn",
    },
    shortDescription: {
      en: "A calm wetland route for travelers avoiding the busiest loops.",
      vi: "Tuyến đầm tĩnh dành cho người muốn tránh các vòng đông nhất.",
    },
    description: {
      en: "Van Long feels almost horizontal compared with Trang An: shallow wetlands, mirrored limestone and a gentler rhythm for people who like silence.",
      vi: "Vân Long có cảm giác phẳng và lặng hơn Tràng An: đầm nước nông, bóng núi soi xuống mặt nước và nhịp đi êm cho người thích sự yên tĩnh.",
    },
    history: {
      en: "The reserve protects an important wetland and limestone ecosystem north of the central tourism cluster, often appreciated for its understated scenery.",
      vi: "Khu bảo tồn gìn giữ hệ sinh thái đất ngập nước và núi đá phía bắc cụm du lịch trung tâm, được yêu thích bởi vẻ đẹp ít phô trương.",
    },
    highlights: {
      en: ["Mirror-like water", "Quiet sampan route", "Karst reflections", "Wildlife habitat"],
      vi: ["Mặt nước như gương", "Tuyến thuyền yên", "Bóng núi đá", "Sinh cảnh tự nhiên"],
    },
    tags: { en: ["Nature", "Wetland", "Quiet"], vi: ["Thiên nhiên", "Đầm nước", "Yên tĩnh"] },
    imagePosition: "50% 50%",
  },
  {
    id: "am_tien",
    tier: "hidden",
    sourceKeys: ["am_tien", "am_tien_cave", "tuyet_tinh_coc"],
    name: { en: "Am Tien Cave", vi: "Động Am Tiên" },
    image: "/images/destinations/am-tien.png",
    position: [20.2869, 105.9185],
    coords: "20.2869 N, 105.9185 E",
    category: { en: "Mountain lake heritage", vi: "Di tích hồ núi" },
    duration: { en: "1-2 hours", vi: "1-2 giờ" },
    tagline: {
      en: "A walled mountain lake with a darker royal past",
      vi: "Một hồ núi khép kín với lớp lịch sử trầm hơn",
    },
    shortDescription: {
      en: "A secluded stop near Hoa Lu for history and atmosphere.",
      vi: "Một điểm khép kín gần Hoa Lư, hợp với lịch sử và không khí tĩnh.",
    },
    description: {
      en: "Am Tien adds a slightly mysterious pause: stone paths, enclosed water and a place that feels separate from the busier heritage route.",
      vi: "Am Tiên thêm một khoảng dừng hơi bí ẩn: lối đá, mặt nước khép kín và cảm giác tách khỏi tuyến di sản đông hơn.",
    },
    history: {
      en: "The site is tied to stories from the Dinh dynasty period and later became known for its enclosed mountain-lake setting close to Hoa Lu.",
      vi: "Điểm này gắn với các câu chuyện thời Đinh và về sau được biết đến bởi không gian hồ núi khép kín gần Cố đô Hoa Lư.",
    },
    highlights: {
      en: ["Enclosed lake", "Stone gate", "Cave approach", "Hoa Lu side trip"],
      vi: ["Hồ khép kín", "Cổng đá", "Lối vào động", "Điểm ghép với Hoa Lư"],
    },
    tags: { en: ["History", "Lake", "Quiet"], vi: ["Lịch sử", "Hồ núi", "Yên tĩnh"] },
    imagePosition: "50% 50%",
  },
  {
    id: "bich_dong",
    tier: "hidden",
    sourceKeys: ["bich_dong", "bich_dong_pagoda"],
    name: { en: "Bich Dong Pagoda", vi: "Chùa Bích Động" },
    image: "/images/destinations/bich-dong.png",
    position: [20.2217, 105.9147],
    coords: "20.2217 N, 105.9147 E",
    category: { en: "Cliff pagoda", vi: "Chùa trong vách núi" },
    duration: { en: "1 hour", vi: "1 giờ" },
    tagline: {
      en: "Small gates, cave altars and limestone shade",
      vi: "Cổng nhỏ, điện trong hang và bóng núi đá",
    },
    shortDescription: {
      en: "A compact pagoda stop that pairs naturally with Tam Coc.",
      vi: "Một điểm chùa nhỏ gọn, ghép rất tự nhiên với Tam Cốc.",
    },
    description: {
      en: "Bich Dong is not about scale. Its beauty is in the bridge, the old gate, the cave levels and the way the pagoda disappears into stone.",
      vi: "Bích Động không hấp dẫn bằng quy mô. Vẻ đẹp nằm ở cây cầu, cổng cổ, các tầng hang và cách ngôi chùa lẩn vào vách đá.",
    },
    history: {
      en: "The pagoda is an old spiritual site built into limestone terrain near Tam Coc, with upper, middle and lower worship spaces connected by stone steps.",
      vi: "Chùa là điểm tâm linh cổ nằm trong địa hình núi đá gần Tam Cốc, có các không gian thờ hạ, trung và thượng nối với nhau bằng bậc đá.",
    },
    highlights: {
      en: ["Stone bridge", "Cave pagoda levels", "Old gate", "Tam Coc pairing"],
      vi: ["Cầu đá", "Các tầng chùa trong hang", "Cổng cổ", "Ghép cùng Tam Cốc"],
    },
    tags: { en: ["Spiritual", "Heritage", "Short stop"], vi: ["Tâm linh", "Di sản", "Điểm ngắn"] },
    imagePosition: "50% 50%",
  },
  {
    id: "thai_vi",
    tier: "hidden",
    sourceKeys: ["thai_vi", "thai_vi_temple"],
    name: { en: "Thai Vi Temple", vi: "Đền Thái Vi" },
    image: "/images/destinations/thai-vi.png",
    position: [20.2208, 105.9334],
    coords: "20.2208 N, 105.9334 E",
    category: { en: "Rural temple", vi: "Đền giữa đồng quê" },
    duration: { en: "45-60 min", vi: "45-60 phút" },
    tagline: {
      en: "A quiet temple reached through rice-field paths",
      vi: "Một ngôi đền yên qua lối ruộng lúa",
    },
    shortDescription: {
      en: "A small heritage pause behind the Tam Coc bustle.",
      vi: "Một khoảng dừng di sản nhỏ sau nhịp đông của Tam Cốc.",
    },
    description: {
      en: "Thai Vi Temple works best as a breather: a short walk or bike ride through rice fields to a stone temple with very little performance.",
      vi: "Đền Thái Vi hợp nhất như một nhịp nghỉ: đi bộ hoặc đạp xe ngắn qua ruộng lúa tới một ngôi đền đá không phô trương.",
    },
    history: {
      en: "The temple is associated with the Tran dynasty and sits inside a rural landscape that makes the approach as memorable as the shrine itself.",
      vi: "Ngôi đền gắn với triều Trần và nằm trong cảnh quan làng quê, khiến lối đi tới đền cũng đáng nhớ như chính di tích.",
    },
    highlights: {
      en: ["Rice-field approach", "Stone temple", "Cycling stop", "Quiet courtyards"],
      vi: ["Lối qua ruộng", "Đền đá", "Điểm dừng đạp xe", "Sân đền yên"],
    },
    tags: { en: ["Culture", "Cycling", "Quiet"], vi: ["Văn hóa", "Đạp xe", "Yên tĩnh"] },
    imagePosition: "50% 50%",
  },
  {
    id: "bear_sanctuary",
    tier: "hidden",
    sourceKeys: ["bear_sanctuary", "bear_sanctuary_ninh_binh"],
    name: { en: "Bear Sanctuary Ninh Binh", vi: "Cơ sở bảo tồn gấu Ninh Bình" },
    image: "/images/destinations/bear-sanctuary.png",
    position: [20.2408, 105.7142],
    coords: "20.2408 N, 105.7142 E",
    category: { en: "Responsible tourism", vi: "Du lịch có trách nhiệm" },
    duration: { en: "1-2 hours", vi: "1-2 giờ" },
    tagline: {
      en: "A thoughtful stop for conservation-minded travelers",
      vi: "Một điểm dừng tử tế cho du khách quan tâm bảo tồn",
    },
    shortDescription: {
      en: "A responsible side trip focused on animal welfare.",
      vi: "Một nhánh đi có trách nhiệm, tập trung vào phúc lợi động vật.",
    },
    description: {
      en: "Bear Sanctuary Ninh Binh is different from the landscape icons: it gives the journey a humane conservation layer that many international visitors actively look for.",
      vi: "Cơ sở bảo tồn gấu Ninh Bình khác với các biểu tượng cảnh quan: điểm này thêm một lớp bảo tồn nhân văn mà nhiều du khách quốc tế chủ động tìm kiếm.",
    },
    history: {
      en: "The sanctuary is part of a modern animal-welfare effort, designed around rescued bears, visitor education and more responsible tourism choices.",
      vi: "Cơ sở là một phần của nỗ lực phúc lợi động vật hiện đại, xoay quanh gấu được cứu hộ, giáo dục du khách và lựa chọn du lịch có trách nhiệm hơn.",
    },
    highlights: {
      en: ["Ethical visit", "Forest enclosures", "Visitor education", "Good for families"],
      vi: ["Tham quan có đạo đức", "Khu bán hoang dã", "Giáo dục du khách", "Hợp với gia đình"],
    },
    tags: { en: ["Family", "Conservation", "Responsible"], vi: ["Gia đình", "Bảo tồn", "Có trách nhiệm"] },
    imagePosition: "50% 50%",
  },
];

const destinationFacts: Record<DestinationId, DestinationFacts> = {
  trang_an: {
    significance: {
      en: "Trang An is the anchor of the region: a UNESCO mixed heritage landscape where caves, rivers and temples make the karst scenery feel lived-in rather than only scenic.",
      vi: "Tràng An là điểm neo của vùng: một di sản hỗn hợp UNESCO, nơi hang động, sông nước và đền phủ khiến cảnh núi đá có chiều sâu văn hóa chứ không chỉ đẹp để ngắm.",
    },
    bestTime: { en: "Early morning or late afternoon; weekdays are much easier than weekends.", vi: "Sáng sớm hoặc cuối chiều; ngày thường dễ chịu hơn cuối tuần rất nhiều." },
    crowdTip: { en: "Weekend boat queues can build quickly, so arrive before the main Hanoi day-trip rush.", vi: "Cuối tuần thuyền dễ xếp hàng lâu, nên tới trước đợt khách đi trong ngày từ Hà Nội." },
    gettingThere: { en: "Around 15-25 minutes from Tam Coc or Hoa Lu Old Town by car.", vi: "Khoảng 15-25 phút từ Tam Cốc hoặc Phố cổ Hoa Lư bằng ô tô." },
    entranceFee: { en: "Ticket and boat prices change by season; check the official gate on arrival.", vi: "Giá vé và thuyền có thể thay đổi theo mùa; kiểm tra tại cổng chính khi tới." },
    practical: {
      en: ["Boat routes usually take about 3 hours.", "Bring sun protection and a light rain layer.", "Ask the gate about route length before buying tickets."],
      vi: ["Tuyến thuyền thường khoảng 3 giờ.", "Nên mang chống nắng và áo mưa mỏng.", "Hỏi rõ độ dài tuyến tại cổng trước khi mua vé."],
    },
    pairWith: ["bai_dinh", "hoa_lu_old_town"],
    operatorNote: {
      en: "Editor's pick for first-time international visitors.",
      vi: "Gợi ý nổi bật cho du khách quốc tế lần đầu tới Ninh Bình.",
    },
  },
  bai_dinh: {
    significance: {
      en: "Bai Dinh gives Ninh Binh its grand spiritual scale, connecting older sacred ground with one of the largest pagoda complexes in Southeast Asia.",
      vi: "Bái Đính tạo nên quy mô tâm linh lớn của Ninh Bình, nối lớp chùa cổ với một trong những quần thể chùa lớn nhất Đông Nam Á.",
    },
    bestTime: { en: "Early afternoon on weekdays is often calmer than expected.", vi: "Đầu giờ chiều ngày thường thường vắng và dễ đi hơn tưởng tượng." },
    crowdTip: { en: "Festival season and major lunar dates can be very crowded.", vi: "Mùa lễ hội và các ngày âm lịch lớn có thể rất đông." },
    gettingThere: { en: "About 25-35 minutes from Trang An by car; use the electric cart inside the complex.", vi: "Khoảng 25-35 phút từ Tràng An bằng ô tô; nên dùng xe điện trong khuôn viên." },
    entranceFee: { en: "Entry/cart/tower fees may be separate; confirm at the ticket counter.", vi: "Vé vào, xe điện và tháp có thể tính riêng; xác nhận tại quầy vé." },
    practical: {
      en: ["The grounds are large; avoid trying to walk everything in midday heat.", "Dress respectfully for temple areas.", "The tower view is worth saving energy for."],
      vi: ["Khuôn viên rất rộng; tránh đi bộ toàn bộ lúc nắng gắt.", "Mặc trang phục lịch sự khi vào khu chùa.", "Nên giữ sức để lên tháp ngắm toàn cảnh."],
    },
    pairWith: ["trang_an", "tam_chuc"],
    operatorNote: {
      en: "Most loved by many first-time visitors for scale and views.",
      vi: "Được nhiều du khách lần đầu yêu thích nhờ quy mô và tầm nhìn.",
    },
  },
  tam_chuc: {
    significance: {
      en: "Tam Chuc extends the map into the approved expanded Ninh Binh region, adding a broad lake-temple landscape to the heritage circuit.",
      vi: "Tam Chúc mở bản đồ sang vùng Ninh Bình mở rộng, bổ sung cảnh quan hồ và chùa quy mô lớn cho tuyến di sản.",
    },
    bestTime: { en: "Late afternoon for lake light, or early morning if combining with spiritual stops.", vi: "Cuối chiều để có ánh hồ đẹp, hoặc sáng sớm nếu ghép với tuyến tâm linh." },
    crowdTip: { en: "Large ceremonies and holidays can change traffic and boat flow.", vi: "Dịp lễ lớn có thể làm thay đổi luồng xe và thuyền." },
    gettingThere: { en: "Best treated as a northern regional stop; allow extra transfer time from central Ninh Binh.", vi: "Nên xem đây là điểm phía bắc vùng mở rộng; dành thêm thời gian di chuyển từ trung tâm Ninh Bình." },
    entranceFee: { en: "Boat/electric vehicle pricing can vary; check the gate before planning exact costs.", vi: "Giá thuyền/xe điện có thể thay đổi; kiểm tra tại cổng trước khi chốt chi phí." },
    practical: {
      en: ["Plan it as a half-day if transferring from the Trang An cluster.", "The lake approach is part of the experience.", "Carry water in warm months."],
      vi: ["Nếu đi từ cụm Tràng An nên tính nửa ngày.", "Tuyến qua hồ là một phần quan trọng của trải nghiệm.", "Mang nước vào mùa nóng."],
    },
    pairWith: ["bai_dinh", "van_long"],
  },
  hoa_lu_old_town: {
    significance: {
      en: "Hoa Lu Old Town is a modern evening layer, useful for ending the day with lanterns, food and easy walking rather than another transfer-heavy stop.",
      vi: "Phố cổ Hoa Lư là lớp trải nghiệm buổi tối hiện đại, hợp để kết ngày bằng đèn lồng, đồ ăn và đi bộ nhẹ thay vì thêm một điểm phải di chuyển xa.",
    },
    bestTime: { en: "After sunset, when lantern reflections and food stalls feel alive.", vi: "Sau hoàng hôn, khi đèn lồng và các điểm ăn tối bắt đầu có không khí." },
    crowdTip: { en: "Arrive a little before peak dinner time if traveling with children or elders.", vi: "Nên tới trước giờ ăn tối cao điểm nếu đi cùng trẻ nhỏ hoặc người lớn tuổi." },
    gettingThere: { en: "Convenient after Trang An, Bai Dinh or central city hotel check-in.", vi: "Thuận tiện sau Tràng An, Bái Đính hoặc sau khi nhận phòng trong thành phố." },
    entranceFee: { en: "Public areas and individual activities may differ; check each activity on site.", vi: "Khu công cộng và từng hoạt động có thể khác nhau; kiểm tra trực tiếp tại điểm." },
    practical: {
      en: ["Good dinner stop.", "Keep valuables close in busy walking areas.", "Works well as a soft finish to a family route."],
      vi: ["Hợp để ăn tối.", "Giữ đồ cá nhân khi khu đi bộ đông.", "Rất hợp làm điểm kết nhẹ cho gia đình."],
    },
    pairWith: ["trang_an", "bai_dinh"],
  },
  tam_coc: {
    significance: {
      en: "Tam Coc gives the journey its rural texture: rice fields, low boats and limestone forms closer to village life.",
      vi: "Tam Cốc đem lại chất làng quê cho hành trình: ruộng lúa, thuyền thấp và núi đá gần với nhịp sống địa phương.",
    },
    bestTime: { en: "Green or golden rice season is strongest; morning light is easier for photos.", vi: "Mùa lúa xanh hoặc lúa vàng đẹp nhất; ánh sáng buổi sáng dễ chụp hơn." },
    crowdTip: { en: "The boat pier can be busy, but nearby temples and cycling lanes spread visitors out.", vi: "Bến thuyền có thể đông, nhưng các đền gần đó và đường đạp xe giúp giãn khách." },
    gettingThere: { en: "A natural base area with hotels, cafes and cycling routes.", vi: "Là khu lưu trú tự nhiên với khách sạn, quán cà phê và tuyến đạp xe." },
    entranceFee: { en: "Boat ticket rules can change; confirm at the pier.", vi: "Quy định vé thuyền có thể đổi; xác nhận tại bến." },
    practical: {
      en: ["Pair with Bich Dong or Thai Vi by bicycle.", "Carry cash for small stops.", "Avoid the harsh midday climb if adding Hang Mua."],
      vi: ["Nên ghép Bích Động hoặc Thái Vi bằng xe đạp.", "Mang tiền mặt cho các điểm nhỏ.", "Tránh leo Hang Múa giữa trưa nếu ghép cùng tuyến."],
    },
    pairWith: ["bich_dong", "thai_vi"],
  },
  hang_mua: {
    significance: {
      en: "Hang Mua explains the whole landscape from above, turning the river-and-karst geography into one readable view.",
      vi: "Hang Múa giúp đọc toàn bộ cảnh quan từ trên cao, biến địa hình sông nước và núi đá thành một góc nhìn rõ ràng.",
    },
    bestTime: { en: "Sunrise or late afternoon; avoid midday heat.", vi: "Bình minh hoặc cuối chiều; tránh nắng gắt giữa ngày." },
    crowdTip: { en: "Sunset is beautiful but crowded; arrive earlier if you want space on the stairs.", vi: "Hoàng hôn đẹp nhưng đông; tới sớm hơn nếu muốn thoáng trên bậc thang." },
    gettingThere: { en: "Short transfer from Tam Coc; easy to combine after a countryside stop.", vi: "Di chuyển ngắn từ Tam Cốc; dễ ghép sau một điểm làng quê." },
    entranceFee: { en: "Gate fee can change; check on arrival.", vi: "Giá vé cổng có thể thay đổi; kiểm tra khi tới." },
    practical: {
      en: ["Wear shoes with grip.", "Bring water.", "Skip the climb in storms or extreme heat."],
      vi: ["Mang giày bám tốt.", "Mang nước.", "Không nên leo khi mưa giông hoặc quá nóng."],
    },
    pairWith: ["tam_coc", "thai_vi"],
  },
  hoa_lu_ancient_capital: {
    significance: {
      en: "The ancient capital gives the landscape political memory, connecting the karst defenses with early Vietnamese dynasties.",
      vi: "Cố đô đem lại ký ức chính trị cho cảnh quan, nối địa thế phòng thủ núi đá với các triều đại đầu của Việt Nam.",
    },
    bestTime: { en: "Morning or late afternoon, especially when pairing with Am Tien.", vi: "Buổi sáng hoặc cuối chiều, nhất là khi ghép cùng Am Tiên." },
    crowdTip: { en: "Go early on weekends to avoid coach arrivals.", vi: "Cuối tuần nên đi sớm để tránh các đoàn xe lớn." },
    gettingThere: { en: "Close to Trang An and Am Tien; good as a compact heritage loop.", vi: "Gần Tràng An và Am Tiên; hợp thành vòng di sản ngắn." },
    entranceFee: { en: "Check current gate fee on arrival.", vi: "Kiểm tra giá vé hiện tại tại cổng." },
    practical: {
      en: ["Read the temple names before entering to avoid mixing Old Town and Ancient Capital.", "Dress modestly.", "Best with a guide if you want historical context."],
      vi: ["Nên đọc tên đền trước khi vào để không nhầm Phố cổ và Cố đô.", "Mặc lịch sự.", "Có hướng dẫn viên sẽ hiểu lịch sử sâu hơn."],
    },
    pairWith: ["am_tien", "trang_an"],
  },
  cuc_phuong: {
    significance: {
      en: "Cuc Phuong changes the rhythm from karst water to old forest, adding biodiversity and conservation to the route.",
      vi: "Cúc Phương đổi nhịp từ sông núi sang rừng già, thêm lớp đa dạng sinh học và bảo tồn cho hành trình.",
    },
    bestTime: { en: "Dry-season mornings; butterfly season can be especially memorable.", vi: "Buổi sáng mùa khô; mùa bướm thường rất đáng nhớ." },
    crowdTip: { en: "Allow travel time because the forest sits away from the central cluster.", vi: "Cần tính thời gian di chuyển vì rừng nằm xa cụm trung tâm." },
    gettingThere: { en: "Best as a half-day or full-day western branch by private transfer.", vi: "Hợp làm nhánh phía tây nửa ngày hoặc một ngày bằng xe riêng." },
    entranceFee: { en: "Park and conservation-center fees can vary; check the park gate.", vi: "Vé vườn và các trung tâm bảo tồn có thể khác nhau; kiểm tra tại cổng." },
    practical: {
      en: ["Wear walking shoes.", "Bring insect repellent.", "Signal may be weaker inside the forest."],
      vi: ["Mang giày đi bộ.", "Mang chống côn trùng.", "Sóng điện thoại có thể yếu trong rừng."],
    },
    pairWith: ["bear_sanctuary", "van_long"],
  },
  phat_diem: {
    significance: {
      en: "Phat Diem adds a coastal-delta architectural voice, showing that expanded Ninh Binh is not only limestone and boats.",
      vi: "Phát Diệm thêm giọng kiến trúc vùng đồng bằng ven biển, cho thấy Ninh Bình mở rộng không chỉ có núi đá và thuyền.",
    },
    bestTime: { en: "Morning or soft late afternoon light for stone and timber details.", vi: "Buổi sáng hoặc cuối chiều để thấy rõ chi tiết đá và gỗ." },
    crowdTip: { en: "Respect service times and quiet zones around the cathedral complex.", vi: "Tôn trọng giờ lễ và các khu vực cần yên tĩnh trong quần thể." },
    gettingThere: { en: "Plan as a southern branch; do not squeeze it into a tight Trang An morning.", vi: "Nên xem là nhánh phía nam; đừng nhét vào một buổi sáng Tràng An quá chặt." },
    entranceFee: { en: "Check local visitor guidance on site; policies can differ by area.", vi: "Kiểm tra hướng dẫn tham quan tại điểm; mỗi khu có thể có quy định khác nhau." },
    practical: {
      en: ["Dress respectfully.", "Give yourself time for the pond courtyard.", "Good for architecture-focused visitors."],
      vi: ["Mặc lịch sự.", "Dành thời gian cho khu sân hồ.", "Hợp với người thích kiến trúc."],
    },
    pairWith: ["hoa_lu_old_town", "tam_coc"],
  },
  thung_nham: {
    significance: {
      en: "Thung Nham is valuable because it gives nature-focused travelers a quieter dusk alternative to the main boat circuits.",
      vi: "Thung Nham đáng giá vì cho du khách yêu thiên nhiên một lựa chọn hoàng hôn yên hơn các tuyến thuyền chính.",
    },
    bestTime: { en: "Late afternoon, roughly 16:30-18:00, when birds return.", vi: "Cuối chiều, khoảng 16:30-18:00, lúc chim bay về tổ." },
    crowdTip: { en: "Do not arrive too late; the best movement is before full darkness.", vi: "Đừng tới quá muộn; thời điểm đẹp nhất là trước khi trời tối hẳn." },
    gettingThere: { en: "Short transfer from Tam Coc and Bich Dong.", vi: "Di chuyển ngắn từ Tam Cốc và Bích Động." },
    entranceFee: { en: "Check the current gate and boat options on arrival.", vi: "Kiểm tra vé cổng và lựa chọn thuyền hiện tại khi tới." },
    practical: {
      en: ["Bring a zoom lens if you care about bird photos.", "Keep voices low near bird habitat.", "Works best after a Tam Coc morning."],
      vi: ["Mang ống kính zoom nếu muốn chụp chim.", "Giữ tiếng nhỏ gần sinh cảnh chim.", "Hợp sau một buổi sáng Tam Cốc."],
    },
    pairWith: ["tam_coc", "bich_dong"],
  },
  van_long: {
    significance: {
      en: "Van Long is a strong hidden-gem choice because the scenery is quiet, reflective and less staged than the major icons.",
      vi: "Vân Long là lựa chọn hidden gem tốt vì cảnh tĩnh, nhiều phản chiếu và ít cảm giác dàn dựng hơn các biểu tượng lớn.",
    },
    bestTime: { en: "Morning mist or late afternoon light.", vi: "Sương sáng hoặc ánh cuối chiều." },
    crowdTip: { en: "Weekdays can feel almost private compared with central piers.", vi: "Ngày thường có thể rất riêng tư so với các bến trung tâm." },
    gettingThere: { en: "Good northern stop between central Ninh Binh and Tam Chuc/Bai Dinh routes.", vi: "Hợp làm điểm phía bắc giữa trung tâm Ninh Bình và tuyến Tam Chúc/Bái Đính." },
    entranceFee: { en: "Boat and entry fees may change; confirm at the local pier.", vi: "Vé thuyền và vé vào có thể thay đổi; xác nhận tại bến địa phương." },
    practical: {
      en: ["Bring cash.", "Best for quiet travelers, not people seeking nightlife.", "Respect the wetland habitat."],
      vi: ["Mang tiền mặt.", "Hợp người thích yên tĩnh, không hợp tìm hoạt động đêm.", "Tôn trọng sinh cảnh đầm nước."],
    },
    pairWith: ["bai_dinh", "tam_chuc"],
  },
  am_tien: {
    significance: {
      en: "Am Tien works because it separates Hoa Lu history from the crowded postcard route, adding atmosphere and a darker legend layer.",
      vi: "Am Tiên hiệu quả vì tách lớp lịch sử Hoa Lư khỏi tuyến check-in đông, thêm không khí và lớp truyền thuyết trầm hơn.",
    },
    bestTime: { en: "Late afternoon, when the lake and cliffs soften.", vi: "Cuối chiều, khi mặt hồ và vách đá dịu lại." },
    crowdTip: { en: "Pair it before or after Hoa Lu Ancient Capital, not as a rushed detour.", vi: "Nên ghép trước hoặc sau Cố đô Hoa Lư, không nên đi vội như điểm tạt ngang." },
    gettingThere: { en: "Very close to the Hoa Lu ancient capital area.", vi: "Rất gần khu Cố đô Hoa Lư." },
    entranceFee: { en: "Check current local ticket information at the gate.", vi: "Kiểm tra thông tin vé hiện tại tại cổng." },
    practical: {
      en: ["Wear comfortable shoes for steps.", "Good for photography in softer light.", "Bring water if visiting in summer."],
      vi: ["Mang giày thoải mái vì có bậc.", "Hợp chụp ảnh lúc ánh sáng mềm.", "Mang nước nếu đi mùa hè."],
    },
    pairWith: ["hoa_lu_ancient_capital", "trang_an"],
  },
  bich_dong: {
    significance: {
      en: "Bich Dong is the small-scale counterpoint to Bai Dinh: less grand, more intimate, and tightly tied to limestone caves.",
      vi: "Bích Động là đối trọng quy mô nhỏ của Bái Đính: không hoành tráng, nhưng thân mật hơn và gắn chặt với hang núi đá.",
    },
    bestTime: { en: "Morning for the bridge and entrance; avoid harsh noon light.", vi: "Buổi sáng đẹp ở khu cầu và cổng; tránh nắng gắt giữa trưa." },
    crowdTip: { en: "Most people pass quickly, so lingering quietly changes the experience.", vi: "Nhiều người chỉ ghé nhanh, nên ở lại chậm một chút sẽ thấy khác hẳn." },
    gettingThere: { en: "Short bicycle or car ride from Tam Coc.", vi: "Đi xe đạp hoặc ô tô rất ngắn từ Tam Cốc." },
    entranceFee: { en: "Check on-site guidance for current access rules.", vi: "Kiểm tra hướng dẫn tại điểm về quy định hiện tại." },
    practical: {
      en: ["Expect stairs and cave humidity.", "Dress respectfully.", "Pair with Thai Vi for a quiet half-day."],
      vi: ["Có bậc thang và độ ẩm trong hang.", "Mặc lịch sự.", "Ghép Thái Vi thành nửa ngày yên hơn."],
    },
    pairWith: ["tam_coc", "thai_vi"],
  },
  thai_vi: {
    significance: {
      en: "Thai Vi matters because the route to it is part of the experience: fields, village edges and a modest temple rather than a staged attraction.",
      vi: "Thái Vi đáng đi vì chính lối tới cũng là trải nghiệm: ruộng, rìa làng và một ngôi đền vừa phải thay vì điểm diễn quá mạnh.",
    },
    bestTime: { en: "Late afternoon by bicycle or on foot.", vi: "Cuối chiều, đi xe đạp hoặc đi bộ." },
    crowdTip: { en: "It stays calmer than the main boat pier even on many busy days.", vi: "Thường vẫn yên hơn bến thuyền chính ngay cả nhiều ngày đông." },
    gettingThere: { en: "Easy from Tam Coc; works well as a short cycling loop.", vi: "Dễ đi từ Tam Cốc; hợp làm vòng đạp xe ngắn." },
    entranceFee: { en: "Check current local guidance before entering worship areas.", vi: "Kiểm tra hướng dẫn địa phương trước khi vào khu thờ tự." },
    practical: {
      en: ["Bring a hat for the field path.", "Respect quiet worship spaces.", "Good low-effort stop after lunch."],
      vi: ["Mang mũ khi đi qua ruộng.", "Giữ yên trong không gian thờ tự.", "Hợp làm điểm nhẹ sau bữa trưa."],
    },
    pairWith: ["tam_coc", "bich_dong"],
  },
  bear_sanctuary: {
    significance: {
      en: "The sanctuary broadens the itinerary beyond scenery, adding responsible tourism and animal-welfare context that many international travelers value.",
      vi: "Cơ sở bảo tồn mở rộng lịch trình vượt khỏi cảnh đẹp, thêm lớp du lịch có trách nhiệm và phúc lợi động vật mà nhiều khách quốc tế coi trọng.",
    },
    bestTime: { en: "Morning or early afternoon, depending on visitor hours.", vi: "Buổi sáng hoặc đầu chiều, tùy giờ mở cửa tham quan." },
    crowdTip: { en: "Check opening days before transferring west.", vi: "Kiểm tra ngày mở cửa trước khi đi về phía tây." },
    gettingThere: { en: "Pair with Cuc Phuong as a western conservation branch.", vi: "Nên ghép với Cúc Phương thành nhánh bảo tồn phía tây." },
    entranceFee: { en: "Check current visitor policy and donation/ticket guidance before arrival.", vi: "Kiểm tra chính sách tham quan và hướng dẫn đóng góp/vé hiện tại trước khi tới." },
    practical: {
      en: ["Keep a respectful distance from animals.", "Good for families with older children.", "Follow staff guidance inside the sanctuary."],
      vi: ["Giữ khoảng cách tôn trọng với động vật.", "Hợp với gia đình có trẻ lớn.", "Làm theo hướng dẫn của nhân viên trong khu bảo tồn."],
    },
    pairWith: ["cuc_phuong", "van_long"],
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
    image: "/images/destinations/intro-trang-an-rain.png",
    kicker: { en: "By water", vi: "Đi bằng nước" },
    title: {
      en: "Nine caves at Tràng An, three at Tam Cốc, and your feet never touch the ground",
      vi: "Chín hang ở Tràng An, ba hang ở Tam Cốc, cả ngày không đặt chân xuống đất",
    },
    body: {
      en: "Route 1 at Tràng An runs through nine caves and three shrines. Hang Tối alone is 320 metres of darkness, and Hang Nấu Rượu still carries the story of wine brewed for the king. At Tam Cốc it was the Ngô Đồng river itself that cut hang Cả, hang Hai and hang Ba clean through the limestone. Then Thung Nham, late, for the birds coming home.",
      vi: "Tuyến 1 Tràng An đi qua chín hang và ba điểm tâm linh. Riêng Hang Tối là ba trăm hai mươi mét trong bóng, còn Hang Nấu Rượu tới giờ vẫn giữ tích nấu rượu tiến vua. Sang Tam Cốc thì chính sông Ngô Đồng đã khoét xuyên núi đá vôi thành hang Cả, hang Hai, hang Ba. Chiều muộn về Thung Nham đợi đàn chim.",
    },
    stops: ["trang_an", "tam_coc", "thung_nham"] as DestinationId[],
  },
  {
    id: "temple-scale",
    image: "/images/destinations/editorial/bai-dinh-editorial.png",
    kicker: { en: "Capital and pagoda", vi: "Cố đô và chùa lớn" },
    title: {
      en: "Six kings, three dynasties, and five hundred stone arhats",
      vi: "Sáu vị vua, ba triều đại, và năm trăm pho tượng đá",
    },
    body: {
      en: "In 968 Đinh Bộ Lĩnh put down the twelve warlords, took the throne and made Hoa Lư the capital of Đại Cồ Việt: three hundred hectares of inner and outer citadel, walls set straight against the cliffs. Six kings of three dynasties ruled from here before the Lý court moved to Thăng Long. Bái Đính answers differently — the old pagoda founded by the monk Nguyễn Minh Không in 1136, and the new one's arhat corridor running almost three kilometres past five hundred figures carved from Ninh Vân bluestone.",
      vi: "Năm 968, Đinh Bộ Lĩnh dẹp xong loạn mười hai sứ quân, lên ngôi và chọn Hoa Lư làm kinh đô Đại Cồ Việt: ba trăm hecta thành Nội và thành Ngoại, tường thành dựa thẳng vào vách núi. Sáu vị vua của ba triều đại nối nhau ở đây, tới khi triều Lý dời ra Thăng Long. Bái Đính thì trả lời theo cách khác — chùa cổ do quốc sư Nguyễn Minh Không lập năm 1136, còn hành lang La Hán của chùa mới dài gần ba cây số với năm trăm pho tượng tạc từ đá xanh Ninh Vân.",
    },
    stops: ["bai_dinh", "hoa_lu_ancient_capital", "tam_chuc"] as DestinationId[],
  },
  {
    id: "quiet-west",
    image: "/images/destinations/cuc-phuong.png",
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
    image: "/images/destinations/hoa-lu-old-town.jpg",
    kicker: { en: "Into the evening", vi: "Về chiều" },
    title: {
      en: "486 steps up Ngọa Long, two hundred down into Am Tiên",
      vi: "Bốn trăm tám mươi sáu bậc lên Ngọa Long, hai trăm bậc xuống Am Tiên",
    },
    body: {
      en: "Hang Múa charges 486 stone steps along the flank of Ngọa Long and hands back the whole Tam Cốc valley. Động Am Tiên asks the opposite: two hundred steps down into a closed valley where the dowager empress Dương Vân Nga took vows at the end of her life, and where Đinh Tiên Hoàng once kept tigers to punish the condemned. Come down to Hoa Lư Old Town as the lanterns go up.",
      vi: "Hang Múa bắt trả bằng 486 bậc đá dọc sườn Ngọa Long, đổi lại là cả thung lũng Tam Cốc dưới chân. Động Am Tiên thì đòi ngược lại: hơn hai trăm bậc xuống một thung kín, nơi Thái hậu Dương Vân Nga về tu những năm cuối đời, và cũng là nơi Đinh Tiên Hoàng từng nuôi hổ báo để trị tội. Xuống tới Phố cổ Hoa Lư thì đèn lồng vừa lên.",
    },
    stops: ["hang_mua", "hoa_lu_old_town", "am_tien"] as DestinationId[],
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

export default function NinhBinhLanding({
  initialLang,
  source,
  presentationMode,
  clientDemo,
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
  const modalOpen = Boolean(detailId || checkoutOpen);
  const ninhBinhHour = useNinhBinhHour();

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
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timeout = window.setTimeout(() => {
      setIntroVisible(false);
    }, prefersReducedMotion ? 900 : 7200);

    return () => window.clearTimeout(timeout);
  }, []);

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
    <main className="min-h-screen bg-[#FBFAF6] text-[#1D2925]">
      {/*
        INTRO -- KHONG CO DUONG BO QUA. Co y, theo yeu cau chu du an 05/08.
        Truoc day co ca nut "Bo qua intro" LAN bam-cho-nao-cung-tat.
        Ca hai da go: man intro 6,5 giay nay la khoang thoi gian duy nhat
        de ba trinh phat video kip boot xong TRUOC khi khach cuon toi --
        cat ngan no la cum nut khoi dong cua YouTube lai dap vao mat khach
        (xem chu thich trong cinematic-video.tsx).

        Chay DUNG MOT LAN moi lan tai trang: component chi mount mot lan,
        va doi ngon ngu khong lam no chay lai (switchLanguage doi state
        noi bo + history.replaceState, khong dieu huong, nen `key` o
        app/page.tsx khong doi).

        Tu go bo bang `onAnimationEnd` thay vi hen gio cung 6500ms: duoi
        prefers-reduced-motion, CSS rut animation con 1400ms, hen gio cung
        se giu mot lop phu vo hinh them 5 giay khong ly do.
      */}
      {introVisible ? (
        <div
          className="opening-screen"
          data-testid="opening-intro"
          onAnimationEnd={(event) => {
            if (event.target === event.currentTarget) setIntroVisible(false);
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
      <section className="relative min-h-screen overflow-hidden bg-[#183F34] text-[#FBFAF6]">
        <Image
          src="/images/destinations/trang-an.jpg"
          alt={lang === "en" ? "Ninh Binh limestone landscape" : "Phong cảnh núi đá vôi Ninh Bình"}
          fill
          priority
          sizes="100vw"
          className="float-slow object-cover opacity-80"
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(24,63,52,.16),rgba(24,63,52,.58)_48%,rgba(29,41,37,.9))]" />
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
              <a key={item} href={`#${["map", "all-destinations", "ai", "itinerary"][index]}`} className="transition hover:text-[#E7B96A]">
                {item}
              </a>
            ))}
          </nav>
          <div className="flex rounded-full border border-white/25 bg-white/10 p-1 text-sm backdrop-blur">
            <button type="button" className={`rounded-full px-3 py-1.5 ${lang === "en" ? "bg-[#FBFAF6] text-[#183F34]" : ""}`} onClick={() => switchLanguage("en")}>EN</button>
            <button type="button" className={`rounded-full px-3 py-1.5 ${lang === "vi" ? "bg-[#FBFAF6] text-[#183F34]" : ""}`} onClick={() => switchLanguage("vi")}>VI</button>
          </div>
        </div>
        <div id="top" className="relative z-10 mx-auto flex min-h-screen max-w-7xl flex-col justify-end px-5 pb-16 pt-28 sm:px-8 lg:pb-24">
          {/*
            Nhan "Client demonstration · Supabase shared core" da GO HAN
            05/08. Day la ngon ngu KY THUAT NOI BO lot thang ra mat khach
            du lich: "Supabase shared core" khong co nghia gi voi nguoi
            xem, va con lam trang trong nhu mot ban thu nghiem chua xong.
            Dung bug nay da tung bi bat mot lan (xem HANDOFF 03/08: "Ninh
            Binh tourism core", "Intent -> rules -> validated itinerary",
            "Trang thai: idle") -- lan nay la cho con sot lai.
            `clientDemo` van duoc dung o duoi (khoi `JourneyCta`) de quyet
            dinh co hua thanh toan QR hay khong, nen KHONG bo bien nay.
          */}
          <h1 className="fade-up font-display text-6xl leading-[0.9] text-[#FBFAF6] sm:text-8xl lg:text-[9rem]">{t.title}</h1>
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
            <a href={`/plan?lang=${lang}${source ? `&source=${encodeURIComponent(source)}` : ""}`} className="rounded-full bg-[#E7B96A] px-6 py-3 text-center font-semibold text-[#183F34] shadow-xl shadow-black/20 transition hover:bg-[#f0c87c]">{t.begin}</a>
            <a href={`/explore?lang=${lang}${source ? `&source=${encodeURIComponent(source)}` : ""}`} className="rounded-full border border-white/35 px-6 py-3 text-center font-semibold text-white transition hover:bg-white/12">{t.exploreMap}</a>
          </div>
        </div>
      </section>

      {/*
        `eager` CHI dat o clip dau: man intro khoa man hinh vai giay ngay
        dau trang, tan dung dung khoang do de trinh phat boot xong va cum
        nut khoi dong cua YouTube kip tan truoc khi khach cuon toi.

        CA BA clip deu `eager`, nhung RAI DEU trong khung intro (0s / 2,2s
        / 4,2s) chu khong nap cung luc: nap dong thoi thi tren 4G ca ba
        cung cham, va clip dau -- cai khach gap som nhat -- lai thiet nhat.
        Rai deu thi toi luc intro tan (6,5s) ca ba da boot xong va cum nut
        khoi dong cua YouTube da tan het.
      */}
      <CinematicVideo clip={cinematicClips[lang][0]} eager />

      <PinnedStory beats={storyBeats[lang]} />

      <section id="map" className="px-5 py-16 sm:px-8 lg:py-24">
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
          <div className="relative z-0 isolate overflow-hidden rounded-[8px] border border-[#A8CEC1]/70 bg-[#F6F1E7] p-3 shadow-xl shadow-[#183F34]/10">
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

      <CinematicVideo clip={cinematicClips[lang][1]} eager eagerDelayMs={2200} />

      <DestinationIndex
        items={destinations.slice(ZIGZAG_FEATURED).map((place) => ({
          id: place.id,
          name: place.name[lang],
          image: place.image,
          imagePosition: place.imagePosition,
          category: place.category[lang],
          duration: place.duration[lang],
        }))}
        copy={{
          sectionLabel: t.indexLabel as string,
          sectionTitle: t.indexTitle as string,
          sectionIntro: t.indexIntro as string,
          hint: t.indexHint as string,
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
      <section id="curated-routes" className="overflow-hidden bg-[#F6F1E7] py-20 text-[#1D2925] sm:py-24 lg:py-28">
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
            const firstStop = route.stops[0];
            return (
              <article
                key={route.id}
                onClick={() => openDetail(firstStop)}
                className="route-card group grid w-[88vw] shrink-0 cursor-pointer snap-center overflow-hidden rounded-[12px] bg-[#183F34] text-white shadow-2xl shadow-[#183F34]/16 sm:w-[720px] lg:w-[1040px] lg:grid-cols-[0.9fr_1.1fr]"
              >
                <div className="relative min-h-[270px] overflow-hidden sm:min-h-[360px] lg:min-h-[580px]">
                  <Image
                    src={route.image}
                    alt={route.title[lang]}
                    fill
                    sizes="(min-width: 1024px) 470px, (min-width: 640px) 720px, 88vw"
                    className="object-cover transition duration-700 group-hover:scale-[1.035]"
                  />
                  <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(6,18,15,.06),rgba(6,18,15,.28))]" />
                  <span className="absolute right-5 top-5 text-xs font-extrabold tracking-[0.22em] text-white/88">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                </div>

                <div className="flex flex-col p-6 sm:p-8 lg:p-12">
                  <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#A8CEC1]">{route.kicker[lang]}</p>
                  <h3 className="font-display mt-5 max-w-xl text-4xl leading-[1.03] sm:text-5xl lg:text-6xl">{route.title[lang]}</h3>
                  <p className="mt-6 max-w-xl text-[0.98rem] leading-7 text-white/76 sm:text-base sm:leading-8">{route.body[lang]}</p>
                  <div className="mt-6 flex flex-wrap gap-2">
                    {route.stops.map((id) => {
                      const stop = destinations.find((destination) => destination.id === id);
                      return stop ? (
                        <span key={id} className="rounded-full border border-white/22 bg-white/8 px-3 py-1.5 text-xs font-bold text-white/86">
                          {stop.name[lang]}
                        </span>
                      ) : null;
                    })}
                  </div>
                  <div className="mt-auto flex flex-col gap-3 pt-8 sm:flex-row">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        openDetail(firstStop);
                      }}
                      className="rounded-full bg-[#FBFAF6] px-5 py-3 font-semibold text-[#183F34] transition hover:bg-[#E7B96A]"
                    >
                      {t.viewRoute}
                    </button>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        addRoute(route.stops);
                      }}
                      className="rounded-full border border-white/35 px-5 py-3 font-semibold text-white transition hover:bg-white/12"
                    >
                      {t.addRoute}
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <JourneyCta
        copy={{
          title: t.zigzagCtaTitle as string,
          body: t.zigzagCtaBody as string,
          primary: t.zigzagCtaPrimary as string,
          secondary: t.zigzagCtaSecondary as string,
          /*
           * Chi hua thanh toan QR khi thanh toan sandbox that su bat
           * (NEXT_PUBLIC_EXPERIENCE_MODE=client-demo). O che do production
           * /checkout tra ve "Online checkout is not configured" -- hua
           * roi dan khach vao ngo cut con te hon la khong hua. Da kiem
           * that bang curl len production truoc khi viet dong nay.
           */
          offer: (clientDemo ? t.zigzagCtaOffer : t.zigzagCtaOfferPlain) as string,
        }}
      />

      <CinematicVideo clip={cinematicClips[lang][2]} eager eagerDelayMs={4200} />

      <section id="ai" className="px-5 py-16 sm:px-8 lg:py-24">
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
            <div className="grid grid-cols-3 gap-2">
              {durations.map((duration) => (
                <button key={duration.id} type="button" onClick={() => setSelectedDuration(duration.id)} className={`rounded-full border px-3 py-2 text-sm font-semibold ${selectedDuration === duration.id ? "border-[#183F34] bg-[#183F34] text-white" : "border-[#A8CEC1] text-[#183F34]"}`}>
                  {duration[lang]}
                </button>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
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
              <button type="button" onClick={createJourney} disabled={loading} className="min-w-44 rounded-full bg-[#183F34] px-5 py-2 font-semibold text-white transition hover:bg-[#24594a] disabled:cursor-wait disabled:opacity-75">
                {loading ? t.creating : t.create}
              </button>
            </div>
          </Reveal>
        </div>
      </section>

      <section id="itinerary" className="bg-[#F6F1E7] px-5 py-16 sm:px-8 lg:py-24">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1.05fr_.95fr]">
          <div>
            <Reveal>
              <p className="text-sm uppercase tracking-[0.24em] text-[#3F7568]">{t.itinerary}</p>
              <RevealHeading
                as="h2"
                text={t.itinerary as string}
                className="font-display mt-3 text-4xl text-[#183F34] sm:text-6xl"
              />
              <p className="mt-3 text-[#58665F]">{t.itineraryNote}</p>
            </Reveal>
            <div className="mt-6 overflow-hidden rounded-[8px] border border-[#A8CEC1]/70 bg-[#FBFAF6]">
              {itinerary.map((stop, index) => (
                <article key={`${stop.time}-${stop.id}-${index}`} className="grid gap-4 border-b border-[#A8CEC1]/40 p-4 last:border-b-0 sm:grid-cols-[88px_1fr_auto]">
                  <p className="font-semibold text-[#183F34]">{stop.time}</p>
                  <div>
                    <h3 className="font-display text-2xl text-[#183F34]">{stop.title[lang]}</h3>
                    <p className="mt-1 text-sm text-[#6D756F]">{stop.note[lang]} · {stop.distance[lang]}</p>
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

          <aside id="experience" className="rounded-[8px] bg-[#183F34] p-6 text-[#FBFAF6] shadow-xl shadow-[#183F34]/20">
            <div className="relative mb-6 aspect-[16/10] overflow-hidden rounded-[8px]">
              <Image src="/images/destinations/hoa-lu-old-town.jpg" alt={t.experienceName as string} fill sizes="(min-width: 1024px) 40vw, 100vw" className="object-cover" />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent,rgba(24,63,52,.55))]" />
            </div>
            <p className="text-sm uppercase tracking-[0.24em] text-[#A8CEC1]">{t.experienceTitle}</p>
            <h2 className="font-display mt-4 text-4xl">{t.experienceName}</h2>
            <p className="mt-4 leading-7 text-[#FBFAF6]/78">{t.experienceBody}</p>
            <p className="mt-6 rounded-[8px] bg-white/10 p-4 text-[#FBFAF6]/86">{t.experienceFit}</p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button type="button" onClick={() => openDetail("hoa_lu_old_town")} className="rounded-full border border-white/30 px-5 py-3 font-semibold transition hover:bg-white/10">{t.viewExperience}</button>
              <button type="button" onClick={() => setCheckoutOpen(true)} className="rounded-full bg-[#E7B96A] px-5 py-3 font-semibold text-[#183F34] transition hover:bg-[#f0c87c]">{t.reserve}</button>
            </div>
          </aside>
        </div>
      </section>

      <footer className="border-t border-[#e2ded2] bg-[#FBFAF6] px-5 py-10 text-center sm:px-8">
        <p className="font-display text-lg text-[#183F34]">{t.footerNote}</p>
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
