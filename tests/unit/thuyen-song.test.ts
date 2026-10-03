import { describe, expect, it } from "vitest";
import {
  diemTaiQuang,
  docChuyenTrenSong,
  docChuyenTuApi,
  doDaiTuyen,
  khoangCachMet,
  thuyenMoPhong,
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

const LUC = Date.parse("2026-10-03T08:30:00+07:00");

describe("thuyền mô phỏng", () => {
  for (const coSo of ["trang-an", "tam-coc"] as const) {
    it(`${coSo}: có thuyền trên sông, và thuyền nào cũng nằm đúng trên tuyến sông thật`, () => {
      const ds = thuyenMoPhong(coSo, LUC);
      expect(ds.length).toBeGreaterThan(5);
      for (const t of ds) {
        expect(t.moPhong).toBe(true);
        expect(cachTuyen(coSo, t.lonLat)).toBeLessThan(6);
      }
    });

    it(`${coSo}: di chuyển liên tục, một giây chỉ nhích vài mét, không nhảy cóc`, () => {
      const truoc = new Map(thuyenMoPhong(coSo, LUC).map((t) => [t.id, t]));
      const sau = thuyenMoPhong(coSo, LUC + 1000);
      let coDi = 0;
      for (const t of sau) {
        const cu = truoc.get(t.id);
        if (!cu) continue;
        const d = khoangCachMet(cu.lonLat, t.lonLat);
        expect(d).toBeLessThan(5);
        if (d > 0.05) coDi++;
      }
      expect(coDi).toBeGreaterThan(0);
    });
  }

  it("ai mở bản đồ lúc nào cũng thấy cùng một đội thuyền ở cùng chỗ", () => {
    expect(thuyenMoPhong("trang-an", LUC)).toEqual(thuyenMoPhong("trang-an", LUC));
  });

  it("Tam Cốc là tuyến khứ hồi: có thuyền đang về bến", () => {
    const ds = thuyenMoPhong("tam-coc", LUC);
    expect(ds.some((t) => t.ghiChu === "Đang về bến")).toBe(true);
  });

  it("Tràng An có thuyền đang nghỉ cho khách lên đền", () => {
    const coNghi = Array.from({ length: 30 }, (_, i) => thuyenMoPhong("trang-an", LUC + i * 60_000)).some((ds) =>
      ds.some((t) => t.ghiChu.startsWith("Khách đang lên")),
    );
    expect(coNghi).toBe(true);
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
