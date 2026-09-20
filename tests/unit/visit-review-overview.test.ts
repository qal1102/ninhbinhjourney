import { describe, expect, it } from "vitest";

import {
  duLoiDeKetLuan,
  noiDangTut,
  noiHayMaItNguoiBiet,
  siteReviewOverviewsFrom,
  vietDiem,
  type SiteReviewOverview,
} from "@/domain/visit-review-overview";

function noi(
  siteId: string,
  reviewCount: number,
  average: number | null,
  entryCount: number,
): SiteReviewOverview {
  return {
    siteId,
    reviewCount,
    average,
    spread: { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 },
    entryCount,
    recentVoices: [],
  };
}

describe("TC-12 mục 2: đọc bảng điểm cho người điều hành", () => {
  it("chưa ai kể thì điểm là null, không phải 0", () => {
    const ra = siteReviewOverviewsFrom([
      { site_id: "a", so_luot: 0, diem_trung_binh: null, pho_diem: {}, so_luot_vao: 120, loi_gan_day: [] },
    ]);
    expect(ra[0].average).toBeNull();
    expect(ra[0].reviewCount).toBe(0);
    expect(ra[0].entryCount).toBe(120);
  });

  it("bỏ lời rỗng và sao hỏng khỏi phần trích", () => {
    const ra = siteReviewOverviewsFrom([
      {
        site_id: "a",
        so_luot: 2,
        diem_trung_binh: 4,
        pho_diem: { "4": 1, "5": 1 },
        so_luot_vao: 10,
        loi_gan_day: [
          { id: "r1", rating: 5, comment: "Đáng đi", created_at: "2026-09-19T01:00:00Z" },
          { id: "r2", rating: 4, comment: "   ", created_at: "2026-09-19T02:00:00Z" },
          { id: "r3", rating: 0, comment: "sao hỏng", created_at: "2026-09-19T03:00:00Z" },
          { rating: 5, comment: "thiếu mã nên không ẩn được", created_at: "2026-09-19T04:00:00Z" },
        ],
      },
    ]);
    expect(ra[0].recentVoices).toHaveLength(1);
  });

  it("điểm viết bằng dấu phẩy, chưa có điểm thì một gạch ngang", () => {
    expect(vietDiem(4.25)).toBe("4,3");
    expect(vietDiem(null)).toBe("—");
  });
});

describe("TC-12 mục 2: nơi đang tụt", () => {
  it("chỉ kết luận khi đã đủ năm lời", () => {
    expect(duLoiDeKetLuan(noi("a", 4, 2.0, 100))).toBe(false);
    expect(duLoiDeKetLuan(noi("a", 5, 2.0, 100))).toBe(true);
  });

  it("gọi tên nơi dưới 3,5 sao, nơi thấp nhất đứng đầu", () => {
    const ra = noiDangTut([noi("a", 8, 3.2, 100), noi("b", 9, 2.6, 100), noi("c", 10, 4.8, 100)]);
    expect(ra.map((r) => r.siteId)).toEqual(["b", "a"]);
  });

  it("ít lời thì không kết tội một cơ sở", () => {
    expect(noiDangTut([noi("a", 2, 1.0, 100)])).toEqual([]);
  });
});

describe("TC-12 mục 2: nơi hay mà ít người biết", () => {
  it("điểm cao, lượt vào dưới trung vị thì được gọi tên", () => {
    const ra = noiHayMaItNguoiBiet([
      noi("dong", 20, 4.6, 5000),
      noi("vua", 10, 4.2, 800),
      noi("vang", 8, 4.8, 120),
    ]);
    expect(ra.map((r) => r.siteId)).toEqual(["vang"]);
  });

  it("dùng trung vị nên một nơi quá đông không xoá sổ cả bảng", () => {
    // Trung bình cộng của 5000/800/700/120 là 1655 — nếu so bằng trung bình,
    // cả "vua" lẫn "gan" đều thành "ít người", trong khi thực tế chúng ở mức
    // giữa. Trung vị (750) chỉ để lọt đúng nơi vắng thật.
    const ra = noiHayMaItNguoiBiet([
      noi("dong", 20, 4.6, 5000),
      noi("vua", 10, 4.7, 800),
      noi("gan", 10, 4.7, 700),
      noi("vang", 8, 4.8, 120),
    ]);
    expect(ra.map((r) => r.siteId)).toEqual(["vang", "gan"]);
  });

  it("dưới ba nơi có dữ liệu thì không kết luận gì", () => {
    expect(noiHayMaItNguoiBiet([noi("a", 9, 4.9, 10), noi("b", 9, 4.9, 5000)])).toEqual([]);
  });

  it("điểm chưa cao thì vắng mấy cũng không gọi tên", () => {
    const ra = noiHayMaItNguoiBiet([
      noi("a", 9, 4.0, 10),
      noi("b", 9, 4.9, 5000),
      noi("c", 9, 4.1, 4000),
    ]);
    expect(ra).toEqual([]);
  });
});
