import { expect, test, type Page } from "@playwright/test";

import { ERP_DIRECTOR_PASSWORD } from "./support/erp-credentials";

/**
 * Sổ liên hệ nhãn hàng đối tác trên màn hình Marketing.
 *
 * ## Bài này GHI vào kho thật, nên phải tự dọn
 *
 * Chạy với `PLAYWRIGHT_BASE_URL` trỏ vào production là nó ghi thẳng vào sổ mà
 * chủ dự án đang dùng. Giao kèo của dự án: *"bài kiểm nào ghi thì phải trả hệ
 * thống về đúng như lúc nó tìm thấy"*. Vì thế mỗi bài **tự dựng lấy dòng của
 * mình** (tên có gắn mốc thời gian, không đụng dòng người khác), và **gỡ hẳn
 * dòng ấy trước khi kết thúc** — kể cả khi phần giữa bài đỏ, nhờ `finally`.
 *
 * Tên dùng trong bài cố ý là một chuỗi kiểm thử rõ ràng, **không phải tên một
 * nhãn hàng có thật** — đây là ranh giới sẵn có của dự án
 * (`tests/security/no-third-party-brands.test.ts`).
 */

function tenThu(viec: string) {
  return `Kiểm thử tự động ${viec} ${Date.now()}`;
}

async function dangNhapGiamDoc(page: Page) {
  await page.goto("/erp/login");
  await page.getByLabel("Tên đăng nhập").fill("giamdoc");
  await page.getByLabel("Mật khẩu").fill(ERP_DIRECTOR_PASSWORD);
  await page.getByRole("button", { name: "Mở hệ thống quản lý" }).click();
  await expect(page).toHaveURL(/\/erp$/);
}

/** Khối sổ, và liệu môi trường này có đọc được kho hay không. */
async function moSo(page: Page) {
  await page.goto("/erp/marketing");
  const so = page.getByTestId("so-doi-tac");
  await expect(so).toBeVisible();
  const ghiDuoc = (await so.locator("#them-doi-tac").count()) > 0;
  return { so, ghiDuoc };
}

async function them(page: Page, ten: string, giaiDoan: string, coTraoDoi: boolean) {
  const form = page.locator("#them-doi-tac");
  await form.locator('input[name="ten"]').fill(ten);
  await form.locator('select[name="giaiDoan"]').selectOption(giaiDoan);
  if (coTraoDoi) await form.locator('input[name="ghiTraoDoi"]').check();
  await form.getByRole("button", { name: /Thêm vào sổ|Lưu thay đổi/ }).click();
  await expect(page.getByText(`Đã ghi “${ten}” vào sổ`)).toBeVisible();
}

/** Gỡ hẳn dòng. Gọi trong `finally`, nên không được ném lỗi ra ngoài. */
async function go(page: Page, ten: string) {
  try {
    await page.goto("/erp/marketing");
    const dong = page.getByTestId("so-doi-tac").locator("li", { hasText: ten }).first();
    if ((await dong.count()) === 0) return;
    await dong.getByRole("button", { name: "Gỡ khỏi sổ" }).click();
    await dong.getByRole("button", { name: "Gỡ", exact: true }).click();
    await expect(page.getByText(`Đã gỡ “${ten}” khỏi sổ`)).toBeVisible();
  } catch (loi) {
    console.error("Dọn dòng kiểm thử không thành", ten, loi);
  }
}

