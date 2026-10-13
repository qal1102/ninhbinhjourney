import { CORE_IDS } from "@/config/experience";

/**
 * Ai đi cùng ai — dạng có cấu trúc của đúng câu `audience` ngay bên dưới.
 *
 * `audience` là chữ viết cho khách đọc, mỗi gói một kiểu ("Lần đầu đến Ninh
 * Bình", "Gia đình có trẻ em"…). Dò từ khoá trong câu chữ đó để đoán ra
 * người đi cùng thì mong manh: đổi một chữ trong copy là phép ghép hỏng mà
 * không ai hay. `companionFit` khai thẳng điều `audience` đang nói, để
 * `domain/package-match.ts` so khớp trên dữ liệu chứ không trên văn xuôi.
 * Sửa `audience` thì sửa luôn dòng này cho khớp.
 */
export type PackageCompanionGroup =
  | "solo"
  | "couple"
  | "adults"
  | "children"
  | "seniors";

export type PackageCatalogItem = {
  id: string;
  regionId: string;
  slug: string;
  name: string;
  audience: string;
  companionFit: readonly PackageCompanionGroup[];
  durationLabel: string;
  durationMinutes: number;
  pace: "relaxed" | "balanced" | "active";
  demoPriceVnd: number;
  ledgerType: "service-commerce";
  siteIds: readonly string[];
  inclusions: readonly string[];
  exclusions: readonly string[];
  schedule: readonly string[];
  campaign?: "mid-autumn-2026";
  editorialDescription?: string;
  priceLabel?: string;
  bookingStartDate?: string;
  bookingEndDate?: string;
  /**
   * Gói theo mùa lặp lại hằng năm: khung bán tính theo năm từ Lịch mùa vụ
   * (`domain/mua-hoa-sung.ts`), thay cho hai ngày ghi cứng ở trên.
   */
  muaBan?: "hoa-sung";
  fixedPartySize?: number;
  /**
   * `ve`: vé vào cổng một điểm, bán đúng giá quầy. Không có thì là gói (lịch
   * đi gợi ý). Trang chủ và bộ ghép lịch chỉ lấy gói.
   */
  loai?: "ve";
};

export const PACE_LABEL: Record<PackageCatalogItem["pace"], string> = {
  relaxed: "đi thong thả",
  balanced: "đi vừa phải",
  active: "đi được nhiều",
};

/**
 * Giá trong danh mục này chỉ là giá dự phòng khi web không đọc được kho. Giá
 * thật nằm ở bảng giá quầy (`erp_counter_price_list`, màn Giá vé quầy): vé
 * lẻ bằng giá người lớn của điểm, gói bằng tổng giá vé các điểm trong gói
 * (điểm không bán vé như Hoa Lư tính 0 đ). Xem migration 124 và
 * `lib/commerce/bang-gia.ts`. Sửa bảng giá quầy thì sửa số dự phòng ở đây.
 */
