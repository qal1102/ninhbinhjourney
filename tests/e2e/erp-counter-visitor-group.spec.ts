import { createHash, randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { loginAsDirector } from "./support/erp-login";

/**
 * TC-18 · đoàn khách mua vé tại quầy — đi trọn luồng, bằng hành vi.
 *
 * ## Vì sao có tệp này
 *
 * Ngày 09/09/2026 đo thẳng trên production: `erp_visitor_groups` 0 hàng,
 * `erp_visitor_group_members` 0 hàng. Cả tính năng — phiếu đoàn tại quầy, mã
 * riêng từng người, màn hình trưởng đoàn, bản vá kho vé ngoại tuyến ở
 * migration `202609080066` — đều xanh ở bài kiểm hợp đồng (đọc chuỗi SQL) mà
 * **chưa từng chạy thật một lần nào**. Bài kiểm này bắt nó chạy thật.
 *
 * ## Bài này cần một PostgreSQL thật
 *
 * `lib/erp/visitor-group-counter-repository.ts` và
 * `lib/erp/offline-gate-repository.ts` **không có nhánh demo-cookie**: chúng
 * luôn gọi RPC. Nên ở chế độ `demo-cookie` mặc định của máy cục bộ, màn hình
 * quầy chỉ trả về "Kho khách đoàn chưa được cấu hình đủ ở phía máy chủ." và
 * không có gì để đo. Vì thế bài tự bỏ qua khi chưa có kho dữ liệu, đúng khuôn
 * `tests/e2e/erp-access.spec.ts` đã dùng.
 *
 * Chạy được thì cần cả bốn thứ trong CÙNG một câu lệnh:
 *
 *   ERP_PERSISTENCE_MODE=supabase \
 *   NEXT_PUBLIC_SUPABASE_URL=<địa chỉ PostgREST> \
 *   SUPABASE_SECRET_KEY=<khoá máy chủ> \
 *   node scripts/run-local-e2e.mjs tests/e2e/erp-counter-visitor-group.spec.ts
 *
 * `NEXT_PUBLIC_*` được Next nhúng lúc build, nên `scripts/run-local-e2e.mjs`
 * phải dựng lại máy chủ với đúng bộ biến ấy — đặt biến sau khi máy chủ đã chạy
 * thì địa chỉ cũ vẫn nằm trong bản build.
 *
 * ## Bài này KHÔNG chạy trên production, cố ý
 *
 * Mỗi tấm phiếu đoàn sinh ra một hàng `erp_tickets` thật mang
 * `entries_allowed` bằng cả đoàn, và **không có RPC nào xoá nó**. Chạy trên
 * production là cộng thẳng vào ô "vé đã bán" của giám đốc, đúng loại rác mà
 * migration 019/020 phải dọn. Nên `PLAYWRIGHT_BASE_URL` có mặt là bỏ qua.
 */

const TENANT_ID = "00000000-0000-4000-8000-000000000001";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
const supabaseSecret = process.env.SUPABASE_SECRET_KEY?.trim() ?? "";
const persistenceMode = process.env.ERP_PERSISTENCE_MODE?.trim() ?? "demo-cookie";
const targetsProduction = Boolean(process.env.PLAYWRIGHT_BASE_URL?.trim());

const chuaCoKhoDuLieu =
  persistenceMode !== "supabase" ||
  supabaseUrl.length === 0 ||
  supabaseUrl.includes("example.supabase.co") ||
  supabaseSecret.length === 0;

test.skip(
  targetsProduction,
  "Bài này lập phiếu đoàn thật và không có đường xoá vé đã lập, nên không được chạm production.",
);
test.skip(
  chuaCoKhoDuLieu,
  "Cần ERP_PERSISTENCE_MODE=supabase cùng NEXT_PUBLIC_SUPABASE_URL và SUPABASE_SECRET_KEY trỏ vào một PostgreSQL đã áp migration.",
);

test.describe.configure({ mode: "serial" });

/**
 * Đọc thẳng kho dữ liệu để lấy mã riêng từng người.
 *
 * Đây không phải lối tắt cho tiện: **màn hình quầy không hiện mã thành viên ở
 * bất cứ đâu** (xem `components/erp/ticket-guest-workspace.tsx`, khối "Đoàn mua
 * tại quầy" chỉ vẽ một mã QR của mã đoàn), và trang trưởng đoàn cũng chỉ hiện
 * tên chứ không hiện mã. Muốn quét thử một mã `TV-…` thì chỉ còn đường này.
 * Bản thân việc phải viết hàm này là một bằng chứng, xem ghi chú DEFECT-B.
 */
async function docKho(path: string): Promise<unknown[]> {
  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    headers: {
      apikey: supabaseSecret,
      Authorization: `Bearer ${supabaseSecret}`,
      Accept: "application/json",
    },
  });
  expect(response.ok, `đọc ${path} thất bại: ${response.status}`).toBeTruthy();
  return (await response.json()) as unknown[];
}

