"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { luuNguoiCheoAction, xoaNguoiCheoAction } from "@/app/erp/nguoi-cheo-actions";
import type { CoSoThuyen, NguoiCheo } from "@/domain/thuyen-song";

/**
 * Sổ người chèo của một bến: thuyền số mấy do ai chèo. Bản đồ phía trên dùng
 * sổ này để hiện người chèo khi bấm vào thuyền.
 */

type Nhap = { id?: string; soThuyen: string; hoTen: string; soDienThoai: string };
const TRONG: Nhap = { soThuyen: "", hoTen: "", soDienThoai: "" };

export function SoNguoiCheo({ coSo, tenBen, ds, coKho }: { coSo: CoSoThuyen; tenBen: string; ds: NguoiCheo[]; coKho: boolean }) {
  const router = useRouter();
  const [nhap, setNhap] = useState<Nhap | null>(null);
  const [loi, setLoi] = useState("");
  const [dang, batDau] = useTransition();
  const soMau = ds.filter((n) => n.laMau).length;
  const o = "min-h-11 w-full rounded-xl border border-[#ccd8d1] bg-white px-3 text-sm text-[#20342c] outline-none focus:border-[#4f806f]";

  const luu = () =>
    batDau(async () => {
      if (!nhap) return;
      setLoi("");
      const kq = await luuNguoiCheoAction({ ...nhap, coSo });
      if (!kq.ok) return setLoi(kq.loi);
      setNhap(null);
      router.refresh();
    });
  const xoa = (n: NguoiCheo) =>
    batDau(async () => {
      if (!window.confirm(`Xoá ${n.hoTen} (thuyền ${n.soThuyen}) khỏi sổ?`)) return;
      setLoi("");
      const kq = await xoaNguoiCheoAction(coSo, n.id);
      if (!kq.ok) return setLoi(kq.loi);
      router.refresh();
    });

  return (
    <section
      className="mb-8 rounded-2xl border border-[#d8e0db] bg-white p-4 shadow-sm sm:p-6"
      data-testid="so-nguoi-cheo"
      data-chi="so-nguoi-cheo"
      data-chi-loi="Sổ ghi thuyền số mấy do ai chèo. Bấm một thuyền trên bản đồ là thẻ hiện người chèo lấy từ sổ này."
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-[#20342c]">Sổ người chèo · {tenBen}</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-[#5f7068]">
            Bấm một thuyền trên bản đồ là thấy ai đang chèo. Thuyền ước từ lượt qua cổng nhận người theo lượt gọi xoay vòng trong sổ; thuyền bật định vị lấy đúng người đã bấm bắt đầu chuyến.
            {soMau > 0 ? ` ${soMau} người gắn nhãn "mẫu" để thử; sửa một người là thành người thật trong sổ.` : ""}
          </p>
        </div>
        {coKho ? (
          <button
            type="button"
            onClick={() => {
              setLoi("");
              setNhap({ ...TRONG });
            }}
            className="min-h-11 rounded-xl bg-[#183f34] px-4 text-sm font-black text-white"
          >
            Thêm người chèo
          </button>
        ) : null}
      </div>

      {!coKho ? <p className="mt-4 text-sm text-[#59654b]">Bản chạy này chưa nối kho dữ liệu nên chưa có sổ.</p> : null}

      {nhap ? (
        <form
          className="mt-4 grid gap-3 rounded-2xl bg-[#f4f7f5] p-4 sm:grid-cols-[8rem_1fr_12rem_auto] sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            luu();
          }}
          data-testid="form-nguoi-cheo"
        >
          <label className="block text-xs font-bold text-[#53675e]">
            Số thuyền
            <input value={nhap.soThuyen} onChange={(e) => setNhap({ ...nhap, soThuyen: e.target.value })} className={`${o} mt-1`} required maxLength={20} />
          </label>
          <label className="block text-xs font-bold text-[#53675e]">
            Họ tên
            <input value={nhap.hoTen} onChange={(e) => setNhap({ ...nhap, hoTen: e.target.value })} className={`${o} mt-1`} required maxLength={120} />
          </label>
          <label className="block text-xs font-bold text-[#53675e]">
            Số điện thoại
            <input
              value={nhap.soDienThoai}
              onChange={(e) => setNhap({ ...nhap, soDienThoai: e.target.value })}
              className={`${o} mt-1`}
              inputMode="tel"
              maxLength={20}
              placeholder="Tuỳ chọn"
            />
          </label>
          <div className="flex gap-2">
            <button type="submit" disabled={dang} className="min-h-11 rounded-xl bg-[#183f34] px-4 text-sm font-black text-white disabled:opacity-60">
              {dang ? "Đang lưu…" : "Lưu"}
            </button>
            <button type="button" onClick={() => setNhap(null)} className="min-h-11 rounded-xl border border-[#ccd8d1] px-4 text-sm font-bold text-[#53675e]">
              Thôi
            </button>
          </div>
        </form>
      ) : null}
      {loi ? (
        <p role="alert" className="mt-3 rounded-xl bg-[#fdecea] px-3 py-2 text-sm font-bold text-[#9b2c1f]">
          {loi}
        </p>
      ) : null}

      {coKho && ds.length === 0 ? <p className="mt-4 text-sm text-[#5f7068]">Sổ còn trống.</p> : null}
      {ds.length ? (
        <ul className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {ds.map((n) => (
            <li key={n.id} className="flex items-center gap-3 rounded-xl border border-[#e0e7e3] px-3 py-2.5" data-nguoi-cheo={n.soThuyen}>
              <span className="grid h-10 w-12 shrink-0 place-items-center rounded-lg bg-[#eef3f0] text-sm font-black tabular-nums text-[#183f34]">{n.soThuyen}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-black text-[#20342c]">
                  {n.hoTen}
                  {n.laMau ? <span className="ml-2 rounded-full bg-[#fff1d6] px-2 py-0.5 text-[0.65rem] font-black text-[#7a5520]">mẫu</span> : null}
                </span>
                <span className="block text-xs text-[#6e7b75]">{n.soDienThoai ?? "Chưa có số điện thoại"}</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  setLoi("");
                  setNhap({ id: n.id, soThuyen: n.soThuyen, hoTen: n.hoTen, soDienThoai: n.soDienThoai ?? "" });
                }}
                className="min-h-10 rounded-lg px-2 text-xs font-bold text-[#35594b] underline underline-offset-2"
              >
                Sửa
              </button>
              <button type="button" disabled={dang} onClick={() => xoa(n)} className="min-h-10 rounded-lg px-2 text-xs font-bold text-[#9b2c1f] underline underline-offset-2">
                Xoá
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
