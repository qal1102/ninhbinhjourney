import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Migration 103: chia tiền đơn web về từng cơ sở. Canh ba điều không được lỏng:
 * tổng các phần đúng bằng tiền đơn (phần lẻ dồn vào một vé), trang đầu lọc
 * tiền web theo đúng tập cơ sở được hỏi, và chỉ service role gọi được hàm chia.
 */

const sql = readFileSync(
  fileURLToPath(new URL("../../supabase/migrations/202610030103_chia_tien_ve_web_theo_co_so.sql", import.meta.url)),
  "utf8",
)
  .replace(/\r\n/g, "\n")
  .replace(/\s+/g, " ");

describe("migration 103: chia tiền vé web theo cơ sở", () => {
  it("trọng số là số lượt × giá vé quầy người lớn của cơ sở", () => {
    expect(sql).toContain("greatest(coalesce(ticket.entries_allowed, 1), 1) * greatest(coalesce((");
    expect(sql).toContain("price.product = 'adult'");
  });

  it("phần lẻ làm tròn dồn vào một vé, tổng luôn bằng tiền đơn", () => {
    expect(sql).toContain("when chia.hang = 1 then chia.tong_don - sum(chia.phan) over (partition by chia.order_id)");
  });

  it("chỉ chia đơn đã xác nhận, bỏ vé đã huỷ", () => {
    expect(sql).toContain("orders.status = 'confirmed'");
    expect(sql).toContain("ticket.status <> 'void'");
  });

  it("trang đầu lọc tiền web theo đúng tập cơ sở được hỏi", () => {
    expect(sql).toContain("where chia.site_id = any(p_site_ids)");
  });

  it("chỉ service role gọi được hàm chia", () => {
    expect(sql).toContain("revoke all on function public.erp_tien_web_theo_ve(uuid) from public, anon, authenticated;");
    expect(sql).toContain("grant execute on function public.erp_tien_web_theo_ve(uuid) to service_role;");
  });
});
