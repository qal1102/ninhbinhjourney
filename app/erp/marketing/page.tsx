import Link from "next/link";
import { redirect } from "next/navigation";
import { MarketingQrControlCenter } from "@/components/erp/marketing-qr-control-center";
import { ErpBackLink } from "@/components/erp/erp-back-link";
import { ErpShell } from "@/components/erp/erp-shell";
import { listMarketingQrConfig } from "@/lib/customer-data/marketing-qr-repository";
import { getCurrentErpUser } from "@/lib/erp/demo-session";
import { ERP_OVERVIEW_BACK_TARGET } from "@/lib/erp/erp-back-link";
import { CustomerFunnelDashboard } from "@/components/customer-data/customer-funnel-dashboard";
import { getCustomerFunnelReport, isCustomerFunnelDashboardEnabled } from "@/lib/customer-data/funnel-repository";
import type { CustomerFunnelReport } from "@/domain/customer-funnel";
import { goiYTen, LichMuaVuPanel } from "@/components/erp/lich-mua-vu-panel";
import { CAC_DIP, lichMuaVu } from "@/domain/lich-mua-vu";

export default async function ErpMarketingPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentErpUser();
  if (!user) redirect("/erp/login");
  if (user.mustChangePassword) redirect("/erp/doi-mat-khau");
  if (user.role !== "director") redirect("/erp?denied=marketing");

  // Lịch mùa vụ tính ở máy chủ: ngày âm lịch phải theo đồng hồ của hệ thống,
  // không theo đồng hồ máy người đang mở màn hình.
  const lich = lichMuaVu(new Date());
  // Bấm một dịp thì quay lại chính trang này kèm mã dịp, và ô tạo chiến dịch
  // mở ra với tên đã điền sẵn. Không cần trạng thái phía máy khách, cũng
  // không cần thêm bảng nào.
  const params = (await searchParams) ?? {};
  const maDip = Array.isArray(params.dip) ? params.dip[0] : params.dip;
  const dipChon = maDip ? CAC_DIP.find((d) => d.id === maDip) : undefined;
  const dipTrongLich = dipChon ? lich.find((d) => d.dip.id === dipChon.id) : undefined;
  const goiYTenChienDich = dipTrongLich ? goiYTen(dipTrongLich) : "";

  let config = null;
  let funnel: CustomerFunnelReport | null = null;
  try {
    config = await listMarketingQrConfig();
  } catch (error) {
    console.error("Marketing QR configuration read failed", error);
  }
  if (isCustomerFunnelDashboardEnabled()) {
    try {
      funnel = await getCustomerFunnelReport();
    } catch (error) {
      console.error("Customer funnel read failed", error);
    }
  }

  return (
    <ErpShell user={user}>
      <ErpBackLink href={ERP_OVERVIEW_BACK_TARGET.href} label={ERP_OVERVIEW_BACK_TARGET.label} />
      <div className="space-y-6">
        <LichMuaVuPanel lich={lich} />
        {config ? (
          <MarketingQrControlCenter config={config} goiYTenChienDich={goiYTenChienDich} />
        ) : (
        <section className="rounded-3xl border border-[#e0d6c4] bg-[#fdf8ef] p-6 sm:p-8">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#8a6b27]">Kênh khách · mã QR đổi được đích</p>
          <h1 className="font-display mt-3 text-4xl text-[#3d3325] sm:text-5xl">Kho QR chưa sẵn sàng ở môi trường này</h1>
          {/* Câu cũ bảo giám đốc "kiểm tra migration CUS-04 và cấu hình
              server" — mã việc nội bộ, và là việc của bộ phận kỹ thuật chứ
              không phải của người mở màn hình này. */}
          <p className="mt-4 max-w-3xl text-sm leading-6 text-[#6b6250]">Kho mã QR chưa đọc được, nên màn hình để trống thay vì dựng số minh hoạ. Xin thử tải lại; nếu vẫn vậy, xin báo bộ phận kỹ thuật.</p>
          <Link
            href="/erp/marketing"
            prefetch={false}
            className="mt-5 inline-flex min-h-11 items-center rounded-xl border border-[#d7c69c] bg-white px-4 text-sm font-black text-[#6b5520] transition hover:border-[#b79b56] hover:bg-[#fffaf0]"
          >
            Tải lại màn hình kênh khách
          </Link>
        </section>
        )}
        {funnel ? <CustomerFunnelDashboard report={funnel} /> : null}
      </div>
    </ErpShell>
  );
}
