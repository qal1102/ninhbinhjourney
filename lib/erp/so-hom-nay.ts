import "server-only";

import type { ErpSiteId } from "@/domain/erp";
import { tongTheoKy, TONG_RONG, type TongKy } from "@/domain/toan-vung";
import { docBaoCaoCoSo } from "@/lib/erp/bao-cao-repository";

function homNayVietNam(value = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(value);
}

function cong(x: TongKy, y: TongKy): TongKy {
  return {
    khach: x.khach + y.khach,
    tienQuay: x.tienQuay + y.tienQuay,
    phieuQuay: x.phieuQuay + y.phieuQuay,
    tienWeb: x.tienWeb + y.tienWeb,
    khachWeb: x.khachWeb + y.khachWeb,
  };
}

export type SoHomNay = {
  hienTai: TongKy;
  truoc: TongKy;
  theoCoSo: { siteId: ErpSiteId; hienTai: TongKy }[];
};

/**
 * Khách và tiền hôm nay, cùng nguồn và cùng cách cộng với màn Toàn vùng
 * (lượt qua cổng, tiền quầy theo phiếu, tiền web theo cơ sở). Soát 13/10/2026:
 * trợ lý trả "1.848 vé đã bán" lấy từ hồ sơ chốt ca tháng 8, trong khi Toàn
 * vùng ghi 366 khách hôm nay; trang đầu và trợ lý nay đọc cùng một chỗ.
 * null khi chưa nối kho.
 */
export async function soHomNay(siteIds: readonly ErpSiteId[]): Promise<SoHomNay | null> {
  const homNay = homNayVietNam();
  const baoCao = await Promise.all(
    siteIds.map(async (siteId) => ({
      siteId,
      bc: await docBaoCaoCoSo(siteId, { soNgay: 1, gomHomNay: true }).catch(() => null),
    })),
  );
  const theoCoSo: SoHomNay["theoCoSo"] = [];
  let hienTai = TONG_RONG;
  let truoc = TONG_RONG;
  for (const { siteId, bc } of baoCao) {
    if (!bc || bc.trangThai !== "co-so-lieu") continue;
    const ky = tongTheoKy(bc.soLieu.ngay, "hom-nay", homNay);
    hienTai = cong(hienTai, ky.hienTai);
    truoc = cong(truoc, ky.truoc);
    theoCoSo.push({ siteId, hienTai: ky.hienTai });
  }
  return theoCoSo.length ? { hienTai, truoc, theoCoSo } : null;
}
