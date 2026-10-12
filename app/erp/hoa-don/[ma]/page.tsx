import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getErpSite } from "@/domain/erp";
import { formatVnd } from "@/domain/erp-counter-sale";
import { findCounterSale } from "@/lib/erp/counter-sale-repository";
import { accountCanAccessModule, getCurrentErpUser } from "@/lib/erp/demo-session";
import { NutInTrang } from "./nut-in-trang";

export const metadata: Metadata = { title: "Đề nghị xuất hoá đơn", robots: { index: false, follow: false } };

function ngay(iso: string) {
  const k = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return k ? `${k[3]}/${k[2]}/${k[1]}` : iso;
}

/**
 * Đề nghị xuất hoá đơn cho công ty lữ hành (12/10/2026, chủ dự án: "cho xuất
 * hoá đơn vé cho công ty"). Thanh toán và hoá đơn trong bản này đều là giả
 * lập: trang này là tờ đề nghị gửi kế toán, kế toán phát hành hoá đơn điện tử
 * thật. Khổ A4, in hay lưu PDF bằng hộp thoại in của trình duyệt.
 */
export default async function DeNghiHoaDonPage({
  params,
  searchParams,
}: {
  params: Promise<{ ma: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentErpUser();
  if (!user) redirect("/erp/login");
  const { ma } = await params;
  const q = await searchParams;
  const coSo = typeof q.coSo === "string" ? q.coSo : "";
  const ngayBan = typeof q.ngay === "string" && /^\d{4}-\d{2}-\d{2}$/.test(q.ngay) ? q.ngay : "";
  const site = getErpSite(coSo);
  if (!site || !ngayBan) notFound();
  if (!accountCanAccessModule(user, site.id, "ve-dat-cho")) redirect("/erp?denied=module");
  const phieu = await findCounterSale({
    siteId: site.id,
    viewerAccountId: user.id,
    businessDate: ngayBan,
    saleCode: decodeURIComponent(ma).toUpperCase(),
  }).catch(() => null);
  if (!phieu || phieu.saleKind !== "group" || !phieu.travelCompany) notFound();
  const cty = phieu.travelCompany;
  const tamTinh = phieu.totalVnd + phieu.discountVnd;

  return (
    <main className="min-h-screen bg-[#eef1ef] px-4 py-6 print:bg-white print:p-0">
      <div className="mx-auto mb-4 flex max-w-[210mm] justify-end gap-2 print:hidden">
        <NutInTrang />
      </div>
      <article
        className="mx-auto max-w-[210mm] bg-white p-6 text-[13px] leading-6 text-[#111] shadow-sm sm:p-12 print:max-w-none print:p-0 print:shadow-none"
        data-testid="de-nghi-hoa-don"
      >
        <header className="flex flex-col justify-between gap-4 border-b-2 border-[#111] pb-4 sm:flex-row">
          <div>
            <p className="font-black uppercase">Ninh Bình Journey · {site.name}</p>
            <p>Bộ phận bán vé tại quầy</p>
          </div>
          <div className="sm:text-right">
            <p>Số phiếu: <strong className="font-mono">{phieu.saleCode}</strong></p>
            <p>Ngày bán: {ngay(phieu.businessDate)}</p>
          </div>
        </header>

        <h1 className="mt-6 text-center text-xl font-black uppercase tracking-wide">Đề nghị xuất hoá đơn giá trị gia tăng</h1>
        <p className="text-center text-xs text-[#555]">Gửi bộ phận kế toán, để phát hành hoá đơn điện tử cho khách hàng là tổ chức</p>

        <section className="mt-6">
          <h2 className="font-black uppercase">Bên mua</h2>
          <dl className="mt-2 grid grid-cols-[9rem_1fr] gap-y-1">
            <dt>Tên đơn vị</dt>
            <dd className="font-bold">{cty.name}</dd>
            <dt>Mã số thuế</dt>
            <dd>{cty.taxCode ?? <em className="text-[#a33]">Chưa có, kế toán xin bổ sung trước khi phát hành</em>}</dd>
            <dt>Địa chỉ</dt>
            <dd>{cty.address || "—"}</dd>
            <dt>Email nhận hoá đơn</dt>
            <dd>{cty.invoiceEmail ?? "—"}</dd>
            <dt>Người đại diện đoàn</dt>
            <dd>
              {phieu.groupLeaderName}
              {phieu.groupLeaderPhone ? ` · ${phieu.groupLeaderPhone}` : ""}
            </dd>
            <dt>Mã đoàn</dt>
            <dd className="font-mono">{phieu.groupCode ?? "—"}</dd>
          </dl>
        </section>

        <table className="mt-6 w-full border-collapse text-left">
          <thead>
            <tr className="border-y border-[#111]">
              <th className="py-2 pr-2">Nội dung</th>
              <th className="py-2 pr-2 text-right">Số lượng</th>
              <th className="py-2 pr-2 text-right">Đơn giá</th>
              <th className="py-2 text-right">Thành tiền</th>
            </tr>
          </thead>
          <tbody>
            {phieu.lines.map((line) => (
              <tr key={line.ticketCode} className="border-b border-[#ccc]">
                <td className="py-2 pr-2">Vé tham quan {site.name}, vé đoàn</td>
                <td className="py-2 pr-2 text-right tabular-nums">{line.quantity}</td>
                <td className="py-2 pr-2 text-right tabular-nums">{formatVnd(line.unitPriceVnd)}</td>
                <td className="py-2 text-right tabular-nums">{formatVnd(line.lineTotalVnd)}</td>
              </tr>
            ))}
            {phieu.discountVnd > 0 ? (
              <tr className="border-b border-[#ccc]">
                <td className="py-2 pr-2" colSpan={3}>Chiết khấu thương mại theo ưu đãi công ty ({phieu.discountPercent}%)</td>
                <td className="py-2 text-right tabular-nums">−{formatVnd(phieu.discountVnd)}</td>
              </tr>
            ) : null}
          </tbody>
          <tfoot>
            {phieu.discountVnd > 0 ? (
              <tr>
                <td className="pt-2" colSpan={3}>Cộng tiền vé</td>
                <td className="pt-2 text-right tabular-nums">{formatVnd(tamTinh)}</td>
              </tr>
            ) : null}
            <tr className="text-base font-black">
              <td className="pt-2" colSpan={3}>Tổng tiền thanh toán</td>
              <td className="pt-2 text-right tabular-nums">{formatVnd(phieu.totalVnd)}</td>
            </tr>
          </tfoot>
        </table>

        <p className="mt-4">
          Hình thức thanh toán: {phieu.paymentMethod === "qr-transfer" ? `chuyển khoản QR${phieu.paymentReference ? `, nội dung ${phieu.paymentReference}` : ""}` : "tiền mặt tại quầy"}.
          Trạng thái phiếu: {phieu.status === "voided" ? <strong className="text-[#a33]">đã huỷ, không xuất hoá đơn</strong> : "đã thu đủ"}.
        </p>
        <p className="mt-2 text-xs text-[#555]">
          Thuế suất và số hoá đơn do kế toán xác định khi phát hành trên hệ thống hoá đơn điện tử. Tờ này là đề nghị nội bộ,
          không thay thế hoá đơn.
        </p>

        <footer className="mt-12 grid grid-cols-2 gap-6 text-center">
          <div>
            <p className="font-bold">Người lập</p>
            <p className="mt-16">{phieu.soldByName}</p>
          </div>
          <div>
            <p className="font-bold">Kế toán</p>
            <p className="mt-16 text-[#777]">(ký, ghi rõ họ tên)</p>
          </div>
        </footer>
      </article>
    </main>
  );
}
