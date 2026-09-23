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
// Máy chủ gửi về MÃ LỖI; câu chữ là của trang. Cùng một mã
// `CUSTOMER_LOOKUP_INPUT_INVALID` mà máy chủ có lúc kèm "Bạn nhập giúp em mã
// đặt chỗ…", có lúc kèm "Hãy nhập một email hoặc số điện thoại Việt Nam hợp
// lệ." — hai giọng khác hẳn nhau cho cùng một chuyện. Trang tự viết một câu và
// giữ nguyên câu ấy.
const INVALID_INPUT_PAGE_MESSAGE =
  "Em chưa đọc được mã đặt chỗ hoặc liên hệ bạn vừa nhập ạ. Mời bạn nhập lại mã bắt đầu bằng NBJ, cùng số điện thoại hoặc email đã dùng lúc đặt.";
const SERVER_INVALID_INPUT_MESSAGE =
  "Mời bạn nhập email hoặc số điện thoại Việt Nam.";

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

// Chữ kỹ thuật không phải lúc nào cũng là tiếng Anh. Đo ngày 10/09/2026, khách
// gõ một mã đúng khuôn rồi bấm "Mở vé của tôi" thì nhận đúng hai câu viết cho
// người trực máy chủ: "Kho liên hệ chưa có khóa mã hóa và khóa băm hợp lệ." và
// "Chỉ nhận yêu cầu tra cứu first-party từ cùng origin." Mẫu trên không bắt
// được chữ nào trong hai câu ấy, nên cần thêm mẫu này.
//
// Danh sách giữ hẹp, chỉ gồm chữ của hạ tầng: tên kho dữ liệu, tên khoá, và
// hai từ khoá HTTP. Không đưa vào những chữ mà một câu tiếng Việt tử tế vẫn
// dùng được, để bài kiểm không đỏ oan rồi bị người sau gỡ đi.
const INTERNAL_JARGON_PATTERN =
  /first-party|\borigin\b|khóa băm|khoá băm|Kho liên hệ|Kho đặt chỗ|Kho định danh|payload|endpoint/i;

const CONFIG_FAILURE_SERVER_MESSAGE =
  "Kho liên hệ chưa có khóa mã hóa và khóa băm hợp lệ.";
const ORIGIN_REJECTED_SERVER_MESSAGE =
  "Chỉ nhận yêu cầu tra cứu first-party từ cùng origin.";
