import Link from "next/link";

import {
  tongViecCho,
  viecDauTien,
  VIEC_DAU_TIEN_COPY,
  type DemViecChoGiamDoc,
} from "@/domain/viec-dau-tien";

/**
 * Một câu duy nhất ở đầu trang chủ: hôm nay nên bắt đầu từ đâu.
 *
 * Khối này cố tình **ngắn hơn mọi khối khác** trên trang. Nó không phải một
 * bảng điều khiển thứ hai; nó là mũi tên chỉ đường. Dài ra một chút là nó
 * thành thứ phải đọc, và thế thì hỏng mục đích.
 *
 * Ngày rảnh thì nó nói thẳng là rảnh và không có nút nào — không bịa ra một
 * việc gợi ý để màn hình đỡ trống.
 */
export function ViecDauTienPanel({
  dem,
  siteId,
}: {
  dem: DemViecChoGiamDoc;
  siteId: string;
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
              Xong việc này thì còn {conLai} việc khác đang chờ anh.
            </span>
          ) : null}
        </p>
      ) : null}
    </section>
  );
}
