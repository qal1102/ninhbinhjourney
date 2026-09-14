/**
 * ERP-DE-XUAT-01 — đề xuất & phê duyệt.
 *
 * Luật thật nằm ở PostgreSQL (migration `202609140072_erp_staff_requests.sql`).
 * Tệp này giữ ba thứ cho màn hình: tên tiếng Việt, kiểm đầu vào để nói ngay
 * câu dễ hiểu trước khi gửi, và gợi ý nút nào hiện cho ai. Máy chủ vẫn kiểm
 * lại tất cả; màn hình đoán sai thì máy chủ từ chối, không có đường vòng.
 *
 * Bộ chuyển trạng thái `applyStaffRequestTransition` chỉ dùng cho kho tạm ở
 * bản chạy thử cục bộ, và chép đúng luật của các hàm SQL cùng tên việc.
 */

import type { ErpRole, ErpSiteId } from "@/domain/erp";

export type StaffRequestType = "nghi-phep" | "doi-ca" | "tam-ung" | "de-xuat-mua" | "sua-chua" | "huy-phieu-quay";

export type StaffRequestStatus = "submitted" | "pending-director" | "approved" | "rejected" | "cancelled" | "completed";

export const STAFF_REQUEST_TYPES: readonly StaffRequestType[] = [
  "nghi-phep",
  "doi-ca",
  "tam-ung",
  "de-xuat-mua",
  "sua-chua",
  "huy-phieu-quay",
];

export const STAFF_REQUEST_TYPE_LABELS: Readonly<Record<StaffRequestType, string>> = Object.freeze({
  "nghi-phep": "Xin nghỉ",
  "doi-ca": "Đổi ca",
  "tam-ung": "Tạm ứng",
  "de-xuat-mua": "Đề xuất mua",
  "sua-chua": "Sửa chữa",
  "huy-phieu-quay": "Xin huỷ phiếu quầy",
});

export const STAFF_REQUEST_TYPE_HINTS: Readonly<Record<StaffRequestType, string>> = Object.freeze({
  "nghi-phep": "Nghỉ một hay nhiều ngày, quản lý cơ sở duyệt.",
  "doi-ca": "Đổi sang ca khác, ghi người trực thay nếu đã nhờ được.",
  "tam-ung": "Ứng tiền trước cho việc chung; kế toán chi sau khi duyệt.",
  "de-xuat-mua": "Mua vật tư, thiết bị; kế toán mua hoặc chi sau khi duyệt.",
  "sua-chua": "Báo hỏng hóc cần sửa; quản lý ghi đã sửa xong.",
  "huy-phieu-quay": "Bán nhầm phiếu hôm nay; quản lý duyệt là phiếu bị huỷ.",
});

export const STAFF_REQUEST_STATUS_LABELS: Readonly<Record<StaffRequestStatus, string>> = Object.freeze({
  submitted: "Chờ quản lý duyệt",
  "pending-director": "Chờ giám đốc duyệt",
  approved: "Đã duyệt",
  rejected: "Bị từ chối",
  cancelled: "Người gửi đã rút",
  completed: "Đã hoàn tất",
});

/**
 * Khoản tạm ứng, đề xuất mua, sửa chữa vượt mức này thì quản lý duyệt xong còn
 * phải lên giám đốc. Chép đúng `erp_staff_request_director_threshold_vnd()`;
 * bài kiểm hợp đồng đọc migration để so, lệch là đỏ.
 */
export const STAFF_REQUEST_DIRECTOR_THRESHOLD_VND = 5_000_000;

/** Loại việc có tiền, và ai ghi hoàn tất sau khi duyệt. */
const LOAI_CO_TIEN: readonly StaffRequestType[] = ["tam-ung", "de-xuat-mua", "sua-chua"];
const LOAI_KE_TOAN_HOAN_TAT: readonly StaffRequestType[] = ["tam-ung", "de-xuat-mua"];

