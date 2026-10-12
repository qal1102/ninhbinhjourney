import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { ERP_SITES, type ErpSiteId } from "@/domain/erp";
import {
  parseCounterPriceHistory,
  parseCounterPrices,
  parseCounterSaleReceipt,
  parseTravelCompanyHistory,
  parseTravelCompanyStanding,
  type CounterPaymentMethod,
  type CounterPrice,
  type CounterPriceHistoryRow,
  type CounterProduct,
  type CounterSaleReceipt,
  type TravelCompanyHistoryRow,
  type TravelCompanyStanding,
} from "@/domain/erp-counter-sale";
import { findRpcBusinessMessage } from "@/lib/erp/rpc-error-messages";
import { ERP_SHIFT_CLOSE_SITE_UUID_BY_SLUG } from "@/lib/erp/shift-close-repository";

/**
 * QA-ERP-POS-04 — bán vé tại quầy.
 *
 * Mọi quyết định về quyền, giá và tiền nằm ở PostgreSQL (migration 069):
 * `erp_create_counter_sale`, `erp_void_counter_sale`,
 * `erp_counter_sales_for_day`, `erp_counter_current_prices`. Tệp này chỉ gọi
 * và đọc kết quả. Không có đường bán nào chạy trong bộ nhớ hay cookie: một
 * phiếu thu tiền mà không nằm trong kho thì không có ai chịu trách nhiệm về
 * nó, nên chế độ dữ liệu mẫu nói thẳng là chưa bán được.
 */

const TENANT_ID = "00000000-0000-4000-8000-000000000001";

export class CounterSaleRepositoryError extends Error {
  constructor(
    message: string,
    readonly code: "CONFIGURATION_MISSING" | "REJECTED",
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "CounterSaleRepositoryError";
  }
}

function createAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const secret = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!url || !secret) {
    throw new CounterSaleRepositoryError(
      "Quầy bán vé chưa nối được vào kho dữ liệu ở môi trường này, nên chưa bán được vé.",
      "CONFIGURATION_MISSING",
    );
  }
  return createClient(url, secret, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
    global: { headers: { "X-Client-Info": "ninh-binh-journey-counter-sale" } },
  });
}

function tuChoi(error: unknown): CounterSaleRepositoryError {
  // Câu lỗi lấy từ bảng dùng chung của cả ERP; mã lạ thì một câu chung,
  // không bao giờ in mã máy ra màn hình.
  const message =
    findRpcBusinessMessage(error) ??
    "Chưa lưu được phiếu. Xin thử lại; nếu vẫn vậy thì báo bộ phận kỹ thuật.";
  return new CounterSaleRepositoryError(message, "REJECTED", {
    cause: error instanceof Error ? error : undefined,
  });
}

function vietnamToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());
}

/** Người được ghi là "người mời" của vé mời: tài khoản đang làm việc. */
export type NguoiMoi = { id: string; name: string; title: string };

export type CounterSaleWorkspace =
  | {
      available: true;
      prices: CounterPrice[];
      sales: CounterSaleReceipt[];
      /** Công ty lữ hành kèm số đoàn trong năm và mức ưu đãi (migration 118). */
      congTy: TravelCompanyStanding[];
      /** Trang điền sau từ danh bạ nhân sự. */
      nguoiMoi: NguoiMoi[];
    }
  | { available: false; message: string };

/**
 * Bảng giá và phiếu bán hôm nay của một cơ sở. Kho chưa trả lời thì nói thật
 * là chưa bán được, không hiện một bảng giá rỗng như thể quầy chưa có giá.
 */
export async function getCounterSaleWorkspace(input: {
  siteId: ErpSiteId;
  viewerAccountId: string;
}): Promise<CounterSaleWorkspace> {
  let client: SupabaseClient;
  try {
    client = createAdminClient();
  } catch (error) {
    return {
      available: false,
      message:
        error instanceof CounterSaleRepositoryError
          ? error.message
          : "Quầy bán vé chưa nối được vào kho dữ liệu.",
    };
  }
  const siteUuid = ERP_SHIFT_CLOSE_SITE_UUID_BY_SLUG[input.siteId];
  const [prices, sales, congTy] = await Promise.all([
    client.rpc("erp_counter_current_prices", { p_tenant_id: TENANT_ID, p_site_id: siteUuid }),
    client.rpc("erp_counter_sales_for_day", {
      p_tenant_id: TENANT_ID,
      p_site_id: siteUuid,
      p_viewer_account_id: input.viewerAccountId,
      p_business_date: vietnamToday(),
    }),
    // Kho chưa có migration 118 thì quầy vẫn bán vé lẻ được, chỉ thiếu danh sách công ty.
    client.rpc("erp_travel_companies_list", { p_tenant_id: TENANT_ID }),
  ]);
  if (prices.error || sales.error) {
    const error = prices.error ?? sales.error;
    console.error("Counter sale workspace read failed", error);
    const raw = error?.message ?? "";
    return {
      available: false,
      message: raw.includes("COUNTER_SALE_ACTOR_REQUIRED")
        ? "Tài khoản này chưa được phân công bán vé tại cơ sở này."
        : "Chưa đọc được bảng giá quầy. Xin tải lại trang; nếu vẫn vậy thì báo bộ phận kỹ thuật.",
    };
  }
  return {
    available: true,
    prices: parseCounterPrices(prices.data),
    sales: Array.isArray(sales.data)
      ? sales.data.flatMap((item) => {
          const receipt = parseCounterSaleReceipt(item);
          return receipt ? [receipt] : [];
        })
      : [],
    congTy:
      !congTy.error && Array.isArray(congTy.data)
        ? congTy.data.flatMap((item) => parseTravelCompanyStanding(item) ?? [])
        : [],
    nguoiMoi: [],
  };
}

