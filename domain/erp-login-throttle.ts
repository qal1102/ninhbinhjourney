/**
 * QA-P2-09 (ERP) — chặn dò mật khẩu ở màn hình đăng nhập.
 *
 * Lượt kiểm 12/09/2026 thấy trang đăng nhập không giới hạn số lần nhập sai.
 * Ba khoá đếm độc lập, khoá nào chạm trần thì dừng:
 *
 * - **một tài khoản trên một máy** (5 lần / 15 phút): chặn người đứng trước
 *   một máy thử mật khẩu, mà không làm khoá chân chủ tài khoản ở máy khác;
 * - **một máy** (20 lần / 15 phút): chặn một máy dò lần lượt nhiều tài khoản;
 * - **một tài khoản** (30 lần / 15 phút): chặn dò rải từ nhiều máy. Trần để
 *   cao, vì kẻ phá có thể cố tình nhập sai để khoá chân giám đốc.
 *
 * Tệp này chỉ tính. Lưu và đọc lượt sai nằm ở `lib/erp/login-throttle.ts`.
 */

export type LoginThrottleScope = "account-ip" | "ip" | "account";

export const LOGIN_THROTTLE_WINDOW_MS = 15 * 60 * 1000;

export const LOGIN_THROTTLE_LIMITS: Readonly<Record<LoginThrottleScope, number>> = Object.freeze({
  "account-ip": 5,
  ip: 20,
  account: 30,
});

export type LoginThrottleDecision =
  | { allowed: true }
  | { allowed: false; scope: LoginThrottleScope; retryAfterMinutes: number };

/** Chuẩn hoá tên đăng nhập: không phân biệt hoa thường, bỏ khoảng trắng hai đầu. */
export function normalizeLoginIdentifier(identifier: string): string {
  return identifier.trim().toLowerCase();
}

/**
 * Quyết định có cho thử đăng nhập không, từ các mốc nhập sai gần đây.
 *
 * `failures` là mốc thời gian (ms) các lần sai của từng khoá, thứ tự bất kỳ.
 * Chạm trần thì mở lại khi lần sai **cũ nhất trong số `trần` lần gần nhất**
 * rơi ra khỏi cửa sổ 15 phút — tức là chờ đúng tới lúc số lần sai trong cửa sổ
 * tụt xuống dưới trần, không khoá cứng thêm.
 */
export function decideLoginThrottle(
  failures: Readonly<Partial<Record<LoginThrottleScope, readonly number[]>>>,
  now: number,
): LoginThrottleDecision {
  let chan: { scope: LoginThrottleScope; unlockAt: number } | null = null;
  for (const scope of ["account-ip", "ip", "account"] as const) {
    const tran = LOGIN_THROTTLE_LIMITS[scope];
    const trongCuaSo = (failures[scope] ?? [])
      .filter((moc) => Number.isFinite(moc) && moc > now - LOGIN_THROTTLE_WINDOW_MS && moc <= now + 60_000)
      .sort((a, b) => b - a);
    if (trongCuaSo.length < tran) continue;
    const unlockAt = trongCuaSo[tran - 1] + LOGIN_THROTTLE_WINDOW_MS;
    if (!chan || unlockAt > chan.unlockAt) chan = { scope, unlockAt };
  }
  if (!chan) return { allowed: true };
  return {
    allowed: false,
    scope: chan.scope,
    retryAfterMinutes: Math.max(1, Math.ceil((chan.unlockAt - now) / 60_000)),
  };
}

export function loginLockedMessage(retryAfterMinutes: number): string {
  const phut = Number.isFinite(retryAfterMinutes) ? Math.min(15, Math.max(1, Math.round(retryAfterMinutes))) : 15;
  return `Nhập sai quá nhiều lần. Xin thử lại sau khoảng ${phut} phút; cần vào gấp thì nhờ quản trị hệ thống kiểm tra tài khoản.`;
}
