import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * TC-02 lượt 1 — hợp đồng của `202608290050_customer_multi_slot_booking.sql`.
 *
 * Bài này đọc thẳng chuỗi SQL, nên nó **không** chứng minh migration chạy
 * được — việc đó đã làm riêng trên PostgreSQL thật bằng một giao dịch rồi cuộn
 * lại. Cái nó canh giữ là những tính chất mà một lần "dọn cho gọn" ở phiên sau
 * rất dễ phá mà không ai nhận ra.
 */

const sql = readFileSync(
  "supabase/migrations/202608290050_customer_multi_slot_booking.sql",
  "utf8",
);
const compact = sql.replace(/\s+/g, " ").trim();

describe("customer multi-slot booking migration contract", () => {
  it("chạy trọn trong một transaction", () => {
    expect(compact.startsWith("-- TC-02")).toBe(true);
    expect(compact).toContain("begin;");
    expect(compact.endsWith("commit;")).toBe(true);
  });

  it("nới khóa chính đúng bốn cột, giữ nguyên khóa ngoại", () => {
    expect(compact).toContain(
      "primary key (tenant_id, product_id, site_id, local_start_time)",
    );
    // Nới khóa chính là chuyện của tính duy nhất. Nếu ai đó nhân tiện gỡ luôn
    // khóa ngoại thì một khung giờ trỏ được tới cặp sản phẩm–cơ sở không tồn
    // tại, và lỗi chỉ lộ ra lúc khách bấm đặt.
    expect(compact).not.toContain("drop constraint if exists customer_product_capacity_templates_product_id_site_id_fkey");
  });

  it("giữ lại giá trị source_kind cũ khi nới ràng buộc", () => {
    // Sáu hàng đang chạy production đều là 'catalog-staged'. Nới `check` mà
    // đánh rơi giá trị cũ là làm hỏng dữ liệu thật.
    expect(compact).toContain(
      "check (source_kind in ('catalog-staged', 'customer-approved'))",
    );
    // Bám vào câu `add constraint`, không bám vào chuỗi trần: phần chú thích ở
    // đầu tệp có trích lại nguyên văn ràng buộc cũ để giải thích, nên tìm chuỗi
    // trần sẽ khớp nhầm vào chính lời giải thích.
    expect(compact).not.toContain(
      "add constraint customer_product_capacity_templates_source_kind_check check (source_kind =",
    );
  });

  it("bỏ tường minh chữ ký cũ trước khi tạo bản có thêm tham số", () => {
    // Đây đúng chỗ đã sập một lần ở TC-01: `create or replace` với danh sách
    // tham số khác chỉ tạo thêm một hàm nạp chồng, hàm cũ vẫn còn đó và vẫn
    // được gọi. Hai bản cùng tồn tại nghĩa là hành vi phụ thuộc vào việc
    // PostgreSQL chọn bản nào.
    expect(compact).toContain(
      "drop function if exists public.customer_booking_payload_digest(uuid, date, integer);",
    );
    expect(compact).toContain(
      "drop function if exists public.customer_create_booking_hold( uuid, uuid, uuid, uuid, date, integer, timestamptz );",
    );
  });

  it("dấu vân tay yêu cầu có tính cả khung giờ", () => {
    // Thiếu chỗ này thì khách giữ 09:00 rồi đổi sang 14:00 sẽ nhận lại đúng
    // phiếu 09:00 cũ — im lặng, không báo lỗi, và khách tin là đã đổi được.
    expect(compact).toContain("p_slot_starts_at timestamptz default null");
    expect(compact).toContain(
      "p_product_id, p_visit_date, p_party_size, p_slot_starts_at",
    );
  });

  it("không truyền khung giờ thì giữ nguyên hành vi cũ", () => {
    // Điều kiện lọc phải cho qua **mọi** khung khi tham số vắng mặt. Bỏ nhánh
    // `is null` đi là làm chết mọi lời gọi cũ đang chạy.
    expect(compact).toContain("p_slot_starts_at is null or");
  });

  it("phân biệt 'chưa có lịch bán' với 'khung giờ không được mở'", () => {
    expect(compact).toContain("'CUSTOMER_BOOKING_SLOT_NOT_OFFERED'");
    expect(compact).toContain("'CUSTOMER_CAPACITY_SOURCE_MISSING'");
  });

  it("RPC đọc khung giờ là chỉ đọc thật", () => {
    const doc = compact.slice(compact.indexOf("customer_list_product_slots"));
    expect(doc).toContain("language sql stable");
    for (const ghi of ["insert into", "update ", "delete from", "for update"]) {
      expect(doc.slice(0, doc.indexOf("revoke all"))).not.toContain(ghi);
    }
  });

  it("số chỗ còn lại không bao giờ âm và đọc từ effective_capacity", () => {
    // `greatest(..., 0)`: giám đốc vừa hạ ngưỡng xuống dưới số đã giữ thì con
    // số đúng là "hết chỗ", không phải một số âm hiện lên màn hình khách.
    expect(compact).toContain("greatest(threshold.effective_capacity");
    expect(compact).not.toContain("threshold.hourly_capacity");
  });

  it("ba hàm đều đóng cửa với anon và authenticated", () => {
    const revokes = compact.match(/revoke all on function/g) ?? [];
    const grants = compact.match(/grant execute on function/g) ?? [];
    expect(revokes).toHaveLength(3);
    expect(grants).toHaveLength(3);
    expect(compact).not.toContain("to anon");
    expect(compact).not.toContain("to authenticated");
  });

  it("không seed một dòng dữ liệu nào", () => {
    // Migration cấu trúc không được nhét dữ liệu trình diễn. Lịch bán là việc
    // của người vận hành, không phải của một lần deploy.
    expect(compact).not.toContain(
      "insert into public.customer_product_capacity_templates",
    );
  });
});