type MemberRow = { member_code: string; member_index: number };

async function maThanhVienCua(groupCode: string): Promise<MemberRow[]> {
  const groups = (await docKho(
    `erp_visitor_groups?select=id,ticket_id,order_id,member_count&group_code=eq.${groupCode}&tenant_id=eq.${TENANT_ID}`,
  )) as Array<{ id: string; ticket_id: string | null; order_id: string | null }>;
  expect(groups, `không tìm thấy đoàn ${groupCode} trong kho`).toHaveLength(1);
  const members = (await docKho(
    `erp_visitor_group_members?select=member_code,member_index&group_id=eq.${groups[0].id}&order=member_index.asc`,
  )) as MemberRow[];
  return members;
}

/** Lập một phiếu đoàn tại quầy, đúng cách nhân viên làm: gõ hai ô rồi bấm. */
async function lapPhieuDoan(page: Page, soNguoi: number, nhan: string) {
  await page.getByLabel("Số người").fill(String(soNguoi));
  await page.getByLabel("Nhãn đoàn").fill(nhan);
  await page.getByRole("button", { name: "Lập phiếu đoàn" }).click();
  const ma = page.locator("p.font-mono").filter({ hasText: /^DOAN-/ });
  await expect(ma).toBeVisible({ timeout: 20_000 });
  return ((await ma.textContent()) ?? "").trim();
}

async function moManHinhQuay(page: Page) {
  await loginAsDirector(page);
  await page.goto("/erp/trang-an/ve-dat-cho");
  await expect(page.getByRole("heading", { name: "Lập phiếu đoàn, đưa QR cho khách" })).toBeVisible();
}

// --- Bước 1 + 2 ------------------------------------------------------------

test("bước 1+2: quầy lập được phiếu đoàn nhỏ và đoàn 45 chỗ, mã đoàn cùng mã từng người đều sinh ra", async ({ page }) => {
  await moManHinhQuay(page);

  const nhanNho = `Đoàn thử nhỏ ${randomUUID().slice(0, 8)}`;
  const maNho = await lapPhieuDoan(page, 4, nhanNho);
  expect(maNho, "mã đoàn phải do máy sinh, đúng khuôn DOAN- cộng 10 ký tự").toMatch(/^DOAN-[A-Z0-9]{10}$/);
  await expect(page.getByText(`${nhanNho} · 4 người`)).toBeVisible();

  const thanhVienNho = await maThanhVienCua(maNho);
  expect(thanhVienNho).toHaveLength(4);
  for (const member of thanhVienNho) {
    expect(member.member_code).toMatch(/^TV-[A-Z0-9]{10}$/);
  }

  // Xe khách 45 chỗ — trần đã chốt ở `domain/erp-counter-visitor-group.ts`.
  const nhanXe = `Đoàn Hà Nội 45 chỗ ${randomUUID().slice(0, 8)}`;
  const maXe = await lapPhieuDoan(page, 45, nhanXe);
  expect(maXe).not.toBe(maNho);
  await expect(page.getByText(`${nhanXe} · 45 người`)).toBeVisible();

  const thanhVienXe = await maThanhVienCua(maXe);
  expect(thanhVienXe, "đoàn 45 người phải có đủ 45 mã riêng").toHaveLength(45);
  expect(new Set(thanhVienXe.map((m) => m.member_code)).size, "45 mã phải khác nhau").toBe(45);

  // Tấm vé đứng sau đoàn quầy: treo thẳng vào vé, không qua đơn web.
  const ve = (await docKho(
    `erp_visitor_groups?select=ticket_id,order_id&group_code=eq.${maXe}`,
  )) as Array<{ ticket_id: string | null; order_id: string | null }>;
  expect(ve[0].order_id, "đoàn quầy không được đẻ ra một đơn web").toBeNull();
  expect(ve[0].ticket_id).not.toBeNull();
  const veRow = (await docKho(
    `erp_tickets?select=ticket_code,channel,product,entries_allowed&id=eq.${ve[0].ticket_id}`,
  )) as Array<{ ticket_code: string; channel: string; product: string; entries_allowed: number }>;
  expect(veRow[0].channel).toBe("quay-ve");
  expect(veRow[0].product).toBe("group");
  expect(veRow[0].entries_allowed).toBe(45);
});

