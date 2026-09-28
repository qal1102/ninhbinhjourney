"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { ghiTienDoVongDanAction } from "@/app/erp/actions";
import {
  changMoLai,
  changTheoThuTu,
  laChangCuoi,
  nenTuMo,
  phanTramDaDi,
  VONG_TIEN,
  VONG_TIEN_COPY,
  type TienDoVongDan,
} from "@/domain/huong-dan-vong-dau";

/**
 * Vòng dẫn "Trình diễn một vòng khách", kịch bản ở `domain/huong-dan-vong-dau.ts`.
 *
 * Nằm trong khung ERP, nên khi đang đi dở nó hiện trên MỌI màn: người dùng
 * bấm sang màn Khách hàng vẫn thấy mình đang ở bước mấy, phải bấm gì. Trước
 * 28/09/2026 nó chỉ nằm trên trang đầu và biến mất ngay khi rời trang.
 *
 * ## Ba luật đặt ra từ cách tutorial game làm đúng
 *
 * 1. **Không khoá màn.** "Để sau" luôn nằm ngay đó; thu gọn được thành một dòng.
 * 2. **Chỉ tự hiện khi đang đi dở.** Đã xong hay đã "Để sau" thì chỉ trang đầu
 *    còn một dòng mời, các màn khác không hiện gì.
 * 3. **Không đèn rọi trỏ vào nút.** Mỗi bước là chữ cộng một nút mở màn thật,
 *    nên đổi bố cục bao nhiêu lần cũng không vỡ.
 *
 * ## Vì sao ghi tiến độ ngay khi bấm
 *
 * Người ta đọc dở rồi bị gọi đi họp. Mỗi lượt bấm ghi một nhịp; kho chỉ cho số
 * chặng tiến, nên một nhịp mạng tới muộn không kéo người đọc lùi về chặng cũ.
 */
