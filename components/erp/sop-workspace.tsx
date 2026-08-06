import type { ErpSite } from "@/domain/erp";
import {
  sopFailureCounts,
  type SopCheckResult,
  type SopOpeningStatus,
  type SopWorkspaceData,
} from "@/domain/erp-sop";
import type { CurrentErpUser } from "@/lib/erp/demo-session";
import {
  SopOpeningDecisionForm,
  SopOpeningSubmissionForm,
} from "./sop-opening-forms";

const STATUS_LABEL: Record<SopOpeningStatus, string> = {
  submitted: "Chờ quyết định",
  go: "GO · Được mở cửa",
  "no-go": "NO-GO · Chưa mở cửa",
  "risk-accepted": "Mở cửa có chấp nhận rủi ro",
};

const STATUS_STYLE: Record<SopOpeningStatus, string> = {
  submitted: "border-[#ddc46c] bg-[#fff8dc] text-[#785e0e]",
  go: "border-[#9ac4ac] bg-[#e7f4eb] text-[#246344]",
  "no-go": "border-[#df9c90] bg-[#ffebe7] text-[#943c2d]",
  "risk-accepted": "border-[#d9a269] bg-[#fff0df] text-[#8a4c11]",
};

const RESULT_LABEL: Record<SopCheckResult, string> = {
  pass: "Đạt",
  fail: "Không đạt",
  "not-applicable": "Không áp dụng",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00+07:00`));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function MissingSopStore({ site }: { site: ErpSite }) {
  return (
    <section className="rounded-3xl border border-[#e1d2ac] bg-[#fffaf0] p-5 sm:p-8">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-[#8a6b27]">
        Kho SOP chưa sẵn sàng · {site.shortName}
      </p>
      <h2 className="mt-2 text-2xl font-black text-[#493c28] sm:text-3xl">
        Chưa thể đọc cổng Go/No-Go
      </h2>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-[#70634f]">
        Hệ thống không dựng checklist hoặc quyết định giả ở chế độ này. Hãy kiểm
        tra kết nối kho ERP rồi tải lại trang.
      </p>
    </section>
  );
}

export function SopWorkspace({
  site,
  user,
  data,
}: {
  site: ErpSite;
  user: CurrentErpUser;
  data: SopWorkspaceData | null;
}) {
  if (!data) return <MissingSopStore site={site} />;
  const assessment = data.assessment;
  const resultByItem = new Map(
    (assessment?.results ?? []).map((result) => [result.itemId, result]),
  );
  const counts = assessment
    ? sopFailureCounts(data.items, assessment.results)
    : { totalFailures: 0, criticalFailures: 0 };
  const canSubmit =
    user.role === "manager" &&
    (!assessment || assessment.status === "no-go");

  return (
    <div className="space-y-5">
      <header className="overflow-hidden rounded-3xl bg-[#3f3028] text-white shadow-[0_20px_55px_rgba(63,48,40,0.16)]">
        <div className="grid gap-6 p-5 sm:p-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#dccbbf]">
              Cổng mở cửa hằng ngày · {site.shortName}
            </p>
            <h2 className="mt-2 max-w-3xl text-3xl font-black leading-tight sm:text-5xl">
              An toàn chưa đạt thì chưa gọi là GO
            </h2>
            <p className="mt-4 max-w-3xl text-sm leading-6 text-[#e5d9d1]">
              Quản lý cơ sở xác nhận từng mục. Giám đốc là người quyết định cuối;
              mọi ngoại lệ phải để lại trách nhiệm bằng văn bản.
            </p>
          </div>
          <div className="rounded-2xl border border-white/15 bg-white/10 p-5 backdrop-blur">
            <p className="text-xs text-[#d8c9bf]">Ngày vận hành</p>
            <p className="mt-1 text-2xl font-black">
              {formatDate(data.businessDate)}
            </p>
            <span
              className={`mt-3 inline-flex rounded-full border px-3 py-1.5 text-xs font-black ${
                assessment
                  ? STATUS_STYLE[assessment.status]
                  : "border-white/20 bg-white/10 text-white"
              }`}
            >
              {assessment ? STATUS_LABEL[assessment.status] : "Chưa nộp checklist"}
            </span>
          </div>
        </div>
      </header>

      <aside className="rounded-2xl border border-[#dfb6aa] bg-[#fff3ef] p-4 text-sm leading-6 text-[#7b493e] sm:px-5">
        <strong>Demo operational summary — requires organizational approval.</strong>{" "}
        Các mục dưới đây là bản tóm tắt vận hành có mã và nguồn trang từ Playbook
        Tam Chúc, chưa phải chính sách đã được tổ chức phê duyệt hoặc ngày hiệu
        lực chính thức.
      </aside>

      {data.items.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-[#b8c6bf] bg-white px-5 py-10 text-center text-sm text-[#75817b]">
          Cơ sở chưa có checklist mở cửa được cấu hình.
        </section>
      ) : null}

      {assessment ? (
        <section className="overflow-hidden rounded-3xl border border-[#d8e0db] bg-white shadow-sm">
          <div className="grid gap-4 border-b border-[#e4eae7] p-5 sm:p-6 lg:grid-cols-[1fr_auto] lg:items-start">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-[#edf3f0] px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-[#526b60]">
                  {assessment.assessmentCode}
                </span>
                <span className={`rounded-full border px-2.5 py-1 text-[11px] font-black ${STATUS_STYLE[assessment.status]}`}>
                  {STATUS_LABEL[assessment.status]}
                </span>
              </div>
              <h3 className="mt-3 text-2xl font-black text-[#203a30]">
                Checklist của {assessment.submittedByDisplayName}
              </h3>
              <p className="mt-1 text-sm text-[#68776f]">
                Gửi lúc {formatDateTime(assessment.submittedAt)} · phiên bản {assessment.version}
              </p>
            </div>
            <dl className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-[#f3f6f4] p-3 text-center">
                <dt className="text-[11px] text-[#6d7b74]">Không đạt</dt>
                <dd className="mt-1 text-2xl font-black text-[#8e493b]">
                  {counts.totalFailures}
                </dd>
              </div>
              <div className="rounded-xl bg-[#fff0ec] p-3 text-center">
                <dt className="text-[11px] text-[#7d5d55]">Trọng yếu</dt>
                <dd className="mt-1 text-2xl font-black text-[#a14234]">
                  {counts.criticalFailures}
                </dd>
              </div>
            </dl>
          </div>

          <div className="divide-y divide-[#e7ece9]">
            {data.items.map((item) => {
              const result = resultByItem.get(item.id);
              return (
                <div key={item.id} className="grid gap-3 p-4 sm:p-5 lg:grid-cols-[1fr_auto] lg:items-start">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-black text-[#2e463b]">
                        {item.sortOrder}. {item.title}
                      </p>
                      <span className="rounded-full bg-[#edf3f0] px-2 py-0.5 text-[10px] font-black text-[#526b60]">
                        {item.sopCode}
                      </span>
                      {item.isCritical ? (
                        <span className="rounded-full bg-[#ffebe7] px-2 py-0.5 text-[10px] font-black text-[#943c2d]">
                          Trọng yếu
                        </span>
                      ) : null}
                    </div>
                    {result?.note ? (
                      <p className="mt-1 text-sm leading-6 text-[#65736c]">
                        {result.note}
                      </p>
                    ) : null}
                    {result?.evidenceReference ? (
                      <p className="mt-1 text-xs text-[#7a8781]">
                        Bằng chứng: {result.evidenceReference}
                      </p>
                    ) : null}
                  </div>
                  <span
                    className={`w-fit rounded-full px-3 py-1 text-xs font-black ${
                      result?.result === "pass"
                        ? "bg-[#e7f4eb] text-[#246344]"
                        : result?.result === "fail"
                          ? "bg-[#ffebe7] text-[#943c2d]"
                          : "bg-[#f0f2f1] text-[#637169]"
                    }`}
                  >
                    {result ? RESULT_LABEL[result.result] : "Chưa có kết quả"}
                  </span>
                </div>
              );
            })}
          </div>

          {assessment.status === "submitted" ? (
            <div className="border-t border-[#e4eae7] p-5 sm:p-6">
              <p className="mb-4 text-sm font-bold text-[#74633f]">
                Hạn quyết định {formatDateTime(assessment.decisionDueAt)} · SLA
                demo {assessment.decisionSlaMinutes} phút, cần tổ chức xác nhận.
              </p>
              {user.role === "director" ? (
                <SopOpeningDecisionForm
                  siteId={site.id}
                  assessment={assessment}
                  criticalFailures={counts.criticalFailures}
                />
              ) : (
                <p className="rounded-xl border border-[#e0d2af] bg-[#fffaf0] px-4 py-3 text-sm leading-6 text-[#74633f]">
                  Đã chuyển giám đốc quyết định. Checklist không thể sửa trong lúc
                  đang chờ để giữ nguyên hồ sơ mà giám đốc đang xem.
                </p>
              )}
            </div>
          ) : null}

          {assessment.status !== "submitted" ? (
            <div className="border-t border-[#e4eae7] bg-[#fbfcfb] p-5 sm:p-6">
              <p className="text-sm font-black text-[#334b40]">
                {assessment.decisionByDisplayName} · {assessment.decidedAt ? formatDateTime(assessment.decidedAt) : "—"}
              </p>
              <p className="mt-2 text-sm leading-6 text-[#65736c]">
                {assessment.decisionNote}
              </p>
              {assessment.riskAcceptance ? (
                <div className="mt-3 rounded-xl border border-[#d9a269] bg-[#fff3e5] p-4 text-sm leading-6 text-[#7f4b1c]">
                  <strong>Văn bản chấp nhận rủi ro:</strong>{" "}
                  {assessment.riskAcceptance}
                </div>
              ) : null}
            </div>
          ) : null}
        </section>
      ) : (
        <section className="rounded-2xl border border-[#d8e0db] bg-white p-5 shadow-sm sm:p-6">
          <h3 className="text-xl font-black text-[#203a30]">
            Chưa có checklist ngày {formatDate(data.businessDate)}
          </h3>
          <p className="mt-2 text-sm leading-6 text-[#65736c]">
            Cổng mở cửa chưa có trạng thái. Không được hiểu “chưa nộp” là GO.
          </p>
        </section>
      )}

      {canSubmit && data.items.length > 0 ? (
        <section className="rounded-3xl border border-[#cfdad5] bg-[#f7faf8] p-4 sm:p-6">
          <div className="mb-4">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#547064]">
              {assessment ? "Khắc phục và gửi lại" : "Quản lý cơ sở xác nhận"}
            </p>
            <h3 className="mt-1 text-2xl font-black text-[#203a30]">
              Trả lời đủ {data.items.length} hạng mục
            </h3>
          </div>
          <SopOpeningSubmissionForm
            siteId={site.id}
            businessDate={data.businessDate}
            items={data.items}
            assessment={assessment}
          />
        </section>
      ) : null}

      <section className="rounded-2xl border border-[#d8e0db] bg-white p-5 shadow-sm sm:p-6">
        <h3 className="text-lg font-black text-[#203a30]">Thư viện checklist có nguồn</h3>
        <div className="mt-4 space-y-2">
          {data.items.map((item) => (
            <details key={item.id} className="rounded-xl border border-[#e0e6e3] p-4">
              <summary className="cursor-pointer list-none font-black text-[#334b40]">
                {item.sopCode} · {item.title}
              </summary>
              <p className="mt-2 text-sm leading-6 text-[#65736c]">
                {item.operationalSummary}
              </p>
              <dl className="mt-3 grid gap-2 text-xs text-[#6f7c76] sm:grid-cols-2">
                <div>
                  <dt className="font-black text-[#455c51]">Nguồn</dt>
                  <dd className="mt-1">{item.sourceReference}</dd>
                </div>
                <div>
                  <dt className="font-black text-[#455c51]">Phê duyệt / hiệu lực</dt>
                  <dd className="mt-1">
                    Chưa phê duyệt · chưa có ngày hiệu lực · phiên bản {item.version}
                  </dd>
                </div>
              </dl>
            </details>
          ))}
        </div>
      </section>

      {data.auditEvents.length > 0 ? (
        <section className="rounded-2xl border border-[#d8e0db] bg-white p-5 shadow-sm sm:p-6">
          <h3 className="text-lg font-black text-[#203a30]">Lịch sử quyết định</h3>
          <p className="mt-1 text-sm text-[#6a7871]">
            Nhật ký chỉ thêm mới; không cho sửa hoặc xoá sự kiện cũ.
          </p>
          <ol className="mt-4 divide-y divide-[#e6ebe8]">
            {data.auditEvents.map((event) => (
              <li key={event.id} className="grid gap-1 py-3 sm:grid-cols-[1fr_auto] sm:items-center">
                <p className="text-sm font-bold text-[#334b40]">
                  {event.actorDisplayName} · {event.fromStatus ?? "chưa có"} → {event.toStatus}
                </p>
                <time className="text-xs text-[#77847e]" dateTime={event.createdAt}>
                  {formatDateTime(event.createdAt)}
                </time>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {data.recentAssessments.length > 1 ? (
        <section className="rounded-2xl border border-[#d8e0db] bg-white p-5 shadow-sm sm:p-6">
          <h3 className="text-lg font-black text-[#203a30]">Các ngày gần đây</h3>
          <div className="mt-3 divide-y divide-[#e6ebe8]">
            {data.recentAssessments.slice(1).map((entry) => (
              <div key={entry.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                <span className="font-bold text-[#334b40]">
                  {formatDate(entry.businessDate)} · {entry.assessmentCode}
                </span>
                <span className={`rounded-full border px-2.5 py-1 text-[11px] font-black ${STATUS_STYLE[entry.status]}`}>
                  {STATUS_LABEL[entry.status]}
                </span>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
