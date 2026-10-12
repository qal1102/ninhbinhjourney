import { describe, expect, it } from "vitest";
import { batCucPhieu, taoPdfTuAnhJpeg } from "@/lib/erp/pdf-anh";
import { pageCssFor } from "@/lib/erp/receipt-printer";

/*
 * Chủ dự án 12/10/2026: "in vé phải fit vừa tờ giấy, xuất PDF cũng không
 * được". Bài này canh hai thứ: tệp PDF tự dựng có cấu trúc đọc được (bảng
 * xref trỏ đúng byte từng đối tượng), và phiếu luôn nằm gọn trong một trang
 * của khổ đã chọn.
 */

const JPEG_GIA = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4, 0xff, 0xd9]);

function docChu(bytes: Uint8Array) {
  return new TextDecoder("latin1").decode(bytes);
}

describe("tệp PDF một ảnh", () => {
  const pdf = taoPdfTuAnhJpeg({
    jpeg: JPEG_GIA,
    rongPx: 1152,
    caoPx: 2000,
    trang: { rongMm: 80, caoMm: 140 },
    anh: { xMm: 4, yMm: 4, rongMm: 72, caoMm: 125 },
  });
  const chu = docChu(pdf);

  it("mở và đóng đúng chuẩn, ảnh nhúng nguyên văn bằng DCTDecode", () => {
    expect(chu.startsWith("%PDF-1.4\n")).toBe(true);
    expect(chu.trimEnd().endsWith("%%EOF")).toBe(true);
    expect(chu).toContain("/Filter /DCTDecode /Length 10");
    expect(chu).toContain("/Width 1152 /Height 2000");
    expect(chu).toContain(docChu(JPEG_GIA));
  });

  it("khổ trang tính bằng point (80mm × 140mm)", () => {
    expect(chu).toContain("/MediaBox [0 0 226.77 396.85]");
  });

  it("bảng xref trỏ đúng byte đầu của từng đối tượng", () => {
    const startxref = Number(/startxref\n(\d+)\n/.exec(chu)?.[1]);
    expect(chu.slice(startxref, startxref + 4)).toBe("xref");
    const dong = chu.slice(startxref).split("\n").slice(3, 8);
    dong.forEach((d, i) => {
      const viTri = Number(d.slice(0, 10));
      expect(chu.slice(viTri, viTri + 7)).toBe(`${i + 1} 0 obj`);
    });
  });

  it("độ dài luồng vẽ khớp số byte thật", () => {
    const m = /5 0 obj\n<< \/Length (\d+) >>\nstream\n([\s\S]*?)endstream/.exec(chu);
    expect(m).not.toBeNull();
    expect(Number(m![1])).toBe(m![2].length);
  });

  it("từ chối dữ liệu không phải JPEG", () => {
    expect(() =>
      taoPdfTuAnhJpeg({
        jpeg: Uint8Array.from([0x89, 0x50, 0x4e, 0x47]),
        rongPx: 10,
        caoPx: 10,
        trang: { rongMm: 80, caoMm: 80 },
        anh: { xMm: 0, yMm: 0, rongMm: 80, caoMm: 80 },
      }),
    ).toThrow();
  });
});

describe("đặt phiếu lên khổ giấy", () => {
  it("giấy cuộn 80mm dài đúng bằng phiếu cộng lề", () => {
    const { trang, anh } = batCucPhieu("k80", 1152, 2304);
    expect(trang.rongMm).toBe(80);
    expect(anh.rongMm).toBe(72);
    expect(anh.caoMm).toBe(144);
    expect(trang.caoMm).toBe(152);
  });

  it("A4: phiếu ngắn nằm giữa, rộng 120mm, sát lề trên", () => {
    const { trang, anh } = batCucPhieu("a4", 1152, 1152);
    expect(trang).toEqual({ rongMm: 210, caoMm: 297 });
    expect(anh.rongMm).toBe(120);
    expect(anh.xMm).toBe(45);
    expect(anh.yMm).toBe(16);
  });

  it("A5: phiếu dài quá thì thu nhỏ vừa một trang, không tràn trang hai", () => {
    const { trang, anh } = batCucPhieu("a5", 1152, 6000);
    expect(anh.yMm + anh.caoMm).toBeLessThanOrEqual(trang.caoMm - 10 + 1e-9);
    expect(anh.xMm + anh.rongMm).toBeLessThanOrEqual(trang.rongMm);
    expect(anh.caoMm / anh.rongMm).toBeCloseTo(6000 / 1152, 6);
  });
});

describe("@page khi in qua hộp thoại", () => {
  it("giấy cuộn có chiều dài cụ thể (CSS không nhận `80mm auto`)", () => {
    expect(pageCssFor("k80", 150)).toBe("size: 80mm 158mm; margin: 3mm;");
    expect(pageCssFor("k58", 10)).toBe("size: 58mm 40mm; margin: 2mm;");
    expect(pageCssFor("k80", 150)).not.toContain("auto");
  });

  it("A4, A5 giữ khổ chuẩn", () => {
    expect(pageCssFor("a4", 999)).toContain("A4 portrait");
    expect(pageCssFor("a5", 999)).toContain("A5 portrait");
  });
});
