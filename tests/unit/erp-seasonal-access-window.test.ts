import { describe, expect, it } from "vitest";
import {
  DEMO_ERP_ACCOUNTS,
  isDemoErpAccountActive,
  seasonalAccessWindow,
} from "@/lib/erp/demo-data";

/**
 * ERP-SMOKE-02. Tài khoản thời vụ từng neo vào hai mốc cứng, nên tới
 * 01/09/2026 nó tự khoá vĩnh viễn và kéo `erp-access.spec.ts` đỏ theo — đỏ vì
 * lý do lịch, không phải vì sản phẩm. Các bài dưới đây canh giữ đúng một điều:
 * **cửa sổ quyền luôn chứa hiện tại**, dù chạy vào ngày nào.
 */
describe("seasonalAccessWindow", () => {
  const anyDay = [
    "2026-01-01T00:30:00+07:00",
    "2026-08-31T23:00:00+07:00",
    "2026-09-01T00:30:00+07:00",
    "2026-12-31T23:30:00+07:00",
    "2027-03-15T12:00:00+07:00",
    "2030-02-28T08:00:00+07:00",
  ];

  it.each(anyDay)("cửa sổ chứa chính thời điểm đang xét (%s)", (iso) => {
    const now = new Date(iso);
    const { accessStartsAt, accessEndsAt } = seasonalAccessWindow(now);
    expect(Date.parse(accessStartsAt)).toBeLessThanOrEqual(now.getTime());
    expect(Date.parse(accessEndsAt)).toBeGreaterThan(now.getTime());
  });

  it("không nhảy tháng khi máy chủ chạy UTC vào cuối tháng", () => {
    // 31/08 lúc 23:30 giờ Việt Nam vẫn là 16:30 UTC cùng ngày; nhưng 01/09
    // lúc 00:30 giờ Việt Nam là 31/08 17:30 UTC — nếu lấy tháng theo UTC thì
    // hai thời điểm này ra hai cửa sổ khác nhau dù chỉ cách nhau một giờ.
    const truocNuaDem = seasonalAccessWindow(new Date("2026-08-31T23:30:00+07:00"));
    const sauNuaDem = seasonalAccessWindow(new Date("2026-09-01T00:30:00+07:00"));
    expect(truocNuaDem.accessEndsAt).toBe("2026-09-30T23:59:59+07:00");
    expect(sauNuaDem.accessEndsAt).toBe("2026-10-31T23:59:59+07:00");
  });

  it("giữ nguyên một kết quả trong suốt cùng một tháng", () => {
    const dauThang = seasonalAccessWindow(new Date("2026-08-01T09:00:00+07:00"));
    const cuoiThang = seasonalAccessWindow(new Date("2026-08-28T09:00:00+07:00"));
    expect(dauThang).toEqual(cuoiThang);
  });

  it("tài khoản thời vụ đang hoạt động ngay lúc này", () => {
    // Chính là điều đã hỏng: `isDemoErpAccountActive` so mốc seed với giờ chạy
    // thật, nên một mốc quá khứ khoá tài khoản mà không ai đụng vào code.
    const seasonal = DEMO_ERP_ACCOUNTS.find(
      (account) => account.workforceProfile?.employmentType === "seasonal",
    );
    expect(seasonal, "không còn tài khoản thời vụ nào trong dữ liệu trình diễn").toBeDefined();
    expect(isDemoErpAccountActive(seasonal!)).toBe(true);
    expect(seasonal!.workforceProfile?.accessEndsAt).toBeTruthy();
  });
});
