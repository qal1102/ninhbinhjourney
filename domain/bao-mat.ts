/**
 * Luật bảo mật tầng HTTP dùng chung cho `proxy.ts` và `next.config.ts`.
 *
 * Ba việc, đều là hàm thuần để kiểm được bằng bài test:
 * 1. Dựng Content-Security-Policy có nonce riêng cho từng lượt tải trang.
 *    Gần như mọi trang đã dựng động (đọc cookie ngôn ngữ), nên nonce không
 *    làm mất trang tĩnh nào đáng kể.
 * 2. Chọn hạn mức lượt gọi cho từng nhóm API (theo địa chỉ máy).
 * 3. Nhận ra lệnh ghi gửi từ trang khác (chống CSRF ở tầng chung).
 */

/** Nguồn ngoài trình duyệt được tải: nền bản đồ, độ cao, ảnh vệ tinh. */
const NGUON_BAN_DO = [
  "https://tiles.openfreemap.org",
  "https://tiles.mapterhorn.com",
  "https://api.maptiler.com",
] as const;

const NGUON_KHUNG = ["https://www.youtube-nocookie.com"] as const;

export const DUONG_BAO_CAO_CSP = "/api/bao-cao-csp";

export type TuyChonCsp = {
  nonce: string;
  /** `next dev` cần `unsafe-eval` để React dựng lại ngăn xếp lỗi. */
  dangPhatTrien: boolean;
  /** Địa chỉ Supabase (`NEXT_PUBLIC_SUPABASE_URL`) cho Realtime và REST. */
  supabaseUrl?: string;
  /** Chỉ bật trên Vercel: ở máy chạy http://localhost, nâng https sẽ gãy trang. */
  nangHttps: boolean;
};

function nguonSupabase(url: string | undefined): string[] {
  if (!url) return [];
  try {
    const goc = new URL(url);
    if (goc.protocol !== "https:" && goc.protocol !== "http:") return [];
    const ws = goc.protocol === "https:" ? "wss:" : "ws:";
    return [goc.origin, `${ws}//${goc.host}`];
  } catch {
    return [];
  }
}

export function dungCsp(t: TuyChonCsp): string {
  const chiThi: Array<[string, string[]]> = [
    ["default-src", ["'self'"]],
    // `strict-dynamic`: chỉ thẻ script mang nonce (Next tự gắn) và script do
    // chúng nạp mới chạy; `'self'` để lại cho trình duyệt cũ chưa hiểu nó.
    ["script-src", ["'self'", `'nonce-${t.nonce}'`, "'strict-dynamic'", ...(t.dangPhatTrien ? ["'unsafe-eval'"] : [])]],
    // React và MapLibre đặt style trực tiếp trên phần tử; nonce ở đây sẽ làm
    // trình duyệt bỏ qua `unsafe-inline` và chặn hết thuộc tính style.
    ["style-src", ["'self'", "'unsafe-inline'"]],
    ["img-src", ["'self'", "data:", "blob:", ...NGUON_BAN_DO]],
    ["font-src", ["'self'", "data:"]],
    ["connect-src", ["'self'", ...nguonSupabase(t.supabaseUrl), ...NGUON_BAN_DO]],
    // MapLibre dựng worker từ blob.
    ["worker-src", ["'self'", "blob:"]],
    ["frame-src", ["'self'", ...NGUON_KHUNG]],
    ["media-src", ["'self'", "data:", "blob:"]],
    ["manifest-src", ["'self'"]],
    ["object-src", ["'none'"]],
    ["base-uri", ["'self'"]],
    ["form-action", ["'self'"]],
    ["frame-ancestors", ["'none'"]],
  ];
  const dong = chiThi.map(([ten, gt]) => `${ten} ${gt.join(" ")}`);
  if (t.nangHttps) dong.push("upgrade-insecure-requests");
  dong.push(`report-uri ${DUONG_BAO_CAO_CSP}`);
  return dong.join("; ");
}

