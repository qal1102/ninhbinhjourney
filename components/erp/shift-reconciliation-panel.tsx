import Link from "next/link";
import type { ErpSite } from "@/domain/erp";
import { erpDataOriginLabel } from "@/domain/erp-data-origin";
import type { ShiftCloseStatus } from "@/domain/erp-shift-close";
import {
  SHIFT_SCAN_RESULT_KEYS,
  SHIFT_SCAN_RESULT_LABELS,
  type ShiftDifference,
  type ShiftGapLevel,
} from "@/domain/erp-shift-reconciliation";
import type { ShiftReconciliationView } from "@/lib/erp/shift-reconciliation-repository";

/**
 * TC-21 — bảng đối soát cuối ca.
 *
 * Màn hình này **chỉ đọc**: không một nút nào ở đây ghi ra cơ sở dữ liệu. Việc
 * của nó là trả lời đúng một câu — *con số nhân viên khai lúc chốt ca có khớp
 * với con số hệ thống đếm được không* — rồi để người quản lý tự quyết.
 *
 * Con số chênh lệch nằm ngay khối đầu tiên, chữ to. Giấu nó trong một ô nhỏ
 * cuối trang thì màn hình này không còn lý do tồn tại.
 */

const STATUS_LABELS: Readonly<Record<ShiftCloseStatus, string>> = Object.freeze({
  submitted: "Chờ quản lý",
  "manager-returned": "Quản lý trả lại",
  "manager-approved": "Chờ kế toán",
  "accounting-review": "Kế toán đang kiểm tra",
  posted: "Đã ghi sổ",
  "exception-pending-director": "Chuyển giám đốc",
  "director-approved": "Ngoại lệ đã duyệt",
  "director-rejected": "Giám đốc trả lại",
});

