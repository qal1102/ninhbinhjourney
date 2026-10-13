import Link from "next/link";
import { redirect } from "next/navigation";
import { ErpBackLink } from "@/components/erp/erp-back-link";
import { ErpShell } from "@/components/erp/erp-shell";
import { tomTatDoan, type DoanErp } from "@/domain/danh-sach-doan";
import { docDanhSachDoanErp } from "@/lib/erp/danh-sach-doan-repository";
import { getCurrentErpUser } from "@/lib/erp/demo-session";
import { ERP_OVERVIEW_BACK_TARGET } from "@/lib/erp/erp-back-link";

export const metadata = { title: "Đoàn" };

const KY = {
  "sap-toi": { ten: "Hôm nay và sắp tới", tu: 0, den: 30 },
  "hom-nay": { ten: "Hôm nay", tu: 0, den: 0 },
  "da-qua": { ten: "30 ngày qua", tu: -30, den: -1 },
} as const;
type Ky = keyof typeof KY;

function ngayCong(goc: string, so: number) {
  const d = new Date(`${goc}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + so);
  return d.toISOString().slice(0, 10);
}
function ngayDoc(iso: string, homNay: string) {
  if (iso === homNay) return "Hôm nay";
  if (iso === ngayCong(homNay, 1)) return "Ngày mai";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function TheDoan({ d, homNay }: { d: DoanErp; homNay: string }) {
  const phanQua = d.soNguoi ? Math.min(100, Math.round((d.quaCong / d.soNguoi) * 100)) : 0;
  const maTra = d.orderCode ?? d.ve[0] ?? d.saleCode;
  return (
    <li className={`rounded-2xl border bg-white p-4 shadow-sm sm:p-5 ${d.daHuy ? "border-[#ecd0c4] opacity-70" : "border-[#d8e0db]"}`} data-ma-doan={d.groupCode}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[#7a8a82]">
            {ngayDoc(d.ngayDi, homNay)} · {d.diem.join(", ") || "Chưa có vé"}
          </p>
          <h2 className="mt-1 text-lg font-black leading-6 text-[#203a30]">{d.nhan || `Đoàn của ${d.truongDoan}`}</h2>
          <p className="mt-0.5 text-sm text-[#5f6f67]">
            Trưởng đoàn {d.truongDoan}
            {d.soTruongDoan ? ` · ${d.soTruongDoan}` : ""}
            {d.congTy ? ` · ${d.congTy}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <span className={`rounded-full px-2.5 py-1 text-xs font-black ${d.nguon === "web" ? "bg-[#e6eefb] text-[#284a7a]" : "bg-[#fff1d6] text-[#7a5310]"}`}>
            {d.nguon === "web" ? "Đặt trên web" : "Bán ở quầy"}
          </span>
          {d.daHuy ? <span className="rounded-full bg-[#fbe6df] px-2.5 py-1 text-xs font-black text-[#8a3a12]">Phiếu đã huỷ</span> : null}
        </div>
      </div>

      <div className="mt-3">
        <div className="flex items-baseline justify-between text-sm">
          <span className="font-black text-[#203a30] tabular-nums">
            {d.quaCong}/{d.soNguoi} người đã qua cổng
          </span>
          <span className="text-xs text-[#6b7a73]">{d.soNguoi - d.quaCong > 0 ? `còn ${d.soNguoi - d.quaCong}` : "đủ cả đoàn"}</span>
        </div>
        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[#e7ece9]" aria-hidden>
          <div className="h-full rounded-full bg-[#2f7a5f]" style={{ width: `${phanQua}%` }} />
        </div>
      </div>

      <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-[#f3f6f4] px-2 py-2">
          <dt className="text-[11px] text-[#6b7a73]">Đã ghi tên</dt>
          <dd className="font-black tabular-nums">{d.ghiTen}/{d.soNguoi}</dd>
        </div>
        <div className="rounded-xl bg-[#f3f6f4] px-2 py-2">
          <dt className="text-[11px] text-[#6b7a73]">Mở mã riêng</dt>
          <dd className="font-black tabular-nums">{d.moMa}</dd>
        </div>
        <div className={`rounded-xl px-2 py-2 ${d.chamSoc > 0 ? "bg-[#fff1d6]" : "bg-[#f3f6f4]"}`}>
          <dt className="text-[11px] text-[#6b7a73]">Cần chăm sóc</dt>
          <dd className="font-black tabular-nums">{d.chamSoc}</dd>
        </div>
      </dl>

      <p className="mt-3 text-xs leading-5 text-[#5f6f67]">
        <span className="font-mono">{d.groupCode}</span>
        {d.orderCode ? <> · đơn <span className="font-mono">{d.orderCode}</span></> : null}
        {d.saleCode ? <> · phiếu <span className="font-mono">{d.saleCode}</span></> : null}
        {d.tienVnd !== null ? ` · ${d.tienVnd.toLocaleString("vi-VN")} đ` : ""}
        {d.giamPhanTram ? ` (ưu đãi ${d.giamPhanTram}%)` : ""}
        {d.hoaDon ? " · xuất hoá đơn công ty" : ""}
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <a
          href={`/doan/truong/${encodeURIComponent(d.groupCode)}`}
          target="_blank"
          rel="noopener"
          className="inline-flex min-h-10 items-center rounded-xl bg-[#183f34] px-4 text-sm font-black text-white"
        >
          Xem như trưởng đoàn ↗
        </a>
        {maTra ? (
          <Link
            href={`/erp/khach-hang?tra=${encodeURIComponent(maTra)}#tra-khach`}
            className="inline-flex min-h-10 items-center rounded-xl border border-[#c9d6cf] px-4 text-sm font-black text-[#183f34]"
          >
            Vé và lượt qua cổng
          </Link>
        ) : null}
      </div>
    </li>
  );
}

/**
 * Đoàn (13/10/2026, migration 131). Mọi đoàn, đặt trên web hay bán ở quầy, cùng
 * một danh sách với cùng những con số trang trưởng đoàn đang thấy.
 */
export default async function ErpDoanPage({ searchParams }: { searchParams: Promise<{ ky?: string }> }) {
  const user = await getCurrentErpUser();
  if (!user) redirect("/erp/login");
  if (user.mustChangePassword) redirect("/erp/doi-mat-khau");
  if (user.role !== "director" && user.role !== "manager") redirect("/erp?denied=doan");

  const { ky: kyNhap } = await searchParams;
  const ky: Ky = kyNhap && kyNhap in KY ? (kyNhap as Ky) : "sap-toi";
  const homNay = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Ho_Chi_Minh" });
  let ds: DoanErp[] | null = null;
  let loi = "";
  try {
    ds = await docDanhSachDoanErp({ actorAccountId: user.id, tu: ngayCong(homNay, KY[ky].tu), den: ngayCong(homNay, KY[ky].den) });
  } catch (error) {
    loi = error instanceof Error ? error.message : "Chưa đọc được danh sách đoàn.";
  }
  const tt = ds ? tomTatDoan(ds) : null;

  return (
    <ErpShell user={user}>
      <ErpBackLink href={ERP_OVERVIEW_BACK_TARGET.href} label={ERP_OVERVIEW_BACK_TARGET.label} />
      <div className="mb-5">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-[#668078]">Vé đoàn · web và quầy</p>
        <h1 className="font-display mt-1 text-4xl leading-tight text-[#183f34] sm:text-5xl">Đoàn</h1>
        <p className="mt-3 max-w-3xl text-base leading-7 text-[#68776f]">
          Đoàn đặt trên web (trưởng đoàn tạo mã sau khi đặt) và đoàn mua ở quầy nằm chung một danh sách. Số người qua cổng, ai đã ghi tên, ai cần chăm sóc là đúng những gì trưởng đoàn thấy trên điện thoại.
        </p>
      </div>

      <nav aria-label="Chọn khoảng ngày" className="mb-4 flex flex-wrap gap-2">
        {(Object.keys(KY) as Ky[]).map((k) => (
          <Link
            key={k}
            href={`/erp/doan?ky=${k}`}
            aria-current={k === ky ? "page" : undefined}
            className={`inline-flex min-h-10 items-center rounded-full px-4 text-sm font-black ${k === ky ? "bg-[#183f34] text-white" : "border border-[#ccd8d1] bg-white text-[#42574e]"}`}
          >
            {KY[k].ten}
          </Link>
        ))}
      </nav>

      {loi ? <p role="alert" className="rounded-2xl bg-[#fdf0ea] p-4 text-sm font-bold text-[#8a3b22]">{loi}</p> : null}
      {!loi && ds === null ? <p className="rounded-2xl bg-white p-5 text-sm text-[#68776f]">Bản này chưa nối kho dữ liệu nên chưa có danh sách đoàn.</p> : null}

      {tt ? (
        <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4" data-testid="tom-tat-doan" data-chi="tom-tat-doan" data-chi-loi="Đoàn web và đoàn quầy cộng chung; bên dưới là từng đoàn.">
          <div className="rounded-2xl bg-white p-4 shadow-sm"><p className="text-xs text-[#6b7a73]">Số đoàn</p><p className="mt-1 text-2xl font-black tabular-nums">{tt.soDoan}</p></div>
          <div className="rounded-2xl bg-white p-4 shadow-sm"><p className="text-xs text-[#6b7a73]">Số người</p><p className="mt-1 text-2xl font-black tabular-nums">{tt.soNguoi}</p></div>
          <div className="rounded-2xl bg-white p-4 shadow-sm"><p className="text-xs text-[#6b7a73]">Đã qua cổng</p><p className="mt-1 text-2xl font-black tabular-nums">{tt.quaCong}</p></div>
          <div className="rounded-2xl bg-white p-4 shadow-sm"><p className="text-xs text-[#6b7a73]">Web · quầy</p><p className="mt-1 text-2xl font-black tabular-nums">{tt.tuWeb} · {tt.tuQuay}</p></div>
        </div>
      ) : null}

      {ds && ds.length === 0 ? (
        <p className="rounded-2xl bg-white p-5 text-sm leading-6 text-[#68776f]">
          Chưa có đoàn nào trong khoảng này. Đoàn mua ở quầy lập ở ô Vé đoàn của màn Vé; đoàn web hiện ở đây ngay khi trưởng đoàn bấm &quot;Tạo mã cho cả đoàn&quot; sau khi đặt.
        </p>
      ) : null}
      {ds && ds.length > 0 ? (
        <ul className="grid gap-3 lg:grid-cols-2" data-testid="danh-sach-doan">
          {ds.map((d) => <TheDoan key={d.groupCode} d={d} homNay={homNay} />)}
        </ul>
      ) : null}
    </ErpShell>
  );
}
