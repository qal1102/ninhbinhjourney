import Image from "next/image";
import Link from "next/link";
import { PACE_LABEL, PACKAGES, type PackageCatalogItem } from "@/content/packages";
import { getPackageHeroImage } from "@/content/package-images";
import {
  getExperiencePresentationFlags,
  readPublicEnvironment,
} from "@/config/experience";
import { isCustomerBookingEnabled } from "@/lib/customer-data/booking-repository";

export const metadata = {
  title: "Gói hành trình | Ninh Bình Journey",
};

function PackageCard({
  item,
  journey,
  checkoutAvailable,
  featured,
  reversed,
}: {
  item: PackageCatalogItem;
  journey: string | undefined;
  checkoutAvailable: boolean;
  featured?: boolean;
  reversed?: boolean;
}) {
  const image = getPackageHeroImage(item);
  const detailHref = `/packages/${item.slug}${journey ? `?journey=${journey}` : ""}`;

  return (
    <article
      className={`overflow-hidden rounded-3xl border border-[#d7d5cd] bg-white shadow-sm ${
        featured ? "lg:grid lg:grid-cols-[1.1fr_1fr]" : `lg:flex lg:items-stretch ${reversed ? "lg:flex-row-reverse" : ""}`
      }`}
    >
      <div
        className={`relative ${
          featured ? "aspect-[16/10] lg:aspect-auto" : "aspect-[16/10] lg:aspect-auto lg:w-2/5 lg:shrink-0"
        }`}
      >
        <Image
          src={image.src}
          alt={image.alt}
          fill
          sizes={featured ? "(min-width: 1024px) 55vw, 100vw" : "(min-width: 1024px) 40vw, 100vw"}
          className="object-cover"
        />
      </div>
      <div className={featured ? "p-6 sm:p-8 lg:p-10" : "p-6 sm:p-8 lg:flex-1"}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#557568]">
              {item.durationLabel} · {PACE_LABEL[item.pace]}
            </p>
            <h2 className={`font-display mt-2 text-[#183f34] ${featured ? "text-4xl" : "text-3xl"}`}>
              {item.name}
            </h2>
            <p className="mt-2 text-sm text-[#59654b]">{item.audience}</p>
          </div>
          <div className="rounded-2xl bg-[#f4f0e7] px-4 py-3 text-right">
            <p className="font-display text-xl">
              {item.demoPriceVnd.toLocaleString("vi-VN")} VND
            </p>
            <p className="text-xs text-[#645c4b]">mỗi người lớn · demo</p>
          </div>
        </div>
        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <div>
            <h3 className="text-sm font-bold">Bao gồm</h3>
            <ul className="mt-2 space-y-2 text-sm leading-6 text-[#59654b]">
              {item.inclusions.map((value) => (
                <li key={value}>✓ {value}</li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-bold">Không bao gồm</h3>
            <ul className="mt-2 space-y-2 text-sm leading-6 text-[#59654b]">
              {item.exclusions.map((value) => (
                <li key={value}>— {value}</li>
              ))}
            </ul>
          </div>
        </div>
        <div className="mt-7 flex flex-wrap gap-3">
          <Link
            data-customer-track="package-detail"
            data-customer-content-id={item.id}
            data-customer-content-type="package"
            href={detailHref}
            className="inline-flex min-h-11 items-center rounded-full border border-[#183f34] px-5 font-bold text-[#183f34]"
          >
            Xem chi tiết
          </Link>
          {checkoutAvailable ? (
            <Link
              href={`/checkout?package=${item.slug}${journey ? `&journey=${journey}` : ""}`}
              className="inline-flex min-h-11 items-center rounded-full bg-[#183f34] px-5 font-bold text-white"
            >
              Chọn gói
            </Link>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export default async function PackagesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const journeyValue = (await searchParams).journey;
  const journey = typeof journeyValue === "string" ? journeyValue : undefined;
  const flags = getExperiencePresentationFlags(readPublicEnvironment());
  const customerBookingEnabled = isCustomerBookingEnabled();
  const checkoutAvailable = flags.sandboxCheckout || customerBookingEnabled;
  const [featured, ...rest] = PACKAGES;

  return (
    <main data-customer-section="packages-catalog" className="min-h-screen bg-[#f4f0e7] px-5 py-10 text-[#151a17] sm:px-8 lg:py-16">
      <div className="mx-auto max-w-7xl">
        <Link href={journey ? `/journey/${journey}` : "/plan"} className="text-sm font-bold text-[#356957]">
          ← Quay lại hành trình
        </Link>
        <p className="mt-10 text-xs font-extrabold uppercase tracking-[0.22em] text-[#356957]">
          {customerBookingEnabled
            ? "Giữ chỗ 15 phút theo công suất ERP · thanh toán mô phỏng"
            : flags.sandboxCheckout
              ? "Dữ liệu minh họa · giữ chỗ mô phỏng, chưa thu tiền thật"
            : "Bảng giá tham khảo · chưa mở đặt online"}
        </p>
        <h1 className="font-display mt-4 max-w-5xl text-5xl leading-[0.95] text-[#183f34] sm:text-7xl">
          Bốn cách đi Ninh Bình, và một bàn tiệc dưới trăng.
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-[#59654b]">
          Chọn theo thời gian bạn có và điều bạn muốn cảm nhận — di sản trọn
          ngày, một ngày chậm rãi, buổi sáng cùng gia đình hay một chiều hoàng
          hôn cho ảnh đẹp. Cuối trang là Bàn Trăng, bữa tối theo mùa bên sông
          Ngô Đồng, tính theo bàn hai khách. Giá của bốn gói còn lại là dữ liệu
          minh họa tính theo người lớn, không phải giá thị trường hiện hành.
        </p>
        <div className="mt-10 flex flex-col gap-6 lg:gap-8">
          <PackageCard
            item={featured}
            journey={journey}
            checkoutAvailable={checkoutAvailable}
            featured
          />
          {rest.map((item, index) => (
            <PackageCard
              key={item.id}
              item={item}
              journey={journey}
              checkoutAvailable={checkoutAvailable}
              reversed={index % 2 === 1}
            />
          ))}
        </div>
      </div>
    </main>
  );
}
