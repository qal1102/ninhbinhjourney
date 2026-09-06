import { expect, test } from "@playwright/test";

// TC-23 — /tra-cuu-ve is the ONLY way a guest can get their ticket back: the
// system cannot yet send a confirmation SMS/Zalo/email. This spec never
// walks the booking flow to mint a real order (that is out of scope and
// would leave residue); it only proves the lookup page itself behaves —
// renders, tells the truth about not sending messages, answers politely on
// bad input, and never pins a phone-only keyboard on a field that must also
// accept an email address.

const PAGE_PATH = "/tra-cuu-ve";
const PAGE_TITLE = /Tra cứu vé/;
const HEADING = "Mở lại vé đã đặt";
const ORDER_CODE_LABEL = "Mã đặt chỗ";
const CONTACT_LABEL = "Số điện thoại hoặc email đã dùng lúc đặt";
const SUBMIT_BUTTON = "Mở vé của tôi";
const NO_MESSAGING_DISCLOSURE = "Hệ thống chưa gửi tin nhắn hay email xác nhận";
const LOOKUP_API_ROUTE = "**/api/customer-ticket-lookup";

const MALFORMED_CODE_MESSAGE =
  "Mã đặt chỗ có dạng NBJ- rồi mười hai ký tự, bạn xem lại giúp em ạ.";
const NOT_FOUND_MESSAGE =
  "Em chưa tìm ra chuyến nào khớp mã đặt chỗ và liên hệ này ạ. Bạn xem lại giúp em mã đã ghi và số điện thoại hoặc email đã dùng lúc đặt.";
const GENERIC_INVALID_INPUT_MESSAGE =
  "Bạn nhập giúp em mã đặt chỗ cùng số điện thoại hoặc email đã dùng lúc đặt ạ.";

