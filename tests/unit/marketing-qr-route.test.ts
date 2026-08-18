import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ enabled: vi.fn(), resolve: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/customer-data/marketing-qr-repository", () => {
  class MarketingQrRepositoryError extends Error {
    constructor(message: string, readonly code: string) {
      super(message);
      this.name = "MarketingQrRepositoryError";
    }
  }
  return {
    MarketingQrRepositoryError,
    isMarketingQrRoutingEnabled: mocks.enabled,
    resolveMarketingQrRedirect: mocks.resolve,
  };
});

import { GET } from "@/app/q/[code]/route";
import { MarketingQrRepositoryError } from "@/lib/customer-data/marketing-qr-repository";

function request() {
  return new Request("https://ninhbinhjourney.test/q/TC-WHARF-01");
}

const context = { params: Promise.resolve({ code: "tc-wharf-01" }) };

describe("GET /q/[code]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.enabled.mockReturnValue(true);
    mocks.resolve.mockResolvedValue({
      sourceId: "10000000-0000-4000-8000-000000000001",
      sourceCode: "TC-WHARF-01",
      campaignCode: "TAMCOC-AUG",
      placementId: "TAMCOC-WHARF",
      destinationPath: "/plan",
    });
  });

  it("fails closed when QR routing is not enabled", async () => {
    mocks.enabled.mockReturnValue(false);
    const response = await GET(request(), context);
    expect(response.status).toBe(404);
    expect(mocks.resolve).not.toHaveBeenCalled();
  });

  it("resolves an active code with a first-party 307 redirect", async () => {
    const response = await GET(request(), context);
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://ninhbinhjourney.test/plan?qr_source_id=TC-WHARF-01&campaign_id=TAMCOC-AUG&placement_id=TAMCOC-WHARF&utm_source=qr&utm_medium=offline&utm_campaign=TAMCOC-AUG",
    );
    expect(mocks.resolve).toHaveBeenCalledWith("TC-WHARF-01");
  });

  it("does not turn a paused code into a redirect", async () => {
    mocks.resolve.mockRejectedValue(
      new MarketingQrRepositoryError("paused", "NOT_ACTIVE"),
    );
    const response = await GET(request(), context);
    expect(response.status).toBe(410);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "MARKETING_QR_NOT_ACTIVE" },
    });
  });

  it("never treats a configuration failure as a missing QR code", async () => {
    mocks.resolve.mockRejectedValue(
      new MarketingQrRepositoryError("missing config", "CONFIGURATION_MISSING"),
    );
    const response = await GET(request(), context);
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "MARKETING_QR_UNAVAILABLE" },
    });
  });
});
