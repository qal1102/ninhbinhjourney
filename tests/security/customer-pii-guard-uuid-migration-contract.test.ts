import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/*
 * WEB-PLAN-04: bộ canh dữ liệu cá nhân bắt nhầm `site_id` là số điện thoại,
 * nên `/plan` chưa bao giờ lưu được một lịch trình nào trên production.
 *
 * Bài kiểm hợp đồng đọc thẳng tệp migration. Nó không thay được việc chạy thử
 * trên cơ sở dữ liệu thật, nhưng nó khoá được ba thứ dễ bị sửa hỏng về sau:
 * miễn trừ phải neo hai đầu, luật số điện thoại phải giữ nguyên, và luật khoá
 * theo tên trường phải còn đủ.
 */
const sql = readFileSync(
  "supabase/migrations/202609050059_customer_pii_guard_uuid.sql",
  "utf8",
);
const compact = sql.replace(/\s+/g, " ");

describe("migration miễn trừ UUID khỏi bộ canh dữ liệu cá nhân", () => {
  it("miễn trừ neo cả hai đầu chuỗi", () => {
    // Thiếu `^` hoặc `$` là một câu văn có UUID lẫn vào cũng được miễn, và khi
    // đó một số điện thoại thật nằm cùng chuỗi sẽ lọt.
    expect(compact).toContain(
      "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
    );
  });

  it("giữ nguyên luật số điện thoại, không nới một ký tự nào", () => {
    expect(compact).toContain("(^|[^0-9])(\\+?84|0)[0-9 .-]{8,12}($|[^0-9])");
  });

  it("giữ nguyên luật thư điện tử", () => {
    expect(compact).toContain(
      "[[:alnum:]._%+-]+@[[:alnum:].-]+\\.[[:alpha:]]{2,}",
    );
  });

  it("giữ đủ danh sách tên trường bị khoá", () => {
    for (const key of [
      "email",
      "phone",
      "mobile",
      "telephone",
      "full_?name",
      "first_?name",
      "last_?name",
      "contact",
      "address",
      "raw_?text",
      "prompt",
      "message",
    ]) {
      expect(compact).toContain(key);
    }
  });

  it("miễn trừ đặt TRƯỚC hai luật bắt, nếu không thì vô tác dụng", () => {
    // Chỉ soi THÂN HÀM. Phần chú thích đầu tệp cũng trích lại luật số điện
    // thoại để giải thích cái bẫy, và nó đứng trước mọi dòng mã -- so vị trí
    // trên cả tệp thì bài kiểm này đỏ vì đọc nhầm chú thích.
    const body = compact.slice(compact.indexOf("as $$"));
    const exemption = body.indexOf("^[0-9a-f]{8}-");
    const phoneRule = body.indexOf("(^|[^0-9])(\\+?84|0)");
    expect(exemption).toBeGreaterThan(-1);
    expect(phoneRule).toBeGreaterThan(-1);
    expect(exemption).toBeLessThan(phoneRule);
  });

  it("giữ nguyên các thuộc tính của hàm", () => {
    // `immutable` là điều kiện để dùng được trong 20 ràng buộc CHECK đang có.
    expect(compact).toContain("immutable");
    expect(compact).toContain("security invoker");
    expect(compact).toContain("set search_path = ''");
  });

  it("không đụng tới bảng hay ràng buộc nào", () => {
    // Chỉ thay thân hàm. Một `alter table` lọt vào đây là dấu hiệu ai đó đã
    // mở rộng migration này ra ngoài phạm vi của nó.
    expect(compact).not.toContain("alter table");
    expect(compact).not.toContain("drop ");
  });
});
