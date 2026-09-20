import { describe, expect, it } from "vitest";

import {
  docGio,
  doSaiSo,
  duBaoChamTran,
  noThanh,
  tocDoGiuCho,
  type ForecastSample,
} from "@/domain/capacity-forecast";

/** Mốc đo đều nhau, mỗi bước thêm `them` chỗ. */
function deu(tuPhut: number, soMoc: number, buoc: number, them: number, batDau = 0): ForecastSample[] {
  return Array.from({ length: soMoc }, (_, i) => ({
    atMinutes: tuPhut + i * buoc,
    taken: batDau + i * them,
  }));
}

describe("TC-11: tốc độ giữ chỗ", () => {
  it("đo trên hai đầu cửa sổ gần nhất", () => {
    // 09:00 → 11:00, thêm 60 chỗ trong 120 phút = 30 chỗ/giờ.
    const samples = deu(540, 3, 60, 30);
    expect(tocDoGiuCho(samples, 660)).toBe(30);
  });

  it("bỏ qua mốc cũ hơn cửa sổ, nên nhịp dồn cuối ngày không bị pha loãng", () => {
    const samples: ForecastSample[] = [
      { atMinutes: 360, taken: 0 },
      { atMinutes: 420, taken: 2 },
      { atMinutes: 600, taken: 10 },
      { atMinutes: 660, taken: 60 },
    ];
    // Cửa sổ 120 phút tính từ 660: chỉ còn mốc 600 và 660 → 50 chỗ/giờ.
    expect(tocDoGiuCho(samples, 660)).toBe(50);
  });

  it("một mốc thì không đo được, trả null chứ không đoán", () => {
    expect(tocDoGiuCho([{ atMinutes: 600, taken: 20 }], 660)).toBeNull();
    expect(tocDoGiuCho([], 660)).toBeNull();
  });
});

describe("TC-11: dự báo giờ chạm trần", () => {
  it("đoán đúng giờ kín khi nhịp giữ chỗ đều", () => {
    // 10:00 đã giữ 60/120, tốc độ 30 chỗ/giờ → còn 60 chỗ → 2 giờ nữa → 12:00.
    const ra = duBaoChamTran({
      capacity: 120,
      samples: deu(480, 3, 60, 30),
      asOfMinutes: 600,
    });
    expect(ra.kind).toBe("du-doan");
    if (ra.kind === "du-doan") {
      expect(docGio(ra.hitAtMinutes)).toBe("12:00");
      expect(ra.remaining).toBe(60);
      expect(ra.perHour).toBe(30);
    }
  });

  it("so với hôm qua khi có số hôm qua", () => {
    const ra = duBaoChamTran({
      capacity: 200,
      samples: deu(480, 3, 60, 30),
      asOfMinutes: 600,
      perHourYesterday: 15,
    });
    expect(ra.kind === "du-doan" && ra.versusYesterday).toBe(2);
  });

  it("ít chỗ đã giữ thì nói thẳng là chưa đoán được", () => {
    const ra = duBaoChamTran({
      capacity: 120,
      samples: [
        { atMinutes: 540, taken: 1 },
        { atMinutes: 600, taken: 3 },
      ],
      asOfMinutes: 600,
    });
    expect(ra).toEqual({ kind: "chua-du-du-lieu", vi_sao: "chua-du-cho-giu" });
  });

  it("chỉ một mốc trong cửa sổ thì cũng nói thẳng", () => {
    const ra = duBaoChamTran({
      capacity: 120,
      samples: [{ atMinutes: 600, taken: 80 }],
      asOfMinutes: 600,
    });
    expect(ra).toEqual({ kind: "chua-du-du-lieu", vi_sao: "chua-du-moc" });
  });

  it("hai giờ qua không ai giữ thêm thì không bịa ra một giờ kín", () => {
    const ra = duBaoChamTran({
      capacity: 120,
      samples: [
        { atMinutes: 540, taken: 40 },
        { atMinutes: 600, taken: 40 },
      ],
      asOfMinutes: 600,
    });
    expect(ra).toEqual({ kind: "chua-du-du-lieu", vi_sao: "chua-nhuc-nhich" });
  });

  it("nhịp chậm tới mức quá cuối ngày thì nói là hôm nay không kín", () => {
    // 10:00, còn 300 chỗ, 10 chỗ/giờ → 30 giờ nữa, quá 21:00.
    const ra = duBaoChamTran({
      capacity: 320,
      samples: [
        { atMinutes: 540, taken: 10 },
        { atMinutes: 600, taken: 20 },
      ],
      asOfMinutes: 600,
    });
    expect(ra.kind).toBe("khong-cham-tran");
  });

  it("đã kín thì không đoán nữa", () => {
    const ra = duBaoChamTran({
      capacity: 100,
      samples: [
        { atMinutes: 540, taken: 80 },
        { atMinutes: 600, taken: 100 },
      ],
      asOfMinutes: 600,
    });
    expect(ra).toEqual({ kind: "da-kin" });
  });
});

