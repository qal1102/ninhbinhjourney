export type CustomerFunnelSourceRow = {
  sourceId: string;
  sourceLabel: string;
  campaignLabel: string;
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
  /** Nguồn nào chạm trần đọc: số trên màn hình là số bị cắt, không phải số đủ. */
  truncation: {
    capped: boolean;
    rowLimit: number;
    sources: string[];
  };
};
