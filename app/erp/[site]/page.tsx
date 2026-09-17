import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ERP_MODULES, getErpSite } from "@/domain/erp";
import { groupVisibleErpModules } from "@/domain/erp-navigation";
import { ErpBackLink } from "@/components/erp/erp-back-link";
import { ErpShell } from "@/components/erp/erp-shell";
import { ERP_OVERVIEW_BACK_TARGET } from "@/lib/erp/erp-back-link";
import { countEmployeesOnShift } from "@/lib/erp/attendance-repository";
import {
  accountCanAccessSite,
  getCurrentErpUser,
} from "@/lib/erp/demo-session";
import { countGateScansToday } from "@/lib/erp/gate-scan-repository";
import { getIncidentCases } from "@/lib/erp/incident-repository";

type Props = {
  params: Promise<{ site: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ErpSitePage({ params, searchParams }: Props) {
  const { site: siteId } = await params;
  const site = getErpSite(siteId);
  if (!site) notFound();
  const user = await getCurrentErpUser();
  if (!user) redirect("/erp/login");
  if (user.mustChangePassword) redirect("/erp/doi-mat-khau");
  if (!accountCanAccessSite(user, site.id)) redirect("/erp?denied=site");
  const [employeesOnShift, gateScansToday, openIncidents] = await Promise.all([
    countEmployeesOnShift(site.id),
    countGateScansToday(site.id),
    getIncidentCases(site.id).then(
      (cases) => cases.filter((item) => item.status !== "closed").length,
    ),
  ]);
  const kpis: { label: string; value: string; noSource?: boolean }[] = [
    { label: "Khách dự kiến", value: "—", noSource: true },
    { label: "Đã check-in hôm nay", value: gateScansToday.toLocaleString("vi-VN") },
    { label: "Nhân sự trong ca", value: employeesOnShift.toLocaleString("vi-VN") },
    { label: "Tải hiện tại", value: "—", noSource: true },
    { label: "Sự cố mở", value: openIncidents.toLocaleString("vi-VN") },
  ];
  const query = (await searchParams) ?? {};
  const denied = Array.isArray(query.denied) ? query.denied[0] : query.denied;
  const moduleIds = user.moduleIdsBySite[site.id] ?? [];
  const modules = ERP_MODULES.filter((module) => moduleIds.includes(module.id));
  // ERP-UX-01: trước đây trang này chia thẻ theo một danh sách "ưu tiên giám
  // đốc" nhét cứng tại chỗ, rồi gắn tiêu đề "Tài chính, rủi ro và dự án" lên
  // một nhóm có cả sức chứa lẫn camera — tiêu đề không khớp nội dung bên dưới.
  // Nay gom theo đúng bộ nhóm mà thanh điều hướng đang dùng
  // (`ERP_MODULE_GROUPS`), nên người dùng chỉ phải học **một** cách sắp xếp.
  const groups = groupVisibleErpModules(modules);

  return (
    <ErpShell user={user} site={site}>
      <ErpBackLink href={ERP_OVERVIEW_BACK_TARGET.href} label={ERP_OVERVIEW_BACK_TARGET.label} />
      <section className="relative overflow-hidden rounded-3xl bg-[#183f34] text-white">
        <Image src={site.image} alt="" fill sizes="100vw" className="object-cover opacity-30" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(18,52,42,.97),rgba(18,52,42,.68),rgba(18,52,42,.25))]" />
        <div className="relative z-10 p-6 sm:p-9">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[#b9ddcf]">Tổng quan trong ngày</p>
          <h1 className="font-display mt-3 text-5xl sm:text-7xl">{site.shortName}</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-white/70">{site.summary}</p>
          {/* ERP-UX-01 + nguyên tắc ③: ô chưa đo được **ở lại**, không được ẩn
              cho gọn. Nhưng nó không còn cùng trọng số với số thật — viền mờ
              hơn, chữ nhỏ hơn — để con số có nguồn nổi lên trước. */}
          <div className="mt-7 grid max-w-4xl grid-cols-2 gap-3 sm:grid-cols-5">
            {kpis.map((kpi) => (
              <div
                key={kpi.label}
                className={
                  kpi.noSource
                    ? "rounded-xl border border-dashed border-white/12 p-3"
                    : "rounded-xl border border-white/20 bg-black/15 p-3 backdrop-blur-sm"
                }
              >
                <p className={kpi.noSource ? "text-xs text-white/35" : "text-xs text-white/60"}>{kpi.label}</p>
                <p className={kpi.noSource ? "mt-1 text-base font-bold text-white/45" : "mt-1 text-2xl font-black"}>{kpi.value}</p>
                {kpi.noSource ? (
                  <p className="mt-1 text-xs leading-4 text-white/35">Chưa có nguồn dữ liệu</p>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </section>

      {denied === "module" ? (
        <p role="alert" className="mt-6 rounded-xl border border-[#eccac2] bg-[#fff2ef] px-4 py-3 text-sm font-bold text-[#8b3d31]">
          Nghiệp vụ này chưa được mở cho tài khoản của bạn.
        </p>
      ) : null}

      <section className="mt-8">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#477565]">Nghiệp vụ được mở cho bạn</p>
            <h2 className="font-display mt-2 text-3xl text-[#183f34] sm:text-4xl">Công việc tại {site.shortName}</h2>
          </div>
          {/* ERP-UX-08: chỗ này từng có thêm một liên kết "← Đổi cơ sở" cũng
              trỏ về `/erp`. Nay đầu trang đã có đường quay lại, để hai mũi tên
              cùng dẫn về một nơi trên cùng một màn hình chỉ làm người ta phải
              đọc kỹ mới biết chúng khác gì nhau — mà chúng thì không khác. */}
        </div>

        {/* ERP-UX-01: bỏ hẳn số thứ tự 01–08 và ô màu trên mỗi thẻ. Đánh số
            hứa một trình tự không có thật — các nghiệp vụ này chạy song song,
            không ai làm "01 rồi mới tới 02". Màu thì trước đây mỗi module một
            sắc, không mã hoá điều gì cả. Luật ERP: có trình tự thật thì dùng
            stepper có trạng thái; màu phải mã hoá được thứ gì đó, không thì
            đừng dùng. Thứ duy nhất còn giữ màu là nhãn "Giai đoạn sau", vì nó
            mã hoá đúng một điều: mở ra chưa có nghiệp vụ. */}
        <div className="mt-6 space-y-7">
          {groups.map((group) => (
            <div key={group.id}>
              <h3 className="text-xs font-black uppercase tracking-[0.16em] text-[#6d7e76]">{group.name}</h3>
              <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {group.modules.map((module) => (
                  <Link
                    href={`/erp/${site.id}/${module.id}`}
                    key={module.id}
                    className="group rounded-2xl border border-[#d8e0db] bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-[#a8bbb2] hover:shadow-lg hover:shadow-[#24483c]/8"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <h4 className="text-lg font-black text-[#24372f]">{module.name}</h4>
                      {/* T3: một module chưa có nghiệp vụ phải nói trước khi
                          người dùng mở ra, không phải sau. */}
                      {module.status === "planned" ? (
                        <span className="shrink-0 rounded-full bg-[#f6ecd8] px-3 py-1 text-xs font-black text-[#8a6b27]">
                          Giai đoạn sau
                        </span>
                      ) : (
                        <span className="shrink-0 text-xl text-[#91a098] transition group-hover:translate-x-1 group-hover:text-[#286655]">→</span>
                      )}
                    </div>
                    <p className="mt-3 text-sm leading-6 text-[#697770]">{module.description}</p>
                  </Link>
                ))}
              </div>
            </div>
          ))}
          {groups.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-[#c7d2cc] p-6 text-sm leading-6 text-[#748079]">
              Bạn chưa được mở nghiệp vụ nào tại {site.shortName}. Giám đốc cấp quyền tại màn hình Quản lý tài khoản.
            </p>
          ) : null}
        </div>
      </section>
    </ErpShell>
  );
}
