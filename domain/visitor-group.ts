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
    group_code: z.string().trim().regex(/^DOAN-[A-Z0-9]{10}$/i),
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
  activated: boolean;
  /** Những nơi người này đã đi qua trong chuyến, theo thứ tự thời gian. */
  entries: VisitorGroupMemberEntry[];
};

export type VisitorGroupStatus = {
  groupCode: string;
  orderCode: string;
  leaderName: string;
  visitDate: string;
  memberCount: number;
  activatedCount: number;
  members: VisitorGroupMember[];
};
