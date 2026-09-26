import Link from "next/link";
import { readPublicEnvironment } from "@/config/experience";
import { getPackageBySlug } from "@/content/packages";
import { CustomerBookingCheckout } from "@/components/commerce/customer-booking-checkout";
import { SetupState } from "@/components/shared/setup-state";
import { isCustomerBookingEnabled } from "@/lib/customer-data/booking-repository";

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const environment = readPublicEnvironment();
  const customerBookingEnabled = isCustomerBookingEnabled();
  if (environment.status === "missing") {
    return <SetupState environment={environment} surface="Sandbox checkout" />;
  }
  if (!customerBookingEnabled) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f4f0e7] p-5 text-[#151a17]">
        <section className="max-w-xl rounded-3xl border border-[#d7d5cd] bg-white p-8 text-center">
          <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#356957]">
            Đặt chỗ trực tuyến
          </p>
          <h1 className="font-display mt-3 text-4xl text-[#183f34]">
            Đặt chỗ trên web đang tạm đóng.
          </h1>
          <p className="mt-4 leading-7 text-[#59654b]">
            Hiện chưa giữ chỗ và thanh toán trên web được. Bạn vẫn xem được
            các gói, và gọi cho chúng tôi để đặt trực tiếp.
          </p>
          <Link
            href="/packages"
            className="mt-6 inline-flex min-h-11 items-center rounded-full border border-[#183f34] px-5 font-bold"
          >
            Xem các gói
          </Link>
        </section>
      </main>
    );
  }
  const params = await searchParams;
  const packageSlug =
    typeof params.package === "string" ? params.package : "slow-ninh-binh";
  const packageItem = getPackageBySlug(packageSlug);
  if (!packageItem) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f4f0e7] p-5">
        <p>Gói demo không tồn tại.</p>
      </main>
    );
  }
  const itineraryId =
    typeof params.journey === "string" ? params.journey : undefined;
  // Lối "thanh toán sandbox" cũ (ghi vào bảng bookings/passes của hệ /ops đã
  // bỏ) đã gỡ ngày 26/09/2026: nó chỉ hiện khi TẮT đặt chỗ thật, mà production
  // luôn bật. Tắt đặt chỗ thì trang nói thẳng là tạm đóng, ở khối phía trên.

  return (
    <main className="min-h-screen bg-[#f4f0e7] px-5 py-10 text-[#151a17] sm:px-8 lg:py-16">
      <div className="mx-auto max-w-7xl">
        <Link
          href={`/packages/${packageItem.slug}${itineraryId ? `?journey=${itineraryId}` : ""}`}
          className="text-sm font-bold text-[#356957]"
        >
          ← Chi tiết gói
        </Link>
        <p className="mt-9 text-xs font-extrabold uppercase tracking-[0.22em] text-[#356957]">
          {/* "Gói A · giữ chỗ trên lõi ERP" là chữ trong phòng làm việc, không
              phải chữ của khách: "Gói A" là tên một giai đoạn thi công, "lõi
              ERP" là tên một hệ thống nội bộ. Nó lại nằm ở dòng đầu tiên của
              trang thanh toán — chỗ đắt nhất trên cả luồng. Xem luật cấm chữ
              kỹ thuật lọt ra mặt khách ở docs/reference/UI_UX_RULES.md. */}
          Đặt vé vào cổng · chỗ giữ 15 phút
        </p>
        <h1 className="font-display mt-4 text-5xl leading-[0.96] text-[#183f34] sm:text-7xl">
          Một chỗ đã giữ,
          <br />
          không có khoản tiền bị thu.
        </h1>
        <div className="mt-10">
          <CustomerBookingCheckout packageItem={packageItem} />
        </div>
      </div>
    </main>
  );
}
