import QRCode from "qrcode";
import { redirect } from "next/navigation";
import { DaiLyWorkspace } from "@/components/erp/dai-ly-workspace";
import { ErpBackLink } from "@/components/erp/erp-back-link";
import { ErpShell } from "@/components/erp/erp-shell";
import { chonThang, congThang, thangHienTai } from "@/domain/dai-ly";
import { docBangDaiLy } from "@/lib/dai-ly-repository";
import { getCurrentErpUser } from "@/lib/erp/demo-session";
import { ERP_OVERVIEW_BACK_TARGET } from "@/lib/erp/erp-back-link";
import { absoluteUrl } from "@/lib/site-url";

export default async function ErpDaiLyPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentErpUser();
  if (!user) redirect("/erp/login");
  if (user.mustChangePassword) redirect("/erp/doi-mat-khau");
  if (user.role !== "director" && user.role !== "chief-accountant" && user.role !== "accountant") {
    redirect("/erp?denied=dai-ly");
  }
  const bayGio = new Date();
  const thang = chonThang((await searchParams)?.thang, bayGio);
  const hienTai = thangHienTai(bayGio);
  const bang = await docBangDaiLy(thang);
  const maQr =
    bang.trangThai === "co"
      ? Object.fromEntries(
          await Promise.all(
            bang.dong.map(async (d) => [
              d.id,
              await QRCode.toString(absoluteUrl(`/dl/${d.ma}`), { type: "svg", margin: 1, color: { dark: "#183f34", light: "#ffffff" } }).catch(
                () => "",
              ),
            ]),
          ),
        )
      : {};

  return (
    <ErpShell user={user}>
      <ErpBackLink href={ERP_OVERVIEW_BACK_TARGET.href} label={ERP_OVERVIEW_BACK_TARGET.label} />
      <div className="mb-6">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-[#668078]">Kênh bán · đại lý</p>
        <h1 className="font-display mt-1 text-4xl leading-tight text-[#183f34] sm:text-6xl">Đại lý & hoa hồng</h1>
        <p className="mt-3 max-w-3xl text-base leading-7 text-[#68776f]">
          Mỗi đại lý có một đường dẫn riêng. Khách mở đường dẫn ấy rồi đặt vé trên web thì đơn được ghi cho đại lý. Hoa hồng chỉ tính
          trên đơn đã trả mà khách đã qua cổng, theo tháng của ngày đi; tháng khép thì kế toán ghi đã chi.
        </p>
      </div>
      {bang.trangThai === "co" ? (
        <DaiLyWorkspace
          dong={bang.dong}
          thang={thang}
          thangHienTai={hienTai}
          cacThang={Array.from({ length: 6 }, (_, i) => congThang(hienTai, -i))}
          maQr={maQr}
          duongGoc={absoluteUrl("/")}
          laGiamDoc={user.role === "director"}
          duocGhiChi={user.role === "director" || user.role === "accountant"}
        />
      ) : (
        <p role="status" data-testid="dai-ly-chua-co" className="rounded-2xl border border-[#e3e8e5] bg-white p-5 text-sm text-[#59654b]">
          {bang.trangThai === "loi" ? bang.loiNhan : "Sổ đại lý chưa nối kho dữ liệu ở bản chạy này."}
        </p>
      )}
    </ErpShell>
  );
}
