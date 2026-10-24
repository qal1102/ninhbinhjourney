import { describe, expect, it } from "vitest";
import { docNgay, docTien, giaTriThu, kiemKhongAi, quyetDinh, type NguCanhSoat, type VanBanDaCo } from "@/domain/van-ban";

const hdNcc: VanBanDaCo = {
  id: "1",
  loai: "hop-dong-nha-cung-cap",
  soVanBan: "HĐ-NCC-2026-0014",
  coSo: "trang-an",
  ketQua: "nhan",
  laMau: true,
  giaTri: { ten_ncc: "Công ty Dịch vụ Tràng An Xanh", mst_ncc: "2700123456", gia_tri: "180.000.000", tu_ngay: "01/03/2026", den_ngay: "31/12/2026", noi_dung: "Thu gom rác" },
};
const nt = (gia: string): VanBanDaCo => ({
  id: gia,
  loai: "bien-ban-nghiem-thu",
  soVanBan: `BB-${gia}`,
  coSo: "trang-an",
  ketQua: "nhan",
  laMau: true,
  giaTri: { can_cu_hop_dong: "HĐ-NCC-2026-0014", gia_tri: gia, ket_luan: "Đạt" },
});
const hdThuyen: VanBanDaCo = {
  id: "2",
  loai: "hop-dong-nguoi-cheo",
  soVanBan: "HĐ-NC-2026-0007",
  coSo: "trang-an",
  ketQua: "nhan",
  laMau: true,
  giaTri: { so_thuyen: "03", ho_ten: "Bùi Văn Thắng", so_cccd: "037079004321", tu_ngay: "01/01/2026", den_ngay: "" },
};

const nc: NguCanhSoat = {
  homNay: "2026-10-24",
  coSo: "trang-an",
  nguoiCheo: [
    { soThuyen: "03", hoTen: "Bùi Văn Thắng" },
    { soThuyen: "07", hoTen: "Đinh Thị Thơm" },
  ],
  coSoNguoiCheo: true,
  danhMucNcc: [{ ten: "Công ty Dịch vụ Tràng An Xanh", mst: "2700123456", coSo: "trang-an" }],
  daCo: [hdNcc, nt("60.000.000"), nt("45.000.000"), hdThuyen],
};

const loi = (ds: ReturnType<typeof kiemKhongAi>) => ds.filter((p) => p.mucDo === "loi").map((p) => p.muc);

describe("đọc ô", () => {
  it("ngày và tiền", () => {
    expect(docNgay("05/03/2026")).toBe("2026-03-05");
    expect(docNgay("31/02/2026")).toBeNull();
    expect(docNgay("2026-03-05")).toBeNull();
    expect(docTien("180.000.000 đ")).toBe(180_000_000);
    expect(docTien("một trăm")).toBeNull();
  });
});

describe("hợp đồng chèo đò", () => {
  const he = { so_van_ban: "HĐ-NC-2026-0101", co_so: "Tràng An", so_thuyen: "07" };
  it("bản thử điền đúng không có lỗi, khớp tên trong sổ", () => {
    const g = { ...he, ...giaTriThu("hop-dong-nguoi-cheo", "dien-dung", { homNay: nc.homNay, heThong: he, hoTenTrongSo: "Đinh Thị Thơm" }) };
    const kq = kiemKhongAi("hop-dong-nguoi-cheo", g, nc);
    expect(loi(kq)).toEqual([]);
    expect(kq.some((p) => p.mucDo === "dat" && p.nguon === "doi-chieu" && p.noi.includes("Đinh Thị Thơm"))).toBe(true);
  });

  it("bản thử điền sai bắt đủ: tên khác sổ, căn cước thiếu số, số điện thoại, ngày kết thúc", () => {
    const g = { ...he, ...giaTriThu("hop-dong-nguoi-cheo", "dien-sai", { homNay: nc.homNay, heThong: he, hoTenTrongSo: "Đinh Thị Thơm" }) };
    expect(loi(kiemKhongAi("hop-dong-nguoi-cheo", g, nc))).toEqual(expect.arrayContaining(["ho_ten", "so_cccd", "so_dien_thoai", "den_ngay"]));
  });

  it("thời vụ quá 12 tháng, chưa đủ 18 tuổi, căn cước đã đứng tên người khác", () => {
    const g = {
      ...he,
      ho_ten: "Đinh Thị Thơm",
      ngay_sinh: "01/06/2010",
      so_cccd: "037079004321",
      dia_chi: "Trường Yên",
      so_dien_thoai: "0912000111",
      loai_hop_dong: "Thời vụ",
      tu_ngay: "01/11/2026",
      den_ngay: "30/11/2027",
      tien_cong: "180.000",
      ngay_ky: "20/10/2026",
    };
    const kq = kiemKhongAi("hop-dong-nguoi-cheo", g, nc);
    expect(loi(kq)).toEqual(expect.arrayContaining(["den_ngay", "ngay_sinh", "so_cccd"]));
  });

  it("thuyền đang có hợp đồng của người khác trùng khoảng ngày", () => {
    const g = { ...he, so_thuyen: "03", ho_ten: "Trần Văn Mạnh", tu_ngay: "01/11/2026", loai_hop_dong: "Dài hạn" };
    const kq = kiemKhongAi("hop-dong-nguoi-cheo", g, { ...nc, nguoiCheo: [] });
    expect(kq.find((p) => p.muc === "tu_ngay" && p.mucDo === "loi")?.noi).toContain("HĐ-NC-2026-0007");
  });

  it("chưa đọc được sổ thì chỉ cảnh báo, không chặn", () => {
    const g = { ...he, ...giaTriThu("hop-dong-nguoi-cheo", "dien-dung", { homNay: nc.homNay, heThong: he }) };
    const kq = kiemKhongAi("hop-dong-nguoi-cheo", g, { ...nc, coSoNguoiCheo: false, nguoiCheo: [] });
    expect(loi(kq)).toEqual([]);
    expect(kq.some((p) => p.mucDo === "canh-bao" && p.muc === "so_thuyen")).toBe(true);
  });
});

