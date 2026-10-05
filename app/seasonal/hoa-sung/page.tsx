import Image from "next/image";
import Link from "next/link";
import { BanDoHoaSungTre } from "@/components/discovery/ban-do-hoa-sung-tre";
import { DongHoHoaNo } from "@/components/discovery/dong-ho-hoa-no";
import { KeMua } from "@/components/discovery/ke-mua";
import { WorldSwitcher } from "@/components/discovery/world-switcher";
import { NutNgonNgu } from "@/components/shared/nut-ngon-ngu";
import { getPackageBySlug } from "@/content/packages";
import { giaGoi, goiHienThi } from "@/content/packages-en";
import { NHAN_CHAC_CHAN } from "@/domain/lich-mua-vu";
import { cacMuaToi, ngayDoc, tinhTrangHoaSung, type MuaHoaSung } from "@/domain/mua-hoa-sung";
import { doDaiTuyen, TUYEN_THUYEN } from "@/domain/thuyen-song";
import { docNgonNgu } from "@/lib/ngon-ngu-server";

/**
 * Mùa hoa súng Tam Cốc và lễ Sắc Hồng: sự kiện theo mùa nối sau Trung thu
 * (chủ dự án duyệt 04/10/2026). Trang tự tính mùa đang tới cho mọi năm từ Lịch
 * mùa vụ (`domain/mua-hoa-sung.ts`), nên không phải dựng lại mỗi năm; ngày lễ
 * năm nào chưa công bố thì ghi "dự kiến".
 */

