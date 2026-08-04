import { expect, test, type Page } from "@playwright/test";

/**
 * T10b — xác minh chỉ-đọc trên production rằng khối "Đối soát tiền mặt" thật
 * sự dựng được cho tài khoản kế toán, không vỡ khi chạy thật (đúng bẫy #11:
 * lỗi export sai trong file "use server" từng qua lọt next build cục bộ
 * nhưng nổ khi chạy thật). Không bấm nút ghi nào — vòng round-trip tài chính
 * đầy đủ (nộp quỹ → khớp → ghi sổ) cần dựng cả một chuỗi ca chốt → duyệt →
 * bút toán làm tiền đề, nằm ngoài phạm vi lượt xác minh này; xem HANDOFF.md.
 */

async function login(page: Page, username: string, password: string) {
  await page.goto("/erp/login");
  await page.getByLabel("Tên đăng nhập").fill(username);
  await page.getByLabel("Mật khẩu").fill(password);
  await page.getByRole("button", { name: "Mở hệ thống quản lý" }).click();
  await expect(page).toHaveURL(/\/erp$/);
}

test("kế toán thấy khối đối soát tiền mặt trên /erp/finance, không lỗi runtime", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await login(page, "ketoan", "Ketoan@2026");
  await page.goto("/erp/finance");

  await expect(
    page.getByRole("heading", { level: 2, name: "Nộp quỹ → ngân hàng → đối chiếu sao kê" }),
  ).toBeVisible();
  await expect(page.getByText("Lượt nộp quỹ (")).toBeVisible();

  expect(errors, `unexpected client-side runtime errors: ${errors.join(" | ")}`).toEqual([]);
});
