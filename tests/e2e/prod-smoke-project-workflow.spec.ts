import { expect, test, type Page } from "@playwright/test";

// Production verification for the "Dự án & sự kiện" module built from
// scratch (it previously had zero actions of any kind, not even a fake
// one -- everything was hard-coded in the component). Both tests prove a
// change made by one account, in one browser session, is visible to a
// completely different account in a completely separate session.
//
// Both tests are written to be safe to re-run: they read current state
// before acting instead of assuming a fixed starting point, since the
// work-item status and event budget mutated by a previous run persist on
// production (no "revert" RPC exists, matching the established
// precedent from erp-supplier-ap-workflow.spec.ts and the other
// prod-smoke specs in this batch).

async function login(page: Page, username: string, password: string) {
  await page.goto("/erp/login");
  await page.getByLabel("Tên đăng nhập").fill(username);
  await page.getByLabel("Mật khẩu").fill(password);
  await page.getByRole("button", { name: "Mở hệ thống quản lý" }).click();
  await expect(page).toHaveURL(/\/erp$/);
}

// L18 (quyền module) đã sửa 01/08/2026 -- nv.trangan vào được
// /erp/trang-an/du-an-su-kien và bấm "Bắt đầu xử lý" bình thường, xác nhận
// trực tiếp. Bài vẫn còn `test.fixme()` vì phần còn lại của luồng (quản lý
// ở PHIÊN KHÁC thấy trạng thái mới) vẫn fail -- cùng lỗi L17 (mục 23 file
// đánh giá): thay đổi ghi ở một phiên không hiện với phiên khác. Chưa sửa
// được L17 (thiếu quyền truy cập log/connection Supabase trực tiếp).
test.fixme(
  "nhân viên bắt đầu xử lý một gói việc, quản lý ở phiên khác thấy đúng trạng thái mới",
  async ({ browser }) => {
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
  },
);

function parseBillion(text: string) {
  const match = text.match(/([\d.,]+)/);
  return match ? Number(match[1].replace(",", ".")) : NaN;
}

// FIXME (found 01/08/2026 while verifying V12, unrelated to it -- see mục 23
// in docs/DANH_GIA_HE_THONG_VA_GIAO_VIEC.md): a project change request
// submitted in one session is invisible to every other fresh session even
// 45+ seconds later, despite the route being genuinely uncached
// (Cache-Control: no-store, X-Vercel-Cache: MISS). Reproduces identically
// on the untouched prod-smoke-director-decision-inbox.spec.ts test with a
// different account/site, so this is not specific to this test's account.
test.fixme(
  "quản lý gửi yêu cầu đổi ngân sách, giám đốc duyệt ở phiên khác, ngân sách sự kiện cập nhật xuyên tài khoản",
  async ({ browser }) => {
  const uniqueSummary = `PROD-SMOKE tăng ngân sách ${Date.now()}`;
  let proposedBudget = 0;

  const managerContext = await browser.newContext();
  const managerPage = await managerContext.newPage();
  try {
    await login(managerPage, "ql.vanhanh", "Quanly@2026");
    await managerPage.goto("/erp/trang-an/du-an-su-kien");

    const budgetCard = managerPage.locator("article").filter({ hasText: "Ngân sách" }).first();
    const budgetText = (await budgetCard.locator("p").nth(1).textContent()) ?? "";
    const currentBudget = parseBillion(budgetText);
    expect(Number.isFinite(currentBudget)).toBe(true);
    proposedBudget = Math.round((currentBudget + 0.1) * 10) / 10;

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
  } finally {
    await directorContext.close();
  }
  },
);
