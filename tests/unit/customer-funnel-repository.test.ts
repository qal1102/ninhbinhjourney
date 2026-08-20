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
      { id: "hold-current", profile_id: "profile-1", status: "active", created_at: "2026-08-19T01:03:00.000Z" },
      { id: "hold-old-sold", profile_id: "profile-1", status: "converted", created_at: "2026-07-01T01:03:00.000Z" },
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
  });
});
