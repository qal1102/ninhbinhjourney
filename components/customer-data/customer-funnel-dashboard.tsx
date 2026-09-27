import Link from "next/link";
import { gomTheoDip, type CustomerFunnelReport, type KhoangPhieu, type LuaChonKhoang } from "@/domain/customer-funnel";
import { CAC_DIP } from "@/domain/lich-mua-vu";

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

/**
 * Tỷ lệ so với bước liền trước. Riêng bước qua cổng đếm theo lượt người vào,
 * còn bước trả tiền đếm theo đơn, nên phần trăm ở đó luôn quá 100% và chẳng
 * nói được gì; thay bằng bình quân lượt vào mỗi lần trả tiền.
 */
function tyLe(index: number, value: number, truoc: number) {
  if (index === 0) return "mốc đầu";
  // Có lượt vào thẳng bước này mà không qua bước trước (đặt từ đường dẫn
  // chia sẻ, lịch sử mẫu chỉ sinh đơn). Phần trăm quá 100% là vô nghĩa.
  if (index < 4 && value > truoc) return "nhiều hơn bước trước: có lượt vào thẳng";
  if (index === 4) {
    return truoc === 0 ? "—" : `bình quân ${(value / truoc).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} lượt vào mỗi lần trả tiền`;
  }
  return percent(value, truoc);
}

/** Nay so với kỳ trước, theo phần trăm. Kỳ trước bằng 0 thì không có phép so. */
function bienDong(nay: number, truoc: number) {
  if (truoc === 0) return "";
  const phan = Math.round(((nay - truoc) / truoc) * 100);
  return phan === 0 ? " · bằng kỳ trước" : ` · ${phan > 0 ? "tăng" : "giảm"} ${Math.abs(phan)}%`;
}

