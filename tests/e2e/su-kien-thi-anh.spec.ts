import { expect, test } from "@playwright/test";

/*
 * Thi ảnh, gợi ý "bạn của bạn đã đi", dải "Đang diễn ra" (13/10/2026). Máy cục
 * bộ không có kho: kiểm phần trang dựng được không cần kho, và chặn lời gọi
 * tra "ảnh của tôi" bằng một kết quả mẫu. Sự kiện cần kho nên kiểm trên
 * production.
 */

test("trang thi ảnh có cơ cấu 8 giải, thể lệ, biểu mẫu và tra mã nhận giải", async ({ page }) => {
  await page.route("**/api/thi-anh", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ accepted: true, anh: [{ thang: "2026-10", dauMa: "trang-an", chuThich: "", trangThai: "da-duyet", giai: "nhat", maNhan: "GIAI-ABC123" }] }),
    }),
  );
  await page.goto("/thi-anh");
  await expect(page.getByTestId("co-cau-giai").locator("li")).toHaveCount(4);
  await expect(page.getByTestId("co-cau-giai")).toContainText("Khuyến khích × 5");
  await expect(page.getByTestId("form-thi-anh").getByRole("button", { name: "Gửi ảnh" })).toBeVisible();
  await page.getByLabel("Số điện thoại đã gửi ảnh").fill("0912345678");
  await page.getByRole("button", { name: "Tra", exact: true }).click();
  await expect(page.getByTestId("anh-cua-toi")).toContainText("Giải nhất · mã nhận giải GIAI-ABC123");
});

test("bạn của bạn đã đi Tràng An: trang mời có lối mua vé đúng giá", async ({ page }) => {
  await page.goto("/ban-da-di/trang-an?moi=co");
  await expect(page.getByRole("heading", { level: 1, name: "Tràng An" })).toBeVisible();
  await expect(page.getByTestId("ban-da-di-moi")).toContainText("giảm 10%");
  await expect(page.getByRole("link", { name: /Mua vé 250\.000 đ/ })).toHaveAttribute("href", /package=ve-trang-an/);
});

test("trang Mua vé có dải Đang diễn ra dẫn tới thi ảnh", async ({ page }) => {
  await page.goto("/packages");
  await expect(page.getByTestId("dang-dien-ra").getByRole("link", { name: /Ảnh đẹp Ninh Bình/ })).toHaveAttribute("href", /\/thi-anh/);
});

test("dấu đã có thì có nút khoe với bạn, dấu lời hứa thì không", async ({ page }) => {
  await page.goto("/dau/tam-coc-c4n");
  await expect(page.getByTestId("khoe-tam-coc")).toBeVisible();
  await page.goto("/loi-hua");
  await page.getByTestId("nut-toi-hua").click();
  await expect(page.getByTestId("khoe-loi-hua")).toHaveCount(0);
});

test("gửi ảnh 4 MB: chỉ ảnh đã thu nhỏ đi lên máy chủ, trang báo đã nhận", async ({ page }) => {
  let coThan = 0;
  await page.route("**/api/thi-anh", async (route) => {
    coThan = route.request().postDataBuffer()?.byteLength ?? 0;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ accepted: true, thang: "2026-10" }) });
  });
  await page.goto("/thi-anh");
  const f = page.getByTestId("form-thi-anh");
  await f.locator('input[type="file"]').setInputFiles("public/images/destinations/bai-dinh.jpg");
  await expect(f.getByRole("img", { name: "Ảnh sắp gửi" })).toBeVisible();
  await f.locator('input[name="ten"]').fill("Lan");
  await f.locator('input[name="so_dien_thoai"]').fill("0912345678");
  await f.getByText(/Tôi đồng ý thể lệ/).click();
  await f.getByRole("button", { name: "Gửi ảnh" }).click();
  await expect(page.getByTestId("thong-bao-thi-anh")).toContainText("Đã nhận ảnh");
  // Ảnh gốc 4,1 MB; Vercel nhận tối đa 4,5 MB mỗi yêu cầu. Thân yêu cầu phải là ảnh đã thu nhỏ.
  expect(coThan).toBeGreaterThan(10_000);
  expect(coThan).toBeLessThan(2_000_000);
});
