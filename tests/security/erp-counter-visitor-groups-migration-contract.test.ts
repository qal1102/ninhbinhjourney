import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * TC-18 — hợp đồng của `202609060063_erp_counter_visitor_groups.sql`.
 *
 * Bài này đọc thẳng chuỗi SQL, không chứng minh migration chạy được trên
 * PostgreSQL thật. Cái nó canh giữ là những tính chất một lần "dọn cho gọn" ở
 * phiên sau rất dễ phá mà không ai nhận ra ngay: đoàn quầy vẫn quét được bằng
 * mã riêng từng người, đoàn web không bị đụng một dòng nào, và không hàm mới
 * nào lộ ra cho `anon`/`authenticated`.
 *
 * Cảnh báo đã được nhắc trước khi viết bài này: phần chú thích đầu tệp trích
 * lại gần như nguyên văn nhiều cụm mà thân hàm cũng dùng (`erp_gate_actor_can_scan`,
 * `customer_order_tickets`, …) — nếu so khớp trên toàn bộ `compact` thì một
 * bài kiểm tưởng đang canh thân hàm thực ra chỉ đang canh cái comment, và vẫn
 * xanh khi thân hàm bị xoá mất đoạn cần canh. Nên mọi khẳng định về HÀNH VI
 * của một hàm cụ thể trong bài này đều cắt thân hàm ra trước (`functionBody`,
 * cắt từ `as $$` tới `$$;`) rồi mới `toContain` trên phần đã cắt, không bao
 * giờ so khớp trên `compact` nguyên văn cho việc đó.
 */

const sql = readFileSync(
  "supabase/migrations/202609060063_erp_counter_visitor_groups.sql",
  "utf8",
);
const compact = sql.replace(/\s+/g, " ").trim();

/**
 * Lấy đúng thân một hàm, theo LẦN XUẤT HIỆN CỦA CHỮ KÝ (không phải tên hàm
 * trong comment) — tìm từ `create or replace function public.<tên>(` hoặc
 * `create function public.<tên>(` để không khớp nhầm vào một dòng comment
 * chỉ nhắc tên hàm.
 */
function functionBody(functionName: string): string {
  const header = new RegExp(
    `create (?:or replace )?function public\\.${functionName}\\(`,
  );
  const headerMatch = compact.match(header);
  expect(headerMatch).not.toBeNull();
  const headerStart = headerMatch!.index!;
  const bodyStart = compact.indexOf("as $$", headerStart);
  expect(bodyStart).toBeGreaterThan(headerStart);
  const bodyEnd = compact.indexOf("$$;", bodyStart);
  expect(bodyEnd).toBeGreaterThan(bodyStart);
  return compact.slice(bodyStart, bodyEnd);
}

/** Toàn bộ nội dung NGOÀI mọi thân hàm `as $$ ... $$;` — dùng để canh những
 * điều phải đúng ở tầng DDL (constraint, grant), tách khỏi mọi trích dẫn
 * trong comment đầu file lẫn trong thân hàm. */
function outsideFunctionBodies(): string {
  let result = "";
  let cursor = 0;
  while (true) {
    const bodyStart = compact.indexOf("as $$", cursor);
    if (bodyStart === -1) {
      result += compact.slice(cursor);
      break;
    }
    result += compact.slice(cursor, bodyStart);
    const bodyEnd = compact.indexOf("$$;", bodyStart);
    expect(bodyEnd).toBeGreaterThan(bodyStart);
    cursor = bodyEnd + "$$;".length;
  }
  return result;
}

