import { describe, expect, it } from "vitest";

import {
  heSoBongTrang,
  phaTrang,
  TEN_PHA_VI,
  TUAN_TRANG_NGAY,
} from "@/domain/lunar-phase";

/**
 * Bài kiểm này đối chiếu với **trăng thật**, không đối chiếu với chính công
 * thức. Mỗi mốc dưới đây là một kỳ trăng đã được công bố; nếu ai đó sửa hằng
 * số hay công thức cho "gọn hơn", mấy mốc này sẽ đỏ.
 *
 * Sai số chấp nhận: **một ngày**. Phép tính dùng tuần trăng trung bình, trong
 * khi quỹ đạo thật lệch tới ±0,5 ngày — đòi chính xác hơn thế là tự lừa mình.
 */

function ngay(iso: string) {
  return new Date(`${iso}T14:00:00Z`);
}

describe("Pha trăng: đối chiếu với trăng thật", () => {
  it("đêm rằm Trung thu 2026 (25/09) sáng gần như trọn đĩa", () => {
    // "25.09 · rằm" là ngày 15 tháng tám ÂM LỊCH — con số trang Trung thu in
    // ra, và nó đúng. Trăng đầy nhất thật ra rơi vào 26/09: rằm là mốc của
    // lịch, trăng tròn là mốc của bầu trời, lệch nhau được tới một ngày.
    const ra = phaTrang(ngay("2026-09-25"));
    expect(ra.doSang).toBeGreaterThan(0.97);
    expect(ra.ten).toBe("trang-tron");
  });

  it("trăng đầy nhất của mùa rơi vào 26/09, không phải đêm rằm", () => {
    const ram = phaTrang(ngay("2026-09-25")).doSang;
    const homSau = phaTrang(ngay("2026-09-26")).doSang;
    expect(homSau).toBeGreaterThan(ram);
  });

  it("hai đêm còn lại của mùa KHÔNG được tròn như đêm rằm", () => {
    const moMua = phaTrang(ngay("2026-09-18"));
    const ram = phaTrang(ngay("2026-09-25"));
    const khepMua = phaTrang(ngay("2026-09-27"));
    // Chính chỗ này là lý do tệp tồn tại: bản cũ vẽ ba đêm giống hệt nhau.
    expect(moMua.doSang).toBeLessThan(ram.doSang - 0.2);
    // Khép mùa sáng GẦN BẰNG đêm rằm — hai đêm nằm đối xứng quanh đỉnh
    // 26.09 — nhưng phải mang tên khác, nếu không vòng trăng nói hai đêm
    // giống hệt nhau và mất sạch ý nghĩa.
    expect(Math.abs(khepMua.doSang - ram.doSang)).toBeLessThan(0.02);
    expect(khepMua.ten).not.toBe(ram.ten);
    expect(khepMua.ten).toBe("vua-qua-ram");
    expect(moMua.dangLen).toBe(true);
    expect(khepMua.dangLen).toBe(false);
  });

  it("nhận đúng một kỳ trăng mới đã biết", () => {
    // Trăng mới 06/01/2000 là chính mốc gốc.
    const ra = phaTrang(new Date(Date.UTC(2000, 0, 6, 18, 14)));
    expect(ra.doSang).toBeLessThan(0.01);
    expect(ra.ten).toBe("trang-moi");
  });

  it("nhận đúng một kỳ trăng tròn cách mốc hai mươi sáu năm", () => {
    // Nửa tuần trăng sau một kỳ sóc thì phải là vọng, dù đi bao xa khỏi mốc.
    const soc = new Date(Date.UTC(2000, 0, 6, 18, 14));
    const xa = new Date(
      soc.getTime() + Math.round(330.5 * TUAN_TRANG_NGAY * 86_400_000),
    );
    expect(phaTrang(xa).doSang).toBeGreaterThan(0.99);
  });
});

describe("Pha trăng: hình dạng đem đi vẽ", () => {
  it("chiều khuyết đổi bên giữa nửa đầu và nửa sau tuần trăng", () => {
    // Vẽ sai chiều là lỗi hay gặp nhất khi tự vẽ mặt trăng.
    expect(phaTrang(ngay("2026-09-18")).dangLen).toBe(true);
    expect(phaTrang(ngay("2026-09-29")).dangLen).toBe(false);
  });

  it("hệ số bóng đổi dấu đúng ở hai kỳ huyền", () => {
    // Dương ở lưỡi liềm, âm ở trăng khuyết gần đầy — đó là chỗ một hình
    // liềm và một hình khuyết khác nhau.
    expect(heSoBongTrang(0.1)).toBeGreaterThan(0);
    expect(heSoBongTrang(0.4)).toBeLessThan(0);
    expect(Math.abs(heSoBongTrang(0.25))).toBeLessThan(0.01);
    expect(Math.abs(heSoBongTrang(0.75))).toBeLessThan(0.01);
  });

  it("độ sáng luôn nằm trong khoảng 0 tới 1, kể cả ngày âm lịch xa", () => {
    for (const iso of ["1969-07-20", "2026-01-01", "2099-12-31"]) {
      const ra = phaTrang(ngay(iso));
      expect(ra.doSang).toBeGreaterThanOrEqual(0);
      expect(ra.doSang).toBeLessThanOrEqual(1);
      expect(ra.pha).toBeGreaterThanOrEqual(0);
      expect(ra.pha).toBeLessThan(1);
    }
  });

  it("đêm sáng 43% không được gọi là lưỡi liềm", () => {
    // Lưỡi liềm trong tiếng Việt là vầng trăng MỎNG. Gần nửa đĩa mà gọi lưỡi
    // liềm là sai với mắt thường, dù đúng về mặt "chưa tới nửa".
    const ra = phaTrang(ngay("2026-09-18"));
    expect(ra.doSang).toBeGreaterThan(0.35);
    expect(ra.ten).toBe("thuong-huyen");
  });

  it("mọi pha đều có tên tiếng Việt, không lọt tên máy ra màn hình", () => {
    for (let i = 0; i < 60; i += 1) {
      const ra = phaTrang(new Date(Date.UTC(2026, 8, 1) + i * 43_200_000));
      expect(TEN_PHA_VI[ra.ten]).toBeTruthy();
      expect(TEN_PHA_VI[ra.ten]).not.toMatch(/[a-z]{4,}-/);
    }
  });
});
