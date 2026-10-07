"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { DanhSachGon } from "@/components/erp/danh-sach-gon";
import {
  capKhoaCongAction,
  doiTrangThaiDaiLyAction,
  ghiDaChiAction,
  taoDaiLyAction,
  type DaiLyActionState,
} from "@/app/erp/dai-ly-actions";
import { goiYMa, tenThang, tien, type DongDaiLy } from "@/domain/dai-ly";

const RONG: DaiLyActionState = { status: "idle", message: "" };

function LoiBao({ state, duongGoc }: { state: DaiLyActionState; duongGoc: string }) {
  if (state.status === "idle") return null;
  return (
    <div role={state.status === "error" ? "alert" : "status"} className="mt-2 text-sm">
      <p className={`font-bold ${state.status === "error" ? "text-[#9b2c1f]" : "text-[#245b45]"}`}>{state.message}</p>
      {state.duongCong ? (
        <p data-testid="duong-cong-moi" className="mt-1 break-all rounded-lg bg-[#fff8e8] px-3 py-2 font-mono text-xs text-[#6b5320]">
          {new URL(state.duongCong, duongGoc).toString()}
        </p>
      ) : null}
    </div>
  );
}

export function DaiLyWorkspace({
  dong,
  thang,
  thangHienTai,
  cacThang,
  maQr,
  duongGoc,
  laGiamDoc,
  duocGhiChi,
}: {
  dong: DongDaiLy[];
  thang: string;
  thangHienTai: string;
  cacThang: string[];
  maQr: Record<string, string>;
  duongGoc: string;
  laGiamDoc: boolean;
  duocGhiChi: boolean;
}) {
  const daKhep = thang < thangHienTai;
  const tongHoaHong = dong.reduce((s, d) => s + d.hoaHong, 0);
  const tongDaChi = dong.reduce((s, d) => s + (d.daChi ?? 0), 0);
  const tongKhachToi = dong.reduce((s, d) => s + d.khachToi, 0);
  // Người chèo có hoa hồng lớn nhất đứng đầu nhóm của mình.
  const daiLy = dong.filter((d) => d.loai !== "nguoi-cheo");
  const nguoiCheo = dong.filter((d) => d.loai === "nguoi-cheo").sort((a, b) => b.hoaHong - a.hoaHong || b.khach - a.khach);

  return (
    <div className="space-y-6" data-testid="dai-ly-erp" data-chi="dai-ly" data-chi-loi="Mỗi đại lý một dòng: hoa hồng tháng, đường dẫn giới thiệu, nút ghi đã chi.">
      <nav aria-label="Chọn tháng" className="flex flex-wrap gap-2">
        {cacThang.map((t) => (
          <Link
            key={t}
            href={`/erp/dai-ly?thang=${t}`}
            aria-current={t === thang ? "page" : undefined}
            className={`inline-flex min-h-10 items-center rounded-full px-4 text-sm font-bold ${t === thang ? "bg-[#183f34] text-white" : "border border-[#ccd8d1] bg-white text-[#183f34]"}`}
          >
            {tenThang(t)}
          </Link>
        ))}
      </nav>

      <section className="grid gap-3 sm:grid-cols-3">
        {[
          [daKhep ? `Hoa hồng ${tenThang(thang)}` : `Hoa hồng ${tenThang(thang)} (tạm tính)`, tien(tongHoaHong)],
          ["Đã ghi chi", tien(tongDaChi)],
          ["Khách đại lý đã tới", `${tongKhachToi} khách`],
        ].map(([nhan, giaTri]) => (
          <div key={nhan} className="rounded-2xl border border-[#d8e0da] bg-white p-4">
            <p className="text-xs font-bold text-[#5c6f66]">{nhan}</p>
            <p className="mt-1 text-2xl font-extrabold text-[#183f34]">{giaTri}</p>
          </div>
        ))}
      </section>

      <ul className="space-y-4">
        {daiLy.map((d) => (
          <TheDaiLy key={d.id} d={d} thang={thang} daKhep={daKhep} maQr={maQr[d.id] ?? ""} duongGoc={duongGoc} laGiamDoc={laGiamDoc} duocGhiChi={duocGhiChi} />
        ))}
      </ul>

      {/* 116: người chèo giới thiệu khách cũng là một mã trong sổ này, chi
          hoa hồng cùng một luồng. Gom riêng một nhóm để danh sách lữ hành
          không bị hai chục người chèo chen giữa. */}
      {nguoiCheo.length > 0 ? (
        <section aria-labelledby="dai-ly-nguoi-cheo" data-testid="dai-ly-nguoi-cheo">
          <h2 id="dai-ly-nguoi-cheo" className="text-xl font-extrabold text-[#183f34]">Người chèo giới thiệu khách</h2>
          <p className="mt-1 text-sm leading-6 text-[#5c6f66]">
            {nguoiCheo.length} người có mã · {nguoiCheo.reduce((t, d) => t + d.khachToi, 0)} khách đã tới · hoa hồng{" "}
            {tien(nguoiCheo.reduce((t, d) => t + d.hoaHong, 0))}. Cấp mã ở hồ sơ người chèo, màn{" "}
            <Link href="/erp/thuyen?chi=so-nguoi-cheo" className="font-bold underline underline-offset-2">Thuyền trên sông</Link>.
          </p>
          <div className="mt-4">
            <DanhSachGon
              the="ul"
              tenMuc="người chèo"
              soDau={3}
              buocThem={10}
              goiYTim="Tìm theo tên hay mã"
              className="space-y-4"
              tim={nguoiCheo.map((d) => `${d.ten} ${d.ma}`)}
              muc={nguoiCheo.map((d) => (
                <TheDaiLy key={d.id} d={d} thang={thang} daKhep={daKhep} maQr={maQr[d.id] ?? ""} duongGoc={duongGoc} laGiamDoc={laGiamDoc} duocGhiChi={duocGhiChi} />
              ))}
            />
          </div>
        </section>
      ) : null}

      {laGiamDoc ? <ThemDaiLy duongGoc={duongGoc} /> : null}
    </div>
  );
}

