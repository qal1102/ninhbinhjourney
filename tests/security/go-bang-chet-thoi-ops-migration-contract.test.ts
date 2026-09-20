import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Hợp đồng của `202609200078_go_bang_chet_thoi_ops.sql` — migration DUY NHẤT
 * trong repo này gỡ bảng.
 *
 * Bài đọc chuỗi SQL, không chứng minh gì về PostgreSQL thật. Nó canh đúng ba
 * chỗ mà một lần sửa vội có thể biến việc dọn dẹp thành mất dữ liệu:
 *
 *   1. Danh sách gỡ không được phình ra ngoài 16 bảng đã soát.
 *   2. Không có `cascade`: phụ thuộc bất ngờ phải làm migration gãy ra tiếng.
 *   3. Chốt "bảng phải rỗng" còn nguyên.
 *
 * Bài cũng quét lại mã nguồn: nếu sau này có ai viết mã đọc một bảng đã gỡ,
 * bài đỏ ngay tại đây chứ không đợi lỗi runtime trên production.
 */

const TEP = "supabase/migrations/202609200078_go_bang_chet_thoi_ops.sql";

/** 16 bảng đã soát ngày 20/09/2026: 0 hàng, không mã, không hàm, không policy, không trigger. */
const BANG_DUOC_GO = [
  "erp_attendance_events",
  "erp_camera_events",
  "erp_camera_sources",
  "erp_decision_items",
  "erp_field_reports",
  "erp_finance_ledger_entries",
  "erp_operational_signals",
  "erp_partner_documents",
  "erp_partner_feedback",
  "erp_partner_quotes",
  "erp_partners",
  "erp_project_work_items",
  "erp_projects",
  "erp_push_subscriptions",
  "erp_ticket_scans",
  "erp_ticket_shift_closures",
] as const;

/** Bảng đang mang dữ liệu thật, hoặc cố ý giữ lại — không được nằm trong câu `drop` nào. */
const BANG_KHONG_DUOC_CHAM = [
  "erp_field_operation_reports",
  "erp_staff_attendance_events",
  "erp_gate_scan_events",
  "erp_project_events",
  "erp_project_action_items",
  "erp_ap_suppliers",
  "erp_shift_close_workflows",
  "erp_accounting_journals",
  "erp_accounting_journal_lines",
  "erp_site_assignments",
  "user_profiles",
  "tenant_memberships",
  "bookings",
  "passes",
  "quotes",
  "incidents",
] as const;

const sql = readFileSync(TEP, "utf8");
const khongChuThich = sql
  .split("\n")
  .map((dong) => {
    const viTri = dong.indexOf("--");
    return viTri === -1 ? dong : dong.slice(0, viTri);
  })
  .join("\n");

const cauDrop = [...khongChuThich.matchAll(/drop\s+table\s+if\s+exists\s+public\.([a-z_]+)/gi)].map(
  (m) => m[1].toLowerCase(),
);

describe("migration dọn bảng chết thời /ops", () => {
  it("gỡ đúng 16 bảng đã soát, không thừa một cái nào", () => {
    expect([...cauDrop].sort()).toEqual([...BANG_DUOC_GO].sort());
  });

  it("không chạm bảng đang có dữ liệu thật hay bảng cố ý giữ lại", () => {
    for (const ten of BANG_KHONG_DUOC_CHAM) {
      expect(cauDrop).not.toContain(ten);
    }
  });

  it("không dùng cascade — phụ thuộc bất ngờ phải làm migration gãy", () => {
    expect(khongChuThich.toLowerCase()).not.toContain("cascade");
  });

  it("gỡ bảng con trước bảng cha", () => {
    const thuTu = (ten: string) => cauDrop.indexOf(ten);
    expect(thuTu("erp_field_reports")).toBeLessThan(thuTu("erp_project_work_items"));
    expect(thuTu("erp_project_work_items")).toBeLessThan(thuTu("erp_projects"));
    expect(thuTu("erp_partner_documents")).toBeLessThan(thuTu("erp_partners"));
    expect(thuTu("erp_partner_feedback")).toBeLessThan(thuTu("erp_partners"));
    expect(thuTu("erp_partner_quotes")).toBeLessThan(thuTu("erp_partners"));
    expect(thuTu("erp_camera_events")).toBeLessThan(thuTu("erp_camera_sources"));
    expect(thuTu("erp_decision_items")).toBeLessThan(thuTu("erp_operational_signals"));
  });

  it("giữ chốt an toàn: còn một hàng dữ liệu thì dừng cả migration", () => {
    expect(khongChuThich).toContain("BANG_CON_DU_LIEU");
    expect(khongChuThich.toLowerCase()).toContain("raise exception");
    for (const ten of BANG_DUOC_GO) {
      expect(khongChuThich).toContain(`'${ten}'`);
    }
  });

  it("nằm trong một transaction", () => {
    expect(khongChuThich.trimStart().toLowerCase().startsWith("begin;")).toBe(true);
    expect(khongChuThich.trimEnd().toLowerCase().endsWith("commit;")).toBe(true);
  });
});

describe("không mã nguồn nào còn đọc bảng đã gỡ", () => {
  const THU_MUC = ["app", "components", "domain", "lib", "content", "config", "scripts"];
  const DUOI_TEP = new Set([".ts", ".tsx", ".js", ".mjs"]);

  function docHet(thuMuc: string, ra: { tep: string; chu: string }[]) {
    for (const ten of readdirSync(thuMuc)) {
      const day = path.join(thuMuc, ten);
      if (statSync(day).isDirectory()) docHet(day, ra);
      else if (DUOI_TEP.has(path.extname(ten))) ra.push({ tep: day, chu: readFileSync(day, "utf8") });
    }
  }

  const tepMa: { tep: string; chu: string }[] = [];
  for (const thuMuc of THU_MUC) docHet(thuMuc, tepMa);

  it.each(BANG_DUOC_GO)("không tệp nào nhắc %s", (ten) => {
    const dinh = tepMa.filter(({ chu }) => new RegExp(`\\b${ten}\\b`).test(chu)).map(({ tep }) => tep);
    expect(dinh).toEqual([]);
  });
});