describe("hợp đồng nhà cung cấp", () => {
  const he = { so_van_ban: "HĐ-NCC-2026-0022", co_so: "Tràng An" };
  it("điền đúng: không lỗi, có trong danh mục; cùng nội dung hợp đồng cũ thì cảnh báo ký trùng", () => {
    const g = { ...he, ...giaTriThu("hop-dong-nha-cung-cap", "dien-dung", { homNay: nc.homNay, heThong: he }) };
    const kq = kiemKhongAi("hop-dong-nha-cung-cap", g, { ...nc, daCo: [{ ...hdNcc, giaTri: { ...hdNcc.giaTri, noi_dung: (g as Record<string, string>).noi_dung } }] });
    expect(loi(kq)).toEqual([]);
    expect(kq.some((p) => p.muc === "noi_dung" && p.mucDo === "canh-bao")).toBe(true);
  });

  it("điền sai: mã số thuế, thuế suất, ngày", () => {
    const g = { ...he, ...giaTriThu("hop-dong-nha-cung-cap", "dien-sai", { homNay: nc.homNay, heThong: he }) };
    expect(loi(kiemKhongAi("hop-dong-nha-cung-cap", g, nc))).toEqual(expect.arrayContaining(["mst_ncc", "thue_suat", "den_ngay"]));
  });

  it("mã số thuế có trong danh mục mà tên khác là lỗi", () => {
    const g = { ...he, ...giaTriThu("hop-dong-nha-cung-cap", "dien-dung", { homNay: nc.homNay, heThong: he }), ten_ncc: "Công ty Lạ" };
    expect(loi(kiemKhongAi("hop-dong-nha-cung-cap", g, nc))).toContain("ten_ncc");
  });
});

describe("biên bản nghiệm thu", () => {
  const he = { so_van_ban: "BB-NT-2026-0039", co_so: "Tràng An", can_cu_hop_dong: "HĐ-NCC-2026-0014", ten_ncc: "Công ty Dịch vụ Tràng An Xanh", mst_ncc: "2700123456" };
  it("trong giá trị còn lại thì đạt, báo phần còn lại", () => {
    const g = { ...he, ...giaTriThu("bien-ban-nghiem-thu", "dien-dung", { homNay: nc.homNay, heThong: he, giaTriHopDong: 180_000_000 }) };
    const kq = kiemKhongAi("bien-ban-nghiem-thu", g, nc);
    expect(loi(kq)).toEqual([]);
    expect(kq.find((p) => p.muc === "gia_tri")?.noi).toContain("60.000.000");
  });

  it("vượt phần còn lại, ngày ở tương lai, thiếu đại diện bên B", () => {
    const g = { ...he, ...giaTriThu("bien-ban-nghiem-thu", "dien-sai", { homNay: nc.homNay, heThong: he, giaTriHopDong: 180_000_000 }) };
    const kq = kiemKhongAi("bien-ban-nghiem-thu", g, nc);
    expect(loi(kq)).toEqual(expect.arrayContaining(["gia_tri", "ngay_nghiem_thu", "dai_dien_b"]));
    expect(kq.find((p) => p.muc === "gia_tri")?.noi).toContain("còn 75.000.000");
  });

  it("dẫn hợp đồng không có trong hệ thống", () => {
    const g = { ...he, can_cu_hop_dong: "HĐ-NCC-2026-9999" };
    expect(loi(kiemKhongAi("bien-ban-nghiem-thu", g, nc))).toContain("can_cu_hop_dong");
  });
});

describe("quyết định của cổng", () => {
  const congDat = [{ muc: "a", dat: true, noi: "" }];
  it("luật quyết, AI chỉ giữ lại", () => {
    expect(quyetDinh([{ muc: "a", dat: false, noi: "" }], [], null)).toBe("tra-lai");
    expect(quyetDinh(congDat, [{ muc: "x", mucDo: "loi", noi: "", nguon: "luat" }], { trangThai: "co", tomTat: "", diem: [] })).toBe("tra-lai");
    expect(quyetDinh(congDat, [], { trangThai: "co", tomTat: "", diem: [{ muc: "x", mucDo: "nghiem-trong", noi: "" }] })).toBe("cho-duyet");
    expect(quyetDinh(congDat, [], { trangThai: "co", tomTat: "", diem: [{ muc: "x", mucDo: "luu-y", noi: "" }] })).toBe("nhan-duoc");
    // AI lỗi hay chưa bật không chặn được văn bản đã đạt luật.
    expect(quyetDinh(congDat, [], { trangThai: "loi", tomTat: "", diem: [] })).toBe("nhan-duoc");
  });
});
