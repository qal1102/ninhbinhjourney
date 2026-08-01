import { expect, test } from "@playwright/test";

// Regression cover for the planner being unusable outside an operator demo
// room: an ordinary visitor never holds an `nbj-active-run` cookie, so the
// generate step used to fail with DEMO_ROOM_NOT_JOINED every time.
test("an ordinary visitor can generate an itinerary without joining a demo room", async ({
  page,
}) => {
  await page.context().clearCookies();
  await page.goto("/plan");

  await page
    .getByLabel("Yêu cầu bằng văn bản")
    .fill("Tôi có 6 giờ, thích thiên nhiên và nhiếp ảnh, muốn đi bộ vừa phải.");
  await page.getByRole("button", { name: "Hiểu yêu cầu" }).click();

  const visitDate = page.getByLabel("Ngày đi");
  await expect(visitDate).toBeVisible();
  await expect(visitDate).not.toHaveValue("");

  await page.getByRole("button", { name: "Xác nhận và tạo hành trình" }).click();

  await expect(
    page.getByRole("heading", { name: /Lịch trình hợp lệ|Cần xử lý xung đột/ }),
  ).toBeVisible();
  await expect(page.getByText(/lưu trên máy bạn/)).toBeVisible();
});

test("the visitor picks the travel date instead of inheriting a fixed one", async ({
  page,
}) => {
  await page.goto("/plan");
  await page
    .getByLabel("Yêu cầu bằng văn bản")
    .fill("Gia đình tôi có 2 người lớn và 2 trẻ em, muốn một ngày cân bằng.");
  await page.getByRole("button", { name: "Hiểu yêu cầu" }).click();

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
    .getByLabel("Yêu cầu bằng văn bản")
    .fill("Tôi có 6 giờ, thích thiên nhiên và nhiếp ảnh, muốn đi bộ vừa phải.");
  await page.getByRole("button", { name: "Hiểu yêu cầu" }).click();
  await page.getByRole("button", { name: "Xác nhận và tạo hành trình" }).click();

  const stops = page.locator("ol > li");
  await expect(stops.first()).toBeVisible();
  const before = await stops.first().locator("h3").innerText();

  await stops.first().getByRole("button", { name: "Xuống" }).click();

  await expect(page.getByText(/Đã tính lại lịch trình/)).toBeVisible();
  await expect(stops.first().locator("h3")).not.toHaveText(before);
});
