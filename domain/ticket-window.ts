/**
 * Khung thời gian để đếm vé đã bán.
 *
 * Ba phép tính này nằm ở `domain/` chứ không nằm cạnh chỗ đọc cơ sở dữ liệu,
 * vì chúng thuần tuý và **dễ sai một cách lặng lẽ**: lệch múi giờ một tiếng
 * thì con số "hôm nay" vẫn hiện ra bình thường, chỉ là sai. Ở đây thì kiểm
 * thử được.
 */

export type TicketWindow = { from: Date; to: Date };

const DAY_MS = 24 * 60 * 60 * 1000;

/** Ngày theo lịch Việt Nam, dạng `2026-08-31`. */
export function vietnamDayKey(at: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(at);
}

/**
 * "Hôm nay" của một khu du lịch là ngày theo lịch Việt Nam, không phải 24 giờ
 * đổ về trước. Người trực hỏi "sáng giờ bán được bao nhiêu vé", chứ không hỏi
 * "từ ba giờ chiều hôm qua tới bây giờ".
 */
export function vietnamDayStart(at: Date, daysAgo = 0): Date {
  const key = vietnamDayKey(new Date(at.getTime() - daysAgo * DAY_MS));
  return new Date(`${key}T00:00:00+07:00`);
}

export function vietnamTodayWindow(at: Date): TicketWindow {
  return { from: vietnamDayStart(at, 0), to: at };
}

export function vietnamYesterdayWindow(at: Date): TicketWindow {
  return { from: vietnamDayStart(at, 1), to: vietnamDayStart(at, 0) };
}

/**
 * Cửa sổ trượt, không cắt theo lịch: "7 ngày qua" là bảy ngày tính ngược từ
 * bây giờ. `offsetWindows = 1` cho ra đúng cửa sổ liền trước để so sánh.
 */
export function rollingWindow(at: Date, days: number, offsetWindows = 0): TicketWindow {
  const end = at.getTime() - offsetWindows * days * DAY_MS;
  return { from: new Date(end - days * DAY_MS), to: new Date(end) };
}

/** null khi kỳ trước bằng 0 — chia cho không thì phần trăm không có nghĩa gì. */
export function changePercent(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}
