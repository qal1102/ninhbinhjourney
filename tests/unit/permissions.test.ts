import { describe, expect, it } from "vitest";
import { can, effectiveCapability } from "@/domain/permissions";

describe("authorization capabilities", () => {
  it("NBJ-D20 never elevates authority through presenter preview", () => {
    expect(
      effectiveCapability({
        authenticatedRole: "content",
        previewRole: "admin",
        capability: "reset-demo-run",
      }),
    ).toBe(false);
  });

  it("keeps anonymous visitors outside internal capabilities", () => {
    expect(can("visitor", "view-masked-bookings")).toBe(false);
    expect(can("visitor", "create-incident")).toBe(false);
    expect(can("visitor", "change-safety-operation")).toBe(false);
  });

  it("permits only the authenticated role's explicit capability", () => {
    expect(can("check-in-agent", "redeem-pass")).toBe(true);
    expect(can("check-in-agent", "view-full-demo-contact")).toBe(false);
    expect(can("admin", "reset-demo-run")).toBe(true);
  });
});
