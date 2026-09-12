import { describe, expect, it } from "vitest";
import {
  summariseProductShares,
  summariseTicketPeriods,
  ticketEntries,
  type TicketSalesRow,
} from "@/domain/erp-ticket-sales";

/*
 * Lượt kiểm tay ngày 12/09/2026: đặt một đơn 2 khách, vé ghi "2 lượt vào",
 * mà ERP báo "Số vé phát hành: 1". Vé đoàn `TA-2026-000102` ghi vài chục lượt
 * vẫn đếm là 1. Các bài dưới đây dựng lại đúng hai trường hợp ấy.
 */

const BAY_GIO = Date.parse("2026-09-13T05:00:00.000Z");
const GIO = 60 * 60 * 1000;
const NGAY = 24 * GIO;

function ve(tuoiMs: number, entriesAllowed: unknown, product = "adult"): TicketSalesRow {
  return { issuedAt: new Date(BAY_GIO - tuoiMs).toISOString(), entriesAllowed, product };
}

function ky(rows: TicketSalesRow[], period: "day" | "week" | "month" | "year") {
  const stat = summariseTicketPeriods(rows, BAY_GIO).find((item) => item.period === period);
  if (!stat) throw new Error(`thiếu kỳ ${period}`);
  return stat;
}

describe("đếm vé: tấm vé và lượt khách là hai con số khác nhau", () => {
  it("một đơn web 2 khách là 1 tấm vé nhưng 2 lượt khách", () => {
    const hom_nay = ky([ve(GIO, 2)], "day");
    expect(hom_nay.ticketCount).toBe(1);
    expect(hom_nay.entryCount).toBe(2);
  });

  it("vé đoàn 45 lượt đếm 45 lượt khách, không phải 1", () => {
    const hom_nay = ky([ve(GIO, 45), ve(2 * GIO, 1)], "day");
    expect(hom_nay.ticketCount).toBe(2);
    expect(hom_nay.entryCount).toBe(46);
  });

  it("so kỳ trước bằng lượt khách, không bằng số tấm vé", () => {
    // Hôm qua: 1 tấm vé đoàn 10 lượt. Hôm nay: 2 tấm vé lẻ, mỗi tấm 1 lượt.
    // Đếm theo tấm thì tưởng tăng 100%; đếm theo lượt thì thật ra giảm 80%.
    const hom_nay = ky([ve(GIO, 1), ve(2 * GIO, 1), ve(NGAY + GIO, 10)], "day");
    expect(hom_nay.ticketCount).toBe(2);
    expect(hom_nay.entryCount).toBe(2);
    expect(hom_nay.changePercent).toBe(-80);
  });

  it("kỳ trước bằng 0 thì không bịa phần trăm", () => {
    expect(ky([ve(GIO, 3)], "day").changePercent).toBeNull();
  });

  it("vé nào cũng cho ít nhất một người vào: lượt hỏng, thiếu, âm hay bằng 0 đều tính 1", () => {
    for (const hong of [null, undefined, "", "abc", 0, -3, Number.NaN]) {
      expect(ticketEntries(hong), String(hong)).toBe(1);
    }
    expect(ticketEntries("4")).toBe(4);
    expect(ticketEntries(2.9)).toBe(2);
  });

  it("vé phát ở tương lai hoặc ngày hỏng không lọt vào kỳ nào", () => {
    const rows = [ve(-GIO, 5), { issuedAt: "không phải ngày", entriesAllowed: 7, product: "adult" }];
    for (const period of ["day", "week", "month", "year"] as const) {
      expect(ky(rows, period).entryCount).toBe(0);
    }
  });

  it("vé đúng mép kỳ thuộc kỳ trước, không đếm hai lần", () => {
    const rows = [ve(NGAY, 4)];
    expect(ky(rows, "day").entryCount).toBe(0);
    expect(ky(rows, "week").entryCount).toBe(4);
  });
});

describe("cơ cấu sản phẩm xếp theo lượt khách", () => {
  it("một vé đoàn đông vượt lên trên nhiều vé lẻ", () => {
    const shares = summariseProductShares(
      [ve(GIO, 1, "adult"), ve(GIO, 1, "adult"), ve(GIO, 1, "adult"), ve(GIO, 30, "group")],
      BAY_GIO,
    );
    expect(shares.map((share) => share.product)).toEqual(["group", "adult"]);
    expect(shares[0]).toMatchObject({ ticketCount: 1, entryCount: 30 });
    expect(shares[1]).toMatchObject({ ticketCount: 3, entryCount: 3 });
    // 30 / 33 và 3 / 33, làm tròn một chữ số thập phân.
    expect(shares[0].sharePercent).toBe(90.9);
    expect(shares[1].sharePercent).toBe(9.1);
  });

  it("chỉ tính vé trong 30 ngày gần nhất", () => {
    const shares = summariseProductShares([ve(GIO, 2), ve(31 * NGAY, 50)], BAY_GIO);
    expect(shares).toEqual([
      { product: "adult", ticketCount: 1, entryCount: 2, sharePercent: 100 },
    ]);
  });
});
