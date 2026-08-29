import { describe, expect, it } from "vitest";
import {
  VisitorGroupCreateRequestSchema,
  VisitorGroupMemberActivateRequestSchema,
  VisitorGroupStatusQuerySchema,
} from "@/domain/visitor-group";

describe("TC-06 visitor group request contracts", () => {
  describe("VisitorGroupCreateRequestSchema", () => {
    it("từ chối khi thiếu leader_name", () => {
      const result = VisitorGroupCreateRequestSchema.safeParse({
        order_id: "10000000-0000-4000-8000-000000000001",
        anonymous_id: "10000000-0000-4000-8000-000000000002",
      });
      expect(result.success).toBe(false);
    });

    it("từ chối leader_name toàn khoảng trắng", () => {
      // Trưởng đoàn khai tên chính mình là bắt buộc — chuỗi chỉ có khoảng
      // trắng không phải một cái tên.
      const result = VisitorGroupCreateRequestSchema.safeParse({
        order_id: "10000000-0000-4000-8000-000000000001",
        anonymous_id: "10000000-0000-4000-8000-000000000002",
        leader_name: "   ",
      });
      expect(result.success).toBe(false);
    });

    it("leader_phone bỏ trống thì mặc định là chuỗi rỗng", () => {
      // Số điện thoại là tuỳ chọn — không được ép trưởng đoàn phải điền.
      const result = VisitorGroupCreateRequestSchema.safeParse({
        order_id: "10000000-0000-4000-8000-000000000001",
        anonymous_id: "10000000-0000-4000-8000-000000000002",
        leader_name: "Nguyễn Văn A",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.leader_phone).toBe("");
      }
    });

    it("từ chối trường lạ (.strict())", () => {
      // Không có trường giấy tờ tuỳ thân nào được phép lọt qua đường vòng
      // này — thêm bất kỳ trường lạ nào cũng phải bị chặn ngay ở tầng API.
      const result = VisitorGroupCreateRequestSchema.safeParse({
        order_id: "10000000-0000-4000-8000-000000000001",
        anonymous_id: "10000000-0000-4000-8000-000000000002",
        leader_name: "Nguyễn Văn A",
        cccd: "001099001234",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("VisitorGroupMemberActivateRequestSchema", () => {
    it("từ chối mã sai định dạng", () => {
      const result = VisitorGroupMemberActivateRequestSchema.safeParse({
        member_code: "SAI-DINH-DANG",
        display_name: "Nguyễn Văn B",
      });
      expect(result.success).toBe(false);
    });

    it("display_name rỗng vẫn hợp lệ — đó là đường rút lại tên", () => {
      const result = VisitorGroupMemberActivateRequestSchema.safeParse({
        member_code: "TV-ABCDEFGHIJ",
        display_name: "",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("VisitorGroupStatusQuerySchema", () => {
    it("từ chối mã đoàn sai định dạng", () => {
      const result = VisitorGroupStatusQuerySchema.safeParse({
        group_code: "SAI-DINH-DANG",
      });
      expect(result.success).toBe(false);
    });

    it("chấp nhận chữ thường", () => {
      // Regex có cờ /i — khách gõ tay hoặc thiết bị quét trả về chữ thường
      // vẫn phải nhận.
      const result = VisitorGroupStatusQuerySchema.safeParse({
        group_code: "doan-abcdefghij",
      });
      expect(result.success).toBe(true);
    });
  });
});
