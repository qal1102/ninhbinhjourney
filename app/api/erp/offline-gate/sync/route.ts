import { z } from "zod";
import { OfflineGateQueueItemSchema } from "@/domain/offline-gate";
import { isErpSiteId } from "@/domain/erp";
import { accountCanAccessModule, accountCanAccessSite, getCurrentErpUser } from "@/lib/erp/demo-session";
import { isOfflineGateEnabled, syncOfflineGateBatch } from "@/lib/erp/offline-gate-repository";

const InputSchema = z.object({
  siteId: z.string(), manifestId: z.string().uuid(), deviceId: z.string().uuid(), batchId: z.string().uuid(),
  scans: z.array(OfflineGateQueueItemSchema).min(1).max(200),
}).strict();

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return origin === new URL(request.url).origin && request.headers.get("sec-fetch-site") !== "cross-site";
}

export async function POST(request: Request) {
  try {
    if (!isOfflineGateEnabled()) return Response.json({ error: "GATE_OFFLINE_DISABLED" }, { status: 503 });
    if (!sameOrigin(request)) return Response.json({ error: "GATE_OFFLINE_ORIGIN_REJECTED" }, { status: 403 });
    const input = InputSchema.parse(await request.json());
    const user = await getCurrentErpUser();
    if (!user) return Response.json({ error: "ERP_SESSION_REQUIRED" }, { status: 401 });
    if (!isErpSiteId(input.siteId) || !accountCanAccessSite(user, input.siteId) || !accountCanAccessModule(user, input.siteId, "check-in-khach")) {
      return Response.json({ error: "GATE_OFFLINE_ACTOR_REQUIRED" }, { status: 403 });
    }
    const result = await syncOfflineGateBatch({
      manifestId: input.manifestId, batchId: input.batchId, deviceId: input.deviceId,
      actorAccountId: user.id, actorName: user.name, scans: input.scans,
    });
    return Response.json(result, { status: 200, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Offline gate sync failed", error);
    return Response.json({ error: "GATE_OFFLINE_SYNC_FAILED" }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
}
