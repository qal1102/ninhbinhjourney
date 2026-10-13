import Image from "next/image";
import Link from "next/link";
import { apBangGia, CAC_GOI, PACKAGES, VE_LE, type PackageCatalogItem } from "@/content/packages";
import { docBangGia } from "@/lib/commerce/bang-gia";
import { giaGoi, giaLeGoi, goiDaHetMua, goiHienThi } from "@/content/packages-en";
import { ThanhDauTrang } from "@/components/shared/thanh-dau-trang";
import { ch, type NgonNgu } from "@/lib/ngon-ngu";
import { docNgonNgu } from "@/lib/ngon-ngu-server";
import { getPackageHeroImage } from "@/content/package-images";
import {
  getExperiencePresentationFlags,
  getExperienceSurfaceAttributes,
  readPublicEnvironment,
} from "@/config/experience";
import { isCustomerBookingEnabled } from "@/lib/customer-data/booking-repository";
import { SharedImageTransition, SharedTitleTransition } from "@/components/shared/shared-image-transition";
import { ConTroNhan } from "@/components/shared/con-tro-nhan";
import { AnhNhu } from "@/components/shared/anh-nhu";
import {
  checkoutHref,
  packageCatalogBack,
  packageDetailHref,
  packageImageTransitionName,
  packageTitleTransitionName,
  readContinuityContext,
  type ContinuityContext,
} from "@/lib/page-continuity";

export const metadata = {
  title: "Mua vé tham quan | Ninh Bình Journey",
  description: "Vé Tràng An, Tam Cốc, Tam Chúc, Bái Đính đúng giá quầy, và lịch đi gợi ý trong ngày. Giữ chỗ 15 phút, trả bằng mã QR.",
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
          className="object-cover"
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
            <SharedTitleTransition name={packageTitleTransitionName(item.slug)}>
              <h2 className={`font-display mt-2 break-words leading-tight text-[#183f34] ${featured ? "text-4xl" : "text-3xl"}`}>
                {chu.name}
              </h2>
            </SharedTitleTransition>
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
                : ch(lang, "mỗi người lớn · gồm vé các điểm", "per adult · entry tickets included")}
            </p>
            {giaLeGoi(item, lang) ? <p className="text-xs font-bold text-[#8a5a1f]" data-testid="gia-le-goi">{giaLeGoi(item, lang)}</p> : null}
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

