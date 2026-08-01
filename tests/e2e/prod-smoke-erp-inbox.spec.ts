import { expect, test, type Page } from "@playwright/test";

// Production verification for V5 (docs/DANH_GIA_HE_THONG_VA_GIAO_VIEC.md
// muc 7 dot 2, L7 + UX#2): the notification bell used to show exactly one
// aggregated sentence ("N việc cần tài khoản này xử lý") from a single
// "urgent" query -- there was no categorized inbox, so every role had to
// remember on its own where its work lived. `/api/erp/assistant` now has a
// second "inbox" intent that returns real per-category counts, and
// `erp-app-controls.tsx` renders them as an actual list instead of one
// blob.
//
// This is a genuine regression risk for the exact bug class this project
// has hit before (L2: two screens quoting different numbers for the same
// fact) -- the inbox's "Sự cố đã chuyển cấp" row and the director
// dashboard's own "sự cố đã chuyển cấp" stat (built for V2) are computed
// via two different code paths (per-site getIncidentCases() filtered
// client-side in the assistant route vs. listEscalatedIncidents() on the
// dashboard). This test proves they still agree.

async function login(page: Page, username: string, password: string) {
  await page.goto("/erp/login");
  await page.getByLabel("Tên đăng nhập").fill(username);
  await page.getByLabel("Mật khẩu").fill(password);
  await page.getByRole("button", { name: "Mở hệ thống quản lý" }).click();
  await expect(page).toHaveURL(/\/erp$/);
}

test("director: the bell's escalated-incident count matches the dashboard's own count", async ({
  page,
}) => {
  await login(page, "giamdoc", "Giamdoc@2026");

  const dashboardStat = page.locator("dl div", { hasText: "sự cố đã chuyển cấp" });
  await expect(dashboardStat).toBeVisible();
  const dashboardText = await dashboardStat.innerText();
  const dashboardCount = Number(dashboardText.match(/\d+/)?.[0] ?? "-1");
  expect(dashboardCount).toBeGreaterThanOrEqual(0);

  const bell = page.locator('summary[aria-label="Mở trung tâm thông báo"]');
  await bell.click();

  const inboxRow = page.locator("a", { hasText: "Sự cố đã chuyển cấp" });
  if (dashboardCount > 0) {
    await expect(inboxRow).toBeVisible({ timeout: 15_000 });
    const rowText = await inboxRow.innerText();
    const inboxCount = Number(rowText.match(/\d+/)?.[0] ?? "-1");
    expect(inboxCount).toBe(dashboardCount);
  } else {
    // 0-count categories are filtered out of the visible list by design
    // (see erp-app-controls.tsx) -- absence is the correct proof here.
    await expect(inboxRow).toHaveCount(0);
  }
});

test("employee: the bell opens and shows either real categorized work or an honest empty state", async ({
  page,
}) => {
  await login(page, "nv.trangan", "Nhanvien@2026");

  const bell = page.locator('summary[aria-label="Mở trung tâm thông báo"]');
  await bell.click();

  await expect(page.getByRole("heading", { name: "Việc của tôi" })).toBeVisible();

  const hasWork = page.getByText(/Ca bị trả lại|Phiếu việc bị trả lại|Sự cố đang xử lý/);
  const empty = page.getByText("Không có việc gấp đang chờ tài khoản này.");
  await expect(hasWork.or(empty).first()).toBeVisible({ timeout: 15_000 });
});
