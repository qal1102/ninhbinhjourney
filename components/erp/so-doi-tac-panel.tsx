"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import {
  ghiDoiTacAction,
  goDoiTacAction,
  type DoiTacActionState,
} from "@/app/erp/doi-tac-actions";
import {
  CAC_GIAI_DOAN,
  daNguoi,
  demViecPhaiLam,
  loiImLang,
  MO_TA_GIAI_DOAN,
  xepSoDoiTac,
  type DoiTacNhanHang,
} from "@/domain/doi-tac-nhan-hang";
import type { DipSapToi } from "@/domain/lich-mua-vu";

/**
 * Sổ liên hệ nhãn hàng đối tác, trên màn hình Marketing.
 *
 * ## Nó mở ra bằng câu trả lời, không phải bằng một cái bảng
 *
 * Dòng to nhất của khối này là **số mối đang chờ mình gọi lại**, không phải
 * tổng số nhãn hàng trong sổ. Tổng số là con số khoe được mà không dùng được;
 * còn "ba mối đang nguội" là thứ khiến người ta nhấc máy lên.
 *
 * ## Ô "ghi là vừa trao đổi" là một ô riêng, cố ý
 *
 * Sửa một lỗi chính tả trong tên không được làm mối ấy trông như vừa được
 * chăm sóc hôm nay. Đó đúng là chỗ một cuốn sổ bắt đầu tự lừa dối người dùng —
 * và rồi ba tháng sau không ai nhớ mình đã bỏ rơi ai.
 *
 * ## Không có tên nhãn hàng nào nằm trong tệp này
 *
 * Mọi tên đối tác đều do người dùng nhập. Đây là ranh giới sẵn có của dự án
 * (`tests/security/no-third-party-brands.test.ts`) và tệp này không phá nó.
 */

// Hằng số nằm ở đây chứ không nằm cạnh lệnh máy chủ: tệp `"use server"` chỉ
// được phép xuất ra hàm bất đồng bộ, xuất thêm một đối tượng là Next.js ném
// lỗi ngay lượt bấm nút đầu tiên trên production.
const TRANG_THAI_DAU: DoiTacActionState = { status: "idle", message: "" };

function NutLuu({ children }: { children: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="min-h-11 rounded-xl bg-[#183f34] px-4 text-sm font-black text-white disabled:cursor-wait disabled:opacity-60"
    >
      {pending ? "Đang lưu…" : children}
    </button>
  );
}

function LoiNhan({ trangThai }: { trangThai: DoiTacActionState }) {
  if (trangThai.status === "idle") return null;
  return (
    <p
      role={trangThai.status === "error" ? "alert" : "status"}
      className={`text-sm font-bold ${
        trangThai.status === "error" ? "text-[#994737]" : "text-[#28654d]"
      }`}
    >
      {trangThai.message}
    </p>
  );
}

const O_NHAP =
  "min-h-11 rounded-lg border border-[#cbd7d1] bg-white px-3 text-sm text-[#28322c]";
const NHAN_O = "grid gap-1 text-xs font-bold text-[#5d6f66]";

