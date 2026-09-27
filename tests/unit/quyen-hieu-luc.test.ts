import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { ERP_MODULES } from "@/domain/erp";
import { ERP_ACCOUNTANT_MODULE_IDS } from "@/domain/erp-role-policy";
import { tinhQuyenHieuLuc, vaiCanCoSo, vaiTuPhieuCap } from "@/domain/quyen-hieu-luc";
import { dungTaiKhoanHieuLuc } from "@/lib/erp/tai-khoan-hieu-luc";
import type { ErpRegistryAccount } from "@/lib/erp/account-registry-repository";

const MOI_MODULE = ERP_MODULES.map((module) => module.id);

function soTaiKhoan(
  accountId: string,
  grants: ErpRegistryAccount["grants"],
  status: ErpRegistryAccount["status"] = "active",
): ErpRegistryAccount {
  return {
    accountId,
    displayName: accountId,
    jobTitle: "Thử",
    employmentType: "permanent",
    status,
    hasAuthUser: false,
    email: null,
    mustChangePassword: false,
    phone: null,
    startedAt: null,
    grants,
  };
}

describe("luật quyền một nguồn", () => {
  it("giám đốc có mọi cơ sở, mọi module", () => {
    const q = tinhQuyenHieuLuc({ role: "director", coSoDuocCap: [], conHieuLuc: true });
    expect(q.siteIds).toEqual(["trang-an", "tam-chuc", "tam-coc", "bai-dinh"]);
    expect(q.moduleIdsBySite["tam-coc"]).toEqual(MOI_MODULE);
  });

  it("quản lý có mọi module ở đúng cơ sở mình, kể cả module thêm sau như Báo cáo", () => {
    const q = tinhQuyenHieuLuc({ role: "manager", coSoDuocCap: ["tam-coc"], conHieuLuc: true });
    expect(q.siteIds).toEqual(["tam-coc"]);
    expect(q.moduleIdsBySite["tam-coc"]).toContain("bao-cao");
    expect(q.moduleIdsBySite["trang-an"]).toBeUndefined();
  });

  it("kế toán có bộ module tài chính ở cơ sở được cấp", () => {
    const q = tinhQuyenHieuLuc({ role: "accountant", coSoDuocCap: ["trang-an", "bai-dinh"], conHieuLuc: true });
    expect(q.siteIds).toEqual(["trang-an", "bai-dinh"]);
    expect(q.moduleIdsBySite["bai-dinh"]).toEqual(MOI_MODULE.filter((id) => ERP_ACCOUNTANT_MODULE_IDS.includes(id)));
  });

  it("nhân viên: đúng việc quản lý giao; chưa giao thì bộ cơ bản; giao rỗng thì rỗng", () => {
    const daGiao = tinhQuyenHieuLuc({
      role: "employee",
      coSoDuocCap: ["trang-an", "tam-coc"],
      viecDaGiao: { "trang-an": ["su-co", "check-in-khach"] },
      conHieuLuc: true,
    });
    expect(daGiao.moduleIdsBySite["trang-an"]).toEqual(["check-in-khach", "su-co"]);
    expect(daGiao.moduleIdsBySite["tam-coc"]).toEqual(["bao-cao-hien-truong", "cham-cong"]);
    const rong = tinhQuyenHieuLuc({ role: "employee", coSoDuocCap: ["trang-an"], viecDaGiao: { "trang-an": [] }, conHieuLuc: true });
    expect(rong.moduleIdsBySite["trang-an"]).toEqual([]);
  });

  it("việc đã giao ở cơ sở bị thu hồi không còn tác dụng", () => {
    const q = tinhQuyenHieuLuc({
      role: "employee",
      coSoDuocCap: ["tam-coc"],
      viecDaGiao: { "trang-an": ["check-in-khach"] },
      conHieuLuc: true,
    });
    expect(q.siteIds).toEqual(["tam-coc"]);
    expect(q.moduleIdsBySite["trang-an"]).toBeUndefined();
  });

  it("khoá hoặc hết hạn thì không còn gì, không có vai cũng vậy", () => {
    expect(tinhQuyenHieuLuc({ role: "manager", coSoDuocCap: ["tam-coc"], conHieuLuc: false }).siteIds).toEqual([]);
    expect(tinhQuyenHieuLuc({ role: null, coSoDuocCap: ["tam-coc"], conHieuLuc: true }).siteIds).toEqual([]);
  });

  it("vai rộng nhất thắng khi lỡ giữ hai vai; quản trị hệ thống không phải vai nghiệp vụ", () => {
    expect(vaiTuPhieuCap([{ role: "employee" }, { role: "regional-manager" }])).toBe("manager");
    expect(vaiTuPhieuCap([{ role: "system-admin" }])).toBeNull();
    expect(vaiCanCoSo("employee")).toBe("bat-buoc");
    expect(vaiCanCoSo("director")).toBe("toan-vung");
  });
});

describe("tài khoản đọc từ sổ", () => {
  const khongGiao = { employees: {} };

  it("thu hồi vai trên màn Tài khoản là mất quyền, kể cả tài khoản mẫu có sẵn", () => {
    // manager-tam-coc có hồ sơ mẫu ghi quản lý Tam Cốc, nhưng sổ đã thu hồi vai.
    const tk = dungTaiKhoanHieuLuc(soTaiKhoan("manager-tam-coc", []), khongGiao);
    expect(tk).toBeNull();
  });

  it("cấp thêm cơ sở trên màn Tài khoản là có hiệu lực, kể cả tài khoản mẫu", () => {
    const tk = dungTaiKhoanHieuLuc(
      soTaiKhoan("manager-tam-coc", [
        { role: "regional-manager", siteId: "tam-coc" },
        { role: "regional-manager", siteId: "bai-dinh" },
      ]),
      khongGiao,
    );
    expect(tk?.quyen.siteIds).toEqual(["tam-coc", "bai-dinh"]);
  });

  it("người tạo mới có vai nhân viên thì vào được cơ sở với bộ việc cơ bản", () => {
    const tk = dungTaiKhoanHieuLuc(soTaiKhoan("nguyen-van-ba", [{ role: "employee", siteId: "tam-coc" }]), khongGiao);
    expect(tk?.role).toBe("employee");
    expect(tk?.quyen.moduleIdsBySite["tam-coc"]).toEqual(["bao-cao-hien-truong", "cham-cong"]);
    expect(tk?.viecDaDaoTao.length).toBeGreaterThan(2);
  });

  it("tài khoản tạm khoá thì không còn quyền", () => {
    const tk = dungTaiKhoanHieuLuc(soTaiKhoan("nguyen-van-ba", [{ role: "employee", siteId: "tam-coc" }], "suspended"), khongGiao);
    expect(tk?.conHieuLuc).toBe(false);
    expect(tk?.quyen.siteIds).toEqual([]);
  });
});
