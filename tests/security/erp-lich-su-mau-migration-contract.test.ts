import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  fileURLToPath(new URL("../../supabase/migrations/202609260092_lich_su_mau_60_ngay.sql", import.meta.url)),
  "utf8",
).replace(/\r\n/g, "\n");
const compact = sql.replace(/\s+/g, " ").trim();

describe("migration 092: lịch sử mẫu 60 ngày", () => {
  it("chạy trọn một giao dịch, không bỏ bảng nào", () => {
    expect(compact.startsWith("--")).toBe(true);
    expect(compact).toContain("begin;");
    expect(compact.endsWith("commit;")).toBe(true);
    // Xoá chỉ có trong hàm dọn mẫu (kiểm riêng ở dưới); không bỏ bảng nào.
    expect(compact).not.toMatch(/\btruncate\b/i);
    expect(compact).not.toContain("drop " + "table");
  });

  it("vé mẫu mang nguồn riêng, vé gieo cũ vẫn giữ nguồn của nó", () => {
    expect(compact).toContain("check (data_origin in ('real', 'demo-seed', 'demo-history'))");
    expect(compact).toContain("'demo-history'");
  });

  it("mọi hàng mẫu nhận ra được để gỡ: mã bắt đầu bằng de000000", () => {
    expect(compact).toContain("select ('de000000' || substr(md5(p_khoa), 9, 24))::uuid;");
    expect(compact).toContain("'mau-' || md5(v_khoa)");
  });

  it("khoá sinh mã không phụ thuộc múi giờ của phiên, nên chạy lại không nhân đôi", () => {
    expect(compact).toContain("v_k text := extract(epoch from date_trunc('hour', p_gio))::bigint::text;");
    // Ghép thẳng timestamptz vào chuỗi là đọc theo TimeZone của phiên.
    expect(sql).not.toMatch(/\|\|\s*v_gio\s*\|\|/);
    expect(compact).toContain("on conflict do nothing");
  });

  it("chỉ sinh việc đã xảy ra, và có công tắc tắt", () => {
    expect(compact).toContain("continue when v_luc >= p_den;");
    expect(compact).toContain("continue when v_quet >= p_den;");
    expect(compact).toContain("create table if not exists public.erp_lich_su_mau_cau_hinh");
    expect(compact).toContain("if not coalesce((select bat from public.erp_lich_su_mau_cau_hinh where id), false) then return 0;");
  });

  it("hàm sinh và hàm đọc tiền chỉ service_role gọi được", () => {
    expect(compact).toContain(
      "revoke all on function public.erp_lich_su_mau_sinh_gio(timestamptz, timestamptz) from public, anon, authenticated, service_role;",
    );
    expect(compact).toContain("grant execute on function public.erp_lich_su_mau_sinh_gio(timestamptz, timestamptz) to service_role;");
    expect(compact).toContain("grant execute on function public.erp_doanh_thu_ky(uuid, uuid[], timestamptz, timestamptz) to service_role;");
    expect(compact).not.toMatch(/grant execute on function public\.erp_(lich_su_mau_sinh_gio|doanh_thu_ky)\([^)]*\) to (anon|authenticated|public)/);
    expect(compact).toContain("security definer");
    expect(compact).toContain("set search_path = ''");
  });

  it("trang đầu giám đốc cộng lịch sử mẫu, loại vé gieo cũ, và nói ra phần mẫu", () => {
    expect(compact).toContain("count(*) filter (where ve.data_origin in ('real', 'demo-history')) as ticket_count");
    expect(compact).toContain("count(*) filter (where ve.data_origin = 'demo-seed') as demo_seed_ticket_count");
    expect(compact).toContain("'demo_history_entry_count', dem.demo_history_entry_count");
    expect(compact).not.toContain("ve.data_origin in ('real', 'demo-seed'");
  });

  it("không sinh liên tục: chỉ một lịch mỗi tháng, là cửa sổ trượt 60 ngày", () => {
    expect(compact.split("cron.schedule(").length - 1).toBe(1);
    expect(compact).toContain("'erp-lich-su-mau-hang-thang', '0 20 1 * *', $cron$select public.erp_lich_su_mau_lam_moi(60);$cron$");
    expect(compact).toContain("perform public.erp_lich_su_mau_xoa(v_tu);");
    expect(compact).toContain("greatest(v_tu, coalesce(v_cuoi, v_tu))");
  });

  it("xoá mẫu chỉ qua khe riêng, chỉ dòng mang mã mẫu, giữ vé hồ sơ thật đang trỏ vào", () => {
    expect(compact).toContain("perform set_config('nbj.cho_phep_xoa', 'lich-su-mau', true);");
    expect(compact).toContain("perform set_config('nbj.cho_phep_xoa', '', true);");
    expect(compact).toContain("and old.id::text like 'de000000%' then return old;");
    expect(compact).toContain("exists (select 1 from public.erp_visitor_groups g where g.ticket_id = ticket.id)");
    expect(compact).toContain("exists (select 1 from public.erp_visit_reviews r where r.ticket_id = ticket.id)");
    expect(compact).toContain("raise exception using errcode = '55000', message = 'COUNTER_SALE_APPEND_ONLY';");
    expect(compact).toContain(
      "revoke all on function public.erp_lich_su_mau_xoa(timestamptz) from public, anon, authenticated, service_role;",
    );
    expect(compact).toContain(
      "revoke all on function public.erp_lich_su_mau_lam_moi(integer) from public, anon, authenticated, service_role;",
    );
  });
});
