import type { Metadata } from "next";
import Link from "next/link";
import { TicketLookup } from "@/components/commerce/ticket-lookup";
import { isCustomerBookingEnabled } from "@/lib/customer-data/booking-repository";
import { NutNgonNgu } from "@/components/shared/nut-ngon-ngu";
import { ch } from "@/lib/ngon-ngu";
import { docNgonNgu } from "@/lib/ngon-ngu-server";

export const metadata: Metadata = {
  title: "Tra cứu vé · Ninh Bình Journey",
  description:
    "Nhập mã đặt chỗ cùng số điện thoại hoặc email đã dùng lúc đặt để mở lại vé và mã QR.",
};

export default async function TicketLookupPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const lang = await docNgonNgu(await searchParams);
  return (
    <main lang={lang} className="min-h-screen bg-[#f4f0e7] px-5 py-10 text-[#151a17] sm:px-8 lg:py-16">
      <div className="mx-auto mb-6 max-w-3xl overflow-hidden rounded-3xl">
      </div>
      {isCustomerBookingEnabled() ? (
        <TicketLookup lang={lang}>
          <NutNgonNgu lang={lang} />
        </TicketLookup>
      ) : (
        <div className="mx-auto max-w-xl rounded-3xl border border-[#d7d5cd] bg-white p-8 text-center">
          <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-[#9a6328]">
            {ch(lang, "Ninh Bình Journey · Vé của bạn", "Ninh Binh Journey · Your tickets")}
          </p>
          <h1 className="font-display mt-3 text-4xl text-[#183f34]">
            {ch(lang, "Lối tra cứu vé chưa mở ở bản này", "Ticket lookup is not open in this version")}
          </h1>
          <p className="mt-4 leading-7 text-[#59654b]">
            {ch(
              lang,
              "Đặt chỗ trực tuyến đang tắt trên bản đang chạy, nên chưa có tấm vé nào để tra cứu ạ. Mời bạn xem các gói hành trình, hoặc gọi tới quầy để đội ngũ mở vé giúp bạn.",
              "Online booking is off in this version, so there are no tickets to look up. See the packages, or call the desk and the team will open your ticket.",
            )}
          </p>
          <Link
            href="/packages"
            className="mt-6 inline-flex min-h-11 items-center rounded-full border border-[#183f34] px-5 font-bold text-[#183f34]"
          >
            {ch(lang, "Xem các gói hành trình", "See the packages")}
          </Link>
        </div>
      )}
    </main>
  );
}
