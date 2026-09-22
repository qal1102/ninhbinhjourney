import { describe, expect, it } from "vitest";

import {
  daNguoi,
  demViecPhaiLam,
  doiTacFrom,
  loiImLang,
  soDoiTacFrom,
  soNgayImLang,
  xepSoDoiTac,
  type DoiTacNhanHang,
  type GiaiDoanDoiTac,
} from "@/domain/doi-tac-nhan-hang";

function luc(iso: string) {
  return new Date(`${iso}T10:00:00+07:00`);
}

function doiTac(
  ten: string,
  giaiDoan: GiaiDoanDoiTac,
  lanTraoDoiCuoi: string,
): DoiTacNhanHang {
  return {
    id: `id-${ten}`,
    ten,
    nganhHang: "",
    nguoiBenHo: "",
    cachLienHe: "",
    nguoiPhuTrach: "",
    giaiDoan,
    dipNhamToi: "",
    lanTraoDoiCuoi,
    ghiChu: "",
    capNhatLuc: "2026-09-22T03:00:00+00:00",
  };
}

describe("Sổ đối tác: đếm ngày im lặng", () => {
  it("chưa trao đổi lần nào KHÁC với vừa trao đổi hôm nay", () => {
    // Trả về 0 cho cả hai là chỗ sai kín tiếng nhất: một mối chưa ai gọi sẽ
    // trông y hệt một mối vừa gọi xong, và không bao giờ được nhắc lại.
    expect(soNgayImLang(luc("2026-09-22"), doiTac("A", "da-lien-he", ""))).toBeNull();
    expect(soNgayImLang(luc("2026-09-22"), doiTac("B", "da-lien-he", "2026-09-22"))).toBe(0);
    expect(loiImLang(luc("2026-09-22"), doiTac("A", "da-lien-he", ""))).toBe(
      "chưa trao đổi lần nào",
    );
    expect(loiImLang(luc("2026-09-22"), doiTac("B", "da-lien-he", "2026-09-22"))).toBe(
      "trao đổi hôm nay",
    );
  });

  it("đếm đúng số ngày, kể cả khi bắc qua tháng", () => {
    expect(soNgayImLang(luc("2026-10-02"), doiTac("A", "dang-ban", "2026-09-28"))).toBe(4);
    expect(loiImLang(luc("2026-09-23"), doiTac("A", "dang-ban", "2026-09-22"))).toBe(
      "trao đổi hôm qua",
    );
  });

  it("đo theo giờ Việt Nam, không theo giờ máy chủ", () => {
    // 22/09 lúc 23:30 giờ Việt Nam vẫn là ngày 22, dù ở UTC đã là 16:30 cùng
    // ngày; còn 23/09 lúc 00:30 giờ Việt Nam thì ở UTC vẫn là 22/09.
    const khuya = new Date("2026-09-23T00:30:00+07:00");
    expect(soNgayImLang(khuya, doiTac("A", "dang-ban", "2026-09-22"))).toBe(1);
  });
});

describe("Sổ đối tác: ai đáng gọi lại hôm nay", () => {
  it("mối chưa ai gọi thì luôn là việc phải làm", () => {
    expect(daNguoi(luc("2026-09-22"), doiTac("A", "nham-truoc", ""))).toBe(true);
  });

  it("giai đoạn đang bàn nguội nhanh hơn giai đoạn mới nhắm", () => {
    // Đang bàn cụ thể mà im mười ngày là hỏng; mới nhắm thì mười ngày chưa sao.
    const muoiNgay = "2026-09-12";
    expect(daNguoi(luc("2026-09-22"), doiTac("A", "dang-ban", muoiNgay))).toBe(true);
    expect(daNguoi(luc("2026-09-22"), doiTac("B", "nham-truoc", muoiNgay))).toBe(false);
  });

  it("mối đã khép lại thì không bao giờ đòi gọi lại", () => {
    expect(daNguoi(luc("2030-01-01"), doiTac("A", "khep-lai", "2026-01-01"))).toBe(false);
  });

  it("đếm đúng số việc phải làm", () => {
    const so = [
      doiTac("A", "dang-ban", "2026-09-21"),
      doiTac("B", "dang-ban", "2026-09-01"),
      doiTac("C", "nham-truoc", ""),
      doiTac("D", "khep-lai", "2020-01-01"),
    ];
    expect(demViecPhaiLam(luc("2026-09-22"), so)).toBe(2);
  });
});

