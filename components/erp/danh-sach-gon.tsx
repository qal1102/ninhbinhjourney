"use client";

import { Fragment, useId, useMemo, useState, type ReactNode } from "react";

/**
 * Danh sách dài trên màn ERP: hiện vài mục đầu, có nút xem thêm và (tuỳ chọn)
 * ô tìm. Soát 07/10/2026 bằng tài khoản giám đốc trên điện thoại: màn Khách
 * hàng dài 39 màn hình (100 đơn xếp liền), Vé & đặt chỗ gần 20 (mỗi phiếu bán
 * một thẻ), Nhật ký 26 — không tìm, không lọc, chỉ có cuộn.
 *
 * Các mục vẫn dựng sẵn ở máy chủ rồi truyền vào; khung này chỉ ẩn bớt, nên
 * mục đầu tiên (chỗ màn Dạo một vòng khoanh `data-chi`) luôn còn đó.
 */
export function DanhSachGon({
  muc,
  tim,
  soDau = 6,
  buocThem = 20,
  tenMuc,
  goiYTim,
  className,
  the: The = "div",
}: {
  muc: ReactNode[];
  /** Chữ để tìm của từng mục, cùng thứ tự với `muc`. Bỏ trống thì không có ô tìm. */
  tim?: string[];
  soDau?: number;
  buocThem?: number;
  /** Tên mục số nhiều, viết thường: "đơn", "phiếu", "thao tác". */
  tenMuc: string;
  goiYTim?: string;
  className?: string;
  /** Thẻ bọc: `ol`/`ul` khi mỗi mục là một `<li>`. */
  the?: "div" | "ol" | "ul";
}) {
  const [soHien, setSoHien] = useState(soDau);
  const [tu, setTu] = useState("");
  const idTim = useId();

  const chiSo = useMemo(() => {
    const q = boDau(tu.trim());
    if (!q || !tim) return muc.map((_, i) => i);
    return muc.map((_, i) => i).filter((i) => boDau(tim[i] ?? "").includes(q));
  }, [muc, tim, tu]);

  const hien = chiSo.slice(0, soHien);
  const conLai = chiSo.length - hien.length;

  return (
    <div>
      {tim && muc.length > soDau ? (
        <div className="mb-3">
          <label htmlFor={idTim} className="sr-only">
            Tìm trong {muc.length} {tenMuc}
          </label>
          <input
            id={idTim}
            type="search"
            value={tu}
            onChange={(event) => {
              setTu(event.target.value);
              setSoHien(soDau);
            }}
            placeholder={goiYTim ?? `Tìm trong ${muc.length} ${tenMuc}`}
            className="min-h-11 w-full rounded-xl border border-[#cfd9d3] bg-white px-4 text-sm text-[#203a30] placeholder:text-[#7a8a82]"
          />
          {tu.trim() ? (
            <p className="mt-2 text-xs text-[#5d7268]" role="status">
              {chiSo.length > 0 ? `Thấy ${chiSo.length} ${tenMuc}.` : `Không thấy ${tenMuc} nào khớp “${tu.trim()}”.`}
            </p>
          ) : null}
        </div>
      ) : null}
      <The className={className}>
        {hien.map((i) => (
          <Fragment key={i}>{muc[i]}</Fragment>
        ))}
      </The>
      {conLai > 0 || soHien > soDau ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {conLai > 0 ? (
            <button
              type="button"
              onClick={() => setSoHien((n) => n + buocThem)}
              className="min-h-11 rounded-full border border-[#b9c8c0] bg-white px-4 text-sm font-bold text-[#203a30]"
            >
              Xem thêm {Math.min(buocThem, conLai)} {tenMuc}
              <span className="font-normal text-[#5d7268]"> · còn {conLai}</span>
            </button>
          ) : null}
          {soHien > soDau ? (
            <button
              type="button"
              onClick={() => setSoHien(soDau)}
              className="min-h-11 rounded-full px-3 text-sm font-bold text-[#35594b] underline underline-offset-2"
            >
              Thu gọn
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function boDau(chu: string) {
  return chu
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase();
}
