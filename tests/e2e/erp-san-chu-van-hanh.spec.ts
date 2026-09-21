import { expect, test } from "@playwright/test";
import { ERP_OPERATIONAL_MODULE_IDS } from "@/domain/erp";
import { ERP_DIRECTOR_PASSWORD } from "./support/erp-credentials";

/**
 * A15-LOI-03 — sàn chữ 14px ở màn vận hành, đo trên trình duyệt thật.
 *
 * Bài kiểm đơn vị canh được rằng *luật CSS còn đó và danh sách module còn
 * đó*. Nó **không** canh được thứ duy nhất người đứng ở cổng quan tâm: chữ
 * trên màn hình có thật sự từ 14px trở lên không. Một lớp tiện ích khác đè
 * lên, một `style` nội tuyến, một thư viện dựng lại DOM — đều làm sàn thủng
 * mà bài đơn vị vẫn xanh.
 *
 * Đo luôn cả hai thứ đi kèm, vì nới chữ là cách nhanh nhất làm vỡ bố cục:
 * chữ bị cắt cụt, và trang tràn ngang.
 *
 * Chỉ đọc, không ghi một hàng nào, nên chạy thẳng trên production cũng sạch.
 */

const SITE = "trang-an";

async function loginAsDirector(page: import("@playwright/test").Page) {
  await page.goto("/erp/login");
  await page.getByLabel("Tên đăng nhập").fill("giamdoc");
  await page.getByLabel("Mật khẩu").fill(ERP_DIRECTOR_PASSWORD);
  await page.getByRole("button", { name: "Mở hệ thống quản lý" }).click();
  await expect(page).toHaveURL(/\/erp$/);
}

for (const moduleId of ERP_OPERATIONAL_MODULE_IDS) {
  test(`màn vận hành ${moduleId}: không chữ nào dưới 14px, không chữ bị cắt, không tràn ngang`, async ({
    page,
  }) => {
    await loginAsDirector(page);
    await page.goto(`/erp/${SITE}/${moduleId}`);
    // `app/erp/loading.tsx` dựng khung xương trong chính một thẻ `main` mang
    // `aria-busy`, nên trong lúc chuyển trang **có hai** thẻ `main`. Đo trúng
    // lúc ấy là đo cái khung xương, không phải màn thật — chờ nó biến mất rồi
    // mới đo, và mọi phép đo đều bám thẻ `main` không có `aria-busy`.
    await expect(page.locator('main[aria-busy="true"]')).toHaveCount(0);
    const than = page.locator("main:not([aria-busy])");
    await expect(than).toBeVisible();

    const do_ = await page.evaluate(() => {
      const goc = document.querySelector("main:not([aria-busy])")!;
      const la = Array.from(goc.querySelectorAll("*"));
      const duoi14 = la
        .filter((el) => el.children.length === 0 && (el.textContent ?? "").trim())
        .map((el) => ({
          px: parseFloat(getComputedStyle(el).fontSize),
          chu: (el.textContent ?? "").trim().slice(0, 40),
        }))
        .filter((x) => Number.isFinite(x.px) && x.px < 14);
      // Ô chọn (`select`) phải đo riêng. `scrollWidth` của nó lấy theo **lựa
      // chọn rộng nhất trong danh sách**, không theo dòng đang hiện — nên một
      // ô thừa chỗ vẫn báo "bị cắt". Đo trên production 21/09: cả sáu ô ở màn
      // Sức chứa đều dư chỗ cho dòng đang chọn, mà phép đo cũ vẫn bắt đỏ. Thứ
      // đáng đo là: **dòng đang chọn có đọc hết được không**.
      const catOChon = Array.from(goc.querySelectorAll("select"))
        .filter((s) => s.getBoundingClientRect().width > 0)
        .filter((s) => {
          const box = s.getBoundingClientRect();
          const do_ = document.createElement("span");
          const cs = getComputedStyle(s);
          do_.style.cssText = "position:absolute;visibility:hidden;white-space:nowrap";
          do_.style.font =
            cs.font || `${cs.fontWeight} ${cs.fontSize}/${cs.lineHeight} ${cs.fontFamily}`;
          do_.textContent = s.options[s.selectedIndex]?.text ?? "";
          document.body.appendChild(do_);
          const rongChu = do_.getBoundingClientRect().width;
          do_.remove();
          // 28px chừa cho mũi chỉ của trình duyệt và hai bên đệm.
          return box.width - 28 < rongChu;
        })
        .map((s) => s.options[s.selectedIndex]?.text?.slice(0, 40) ?? "");

      const catChu = la
        .filter((el) => el.tagName !== "SELECT")
        .filter((el) => {
          const s = getComputedStyle(el);
          // Chữ chỉ dành cho trình đọc màn hình (`sr-only`) cố ý bị kẹp về
          // một ô 1×1px, nên `scrollWidth > clientWidth` luôn đúng với nó.
          // Đó không phải chữ bị cắt — không ai nhìn thấy nó cả. Bỏ qua mọi
          // phần tử nhỏ hơn 4px, và mọi phần tử đang bị kẹp.
          if (el.clientWidth < 4 || el.clientHeight < 4) return false;
          if (s.clipPath !== "none" || s.position === "absolute") return false;
          return (
            el.scrollWidth > el.clientWidth + 1 &&
            s.overflowX !== "auto" &&
            s.overflowX !== "scroll"
          );
        })
        .map((el) => (el.textContent ?? "").trim().slice(0, 40));
      return {
        duoi14,
        catChu,
        catOChon,
        tranNgang: document.documentElement.scrollWidth > window.innerWidth + 1,
      };
    });

    expect(do_.duoi14, JSON.stringify(do_.duoi14.slice(0, 5))).toHaveLength(0);
    expect(do_.catChu, JSON.stringify(do_.catChu.slice(0, 5))).toHaveLength(0);
    expect(do_.catOChon, JSON.stringify(do_.catOChon)).toHaveLength(0);
    expect(do_.tranNgang).toBe(false);
  });
}
