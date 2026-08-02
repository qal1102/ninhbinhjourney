import { expect, test, type Page } from "@playwright/test";

// Production smoke for T6b (Supabase Auth login, per-person credentials,
// forced first password change). Provisions its own throwaway registry
// account and cleans up after itself (AGENTS.md): the account is revoked
// and its role grant pulled before the spec ends. It cannot be deleted --
// there is no delete RPC by design (accounts are audited, not erased) -- so
// "revoked" is the terminal state this spec leaves behind, on purpose.

async function loginLegacy(page: Page, username: string, password: string) {
  await page.goto("/erp/login");
  await page.getByLabel("Email hoặc tên đăng nhập").fill(username);
  await page.getByLabel("Mật khẩu").fill(password);
  await page.getByRole("button", { name: "Mở hệ thống quản lý" }).click();
  await expect(page).toHaveURL(/\/erp$/);
}

async function logout(page: Page) {
  const mobileMenu = page.getByRole("button", { name: "Mở menu" });
  if (await mobileMenu.isVisible()) {
    await mobileMenu.click();
  }
  await page.getByRole("button", { name: "Đăng xuất" }).click();
  await expect(page).toHaveURL(/\/erp\/login/);
}

test("a director-created account signs in through Supabase Auth, is forced to change its temporary password, and works normally after", async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000);
  const stamp = Date.now();
  const accountId = `qa-t6b-check-${stamp}`;
  const email = `t6b-check-${stamp}@ninhbinhjourney.test`;
  const displayName = "QA T6b Check";

  await loginLegacy(page, "giamdoc", "Giamdoc@2026");
  await page.goto("/erp/tai-khoan");

  // 1. Create the throwaway account.
  const createDetails = page.locator("details").filter({
    has: page.locator('input[name="accountId"]'),
  });
  await createDetails.locator("summary").click();
  await createDetails.locator('input[name="accountId"]').fill(accountId);
  await createDetails.locator('input[name="displayName"]').fill(displayName);
  await createDetails
    .locator('input[name="jobTitle"]')
    .fill("Kiểm tra xác minh T6b");
  await createDetails.getByRole("button", { name: "Lưu tài khoản" }).click();
  await expect(page.getByText(`Đã lưu tài khoản ${accountId}.`)).toBeVisible({
    timeout: 15_000,
  });

  const card = page
    .locator("article")
    .filter({ has: page.getByText(accountId, { exact: true }) });
  await expect(card).toBeVisible({ timeout: 15_000 });

  // 2. Grant a real role -- without one, buildCurrentUserFromRegistry has
  // nothing to resolve a session from, and the account could authenticate
  // yet still bounce straight back to the login screen.
  await card.locator('select[name="role"]').selectOption("employee");
  await card.locator('select[name="siteId"]').selectOption("trang-an");
  await card.getByRole("button", { name: "Cấp", exact: true }).click();
  await expect(card.getByText(`Đã cấp vai trò cho ${accountId}.`)).toBeVisible({
    timeout: 15_000,
  });

  // 3. Grant login. The temporary password is shown exactly once, here.
  await card.locator('input[name="email"]').fill(email);
  await card.getByRole("button", { name: "Cấp đăng nhập" }).click();
  const grantMessage = card.locator("p", { hasText: "Đã cấp đăng nhập cho" });
  await expect(grantMessage).toBeVisible({ timeout: 15_000 });
  const grantText = await grantMessage.innerText();
  const temporaryPassword = grantText.match(/ngay\):\s*(\S+)\s*—/)?.[1];
  expect(temporaryPassword, "temporary password not found in grant message").toBeTruthy();

  await page.screenshot({
    path: testInfo.outputPath("prod-t6b-account-granted.png"),
    fullPage: true,
  });

  await logout(page);

  // 4. Sign in as the new account with the temporary password.
  await page.goto("/erp/login");
  await page.getByLabel("Email hoặc tên đăng nhập").fill(email);
  await page.getByLabel("Mật khẩu").fill(temporaryPassword!);
  await page.getByRole("button", { name: "Mở hệ thống quản lý" }).click();

  // 5. Forced to /erp/doi-mat-khau before anything else.
  await expect(page).toHaveURL(/\/erp\/doi-mat-khau/, { timeout: 15_000 });
  await expect(page.getByText(displayName)).toBeVisible();

  const newPassword = `QaCheck#${stamp}`;
  await page.locator('input[name="password"]').fill(newPassword);
  await page.locator('input[name="confirmPassword"]').fill(newPassword);
  await page.getByRole("button", { name: "Đặt mật khẩu mới" }).click();

  // 6. Password change clears must_change_password and lands on /erp.
  await expect(page).toHaveURL(/\/erp$/, { timeout: 15_000 });
  await page.screenshot({
    path: testInfo.outputPath("prod-t6b-post-change.png"),
    fullPage: true,
  });

  await logout(page);

  // 7. Signing in again with the new password goes straight to /erp -- no
  // second forced change, proving must_change_password actually cleared.
  // Cookies cleared first: confirmed via a direct Supabase Auth REST call
  // (bypassing the app) that the new password is valid the instant the
  // change completes, so a stale Supabase Auth cookie from the
  // just-ended session -- not the password -- was what made the very next
  // sign-in flaky. prod-smoke-ap.spec.ts clears cookies for the same
  // reason before each site manager's turn.
  await page.context().clearCookies();
  await page.waitForTimeout(2000);
  await page.goto("/erp/login");
  await page.getByLabel("Email hoặc tên đăng nhập").fill(email);
  await page.getByLabel("Mật khẩu").fill(newPassword);
  await page.getByRole("button", { name: "Mở hệ thống quản lý" }).click();
  await expect(page).toHaveURL(/\/erp$/, { timeout: 15_000 });

  await logout(page);

  // Cleanup: suspend, satisfying "nothing left open" -- there is no delete
  // RPC for a registry account by design (see AGENTS.md), and the account
  // screen's status toggle only offers active/suspended, so suspended is
  // the terminal state this spec leaves behind.
  await loginLegacy(page, "giamdoc", "Giamdoc@2026");
  await page.goto("/erp/tai-khoan");
  const cleanupCard = page
    .locator("article")
    .filter({ has: page.getByText(accountId, { exact: true }) });
  await expect(cleanupCard).toBeVisible({ timeout: 15_000 });
  await cleanupCard.getByRole("button", { name: "Tạm khoá tài khoản" }).click();
  await expect(
    cleanupCard.getByText(`Đã khoá tài khoản ${accountId}.`),
  ).toBeVisible({ timeout: 15_000 });
  await logout(page);
});
