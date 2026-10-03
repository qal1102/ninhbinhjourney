import Link from "next/link";
import { redirect } from "next/navigation";
import { BanDoThuyenTre } from "@/components/erp/ban-do-thuyen-tre";
import { ErpBackLink } from "@/components/erp/erp-back-link";
import { ErpShell } from "@/components/erp/erp-shell";
import { NguoiCheo } from "@/components/erp/nguoi-cheo";
import { laCoSoThuyen, TUYEN_THUYEN, type CoSoThuyen } from "@/domain/thuyen-song";
import { getCurrentErpUser } from "@/lib/erp/demo-session";
import { ERP_OVERVIEW_BACK_TARGET } from "@/lib/erp/erp-back-link";
import { chuyenCuaToi, thuyenCoKho } from "@/lib/erp/thuyen-repository";

/**
 * Thuyền trên sông (migration 104), một chỗ cho cả hai phía:
 *
 * - Giám đốc và quản lý Tràng An / Tam Cốc thấy bản đồ sống ngay đầu trang,
 *   đổi bến bằng `?coSo=`. Trước đây bản đồ chỉ nằm trong màn Sức chứa, chủ dự
 *   án tìm không ra.
 * - Người chèo đò mở trên điện thoại lúc nhận khách: bấm "Bắt đầu chuyến",
 *   máy gửi vị trí vài giây một lần cho tới khi bấm "Về bến".
 */

type Props = { searchParams?: Promise<Record<string, string | string[] | undefined>> };

export default async function ErpThuyenPage({ searchParams }: Props) {
  const user = await getCurrentErpUser();
  if (!user) redirect("/erp/login");
  if (user.mustChangePassword) redirect("/erp/doi-mat-khau");
  const coSo = user.siteIds.filter((id): id is CoSoThuyen => laCoSoThuyen(id));
  const dangCheo = await chuyenCuaToi(user.id).catch(() => null);

  // Cùng luật với API bản đồ: vị trí nhân viên là dữ liệu cá nhân.
  const xemDuoc = (["trang-an", "tam-coc"] as const).filter(
    (id) => user.role === "director" || (user.role === "manager" && user.siteIds.includes(id)),
  );
  const xin = (await searchParams)?.coSo;
  const xinCoSo = Array.isArray(xin) ? xin[0] : xin;
  const banDo = xemDuoc.find((id) => id === xinCoSo) ?? xemDuoc[0] ?? null;

  return (
    <ErpShell user={user}>
      <ErpBackLink href={ERP_OVERVIEW_BACK_TARGET.href} label={ERP_OVERVIEW_BACK_TARGET.label} />
      <div className="mb-6">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-[#668078]">Thuyền trên sông</p>
        <h1 className="font-display mt-1 text-4xl leading-tight text-[#183f34] sm:text-6xl">
          {banDo ? "Bản đồ sống" : "Đang chèo"}
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-[#68776f]">
          {banDo
            ? "Từng thuyền đang ở đoạn nào của tuyến, theo điện thoại người chèo đò. Thuyền màu kem là mô phỏng để xem thử; thuyền thật màu vàng, kèm vệt cam 20 phút vừa đi."
            : "Nhận khách xong thì bấm bắt đầu chuyến. Quản lý cơ sở thấy thuyền của bạn trên bản đồ, biết bạn đang ở đoạn nào của tuyến. Vị trí chỉ gửi trong lúc chuyến đang mở; bấm \"Về bến\" là dừng hẳn."}
        </p>
      </div>

      {banDo ? (
        <section
          className="mb-8 rounded-2xl border border-[#d8e0db] bg-white p-4 shadow-sm sm:p-6"
          data-chi="ban-do-thuyen"
          data-chi-loi="Bản đồ sống: thuyền trượt liên tục dọc tuyến sông thật. Bấm Xem nhanh ×30 để thấy cả đội thuyền chạy, bấm vào một thuyền để xem chi tiết."
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-black text-[#20342c]">{TUYEN_THUYEN[banDo].ten}</h2>
            {xemDuoc.length > 1 ? (
              <nav aria-label="Chọn bến" className="flex gap-2" data-testid="chon-ben-thuyen">
                {xemDuoc.map((id) => (
                  <Link
                    key={id}
                    href={`/erp/thuyen?coSo=${id}`}
                    aria-current={id === banDo ? "page" : undefined}
                    className={`inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-bold ${
                      id === banDo ? "border-[#183f34] bg-[#183f34] text-white" : "border-[#cbd7d1] bg-white text-[#183f34]"
                    }`}
                  >
                    {/* Tên bến gọn, để hai nút đứng vừa một hàng ở 390px. */}
                    {TUYEN_THUYEN[id].ten.split(" · ")[0]}
                  </Link>
                ))}
              </nav>
            ) : null}
          </div>
          <div className="mt-4">
            <BanDoThuyenTre key={banDo} coSo={banDo} xemThuyenThat />
          </div>
        </section>
      ) : null}

      {banDo ? (
        <div className="mb-4">
          <h2 className="text-2xl font-black text-[#20342c]">Thử làm người chèo</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-[#5f7068]">
            Mở trang này trên điện thoại, bắt đầu một chuyến: thuyền của bạn hiện trên bản đồ phía trên (ở máy tính) sau vài giây.
          </p>
        </div>
      ) : null}

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
