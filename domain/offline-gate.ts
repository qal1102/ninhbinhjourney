import { z } from "zod";

export const OfflineGateLocalResultSchema = z.enum(["accepted", "not-found", "exhausted"]);
export type OfflineGateLocalResult = z.infer<typeof OfflineGateLocalResultSchema>;

export const OfflineGateManifestSchema = z.object({
  manifestId: z.string().uuid(),
  siteId: z.string().uuid(),
  deviceId: z.string().uuid(),
  serviceDate: z.string().date(),
  issuedAt: z.string().datetime({ offset: true }),
  expiresAt: z.string().datetime({ offset: true }),
  ticketCount: z.number().int().nonnegative(),
  snapshotDigest: z.string().regex(/^[0-9a-f]{64}$/),
  tickets: z.array(z.object({
    codeDigest: z.string().regex(/^[0-9a-f]{64}$/),
    entriesRemaining: z.number().int().positive(),
  })).max(5000),
});
export type OfflineGateManifest = z.infer<typeof OfflineGateManifestSchema>;

export const OfflineGateQueueItemSchema = z.object({
  idempotencyKey: z.string().min(8).max(128),
  manifestId: z.string().uuid(),
  code: z.string().min(6).max(60),
  codeDigest: z.string().regex(/^[0-9a-f]{64}$/),
  scannedAt: z.string().datetime({ offset: true }),
  localResult: OfflineGateLocalResultSchema,
  syncStatus: z.enum(["pending", "matched", "diverged"]),
  serverResult: z.string().max(40).nullable(),
});
export type OfflineGateQueueItem = z.infer<typeof OfflineGateQueueItemSchema>;

export type OfflineGateDeviceState = {
  version: 1;
  siteId: string;
  deviceId: string;
  manifest: OfflineGateManifest | null;
  scans: OfflineGateQueueItem[];
};

export type OfflineGateSyncResult = {
  batchId: string;
  itemCount: number;
  acceptedCount: number;
  refusedCount: number;
  replayedCount: number;
  divergedCount: number;
  replayedBatch: boolean;
  items: Array<{
    idempotencyKey: string;
    localResult: OfflineGateLocalResult;
    serverResult: string;
    reconciliationStatus: "matched" | "diverged";
    replayed: boolean;
  }>;
};

export function decideOfflineGateResult(input: {
  manifest: OfflineGateManifest;
  priorScans: readonly OfflineGateQueueItem[];
  codeDigest: string;
  now: string;
}): OfflineGateLocalResult {
  const timestamp = Date.parse(input.now);
  if (!Number.isFinite(timestamp) || timestamp > Date.parse(input.manifest.expiresAt)) {
    return "not-found";
  }
  const ticket = input.manifest.tickets.find((item) => item.codeDigest === input.codeDigest);
  if (!ticket) return "not-found";
  const locallyAccepted = input.priorScans.filter(
    (scan) => scan.manifestId === input.manifest.manifestId
      && scan.codeDigest === input.codeDigest
      && scan.localResult === "accepted",
  ).length;
  return locallyAccepted < ticket.entriesRemaining ? "accepted" : "exhausted";
}