export async function createCounterSale(input: {
  siteId: ErpSiteId;
  actorAccountId: string;
  actorName: string;
  actingDirectorAccountId: string | null;
  adults: number;
  children: number;
  paymentMethod: CounterPaymentMethod;
  cashReceivedVnd: number;
  paymentReference: string | null;
  cashCountedConfirmed: boolean;
  requestKey: string;
}): Promise<CounterSaleReceipt> {
  const client = createAdminClient();
  const { data, error } = await client.rpc("erp_create_counter_sale", {
    p_tenant_id: TENANT_ID,
    p_site_id: ERP_SHIFT_CLOSE_SITE_UUID_BY_SLUG[input.siteId],
    p_actor_account_id: input.actorAccountId,
    p_actor_name: input.actorName,
    p_acting_director_account_id: input.actingDirectorAccountId,
    p_adults: input.adults,
    p_children: input.children,
    p_payment_method: input.paymentMethod,
    p_cash_received_vnd: input.cashReceivedVnd,
    p_payment_reference: input.paymentReference,
    p_cash_counted_confirmed: input.cashCountedConfirmed,
    p_request_key: input.requestKey,
  });
  if (error) throw tuChoi(error);
  const receipt = parseCounterSaleReceipt(data);
  if (!receipt) throw tuChoi(new Error("COUNTER_SALE_EMPTY_RESPONSE"));
  return receipt;
}

export async function voidCounterSale(input: {
  siteId: ErpSiteId;
  actorAccountId: string;
  actorName: string;
  actingDirectorAccountId: string | null;
  saleCode: string;
  reason: string;
}): Promise<CounterSaleReceipt> {
  const client = createAdminClient();
  const { data, error } = await client.rpc("erp_void_counter_sale", {
    p_tenant_id: TENANT_ID,
    p_site_id: ERP_SHIFT_CLOSE_SITE_UUID_BY_SLUG[input.siteId],
    p_actor_account_id: input.actorAccountId,
    p_actor_name: input.actorName,
    p_acting_director_account_id: input.actingDirectorAccountId,
    p_sale_code: input.saleCode,
    p_reason: input.reason,
  });
  if (error) throw tuChoi(error);
  const receipt = parseCounterSaleReceipt(data);
  if (!receipt) throw tuChoi(new Error("COUNTER_SALE_EMPTY_RESPONSE"));
  return receipt;
}

export type CounterPriceBoardSite = {
  siteId: ErpSiteId;
  siteName: string;
  prices: CounterPrice[];
  history: CounterPriceHistoryRow[];
};

export type CounterPriceBoard =
  | { available: true; sites: CounterPriceBoardSite[] }
  | { available: false; message: string };

/**
 * QA-ERP-POS-05 — bảng giá quầy của cả bốn cơ sở cho màn hình giám đốc: giá
 * đang áp và lịch sử những lần đặt. Kho chưa trả lời thì nói thật, không hiện
 * một bảng giá rỗng như thể chưa ai đặt giá.
 */
export async function getCounterPriceBoard(): Promise<CounterPriceBoard> {
  let client: SupabaseClient;
  try {
    client = createAdminClient();
  } catch (error) {
    return {
      available: false,
      message:
        error instanceof CounterSaleRepositoryError
          ? "Bảng giá quầy chưa nối được vào kho dữ liệu ở môi trường này."
          : "Chưa đọc được bảng giá quầy.",
    };
  }
  const ketQua = await Promise.all(
    ERP_SITES.map(async (site) => {
      const siteUuid = ERP_SHIFT_CLOSE_SITE_UUID_BY_SLUG[site.id];
      const [prices, history] = await Promise.all([
        client.rpc("erp_counter_current_prices", { p_tenant_id: TENANT_ID, p_site_id: siteUuid }),
        client.rpc("erp_counter_price_history", { p_tenant_id: TENANT_ID, p_site_id: siteUuid, p_limit: 20 }),
      ]);
      return { site, prices, history };
    }),
  );
  const loi = ketQua.find((item) => item.prices.error || item.history.error);
  if (loi) {
    console.error("Counter price board read failed", loi.prices.error ?? loi.history.error);
    return {
      available: false,
      message: "Chưa đọc được bảng giá quầy. Xin tải lại trang; nếu vẫn vậy thì báo bộ phận kỹ thuật.",
    };
  }
  return {
    available: true,
    sites: ketQua.map(({ site, prices, history }) => ({
      siteId: site.id,
      siteName: site.shortName,
      prices: parseCounterPrices(prices.data),
      history: parseCounterPriceHistory(history.data),
    })),
  };
}

