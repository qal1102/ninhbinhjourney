import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * QA-DON-DU-LIEU-10 — hợp đồng của `202609140073_erp_on_site_no_show.sql`.
 * Đọc chuỗi SQL; bằng chứng chạy thật là lượt chạy thử trên chính đơn thử của
 * chủ dự án trong một giao dịch rồi cuộn lại (docs/HANDOFF.md).
 */

const sql = readFileSync("supabase/migrations/202609140073_erp_on_site_no_show.sql", "utf8");
const compact = sql
  .split("\n")
  .filter((dong) => !dong.trimStart().startsWith("--"))
  .join("\n")
  .replace(/\s+/g, " ")
  .trim()
  .toLowerCase();

function thanHam(ten: string) {
  const dau = compact.indexOf(`create or replace function public.${ten}(`);
  expect(dau, ten).toBeGreaterThan(-1);
  const batDau = compact.indexOf(" as $$", dau);
  return compact.slice(batDau, compact.indexOf("$$;", batDau + 6));
}

describe("khách không đến: sổ tiền không sửa không xoá", () => {
  it("chạy trọn trong một giao dịch, không xoá hay sửa hàng thanh toán nào", () => {
    expect(compact.startsWith("begin;")).toBe(true);
    expect(compact.endsWith("commit;")).toBe(true);
    expect(compact).not.toMatch(/delete from public\.|update public\.customer_payment_attempts|update public\.customer_order_lines|update public\.customer_order_tickets|drop table|truncate/);
  });

  it("đóng khoản là một hàng mới, khoá chống trùng bằng id hàng chờ thu", () => {
    const dong = thanHam("erp_close_on_site_no_show");
    expect(dong).toContain("insert into public.customer_payment_attempts");
    expect(dong).toContain("'pay-on-site', 'cancelled', v_pending.amount_vnd");
    expect(dong).toContain("p_tenant_id, v_order.id, v_pending.hold_id, v_pending.id, 'on-site-counter'");
    expect(dong).toContain("exception when unique_violation then");
  });

  it("hàng đã đóng bắt buộc có người đóng và lý do, không mang dấu người thu", () => {
    expect(compact).toContain(
      "(status = 'cancelled' and collected_by_account_id is null and collected_at is null and cancelled_by_account_id is not null and cancel_reason is not null)",
    );
    expect(compact).toContain("check (status in ('succeeded', 'pending', 'cancelled'))");
  });

  it("lý do không vào metadata của sổ thương mại, nơi cấm dữ liệu cá nhân", () => {
    const dong = thanHam("erp_close_on_site_no_show");
    const metadata = dong.slice(dong.indexOf("'payment-cancelled-no-show',"), dong.indexOf("now() );", dong.indexOf("'payment-cancelled-no-show',")));
    expect(metadata).toContain("jsonb_build_object('amount_vnd'");
    expect(metadata).not.toContain("reason");
  });
});

describe("khách không đến: ai được đóng, khi nào", () => {
  it("chỉ quản lý đúng cơ sở hoặc giám đốc, ở cả lượt đọc lẫn lượt ghi", () => {
    expect(thanHam("erp_close_on_site_no_show")).toContain("if not public.erp_counter_actor_can_void(p_tenant_id, p_site_id, v_actor_id) then");
    expect(thanHam("erp_on_site_due_orders")).toContain("if not public.erp_counter_actor_can_void(p_tenant_id, p_site_id, p_viewer_account_id) then");
  });

  it("chưa qua ngày đi thì chưa đóng; khách đã vào cổng thì không đóng; bắt buộc lý do", () => {
    const dong = thanHam("erp_close_on_site_no_show");
    expect(dong).toContain("if v_order.visit_date >= v_today then raise exception using errcode = '55000', message = 'on_site_no_show_too_early'");
    expect(dong).toContain("ticket.entries_used > 0");
    expect(dong).toContain("on_site_no_show_already_admitted");
    expect(dong).toContain("if char_length(v_reason) not between 10 and 500 then");
  });

  it("chỉ huỷ vé chưa dùng", () => {
    expect(thanHam("erp_close_on_site_no_show")).toContain("and ticket.entries_used = 0 and ticket.status <> 'void'");
  });

  it("danh sách không trả tên, số điện thoại hay email khách", () => {
    expect(thanHam("erp_on_site_due_orders")).not.toMatch(/guest_name|guest_phone|identity|contact|email/);
  });
});

describe("khách không đến: khoá cửa và Nhật ký", () => {
  it("hai hàm chạy với search_path rỗng và chỉ trao cho service_role", () => {
    for (const ten of ["erp_on_site_due_orders", "erp_close_on_site_no_show"]) {
      const dau = compact.indexOf(`create or replace function public.${ten}(`);
      expect(compact.slice(dau, compact.indexOf(" as $$", dau)), ten).toContain("security definer set search_path = ''");
      expect(compact, ten).toMatch(new RegExp(`revoke all on function public\\.${ten}\\([^)]*\\) from public, anon, authenticated;`));
      expect(compact, ten).toMatch(new RegExp(`grant execute on function public\\.${ten}\\([^)]*\\) to service_role;`));
    }
  });

  it("hàm Nhật ký chép nguyên văn bản 072, chỉ thêm đúng một nhánh đóng khoản", () => {
    const lay = (tep: string) => {
      const noiDung = readFileSync(tep, "utf8").split("\r").join("");
      const dau = noiDung.indexOf("create or replace function public.erp_audit_timeline(");
      return noiDung.slice(dau, noiDung.indexOf("\n$$;", dau));
    };
    const cu = lay("supabase/migrations/202609140072_erp_staff_requests.sql");
    const moi = lay("supabase/migrations/202609140073_erp_on_site_no_show.sql");
    const dau = moi.indexOf("    union all\n    -- QA-DON-DU-LIEU-10");
    const duoi = "    where payment.tenant_id = p_tenant_id and payment.status = 'cancelled'\n";
    const cuoi = moi.indexOf(duoi, dau) + duoi.length;
    expect(dau).toBeGreaterThan(-1);
    expect(moi.replace(moi.slice(dau, cuoi), "")).toBe(cu);
  });
});
