import { describe, expect, it } from "vitest";

import {
  tongViecCho,
  viecDauTien,
  VIEC_DAU_TIEN_COPY,
  type DemViecChoGiamDoc,
} from "@/domain/viec-dau-tien";

const RONG: DemViecChoGiamDoc = {
  suCoLeoThang: 0,
  suCoQuaHan: 0,
  caLechChoQuyet: 0,
  hoaDonChoQuyet: 0,
  deNghiDoiDuAn: 0,
  quyetDinhSop: 0,
};

function chon(phan: Partial<DemViecChoGiamDoc>) {
  return viecDauTien({ ...RONG, ...phan }, "trang-an");
}

describe("Việc nên làm trước: thứ tự ưu tiên", () => {
  it("cổng mở cửa đứng trước tất cả — chưa quyết thì cơ sở chưa mở được", () => {
    const ra = chon({
      quyetDinhSop: 1,
      suCoLeoThang: 9,
      suCoQuaHan: 9,
      caLechChoQuyet: 9,
      hoaDonChoQuyet: 9,
      deNghiDoiDuAn: 9,
    });
    expect(ra.id).toBe("sop");
    expect(ra.mucDo).toBe("gap");
    // Bản đầu xếp việc này xuống chót và gọi nó là "không gấp trong ngày".
    // Bài này khoá lại lời sửa: nó là cổng mở cửa buổi sáng, không phải quy
    // trình bàn giấy — xem chú thích đầu `domain/viec-dau-tien.ts`.
    expect(ra.cauNoi).toContain("mở cửa");
  });

  it("sự cố đã quá hạn đứng trước sự cố còn trong hạn", () => {
    const ra = chon({ suCoLeoThang: 3, suCoQuaHan: 1 });
    expect(ra.id).toBe("su-co-qua-han");
    expect(ra.so).toBe(1);
  });

  it("người đứng trước tiền — sự cố leo thang thắng mọi việc tiền bạc", () => {
    const ra = chon({
      suCoLeoThang: 1,
      caLechChoQuyet: 9,
      hoaDonChoQuyet: 9,
      deNghiDoiDuAn: 9,
    });
    expect(ra.id).toBe("su-co");
    expect(ra.mucDo).toBe("gap");
  });

  it("tiền mặt đã rời két đứng trước tiền chưa chi ra", () => {
    const ra = chon({ caLechChoQuyet: 2, hoaDonChoQuyet: 50 });
    expect(ra.id).toBe("ca-lech");
  });

  it("hoá đơn đứng trước đề nghị đổi dự án", () => {
    expect(chon({ hoaDonChoQuyet: 1, deNghiDoiDuAn: 30 }).id).toBe("hoa-don");
  });
});

describe("Việc nên làm trước: câu chữ và đường đi", () => {
  it("câu nói mang đúng con số, không phải chữ chung chung", () => {
    expect(chon({ caLechChoQuyet: 3 }).cauNoi).toContain("3 ca");
    expect(chon({ suCoLeoThang: 1 }).so).toBe(1);
  });

  it("mỗi việc đều nói được VÌ SAO nó đứng trước", () => {
    for (const phan of [
      { quyetDinhSop: 1 },
      { suCoLeoThang: 1, suCoQuaHan: 1 },
      { suCoLeoThang: 1 },
      { caLechChoQuyet: 1 },
      { hoaDonChoQuyet: 1 },
      { deNghiDoiDuAn: 1 },
    ]) {
      expect(chon(phan).viSao.trim().length).toBeGreaterThan(40);
    }
  });

  it("đường dẫn bám theo cơ sở được truyền vào", () => {
    expect(viecDauTien({ ...RONG, hoaDonChoQuyet: 1 }, "tam-coc").href).toBe(
      "/erp/tam-coc/doi-tac-nha-cung-ung",
    );
  });

  it("ca lệch trỏ vào khối quyết định trên trang chủ, không trỏ vào màn Vé", () => {
    // Màn Vé của cơ sở chỉ dựng nút cho nhân viên và quản lý; giám đốc mở ra
    // đọc được mà không quyết được. Bài này khoá lại đúng chỗ đã từng sai.
    expect(viecDauTien({ ...RONG, caLechChoQuyet: 1 }, "tam-coc").href).toBe(
      "#quyet-dinh-giam-doc",
    );
  });
});

describe("Việc nên làm trước: ngày rảnh", () => {
  it("không có việc nào thì nói thẳng là rảnh, không bịa việc gợi ý", () => {
    const ra = chon({});
    expect(ra.id).toBe("khong-co");
    expect(ra.cauNoi).toBe(VIEC_DAU_TIEN_COPY.ranh);
    expect(ra.href).toBe("");
    expect(ra.so).toBe(0);
  });

  it("đếm tổng việc chờ để nói được 'còn mấy việc nữa'", () => {
    expect(tongViecCho(RONG)).toBe(0);
    expect(
      tongViecCho({
        suCoLeoThang: 1,
        suCoQuaHan: 0,
        caLechChoQuyet: 2,
        hoaDonChoQuyet: 3,
        deNghiDoiDuAn: 4,
        quyetDinhSop: 5,
      }),
    ).toBe(15);
  });

  it("sự cố quá hạn KHÔNG cộng thêm vào tổng — nó là một lát cắt của sự cố", () => {
    // Đếm đôi ở đây sẽ làm câu "còn N việc khác" nói quá số thật.
    expect(tongViecCho({ ...RONG, suCoLeoThang: 2, suCoQuaHan: 2 })).toBe(2);
  });
});
