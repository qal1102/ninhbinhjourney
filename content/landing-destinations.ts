/**
 * Mười lăm điểm đến của trang chủ, cùng phần thông tin thực dụng đi kèm.
 *
 * Khối dữ liệu này từng nằm ngay trong `app/ninh-binh-landing.tsx` — một tệp
 * `"use client"` — nên chỉ trình duyệt đọc được, máy chủ thì không. Hệ quả: chữ
 * đã biên tập kỹ cho cả mười lăm nơi chỉ sống trong trang chủ, và sáu nơi
 * (Cúc Phương, Phát Diệm, Am Tiên, Chùa Bích Động, Đền Thái Vi, bảo tồn gấu)
 * không có trang riêng nào để máy tìm kiếm lập chỉ mục hay để khách chia sẻ.
 * Lượt kiểm tay ngày 12/09/2026 chỉ ra đúng chỗ ấy.
 *
 * Tách ra đây để trang chủ và trang chi tiết `/destination/[slug]` cùng đọc
 * một nguồn. **Không phải nguồn thứ hai:** `content/destinations.ts` vẫn giữ
 * chín hồ sơ sâu (câu chuyện, trích báo, giới hạn thật); tệp này giữ lớp
 * giới thiệu của cả mười lăm nơi. Sửa chữ ở đâu thì sửa đúng một chỗ ấy.
 */

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

export type Localized = Record<Language, string>;

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

export type DestinationFacts = {
  significance: Localized;
  bestTime: Localized;
  crowdTip: Localized;
  gettingThere: Localized;
  entranceFee: Localized;
  practical: Record<Language, string[]>;
  pairWith: DestinationId[];
  operatorNote?: Localized;
};

export const destinations: Destination[] = [
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

export const destinationFacts: Record<DestinationId, DestinationFacts> = {
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

/**
 * Địa chỉ trang riêng của từng điểm đến.
 *
 * Chín nơi đã có hồ sơ sâu trong `content/destinations.ts` thì trỏ đúng địa
 * chỉ của hồ sơ ấy (Tam Cốc trỏ về `tam-coc-bich-dong`), để một nơi không có
 * hai trang. Sáu nơi còn lại mang địa chỉ mới, dựng từ đúng chữ trong tệp này.
 */
export const DESTINATION_PAGE_SLUGS: Readonly<Record<DestinationId, string>> = Object.freeze({
  trang_an: "trang-an",
  bai_dinh: "bai-dinh",
  tam_chuc: "tam-chuc",
  hoa_lu_old_town: "hoa-lu-old-town",
  tam_coc: "tam-coc-bich-dong",
  hang_mua: "hang-mua",
  hoa_lu_ancient_capital: "hoa-lu-ancient-capital",
  cuc_phuong: "cuc-phuong",
  phat_diem: "phat-diem",
  thung_nham: "thung-nham",
  van_long: "van-long",
  am_tien: "am-tien",
  bich_dong: "bich-dong",
  thai_vi: "thai-vi",
  bear_sanctuary: "bear-sanctuary",
});

export function destinationPageHref(id: DestinationId) {
  return `/destination/${DESTINATION_PAGE_SLUGS[id]}`;
}

export function getLandingDestinationBySlug(slug: string) {
  const entry = Object.entries(DESTINATION_PAGE_SLUGS).find(([, value]) => value === slug);
  if (!entry) return undefined;
  const id = entry[0] as DestinationId;
  const destination = destinations.find((item) => item.id === id);
  if (!destination) return undefined;
  return { destination, facts: destinationFacts[id] };
}
