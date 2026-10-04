import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Migration 107 xoá bảng trên production. Bài này canh cho nó chỉ xoá đúng
 * thứ chủ dự án đã cho phép (04/10/2026), không lan sang bảng khác.
 */
const sql = readFileSync("supabase/migrations/202610040107_go_bang_khong_dung.sql", "utf8").toLowerCase();
const lenh = sql.replace(/--.*$/gm, "");

describe("migration 107: gỡ hai bảng không còn mã dùng", () => {
  it("chỉ xoá đúng ba bảng và bốn hàm đã kiểm", () => {
    const bang = [...lenh.matchAll(/drop table if exists public\.([a-z_]+)/g)].map((m) => m[1]).sort();
    expect(bang).toEqual(["erp_huong_dan_tien_do", "itineraries", "itinerary_items"]);
    const ham = [...lenh.matchAll(/drop function if exists public\.([a-z_]+)\(/g)].map((m) => m[1]).sort();
    expect(ham).toEqual([
      "erp_doc_tien_do_huong_dan",
      "erp_ghi_tien_do_huong_dan",
      "save_generated_journey",
      "update_saved_journey",
    ]);
  });

  it("không dùng cascade, không xoá cột, chạy trong một giao dịch", () => {
    expect(lenh).not.toMatch(/\bcascade\b/);
    expect(lenh).not.toMatch(/drop column/);
    expect(lenh.trim().startsWith("begin;")).toBe(true);
    expect(lenh.trim().endsWith("commit;")).toBe(true);
  });

  it("reset_demo_run còn đủ mọi bước khác, chỉ thôi xoá vào hai bảng lịch trình", () => {
    const than = lenh.slice(lenh.indexOf("create or replace function public.reset_demo_run"));
    expect(than).not.toMatch(/from public\.itinerar/);
    for (const conLai of ["resource_requests", "incidents", "bookings", "quotes", "journey_intents", "audit_events"]) {
      expect(than).toContain(`delete from public.${conLai} where demo_run_id = p_demo_run_id;`);
    }
    expect(than).toContain("security definer");
    expect(than).toContain("set search_path = ''");
  });
});
