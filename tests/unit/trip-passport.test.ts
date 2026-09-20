import { describe, expect, it } from "vitest";
import { DESTINATIONS } from "@/content/destinations";
import { ERP_SITES } from "@/domain/erp";
import {
  TRIP_PASSPORT_PLACE_IDS,
  buildTripPassport,
  formatVisitDate,
  formatVisitMoment,
  groupTripPassportEntries,
  litPlaceIds,
  newlyLitPlaceIds,
  tripPassportPlaces,
} from "@/domain/trip-passport";

const TRANG_AN = "10000000-0000-4000-8000-000000000001";
const CO_DO_HOA_LU = "10000000-0000-4000-8000-000000000002";
const BAI_DINH = "10000000-0000-4000-8000-000000000003";
const PHO_CO_HOA_LU = "10000000-0000-4000-8000-000000000004";
const TAM_COC = "10000000-0000-4000-8000-000000000005";
const TAM_CHUC = "10000000-0000-4000-8000-000000000009";

describe("những nơi có thể sáng", () => {
  it("đúng bốn cơ sở có cổng, mỗi cơ sở ERP một nơi", () => {
    const places = tripPassportPlaces();
    expect(places.map((place) => place.id)).toEqual([...TRIP_PASSPORT_PLACE_IDS]);
    expect(places).toHaveLength(ERP_SITES.length);
    for (const site of ERP_SITES) {
      const khop = places.filter((place) => place.name.vi.includes(site.shortName));
      expect(khop, `một nơi trên bản đồ cho ${site.shortName}`).toHaveLength(1);
    }
  });

  it("mỗi mã đều có thật trong kho nội dung, kèm toạ độ và ảnh", () => {
    for (const id of TRIP_PASSPORT_PLACE_IDS) {
      const destination = DESTINATIONS.find((item) => item.id === id);
      expect(destination, id).toBeDefined();
      expect(destination?.image).toMatch(/^\/images\//);
    }
  });

  it("hai điểm Hoa Lư không có trên bản đồ", () => {
    const ids: readonly string[] = TRIP_PASSPORT_PLACE_IDS;
    expect(ids).not.toContain(CO_DO_HOA_LU);
    expect(ids).not.toContain(PHO_CO_HOA_LU);
  });
});

describe("buildTripPassport", () => {
  it("chưa vào đâu thì cả bốn nơi còn mờ, theo đúng thứ tự khai", () => {
    const passport = buildTripPassport([]);
    expect(passport.litCount).toBe(0);
    expect(passport.totalCount).toBe(4);
    expect(passport.stops.map((stop) => stop.id)).toEqual([...TRIP_PASSPORT_PLACE_IDS]);
    expect(passport.stops.every((stop) => !stop.lit && stop.firstVisitAt === null && stop.visitOrder === null)).toBe(true);
  });

  it("nơi đã vào sáng lên, xếp theo giờ tới, rồi mới tới nơi chưa ghé", () => {
    const passport = buildTripPassport([
      { siteId: TAM_COC, scannedAt: "2026-09-18T06:10:00+00:00" },
      { siteId: TRANG_AN, scannedAt: "2026-09-18T01:30:00+00:00" },
    ]);
    expect(passport.litCount).toBe(2);
    expect(passport.stops.map((stop) => [stop.id, stop.lit, stop.visitOrder])).toEqual([
      [TRANG_AN, true, 1],
      [TAM_COC, true, 2],
      [BAI_DINH, false, null],
      [TAM_CHUC, false, null],
    ]);
    expect(passport.stops[0].firstVisitAt).toBe("2026-09-18T01:30:00+00:00");
  });

  it("vào một nơi hai lần vẫn là một nơi, giữ lần sớm nhất", () => {
    const passport = buildTripPassport([
      { siteId: BAI_DINH, scannedAt: "2026-09-18T08:00:00+00:00" },
      { siteId: BAI_DINH, scannedAt: "2026-09-18T03:00:00+00:00" },
      { siteId: BAI_DINH, scannedAt: "2026-09-18T03:00:00+00:00" },
    ]);
    expect(passport.litCount).toBe(1);
    const baiDinh = passport.stops.find((stop) => stop.id === BAI_DINH);
    expect(baiDinh?.firstVisitAt).toBe("2026-09-18T03:00:00+00:00");
    expect(baiDinh?.visitorCount).toBe(1);
  });

  it("lượt vào ở nơi không có trên bản đồ bị bỏ qua, không tính vào số nơi", () => {
    const passport = buildTripPassport([
      { siteId: CO_DO_HOA_LU, scannedAt: "2026-09-18T02:00:00+00:00" },
      { siteId: PHO_CO_HOA_LU, scannedAt: "2026-09-18T02:05:00+00:00" },
      { siteId: TAM_CHUC, scannedAt: "2026-09-18T04:00:00+00:00" },
    ]);
    expect(passport.litCount).toBe(1);
    expect(passport.totalCount).toBe(4);
    expect(passport.stops.map((stop) => stop.id)).not.toContain(CO_DO_HOA_LU);
    expect(passport.stops[0]).toMatchObject({ id: TAM_CHUC, lit: true, visitOrder: 1 });
  });

  it("mã cơ sở lạ và giờ hỏng bị bỏ qua", () => {
    const passport = buildTripPassport([
      { siteId: "99999999-0000-4000-8000-000000000000", scannedAt: "2026-09-18T02:00:00+00:00" },
      { siteId: "", scannedAt: "2026-09-18T02:00:00+00:00" },
      { siteId: TRANG_AN, scannedAt: "không phải giờ" },
      { siteId: TRANG_AN, scannedAt: "" },
    ]);
    expect(passport.litCount).toBe(0);
    expect(passport.stops.every((stop) => !stop.lit)).toBe(true);
  });

  it("giờ hỏng không che lượt vào có giờ đúng ở cùng nơi", () => {
    const passport = buildTripPassport([
      { siteId: TRANG_AN, scannedAt: "hỏng" },
      { siteId: TRANG_AN, scannedAt: "2026-09-18T02:00:00+00:00" },
    ]);
    expect(passport.stops[0]).toMatchObject({ id: TRANG_AN, lit: true, firstVisitAt: "2026-09-18T02:00:00+00:00" });
  });

  it("hai nơi cùng giờ thì giữ thứ tự khai, không để máy tự quyết", () => {
    const passport = buildTripPassport([
      { siteId: TAM_CHUC, scannedAt: "2026-09-18T02:00:00Z" },
      { siteId: TRANG_AN, scannedAt: "2026-09-18T02:00:00Z" },
    ]);
    expect(passport.stops.slice(0, 2).map((stop) => stop.id)).toEqual([TRANG_AN, TAM_CHUC]);
  });

  it("so giờ theo thời điểm thật, không theo chuỗi — hai múi giờ khác nhau vẫn xếp đúng", () => {
    const passport = buildTripPassport([
      // 09:00 giờ Việt Nam
      { siteId: TAM_COC, scannedAt: "2026-09-18T09:00:00+07:00" },
      // 08:30 giờ Việt Nam, nhưng chuỗi UTC "lớn" hơn nếu so như chữ
      { siteId: BAI_DINH, scannedAt: "2026-09-18T01:30:00+00:00" },
    ]);
    expect(passport.stops.slice(0, 2).map((stop) => stop.id)).toEqual([BAI_DINH, TAM_COC]);
  });
});

describe("cả đoàn", () => {
  it("gộp lượt vào của mọi người, đếm người khác nhau ở từng nơi", () => {
    const entries = groupTripPassportEntries([
      { memberCode: "TV-AAAAAAAAAA", entries: [
        { siteId: TRANG_AN, scannedAt: "2026-09-18T02:10:00Z" },
        { siteId: TAM_COC, scannedAt: "2026-09-18T07:00:00Z" },
      ] },
      { memberCode: "TV-BBBBBBBBBB", entries: [{ siteId: TRANG_AN, scannedAt: "2026-09-18T02:05:00Z" }] },
      { memberCode: "TV-CCCCCCCCCC", entries: [] },
    ]);
    const passport = buildTripPassport(entries);
    expect(passport.litCount).toBe(2);
    expect(passport.stops[0]).toMatchObject({
      id: TRANG_AN,
      firstVisitAt: "2026-09-18T02:05:00Z",
      visitorCount: 2,
    });
    expect(passport.stops[1]).toMatchObject({ id: TAM_COC, visitorCount: 1 });
  });
});

describe("nơi vừa sáng", () => {
  it("lần xem đầu không có nơi nào 'vừa sáng'", () => {
    const passport = buildTripPassport([{ siteId: TRANG_AN, scannedAt: "2026-09-18T02:00:00Z" }]);
    expect(newlyLitPlaceIds(null, passport)).toEqual([]);
  });

  it("chỉ nơi mới sáng kể từ lần trước", () => {
    const truoc = buildTripPassport([{ siteId: TRANG_AN, scannedAt: "2026-09-18T02:00:00Z" }]);
    const sau = buildTripPassport([
      { siteId: TRANG_AN, scannedAt: "2026-09-18T02:00:00Z" },
      { siteId: BAI_DINH, scannedAt: "2026-09-18T04:00:00Z" },
    ]);
    expect(newlyLitPlaceIds(litPlaceIds(truoc), sau)).toEqual([BAI_DINH]);
    expect(newlyLitPlaceIds(litPlaceIds(sau), sau)).toEqual([]);
  });
});

describe("giờ Việt Nam", () => {
  it("đổi giờ UTC sang giờ Việt Nam", () => {
    expect(formatVisitMoment("2026-09-18T02:42:00Z", "vi")).toBe("09:42 · 18/09");
    expect(formatVisitMoment("2026-09-18T02:42:00+00:00", "en")).toBe("09:42 · 18 Sep");
  });

  it("qua nửa đêm giờ Việt Nam thì sang ngày hôm sau", () => {
    expect(formatVisitMoment("2026-09-17T17:30:00Z", "vi")).toBe("00:30 · 18/09");
  });

  it("giờ hỏng trả chuỗi rỗng, không in 'Invalid Date' ra mặt khách", () => {
    expect(formatVisitMoment("hỏng", "vi")).toBe("");
  });

  it("ngày đi đọc thẳng từ chuỗi ngày, không lệch theo múi giờ", () => {
    expect(formatVisitDate("2026-09-18", "vi")).toBe("18/09/2026");
    expect(formatVisitDate("2026-09-18", "en")).toBe("18 September 2026");
    expect(formatVisitDate("", "vi")).toBe("");
  });
});
