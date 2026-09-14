import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * QA-P2-09 — hợp đồng của `202609140071_erp_login_throttle.sql`. Đọc chuỗi SQL,
 * không chạy PostgreSQL; bằng chứng chạy thật ghi ở docs/HANDOFF.md.
 */

const sql = readFileSync("supabase/migrations/202609140071_erp_login_throttle.sql", "utf8");
const compact = sql
  .split("\n")
  .filter((dong) => !dong.trimStart().startsWith("--"))
  .join("\n")
  .replace(/\s+/g, " ")
  .trim()
  .toLowerCase();

describe("bảng đếm đăng nhập sai", () => {
  it("chạy trọn trong một giao dịch, chỉ tạo mới, không đụng bảng nào khác", () => {
    expect(compact.startsWith("begin;")).toBe(true);
    expect(compact.endsWith("commit;")).toBe(true);
    expect(compact).not.toMatch(/\b(drop |alter table public\.(?!erp_login_failures)|truncate)/);
    expect(compact.match(/delete from public\.([a-z_]+)/g)?.every((m) => m.endsWith("erp_login_failures"))).toBe(true);
  });

  it("chỉ giữ mã băm 64 ký tự, không có cột tên đăng nhập hay địa chỉ máy", () => {
    const bang = compact.slice(
      compact.indexOf("create table if not exists public.erp_login_failures ("),
      compact.indexOf(");", compact.indexOf("create table if not exists public.erp_login_failures (")),
    );
    expect(bang).toContain("key_hash text not null check (key_hash ~ '^[0-9a-f]{64}$')");
    expect(bang).not.toMatch(/username|identifier|email|ip_address|\bip text/);
  });

  it("bật RLS và thu hết quyền trực tiếp trên bảng", () => {
    expect(compact).toContain("alter table public.erp_login_failures enable row level security;");
    expect(compact).toContain("revoke all on table public.erp_login_failures from public, anon, authenticated, service_role;");
  });

  it("ba hàm chạy với search_path rỗng và chỉ trao cho service_role", () => {
    for (const ten of ["erp_login_recent_failures", "erp_login_record_failure", "erp_login_clear_failures"]) {
      const dau = compact.indexOf(`create or replace function public.${ten}(`);
      expect(dau, ten).toBeGreaterThan(-1);
      expect(compact.slice(dau, compact.indexOf(" as $$", dau)), ten).toContain("security definer set search_path = ''");
      expect(compact, ten).toMatch(new RegExp(`revoke all on function public\\.${ten}\\([^)]*\\) from public, anon, authenticated;`));
      expect(compact, ten).toMatch(new RegExp(`grant execute on function public\\.${ten}\\([^)]*\\) to service_role;`));
    }
  });

  it("đăng nhập đúng chỉ xoá lượt sai theo tài khoản, giữ bộ đếm theo máy", () => {
    const xoa = compact.slice(compact.indexOf("create or replace function public.erp_login_clear_failures("));
    expect(xoa).toContain("failure.scope in ('account-ip', 'account')");
  });

  it("tự dọn hàng quá một ngày để bảng không phình mãi", () => {
    expect(compact).toContain("where failure.failed_at < now() - interval '1 day'");
  });
});
