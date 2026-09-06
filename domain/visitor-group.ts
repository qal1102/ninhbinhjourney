import { z } from "zod";

/**
 * TC-06 — khách đoàn.
 *
 * Trưởng đoàn khai tối thiểu: tên của **chính mình**, và số điện thoại nếu
 * muốn. Không có trường nào cho giấy tờ tuỳ thân, và đừng thêm — QĐ-01.
 *
 * Tên của từng người trong đoàn không nằm ở đây, vì không ai phải điền hộ ai.
 */
export const VisitorGroupCreateRequestSchema = z
  .object({
    order_id: z.string().uuid(),
    anonymous_id: z.string().uuid(),
    leader_name: z.string().trim().min(1).max(200),
    leader_phone: z.string().trim().max(30).default(""),
    // TC-15: nhãn người tự đặt — nơi xuất phát, tên đoàn, công ty lữ hành.
    // Mã máy `DOAN-…` thì máy đọc tốt còn người thì không nhớ nổi.
    group_label: z.string().trim().max(120).default(""),
  })
  .strict();

/**
 * TC-15 — trưởng đoàn điền hộ tên cả đoàn.
 *
 * Chỉ **tên gọi** và **nhu cầu chăm sóc**. Không tuổi, không giấy tờ: một người
 * đang khai dữ liệu cá nhân của mấy chục người chưa được hỏi, nên càng ít càng
 * tốt. Tên rỗng nghĩa là xoá tên đã điền.
 *
 * `anonymous_id` ở đây không phải hình thức — quyền điền hộ buộc phải là phiên
 * khách đã đặt đơn, chứ không phải mã đoàn. Mã đoàn thì cả đoàn ai cũng cầm.
 */
/**
 * Hình dạng mã đoàn, khai đúng một lần.
 *
 * Máy chủ sinh mã bằng `'DOAN-' || upper(substr(...uuid..., 1, 10))` trong
 * migration `202608300056`. Chép lại khuôn này ra nhiều nơi thì tới ngày đổi
 * độ dài mã, sẽ có chỗ sửa chỗ quên, và cái quên ấy biểu hiện thành "mã đúng
 * mà trang báo không tìm thấy đoàn" — thứ không ai đoán ra nổi.
 */
export const VISITOR_GROUP_CODE_PATTERN = /^DOAN-[A-Z0-9]{10}$/i;

export const VisitorGroupMemberDetailsRequestSchema = z
  .object({
    group_code: z.string().trim().regex(VISITOR_GROUP_CODE_PATTERN),
    anonymous_id: z.string().uuid(),
    members: z
      .array(
        z
          .object({
            member_index: z.number().int().min(1).max(45),
            display_name: z.string().trim().max(200),
            care_need: z
              .enum(["none", "young-child", "elderly", "mobility"])
              .default("none"),
          })
          .strict(),
      )
      .min(1)
      .max(45),
  })
  .strict();

/**
 * Khách tự khai tên mình. Tự nguyện: bỏ trống là rút lại, và không ảnh hưởng
 * gì tới việc vào cổng.
 */
export const VisitorGroupMemberActivateRequestSchema = z
  .object({
    member_code: z.string().trim().regex(/^TV-[A-Z0-9]{10}$/i),
    display_name: z.string().trim().max(200),
  })
  .strict();

export const VisitorGroupStatusQuerySchema = z
  .object({
    group_code: z.string().trim().regex(VISITOR_GROUP_CODE_PATTERN),
  })
  .strict();

export type VisitorGroupMemberEntry = {
  siteId: string;
  scannedAt: string;
};

export type VisitorGroupMember = {
  memberIndex: number;
  memberCode: string;
  guestGroup: "adult" | "child";
  /** Rỗng là bình thường — phần lớn khách sẽ không bao giờ tự khai tên. */
  displayName: string;
  /**
   * TC-15 — thay vì hỏi tuổi, hỏi thẳng thứ cần biết để phục vụ. Thu ít dữ
   * liệu cá nhân hơn hẳn mà vẫn đủ dùng cho ca trực.
   */
  careNeed: "none" | "young-child" | "elderly" | "mobility";
  activated: boolean;
  /** Những nơi người này đã đi qua trong chuyến, theo thứ tự thời gian. */
  entries: VisitorGroupMemberEntry[];
};

export type VisitorGroupStatus = {
  groupCode: string;
  /** Nhãn người tự đặt. Rỗng là bình thường. */
  groupLabel: string;
  orderCode: string;
  leaderName: string;
  visitDate: string;
  memberCount: number;
  activatedCount: number;
  members: VisitorGroupMember[];
};
