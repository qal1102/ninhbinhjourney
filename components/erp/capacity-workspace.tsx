import type { ErpSite } from "@/domain/erp";
import {
  capacityAlertLevel,
  capacityLoadPercent,
  type CapacityAlertLevel,
  type CapacityOwnerRole,
  type CapacitySourceKind,
  type CapacityWorkspaceData,
} from "@/domain/erp-capacity";
import type { CurrentErpUser } from "@/lib/erp/demo-session";
import { CapacityThresholdEditor } from "./capacity-threshold-editor";

const LEVEL_LABEL: Record<CapacityAlertLevel, string> = {
  green: "Bình thường",
  yellow: "Chuẩn bị",
  orange: "Hạn chế luồng",
  red: "Dừng luồng",
};

const LEVEL_STYLE: Record<
  CapacityAlertLevel,
  { badge: string; bar: string; panel: string }
> = {
  green: {
    badge: "border-[#9ac4ac] bg-[#e7f4eb] text-[#246344]",
    bar: "bg-[#3e8a61]",
    panel: "border-[#b9d9c5] bg-[#f1f8f3]",
  },
  yellow: {
    badge: "border-[#dcc66e] bg-[#fff8d9] text-[#765d0b]",
    bar: "bg-[#c59d20]",
    panel: "border-[#e4d58e] bg-[#fffbeb]",
  },
  orange: {
    badge: "border-[#dfad76] bg-[#fff0df] text-[#8a4c11]",
    bar: "bg-[#d17724]",
    panel: "border-[#e7bd92] bg-[#fff6eb]",
  },
  red: {
    badge: "border-[#df9c90] bg-[#ffebe7] text-[#943c2d]",
    bar: "bg-[#c8523d]",
    panel: "border-[#e8b6ad] bg-[#fff3f0]",
  },
};

const SOURCE_LABEL: Record<CapacitySourceKind, string> = {
  estimate: "ước-lượng",
  customer: "khách-cung-cấp",
  measured: "đo-thực-tế",
};

const OWNER_LABEL: Record<CapacityOwnerRole, string> = {
  employee: "Nhân viên trực",
  manager: "Quản lý cơ sở",
  director: "Giám đốc",
};

