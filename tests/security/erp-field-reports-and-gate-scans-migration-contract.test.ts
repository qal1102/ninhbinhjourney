import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const migrationPath = fileURLToPath(
  new URL(
    "../../supabase/migrations/202607310012_erp_field_reports_and_gate_scans.sql",
    import.meta.url,
  ),
);
const sql = readFileSync(migrationPath, "utf8").replace(/\r\n/g, "\n");
const compact = sql.replace(/\s+/g, " ").trim();

function functionBlock(name: string) {
  const start = sql.indexOf(`create or replace function public.${name}(`);
  const end = sql.indexOf("\n$$;", start);
  if (start < 0 || end < 0) throw new Error(`Missing ${name}`);
  return sql.slice(start, end + 4).replace(/\s+/g, " ");
}

describe("ERP field reports and gate scans migration 012 contract", () => {
  it("applies atomically", () => {
    expect(compact).toContain("begin;");
    expect(compact.endsWith("commit;")).toBe(true);
  });

  it("locks down erp_field_operation_reports and erp_gate_scan_events to service-role read only", () => {
    for (const table of ["erp_field_operation_reports", "erp_gate_scan_events"]) {
      expect(compact).toContain(`create table if not exists public.${table}`);
      expect(compact).toContain(
        `alter table public.${table} enable row level security;`,
      );
      expect(compact).toContain(
        `revoke all on table public.${table} from public, anon, authenticated, service_role;`,
      );
      expect(compact).not.toContain(`grant insert on table public.${table}`);
      expect(compact).not.toContain(`grant update on table public.${table}`);
      expect(compact).not.toContain(`grant delete on table public.${table}`);
    }
  });

  it("creates a private photo bucket with a 5 MB image-only allowlist, matching erp-workday-evidence", () => {
    expect(compact).toContain("'erp-field-reports', 'erp-field-reports', false, 5242880,");
    expect(compact).toContain(
      "array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']",
    );
    expect(compact).toContain("public = false,");
  });

  it("validates progress, tenant/site match and generates a unique report code", () => {
    const fn = functionBlock("erp_submit_field_operation_report");
    expect(fn).toContain("p_progress not in (25, 50, 75, 100)");
    expect(fn).toContain("message = 'FIELD_REPORT_ACTOR_INVALID'");
    expect(fn).toContain(
      "select 1 from public.sites s where s.id = p_site_id and s.tenant_id = p_tenant_id",
    );
    expect(fn).toContain("message = 'FIELD_REPORT_SITE_TENANT_MISMATCH'");
    expect(fn).toContain("nextval('public.erp_field_operation_report_code_seq')");
    expect(fn).toContain(
      "v_status := case when p_progress = 100 then 'Chờ quản lý xác nhận' else 'Đang xử lý' end;",
    );
  });

  it("de-dupes a re-scanned code within 2 minutes instead of logging a duplicate", () => {
    const fn = functionBlock("erp_record_gate_scan");
    expect(fn).toContain("char_length(v_code) < 6");
    expect(fn).toContain("message = 'GATE_SCAN_CODE_INVALID'");
    expect(fn).toContain("scanned_at > now() - interval '2 minutes'");
    expect(fn).toContain("if v_row.id is not null then return v_row; end if;");
  });

  it("exposes mutation RPCs only to the server service role", () => {
    for (const signature of [
      "public.erp_submit_field_operation_report(uuid, uuid, text, text, text, text, text, integer, text, text, text, text, integer, text)",
      "public.erp_record_gate_scan(uuid, uuid, text, text, text)",
    ]) {
      expect(compact).toContain(
        `revoke all on function ${signature} from public, anon, authenticated, service_role;`,
      );
      expect(compact).toContain(
        `grant execute on function ${signature} to service_role;`,
      );
    }
  });

  it("seeds exactly 3 field reports for each of the 4 sites, with no storage_path (never real uploads)", () => {
    const matches = sql.match(/'IMG-(TA|TC|TCO|BD)-(0842|0918|0951)'/g) ?? [];
    expect(matches.length).toBe(12);
    expect(compact).toContain("on conflict (report_code) do nothing;");
  });

  it("never touches the pre-existing, unrelated erp_field_reports table", () => {
    // A much earlier migration already created erp_field_reports (uuid
    // reporter_user_id/work_item_id, progress_percent, image_paths[]) that
    // nothing in the app reads or writes. This migration must use its own
    // erp_field_operation_reports table instead of colliding with or
    // silently adopting that shape.
    expect(compact).not.toMatch(/\bpublic\.erp_field_reports\b/);
  });
});
