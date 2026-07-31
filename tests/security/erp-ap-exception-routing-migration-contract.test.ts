import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const migrationPath = fileURLToPath(
  new URL(
    "../../supabase/migrations/202607300008_erp_ap_exception_routing.sql",
    import.meta.url,
  ),
);
const sql = readFileSync(migrationPath, "utf8");
const compact = sql.replace(/\s+/g, " ").trim();

describe("ERP AP exception routing migration 008 contract", () => {
  it("routes only material monetary exceptions to accountant verification", () => {
    expect(compact.startsWith("-- Route AP exceptions")).toBe(true);
    expect(compact).toContain("begin;");
    expect(compact.endsWith("commit;")).toBe(true);
    expect(compact).toContain(
      "cardinality(new.exception_codes) > 0 and new.exception_codes <@ array[ 'invoice-over-purchase-order', 'invoice-over-acceptance' ]::text[]",
    );
    expect(compact).toContain(
      "v_variance_vnd >= v_director_threshold_vnd then 'accountant' else 'manager'",
    );
    expect(compact).toContain(
      "AP_EXCEPTION_REQUIRES_ACCOUNTANT_VERIFICATION",
    );
  });

  it("returns director rejections to source ownership and protects the helper", () => {
    expect(compact).toContain(
      "old.status = 'director-exception' and new.status = 'match-exception'",
    );
    expect(compact).toContain("new.owner_role := 'manager'");
    expect(compact).toContain(
      "before insert or update on public.erp_ap_supplier_invoices",
    );
    expect(compact).toContain(
      "revoke all on function public.erp_route_ap_exception_owner() from public, anon, authenticated, service_role;",
    );
  });
});
