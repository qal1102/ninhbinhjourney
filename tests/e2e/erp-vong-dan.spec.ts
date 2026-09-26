import { expect, test } from "@playwright/test";
import { ERP_DIRECTOR_PASSWORD } from "./support/erp-credentials";

/**
 * Vòng dẫn "đi theo một đồng tiền" trên trang chủ giám đốc.
 *
 * ## Vì sao phần bấm nút chỉ chạy ở máy cục bộ
 *
 * Vòng dẫn **ghi thật** vào `erp_huong_dan_tien_do`, và thứ nó ghi là trạng
 * thái "người này đã đi rồi". Chạy phần bấm trên production nghĩa là bài kiểm
 * tự tay tiêu mất lần-đầu-đăng-nhập của chủ dự án: hôm sau anh mở hệ thống,
 * vòng dẫn đã coi anh là người cũ và không chào nữa. Không có đường hoàn lại
 * — "đi lại một vòng" xoá được số chặng nhưng không xoá được việc hàng ấy đã
 * tồn tại.
 *
 * Vì thế: trên production chỉ **đọc** hình dạng; mọi cú bấm nằm sau hàng rào
 * localhost. Đây đúng tinh thần luật "một bài kiểm chạy trên production phải
 * trả hệ thống về nguyên trạng" — ở đây cách duy nhất trả về nguyên trạng là
 * không chạm vào.
 */

const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "";
const chayCucBo = baseUrl === "" || /localhost|127\.0\.0\.1/i.test(baseUrl);

// Khung tạm ẩn từ 26/09/2026 (`HIEN_VONG_DAN` trong app/erp/page.tsx): chủ dự án
// muốn dựng hướng dẫn sau cùng, khi mọi màn đã chốt. Bật lại cùng lúc với khung.
test.skip(true, "Vòng dẫn tạm ẩn cho tới khi viết kịch bản cuối cùng.");

async function loginAsDirector(page: import("@playwright/test").Page) {
  await page.goto("/erp/login");
  await page.getByLabel("Tên đăng nhập").fill("giamdoc");
  await page.getByLabel("Mật khẩu").fill(ERP_DIRECTOR_PASSWORD);
  await page.getByRole("button", { name: "Mở hệ thống quản lý" }).click();
  await expect(page).toHaveURL(/\/erp$/);
}

test("trang chủ giám đốc có vòng dẫn, và nó không tràn hay chữ bé", async ({ page }) => {
  await loginAsDirector(page);

  const vong = page.getByTestId("vong-dan");
  await expect(vong).toBeVisible();

  const do_ = await page.evaluate(() => {
    const k = document.querySelector('[data-testid="vong-dan"]');
    if (!k) return null;
    const chuNho: number[] = [];
    const chamNho: number[] = [];
    for (const el of k.querySelectorAll("*")) {
      if (el.children.length === 0 && (el.textContent ?? "").trim()) {
        const co = parseFloat(getComputedStyle(el).fontSize);
        if (co < 12) chuNho.push(co);
      }
    }
    for (const el of k.querySelectorAll("a, button")) {
      const r = el.getBoundingClientRect();
      if (r.height > 0 && r.height < 44) chamNho.push(r.height);
    }
    return {
      chuNho,
      chamNho,
      tranNgang: document.documentElement.scrollWidth > window.innerWidth + 1,
      mo: k.getAttribute("data-mo"),
    };
  });

  expect(do_).not.toBeNull();
  expect(do_!.chuNho).toEqual([]);
  expect(do_!.chamNho).toEqual([]);
  expect(do_!.tranNgang).toBe(false);

  // Dù đang mở hay đã thu, vòng dẫn luôn phải gọi được tên của chính nó.
  await expect(vong).toContainText("Trình diễn một vòng khách");
});

test("mở ra thì đi được hết bảy bước, mỗi bước nói bấm vào đâu và để ý gì", async ({ page }) => {
  test.skip(
    !chayCucBo,
    "Phần bấm nút ghi thật vào kho tiến độ — không chạy trên production.",
  );
  await loginAsDirector(page);

  const vong = page.getByTestId("vong-dan");
  if ((await vong.getAttribute("data-mo")) !== "true") {
    await page.getByTestId("vong-dan-mo").click();
  }
  await expect(vong).toHaveAttribute("data-mo", "true");
  await expect(vong).toHaveAttribute("data-chang", "1");

  // Chặng đầu không có nút lùi — không có chỗ nào để lùi về.
  await expect(page.getByTestId("vong-dan-lui")).toHaveCount(0);
  await expect(page.getByRole("progressbar")).toBeVisible();

  for (let thuTu = 1; thuTu <= 7; thuTu += 1) {
    await expect(vong).toHaveAttribute("data-chang", String(thuTu));
    await expect(vong).toContainText("Bấm vào đâu");
    await expect(vong).toContainText("Để ý thấy gì");
    if (thuTu < 7) {
      await page.getByTestId("vong-dan-tiep").click();
      await expect(vong).toHaveAttribute("data-chang", String(thuTu + 1));
    }
  }

  // Chặng cuối: nút đổi lời, và bấm xong thì vòng dẫn thu lại chứ không đứng ì.
  await expect(page.getByTestId("vong-dan-tiep")).toContainText("Xong rồi");
  await page.getByTestId("vong-dan-tiep").click();
  await expect(vong).toHaveAttribute("data-mo", "false");
});

test("bấm Để sau thì vòng dẫn thu lại và vẫn mời quay lại được", async ({ page }) => {
  test.skip(
    !chayCucBo,
    "Phần bấm nút ghi thật vào kho tiến độ — không chạy trên production.",
  );
  await loginAsDirector(page);

  const vong = page.getByTestId("vong-dan");
  if ((await vong.getAttribute("data-mo")) !== "true") {
    await page.getByTestId("vong-dan-mo").click();
  }
  await page.getByTestId("vong-dan-de-sau").click();

  await expect(vong).toHaveAttribute("data-mo", "false");
  await expect(page.getByTestId("vong-dan-mo")).toBeVisible();
});
