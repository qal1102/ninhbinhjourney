import { expect, test } from "@playwright/test";

/**
 * A15-TRUNG-THU-01 (phần còn lại). Sau khi Bàn Trăng hết bán (27/09/2026
 * 23:59 giờ VN, `lib/seasonal/mid-autumn-season.ts`), cổng trang chủ, hộp
 * trợ lý hành trình và `/seasonal/mid-autumn` phải tự đổi sang trạng thái
 * "mùa đã khép" mà KHÔNG cần build hay deploy lại — cờ tính bằng đồng hồ
 * thật của trình duyệt lúc trang dựng xong (client check, xem
 * `lib/seasonal/use-mid-autumn-season.ts`).
 *
 * Ép đồng hồ trình duyệt bằng `page.clock.setFixedTime()` để đo được cả hai
 * trạng thái ngay hôm nay, không phải chờ tới 28/09/2026 thật. Giá trị ép
 * là một `Date` tuyệt đối (epoch), nên không phụ thuộc múi giờ của máy chạy
 * Playwright.
 */
const IN_SEASON_INSTANT = new Date("2026-09-27T23:59:30+07:00");
const CLOSED_INSTANT = new Date("2026-09-28T00:00:30+07:00");

async function prepareReadOnly(page: import("@playwright/test").Page) {
  await page.addInitScript(() => {
    try {
      window.sessionStorage.setItem("nbj-intro-played", "1");
      window.localStorage.setItem(
        "nbj-customer-analytics-consent",
        JSON.stringify({
          product_analytics: "denied",
          marketing_communications: "denied",
          policy_version: "xuan-truong-analytics-draft-v1",
        }),
      );
    } catch {
      // Chế độ riêng tư chặn storage -- không sao, trang vẫn dựng được.
    }
  });
}

