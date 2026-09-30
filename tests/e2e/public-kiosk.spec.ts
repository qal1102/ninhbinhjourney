import { expect, test } from "@playwright/test";

/**
 * Kiosk tự phục vụ tại điểm. Lời của `/api/hang-cho` được giả trong trình
 * duyệt (kho hàng chờ chỉ có trên production); không ghi gì.
 */

const BI_MAT = "k".repeat(32);

test("kiosk Tam Cốc: đặt vé bằng QR, lấy số đò rồi chuyển lượt sang điện thoại", async ({ page }) => {
  await page.route("**/api/hang-cho**", (route) =>
    route.fulfill({ json: { ok: true, bi_mat: BI_MAT, so_thu_tu: 12, da_co: false } }),
  );
  await page.goto("/kiosk/tam-coc?lang=vi");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Xin chào");

  await page.getByRole("button", { name: /Đặt vé/ }).click();
  await expect(page.getByTestId("kiosk")).toHaveAttribute("data-man", "dat-ve");
  await expect(page.getByRole("img", { name: "Quét để đặt" }).first()).toBeVisible();
  await page.getByRole("button", { name: "← Về màn đầu" }).click();

  await page.getByRole("button", { name: /Lấy số đò/ }).click();
  await page.getByRole("radio", { name: "3" }).click();
  await page.getByRole("button", { name: "Lấy số", exact: true }).click();
  await expect(page.getByTestId("kiosk-so-do")).toContainText("A012");
  await expect(page.getByRole("img", { name: "Quét để theo dõi lượt" })).toBeVisible();

  // Kiosk không giữ chuỗi bí mật của khách.
  expect(await page.evaluate(() => JSON.stringify(window.localStorage))).not.toContain(BI_MAT);

  await page.getByRole("button", { name: "English" }).click();
  await expect(page.getByText("Your number")).toBeVisible();
});

test("kiosk bỏ trống một phút thì về màn đầu và về tiếng Việt", async ({ page }) => {
  await page.clock.install();
  await page.goto("/kiosk/trang-an");
  await page.getByRole("button", { name: "English" }).click();
  await page.getByRole("button", { name: /Fees, getting around/ }).click();
  await expect(page.getByTestId("kiosk")).toHaveAttribute("data-man", "thong-tin");
  await page.clock.fastForward(61_000);
  await expect(page.getByTestId("kiosk")).toHaveAttribute("data-man", "dau");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Xin chào");
  // Tràng An không có bến đò xếp số.
  await expect(page.getByRole("button", { name: /Lấy số đò/ })).toHaveCount(0);
});

test("điện thoại quét mã của kiosk thì nhận đúng lượt, chuỗi bí mật rời khỏi đường dẫn", async ({ page }) => {
  await page.route("**/api/hang-cho**", async (route) => {
    const body = route.request().postDataJSON() as { hanh_dong?: string; bi_mat?: string } | null;
    if (route.request().method() === "POST" && body?.hanh_dong === "xem" && body.bi_mat === BI_MAT) {
      return route.fulfill({
        json: {
          ok: true,
          luot: {
            soThuTu: 12, soKhach: 3, trangThai: "cho", taoLuc: "2026-09-30T08:00:00Z", goiLuc: null, nhomTruoc: 2, khachTruoc: 5,
            tongQuan: {
              dangNhan: true, loiTamDung: null, khachMoiPhutKhai: 5, phutGiuLuot: 10, soNhomCho: 3, soKhachCho: 8, dangGoi: [], goiToiSo: 9,
              soCap: 12, khachLen30Phut: 0, daLenHomNay: 0, nhomDaLen: 0, nhomBoLuot: 0, nhomHuy: 0, phutChoTrungBinh: null,
            },
          },
        },
      });
    }
    return route.fulfill({ status: 404, json: { ok: false, ma: "KHONG_THAY" } });
  });
  await page.goto(`/xep-hang/tam-coc?luot=${BI_MAT}&lang=vi`);
  await expect(page.getByTestId("luot-cua-toi")).toContainText("A012");
  expect(page.url()).not.toContain(BI_MAT);
});

test("không có kiosk ở nơi không bán vé tại đây", async ({ page }) => {
  // Có `app/loading.tsx` nên Next đã gửi mã 200 trước khi `notFound()` chạy;
  // kiểm nội dung trang thay vì mã trạng thái.
  await page.goto("/kiosk/hoa-lu");
  await expect(page.getByRole("heading", { name: "Không tìm thấy trang này." })).toBeVisible();
  await expect(page.getByTestId("kiosk")).toHaveCount(0);
});
