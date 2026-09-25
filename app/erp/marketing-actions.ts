"use server";

import { revalidatePath } from "next/cache";
import { generateCode, MARKETING_CODE_SHAPE } from "@/domain/auto-code";
import {
  MarketingCampaignInputSchema,
  MarketingCodeSchema,
  MarketingQrDestinationUpdateSchema,
  MarketingQrSourceInputSchema,
} from "@/domain/marketing-qr";
import {
  createMarketingCampaign,
  createMarketingQrSource,
  ganDipChienDich,
  listMarketingQrConfig,
  MarketingQrRepositoryError,
  updateMarketingQrDestination,
} from "@/lib/customer-data/marketing-qr-repository";
import { getCurrentErpUser } from "@/lib/erp/demo-session";
import { CAC_DIP } from "@/domain/lich-mua-vu";

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
    const { name, status } = MarketingCampaignInputSchema.omit({ code: true }).parse({
      name: formData.get("name"),
      status: formData.get("status"),
    });
    const user = await requireMarketingDirector();
    // Phải đọc được danh sách mã đang dùng trước khi sinh mã mới — sinh mã
    // trong lúc không biết chỗ nào đã có là cách chắc chắn tạo ra trùng mã.
    const config = await listMarketingQrConfig();
    const code = MarketingCodeSchema.parse(
      generateCode(name, config.campaigns.map((campaign) => campaign.code), MARKETING_CODE_SHAPE),
    );
    const dipId = docDip(formData);
    const campaignId = await createMarketingCampaign({ code, name, status, actorAccountId: user.id });
    // Gắn dịp là bước thứ hai, cố ý tách khỏi lúc tạo: hàm tạo chiến dịch đã
    // chạy trên production từ tháng Tám, đổi chữ ký của nó là đụng vào đường
    // đang dùng. Gắn hỏng thì chiến dịch vẫn còn, và câu báo nói đúng như vậy.
    if (dipId) {
      try {
        await ganDipChienDich({ campaignId, dipId, actorAccountId: user.id });
      } catch {
        revalidatePath("/erp/marketing");
        return {
          status: "error",
          message: `Đã tạo chiến dịch “${name}” (mã ${code}), nhưng chưa gắn được vào dịp. Xin chọn lại dịp ở danh sách chiến dịch bên dưới.`,
        };
      }
    }
    revalidatePath("/erp/marketing");
    const tenDip = dipId ? CAC_DIP.find((d) => d.id === dipId)?.ten : undefined;
    return {
      status: "success",
      message: tenDip
        ? `Đã tạo chiến dịch “${name}”, mã ${code}, gắn vào dịp ${tenDip}.`
        : `Đã tạo chiến dịch “${name}”, mã ${code}.`,
    };
  } catch (error) {
    return errorState(error);
  }
}

/** Mã dịp từ ô chọn, chỉ nhận đúng các dịp có trong lịch mùa vụ. */
function docDip(formData: FormData) {
  const gia = formData.get("dip");
  const dip = typeof gia === "string" ? gia.trim() : "";
  if (!dip) return "";
  if (!CAC_DIP.some((d) => d.id === dip)) throw new Error("Dịp đã chọn không có trong lịch mùa vụ.");
  return dip;
}

export async function ganDipChienDichAction(
  _previous: MarketingQrActionState,
  formData: FormData,
): Promise<MarketingQrActionState> {
  try {
    const user = await requireMarketingDirector();
    const campaignId = String(formData.get("campaignId") ?? "").trim();
    if (!campaignId) return { status: "error", message: "Không rõ chiến dịch nào." };
    const dipId = docDip(formData);
    await ganDipChienDich({ campaignId, dipId, actorAccountId: user.id });
    revalidatePath("/erp/marketing");
    const tenDip = dipId ? CAC_DIP.find((d) => d.id === dipId)?.ten : undefined;
    return {
      status: "success",
      message: tenDip ? `Đã gắn vào dịp ${tenDip}.` : "Đã gỡ khỏi dịp.",
    };
  } catch (error) {
    return errorState(error);
  }
}

export async function createMarketingQrSourceAction(
  _previous: MarketingQrActionState,
  formData: FormData,
): Promise<MarketingQrActionState> {
  try {
    const { campaignId, placementLabel, destinationPath, status } = MarketingQrSourceInputSchema
      .omit({ code: true, placementId: true })
      .parse({
        campaignId: formData.get("campaignId"),
        placementLabel: formData.get("placementLabel"),
        destinationPath: formData.get("destinationPath"),
        status: formData.get("status"),
      });
    const user = await requireMarketingDirector();
    // Cùng lý do như tạo campaign: phải thấy hết mã và vị trí đang dùng
    // trước khi đặt mã mới, không thì hai người bấm cùng lúc sẽ trùng mã.
    const config = await listMarketingQrConfig();
    const campaign = config.campaigns.find((item) => item.id === campaignId);
    if (!campaign) {
      return { status: "error", message: "Không tìm thấy chiến dịch này. Bạn tải lại trang rồi thử lại giúp em." };
    }
    const placementId = MarketingCodeSchema.parse(
      generateCode(placementLabel, config.sources.map((source) => source.placementId), MARKETING_CODE_SHAPE),
    );
    const code = MarketingCodeSchema.parse(
      generateCode(`${campaign.code} ${placementLabel}`, config.sources.map((source) => source.code), MARKETING_CODE_SHAPE),
    );
    await createMarketingQrSource({
      campaignId,
      code,
      placementId,
      placementLabel,
      destinationPath,
      status,
      actorAccountId: user.id,
    });
    revalidatePath("/erp/marketing");
    return { status: "success", message: `Đã tạo mã QR động cho “${placementLabel}”, mã ${code} (vị trí ${placementId}).` };
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
