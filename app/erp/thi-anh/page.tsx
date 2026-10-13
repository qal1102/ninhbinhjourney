import Link from "next/link";
import { redirect } from "next/navigation";
import { ErpBackLink } from "@/components/erp/erp-back-link";
import { ErpShell } from "@/components/erp/erp-shell";
import { ThiAnhWorkspace } from "@/components/erp/thi-anh-workspace";
import { GIAI_THI_ANH, thangTruoc, thangVN, tongGiaTriGiai } from "@/domain/thi-anh";
import { anhChoGiamDoc } from "@/lib/customer-data/thi-anh-repository";
import { getCurrentErpUser } from "@/lib/erp/demo-session";
import { ERP_OVERVIEW_BACK_TARGET } from "@/lib/erp/erp-back-link";

/** Duyệt ảnh dự thi và chấm giải tháng (13/10/2026, migration 127). */
export default async function ErpThiAnhPage({ searchParams }: { searchParams: Promise<{ thang?: string }> }) {
  const user = await getCurrentErpUser();
  if (!user) redirect("/erp/login");
  if (user.mustChangePassword) redirect("/erp/doi-mat-khau");
  if (user.role !== "director") redirect("/erp?denied=thi-anh");
  const xin = (await searchParams).thang;
  const thang = xin && /^\d{4}-(0[1-9]|1[0-2])$/.test(xin) ? xin : thangVN();
  const anh = await anhChoGiamDoc(thang);
  const cho = anh?.filter((a) => a.trangThai === "cho-duyet").length ?? 0;
  return (
    <ErpShell user={user}>
      <ErpBackLink href={ERP_OVERVIEW_BACK_TARGET.href} label={ERP_OVERVIEW_BACK_TARGET.label} />
      <div className="mb-6">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-[#668078]">Ảnh đẹp Ninh Bình · tháng {thang.slice(5)}/{thang.slice(0, 4)}</p>
        <h1 className="font-display mt-1 text-4xl leading-tight text-[#183f34] sm:text-5xl">Duyệt ảnh và chấm giải</h1>
        <p className="mt-3 max-w-3xl text-base leading-7 text-[#68776f]">
          Ảnh chỉ hiện ở trang khách sau khi duyệt. Mỗi tháng {GIAI_THI_ANH.map((g) => `${g.soLuong} ${g.ten.vi.toLowerCase()}`).join(", ")}, tổng {tongGiaTriGiai().toLocaleString("vi-VN")} đ bằng vé.
          Người trúng mang mã nhận giải tới quầy; quầy cấp vé mời ghi lý do &quot;Giải thi ảnh&quot;.
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          <span className="rounded-full bg-[#fff1d6] px-3 py-1 font-black text-[#7a5310]">{cho} ảnh chờ duyệt</span>
          <Link href={`/erp/thi-anh?thang=${thangTruoc(thang)}`} className="rounded-full border border-[#c9d6cf] px-3 py-1 font-black text-[#183f34]">← Tháng trước</Link>
          <Link href="/thi-anh" className="rounded-full border border-[#c9d6cf] px-3 py-1 font-black text-[#183f34]">Trang khách</Link>
        </div>
      </div>
      {anh ? <ThiAnhWorkspace anh={anh} /> : <p className="rounded-2xl bg-white p-5 text-sm text-[#68776f]">Chưa đọc được kho ảnh. Thử tải lại sau ít phút.</p>}
    </ErpShell>
  );
}
