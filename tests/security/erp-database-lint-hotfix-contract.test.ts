import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  fileURLToPath(
    new URL(
      "../../supabase/migrations/202608210047_erp_database_lint_hotfix.sql",
      import.meta.url,
    ),
  ),
  "utf8",
).replace(/\r\n/g, "\n");
const compact = sql.replace(/\s+/g, " ").trim();

describe("ERP production database lint hotfix migration 047", () => {
  it("is atomic and replaces exactly the three linted functions", () => {
    expect(compact).toContain("begin;");
    expect(compact.endsWith("commit;")).toBe(true);
    expect(sql.match(/create or replace function public\./g)).toHaveLength(3);
    expect(compact).not.toMatch(/\b(drop|truncate|delete from|alter table)\b/);
  });

  it("keeps every function SECURITY DEFINER with an empty search path", () => {
    for (const name of [
      "process_sandbox_payment",
      "redeem_pass_entitlement",
      "erp_demo_rebase_timeline",
    ]) {
      const body = compact.split(`create or replace function public.${name}`)[1];
      expect(body, `${name} missing`).toBeDefined();
      expect(body?.slice(0, 1200)).toContain("security definer");
      expect(body?.slice(0, 1200)).toContain("set search_path = ''");
    }
  });

  it("qualifies booking_id against passes at all three payment lookups", () => {
    expect(
      sql.match(
        /from public\.passes p where p\.booking_id = v_booking\.id;/g,
      ),
    ).toHaveLength(3);
    expect(sql).not.toContain(
      "from public.passes where booking_id = v_booking.id;",
    );
  });

  it("qualifies pass entitlement columns instead of colliding with OUT parameters", () => {
    expect(sql.match(/from public\.pass_entitlements pe/g)).toHaveLength(3);
    expect(compact).toContain(
      "where pe.id = p_entitlement_id and pe.pass_id = v_pass.id",
    );
    expect(compact).toContain(
      "where pe.pass_id = v_pass.id and (p_site_id is null or pe.site_id = p_site_id)",
    );
    expect(compact).toContain(
      "where pe.pass_id = v_pass.id and pe.redeemed_quantity < pe.quantity",
    );
  });

  it("casts the seeded tenant literal explicitly to uuid", () => {
    expect(compact).toContain(
      "v_tenant constant uuid := '00000000-0000-4000-8000-000000000001'::uuid;",
    );
  });
});
