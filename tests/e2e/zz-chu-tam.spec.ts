import { test } from "@playwright/test";
import { writeFileSync } from "node:fs";
import { loginAsDirector } from "./support/erp-login";
// Chỉ đọc: mở từng màn, mở mọi <details>, chép chữ đang hiện. Không bấm nút nghiệp vụ.
const SP = "C:/Users/mtdrm/AppData/Local/Temp/claude/d--ninhbinh/5dcb151b-052b-4015-b023-3ca524ac0adc/scratchpad/chu";
const SITES = ["trang-an", "tam-chuc", "tam-coc", "bai-dinh"];
const MODS = ["ve-dat-cho","check-in-khach","suc-chua","camera-ai","bao-cao-hien-truong","du-an-su-kien","su-co","nhan-su","cham-cong","doi-tac-nha-cung-ung","sop-dien-tap","tai-chinh-doi-soat","bao-cao"];
const CHUNG = ["/erp","/erp/huong-dan","/erp/nhat-ky","/erp/de-xuat","/erp/finance","/erp/khach-hang","/erp/marketing","/erp/dai-ly","/erp/bang-gia-quay","/erp/tai-khoan","/erp/thuyen","/erp/release","/erp/doi-mat-khau"];
async function chep(page: import("@playwright/test").Page, url: string, ten: string) {
  try {
    await page.goto(url, { timeout: 60_000 });
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);
    await page.waitForTimeout(800);
    const chu = await page.evaluate(() => {
      document.querySelectorAll("details").forEach((d) => ((d as HTMLDetailsElement).open = true));
      const them = [...document.querySelectorAll("[aria-label],[placeholder],[title]")].map((e) =>
        ["aria-label", "placeholder", "title"].map((a) => e.getAttribute(a)).filter(Boolean).join(" | "));
      return document.body.innerText + "\n@@THUOC_TINH\n" + them.join("\n");
    });
    writeFileSync(SP + "/" + ten + ".txt", "URL " + url + "\n" + chu);
  } catch (e) {
    writeFileSync(SP + "/" + ten + ".txt", "URL " + url + "\nLOI " + String(e));
  }
}
test("chep chu chung", async ({ page }) => {
  test.setTimeout(900_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await loginAsDirector(page);
  for (const u of CHUNG) await chep(page, u, "chung" + u.replaceAll("/", "_"));
  await page.goto("/erp/dai-ly");
  const lk = await page.locator('a[href^="/erp/dai-ly/"]').first().getAttribute("href").catch(() => null);
  if (lk) await chep(page, lk, "chung_dai-ly-chi-tiet");
});
for (const s of SITES) {
  test("chep chu " + s, async ({ page }) => {
    test.setTimeout(900_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginAsDirector(page);
    await chep(page, "/erp/" + s, s + "__tong");
    for (const m of MODS) await chep(page, "/erp/" + s + "/" + m, s + "_" + m);
  });
}
test("chep chu khach", async ({ page }) => {
  test.setTimeout(600_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const s of SITES) await chep(page, "/kiosk/" + s, "kiosk_" + s);
  for (const u of ["/tra-cuu-ve", "/ho-so", "/xep-hang/tam-coc", "/nghe"]) await chep(page, u, "khach" + u.replaceAll("/", "_"));
});