export type StaffRequestEvent = {
  eventType: string;
  fromStatus: StaffRequestStatus | null;
  toStatus: StaffRequestStatus;
  actorName: string;
  note: string;
  occurredAt: string;
};

export type StaffRequestDetails = Readonly<Record<string, string | number | null>>;

export type StaffRequest = {
  code: string;
  siteId: ErpSiteId;
  type: StaffRequestType;
  status: StaffRequestStatus;
  details: StaffRequestDetails;
  amountVnd: number | null;
  requestedById: string;
  requestedByName: string;
  lastActorName: string | null;
  lastNote: string | null;
  createdAt: string;
  updatedAt: string;
  needsDirector: boolean;
  events: StaffRequestEvent[];
};

export function staffRequestNeedsDirector(type: StaffRequestType, amountVnd: number | null): boolean {
  return LOAI_CO_TIEN.includes(type) && (amountVnd ?? 0) > STAFF_REQUEST_DIRECTOR_THRESHOLD_VND;
}

function laLoai(value: unknown): value is StaffRequestType {
  return typeof value === "string" && (STAFF_REQUEST_TYPES as readonly string[]).includes(value);
}

function laTrangThai(value: unknown): value is StaffRequestStatus {
  return typeof value === "string" && Object.hasOwn(STAFF_REQUEST_STATUS_LABELS, value);
}

export function parseStaffRequests(value: unknown, siteSlugByUuid: ReadonlyMap<string, ErpSiteId>): StaffRequest[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const parsed = parseStaffRequest(item, siteSlugByUuid);
    return parsed ? [parsed] : [];
  });
}

export function parseStaffRequest(value: unknown, siteSlugByUuid: ReadonlyMap<string, ErpSiteId>): StaffRequest | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const code = typeof row.request_code === "string" ? row.request_code : "";
  const siteId = siteSlugByUuid.get(String(row.site_id ?? ""));
  if (!/^DX-[0-9A-F]{10}$/.test(code) || !siteId || !laLoai(row.request_type) || !laTrangThai(row.status)) {
    return null;
  }
  const detailsRaw = row.details && typeof row.details === "object" && !Array.isArray(row.details) ? row.details : {};
  const details: Record<string, string | number | null> = {};
  for (const [key, val] of Object.entries(detailsRaw as Record<string, unknown>)) {
    if (typeof val === "string" || typeof val === "number" || val === null) details[key] = val;
  }
  const amount = row.amount_vnd === null || row.amount_vnd === undefined ? null : Number(row.amount_vnd);
  const events = Array.isArray(row.events) ? row.events : [];
  return {
    code,
    siteId,
    type: row.request_type,
    status: row.status,
    details,
    amountVnd: amount !== null && Number.isFinite(amount) ? amount : null,
    requestedById: String(row.requested_by_account_id ?? ""),
    requestedByName: String(row.requested_by_name ?? ""),
    lastActorName: typeof row.last_actor_name === "string" ? row.last_actor_name : null,
    lastNote: typeof row.last_note === "string" ? row.last_note : null,
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
    needsDirector: row.needs_director === true,
    events: events.flatMap((entry) => {
      if (!entry || typeof entry !== "object") return [];
      const e = entry as Record<string, unknown>;
      if (!laTrangThai(e.to_status)) return [];
      return [
        {
          eventType: String(e.event_type ?? ""),
          fromStatus: laTrangThai(e.from_status) ? e.from_status : null,
          toStatus: e.to_status,
          actorName: String(e.actor_name ?? ""),
          note: String(e.note ?? ""),
          occurredAt: String(e.occurred_at ?? ""),
        },
      ];
    }),
  };
}

// --- Kiểm đầu vào ------------------------------------------------------------------------

export type StaffRequestDraft = {
  type: StaffRequestType;
  fields: Readonly<Record<string, string>>;
  today: string;
};

