import { describe, expect, it } from "vitest";
import {
  docDuBaoOpenMeteo,
  duongDanOpenMeteo,
  gioHienTaiVN,
  mucCuaGio,
  nguyCoCuaGio,
  phanTichThoiTiet,
  type GioDuBao,
} from "@/domain/thoi-tiet-ben";

const binhThuong = (gio: string, them: Partial<GioDuBao> = {}): GioDuBao => ({
  gio,
  nhietDo: 28,
  mua: 0,
  khaNangMua: 10,
  maThoiTiet: 2,
  gioGiat: 15,
  ...them,
});

const ngay = (h: number) => `2026-10-05T${String(h).padStart(2, "0")}:00`;
const luc = (h: number, phut = 20) => new Date(`2026-10-05T${String(h).padStart(2, "0")}:${phut}:00+07:00`);

describe("ngưỡng từng giờ", () => {
  it("dông, mưa to, gió cấp 7 là cân nhắc tạm dừng", () => {
    expect(mucCuaGio(binhThuong(ngay(9), { maThoiTiet: 95 }))).toBe("tam-dung");
    expect(mucCuaGio(binhThuong(ngay(9), { mua: 7.6 }))).toBe("tam-dung");
    expect(mucCuaGio(binhThuong(ngay(9), { gioGiat: 50 }))).toBe("tam-dung");
  });

  it("mưa vừa, gió cấp 6, sương mù, nắng nóng chỉ là lưu ý", () => {
    expect(mucCuaGio(binhThuong(ngay(9), { mua: 2.5 }))).toBe("luu-y");
    expect(mucCuaGio(binhThuong(ngay(9), { gioGiat: 39 }))).toBe("luu-y");
    expect(mucCuaGio(binhThuong(ngay(6), { maThoiTiet: 45 }))).toBe("luu-y");
    expect(mucCuaGio(binhThuong(ngay(13), { nhietDo: 35 }))).toBe("luu-y");
    expect(mucCuaGio(binhThuong(ngay(13), { mua: 2.4, gioGiat: 38, nhietDo: 34.9 }))).toBe("binh-thuong");
  });

  it("mỗi nhóm chỉ lấy mức nặng nhất, nặng xếp trước", () => {
    expect(nguyCoCuaGio(binhThuong(ngay(15), { maThoiTiet: 95, mua: 12, gioGiat: 45, nhietDo: 37 }))).toEqual([
      "dong",
      "mua-to",
      "gio-giat",
      "nang-nong-gay-gat",
    ]);
  });
});

describe("chỉ xét giờ thuyền chạy", () => {
  // Hai ngày: mưa to 14–15 giờ, mưa vừa 16 giờ, sương mù 6 giờ sáng, dông lúc nửa đêm.
  const ca = Array.from({ length: 48 }, (_, i) => {
    const h = i % 24;
    const d = i < 24 ? "2026-10-05" : "2026-10-06";
    const them: Partial<GioDuBao> =
      h >= 14 && h <= 16 ? { mua: 9.2 - (h - 14) } : h === 6 ? { maThoiTiet: 45 } : h === 0 ? { maThoiTiet: 95, mua: 12 } : {};
    return binhThuong(`${d}T${String(h).padStart(2, "0")}:00`, them);
  });

  it("trong giờ chạy: từ giờ hiện tại tới ô 17:00", () => {
    const bc = phanTichThoiTiet(ca, luc(8));
    expect(bc.khung.nhan).toBe("từ giờ tới 18:00");
    expect(bc.cacGio[0].gio).toBe(ngay(8));
    expect(bc.cacGio.at(-1)?.gio).toBe(ngay(17));
    expect(gioHienTaiVN(new Date("2026-10-05T01:59:00Z"))).toBe(ngay(8));
  });

  it("gộp các giờ liền nhau thành một khoảng, ghi số đo nặng nhất", () => {
    const bc = phanTichThoiTiet(ca, luc(8));
    expect(bc.muc).toBe("tam-dung");
    const muaTo = bc.cacKhoang.find((k) => k.loai === "mua-to")!;
    expect(muaTo).toMatchObject({ tu: ngay(14), den: ngay(15), muc: "tam-dung" });
    expect(muaTo.dinh).toBe("tới 9,2 mm/giờ");
    expect(bc.cacKhoang.find((k) => k.loai === "mua-vua")).toMatchObject({ tu: ngay(16), den: ngay(16) });
    expect(bc.cacKhoang.some((k) => k.loai === "suong-mu")).toBe(false);
  });

  it("dông lúc nửa đêm không làm bến phải dừng", () => {
    expect(phanTichThoiTiet(ca, luc(17)).muc).toBe("binh-thuong");
    expect(phanTichThoiTiet(ca, luc(17)).cacKhoang.some((k) => k.loai === "dong")).toBe(false);
  });

  it("sau 17:30 thì xem trọn ngày mai, trước 6:00 thì xem trọn hôm nay", () => {
    const toi = phanTichThoiTiet(ca, luc(21));
    expect(toi.khung).toMatchObject({ tu: "2026-10-06T06:00", den: "2026-10-06T17:00", nhan: "ngày mai, giờ thuyền chạy" });
    expect(toi.cacGio).toHaveLength(12);
    expect(toi.cacKhoang[0]).toMatchObject({ loai: "suong-mu", tu: "2026-10-06T06:00" });
    const sang = phanTichThoiTiet(ca, luc(4));
    expect(sang.khung).toMatchObject({ tu: ngay(6), den: ngay(17), nhan: "hôm nay, giờ thuyền chạy" });
    expect(phanTichThoiTiet(ca, luc(17, 40)).khung.tu).toBe("2026-10-06T06:00");
  });
});

describe("đọc dự báo Open-Meteo", () => {
  it("đọc đúng các cột theo giờ, bỏ giờ thiếu số", () => {
    const gio = docDuBaoOpenMeteo({
      hourly: {
        time: ["2026-10-05T08:00", "2026-10-05T09:00"],
        temperature_2m: [27.4, null],
        precipitation: [0.3, 0],
        precipitation_probability: [40, 20],
        weather_code: [61, 3],
        wind_gusts_10m: [22.1, 18],
      },
    });
    expect(gio).toEqual([{ gio: ngay(8), nhietDo: 27.4, mua: 0.3, khaNangMua: 40, maThoiTiet: 61, gioGiat: 22.1 }]);
  });

  it("thiếu cột hay phản hồi lạ thì trả null, không đoán", () => {
    expect(docDuBaoOpenMeteo(null)).toBeNull();
    expect(docDuBaoOpenMeteo({ error: true, reason: "x" })).toBeNull();
    expect(docDuBaoOpenMeteo({ hourly: { time: ["2026-10-05T08:00"] } })).toBeNull();
  });

  it("hỏi đúng toạ độ bến và múi giờ +7", () => {
    const url = new URL(duongDanOpenMeteo("tam-coc"));
    expect(url.searchParams.get("latitude")).toBe("20.2166");
    expect(url.searchParams.get("timezone")).toBe("Asia/Bangkok");
    expect(url.searchParams.get("hourly")).toContain("wind_gusts_10m");
  });
});
