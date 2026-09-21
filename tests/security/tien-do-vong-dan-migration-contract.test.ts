import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Mạch dẫn — hợp đồng của `202609210086_tien_do_vong_dan.sql`.
 *
 * Bài này đọc chuỗi SQL, không chứng minh hàm chạy được trên PostgreSQL thật.
 * Nó canh đúng những thứ mà một lần "cho tiện" rất dễ phá ở một bảng nhìn có
 * vẻ vô hại: bảng ghi nhớ tiến độ **không được** phình ra thành nơi chứa dữ
 * liệu nghiệp vụ, không ai ngoài `service_role` chạm được, và số chặng không
 * bao giờ bị kéo lùi sau lưng người đang đọc.
 */

const TEP = "supabase/migrations/202609210086_tien_do_vong_dan.sql";
const DOC = "public.erp_doc_tien_do_huong_dan(uuid, text, text)";
const GHI = "public.erp_ghi_tien_do_huong_dan(uuid, text, text, integer, boolean, boolean, boolean)";

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

describe("Mạch dẫn: bảng ghi nhớ tiến độ", () => {
  it("nằm gọn trong một transaction", () => {
    expect(compact.startsWith("begin;")).toBe(true);
    expect(compact.endsWith("commit;")).toBe(true);
  });

  it("bật RLS, như mọi bảng khác trong kho", () => {
    expect(compact).toContain(
      "alter table public.erp_huong_dan_tien_do enable row level security;",
    );
  });

  it("một người một vòng đúng một hàng", () => {
    expect(compact).toContain("primary key (tenant_id, account_id, vong_id)");
  });

  it("KHÔNG giữ một cột dữ liệu nghiệp vụ nào", () => {
    // Đối chiếu trên **danh sách cột**, không trên cả khối chữ: chính tên bảng
    // `erp_huong_dan_tien_do` có chữ "tien" trong đó, nên quét cả khối là tự
    // bắt oan mình.
    const thanBang = compact.slice(
      compact.indexOf("create table if not exists public.erp_huong_dan_tien_do"),
      compact.indexOf("alter table public.erp_huong_dan_tien_do enable"),
    );
    const cot = [...thanBang.matchAll(/(?:^|\(|,)\s*([a-z_]+)\s+(?:uuid|text|integer|timestamptz|boolean)/g)]
      .map((khop) => khop[1])
      .filter((ten) => ten !== "references");
    expect(cot.sort()).toEqual([
      "account_id",
      "bo_qua_at",
      "chang_hien_tai",
      "da_xong_at",
      "tenant_id",
      "updated_at",
      "vong_id",
    ]);
  });

  it("không mở quyền cho người lạ — chỉ service_role gọi được hai hàm", () => {
    expect(compact).toContain(`revoke all on function ${DOC} from public, anon, authenticated;`);
    expect(compact).toContain(`grant execute on function ${DOC} to service_role;`);
    expect(compact).toContain(`revoke all on function ${GHI} from public, anon, authenticated;`);
    expect(compact).toContain(`grant execute on function ${GHI} to service_role;`);
    expect(compact.match(/grant /g)?.length).toBe(2);
    // `\bto\b` chứ không phải `to`: không có ranh giới từ thì "insert **into**
    // public" cũng khớp, và bài kiểm tố cáo một lượt cấp quyền không tồn tại.
    expect(compact).not.toMatch(/\bto\s+(public|anon|authenticated)\b/);
    // Không cấp quyền thẳng trên bảng cho bất kỳ ai.
    expect(compact).not.toMatch(/grant[^;]*on (table )?public\.erp_huong_dan_tien_do/);
  });

  it("hàm đọc chỉ đọc, và chưa từng đi thì trả trạng thái mặc định chứ không vỡ", () => {
    const than = compact.slice(
      compact.indexOf("create or replace function public.erp_doc_tien_do_huong_dan"),
      compact.indexOf("create or replace function public.erp_ghi_tien_do_huong_dan"),
    );
    expect(than).toContain("stable security definer set search_path = ''");
    expect(than).not.toMatch(/insert into|update public\.|delete from/);
    expect(than).toContain("if not found then");
    expect(than).toContain("'chang_hien_tai', 1");
    expect(than).toContain("'tung_di', false");
  });

  it("số chặng chỉ tiến, không lùi ngầm", () => {
    expect(compact).toContain(
      "set chang_hien_tai = greatest(public.erp_huong_dan_tien_do.chang_hien_tai, excluded.chang_hien_tai)",
    );
  });

  it("đã xong hoặc đã bỏ qua thì không bị một lượt ghi sau xoá mất", () => {
    expect(compact).toContain(
      "da_xong_at = coalesce(public.erp_huong_dan_tien_do.da_xong_at, excluded.da_xong_at)",
    );
    expect(compact).toContain(
      "bo_qua_at = coalesce(public.erp_huong_dan_tien_do.bo_qua_at, excluded.bo_qua_at)",
    );
  });

  it("đi lại từ đầu là đường riêng, và chỉ chạm đúng một hàng", () => {
    const than = compact.slice(compact.indexOf("if v_di_lai then"));
    expect(than).toContain("chang_hien_tai = 1");
    expect(than).toContain("da_xong_at = null");
    expect(than).toContain("bo_qua_at = null");
    // Xoá bằng DELETE thì dễ trượt tay sang hàng người khác; ở đây chỉ upsert.
    expect(compact).not.toMatch(/delete from public\.erp_huong_dan_tien_do/);
  });

  it("ghi xong thì đọc lại, để màn hình không phải đoán kết quả", () => {
    expect(compact).toContain(
      "return public.erp_doc_tien_do_huong_dan(p_tenant_id, v_account, v_vong);",
    );
  });

  it("đầu vào rỗng thì từ chối trước khi chạm bảng", () => {
    const than = compact.slice(compact.indexOf("create or replace function public.erp_ghi_tien_do_huong_dan"));
    const kiem =
      "if p_tenant_id is null or v_account = '' or v_vong = '' then raise exception using errcode = '22023', message = 'huong_dan_input_invalid';";
    expect(than).toContain(kiem);
    expect(than.indexOf(kiem)).toBeLessThan(than.indexOf("insert into"));
  });
});
