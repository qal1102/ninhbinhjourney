import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/** QA-ERP-TICKET-05 — hợp đồng của `202609140074_erp_ticket_sales_summary.sql`. */

const compact = readFileSync("supabase/migrations/202609140074_erp_ticket_sales_summary.sql", "utf8")
  .split("\n")
  .filter((dong) => !dong.trimStart().startsWith("--"))
  .join("\n")
  .replace(/\s+/g, " ")
  .trim()
  .toLowerCase();

describe("đếm vé trong kho", () => {
  it("chỉ là một hàm đọc: không thêm cột giá, không sửa hay xoá dữ liệu", () => {
    expect(compact.startsWith("begin;")).toBe(true);
    expect(compact.endsWith("commit;")).toBe(true);
    expect(compact).not.toMatch(/alter table|insert into|update public\.|delete from|drop /);
    expect(compact).toContain("language sql stable security definer set search_path = ''");
  });

  it("tiền chỉ lấy từ thành tiền dòng phiếu quầy đã bán, phiếu huỷ tính 0", () => {
    expect(compact).toContain("case when sale.status = 'completed' then line.line_total_vnd else 0 end as tien_quay_vnd");
    expect(compact).not.toMatch(/customer_orders|total_vnd \*|unit_price_vnd \*/);
  });

  it("vé đã huỷ không đếm vào lượt khách hay số tấm vé", () => {
    expect(compact).toContain("ticket.status <> 'void' as hieu_luc");
    const dem = compact.slice(compact.indexOf("cross join lateral"), compact.indexOf(") dem"));
    expect(dem.match(/filter \(/g)?.length).toBe(dem.match(/ve\.hieu_luc/g)?.length);
  });

  it("chỉ trao cho service_role", () => {
    expect(compact).toContain("revoke all on function public.erp_ticket_sales_summary(uuid, uuid) from public, anon, authenticated;");
    expect(compact).toContain("grant execute on function public.erp_ticket_sales_summary(uuid, uuid) to service_role;");
  });
});
