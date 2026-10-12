import Link from "next/link";
import { redirect } from "next/navigation";
import { ERP_MODULES, ERP_SITES, type ErpSite, type ErpSiteId } from "@/domain/erp";
import { groupVisibleErpModules } from "@/domain/erp-navigation";
import { partitionErpDataOrigin } from "@/domain/erp-data-origin";
import { duBao7Ngay, type NgayBaoCao } from "@/domain/bao-cao-co-so";
import {
  KY_TOAN_VUNG,
  SO_NGAY_CAN_DOC,
  TEN_KY,
  TONG_RONG,
  cacNgayTrongKy,
  docKy,
  phanTramDoi,
  tienCua,
  tiTrong,
  tongTheoKy,
  type KyToanVung,
  type TongKy,
} from "@/domain/toan-vung";
import { ErpBackLink } from "@/components/erp/erp-back-link";
import { ErpShell } from "@/components/erp/erp-shell";
import { ERP_OVERVIEW_BACK_TARGET } from "@/lib/erp/erp-back-link";
import { countEmployeesOnShift } from "@/lib/erp/attendance-repository";
import { docBaoCaoCoSo, type BaoCaoCoSo } from "@/lib/erp/bao-cao-repository";
import { getCurrentErpUser } from "@/lib/erp/demo-session";
import { getIncidentCases, type IncidentCase } from "@/lib/erp/incident-repository";
import { getProjectWorkspace, type ProjectWorkspace } from "@/lib/erp/project-repository";
import { listShiftClosures } from "@/lib/erp/shift-close-repository";
import { listPendingSopDecisions } from "@/lib/erp/sop-repository";
import { listSupplierAp } from "@/lib/erp/supplier-ap-repository";
import { vietnamDateKey } from "@/lib/erp/workday-repository";

export const metadata = { title: "Toàn vùng" };

type Props = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type CoSoDoc = {
  site: ErpSite;
  baoCao: BaoCaoCoSo | null;
  suCo: IncidentCase[];
  duAn: ProjectWorkspace | null;
  nhanSu: number | null;
};

function mot(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

/** Tiền gọn cho ô hẹp ở 390px: "12,5 tr", "1,25 tỷ". */
function tienGon(value: number) {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toLocaleString("vi-VN", { maximumFractionDigits: 2 })} tỷ`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} tr`;
  return `${value.toLocaleString("vi-VN")} đ`;
}

function tienDu(value: number) {
  return `${value.toLocaleString("vi-VN")} đ`;
}

function so(value: number) {
  return value.toLocaleString("vi-VN");
}

function Doi({ hienTai, truoc, ky }: { hienTai: number; truoc: number; ky: KyToanVung }) {
  const doi = phanTramDoi(hienTai, truoc);
  const kyTruoc = ky === "hom-nay" ? "hôm qua" : `${TEN_KY[ky].toLowerCase()} trước`;
  if (doi === null) return <span>chưa có số {kyTruoc}</span>;
  return (
    <span className={doi >= 0 ? "text-[#9fe0c4]" : "text-[#ffc2b4]"}>
      {doi >= 0 ? "▲" : "▼"} {Math.abs(doi)}% so với {kyTruoc}
    </span>
  );
}

function ngayCuaBaoCao(baoCao: BaoCaoCoSo | null): readonly NgayBaoCao[] {
  return baoCao?.trangThai === "co-so-lieu" ? baoCao.soLieu.ngay : [];
}

function tienDoDuAn(duAn: ProjectWorkspace | null) {
  if (!duAn) return null;
  const goi = duAn.milestones.flatMap((milestone) => milestone.workItems);
  if (goi.length === 0) return null;
  return Math.round(goi.reduce((tong, item) => tong + item.progressPercent, 0) / goi.length);
}