describe("TC-11: sai số phải ghi ra, không giấu", () => {
  it("đoán muộn hơn thực tế thì nói muộn, kèm số phút", () => {
    const forecast = duBaoChamTran({ capacity: 120, samples: deu(480, 3, 60, 30), asOfMinutes: 600 });
    // Đoán 12:00. Thực tế kín lúc 11:30 → dự báo nói MUỘN hơn thực tế 30 phút.
    expect(doSaiSo({ forecast, thucTeHitAtMinutes: 690 })).toEqual({ lechPhut: 30, huong: "muon-hon" });
    // Thực tế kín lúc 12:30 → dự báo nói SỚM hơn 30 phút.
    expect(doSaiSo({ forecast, thucTeHitAtMinutes: 750 })).toEqual({ lechPhut: 30, huong: "som-hon" });
  });

  it("hôm ấy không kín, hoặc lúc ấy không đoán, thì không so", () => {
    const forecast = duBaoChamTran({ capacity: 120, samples: deu(480, 3, 60, 30), asOfMinutes: 600 });
    expect(doSaiSo({ forecast, thucTeHitAtMinutes: null })).toBeNull();
    expect(
      doSaiSo({ forecast: { kind: "chua-du-du-lieu", vi_sao: "chua-du-moc" }, thucTeHitAtMinutes: 600 }),
    ).toBeNull();
  });
});

describe("TC-11: câu nói cho người vận hành", () => {
  const cam = ["%", "phần trăm", "ngưỡng", "threshold", "phiên bản"];

  it("không lộ phần trăm tải, tên ngưỡng hay số phiên bản", () => {
    const cacTruongHop = [
      duBaoChamTran({ capacity: 120, samples: deu(480, 3, 60, 30), asOfMinutes: 600 }),
      duBaoChamTran({ capacity: 320, samples: [{ atMinutes: 540, taken: 10 }, { atMinutes: 600, taken: 20 }], asOfMinutes: 600 }),
      duBaoChamTran({ capacity: 120, samples: [{ atMinutes: 600, taken: 80 }], asOfMinutes: 600 }),
      { kind: "da-kin" as const },
    ];
    for (const truongHop of cacTruongHop) {
      const cau = noThanh(truongHop, "Tràng An").toLowerCase();
      for (const tu of cam) expect(cau).not.toContain(tu);
    }
  });

  it("câu đoán có đủ tên nơi, giờ kín và số chỗ còn lại", () => {
    const cau = noThanh(
      duBaoChamTran({ capacity: 120, samples: deu(480, 3, 60, 30), asOfMinutes: 600, perHourYesterday: 15 }),
      "Tràng An",
    );
    expect(cau).toContain("Tràng An");
    expect(cau).toContain("12:00");
    expect(cau).toContain("60 chỗ");
    expect(cau).toContain("gấp 2,0 hôm qua");
  });

  it("chưa đoán được thì nói rõ vì sao, không nói lấp lửng", () => {
    const cau = noThanh({ kind: "chua-du-du-lieu", vi_sao: "chua-du-cho-giu" }, "Bái Đính");
    expect(cau).toContain("chưa đoán được giờ kín");
    expect(cau).toContain("ít lượt giữ chỗ");
  });
});
