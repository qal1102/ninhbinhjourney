import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * TC-13 — hợp đồng của `202609210085_ban_giao_ca_truc_cham_soc.sql`.
 *
 * Bài này đọc chuỗi SQL, không chứng minh hàm chạy được trên PostgreSQL thật.
 * Nó canh ba thứ mà một lần "cho tiện" rất dễ phá: hàm vẫn chỉ đọc, chỉ nói
 * về ngày và cơ sở được hỏi, và **không** mở thêm một trường dữ liệu cá nhân
 * nào ngoài thứ khách tự khai.
 */

const TEP = "supabase/migrations/202609210085_ban_giao_ca_truc_cham_soc.sql";
const CHU_KY = "public.erp_ca_truc_can_de_y(uuid, uuid, date)";

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

describe("TC-13: hàm đọc bản giao ca chăm sóc", () => {
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
      "create or replace function public.erp_ca_truc_can_de_y( p_tenant_id uuid, p_site_id uuid, p_visit_date date ) returns jsonb",
    );
  });

  it("chỉ service_role gọi được", () => {
    expect(ngoaiThan).toContain(`revoke all on function ${CHU_KY} from public, anon, authenticated;`);
    expect(ngoaiThan).toContain(`grant execute on function ${CHU_KY} to service_role;`);
    expect(compact.match(/grant /g)?.length).toBe(1);
    expect(compact).not.toMatch(/to (public|anon|authenticated)\b/);
  });

  it("thiếu đầu vào thì từ chối trước khi đọc bảng nào", () => {
    const kiem =
      "if p_tenant_id is null or p_site_id is null or p_visit_date is null then raise exception using errcode = '22023', message = 'ca_truc_input_invalid';";
    expect(than).toContain(kiem);
    expect(than.indexOf(kiem)).toBeLessThan(than.indexOf("from public."));
  });

  it("chỉ hiện người KHÁCH TỰ KHAI cần hỗ trợ — không suy diễn từ nhóm vé hay giá vé", () => {
    expect(than).toContain("m.care_need <> 'none'");
    expect(than).not.toMatch(/guest_group|product|unit_price|amount|price/);
  });

  it("một đoàn không còn ai cần để ý thì không vào bảng ca trực", () => {
    expect(than).toContain("can_de_y on can_de_y.so_nguoi > 0");
  });

  it("chỉ đúng cơ sở được hỏi, cả ở phần đoàn lẫn phần lượt vào", () => {
    expect(than).toContain("nguon_doan on nguon_doan.site_id = p_site_id");
    expect(than).toContain("and event.site_id = p_site_id");
  });

  it("chỉ đúng ngày được hỏi, và ngày quy về giờ Ninh Bình", () => {
    expect(than).toContain("and o.visit_date = p_visit_date");
    expect(than).toContain("and t.valid_on = p_visit_date");
    expect(than).toContain("(event.scanned_at at time zone 'asia/ho_chi_minh')::date = p_visit_date");
  });

  it("đọc được cả đoàn web lẫn đoàn quầy — đoàn mua ngay tại cổng không được biến mất", () => {
    expect(than).toContain("from public.customer_order_tickets cot");
    expect(than).toContain("from public.erp_tickets t");
    expect(than).toContain("union all");
  });

  it("bỏ đơn đã huỷ và vé đã huỷ, để ca trực không đi đón một đoàn không tới", () => {
    expect(than).toContain("and o.status = 'confirmed'");
    expect(than).toContain("and t.status <> 'void'");
  });

  it("chỉ đếm lượt vào THÀNH CÔNG của chính người ấy", () => {
    expect(than).toContain("where event.tenant_id = m.tenant_id and event.member_id = m.id");
    expect(than).toContain("and event.result = 'accepted'");
  });

  it("chỉ giới hạn trong đúng tenant được hỏi", () => {
    expect(than).toContain("where g.tenant_id = p_tenant_id");
    expect(than).toContain("and cot.tenant_id = g.tenant_id");
    expect(than).toContain("and t.tenant_id = g.tenant_id");
    expect(than).toContain("where m.tenant_id = g.tenant_id");
  });

  it("không chạm một trường giấy tờ tuỳ thân hay hồ sơ khách nào", () => {
    expect(than).not.toMatch(
      /customer_identities|customer_sealed_identity_documents|customer_profiles|identity_|passport|national_id|date_of_birth|email/,
    );
  });

  it("hình dạng trả về cố định, đúng chín trường ngoài cùng", () => {
    const chon = than.slice(than.indexOf("select g.group_code"), than.indexOf("from public.erp_visitor_groups"));
    expect(chon).toContain("g.group_code");
    expect(chon).toContain("g.group_label");
    expect(chon).toContain("g.leader_name");
    expect(chon).toContain("g.leader_phone");
    expect(chon).toContain("g.member_count");
    expect(chon).toContain("nguon_doan.gio_toi");
    expect(chon).toContain("can_de_y.so_nguoi");
    expect(chon).toContain("can_de_y.danh_sach");
    expect(chon).toContain("'web' else 'quay' end as nguon");
  });

  it("mỗi người chỉ mang bốn trường, và không mang mã riêng của họ", () => {
    const nguoi = than.slice(than.indexOf("jsonb_agg(jsonb_build_object("), than.indexOf("order by m.member_index)"));
    const cacKhoa = [...nguoi.matchAll(/'([a-z_]+)',/g)].map((khop) => khop[1]);
    expect(cacKhoa).toEqual(["member_index", "care_need", "display_name", "da_vao"]);
    expect(nguoi).not.toContain("member_code");
  });
});
