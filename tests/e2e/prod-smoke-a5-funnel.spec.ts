import { expect, test } from "@playwright/test";
import { loginAsDirector } from "./support/erp-login";

/**
 * A5 — bảng phễu QR → cổng soát vé, kiểm trên production, CHỈ ĐỌC.
 *
 * Trước bài này A5 **không có spec nào**, ở bất kỳ tầng nào.
 *
 * Bài này cố ý **không khẳng định một con số cụ thể nào**. Con số phễu là dữ
 * liệu thật đang chạy; neo test vào một giá trị là biến bài kiểm thành bài
 * chép lại trạng thái hôm nay, và sẽ đỏ vì lý do nghiệp vụ chứ không phải lỗi.
 * Thứ đáng kiểm là **tính trung thực của màn hình**: có dữ liệu thì hiện bảng,
 * chưa có thì nói thẳng là chưa có — `SO_TAY_HE_THONG_VI.md` mục 4 nguyên tắc
 * ③, và bẫy #4 (số bịa) trong `HANDOFF.md`.
 *
 * `/erp/marketing` chỉ dành cho giám đốc; vai khác bị đẩy về `/erp?denied=marketing`.
 */

const enabled = process.env.NBJ_A5_FUNNEL_SMOKE === "1";

test.describe("A5 production funnel dashboard smoke", () => {
  test.skip(
    !enabled,
    "Đặt NBJ_A5_FUNNEL_SMOKE=1 để chạy. Mặc định tắt vì CUSTOMER_FUNNEL_DASHBOARD_ENABLED tắt ở môi trường cục bộ.",
  );

  test.beforeAll(() => {
    const baseUrl = process.env.PLAYWRIGHT_BASE_URL;
    if (!baseUrl || new URL(baseUrl).hostname !== "ninhbinhjourney.vercel.app") {
      throw new Error(
        "A5 production smoke bắt buộc PLAYWRIGHT_BASE_URL=https://ninhbinhjourney.vercel.app trong CÙNG câu lệnh.",
      );
    }
  });

  test("giám đốc đọc được phễu thật, và màn hình nói thẳng khi chưa có dữ liệu", async ({ page }) => {
    await loginAsDirector(page);
    await page.goto("/erp/marketing");

    // Kho QR đọc được. Nếu rơi vào nhánh này thì `listMarketingQrConfig` đã ném
    // lỗi trên production — hỏng cấu hình, không phải "chưa có dữ liệu".
    await expect(
      page.getByRole("heading", { name: "Kho QR chưa sẵn sàng ở môi trường này" }),
    ).toHaveCount(0);

    // Bảng phễu hiện ra chứng minh hai việc cùng lúc:
    // CUSTOMER_FUNNEL_DASHBOARD_ENABLED=true, VÀ getCustomerFunnelReport()
    // chạy trót lọt trên production (ném lỗi thì `funnel` là null và khối này
    // biến mất hoàn toàn).
    const dashboard = page.getByTestId("customer-funnel-dashboard");
    await expect(dashboard).toBeVisible({ timeout: 25_000 });
    await expect(
      page.getByRole("heading", { name: "Từ QR marketing tới cổng soát vé" }),
    ).toBeVisible();

    // Trung thực theo nguồn: hoặc có dòng nguồn thật, hoặc nói thẳng là chưa
    // có. Không chấp nhận một bảng rỗng im lặng.
    const sourceRows = dashboard.locator("tbody tr");
    const emptySources = dashboard.getByText(
      "Bảy ngày qua chưa có lượt nào.",
    );
    const hasSourceRows = (await sourceRows.count()) > 0;
    expect(
      hasSourceRows || (await emptySources.count()) > 0,
      "Bảng nguồn vừa không có dòng nào vừa không nói là chưa có dữ liệu",
    ).toBe(true);

    // Khung giờ mở bán theo cùng luật.
    const emptySlots = dashboard.getByText("Bảy ngày qua chưa có khung giờ nào mở bán.");
    const slotCards = dashboard.locator('article:has-text("Công suất")');
    expect(
      (await slotCards.count()) > 0 || (await emptySlots.count()) > 0,
      "Khối slot vừa trống vừa không giải thích vì sao trống",
    ).toBe(true);

    // Phần không gắn được nguồn phải nằm riêng, không bị phân bổ đoán.
    // `exact: true` là bắt buộc: đoạn dẫn của bảng cũng nhắc tới khách chưa
    // rõ nguồn, nên khớp lỏng sẽ trúng hai phần tử và Playwright từ chối ở
    // strict mode.
    await expect(
      dashboard.getByText("Khách chưa rõ đến từ đâu", { exact: true }),
    ).toBeVisible();

    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      ),
    ).toBeLessThanOrEqual(1);
  });
});
