export type CustomerFunnelSourceRow = {
  sourceId: string;
  sourceLabel: string;
  campaignLabel: string;
  /** Mã dịp của chiến dịch sở hữu mã QR này; rỗng là chưa gắn dịp. */
  dipId: string;
  qrScans: number;
  pageViews: number;
  holds: number;
  payments: number;
  acceptedGateScans: number;
};

export type CustomerFunnelSlotRow = {
  slotId: string;
  siteId: string;
  startsAt: string;
  capacitySnapshot: number;
  capacitySourceKind: "estimate" | "customer" | "measured";
  thresholdVersion: number;
  reservedEntries: number;
  soldEntries: number;
  checkedInEntries: number;
};

export type CustomerFunnelReport = {
  windowStart: string;
  windowEnd: string;
  totals: {
    qrScans: number;
    pageViews: number;
    holds: number;
    payments: number;
    acceptedGateScans: number;
  };
  sources: CustomerFunnelSourceRow[];
  slots: CustomerFunnelSlotRow[];
  reconciliation: {
    attributedProfiles: number;
    unattributedProfiles: number;
    offlineSyncedItems: number;
    offlineDivergedItems: number;
  };
};

export type CustomerFunnelDipRow = {
  /** Mã dịp; rỗng là nhóm "chưa gắn dịp". */
  dipId: string;
  qrScans: number;
  pageViews: number;
  holds: number;
  payments: number;
  acceptedGateScans: number;
};

/**
 * Cộng các dòng nguồn khách theo dịp của chiến dịch.
 *
 * Đây là câu trả lời cho "dịp nào ra tiền": mỗi mã QR thuộc một chiến dịch,
 * chiến dịch gắn vào một dịp, nên mọi lượt quét, giữ chỗ, thanh toán và vào
 * cổng đã quy được về mã QR thì cũng quy được về dịp. Khách không rõ đến từ
 * đâu (`unattributed`) cố ý **không** bị nhét vào dịp nào — đoán hộ là bịa số.
 *
 * Xếp theo số thanh toán thành công, rồi tới lượt quét: dịp ra tiền lên trước.
 */
export function gomTheoDip(sources: readonly CustomerFunnelSourceRow[]): CustomerFunnelDipRow[] {
  const theoDip = new Map<string, CustomerFunnelDipRow>();
  for (const row of sources) {
    if (row.sourceId === "unattributed") continue;
    const dong = theoDip.get(row.dipId) ?? {
      dipId: row.dipId, qrScans: 0, pageViews: 0, holds: 0, payments: 0, acceptedGateScans: 0,
    };
    dong.qrScans += row.qrScans;
    dong.pageViews += row.pageViews;
    dong.holds += row.holds;
    dong.payments += row.payments;
    dong.acceptedGateScans += row.acceptedGateScans;
    theoDip.set(row.dipId, dong);
  }
  return [...theoDip.values()].sort((a, b) => {
    // Nhóm chưa gắn dịp luôn xuống cuối, dù nhiều số tới đâu.
    if (!a.dipId !== !b.dipId) return a.dipId ? -1 : 1;
    return b.payments - a.payments || b.qrScans - a.qrScans || a.dipId.localeCompare(b.dipId);
  });
}
