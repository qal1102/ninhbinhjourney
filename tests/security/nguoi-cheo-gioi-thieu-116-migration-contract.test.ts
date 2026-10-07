import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync("supabase/migrations/202610070116_nguoi_cheo_gioi_thieu.sql", "utf8");
const khongChu = sql.replace(/--[^\n]*/g, "");

describe("116: người chèo giới thiệu khách qua sổ đại lý", () => {
  it("không dựng sổ hoa hồng thứ hai: chỉ thêm cột, không tạo bảng", () => {
    expect(khongChu).not.toMatch(/create table/i);
    expect(khongChu).not.toMatch(/\bdrop\b/i);
    expect(khongChu).toContain("alter table public.dai_ly");
    expect(khongChu).toContain("alter table public.erp_nguoi_cheo add column dai_ly_id uuid");
  });

  it("không đè hàm tính hoa hồng tháng của 102", () => {
    expect(khongChu).not.toMatch(/function public\.erp_dai_ly_thang/);
  });

  it("hàm mới chỉ máy chủ gọi được, khách vô danh thì không", () => {
    for (const ham of ["nguoi_cheo_ma_goi_y(uuid, text)", "erp_nguoi_cheo_cap_ma(uuid, uuid, numeric, text)"]) {
      expect(khongChu).toContain(`revoke all on function public.${ham} from public, anon, authenticated;`);
      expect(khongChu).toContain(`grant execute on function public.${ham} to service_role;`);
    }
    expect(khongChu.match(/security definer/g)).toHaveLength(1);
    expect(khongChu.match(/set search_path = ''/g)).toHaveLength(2);
  });

  it("mẫu dùng đúng phần băm của đại lý mẫu, không đè khoảng [0, 19) của 099", () => {
    expect(khongChu).toContain("19 + thu_tu, 20 + thu_tu");
    expect(khongChu).toContain("where la_mau and dai_ly_id is null");
    expect(khongChu).toContain("on conflict (tenant_id, ma) do nothing");
  });
});
