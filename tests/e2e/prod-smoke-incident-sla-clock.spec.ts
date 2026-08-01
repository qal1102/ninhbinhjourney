import { expect, test } from "@playwright/test";

// Production verification for V13 (docs/DANH_GIA_HE_THONG_VA_GIAO_VIEC.md
// muc 10.2 / muc 24): elapsed_minutes on erp_incidents used to be a frozen
// integer written once at seed time and never recalculated, so an incident
// reported days ago still showed "con N phut" forever, and closed cases
// never had a real "time to resolve". Migrations 202608010015/016 replaced
// it with a real reported_at_ts, computed live at read time in
// incident-repository.ts: ticking against now() while open, frozen at
// updated_at once closed.
//
// This asserts the live behaviour directly on production data: the seeded
// demo incidents were reported at the migration-011 seed insert
// (2026-07-31), so by the time this runs they are genuinely, deeply overdue
// against their 5/10/15-minute SLAs -- proving the clock actually ticks
// (a frozen clock could never show this) -- while the already-closed case
// shows a small, fixed resolution time that must not have grown.

test("open sự cố is shown genuinely overdue, đã đóng sự cố shows a fixed, small resolution time", async ({
  page,
}) => {
  await page.goto("/erp/login");
  await page.getByLabel("Tên đăng nhập").fill("ql.vanhanh");
  await page.getByLabel("Mật khẩu").fill("Quanly@2026");
  await page.getByRole("button", { name: "Mở hệ thống quản lý" }).click();
  await expect(page).toHaveURL(/\/erp$/);

  await page.goto("/erp/trang-an/su-co");

  const openCard = page.locator("details").filter({ hasText: "INC-TA-069" });
  await openCard.locator("summary").click();
  await expect(openCard.getByText(/^Quá SLA \d+ phút$/)).toBeVisible();

  const closedCard = page.locator("details").filter({ hasText: "INC-TA-064" });
  await closedCard.locator("summary").click();
  const resolvedText = await closedCard
    .getByText(/^Hoàn tất trong \d+ phút$/)
    .innerText();
  const resolvedMinutes = Number(resolvedText.match(/\d+/)?.[0] ?? "-1");
  // Reported 08:21, closed at insert time -- 6 minutes in the original
  // seed (migration 011). A frozen-but-wrong clock would show 0 (the bug
  // caught and fixed by migration 016); a still-ticking clock would show
  // whatever's grown since 2026-07-31, i.e. over a thousand minutes.
  expect(resolvedMinutes).toBeGreaterThan(0);
  expect(resolvedMinutes).toBeLessThan(60);
});
