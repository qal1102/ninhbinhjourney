import { afterEach, describe, expect, it } from "vitest";
import { isLegacyOpsEnabled, isLegacyOpsPath } from "@/config/legacy-ops";

const original = process.env.NEXT_PUBLIC_LEGACY_OPS_ENABLED;

afterEach(() => {
  if (original === undefined) delete process.env.NEXT_PUBLIC_LEGACY_OPS_ENABLED;
  else process.env.NEXT_PUBLIC_LEGACY_OPS_ENABLED = original;
});

describe("legacy /ops gate", () => {
  it("is off unless the flag is exactly \"true\"", () => {
    // Fail closed: a typo must not put a dead login back on the internet.
    for (const value of [undefined, "", "false", "TRUE", "1", "yes", " true"]) {
      if (value === undefined) delete process.env.NEXT_PUBLIC_LEGACY_OPS_ENABLED;
      else process.env.NEXT_PUBLIC_LEGACY_OPS_ENABLED = value;
      expect(isLegacyOpsEnabled(), `value ${JSON.stringify(value)}`).toBe(false);
    }
    process.env.NEXT_PUBLIC_LEGACY_OPS_ENABLED = "true";
    expect(isLegacyOpsEnabled()).toBe(true);
  });

  it("covers every entry point into the abandoned stack", () => {
    for (const path of [
      "/ops",
      "/ops/login",
      "/ops/incidents/abc",
      "/demo/ops",
      "/demo/join",
      "/api/demo-runs",
      "/api/demo-runs/join",
      "/api/demo-runs/123/reset",
    ]) {
      expect(isLegacyOpsPath(path), path).toBe(true);
    }
  });

  it("leaves the working product and the public web alone", () => {
    for (const path of [
      "/",
      "/erp",
      "/erp/login",
      "/erp/trang-an/su-co",
      "/explore",
      "/plan",
      "/packages",
      // Not part of the dead stack: /plan consumes this.
      "/api/journeys",
      "/api/erp/assistant",
      "/api/health",
      // A QR landing that only hands off to /plan.
      "/demo/qr/TRANGAN-WHARF-DEMO",
      // Still visible on purpose until W1 rebuilds it on ERP check-in.
      "/pass/abc123",
      // Prefix matching must be on path segments, not raw string prefixes.
      "/operations",
      "/opsimilar",
    ]) {
      expect(isLegacyOpsPath(path), path).toBe(false);
    }
  });
});
