import { expect, test, type Page } from "@playwright/test";

// Production verification for the incident-workflow-workspace.tsx Supabase
// fix: before this change, every status transition only called setCases()
// on a hard-coded array generated fresh on every mount -- a manager
// "tiếp nhận" (acknowledging) an incident was invisible to any other
// account, or even the same account after a page refresh. This test proves
// a transition made by the manager, in one browser session, is visible to
// the director in a completely separate session (different browser
// context, no shared cookies).
//
// This test mutates real production state: INC-TA-071 moves one step
// forward (reported -> acknowledged) and stays there permanently, matching
// the established precedent for this project's other real E2E specs
// (e.g. erp-supplier-ap-workflow.spec.ts) -- the incident workflow is a
// one-way state machine by design (no "revert" RPC), so this is left as
// demo state rather than force-reset through a side channel.

async function login(page: Page, username: string, password: string) {
  await page.goto("/erp/login");
  await page.getByLabel("Tên đăng nhập").fill(username);
  await page.getByLabel("Mật khẩu").fill(password);
  await page.getByRole("button", { name: "Mở hệ thống quản lý" }).click();
  await expect(page).toHaveURL(/\/erp$/);
}

function incidentCard(page: Page, incidentId: string) {
  return page.locator("details").filter({ hasText: incidentId });
}

test("a manager's incident transition is visible to the director in a completely separate session", async ({
  browser,
}) => {
  const managerContext = await browser.newContext();
  const managerPage = await managerContext.newPage();
  try {
    await login(managerPage, "ql.vanhanh", "Quanly@2026");
    await managerPage.goto("/erp/trang-an/su-co");

    const managerCard = incidentCard(managerPage, "INC-TA-071");
    await managerCard.locator("summary").click();
    await expect(managerCard.getByText("Mới báo", { exact: true })).toBeVisible();

    await managerCard
      .getByRole("button", { name: "Tiếp nhận & giữ SLA" })
      .click();
    await expect(
      managerPage.getByText("INC-TA-071: tiếp nhận sự cố.", { exact: true }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(managerCard.getByText("Đã tiếp nhận", { exact: true })).toBeVisible();
  } finally {
    await managerContext.close();
  }

  // A brand new context = a different browser/device with no shared
  // cookies at all. If the transition only lived in the manager's local
  // React state, the director here would still see "Mới báo".
  const directorContext = await browser.newContext();
  const directorPage = await directorContext.newPage();
  try {
    await login(directorPage, "giamdoc", "Giamdoc@2026");
    await directorPage.goto("/erp/trang-an/su-co");
    await expect(
      directorPage.getByRole("heading", { name: "Sự cố đã chuyển cấp" }),
    ).toBeVisible();

    const directorCard = incidentCard(directorPage, "INC-TA-071");
    await expect(directorCard).toBeVisible();
    await directorCard.locator("summary").click();
    await expect(directorCard.getByText("Đã tiếp nhận", { exact: true })).toBeVisible();
    await expect(directorCard.getByText("Tiếp nhận sự cố")).toBeVisible();
    await expect(directorCard.getByText("Lê Hoàng Nam")).toBeVisible();
  } finally {
    await directorContext.close();
  }
});
