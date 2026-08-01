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

// This spec also absorbed what used to be prod-smoke-incidents.spec.ts
// (transition survives the session boundary). Keeping them separate meant
// two files creating and closing incidents at Tam Chúc at the same time --
// the only site with a camera in "Cần chú ý" state -- which raced against
// prod-smoke-site-overview-kpis reading the same site's open-incident count.
// One file, one mutator.

test("a camera-flagged report, and the transition made on it, are both real server state seen from a brand-new session", async ({
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

    // Move it one step, still in this session. Before the workspace was
    // wired to Supabase, a transition only called setCases() on an array
    // rebuilt on every mount, so it survived neither a refresh nor another
    // session -- that is what the second context below actually checks.
    await firstPage.goto("/erp/tam-chuc/su-co");
    const ownCard = firstPage
      .locator("details")
      .filter({ hasText: createdIncidentId })
      .first();
    await ownCard.locator("summary").click();
    await ownCard.getByRole("button", { name: "Tiếp nhận & giữ SLA" }).click();
    await expect(
      firstPage.getByText(`${createdIncidentId}: tiếp nhận sự cố.`, { exact: true }),
    ).toBeVisible({ timeout: 15_000 });
  } finally {
    await firstContext.close();
  }

  const secondContext = await browser.newContext();
  const secondPage = await secondContext.newPage();
  try {
    await login(secondPage, "ql.tamchuc", "Quanly@2026");
    await secondPage.goto("/erp/tam-chuc/su-co");

    const card = secondPage.locator("details").filter({ hasText: createdIncidentId }).first();
    await expect(card).toBeVisible({ timeout: 15_000 });
    await card.locator("summary").click();
    await expect(card.getByText(/^Camera AI · /).first()).toBeVisible();
    // The transition the other session made is here too, with its author.
    await expect(card.getByText("Đã tiếp nhận", { exact: true })).toBeVisible();
    await expect(card.getByText("Tiếp nhận sự cố").first()).toBeVisible();
    await expect(card.getByText("Trần Đức Long").first()).toBeVisible();

    // Close out what this test opened. There is no delete RPC (and there
    // should not be one just for tests), but leaving the incident open would
    // inflate Tam Chúc's "sự cố đang mở" KPI on every run -- ten of these had
    // accumulated, nine still open, before the 02/08/2026 audit. Walking it
    // to "Đã đóng" costs one extra pass and doubles as coverage of the full
    // manager transition chain.
    for (const step of ["Giao tổ phụ trách", "Chuyển sang xác minh", "Xác nhận & đóng"]) {
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
