import { expect, test, type Page } from "@playwright/test";
import { ERP_DIRECTOR_PASSWORD } from "./support/erp-credentials";

/**
 * A3 — cổng ngoại tuyến, kiểm trên production, CHỈ ĐỌC.
 *
 * `erp-offline-gate.spec.ts` **không thay được bài này**: nó `page.route(...)`
 * cả `/manifests` lẫn `/sync`, tức là chạy trọn vẹn với máy chủ giả. Trỏ nó
 * vào production cũng vẫn chỉ kiểm giao diện — đúng loại bằng chứng dễ bị
 * nhầm là bằng chứng production.
 *
 * Bài này ngược lại: không mock gì, mở đúng màn hình thật và đọc.
 *
 * **Không bấm "Nạp vé cho ca".** Nút đó gọi `POST /api/erp/offline-gate/manifests`
 * → `prepareOfflineGateManifest` → **ghi một manifest thật** vào cơ sở dữ liệu
 * production, và dự án **không có RPC xoá manifest**. Theo `AGENTS.md`, một
 * spec ghi mà không dọn được là một spec không được phép ghi. Nên phạm vi ở
 * đây dừng đúng ở chỗ: chứng minh cờ bật, màn hình sống, đường nạp vé sẵn sàng.
 *
 * Mở màn hình là an toàn: `OfflineGateConsole` lúc mount chỉ đọc IndexedDB;
 * `prepareManifest` chỉ chạy khi người dùng bấm nút.
 */

const enabled = process.env.NBJ_A3_OFFLINE_SMOKE === "1";

async function loginAsDirector(page: Page) {
  await page.goto("/erp/login");
  await page.getByLabel(/Email hoặc tên đăng nhập|Tên đăng nhập/).fill("giamdoc");
  await page.getByLabel("Mật khẩu").fill(ERP_DIRECTOR_PASSWORD);
  await page.getByRole("button", { name: "Mở hệ thống quản lý" }).click();
  await expect(page).toHaveURL(/\/erp$/, { timeout: 25_000 });
}

test.describe("A3 production offline gate smoke", () => {
  test.skip(
    !enabled,
    "Đặt NBJ_A3_OFFLINE_SMOKE=1 để chạy. Mặc định tắt vì cờ ngoại tuyến tắt ở môi trường cục bộ, bài sẽ đỏ vì cấu hình chứ không phải vì sản phẩm.",
  );

  test.beforeAll(() => {
    const baseUrl = process.env.PLAYWRIGHT_BASE_URL;
    if (!baseUrl || new URL(baseUrl).hostname !== "ninhbinhjourney.vercel.app") {
      throw new Error(
        "A3 production smoke bắt buộc PLAYWRIGHT_BASE_URL=https://ninhbinhjourney.vercel.app trong CÙNG câu lệnh.",
      );
    }
  });

  test("console ngoại tuyến sống trên production mà không tạo manifest nào", async ({ page }) => {
    // Bất kỳ POST nào tới hai endpoint ghi đều là lỗi của chính spec này.
    // Chặn ở tầng mạng thay vì tin vào việc mình không bấm nhầm.
    const forbiddenWrites: string[] = [];
    await page.route("**/api/erp/offline-gate/**", async (route) => {
      if (route.request().method() !== "GET") {
        forbiddenWrites.push(route.request().url());
        return route.abort();
      }
      return route.fallback();
    });

    await loginAsDirector(page);
    await page.goto("/erp/tam-coc/check-in-khach");

    const console_ = page.getByTestId("offline-gate-console");
    await expect(console_).toBeVisible({ timeout: 25_000 });
    await expect(
      page.getByRole("heading", { name: "Quét tiếp khi mất mạng" }),
    ).toBeVisible();

    // Đường nạp vé phải sẵn sàng — nhưng chỉ kiểm sự tồn tại, không kích hoạt.
    await expect(
      console_.getByRole("button", { name: "Nạp vé cho ca" }),
    ).toBeVisible();

    // Chưa nạp bộ vé thì ô ghi hàng đợi phải bị khoá. Đây là fail-closed thật:
    // không có manifest thì không quét được, chứ không phải cho quét bừa rồi
    // sửa sau.
    await expect(
      console_.getByRole("button", { name: "Ghi vào hàng đợi" }),
    ).toBeDisabled();

    expect(
      forbiddenWrites,
      "Spec chỉ đọc mà vẫn phát sinh ghi tới offline-gate",
    ).toEqual([]);

    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      ),
    ).toBeLessThanOrEqual(1);
  });
});