// Lỗi kỹ thuật lọt ra mắt khách đọc như một vết stack trace hay một từ khoá
// HTTP/JavaScript trần, chứ không phải thứ tiếng Việt lễ tân mà cả sản phẩm
// đang nói.
//
// Danh sách này cố ý CHỈ gồm những chữ không bao giờ xuất hiện trong một câu
// tiếng Việt tử tế. Bản đầu có thêm `nan` và `50\d` — hai thứ ấy khớp luôn
// "gian nan" và "500.000", nên tới ngày câu trả lời nhắc tới số tiền là bài
// kiểm đỏ oan, và người sau sẽ gỡ chính bài kiểm này thay vì sửa lỗi thật.
// `NaN` vẫn canh được, nhưng canh đúng dạng viết hoa của nó.
// Không dùng cờ `i` cho cả cụm, vì `NaN` phải canh đúng dạng viết hoa của nó;
// mấy chữ còn lại tự viết cả hai lối hoa/thường.
const TECHNICAL_LEAK_PATTERN =
  /[Ee]rror|[Ee]xception|undefined|null|\[object|[Ss]tack trace|NaN/;

test.describe("TC-23 tra cứu vé — đường lấy lại vé duy nhất", () => {
  test("trang mở được, tiêu đề và ô nhập hiện đúng", async ({ page }) => {
    await page.goto(PAGE_PATH);

    await expect(page).toHaveTitle(PAGE_TITLE);
    await expect(page.getByRole("heading", { name: HEADING })).toBeVisible();
    await expect(page.getByLabel(ORDER_CODE_LABEL)).toBeVisible();
    await expect(page.getByLabel(CONTACT_LABEL)).toBeVisible();
    await expect(page.getByRole("button", { name: SUBMIT_BUTTON })).toBeVisible();
  });

  test("nói thẳng hệ thống chưa gửi được tin nhắn hay email xác nhận", async ({
    page,
  }) => {
    await page.goto(PAGE_PATH);

    // This is a promise to the guest, not decoration: lose the line and the
    // page starts implying a confirmation might be on its way somewhere.
    await expect(page.getByText(NO_MESSAGING_DISCLOSURE)).toBeVisible();
  });

  test("ô liên hệ không bị ghim bàn phím điện thoại, vẫn gõ được email", async ({
    page,
  }) => {
    await page.goto(PAGE_PATH);

    const contactInput = page.getByLabel(CONTACT_LABEL);
    // A pinned inputmode="tel" keyboard on a phone cannot type "@" — this
    // field must take both a phone number and an email address.
    await expect(contactInput).not.toHaveAttribute("inputmode");

    await contactInput.fill("ban@vidu.com");
    await expect(contactInput).toHaveValue("ban@vidu.com");
  });

  test("mã gõ sai khuôn dạng trả lời tử tế, không lộ lỗi kỹ thuật", async ({
    page,
  }) => {
    // Mocked at the network boundary, same as the rest of this suite: the
    // real server-side validation contract (which codes normalize, which
    // don't) already has its own coverage in tests/unit and tests/security.
    // This spec only proves the PAGE renders whatever the API contract says
    // to render, without a live Supabase project behind it.
    await page.route(LOOKUP_API_ROUTE, async (route) => {
      await route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({
          accepted: false,
          error: { code: "CUSTOMER_LOOKUP_CODE_MALFORMED", message: MALFORMED_CODE_MESSAGE },
        }),
      });
    });

    await page.goto(PAGE_PATH);
    await page.getByLabel(ORDER_CODE_LABEL).fill("ABCD1234");
    await page.getByLabel(CONTACT_LABEL).fill("0912345678");
    await page.getByRole("button", { name: SUBMIT_BUTTON }).click();

    const status = page.getByRole("status");
    await expect(status).toHaveText(MALFORMED_CODE_MESSAGE);
    await expect(status).not.toHaveText(TECHNICAL_LEAK_PATTERN);
    await expect(page.getByTestId("ticket-lookup-result")).toHaveCount(0);
  });

  test("liên hệ bỏ trống trả lời tử tế, không lộ lỗi kỹ thuật", async ({
    page,
  }) => {
    // A single space passes the `required` attribute but trims to empty
    // before the page sends it on, so this exercises the "left blank" path
    // through the page's own submit handler and message rendering.
    await page.route(LOOKUP_API_ROUTE, async (route) => {
      await route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({
          accepted: false,
          error: { code: "CUSTOMER_LOOKUP_INPUT_INVALID", message: GENERIC_INVALID_INPUT_MESSAGE },
        }),
      });
    });

    await page.goto(PAGE_PATH);
    await page.getByLabel(ORDER_CODE_LABEL).fill("NBJ-AAAAAAAAAAAA");
    await page.getByLabel(CONTACT_LABEL).fill(" ");
    await page.getByRole("button", { name: SUBMIT_BUTTON }).click();

    const status = page.getByRole("status");
    await expect(status).toHaveText(GENERIC_INVALID_INPUT_MESSAGE);
    await expect(status).not.toHaveText(TECHNICAL_LEAK_PATTERN);
  });

  test("mã đúng khuôn nhưng không khớp đơn nào trả lời tử tế", async ({
    page,
  }) => {
    // Mocked at the network boundary: a well-formed code that matches no
    // order would otherwise have to reach a real Supabase project, which
    // this spec must not depend on when run locally. This proves only the
    // page's own rendering of the "not found" response, not the repository.
    await page.route(LOOKUP_API_ROUTE, async (route) => {
      await route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({
          accepted: true,
          found: false,
          throttled: false,
          message: NOT_FOUND_MESSAGE,
        }),
      });
    });

    await page.goto(PAGE_PATH);
    await page.getByLabel(ORDER_CODE_LABEL).fill("NBJ-AAAAAAAAAAAA");
    await page.getByLabel(CONTACT_LABEL).fill("0912345678");
    await page.getByRole("button", { name: SUBMIT_BUTTON }).click();

    const status = page.getByRole("status");
    await expect(status).toHaveText(NOT_FOUND_MESSAGE);
    await expect(status).not.toHaveText(TECHNICAL_LEAK_PATTERN);
    await expect(page.getByTestId("ticket-lookup-result")).toHaveCount(0);
  });
});
