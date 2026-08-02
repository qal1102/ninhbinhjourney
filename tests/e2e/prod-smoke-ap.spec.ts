import { expect, test, type Page } from "@playwright/test";

// Read-only production smoke for the AP-NCC batch just deployed.
// Does NOT click any mutating action (approve/reject/post) - only verifies
// each role can log in and see real Supabase-backed content.

async function login(page: Page, username: string, password: string) {
  await page.goto("/erp/login");
  await page.getByLabel("Tên đăng nhập").fill(username);
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

test("accountant sees the live supplier AP control center on production", async ({
  page,
}, testInfo) => {
  await login(page, "ketoan", "Ketoan@2026");
  await page.goto("/erp/finance");
  await expect(
    page.getByRole("heading", { name: /Đối tác|Công nợ|Nhà cung cấp/ }).first(),
  ).toBeVisible({ timeout: 15_000 });
  // The two records the earlier real E2E run left in known states.
  await expect(page.getByText("AP-TA-202607-024", { exact: true })).toBeVisible();
  await expect(page.getByText("AP-TC-202607-027", { exact: true })).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("prod-accountant-finance.png"),
    fullPage: true,
  });
  await logout(page);
});

test("chief accountant sees the AP inbox on production", async ({
  page,
}, testInfo) => {
  await login(page, "ketoantruong", "Ketoantruong@2026");
  await page.goto("/erp/finance");
  await expect(page.getByText("AP-TA-202607-024", { exact: true })).toBeVisible({
    timeout: 15_000,
  });
  await page.screenshot({
    path: testInfo.outputPath("prod-chief-accountant-finance.png"),
    fullPage: true,
  });
  await logout(page);
});

test("director sees the supplier payables summary on production", async ({
  page,
}, testInfo) => {
  await login(page, "giamdoc", "Giamdoc@2026");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("prod-director-home.png"),
    fullPage: true,
  });
  await page.goto("/erp/finance");
  await expect(page.getByText(/AP-TC-202607-027|AP-TA-202607-024/).first()).toBeVisible({
    timeout: 15_000,
  });
  await page.screenshot({
    path: testInfo.outputPath("prod-director-finance.png"),
    fullPage: true,
  });
  await logout(page);
});

test("manager sees the supplier AP control center at site level on production", async ({
  page,
}, testInfo) => {
  await login(page, "ql.vanhanh", "Quanly@2026");
  await page.goto("/erp/trang-an/doi-tac-nha-cung-ung");
  await expect(page.getByText("AP-TA-202607-024", { exact: true })).toBeVisible({
    timeout: 15_000,
  });
  await page.screenshot({
    path: testInfo.outputPath("prod-manager-ap.png"),
    fullPage: true,
  });
  await logout(page);
});

// T1 (mục 3 in docs/HANDOFF.md). Reading the page proves nothing about the
// permission that matters: erp_ap_submit_supplier_invoice gates on
// erp_account_has_active_role(..., 'regional-manager', site) against
// erp_account_registry, and for three of the four managers that returned
// false on production while every read-only assertion above stayed green.
// This is trap #1 in docs/HANDOFF.md -- one representative account is not a
// permission test.
//
// How this proves the gate without leaving residue: the RPC checks the actor's
// role BEFORE it looks up a posting rule, and posting rules only exist from
// 2026-01-01. An invoice dated 2025-12-31 therefore travels through the
// authorization gate and is refused one step later, at the rule lookup, having
// written nothing at all -- no invoice, no audit row, no command receipt, no
// number to put back. Seeing the posting-rule refusal means the manager passed
// the gate; seeing the role refusal means they did not.
const SITE_MANAGERS: ReadonlyArray<[string, string, string]> = [
  ["trang-an", "ql.vanhanh", "Quanly@2026"],
  ["tam-chuc", "ql.tamchuc", "Quanly@2026"],
  ["tam-coc", "ql.tamcoc", "Quanly@2026"],
  ["bai-dinh", "ql.baidinh", "Quanly@2026"],
];

for (const [siteId, username, password] of SITE_MANAGERS) {
  test(`quản lý ${siteId} qua được cửa phân quyền hóa đơn NCC trên production`, async ({
    page,
  }) => {
    await page.context().clearCookies();
    await login(page, username, password);
    await page.goto(`/erp/${siteId}/doi-tac-nha-cung-ung`);

    const form = page.locator("form").filter({
      has: page.locator('select[name="expenseCategory"]'),
    });
    await expect(form).toBeAttached({ timeout: 15_000 });

    // The submission form lives inside a collapsed <details> ("Gửi hóa đơn
    // kèm PO và nghiệm thu") so the page doesn't open with a form dumped in
    // the reader's face. This is the first Playwright run this spec has
    // ever made against a real production deploy (the code sat 16 commits
    // behind origin/main until this session), which is exactly how a
    // missing "open the disclosure first" step went unnoticed until now.
    const disclosure = form.locator("xpath=ancestor::details[1]");
    if (!(await disclosure.evaluate((element) => (element as HTMLDetailsElement).open))) {
      await disclosure.locator("summary").click();
    }

    // Any active supplier of this site will do; the gate is checked after the
    // supplier lookup, so it has to resolve.
    const supplierSelect = form.locator('select[name="supplierId"]');
    const supplierValue = await supplierSelect
      .locator("option")
      .nth(1)
      .getAttribute("value");
    expect(supplierValue, `${siteId} has no active supplier`).toBeTruthy();
    await supplierSelect.selectOption(supplierValue!);

    await form.locator('input[name="requestReference"]').fill("PR-GATECHECK-001");
    await form.locator('input[name="purchaseOrderTotalVnd"]').fill("11000000");
    await form.locator('input[name="acceptedTotalVnd"]').fill("11000000");
    await form.locator('select[name="expenseCategory"]').selectOption("transport-service");
    await form.locator('input[name="invoiceSeries"]').fill("1C25TGATE");
    await form.locator('input[name="invoiceNumber"]').fill("000001");
    // Before every posting rule exists -- this is what makes the probe inert.
    await form.locator('input[name="invoiceDate"]').fill("2025-12-31");
    await form.locator('input[name="dueDate"]').fill("2026-01-30");
    await form.locator('input[name="netVnd"]').fill("10000000");
    await form.locator('input[name="vatVnd"]').fill("1000000");
    await form.locator('input[name="totalVnd"]').fill("11000000");
    await form.locator('input[name="costCenter"]').fill("KIEM-TRA-PHAN-QUYEN");
    await form.locator('input[name="description"]').fill("Kiểm tra cửa phân quyền, không tạo hồ sơ.");

    await form.getByRole("button", { name: /Gửi hồ sơ/ }).click();

    const alert = form.locator('p[role="alert"]');
    await expect(alert).toBeVisible({ timeout: 20_000 });
    const message = await alert.innerText();

    // The assertion that would have caught the defect.
    expect(
      message,
      `${siteId}: manager is still blocked by the role gate`,
    ).not.toContain("chưa được ghi nhận là quản lý vận hành");
    // And the assertion that proves we really reached the step after it,
    // rather than being stopped earlier by bad input.
    expect(message, `${siteId}: unexpected refusal`).toContain(
      "Chưa có quy tắc hạch toán",
    );
  });
}
