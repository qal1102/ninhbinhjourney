import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { getCurrentErpUser } = vi.hoisted(() => ({
  getCurrentErpUser: vi.fn(),
}));
vi.mock("@/lib/erp/demo-session", () => ({ getCurrentErpUser }));

const { updateRegistryProfile } = vi.hoisted(() => ({
  updateRegistryProfile: vi.fn(),
}));
vi.mock("@/lib/erp/account-registry-repository", () => ({
  updateRegistryProfile,
}));

import { updateProfileAction } from "@/app/erp/profile-actions";

function formOf(entries: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.set(key, value);
  return data;
}

const idle = { status: "idle" as const, message: "" };
const validFields = {
  accountId: "manager-tam-chuc",
  displayName: "Phạm Anh Tuấn",
  jobTitle: "Quản lý vận hành",
  phone: "0912345678",
  employmentType: "management",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("updateProfileAction", () => {
  it("refuses without a session, before touching the repository", async () => {
    getCurrentErpUser.mockResolvedValue(null);
    const result = await updateProfileAction(idle, formOf(validFields));
    expect(result.status).toBe("error");
    expect(updateRegistryProfile).not.toHaveBeenCalled();
  });

  it("rejects a display name that is too short", async () => {
    getCurrentErpUser.mockResolvedValue({ id: "director-001" });
    const result = await updateProfileAction(
      idle,
      formOf({ ...validFields, displayName: "A" }),
    );
    expect(result.status).toBe("error");
    expect(updateRegistryProfile).not.toHaveBeenCalled();
  });

  it("rejects a malformed phone number", async () => {
    getCurrentErpUser.mockResolvedValue({ id: "director-001" });
    const result = await updateProfileAction(
      idle,
      formOf({ ...validFields, phone: "abc" }),
    );
    expect(result.status).toBe("error");
    expect(updateRegistryProfile).not.toHaveBeenCalled();
  });

  it("allows an empty phone (optional field)", async () => {
    getCurrentErpUser.mockResolvedValue({ id: "director-001" });
    updateRegistryProfile.mockResolvedValue(undefined);
    const result = await updateProfileAction(
      idle,
      formOf({ ...validFields, phone: "" }),
    );
    expect(result.status).toBe("success");
    expect(updateRegistryProfile).toHaveBeenCalledWith(
      expect.objectContaining({ phone: "" }),
    );
  });

  it("passes the actor id through, not whatever accountId the form claims to be editing", async () => {
    getCurrentErpUser.mockResolvedValue({ id: "director-001" });
    updateRegistryProfile.mockResolvedValue(undefined);
    await updateProfileAction(idle, formOf(validFields));
    expect(updateRegistryProfile).toHaveBeenCalledWith({
      actorAccountId: "director-001",
      accountId: "manager-tam-chuc",
      displayName: "Phạm Anh Tuấn",
      jobTitle: "Quản lý vận hành",
      phone: "0912345678",
      employmentType: "management",
    });
  });

  it("surfaces the RPC's business-rule refusal as the error message", async () => {
    getCurrentErpUser.mockResolvedValue({ id: "manager-trang-an" });
    updateRegistryProfile.mockRejectedValue(
      new Error("Bạn chỉ sửa được hồ sơ của nhân sự thuộc cơ sở mình quản lý."),
    );
    const result = await updateProfileAction(idle, formOf(validFields));
    expect(result.status).toBe("error");
    expect(result.message).toContain("cơ sở mình quản lý");
  });
});
