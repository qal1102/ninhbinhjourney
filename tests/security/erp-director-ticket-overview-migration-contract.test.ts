import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/** A15-ERP-04 — hợp đồng của `202609170075_erp_director_ticket_overview.sql`. */

const compact = readFileSync("supabase/migrations/202609170075_erp_director_ticket_overview.sql", "utf8")
  .split("\n")
  .filter((dong) => !dong.trimStart().startsWith("--"))
  .join("\n")
  .replace(/\s+/g, " ")
  .trim()
  .toLowerCase();

const CHU_KY = "public.erp_director_ticket_overview(uuid, uuid[], jsonb)";

/** Phần thân hàm, giữa hai dấu `$$`. */
const than = compact.slice(compact.indexOf("as $$") + "as $$".length, compact.lastIndexOf("$$;"));

describe("bảng vé giám đốc đếm lượt khách trong kho", () => {
  it("chỉ là một hàm đọc: không đổi bảng, không ghi dữ liệu, không trigger", () => {
    expect(compact.startsWith("begin;")).toBe(true);
    expect(compact.endsWith("commit;")).toBe(true);
    expect(compact).not.toMatch(
      /alter table|create table|insert into|update public\.|delete from|truncate|drop |create trigger|create index|merge into/,
    );
    expect(compact).toContain("returns jsonb language sql stable security definer set search_path = ''");
    expect(compact.match(/create or replace function/g)?.length).toBe(1);
  });

  it("chỉ service_role gọi được", () => {
    expect(compact).toContain(`revoke all on function ${CHU_KY} from public, anon, authenticated;`);
    expect(compact).toContain(`grant execute on function ${CHU_KY} to service_role;`);
    expect(compact.match(/grant /g)?.length).toBe(1);
  });

  it("đọc vé đúng một chỗ, tên bảng ghi đủ schema, và chỗ ấy lọc vé đã huỷ", () => {
    // Mọi phép đếm đi qua CTE `ve`; bảng vé chỉ được đọc trong CTE ấy.
    expect(than.match(/erp_tickets/g)?.length).toBe(1);
    expect(than).toContain("join public.erp_tickets ticket");
    expect(than).not.toMatch(/customer_orders|erp_counter_sale/);

    const ve = than.slice(than.indexOf("ve as ("), than.indexOf("select jsonb_build_object"));
    expect(ve).toContain("where ticket.tenant_id = p_tenant_id");
    expect(ve).toContain("and ticket.site_id = any(p_site_ids)");
    expect(ve).toContain("and ticket.status <> 'void'");
  });

  it("lượt khách mỗi tấm vé là greatest(coalesce(entries_allowed, 1), 1), và chỉ cộng cột ấy", () => {
    expect(than).toContain("greatest(coalesce(ticket.entries_allowed, 1), 1) as entries");
    expect(than.match(/entries_allowed/g)?.length).toBe(1);
    const cacPhepCong = than.match(/sum\([^)]*\)/g) ?? [];
    expect(cacPhepCong.length).toBeGreaterThan(0);
    expect(new Set(cacPhepCong)).toEqual(new Set(["sum(ve.entries)"]));
  });

  it("mọi phép đếm và phép cộng đều nói rõ đếm vé thật hay vé gieo mẫu", () => {
    const tong = than.slice(than.indexOf("cross join lateral"), than.indexOf(") dem"));
    const dem = (tong.match(/count\(\*\)/g)?.length ?? 0) + (tong.match(/sum\(/g)?.length ?? 0);
    expect(dem).toBe(3);
    expect(tong.match(/filter \(where ve\.data_origin = '(real|demo-seed)'\)/g)?.length).toBe(dem);
    expect(tong).toContain("count(*) filter (where ve.data_origin = 'demo-seed') as demo_seed_ticket_count");

    // Từng cơ sở và từng kênh bán: chỉ vé thật.
    const nhom = than.slice(than.indexOf("'by_site'"));
    expect(nhom.match(/group by/g)?.length).toBe(2);
    expect(nhom.match(/from ve where ve\.data_origin = 'real' group by/g)?.length).toBe(2);
  });

  it("khung giờ do máy chủ ứng dụng truyền vào, đếm nửa mở [from, to)", () => {
    // Ngày Việt Nam chỉ tính ở `domain/ticket-window.ts`; hàm không tự tính mốc.
    expect(than).not.toMatch(/now\(\)|current_date|current_timestamp|localtimestamp|time zone|interval/);
    expect(than).toContain("from jsonb_array_elements(p_windows) with ordinality");
    expect(than).toContain("on ticket.issued_at >= cua_so.tu and ticket.issued_at < cua_so.den");
  });
});
