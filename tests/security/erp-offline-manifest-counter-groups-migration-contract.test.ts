import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * GATE-OFFLINE-02 — hợp đồng của
 * `202609080066_erp_offline_manifest_counter_groups.sql`.
 *
 * Bài này đọc thẳng chuỗi SQL, nên nó **không** chứng minh migration chạy được
 * trên PostgreSQL thật, cũng không chứng minh một đoàn quầy quét lọt lúc mất
 * mạng. Cái nó canh giữ là ba điều một phiên sau rất dễ phá mà migration vẫn
 * chạy trơn tru, chỉ có cả đoàn khách là đứng ngoài cổng:
 *
 * 1. Nhánh mới cho đoàn mua tại quầy còn nguyên trong CTE `moi_ma`.
 * 2. Ba nhánh vẫn nối bằng `union all`, không phải `union` — `union` dọn nhầm
 *    hai người khác nhau tình cờ cùng số lượt còn lại, và bản kê thiếu người.
 * 3. Thân hàm vẫn là thân hàm ở 057, chỉ nhiều thêm chứ không rơi mất dòng
 *    nào: hàng rào tiền TC-22, `v_expires_at`, cách băm mã, phần ghi bản kê.
 *
 * Bẫy đã biết của khuôn bài kiểm này: phần chú thích đầu tệp trích lại gần
 * nguyên văn nhiều câu SQL mà thân hàm cũng dùng (`union all`, câu `join
 * customer_order_tickets`, cả chữ `union` trần trong một câu giải thích). So
 * khớp trên toàn bộ tệp là canh nhầm cái chú thích, và bài kiểm vẫn xanh khi
 * thân hàm đã bị xoá mất đoạn cần canh. Nên mọi khẳng định về HÀNH VI dưới đây
 * đều chạy trên `sqlOnly` — bản đã cắt sạch mọi dòng `--`.
 */

const migrationPath =
  "supabase/migrations/202609080066_erp_offline_manifest_counter_groups.sql";
const basePath = "supabase/migrations/202608310057_customer_pay_on_site.sql";

const sql = readFileSync(migrationPath, "utf8").replace(/\r\n/g, "\n");
const compact = sql.replace(/\s+/g, " ").trim();

/** Cắt sạch mọi chú thích `--` rồi gộp khoảng trắng. Tệp này không có chuỗi
 * ký tự nào chứa `--`, nên phép cắt theo dòng là an toàn. */
function sqlOnlyOf(source: string): string {
  return source
    .split("\n")
    .map((line) => line.replace(/--.*$/, ""))
    .join("\n")
    .replace(/\s+/g, " ")
    .trim();
}

const sqlOnly = sqlOnlyOf(sql);

/** Thân hàm bản kê ngoại tuyến trong một tệp migration, đã cắt hết chú thích. */
function manifestBody(source: string): string {
  const header = source.indexOf(
    "create or replace function public.erp_prepare_offline_gate_manifest(",
  );
  expect(header).toBeGreaterThan(-1);
  const bodyStart = source.indexOf("as $$", header);
  expect(bodyStart).toBeGreaterThan(header);
  const bodyEnd = source.indexOf("$$;", bodyStart);
  expect(bodyEnd).toBeGreaterThan(bodyStart);
  return source.slice(bodyStart, bodyEnd);
}

const body = manifestBody(sqlOnly);

