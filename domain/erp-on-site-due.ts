/**
 * QA-DON-DU-LIEU-10 — đơn khách chọn trả tại điểm, còn chờ thu.
 *
 * Luật thật ở `erp_close_on_site_no_show` (migration `202609140073`). Tệp này
 * đọc dữ liệu máy chủ trả về và nói trước cho màn hình biết đơn nào đóng được,
 * để nút bấm không mời người ta làm một việc máy chủ sẽ từ chối.
 */

export type OnSiteDueOrder = {
  orderCode: string;
  visitDate: string;
  partySize: number;
  amountVnd: number;
  entriesUsed: number;
  ticketCodes: string[];
};

export function parseOnSiteDueOrders(value: unknown): OnSiteDueOrder[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    const orderCode = typeof row.order_code === "string" ? row.order_code : "";
    const visitDate = typeof row.visit_date === "string" ? row.visit_date.slice(0, 10) : "";
    const amountVnd = Number(row.amount_vnd);
    if (!/^NBJ-[A-Z0-9]{12}$/.test(orderCode) || !/^\d{4}-\d{2}-\d{2}$/.test(visitDate) || !Number.isFinite(amountVnd)) {
      return [];
    }
    return [
      {
        orderCode,
        visitDate,
        partySize: Number(row.party_size) || 0,
        amountVnd,
        entriesUsed: Number(row.entries_used) || 0,
        ticketCodes: Array.isArray(row.ticket_codes) ? row.ticket_codes.filter((c): c is string => typeof c === "string") : [],
      },
    ];
  });
}

export type NoShowEligibility = { ok: true } | { ok: false; reason: string };

/** Chép đúng điều kiện của `erp_close_on_site_no_show`: qua ngày đi, chưa ai vào cổng. */
export function noShowEligibility(order: OnSiteDueOrder, today: string): NoShowEligibility {
  if (order.entriesUsed > 0) {
    return { ok: false, reason: "Khách đã vào cổng, không phải không đến. Thu tiền ở cổng." };
  }
  if (order.visitDate >= today) {
    return { ok: false, reason: "Còn trong ngày đi, khách vẫn có thể tới. Qua hết ngày mới đóng được." };
  }
  return { ok: true };
}

export function validateNoShowReason(reason: string): NoShowEligibility {
  const v = reason.trim();
  if (v.length < 10) return { ok: false, reason: "Ghi lý do, ít nhất mười ký tự: đã gọi khách chưa, khách nói gì." };
  if (v.length > 500) return { ok: false, reason: "Lý do dài quá, tối đa 500 ký tự." };
  return { ok: true };
}
