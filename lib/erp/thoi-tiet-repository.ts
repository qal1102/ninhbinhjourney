import "server-only";

import { docDuBaoOpenMeteo, duongDanOpenMeteo, type GioDuBao } from "@/domain/thoi-tiet-ben";
import type { CoSoThuyen } from "@/domain/thuyen-song";

/**
 * Dự báo theo giờ ở bến từ Open-Meteo. Giữ trong bộ đệm của Next 30 phút
 * (dự báo của họ cập nhật theo giờ), chờ tối đa 4 giây. Lỗi mạng hay dữ liệu
 * lạ thì trả `null`: màn hình nói thẳng là chưa lấy được, không vẽ số đoán.
 */
export async function duBaoBen(coSo: CoSoThuyen): Promise<GioDuBao[] | null> {
  try {
    const res = await fetch(duongDanOpenMeteo(coSo), {
      next: { revalidate: 1800 },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    return docDuBaoOpenMeteo(await res.json());
  } catch {
    return null;
  }
}
