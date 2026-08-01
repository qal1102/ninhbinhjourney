import { expect, test, type Page } from "@playwright/test";

// Production verification for the "Dự án & sự kiện" module built from
// scratch (it previously had zero actions of any kind, not even a fake
// one -- everything was hard-coded in the component). Both tests prove a
// change made by one account, in one browser session, is visible to a
// completely different account in a completely separate session.
//
// Both tests are written to be safe to re-run: they read current state
// before acting instead of assuming a fixed starting point.
//
// They also clean up after themselves. The budget test used to raise the
// event budget by 0.1 tỷ per run and never put it back, so ten runs had
// silently drifted the seeded 12,8 tỷ of "Lễ hội Tràng An 2026" up to
// 13,8 tỷ -- a demo number quietly going wrong. It now files a second
// request restoring the original figure and has the director approve that
// too, so a full run is budget-neutral.

async function login(page: Page, username: string, password: string) {
  await page.goto("/erp/login");
  await page.getByLabel("Tên đăng nhập").fill(username);
  await page.getByLabel("Mật khẩu").fill(password);
  await page.getByRole("button", { name: "Mở hệ thống quản lý" }).click();
  await expect(page).toHaveURL(/\/erp$/);
}

test("nhân viên bắt đầu xử lý một gói việc, quản lý ở phiên khác thấy đúng trạng thái mới", async ({
  browser,
}) => {
  const employeeContext = await browser.newContext();
  const employeePage = await employeeContext.newPage();
  try {
    await login(employeePage, "nv.trangan", "Nhanvien@2026");
    await employeePage.goto("/erp/trang-an/du-an-su-kien");

    const card = employeePage.locator("details").filter({ hasText: "EV-TA-041" });
    await expect(card).toBeVisible({ timeout: 15_000 });
    await card.locator("summary").click();

    // An brand new context = a different device with no shared cookies.
    // If the work item is still "open" (first run), move it forward once
    // so there is something real to prove; if a previous run already
    // moved it to "in-progress", skip -- the manager assertion below
    // still holds either way.
    const startButton = card.getByRole("button", { name: "Bắt đầu xử lý" });
    if (await startButton.isVisible().catch(() => false)) {
      await startButton.click();
      await expect(employeePage.getByText(/EV-TA-041: đã cập nhật\./)).toBeVisible({
        timeout: 15_000,
      });
    }
  } finally {
    await employeeContext.close();
  }

  const managerContext = await browser.newContext();
  const managerPage = await managerContext.newPage();
  try {
    await login(managerPage, "ql.vanhanh", "Quanly@2026");
    await managerPage.goto("/erp/trang-an/du-an-su-kien");
    const card = managerPage.locator("details").filter({ hasText: "EV-TA-041" });
    await expect(card).toBeVisible({ timeout: 15_000 });
    await expect(card.getByText("Đang xử lý", { exact: true })).toBeVisible({ timeout: 15_000 });
  } finally {
    await managerContext.close();
  }
});

function parseBillion(text: string) {
  const match = text.match(/([\d.,]+)/);
  return match ? Number(match[1].replace(",", ".")) : NaN;
}

test("quản lý gửi yêu cầu đổi ngân sách, giám đốc duyệt ở phiên khác, ngân sách sự kiện cập nhật xuyên tài khoản", async ({
  browser,
}) => {
  // Four real logins across three contexts (raise, approve, restore,
  // approve) -- the restore leg roughly doubles the original runtime.
  test.slow();

  const stamp = Date.now();
  const uniqueSummary = `PROD-SMOKE tăng ngân sách ${stamp}`;
  const restoreSummary = `PROD-SMOKE trả lại ngân sách ${stamp}`;
  let proposedBudget = 0;
  let originalBudget = 0;

  /** Only a manager may file a change request (project.change.request). */
  async function fileBudgetRequest(summary: string, billion: number) {
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      await login(page, "ql.vanhanh", "Quanly@2026");
      await page.goto("/erp/trang-an/du-an-su-kien");
      const form = page.locator("form").filter({ has: page.locator('select[name="kind"]') });
      await form.locator('select[name="kind"]').selectOption("budget");
      await form.locator('input[name="summary"]').fill(summary);
      await form.locator('input[name="proposedBudgetBillion"]').fill(String(billion));
      await form.getByRole("button", { name: "Gửi yêu cầu" }).click();
      await expect(page.getByText(summary)).toBeVisible({ timeout: 15_000 });
    } finally {
      await context.close();
    }
  }

  const managerContext = await browser.newContext();
  const managerPage = await managerContext.newPage();
  try {
    await login(managerPage, "ql.vanhanh", "Quanly@2026");
    await managerPage.goto("/erp/trang-an/du-an-su-kien");

    const budgetCard = managerPage.locator("article").filter({ hasText: "Ngân sách" }).first();
    const budgetText = (await budgetCard.locator("p").nth(1).textContent()) ?? "";
    originalBudget = parseBillion(budgetText);
    expect(Number.isFinite(originalBudget)).toBe(true);
    proposedBudget = Math.round((originalBudget + 0.1) * 10) / 10;

    const form = managerPage.locator("form").filter({ has: managerPage.locator('select[name="kind"]') });
    await form.locator('select[name="kind"]').selectOption("budget");
    await form.locator('input[name="summary"]').fill(uniqueSummary);
    await form.locator('input[name="proposedBudgetBillion"]').fill(String(proposedBudget));
    await form.getByRole("button", { name: "Gửi yêu cầu" }).click();

    await expect(managerPage.getByText(uniqueSummary)).toBeVisible({ timeout: 15_000 });
  } finally {
    await managerContext.close();
  }

  // A brand new context = a different device with no shared cookies. If
  // the manager's request only lived in local React state, the director
  // here would never see it.
  const directorContext = await browser.newContext();
  const directorPage = await directorContext.newPage();
  try {
    await login(directorPage, "giamdoc", "Giamdoc@2026");
    await directorPage.goto("/erp/trang-an/du-an-su-kien");

    const item = directorPage.locator("li").filter({ hasText: uniqueSummary });
    await expect(item).toBeVisible({ timeout: 15_000 });
    await item.getByRole("button", { name: "Duyệt" }).click();
    await expect(directorPage.getByText("Đã duyệt yêu cầu đổi phạm vi.")).toBeVisible({
      timeout: 15_000,
    });

    const budgetCard = directorPage.locator("article").filter({ hasText: "Ngân sách" }).first();
    await expect
      .poll(
        async () => parseBillion((await budgetCard.locator("p").nth(1).textContent()) ?? ""),
        { timeout: 15_000 },
      )
      .toBeCloseTo(proposedBudget, 1);

    // Put the budget back where we found it. Without this the seeded figure
    // drifts up by 0,1 tỷ on every single run and nobody notices until the
    // demo shows a number that was never approved by anyone.
    await fileBudgetRequest(restoreSummary, originalBudget);
    // goto, not reload: the director's last navigation was the approval
    // Server Action's POST, and reloading would re-submit it.
    await directorPage.goto("/erp/trang-an/du-an-su-kien");
    const restoreItem = directorPage.locator("li").filter({ hasText: restoreSummary });
    await expect(restoreItem).toBeVisible({ timeout: 15_000 });
    await restoreItem.getByRole("button", { name: "Duyệt" }).click();
    await expect
      .poll(
        async () => parseBillion((await budgetCard.locator("p").nth(1).textContent()) ?? ""),
        { timeout: 15_000 },
      )
      .toBeCloseTo(originalBudget, 1);
  } finally {
    await directorContext.close();
  }
});
