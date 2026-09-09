// Chạy toàn bộ bộ Playwright CỤC BỘ, đúng cách.
//
// Vì sao cần tệp này thay vì gõ thẳng `npx playwright test`: bốn cờ tính năng
// dưới đây mặc định TẮT, và khi tắt thì `/checkout`, trang tra cứu vé và cổng
// ngoại tuyến không dựng giao diện. Bài kiểm khi ấy đỏ hàng loạt với thông báo
// "element(s) not found" — trông y hệt như sản phẩm hỏng nặng.
//
// Chuyện này đã xảy ra thật ngày 09/09/2026: một lượt `npx playwright test`
// thiếu cờ cho 18 bài đỏ, và suýt thành một báo cáo "hỏng ba luồng tiền".
// Chạy lại đúng cờ thì 18/18 xanh, và chạy trên production cũng 16/16 xanh.
//
// Bỏ qua `prod-smoke-*` vì chúng cần `PLAYWRIGHT_BASE_URL` trỏ production và
// mật khẩu giám đốc — dùng `scripts/run-prod-smoke.ps1` cho việc đó.
//
// KHÔNG đặt `PLAYWRIGHT_BASE_URL` ở đây. Đặt vào là Playwright bỏ qua
// webServer và lượt chạy "cục bộ" này âm thầm bắn vào production.

import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const specs = readdirSync("tests/e2e")
  .filter((name) => name.endsWith(".spec.ts") && !name.startsWith("prod-smoke-"))
  .map((name) => `tests/e2e/${name}`);

if (specs.length === 0) {
  console.error("Không tìm thấy bài kiểm cục bộ nào trong tests/e2e.");
  process.exit(1);
}

const env = {
  ...process.env,
  NBJ_E2E_CUSTOMER_BOOKING: "1",
  NBJ_E2E_OFFLINE_GATE: "1",
  NBJ_E2E_CUSTOMER_ANALYTICS: "1",
  NBJ_E2E_CUSTOMER_IDENTITY: "1",
};
delete env.PLAYWRIGHT_BASE_URL;

console.log(`Chạy ${specs.length} tệp bài kiểm cục bộ, đã bật đủ cờ tính năng.`);
// Gọi thẳng CLI bằng node, không qua `npx`: trên Windows, `npx.cmd` cần một
// shell mới chạy được và `spawnSync` không có shell thì thoát mã 1 mà không in
// một dòng nào — trông y như bộ bài kiểm hỏng. Đây là cách
// scripts/run-prod-smoke.ps1 vẫn dùng.
const cli = fileURLToPath(new URL("../node_modules/@playwright/test/cli.js", import.meta.url));
const result = spawnSync(
  process.execPath,
  [cli, "test", ...specs, ...process.argv.slice(2)],
  { stdio: "inherit", env },
);
process.exit(result.status ?? 1);
