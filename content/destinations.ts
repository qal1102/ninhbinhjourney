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
  /**
   * Báo chí và tổ chức đã viết về điểm đến này.
   *
   * Luật bắt buộc, đừng phá:
   * - Chỉ thêm mục mà người thêm đã **tự đọc tận nơi**. Không chép lại lời
   *   trích của một bài khác rồi ghi nguồn là tờ gốc.
   * - `verbatim: true` chỉ khi `text` là **nguyên văn từng chữ**. Giao diện
   *   sẽ đặt câu đó trong ngoặc kép. Diễn giải lại mà để `verbatim: true`
   *   là bịa lời cho tờ báo.
   * - `verbatim: false` dùng cho sự thật đã kiểm chứng nhưng không lấy được
   *   nguyên văn (ví dụ trang gốc chặn truy cập). Giao diện sẽ **không**
   *   đóng ngoặc kép.
   * - `via` bắt buộc khi không đọc được bản gốc mà phải qua một tờ khác.
   */
  press?: readonly {
    text: Localized;
    verbatim: boolean;
    publisher: string;
    year: number;
    url: string;
    via?: { label: string; url: string };
  }[];
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
      vi: "Tràng An là chương mở đầu của Ninh Bình — nơi đá vôi hàng triệu năm tuổi, dấu chân người ở từ thời tiền sử và mái đền cổ cùng nằm trong một khung cảnh sông núi. Không phải ngẫu nhiên UNESCO gọi đây là di sản kép: vừa của tự nhiên, vừa của con người.",
      en: "Trang An is Ninh Binh's opening chapter — where limestone millions of years old, traces of prehistoric settlement and old temple roofs all sit inside one river-and-mountain scene. UNESCO did not call this a dual heritage site by accident: both natural and human-made.",
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
    press: [
      {
        // Không đặt trong ngoặc kép: trang UNESCO trả 403 khi truy cập nên
        // chưa lấy được nguyên văn phần Outstanding Universal Value. Các dữ
        // kiện dưới đây đối chiếu khớp qua nhiều nguồn thứ cấp.
        text: {
          vi: "Được ghi danh năm 2014 là Di sản Thế giới hỗn hợp — vừa văn hóa vừa thiên nhiên — theo ba tiêu chí (v), (vii) và (viii). Vùng lõi rộng 6.172 ha, và các hang động ở đây lưu dấu người ở liên tục suốt hơn 30.000 năm.",
          en: "Inscribed in 2014 as a mixed World Heritage property — both cultural and natural — under criteria (v), (vii) and (viii). The core zone covers 6,172 ha, and its caves hold traces of continuous human occupation spanning more than 30,000 years.",
        },
        verbatim: false,
        publisher: "UNESCO World Heritage Centre",
        year: 2014,
        url: "https://whc.unesco.org/en/list/1438/",
      },
      {
        text: {
          vi: "Nơi này đang nổi lên trên mạng xã hội, nên sẽ không còn là viên ngọc giấu kín được lâu nữa. Hãy đi khi nó vẫn còn cho ta một trải nghiệm miền Bắc Việt Nam rất thật.",
          en: "It's rising in popularity on social media, so it won't stay a hidden gem for too long. Go while it still offers a very authentic northern Vietnam experience.",
        },
        verbatim: true,
        publisher: "Forbes — 23 best places to travel this year",
        year: 2023,
        url: "https://www.forbes.com/",
        via: {
          label: "VnExpress International, 02/04/2023",
          url: "https://e.vnexpress.net/news/places/ninh-binh-one-of-the-best-places-to-visit-this-year-forbes-4588091.html",
        },
      },
    ],
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
      vi: "Đền vua Đinh và đền vua Lê đứng lặng giữa vòng núi đá, giữ nguyên trục thần đạo từ hơn nghìn năm trước.",
      en: "The temples of King Dinh and King Le stand quietly inside a ring of limestone, keeping the same sacred axis laid out more than a thousand years ago.",
    },
    story: {
      vi: "Hoa Lư từng là kinh đô của nhà nước Đại Cồ Việt — triều đại độc lập đầu tiên sau nghìn năm Bắc thuộc. Đi cùng người hiểu chuyện sẽ dễ tách bạch: đâu là cố đô nghìn năm, đâu là phố cổ mới dựng gần đây.",
      en: "Hoa Lu was once the capital of Dai Co Viet — the first independent state after a thousand years under Chinese rule. Going with someone who knows the story makes it easy to tell apart: which parts are the thousand-year-old citadel, and which are the old town built more recently.",
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
    press: [
      {
        // Không ngoặc kép: chưa lấy được nguyên văn hồ sơ UNESCO (trang gốc
        // trả 403). Dữ kiện "Cố đô Hoa Lư là một trong ba khu bảo vệ nằm
        // trong vùng di sản Tràng An" đối chiếu khớp qua nhiều nguồn.
        text: {
          vi: "Cố đô Hoa Lư là một trong ba khu bảo vệ nằm trong Quần thể danh thắng Tràng An — di sản được UNESCO ghi danh năm 2014. Nói cách khác, kinh thành cũ và vùng núi đá quanh nó được thế giới công nhận như một chỉnh thể, không tách rời.",
          en: "The Hoa Lu Ancient Capital is one of three protected areas inside the Trang An Landscape Complex, inscribed by UNESCO in 2014. The old citadel and the limestone country around it are recognised as one whole, not as separate things.",
        },
        verbatim: false,
        publisher: "UNESCO World Heritage Centre",
        year: 2014,
        url: "https://whc.unesco.org/en/list/1438/",
      },
    ],
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
      vi: "Chuông chùa cổ vọng cạnh những mái ngói mới dựng, và nhìn xuống từ hành lang cao là cả một vùng núi mở ra trước mắt.",
      en: "An old temple bell echoes beside newly built roofs, and from the high corridor the whole mountain range opens out below.",
    },
    story: {
      vi: "Bái Đính là khoảng lặng giữa hành trình di sản — chỗ để chậm lại, thắp một nén nhang, rồi đi tiếp. Khuôn viên trải rất rộng, nên với gia đình có ông bà đi cùng, xe điện là lựa chọn nên tính trước.",
      en: "Bai Dinh is a pause inside the heritage route — a place to slow down, light incense, then move on. The grounds stretch wide, so for families travelling with grandparents, the electric cart is worth planning ahead for.",
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
      vi: "Phố đi bộ ven hồ, quán ăn đèn vàng và thuyền đèn lồng trôi chậm trên mặt nước khi trời vừa tắt nắng.",
      en: "A lakeside walking street, lantern-lit food stalls, and boats drifting slowly on the water as the sun goes down.",
    },
    story: {
      vi: "Đây là điểm khép một ngày nhẹ nhàng, không cần thêm một chặng xe nào nữa. Xin nói rõ: đây là khu văn hóa mới dựng, khác với Cố đô Hoa Lư nghìn năm tuổi ở gần đó — tên gọi giống nhau, nhưng là hai câu chuyện khác nhau.",
      en: "This is a gentle way to close the day, no further transfer needed. To be clear: this is a newly built cultural quarter, not the thousand-year-old Hoa Lu Ancient Capital nearby — the names sound alike, but they are two different stories.",
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
      vi: "Thuyền len qua đồng lúa và ba hang núi, rồi ghé chùa Bích Động trên sườn đá — cả tuyến đi vừa một buổi, thêm dăm vòng xe đạp quanh làng.",
      en: "The boat winds through rice fields and three caves, then stops at Bich Dong Pagoda on the hillside — the whole route fits a morning, with a few laps by bicycle around the village.",
    },
    story: {
      vi: "So với Tràng An, Tam Cốc mang hơi thở làng quê rõ hơn: thuyền be bé, đồng lúa đổi màu theo mùa, và người dân vẫn sống ngay bên bờ sông. Bích Động góp thêm một khoảng tĩnh tâm linh, nép mình trên sườn núi đá.",
      en: "Compared with Trang An, Tam Coc feels more like the countryside: small boats, rice fields that change colour with the season, and people still living right along the riverbank. Bich Dong adds a quiet spiritual pause, tucked into the hillside.",
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
    press: [
      {
        // Không ngoặc kép: chưa lấy được nguyên văn hồ sơ UNESCO (403).
        text: {
          vi: "Khu danh thắng Tràng An – Tam Cốc – Bích Động nằm trong vùng di sản được UNESCO ghi danh năm 2014, và là di tích quốc gia đặc biệt.",
          en: "The Trang An–Tam Coc–Bich Dong scenic area lies within the UNESCO property inscribed in 2014, and is a special national monument.",
        },
        verbatim: false,
        publisher: "UNESCO World Heritage Centre",
        year: 2014,
        url: "https://whc.unesco.org/en/list/1438/",
      },
    ],
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
      vi: "Bậc đá dốc leo dần lên đỉnh, và đến nơi là cả Tam Cốc cùng những thung lũng lân cận trải ra dưới chân.",
      en: "Steep stone steps climb toward the summit, and at the top, Tam Coc and the surrounding valleys spread out below.",
    },
    story: {
      vi: "Hang Múa đổi lại một tầm nhìn hiếm có bằng vài trăm bậc đá dưới nắng — xứng đáng, nhưng cần sức và cần trời quang. Với người muốn đi ít, đây không phải điểm nên chọn trước.",
      en: "Hang Mua trades a rare view for a few hundred stone steps under the sun — worth it, but it takes stamina and clear weather. For those who prefer to walk less, this is not the place to start with.",
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
      vi: "Lau sậy và mặt nước yên tĩnh phía tây Tam Cốc — một buổi chiều chậm rãi, dành cho ai muốn ngồi lặng ngắm chim về tổ.",
      en: "Reeds and quiet water west of Tam Coc — a slow afternoon, for anyone who wants to sit still and watch the birds come home.",
    },
    story: {
      vi: "Sau những điểm di sản đông người, Thung Nham là chỗ để hạ nhịp thở. Đến đúng lúc chim về mới trọn vẹn, và gần khu sinh cảnh thì nên đi khẽ, nói khẽ.",
      en: "After the busier heritage sites, Thung Nham is where the pace drops. It is best timed to when the birds return, and near the habitat, footsteps and voices should stay soft.",
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
      vi: "Thuyền nan lướt nhẹ qua mặt nước phẳng như gương, vách núi soi bóng ngược, và cả vùng đầm này là đất bảo tồn.",
      en: "A bamboo boat glides over water flat as a mirror, the cliffs reflected upside down, and the whole wetland is protected land.",
    },
    story: {
      vi: "Vân Long dành cho người muốn một buổi sáng thật tĩnh, chỉ có tiếng mái chèo khua nước. Đây là đất của voọc mông trắng và nhiều loài chim quý, nhưng gặp được hay không còn tùy duyên — không ai hứa trước điều đó.",
      en: "Van Long is for those who want a truly still morning, with only the sound of the paddle in the water. This is home to the white-rumped langur and many rare birds, but seeing them is a matter of chance — nobody can promise that in advance.",
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
