import { CORE_IDS } from "@/config/experience";

export const REGION_KEY = "region-ninh-binh-demo";

export const NINH_BINH_TOURISM_CORE = {
  id: CORE_IDS.regionId,
  key: REGION_KEY,
  name: "Ninh Bình tourism core",
  scopeType: "tourism-core",
  bounds: {
    south: 20.15,
    west: 105.82,
    north: 20.42,
    east: 106.02,
  },
  center: [20.265, 105.92] as const,
} as const;

export const destinationInterests = [
  "heritage",
  "nature",
  "spirituality",
  "photography",
  "food",
  "family",
] as const;

export type DestinationInterest = (typeof destinationInterests)[number];
export type MobilityLevel = "low" | "moderate" | "high";

type Localized = { vi: string; en: string };

export type DestinationCatalogItem = {
  id: string;
  regionId: string;
  regionKey: typeof REGION_KEY;
  slug: string;
  name: Localized;
  editorialLine: Localized;
  description: Localized;
  story: Localized;
  coordinates: readonly [number, number];
  /**
   * True for a destination the operator runs that lies outside the mapped
   * Ninh Bình tourism core. Tam Chúc is in Hà Nam; pretending otherwise would
   * either move the map's bounds to somewhere nobody calls Ninh Bình, or drop
   * the site the ERP handles most heavily off the public web entirely.
   */
  outsideTourismCore?: boolean;
  suggestedMinutes: number;
  interests: readonly DestinationInterest[];
  mobilityLevel: MobilityLevel;
  mobilityNote: Localized;
  suitableFor: readonly ("children" | "seniors")[];
  demoOpeningWindow: string;
  image: string;
  imageAlt: Localized;
  relatedSlugs: readonly string[];
  source: {
    label: string;
    url: string;
    reviewedAt: string;
  };
};

const nationalTourismGuide =
  "https://vietnamtourism.gov.vn/en/post/20581";
const ninhBinhTourismSource =
  "https://vietnamtourism.gov.vn/en/post/15633";

