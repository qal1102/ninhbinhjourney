import { describe, expect, it } from "vitest";
import {
  ERP_OVERVIEW_BACK_TARGET,
  resolveModuleBackTarget,
  resolveStaffProfileBackTarget,
} from "@/lib/erp/erp-back-link";

// ERP-UX-08: mỗi màn hình con phải quay về đúng nơi vừa rời, không phải luôn
// luôn về `/erp`. Các bài dưới đây khoá lại đúng nghĩa của từng đích, tách
// biệt khỏi phần render (không có hạ tầng test render React trong dự án).

describe("resolveModuleBackTarget", () => {
  it("quay về đúng trang cơ sở của module đó, không phải tổng quan chung", () => {
    const target = resolveModuleBackTarget({ id: "trang-an", shortName: "Tràng An" });
    expect(target).toEqual({ href: "/erp/trang-an", label: "Quay lại Tràng An" });
  });

  it("mã cơ sở khác nhau tạo đích khác nhau", () => {
    const target = resolveModuleBackTarget({ id: "tam-coc", shortName: "Tam Cốc" });
    expect(target.href).toBe("/erp/tam-coc");
    expect(target.label).toBe("Quay lại Tam Cốc");
  });
});

describe("resolveStaffProfileBackTarget", () => {
  it("system-admin quay về danh sách tài khoản", () => {
    expect(resolveStaffProfileBackTarget(true)).toEqual({
      href: "/erp/tai-khoan",
      label: "Quay lại danh sách tài khoản",
    });
  });

  it("người xem không phải system-admin (ví dụ tự xem hồ sơ mình, hoặc quản lý cùng cơ sở) quay về tổng quan", () => {
    expect(resolveStaffProfileBackTarget(false)).toEqual(ERP_OVERVIEW_BACK_TARGET);
  });
});
