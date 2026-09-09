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
 * Bốn dấu hiệu, xét theo thứ tự từ chắc tới yếu:
 *
 *   1. Có cột `data_origin` thì tin cột (phòng khi sau này bảng nào đó có).
 *   2. Mã hàng mang tiền tố gieo sẵn — `61000000-`, `87000000-`, `88000000-`.
 *      Hàng thật dùng `gen_random_uuid()` nên không bao giờ trúng.
 *   3. Tạo trước mốc `ERP_REAL_DATA_FROM` thì là cặn của các lượt chạy thử.
 *   4. Ghi chú **mở đầu** bằng dấu bộ kiểm thử tự đặt — xem dưới.
 *
 * Vì sao cần dấu hiệu thứ ba: đo trên production 06/09/2026, sổ kế toán có
 * 11 hàng thì **chỉ 2 hàng mang tiền tố gieo sẵn**, 9 hàng còn lại mang mã
 * ngẫu nhiên vì chúng do các lượt chạy thử đi qua đúng quy trình tạo ra —
 * đúng thứ `AGENTS.md` cảnh báo. Không có gì trong cấu trúc phân biệt được
 * chúng với hàng thật, chỉ có thời gian.
 *
 * Vì sao cần cả dấu hiệu thứ tư: mốc thời gian chỉ che được quá khứ. Bộ kiểm
 * `prod-smoke-t10b-cash-reconciliation-roundtrip` chạy thẳng trên production,
 * mỗi lượt dựng một ca chốt và mấy bút toán mới tinh — mã ngẫu nhiên, giờ tạo
 * là hôm nay, tức là **sau** mốc. Nó có hoàn tác bút toán về net-zero, nhưng
 * hàng chốt ca thì ở lại. Không có dấu hiệu thứ tư thì mỗi lượt smoke lại thả
 * thêm một ca "thật" giả vào ô tiền của giám đốc, đúng kiểu trôi số mà
 * `AGENTS.md` kể ở vụ 02/08.
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

/**
 * Dấu mà bộ kiểm thử tự đặt vào ô ghi chú của hàng nó tạo trên production.
 *
 * Khuôn phải khớp đúng `QA-T10B-RT-` cộng 13 chữ số của `Date.now()`, và phải
 * **nằm ngay đầu ghi chú** — xem `tests/e2e/prod-smoke-t10b-cash-reconciliation-roundtrip.spec.ts`,
 * nơi mọi ô đều điền theo lối `${MARKER} — …`.
 *
 * **Chỗ yếu, nói thẳng ra chứ không giấu.** Ba dấu hiệu trên đứng ngoài tầm
 * với của người dùng: mã hàng do cơ sở dữ liệu sinh, giờ tạo do cơ sở dữ liệu
 * đóng, cột nhãn thì chưa có. Dấu này thì khác — nó nằm trong ô chữ tự do mà
 * nhân viên gõ được. Ai gõ trúng khuôn là ca thật của họ biến khỏi con số của
 * giám đốc, tức là lật ngược đúng nguyên tắc "thà đếm dư còn hơn giấu mất một
 * việc thật" mà cả tệp này đang giữ.
 *
 * Vẫn nhận, vì hai lẽ. Một, neo đầu chuỗi cộng đúng 13 chữ số làm việc gõ
 * trúng do vô ý gần như không xảy ra: một ghi chú thật có nhắc `QA-T10B-RT`
 * giữa câu vẫn là `real`, và chỉ người **cố ý** dựng đúng khuôn mới giấu được
 * ca của mình. Hai, đây là hệ demo, và cái giá của việc không nhận dấu thì đã
 * thấy rồi — ô tiền giám đốc nói dối sau mỗi lượt smoke.
 *
 * Đổi `MARKER` bên spec mà quên chỗ này là lỗ hổng mở lại trong im lặng, nên
 * có bài kiểm hợp đồng đọc thẳng tệp spec để khoá hai đầu lại với nhau.
 */
const ERP_TEST_MARKER_PATTERN = /^QA-T10B-RT-\d{13}(?!\d)/;

function hasErpTestMarker(notes: readonly unknown[]): boolean {
  return notes.some(
    (note) =>
      typeof note === "string" &&
      ERP_TEST_MARKER_PATTERN.test(note.trimStart()),
  );
}

/**
 * @param notes Các ô ghi chú của chính hàng ấy, để dò dấu bộ kiểm thử. Để
 *   trống thì hàm chạy y như trước: bảng nào không có ô ghi chú vẫn đúng.
 */
export function erpFinanceDataOrigin(
  row: {
    data_origin?: unknown;
    id?: unknown;
    created_at?: unknown;
  },
  notes: readonly unknown[] = [],
): ErpDataOrigin {
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
  // Xét sau cùng, vì đây là dấu hiệu yếu nhất — nó nằm trong ô chữ người dùng
  // gõ được, còn ba dấu hiệu trên thì không ai chạm tới được.
  if (hasErpTestMarker(notes)) return "test-residue";
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
