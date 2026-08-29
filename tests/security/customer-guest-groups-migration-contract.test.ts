import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * TC-03 — hợp đồng của `202608290053_customer_guest_groups.sql`.
 *
 * Bài này đọc thẳng chuỗi SQL, nên nó **không** chứng minh migration chạy
 * được — việc đó đã làm riêng trên PostgreSQL thật bằng một giao dịch rồi cuộn
 * lại. Cái nó canh giữ là những tính chất mà một lần "dọn cho gọn" ở phiên sau
 * rất dễ phá mà không ai nhận ra, vì phá xong migration vẫn chạy trơn tru —
 * chỉ có dữ liệu là sai âm thầm.
 */

const sql = readFileSync(
  "supabase/migrations/202608290053_customer_guest_groups.sql",
  "utf8",
);
const compact = sql.replace(/\s+/g, " ").trim();

describe("customer guest groups migration contract", () => {
  it("chạy trọn trong một transaction", () => {
    // Nửa migration chạy xong nửa kia lỗi thì bảng `customer_orders` có cột
    // `adults`/`children` mà hàm giữ chỗ vẫn gọi theo chữ ký cũ — vỡ ngay ở
    // lượt đặt kế tiếp, không phải lúc deploy.
    expect(compact.startsWith("-- TC-03")).toBe(true);
    expect(compact).toContain("begin;");
    expect(compact.endsWith("commit;")).toBe(true);
  });

  it("ép tổng hai nhóm tuổi đúng bằng party_size ở PostgreSQL", () => {
    // Đây là ràng buộc dữ liệu, không phải một dòng Zod ở tầng API. Một RPC
    // nội bộ khác, hoặc một script sửa tay, có thể bỏ qua tầng TypeScript
    // hoàn toàn — chỉ có PostgreSQL mới chặn được đơn hàng có 2 người lớn +
    // 3 trẻ em nhưng party_size ghi là 4.
    expect(compact).toContain(
      "check (adults >= 1 and children >= 0 and adults + children = party_size)",
    );
  });

  it("lấp dữ liệu cũ trước khi siết not null", () => {
    // Đảo thứ tự hai bước này là ALTER COLUMN SET NOT NULL báo lỗi ngay khi
    // chạy trên production, vì mọi đơn hàng ghi trước TC-03 đang có adults =
    // null. Migration sập giữa chừng trên một bảng thật, không phải trên máy
    // ai đó.
    const capNhat = compact.indexOf("update public.customer_orders");
    const batBuoc = compact.indexOf("alter column adults set not null");
    expect(capNhat).toBeGreaterThan(-1);
    expect(batBuoc).toBeGreaterThan(-1);
    expect(capNhat).toBeLessThan(batBuoc);
  });

  it("bỏ tường minh chữ ký cũ trước khi tạo bản có thêm tham số", () => {
    // Đây đúng chỗ đã sập một lần ở TC-01: `create or replace` với danh sách
    // tham số khác chỉ tạo thêm một hàm nạp chồng, hàm cũ vẫn còn đó và vẫn
    // được gọi. Hai bản cùng tồn tại nghĩa là hành vi phụ thuộc vào việc
    // PostgreSQL chọn bản nào — im lặng, không báo lỗi khi deploy.
    expect(compact).toContain(
      "drop function if exists public.customer_booking_payload_digest( uuid, date, integer, timestamptz );",
    );
    expect(compact).toContain(
      "drop function if exists public.customer_create_booking_hold( uuid, uuid, uuid, uuid, date, integer, timestamptz, timestamptz );",
    );
  });

  it("dấu vân tay yêu cầu tính cả hai nhóm tuổi", () => {
    // Thiếu chỗ này thì khách giữ 3 người lớn rồi đổi thành 2 người lớn + 1
    // trẻ em sẽ nhận lại đúng phiếu cũ — im lặng, không báo lỗi, và tấm vé
    // phát ra sai loại cho cả đoàn.
    expect(compact).toContain("coalesce(p_adults::text");
    expect(compact).toContain("coalesce(p_children::text");
  });

  it("nới ràng buộc duy nhất đúng bằng nhóm tuổi, không nới hơn", () => {
    // Nới rộng hơn mức cần (ví dụ bỏ hẳn ràng buộc duy nhất) cho phép một sản
    // phẩm nhận hai dòng đơn 'adult' trùng nhau — tiền tính đôi mà không ai
    // biết vì không có gì báo lỗi lúc insert.
    expect(compact).toContain(
      "create unique index if not exists customer_order_lines_group_idx on public.customer_order_lines (order_id, product_id, guest_group);",
    );
    expect(compact).toContain(
      "create unique index if not exists customer_order_tickets_group_idx on public.customer_order_tickets (order_id, site_id, guest_group);",
    );
  });

  it("vé cũ giữ đúng tên cũ 'group'", () => {
    // Vé phát trước TC-03 đã gộp cả đoàn thật sự — đọc lại thành 'adult' là
    // bịa dữ liệu lịch sử. Cột thêm vào phải mặc định về đúng cái tên đó, và
    // ràng buộc check phải còn cho phép giá trị đó tồn tại, không thì mọi
    // dòng cũ vi phạm constraint ngay khi migration chạy.
    expect(compact).toContain(
      "check (guest_group in ('adult', 'child', 'group'))",
    );
    expect(compact).toContain(
      "add column if not exists guest_group text not null default 'group'",
    );
  });

  it("hai hàm khoá cùng một chiều", () => {
    // Hàm giữ chỗ khoá khung giờ theo (giờ bắt đầu, cơ sở) vì slot chưa tồn
    // tại lúc hàm bắt đầu. Nếu hàm xác nhận vẫn khoá theo slot_id như trước
    // TC-03, hai giao dịch đi ngược chiều nhau trên cùng một tập hàng —
    // deadlock chỉ chờ đủ lưu lượng đồng thời để lộ ra.
    //
    // Phải bám vào ĐÚNG vòng lặp khoá, không phải một chuỗi trùng chữ. Cả hai
    // hàm còn có một câu gom JSON cũng sắp theo `slot.starts_at, slot.site_id`
    // để trả về cho khách; bắt nhầm vào đó thì bài này xanh cả khi ai đó trả
    // thứ tự khoá về `slot_id` — tức là canh giữ đúng cái nó không canh.
    const holdStart = compact.indexOf(
      "create or replace function public.customer_create_booking_hold(",
    );
    const confirmStart = compact.indexOf(
      "create or replace function public.customer_confirm_simulated_booking(",
    );
    expect(holdStart).toBeGreaterThan(-1);
    expect(confirmStart).toBeGreaterThan(holdStart);
    const holdFn = compact.slice(holdStart, confirmStart);
    const confirmFn = compact.slice(confirmStart);

    // Hàm giữ chỗ: thứ tự khoá là thứ tự duyệt lịch bán, nhận ra bằng chữ
    // `loop` ngay sau. `local_start_time` cộng `p_visit_date` ra đúng
    // `starts_at`, nên đây chính là (giờ bắt đầu, cơ sở).
    expect(holdFn).toContain(
      "order by template.local_start_time, template.site_id loop",
    );

    // Hàm xác nhận: phải nối sang bảng khung giờ mới sắp theo giờ được — nếu
    // ai đó bỏ `join` đi thì không còn cột nào để sắp, và cách sửa nhanh nhất
    // là quay về `slot_id`.
    expect(confirmFn).toContain(
      "join public.customer_booking_slots slot on slot.id = hold_slot.slot_id where hold_slot.hold_id = v_hold.id and slot.tenant_id = p_tenant_id order by slot.starts_at, slot.site_id",
    );
    expect(compact).not.toContain("order by hold_slot.slot_id");
  });

  it("tạo và khoá hàng khung giờ trong một câu lệnh", () => {
    // `on conflict do nothing` rồi `select ... for update` riêng là hai thời
    // điểm khoá khác nhau: nếu một giao dịch khác vừa chèn đúng hàng đó mà
    // chưa commit, do nothing bỏ qua còn select chưa nhìn thấy hàng — khung
    // giờ thành null và cả lượt giữ chỗ hỏng theo cách rất khó dò ra.
    expect(compact).toContain(
      "on conflict (tenant_id, site_id, starts_at) do update",
    );
    expect(compact).not.toContain("do nothing;");
  });

  it("trẻ dưới 1m3 không mua vé, khách từ 1m3 tính giá thường", () => {
    // Chủ dự án chốt 29/08/2026. Đổi lặng lẽ một trong hai con số này là thu
    // tiền sai của khách thật — hoặc thu của em bé lẽ ra được miễn, hoặc miễn
    // cho một người lẽ ra phải trả.
    expect(compact).toContain(
      "'adult', v_adults, v_product.demo_price_vnd, v_product.demo_price_vnd * v_adults",
    );
    expect(compact).toContain("'child', v_children, 0, 0,");
  });

  it("tổng tiền tính theo số khách có vé, không theo tổng đầu người", () => {
    // Đây là cặp phải đi cùng nhau. Ràng buộc cũ là
    // `total_vnd = unit_price_vnd * party_size`; giữ nguyên nó thì PostgreSQL
    // chặn thẳng mọi đơn có trẻ nhỏ, và lỗi chỉ lộ ra lúc một gia đình thật
    // bấm giữ chỗ. Đổi một mình nó mà quên hàm giữ chỗ thì ngược lại.
    expect(compact).toContain(
      "drop constraint if exists customer_orders_check;",
    );
    expect(compact).toContain(
      "check (total_vnd = unit_price_vnd * adults)",
    );
    expect(compact).toContain("v_product.demo_price_vnd * v_adults, 'VND', 'holding'");
  });

  it("miễn phí vẫn chiếm một chỗ", () => {
    // Chỗ dễ sai nhất của quy tắc miễn phí: trừ sức chứa theo số vé bán ra
    // thay vì theo số người. Một thuyền nhận 12 khách mà bán 12 vé cho một
    // đoàn có 4 em bé là 16 người xuống bến — thiếu chỗ chỉ lộ ra lúc cả đoàn
    // đã tới nơi.
    expect(compact).toContain(
      "if v_reserved + p_party_size > v_slot.capacity_snapshot then",
    );
    expect(compact).not.toContain("v_reserved + v_adults >");
  });

  it("revoke/grant đủ cho đúng hai hàm bị bỏ rồi tạo lại", () => {
    // Bỏ và tạo lại hai hàm với chữ ký mới nghĩa là các quyền cũ trên chữ ký
    // cũ không tự chuyển sang — thiếu revoke/grant ở đây thì hàm mới có thể
    // mở toang cho anon/authenticated hoặc ngược lại chặn luôn service_role.
    const revokes = compact.match(/revoke all on function/g) ?? [];
    const grants = compact.match(/grant execute on function/g) ?? [];
    expect(revokes).toHaveLength(2);
    expect(grants).toHaveLength(2);
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
