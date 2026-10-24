import { randomBytes } from "node:crypto";

/**
 * Khoá HMAC ký cookie phiên và các kho cookie ký của ERP.
 *
 * Repo công khai, nên khoá dự phòng viết sẵn ở đây ai cũng đọc được và tự ký
 * được phiên giám đốc: chỉ dùng ở máy. Trên Vercel mà thiếu
 * `ERP_DEMO_SESSION_SECRET` thì dùng khoá ngẫu nhiên của riêng tiến trình:
 * không ai giả được cookie, chỉ là phiên không sống qua bản máy chủ khác.
 */
let khoa: string | undefined;

export function khoaKyErp(): string {
  if (khoa) return khoa;
  const tuBien = process.env.ERP_DEMO_SESSION_SECRET?.trim();
  if (tuBien) return (khoa = tuBien);
  if (process.env.VERCEL) {
    console.error("[erp] ERP_DEMO_SESSION_SECRET is not set on this deployment; using a per-process random key.");
    return (khoa = randomBytes(32).toString("base64url"));
  }
  return (khoa = "chi-dung-o-may-ninh-binh-demo-session");
}
