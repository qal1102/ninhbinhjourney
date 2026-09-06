import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/*
 * ERP-FAKE-02: đánh dấu dữ liệu gieo mẫu để con số giám đốc đọc là con số thật.
 *
 * Bài kiểm hợp đồng đọc thẳng tệp migration. Thứ nó khoá lại là những chỗ mà
 * một lần sửa vội sau này có thể làm hỏng âm thầm: mặc định phải là `'real'`,
 * vị từ của vé phải là DẠNG MÃ chứ không phải khoảng thời gian, và mọi lần dán
 * nhãn đều phải có khẳng định số lượng.
 */
const sql = readFileSync(
  "supabase/migrations/202609060060_erp_demo_seed_marker.sql",
  "utf8",
);
const compact = sql.replace(/\s+/g, " ");

describe("migration đánh dấu dữ liệu gieo mẫu", () => {
  it("cột mặc định là 'real' ở cả hai bảng", () => {
    // Mặc định sai là mọi hàng sinh ra từ nay bị coi là dữ liệu mẫu và biến
    // mất khỏi con số của giám đốc -- hỏng theo chiều ngược lại, và im lặng.
    const defaults = compact.match(
      /add column if not exists data_origin text not null default 'real'/g,
    );
    expect(defaults).toHaveLength(2);
  });

  it("chỉ nhận đúng những giá trị đã định nghĩa", () => {
    expect(compact).toContain("check (data_origin in ('real', 'demo-seed'))");
    expect(compact).toContain(
      "check (data_origin in ('real', 'demo-seed', 'test-residue'))",
    );
  });

  it("vé nhận diện bằng DẠNG MÃ, không bằng khoảng thời gian", () => {
    // Hàng rào này đã có sẵn ở `erp_refresh_demo_tickets` (migration
    // 202608300055) và phải khớp từng ký tự: vé web mang mã `WEB-` nên không
    // bao giờ lọt vào đây.
    expect(compact).toContain("ticket_code ~ '^[A-Z]{2,3}-[0-9]{4}-[0-9]{6}$'");
    expect(compact).not.toContain("update public.erp_tickets set data_origin = 'demo-seed' where created_at");
  });

  it("mỗi lần dán nhãn đều có khẳng định số lượng", () => {
    // Không có khẳng định thì một vị từ sai sẽ dán nhãn "mẫu" lên dữ liệu thật
    // và không ai biết. Ba lần dán nhãn -> ba lần đếm, ba lần raise.
    const marks = compact.match(/get diagnostics v_marked = row_count/g);
    expect(marks).toHaveLength(3);
    const raises = compact.match(/raise exception '[A-Z_]+_COUNT_MISMATCH/g);
    expect(raises).toHaveLength(3);
  });

  it("khẳng định đúng số lượng đã đo trên production", () => {
    expect(compact).toContain("if v_marked <> v_expected then");
    expect(compact).toContain("v_expected integer := 8");
    expect(compact).toContain("if v_marked <> 12 then");
    expect(compact).toContain("if v_marked <> 4 then");
  });

  it("cặn chạy thử chỉ chạm những hàng còn đang là 'real'", () => {
    // Thiếu điều kiện này thì câu thứ hai ghi đè nhãn 'demo-seed' vừa đặt ở
    // câu thứ nhất, và số lượng đếm ra sẽ là 16 chứ không phải 4.
    expect(compact).toContain("set data_origin = 'test-residue' where data_origin = 'real'");
  });

  it("không xoá hàng nào và không đụng ràng buộc đang có", () => {
    expect(compact).not.toContain("delete from");
    expect(compact).not.toContain("truncate");
    expect(compact).not.toContain("drop constraint");
    expect(compact).not.toContain("drop column");
  });

  it("chạy trọn trong một giao dịch", () => {
    expect(compact.trimStart().startsWith("--") || compact.includes("begin;")).toBe(true);
    expect(compact).toContain("begin;");
    expect(compact.trimEnd().endsWith("commit;")).toBe(true);
  });
});