/** Lý do gõ tay thường đã có dấu chấm cuối; câu ghép thêm ". Bổ sung…" thì thành "..". */
function boDauCham(x: string): string {
  return x.trim().replace(/[.。!]+$/, "");
}

function TheDaiLy({
  d,
  thang,
  daKhep,
  maQr,
  duongGoc,
  laGiamDoc,
  duocGhiChi,
}: {
  d: DongDaiLy;
  thang: string;
  daKhep: boolean;
  maQr: string;
  duongGoc: string;
  laGiamDoc: boolean;
  duocGhiChi: boolean;
}) {
  const [chiState, chiAction, dangChi] = useActionState(ghiDaChiAction, RONG);
  const [khoaState, khoaAction, dangKhoa] = useActionState(capKhoaCongAction, RONG);
  const [ttState, ttAction, dangTt] = useActionState(doiTrangThaiDaiLyAction, RONG);
  const duongGioiThieu = new URL(`/dl/${d.ma}`, duongGoc).toString();

  return (
    <li className="rounded-3xl border border-[#d8e0da] bg-white p-5" data-testid={`dai-ly-${d.ma}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-[#183f34]">{d.ten}</h2>
          <p className="mt-1 text-sm text-[#59654b]">
            Mã <b>{d.ma}</b> · hoa hồng {String(d.tyLe).replace(".", ",")}%
            {d.nguoiLienHe ? ` · ${d.nguoiLienHe}` : ""}
            {d.dienThoai ? ` · ${d.dienThoai}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {d.laMau ? <span className="rounded-full bg-[#fdf0dc] px-3 py-1 text-xs font-bold text-[#8a5a14]">đại lý mẫu</span> : null}
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${d.trangThai === "hop-tac" ? "bg-[#e3f1e8] text-[#245b45]" : "bg-[#eceae3] text-[#5c6f66]"}`}>
            {d.trangThai === "hop-tac" ? "Đang hợp tác" : "Tạm ngưng"}
          </span>
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        {[
          ["Đơn đã trả", `${d.don} đơn · ${d.khach} khách`],
          ["Khách đã tới", `${d.donToi} đơn · ${d.khachToi} khách`],
          ["Tiền đơn đã tới", tien(d.doanhThuToi)],
          ["Hoa hồng", tien(d.hoaHong)],
        ].map(([nhan, giaTri]) => (
          <div key={nhan} className="rounded-2xl bg-[#f3f6f4] p-3">
            <dt className="text-xs font-bold text-[#5c6f66]">{nhan}</dt>
            <dd className="mt-1 font-extrabold text-[#183f34]">{giaTri}</dd>
          </div>
        ))}
      </dl>

      {d.daChi === null && d.trangThaiChi === "bi-tra-lai" ? (
        <p data-testid={`chi-tra-lai-${d.ma}`} className="mt-4 rounded-xl bg-[#fff4e5] px-3 py-2 text-sm text-[#7a4a12]">
          Kế toán trưởng đã trả lại lần chi trước: {boDauCham(d.lyDoTra ?? "")}. Bổ sung rồi ghi chi lại.
        </p>
      ) : null}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {d.daChi !== null ? (
          <div data-testid={`chi-${d.ma}`} data-trang-thai={d.trangThaiChi ?? ""} className="text-sm">
            <p className="font-bold text-[#245b45]">
              {d.trangThaiChi === "da-ghi-so"
                ? `Đã chi ${tien(d.daChi)} cho ${tenThang(thang)} · đã ghi sổ`
                : `Đã ghi chi ${tien(d.daChi)} cho ${tenThang(thang)} · chờ kế toán trưởng kiểm tra bút toán`}
            </p>
            {d.butToan.length ? (
              <p className="mt-1 text-xs text-[#59654b]">
                Bút toán Nợ 6418 / Có 1121, chia theo cơ sở khách qua cổng:{" "}
                <Link href="/erp/finance" className="font-bold text-[#183f34] underline underline-offset-2">
                  {d.butToan.filter((b) => b.trangThai !== "checker-returned").map((b) => b.ma).join(", ")}
                </Link>
              </p>
            ) : null}
          </div>
        ) : daKhep && !duocGhiChi ? (
          <p className="text-sm text-[#59654b]">
            Giám đốc hoặc kế toán tổng hợp ghi chi; kế toán trưởng kiểm tra bút toán ở màn Tài chính.
          </p>
        ) : daKhep ? (
          <form action={chiAction} className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="id" value={d.id} />
            <input type="hidden" name="thang" value={thang} />
            <input
              name="ghiChu"
              maxLength={200}
              placeholder="Ghi chú (số chứng từ chuyển khoản…)"
              aria-label={`Ghi chú chi hoa hồng ${d.ma}`}
              className="min-h-11 w-64 max-w-full rounded-xl border border-[#ccd8d1] px-3 text-sm"
            />
            <button type="submit" disabled={dangChi} className="inline-flex min-h-11 items-center rounded-full bg-[#183f34] px-4 text-sm font-extrabold text-white disabled:opacity-50">
              Ghi đã chi {tien(d.hoaHong)}
            </button>
          </form>
        ) : (
          <p className="text-sm text-[#59654b]">Tháng chưa khép: hoa hồng còn tăng khi khách tới.</p>
        )}
        <Link href={`/erp/dai-ly/${d.id}`} className="inline-flex min-h-11 items-center rounded-full border border-[#183f34] px-4 text-sm font-bold text-[#183f34]">
          Xem cổng như đại lý thấy
        </Link>
      </div>
      <LoiBao state={chiState} duongGoc={duongGoc} />

      <details className="mt-4 rounded-2xl border border-[#e3e8e5] p-3">
        <summary className="cursor-pointer text-sm font-bold text-[#42554c]">Đường dẫn giới thiệu và mã QR</summary>
        <div className="mt-3 flex flex-wrap items-center gap-4">
          {maQr ? (
            <div role="img" aria-label={`Mã QR tới ${duongGioiThieu}`} className="h-28 w-28 rounded-xl border border-[#e3e8e5] p-2 [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: maQr }} />
          ) : null}
          <p className="break-all font-mono text-sm text-[#183f34]">{duongGioiThieu}</p>
        </div>
        {laGiamDoc ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <form action={khoaAction}>
              <input type="hidden" name="id" value={d.id} />
              <input type="hidden" name="ma" value={d.ma} />
              <button type="submit" disabled={dangKhoa} className="inline-flex min-h-11 items-center rounded-full border border-[#b9c4bd] px-4 text-sm font-bold text-[#183f34] disabled:opacity-50">
                {d.coKhoa ? "Cấp lại khoá cổng" : "Cấp khoá cổng cho đại lý"}
              </button>
            </form>
            <form action={ttAction}>
              <input type="hidden" name="id" value={d.id} />
              <input type="hidden" name="trangThai" value={d.trangThai === "hop-tac" ? "tam-ngung" : "hop-tac"} />
              <button type="submit" disabled={dangTt} className="inline-flex min-h-11 items-center rounded-full border border-[#b9c4bd] px-4 text-sm font-bold text-[#183f34] disabled:opacity-50">
                {d.trangThai === "hop-tac" ? "Tạm ngưng hợp tác" : "Hợp tác lại"}
              </button>
            </form>
          </div>
        ) : null}
        <LoiBao state={khoaState} duongGoc={duongGoc} />
        <LoiBao state={ttState} duongGoc={duongGoc} />
      </details>
    </li>
  );
}

function ThemDaiLy({ duongGoc }: { duongGoc: string }) {
  const [state, action, dangGui] = useActionState(taoDaiLyAction, RONG);
  const [ten, setTen] = useState("");
  const [ma, setMa] = useState("");
  return (
    <section className="rounded-3xl border border-dashed border-[#b9c4bd] bg-white p-5" aria-labelledby="them-dai-ly">
      <h2 id="them-dai-ly" className="text-lg font-extrabold text-[#183f34]">Thêm đại lý</h2>
      <form action={action} className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-bold text-[#42554c]">
          Tên đại lý
          <input name="ten" required value={ten} onChange={(e) => setTen(e.target.value)} className="mt-1 block min-h-11 w-full rounded-xl border border-[#ccd8d1] px-3 font-normal" />
        </label>
        <label className="text-sm font-bold text-[#42554c]">
          Mã (để trống thì tự đặt)
          <input
            name="ma"
            value={ma}
            onChange={(e) => setMa(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 16))}
            placeholder={ten ? goiYMa(ten) : "VD: HANOITRAVEL"}
            className="mt-1 block min-h-11 w-full rounded-xl border border-[#ccd8d1] px-3 font-mono font-normal"
          />
        </label>
        <label className="text-sm font-bold text-[#42554c]">
          Người liên hệ
          <input name="nguoiLienHe" maxLength={80} className="mt-1 block min-h-11 w-full rounded-xl border border-[#ccd8d1] px-3 font-normal" />
        </label>
        <label className="text-sm font-bold text-[#42554c]">
          Số điện thoại
          <input name="dienThoai" inputMode="tel" maxLength={20} className="mt-1 block min-h-11 w-full rounded-xl border border-[#ccd8d1] px-3 font-normal" />
        </label>
        <label className="text-sm font-bold text-[#42554c]">
          Hoa hồng (%)
          <input name="tyLe" type="number" min={0} max={30} step={0.5} defaultValue={8} required className="mt-1 block min-h-11 w-full rounded-xl border border-[#ccd8d1] px-3 font-normal" />
        </label>
        <div className="flex items-end">
          <button type="submit" disabled={dangGui} className="inline-flex min-h-11 items-center rounded-full bg-[#183f34] px-5 text-sm font-extrabold text-white disabled:opacity-50">
            {dangGui ? "Đang thêm…" : "Thêm đại lý"}
          </button>
        </div>
      </form>
      <LoiBao state={state} duongGoc={duongGoc} />
    </section>
  );
}
