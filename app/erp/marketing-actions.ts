"use server";

import { revalidatePath } from "next/cache";
import {
  MarketingCampaignInputSchema,
  MarketingQrDestinationUpdateSchema,
  MarketingQrSourceInputSchema,
} from "@/domain/marketing-qr";
import {
  createMarketingCampaign,
  createMarketingQrSource,
  MarketingQrRepositoryError,
  updateMarketingQrDestination,
} from "@/lib/customer-data/marketing-qr-repository";
import { getCurrentErpUser } from "@/lib/erp/demo-session";

export type MarketingQrActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

function errorState(error: unknown): MarketingQrActionState {
  if (error instanceof MarketingQrRepositoryError) {
    return { status: "error", message: error.message };
  }
  if (error instanceof Error) return { status: "error", message: error.message };
  return { status: "error", message: "Chưa thể cập nhật QR marketing." };
}

async function requireMarketingDirector() {
  const user = await getCurrentErpUser();
  if (!user) throw new Error("Phiên đăng nhập đã hết hạn.");
  if (user.mustChangePassword) throw new Error("Cần đổi mật khẩu trước khi cập nhật marketing.");
  if (user.role !== "director") throw new Error("Chỉ giám đốc được quản lý campaign và QR động.");
  return user;
}

export async function createMarketingCampaignAction(
  _previous: MarketingQrActionState,
  formData: FormData,
): Promise<MarketingQrActionState> {
  try {
    const input = MarketingCampaignInputSchema.parse({
      code: formData.get("code"),
      name: formData.get("name"),
      status: formData.get("status"),
    });
    const user = await requireMarketingDirector();
    await createMarketingCampaign({ ...input, actorAccountId: user.id });
    revalidatePath("/erp/marketing");
    return { status: "success", message: "Đã tạo campaign và ghi audit." };
  } catch (error) {
    return errorState(error);
  }
}

export async function createMarketingQrSourceAction(
  _previous: MarketingQrActionState,
  formData: FormData,
): Promise<MarketingQrActionState> {
  try {
    const input = MarketingQrSourceInputSchema.parse({
      campaignId: formData.get("campaignId"),
      code: formData.get("code"),
      placementId: formData.get("placementId"),
      placementLabel: formData.get("placementLabel"),
      destinationPath: formData.get("destinationPath"),
      status: formData.get("status"),
    });
    const user = await requireMarketingDirector();
    await createMarketingQrSource({ ...input, actorAccountId: user.id });
    revalidatePath("/erp/marketing");
    return { status: "success", message: "Đã tạo mã QR động. In lại mã không cần thiết khi chỉ đổi đích." };
  } catch (error) {
    return errorState(error);
  }
}

export async function updateMarketingQrDestinationAction(
  _previous: MarketingQrActionState,
  formData: FormData,
): Promise<MarketingQrActionState> {
  try {
    const input = MarketingQrDestinationUpdateSchema.parse({
      sourceId: formData.get("sourceId"),
      expectedVersion: formData.get("expectedVersion"),
      destinationPath: formData.get("destinationPath"),
    });
    const user = await requireMarketingDirector();
    await updateMarketingQrDestination({ ...input, actorAccountId: user.id });
    revalidatePath("/erp/marketing");
    return { status: "success", message: "Đã đổi đích QR và ghi lịch sử. Mã in vẫn giữ nguyên." };
  } catch (error) {
    return errorState(error);
  }
}
