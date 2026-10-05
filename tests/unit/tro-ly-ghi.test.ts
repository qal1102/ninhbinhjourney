import { describe, expect, it } from "vitest";
import { hanDocDuoc, nhanLoaiCau, phanTichCauNoi, type NguoiTrongDanhBa } from "@/domain/tro-ly-ghi";

// Thứ Ba 06/10/2026, 8 giờ sáng giờ Việt Nam.
const BAY_GIO = new Date("2026-10-06T08:00:00+07:00");

const DANH_BA: NguoiTrongDanhBa[] = [
  { id: "nv-hung", ten: "Trần Văn Hùng", vai: "employee", coSo: ["tam-coc"] },
  { id: "nv-lan", ten: "Lê Thị Lan", vai: "employee", coSo: ["trang-an"] },
  { id: "nv-hung-2", ten: "Phạm Minh Hùng", vai: "employee", coSo: ["trang-an"] },
  { id: "ql-tam-coc", ten: "Đỗ Quang Huy", vai: "manager", coSo: ["tam-coc"] },
  { id: "kt-01", ten: "Vũ Thu Hà", vai: "accountant", coSo: ["trang-an", "tam-coc"] },
];

const hieu = (cau: string) => phanTichCauNoi(cau, { bayGio: BAY_GIO, danhBa: DANH_BA });
const gioVn = (iso: string | null) =>
  iso ? new Date(Date.parse(iso) + 7 * 3_600_000).toISOString().slice(0, 16).replace("T", " ") : null;

describe("nhận loại câu", () => {
  it.each([
    ["Giao cho Hùng kiểm lại áo phao", "viec"],
    ["giao việc cho chị Lan gửi báo cáo", "viec"],
    ["Nhờ anh Huy gọi nhà cung cấp nước", "viec"],
    ["Bảo chị Hà chuyển khoản tiền điện", "viec"],
    ["Ghi chú gọi lại cho đối tác in vé", "ghi-chu"],
    ["Nhắc tôi 3 giờ chiều họp giao ban", "ghi-chu"],
    ["Nhớ mua thêm áo phao trẻ em", "ghi-chu"],
    ["Nhật ký hôm nay đón 3 đoàn khách Hàn", "nhat-ky"],
    ["Hôm nay tôi đã kiểm xong 40 thuyền", "nhat-ky"],
  ])("%s → %s", (cau, loai) => {
    expect(nhanLoaiCau(cau)?.loai).toBe(loai);
  });

  it.each(["doanh thu hôm nay bao nhiêu", "mở sự cố Tam Cốc", "báo cáo doanh thu tuần", "bao nhiêu khách đã check in"])(
    "%s không phải câu ghi",
    (cau) => {
      expect(nhanLoaiCau(cau)).toBeNull();
    },
  );
});