export function CustomerFunnelDashboard({
  report,
  khoang,
  luaChon,
}: {
  report: CustomerFunnelReport;
  khoang: KhoangPhieu;
  luaChon: readonly LuaChonKhoang[];
}) {
  const stages = [
    ["Quét mã QR", report.totals.qrScans, "đếm từ máy quét mã"],
    ["Mở trang", report.totals.pageViews, "đếm từ lượt xem trang của khách"],
    ["Giữ chỗ", report.totals.holds, "đếm từ phiếu giữ chỗ"],
    ["Bấm thanh toán", report.totals.payments, "đếm từ lượt bấm thanh toán"],
    ["Qua cổng", report.totals.acceptedGateScans, "vé đặt trên web, đếm từ máy soát vé"],
  ] as const;
  const soSanh = report.comparisonTotals;
  const tongSoSanh = soSanh ? Object.values(soSanh).reduce((a, b) => a + b, 0) : 0;
  const cacTong = soSanh
    ? [soSanh.qrScans, soSanh.pageViews, soSanh.holds, soSanh.payments, soSanh.acceptedGateScans]
    : [];
  return (
    <section className="rounded-3xl border border-[#d8e0db] bg-white p-5 shadow-sm sm:p-7" data-testid="customer-funnel-dashboard" id="phieu-khach">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-[#607b70]">
        {khoang.nhan}
        {report.hasDemoData ? " · gồm số liệu mẫu" : ""}
      </p>
      <h2 className="mt-2 text-3xl font-black text-[#203a30]">Từ QR marketing tới cổng soát vé</h2>
      <p className="mt-2 text-sm text-[#66756e]">{khoang.moTa}</p>

      <ChonKhoang khoang={khoang} luaChon={luaChon} />
      <p className="mt-3 max-w-4xl text-sm leading-6 text-[#66756e]">Mỗi con số ghi rõ đếm từ đâu ngay bên dưới. Đây là số lượt, không phải số người: một khách vào ba lần thì tính ba lượt. Khách chưa rõ đến từ đâu được để riêng một ô, không chia bừa vào chiến dịch nào.</p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {stages.map(([label, value, source], index) => (
          <article key={label} className="rounded-2xl bg-[#f3f6f4] p-4">
            <p className="text-xs text-[#718078]">{label}</p>
            <p className="mt-2 text-3xl font-black text-[#203a30]">{value.toLocaleString("vi-VN")}</p>
            <p className="mt-1 text-xs font-bold text-[#587066]">{tyLe(index, value, stages[index - 1]?.[1] ?? 0)} · {source}</p>
            {soSanh && tongSoSanh > 0 ? (
              <p className="mt-2 border-t border-[#dde5e0] pt-2 text-xs text-[#66756e]" data-testid="phieu-so-sanh">
                {khoang.soSanh.nhan}: {cacTong[index].toLocaleString("vi-VN")}{bienDong(value, cacTong[index])}
              </p>
            ) : null}
          </article>
        ))}
      </div>
      {soSanh && tongSoSanh === 0 ? (
        <p className="mt-3 text-sm text-[#66756e]" data-testid="phieu-so-sanh-trong">
          Chưa so được với {khoang.soSanh.nhan}: khoảng ấy chưa có lượt nào trong kho.
        </p>
      ) : null}
      {report.counterGateScans > 0 ? (
        <p className="mt-3 text-sm text-[#66756e]">
          Ngoài phễu này còn {report.counterGateScans.toLocaleString("vi-VN")} lượt qua cổng bằng vé mua tại quầy. Khách quầy không đi qua mã QR hay trang web nên không tính vào các bước trên.
        </p>
      ) : null}

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <article className="rounded-xl border border-[#e0e6e2] p-4"><p className="text-xs text-[#718078]">Khách biết rõ đến từ đâu</p><strong className="mt-2 block text-2xl">{report.reconciliation.attributedProfiles}</strong></article>
        <article className="rounded-xl border border-[#e0e6e2] p-4"><p className="text-xs text-[#718078]">Khách chưa rõ đến từ đâu</p><strong className="mt-2 block text-2xl">{report.reconciliation.unattributedProfiles}</strong></article>
        <article className="rounded-xl border border-[#e0e6e2] p-4"><p className="text-xs text-[#718078]">Lượt quét lúc mất mạng, đã đồng bộ</p><strong className="mt-2 block text-2xl">{report.reconciliation.offlineSyncedItems}</strong></article>
        <article className="rounded-xl border border-[#e0e6e2] p-4"><p className="text-xs text-[#718078]">Lượt quét lúc mất mạng bị lệch kết quả</p><strong className={`mt-2 block text-2xl ${report.reconciliation.offlineDivergedItems ? "text-[#9a4938]" : "text-[#28604c]"}`}>{report.reconciliation.offlineDivergedItems}</strong></article>
      </div>

      <div className="mt-6 overflow-x-auto">
        <table className="min-w-[760px] w-full text-left text-sm">
          <thead><tr className="border-b border-[#dfe6e2] text-xs uppercase tracking-[0.1em] text-[#6a7b73]"><th className="py-3 pr-4">Khách đến từ đâu</th><th>Quét mã</th><th>Mở trang</th><th>Giữ chỗ</th><th>Thanh toán</th><th>Qua cổng</th></tr></thead>
          <tbody>{report.sources.length ? report.sources.map((row) => <tr key={row.sourceId} className="border-b border-[#edf1ef]"><td className="py-3 pr-4"><strong>{row.sourceLabel}</strong><span className="mt-1 block text-xs text-[#7a8881]">{row.campaignLabel}</span></td><td>{row.qrScans}</td><td>{row.pageViews}</td><td>{row.holds}</td><td>{row.payments}</td><td>{row.acceptedGateScans}</td></tr>) : <tr><td colSpan={6} className="py-8 text-center text-[#7a8881]">Khoảng này chưa có lượt nào.</td></tr>}</tbody>
        </table>
      </div>

      <TheoDip report={report} />

      <div className="mt-7">
        <h3 className="text-xl font-black text-[#203a30]">Từng khung giờ: bán được bao nhiêu, ai đã tới</h3>
        {report.slotCount > report.slots.length ? (
          <p className="mt-1 text-sm text-[#66756e]">Đang hiện {report.slots.length} khung gần nhất trong {report.slotCount.toLocaleString("vi-VN")} khung của khoảng này.</p>
        ) : null}
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          {report.slots.length ? report.slots.map((slot) => <article key={slot.slotId} className="rounded-2xl border border-[#dfe6e2] p-4 text-sm"><div className="flex flex-wrap justify-between gap-2"><strong>{new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(slot.startsAt))}</strong><span className="rounded-full bg-[#edf3ef] px-2 py-1 text-xs font-bold">{SOURCE_LABELS[slot.capacitySourceKind]} · bản {slot.thresholdVersion}</span></div><div className="mt-3 grid grid-cols-4 gap-2 text-center"><div><span className="text-xs text-[#718078]">Công suất</span><strong className="block">{slot.capacitySnapshot}</strong></div><div><span className="text-xs text-[#718078]">Đang giữ</span><strong className="block">{slot.reservedEntries}</strong></div><div><span className="text-xs text-[#718078]">Đã bán</span><strong className="block">{slot.soldEntries}</strong></div><div><span className="text-xs text-[#718078]">Đã tới</span><strong className="block">{slot.checkedInEntries}</strong></div></div></article>) : <p className="rounded-2xl border border-dashed border-[#c7d2cc] p-6 text-sm text-[#7a8881]">Khoảng này chưa có khung giờ nào mở bán.</p>}
        </div>
      </div>
    </section>
  );
}

