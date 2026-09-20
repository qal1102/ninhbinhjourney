import { describe, expect, it } from "vitest";

import {
  conChoDon,
  docGioToi,
  docLenBoDam,
  gomNhuCau,
  shiftCareGroupsFrom,
  tomTatCaTruc,
  type ShiftCareGroup,
} from "@/domain/shift-care-brief";

function hang(overrides: Record<string, unknown> = {}) {
  return {
    group_code: "DOAN-ABCDE12345",
    group_label: "",
    leader_name: "Chị Hạnh",
    leader_phone: "0912 345 678",
    member_count: 8,
    nguon: "web",
    gio_toi: "2026-09-21T02:30:00Z",
    so_nguoi: 1,
    danh_sach: [
      { member_index: 3, care_need: "elderly", display_name: "", da_vao: false },
    ],
    ...overrides,
  };
}

describe("TC-13: đọc bản giao ca", () => {
  it("giữ đúng những người tự khai, bỏ người không khai gì", () => {
    const ra = shiftCareGroupsFrom([
      hang({
        danh_sach: [
          { member_index: 2, care_need: "none", display_name: "", da_vao: true },
          { member_index: 5, care_need: "mobility", display_name: "Bác Tâm", da_vao: false },
        ],
      }),
    ]);
    expect(ra).toHaveLength(1);
    expect(ra[0].members.map((m) => m.memberIndex)).toEqual([5]);
    expect(ra[0].members[0].displayName).toBe("Bác Tâm");
  });

  it("đoàn không còn ai cần để ý thì không phải việc của ca trực", () => {
    expect(shiftCareGroupsFrom([hang({ danh_sach: [] })])).toEqual([]);
    expect(
      shiftCareGroupsFrom([
        hang({ danh_sach: [{ member_index: 1, care_need: "none", display_name: "", da_vao: false }] }),
      ]),
    ).toEqual([]);
  });

  it("nhu cầu lạ hoặc số thứ tự hỏng thì bỏ, không đoán bừa", () => {
    expect(
      shiftCareGroupsFrom([
        hang({
          danh_sach: [
            { member_index: 1, care_need: "pregnant", display_name: "", da_vao: false },
            { member_index: 0, care_need: "elderly", display_name: "", da_vao: false },
          ],
        }),
      ]),
    ).toEqual([]);
  });

  it("thiếu mã đoàn thì bỏ hàng — không có mã thì ca trực gọi tên gì", () => {
    expect(shiftCareGroupsFrom([hang({ group_code: "  " })])).toEqual([]);
  });

  it("không phải mảng thì trả rỗng chứ không ném lỗi", () => {
    expect(shiftCareGroupsFrom(null)).toEqual([]);
    expect(shiftCareGroupsFrom({ group_code: "DOAN-ABCDE12345" })).toEqual([]);
  });

  it("xếp người theo số thứ tự trong đoàn", () => {
    const ra = shiftCareGroupsFrom([
      hang({
        danh_sach: [
          { member_index: 9, care_need: "elderly", display_name: "", da_vao: false },
          { member_index: 2, care_need: "young-child", display_name: "", da_vao: true },
        ],
      }),
    ]);
    expect(ra[0].members.map((m) => m.memberIndex)).toEqual([2, 9]);
  });
});

