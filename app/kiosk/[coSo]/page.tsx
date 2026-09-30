import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { KioskDiem, type GoiKiosk } from "@/components/commerce/kiosk-diem";
import { DESTINATION_PAGE_SLUGS, destinationFacts, destinations } from "@/content/landing-destinations";
import { PACKAGES } from "@/content/packages";
import { giaGoi, goiDaHetMua, goiHienThi } from "@/content/packages-en";
import { getErpSite } from "@/domain/erp";
import { BEN_CO_HANG_CHO } from "@/domain/hang-cho";
import { benCuaKiosk, KIOSK_CO_SO, laCoSoKiosk } from "@/domain/kiosk";
import { ERP_SHIFT_CLOSE_SITE_UUID_BY_SLUG } from "@/lib/erp/shift-close-repository";

export const metadata: Metadata = {
  title: "Kiosk · Ninh Bình Journey",
  robots: { index: false, follow: false },
};

/**
 * Màn chạm tự phục vụ đặt ở cổng một cơ sở. Kiosk là máy dùng chung, nên nó
 * không giữ gì của khách: mọi việc cần danh tính (đặt vé, trả tiền, tra vé)
 * đi tiếp trên điện thoại khách qua mã QR. Riêng Tam Cốc, khách lấy số đò
 * ngay trên kiosk rồi quét mã để điện thoại nhận lượt.
 */
export default async function KioskPage({
  params,
  searchParams,
}: {
  params: Promise<{ coSo: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { coSo } = await params;
  if (!laCoSoKiosk(coSo)) notFound();
  const site = getErpSite(coSo);
  const diem = destinations.find((d) => d.id === KIOSK_CO_SO[coSo].diemDen);
  if (!site || !diem) notFound();
  const facts = destinationFacts[diem.id];
  const uuid = ERP_SHIFT_CLOSE_SITE_UUID_BY_SLUG[coSo];
  const bayGio = new Date();
  const goi: GoiKiosk[] = PACKAGES.filter((p) => p.siteIds.includes(uuid) && !goiDaHetMua(p, bayGio)).map((p) => ({
    slug: p.slug,
    ten: { vi: goiHienThi(p, "vi").name, en: goiHienThi(p, "en").name },
    thoiLuong: { vi: goiHienThi(p, "vi").durationLabel, en: goiHienThi(p, "en").durationLabel },
    gia: { vi: giaGoi(p, "vi"), en: giaGoi(p, "en") },
  }));
  const ben = benCuaKiosk(coSo);
  const langXin = (await searchParams).lang;
  return (
    <KioskDiem
      langDau={langXin === "en" ? "en" : "vi"}
      ten={diem.name}
      slugDiemDen={DESTINATION_PAGE_SLUGS[diem.id]}
      goi={goi}
      ben={ben ? { ma: ben, ten: { vi: BEN_CO_HANG_CHO[ben].ten, en: BEN_CO_HANG_CHO[ben].tenEn } } : null}
      thongTin={{
        gioVe: facts.entranceFee,
        diLai: facts.gettingThere,
        meoDong: facts.crowdTip,
        thucDung: facts.practical,
      }}
    />
  );
}
