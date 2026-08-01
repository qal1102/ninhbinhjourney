import { expect, test, type Page } from "@playwright/test";

// Production verification for V15 (docs/DANH_GIA_HE_THONG_VA_GIAO_VIEC.md
// muc 10.2 L8): an incident past its SLA must escalate on its own.
//
// Until migration 024 nothing in this system ever happened on a clock --
// escalation only occurred when somebody remembered to press a button,
// which is precisely backwards for an SLA. A pg_cron job now runs
// `erp_incident_escalate_overdue()` every minute.
//
// What this spec can and cannot prove: that the job *fires on schedule* is
// evidenced in `cron.job_run_details` (checked directly against production
// when V15 shipped), not from a browser -- the shortest SLA in the data is
// 5 minutes, so waiting for a fresh breach inside a test would be absurd.
// What it does prove, end to end, is the part a browser can see: the
// escalation the machine performed is real persisted state, it is attributed
// to the system rather than to a person, it carries a reason a director can
// act on, and it reaches the roles that need it.

async function login(page: Page, username: string, password: string) {
  await page.goto("/erp/login");
  await page.getByLabel("Tên đăng nhập").fill(username);
  await page.getByLabel("Mật khẩu").fill(password);
  await page.getByRole("button", { name: "Mở hệ thống quản lý" }).click();
  await expect(page).toHaveURL(/\/erp$/);
}

test("sự cố quá hạn được hệ thống tự chuyển cấp, có lý do và ghi rõ ai làm", async ({
  page,
}) => {
  await login(page, "ql.tamchuc", "Quanly@2026");
  await page.goto("/erp/tam-chuc/su-co");

  const card = page.locator("details").filter({ hasText: "INC-TC-069" }).first();
  await expect(card).toBeVisible({ timeout: 15_000 });
  await card.locator("summary").click();

  // The reason names the SLA it broke and by how much -- a director can act
  // on that without opening anything else. It renders in two places, the
  // escalation banner and the timeline note, hence .first().
  await expect(
    card.getByText(/Quá hạn SLA \d+ phút \(trễ \d+ phút\)/).first(),
  ).toBeVisible();

  // Attributed to the system, not backdated onto a person who never touched it.
  await expect(card.getByText("Chuyển cấp tự động").first()).toBeVisible();
  await expect(card.getByText("Hệ thống").first()).toBeVisible();
});

test("chuyển cấp tự động đi thẳng vào hộp thư quyết định của giám đốc", async ({
  page,
}) => {
  await login(page, "giamdoc", "Giamdoc@2026");

  // The director's incident view is escalated-only by design, so anything
  // the clock escalated has to surface here without a human forwarding it.
  const incidentStat = page.locator("dl div", { hasText: "sự cố đã chuyển cấp" });
  await expect(incidentStat).toBeVisible();
  const escalatedCount = Number((await incidentStat.innerText()).match(/\d+/)?.[0] ?? "0");
  expect(escalatedCount).toBeGreaterThan(0);

  await page.goto("/erp/tam-chuc/su-co");
  const card = page.locator("details").filter({ hasText: "INC-TC-069" }).first();
  await expect(card).toBeVisible({ timeout: 15_000 });
});

test("chạy lại mỗi phút không nhân bản dòng nhật ký của cùng một sự cố", async ({
  page,
}) => {
  // The job filters on `escalated = false`, so an incident it already
  // escalated must never collect a second "Chuyển cấp tự động" entry --
  // otherwise a day of cron runs would bury the real history under 1440
  // identical lines.
  await login(page, "ql.tamchuc", "Quanly@2026");
  await page.goto("/erp/tam-chuc/su-co");

  const card = page.locator("details").filter({ hasText: "INC-TC-069" }).first();
  await card.locator("summary").click();
  await expect(card.getByText("Chuyển cấp tự động")).toHaveCount(1);
});
