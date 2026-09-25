import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const MOCK_SLOT_STARTS_AT = new Date(Date.now() + 24 * 60 * 60_000).toISOString();

test.describe("CUS-06 anonymous ERP-backed booking", () => {
  // TC-03: giữ lại nguyên văn thân yêu cầu giữ chỗ để soát TRONG thân bài kiểm,
  // không soát trong hàm chặn route. Một `expect` hỏng bên trong route handler
  // có thể bị nuốt mất và bài vẫn xanh — đúng kiểu im lặng mà TC-02b đã dạy.
  let holdRequestBody: Record<string, unknown> = {};

  test.beforeEach(async ({ page }) => {
    holdRequestBody = {};
    await page.route("**/api/customer-booking-slots**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          accepted: true,
          slots: [{
            startsAt: MOCK_SLOT_STARTS_AT,
            endsAt: new Date(Date.now() + 25 * 60 * 60_000).toISOString(),
            siteIds: [
              "10000000-0000-4000-8000-000000000001",
              "10000000-0000-4000-8000-000000000002",
            ],
            remaining: 12,
            capacitySourceKind: "estimate",
            bookable: true,
            blockedReason: null,
          }],
        }),
      });
    });
    await page.route("**/api/customer-booking-holds", async (route) => {
      const request = route.request();
      const body = request.postDataJSON() as Record<string, unknown>;
      holdRequestBody = body;
      expect(body.anonymous_id).toMatch(/^[0-9a-f-]{36}$/);
      expect(body.slot_starts_at).toBe(MOCK_SLOT_STARTS_AT);
      expect(body).not.toHaveProperty("email");
      expect(body).not.toHaveProperty("phone");
      expect(body).not.toHaveProperty("card_number");
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          accepted: true,
          duplicate: false,
          order: { id: "50000000-0000-4000-8000-000000000001", code: "NBJ-ABCDEF123456" },
          hold: { id: "60000000-0000-4000-8000-000000000001", status: "active", expires_at: new Date(Date.now() + 15 * 60_000).toISOString() },
          amount: { total_vnd: 1_780_000, currency: "VND" },
          slots: [{
            slotId: "70000000-0000-4000-8000-000000000001",
            siteId: "10000000-0000-4000-8000-000000000001",
            startsAt: MOCK_SLOT_STARTS_AT,
            endsAt: new Date(Date.now() + 25 * 60 * 60_000).toISOString(),
            capacitySource: "estimate",
            thresholdVersion: 1,
          }],
        }),
      });
    });
    await page.route("**/api/customer-booking-confirmations", async (route) => {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      // Lối này nay chỉ còn trả tại điểm, và luôn kèm liên hệ. Khoá chặt
      // bằng toEqual để một trường lọt ra là bài kiểm đỏ ngay.
      expect(body).toEqual({
        payment_request_id: expect.stringMatching(/^[0-9a-f-]{36}$/),
        hold_id: "60000000-0000-4000-8000-000000000001",
        payment_mode: "pay-on-site",
        contact: "0912345678",
      });
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          accepted: true,
          duplicate: false,
          order: { id: "50000000-0000-4000-8000-000000000001", code: "NBJ-ABCDEF123456", status: "confirmed" },
          payment: { id: "80000000-0000-4000-8000-000000000001", status: "succeeded", mode: "simulation" },
          // TC-03: đúng hình dạng máy chủ trả về sau khi tách nhóm tuổi — một
          // chặng phát hai tấm vé. Mock thiếu `guestGroup` thì màn hình vẫn
          // xanh trong khi khách thật nhìn thấy một dòng trống.
          tickets: [{
            ticketId: "90000000-0000-4000-8000-000000000001",
            ticketCode: "WEB-ABCDEF123456",
            siteId: "10000000-0000-4000-8000-000000000001",
            validOn: "2026-08-21",
            entriesAllowed: 2,
            guestGroup: "adult",
            status: "issued",
          }, {
            ticketId: "90000000-0000-4000-8000-000000000002",
            ticketCode: "WEB-ABCDEF654321",
            siteId: "10000000-0000-4000-8000-000000000001",
            validOn: "2026-08-21",
            entriesAllowed: 1,
            guestGroup: "child",
            status: "issued",
          }],
        }),
      });
    });
  });

  test("giữ chỗ 15 phút, quét mã QR thanh toán, vé hiện ra kèm nút lưu ảnh", async ({ page }) => {
    // Máy chủ mở mã QR cho lượt giữ, rồi trả lời "chưa trả" một lần trước
    // khi báo "đã trả" — giống khách đang cầm điện thoại quét.
    let qrBody: Record<string, unknown> = {};
    let lanHoi = 0;
    await page.route("**/api/customer-booking-qr-payments**", async (route) => {
      const request = route.request();
      if (request.method() === "POST") {
        qrBody = request.postDataJSON() as Record<string, unknown>;
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({
            accepted: true,
            pay_url: "http://localhost/thanh-toan/phieu-thu",
            expires_at: new Date(Date.now() + 15 * 60_000).toISOString(),
          }),
        });
        return;
      }
      lanHoi += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(lanHoi < 2 ? { accepted: true, paid: false } : {
          accepted: true,
          paid: true,
          order: { id: "50000000-0000-4000-8000-000000000001", code: "NBJ-ABCDEF123456", status: "confirmed" },
          payment: { id: "80000000-0000-4000-8000-000000000001", status: "succeeded", mode: "qr-transfer", amount_due_vnd: 0 },
          tickets: [{
            ticketId: "90000000-0000-4000-8000-000000000001",
            ticketCode: "WEB-ABCDEF123456",
            siteId: "10000000-0000-4000-8000-000000000001",
            validOn: "2026-08-21",
            entriesAllowed: 2,
            guestGroup: "adult",
            status: "issued",
          }, {
            ticketId: "90000000-0000-4000-8000-000000000002",
            ticketCode: "WEB-ABCDEF654321",
            siteId: "10000000-0000-4000-8000-000000000001",
            validOn: "2026-08-21",
            entriesAllowed: 1,
            guestGroup: "child",
            status: "issued",
          }],
        }),
      });
    });

    await page.goto("/checkout?package=heritage-day");
    await expect(page.getByRole("heading", { name: /Một chỗ đã giữ/i })).toBeVisible();
    await expect(page.getByText(/Giữ chỗ 15 phút, quét mã QR là xong/i)).toBeVisible();
    // Lời hứa không đổi và là lời hứa quan trọng nhất trên trang này: không
    // bao giờ hỏi số thẻ hay tài khoản ngân hàng. Ô liên hệ thì có, và cố ý
    // có — nó là đường lấy lại vé duy nhất khi hệ thống chưa gửi được tin.
    await expect(page.getByLabel(/số thẻ|thẻ tín dụng|tài khoản ngân hàng|cvv/i)).toHaveCount(0);

    // TC-02: ba bước ngày → giờ → số khách — nút giữ chỗ chỉ mở khi đã chọn giờ.
    const slotButton = page.getByRole("button", { name: /Khung .*còn (khoảng )?12 chỗ/i });
    await expect(slotButton).toBeVisible();
    await expect(page.getByRole("button", { name: "Giữ chỗ 15 phút" })).toBeDisabled();
    await slotButton.click();
    await expect(slotButton).toHaveAttribute("aria-pressed", "true");

    // TC-03: một em bé dưới 1m3 đi cùng hai khách có vé.
    await page.getByLabel("Số trẻ cao dưới 1m3").fill("1");

    await page.getByRole("button", { name: "Giữ chỗ 15 phút" }).click();
    // Chuỗi này từng là "Ước tính vận hành T11a" — số hiệu phiếu việc nội
    // bộ đứng ngay trước mắt khách. Xem bài chống lọt chữ nội bộ ở cuối tệp.
    await expect(page.getByText("Số chỗ ước tính")).toBeVisible();
    // Máy chủ phải nhận đủ ba con số, và tổng phải khớp — thiếu một cái là vé
    // phát ra sai loại mà không có gì báo.
    expect(holdRequestBody.party_size).toBe(3);
    expect(holdRequestBody.adults).toBe(2);
    expect(holdRequestBody.children).toBe(1);
    await expect(page.getByText(/Chỗ của bạn đã được giữ/i)).toBeVisible();

    // QR là lối mặc định. Chưa để lại số thì chưa có mã: luật "giữ rồi bỏ
    // ba lần thì đặt tại quầy" đếm theo số điện thoại.
    await expect(page.getByRole("radio", { name: /Quét mã QR/ })).toBeChecked();
    await page.getByRole("button", { name: "Lấy mã QR thanh toán" }).click();
    await expect(page.getByText(/số điện thoại hoặc email trước đã/i)).toBeVisible();
    await page.getByLabel("Số điện thoại hoặc email").fill("0912345678");
    await page.getByRole("button", { name: "Lấy mã QR thanh toán" }).click();

    const khungQr = page.getByTestId("qr-thanh-toan");
    await expect(khungQr.getByRole("img", { name: /Mã QR thanh toán/ })).toBeVisible();
    await expect(khungQr).toContainText("1.780.000 đ");
    expect(qrBody).toEqual({
      hold_id: "60000000-0000-4000-8000-000000000001",
      payment_request_id: expect.stringMatching(/^[0-9a-f-]{36}$/),
      contact: "0912345678",
      amount_vnd: 1_780_000,
      product_id: expect.any(String),
    });

    // Khách quét xong: màn hình tự chuyển sang vé, không phải bấm gì.
    await expect(page.getByTestId("customer-booking-confirmed")).toContainText("Đã thanh toán bằng QR");
    await expect(page.getByTestId("customer-booking-confirmed")).toContainText("NBJ-ABCDEF123456");
    await expect(page.getByRole("button", { name: "Lưu ảnh vé về máy" })).toBeVisible();
    await expect(page.getByTestId("customer-booking-confirmed")).toContainText("WEB-ABCDEF123456");
    await expect(page.getByTestId("customer-booking-confirmed")).toContainText("2 lượt vào");
    // TC-03: khách phải đọc được mình cầm vé của những ai.
    await expect(page.getByTestId("customer-booking-confirmed"))
      .toContainText("2 vé · 1 trẻ dưới 1m3 (không mất vé)");
  });

  test("trả tại điểm vẫn là lối phụ chạy được, và ảnh vé tải về đúng tên", async ({ page }) => {
    await page.goto("/checkout?package=heritage-day");
    await page.getByRole("button", { name: /Khung .*còn (khoảng )?12 chỗ/i }).click();
    await page.getByRole("button", { name: "Giữ chỗ 15 phút" }).click();
    await page.getByRole("radio", { name: /Trả tại điểm/ }).check();
    await page.getByLabel("Số điện thoại hoặc email").fill("0912345678");
    await page.getByRole("button", { name: "Giữ chỗ, trả tiền tại điểm" }).click();
    await expect(page.getByTestId("customer-booking-confirmed")).toContainText("NBJ-ABCDEF123456");

    const [taiVe] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Lưu ảnh vé về máy" }).click(),
    ]);
    expect(taiVe.suggestedFilename()).toBe("ve-NBJ-ABCDEF123456.png");
  });

  test("mã QR hỏng mở ra một câu dễ hiểu, không phải trang lỗi", async ({ page }) => {
    await page.goto("/thanh-toan/khong-phai-phieu-that");
    await expect(page.getByRole("heading", { name: "Mã QR chưa dùng được" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Xem các gói tham quan" })).toBeVisible();
  });

  test("TC-02: a full or paused slot cannot be picked, and says why", async ({ page }) => {
    const secondSlotStartsAt = new Date(Date.now() + 26 * 60 * 60_000).toISOString();
    await page.route("**/api/customer-booking-slots**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          accepted: true,
          slots: [
            {
              startsAt: MOCK_SLOT_STARTS_AT,
              endsAt: new Date(Date.now() + 25 * 60 * 60_000).toISOString(),
              siteIds: ["10000000-0000-4000-8000-000000000001"],
              remaining: 0,
              capacitySourceKind: "estimate",
              bookable: false,
              blockedReason: "full",
            },
            {
              startsAt: secondSlotStartsAt,
              endsAt: new Date(Date.now() + 27 * 60 * 60_000).toISOString(),
              siteIds: ["10000000-0000-4000-8000-000000000001"],
              remaining: 8,
              capacitySourceKind: "estimate",
              bookable: false,
              blockedReason: "paused",
            },
          ],
        }),
      });
    });

    await page.goto("/checkout?package=heritage-day");

    const fullSlot = page.getByRole("button", { name: /Khung .*đã hết chỗ/i });
    const pausedSlot = page.getByRole("button", { name: /Khung .*đang tạm dừng nhận khách/i });
    await expect(fullSlot).toBeVisible();
    await expect(fullSlot).toBeDisabled();
    await expect(fullSlot).toContainText("Đã hết chỗ");
    await expect(pausedSlot).toBeVisible();
    await expect(pausedSlot).toBeDisabled();
    await expect(pausedSlot).toContainText("Đang tạm dừng nhận khách");

    // Không có khung nào chọn được thì nút giữ chỗ vẫn phải khoá.
    await expect(page.getByRole("button", { name: "Giữ chỗ 15 phút" })).toBeDisabled();
  });

  /*
   * Màn hình chọn cách trả tiền là chỗ khách quyết định xuống tiền, và nó
   * dựng bằng chữ xám trên nền kem — đúng kiểu dễ tụt tương phản mà mắt người
   * viết không nhận ra. Bài này chỉ soi ĐÚNG bước ấy (sau khi đã giữ chỗ),
   * chứ không soi cả trang, vì khối chọn cách trả tiền chỉ hiện ở bước này.
   *
   * Chỉ chặn `serious` và `critical` — cùng ngưỡng đã dùng ở
   * public-surfaces.spec.ts, để bài không đỏ vì những cảnh báo vụn.
   */
  test("màn hình chọn cách trả tiền đọc được, không có lỗi tương phản nghiêm trọng", async ({
    page,
  }) => {
    await page.goto("/checkout?package=heritage-day");
    await page.getByRole("button", { name: /Khung .*còn (khoảng )?12 chỗ/i }).click();
    await page.getByRole("button", { name: "Giữ chỗ 15 phút" }).click();
    await expect(page.getByRole("radio", { name: /Quét mã QR/ })).toBeVisible();

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    const nghiemTrong = results.violations.filter(
      (violation) => violation.impact === "critical" || violation.impact === "serious",
    );
    expect(
      nghiemTrong.map((violation) => `${violation.id}: ${violation.help}`),
      "màn hình chọn cách trả tiền có lỗi trợ năng nghiêm trọng",
    ).toEqual([]);
  });

  /*
   * "Gói A" là tên một giai đoạn thi công, "lõi ERP"/"công suất ERP" là tên
   * hệ thống nội bộ, "T11a" là số hiệu một phiếu việc. Cả bốn đã từng nằm
   * ngay dòng đầu của trang thanh toán và trang danh mục.
   *
   * `UI_UX_RULES.md` cấm chữ kỹ thuật nội bộ lọt ra mặt khách, và ghi lại hai
   * lần đã sập vì đúng lỗi này. Bài này canh cả ba trang thương mại cùng lúc,
   * vì chữ ấy trước nay cứ mọc lại ở trang nào tiện tay nhất.
   */
  test("ba trang thương mại không để lọt chữ kỹ thuật nội bộ ra mặt khách", async ({ page }) => {
    const internalJargon = /\bERP\b|\bT11a\b|\bT8\b|Gói A ·|lõi ERP|công suất ERP/;

    for (const path of ["/packages", "/packages/heritage-day", "/checkout?package=heritage-day"]) {
      // `load` không dùng được cho trang chi tiết gói: ảnh và trình phát nạp
      // sẵn khiến sự kiện ấy có khi mãi không tới. Cùng lý do đã ghi ở vòng
      // lặp axe trong public-surfaces.spec.ts.
      await page.goto(path, { waitUntil: "domcontentloaded" });

      // Chờ khung chờ RỜI KHỎI trang trước khi đọc chữ.
      //
      // `app/loading.tsx` cũng dựng một thẻ <main> (mang `aria-busy`). Với
      // `domcontentloaded` có một nhịp cả hai cùng nằm trong trang, và khi ấy
      // `getByRole("main")` khớp trúng KHUNG CHỜ — câu khẳng định xanh một
      // cách vô nghĩa — còn `locator("main")` thì gãy vì khớp hai phần tử.
      // Đọc chữ của khung chờ thì bài kiểm này chẳng canh được gì.
      await expect(page.locator("main[aria-busy='true']")).toHaveCount(0);
      const noiDungThat = page.getByRole("main");
      await expect(noiDungThat).toBeVisible();
      const visibleText = await noiDungThat.innerText();
      expect(visibleText, `${path} để lọt chữ nội bộ ra mặt khách`).not.toMatch(internalJargon);
    }

    // Và cả sau khi đã giữ chỗ — khối "các điểm đã khoá" chỉ hiện ở bước đó,
    // và nó chính là chỗ "T11a" từng đứng — nay phải đọc là "Số chỗ ước tính".
    await page.getByRole("button", { name: /Khung .*còn (khoảng )?12 chỗ/i }).click();
    await page.getByRole("button", { name: "Giữ chỗ 15 phút" }).click();
    await expect(page.getByText("Số chỗ ước tính")).toBeVisible();
  });
});
