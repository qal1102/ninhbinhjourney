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
  /**
   * Mốc lịch sử cho các điểm đến có bề dày lịch sử thật (Tràng An, Cố đô
   * Hoa Lư, Bái Đính) — dựng thành dòng thời gian tương tác trên trang chi
   * tiết thay vì một đoạn văn phẳng. Chỉ thêm mốc đã kiểm chứng qua nguồn
   * đáng tin (giống luật của `press`), không suy đoán ngày tháng.
   */
  timeline?: readonly {
    year: Localized;
    label: Localized;
    detail: Localized;
  }[];
  /**
   * Giới hạn thật, nói thẳng — không phải đồng hồ đếm ngược giả hay ô
   * "chỉ còn N chỗ" bịa ra. Chỉ điền khi có một ràng buộc vật lý/mùa vụ
   * thật và đã kiểm chứng (giống luật của `press`): số khách mỗi thuyền,
   * mùa dễ gặp động vật hoang dã. Không thêm cho đủ số điểm đến.
   */
  realLimit?: Localized;
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
      vi: "Ngồi thuyền luồn hang giữa núi đá vôi.",
      en: "Water reveals layer after layer of heritage among the karsts.",
    },
    description: {
      vi: "Thuyền chèo tay đi qua các thung nước, hang xuyên núi và ghé những đền phủ trong Quần thể danh thắng Tràng An.",
      en: "A slow boat journey through flooded valleys, water caves and sacred sites within the Trang An Landscape Complex.",
    },
    story: {
      vi: "Tràng An là nơi hầu hết khách bắt đầu chuyến Ninh Bình. Núi đá vôi ở đây đã hàng triệu năm tuổi, trong hang còn dấu vết người thời tiền sử, ven sông có đền cổ. Vì thế UNESCO công nhận Tràng An là di sản kép, cả về thiên nhiên lẫn văn hoá.",
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
          vi: "Được ghi danh năm 2014 là Di sản Thế giới hỗn hợp, cả văn hoá lẫn thiên nhiên, theo ba tiêu chí (v), (vii) và (viii). Vùng lõi rộng 6.172 ha, và các hang động ở đây lưu dấu người ở liên tục suốt hơn 30.000 năm.",
          en: "Inscribed in 2014 as a mixed World Heritage property — both cultural and natural — under criteria (v), (vii) and (viii). The core zone covers 6,172 ha, and its caves hold traces of continuous human occupation spanning more than 30,000 years.",
        },
        verbatim: false,
        publisher: "UNESCO World Heritage Centre",
        year: 2014,
        url: "https://whc.unesco.org/en/list/1438/",
      },
      {
        text: {
          vi: "Nơi này đang nổi trên mạng xã hội, chẳng bao lâu nữa sẽ hết vắng. Nên đi sớm, khi còn thấy được một miền Bắc Việt Nam rất thật.",
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
    timeline: [
      {
        year: { vi: "Hơn 30.000 năm trước", en: "More than 30,000 years ago" },
        label: { vi: "Người ở trong hang đá", en: "People sheltering in the caves" },
        detail: {
          vi: "Các hang trong lòng Tràng An còn dấu tích người ở liên tục, nhiều thế hệ nối nhau sống giữa vùng núi đá này.",
          en: "The caves inside Trang An hold traces of continuous human presence — not a single stopover, but generations living among these limestone mountains one after another.",
        },
      },
      {
        year: { vi: "Thế kỷ X", en: "10th century" },
        label: { vi: "Kinh đô nằm trong lòng núi", en: "A capital held inside the mountains" },
        detail: {
          vi: "Cố đô Hoa Lư, kinh đô đầu tiên của nhà nước phong kiến tập quyền Đại Cồ Việt, nằm ngay trong ranh giới Tràng An và là một trong ba khu được bảo vệ của quần thể.",
          en: "The core zone of Hoa Lu Ancient Capital — the first capital of the centralized feudal state of Dai Co Viet — sits inside Trang An's boundary, one of the complex's three protected areas.",
        },
      },
      {
        year: { vi: "2014", en: "2014" },
        label: { vi: "UNESCO ghi danh di sản kép", en: "UNESCO inscribes a dual heritage" },
        detail: {
          vi: "Tràng An trở thành Di sản Thế giới hỗn hợp, thuộc số ít nơi trên thế giới được công nhận cả về văn hoá lẫn thiên nhiên.",
          en: "Trang An becomes a mixed World Heritage property — both cultural and natural — one of the few places worldwide recognised under both categories at once.",
        },
      },
    ],
    realLimit: {
      vi: "Mỗi thuyền chở tối đa 4 khách, chèo tay theo một tuyến cố định, ai tới trước đi trước. Sáng cao điểm thường phải xếp hàng ở bến khá lâu.",
      en: "Each boat carries up to 4 passengers, hand-rowed along a single fixed river route — there is no fast lane. Morning peak hours mean a real queue at the dock, not a staged one.",
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
      vi: "Đền vua Đinh và đền vua Lê nằm giữa vòng núi đá, vẫn giữ trục thần đạo từ hơn nghìn năm trước.",
      en: "The temples of King Dinh and King Le stand quietly inside a ring of limestone, keeping the same sacred axis laid out more than a thousand years ago.",
    },
    story: {
      vi: "Hoa Lư từng là kinh đô nước Đại Cồ Việt, triều đại độc lập đầu tiên sau nghìn năm Bắc thuộc. Nên đi cùng người rành chuyện, để khỏi lẫn cố đô nghìn năm với phố cổ mới dựng gần đây.",
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
          vi: "Cố đô Hoa Lư là một trong ba khu bảo vệ của Quần thể danh thắng Tràng An, được UNESCO ghi danh năm 2014. Kinh thành cũ và vùng núi đá quanh nó được công nhận chung làm một.",
          en: "The Hoa Lu Ancient Capital is one of three protected areas inside the Trang An Landscape Complex, inscribed by UNESCO in 2014. The old citadel and the limestone country around it are recognised as one whole, not as separate things.",
        },
        verbatim: false,
        publisher: "UNESCO World Heritage Centre",
        year: 2014,
        url: "https://whc.unesco.org/en/list/1438/",
      },
    ],
    timeline: [
      {
        year: { vi: "968", en: "968" },
        label: { vi: "Đinh Bộ Lĩnh lập kinh đô", en: "Dinh Bo Linh founds the capital" },
        detail: {
          vi: "Dẹp xong loạn 12 sứ quân, Đinh Bộ Lĩnh lên ngôi hoàng đế, đặt tên nước là Đại Cồ Việt và chọn Hoa Lư làm kinh đô, vì núi non quanh đây bọc kín như một toà thành.",
          en: "After putting down the rebellion of the 12 warlords, Dinh Bo Linh crowned himself emperor, named the country Dai Co Viet, and chose Hoa Lu — ringed by mountains like a natural citadel — as the capital.",
        },
      },
      {
        year: { vi: "968–1010", en: "968–1010" },
        label: { vi: "42 năm, ba triều đại", en: "42 years, three dynasties" },
        detail: {
          vi: "Hoa Lư là trung tâm quyền lực qua nhà Đinh, nhà Tiền Lê và những năm đầu nhà Lý. Từ đây, các vua thống nhất đất nước, đánh quân Tống, dẹp Chiêm Thành.",
          en: "Hoa Lu remained the seat of power through the Dinh, Earlier Le and early Ly dynasties — witnessing national unification, resistance against the Song and campaigns against Champa.",
        },
      },
      {
        year: { vi: "1010", en: "1010" },
        label: { vi: "Lý Thái Tổ dời đô", en: "Ly Thai To moves the capital" },
        detail: {
          vi: "Thấy Hoa Lư quá chật để thành một đô thị lớn, Lý Thái Tổ dời đô ra Thăng Long. Từ đó Hoa Lư thành cố đô, thôi là trung tâm nhưng vẫn giữ trục thần đạo.",
          en: "Recognising that Hoa Lu was too cramped to grow into a proper capital city, Ly Thai To moved the seat of power to Thang Long. Hoa Lu became the former capital from then on — no longer the center, but keeping the same sacred axis.",
        },
      },
      {
        year: { vi: "2014", en: "2014" },
        label: { vi: "UNESCO ghi danh cùng Tràng An", en: "UNESCO inscription, alongside Trang An" },
        detail: {
          vi: "Cố đô Hoa Lư trở thành một trong ba khu bảo vệ của Quần thể danh thắng Tràng An, Di sản Thế giới hỗn hợp cả văn hoá lẫn thiên nhiên.",
          en: "Hoa Lu Ancient Capital becomes one of three protected areas within the Trang An Landscape Complex — a mixed World Heritage property, both cultural and natural.",
        },
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
      vi: "Chùa cổ trên núi, chùa mới dưới chân núi.",
      en: "Bells, stone corridors and a measured hillside rhythm.",
    },
    description: {
      vi: "Chùa cổ nằm trên núi, chùa mới dựng dưới chân. Đứng trên hành lang cao nhìn xuống là thấy cả một vùng núi.",
      en: "An old temple bell echoes beside newly built roofs, and from the high corridor the whole mountain range opens out below.",
    },
    story: {
      vi: "Nhiều người ghé Bái Đính để thắp nén nhang giữa chuyến đi. Khuôn viên rất rộng, nếu đi cùng ông bà thì nên tính trước chuyện đi xe điện.",
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
    press: [
      {
        text: {
          vi: "Hành lang La Hán dài gần 3 km, được công nhận dài nhất châu Á, có 500 pho tượng La Hán tạc bằng đá nguyên khối, cao từ 1,5 đến 2 mét.",
          en: "The Arhat corridor stretches nearly 3 kilometers, making it the longest Arhat corridor in Asia, holding 500 monolithic Arhat statues ranging from 1.5 to 2 meters in height.",
        },
        verbatim: false,
        publisher: "Vietnam Airlines — Travel Guide",
        year: 2026,
        url: "https://www.vietnamairlines.com/us/en/plan-book/travel/travel-guide/bai-dinh-pagoda",
      },
    ],
    timeline: [
      {
        year: { vi: "1136", en: "1136" },
        label: { vi: "Quốc sư lập chùa trong hang núi", en: "A royal monk founds a cave temple" },
        detail: {
          vi: "Thiền sư Nguyễn Minh Không, quốc sư nhà Lý, trong lúc đi tìm thuốc chữa bệnh cho vua đã gặp một hang động trên núi Đính, rồi lập chùa, tạc tượng thờ Phật ở đó.",
          en: "Zen master Nguyen Minh Khong — a royal preceptor of the Ly dynasty — found a cave on Mount Dinh while searching for medicine to treat the king, and chose the spot to found a temple and carve Buddha statues.",
        },
      },
      {
        year: { vi: "2003", en: "2003" },
        label: { vi: "Khởi công quần thể mới", en: "Construction of the new complex begins" },
        detail: {
          vi: "Cạnh chùa cổ trong hang, người ta khởi công một quần thể chùa mới lớn hơn nhiều lần. Chùa cổ vẫn được giữ nguyên.",
          en: "Beside the old cave temple, a much larger new complex broke ground — while the ancient temple was kept intact as the starting point of the whole story.",
        },
      },
      {
        year: { vi: "2012", en: "2012" },
        label: { vi: "Chín kỷ lục được xác lập", en: "Nine records set" },
        detail: {
          vi: "Hành lang La Hán dài gần 3 km với 500 pho tượng đá nguyên khối được công nhận dài nhất châu Á, một trong chín kỷ lục Bái Đính có được tính tới năm này.",
          en: "The nearly 3-kilometer Arhat corridor, holding 500 monolithic stone statues, became the longest Arhat corridor in Asia — one of nine records Bai Dinh held by this year.",
        },
      },
    ],
  },
  {
    id: "10000000-0000-4000-8000-000000000004",
    regionId: CORE_IDS.regionId,
    regionKey: REGION_KEY,
    slug: "hoa-lu-old-town",
    name: { vi: "Phố cổ Hoa Lư", en: "Hoa Lu Old Town" },
    editorialLine: {
      vi: "Dạo phố đèn lồng ven hồ buổi tối.",
      en: "Lantern light and reflections for an easy evening chapter.",
    },
    // Không phải press: mượn dữ kiện (dựng theo dáng kinh đô Đại Cồ Việt thế
    // kỷ X, gian hàng thủ công từ các làng nghề trong tỉnh) từ nhiều bài viết
    // đã đọc để viết lại bằng giọng riêng — không trích dẫn nguyên văn, không
    // ghi nguồn, vì không bài nào đủ tin cậy để đứng tên trong `press`.
    description: {
      vi: "Không gian được dựng lại theo dáng kinh đô Đại Cồ Việt thế kỷ X, nay là phố đi bộ ven hồ với gian hàng thủ công từ các làng nghề khắp tỉnh, quán ăn đèn vàng và thuyền đèn lồng trôi chậm khi trời vừa tắt nắng.",
      en: "Built to echo the shape of the tenth-century Dai Co Viet capital, this is now a lakeside walking street lined with handicraft stalls from villages across the province, lantern-lit food stalls, and boats drifting slowly as the sun goes down.",
    },
    story: {
      vi: "Đây là chỗ hợp để kết thúc một ngày, khỏi phải đi xe thêm chặng nào. Xin lưu ý: đây là khu văn hoá mới dựng, khác với Cố đô Hoa Lư nghìn năm tuổi ở gần đó. Tên gần giống nhau nhưng là hai nơi khác hẳn.",
      en: "This is a gentle way to close the day, no further transfer needed — lantern light replaces sunlight, and the street's rhythm replaces the mountain's. To be clear: this is a newly built cultural quarter, not the thousand-year-old Hoa Lu Ancient Capital nearby — the names sound alike, but they are two different stories.",
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
      vi: "Thuyền len qua đồng lúa và ba hang núi, xong thì ghé chùa Bích Động trên sườn đá. Cả tuyến đi vừa một buổi, còn thời gian thì đạp xe một vòng quanh làng.",
      en: "The boat winds through rice fields and three caves, then stops at Bich Dong Pagoda on the hillside — the whole route fits a morning, with a few laps by bicycle around the village.",
    },
    story: {
      vi: "So với Tràng An, Tam Cốc quê hơn: thuyền nhỏ, ruộng lúa đổi màu theo mùa, người dân sống ngay bên bờ sông. Gần đó có chùa Bích Động nép trên sườn núi, vắng và yên.",
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
      vi: "Lên cao mới thấy rõ sông uốn và núi nối nhau.",
      en: "Height reveals the river bends and limestone ridges.",
    },
    // Không phải press: mượn tích vua Trần Thái Tông xem múa hát (giải thích
    // tên núi) từ nhiều bài viết đã đọc để viết lại bằng giọng riêng — không
    // trích dẫn nguyên văn, không ghi nguồn, vì không bài nào đủ tin cậy để
    // đứng tên trong `press`.
    description: {
      vi: "Bậc đá dốc dần lên đỉnh. Tới nơi, cả Tam Cốc và những thung lũng quanh đó nằm dưới chân.",
      en: "Steep stone steps climb toward the summit, and at the top, Tam Coc and the surrounding valleys spread out below.",
    },
    story: {
      vi: "Người ta hay gọi vùng này là \"vịnh Hạ Long trên cạn\". Còn cái tên Hang Múa thì có tích riêng: tương truyền vua Trần Thái Tông từng dừng chân xem múa hát ở đây. Leo vài trăm bậc đá dưới nắng khá mệt, bù lại cảnh trên đỉnh rất đẹp nếu trời quang. Ai ngại đi bộ thì nên để nơi này lại sau.",
      en: "People often call it \"Ha Long Bay on land\", but the mountain's real name tells a different story: legend says Emperor Tran Thai Tong once stopped here to watch a dance performance, and so the peak became Hang Mua — the dancing cave, not a bay. A few hundred stone steps under the sun trade for a rare view, worth it but demanding stamina and clear skies. For those who prefer to walk less, this is not the place to start with.",
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
      vi: "Chiều muộn ngồi thuyền xem chim về tổ.",
      en: "Water, reeds and the evening rhythm of returning birds.",
    },
    description: {
      vi: "Đầm nước và lau sậy phía tây Tam Cốc, hợp với ai muốn ngồi yên cả buổi chiều xem chim về tổ.",
      en: "Reeds and quiet water west of Tam Coc — a slow afternoon, for anyone who wants to sit still and watch the birds come home.",
    },
    story: {
      vi: "Đi mấy điểm đông người rồi thì Thung Nham là chỗ nghỉ ngơi. Nên tới đúng lúc chim về, và khi tới gần chỗ chim ở thì đi khẽ, nói nhỏ.",
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
    press: [
      {
        text: {
          vi: "Vườn chim Thung Nham rộng 18 héc-ta bên hồ Tiên, có khoảng 5.000 tổ chim thuộc hơn 40 loài, trong đó hai loài nằm trong Sách Đỏ Việt Nam.",
          en: "Thung Nham Bird Garden covers 18 hectares set amid the cool, emerald waters of Tien Lake, home to around 5,000 nests of various kinds belonging to more than 40 species — two of which are listed in the Vietnam Red Book.",
        },
        verbatim: false,
        publisher: "Nhân Dân (Nhan Dan Online)",
        year: 2026,
        url: "https://en.nhandan.vn/sustainable-conservation-of-thung-nham-bird-garden-post152754.html",
      },
    ],
  },
  {
    id: "10000000-0000-4000-8000-000000000008",
    regionId: CORE_IDS.regionId,
    regionKey: REGION_KEY,
    slug: "van-long",
    name: { vi: "Đầm Vân Long", en: "Van Long Wetland" },
    editorialLine: {
      vi: "Đầm phẳng lặng, thuyền nan đi chậm.",
      en: "A quiet mirror of water with an unhurried sense of place.",
    },
    description: {
      vi: "Thuyền nan đi trên mặt đầm phẳng lặng, vách núi soi bóng xuống nước. Cả vùng đầm là khu bảo tồn.",
      en: "A bamboo boat glides over water flat as a mirror, the cliffs reflected upside down, and the whole wetland is protected land.",
    },
    story: {
      vi: "Vân Long hợp với ai muốn một buổi sáng thật yên, chỉ nghe tiếng mái chèo. Đây là nơi sống của voọc mông trắng và nhiều loài chim quý, nhưng có gặp được hay không thì còn tuỳ may.",
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
    press: [
      {
        text: {
          vi: "Lần đầu đến đây năm 1993, tôi thấy một quần thể chỉ khoảng 50 con voọc, và nhanh chóng nhận ra: nếu không lập khu bảo tồn, đàn voọc này sẽ sớm biến mất.",
          en: "When I first visited the area in 1993, I discovered a population of about 50 langurs and quickly realized that if we don't establish a nature reserve, the langurs will soon be gone.",
        },
        verbatim: true,
        publisher: "Mongabay — Tilo Nadler, primatologist who led the reserve's founding conservation effort",
        year: 2021,
        url: "https://news.mongabay.com/2021/03/thriving-population-of-endangered-monkeys-gives-hope-to-conservationists/",
      },
      {
        // Không ngoặc kép: đây là dữ kiện tổng hợp từ nhiều đoạn trong cùng bài, không phải một câu nguyên văn.
        text: {
          vi: "Vân Long là khu bảo tồn đất ngập nước duy nhất của Việt Nam có tên trong Danh sách Xanh của IUCN, và được Công ước Ramsar công nhận là vùng đất ngập nước có tầm quan trọng quốc tế. Phần lớn số voọc mông trắng còn lại trên thế giới sống ở đây; cả loài chỉ còn khoảng 234 đến 275 con ngoài tự nhiên.",
          en: "Van Long is the only Vietnamese protected area on the IUCN Green List, and is recognised by the Ramsar Convention as a wetland of international importance. It is also home to most of the world's remaining Delacour's langurs — a species with only between 234 and 275 individuals left in the wild.",
        },
        verbatim: false,
        publisher: "Mongabay",
        year: 2021,
        url: "https://news.mongabay.com/2021/03/thriving-population-of-endangered-monkeys-gives-hope-to-conservationists/",
      },
    ],
    realLimit: {
      vi: "Voọc mông trắng dễ gặp nhất vào mùa khô, từ tháng 11 đến tháng 4, lúc sáng sớm hoặc chiều muộn. Ngoài khoảng ấy thì khó gặp hơn nhiều.",
      en: "Delacour's langurs are easiest to spot in the dry season, November through April, clearest at early morning and late afternoon. Outside that window, sightings are far less likely — nobody can promise anything in advance.",
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
      vi: "Chùa rất lớn, hồ rộng, phải đi bộ nhiều.",
      en: "Vast scale, an open lake and a long walking rhythm.",
    },
    description: {
      vi: "Quần thể tâm linh quy mô lớn bên hồ, thuộc tỉnh Hà Nam, cách trung tâm Ninh Bình khoảng một giờ xe.",
      en: "A large lakeside spiritual complex in Ha Nam province, about an hour by road from central Ninh Binh.",
    },
    story: {
      vi: "Nhiều người ghép Tam Chúc với Bái Đính trong cùng một ngày. Các điện cách nhau xa, nên tính trước thời gian đi bộ và đi xe điện, nhất là mùa lễ hội.",
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
    press: [
      {
        // Không ngoặc kép: tổng hợp từ nhiều câu trong bài, không phải một câu nguyên văn.
        text: {
          vi: "Quần thể Tam Chúc rộng khoảng 5.100 héc-ta, gồm 1.000 héc-ta mặt hồ, 3.000 héc-ta núi đá tự nhiên và 1.000 héc-ta thung lũng. Điện Tam Thế cao 39 mét, diện tích 5.400 m², đủ chỗ cho 5.000 phật tử hành lễ cùng lúc. Chùa còn giữ một cây Bồ Đề do Chủ tịch Quốc hội Sri Lanka tặng; Việt Nam là nước thứ hai, sau Nepal, được nhận giống cây này.",
          en: "The Tam Chuc complex covers roughly 5,100 hectares, including 1,000 hectares of lake, 3,000 hectares of natural rocky mountain and 1,000 hectares of valley. Tam The Palace stands 39 meters tall across 5,400 square meters, enough for 5,000 Buddhists to perform ceremonies at once. The pagoda also holds a Bodhi tree gifted by Sri Lanka's Parliament Speaker — Vietnam is the second country after Nepal to receive this tree.",
        },
        verbatim: false,
        publisher: "VietnamPlus (Vietnam News Agency)",
        year: 2026,
        url: "https://en.vietnamplus.vn/tam-chuc-pagoda-ancient-beauty-amidst-majestic-scenery-post166820.vnp",
      },
      {
        text: {
          vi: "Năm 2019, Tam Chúc là nơi tổ chức Đại lễ Vesak Liên Hợp Quốc lần thứ 16, đón hơn 1.650 đại biểu từ 112 quốc gia và vùng lãnh thổ, cùng khoảng 20.000 tăng ni phật tử Việt Nam.",
          en: "In 2019, Tam Chuc hosted the 16th United Nations Day of Vesak Celebrations, attracting more than 1,650 delegates from 112 countries and territories, along with some 20,000 Vietnamese Buddhist dignitaries, monks, nuns and followers.",
        },
        verbatim: false,
        publisher: "Buddhistdoor Global",
        year: 2019,
        url: "https://www.buddhistdoor.net/news/vietnam-hosts-16th-united-nations-day-of-vesak-celebrations/",
      },
    ],
  },
] as const;

export function getDestinationBySlug(slug: string) {
  return DESTINATIONS.find((destination) => destination.slug === slug);
}
