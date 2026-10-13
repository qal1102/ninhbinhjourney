import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ChonTrangVe } from "@/components/commerce/chon-trang-ve";
import { SoDauView } from "@/components/commerce/so-dau-view";
import { ThanhDauTrang } from "@/components/shared/thanh-dau-trang";
import { dauTuDuongDan } from "@/domain/so-dau";
import { docNgonNgu } from "@/lib/ngon-ngu-server";

export const metadata: Metadata = {
  title: "Đóng dấu · Ninh Bình Journey",
  robots: { index: false, follow: false },
};

/** Đích của mã QR đóng dấu dán ở từng điểm (`/dau/hoa-lu-l5h`). */
export default async function DongDauPage({
  params,
  searchParams,
}: {
  params: Promise<{ ma: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const dau = dauTuDuongDan((await params).ma);
  if (!dau) notFound();
  const lang = await docNgonNgu(await searchParams);
  return (
    <>
      <ThanhDauTrang lang={lang} hienTai="ve" />
      <main lang={lang} className="min-h-screen bg-[#f4f0e7] px-5 py-10 text-[#151a17] sm:px-8 lg:py-16">
        <ChonTrangVe dangO="dau" lang={lang} />
        <SoDauView lang={lang} dongMa={dau.ma} />
      </main>
    </>
  );
}
