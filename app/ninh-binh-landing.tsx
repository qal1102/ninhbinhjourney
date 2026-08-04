"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { Reveal } from "@/components/shared/reveal";

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
    nav: ["Map", "Stories", "Builder", "Journey"],
    introTop: "Ninh Binh",
    introWords: ["Nature.", "Heritage.", "Wonder."],
    title: "Ninh Binh",
    subtitle: "A journey between mountains, water and timeless heritage",
    footerNote: "Ninh Binh Journey · A journey between mountains, water and timeless heritage.",
    begin: "Plan my journey",
    exploreMap: "Explore map",
    journeysLabel: "Curated Ninh Binh",
    journeysTitle: "Stories, not stops",
    journeysBody:
      "Drag through composed routes inspired by luxury travel collections: water first, temples next, forest and lantern light when the day slows down.",
    viewRoute: "View route",
    addRoute: "Add route",
    youAreHere: "You are here",
    qrSource: "QR source",
    welcomePoint: "Ninh Binh welcome point",
    mapTitle: "Interactive tourism map",
    mapBody:
      "Explore the wider Ninh Binh region through heritage water routes, spiritual landmarks, ancient capitals, forest edges and coastal architecture.",
    nearby: "Explore nearby",
    discover: "Discover",
    add: "Add to journey",
    added: "Added",
    stories: "Destination stories",
    storiesIntro:
      "Editorial chapters for the places that shape a full Ninh Binh journey.",
    signatureStories: "Signature route",
    hiddenGems: "Hidden gems western travelers notice",
    hiddenGemsIntro:
      "Quieter stops for visitors who want less-crowded nature, small temples and ethical side trips.",
    pathsLabel: "Start here",
    pathsTitle: "No two journeys start the same way.",
    pathMapTitle: "Browse the map",
    pathMapBody:
      "See every place on a real map, filter by time on foot and pace, then keep what fits.",
    pathPlanTitle: "Tell us your day",
    pathPlanBody:
      "Describe the day you want, in your own words. We build an itinerary that respects opening hours and walking limits.",
    pathPackageTitle: "Take a ready route",
    pathPackageBody:
      "Four packaged days, already sequenced. Pick one and adjust it later.",
    pathOpen: "Open",
    seeAllDestinations: "See all destinations",
    companionLabel: "Journey Builder",
    companionTitle: "Build a route that feels human",
    companionBody:
      "Select your time, pace and interests. The route is assembled locally from curated sample data and stays editable before any reservation.",
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
    nav: ["Bản đồ", "Câu chuyện", "Lập tuyến", "Lịch trình"],
    introTop: "Ninh Bình",
    introWords: ["Thiên nhiên.", "Di sản.", "Kỳ quan."],
    title: "Ninh Bình",
    subtitle: "Hành trình giữa núi, nước và di sản vượt thời gian",
    footerNote: "Ninh Bình Journey · Hành trình giữa núi, nước và di sản vượt thời gian.",
    begin: "Lập hành trình",
    exploreMap: "Khám phá bản đồ",
    journeysLabel: "Ninh Bình tuyển chọn",
    journeysTitle: "Câu chuyện, không chỉ điểm dừng",
    journeysBody:
      "Kéo qua các tuyến được biên tập như một collection du lịch cao cấp: nước trước, chùa sau, rừng và ánh đèn khi ngày chậm lại.",
    viewRoute: "Xem tuyến",
    addRoute: "Thêm tuyến",
    youAreHere: "Bạn đang ở đây",
    qrSource: "Nguồn QR",
    welcomePoint: "Điểm chào đón Ninh Bình",
    mapTitle: "Bản đồ du lịch tương tác",
    mapBody:
      "Khám phá vùng Ninh Bình mở rộng qua tuyến nước di sản, điểm tâm linh, cố đô, rìa rừng và kiến trúc ven biển.",
    nearby: "Khám phá gần đây",
    discover: "Khám phá",
    add: "Thêm vào lịch trình",
    added: "Đã thêm",
    stories: "Câu chuyện điểm đến",
    storiesIntro:
      "Những chương ảnh lớn dành cho các điểm đến làm nên một hành trình Ninh Bình trọn vẹn.",
    signatureStories: "Tuyến nổi bật",
    hiddenGems: "Điểm ít đông được khách Tây chú ý",
    hiddenGemsIntro:
      "Những điểm yên hơn dành cho du khách muốn thiên nhiên vắng, đền chùa nhỏ và trải nghiệm có trách nhiệm.",
    pathsLabel: "Bắt đầu ở đây",
    pathsTitle: "Không ai bắt đầu một chuyến đi giống ai.",
    pathMapTitle: "Xem trên bản đồ",
    pathMapBody:
      "Thấy hết các điểm trên bản đồ thật, lọc theo thời gian và mức đi bộ, rồi giữ lại thứ hợp với mình.",
    pathPlanTitle: "Kể về ngày của bạn",
    pathPlanBody:
      "Nói bằng lời của bạn về ngày bạn muốn có. Lịch trình dựng ra sẽ tôn trọng giờ mở cửa và giới hạn đi bộ.",
    pathPackageTitle: "Lấy tuyến dựng sẵn",
    pathPackageBody:
      "Bốn ngày đã đóng gói, đã xếp thứ tự. Chọn một rồi chỉnh sau cũng được.",
    pathOpen: "Mở",
    seeAllDestinations: "Xem tất cả điểm đến",
    companionLabel: "Bộ lập tuyến hành trình",
    companionTitle: "Dựng một tuyến đi có nhịp người thật",
    companionBody:
      "Chọn thời lượng, nhịp đi và sở thích. Tuyến được ghép cục bộ từ dữ liệu mẫu đã biên tập và luôn có thể chỉnh trước khi giữ chỗ.",
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
} satisfies Record<Language, Record<string, string | string[]>>;

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
const signatureDestinations = destinations.filter((destination) => destination.tier === "signature");

