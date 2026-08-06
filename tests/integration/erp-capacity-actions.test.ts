import { beforeEach, describe, expect, it, vi } from "vitest";

const doubles = vi.hoisted(() => ({
  accountCanAccessModule: vi.fn(),
  accountCanAccessSite: vi.fn(),
  getCurrentErpUser: vi.fn(),
  revalidatePath: vi.fn(),
  updateCapacityThreshold: vi.fn(),
}));

const { MockCapacityRepositoryError } = vi.hoisted(() => ({
  MockCapacityRepositoryError: class extends Error {},
}));

vi.mock("next/cache", () => ({
  revalidatePath: doubles.revalidatePath,
}));

vi.mock("@/lib/erp/demo-session", () => ({
  accountCanAccessModule: doubles.accountCanAccessModule,
  accountCanAccessSite: doubles.accountCanAccessSite,
  getCurrentErpUser: doubles.getCurrentErpUser,
}));

vi.mock("@/lib/erp/capacity-repository", () => ({
  CapacityRepositoryError: MockCapacityRepositoryError,
  updateCapacityThreshold: doubles.updateCapacityThreshold,
}));

import { updateCapacityThresholdAction } from "@/app/erp/capacity-actions";

const initialState = { status: "idle" as const, message: "" };
const directorUser = {
  id: "director-001",
  name: "Nguyễn Minh Anh",
  role: "director" as const,
  siteIds: ["trang-an"] as const,
  moduleIdsBySite: {},
};
const managerUser = {
  id: "manager-trang-an",
  name: "Lê Hoàng Nam",
  role: "manager" as const,
  siteIds: ["trang-an"] as const,
  moduleIdsBySite: {},
};

function thresholdForm(overrides: Partial<Record<string, string>> = {}) {
  const formData = new FormData();
  formData.set("siteId", overrides.siteId ?? "trang-an");
  formData.set(
    "thresholdId",
    overrides.thresholdId ?? "82000000-0000-4000-8000-000000000001",
  );
  formData.set("expectedVersion", overrides.expectedVersion ?? "1");
  formData.set("vehicleCount", overrides.vehicleCount ?? "600");
  formData.set("seatsPerVehicle", overrides.seatsPerVehicle ?? "4");
  formData.set("roundTripMinutes", overrides.roundTripMinutes ?? "180");
  formData.set("sourceKind", overrides.sourceKind ?? "customer");
  formData.set(
    "sourceNote",
    overrides.sourceNote ?? "Biên bản xác nhận của đơn vị vận hành ngày 07/08/2026.",
  );
  return formData;
}

beforeEach(() => {
  for (const double of Object.values(doubles)) double.mockReset();
  doubles.accountCanAccessModule.mockReturnValue(true);
  doubles.accountCanAccessSite.mockReturnValue(true);
});

describe("updateCapacityThresholdAction", () => {
  it("rejects an expired session", async () => {
    doubles.getCurrentErpUser.mockResolvedValue(null);
    const result = await updateCapacityThresholdAction(
      initialState,
      thresholdForm(),
    );
    expect(result.status).toBe("error");
    expect(doubles.updateCapacityThreshold).not.toHaveBeenCalled();
  });

  it("rejects a manager even when the site and module are accessible", async () => {
    doubles.getCurrentErpUser.mockResolvedValue(managerUser);
    const result = await updateCapacityThresholdAction(
      initialState,
      thresholdForm(),
    );
    expect(result.status).toBe("error");
    expect(result.message).toContain("Chỉ giám đốc");
    expect(doubles.updateCapacityThreshold).not.toHaveBeenCalled();
  });

  it("uses the authenticated director identity and revalidates on success", async () => {
    doubles.getCurrentErpUser.mockResolvedValue(directorUser);
    const result = await updateCapacityThresholdAction(
      initialState,
      thresholdForm(),
    );
    expect(doubles.updateCapacityThreshold).toHaveBeenCalledWith({
      thresholdId: "82000000-0000-4000-8000-000000000001",
      actorAccountId: directorUser.id,
      actorDisplayName: directorUser.name,
      expectedVersion: 1,
      vehicleCount: 600,
      seatsPerVehicle: 4,
      roundTripMinutes: 180,
      sourceKind: "customer",
      sourceNote: "Biên bản xác nhận của đơn vị vận hành ngày 07/08/2026.",
    });
    expect(result.status).toBe("success");
    expect(doubles.revalidatePath).toHaveBeenCalledWith(
      "/erp/trang-an/suc-chua",
    );
  });

  it("rejects invalid inputs before touching the repository", async () => {
    doubles.getCurrentErpUser.mockResolvedValue(directorUser);
    const result = await updateCapacityThresholdAction(
      initialState,
      thresholdForm({ roundTripMinutes: "0", sourceNote: "ngắn" }),
    );
    expect(result.status).toBe("error");
    expect(doubles.updateCapacityThreshold).not.toHaveBeenCalled();
  });

  it("surfaces a repository conflict as a stable form error", async () => {
    doubles.getCurrentErpUser.mockResolvedValue(directorUser);
    doubles.updateCapacityThreshold.mockRejectedValue(
      new MockCapacityRepositoryError("Ngưỡng vừa được người khác cập nhật."),
    );
    const result = await updateCapacityThresholdAction(
      initialState,
      thresholdForm(),
    );
    expect(result).toEqual({
      status: "error",
      message: "Ngưỡng vừa được người khác cập nhật.",
    });
  });
});
