import { describe, expect, it } from "vitest";
import {
  ganNguoiCheo,
  diemTaiQuang,
  docChuyenTrenSong,
  docChuyenTuApi,
  doDaiTuyen,
  khoangCachMet,
  bangBen,
  chuyenTuLuotVao,
  docBenTuApi,
  ngayNenXem,
  PHUT_TU_CONG_TOI_BEN,
  thuyenLucNay,
  thuyenTuLuotVao,
  trongGioChay,
  TUYEN_THUYEN,
  viTriNoiSuy,
  type CoSoThuyen,
} from "@/domain/thuyen-song";
import type { DiemLonLat } from "@/domain/thuyen-duong-song";

function cachTuyen(coSo: CoSoThuyen, p: DiemLonLat) {
  // Khoảng cách tới đoạn tuyến gần nhất, đo thô bằng cách lấy mẫu dày dọc tuyến.
  const tuyen = TUYEN_THUYEN[coSo];
  const dai = doDaiTuyen(tuyen);
  let min = Infinity;
  for (let m = 0; m <= dai; m += 5) min = Math.min(min, khoangCachMet(diemTaiQuang(tuyen, m).lonLat, p));
  return min;
}

const LUC = Date.parse("2026-10-03T10:30:00+07:00");
const PHUT = 60_000;
const DOI = { soThuyen: 600, choMoiThuyen: 4, phutMotVong: 180, nguon: "ước tính", loaiNguon: "estimate" } as const;

/** n lượt qua cổng dồn trong khoảng phút [tu, den] trước LUC. */
function luot(n: number, phutTruocTu: number, phutTruocDen = phutTruocTu) {
  return Array.from({ length: n }, (_, i) => LUC - (phutTruocTu - ((phutTruocTu - phutTruocDen) * i) / Math.max(1, n - 1)) * PHUT);
}

