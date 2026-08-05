import { expect, test, type Page } from "@playwright/test";

/**
 * T10b — round-trip THẬT trên production: tự dựng một ca chốt riêng (đánh
 * dấu QA), chạy đủ cả chuỗi ca chốt -> ghi sổ doanh thu ca -> nộp quỹ ->
 * khớp sao kê -> ghi sổ nộp quỹ, rồi gọi RPC hoàn tác (đã mở đường ở
 * accounting-actions.ts, xem HANDOFF.md) cho CẢ HAI bút toán vừa tạo ra --
 * đưa sổ kế toán về đúng net-zero thật, không chỉ xoá dữ liệu test.
 *
 * Chỉ chạy trên MỘT project: cả chuỗi dùng chung một tài khoản nhân viên để
 * chấm công + gửi chốt ca (nv.trangan) -- chạy song song hai project sẽ làm
 * hai lượt tranh nhau "lượt chấm công gần nhất" của cùng một người.
 *
 * KHÔNG suy đoán trạng thái: mỗi bước đọc đúng nguyên văn thông báo thành
 * công của chính action đó trước khi bước tiếp -- đúng nguyên tắc AGENTS.md
 * "không giả định trạng thái mình không tự tạo ra".
 */

const SITE_ID = "trang-an";
const TRANG_AN_COORDS = { latitude: 20.25245, longitude: 105.91755 };
const MARKER = `QA-T10B-RT-${Date.now()}`;

const EMPLOYEE = { username: "nv.trangan", password: "Nhanvien@2026" };
const MANAGER = { username: "ql.vanhanh", password: "Quanly@2026" };
const ACCOUNTANT = { username: "ketoan", password: "Ketoan@2026" };
const CHIEF_ACCOUNTANT = { username: "ketoantruong", password: "Ketoantruong@2026" };

async function login(page: Page, username: string, password: string) {
  await page.goto("/erp/login");
  await page.getByLabel("Tên đăng nhập").fill(username);
  await page.getByLabel("Mật khẩu").fill(password);
  await page.getByRole("button", { name: "Mở hệ thống quản lý" }).click();
  await expect(page).toHaveURL(/\/erp$/);
}

