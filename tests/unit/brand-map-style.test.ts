import { describe, expect, it } from "vitest";

import {
  GHI_CONG_BAN_DO,
  kieuBanDoThuongHieu,
  NGUON_BAN_DO,
} from "@/lib/map/brand-style";

/**
 * Bảng vẽ bản đồ là dữ liệu thuần, nên kiểm được mà không cần trình duyệt.
 *
 * Mấy bài dưới đây canh những chỗ **hỏng im lặng**: sai tên lớp nguồn hay sai
 * tên bộ chữ thì MapLibre không báo lỗi, nó chỉ lặng lẽ không vẽ lớp ấy — và
 * mình chỉ biết khi nhìn thấy một tấm bản đồ thiếu mất sông.
 */

/** Tên lớp có thật trong lược đồ OpenMapTiles mà OpenFreeMap phát. */
const LOP_NGUON_CO_THAT = new Set([
  "aerodrome_label",
  "aeroway",
  "boundary",
  "building",
  "housenumber",
  "landcover",
  "landuse",
  "mountain_peak",
  "park",
  "place",
  "poi",
  "transportation",
  "transportation_name",
  "water",
  "water_name",
  "waterway",
]);

/** Ba bộ chữ OpenFreeMap có phát; xin bộ khác là chữ biến mất sạch. */
const BO_CHU_CO_THAT = new Set(["Noto Sans Regular", "Noto Sans Bold", "Noto Sans Italic"]);

const MAU_HOP_LE = /^(#[0-9a-fA-F]{6}|rgba?\([\d.,\s]+\))$/;

describe("Bảng vẽ bản đồ thương hiệu", () => {
  it("lấy nguồn qua TileJSON, không chép cứng đường dẫn có ngày tháng", () => {
    // OpenFreeMap dựng lại dữ liệu theo đợt; chép cứng
    // `…/planet/20260913_164504_pt/…` là vài tuần nữa bản đồ đứng hình mà
    // không ai hiểu vì sao.
    expect(NGUON_BAN_DO).toBe("https://tiles.openfreemap.org/planet");
    const kieu = kieuBanDoThuongHieu();
    const nguon = kieu.sources.ofm as { url?: string; tiles?: string[] };
    expect(nguon.url).toBe(NGUON_BAN_DO);
    expect(nguon.tiles).toBeUndefined();
    expect(JSON.stringify(kieu)).not.toMatch(/planet\/\d{8}_/);
  });

  it("ghi nguồn đủ cả ba bên — đây là điều kiện bắt buộc để được dùng", () => {
    for (const ten of ["OpenFreeMap", "OpenMapTiles", "OpenStreetMap"]) {
      expect(GHI_CONG_BAN_DO).toContain(ten);
    }
    const nguon = kieuBanDoThuongHieu().sources.ofm as { attribution?: string };
    expect(nguon.attribution).toBe(GHI_CONG_BAN_DO);
  });

  it("mọi lớp đều trỏ vào một lớp nguồn có thật", () => {
    for (const lop of kieuBanDoThuongHieu().layers) {
      if (lop.type === "background") continue;
      const ten = (lop as { "source-layer"?: string })["source-layer"];
      expect(ten, `lớp ${lop.id} thiếu source-layer`).toBeTruthy();
      expect(LOP_NGUON_CO_THAT.has(ten!), `lớp ${lop.id} trỏ vào "${ten}"`).toBe(true);
    }
  });

  it("chỉ xin những bộ chữ OpenFreeMap có phát", () => {
    for (const lop of kieuBanDoThuongHieu().layers) {
      const font = (lop as { layout?: { "text-font"?: string[] } }).layout?.["text-font"];
      if (!font) continue;
      for (const ten of font) {
        expect(BO_CHU_CO_THAT.has(ten), `lớp ${lop.id} xin bộ chữ "${ten}"`).toBe(true);
      }
    }
  });

  it("chữ trên bản đồ cũng theo sàn 12px của dự án", () => {
    for (const lop of kieuBanDoThuongHieu().layers) {
      const co = (lop as { layout?: { "text-size"?: unknown } }).layout?.["text-size"];
      if (!Array.isArray(co)) continue;
      // Dạng ["interpolate", ["linear"], ["zoom"], z1, size1, z2, size2, …]
      const soDo = co.slice(3).filter((_, i) => i % 2 === 1) as number[];
      for (const s of soDo) {
        expect(s, `lớp ${lop.id} có cỡ chữ ${s}px`).toBeGreaterThanOrEqual(12);
      }
    }
  });

  it("mọi màu đều là màu đọc được, không lọt chuỗi hỏng", () => {
    // Một mã hex bảy ký tự (#1635349) từng lọt vào đây. MapLibre bỏ qua màu
    // sai mà không kêu một tiếng, nên lớp ấy vẽ ra màu đen mặc định.
    for (const tone of ["giay", "dem"] as const) {
      const kieu = kieuBanDoThuongHieu(tone);
      const mau = JSON.stringify(kieu).match(/#[0-9a-fA-F]+/g) ?? [];
      for (const m of mau) {
        expect(MAU_HOP_LE.test(m), `${tone}: màu "${m}"`).toBe(true);
      }
    }
  });

  it("hai tông cho ra hai bảng màu khác hẳn nhau", () => {
    const giay = kieuBanDoThuongHieu("giay");
    const dem = kieuBanDoThuongHieu("dem");
    const nen = (k: typeof giay) =>
      (k.layers[0] as { paint?: Record<string, string> }).paint?.["background-color"];
    expect(nen(giay)).not.toBe(nen(dem));
  });

  it("mỗi lần gọi trả về một đối tượng riêng", () => {
    // MapLibre sửa thẳng vào đối tượng kiểu lúc chạy. Dùng chung một hằng số
    // giữa hai bản đồ là hai bản đồ giẫm lên nhau.
    const a = kieuBanDoThuongHieu();
    const b = kieuBanDoThuongHieu();
    expect(a).not.toBe(b);
    expect(a.layers).not.toBe(b.layers);
  });

  it("nước vẽ trước đường, và nhà vẽ sau cùng trong nhóm hình khối", () => {
    // Thứ tự lớp CHÍNH LÀ thứ tự vẽ. Đảo chỗ là sông biến mất dưới mặt đường.
    const ten = kieuBanDoThuongHieu().layers.map((l) => l.id);
    expect(ten.indexOf("nuoc")).toBeLessThan(ten.indexOf("duong-chinh"));
    expect(ten.indexOf("song")).toBeLessThan(ten.indexOf("duong-chinh"));
    expect(ten.indexOf("khoi-nha")).toBeGreaterThan(ten.indexOf("duong-chinh"));
    // Chữ luôn nằm trên cùng.
    expect(ten.indexOf("ten-noi")).toBe(ten.length - 1);
  });
});