/** Thẻ vé lẻ: một điểm, giá đúng giá quầy, một nút mua. */
function TheVe({
  item,
  navigationContext,
  checkoutAvailable,
  lang,
}: {
  item: PackageCatalogItem;
  navigationContext: ContinuityContext;
  checkoutAvailable: boolean;
  lang: NgonNgu;
}) {
  const image = getPackageHeroImage(item, lang);
  const chu = goiHienThi(item, lang);
  return (
    <article id={`goi-${item.slug}`} data-testid={`ve-le-${item.slug}`} className="flex min-w-0 flex-col overflow-hidden rounded-3xl border border-[#d7d5cd] bg-white shadow-sm">
      <div className="relative aspect-[16/9]">
        <Image src={image.src} alt={image.alt} fill sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw" className="object-cover" />
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="font-display text-2xl leading-tight text-[#183f34]">{chu.name}</h3>
        <p className="mt-1 text-sm text-[#59654b]">{chu.durationLabel}</p>
        <p className="mt-4 font-display text-3xl leading-none text-[#151a17]" data-testid="gia-ve-le">
          {lang === "en" ? `VND ${item.demoPriceVnd.toLocaleString("en-US")}` : `${item.demoPriceVnd.toLocaleString("vi-VN")} đ`}
        </p>
        <p className="mt-1 text-xs text-[#645c4b]">{item.giaTreEmVnd ? ch(lang, `mỗi người lớn · trẻ 1m–1m3 ${item.giaTreEmVnd.toLocaleString("vi-VN")} đ`, `per adult · child 1–1.3 m VND ${item.giaTreEmVnd.toLocaleString("en-US")}`) : ch(lang, "mỗi người lớn", "per adult")}</p>
        <div className="mt-auto flex pt-5">
          {checkoutAvailable ? (
            <Link
              href={checkoutHref(item.slug, navigationContext)}
              data-customer-track="ticket-buy"
              data-customer-content-id={item.id}
              className="inline-flex min-h-12 flex-1 items-center justify-center rounded-full bg-[#183f34] px-5 font-extrabold text-white"
            >
              {ch(lang, "Mua vé", "Buy ticket")}
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
  // 125: tới từ đường dẫn mời `/moi/<mã>` (co: mã đúng, đã nhớ; sai: mã không có).
  const moiValue = params.moi;
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
  // Giá đọc từ bảng giá quầy (migration 124); không đọc được thì dùng giá dự phòng.
  const bangGia = await docBangGia();
  const veLe = VE_LE.map((item) => apBangGia(item, bangGia));
  const [featured, ...rest] = CAC_GOI.map((item) => apBangGia(item, bangGia));
  const quayLai = packageCatalogBack(navigationContext, Boolean(goiGoiY));
  const banTrang = PACKAGES.find((item) => item.slug === "ban-trang-tam-coc-2026");
  const banTrangDaKhep = banTrang ? goiDaHetMua(banTrang) : true;

  return (
    <>
      <ThanhDauTrang lang={lang} hienTai="goi" />
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
            href={quayLai.href}
            transitionTypes={["nav-back"]}
            className="text-sm font-bold text-[#356957]"
          >
            ← {quayLai.kieu === "hanh-trinh" ? ch(lang, "Quay lại hành trình", "Back to your journey") : ch(lang, "Về trang chủ", "Home")}
          </Link>
        </div>
        {moiValue === "co" || moiValue === "sai" ? (
          <p data-testid="bao-ma-moi" className="mt-6 max-w-2xl rounded-2xl border border-[#d58c35]/40 bg-[#fbf3e6] px-5 py-4 text-sm leading-6 text-[#4d4636]">
            {moiValue === "co"
              ? ch(lang, "Bạn được bạn bè mời: chọn vé bên dưới, mã mời đã điền sẵn ở trang thanh toán, đơn được giảm 10%.", "A friend invited you: pick a ticket below. The invite code is already filled in at checkout for 10% off.")
              : ch(lang, "Mã mời trong đường dẫn không có trong hệ thống. Bạn vẫn mua vé được với giá thường, hoặc hỏi lại bạn mình mã đúng.", "The invite code in the link was not found. You can still buy at the normal price, or ask your friend for the right code.")}
          </p>
        ) : null}
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
          {ch(lang, "Mua vé tham quan", "Buy entry tickets")}
        </h1>
        <p className="mt-4 max-w-2xl text-lg leading-8 text-[#59654b]">
          {ch(lang, "Giá trên web bằng đúng giá bán ở quầy. Chọn ngày giờ, giữ chỗ 15 phút, trả bằng mã QR rồi nhận vé ngay trên điện thoại.", "Prices online are exactly the desk prices. Pick a date and time, hold your place for 15 minutes, pay by QR code and get your ticket on your phone.")}
        </p>
        <div id="ve" className="mt-8 grid scroll-mt-6 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {veLe.map((item) => (
            <TheVe key={item.id} item={item} navigationContext={navigationContext} checkoutAvailable={checkoutAvailable} lang={lang} />
          ))}
        </div>
        <h2 id="lich-goi-y" className="font-display mt-16 scroll-mt-6 text-[clamp(2rem,5vw,3.2rem)] leading-tight text-[#183f34]">
          {ch(lang, "Lịch đi gợi ý trong ngày", "Suggested day plans")}
        </h2>
        <p className="mt-4 max-w-2xl text-lg leading-8 text-[#59654b]">
          {ch(
            lang,
            `Chưa biết đi đâu trước? Mỗi lịch ghép sẵn giờ đi các điểm hợp nhau, giá bằng tổng vé các điểm trong lịch, không thu thêm.${banTrangDaKhep ? " Bàn Trăng, bữa tối Trung thu bên sông Ngô Đồng, đã khép mùa 2026; trang vẫn giữ để bạn xem lại." : " Cuối trang là Bàn Trăng, bữa tối theo mùa bên sông Ngô Đồng, tính theo bàn hai khách."}`,
            `Not sure where to start? Each plan sets times for sites that go well together, priced at the sum of the entry tickets, nothing added.${banTrangDaKhep ? " The Moon Table, a Mid-Autumn dinner by the Ngo Dong, has closed for 2026; it stays here for you to look back on." : " At the end is the Moon Table, a seasonal dinner by the Ngo Dong river, priced per table for two."}`,
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
    </>
  );
}