export default async function ToanVungPage({ searchParams }: Props) {
  const user = await getCurrentErpUser();
  if (!user) redirect("/erp/login");
  if (user.mustChangePassword) redirect("/erp/doi-mat-khau");
  // Màn cộng gộp nhiều cơ sở: chỉ giám đốc vùng. Quản lý một cơ sở đã có
  // trang tổng quan của cơ sở mình.
  if (user.role !== "director") redirect("/erp?denied=site");

  const query = (await searchParams) ?? {};
  const ky = docKy(mot(query.ky));
  const sites = ERP_SITES.filter((site) => user.siteIds.includes(site.id));
  const coSoChon = sites.find((site) => site.id === mot(query.coSo)) ?? null;
  const homNay = vietnamDateKey();

  const [coSo, caChot, congNo, sopCho] = await Promise.all([
    Promise.all(
      sites.map(async (site): Promise<CoSoDoc> => {
        const [baoCao, suCo, duAn, nhanSu] = await Promise.all([
          docBaoCaoCoSo(site.id, { soNgay: SO_NGAY_CAN_DOC - 1, gomHomNay: true }).catch(() => null),
          getIncidentCases(site.id)
            .then((cases) => cases.filter((item) => item.status !== "closed"))
            .catch(() => []),
          getProjectWorkspace(site.id).catch(() => null),
          countEmployeesOnShift(site.id).catch(() => null),
        ]);
        return { site, baoCao, suCo, duAn, nhanSu };
      }),
    ),
    listShiftClosures({ siteIds: user.siteIds }).catch(() => []),
    listSupplierAp({ siteIds: user.siteIds }).catch(() => ({ suppliers: [], invoices: [] })),
    listPendingSopDecisions(user.siteIds).catch(() => []),
  ]);

  // Cùng luật với trang đầu giám đốc: hồ sơ mẫu không vào ô tiền.
  const { real: caThat } = partitionErpDataOrigin(caChot);
  const { real: hoaDonThat, sample: hoaDonMau } = partitionErpDataOrigin(congNo.invoices);

  const theoCoSo = coSo.map((doc) => {
    const ngay = ngayCuaBaoCao(doc.baoCao);
    const { hienTai, truoc } = tongTheoKy(ngay, ky, homNay);
    const caLech = caThat.filter((record) => record.siteId === doc.site.id && record.status === "exception-pending-director");
    const hoaDon = hoaDonThat.filter((invoice) => invoice.siteId === doc.site.id);
    const conPhaiTra = hoaDon
      .filter((invoice) => invoice.status === "posted" || invoice.status === "payment-requested")
      .reduce((tong, invoice) => tong + invoice.totalVnd, 0);
    const hoaDonCho = hoaDon.filter(
      (invoice) => invoice.status === "director-exception" && invoice.ownerRole === "director",
    );
    const deNghiDuAn = doc.duAn?.changeRequests.filter((request) => request.status === "pending") ?? [];
    const sop = sopCho.filter((item) => item.siteId === doc.site.id);
    return {
      ...doc,
      ngay,
      hienTai,
      truoc,
      caLech,
      conPhaiTra,
      hoaDonCho,
      deNghiDuAn,
      sop,
      viecCho: caLech.length + hoaDonCho.length + deNghiDuAn.length + sop.length,
      suCoQuaHan: doc.suCo.filter((item) => item.elapsedMinutes >= item.slaMinutes).length,
      tienDo: tienDoDuAn(doc.duAn),
      docDuoc: doc.baoCao?.trangThai === "co-so-lieu",
    };
  });

  const tong = theoCoSo.reduce<{ hienTai: TongKy; truoc: TongKy }>(
    (acc, item) => ({
      hienTai: {
        khach: acc.hienTai.khach + item.hienTai.khach,
        tienQuay: acc.hienTai.tienQuay + item.hienTai.tienQuay,
        phieuQuay: acc.hienTai.phieuQuay + item.hienTai.phieuQuay,
        tienWeb: acc.hienTai.tienWeb + item.hienTai.tienWeb,
        khachWeb: acc.hienTai.khachWeb + item.hienTai.khachWeb,
      },
      truoc: {
        khach: acc.truoc.khach + item.truoc.khach,
        tienQuay: acc.truoc.tienQuay + item.truoc.tienQuay,
        phieuQuay: acc.truoc.phieuQuay + item.truoc.phieuQuay,
        tienWeb: acc.truoc.tienWeb + item.truoc.tienWeb,
        khachWeb: acc.truoc.khachWeb + item.truoc.khachWeb,
      },
    }),
    { hienTai: TONG_RONG, truoc: TONG_RONG },
  );
  const tongSuCo = theoCoSo.reduce((n, item) => n + item.suCo.length, 0);
  const tongSuCoQuaHan = theoCoSo.reduce((n, item) => n + item.suCoQuaHan, 0);
  const tongViecCho = theoCoSo.reduce((n, item) => n + item.viecCho, 0);
  const tongConPhaiTra = theoCoSo.reduce((n, item) => n + item.conPhaiTra, 0);
  const khongDocDuoc = theoCoSo.filter((item) => !item.docDuoc).map((item) => item.site.shortName);
  const chiTiet = coSoChon ? theoCoSo.find((item) => item.site.id === coSoChon.id) ?? null : null;

  const lienKet = (next: { ky?: KyToanVung; coSo?: ErpSiteId | null }) => {
    const params = new URLSearchParams();
    const kyMoi = next.ky ?? ky;
    if (kyMoi !== "hom-nay") params.set("ky", kyMoi);
    const coSoMoi = next.coSo === undefined ? coSoChon?.id : next.coSo;
    if (coSoMoi) params.set("coSo", coSoMoi);
    const chuoi = params.toString();
    return `/erp/toan-vung${chuoi ? `?${chuoi}` : ""}`;
  };

  const nhomNghiepVu = groupVisibleErpModules(
    ERP_MODULES.filter((module) => sites.some((site) => (user.moduleIdsBySite[site.id] ?? []).includes(module.id))),
  );

  return (
    <ErpShell user={user}>
      <ErpBackLink href={ERP_OVERVIEW_BACK_TARGET.href} label={ERP_OVERVIEW_BACK_TARGET.label} />

      <div className="min-w-0 space-y-5">
        <section className="min-w-0 overflow-hidden rounded-3xl bg-[#173f34] p-5 text-white sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#b6d5ca]">
            {sites.length} cơ sở · {TEN_KY[ky]}
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-[-0.035em] sm:text-5xl" data-chi="toan-vung" data-chi-loi="Mọi cơ sở trên một màn. Chọn kỳ, bấm thẻ một cơ sở để mở chi tiết.">Toàn vùng</h1>

          <nav aria-label="Chọn kỳ" data-testid="chon-ky-toan-vung" className="mt-5 inline-flex rounded-full bg-white/10 p-1">
            {KY_TOAN_VUNG.map((item) => (
              <Link
                key={item}
                href={lienKet({ ky: item })}
                aria-current={item === ky ? "page" : undefined}
                className={`inline-flex min-h-10 items-center rounded-full px-4 text-sm font-black whitespace-nowrap ${
                  item === ky ? "bg-white text-[#173f34]" : "text-white/75 hover:text-white"
                }`}
              >
                {TEN_KY[item]}
              </Link>
            ))}
          </nav>

          <div className="mt-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
            <article className="min-w-0 rounded-xl border border-white/10 bg-white/[0.055] p-4">
              <p className="text-xs text-white/55">Khách vào cổng</p>
              <p className="mt-2 text-2xl font-black">{so(tong.hienTai.khach)}</p>
              <p className="mt-2 text-xs leading-4 text-[#b5d6ca]">
                <Doi hienTai={tong.hienTai.khach} truoc={tong.truoc.khach} ky={ky} />
              </p>
            </article>
            <article className="min-w-0 rounded-xl border border-white/10 bg-white/[0.055] p-4">
              <p className="text-xs text-white/55">Tiền thu</p>
              <p className="mt-2 text-2xl font-black">{tienGon(tienCua(tong.hienTai))}</p>
              <p className="mt-2 text-xs leading-4 text-[#b5d6ca]">
                Quầy {tienGon(tong.hienTai.tienQuay)} · Web {tienGon(tong.hienTai.tienWeb)}
              </p>
            </article>
            <article className="min-w-0 rounded-xl border border-white/10 bg-white/[0.055] p-4">
              <p className="text-xs text-white/55">Sự cố đang mở</p>
              <p className="mt-2 text-2xl font-black">{so(tongSuCo)}</p>
              <p className={`mt-2 text-xs leading-4 ${tongSuCoQuaHan > 0 ? "font-bold text-[#ffc2b4]" : "text-[#b5d6ca]"}`}>
                {tongSuCoQuaHan > 0 ? `${tongSuCoQuaHan} quá hạn xử lý` : "Không sự cố nào quá hạn"}
              </p>
            </article>
            <article className="min-w-0 rounded-xl border border-white/10 bg-white/[0.055] p-4">
              <p className="text-xs text-white/55">Chờ giám đốc quyết</p>
              <p className="mt-2 text-2xl font-black">{so(tongViecCho)}</p>
              <p className="mt-2 text-xs leading-4 text-[#b5d6ca]">Ca lệch, hoá đơn, dự án, mở cửa</p>
            </article>
          </div>
          {khongDocDuoc.length > 0 ? (
            <p className="mt-4 rounded-xl border border-white/15 bg-white/[0.06] p-3 text-xs leading-5 text-[#d3e5dd]">
              Chưa đọc được số khách và tiền của {khongDocDuoc.join(", ")}; các tổng trên chưa gồm phần ấy.
            </p>
          ) : null}
        </section>

        <section aria-labelledby="tung-co-so" className="min-w-0">
          <div className="flex items-end justify-between gap-3">
            <h2 id="tung-co-so" className="text-xl font-black text-[#20342c]">Từng cơ sở</h2>
            <p className="text-xs text-[#6d7c75]">Bấm vào cơ sở để xem chi tiết</p>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {theoCoSo.map((item) => {
              const chon = item.site.id === coSoChon?.id;
              return (
                <Link
                  key={item.site.id}
                  href={`${lienKet({ coSo: chon ? null : item.site.id })}${chon ? "" : "#chi-tiet-co-so"}`}
                  data-the-co-so={item.site.id}
                  aria-current={chon ? "true" : undefined}
                  className={`group block min-w-0 rounded-2xl border bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg motion-reduce:transition-none motion-reduce:hover:translate-y-0 ${
                    chon ? "border-[#183f34] ring-2 ring-[#183f34]" : "border-[#d8e0db] hover:border-[#a8bbb2]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-lg font-black text-[#24372f]">{item.site.shortName}</h3>
                    <span aria-hidden="true" className="text-xl text-[#91a098] transition group-hover:translate-x-1">
                      {chon ? "×" : "→"}
                    </span>
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                    <div>
                      <dt className="text-[#7b8881]">Khách</dt>
                      <dd className="mt-0.5 text-base font-black text-[#20342c]">{item.docDuoc ? so(item.hienTai.khach) : "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-[#7b8881]">Tiền thu</dt>
                      <dd className="mt-0.5 text-base font-black text-[#20342c]">{item.docDuoc ? tienGon(tienCua(item.hienTai)) : "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-[#7b8881]">Sự cố mở</dt>
                      <dd className={`mt-0.5 font-black ${item.suCoQuaHan > 0 ? "text-[#a34637]" : "text-[#20342c]"}`}>
                        {so(item.suCo.length)}
                        {item.suCoQuaHan > 0 ? ` · ${item.suCoQuaHan} quá hạn` : ""}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[#7b8881]">Chờ quyết</dt>
                      <dd className={`mt-0.5 font-black ${item.viecCho > 0 ? "text-[#9a5f32]" : "text-[#20342c]"}`}>{so(item.viecCho)}</dd>
                    </div>
                  </dl>
                  <div className="mt-3">
                    <div className="flex justify-between text-xs text-[#7b8881]">
                      <span>Phần khách cả vùng</span>
                      <span className="font-black text-[#4a5952]">{tiTrong(item.hienTai.khach, tong.hienTai.khach)}%</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[#e7ece9]">
                      <div className="h-full rounded-full bg-[#397a62]" style={{ width: `${tiTrong(item.hienTai.khach, tong.hienTai.khach)}%` }} />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        {chiTiet ? (
          <ChiTietCoSo
            item={chiTiet}
            ky={ky}
            homNay={homNay}
            nghiepVu={ERP_MODULES.filter((module) => (user.moduleIdsBySite[chiTiet.site.id] ?? []).includes(module.id))}
            dongLai={lienKet({ coSo: null })}
          />
        ) : null}

        <section aria-labelledby="tai-chinh" className="min-w-0 overflow-hidden rounded-2xl border border-[#d8e0db] bg-white shadow-sm">
          <div className="border-b border-[#e3e9e5] p-5">
            <p className="text-xs font-black uppercase tracking-[0.17em] text-[#9a5f32]">{TEN_KY[ky]}</p>
            <h2 id="tai-chinh" className="mt-1 text-xl font-black text-[#20342c]">Tài chính theo cơ sở</h2>
          </div>
          <div className="hidden grid-cols-[1.2fr_1fr_1fr_1fr_0.6fr] gap-3 border-b border-[#eef2ef] px-5 py-2 text-xs font-black text-[#7b8881] sm:grid">
            <span>Cơ sở</span>
            <span className="text-right">Quầy</span>
            <span className="text-right">Web</span>
            <span className="text-right">Tổng</span>
            <span className="text-right">Tỉ trọng</span>
          </div>
          <ul className="divide-y divide-[#eef2ef]">
            {theoCoSo.map((item) => (
              <li key={item.site.id} className="grid grid-cols-2 gap-x-3 gap-y-1 px-5 py-3 text-sm sm:grid-cols-[1.2fr_1fr_1fr_1fr_0.6fr] sm:items-center">
                <Link href={`${lienKet({ coSo: item.site.id })}#chi-tiet-co-so`} className="font-black text-[#183f34] underline-offset-4 hover:underline">
                  {item.site.shortName}
                </Link>
                <span className="text-right font-black text-[#20342c] sm:order-4">{tienDu(tienCua(item.hienTai))}</span>
                <span className="text-xs text-[#6e7b75] sm:order-2 sm:text-right sm:text-sm sm:text-[#20342c]">
                  <span className="sm:hidden">Quầy </span>{tienDu(item.hienTai.tienQuay)}
                  <span className="text-[#9aa49f]"> · {so(item.hienTai.phieuQuay)} phiếu</span>
                </span>
                <span className="text-right text-xs text-[#6e7b75] sm:order-3 sm:text-sm sm:text-[#20342c]">
                  <span className="sm:hidden">Web </span>{tienDu(item.hienTai.tienWeb)}
                </span>
                <span className="col-span-2 text-xs text-[#7b8881] sm:order-5 sm:col-span-1 sm:text-right">
                  <span className="sm:hidden">Tỉ trọng tiền </span>{tiTrong(tienCua(item.hienTai), tienCua(tong.hienTai))}%
                </span>
              </li>
            ))}
            <li className="grid grid-cols-2 gap-x-3 bg-[#f6f8f6] px-5 py-3 text-sm font-black sm:grid-cols-[1.2fr_1fr_1fr_1fr_0.6fr]">
              <span className="text-[#20342c]">Cả vùng</span>
              <span className="text-right text-[#20342c] sm:order-4">{tienDu(tienCua(tong.hienTai))}</span>
              <span className="hidden text-right sm:order-2 sm:block">{tienDu(tong.hienTai.tienQuay)}</span>
              <span className="hidden text-right sm:order-3 sm:block">{tienDu(tong.hienTai.tienWeb)}</span>
              <span className="hidden text-right sm:order-5 sm:block">100%</span>
            </li>
          </ul>
          <dl className="grid gap-3 border-t border-[#e3e9e5] p-5 text-sm sm:grid-cols-3">
            <div className="rounded-xl bg-[#f6f8f6] p-4">
              <dt className="text-xs text-[#7b8881]">Còn phải trả nhà cung cấp</dt>
              <dd className="mt-1 text-lg font-black text-[#20342c]">{tienDu(tongConPhaiTra)}</dd>
              <dd className="mt-1 text-xs text-[#849089]">
                Hoá đơn đã ghi sổ, chưa trả
                {hoaDonMau.length > 0 ? ` · ${hoaDonMau.length} hoá đơn mẫu không tính` : ""}
              </dd>
            </div>
            <div className="rounded-xl bg-[#f6f8f6] p-4">
              <dt className="text-xs text-[#7b8881]">Ca lệch tiền chờ quyết</dt>
              <dd className="mt-1 text-lg font-black text-[#20342c]">{so(theoCoSo.reduce((n, item) => n + item.caLech.length, 0))}</dd>
              <dd className="mt-1 text-xs text-[#849089]">
                Chênh {tienDu(theoCoSo.reduce((n, item) => n + item.caLech.reduce((m, record) => m + Math.abs(record.differenceVnd), 0), 0))}
              </dd>
            </div>
            <div className="rounded-xl bg-[#f6f8f6] p-4">
              <dt className="text-xs text-[#7b8881]">Ngân sách sự kiện đã cam kết</dt>
              <dd className="mt-1 text-lg font-black text-[#20342c]">
                {theoCoSo.reduce((n, item) => n + (item.duAn?.event.committedBillion ?? 0), 0).toLocaleString("vi-VN", { maximumFractionDigits: 2 })} /{" "}
                {theoCoSo.reduce((n, item) => n + (item.duAn?.event.budgetBillion ?? 0), 0).toLocaleString("vi-VN", { maximumFractionDigits: 2 })} tỷ
              </dd>
              <dd className="mt-1 text-xs text-[#849089]">Cộng sự kiện của các cơ sở</dd>
            </div>
          </dl>
          <p className="border-t border-[#e3e9e5] px-5 py-3 text-xs leading-5 text-[#849089]">
            Khách và tiền cộng từ cùng nguồn với màn Báo cáo & dự báo của từng cơ sở; tiền web chia theo cơ sở của từng vé.
            Sổ kế toán đầy đủ ở{" "}
            <Link href="/erp/finance" className="font-bold text-[#183f34] underline underline-offset-4">Tài chính</Link>.
          </p>
        </section>

        <section aria-labelledby="mo-nghiep-vu" className="min-w-0 rounded-2xl border border-[#d8e0db] bg-white p-5 shadow-sm">
          <h2 id="mo-nghiep-vu" className="text-xl font-black text-[#20342c]">Mở nghiệp vụ</h2>
          <p className="mt-1 text-sm text-[#6d7c75]">Chọn nghiệp vụ, bấm tên cơ sở để vào thẳng màn ấy.</p>
          <div className="mt-4 space-y-5" data-testid="mo-nghiep-vu-toan-vung">
            {nhomNghiepVu.map((group) => (
              <div key={group.id}>
                <h3 className="text-xs font-black uppercase tracking-[0.16em] text-[#6d7e76]">{group.name}</h3>
                <ul className="mt-2 divide-y divide-[#eef2ef] rounded-xl border border-[#e3e9e5]">
                  {group.modules.map((module) => (
                    <li key={module.id} className="flex flex-col gap-2 px-2 py-3 sm:flex-row sm:p-3 sm:items-center sm:justify-between">
                      <span className="text-sm font-black text-[#24372f]">{module.name}</span>
                      <span className="grid grid-cols-4 gap-1 sm:flex sm:flex-wrap sm:gap-2">
                        {sites
                          .filter((site) => (user.moduleIdsBySite[site.id] ?? []).includes(module.id))
                          .map((site) => (
                            <Link
                              key={site.id}
                              href={`/erp/${site.id}/${module.id}`}
                              className="inline-flex min-h-10 items-center justify-center rounded-full border border-[#cbd7d1] px-1 text-xs font-bold tracking-tight whitespace-nowrap text-[#183f34] hover:border-[#183f34] hover:bg-[#f3f7f5] sm:px-3"
                            >
                              {site.shortName}
                            </Link>
                          ))}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      </div>
    </ErpShell>
  );
}

type ChiTietProps = {
  item: CoSoDoc & {
    ngay: readonly NgayBaoCao[];
    hienTai: TongKy;
    truoc: TongKy;
    caLech: { id: string; shiftCode: string; differenceVnd: number }[];
    conPhaiTra: number;
    hoaDonCho: { id: string; totalVnd: number }[];
    deNghiDuAn: { id: string; summary: string }[];
    sop: { id: string }[];
    viecCho: number;
    suCoQuaHan: number;
    tienDo: number | null;
    docDuoc: boolean;
  };
  ky: KyToanVung;
  homNay: string;
  nghiepVu: typeof ERP_MODULES;
  dongLai: string;
};

const MUC_DO: Record<string, string> = { P1: "Khẩn", P2: "Cao", P3: "Vừa", P4: "Thấp" };

function ChiTietCoSo({ item, ky, homNay, nghiepVu, dongLai }: ChiTietProps) {
  const { site } = item;
  const cot = cacNgayTrongKy(item.ngay, ky, homNay);
  const lonNhat = Math.max(1, ...cot.map((hang) => hang.khachVao));
  // Dự báo chỉ dựa trên ngày đã khép, như màn Báo cáo & dự báo.
  const duBao =
    item.baoCao?.trangThai === "co-so-lieu"
      ? duBao7Ngay({ ...item.baoCao.soLieu, ngay: item.ngay.filter((hang) => hang.ngay < homNay) }, homNay)
      : [];
  const goi = item.duAn?.milestones.flatMap((milestone) => milestone.workItems) ?? [];
  const goiTre = goi.filter((goiViec) => goiViec.status !== "done" && goiViec.dueDate < homNay);
  const vao = (moduleId: string) => `/erp/${site.id}/${moduleId}`;

  return (
    <section
      id="chi-tiet-co-so"
      aria-labelledby="tieu-de-chi-tiet"
      data-testid="chi-tiet-co-so"
      className="min-w-0 scroll-mt-24 overflow-hidden rounded-2xl border-2 border-[#183f34] bg-white shadow-sm"
    >
      <div className="flex items-start justify-between gap-3 bg-[#183f34] p-5 text-white">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.17em] text-[#b6d5ca]">Chi tiết · {TEN_KY[ky]}</p>
          <h2 id="tieu-de-chi-tiet" className="mt-1 text-2xl font-black">{site.shortName}</h2>
        </div>
        <Link
          href={dongLai}
          aria-label="Đóng chi tiết"
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/25 bg-white/10 text-xl font-black"
        >
          ×
        </Link>
      </div>

      <div className="space-y-5 p-5">
        <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            ["Khách vào cổng", item.docDuoc ? so(item.hienTai.khach) : "—", `${so(item.hienTai.khachWeb)} khách đặt web`],
            ["Tiền quầy", item.docDuoc ? tienGon(item.hienTai.tienQuay) : "—", `${so(item.hienTai.phieuQuay)} phiếu`],
            ["Tiền web", item.docDuoc ? tienGon(item.hienTai.tienWeb) : "—", "Chia theo vé của cơ sở"],
            ["Nhân sự trong ca", item.nhanSu === null ? "—" : so(item.nhanSu), "Đang chấm công vào"],
          ].map(([nhan, giaTri, ghiChu]) => (
            <div key={nhan} className="rounded-xl bg-[#f6f8f6] p-3">
              <dt className="text-xs text-[#7b8881]">{nhan}</dt>
              <dd className="mt-1 text-xl font-black text-[#20342c]">{giaTri}</dd>
              <dd className="mt-0.5 text-xs text-[#849089]">{ghiChu}</dd>
            </div>
          ))}
        </dl>

        {cot.length > 0 ? (
          <div>
            <h3 className="text-sm font-black text-[#30443b]">Khách theo ngày{ky === "hom-nay" ? " (14 ngày gần nhất)" : ""}</h3>
            <div className="mt-3 flex h-28 items-end gap-[3px]" role="img" aria-label={`Khách theo ngày tại ${site.shortName}`}>
              {cot.map((hang) => (
                <div
                  key={hang.ngay}
                  title={`${hang.ngay.slice(8, 10)}/${hang.ngay.slice(5, 7)}: ${so(hang.khachVao)} khách`}
                  className={`min-w-0 flex-1 rounded-t ${hang.ngay === homNay ? "bg-[#e4b37b]" : "bg-[#397a62]"}`}
                  style={{ height: `${Math.max(2, Math.round((hang.khachVao / lonNhat) * 100))}%` }}
                />
              ))}
            </div>
            <div className="mt-1 flex justify-between text-xs text-[#849089]">
              <span>{cot[0] ? `${cot[0].ngay.slice(8, 10)}/${cot[0].ngay.slice(5, 7)}` : ""}</span>
              <span>Hôm nay (cột vàng, chưa hết ngày)</span>
            </div>
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-[#c7d2cc] p-4 text-sm text-[#6d7c75]">
            {item.baoCao?.trangThai === "loi" ? item.baoCao.loiNhan : "Bản chạy này chưa nối kho số liệu khách."}
          </p>
        )}

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-[#e3e9e5] p-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-black text-[#30443b]">Sự cố đang mở ({so(item.suCo.length)})</h3>
              <Link href={vao("su-co")} className="text-xs font-black text-[#183f34] underline underline-offset-4">Mở sự cố</Link>
            </div>
            <ul className="mt-2 space-y-2">
              {item.suCo.slice(0, 5).map((suCo) => (
                <li key={suCo.id} className="flex items-start justify-between gap-2 text-xs">
                  <span className="min-w-0 text-[#2c3e36]">
                    <strong className="mr-1 rounded bg-[#ffe4de] px-1.5 py-0.5 text-[#934336]">{MUC_DO[suCo.severity] ?? suCo.severity}</strong>
                    {suCo.title}
                  </span>
                  <span className={`shrink-0 font-bold ${suCo.elapsedMinutes >= suCo.slaMinutes ? "text-[#a34637]" : "text-[#7b8881]"}`}>
                    {suCo.elapsedMinutes >= suCo.slaMinutes ? "quá hạn" : `${suCo.elapsedMinutes}/${suCo.slaMinutes} phút`}
                  </span>
                </li>
              ))}
              {item.suCo.length === 0 ? <li className="text-xs text-[#849089]">Không có sự cố nào đang mở.</li> : null}
            </ul>
          </div>

          <div className="rounded-xl border border-[#e3e9e5] p-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-black text-[#30443b]">Dự án & sự kiện</h3>
              <Link href={vao("du-an-su-kien")} className="text-xs font-black text-[#183f34] underline underline-offset-4">Mở dự án</Link>
            </div>
            {item.duAn ? (
              <div className="mt-2 text-xs text-[#4a5952]">
                <p className="font-black text-[#2c3e36]">{item.duAn.event.name}</p>
                <div className="mt-2 flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#e7ece9]">
                    <div className="h-full rounded-full bg-[#e4b37b]" style={{ width: `${item.tienDo ?? 0}%` }} />
                  </div>
                  <span className="font-black">{item.tienDo ?? 0}%</span>
                </div>
                <p className="mt-2">
                  Ngân sách {item.duAn.event.committedBillion.toLocaleString("vi-VN")} / {item.duAn.event.budgetBillion.toLocaleString("vi-VN")} tỷ ·{" "}
                  <span className={goiTre.length > 0 ? "font-black text-[#a34637]" : ""}>{goiTre.length} gói trễ hạn</span> ·{" "}
                  {item.deNghiDuAn.length} đề nghị chờ duyệt
                </p>
              </div>
            ) : (
              <p className="mt-2 text-xs text-[#849089]">Cơ sở chưa có sự kiện nào.</p>
            )}
          </div>

          <div className="rounded-xl border border-[#e3e9e5] p-4">
            <h3 className="text-sm font-black text-[#30443b]">Chờ giám đốc quyết ({so(item.viecCho)})</h3>
            <ul className="mt-2 space-y-1.5 text-xs">
              <li className="flex justify-between gap-2">
                <Link href="/erp#quyet-dinh-giam-doc" className="text-[#183f34] underline underline-offset-4">Ca lệch tiền</Link>
                <span className="font-black">{so(item.caLech.length)}</span>
              </li>
              <li className="flex justify-between gap-2">
                <Link href={vao("doi-tac-nha-cung-ung")} className="text-[#183f34] underline underline-offset-4">Hoá đơn nhà cung cấp vượt mức</Link>
                <span className="font-black">{so(item.hoaDonCho.length)}</span>
              </li>
              <li className="flex justify-between gap-2">
                <Link href={vao("du-an-su-kien")} className="text-[#183f34] underline underline-offset-4">Đề nghị đổi dự án</Link>
                <span className="font-black">{so(item.deNghiDuAn.length)}</span>
              </li>
              <li className="flex justify-between gap-2">
                <Link href={vao("sop-dien-tap")} className="text-[#183f34] underline underline-offset-4">Đánh giá mở cửa</Link>
                <span className="font-black">{so(item.sop.length)}</span>
              </li>
            </ul>
            <p className="mt-3 text-xs text-[#849089]">Còn phải trả nhà cung cấp: <strong className="text-[#2c3e36]">{tienDu(item.conPhaiTra)}</strong></p>
          </div>

          <div className="rounded-xl border border-[#e3e9e5] p-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-black text-[#30443b]">Dự báo 7 ngày tới</h3>
              <Link href={vao("bao-cao")} className="text-xs font-black text-[#183f34] underline underline-offset-4">Mở báo cáo</Link>
            </div>
            {duBao.length > 0 ? (
              <ul className="mt-2 space-y-1 text-xs">
                {duBao.map((ngay) => (
                  <li key={ngay.ngay} className="flex justify-between gap-2">
                    <span className="text-[#6e7b75]">{ngay.thu} {ngay.ngay.slice(8, 10)}/{ngay.ngay.slice(5, 7)}</span>
                    <span className="font-black text-[#2c3e36]">
                      {so(ngay.thap)}–{so(ngay.cao)} khách
                      {ngay.daDat > 0 ? <span className="font-normal text-[#849089]"> · {so(ngay.daDat)} đã đặt</span> : null}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-xs text-[#849089]">Chưa đủ số liệu để dự báo.</p>
            )}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-black text-[#30443b]">Mọi nghiệp vụ tại {site.shortName}</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {nghiepVu.map((module) => (
              <Link
                key={module.id}
                href={vao(module.id)}
                className="inline-flex min-h-10 items-center rounded-full border border-[#cbd7d1] px-3 text-xs font-bold text-[#183f34] hover:border-[#183f34] hover:bg-[#f3f7f5]"
              >
                {module.name}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
