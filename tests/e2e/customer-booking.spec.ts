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
      // TC-22: mac dinh van la loi tra tien mo phong, va man hinh KHONG
      // duoc gui kem lien he o loi nay — thu mot du lieu ca nhan khong dung
      // toi la mot khoan no. Khoa chat bang toEqual de mot truong lo ra la
      // bai kiem do ngay.
      expect(body).toEqual({
        payment_request_id: expect.stringMatching(/^[0-9a-f-]{36}$/),
        hold_id: "60000000-0000-4000-8000-000000000001",
        payment_mode: "simulation",
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

  test("holds shared capacity then confirms a simulated payment into a T8 ticket", async ({ page }) => {
    await page.goto("/checkout?package=heritage-day");
    await expect(page.getByRole("heading", { name: /Một chỗ đã giữ/i })).toBeVisible();
    await expect(page.getByText(/Thanh toán mô phỏng — không thu tiền/i)).toBeVisible();
    await expect(page.getByLabel(/email|điện thoại|số thẻ/i)).toHaveCount(0);

    // TC-02: ba bước ngày → giờ → số khách — nút giữ chỗ chỉ mở khi đã chọn giờ.
    const slotButton = page.getByRole("button", { name: /Khung .*còn 12 chỗ/i });
    await expect(slotButton).toBeVisible();
    await expect(page.getByRole("button", { name: "Giữ chỗ 15 phút" })).toBeDisabled();
    await slotButton.click();
    await expect(slotButton).toHaveAttribute("aria-pressed", "true");

    // TC-03: một em bé dưới 1m3 đi cùng hai khách có vé.
    await page.getByLabel("Số trẻ cao dưới 1m3").fill("1");

    await page.getByRole("button", { name: "Giữ chỗ 15 phút" }).click();
    await expect(page.getByText("Ước tính vận hành T11a")).toBeVisible();
    // Máy chủ phải nhận đủ ba con số, và tổng phải khớp — thiếu một cái là vé
    // phát ra sai loại mà không có gì báo.
    expect(holdRequestBody.party_size).toBe(3);
    expect(holdRequestBody.adults).toBe(2);
    expect(holdRequestBody.children).toBe(1);
    await expect(page.getByText(/Đã giữ chỗ thật trong kho công suất/i)).toBeVisible();

    await page.getByRole("button", { name: "Xác nhận thanh toán mô phỏng" }).click();
    await expect(page.getByTestId("customer-booking-confirmed")).toContainText("NBJ-ABCDEF123456");
    await expect(page.getByTestId("customer-booking-confirmed")).toContainText("WEB-ABCDEF123456");
    await expect(page.getByTestId("customer-booking-confirmed")).toContainText("2 lượt vào");
    // TC-03: khách phải đọc được mình cầm vé của những ai.
    await expect(page.getByTestId("customer-booking-confirmed"))
      .toContainText("2 vé · 1 trẻ dưới 1m3 (không mất vé)");
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
});