export function VongDanPanel({
  tienDoBanDau,
  trangDau,
}: {
  tienDoBanDau: TienDoVongDan;
  /** Trang đầu giám đốc: nơi duy nhất còn hiện dòng mời khi vòng dẫn đang nghỉ. */
  trangDau: boolean;
}) {
  const [tienDo, setTienDo] = useState(tienDoBanDau);
  const [mo, setMo] = useState(() => nenTuMo(tienDoBanDau));
  const [thuGon, setThuGon] = useState(false);
  const [chang, setChang] = useState(() => changMoLai(tienDoBanDau.changHienTai));
  const [dangGhi, batDauGhi] = useTransition();

  function ghi(opts: { chang: number; xong?: boolean; boQua?: boolean; diLai?: boolean }) {
    const formData = new FormData();
    formData.set("chang", String(opts.chang));
    if (opts.xong) formData.set("xong", "1");
    if (opts.boQua) formData.set("boQua", "1");
    if (opts.diLai) formData.set("diLai", "1");
    batDauGhi(async () => {
      const ketQua = await ghiTienDoVongDanAction(formData);
      if (ketQua.ok) setTienDo(ketQua.tienDo);
    });
  }

  if (!mo) {
    if (!trangDau) return null;
    return (
      <section
        data-testid="vong-dan"
        data-mo="false"
        className="mb-6 rounded-2xl border border-[#d7e3c9] bg-[#f7faf3] p-4 sm:p-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <p className="text-sm leading-6 text-[#43564e]">
            <span className="font-black text-[#3d6b50]">{VONG_TIEN_COPY.ten}: </span>
            {tienDo.daXong ? VONG_TIEN_COPY.daXong : VONG_TIEN_COPY.moiChaoLai}
          </p>
          <button
            type="button"
            data-testid="vong-dan-mo"
            onClick={() => {
              const batDau = tienDo.daXong ? 1 : changMoLai(tienDo.changHienTai);
              setChang(batDau);
              setMo(true);
              setThuGon(false);
              ghi(tienDo.daXong ? { chang: 1, diLai: true } : { chang: batDau });
            }}
            className="inline-flex min-h-11 items-center rounded-lg border border-[#b6cca7] bg-white px-4 text-sm font-black text-[#3d6b50]"
          >
            {tienDo.daXong
              ? VONG_TIEN_COPY.diLai
              : tienDo.tungDi
                ? `Đi tiếp từ bước ${changMoLai(tienDo.changHienTai)}`
                : VONG_TIEN_COPY.batDau}
          </button>
        </div>
      </section>
    );
  }

  const hienTai = changTheoThuTu(chang) ?? VONG_TIEN[0];
  const cuoi = laChangCuoi(hienTai.thuTu);
  const nutMoMan = "inline-flex min-h-11 items-center rounded-lg bg-[#183f34] px-4 text-sm font-black text-white";

  return (
    <section
      data-testid="vong-dan"
      data-mo="true"
      data-chang={hienTai.thuTu}
      aria-label={`${VONG_TIEN_COPY.ten}, bước ${hienTai.thuTu} trên ${VONG_TIEN.length}`}
      className="mb-6 rounded-2xl border-2 border-[#9fc28c] bg-white p-4 shadow-sm sm:p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <p className="text-xs font-black uppercase tracking-[0.17em] text-[#3d6b50]">
          {VONG_TIEN_COPY.ten} · Bước {hienTai.thuTu}/{VONG_TIEN.length}
        </p>
        <button
          type="button"
          data-testid="vong-dan-thu-gon"
          aria-expanded={!thuGon}
          onClick={() => setThuGon((truoc) => !truoc)}
          className="inline-flex min-h-11 items-center text-sm font-black text-[#3d6b50] underline underline-offset-4"
        >
          {thuGon ? VONG_TIEN_COPY.moRong : VONG_TIEN_COPY.thuGon}
        </button>
      </div>

      {/* Thanh tiến độ: biết còn bao xa là thứ giữ người ta đi tiếp. */}
      <div
        className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[#e6eee0]"
        role="progressbar"
        aria-valuenow={phanTramDaDi(hienTai.thuTu)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Đã đi ${hienTai.thuTu} trên ${VONG_TIEN.length} bước`}
      >
        <div
          className="h-full rounded-full bg-[#3d6b50] transition-[width] motion-reduce:transition-none"
          style={{ width: `${phanTramDaDi(hienTai.thuTu)}%` }}
        />
      </div>

      <h2 className="mt-3 text-xl font-black text-[#1f2f2a]">
        {hienTai.thuTu}. {hienTai.ten}
      </h2>

      {thuGon ? null : (
        <>
          <p className="mt-1 text-sm font-bold text-[#5f7068]">
            Bạn đang ở: {hienTai.oDau}
          </p>
          <ol className="mt-3 space-y-2 rounded-xl bg-[#f3f8ef] px-4 py-3">
            {hienTai.cacViec.map((viec, index) => (
              <li key={viec} className="flex gap-3 text-sm leading-6 text-[#26402f]">
                <span
                  aria-hidden="true"
                  className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#3d6b50] text-xs font-black text-white"
                >
                  {index + 1}
                </span>
                <span>{viec}</span>
              </li>
            ))}
          </ol>

          <p className="mt-3 text-sm leading-6 text-[#42554c]">
            <span className="font-black">Bạn sẽ thấy: </span>
            {hienTai.seThay}
          </p>

          {hienTai.moMan ? (
            <div className="mt-3">
              {hienTai.moMan.theMoi ? (
                <a
                  href={hienTai.moMan.duong}
                  target="_blank"
                  rel="noopener"
                  data-testid="vong-dan-mo-man"
                  className={nutMoMan}
                >
                  {hienTai.moMan.nhan} ↗
                </a>
              ) : (
                <Link href={hienTai.moMan.duong} data-testid="vong-dan-mo-man" className={nutMoMan}>
                  {hienTai.moMan.nhan}
                </Link>
              )}
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[#e3ebdf] pt-4">
            {hienTai.thuTu > 1 ? (
              <button
                type="button"
                data-testid="vong-dan-lui"
                onClick={() => setChang((truoc) => Math.max(1, truoc - 1))}
                className="inline-flex min-h-11 items-center rounded-lg border border-[#ced8d1] bg-white px-4 text-sm font-black text-[#42554c]"
              >
                {VONG_TIEN_COPY.lui}
              </button>
            ) : null}

            <button
              type="button"
              data-testid="vong-dan-tiep"
              disabled={dangGhi}
              onClick={() => {
                if (cuoi) {
                  ghi({ chang: VONG_TIEN.length, xong: true });
                  setMo(false);
                  return;
                }
                const ke = hienTai.thuTu + 1;
                setChang(ke);
                ghi({ chang: ke });
              }}
              className="inline-flex min-h-11 items-center rounded-lg border-2 border-[#1f604c] bg-white px-4 text-sm font-black text-[#1f604c] disabled:opacity-60"
            >
              {cuoi ? VONG_TIEN_COPY.xong : `${VONG_TIEN_COPY.tiep} →`}
            </button>

            <button
              type="button"
              data-testid="vong-dan-de-sau"
              onClick={() => {
                ghi({ chang: hienTai.thuTu, boQua: true });
                setMo(false);
              }}
              className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-bold text-[#5f7068] underline underline-offset-4"
            >
              {VONG_TIEN_COPY.boQua}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
