import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const compact = readFileSync(
  fileURLToPath(new URL("../../supabase/migrations/202609260093_bao_cao_co_so.sql", import.meta.url)),
  "utf8",
)
  .replace(/\r\n/g, "\n")
  .replace(/\s+/g, " ")
  .trim();

describe("migration 093: báo cáo một cơ sở", () => {
  it("chỉ tạo một hàm đọc, trong một giao dịch", () => {
    expect(compact).toContain("begin;");
    expect(compact.endsWith("commit;")).toBe(true);
    expect(compact).toContain("stable security definer set search_path = ''");
    expect(compact).not.toMatch(/\binsert into\b|\bupdate public\.|\bdelete from\b|\bcreate table\b/i);
  });

  it("chỉ service_role gọi được", () => {
    expect(compact).toContain("revoke all on function public.erp_bao_cao_co_so(uuid, uuid, date, date) from public, anon, authenticated;");
    expect(compact).toContain("grant execute on function public.erp_bao_cao_co_so(uuid, uuid, date, date) to service_role;");
  });

  it("đếm theo ngày giờ Việt Nam, chỉ lượt vào được chấp nhận, bỏ vé huỷ và phiếu huỷ", () => {
    expect(compact).toContain("scan.scanned_at at time zone 'Asia/Ho_Chi_Minh'");
    expect(compact).toContain("and scan.result = 'accepted'");
    expect(compact).toContain("and ticket.status <> 'void'");
    expect(compact).toContain("and sale.status = 'completed'");
  });
});
