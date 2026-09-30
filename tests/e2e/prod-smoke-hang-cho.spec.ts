import { expect, test } from "@playwright/test";
import { loginAsDirector } from "./support/erp-login";

/**
 * Hàng chờ ảo bến đò Tam Cốc trên production (097), không giả gì: khách lấy số
 * ở trang thật, giám đốc thấy số ấy ở màn Sức chứa Tam Cốc, gọi lượt, máy khách
 * đổi sang "Tới lượt bạn!", rồi khách tự huỷ.
 *
 * Dọn dẹp theo `AGENTS.md`: kho không có hàm xoá lượt (cố ý), nên bài để lượt
 * của nó ở trạng thái khép `khach-huy`, không để gì "đang chờ" hay "đã gọi".
 * Ô "Khách tự huỷ" hôm nay vì thế tăng một. Bài chỉ bấm "Gọi 1 nhóm tiếp" khi
 * số của chính nó đứng đầu hàng: có khách thật đang chờ thì không gọi hộ họ.
 */

const enabled = process.env.NBJ_HANG_CHO_SMOKE === "1";

test.describe("hàng chờ bến đò trên production", () => {
  test.skip(!enabled, "Đặt NBJ_HANG_CHO_SMOKE=1 cùng PLAYWRIGHT_BASE_URL production để chạy.");

  test.beforeAll(() => {
    const baseUrl = process.env.PLAYWRIGHT_BASE_URL;
    if (!baseUrl || new URL(baseUrl).hostname !== "ninhbinhjourney.vercel.app") {
      throw new Error("Bài này bắt buộc PLAYWRIGHT_BASE_URL=https://ninhbinhjourney.vercel.app trong CÙNG câu lệnh.");
    }
  });

  test("khách lấy số, giám đốc thấy và gọi, khách thấy tới lượt rồi tự huỷ", async ({ browser }) => {
    test.setTimeout(120_000);
    const khachCtx = await browser.newContext();
    const khach = await khachCtx.newPage();
    const erpCtx = await browser.newContext();
    const erp = await erpCtx.newPage();
    try {
      await khach.goto("/xep-hang/tam-coc?lang=vi");
      await khach.getByRole("radio", { name: "1" }).click();
      await khach.getByRole("button", { name: "Lấy số" }).click();
      const luot = khach.getByTestId("luot-cua-toi");
      await expect(luot).toHaveAttribute("data-trang-thai", "cho");
      const so = (await luot.getByLabel(/^Số A\d+$/).textContent())?.trim() ?? "";
      expect(so).toMatch(/^A\d{3,}$/);
      const dauHang = (await luot.textContent())?.includes("Bạn đứng đầu hàng") ?? false;

      await loginAsDirector(erp);
      await erp.goto("/erp/tam-coc/suc-chua");
      const bang = erp.getByTestId("hang-cho-erp");
      await expect(bang).toContainText(`${so} · 1 khách`);

      if (dauHang) {
        await bang.getByRole("radio", { name: "1" }).click();
        await bang.getByRole("button", { name: "Gọi 1 nhóm tiếp" }).click();
        await expect(bang).toContainText("Đã gọi 1 nhóm");
        await khach.getByRole("button", { name: "Làm mới" }).click();
        await expect(luot).toHaveAttribute("data-trang-thai", "da-goi");
        await expect(luot).toContainText("Tới lượt bạn!");
      }

      await luot.getByRole("button", { name: "Huỷ lượt" }).click();
      await luot.getByRole("button", { name: "Đồng ý huỷ" }).click();
      await expect(khach.getByRole("button", { name: "Lấy số" })).toBeVisible();

      // Lượt của bài không còn trong danh sách chờ hay đã gọi.
      await erp.reload();
      await expect(erp.getByTestId("hang-cho-erp")).not.toContainText(`${so} · 1 khách`);
    } finally {
      await khachCtx.close();
      await erpCtx.close();
    }
  });
});