export type StaffRequestDraftResult =
  | { ok: true; details: Record<string, string | null>; amountVnd: number | null }
  | { ok: false; reason: string };

function ngay(value: string | undefined): string | null {
  const v = (value ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const t = Date.parse(`${v}T00:00:00Z`);
  return Number.isNaN(t) || new Date(t).toISOString().slice(0, 10) !== v ? null : v;
}

function congNgay(ngayGoc: string, soNgay: number): string {
  return new Date(Date.parse(`${ngayGoc}T00:00:00Z`) + soNgay * 86_400_000).toISOString().slice(0, 10);
}

function doDai(value: string | undefined, min: number, max: number): string | null {
  const v = (value ?? "").trim();
  return v.length >= min && v.length <= max ? v : null;
}

function soTien(value: string | undefined): number | null {
  const chiSo = (value ?? "").replace(/[^0-9]/g, "");
  if (!chiSo) return null;
  const n = Number(chiSo);
  return Number.isSafeInteger(n) ? n : null;
}

/** Chép đúng các điều kiện của `erp_create_staff_request`, để báo lỗi trước khi gửi. */
export function validateStaffRequestDraft(draft: StaffRequestDraft): StaffRequestDraftResult {
  const f = draft.fields;
  const today = ngay(draft.today);
  if (!today) return { ok: false, reason: "Chưa đọc được ngày hôm nay, xin tải lại trang." };

  switch (draft.type) {
    case "nghi-phep": {
      const tu = ngay(f.from_date);
      const den = ngay(f.to_date);
      const lyDo = doDai(f.reason, 5, 500);
      if (!tu || !den) return { ok: false, reason: "Chọn ngày bắt đầu và ngày kết thúc nghỉ." };
      if (den < tu) return { ok: false, reason: "Ngày kết thúc phải từ ngày bắt đầu trở đi." };
      if (Date.parse(den) - Date.parse(tu) > 60 * 86_400_000) return { ok: false, reason: "Mỗi lần xin nghỉ tối đa 60 ngày." };
      if (tu < congNgay(today, -30)) return { ok: false, reason: "Chỉ xin nghỉ bù cho những ngày trong vòng 30 ngày qua." };
      if (tu > congNgay(today, 365)) return { ok: false, reason: "Chỉ xin nghỉ trước tối đa một năm." };
      if (!lyDo) return { ok: false, reason: "Ghi lý do nghỉ, ít nhất năm ký tự." };
      return { ok: true, details: { from_date: tu, to_date: den, reason: lyDo }, amountVnd: null };
    }
    case "doi-ca": {
      const ngayCa = ngay(f.shift_date);
      const caCu = doDai(f.current_shift, 1, 100);
      const caMoi = doDai(f.desired_shift, 1, 100);
      const lyDo = doDai(f.reason, 5, 500);
      const nguoiThay = (f.cover_name ?? "").trim();
      if (!ngayCa) return { ok: false, reason: "Chọn ngày cần đổi ca." };
      if (ngayCa < today) return { ok: false, reason: "Không đổi ca cho ngày đã qua." };
      if (ngayCa > congNgay(today, 90)) return { ok: false, reason: "Chỉ đổi ca trước tối đa 90 ngày." };
      if (!caCu || !caMoi) return { ok: false, reason: "Ghi ca đang trực và ca muốn đổi sang." };
      if (nguoiThay.length > 200) return { ok: false, reason: "Tên người trực thay dài quá." };
      if (!lyDo) return { ok: false, reason: "Ghi lý do đổi ca, ít nhất năm ký tự." };
      return {
        ok: true,
        details: { shift_date: ngayCa, current_shift: caCu, desired_shift: caMoi, cover_name: nguoiThay || null, reason: lyDo },
        amountVnd: null,
      };
    }
    case "tam-ung": {
      const tien = soTien(f.amount_vnd);
      const mucDich = doDai(f.purpose, 5, 500);
      if (!tien || tien > 100_000_000) return { ok: false, reason: "Số tiền tạm ứng từ 1 đồng tới 100.000.000 đồng." };
      if (!mucDich) return { ok: false, reason: "Ghi tạm ứng để làm gì, ít nhất năm ký tự." };
      return { ok: true, details: { purpose: mucDich }, amountVnd: tien };
    }
    case "de-xuat-mua": {
      const tien = soTien(f.amount_vnd);
      const hang = doDai(f.items, 3, 1000);
      const lyDo = doDai(f.reason, 5, 500);
      const nhaCungCap = (f.supplier ?? "").trim();
      if (!hang) return { ok: false, reason: "Ghi cần mua gì và bao nhiêu." };
      if (!tien) return { ok: false, reason: "Ghi số tiền ước tính." };
      if (nhaCungCap.length > 200) return { ok: false, reason: "Tên nơi mua dài quá." };
      if (!lyDo) return { ok: false, reason: "Ghi vì sao cần mua, ít nhất năm ký tự." };
      return { ok: true, details: { items: hang, supplier: nhaCungCap || null, reason: lyDo }, amountVnd: tien };
    }
    case "sua-chua": {
      const choHong = doDai(f.location, 2, 200);
      const tinhTrang = doDai(f.problem, 5, 1000);
      const tien = (f.amount_vnd ?? "").trim() ? soTien(f.amount_vnd) : null;
      if (!choHong) return { ok: false, reason: "Ghi chỗ hỏng ở đâu." };
      if (!tinhTrang) return { ok: false, reason: "Tả hỏng thế nào, ít nhất năm ký tự." };
      if (f.urgency !== "thuong" && f.urgency !== "gap") return { ok: false, reason: "Chọn mức gấp." };
      if ((f.amount_vnd ?? "").trim() && !tien) return { ok: false, reason: "Số tiền ước tính chưa đúng." };
      return { ok: true, details: { location: choHong, problem: tinhTrang, urgency: f.urgency }, amountVnd: tien };
    }
    case "huy-phieu-quay": {
      const maPhieu = (f.sale_code ?? "").trim().toUpperCase();
      const lyDo = doDai(f.reason, 10, 500);
      if (!/^PT-[0-9A-F]{12}$/.test(maPhieu)) return { ok: false, reason: "Mã phiếu có dạng PT- và 12 ký tự, in ở đầu phiếu thu." };
      if (!lyDo) return { ok: false, reason: "Ghi lý do huỷ và đã hoàn tiền cho khách chưa, ít nhất mười ký tự." };
      return { ok: true, details: { sale_code: maPhieu, reason: lyDo }, amountVnd: null };
    }
  }
}

// --- Ai được làm gì ------------------------------------------------------------------------

export type StaffRequestViewer = { id: string; role: ErpRole; siteIds: readonly ErpSiteId[] };

export function staffRequestViewerCanSubmit(viewer: StaffRequestViewer, siteId: ErpSiteId): boolean {
  if (viewer.role === "accountant" || viewer.role === "chief-accountant") return true;
  if (viewer.role === "employee" || viewer.role === "manager") return viewer.siteIds.includes(siteId);
  return false;
}

function quanLyDuoc(viewer: StaffRequestViewer, siteId: ErpSiteId) {
  return viewer.role === "director" || (viewer.role === "manager" && viewer.siteIds.includes(siteId));
}

function laKeToan(viewer: StaffRequestViewer) {
  return viewer.role === "accountant" || viewer.role === "chief-accountant";
}

export function staffRequestVisibleTo(viewer: StaffRequestViewer, request: StaffRequest): boolean {
  return (
    request.requestedById === viewer.id ||
    quanLyDuoc(viewer, request.siteId) ||
    (laKeToan(viewer) && LOAI_KE_TOAN_HOAN_TAT.includes(request.type))
  );
}

export type StaffRequestActions = {
  canDecide: boolean;
  canCancel: boolean;
  canComplete: boolean;
  completeLabel: string;
  /** Câu nói ngắn vì sao người này chưa làm được gì, khi đáng nói. */
  waitingFor: string | null;
};

export function staffRequestActionsFor(viewer: StaffRequestViewer, request: StaffRequest): StaffRequestActions {
  const cuaMinh = request.requestedById === viewer.id;
  const canDecide =
    !cuaMinh &&
    ((request.status === "submitted" && quanLyDuoc(viewer, request.siteId)) ||
      (request.status === "pending-director" && viewer.role === "director"));
  const canCancel = cuaMinh && request.status === "submitted";
  const keToanHoanTat = LOAI_KE_TOAN_HOAN_TAT.includes(request.type);
  const canComplete =
    !cuaMinh &&
    request.status === "approved" &&
    ((keToanHoanTat && laKeToan(viewer)) || (request.type === "sua-chua" && quanLyDuoc(viewer, request.siteId)));
  const completeLabel =
    request.type === "tam-ung" ? "Ghi đã chi tạm ứng" : request.type === "de-xuat-mua" ? "Ghi đã mua, đã chi" : "Ghi đã sửa xong";

  let waitingFor: string | null = null;
  if (request.status === "submitted") waitingFor = "Chờ quản lý cơ sở duyệt.";
  else if (request.status === "pending-director") waitingFor = "Vượt ngưỡng 5.000.000 đ, chờ giám đốc duyệt.";
  else if (request.status === "approved" && keToanHoanTat) waitingFor = "Đã duyệt, chờ kế toán chi.";
  else if (request.status === "approved" && request.type === "sua-chua") waitingFor = "Đã duyệt, chờ quản lý ghi đã sửa xong.";
  if (canDecide || canComplete) waitingFor = null;

  return { canDecide, canCancel, canComplete, completeLabel, waitingFor };
}

/** Đề xuất đang chờ chính người xem xử lý. */
export function staffRequestWaitsOn(viewer: StaffRequestViewer, request: StaffRequest): boolean {
  const a = staffRequestActionsFor(viewer, request);
  return a.canDecide || a.canComplete;
}

// --- Một dòng tóm tắt -----------------------------------------------------------------------

export function formatStaffRequestVnd(value: number): string {
  return `${new Intl.NumberFormat("vi-VN").format(value)} đ`;
}

function ngayVn(value: string | number | null | undefined): string {
  const [y, m, d] = String(value ?? "").split("-");
  return y && m && d ? `${d}/${m}/${y}` : String(value ?? "");
}

export function staffRequestSummary(request: Pick<StaffRequest, "type" | "details" | "amountVnd">): string {
  const d = request.details;
  switch (request.type) {
    case "nghi-phep":
      return d.from_date === d.to_date
        ? `Nghỉ ngày ${ngayVn(d.from_date)}: ${d.reason ?? ""}`
        : `Nghỉ từ ${ngayVn(d.from_date)} tới ${ngayVn(d.to_date)}: ${d.reason ?? ""}`;
    case "doi-ca":
      return `Ngày ${ngayVn(d.shift_date)}, ${d.current_shift ?? ""} sang ${d.desired_shift ?? ""}${d.cover_name ? `, ${d.cover_name} trực thay` : ""}: ${d.reason ?? ""}`;
    case "tam-ung":
      return `Ứng ${request.amountVnd ? formatStaffRequestVnd(request.amountVnd) : ""}: ${d.purpose ?? ""}`;
    case "de-xuat-mua":
      return `${d.items ?? ""}, ước tính ${request.amountVnd ? formatStaffRequestVnd(request.amountVnd) : ""}${d.supplier ? `, mua ở ${d.supplier}` : ""}`;
    case "sua-chua":
      return `${d.urgency === "gap" ? "Gấp · " : ""}${d.location ?? ""}: ${d.problem ?? ""}`;
    case "huy-phieu-quay":
      return `Phiếu ${d.sale_code ?? ""}${typeof d.sale_total_vnd === "number" ? ` (${formatStaffRequestVnd(d.sale_total_vnd)})` : ""}: ${d.reason ?? ""}`;
  }
}

// --- Kho tạm của bản chạy thử cục bộ ------------------------------------------------------------

export type StaffRequestTransition =
  | { kind: "decide"; decision: "approve" | "reject"; note: string }
  | { kind: "cancel" }
  | { kind: "complete"; note: string };

export type StaffRequestTransitionResult =
  | { ok: true; request: StaffRequest; eventType: string }
  | { ok: false; code: string };

/** Luật chuyển trạng thái, chép đúng `erp_decide/cancel/complete_staff_request`. */
export function applyStaffRequestTransition(
  request: StaffRequest,
  viewer: StaffRequestViewer & { name: string },
  transition: StaffRequestTransition,
  now: string,
): StaffRequestTransitionResult {
  const cuaMinh = request.requestedById === viewer.id;
  const buoc = (to: StaffRequestStatus, eventType: string, note: string | null): StaffRequestTransitionResult => ({
    ok: true,
    eventType,
    request: {
      ...request,
      status: to,
      lastActorName: viewer.name,
      lastNote: note,
      updatedAt: now,
      events: [
        ...request.events,
        { eventType, fromStatus: request.status, toStatus: to, actorName: viewer.name, note: note ?? "", occurredAt: now },
      ],
    },
  });

  if (transition.kind === "cancel") {
    if (!cuaMinh) return { ok: false, code: "STAFF_REQUEST_CANCEL_NOT_ALLOWED" };
    if (request.status !== "submitted") return { ok: false, code: "STAFF_REQUEST_NOT_PENDING" };
    return buoc("cancelled", "staff-request.cancelled", null);
  }

  if (transition.kind === "complete") {
    const note = transition.note.trim();
    if (note.length < 5 || note.length > 500) return { ok: false, code: "STAFF_REQUEST_COMPLETION_NOTE_REQUIRED" };
    if (request.status !== "approved" || !LOAI_CO_TIEN.includes(request.type)) {
      return { ok: false, code: "STAFF_REQUEST_NOT_COMPLETABLE" };
    }
    if (cuaMinh) return { ok: false, code: "STAFF_REQUEST_OWN_REQUEST" };
    const duoc = LOAI_KE_TOAN_HOAN_TAT.includes(request.type) ? laKeToan(viewer) : quanLyDuoc(viewer, request.siteId);
    if (!duoc) return { ok: false, code: "STAFF_REQUEST_COMPLETE_NOT_ALLOWED" };
    return buoc("completed", "staff-request.completed", note);
  }

  const note = transition.note.trim();
  if (note.length > 500) return { ok: false, code: "STAFF_REQUEST_INPUT_INVALID" };
  if (transition.decision === "reject" && note.length < 5) return { ok: false, code: "STAFF_REQUEST_REASON_REQUIRED" };
  if (cuaMinh) return { ok: false, code: "STAFF_REQUEST_OWN_REQUEST" };
  if (request.status === "submitted") {
    if (!quanLyDuoc(viewer, request.siteId)) return { ok: false, code: "STAFF_REQUEST_DECIDE_NOT_ALLOWED" };
  } else if (request.status === "pending-director") {
    if (viewer.role !== "director") return { ok: false, code: "STAFF_REQUEST_DIRECTOR_ONLY" };
  } else {
    return { ok: false, code: "STAFF_REQUEST_NOT_PENDING" };
  }
  if (transition.decision === "reject") return buoc("rejected", "staff-request.rejected", note);
  if (request.status === "submitted" && viewer.role !== "director" && staffRequestNeedsDirector(request.type, request.amountVnd)) {
    return buoc("pending-director", "staff-request.escalated", note || null);
  }
  return buoc("approved", "staff-request.approved", note || null);
}
