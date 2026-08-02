"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isErpSiteId } from "@/domain/erp";
import {
  accountCanAccessModule,
  accountCanAccessSite,
  getCurrentErpUser,
} from "@/lib/erp/demo-session";
import { findDemoErpAccountById } from "@/lib/erp/demo-data";
import {
  ShiftHandoverRepositoryError,
  decideShiftHandover,
  submitShiftHandover,
} from "@/lib/erp/shift-handover-repository";

// Not exported: a "use server" file may only export async functions. This
// object export was the second instance of the bug documented next to
// AccountActionState in app/erp/account-actions.ts -- ModuleWorkspace bundles
// every module's actions into one server-action chunk, so a bad export here
// breaks POSTs from unrelated module pages too, not just this one's.
type ShiftHandoverActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

function errorState(error: unknown): ShiftHandoverActionState {
  if (error instanceof z.ZodError) {
    return {
      status: "error",
      message: error.issues[0]?.message ?? "Dữ liệu gửi lên chưa đúng định dạng.",
    };
  }
  if (error instanceof ShiftHandoverRepositoryError) {
    return { status: "error", message: error.message };
  }
  if (error instanceof Error) return { status: "error", message: error.message };
  return { status: "error", message: "Không thể xử lý bàn giao ca lúc này." };
}

const SubmitSchema = z.object({
  siteId: z.string().trim(),
  businessDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày phải theo định dạng YYYY-MM-DD."),
  shiftLabel: z.string().trim().min(3, "Tên ca phải có ít nhất 3 ký tự.").max(80),
  stationCode: z.string().trim().min(2, "Mã vị trí phải có ít nhất 2 ký tự.").max(40),
  incomingAccountId: z.string().trim().min(2, "Chọn người nhận ca."),
  cashCountedVnd: z.coerce.number().int().min(0, "Tiền mặt không được âm."),
  cashExpectedVnd: z.coerce.number().int().min(0, "Số phải nộp không được âm."),
  openIncidentCodes: z.string().trim().max(500),
  equipmentNote: z.string().trim().max(2_000),
  handoverNote: z
    .string()
    .trim()
    .min(4, "Ghi chú bàn giao phải có ít nhất 4 ký tự.")
    .max(2_000),
});

export async function submitShiftHandoverAction(
  _previous: ShiftHandoverActionState,
  formData: FormData,
): Promise<ShiftHandoverActionState> {
  try {
    const input = SubmitSchema.parse({
      siteId: formData.get("siteId"),
      businessDate: formData.get("businessDate"),
      shiftLabel: formData.get("shiftLabel"),
      stationCode: formData.get("stationCode"),
      incomingAccountId: formData.get("incomingAccountId"),
      cashCountedVnd: formData.get("cashCountedVnd"),
      cashExpectedVnd: formData.get("cashExpectedVnd"),
      openIncidentCodes: formData.get("openIncidentCodes") ?? "",
      equipmentNote: formData.get("equipmentNote") ?? "",
      handoverNote: formData.get("handoverNote"),
    });
    if (!isErpSiteId(input.siteId)) throw new Error("Cơ sở không hợp lệ.");
    const siteId = input.siteId;

    const user = await getCurrentErpUser();
    if (!user) throw new Error("Phiên đăng nhập đã hết hạn.");
    if (
      !accountCanAccessSite(user, siteId) ||
      !accountCanAccessModule(user, siteId, "nhan-su")
    ) {
      throw new Error("Bạn không được phân công ca trực tại cơ sở này.");
    }
    // Being shift leader is a duty for one shift, not a title: whoever is
    // handing this shift over is the person signing it, and the database
    // refuses if that is the same account as the one taking it on.
    if (input.incomingAccountId === user.id) {
      throw new Error("Người bàn giao và người nhận ca phải là hai người khác nhau.");
    }
    const incoming = findDemoErpAccountById(input.incomingAccountId);
    if (!incoming) throw new Error("Không tìm thấy người nhận ca.");

    const canonical = JSON.stringify({ ...input, outgoing: user.id });
    const idempotencyKey =
      "handover:" +
      createHash("sha256").update(canonical, "utf8").digest("hex").slice(0, 48);

    await submitShiftHandover({
      siteId,
      businessDate: input.businessDate,
      shiftLabel: input.shiftLabel,
      stationCode: input.stationCode,
      outgoingAccountId: user.id,
      outgoingDisplayName: user.name,
      incomingAccountId: incoming.id,
      incomingDisplayName: incoming.name,
      cashCountedVnd: input.cashCountedVnd,
      cashExpectedVnd: input.cashExpectedVnd,
      openIncidentCodes: input.openIncidentCodes
        .split(/[,\s]+/)
        .map((code) => code.trim().toUpperCase())
        .filter(Boolean)
        .slice(0, 20),
      equipmentNote: input.equipmentNote,
      handoverNote: input.handoverNote,
      idempotencyKey,
    });
    revalidatePath(`/erp/${siteId}/nhan-su`);
    return {
      status: "success",
      message: `Đã gửi bàn giao ca cho ${incoming.name}. Ca chỉ khép lại khi người nhận xác nhận.`,
    };
  } catch (error) {
    return errorState(error);
  }
}

export async function decideShiftHandoverAction(
  _previous: ShiftHandoverActionState,
  formData: FormData,
): Promise<ShiftHandoverActionState> {
  try {
    const user = await getCurrentErpUser();
    if (!user) throw new Error("Phiên đăng nhập đã hết hạn.");
    const handoverId = String(formData.get("handoverId") ?? "").trim();
    const siteValue = String(formData.get("siteId") ?? "").trim();
    const expectedVersion = Number(formData.get("expectedVersion") ?? 0);
    const accept = String(formData.get("decision") ?? "") === "accept";
    const note = String(formData.get("note") ?? "").trim();
    if (!handoverId || !isErpSiteId(siteValue) || !Number.isInteger(expectedVersion)) {
      throw new Error("Dữ liệu bàn giao không hợp lệ.");
    }
    if (!accept && note.length < 4) {
      throw new Error("Từ chối nhận ca phải nêu lý do.");
    }
    await decideShiftHandover({
      handoverId,
      expectedVersion,
      actorAccountId: user.id,
      actorDisplayName: user.name,
      accept,
      note,
    });
    revalidatePath(`/erp/${siteValue}/nhan-su`);
    return {
      status: "success",
      message: accept
        ? "Đã nhận ca. Trách nhiệm ca chuyển sang bạn từ thời điểm này."
        : "Đã ghi nhận từ chối nhận ca kèm lý do.",
    };
  } catch (error) {
    return errorState(error);
  }
}
