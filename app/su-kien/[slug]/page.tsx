import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SuKienView } from "@/components/commerce/su-kien-view";
import { ThanhDauTrang } from "@/components/shared/thanh-dau-trang";
import { docSuKienCongKhai } from "@/lib/customer-data/su-kien-repository";
import { docNgonNgu } from "@/lib/ngon-ngu-server";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const sk = await docSuKienCongKhai((await params).slug);
  return {
    title: sk ? `${sk.ten} · Ninh Bình Journey` : "Sự kiện · Ninh Bình Journey",
    description: sk ? `${sk.khachMoi}. Đăng ký rút thăm ${sk.soGiai} suất giao lưu.` : undefined,
  };
}

export default async function SuKienPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sk = await docSuKienCongKhai((await params).slug);
  if (!sk) notFound();
  const lang = await docNgonNgu(await searchParams);
  const conMo = sk.trangThai === "mo" && Date.parse(sk.hanDangKy) > new Date().getTime();
  return (
    <>
      <ThanhDauTrang lang={lang} hienTai="mua" />
      <main lang={lang} className="min-h-screen bg-[#f4f0e7] px-5 py-10 text-[#151a17] sm:px-8 lg:py-16">
        <SuKienView sk={sk} lang={lang} conMo={conMo} />
      </main>
    </>
  );
}
