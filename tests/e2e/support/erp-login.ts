import { expect, type Page } from "@playwright/test";
import { ERP_DIRECTOR_PASSWORD } from "./erp-credentials";

/**
 * Đăng nhập ERP, chịu được cú bấm bị mất.
 *
 * Ngày 29/08/2026 trên production: bài A6 dừng ở `/erp/login` — **không có**
 * `?error=invalid` — với ô tên và ô mật khẩu đã điền đủ. Máy chủ chưa từng
 * nhận biểu mẫu; cú bấm rơi vào khoảng trống trước lúc React gắn xong trình
 * xử lý. Cùng một loại lỗi với nút chuyển vai, xem `erp-role-switch.ts`.
 *
 * Hai trạng thái trông giống nhau nhưng khác hẳn nguyên nhân, và cả hai đều
 * đã từng bị chẩn đoán nhầm ít nhất một lần trong dự án này:
 *
 * - dừng ở `/erp/login?error=invalid` → **sai mật khẩu**. Bấm lại vô ích, nên
 *   hàm này dừng ngay và nói thẳng ra;
 * - dừng ở `/erp/login` trơn → **cú bấm mất**. Mật khẩu không liên quan, bấm
 *   lại là đúng cách.
 *
 * Vì thế không dùng `toPass`: nó thử lại mọi loại hỏng như nhau, kể cả loại
 * thử lại bao nhiêu cũng thua, rồi kết thúc bằng một thông điệp sai nguyên do.
 */
export async function loginToErp(page: Page, username: string, password: string) {
  await page.goto("/erp/login");

  const deadline = Date.now() + 45_000;
  let attempts = 0;

  while (Date.now() < deadline) {
    attempts += 1;
    await page.getByLabel(/Email hoặc tên đăng nhập|Tên đăng nhập/).fill(username);
    await page.getByLabel("Mật khẩu").fill(password);
    await page.getByRole("button", { name: "Mở hệ thống quản lý" }).click();

    try {
      await expect(page).toHaveURL(/\/erp$/, { timeout: 12_000 });
      return;
    } catch {
      if (/error=invalid/.test(page.url())) {
        throw new Error(
          `Đăng nhập "${username}" bị máy chủ từ chối: sai mật khẩu. ` +
            "Kiểm tra biến ERP_DEMO_*_PASSWORD đã truyền trong cùng câu lệnh chưa. " +
            "Đây KHÔNG phải lỗi giao diện.",
        );
      }
    }
  }

  throw new Error(
    `Đăng nhập "${username}" không đi được sau ${attempts} lần bấm, vẫn ở ${page.url()}. ` +
      "Biểu mẫu chưa từng tới máy chủ (không có ?error=invalid), nên đây là cú bấm bị mất, " +
      "không phải sai mật khẩu.",
  );
}

export async function loginAsDirector(page: Page) {
  await loginToErp(page, "giamdoc", ERP_DIRECTOR_PASSWORD);
}
