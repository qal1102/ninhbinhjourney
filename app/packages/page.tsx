import Image from "next/image";
import Link from "next/link";
import { PACKAGES, type PackageCatalogItem } from "@/content/packages";
import { giaGoi, goiDaHetMua, goiHienThi } from "@/content/packages-en";
import { NutNgonNgu } from "@/components/shared/nut-ngon-ngu";
import { NuiSuong } from "@/components/shared/nui-suong";
import { ch, type NgonNgu } from "@/lib/ngon-ngu";
import { docNgonNgu } from "@/lib/ngon-ngu-server";
import { getPackageHeroImage } from "@/content/package-images";
import {
  getExperiencePresentationFlags,
  getExperienceSurfaceAttributes,
  readPublicEnvironment,
} from "@/config/experience";
import { isCustomerBookingEnabled } from "@/lib/customer-data/booking-repository";
import { SharedImageTransition } from "@/components/shared/shared-image-transition";
import { ConTroNhan } from "@/components/shared/con-tro-nhan";
import { AnhNhu } from "@/components/shared/anh-nhu";
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
  lang,
}: {
  item: PackageCatalogItem;
  navigationContext: ContinuityContext;
  checkoutAvailable: boolean;
  featured?: boolean;
  reversed?: boolean;
  suggested?: boolean;
  lang: NgonNgu;
}) {
  const image = getPackageHeroImage(item, lang);
  const chu = goiHienThi(item, lang);
  const hetMua = goiDaHetMua(item);
  const detailHref = packageDetailHref(item.slug, navigationContext, "catalog");

  return (
    <article
      id={`goi-${item.slug}`}
      data-anh-nhu
      className={`ve-giay relative scroll-mt-6 overflow-hidden rounded-3xl border bg-white shadow-sm ${suggested ? "border-[#d58c35] ring-2 ring-[#d58c35]/50" : "border-[#d7d5cd]"} ${
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
          className="object-cover hien-tu-suong"
        />
        {/* Cả tấm ảnh dẫn sang trang gói. Bàn phím và trình đọc màn hình đi bằng nút "Xem chi tiết" bên dưới, nên lối này không nhận tab. */}
        <Link
          href={detailHref}
          transitionTypes={["nav-forward"]}
          tabIndex={-1}
          aria-hidden="true"
          data-con-tro={ch(lang, "Xem", "View")}
          className="absolute inset-0"
        />
      </SharedImageTransition>
      <div className={featured ? "min-w-0 p-5 min-[280px]:p-6 sm:p-8 xl:p-10" : "min-w-0 p-5 min-[280px]:p-6 sm:p-8 xl:flex-1"}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1 basis-[16rem]">
            <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#557568]">
              {chu.durationLabel} · {chu.nhip}
            </p>
            <h2 className={`font-display mt-2 break-words leading-tight text-[#183f34] ${featured ? "text-4xl" : "text-3xl"}`}>
              {chu.name}
            </h2>
            <p className="mt-2 text-sm text-[#59654b]">{chu.audience}</p>
            {hetMua ? (
              <p data-testid="goi-het-mua" className="mt-3 inline-flex rounded-full bg-[#efe6d6] px-3 py-1 text-xs font-extrabold text-[#6b5326]">
                {ch(lang, "Mùa 2026 đã khép · hẹn mùa trăng năm sau", "The 2026 season has closed · see you next moon season")}
              </p>
            ) : null}
          </div>
          <div className="cuong-ve max-w-full rounded-2xl bg-[#f4f0e7] px-4 py-3 text-left min-[280px]:text-right">
            <p className="break-words font-display text-xl leading-tight">
              {giaGoi(item, lang)}
            </p>
            {/* QA-P2-09: gói tính theo bàn thì ghi đúng giá bàn, không ghi giá mỗi người lớn. */}
            <p className="text-xs text-[#645c4b]">
              {item.priceLabel
                ? ch(lang, "giá giới thiệu mùa 2026", "2026 introductory price")
                : ch(lang, "mỗi người lớn · giá minh hoạ", "per adult · sample price")}
            </p>
          </div>
        </div>
        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <div>
            <h3 className="text-sm font-bold">{ch(lang, "Bao gồm", "Included")}</h3>
            <ul className="mt-2 space-y-2 text-sm leading-6 text-[#59654b]">
              {chu.inclusions.map((value) => (
                <li key={value}>✓ {value}</li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-bold">{ch(lang, "Không bao gồm", "Not included")}</h3>
            <ul className="mt-2 space-y-2 text-sm leading-6 text-[#59654b]">
              {chu.exclusions.map((value) => (
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
            {ch(lang, "Xem chi tiết", "Details")}
          </Link>
          {checkoutAvailable && !hetMua ? (
            <Link
              href={checkoutHref(item.slug, navigationContext)}
              className="inline-flex min-h-11 items-center rounded-full bg-[#183f34] px-5 font-bold text-white"
            >
              {ch(lang, "Chọn gói", "Choose")}
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
  const lang = await docNgonNgu(params);
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
    <main lang={lang}
      {...surfaceAttributes}
      data-customer-section="packages-catalog"
      className="min-h-screen bg-[#f4f0e7] px-4 py-10 text-[#151a17] min-[280px]:px-5 sm:px-8 lg:py-16"
    >
      <ConTroNhan />
      <AnhNhu />
      <div className="mx-auto max-w-7xl">
        <div className="flex items-center justify-between gap-4">
          <Link
            href={packageCatalogBackHref(navigationContext)}
            transitionTypes={["nav-back"]}
            className="text-sm font-bold text-[#356957]"
          >
            ← {ch(lang, "Quay lại hành trình", "Back to your journey")}
          </Link>
          <NutNgonNgu lang={lang} />
        </div>
        <div className="mt-6 overflow-hidden rounded-3xl">
          <NuiSuong hat="goi" />
        </div>
        {goiGoiY ? (
          <p className="mt-6 max-w-2xl rounded-2xl border border-[#d58c35]/40 bg-[#fbf3e6] px-5 py-4 text-sm leading-6 text-[#4d4636]">
            {ch(lang, "Gói gần nhất với hành trình bạn vừa dựng là", "The package closest to the day you just planned is")}{" "}
            <strong className="text-[#183f34]">{goiHienThi(goiGoiY, lang).name}</strong>.{" "}
            <a href={`#goi-${goiGoiY.slug}`} className="font-bold text-[#356957] underline underline-offset-2">
              {ch(lang, "Xem gói này", "See it")}
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
            ? ch(lang, "Giữ chỗ 15 phút · quét mã QR là xong", "15-minute hold · pay by QR code")
            : flags.sandboxCheckout
              ? ch(lang, "Dữ liệu minh họa · giữ chỗ mô phỏng, chưa thu tiền thật", "Sample data · simulated hold, no real payment")
            : ch(lang, "Bảng giá tham khảo · chưa mở đặt online", "Reference prices · online booking not open")}
        </p>
        <h1 className="font-display mt-4 max-w-5xl text-[clamp(2.6rem,7vw,4.5rem)] leading-[0.95] text-[#183f34] [text-wrap:balance]">
          {ch(lang, "Năm cách đi Ninh Bình, và một bàn tiệc dưới trăng.", "Five ways through Ninh Binh, and a table under the moon.")}
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-[#59654b]">
          {ch(
            lang,
            "Chọn theo thời gian bạn có và kiểu đi bạn thích: cả ngày xem di sản, một ngày thong thả, buổi sáng cho cả nhà, một buổi chiều săn ảnh hoàng hôn, hay nửa ngày qua hồ lên chùa Tam Chúc. Cuối trang là Bàn Trăng, bữa tối theo mùa bên sông Ngô Đồng, tính theo bàn hai khách. Giá của năm gói còn lại là giá minh hoạ tính theo người lớn, chưa phải giá bán thật.",
            "Choose by the time you have and the way you like to travel: a full heritage day, a slow day, a morning for the whole family, an afternoon chasing sunset light, or half a day crossing the lake to Tam Chuc's temples. At the end is the Moon Table, a seasonal dinner by the Ngo Dong river, priced per table for two. The other five prices are samples per adult, not real selling prices.",
          )}
        </p>
        <div className="mt-10 flex flex-col gap-6 lg:gap-8">
          <PackageCard
            item={featured}
            navigationContext={navigationContext}
            checkoutAvailable={checkoutAvailable}
            featured
            suggested={goiGoiY?.slug === featured.slug}
            lang={lang}
          />
          {rest.map((item, index) => (
            <PackageCard
              key={item.id}
              item={item}
              navigationContext={navigationContext}
              checkoutAvailable={checkoutAvailable}
              reversed={index % 2 === 1}
              suggested={goiGoiY?.slug === item.slug}
              lang={lang}
            />
          ))}
        </div>
      </div>
    </main>
  );
}
