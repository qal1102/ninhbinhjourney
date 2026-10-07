import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { HangChoKhach } from "@/components/commerce/hang-cho-khach";
import { ThanhDauTrang } from "@/components/shared/thanh-dau-trang";
import { BEN_CO_HANG_CHO, laMaBen } from "@/domain/hang-cho";
import { docNgonNgu } from "@/lib/ngon-ngu-server";

export const metadata: Metadata = {
  title: "Hàng chờ bến đò · Ninh Bình Journey",
  description: "Lấy số thứ tự trên điện thoại, đi dạo quanh bến, tới lượt thì trang báo.",
};

export default async function XepHangPage({
  params,
  searchParams,
}: {
  params: Promise<{ ben: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { ben } = await params;
  if (!laMaBen(ben)) notFound();
  const lang = await docNgonNgu(await searchParams);
  const noi = BEN_CO_HANG_CHO[ben];
  return (
    <>
      <ThanhDauTrang lang={lang} />
    <main lang={lang} className="min-h-screen bg-[#f4f0e7] px-4 py-8 text-[#151a17] sm:px-8 lg:py-14">
      <nav aria-label={lang === "en" ? "Page navigation" : "Điều hướng trang"} className="mx-auto mb-4 max-w-3xl text-sm font-bold">
        <Link href={`/?lang=${lang}`} className="text-[#183f34]">
          ← {lang === "en" ? "Home" : "Về trang chủ"}
        </Link>
      </nav>
      <HangChoKhach ben={ben} ten={lang === "en" ? noi.tenEn : noi.ten} lang={lang} />
    </main>
    </>
  );
}