test("T10b round-trip thật: chốt ca -> ghi sổ -> nộp quỹ -> khớp -> ghi sổ -> hoàn tác cả hai bút toán", async ({
  browser,
}, testInfo) => {
  // Chỉ chạy một lần trên một project: cả chuỗi dùng chung một tài khoản
  // nhân viên để chấm công + gửi chốt ca (nv.trangan) -- chạy song song hai
  // project sẽ làm hai lượt tranh nhau "lượt chấm công gần nhất" của cùng
  // một người.
  test.skip(
    testInfo.project.name !== "desktop-chromium",
    "chỉ chạy một lần trên một project -- xem lý do ở trên",
  );
  // 7 bước, mỗi bước tự đăng nhập một vai trò riêng -- vượt xa mặc định 30s
  // của playwright.config.ts (mặc định đó nhắm vào spec một trang, một vai
  // trò).
  test.setTimeout(240_000);

  let shiftCode = "";
  let shiftJournalCode = "";
  let depositCode = "";

  // --- 1. Nhân viên: chấm vào ca (GPS giả lập đúng toạ độ Tràng An) rồi gửi
  // chốt vé và tiền thu. Giữ nguyên số mặc định của form (79.400.000 doanh
  // thu = 32.000.000 tiền mặt + 47.400.000 thẻ/QR, chênh lệch = 0) để đi
  // thẳng luồng sạch, không rơi vào nhánh ngoại lệ.
  await test.step("Nhân viên chấm ca và gửi chốt vé", async () => {
    const context = await browser.newContext({
      geolocation: TRANG_AN_COORDS,
      permissions: ["geolocation"],
    });
    const page = await context.newPage();
    await login(page, EMPLOYEE.username, EMPLOYEE.password);

    await page.goto(`/erp/${SITE_ID}/cham-cong`);
    const attendanceButton = page.getByRole("button", { name: /Xác nhận (vào|ra) ca bằng GPS/ });
    await expect(attendanceButton).toBeVisible();
    if (/ra ca/.test((await attendanceButton.textContent()) ?? "")) {
      // Đang trong ca từ trước (lượt chấm công cũ) -- ra ca trước để chấm
      // vào ca mới sạch, đúng ca sẽ dùng cho lượt chốt vé này.
      await attendanceButton.click();
      await expect(page.getByText("Chưa vào ca")).toBeVisible();
    }
    await page.getByRole("button", { name: "Xác nhận vào ca bằng GPS" }).click();
    await expect(page.getByText("Đang trong ca")).toBeVisible();

    await page.goto(`/erp/${SITE_ID}/ve-dat-cho`);
    await page.getByLabel("Nội dung bàn giao").fill(`${MARKER} — bàn giao ca test round-trip T10b, tự dọn bằng hoàn tác.`);
    await page.getByRole("button", { name: "Gửi quản lý xác nhận" }).click();

    const status = page.getByRole("status").filter({ hasText: "đã gửi quản lý xác nhận" });
    await expect(status).toBeVisible();
    const message = (await status.textContent()) ?? "";
    const match = message.match(/(SHIFT-[A-Z0-9-]+)/);
    expect(match, `không đọc được mã ca từ thông báo: ${message}`).not.toBeNull();
    shiftCode = match![1];

    await context.close();
  });

  // --- 2. Quản lý: duyệt ca vừa gửi.
  await test.step("Quản lý duyệt ca", async () => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await login(page, MANAGER.username, MANAGER.password);
    await page.goto(`/erp/${SITE_ID}/ve-dat-cho`);

    const details = page.locator("details").filter({ hasText: shiftCode });
    await expect(details).toHaveCount(1);
    await details.locator("summary").click();
    await details.getByRole("button", { name: "Xác nhận & chuyển kế toán" }).click();
    // "Chờ kế toán" xuất hiện cả ở nhãn trạng thái lẫn dòng nhật ký hồ sơ
    // bên dưới -- .first() vì chỉ cần xác nhận có ít nhất một, không quan
    // tâm đúng phần tử nào.
    await expect(details.getByText("Chờ kế toán").first()).toBeVisible();

    await context.close();
  });

  // --- 3. Kế toán: lập bút toán doanh thu ca (Nợ 1111+1121 / Có 5111...),
  // gửi kế toán trưởng kiểm tra.
  await test.step("Kế toán lập bút toán doanh thu ca", async () => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await login(page, ACCOUNTANT.username, ACCOUNTANT.password);
    await page.goto("/erp/finance");

    const article = page.locator("article").filter({ hasText: shiftCode });
    await expect(article).toHaveCount(1);
    await article.getByLabel("Ghi chú kiểm tra nguồn").fill(`${MARKER} — đã đối chiếu, lập bút toán test round-trip.`);
    await article.getByRole("button", { name: "Lập bút toán và gửi kiểm tra" }).click();

    // Mã bút toán suy ra trực tiếp từ mã ca: RPC dựng "JV-" + business_code
    // (xem migration 202607290006, dòng v_journal_code). KHÔNG đọc từ thông
    // báo thành công -- <article> chứa PrepareJournalForm biến mất ngay sau
    // khi thành công (ca không còn "đủ điều kiện lập bút toán" nữa nên rớt
    // khỏi eligibleSources), làm ActionMessage biến mất theo trước khi kịp
    // đọc. Xác nhận thành công thật ở đúng bước 4, khi tìm được thẻ bút
    // toán này trên trang của kế toán trưởng.
    shiftJournalCode = `JV-${shiftCode}`;

    await context.close();
  });

  // --- 4. Kế toán trưởng: duyệt và ghi sổ bút toán doanh thu ca -- ca chốt
  // chuyển "posted", đủ điều kiện gộp vào một lượt nộp quỹ.
  await test.step("Kế toán trưởng ghi sổ bút toán doanh thu ca", async () => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await login(page, CHIEF_ACCOUNTANT.username, CHIEF_ACCOUNTANT.password);
    await page.goto("/erp/finance");

    const card = page.locator("details").filter({ hasText: shiftJournalCode });
    await expect(card).toHaveCount(1);
    await expect(card).toBeVisible();
    await card.getByLabel("Kết luận kiểm tra").fill(`${MARKER} — đã kiểm tra định khoản, duyệt ghi sổ.`);
    await card.getByRole("button", { name: "Duyệt và ghi sổ" }).click();
    await expect(card.getByText("Đã ghi sổ").first()).toBeVisible();

    await context.close();
  });

  // --- 5. Kế toán: gộp đúng ca đó vào một lượt nộp quỹ, nhập tay dòng sao
  // kê ngân hàng cùng số tiền mặt của ca (khớp đúng số), đối khớp.
  await test.step("Kế toán nộp quỹ và đối khớp sao kê", async () => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await login(page, ACCOUNTANT.username, ACCOUNTANT.password);
    await page.goto("/erp/finance");

    const submitDetails = page.locator("details", { hasText: "Gộp ca đã chốt thành một lượt nộp quỹ" });
    await submitDetails.locator("summary").click();
    const shiftRow = submitDetails.locator("label").filter({ hasText: shiftCode });
    await expect(shiftRow, `ca ${shiftCode} chưa xuất hiện trong danh sách đủ điều kiện nộp quỹ`).toHaveCount(1);
    await shiftRow.locator('input[type="checkbox"]').check();
    await submitDetails.getByLabel("Số tài khoản ngân hàng nhận tiền").fill(MARKER);
    await submitDetails.getByLabel("Ghi chú", { exact: true }).fill(`${MARKER} — nộp quỹ test round-trip T10b.`);
    await submitDetails.getByRole("button", { name: "Ghi nhận đã nộp quỹ" }).click();

    const submitStatus = submitDetails.getByRole("status").filter({ hasText: "đã ghi nhận, chờ đối khớp" });
    await expect(submitStatus).toBeVisible();
    const submitMessage = (await submitStatus.textContent()) ?? "";
    const depositMatch = submitMessage.match(/(DEP-[A-Z0-9-]+)/);
    expect(depositMatch, `không đọc được mã lượt nộp từ thông báo: ${submitMessage}`).not.toBeNull();
    depositCode = depositMatch![1];

    const statementDetails = page.locator("details", { hasText: "Nhập tay một dòng sao kê" });
    await statementDetails.locator("summary").click();
    await statementDetails.getByLabel("Số tài khoản ngân hàng", { exact: true }).fill(MARKER);
    await statementDetails
      .getByLabel("Ngày sao kê")
      .fill(new Date().toISOString().slice(0, 10));
    await statementDetails.getByLabel("Số tiền").fill("32000000");
    await statementDetails.getByLabel("Nội dung sao kê").fill(`${MARKER} — sao kê test round-trip T10b.`);
    await statementDetails.getByRole("button", { name: "Ghi nhận dòng sao kê" }).click();
    await expect(
      statementDetails.getByRole("status").filter({ hasText: "Đã ghi nhận dòng sao kê" }),
    ).toBeVisible();

    const depositCard = page.locator("li").filter({ hasText: depositCode });
    await expect(depositCard).toHaveCount(1);
    await depositCard.locator('select[name="statementLineCandidate"]').selectOption({ index: 1 });
    await depositCard.getByRole("button", { name: "Đối khớp" }).click();
    await expect(depositCard.getByText("Chờ kế toán trưởng ghi sổ").first()).toBeVisible();

    await context.close();
  });

  // --- 6. Kế toán trưởng: duyệt và ghi sổ bút toán nộp quỹ (Nợ 1121/Có
  // 1111) -- lượt nộp chuyển "posted".
  await test.step("Kế toán trưởng ghi sổ bút toán nộp quỹ", async () => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await login(page, CHIEF_ACCOUNTANT.username, CHIEF_ACCOUNTANT.password);
    await page.goto("/erp/finance");

    const depositCard = page.locator("li").filter({ hasText: depositCode });
    await expect(depositCard).toHaveCount(1);
    await depositCard.getByLabel("Ghi chú kiểm tra").fill(`${MARKER} — đã đối chiếu sao kê, duyệt ghi sổ nộp quỹ.`);
    await depositCard.getByRole("button", { name: "Duyệt, ghi sổ" }).click();
    // "Đã ghi sổ" xuất hiện cả ở nhãn trạng thái lẫn dòng "Đã ghi sổ ... bởi
    // ..." bên dưới -- .first() cho lý do tương tự bước duyệt ca.
    await expect(depositCard.getByText("Đã ghi sổ").first()).toBeVisible();

    await context.close();
  });

  // --- 7. Kế toán trưởng: hoàn tác CẢ HAI bút toán vừa tạo (doanh thu ca +
  // nộp quỹ) -- đưa sổ về net-zero thật. Bút toán nộp quỹ tìm bằng tổng
  // phát sinh đúng 32.000.000 (khác hẳn 79.400.000 của bút toán doanh thu
  // ca) vì giao diện không in mã nguồn cash-deposit ra thành chữ.
  await test.step("Hoàn tác cả hai bút toán, đưa sổ về net-zero", async () => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await login(page, CHIEF_ACCOUNTANT.username, CHIEF_ACCOUNTANT.password);
    await page.goto("/erp/finance");

    // Journal "posted" KHÔNG defaultOpen (chỉ journal "pending-checker" tự
    // mở) -- phải bấm summary trước khi điền form ẩn bên trong.
    const depositJournalCard = page.locator("details").filter({ hasText: "32.000.000" });
    await expect(
      depositJournalCard,
      "không định vị được đúng một bút toán nộp quỹ 32.000.000 để hoàn tác",
    ).toHaveCount(1);
    await depositJournalCard.locator("summary").click();
    await depositJournalCard
      .getByLabel("Lý do đảo bút toán")
      .fill(`${MARKER} — hoàn tác bút toán nộp quỹ test round-trip, đưa sổ về net-zero.`);
    await depositJournalCard.getByRole("button", { name: "Tạo bút toán đảo" }).click();
    await expect(depositJournalCard.getByText("Đã có bút toán đảo").first()).toBeVisible();

    const shiftJournalCard = page.locator("details").filter({ hasText: shiftJournalCode });
    await expect(shiftJournalCard).toHaveCount(1);
    await shiftJournalCard.locator("summary").click();
    await shiftJournalCard
      .getByLabel("Lý do đảo bút toán")
      .fill(`${MARKER} — hoàn tác bút toán doanh thu ca test round-trip, đưa sổ về net-zero.`);
    await shiftJournalCard.getByRole("button", { name: "Tạo bút toán đảo" }).click();
    await expect(shiftJournalCard.getByText("Đã có bút toán đảo").first()).toBeVisible();

    await context.close();
  });
});
