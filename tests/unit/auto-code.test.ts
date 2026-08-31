import { describe, expect, it } from "vitest";
import { ACCOUNT_CODE_SHAPE, asciiSlug, generateCode, MARKETING_CODE_SHAPE } from "@/domain/auto-code";

describe("asciiSlug", () => {
  it("bỏ dấu tiếng Việt, kể cả chữ đ/Đ vốn không tách được bằng NFD", () => {
    expect(asciiSlug("Đình Các Đông")).toBe("dinh-cac-dong");
    expect(asciiSlug("Nguyễn Văn Đức")).toBe("nguyen-van-duc");
  });

  it("gộp ký tự lạ thành một gạch nối, không để gạch thừa ở hai đầu", () => {
    expect(asciiSlug("  Bảng   tại // bến Tam Cốc!!  ")).toBe("bang-tai-ben-tam-coc");
  });
});

describe("generateCode", () => {
  it("cắt cho vừa trần độ dài, chừa chỗ cho hậu tố", () => {
    const shape = { uppercase: false, minLength: 2, maxLength: 10, fallback: "nhan-vien" };
    const code = generateCode("nguyen van nam long dai qua muc gioi han", [], shape);
    expect(code.length).toBeLessThanOrEqual(shape.maxLength);
    expect(code.endsWith("-")).toBe(false);
  });

  it("đắp thêm ký tự cho đủ độ dài tối thiểu khi tên gốc quá ngắn", () => {
    const shape = { uppercase: false, minLength: 8, maxLength: 100, fallback: "nhan-vien" };
    const code = generateCode("an", [], shape);
    expect(code.length).toBeGreaterThanOrEqual(shape.minLength);
    expect(code).toBe("anxxxxxx");
  });

  it("thêm hậu tố -2, -3… khi mã đã có người dùng", () => {
    const taken = ["nguyen-van-ba"];
    const first = generateCode("Nguyễn Văn Ba", taken, ACCOUNT_CODE_SHAPE);
    expect(first).toBe("nguyen-van-ba-2");
    const second = generateCode("Nguyễn Văn Ba", [...taken, first], ACCOUNT_CODE_SHAPE);
    expect(second).toBe("nguyen-van-ba-3");
  });

  it("đối chiếu mã trùng không phân biệt hoa thường", () => {
    const code = generateCode("Tamcoc Aug", ["tamcoc-aug"], MARKETING_CODE_SHAPE);
    expect(code).toBe("TAMCOC-AUG-2");
  });

  it("dùng mã dự phòng khi tên không còn chữ cái ASCII nào", () => {
    const code = generateCode("!!!@@@###", [], MARKETING_CODE_SHAPE);
    expect(code).toBe(MARKETING_CODE_SHAPE.fallback.toUpperCase());
  });

  it("mã đầu tiên không mang số thứ tự", () => {
    const code = generateCode("Trung thu bến Tam Cốc", [], MARKETING_CODE_SHAPE);
    expect(code).toBe("TRUNG-THU-BEN-TAM-COC");
  });
});