export async function setCounterPrice(input: {
  siteId: ErpSiteId;
  actorAccountId: string;
  actorName: string;
  product: CounterProduct;
  unitPriceVnd: number;
  effectiveFrom: string;
  note: string;
}): Promise<CounterPrice[]> {
  const client = createAdminClient();
  const { data, error } = await client.rpc("erp_set_counter_price", {
    p_tenant_id: TENANT_ID,
    p_site_id: ERP_SHIFT_CLOSE_SITE_UUID_BY_SLUG[input.siteId],
    p_actor_account_id: input.actorAccountId,
    p_actor_name: input.actorName,
    p_product: input.product,
    p_unit_price_vnd: input.unitPriceVnd,
    p_effective_from: input.effectiveFrom,
    p_note: input.note,
  });
  if (error) {
    const message =
      findRpcBusinessMessage(error) ??
      "Chưa lưu được giá mới. Xin thử lại; nếu vẫn vậy thì báo bộ phận kỹ thuật.";
    throw new CounterSaleRepositoryError(message, "REJECTED", {
      cause: error instanceof Error ? error : undefined,
    });
  }
  return parseCounterPrices(data);
}

/**
 * Tìm một phiếu quầy trong ngày (12/10/2026), cho mã QR khách quét
 * (`lib/erp/phieu-quay.ts`).
 *
 * Bảng `erp_counter_sales` không cho đọc thẳng, kể cả bằng khoá máy chủ, nên
 * đi qua đúng hàm màn quầy đang dùng: danh sách phiếu trong ngày mà người xem
 * được thấy. Tìm theo mã phiếu, hoặc theo nội dung chuyển khoản sinh từ khoá
 * phiếu (`counterPaymentReference`). Không thấy thì trả `null`.
 */
export async function findCounterSale(input: {
  siteId: ErpSiteId;
  viewerAccountId: string;
  businessDate: string;
  saleCode?: string;
  paymentReference?: string;
}): Promise<CounterSaleReceipt | null> {
  const client = createAdminClient();
  const { data, error } = await client.rpc("erp_counter_sales_for_day", {
    p_tenant_id: TENANT_ID,
    p_site_id: ERP_SHIFT_CLOSE_SITE_UUID_BY_SLUG[input.siteId],
    p_viewer_account_id: input.viewerAccountId,
    p_business_date: input.businessDate,
  });
  if (error) throw tuChoi(error);
  const receipts = Array.isArray(data) ? data.flatMap((item) => parseCounterSaleReceipt(item) ?? []) : [];
  return (
    receipts.find((receipt) =>
      input.saleCode
        ? receipt.saleCode === input.saleCode
        : input.paymentReference
          ? receipt.paymentMethod === "qr-transfer" && receipt.paymentReference === input.paymentReference
          : false,
    ) ?? null
  );
}

/** Ngày bán theo giờ Việt Nam của một thời điểm. */
export function ngayBanVietNam(millis: number): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(millis));
}

/**
 * Vé đoàn trả tiền ngay ở quầy (migration 118). Một phiếu bán, một tấm vé
 * giữ đủ lượt, và đoàn treo đúng vào tấm vé ấy. Giá và ưu đãi do kho tính.
 */
