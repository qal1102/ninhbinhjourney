import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { ErpSiteId } from "@/domain/erp";
import { ERP_SHIFT_CLOSE_SITE_UUID_BY_SLUG } from "@/lib/erp/shift-close-repository";

const SCAN_COOKIE = "nbj-erp-demo-gate-scans";
const STATE_SECONDS = 60 * 60 * 24 * 30;
const TENANT_ID = "00000000-0000-4000-8000-000000000001";
const READ_LIMIT = 8;

const SITE_SLUG_BY_UUID = new Map(
  Object.entries(ERP_SHIFT_CLOSE_SITE_UUID_BY_SLUG).map(([slug, uuid]) => [
    uuid,
    slug as ErpSiteId,
  ]),
);

const signingSecret =
  process.env.ERP_DEMO_SESSION_SECRET ??
  "destinationos-ninh-binh-demo-session-v1-change-before-live-data";

export type GateScanEvent = {
  id: string;
  siteId: ErpSiteId;
  code: string;
  scannedByName: string;
  scannedAt: string;
};

export type RecordGateScanInput = {
  siteId: ErpSiteId;
  code: string;
  actorId: string;
  actorName: string;
};

export class GateScanRepositoryError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "GateScanRepositoryError";
  }
}

type PersistenceMode = "supabase" | "demo-cookie";

function readMode(): PersistenceMode {
  const raw = process.env.ERP_PERSISTENCE_MODE?.trim();
  if (!raw) return "demo-cookie";
  if (raw === "supabase" || raw === "demo-cookie") return raw;
  throw new GateScanRepositoryError(
    "ERP_PERSISTENCE_MODE chỉ nhận supabase hoặc demo-cookie.",
  );
}

function createAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const secret = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!url || !secret) {
    throw new GateScanRepositoryError(
      "Kho dữ liệu quét QR chưa được cấu hình đủ ở phía máy chủ.",
    );
  }
  return createClient(url, secret, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
    global: { headers: { "X-Client-Info": "ninh-binh-journey-gate-scan-server" } },
  });
}

function repositoryError(
  operation: string,
  error: { message?: string; code?: string; details?: string } | null,
) {
  return new GateScanRepositoryError(
    `Kho dữ liệu quét QR chưa hoàn tất bước ${operation}.`,
    {
      cause: error
        ? new Error([error.code, error.message, error.details].filter(Boolean).join(": "))
        : undefined,
    },
  );
}

// --- demo-cookie mode -------------------------------------------------

function sign(payload: string) {
  return createHmac("sha256", signingSecret).update(payload).digest("base64url");
}

function encodeSigned(value: unknown) {
  const payload = Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function decodeSigned<T>(input: string | undefined): T | null {
  if (!input) return null;
  const [payload, signature, ...extra] = input.split(".");
  if (!payload || !signature || extra.length > 0) return null;
  const expected = sign(payload);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (
    actualBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(actualBuffer, expectedBuffer)
  ) {
    return null;
  }
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as T;
  } catch {
    return null;
  }
}

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/erp",
    maxAge,
  };
}

type CookieState = { version: 1; scansBySite: Partial<Record<ErpSiteId, GateScanEvent[]>> };

async function readCookieState(): Promise<CookieState> {
  const store = await cookies();
  const decoded = decodeSigned<CookieState>(store.get(SCAN_COOKIE)?.value);
  if (!decoded || decoded.version !== 1 || typeof decoded.scansBySite !== "object") {
    return { version: 1, scansBySite: {} };
  }
  return decoded;
}

async function writeCookieState(state: CookieState) {
  const store = await cookies();
  store.set(SCAN_COOKIE, encodeSigned(state), cookieOptions(STATE_SECONDS));
}

async function readCookieScans(siteId: ErpSiteId): Promise<GateScanEvent[]> {
  const state = await readCookieState();
  return (state.scansBySite[siteId] ?? []).slice(0, READ_LIMIT);
}

async function recordInCookie(input: RecordGateScanInput): Promise<GateScanEvent> {
  const state = await readCookieState();
  const code = input.code.trim().toUpperCase();
  const current = state.scansBySite[input.siteId] ?? [];
  const recent = current.find(
    (item) =>
      item.code === code &&
      Date.now() - new Date(item.scannedAt).getTime() < 2 * 60 * 1000,
  );
  if (recent) return recent;
  const event: GateScanEvent = {
    id: crypto.randomUUID(),
    siteId: input.siteId,
    code,
    scannedByName: input.actorName,
    scannedAt: new Date().toISOString(),
  };
  state.scansBySite[input.siteId] = [event, ...current].slice(0, 40);
  await writeCookieState(state);
  return event;
}

// --- supabase mode ------------------------------------------------------

function siteSlugFromUuid(value: unknown): ErpSiteId | null {
  if (typeof value !== "string") return null;
  return SITE_SLUG_BY_UUID.get(value) ?? null;
}

function eventFromRow(row: Record<string, unknown>): GateScanEvent | null {
  const siteId = siteSlugFromUuid(row.site_id);
  if (!siteId) return null;
  return {
    id: row.id as string,
    siteId,
    code: row.code as string,
    scannedByName: row.scanned_by_name as string,
    scannedAt: row.scanned_at as string,
  };
}

async function readSupabaseScans(siteId: ErpSiteId): Promise<GateScanEvent[]> {
  const client = createAdminClient();
  const result = await client
    .from("erp_gate_scan_events")
    .select("id, site_id, code, scanned_by_name, scanned_at")
    .eq("tenant_id", TENANT_ID)
    .eq("site_id", ERP_SHIFT_CLOSE_SITE_UUID_BY_SLUG[siteId])
    .order("scanned_at", { ascending: false })
    .limit(READ_LIMIT);
  if (result.error) {
    throw repositoryError("đọc nhật ký quét QR", result.error);
  }
  return (result.data ?? [])
    .map(eventFromRow)
    .filter((event): event is GateScanEvent => event !== null);
}

async function recordInSupabase(input: RecordGateScanInput): Promise<GateScanEvent> {
  const client = createAdminClient();
  const result = await client.rpc("erp_record_gate_scan", {
    p_tenant_id: TENANT_ID,
    p_site_id: ERP_SHIFT_CLOSE_SITE_UUID_BY_SLUG[input.siteId],
    p_code: input.code,
    p_actor_account_id: input.actorId,
    p_actor_name: input.actorName,
  });
  if (result.error) {
    if (/GATE_SCAN_CODE_INVALID/.test(result.error.message)) {
      throw new GateScanRepositoryError("Mã QR không hợp lệ.");
    }
    throw repositoryError("ghi nhận quét QR", result.error);
  }
  const row = (Array.isArray(result.data) ? result.data[0] : result.data) as Record<string, unknown>;
  const event = eventFromRow(row);
  if (!event) {
    throw new GateScanRepositoryError("Cơ sở trong lượt quét QR không hợp lệ.");
  }
  return event;
}

// --- public API -----------------------------------------------------------

export async function getRecentGateScans(siteId: ErpSiteId): Promise<GateScanEvent[]> {
  if (readMode() === "supabase") return readSupabaseScans(siteId);
  return readCookieScans(siteId);
}

export async function recordGateScan(input: RecordGateScanInput): Promise<GateScanEvent> {
  if (readMode() === "supabase") return recordInSupabase(input);
  return recordInCookie(input);
}
