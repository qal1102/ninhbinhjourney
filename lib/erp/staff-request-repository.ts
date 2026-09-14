import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { ErpSiteId } from "@/domain/erp";
import {
  applyStaffRequestTransition,
  parseStaffRequest,
  parseStaffRequests,
  staffRequestNeedsDirector,
  staffRequestViewerCanSubmit,
  staffRequestVisibleTo,
  type StaffRequest,
  type StaffRequestTransition,
  type StaffRequestType,
  type StaffRequestViewer,
} from "@/domain/erp-staff-requests";
import { findRpcBusinessMessage } from "@/lib/erp/rpc-error-messages";
import { ERP_SHIFT_CLOSE_SITE_UUID_BY_SLUG } from "@/lib/erp/shift-close-repository";

/**
 * ERP-DE-XUAT-01 — kho đề xuất.
 *
 * Production (`ERP_PERSISTENCE_MODE=supabase`) đi thẳng các hàm SQL của
 * migration `202609140072`; mọi quyết định quyền và trạng thái nằm ở đó.
 *
 * Bản chạy thử cục bộ không có kho, nên dùng một kho tạm **trong bộ nhớ máy
 * chủ**, chép đúng luật qua `applyStaffRequestTransition`. Màn hình nói thẳng
 * điều ấy (`storage: "memory"`): khởi động lại máy chủ là mất. Riêng xin huỷ
 * phiếu quầy thì kho tạm từ chối, vì bản chạy thử không có phiếu quầy nào.
 */

const TENANT_ID = "00000000-0000-4000-8000-000000000001";

const SITE_SLUG_BY_UUID: ReadonlyMap<string, ErpSiteId> = new Map(
  Object.entries(ERP_SHIFT_CLOSE_SITE_UUID_BY_SLUG).map(([slug, uuid]) => [uuid, slug as ErpSiteId]),
);

export class StaffRequestRepositoryError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "StaffRequestRepositoryError";
  }
}

export type StaffRequestStorage = "supabase" | "memory";

export type StaffRequestActor = StaffRequestViewer & {
  name: string;
  actingDirectorId: string | null;
};

function isSupabaseMode() {
  return process.env.ERP_PERSISTENCE_MODE?.trim() === "supabase";
}

export function staffRequestStorage(): StaffRequestStorage {
  return isSupabaseMode() ? "supabase" : "memory";
}

function createAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const secret = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!url || !secret) {
    throw new StaffRequestRepositoryError("Kho đề xuất chưa nối được vào kho dữ liệu ở môi trường này.");
  }
  return createClient(url, secret, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
    global: { headers: { "X-Client-Info": "ninh-binh-journey-staff-requests" } },
  });
}

function tuChoi(error: unknown, fallback: string): StaffRequestRepositoryError {
  return new StaffRequestRepositoryError(findRpcBusinessMessage(error) ?? fallback, {
    cause: error instanceof Error ? error : undefined,
  });
}

function docMot(data: unknown): StaffRequest {
  const request = parseStaffRequest(data, SITE_SLUG_BY_UUID);
  if (!request) throw new StaffRequestRepositoryError("Máy chủ trả về đề xuất không đọc được.");
  return request;
}

// --- Kho tạm cho bản chạy thử ------------------------------------------------------------------

const khoTam: StaffRequest[] = [];
const khoaDaGui = new Map<string, string>();

function maMoi() {
  return `DX-${crypto.randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase()}`;
}

function loiTam(code: string): StaffRequestRepositoryError {
  return new StaffRequestRepositoryError(findRpcBusinessMessage({ message: code }) ?? "Chưa làm được việc này. Xin thử lại.");
}

// --- Việc ------------------------------------------------------------------------------------

export async function listStaffRequests(viewer: StaffRequestActor): Promise<StaffRequest[]> {
  if (!isSupabaseMode()) {
    return khoTam.filter((request) => staffRequestVisibleTo(viewer, request)).slice(0, 100);
  }
  const client = createAdminClient();
  const { data, error } = await client.rpc("erp_staff_requests_for_viewer", {
    p_tenant_id: TENANT_ID,
    p_viewer_account_id: viewer.id,
    p_limit: 100,
  });
  if (error) throw tuChoi(error, "Chưa đọc được danh sách đề xuất. Xin tải lại trang.");
  return parseStaffRequests(data, SITE_SLUG_BY_UUID);
}

