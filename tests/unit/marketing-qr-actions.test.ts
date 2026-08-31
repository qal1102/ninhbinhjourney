import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateCode, MARKETING_CODE_SHAPE } from "@/domain/auto-code";
import { MarketingCodeSchema } from "@/domain/marketing-qr";

const mocks = vi.hoisted(() => ({
  user: vi.fn(),
  listConfig: vi.fn(),
  createCampaign: vi.fn(),
  createSource: vi.fn(),
  updateDestination: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/erp/demo-session", () => ({ getCurrentErpUser: mocks.user }));
vi.mock("@/lib/customer-data/marketing-qr-repository", () => {
  class MarketingQrRepositoryError extends Error {
    constructor(message: string, readonly code: string) {
      super(message);
      this.name = "MarketingQrRepositoryError";
    }
  }
  return {
    MarketingQrRepositoryError,
    listMarketingQrConfig: mocks.listConfig,
    createMarketingCampaign: mocks.createCampaign,
    createMarketingQrSource: mocks.createSource,
    updateMarketingQrDestination: mocks.updateDestination,
  };
});

import {
  createMarketingCampaignAction,
  createMarketingQrSourceAction,
  updateMarketingQrDestinationAction,
} from "@/app/erp/marketing-actions";

const initial = { status: "idle" as const, message: "" };

function formData(values: Record<string, string>) {
  const form = new FormData();
  for (const [key, value] of Object.entries(values)) form.set(key, value);
  return form;
}

const EXISTING_CAMPAIGN = {
  id: "10000000-0000-4000-8000-000000000001",
  code: "TAMCOC-AUG",
  name: "QR bến Tam Cốc tháng 8",
  status: "active" as const,
};

describe("CUS-04 marketing QR server actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.user.mockResolvedValue({ id: "10000000-0000-4000-8000-000000000099", role: "director", mustChangePassword: false });
    mocks.listConfig.mockResolvedValue({ campaigns: [], sources: [] });
    mocks.createCampaign.mockResolvedValue("10000000-0000-4000-8000-000000000001");
    mocks.createSource.mockResolvedValue("10000000-0000-4000-8000-000000000002");
    mocks.updateDestination.mockResolvedValue(2);
  });

  it("creates a campaign under a director session with a server-generated code", async () => {
    const state = await createMarketingCampaignAction(initial, formData({ name: "QR bến Tam Cốc", status: "active" }));
    const expectedCode = generateCode("QR bến Tam Cốc", [], MARKETING_CODE_SHAPE);
    expect(state.status).toBe("success");
    expect(state.message).toContain(expectedCode);
    expect(mocks.createCampaign).toHaveBeenCalledWith(
      expect.objectContaining({ actorAccountId: "10000000-0000-4000-8000-000000000099", code: expectedCode, name: "QR bến Tam Cốc" }),
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/erp/marketing");
  });

  it("does not let a non-director create a QR source, and never reads the taken-code list for it", async () => {
    mocks.user.mockResolvedValue({ id: "10000000-0000-4000-8000-000000000099", role: "manager", mustChangePassword: false });
    const state = await createMarketingQrSourceAction(
      initial,
      formData({ campaignId: "10000000-0000-4000-8000-000000000001", placementLabel: "Bảng tại bến Tam Cốc", destinationPath: "/plan", status: "active" }),
    );
    expect(state).toMatchObject({ status: "error" });
    expect(mocks.listConfig).not.toHaveBeenCalled();
    expect(mocks.createSource).not.toHaveBeenCalled();
  });

  it("sends a versioned destination update to the server repository", async () => {
    const state = await updateMarketingQrDestinationAction(initial, formData({ sourceId: "10000000-0000-4000-8000-000000000002", expectedVersion: "1", destinationPath: "/packages" }));
    expect(state.status).toBe("success");
    expect(mocks.updateDestination).toHaveBeenCalledWith(expect.objectContaining({ expectedVersion: 1, destinationPath: "/packages" }));
  });

  it("(a) sinh mã chiến dịch đúng từ tên có dấu tiếng Việt", async () => {
    const state = await createMarketingCampaignAction(initial, formData({ name: "Trung thu bến Tam Cốc", status: "draft" }));
    expect(state.status).toBe("success");
    expect(mocks.createCampaign).toHaveBeenCalledWith(expect.objectContaining({ code: "TRUNG-THU-BEN-TAM-COC" }));
  });

  it("(b) tên trùng thì mã chiến dịch thứ hai có hậu tố -2", async () => {
    mocks.listConfig.mockResolvedValue({
      campaigns: [{ id: "10000000-0000-4000-8000-000000000005", code: "TRUNG-THU-BEN-TAM-COC", name: "Trung thu bến Tam Cốc", status: "active" }],
      sources: [],
    });
    const state = await createMarketingCampaignAction(initial, formData({ name: "Trung thu bến Tam Cốc", status: "draft" }));
    expect(state.status).toBe("success");
    expect(mocks.createCampaign).toHaveBeenCalledWith(expect.objectContaining({ code: "TRUNG-THU-BEN-TAM-COC-2" }));
  });

  it("(c) tên toàn ký tự lạ vẫn ra mã hợp lệ theo MarketingCodeSchema", async () => {
    const state = await createMarketingCampaignAction(initial, formData({ name: "!!!@@@###", status: "draft" }));
    expect(state.status).toBe("success");
    const call = mocks.createCampaign.mock.calls[0]?.[0] as { code: string };
    expect(MarketingCodeSchema.safeParse(call.code).success).toBe(true);
  });

  it("(d) đọc danh sách hỏng thì không sinh mã, không tạo chiến dịch", async () => {
    mocks.listConfig.mockRejectedValue(new Error("Mất kết nối tới kho dữ liệu."));
    const state = await createMarketingCampaignAction(initial, formData({ name: "QR bến Tam Cốc", status: "active" }));
    expect(state.status).toBe("error");
    expect(mocks.createCampaign).not.toHaveBeenCalled();
  });

  it("generates a QR source code from the campaign code plus placement label, and a placementId from the label", async () => {
    mocks.listConfig.mockResolvedValue({ campaigns: [EXISTING_CAMPAIGN], sources: [] });
    const state = await createMarketingQrSourceAction(
      initial,
      formData({ campaignId: EXISTING_CAMPAIGN.id, placementLabel: "Bảng tại bến Tam Cốc", destinationPath: "/plan", status: "active" }),
    );
    expect(state.status).toBe("success");
    const expectedPlacementId = generateCode("Bảng tại bến Tam Cốc", [], MARKETING_CODE_SHAPE);
    const expectedCode = generateCode(`${EXISTING_CAMPAIGN.code} Bảng tại bến Tam Cốc`, [], MARKETING_CODE_SHAPE);
    expect(mocks.createSource).toHaveBeenCalledWith(
      expect.objectContaining({ code: expectedCode, placementId: expectedPlacementId, campaignId: EXISTING_CAMPAIGN.id }),
    );
  });

  it("rejects a QR source when the campaign id is not among the ones just read", async () => {
    mocks.listConfig.mockResolvedValue({ campaigns: [], sources: [] });
    const state = await createMarketingQrSourceAction(
      initial,
      formData({ campaignId: "10000000-0000-4000-8000-000000000001", placementLabel: "Bảng tại bến Tam Cốc", destinationPath: "/plan", status: "active" }),
    );
    expect(state.status).toBe("error");
    expect(mocks.createSource).not.toHaveBeenCalled();
  });
});
