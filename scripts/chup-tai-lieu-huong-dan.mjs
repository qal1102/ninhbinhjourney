#!/usr/bin/env node
/**
 * Chụp ảnh cho tài liệu hướng dẫn rồi in thành PDF (12/10/2026, việc 9).
 *
 *   TAI_LIEU_BASE_URL=https://ninhbinhjourney.vercel.app \
 *   ERP_DEMO_DIRECTOR_PASSWORD=... \
 *   node scripts/chup-tai-lieu-huong-dan.mjs
 *
 * - Bắt buộc ghi `TAI_LIEU_BASE_URL` trong cùng câu lệnh (cùng luật với
 *   `PLAYWRIGHT_BASE_URL`: không bao giờ tự đoán máy nào).
 * - Đăng nhập giám đốc, mở `/erp/huong-dan/tai-lieu`, đọc danh sách mục
 *   (`data-chup`, `data-duong-dan`), mở từng màn: ERP chụp khổ máy tính
 *   1280×800 với chỗ cần bấm được khoanh (`?chi=`), trang khách chụp khổ điện
 *   thoại 390×844. Ảnh JPEG vào `public/huong-dan/anh/`, danh sách vào
 *   `content/huong-dan-anh.json`.
 * - Cuối cùng in trang tài liệu thành `public/huong-dan/huong-dan-su-dung.pdf`
 *   khổ A4, ảnh vừa chụp đặt thẳng vào trang trước khi in.
 * - `TAI_LIEU_CHI_MUC=id1,id2` chỉ chụp lại vài mục; `TAI_LIEU_CHI_IN=1` chỉ in lại PDF.
 * - `TAI_LIEU_TRANG_URL=http://127.0.0.1:3200` (14/10/2026): đọc danh sách mục và
 *   in sổ tay từ máy này (bản vừa sửa, chưa deploy), còn ảnh vẫn chụp ở
 *   `TAI_LIEU_BASE_URL` (production, dữ liệu thật). Bỏ trống thì cả hai là một.
 *
 * Chỉ đọc: không bấm nút nào làm thay đổi dữ liệu, chỉ mở trang và chụp.
 * Mật khẩu chỉ đọc từ biến môi trường, không ghi ra đâu.
 */
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BASE = process.env.TAI_LIEU_BASE_URL?.replace(/\/+$/, "");
if (!BASE) {
  console.error("Thiếu TAI_LIEU_BASE_URL. Ví dụ: TAI_LIEU_BASE_URL=http://127.0.0.1:3200 node scripts/chup-tai-lieu-huong-dan.mjs");
  process.exit(2);
}
const TRANG = process.env.TAI_LIEU_TRANG_URL?.replace(/\/+$/, "") ?? BASE;
const MAT_KHAU = process.env.ERP_DEMO_DIRECTOR_PASSWORD ?? "Giamdoc@2026";
// Máy in sổ tay (TAI_LIEU_TRANG_URL) thường là bản ở máy, mật khẩu mẫu khác production.
const MAT_KHAU_TRANG = process.env.TAI_LIEU_TRANG_MAT_KHAU ?? MAT_KHAU;
const GOC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const THU_MUC_ANH = path.join(GOC, "public", "huong-dan", "anh");
const TEP_DANH_SACH = path.join(GOC, "content", "huong-dan-anh.json");
const TEP_PDF = path.join(GOC, "public", "huong-dan", "huong-dan-su-dung.pdf");
const CHI_MUC = process.env.TAI_LIEU_CHI_MUC?.split(",").map((s) => s.trim()).filter(Boolean) ?? null;

fs.mkdirSync(THU_MUC_ANH, { recursive: true });

const trinhDuyet = await chromium.launch({ channel: process.env.TAI_LIEU_KENH ?? "msedge" });

const may = await trinhDuyet.newContext({
  viewport: { width: 1280, height: 800 },
  deviceScaleFactor: 1,
  reducedMotion: "reduce",
  locale: "vi-VN",
  timezoneId: "Asia/Ho_Chi_Minh",
});
const dienThoai = await trinhDuyet.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 1,
  isMobile: true,
  hasTouch: true,
  reducedMotion: "reduce",
  locale: "vi-VN",
  timezoneId: "Asia/Ho_Chi_Minh",
});

// Đăng nhập cả hai khung: vài mục "trang của khách" mở màn ERP (đoàn, đại lý, tích điểm).
const dangNhap = [[may, BASE, MAT_KHAU], [dienThoai, BASE, MAT_KHAU]];
if (TRANG !== BASE) dangNhap.push([may, TRANG, MAT_KHAU_TRANG]);
for (const [ctx, goc, matKhau] of dangNhap) {
  const page = await ctx.newPage();
  await page.goto(`${goc}/erp/login`);
  await page.getByLabel(/Email hoặc tên đăng nhập|Tên đăng nhập/).fill("giamdoc");
  await page.getByLabel("Mật khẩu").fill(matKhau);
  await page.getByRole("button", { name: "Mở hệ thống quản lý" }).click();
  await page.waitForURL(/\/erp$/, { timeout: 45_000 });
  await page.close();
}

const trangMuc = await may.newPage();
await trangMuc.goto(`${TRANG}/erp/huong-dan/tai-lieu`, { waitUntil: "domcontentloaded" });
const muc = await trangMuc.$$eval("[data-chup]", (ds) =>
  ds.map((el) => ({ id: el.getAttribute("data-chup"), kieu: el.getAttribute("data-kieu"), duong: el.getAttribute("data-duong-dan") })),
);
await trangMuc.close();
console.log(`${muc.length} mục`);

