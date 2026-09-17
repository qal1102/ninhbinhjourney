/**
 * Đếm vé đã bán cho màn hình "Vé & đặt chỗ" của từng cơ sở.
 *
 * Tách ra thành hàm thuần vì phép đếm cũ sai một cách lặng lẽ, và kiểu sai
 * này không nhìn ra được bằng mắt.
 *
 * **Cái sai cũ:** mỗi hàng `erp_tickets` được tính là 1. Nhưng một tấm vé cho
 * vào nhiều lượt: đơn web 2 khách ra **một** tấm vé "2 lượt vào", vé đoàn
 * `TA-2026-000102` là **một** tấm cho vài chục lượt. Lượt kiểm tay ngày
 * 12/09/2026 đặt một đơn 2 khách thì ERP báo "Số vé phát hành: 1". Nghĩa là
 * mọi con số lượt khách trên màn hình đang thấp hơn thực tế, có khi nhiều
 * lần — và càng nhiều đoàn thì càng lệch.
 *
 * **Cách đếm mới:** giữ cả hai con số, vì cả hai đều đúng và đều cần.
 * `ticketCount` là số tấm vé đã phát (quầy đếm giấy in, đối soát mã).
 * `entryCount` là số lượt khách được phép vào — con số điều hành thật sự
 * cần, và là con số so với kỳ liền trước.
 */

export type TicketSalesRow = {
  issuedAt: string;
  /** Số lượt vào tấm vé cho phép lúc phát hành. Hỏng hoặc thiếu thì tính 1. */
  entriesAllowed: unknown;
  product: string;
};

export type TicketSalesPeriod = "day" | "week" | "month" | "year";

export type TicketSalesPeriodStat = {
  period: TicketSalesPeriod;
  label: string;
  ticketCount: number;
  entryCount: number;
  /** So lượt khách với kỳ liền trước. `null` khi kỳ trước bằng 0 — phần trăm so với 0 không có nghĩa. */
  changePercent: number | null;
  /**
   * QA-ERP-TICKET-05 — tiền bán tại quầy trong kỳ, cộng từ thành tiền chép trên
   * dòng phiếu lúc bán. `null` khi chưa đọc được từ kho (đường đếm cũ).
   */
  counterRevenueVnd?: number | null;
  /** Số tấm vé trong kỳ không có giá trên vé (vé web theo gói, vé gieo mẫu). */
  unpricedTicketCount?: number | null;
};

export type TicketSalesProductShare = {
  product: string;
  ticketCount: number;
  entryCount: number;
  /** Phần trăm tính trên lượt khách, không trên số tấm vé. */
  sharePercent: number;
};

const NGAY = 24 * 60 * 60 * 1000;

export const TICKET_SALES_WINDOWS: readonly {
  period: TicketSalesPeriod;
  label: string;
  ms: number;
}[] = [
  { period: "day", label: "Hôm nay", ms: NGAY },
  { period: "week", label: "7 ngày", ms: 7 * NGAY },
  { period: "month", label: "30 ngày", ms: 30 * NGAY },
  { period: "year", label: "365 ngày", ms: 365 * NGAY },
];

/**
 * Số lượt một tấm vé cho vào. Vé nào cũng cho ít nhất một người qua cổng,
 * nên giá trị hỏng, âm hay bằng 0 đều tính là 1 — thà đếm một lượt còn hơn
 * làm mất cả tấm vé khỏi báo cáo.
 */
export function ticketEntries(entriesAllowed: unknown): number {
  const so = Number(entriesAllowed);
  if (!Number.isFinite(so) || so < 1) return 1;
  return Math.trunc(so);
}

function phanTramThayDoi(hienTai: number, truoc: number): number | null {
  if (truoc === 0) return null;
  return Math.round(((hienTai - truoc) / truoc) * 1000) / 10;
}

export function summariseTicketPeriods(
  rows: readonly TicketSalesRow[],
  now: number,
): TicketSalesPeriodStat[] {
  return TICKET_SALES_WINDOWS.map(({ period, label, ms }) => {
    let ticketCount = 0;
    let entryCount = 0;
    let previousEntries = 0;
    for (const row of rows) {
      const issuedAt = Date.parse(row.issuedAt);
      if (Number.isNaN(issuedAt)) continue;
      const age = now - issuedAt;
      const entries = ticketEntries(row.entriesAllowed);
      if (age >= 0 && age < ms) {
        ticketCount += 1;
        entryCount += entries;
      } else if (age >= ms && age < 2 * ms) {
        previousEntries += entries;
      }
    }
    return {
      period,
      label,
      ticketCount,
      entryCount,
      changePercent: phanTramThayDoi(entryCount, previousEntries),
    };
  });
}

