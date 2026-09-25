import { describe, expect, it } from "vitest";
import { CAC_NHIEM_VU, maUuDai, tinhHoSo } from "@/domain/ho-so-khach";
import { TRIP_PASSPORT_PLACE_IDS } from "@/domain/trip-passport";

const [TRANG_AN, BAI_DINH, TAM_COC, TAM_CHUC] = TRIP_PASSPORT_PLACE_IDS;
const HOA_LU = "10000000-0000-4000-8000-000000000002";

function vao(siteId: string, scannedAt: string) {
  return { siteId, scannedAt };
}

function nv(hoSo: ReturnType<typeof tinhHoSo>, id: string) {
  const tim = hoSo.nhiemVu.find((item) => item.id === id);
  if (!tim) throw new Error(id);
  return tim;
}

describe("hộ chiếu khách", () => {
  it("chưa qua cổng nào thì chưa xong nhiệm vụ nào, chưa có mã quà", () => {
    const hoSo = tinhHoSo({ khoaHoSo: "p1", don: [], luotVao: [] });
    expect(hoSo.soNhiemVuXong).toBe(0);
    expect(hoSo.nhiemVu.every((item) => item.maUuDai === null)).toBe(true);
    expect(hoSo.nhiemVu).toHaveLength(CAC_NHIEM_VU.length);
  });

  it("qua cổng Tràng An rồi Tam Cốc thì xong 'Hai dòng nước'", () => {
    const hoSo = tinhHoSo({
      khoaHoSo: "p1",
      don: [],
      luotVao: [vao(TRANG_AN, "2026-09-20T02:00:00Z"), vao(TAM_COC, "2026-09-20T07:00:00Z")],
    });
    expect(nv(hoSo, "buoc-dau").xong).toBe(true);
    expect(nv(hoSo, "hai-dong-nuoc").xong).toBe(true);
    expect(nv(hoSo, "hai-dong-nuoc").maUuDai).toMatch(/^NBJ-HN[0-9A-Z]{6}$/);
    expect(nv(hoSo, "hai-tieng-chuong")).toMatchObject({ duoc: 0, can: 2, xong: false });
    expect(nv(hoSo, "tron-bon-cua")).toMatchObject({ duoc: 2, can: 4 });
    // Cùng một ngày thì chưa tính là quay lại.
    expect(nv(hoSo, "quay-lai")).toMatchObject({ duoc: 1, xong: false });
  });

  it("đủ bốn cổng trong hai ngày thì xong cả năm nhiệm vụ", () => {
    const hoSo = tinhHoSo({
      khoaHoSo: "p1",
      don: [],
      luotVao: [
        vao(TRANG_AN, "2026-09-20T02:00:00Z"),
        vao(TAM_COC, "2026-09-20T07:00:00Z"),
        vao(BAI_DINH, "2026-09-21T02:00:00Z"),
        vao(TAM_CHUC, "2026-09-21T08:00:00Z"),
      ],
    });
    expect(hoSo.soNhiemVuXong).toBe(5);
    expect(hoSo.soNgayDi).toBe(2);
  });

  it("ngày tính theo giờ Việt Nam, không theo giờ UTC", () => {
    // 23:30 ngày 20 giờ UTC là 06:30 ngày 21 ở Việt Nam; 01:00 ngày 21 UTC
    // cũng là ngày 21. Hai lượt ấy cùng một ngày đi.
    const hoSo = tinhHoSo({
      khoaHoSo: "p1",
      don: [],
      luotVao: [vao(TRANG_AN, "2026-09-20T23:30:00Z"), vao(TAM_COC, "2026-09-21T01:00:00Z")],
    });
    expect(hoSo.soNgayDi).toBe(1);
  });

  it("nơi không có cổng ghi lượt vào thì không tính", () => {
    const hoSo = tinhHoSo({ khoaHoSo: "p1", don: [], luotVao: [vao(HOA_LU, "2026-09-20T02:00:00Z")] });
    expect(hoSo.noiDaDen).toHaveLength(0);
    expect(hoSo.soNhiemVuXong).toBe(0);
  });

  it("vào một nơi nhiều lần: giữ lần đầu, đếm đủ số lượt", () => {
    const hoSo = tinhHoSo({
      khoaHoSo: "p1",
      don: [],
      luotVao: [vao(TRANG_AN, "2026-09-22T02:00:00Z"), vao(TRANG_AN, "2026-09-20T02:00:00Z")],
    });
    expect(hoSo.noiDaDen).toEqual([{ siteId: TRANG_AN, lanDau: "2026-09-20T02:00:00Z", soLan: 2 }]);
  });

  it("mã quà cố định theo hồ sơ, khác nhau giữa hai khách", () => {
    expect(maUuDai("p1", "HN")).toBe(maUuDai("p1", "HN"));
    expect(maUuDai("p1", "HN")).not.toBe(maUuDai("p2", "HN"));
    expect(maUuDai("p1", "HN")).not.toBe(maUuDai("p1", "HC"));
  });
});
