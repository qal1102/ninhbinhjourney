import "server-only";

import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { ErpSiteId } from "@/domain/erp";
import { ERP_SHIFT_CLOSE_SITE_UUID_BY_SLUG } from "@/lib/erp/shift-close-repository";

const REPORT_COOKIE = "nbj-erp-demo-field-reports";
const STATE_SECONDS = 60 * 60 * 24 * 30;
const TENANT_ID = "00000000-0000-4000-8000-000000000001";
const EVIDENCE_BUCKET = "erp-field-reports";
const MAX_EVIDENCE_BYTES = 5 * 1024 * 1024;
const ALLOWED_EVIDENCE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

const SITE_SLUG_BY_UUID = new Map(
  Object.entries(ERP_SHIFT_CLOSE_SITE_UUID_BY_SLUG).map(([slug, uuid]) => [
    uuid,
    slug as ErpSiteId,
  ]),
);

const signingSecret =
  process.env.ERP_DEMO_SESSION_SECRET ??
  "destinationos-ninh-binh-demo-session-v1-change-before-live-data";

export type FieldReport = {
  id: string;
  siteId: ErpSiteId;
  area: string;
  category: string;
  task: string;
  employeeName: string;
  progress: number;
  status: string;
  note: string;
  financeCode: string;
  imageUrl: string | null;
  createdAt: string;
};

export type SubmitFieldReportInput = {
  siteId: ErpSiteId;
  area: string;
  category: string;
  task: string;
  employeeAccountId: string;
  employeeName: string;
  progress: 25 | 50 | 75 | 100;
  note: string;
  financeCode: string;
  file: File;
};

export class FieldReportRepositoryError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "FieldReportRepositoryError";
  }
}

type PersistenceMode = "supabase" | "demo-cookie";

function readMode(): PersistenceMode {
  const raw = process.env.ERP_PERSISTENCE_MODE?.trim();
  if (!raw) return "demo-cookie";
  if (raw === "supabase" || raw === "demo-cookie") return raw;
  throw new FieldReportRepositoryError(
    "ERP_PERSISTENCE_MODE chỉ nhận supabase hoặc demo-cookie.",
  );
}

function createAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const secret = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!url || !secret) {
    throw new FieldReportRepositoryError(
      "Kho dữ liệu báo cáo hiện trường chưa được cấu hình đủ ở phía máy chủ.",
    );
  }
  return createClient(url, secret, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
    global: { headers: { "X-Client-Info": "ninh-binh-journey-field-report-server" } },
  });
}

function repositoryError(
  operation: string,
  error: { message?: string; code?: string; details?: string } | null,
) {
  return new FieldReportRepositoryError(
    `Kho dữ liệu báo cáo hiện trường chưa hoàn tất bước ${operation}.`,
    {
      cause: error
        ? new Error([error.code, error.message, error.details].filter(Boolean).join(": "))
        : undefined,
    },
  );
}

function safeFileName(value: string) {
  return (
    value
      .normalize("NFKD")
      .replace(/[^\w.-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(-100) || "report.jpg"
  );
}

function computeStatus(progress: number) {
  return progress === 100 ? "Chờ quản lý xác nhận" : "Đang xử lý";
}

// --- demo-cookie mode -------------------------------------------------

function sign(payload: string) {
  return createHmac("sha256", signingSecret).update(payload).digest("base64url");
}

function encodeSigned(value: unknown) {
  const payload = Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function decodeSigned<T>(input: string | undefined): T | null {
  if (!input) return null;
  const [payload, signature, ...extra] = input.split(".");
  if (!payload || !signature || extra.length > 0) return null;
  const expected = sign(payload);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (
    actualBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(actualBuffer, expectedBuffer)
  ) {
    return null;
  }
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as T;
  } catch {
    return null;
  }
}

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/erp",
    maxAge,
  };
}

type CookieState = { version: 1; reportsBySite: Partial<Record<ErpSiteId, FieldReport[]>> };