export async function createCounterGroupSale(input: {
  siteId: ErpSiteId;
  actorAccountId: string;
  actorName: string;
  actingDirectorAccountId: string | null;
  partySize: number;
  groupLabel: string;
  leaderName: string;
  leaderPhone: string | null;
  travelCompanyId: string | null;
  invoiceRequested: boolean;
  paymentMethod: "cash" | "qr-transfer";
  cashReceivedVnd: number;
  paymentReference: string | null;
  cashCountedConfirmed: boolean;
  requestKey: string;
}): Promise<CounterSaleReceipt> {
  const client = createAdminClient();
  const { data, error } = await client.rpc("erp_create_counter_group_sale", {
    p_tenant_id: TENANT_ID,
    p_site_id: ERP_SHIFT_CLOSE_SITE_UUID_BY_SLUG[input.siteId],
    p_actor_account_id: input.actorAccountId,
    p_actor_name: input.actorName,
    p_acting_director_account_id: input.actingDirectorAccountId,
    p_party_size: input.partySize,
    p_group_label: input.groupLabel,
    p_leader_name: input.leaderName,
    p_leader_phone: input.leaderPhone,
    p_travel_company_id: input.travelCompanyId,
    p_invoice_requested: input.invoiceRequested,
    p_payment_method: input.paymentMethod,
    p_cash_received_vnd: input.cashReceivedVnd,
    p_payment_reference: input.paymentReference,
    p_cash_counted_confirmed: input.cashCountedConfirmed,
    p_request_key: input.requestKey,
  });
  if (error) throw tuChoi(error);
  const receipt = parseCounterSaleReceipt(data);
  if (!receipt) throw tuChoi(new Error("COUNTER_SALE_EMPTY_RESPONSE"));
  return receipt;
}

/** Vé mời 0 đ: người mời là một tài khoản trong sổ, tên do kho lấy từ sổ. */
export async function createCounterCompSale(input: {
  siteId: ErpSiteId;
  actorAccountId: string;
  actorName: string;
  actingDirectorAccountId: string | null;
  adults: number;
  children: number;
  inviterAccountId: string;
  reason: string;
  requestKey: string;
}): Promise<CounterSaleReceipt> {
  const client = createAdminClient();
  const { data, error } = await client.rpc("erp_create_counter_comp_sale", {
    p_tenant_id: TENANT_ID,
    p_site_id: ERP_SHIFT_CLOSE_SITE_UUID_BY_SLUG[input.siteId],
    p_actor_account_id: input.actorAccountId,
    p_actor_name: input.actorName,
    p_acting_director_account_id: input.actingDirectorAccountId,
    p_adults: input.adults,
    p_children: input.children,
    p_inviter_account_id: input.inviterAccountId,
    p_reason: input.reason,
    p_request_key: input.requestKey,
  });
  if (error) throw tuChoi(error);
  const receipt = parseCounterSaleReceipt(data);
  if (!receipt) throw tuChoi(new Error("COUNTER_SALE_EMPTY_RESPONSE"));
  return receipt;
}

export async function listTravelCompanies(): Promise<TravelCompanyStanding[]> {
  let client: SupabaseClient;
  try {
    client = createAdminClient();
  } catch {
    return [];
  }
  const { data, error } = await client.rpc("erp_travel_companies_list", { p_tenant_id: TENANT_ID });
  if (error) {
    console.error("Travel companies read failed", error);
    return [];
  }
  return Array.isArray(data) ? data.flatMap((item) => parseTravelCompanyStanding(item) ?? []) : [];
}

export async function createTravelCompany(input: {
  siteId: ErpSiteId;
  actorAccountId: string;
  name: string;
  taxCode: string | null;
  address: string;
  invoiceEmail: string | null;
  phone: string | null;
  contactName: string;
}): Promise<TravelCompanyStanding> {
  const client = createAdminClient();
  const { data, error } = await client.rpc("erp_create_travel_company", {
    p_tenant_id: TENANT_ID,
    p_site_id: ERP_SHIFT_CLOSE_SITE_UUID_BY_SLUG[input.siteId],
    p_actor_account_id: input.actorAccountId,
    p_name: input.name,
    p_tax_code: input.taxCode,
    p_address: input.address,
    p_invoice_email: input.invoiceEmail,
    p_phone: input.phone,
    p_contact_name: input.contactName,
  });
  if (error) throw tuChoi(error);
  const company = parseTravelCompanyStanding(data);
  if (!company) throw tuChoi(new Error("TRAVEL_COMPANY_EMPTY_RESPONSE"));
  return company;
}

export async function setTravelCompanyDiscount(input: {
  actorAccountId: string;
  companyId: string;
  percent: number | null;
}): Promise<TravelCompanyStanding> {
  const client = createAdminClient();
  const { data, error } = await client.rpc("erp_set_travel_company_discount", {
    p_tenant_id: TENANT_ID,
    p_actor_account_id: input.actorAccountId,
    p_company_id: input.companyId,
    p_percent: input.percent,
  });
  if (error) throw tuChoi(error);
  const company = parseTravelCompanyStanding(data);
  if (!company) throw tuChoi(new Error("TRAVEL_COMPANY_EMPTY_RESPONSE"));
  return company;
}

export async function travelCompanyHistory(companyId: string): Promise<TravelCompanyHistoryRow[]> {
  const client = createAdminClient();
  const { data, error } = await client.rpc("erp_travel_company_history", {
    p_tenant_id: TENANT_ID,
    p_company_id: companyId,
    p_limit: 100,
  });
  if (error) throw tuChoi(error);
  return parseTravelCompanyHistory(data);
}
