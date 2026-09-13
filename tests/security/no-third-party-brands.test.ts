import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/*
 * BRAND-LEGAL-01 · 13/09/2026.
 *
 * Khối Trung thu từng có mười một chương mang tên và **ảnh in thẳng logo** của
 * các thương hiệu thời trang, trang sức, đồng hồ (Rolex, Chanel, Hermès…), đặt
 * sát khối "Hợp tác" trên một trang có bán vé. Dự án không có hợp đồng với
 * thương hiệu nào trong số đó. Chủ dự án giao quyết định; đã gỡ cả chữ lẫn ảnh.
 *
 * Bài này canh ở tầng mã nguồn: không tên thương hiệu nào nằm trong mã hiện
 * ra cho khách, và không tệp ảnh công khai nào mang tên ấy. Bài giao diện
 * trong `public-surfaces.spec.ts` canh thêm HTML thật của trang chủ.
 *
 * Muốn đưa một thương hiệu trở lại thì phải có hợp đồng trước — và khi ấy sửa
 * danh sách dưới đây kèm số hợp đồng, đừng tắt bài.
 */

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const THUONG_HIEU =
  /celine|chanel|prada|bottega|herm[eè]s|bvlgari|bulgari|cartier|\bdior\b|gucci|rolex|vacheron|louis vuitton/i;

function gom(thuMuc: string, loc: RegExp): string[] {
  const ra: string[] = [];
  const di = (d: string) => {
    for (const muc of readdirSync(d, { withFileTypes: true })) {
      if (muc.name === "node_modules" || muc.name === ".next") continue;
      const p = path.join(d, muc.name);
      if (muc.isDirectory()) di(p);
      else if (loc.test(muc.name)) ra.push(p);
    }
  };
  di(path.join(REPO_ROOT, thuMuc));
  return ra;
}

describe("trang công khai không mang tên hay ảnh thương hiệu bên thứ ba", () => {
  it("mã giao diện và nội dung không nhắc tên thương hiệu nào", () => {
    const tep = [
      ...gom("app", /\.(ts|tsx|css)$/),
      ...gom("components", /\.(ts|tsx)$/),
      ...gom("content", /\.(ts|tsx|json)$/),
    ];
    expect(tep.length).toBeGreaterThan(50);
    const dinh = tep.flatMap((p) => {
      const trung = readFileSync(p, "utf8").match(THUONG_HIEU);
      return trung ? [`${path.relative(REPO_ROOT, p)}: ${trung[0]}`] : [];
    });
    expect(dinh).toEqual([]);
  });

  it("không tệp nào trong thư mục web công khai mang tên thương hiệu", () => {
    const tep = gom("public", /./);
    expect(tep.length).toBeGreaterThan(20);
    const dinh = tep
      .map((p) => path.relative(REPO_ROOT, p).replace(/\\/g, "/"))
      .filter((p) => THUONG_HIEU.test(p));
    expect(dinh).toEqual([]);
  });
});
