import Link from "next/link";
import type { ErpSite } from "@/domain/erp";
import type { AccountingJournal } from "@/domain/erp-accounting";
import type { ShiftCloseRecord } from "@/domain/erp-shift-close";
import type { SopPendingDecision } from "@/domain/erp-sop";
import type { SupplierApInvoice } from "@/domain/erp-supplier-ap";
import type { WorkdayRecord } from "@/domain/erp-workday";
import { partitionErpDataOrigin } from "@/domain/erp-data-origin";
import type { CurrentErpUser } from "@/lib/erp/demo-session";
import type { IncidentCase } from "@/lib/erp/incident-repository";
import type { ProjectChangeRequestWithSite } from "@/lib/erp/project-repository";
import type { DirectorTicketOverview } from "@/lib/erp/ticket-overview-repository";
import { DirectorTicketPanel } from "./director-ticket-panel";
import { ShiftCloseDirectorQueue } from "./shift-close-workflow";

type Props = {
  user: CurrentErpUser;
  sites: readonly ErpSite[];
  records: readonly ShiftCloseRecord[];
  workdays: readonly WorkdayRecord[];
  journals: readonly AccountingJournal[];
  supplierApInvoices: readonly SupplierApInvoice[];
  escalatedIncidents: readonly IncidentCase[];
  pendingProjectChangeRequests: readonly ProjectChangeRequestWithSite[];
  pendingSopDecisions: readonly SopPendingDecision[];
  ticketOverview: DirectorTicketOverview | null;
};

const changeKindLabels: Record<ProjectChangeRequestWithSite["kind"], string> = {
  budget: "Đổi ngân sách",
  deadline: "Đổi deadline",
  scope: "Đổi phạm vi",
};

function formatVnd(value: number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value);
}

function journalValue(journal: AccountingJournal) {
  return journal.lines.reduce((total, line) => total + line.debitVnd, 0);
}

/**
 * Nói ra còn bao nhiêu hồ sơ mẫu, thay vì giấu.
 *
 * Giám đốc thấy 0 bút toán mà biết sổ vẫn còn mấy bút toán mẫu thì con số 0
 * kia mới đọc được. Giấu đi thì chính sự vênh giữa "trang chủ nói 0" và "vào
 * sổ thấy đầy hồ sơ" làm người ta nghi màn hình hỏng.
 */
function describeSampleRows(
  shiftCloses: number,
  journals: number,
  supplierInvoices: number,
) {
  const parts: string[] = [];
  if (shiftCloses > 0) {
    parts.push(`${shiftCloses.toLocaleString("vi-VN")} hồ sơ ca`);
  }
  if (journals > 0) {
    parts.push(`${journals.toLocaleString("vi-VN")} bút toán`);
  }
  if (supplierInvoices > 0) {
    parts.push(
      `${supplierInvoices.toLocaleString("vi-VN")} hóa đơn nhà cung cấp`,
    );
  }
  if (parts.length === 0) return null;
  if (parts.length === 1) return parts[0];
  return parts.slice(0, -1).join(", ") + " và " + parts[parts.length - 1];
}

function latestUpdatedAt(
  records: readonly ShiftCloseRecord[],
  workdays: readonly WorkdayRecord[],
  journals: readonly AccountingJournal[],
  supplierApInvoices: readonly SupplierApInvoice[],
  pendingSopDecisions: readonly SopPendingDecision[],
) {
  const values = [
    ...records.map((record) => record.updatedAt),
    ...workdays.map((record) => record.updatedAt),
    ...journals.map((journal) => journal.updatedAt),
    ...supplierApInvoices.map((invoice) => invoice.updatedAt),
    ...pendingSopDecisions.map((assessment) => assessment.submittedAt),
  ]
    .map((value) => Date.parse(value))
    .filter(Number.isFinite);
  if (values.length === 0) return "Chưa có bản ghi";
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(Math.max(...values)));
}