test("bước 2: mã QR màn hình quầy in ra đọc được, và nó chứa đúng mã đoàn", async ({ page }) => {
  await moManHinhQuay(page);
  const ma = await lapPhieuDoan(page, 3, `Đoàn đọc QR ${randomUUID().slice(0, 8)}`);

  const anh = page.getByRole("img", { name: `Mã QR đoàn ${ma}` });
  await expect(anh).toBeVisible();

  // Giải mã đúng tấm ảnh đang hiện, không tin vào thuộc tính alt: vẽ nó ra
  // canvas rồi đọc lại bằng `jsqr` — cùng thư viện camera ở cổng đang dùng
  // (`lib/erp/use-gate-camera-scanner.ts`).
  const anhPixel = await anh.evaluate(async (element) => {
    const img = element as HTMLImageElement;
    if (!img.complete) await new Promise((resolve) => { img.onload = resolve; });
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("không dựng được canvas");
    context.drawImage(img, 0, 0);
    const data = context.getImageData(0, 0, canvas.width, canvas.height);
    return { width: canvas.width, height: canvas.height, data: Array.from(data.data) };
  });
  const { default: jsQR } = await import("jsqr");
  const doc = jsQR(Uint8ClampedArray.from(anhPixel.data), anhPixel.width, anhPixel.height);
  expect(doc?.data, "máy quét phải đọc ra đúng mã đoàn từ tấm QR đang hiện").toBe(ma);
});

// --- Bước 4: quét ở cổng ---------------------------------------------------

