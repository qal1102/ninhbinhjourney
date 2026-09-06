/**
 * TC-18 — đoàn mua tại quầy.
 *
 * Quầy không có phiên khách web, không có đơn đặt để hỏi `party_size`/`adults`.
 * Nhân viên gõ tay đúng hai thứ: số người và nhãn đoàn. Kiểm ở đây trước khi
 * chạm mạng, để lỗi hiện ngay dưới ô nhập thay vì chỉ lộ ra sau một lượt gọi
 * RPC thất bại.
 *
 * Trần 45 người khớp đúng trần đã áp cho `erp_visitor_groups.member_count` từ
 * TC-15 (`202608300056_erp_visitor_groups_bus_size.sql`) — một xe khách lớn ở
 * Việt Nam là 45 chỗ, và nới riêng cho quầy một trần khác sẽ là hai luật cho
 * cùng một khái niệm "một đoàn".
 *
 * Nhãn đoàn bắt buộc phải có ở đây (khác với đoàn qua web, nơi
 * `erp_visitor_groups.group_label` cho phép để trống): một đoàn quầy không có
 * đơn hàng, không có số điện thoại trưởng đoàn, không có gì khác để phân biệt
 * hai tấm phiếu in liên tiếp ngoài chính cái nhãn này.
 */
export const COUNTER_GROUP_MIN_PARTY_SIZE = 1;
export const COUNTER_GROUP_MAX_PARTY_SIZE = 45;
export const COUNTER_GROUP_LABEL_MAX_LENGTH = 120;

export type CounterVisitorGroupInputError =
  | "PARTY_SIZE_INVALID"
  | "GROUP_LABEL_REQUIRED"
  | "GROUP_LABEL_TOO_LONG";

export type CounterVisitorGroupInputResult =
  | { ok: true; partySize: number; groupLabel: string }
  | { ok: false; error: CounterVisitorGroupInputError };

export function validateCounterVisitorGroupInput(input: {
  partySize: number;
  groupLabel: string;
}): CounterVisitorGroupInputResult {
  const partySize = input.partySize;
  if (
    !Number.isFinite(partySize) ||
    !Number.isInteger(partySize) ||
    partySize < COUNTER_GROUP_MIN_PARTY_SIZE ||
    partySize > COUNTER_GROUP_MAX_PARTY_SIZE
  ) {
    return { ok: false, error: "PARTY_SIZE_INVALID" };
  }

  const groupLabel = input.groupLabel.trim();
  if (groupLabel.length < 1) {
    return { ok: false, error: "GROUP_LABEL_REQUIRED" };
  }
  if (groupLabel.length > COUNTER_GROUP_LABEL_MAX_LENGTH) {
    return { ok: false, error: "GROUP_LABEL_TOO_LONG" };
  }

  return { ok: true, partySize, groupLabel };
}
