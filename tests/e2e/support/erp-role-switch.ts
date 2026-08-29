import { expect, type Page } from "@playwright/test";

/**
 * Chuyển vai ngay bên trong phiên giám đốc — đúng cách chủ dự án dùng thật.
 *
 * Vì sao có tệp này: bộ smoke production trước đây đăng nhập lại bằng bốn tài
 * khoản khác nhau, nên muốn chạy phải có bốn mật khẩu. Ngày 29/08/2026 thiếu
 * ba trong bốn và bốn bài đỏ ở `/erp/login?error=invalid` — trông hệt một hồi
 * quy giao diện. Người vận hành thật thì chỉ đăng nhập một lần bằng giám đốc
 * rồi bấm "Xem theo vai trò", nên bộ smoke đi theo đúng đường đó: **một mật
 * khẩu duy nhất**, và bản thân đường chuyển vai cũng được kiểm luôn.
 *
 * Chuyển vai là **đổi thật phiên đăng nhập**, không phải cờ giao diện: mọi
 * kiểm tra quyền phía máy chủ áp lên tài khoản đích y như họ tự đăng nhập
 * (xem `lib/erp/demo-session.ts` và `prod-smoke-role-switch.spec.ts`, nơi
 * chứng minh vai bị chặn đúng chỗ đáng bị chặn).
 *
 * Điều này KHÔNG chứng minh: rằng tài khoản kia tự đăng nhập được. Mật khẩu
 * của họ không còn nằm trên đường đi của bộ smoke nữa. `prod-smoke-t6b-auth`
 * mới là nơi canh giữ việc đăng nhập.
 *
 * Có ghi vào nhật ký: mỗi lần chuyển sinh một dòng kiểm toán "started" và một
 * dòng "ended". Không xoá được và cũng không nên xoá — đó là bản ghi trung
 * thực rằng giám đốc đã xem thử. Đổi lại, `endRoleSwitch` bắt buộc được gọi
 * để không bỏ lại phiên nào đang treo giữa chừng.
 */

/**
 * Cú bấm đầu tiên vào nút của server action có thể rơi vào khoảng trống.
 *
 * Đo được ngày 29/08 khi chạy 4 worker song song: nút "Quay lại giám đốc"
 * nhận cú bấm (nó giữ con trỏ trong ảnh chụp) nhưng biểu mẫu **không gửi đi**,
 * và chờ thêm 25 giây cũng không đổi. Không phải chậm — cú bấm đã mất hẳn.
 * Lần chạy sau đỏ ở khổ màn hình khác, nên cũng không phải chuyện máy để bàn
 * hay điện thoại: nó là chạy đua với lúc React gắn xong trình xử lý.
 *
 * Vì thế mọi nút chạy server action ở đây đều bấm qua hàm này: bấm, xem trạng
 * thái đã đổi chưa, chưa thì bấm lại. Điều kiện `xong()` phải là **kết quả
 * thật trên máy chủ**, không phải địa chỉ URL — đứng sẵn ở đích thì phép so
 * URL đúng ngay lập tức và không chờ gì cả.
 *
 * Tác dụng phụ đã lường trước: nếu cú bấm THÀNH CÔNG mà giao diện vẽ lại chậm
 * hơn 5 giây, vòng lặp bấm thêm một lần nữa và máy chủ ghi một dòng lỗi vô hại
 * ("Không đang xem theo vai trò khác"). Nó ném trước khi ghi nhật ký nên không
 * sinh bản ghi kiểm toán rác. Thấy dòng đó trong log máy chủ thì không phải lỗi.
 */
async function clickUntil(
  click: () => Promise<void>,
  xong: () => Promise<void>,
  label: string,
) {
  await expect(
    async () => {
      await click();
      await xong();
    },
    label,
  ).toPass({ timeout: 45_000, intervals: [1_000, 2_000, 3_000] });
}

/**
 * Bảng chọn nằm hai nơi trong DOM: thanh điều hướng máy để bàn (ẩn bằng CSS
 * dưới `lg`, không bị gỡ) và ngăn kéo điện thoại. Quyết định theo bề ngang
 * đã cấu hình chứ không theo `isVisible()` — ảnh chụp DOM từng chạy đua với
 * bố cục và chọn nhầm bản máy để bàn khi chạy song song.
 */
async function roleSwitchContainer(page: Page) {
  if ((page.viewportSize()?.width ?? 1280) >= 1024) {
    return page.getByRole("banner");
  }
  await page.getByRole("button", { name: "Mở menu" }).click();
  return page.getByLabel("Menu điều hành");
}

function switchBanner(page: Page) {
  return page.getByRole("status").filter({ hasText: "Đang xem với vai trò" });
}

export async function switchToAccount(
  page: Page,
  targetAccountId: string,
  expectedBannerText: string,
) {
  const container = await roleSwitchContainer(page);
  // Bám vào cấu trúc, không bám vào chữ. Hai lý do, cả hai đều đã làm đỏ thật:
  // nhãn đổi theo trạng thái ("Xem theo vai trò" → "Đổi vai trò khác"), và bản
  // trong ngăn kéo điện thoại còn kèm mũi tên ▾ nên khớp nguyên chuỗi thì trượt.
  const opener = container.locator(
    'details:has(select[name="targetUserId"]) > summary',
  );
  await expect(
    opener,
    "Không thấy ô chuyển vai. Hoặc phiên hiện tại không phải giám đốc, hoặc máy chủ chưa bật ERP_DEMO_ROLE_SWITCH=true.",
  ).toBeVisible({ timeout: 25_000 });

  const banner = switchBanner(page);
  await clickUntil(
    async () => {
      // Mở lại bảng chọn nếu cú bấm trước rơi vào khoảng trống. `<details>` và
      // `<select>` là HTML thuần nên chúng luôn ăn, kể cả trước lúc React gắn
      // xong; chỉ nút gửi biểu mẫu mới là chỗ mất cú bấm.
      const submit = container.getByRole("button", { name: "Xem thử" });
      if ((await submit.count()) === 0) await opener.click();
      await container
        .locator('select[name="targetUserId"]')
        .selectOption(targetAccountId);
      await submit.click();
    },
    async () => {
      await expect(banner).toContainText(expectedBannerText, { timeout: 5_000 });
    },
    `chuyển vai sang ${targetAccountId}`,
  );
}

/** Trả phiên về giám đốc. Gọi ở cuối mọi bài có chuyển vai. */
export async function endRoleSwitch(page: Page) {
  const banner = switchBanner(page);
  await clickUntil(
    async () => {
      // Đã về giám đốc rồi thì không còn nút để bấm — để phép kiểm bên dưới
      // kết luận, đừng làm đỏ vì không tìm thấy nút.
      const back = banner.getByRole("button", { name: "Quay lại giám đốc" });
      if ((await back.count()) > 0) await back.click();
    },
    async () => {
      await expect(banner).toHaveCount(0, { timeout: 5_000 });
    },
    "quay lại giám đốc",
  );
  await expect(page).toHaveURL(/\/erp$/);
}
