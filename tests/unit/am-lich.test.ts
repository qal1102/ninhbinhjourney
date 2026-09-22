import { describe, expect, it } from "vitest";

import { duongSangAm, ngayDuongISO } from "@/domain/am-lich";
import { phaTrang } from "@/domain/lunar-phase";

/**
 * Bộ đổi âm lịch là thứ **sai một cách rất im lặng**: lệch một tháng nhuận
 * thì mọi ngày lễ trong năm đều trượt, mà nhìn vào mã thì không thấy gì bất
 * thường. Nên bài kiểm ở đây đối chiếu với ba loại bằng chứng độc lập nhau.
 */

describe("Âm lịch: đối chiếu mốc đã biết", () => {
  it("Tết Bính Ngọ — mùng 1 tháng Giêng 2026 rơi vào 17/02/2026", () => {
    expect(ngayDuongISO(1, 1, 2026)).toBe("2026-02-17");
  });

  it("rằm tháng Tám 2026 rơi vào 25/09/2026 — khớp với ngày trang Trung thu đang in", () => {
    // Đây là mốc mạnh nhất: chính trang Trung thu và `tests/unit/lunar-phase`
    // đã chốt 25.09.2026 là đêm rằm, từ trước khi có tệp âm lịch này.
    expect(ngayDuongISO(15, 8, 2026)).toBe("2026-09-25");
  });

  it("đổi xuôi rồi đổi ngược luôn ra chính ngày ban đầu", () => {
    for (const [n, t, y] of [
      [17, 2, 2026],
      [25, 9, 2026],
      [1, 1, 2030],
      [29, 2, 2024],
      [31, 12, 2019],
    ] as const) {
      const am = duongSangAm(n, t, y);
      expect(ngayDuongISO(am.ngay, am.thang, am.nam, am.nhuan)).toBe(
        `${y}-${String(t).padStart(2, "0")}-${String(n).padStart(2, "0")}`,
      );
    }
  });
});

describe("Âm lịch: khớp với bầu trời", () => {
  it("mùng 1 âm lịch luôn rơi đúng vào kỳ trăng tối", () => {
    // Không cần tra cứu ở đâu cả: mùng 1 là ngày sóc. Nếu bộ đổi lệch một
    // ngày trở lên thì độ sáng đo được sẽ không còn gần 0.
    for (const nam of [2024, 2025, 2026, 2027]) {
      for (const thang of [1, 5, 8, 11]) {
        const iso = ngayDuongISO(1, thang, nam);
        expect(iso, `mùng 1 tháng ${thang}/${nam}`).toBeTruthy();
        const sang = phaTrang(new Date(`${iso}T21:00:00+07:00`)).doSang;
        expect(sang, `mùng 1 tháng ${thang}/${nam} sáng ${sang}`).toBeLessThan(0.12);
      }
    }
  });

  it("ngày rằm luôn rơi đúng vào kỳ trăng sáng", () => {
    for (const nam of [2024, 2025, 2026, 2027]) {
      for (const thang of [1, 4, 7, 8]) {
        const iso = ngayDuongISO(15, thang, nam);
        expect(iso).toBeTruthy();
        const sang = phaTrang(new Date(`${iso}T21:00:00+07:00`)).doSang;
        expect(sang, `rằm tháng ${thang}/${nam} sáng ${sang}`).toBeGreaterThan(0.93);
      }
    }
  });
});

describe("Âm lịch: nói thẳng khi ngày không tồn tại", () => {
  it("hỏi tháng nhuận của một năm không nhuận thì trả về không có", () => {
    // 2026 không có tháng Tám nhuận; thà trả `null` còn hơn trả một ngày gần
    // đúng — một cuốn lịch nói sai ngày lễ còn tệ hơn cuốn lịch nói không biết.
    expect(ngayDuongISO(15, 8, 2026, true)).toBeNull();
  });

  it("từ chối ngày ngoài khuôn", () => {
    expect(ngayDuongISO(0, 1, 2026)).toBeNull();
    expect(ngayDuongISO(31, 1, 2026)).toBeNull();
    expect(ngayDuongISO(1, 13, 2026)).toBeNull();
  });

  it("mùng 30 của một tháng thiếu trả về không có, không trả ngày trôi sang tháng sau", () => {
    // Quét vài năm: mỗi lần trả về một ngày, ngày ấy phải đổi ngược đúng về
    // mùng 30 — nếu bộ đổi để lọt một ngày của tháng sau thì bài này đỏ.
    let coThieu = false;
    for (const nam of [2025, 2026, 2027]) {
      for (let thang = 1; thang <= 12; thang += 1) {
        const iso = ngayDuongISO(30, thang, nam);
        if (!iso) {
          coThieu = true;
          continue;
        }
        const [y, m, d] = iso.split("-").map(Number);
        const lai = duongSangAm(d, m, y);
        expect(lai.ngay).toBe(30);
        expect(lai.thang).toBe(thang);
      }
    }
    expect(coThieu, "ba năm liền mà không có tháng thiếu nào là bất thường").toBe(true);
  });
});
