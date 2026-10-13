import QRCode from "qrcode";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ErpBackLink } from "@/components/erp/erp-back-link";
import { ErpShell } from "@/components/erp/erp-shell";
import { NutInTrang } from "@/components/erp/nut-in-trang";
import { duongDanDau, SO_DAU } from "@/domain/so-dau";
import { getCurrentErpUser } from "@/lib/erp/demo-session";
import { ERP_OVERVIEW_BACK_TARGET } from "@/lib/erp/erp-back-link";
import { absoluteUrl } from "@/lib/site-url";

/**
 * In mã QR đóng dấu (13/10/2026): mỗi điểm một tấm, dán ở cổng hay quầy đón
 * khách. Khách quét là dấu vào sổ trên điện thoại, không cần đăng nhập.
 */
export default async function ErpSoDauPage() {
  const user = await getCurrentErpUser();
  if (!user) redirect("/erp/login");
  if (user.mustChangePassword) redirect("/erp/doi-mat-khau");
  if (user.role !== "director" && user.role !== "manager") redirect("/erp?denied=so-dau");

  const goc = absoluteUrl("/");
  const tam = await Promise.all(
    SO_DAU.flatMap((dau) => {
      const url = duongDanDau(goc, dau);
      return url ? [{ dau, url }] : [];
    }).map(async ({ dau, url }) => ({
      dau,
      url,
      svg: await QRCode.toString(url, { type: "svg", margin: 1, color: { dark: "#183f34", light: "#ffffff" } }).catch(() => ""),
    })),
  );

  return (
    <ErpShell user={user}>
      <div className="print:hidden">
        <ErpBackLink href={ERP_OVERVIEW_BACK_TARGET.href} label={ERP_OVERVIEW_BACK_TARGET.label} />
        <p className="text-xs font-black uppercase tracking-[0.16em] text-[#668078]">Kéo khách sang điểm khác · không thu dữ liệu</p>
        <h1 className="font-display mt-1 text-4xl leading-tight text-[#183f34] sm:text-5xl">Mã QR đóng dấu</h1>
        <p className="mt-3 max-w-3xl text-base leading-7 text-[#68776f]">
          In mỗi tấm, dán ở cổng hay quầy đón khách của điểm ấy. Khách quét bằng camera là được một dấu vào sổ trên điện thoại, kể cả ở Cố đô Hoa Lư
          không bán vé. Điểm nào còn thiếu dấu, trang mời khách mua vé điểm đó. Không cần đăng nhập, không lưu gì về khách; dấu chỉ để lưu niệm, quà
          vẫn tính theo lượt qua cổng.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <NutInTrang nhan="In các tấm dán" />
          <Link href="/so-dau" className="inline-flex min-h-11 items-center rounded-xl border border-[#c9d6cf] px-4 text-sm font-black text-[#183f34]">
            Xem sổ dấu như khách
          </Link>
          <Link href="/loi-hua" className="inline-flex min-h-11 items-center rounded-xl border border-[#c9d6cf] px-4 text-sm font-black text-[#183f34]">
            Trang lời hứa Tràng An
          </Link>
        </div>
      </div>
      <ul className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3 print:mt-0 print:grid-cols-2" data-testid="tam-dan-dau" data-chi="tam-dan-dau" data-chi-loi="Mỗi tấm là mã QR đóng dấu của một điểm; bấm In các tấm dán.">
        {tam.map(({ dau, url, svg }) => (
          <li key={dau.ma} className="break-inside-avoid rounded-2xl border border-[#d8e0db] bg-white p-5 text-center">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#9a6328]">Sổ dấu Ninh Bình</p>
            <p className="font-display mt-1 text-2xl text-[#183f34]">{dau.ten.vi}</p>
            <div className="mx-auto mt-3 w-44" dangerouslySetInnerHTML={{ __html: svg }} />
            <p className="mt-3 text-sm font-bold text-[#27362f]">Quét bằng camera để đóng dấu</p>
            <p className="text-xs text-[#5f6f67]">Scan to stamp your book · không cần đăng nhập</p>
            <p className="mt-2 break-all text-[10px] text-[#8a978f] print:hidden">{url}</p>
          </li>
        ))}
      </ul>
    </ErpShell>
  );
}
