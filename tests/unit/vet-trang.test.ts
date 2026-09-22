import { describe, expect, it } from "vitest";

import { phaTrang } from "@/domain/lunar-phase";
import { vetTrangTrenNuoc } from "@/domain/vet-trang";

/**
 * Bài kiểm canh đúng một điều: **vệt trăng phải đi theo trăng**. Nếu ai đó
 * sửa cho "đẹp hơn" tới mức đêm khuyết sáng bằng đêm rằm thì hình ấy hết nói
 * được điều gì, và mấy bài dưới đây đỏ.
 */

const KHUNG = 600;

describe("Vệt trăng trên mặt nước", () => {
  it("trăng càng đầy thì vệt càng rộng và càng đậm", () => {
    const liem = vetTrangTrenNuoc(0.12, KHUNG);
    const nua = vetTrangTrenNuoc(0.5, KHUNG);
    const tron = vetTrangTrenNuoc(1, KHUNG);

    expect(liem.beRong).toBeLessThan(nua.beRong);
    expect(nua.beRong).toBeLessThan(tron.beRong);
    expect(liem.doDam).toBeLessThan(nua.doDam);
    expect(nua.doDam).toBeLessThan(tron.doDam);
    expect(liem.soGon).toBeLessThan(tron.soGon);
  });

  it("đêm trăng mới thì gần như không có vệt", () => {
    const toi = vetTrangTrenNuoc(0, KHUNG);
    expect(toi.doDam).toBeLessThan(0.08);
    expect(toi.beRong).toBeLessThan(KHUNG * 0.1);
  });

  it("đêm rằm vệt vẫn không chiếm quá một phần ba mặt nước", () => {
    // Rộng quá thì hết ra vệt, thành một mảng sáng loang — đúng chỗ mấy hiệu
    // ứng "cho hoành tráng" hay hỏng.
    const tron = vetTrangTrenNuoc(1, KHUNG);
    expect(tron.beRong).toBeLessThanOrEqual(KHUNG * 0.42);
    expect(tron.doDam).toBeLessThanOrEqual(0.7);
  });

  it("nhận số ngoài khoảng mà không sinh ra hình méo", () => {
    for (const s of [-3, 0, 1, 4, Number.NaN]) {
      const v = vetTrangTrenNuoc(Number.isNaN(s) ? 0 : s, KHUNG);
      expect(Number.isFinite(v.beRong)).toBe(true);
      expect(v.doDam).toBeGreaterThanOrEqual(0);
      expect(v.doDam).toBeLessThanOrEqual(1);
      expect(v.soGon).toBeGreaterThan(0);
    }
  });

  it("ba đêm của mùa Trung thu cho ba vệt khác nhau", () => {
    // Nối thẳng vào phép tính pha trăng thật: đây là chỗ hai tệp phải khớp
    // nhau, nếu không mặt trăng một đằng còn vệt nước một nẻo.
    const dem = ["2026-09-18", "2026-09-25", "2026-09-27"].map((ngay) =>
      vetTrangTrenNuoc(phaTrang(new Date(`${ngay}T21:00:00+07:00`)).doSang, KHUNG),
    );
    expect(dem[0].beRong).toBeLessThan(dem[1].beRong);
    // Đêm khép mùa sáng gần bằng đêm rằm nên vệt gần bằng nhau — đúng bầu
    // trời, và cũng là lý do vòng trăng phải phân biệt hai đêm ấy bằng TÊN
    // chứ không bằng độ sáng.
    expect(Math.abs(dem[2].beRong - dem[1].beRong)).toBeLessThanOrEqual(2);
  });
});
