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
import { cacKhoangPhieu, chonKhoangPhieu, type CustomerFunnelReport } from "@/domain/customer-funnel";
import { goiYTen, LichMuaVuPanel } from "@/components/erp/lich-mua-vu-panel";
import { SoDoiTacPanel } from "@/components/erp/so-doi-tac-panel";
import { CAC_DIP, lichMuaVu } from "@/domain/lich-mua-vu";
import { docSoDoiTac, soDoiTacSanSang } from "@/lib/erp/doi-tac-repository";

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
  // không theo đồng hồ máy người đang mở màn hình. Sổ đối tác đếm ngày im
  // lặng theo đúng cái đồng hồ ấy, nên cả hai cùng lấy một mốc thời gian.
  const bayGio = new Date();
  const lich = lichMuaVu(bayGio);
  // Bấm một dịp thì quay lại chính trang này kèm mã dịp, và ô tạo chiến dịch
  // mở ra với tên đã điền sẵn. Không cần trạng thái phía máy khách, cũng
  // không cần thêm bảng nào.
  const params = (await searchParams) ?? {};
  const maDip = Array.isArray(params.dip) ? params.dip[0] : params.dip;
  const dipChon = maDip ? CAC_DIP.find((d) => d.id === maDip) : undefined;
  const dipTrongLich = dipChon ? lich.find((d) => d.dip.id === dipChon.id) : undefined;
  const goiYTenChienDich = dipTrongLich ? goiYTen(dipTrongLich) : "";
  // Khoảng của phễu cũng đi qua đường dẫn (`?ky=`), cùng một đồng hồ máy chủ.
  const maKy = Array.isArray(params.ky) ? params.ky[0] : params.ky;
  const khoangPhieu = chonKhoangPhieu(maKy, bayGio);

  // Sổ đối tác đọc hỏng thì mất đúng khối ấy, không kéo sập cả màn hình.
  const soDoiTac = await docSoDoiTac();
  const soSanSang = soDoiTacSanSang();

  let config = null;
  let funnel: CustomerFunnelReport | null = null;
  const phieuBat = isCustomerFunnelDashboardEnabled();
  try {
    config = await listMarketingQrConfig();
  } catch (error) {
    console.error("Marketing QR configuration read failed", error);
  }
  if (phieuBat) {
    try {
      funnel = await getCustomerFunnelReport(khoangPhieu, khoangPhieu.soSanh);
    } catch (error) {
      console.error("Customer funnel read failed", error);
    }
  }

  return (
    <ErpShell user={user}>
      <ErpBackLink href={ERP_OVERVIEW_BACK_TARGET.href} label={ERP_OVERVIEW_BACK_TARGET.label} />
      <header className="mb-6">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-[#668078]">Marketing · toàn vùng</p>
        <h1 className="font-display mt-1 text-4xl leading-tight text-[#183f34] sm:text-6xl">Kênh khách</h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-[#68776f]">
          Dịp nào sắp tới thì chuẩn bị chiến dịch, đối tác nào cần gọi lại, mã QR dẫn khách về đâu, và khách đi tới bước nào trước khi đặt vé.
        </p>
        <nav aria-label="Các phần" className="mt-4 flex flex-wrap gap-2">
          {[
            ["#lich-mua-vu", "Lịch mùa vụ"],
            ["#so-doi-tac", "Sổ đối tác"],
            ["#ma-qr", "Mã QR & chiến dịch"],
            ["#phieu-khach", "Phễu khách"],
          ].map(([href, nhan]) => (
            <a key={href} href={href} className="inline-flex min-h-10 items-center rounded-full border border-[#cbd7d1] bg-white px-4 text-sm font-bold text-[#183f34] hover:border-[#183f34]">
              {nhan}
            </a>
          ))}
        </nav>
      </header>
      <div className="space-y-6">
        <LichMuaVuPanel lich={lich} />
        <SoDoiTacPanel
          so={soDoiTac ?? []}
          dip={lich}
          bayGio={bayGio.toISOString()}
          sanSang={soSanSang && soDoiTac !== null}
        />
        {config ? (
          <MarketingQrControlCenter
            config={config}
            goiYTenChienDich={goiYTenChienDich}
            dip={lich.map((d) => ({ id: d.dip.id, ten: d.dip.ten }))}
            dipChon={dipChon?.id ?? ""}
          />
        ) : (
        <section className="rounded-3xl border border-[#e0d6c4] bg-[#fdf8ef] p-6 sm:p-8">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#8a6b27]">Kênh khách · mã QR đổi được đích</p>
          <h2 className="font-display mt-3 text-4xl text-[#3d3325] sm:text-5xl">Kho QR chưa sẵn sàng ở môi trường này</h2>
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
        {funnel ? (
          <CustomerFunnelDashboard report={funnel} khoang={khoangPhieu} luaChon={cacKhoangPhieu(bayGio)} />
        ) : phieuBat ? (
          <section className="rounded-3xl border border-[#d8e0db] bg-white p-5 sm:p-7" data-testid="customer-funnel-unavailable" id="phieu-khach">
            <h2 className="text-2xl font-black text-[#203a30]">Phễu khách chưa đọc được</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#66756e]">Kho chưa trả được số phễu, nên màn hình để trống thay vì hiện số thiếu. Xin thử tải lại; nếu vẫn vậy, xin báo bộ phận kỹ thuật.</p>
          </section>
        ) : null}
      </div>
    </ErpShell>
  );
}
