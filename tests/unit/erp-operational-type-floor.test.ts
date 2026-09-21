import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { ERP_MODULES, ERP_OPERATIONAL_MODULE_IDS, isOperationalModule } from "@/domain/erp";

/**
 * A15-LOI-03 — sàn chữ 14px cho màn vận hành.
 *
 * Sàn này sống bằng một luật CSS có phạm vi (`[data-thang-chu="van-hanh"]`)
 * cộng với một danh sách module. Hai thứ ở hai tệp khác nhau, nên rất dễ tới
 * ngày một trong hai bị dọn đi mà không ai thấy — lúc đó sàn thủng lặng lẽ,
 * và chỉ người đứng ở cổng dưới nắng mới biết.
 */

const css = readFileSync("app/globals.css", "utf8");
const trang = readFileSync("app/erp/[site]/[module]/page.tsx", "utf8");

describe("A15-LOI-03: sàn chữ 14px ở màn vận hành", () => {
  it("mọi module trong danh sách đều là module có thật", () => {
    for (const id of ERP_OPERATIONAL_MODULE_IDS) {
      expect(ERP_MODULES.some((module) => module.id === id)).toBe(true);
    }
  });

  it("nhận đúng màn vận hành, và không nhận nhầm màn ngồi bàn", () => {
    expect(isOperationalModule("check-in-khach")).toBe(true);
    expect(isOperationalModule("bao-cao-hien-truong")).toBe(true);
    // Thêm 21/09: chấm vào ca và bàn giao ca cũng làm khi đang đứng.
    // Đo trước/sau ở khổ 390px: 9 + 82 chỗ chữ dưới 14px về 0, số chỗ chữ bị
    // cắt giữ nguyên 7 (đã có từ trước), không màn nào tràn ngang.
    expect(isOperationalModule("cham-cong")).toBe(true);
    expect(isOperationalModule("nhan-su")).toBe(true);
    // Kế toán và báo cáo ngồi trước màn hình lớn, cần thấy nhiều dòng một lúc.
    // Nới chữ ở đó là làm vỡ bảng nhiều cột, không phải giúp ai.
    expect(isOperationalModule("tai-chinh-doi-soat")).toBe(false);
    expect(isOperationalModule("bao-cao")).toBe(false);
    expect(isOperationalModule("khong-co-module-nay")).toBe(false);
  });

  it("luật CSS vẫn còn, và vẫn nâng lên đúng 14px", () => {
    const khoi = css.slice(css.indexOf('[data-thang-chu="van-hanh"]'));
    expect(khoi).toContain('[data-thang-chu="van-hanh"] .text-xs');
    expect(khoi).toContain("font-size: 0.875rem");
  });

  it("trang module vẫn gắn nhãn, và chỉ gắn khi đúng là màn vận hành", () => {
    expect(trang).toContain('data-thang-chu={isOperationalModule(moduleDefinition.id) ? "van-hanh" : undefined}');
  });
});