function OForm({
  dip,
  dangSua,
  onThoiSua,
}: {
  dip: readonly DipSapToi[];
  dangSua: DoiTacNhanHang | null;
  onThoiSua: () => void;
}) {
  const [trangThai, action] = useActionState(ghiDoiTacAction, TRANG_THAI_DAU);

  return (
    <form
      action={action}
      id="them-doi-tac"
      // `key` buộc React dựng lại cả cụm ô khi chuyển sang sửa một dòng khác:
      // `defaultValue` chỉ được đọc lúc dựng, không có nó thì bấm "Sửa" ở dòng
      // thứ hai sẽ thấy nguyên thông tin của dòng thứ nhất.
      key={dangSua?.id ?? "moi"}
      className="mt-6 grid gap-3 rounded-2xl border border-[#d7c69c] bg-white p-4 sm:p-5 lg:grid-cols-2"
    >
      <input type="hidden" name="id" value={dangSua?.id ?? ""} />
      <p className="text-sm font-black text-[#3d3325] lg:col-span-2">
        {dangSua ? `Sửa: ${dangSua.ten}` : "Thêm một nhãn hàng vào sổ"}
      </p>

      <label className={NHAN_O}>
        Tên nhãn hàng
        <input
          name="ten"
          required
          maxLength={160}
          defaultValue={dangSua?.ten ?? ""}
          className={O_NHAP}
        />
      </label>

      <label className={NHAN_O}>
        Ngành hàng
        <input
          name="nganhHang"
          maxLength={80}
          defaultValue={dangSua?.nganhHang ?? ""}
          placeholder="ví dụ: thời trang, đồ uống, hàng không"
          className={O_NHAP}
        />
      </label>

      <label className={NHAN_O}>
        Người phụ trách bên họ
        <input
          name="nguoiBenHo"
          maxLength={120}
          defaultValue={dangSua?.nguoiBenHo ?? ""}
          className={O_NHAP}
        />
      </label>

      <label className={NHAN_O}>
        Cách liên hệ
        <input
          name="cachLienHe"
          maxLength={200}
          defaultValue={dangSua?.cachLienHe ?? ""}
          placeholder="điện thoại hoặc thư điện tử"
          className={O_NHAP}
        />
      </label>

      <label className={NHAN_O}>
        Bên mình ai đang theo
        <input
          name="nguoiPhuTrach"
          maxLength={120}
          defaultValue={dangSua?.nguoiPhuTrach ?? ""}
          className={O_NHAP}
        />
      </label>

      <label className={NHAN_O}>
        Đang tới đâu rồi
        <select
          name="giaiDoan"
          defaultValue={dangSua?.giaiDoan ?? "nham-truoc"}
          className={O_NHAP}
        >
          {CAC_GIAI_DOAN.map((g) => (
            <option key={g} value={g}>
              {MO_TA_GIAI_DOAN[g].ten}
            </option>
          ))}
        </select>
      </label>

      <label className={NHAN_O}>
        Nhắm vào dịp nào
        <select
          name="dipNhamToi"
          defaultValue={dangSua?.dipNhamToi ?? ""}
          className={O_NHAP}
        >
          <option value="">Chưa nhắm dịp nào</option>
          {dip.map((d) => (
            <option key={d.dip.id} value={d.dip.id}>
              {d.dip.ten}
            </option>
          ))}
        </select>
      </label>

      <label className={`${NHAN_O} lg:col-span-2`}>
        Ghi chú
        <textarea
          name="ghiChu"
          maxLength={1000}
          rows={2}
          defaultValue={dangSua?.ghiChu ?? ""}
          placeholder="hẹn gì, còn vướng gì, ai giới thiệu"
          className="rounded-lg border border-[#cbd7d1] bg-white p-3 text-sm text-[#28322c]"
        />
      </label>

      {/*
        Ô này tách hẳn khỏi phần sửa nội dung. Nếu gộp chung thì mỗi lần sửa
        một lỗi chính tả, ngày trao đổi gần nhất lại nhảy về hôm nay và mối ấy
        không bao giờ nổi lên nhóm "đang nguội" nữa.
      */}
      <label className="flex min-h-11 items-center gap-2 text-sm font-bold text-[#4a5751] lg:col-span-2">
        <input type="checkbox" name="ghiTraoDoi" value="co" className="h-5 w-5" />
        Hôm nay có trao đổi thật với họ
      </label>

      <div className="flex flex-wrap items-center gap-3 lg:col-span-2">
        <NutLuu>{dangSua ? "Lưu thay đổi" : "Thêm vào sổ"}</NutLuu>
        {dangSua ? (
          <button
            type="button"
            onClick={onThoiSua}
            className="min-h-11 text-sm font-bold text-[#5d6f66] underline underline-offset-4"
          >
            Thôi, để thêm dòng mới
          </button>
        ) : null}
        <LoiNhan trangThai={trangThai} />
      </div>
    </form>
  );
}

