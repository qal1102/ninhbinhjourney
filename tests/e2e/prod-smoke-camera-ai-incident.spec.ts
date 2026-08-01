import { expect, test, type Page } from "@playwright/test";

// Production verification for V4 (docs/DANH_GIA_HE_THONG_VA_GIAO_VIEC.md
// muc 3 L5, muc 7 dot 2): the last decorative button found in the 31/07
// audit. `camera-ai-workspace.tsx`'s "Giao quan ly kiem tra" / "Tao phieu
// hien truong" / "Bao quan ly" used to only call setActionMessage() -- no
// Server Action, nothing persisted, invisible to anyone else. Migration
// 202608010017 added a real erp_incident_report_from_camera RPC, wired into
// the existing "su co" (incident) module instead of a new table.
//
// Camera-created incidents are deliberately never escalated (P3/P4 only --
// see the migration contract test), so the director's Sự cố view (which
// only shows escalated cases) is the wrong place to look for one; the site
// manager's view is unfiltered. This submits a real camera report in one
// browser context and confirms a brand-new context (fresh cookie jar, same
// account) sees it too -- proof the report is real Supabase state, not
// client-side React state or a per-browser demo-cookie: a fresh context has
// no prior cookie to read from either way, so this only passes if the
// report actually persisted server-side.
//
// Uses Tam Chúc, not Tràng An: `createFeeds()` only ever marks a camera
// "attention" when `site.snapshot.capacityPercent >= 80` (index 1). Tràng
// An sits at 68% (confirmed in docs/DANH_GIA_HE_THONG_VA_GIAO_VIEC.md muc
// 20.4), so every one of its cameras is "stable"/"offline" -- there would be
// no "Cần chú ý" camera to click. Tam Chúc is at 83%.

async function login(page: Page, username: string, password: string) {
  await page.goto("/erp/login");
  await page.getByLabel("Tên đăng nhập").fill(username);
  await page.getByLabel("Mật khẩu").fill(password);
  await page.getByRole("button", { name: "Mở hệ thống quản lý" }).click();
  await expect(page).toHaveURL(/\/erp$/);
}

test("a camera-flagged report a manager creates is visible in Sự cố from a brand-new session", async ({
  browser,
}) => {
  const firstContext = await browser.newContext();
  const firstPage = await firstContext.newPage();
  let createdIncidentId = "";
  try {
    await login(firstPage, "ql.tamchuc", "Quanly@2026");
    await firstPage.goto("/erp/tam-chuc/camera-ai");

    // Disambiguate from the filter-toggle bar, which also has a button
    // labelled exactly "Cần chú ý" -- scope to a camera card, which always
    // renders its zone name alongside the status badge.
    const attentionCamera = firstPage
      .locator("button")
      .filter({ hasText: "Cần chú ý" })
      .filter({ hasText: "Bến thuyền" });
    await attentionCamera.click();

    const dialog = firstPage.getByRole("dialog");
    const reportButton = dialog.getByRole("button", { name: "Tạo phiếu hiện trường" });
    await reportButton.click();

    const status = dialog.locator('[role="status"]');
    await expect(status).toBeVisible({ timeout: 15_000 });
    const statusText = await status.innerText();
    expect(statusText).toContain("Đã tạo phiếu hiện trường");
    createdIncidentId = statusText.match(/hồ sơ (INC-\S+) đã/)?.[1] ?? "";
    expect(createdIncidentId).not.toBe("");
  } finally {
    await firstContext.close();
  }

  const secondContext = await browser.newContext();
  const secondPage = await secondContext.newPage();
  try {
    await login(secondPage, "ql.tamchuc", "Quanly@2026");
    await secondPage.goto("/erp/tam-chuc/su-co");

    const card = secondPage.locator("details").filter({ hasText: createdIncidentId });
    await expect(card).toBeVisible({ timeout: 15_000 });
    await card.locator("summary").click();
    await expect(card.getByText(/^Camera AI · /)).toBeVisible();
    await expect(card.getByText("Mới báo", { exact: true })).toBeVisible();
  } finally {
    await secondContext.close();
  }
});
