import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  MOC_THUONG,
  cheMaVe,
  chuanSoDienThoai,
  docKetQuaTraBangSo,
  docTomTat,
  docVoucherQuay,
  laMaGanDuoc,
} from "@/domain/khach-than-thiet";

/*
 * Khách thân thiết (12/10/2026, migration 119). Luật thật nằm trong kho; bài
 * này canh phần màn hình dựa vào: đọc đúng kết quả kho, không lộ mã voucher
 * khi kho không trả, và mốc thưởng ở màn hình khớp mốc trong migration.
 */

describe("đọc tóm tắt từ kho", () => {
  it("mã chưa gắn", () => {
    expect(docTomTat({ linked: false })).toEqual({ linked: false });
  });

  it("cầm mã: có lượt, điểm, mốc kế; không có mã voucher hay danh sách vé", () => {
    const t = docTomTat({
      linked: true,
      contact_hint: "123",
      visits: 1,
      points: 100,
      next_milestone: { visits: 2, reward: "Quà lưu niệm", remaining: 1 },
      voucher_count: 0,
      visit_list: [{ site: "Tràng An", date: "2026-10-12" }],
      vouchers: null,
      tickets: null,
    });
    expect(t.linked).toBe(true);
    if (!t.linked) return;
    expect(t.visits).toBe(1);
    expect(t.nextMilestone).toEqual({ visits: 2, reward: "Quà lưu niệm", remaining: 1 });
    expect(t.vouchers).toBeNull();
    expect(t.tickets).toBeNull();
  });

  it("nhập lại đúng số: có voucher và vé", () => {
    const t = docTomTat({
      linked: true,
      contact_hint: "123",
      visits: 2,
      points: 200,
      next_milestone: null,
      voucher_count: 1,
      visit_list: [],
      vouchers: [{ code: "VC-5BB75688", kind: "qua-luu-niem", label: "Quà lưu niệm", milestone: 2, status: "issued", expires_on: "2027-10-12" }],
      tickets: [{ code: "TV-0157C180B6", kind: "group-member", site: "Tràng An", valid_on: "2026-10-12", status: "partially-used", entries_allowed: 1, entries_used: 1 }],
      marketing_status: "denied",
    });
    if (!t.linked) throw new Error("phải là đã gắn");
    expect(t.vouchers?.[0]).toMatchObject({ code: "VC-5BB75688", status: "issued", expiresOn: "2027-10-12" });
    expect(t.tickets?.[0]).toMatchObject({ kind: "group-member", entriesUsed: 1 });
    expect(t.marketingStatus).toBe("denied");
  });

  it("voucher ở quầy", () => {
    expect(docVoucherQuay(null)).toBeNull();
    expect(docVoucherQuay({ code: "VC-THUVE001", kind: "ve-mien-phi", status: "redeemed", expired: false, visits: "4" })).toMatchObject({
      kind: "ve-mien-phi",
      status: "redeemed",
      visits: 4,
    });
  });
});

describe("mã và số điện thoại", () => {
  it("nhận mã người trong đoàn và mã vé, từ chối thứ khác", () => {
    expect(laMaGanDuoc("TV-0157C180B6")).toBe(true);
    expect(laMaGanDuoc("quay-2c3d1a6acdb1")).toBe(true);
    expect(laMaGanDuoc("WEB-76E5167C85FF")).toBe(true);
    expect(laMaGanDuoc("DROP TABLE")).toBe(false);
    expect(laMaGanDuoc("TV-123")).toBe(false);
  });

  it("chuẩn hoá số Việt Nam", () => {
    expect(chuanSoDienThoai("0912 345 678")).toBe("0912345678");
    expect(chuanSoDienThoai("+84912345678")).toBe("0912345678");
    expect(chuanSoDienThoai("84912345678")).toBe("0912345678");
    expect(chuanSoDienThoai("12345")).toBeNull();
  });
});

describe("mốc thưởng khớp migration 119", () => {
  it("cùng số lượt, cùng thứ tự", () => {
    const sql = readFileSync("supabase/migrations/202610120119_khach_than_thiet.sql", "utf8");
    const khoi = /customer_loyalty_milestones\(\)[\s\S]*?values([\s\S]*?);/.exec(sql)?.[1] ?? "";
    const trongKho = [...khoi.matchAll(/\((\d+), '([a-z-]+)', '([^']+)'\)/g)].map((m) => ({ visits: Number(m[1]), reward: m[3] }));
    expect(trongKho).toEqual(MOC_THUONG.map((m) => ({ visits: m.visits, reward: m.reward })));
  });
});

describe("tra chỉ bằng số điện thoại (13/10/2026)", () => {
  it("che mã vé, chỉ để tiền tố và bốn ký tự cuối", () => {
    expect(cheMaVe("QUAY-84A1ADE01B38")).toBe("QUAY-••••1B38");
    expect(cheMaVe("tv-0157c180b6")).toBe("TV-••••80B6");
  });

  it("gộp vé web và vé đã gắn, không trả mã thật hay mã quà", () => {
    const kq = docKetQuaTraBangSo({
      found: true,
      loyalty: {
        linked: true,
        contact_hint: "901",
        visits: 1,
        points: 100,
        next_milestone: { visits: 2, reward: "Quà lưu niệm", remaining: 1 },
        voucher_count: 0,
        visit_list: [{ site: "Tràng An", date: "2026-10-13" }],
        vouchers: [{ code: "VC-BIMAT123", kind: "qua-luu-niem", milestone: 2, status: "issued", expires_on: "2027-10-13" }],
        tickets: [{ code: "QUAY-84A1ADE01B38", kind: "ticket", site: "Tràng An", valid_on: "2026-10-13", status: "used", entries_allowed: 1, entries_used: 1 }],
      },
      web_tickets: [{ order_code: "NBJ-DA621315183F", product: "Vé Tràng An", code: "WEB-6D48AB618425", site: "Tràng An", valid_on: "2026-10-14", status: "issued", entries_allowed: 2, entries_used: 0 }],
    });
    expect(kq.found).toBe(true);
    if (!kq.found) return;
    expect(kq.visits).toBe(1);
    expect(kq.ve.map((v) => v.maChe)).toEqual(["WEB-••••8425", "QUAY-••••1B38"]);
    const chu = JSON.stringify(kq);
    expect(chu).not.toContain("84A1ADE01B38");
    expect(chu).not.toContain("6D48AB618425");
    expect(chu).not.toContain("VC-BIMAT123");
    expect(chu).not.toContain("NBJ-DA621315183F");
  });

  it("số chưa có gì thì báo không thấy", () => {
    expect(docKetQuaTraBangSo({ found: false })).toEqual({ found: false });
  });
});
