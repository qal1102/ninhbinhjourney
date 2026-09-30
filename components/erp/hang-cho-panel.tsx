"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState, type ReactNode } from "react";
import {
  caiDatHangChoAction,
  danhDauLuotAction,
  goiLuotTiepAction,
  type HangChoActionState,
} from "@/app/erp/hang-cho-actions";
import type { ErpSiteId } from "@/domain/erp";
import {
  daQuaGioGiu,
  soHienThi,
  tocDoLenThuyen,
  uocPhutCho,
  type LuotTrongErp,
  type TongQuanHangCho,
} from "@/domain/hang-cho";

const RONG: HangChoActionState = { status: "idle", message: "" };
const TU_TAI_MS = 15_000;

function gio(iso: string | null) {
  if (!iso) return "";
  return new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(iso));
}

function LoiBao({ state }: { state: HangChoActionState }) {
  if (state.status === "idle") return null;
  return (
    <p role={state.status === "error" ? "alert" : "status"} className={`mt-2 text-sm font-bold ${state.status === "error" ? "text-[#9b2c1f]" : "text-[#245b45]"}`}>
      {state.message}
    </p>
  );
}

/**
 * Hàng chờ ảo ở màn Sức chứa của cơ sở có bến đò. Nhân viên gọi lượt theo
 * đúng thứ tự số, ghi lên đò hay bỏ lượt; màn hình tự tải lại mỗi 15 giây để
 * thấy khách mới lấy số.
 */
