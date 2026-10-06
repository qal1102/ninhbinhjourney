/**
 * Đo một lượt đọc ở máy chủ; chậm hơn ngưỡng thì ghi một dòng log
 * `[cham] <nhãn> <ms>ms` để tìm màn nào đang đợi gì. Không đổi kết quả hay
 * lỗi của lượt đọc.
 */
const NGUONG_MS = 200;

export async function doThoiGian<T>(nhan: string, viec: Promise<T>): Promise<T> {
  const batDau = performance.now();
  try {
    return await viec;
  } finally {
    const ms = Math.round(performance.now() - batDau);
    if (ms >= NGUONG_MS) console.info(`[cham] ${nhan} ${ms}ms`);
  }
}
