import Link from "next/link";
import type { ErpSite } from "@/domain/erp";
import { tienCua } from "@/domain/toan-vung";
import type { SoHomNay } from "@/lib/erp/so-hom-nay";

function tienGon(value: number) {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toLocaleString("vi-VN", { maximumFractionDigits: 2 })} tỷ`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} tr`;
  return `${value.toLocaleString("vi-VN")} đ`;
}

/**
 * Khối đầu trang giám đốc (13/10/2026). Soát như người mới: mở máy thấy một hồ
 * sơ mẫu từ 01/08 và khối "Chức năng mới", con số hôm nay nằm tận khối thứ
 * ba và lấy từ hồ sơ chốt ca. Nay câu đầu tiên trả lời "hôm nay khu du lịch
 * thế nào", cùng nguồn với màn Toàn vùng và trợ lý, rồi mời đi thử một vòng.
 */
export function HomNayBonCoSo({
  so,
  sites,
  viecCho,
  suCoChuyenCap,
}: {
  so: SoHomNay | null;
  sites: readonly ErpSite[];
  viecCho: number;
  suCoChuyenCap: number;
}) {
  const ten = new Map(sites.map((site) => [site.id, site.shortName]));
  const o = [
    {
      nhan: "Khách đã vào cổng",
      so: so ? so.hienTai.khach.toLocaleString("vi-VN") : "—",
      phu: so ? `Hôm qua cả ngày ${so.truoc.khach.toLocaleString("vi-VN")}` : "Chưa nối kho số liệu",
    },
    {
      nhan: "Tiền thu",
      so: so ? tienGon(tienCua(so.hienTai)) : "—",
      phu: so ? `Quầy ${tienGon(so.hienTai.tienQuay)} · Web ${tienGon(so.hienTai.tienWeb)}` : "Quầy và web",
    },
    { nhan: "Sự cố chuyển lên bạn", so: suCoChuyenCap.toLocaleString("vi-VN"), phu: suCoChuyenCap ? "Quá hạn hoặc vượt quyền cơ sở" : "Không có sự cố nào chờ" },
    { nhan: "Việc chờ bạn quyết", so: viecCho.toLocaleString("vi-VN"), phu: viecCho ? "Xem danh sách ngay dưới" : "Không có gì chờ" },
  ];

  return (
    <section data-testid="hom-nay-bon-co-so" aria-labelledby="hom-nay-tieu-de" className="mb-6 rounded-3xl bg-[#173f34] p-5 text-white sm:p-7">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#b9d5ca]">Hôm nay · bốn cơ sở</p>
        <h2 id="hom-nay-tieu-de" className="mt-2 text-2xl font-black sm:text-3xl">Khu du lịch hôm nay</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[#d4e4de]">
          Bán vé, soát cổng, sức chứa, sự cố, nhân sự và sổ sách của Tràng An, Tam Chúc, Tam Cốc, Bái Đính trên một hệ thống.
        </p>
        <div className="mt-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
          {o.map((muc) => (
            <article key={muc.nhan} className="min-w-0 rounded-xl border border-white/10 bg-white/[0.06] p-4">
              <p className="text-xs text-white/60">{muc.nhan}</p>
              <p className="mt-2 text-2xl font-black tabular-nums">{muc.so}</p>
              <p className="mt-1 text-xs leading-4 text-[#b5d6ca]">{muc.phu}</p>
            </article>
          ))}
        </div>
        {so ? (
          <ul className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {so.theoCoSo.map((coSo) => (
              <li key={coSo.siteId}>
                <Link
                  href={`/erp/${coSo.siteId}`}
                  className="flex min-h-11 items-center justify-between gap-3 rounded-xl bg-white/[0.08] px-4 py-2 text-sm transition hover:bg-white/[0.14]"
                >
                  <span className="font-black">{ten.get(coSo.siteId) ?? coSo.siteId}</span>
                  <span className="text-right text-xs text-[#d4e4de]">
                    {coSo.hienTai.khach.toLocaleString("vi-VN")} khách · {tienGon(tienCua(coSo.hienTai))}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
        <Link
          href="/erp/toan-vung"
          className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-white px-5 text-sm font-black text-[#173f34] transition hover:bg-[#eef5f1]"
        >
          So sánh bốn cơ sở, 7 và 30 ngày →
        </Link>
      </section>
  );
}

/** Lời mời đi thử một vòng cho người mới (thay khối "Chức năng mới" trên trang đầu). */
export function DiThuMotVong() {
  return (
      <section data-testid="di-thu-mot-vong" aria-labelledby="di-thu-tieu-de" className="mb-6 rounded-2xl border border-[#e7d3ad] bg-[#fffaf0] p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-[999_1_20rem]">
            <h2 id="di-thu-tieu-de" className="text-lg font-black text-[#3f3524]">Lần đầu dùng? Đi thử một vòng, khoảng 10 phút</h2>
            <p className="mt-1 text-sm leading-6 text-[#5d5240]">
              Theo một vị khách từ lúc mua vé trên điện thoại, trả bằng QR, qua cổng Tràng An, tới lúc con số hiện trên màn này.
              Mỗi bước dẫn tới đúng chỗ cần bấm, làm trên dữ liệu thật.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/erp/huong-dan?xem=vong"
              className="inline-flex min-h-11 items-center rounded-xl bg-[#183f34] px-4 text-sm font-black text-white transition hover:bg-[#12332a]"
            >
              Bắt đầu đi thử
            </Link>
            <Link
              href="/erp/huong-dan"
              className="inline-flex min-h-11 items-center rounded-xl border border-[#d8c49c] px-4 text-sm font-black text-[#3f3524] transition hover:bg-[#fdf3e0]"
            >
              Mọi chức năng
            </Link>
          </div>
        </div>
      </section>
  );
}
