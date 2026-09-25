import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BAN_DO_CHUC_NANG, duongDanChucNang, laDuongDanErpAnToan } from "@/domain/ban-do-chuc-nang";
import { ERP_MODULES } from "@/domain/erp";

describe("bản đồ mọi chức năng", () => {
  const tatCa = BAN_DO_CHUC_NANG.flatMap((nhom) => nhom.chucNang);

  it("mỗi việc trỏ tới một màn hình có thật", () => {
    const moduleIds = new Set(ERP_MODULES.map((m) => m.id));
    for (const cn of tatCa) {
      const duongDan = duongDanChucNang(cn);
      expect(laDuongDanErpAnToan(duongDan), duongDan).toBe(true);
      const phan = duongDan.split("/").filter(Boolean);
      if (phan.length === 3) {
        expect(moduleIds.has(phan[2] as never), `${cn.id}: module ${phan[2]}`).toBe(true);
      } else {
        expect(existsSync(`app/erp/${phan[1]}/page.tsx`), `${cn.id}: ${duongDan}`).toBe(true);
      }
    }
  });

  it("không trùng mã việc", () => {
    const ids = tatCa.map((cn) => cn.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("lệnh chuyển vai chỉ nhận đường dẫn nội bộ ERP", () => {
    expect(laDuongDanErpAnToan("/erp")).toBe(true);
    expect(laDuongDanErpAnToan("/erp/trang-an/check-in-khach")).toBe(true);
    for (const xau of ["https://evil.example", "//evil.example", "/erp/../admin", "/erp?x=1", "/checkout", "/erp/a/b/c/d", ""]) {
      expect(laDuongDanErpAnToan(xau), xau).toBe(false);
    }
  });
});