function seedReports(siteId: ErpSiteId): FieldReport[] {
  const base = [
    { area: "Cổng bán vé A", category: "Đầu ca", task: "Mở quầy và kiểm tra thiết bị", employeeName: "Đỗ Thị Lan", progress: 100, status: "Đã xác nhận", note: "Hai máy quét hoạt động, tiền lẻ và ấn chỉ đã bàn giao đủ.", financeCode: "OPS-GATE-A" },
    { area: "Bến trung tâm", category: "Tiến độ", task: "Bổ sung biển phân luồng", employeeName: "Nguyễn Văn Hải", progress: 75, status: "Đang xử lý", note: "Đã lắp 3/4 biển; biển cuối chờ tổ kỹ thuật khoan chân đế.", financeCode: "OPS-FLOW-02" },
    { area: "Quầy hỗ trợ khách", category: "Kết quả", task: "Xử lý hàng chờ đoàn trường học", employeeName: "Trần Minh Anh", progress: 100, status: "Hoàn thành", note: "Đoàn 42 khách đã nhận đủ vòng và vào tuyến, không phát sinh hoàn vé.", financeCode: "CS-GROUP" },
  ] as const;
  return base.map((item, index) => ({
    id: `IMG-${String(842 + index * 38).padStart(4, "0")}`,
    siteId,
    ...item,
    imageUrl: null,
    createdAt: new Date(Date.now() - (base.length - index) * 3_600_000).toISOString(),
  }));
}

async function readCookieState(): Promise<CookieState> {
  const store = await cookies();
  const decoded = decodeSigned<CookieState>(store.get(REPORT_COOKIE)?.value);
  if (!decoded || decoded.version !== 1 || typeof decoded.reportsBySite !== "object") {
    return { version: 1, reportsBySite: {} };
  }
  return decoded;
}

async function writeCookieState(state: CookieState) {
  const store = await cookies();
  store.set(REPORT_COOKIE, encodeSigned(state), cookieOptions(STATE_SECONDS));
}

async function readCookieReports(siteId: ErpSiteId): Promise<FieldReport[]> {
  const state = await readCookieState();
  return state.reportsBySite[siteId] ?? seedReports(siteId);
}

async function submitInCookie(input: SubmitFieldReportInput): Promise<FieldReport> {
  const state = await readCookieState();
  const current = state.reportsBySite[input.siteId] ?? seedReports(input.siteId);
  const report: FieldReport = {
    id: `IMG-${String(852 + current.length).padStart(4, "0")}`,
    siteId: input.siteId,
    area: input.area,
    category: input.category,
    task: input.task,
    employeeName: input.employeeName,
    progress: input.progress,
    status: computeStatus(input.progress),
    note: input.note,
    financeCode: input.financeCode,
    // Local/demo mode has no real storage backend; the photo is not
    // persisted across requests here (only Supabase mode uploads it for
    // real). Metadata still persists so the report itself is not lost.
    imageUrl: null,
    createdAt: new Date().toISOString(),
  };
  state.reportsBySite[input.siteId] = [report, ...current].slice(0, 30);
  await writeCookieState(state);
  return report;
}

// --- supabase mode ------------------------------------------------------

function siteSlugFromUuid(value: unknown): ErpSiteId | null {
  if (typeof value !== "string") return null;
  return SITE_SLUG_BY_UUID.get(value) ?? null;
}

function reportFromRow(row: Record<string, unknown>): FieldReport | null {
  const siteId = siteSlugFromUuid(row.site_id);
  if (!siteId) return null;
  return {
    id: row.report_code as string,
    siteId,
    area: row.area as string,
    category: row.category as string,
    task: row.task as string,
    employeeName: row.employee_name as string,
    progress: row.progress as number,
    status: row.status as string,
    note: row.note as string,
    financeCode: row.finance_code as string,
    imageUrl: null,
    createdAt: row.created_at as string,
  };
}

