import { describe, expect, it } from "vitest";
import type { OfflineGateDeviceState, OfflineGateManifest } from "@/domain/offline-gate";
import { decideOfflineGateResult } from "@/domain/offline-gate";
import { stateWithQueuedScan, stateWithSyncResult } from "@/lib/erp/offline-gate-store";

const manifest: OfflineGateManifest = {
  manifestId: "10000000-0000-4000-8000-000000000001",
  siteId: "10000000-0000-4000-8000-000000000002",
  deviceId: "10000000-0000-4000-8000-000000000003",
  serviceDate: "2026-08-20",
  issuedAt: "2026-08-20T01:00:00.000Z",
  expiresAt: "2026-08-20T10:00:00.000Z",
  ticketCount: 1,
  snapshotDigest: "a".repeat(64),
  tickets: [{ codeDigest: "b".repeat(64), entriesRemaining: 1 }],
};

function state(): OfflineGateDeviceState {
  return { version: 1, siteId: "trang-an", deviceId: manifest.deviceId, manifest, scans: [] };
}

describe("CUS-08 offline gate local queue", () => {
  it("accepts only a preloaded digest and consumes its local remaining count", () => {
    expect(decideOfflineGateResult({ manifest, priorScans: [], codeDigest: "b".repeat(64), now: "2026-08-20T02:00:00.000Z" })).toBe("accepted");
    expect(decideOfflineGateResult({ manifest, priorScans: [], codeDigest: "c".repeat(64), now: "2026-08-20T02:00:00.000Z" })).toBe("not-found");
    const first = stateWithQueuedScan({ state: state(), code: "OFFLINE-001", codeDigest: "b".repeat(64), scannedAt: "2026-08-20T02:00:00.000Z", idempotencyKey: "20000000-0000-4000-8000-000000000001" });
    const second = stateWithQueuedScan({ state: first.state, code: "OFFLINE-001", codeDigest: "b".repeat(64), scannedAt: "2026-08-20T02:01:00.000Z", idempotencyKey: "20000000-0000-4000-8000-000000000002" });
    expect(first.item.localResult).toBe("accepted");
    expect(second.item.localResult).toBe("exhausted");
  });

  it("fails closed after manifest expiry", () => {
    expect(decideOfflineGateResult({ manifest, priorScans: [], codeDigest: "b".repeat(64), now: "2026-08-20T10:00:01.000Z" })).toBe("not-found");
  });

  it("retains a visible divergence instead of overwriting the provisional outcome", () => {
    const queued = stateWithQueuedScan({ state: state(), code: "OFFLINE-001", codeDigest: "b".repeat(64), scannedAt: "2026-08-20T02:00:00.000Z", idempotencyKey: "20000000-0000-4000-8000-000000000001" });
    const synced = stateWithSyncResult(queued.state, {
      batchId: queued.item.idempotencyKey, itemCount: 1, acceptedCount: 0, refusedCount: 1,
      replayedCount: 0, divergedCount: 1, replayedBatch: false,
      items: [{ idempotencyKey: queued.item.idempotencyKey, localResult: "accepted", serverResult: "exhausted", reconciliationStatus: "diverged", replayed: false }],
    });
    expect(synced.scans[0]).toMatchObject({ localResult: "accepted", serverResult: "exhausted", syncStatus: "diverged" });
  });

  it("removes matched raw ticket codes from the durable device store after reconciliation", () => {
    const queued = stateWithQueuedScan({ state: state(), code: "OFFLINE-001", codeDigest: "b".repeat(64), scannedAt: "2026-08-20T02:00:00.000Z", idempotencyKey: "20000000-0000-4000-8000-000000000001" });
    const synced = stateWithSyncResult(queued.state, {
      batchId: queued.item.idempotencyKey, itemCount: 1, acceptedCount: 1, refusedCount: 0,
      replayedCount: 0, divergedCount: 0, replayedBatch: false,
      items: [{ idempotencyKey: queued.item.idempotencyKey, localResult: "accepted", serverResult: "accepted", reconciliationStatus: "matched", replayed: false }],
    });
    expect(synced.scans).toEqual([]);
  });
});

describe("mã đoàn quầy ngoại tuyến (migration 122)", () => {
  // "b" là mã vé đoàn 2 lượt; "d" là mã đoàn, bí danh của "b".
  const coDoan: OfflineGateManifest = {
    ...manifest,
    ticketCount: 2,
    tickets: [
      { codeDigest: "b".repeat(64), entriesRemaining: 2 },
      { codeDigest: "d".repeat(64), entriesRemaining: 2, aliasOf: "b".repeat(64) },
    ],
  };
  const doanState = (): OfflineGateDeviceState => ({ version: 1, siteId: "trang-an", deviceId: coDoan.deviceId, manifest: coDoan, scans: [] });

  it("mã đoàn và mã vé đoàn trừ chung một quỹ lượt", () => {
    const a = stateWithQueuedScan({ state: doanState(), code: "DOAN-AAAAAAAAAA", codeDigest: "d".repeat(64), scannedAt: "2026-08-20T02:00:00.000Z", idempotencyKey: "30000000-0000-4000-8000-000000000001" });
    const b = stateWithQueuedScan({ state: a.state, code: "QUAY-BBBBBBBBBBBB", codeDigest: "b".repeat(64), scannedAt: "2026-08-20T02:01:00.000Z", idempotencyKey: "30000000-0000-4000-8000-000000000002" });
    const c = stateWithQueuedScan({ state: b.state, code: "DOAN-AAAAAAAAAA", codeDigest: "d".repeat(64), scannedAt: "2026-08-20T02:02:00.000Z", idempotencyKey: "30000000-0000-4000-8000-000000000003" });
    expect([a.item.localResult, b.item.localResult, c.item.localResult]).toEqual(["accepted", "accepted", "exhausted"]);
  });

  it("bản kê cũ không có bí danh thì mỗi mã đếm riêng như trước", () => {
    expect(decideOfflineGateResult({ manifest, priorScans: [], codeDigest: "b".repeat(64), now: "2026-08-20T02:00:00.000Z" })).toBe("accepted");
  });
});
