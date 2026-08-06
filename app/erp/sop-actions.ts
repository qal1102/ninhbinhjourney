"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isErpSiteId } from "@/domain/erp";
import {
  accountCanAccessModule,
  accountCanAccessSite,
  getCurrentErpUser,
} from "@/lib/erp/demo-session";
import {
  decideSopOpeningAssessment,
  SopRepositoryError,
  submitSopOpeningAssessment,
} from "@/lib/erp/sop-repository";

type SopActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

const BaseSchema = z.object({
  siteId: z.string().trim(),
  expectedVersion: z.coerce.number().int().min(0),
  idempotencyKey: z.string().trim().min(8).max(200),
});

const ResultSchema = z.object({
  itemId: z.uuid(),
  result: z.enum(["pass", "fail", "not-applicable"]),
  note: z.string().trim().max(1_200),
  evidenceReference: z.string().trim().max(1_000),
});

const SubmitSchema = BaseSchema.extend({
  businessDate: z.iso.date(),
  results: z.array(ResultSchema).min(1).max(40),
});

const DecisionSchema = BaseSchema.extend({
  assessmentId: z.uuid(),
  expectedVersion: z.coerce.number().int().min(1),
  decision: z.enum(["go", "no-go", "risk-accepted"]),
  decisionNote: z.string().trim().min(8).max(2_000),
  riskAcceptance: z.string().trim().max(4_000),
});

function actionError(error: unknown): SopActionState {
  if (error instanceof z.ZodError) {
    return {
      status: "error",
      message:
        error.issues[0]?.message ?? "Dữ liệu Go/No-Go chưa đúng định dạng.",
    };
  }
  if (error instanceof SopRepositoryError) {
    return { status: "error", message: error.message };
  }
  if (error instanceof Error) return { status: "error", message: error.message };
  return { status: "error", message: "Chưa thể hoàn tất thao tác Go/No-Go." };
}

export async function submitSopOpeningAssessmentAction(
  _previous: SopActionState,
  formData: FormData,
): Promise<SopActionState> {
  try {
    const itemIds = formData.getAll("itemId").map(String);
    const input = SubmitSchema.parse({
      siteId: formData.get("siteId"),
      businessDate: formData.get("businessDate"),
      expectedVersion: formData.get("expectedVersion"),
      idempotencyKey: formData.get("idempotencyKey"),
      results: itemIds.map((itemId) => ({
        itemId,
        result: formData.get(`result:${itemId}`),
        note: formData.get(`note:${itemId}`) ?? "",
        evidenceReference: formData.get(`evidence:${itemId}`) ?? "",
      })),
    });
    if (!isErpSiteId(input.siteId)) throw new Error("Cơ sở không hợp lệ.");

    const user = await getCurrentErpUser();
    if (!user) throw new Error("Phiên đăng nhập đã hết hạn.");
    if (
      user.role !== "manager" ||
      !accountCanAccessSite(user, input.siteId) ||
      !accountCanAccessModule(user, input.siteId, "sop-dien-tap")
    ) {
      throw new Error("Chỉ quản lý cơ sở được gửi checklist mở cửa.");
    }
    await submitSopOpeningAssessment({
      siteId: input.siteId,
      businessDate: input.businessDate,
      actorAccountId: user.id,
      actorDisplayName: user.name,
      expectedVersion: input.expectedVersion,
      results: input.results,
      idempotencyKey: input.idempotencyKey,
    });
    revalidatePath(`/erp/${input.siteId}/sop-dien-tap`);
    revalidatePath("/erp");
    return {
      status: "success",
      message: "Đã gửi checklist. Cổng mở cửa đang chờ giám đốc quyết định.",
    };
  } catch (error) {
    return actionError(error);
  }
}

export async function decideSopOpeningAssessmentAction(
  _previous: SopActionState,
  formData: FormData,
): Promise<SopActionState> {
  try {
    const input = DecisionSchema.parse({
      siteId: formData.get("siteId"),
      assessmentId: formData.get("assessmentId"),
      expectedVersion: formData.get("expectedVersion"),
      decision: formData.get("decision"),
      decisionNote: formData.get("decisionNote"),
      riskAcceptance: formData.get("riskAcceptance") ?? "",
      idempotencyKey: formData.get("idempotencyKey"),
    });
    if (!isErpSiteId(input.siteId)) throw new Error("Cơ sở không hợp lệ.");

    const user = await getCurrentErpUser();
    if (!user) throw new Error("Phiên đăng nhập đã hết hạn.");
    if (
      user.role !== "director" ||
      !accountCanAccessSite(user, input.siteId) ||
      !accountCanAccessModule(user, input.siteId, "sop-dien-tap")
    ) {
      throw new Error("Chỉ giám đốc được ra quyết định Go/No-Go.");
    }
    await decideSopOpeningAssessment({
      assessmentId: input.assessmentId,
      actorAccountId: user.id,
      actorDisplayName: user.name,
      expectedVersion: input.expectedVersion,
      decision: input.decision,
      decisionNote: input.decisionNote,
      riskAcceptance: input.riskAcceptance,
      idempotencyKey: input.idempotencyKey,
    });
    revalidatePath(`/erp/${input.siteId}/sop-dien-tap`);
    revalidatePath("/erp");
    return {
      status: "success",
      message: "Đã ghi quyết định và lịch sử Go/No-Go.",
    };
  } catch (error) {
    return actionError(error);
  }
}
