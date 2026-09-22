import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Tệp `"use server"` chỉ được xuất ra hàm bất đồng bộ.
 *
 * ## Vì sao phải có bài này
 *
 * Xuất thêm một hằng số từ một tệp `"use server"` thì Next.js ném
 * `A "use server" file can only export async functions` — nhưng **chỉ ném lúc
 * chạy, đúng lượt người dùng bấm nút**, không ném lúc dựng. Nghĩa là:
 * `npm run build` sạch, lint sạch, typecheck sạch, bài Playwright trên máy cục
 * bộ xanh (vì máy cục bộ không có kho nên không ai bấm lưu được), rồi lên
 * production bấm lưu một cái là màn hình đổ vào trang "dữ liệu chưa thể đồng
 * bộ". Đã trả giá đúng một lần ngày 22/09/2026 với `app/erp/doi-tac-actions.ts`.
 *
 * Không có hàng rào nào khác bắt được chuyện này, nên nó phải nằm ở đây.
 *
 * ## Cách soát
 *
 * Đọc chữ, không chạy mã: tìm mọi tệp mở đầu bằng `"use server"`, rồi bắt mọi
 * dòng `export` không phải hàm `async` và không phải khai báo kiểu. Kiểu chữ
 * (`type`, `interface`) thì không sao — nó bị xoá hẳn khi biên dịch.
 */

const THU_MUC = ["app", "components", "lib", "domain"];

function quet(goc: string): string[] {
  const ra: string[] = [];
  for (const ten of readdirSync(goc)) {
    const duongDan = join(goc, ten);
    if (statSync(duongDan).isDirectory()) {
      ra.push(...quet(duongDan));
      continue;
    }
    if (ten.endsWith(".ts") || ten.endsWith(".tsx")) ra.push(duongDan);
  }
  return ra;
}

/** Tệp có phải module lệnh máy chủ không — `"use server"` phải ở ngay đầu tệp. */
function laTepLenhMayChu(noiDung: string) {
  const dongDau = noiDung
    .split(/\r?\n/)
    .map((d) => d.trim())
    .find((d) => d.length > 0 && !d.startsWith("//") && !d.startsWith("/*") && !d.startsWith("*"));
  return dongDau === '"use server";' || dongDau === "'use server';";
}

/**
 * Những dòng `export` được phép:
 * - `export async function …`
 * - `export type …` / `export interface …`
 * - `export { type A, type B } …` — chỉ gồm kiểu
 */
function dongExportPhamLuat(dong: string) {
  const d = dong.trim();
  if (!d.startsWith("export")) return false;
  if (d.startsWith("export async function")) return false;
  if (d.startsWith("export type") || d.startsWith("export interface")) return false;
  // `export { type A, type B };` — mọi thứ trong ngoặc đều là kiểu.
  const trongNgoac = d.match(/^export\s*\{([^}]*)\}/);
  if (trongNgoac) {
    return trongNgoac[1]
      .split(",")
      .map((phan) => phan.trim())
      .filter(Boolean)
      .some((phan) => !phan.startsWith("type "));
  }
  return true;
}

describe('Tệp "use server" chỉ xuất ra hàm bất đồng bộ', () => {
  const tepLenh = THU_MUC.flatMap((d) => quet(d)).filter((t) =>
    laTepLenhMayChu(readFileSync(t, "utf8")),
  );

  it("tìm thấy các tệp lệnh máy chủ để soát", () => {
    // Nếu con số này về 0 thì phép soát đã hỏng chứ không phải dự án hết tệp.
    expect(tepLenh.length).toBeGreaterThan(5);
  });

  it("không tệp nào xuất ra hằng số, đối tượng hay hàm đồng bộ", () => {
    const pham: string[] = [];
    for (const tep of tepLenh) {
      const dong = readFileSync(tep, "utf8").split(/\r?\n/);
      dong.forEach((d, i) => {
        if (dongExportPhamLuat(d)) pham.push(`${tep}:${i + 1} → ${d.trim()}`);
      });
    }
    expect(pham, `xuất sai khỏi tệp "use server":\n${pham.join("\n")}`).toEqual([]);
  });
});
