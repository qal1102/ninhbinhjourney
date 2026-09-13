/**
 * Bán vé tại quầy (QA-ERP-POS-04) — phần tính toán thuần, không chạm kho dữ
 * liệu.
 *
 * Màn hình dùng các hàm này để hiện tổng tiền, tiền thối và quyết định nút
 * "Xác nhận bán" có bấm được hay chưa. **Máy chủ không tin các con số này**:
 * `erp_create_counter_sale` tự tính lại tổng từ bảng giá đang hiệu lực. Nếu
 * màn hình và máy chủ lệch nhau, máy chủ đúng.
 */

export type CounterProduct = "adult" | "child";

export const COUNTER_PRODUCTS: readonly CounterProduct[] = ["adult", "child"];

export const COUNTER_PRODUCT_LABELS: Readonly<Record<CounterProduct, string>> = Object.freeze({
  adult: "Người lớn",
  child: "Trẻ dưới 1m3",
});

/** Trần một phiếu, khớp ràng buộc trong migration 069 và trần đoàn TC-15. */
export const COUNTER_SALE_MAX_PARTY = 45;

export type CounterPrice = {
  priceListId: string;
  product: CounterProduct;
  unitPriceVnd: number;
  effectiveFrom: string;
};

export type CounterCartLine = {
  product: CounterProduct;
  quantity: number;
  unitPriceVnd: number;
  lineTotalVnd: number;
};

export type CounterCart = {
  lines: CounterCartLine[];
  totalVnd: number;
  partySize: number;
  /** Loại vé có khách chọn mà quầy chưa có giá. Có thì không bán được. */
  missingPrices: CounterProduct[];
};

function soNguyenKhongAm(value: number) {
  return Number.isFinite(value) && value > 0 ? Math.trunc(value) : 0;
}

export function computeCounterCart(input: {
  adults: number;
  children: number;
  prices: readonly CounterPrice[];
}): CounterCart {
  const soLuong: Record<CounterProduct, number> = {
    adult: soNguyenKhongAm(input.adults),
    child: soNguyenKhongAm(input.children),
  };
  const lines: CounterCartLine[] = [];
  const missingPrices: CounterProduct[] = [];
  for (const product of COUNTER_PRODUCTS) {
    const quantity = soLuong[product];
    if (quantity === 0) continue;
    const price = input.prices.find((item) => item.product === product);
    if (!price) {
      missingPrices.push(product);
      continue;
    }
    lines.push({
      product,
      quantity,
      unitPriceVnd: price.unitPriceVnd,
      lineTotalVnd: price.unitPriceVnd * quantity,
    });
  }
  return {
    lines,
    totalVnd: lines.reduce((sum, line) => sum + line.lineTotalVnd, 0),
    partySize: soLuong.adult + soLuong.child,
    missingPrices,
  };
}

/**
 * Tiền thối. `null` khi khách đưa chưa đủ — màn hình phải nói "còn thiếu",
 * không được hiện một con số âm như thể quầy phải thối tiền âm.
 */
export function counterChange(cashReceivedVnd: number, totalVnd: number): number | null {
  if (!Number.isFinite(cashReceivedVnd) || cashReceivedVnd < totalVnd) return null;
  return cashReceivedVnd - totalVnd;
}

/**
 * Gợi ý số tiền khách hay đưa: đúng bằng tổng, rồi làm tròn lên các mệnh giá
 * tiền giấy thường gặp. Bấm một nút thay vì gõ sáu chữ số giữa lúc khách xếp
 * hàng — gõ tay là chỗ sai lệch tiền dễ sinh ra nhất.
 */
export function counterCashSuggestions(totalVnd: number): number[] {
  if (!Number.isFinite(totalVnd) || totalVnd <= 0) return [];
  const moc = [50_000, 100_000, 200_000, 500_000, 1_000_000];
  const goiY = new Set<number>([totalVnd]);
  for (const buoc of moc) {
    const lamTron = Math.ceil(totalVnd / buoc) * buoc;
    if (lamTron > totalVnd) goiY.add(lamTron);
  }
  return [...goiY].sort((a, b) => a - b).slice(0, 4);
}

export type CounterSaleReadiness =
  | { ok: true }
  | { ok: false; reason: string };

/**
 * Nút "Xác nhận bán" chỉ bấm được khi đủ cả bốn điều. Mỗi lý do là một câu
 * nói thẳng còn thiếu gì, để nhân viên không phải đoán vì sao nút bị khoá.
 */
export function counterSaleReadiness(input: {
  cart: CounterCart;
  cashReceivedVnd: number;
  cashCountedConfirmed: boolean;
}): CounterSaleReadiness {
  const { cart } = input;
  if (cart.partySize === 0) return { ok: false, reason: "Chọn số vé trước đã." };
  if (cart.partySize > COUNTER_SALE_MAX_PARTY) {
    return {
      ok: false,
      reason: `Một phiếu tối đa ${COUNTER_SALE_MAX_PARTY} khách. Đoàn đông hơn xin tách làm hai phiếu.`,
    };
  }
  if (cart.missingPrices.length > 0) {
    return {
      ok: false,
      reason: `Quầy chưa có giá cho ${cart.missingPrices.map((p) => COUNTER_PRODUCT_LABELS[p].toLowerCase()).join(", ")}. Xin báo quản lý.`,
    };
  }
  if (counterChange(input.cashReceivedVnd, cart.totalVnd) === null) {
    return { ok: false, reason: "Số tiền khách đưa chưa đủ tổng." };
  }
  if (!input.cashCountedConfirmed) {
    return { ok: false, reason: "Đếm tiền, bỏ vào quỹ, rồi đánh dấu xác nhận." };
  }
  return { ok: true };
}

