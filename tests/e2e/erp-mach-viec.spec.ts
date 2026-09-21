import { expect, test } from "@playwright/test";
import { ERP_DIRECTOR_PASSWORD } from "./support/erp-credentials";

/**
 * Mạch việc — dải trả lời "tôi đang ở khúc nào của quy trình".
 *
 * Bài này canh ba thứ dễ vỡ nhất khi ai đó xếp lại bố cục: dải phải đứng
 * **trước** phần làm việc, gập sẵn thì **không** đổ cả mạch ra màn, và bước
 * trỏ về chính màn đang mở thì phải nói "bạn đang đứng ở đây" chứ không mời
 * bấm một liên kết dẫn về chỗ cũ.
 *
 * Chỉ đọc, không ghi một hàng nào, nên chạy thẳng trên production cũng sạch.
 */

async function loginAsDirector(page: import("@playwright/test").Page) {
  await page.goto("/erp/login");
  await page.getByLabel("Tên đăng nhập").fill("giamdoc");
  await page.getByLabel("Mật khẩu").fill(ERP_DIRECTOR_PASSWORD);
  await page.getByRole("button", { name: "Mở hệ thống quản lý" }).click();
  await expect(page).toHaveURL(/\/erp$/);
}

test("dải mạch việc đứng trước phần làm việc và gập sẵn", async ({ page }) => {
  await loginAsDirector(page);
  await page.goto("/erp/trang-an/ve-dat-cho");

  const dai = page.getByTestId("mach-viec");
  await expect(dai).toBeVisible();
  await expect(dai).toContainText("Đóng ca bán vé");

  // Gập sẵn: chưa bấm thì không bước nào đổ ra.
  await expect(page.getByTestId("mach-viec-buoc")).toHaveCount(0);

  const viTri = await page.evaluate(() => {
    const d = document.querySelector('[data-testid="mach-viec"]');
    const tieuDe = Array.from(document.querySelectorAll("h1, h2, h3")).find((el) =>
      (el.textContent ?? "").includes("Bán vé tại quầy"),
    );
    return {
      topDai: d ? d.getBoundingClientRect().top + window.scrollY : null,
      topViec: tieuDe ? tieuDe.getBoundingClientRect().top + window.scrollY : null,
      caoDai: d ? d.getBoundingClientRect().height : null,
      tranNgang: document.documentElement.scrollWidth > window.innerWidth + 1,
    };
  });
  expect(viTri.topDai).not.toBeNull();
  expect(viTri.tranNgang).toBe(false);
  // Gập lại thì phải gọn: đo thật ở khổ 390px là ~200px.
  expect(viTri.caoDai!).toBeLessThan(280);
  if (viTri.topViec !== null) {
    expect(viTri.topDai!).toBeLessThan(viTri.topViec);
  }
});

test("mở ra thì thấy đủ năm bước, ai làm, dữ liệu từ đâu và bước sau ở đâu", async ({
  page,
}) => {
  await loginAsDirector(page);
  await page.goto("/erp/trang-an/ve-dat-cho");
  await page.getByTestId("mach-viec-toggle").click();

  const buoc = page.getByTestId("mach-viec-buoc");
  await expect(buoc).toHaveCount(5);
  await expect(buoc.first()).toContainText("Nhân viên nộp sổ ca");
  await expect(buoc.first()).toContainText("Dữ liệu từ đâu");
  await expect(buoc.first()).toContainText("Làm xong thì có gì");
  await expect(buoc.first()).toContainText("Xong rồi sang bước 2");

  // Nhánh ngoại lệ của giám đốc phải hiện, và phải nằm ngoài đường chính.
  await expect(page.getByTestId("mach-viec-nhanh")).toHaveCount(1);
  await expect(page.getByTestId("mach-viec-nhanh")).toContainText("Giám đốc");

  // Bước 1 và 2 làm ngay tại màn này, nên không mời bấm đi đâu cả.
  await expect(page.getByTestId("mach-viec-dang-o-day").first()).toBeVisible();
});

test("màn Đối tác mang mạch công nợ, không mang mạch đóng ca", async ({ page }) => {
  await loginAsDirector(page);
  await page.goto("/erp/trang-an/doi-tac-nha-cung-ung");

  const dai = page.getByTestId("mach-viec");
  await expect(dai).toHaveCount(1);
  await expect(dai).toHaveAttribute("data-mach", "cong-no-doi-tac");
  await dai.getByTestId("mach-viec-toggle").click();
  await expect(page.getByTestId("mach-viec-buoc")).toHaveCount(6);
});

test("màn không thuộc luồng tiền nào thì không dựng dải", async ({ page }) => {
  await loginAsDirector(page);
  await page.goto("/erp/trang-an/camera-ai");
  await expect(page.getByTestId("mach-viec")).toHaveCount(0);
});
