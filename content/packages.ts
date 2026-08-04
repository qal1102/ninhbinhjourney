import { CORE_IDS } from "@/config/experience";

export type PackageCatalogItem = {
  id: string;
  regionId: string;
  slug: string;
  name: string;
  audience: string;
  durationLabel: string;
  durationMinutes: number;
  pace: "relaxed" | "balanced" | "active";
  demoPriceVnd: number;
  ledgerType: "service-commerce";
  siteIds: readonly string[];
  inclusions: readonly string[];
  exclusions: readonly string[];
  schedule: readonly string[];
};

export const PACE_LABEL: Record<PackageCatalogItem["pace"], string> = {
  relaxed: "nhịp thư thả",
  balanced: "nhịp cân bằng",
  active: "nhịp năng động",
};

export const PACKAGES: readonly PackageCatalogItem[] = [
  {
    id: "40000000-0000-4000-8000-000000000001",
    regionId: CORE_IDS.regionId,
    slug: "heritage-day",
    name: "Di sản trong một ngày",
    audience: "Lần đầu đến Ninh Bình",
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
      "Điều phối khung giờ minh họa",
      "QR Pass dùng tại điểm",
    ],
    exclusions: ["Lưu trú", "Chi tiêu cá nhân", "Dịch vụ ngoài catalog demo"],
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
      "Chương buổi tối Phố cổ Hoa Lư",
      "QR Pass và trạng thái realtime",
    ],
    exclusions: ["Lưu trú", "Bữa ăn", "Xe điện/dịch vụ ngoài catalog demo"],
    schedule: ["08:00 · Tràng An", "Nghỉ dài buổi chiều", "18:00 · Phố cổ Hoa Lư"],
  },
  {
    id: "40000000-0000-4000-8000-000000000003",
    regionId: CORE_IDS.regionId,
    slug: "family-discovery",
    name: "Gia đình khám phá",
    audience: "Gia đình có trẻ em",
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
      "Khung giờ gia đình minh họa",
      "QR Pass chung cho booking",
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
      "Khung giờ ánh sáng minh họa",
      "QR Pass chung cho booking",
    ],
    exclusions: ["Thiết bị nhiếp ảnh", "Người chụp ảnh", "Lưu trú"],
    schedule: ["14:00 · Tam Cốc – Bích Động", "18:00 · Phố cổ Hoa Lư"],
  },
] as const;

export function getPackageBySlug(slug: string) {
  return PACKAGES.find((item) => item.slug === slug);
}