export const metadata = {
  title: "Mùa hoa súng Tam Cốc | Ninh Bình Journey",
  description: "Hoa súng nở trên sông Ngô Đồng từ cuối tháng 10, lễ Sắc Hồng Tam Cốc, đò sớm đúng giờ hoa nở.",
  alternates: { canonical: "/seasonal/hoa-sung" },
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

const NGUON = [
  { ten: "Tuổi Trẻ, 26/10/2025 · Mùa hoa súng rực rỡ ở Ninh Bình", url: "https://tuoitre.vn/mua-hoa-sung-ruc-ro-o-ninh-binh-khien-du-khach-ngo-ngang-20251026154627142.htm" },
  { ten: "Du lịch Ninh Bình · Giai điệu hoa súng 2025", url: "https://dulichninhbinh.com.vn/item/3405" },
  { ten: "vntravel.org.vn · Sắc Hồng Tam Cốc 2025", url: "https://vntravel.org.vn/du-lich-ninh-binh-mua-thu-trai-nghiem-sac-hong-tam-coc-lang-man-a7642.html" },
  { ten: "Ảnh đầu trang: minh ha, Wikimedia Commons, CC0", url: "https://commons.wikimedia.org/wiki/File:Water_lily_(26204467139).jpg" },
];

function ngayNgan(iso: string) {
  const [, thang, ngay] = iso.split("-");
  return `${ngay}/${thang}`;
}

export default async function HoaSungPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const lang = await docNgonNgu(params);
  const source = firstParam(params.source) ?? "";
  const t = (vi: string, en: string) => (lang === "en" ? en : vi);

  const bayGio = new Date();
  const tinhTrang = tinhTrangHoaSung(bayGio);
  const { mua, giaiDoan } = tinhTrang;
  const cacMua = cacMuaToi(bayGio, 3);
  const goi = getPackageBySlug("do-som-mua-hoa-sung");
  const chuGoi = goi ? goiHienThi(goi, lang) : null;
  const linkGoi = (() => {
    const q = new URLSearchParams({ package: "do-som-mua-hoa-sung", lang });
    if (source) q.set("source", source);
    return `/checkout?${q.toString()}`;
  })();
  const chacChanLe = NHAN_CHAC_CHAN[mua.le.chacChan];
  const soKm = (doDaiTuyen(TUYEN_THUYEN["tam-coc"]) / 1000).toLocaleString(lang === "en" ? "en-GB" : "vi-VN", {
    maximumFractionDigits: 1,
  });
  const qMua = new URLSearchParams({ lang });
  if (source) qMua.set("source", source);

  const trangThaiChu =
    giaiDoan === "sap-toi"
      ? t(`Còn ${tinhTrang.ngayToiMua} ngày tới mùa hoa ${mua.nam}`, `${tinhTrang.ngayToiMua} days until the ${mua.nam} lily season`)
      : giaiDoan === "le-hoi"
        ? t("Lễ Sắc Hồng đang diễn ra trên sông", "The Sac Hong festival is on the river now")
        : giaiDoan === "cuoi-mua"
          ? t(`Cuối mùa hoa, tới ${ngayDoc(mua.den)}`, `Late in the season, until ${ngayDoc(mua.den)}`)
          : t(
              tinhTrang.ngayToiLe > 0 ? `Đang mùa hoa · còn ${tinhTrang.ngayToiLe} ngày tới lễ Sắc Hồng` : "Đang mùa hoa",
              tinhTrang.ngayToiLe > 0 ? `In bloom · ${tinhTrang.ngayToiLe} days to the Sac Hong festival` : "In bloom",
            );

  const dongMua = (m: MuaHoaSung) => (
    <tr key={m.nam} className="border-b border-[#e8dde9] last:border-b-0">
      <th scope="row" className="py-3 pr-4 text-left font-display text-2xl text-[#183f34]">{m.nam}</th>
      <td className="py-3 pr-4 text-sm text-[#4d5b55]">
        {ngayNgan(m.tu)} – {ngayNgan(m.den)}
        <span className="block text-xs text-[#8a7f8d]">{t("ước lượng", "estimate")}</span>
      </td>
      <td className="py-3 text-sm text-[#4d5b55]">
        {ngayNgan(m.le.tu)} – {ngayNgan(m.le.den)}
        <span className={`block text-xs ${m.le.chacChan === "da-cong-bo" ? "font-bold text-[#28654d]" : "text-[#8a7f8d]"}`}>
          {m.le.chacChan === "da-cong-bo" ? t("đã công bố", "announced") : t("dự kiến, chờ công bố", "expected, awaiting announcement")}
        </span>
      </td>
    </tr>
  );

  return (
    <main lang={lang} className="min-h-screen bg-[#f7f2ee] text-[#183f34]" data-testid="trang-hoa-sung" data-giai-doan={giaiDoan}>
      <WorldSwitcher hienTai="seasonal" lang={lang} source={source} tone="toi" trangMua="hoa-sung" />

      <section className="relative -mt-[73px] overflow-hidden bg-[#140f0c] text-[#fbf7ee]" data-testid="dau-trang-hoa-sung">
        <div className="absolute inset-x-0 top-0 h-[74svh] lg:inset-0 lg:h-auto">
          <Image
            src="/images/campaigns/hoa-sung/bong-sung-sang-som.webp"
            alt={t("Một bông súng hồng nở giữa lá súng lúc sáng sớm", "A pink water lily open among its pads in the early morning")}
            fill
            priority
            sizes="100vw"
            className="object-cover object-[64%_38%] lg:object-[72%_44%]"
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(20,15,12,.55)_0%,rgba(20,15,12,0)_26%,rgba(20,15,12,.15)_55%,#140f0c_100%)] lg:bg-[linear-gradient(90deg,rgba(20,15,12,.94)_0%,rgba(20,15,12,.78)_34%,rgba(20,15,12,.12)_66%,rgba(20,15,12,0)_100%)]" />
          <div className="absolute inset-x-0 bottom-0 hidden h-40 bg-gradient-to-t from-[#140f0c] to-transparent lg:block" />
        </div>
        <div className="relative mx-auto flex max-w-7xl flex-col justify-end px-5 pb-10 pt-[52svh] sm:px-8 lg:min-h-[94svh] lg:pb-20 lg:pt-36">
          <div className="max-w-2xl">
            <div className="flex flex-col-reverse items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[0.66rem] font-extrabold uppercase tracking-[0.3em] text-[#f0b8d2]">
                {t(`Sự kiện theo mùa · Tam Cốc · ${mua.nam}`, `Seasonal · Tam Coc · ${mua.nam}`)}
              </p>
              <NutNgonNgu lang={lang} />
            </div>
            <h1 className="font-display mt-5 text-5xl leading-[0.92] sm:text-7xl lg:text-[5.6rem]">
              {t("Hoa súng nở trên sông Ngô Đồng", "Water lilies on the Ngo Dong River")}
            </h1>
            <p className="mt-6 max-w-xl text-base leading-8 text-white/78 sm:text-lg">
              {t(
                "Từ cuối tháng 10, hai bên dòng Ngô Đồng phủ hoa súng tím hồng. Hoa chỉ nở buổi sáng, khoảng 7 tới 10 giờ, rồi cụp lại. Đi đò sớm là thấy trọn.",
                "From late October the banks of the Ngo Dong fill with pink and violet water lilies. They open only in the morning, roughly 7 to 10 am, then close. Take an early boat to see them at their fullest.",
              )}
            </p>
            <p
              className="mt-7 inline-flex min-h-11 items-center gap-2 rounded-full bg-white/12 px-5 text-sm font-bold text-[#fbf7ee] ring-1 ring-white/25 backdrop-blur-sm"
              data-testid="trang-thai-mua"
            >
              <span aria-hidden="true" className="h-2 w-2 rounded-full bg-[#f0b8d2]" />
              {trangThaiChu}
            </p>
            <ol className="mt-8 grid max-w-xl grid-cols-3 border-y border-white/18 text-sm text-white/85">
              <li className="border-r border-white/18 px-3 py-4 pl-0">
                <span className="block text-[0.68rem] font-bold uppercase tracking-[0.14em] text-[#f0b8d2]">{t("Mùa hoa", "Bloom")}</span>
                {ngayNgan(mua.tu)} – {ngayNgan(mua.den)}
              </li>
              <li className="border-r border-white/18 px-3 py-4">
                <span className="block text-[0.68rem] font-bold uppercase tracking-[0.14em] text-[#f0b8d2]">{t("Giờ nở", "Opens")}</span>
                {t("7–10 giờ sáng", "7–10 am")}
              </li>
              <li className="px-3 py-4">
                <span className="block text-[0.68rem] font-bold uppercase tracking-[0.14em] text-[#f0b8d2]">{t("Lễ Sắc Hồng", "Sac Hong")}</span>
                {ngayNgan(mua.le.tu)} – {ngayNgan(mua.le.den)}
              </li>
            </ol>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href={linkGoi}
                className="inline-flex min-h-12 items-center rounded-full bg-[#e7a6c4] px-6 text-sm font-extrabold text-[#2a1622] transition hover:bg-[#f0bad3]"
                data-testid="dat-do-som"
              >
                {t("Đặt đò sớm mùa hoa", "Book an early lily boat")}
              </Link>
              <a
                href="#sac-hong"
                className="inline-flex min-h-12 items-center rounded-full border border-white/40 px-6 text-sm font-bold text-[#fbf7ee] transition hover:border-white"
              >
                {t("Xem lễ Sắc Hồng", "See the Sac Hong festival")}
              </a>
            </div>
          </div>
        </div>
        <p className="relative mx-auto max-w-7xl px-5 pb-5 text-[0.68rem] text-white/45 sm:px-8 lg:absolute lg:inset-x-0 lg:bottom-0 lg:text-right">
          {t("Bông súng lúc 6:54 sáng, 28/10/2017 · Ảnh: minh ha, CC0", "A lily at 6:54 am, 28 October 2017 · Photo: minh ha, CC0")}
        </p>
      </section>

      <section className="px-5 py-16 sm:px-8 sm:py-24">
        <div className="mx-auto max-w-7xl">
          <DongHoHoaNo lang={lang} bayGio={bayGio.toISOString()} />
        </div>
      </section>

      <section id="sac-hong" className="scroll-mt-20 border-t border-[#e6dbe6] bg-[#fbf8f6] px-5 py-14 sm:px-8 sm:py-20">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
          <div>
            <p className="text-[0.66rem] font-extrabold uppercase tracking-[0.3em] text-[#9a5f8f]">{t("Lễ hội", "Festival")}</p>
            <h2 className="font-display mt-4 text-4xl leading-tight sm:text-5xl">{t("Sắc Hồng Tam Cốc", "Sac Hong Tam Coc")}</h2>
            <p className="mt-5 text-base leading-8 text-[#4d5b55]">
              {t(
                "Năm 2025, lễ diễn ra hai ngày 22 và 23 tháng 11 với tên \"Sắc Hồng Tam Cốc – Bản tình ca mùa thu\": hàng trăm thuyền kết thành những đoá hoa súng khổng lồ diễu qua Hang Cả, Hang Hai, Hang Ba, có nhạc và ánh sáng trên sông, và lễ dâng hương cầu an ở đền Thái Vi.",
                "In 2025 the festival ran on 22 and 23 November as \"Sac Hong Tam Coc – An autumn love song\": hundreds of boats dressed as giant water lilies paraded through Hang Ca, Hang Hai and Hang Ba, with music and light on the river and an incense ceremony at Thai Vi temple.",
              )}
            </p>
            <div className="mt-6 rounded-2xl border border-[#e3d6e6] bg-white p-5" data-testid="ngay-le-mua-nay">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#9a5f8f]">{t(`Lễ năm ${mua.nam}`, `${mua.nam} festival`)}</p>
              <p className="mt-2 font-display text-3xl">
                {ngayDoc(mua.le.tu)} – {ngayNgan(mua.le.den)}
              </p>
              <p className={`mt-2 text-sm ${mua.le.chacChan === "da-cong-bo" ? "font-bold text-[#28654d]" : "text-[#6b5f70]"}`}>
                {lang === "vi"
                  ? chacChanLe
                  : mua.le.chacChan === "da-cong-bo"
                    ? "Announced by the organisers"
                    : "Expected, awaiting the official announcement"}
              </p>
              {mua.le.chacChan !== "da-cong-bo" ? (
                <p className="mt-2 text-xs leading-5 text-[#8a7f8d]">
                  {t(
                    "Ngày dự kiến tính theo lần tổ chức 2025 (cuối tuần gần 22/11). Khi khu du lịch công bố, Ninh Bình Journey sửa ngay ngày này.",
                    "The expected date follows the 2025 edition (the weekend nearest 22 November). It is updated as soon as the organisers announce it.",
                  )}
                </p>
              ) : null}
            </div>
          </div>
          <figure className="overflow-hidden rounded-[28px] border border-[#e3d6e6] bg-[#f3eef0]" data-testid="ban-do-hoa-sung">
            <div className="h-[420px] sm:h-[520px]">
              <BanDoHoaSungTre lang={lang} />
            </div>
            <figcaption className="grid gap-2 border-t border-[#e3d6e6] px-5 py-4 text-xs leading-5 text-[#5f5463] sm:grid-cols-3">
              <span className="flex items-center gap-2">
                <span aria-hidden="true" className="w-6 shrink-0 border-t-2 border-dashed border-[#183f34]" />
                {t(`Đường đò ${soKm} km, bến Văn Lâm tới Hang Ba`, `${soKm} km boat route, Van Lam pier to Hang Ba`)}
              </span>
              <span className="flex items-center gap-2">
                <span aria-hidden="true" className="h-3 w-6 shrink-0 rounded-full bg-[#e48bb4]/60" />
                {t("Đoạn hoa dày nhất, giữa Hang Cả và Hang Hai", "Thickest lilies, between Hang Ca and Hang Hai")}
              </span>
              <span className="flex items-center gap-2">
                <span aria-hidden="true" className="h-3 w-3 shrink-0 rounded-full border-2 border-white bg-[#c75b8f] shadow" />
                {t("Thuyền hoa diễu trong lễ (minh hoạ)", "Lily boats in the parade (illustrative)")}
              </span>
            </figcaption>
          </figure>
        </div>
      </section>

      <section className="px-5 py-14 sm:px-8 sm:py-20">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-2">
          <div>
            <p className="text-[0.66rem] font-extrabold uppercase tracking-[0.3em] text-[#9a5f8f]">{t("Các mùa tới", "Seasons ahead")}</p>
            <h2 className="font-display mt-4 text-4xl leading-tight">{t("Hẹn hoa súng mỗi năm", "A date with the lilies, every year")}</h2>
            <table className="mt-6 w-full" data-testid="cac-mua-toi">
              <thead>
                <tr className="border-b border-[#d9cbd9] text-left text-xs font-bold uppercase tracking-[0.12em] text-[#8a7f8d]">
                  <th scope="col" className="pb-2 pr-4">{t("Năm", "Year")}</th>
                  <th scope="col" className="pb-2 pr-4">{t("Mùa hoa", "Bloom")}</th>
                  <th scope="col" className="pb-2">{t("Lễ Sắc Hồng", "Sac Hong")}</th>
                </tr>
              </thead>
              <tbody>{cacMua.map(dongMua)}</tbody>
            </table>
            <p className="mt-4 text-xs leading-5 text-[#8a7f8d]">
              {t(
                "Hoa nở sớm hay muộn tuỳ thời tiết từng năm. Khoảng ngày mùa hoa là ước lượng theo các mùa đã qua.",
                "Bloom timing shifts with each year's weather; the season window is an estimate based on past years.",
              )}
            </p>
          </div>
          <div>
            <p className="text-[0.66rem] font-extrabold uppercase tracking-[0.3em] text-[#9a5f8f]">{t("Đi cho đẹp", "Go well")}</p>
            <h2 className="font-display mt-4 text-4xl leading-tight">{t("Bốn điều nên biết", "Four things worth knowing")}</h2>
            <ol className="mt-6 space-y-4 text-sm leading-7 text-[#4d5b55]">
              <li>
                <strong className="text-[#183f34]">{t("Đi chuyến sớm.", "Take an early boat.")}</strong>{" "}
                {t("Hoa mở trọn khoảng 7 tới 10 giờ; quá trưa là cụp.", "The lilies are fully open from about 7 to 10 am and close by noon.")}
              </li>
              <li>
                <strong className="text-[#183f34]">{t("Đoạn đẹp nhất", "The finest stretch")}</strong>{" "}
                {t("nằm giữa Hang Cả và Hang Hai.", "lies between Hang Ca and Hang Hai.")}
              </li>
              <li>
                <strong className="text-[#183f34]">{t("Ngày lễ rất đông.", "Festival days are busy.")}</strong>{" "}
                <Link href={`/xep-hang/tam-coc?lang=${lang}`} className="font-bold text-[#5d3f6b] underline underline-offset-4">
                  {t("Lấy số đò trên điện thoại", "Take a boat number on your phone")}
                </Link>{" "}
                {t("rồi đi dạo quanh bến, tới lượt máy báo.", "and wander nearby; your phone tells you when it is your turn.")}
              </li>
              <li>
                <strong className="text-[#183f34]">{t("Nghe chuyện Tam Cốc", "Hear the story of Tam Coc")}</strong>{" "}
                <Link href={`/destination/tam-coc?lang=${lang}#thuyet-minh`} className="font-bold text-[#5d3f6b] underline underline-offset-4">
                  {t("bằng thuyết minh trên đò", "with the audio guide on the boat")}
                </Link>
                .
              </li>
            </ol>
          </div>
        </div>
      </section>

      {goi && chuGoi ? (
        <section className="border-t border-[#e6dbe6] bg-[#183f34] px-5 py-14 text-[#fbf7ee] sm:px-8 sm:py-16">
          <div className="mx-auto flex max-w-7xl flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-[0.66rem] font-extrabold uppercase tracking-[0.3em] text-[#e7b96a]">{t("Gói theo mùa", "Seasonal package")}</p>
              <h2 className="font-display mt-4 text-4xl">{chuGoi.name}</h2>
              <p className="mt-4 text-base leading-7 text-white/75">{chuGoi.editorialDescription}</p>
              <p className="mt-3 text-sm text-white/60">{chuGoi.schedule[0]}</p>
            </div>
            <div className="flex flex-col items-start gap-3 lg:items-end">
              <p className="text-sm text-white/70">
                {giaGoi(goi, lang)} · {t("giá minh hoạ", "sample price")}
              </p>
              <Link href={linkGoi} className="inline-flex min-h-12 items-center rounded-full bg-[#e7b96a] px-6 text-sm font-extrabold text-[#183f34] transition hover:bg-[#f0c98a]">
                {t(`Đặt cho mùa ${mua.nam}`, `Book for the ${mua.nam} season`)}
              </Link>
            </div>
          </div>
        </section>
      ) : null}

      <section className="px-5 py-16 sm:px-8 sm:py-20">
        <div className="mx-auto max-w-7xl">
          <p className="text-[0.66rem] font-extrabold uppercase tracking-[0.3em] text-[#9a5f8f]">{t("Sự kiện theo mùa", "Seasonal occasions")}</p>
          <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
            <h2 className="font-display text-4xl leading-tight">{t("Mùa khác", "Other seasons")}</h2>
            <Link href={`/seasonal?${qMua.toString()}`} className="inline-flex min-h-11 items-center text-sm font-bold text-[#5d3f6b] underline underline-offset-4">
              {t("Xem mọi mùa", "All seasons")}
            </Link>
          </div>
          <div className="mt-8">
            <KeMua lang={lang} source={source} boQua="hoa-sung" bayGio={bayGio} />
          </div>
        </div>
      </section>

      <footer className="border-t border-[#e6dbe6] px-5 py-10 sm:px-8">
        <div className="mx-auto max-w-7xl text-xs leading-6 text-[#6b6f6c]">
          <p className="font-bold text-[#183f34]">{t("Nguồn", "Sources")}</p>
          <ul className="mt-2 space-y-1">
            {NGUON.map((n) => (
              <li key={n.url}>
                <a href={n.url} target="_blank" rel="noreferrer" className="underline underline-offset-4">
                  {n.ten}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </footer>
    </main>
  );
}
