// Dựng ảnh xem trước khi chia sẻ đường dẫn (thẻ og:image), cỡ 1200×630.
//
// Ảnh gốc của mười lăm điểm đến nặng 2–3,5 MB mỗi tấm. Dán đường dẫn lên Zalo
// hay Facebook thì máy của họ phải tải trọn tấm ấy để dựng khung xem trước, và
// ảnh quá nặng thường ra khung trống. Lượt kiểm tay ngày 12/09/2026 ghi đúng
// chuyện "chia sẻ lên Zalo, Facebook không hiện ảnh xem trước".
//
// Chạy lại khi thêm hoặc đổi ảnh một điểm đến:
//   node scripts/generate-share-images.mjs
//
// Đọc danh sách ảnh thẳng từ hai tệp nội dung, nên không có danh sách thứ ba
// để quên cập nhật.
import { mkdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT = path.join(ROOT, "public", "images", "og");
mkdirSync(OUT, { recursive: true });

function docCap(tep, mauSlug) {
  const noiDung = readFileSync(path.join(ROOT, tep), "utf8");
  return [...noiDung.matchAll(mauSlug)].map((m) => ({ khoa: m[1], anh: m[2] }));
}

// content/destinations.ts: `slug: "..."` đứng trước `image: "..."` trong cùng hồ sơ.
const hoSoSau = docCap(
  "content/destinations.ts",
  /slug: "([a-z0-9-]+)",[\s\S]*?image: "(\/images\/[^"]+)"/g,
);

// content/landing-destinations.ts: `id: "..."` đứng trước `image: "..."`.
const trangChu = docCap(
  "content/landing-destinations.ts",
  /id: "([a-z_]+)",[\s\S]*?image: "(\/images\/[^"]+)"/g,
);
const slugTheoId = Object.fromEntries(
  [...readFileSync(path.join(ROOT, "content/landing-destinations.ts"), "utf8").matchAll(
    /^  ([a-z_]+): "([a-z0-9-]+)",$/gm,
  )].map((m) => [m[1], m[2]]),
);

const cong = new Map();
for (const { khoa, anh } of hoSoSau) cong.set(khoa, anh);
for (const { khoa, anh } of trangChu) {
  const slug = slugTheoId[khoa];
  if (slug && !cong.has(slug)) cong.set(slug, anh);
}

async function dung(nguon, dich) {
  await sharp(path.join(ROOT, "public", nguon))
    .resize(1200, 630, { fit: "cover", position: "attention" })
    .jpeg({ quality: 74, mozjpeg: true })
    .toFile(dich);
  return Math.round(statSync(dich).size / 1024);
}

console.log(`${cong.size} điểm đến`);
for (const [slug, anh] of cong) {
  const kb = await dung(anh, path.join(OUT, `destination-${slug}.jpg`));
  console.log(`${String(kb).padStart(5)} KB  destination-${slug}.jpg  ← ${anh}`);
}
const kb = await dung("/images/destinations/trang-an.jpg", path.join(OUT, "ninh-binh-journey.jpg"));
console.log(`${String(kb).padStart(5)} KB  ninh-binh-journey.jpg`);
