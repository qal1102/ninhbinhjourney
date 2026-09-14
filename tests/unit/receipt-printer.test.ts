import { afterEach, describe, expect, it, vi } from "vitest";
import {
  PAPER_DOTS,
  PAPER_LABELS,
  PAPER_PAGE_CSS,
  imageDataToEscPos,
  loadPrinterSettings,
  savePrinterSettings,
} from "@/lib/erp/receipt-printer";

/*
 * QA-ERP-POS-05 — in phiếu thu. Máy in thật không có ở đây, nên bài này canh
 * hai thứ đo được: lệnh ảnh ESC/POS đóng gói đúng từng bit, và lựa chọn khổ
 * giấy của từng máy đọc lại được, kể cả khi trình duyệt chặn lưu.
 */

function anhTrang(width: number, height: number) {
  return new Uint8ClampedArray(width * height * 4).fill(255);
}

function toDen(data: Uint8ClampedArray, width: number, x: number, y: number) {
  const i = (y * width + x) * 4;
  data[i] = 0;
  data[i + 1] = 0;
  data[i + 2] = 0;
}

describe("lệnh in ảnh ESC/POS", () => {
  it("mở đầu bằng khởi động máy in, rồi một lệnh GS v 0 đúng bề ngang và chiều cao", () => {
    const data = anhTrang(16, 2);
    const lenh = imageDataToEscPos(data, 16, 2);
    expect(Array.from(lenh.slice(0, 2))).toEqual([0x1b, 0x40]);
    // GS v 0, chế độ thường, 2 byte mỗi dòng, 2 dòng.
    expect(Array.from(lenh.slice(2, 10))).toEqual([0x1d, 0x76, 0x30, 0x00, 2, 0, 2, 0]);
    // Ảnh trắng: không bit nào bật.
    expect(Array.from(lenh.slice(10, 14))).toEqual([0, 0, 0, 0]);
  });

  it("điểm đen bật đúng bit, bit cao nhất là cột trái nhất", () => {
    const data = anhTrang(16, 1);
    toDen(data, 16, 0, 0);
    toDen(data, 16, 9, 0);
    const lenh = imageDataToEscPos(data, 16, 1);
    expect(lenh[10]).toBe(0b1000_0000);
    expect(lenh[11]).toBe(0b0100_0000);
  });

  it("bề ngang lẻ vẫn đủ byte, cột thừa để trắng", () => {
    const data = anhTrang(10, 1);
    toDen(data, 10, 9, 0);
    const lenh = imageDataToEscPos(data, 10, 1);
    expect(lenh[6]).toBe(2);
    expect(lenh[11]).toBe(0b0100_0000);
  });

  it("ảnh cao được chia thành từng dải 256 dòng cho máy in rẻ nhận nổi", () => {
    const width = 8;
    const height = 300;
    const lenh = imageDataToEscPos(anhTrang(width, height), width, height);
    expect(Array.from(lenh.slice(2, 10))).toEqual([0x1d, 0x76, 0x30, 0x00, 1, 0, 0, 1]);
    const dauDaiHai = 10 + 256;
    expect(Array.from(lenh.slice(dauDaiHai, dauDaiHai + 8))).toEqual([0x1d, 0x76, 0x30, 0x00, 1, 0, 44, 0]);
  });

  it("kết thúc bằng đẩy giấy và cắt", () => {
    const lenh = imageDataToEscPos(anhTrang(8, 1), 8, 1);
    expect(Array.from(lenh.slice(-7))).toEqual([0x1b, 0x64, 0x04, 0x1d, 0x56, 0x42, 0x00]);
  });

  it("bề ngang đầu in khớp khổ giấy cuộn phổ biến", () => {
    expect(PAPER_DOTS).toEqual({ k80: 576, k58: 384 });
  });
});

describe("khổ giấy và cách in lưu theo từng máy", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("có đủ A4, A5 và hai khổ cuộn, mỗi khổ một quy tắc @page", () => {
    expect(Object.keys(PAPER_LABELS)).toEqual(["a4", "a5", "k80", "k58"]);
    expect(PAPER_PAGE_CSS.a4).toContain("A4");
    expect(PAPER_PAGE_CSS.a5).toContain("A5");
    expect(PAPER_PAGE_CSS.k80).toContain("80mm");
  });

  it("lưu rồi đọc lại đúng lựa chọn", () => {
    const kho = new Map<string, string>();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => kho.get(key) ?? null,
        setItem: (key: string, value: string) => void kho.set(key, value),
      },
    });
    savePrinterSettings({ paper: "a5", mode: "bluetooth" });
    expect(loadPrinterSettings()).toEqual({ paper: "a5", mode: "bluetooth" });
  });

  it("giá trị hỏng hay trình duyệt chặn lưu thì về mặc định cuộn 80mm, hộp thoại in", () => {
    vi.stubGlobal("window", {
      localStorage: { getItem: () => JSON.stringify({ paper: "a0", mode: "fax" }), setItem: () => undefined },
    });
    expect(loadPrinterSettings()).toEqual({ paper: "k80", mode: "system" });
    // Tên thuộc tính có sẵn của mọi object không được lọt thành một khổ giấy.
    vi.stubGlobal("window", {
      localStorage: { getItem: () => JSON.stringify({ paper: "toString" }), setItem: () => undefined },
    });
    expect(loadPrinterSettings().paper).toBe("k80");
    vi.stubGlobal("window", {
      localStorage: {
        getItem: () => {
          throw new Error("SecurityError");
        },
        setItem: () => {
          throw new Error("SecurityError");
        },
      },
    });
    expect(loadPrinterSettings()).toEqual({ paper: "k80", mode: "system" });
    expect(() => savePrinterSettings({ paper: "a4", mode: "system" })).not.toThrow();
  });
});