export function ExecutiveDashboard({
  user,
  sites,
  records: allRecords,
  workdays,
  journals: allJournals,
  supplierApInvoices: allSupplierApInvoices,
  escalatedIncidents,
  pendingProjectChangeRequests,
  pendingSopDecisions,
  ticketOverview,
}: Props) {
  // ERP-FAKE-03. Luật chia đôi, giữ cứng: **mọi con số trên trang này đều gọi
  // giám đốc ra quyết định**, nên chúng chỉ được đếm hồ sơ thật. Hồ sơ gieo
  // mẫu và cặn chạy thử vẫn ở nguyên trong màn hình nghiệp vụ, kèm nhãn, để
  // nhân viên còn cái mà tập — nhưng không tấm nào được lọt vào ô tiền ở đây.
  //
  // Đo trên production 05/09/2026: 14 hồ sơ ca, 11 bút toán, 5 hóa đơn nhà
  // cung cấp, không hàng nào là nghiệp vụ thật. Trước đợt này trang chủ khai
  // hết cả ba con số ấy như tiền thật.
  const { real: records, sample: sampleRecords } =
    partitionErpDataOrigin(allRecords);
  const { real: journals, sample: sampleJournals } =
    partitionErpDataOrigin(allJournals);
  const { real: supplierApInvoices, sample: sampleSupplierApInvoices } =
    partitionErpDataOrigin(allSupplierApInvoices);
  const sampleNote = describeSampleRows(
    sampleRecords.length,
    sampleJournals.length,
    sampleSupplierApInvoices.length,
  );
  const siteShortNameById = new Map(
    sites.map((site) => [site.id, site.shortName]),
  );
  // Mốc "bây giờ" của trang cố ý lấy từ **toàn bộ** bản ghi, kể cả hồ sơ mẫu:
  // nó là cái đồng hồ để đo phiếu công việc quá hạn, không phải con số ai đó
  // đọc để ra quyết định. Lọc nó theo nguồn gốc thì ngày nào chưa có ca thật,
  // đồng hồ tụt về 0 và mọi phiếu quá hạn biến mất khỏi màn hình.
  const referenceNow = [
    ...allRecords.map((record) => record.updatedAt),
    ...workdays.map((record) => record.updatedAt),
    ...allJournals.map((journal) => journal.updatedAt),
    ...allSupplierApInvoices.map((invoice) => invoice.updatedAt),
    ...pendingSopDecisions.map((assessment) => assessment.submittedAt),
  ].reduce((latest, value) => {
    const timestamp = Date.parse(value);
    return Number.isFinite(timestamp) && timestamp > latest
      ? timestamp
      : latest;
  }, 0);
  const businessDates = records
    .map((record) => record.businessDate)
    .sort((left, right) => right.localeCompare(left));
  const latestBusinessDate = businessDates[0] ?? null;
  const currentShiftRecords = latestBusinessDate
    ? records.filter((record) => record.businessDate === latestBusinessDate)
    : [];
  const ticketsSold = currentShiftRecords.reduce(
    (total, record) => total + record.ticketsSold,
    0,
  );
  const declaredRevenueVnd = currentShiftRecords.reduce(
    (total, record) =>
      total + record.amounts.grossVnd - record.amounts.refundVnd,
    0,
  );
  const declaredDifferenceVnd = currentShiftRecords.reduce(
    (total, record) => total + Math.abs(record.differenceVnd),
    0,
  );
  const activeWorkdays = workdays.filter((record) =>
    ["checked-in", "in-progress", "manager-returned"].includes(record.status),
  );
  const submittedWorkdays = workdays.filter(
    (record) => record.status === "submitted",
  );
  const overdueWorkdays = workdays.filter(
    (record) =>
      record.status !== "approved" &&
      Number.isFinite(Date.parse(record.dueAt)) &&
      Date.parse(record.dueAt) < referenceNow,
  );
  const postedJournals = journals.filter(
    (journal) => journal.status === "posted",
  );
  const postedValueVnd = postedJournals.reduce(
    (total, journal) => total + journalValue(journal),
    0,
  );
  const pendingShiftCloseDecisions = records.filter(
    (record) => record.status === "exception-pending-director",
  );
  const directorSupplierAp = supplierApInvoices.filter(
    (invoice) =>
      invoice.status === "director-exception" || invoice.status === "posted",
  );
  const pendingSupplierDecisions = directorSupplierAp.filter(
    (invoice) =>
      invoice.status === "director-exception" &&
      invoice.ownerRole === "director",
  );
  const pendingSupplierDecisionValue = pendingSupplierDecisions.reduce(
    (total, invoice) => total + invoice.totalVnd,
    0,
  );
  const postedSupplierAp = directorSupplierAp.filter(
    (invoice) => invoice.status === "posted",
  );
  const postedSupplierPayable = postedSupplierAp.reduce(
    (total, invoice) => total + invoice.totalVnd,
    0,
  );
  const directorDecisionCount =
    pendingShiftCloseDecisions.length +
    pendingSupplierDecisions.length +
    escalatedIncidents.length +
    pendingProjectChangeRequests.length +
    pendingSopDecisions.length;
  // "Cập nhật gần nhất" cũng là đồng hồ, không phải con số ra quyết định:
  // nó nói lần cuối kho dữ liệu này động đậy là khi nào.
  const asOf = latestUpdatedAt(
    allRecords,
    workdays,
    allJournals,
    allSupplierApInvoices,
    pendingSopDecisions,
  );

  // ERP-UX-01 — lịch sử của khối này, giữ lại vì nó giải thích một quyết định
  // dễ bị lật lại. Chỗ này từng tính `nextAction`: đúng MỘT việc nên làm
  // trước, xếp theo mức chặn nghiệp vụ. Ngày 21/09/2026 phép xếp hạng ấy
  // chuyển hẳn vào `domain/viec-dau-tien.ts` và hiện ở khối `ViecDauTienPanel`
  // trên cùng trang chủ — giữ cả hai thì trang nói ba lần cùng một câu.
  //
  // Lúc gộp mới đọc ra rằng bản trong domain xếp SAI: nó để quyết định SOP
  // xuống chót, trong khi `listPendingSopDecisions` đọc
  // `erp_sop_opening_assessments` — cổng mở cửa buổi sáng, chưa quyết thì cơ
  // sở chưa được mở. Thứ tự ở đây đúng và đã được chép sang, kèm cả mức "sự
  // cố đã quá SLA" đứng trước "sự cố còn trong hạn".
  return (
    <div className="min-w-0 space-y-5">
      <section className="min-w-0 overflow-hidden rounded-3xl bg-[#173f34] p-5 text-white sm:p-8">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          {/* ERP-UX-01: tiêu đề trang từng là một phép tính ("3 ca · 12 phiếu
              công việc"). Trang nhân viên mở đầu bằng **tên người đang đăng
              nhập** rồi mới tới số — vào là biết mình là ai, đang ở đâu. Vai
              giám đốc nay theo cùng khuôn đó; các con số cũ chuyển xuống hàng
              ô bên dưới, không mất đi. */}
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#b6d5ca]">
              Toàn vùng · {sites.length} cơ sở
              {latestBusinessDate ? ` · hồ sơ ca ${latestBusinessDate}` : ""}
            </p>
            <h1 className="mt-2 break-words text-3xl font-black leading-tight tracking-[-0.035em] sm:text-5xl">
              {user.name}
            </h1>
            <p className="mt-3 text-sm leading-6 text-white/65">
              {user.jobTitle} · {currentShiftRecords.length} ca ·{" "}
              {workdays.length.toLocaleString("vi-VN")} phiếu công việc
            </p>
          </div>
          <p className="shrink-0 text-xs font-bold text-[#c3ded4]">
            Cập nhật gần nhất {asOf}
          </p>
        </div>

        <div className="mt-7 grid grid-cols-2 gap-3 xl:grid-cols-4">
          {[
            [
              "Vé người trực khai lúc chốt ca",
              ticketsSold.toLocaleString("vi-VN"),
              `${currentShiftRecords.length} ca đã gửi`,
            ],
            [
              "Doanh thu ca khai báo",
              formatVnd(declaredRevenueVnd),
              `Chênh lệch ${formatVnd(declaredDifferenceVnd)}`,
            ],
            [
              "Công việc hiện trường",
              activeWorkdays.length.toLocaleString("vi-VN"),
              `${submittedWorkdays.length} chờ duyệt · ${overdueWorkdays.length} quá hạn`,
            ],
            [
              "Bút toán đã ghi sổ",
              postedJournals.length.toLocaleString("vi-VN"),
              `${formatVnd(postedValueVnd)} · NCC đã ghi nhận ${formatVnd(postedSupplierPayable)}`,
            ],
          ].map(([label, value, note]) => (
            <article
              key={label}
              className="min-w-0 rounded-xl border border-white/10 bg-white/[0.055] p-4"
            >
              <p className="text-xs leading-4 text-white/50">{label}</p>
              {/*
                KHÔNG dùng `break-words` ở con số. Đo thật ở khổ 390px: ô rộng
                ~138px, còn "266.200.000 đ" cần ~143px, nên `break-words` cắt
                đôi ngay giữa chữ số thành "266.200.00" / "0 đ" — đọc thoáng
                qua là một con số khác hẳn. Một con số tiền bị cắt đôi tệ hơn
                hẳn một con số nhỏ chữ. Nay số dài thì hạ cỡ chữ (vẫn trên sàn
                14px), và nếu có phải xuống dòng thì chỉ xuống ở khoảng trắng
                trước chữ "đ".
              */}
              <p
                className={[
                  "mt-2 font-black tracking-[-0.03em] sm:text-2xl",
                  String(value).length > 11
                    ? "text-base"
                    : String(value).length > 8
                      ? "text-lg"
                      : "text-xl",
                ].join(" ")}
              >
                {value}
              </p>
              <p className="mt-2 text-xs leading-4 text-[#b5d6ca]">
                {note}
              </p>
            </article>
          ))}
        </div>

        {/* Không giấu phần dữ liệu mẫu đi — xem `describeSampleRows` ở trên
            cho lý do. Cùng lối diễn đạt với bảng vé ngay bên dưới. */}
        {sampleNote ? (
          <p className="mt-4 rounded-xl border border-white/15 bg-white/[0.06] p-4 text-xs leading-5 text-[#d3e5dd]">
            Sổ còn <strong className="text-white">{sampleNote}</strong> gieo sẵn
            từ lúc dựng hệ thống. Chúng không được tính vào con số nào ở trên,
            cũng không lọt vào khối cần bạn quyết định. Nhân viên vẫn mở được để
            tập.
          </p>
        ) : null}
      </section>

      {/* ERP-UX-06d: câu hỏi đầu tiên của một người điều hành khu du lịch là
          "hôm nay bán được bao nhiêu vé". Trước đây trang này không trả lời
          được — muốn biết phải đi vào từng cơ sở rồi mở đúng một nghiệp vụ.
          Bảng dưới đây đếm thẳng từ vé đã phát hành, gộp cả bốn cơ sở. */}
      <DirectorTicketPanel overview={ticketOverview} />

      {/* Một màn hình, một hành động chính. Nếu không chỉ ra được hành động
          đó là gì thì màn hình chưa xong — luật ERP. */}
      {/*
        Khối này TỪNG mở đầu bằng "Việc cần làm trước tiên" kèm tiêu đề lớn và
        một nút hành động. Từ 21/09 phần ấy đã bị gỡ, cố ý: khối
        `ViecDauTienPanel` ở đầu trang nói đúng việc ấy, xếp hạng có lý do, và
        đứng trên cùng. Để cả hai thì trang chủ giám đốc nói **ba lần cùng một
        câu** — "1 ca lệch chờ anh quyết" hiện ở đầu trang, lại hiện ở đây, rồi
        lại hiện ở khối "Cần giám đốc quyết định" ngay dưới. Chủ dự án tự mở
        điện thoại ra và nói ngay là nhiều quá; đếm lại thì đúng là thừa hai
        lần. Giữ lại đúng phần khối này làm được mà khối kia không làm: đường
        đi thẳng vào chỗ làm việc.
      */}
      <section className="rounded-2xl border border-[#cfdcd5] bg-white p-5 shadow-sm sm:p-6">
        <p className="text-xs font-black uppercase tracking-[0.17em] text-[#477565]">
          Vào thẳng chỗ làm việc
        </p>

        {/* Luật ERP: "Trang chủ của mọi vai phải có đường vào công việc."
            Trước đây giám đốc đăng nhập xong không có một liên kết nào tới
            module — thanh nghiệp vụ chỉ hiện sau khi đã vào một cơ sở. Đây là
            dải chuyển cơ sở, cố ý **không** phải lưới thẻ đánh số kiểu "chọn
            một lối vào": khuôn đó đã bị chủ dự án loại hai lần. */}
        {/* Nhãn đứng riêng một dòng, nút xếp thành lưới. Trước đây nhãn nằm
            cùng hàng với nút nên ở khổ điện thoại hàng nút bắt đầu lệch mỗi
            nhóm một kiểu — nhóm này thụt vào sau chữ "Vào cơ sở:", nhóm kia
            thụt sau một nhãn dài hơn hẳn. Đường gạch ngang phía trên cũng bỏ:
            nó vốn để ngăn với phần tiêu đề đã gỡ, nay nó nằm ngay dưới một
            tiêu đề, không ngăn cách gì cả. */}
        <p className="mt-4 text-xs font-bold text-[#7a8781]">Vào cơ sở</p>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          {sites.map((site) => (
            <Link
              key={site.id}
              href={`/erp/${site.id}`}
              className="inline-flex min-h-11 items-center justify-center rounded-lg border border-[#d8e0db] px-3 text-sm font-bold text-[#34473f] transition hover:border-[#a8bbb2] hover:bg-[#f4f8f6] sm:justify-start"
            >
              {site.shortName}
            </Link>
          ))}
        </div>

        {/* Chủ dự án dùng thật rồi hỏi: "tao dùng account giám đốc có thấy
            chức năng quét đéo đâu?" — hỏi đúng. Màn hình quét nằm ở
            `/erp/{cơ sở}/check-in-khach`, tức phải qua ba tầng và một nhóm
            tên "Booking & Check-in" mới tới; không ai đi tìm một thứ mình
            không biết là có. Hai đường dưới đây đi thẳng tới hai màn hình
            có thể cầm điện thoại lên thử được ngay. */}
        {sites[0] ? (
          <div className="mt-4">
            <p className="text-xs font-bold text-[#7a8781]">
              Thử tận tay tại {sites[0].shortName}
            </p>
            <div className="mt-2 grid gap-2 sm:flex sm:flex-wrap">
            <Link
              href={`/erp/${sites[0].id}/check-in-khach`}
              className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[#183f34] px-3 text-sm font-bold text-white transition hover:bg-[#12332a] sm:justify-start"
            >
              Quét mã ở cổng →
            </Link>
            <Link
              href={`/erp/${sites[0].id}/ve-dat-cho`}
              className="inline-flex min-h-11 items-center justify-center rounded-lg border border-[#d8e0db] px-3 text-sm font-bold text-[#34473f] transition hover:border-[#a8bbb2] hover:bg-[#f4f8f6] sm:justify-start"
            >
              Bán vé, lập phiếu đoàn →
            </Link>
            </div>
            <p className="mt-2 text-xs text-[#8b968f]">
              Cơ sở nào cũng có hai màn hình này.
            </p>
          </div>
        ) : null}
      </section>

      <section
        id="quyet-dinh-giam-doc"
        className="scroll-mt-24 rounded-2xl border border-[#e2d4b9] bg-[#fffaf0] p-5 sm:p-6"
      >
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.17em] text-[#87642b]">
              Cần giám đốc quyết định
            </p>
            <h2 className="mt-2 text-2xl font-black text-[#3f3524]">
              {directorDecisionCount} hồ sơ đang chờ
            </h2>
            {/* Trước đây là `flex-wrap`: năm mục tự xuống dòng theo bề rộng
                nên ở khổ điện thoại cột thứ hai bắt đầu ở một chỗ khác mỗi
                hàng, trông như bị xô lệch. Lưới hai cột thì mọi hàng thẳng. */}
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs font-bold text-[#7a6c50]">
              <div>
                <dt className="inline text-[#3f3524]">
                  {pendingShiftCloseDecisions.length}
                </dt>{" "}
                <dd className="inline">ngoại lệ chốt ca</dd>
              </div>
              <div>
                <dt className="inline text-[#3f3524]">
                  {pendingSupplierDecisions.length}
                </dt>{" "}
                <dd className="inline">hồ sơ nhà cung cấp</dd>
              </div>
              <div>
                <dt className="inline text-[#3f3524]">
                  {escalatedIncidents.length}
                </dt>{" "}
                <dd className="inline">sự cố đã chuyển cấp</dd>
              </div>
              <div>
                <dt className="inline text-[#3f3524]">
                  {pendingProjectChangeRequests.length}
                </dt>{" "}
                <dd className="inline">yêu cầu đổi dự án</dd>
              </div>
              <div>
                <dt className="inline text-[#3f3524]">
                  {pendingSopDecisions.length}
                </dt>{" "}
                <dd className="inline">cổng Go/No-Go</dd>
              </div>
            </dl>
          </div>
          <Link
            href="/erp/finance"
            className="inline-flex min-h-11 items-center text-sm font-black text-[#76551f]"
          >
            Mở sổ đối soát →
          </Link>
        </div>
        {directorDecisionCount > 0 ? (
          <div className="mt-5 space-y-4">
            {pendingShiftCloseDecisions.length > 0 ? (
              <ShiftCloseDirectorQueue records={records} user={user} />
            ) : null}
            {pendingSopDecisions.length > 0 ? (
              <div className="space-y-2">
                <p className="text-sm font-black text-[#4c3c23]">
                  Cổng mở cửa chờ quyết định
                </p>
                {pendingSopDecisions.slice(0, 4).map((assessment) => (
                  <Link
                    key={assessment.id}
                    href={`/erp/${assessment.siteId}/sop-dien-tap`}
                    className="grid gap-2 rounded-xl border border-[#e5d7bb] bg-white p-4 transition hover:border-[#c9a768] sm:grid-cols-[1fr_auto] sm:items-center"
                  >
                    <div className="min-w-0">
                      <p className="font-black text-[#403727]">
                        {assessment.assessmentCode} ·{" "}
                        {siteShortNameById.get(assessment.siteId) ?? assessment.siteId}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-[#7b6d55]">
                        {assessment.submittedByDisplayName} ·{" "}
                        {assessment.criticalFailures} mục trọng yếu chưa đạt
                      </p>
                    </div>
                    <span
                      className={`w-fit shrink-0 rounded-full px-2.5 py-1 text-xs font-black ${
                        assessment.criticalFailures > 0
                          ? "bg-[#ffe4de] text-[#934336]"
                          : "bg-[#fff3d7] text-[#7a5923]"
                      }`}
                    >
                      {assessment.criticalFailures > 0 ? "Không thể GO" : "Chờ quyết định"}
                    </span>
                  </Link>
                ))}
              </div>
            ) : null}
            {pendingSupplierDecisions.length > 0 ? (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-black text-[#4c3c23]">
                    Ngoại lệ hóa đơn đã được chuyển cấp
                  </p>
                  <p className="text-sm font-black text-[#7a5923]">
                    {formatVnd(pendingSupplierDecisionValue)}
                  </p>
                </div>
                {pendingSupplierDecisions.slice(0, 4).map((invoice) => (
                  <Link
                    key={invoice.id}
                    href={`/erp/finance#ap-${invoice.id}`}
                    className="grid gap-2 rounded-xl border border-[#e5d7bb] bg-white p-4 transition hover:border-[#c9a768] sm:grid-cols-[1fr_auto] sm:items-center"
                  >
                    <div className="min-w-0">
                      <p className="font-black text-[#403727]">
                        {invoice.caseCode} · {invoice.supplier.name}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-[#7b6d55]">
                        HĐ {invoice.invoiceSeries}/{invoice.invoiceNumber} ·{" "}
                        {invoice.exceptionCodes.length} điểm vượt hồ sơ nguồn
                      </p>
                    </div>
                    <span className="font-black text-[#76551f]">
                      {formatVnd(invoice.totalVnd)}
                    </span>
                  </Link>
                ))}
              </div>
            ) : null}
            {escalatedIncidents.length > 0 ? (
              <div className="space-y-2">
                <p className="text-sm font-black text-[#4c3c23]">
                  Sự cố đã chuyển cấp
                </p>
                {escalatedIncidents.slice(0, 4).map((incident) => (
                  <Link
                    key={incident.id}
                    href={`/erp/${incident.siteId}/su-co`}
                    className="grid gap-2 rounded-xl border border-[#e5d7bb] bg-white p-4 transition hover:border-[#c9a768] sm:grid-cols-[1fr_auto] sm:items-center"
                  >
                    <div className="min-w-0">
                      <p className="font-black text-[#403727]">
                        {incident.title} ·{" "}
                        {siteShortNameById.get(incident.siteId) ?? incident.siteId}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-[#7b6d55]">
                        {incident.severity} · {incident.area}
                        {incident.escalationReason
                          ? ` · ${incident.escalationReason}`
                          : ""}
                      </p>
                    </div>
                    {/* ERP-UX-01: đồng hồ đếm ngược trước đây đứng một mình.
                        Thẻ vốn đã là liên kết, nhưng không có gì nói ra điều
                        đó — người đọc thấy "Còn 1 phút" mà không thấy lối
                        thoát. Luật ERP: đếm ngược phải đi kèm nút bấm. */}
                    <span className="flex shrink-0 items-center gap-2">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-black ${
                          incident.elapsedMinutes >= incident.slaMinutes
                            ? "bg-[#ffe4de] text-[#934336]"
                            : "bg-[#f3e6c8] text-[#7a5923]"
                        }`}
                      >
                        {incident.elapsedMinutes >= incident.slaMinutes
                          ? "Quá SLA"
                          : `Còn ${incident.slaMinutes - incident.elapsedMinutes} phút`}
                      </span>
                      <span className="whitespace-nowrap text-xs font-black text-[#76551f]">
                        Xử lý →
                      </span>
                    </span>
                  </Link>
                ))}
              </div>
            ) : null}
            {pendingProjectChangeRequests.length > 0 ? (
              <div className="space-y-2">
                <p className="text-sm font-black text-[#4c3c23]">
                  Yêu cầu đổi phạm vi dự án
                </p>
                {pendingProjectChangeRequests.slice(0, 4).map((request) => (
                  <Link
                    key={request.id}
                    href={`/erp/${request.siteId}/du-an-su-kien`}
                    className="grid gap-2 rounded-xl border border-[#e5d7bb] bg-white p-4 transition hover:border-[#c9a768] sm:grid-cols-[1fr_auto] sm:items-center"
                  >
                    <div className="min-w-0">
                      <p className="font-black text-[#403727]">
                        {changeKindLabels[request.kind]} ·{" "}
                        {siteShortNameById.get(request.siteId) ?? request.siteId}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-[#7b6d55]">
                        {request.summary} · {request.requestedByName}
                      </p>
                    </div>
                    {request.proposedBudgetBillion !== null ? (
                      <span className="shrink-0 font-black text-[#76551f]">
                        {request.proposedBudgetBillion} tỷ
                      </span>
                    ) : null}
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <p className="mt-5 text-sm leading-6 text-[#756852]">
            Không có ngoại lệ đã xác minh nào đang chờ giám đốc quyết định.
          </p>
        )}
      </section>

      <section className="overflow-hidden rounded-2xl border border-[#d8e0db] bg-white shadow-sm">
        <div className="flex flex-col justify-between gap-3 border-b border-[#e4e9e6] p-5 sm:flex-row sm:items-end sm:p-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.17em] text-[#477565]">
              Ma trận bốn cơ sở
            </p>
            <h2 className="mt-2 text-2xl font-black text-[#20342c]">
              Ca bán vé, công việc và sổ kế toán
            </h2>
          </div>
          <Link
            href="/erp/finance"
            className="inline-flex min-h-11 items-center text-sm font-black text-[#286655]"
          >
            Mở kiểm soát kế toán →
          </Link>
        </div>
        <div className="grid gap-px bg-[#e7ece9] sm:grid-cols-2">
          {sites.map((site) => {
            const siteShifts = currentShiftRecords.filter(
              (record) => record.siteId === site.id,
            );
            const siteTickets = siteShifts.reduce(
              (total, record) => total + record.ticketsSold,
              0,
            );
            const siteRevenue = siteShifts.reduce(
              (total, record) =>
                total + record.amounts.grossVnd - record.amounts.refundVnd,
              0,
            );
            const siteDifference = siteShifts.reduce(
              (total, record) => total + Math.abs(record.differenceVnd),
              0,
            );
            const siteWorkdays = workdays.filter(
              (record) => record.siteId === site.id,
            );
            const siteActive = siteWorkdays.filter((record) =>
              ["checked-in", "in-progress", "manager-returned"].includes(
                record.status,
              ),
            ).length;
            const siteSubmitted = siteWorkdays.filter(
              (record) => record.status === "submitted",
            ).length;
            const siteOverdue = siteWorkdays.filter(
              (record) =>
                record.status !== "approved" &&
                Number.isFinite(Date.parse(record.dueAt)) &&
                Date.parse(record.dueAt) < referenceNow,
            ).length;
            const siteJournals = journals.filter(
              (journal) => journal.siteId === site.id,
            );
            const sitePosted = siteJournals.filter(
              (journal) => journal.status === "posted",
            );
            const sitePostedValue = sitePosted.reduce(
              (total, journal) => total + journalValue(journal),
              0,
            );
            const siteSupplierAp = directorSupplierAp.filter(
              (invoice) => invoice.siteId === site.id,
            );
            const siteSupplierExceptions = siteSupplierAp.filter(
              (invoice) => invoice.status === "director-exception",
            ).length;
            const siteSupplierPayable = siteSupplierAp
              .filter((invoice) => invoice.status === "posted")
              .reduce((total, invoice) => total + invoice.totalVnd, 0);

            return (
              <Link
                key={site.id}
                href={`/erp/${site.id}`}
                className="min-w-0 bg-white p-5 transition hover:bg-[#f7faf8] sm:p-6"
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-black text-[#2b4037]">
                    {site.shortName}
                  </h3>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-black ${
                      siteOverdue > 0 ||
                      siteDifference > 0 ||
                      siteSupplierExceptions > 0
                        ? "bg-[#ffe4de] text-[#934336]"
                        : "bg-[#dff1e8] text-[#246249]"
                    }`}
                  >
                    {siteOverdue > 0 ||
                    siteDifference > 0 ||
                    siteSupplierExceptions > 0
                      ? "Cần kiểm tra"
                      : "Không có ngoại lệ"}
                  </span>
                </div>
                <dl className="mt-5 grid grid-cols-2 gap-4 text-xs sm:grid-cols-3">
                  <div>
                    <dt className="text-[#849089]">Vé trong ca</dt>
                    <dd className="mt-1 font-black">
                      {siteTickets.toLocaleString("vi-VN")}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[#849089]">Doanh thu khai báo</dt>
                    <dd className="mt-1 break-words font-black">
                      {formatVnd(siteRevenue)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[#849089]">Chênh lệch ca</dt>
                    <dd className="mt-1 break-words font-black">
                      {formatVnd(siteDifference)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[#849089]">Công việc</dt>
                    <dd className="mt-1 font-black">
                      {siteActive} đang làm · {siteSubmitted} chờ duyệt
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[#849089]">Quá hạn</dt>
                    <dd className="mt-1 font-black">{siteOverdue}</dd>
                  </div>
                  <div>
                    <dt className="text-[#849089]">Sổ kế toán</dt>
                    <dd className="mt-1 break-words font-black">
                      {sitePosted.length} bút toán ·{" "}
                      {formatVnd(sitePostedValue)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[#849089]">
                      Công nợ NCC đã ghi nhận
                    </dt>
                    <dd className="mt-1 break-words font-black">
                      {formatVnd(siteSupplierPayable)}
                    </dd>
                    {siteSupplierExceptions > 0 ? (
                      <p className="mt-1 text-[#934336]">
                        {siteSupplierExceptions} ngoại lệ cần quyết định
                      </p>
                    ) : null}
                  </div>
                </dl>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
