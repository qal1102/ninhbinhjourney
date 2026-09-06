import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const path = fileURLToPath(
  new URL("../../supabase/migrations/202609050058_customer_ticket_lookup.sql", import.meta.url),
);
const sql = readFileSync(path, "utf8").replace(/\r\n/g, "\n");
const compact = sql.replace(/\s+/g, " ").trim();

const payOnSite = readFileSync(
  fileURLToPath(new URL("../../supabase/migrations/202608310057_customer_pay_on_site.sql", import.meta.url)),
  "utf8",
).replace(/\r\n/g, "\n");

describe("TC-23 migration 058 — tra cứu vé tự phục vụ", () => {
  it("chạy trọn một giao dịch và chỉ mở lối gọi cho service_role", () => {
    expect(compact.startsWith("-- TC-23")).toBe(true);
    expect(compact.endsWith("commit;")).toBe(true);
    expect(sql.split("\nbegin;\n").length).toBe(2);
    expect(compact).toContain(
      "create table if not exists public.customer_ticket_lookup_attempts (",
    );
    expect(compact).toContain(
      "alter table public.customer_ticket_lookup_attempts enable row level security;",
    );
    expect(compact).toContain(
      "revoke all on table public.customer_ticket_lookup_attempts from public, anon, authenticated, service_role;",
    );
    expect(compact).toContain(
      "revoke all on function public.customer_lookup_order_tickets( uuid, text, text, text, timestamptz ) from public, anon, authenticated;",
    );
    expect(compact).toContain(
      "grant execute on function public.customer_lookup_order_tickets( uuid, text, text, text, timestamptz ) to service_role;",
    );
    expect(compact).not.toContain("grant insert on table");
  });

  /**
   * Điều kiện an toàn số một: mã đặt chỗ một mình KHÔNG mở được vé. Hàm phải
   * đòi đúng hàng liên hệ đã gắn vào đơn, và phải so bằng chuỗi băm.
   */
  it("bắt buộc khớp cả mã đặt chỗ lẫn chuỗi băm liên hệ", () => {
    expect(compact).toContain("where identity.id = v_order.identity_id");
    expect(compact).toContain("and identity.identity_type = v_identity_type");
    expect(compact).toContain("and identity.identity_digest = v_identity_digest");
    expect(compact).toContain("and customer_order.order_code = v_code");
    expect(compact).toContain("and customer_order.status = 'confirmed'");
  });

  it("không nhận và không lưu một liên hệ đọc được nào", () => {
    // Hàm chỉ nhận chuỗi băm; không có tham số nào mang bản rõ hay bản mã.
    expect(compact).toContain("p_identity_digest text,");
    expect(compact).not.toContain("p_identity_ciphertext text, p_encryption_key_version text ) returns table ( found boolean");
    expect(compact).toContain("identity_digest text not null check (identity_digest ~ '^[0-9a-f]{64}$')");
    expect(compact).toContain("order_code_digest text not null check (order_code_digest ~ '^[0-9a-f]{64}$')");
    // Bảng nhật ký không có cột jsonb nào, nên không có đường lọt PII vào đó.
    const table = sql.slice(
      sql.indexOf("create table if not exists public.customer_ticket_lookup_attempts ("),
      sql.indexOf("create index if not exists customer_ticket_lookup_attempts_identity_idx"),
    );
    expect(table).not.toMatch(/jsonb/);
    // Không có cột nào giữ được một liên hệ đọc lại được: `identity_type` chỉ
    // giữ LOẠI liên hệ, còn bản mã thì không có đường nào vào bảng này.
    expect(table).not.toMatch(/ciphertext|encryption_key_version/i);
    expect(table.match(/^ {2}([a-z_]+ [a-z]+)/gm)?.map((line) => line.trim())).toEqual([
      "id uuid",
      "tenant_id uuid",
      "order_code_digest text",
      "identity_type text",
      "identity_digest text",
      "outcome text",
      "occurred_at timestamptz",
    ]);
  });

  it("nhật ký tra cứu chỉ ghi thêm và đếm được cả hai chiều dò", () => {
    expect(compact).toContain(
      "create trigger customer_ticket_lookup_attempts_append_only before update or delete on public.customer_ticket_lookup_attempts for each row execute function public.customer_append_only();",
    );
    expect(compact).toContain("and attempt.identity_digest = v_identity_digest and attempt.outcome <> 'throttled' and attempt.occurred_at > now() - interval '1 hour' ) >= 10");
    expect(compact).toContain("and attempt.order_code_digest = v_code_digest and attempt.outcome <> 'throttled' and attempt.occurred_at > now() - interval '1 hour' ) >= 20");
    expect(compact.match(/'throttled', p_occurred_at/g)?.length).toBe(1);
    expect(compact.match(/'rejected', p_occurred_at/g)?.length).toBe(1);
    expect(compact.match(/'matched', p_occurred_at/g)?.length).toBe(1);
  });

  /**
   * `raise` cuộn ngược giao dịch, và cuộn ngược thì hàng nhật ký vừa ghi cũng
   * bay theo — bộ đếm chống dò sẽ tự xoá chính mình sau mỗi lần chạm trần.
   * Hai lối ra "không tìm thấy" và "chạm trần" vì vậy phải `return`, không
   * được `raise`.
   */
  it("không raise ở lối ra nào có ghi nhật ký", () => {
    const lookup = sql.slice(sql.indexOf("create or replace function public.customer_lookup_order_tickets("));
    const raises = lookup.match(/raise exception/g) ?? [];
    expect(raises.length).toBe(2);
    expect(lookup).toContain("CUSTOMER_LOOKUP_INPUT_INVALID");
    expect(lookup).not.toContain("CUSTOMER_LOOKUP_NOT_FOUND");
  });

  it("đơn trỏ vào kho liên hệ đã có bằng khoá ngoại, không dựng kho thứ hai", () => {
    expect(compact).toContain("alter table public.customer_orders add column if not exists identity_id uuid;");
    expect(compact).toContain(
      "foreign key (identity_id, tenant_id) references public.customer_identities(id, tenant_id) on delete restrict;",
    );
    expect(compact).not.toMatch(/create table[^;]*identity_ciphertext/);
  });

  /**
   * `create or replace` thay cả thân hàm, nên hàm xác nhận đơn phải được chép
   * lại NGUYÊN VĂN từ TC-22, chỉ thêm đường nối liên hệ. Bài này so từng nhánh
   * nghiệp vụ của bản cũ với bản mới; sót một nhánh là mất một luật.
   */
  it("giữ nguyên mọi nhánh nghiệp vụ của hàm xác nhận đơn TC-22", () => {
    for (const invariant of [
      "CUSTOMER_PAYMENT_CONTACT_REQUIRED",
      "CUSTOMER_PAYMENT_UNPAID_LIMIT",
      "CUSTOMER_PAYMENT_ID_COLLISION",
      "CUSTOMER_ORDER_ALREADY_CONFIRMED",
      "CUSTOMER_BOOKING_HOLD_EXPIRED",
      "CUSTOMER_BOOKING_OWNERSHIP_REQUIRED",
      "CUSTOMER_PAYMENT_MODE_INVALID",
      "'on-site-counter'",
      "'payment-due-on-site'",
      "if v_outstanding >= 3 then",
      "pg_catalog.pg_advisory_xact_lock",
    ]) {
      expect(payOnSite).toContain(invariant);
      expect(sql).toContain(invariant);
    }
    expect(compact).toContain("on conflict (tenant_id, identity_type, identity_digest) do nothing returning id into v_identity_id;");
    expect(compact).toContain("set status = 'confirmed', identity_id = v_identity_id, updated_at = now()");
    // Chữ ký không đổi, nên không được drop hàm đang chạy.
    expect(compact).not.toContain("drop function if exists public.customer_confirm_booking");
  });
});