describe("erp offline manifest counter groups migration contract", () => {
  it("chạy trọn trong một transaction", () => {
    // Nửa migration chạy xong nửa kia lỗi thì hàm bản kê nằm ở một trạng thái
    // không ai biết là trạng thái nào — vỡ ở lượt tải bản kê kế tiếp, không
    // phải lúc deploy.
    expect(compact.startsWith("-- GATE-OFFLINE-02")).toBe(true);
    expect(compact).toContain("begin;");
    expect(compact.endsWith("commit;")).toBe(true);
  });

  it("giữ nguyên chữ ký bốn tham số, không sinh ra một hàm nạp chồng thứ hai", () => {
    // Đổi một chữ trong chữ ký là `create` một hàm MỚI chứ không thay hàm cũ:
    // hàm cũ vẫn nằm đó, tầng API vẫn gọi trúng nó, và bản vá này thành vô
    // hình. Cái bẫy ấy đã sập một lần trong dự án này.
    const definitions = sqlOnly.match(/create (?:or replace )?function/g) ?? [];
    expect(definitions).toHaveLength(1);
    expect(sqlOnly).toContain(
      "create or replace function public.erp_prepare_offline_gate_manifest( p_tenant_id uuid, p_site_id uuid, p_actor_account_id text, p_device_id uuid ) returns jsonb language plpgsql security definer set search_path = ''",
    );
  });

  it("mang theo mã riêng từng người của đoàn mua tại quầy", () => {
    // Đây là chính lỗi đang vá. Thiếu nhánh này thì mất mạng ở cổng: mã vé
    // `QUAY-…` vẫn qua, còn cả 45 mã `TV-…` của cùng tấm phiếu ấy đều báo
    // "không có trong danh sách", và cả đoàn đứng ngoài.
    expect(body).toContain(
      "join ve_con_hieu_luc ve on ve.id = grp.ticket_id where member.tenant_id = p_tenant_id and grp.order_id is null and not exists ( select 1 from public.erp_gate_scan_events event where event.tenant_id = member.tenant_id and event.member_id = member.id and event.ticket_id = ve.id and event.result = 'accepted' )",
    );
  });

  it("không phát lại mã của người đã đi qua cổng — cả ba nhánh", () => {
    // Thiếu `not exists` này thì thiết bị ngoại tuyến phát ra một mã còn hiệu
    // lực cho người đã vào rồi: hai lượt vào ghi nhận cho một chỗ.
    const guards =
      body.match(
        /not exists \( select 1 from public\.erp_gate_scan_events event/g,
      ) ?? [];
    expect(guards).toHaveLength(2);
  });

  it("ba nhánh nối bằng union all, không có một `union` trần nào", () => {
    // `union` dọn trùng theo CẢ HÀNG (mã, số lượt còn lại). Mã thành viên là
    // duy nhất nên nó không dọn được gì thật, nhưng nó vẫn bắt PostgreSQL sắp
    // xếp/băm toàn bộ tập — và tệ hơn, nó biến một phép đếm `count(*)` thành
    // một con số không còn khớp với số mã thật sự phát ra.
    const unionAll = body.match(/union all/g) ?? [];
    expect(unionAll).toHaveLength(2);
    expect(/\bunion\b(?!\s+all)/.test(body)).toBe(false);
  });

  it("nhánh đoàn web giữ nguyên từng chữ — vẫn qua cầu nối customer_order_tickets", () => {
    // Đoàn đặt qua web KHÔNG được đổi cách ráp mã: vẫn phải đi qua cầu nối,
    // vẫn tách theo `guest_group` (web có bán vé trẻ em riêng).
    expect(body).toContain(
      "join public.customer_order_tickets bridge on bridge.order_id = grp.order_id and bridge.tenant_id = grp.tenant_id and bridge.guest_group = member.guest_group join ve_con_hieu_luc ve on ve.id = bridge.ticket_id",
    );
  });

  it("một mã thành viên không thể ra hai lần", () => {
    // Nhánh cũ đòi `grp.order_id`, nhánh mới đòi `grp.ticket_id` và còn ghi
    // thẳng `grp.order_id is null`. Một đoàn vừa có cả hai thì chỉ rơi vào
    // nhánh cũ. Ràng buộc xor ở migration 063 vốn đã không cho chuyện đó xảy
    // ra, nhưng bản kê không được phụ thuộc vào một ràng buộc ở tệp khác.
    expect(body).toContain("and grp.order_id is null");
  });

  it("giữ nguyên hàng rào tiền TC-22 — vé còn nợ không phát ra ngoại tuyến", () => {
    // Thiếu đúng chỗ này là thủng một lỗ tiền: mất mạng thì máy ở cổng đối
    // chiếu theo bản kê, và một tấm vé chưa trả tiền nằm trong bản kê sẽ được
    // cho vào như thường.
    expect(body).toContain("cho_thu.mode = 'pay-on-site' and cho_thu.status = 'pending'");
    expect(body).toContain("da_thu.mode = 'pay-on-site' and da_thu.status = 'succeeded'");
  });

  it("chỉ phát ra dấu băm và số lượt còn lại, không một mẩu thông tin khách nào", () => {
    // Bản kê nằm trên máy ở cổng, ngoài tầm với của RLS. Đưa tên hay số điện
    // thoại khách vào đây là mang danh sách khách ra khỏi cơ sở dữ liệu.
    expect(body).toContain(
      "'code_digest', encode(extensions.digest(ma, 'sha256'), 'hex'), 'entries_remaining', con_lai",
    );
    expect(body).not.toMatch(/guest_name|guest_phone|booking_reference|leader_name|leader_phone|display_name/);
  });

  it("không đánh rơi một dòng nào của bản 057 — chỉ thêm vào", () => {
    // "Lấy nguyên thân hàm ở 057 làm nền" phải kiểm được, không phải một lời
    // hứa trong chú thích. Mọi câu SQL của bản đang chạy phải còn nguyên ở bản
    // mới: `v_service_date`, `v_expires_at`, cách băm, phần ghi bản kê, khối
    // JSON trả về. Rơi một dòng là một hành vi đổi âm thầm.
    const baseSql = readFileSync(basePath, "utf8").replace(/\r\n/g, "\n");
    const baseBody = manifestBody(sqlOnlyOf(baseSql));
    const fragments = baseBody
      .split(/(?=\bselect\b|\bfrom\b|\bwhere\b|\band\b|\bif\b|\binsert\b)/)
      .map((piece) => piece.trim())
      .filter((piece) => piece.length > 12);
    expect(fragments.length).toBeGreaterThan(20);
    for (const fragment of fragments) {
      expect(body).toContain(fragment);
    }
  });

  it("chỉ tiến tới: không drop, không sửa dữ liệu cũ, không đụng bảng nào", () => {
    // Production không có PITR và không có bản sao lưu vật lý. Migration này
    // chỉ được phép định nghĩa lại đúng một hàm.
    expect(sqlOnly).not.toMatch(/\bdrop\b/);
    expect(sqlOnly).not.toMatch(/\balter table\b/);
    expect(sqlOnly).not.toMatch(/\bdelete from\b/);
    expect(sqlOnly).not.toMatch(/\btruncate\b/);
    expect(sqlOnly).not.toMatch(/\bcreate table\b/);
    // `update` duy nhất được phép là không có: hàm bản kê chỉ đọc, rồi ghi
    // đúng một hàng nhật ký bản kê của chính nó.
    expect(sqlOnly).not.toMatch(/\bupdate public\./);
    const inserts = sqlOnly.match(/insert into public\.\w+/g) ?? [];
    expect(inserts).toEqual(["insert into public.erp_gate_offline_manifests"]);
  });

  it("đóng cửa đúng cách: chỉ service_role gọi được", () => {
    // Hàm chạy `security definer` và trả ra bản kê của cả một cơ sở. Lộ cho
    // `anon`/`authenticated` là mở một đường đọc thẳng, vượt qua toàn bộ kiểm
    // tra ca trực ở tầng API.
    expect(sqlOnly).toContain(
      "revoke all on function public.erp_prepare_offline_gate_manifest( uuid, uuid, text, uuid ) from public, anon, authenticated;",
    );
    expect(sqlOnly).toContain(
      "grant execute on function public.erp_prepare_offline_gate_manifest( uuid, uuid, text, uuid ) to service_role;",
    );
    expect(sqlOnly).not.toContain("to anon");
    expect(sqlOnly).not.toContain("to authenticated");
  });
});