/** Đầu trang cố định cho mọi đường dẫn, đặt trong `next.config.ts`. */
export const DAU_TRANG_BAO_MAT: ReadonlyArray<{ key: string; value: string }> = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
  {
    key: "Permissions-Policy",
    // Máy ảnh: quét vé, chụp sự cố, giấy tờ. Micro: ghi việc bằng giọng nói.
    // Định vị: thuyết minh theo vị trí, báo khẩn cấp, chấm công. Bluetooth: máy in phiếu.
    value: [
      "camera=(self)",
      "microphone=(self)",
      "geolocation=(self)",
      "bluetooth=(self)",
      "fullscreen=(self)",
      "screen-wake-lock=(self)",
      "web-share=(self)",
      "payment=()",
      "usb=()",
      "serial=()",
      "hid=()",
      "midi=()",
      "magnetometer=()",
      "gyroscope=()",
      "accelerometer=()",
      "browsing-topics=()",
    ].join(", "),
  },
];

export type NhomGioiHan = {
  ten: string;
  toiDa: number;
  cuaSoGiay: number;
};

const MUOI_PHUT = 600;

/**
 * Hạn mức cho mỗi địa chỉ máy trong 10 phút. Đặt rộng tay vì nhiều khách có
 * thể chung một địa chỉ (kiosk, Wi-Fi ở bến) và nhân viên một cơ sở chung
 * mạng; đủ để chặn gửi dồn, không chạm người dùng thật.
 */
const BANG_NHOM: ReadonlyArray<{ khop: (duong: string) => boolean; nhom: NhomGioiHan }> = [
  { khop: (d) => d === "/api/customer-events", nhom: { ten: "su-kien-trang", toiDa: 600, cuaSoGiay: MUOI_PHUT } },
  {
    // Gọi mô hình AI tốn hạn mức khoá; chặn chặt nhất.
    khop: (d) => ["/api/hoi-dap", "/api/erp/assistant", "/api/erp/hoi-dap", "/api/erp/soat-giay-to", "/api/erp/van-ban/soat"].includes(d),
    nhom: { ten: "ai", toiDa: 40, cuaSoGiay: MUOI_PHUT },
  },
  {
    // Giữ chỗ chiếm chỗ trống 15 phút mỗi lượt: gửi dồn là chặn khách thật.
    khop: (d) => d.startsWith("/api/customer-booking-"),
    nhom: { ten: "dat-cho", toiDa: 40, cuaSoGiay: MUOI_PHUT },
  },
  {
    // Ô nhận số điện thoại: chặn dò số hàng loạt.
    khop: (d) => ["/api/customer-ticket-lookup", "/api/khach-than-thiet", "/api/ho-so", "/api/thi-anh", "/api/su-kien"].includes(d),
    nhom: { ten: "tra-so", toiDa: 30, cuaSoGiay: MUOI_PHUT },
  },
  { khop: (d) => d === DUONG_BAO_CAO_CSP, nhom: { ten: "bao-cao-csp", toiDa: 60, cuaSoGiay: MUOI_PHUT } },
  { khop: (d) => d.startsWith("/api/erp/"), nhom: { ten: "erp", toiDa: 900, cuaSoGiay: MUOI_PHUT } },
];

const NHOM_MAC_DINH: NhomGioiHan = { ten: "api", toiDa: 60, cuaSoGiay: MUOI_PHUT };

const PHUONG_THUC_GHI = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function laLenhGhi(phuongThuc: string): boolean {
  return PHUONG_THUC_GHI.has(phuongThuc.toUpperCase());
}

/** Nhóm hạn mức của một lệnh ghi vào `/api`; `null` nếu không giới hạn. */
export function nhomGioiHan(duong: string, phuongThuc: string): NhomGioiHan | null {
  if (!duong.startsWith("/api/") || !laLenhGhi(phuongThuc)) return null;
  return BANG_NHOM.find((n) => n.khop(duong))?.nhom ?? NHOM_MAC_DINH;
}

/**
 * Lệnh ghi do trình duyệt gửi từ một trang khác. Máy không phải trình duyệt
 * (không có Origin, không có Sec-Fetch-Site) thì không mang cookie của ai nên
 * không phải CSRF; các API tự kiểm phiên và nguồn như cũ.
 */
export function laLenhTuTrangKhac(headers: { get(name: string): string | null }): boolean {
  const fetchSite = headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") return true;
  const origin = headers.get("origin");
  if (origin === null) return false;
  // So tên miền như Next tự kiểm cho server action: `x-forwarded-host` (sau
  // proxy của Vercel) rồi `host`. "null" là khung sandbox hay tệp mở từ máy.
  const host = (headers.get("x-forwarded-host") ?? headers.get("host"))?.split(",")[0]?.trim();
  try {
    return !host || new URL(origin).host !== host;
  } catch {
    return true;
  }
}
