import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BIA, DE_LAM_GI, HANH_TRINH_KHACH, LOI_DAU, MO_NHOM_ERP, MO_NHOM_WEB, MOT_NGAY } from "@/content/tai-lieu-huong-dan";
import { BAN_DO_CHUC_NANG, CHUC_NANG_WEB, TEN_NHOM_WEB, type NhomWeb } from "@/domain/ban-do-chuc-nang";

describe("sổ tay vận hành", () => {
  const idErp = BAN_DO_CHUC_NANG.flatMap((nhom) => nhom.chucNang.map((cn) => cn.id));
  const idWeb = CHUC_NANG_WEB.map((cn) => cn.id);
  const tatCa = new Set([...idErp, ...idWeb]);

  it("chức năng nào cũng có lời \"để làm gì\", và không có lời thừa", () => {
    expect([...tatCa].filter((id) => !DE_LAM_GI[id])).toEqual([]);
    expect(Object.keys(DE_LAM_GI).filter((id) => !tatCa.has(id))).toEqual([]);
  });

  it("chương nào cũng có lời mở", () => {
    expect(BAN_DO_CHUC_NANG.filter((nhom) => !MO_NHOM_ERP[nhom.id]).map((n) => n.id)).toEqual([]);
    expect((Object.keys(TEN_NHOM_WEB) as NhomWeb[]).filter((nhom) => !MO_NHOM_WEB[nhom])).toEqual([]);
  });

  it("một ngày từ A tới Z chỉ gọi chức năng có thật", () => {
    for (const chang of [...MOT_NGAY, ...HANH_TRINH_KHACH]) {
      for (const id of chang.muc) expect(tatCa.has(id), `${chang.ten}: ${id}`).toBe(true);
    }
  });

  it("ảnh văn hoá có tệp trong public", () => {
    const anh = [BIA, LOI_DAU.anh, ...Object.values(MO_NHOM_ERP).map((m) => m.anh), ...Object.values(MO_NHOM_WEB).flatMap((m) => (m.anh ? [m.anh] : []))];
    for (const a of anh) expect(existsSync(`public${a.tep}`), a.tep).toBe(true);
  });
});