export async function createStaffRequest(input: {
  actor: StaffRequestActor;
  siteId: ErpSiteId;
  type: StaffRequestType;
  details: Record<string, string | null>;
  amountVnd: number | null;
  requestKey: string;
}): Promise<StaffRequest> {
  if (!isSupabaseMode()) {
    const cu = khoaDaGui.get(input.requestKey);
    if (cu) {
      const daCo = khoTam.find((request) => request.code === cu);
      if (daCo) return daCo;
    }
    if (!staffRequestViewerCanSubmit(input.actor, input.siteId)) throw loiTam("STAFF_REQUEST_SUBMIT_NOT_ALLOWED");
    if (input.type === "huy-phieu-quay") {
      throw new StaffRequestRepositoryError(
        "Bản chạy thử chưa nối kho bán vé quầy, nên chưa có phiếu nào để xin huỷ.",
      );
    }
    const now = new Date().toISOString();
    const request: StaffRequest = {
      code: maMoi(),
      siteId: input.siteId,
      type: input.type,
      status: "submitted",
      details: { ...input.details },
      amountVnd: input.amountVnd,
      requestedById: input.actor.id,
      requestedByName: input.actor.name,
      lastActorName: null,
      lastNote: null,
      createdAt: now,
      updatedAt: now,
      needsDirector: staffRequestNeedsDirector(input.type, input.amountVnd),
      events: [
        { eventType: "staff-request.submitted", fromStatus: null, toStatus: "submitted", actorName: input.actor.name, note: "", occurredAt: now },
      ],
    };
    khoTam.unshift(request);
    khoaDaGui.set(input.requestKey, request.code);
    return request;
  }

  const client = createAdminClient();
  const { data, error } = await client.rpc("erp_create_staff_request", {
    p_tenant_id: TENANT_ID,
    p_site_id: ERP_SHIFT_CLOSE_SITE_UUID_BY_SLUG[input.siteId],
    p_actor_account_id: input.actor.id,
    p_actor_name: input.actor.name,
    p_acting_director_account_id: input.actor.actingDirectorId,
    p_request_type: input.type,
    p_details: input.details,
    p_amount_vnd: input.amountVnd,
    p_request_key: input.requestKey,
  });
  if (error) throw tuChoi(error, "Chưa gửi được đề xuất. Xin thử lại; nếu vẫn vậy thì báo bộ phận kỹ thuật.");
  return docMot(data);
}

export async function transitionStaffRequest(input: {
  actor: StaffRequestActor;
  code: string;
  transition: StaffRequestTransition;
}): Promise<StaffRequest> {
  if (!isSupabaseMode()) {
    const index = khoTam.findIndex((request) => request.code === input.code);
    if (index === -1) throw loiTam("STAFF_REQUEST_NOT_FOUND");
    const ketQua = applyStaffRequestTransition(khoTam[index], input.actor, input.transition, new Date().toISOString());
    if (!ketQua.ok) throw loiTam(ketQua.code);
    khoTam[index] = ketQua.request;
    return ketQua.request;
  }

  const client = createAdminClient();
  const chung = {
    p_tenant_id: TENANT_ID,
    p_request_code: input.code,
    p_actor_account_id: input.actor.id,
    p_actor_name: input.actor.name,
    p_acting_director_account_id: input.actor.actingDirectorId,
  };
  const { data, error } =
    input.transition.kind === "decide"
      ? await client.rpc("erp_decide_staff_request", {
          ...chung,
          p_decision: input.transition.decision,
          p_note: input.transition.note,
        })
      : input.transition.kind === "cancel"
        ? await client.rpc("erp_cancel_staff_request", chung)
        : await client.rpc("erp_complete_staff_request", { ...chung, p_note: input.transition.note });
  if (error) throw tuChoi(error, "Chưa lưu được bước này. Xin thử lại; nếu vẫn vậy thì báo bộ phận kỹ thuật.");
  return docMot(data);
}
