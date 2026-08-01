import { expect, test, type Page } from "@playwright/test";

// Production verification for V1/L1/L2 in docs/DANH_GIA_HE_THONG_VA_GIAO_VIEC.md.
// Before this fix, ERP_SITES[].snapshot on domain/erp.ts fanned out hard-coded
// constants to the 5 KPI cards every role saw first when entering a site.
// Confirmed live (audit mục 20.4): Tam Chúc showed "Sự cố mở 5" on this page
// while /erp/tam-chuc/su-co showed "1 hồ sơ đang mở" -- two screens
// contradicting each other about the same fact. This spec proves the
// contradiction is gone, and that the two KPIs without a real data source
// (Khách dự kiến, Tải hiện tại) now say so honestly instead of showing a
// number nobody can trust.

async function login(page: Page, username: string, password: string) {
  await page.goto("/erp/login");
  await page.getByLabel("Tên đăng nhập").fill(username);
  await page.getByLabel("Mật khẩu").fill(password);
  await page.getByRole("button", { name: "Mở hệ thống quản lý" }).click();
  await expect(page).toHaveURL(/\/erp$/);
}

async function logout(page: Page) {
  await page.goto("/erp");
  if (page.url().includes("/erp/login")) return;
  const mobileMenu = page.getByRole("button", { name: "Mở menu" });
  if (await mobileMenu.isVisible()) {
    await mobileMenu.click();
  }
  await page.getByRole("button", { name: "Đăng xuất" }).click();
  await expect(page).toHaveURL(/\/erp\/login/);
}

// Each site now has its own manager account (V12 in
// docs/DANH_GIA_HE_THONG_VA_GIAO_VIEC.md fixed the org chart so one manager
// no longer owns all four sites); logging in per site also doubles as a
// live check that a manager cannot reach a site they were not assigned.
const SITE_MANAGERS: Record<string, [string, string]> = {
  "trang-an": ["ql.vanhanh", "Quanly@2026"],
  "tam-chuc": ["ql.tamchuc", "Quanly@2026"],
  "tam-coc": ["ql.tamcoc", "Quanly@2026"],
  "bai-dinh": ["ql.baidinh", "Quanly@2026"],
};

test("số 'Sự cố mở' trên trang tổng quan cơ sở khớp đúng với module Sự cố, không còn mâu thuẫn", async ({
  page,
}) => {
  // Logged in as each site's own manager, not director: the incident module
  // narrows a director's view to escalated-only cases (by design --
  // directors only need what requires them), so a director's "hồ sơ đang
  // mở" count is a subset, not the site total. The overview KPI shows the
  // true site-wide open-incident count for every role, so the
  // apples-to-apples comparison needs the role whose module view is not
  // narrowed.
  for (const siteId of ["trang-an", "tam-chuc", "tam-coc", "bai-dinh"]) {
    const [username, password] = SITE_MANAGERS[siteId];
    await logout(page);
    await login(page, username, password);

    await page.goto(`/erp/${siteId}`);
    const overviewCard = page
      .locator("div")
      .filter({ hasText: "Sự cố mở" })
      .last();
    await expect(overviewCard).toBeVisible();
    const overviewText = await overviewCard.innerText();
    const overviewCount = Number(overviewText.match(/\d+/)?.[0]);
    expect(Number.isFinite(overviewCount)).toBe(true);

    await page.goto(`/erp/${siteId}/su-co`);
    const moduleBadge = page.getByText(/hồ sơ đang mở/);
    await expect(moduleBadge).toBeVisible({ timeout: 15_000 });
    const moduleCount = Number(
      (await moduleBadge.innerText()).match(/(\d+)\s*hồ sơ đang mở/)?.[1] ??
        NaN,
    );
    expect(Number.isFinite(moduleCount)).toBe(true);

    expect(overviewCount, `site ${siteId}: overview vs module`).toBe(
      moduleCount,
    );
  }
});

// Production verification for V12 in docs/DANH_GIA_HE_THONG_VA_GIAO_VIEC.md
// (L14): before this fix, one manager account (managedSiteIds = all 4 sites)
// managed every site at once, so "manager cannot see another site's data"
// was never actually demonstrable. Each site now has its own manager.
test("quản lý Tam Chúc không vào được dữ liệu Tràng An và ngược lại", async ({
  page,
}) => {
  await login(page, "ql.tamchuc", "Quanly@2026");
  await expect(page.locator('a[href^="/erp/trang-an/"]')).toHaveCount(0);
  await expect(page.locator('a[href^="/erp/tam-coc/"]')).toHaveCount(0);
  await expect(page.locator('a[href^="/erp/bai-dinh/"]')).toHaveCount(0);

  await page.goto("/erp/trang-an");
  await expect(page).toHaveURL(/\/erp\?denied=site/);
  await expect(page.locator('p[role="alert"]')).toContainText("chưa được phân công");

  await logout(page);
  await login(page, "ql.vanhanh", "Quanly@2026");
  await page.goto("/erp/tam-chuc");
  await expect(page).toHaveURL(/\/erp\?denied=site/);
});

test("hai KPI chưa có nguồn dữ liệu thật nói thẳng thay vì bịa số", async ({
  page,
}) => {
  await login(page, "giamdoc", "Giamdoc@2026");
  await page.goto("/erp/trang-an");

  await expect(page.getByText("Khách dự kiến")).toBeVisible();
  await expect(page.getByText("Tải hiện tại")).toBeVisible();
  await expect(page.getByText("Chưa có nguồn dữ liệu")).toHaveCount(2);
});

test("nhân sự trong ca và lượt check-in hôm nay là số đếm thật, không phải hằng số cố định", async ({
  page,
}) => {
  await login(page, "giamdoc", "Giamdoc@2026");

  const readOnShift = async (siteId: string) => {
    await page.goto(`/erp/${siteId}`);
    const card = page.locator("div").filter({ hasText: "Nhân sự trong ca" }).last();
    await expect(card).toBeVisible();
    return Number((await card.innerText()).match(/\d+/)?.[0] ?? NaN);
  };

  const trangAn = await readOnShift("trang-an");
  const tamChuc = await readOnShift("tam-chuc");
  expect(Number.isFinite(trangAn)).toBe(true);
  expect(Number.isFinite(tamChuc)).toBe(true);
  // The old hard-coded constants were 84 and 112 respectively; a real count
  // derived from actual attendance events landing on those exact numbers
  // again would be an implausible coincidence worth investigating, not
  // proof of success.
  expect(trangAn === 84 && tamChuc === 112).toBe(false);
});