function formatVnd(value: number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatCount(value: number) {
  return new Intl.NumberFormat("vi-VN").format(value);
}

function formatDate(value: string) {
  const parsed = new Date(`${value}T00:00:00+07:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(parsed);
}

function formatMoment(value: Date) {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(value);
}

const GAP_STYLE: Readonly<Record<ShiftGapLevel, { box: string; tag: string; label: string }>> =
  Object.freeze({
    alert: {
      box: "border-[#e2b3a8] bg-[#fff2ee]",
      tag: "bg-[#f6d9d1] text-[#8d4234]",
      label: "Cần xử lý ngay",
    },
    watch: {
      box: "border-[#e0cfa0] bg-[#fffaef]",
      tag: "bg-[#f4e5bd] text-[#7a5a1c]",
      label: "Nên xem lại",
    },
    info: {
      box: "border-[#cbd8d2] bg-[#f7faf8]",
      tag: "bg-[#dfe9e4] text-[#3f5a4f]",
      label: "Ghi chú",
    },
  });

function DifferenceRow({ difference }: { difference: ShiftDifference }) {
  const format = difference.unit === "vnd" ? formatVnd : formatCount;
  const unreadable = difference.counted === null || difference.delta === null;
  const delta = difference.delta ?? 0;
  // Màu chỉ mã hoá đúng một điều: hệ thống đếm được nhiều hơn phần khai. Đó là
  // chiều duy nhất có nghĩa xấu — tiền đã vào tay người trực mà không nằm
  // trong tờ khai.
  const tone = unreadable
    ? "text-[#6e7b75]"
    : delta > 0
      ? "text-[#8d4234]"
      : "text-[#20342c]";
  return (
    <div className="grid gap-3 rounded-2xl border border-[#dde5e0] bg-white p-4 sm:grid-cols-[1fr_auto] sm:items-center">
      <div className="min-w-0">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-[#4d7767]">
          {difference.label}
        </p>
        <p className="mt-1 text-sm font-medium text-[#3f5048]">
          Nhân viên khai{" "}
          <strong className="font-black text-[#20342c]">
            {difference.declared === null ? "—" : format(difference.declared)}
          </strong>
          {" · "}hệ thống đếm được{" "}
          <strong className="font-black text-[#20342c]">
            {difference.counted === null ? "chưa đọc được" : format(difference.counted)}
          </strong>
        </p>
        <p className="mt-2 text-xs leading-5 text-[#6e7b75]">{difference.caveat}</p>
      </div>
      <p className={`text-2xl font-black sm:text-right sm:text-3xl ${tone}`}>
        {unreadable ? "—" : `${delta > 0 ? "+" : delta < 0 ? "−" : ""}${format(Math.abs(delta))}`}
      </p>
    </div>
  );
}

export function ShiftReconciliationPanel({
  site,
  moduleId,
  view,
}: {
  site: ErpSite;
  moduleId: string;
  view: ShiftReconciliationView;
}) {
  const header = (
    <header>
      <p className="text-xs font-black uppercase tracking-[0.17em] text-[#477565]">
        Đối soát cuối ca · {site.shortName}
      </p>
      <h2 className="mt-2 text-2xl font-black text-[#20342c]">
        Số khai lúc chốt ca so với số hệ thống đếm được
      </h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-[#5f7068]">
        Lượt quét ở cổng và khoản thu tại điểm được cộng lại theo đúng khung giờ của
        ca. Bảng này chỉ đọc, không ghi thêm gì vào hồ sơ ca.
      </p>
    </header>
  );

  if (!view.selected) {
    return (
      <section className="grid gap-4">
        {header}
        <p className="rounded-2xl border border-dashed border-[#ccd9d3] bg-white p-5 text-sm font-medium text-[#5f7068]">
          {view.emptyReason}
        </p>
      </section>
    );
  }

  const { shift, reconciliation, scanUnavailableReason, cashUnavailableReason, counterCashUnavailableReason } =
    view.selected;
  const { window, scans, scanBreakdown, cash, differences, gaps } = reconciliation;

  return (
    <section className="grid gap-4">
      {header}

      {view.options.length > 1 ? (
        <nav
          aria-label="Chọn ca cần đối soát"
          className="flex flex-wrap gap-2 rounded-2xl border border-[#dde5e0] bg-white p-3"
        >
          {view.options.map((option) => {
            const active = option.id === shift.id;
            return (
              <Link
                key={option.id}
                href={`/erp/${site.id}/${moduleId}?ca=${option.id}`}
                aria-current={active ? "true" : undefined}
                className={`min-h-11 rounded-xl px-3 py-2 text-xs font-black ${
                  active
                    ? "bg-[#183f34] text-white"
                    : "border border-[#ced8d1] bg-white text-[#3f5048]"
                }`}
              >
                {option.shiftCode}
                <span className="ml-2 font-medium opacity-80">
                  {formatDate(option.businessDate)}
                </span>
              </Link>
            );
          })}
        </nav>
      ) : null}

      <div className="rounded-2xl border border-[#dde5e0] bg-[#f7faf8] p-4">
        <p className="flex flex-wrap items-center gap-2 text-sm font-black text-[#20342c]">
          <span>
            {shift.shiftCode} · {shift.shiftLabel} · {shift.station}
          </span>
          {erpDataOriginLabel(shift.dataOrigin) ? (
            <span className="rounded-full bg-[#e8eae2] px-2 py-1 text-[11px] font-black text-[#5c6250]">
              {erpDataOriginLabel(shift.dataOrigin)}
            </span>
          ) : null}
        </p>
        {erpDataOriginLabel(shift.dataOrigin) ? (
          <p className="mt-1 text-xs font-medium text-[#5f7068]">
            Ca này là hồ sơ gieo sẵn lúc dựng hệ thống, không phải ca thật. Chênh lệch
            bên dưới chỉ cho thấy cổng chưa có lượt quét nào trong khung giờ ấy.
          </p>
        ) : null}
        <p className="mt-1 text-xs font-medium text-[#5f7068]">
          Ngày làm việc {formatDate(shift.businessDate)} · người gửi {shift.submittedByName}{" "}
          · {STATUS_LABELS[shift.status]}
        </p>
        {window.dayKeys.length > 0 ? (
          <p className="mt-1 text-xs font-medium text-[#5f7068]">
            Khung giờ đối soát: {formatMoment(window.from)} → {formatMoment(window.to)} (giờ
            Việt Nam)
          </p>
        ) : null}
      </div>

      <div className="grid gap-3">
        <h3 className="text-sm font-black uppercase tracking-[0.16em] text-[#4d7767]">
          Chênh lệch
        </h3>
        {differences.map((difference) => (
          <DifferenceRow key={difference.id} difference={difference} />
        ))}
      </div>

      {gaps.length > 0 ? (
        <ul className="grid gap-3">
          {gaps.map((gap) => {
            const style = GAP_STYLE[gap.level];
            return (
              <li key={gap.id} className={`rounded-2xl border p-4 ${style.box}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-1 text-[11px] font-black ${style.tag}`}
                  >
                    {style.label}
                  </span>
                  <p className="text-sm font-black text-[#20342c]">{gap.title}</p>
                </div>
                <p className="mt-2 text-xs leading-5 text-[#4a5a52]">{gap.detail}</p>
              </li>
            );
          })}
        </ul>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-2xl border border-[#dde5e0] bg-white p-4">
          <h3 className="text-sm font-black text-[#20342c]">Lượt quét trong ca</h3>
          {!scans || !scanBreakdown ? (
            <p className="mt-2 text-sm font-medium text-[#5f7068]">
              {scanUnavailableReason ||
                "Chưa đọc được nhật ký quét cổng của ca này."}
            </p>
          ) : scans.total === 0 ? (
            <p className="mt-2 text-sm font-medium text-[#5f7068]">
              Suốt khung giờ này chưa có lượt quét nào ở cổng. Chưa có gì để đối soát,
              chứ không phải hệ thống đếm ra số không.
            </p>
          ) : (
            <>
              <dl className="mt-3 grid grid-cols-3 gap-2">
                {[
                  ["Cho vào", scans.admitted],
                  ["Chưa thu tiền", scans.paymentDue],
                  ["Từ chối", scans.refused],
                ].map(([label, value]) => (
                  <div
                    key={String(label)}
                    className="rounded-xl border border-[#e6ece8] bg-[#f8faf8] p-3"
                  >
                    <dt className="text-xs font-medium text-[#6e7b75]">{label}</dt>
                    <dd className="mt-1 text-2xl font-black text-[#20342c]">
                      {formatCount(Number(value))}
                    </dd>
                  </div>
                ))}
              </dl>
              <ul className="mt-3 grid gap-1">
                {SHIFT_SCAN_RESULT_KEYS.filter((key) => scanBreakdown[key] > 0).map(
                  (key) => (
                    <li
                      key={key}
                      className="flex items-center justify-between gap-3 border-b border-dashed border-[#e6ece8] pb-1 text-xs font-medium text-[#4a5a52] last:border-0"
                    >
                      <span>{SHIFT_SCAN_RESULT_LABELS[key]}</span>
                      <span className="font-black text-[#20342c]">
                        {formatCount(scanBreakdown[key])}
                      </span>
                    </li>
                  ),
                )}
              </ul>
            </>
          )}
        </article>

        <article className="rounded-2xl border border-[#dde5e0] bg-white p-4">
          <h3 className="text-sm font-black text-[#20342c]">Tiền thu tại điểm</h3>
          {!cash ? (
            <p className="mt-2 text-sm font-medium text-[#5f7068]">
              {cashUnavailableReason ||
                "Chưa đọc được khoản thu tại cổng của ca này."}
            </p>
          ) : cash.count === 0 ? (
            <p className="mt-2 text-sm font-medium text-[#5f7068]">
              Ca này chưa có khoản thu tại điểm nào vào sổ.
              {cash.outstandingCount > 0
                ? ` Cơ sở còn ${formatCount(cash.outstandingCount)} đơn khách chọn trả tại điểm chưa ai thu, tổng ${formatVnd(cash.outstandingVnd)}.`
                : ""}
            </p>
          ) : (
            <>
              <p className="mt-2 text-3xl font-black text-[#20342c]">
                {formatVnd(cash.totalVnd)}
              </p>
              <p className="mt-1 text-xs font-medium text-[#6e7b75]">
                {formatCount(cash.count)} khoản, thu ngay tại cổng
              </p>
              <ul className="mt-3 grid gap-2">
                {cash.collectors.map((collector) => (
                  <li
                    key={collector.accountId}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#e6ece8] bg-[#f8faf8] px-3 py-2 text-xs"
                  >
                    <span className="font-bold text-[#20342c]">
                      {collector.displayName}
                    </span>
                    <span className="font-medium text-[#4a5a52]">
                      {formatCount(collector.count)} khoản ·{" "}
                      <strong className="font-black text-[#20342c]">
                        {formatVnd(collector.totalVnd)}
                      </strong>
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </article>

        {/* QA-ERP-POS-04 — tiền bán vé tại quầy có phiếu, theo từng người bán. */}
        <article className="rounded-2xl border border-[#dde5e0] bg-white p-4">
          <h3 className="text-sm font-black text-[#20342c]">Tiền bán tại quầy</h3>
          {!reconciliation.counterCash ? (
            <p className="mt-2 text-sm font-medium text-[#5f7068]">
              {counterCashUnavailableReason || "Chưa đọc được tiền bán tại quầy của ca này."}
            </p>
          ) : reconciliation.counterCash.count +
              reconciliation.counterCash.qrCount +
              reconciliation.counterCash.voidedCount ===
            0 ? (
            <p className="mt-2 text-sm font-medium text-[#5f7068]">
              Ca này chưa có phiếu bán vé tại quầy nào.
            </p>
          ) : (
            <>
              <p className="mt-2 text-3xl font-black text-[#20342c]">
                {formatVnd(reconciliation.counterCash.totalVnd)}
              </p>
              <p className="mt-1 text-xs font-medium text-[#6e7b75]">
                tiền mặt phải có trong quỹ · {formatCount(reconciliation.counterCash.count)} phiếu
              </p>
              {reconciliation.counterCash.qrCount > 0 ? (
                <p className="mt-2 text-sm font-medium text-[#3f5048]">
                  Chuyển khoản QR{" "}
                  <strong className="font-black text-[#20342c]">
                    {formatVnd(reconciliation.counterCash.qrTotalVnd)}
                  </strong>{" "}
                  · {formatCount(reconciliation.counterCash.qrCount)} phiếu, tiền nằm ở tài khoản ngân hàng
                </p>
              ) : null}
              {reconciliation.counterCash.voidedCount > 0 ? (
                <p className="mt-1 text-xs font-medium text-[#6e7b75]">
                  {formatCount(reconciliation.counterCash.voidedCount)} phiếu đã huỷ, hoàn{" "}
                  {formatVnd(reconciliation.counterCash.voidedVnd)}
                </p>
              ) : null}
              <ul className="mt-3 grid gap-2">
                {reconciliation.counterCash.sellers.map((seller) => (
                  <li
                    key={seller.accountId}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#e6ece8] bg-[#f8faf8] px-3 py-2 text-xs"
                  >
                    <span className="font-bold text-[#20342c]">{seller.displayName}</span>
                    <span className="font-medium text-[#4a5a52]">
                      {formatCount(seller.count)} phiếu · tiền mặt{" "}
                      <strong className="font-black text-[#20342c]">{formatVnd(seller.totalVnd)}</strong>
                      {seller.qrTotalVnd > 0 ? (
                        <>
                          {" "}
                          · QR <strong className="font-black text-[#20342c]">{formatVnd(seller.qrTotalVnd)}</strong>
                        </>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </article>
      </div>
    </section>
  );
}