describe("thuyền ước tính từ lượt qua cổng", () => {
  for (const coSo of ["trang-an", "tam-coc"] as const) {
    it(`${coSo}: thuyền nào cũng nằm đúng trên tuyến sông thật`, () => {
      const luotVao = Array.from({ length: 30 }, (_, i) => luot(4, 20 + i * 3)).flat();
      const { trenSong } = thuyenTuLuotVao(coSo, luotVao, LUC, 4);
      expect(trenSong.length).toBeGreaterThan(5);
      for (const t of trenSong) expect(cachTuyen(coSo, t.lonLat)).toBeLessThan(6);
    });

    it(`${coSo}: di chuyển liên tục, một giây chỉ nhích vài mét`, () => {
      const luotVao = Array.from({ length: 20 }, (_, i) => luot(4, 15 + i * 4)).flat();
      const truoc = new Map(thuyenTuLuotVao(coSo, luotVao, LUC, 4).trenSong.map((t) => [t.id, t]));
      let coDi = 0;
      for (const t of thuyenTuLuotVao(coSo, luotVao, LUC + 1000, 4).trenSong) {
        const cu = truoc.get(t.id);
        if (!cu) continue;
        const d = khoangCachMet(cu.lonLat, t.lonLat);
        expect(d).toBeLessThan(5);
        if (d > 0.05) coDi++;
      }
      expect(coDi).toBeGreaterThan(0);
    });
  }

  it("đủ chỗ thì sang thuyền mới: 9 khách sát nhau, thuyền 4 chỗ là 3 thuyền", () => {
    const { trenSong } = thuyenTuLuotVao("trang-an", luot(9, 40, 39), LUC, 4);
    expect(trenSong.map((t) => t.soKhach)).toEqual([4, 4, 1]);
  });

  it("hai nhóm cách nhau quá 4 phút thì không chung thuyền", () => {
    const { trenSong } = thuyenTuLuotVao("trang-an", [...luot(1, 50), ...luot(1, 44)], LUC, 4);
    expect(trenSong).toHaveLength(2);
  });

  it(`khách vừa qua cổng chưa tới ${PHUT_TU_CONG_TOI_BEN} phút thì còn ở bến, chưa trên sông`, () => {
    const luotVao = luot(3, 2);
    const kq = thuyenTuLuotVao("trang-an", luotVao, LUC, 4);
    expect(kq.trenSong).toHaveLength(0);
    const bang = bangBen({ doi: DOI, chuyen: kq.chuyen, luotVao, soThuyenCoDinhVi: 0, bayGioMs: LUC });
    expect(bang.khachXuongBen).toBe(3);
    expect(bang.daRoiBen).toBe(0);
  });

  it("thuyền đi trọn chuyến rồi thì về bến, không còn trên sông", () => {
    const luotVao = luot(4, 300);
    const kq = thuyenTuLuotVao("trang-an", luotVao, LUC, 4);
    expect(kq.trenSong).toHaveLength(0);
    const bang = bangBen({ doi: DOI, chuyen: kq.chuyen, luotVao, soThuyenCoDinhVi: 0, bayGioMs: LUC });
    expect(bang.daRoiBen).toBe(1);
    expect(bang.trenSong).toBe(0);
  });

  it("ai mở lúc nào cũng thấy cùng một đội thuyền ở cùng chỗ", () => {
    const luotVao = luot(12, 60, 20);
    expect(thuyenTuLuotVao("tam-coc", luotVao, LUC, 4)).toEqual(thuyenTuLuotVao("tam-coc", luotVao, LUC, 4));
  });

  it("thêm lượt qua cổng mới không làm thuyền đã rời bến đổi chỗ", () => {
    const cu = luot(20, 90, 30);
    const truoc = thuyenTuLuotVao("trang-an", cu, LUC, 4).trenSong;
    const sau = thuyenTuLuotVao("trang-an", [...cu, ...luot(6, 1, 0)], LUC, 4).trenSong;
    expect(sau).toEqual(truoc);
  });

  it("thời gian một vòng đọc từ màn Sức chứa: vòng ngắn hơn thì thuyền về bến sớm hơn", () => {
    // Rời bến 112 phút trước: vòng 180 phút thì còn trên sông, vòng 90 phút thì đã về.
    const luotVao = luot(4, 120);
    const dai = chuyenTuLuotVao("trang-an", luotVao, 4, 180);
    const ngan = chuyenTuLuotVao("trang-an", luotVao, 4, 90);
    expect(thuyenLucNay("trang-an", dai, LUC, 180)).toHaveLength(1);
    expect(thuyenLucNay("trang-an", ngan, LUC, 90)).toHaveLength(0);
  });

  it("bảng bến: còn ở bến là đội thuyền trừ số trên sông, cộng cả thuyền có định vị", () => {
    const luotVao = Array.from({ length: 10 }, (_, i) => luot(4, 20 + i * 5)).flat();
    const kq = thuyenTuLuotVao("trang-an", luotVao, LUC, 4);
    const bang = bangBen({ doi: DOI, chuyen: kq.chuyen, luotVao, soThuyenCoDinhVi: 1, bayGioMs: LUC });
    expect(bang.trenSong).toBe(kq.trenSong.length + 1);
    expect(bang.oBen).toBe(600 - bang.trenSong);
    expect(bang.khachQuaCong).toBe(40);
    expect(bang.daRoiBen).toBe(10);
    expect(bang.roiBen30Phut).toBeGreaterThan(0);
  });

  it("giờ chạy thuyền theo giờ Ninh Bình", () => {
    expect(trongGioChay(Date.parse("2026-10-03T10:00:00+07:00"))).toBe(true);
    expect(trongGioChay(Date.parse("2026-10-03T02:00:00+07:00"))).toBe(false);
    expect(trongGioChay(Date.parse("2026-10-03T18:00:00+07:00"))).toBe(false);
  });

  it("trước giờ thuyền chạy buổi sáng thì xem lại hôm qua, còn lại xem hôm nay", () => {
    expect(ngayNenXem(Date.parse("2026-10-04T02:35:00+07:00"))).toBe("2026-10-03");
    expect(ngayNenXem(Date.parse("2026-10-04T06:30:00+07:00"))).toBe("2026-10-04");
    expect(ngayNenXem(Date.parse("2026-10-04T23:50:00+07:00"))).toBe("2026-10-04");
    expect(ngayNenXem(Date.parse("2026-10-01T01:00:00+07:00"))).toBe("2026-09-30");
  });

  it("đọc phần bến API trả: bỏ số hỏng, đội thuyền thiếu số thì để trống", () => {
    const ben = docBenTuApi({ ngay: "2026-10-04", doi: { soThuyen: 600, choMoiThuyen: 4, phutMotVong: 180, nguon: "x", loaiNguon: "estimate" }, luotVao: [1, "2", null, 3] });
    expect(ben?.luotVao).toEqual([1, 3]);
    expect(ben?.doi?.soThuyen).toBe(600);
    expect(docBenTuApi({ ngay: "2026-10-04", doi: { soThuyen: 0 }, luotVao: [] })?.doi).toBeNull();
    expect(docBenTuApi({ ngay: "hom-nay" })).toBeNull();
  });
});

