"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { useMemo, useState } from "react";

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
  | "phat_diem";

type Localized = Record<Language, string>;

export type Destination = {
  id: DestinationId;
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

export type MapCopy = {
  add: string;
  added: string;
  discover: string;
  welcome: string;
  welcomeDescription: string;
  youAreHere: string;
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
    nav: ["Map", "Stories", "Companion", "Journey"],
    introTop: "Ninh Binh",
    introWords: ["Nature.", "Heritage.", "Wonder."],
    title: "Ninh Binh",
    subtitle: "A journey between mountains, water and timeless heritage",
    begin: "Begin your journey",
    exploreMap: "Explore map",
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
    companionLabel: "Journey Companion",
    companionTitle: "Choose the rhythm of your route",
    companionBody:
      "Select your time and mood. The page drafts a local route from approved sample data without calling an AI provider.",
    prompt: "Tell me what kind of journey you want...",
    create: "Create journey",
    creating: "Composing your route...",
    voice: "Voice",
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
    highlightsTitle: "What to see",
    selected: "Selected",
    welcome: "Welcome location",
    welcomeDescription:
      "No QR source was supplied, so the map starts from a neutral Ninh Binh welcome point.",
  },
  vi: {
    nav: ["Bản đồ", "Câu chuyện", "Đồng hành", "Lịch trình"],
    introTop: "Ninh Bình",
    introWords: ["Thiên nhiên.", "Di sản.", "Kỳ quan."],
    title: "Ninh Bình",
    subtitle: "Hành trình giữa núi, nước và di sản vượt thời gian",
    begin: "Bắt đầu hành trình",
    exploreMap: "Khám phá bản đồ",
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
    companionLabel: "Bạn đồng hành hành trình",
    companionTitle: "Chọn nhịp đi của hành trình",
    companionBody:
      "Chọn thời lượng và cảm hứng mong muốn. Trang sẽ tạo tuyến cục bộ từ dữ liệu mẫu đã chuẩn bị, chưa gọi nhà cung cấp AI.",
    prompt: "Bạn muốn một hành trình như thế nào...",
    create: "Tạo lịch trình",
    creating: "Đang sắp xếp tuyến...",
    voice: "Giọng nói",
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
    highlightsTitle: "Đáng xem",
    selected: "Đã chọn",
    welcome: "Điểm chào đón",
    welcomeDescription:
      "URL chưa có nguồn QR, vì vậy bản đồ bắt đầu tại một điểm chào đón trung tính của Ninh Bình.",
  },
} satisfies Record<Language, Record<string, string | string[]>>;

const destinations: Destination[] = [
  {
    id: "trang_an",
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
    sourceKeys: ["bai_dinh", "bai_dinh_main_gate"],
    name: { en: "Bai Dinh", vi: "Bái Đính" },
    image: "/images/destinations/bai-dinh.jpg",
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
    sourceKeys: ["tam_coc"],
    name: { en: "Tam Coc", vi: "Tam Cốc" },
    image: "/images/destinations/tam-coc.jpg",
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
];

const paymentMethods = ["Visa", "Mastercard", "JCB", "VietQR", "MoMo", "ZaloPay", "Pay at counter"];
const paymentMethodsVi = ["Visa", "Mastercard", "JCB", "VietQR", "MoMo", "ZaloPay", "Thanh toán tại quầy"];

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
  if (duration === "3h") return [baseStops[0], baseStops[1]];
  if (selected.includes("adventure")) {
    return [baseStops[0], stopFromDestination(destinations.find((d) => d.id === "hang_mua")!, "15:30"), baseStops[3]];
  }
  if (selected.includes("spiritual")) {
    return [baseStops[2], stopFromDestination(destinations.find((d) => d.id === "tam_chuc")!, "15:45"), baseStops[3]];
  }
  if (duration === "2d") {
    return [...baseStops, stopFromDestination(destinations.find((d) => d.id === "cuc_phuong")!, "09:00")];
  }
  return baseStops;
}

