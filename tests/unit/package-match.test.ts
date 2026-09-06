import { describe, expect, it } from "vitest";
import { PACKAGES } from "@/content/packages";
import {
  confirmJourneyIntent,
  parseJourneyIntent,
  REQUIRED_VIETNAMESE_SAMPLE,
} from "@/domain/journey";
import {
  describeCompanions,
  matchPackagesToIntent,
  PACKAGE_MATCH_REASON_LABEL,
  PACKAGE_NO_MATCH_LABEL,
  type PackageMatchIntent,
} from "@/domain/package-match";

function intent(overrides: Partial<PackageMatchIntent> = {}): PackageMatchIntent {
  return {
    pace: "balanced",
    durationMinutes: 600,
    party: { adults: 2, children: 0, seniors: 0 },
    partyContext: [],
    visitDate: "2026-09-12",
    ...overrides,
  };
}

describe("ghép gói trải nghiệm theo điều khách kể", () => {
  it("NBJ-PM01 khớp rõ: nhà có trẻ nhỏ nhận gói gia đình trước gói di sản", () => {
    const result = matchPackagesToIntent(
      intent({
        pace: "balanced",
        durationMinutes: 600,
        party: { adults: 2, children: 2, seniors: 0 },
      }),
    );

    // Thứ tự mới là điều đáng khẳng định, không phải "có kết quả".
    expect(result.matches.map((match) => match.slug)).toEqual([
      "family-discovery",
      "heritage-day",
    ]);
    expect(result.matches[0].score).toBeGreaterThan(result.matches[1].score);
    expect(result.matches[0].strength).toBe("strong");
    expect(result.matches[0].reasons).toEqual([
      "pace-exact",
      "duration-fits",
      "companions-children",
    ]);
    // Gói di sản vẫn hợp nhịp và hợp giờ, nhưng không hề khai là dành cho
    // nhà có trẻ nhỏ — nên nó không được mượn lý do đó.
    expect(result.matches[1].strength).toBe("partial");
    expect(result.matches[1].reasons).toEqual(["pace-exact", "duration-fits"]);
    expect(result.noMatchReason).toBeUndefined();
  });

  it("NBJ-PM02 khớp rõ: câu mẫu tiếng Việt bắt buộc dẫn thẳng tới Nhịp chậm Ninh Bình", () => {
    const draft = parseJourneyIntent({
      text: REQUIRED_VIETNAMESE_SAMPLE,
      locale: "vi",
    });
    const confirmed = confirmJourneyIntent({
      draft,
      demoRunId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      durationMinutes: draft.durationMinutes ?? 600,
      party: draft.party ?? { adults: 1, children: 0, seniors: 0 },
      partyContext: draft.partyContext ?? [],
      pace: draft.pace ?? "balanced",
      walkingTolerance: draft.walkingTolerance ?? "moderate",
      budgetVnd: draft.budgetVnd,
      visitDate: "2026-09-12",
    });

    // Một `JourneyIntent` đầy đủ phải dùng thẳng được, không cần bọc lại.
    const result = matchPackagesToIntent(confirmed);

    expect(result.matches.map((match) => match.slug)).toEqual([
      "slow-ninh-binh",
    ]);
    expect(result.matches[0].strength).toBe("strong");
    expect(result.matches[0].reasons).toContain("companions-seniors");
    expect(
      result.skipped.find((entry) => entry.slug === "cinematic-sunset")?.code,
    ).toBe("pace-opposite");
  });

  it("NBJ-PM03 khớp mờ: hai ngày thư thả cho hai người chỉ còn gói hợp một phần", () => {
    const result = matchPackagesToIntent(
      intent({
        pace: "relaxed",
        durationMinutes: 1200,
        party: { adults: 2, children: 0, seniors: 0 },
        visitDate: undefined,
      }),
    );

    expect(result.matches.map((match) => match.slug)).toEqual([
      "slow-ninh-binh",
      "heritage-day",
    ]);
    // Bằng điểm nhau, nên gói đúng nhịp phải đứng trên gói chỉ gần nhịp.
    expect(result.matches[0].score).toBe(result.matches[1].score);
    expect(result.matches[0].reasons).toContain("pace-exact");
    expect(result.matches[1].reasons).toContain("pace-near");
    expect(result.matches.every((match) => match.strength === "partial")).toBe(
      true,
    );
  });

  it("NBJ-PM04 không khớp gì cả: sáu tiếng thì không gói nào đủ ngắn, và hàm nói thẳng như vậy", () => {
    const result = matchPackagesToIntent(
      intent({ durationMinutes: 360, visitDate: "2026-10-01" }),
    );

    expect(result.matches).toEqual([]);
    expect(result.noMatchReason).toBe("duration-exceeds");
    // Không có gói nào bị nhét vào cho đỡ trống, và mọi gói đều có lý do bị loại.
    expect(result.skipped).toHaveLength(PACKAGES.length);
    expect(PACKAGE_NO_MATCH_LABEL[result.noMatchReason!].vi).toContain(
      "dài hơn",
    );
  });

  it("NBJ-PM05 gói theo mùa chỉ được mời trong đúng cửa đặt chỗ của nó", () => {
    const inSeason = matchPackagesToIntent(
      intent({ pace: "relaxed", visitDate: "2026-09-20" }),
    );
    const outOfSeason = matchPackagesToIntent(
      intent({ pace: "relaxed", visitDate: "2026-10-01" }),
    );

    expect(inSeason.matches.map((match) => match.slug)).toEqual([
      "slow-ninh-binh",
      "ban-trang-tam-coc-2026",
      "heritage-day",
    ]);
    expect(outOfSeason.matches.map((match) => match.slug)).not.toContain(
      "ban-trang-tam-coc-2026",
    );
    expect(
      outOfSeason.skipped.find(
        (entry) => entry.slug === "ban-trang-tam-coc-2026",
      )?.code,
    ).toBe("outside-booking-window");
  });

  it("NBJ-PM06 bàn hai khách không được mời cho đoàn bốn người", () => {
    const result = matchPackagesToIntent(
      intent({
        pace: "relaxed",
        party: { adults: 4, children: 0, seniors: 0 },
        visitDate: "2026-09-20",
      }),
    );

    expect(
      result.skipped.find((entry) => entry.slug === "ban-trang-tam-coc-2026")
        ?.code,
    ).toBe("party-size-fixed");
  });

  it("NBJ-PM07 giá không tham gia phép ghép", () => {
    const request = intent({ pace: "relaxed", party: { adults: 3, children: 0, seniors: 0 } });
    const original = matchPackagesToIntent(request);
    // Giá trên trang gói là dữ liệu minh hoạ. Đảo tung giá mà thứ hạng đổi
    // theo thì tức là khách đang được xếp gói bằng một con số không có thật.
    const shuffledPrices = PACKAGES.map((item, index) => ({
      ...item,
      demoPriceVnd: (index + 1) * 5_000_000,
    }));

    const reranked = matchPackagesToIntent(request, shuffledPrices);

    expect(reranked.matches.map((match) => [match.slug, match.score])).toEqual(
      original.matches.map((match) => [match.slug, match.score]),
    );
    expect(reranked.skipped).toEqual(original.skipped);
  });

  it("NBJ-PM08 tất định: gọi lại nhiều lần cho ra đúng một kết quả", () => {
    const request = intent({ pace: "active", durationMinutes: 600 });
    const runs = [
      matchPackagesToIntent(request),
      matchPackagesToIntent(request),
      matchPackagesToIntent(request),
    ];

    expect(runs[1]).toEqual(runs[0]);
    expect(runs[2]).toEqual(runs[0]);
  });

  it("NBJ-PM09 không gọi đoàn có trẻ nhỏ hay có bố mẹ là 'nhóm người lớn'", () => {
    expect(
      describeCompanions(
        intent({ party: { adults: 2, children: 2, seniors: 0 } }),
      ),
    ).toEqual(["children"]);
    expect(
      describeCompanions(
        intent({
          party: { adults: 3, children: 0, seniors: 0 },
          partyContext: ["travelling-with-parents"],
        }),
      ),
    ).toEqual(["seniors"]);
    expect(
      describeCompanions(intent({ party: { adults: 2, children: 0, seniors: 0 } })),
    ).toEqual(["couple", "adults"]);
    expect(
      describeCompanions(intent({ party: { adults: 1, children: 0, seniors: 0 } })),
    ).toEqual(["solo"]);
  });

  it("NBJ-PM10 mọi lý do hiện cho khách đều có sẵn cả tiếng Việt lẫn tiếng Anh", () => {
    for (const label of [
      ...Object.values(PACKAGE_MATCH_REASON_LABEL),
      ...Object.values(PACKAGE_NO_MATCH_LABEL),
    ]) {
      expect(label.vi.length).toBeGreaterThan(0);
      expect(label.en.length).toBeGreaterThan(0);
    }
  });
});
