import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Migration 102: tiền chi hoa hồng đại lý vào sổ kế toán, và kỳ kế toán tự mở
 * tới tháng hiện tại. Bài này canh những luật không được lỏng ra về sau:
 * người lập khác người kiểm tra, chỉ vai kế toán trưởng được duyệt, bút toán
 * không sửa tay được, và không vai nào ngoài service role gọi được các hàm.
 */

const sql = readFileSync(
  fileURLToPath(new URL("../../supabase/migrations/202610030102_ky_ke_toan_va_hoa_hong_vao_so.sql", import.meta.url)),
  "utf8",
).replace(/\r\n/g, "\n");

function ham(ten: string) {
  const dau = sql.indexOf(`create or replace function public.${ten}(`);
  const cuoi = sql.indexOf("\n$ham$;", dau);
  if (dau < 0 || cuoi < 0) throw new Error(`Không thấy hàm ${ten}`);
  return sql.slice(dau, cuoi).replace(/\s+/g, " ");
}

describe("migration 102: hoa hồng đại lý vào sổ", () => {
  it("chạy trọn trong một giao dịch", () => {
    expect(sql).toMatch(/\nbegin;\n/);
    expect(sql.trimEnd().endsWith("commit;")).toBe(true);
  });

  it("kế toán trưởng duyệt, và không bao giờ là người đã lập", () => {
    const duyet = ham("erp_dai_ly_duyet_but_toan");
    expect(duyet).toContain("erp_account_has_active_role(p_tenant_id, v_actor, 'accounting-checker', v_journal.site_id)");
    expect(duyet).toContain("if v_actor = v_journal.maker_account_id then");
    expect(duyet).toContain("ACCOUNTING_MAKER_CHECKER_SEPARATION_REQUIRED");
    expect(duyet).toContain("v_journal.version <> p_expected_version");
    expect(duyet).toContain("v_journal.source_type <> 'agent-commission'");
  });

  it("bút toán hoa hồng chỉ đổi được qua luồng đại lý", () => {
    expect(sql).toContain("old.source_type = 'agent-commission'");
    expect(sql).toContain("DAI_LY_BUT_TOAN_PHAI_QUA_LUONG_DAI_LY");
    expect(sql).toContain("or new.source_dai_ly_chi_tra_id is distinct from old.source_dai_ly_chi_tra_id");
  });

  it("định khoản Nợ 6418 / Có 1121 và kiểm cân trước khi gửi", () => {
    const lap = ham("dai_ly_lap_but_toan");
    expect(lap).toContain("'6418', 'Chi phí bán hàng – hoa hồng đại lý', v_dong.so_tien, 0::bigint");
    expect(lap).toContain("'1121', 'Tiền gửi ngân hàng', 0::bigint, v_dong.so_tien");
    expect(lap).toContain("erp_accounting_journal_is_balanced(v_journal.id)");
    // Tổng các bút toán theo cơ sở phải đúng bằng số hoa hồng kho tính.
    expect(lap).toContain("so_tien = so_tien + (v_chi.so_tien - v_tong_chia)");
  });

  it("kỳ kế toán chỉ mở tới tháng hiện tại, không mở kỳ tương lai", () => {
    const moKy = ham("erp_accounting_mo_ky_den_nay");
    expect(moKy).toContain("date_trunc('month', (now() at time zone 'Asia/Ho_Chi_Minh'))::date");
    expect(moKy).toContain("on conflict (tenant_id, period_key) do nothing");
  });

  it("không vai nào ngoài service role gọi được hàm mới", () => {
    for (const ten of [
      "erp_accounting_mo_ky_den_nay(uuid)",
      "dai_ly_tien_don_theo_co_so(uuid, uuid, date)",
      "dai_ly_lap_but_toan(uuid)",
      "erp_dai_ly_duyet_but_toan(uuid, uuid, integer, text, text, text, text)",
    ]) {
      const revoke = sql.replace(/\s+/g, " ").includes(`revoke all on function public.${ten} from public, anon, authenticated;`);
      expect(revoke, ten).toBe(true);
    }
  });
});
