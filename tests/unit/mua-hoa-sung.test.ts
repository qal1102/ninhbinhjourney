import { describe, expect, it } from "vitest";
import { getPackageBySlug } from "@/content/packages";
import { goiDaHetMua, khungBanGoi, ngayTrongMuaBan } from "@/content/packages-en";
import { CONG_NGHE_DE_XUAT, lichCacNamToi } from "@/domain/ke-hoach-tuong-lai";
import { CAC_DIP, doChacChan, lichMuaVu, ngayCuaDipTrongNam } from "@/domain/lich-mua-vu";
import { cacMuaToi, doNoHoa, khungBanHoaSung, tinhTrangHoaSung } from "@/domain/mua-hoa-sung";

const luc = (iso: string) => new Date(`${iso}T09:00:00+07:00`);
const dip = (id: string) => CAC_DIP.find((d) => d.id === id)!;

describe("lễ Sắc Hồng: ngày đã công bố và ngày dự kiến", () => {
  it("2025 dùng đúng ngày ban tổ chức công bố", () => {
    expect(ngayCuaDipTrongNam(dip("sac-hong-tam-coc"), 2025)).toEqual({ batDau: "2025-11-22", ketThuc: "2025-11-23" });
    expect(doChacChan(dip("sac-hong-tam-coc"), 2025)).toBe("da-cong-bo");
  });

  it("năm chưa công bố: cuối tuần gần 22/11 nhất, ghi là dự kiến", () => {
    for (const [nam, tu] of [[2026, "2026-11-21"], [2027, "2027-11-20"], [2028, "2028-11-25"]] as const) {
      const ngay = ngayCuaDipTrongNam(dip("sac-hong-tam-coc"), nam)!;
      expect(ngay.batDau).toBe(tu);
      expect(new Date(`${ngay.batDau}T12:00:00+07:00`).getUTCDay()).toBe(6);
      expect(doChacChan(dip("sac-hong-tam-coc"), nam)).toBe("du-kien");
    }
  });

  it("Lịch mùa vụ mười hai tháng có mùa hoa súng, lễ Sắc Hồng và cuối tuần Halloween", () => {
    const lich = lichMuaVu(luc("2026-10-04"));
    const sacHong = lich.find((d) => d.dip.id === "sac-hong-tam-coc")!;
    expect(sacHong.chacChan).toBe("du-kien");
    expect(lich.find((d) => d.dip.id === "cuoi-tuan-halloween")?.dip.loai).toBe("chien-dich");
    expect(lich.find((d) => d.dip.id === "mua-hoa-sung-tam-coc")?.trangThai).toBe("toi-luc-chuan-bi");
  });
});

describe("mùa hoa súng tự chạy cho mọi năm", () => {
  it("trước mùa: đếm ngày tới mùa của năm nay", () => {
    const t = tinhTrangHoaSung(luc("2026-10-04"));
    expect(t.giaiDoan).toBe("sap-toi");
    expect(t.mua.nam).toBe(2026);
    expect(t.ngayToiMua).toBe(21);
  });

  it("đang mùa, đúng ngày lễ, cuối mùa", () => {
    expect(tinhTrangHoaSung(luc("2026-11-02")).giaiDoan).toBe("dang-no");
    expect(tinhTrangHoaSung(luc("2026-11-21")).giaiDoan).toBe("le-hoi");
    expect(tinhTrangHoaSung(luc("2026-12-01")).giaiDoan).toBe("cuoi-mua");
  });

  it("qua hết mùa thì nhìn sang mùa năm sau, không nói về mùa đã khép", () => {
    const t = tinhTrangHoaSung(luc("2026-12-20"));
    expect(t.mua.nam).toBe(2027);
    expect(t.giaiDoan).toBe("sap-toi");
    expect(cacMuaToi(luc("2026-12-20"), 3).map((m) => m.nam)).toEqual([2027, 2028, 2029]);
  });

  it("hoa mở trọn 7:15–9:45, cụp hẳn trước 6:30 và sau 10:30", () => {
    expect(doNoHoa(6)).toBe(0);
    expect(doNoHoa(8)).toBe(1);
    expect(doNoHoa(7)).toBeGreaterThan(0);
    expect(doNoHoa(7)).toBeLessThan(1);
    expect(doNoHoa(11)).toBe(0);
  });
});

describe("gói Đò sớm mùa hoa súng", () => {
  const goi = getPackageBySlug("do-som-mua-hoa-sung")!;

  it("khung bán theo mùa: trước mùa mở từ ngày mở mùa, trong mùa từ hôm nay", () => {
    expect(khungBanHoaSung(luc("2026-10-04"))).toEqual({ tu: "2026-10-25", den: "2026-12-15" });
    expect(khungBanGoi(goi, luc("2026-11-10"))).toEqual({ tu: "2026-11-10", den: "2026-12-15" });
    expect(goiDaHetMua(goi, luc("2026-12-20"))).toBe(false);
  });

  it("chỉ nhận ngày đi trong mùa, năm nào cũng vậy", () => {
    expect(ngayTrongMuaBan(goi, "2026-11-21")).toBe(true);
    expect(ngayTrongMuaBan(goi, "2026-10-10")).toBe(false);
    expect(ngayTrongMuaBan(goi, "2027-12-01")).toBe(true);
    expect(ngayTrongMuaBan(goi, "2027-12-31")).toBe(false);
  });

  it("gói một lần (Bàn Trăng 2026) và gói thường giữ cách cũ", () => {
    const banTrang = getPackageBySlug("ban-trang-tam-coc-2026")!;
    expect(ngayTrongMuaBan(banTrang, "2026-09-20")).toBe(true);
    expect(ngayTrongMuaBan(banTrang, "2026-10-20")).toBe(false);
    expect(ngayTrongMuaBan(getPackageBySlug("slow-ninh-binh")!, "2030-01-01")).toBe(true);
  });
});

describe("Future planning", () => {
  it("ba năm, mỗi năm đủ mọi dịp, ngày nằm đúng năm", () => {
    const cacNam = lichCacNamToi(luc("2026-10-04"), 3);
    expect(cacNam.map((n) => n.nam)).toEqual([2026, 2027, 2028]);
    for (const n of cacNam) {
      expect(n.suKien.length).toBe(CAC_DIP.length);
      for (const s of n.suKien) expect(s.batDau.startsWith(String(n.nam))).toBe(true);
    }
    const tet2027 = cacNam[1].suKien.find((s) => s.dip.id === "tet-nguyen-dan")!;
    expect(tet2027.chacChan).toBe("theo-lich");
    expect(cacNam[0].suKien.find((s) => s.dip.id === "trung-thu")?.trangThai).toBe("da-qua");
  });

  it("đề xuất công nghệ không có cổng thanh toán thật hay dịch vụ gửi tin", () => {
    for (const c of CONG_NGHE_DE_XUAT) {
      expect(`${c.ten} ${c.giaiQuyet} ${c.canGi}`).not.toMatch(/cổng thanh toán|VNPay|MoMo|Zalo|SMS|gửi tin/i);
    }
  });
});
