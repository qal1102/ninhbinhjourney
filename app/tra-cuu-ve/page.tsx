import type { Metadata } from "next";
import Link from "next/link";
import { TicketLookup } from "@/components/commerce/ticket-lookup";
import { isCustomerBookingEnabled } from "@/lib/customer-data/booking-repository";

export const metadata: Metadata = {
  title: "Tra cứu vé · Ninh Bình Journey",
  description:
    "Nhập mã đặt chỗ cùng số điện thoại hoặc email đã dùng lúc đặt để mở lại vé và mã QR.",
};

export default function TicketLookupPage() {
  return (
    <main className="min-h-screen bg-[#f4f0e7] px-5 py-10 text-[#151a17] sm:px-8 lg:py-16">
      {isCustomerBookingEnabled() ? (
        <TicketLookup />
      ) : (
        <div className="mx-auto max-w-xl rounded-3xl border border-[#d7d5cd] bg-white p-8 text-center">
          <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-[#9a6328]">
            Ninh Bình Journey · Vé của bạn
          </p>
          <h1 className="font-display mt-3 text-4xl text-[#183f34]">
            Lối tra cứu vé chưa mở ở bản này
          </h1>
          <p className="mt-4 leading-7 text-[#59654b]">
            Đặt chỗ trực tuyến đang tắt trên bản đang chạy, nên chưa có tấm vé nào để tra cứu ạ.
            Mời bạn xem các gói hành trình, hoặc gọi tới quầy để đội ngũ mở vé giúp bạn.
          </p>
          <Link
            href="/packages"
            className="mt-6 inline-flex min-h-11 items-center rounded-full border border-[#183f34] px-5 font-bold text-[#183f34]"
          >
            Xem các gói hành trình
          </Link>
        </div>
      )}
    </main>
  );
}