export function HangChoPanel({
  siteId,
  tenBen,
  duongKhach,
  maQrSvg,
  tongQuan,
  luot,
  quanLyDuoc,
}: {
  siteId: ErpSiteId;
  tenBen: string;
  duongKhach: string;
  maQrSvg: string | null;
  tongQuan: TongQuanHangCho;
  luot: LuotTrongErp[];
  quanLyDuoc: boolean;
}) {
  const router = useRouter();
  const [goiState, goiAction, dangGoi] = useActionState(goiLuotTiepAction, RONG);
  const [danhDauState, danhDauAction, dangDanhDau] = useActionState(danhDauLuotAction, RONG);
  const [caiDatState, caiDatAction, dangCaiDat] = useActionState(caiDatHangChoAction, RONG);
  const [soNhom, setSoNhom] = useState(3);
  const [bayGio, setBayGio] = useState(() => Date.now());

  useEffect(() => {
    const hen = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      setBayGio(Date.now());
      router.refresh();
    }, TU_TAI_MS);
    return () => window.clearInterval(hen);
  }, [router]);

  const dangGoiDs = luot.filter((l) => l.trangThai === "da-goi");
  const choDs = luot.filter((l) => l.trangThai === "cho");
  const boLuotDs = luot.filter((l) => l.trangThai === "bo-luot");
  const toc = tocDoLenThuyen(tongQuan);
  const phutCuoi = uocPhutCho(tongQuan.soKhachCho, tongQuan);

  return (
    <section
      data-testid="hang-cho-erp"
      data-chi="goi-luot"
      data-chi-loi="Bấm “Gọi … nhóm tiếp”: máy của khách tự báo tới lượt."
      className="mb-8 rounded-3xl border border-[#d8e0da] bg-white p-5 sm:p-6"
      aria-labelledby="hang-cho-tieu-de"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#668078]">Hàng chờ ảo · {tenBen}</p>
          <h2 id="hang-cho-tieu-de" className="mt-1 text-2xl font-extrabold text-[#183f34]">
            {tongQuan.soNhomCho === 0 ? "Không ai đang chờ" : `${tongQuan.soNhomCho} nhóm đang chờ · ${tongQuan.soKhachCho} khách`}
          </h2>
          <p className="mt-1 text-sm text-[#59654b]">
            Người mới lấy số chờ {phutCuoi === 0 ? "không phút nào" : `khoảng ${phutCuoi} phút`} · tốc độ{" "}
            {toc.nguon === "do"
              ? `đo được ${toc.khachMoiPhut.toFixed(1)} khách/phút (30 phút qua)`
              : `khai ${toc.khachMoiPhut} khách/phút (chưa đủ khách lên đò để đo)`}
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-extrabold ${tongQuan.dangNhan ? "bg-[#e3f1e8] text-[#245b45]" : "bg-[#fdf0dc] text-[#8a5a14]"}`}>
          {tongQuan.dangNhan ? "Đang nhận số" : "Tạm dừng nhận số"}
        </span>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        {[
          ["Đã lên đò hôm nay", `${tongQuan.daLenHomNay} khách · ${tongQuan.nhomDaLen} nhóm`],
          ["Chờ trung bình", tongQuan.phutChoTrungBinh === null ? "—" : `${tongQuan.phutChoTrungBinh} phút`],
          ["Bỏ lượt", String(tongQuan.nhomBoLuot)],
          ["Khách tự huỷ", String(tongQuan.nhomHuy)],
        ].map(([nhan, giaTri]) => (
          <div key={nhan} className="rounded-2xl bg-[#f3f6f4] p-3">
            <dt className="text-xs font-bold text-[#5c6f66]">{nhan}</dt>
            <dd className="mt-1 font-extrabold text-[#183f34]">{giaTri}</dd>
          </div>
        ))}
      </dl>

      <form action={goiAction} className="mt-5 flex flex-wrap items-center gap-2">
        <input type="hidden" name="siteId" value={siteId} />
        <input type="hidden" name="soNhom" value={soNhom} />
        <span className="text-sm font-bold text-[#42554c]">Đò trống cho</span>
        <div role="radiogroup" aria-label="Số nhóm gọi" className="inline-flex rounded-full border border-[#ccd8d1] p-1">
          {[1, 3, 5, 10].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={soNhom === n}
              onClick={() => setSoNhom(n)}
              className={`min-h-9 min-w-10 rounded-full px-3 text-sm font-extrabold ${soNhom === n ? "bg-[#183f34] text-white" : "text-[#183f34]"}`}
            >
              {n}
            </button>
          ))}
        </div>
        <button
          type="submit"
          disabled={dangGoi || tongQuan.soNhomCho === 0}
          className="inline-flex min-h-11 items-center rounded-full bg-[#183f34] px-5 text-sm font-extrabold text-white disabled:opacity-50"
        >
          {dangGoi ? "Đang gọi…" : `Gọi ${soNhom} nhóm tiếp`}
        </button>
      </form>
      <LoiBao state={goiState} />

      {dangGoiDs.length > 0 ? (
        <div className="mt-5">
          <h3 className="text-sm font-black uppercase tracking-[0.12em] text-[#8a5a14]">Đã gọi, chờ ra bến</h3>
          <ul className="mt-2 divide-y divide-[#eef1ef] rounded-2xl border border-[#eadfca]">
            {dangGoiDs.map((l) => (
              <DongLuot key={l.id} luot={l} siteId={siteId} action={danhDauAction} dangGui={dangDanhDau}>
                <span className="text-xs text-[#59654b]">
                  gọi lúc {gio(l.goiLuc)}
                  {daQuaGioGiu(l.goiLuc, tongQuan.phutGiuLuot, bayGio) ? (
                    <span className="ml-2 rounded-full bg-[#fdecea] px-2 py-0.5 font-bold text-[#9b2c1f]">quá {tongQuan.phutGiuLuot} phút</span>
                  ) : null}
                </span>
              </DongLuot>
            ))}
          </ul>
        </div>
      ) : null}
      <LoiBao state={danhDauState} />

      {choDs.length > 0 ? (
        <div className="mt-5">
          <h3 className="text-sm font-black uppercase tracking-[0.12em] text-[#668078]">Đang chờ, theo thứ tự</h3>
          <p className="mt-2 flex flex-wrap gap-2">
            {choDs.slice(0, 24).map((l) => (
              <span key={l.id} className="rounded-full bg-[#f3f6f4] px-3 py-1 text-sm font-bold text-[#183f34]">
                {soHienThi(l.soThuTu)} · {l.soKhach} khách{l.ngonNgu === "en" ? " · EN" : ""}
              </span>
            ))}
            {choDs.length > 24 ? <span className="px-2 py-1 text-sm text-[#59654b]">và {choDs.length - 24} nhóm nữa</span> : null}
          </p>
        </div>
      ) : null}

      {boLuotDs.length > 0 ? (
        <details className="mt-5" open>
          <summary className="cursor-pointer text-sm font-bold text-[#42554c]">
            Đã bỏ lượt ({boLuotDs.length}): khách quay lại thì gọi lại, không đi nữa thì huỷ hẳn
          </summary>
          <ul className="mt-2 divide-y divide-[#eef1ef] rounded-2xl border border-[#e3e8e5]">
            {boLuotDs.map((l) => (
              <DongLuot key={l.id} luot={l} siteId={siteId} action={danhDauAction} dangGui={dangDanhDau} goiLai />
            ))}
          </ul>
        </details>
      ) : null}

      <div className="mt-6 grid gap-4 border-t border-[#eef1ef] pt-5 lg:grid-cols-2">
        <div>
          <h3 className="text-sm font-extrabold text-[#183f34]">Mã dán ở bến</h3>
          <p className="mt-1 text-sm leading-6 text-[#59654b]">
            Khách quét mã này để lấy số. Trang khách có tiếng Việt và tiếng Anh.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-4">
            {maQrSvg ? (
              <div
                className="h-32 w-32 rounded-xl border border-[#e3e8e5] bg-white p-2 [&>svg]:h-full [&>svg]:w-full"
                aria-label={`Mã QR tới ${duongKhach}`}
                role="img"
                dangerouslySetInnerHTML={{ __html: maQrSvg }}
              />
            ) : null}
            <Link href={duongKhach} target="_blank" className="inline-flex min-h-11 items-center rounded-full border border-[#183f34] px-4 text-sm font-bold text-[#183f34]">
              Mở trang khách ↗
            </Link>
          </div>
        </div>
        {quanLyDuoc ? (
          <form action={caiDatAction}>
            <input type="hidden" name="siteId" value={siteId} />
            <input type="hidden" name="dangNhan" value={tongQuan.dangNhan ? "0" : "1"} />
            <h3 className="text-sm font-extrabold text-[#183f34]">{tongQuan.dangNhan ? "Tạm dừng nhận số" : "Mở lại nhận số"}</h3>
            {tongQuan.dangNhan ? (
              <label className="mt-2 block text-sm text-[#42554c]">
                Lời nhắn cho khách
                <input
                  name="loiTamDung"
                  maxLength={200}
                  placeholder="Nước lên, bến tạm nghỉ tới 14:00"
                  className="mt-1 block min-h-11 w-full rounded-xl border border-[#ccd8d1] px-3"
                />
              </label>
            ) : (
              <p className="mt-2 text-sm text-[#59654b]">Khách đang thấy: “{tongQuan.loiTamDung ?? "Bến tạm dừng nhận số"}”.</p>
            )}
            <button
              type="submit"
              disabled={dangCaiDat}
              className={`mt-3 inline-flex min-h-11 items-center rounded-full px-5 text-sm font-extrabold disabled:opacity-50 ${tongQuan.dangNhan ? "border border-[#8a5a14] text-[#8a5a14]" : "bg-[#183f34] text-white"}`}
            >
              {tongQuan.dangNhan ? "Tạm dừng nhận số" : "Mở lại nhận số"}
            </button>
            <p className="mt-2 text-xs text-[#6b746e]">Khách đang cầm số vẫn được gọi như thường.</p>
            <LoiBao state={caiDatState} />
          </form>
        ) : null}
      </div>
    </section>
  );
}

function DongLuot({
  luot,
  siteId,
  action,
  dangGui,
  goiLai = false,
  children,
}: {
  luot: LuotTrongErp;
  siteId: ErpSiteId;
  action: (formData: FormData) => void;
  dangGui: boolean;
  goiLai?: boolean;
  children?: ReactNode;
}) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
      <span className="flex flex-wrap items-baseline gap-x-3">
        <span className="text-lg font-extrabold text-[#183f34]">{soHienThi(luot.soThuTu)}</span>
        <span className="text-sm text-[#42554c]">{luot.soKhach} khách{luot.ngonNgu === "en" ? " · khách nói tiếng Anh" : ""}</span>
        {children}
      </span>
      <span className="flex gap-2">
        {(goiLai ? [["da-goi", "Gọi lại"], ["khach-huy", "Huỷ hẳn"]] : [["da-len", "Đã lên đò"], ["bo-luot", "Bỏ lượt"]]).map(([trangThai, nhan]) => (
          <form key={trangThai} action={action}>
            <input type="hidden" name="siteId" value={siteId} />
            <input type="hidden" name="id" value={luot.id} />
            <input type="hidden" name="trangThai" value={trangThai} />
            <button
              type="submit"
              disabled={dangGui}
              aria-label={`${nhan} ${soHienThi(luot.soThuTu)}`}
              className={`inline-flex min-h-10 items-center rounded-full px-4 text-sm font-bold disabled:opacity-50 ${trangThai === "da-len" ? "bg-[#245b45] text-white" : "border border-[#b9c4bd] text-[#183f34]"}`}
            >
              {nhan}
            </button>
          </form>
        ))}
      </span>
    </li>
  );
}
