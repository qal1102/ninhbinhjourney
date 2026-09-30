import type { ErpSiteId } from "@/domain/erp";
import type { DestinationId } from "@/content/landing-destinations";
import { benCuaCoSo, type MaBen } from "@/domain/hang-cho";

/**
 * Kiosk tự phục vụ tại điểm (`/kiosk/<cơ sở>`). Chỉ bốn cơ sở có cổng bán vé;
 * hai điểm Hoa Lư không bán vé tại đây nên không có kiosk.
 */
export const KIOSK_CO_SO = {
  "trang-an": { diemDen: "trang_an" },
  "bai-dinh": { diemDen: "bai_dinh" },
  "tam-chuc": { diemDen: "tam_chuc" },
  "tam-coc": { diemDen: "tam_coc" },
} as const satisfies Record<ErpSiteId, { diemDen: DestinationId }>;

export function laCoSoKiosk(x: string): x is ErpSiteId {
  return Object.hasOwn(KIOSK_CO_SO, x);
}

export function benCuaKiosk(coSo: ErpSiteId): MaBen | null {
  return benCuaCoSo(coSo);
}

/** Không ai chạm trong chừng này thì kiosk về màn đầu, xoá mọi thứ khách vừa xem. */
export const KIOSK_NGHI_MS = 60_000;
