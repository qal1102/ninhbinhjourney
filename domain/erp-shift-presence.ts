import type { ErpSiteId } from "@/domain/erp";
import { vietnamDayKey } from "@/domain/ticket-window";

/**
 * Ai đang có mặt tại một cơ sở, tính từ dữ liệu chấm công thật.
 *
 * Trước đây màn hình "Nhân sự & ca trực" hiển thị ba nhân viên bịa kèm tiến
 * độ, doanh thu và một dòng "bình quân 3 năm" — trong khi hệ thống mới chạy
 * được hai tháng. Nó nằm giữa hai khối dữ liệu thật nên mượn được vẻ đáng
 * tin của hàng xóm, và mọi quản lý ở mọi cơ sở đều thấy đúng ba con người
 * đó. Kiểm kê 05/09/2026 bắt được.
 *
 * Chỗ này chỉ trả lời đúng câu hỏi mà dữ liệu hiện có trả lời được: ai được
 * phân công ở đây, và hôm nay ai đã vào ca. Năng suất, doanh thu theo đầu
 * người và tỉ lệ đúng hạn thì CHƯA có nguồn — màn hình phải nói thẳng là
 * chưa đo, đừng dựng số cho kín ô.
 */
export type ShiftPresenceState = "on-shift" | "off-shift" | "not-started";

export type ShiftPresenceRow = {
  accountId: string;
  displayName: string;
  jobTitle: string;
  state: ShiftPresenceState;
  /** Mốc của lượt chấm công gần nhất hôm nay; `null` khi chưa chấm lần nào. */
  latestAt: string | null;
  /** `true` khi lượt gần nhất dùng vị trí mô phỏng thay cho GPS thật. */
  demoLocation: boolean;
};

export type ShiftPresenceSummary = {
  assigned: number;
  onShift: number;
  finished: number;
  notStarted: number;
};

type DirectoryEntry = {
  accountId: string;
  displayName: string;
  jobTitle: string;
  siteIds: readonly ErpSiteId[];
  active: boolean;
};

type PresenceEvent = {
  userId: string;
  siteId: ErpSiteId;
  type: "check-in" | "check-out";
  createdAt: string;
  source: "gps" | "demo-location";
};

const STATE_ORDER: Record<ShiftPresenceState, number> = {
  "on-shift": 0,
  "off-shift": 1,
  "not-started": 2,
};

/**
 * Chỉ đếm lượt chấm công CÙNG NGÀY VIỆT NAM với `at`.
 *
 * Không dùng "24 giờ gần nhất": ca đêm hôm qua sẽ trôi sang hôm nay và
 * quản lý mở màn hình lúc 8 giờ sáng thấy người của ca trước vẫn "đang
 * trong ca". Ranh giới phải là ngày làm việc, giống hệt cách bảng vé của
 * giám đốc cắt ngày.
 */
export function deriveShiftPresence(input: {
  directory: readonly DirectoryEntry[];
  events: readonly PresenceEvent[];
  siteId: ErpSiteId;
  at: Date;
}): { rows: ShiftPresenceRow[]; summary: ShiftPresenceSummary } {
  const dayKey = vietnamDayKey(input.at);
  const assigned = input.directory.filter(
    (entry) => entry.active && entry.siteIds.includes(input.siteId),
  );

  const latestByUser = new Map<string, PresenceEvent>();
  for (const event of input.events) {
    if (event.siteId !== input.siteId) continue;
    if (vietnamDayKey(new Date(event.createdAt)) !== dayKey) continue;
    const current = latestByUser.get(event.userId);
    if (!current || event.createdAt > current.createdAt) {
      latestByUser.set(event.userId, event);
    }
  }

  const rows: ShiftPresenceRow[] = assigned.map((entry) => {
    const latest = latestByUser.get(entry.accountId);
    return {
      accountId: entry.accountId,
      displayName: entry.displayName,
      jobTitle: entry.jobTitle,
      state: !latest
        ? "not-started"
        : latest.type === "check-in"
          ? "on-shift"
          : "off-shift",
      latestAt: latest?.createdAt ?? null,
      demoLocation: latest?.source === "demo-location",
    };
  });

  // Người đang trong ca lên trước — quản lý mở màn hình này là để biết ai
  // đang ở đây ngay lúc đó. Cùng trạng thái thì xếp theo tên cho ổn định.
  rows.sort((a, b) => {
    const byState = STATE_ORDER[a.state] - STATE_ORDER[b.state];
    if (byState !== 0) return byState;
    return a.displayName.localeCompare(b.displayName, "vi");
  });

  return {
    rows,
    summary: {
      assigned: rows.length,
      onShift: rows.filter((row) => row.state === "on-shift").length,
      finished: rows.filter((row) => row.state === "off-shift").length,
      notStarted: rows.filter((row) => row.state === "not-started").length,
    },
  };
}
