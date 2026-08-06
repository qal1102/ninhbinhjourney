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
  CapacityRepositoryError,
  updateCapacityThreshold,
} from "@/lib/erp/capacity-repository";

type CapacityActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

const ThresholdSchema = z.object({
  siteId: z.string().trim(),
  thresholdId: z.uuid("Mã ngưỡng không hợp lệ."),
  expectedVersion: z.coerce.number().int().min(1),
  vehicleCount: z.coerce
    .number()
    .int("Số phương tiện phải là số nguyên.")
    .min(1, "Phải có ít nhất một phương tiện.")
    .max(10_000),
  seatsPerVehicle: z.coerce
    .number()
    .int("Số chỗ phải là số nguyên.")
    .min(1, "Mỗi phương tiện phải có ít nhất một chỗ.")
    .max(500),
  roundTripMinutes: z.coerce
    .number()
    .min(1, "Thời gian vòng phải từ một phút.")
    .max(1_440),
  sourceKind: z.enum(["estimate", "customer", "measured"]),
  sourceNote: z
    .string()
    .trim()
    .min(8, "Ghi rõ nguồn hoặc giả định, ít nhất 8 ký tự.")
    .max(1_000),
});

function errorState(error: unknown): CapacityActionState {
  if (error instanceof z.ZodError) {
    return {
      status: "error",
      message: error.issues[0]?.message ?? "Dữ liệu ngưỡng chưa đúng định dạng.",
    };
  }
  if (error instanceof CapacityRepositoryError) {
    return { status: "error", message: error.message };
  }
  if (error instanceof Error) return { status: "error", message: error.message };
  return { status: "error", message: "Chưa thể cập nhật ngưỡng sức chứa." };
}

export async function updateCapacityThresholdAction(
  _previous: CapacityActionState,
  formData: FormData,
): Promise<CapacityActionState> {
  try {
    const input = ThresholdSchema.parse({
      siteId: formData.get("siteId"),
      thresholdId: formData.get("thresholdId"),
      expectedVersion: formData.get("expectedVersion"),
      vehicleCount: formData.get("vehicleCount"),
      seatsPerVehicle: formData.get("seatsPerVehicle"),
      roundTripMinutes: formData.get("roundTripMinutes"),
      sourceKind: formData.get("sourceKind"),
      sourceNote: formData.get("sourceNote"),
    });
    if (!isErpSiteId(input.siteId)) throw new Error("Cơ sở không hợp lệ.");

    const user = await getCurrentErpUser();
    if (!user) throw new Error("Phiên đăng nhập đã hết hạn.");
    if (
      user.role !== "director" ||
      !accountCanAccessSite(user, input.siteId) ||
      !accountCanAccessModule(user, input.siteId, "suc-chua")
    ) {
      throw new Error("Chỉ giám đốc được thay đổi giả định sức chứa.");
    }

    await updateCapacityThreshold({
      thresholdId: input.thresholdId,
      actorAccountId: user.id,
      actorDisplayName: user.name,
      expectedVersion: input.expectedVersion,
      vehicleCount: input.vehicleCount,
      seatsPerVehicle: input.seatsPerVehicle,
      roundTripMinutes: input.roundTripMinutes,
      sourceKind: input.sourceKind,
      sourceNote: input.sourceNote,
    });
    revalidatePath(`/erp/${input.siteId}/suc-chua`);
    return {
      status: "success",
      message:
        "Đã cập nhật giả định và ghi lịch sử. Sức chứa theo giờ được tính lại từ ba đầu vào.",
    };
  } catch (error) {
    return errorState(error);
  }
}