/**
 * Dịp nào ra tiền: cộng các dòng nguồn khách theo dịp của chiến dịch.
 *
 * Chỉ tính khách đã quy được về một mã QR. Khách không rõ nguồn không bị chia
 * đều hay đoán hộ vào dịp nào, nên tổng ở đây có thể nhỏ hơn tổng toàn trang;
 * câu dưới bảng nói thẳng điều ấy.
 */
function TheoDip({ report }: { report: CustomerFunnelReport }) {
  const dong = gomTheoDip(report.sources);
  const tenDip = new Map(CAC_DIP.map((d) => [d.id, d.ten]));
  return (
    <div className="mt-7" data-testid="phieu-theo-dip">
      <h3 className="text-xl font-black text-[#203a30]">Theo dịp: dịp nào ra tiền</h3>
      <p className="mt-1 max-w-3xl text-sm text-[#66756e]">
        Cộng theo dịp mà chiến dịch được gắn vào, trong khoảng đang xem. Chỉ tính khách đến từ mã QR; khách chưa rõ đến từ đâu không bị đoán vào dịp nào.
      </p>
      <div className="mt-3 overflow-x-auto">
        <table className="min-w-[640px] w-full text-left text-sm">
          <thead><tr className="border-b border-[#dfe6e2] text-xs uppercase tracking-[0.1em] text-[#6a7b73]"><th className="py-3 pr-4">Dịp</th><th>Quét mã</th><th>Mở trang</th><th>Giữ chỗ</th><th>Thanh toán</th><th>Qua cổng</th></tr></thead>
          <tbody>
            {dong.length ? dong.map((row) => (
              <tr key={row.dipId || "chua-gan"} data-dip={row.dipId} className="border-b border-[#edf1ef]">
                <td className="py-3 pr-4"><strong>{row.dipId ? tenDip.get(row.dipId) ?? row.dipId : "Chưa gắn dịp"}</strong></td>
                <td>{row.qrScans}</td><td>{row.pageViews}</td><td>{row.holds}</td><td>{row.payments}</td><td>{row.acceptedGateScans}</td>
              </tr>
            )) : <tr><td colSpan={6} className="py-8 text-center text-[#7a8881]">Khoảng này chưa có khách nào đến từ mã QR.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * Chọn khoảng: ba nút số ngày, còn các dịp nằm trong một ô chọn. Mười mấy
 * dịp mà xếp thành nút thì ở khổ 390px người xem phải cuộn qua cả màn hình
 * mới tới con số. Cả hai đều đi qua đường dẫn `?ky=` và chạy được khi chưa
 * có JavaScript: nút là liên kết, ô chọn là biểu mẫu GET.
 */
function ChonKhoang({ khoang, luaChon }: { khoang: KhoangPhieu; luaChon: readonly LuaChonKhoang[] }) {
  const ngay = luaChon.filter((l) => l.nhom === "ngay");
  const dip = luaChon.filter((l) => l.nhom === "dip");
  const dangXemDip = dip.some((l) => l.ma === khoang.ma);
  return (
    <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:gap-6" data-testid="phieu-chon-khoang">
      <nav aria-label="Xem theo số ngày">
        <p className="text-xs font-bold text-[#607b70]">Theo số ngày</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {ngay.map((l) => {
            const dangChon = l.ma === khoang.ma;
            return (
              <Link
                key={l.ma}
                href={`/erp/marketing?ky=${l.ma}#phieu-khach`}
                prefetch={false}
                scroll={false}
                aria-current={dangChon ? "true" : undefined}
                className={`inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-bold transition ${dangChon ? "border-[#203a30] bg-[#203a30] text-white" : "border-[#d8e0db] bg-white text-[#34524a] hover:border-[#8aa89c]"}`}
              >
                {l.nhan}
              </Link>
            );
          })}
        </div>
      </nav>
      {dip.length ? (
        <form method="get" action="/erp/marketing#phieu-khach" className="min-w-0">
          <label htmlFor="phieu-chon-dip" className="text-xs font-bold text-[#607b70]">Theo dịp, so với cùng dịp năm trước</label>
          <div className="mt-2 flex gap-2">
            <select
              id="phieu-chon-dip"
              name="ky"
              defaultValue={dangXemDip ? khoang.ma : ""}
              className={`min-h-11 min-w-0 flex-1 rounded-full border px-4 text-sm font-bold lg:w-72 lg:flex-none ${dangXemDip ? "border-[#203a30] text-[#203a30]" : "border-[#d8e0db] text-[#34524a]"} bg-white`}
            >
              <option value="" disabled>Chọn một dịp đã qua</option>
              {dip.map((l) => <option key={l.ma} value={l.ma}>{l.nhan}</option>)}
            </select>
            <button type="submit" className="min-h-11 shrink-0 rounded-full bg-[#203a30] px-5 text-sm font-bold text-white transition hover:bg-[#2d5042]">Xem</button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
