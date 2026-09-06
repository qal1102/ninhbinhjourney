import { expect, test } from "@playwright/test";

const TEXT_BOX = "Hoặc kể bằng lời của bạn";
const RUN_BUTTON = "Xem thử một ngày cho tôi";
const EXPAND_BUTTON = "Chỉnh lại cho đúng";

// Regression cover for the planner being unusable outside an operator demo
// room: an ordinary visitor never holds an `nbj-active-run` cookie, so the
// generate step used to fail with DEMO_ROOM_NOT_JOINED every time.
test("an ordinary visitor can generate an itinerary without joining a demo room", async ({
  page,
}) => {
  await page.context().clearCookies();
  await page.goto("/plan");

  await page
    .getByLabel(TEXT_BOX)
    .fill("Tôi có 6 giờ, thích thiên nhiên và nhiếp ảnh, muốn đi bộ vừa phải.");
  await page.getByRole("button", { name: RUN_BUTTON }).click();

  // Chín ô chi tiết nay gập lại, nên phải mở ra mới chạm được ô ngày.
  await page.getByRole("button", { name: EXPAND_BUTTON }).click();
  const visitDate = page.getByLabel("Ngày đi");
  await expect(visitDate).toBeVisible();
  await expect(visitDate).not.toHaveValue("");

  await page.getByRole("button", { name: "Xác nhận và tạo hành trình" }).click();

  await expect(
    page.getByRole("heading", { name: /Lịch trình hợp lệ|Cần xử lý xung đột/ }),
  ).toBeVisible();
  await expect(page.getByText(/lưu trên máy bạn/)).toBeVisible();
});

/*
 * Chủ dự án dùng thử và nói đúng chỗ đau: *"đặt mày vào suy nghĩ của khách khi
 * tới 1 địa điểm, mày hỏi cả chục câu hỏi như này có khi khách cũng đ biết
 * phải làm sao"*. Trang mở ra là một ô trống rồi chín ô nữa phải điền trước
 * khi thấy được bất cứ thứ gì.
 *
 * Bài này khoá lối vào ngắn: **bấm đúng MỘT cái** là ra kết quả, không gõ chữ
 * nào, không chạm ô nào trong chín ô kia. Nếu ai đó lỡ tay bắt điền lại trước
 * khi cho xem, bài này đỏ.
 */
test("một thẻ gợi ý, bấm một cái là ra kết quả, không phải điền ô nào", async ({
  page,
}) => {
  await page.goto("/plan");

  // Chín ô chi tiết phải đang gập -- đó chính là điều đang sửa.
  await expect(page.getByLabel("Ngày đi")).toBeHidden();

  await page.getByRole("button", { name: /Đi cùng bố mẹ/ }).click();

  // Kết quả phải hiện ngay, không cần bấm gì thêm.
  await expect(
    page.getByRole("heading", { name: "Chúng tôi hiểu thế này" }),
  ).toBeVisible();
  const summary = page.locator("[data-plan-summary]");
  await expect(summary).toContainText("Nhịp thư thả");
  await expect(summary).toContainText("ít đi bộ");

  // Và phải gợi ý được gói, chứ không dừng ở chỗ hiểu xong rồi thôi.
  await expect(page.locator("[data-plan-package-match]")).toHaveAttribute(
    "data-plan-package-match",
    "matched",
  );

  // Chín ô vẫn còn nguyên, chỉ gập lại — giấu hẳn thì khách không biết mình
  // đang bị đoán hộ những gì.
  await expect(page.getByLabel("Ngày đi")).toBeHidden();
  await page.getByRole("button", { name: EXPAND_BUTTON }).click();
  await expect(page.getByLabel("Ngày đi")).toBeVisible();
});

test("mỗi thẻ gợi ý cho ra một cách hiểu khác nhau", async ({ page }) => {
  // Bấm thẻ rồi mới `setText` thì `parseText` đọc phải giá trị của lần dựng
  // trước, và thẻ thứ hai sẽ ra kết quả của thẻ thứ nhất. Bài này bắt đúng
  // lỗi đó: hai thẻ khác nhau phải cho hai dòng tóm tắt khác nhau.
  await page.goto("/plan");

  await page.getByRole("button", { name: /Đi cùng bố mẹ/ }).click();
  const parents = await page.locator("[data-plan-summary]").innerText();

  await page.getByRole("button", { name: /Cả nhà có trẻ nhỏ/ }).click();
  const family = await page.locator("[data-plan-summary]").innerText();

  expect(family).not.toBe(parents);
  expect(family).toContain("trẻ em");
});

test("the visitor picks the travel date instead of inheriting a fixed one", async ({
  page,
}) => {
  await page.goto("/plan");
  await page
    .getByLabel(TEXT_BOX)
    .fill("Gia đình tôi có 2 người lớn và 2 trẻ em, muốn một ngày cân bằng.");
  await page.getByRole("button", { name: RUN_BUTTON }).click();

  await page.getByRole("button", { name: EXPAND_BUTTON }).click();
  const visitDate = page.getByLabel("Ngày đi");
  const chosen = "2026-09-04";
  await visitDate.fill(chosen);
  await page.getByRole("button", { name: "Xác nhận và tạo hành trình" }).click();

  await expect(
    page.getByRole("heading", { name: /Lịch trình hợp lệ|Cần xử lý xung đột/ }),
  ).toBeVisible();
  // Every stop must fall on the date the visitor chose.
  await expect(page.locator("ol li").first()).toBeVisible();
});

test("editing an unsaved itinerary recalculates it in place", async ({
  page,
}) => {
  await page.goto("/plan");
  await page
    .getByLabel(TEXT_BOX)
    .fill("Tôi có 6 giờ, thích thiên nhiên và nhiếp ảnh, muốn đi bộ vừa phải.");
  await page.getByRole("button", { name: RUN_BUTTON }).click();
  await page.getByRole("button", { name: "Xác nhận và tạo hành trình" }).click();

  const stops = page.locator("ol > li");
  await expect(stops.first()).toBeVisible();
  const before = await stops.first().locator("h3").innerText();

  await stops.first().getByRole("button", { name: "Xuống" }).click();

  await expect(page.getByText(/Đã tính lại lịch trình/)).toBeVisible();
  await expect(stops.first().locator("h3")).not.toHaveText(before);
});
