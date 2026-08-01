import { expect, test, type Page } from "@playwright/test";

// Production verification for the incident-workflow-workspace.tsx Supabase
// fix: before that change, every status transition only called setCases()
// on a hard-coded array regenerated on each mount -- a manager "tiếp nhận"
// (acknowledging) an incident was invisible to any other session, and even
// to the same account after a refresh. This test proves a transition made
// in one browser session is real server state by reading it back from a
// completely separate session (new context, no shared cookies).
//
// It provisions its own incident instead of walking the seeded ones.
// The original version hard-coded INC-TA-071 *and* its starting status, so
// it could only ever pass once; worse, the incident chain is one-way (there
// is no revert RPC), so repeated runs marched all three seeded Tràng An
// incidents to "closed" and left the demo site with nothing to show. The
// 02/08/2026 audit had to restore them by migration.
//
// Now the test creates a camera-flagged incident (the V4 path), transitions
// it, verifies across sessions, and closes it out -- so a run leaves no open
// incident behind and consumes no seeded data.
//
// Both sessions are the site manager rather than manager + director on
// purpose: camera-created incidents are never escalated, and the director's
// Sự cố view deliberately shows only escalated cases. Cross-account
// visibility is covered by prod-smoke-director-decision-inbox and
// prod-smoke-erp-inbox; what is under test here is that a *transition*
// survives the session boundary at all.
//
// Tam Chúc, not Tràng An: only a site at >= 80% capacity renders a camera
// in "Cần chú ý" state, which is what the report button needs.

const MANAGER_STEPS = ["Tiếp nhận & giữ SLA", "Giao tổ phụ trách", "Chuyển sang xác minh", "Xác nhận & đóng"] as const;

async function login(page: Page, username: string, password: string) {
  await page.goto("/erp/login");
  await page.getByLabel("Tên đăng nhập").fill(username);
  await page.getByLabel("Mật khẩu").fill(password);
  await page.getByRole("button", { name: "Mở hệ thống quản lý" }).click();
  await expect(page).toHaveURL(/\/erp$/);
}

test("a manager's incident transition is real server state, visible from a completely separate session", async ({
  browser,
}) => {
  let incidentId = "";

  const firstContext = await browser.newContext();
  const firstPage = await firstContext.newPage();
  try {
    await login(firstPage, "ql.tamchuc", "Quanly@2026");

    // 1. Provision an incident of our own via the Camera AI report button.
    await firstPage.goto("/erp/tam-chuc/camera-ai");
    await firstPage
      .locator("button")
      .filter({ hasText: "Cần chú ý" })
      .filter({ hasText: "Bến thuyền" })
      .click();
    const dialog = firstPage.getByRole("dialog");
    await dialog.getByRole("button", { name: "Tạo phiếu hiện trường" }).click();
    const status = dialog.locator('[role="status"]');
    await expect(status).toBeVisible({ timeout: 15_000 });
    incidentId = (await status.innerText()).match(/hồ sơ (INC-\S+) đã/)?.[1] ?? "";
    expect(incidentId, "không lấy được mã sự cố vừa tạo").not.toBe("");

    // 2. Transition it once, in this session.
    await firstPage.goto("/erp/tam-chuc/su-co");
    const card = firstPage.locator("details").filter({ hasText: incidentId });
    await card.locator("summary").click();
    await expect(card.getByText("Mới báo", { exact: true })).toBeVisible();
    await card.getByRole("button", { name: MANAGER_STEPS[0] }).click();
    await expect(
      firstPage.getByText(`${incidentId}: tiếp nhận sự cố.`, { exact: true }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(card.getByText("Đã tiếp nhận", { exact: true })).toBeVisible();
  } finally {
    await firstContext.close();
  }

  // 3. A brand new context = a different device, empty cookie jar. If the
  //    transition had only lived in the first session's React state, this
  //    would still read "Mới báo".
  const secondContext = await browser.newContext();
  const secondPage = await secondContext.newPage();
  try {
    await login(secondPage, "ql.tamchuc", "Quanly@2026");
    await secondPage.goto("/erp/tam-chuc/su-co");

    const card = secondPage.locator("details").filter({ hasText: incidentId });
    await expect(card).toBeVisible({ timeout: 15_000 });
    await card.locator("summary").click();
    await expect(card.getByText("Đã tiếp nhận", { exact: true })).toBeVisible();
    await expect(card.getByText("Tiếp nhận sự cố")).toBeVisible();
    await expect(card.getByText("Trần Đức Long")).toBeVisible();

    // 4. Close out what this test opened, so it never shows up as an open
    //    incident on the site's dashboard.
    for (const step of MANAGER_STEPS.slice(1)) {
      await card.getByRole("button", { name: step }).click();
      await expect(card.getByRole("button", { name: step })).toHaveCount(0, {
        timeout: 15_000,
      });
    }
    await expect(card.getByText("Đã đóng", { exact: true })).toBeVisible();
  } finally {
    await secondContext.close();
  }
});
