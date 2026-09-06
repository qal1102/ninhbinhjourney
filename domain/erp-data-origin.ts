/**
 * ERP-FAKE-03 — nguồn gốc của một hàng dữ liệu, và luật chia đôi đi kèm.
 *
 * Kho dữ liệu đang chứa ba loại hàng khác hẳn nhau:
 *
 *   `real`          nghiệp vụ thật, do người thật làm ra
 *   `demo-seed`     hồ sơ gieo sẵn lúc dựng hệ thống, để màn hình có thứ mà xem
 *   `test-residue`  cặn còn lại của các lượt chạy thử trên production
 *
 * Luật giữ cứng: **màn hình nghiệp vụ giữ cả ba, kèm nhãn nhìn thấy được;
 * mọi con số gọi người ta ra quyết định thì chỉ đếm `real`.** Gọi một người
 * đi xử lý việc không có thật là cách chắc nhất để lần sau họ bỏ qua một việc
 * có thật.
 *
 * Cột `data_origin` trong cơ sở dữ liệu mặc định `'real'`, nên hàng nào sinh
 * ra từ nay cũng tự đúng. Còn khi cột chưa tồn tại — migration chưa áp được
 * lúc deploy — thì `parseErpDataOrigin` trả về `"real"` và mọi con số giữ
 * nguyên như trước, thay vì màn hình tắt ngóm.
 */
export type ErpDataOrigin = "real" | "demo-seed" | "test-residue";

export const ERP_DATA_ORIGINS: readonly ErpDataOrigin[] = [
  "real",
  "demo-seed",
  "test-residue",
];

export function isErpDataOrigin(value: unknown): value is ErpDataOrigin {
  return (
    typeof value === "string" &&
    (ERP_DATA_ORIGINS as readonly string[]).includes(value)
  );
}

/** Không đọc ra được thì coi là thật — thà đếm dư còn hơn giấu mất việc thật. */
export function parseErpDataOrigin(value: unknown): ErpDataOrigin {
  return isErpDataOrigin(value) ? value : "real";
}

export function isRealErpData(record: { dataOrigin: ErpDataOrigin }): boolean {
  return record.dataOrigin === "real";
}

/** Nhãn ngắn dán lên từng dòng ở màn hình nghiệp vụ. Hàng thật không đeo nhãn. */
export function erpDataOriginLabel(origin: ErpDataOrigin): string | null {
  if (origin === "demo-seed") return "hồ sơ mẫu";
  if (origin === "test-residue") return "cặn chạy thử";
  return null;
}

/**
 * Tách một danh sách thành phần thật và phần không thật.
 *
 * Trả về cả hai, cố ý: phần không thật vẫn cần đếm để **nói ra** trên màn
 * hình. Giám đốc thấy 0 bút toán mà biết sổ vẫn còn mấy bút toán mẫu thì con
 * số 0 kia mới đọc được; giấu đi thì chính sự vênh ấy làm người ta nghi màn
 * hình hỏng.
 */
/**
 * Ba bảng tài chính KHÔNG có cột `data_origin`, và cố ý không bao giờ có.
 *
 * Bản đầu định thêm cột như đã làm với vé và sự cố. Chạy thử trên production
 * thì cơ sở dữ liệu chặn lại, và nó chặn đúng:
 *
 *   ACCOUNTING_POSTED_JOURNAL_IMMUTABLE — bút toán đã ghi sổ thì cấm sửa
 *   AP_JOURNAL_REQUIRES_AP_WORKFLOW     — sổ công nợ chỉ đổi qua đúng quy trình
 *   SHIFT_CLOSE_VERSION_MUST_INCREMENT  — mọi lần sửa phải tăng số phiên bản
 *
 * Một bút toán đã ghi sổ mà sửa được thì nó không còn là sổ kế toán nữa. Dán
 * thêm một cái nhãn cũng không đáng để mở cánh cửa ấy — nên nguồn gốc ở đây
 * **suy ra lúc đọc**, không ghi vào hàng.
 *
 * Ba dấu hiệu, xét theo thứ tự:
 *
 *   1. Có cột `data_origin` thì tin cột (phòng khi sau này bảng nào đó có).
 *   2. Mã hàng mang tiền tố gieo sẵn — `61000000-`, `87000000-`, `88000000-`.
 *      Hàng thật dùng `gen_random_uuid()` nên không bao giờ trúng.
 *   3. Tạo trước mốc dưới đây thì là cặn của các lượt chạy thử.
 *
 * Vì sao cần cả dấu hiệu thứ ba: đo trên production 06/09/2026, sổ kế toán có
 * 11 hàng thì **chỉ 2 hàng mang tiền tố gieo sẵn**, 9 hàng còn lại mang mã
 * ngẫu nhiên vì chúng do các lượt chạy thử đi qua đúng quy trình tạo ra —
 * đúng thứ `AGENTS.md` cảnh báo. Không có gì trong cấu trúc phân biệt được
 * chúng với hàng thật, chỉ có thời gian.
 */
const ERP_SEED_ID_PREFIXES = ["61000000-", "87000000-", "88000000-"] as const;

/**
 * Mốc chia: trước mốc này chưa từng có nghiệp vụ thật nào chạy qua hệ thống.
 *
 * Toàn bộ hàng trong ba bảng tài chính nằm trong khoảng 26/07 – 05/08/2026, và
 * từ đó tới nay không thêm hàng nào. Chọn 06/08 là chừa hẳn một ngày sau hàng
 * cuối cùng. **Có khách thật rồi thì không được lùi mốc này lên nữa** — lùi
 * lên là xoá nhãn khỏi dữ liệu thật của người ta.
 */
export const ERP_REAL_DATA_FROM = Date.UTC(2026, 7, 5, 17, 0, 0); // 06/08/2026 00:00 +07

export function erpFinanceDataOrigin(row: {
  data_origin?: unknown;
  id?: unknown;
  created_at?: unknown;
}): ErpDataOrigin {
  if (isErpDataOrigin(row.data_origin)) return row.data_origin;
  if (
    typeof row.id === "string" &&
    ERP_SEED_ID_PREFIXES.some((prefix) => row.id === undefined ? false : String(row.id).startsWith(prefix))
  ) {
    return "demo-seed";
  }
  if (typeof row.created_at === "string") {
    const at = Date.parse(row.created_at);
    // Ngày hỏng thì coi là thật: thà đếm dư còn hơn giấu mất một việc thật.
    if (!Number.isNaN(at) && at < ERP_REAL_DATA_FROM) return "test-residue";
  }
  return "real";
}

export function partitionErpDataOrigin<T extends { dataOrigin: ErpDataOrigin }>(
  records: readonly T[],
): { real: T[]; sample: T[] } {
  const real: T[] = [];
  const sample: T[] = [];
  for (const record of records) {
    if (record.dataOrigin === "real") real.push(record);
    else sample.push(record);
  }
  return { real, sample };
}