test("bước 4: quét mã một người ở cổng — lượt đầu nhận, lượt hai bị chặn", async ({ page }) => {
  await moManHinhQuay(page);
  const ma = await lapPhieuDoan(page, 4, `Đoàn quét cổng ${randomUUID().slice(0, 8)}`);
  const members = await maThanhVienCua(ma);

  await page.goto("/erp/trang-an/check-in-khach");
  const oQuet = page.getByPlaceholder("Đưa mã vào máy quét hoặc nhập mã QR");
  await expect(oQuet).toBeVisible();

  await oQuet.fill(members[0].member_code);
  await page.getByRole("button", { name: "Xác thực & ghi nhận" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Vé hợp lệ" })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("status").filter({ hasText: "(1/4 lượt)" })).toBeVisible();

  // Cùng một người, lượt thứ hai: phải là "đã vào rồi", KHÔNG phải "hết lượt"
  // — vé đoàn vẫn còn ba chỗ, nói sai là đẩy nhân viên đi tìm một vấn đề
  // không có.
  await oQuet.fill(members[0].member_code);
  await page.getByRole("button", { name: "Xác thực & ghi nhận" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Khách này đã vào rồi" })).toBeVisible({ timeout: 20_000 });

  // Người thứ hai trên cùng tấm vé vẫn vào được bình thường.
  await oQuet.fill(members[1].member_code);
  await page.getByRole("button", { name: "Xác thực & ghi nhận" }).click();
  await expect(page.getByRole("status").filter({ hasText: "(2/4 lượt)" })).toBeVisible({ timeout: 20_000 });
});

/**
 * DEFECT-A · chặn hẳn.
 *
 * Màn hình quầy in ra một mã QR chứa **mã đoàn** (`DOAN-…`) và bảo nhân viên
 * "Đưa mã QR này cho khách quét ở cổng"
 * (`components/erp/ticket-guest-workspace.tsx`). Nhưng cổng chỉ tra mã theo
 * `erp_tickets.ticket_code` rồi `erp_visitor_group_members.member_code`
 * (`erp_gate_scan_ticket_at`, migration `202608300054` + `202609060063`), nên
 * mã đoàn rơi vào "không tìm thấy".
 *
 * `test.fail()` chứ không phải một khẳng định "đúng như hiện trạng": bài này
 * đang ghi lại một chỗ hỏng, và ngày ai đó vá xong thì bài tự đỏ để nhắc gỡ
 * chú thích này — chứ không lặng lẽ khoá chỗ hỏng lại.
 */
test("bước 2 + 4 · DEFECT-A: mã QR quầy đưa cho khách lại không quét được ở cổng", async ({ page }) => {
  test.fail();
  await moManHinhQuay(page);
  const ma = await lapPhieuDoan(page, 2, `Đoàn QR đoàn ${randomUUID().slice(0, 8)}`);

  await page.goto("/erp/trang-an/check-in-khach");
  const oQuet = page.getByPlaceholder("Đưa mã vào máy quét hoặc nhập mã QR");
  await oQuet.fill(ma);
  await page.getByRole("button", { name: "Xác thực & ghi nhận" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Vé hợp lệ" })).toBeVisible({ timeout: 20_000 });
});

// --- Bước 3: màn hình trưởng đoàn -----------------------------------------

test("bước 3: trưởng đoàn thấy đúng ai đã vào, ai chưa", async ({ page }) => {
  await moManHinhQuay(page);
  const nhan = `Đoàn trưởng đoàn ${randomUUID().slice(0, 8)}`;
  const ma = await lapPhieuDoan(page, 5, nhan);
  const members = await maThanhVienCua(ma);

  await page.goto(`/doan/truong/${ma}`);
  await expect(page.getByRole("heading", { name: nhan })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("chưa ai qua cổng nào cả")).toBeVisible();
  await expect(page.getByText("5 người", { exact: true })).toBeVisible();

  // Hai người qua cổng.
  await page.goto("/erp/trang-an/check-in-khach");
  const oQuet = page.getByPlaceholder("Đưa mã vào máy quét hoặc nhập mã QR");
  for (const member of members.slice(0, 2)) {
    await oQuet.fill(member.member_code);
    await page.getByRole("button", { name: "Xác thực & ghi nhận" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Vé hợp lệ" })).toBeVisible({ timeout: 20_000 });
  }

  await page.goto(`/doan/truong/${ma}`);
  await expect(page.getByText("người trong đoàn chưa qua cổng Tràng An")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Những người chưa qua cổng Tràng An")).toBeVisible();
  const conLai = page.getByRole("listitem").filter({ hasText: /^Người thứ / });
  await expect(conLai, "5 người, 2 đã vào, còn 3 tên trong danh sách chờ").toHaveCount(3);
  await expect(page.getByText("Người thứ 1")).toHaveCount(0);
});

// --- Bước 5: mất mạng ------------------------------------------------------

test("bước 5: mất mạng ở cổng, bản kê ngoại tuyến vẫn mang mã TV- của đoàn quầy", async ({ page, context }) => {
  await moManHinhQuay(page);
  const ma = await lapPhieuDoan(page, 6, `Đoàn ngoại tuyến ${randomUUID().slice(0, 8)}`);
  const members = await maThanhVienCua(ma);

  await page.goto("/erp/trang-an/check-in-khach");
  const banDieuKhien = page.getByTestId("offline-gate-console");
  await expect(banDieuKhien).toBeVisible();

  // Bản kê thật, do `erp_prepare_offline_gate_manifest` dựng — chỗ migration
  // `202609080066` vá. Trước bản vá ấy, mọi mã `TV-…` của đoàn quầy đều báo
  // "không có trong danh sách" khi mất mạng.
  const banKe = page.waitForResponse((response) =>
    response.url().includes("/api/erp/offline-gate/manifests") && response.status() === 201);
  await page.getByRole("button", { name: "Nạp vé cho ca" }).click();
  const payload = (await (await banKe).json()) as { tickets: Array<{ codeDigest: string; entriesRemaining: number }> };
  await expect(page.getByText(/Đã nạp \d+ vé tối thiểu/)).toBeVisible();

  const bam = (code: string) => createHash("sha256").update(code).digest("hex");
  const bamCuaNguoiDau = bam(members[0].member_code);
  expect(
    payload.tickets.some((item) => item.codeDigest === bamCuaNguoiDau),
    "bản kê ngoại tuyến phải mang mã riêng của người trong đoàn quầy",
  ).toBeTruthy();

  await context.setOffline(true);
  const oQuet = page.getByPlaceholder("Quét hoặc nhập mã vé");
  await oQuet.fill(members[0].member_code);
  await page.getByRole("button", { name: "Ghi vào hàng đợi" }).click();
  await expect(page.getByText(/Tạm hợp lệ theo bộ vé/)).toBeVisible();
  await expect(banDieuKhien.getByText("1 lượt", { exact: true })).toBeVisible();

  // Máy quét ở cổng gõ nguyên cả địa chỉ khi mã QR chứa một URL. Hai đường
  // phải cùng về một mã, đúng như `normalizeScannedCode` cam kết.
  await oQuet.fill(`https://ninhbinhjourney.vn/doan/${members[1].member_code}`);
  await page.getByRole("button", { name: "Ghi vào hàng đợi" }).click();
  await expect(page.getByText(/Tạm hợp lệ theo bộ vé/)).toBeVisible();

  await context.setOffline(false);
  await page.getByRole("button", { name: /Đồng bộ 2/ }).click();
  await expect(page.getByText(/Đã đồng bộ đủ 2 lượt/)).toBeVisible({ timeout: 20_000 });
  await expect(banDieuKhien.getByText("0 lượt", { exact: true }).first()).toBeVisible();

  // Hai lượt ngoại tuyến ấy phải thành hai lượt vào thật trên máy chủ.
  await page.goto(`/doan/truong/${ma}`);
  const conLai = page.getByRole("listitem").filter({ hasText: /^Người thứ / });
  await expect(conLai, "6 người, 2 người đã quét lúc mất mạng, còn 4").toHaveCount(4);
});

// --- Bước 6: gửi trùng -----------------------------------------------------

test("bước 6: gửi lại sau khi mất kết nối trả về đúng tấm phiếu cũ, không đẻ phiếu thứ hai", async ({ page }) => {
  await moManHinhQuay(page);
  const nhan = `Đoàn gửi trùng ${randomUUID().slice(0, 8)}`;

  // Dựng đúng cảnh ở quầy: máy chủ NHẬN và lập phiếu xong, nhưng câu trả lời
  // rơi mất trên đường về. Nhân viên không thấy gì nên bấm lại.
  let daNuot = false;
  await page.route("**/erp/trang-an/ve-dat-cho", async (route) => {
    if (daNuot || route.request().method() !== "POST") return route.continue();
    daNuot = true;
    await route.fetch();
    await route.abort("failed");
  });

  await page.getByLabel("Số người").fill("7");
  await page.getByLabel("Nhãn đoàn").fill(nhan);
  await page.getByRole("button", { name: "Lập phiếu đoàn" }).click();
  await expect(page.getByRole("button", { name: "Lập phiếu đoàn" })).toBeEnabled({ timeout: 20_000 });
  await expect(page.locator("p.font-mono").filter({ hasText: /^DOAN-/ })).toHaveCount(0);

  // Bấm lại đúng như nhân viên sẽ làm. Hai ô vẫn còn nguyên chữ đã gõ.
  await page.getByRole("button", { name: "Lập phiếu đoàn" }).click();
  const ma = page.locator("p.font-mono").filter({ hasText: /^DOAN-/ });
  await expect(ma).toBeVisible({ timeout: 20_000 });

  const doan = (await docKho(
    `erp_visitor_groups?select=group_code,member_count,counter_request_key&group_label=eq.${encodeURIComponent(nhan)}&tenant_id=eq.${TENANT_ID}`,
  )) as Array<{ group_code: string; member_count: number }>;
  expect(doan, "một tấm phiếu, không phải hai").toHaveLength(1);
  expect(doan[0].group_code).toBe(((await ma.textContent()) ?? "").trim());
  expect(doan[0].member_count).toBe(7);

  const ve = (await docKho(
    `erp_tickets?select=ticket_code&entries_allowed=eq.7&channel=eq.quay-ve&valid_on=eq.${new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date())}`,
  )) as Array<{ ticket_code: string }>;
  expect(ve.length, "chỉ được một tấm vé quầy 7 chỗ cho lượt chạy này").toBe(1);
});