export const DESTINATIONS: readonly DestinationCatalogItem[] = [
  {
    id: "10000000-0000-4000-8000-000000000001",
    regionId: CORE_IDS.regionId,
    regionKey: REGION_KEY,
    slug: "trang-an",
    name: { vi: "Tràng An", en: "Trang An" },
    editorialLine: {
      vi: "Mặt nước mở từng lớp di sản giữa núi đá vôi.",
      en: "Water reveals layer after layer of heritage among the karsts.",
    },
    description: {
      vi: "Một hành trình thuyền chậm qua thung nước, hang xuyên thủy và các điểm đền phủ trong Quần thể danh thắng Tràng An.",
      en: "A slow boat journey through flooded valleys, water caves and sacred sites within the Trang An Landscape Complex.",
    },
    story: {
      vi: "Tràng An là chương mở đầu giàu cảm xúc của Ninh Bình. Cảnh quan hỗn hợp được UNESCO ghi danh kết nối địa chất karst, khảo cổ và dấu tích văn hóa trong cùng một không gian sông núi.",
      en: "Trang An is Ninh Binh's most evocative opening chapter. The UNESCO-listed mixed landscape brings karst geology, archaeology and cultural traces into one river-and-mountain setting.",
    },
    coordinates: [20.2503, 105.897],
    suggestedMinutes: 180,
    interests: ["heritage", "nature", "photography", "family"],
    mobilityLevel: "low",
    mobilityNote: {
      vi: "Ít đi bộ; cần bước xuống thuyền và ngồi liên tục trong thời gian dài.",
      en: "Low walking; requires stepping into a boat and sitting for an extended period.",
    },
    suitableFor: ["children", "seniors"],
    demoOpeningWindow: "07:00–17:00",
    image: "/images/destinations/trang-an.jpg",
    imageAlt: {
      vi: "Thuyền trên mặt nước giữa núi đá vôi Tràng An",
      en: "Boats on calm water among Trang An limestone karsts",
    },
    relatedSlugs: ["hoa-lu-ancient-capital", "bai-dinh", "tam-coc-bich-dong"],
    source: {
      label: "UNESCO World Heritage Centre — Trang An Landscape Complex",
      url: "https://whc.unesco.org/en/list/1438/",
      reviewedAt: "2026-07-24",
    },
  },
  {
    id: "10000000-0000-4000-8000-000000000002",
    regionId: CORE_IDS.regionId,
    regionKey: REGION_KEY,
    slug: "hoa-lu-ancient-capital",
    name: { vi: "Cố đô Hoa Lư", en: "Hoa Lu Ancient Capital" },
    editorialLine: {
      vi: "Một kinh đô thế kỷ X nằm gọn giữa những vách núi.",
      en: "A tenth-century capital held within a ring of limestone cliffs.",
    },
    description: {
      vi: "Cụm di tích đền vua Đinh, vua Lê và không gian cố đô giúp hành trình Ninh Bình có chiều sâu lịch sử.",
      en: "The temples of the Dinh and Le kings and the former-capital landscape give a Ninh Binh journey historical depth.",
    },
    story: {
      vi: "Hoa Lư từng là kinh đô của nhà nước Đại Cồ Việt. Một điểm dừng có hướng dẫn viên giúp phân biệt rõ lớp cố đô lịch sử với không gian phố cổ đương đại.",
      en: "Hoa Lu was the capital of Dai Co Viet. A guided stop helps distinguish the historic citadel from the contemporary old-town experience.",
    },
    coordinates: [20.2845, 105.9082],
    suggestedMinutes: 90,
    interests: ["heritage", "family"],
    mobilityLevel: "low",
    mobilityNote: {
      vi: "Đường tương đối bằng; có một số bậc và sân lát đá.",
      en: "Mostly level paths with some steps and stone courtyards.",
    },
    suitableFor: ["children", "seniors"],
    demoOpeningWindow: "08:00–17:00",
    image: "/images/destinations/hoa-lu-ancient-capital.png",
    imageAlt: {
      vi: "Cổng và mái đền tại khu Cố đô Hoa Lư",
      en: "Temple gate and roofline at Hoa Lu Ancient Capital",
    },
    relatedSlugs: ["trang-an", "bai-dinh", "hoa-lu-old-town"],
    source: {
      label: "Vietnam National Authority of Tourism — Guide to a Day in Ninh Binh",
      url: nationalTourismGuide,
      reviewedAt: "2026-07-24",
    },
  },
  {
    id: "10000000-0000-4000-8000-000000000003",
    regionId: CORE_IDS.regionId,
    regionKey: REGION_KEY,
    slug: "bai-dinh",
    name: { vi: "Chùa Bái Đính", en: "Bai Dinh Pagoda" },
    editorialLine: {
      vi: "Chuông, hành lang đá và nhịp đi chậm trên sườn núi.",
      en: "Bells, stone corridors and a measured hillside rhythm.",
    },
    description: {
      vi: "Một quần thể tâm linh quy mô lớn kết nối không gian chùa cổ, kiến trúc mới và các tầm nhìn rộng.",
      en: "A large spiritual complex connecting an older sacred site, newer architecture and expansive views.",
    },
    story: {
      vi: "Bái Đính tạo khoảng lặng tâm linh cho tuyến di sản. Quy mô khuôn viên khiến việc chọn xe điện và giới hạn quãng đi bộ đặc biệt quan trọng với gia đình nhiều thế hệ.",
      en: "Bai Dinh adds a contemplative pause to the heritage route. Its scale makes electric-cart use and walking limits especially important for multigenerational groups.",
    },
    coordinates: [20.2768, 105.8656],
    suggestedMinutes: 150,
    interests: ["spirituality", "heritage", "family"],
    mobilityLevel: "moderate",
    mobilityNote: {
      vi: "Khuôn viên rộng; nên dùng xe điện và chọn tuyến ngắn cho người lớn tuổi.",
      en: "Large grounds; use the electric cart and a shorter route for older visitors.",
    },
    suitableFor: ["children", "seniors"],
    demoOpeningWindow: "08:00–18:00",
    image: "/images/destinations/editorial/bai-dinh-editorial.png",
    imageAlt: {
      vi: "Mái chùa và hành lang trong quần thể Bái Đính",
      en: "Pagoda roofs and corridors in the Bai Dinh complex",
    },
    relatedSlugs: ["trang-an", "hoa-lu-ancient-capital", "van-long"],
    source: {
      label: "Vietnam National Authority of Tourism — Ninh Binh in spring",
      url: ninhBinhTourismSource,
      reviewedAt: "2026-07-24",
    },
  },
  {
    id: "10000000-0000-4000-8000-000000000004",
    regionId: CORE_IDS.regionId,
    regionKey: REGION_KEY,
    slug: "hoa-lu-old-town",
    name: { vi: "Phố cổ Hoa Lư", en: "Hoa Lu Old Town" },
    editorialLine: {
      vi: "Đèn lồng và mặt nước cho một chương buổi tối nhẹ.",
      en: "Lantern light and reflections for an easy evening chapter.",
    },
    description: {
      vi: "Không gian trải nghiệm đương đại bên hồ với phố đi bộ, ẩm thực và thuyền đèn lồng.",
      en: "A contemporary lakeside experience with walking streets, food and lantern boats.",
    },
    story: {
      vi: "Phố cổ phù hợp để kết ngày mà không thêm một chặng di chuyển xa. Đây là không gian văn hóa đương đại, không phải khu Cố đô Hoa Lư lịch sử.",
      en: "The old town is an easy way to close the day without another long transfer. It is a contemporary cultural space, not the historic Hoa Lu citadel.",
    },
    coordinates: [20.2579, 105.9741],
    suggestedMinutes: 90,
    interests: ["food", "family", "photography"],
    mobilityLevel: "low",
    mobilityNote: {
      vi: "Phù hợp dạo bộ nhẹ; có thể nghỉ thường xuyên quanh hồ.",
      en: "Suitable for gentle walking with frequent places to rest around the lake.",
    },
    suitableFor: ["children", "seniors"],
    demoOpeningWindow: "18:00–22:00",
    image: "/images/destinations/hoa-lu-old-town.jpg",
    imageAlt: {
      vi: "Đèn lồng phản chiếu trên mặt nước tại Phố cổ Hoa Lư",
      en: "Lanterns reflected on the water at Hoa Lu Old Town",
    },
    relatedSlugs: ["hoa-lu-ancient-capital", "trang-an", "hang-mua"],
    source: {
      label: "DestinationOS editorial review — demonstration information",
      url: "https://vietnamtourism.gov.vn/en/post/20581",
      reviewedAt: "2026-07-24",
    },
  },
  {
    id: "10000000-0000-4000-8000-000000000005",
    regionId: CORE_IDS.regionId,
    regionKey: REGION_KEY,
    slug: "tam-coc-bich-dong",
    name: { vi: "Tam Cốc – Bích Động", en: "Tam Coc – Bich Dong" },
    editorialLine: {
      vi: "Dòng Ngô Đồng đi qua đồng lúa và ba hang núi.",
      en: "The Ngo Dong River slips through rice fields and three caves.",
    },
    description: {
      vi: "Tuyến thuyền làng quê kết hợp dễ dàng với chùa Bích Động và những nhịp đạp xe ngắn.",
      en: "A countryside boat route that pairs naturally with Bich Dong Pagoda and short cycling loops.",
    },
    story: {
      vi: "Tam Cốc mang chất làng quê rõ hơn Tràng An: thuyền thấp, đồng lúa theo mùa và đời sống ven sông. Bích Động thêm một lớp tâm linh gần gũi trên sườn núi.",
      en: "Tam Coc feels more rural than Trang An, with low boats, seasonal rice and riverside life. Bich Dong adds an intimate spiritual layer on the mountainside.",
    },
    coordinates: [20.2169, 105.9368],
    suggestedMinutes: 150,
    interests: ["nature", "photography", "family", "spirituality"],
    mobilityLevel: "low",
    mobilityNote: {
      vi: "Tuyến thuyền ít đi bộ; phần Bích Động có bậc đá và mặt đường không đều.",
      en: "The boat route is low-walking; Bich Dong includes stone steps and uneven surfaces.",
    },
    suitableFor: ["children", "seniors"],
    demoOpeningWindow: "07:00–17:00",
    image: "/images/destinations/editorial/tam-coc-editorial.png",
    imageAlt: {
      vi: "Thuyền đi giữa đồng lúa và núi đá tại Tam Cốc",
      en: "Boats moving through rice fields and karsts at Tam Coc",
    },
    relatedSlugs: ["hang-mua", "thung-nham", "trang-an"],
    source: {
      label: "Vietnam National Authority of Tourism — Guide to a Day in Ninh Binh",
      url: nationalTourismGuide,
      reviewedAt: "2026-07-24",
    },
  },
  {
    id: "10000000-0000-4000-8000-000000000006",
    regionId: CORE_IDS.regionId,
    regionKey: REGION_KEY,
    slug: "hang-mua",
    name: { vi: "Hang Múa", en: "Hang Mua" },
    editorialLine: {
      vi: "Độ cao làm lộ rõ đường sông và sống núi.",
      en: "Height reveals the river bends and limestone ridges.",
    },
    description: {
      vi: "Điểm ngắm cảnh với tuyến bậc đá dốc mở ra tầm nhìn xuống Tam Cốc và các thung lũng lân cận.",
      en: "A steep stepped viewpoint opening onto Tam Coc and the surrounding limestone valleys.",
    },
    story: {
      vi: "Hang Múa cho hành trình một góc nhìn toàn cảnh nhưng đòi hỏi thể lực và thời tiết phù hợp. Đây không phải lựa chọn mặc định cho yêu cầu ít đi bộ.",
      en: "Hang Mua provides a defining panorama but requires fitness and suitable weather. It is not a default choice for low-walking requests.",
    },
    coordinates: [20.229, 105.9361],
    suggestedMinutes: 120,
    interests: ["nature", "photography"],
    mobilityLevel: "high",
    mobilityNote: {
      vi: "Nhiều bậc đá dốc, ít bóng râm; không phù hợp người hạn chế vận động.",
      en: "Many steep stone steps with little shade; unsuitable for mobility-limited visitors.",
    },
    suitableFor: [],
    demoOpeningWindow: "07:00–18:00",
    image: "/images/destinations/hang-mua.png",
    imageAlt: {
      vi: "Tầm nhìn từ Hang Múa xuống đồng lúa và sông Ngô Đồng",
      en: "View from Hang Mua over rice fields and the Ngo Dong River",
    },
    relatedSlugs: ["tam-coc-bich-dong", "hoa-lu-old-town", "thung-nham"],
    source: {
      label: "Vietnam National Authority of Tourism — Ninh Binh in spring",
      url: ninhBinhTourismSource,
      reviewedAt: "2026-07-24",
    },
  },
  {
    id: "10000000-0000-4000-8000-000000000007",
    regionId: CORE_IDS.regionId,
    regionKey: REGION_KEY,
    slug: "thung-nham",
    name: { vi: "Thung Nham", en: "Thung Nham" },
    editorialLine: {
      vi: "Mặt nước, lau sậy và nhịp chim về tổ cuối ngày.",
      en: "Water, reeds and the evening rhythm of returning birds.",
    },
    description: {
      vi: "Một nhánh thiên nhiên yên hơn phía tây Tam Cốc, phù hợp buổi chiều chậm và quan sát chim.",
      en: "A quieter nature branch west of Tam Coc, suited to a slow afternoon and birdwatching.",
    },
    story: {
      vi: "Thung Nham giúp hành trình giảm nhịp sau các điểm di sản đông khách. Trải nghiệm đẹp nhất phụ thuộc thời điểm và cần giữ tiếng nhỏ gần sinh cảnh chim.",
      en: "Thung Nham lets a journey decompress after busier heritage sites. Its best moments are time-dependent and quiet behavior matters around bird habitats.",
    },
    coordinates: [20.2136, 105.9027],
    suggestedMinutes: 150,
    interests: ["nature", "photography", "family"],
    mobilityLevel: "moderate",
    mobilityNote: {
      vi: "Có đoạn đi bộ và lên xuống thuyền; nên chọn tuyến ngắn cho người lớn tuổi.",
      en: "Includes walking and boat access; choose a shorter route for older visitors.",
    },
    suitableFor: ["children", "seniors"],
    demoOpeningWindow: "08:00–18:00",
    image: "/images/destinations/thung-nham.png",
    imageAlt: {
      vi: "Mặt nước và núi đá trong vùng sinh thái Thung Nham",
      en: "Water and limestone landscape in the Thung Nham ecological area",
    },
    relatedSlugs: ["tam-coc-bich-dong", "hang-mua", "trang-an"],
    source: {
      label: "DestinationOS editorial review — demonstration information",
      url: nationalTourismGuide,
      reviewedAt: "2026-07-24",
    },
  },
  {
    id: "10000000-0000-4000-8000-000000000008",
    regionId: CORE_IDS.regionId,
    regionKey: REGION_KEY,
    slug: "van-long",
    name: { vi: "Đầm Vân Long", en: "Van Long Wetland" },
    editorialLine: {
      vi: "Một mặt gương phẳng, chậm và ít phô diễn.",
      en: "A quiet mirror of water with an unhurried sense of place.",
    },
    description: {
      vi: "Khu đất ngập nước với thuyền nan, vách núi phản chiếu và giá trị bảo tồn thiên nhiên.",
      en: "A wetland landscape of bamboo boats, reflected cliffs and significant conservation value.",
    },
    story: {
      vi: "Vân Long phù hợp người tìm sự tĩnh lặng và một tuyến thuyền nhẹ. Hành trình nên tôn trọng sinh cảnh, không hứa trước việc quan sát động vật hoang dã.",
      en: "Van Long suits travelers seeking quiet and a gentle boat route. A responsible visit respects habitats and never guarantees wildlife sightings.",
    },
    coordinates: [20.3636, 105.8773],
    suggestedMinutes: 120,
    interests: ["nature", "photography", "family"],
    mobilityLevel: "low",
    mobilityNote: {
      vi: "Ít đi bộ; cần bước vào thuyền nan thấp.",
      en: "Low walking; requires stepping into a low bamboo boat.",
    },
    suitableFor: ["children", "seniors"],
    demoOpeningWindow: "07:00–17:00",
    image: "/images/destinations/van-long.png",
    imageAlt: {
      vi: "Thuyền nan trên vùng đất ngập nước Vân Long",
      en: "Bamboo boat on the Van Long wetland",
    },
    relatedSlugs: ["bai-dinh", "trang-an", "hoa-lu-ancient-capital"],
    source: {
      label: "Vietnam National Authority of Tourism — Back to nature at Van Long",
      url: "https://vietnamtourism.gov.vn/en/post/9342",
      reviewedAt: "2026-07-24",
    },
  },
  {
    // W3: Tam Chúc is the site the ERP handles most heavily -- its own manager,
    // its own incidents, its own shift closes -- and it appeared nowhere on the
    // visitor-facing web. A client comparing the two screens found a place the
    // internal system runs and the public one denies exists. It sits in Hà Nam
    // rather than Ninh Bình, which the copy says outright instead of quietly
    // absorbing it into the region.
    id: "10000000-0000-4000-8000-000000000009",
    regionId: CORE_IDS.regionId,
    regionKey: REGION_KEY,
    slug: "tam-chuc",
    name: { vi: "Khu du lịch Tam Chúc", en: "Tam Chuc Complex" },
    editorialLine: {
      vi: "Quy mô rất lớn, mặt hồ rộng và nhịp đi bộ dài.",
      en: "Vast scale, an open lake and a long walking rhythm.",
    },
    description: {
      vi: "Quần thể tâm linh quy mô lớn bên hồ, thuộc tỉnh Hà Nam, cách trung tâm Ninh Bình khoảng một giờ xe.",
      en: "A large lakeside spiritual complex in Ha Nam province, about an hour by road from central Ninh Binh.",
    },
    story: {
      vi: "Tam Chúc thường được ghép cùng Bái Đính thành một ngày trọn vẹn. Khoảng cách giữa các điện lớn nên hãy tính trước thời gian đi bộ và xe điện, nhất là vào mùa lễ hội.",
      en: "Tam Chuc is usually paired with Bai Dinh to fill a full day. The halls stand far apart, so plan for walking time and the shuttle, especially in festival season.",
    },
    coordinates: [20.5579, 105.7817],
    outsideTourismCore: true,
    suggestedMinutes: 210,
    interests: ["heritage", "photography", "family"],
    mobilityLevel: "moderate",
    mobilityNote: {
      vi: "Quãng đi bộ dài và nhiều bậc; nên dùng xe điện và bố trí điểm nghỉ cho người lớn tuổi.",
      en: "Long distances and many steps; use the shuttle and plan rest stops for older visitors.",
    },
    suitableFor: ["children", "seniors"],
    demoOpeningWindow: "06:00–18:00",
    image: "/images/destinations/tam-chuc.jpg",
    imageAlt: {
      vi: "Quần thể chùa Tam Chúc bên mặt hồ",
      en: "The Tam Chuc pagoda complex beside its lake",
    },
    relatedSlugs: ["bai-dinh", "trang-an", "hoa-lu-ancient-capital"],
    source: {
      label: "DestinationOS editorial review — demonstration information",
      url: nationalTourismGuide,
      reviewedAt: "2026-08-02",
    },
  },
] as const;

export function getDestinationBySlug(slug: string) {
  return DESTINATIONS.find((destination) => destination.slug === slug);
}
