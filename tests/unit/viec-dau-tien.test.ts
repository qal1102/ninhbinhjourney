import { describe, expect, it } from "vitest";

import {
  tongViecCho,
  viecDauTien,
  VIEC_DAU_TIEN_COPY,
  type DemViecChoGiamDoc,
} from "@/domain/viec-dau-tien";

const RONG: DemViecChoGiamDoc = {
  suCoLeoThang: 0,
  caLechChoQuyet: 0,
  hoaDonChoQuyet: 0,
  deNghiDoiDuAn: 0,
  quyetDinhSop: 0,
};

function chon(phan: Partial<DemViecChoGiamDoc>) {
  return viecDauTien({ ...RONG, ...phan }, "trang-an");
}

describe("Việc nên làm trước: thứ tự ưu tiên", () => {
  it("người đứng trước tiền — sự cố leo thang thắng mọi thứ khác", () => {
    const ra = chon({
      suCoLeoThang: 1,
      caLechChoQuyet: 9,
      hoaDonChoQuyet: 9,
      deNghiDoiDuAn: 9,
      quyetDinhSop: 9,
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

  it("quy trình xếp cuối, và được nói thẳng là không gấp", () => {
    const ra = chon({ quyetDinhSop: 4 });
    expect(ra.id).toBe("sop");
    expect(ra.mucDo).toBe("ranh");
  });
});

describe("Việc nên làm trước: câu chữ và đường đi", () => {
  it("câu nói mang đúng con số, không phải chữ chung chung", () => {
    expect(chon({ caLechChoQuyet: 3 }).cauNoi).toContain("3 ca");
    expect(chon({ suCoLeoThang: 1 }).so).toBe(1);
  });

  it("mỗi việc đều nói được VÌ SAO nó đứng trước", () => {
    for (const phan of [
      { suCoLeoThang: 1 },
      { caLechChoQuyet: 1 },
      { hoaDonChoQuyet: 1 },
      { deNghiDoiDuAn: 1 },
      { quyetDinhSop: 1 },
    ]) {
      expect(chon(phan).viSao.trim().length).toBeGreaterThan(40);
    }
  });

  it("đường dẫn bám theo cơ sở được truyền vào", () => {
    expect(viecDauTien({ ...RONG, caLechChoQuyet: 1 }, "tam-coc").href).toBe(
      "/erp/tam-coc/ve-dat-cho",
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
        caLechChoQuyet: 2,
        hoaDonChoQuyet: 3,
        deNghiDoiDuAn: 4,
        quyetDinhSop: 5,
      }),
    ).toBe(15);
  });
});
