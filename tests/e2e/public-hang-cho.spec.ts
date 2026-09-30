import { expect, test, type Page } from "@playwright/test";

/**
 * Hàng chờ ảo bến đò Tam Cốc, phía khách. Kho hàng chờ chỉ có trên production
 * (migration 097), nên ở đây giả lời của `/api/hang-cho` trong trình duyệt:
 * bài kiểm giao diện và luồng lấy số → chờ → tới lượt → huỷ. Không ghi gì.
 */

const TONG_QUAN = {
  dangNhan: true,
  loiTamDung: null,
  khachMoiPhutKhai: 5,
  phutGiuLuot: 10,
  soNhomCho: 3,
  soKhachCho: 9,
  dangGoi: [1],
  goiToiSo: 1,
  soCap: 4,
  khachLen30Phut: 0,
  daLenHomNay: 0,
  nhomDaLen: 0,
  nhomBoLuot: 0,
  nhomHuy: 0,
  phutChoTrungBinh: null,
};

async function giaKho(page: Page) {
  const trangThai = { luot: "cho" as "cho" | "da-goi", daHuy: false, yeuCau: [] as string[] };
  await page.route("**/api/hang-cho**", async (route) => {
    const req = route.request();
    if (req.method() === "GET") {
      // Đúng dạng API thật trả (camelCase, máy chủ đã đọc kho xong). Bản đầu
      // của bài này giả dạng snake_case của kho, nên lọt một lỗi: trang khách
      // đọc sai dạng và báo "bến tạm dừng" trên production.
      return route.fulfill({ json: { ok: true, tong_quan: TONG_QUAN } });
    }
    const body = req.postDataJSON() as { hanh_dong: string; so_khach?: number };
    trangThai.yeuCau.push(body.hanh_dong);
    if (body.hanh_dong === "lay-so") {
      expect(body.so_khach).toBe(3);
      return route.fulfill({ json: { ok: true, bi_mat: "b".repeat(32), so_thu_tu: 4, da_co: false } });
    }
    if (body.hanh_dong === "huy") {
      trangThai.daHuy = true;
      return route.fulfill({ json: { ok: true, da_huy: true } });
    }
    return route.fulfill({
      json: {
        ok: true,
        luot: {
          soThuTu: 4,
          soKhach: 3,
          trangThai: trangThai.luot,
          taoLuc: "2026-09-30T08:00:00Z",
          goiLuc: trangThai.luot === "da-goi" ? "2026-09-30T08:20:00Z" : null,
          nhomTruoc: trangThai.luot === "cho" ? 3 : 0,
          khachTruoc: trangThai.luot === "cho" ? 9 : 0,
          tongQuan: TONG_QUAN,
        },
      },
    });
  });
  return trangThai;
}

test("lấy số, thấy còn mấy nhóm phía trước, tới lượt thì trang đổi hẳn, huỷ được", async ({ page }) => {
  const kho = await giaKho(page);
  await page.goto("/xep-hang/tam-coc?lang=vi");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Lấy số trên điện thoại");
  await expect(page.getByTestId("hang-cho-tinh-hinh")).toContainText("A001");

  await page.getByRole("radio", { name: "3" }).click();
  await page.getByRole("button", { name: "Lấy số" }).click();
  const luot = page.getByTestId("luot-cua-toi");
  await expect(luot).toHaveAttribute("data-trang-thai", "cho");
  await expect(luot).toContainText("A004");
  await expect(luot).toContainText("Còn 3 nhóm trước bạn");
  await expect(luot).toContainText("Chờ khoảng 5 phút");

  // Mở lại trang vẫn thấy đúng số của mình.
  await page.reload();
  await expect(page.getByTestId("luot-cua-toi")).toContainText("A004");

  kho.luot = "da-goi";
  await page.getByRole("button", { name: "Làm mới" }).click();
  await expect(luot).toHaveAttribute("data-trang-thai", "da-goi");
  await expect(luot).toContainText("Tới lượt bạn!");
  await expect(page).toHaveTitle(/Tới lượt A004/);

  await luot.getByRole("button", { name: "Huỷ lượt" }).click();
  await luot.getByRole("button", { name: "Đồng ý huỷ" }).click();
  await expect(page.getByRole("button", { name: "Lấy số" })).toBeVisible();
  expect(kho.daHuy).toBe(true);
});

test("bản tiếng Anh, và trang Tam Cốc có lối vào hàng chờ", async ({ page }) => {
  await giaKho(page);
  await page.goto("/xep-hang/tam-coc?lang=en");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Take a number on your phone");
  await expect(page.getByRole("button", { name: "Take a number" })).toBeVisible();

  await page.goto("/destination/tam-coc-bich-dong?lang=vi");
  await page.getByTestId("loi-vao-hang-cho").click();
  await expect(page).toHaveURL(/\/xep-hang\/tam-coc/);
});

test("kho chưa mở hàng chờ thì nói thẳng, không hiện nút lấy số", async ({ page }) => {
  await page.route("**/api/hang-cho**", (route) => route.fulfill({ status: 503, json: { ok: false, ma: "CHUA_NOI_KHO" } }));
  await page.goto("/xep-hang/tam-coc?lang=vi");
  await expect(page.getByText("Hàng chờ ảo chưa mở ở bến này.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Lấy số" })).toHaveCount(0);
});
