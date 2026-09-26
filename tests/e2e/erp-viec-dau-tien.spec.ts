import { expect, test } from "@playwright/test";
import { ERP_DIRECTOR_PASSWORD } from "./support/erp-credentials";

/**
 * "Việc nên làm trước" — một câu duy nhất ở đầu trang chủ giám đốc, chỉ khi có việc.
 *
 * Bài này canh thứ dễ mất nhất khi trang chủ được xếp lại: khối phải đứng
 * **trên cùng**, trước cả vòng dẫn và bảng điều hành. Nó là mũi tên chỉ
 * đường; tụt xuống giữa trang thì thành một ô thống kê nữa, và hết tác dụng.
 *
 * Chỉ đọc, không ghi một hàng nào, nên chạy thẳng trên production cũng sạch.
 */

async function loginAsDirector(page: import("@playwright/test").Page) {
  await page.goto("/erp/login");
  await page.getByLabel("Tên đăng nhập").fill("giamdoc");
  await page.getByLabel("Mật khẩu").fill(ERP_DIRECTOR_PASSWORD);
  await page.getByRole("button", { name: "Mở hệ thống quản lý" }).click();
  await expect(page).toHaveURL(/\/erp$/);
}

test("việc nên làm trước đứng trên cùng và nói rõ vì sao nó đứng trước", async ({ page }) => {
  await loginAsDirector(page);

  // Không có việc chờ thì khung không hiện: khối quyết định trong bảng số
  // liệu đã nói "0 hồ sơ đang chờ", một khung báo trống nữa chỉ đẩy số xuống.
  await expect(page.locator("#quyet-dinh-giam-doc")).toBeVisible();
  const viec = page.getByTestId("viec-dau-tien");
  if ((await viec.count()) === 0) return;
  await expect(viec).toContainText("Việc nên làm trước");

  const viTri = await page.evaluate(() => {
    const v = document.querySelector('[data-testid="viec-dau-tien"]');
    const vong = document.querySelector('[data-testid="vong-dan"]');
    const main = document.querySelector("main");
    if (!v || !main) return null;
    const conCuaMain = Array.from(main.children);
    return {
      // Khối phải là một trong hai thứ đầu tiên trong thân trang (chỗ đầu có
      // thể là dòng báo "chưa được phân công" khi có tham số denied).
      viTriTrongMain: conCuaMain.indexOf(v),
      topViec: v.getBoundingClientRect().top + window.scrollY,
      topVong: vong ? vong.getBoundingClientRect().top + window.scrollY : null,
      tranNgang: document.documentElement.scrollWidth > window.innerWidth + 1,
    };
  });

  expect(viTri).not.toBeNull();
  expect(viTri!.viTriTrongMain).toBeLessThanOrEqual(1);
  expect(viTri!.tranNgang).toBe(false);
  if (viTri!.topVong !== null) {
    expect(viTri!.topViec).toBeLessThan(viTri!.topVong);
  }
});

test("có việc thì có nút mở thẳng tới nơi làm; hết việc thì không bịa nút", async ({ page }) => {
  await loginAsDirector(page);

  const viec = page.getByTestId("viec-dau-tien");
  const nut = page.getByTestId("viec-dau-tien-mo");

  if ((await viec.count()) === 0) {
    await expect(nut).toHaveCount(0);
    return;
  }

  await expect(nut).toBeVisible();
  const duong = await nut.getAttribute("href");
  // Hai dạng đích hợp lệ, và **chỉ** hai: một màn ERP khác, hoặc một neo
  // xuống khối quyết định nằm ngay trong trang này. Việc nào mà nơi quyết
  // định lại nằm trên chính trang chủ thì phải dùng neo — đưa giám đốc sang
  // một màn chỉ đọc được là đúng cái bẫy `erp-access.spec.ts` canh giữ.
  expect(duong).toMatch(/^(\/erp\/|#)/);
  await nut.click();
  if (duong!.startsWith("#")) {
    await expect(page.locator(duong!)).toBeVisible();
    return;
  }
  await expect(page).toHaveURL(new RegExp(duong!.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});
