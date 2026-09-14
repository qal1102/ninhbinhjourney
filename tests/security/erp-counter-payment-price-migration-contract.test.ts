import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * QA-ERP-POS-05 — hợp đồng của `202609130070_erp_counter_payment_and_price_editing.sql`.
 *
 * Cùng khuôn với bài hợp đồng của 069: đọc chuỗi SQL, không chạy PostgreSQL.
 * Bằng chứng chạy thật là lượt chạy thử trong một giao dịch rồi cuộn lại
 * (docs/HANDOFF.md, hàng QA-ERP-POS-05). Bài này canh những tính chất về tiền
 * và quyền mà một lần "dọn cho gọn" rất dễ phá lặng lẽ.
 */

const sql = readFileSync("supabase/migrations/202609130070_erp_counter_payment_and_price_editing.sql", "utf8");
const khongChuThich = sql
  .split("\n")
  .filter((dong) => !dong.trimStart().startsWith("--"))
  .join("\n");
const compact = khongChuThich.replace(/\s+/g, " ").trim().toLowerCase();

function thanHam(ten: string) {
  const dau = compact.indexOf(`create or replace function public.${ten}(`);
  expect(dau, ten).toBeGreaterThan(-1);
  const batDau = compact.indexOf(" as $$", dau);
  const ketThuc = compact.indexOf("$$;", batDau + 6);
  expect(batDau, ten).toBeGreaterThan(-1);
  return compact.slice(batDau, ketThuc);
}

describe("chuyển khoản QR", () => {
  it("chạy trọn trong một giao dịch và không xoá dữ liệu nào", () => {
    expect(compact.startsWith("begin;")).toBe(true);
    expect(compact.endsWith("commit;")).toBe(true);
    expect(compact).not.toMatch(/\b(drop table|truncate|delete from public\.|drop column)/);
  });

  it("chỉ nhận hai phương thức, và chuyển khoản phải nhận đúng bằng tổng", () => {
    expect(compact).toContain("check (payment_method in ('cash', 'qr-transfer'))");
    expect(compact).toContain("check (payment_method <> 'qr-transfer' or cash_received_vnd = total_vnd)");
    expect(compact).toContain("check (payment_reference is null or payment_reference ~ '^[a-z0-9-]{4,40}$')");
  });

  it("máy chủ bỏ qua số tiền màn hình gửi lên khi khách chuyển khoản", () => {
    const ban = thanHam("erp_create_counter_sale");
    expect(ban).toContain("v_received := case when v_method = 'qr-transfer' then v_total else p_cash_received_vnd end");
    expect(ban).toContain("counter_sale_payment_invalid");
  });

  it("chuyển khoản vẫn phải tick xác nhận của người bán, như tiền mặt", () => {
    const ban = thanHam("erp_create_counter_sale");
    const tick = ban.indexOf("counter_sale_cash_not_confirmed");
    expect(tick).toBeGreaterThan(-1);
    // Dấu xác nhận được kiểm cho mọi phương thức, không nằm trong nhánh tiền mặt.
    expect(ban.slice(Math.max(0, tick - 120), tick)).not.toContain("v_method = 'cash'");
  });

  it("bỏ tường minh chữ ký bán cũ, không để hai bản nạp chồng", () => {
    expect(compact).toContain(
      "drop function if exists public.erp_create_counter_sale( uuid, uuid, text, text, text, integer, integer, bigint, boolean, text );",
    );
  });

  it("khoá sửa phiếu biết thêm hai cột phương thức và nội dung", () => {
    const chan = thanHam("erp_counter_sale_guard_update");
    expect(chan).toContain("new.payment_method, new.payment_reference");
    expect(chan).toContain("old.payment_method, old.payment_reference");
  });

  it("cuối ca tách tiền mặt với chuyển khoản, tiền mặt không lẫn QR", () => {
    const cuoiCa = thanHam("erp_shift_counter_cash");
    expect(cuoiCa).toContain(
      "'total_vnd', (select coalesce(sum(total_vnd), 0) from in_window where status = 'completed' and payment_method = 'cash')",
    );
    expect(cuoiCa).toContain("'qr_total_vnd'");
  });
});

