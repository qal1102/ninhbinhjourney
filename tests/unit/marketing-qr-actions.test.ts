import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  user: vi.fn(),
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

describe("CUS-04 marketing QR server actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.user.mockResolvedValue({ id: "10000000-0000-4000-8000-000000000099", role: "director", mustChangePassword: false });
    mocks.createCampaign.mockResolvedValue("10000000-0000-4000-8000-000000000001");
    mocks.createSource.mockResolvedValue("10000000-0000-4000-8000-000000000002");
    mocks.updateDestination.mockResolvedValue(2);
  });

  it("creates a campaign only under a director session", async () => {
    const state = await createMarketingCampaignAction(initial, formData({ code: "TAMCOC-AUG", name: "QR bến Tam Cốc", status: "active" }));
    expect(state.status).toBe("success");
    expect(mocks.createCampaign).toHaveBeenCalledWith(expect.objectContaining({ actorAccountId: "10000000-0000-4000-8000-000000000099", code: "TAMCOC-AUG" }));
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/erp/marketing");
  });

  it("does not let a non-director create a QR source", async () => {
    mocks.user.mockResolvedValue({ id: "10000000-0000-4000-8000-000000000099", role: "manager", mustChangePassword: false });
    const state = await createMarketingQrSourceAction(initial, formData({ campaignId: "10000000-0000-4000-8000-000000000001", code: "TC-WHARF-01", placementId: "TAMCOC-WHARF", placementLabel: "Bảng tại bến Tam Cốc", destinationPath: "/plan", status: "active" }));
    expect(state).toMatchObject({ status: "error" });
    expect(mocks.createSource).not.toHaveBeenCalled();
  });

  it("sends a versioned destination update to the server repository", async () => {
    const state = await updateMarketingQrDestinationAction(initial, formData({ sourceId: "10000000-0000-4000-8000-000000000002", expectedVersion: "1", destinationPath: "/packages" }));
    expect(state.status).toBe("success");
    expect(mocks.updateDestination).toHaveBeenCalledWith(expect.objectContaining({ expectedVersion: 1, destinationPath: "/packages" }));
  });
});
