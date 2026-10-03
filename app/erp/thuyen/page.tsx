import { redirect } from "next/navigation";
import { ErpBackLink } from "@/components/erp/erp-back-link";
import { ErpShell } from "@/components/erp/erp-shell";
import { NguoiCheo } from "@/components/erp/nguoi-cheo";
import { laCoSoThuyen, TUYEN_THUYEN, type CoSoThuyen } from "@/domain/thuyen-song";
import { getCurrentErpUser } from "@/lib/erp/demo-session";
import { ERP_OVERVIEW_BACK_TARGET } from "@/lib/erp/erp-back-link";
import { chuyenCuaToi, thuyenCoKho } from "@/lib/erp/thuyen-repository";

/**
 * Trang người chèo đò (migration 104). Mở trên điện thoại lúc nhận khách:
 * bấm "Bắt đầu chuyến", máy gửi vị trí vài giây một lần cho tới khi bấm
 * "Về bến". Chỉ người thuộc Tràng An hoặc Tam Cốc mới có nút bắt đầu.
 */
export default async function ErpThuyenPage() {
  const user = await getCurrentErpUser();
  if (!user) redirect("/erp/login");
  if (user.mustChangePassword) redirect("/erp/doi-mat-khau");
  const coSo = user.siteIds.filter((id): id is CoSoThuyen => laCoSoThuyen(id));
  const dangCheo = await chuyenCuaToi(user.id).catch(() => null);

  return (
    <ErpShell user={user}>
      <ErpBackLink href={ERP_OVERVIEW_BACK_TARGET.href} label={ERP_OVERVIEW_BACK_TARGET.label} />
      <div className="mb-6">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-[#668078]">Thuyền trên sông</p>
        <h1 className="font-display mt-1 text-4xl leading-tight text-[#183f34] sm:text-6xl">Đang chèo</h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-[#68776f]">
          Nhận khách xong thì bấm bắt đầu chuyến. Quản lý cơ sở thấy thuyền của bạn trên bản đồ, biết bạn đang ở đoạn nào và còn bao
          lâu về bến. Vị trí chỉ gửi trong lúc chuyến đang mở; bấm &quot;Về bến&quot; là dừng hẳn.
        </p>
      </div>
      {!thuyenCoKho() ? (
        <p role="status" className="rounded-2xl border border-[#e3e8e5] bg-white p-5 text-sm text-[#59654b]">
          Bản chạy này chưa nối kho dữ liệu nên chưa gửi được vị trí thuyền.
        </p>
      ) : coSo.length === 0 ? (
        <p role="status" data-testid="thuyen-khong-thuoc" className="rounded-2xl border border-[#e3e8e5] bg-white p-5 text-sm text-[#59654b]">
          Tài khoản của bạn không thuộc Tràng An hay Tam Cốc, nơi có thuyền chở khách.
        </p>
      ) : (
        <NguoiCheo
          coSo={coSo.map((id) => ({ id, ten: TUYEN_THUYEN[id].ten }))}
          chuyenDangMo={dangCheo}
        />
      )}
    </ErpShell>
  );
}
