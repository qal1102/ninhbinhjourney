import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Bat bug that xay ra that tren production 05/08: PostgREST tra ve cot
 * timestamptz dang "...+00:00", khong phai "...Z". submitShiftCloseAction
 * noi thang openAttendance.createdAt vao idempotency key
 * (workflow-actions.ts), va requireIdempotencyKey (shift-close-repository.ts)
 * chi cho phep [A-Za-z0-9._:-] -- dau "+" khong nam trong do, nen moi luot
 * gui chot ca that tren Supabase deu gay "idempotency key must be 8-160
 * safe ASCII characters" ngay khi vua chinh vao form that.
 *
 * Moi bai test khac cua submitShiftCloseAction deu mock nguyen
 * @/lib/erp/attendance-repository (vd. erp-shift-close-remote-outage.test.ts)
 * nen khong bao gio di qua eventFromRow that -- day la ly do bug lot qua het
 * test cuc bo, chi lo ra khi chay that (dung bay #11 cua HANDOFF.md).
 */

const doubles = vi.hoisted(() => ({
  createClient: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: doubles.createClient,
}));
vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

const ORIGINAL_ENV = { ...process.env };

function chainReturning(rows: unknown[]) {
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(async () => ({ data: rows, error: null })),
  };
  return chain;
}

describe("attendance-repository Supabase row mapping", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env = { ...ORIGINAL_ENV };
    process.env.ERP_PERSISTENCE_MODE = "supabase";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SECRET_KEY = "test-secret-key";
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.clearAllMocks();
  });

  it("normalizes a PostgREST '+00:00' timestamptz into a safe-ASCII ISO 'Z' string", async () => {
    const { ERP_SHIFT_CLOSE_SITE_UUID_BY_SLUG } = await import(
      "@/lib/erp/shift-close-repository"
    );
    const trangAnSiteUuid = ERP_SHIFT_CLOSE_SITE_UUID_BY_SLUG["trang-an"];

    const chain = chainReturning([
      {
        id: "evt-1",
        user_account_id: "employee-trang-an-01",
        site_id: trangAnSiteUuid,
        event_type: "check-in",
        // Dinh dang that PostgREST tra ve cho timestamptz -- KHONG phai
        // "...Z". Day dung la gia tri lam gay production.
        created_at: "2026-08-05T05:39:12.123+00:00",
        latitude: 20.25245,
        longitude: 105.91755,
        accuracy_meters: 12,
        source: "gps",
      },
    ]);
    doubles.createClient.mockReturnValue({ from: vi.fn(() => chain) });

    const { getAttendanceState } = await import("@/lib/erp/attendance-repository");
    const state = await getAttendanceState();

    expect(state.events).toHaveLength(1);
    const [event] = state.events;
    expect(event.createdAt).toBe("2026-08-05T05:39:12.123Z");
    // Dung nguyen ban dieu kien cua requireIdempotencyKey
    // (shift-close-repository.ts) de bai test nay that su bao ve dung bug:
    // mot idempotency key noi truc tiep gia tri nay phai qua duoc bo loc.
    const idempotencyKey = ["submit", "employee-trang-an-01", "trang-an", "2026-08-05", event.createdAt].join(":");
    expect(idempotencyKey).toMatch(/^[A-Za-z0-9._:-]+$/);
    expect(idempotencyKey.length).toBeGreaterThanOrEqual(8);
    expect(idempotencyKey.length).toBeLessThanOrEqual(160);
  });
});
