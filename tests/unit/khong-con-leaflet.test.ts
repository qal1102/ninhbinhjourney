import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Hàng rào chặn đường lui: Leaflet và ảnh nền OpenStreetMap không được quay lại.
 *
 * Máy chủ ảnh nền miễn phí của OpenStreetMap **cấm dùng cho mục đích thương
 * mại** và bóp lưu lượng khi bị gọi nhiều — đó mới là nguyên nhân thật của
 * chuyện "bản đồ liên tục bị lỗi", chứ không phải mã sai. Cả dự án nay chạy
 * MapLibre trên dữ liệu vector của OpenFreeMap.
 *
 * Bài này quét mã nguồn chứ không quét trình duyệt, vì lỗi kiểu này lọt vào
 * bằng một dòng `import` trong một tệp không ai mở tới, và chỉ lộ ra khi khách
 * mở web.
 */

const THU_MUC = ["app", "components", "domain", "lib", "content", "config"];
const DUOI = [".ts", ".tsx", ".css"];

function quet(goc: string): string[] {
  const ra: string[] = [];
  for (const ten of readdirSync(goc)) {
    const duongDan = join(goc, ten);
    if (statSync(duongDan).isDirectory()) {
      ra.push(...quet(duongDan));
      continue;
    }
    if (DUOI.some((d) => ten.endsWith(d))) ra.push(duongDan);
  }
  return ra;
}

describe("Leaflet đã gỡ hẳn, không có đường quay lại", () => {
  const tep = THU_MUC.flatMap((d) => quet(d));

  /**
   * Chỉ bắt **mã** gọi Leaflet, không bắt chữ "Leaflet" trong chú thích: mấy
   * đoạn giải thích *vì sao* đã bỏ Leaflet là thứ đáng giữ nhất còn lại của
   * lần đổi này, xoá đi là vài tháng nữa có người lại cắm nó vào.
   */
  const DAU_VET_MA = [
    'from "leaflet"',
    "from 'leaflet'",
    'from "react-leaflet"',
    "from 'react-leaflet'",
    "leaflet/dist",
    ".leaflet-",
  ];

  it("không tệp nguồn nào còn nhập hay tô kiểu cho Leaflet", () => {
    const pham = tep.filter((t) => {
      const noi = readFileSync(t, "utf8");
      return DAU_VET_MA.some((d) => noi.includes(d));
    });
    expect(pham, `còn mã Leaflet: ${pham.join(", ")}`).toEqual([]);
  });

  it("không tệp nguồn nào gọi máy chủ ảnh nền cấm dùng thương mại", () => {
    const pham = tep.filter((t) => readFileSync(t, "utf8").includes("tile.openstreetmap.org"));
    expect(pham, `còn gọi ảnh nền OpenStreetMap: ${pham.join(", ")}`).toEqual([]);
  });

  it("package.json không còn ba gói Leaflet", () => {
    const goi = JSON.parse(readFileSync("package.json", "utf8")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const tatCa = { ...goi.dependencies, ...goi.devDependencies };
    for (const ten of ["leaflet", "react-leaflet", "@types/leaflet"]) {
      expect(tatCa[ten], `gói ${ten} đã quay lại package.json`).toBeUndefined();
    }
  });

  it("vẫn còn ghi nguồn dữ liệu bản đồ — đây là điều kiện bắt buộc để được dùng", () => {
    const kieu = readFileSync("lib/map/brand-style.ts", "utf8");
    expect(kieu).toContain("openfreemap.org");
    expect(kieu).toContain("openmaptiles.org");
    expect(kieu).toContain("openstreetmap.org/copyright");
  });
});
