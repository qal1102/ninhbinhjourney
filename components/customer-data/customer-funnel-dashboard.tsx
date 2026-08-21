import type { CustomerFunnelReport } from "@/domain/customer-funnel";

const SOURCE_LABELS = {
  estimate: "ước lượng T11a",
  customer: "khách hàng cung cấp",
  measured: "đo thực tế",
} as const;

function percent(value: number, total: number) {
  return total === 0 ? "—" : `${Math.round((value / total) * 1000) / 10}%`;
}

export function CustomerFunnelDashboard({ report }: { report: CustomerFunnelReport }) {
  const stages = [
    ["Quét QR nguồn", report.totals.qrScans, "marketing_qr_scans"],
    ["Mở trang", report.totals.pageViews, "customer_events.page_viewed"],
    ["Giữ chỗ", report.totals.holds, "customer_booking_holds"],
    ["Payment mô phỏng", report.totals.payments, "customer_payment_attempts"],
    ["Check-in chấp nhận", report.totals.acceptedGateScans, "erp_gate_scan_events"],
  ] as const;
  return (
    <section className="rounded-3xl border border-[#d8e0db] bg-white p-5 shadow-sm sm:p-7" data-testid="customer-funnel-dashboard">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-[#607b70]">A5 · Phễu hợp nhất · 7 ngày gần nhất</p>
      <h2 className="mt-2 text-3xl font-black text-[#203a30]">Từ QR marketing tới cổng soát vé</h2>
      <p className="mt-3 max-w-4xl text-sm leading-6 text-[#66756e]">Mỗi số đọc từ bảng nguồn ghi ngay dưới nó. Đây là số đếm sự kiện, không phải số người duy nhất; profile chưa gắn nguồn được để riêng thay vì phân bổ đoán.</p>

      {report.truncation.capped ? (
        <p className="mt-4 rounded-2xl border border-[#e3c07f] bg-[#fdf6e7] p-4 text-sm leading-6 text-[#7a5a1d]" data-testid="customer-funnel-truncated">
          <strong>Số liệu bị cắt — đừng đọc như số đủ.</strong> Các nguồn sau chạm trần {report.truncation.rowLimit.toLocaleString("vi-VN")} dòng mỗi lần đọc nên phần cũ hơn đã bị bỏ lại: {report.truncation.sources.join(", ")}. Hãy thu hẹp cửa sổ ngày hoặc chuyển sang truy vấn tổng hợp trước khi báo cáo con số này.
        </p>
      ) : null}

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {stages.map(([label, value, source], index) => (
          <article key={label} className="rounded-2xl bg-[#f3f6f4] p-4">
            <p className="text-xs text-[#718078]">{label}</p>
            <p className="mt-2 text-3xl font-black text-[#203a30]">{value.toLocaleString("vi-VN")}</p>
            <p className="mt-1 text-xs font-bold text-[#587066]">{index === 0 ? "mốc đầu" : percent(value, stages[index - 1][1])} · {source}</p>
          </article>
        ))}
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <article className="rounded-xl border border-[#e0e6e2] p-4"><p className="text-xs text-[#718078]">Profile gắn được QR nguồn</p><strong className="mt-2 block text-2xl">{report.reconciliation.attributedProfiles}</strong></article>
        <article className="rounded-xl border border-[#e0e6e2] p-4"><p className="text-xs text-[#718078]">Profile chưa gắn nguồn</p><strong className="mt-2 block text-2xl">{report.reconciliation.unattributedProfiles}</strong></article>
        <article className="rounded-xl border border-[#e0e6e2] p-4"><p className="text-xs text-[#718078]">Scan offline đã đồng bộ</p><strong className="mt-2 block text-2xl">{report.reconciliation.offlineSyncedItems}</strong></article>
        <article className="rounded-xl border border-[#e0e6e2] p-4"><p className="text-xs text-[#718078]">Phán quyết offline sai lệch</p><strong className={`mt-2 block text-2xl ${report.reconciliation.offlineDivergedItems ? "text-[#9a4938]" : "text-[#28604c]"}`}>{report.reconciliation.offlineDivergedItems}</strong></article>
      </div>

      <div className="mt-6 overflow-x-auto">
        <table className="min-w-[760px] w-full text-left text-sm">
          <thead><tr className="border-b border-[#dfe6e2] text-xs uppercase tracking-[0.1em] text-[#6a7b73]"><th className="py-3 pr-4">Nguồn / campaign</th><th>QR</th><th>Mở trang</th><th>Hold</th><th>Payment</th><th>Check-in</th></tr></thead>
          <tbody>{report.sources.length ? report.sources.map((row) => <tr key={row.sourceId} className="border-b border-[#edf1ef]"><td className="py-3 pr-4"><strong>{row.sourceLabel}</strong><span className="mt-1 block text-xs text-[#7a8881]">{row.campaignLabel}</span></td><td>{row.qrScans}</td><td>{row.pageViews}</td><td>{row.holds}</td><td>{row.payments}</td><td>{row.acceptedGateScans}</td></tr>) : <tr><td colSpan={6} className="py-8 text-center text-[#7a8881]">Chưa có sự kiện thật trong cửa sổ 7 ngày.</td></tr>}</tbody>
        </table>
      </div>

      <div className="mt-7">
        <h3 className="text-xl font-black text-[#203a30]">Bán và check-in so với sức chứa từng slot</h3>
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          {report.slots.length ? report.slots.map((slot) => <article key={slot.slotId} className="rounded-2xl border border-[#dfe6e2] p-4 text-sm"><div className="flex flex-wrap justify-between gap-2"><strong>{new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(slot.startsAt))}</strong><span className="rounded-full bg-[#edf3ef] px-2 py-1 text-xs font-bold">{SOURCE_LABELS[slot.capacitySourceKind]} · v{slot.thresholdVersion}</span></div><div className="mt-3 grid grid-cols-4 gap-2 text-center"><div><span className="text-xs text-[#718078]">Công suất</span><strong className="block">{slot.capacitySnapshot}</strong></div><div><span className="text-xs text-[#718078]">Giữ + bán</span><strong className="block">{slot.reservedEntries}</strong></div><div><span className="text-xs text-[#718078]">Đã bán</span><strong className="block">{slot.soldEntries}</strong></div><div><span className="text-xs text-[#718078]">Check-in</span><strong className="block">{slot.checkedInEntries}</strong></div></div></article>) : <p className="rounded-2xl border border-dashed border-[#c7d2cc] p-6 text-sm text-[#7a8881]">Chưa có slot CUS-06 trong cửa sổ này.</p>}
        </div>
      </div>
    </section>
  );
}
