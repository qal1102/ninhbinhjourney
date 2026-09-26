import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ERP_MODULES } from "@/domain/erp";

const compact = readFileSync(
  fileURLToPath(new URL("../../supabase/migrations/202609260091_go_module_xe_va_tai_san.sql", import.meta.url)),
  "utf8",
)
  .replace(/\r\n/g, "\n")
  .replace(/\s+/g, " ")
  .trim();

describe("migration 091: gỡ quyền hai module vỏ", () => {
  it("chạy trọn một giao dịch và chỉ chạm hàng đang chứa hai mã ấy", () => {
    expect(compact).toContain("begin;");
    expect(compact.endsWith("commit;")).toBe(true);
    expect(compact).toContain("where access.module_ids && array['xe-trung-chuyen', 'tai-san-bao-tri']::text[];");
    expect(compact).not.toMatch(/\bdelete\b|\bdrop\b|\btruncate\b/i);
  });

  it("chuyển xe trung chuyển sang sức chứa, bỏ tài sản, không nhân đôi", () => {
    expect(compact).toContain("array_replace(access.module_ids, 'xe-trung-chuyen', 'suc-chua')");
    expect(compact).toContain("where module_id <> 'tai-san-bao-tri'");
    expect(compact).toContain("array_agg(distinct module_id");
  });

  it("mã không còn định nghĩa hai module ấy", () => {
    const ids = ERP_MODULES.map((module) => module.id as string);
    expect(ids).not.toContain("xe-trung-chuyen");
    expect(ids).not.toContain("tai-san-bao-tri");
    expect(ids).toContain("suc-chua");
  });
});
