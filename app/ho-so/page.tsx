import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { HoSoKhachView } from "@/components/commerce/ho-so-khach-view";
import { MoHoSo } from "@/components/commerce/mo-ho-so";
import { CUSTOMER_ANONYMOUS_COOKIE } from "@/domain/customer-identity";
import type { HoSoKhach } from "@/domain/ho-so-khach";
import { isCustomerBookingEnabled } from "@/lib/customer-data/booking-repository";
import { hoSoTheoPhien } from "@/lib/customer-data/ho-so-khach-repository";

export const metadata: Metadata = {
  title: "Hộ chiếu Ninh Bình · Ninh Bình Journey",
  description: "Những nơi bạn đã qua cổng, nhiệm vụ và quà cho chuyến sau.",
  robots: { index: false, follow: false },
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Máy đã từng đặt chỗ thì mở thẳng hồ sơ bằng cookie phiên; máy khác thì
// khách gõ mã đặt chỗ cùng số điện thoại.
export default async function TrangHoSo() {
  const bat = isCustomerBookingEnabled();
  let hoSo: HoSoKhach | null = null;
  if (bat) {
    const phien = (await cookies()).get(CUSTOMER_ANONYMOUS_COOKIE)?.value;
    if (phien && UUID.test(phien)) {
      try {
        hoSo = await hoSoTheoPhien(phien);
      } catch {
        hoSo = null;
      }
    }
  }
  return (
    <main className="min-h-screen bg-[#f4f0e7] px-4 py-8 sm:px-8 lg:py-14">
      <div className="mx-auto max-w-3xl">
        <Link href="/" className="text-sm font-bold text-[#356957] underline underline-offset-4">
          Về trang chủ
        </Link>
        <div className="mt-5">
          {!bat ? (
            <p className="rounded-3xl bg-white p-6 text-[#59654b]">Hồ sơ khách chưa mở ở bản này ạ.</p>
          ) : hoSo ? (
            <HoSoKhachView hoSo={hoSo} />
          ) : (
            <MoHoSo />
          )}
        </div>
      </div>
    </main>
  );
}