export function summariseProductShares(
  rows: readonly TicketSalesRow[],
  now: number,
  windowMs = 30 * NGAY,
): TicketSalesProductShare[] {
  const theoSanPham = new Map<string, { ticketCount: number; entryCount: number }>();
  let tongLuot = 0;
  for (const row of rows) {
    const issuedAt = Date.parse(row.issuedAt);
    if (Number.isNaN(issuedAt)) continue;
    const age = now - issuedAt;
    if (age < 0 || age >= windowMs) continue;
    const entries = ticketEntries(row.entriesAllowed);
    const hienCo = theoSanPham.get(row.product) ?? { ticketCount: 0, entryCount: 0 };
    hienCo.ticketCount += 1;
    hienCo.entryCount += entries;
    theoSanPham.set(row.product, hienCo);
    tongLuot += entries;
  }
  return [...theoSanPham.entries()]
    .map(([product, dem]) => ({
      product,
      ticketCount: dem.ticketCount,
      entryCount: dem.entryCount,
      sharePercent: tongLuot === 0 ? 0 : Math.round((dem.entryCount / tongLuot) * 1000) / 10,
    }))
    .sort((a, b) => b.entryCount - a.entryCount);
}

/**
 * QA-ERP-TICKET-05 — đọc kết quả `erp_ticket_sales_summary` (migration
 * `202609140074`). Phép đếm nay chạy trong kho, không còn trần 2.000 tấm vé.
 */
export function parseTicketSalesRpc(value: unknown): {
  periods: TicketSalesPeriodStat[];
  productShares: TicketSalesProductShare[];
  recent: Array<{
    ticketCode: string;
    product: string;
    channel: string;
    guestName: string;
    status: string;
    issuedAt: string;
    priceVnd: number | null;
  }>;
} | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (!Array.isArray(row.periods)) return null;
  const so = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);

  const periods = TICKET_SALES_WINDOWS.map(({ period, label }) => {
    const found = (row.periods as unknown[]).find(
      (item) => item && typeof item === "object" && (item as Record<string, unknown>).period === period,
    ) as Record<string, unknown> | undefined;
    const entryCount = so(found?.entry_count);
    return {
      period,
      label,
      ticketCount: so(found?.ticket_count),
      entryCount,
      changePercent: phanTramThayDoi(entryCount, so(found?.previous_entry_count)),
      counterRevenueVnd: found ? so(found.counter_revenue_vnd) : null,
      unpricedTicketCount: found ? so(found.unpriced_ticket_count) : null,
    };
  });

  const shares = Array.isArray(row.product_shares) ? row.product_shares : [];
  const tongLuot = shares.reduce((tong: number, item) => tong + so((item as Record<string, unknown>)?.entry_count), 0);
  const productShares = shares.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const r = item as Record<string, unknown>;
    const entryCount = so(r.entry_count);
    return [
      {
        product: String(r.product ?? ""),
        ticketCount: so(r.ticket_count),
        entryCount,
        sharePercent: tongLuot === 0 ? 0 : Math.round((entryCount / tongLuot) * 1000) / 10,
      },
    ];
  });

  const recent = (Array.isArray(row.recent) ? row.recent : []).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const r = item as Record<string, unknown>;
    return [
      {
        ticketCode: String(r.ticket_code ?? ""),
        product: String(r.product ?? ""),
        channel: String(r.channel ?? ""),
        guestName: String(r.guest_name ?? ""),
        status: String(r.status ?? ""),
        issuedAt: String(r.issued_at ?? ""),
        priceVnd: r.price_vnd === null || r.price_vnd === undefined ? null : so(r.price_vnd),
      },
    ];
  });

  return { periods, productShares, recent };
}

/**
 * A15-ERP-02 — tên tiếng Việt của trạng thái vé, đúng bốn giá trị ràng buộc
 * `erp_tickets.status` cho phép (migration `202608020028`). Trước đây danh
 * sách "Vé phát hành gần nhất" in thẳng mã lưu trong kho như `issued`.
 */
export const TICKET_STATUS_LABELS: Readonly<Record<string, string>> = Object.freeze({
  issued: "Chưa dùng",
  "partially-used": "Đã dùng một phần",
  used: "Đã dùng hết lượt",
  void: "Đã huỷ",
});

/** Trạng thái lạ thì hiện nguyên mã, còn hơn giấu đi. */
export function ticketStatusLabel(status: string): string {
  return Object.prototype.hasOwnProperty.call(TICKET_STATUS_LABELS, status)
    ? TICKET_STATUS_LABELS[status]
    : status;
}
