import { describe, expect, it } from "vitest";
import { danhSachViecCanBan, type NguonViecCanBan } from "@/domain/viec-can-ban";

const rong: NguonViecCanBan = { sop: [], suCo: [], caLech: [], hoaDon: [], duAn: [] };
const bayGio = new Date("2026-10-11T03:00:00Z");

describe("G1 danhSachViecCanBan", () => {
  it("không có hồ sơ chờ thì trả danh sách rỗng, không bịa việc", () => {
    expect(danhSachViecCanBan(rong, bayGio)).toEqual([]);
  });

  it("việc gấp lên đầu, rồi theo thứ tự mở cửa → sự cố → ca → hoá đơn → dự án", () => {
    const ds = danhSachViecCanBan(
      {
        ...rong,
        duAn: [{ id: "d1", siteId: "trang-an", summary: "Dời ngày sự kiện", requestedByName: "Lan", createdAt: "2026-10-09T02:00:00Z" }],
        hoaDon: [{ id: "h1", siteId: "trang-an", caseCode: "AP-TA-1", supplier: { name: "Tràng An Xanh" }, dueDate: "2026-10-20" }],
        suCo: [
          { id: "c1", siteId: "tam-coc", title: "Khách lạc", area: "Bến", elapsedMinutes: 10, slaMinutes: 30 },
          { id: "c2", siteId: "trang-an", title: "Hỗ trợ y tế", area: "Cổng", elapsedMinutes: 50, slaMinutes: 30 },
        ],
        sop: [{ id: "s1", siteId: "bai-dinh", assessmentCode: "SOP-BD-1", submittedByDisplayName: "Tùng", decisionDueAt: "2026-10-11T00:30:00Z", criticalFailures: 1 }],
      },
      bayGio,
    );
    expect(ds.map((v) => v.id)).toEqual(["sop-s1", "su-co-c2", "su-co-c1", "hd-h1", "da-d1"]);
    expect(ds[1]).toMatchObject({ gap: true, han: "trễ 20 phút", href: "/erp/trang-an/su-co" });
    expect(ds[2]).toMatchObject({ gap: false, han: "còn 20 phút" });
  });

  it("hoá đơn quá hạn trả thì là việc gấp", () => {
    const [h] = danhSachViecCanBan(
      { ...rong, hoaDon: [{ id: "h1", siteId: "tam-coc", caseCode: "AP-1", supplier: { name: "NCC" }, dueDate: "2026-10-01" }] },
      bayGio,
    );
    expect(h).toMatchObject({ gap: true, han: "quá hạn trả 01/10" });
  });
});