describe("Sổ đối tác: thứ tự nhìn", () => {
  it("việc phải làm lên trước, rồi tới giai đoạn nóng hơn, rồi tới mối im lâu hơn", () => {
    const so = [
      doiTac("Vừa gọi hôm qua", "dang-ban", "2026-09-21"),
      doiTac("Đã chốt từ lâu", "da-chot", "2026-09-20"),
      doiTac("Đang bàn mà im 30 ngày", "dang-ban", "2026-08-23"),
      doiTac("Mới nhắm chưa gọi", "nham-truoc", ""),
      doiTac("Đã gọi, im 40 ngày", "da-lien-he", "2026-08-13"),
    ];
    const xep = xepSoDoiTac(luc("2026-09-22"), so).map((d) => d.ten);
    expect(xep.slice(0, 3)).toEqual([
      "Đang bàn mà im 30 ngày",
      "Đã gọi, im 40 ngày",
      "Mới nhắm chưa gọi",
    ]);
    // Hai mối không cần làm gì hôm nay nằm cuối.
    expect(xep.slice(3)).toEqual(["Vừa gọi hôm qua", "Đã chốt từ lâu"]);
  });

  it("không sửa vào mảng gốc", () => {
    const so = [doiTac("B", "dang-ban", "2026-01-01"), doiTac("A", "dang-ban", "2026-09-22")];
    const truoc = so.map((d) => d.ten);
    xepSoDoiTac(luc("2026-09-22"), so);
    expect(so.map((d) => d.ten)).toEqual(truoc);
  });
});

describe("Sổ đối tác: dựng lại từ dữ liệu kho", () => {
  it("nhận đúng tên cột của kho", () => {
    const d = doiTacFrom({
      id: "11111111-1111-4111-8111-111111111111",
      ten: "  Một nhãn hàng  ",
      nganh_hang: "Thời trang",
      nguoi_ben_ho: "Chị Lan",
      cach_lien_he: "lan@vidu.test",
      nguoi_phu_trach: "Anh Quang",
      giai_doan: "dang-ban",
      dip_nham_toi: "trung-thu",
      lan_trao_doi_cuoi: "2026-09-20",
      ghi_chu: "Hẹn gửi hồ sơ tuần sau",
      cap_nhat_luc: "2026-09-22T03:00:00+00:00",
    });
    expect(d?.ten).toBe("Một nhãn hàng");
    expect(d?.giaiDoan).toBe("dang-ban");
    expect(d?.dipNhamToi).toBe("trung-thu");
  });

  it("dữ liệu hỏng thì bỏ đúng dòng ấy, không kéo sập cả sổ", () => {
    const so = soDoiTacFrom([
      { id: "a", ten: "Giữ lại" },
      { id: "", ten: "Thiếu mã" },
      { id: "b", ten: "" },
      null,
      "không phải dòng nào cả",
      { id: "c", ten: "Cũng giữ", giai_doan: "không-có-giai-đoạn-này" },
    ]);
    expect(so.map((d) => d.ten)).toEqual(["Giữ lại", "Cũng giữ"]);
    // Giai đoạn lạ thì lùi về mức an toàn nhất, không ném lỗi.
    expect(so[1].giaiDoan).toBe("nham-truoc");
  });

  it("không có tên nhãn hàng thật nào nằm trong chính tệp mô hình", async () => {
    const { readFileSync } = await import("node:fs");
    const nguon = readFileSync("domain/doi-tac-nhan-hang.ts", "utf8");
    expect(nguon).not.toMatch(
      /celine|chanel|prada|bottega|herm[eè]s|bvlgari|cartier|\bdior\b|gucci|rolex/i,
    );
  });
});
