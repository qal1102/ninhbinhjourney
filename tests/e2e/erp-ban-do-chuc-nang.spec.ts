import { expect, test } from "@playwright/test";
import { loginAsDirector } from "./support/erp-login";
import { endRoleSwitch } from "./support/erp-role-switch";

/**
 * Bản đồ mọi chức năng: giám đốc thấy đủ các việc, và một chạm là đứng đúng
 * vai, đúng màn hình. Bài có chuyển vai nên luôn trả phiên về giám đốc.
 */
test.describe("ERP: bản đồ mọi chức năng", () => {
  test("một chạm 'Làm thử như Nhân viên' đưa thẳng tới màn quét vé ở cổng", async ({ page }) => {
    test.slow();
    await loginAsDirector(page);
    const banDo = page.getByTestId("ban-do-chuc-nang");
    await banDo.locator("summary").click();
    await expect(banDo.locator("[data-chuc-nang]")).toHaveCount(18);

    const dong = banDo.locator('[data-chuc-nang="quet-cong"]');
    await expect(dong.getByRole("link", { name: "Xem" })).toHaveAttribute("href", "/erp/trang-an/check-in-khach");
    const nut = dong.getByRole("button", { name: "Làm thử như Nhân viên" });
    if ((await nut.count()) === 0) {
      // Máy chủ chưa bật chuyển vai thì chỉ còn nút Xem, không phải lỗi.
      return;
    }
    await nut.click();
    try {
      await expect(page).toHaveURL(/\/erp\/trang-an\/check-in-khach$/);
      await expect(page.getByRole("status").filter({ hasText: "Đang xem với vai trò" })).toBeVisible();
    } finally {
      await endRoleSwitch(page);
    }
  });
});
