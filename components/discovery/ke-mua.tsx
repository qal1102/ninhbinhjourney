import Image from "next/image";
import Link from "next/link";
import { cacChuongMua, type ChuongMua } from "@/lib/seasonal/cac-mua";
import type { TrangMua } from "@/lib/seasonal/trang-mua";

/**
 * Kệ các mùa. Mỗi mùa một tấm ảnh lớn; mùa đã khép vẫn mở được, ảnh trầm
 * xuống và có nhãn "Đã khép mùa" để khách không tưởng còn đặt được.
 *
 * `boQua` bỏ chính mùa đang xem (dùng ở cuối từng trang mùa); để trống thì
 * hiện đủ (trang `/seasonal`).
 */
export function KeMua({
  lang,
  source = "",
  boQua,
  bayGio,
}: {
  lang: "vi" | "en";
  source?: string;
  boQua?: TrangMua;
  bayGio?: Date;
}) {
  const cacMua = cacChuongMua(bayGio).filter((m) => m.id !== boQua);
  if (cacMua.length === 0) return null;
  const lienKet = (m: ChuongMua) => {
    const q = new URLSearchParams({ lang });
    if (source) q.set("source", source);
    return `${m.duongDan}?${q.toString()}`;
  };

  return (
    <ul className={`grid gap-5 ${cacMua.length > 1 ? "md:grid-cols-2" : ""}`} data-testid="ke-mua">
      {cacMua.map((m) => {
        const khep = m.trangThai === "da-khep";
        return (
          <li key={m.id}>
            <Link
              href={lienKet(m)}
              transitionTypes={["portal-enter"]}
              className="group relative block overflow-hidden rounded-[28px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#9a5f8f]"
              data-mua={m.id}
              data-trang-thai-mua={m.trangThai}
            >
              <div className={`relative ${cacMua.length > 1 ? "aspect-[4/3]" : "aspect-[4/3] md:aspect-[21/9]"}`}>
                <Image
                  src={m.anh}
                  alt=""
                  fill
                  sizes={cacMua.length > 1 ? "(min-width: 768px) 50vw, 100vw" : "100vw"}
                  className={`object-cover transition duration-700 group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100 ${
                    khep ? "saturate-[.55]" : ""
                  }`}
                  style={{ objectPosition: m.viTriAnh }}
                />
                <div
                  className={`absolute inset-0 ${
                    khep
                      ? "bg-[linear-gradient(180deg,rgba(12,16,14,.25)_0%,rgba(12,16,14,.88)_100%)]"
                      : "bg-[linear-gradient(180deg,rgba(20,14,12,0)_35%,rgba(20,14,12,.82)_100%)]"
                  }`}
                />
                <span
                  className={`absolute left-5 top-5 inline-flex min-h-8 items-center rounded-full px-3 text-[0.7rem] font-extrabold uppercase tracking-[0.14em] ${
                    khep ? "border border-white/45 text-white/90" : "bg-[#fbf7ee] text-[#5d3f6b]"
                  }`}
                >
                  {m.nhanTrangThai[lang]}
                </span>
                <div className="absolute inset-x-0 bottom-0 p-5 text-[#fbf7ee] sm:p-7">
                  <p className="font-display text-3xl leading-tight sm:text-4xl">{m.ten[lang]}</p>
                  <p className="mt-2 max-w-md text-sm leading-6 text-white/78">{m.dong[lang]}</p>
                  <span className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-[#f0c98a]">
                    {khep ? (lang === "vi" ? "Xem lại mùa này" : "Look back at this season") : lang === "vi" ? "Mở trang mùa" : "Open the season"}
                    <span aria-hidden="true" className="transition group-hover:translate-x-1 motion-reduce:transition-none">→</span>
                  </span>
                </div>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