describe("giám đốc đặt giá", () => {
  it("chỉ vai giám đốc đang hiệu lực được đặt giá", () => {
    expect(thanHam("erp_counter_actor_can_set_price")).toContain(
      "public.erp_account_has_active_role(p_tenant_id, trim(p_actor_account_id), 'director', null)",
    );
    const dat = thanHam("erp_set_counter_price");
    expect(dat).toContain("if not public.erp_counter_actor_can_set_price(p_tenant_id, v_actor_id) then");
    expect(dat).toContain("counter_price_not_allowed");
  });

  it("không đặt giá lùi ngày, không hẹn quá một năm", () => {
    expect(thanHam("erp_set_counter_price")).toContain(
      "if p_effective_from is null or p_effective_from < v_today or p_effective_from > v_today + 365 then",
    );
  });

  it("đặt giá chỉ thêm một hàng mới, không sửa giá cũ", () => {
    const dat = thanHam("erp_set_counter_price");
    expect(dat).toContain("insert into public.erp_counter_price_list");
    expect(dat).not.toMatch(/update public\.erp_counter_price_list|delete from/);
  });

  it("giá đang áp và giá lúc bán cùng một thứ tự: ngày áp dụng rồi lần đặt sau cùng", () => {
    expect(thanHam("erp_counter_current_prices")).toContain("order by list.product, list.effective_from desc, list.revision desc");
    const ban = thanHam("erp_create_counter_sale");
    expect(ban.split("order by list.effective_from desc, list.revision desc").length - 1).toBe(2);
    expect(ban).not.toContain("created_at desc");
  });

  it("mỗi lần đặt giá hiện trong Nhật ký, trừ giá khởi tạo của hệ thống", () => {
    const nhatKy = thanHam("erp_audit_timeline");
    expect(nhatKy).toContain("'counter-price.set'");
    expect(nhatKy).toContain("price.created_by_account_id <> 'system'");
  });
});

describe("khoá cửa", () => {
  it("mọi hàm chạy với search_path rỗng và chỉ trao cho service_role", () => {
    for (const ten of [
      "erp_counter_actor_can_set_price",
      "erp_counter_current_prices",
      "erp_counter_price_history",
      "erp_set_counter_price",
      "erp_counter_sale_receipt",
      "erp_shift_counter_cash",
      "erp_create_counter_sale",
    ]) {
      const dau = compact.indexOf(`create or replace function public.${ten}(`);
      const doanDau = compact.slice(dau, compact.indexOf(" as $$", dau));
      expect(doanDau, ten).toContain("security definer set search_path = ''");
      expect(compact, ten).toMatch(new RegExp(`revoke all on function public\\.${ten}\\([^)]*\\) from public, anon, authenticated;`));
      expect(compact, ten).toMatch(new RegExp(`grant execute on function public\\.${ten}\\([^)]*\\) to service_role;`));
    }
  });

  it("hàm Nhật ký chép nguyên văn bản 069, chỉ thêm đúng một nhánh bảng giá", () => {
    const lay = (tep: string) => {
      const noiDung = readFileSync(tep, "utf8").split("\r").join("");
      const dau = noiDung.indexOf("create or replace function public.erp_audit_timeline(");
      return noiDung.slice(dau, noiDung.indexOf("\n$$;", dau));
    };
    const cu = lay("supabase/migrations/202609130069_erp_counter_ticket_sales.sql");
    const moi = lay("supabase/migrations/202609130070_erp_counter_payment_and_price_editing.sql");
    const dau = moi.indexOf("    union all\n    -- QA-ERP-POS-05");
    const cuoi = moi.indexOf("price.created_by_account_id <> 'system'\n", dau) + "price.created_by_account_id <> 'system'\n".length;
    expect(dau).toBeGreaterThan(-1);
    const nhanh = moi.slice(dau, cuoi);
    expect(nhanh).toContain("from public.erp_counter_price_list price");
    expect(moi.replace(nhanh, "")).toBe(cu);
  });
});
