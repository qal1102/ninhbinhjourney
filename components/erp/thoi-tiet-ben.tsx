import Link from "next/link";
import {
  moTaThoiTiet,
  phanTichThoiTiet,
  TOA_DO_BEN,
  type MucThoiTiet,
} from "@/domain/thoi-tiet-ben";
import type { CoSoThuyen } from "@/domain/thuyen-song";
import { duBaoBen } from "@/lib/erp/thoi-tiet-repository";

/**
 * Khối "Thời tiết bến" (giờ thuyền chạy) ở màn Thuyền trên sông và màn Sức chứa
 * Tràng An / Tam Cốc. Thành phần máy chủ, đặt trong `<Suspense>` để bản đồ
 * không phải chờ dự báo.
 */

const KIEU_MUC: Record<MucThoiTiet, { nhan: string; khung: string; o: string }> = {
  "binh-thuong": { nhan: "Bình thường", khung: "border-[#cfe3d7] bg-[#f3faf5]", o: "bg-white border-[#dfe9e3]" },
  "luu-y": { nhan: "Lưu ý", khung: "border-[#ecd29a] bg-[#fff8ea]", o: "bg-[#fff1d6] border-[#ecd29a]" },
  "tam-dung": { nhan: "Cân nhắc tạm dừng", khung: "border-[#e6b0a6] bg-[#fdf1ee]", o: "bg-[#fbe0da] border-[#e6b0a6]" },
};

const MAU_NHAN: Record<MucThoiTiet, string> = {
  "binh-thuong": "bg-[#dcefe3] text-[#1f5a3f]",
  "luu-y": "bg-[#fbe3b4] text-[#7a5520]",
  "tam-dung": "bg-[#9f3a2c] text-white",
};

function gioNgan(gio: string) {
  return gio.slice(11, 16);
}

function khoangGio(tu: string, den: string) {
  // Giờ cuối là giờ có nguy cơ, nên khoảng kết thúc ở đầu giờ kế tiếp.
  const ket = String((Number(den.slice(11, 13)) + 1) % 24).padStart(2, "0");
  return `${gioNgan(tu)}–${ket}:00`;
}

function so(n: number) {
  return n.toLocaleString("vi-VN", { maximumFractionDigits: 1 });
}

export async function ThoiTietBen({ coSo, siteHref }: { coSo: CoSoThuyen; siteHref: string }) {
  const duBao = await duBaoBen(coSo);
  const ben = TOA_DO_BEN[coSo];

  if (!duBao) {
    return (
      <section data-testid="thoi-tiet-ben" data-muc="khong-co" className="mb-8 rounded-2xl border border-[#e3e8e5] bg-white p-4 text-sm text-[#59654b] sm:p-5">
        <p className="font-black text-[#20342c]">Thời tiết {ben.ten}</p>
        <p className="mt-1">Chưa lấy được dự báo lúc này. Mời bạn xem lại sau ít phút; màn hình không hiện số đoán.</p>
      </section>
    );
  }

  const bayGio = new Date();
  const { muc, khung, cacGio, cacKhoang } = phanTichThoiTiet(duBao, bayGio);
  const kieu = KIEU_MUC[muc];
  const loiKhuyen =
    muc === "tam-dung"
      ? "Có giờ vượt ngưỡng an toàn cho thuyền. Bạn cân nhắc cho thuyền rời bến trước khoảng ấy và về sớm; nếu dừng bến thì báo sự cố thời tiết để cả đội theo đúng SOP."
      : muc === "luu-y"
        ? "Chưa tới mức phải dừng. Mời bạn nhắc người chèo, chuẩn bị áo mưa, nước uống cho khách."
        : "Trong giờ thuyền chạy không có dông, mưa to hay gió giật mạnh.";

  return (
    <section
      data-testid="thoi-tiet-ben"
      data-muc={muc}
      data-chi="thoi-tiet-ben"
      data-chi-loi="Mức cảnh báo ở góc phải; dòng màu là khoảng giờ có mưa, dông, gió giật hay sương mù. Kéo ngang dải giờ để xem từng giờ thuyền chạy."
      className={`mb-8 rounded-2xl border p-4 shadow-sm sm:p-6 ${kieu.khung}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.17em] text-[#477565]">Thời tiết bến · {khung.nhan}</p>
          <h2 className="mt-1 text-xl font-black text-[#20342c]">{ben.ten}</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`inline-flex min-h-9 items-center rounded-full px-4 text-sm font-black ${MAU_NHAN[muc]}`}>{kieu.nhan}</span>
          {muc !== "binh-thuong" ? (
            <Link href={`${siteHref}/su-co`} prefetch={false} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[#cbb48a] bg-white px-4 text-sm font-black text-[#6b5520]">
              Báo sự cố thời tiết
            </Link>
          ) : null}
        </div>
      </div>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-[#3d5047]">{loiKhuyen}</p>

      {cacKhoang.length > 0 ? (
        <ul className="mt-3 space-y-1.5" data-testid="khoang-nguy-co">
          {cacKhoang.map((k) => (
            <li key={`${k.loai}-${k.tu}`} className="flex flex-wrap items-baseline gap-x-2 text-sm">
              <span className={`font-black ${k.muc === "tam-dung" ? "text-[#9f3a2c]" : "text-[#7a5520]"}`}>{k.ten}</span>
              <span className="tabular-nums text-[#20342c]">{khoangGio(k.tu, k.den)}</span>
              <span className="text-[#5f7068]">· {k.dinh}</span>
            </li>
          ))}
        </ul>
      ) : null}

      <ol className="mt-4 flex gap-2 overflow-x-auto pb-2" aria-label="Dự báo từng giờ">
        {cacGio.map((g) => (
          <li
            key={g.gio}
            data-muc-gio={g.muc}
            className={`flex w-[5.25rem] shrink-0 flex-col rounded-xl border px-2.5 py-2 text-xs ${KIEU_MUC[g.muc].o}`}
          >
            <span className="font-black tabular-nums text-[#20342c]">{gioNgan(g.gio)}</span>
            <span className="mt-0.5 leading-4 text-[#3d5047]">{moTaThoiTiet(g.maThoiTiet)}</span>
            <span className="mt-1 font-bold tabular-nums text-[#20342c]">{Math.round(g.nhietDo)} °C</span>
            <span className="tabular-nums text-[#5f7068]">{g.mua > 0 ? `${so(g.mua)} mm` : "Không mưa"}</span>
            <span className="tabular-nums text-[#5f7068]">Gió {Math.round(g.gioGiat)} km/giờ</span>
          </li>
        ))}
      </ol>

      <p className="mt-2 max-w-3xl text-xs leading-5 text-[#68776f]">
        Dự báo Open-Meteo, cập nhật mỗi 30 phút, chỉ xét giờ thuyền chạy (6:30–17:30). Ngưỡng gợi ý: dông, mưa từ 7,6 mm/giờ hay gió
        giật từ 50 km/giờ (cấp 7) là cân nhắc tạm dừng; mưa vừa, gió cấp 6, sương mù, nắng từ 35 °C là lưu ý. Quyết định dừng bến vẫn là
        của quản lý.
      </p>
    </section>
  );
}