describe("thuyền thật", () => {
  const vet = [
    { lonLat: [105.918, 20.2533] as const, luc: 1000, doChinhXac: 8 },
    { lonLat: [105.917, 20.2543] as const, luc: 6000, doChinhXac: 8 },
  ];

  it("nội suy giữa hai lần điện thoại báo vị trí, nên thuyền trượt đều", () => {
    const giua = viTriNoiSuy(vet, 3500)!;
    expect(giua.lonLat[0]).toBeCloseTo(105.9175, 6);
    expect(giua.lonLat[1]).toBeCloseTo(20.2538, 6);
  });

  it("quá điểm cuối thì đứng ở điểm cuối, không đoán đường đi tiếp", () => {
    expect(viTriNoiSuy(vet, 99_000)!.lonLat).toEqual(vet[1].lonLat);
    expect(viTriNoiSuy([], 1)).toBeNull();
  });

  it("đọc dữ liệu kho, bỏ điểm hỏng, xếp vệt theo thời gian", () => {
    const [c] = docChuyenTrenSong([
      {
        id: "c1",
        so_thuyen: "TA-128",
        so_khach: 4,
        bat_dau: "2026-10-03T07:00:00+07:00",
        nguoi_cheo: "Đỗ Thị Lan",
        vet: [
          { lat: 20.2536, lng: 105.9177, luc: "2026-10-03T07:01:00+07:00" },
          { lat: "hong", lng: 105, luc: "x" },
          { lat: 20.2533, lng: 105.918, luc: "2026-10-03T07:00:30+07:00", do_chinh_xac: 6 },
        ],
      },
      { so_thuyen: "thieu id" },
    ]);
    expect(c.vet.map((p) => p.lonLat)).toEqual([
      [105.918, 20.2533],
      [105.9177, 20.2536],
    ]);
    expect(c.nguoiCheo).toBe("Đỗ Thị Lan");
    expect(docChuyenTrenSong(null)).toEqual([]);
  });

  it("bản đồ đọc lại được đúng thứ API trả (đã chuẩn hoá), không đọc nhầm theo tên cột kho", () => {
    // Lượt thử production đầu tiên: API trả camelCase, bản đồ đọc theo so_thuyen nên mất sạch thuyền thật.
    const tuKho = docChuyenTrenSong([
      { id: "c1", so_thuyen: "THU-02", so_khach: 2, bat_dau: "2026-10-03T07:00:00Z", nguoi_cheo: "A", vet: [{ lat: 20.2533, lng: 105.918, luc: "2026-10-03T07:00:05Z" }] },
    ]);
    const quaApi = docChuyenTuApi(JSON.parse(JSON.stringify(tuKho)));
    expect(quaApi).toEqual(tuKho);
    expect(quaApi).toHaveLength(1);
  });
});

describe("sổ người chèo: gán theo lượt gọi xoay vòng", () => {
  const nguoi = (so: string) => ({ id: `n-${so}`, soThuyen: so, hoTen: `Người ${so}`, soDienThoai: null, laMau: true });
  const chuyen = (id: string, roi: number, ve: number) => ({ id, soKhach: 2, roiBenLuc: roi, veBenLuc: ve, heSo: 1 });
  const PHUT = 60_000;

  it("người đứng đầu hàng nhận thuyền, về bến xong mới quay lại cuối hàng", () => {
    const so = [nguoi("2"), nguoi("10"), nguoi("1")];
    const ds = [
      chuyen("a", 0, 120 * PHUT),
      chuyen("b", 5 * PHUT, 125 * PHUT),
      chuyen("c", 10 * PHUT, 130 * PHUT),
      chuyen("d", 15 * PHUT, 135 * PHUT),
      chuyen("e", 121 * PHUT, 241 * PHUT),
    ];
    const gan = ganNguoiCheo(ds, so);
    // Sổ xếp theo số thuyền như số (1, 2, 10), không theo chữ.
    expect(gan.get("a")?.soThuyen).toBe("1");
    expect(gan.get("b")?.soThuyen).toBe("2");
    expect(gan.get("c")?.soThuyen).toBe("10");
    // Cả ba đang trên sông: chuyến thứ tư không có ai rảnh, không đoán.
    expect(gan.has("d")).toBe(false);
    // Người 1 về bến lúc 120 phút, nhận chuyến rời lúc 121.
    expect(gan.get("e")?.soThuyen).toBe("1");
  });

  it("một người không bao giờ chèo hai thuyền cùng lúc", () => {
    const so = Array.from({ length: 5 }, (_, i) => nguoi(String(i + 1)));
    const ds = Array.from({ length: 60 }, (_, i) => chuyen(`c${i}`, i * 7 * PHUT, i * 7 * PHUT + 100 * PHUT));
    const gan = ganNguoiCheo(ds, so);
    for (const x of ds) {
      for (const y of ds) {
        if (x.id >= y.id) continue;
        const chong = x.roiBenLuc < y.veBenLuc && y.roiBenLuc < x.veBenLuc;
        if (chong && gan.has(x.id) && gan.has(y.id)) expect(gan.get(x.id)!.id).not.toBe(gan.get(y.id)!.id);
      }
    }
  });

  it("sổ trống thì không chuyến nào có người chèo", () => {
    expect(ganNguoiCheo([chuyen("a", 0, PHUT)], []).size).toBe(0);
  });
});
