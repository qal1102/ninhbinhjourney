import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Hợp đồng của `202610250134_gioi_han_luot.sql`. Đọc chuỗi SQL, không chạy
 * PostgreSQL; bằng chứng chạy thật (PGlite) ghi ở docs/HANDOFF.md.
 */

const sql = readFileSync("supabase/migrations/202610250134_gioi_han_luot.sql", "utf8");
const compact = sql
  .split("\n")
  .filter((dong) => !dong.trimStart().startsWith("--"))
  .join("\n")
  .replace(/\s+/g, " ")
  .trim()
  .toLowerCase();

describe("bảng đếm lượt gọi API", () => {
  it("chạy trọn trong một giao dịch, chỉ tạo mới, chỉ xoá dòng của chính nó", () => {
    expect(compact.startsWith("begin;")).toBe(true);
    expect(compact.endsWith("commit;")).toBe(true);
    expect(compact).not.toMatch(/\b(drop |alter table public\.(?!nbj_dem_luot)|truncate)/);
    expect(compact.match(/delete from public\.([a-z_]+)/g)?.every((m) => m.endsWith("nbj_dem_luot"))).toBe(true);
  });

  it("chỉ giữ mã băm 64 ký tự, không có cột địa chỉ máy", () => {
    const dau = compact.indexOf("create table if not exists public.nbj_dem_luot (");
    const bang = compact.slice(dau, compact.indexOf(");", dau));
    expect(bang).toContain("khoa text primary key check (khoa ~ '^[0-9a-f]{64}$')");
    expect(bang).not.toMatch(/\bip\b|ip_address|phone|email/);
  });

  it("bật RLS và thu hết quyền trực tiếp trên bảng", () => {
    expect(compact).toContain("alter table public.nbj_dem_luot enable row level security;");
    expect(compact).toContain("revoke all on table public.nbj_dem_luot from public, anon, authenticated, service_role;");
  });

  it("hàm đếm chạy với search_path rỗng, kiểm đầu vào và chỉ trao cho service_role", () => {
    const dau = compact.indexOf("create or replace function public.nbj_lay_luot(");
    expect(dau).toBeGreaterThan(-1);
    expect(compact.slice(dau, compact.indexOf(" as $$", dau))).toContain("security definer set search_path = ''");
    expect(compact).toContain("gioi_han_luot_input_invalid");
    expect(compact).toContain("revoke all on function public.nbj_lay_luot(text, integer, integer) from public, anon, authenticated;");
    expect(compact).toContain("grant execute on function public.nbj_lay_luot(text, integer, integer) to service_role;");
  });

  it("tăng số đếm nguyên tử, không đọc rồi ghi", () => {
    expect(compact).toContain("on conflict (khoa) do update");
    expect(compact).toContain("returning so_luot into v_so_luot");
  });

  it("thu quyền chạy hai hàm phụ RLS khỏi anon nhưng giữ cho authenticated", () => {
    for (const ham of ["can_manage_erp_site(uuid)", "has_tenant_role(uuid, text[])"]) {
      expect(compact, ham).toContain(`revoke execute on function public.${ham} from public, anon;`);
      expect(compact, ham).toContain(`grant execute on function public.${ham} to authenticated, service_role;`);
    }
  });
});