/**
 * Trang chủ chỉ dựng ba chương đầu. Trước đây nó đổ hết 10 thẻ lớn + 6 thẻ nhỏ
 * xuống một trang dài hơn 11.000 pixel, làm đúng công việc mà `/explore` đã
 * làm tốt hơn (có bản đồ thật, bộ lọc theo thời gian và mức đi bộ). Danh mục
 * đầy đủ trả về cho `/explore`; trang chủ là cửa vào, không phải cái kho.
 */
const HOMEPAGE_STORY_COUNT = 3;
const homepageStories = signatureDestinations.slice(0, HOMEPAGE_STORY_COUNT);
const totalDestinationCount = destinations.length;

const routeCollections = [
  {
    id: "water-first",
    image: "/images/destinations/intro-trang-an-rain.png",
    kicker: { en: "Water first", vi: "Nước trước" },
    title: { en: "Mist, boats and slow heritage", vi: "Sương, thuyền và di sản chậm" },
    body: {
      en: "Start with Trang An while the river is quiet, then soften into Tam Coc and Thung Nham before dusk.",
      vi: "Bắt đầu ở Tràng An khi mặt nước còn yên, rồi dịu dần qua Tam Cốc và Thung Nham trước hoàng hôn.",
    },
    stops: ["trang_an", "tam_coc", "thung_nham"] as DestinationId[],
  },
  {
    id: "temple-scale",
    image: "/images/destinations/editorial/bai-dinh-editorial.png",
    kicker: { en: "Sacred scale", vi: "Quy mô tâm linh" },
    title: { en: "Pagodas, ancient capital, lake temple", vi: "Chùa lớn, cố đô, hồ chùa" },
    body: {
      en: "A composed northern route for visitors who want the spiritual side of the expanded region.",
      vi: "Một tuyến phía bắc được biên tập cho du khách muốn thấy lớp tâm linh của vùng mở rộng.",
    },
    stops: ["bai_dinh", "hoa_lu_ancient_capital", "tam_chuc"] as DestinationId[],
  },
  {
    id: "quiet-west",
    image: "/images/destinations/cuc-phuong.png",
    kicker: { en: "Quiet west", vi: "Phía tây yên hơn" },
    title: { en: "Forest shade and responsible travel", vi: "Bóng rừng và du lịch tử tế" },
    body: {
      en: "A calmer branch through Cuc Phuong, Van Long and the Bear Sanctuary for travelers who want depth.",
      vi: "Một nhánh yên hơn qua Cúc Phương, Vân Long và cơ sở bảo tồn gấu cho người muốn đi sâu hơn.",
    },
    stops: ["cuc_phuong", "van_long", "bear_sanctuary"] as DestinationId[],
  },
  {
    id: "lantern-night",
    image: "/images/destinations/hoa-lu-old-town.jpg",
    kicker: { en: "After dark", vi: "Sau hoàng hôn" },
    title: { en: "Lanterns after limestone", vi: "Đèn lồng sau núi đá" },
    body: {
      en: "A softer end to the day: Hang Mua for altitude, Hoa Lu Old Town for lanterns and food.",
      vi: "Một kết ngày nhẹ hơn: Hang Múa lấy độ cao, Phố cổ Hoa Lư cho đèn lồng và bữa tối.",
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
      {introVisible ? (
        <div
          className="opening-screen"
          data-testid="opening-intro"
          onClick={() => setIntroVisible(false)}
        >
          <Image
            src="/images/destinations/intro-trang-an-rain.png"
            alt=""
            fill
            priority
            sizes="100vw"
            className="opening-image object-cover"
          />
          <div className="opening-vignette" />
          <button
            type="button"
            className="opening-skip"
            onClick={(event) => {
              event.stopPropagation();
              setIntroVisible(false);
            }}
          >
            {lang === "vi" ? "Bỏ qua intro" : "Skip intro"}
          </button>
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
              <a key={item} href={`#${["map", "stories", "ai", "itinerary"][index]}`} className="transition hover:text-[#E7B96A]">
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
          {clientDemo ? (
            <span className="fade-up mb-5 w-fit rounded-full border border-white/25 bg-black/15 px-3 py-1 text-xs font-bold text-white/82 backdrop-blur">
              Client demonstration · Supabase shared core
            </span>
          ) : null}
          <p className="fade-up mb-6 text-sm font-bold uppercase tracking-[0.22em] text-[#E7B96A]">{(t.introWords as string[]).join(" ")}</p>
          <h1 className="fade-up font-display text-6xl leading-[0.9] text-[#FBFAF6] sm:text-8xl lg:text-[9rem]">{t.title}</h1>
          <p className="fade-up mt-6 max-w-2xl text-xl leading-8 text-[#FBFAF6]/88 sm:text-2xl">{t.subtitle}</p>
          <div className="fade-up mt-9 flex flex-col gap-3 sm:flex-row">
            <a href={`/plan?lang=${lang}${source ? `&source=${encodeURIComponent(source)}` : ""}`} className="rounded-full bg-[#E7B96A] px-6 py-3 text-center font-semibold text-[#183F34] shadow-xl shadow-black/20 transition hover:bg-[#f0c87c]">{t.begin}</a>
            <a href={`/explore?lang=${lang}${source ? `&source=${encodeURIComponent(source)}` : ""}`} className="rounded-full border border-white/35 px-6 py-3 text-center font-semibold text-white transition hover:bg-white/12">{t.exploreMap}</a>
          </div>
        </div>
      </section>

      {/* Ba lối đi. Đặt ngay dưới ảnh mở đầu vì đây là chỗ khách hay đứng lại:
          trước đây trang chủ đổ thẳng vào một danh mục dài, không nói cho ai
          biết nên bắt đầu từ đâu. */}
      <section className="bg-[#FBFAF6] px-5 pt-16 text-[#1D2925] sm:px-8 sm:pt-20">
        <div className="mx-auto max-w-7xl">
          <Reveal>
            <p className="text-sm font-bold uppercase tracking-[0.24em] text-[#3F7568]">
              {t.pathsLabel}
            </p>
            <h2 className="font-display mt-3 max-w-3xl text-4xl leading-tight text-[#183F34] sm:text-5xl">
              {t.pathsTitle}
            </h2>
          </Reveal>
          <div className="mt-9 grid gap-4 md:grid-cols-3">
            {(
              [
                [t.pathMapTitle, t.pathMapBody, "/explore"],
                [t.pathPlanTitle, t.pathPlanBody, "/plan"],
                [t.pathPackageTitle, t.pathPackageBody, "/packages"],
              ] as Array<[string, string, string]>
            ).map(([title, body, href], index) => (
              <Reveal key={href} delayMs={index * 90}>
                <a
                  href={`${href}?lang=${lang}${source ? `&source=${encodeURIComponent(source)}` : ""}`}
                  className="group flex h-full flex-col justify-between rounded-[8px] border border-[#A8CEC1]/70 bg-white p-6 transition hover:border-[#183F34] hover:shadow-lg hover:shadow-[#183F34]/10"
                >
                  <div>
                    <span className="font-display text-2xl text-[#A8CEC1] transition group-hover:text-[#E7B96A]">
                      0{index + 1}
                    </span>
                    <h3 className="font-display mt-2 text-3xl text-[#183F34]">{title}</h3>
                    <p className="mt-3 leading-7 text-[#4d5b55]">{body}</p>
                  </div>
                  <span className="mt-6 inline-flex items-center gap-2 text-sm font-bold uppercase tracking-[0.16em] text-[#183F34]">
                    {t.pathOpen}
                    <span aria-hidden="true" className="transition group-hover:translate-x-1">
                      →
                    </span>
                  </span>
                </a>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#FBFAF6] py-16 text-[#1D2925] sm:py-20 lg:py-24">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <Reveal className="grid gap-6 lg:grid-cols-[0.78fr_1.22fr] lg:items-end">
            <div>
              <p className="text-sm font-extrabold uppercase tracking-[0.24em] text-[#3F7568]">{t.journeysLabel}</p>
              <h2 className="font-display mt-4 max-w-3xl text-5xl leading-none text-[#183F34] sm:text-7xl">{t.journeysTitle}</h2>
            </div>
            <div className="max-w-2xl lg:justify-self-end">
              <p className="text-lg leading-8 text-[#4d5b55]">{t.journeysBody}</p>
            </div>
          </Reveal>
        </div>
        <div className="route-rail mt-10 flex snap-x gap-4 overflow-x-auto px-5 pb-4 sm:px-8 lg:px-[max(2rem,calc((100vw-80rem)/2+2rem))]">
          {routeCollections.map((route, index) => {
            const firstStop = route.stops[0];
            return (
              <article key={route.id} className="route-card group relative h-[520px] w-[82vw] shrink-0 snap-center overflow-hidden rounded-[8px] bg-[#183F34] text-white shadow-2xl shadow-[#183F34]/18 sm:w-[560px] lg:w-[620px]">
                <Image
                  src={route.image}
                  alt={route.title[lang]}
                  fill
                  sizes="(min-width: 1024px) 620px, 82vw"
                  className="object-cover transition duration-700 group-hover:scale-[1.035]"
                />
                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(6,18,15,.12),rgba(6,18,15,.35)_42%,rgba(6,18,15,.88))]" />
                <div className="absolute inset-x-0 top-0 flex items-center justify-between p-5 text-xs font-extrabold uppercase tracking-[0.2em] text-white/82">
                  <span>{route.kicker[lang]}</span>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                </div>
                <div className="absolute inset-x-0 bottom-0 p-5 sm:p-7">
                  <h3 className="font-display max-w-lg text-4xl leading-tight sm:text-5xl">{route.title[lang]}</h3>
                  <p className="mt-4 max-w-lg leading-7 text-white/78">{route.body[lang]}</p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    {route.stops.map((id) => {
                      const stop = destinations.find((destination) => destination.id === id);
                      return stop ? <span key={id} className="rounded-full border border-white/24 bg-white/12 px-3 py-1 text-xs font-bold backdrop-blur">{stop.name[lang]}</span> : null;
                    })}
                  </div>
                  <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                    <button type="button" onClick={() => openDetail(firstStop)} className="rounded-full bg-[#FBFAF6] px-5 py-3 font-semibold text-[#183F34] transition hover:bg-[#E7B96A]">{t.viewRoute}</button>
                    <button type="button" onClick={() => addRoute(route.stops)} className="rounded-full border border-white/35 px-5 py-3 font-semibold text-white transition hover:bg-white/12">{t.addRoute}</button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section id="map" className="px-5 py-16 sm:px-8 lg:py-24">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.72fr_1.28fr] lg:items-center">
          <Reveal>
            <p className="text-sm uppercase tracking-[0.24em] text-[#3F7568]">{t.youAreHere}</p>
            <h2 className="font-display mt-3 text-5xl text-[#183F34] sm:text-6xl">Ninh Bình</h2>
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

      <section id="stories" className="bg-[#183F34] px-5 py-16 text-[#FBFAF6] sm:px-8 lg:py-24">
        <div className="mx-auto max-w-7xl">
          <Reveal>
            <p className="text-sm uppercase tracking-[0.24em] text-[#A8CEC1]">{t.stories}</p>
            <h2 className="font-display mt-3 max-w-4xl text-4xl leading-tight sm:text-6xl">{t.storiesIntro}</h2>
            <p className="mt-8 text-sm font-bold uppercase tracking-[0.22em] text-[#E7B96A]">{t.signatureStories}</p>
          </Reveal>
          <div className="mt-10 grid gap-6">
            {homepageStories.map((place, index) => (
              <article
                id={`destination-${place.id}`}
                key={place.id}
                className="story-card group grid overflow-hidden rounded-[8px] border border-white/12 bg-[#FBFAF6] text-[#1D2925] shadow-2xl shadow-black/20 lg:grid-cols-[1.05fr_.95fr]"
              >
                <div className={`relative min-h-80 overflow-hidden sm:min-h-[420px] lg:min-h-[560px] ${index % 2 ? "lg:order-2" : ""}`}>
                  <Image
                    src={place.image}
                    alt={place.name[lang]}
                    fill
                    sizes="(min-width: 1024px) 52vw, 100vw"
                    className="story-image object-cover transition duration-700 group-hover:scale-[1.025]"
                    style={{ objectPosition: place.imagePosition }}
                  />
                  <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_45%,rgba(24,63,52,.42))]" />
                  <span className="absolute bottom-5 left-5 rounded-full bg-[#FBFAF6]/90 px-3 py-1 text-xs font-extrabold uppercase tracking-[0.18em] text-[#183F34]">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                </div>
                <div className="flex flex-col justify-between p-6 sm:p-10 lg:p-12">
                  <div>
                    <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-[#3F7568]">{place.category[lang]} · {place.duration[lang]}</p>
                    <h3 className="font-display mt-4 max-w-2xl text-4xl leading-tight text-[#183F34] sm:text-6xl">{place.name[lang]}</h3>
                    <p className="mt-6 max-w-2xl text-xl leading-8 text-[#1D2925]">{place.tagline[lang]}</p>
                    <p className="mt-4 max-w-2xl leading-7 text-[#4d5b55]">{place.description[lang]}</p>
                    <div className="mt-7 flex flex-wrap gap-2">
                      {place.tags[lang].map((tag) => <span key={tag} className="rounded-full border border-[#A8CEC1] bg-[#F6F1E7] px-3 py-1 text-sm font-semibold text-[#3F7568]">{tag}</span>)}
                    </div>
                  </div>
                  <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                    <button type="button" onClick={() => openDetail(place.id)} className="rounded-full bg-[#183F34] px-5 py-3 font-semibold text-white transition hover:bg-[#24594a]">{t.discover}</button>
                    <button type="button" onClick={() => addDestination(place.id)} className="rounded-full border border-[#A8CEC1] px-5 py-3 font-semibold text-[#183F34] transition hover:bg-[#F6F1E7]">{selectedIds.includes(place.id) ? t.added : t.add}</button>
                  </div>
                </div>
              </article>
            ))}
          </div>
          {/* Danh mục đầy đủ nằm ở /explore, nơi có bản đồ thật và bộ lọc.
              Trang chủ chỉ dẫn sang, không chép lại. */}
          <div className="mt-14 flex flex-col gap-4 border-t border-white/15 pt-8 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-2xl text-lg leading-8 text-[#FBFAF6]/78">
              {t.hiddenGemsIntro}
            </p>
            <a
              href={`/explore?lang=${lang}${source ? `&source=${encodeURIComponent(source)}` : ""}`}
              className="inline-flex shrink-0 items-center gap-2 rounded-full bg-[#E7B96A] px-6 py-3 font-semibold text-[#183F34] transition hover:bg-[#f0c87c]"
            >
              {t.seeAllDestinations} ({totalDestinationCount})
              <span aria-hidden="true">→</span>
            </a>
          </div>
        </div>
      </section>

      <section id="ai" className="px-5 py-16 sm:px-8 lg:py-24">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <Reveal>
            <p className="text-sm uppercase tracking-[0.24em] text-[#3F7568]">{t.companionLabel}</p>
            <h2 className="font-display mt-3 text-4xl text-[#183F34] sm:text-6xl">{t.companionTitle}</h2>
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
              <h2 className="font-display mt-3 text-4xl text-[#183F34] sm:text-6xl">{t.itinerary}</h2>
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

      {detailDestination && detailFacts ? (
        <div
          className="fixed inset-0 z-[1200] overflow-y-auto bg-[#1D2925]/82 px-4 py-6 backdrop-blur-md sm:py-10"
          role="dialog"
          aria-modal="true"
          aria-labelledby="destination-detail-title"
          onMouseDown={() => setDetailId(null)}
        >
          <article
            className="relative mx-auto w-full max-w-6xl overflow-hidden rounded-[8px] bg-[#FBFAF6] shadow-2xl"
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
            <div className="relative min-h-[320px] overflow-hidden sm:min-h-[440px]">
              <Image
                src={detailDestination.image}
                alt={detailDestination.name[lang]}
                fill
                sizes="(min-width: 1280px) 1120px, 100vw"
                quality={95}
                className="object-cover"
                style={{ objectPosition: detailDestination.imagePosition }}
              />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(29,41,37,.1),rgba(29,41,37,.78))]" />
              <div className="absolute inset-x-0 bottom-0 p-6 text-white sm:p-8 lg:p-10">
                <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#E7B96A]">{detailDestination.category[lang]} · {detailDestination.duration[lang]}</p>
                <h2 id="destination-detail-title" className="font-display mt-3 max-w-4xl text-5xl leading-tight sm:text-7xl">{detailDestination.name[lang]}</h2>
                <p className="mt-4 max-w-3xl text-lg leading-8 text-white/88">{detailDestination.description[lang]}</p>
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
