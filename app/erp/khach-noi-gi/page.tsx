import { redirect } from "next/navigation";
import { ErpBackLink } from "@/components/erp/erp-back-link";
import { ErpShell } from "@/components/erp/erp-shell";
import { KhachNoiGiWorkspace } from "@/components/erp/khach-noi-gi-workspace";
import { ERP_SITES } from "@/domain/erp";
import { docDanhGiaNgoai } from "@/lib/erp/danh-gia-ngoai-repository";
import { getCurrentErpUser } from "@/lib/erp/demo-session";
import { ERP_OVERVIEW_BACK_TARGET } from "@/lib/erp/erp-back-link";

export const metadata = { title: "Khách nói gì trên mạng" };

export default async function KhachNoiGiPage() {
  const user = await getCurrentErpUser();
  if (!user) redirect("/erp/login");
  if (user.mustChangePassword) redirect("/erp/doi-mat-khau");
  if (user.role !== "director") redirect("/erp?denied=khach-noi-gi");

  const ketQua = await docDanhGiaNgoai();
  const coSo = ERP_SITES.map((site) => ({ id: site.id, ten: site.shortName }));

  return (
    <ErpShell user={user}>
      <ErpBackLink href={ERP_OVERVIEW_BACK_TARGET.href} label={ERP_OVERVIEW_BACK_TARGET.label} />
      <header className="mb-6">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-[#668078]">Khách và marketing</p>
        <h1 className="font-display mt-1 text-4xl leading-tight text-[#183f34] sm:text-6xl">Khách nói gì trên mạng</h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-[#68776f]">
          Đánh giá mới trên Google Maps và Tripadvisor của bốn cơ sở, chia khen chê theo chủ đề. Lời tiếng nước ngoài có bản dịch.
        </p>
      </header>

      {ketQua.trangThai === "co" ? (
        <KhachNoiGiWorkspace duLieu={ketQua.duLieu} coSo={coSo} bayGio={new Date().toISOString()} />
      ) : (
        <section
          data-chi="khach-noi-gi"
          className="rounded-2xl border border-[#dbe2de] bg-white p-6 text-[#43554e] shadow-sm"
        >
          <h2 className="text-lg font-black text-[#1f2f2a]">
            {ketQua.trangThai === "chua-co" ? "Chưa có lượt lấy đầu tiên" : "Chưa đọc được dữ liệu"}
          </h2>
          <p className="mt-2 max-w-2xl leading-7">
            {ketQua.trangThai === "chua-co"
              ? "Lịch lấy đánh giá chạy lúc 7 giờ và 19 giờ mỗi ngày. Sau lượt đầu, đánh giá sẽ hiện ở đây."
              : "Nguồn dữ liệu đang không trả lời. Mở lại sau ít phút."}
          </p>
        </section>
      )}
    </ErpShell>
  );
}
