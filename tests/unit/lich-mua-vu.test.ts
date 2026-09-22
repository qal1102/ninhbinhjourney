import { describe, expect, it } from "vitest";

import { CAC_DIP, lichMuaVu, loiDip } from "@/domain/lich-mua-vu";

function luc(iso: string) {
  return new Date(`${iso}T10:00:00+07:00`);
}

describe("Lịch mùa vụ", () => {
  it("luôn nhìn về phía trước: dịp đã qua năm nay thì hiện lần năm sau", () => {
    // 22/09/2026 thì Trung thu 25/09 còn ở phía trước, còn Tết Nguyên đán đã
    // qua từ tháng Hai — nên phải hiện Tết của năm 2027.
    const lich = lichMuaVu(luc("2026-09-22"));
    const tet = lich.find((d) => d.dip.id === "tet-nguyen-dan");
    expect(tet?.ngayBatDau.startsWith("2027-")).toBe(true);
    const trungThu = lich.find((d) => d.dip.id === "trung-thu");
    expect(trungThu?.ngayBatDau).toBe("2026-09-25");
  });

  it("xếp theo ngày gần nhất trước", () => {
    const lich = lichMuaVu(luc("2026-09-22"));
    const ngay = lich.map((d) => d.ngayBatDau);
    expect([...ngay].sort()).toEqual(ngay);
  });

  it("dịp kéo dài nhiều ngày vẫn ở lại khi đã bắt đầu", () => {
    // Lễ hội Hoa Lư kéo ba ngày: đứng vào giữa hội thì nó phải là "đang diễn
    // ra", chứ không được biến mất khỏi lịch.
    const batDau = lichMuaVu(luc("2026-01-01")).find((d) => d.dip.id === "le-hoi-hoa-lu");
    expect(batDau).toBeTruthy();
    const giuaHoi = new Date(`${batDau!.ngayBatDau}T10:00:00+07:00`);
    giuaHoi.setUTCDate(giuaHoi.getUTCDate() + 1);
    const lich = lichMuaVu(giuaHoi);
    const hoi = lich.find((d) => d.dip.id === "le-hoi-hoa-lu");
    expect(hoi?.trangThai).toBe("dang-dien-ra");
    expect(loiDip(hoi!)).toBe("đang diễn ra");
  });

  it("nói thẳng khi đã tới lúc phải chuẩn bị", () => {
    const lich = lichMuaVu(luc("2026-09-22"));
    const trungThu = lich.find((d) => d.dip.id === "trung-thu")!;
    // Còn 3 ngày, mà hạn chuẩn bị là 60 ngày trước — tức đã quá muộn từ lâu.
    expect(trungThu.conBaoNhieuNgay).toBe(3);
    expect(trungThu.trangThai).toBe("toi-luc-chuan-bi");
    expect(loiDip(trungThu)).toContain("đã tới lúc chuẩn bị");
  });

  it("dịp còn xa thì nhắc luôn mốc phải bắt đầu", () => {
    const lich = lichMuaVu(luc("2026-09-22"));
    const xa = lich.find((d) => d.trangThai === "con-xa");
    expect(xa).toBeTruthy();
    expect(loiDip(xa!)).toContain("bắt đầu chuẩn bị trước");
  });

  it("cửa sổ mười hai tháng phủ hết mọi dịp đã khai", () => {
    // Mỗi dịp phải xuất hiện đúng một lần trong mười hai tháng tới. Thiếu
    // dịp nào nghĩa là phép tính ngày của dịp ấy hỏng.
    const lich = lichMuaVu(luc("2026-09-22"), 12);
    const id = new Set(lich.map((d) => d.dip.id));
    for (const dip of CAC_DIP) {
      expect(id.has(dip.id), `thiếu dịp ${dip.id}`).toBe(true);
    }
    expect(lich.length).toBe(CAC_DIP.length);
  });

  it("cửa sổ ngắn thì cắt bớt, không nhồi cho đủ", () => {
    const ba = lichMuaVu(luc("2026-09-22"), 3);
    expect(ba.length).toBeGreaterThan(0);
    expect(ba.length).toBeLessThan(CAC_DIP.length);
    for (const d of ba) {
      expect(d.conBaoNhieuNgay).toBeLessThanOrEqual(95);
    }
  });

  it("mọi dịp đều có một câu nói được nó dùng để làm gì", () => {
    for (const dip of CAC_DIP) {
      expect(dip.yNghia.length).toBeGreaterThan(30);
      expect(dip.chuanBiTruoc).toBeGreaterThan(0);
      // Không để lọt mã nội bộ hay chữ máy ra màn hình người dùng.
      expect(dip.ten).not.toMatch(/[a-z]+_[a-z]+/);
      expect(dip.yNghia).not.toMatch(/[a-z]+_[a-z]+/);
    }
  });

  it("ngày của dịp âm lịch đổi theo năm, không đứng yên", () => {
    const a = lichMuaVu(luc("2026-01-01")).find((d) => d.dip.id === "trung-thu")!;
    const b = lichMuaVu(luc("2027-01-01")).find((d) => d.dip.id === "trung-thu")!;
    expect(a.ngayBatDau).not.toBe(b.ngayBatDau);
    expect(a.ngayBatDau.slice(5)).not.toBe(b.ngayBatDau.slice(5));
  });
});
