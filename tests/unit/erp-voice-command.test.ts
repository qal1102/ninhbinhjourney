import { describe, expect, it } from "vitest";
import { resolveErpNavigationCommand } from "@/components/erp/voice-command-center";
import type { ErpRole, ErpSiteId } from "@/domain/erp";

const allSites: ErpSiteId[] = ["trang-an", "tam-chuc", "tam-coc", "bai-dinh"];

type Case = [string, ErpRole, ErpSiteId | undefined, string | null];

const cases: Case[] = [
  ["Mở trang chủ", "director", undefined, "/erp"],
  ["Vào màn hình tổng quan", "manager", "trang-an", "/erp"],
  ["Mở tài chính tổng hợp", "director", undefined, "/erp/finance"],
  ["Mở đối soát toàn vùng", "accountant", undefined, "/erp/finance"],
  [
    "Mở công nợ nhà cung cấp",
    "accountant",
    undefined,
    "/erp/finance#supplier-payables",
  ],
  [
    "Mở báo cáo công nợ",
    "chief-accountant",
    undefined,
    "/erp/finance#supplier-payables",
  ],
  [
    "Mở hóa đơn nhà cung cấp Tam Cốc",
    "director",
    undefined,
    "/erp/tam-coc/doi-tac-nha-cung-ung",
  ],
  [
    "Mở hóa đơn nhà cung cấp",
    "manager",
    "trang-an",
    "/erp/trang-an/doi-tac-nha-cung-ung",
  ],
  ["Mở hóa đơn điện tử", "accountant", undefined, "/erp/finance"],
  ["Mở đóng kỳ tháng 7", "accountant", undefined, "/erp/finance"],
  ["Mở tài sản Tam Chúc", "accountant", undefined, "/erp/tam-chuc/tai-san-bao-tri"],
  ["Mở báo cáo hiện trường Tràng An", "accountant", undefined, "/erp/trang-an/bao-cao-hien-truong"],
  ["Mở camera Tam Chúc", "accountant", undefined, null],
  ["Mở nhân sự Tràng An", "accountant", undefined, null],
  ["Mở báo cáo dự báo", "director", undefined, "/erp/finance#forecast"],
  ["Mở báo cáo tài chính Tam Chúc", "director", undefined, "/erp/tam-chuc/tai-chinh-doi-soat"],
  ["Mở camera Tam Chúc", "director", undefined, "/erp/tam-chuc/camera-ai"],
  ["Mở cam 2 Tam Chúc", "director", undefined, "/erp/tam-chuc/camera-ai?camera=02"],
  ["Mở camera số 3 Tràng An", "director", undefined, "/erp/trang-an/camera-ai?camera=03"],
  ["Mở camera Bến thuyền Tam Chúc", "director", undefined, "/erp/tam-chuc/camera-ai?camera=02"],
  ["Mở camera Dốc Tháp Ngọc Tam Chúc", "director", undefined, "/erp/tam-chuc/camera-ai?camera=04"],
  ["Mở báo cáo nhân viên Tràng An", "director", undefined, "/erp/trang-an/nhan-su"],
  ["Mở báo cáo hiện trường Tràng An", "director", undefined, "/erp/trang-an/bao-cao-hien-truong"],
  ["Nộp ảnh hiện trường", "employee", "trang-an", "/erp/trang-an/bao-cao-hien-truong"],
  ["Mở báo cáo sự cố Tam Cốc", "director", undefined, "/erp/tam-coc/su-co"],
  ["Mở dự án lễ hội Tràng An", "director", undefined, "/erp/trang-an/du-an-su-kien"],
  ["Mở festival Tam Cốc", "manager", "tam-coc", "/erp/tam-coc/du-an-su-kien"],
  ["Mở sức chứa", "manager", "tam-chuc", "/erp/tam-chuc/suc-chua"],
  ["Mở check-in khách", "employee", "trang-an", "/erp/trang-an/check-in-khach"],
  ["Mở chấm công", "employee", "trang-an", "/erp/trang-an/cham-cong"],
  ["Mở xe trung chuyển Bái Đính", "manager", undefined, "/erp/bai-dinh/xe-trung-chuyen"],
  ["Mở tài sản bảo trì Tràng An", "manager", undefined, "/erp/trang-an/tai-san-bao-tri"],
  ["Mở đối tác nhà cung ứng Tam Chúc", "manager", undefined, "/erp/tam-chuc/doi-tac-nha-cung-ung"],
  ["Mở SOP Tam Cốc", "employee", undefined, "/erp/tam-coc/sop-dien-tap"],
  ["Mở bán vé Tràng An", "manager", undefined, "/erp/trang-an/ve-dat-cho"],
  ["Mở Bái Đính", "director", undefined, "/erp/bai-dinh"],
  ["Hôm nay doanh thu bao nhiêu?", "director", undefined, null],
  ["Hôm nay có bao nhiêu khách?", "director", undefined, null],
  ["Có gì cần xử lý gấp?", "director", undefined, null],
  ["Chi phí phải trả hôm nay bao nhiêu?", "director", undefined, null],
];

describe("ERP voice navigation", () => {
  it.each(cases)("routes %s", (command, role, currentSite, expected) => {
    expect(resolveErpNavigationCommand(command, role, allSites, currentSite)).toBe(expected);
  });
});
