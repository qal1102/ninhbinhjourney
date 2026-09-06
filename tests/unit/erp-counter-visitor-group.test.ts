import { describe, expect, it } from "vitest";
import {
  COUNTER_GROUP_LABEL_MAX_LENGTH,
  COUNTER_GROUP_MAX_PARTY_SIZE,
  COUNTER_GROUP_MIN_PARTY_SIZE,
  validateCounterVisitorGroupInput,
} from "@/domain/erp-counter-visitor-group";

describe("validateCounterVisitorGroupInput", () => {
  it("nhận đầu vào hợp lệ, cắt khoảng trắng thừa của nhãn", () => {
    const result = validateCounterVisitorGroupInput({
      partySize: 12,
      groupLabel: "  Đoàn Hà Nội  ",
    });
    expect(result).toEqual({ ok: true, partySize: 12, groupLabel: "Đoàn Hà Nội" });
  });

  it("nhận đúng cận dưới 1 người", () => {
    const result = validateCounterVisitorGroupInput({
      partySize: COUNTER_GROUP_MIN_PARTY_SIZE,
      groupLabel: "Khách lẻ",
    });
    expect(result.ok).toBe(true);
  });

  it("nhận đúng cận trên 45 người — khớp trần xe khách của TC-15", () => {
    const result = validateCounterVisitorGroupInput({
      partySize: COUNTER_GROUP_MAX_PARTY_SIZE,
      groupLabel: "Đoàn xe 45 chỗ",
    });
    expect(result.ok).toBe(true);
  });

  it("từ chối 0 người", () => {
    const result = validateCounterVisitorGroupInput({ partySize: 0, groupLabel: "Đoàn" });
    expect(result).toEqual({ ok: false, error: "PARTY_SIZE_INVALID" });
  });

  it("từ chối 46 người — vượt trần một xe khách lớn nhất phổ biến", () => {
    const result = validateCounterVisitorGroupInput({
      partySize: COUNTER_GROUP_MAX_PARTY_SIZE + 1,
      groupLabel: "Đoàn quá tải",
    });
    expect(result).toEqual({ ok: false, error: "PARTY_SIZE_INVALID" });
  });

  it("từ chối số người không nguyên", () => {
    const result = validateCounterVisitorGroupInput({ partySize: 4.5, groupLabel: "Đoàn" });
    expect(result).toEqual({ ok: false, error: "PARTY_SIZE_INVALID" });
  });

  it("từ chối số người không hữu hạn (NaN/Infinity)", () => {
    expect(
      validateCounterVisitorGroupInput({ partySize: Number.NaN, groupLabel: "Đoàn" }),
    ).toEqual({ ok: false, error: "PARTY_SIZE_INVALID" });
    expect(
      validateCounterVisitorGroupInput({ partySize: Number.POSITIVE_INFINITY, groupLabel: "Đoàn" }),
    ).toEqual({ ok: false, error: "PARTY_SIZE_INVALID" });
  });

  it("từ chối nhãn rỗng — khác đoàn web, quầy bắt buộc phải có nhãn để phân biệt hai phiếu", () => {
    const result = validateCounterVisitorGroupInput({ partySize: 5, groupLabel: "   " });
    expect(result).toEqual({ ok: false, error: "GROUP_LABEL_REQUIRED" });
  });

  it("từ chối nhãn vượt quá 120 ký tự", () => {
    const result = validateCounterVisitorGroupInput({
      partySize: 5,
      groupLabel: "a".repeat(COUNTER_GROUP_LABEL_MAX_LENGTH + 1),
    });
    expect(result).toEqual({ ok: false, error: "GROUP_LABEL_TOO_LONG" });
  });

  it("nhận đúng cận trên 120 ký tự của nhãn", () => {
    const result = validateCounterVisitorGroupInput({
      partySize: 5,
      groupLabel: "a".repeat(COUNTER_GROUP_LABEL_MAX_LENGTH),
    });
    expect(result.ok).toBe(true);
  });
});