export default function NinhBinhLanding({ initialLang, source, presentationMode }: Props) {
  const lang = initialLang;
  const t = copy[lang];
  const [selectedChips, setSelectedChips] = useState<string[]>(["culture", "relaxed", "family"]);
  const [selectedDuration, setSelectedDuration] = useState("1d");
  const [selectedIds, setSelectedIds] = useState<DestinationId[]>([]);
  const [itinerary, setItinerary] = useState<ItineraryStop[]>(baseStops);
  const [loading, setLoading] = useState(false);
  const [detailId, setDetailId] = useState<DestinationId | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  const activeDestinationId = useMemo<DestinationId | "welcome">(() => {
    const normalized = normalizeSource(source);
    return destinations.find((destination) => destination.sourceKeys.includes(normalized))?.id ?? "welcome";
  }, [source]);

  const activeLabel = useMemo(() => {
    if (activeDestinationId === "welcome") return t.welcomePoint as string;
    return destinations.find((destination) => destination.id === activeDestinationId)?.name[lang] ?? (t.welcomePoint as string);
  }, [activeDestinationId, lang, t.welcomePoint]);

  const detailDestination = detailId ? destinations.find((destination) => destination.id === detailId) : null;

  function toggleChip(id: string) {
    setSelectedChips((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function addDestination(id: DestinationId) {
    const destination = destinations.find((item) => item.id === id);
    if (!destination) return;
    setSelectedIds((current) => (current.includes(id) ? current : [...current, id]));
    setItinerary((current) => (current.some((stop) => stop.id === id) ? current : [...current, stopFromDestination(destination)]));
    scrollToId("itinerary");
  }

  function openDetail(id: DestinationId) {
    setDetailId(id);
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
  }

  function removeStop(index: number) {
    setItinerary((current) => current.filter((_, stopIndex) => stopIndex !== index));
  }

  return (
    <main className="min-h-screen bg-[#FBFAF6] text-[#1D2925]">
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
        <div className="absolute inset-x-0 top-0 z-10 mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
          <a href="#top" className="font-display text-xl tracking-[0.16em]">
            NB
          </a>
          <nav aria-label="Primary" className="hidden gap-6 text-sm text-[#FBFAF6]/82 md:flex">
            {(t.nav as string[]).map((item, index) => (
              <a key={item} href={`#${["map", "stories", "ai", "itinerary"][index]}`} className="transition hover:text-[#E7B96A]">
                {item}
              </a>
            ))}
          </nav>
          <div className="flex rounded-full border border-white/25 bg-white/10 p-1 text-sm backdrop-blur">
            <a className={`rounded-full px-3 py-1.5 ${lang === "en" ? "bg-[#FBFAF6] text-[#183F34]" : ""}`} href={buildHref("en", source, presentationMode)}>EN</a>
            <a className={`rounded-full px-3 py-1.5 ${lang === "vi" ? "bg-[#FBFAF6] text-[#183F34]" : ""}`} href={buildHref("vi", source, presentationMode)}>VI</a>
          </div>
        </div>
        <div id="top" className="relative z-10 mx-auto flex min-h-screen max-w-7xl flex-col justify-end px-5 pb-16 pt-28 sm:px-8 lg:pb-24">
          <h1 className="fade-up font-display text-6xl leading-[0.9] text-[#FBFAF6] sm:text-8xl lg:text-[9rem]">{t.title}</h1>
          <p className="fade-up mt-6 max-w-2xl text-xl leading-8 text-[#FBFAF6]/88 sm:text-2xl">{t.subtitle}</p>
          <div className="fade-up mt-9 flex flex-col gap-3 sm:flex-row">
            <button type="button" onClick={() => scrollToId("ai")} className="rounded-full bg-[#E7B96A] px-6 py-3 font-semibold text-[#183F34] shadow-xl shadow-black/20 transition hover:bg-[#f0c87c]">{t.begin}</button>
            <button type="button" onClick={() => scrollToId("map")} className="rounded-full border border-white/35 px-6 py-3 font-semibold text-white transition hover:bg-white/12">{t.exploreMap}</button>
          </div>
        </div>
      </section>

      <section id="map" className="px-5 py-16 sm:px-8 lg:py-24">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.72fr_1.28fr] lg:items-center">
          <div className="reveal-panel">
            <p className="text-sm uppercase tracking-[0.24em] text-[#3F7568]">{t.youAreHere}</p>
            <h2 className="font-display mt-3 text-5xl text-[#183F34] sm:text-6xl">Ninh Bình</h2>
            <div className="mt-6 rounded-[8px] border border-[#A8CEC1]/60 bg-white/80 p-5 shadow-sm">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#6D756F]">{t.qrSource}</p>
              <p className="mt-2 text-xl text-[#183F34]">{activeLabel}</p>
            </div>
            <p className="mt-7 max-w-xl text-lg leading-8 text-[#4d5b55]">{t.mapBody}</p>
            <button type="button" onClick={() => scrollToId("stories")} className="mt-7 rounded-full bg-[#183F34] px-5 py-3 font-semibold text-white">{t.nearby}</button>
          </div>
          <div className="overflow-hidden rounded-[8px] border border-[#A8CEC1]/70 bg-[#F6F1E7] p-3 shadow-xl shadow-[#183F34]/10">
            <TourismMap
              activeDestinationId={activeDestinationId}
              copy={{
                add: t.add as string,
                added: t.added as string,
                discover: t.discover as string,
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
          <p className="text-sm uppercase tracking-[0.24em] text-[#A8CEC1]">{t.stories}</p>
          <h2 className="font-display mt-3 max-w-4xl text-4xl leading-tight sm:text-6xl">{t.storiesIntro}</h2>
          <div className="mt-10 grid gap-6">
            {destinations.map((place, index) => (
              <article id={`destination-${place.id}`} key={place.id} className="story-card group relative min-h-[78vh] overflow-hidden rounded-[8px] bg-[#1D2925] shadow-2xl shadow-black/25">
                <Image src={place.image} alt={place.name[lang]} fill sizes="100vw" className="story-image object-cover opacity-75 transition duration-700 group-hover:scale-[1.035]" style={{ objectPosition: place.imagePosition }} />
                <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(29,41,37,.9),rgba(29,41,37,.45)_48%,rgba(29,41,37,.12)),linear-gradient(180deg,transparent,rgba(29,41,37,.82))]" />
                <div className="relative flex min-h-[78vh] flex-col justify-end p-6 sm:p-10 lg:p-14">
                  <p className="text-xs uppercase tracking-[0.24em] text-[#FBFAF6]/70">{place.coords}</p>
                  <h3 className="font-display mt-4 max-w-4xl text-5xl leading-none sm:text-7xl lg:text-8xl">{place.name[lang]}</h3>
                  <p className="mt-6 max-w-2xl text-xl leading-8 text-[#FBFAF6]/88 sm:text-2xl">{place.tagline[lang]}</p>
                  <p className="mt-4 max-w-2xl leading-7 text-[#FBFAF6]/76">{place.description[lang]}</p>
                  <div className="mt-7 flex flex-wrap gap-2">
                    {place.tags[lang].map((tag) => <span key={tag} className="rounded-full border border-white/24 bg-white/10 px-3 py-1 text-sm backdrop-blur">{tag}</span>)}
                  </div>
                  <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                    <button type="button" onClick={() => openDetail(place.id)} className="rounded-full bg-[#FBFAF6] px-5 py-3 font-semibold text-[#183F34] transition hover:bg-[#E7B96A]">{t.discover}</button>
                    <button type="button" onClick={() => addDestination(place.id)} className="rounded-full border border-white/35 px-5 py-3 font-semibold transition hover:bg-white/12">{selectedIds.includes(place.id) ? t.added : t.add}</button>
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
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-[#3F7568]">{t.companionLabel}</p>
            <h2 className="font-display mt-3 text-4xl text-[#183F34] sm:text-6xl">{t.companionTitle}</h2>
            <p className="mt-5 max-w-xl text-lg leading-8 text-[#4d5b55]">{t.companionBody}</p>
          </div>
          <div className="rounded-[8px] border border-[#A8CEC1]/70 bg-white p-5 shadow-xl shadow-[#183F34]/10">
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
          </div>
        </div>
      </section>

      <section id="itinerary" className="bg-[#F6F1E7] px-5 py-16 sm:px-8 lg:py-24">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1.05fr_.95fr]">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-[#3F7568]">{t.itinerary}</p>
            <h2 className="font-display mt-3 text-4xl text-[#183F34] sm:text-6xl">{t.itinerary}</h2>
            <p className="mt-3 text-[#6D756F]">{t.itineraryNote}</p>
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
                    <button type="button" onClick={() => scrollToId("map")} className="rounded-full border border-[#A8CEC1] px-3 py-2 text-sm text-[#183F34]">{t.directions}</button>
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

      {detailDestination ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#1D2925]/70 px-5 backdrop-blur-sm" role="dialog" aria-modal="true">
          <article className="grid max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-[8px] bg-[#FBFAF6] shadow-2xl md:grid-cols-[1.05fr_.95fr]">
            <div className="relative min-h-80">
              <Image src={detailDestination.image} alt={detailDestination.name[lang]} fill sizes="(min-width: 768px) 50vw, 100vw" className="object-cover" />
            </div>
            <div className="overflow-y-auto p-6">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#3F7568]">{detailDestination.category[lang]} · {detailDestination.duration[lang]}</p>
              <h2 className="font-display mt-3 text-4xl text-[#183F34]">{detailDestination.name[lang]}</h2>
              <p className="mt-4 leading-7 text-[#4d5b55]">{detailDestination.description[lang]}</p>
              <div className="mt-6 rounded-[8px] bg-[#F6F1E7] p-4">
                <h3 className="text-sm font-extrabold uppercase tracking-[0.18em] text-[#3F7568]">{t.historyTitle}</h3>
                <p className="mt-2 leading-7 text-[#1D2925]">{detailDestination.history[lang]}</p>
              </div>
              <div className="mt-5">
                <h3 className="text-sm font-extrabold uppercase tracking-[0.18em] text-[#3F7568]">{t.highlightsTitle}</h3>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {detailDestination.highlights[lang].map((highlight) => (
                    <span key={highlight} className="rounded-[8px] border border-[#A8CEC1]/70 bg-white px-3 py-2 text-sm text-[#183F34]">
                      {highlight}
                    </span>
                  ))}
                </div>
              </div>
              <div className="mt-5 flex flex-wrap gap-2">{detailDestination.tags[lang].map((tag) => <span key={tag} className="rounded-full bg-[#F6F1E7] px-3 py-1 text-sm text-[#3F7568]">{tag}</span>)}</div>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <button type="button" onClick={() => addDestination(detailDestination.id)} className="rounded-full bg-[#183F34] px-5 py-3 font-semibold text-white">{selectedIds.includes(detailDestination.id) ? t.selected : t.add}</button>
                <button type="button" onClick={() => setDetailId(null)} className="rounded-full border border-[#A8CEC1] px-5 py-3 font-semibold text-[#183F34]">{t.detailClose}</button>
              </div>
            </div>
          </article>
        </div>
      ) : null}

      {checkoutOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#1D2925]/70 px-5 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="checkout-title">
          <div className="w-full max-w-lg rounded-[8px] bg-[#FBFAF6] p-6 shadow-2xl">
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
