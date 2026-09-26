import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const migrationPath = fileURLToPath(
  new URL("../../supabase/migrations/202609260090_tu_nha_cho_giu_qua_han.sql", import.meta.url),
);
const compact = readFileSync(migrationPath, "utf8").replace(/\r\n/g, "\n").replace(/\s+/g, " ").trim();

describe("migration 090: tự nhả chỗ giữ quá hạn", () => {
  it("chạy trọn một giao dịch", () => {
    expect(compact).toContain("begin;");
    expect(compact.endsWith("commit;")).toBe(true);
  });

  it("chỉ service_role gọi được, đúng quy ước security definer", () => {
    expect(compact).toContain(
      "revoke all on function public.customer_booking_expire_lapsed_holds() from public, anon, authenticated, service_role;",
    );
    expect(compact).toContain("grant execute on function public.customer_booking_expire_lapsed_holds() to service_role;");
    expect(compact).not.toMatch(/grant execute on function public\.customer_booking_expire_lapsed_holds\(\) to (anon|authenticated|public)/);
    expect(compact).toContain("security definer");
    expect(compact).toContain("set search_path = ''");
  });

  it("chỉ chạm lượt giữ còn mở đã quá giờ, và chỉ đơn còn đang giữ", () => {
    expect(compact).toContain("where hold.status = 'active' and hold.expires_at <= now()");
    // Đơn đã xác nhận hay đã huỷ không bao giờ bị kéo về hết hạn.
    expect(compact).toContain("and customer_order.status = 'holding'");
  });

  it("đặt lịch mỗi phút, chạy lại không tạo trùng", () => {
    expect(compact).toContain("cron.unschedule(v_job.jobid)");
    expect(compact).toContain("'customer-booking-expire-lapsed-holds', '* * * * *'");
  });
});
