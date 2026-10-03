import { describe, expect, it } from "vitest";
import {
  lyDoChuyenCapChu,
  parseIncidentDraft,
  thoiLuongChu,
  REQUIRED_INCIDENT_SAMPLE,
} from "@/domain/incident";

describe("incident draft parser", () => {
  it("NBJ-D11 creates an editable human-confirmed draft from the required sample", () => {
    const draft = parseIncidentDraft({
      id: "draft-1",
      demoRunId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      text: REQUIRED_INCIDENT_SAMPLE,
    });

    expect(draft.humanConfirmationRequired).toBe(true);
    expect(draft.siteId).toBe(
      "10000000-0000-4000-8000-000000000001",
    );
    expect(draft.category).toBe("crowd-capacity");
    expect(draft.suggestedSeverity).toBe("P3");
    expect(draft.waitTimeMinutes).toBe(20);
    expect(draft.resourceRequest).toEqual({
      resourceType: "queue-support-staff",
      quantity: 3,
    });
    expect(draft.sopId).toBe(
      "50000000-0000-4000-8000-000000000001",
    );
  });

  it("NBJ-D12 leaves unknown fields absent before human confirmation", () => {
    const draft = parseIncidentDraft({
      id: "draft-2",
      demoRunId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      text: "Có một vấn đề cần kiểm tra thêm.",
    });

    expect(draft.humanConfirmationRequired).toBe(true);
    expect(draft.siteId).toBeUndefined();
    expect(draft.category).toBeUndefined();
    expect(draft.suggestedSeverity).toBeUndefined();
    expect(draft.resourceRequest).toBeUndefined();
  });
});

describe("thời lượng và lý do chuyển cấp đọc như người nói", () => {
  it("đổi phút ra phút, giờ, ngày", () => {
    expect(thoiLuongChu(45)).toBe("45 phút");
    expect(thoiLuongChu(200)).toBe("3 giờ 20 phút");
    expect(thoiLuongChu(120)).toBe("2 giờ");
    expect(thoiLuongChu(92149)).toBe("63 ngày");
  });

  it("viết lại câu tự chuyển cấp của kho, câu khác giữ nguyên", () => {
    expect(
      lyDoChuyenCapChu("Quá hạn SLA 10 phút (trễ 1527 phút). Hệ thống tự chuyển cấp, không chờ thao tác của người trực."),
    ).toBe("Hạn phản hồi là 10 phút, đã trễ 1 ngày. Hệ thống tự chuyển lên cấp trên, không chờ người trực bấm.");
    expect(lyDoChuyenCapChu("Cần thêm người ở bến.")).toBe("Cần thêm người ở bến.");
  });
});
