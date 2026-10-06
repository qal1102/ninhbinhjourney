import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  "supabase/migrations/202610060115_su_co_mau_va_go_do_chet.sql",
  "utf8",
);
const khongChu = sql.replace(/--[^\n]*/g, "");

describe("115: gỡ đồ chết trong kho", () => {
  it("chỉ gỡ đúng năm thứ đã soát, không gỡ lan", () => {
    expect(khongChu).not.toMatch(/\bcascade\b/i);
    const hamGo = khongChu.match(/p\.proname in \(([^)]*)\)/)?.[1] ?? "";
    expect(hamGo.match(/'[a-z_]+'/g)?.sort()).toEqual([
      "'can_access_erp_site'",
      "'customer_purge_expired_identity_documents'",
      "'erp_demo_rebase_timeline'",
      "'erp_record_gate_scan'",
    ]);
    expect(khongChu.match(/drop table/gi)).toHaveLength(1);
    expect(khongChu).toContain("drop table if exists public.customer_sealed_identity_documents;");
  });

  it("không đụng các hàm chính sách RLS của bảng tài khoản", () => {
    expect(khongChu).not.toMatch(/erp_rls_|can_manage_erp_site/);
  });

  it("làm mới sự cố mẫu theo nhãn mẫu, không đụng hồ sơ đã đóng", () => {
    expect(khongChu).toContain("i.data_origin = 'demo-seed' or i.version = 1");
    expect(khongChu).toContain("i.status <> 'closed'");
  });
});
