import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const tables = vi.hoisted(() => new Map<string, unknown[]>());

vi.mock("server-only", () => ({}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: (name: string) => {
      const result = { data: tables.get(name) ?? [], error: null };
      const builder: Record<string, unknown> = {};
      for (const method of ["select", "eq", "gte", "lt", "order", "limit"]) {
        builder[method] = () => builder;
      }
      builder.then = (resolve: (value: typeof result) => unknown, reject: (reason: unknown) => unknown) =>
        Promise.resolve(result).then(resolve, reject);
      return builder;
    },
  }),
}));

import { getCustomerFunnelReport } from "@/lib/customer-data/funnel-repository";

describe("customer funnel reconciliation", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-20T05:00:00.000Z"));
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_SECRET_KEY", "test-secret");
    tables.clear();

    tables.set("marketing_campaigns", [{ id: "campaign-1", name: "Summer Heritage" }]);
    tables.set("marketing_qr_sources", [{ id: "source-1", code: "TRANGAN", placement_label: "Gate poster", campaign_id: "campaign-1" }]);
    tables.set("marketing_qr_scans", [{ qr_source_id: "source-1", occurred_at: "2026-08-19T01:00:00.000Z" }]);
    tables.set("customer_events", [{ profile_id: "profile-1", source_context: { qr_source_id: "source-1" }, occurred_at: "2026-08-19T01:01:00.000Z" }]);
    tables.set("customer_journeys", [{ profile_id: "profile-1", source_context: { qr_source_id: "source-1" }, created_at: "2026-08-19T01:02:00.000Z" }]);
    tables.set("customer_booking_holds", [
      { id: "hold-current", profile_id: "profile-1", status: "active", expires_at: "2026-08-20T05:10:00.000Z", created_at: "2026-08-20T04:55:00.000Z" },
      { id: "hold-old-sold", profile_id: "profile-1", status: "converted", expires_at: "2026-07-01T01:18:00.000Z", created_at: "2026-07-01T01:03:00.000Z" },
    ]);
    tables.set("customer_payment_attempts", [{ hold_id: "hold-current", status: "succeeded", occurred_at: "2026-08-19T01:04:00.000Z" }]);
    tables.set("customer_orders", [{ id: "order-1", profile_id: "profile-1", created_at: "2026-08-19T01:05:00.000Z" }]);
    tables.set("customer_order_tickets", [{ order_id: "order-1", ticket_id: "ticket-1", slot_id: "slot-1" }]);
    tables.set("erp_gate_scan_events", [{ ticket_id: "ticket-1", result: "accepted", scanned_at: "2026-08-19T01:06:00.000Z" }]);
    tables.set("customer_booking_slots", [{
      id: "slot-1", site_id: "site-1", starts_at: "2026-08-19T02:00:00.000Z",
      capacity_snapshot: 10, capacity_source_kind: "measured", threshold_version: 3,
    }]);
    tables.set("customer_booking_hold_slots", [
      { hold_id: "hold-current", slot_id: "slot-1", quantity: 2 },
      { hold_id: "hold-old-sold", slot_id: "slot-1", quantity: 3 },
    ]);
    tables.set("erp_gate_offline_sync_items", [
      { reconciliation_status: "matched", client_scanned_at: "2026-08-19T01:06:00.000Z" },
      { reconciliation_status: "diverged", client_scanned_at: "2026-08-19T01:07:00.000Z" },
    ]);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it("uses source records for the funnel and keeps older converted holds in slot sold totals", async () => {
    const report = await getCustomerFunnelReport(7);

    expect(report.totals).toEqual({
      qrScans: 1,
      pageViews: 1,
      holds: 1,
      payments: 1,
      acceptedGateScans: 1,
    });
    expect(report.sources).toEqual([expect.objectContaining({
      sourceId: "source-1",
      sourceLabel: "TRANGAN · Gate poster",
      campaignLabel: "Summer Heritage",
      qrScans: 1,
      pageViews: 1,
      holds: 1,
      payments: 1,
      acceptedGateScans: 1,
    })]);
    expect(report.slots).toEqual([expect.objectContaining({
      capacitySnapshot: 10,
      capacitySourceKind: "measured",
      thresholdVersion: 3,
      reservedEntries: 5,
      soldEntries: 3,
      checkedInEntries: 1,
    })]);
    expect(report.reconciliation).toEqual({
      attributedProfiles: 1,
      unattributedProfiles: 0,
      offlineSyncedItems: 2,
      offlineDivergedItems: 1,
    });
    expect(report.truncation).toEqual({ capped: false, rowLimit: 5000, sources: [] });
  });

  it("khong con dem hold da qua han la dang giu cho", async () => {
    // Hết hạn ở migration 202608200043 là LƯỜI: status vẫn nằm ở 'active' cho tới
    // khi chính hold đó bị chạm lại. RPC sức chứa vì thế xét thêm expires_at, và
    // bảng phễu phải xét y hệt, nếu không hai bên nói khác nhau về cùng một ghế.
    tables.set("customer_booking_holds", [
      { id: "hold-current", profile_id: "profile-1", status: "active", expires_at: "2026-08-20T04:45:00.000Z", created_at: "2026-08-20T04:30:00.000Z" },
      { id: "hold-old-sold", profile_id: "profile-1", status: "converted", expires_at: "2026-07-01T01:18:00.000Z", created_at: "2026-07-01T01:03:00.000Z" },
    ]);

    const report = await getCustomerFunnelReport(7);

    // Chỗ của hold quá hạn (2 vé) trả lại cho slot; chỉ còn 3 vé đã bán.
    expect(report.slots[0].reservedEntries).toBe(3);
    expect(report.slots[0].soldEntries).toBe(3);
    // Nó vẫn là một lần giữ chỗ đã xảy ra trong kỳ, nên phễu vẫn đếm.
    expect(report.totals.holds).toBe(1);
  });

  it("van giu hold 'converted' du da qua moc het han tu lau", async () => {
    const report = await getCustomerFunnelReport(7);

    // hold-old-sold hết hạn từ tháng 7 nhưng đã 'converted' — ghế đã bán đứt.
    expect(report.slots[0].soldEntries).toBe(3);
  });

  it("coi hold thieu moc het han la da het han, giong null > now() trong SQL", async () => {
    tables.set("customer_booking_holds", [
      { id: "hold-current", profile_id: "profile-1", status: "active", expires_at: null, created_at: "2026-08-20T04:55:00.000Z" },
    ]);

    const report = await getCustomerFunnelReport(7);

    expect(report.slots[0].reservedEntries).toBe(0);
  });

  it("noi ro so lieu bi cat khi mot nguon cham tran doc", async () => {
    tables.set("marketing_qr_scans", Array.from({ length: 5000 }, () => ({
      qr_source_id: "source-1", occurred_at: "2026-08-19T01:00:00.000Z",
    })));

    const report = await getCustomerFunnelReport(7);

    expect(report.truncation.capped).toBe(true);
    expect(report.truncation.sources).toContain("marketing_qr_scans");
    expect(report.truncation.rowLimit).toBe(5000);
  });
});
