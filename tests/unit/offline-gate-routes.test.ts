import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ enabled: vi.fn(), user: vi.fn(), site: vi.fn(), module: vi.fn(), prepare: vi.fn(), sync: vi.fn() }));
vi.mock("@/lib/erp/offline-gate-repository", () => ({
  isOfflineGateEnabled: mocks.enabled,
  prepareOfflineGateManifest: mocks.prepare,
  syncOfflineGateBatch: mocks.sync,
}));
vi.mock("@/lib/erp/demo-session", () => ({
  getCurrentErpUser: mocks.user,
  accountCanAccessSite: mocks.site,
  accountCanAccessModule: mocks.module,
}));

import { POST as prepare } from "@/app/api/erp/offline-gate/manifests/route";
import { POST as sync } from "@/app/api/erp/offline-gate/sync/route";

const deviceId = "10000000-0000-4000-8000-000000000001";
const manifestId = "10000000-0000-4000-8000-000000000002";
const scanId = "10000000-0000-4000-8000-000000000003";
function request(path: string, body: unknown, origin = "https://ninhbinhjourney.test") {
  return new Request(`https://ninhbinhjourney.test${path}`, { method: "POST", headers: { "content-type": "application/json", origin, "sec-fetch-site": origin.includes("ninhbinhjourney") ? "same-origin" : "cross-site" }, body: JSON.stringify(body) });
}

describe("CUS-08 offline gate routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.enabled.mockReturnValue(true);
    mocks.user.mockResolvedValue({ id: "employee-01", name: "Nhân viên", role: "employee" });
    mocks.site.mockReturnValue(true);
    mocks.module.mockReturnValue(true);
    mocks.prepare.mockResolvedValue({ manifestId, ticketCount: 1 });
    mocks.sync.mockResolvedValue({ batchId: scanId, itemCount: 1, items: [] });
  });

  it("fails closed when disabled or cross-origin", async () => {
    mocks.enabled.mockReturnValue(false);
    expect((await prepare(request("/api/erp/offline-gate/manifests", { siteId: "trang-an", deviceId }))).status).toBe(503);
    mocks.enabled.mockReturnValue(true);
    expect((await prepare(request("/api/erp/offline-gate/manifests", { siteId: "trang-an", deviceId }, "https://attacker.test"))).status).toBe(403);
    expect(mocks.prepare).not.toHaveBeenCalled();
  });

  it("requires current site and module access", async () => {
    mocks.module.mockReturnValue(false);
    expect((await prepare(request("/api/erp/offline-gate/manifests", { siteId: "trang-an", deviceId }))).status).toBe(403);
  });

  it("prepares a site-bound minimal manifest", async () => {
    const response = await prepare(request("/api/erp/offline-gate/manifests", { siteId: "trang-an", deviceId }));
    expect(response.status).toBe(201);
    expect(mocks.prepare).toHaveBeenCalledWith({ siteId: "trang-an", actorAccountId: "employee-01", deviceId });
  });

  it("validates and forwards a durable batch", async () => {
    const scan = { idempotencyKey: scanId, manifestId, code: "OFFLINE-001", codeDigest: "a".repeat(64), scannedAt: "2026-08-20T02:00:00.000Z", localResult: "accepted", syncStatus: "pending", serverResult: null };
    const response = await sync(request("/api/erp/offline-gate/sync", { siteId: "trang-an", manifestId, deviceId, batchId: scanId, scans: [scan] }));
    expect(response.status).toBe(200);
    expect(mocks.sync).toHaveBeenCalledWith(expect.objectContaining({ actorAccountId: "employee-01", scans: [scan] }));
  });
});
