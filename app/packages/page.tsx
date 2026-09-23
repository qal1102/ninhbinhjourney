import Image from "next/image";
import Link from "next/link";
import { PACE_LABEL, PACKAGES, type PackageCatalogItem } from "@/content/packages";
import { getPackageHeroImage } from "@/content/package-images";
import {
  getExperiencePresentationFlags,
  getExperienceSurfaceAttributes,
  readPublicEnvironment,
} from "@/config/experience";
import { isCustomerBookingEnabled } from "@/lib/customer-data/booking-repository";
import { SharedImageTransition } from "@/components/shared/shared-image-transition";
import {
  checkoutHref,
  packageCatalogBackHref,
  packageDetailHref,
  packageImageTransitionName,
  readContinuityContext,
  type ContinuityContext,
} from "@/lib/page-continuity";

export const metadata = {
  title: "Gói hành trình | Ninh Bình Journey",
  description: "Những gói đi sẵn quanh Ninh Bình, giữ chỗ 15 phút và trả tiền khi tới nơi.",
  alternates: { canonical: "/packages" },
};

function PackageCard({
  item,
  navigationContext,
  checkoutAvailable,
  featured,
  reversed,
  suggested,
}: {
  item: PackageCatalogItem;
  navigationContext: ContinuityContext;
  checkoutAvailable: boolean;
  featured?: boolean;
  reversed?: boolean;
  suggested?: boolean;
}) {
  const image = getPackageHeroImage(item);
  const detailHref = packageDetailHref(item.slug, navigationContext, "catalog");

  return (
    <article
      id={`goi-${item.slug}`}
      className={`scroll-mt-6 overflow-hidden rounded-3xl border bg-white shadow-sm ${suggested ? "border-[#d58c35] ring-2 ring-[#d58c35]/50" : "border-[#d7d5cd]"} ${
        featured ? "xl:grid xl:grid-cols-[1.1fr_1fr]" : `xl:flex xl:items-stretch ${reversed ? "xl:flex-row-reverse" : ""}`
      }`}
    >
      <SharedImageTransition
        name={packageImageTransitionName(item.slug)}
        className={`relative ${
          featured ? "aspect-[16/10] xl:aspect-auto" : "aspect-[16/10] xl:aspect-auto xl:w-2/5 xl:shrink-0"
        }`}
      >
        <Image
          src={image.src}
          alt={image.alt}
          fill
          sizes={featured ? "(min-width: 1280px) 55vw, 100vw" : "(min-width: 1280px) 40vw, 100vw"}
          className="object-cover"
        />
      </SharedImageTransition>
      <div className={featured ? "min-w-0 p-5 min-[280px]:p-6 sm:p-8 xl:p-10" : "min-w-0 p-5 min-[280px]:p-6 sm:p-8 xl:flex-1"}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1 basis-[16rem]">
            <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#557568]">
              {item.durationLabel} · {PACE_LABEL[item.pace]}
            </p>
            <h2 className={`font-display mt-2 break-words leading-tight text-[#183f34] ${featured ? "text-4xl" : "text-3xl"}`}>
              {item.name}
            </h2>
            <p className="mt-2 text-sm text-[#59654b]">{item.audience}</p>
          </div>
          <div className="max-w-full rounded-2xl bg-[#f4f0e7] px-4 py-3 text-left min-[280px]:text-right">
            <p className="break-words font-display text-xl leading-tight">
              {item.priceLabel ?? `${item.demoPriceVnd.toLocaleString("vi-VN")} VND`}
            </p>
            {/* QA-P2-09: gói tính theo bàn thì ghi đúng giá bàn, không ghi giá mỗi người lớn. */}
            <p className="text-xs text-[#645c4b]">{item.priceLabel ? "giá giới thiệu mùa 2026" : "mỗi người lớn · demo"}</p>
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
            transitionTypes={["nav-forward"]}
            className="inline-flex min-h-11 items-center rounded-full border border-[#183f34] px-5 font-bold text-[#183f34]"
          >
            Xem chi tiết
          </Link>
          {checkoutAvailable ? (
            <Link
              href={checkoutHref(item.slug, navigationContext)}
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
  const params = await searchParams;
  const navigationContext = readContinuityContext(params);
  // QA-P2-09: gói gần nhất với hành trình khách vừa dựng ở /plan.
  const goiValue = params.goi;
  const goiGoiY = typeof goiValue === "string" ? PACKAGES.find((item) => item.slug === goiValue) : undefined;
  const environment = readPublicEnvironment();
  const flags = getExperiencePresentationFlags(environment);
  const customerBookingEnabled = isCustomerBookingEnabled();
  // Phép hợp "sandbox HOẶC đặt chỗ thật" đã chuyển hẳn vào
  // `getExperienceSurfaceAttributes`, để nút "Chọn gói" dưới đây và thuộc tính
  // trang tự khai luôn nói cùng một điều. Trước đây hai chỗ tính riêng thì chỉ
  // cần sửa lệch một bên là bài kiểm đọc sai cấu hình mà không ai biết.
  const surfaceAttributes = getExperienceSurfaceAttributes(environment, {
    customerBookingEnabled,
  });
  const checkoutAvailable =
    surfaceAttributes["data-checkout-available"] === "true";
  const [featured, ...rest] = PACKAGES;

  return (
    <main
      {...surfaceAttributes}
      data-customer-section="packages-catalog"
      className="min-h-screen bg-[#f4f0e7] px-4 py-10 text-[#151a17] min-[280px]:px-5 sm:px-8 lg:py-16"
    >
      <div className="mx-auto max-w-7xl">
        <Link
          href={packageCatalogBackHref(navigationContext)}
          transitionTypes={["nav-back"]}
          className="text-sm font-bold text-[#356957]"
        >
          ← Quay lại hành trình
        </Link>
        {goiGoiY ? (
          <p className="mt-6 max-w-2xl rounded-2xl border border-[#d58c35]/40 bg-[#fbf3e6] px-5 py-4 text-sm leading-6 text-[#4d4636]">
            Gói gần nhất với hành trình bạn vừa dựng là <strong className="text-[#183f34]">{goiGoiY.name}</strong>.{" "}
            <a href={`#goi-${goiGoiY.slug}`} className="font-bold text-[#356957] underline underline-offset-2">
              Xem gói này
            </a>
          </p>
        ) : null}
        <p className="mt-10 text-xs font-extrabold uppercase tracking-[0.22em] text-[#356957]">
          {customerBookingEnabled
            // Hai chỗ hỏng trong một dòng cũ ("Giữ chỗ 15 phút theo công suất
            // ERP · thanh toán mô phỏng"): "ERP" là chữ nội bộ, và "thanh toán
            // mô phỏng" là lời cảnh báo đứng ngay cửa danh mục — đúng cái đã
            // giết trang thanh toán hồi trước. Nói cái CÓ trước; phần chưa đấu
            // nối ngân hàng vẫn nói đủ ở /checkout, còn giá minh hoạ vẫn nói
            // thẳng trong đoạn ngay dưới đây.
            ? "Giữ chỗ 15 phút · trả tiền khi tới nơi"
            : flags.sandboxCheckout
              ? "Dữ liệu minh họa · giữ chỗ mô phỏng, chưa thu tiền thật"
            : "Bảng giá tham khảo · chưa mở đặt online"}
        </p>
        <h1 className="font-display mt-4 max-w-5xl text-[clamp(2.6rem,7vw,4.5rem)] leading-[0.95] text-[#183f34] [text-wrap:balance]">
          Bốn cách đi Ninh Bình, và một bàn tiệc dưới trăng.
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-[#59654b]">
          Chọn theo thời gian bạn có và kiểu đi bạn thích: cả ngày xem di
          sản, một ngày thong thả, buổi sáng cho cả nhà, hay một buổi chiều
          săn ảnh hoàng hôn. Cuối trang là Bàn Trăng, bữa tối theo mùa bên sông
          Ngô Đồng, tính theo bàn hai khách. Giá của bốn gói còn lại là giá
          minh hoạ tính theo người lớn, chưa phải giá bán thật.
        </p>
        <div className="mt-10 flex flex-col gap-6 lg:gap-8">
          <PackageCard
            item={featured}
            navigationContext={navigationContext}
            checkoutAvailable={checkoutAvailable}
            featured
            suggested={goiGoiY?.slug === featured.slug}
          />
          {rest.map((item, index) => (
            <PackageCard
              key={item.id}
              item={item}
              navigationContext={navigationContext}
              checkoutAvailable={checkoutAvailable}
              reversed={index % 2 === 1}
              suggested={goiGoiY?.slug === item.slug}
            />
          ))}
        </div>
      </div>
    </main>
  );
}
