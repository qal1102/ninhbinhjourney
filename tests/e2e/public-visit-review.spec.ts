import { expect, test, type Page } from "@playwright/test";

/**
 * TC-12 — khách kể một câu về nơi mình đã vào, ngay trên tấm hộ chiếu.
 *
 * Bài chặn mọi lời gọi API lại và tự trả lời, nên không ghi một dòng nào vào
 * cơ sở dữ liệu thật. Thứ được kiểm ở đây là hành vi trang: chấm sao là gửi
 * luôn, gửi đúng nơi nào, và khi máy chủ từ chối vì chưa có dấu chân thì
 * khách đọc được lời từ chối chứ không phải một ô lặng thinh.
 */

const MA = "TV-ABCDEFGHJK";
const TRANG_AN = "10000000-0000-4000-8000-000000000001";
const BAI_DINH = "10000000-0000-4000-8000-000000000003";

const HANH_TRINH = {
  accepted: true,
  journey: {
    memberCode: MA,
    guestGroup: "adult",
    displayName: "Đỗ Thị Lan",
    visitDate: "2026-09-19",
    entries: [
      { siteId: TRANG_AN, scannedAt: "2026-09-19T01:20:00.000Z" },
      { siteId: BAI_DINH, scannedAt: "2026-09-19T04:05:00.000Z" },
    ],
  },
};

type LoiDaGui = { member_code: string; site_id: string; rating: number; comment: string };

async function dungTrang(
  page: Page,
  options: {
    loiCu?: Array<{ siteId: string; rating: number; comment: string; updatedAt: string }>;
    tuChoi?: boolean;
  } = {},
) {
  const daGui: LoiDaGui[] = [];
  await page.route("**/api/customer-group-members**", async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(HANH_TRINH) });
  });
  await page.route("**/api/customer-visit-reviews**", async (route) => {
    const request = route.request();
    if (request.method() === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ accepted: true, reviews: options.loiCu ?? [] }),
      });
    }
    const body = request.postDataJSON() as LoiDaGui;
    daGui.push(body);
    if (options.tuChoi) {
      return route.fulfill({
        status: 403,
        contentType: "application/json",
        body: JSON.stringify({
          accepted: false,
          error: { code: "VISIT_REVIEW_KHONG_CO_DAU_CHAN", message: "Nơi này chưa ghi nhận lượt vào bằng mã của bạn." },
        }),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        accepted: true,
        review: { siteId: body.site_id, rating: body.rating, comment: body.comment, updatedAt: "2026-09-19T05:00:00Z" },
      }),
    });
  });
  await page.goto(`/doan/${MA}?lang=vi`, { waitUntil: "domcontentloaded" });
  await page.getByTestId("visit-review-row").first().waitFor({ timeout: 20000 });
  return daGui;
}

test.describe("TC-12: đánh giá có dấu chân", () => {
  test("chỉ nơi đã tới mới có ô chấm sao", async ({ page }) => {
    await dungTrang(page);
    const hang = page.getByTestId("visit-review-row");
    // Lượt chạy đầu trên một máy chủ vừa dựng có thể chậm hơn mức mặc định.
    await expect(hang).toHaveCount(2, { timeout: 15000 });
    await expect(hang.nth(0)).toHaveAttribute("data-site-id", TRANG_AN);
    await expect(hang.nth(1)).toHaveAttribute("data-site-id", BAI_DINH);
  });

  test("chấm sao là gửi luôn, gửi đúng nơi vừa chấm", async ({ page }) => {
    const daGui = await dungTrang(page);
    await page.getByTestId("visit-review-row").nth(1).getByTestId("visit-review-star-4").click();
    await expect(
      page.getByTestId("visit-review-row").nth(1).getByTestId("visit-review-status"),
    ).toHaveText("Cảm ơn bạn đã kể lại ạ.");
    expect(daGui).toHaveLength(1);
    expect(daGui[0]).toMatchObject({ member_code: MA, site_id: BAI_DINH, rating: 4 });
  });

  test("lời đã kể lần trước hiện lại khi mở lại trang", async ({ page }) => {
    await dungTrang(page, {
      loiCu: [{ siteId: TRANG_AN, rating: 5, comment: "Đi sớm thì thuyền vắng.", updatedAt: "2026-09-19T05:00:00Z" }],
    });
    const hangDau = page.getByTestId("visit-review-row").nth(0);
    await expect(hangDau.getByTestId("visit-review-star-5")).toHaveAttribute("aria-pressed", "true");
    await expect(hangDau.getByRole("textbox")).toHaveValue("Đi sớm thì thuyền vắng.");
  });

  test("máy chủ từ chối vì chưa có dấu chân thì khách đọc được lời từ chối", async ({ page }) => {
    await dungTrang(page, { tuChoi: true });
    const hangDau = page.getByTestId("visit-review-row").nth(0);
    await hangDau.getByTestId("visit-review-star-3").click();
    await expect(hangDau.getByTestId("visit-review-status")).toContainText("chưa gửi đi được");
  });

  test("không dùng chữ của cái cổng trên bề mặt khách", async ({ page }) => {
    await dungTrang(page);
    const chu = (await page.getByTestId("trip-passport").innerText()).toLowerCase();
    for (const cam of ["soát vé", "quét mã", "điểm chạm", "check-in"]) {
      expect(chu).not.toContain(cam);
    }
  });

  test("vừa khổ 390px, không tràn ngang", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await dungTrang(page);
    const tran = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(tran).toBe(false);
    const nut = page.getByTestId("visit-review-star-1").first();
    const o = await nut.boundingBox();
    expect(o?.width ?? 0).toBeGreaterThanOrEqual(44);
    expect(o?.height ?? 0).toBeGreaterThanOrEqual(44);
  });
});