async function attachSignedImages(
  client: SupabaseClient,
  rows: { report: FieldReport; storagePath: string | null }[],
) {
  const paths = [
    ...new Set(
      rows
        .map((item) => item.storagePath)
        .filter((path): path is string => Boolean(path)),
    ),
  ];
  if (paths.length === 0) return rows.map((item) => item.report);
  const result = await client.storage.from(EVIDENCE_BUCKET).createSignedUrls(paths, 60 * 10);
  const urlByPath = new Map(
    result.error ? [] : (result.data ?? []).map((item) => [item.path, item.signedUrl]),
  );
  return rows.map((item) =>
    item.storagePath && urlByPath.has(item.storagePath)
      ? { ...item.report, imageUrl: urlByPath.get(item.storagePath) ?? null }
      : item.report,
  );
}

async function readSupabaseReports(siteId: ErpSiteId): Promise<FieldReport[]> {
  const client = createAdminClient();
  const result = await client
    .from("erp_field_operation_reports")
    .select("report_code, site_id, area, category, task, employee_name, progress, status, note, finance_code, storage_path, created_at")
    .eq("tenant_id", TENANT_ID)
    .eq("site_id", ERP_SHIFT_CLOSE_SITE_UUID_BY_SLUG[siteId])
    .order("created_at", { ascending: false })
    .limit(50);
  if (result.error) {
    throw repositoryError("đọc báo cáo hiện trường", result.error);
  }
  const rows = (result.data ?? [])
    .map((row) => {
      const report = reportFromRow(row);
      return report ? { report, storagePath: row.storage_path as string | null } : null;
    })
    .filter((item): item is { report: FieldReport; storagePath: string | null } => item !== null);
  return attachSignedImages(client, rows);
}

async function submitInSupabase(input: SubmitFieldReportInput): Promise<FieldReport> {
  if (
    !ALLOWED_EVIDENCE_TYPES.has(input.file.type) ||
    input.file.size <= 0 ||
    input.file.size > MAX_EVIDENCE_BYTES
  ) {
    throw new FieldReportRepositoryError(
      "Ảnh phải là JPEG, PNG, WebP hoặc HEIC và không vượt quá 5 MB.",
    );
  }
  const client = createAdminClient();
  const body = Buffer.from(await input.file.arrayBuffer());
  const sha256 = createHash("sha256").update(body).digest("hex");
  const objectId = randomUUID();
  const fileName = safeFileName(input.file.name);
  const storagePath = `${input.siteId}/${input.employeeAccountId}/${objectId}-${fileName}`;
  const uploadResult = await client.storage.from(EVIDENCE_BUCKET).upload(storagePath, body, {
    contentType: input.file.type,
    upsert: false,
    cacheControl: "3600",
  });
  if (uploadResult.error) {
    throw repositoryError("tải ảnh báo cáo", uploadResult.error);
  }

  const result = await client.rpc("erp_submit_field_operation_report", {
    p_tenant_id: TENANT_ID,
    p_site_id: ERP_SHIFT_CLOSE_SITE_UUID_BY_SLUG[input.siteId],
    p_area: input.area,
    p_category: input.category,
    p_task: input.task,
    p_employee_account_id: input.employeeAccountId,
    p_employee_name: input.employeeName,
    p_progress: input.progress,
    p_note: input.note,
    p_finance_code: input.financeCode,
    p_storage_path: storagePath,
    p_mime_type: input.file.type,
    p_size_bytes: input.file.size,
    p_sha256: sha256,
  });
  if (result.error) {
    await client.storage.from(EVIDENCE_BUCKET).remove([storagePath]);
    throw repositoryError("lưu báo cáo hiện trường", result.error);
  }
  const row = (Array.isArray(result.data) ? result.data[0] : result.data) as Record<string, unknown>;
  const report = reportFromRow(row);
  if (!report) {
    throw new FieldReportRepositoryError("Cơ sở trong báo cáo hiện trường không hợp lệ.");
  }
  const [signed] = await attachSignedImages(client, [{ report, storagePath }]);
  return signed;
}

// --- public API -----------------------------------------------------------

export async function getFieldReports(siteId: ErpSiteId): Promise<FieldReport[]> {
  if (readMode() === "supabase") return readSupabaseReports(siteId);
  return readCookieReports(siteId);
}

export async function submitFieldReport(input: SubmitFieldReportInput): Promise<FieldReport> {
  if (readMode() === "supabase") return submitInSupabase(input);
  return submitInCookie(input);
}
