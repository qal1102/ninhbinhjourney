import { z } from "zod";
import { isErpSiteId } from "@/domain/erp";
import { accountCanAccessModule, accountCanAccessSite, getCurrentErpUser } from "@/lib/erp/demo-session";
import { isOfflineGateEnabled, prepareOfflineGateManifest } from "@/lib/erp/offline-gate-repository";

const InputSchema = z.object({ siteId: z.string(), deviceId: z.string().uuid() }).strict();

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
    const manifest = await prepareOfflineGateManifest({ siteId: input.siteId, actorAccountId: user.id, deviceId: input.deviceId });
    return Response.json(manifest, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Offline gate manifest failed", error);
    return Response.json({ error: "GATE_OFFLINE_MANIFEST_FAILED" }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
}
