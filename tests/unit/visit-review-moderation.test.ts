import { describe, expect, it } from "vitest";

import {
  canModerateReviews,
  MODERATION_COPY,
  MODERATION_QUOTA_30_DAYS,
  remainingQuota,
  viPhamLuatToanNamSao,
} from "@/domain/visit-review-moderation";

describe("TC-12 mục 3: ai ẩn được, ẩn bao nhiêu", () => {
  it("giám đốc không hạn mức, quản lý có hạn mức nhỏ, ba vai còn lại không đụng tới", () => {
    expect(MODERATION_QUOTA_30_DAYS.director).toBeNull();
    expect(MODERATION_QUOTA_30_DAYS.manager).toBe(20);
    for (const vai of ["accountant", "chief-accountant", "employee"] as const) {
      expect(MODERATION_QUOTA_30_DAYS[vai]).toBe(0);
      expect(canModerateReviews(vai)).toBe(false);
    }
    expect(canModerateReviews("director")).toBe(true);
    expect(canModerateReviews("manager")).toBe(true);
  });

  it("đếm phần còn lại, không bao giờ trả số âm", () => {
    expect(remainingQuota("manager", 0)).toBe(20);
    expect(remainingQuota("manager", 19)).toBe(1);
    expect(remainingQuota("manager", 20)).toBe(0);
    expect(remainingQuota("manager", 99)).toBe(0);
    expect(remainingQuota("director", 500)).toBeNull();
  });
});

describe("TC-12 mục 4: không được ẩn tới mức toàn 5 sao", () => {
  it("ẩn lời 2 sao cuối cùng thì bị chặn", () => {
    expect(
      viPhamLuatToanNamSao({ ratingBeingHidden: 2, visibleRatings: [5, 5, 5, 2] }),
    ).toBe(true);
  });

  it("còn một lời không phải 5 sao khác thì vẫn ẩn được", () => {
    expect(
      viPhamLuatToanNamSao({ ratingBeingHidden: 2, visibleRatings: [5, 5, 3, 2] }),
    ).toBe(false);
  });

  it("ẩn một lời 5 sao thì không bao giờ vướng luật này", () => {
    expect(
      viPhamLuatToanNamSao({ ratingBeingHidden: 5, visibleRatings: [5, 5, 5, 5] }),
    ).toBe(false);
  });

  it("nơi mới có dưới ba lời thì không áp luật, để còn dọn được spam thật", () => {
    expect(viPhamLuatToanNamSao({ ratingBeingHidden: 1, visibleRatings: [5, 1] })).toBe(false);
    expect(viPhamLuatToanNamSao({ ratingBeingHidden: 1, visibleRatings: [1] })).toBe(false);
  });

  it("ẩn một trong hai lời thấp thì được, ẩn nốt lời còn lại thì không", () => {
    expect(viPhamLuatToanNamSao({ ratingBeingHidden: 1, visibleRatings: [5, 5, 1, 3] })).toBe(false);
    expect(viPhamLuatToanNamSao({ ratingBeingHidden: 3, visibleRatings: [5, 5, 3] })).toBe(true);
  });
});

describe("TC-12: chữ nói với người vận hành", () => {
  it("câu từ chối nói rõ vì sao, không nói trống không", () => {
    expect(MODERATION_COPY.toanNamSao).toContain("toàn năm sao trông giả");
    expect(MODERATION_COPY.hetHanMuc(20)).toContain("20 lời trong 30 ngày");
    expect(MODERATION_COPY.thieuLyDo).toContain("lưu lại tên người ẩn");
  });

  it("nói rõ phần hạn mức còn lại", () => {
    expect(MODERATION_COPY.conLai(7)).toContain("còn ẩn được 7 lời");
    expect(MODERATION_COPY.conLai(null)).toContain("không giới hạn");
  });
});