describe("giao việc", () => {
  it("tách người nhận, hạn, cơ sở và nội dung", () => {
    const b = hieu("Giao cho Hùng sáng mai kiểm lại áo phao bến Tam Cốc trước 9 giờ nhé");
    expect(b.loai).toBe("viec");
    // Có hai người tên Hùng, câu nói Tam Cốc nên chọn người ở Tam Cốc.
    expect(b.nguoiNhanId).toBe("nv-hung");
    expect(b.ungVien).toHaveLength(2);
    expect(gioVn(b.han)).toBe("2026-10-07 09:00");
    expect(b.coSo).toBe("tam-coc");
    expect(b.noiDung).toBe("Kiểm lại áo phao bến Tam Cốc");
    expect(b.canXemLai).toEqual([]);
  });

  it("tên trùng mà không có cơ sở thì để người nói chọn", () => {
    const b = hieu("giao cho anh Hùng dọn kho");
    expect(b.nguoiNhanId).toBeNull();
    expect(b.ungVien.map((u) => u.id).sort()).toEqual(["nv-hung", "nv-hung-2"]);
    expect(b.canXemLai[0]).toContain("2 người");
  });

  it("gọi họ tên đầy đủ thì chọn đúng một người", () => {
    const b = hieu("giao việc cho Phạm Minh Hùng chiều nay 3 giờ rưỡi kiểm két");
    expect(b.nguoiNhanId).toBe("nv-hung-2");
    expect(gioVn(b.han)).toBe("2026-10-06 15:30");
    expect(b.noiDung).toBe("Kiểm két");
  });

  it("gọi theo vai và cơ sở", () => {
    const b = hieu("Nhờ quản lý Tam Cốc gửi lịch trực lễ Sắc Hồng thứ sáu gấp");
    expect(b.nguoiNhanId).toBe("ql-tam-coc");
    expect(b.khan).toBe(true);
    expect(gioVn(b.han)).toBe("2026-10-09 17:00");
    expect(b.noiDung).toBe("Gửi lịch trực lễ Sắc Hồng");
  });

  it("người không có trong danh bạ thì giữ tên nghe được và hỏi lại", () => {
    const b = hieu("Giao cho Tuấn sơn lại biển chỉ đường");
    expect(b.nguoiNhanId).toBeNull();
    expect(b.tenNghe).toBe("Tuấn");
    expect(b.canXemLai[0]).toContain("Tuấn");
    expect(b.noiDung).toBe("Sơn lại biển chỉ đường");
  });

  it("ngày tháng viết số và giờ kiểu 14h", () => {
    const b = hieu("giao cho chị Lan ngày 12/10 lúc 14h họp với đối tác");
    expect(b.nguoiNhanId).toBe("nv-lan");
    expect(gioVn(b.han)).toBe("2026-10-12 14:00");
    expect(b.noiDung).toBe("Họp với đối tác");
  });

  it("chỉ nói giờ đã qua thì hiểu là ngày mai", () => {
    const b = hieu("giao cho chị Hà 7 giờ gửi bảng kê");
    expect(gioVn(b.han)).toBe("2026-10-07 07:00");
  });
});

describe("ghi chú và nhật ký", () => {
  it("ghi chú có giờ nhắc", () => {
    const b = hieu("Nhắc tôi 3 giờ chiều mai gọi lại nhà in vé");
    expect(b.loai).toBe("ghi-chu");
    expect(gioVn(b.han)).toBe("2026-10-07 15:00");
    expect(b.noiDung).toBe("Gọi lại nhà in vé");
  });

  it("ghi chú không giờ", () => {
    const b = hieu("ghi chú: khách đoàn Hàn Quốc muốn thêm suất chay");
    expect(b.han).toBeNull();
    expect(b.noiDung).toBe("Khách đoàn Hàn Quốc muốn thêm suất chay");
  });

  it("nhật ký ngày giữ nguyên câu kể", () => {
    const b = hieu("Nhật ký hôm nay đón 3 đoàn khách Hàn, một thuyền hỏng mái chèo");
    expect(b.loai).toBe("nhat-ky");
    expect(b.ngay).toBe("2026-10-06");
    expect(b.han).toBeNull();
    expect(b.noiDung).toBe("Đón 3 đoàn khách Hàn, một thuyền hỏng mái chèo");
  });

  it("nhật ký hôm qua ghi đúng ngày", () => {
    const b = hieu("nhật ký hôm qua kiểm xong 40 thuyền");
    expect(b.ngay).toBe("2026-10-05");
  });
});

describe("hạn đọc cho người", () => {
  it("đọc theo ngày tương đối", () => {
    expect(hanDocDuoc("2026-10-07T02:00:00.000Z", BAY_GIO)).toBe("09:00 ngày mai");
    expect(hanDocDuoc("2026-10-09T10:00:00.000Z", BAY_GIO)).toBe("17:00 thứ Sáu 09/10");
    expect(hanDocDuoc(null, BAY_GIO)).toBe("Chưa có hạn");
  });
});
