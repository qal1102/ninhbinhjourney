import { describe, expect, it } from "vitest";
import { diemTaiQuang, doDaiTuyen, TUYEN_THUYEN, uocPhutVeBen } from "@/domain/thuyen-song";

const tamCoc = TUYEN_THUYEN["tam-coc"];
const trangAn = TUYEN_THUYEN["trang-an"];

describe("ước giờ về bến cho thuyền có định vị", () => {
  // Tam Cốc: 120 phút, nghỉ 8 phút ở Hang Ba, nên đi 56 phút, nghỉ 8, về 56.
  const giua = diemTaiQuang(tamCoc, doDaiTuyen(tamCoc) / 2).lonLat;

  it("Tam Cốc cùng một điểm: lượt đi còn xa, lượt về đã gần", () => {
    const di = uocPhutVeBen("tam-coc", giua, 28)!;
    const ve = uocPhutVeBen("tam-coc", giua, 92)!;
    expect(di.phutConLai).toBeGreaterThan(88);
    expect(di.phutConLai).toBeLessThan(96);
    expect(ve.phutConLai).toBeGreaterThan(24);
    expect(ve.phutConLai).toBeLessThan(32);
    expect(di.lechTuyenMet).toBeLessThan(5);
  });

  it("thuyền chậm hơn lịch thì giờ về lùi theo chỗ thuyền đang thật sự ở", () => {
    const motPhanTu = diemTaiQuang(tamCoc, doDaiTuyen(tamCoc) / 4).lonLat;
    const dungLich = uocPhutVeBen("tam-coc", motPhanTu, 14)!;
    const cham = uocPhutVeBen("tam-coc", motPhanTu, 40)!;
    // Cùng chỗ, cùng lượt đi: phần còn lại như nhau, nên chậm 26 phút thì về muộn 26 phút.
    expect(Math.abs(cham.phutConLai - dungLich.phutConLai)).toBeLessThan(1);
    expect(40 + cham.phutConLai).toBeGreaterThan(tamCoc.phutTronChuyen + 20);
  });

  it("Tràng An: ở bến lúc mới rời thì còn gần trọn vòng, lúc sắp về thì còn vài phút", () => {
    const ben = trangAn.moc[0].lonLat;
    expect(uocPhutVeBen("trang-an", ben, 2)!.phutConLai).toBeGreaterThan(170);
    expect(uocPhutVeBen("trang-an", ben, 178)!.phutConLai).toBeLessThan(10);
  });

  it("đọc phút một vòng người vận hành đặt ở màn Sức chứa", () => {
    expect(uocPhutVeBen("tam-coc", giua, 28, 180)!.phutConLai).toBeGreaterThan(120);
  });

  it("lệch xa tuyến (chưa xuống thuyền) thì không ước", () => {
    expect(uocPhutVeBen("tam-coc", [105.95, 20.2], 10)).toBeNull();
  });
});
