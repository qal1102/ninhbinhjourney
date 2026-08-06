import { describe, expect, it } from "vitest";
import {
  calculateHourlyCapacity,
  capacityAlertLevel,
  capacityLoadPercent,
  vietnamHourWindow,
} from "@/domain/erp-capacity";

const thresholdBands = {
  watchPercent: 70,
  restrictPercent: 85,
  stopPercent: 100,
};

describe("ERP hourly capacity", () => {
  it("derives hourly throughput from the three physical inputs", () => {
    expect(
      calculateHourlyCapacity({
        vehicleCount: 24,
        seatsPerVehicle: 48,
        roundTripMinutes: 60,
      }),
    ).toBe(1_152);
  });

  it("rounds fractional throughput down instead of overstating capacity", () => {
    expect(
      calculateHourlyCapacity({
        vehicleCount: 7,
        seatsPerVehicle: 4,
        roundTripMinutes: 45,
      }),
    ).toBe(37);
  });

  it("returns zero for an invalid physical input", () => {
    expect(
      calculateHourlyCapacity({
        vehicleCount: 10,
        seatsPerVehicle: 4,
        roundTripMinutes: 0,
      }),
    ).toBe(0);
  });

  it("maps load to all four response bands at their exact boundaries", () => {
    expect(capacityAlertLevel(69, thresholdBands)).toBe("green");
    expect(capacityAlertLevel(70, thresholdBands)).toBe("yellow");
    expect(capacityAlertLevel(85, thresholdBands)).toBe("orange");
    expect(capacityAlertLevel(100, thresholdBands)).toBe("red");
    expect(capacityLoadPercent(85, 100)).toBe(85);
  });

  it("builds a Vietnam clock-hour window across the UTC date boundary", () => {
    expect(vietnamHourWindow(new Date("2026-08-07T18:34:56.000Z"))).toEqual({
      start: "2026-08-07T18:00:00.000Z",
      end: "2026-08-07T19:00:00.000Z",
    });
  });
});
