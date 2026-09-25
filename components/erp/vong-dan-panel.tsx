"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { ghiTienDoVongDanAction, switchDemoRoleAction } from "@/app/erp/actions";
import { ERP_ROLE_LABELS, type ErpSiteId } from "@/domain/erp";
import {
  changMoLai,
  changTheoThuTu,
  laChangCuoi,
  nenTuMo,
  phanTramDaDi,
  VONG_TIEN,
  VONG_TIEN_COPY,
  type KhoaSo,
  type TienDoVongDan,
} from "@/domain/huong-dan-vong-dau";

/**
 * Vòng dẫn "đi theo một đồng tiền" — bảy chặng, mỗi chặng một con số thật.
 *
 * ## Ba luật đặt ra từ cách tutorial game làm đúng
 *
 * 1. **Không khoá màn.** Người dùng bỏ đi lúc nào cũng được, và "Để sau" luôn
 *    nằm ngay đó. Một bài hướng dẫn giam người đọc là bài không ai đọc lần hai.
 * 2. **Chỉ tự bung ra đúng một lần**, cho người chưa từng đi. Về sau nó thu
 *    lại thành một dòng mời.
 * 3. **Không đèn rọi trỏ vào nút.** Mỗi chặng là một khối chữ cộng một đường
 *    dẫn mở màn thật, nên đổi bố cục bao nhiêu lần cũng không vỡ.
 *
 * ## Vì sao ghi tiến độ ngay khi bấm, không đợi đi hết
 *
 * Người ta đọc dở rồi bị gọi đi họp. Lần sau mở lại mà phải đi từ chặng một là
 * họ bỏ luôn. Mỗi lượt bấm ghi một nhịp; kho chỉ cho số chặng **tiến**, nên một
 * nhịp mạng tới muộn không kéo được người đọc lùi về chặng cũ.
 */
export function VongDanPanel({
  tienDoBanDau,
  soThat,
  siteId,
  taiKhoanTheoChang = {},
}: {
  /** Tài khoản mẫu cho những bước phải chuyển vai, theo số bước. */
  taiKhoanTheoChang?: Partial<Record<number, string>>;
  tienDoBanDau: TienDoVongDan;
  /** Con số thật cho từng chặng, do trang chủ điền từ dữ liệu đang có. */
  soThat: Partial<Record<KhoaSo, string>>;
  siteId: ErpSiteId;
}) {
  const [tienDo, setTienDo] = useState(tienDoBanDau);
  const [mo, setMo] = useState(() => nenTuMo(tienDoBanDau));
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
  const so = soThat[hienTai.khoaSo];
  const cuoi = laChangCuoi(hienTai.thuTu);

  return (
    <section
      data-testid="vong-dan"
      data-mo="true"
      data-chang={hienTai.thuTu}
      className="mb-6 rounded-2xl border border-[#c6dcb4] bg-white p-5 shadow-sm sm:p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <p className="text-xs font-black uppercase tracking-[0.17em] text-[#3d6b50]">
          {VONG_TIEN_COPY.ten}
        </p>
        <p className="text-sm font-black tabular-nums text-[#5f7068]">
          Bước {hienTai.thuTu}/{VONG_TIEN.length}
        </p>
      </div>

      {/* Thanh tiến độ: biết còn bao xa là thứ giữ người ta đi tiếp. */}
      <div
        className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[#e6eee0]"
        role="progressbar"
        aria-valuenow={phanTramDaDi(hienTai.thuTu)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Đã đi ${hienTai.thuTu} trên ${VONG_TIEN.length} bước`}
      >
        <div
          className="h-full rounded-full bg-[#3d6b50] transition-[width]"
          style={{ width: `${phanTramDaDi(hienTai.thuTu)}%` }}
        />
      </div>

      <h2 className="mt-3 text-xl font-black text-[#1f2f2a]">
        {hienTai.thuTu}. {hienTai.ten}
      </h2>
      <div className="mt-3 rounded-xl bg-[#f3f8ef] px-4 py-3">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-[#3d6b50]">Bấm vào đâu</p>
        <p className="mt-1 text-sm leading-6 text-[#26402f]">{hienTai.lamGi}</p>
      </div>

      {hienTai.khoaSo !== "khong-can" ? (
        <p
          data-testid="vong-dan-so-that"
          className="mt-3 rounded-xl bg-[#f3f8ef] px-4 py-3 text-base font-black leading-7 text-[#26402f]"
        >
          {so && so.trim().length > 0 ? so : VONG_TIEN_COPY.chuaCoSo}
        </p>
      ) : null}

      <p className="mt-3 text-sm leading-6 text-[#42554c]">
        <span className="font-black">Để ý thấy gì: </span>
        {hienTai.deY}
      </p>

      {hienTai.moMan ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {hienTai.moMan.vai && taiKhoanTheoChang[hienTai.thuTu] ? (
            // Việc của nhân viên: chuyển vai rồi đứng ngay đúng màn hình.
            <form action={switchDemoRoleAction}>
              <input type="hidden" name="targetUserId" value={taiKhoanTheoChang[hienTai.thuTu]} />
              <input type="hidden" name="next" value={hienTai.moMan.duong(siteId)} />
              <button
                type="submit"
                data-testid="vong-dan-lam-thu"
                className="inline-flex min-h-11 items-center rounded-lg bg-[#183f34] px-4 text-sm font-black text-white"
              >
                Làm thử như {ERP_ROLE_LABELS[hienTai.moMan.vai]}
              </button>
            </form>
          ) : null}
          {hienTai.moMan.vai && taiKhoanTheoChang[hienTai.thuTu] ? null : hienTai.moMan.theMoi ? (
            <a
              href={hienTai.moMan.duong(siteId)}
              target="_blank"
              rel="noopener"
              data-testid="vong-dan-mo-man"
              className="inline-flex min-h-11 items-center rounded-lg border border-[#2f6f8f] px-4 text-sm font-black text-[#2f6f8f]"
            >
              {hienTai.moMan.nhan} ↗
            </a>
          ) : (
            <Link
              href={hienTai.moMan.duong(siteId)}
              data-testid="vong-dan-mo-man"
              className="inline-flex min-h-11 items-center rounded-lg border border-[#2f6f8f] px-4 text-sm font-black text-[#2f6f8f]"
            >
              {hienTai.moMan.nhan}
            </Link>
          )}
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-2">
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
          className="inline-flex min-h-11 items-center rounded-lg bg-[#1f604c] px-4 text-sm font-black text-white disabled:opacity-60"
        >
          {cuoi ? VONG_TIEN_COPY.xong : VONG_TIEN_COPY.tiep}
        </button>

        <button
          type="button"
          data-testid="vong-dan-de-sau"
          onClick={() => {
            ghi({ chang: hienTai.thuTu, boQua: true });
            setMo(false);
          }}
          className="inline-flex min-h-11 items-center rounded-lg border border-[#ced8d1] bg-white px-4 text-sm font-black text-[#5f7068]"
        >
          {VONG_TIEN_COPY.boQua}
        </button>
      </div>
    </section>
  );
}
