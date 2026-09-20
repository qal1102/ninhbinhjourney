import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * TC-10 — hợp đồng của `202609180077_erp_visitor_group_member_journey.sql`.
 *
 * Bài này đọc chuỗi SQL, không chứng minh hàm chạy được trên PostgreSQL thật.
 * Nó canh những thứ một lần "gom cho gọn" rất dễ phá mà không ai thấy: mã thành
 * viên chỉ mở ra dữ liệu của đúng người cầm mã, hình dạng trả về cố định, và
 * không vai nào ngoài `service_role` gọi được.
 *
 * Chú thích đầu tệp nhắc lại tên nhiều bảng và trường bị cấm, nên mọi khẳng
 * định về hành vi đều bỏ chú thích trước rồi cắt riêng thân hàm.
 */

const TEP = "supabase/migrations/202609180077_erp_visitor_group_member_journey.sql";
const CHU_KY = "public.erp_visitor_group_member_journey(uuid, text)";

function boChuThich(sql: string) {
  return sql
    .split("\n")
    .map((dong) => {
      const viTri = dong.indexOf("--");
      return viTri === -1 ? dong : dong.slice(0, viTri);
    })
    .join("\n")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

const compact = boChuThich(readFileSync(TEP, "utf8"));
const than = compact.slice(compact.indexOf("as $$") + "as $$".length, compact.lastIndexOf("$$;"));
const ngoaiThan = compact.slice(0, compact.indexOf("as $$")) + compact.slice(compact.lastIndexOf("$$;"));

/** Khối `return jsonb_build_object(...)` cuối hàm: thứ duy nhất đi ra ngoài. */
const traVe = than.slice(than.lastIndexOf("return jsonb_build_object("), than.lastIndexOf("end;"));

describe("TC-10: hàm đọc hành trình của một thành viên", () => {
  it("chỉ là một hàm đọc trong một transaction: không đổi bảng, không ghi dữ liệu", () => {
    expect(compact.startsWith("begin;")).toBe(true);
    expect(compact.endsWith("commit;")).toBe(true);
    expect(compact).not.toMatch(
      /alter table|create table|insert into|update public\.|delete from|truncate|drop |create trigger|create index|merge into|perform /,
    );
    expect(compact).toContain(
      "returns jsonb language plpgsql stable security definer set search_path = ''",
    );
  });

  it("đúng một chữ ký, không sinh bản nạp chồng", () => {
    expect(compact.match(/create (or replace )?function/g)).toEqual(["create or replace function"]);
    expect(compact).toContain(
      "create or replace function public.erp_visitor_group_member_journey( p_tenant_id uuid, p_member_code text ) returns jsonb",
    );
  });

  it("chỉ service_role gọi được", () => {
    expect(ngoaiThan).toContain(`revoke all on function ${CHU_KY} from public, anon, authenticated;`);
    expect(ngoaiThan).toContain(`grant execute on function ${CHU_KY} to service_role;`);
    expect(compact.match(/grant /g)?.length).toBe(1);
    expect(compact).not.toMatch(/to (public|anon|authenticated)\b/);
  });

  it("kiểm khuôn mã bằng đúng khuôn cột member_code, trước khi đọc bảng nào", () => {
    const rangBuocCot = /member_code text not null check \(member_code ~ '(\^tv-\[a-z0-9\]\{10\}\$)'\)/;
    const khuonGoc = boChuThich(
      readFileSync("supabase/migrations/202608300054_erp_visitor_groups.sql", "utf8"),
    ).match(rangBuocCot)?.[1];
    expect(khuonGoc).toBe("^tv-[a-z0-9]{10}$");

    const kiemKhuon = `if p_tenant_id is null or v_code !~ '${khuonGoc}' then raise exception using errcode = '22023', message = 'group_input_invalid';`;
    expect(than).toContain(kiemKhuon);
    expect(than).toContain("v_code text := upper(trim(coalesce(p_member_code, '')));");
    expect(than.indexOf(kiemKhuon)).toBeLessThan(than.indexOf(" from public."));
  });

  it("mã không có thật thì báo không tìm thấy, không trả về một hàng rỗng", () => {
    expect(than).toContain(
      "if v_member_id is null then raise exception using errcode = 'p0002', message = 'group_member_not_found';",
    );
  });

  it("đọc bảng thành viên đúng một lần, bằng chính mã được hỏi, trong đúng tenant", () => {
    expect(than.match(/erp_visitor_group_members/g)?.length).toBe(1);
    expect(than).toContain(
      "from public.erp_visitor_group_members m where m.tenant_id = p_tenant_id and m.member_code = v_code;",
    );
  });

  it("hình dạng trả về cố định: đúng năm trường, theo đúng thứ tự", () => {
    const cacKhoa = [...traVe.matchAll(/'([a-z_]+)',/g)].map((khop) => khop[1]);
    expect(cacKhoa).toEqual(["member_code", "guest_group", "display_name", "visit_date", "entries"]);
    expect(than.match(/jsonb_build_object\(/g)?.length).toBe(2);
  });

  it("mỗi lượt vào chỉ mang nơi và giờ", () => {
    const luotVao = than.slice(than.indexOf("select coalesce(jsonb_agg("), than.indexOf("into v_entries"));
    const cacKhoa = [...luotVao.matchAll(/'([a-z_]+)',/g)].map((khop) => khop[1]);
    expect(cacKhoa).toEqual(["site_id", "scanned_at"]);
    expect(luotVao).toContain("order by event.scanned_at, event.id");
  });

  it("chỉ lượt vào thành công của chính người này", () => {
    expect(than).toContain(
      "from public.erp_gate_scan_events event where event.tenant_id = p_tenant_id and event.member_id = v_member_id and event.result = 'accepted';",
    );
  });

  it("ngày đi đọc được cả đoàn web lẫn đoàn quầy, và chỉ đọc đúng cột ngày", () => {
    expect(than).toContain("select coalesce(o.visit_date, t.valid_on) into v_visit_date");
    expect(than).toContain(
      "left join public.customer_orders o on o.id = g.order_id and o.tenant_id = g.tenant_id",
    );
    expect(than).toContain(
      "left join public.erp_tickets t on t.id = g.ticket_id and t.tenant_id = g.tenant_id",
    );
    expect(than).toContain("where g.id = v_group_id and g.tenant_id = p_tenant_id;");
  });

  it("không một chữ nào về người khác, trưởng đoàn, liên lạc hay giấy tờ tuỳ thân", () => {
    expect(than).not.toMatch(
      /leader_|group_label|order_code|care_need|member_index|activated|phone|email|contact|guest_name|customer_profiles|customer_identities|customer_sealed_identity_documents|identity|profile_id|anonymous_id|erp_visitor_group_status/,
    );
    // Đọc bảng đoàn đúng một lần, chỉ để lấy ngày đi.
    expect(than.match(/erp_visitor_groups\b/g)?.length).toBe(1);
  });
});
