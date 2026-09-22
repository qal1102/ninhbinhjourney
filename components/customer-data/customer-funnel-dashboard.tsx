import type { CustomerFunnelReport } from "@/domain/customer-funnel";

/**
 * Bảng này nói với GIÁM ĐỐC, không nói với người viết mã.
 *
 * Trước 22/09/2026 mỗi con số in kèm **tên bảng trong cơ sở dữ liệu**
 * (`marketing_qr_scans`, `customer_events.page_viewed`…) và mấy mã việc nội
 * bộ (`A5`, `T11a`, `CUS-06`). Chủ dự án mở màn hình ra và hỏi đúng một câu:
 * *"tại sao toàn code ở trong đây vậy?"* — hỏi đúng. Luật của dự án đã cấm
 * chữ nội bộ lọt ra bề mặt người dùng, và giám đốc là người dùng.
 *
 * Nguồn của từng con số **vẫn phải nói ra** (không có nó thì không ai kiểm
 * được số ở đâu ra), chỉ là nói bằng tiếng Việt của người vận hành.
 */
const SOURCE_LABELS = {
  estimate: "ước lượng theo sức chứa",
  customer: "khách hàng cung cấp",
  measured: "đo thực tế",
} as const;

function percent(value: number, total: number) {
  return total === 0 ? "—" : `${Math.round((value / total) * 1000) / 10}%`;
}

export function CustomerFunnelDashboard({ report }: { report: CustomerFunnelReport }) {
  const stages = [
    ["Quét mã QR", report.totals.qrScans, "đếm từ máy quét mã"],
    ["Mở trang", report.totals.pageViews, "đếm từ lượt xem trang của khách"],
    ["Giữ chỗ", report.totals.holds, "đếm từ phiếu giữ chỗ"],
    ["Bấm thanh toán", report.totals.payments, "đếm từ lượt bấm thanh toán"],
    ["Qua cổng", report.totals.acceptedGateScans, "đếm từ máy soát vé ở cổng"],
  ] as const;
  return (
    <section className="rounded-3xl border border-[#d8e0db] bg-white p-5 shadow-sm sm:p-7" data-testid="customer-funnel-dashboard">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-[#607b70]">Bảy ngày gần nhất</p>
      <h2 className="mt-2 text-3xl font-black text-[#203a30]">Từ QR marketing tới cổng soát vé</h2>
      <p className="mt-3 max-w-4xl text-sm leading-6 text-[#66756e]">Mỗi con số ghi rõ đếm từ đâu ngay bên dưới. Đây là số lượt, không phải số người: một khách vào ba lần thì tính ba lượt. Khách chưa rõ đến từ đâu được để riêng một ô, không chia bừa vào chiến dịch nào.</p>

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
        <article className="rounded-xl border border-[#e0e6e2] p-4"><p className="text-xs text-[#718078]">Khách biết rõ đến từ đâu</p><strong className="mt-2 block text-2xl">{report.reconciliation.attributedProfiles}</strong></article>
        <article className="rounded-xl border border-[#e0e6e2] p-4"><p className="text-xs text-[#718078]">Khách chưa rõ đến từ đâu</p><strong className="mt-2 block text-2xl">{report.reconciliation.unattributedProfiles}</strong></article>
        <article className="rounded-xl border border-[#e0e6e2] p-4"><p className="text-xs text-[#718078]">Lượt quét lúc mất mạng, đã đồng bộ</p><strong className="mt-2 block text-2xl">{report.reconciliation.offlineSyncedItems}</strong></article>
        <article className="rounded-xl border border-[#e0e6e2] p-4"><p className="text-xs text-[#718078]">Lượt quét lúc mất mạng bị lệch kết quả</p><strong className={`mt-2 block text-2xl ${report.reconciliation.offlineDivergedItems ? "text-[#9a4938]" : "text-[#28604c]"}`}>{report.reconciliation.offlineDivergedItems}</strong></article>
      </div>

      <div className="mt-6 overflow-x-auto">
        <table className="min-w-[760px] w-full text-left text-sm">
          <thead><tr className="border-b border-[#dfe6e2] text-xs uppercase tracking-[0.1em] text-[#6a7b73]"><th className="py-3 pr-4">Khách đến từ đâu</th><th>Quét mã</th><th>Mở trang</th><th>Giữ chỗ</th><th>Thanh toán</th><th>Qua cổng</th></tr></thead>
          <tbody>{report.sources.length ? report.sources.map((row) => <tr key={row.sourceId} className="border-b border-[#edf1ef]"><td className="py-3 pr-4"><strong>{row.sourceLabel}</strong><span className="mt-1 block text-xs text-[#7a8881]">{row.campaignLabel}</span></td><td>{row.qrScans}</td><td>{row.pageViews}</td><td>{row.holds}</td><td>{row.payments}</td><td>{row.acceptedGateScans}</td></tr>) : <tr><td colSpan={6} className="py-8 text-center text-[#7a8881]">Bảy ngày qua chưa có lượt nào.</td></tr>}</tbody>
        </table>
      </div>

      <div className="mt-7">
        <h3 className="text-xl font-black text-[#203a30]">Từng khung giờ: bán được bao nhiêu, ai đã tới</h3>
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          {report.slots.length ? report.slots.map((slot) => <article key={slot.slotId} className="rounded-2xl border border-[#dfe6e2] p-4 text-sm"><div className="flex flex-wrap justify-between gap-2"><strong>{new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(slot.startsAt))}</strong><span className="rounded-full bg-[#edf3ef] px-2 py-1 text-xs font-bold">{SOURCE_LABELS[slot.capacitySourceKind]} · bản {slot.thresholdVersion}</span></div><div className="mt-3 grid grid-cols-4 gap-2 text-center"><div><span className="text-xs text-[#718078]">Công suất</span><strong className="block">{slot.capacitySnapshot}</strong></div><div><span className="text-xs text-[#718078]">Đang giữ</span><strong className="block">{slot.reservedEntries}</strong></div><div><span className="text-xs text-[#718078]">Đã bán</span><strong className="block">{slot.soldEntries}</strong></div><div><span className="text-xs text-[#718078]">Đã tới</span><strong className="block">{slot.checkedInEntries}</strong></div></div></article>) : <p className="rounded-2xl border border-dashed border-[#c7d2cc] p-6 text-sm text-[#7a8881]">Bảy ngày qua chưa có khung giờ nào mở bán.</p>}
        </div>
      </div>
    </section>
  );
}
