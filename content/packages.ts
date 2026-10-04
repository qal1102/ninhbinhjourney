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
};

export const PACE_LABEL: Record<PackageCatalogItem["pace"], string> = {
  relaxed: "đi thong thả",
  balanced: "đi vừa phải",
  active: "đi được nhiều",
};

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
    demoPriceVnd: 890_000,
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
    demoPriceVnd: 790_000,
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
    demoPriceVnd: 1_090_000,
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
    demoPriceVnd: 1_290_000,
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
    demoPriceVnd: 650_000,
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
    demoPriceVnd: 390_000,
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
] as const;

export function getPackageBySlug(slug: string) {
  return PACKAGES.find((item) => item.slug === slug);
}
