import {
  decideOfflineGateResult,
  type OfflineGateDeviceState,
  type OfflineGateManifest,
  type OfflineGateQueueItem,
  type OfflineGateSyncResult,
} from "@/domain/offline-gate";

const DB_NAME = "nbj-erp-offline-gate-v1";
const STORE_NAME = "site-state";

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
  });
}

async function database() {
  if (typeof indexedDB === "undefined") throw new Error("Trình duyệt không hỗ trợ kho ngoại tuyến IndexedDB.");
  const request = indexedDB.open(DB_NAME, 1);
  request.onupgradeneeded = () => {
    if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME);
  };
  return requestResult(request);
}

export async function loadOfflineGateState(siteId: string): Promise<OfflineGateDeviceState> {
  const db = await database();
  const value = await requestResult(db.transaction(STORE_NAME).objectStore(STORE_NAME).get(siteId));
  db.close();
  if (value && typeof value === "object" && (value as OfflineGateDeviceState).version === 1) {
    return value as OfflineGateDeviceState;
  }
  return { version: 1, siteId, deviceId: crypto.randomUUID(), manifest: null, scans: [] };
}

export async function saveOfflineGateState(state: OfflineGateDeviceState) {
  const db = await database();
  const transaction = db.transaction(STORE_NAME, "readwrite");
  transaction.objectStore(STORE_NAME).put(state, state.siteId);
  await new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB transaction failed"));
    transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB transaction aborted"));
  });
  db.close();
}

export async function digestTicketCode(code: string) {
  const bytes = new TextEncoder().encode(code.trim().toUpperCase());
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

export function stateWithManifest(state: OfflineGateDeviceState, manifest: OfflineGateManifest): OfflineGateDeviceState {
  return { ...state, deviceId: manifest.deviceId, manifest, scans: state.scans.filter((scan) => scan.syncStatus === "diverged") };
}

export function stateWithQueuedScan(input: {
  state: OfflineGateDeviceState;
  code: string;
  codeDigest: string;
  scannedAt: string;
  idempotencyKey: string;
}): { state: OfflineGateDeviceState; item: OfflineGateQueueItem } {
  if (!input.state.manifest) throw new Error("Chưa nạp bộ vé cho ca ngoại tuyến.");
  const localResult = decideOfflineGateResult({
    manifest: input.state.manifest,
    priorScans: input.state.scans,
    codeDigest: input.codeDigest,
    now: input.scannedAt,
  });
  const item: OfflineGateQueueItem = {
    idempotencyKey: input.idempotencyKey,
    manifestId: input.state.manifest.manifestId,
    code: input.code.trim().toUpperCase(),
    codeDigest: input.codeDigest,
    scannedAt: input.scannedAt,
    localResult,
    syncStatus: "pending",
    serverResult: null,
  };
  return { state: { ...input.state, scans: [...input.state.scans, item] }, item };
}

export function stateWithSyncResult(state: OfflineGateDeviceState, result: OfflineGateSyncResult): OfflineGateDeviceState {
  const byKey = new Map(result.items.map((item) => [item.idempotencyKey, item]));
  return {
    ...state,
    scans: state.scans.flatMap((scan) => {
      const synced = byKey.get(scan.idempotencyKey);
      if (!synced) return [scan];
      if (synced.reconciliationStatus === "matched") return [];
      return [{
        ...scan,
        syncStatus: synced.reconciliationStatus,
        serverResult: synced.serverResult,
      }];
    }),
  };
}
