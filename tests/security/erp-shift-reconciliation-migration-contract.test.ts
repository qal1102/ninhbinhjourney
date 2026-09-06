import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  fileURLToPath(
    new URL(
      "../../supabase/migrations/202609060062_erp_shift_reconciliation_read.sql",
      import.meta.url,
    ),
  ),
  "utf8",
).replace(/\r\n/g, "\n");
const compact = sql.replace(/\s+/g, " ").trim();

describe("TC-21 migration 062 — hàm đối soát cuối ca", () => {
  it("chạy trọn một giao dịch", () => {
    expect(compact.startsWith("-- TC-21")).toBe(true);
    expect(compact.endsWith("commit;")).toBe(true);
    expect(sql.split("\nbegin;\n").length).toBe(2);
  });

  /**
   * Điều kiện số một của việc này: **chỉ đọc**. Đối soát mà ghi được là mở ra
   * một nguồn sự thật thứ hai cho cùng một khoản tiền.
   */
  it("không ghi một dòng nào — không insert, update, delete, cũng không đụng bảng", () => {
    for (const forbidden of [
      "insert into",
      "update public.",
      "delete from",
      "alter table",
      "create table",
      "drop table",
      "truncate",
    ]) {
      expect(compact).not.toContain(forbidden);
    }
    expect(compact).toContain("language sql");
    expect(compact).toContain("stable");
  });

  it("chỉ service_role gọi được, và hàm chạy với search_path rỗng", () => {
    expect(compact).toContain("security definer");
    expect(compact).toContain("set search_path = ''");
    expect(compact).toContain(
      "revoke all on function public.erp_shift_on_site_cash( uuid, uuid, timestamptz, timestamptz ) from public, anon, authenticated;",
    );
    expect(compact).toContain(
      "grant execute on function public.erp_shift_on_site_cash( uuid, uuid, timestamptz, timestamptz ) to service_role;",
    );
  });

  /**
   * Cộng trong SQL chứ không kéo hàng về đếm bằng JavaScript — đúng bài học
   * `lib/erp/ticket-overview-repository.ts`.
   */
  it("cộng bằng sum/count trong SQL và không đặt trần limit nào", () => {
    expect(compact).toContain("'collected_vnd', (select coalesce(sum(amount_vnd), 0) from collected)");
    expect(compact).toContain("'collection_count', (select count(*) from collected)");
    expect(compact).toContain("'outstanding_vnd', (select coalesce(sum(amount_vnd), 0) from outstanding)");
    expect(compact).not.toContain(" limit ");
  });

  it("chỉ nhận khoản thu tại điểm đã thu xong, cắt đúng theo mốc thu tiền", () => {
    expect(compact).toContain("payment.mode = 'pay-on-site'");
    expect(compact).toContain("payment.status = 'succeeded'");
    expect(compact).toContain("payment.collected_at >= p_from");
    expect(compact).toContain("payment.collected_at < p_to");
  });

  /**
   * Sổ thanh toán cố ý không mang `site_id` (bài học TC-22 và `WEB-PLAN-04`:
   * UUID cơ sở bị bộ canh dữ liệu cá nhân bắt nhầm là số điện thoại). Đường
   * tra ngược đúng là cầu nối vé.
   */
  it("tra cơ sở qua cầu nối vé chứ không đòi site_id trong sổ tiền", () => {
    expect(compact).toContain("from public.customer_order_tickets bridge");
    expect(compact).toContain("bridge.site_id = p_site_id");
    expect(compact).not.toContain("payment.site_id");
  });

  /**
   * Sổ thanh toán chỉ ghi thêm, nên hàng `pending` ở lại vĩnh viễn kể cả sau
   * khi đã thu. Đếm thẳng `status = 'pending'` là đếm cả khoản đã thu xong.
   */
  it("khoản còn nợ phải loại đúng những hàng đã có hàng thu tương ứng", () => {
    expect(compact).toContain("payment.status = 'pending'");
    expect(compact).toContain(
      "and not exists ( select 1 from public.customer_payment_attempts settled where settled.tenant_id = payment.tenant_id and settled.idempotency_key = payment.id )",
    );
  });

  it("ghi rõ ai thu, và lấy tên người thu từ danh bạ tài khoản", () => {
    expect(compact).toContain("collected.collected_by_account_id as account_id");
    expect(compact).toContain("left join public.erp_account_registry registry");
    expect(compact).toContain("'display_name', per_collector.display_name");
  });
});
