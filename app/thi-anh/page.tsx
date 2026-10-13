import type { Metadata } from "next";
import { ThiAnhForm } from "@/components/commerce/thi-anh-form";
import { ThanhDauTrang } from "@/components/shared/thanh-dau-trang";
import { DIA_DIEM_THI_ANH, GIAI_THI_ANH, tenGiai, THE_LE_THI_ANH, thangTruoc, thangVN, tongGiaTriGiai } from "@/domain/thi-anh";
import { anhTrungBay, type AnhTrungBay } from "@/lib/customer-data/thi-anh-repository";
import { ch } from "@/lib/ngon-ngu";
import { docNgonNgu } from "@/lib/ngon-ngu-server";

export const metadata: Metadata = {
  title: "Ảnh đẹp Ninh Bình hằng tháng · Ninh Bình Journey",
  description: "Gửi ảnh bạn chụp ở Tràng An, Tam Cốc, Bái Đính, Tam Chúc, Hoa Lư. Mỗi tháng 8 giải bằng vé tham quan.",
};

function tenThang(thang: string, lang: "vi" | "en") {
  const [n, t] = thang.split("-");
  return lang === "en" ? `${t}/${n}` : `tháng ${Number(t)}/${n}`;
}

function LuoiAnh({ anh, lang, testId }: { anh: AnhTrungBay[]; lang: "vi" | "en"; testId: string }) {
  return (
    <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" data-testid={testId}>
      {anh.map((a) => (
        <li key={a.id} className="overflow-hidden rounded-2xl bg-white shadow-sm">
          {a.url ? (
            // eslint-disable-next-line @next/next/no-img-element -- đường dẫn ký tạm của kho ảnh riêng tư
            <img src={a.url} alt={a.chuThich || `${ch(lang, "Ảnh của", "Photo by")} ${a.ten}`} loading="lazy" className="aspect-[4/3] w-full object-cover" />
          ) : (
            <div className="aspect-[4/3] w-full bg-[#e6e0d2]" />
          )}
          <div className="p-3">
            {a.giai ? <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[#b23a24]">{tenGiai(a.giai, lang)}</p> : null}
            <p className="text-sm font-bold text-[#183f34]">{a.ten}</p>
            <p className="text-xs text-[#6b786f]">{DIA_DIEM_THI_ANH.find((d) => d.ma === a.dauMa)?.[lang] ?? ""}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

export default async function ThiAnhPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const lang = await docNgonNgu(await searchParams);
  const thang = thangVN();
  const truoc = thangTruoc(thang);
  const [anhThang, anhTruoc] = await Promise.all([anhTrungBay(thang), anhTrungBay(truoc)]);
  const giaiTruoc = anhTruoc.filter((a) => a.giai);
  return (
    <>
      <ThanhDauTrang lang={lang} hienTai="mua" />
      <main lang={lang} className="min-h-screen bg-[#f4f0e7] px-5 py-10 text-[#151a17] sm:px-8 lg:py-16">
        <div className="mx-auto max-w-6xl" data-testid="thi-anh">
          <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-[#9a6328]">{ch(lang, `Đang nhận ảnh ${tenThang(thang, lang)}`, `Now taking entries for ${tenThang(thang, lang)}`)}</p>
          <h1 className="font-display mt-2 text-4xl leading-tight text-[#183f34] sm:text-6xl">{ch(lang, "Ảnh đẹp Ninh Bình", "Ninh Binh photo of the month")}</h1>
          <p className="mt-3 max-w-2xl leading-7 text-[#4a554e]">
            {ch(
              lang,
              `Gửi ảnh bạn chụp ở các điểm tham quan Ninh Bình. Mỗi tháng 8 giải, tổng giá trị ${tongGiaTriGiai().toLocaleString("vi-VN")} đ bằng vé tham quan; ban tổ chức chấm theo ảnh, không bốc thăm, không cần mua vé.`,
              `Send a photo you took at Ninh Binh's sites. Eight prizes every month, worth VND ${tongGiaTriGiai().toLocaleString("en-US")} in tickets, judged on the photo itself: no lucky draw, no purchase needed.`,
            )}
          </p>

          <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" data-testid="co-cau-giai">
            {GIAI_THI_ANH.map((g) => (
              <li key={g.giai} className="rounded-2xl border border-[#e2d3b4] bg-[#fbf7ee] p-4">
                <p className="font-extrabold text-[#b23a24]">{g.ten[lang]}{g.soLuong > 1 ? ` × ${g.soLuong}` : ""}</p>
                <p className="mt-1 text-sm leading-6 text-[#4a554e]">{g.quaTang[lang]}</p>
              </li>
            ))}
          </ul>

          {giaiTruoc.length > 0 ? (
            <section className="mt-10">
              <h2 className="font-display text-3xl text-[#183f34]">{ch(lang, `Ảnh đoạt giải ${tenThang(truoc, lang)}`, `Winners of ${tenThang(truoc, lang)}`)}</h2>
              <LuoiAnh anh={giaiTruoc} lang={lang} testId="anh-doat-giai" />
            </section>
          ) : null}

          <section className="mt-10">
            <h2 className="font-display text-3xl text-[#183f34]">{ch(lang, `Ảnh đã nhận ${tenThang(thang, lang)}`, `Entries for ${tenThang(thang, lang)}`)}</h2>
            {anhThang.length > 0 ? (
              <LuoiAnh anh={anhThang} lang={lang} testId="anh-thang-nay" />
            ) : (
              <p className="mt-3 text-[#6b786f]">{ch(lang, "Chưa có ảnh nào được duyệt tháng này. Ảnh của bạn có thể là ảnh đầu tiên.", "No approved photos yet this month. Yours could be the first.")}</p>
            )}
          </section>

          <section className="mt-10">
            <ThiAnhForm lang={lang} />
          </section>

          <section className="mt-10 rounded-3xl bg-white p-6 shadow-sm">
            <h2 className="font-display text-2xl text-[#183f34]">{ch(lang, "Thể lệ", "Rules")}</h2>
            <ol className="mt-3 list-decimal space-y-2 pl-5 leading-7 text-[#3f4a43]">
              {THE_LE_THI_ANH.map((d) => <li key={d.vi}>{d[lang]}</li>)}
            </ol>
          </section>
        </div>
      </main>
    </>
  );
}
