import Link from "next/link";
import { Suspense } from "react";
import { ChiDiem } from "@/components/shared/chi-diem";
import { ThanhDauTrang } from "@/components/shared/thanh-dau-trang";
import { goiDaHetMua, goiHienThi } from "@/content/packages-en";
import { ch } from "@/lib/ngon-ngu";
import { docNgonNgu } from "@/lib/ngon-ngu-server";
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
  const lang = await docNgonNgu(params);
  const packageSlug =
    typeof params.package === "string" ? params.package : "slow-ninh-binh";
  const packageItem = getPackageBySlug(packageSlug);
  if (!packageItem) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f4f0e7] p-5">
        <p>{ch(lang, "Không tìm thấy gói này.", "We could not find this package.")}</p>
      </main>
    );
  }
  // Lối "thanh toán sandbox" cũ (ghi vào bảng bookings/passes của hệ /ops đã
  // bỏ) đã gỡ ngày 26/09/2026: nó chỉ hiện khi TẮT đặt chỗ thật, mà production
  // luôn bật. Tắt đặt chỗ thì trang nói thẳng là tạm đóng, ở khối phía trên.

  return (
    <>
      <ThanhDauTrang lang={lang} hienTai="goi" />
    <main lang={lang} className="min-h-screen bg-[#f4f0e7] px-5 py-10 text-[#151a17] sm:px-8 lg:py-16">
      <div className="mx-auto max-w-7xl">
        <div className="flex items-center justify-between gap-4">
          <Link
            href={`/packages/${packageItem.slug}`}
            className="text-sm font-bold text-[#356957]"
          >
            ← {ch(lang, "Chi tiết gói", "Package details")}
          </Link>
        </div>
        <p className="mt-9 text-xs font-extrabold uppercase tracking-[0.22em] text-[#356957]">
          {/* "Gói A · giữ chỗ trên lõi ERP" là chữ trong phòng làm việc, không
              phải chữ của khách: "Gói A" là tên một giai đoạn thi công, "lõi
              ERP" là tên một hệ thống nội bộ. Nó lại nằm ở dòng đầu tiên của
              trang thanh toán — chỗ đắt nhất trên cả luồng. Xem luật cấm chữ
              kỹ thuật lọt ra mặt khách ở docs/reference/UI_UX_RULES.md. */}
          {ch(lang, "Đặt vé vào cổng · chỗ giữ 15 phút", "Gate tickets · seats held for 15 minutes")}
        </p>
        <h1 className="font-display mt-4 text-5xl leading-[0.96] text-[#183f34] sm:text-7xl">
          {ch(lang, "Đặt vé và giữ chỗ", "Book and hold your seats")}
        </h1>
        <div className="mt-10">
          {goiDaHetMua(packageItem) ? (
            // Gói có hạn bán đã qua ngày cuối: ô ngày chẳng còn ngày nào chọn
            // được, nên nói thẳng thay vì bày một biểu mẫu không dùng được.
            <section data-testid="goi-het-mua" className="max-w-2xl rounded-3xl border border-[#d7d5cd] bg-white p-7">
              <h2 className="font-display text-3xl text-[#183f34]">
                {ch(lang, "Mùa này đã khép", "This season has closed")}
              </h2>
              <p className="mt-3 leading-7 text-[#59654b]">
                {ch(
                  lang,
                  `${goiHienThi(packageItem, lang).name} chỉ nhận đặt tới ${packageItem.bookingEndDate?.split("-").reverse().join("/")}. Mời bạn chọn một gói đi quanh năm.`,
                  `${goiHienThi(packageItem, lang).name} took bookings until ${packageItem.bookingEndDate?.split("-").reverse().join("/")}. Please choose a year-round package.`,
                )}
              </p>
              <Link
                href="/packages"
                className="mt-6 inline-flex min-h-11 items-center rounded-full bg-[#183f34] px-5 font-bold text-white"
              >
                {ch(lang, "Xem các gói", "See the packages")}
              </Link>
            </section>
          ) : (
            <CustomerBookingCheckout
              packageItem={packageItem}
              batDauHomNay={params.ngay === "hom-nay"}
              dienSan={{
                ngay: typeof params.ngay === "string" && /^\d{4}-\d{2}-\d{2}$/.test(params.ngay) ? params.ngay : undefined,
                gio: typeof params.gio === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(params.gio) ? params.gio : undefined,
                nguoiLon: Number(params.nguoiLon) || undefined,
                treEm: typeof params.treEm === "string" ? Number(params.treEm) || 0 : undefined,
              }}
              lang={lang}
              chuGoi={goiHienThi(packageItem, lang)}
            />
          )}
        </div>
      </div>
      {/* Bước 1 của màn Hướng dẫn trong ERP mở trang này kèm `?chi=`. */}
      {typeof params.chi === "string" ? (
        <Suspense fallback={null}>
          <ChiDiem />
        </Suspense>
      ) : null}
    </main>
    </>
  );
}