const cu = fs.existsSync(TEP_DANH_SACH) ? JSON.parse(fs.readFileSync(TEP_DANH_SACH, "utf8")) : { anh: [] };
const anh = new Map((cu.anh ?? []).map((a) => [a.id, a]));
let loi = 0;

for (const m of muc) {
  if (process.env.TAI_LIEU_CHI_IN === "1") break;
  if (CHI_MUC && !CHI_MUC.includes(m.id)) continue;
  const page = await (m.kieu === "web" ? dienThoai : may).newPage();
  try {
    await page.goto(`${BASE}${m.duong}`, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await page.waitForLoadState("networkidle", { timeout: 12_000 }).catch(() => undefined);
    // Dải đồng ý của trang khách: chọn "Chỉ cần thiết" cho ảnh gọn.
    await page.getByRole("button", { name: "Chỉ cần thiết" }).click({ timeout: 1500 }).catch(() => undefined);
    // Chỗ khoanh tự cuộn tới phần tử cần bấm; chờ khung khoanh hiện.
    await page.waitForTimeout(m.kieu === "erp" ? 2200 : 1800);
    const tep = `${m.id}.jpg`;
    await page.screenshot({ path: path.join(THU_MUC_ANH, tep), type: "jpeg", quality: 72 });
    const vp = page.viewportSize();
    anh.set(m.id, { id: m.id, tep: `/huong-dan/anh/${tep}`, rong: vp.width, cao: vp.height });
    console.log("✓", m.id);
  } catch (error) {
    loi += 1;
    console.log("✗", m.id, String(error).split("\n")[0]);
  } finally {
    await page.close();
  }
}

const danhSach = {
  chupLuc: process.env.TAI_LIEU_CHI_IN === "1" && cu.chupLuc ? cu.chupLuc : new Date().toISOString(),
  nguon: process.env.TAI_LIEU_CHI_IN === "1" && cu.nguon ? cu.nguon : BASE,
  anh: [...anh.values()].sort((a, b) => a.id.localeCompare(b.id)),
  pdf: "/huong-dan/huong-dan-su-dung.pdf",
};
fs.writeFileSync(TEP_DANH_SACH, `${JSON.stringify(danhSach, null, 2)}\n`);

// In PDF. Trang trên máy đích dựng theo danh sách ảnh của bản đã deploy, nên
// sau khi trang tải xong thì đặt ảnh vừa chụp vào đúng mục, thay khung "Chưa
// có ảnh" hay ảnh cũ. Ảnh đi qua đường dẫn thường, trình duyệt nhận tệp JPEG
// đọc thẳng từ máy này (chặn yêu cầu): nhúng bằng data URI thì Chrome giải nén
// thành điểm ảnh thô và PDF phình lên hàng trăm MB.
const trangIn = await may.newPage();
await trangIn.route("**/huong-dan/anh/*.jpg*", (route) => {
  const ten = decodeURIComponent(new URL(route.request().url()).pathname.split("/").pop() ?? "");
  const tep = path.join(THU_MUC_ANH, ten);
  return fs.existsSync(tep)
    ? route.fulfill({ status: 200, contentType: "image/jpeg", body: fs.readFileSync(tep) })
    : route.continue();
});
await trangIn.goto(`${TRANG}/erp/huong-dan/tai-lieu`, { waitUntil: "load" });
await trangIn.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);
const anhNhung = danhSach.anh
  .filter((a) => fs.existsSync(path.join(THU_MUC_ANH, path.basename(a.tep))))
  .map((a) => ({ ...a, src: `${a.tep}?v=${Date.parse(danhSach.chupLuc)}` }));
await trangIn.evaluate((ds) => {
  for (const a of ds) {
    const khoi = document.querySelector(`[data-chup="${a.id}"]`);
    if (!khoi) continue;
    const fig = khoi.querySelector("figure.anh");
    if (!fig) continue;
    const web = khoi.getAttribute("data-kieu") === "web";
    const img = document.createElement("img");
    img.src = a.src;
    img.alt = "";
    img.width = a.rong;
    img.height = a.cao;
    img.className = "w-full rounded-lg border border-[#d8e0db]";
    const chu = document.createElement("figcaption");
    chu.className = "mt-1 text-[0.7rem] text-[#6e7b75]";
    chu.textContent = web ? "Trang của khách trên điện thoại." : "Khung viền cam là chỗ bắt đầu bấm.";
    fig.replaceChildren(img, chu);
  }
}, anhNhung);
await trangIn.waitForFunction(() => [...document.images].every((img) => img.complete), null, { timeout: 60_000 });
await trangIn.emulateMedia({ media: "print" });
await trangIn.waitForTimeout(800);
await trangIn.pdf({
  path: TEP_PDF,
  preferCSSPageSize: true,
  printBackground: true,
  displayHeaderFooter: true,
  headerTemplate: "<span></span>",
  footerTemplate:
    '<div style="width:100%;font-size:8px;color:#6e7b75;padding:0 14mm;display:flex;justify-content:space-between"><span>Ninh Bình Journey · Sổ tay vận hành</span><span><span class="pageNumber"></span>/<span class="totalPages"></span></span></div>',
});
await trangIn.close();

await trinhDuyet.close();
const kb = Math.round(fs.statSync(TEP_PDF).size / 1024);
console.log(`Xong: ${danhSach.anh.length} ảnh, ${loi} lỗi, PDF ${kb} KB → ${path.relative(GOC, TEP_PDF)}`);
