import { expect, test } from "@playwright/test";
import { ERP_DIRECTOR_PASSWORD } from "./support/erp-credentials";

/**
 * Mạch việc — dải trả lời "tôi đang ở khúc nào của quy trình".
 *
 * Bài này canh ba thứ dễ vỡ nhất khi ai đó xếp lại bố cục: dải phải đứng
 * **trước** phần làm việc, gập sẵn thì **không** đổ cả mạch ra màn, và bước
 * trỏ về chính màn đang mở thì phải nói "bạn đang đứng ở đây" chứ không mời
 * bấm một liên kết dẫn về chỗ cũ.
 *
 * Chỉ đọc, không ghi một hàng nào, nên chạy thẳng trên production cũng sạch.
 */

async function loginAsDirector(page: import("@playwright/test").Page) {
  await page.goto("/erp/login");
  await page.getByLabel("Tên đăng nhập").fill("giamdoc");
  await page.getByLabel("Mật khẩu").fill(ERP_DIRECTOR_PASSWORD);
  await page.getByRole("button", { name: "Mở hệ thống quản lý" }).click();
  await expect(page).toHaveURL(/\/erp$/);
}

test("dải mạch việc đứng trước phần làm việc và gập sẵn", async ({ page }) => {
  await loginAsDirector(page);
  await page.goto("/erp/trang-an/ve-dat-cho");

  const dai = page.getByTestId("mach-viec");
  await expect(dai).toBeVisible();
  await expect(dai).toContainText("Đóng ca bán vé");

  // Gập sẵn: chưa bấm thì không bước nào đổ ra.
  await expect(page.getByTestId("mach-viec-buoc")).toHaveCount(0);

  const viTri = await page.evaluate(() => {
    const d = document.querySelector('[data-testid="mach-viec"]');
    const tieuDe = Array.from(document.querySelectorAll("h1, h2, h3")).find((el) =>
      (el.textContent ?? "").includes("Bán vé tại quầy"),
    );
    return {
      topDai: d ? d.getBoundingClientRect().top + window.scrollY : null,
      topViec: tieuDe ? tieuDe.getBoundingClientRect().top + window.scrollY : null,
      caoDai: d ? d.getBoundingClientRect().height : null,
      tranNgang: document.documentElement.scrollWidth > window.innerWidth + 1,
    };
  });
  expect(viTri.topDai).not.toBeNull();
  expect(viTri.tranNgang).toBe(false);
  // Gập lại thì phải gọn: đo thật ở khổ 390px là ~200px.
  expect(viTri.caoDai!).toBeLessThan(280);
  if (viTri.topViec !== null) {
    expect(viTri.topDai!).toBeLessThan(viTri.topViec);
  }
});

test("mở ra thì thấy đủ năm bước, ai làm, dữ liệu từ đâu và bước sau ở đâu", async ({
  page,
}) => {
  await loginAsDirector(page);
  await page.goto("/erp/trang-an/ve-dat-cho");
  await page.getByTestId("mach-viec-toggle").click();

  const buoc = page.getByTestId("mach-viec-buoc");
  await expect(buoc).toHaveCount(5);
  await expect(buoc.first()).toContainText("Nhân viên nộp sổ ca");
  await expect(buoc.first()).toContainText("Dữ liệu từ đâu");
  await expect(buoc.first()).toContainText("Làm xong thì có gì");
  await expect(buoc.first()).toContainText("Xong rồi sang bước 2");

  // Nhánh ngoại lệ của giám đốc phải hiện, và phải nằm ngoài đường chính.
  await expect(page.getByTestId("mach-viec-nhanh")).toHaveCount(1);
  await expect(page.getByTestId("mach-viec-nhanh")).toContainText("Giám đốc");

  // Bước 1 và 2 làm ngay tại màn này, nên không mời bấm đi đâu cả.
  await expect(page.getByTestId("mach-viec-dang-o-day").first()).toBeVisible();
});

test("màn Đối tác mang mạch công nợ, không mang mạch đóng ca", async ({ page }) => {
  await loginAsDirector(page);
  await page.goto("/erp/trang-an/doi-tac-nha-cung-ung");

  const dai = page.getByTestId("mach-viec");
  await expect(dai).toHaveCount(1);
  await expect(dai).toHaveAttribute("data-mach", "cong-no-doi-tac");
  await dai.getByTestId("mach-viec-toggle").click();
  await expect(page.getByTestId("mach-viec-buoc")).toHaveCount(6);
});

test("màn không thuộc luồng tiền nào thì không dựng dải", async ({ page }) => {
  await loginAsDirector(page);
  await page.goto("/erp/trang-an/camera-ai");
  await expect(page.getByTestId("mach-viec")).toHaveCount(0);
});

test("nút ? nói được màn này nằm ở khúc nào của quy trình", async ({ page }) => {
  await loginAsDirector(page);
  await page.goto("/erp/trang-an/ve-dat-cho");

  await page.getByRole("button", { name: /Trợ giúp về/ }).click();
  const hop = page.getByRole("dialog");
  await expect(hop).toBeVisible();

  const machTrongHop = page.getByTestId("context-help-mach");
  await expect(machTrongHop).toHaveCount(1);
  await expect(machTrongHop).toContainText("Màn này nằm ở đâu trong quy trình");
  // Bước làm ngay tại màn đang mở phải được gọi tên, không bắt người đọc tự dò.
  await expect(machTrongHop).toContainText("ngay tại màn này");
  await expect(machTrongHop).toContainText("Dữ liệu từ đâu");
});

