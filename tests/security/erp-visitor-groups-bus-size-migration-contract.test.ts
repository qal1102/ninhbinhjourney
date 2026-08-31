import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * TC-15 — hợp đồng của `202608300056_erp_visitor_groups_bus_size.sql`.
 *
 * Bài này đọc thẳng chuỗi SQL, nên nó **không** chứng minh migration chạy
 * được trên PostgreSQL thật — việc đó làm riêng bằng một giao dịch rồi cuộn
 * lại. Cái nó canh giữ là những tính chất mà một lần "dọn cho gọn" ở phiên
 * sau rất dễ phá mà không ai nhận ra ngay: migration vẫn chạy trơn tru, chỉ
 * có một trần sức chứa, một quyền điền hộ hay một dòng dữ liệu cá nhân là sai
 * âm thầm.
 */

const sql = readFileSync(
  "supabase/migrations/202608300056_erp_visitor_groups_bus_size.sql",
  "utf8",
);
const compact = sql.replace(/\s+/g, " ").trim();

// Vị trí bốn cặp `as $$ ... $$;` trong tệp, theo đúng thứ tự xuất hiện:
// customer_create_booking_hold, erp_visitor_group_status,
// erp_create_visitor_group, erp_set_group_member_details.
function functionBody(functionNameFragment: string): string {
  const headerStart = compact.indexOf(functionNameFragment);
  expect(headerStart).toBeGreaterThan(-1);
  const bodyStart = compact.indexOf("as $$", headerStart);
  expect(bodyStart).toBeGreaterThan(headerStart);
  const bodyEnd = compact.indexOf("$$;", bodyStart);
  expect(bodyEnd).toBeGreaterThan(bodyStart);
  return compact.slice(bodyStart, bodyEnd);
}

