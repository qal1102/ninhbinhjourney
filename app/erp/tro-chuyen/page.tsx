import { redirect } from "next/navigation";
import { ErpShell } from "@/components/erp/erp-shell";
import { TroChuyenWorkspace } from "@/components/erp/tro-chuyen-workspace";
import { MAU_VAN_BAN } from "@/domain/van-ban";
import { getCurrentErpUser } from "@/lib/erp/demo-session";
import { danhBa, giaoDuocTrong, maVanBanDaNhan } from "@/lib/tro-chuyen/dich-vu";
import { cauHinhRealtime, kenhHopThu } from "@/lib/tro-chuyen/thoi-gian-thuc";
import { luuTruTroChuyen } from "@/lib/tro-chuyen/tro-chuyen-repository";

/**
 * Trò chuyện trong ERP (24/10/2026, migration 133): nhắn riêng, nhóm, gửi ảnh
 * và tệp, gắn một phần dự án, giao thành việc. Mọi vai vào được.
 * `?phong=<mã>` mở thẳng một cuộc trò chuyện (thông báo đẩy dẫn về đây).
 */
export default async function TroChuyenPage({ searchParams }: { searchParams: Promise<{ phong?: string }> }) {
  const user = await getCurrentErpUser();
  if (!user) redirect("/erp/login");
  if (user.mustChangePassword) redirect("/erp/doi-mat-khau");
  const { phong } = await searchParams;
  const [ds, vb] = await Promise.all([danhBa().catch(() => []), maVanBanDaNhan()]);
  const giaoDuoc = giaoDuocTrong(user, ds);

  return (
    <ErpShell user={user}>
      <TroChuyenWorkspace
        toi={{ id: user.id, ten: user.name }}
        danhBa={ds.map((n) => ({ id: n.id, ten: n.ten, chucDanh: n.chucDanh }))}
        giaoDuoc={[...giaoDuoc]}
        coSoMau={user.siteIds[0] ?? "trang-an"}
        vanBan={vb.map((v) => ({ id: v.id, ten: `${v.loai ? MAU_VAN_BAN[v.loai as keyof typeof MAU_VAN_BAN]?.ten ?? "Văn bản" : "Văn bản"} ${v.soVanBan}` }))}
        realtime={cauHinhRealtime()}
        hopThu={kenhHopThu(user.id)}
        phongDau={phong && /^[0-9a-f-]{36}$/.test(phong) ? phong : null}
        luuTru={luuTruTroChuyen()}
      />
    </ErpShell>
  );
}
