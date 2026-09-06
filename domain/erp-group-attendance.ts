import type { VisitorGroupMember } from "@/domain/visitor-group";

/**
 * TC-19 — đoàn còn thiếu người.
 *
 * Chủ dự án nói thẳng ví dụ: "tám người mà mới sáu người qua cổng sau mười
 * lăm phút" thì trưởng đoàn phải thấy. Đây KHÔNG phải một hàm ghi thêm dữ
 * liệu — nó chỉ đọc lại `entries[]` mà `erp_visitor_group_status` (migration
 * `202608300056`) đã trả sẵn cho mỗi thành viên, rồi đếm.
 *
 * Mốc để tính "bao lâu rồi" là lượt quét ĐẦU TIÊN của cả đoàn tại cơ sở đang
 * xét — không phải giờ khởi hành, không phải giờ hiện tại trừ giờ mở cổng.
 * Một đoàn có thể tới cổng muộn vì kẹt xe; cái đồng hồ phải bắt đầu chạy từ
 * lúc người đầu tiên thực sự bước qua, không phải từ một mốc lịch trình.
 */
export const GROUP_ATTENDANCE_ALERT_THRESHOLD_MINUTES = 15;

export type GroupAttendanceStatus = "not-started" | "in-progress" | "complete";
export type GroupAttendanceAlertLevel = "none" | "attention";

export type GroupAttendanceMemberRow = {
  memberIndex: number;
  displayName: string;
  entered: boolean;
};

export type GroupAttendanceResult = {
  siteId: string;
  totalCount: number;
  enteredCount: number;
  pendingCount: number;
  /** Theo đúng thứ tự `memberIndex`, để trang không tự xáo trộn danh sách. */
  pendingMembers: GroupAttendanceMemberRow[];
  /** Mốc quét đầu tiên của cả đoàn tại cơ sở này; `null` khi chưa ai qua. */
  firstScanAt: string | null;
  minutesSinceFirstScan: number | null;
  status: GroupAttendanceStatus;
  alertLevel: GroupAttendanceAlertLevel;
};

/**
 * Đổi một chuỗi giờ thành mốc thời gian (mili-giây), hoặc `null` nếu hỏng.
 *
 * Dùng `Date.parse` thay vì `new Date(...)`: hàm này phải thuần tuý, và một
 * chuỗi `scanned_at` hỏng (rỗng, không phải chuỗi ISO, hay bất cứ gì khác)
 * không được phép làm cả phép đếm của đoàn sụp đổ — nó chỉ nên bị bỏ qua.
 */
function parseScanMillis(value: string): number | null {
  if (typeof value !== "string" || value.trim().length === 0) return null;
  const millis = Date.parse(value);
  return Number.isNaN(millis) ? null : millis;
}

/**
 * Lượt quét sớm nhất, hợp lệ, của một thành viên tại đúng cơ sở đang xét.
 *
 * Một người có thể đã quét ở nhiều cơ sở khác nhau trong chuyến đi (Tràng An
 * buổi sáng, Tam Cốc buổi chiều) — nên phải lọc đúng `siteId`, đừng đếm nhầm
 * một lượt quét nơi khác thành "đã vào" ở đây.
 */
function earliestValidScanAtSite(
  member: Pick<VisitorGroupMember, "entries">,
  siteId: string,
): { millis: number; raw: string } | null {
  let earliest: { millis: number; raw: string } | null = null;
  for (const entry of member.entries ?? []) {
    if (!entry || entry.siteId !== siteId) continue;
    const millis = parseScanMillis(entry.scannedAt);
    if (millis === null) continue;
    if (earliest === null || millis < earliest.millis) earliest = { millis, raw: entry.scannedAt };
  }
  return earliest;
}

/**
 * Trạng thái điểm danh của một đoàn tại MỘT cơ sở, tại một mốc "bây giờ" do
 * người gọi truyền vào.
 *
 * Hàm thuần: không gọi mạng, không tự hỏi giờ hệ thống. Người gọi (trang
 * trưởng đoàn) truyền `now` vào, nên cùng một đầu vào luôn ra đúng một kết
 * quả — dễ kiểm, và không lệch giờ giữa máy chủ và trình duyệt.
 */
