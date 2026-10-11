import type { CustomerTicketLookupTicket } from "@/domain/customer-booking";

/**
 * Vé lưu trên máy khách (H3, 11/10/2026): vào hang mất sóng vẫn mở được mã QR.
 * Chỉ lưu trong trình duyệt của khách (localStorage), không gửi đi đâu. Mã QR
 * vẽ lại từ mã vé ngay trên máy nên không cần mạng.
 */
export type VeLuuMay = {
  accepted: true;
  found: true;
  order: {
    code: string;
    product_id: string;
    visit_date: string;
    party_size: number;
    adults: number | null;
    children: number | null;
    total_vnd: number;
    currency: string;
  };
  payment: { mode: "simulation" | "pay-on-site" | null; status: "succeeded" | "pending" | null; amount_due_vnd: number };
  tickets: CustomerTicketLookupTicket[];
};

const KHOA = "nbj-ve-da-luu";

export function luuVeTrenMay(ve: VeLuuMay) {
  try {
    window.localStorage.setItem(KHOA, JSON.stringify({ ve, luuLuc: new Date().toISOString() }));
  } catch {
    // Trình duyệt chặn bộ nhớ (ẩn danh): vé vẫn hiện trên trang, chỉ không lưu.
  }
}

export function docVeTrenMay(): { ve: VeLuuMay; luuLuc: string } | null {
  try {
    const tho = window.localStorage.getItem(KHOA);
    if (!tho) return null;
    const du = JSON.parse(tho) as { ve?: VeLuuMay; luuLuc?: string };
    if (!du.ve?.found || !Array.isArray(du.ve.tickets) || typeof du.luuLuc !== "string") return null;
    return { ve: du.ve, luuLuc: du.luuLuc };
  } catch {
    return null;
  }
}

/** Đăng ký `sw.js` để trang tra vé, thuyết minh, hộ chiếu mở được khi mất sóng. */
export function batNgoaiTuyen() {
  try {
    void navigator.serviceWorker?.register("/sw.js", { scope: "/", updateViaCache: "none" });
  } catch {
    // Trình duyệt không có service worker: vé lưu trên máy vẫn dùng được.
  }
}
