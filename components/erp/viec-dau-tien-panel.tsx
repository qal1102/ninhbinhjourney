import Link from "next/link";

import {
  tongViecCho,
  viecDauTien,
  VIEC_DAU_TIEN_COPY,
  type DemViecChoGiamDoc,
} from "@/domain/viec-dau-tien";
import { NHAN_LOAI_VIEC, type ViecCanBan } from "@/domain/viec-can-ban";
import { ERP_SITES } from "@/domain/erp";

const MAU_LOAI: Record<ViecCanBan["loai"], string> = {
  sop: "bg-[#f6d2be] text-[#8a3a12]",
  "su-co": "bg-[#f6d2be] text-[#8a3a12]",
  "ca-lech": "bg-[#e9ebe7] text-[#3f4a44]",
  "hoa-don": "bg-[#e6eef8] text-[#24466e]",
  "du-an": "bg-[#e3efe8] text-[#24594a]",
};

function DongViec({ v }: { v: ViecCanBan }) {
  const coSo = ERP_SITES.find((s) => s.id === v.siteId)?.shortName ?? v.siteId;
  return (
    <li className={`flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border bg-white px-3 py-2.5 ${v.gap ? "border-[#e9b79a]" : "border-[#dde3de]"}`}>
      <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[0.7rem] font-black ${MAU_LOAI[v.loai]}`}>{NHAN_LOAI_VIEC[v.loai]}</span>
      <span className="min-w-0 flex-[999_1_14rem]">
        <span className="block truncate text-sm font-black text-[#1f2f2a]">{v.ten}</span>
        <span className="block truncate text-xs text-[#5f7068]">{coSo} · {v.phu}</span>
      </span>
      <span className={`shrink-0 text-xs font-bold ${v.gap ? "text-[#8a3a12]" : "text-[#6b786f]"}`}>{v.han}</span>
      <Link href={v.href} className="inline-flex min-h-10 shrink-0 items-center rounded-lg border border-[#ccd8d1] px-3 text-sm font-bold text-[#183f34] hover:border-[#183f34]">Mở</Link>
    </li>
  );
}

/**
 * Một câu duy nhất ở đầu trang chủ: hôm nay nên bắt đầu từ đâu.
 *
 * Khối này cố tình **ngắn hơn mọi khối khác** trên trang. Nó không phải một
 * bảng điều khiển thứ hai; nó là mũi tên chỉ đường. Dài ra một chút là nó
 * thành thứ phải đọc, và thế thì hỏng mục đích.
 *
 * Trang chủ chỉ dựng khối này khi có việc chờ (26/09/2026). Ngày rảnh thì
 * khối quyết định trong bảng số liệu đã nói "0 hồ sơ đang chờ"; không bịa ra
 * một việc gợi ý để màn hình đỡ trống.
 */
export function ViecDauTienPanel({
  dem,
  siteId,
  danhSach = [],
}: {
  dem: DemViecChoGiamDoc;
  siteId: string;
  /** G1 (11/10/2026): từng hồ sơ đang chờ, hiện ngay dưới việc nên làm trước. */
  danhSach?: readonly ViecCanBan[];
}) {
  const viec = viecDauTien(dem, siteId);
  const tong = tongViecCho(dem);
  const conLai = Math.max(0, tong - viec.so);
  const gap = viec.mucDo === "gap";

  return (
    <section
      data-testid="viec-dau-tien"
      data-viec={viec.id}
      className={[
        "mb-6 rounded-2xl border p-4 sm:p-5",
        gap ? "border-[#e0c0b6] bg-[#fdf4f1]" : "border-[#dbe2de] bg-white",
      ].join(" ")}
    >
      <p
        className={[
          "text-xs font-black uppercase tracking-[0.17em]",
          gap ? "text-[#8b4436]" : "text-[#477565]",
        ].join(" ")}
      >
        {VIEC_DAU_TIEN_COPY.nhan}
      </p>
      <p className="mt-1 text-lg font-black leading-7 text-[#1f2f2a]">{viec.cauNoi}</p>
      <p className="mt-1 text-sm leading-6 text-[#5f7068]">{viec.viSao}</p>

      {viec.href ? (
        <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          <Link
            href={viec.href}
            data-testid="viec-dau-tien-mo"
            className={[
              "inline-flex min-h-11 items-center rounded-lg px-4 text-sm font-black text-white",
              gap ? "bg-[#8b4436]" : "bg-[#1f604c]",
            ].join(" ")}
          >
            {viec.nhanNut}
          </Link>
          {conLai > 0 ? (
            <span className="text-sm text-[#5f7068]">
              Xong việc này thì còn {conLai} việc khác đang chờ bạn.
            </span>
          ) : null}
        </p>
      ) : null}

      {danhSach.length > 0 ? (
        <div data-testid="viec-can-ban" data-chi="viec-can-ban" data-chi-loi="Mọi hồ sơ đang chờ bạn, việc gấp lên đầu. Bấm Mở là tới đúng màn." className="mt-4 border-t border-[#ead6cf]/70 pt-3">
          <h2 className="text-sm font-black text-[#1f2f2a]">Việc cần bạn · {danhSach.length}</h2>
          <ul className="mt-2 space-y-2">
            {danhSach.slice(0, 6).map((v) => (
              <DongViec key={v.id} v={v} />
            ))}
          </ul>
          {danhSach.length > 6 ? (
            <details className="mt-2">
              <summary className="min-h-10 cursor-pointer py-2 text-sm font-bold text-[#356957]">Xem thêm {danhSach.length - 6} việc</summary>
              <ul className="mt-1 space-y-2">
                {danhSach.slice(6).map((v) => (
                  <DongViec key={v.id} v={v} />
                ))}
              </ul>
            </details>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
