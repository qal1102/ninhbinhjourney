import { expect, test, type Page } from "@playwright/test";
import {
  ERP_ACCOUNTANT_PASSWORD,
  ERP_DIRECTOR_PASSWORD,
  ERP_EMPLOYEE_PASSWORD,
  ERP_MANAGER_PASSWORD,
} from "./support/erp-credentials";
import { loginToErp } from "./support/erp-login";

/*
 * ERP-DE-XUAT-01 — một vòng đề xuất thật qua bốn vai, trên bản chạy thử cục bộ.
 *
 * Bản chạy thử lưu đề xuất trong bộ nhớ máy chủ (màn hình nói thẳng điều ấy),
 * nên bài này đi được trọn luồng mà không đụng kho thật. Luật trên production
 * đã chạy thử trong một giao dịch rồi cuộn lại (docs/HANDOFF.md). Bài này ghi
 * dữ liệu nên không chạy trên production.
 */
test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL?.trim()), "Ghi đề xuất; chỉ chạy cục bộ.");

async function vaoVai(page: Page, username: string, password: string) {
  await page.context().clearCookies();
  await loginToErp(page, username, password);
  await page.goto("/erp/de-xuat");
  await expect(page.getByRole("heading", { level: 1, name: "Đề xuất của đội ngũ" })).toBeVisible();
}

function the(page: Page, code: string) {
  return page.locator("li").filter({ hasText: code });
}

test("tạm ứng vượt ngưỡng đi đủ bốn vai: nhân viên gửi, quản lý chuyển, giám đốc duyệt, kế toán chi", async ({ page }) => {
  await vaoVai(page, "nv.trangan", ERP_EMPLOYEE_PASSWORD);
  await expect(page.getByRole("note")).toContainText("Bản chạy thử");

  await page.locator("form").getByText("Tạm ứng", { exact: true }).click();
  await page.getByLabel("Số tiền cần ứng").fill("8000000");
  await expect(page.getByText("quản lý duyệt xong còn cần giám đốc duyệt")).toBeVisible();
  await page.getByLabel("Ứng để làm gì").fill("Mua vật tư sơ cứu cho bến thuyền");
  await page.getByRole("button", { name: "Gửi đề xuất" }).click();
  const baoGui = page.getByRole("status").filter({ hasText: "Đã gửi đề xuất tạm ứng" });
  await expect(baoGui).toBeVisible();
  const code = (await baoGui.innerText()).match(/DX-[0-9A-F]{10}/)?.[0] ?? "";
  expect(code).toMatch(/^DX-[0-9A-F]{10}$/);
  await expect(the(page, code)).toContainText("Chờ quản lý duyệt");
  await expect(the(page, code).getByRole("button", { name: "Duyệt" })).toHaveCount(0);

  await vaoVai(page, "ql.trangan", ERP_MANAGER_PASSWORD);
  await the(page, code).getByRole("button", { name: "Duyệt" }).click();
  await the(page, code).getByRole("button", { name: "Đồng ý, chuyển giám đốc" }).click();
  await expect(page.getByRole("status").filter({ hasText: "chuyển tiếp lên giám đốc" })).toBeVisible();
  // Xét xong thì đề xuất rời khỏi "Chờ tôi xử lý"; vẫn xem được ở "Tất cả tôi thấy".
  await expect(the(page, code)).toHaveCount(0);
  await page.getByRole("tab", { name: /Tất cả tôi thấy/ }).click();
  await expect(the(page, code)).toContainText("Chờ giám đốc duyệt");

  await vaoVai(page, "giamdoc", ERP_DIRECTOR_PASSWORD);
  await expect(page.getByText("Giám đốc là người duyệt cuối")).toBeVisible();
  await the(page, code).getByRole("button", { name: "Duyệt" }).click();
  await the(page, code).getByRole("button", { name: "Xác nhận duyệt" }).click();
  await expect(page.getByRole("status").filter({ hasText: `Đã duyệt ${code}` })).toBeVisible();

  await vaoVai(page, "ketoan", ERP_ACCOUNTANT_PASSWORD);
  await the(page, code).getByRole("button", { name: "Ghi đã chi tạm ứng" }).click();
  const xacNhanChi = the(page, code).getByRole("button", { name: "Ghi đã chi tạm ứng" }).last();
  await expect(xacNhanChi).toBeDisabled();
  await the(page, code).getByLabel("Đã chi thế nào, số phiếu chi").fill("Đã chi 8.000.000 đ, phiếu chi PC-0914");
  await xacNhanChi.click();
  await expect(page.getByRole("status").filter({ hasText: `Đã ghi hoàn tất ${code}` })).toBeVisible();

  await vaoVai(page, "nv.trangan", ERP_EMPLOYEE_PASSWORD);
  await page.getByRole("tab", { name: /Tôi đã gửi/ }).click();
  await expect(the(page, code)).toContainText("Đã hoàn tất");
  await expect(the(page, code)).toContainText("PC-0914");

  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
});

test("quản lý từ chối phải ghi lý do, và người gửi đọc được lý do ấy", async ({ page }) => {
  await vaoVai(page, "nv.trangan", ERP_EMPLOYEE_PASSWORD);
  await page.locator("form").getByText("Xin nghỉ", { exact: true }).click();
  const homNay = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());
  await page.getByLabel("Nghỉ từ ngày").fill(homNay);
  await page.getByLabel("Tới hết ngày").fill(homNay);
  await page.getByLabel("Lý do", { exact: true }).fill("Đưa con đi tiêm phòng");
  await page.getByRole("button", { name: "Gửi đề xuất" }).click();
  const baoGui = page.getByRole("status").filter({ hasText: "Đã gửi đề xuất xin nghỉ" });
  await expect(baoGui).toBeVisible();
  const code = (await baoGui.innerText()).match(/DX-[0-9A-F]{10}/)?.[0] ?? "";

  await vaoVai(page, "ql.trangan", ERP_MANAGER_PASSWORD);
  await the(page, code).getByRole("button", { name: "Từ chối" }).click();
  const xacNhan = the(page, code).getByRole("button", { name: "Xác nhận từ chối" });
  await expect(xacNhan).toBeDisabled();
  await the(page, code).getByLabel("Lý do từ chối (người gửi sẽ đọc)").fill("Hôm đó thiếu người trực bến, xin đổi sang ngày khác");
  await xacNhan.click();
  await expect(page.getByRole("status").filter({ hasText: `Đã từ chối ${code}` })).toBeVisible();

  await vaoVai(page, "nv.trangan", ERP_EMPLOYEE_PASSWORD);
  await page.getByRole("tab", { name: /Tôi đã gửi/ }).click();
  await expect(the(page, code)).toContainText("Bị từ chối");
  await expect(the(page, code)).toContainText("thiếu người trực bến");
});

test("xin huỷ phiếu quầy ở bản chạy thử nói thẳng là chưa có phiếu để huỷ", async ({ page }) => {
  await vaoVai(page, "nv.trangan", ERP_EMPLOYEE_PASSWORD);
  await page.locator("form").getByText("Xin huỷ phiếu quầy", { exact: true }).click();
  await page.getByLabel("Mã phiếu thu").fill("PT-0A1B2C3D4E5F");
  await page.getByLabel("Vì sao huỷ, đã hoàn tiền cho khách chưa").fill("Bán nhầm một vé thành hai vé");
  await page.getByRole("button", { name: "Gửi đề xuất" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "chưa có phiếu nào để xin huỷ" })).toBeVisible();
});
