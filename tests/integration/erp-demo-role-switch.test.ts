import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// V3 in docs/DANH_GIA_HE_THONG_VA_GIAO_VIEC.md: exercises the REAL
// demo-session.ts logic (setErpSession/startRoleSwitch/endRoleSwitch/
// getCurrentErpUser), only faking the browser cookie transport -- this is
// the security-critical part of the feature (director-only, flag-gated,
// no chained switches, real session swap not a UI flag), so it must run
// against the real implementation, not a mock of it.

function createCookieJar() {
  const store = new Map<string, string>();
  return {
    get: vi.fn((name: string) =>
      store.has(name) ? { name, value: store.get(name)! } : undefined,
    ),
    set: vi.fn((name: string, value: string) => {
      store.set(name, value);
    }),
  };
}

const doubles = vi.hoisted(() => ({
  cookies: vi.fn(),
  createClient: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: doubles.createClient,
}));
vi.mock("next/headers", () => ({
  cookies: doubles.cookies,
}));

import {
  endRoleSwitch,
  getCurrentErpUser,
  setErpSession,
  startRoleSwitch,
} from "@/lib/erp/demo-session";

const DIRECTOR_ID = "director-001";
const EMPLOYEE_ID = "employee-trang-an-01";
const MANAGER_ID = "manager-trang-an";

describe("ERP demo role switch (V3)", () => {
  beforeEach(() => {
    vi.stubEnv("ERP_PERSISTENCE_MODE", "demo-cookie");
    doubles.cookies.mockReset();
    doubles.createClient.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is refused entirely when the feature flag is off, even for a director", async () => {
    vi.stubEnv("ERP_DEMO_ROLE_SWITCH", "false");
    const jar = createCookieJar();
    doubles.cookies.mockResolvedValue(jar);
    await setErpSession(DIRECTOR_ID);

    await expect(startRoleSwitch(EMPLOYEE_ID)).rejects.toThrow(/đang tắt/);
  });

  it("refuses a non-director account from switching", async () => {
    vi.stubEnv("ERP_DEMO_ROLE_SWITCH", "true");
    const jar = createCookieJar();
    doubles.cookies.mockResolvedValue(jar);
    await setErpSession(MANAGER_ID);

    await expect(startRoleSwitch(EMPLOYEE_ID)).rejects.toThrow(/giám đốc/);
  });

  it("refuses switching to another director", async () => {
    vi.stubEnv("ERP_DEMO_ROLE_SWITCH", "true");
    const jar = createCookieJar();
    doubles.cookies.mockResolvedValue(jar);
    await setErpSession(DIRECTOR_ID);

    await expect(startRoleSwitch(DIRECTOR_ID)).rejects.toThrow(
      /Không tìm thấy tài khoản/,
    );
  });

  it("grants a real session swap: getCurrentErpUser reflects the target's own real permissions, not the director's", async () => {
    vi.stubEnv("ERP_DEMO_ROLE_SWITCH", "true");
    const jar = createCookieJar();
    doubles.cookies.mockResolvedValue(jar);
    await setErpSession(DIRECTOR_ID);

    const directorBefore = await getCurrentErpUser();
    expect(directorBefore?.siteIds.length).toBeGreaterThan(1); // director sees every site

    const { director, target } = await startRoleSwitch(EMPLOYEE_ID);
    expect(director.id).toBe(DIRECTOR_ID);
    expect(target.id).toBe(EMPLOYEE_ID);

    const asEmployee = await getCurrentErpUser();
    expect(asEmployee?.id).toBe(EMPLOYEE_ID);
    expect(asEmployee?.role).toBe("employee");
    // Real employee permission narrowing applies -- not every site, not
    // director's module set. No new permission was granted by switching.
    expect(asEmployee?.siteIds).toEqual(["trang-an"]);
    expect(asEmployee?.actingAs).toEqual({
      directorId: DIRECTOR_ID,
      directorName: director.name,
    });
  });

  it("blocks a chained switch -- must return to director first", async () => {
    vi.stubEnv("ERP_DEMO_ROLE_SWITCH", "true");
    const jar = createCookieJar();
    doubles.cookies.mockResolvedValue(jar);
    await setErpSession(DIRECTOR_ID);
    await startRoleSwitch(EMPLOYEE_ID);

    await expect(startRoleSwitch(MANAGER_ID)).rejects.toThrow(
      /quay lại giám đốc trước/,
    );
  });

  it("returns to the director cleanly, dropping actingAs", async () => {
    vi.stubEnv("ERP_DEMO_ROLE_SWITCH", "true");
    const jar = createCookieJar();
    doubles.cookies.mockResolvedValue(jar);
    await setErpSession(DIRECTOR_ID);
    await startRoleSwitch(EMPLOYEE_ID);

    const { director, target } = await endRoleSwitch();
    expect(director.id).toBe(DIRECTOR_ID);
    expect(target.id).toBe(EMPLOYEE_ID);

    const backToDirector = await getCurrentErpUser();
    expect(backToDirector?.id).toBe(DIRECTOR_ID);
    expect(backToDirector?.actingAs).toBeUndefined();
  });

  it("refuses to end a switch that never started", async () => {
    vi.stubEnv("ERP_DEMO_ROLE_SWITCH", "true");
    const jar = createCookieJar();
    doubles.cookies.mockResolvedValue(jar);
    await setErpSession(DIRECTOR_ID);

    await expect(endRoleSwitch()).rejects.toThrow(/Không đang xem/);
  });
});
