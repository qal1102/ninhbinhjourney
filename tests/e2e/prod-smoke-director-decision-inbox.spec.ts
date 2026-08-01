import { expect, test, type Page } from "@playwright/test";

// Production verification for the director-home decision inbox fix (V2 in
// docs/DANH_GIA_HE_THONG_VA_GIAO_VIEC.md). Before this fix,
// `directorDecisionCount` on `/erp` only summed shift-close exceptions and
// supplier AP exceptions -- escalated incidents and pending project change
// requests never appeared, so a real, manager-verified, SLA-breached
// incident could sit invisible to the one role authorized to act on it.
// Confirmed live on production before the fix (audit mục 20.4): director
// landing showed "0 hồ sơ cần quyết định" while /erp/tam-chuc/su-co showed
// an escalated, manager-verified incident overdue on SLA.
//
// This spec mutates real production state (submits one new pending project
// change request) and does not decide it, matching the established
// precedent in prod-smoke-project-workflow.spec.ts of leaving durable
// evidence behind since no revert RPC exists.

async function login(page: Page, username: string, password: string) {
  await page.goto("/erp/login");
  await page.getByLabel("Tên đăng nhập").fill(username);
  await page.getByLabel("Mật khẩu").fill(password);
  await page.getByRole("button", { name: "Mở hệ thống quản lý" }).click();
  await expect(page).toHaveURL(/\/erp$/);
}

test("giám đốc thấy sự cố đã chuyển cấp trong hộp thư quyết định, không phải chỉ ở module Sự cố", async ({
  page,
}) => {
  await login(page, "giamdoc", "Giamdoc@2026");

  const inbox = page.getByText("Cần giám đốc quyết định").locator("..");
  await expect(inbox).toBeVisible();

  // At least one escalated, still-open incident exists on production
  // (verified directly against /erp/tam-chuc/su-co during the audit); the
  // stat row must reflect that instead of only counting shift-close and
  // supplier AP exceptions.
  const incidentStat = page.locator("dl div", { hasText: "sự cố đã chuyển cấp" });
  await expect(incidentStat).toBeVisible();
  const statText = await incidentStat.innerText();
  const escalatedCount = Number(statText.match(/\d+/)?.[0] ?? "0");
  expect(escalatedCount).toBeGreaterThan(0);

  // The section heading itself is enough proof the list actually rendered,
  // since exact incident identities may shift as other sessions transition
  // them between report/verify/close.
  await expect(page.getByText("Sự cố đã chuyển cấp", { exact: true })).toBeVisible();
});

// FIXME (found 01/08/2026 while verifying V12, unrelated to it -- see mục 23
// in docs/DANH_GIA_HE_THONG_VA_GIAO_VIEC.md): a project change request
// submitted in one session is visible only to that same session (survives
// its own hard reload) and is invisible to every other freshly authenticated
// session even 45+ seconds later, despite the route sending
// Cache-Control: no-store and X-Vercel-Cache: MISS (so it is not edge/CDN
// caching). Reproduced with both the new per-site managers and the
// untouched, long-standing ql.vanhanh/trang-an account, and independently
// with the unmodified prod-smoke-project-workflow.spec.ts. Root cause not
// yet found; needs direct Supabase log/connection access to diagnose.
test.fixme(
  "quản lý gửi yêu cầu đổi phạm vi dự án, giám đốc thấy ngay trong hộp thư quyết định ở phiên khác",
  async ({ browser }) => {
  const uniqueSummary = `PROD-SMOKE hộp thư giám đốc ${Date.now()}`;

  const managerContext = await browser.newContext();
  const managerPage = await managerContext.newPage();
  try {
    // Bái Đính now has its own manager (V12); the regional ql.vanhanh
    // account no longer reaches other sites.
    await login(managerPage, "ql.baidinh", "Quanly@2026");
    await managerPage.goto("/erp/bai-dinh/du-an-su-kien");

    const form = managerPage
      .locator("form")
      .filter({ has: managerPage.locator('select[name="kind"]') });
    await form.locator('select[name="kind"]').selectOption("scope");
    await form.locator('input[name="summary"]').fill(uniqueSummary);
    await form.getByRole("button", { name: "Gửi yêu cầu" }).click();
    await expect(managerPage.getByText(uniqueSummary)).toBeVisible({
      timeout: 15_000,
    });
  } finally {
    await managerContext.close();
  }

  // A brand new context = a different device with no shared cookies. If the
  // request only lived in the project module and never fed the director's
  // home-page count, this would never appear here.
  const directorContext = await browser.newContext();
  const directorPage = await directorContext.newPage();
  try {
    await login(directorPage, "giamdoc", "Giamdoc@2026");

    const card = directorPage.locator("a").filter({ hasText: uniqueSummary });
    await expect(card).toBeVisible({ timeout: 15_000 });
    await expect(card).toHaveAttribute("href", "/erp/bai-dinh/du-an-su-kien");
    await expect(card.getByText("Bái Đính", { exact: false })).toBeVisible();
  } finally {
    await directorContext.close();
  }
  },
);
