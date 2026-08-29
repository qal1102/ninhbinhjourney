import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * TC-06 — hợp đồng của `202608300054_erp_visitor_groups.sql`.
 *
 * Bài này đọc thẳng chuỗi SQL, nên nó **không** chứng minh migration chạy
 * được — việc đó đã làm riêng trên PostgreSQL thật bằng một giao dịch rồi cuộn
 * lại. Cái nó canh giữ là những tính chất mà một lần "dọn cho gọn" ở phiên sau
 * rất dễ phá mà không ai nhận ra, vì phá xong migration vẫn chạy trơn tru —
 * chỉ có dữ liệu hoặc quyền riêng tư là sai âm thầm.
 */

const sql = readFileSync(
  "supabase/migrations/202608300054_erp_visitor_groups.sql",
  "utf8",
);
const compact = sql.replace(/\s+/g, " ").trim();

describe("erp visitor groups migration contract", () => {
  it("chạy trọn trong một transaction", () => {
    // Nửa migration chạy xong nửa kia lỗi thì cột `member_id` đã có trên
    // `erp_gate_scan_events` mà chưa có bảng thành viên để trỏ tới, hoặc
    // ngược lại — vỡ ngay ở lượt quét kế tiếp, không phải lúc deploy.
    expect(compact.startsWith("-- TC-06")).toBe(true);
    expect(compact).toContain("begin;");
    expect(compact.endsWith("commit;")).toBe(true);
  });

  it("không có trường giấy tờ tuỳ thân (QĐ-01)", () => {
    // Đây là quyết định chính sách, không phải lỗi kỹ thuật. Thêm một cột
    // cccd/passport/id_number vào bảng này là thu giấy tờ tuỳ thân của cả
    // đoàn — đúng thứ QĐ-01 cấm — và chỗ duy nhất được phép giữ thứ đó là
    // `customer_identities`, không phải bảng khách đoàn.
    for (const truong of [
      "cccd",
      "passport",
      "id_number",
      "identity_document",
      "national_id",
    ]) {
      expect(compact).not.toContain(truong);
    }
  });

  it("kiểm tra quyền sở hữu đơn trước khi tạo đoàn", () => {
    // Thiếu chỗ này thì ai nhặt được một `order_id` — lộ qua URL, qua log,
    // qua đoán số — cũng tạo được bộ mã QR đi qua cổng bằng vé của người
    // khác, và người đó không hề trả tiền.
    expect(compact).toContain("GROUP_OWNERSHIP_REQUIRED");
    expect(compact).toContain(
      "v_profile_id <> public.customer_canonical_profile_id(p_tenant_id, v_order.profile_id)",
    );
  });

  it("một đơn đúng một đoàn", () => {
    // Cho phép hai đoàn trên một đơn nghĩa là hai bộ mã cùng tiêu một hạn
    // mức vé, và không ai đối soát nổi ai đã vào bằng mã nào.
    expect(compact).toContain("unique (tenant_id, order_id)");
  });

  it("một người, một tấm vé, một lần vào", () => {
    // Bỏ mệnh đề `member_id is not null` đi thì chỉ mục này chạm luôn vào vé
    // đoàn (member_id null) — chặn đứng việc vé đoàn quét nhiều lượt như
    // thiết kế, hỏng toàn bộ luồng cổng hiện có.
    expect(compact).toContain(
      "create unique index if not exists erp_gate_scan_events_member_entry_idx on public.erp_gate_scan_events(tenant_id, ticket_id, member_id) where member_id is not null and result = 'accepted';",
    );
  });

  it("'already-entered' nằm trong ràng buộc kết quả, không đánh rơi giá trị cũ", () => {
    // Đánh rơi một giá trị cũ ở đây là làm hỏng dữ liệu nhật ký quét đang có
    // thật trên production — hàng cũ vi phạm constraint ngay khi migration
    // chạy tới dòng `add constraint`.
    const start = compact.indexOf(
      "add constraint erp_gate_scan_events_result_check",
    );
    expect(start).toBeGreaterThan(-1);
    const end = compact.indexOf(";", start);
    const resultCheck = compact.slice(start, end);
    for (const value of [
      "accepted",
      "not-found",
      "wrong-site",
      "wrong-day",
      "exhausted",
      "already-entered",
      "void",
      "legacy-uncheckable",
    ]) {
      expect(resultCheck).toContain(`'${value}'`);
    }
  });

  it("kích hoạt là tự nguyện: quyết định kết quả quét không đọc activated_at hay display_name", () => {
    // Đây là nguyên tắc cứng: khách chưa kích hoạt vẫn được tham quan. Nếu
    // một phiên sau lỡ tay đưa `activated_at` hay `display_name` vào chuỗi
    // if/elsif quyết định `v_result`, việc khách có tự khai tên hay không sẽ
    // âm thầm quyết định ai được qua cổng — đúng điều bị cấm.
    //
    // Cắt tới ngay trước khối trả JSON cuối (nơi `display_name` được trả về
    // như một thông tin hiển thị, không phải điều kiện), để không bắt nhầm
    // một trường vô hại trong payload trả về.
    const fnStart = compact.indexOf(
      "create or replace function public.erp_gate_scan_ticket_at(",
    );
    const nextFnStart = compact.indexOf(
      "create or replace function public.erp_prepare_offline_gate_manifest(",
    );
    expect(fnStart).toBeGreaterThan(-1);
    expect(nextFnStart).toBeGreaterThan(fnStart);
    const fnBody = compact.slice(fnStart, nextFnStart);
    const finalReturnStart = fnBody.indexOf("'event_id', v_event.id");
    expect(finalReturnStart).toBeGreaterThan(-1);
    const decisionRegion = fnBody.slice(0, finalReturnStart);
    expect(decisionRegion).not.toContain("activated_at");
    expect(decisionRegion).not.toContain("display_name");
  });

  it("rút lại tên thì xoá luôn dấu thời gian kích hoạt", () => {
    // Không xoá `activated_at` khi tên rỗng thì hệ thống vẫn nói "người này
    // từng đồng ý" trong khi không còn tên nào để chứng minh điều đó.
    expect(compact).toContain(
      "activated_at = case when char_length(v_name) > 0 then coalesce(activated_at, now()) else null end",
    );
  });

  it("bản kê offline mang cả mã thành viên", () => {
    // Thiếu chỗ này thì cùng một mã QR chạy được lúc có mạng và bị từ chối
    // lúc mất mạng — một sự không nhất quán im lặng ngay tại cổng.
    expect(compact).toContain("union all");
    expect(compact).toContain("select member.member_code, ve.con_lai");
  });

  it("bản kê không phát lại mã của người đã vào", () => {
    // Thiếu `not exists` này thì thiết bị offline phát ra một mã còn hiệu
    // lực cho người đã đi qua cổng rồi — hai lượt vào ghi nhận cho một vé.
    expect(compact).toContain(
      "not exists ( select 1 from public.erp_gate_scan_events event where event.tenant_id = member.tenant_id and event.member_id = member.id and event.ticket_id = ve.id and event.result = 'accepted' )",
    );
  });

  it("đóng cửa đúng cách: revoke/grant đủ ba hàm, RLS bật, không lộ cho anon/authenticated", () => {
    // Ba hàm mới (tạo đoàn, kích hoạt thành viên, xem trạng thái) đều chạy
    // `security definer` — thiếu revoke/grant tương ứng là mở toang cho
    // trình duyệt gọi thẳng, vượt qua toàn bộ kiểm tra sở hữu đơn ở tầng API.
    const revokes = compact.match(/revoke all on function/g) ?? [];
    const grants = compact.match(/grant execute on function/g) ?? [];
    expect(revokes).toHaveLength(3);
    expect(grants).toHaveLength(3);
    expect(compact).toContain(
      "alter table public.erp_visitor_groups enable row level security;",
    );
    expect(compact).toContain(
      "alter table public.erp_visitor_group_members enable row level security;",
    );
    expect(compact).not.toContain("to anon");
    expect(compact).not.toContain("to authenticated");
  });

  it("không seed một dòng dữ liệu trình diễn nào vào hai bảng mới", () => {
    // Chỉ có hai chỗ hợp lệ để `insert into` hai bảng này là bên trong thân
    // hàm `erp_create_visitor_group` (dữ liệu thật, từ đơn thật). Phần khai
    // báo bảng — trước khi có bất kỳ hàm nào — không được chèn sẵn một dòng
    // trình diễn nào.
    const firstFunctionStart = compact.indexOf(
      "create or replace function public.erp_create_visitor_group(",
    );
    expect(firstFunctionStart).toBeGreaterThan(-1);
    const tableSetupRegion = compact.slice(0, firstFunctionStart);
    expect(tableSetupRegion).not.toContain(
      "insert into public.erp_visitor_groups",
    );
    expect(tableSetupRegion).not.toContain(
      "insert into public.erp_visitor_group_members",
    );
  });
});
