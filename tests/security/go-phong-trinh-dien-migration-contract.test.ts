import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync("supabase/migrations/202610050109_go_phong_trinh_dien_doi_dau.sql", "utf8");
const lenh = sql.replace(/--.*$/gm, "");

describe("109: gỡ cụm bảng phòng trình diễn đời đầu", () => {
  it("không dùng cascade, để phụ thuộc chưa thấy làm migration báo lỗi", () => {
    expect(lenh).not.toMatch(/cascade/i);
  });

  it("gỡ đúng hai mươi bảng", () => {
    const go = [...lenh.matchAll(/drop table if exists public\.([a-z_]+);/g)].map((m) => m[1]);
    expect(go).toHaveLength(20);
    expect(go).toContain("demo_runs");
    expect(go).toContain("bookings");
  });

  it("không đụng bảng và hàm mà bảng đang dùng còn dựa vào", () => {
    for (const giu of ["tenants", "regions", "operators", "sites", "products", "product_sites", "sops", "tenant_memberships", "user_profiles"]) {
      expect(lenh).not.toMatch(new RegExp(`drop table if exists public\\.${giu};`));
    }
    expect(lenh).not.toMatch(/'has_tenant_role'|'current_user_is_anonymous'/);
  });

  it("gỡ hàm nghiệp vụ trước bảng, hàm kiểm quyền sau bảng", () => {
    expect(lenh.indexOf("'create_sandbox_payment_intent'")).toBeLessThan(lenh.indexOf("drop table if exists public.payment_intents"));
    expect(lenh.indexOf("drop table if exists public.demo_runs")).toBeLessThan(lenh.indexOf("'is_active_run_member'"));
  });
});
