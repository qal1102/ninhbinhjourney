import { expect, test } from "@playwright/test";
import { BAN_DO_CHUC_NANG, CHUC_NANG_WEB } from "@/domain/ban-do-chuc-nang";
import { TONG_VIEC_TRA_CUU, VONG_KHACH } from "@/domain/huong-dan";
import { loginAsDirector } from "./support/erp-login";
import { endRoleSwitch } from "./support/erp-role-switch";

/**
 * Màn Hướng dẫn: bấm một việc là tới đúng màn, chỗ cần bấm được khoanh, thẻ
 * chỉ dẫn ở góc có "Sang bước tiếp". Phần bấm chỉ mở màn và đọc, không bấm
 * nút nghiệp vụ nào, nên không ghi hàng nào vào kho. Bài có chuyển vai nên
 * luôn trả phiên về giám đốc.
 */
test.describe("ERP: màn Hướng dẫn", () => {
  test("đủ bảy bước và mọi việc tra cứu; trang đầu có lối vào", async ({ page }) => {
    await loginAsDirector(page);
    await expect(page.getByTestId("loi-vao-huong-dan")).toBeVisible();
    await page.getByTestId("loi-vao-huong-dan").getByRole("link", { name: "Mở danh sách đầy đủ →" }).click();
    await expect(page).toHaveURL(/\/erp\/huong-dan$/);
    // Ba thẻ tách riêng: mặc định là điều hành, web và trình diễn ở thẻ khác.
    await expect(page.locator("[data-chuc-nang]")).toHaveCount(TONG_VIEC_TRA_CUU);
    await expect(page.locator("[data-chuc-nang-web]")).toHaveCount(0);
    await page.locator("[data-the-thu=web]").click();
    await expect(page).toHaveURL(/xem=web/);
    await expect(page.locator("[data-chuc-nang-web]")).toHaveCount(CHUC_NANG_WEB.length);
    await expect(page.locator("[data-chuc-nang]")).toHaveCount(0);
    await page.locator("[data-the-thu=vong]").click();
    await expect(page.locator("[data-buoc]")).toHaveCount(VONG_KHACH.length);
    await page.goto("/erp/huong-dan?xem=erp&moi=1");
    await expect(page.locator("[data-chuc-nang]")).toHaveCount(
      BAN_DO_CHUC_NANG.flatMap((nhom) => nhom.chucNang).filter((cn) => cn.moi).length,
    );
    const tranNgang = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    expect(tranNgang).toBe(false);
  });

  test("Đưa tôi tới: khoanh đúng chỗ, thẻ chỉ dẫn dẫn sang bước kế", async ({ page }) => {
    await loginAsDirector(page);
    await page.goto("/erp/huong-dan?xem=vong");
    await page.locator('[data-buoc="vong-trang-dau"]').getByRole("link", { name: "Đưa tôi tới →" }).click();
    await expect(page).toHaveURL(/\/erp\?chi=vong-trang-dau$/);

    const the = page.getByTestId("chi-diem");
    await expect(the).toBeVisible();
    await expect(the).toContainText("Bước 7/7");
    await expect(the).toHaveAttribute("data-thay", "thay");
    await expect(page.locator(".chi-diem-sang")).toHaveAttribute("data-chi", "bon-o");
    await expect(the).toContainText("Bốn ô này");

    // Bước cuối: nút dẫn về màn Hướng dẫn; tắt thẻ là bỏ khoanh và bỏ `chi`.
    await expect(the.getByRole("link", { name: "Xong vòng khách ✓" })).toHaveAttribute("href", "/erp/huong-dan");
    await the.getByRole("button", { name: "Tắt hướng dẫn" }).click();
    await expect(the).toHaveCount(0);
    await expect(page.locator(".chi-diem-sang")).toHaveCount(0);
    expect(page.url()).not.toContain("chi=");

    // Bước 6 → thẻ có nút sang bước 7.
    await page.goto(`/erp/marketing?ky=7-ngay&chi=vong-kenh-khach#phieu-khach`);
    if ((await page.getByTestId("customer-funnel-dashboard").count()) > 0) {
      await expect(page.locator(".chi-diem-sang")).toHaveAttribute("data-chi", "phieu-khach");
    } else {
      // Máy cục bộ không có kho phễu: thẻ phải nói thẳng là chưa thấy, và mở sẵn các bước.
      await expect(page.getByTestId("chi-diem")).toHaveAttribute("data-thay", "khong-thay", { timeout: 10_000 });
      await expect(page.getByTestId("chi-diem")).toContainText("Chưa thấy chỗ cần bấm");
    }
    await page.getByTestId("chi-diem").getByRole("link", { name: "Sang bước 7 →" }).click();
    await expect(page).toHaveURL(/\/erp\?chi=vong-trang-dau$/);
    await expect(page.getByTestId("chi-diem")).toContainText("Bước 7/7");
  });

  test("trang đặt vé khoanh ô khung giờ hoặc ô ngày, không ghi gì", async ({ page }) => {
    await page.goto(VONG_KHACH[0].duongDan + "&chi=vong-dat-ve");
    const the = page.getByTestId("chi-diem");
    await expect(the).toContainText("Bước 1/7");
    await expect(page.locator('.chi-diem-sang[data-chi="dat-ve"]')).toBeVisible();
    await expect(the.getByRole("link", { name: "Sang bước 2 →" })).toHaveAttribute(
      "href",
      "/erp/khach-hang?chi=vong-don",
    );
  });

  test("việc của vai khác: Làm thử chuyển vai, tới đúng màn và vẫn khoanh", async ({ page }) => {
    test.slow();
    await loginAsDirector(page);
    await page.goto("/erp/huong-dan");
    const nut = page.locator('[data-chuc-nang="bao-cao"]').getByRole("button", { name: "Làm thử như Nhân viên →" });
    if ((await nut.count()) === 0) return; // máy chủ chưa bật chuyển vai
    await nut.click();
    try {
      await expect(page).toHaveURL(/\/erp\/trang-an\/bao-cao-hien-truong\?chi=bao-cao$/);
      await expect(page.getByRole("status").filter({ hasText: "Đang xem với vai trò" })).toBeVisible();
      await expect(page.locator('.chi-diem-sang[data-chi="bao-cao-moi"]')).toBeVisible();
      await expect(page.getByTestId("chi-diem").getByRole("button", { name: "← Về giám đốc, mở hướng dẫn" })).toBeVisible();
    } finally {
      await endRoleSwitch(page);
    }
  });
});