describe("TC-13: câu đọc lên bộ đàm", () => {
  const doan: ShiftCareGroup = {
    groupCode: "DOAN-ABCDE12345",
    groupLabel: "Lớp 9A Nam Định",
    leaderName: "Chị Hạnh",
    leaderPhone: "0912345678",
    memberCount: 8,
    nguon: "web",
    gioToi: "2026-09-21T02:30:00Z",
    members: [
      { memberIndex: 2, careNeed: "young-child", displayName: "", daVao: true },
      { memberIndex: 5, careNeed: "elderly", displayName: "", daVao: false },
      { memberIndex: 6, careNeed: "elderly", displayName: "", daVao: false },
    ],
  };

  it("giờ đọc theo giờ Ninh Bình, không theo giờ máy chủ", () => {
    // 02:30 UTC là 09:30 ở Ninh Bình.
    expect(docGioToi("2026-09-21T02:30:00Z")).toBe("09:30");
  });

  it("chưa hẹn giờ thì nói thẳng là chưa hẹn, không bịa ra 00:00", () => {
    expect(docGioToi("")).toBe("chưa hẹn giờ");
    expect(docGioToi("hôm nào đó")).toBe("chưa hẹn giờ");
  });

  it("gom nhu cầu theo thứ tự việc cần chuẩn bị nhiều nhất", () => {
    expect(gomNhuCau(doan)).toBe("2 người cao tuổi, 1 trẻ nhỏ");
  });

  it("câu đọc có giờ, tên đoàn, số khách và nhu cầu — không có tên từng người", () => {
    const cau = docLenBoDam(doan);
    expect(cau).toBe(
      "09:30, đoàn Lớp 9A Nam Định, 8 khách, 2 người cao tuổi, 1 trẻ nhỏ.",
    );
    expect(cau).not.toContain("Chị Hạnh");
  });

  it("đoàn chưa đặt nhãn thì đọc mã đoàn", () => {
    expect(docLenBoDam({ ...doan, groupLabel: "" })).toContain("đoàn DOAN-ABCDE12345");
  });

  it("còn người chưa vào thì ca trực còn phải đón", () => {
    expect(conChoDon(doan)).toBe(true);
    expect(conChoDon({ ...doan, members: doan.members.map((m) => ({ ...m, daVao: true })) })).toBe(
      false,
    );
  });

  it("tóm tắt đếm đoàn, đếm người cần để ý, và đếm đoàn còn phải đón", () => {
    const xong: ShiftCareGroup = {
      ...doan,
      groupCode: "DOAN-XONGXONG12",
      members: [{ memberIndex: 1, careNeed: "mobility", displayName: "", daVao: true }],
    };
    expect(tomTatCaTruc([doan, xong])).toEqual({ soDoan: 2, soNguoi: 4, soDoanConDon: 1 });
  });
});

describe("TC-13: câu đọc không được lắp ghép máy móc", () => {
  const nen: ShiftCareGroup = {
    groupCode: "DOAN-ABCDE12345",
    groupLabel: "",
    leaderName: "Chị Hạnh",
    leaderPhone: "",
    memberCount: 4,
    nguon: "quay",
    gioToi: "",
    members: [{ memberIndex: 1, careNeed: "elderly", displayName: "", daVao: false }],
  };

  it("nhãn đã có sẵn chữ Đoàn thì không nói 'đoàn Đoàn' lần nữa", () => {
    expect(docLenBoDam({ ...nen, groupLabel: "Đoàn Lớp 9A Nam Định" })).toContain(
      "Đoàn Lớp 9A Nam Định, 4 khách",
    );
    expect(docLenBoDam({ ...nen, groupLabel: "Đoàn Lớp 9A Nam Định" })).not.toContain("đoàn Đoàn");
    expect(docLenBoDam({ ...nen, groupLabel: "Lớp 9A Nam Định" })).toContain("đoàn Lớp 9A Nam Định");
  });

  it("mỗi loại nhu cầu có lối đếm riêng, không ép chung một khuôn", () => {
    expect(
      gomNhuCau({
        ...nen,
        members: [
          { memberIndex: 1, careNeed: "elderly", displayName: "", daVao: false },
          { memberIndex: 2, careNeed: "elderly", displayName: "", daVao: false },
          { memberIndex: 3, careNeed: "young-child", displayName: "", daVao: false },
          { memberIndex: 4, careNeed: "mobility", displayName: "", daVao: false },
        ],
      }),
    ).toBe("1 người cần hỗ trợ di chuyển, 2 người cao tuổi, 1 trẻ nhỏ");
  });
});
