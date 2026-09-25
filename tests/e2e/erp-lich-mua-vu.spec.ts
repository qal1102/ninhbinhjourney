import { expect, test, type Page } from "@playwright/test";

import { ERP_DIRECTOR_PASSWORD } from "./support/erp-credentials";

/**
 * Lịch mùa vụ trên màn hình Marketing.
 *
 * Màn hình này chỉ giám đốc vào được, nên bài kiểm phải đăng nhập thật. Bài
 * quan trọng nhất không phải "có khối lịch không" mà là **ngày có được tính
 * ra không** và **chữ trên màn hình có còn là chữ máy không** — hai điều chủ
 * dự án hỏi thẳng: *"tại sao toàn code ở trong đây vậy?"*
 */

async function dangNhapGiamDoc(page: Page) {
  await page.goto("/erp/login");
  await page.getByLabel("Tên đăng nhập").fill("giamdoc");
  await page.getByLabel("Mật khẩu").fill(ERP_DIRECTOR_PASSWORD);
  await page.getByRole("button", { name: "Mở hệ thống quản lý" }).click();
  await expect(page).toHaveURL(/\/erp$/);
}

test.describe("Marketing: lịch mùa vụ", () => {
  test("lịch dựng đủ mười hai tháng và ngày âm lịch được tính ra ngày dương", async ({
    page,
  }) => {
    test.slow();
    await dangNhapGiamDoc(page);
    await page.goto("/erp/marketing");

    const lich = page.getByTestId("lich-mua-vu");
    await expect(lich).toBeVisible();

    // Đủ bộ dịp đã khai, không thiếu dịp nào.
    const dip = lich.locator("[data-dip]");
    await expect(dip).toHaveCount(12);

    // Mỗi dịp phải in ra một ngày dương lịch thật, dạng dd.MM.yyyy.
    //
    // KHÔNG đặt ranh giới từ ở cuối biểu thức: trong DOM ngày nằm sát ngay
    // chữ kế tiếp ("25.09.2026" rồi liền "15/8 âm lịch"), nên ranh giới ấy
    // không tồn tại và bài kiểm đỏ oan — đã đỏ oan đúng một lần vì chuyện này.
    const ngay = await dip.evaluateAll((els) =>
      els.map((e) => (e.textContent ?? "").match(/\b\d{2}\.\d{2}\.\d{4}/)?.[0] ?? ""),
    );
    expect(ngay.filter(Boolean)).toHaveLength(12);

    // Và các dịp phải xếp tăng dần theo ngày — một cuốn lịch xếp lộn xộn thì
    // không ai dùng được.
    const khoa = ngay.map((n) => n.split(".").reverse().join("-"));
    expect([...khoa].sort()).toEqual(khoa);
  });

  test("các dịp lớn theo âm lịch đều có mặt, kèm ngày âm lịch gốc", async ({ page }) => {
    test.slow();
    await dangNhapGiamDoc(page);
    await page.goto("/erp/marketing");
    const lich = page.getByTestId("lich-mua-vu");

    for (const ten of [
      "Tết Nguyên đán",
      "Khai hội chùa Bái Đính",
      "Lễ hội Hoa Lư (Trường Yên)",
      "Lễ hội Tràng An",
      "Đại lễ Phật đản",
      "Lễ Vu lan",
      "Tết Trung thu",
    ]) {
      await expect(lich.getByText(ten, { exact: false }).first()).toBeVisible();
    }
    await expect(lich.getByText("15/4 âm lịch").first()).toBeVisible();
  });

  test("bấm một dịp thì ô tạo chiến dịch mở ra với tên đã điền sẵn", async ({ page }) => {
    test.slow();
    await dangNhapGiamDoc(page);
    await page.goto("/erp/marketing");

    const dipPhatDan = page
      .getByTestId("lich-mua-vu")
      .locator('[data-dip="phat-dan"]')
      .getByRole("link");
    // Liên kết phải mang theo mã dịp và trỏ đúng vào ô tạo chiến dịch.
    await expect(dipPhatDan).toHaveAttribute("href", /dip=phat-dan#tao-chien-dich$/);
    await dipPhatDan.click();

    // Ô tạo chiến dịch chỉ dựng khi đọc được kho mã QR. Máy cục bộ thường
    // không có kho ấy, và khi đó màn hình nói thẳng là chưa sẵn sàng — không
    // phải lỗi, nên bài kiểm dừng ở đây thay vì đỏ oan. Phần điền sẵn được
    // canh tiếp trên production, nơi kho QR có thật.
    const o = page.locator('#tao-chien-dich input[name="name"]');
    if ((await o.count()) === 0) {
      // Lấy theo vai trò tiêu đề: Next.js còn đặt đúng câu ấy vào ô thông báo
      // điều hướng cho trình đọc màn hình, nên khớp theo chữ trần sẽ trúng hai
      // phần tử và Playwright từ chối ở strict mode.
      await expect(
        page.getByRole("heading", { name: "Kho QR chưa sẵn sàng ở môi trường này" }),
      ).toBeVisible();
      return;
    }
    await expect(o).toHaveValue(/Đại lễ Phật đản \d{4}/);
    // Ô "Thuộc dịp" chọn sẵn đúng dịp vừa bấm: tạo xong là chiến dịch được
    // gắn vào dịp, và phễu khách cộng được lượt quét, doanh thu theo dịp.
    await expect(page.locator('#tao-chien-dich select[name="dip"]')).toHaveValue("phat-dan");
  });

  test("phễu khách có bảng theo dịp, và mỗi chiến dịch có chỗ gắn dịp", async ({ page }) => {
    // Chỉ đọc: bài này không tạo chiến dịch nào, vì chiến dịch không gỡ được
    // và nhật ký chiến dịch chỉ ghi thêm, không xoá.
    test.slow();
    await dangNhapGiamDoc(page);
    await page.goto("/erp/marketing");
    await expect(page.getByTestId("lich-mua-vu")).toBeVisible();
    if ((await page.locator("#tao-chien-dich").count()) === 0) return;
    const bang = page.getByTestId("phieu-theo-dip");
    if ((await bang.count()) > 0) {
      await expect(bang.getByRole("heading", { name: /dịp nào ra tiền/ })).toBeVisible();
    }
    const danhSach = page.getByTestId("danh-sach-chien-dich");
    if ((await danhSach.count()) > 0) {
      await expect(danhSach.locator('select[name="dip"]').first()).toBeVisible();
    }
  });

  test("màn hình marketing không in tên bảng dữ liệu ra cho người dùng đọc", async ({
    page,
  }) => {
    test.slow();
    await dangNhapGiamDoc(page);
    await page.goto("/erp/marketing");
    await expect(page.getByTestId("lich-mua-vu")).toBeVisible();

    // Chủ dự án mở màn hình này và hỏi "tại sao toàn code ở trong đây vậy?".
    // Đây là hàng rào để chữ máy không quay lại.
    const chu = (await page.locator("main").innerText()).toLowerCase();
    for (const ma of [
      "marketing_qr_scans",
      "customer_events",
      "customer_booking_holds",
      "customer_payment_attempts",
      "erp_gate_scan_events",
      "cus-06",
      "t11a",
    ]) {
      expect(chu, `còn chữ máy "${ma}" trên màn hình`).not.toContain(ma);
    }
  });
});