const HOTLINE = "0229 387 6930";

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

  /*
   * Trang này từng không có lấy một liên kết nào trên cả trang — không logo,
   * không nav, không đường về. Khách vào đây mà không nhớ ra mã đặt chỗ thì
   * hết đường, chỉ còn nút back của trình duyệt. Trớ trêu là nhánh "chưa mở
   * đặt chỗ" ngay bên cạnh vẫn luôn có lối ra, còn nhánh chính thì không.
   */
  test("trang có đường quay lại, không phải ngõ cụt", async ({ page }) => {
    await page.goto(PAGE_PATH);

    const home = page.getByRole("link", { name: /Về trang chủ/ });
    await expect(home).toBeVisible();
    await expect(home).toHaveAttribute("href", "/");

    const packages = page.getByRole("link", { name: /Xem các gói hành trình/ });
    await expect(packages).toBeVisible();
    await expect(packages).toHaveAttribute("href", "/packages");

    await home.click();
    await expect(page).toHaveURL(/\/$/);
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
    //
    // Thân phản hồi mang đúng câu máy chủ THẬT SỰ gửi cho đường liên hệ gõ sai
    // khuôn — câu ra lệnh "Hãy nhập…", lạc hẳn giọng của cả sản phẩm. Trang
    // phải thay bằng câu của mình, nên bài này soát cả hai chiều.
    await page.route(LOOKUP_API_ROUTE, async (route) => {
      await route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({
          accepted: false,
          error: { code: "CUSTOMER_LOOKUP_INPUT_INVALID", message: SERVER_INVALID_INPUT_MESSAGE },
        }),
      });
    });

    await page.goto(PAGE_PATH);
    await page.getByLabel(ORDER_CODE_LABEL).fill("NBJ-AAAAAAAAAAAA");
    await page.getByLabel(CONTACT_LABEL).fill(" ");
    await page.getByRole("button", { name: SUBMIT_BUTTON }).click();

    const status = page.getByRole("status");
    await expect(status).toHaveText(INVALID_INPUT_PAGE_MESSAGE);
    await expect(status).not.toHaveText(TECHNICAL_LEAK_PATTERN);
    await expect(status).not.toContainText(SERVER_INVALID_INPUT_MESSAGE);
  });

  /*
   * Hai bài dưới đây khoá đúng chỗ vừa sập ngày 10/09/2026.
   *
   * Trang trước đây in nguyên văn câu máy chủ gửi về. Mở trang bằng
   * `127.0.0.1` rồi bấm "Mở vé của tôi", khách nhận: "Chỉ nhận yêu cầu tra cứu
   * first-party từ cùng origin." Còn khi kho liên hệ thiếu khoá thì khách
   * nhận: "Kho liên hệ chưa có khóa mã hóa và khóa băm hợp lệ."
   *
   * Người mất vé đang đứng ở cổng đọc hai câu ấy thì không biết làm gì tiếp,
   * mà trang cũng chẳng chỉ cho họ một đường nào. Nên bài này đòi hai thứ:
   * chữ của hạ tầng KHÔNG được ra tới đây, và câu thay thế phải có số điện
   * thoại để khách còn gọi được.
   */
  test("kho dữ liệu trục trặc thì khách đọc được câu tử tế kèm số gọi, không phải chữ hạ tầng", async ({
    page,
  }) => {
    await page.route(LOOKUP_API_ROUTE, async (route) => {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          accepted: false,
          error: {
            code: "CUSTOMER_LOOKUP_CONFIGURATION_MISSING",
            message: CONFIG_FAILURE_SERVER_MESSAGE,
          },
        }),
      });
    });

    await page.goto(PAGE_PATH);
    await page.getByLabel(ORDER_CODE_LABEL).fill("NBJ-AAAAAAAAAAAA");
    await page.getByLabel(CONTACT_LABEL).fill("0912345678");
    await page.getByRole("button", { name: SUBMIT_BUTTON }).click();

    const status = page.getByRole("status");
    await expect(status).toBeVisible();
    await expect(status).not.toContainText(CONFIG_FAILURE_SERVER_MESSAGE);
    await expect(status).not.toHaveText(INTERNAL_JARGON_PATTERN);
    await expect(status).not.toHaveText(TECHNICAL_LEAK_PATTERN);
    // Không có số gọi thì đây là ngõ cụt: trang tra cứu là đường lấy lại vé
    // duy nhất, và nó vừa báo hỏng.
    await expect(status).toContainText(HOTLINE);
    await expect(page.getByTestId("ticket-lookup-result")).toHaveCount(0);
  });

  test("yêu cầu bị chặn ở cổng vào cũng không đọc ra chữ máy móc", async ({
    page,
  }) => {
    await page.route(LOOKUP_API_ROUTE, async (route) => {
      await route.fulfill({
        status: 403,
        contentType: "application/json",
        body: JSON.stringify({
          accepted: false,
          error: {
            code: "CUSTOMER_LOOKUP_ORIGIN_REJECTED",
            message: ORIGIN_REJECTED_SERVER_MESSAGE,
          },
        }),
      });
    });

    await page.goto(PAGE_PATH);
    await page.getByLabel(ORDER_CODE_LABEL).fill("NBJ-AAAAAAAAAAAA");
    await page.getByLabel(CONTACT_LABEL).fill("0912345678");
    await page.getByRole("button", { name: SUBMIT_BUTTON }).click();

    const status = page.getByRole("status");
    await expect(status).toBeVisible();
    await expect(status).not.toContainText(ORIGIN_REJECTED_SERVER_MESSAGE);
    await expect(status).not.toHaveText(INTERNAL_JARGON_PATTERN);
    await expect(status).toContainText(HOTLINE);
  });

  /*
   * Ba bài trên chỉ đo lúc trang từ chối. Nhưng cả trang này tồn tại vì đúng
   * một việc: trả tấm vé về tay khách. Việc ấy trước nay chưa bài nào đo.
   */
  test("tra ra đơn thì vé, mã QR và khoản còn phải trả hiện đủ", async ({
    page,
  }) => {
    await page.route(LOOKUP_API_ROUTE, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          accepted: true,
          found: true,
          throttled: false,
          order: {
            code: "NBJ-ABCDEF123456",
            product_id: "40000000-0000-4000-8000-000000000001",
            visit_date: "2026-10-12",
            party_size: 3,
            adults: 2,
            children: 1,
            total_vnd: 1_780_000,
            currency: "VND",
          },
          payment: { mode: "pay-on-site", status: "pending", amount_due_vnd: 1_780_000 },
          tickets: [{
            ticketId: "90000000-0000-4000-8000-000000000001",
            ticketCode: "WEB-ABCDEF123456",
            siteId: "10000000-0000-4000-8000-000000000001",
            validOn: "2026-10-12",
            entriesAllowed: 2,
            entriesUsed: 0,
            guestGroup: "adult",
            status: "issued",
          }],
        }),
      });
    });

    await page.goto(PAGE_PATH);
    await page.getByLabel(ORDER_CODE_LABEL).fill("NBJ-ABCDEF123456");
    await page.getByLabel(CONTACT_LABEL).fill("0912345678");
    await page.getByRole("button", { name: SUBMIT_BUTTON }).click();

    const result = page.getByTestId("ticket-lookup-result");
    await expect(result).toBeVisible();
    await expect(result).toContainText("NBJ-ABCDEF123456");
    await expect(result).toContainText("WEB-ABCDEF123456");
    await expect(result).toContainText("1.780.000 VND");
    // Trả tại điểm thì khách phải đọc được là mình còn nợ tiền, chứ không chỉ
    // thấy một tấm vé rồi tưởng xong.
    await expect(result).toContainText("Còn trả tại điểm");
    // Mã QR là thứ nhân viên cổng quét. Ảnh trống thì tấm vé vô dụng.
    await expect(
      result.getByRole("img", { name: /Mã QR để quét ở cổng, mã vé WEB-ABCDEF123456/ }),
    ).toBeVisible();
    await expect(result).not.toHaveText(INTERNAL_JARGON_PATTERN);
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