describe("erp visitor groups bus-size migration contract", () => {
  it("chạy trọn trong một transaction", () => {
    // Nửa migration chạy xong nửa kia lỗi thì một bảng đã nới trần lên 45
    // trong khi bảng còn lại vẫn kẹt ở 20 — đúng lỗi mà bản đầu của chính
    // migration này mắc phải.
    expect(compact.startsWith("-- TC-15")).toBe(true);
    expect(compact).toContain("begin;");
    expect(compact.endsWith("commit;")).toBe(true);
  });

  it("nới đủ cả sáu chỗ đang chặn ở 20 người lên 45", () => {
    // Đây là bài quan trọng nhất trong tệp. Bản đầu của migration sót đúng
    // một chỗ (`customer_booking_hold_slots`), và lượt chạy thử trên
    // production bắt được: đơn tạo được mà chỗ giữ trong kho công suất thì
    // không, vì bảng đó vẫn còn chặn ở 20 trong khi năm chỗ kia đã lên 45.
    // Sót bất kỳ chỗ nào trong sáu chỗ dưới đây cũng là đúng một dạng lỗi đó,
    // chỉ khác bảng nào lộ ra lúc có đoàn thật đứng ở quầy.
    const noiSau = [
      {
        table: "customer_booking_hold_slots",
        constraint: "customer_booking_hold_slots_quantity_check",
        column: "quantity",
      },
      {
        table: "customer_orders",
        constraint: "customer_orders_party_size_check",
        column: "party_size",
      },
      {
        table: "customer_order_lines",
        constraint: "customer_order_lines_quantity_check",
        column: "quantity",
      },
      {
        table: "customer_order_tickets",
        constraint: "customer_order_tickets_entries_allowed_check",
        column: "entries_allowed",
      },
      {
        table: "erp_visitor_groups",
        constraint: "erp_visitor_groups_member_count_check",
        column: "member_count",
      },
      {
        table: "erp_visitor_group_members",
        constraint: "erp_visitor_group_members_member_index_check",
        column: "member_index",
      },
    ];
    for (const { constraint, column } of noiSau) {
      expect(compact).toContain(
        `add constraint ${constraint} check (${column} between 1 and 45);`,
      );
    }
  });

  it("hàm giữ chỗ nhận tới 45 khách, không còn trần 20", () => {
    // Nới sáu ràng buộc mà quên đổi luôn điều kiện đầu vào của RPC thì
    // client vẫn bị chặn ở cửa trước khi kịp chạm tới bảng nào — đoàn 32
    // người vẫn không đặt được, dù cơ sở dữ liệu đã sẵn sàng nhận.
    expect(compact).toContain("p_party_size not between 1 and 45");
    expect(compact).not.toContain("not between 1 and 20");
  });

  it("không bỏ hẳn một trần nào mà không dựng lại — mỗi drop đều có add cùng tên", () => {
    // `drop constraint if exists` không kèm `add constraint` cùng tên là bỏ
    // hẳn ràng buộc: bảng còn lại không còn trần nào, và một cú gõ nhầm biến
    // thành một lượt giữ hàng chục nghìn chỗ.
    const dropped = [
      ...compact.matchAll(/drop constraint if exists (\w+);/g),
    ].map((match) => match[1]);
    const added = [...compact.matchAll(/add constraint (\w+)/g)].map(
      (match) => match[1],
    );
    expect(dropped.length).toBeGreaterThan(0);
    for (const name of dropped) {
      expect(added).toContain(name);
    }
  });

  it("bỏ tường minh chữ ký cũ của erp_create_visitor_group trước khi thêm tham số", () => {
    // `create or replace` với danh sách tham số khác chỉ đẻ ra một hàm nạp
    // chồng thứ hai, để nguyên hàm cũ tồn tại song song — đúng chỗ đã sập ở
    // TC-01. Phải bỏ tường minh chữ ký năm tham số trước khi định nghĩa lại
    // với sáu tham số.
    expect(compact).toContain(
      "drop function if exists public.erp_create_visitor_group(uuid, uuid, uuid, text, text);",
    );
  });

  it("erp_set_group_member_details chỉ nhận điền hộ từ phiên khách đã đặt đơn, không phải mã đoàn", () => {
    // Mã đoàn là thứ trưởng đoàn gửi cho cả đoàn, ai cũng cầm. Thiếu chỗ này
    // thì bất kỳ ai trong đoàn cũng sửa được tên mọi người, và không ai truy
    // ra được ai vừa sửa.
    const body = functionBody(
      "create or replace function public.erp_set_group_member_details(",
    );
    expect(body).toContain(
      "v_profile_id <> public.customer_canonical_profile_id(p_tenant_id, v_order.profile_id)",
    );
    expect(body).toContain("GROUP_OWNERSHIP_REQUIRED");
  });

  it("erp_set_group_member_details chỉ nhận tên gọi và nhu cầu chăm sóc — không tuổi, không giấy tờ", () => {
    // Một người đang khai dữ liệu cá nhân của mấy chục người chưa được hỏi.
    // Thêm một trường tuổi hay giấy tờ vào đường điền hộ này là thu đúng thứ
    // QĐ-01 cấm, qua một cửa mà không ai để ý vì nó không đụng bảng danh tính.
    const body = functionBody(
      "create or replace function public.erp_set_group_member_details(",
    );
    for (const tuKhoa of [
      "birth",
      "age",
      "tuoi",
      "cccd",
      "passport",
      "id_number",
    ]) {
      const boundary = new RegExp(`\\b${tuKhoa}\\b`, "i");
      expect(boundary.test(body)).toBe(false);
    }
  });

  it("nhu cầu chăm sóc là danh sách đóng", () => {
    // Một giá trị lạ lọt qua ở đây là một nhu cầu chăm sóc không ai trong ca
    // trực biết phải xử lý ra sao — danh sách phải đóng, không phải văn bản
    // tự do.
    expect(compact).toContain(
      "check (care_need in ('none', 'young-child', 'elderly', 'mobility'))",
    );
  });

  it("tên rỗng thì xoá luôn dấu thời gian kích hoạt", () => {
    // Không xoá `activated_at` khi tên rỗng thì hệ thống vẫn nói "người này
    // từng đồng ý" trong khi không còn tên nào để chứng minh điều đó.
    const body = functionBody(
      "create or replace function public.erp_set_group_member_details(",
    );
    expect(body).toContain(
      "activated_at = case when char_length(v_name) > 0 then coalesce(activated_at, now()) else null end",
    );
  });

  it("đóng cửa đúng cách: revoke/grant đủ hai hàm mới, không lộ cho anon/authenticated", () => {
    // Hai hàm được định nghĩa lại với chữ ký mới trong migration này
    // (`erp_create_visitor_group`, `erp_set_group_member_details`) đều chạy
    // `security definer` — thiếu revoke/grant tương ứng là mở toang cho
    // trình duyệt gọi thẳng, vượt qua toàn bộ kiểm tra sở hữu đơn ở tầng API.
    const revokes = compact.match(/revoke all on function/g) ?? [];
    const grants = compact.match(/grant execute on function/g) ?? [];
    expect(revokes.length).toBeGreaterThan(0);
    expect(revokes).toHaveLength(grants.length);
    expect(compact).not.toContain("to anon");
    expect(compact).not.toContain("to authenticated");
  });

  it("không seed một dòng dữ liệu nào vào hai bảng đoàn", () => {
    // Bảng `erp_visitor_groups` và `erp_visitor_group_members` đã tồn tại từ
    // TC-06 (migration 054) — migration này chỉ nới ràng buộc và định nghĩa
    // lại hàm, không được tranh thủ chèn thêm một dòng trình diễn nào. Cách
    // đúng là bỏ hết nội dung bên trong mọi thân hàm (`as $$ ... $$;`) rồi
    // mới xét: `insert into` hai bảng này bên trong `erp_create_visitor_group`
    // là dữ liệu thật của một đoàn thật, không phải seed.
    let outsideFunctionBodies = "";
    let cursor = 0;
    while (true) {
      const bodyStart = compact.indexOf("as $$", cursor);
      if (bodyStart === -1) {
        outsideFunctionBodies += compact.slice(cursor);
        break;
      }
      outsideFunctionBodies += compact.slice(cursor, bodyStart);
      const bodyEnd = compact.indexOf("$$;", bodyStart);
      expect(bodyEnd).toBeGreaterThan(bodyStart);
      cursor = bodyEnd + "$$;".length;
    }
    expect(outsideFunctionBodies).not.toContain(
      "insert into public.erp_visitor_groups",
    );
    expect(outsideFunctionBodies).not.toContain(
      "insert into public.erp_visitor_group_members",
    );
  });
});