export function deriveGroupAttendance(input: {
  members: readonly Pick<VisitorGroupMember, "memberIndex" | "displayName" | "entries">[];
  siteId: string;
  now: Date;
}): GroupAttendanceResult {
  const { members, siteId, now } = input;
  const nowMillis = now.getTime();

  let firstScan: { millis: number; raw: string } | null = null;
  const rows: GroupAttendanceMemberRow[] = [];

  for (const member of members) {
    const earliest = earliestValidScanAtSite(member, siteId);
    const entered = earliest !== null;
    if (earliest !== null && (firstScan === null || earliest.millis < firstScan.millis)) {
      firstScan = earliest;
    }
    rows.push({
      memberIndex: member.memberIndex,
      displayName: member.displayName,
      entered,
    });
  }

  const totalCount = rows.length;
  const enteredCount = rows.filter((row) => row.entered).length;
  const pendingMembers = rows
    .filter((row) => !row.entered)
    .sort((a, b) => a.memberIndex - b.memberIndex);

  const status: GroupAttendanceStatus =
    enteredCount === 0 ? "not-started" : enteredCount === totalCount ? "complete" : "in-progress";

  // Chưa ai vào thì chưa có gì để nói — im lặng đúng là câu trả lời đúng.
  // Đủ người rồi cũng không cần báo nữa, dù có quá ngưỡng bao lâu đi nữa.
  // Chỉ khi ĐANG dở dang (có người vào, có người chưa) và đã quá ngưỡng thì
  // mới lên tiếng.
  const minutesSinceFirstScan =
    firstScan === null ? null : Math.max(0, Math.floor((nowMillis - firstScan.millis) / 60_000));

  const alertLevel: GroupAttendanceAlertLevel =
    status === "in-progress" &&
    minutesSinceFirstScan !== null &&
    minutesSinceFirstScan >= GROUP_ATTENDANCE_ALERT_THRESHOLD_MINUTES
      ? "attention"
      : "none";

  return {
    siteId,
    totalCount,
    enteredCount,
    pendingCount: pendingMembers.length,
    pendingMembers,
    // Trả nguyên chuỗi khách/nhân viên đã quét, không tự dựng `new Date(...)`
    // — hàm này không tạo đối tượng Date nào, chỉ đọc và so millis.
    firstScanAt: firstScan === null ? null : firstScan.raw,
    minutesSinceFirstScan,
    status,
    alertLevel,
  };
}

/**
 * Cơ sở nào đang là "chỗ đang xét" — trang trưởng đoàn không có lịch trình
 * tường minh để hỏi "hôm nay đi đâu", nó chỉ có nhật ký quét. Nên chọn:
 *
 * 1. Ưu tiên một cơ sở đang dở dang (có người vào, có người chưa) — đó là
 *    đúng lúc trưởng đoàn cần biết nhất.
 * 2. Không có cơ sở nào dở dang thì lấy cơ sở có lượt quét đầu tiên GẦN ĐÂY
 *    NHẤT — đó là chặng vừa xong hoặc đang xong.
 * 3. Chưa có lượt quét nào ở đâu cả thì trả về `null`.
 *
 * Cũng là hàm thuần: gọi lại `deriveGroupAttendance` cho từng cơ sở bằng
 * đúng `now` được truyền vào, không tự hỏi giờ.
 */
export function pickCurrentAttendanceSiteId(input: {
  members: readonly Pick<VisitorGroupMember, "memberIndex" | "displayName" | "entries">[];
  now: Date;
}): string | null {
  const { members, now } = input;
  const siteIds = new Set<string>();
  for (const member of members) {
    for (const entry of member.entries ?? []) {
      if (entry && typeof entry.siteId === "string" && entry.siteId.length > 0) {
        siteIds.add(entry.siteId);
      }
    }
  }
  if (siteIds.size === 0) return null;

  // Một cơ sở chỉ được vào danh sách ứng viên khi nó có ÍT NHẤT MỘT lượt quét
  // đọc được giờ. Bản trước gom mã cơ sở thẳng từ `entries` mà không xét
  // `scannedAt`, nên một cơ sở mà mọi lượt quét đều hỏng giờ vẫn lọt vào; khi
  // ấy `firstScanAt` là `null`, phép so bên dưới ra `NaN`, và thứ tự sắp xếp
  // trở thành thứ trình duyệt tự quyết. Đo thật: để cơ sở hỏng đứng trước
  // trong dữ liệu vào thì hàm trả về đúng cơ sở hỏng ấy — trang trưởng đoàn
  // sẽ hiện "chưa ai qua cổng" ở một nơi cả đoàn chưa từng tới.
  const candidates = [...siteIds]
    .map((siteId) => ({
      siteId,
      result: deriveGroupAttendance({ members, siteId, now }),
    }))
    .filter((candidate) => candidate.result.firstScanAt !== null);
  if (candidates.length === 0) return null;

  const inProgress = candidates.filter((candidate) => candidate.result.status === "in-progress");
  const pool = inProgress.length > 0 ? inProgress : candidates;

  // Trong hồ đã chọn, ai có lượt quét đầu tiên MUỘN HƠN thì đứng trước — đó
  // là chặng gần đây nhất. Tới đây `firstScanAt` chắc chắn khác `null`, vì
  // bộ lọc ngay trên đã loại hết những cơ sở không đọc được giờ.
  pool.sort((a, b) => Date.parse(b.result.firstScanAt ?? "") - Date.parse(a.result.firstScanAt ?? ""));

  return pool[0].siteId;
}