function formatTime(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function MissingCapacityStore({ site }: { site: ErpSite }) {
  return (
    <section className="rounded-3xl border border-[#e1d2ac] bg-[#fffaf0] p-5 sm:p-8">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-[#8a6b27]">
        Kho cấu hình chưa sẵn sàng · {site.shortName}
      </p>
      <h2 className="mt-2 text-2xl font-black text-[#493c28] sm:text-3xl">
        Chưa thể đọc ngưỡng sức chứa
      </h2>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-[#70634f]">
        Màn hình không tự tạo số liệu thay thế. Hãy kiểm tra kết nối kho ERP rồi
        tải lại trang; các ngưỡng chỉ được hiển thị khi có nguồn và công thức đã
        lưu.
      </p>
    </section>
  );
}

export function CapacityWorkspace({
  site,
  user,
  data,
}: {
  site: ErpSite;
  user: CurrentErpUser;
  data: CapacityWorkspaceData | null;
}) {
  if (!data) return <MissingCapacityStore site={site} />;

  const primaryCapacity = data.thresholds.reduce(
    (smallest, threshold) =>
      smallest === null || threshold.hourlyCapacity < smallest
        ? threshold.hourlyCapacity
        : smallest,
    null as number | null,
  );

  return (
    <div className="space-y-5">
      <header className="overflow-hidden rounded-3xl bg-[#173f34] text-white shadow-[0_20px_55px_rgba(23,63,52,0.16)]">
        <div className="grid gap-6 p-5 sm:p-8 lg:grid-cols-[1.3fr_0.7fr] lg:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#b8d8cb]">
              Nhịp vận hành theo giờ · {site.shortName}
            </p>
            <h2 className="mt-2 max-w-3xl text-3xl font-black leading-tight sm:text-5xl">
              Biết điểm nghẽn trước khi phải dừng luồng
            </h2>
            <p className="mt-4 max-w-3xl text-sm leading-6 text-[#d4e5de]">
              Sức chứa được suy ra từ số phương tiện, số chỗ và thời gian một
              vòng. Mọi con số đều kèm nguồn; ngưỡng ước lượng không được xem là
              số đo thực tế.
            </p>
          </div>
          <dl className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur">
              <dt className="text-xs text-[#c9ddd5]">Lượt cổng trong giờ</dt>
              <dd className="mt-1 text-3xl font-black">
                {data.acceptedEntriesThisHour.toLocaleString("vi-VN")}
              </dd>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur">
              <dt className="text-xs text-[#c9ddd5]">Năng lực nhỏ nhất</dt>
              <dd className="mt-1 text-3xl font-black">
                {primaryCapacity?.toLocaleString("vi-VN") ?? "—"}
              </dd>
              <p className="mt-1 text-[11px] text-[#c9ddd5]">khách/giờ</p>
            </div>
          </dl>
        </div>
        <div className="border-t border-white/10 bg-black/10 px-5 py-3 text-xs leading-5 text-[#d6e4de] sm:px-8">
          Khung {formatTime(data.windowStartedAt)}–{formatTime(data.windowEndsAt)} ·
          lần nhận gần nhất {data.lastAcceptedScanAt ? formatDateTime(data.lastAcceptedScanAt) : "chưa có"}
        </div>
      </header>

      <aside className="rounded-2xl border border-[#d9c98f] bg-[#fff9df] p-4 text-sm leading-6 text-[#66551d] sm:px-5">
        <strong>Tín hiệu đầu vào hiện tại là proxy:</strong> số lượt check-in được
        T8 chấp nhận trong giờ. Đây không phải số người đang có mặt, cảm biến tại
        điểm nghẽn hay dữ liệu thời gian thực; cần thay bằng số đo tại bến/cổng khi
        hạ tầng đo sẵn sàng.
      </aside>

      {data.thresholds.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-[#b8c6bf] bg-white px-5 py-10 text-center text-sm text-[#75817b]">
          Cơ sở chưa có ngưỡng sức chứa được cấu hình.
        </section>
      ) : (
        <div className="space-y-5">
          {data.thresholds.map((threshold) => {
            const loadPercent = capacityLoadPercent(
              data.acceptedEntriesThisHour,
              threshold.hourlyCapacity,
            );
            const activeLevel = capacityAlertLevel(loadPercent, threshold);
            const activeStyle = LEVEL_STYLE[activeLevel];

            return (
              <article
                key={threshold.id}
                className="overflow-hidden rounded-3xl border border-[#d8e0db] bg-white shadow-sm"
              >
                <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[1fr_auto] lg:items-start">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-[#edf3f0] px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-[#526b60]">
                        {threshold.thresholdCode}
                      </span>
                      <span className="rounded-full border border-[#c4d4cc] px-2.5 py-1 text-[11px] font-black text-[#49675a]">
                        nguồn: {SOURCE_LABEL[threshold.sourceKind]}
                      </span>
                      <span
                        className={`rounded-full border px-2.5 py-1 text-[11px] font-black ${activeStyle.badge}`}
                      >
                        {LEVEL_LABEL[activeLevel]}
                      </span>
                    </div>
                    <h3 className="mt-3 text-2xl font-black text-[#203a30] sm:text-3xl">
                      {threshold.bottleneckName}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-[#64736c]">
                      {threshold.sourceNote}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-[#eff5f2] px-4 py-3 lg:min-w-44 lg:text-right">
                    <p className="text-xs text-[#697970]">Tải proxy hiện tại</p>
                    <p className="mt-1 text-3xl font-black text-[#183f34]">
                      {loadPercent.toLocaleString("vi-VN")}%
                    </p>
                  </div>
                </div>

                <div className="border-y border-[#e4eae7] bg-[#fbfcfb] px-5 py-5 sm:px-6">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-[#718078]">
                    Công thức vật lý · theo giờ
                  </p>
                  <p className="mt-2 text-lg font-black leading-7 text-[#24473a] sm:text-xl">
                    {threshold.vehicleCount.toLocaleString("vi-VN")} phương tiện ×{" "}
                    {threshold.seatsPerVehicle.toLocaleString("vi-VN")} chỗ × 60 ÷{" "}
                    {threshold.roundTripMinutes.toLocaleString("vi-VN")} phút ={" "}
                    {threshold.hourlyCapacity.toLocaleString("vi-VN")} khách/giờ
                  </p>
                  <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-[#e1e9e5]">
                    <div
                      className={`h-full rounded-full ${activeStyle.bar}`}
                      style={{ width: `${Math.min(loadPercent, 100)}%` }}
                    />
                  </div>
                  <div className="mt-2 grid grid-cols-3 text-[11px] font-bold text-[#697970]">
                    <span>{threshold.watchPercent}% · chuẩn bị</span>
                    <span className="text-center">
                      {threshold.restrictPercent}% · hạn chế
                    </span>
                    <span className="text-right">
                      {threshold.stopPercent}% · dừng
                    </span>
                  </div>
                </div>

                <div className="grid gap-4 p-5 sm:p-6 lg:grid-cols-[1.15fr_0.85fr]">
                  <section>
                    <h4 className="text-sm font-black uppercase tracking-[0.12em] text-[#536b60]">
                      Phản ứng theo bốn mức
                    </h4>
                    <div className="mt-3 space-y-2">
                      {threshold.responseRules.map((rule) => {
                        const isActive = rule.level === activeLevel;
                        return (
                          <div
                            key={rule.level}
                            className={`rounded-xl border p-3 ${
                              isActive
                                ? LEVEL_STYLE[rule.level].panel
                                : "border-[#e1e7e4] bg-white"
                            }`}
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="text-sm font-black text-[#29463a]">
                                {LEVEL_LABEL[rule.level]}
                                {isActive ? " · mức hiện tại" : ""}
                              </p>
                              <p className="text-xs font-bold text-[#697970]">
                                {OWNER_LABEL[rule.ownerRole]}
                                {rule.slaMinutes ? ` · ${rule.slaMinutes} phút` : " · liên tục"}
                              </p>
                            </div>
                            <p className="mt-1.5 text-sm leading-6 text-[#5f6d66]">
                              {rule.actionText}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                  <section className="space-y-3">
                    <div className="rounded-xl border border-[#dce5e0] bg-[#f7faf8] p-4 text-sm leading-6 text-[#5f6d66]">
                      <p className="font-black text-[#29463a]">Kiểm soát nguồn</p>
                      <p className="mt-1">
                        Hiệu lực {new Intl.DateTimeFormat("vi-VN").format(new Date(threshold.effectiveFrom))} · phiên bản {threshold.version}
                      </p>
                      <p>
                        Cập nhật bởi {threshold.updatedByDisplayName} lúc {formatDateTime(threshold.updatedAt)}
                      </p>
                    </div>
                    {user.role === "director" ? (
                      <CapacityThresholdEditor siteId={site.id} threshold={threshold} />
                    ) : (
                      <p className="rounded-xl border border-dashed border-[#c9d5cf] px-4 py-3 text-xs leading-5 text-[#6d7973]">
                        Chỉ giám đốc được thay đổi giả định. Quản lý và nhân viên
                        xem cùng một ngưỡng đã lưu.
                      </p>
                    )}
                  </section>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <section className="rounded-2xl border border-[#d8e0db] bg-white p-5 shadow-sm sm:p-6">
        <h3 className="text-lg font-black text-[#203a30]">Lịch sử cấu hình</h3>
        <p className="mt-1 text-sm text-[#6a7871]">
          Nhật ký chỉ thêm mới; không cho sửa hoặc xoá sự kiện cũ.
        </p>
        <div className="mt-4 divide-y divide-[#e6ebe8]">
          {data.auditEvents.map((event) => (
            <div key={event.id} className="grid gap-1 py-3 sm:grid-cols-[1fr_auto] sm:items-center">
              <p className="text-sm font-bold text-[#334b40]">
                {event.action === "threshold.updated" ? "Cập nhật ngưỡng" : "Khởi tạo ngưỡng"} · {event.actorDisplayName}
              </p>
              <time className="text-xs text-[#77847e]" dateTime={event.createdAt}>
                {formatDateTime(event.createdAt)}
              </time>
            </div>
          ))}
          {data.auditEvents.length === 0 ? (
            <p className="py-5 text-sm text-[#77847e]">Chưa có sự kiện cấu hình.</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
