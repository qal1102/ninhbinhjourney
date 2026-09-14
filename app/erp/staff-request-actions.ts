"use server";

import { revalidatePath } from "next/cache";
import { isErpSiteId } from "@/domain/erp";
import {
  STAFF_REQUEST_TYPES,
  STAFF_REQUEST_TYPE_LABELS,
  validateStaffRequestDraft,
  type StaffRequest,
  type StaffRequestType,
} from "@/domain/erp-staff-requests";
import { getCurrentErpUser } from "@/lib/erp/demo-session";
import {
  StaffRequestRepositoryError,
  createStaffRequest,
  transitionStaffRequest,
  type StaffRequestActor,
} from "@/lib/erp/staff-request-repository";

/** ERP-DE-XUAT-01 — lệnh phía máy chủ của màn hình Đề xuất. */

export type StaffRequestActionResult =
  | { ok: true; message: string; request: StaffRequest }
  | { ok: false; message: string };

function homNayVietNam() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());
}

async function nguoiThaoTac(): Promise<StaffRequestActor | null> {
  const user = await getCurrentErpUser();
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    role: user.role,
    siteIds: user.siteIds,
    actingDirectorId: user.actingAs?.directorId ?? null,
  };
}

function loi(error: unknown, fallback: string): StaffRequestActionResult {
  if (error instanceof StaffRequestRepositoryError) return { ok: false, message: error.message };
  console.error("Staff request action failed", error);
  return { ok: false, message: fallback };
}

export async function createStaffRequestAction(input: {
  siteId: string;
  type: string;
  fields: Record<string, string>;
  requestKey: string;
}): Promise<StaffRequestActionResult> {
  const actor = await nguoiThaoTac();
  if (!actor) return { ok: false, message: "Phiên đăng nhập đã hết hạn." };
  if (!isErpSiteId(input.siteId)) return { ok: false, message: "Chọn cơ sở gửi đề xuất." };
  if (!(STAFF_REQUEST_TYPES as readonly string[]).includes(input.type)) {
    return { ok: false, message: "Chọn loại đề xuất." };
  }
  const type = input.type as StaffRequestType;
  const fields: Record<string, string> = {};
  for (const [key, value] of Object.entries(input.fields ?? {})) {
    if (typeof value === "string") fields[key] = value.slice(0, 1200);
  }
  const kiem = validateStaffRequestDraft({ type, fields, today: homNayVietNam() });
  if (!kiem.ok) return { ok: false, message: kiem.reason };
  const requestKey = String(input.requestKey ?? "");
  if (requestKey.length < 8 || requestKey.length > 128) {
    return { ok: false, message: "Phiếu đề xuất thiếu mã chống gửi trùng. Xin tải lại trang." };
  }
  try {
    const request = await createStaffRequest({
      actor,
      siteId: input.siteId,
      type,
      details: kiem.details,
      amountVnd: kiem.amountVnd,
      requestKey,
    });
    revalidatePath("/erp/de-xuat");
    return {
      ok: true,
      request,
      message: `Đã gửi đề xuất ${STAFF_REQUEST_TYPE_LABELS[type].toLowerCase()} ${request.code}.`,
    };
  } catch (error) {
    return loi(error, "Chưa gửi được đề xuất. Xin thử lại; nếu vẫn vậy thì báo bộ phận kỹ thuật.");
  }
}

export async function decideStaffRequestAction(input: {
  code: string;
  decision: string;
  note: string;
}): Promise<StaffRequestActionResult> {
  const actor = await nguoiThaoTac();
  if (!actor) return { ok: false, message: "Phiên đăng nhập đã hết hạn." };
  if (input.decision !== "approve" && input.decision !== "reject") {
    return { ok: false, message: "Chọn duyệt hay từ chối." };
  }
  const note = String(input.note ?? "").trim().slice(0, 500);
  if (input.decision === "reject" && note.length < 5) {
    return { ok: false, message: "Từ chối thì ghi lý do, ít nhất năm ký tự, để người gửi biết đường sửa." };
  }
  try {
    const request = await transitionStaffRequest({
      actor,
      code: String(input.code ?? "").trim().toUpperCase(),
      transition: { kind: "decide", decision: input.decision, note },
    });
    revalidatePath("/erp/de-xuat");
    const message =
      request.status === "pending-director"
        ? `Đã đồng ý ${request.code}. Khoản này vượt ngưỡng nên chuyển tiếp lên giám đốc.`
        : request.status === "rejected"
          ? `Đã từ chối ${request.code}.`
          : request.type === "huy-phieu-quay"
            ? `Đã duyệt ${request.code} và huỷ phiếu ${String(request.details.sale_code ?? "")}. Nhớ hoàn tiền cho khách.`
            : `Đã duyệt ${request.code}.`;
    return { ok: true, request, message };
  } catch (error) {
    return loi(error, "Chưa lưu được quyết định. Xin thử lại; nếu vẫn vậy thì báo bộ phận kỹ thuật.");
  }
}

export async function cancelStaffRequestAction(input: { code: string }): Promise<StaffRequestActionResult> {
  const actor = await nguoiThaoTac();
  if (!actor) return { ok: false, message: "Phiên đăng nhập đã hết hạn." };
  try {
    const request = await transitionStaffRequest({
      actor,
      code: String(input.code ?? "").trim().toUpperCase(),
      transition: { kind: "cancel" },
    });
    revalidatePath("/erp/de-xuat");
    return { ok: true, request, message: `Đã rút đề xuất ${request.code}.` };
  } catch (error) {
    return loi(error, "Chưa rút được đề xuất. Xin thử lại.");
  }
}

export async function completeStaffRequestAction(input: {
  code: string;
  note: string;
}): Promise<StaffRequestActionResult> {
  const actor = await nguoiThaoTac();
  if (!actor) return { ok: false, message: "Phiên đăng nhập đã hết hạn." };
  const note = String(input.note ?? "").trim().slice(0, 500);
  if (note.length < 5) return { ok: false, message: "Ghi đã chi hay đã sửa thế nào, ít nhất năm ký tự." };
  try {
    const request = await transitionStaffRequest({
      actor,
      code: String(input.code ?? "").trim().toUpperCase(),
      transition: { kind: "complete", note },
    });
    revalidatePath("/erp/de-xuat");
    return { ok: true, request, message: `Đã ghi hoàn tất ${request.code}.` };
  } catch (error) {
    return loi(error, "Chưa ghi được hoàn tất. Xin thử lại.");
  }
}