export type CounterSaleReceiptLine = {
  product: CounterProduct;
  quantity: number;
  unitPriceVnd: number;
  lineTotalVnd: number;
  ticketCode: string;
  entriesAllowed: number;
  entriesUsed: number;
  ticketStatus: string;
};

export type CounterSaleReceipt = {
  saleCode: string;
  siteUuid: string;
  soldByAccountId: string;
  soldByName: string;
  actingDirectorAccountId: string | null;
  soldAt: string;
  businessDate: string;
  adults: number;
  children: number;
  totalVnd: number;
  cashReceivedVnd: number;
  changeVnd: number;
  status: "completed" | "voided";
  voidedByName: string | null;
  voidedAt: string | null;
  voidReason: string | null;
  lines: CounterSaleReceiptLine[];
};

function chuoiHoacNull(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function parseCounterSaleReceipt(value: unknown): CounterSaleReceipt | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const saleCode = chuoiHoacNull(row.sale_code);
  if (!saleCode) return null;
  const lines = Array.isArray(row.lines) ? row.lines : [];
  return {
    saleCode,
    siteUuid: String(row.site_id ?? ""),
    soldByAccountId: String(row.sold_by_account_id ?? ""),
    soldByName: String(row.sold_by_name ?? ""),
    actingDirectorAccountId: chuoiHoacNull(row.acting_director_account_id),
    soldAt: String(row.sold_at ?? ""),
    businessDate: String(row.business_date ?? ""),
    adults: Number(row.adults ?? 0),
    children: Number(row.children ?? 0),
    totalVnd: Number(row.total_vnd ?? 0),
    cashReceivedVnd: Number(row.cash_received_vnd ?? 0),
    changeVnd: Number(row.change_vnd ?? 0),
    status: row.status === "voided" ? "voided" : "completed",
    voidedByName: chuoiHoacNull(row.voided_by_name),
    voidedAt: chuoiHoacNull(row.voided_at),
    voidReason: chuoiHoacNull(row.void_reason),
    lines: lines.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const line = item as Record<string, unknown>;
      const product = line.product === "child" ? "child" : line.product === "adult" ? "adult" : null;
      if (!product) return [];
      return [
        {
          product,
          quantity: Number(line.quantity ?? 0),
          unitPriceVnd: Number(line.unit_price_vnd ?? 0),
          lineTotalVnd: Number(line.line_total_vnd ?? 0),
          ticketCode: String(line.ticket_code ?? ""),
          entriesAllowed: Number(line.entries_allowed ?? 0),
          entriesUsed: Number(line.entries_used ?? 0),
          ticketStatus: String(line.ticket_status ?? ""),
        },
      ];
    }),
  };
}

export function parseCounterPrices(value: unknown): CounterPrice[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    const product = row.product === "adult" || row.product === "child" ? row.product : null;
    const unitPriceVnd = Number(row.unit_price_vnd);
    if (!product || !Number.isFinite(unitPriceVnd) || unitPriceVnd < 0) return [];
    return [
      {
        priceListId: String(row.price_list_id ?? ""),
        product,
        unitPriceVnd,
        effectiveFrom: String(row.effective_from ?? ""),
      },
    ];
  });
}

/**
 * Câu tiếng Việt cho từng mã lỗi máy chủ trả về. Mã lạ thì trả một câu chung,
 * không bao giờ in mã ra màn hình.
 */
export const COUNTER_SALE_ERROR_MESSAGES: Readonly<Record<string, string>> = Object.freeze({
  COUNTER_SALE_INPUT_INVALID: "Số vé hoặc số tiền chưa hợp lệ. Xin kiểm tra lại rồi bấm lần nữa.",
  COUNTER_SALE_ACTOR_REQUIRED: "Tài khoản này chưa được phân công bán vé tại cơ sở này.",
  COUNTER_SALE_CASH_NOT_CONFIRMED: "Chưa đánh dấu đã đếm tiền và bỏ vào quỹ, nên phiếu chưa được lưu.",
  COUNTER_SALE_CASH_SHORT: "Số tiền khách đưa chưa đủ tổng theo bảng giá hôm nay.",
  COUNTER_SALE_PRICE_MISSING: "Quầy chưa có giá cho loại vé này. Xin báo quản lý.",
  COUNTER_SALE_VOID_REASON_REQUIRED: "Xin ghi lý do huỷ, ít nhất mười ký tự.",
  COUNTER_SALE_VOID_NOT_ALLOWED: "Chỉ quản lý cơ sở hoặc giám đốc được huỷ vé.",
  COUNTER_SALE_VOID_OWN_SALE: "Không huỷ được phiếu do chính mình bán. Xin nhờ một quản lý khác.",
  COUNTER_SALE_VOID_DAY_CLOSED: "Phiếu của ngày trước đã vào chốt ca, không huỷ ở đây được. Xin làm điều chỉnh qua kế toán.",
  COUNTER_SALE_ALREADY_ADMITTED: "Vé của phiếu này đã quét qua cổng, nên không huỷ được.",
  COUNTER_SALE_NOT_FOUND: "Không tìm thấy phiếu này ở cơ sở đang xem.",
  GATE_SCAN_SITE_TENANT_MISMATCH: "Cơ sở không hợp lệ.",
});

export function counterSaleErrorMessage(raw: string): string {
  for (const [ma, cau] of Object.entries(COUNTER_SALE_ERROR_MESSAGES)) {
    if (raw.includes(ma)) return cau;
  }
  return "Chưa lưu được phiếu. Xin thử lại; nếu vẫn vậy thì báo bộ phận kỹ thuật.";
}

export function formatVnd(value: number) {
  return `${new Intl.NumberFormat("vi-VN").format(value)} đ`;
}
