import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const tables = vi.hoisted(() => new Map<string, unknown[]>());
const rpc = vi.hoisted(() => ({ calls: [] as Array<{ name: string; args: Record<string, unknown> }>, results: [] as unknown[] }));

vi.mock("server-only", () => ({}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    rpc: (name: string, args: Record<string, unknown>) => {
      rpc.calls.push({ name, args });
      return Promise.resolve(rpc.results.shift());
    },
    from: (name: string) => {
      const result = { data: tables.get(name) ?? [], error: null };
      const builder: Record<string, unknown> = {};
      for (const method of ["select", "eq", "limit"]) {
        builder[method] = () => builder;
      }
      builder.then = (resolve: (value: typeof result) => unknown, reject: (reason: unknown) => unknown) =>
        Promise.resolve(result).then(resolve, reject);
      return builder;
    },
  }),
}));

import { getCustomerFunnelReport } from "@/lib/customer-data/funnel-repository";

const KY = { nhan: "7 ngày gần nhất", tu: new Date("2026-08-13T05:00:00.000Z"), den: new Date("2026-08-20T05:00:00.000Z") };
const KY_TRUOC = { nhan: "7 ngày liền trước", tu: new Date("2026-08-06T05:00:00.000Z"), den: KY.tu };

const KET_QUA = {
  tong: { qr: 1, xem: 1, giu: 2, tra: 1, cong: 1500 },
  nguon: [
    { nguon: "source-1", qr: 1, xem: 1, giu: 1, tra: 1, cong: 1 },
    { nguon: "unattributed", qr: 0, xem: 0, giu: 1, tra: 0, cong: 1499 },
    { nguon: "source-trong", qr: 0, xem: 0, giu: 0, tra: 0, cong: 0 },
  ],
  cong_quay: 7000,
  so_khung: 30,
  khung: [{
    id: "slot-1", site_id: "site-1", starts_at: "2026-08-19T02:00:00+00:00",
    capacity_snapshot: 10, capacity_source_kind: "measured", threshold_version: 3,
    dang_giu: 5, da_ban: 3, da_toi: 1,
  }],
  ho_so_co_giu: 2,
  ho_so_ro_nguon: 1,
  ngoai_tuyen: 2,
  ngoai_tuyen_lech: 1,
  co_mau: true,
};

describe("phễu khách đọc từ hàm đếm trong kho", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_SECRET_KEY", "test-secret");
    tables.clear();
    rpc.calls.length = 0;
    rpc.results.length = 0;
    tables.set("marketing_campaigns", [{ id: "campaign-1", name: "Summer Heritage", dip_id: "trung-thu" }]);
    tables.set("marketing_qr_sources", [{ id: "source-1", code: "TRANGAN", placement_label: "Gate poster", campaign_id: "campaign-1" }]);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("gọi hàm cho cả kỳ chính lẫn kỳ so, và giữ nguyên số vượt 1.000 dòng", async () => {
    rpc.results.push({ data: KET_QUA, error: null }, { data: { tong: { qr: 3, xem: 0, giu: 0, tra: 0, cong: 900 } }, error: null });
    const report = await getCustomerFunnelReport(KY, KY_TRUOC);

    expect(rpc.calls.map((c) => c.name)).toEqual(["erp_phieu_khach", "erp_phieu_khach"]);
    expect(rpc.calls[0].args).toMatchObject({ p_tu: KY.tu.toISOString(), p_den: KY.den.toISOString() });
    expect(rpc.calls[1].args).toMatchObject({ p_tu: KY_TRUOC.tu.toISOString(), p_den: KY_TRUOC.den.toISOString() });
    expect(report.totals).toEqual({ qrScans: 1, pageViews: 1, holds: 2, payments: 1, acceptedGateScans: 1500 });
    expect(report.comparisonTotals).toEqual({ qrScans: 3, pageViews: 0, holds: 0, payments: 0, acceptedGateScans: 900 });
    expect(report.hasDemoData).toBe(true);
    expect(report.slotCount).toBe(30);
    expect(report.counterGateScans).toBe(7000);
  });

  it("gắn nhãn mã QR và dịp, bỏ dòng toàn số 0, để khách chưa rõ nguồn riêng", async () => {
    rpc.results.push({ data: KET_QUA, error: null });
    const report = await getCustomerFunnelReport(KY);

    expect(report.comparisonTotals).toBeNull();
    expect(report.sources).toEqual([
      expect.objectContaining({ sourceId: "source-1", sourceLabel: "TRANGAN · Gate poster", campaignLabel: "Summer Heritage", dipId: "trung-thu", acceptedGateScans: 1 }),
      expect.objectContaining({ sourceId: "unattributed", sourceLabel: "Chưa gắn QR nguồn", dipId: "", acceptedGateScans: 1499 }),
    ]);
    expect(report.slots).toEqual([expect.objectContaining({
      capacitySnapshot: 10, capacitySourceKind: "measured", thresholdVersion: 3,
      reservedEntries: 5, soldEntries: 3, checkedInEntries: 1,
    })]);
    expect(report.reconciliation).toEqual({
      attributedProfiles: 1, unattributedProfiles: 1, offlineSyncedItems: 2, offlineDivergedItems: 1,
    });
  });

  it("kho chưa có hàm thì ném lỗi rõ ràng, không lùi về đếm thiếu", async () => {
    rpc.results.push({ data: null, error: { code: "PGRST202", message: "not found" } });
    await expect(getCustomerFunnelReport(KY)).rejects.toThrow("Kho chưa có hàm đếm phễu khách.");
  });
});
