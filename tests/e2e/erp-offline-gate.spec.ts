import { createHash } from "node:crypto";
import { expect, test } from "@playwright/test";

async function login(page: import("@playwright/test").Page) {
  await page.goto("/erp/login");
  await page.getByLabel("Tên đăng nhập").fill("giamdoc");
  await page.getByLabel("Mật khẩu").fill("Giamdoc@2026");
  await page.getByRole("button", { name: "Mở hệ thống quản lý" }).click();
  await expect(page).toHaveURL(/\/erp$/);
}

test("A3 queues a batch offline, survives a lost sync response and reconciles without duplicates", async ({ page, context }) => {
  const code = "OFFLINE-VALID-001";
  const digest = createHash("sha256").update(code).digest("hex");
  const manifestId = "10000000-0000-4000-8000-000000000001";
  let syncAttempts = 0;
  const batchIds: string[] = [];

  await page.route("**/api/erp/offline-gate/manifests", async (route) => {
    const body = route.request().postDataJSON() as { deviceId: string };
    await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({
      manifestId, siteId: "10000000-0000-4000-8000-000000000001", deviceId: body.deviceId,
      serviceDate: new Date().toISOString().slice(0, 10), issuedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(), ticketCount: 1,
      snapshotDigest: "a".repeat(64), tickets: [{ codeDigest: digest, entriesRemaining: 1 }],
    }) });
  });
  await page.route("**/api/erp/offline-gate/sync", async (route) => {
    syncAttempts += 1;
    const body = route.request().postDataJSON() as { batchId: string; scans: Array<{ idempotencyKey: string; localResult: string }> };
    batchIds.push(body.batchId);
    if (syncAttempts === 1) return route.abort("failed");
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
      batchId: body.batchId, itemCount: 2, acceptedCount: 1, refusedCount: 1,
      replayedCount: 0, divergedCount: 0, replayedBatch: false,
      items: body.scans.map((scan) => ({ idempotencyKey: scan.idempotencyKey, localResult: scan.localResult, serverResult: scan.localResult, reconciliationStatus: "matched", replayed: false })),
    }) });
  });

  await login(page);
  await page.goto("/erp/trang-an/check-in-khach");
  const console = page.getByTestId("offline-gate-console");
  await expect(console).toBeVisible();
  await page.getByRole("button", { name: "Nạp vé cho ca" }).click();
  await expect(page.getByText(/Đã nạp 1 vé tối thiểu/)).toBeVisible();

  await context.setOffline(true);
  const input = page.getByPlaceholder("Quét hoặc nhập mã vé");
  await input.fill(code);
  await page.getByRole("button", { name: "Ghi vào hàng đợi" }).click();
  await expect(page.getByText(/Tạm hợp lệ theo bộ vé/)).toBeVisible();
  await input.fill(code);
  await page.getByRole("button", { name: "Ghi vào hàng đợi" }).click();
  await expect(page.getByText(/Vé đã hết lượt theo hàng đợi/)).toBeVisible();
  await expect(console.getByText("2 lượt", { exact: true })).toBeVisible();

  await context.setOffline(false);
  // Reconnection triggers the first sync automatically. The simulated lost
  // response must leave the durable queue untouched for a stable retry.
  await expect(page.getByText(/hàng đợi vẫn được giữ trên máy/)).toBeVisible();
  await expect(console.getByText("2 lượt", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /Đồng bộ 2/ }).click();
  await expect(page.getByText(/Đã đồng bộ đủ 2 lượt/)).toBeVisible();
  await expect(console.getByText("0 lượt", { exact: true }).first()).toBeVisible();
  expect(batchIds).toHaveLength(2);
  expect(batchIds[1]).toBe(batchIds[0]);
});
