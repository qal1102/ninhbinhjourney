import { describe, expect, it } from "vitest";
import {
  calculateEffectiveCapacity,
  calculateHourlyCapacity,
} from "@/domain/erp-capacity";

/**
 * TC-01. `calculateEffectiveCapacity` là bản sao ở tầng ứng dụng của cột sinh
 * `effective_capacity` trong migration `202608260049`, dùng để xem trước trên
 * màn hình. Hai công thức lệch nhau nghĩa là màn hình hứa một con số còn máy
 * chủ bán theo một con số khác — nên `capacity-repository` so hai bên và ném
 * lỗi nếu lệch. Các bài dưới đây canh giữ phía TypeScript của cặp đó.
 */
describe("calculateEffectiveCapacity", () => {
  it("bằng đúng công suất vòng quay khi hệ số là 1", () => {
    const input = {
      capacityModel: "round-trip" as const,
      vehicleCount: 600,
      seatsPerVehicle: 4,
      roundTripMinutes: 180,
      staticCapacity: null,
      safetyFactor: 1,
    };
    // Chính là bất biến khiến việc chuyển đường giữ chỗ sang đọc
    // `effective_capacity` không dịch chuyển một con số nào của bốn hàng đang
    // chạy production.
    expect(calculateEffectiveCapacity(input)).toBe(calculateHourlyCapacity(input));
    expect(calculateEffectiveCapacity(input)).toBe(800);
  });

  it("nhân hệ số an toàn rồi làm tròn xuống", () => {
    expect(
      calculateEffectiveCapacity({
        capacityModel: "round-trip",
        vehicleCount: 10,
        seatsPerVehicle: 4,
        roundTripMinutes: 60,
        staticCapacity: null,
        safetyFactor: 0.8,
      }),
    ).toBe(32);
  });

  it("bỏ qua hoàn toàn công thức vòng quay khi mô hình là tĩnh", () => {
    // Bãi đỗ không quay vòng. Nếu hàm này lỡ dùng vehicle × seats × 60 ÷ phút
    // thì con số hiện ra là số bịa trông như đã đo.
    expect(
      calculateEffectiveCapacity({
        capacityModel: "static",
        vehicleCount: 999,
        seatsPerVehicle: 999,
        roundTripMinutes: 1,
        staticCapacity: 250,
        safetyFactor: 1,
      }),
    ).toBe(250);
  });

  it("trả 0 khi mô hình tĩnh mà chưa có số chỗ", () => {
    expect(
      calculateEffectiveCapacity({
        capacityModel: "static",
        vehicleCount: 1,
        seatsPerVehicle: 1,
        roundTripMinutes: 60,
        staticCapacity: null,
        safetyFactor: 1,
      }),
    ).toBe(0);
  });

  it("từ chối hệ số ngoài khoảng (0, 1]", () => {
    const base = {
      capacityModel: "round-trip" as const,
      vehicleCount: 10,
      seatsPerVehicle: 4,
      roundTripMinutes: 60,
      staticCapacity: null,
    };
    // Hệ số > 1 sẽ **nâng** công suất bán ra vượt quá năng lực vật lý — đúng
    // thứ không bao giờ được phép xảy ra âm thầm.
    expect(calculateEffectiveCapacity({ ...base, safetyFactor: 1.5 })).toBe(0);
    expect(calculateEffectiveCapacity({ ...base, safetyFactor: 0 })).toBe(0);
    expect(calculateEffectiveCapacity({ ...base, safetyFactor: -1 })).toBe(0);
    expect(calculateEffectiveCapacity({ ...base, safetyFactor: Number.NaN })).toBe(0);
  });
});
