import { expect, test } from "@playwright/test";
import { loginAsDirector } from "./support/erp-login";

/**
 * Hộ chiếu Ninh Bình của khách, và màn hình "Khách thấy gì" của giám đốc.
 *
 * Máy cục bộ không có kho dữ liệu thật, nên bài khách chặn đúng một lời gọi
 * `/api/ho-so` và trả một hồ sơ mẫu: thứ được kiểm là màn hình dựng đúng từ
 * dữ liệu ấy, không phải kho. Chỉ đọc, không ghi gì.
 */

const TRANG_AN = "10000000-0000-4000-8000-000000000001";
const TAM_COC = "10000000-0000-4000-8000-000000000005";

const HO_SO_MAU = {
  don: [{
    orderCode: "NBJ-ABCDEF123456",
    productName: "Di sản trong một ngày",
    visitDate: "2026-09-20",
    partySize: 2,
    totalVnd: 1780000,
    paymentLabel: "Đã thanh toán bằng QR",
    tickets: [{ ticketCode: "WEB-ABCDEF123456", siteId: TRANG_AN, validOn: "2026-09-20", entriesAllowed: 2, entriesUsed: 2 }],
  }],
  noiDaDen: [
    { siteId: TRANG_AN, lanDau: "2026-09-20T02:00:00Z", soLan: 1 },
    { siteId: TAM_COC, lanDau: "2026-09-20T07:00:00Z", soLan: 1 },
  ],
  soNgayDi: 1,
  soNhiemVuXong: 2,
  nhiemVu: [
    { id: "buoc-dau", ten: "Bước chân đầu tiên", moTa: "Qua cổng ở bất kỳ điểm nào.", duoc: 1, can: 1, xong: true, phanThuong: "Một ly trà sen ở quầy đón khách", maUuDai: "NBJ-BD000001" },
    { id: "hai-dong-nuoc", ten: "Hai dòng nước", moTa: "Ngồi thuyền ở cả Tràng An lẫn Tam Cốc.", duoc: 2, can: 2, xong: true, phanThuong: "Giảm 5% cho lần đặt kế tiếp", maUuDai: "NBJ-HN000002" },
    { id: "tron-bon-cua", ten: "Trọn bốn cửa", moTa: "Đi đủ bốn nơi.", duoc: 2, can: 4, xong: false, phanThuong: "Giảm 15% chuyến sau", maUuDai: null },
  ],
};

test.describe("Hộ chiếu Ninh Bình", () => {
  test("mở bằng mã đặt chỗ và số điện thoại, nơi đã đến sáng lên, quà hiện mã", async ({ page }) => {
    let guiLen: Record<string, unknown> = {};
    await page.route("**/api/ho-so", async (route) => {
      guiLen = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ accepted: true, hoSo: HO_SO_MAU }) });
    });
    await page.goto("/ho-so");
    await page.getByLabel("Mã đặt chỗ").fill("NBJ-ABCDEF123456");
    await page.getByLabel("Số điện thoại hoặc email đã dùng lúc đặt").fill("0912345678");
    await page.getByRole("button", { name: "Mở hộ chiếu" }).click();

    const hoSo = page.getByTestId("ho-so-khach");
    await expect(hoSo.getByRole("heading", { name: "Bạn đã qua 2 trên 4 cổng" })).toBeVisible();
    expect(guiLen).toEqual({ order_code: "NBJ-ABCDEF123456", contact: "0912345678" });
    await expect(hoSo.locator('[data-da-den="co"]')).toHaveCount(2);
    await expect(hoSo.locator('[data-da-den="chua"]')).toHaveCount(2);
    await expect(hoSo.locator('[data-nhiem-vu="hai-dong-nuoc"]')).toContainText("NBJ-HN000002");
    await expect(hoSo.locator('[data-nhiem-vu="tron-bon-cua"]')).toContainText("2/4");
    await expect(hoSo).toContainText("Đã thanh toán bằng QR");
    await expect(page.getByRole("link", { name: "Đặt chuyến tiếp theo" })).toBeVisible();
  });

  test("sai mã hay sai số thì nói nhẹ nhàng, không lộ gì", async ({ page }) => {
    await page.route("**/api/ho-so", (route) =>
      route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ accepted: false, error: { message: "Chưa tìm thấy hồ sơ khớp mã đặt chỗ và số này. Bạn xem lại giúp em ạ." } }),
      }),
    );
    await page.goto("/ho-so");
    await page.getByLabel("Mã đặt chỗ").fill("NBJ-000000000000");
    await page.getByLabel("Số điện thoại hoặc email đã dùng lúc đặt").fill("0900000000");
    await page.getByRole("button", { name: "Mở hộ chiếu" }).click();
    await expect(page.getByText(/Chưa tìm thấy hồ sơ khớp mã đặt chỗ/)).toBeVisible();
  });
});

test.describe("ERP: Khách thấy gì", () => {
  test("giám đốc có lối mở năm màn hình khách, theo đúng thứ tự một chuyến đi", async ({ page }) => {
    test.slow();
    await loginAsDirector(page);
    await page.goto("/erp/khach-hang");
    const khoi = page.getByTestId("khach-thay-gi");
    await expect(khoi.getByRole("heading", { name: "Đứng ở chỗ khách mà xem" })).toBeVisible();
    for (const [ten, href] of [
      ["Trang chủ", "/"],
      ["Chọn gói và giữ chỗ", "/packages"],
      ["Quét QR thanh toán", "/checkout?package=heritage-day"],
      ["Tra cứu vé", "/tra-cuu-ve"],
      ["Hộ chiếu Ninh Bình", "/ho-so"],
    ] as const) {
      await expect(khoi.getByRole("link", { name: new RegExp(ten) })).toHaveAttribute("href", href);
    }
  });
});
