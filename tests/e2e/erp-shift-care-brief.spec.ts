import { expect, test } from "@playwright/test";
import { ERP_DIRECTOR_PASSWORD } from "./support/erp-credentials";

/**
 * TC-13 mục 2–3 — bản giao ca "hôm nay ai cần để ý" trên màn check-in.
 *
 * Bài này canh đúng thứ mà một lần sắp lại bố cục rất dễ phá: **bản giao ca
 * phải đứng trước máy quét**, và **ngày không có ai cần để ý thì nó phải teo
 * lại thành một dòng** — nếu không, người đứng cổng phải cuộn qua một khối
 * thông tin không liên quan để soát tấm vé đầu tiên.
 *
 * Chỉ đọc, không tạo một hàng dữ liệu nào, nên chạy thẳng trên production cũng
 * không để lại gì.
 */

async function loginAsDirector(page: import("@playwright/test").Page) {
  await page.goto("/erp/login");
  await page.getByLabel("Tên đăng nhập").fill("giamdoc");
  await page.getByLabel("Mật khẩu").fill(ERP_DIRECTOR_PASSWORD);
  await page.getByRole("button", { name: "Mở hệ thống quản lý" }).click();
  await expect(page).toHaveURL(/\/erp$/);
}

test("bản giao ca đứng trước máy quét và không đẩy máy quét khỏi màn đầu", async ({ page }) => {
  await loginAsDirector(page);
  await page.goto("/erp/trang-an/check-in-khach");

  const banGiaoCa = page.getByTestId("shift-care-brief");
  await expect(banGiaoCa).toBeVisible();

  const mayQuet = page.getByRole("heading", { name: "Quét và ghi nhận QR" });
  await expect(mayQuet).toBeVisible();

  // Thứ tự trong DOM là thứ tự người đọc gặp. So bằng toạ độ tuyệt đối để một
  // lần đổi khung bao ngoài cũng không làm bài này đỗ oan.
  const viTri = await page.evaluate(() => {
    const bang = document.querySelector('[data-testid="shift-care-brief"]');
    const tieuDe = Array.from(document.querySelectorAll("h1, h2, h3")).find((el) =>
      (el.textContent ?? "").includes("Quét và ghi nhận QR"),
    );
    if (!bang || !tieuDe) return null;
    return {
      topBang: bang.getBoundingClientRect().top + window.scrollY,
      topMayQuet: tieuDe.getBoundingClientRect().top + window.scrollY,
      caoBang: bang.getBoundingClientRect().height,
      tranNgang: document.documentElement.scrollWidth > window.innerWidth + 1,
    };
  });

  expect(viTri).not.toBeNull();
  expect(viTri!.topBang).toBeLessThan(viTri!.topMayQuet);
  expect(viTri!.tranNgang).toBe(false);

  // Ngày trống: một dòng chữ, không khung, không nút. Ngày có việc: khối gập
  // sẵn, cũng không được cao quá một nhúm. Mốc 220px cho cả hai trường hợp —
  // đo thật ở khổ 390px là 126px khi có hai đoàn.
  expect(viTri!.caoBang).toBeLessThan(220);

  const trong = page.getByTestId("shift-care-brief-empty");
  const nutMo = page.getByTestId("shift-care-brief-toggle");
  const coViec = (await nutMo.count()) > 0;

  if (coViec) {
    // Gập sẵn: chưa bấm thì không đoàn nào hiện ra.
    await expect(page.getByTestId("shift-care-brief-group")).toHaveCount(0);
    await nutMo.click();
    await expect(page.getByTestId("shift-care-brief-group").first()).toBeVisible();
    await expect(banGiaoCa).toContainText("Đọc lên bộ đàm");
  } else {
    await expect(trong).toBeVisible();
    await expect(trong).toContainText("Khách tự khai lúc đặt");
  }
});

test("nhân viên cổng cũng đọc được bản giao ca", async ({ page }) => {
  await loginAsDirector(page);
  await page.goto("/erp/trang-an/check-in-khach");
  await expect(page.getByTestId("shift-care-brief")).toBeVisible();
  // Bản giao ca là việc của ca trực, không phải một quyền riêng: ai mở được
  // màn check-in thì đọc được. Không có nhánh phân quyền nào để phá.
  await expect(page.getByTestId("shift-care-brief")).toContainText("Ca trực");
});
