import { expect, test, type Page } from "@playwright/test";

// Production verification for V14 in docs/archive/DANH_GIA_2026_07_08.md
// (L13). Before V14 `demo-session.ts` handed every manager all 15 modules
// directly, so the permission story only ever applied to employees. These
// tests prove three things that are only true if a manager's modules really
// come from the `erp_employee_access` grant now:
//   (a) a manager is blocked from a module nobody granted them,
//   (b) two managers differ from each other,
//   (c) the director still sees everything, and is the only one who can
//       change a manager's grant.

async function login(page: Page, username: string, password: string) {
  await page.goto("/erp/login");
  await page.getByLabel("Tên đăng nhập").fill(username);
  await page.getByLabel("Mật khẩu").fill(password);
  await page.getByRole("button", { name: "Mở hệ thống quản lý" }).click();
  await expect(page).toHaveURL(/\/erp$/);
}

test("quản lý bị chặn đúng ở module không được giao, và vẫn vào được module được giao", async ({
  page,
}) => {
  await login(page, "ql.vanhanh", "Quanly@2026");

  // Granted: this manager runs Tràng An's incidents and its drill book.
  await page.goto("/erp/trang-an/su-co");
  await expect(page).toHaveURL(/\/erp\/trang-an\/su-co$/);
  await page.goto("/erp/trang-an/sop-dien-tap");
  await expect(page).toHaveURL(/\/erp\/trang-an\/sop-dien-tap$/);

  // Not granted to any manager: regional forecasting belongs to the director
  // and accounting. This is the assertion that fails the moment somebody
  // restores the blanket 15-module grant.
  await page.goto("/erp/trang-an/bao-cao");
  await expect(page).toHaveURL(/\/erp\/trang-an\?denied=module/);
});

test("hai quản lý có bộ quyền khác nhau — không còn ai cũng thấy mọi thứ", async ({
  page,
}) => {
  // Tam Cốc's manager has the shuttle but not the drill book; Tràng An's
  // manager is the other way round. Same role, different grant.
  await login(page, "ql.tamcoc", "Quanly@2026");
  await page.goto("/erp/tam-coc/xe-trung-chuyen");
  await expect(page).toHaveURL(/\/erp\/tam-coc\/xe-trung-chuyen$/);
  await page.goto("/erp/tam-coc/sop-dien-tap");
  await expect(page).toHaveURL(/\/erp\/tam-coc\?denied=module/);
});

test("giám đốc vẫn xem được toàn bộ, và là người duy nhất thấy ô cấp quyền cho quản lý", async ({
  page,
}) => {
  await login(page, "giamdoc", "Giamdoc@2026");

  // Director scope is deliberately unchanged by V14.
  await page.goto("/erp/trang-an/bao-cao");
  await expect(page).toHaveURL(/\/erp\/trang-an\/bao-cao$/);

  await page.goto("/erp/trang-an/nhan-su");
  // Scope to the section: the director's own "Xem theo vai trò" picker also
  // carries every account name in hidden <option>s.
  const managerGrant = page.locator("section").filter({
    has: page.getByRole("heading", { name: /Quản lý phụ trách/ }),
  });
  await expect(managerGrant).toBeVisible();
  await expect(managerGrant.getByText("Lê Hoàng Nam")).toBeVisible();
  // The real grant read back out of Supabase, not a blanket 15/15.
  await expect(managerGrant.getByText("13/15 nghiệp vụ")).toBeVisible();
});

test("quản lý không thấy ô cấp quyền cấp quản lý trên chính màn hình nhân sự của mình", async ({
  page,
}) => {
  await login(page, "ql.vanhanh", "Quanly@2026");
  await page.goto("/erp/trang-an/nhan-su");
  // The employee assignment panel is still theirs to use...
  await expect(page.getByRole("heading", { name: /Đội ngũ/ })).toBeVisible();
  // ...but they must not be able to widen their own scope.
  await expect(page.getByRole("heading", { name: /Quản lý phụ trách/ })).toHaveCount(0);
});