describe("erp counter visitor groups migration contract", () => {
  it("chạy trọn trong một transaction", () => {
    expect(compact.startsWith("-- TC-18")).toBe(true);
    expect(compact).toContain("begin;");
    expect(compact.endsWith("commit;")).toBe(true);
  });

  it("erp_visitor_groups.order_id được nới thành nullable, không xoá cột", () => {
    const ddl = outsideFunctionBodies();
    expect(ddl).toContain("alter table public.erp_visitor_groups alter column order_id drop not null;");
  });

  it("erp_tickets có khoá (id, tenant_id) để làm đích khoá ngoại ghép cặp", () => {
    const ddl = outsideFunctionBodies();
    expect(ddl).toContain(
      "add constraint erp_tickets_id_tenant_key unique (id, tenant_id);",
    );
  });

  it("ticket_id có khoá ngoại ghép tenant về erp_tickets, on delete restrict", () => {
    const ddl = outsideFunctionBodies();
    expect(ddl).toContain(
      "foreign key (ticket_id, tenant_id) references public.erp_tickets(id, tenant_id) on delete restrict;",
    );
  });

  it("đúng một trong hai nguồn gốc — ràng buộc xor bằng num_nonnulls", () => {
    // Thiếu ràng buộc này là mở đường cho một hàng vừa có order_id vừa có
    // ticket_id (hai nguồn gốc cùng lúc, vô nghĩa) hoặc cả hai đều null (một
    // đoàn không treo vào đâu cả, không ai đối soát nổi).
    const ddl = outsideFunctionBodies();
    expect(ddl).toContain(
      "add constraint erp_visitor_groups_origin_xor_check check (num_nonnulls(order_id, ticket_id) = 1);",
    );
  });

  it("mỗi drop constraint đều có add constraint cùng tên đi kèm — không bỏ hẳn một ràng buộc nào", () => {
    const dropped = [...compact.matchAll(/drop constraint if exists (\w+);/g)].map(
      (match) => match[1],
    );
    const added = [...compact.matchAll(/add constraint (\w+)/g)].map((match) => match[1]);
    expect(dropped.length).toBeGreaterThan(0);
    for (const name of dropped) {
      expect(added).toContain(name);
    }
  });

  it("erp_visitor_group_status đọc customer_orders bằng left join, không còn ép buộc phải có đơn", () => {
    // Bản gốc (TC-06/TC-15) dùng `join` — một đoàn quầy (order_id = null) sẽ
    // biến mất hoàn toàn khỏi kết quả nếu chỗ này vẫn là inner join.
    const body = functionBody("erp_visitor_group_status");
    expect(body).toContain("left join public.customer_orders o on o.id = g.order_id and o.tenant_id = g.tenant_id");
    expect(body).toContain("left join public.erp_tickets t on t.id = g.ticket_id and t.tenant_id = g.tenant_id");
    expect(body).toContain("coalesce(o.visit_date, t.valid_on)");
    expect(body).not.toContain("join public.customer_orders o on o.id = g.order_id and o.tenant_id = g.tenant_id where");
  });

  it("erp_gate_scan_ticket_at giữ nguyên nhánh cầu nối cũ cho đoàn web", () => {
    // Đoàn web KHÔNG được đổi cách tìm vé — vẫn phải đi qua
    // customer_order_tickets, lọc đúng site và đúng guest_group.
    const body = functionBody("erp_gate_scan_ticket_at");
    expect(body).toContain(
      "join public.customer_order_tickets bridge on bridge.order_id = g.order_id and bridge.tenant_id = g.tenant_id",
    );
    expect(body).toContain("bridge.site_id = p_site_id and bridge.guest_group = v_member.guest_group");
  });

  it("erp_gate_scan_ticket_at thêm nhánh mới: đoàn có ticket_id thì lấy thẳng vé đó", () => {
    const body = functionBody("erp_gate_scan_ticket_at");
    expect(body).toContain("select g.ticket_id into v_group_ticket_id");
    expect(body).toContain("if v_group_ticket_id is not null then");
    expect(body).toContain(
      "select ticket.* into v_ticket from public.erp_tickets ticket where ticket.id = v_group_ticket_id and ticket.tenant_id = p_tenant_id for update;",
    );
  });

  it("erp_gate_scan_ticket_at vẫn khoá dòng vé bằng for update ở mọi nhánh tìm vé", () => {
    // Thiếu khoá là hai lượt quét cùng lúc có thể cùng đọc "còn 1 lượt" rồi
    // cùng cho qua — đúng lỗi race condition mà T8 dựng ra để chặn.
    const body = functionBody("erp_gate_scan_ticket_at");
    const forUpdateCount = (body.match(/for update/g) ?? []).length;
    expect(forUpdateCount).toBeGreaterThanOrEqual(3);
  });

  it("erp_counter_actor_can_sell kiểm đúng ba lớp quyền: giám đốc, quản lý vùng, nhân viên có module ve-dat-cho", () => {
    const body = functionBody("erp_counter_actor_can_sell");
    expect(body).toContain("'director', null");
    expect(body).toContain("'regional-manager', p_site_id");
    expect(body).toContain("'employee', p_site_id");
    expect(body).toContain("'ve-dat-cho' = any(access.module_ids)");
  });

  it("erp_create_counter_visitor_group luôn kiểm quyền trước khi ghi bất kỳ hàng nào", () => {
    const body = functionBody("erp_create_counter_visitor_group");
    const guardIndex = body.indexOf("erp_counter_actor_can_sell");
    const firstInsertIndex = body.indexOf("insert into");
    expect(guardIndex).toBeGreaterThan(-1);
    expect(firstInsertIndex).toBeGreaterThan(-1);
    expect(guardIndex).toBeLessThan(firstInsertIndex);
  });

  it("một khoá chống trùng chỉ lập được đúng một phiếu — có chỉ số duy nhất canh ở tầng dữ liệu", () => {
    // Nút tự khoá lúc đang chờ chỉ chặn được cú bấm thứ hai trên cùng màn
    // hình. Máy ở quầy chạy 4G: kết nối rơi giữa chừng, nhân viên gửi lại, và
    // tấm phiếu thừa cộng thẳng vào ô "vé đã bán" của giám đốc. Hàng rào thật
    // phải nằm ở tầng dữ liệu, không phải ở tầng giao diện.
    expect(compact).toContain(
      "create unique index erp_visitor_groups_counter_request_key_idx on public.erp_visitor_groups (tenant_id, counter_request_key) where counter_request_key is not null",
    );
    expect(compact).toContain(
      "add column if not exists counter_request_key text",
    );
  });

  it("gửi lại cùng một khoá thì trả về phiếu cũ, và trả về TRƯỚC khi ghi thêm hàng nào", () => {
    const body = functionBody("erp_create_counter_visitor_group");
    const lookupIndex = body.indexOf("g.counter_request_key = v_key");
    const firstInsertIndex = body.indexOf("insert into");
    expect(lookupIndex).toBeGreaterThan(-1);
    expect(lookupIndex).toBeLessThan(firstInsertIndex);
    // Và phép tra ấy phải đứng SAU bước kiểm quyền: một khoá lạ không được
    // trở thành đường đọc dữ liệu đoàn mà không cần quyền bán ở cơ sở này.
    expect(body.indexOf("erp_counter_actor_can_sell")).toBeLessThan(lookupIndex);
  });

  it("hai lượt gửi sát nhau không làm hỏng việc của nhân viên, cũng không để lại vé mồ côi", () => {
    const body = functionBody("erp_create_counter_visitor_group");
    // Cả hai lượt đều qua được phép tra ở trên, chỉ số duy nhất chặn lượt sau.
    // Khi ấy trả về đúng tấm phiếu lượt trước đã lập; khối `exception` cuộn
    // lại cả tấm vé vừa chèn nên không còn hàng `erp_tickets` mồ côi nào.
    expect(body).toContain("when unique_violation then");
    // Trùng mã vé hay mã đoàn cũng ném cùng mã lỗi — khi ấy không tìm thấy gì
    // và lỗi phải được ném tiếp nguyên vẹn, không được nuốt đi.
    expect(body).toContain("raise;");
  });

  it("khoá chống trùng là bắt buộc — thiếu nó thì từ chối, không lặng lẽ lập phiếu", () => {
    const body = functionBody("erp_create_counter_visitor_group");
    expect(body).toContain("v_key is null or char_length(v_key) > 128");
    expect(body).toContain("GROUP_COUNTER_INPUT_INVALID");
  });

  it("erp_create_counter_visitor_group tự sinh cả mã vé và mã đoàn — không tham số nào nhận mã gõ tay (ERP-UX-06)", () => {
    const body = functionBody("erp_create_counter_visitor_group");
    expect(body).toContain("v_ticket_code := 'QUAY-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));");
    expect(body).toContain("v_group_code := 'DOAN-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));");
    // Chữ ký của hàm không có bất kỳ tham số nào tên "code" — nghĩa là không
    // có đường nào truyền một mã có sẵn từ bên ngoài vào.
    const signature = compact.slice(
      compact.indexOf("create or replace function public.erp_create_counter_visitor_group("),
      compact.indexOf("as $$", compact.indexOf("create or replace function public.erp_create_counter_visitor_group(")),
    );
    expect(/p_\w*code\w*/i.test(signature)).toBe(false);
  });

  it("erp_create_counter_visitor_group giới hạn đúng 1–45 người, khớp trần xe khách của TC-15", () => {
    const body = functionBody("erp_create_counter_visitor_group");
    expect(body).toContain("p_party_size not between 1 and 45");
  });

  it("erp_create_counter_visitor_group không tạo hàng customer_orders nào — không đụng doanh thu web", () => {
    const body = functionBody("erp_create_counter_visitor_group");
    expect(body).not.toContain("customer_orders");
    expect(body).not.toContain("customer_booking_slots");
    expect(body).not.toContain("customer_order_tickets");
    expect(body).not.toContain("customer_profiles");
  });

  it("erp_create_visitor_group (đường web) không bị định nghĩa lại trong migration này", () => {
    // Nếu một lượt sửa sau lỡ tay `create or replace` luôn cả hàm này ở đây,
    // đó là dấu hiệu đường web đã bị đụng vào — điều migration này cam kết
    // không làm.
    expect(compact).not.toContain(
      "create or replace function public.erp_create_visitor_group(",
    );
  });

  it("mọi vé quầy đi qua đây đều mang channel quay-ve và product group", () => {
    const body = functionBody("erp_create_counter_visitor_group");
    expect(body).toContain("'group', 'quay-ve', v_today, p_party_size");
  });

  it("đóng cửa đúng cách: revoke/grant đủ hai hàm mới, không lộ cho anon/authenticated", () => {
    const revokes = compact.match(/revoke all on function/g) ?? [];
    const grants = compact.match(/grant execute on function/g) ?? [];
    expect(revokes.length).toBeGreaterThan(0);
    expect(revokes).toHaveLength(grants.length);
    expect(compact).not.toContain("to anon");
    expect(compact).not.toContain("to authenticated");
  });

  it("không seed một dòng dữ liệu trình diễn nào — chỉ DDL và định nghĩa hàm", () => {
    const ddl = outsideFunctionBodies();
    expect(ddl).not.toContain("insert into public.erp_tickets");
    expect(ddl).not.toContain("insert into public.erp_visitor_groups");
    expect(ddl).not.toContain("insert into public.erp_visitor_group_members");
  });
});
