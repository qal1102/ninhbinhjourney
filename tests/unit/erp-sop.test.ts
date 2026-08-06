import { describe, expect, it } from "vitest";
import {
  sopFailureCounts,
  type SopOpeningItem,
  vietnamBusinessDate,
} from "@/domain/erp-sop";

const items = [
  { id: "critical", isCritical: true },
  { id: "support", isCritical: false },
] as SopOpeningItem[];

describe("ERP SOP Go/No-Go", () => {
  it("uses the Vietnam operating date across the UTC boundary", () => {
    expect(vietnamBusinessDate(new Date("2026-08-07T18:30:00.000Z"))).toBe(
      "2026-08-08",
    );
  });

  it("separates total failures from safety-critical failures", () => {
    expect(
      sopFailureCounts(items, [
        {
          id: "r1",
          itemId: "critical",
          result: "fail",
          note: "Chưa đủ rào chắn.",
          evidenceReference: null,
        },
        {
          id: "r2",
          itemId: "support",
          result: "fail",
          note: "Bộ đàm dự phòng chưa sạc.",
          evidenceReference: null,
        },
      ]),
    ).toEqual({ totalFailures: 2, criticalFailures: 1 });
  });

  it("does not count not-applicable as a failed item", () => {
    expect(
      sopFailureCounts(items, [
        {
          id: "r1",
          itemId: "support",
          result: "not-applicable",
          note: "Không vận hành kênh phụ hôm nay.",
          evidenceReference: null,
        },
      ]),
    ).toEqual({ totalFailures: 0, criticalFailures: 0 });
  });
});
