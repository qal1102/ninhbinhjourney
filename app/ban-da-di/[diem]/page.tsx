import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ThanhDauTrang } from "@/components/shared/thanh-dau-trang";
import { DESTINATIONS } from "@/content/destinations";
import { apBangGia, getPackageBySlug } from "@/content/packages";
import { SO_DU_DE_NOI } from "@/domain/goi-y";
import { dauTheoMa } from "@/domain/so-dau";
import { docBangGia } from "@/lib/commerce/bang-gia";
import { docSoNoiBatKho } from "@/lib/commerce/so-noi-bat";
import { ch } from "@/lib/ngon-ngu";
import { docNgonNgu } from "@/lib/ngon-ngu-server";

/**
 * "Bạn của bạn đã đi đây, bạn muốn thử không?" (13/10/2026). Không có mạng
 * xã hội nào đứng sau: trang mở từ đường dẫn chính khách tự chia sẻ (nút Khoe
 * ở sổ dấu hay thẻ lượt đi), nên không lộ gì của ai mà người gửi không muốn.
 * Kèm số thật tuần này và lối mua vé điểm ấy; tới qua mã mời thì giảm 10%.
 */

export const metadata: Metadata = {
  title: "Bạn của bạn vừa đi Ninh Bình · Ninh Bình Journey",
  robots: { index: false, follow: true },
};

export default async function BanDaDiPage({
  params,
  searchParams,
}: {
  params: Promise<{ diem: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const dau = dauTheoMa((await params).diem);
  if (!dau || !dau.diemDen) notFound();
  const sp = await searchParams;
  const lang = await docNgonNgu(sp);
  const diem = DESTINATIONS.find((d) => d.slug === dau.diemDen);
  if (!diem) notFound();
  const [bangGia, so] = await Promise.all([docBangGia(), docSoNoiBatKho()]);
  const goc = dau.veSlug ? getPackageBySlug(dau.veSlug) : undefined;
  const ve = goc ? apBangGia(goc, bangGia) : undefined;
  const quaCong = so?.diem[diem.slug] ?? 0;
  const duoc = sp.moi === "co";
  const duoi = lang === "en" ? "?lang=en" : "";
  return (
    <>
      <ThanhDauTrang lang={lang} />
      <main lang={lang} className="min-h-screen bg-[#f4f0e7] text-[#151a17]" data-testid="ban-da-di">
        <div className="relative h-[52vh] min-h-80 w-full">
          <Image src={diem.image} alt={diem.imageAlt[lang]} fill priority sizes="100vw" className="object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#10231d] via-[#10231d]/40 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 mx-auto max-w-3xl px-5 pb-8 text-white sm:px-8">
            <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-[#e7c78d]">{ch(lang, "Bạn của bạn vừa đến đây", "Your friend was just here")}</p>
            <h1 className="font-display mt-2 text-5xl leading-tight">{diem.name[lang]}</h1>
            <p className="mt-2 text-lg text-white/85">{ch(lang, "Bạn có muốn thử không?", "Fancy going too?")}</p>
          </div>
        </div>
        <div className="mx-auto max-w-3xl px-5 py-8 sm:px-8">
          {quaCong >= SO_DU_DE_NOI ? (
            <p className="inline-flex rounded-full bg-[#e3efe8] px-4 py-2 text-sm font-bold text-[#245e48]" data-testid="ban-da-di-so">
              {ch(lang, `${quaCong.toLocaleString("vi-VN")} khách đã qua cổng 7 ngày qua`, `${quaCong.toLocaleString("en-US")} visitors in the last 7 days`)}
            </p>
          ) : null}
          {duoc ? (
            <p className="mt-4 rounded-2xl border border-[#d58c35]/40 bg-[#fbf3e6] px-5 py-4 text-sm leading-6 text-[#4d4636]" data-testid="ban-da-di-moi">
              {ch(lang, "Bạn của bạn gửi kèm mã mời: mua vé điểm này được giảm 10%, mã đã điền sẵn ở trang thanh toán.", "Your friend sent an invite code: 10% off tickets here, already filled in at checkout.")}
            </p>
          ) : null}
          <p className="mt-4 leading-7 text-[#3f4a43]">{diem.description[lang]}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            {ve ? (
              <Link href={`/checkout?package=${ve.slug}${lang === "en" ? "&lang=en" : ""}`} className="inline-flex min-h-12 items-center rounded-full bg-[#183f34] px-6 font-extrabold text-white">
                {ch(lang, `Mua vé ${ve.demoPriceVnd.toLocaleString("vi-VN")} đ`, `Buy a ticket, VND ${ve.demoPriceVnd.toLocaleString("en-US")}`)}
              </Link>
            ) : null}
            <Link href={`/destination/${diem.slug}${duoi}`} className="inline-flex min-h-12 items-center rounded-full border border-[#183f34] px-6 font-extrabold text-[#183f34]">
              {ch(lang, "Xem nơi này", "About this place")}
            </Link>
            <Link href={`/so-dau${duoi}`} className="inline-flex min-h-12 items-center rounded-full border border-[#c9b48c] px-6 font-extrabold text-[#6c4b1f]">
              {ch(lang, "Sổ dấu của tôi", "My stamp book")}
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