/**
 * Khối gỡ — nằm NGOÀI danh sách, không nằm trong dòng sắp bị gỡ.
 *
 * Lý do đo được trên production ở khổ điện thoại: lúc đầu lời báo "đã gỡ"
 * nằm ngay trong cái `<li>` vừa bị gỡ, nên dòng biến mất là lời báo biến mất
 * theo — người dùng bấm xong, hàng biến mất, và **không có gì nói cho họ biết
 * là đã xong**. Lời xác nhận một việc không bao giờ được sống bên trong chính
 * thứ mà việc ấy xoá đi.
 */
function KhoiGo({
  dangGo,
  onThoi,
}: {
  dangGo: DoiTacNhanHang | null;
  onThoi: () => void;
}) {
  const [trangThai, action] = useActionState(goDoiTacAction, TRANG_THAI_DAU);

  if (!dangGo) return <LoiNhan trangThai={trangThai} />;

  return (
    <form
      action={action}
      data-khoi-go
      className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-[#d8b3a8] bg-[#fff8f3] p-4"
    >
      <input type="hidden" name="id" value={dangGo.id} />
      <input type="hidden" name="ten" value={dangGo.ten} />
      <span className="text-sm font-bold text-[#994737]">
        Gỡ hẳn “{dangGo.ten}” khỏi sổ?
      </span>
      {/*
        KHÔNG gọi `onThoi` ở đây. Đặt lại trạng thái ngay trong lượt bấm sẽ
        tháo chính cái form đang gửi đi, và lệnh máy chủ không bao giờ chạy.
        Lời hỏi tự đóng khi dòng ấy biến khỏi sổ — xem hiệu ứng ở panel.
      */}
      <button
        type="submit"
        className="min-h-11 rounded-lg border border-[#d8b3a8] bg-white px-4 text-sm font-black text-[#994737]"
      >
        Gỡ
      </button>
      <button
        type="button"
        onClick={onThoi}
        className="min-h-11 text-sm font-bold text-[#5d6f66] underline underline-offset-4"
      >
        Thôi
      </button>
    </form>
  );
}

function DongDoiTac({
  doiTac,
  bayGio,
  tenDip,
  onSua,
  onGo,
}: {
  doiTac: DoiTacNhanHang;
  bayGio: Date;
  tenDip: string;
  onSua: () => void;
  onGo: () => void;
}) {
  const nguoi = daNguoi(bayGio, doiTac);
  const mo = MO_TA_GIAI_DOAN[doiTac.giaiDoan];

  return (
    <li
      data-doi-tac={doiTac.id}
      data-nguoi={nguoi ? "co" : "khong"}
      className={`rounded-2xl border p-4 ${
        nguoi ? "border-[#d8b3a8] bg-[#fff8f3]" : "border-[#e3ebe6] bg-white"
      }`}
    >
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h4 className="text-base font-black text-[#3d3325]">{doiTac.ten}</h4>
        <span className="rounded-full bg-[#f0e6d0] px-2 py-0.5 text-xs font-bold text-[#7a6228]">
          {mo.ten}
        </span>
        <span
          className={`text-xs font-bold ${nguoi ? "text-[#994737]" : "text-[#5d6f66]"}`}
        >
          {loiImLang(bayGio, doiTac)}
        </span>
        {doiTac.nganhHang ? (
          <span className="text-xs text-[#8a8171]">{doiTac.nganhHang}</span>
        ) : null}
      </div>

      {nguoi ? (
        <p className="mt-2 text-sm font-bold leading-6 text-[#994737]">{mo.viecTiepTheo}</p>
      ) : null}

      <dl className="mt-2 grid gap-x-6 gap-y-1 text-sm text-[#4a5751] sm:grid-cols-2">
        {doiTac.nguoiBenHo ? (
          <div className="flex gap-2">
            <dt className="font-bold text-[#5d6f66]">Bên họ:</dt>
            <dd>{doiTac.nguoiBenHo}</dd>
          </div>
        ) : null}
        {doiTac.cachLienHe ? (
          <div className="flex gap-2">
            <dt className="font-bold text-[#5d6f66]">Liên hệ:</dt>
            <dd className="break-all">{doiTac.cachLienHe}</dd>
          </div>
        ) : null}
        {doiTac.nguoiPhuTrach ? (
          <div className="flex gap-2">
            <dt className="font-bold text-[#5d6f66]">Bên mình:</dt>
            <dd>{doiTac.nguoiPhuTrach}</dd>
          </div>
        ) : null}
        {tenDip ? (
          <div className="flex gap-2">
            <dt className="font-bold text-[#5d6f66]">Nhắm dịp:</dt>
            <dd>{tenDip}</dd>
          </div>
        ) : null}
      </dl>

      {doiTac.ghiChu ? (
        <p className="mt-2 text-sm leading-6 text-[#6b6250]">{doiTac.ghiChu}</p>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-4">
        <a
          href="#them-doi-tac"
          onClick={onSua}
          className="inline-flex min-h-11 items-center text-xs font-black text-[#6b5520] underline underline-offset-4"
        >
          Sửa dòng này
        </a>
        <button
          type="button"
          onClick={onGo}
          className="min-h-11 text-xs font-bold text-[#8a8171] underline underline-offset-4"
        >
          Gỡ khỏi sổ
        </button>
      </div>
    </li>
  );
}

export function SoDoiTacPanel({
  so,
  dip,
  bayGio,
  sanSang,
}: {
  so: readonly DoiTacNhanHang[];
  dip: readonly DipSapToi[];
  /** Đồng hồ máy chủ, truyền xuống để hai bên không đếm ngày lệch nhau. */
  bayGio: string;
  sanSang: boolean;
}) {
  const [dangSua, setDangSua] = useState<DoiTacNhanHang | null>(null);
  const [dangGo, setDangGo] = useState<DoiTacNhanHang | null>(null);
  const luc = new Date(bayGio);
  const xep = xepSoDoiTac(luc, so);
  const phaiLam = demViecPhaiLam(luc, so);
  const tenDip = new Map(dip.map((d) => [d.dip.id, d.dip.ten]));

  return (
    <section
      data-testid="so-doi-tac"
      data-so-dong={so.length}
      data-phai-lam={phaiLam}
      className="rounded-3xl border border-[#e0d6c4] bg-[#fdf8ef] p-5 sm:p-7"
    >
      <p className="text-xs font-black uppercase tracking-[0.18em] text-[#8a6b27]">
        Sổ liên hệ nhãn hàng đối tác
      </p>
      <h2 className="font-display mt-2 text-3xl text-[#3d3325] sm:text-4xl">
        {so.length === 0
          ? "Sổ còn trống"
          : phaiLam > 0
            ? `${phaiLam} mối đang chờ mình gọi lại`
            : "Không mối nào đang bị bỏ quên"}
      </h2>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-[#6b6250]">
        Sổ đếm số ngày kể từ lần gần nhất anh trao đổi với từng nhãn hàng. Mối nào
        lâu không liên lạc thì tự lên đầu để anh gọi lại. Mỗi dòng gắn được vào
        một dịp trong lịch mùa vụ ở trên.
      </p>

      {!sanSang ? (
        <p className="mt-4 rounded-2xl border border-[#d7c69c] bg-white p-4 text-sm leading-6 text-[#6b6250]">
          Sổ chưa đọc được ở môi trường này, nên màn hình để trống thay vì dựng
          số minh hoạ. Xin thử tải lại; nếu vẫn vậy, xin báo bộ phận kỹ thuật.
        </p>
      ) : null}

      {/* Lời hỏi gỡ tự đóng khi dòng ấy không còn trong sổ — suy ra ngay lúc
          dựng, không cần một hiệu ứng đặt lại trạng thái. */}
      <KhoiGo
        dangGo={dangGo && so.some((d) => d.id === dangGo.id) ? dangGo : null}
        onThoi={() => setDangGo(null)}
      />

      {xep.length > 0 ? (
        <ol className="mt-6 space-y-3">
          {xep.map((d) => (
            <DongDoiTac
              key={d.id}
              doiTac={d}
              bayGio={luc}
              tenDip={tenDip.get(d.dipNhamToi) ?? ""}
              onSua={() => setDangSua(d)}
              onGo={() => setDangGo(d)}
            />
          ))}
        </ol>
      ) : null}

      {sanSang ? (
        <OForm dip={dip} dangSua={dangSua} onThoiSua={() => setDangSua(null)} />
      ) : null}
    </section>
  );
}
