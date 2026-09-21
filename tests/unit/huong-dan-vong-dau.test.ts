import { describe, expect, it } from "vitest";

import {
  changMoLai,
  changTheoThuTu,
  laChangCuoi,
  nenTuMo,
  phanTramDaDi,
  tienDoFrom,
  VONG_TIEN,
} from "@/domain/huong-dan-vong-dau";

describe("Vòng dẫn: hình dạng bảy chặng", () => {
  it("số chặng chạy liền từ 1, không nhảy cóc", () => {
    expect(VONG_TIEN.map((c) => c.thuTu)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("chặng nào cũng nói được 'là gì' và 'số ở đâu ra'", () => {
    for (const chang of VONG_TIEN) {
      expect(chang.laGi.trim().length, `chặng ${chang.thuTu}`).toBeGreaterThan(40);
      expect(chang.soODau.trim().length, `chặng ${chang.thuTu}`).toBeGreaterThan(40);
    }
  });

  it("chặng kết không dẫn đi đâu nữa", () => {
    expect(VONG_TIEN.at(-1)?.moMan).toBeNull();
  });

  it("đường dẫn bám theo cơ sở đang xem", () => {
    const chang1 = changTheoThuTu(1);
    expect(chang1?.moMan?.duong("tam-coc")).toBe("/erp/tam-coc/ve-dat-cho");
  });

  it("chặng không có thật thì trả null", () => {
    expect(changTheoThuTu(99)).toBeNull();
    expect(changTheoThuTu(0)).toBeNull();
  });
});

describe("Vòng dẫn: mở lại đúng chỗ đã dừng", () => {
  it("số chặng hỏng hoặc thiếu thì về chặng một, không vỡ", () => {
    expect(changMoLai(Number.NaN)).toBe(1);
    expect(changMoLai(0)).toBe(1);
    expect(changMoLai(-4)).toBe(1);
  });

  it("số chặng lớn hơn vòng hiện tại thì kẹp về chặng cuối", () => {
    // Kho có thể còn giữ số chặng của một bản vòng dẫn cũ dài hơn.
    expect(changMoLai(40)).toBe(VONG_TIEN.length);
  });

  it("biết đâu là chặng cuối", () => {
    expect(laChangCuoi(6)).toBe(false);
    expect(laChangCuoi(7)).toBe(true);
  });

  it("thanh tiến độ chạy từ một phần bảy tới tròn trăm", () => {
    expect(phanTramDaDi(1)).toBe(14);
    expect(phanTramDaDi(7)).toBe(100);
    expect(phanTramDaDi(99)).toBe(100);
  });
});

describe("Vòng dẫn: đọc tiến độ từ kho", () => {
  it("đọc đúng hình dạng kho trả về", () => {
    expect(
      tienDoFrom({ chang_hien_tai: 3, da_xong: false, bo_qua: false, tung_di: true }),
    ).toEqual({ changHienTai: 3, daXong: false, boQua: false, tungDi: true });
  });

  it("kho im lặng hoặc trả rác thì coi như chưa từng đi", () => {
    expect(tienDoFrom(null)).toEqual({
      changHienTai: 1,
      daXong: false,
      boQua: false,
      tungDi: false,
    });
    expect(tienDoFrom({ chang_hien_tai: "ba" }).changHienTai).toBe(1);
  });

  it("chỉ nhận đúng chữ true, không nhận chuỗi rỗng hay số 1", () => {
    const ra = tienDoFrom({ chang_hien_tai: 2, da_xong: 1, bo_qua: "true", tung_di: "" });
    expect(ra.daXong).toBe(false);
    expect(ra.boQua).toBe(false);
    expect(ra.tungDi).toBe(false);
  });
});

describe("Vòng dẫn: chỉ tự bung ra đúng một lần", () => {
  const nen = (p: Partial<ReturnType<typeof tienDoFrom>>) =>
    nenTuMo({ changHienTai: 1, daXong: false, boQua: false, tungDi: false, ...p });

  it("người chưa từng đi thì tự mở", () => {
    expect(nen({})).toBe(true);
  });

  it("đã từng mở, đã đi hết, hay đã bấm để sau thì không tự bung nữa", () => {
    expect(nen({ tungDi: true })).toBe(false);
    expect(nen({ daXong: true })).toBe(false);
    expect(nen({ boQua: true })).toBe(false);
  });
});