export const PACKAGES: readonly PackageCatalogItem[] = [
  {
    id: "40000000-0000-4000-8000-000000000001",
    regionId: CORE_IDS.regionId,
    slug: "heritage-day",
    name: "Di sản trong một ngày",
    audience: "Lần đầu đến Ninh Bình",
    companionFit: ["solo", "couple", "adults"],
    durationLabel: "1 ngày",
    durationMinutes: 600,
    pace: "balanced",
    demoPriceVnd: 250_000,
    ledgerType: "service-commerce",
    siteIds: [
      "10000000-0000-4000-8000-000000000001",
      "10000000-0000-4000-8000-000000000002",
    ],
    inclusions: [
      "Quyền vào hai điểm trong lịch trình",
      "Khung giờ đi gợi ý",
      "Vé QR dùng ở cổng",
    ],
    exclusions: ["Lưu trú", "Chi tiêu cá nhân", "Dịch vụ ngoài gói"],
    schedule: [
      "08:00 · Tràng An",
      "12:00 · Khoảng nghỉ tự túc",
      "13:30 · Cố đô Hoa Lư",
    ],
  },
  {
    id: "40000000-0000-4000-8000-000000000002",
    regionId: CORE_IDS.regionId,
    slug: "slow-ninh-binh",
    name: "Nhịp chậm Ninh Bình",
    audience: "Bố mẹ/người lớn tuổi, ít đi bộ",
    companionFit: ["seniors"],
    durationLabel: "1 ngày",
    durationMinutes: 540,
    pace: "relaxed",
    demoPriceVnd: 250_000,
    ledgerType: "service-commerce",
    siteIds: [
      "10000000-0000-4000-8000-000000000001",
      "10000000-0000-4000-8000-000000000004",
    ],
    inclusions: [
      "Tuyến thuyền Tràng An minh họa",
      "Buổi tối ở Phố cổ Hoa Lư",
      "Vé QR, xem được đã vào cổng hay chưa",
    ],
    exclusions: ["Lưu trú", "Bữa ăn", "Xe điện và dịch vụ ngoài gói"],
    schedule: ["08:00 · Tràng An", "Nghỉ dài buổi chiều", "18:00 · Phố cổ Hoa Lư"],
  },
  {
    id: "40000000-0000-4000-8000-000000000003",
    regionId: CORE_IDS.regionId,
    slug: "family-discovery",
    name: "Gia đình khám phá",
    audience: "Gia đình có trẻ em",
    companionFit: ["children"],
    durationLabel: "1 ngày",
    durationMinutes: 600,
    pace: "balanced",
    demoPriceVnd: 310_000,
    ledgerType: "service-commerce",
    siteIds: [
      "10000000-0000-4000-8000-000000000001",
      "10000000-0000-4000-8000-000000000003",
    ],
    inclusions: [
      "Hai quyền vào điểm",
      "Khung giờ hợp với trẻ nhỏ",
      "Một mã QR chung cho cả đơn",
    ],
    exclusions: ["Lưu trú", "Bữa ăn", "Dịch vụ trông trẻ"],
    schedule: ["08:00 · Tràng An", "13:30 · Bái Đính", "Kết thúc trước 17:00"],
  },
  {
    id: "40000000-0000-4000-8000-000000000004",
    regionId: CORE_IDS.regionId,
    slug: "cinematic-sunset",
    name: "Cinematic Ninh Bình",
    audience: "Nhiếp ảnh/cặp đôi",
    companionFit: ["couple", "solo"],
    durationLabel: "Nửa ngày + tối",
    durationMinutes: 420,
    pace: "active",
    demoPriceVnd: 200_000,
    ledgerType: "service-commerce",
    siteIds: [
      "10000000-0000-4000-8000-000000000005",
      "10000000-0000-4000-8000-000000000004",
    ],
    inclusions: [
      "Hai quyền vào điểm",
      "Khung giờ có nắng đẹp",
      "Một mã QR chung cho cả đơn",
    ],
    exclusions: ["Thiết bị nhiếp ảnh", "Người chụp ảnh", "Lưu trú"],
    schedule: ["14:00 · Tam Cốc – Bích Động", "18:00 · Phố cổ Hoa Lư"],
  },
  {
    id: "40000000-0000-4000-8000-000000000006",
    regionId: CORE_IDS.regionId,
    slug: "tam-chuc-chua-tren-ho",
    name: "Tam Chúc: chùa trên hồ",
    audience: "Người thích không gian tâm linh, đi nhẹ nhàng",
    companionFit: ["adults", "seniors"],
    durationLabel: "Nửa ngày",
    durationMinutes: 240,
    pace: "relaxed",
    demoPriceVnd: 200_000,
    ledgerType: "service-commerce",
    siteIds: ["10000000-0000-4000-8000-000000000009"],
    inclusions: [
      "Thuyền qua hồ Tam Chúc tới bến Khánh Điện",
      "Đi bộ ba toà điện lên núi Thất Tinh",
      "Một mã QR chung cho cả đơn",
    ],
    exclusions: ["Xe điện trong khu", "Bữa ăn", "Lễ vật, công đức"],
    schedule: ["Chọn chuyến 07:30 · 09:00 · 10:30 · 13:30 · 15:00", "Thuyền qua hồ, lên Khánh Điện", "Về bến sau khoảng bốn giờ"],
  },
  {
    id: "40000000-0000-4000-8000-000000000007",
    regionId: CORE_IDS.regionId,
    slug: "do-som-mua-hoa-sung",
    name: "Đò sớm mùa hoa súng",
    audience: "Người muốn ngắm hoa súng nở trên sông Ngô Đồng buổi sáng",
    companionFit: ["solo", "couple", "adults", "children", "seniors"],
    durationLabel: "Buổi sáng · mùa hoa súng",
    durationMinutes: 120,
    pace: "relaxed",
    demoPriceVnd: 200_000,
    ledgerType: "service-commerce",
    siteIds: ["10000000-0000-4000-8000-000000000005"],
    inclusions: [
      "Đò Tam Cốc từ bến Văn Lâm qua Hang Cả, Hang Hai, Hang Ba",
      "Chuyến sớm, đúng lúc hoa nở (khoảng 7–10 giờ sáng)",
      "Một mã QR chung cho cả đơn",
    ],
    exclusions: ["Bữa sáng", "Di chuyển tới Tam Cốc", "Thanh toán thật (bản thử chưa thu tiền)"],
    schedule: [
      "Chọn chuyến 06:30 · 07:00 · 07:30 · 08:00 · 08:30",
      "Lên đò ở bến Văn Lâm, qua ba hang",
      "Về bến sau khoảng hai giờ",
    ],
    editorialDescription:
      "Hoa súng trên sông Ngô Đồng chỉ nở buổi sáng. Đò đi sớm để kịp lúc hoa mở trọn, đoạn đẹp nhất nằm giữa Hang Cả và Hang Hai.",
    muaBan: "hoa-sung",
  },
  {
    id: "40000000-0000-4000-8000-000000000005",
    regionId: CORE_IDS.regionId,
    slug: "ban-trang-tam-coc-2026",
    name: "Bàn Trăng bên Ngô Đồng",
    audience: "Hai người muốn ăn tối riêng sau chuyến Tam Cốc",
    companionFit: ["couple"],
    durationLabel: "19:00–21:30 · mùa trăng 2026",
    durationMinutes: 150,
    pace: "relaxed",
    demoPriceVnd: 1_240_000,
    ledgerType: "service-commerce",
    siteIds: ["10000000-0000-4000-8000-000000000005"],
    inclusions: [
      "Thực đơn thử nghiệm theo mùa cho hai khách",
      "Trà và một phần bánh Trung thu dùng tại bàn",
      "Một hộp Trăng Non hai bánh mang về",
      "Giữ chỗ 15 phút theo số chỗ còn trống",
    ],
    exclusions: [
      "Đồ uống gọi thêm",
      "Di chuyển và lưu trú",
      "Thanh toán thật (bản thử chưa thu tiền)",
    ],
    schedule: [
      "19:00 · đón khách ở Tam Cốc",
      "19:15 · thực đơn theo mùa",
      "20:45 · trà, bánh và hộp quà mang về",
    ],
    campaign: "mid-autumn-2026",
    editorialDescription:
      "Đi thuyền Tam Cốc xong, buổi tối hai người ngồi bàn ăn riêng, cuối bữa có trà và hộp bánh mang về.",
    priceLabel: "2.480.000 VND · bàn hai khách",
    bookingStartDate: "2026-09-18",
    bookingEndDate: "2026-09-27",
    fixedPartySize: 2,
  },
  {
    id: "40000000-0000-4000-8000-000000000011",
    regionId: CORE_IDS.regionId,
    slug: "ve-trang-an",
    name: "Vé Tràng An",
    audience: "Mọi khách, đi tự túc",
    companionFit: ["solo", "couple", "adults", "children", "seniors"],
    durationLabel: "Khoảng 3 giờ trên thuyền",
    durationMinutes: 180,
    pace: "balanced",
    demoPriceVnd: 250_000,
    ledgerType: "service-commerce",
    siteIds: ["10000000-0000-4000-8000-000000000001"],
    inclusions: ["Một lượt đi thuyền Tràng An","Vé QR dùng ở cổng","Trẻ dưới 1m3 miễn phí"],
    exclusions: ["Tiền boa người chèo","Ăn uống"],
    schedule: ["Chọn giờ lên thuyền 07:30–15:00","Đi thuyền qua các hang và đền","Về bến sau khoảng 3 giờ"],
    loai: "ve",
  },
  {
    id: "40000000-0000-4000-8000-000000000012",
    regionId: CORE_IDS.regionId,
    slug: "ve-tam-coc",
    name: "Vé Tam Cốc – Bích Động",
    audience: "Mọi khách, đi tự túc",
    companionFit: ["solo", "couple", "adults", "children", "seniors"],
    durationLabel: "Khoảng 2 giờ trên đò",
    durationMinutes: 120,
    pace: "balanced",
    demoPriceVnd: 200_000,
    ledgerType: "service-commerce",
    siteIds: ["10000000-0000-4000-8000-000000000005"],
    inclusions: ["Một lượt đò Tam Cốc","Vé QR dùng ở cổng","Trẻ dưới 1m3 miễn phí"],
    exclusions: ["Tiền boa người chèo","Thuê xe đạp"],
    schedule: ["Chọn giờ xuống đò 07:00–15:30","Đò qua Hang Cả, Hang Hai, Hang Ba","Về bến Văn Lâm sau khoảng 2 giờ"],
    loai: "ve",
  },
  {
    id: "40000000-0000-4000-8000-000000000013",
    regionId: CORE_IDS.regionId,
    slug: "ve-tam-chuc",
    name: "Vé Tam Chúc",
    audience: "Mọi khách, đi tự túc",
    companionFit: ["solo", "couple", "adults", "children", "seniors"],
    durationLabel: "Nửa ngày",
    durationMinutes: 240,
    pace: "balanced",
    demoPriceVnd: 200_000,
    ledgerType: "service-commerce",
    siteIds: ["10000000-0000-4000-8000-000000000009"],
    inclusions: ["Thuyền qua hồ Tam Chúc","Vé QR dùng ở cổng","Trẻ dưới 1m3 miễn phí"],
    exclusions: ["Xe điện trong khu","Lễ vật, công đức"],
    schedule: ["Chọn chuyến 07:30–15:00","Thuyền qua hồ, lên Khánh Điện","Về bến sau khoảng 4 giờ"],
    loai: "ve",
  },
  {
    id: "40000000-0000-4000-8000-000000000014",
    regionId: CORE_IDS.regionId,
    slug: "ve-bai-dinh",
    name: "Vé Bái Đính",
    audience: "Mọi khách, đi tự túc",
    companionFit: ["solo", "couple", "adults", "children", "seniors"],
    durationLabel: "Khoảng 3 giờ",
    durationMinutes: 180,
    pace: "balanced",
    demoPriceVnd: 60_000,
    ledgerType: "service-commerce",
    siteIds: ["10000000-0000-4000-8000-000000000003"],
    inclusions: ["Xe điện khứ hồi trong khu chùa","Vé QR dùng ở cổng","Trẻ dưới 1m3 miễn phí"],
    exclusions: ["Lên tháp chuông, tháp Xá Lợi","Lễ vật, công đức"],
    schedule: ["Chọn giờ vào 07:30–15:00","Xe điện từ cổng tam quan lên chùa","Hành lang La Hán, điện Tam Thế"],
    loai: "ve",
  },
] as const;

/** Bảng giá đọc từ kho: mã gói → giá một người lớn. */
export type BangGia = Readonly<Record<string, number>>;

/** Gói kèm giá hiện hành; không có trong bảng thì giữ giá dự phòng. */
export function apBangGia<T extends PackageCatalogItem>(item: T, bang?: BangGia | null): T {
  const gia = bang?.[item.slug];
  return gia === undefined || gia === item.demoPriceVnd ? item : { ...item, demoPriceVnd: gia };
}

/** Gói (lịch đi gợi ý), không gồm vé lẻ. */
export const CAC_GOI = PACKAGES.filter((item) => item.loai !== "ve");

/** Vé lẻ vào cổng từng điểm, theo thứ tự hiển thị. */
export const VE_LE = PACKAGES.filter((item) => item.loai === "ve");

export function getPackageBySlug(slug: string) {
  return PACKAGES.find((item) => item.slug === slug);
}
