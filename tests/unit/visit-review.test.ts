import { describe, expect, it } from "vitest";

import {
  formatAverage,
  shouldShowAverage,
  siteReviewSummariesFrom,
  visitReviewsFrom,
  VisitReviewSubmitSchema,
  VISIT_REVIEW_COMMENT_MAX,
  VISIT_REVIEW_COPY,
} from "@/domain/visit-review";

const SITE = "10000000-0000-4000-8000-000000000001";

describe("TC-12: luật hình dạng của một lời", () => {
  it("nhận đúng mã thành viên, số sao 1–5 và lời trong giới hạn", () => {
    const hop_le = VisitReviewSubmitSchema.parse({
      member_code: "TV-ABCDEFGHJK",
      site_id: SITE,
      rating: 4,
      comment: "  Sáng sớm đi thuyền thì mát  ",
    });
    expect(hop_le.rating).toBe(4);
    expect(hop_le.comment).toBe("Sáng sớm đi thuyền thì mát");
  });

  it("từ chối số sao ngoài thang, số lẻ, và mã sai khuôn", () => {
    const nen_hong = [
      { member_code: "TV-ABCDEFGHJK", site_id: SITE, rating: 0, comment: "" },
      { member_code: "TV-ABCDEFGHJK", site_id: SITE, rating: 6, comment: "" },
      { member_code: "TV-ABCDEFGHJK", site_id: SITE, rating: 4.5, comment: "" },
      { member_code: "khong-phai-ma", site_id: SITE, rating: 4, comment: "" },
      { member_code: "TV-ABCDEFGHJK", site_id: "khong-phai-uuid", rating: 4, comment: "" },
      { member_code: "TV-ABCDEFGHJK", site_id: SITE, rating: 4, comment: "x".repeat(VISIT_REVIEW_COMMENT_MAX + 1) },
    ];
    for (const dau_vao of nen_hong) {
      expect(() => VisitReviewSubmitSchema.parse(dau_vao)).toThrow();
    }
  });

  it("không nhận trường lạ đi kèm", () => {
    expect(() =>
      VisitReviewSubmitSchema.parse({
        member_code: "TV-ABCDEFGHJK",
        site_id: SITE,
        rating: 4,
        comment: "",
        display_name: "Nguyễn Văn A",
      }),
    ).toThrow();
  });
});

describe("TC-12: đọc dữ liệu trả về", () => {
  it("bỏ hàng thiếu nơi hoặc sao hỏng, giữ hàng lành", () => {
    const ra = visitReviewsFrom([
      { site_id: SITE, rating: 5, comment: "Đáng đi", updated_at: "2026-09-19T03:00:00Z" },
      { site_id: SITE, rating: 0, comment: "sao hỏng" },
      { rating: 4, comment: "thiếu nơi" },
      "không phải hàng",
    ]);
    expect(ra).toHaveLength(1);
    expect(ra[0].comment).toBe("Đáng đi");
  });

  it("bảng điểm bỏ nơi chưa ai nói, và bỏ lời rỗng khỏi phần trích", () => {
    const ra = siteReviewSummariesFrom([
      {
        site_id: SITE,
        so_luot: 4,
        diem_trung_binh: 4.25,
        pho_diem: { "1": 0, "2": 0, "3": 1, "4": 1, "5": 2 },
        loi_gan_day: [
          { rating: 5, comment: "Đi sớm thì vắng", created_at: "2026-09-19T01:00:00Z" },
          { rating: 4, comment: "   ", created_at: "2026-09-19T02:00:00Z" },
        ],
      },
      { site_id: "10000000-0000-4000-8000-000000000003", so_luot: 0, diem_trung_binh: 0, pho_diem: {} },
    ]);
    expect(ra).toHaveLength(1);
    expect(ra[0].count).toBe(4);
    expect(ra[0].spread["5"]).toBe(2);
    expect(ra[0].recentVoices).toHaveLength(1);
  });
});

describe("TC-12: bảng điểm mỏng thì không dựng thành điểm", () => {
  it("dưới ba lượt thì chưa hiện điểm trung bình", () => {
    const mong = { siteId: SITE, count: 2, average: 2, spread: { "1": 1, "2": 1, "3": 0, "4": 0, "5": 0 }, recentVoices: [] };
    const du = { ...mong, count: 3 };
    expect(shouldShowAverage(mong)).toBe(false);
    expect(shouldShowAverage(du)).toBe(true);
    expect(shouldShowAverage(undefined)).toBe(false);
  });

  it("điểm viết theo lối người Việt: dấu phẩy, một chữ số lẻ", () => {
    expect(formatAverage(4.25)).toBe("4,3");
    expect(formatAverage(5)).toBe("5,0");
  });
});

describe("TC-12: chữ nói với khách", () => {
  it("không mượn chữ của cái cổng", () => {
    const tatCa = JSON.stringify(VISIT_REVIEW_COPY.vi).toLowerCase();
    for (const cam of ["soát vé", "quét mã", "điểm chạm", "check-in"]) {
      expect(tatCa).not.toContain(cam);
    }
  });

  it("nhắc khách đừng ghi số điện thoại vào lời kể", () => {
    expect(VISIT_REVIEW_COPY.vi.commentHint).toContain("số điện thoại");
  });

  it("có đủ năm mức sao bằng cả hai thứ tiếng", () => {
    expect(VISIT_REVIEW_COPY.vi.stars).toHaveLength(5);
    expect(VISIT_REVIEW_COPY.en.stars).toHaveLength(5);
  });
});

describe("TC-12: hai bộ đọc, hai dạng dữ liệu, không lẫn nhau", () => {
  const dangApi = [
    {
      siteId: SITE,
      count: 12,
      average: 4.58,
      spread: { "5": 8, "4": 2 },
      recentVoices: [{ rating: 5, comment: "Thuyền vắng", createdAt: "2026-09-19T01:00:00Z" }],
    },
  ];

  it("bộ đọc dạng API đọc được dữ liệu API", async () => {
    const { siteReviewSummariesFromApi } = await import("@/domain/visit-review");
    const ra = siteReviewSummariesFromApi(dangApi);
    expect(ra).toHaveLength(1);
    expect(ra[0].count).toBe(12);
    expect(ra[0].recentVoices[0].comment).toBe("Thuyền vắng");
  });

  it("bộ đọc dạng thô KHÔNG đọc được dữ liệu API — đây là lỗi đã mắc một lần", () => {
    expect(siteReviewSummariesFrom(dangApi)).toEqual([]);
  });
});