test("màn ngoài luồng tiền thì nút ? không bịa ra một quy trình", async ({ page }) => {
  await loginAsDirector(page);
  await page.goto("/erp/trang-an/camera-ai");
  await page.getByRole("button", { name: /Trợ giúp về/ }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByTestId("context-help-mach")).toHaveCount(0);
});

/**
 * Bốn luồng thêm sau — chấm công, đề nghị nhân sự, nộp quỹ, sự cố.
 *
 * Cùng một hợp đồng với hai luồng tiền: dải đứng trước phần làm việc, gập
 * sẵn, và bước làm ngay tại màn đang mở thì nói "bạn đang đứng ở đây". Vẫn
 * chỉ đọc, không ghi hàng nào.
 */

const BON_LUONG = [
  { duong: "/erp/trang-an/cham-cong", mach: "cham-cong", soBuoc: 4, ten: "Chấm công theo phiếu việc" },
  { duong: "/erp/trang-an/su-co", mach: "su-co", soBuoc: 6, ten: "Sự cố hiện trường" },
  { duong: "/erp/de-xuat", mach: "de-nghi-nhan-su", soBuoc: 5, ten: "Đề nghị nhân sự" },
] as const;

for (const luong of BON_LUONG) {
  test(`mạch ${luong.mach} đứng đúng chỗ, gập sẵn, mở ra đủ ${luong.soBuoc} bước`, async ({
    page,
  }) => {
    await loginAsDirector(page);
    await page.goto(luong.duong);

    const dai = page.getByTestId("mach-viec");
    await expect(dai).toHaveCount(1);
    await expect(dai).toHaveAttribute("data-mach", luong.mach);
    await expect(dai).toContainText(luong.ten);
    await expect(page.getByTestId("mach-viec-buoc")).toHaveCount(0);

    const do_ = await page.evaluate(() => {
      const d = document.querySelector('[data-testid="mach-viec"]')!;
      return {
        cao: d.getBoundingClientRect().height,
        tranNgang: document.documentElement.scrollWidth > window.innerWidth + 1,
      };
    });
    expect(do_.tranNgang).toBe(false);
    expect(do_.cao).toBeLessThan(280);

    await page.getByTestId("mach-viec-toggle").click();
    await expect(page.getByTestId("mach-viec-buoc")).toHaveCount(luong.soBuoc);
    await expect(page.getByTestId("mach-viec-buoc").first()).toContainText("Dữ liệu từ đâu");
    await expect(page.getByTestId("mach-viec-nhanh").first()).toBeVisible();
    // Mọi bước của ba mạch này đều làm ngay tại màn đang mở.
    await expect(page.getByTestId("mach-viec-dang-o-day").first()).toBeVisible();
  });
}

test("trang Tài chính mang đủ ba mạch tiền, ở bản gọn, không đẩy việc đi quá xa", async ({
  page,
}) => {
  await loginAsDirector(page);
  await page.goto("/erp/finance");

  const dai = page.getByTestId("mach-viec");
  await expect(dai).toHaveCount(3);
  await expect(dai.nth(0)).toHaveAttribute("data-mach", "dong-ca");
  await expect(dai.nth(1)).toHaveAttribute("data-mach", "cong-no-doi-tac");
  await expect(dai.nth(2)).toHaveAttribute("data-mach", "nop-quy");
  for (let i = 0; i < 3; i += 1) {
    await expect(dai.nth(i)).toHaveAttribute("data-gon", "1");
  }

  // Bản gọn giấu hàng số đếm khi chưa mở — đó chính là chỗ tiết kiệm được.
  await expect(page.getByTestId("mach-viec-chip")).toHaveCount(0);
  // Dòng "đang chờ bạn" thì KHÔNG được giấu: nó là lý do dải có mặt ở đây.
  await expect(page.getByTestId("mach-viec-cho-minh")).toHaveCount(3);

  const do_ = await page.evaluate(() => {
    const ds = Array.from(document.querySelectorAll('[data-testid="mach-viec"]'));
    return {
      duoiCung: Math.max(...ds.map((d) => d.getBoundingClientRect().bottom + window.scrollY)),
      tranNgang: document.documentElement.scrollWidth > window.innerWidth + 1,
    };
  });
  expect(do_.tranNgang).toBe(false);
  // Đo thật ở khổ 390px sau khi chuyển sang bản gọn: 611px. Bản đầy đủ là
  // 889px — gần một màn hình rưỡi cuộn trước khi chạm phần kế toán.
  expect(do_.duoiCung).toBeLessThan(700);

  // Mở một dải ra thì hàng số đếm quay lại đầy đủ.
  await dai.nth(2).getByTestId("mach-viec-toggle").click();
  await expect(page.getByTestId("mach-viec-buoc")).toHaveCount(3);
  await expect(page.getByTestId("mach-viec-chip").first()).toBeVisible();
});

test("nút ? ở màn Chấm công và màn Sự cố cũng nói được khúc quy trình", async ({ page }) => {
  await loginAsDirector(page);
  for (const duong of ["/erp/trang-an/cham-cong", "/erp/trang-an/su-co"]) {
    await page.goto(duong);
    await page.getByRole("button", { name: /Trợ giúp về/ }).click();
    const mach = page.getByTestId("context-help-mach");
    await expect(mach).toHaveCount(1);
    await expect(mach).toContainText("ngay tại màn này");
    await page.getByRole("button", { name: "Đã hiểu" }).click();
  }
});
