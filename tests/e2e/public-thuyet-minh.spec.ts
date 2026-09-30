import { expect, test } from "@playwright/test";

/**
 * "Nghe thuyết minh" trên trang điểm đến. Máy chạy bài không có loa, nên cài
 * một giọng đọc giả ghi lại từng câu được đưa vào đọc; mỗi câu "đọc xong"
 * sau 60 ms. Chỉ đọc trang, không ghi gì.
 */

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const daDoc: string[] = [];
    (window as unknown as { __daDoc: string[] }).__daDoc = daDoc;
    let hen: number | undefined;
    const giongVi = { lang: "vi-VN", name: "Giọng thử", default: true, localService: true, voiceURI: "thu" };
    const may = {
      speaking: false,
      paused: false,
      getVoices: () => [giongVi],
      speak(loi: SpeechSynthesisUtterance) {
        daDoc.push(loi.text);
        loi.onstart?.(new Event("start") as SpeechSynthesisEvent);
        hen = window.setTimeout(() => loi.onend?.(new Event("end") as SpeechSynthesisEvent), 60);
      },
      cancel() {
        window.clearTimeout(hen);
      },
      pause() {},
      resume() {},
      addEventListener() {},
      removeEventListener() {},
    };
    Object.defineProperty(window, "speechSynthesis", { value: may, configurable: true });
    (window as unknown as { SpeechSynthesisUtterance: unknown }).SpeechSynthesisUtterance = class {
      text: string;
      lang = "";
      rate = 1;
      voice: unknown = null;
      onstart: ((e: Event) => void) | null = null;
      onend: ((e: Event) => void) | null = null;
      onerror: ((e: Event) => void) | null = null;
      constructor(text: string) {
        this.text = text;
      }
    };
  });
});

test("đọc tên và câu chuyện của đúng nơi đang xem, dừng được", async ({ page }) => {
  await page.goto("/destination/trang-an?lang=vi");
  const khoi = page.getByTestId("thuyet-minh");
  await expect(khoi).toBeVisible();
  await khoi.getByRole("button", { name: "▶ Nghe" }).click();
  await expect(khoi).toHaveAttribute("data-trang-thai", "dang-doc");
  await expect(khoi.getByRole("status")).toContainText("Đang đọc câu");
  const daDoc = await page.evaluate(() => (window as unknown as { __daDoc: string[] }).__daDoc);
  expect(daDoc[0]).toBe("Tràng An");
  await khoi.getByRole("button", { name: "■ Dừng" }).click();
  await expect(khoi).toHaveAttribute("data-trang-thai", "nghi");
});

test("bản tiếng Anh đọc chữ tiếng Anh, cả ở trang điểm đến loại thứ hai", async ({ page }) => {
  await page.goto("/destination/cuc-phuong?lang=en");
  const khoi = page.getByTestId("thuyet-minh");
  await khoi.getByRole("button", { name: "▶ Listen" }).click();
  await expect(khoi).toHaveAttribute("data-trang-thai", "dang-doc");
  const daDoc = await page.evaluate(() => (window as unknown as { __daDoc: string[] }).__daDoc);
  expect(daDoc[0]).toMatch(/Cuc Phuong/);
});

test("trang Nghe theo vị trí: tới Tràng An thì tự đọc Tràng An, sang Bái Đính thì đổi sang Bái Đính", async ({ page, context }) => {
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 20.2525, longitude: 105.8975 });
  await page.goto("/nghe?lang=vi");
  await page.getByRole("button", { name: "Bật định vị" }).click();
  await expect(page.getByTestId("dang-o")).toContainText("Bạn đang ở Tràng An");
  const nghe = page.getByTestId("dang-nghe");
  await expect(nghe).toHaveAttribute("data-diem", "trang_an");
  await expect(nghe.getByTestId("thuyet-minh")).toHaveAttribute("data-trang-thai", "dang-doc");
  expect((await page.evaluate(() => (window as unknown as { __daDoc: string[] }).__daDoc))[0]).toBe("Tràng An");

  await context.setGeolocation({ latitude: 20.2768, longitude: 105.8656 });
  await expect(nghe).toHaveAttribute("data-diem", "bai_dinh");
  await expect(page.getByTestId("dang-o")).toContainText("Bái Đính");
  await expect
    .poll(async () => (await page.evaluate(() => (window as unknown as { __daDoc: string[] }).__daDoc)).includes("Bái Đính"))
    .toBe(true);
});

test("trang Nghe chưa bật định vị vẫn chọn tay được nơi đang đứng", async ({ page }) => {
  await page.goto("/nghe?lang=en");
  await page.getByRole("button", { name: "Tam Coc", exact: true }).click();
  await expect(page.getByTestId("dang-nghe")).toHaveAttribute("data-diem", "tam_coc");
  await expect(page.getByTestId("dang-nghe").getByRole("button", { name: "▶ Listen" })).toBeVisible();
});
