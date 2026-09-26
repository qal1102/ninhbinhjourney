import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const migrationPath = fileURLToPath(
  new URL("../../supabase/migrations/202609260090_tu_nha_cho_giu_qua_han.sql", import.meta.url),
);
const compact = readFileSync(migrationPath, "utf8").replace(/\r\n/g, "\n").replace(/\s+/g, " ").trim();

describe("migration 090: xoá lượt giữ quá 15 phút chưa trả tiền", () => {
  it("chạy trọn một giao dịch", () => {
    expect(compact).toContain("begin;");
    expect(compact.endsWith("commit;")).toBe(true);
  });

  it("hàm dọn chỉ service_role gọi được, đúng quy ước security definer", () => {
    expect(compact).toContain(
      "revoke all on function public.customer_booking_expire_lapsed_holds() from public, anon, authenticated, service_role;",
    );
    expect(compact).toContain("grant execute on function public.customer_booking_expire_lapsed_holds() to service_role;");
    expect(compact).not.toMatch(/grant execute on function public\.customer_booking_expire_lapsed_holds\(\) to (anon|authenticated|public)/);
    expect(compact).toContain("security definer");
    expect(compact).toContain("set search_path = ''");
  });

  it("chỉ chọn lượt giữ chưa thành đơn đã quá giờ, không tiền, không phiếu đoàn", () => {
    expect(compact).toContain("where hold.status in ('active', 'expired') and hold.converted_at is null and hold.expires_at <= now()");
    expect(compact).toContain("and customer_order.status in ('holding', 'expired')");
    expect(compact).toContain("select 1 from public.customer_payment_attempts payment where payment.order_id = customer_order.id");
    expect(compact).toContain("select 1 from public.erp_visitor_groups visitor_group where visitor_group.order_id = customer_order.id");
  });

  it("khoá 'chỉ thêm' vẫn đứng: chỉ nhả lệnh XOÁ, chỉ trong khe hàm dọn đặt, và vẫn dò lượt giữ", () => {
    expect(compact).toContain("if tg_op = 'DELETE' and v_khe = 'giu-qua-han' then");
    expect(compact).toContain("elsif tg_op = 'DELETE' and v_khe = 'lich-su-mau' then");
    expect(compact).toContain("raise exception using errcode = '42501', message = 'CUSTOMER_HISTORY_IMMUTABLE';");
    expect(compact).toContain("perform set_config('nbj.cho_phep_xoa', 'giu-qua-han', true);");
    // Nhả khe xong phải đóng lại ngay trong cùng giao dịch.
    expect(compact).toContain("perform set_config('nbj.cho_phep_xoa', '', true);");
    // Không có đường nào cho UPDATE.
    expect(compact).not.toMatch(/tg_op = 'UPDATE'/);
  });

  it("luật ba lần bỏ dở đếm trên sổ hẹn trả, không cần lượt giữ còn tồn tại", () => {
    expect(compact).toContain("drop constraint if exists customer_qr_payment_intents_hold_id_tenant_id_fkey");
    expect(compact).toContain("and intent.expires_at <= now()");
    expect(compact).toContain("and hold.status = 'converted'");
    expect(compact).toContain("if v_bo >= 3 then raise exception using errcode = '42501', message = 'CUSTOMER_QR_LAPSE_LIMIT';");
  });

  it("đặt lịch mỗi phút, chạy lại không tạo trùng", () => {
    expect(compact).toContain("cron.unschedule(v_job.jobid)");
    expect(compact).toContain("'customer-booking-expire-lapsed-holds', '* * * * *'");
  });
});