test.describe("Marketing: sổ liên hệ nhãn hàng đối tác", () => {
  test("sổ mở ra bằng số mối đang chờ gọi lại, không phải bằng tổng số dòng", async ({
    page,
  }) => {
    test.slow();
    await dangNhapGiamDoc(page);
    const { so, ghiDuoc } = await moSo(page);
    if (!ghiDuoc) {
      // Máy cục bộ không có kho thật. Màn hình phải nói thẳng chứ không dựng
      // số minh hoạ — đó cũng là một điều đáng canh.
      await expect(so.getByText("Sổ chưa đọc được ở môi trường này")).toBeVisible();
      return;
    }

    const ten = tenThu("mối nguội");
    try {
      // Mới nhắm mà chưa trao đổi lần nào thì luôn là việc phải làm.
      await them(page, ten, "nham-truoc", false);
      const dong = so.locator("li", { hasText: ten }).first();
      await expect(dong).toHaveAttribute("data-nguoi", "co");
      await expect(dong.getByText("chưa trao đổi lần nào")).toBeVisible();

      // Tiêu đề phải đếm việc phải làm, và đếm ít nhất là một.
      const phaiLam = Number((await so.getAttribute("data-phai-lam")) ?? "0");
      expect(phaiLam).toBeGreaterThanOrEqual(1);
      await expect(
        so.getByRole("heading", { name: /mối đang chờ mình gọi lại/ }),
      ).toBeVisible();
    } finally {
      await go(page, ten);
    }
  });

  test("ghi là vừa trao đổi thì mối thôi nằm trong nhóm đang nguội", async ({ page }) => {
    test.slow();
    await dangNhapGiamDoc(page);
    const { so, ghiDuoc } = await moSo(page);
    if (!ghiDuoc) return;

    const ten = tenThu("vừa trao đổi");
    try {
      await them(page, ten, "dang-ban", true);
      const dong = so.locator("li", { hasText: ten }).first();
      await expect(dong).toHaveAttribute("data-nguoi", "khong");
      await expect(dong.getByText("trao đổi hôm nay")).toBeVisible();
    } finally {
      await go(page, ten);
    }
  });

  test("gõ lại đúng một tên đã có thì sửa dòng cũ, không đẻ dòng thứ hai", async ({
    page,
  }) => {
    test.slow();
    await dangNhapGiamDoc(page);
    const { so, ghiDuoc } = await moSo(page);
    if (!ghiDuoc) return;

    const ten = tenThu("trùng tên");
    try {
      await them(page, ten, "nham-truoc", false);
      await expect(so.locator("li", { hasText: ten })).toHaveCount(1);

      // Lần hai: cùng tên, khác giai đoạn. Sổ có hai dòng cùng tên là sổ vô dụng.
      await page.goto("/erp/marketing");
      await them(page, ten, "da-chot", false);
      await expect(so.locator("li", { hasText: ten })).toHaveCount(1);
      await expect(so.locator("li", { hasText: ten }).getByText("Đã chốt")).toBeVisible();
    } finally {
      await go(page, ten);
    }
  });

  test("sổ gắn được vào lịch mùa vụ ngay phía trên", async ({ page }) => {
    test.slow();
    await dangNhapGiamDoc(page);
    const { so, ghiDuoc } = await moSo(page);
    if (!ghiDuoc) return;

    // Danh sách dịp trong ô chọn phải là chính các dịp đang hiện ở lịch mùa vụ
    // — hai nơi nói hai danh sách khác nhau là mầm của một nguồn sự thật thứ hai.
    const oDip = so.locator('#them-doi-tac select[name="dipNhamToi"] option');
    const dip = await oDip.evaluateAll((els) =>
      els.map((e) => (e as HTMLOptionElement).value).filter(Boolean),
    );
    const dipTrongLich = await page
      .getByTestId("lich-mua-vu")
      .locator("[data-dip]")
      .evaluateAll((els) => els.map((e) => e.getAttribute("data-dip") ?? ""));
    expect([...dip].sort()).toEqual([...dipTrongLich].sort());
  });

  test("màn hình không in tên bảng dữ liệu hay mã nội bộ ra cho người dùng đọc", async ({
    page,
  }) => {
    test.slow();
    await dangNhapGiamDoc(page);
    await moSo(page);
    const chu = (await page.locator("main").innerText()).toLowerCase();
    for (const ma of ["erp_doi_tac_nhan_hang", "nham-truoc", "dang-ban", "khep-lai"]) {
      expect(chu, `còn chữ máy "${ma}" trên màn hình`).not.toContain(ma);
    }
  });
});
