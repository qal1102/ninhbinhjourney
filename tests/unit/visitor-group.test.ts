import { describe, expect, it } from "vitest";
import {
  VisitorGroupCreateRequestSchema,
  VisitorGroupMemberActivateRequestSchema,
  VisitorGroupMemberDetailsRequestSchema,
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

    it("group_label bỏ trống thì mặc định chuỗi rỗng", () => {
      // Nhãn đoàn là chỗ dựa cho trí nhớ, không phải một trường bắt buộc —
      // một đoàn không đặt tên vẫn phải tạo được mã đoàn bình thường.
      const result = VisitorGroupCreateRequestSchema.safeParse({
        order_id: "10000000-0000-4000-8000-000000000001",
        anonymous_id: "10000000-0000-4000-8000-000000000002",
        leader_name: "Nguyễn Văn A",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.group_label).toBe("");
      }
    });

    it("group_label dài quá 120 ký tự bị từ chối", () => {
      const result = VisitorGroupCreateRequestSchema.safeParse({
        order_id: "10000000-0000-4000-8000-000000000001",
        anonymous_id: "10000000-0000-4000-8000-000000000002",
        leader_name: "Nguyễn Văn A",
        group_label: "a".repeat(121),
      });
      expect(result.success).toBe(false);
    });
  });

  describe("VisitorGroupMemberDetailsRequestSchema", () => {
    const baseGroupCode = "DOAN-ABCDEFGHIJ";
    const baseAnonymousId = "10000000-0000-4000-8000-000000000002";

    it("từ chối members rỗng", () => {
      // Trưởng đoàn gửi một mảng rỗng không phải một lượt điền hộ — không có
      // gì để cập nhật, và một RPC nhận mảng rỗng rất dễ bị dùng để dò mã
      // đoàn mà không lộ lỗi input.
      const result = VisitorGroupMemberDetailsRequestSchema.safeParse({
        group_code: baseGroupCode,
        anonymous_id: baseAnonymousId,
        members: [],
      });
      expect(result.success).toBe(false);
    });

    it("từ chối quá 45 phần tử", () => {
      // Trần 45 khớp đúng trần sức chứa một lượt đặt (TC-15) — một mảng dài
      // hơn thế không thể ứng với một đoàn thật.
      const result = VisitorGroupMemberDetailsRequestSchema.safeParse({
        group_code: baseGroupCode,
        anonymous_id: baseAnonymousId,
        members: Array.from({ length: 46 }, (_, index) => ({
          member_index: index + 1,
          display_name: "",
        })),
      });
      expect(result.success).toBe(false);
    });

    it("member_index bằng 0 bị từ chối", () => {
      // Thứ tự thành viên đánh số từ 1 — 0 không trỏ tới ai trong đoàn.
      const result = VisitorGroupMemberDetailsRequestSchema.safeParse({
        group_code: baseGroupCode,
        anonymous_id: baseAnonymousId,
        members: [{ member_index: 0, display_name: "Nguyễn Văn B" }],
      });
      expect(result.success).toBe(false);
    });

    it("member_index bằng 46 bị từ chối", () => {
      // Trần cùng một con số 45 với `party_size` — một chỉ số vượt trần sức
      // chứa không thể trỏ tới một thành viên thật của đoàn.
      const result = VisitorGroupMemberDetailsRequestSchema.safeParse({
        group_code: baseGroupCode,
        anonymous_id: baseAnonymousId,
        members: [{ member_index: 46, display_name: "Nguyễn Văn B" }],
      });
      expect(result.success).toBe(false);
    });

    it("display_name rỗng vẫn hợp lệ — đó là đường xoá tên, không phải lỗi", () => {
      const result = VisitorGroupMemberDetailsRequestSchema.safeParse({
        group_code: baseGroupCode,
        anonymous_id: baseAnonymousId,
        members: [{ member_index: 1, display_name: "" }],
      });
      expect(result.success).toBe(true);
    });

    it("care_need bỏ trống thì mặc định 'none'", () => {
      // Đa số khách sẽ không tự khai nhu cầu chăm sóc — mặc định phải là
      // "không có gì cần lưu ý", không phải một trường bắt buộc.
      const result = VisitorGroupMemberDetailsRequestSchema.safeParse({
        group_code: baseGroupCode,
        anonymous_id: baseAnonymousId,
        members: [{ member_index: 1, display_name: "Nguyễn Văn B" }],
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.members[0].care_need).toBe("none");
      }
    });

    it("care_need giá trị lạ bị từ chối", () => {
      // Danh sách nhu cầu chăm sóc là đóng — một giá trị lạ là một nhu cầu
      // không ai trong ca trực biết phải xử lý ra sao.
      const result = VisitorGroupMemberDetailsRequestSchema.safeParse({
        group_code: baseGroupCode,
        anonymous_id: baseAnonymousId,
        members: [
          {
            member_index: 1,
            display_name: "Nguyễn Văn B",
            care_need: "vip",
          },
        ],
      });
      expect(result.success).toBe(false);
    });

    it("từ chối trường lạ (.strict()) ở cả cấp đối tượng lẫn cấp thành viên", () => {
      // Không tuổi, không giấy tờ — một trường lạ như `birth_date` lọt qua ở
      // đây là đúng thứ QĐ-01 cấm, bằng một đường vòng không đụng bảng danh
      // tính.
      const topLevel = VisitorGroupMemberDetailsRequestSchema.safeParse({
        group_code: baseGroupCode,
        anonymous_id: baseAnonymousId,
        members: [{ member_index: 1, display_name: "Nguyễn Văn B" }],
        note: "khong duoc phep",
      });
      expect(topLevel.success).toBe(false);

      const memberLevel = VisitorGroupMemberDetailsRequestSchema.safeParse({
        group_code: baseGroupCode,
        anonymous_id: baseAnonymousId,
        members: [
          {
            member_index: 1,
            display_name: "Nguyễn Văn B",
            birth_date: "2000-01-01",
          },
        ],
      });
      expect(memberLevel.success).toBe(false);
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
