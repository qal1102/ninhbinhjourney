import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 13/10/2026: sửa tệp bằng lệnh shell làm rơi dấu `\` trong biểu thức chính quy
 * (`/^0d{9,10}$/` thay vì `/^0\d{9,10}$/`). Kiểu lỗi này qua được tsc, lint và
 * build, chỉ lộ khi người thật gõ: tra vé bằng số điện thoại không chạy, ô ngày
 * hợp đồng người chèo báo sai mọi ngày. Bài này quét mã nguồn tìm `d{`, `s+`,
 * `s*`, `w+`, `[s` đứng trong một biểu thức chính quy mà thiếu `\` phía trước.
 */
const GOC = ["app", "components", "domain", "lib"];
const NGHI = /\/(?:[^/\n]*?[^\\a-zA-Z_])?(?:d\{\d|d\+|s\+|s\*|w\+|\[s[.\-+–])[^/\n]*\/[gimsuy]*[.;,)\s]/;

function tep(thuMuc: string): string[] {
  return readdirSync(thuMuc).flatMap((ten) => {
    const duong = join(thuMuc, ten);
    if (statSync(duong).isDirectory()) return tep(duong);
    return /\.(ts|tsx)$/.test(ten) ? [duong] : [];
  });
}

describe("biểu thức chính quy không mất dấu gạch chéo ngược", () => {
  it("không còn `d{`, `s+`, `[s` thiếu `\\` trong mã nguồn", () => {
    const loi: string[] = [];
    for (const duong of GOC.flatMap(tep)) {
      readFileSync(duong, "utf8")
        .split("\n")
        .forEach((dong, i) => {
          if (NGHI.test(dong) && !dong.trimStart().startsWith("//") && !dong.trimStart().startsWith("*")) loi.push(`${duong}:${i + 1}: ${dong.trim()}`);
        });
    }
    expect(loi).toEqual([]);
  });

  it("mẫu bắt được đúng kiểu lỗi đã gặp", () => {
    expect(NGHI.test('if (/^0d{9,10}$/.test(chiSo)) {')).toBe(true);
    expect(NGHI.test('go.replace(/[s.+-]/g, "")')).toBe(true);
    expect(NGHI.test('if (/^0\\d{9,10}$/.test(chiSo)) {')).toBe(false);
  });
});
