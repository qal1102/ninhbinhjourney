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
  createCapacityThreshold,
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
  capacityModel: z.enum(["round-trip", "static"]),
  staticCapacity: z
    .union([z.literal(""), z.coerce.number().int().min(1).max(100_000)])
    .transform((value) => (value === "" ? null : value)),
  // Hệ số chỉ được **hạ** công suất. Cho phép > 1 là để một con số bịa lọt vào
  // đúng chỗ quyết định bán bao nhiêu vé.
  safetyFactor: z.coerce
    .number()
    .gt(0, "Hệ số an toàn phải lớn hơn 0.")
    .max(1, "Hệ số an toàn không được vượt quá 1."),
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
      capacityModel: formData.get("capacityModel"),
      staticCapacity: formData.get("staticCapacity") ?? "",
      safetyFactor: formData.get("safetyFactor"),
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
      capacityModel: input.capacityModel,
      staticCapacity: input.staticCapacity,
      safetyFactor: input.safetyFactor,
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

/**
 * TC-01. Thêm một điểm nghẽn mới tại cơ sở.
 *
 * Trước migration `202608260049` sản phẩm không có hành động này, nên mỗi cơ
 * sở chỉ có đúng một ngưỡng và phép "MIN của mọi điểm nghẽn" chạy trên một tập
 * một phần tử.
 *
 * `"use server"` chỉ được export hàm async — schema dưới đây cố ý **không**
 * export. Vi phạm quy tắc đó đã làm sập `next build` ba lần trong dự án này.
 */
const CreateThresholdSchema = ThresholdSchema.omit({
  thresholdId: true,
  expectedVersion: true,
}).extend({
  thresholdCode: z
    .string()
    .trim()
    .min(4, "Mã điểm nghẽn cần ít nhất 4 ký tự.")
    .max(40)
    .regex(/^[A-Za-z0-9-]+$/, "Mã chỉ gồm chữ, số và dấu gạch ngang."),
  bottleneckName: z
    .string()
    .trim()
    .min(3, "Tên điểm nghẽn cần ít nhất 3 ký tự.")
    .max(160),
  bottleneckKind: z.enum([
    "boat-pier",
    "ticket-gate",
    "electric-shuttle",
    "parking",
    "waiting-area",
    "cave-channel",
    "drop-off",
    "rescue",
    "boat-crew",
  ]),
});

export async function createCapacityThresholdAction(
  _previous: CapacityActionState,
  formData: FormData,
): Promise<CapacityActionState> {
  try {
    const input = CreateThresholdSchema.parse({
      siteId: formData.get("siteId"),
      thresholdCode: formData.get("thresholdCode"),
      bottleneckName: formData.get("bottleneckName"),
      bottleneckKind: formData.get("bottleneckKind"),
      capacityModel: formData.get("capacityModel"),
      vehicleCount: formData.get("vehicleCount"),
      seatsPerVehicle: formData.get("seatsPerVehicle"),
      roundTripMinutes: formData.get("roundTripMinutes"),
      staticCapacity: formData.get("staticCapacity") ?? "",
      safetyFactor: formData.get("safetyFactor"),
      sourceKind: formData.get("sourceKind"),
      sourceNote: formData.get("sourceNote"),
    });
    if (!isErpSiteId(input.siteId)) throw new Error("Cơ sở không hợp lệ.");
    if (input.capacityModel === "static" && input.staticCapacity === null) {
      throw new Error("Sức chứa tĩnh phải có số chỗ cụ thể.");
    }

    const user = await getCurrentErpUser();
    if (!user) throw new Error("Phiên đăng nhập đã hết hạn.");
    if (
      user.role !== "director" ||
      !accountCanAccessSite(user, input.siteId) ||
      !accountCanAccessModule(user, input.siteId, "suc-chua")
    ) {
      throw new Error("Chỉ giám đốc được thêm điểm nghẽn.");
    }

    await createCapacityThreshold({
      siteId: input.siteId,
      actorAccountId: user.id,
      actorDisplayName: user.name,
      thresholdCode: input.thresholdCode.toUpperCase(),
      bottleneckName: input.bottleneckName,
      bottleneckKind: input.bottleneckKind,
      capacityModel: input.capacityModel,
      vehicleCount: input.vehicleCount,
      seatsPerVehicle: input.seatsPerVehicle,
      roundTripMinutes: input.roundTripMinutes,
      staticCapacity: input.staticCapacity,
      safetyFactor: input.safetyFactor,
      sourceKind: input.sourceKind,
      sourceNote: input.sourceNote,
    });
    revalidatePath(`/erp/${input.siteId}/suc-chua`);
    return {
      status: "success",
      message:
        "Đã thêm điểm nghẽn và ghi lịch sử. Sức chứa bán ra lấy theo điểm nghẽn thấp nhất.",
    };
  } catch (error) {
    return errorState(error);
  }
}
