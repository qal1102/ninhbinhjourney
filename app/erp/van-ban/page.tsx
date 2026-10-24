import { redirect } from "next/navigation";
import { ErpBackLink } from "@/components/erp/erp-back-link";
import { ErpShell } from "@/components/erp/erp-shell";
import { VanBanWorkspace, type NguoiCheoChon } from "@/components/erp/van-ban-workspace";
import { LOAI_VAN_BAN, vaiPhatHanhDuoc } from "@/domain/van-ban";
import { coMoHinhAi } from "@/lib/ai/goi-mo-hinh";
import { getCurrentErpUser } from "@/lib/erp/demo-session";
import { ERP_OVERVIEW_BACK_TARGET } from "@/lib/erp/erp-back-link";
import { soNguoiCheo } from "@/lib/erp/thuyen-repository";
import { danhSachVanBan, layPhatHanh, luuTruVanBan, type DanhSachVanBan } from "@/lib/van-ban/van-ban-repository";

/**
 * Văn bản & hợp đồng (24/10/2026): tải mẫu PDF đã ký và mã hoá, nộp lại qua
 * cổng (chữ ký, dấu băm, luật, đối chiếu dữ liệu, AI soát nghĩa), kho văn bản
 * đã nhận. Mọi vai vào được để nộp; phát hành và nhận theo vai (`domain/van-ban.ts`).
 * `?ma=VB-xxxxxx` là đường dẫn trong mã QR in trên tệp.
 */
export default async function VanBanPage({ searchParams }: { searchParams: Promise<{ ma?: string }> }) {
  const user = await getCurrentErpUser();
  if (!user) redirect("/erp/login");
  if (user.mustChangePassword) redirect("/erp/doi-mat-khau");
  const { ma } = await searchParams;

  const loiDoc: string[] = [];
  const [ds, taNguoi, tcNguoi, traMa] = await Promise.all([
    danhSachVanBan().catch((error: unknown): DanhSachVanBan => {
      loiDoc.push(error instanceof Error ? error.message : "Chưa đọc được kho văn bản.");
      return { nop: [], soPhatHanh: 0, phatHanhGan: [] };
    }),
    soNguoiCheo("trang-an").catch(() => []),
    soNguoiCheo("tam-coc").catch(() => []),
    ma && /^VB-[A-Z0-9]{6}$/.test(ma) ? layPhatHanh(ma).catch(() => null) : Promise.resolve(null),
  ]);
  const nguoiCheo: NguoiCheoChon[] = [
    ...taNguoi.map((n) => ({ coSo: "trang-an" as const, soThuyen: n.soThuyen, hoTen: n.hoTen })),
    ...tcNguoi.map((n) => ({ coSo: "tam-coc" as const, soThuyen: n.soThuyen, hoTen: n.hoTen })),
  ];

  return (
    <ErpShell user={user}>
      <ErpBackLink href={ERP_OVERVIEW_BACK_TARGET.href} label={ERP_OVERVIEW_BACK_TARGET.label} />
      <VanBanWorkspace
        ds={ds}
        nguoiCheo={nguoiCheo}
        coAi={coMoHinhAi()}
        vai={user.role}
        coSoCuaToi={user.role === "director" ? ["trang-an", "tam-coc", "bai-dinh", "tam-chuc"] : user.siteIds}
        loaiPhatHanhDuoc={LOAI_VAN_BAN.filter((l) => vaiPhatHanhDuoc(l, user.role))}
        luuTru={luuTruVanBan()}
        loiDoc={loiDoc[0] ?? null}
        maTra={ma ?? null}
        traMa={
          traMa
            ? { id: traMa.id, loai: traMa.loai, soVanBan: traMa.soVanBan, phatHanhTen: traMa.phatHanhTen, phatHanhLuc: traMa.phatHanhLuc, daNop: traMa.daNop?.ketQua ?? null }
            : null
        }
      />
    </ErpShell>
  );
}