test.describe("A15-TRUNG-THU-01: cờ mùa Trung thu tính theo đồng hồ thật", () => {
  test("trước 27/09 23:59 giờ VN: cổng trang chủ và trang mùa giữ nguyên, chưa đổi gì", async ({ page }) => {
    await prepareReadOnly(page);
    await page.clock.setFixedTime(IN_SEASON_INSTANT);

    await page.goto("/?lang=vi&presentation=1", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("opening-intro")).toHaveCount(0, { timeout: 12000 });
    await expect(
      page.getByRole("link", { name: "Sự kiện theo mùa · Trung thu" }).first(),
    ).toHaveAttribute("href", "/seasonal/mid-autumn?lang=vi");
    await expect(page.getByText("Sự kiện theo mùa · Mùa đã khép")).toHaveCount(0);

    await page.goto("/seasonal/mid-autumn?lang=en", { waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-mid-autumn-season-closed]")).toHaveCount(0);

    const campaign = page.locator("#mid-autumn");
    await campaign.getByRole("button", { name: "Open details: Moon Table by the Ngo Dong" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("link", { name: "View dates and hold a table" })).toHaveAttribute(
      "href",
      "/packages/ban-trang-tam-coc-2026?lang=en&source=mid-autumn-2026",
    );
    await page.keyboard.press("Escape");
  });

  test("từ 28/09 00:00 giờ VN: cổng trang chủ nói thẳng mùa đã khép, không CTA nào dẫn tới lượt giữ chỗ hỏng", async ({
    page,
  }) => {
    await prepareReadOnly(page);
    await page.clock.setFixedTime(CLOSED_INSTANT);

    // --- Trang chủ: nhãn cổng đổi, đường dẫn tới trang mùa vẫn còn ---
    await page.goto("/?lang=vi&presentation=1", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("opening-intro")).toHaveCount(0, { timeout: 12000 });
    const closedPortal = page.getByRole("link", { name: "Sự kiện theo mùa · Mùa đã khép" }).first();
    await expect(closedPortal).toHaveAttribute("href", "/seasonal/mid-autumn?lang=vi");
    await expect(page.getByRole("link", { name: "Sự kiện theo mùa · Trung thu" })).toHaveCount(0);

    // Hộp trợ lý hành trình: world "seasonal" không còn mời như dịp sắp tới.
    const trigger = page.getByRole("button", { name: "Mở trợ lý hành trình" });
    await page.mouse.wheel(0, -60);
    await trigger.click();
    const conciergeDialog = page.getByRole("dialog", { name: "Bạn muốn xem phần nào?" });
    await expect(conciergeDialog).toBeVisible();
    const seasonalWorldLink = conciergeDialog.getByRole("link", { name: /Mùa Trăng 2026/ });
    await expect(seasonalWorldLink).toContainText("đã khép");
    await expect(seasonalWorldLink).not.toContainText("Xem hộp bánh, bàn tối và lịch sự kiện Trung thu");
    await expect(seasonalWorldLink).toHaveAttribute("href", "/seasonal/mid-autumn?lang=vi");
    await page.keyboard.press("Escape");

    // --- /seasonal/mid-autumn: mở đầu bằng thông báo mùa đã khép ---
    await page.goto("/seasonal/mid-autumn?lang=en", { waitUntil: "domcontentloaded" });
    const banner = page.locator("[data-mid-autumn-season-closed]");
    await expect(banner).toBeVisible();
    await expect(banner).toContainText("The 2026 moon season has closed");
    await expect(banner.getByRole("link", { name: "Browse open packages" })).toHaveAttribute(
      "href",
      "/packages?lang=en",
    );

    // Bàn Trăng: không còn nút dẫn tới một lượt giữ chỗ chắc chắn hỏng.
    const campaign = page.locator("#mid-autumn");
    await expect(campaign.locator('[data-seasonal-card="moon-table-ngo-dong"]')).toContainText(
      "2026 season closed",
    );
    await campaign.getByRole("button", { name: "Open details: Moon Table by the Ngo Dong" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("Moon Table closed — see you in 2027");
    await expect(dialog.getByRole("link", { name: "View dates and hold a table" })).toHaveCount(0);
    const fallbackCta = dialog.getByRole("link", { name: "Browse open packages" });
    await expect(fallbackCta).toHaveAttribute("href", "/packages?lang=en&source=mid-autumn-2026");
    await page.keyboard.press("Escape");
  });
});

/**
 * Vòng trăng (`components/discovery/moon-dial.tsx`).
 *
 * Bài đầu tiên ở đây là một bài **hồi quy**, không phải bài trang trí: chủ dự
 * án bấm đêm "khép mùa" rồi không bấm được hai đêm kia nữa. Nguyên nhân là
 * quầng sáng của mặt trăng vẽ tràn ra ngoài khung vuông (`overflow-visible`)
 * và vẫn nhận con trỏ; lời của đêm khép mùa ngắn hơn nên hàng nút trồi lên
 * đúng vào vùng quầng ấy. Đo bằng `elementFromPoint` ngay giữa từng nút, sau
 * mỗi lượt chọn — `click()` thường không bắt được lỗi này vì Playwright tự
 * cuộn và tự né.
 */
test.describe("Vòng trăng Trung thu", () => {
  test("chọn bất kỳ đêm nào thì mọi đêm còn lại vẫn bấm được", async ({ page }) => {
    await prepareReadOnly(page);
    await page.goto("/seasonal/mid-autumn?lang=vi");
    const nut = page.getByRole("radio");
    // `count()` không tự chờ. Thiếu câu này thì bài đỏ với "0 nút" ngay cả khi
    // trang dựng đủ — đã dính đúng một lần ở khổ mobile.
    await expect(nut.first()).toBeVisible();
    const soDem = await nut.count();
    expect(soDem).toBeGreaterThanOrEqual(3);

    for (let chon = 0; chon < soDem; chon += 1) {
      await nut.nth(chon).click();
      await expect(nut.nth(chon)).toHaveAttribute("aria-checked", "true");

      for (let i = 0; i < soDem; i += 1) {
        await nut.nth(i).scrollIntoViewIfNeeded();
        const o = await nut.nth(i).boundingBox();
        expect(o).not.toBeNull();
        const chuThoat = await page.evaluate(
          ({ x, y }) => {
            const tren = document.elementFromPoint(x, y);
            return tren?.closest('[role="radio"]') ? "nút" : (tren?.tagName ?? "trống");
          },
          { x: o!.x + o!.width / 2, y: o!.y + o!.height / 2 },
        );
        expect(
          chuThoat,
          `đang chọn đêm ${chon}, điểm giữa nút ${i} bị thứ khác che`,
        ).toBe("nút");
      }
    }
  });

  test("mỗi đêm một mặt trăng khác nhau, không phải ba hình giống hệt", async ({ page }) => {
    await prepareReadOnly(page);
    await page.goto("/seasonal/mid-autumn?lang=vi");
    const nut = page.getByRole("radio");
    // `count()` không tự chờ. Thiếu câu này thì bài đỏ với "0 nút" ngay cả khi
    // trang dựng đủ — đã dính đúng một lần ở khổ mobile.
    await expect(nut.first()).toBeVisible();
    const soDem = await nut.count();
    const nhan = new Set<string>();
    for (let i = 0; i < soDem; i += 1) {
      await nut.nth(i).click();
      nhan.add(((await page.locator("[data-moon-phase]").textContent()) ?? "").trim());
    }
    // Ba đêm của mùa nằm ở ba pha khác nhau; nếu nhãn trùng nhau thì hoặc phép
    // tính hỏng, hoặc hình đã quay về kiểu "hai vòng tròn giống hệt" ngày xưa.
    expect(nhan.size).toBe(soDem);
  });

  test("vòng trăng tự biết mùa đang ở giai đoạn nào", async ({ page }) => {
    await prepareReadOnly(page);
    await page.goto("/seasonal/mid-autumn?lang=vi");
    const cau = page.locator("[data-moon-season]");
    await expect(cau).toBeVisible();
    await expect(cau).toHaveAttribute(
      "data-moon-season",
      /^(truoc-mua|trong-mua|dung-ram|qua-ram|het-mua)$/,
    );

    // Quanh mùa thì có thêm đêm "tối nay", và nó phải là đêm mở sẵn — đứng
    // trước rằm ba hôm mà vòng trăng vẫn mở ở đêm rằm là đúng cái lỗi đang sửa.
    const toiNay = page.getByRole("radio", { name: /Tối nay/ });
    if (await toiNay.count()) {
      await expect(toiNay).toHaveAttribute("aria-checked", "true");
    }
  });
});

/**
 * Mặt nước dưới vòng trăng.
 *
 * Bài đáng giá ở đây không phải "có canvas không" mà là **vệt nước có đi theo
 * trăng không**. Đếm thẳng số điểm ảnh sáng trên canvas ở hai đêm khác nhau:
 * đêm rằm phải sáng hơn hẳn đêm thượng huyền. Nếu ai đó sau này vẽ một vệt
 * cố định cho "đẹp và rẻ", bài này đỏ.
 */
test.describe("Mặt nước dưới trăng", () => {
  async function doDoSang(page: import("@playwright/test").Page) {
    // Phải kéo mặt nước vào khung nhìn trước khi đo. Nó **cố ý ngừng vẽ khi
    // trôi ra ngoài** để không đốt pin của khách; ở ngoài khung thì canvas
    // giữ nguyên khung hình cũ, và đo lúc ấy là đo một tấm ảnh cũ.
    await page.locator("[data-moon-water]").scrollIntoViewIfNeeded();
    // Gợn nhấp nháy theo thời gian, nên lấy lượt sáng nhất trong vài khung
    // hình thay vì tin một khung duy nhất.
    let caoNhat = 0;
    for (let lan = 0; lan < 6; lan += 1) {
      const diem = await page.locator("[data-moon-water]").evaluate((el) => {
        const canvas = el as HTMLCanvasElement;
        const ctx = canvas.getContext("2d");
        if (!ctx || canvas.width === 0) return 0;
        const anh = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        let dem = 0;
        for (let i = 3; i < anh.length; i += 4) {
          if (anh[i] > 24) dem += 1;
        }
        return dem;
      });
      caoNhat = Math.max(caoNhat, diem);
      await page.waitForTimeout(160);
    }
    return caoNhat;
  }

  test("vệt trăng trên nước rộng và sáng lên đúng vào đêm rằm", async ({ page }) => {
    test.slow();
    await prepareReadOnly(page);
    await page.goto("/seasonal/mid-autumn?lang=vi");
    await expect(page.locator("[data-moon-water]")).toBeAttached();

    await page.getByRole("radio", { name: /18\.09/ }).click();
    await expect(page.locator("[data-moon-phase]")).toContainText("thượng huyền");
    const khuyet = await doDoSang(page);

    await page.getByRole("radio", { name: /25\.09/ }).click();
    await expect(page.locator("[data-moon-phase]")).toContainText("trăng tròn");
    const ram = await doDoSang(page);

    expect(khuyet).toBeGreaterThan(0);
    expect(ram, `đêm rằm ${ram} điểm sáng, đêm khuyết ${khuyet}`).toBeGreaterThan(khuyet * 1.3);
  });

  test("chọn giảm chuyển động thì mặt nước vẫn có, chỉ là không gợn", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await prepareReadOnly(page);
    await page.goto("/seasonal/mid-autumn?lang=vi");
    const nuoc = page.locator("[data-moon-water]");
    await expect(nuoc).toBeAttached();
    await nuoc.scrollIntoViewIfNeeded();
    // Vẽ đúng một khung rồi đứng yên: hai lượt đo cách nhau nửa giây phải ra
    // cùng một con số.
    const dem = async () =>
      nuoc.evaluate((el) => {
        const c = el as HTMLCanvasElement;
        const ctx = c.getContext("2d");
        if (!ctx || c.width === 0) return -1;
        const d = ctx.getImageData(0, 0, c.width, c.height).data;
        let n = 0;
        for (let i = 3; i < d.length; i += 4) if (d[i] > 24) n += 1;
        return n;
      });
    // Chờ khung hình tĩnh đầu tiên vẽ xong rồi mới so hai lượt đo.
    await expect.poll(dem, { timeout: 10_000 }).toBeGreaterThan(0);
    const lan1 = await dem();
    await page.waitForTimeout(600);
    expect(await dem()).toBe(lan1);
  });
});
