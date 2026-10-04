import Link from "next/link";
import { DieuHanhHoaSung } from "@/components/discovery/dieu-hanh-hoa-sung";
import { SongHoaSung } from "@/components/discovery/song-hoa-sung";
import { WorldSwitcher } from "@/components/discovery/world-switcher";
import { NutNgonNgu } from "@/components/shared/nut-ngon-ngu";
import { getPackageBySlug } from "@/content/packages";
import { giaGoi, goiHienThi } from "@/content/packages-en";
import { NHAN_CHAC_CHAN } from "@/domain/lich-mua-vu";
import { cacMuaToi, ngayDoc, tinhTrangHoaSung, type MuaHoaSung } from "@/domain/mua-hoa-sung";
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
      <WorldSwitcher hienTai="seasonal" lang={lang} source={source} tone="sang" />

      <section className="relative overflow-hidden px-5 pb-14 pt-10 sm:px-8 sm:pb-20 sm:pt-14">
        <div className="relative mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-end">
          <div>
            <div className="flex items-center justify-between gap-4">
              <p className="text-[0.66rem] font-extrabold uppercase tracking-[0.3em] text-[#9a5f8f]">
                {t(`Sự kiện theo mùa · Tam Cốc · ${mua.nam}`, `Seasonal · Tam Coc · ${mua.nam}`)}
              </p>
              <NutNgonNgu lang={lang} />
            </div>
            <h1 className="font-display mt-5 max-w-3xl text-5xl leading-[0.92] sm:text-7xl">
              {t("Hoa súng nở trên sông Ngô Đồng", "Water lilies on the Ngo Dong River")}
            </h1>
            <p className="mt-6 max-w-xl text-base leading-8 text-[#4d5b55] sm:text-lg">
              {t(
                "Từ cuối tháng 10, hai bên dòng Ngô Đồng phủ hoa súng tím hồng. Hoa chỉ nở buổi sáng, khoảng 7 tới 10 giờ, rồi cụp lại. Đi đò sớm là thấy trọn.",
                "From late October the banks of the Ngo Dong fill with pink and violet water lilies. They open only in the morning, roughly 7 to 10 am, then close. Take an early boat to see them at their fullest.",
              )}
            </p>
            <p className="mt-6 inline-flex min-h-11 items-center rounded-full bg-[#183f34] px-5 text-sm font-bold text-[#fbf7ee]" data-testid="trang-thai-mua">
              {trangThaiChu}
            </p>
            <ol className="mt-8 grid max-w-xl grid-cols-3 border-y border-[#d9cbd9] text-sm">
              <li className="border-r border-[#d9cbd9] px-3 py-4 pl-0">
                <span className="block text-xs font-bold uppercase tracking-[0.14em] text-[#9a5f8f]">{t("Mùa hoa", "Bloom")}</span>
                {ngayNgan(mua.tu)} – {ngayNgan(mua.den)}
              </li>
              <li className="border-r border-[#d9cbd9] px-3 py-4">
                <span className="block text-xs font-bold uppercase tracking-[0.14em] text-[#9a5f8f]">{t("Giờ nở", "Opens")}</span>
                {t("7–10 giờ sáng", "7–10 am")}
              </li>
              <li className="px-3 py-4">
                <span className="block text-xs font-bold uppercase tracking-[0.14em] text-[#9a5f8f]">{t("Lễ Sắc Hồng", "Sac Hong")}</span>
                {ngayNgan(mua.le.tu)} – {ngayNgan(mua.le.den)}
              </li>
            </ol>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href={linkGoi} className="inline-flex min-h-12 items-center rounded-full bg-[#9a5f8f] px-6 text-sm font-extrabold text-white transition hover:bg-[#844e7a]" data-testid="dat-do-som">
                {t("Đặt đò sớm mùa hoa", "Book an early lily boat")}
              </Link>
              <a href="#sac-hong" className="inline-flex min-h-12 items-center rounded-full border border-[#c9b7cb] px-6 text-sm font-bold text-[#5d3f6b] transition hover:border-[#9a5f8f]">
                {t("Xem lễ Sắc Hồng", "See the Sac Hong festival")}
              </a>
            </div>
          </div>
          <SongHoaSung lang={lang} bayGio={bayGio.toISOString()} />
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
          <DieuHanhHoaSung lang={lang} />
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

      <footer className="px-5 py-10 sm:px-8">
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
