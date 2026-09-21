import { describe, expect, it } from "vitest";

import { ERP_MODULES, ERP_ROLE_LABELS, type ErpRole } from "@/domain/erp";
import { CASH_DEPOSIT_STATUS_LABELS } from "@/domain/erp-cash-deposit";
import { SHIFT_CLOSE_STATUSES } from "@/domain/erp-shift-close";
import { STAFF_REQUEST_STATUS_LABELS } from "@/domain/erp-staff-requests";
import { SUPPLIER_AP_STATUS_LABELS } from "@/domain/erp-supplier-ap";
import { WORKDAY_STATUSES } from "@/domain/erp-workday";
import { INCIDENT_STATUSES } from "@/domain/incident";
import {
  buocChinh,
  buocDangCho,
  buocKeTiep,
  buocNhanh,
  dangChoAi,
  demTheoBuoc,
  denLuotVai,
  hrefCuaBuoc,
  MACH_VIEC,
  machViecCuaModule,
  machViecCuaTrang,
  machViecTheoId,
} from "@/domain/erp-mach-viec";

/**
 * Bài kiểm quan trọng nhất của mạch việc là bài đầu tiên: **xương sống phải
 * phủ đúng máy trạng thái thật**.
 *
 * Nếu ai đó thêm một trạng thái vào luồng đóng ca hoặc luồng công nợ mà quên
 * vẽ nó vào đây, mạch dẫn sẽ im lặng nói sai — một hồ sơ nằm ở trạng thái mới
 * sẽ hiện ra là "không thuộc bước nào", hoặc tệ hơn, biến mất khỏi mọi con số
 * đếm. Đó chính là kiểu tài liệu nói dối mà cả tệp `erp-mach-viec.ts` sinh ra
 * để tránh. Bài này làm cho việc quên ấy thành màu đỏ.
 */

describe("Mạch việc: xương sống phải khớp máy trạng thái thật", () => {
  it("mọi trạng thái của hồ sơ đóng ca đều được vẽ vào đúng một bước", () => {
    const mach = machViecTheoId("dong-ca");
    expect(mach).not.toBeNull();
    for (const tt of SHIFT_CLOSE_STATUSES) {
      const hop = mach!.buoc.filter((b) => b.dangCho.includes(tt));
      expect(hop.length, `trạng thái "${tt}" phải thuộc đúng một bước`).toBe(1);
    }
  });

  it("mọi trạng thái của hoá đơn đối tác đều được vẽ vào đúng một bước", () => {
    const mach = machViecTheoId("cong-no-doi-tac");
    expect(mach).not.toBeNull();
    // `reversed` là ngõ cụt sau khi đảo bút toán, cố ý không nằm trên mạch:
    // nó không chờ ai làm gì tiếp.
    const boQua = new Set(["reversed"]);
    for (const tt of Object.keys(SUPPLIER_AP_STATUS_LABELS)) {
      if (boQua.has(tt)) continue;
      const hop = mach!.buoc.filter((b) => b.dangCho.includes(tt));
      expect(hop.length, `trạng thái "${tt}" phải thuộc đúng một bước`).toBe(1);
    }
  });

  it("mọi trạng thái của phiếu chấm công đều được vẽ vào đúng một bước", () => {
    const mach = machViecTheoId("cham-cong")!;
    for (const tt of WORKDAY_STATUSES) {
      const hop = mach.buoc.filter((b) => b.dangCho.includes(tt));
      expect(hop.length, `trạng thái "${tt}" phải thuộc đúng một bước`).toBe(1);
    }
  });

  it("mọi trạng thái của đề nghị nhân sự đều được vẽ vào đúng một bước", () => {
    const mach = machViecTheoId("de-nghi-nhan-su")!;
    for (const tt of Object.keys(STAFF_REQUEST_STATUS_LABELS)) {
      const hop = mach.buoc.filter((b) => b.dangCho.includes(tt));
      expect(hop.length, `trạng thái "${tt}" phải thuộc đúng một bước`).toBe(1);
    }
  });

  it("mọi trạng thái của phiếu nộp quỹ đều được vẽ vào đúng một bước", () => {
    const mach = machViecTheoId("nop-quy")!;
    for (const tt of Object.keys(CASH_DEPOSIT_STATUS_LABELS)) {
      const hop = mach.buoc.filter((b) => b.dangCho.includes(tt));
      expect(hop.length, `trạng thái "${tt}" phải thuộc đúng một bước`).toBe(1);
    }
  });

  it("mọi trạng thái của hồ sơ sự cố đều được vẽ vào đúng một bước", () => {
    const mach = machViecTheoId("su-co")!;
    for (const tt of INCIDENT_STATUSES) {
      const hop = mach.buoc.filter((b) => b.dangCho.includes(tt));
      expect(hop.length, `trạng thái "${tt}" phải thuộc đúng một bước`).toBe(1);
    }
  });

  it("không bước nào nhận vơ một trạng thái không có thật", () => {
    const coThat = new Set<string>([
      ...SHIFT_CLOSE_STATUSES,
      ...Object.keys(SUPPLIER_AP_STATUS_LABELS),
      ...WORKDAY_STATUSES,
      ...Object.keys(STAFF_REQUEST_STATUS_LABELS),
      ...Object.keys(CASH_DEPOSIT_STATUS_LABELS),
      ...INCIDENT_STATUSES,
    ]);
    for (const mach of MACH_VIEC) {
      for (const buoc of mach.buoc) {
        for (const tt of buoc.dangCho) {
          expect(coThat.has(tt), `"${tt}" ở bước ${buoc.id} không phải trạng thái có thật`).toBe(
            true,
          );
        }
      }
    }
  });
});

describe("Mạch việc: hình dạng của một luồng", () => {
  it("số bước chạy liền từ 1, không nhảy cóc, không trùng", () => {
    for (const mach of MACH_VIEC) {
      const so = buocChinh(mach).map((b) => b.thuTu);
      expect(so).toEqual(so.map((_, i) => i + 1));
    }
  });

  it("mỗi luồng có ít nhất một nhánh rẽ, và nhánh không mang số thứ tự", () => {
    for (const mach of MACH_VIEC) {
      expect(buocNhanh(mach).length).toBeGreaterThan(0);
      for (const b of buocNhanh(mach)) expect(b.thuTu).toBeNull();
    }
  });

  it("mã bước không trùng nhau trong toàn hệ thống", () => {
    const tatCa = MACH_VIEC.flatMap((m) => m.buoc.map((b) => b.id));
    expect(new Set(tatCa).size).toBe(tatCa.length);
  });

  it("mọi bước đều nói được dữ liệu từ đâu và đẩy ra cái gì", () => {
    for (const mach of MACH_VIEC) {
      for (const buoc of mach.buoc) {
        expect(buoc.nguonVao.trim().length, buoc.id).toBeGreaterThan(20);
        expect(buoc.ketQua.trim().length, buoc.id).toBeGreaterThan(20);
      }
    }
  });

  it("mọi bước làm tại module đều trỏ vào module có thật", () => {
    for (const mach of MACH_VIEC) {
      for (const buoc of mach.buoc) {
        if (buoc.noiLam.kieu !== "module") continue;
        const moduleId = buoc.noiLam.moduleId;
        expect(
          ERP_MODULES.some((m) => m.id === moduleId),
          `${buoc.id} trỏ vào module "${moduleId}" không có thật`,
        ).toBe(true);
      }
    }
  });

  it("chỉ bước cuối mới được không có ai phụ trách", () => {
    for (const mach of MACH_VIEC) {
      const chinh = buocChinh(mach);
      for (const buoc of chinh.slice(0, -1)) {
        expect(buoc.vai.length, `${buoc.id} phải có người làm`).toBeGreaterThan(0);
      }
      expect(chinh[chinh.length - 1].vai).toEqual([]);
    }
  });
});

describe("Mạch việc: đọc vị trí của một hồ sơ", () => {
  const dongCa = machViecTheoId("dong-ca")!;

  it("hồ sơ vừa nộp thì đang chờ quản lý, không phải chờ nhân viên", () => {
    const buoc = buocDangCho(dongCa, "submitted");
    expect(buoc?.ten).toBe("Quản lý cơ sở duyệt");
    expect(buoc?.vai).toEqual(["manager"]);
  });

  it("hồ sơ bị trả lại thì quay về bước một, về đúng người nộp", () => {
    expect(buocDangCho(dongCa, "manager-returned")?.thuTu).toBe(1);
  });

  it("ngoại lệ vượt ngưỡng thì rơi vào nhánh giám đốc, không rơi vào đường chính", () => {
    const buoc = buocDangCho(dongCa, "exception-pending-director");
    expect(buoc?.thuTu).toBeNull();
    expect(buoc?.vai).toEqual(["director"]);
    // Từ nhánh thì không đoán bừa bước kế tiếp — mỗi nhánh có đường về riêng.
    expect(buocKeTiep(dongCa, buoc!)).toBeNull();
  });

  it("giám đốc quyết xong thì hồ sơ về lại bàn kế toán", () => {
    for (const tt of ["director-approved", "director-rejected"]) {
      expect(buocDangCho(dongCa, tt)?.ten).toBe("Kế toán đối soát và lập bút toán");
    }
  });

  it("trạng thái lạ thì trả null chứ không đoán bừa một bước", () => {
    expect(buocDangCho(dongCa, "khong-co-trang-thai-nay")).toBeNull();
  });

  it("bước kế tiếp đi đúng một nấc trên đường chính", () => {
    const b2 = buocDangCho(dongCa, "submitted")!;
    expect(buocKeTiep(dongCa, b2)?.thuTu).toBe(3);
    const cuoi = buocChinh(dongCa).at(-1)!;
    expect(buocKeTiep(dongCa, cuoi)).toBeNull();
  });
});

describe("Mạch việc: đếm hồ sơ đang nằm ở đâu", () => {
  const dongCa = machViecTheoId("dong-ca")!;

  it("đếm đúng theo bước, gộp cả những trạng thái cùng chờ một bước", () => {
    const dem = demTheoBuoc(dongCa, [
      "submitted",
      "submitted",
      "manager-approved",
      "director-rejected",
      "posted",
    ]);
    expect(dem.get("dong-ca-2-quan-ly")).toBe(2);
    // `manager-approved` và `director-rejected` cùng chờ bàn kế toán.
    expect(dem.get("dong-ca-3-ke-toan")).toBe(2);
    expect(dem.get("dong-ca-5-xong")).toBe(1);
    expect(dem.get("dong-ca-1-nop")).toBe(0);
  });

  it("trạng thái lạ không được đếm vào đâu cả, và không làm hỏng phép đếm", () => {
    const dem = demTheoBuoc(dongCa, ["submitted", "trang-thai-la"]);
    expect([...dem.values()].reduce((a, b) => a + b, 0)).toBe(1);
  });

  it("không có hồ sơ nào thì mọi bước là 0, không phải thiếu khoá", () => {
    const dem = demTheoBuoc(dongCa, []);
    for (const buoc of dongCa.buoc) expect(dem.get(buoc.id)).toBe(0);
  });
});

describe("Mạch việc: tìm luồng theo nơi đang đứng", () => {
  it("màn Vé & đặt chỗ thuộc luồng đóng ca", () => {
    expect(machViecCuaModule("ve-dat-cho").map((m) => m.id)).toEqual(["dong-ca"]);
  });

  it("màn Đối tác thuộc luồng công nợ", () => {
    expect(machViecCuaModule("doi-tac-nha-cung-ung").map((m) => m.id)).toEqual([
      "cong-no-doi-tac",
    ]);
  });

  it("trang Tài chính là nơi ba luồng tiền gặp nhau", () => {
    expect(machViecCuaTrang("/erp/finance").map((m) => m.id)).toEqual([
      "dong-ca",
      "cong-no-doi-tac",
      "nop-quy",
    ]);
  });

  it("bốn luồng thêm sau đứng đúng chỗ làm việc của chúng", () => {
    expect(machViecCuaModule("cham-cong").map((m) => m.id)).toEqual(["cham-cong"]);
    expect(machViecCuaModule("su-co").map((m) => m.id)).toEqual(["su-co"]);
    expect(machViecCuaTrang("/erp/de-xuat").map((m) => m.id)).toEqual(["de-nghi-nhan-su"]);
  });

  it("mỗi màn có máy trạng thái đều đã có mạch, không màn nào bị bỏ quên", () => {
    // Danh sách này là lời hứa: thêm một màn có máy trạng thái mà quên vẽ mạch
    // thì sửa danh sách ở đây sẽ thấy ngay mình đang hứa hão.
    const phaiCoMach = [
      "ve-dat-cho",
      "doi-tac-nha-cung-ung",
      "cham-cong",
      "su-co",
    ];
    for (const moduleId of phaiCoMach) {
      expect(machViecCuaModule(moduleId).length, moduleId).toBeGreaterThan(0);
    }
  });

  it("màn không thuộc luồng nào thì trả rỗng, không trả bừa luồng đầu tiên", () => {
    expect(machViecCuaModule("camera-ai")).toEqual([]);
    expect(machViecCuaTrang("/erp/nhat-ky")).toEqual([]);
  });
});

describe("Mạch việc: nói cho người đọc", () => {
  const dongCa = machViecTheoId("dong-ca")!;
  const nhan = (role: ErpRole) => ERP_ROLE_LABELS[role];

  it("gọi tên người đang giữ hồ sơ, gộp nhiều vai bằng chữ hoặc", () => {
    const apBuoc1 = machViecTheoId("cong-no-doi-tac")!.buoc[0];
    expect(dangChoAi(apBuoc1, nhan)).toBe("Quản lý cơ sở hoặc Kế toán");
  });

  it("bước đã khép thì nói thẳng là không chờ ai", () => {
    const cuoi = buocChinh(dongCa).at(-1)!;
    expect(dangChoAi(cuoi, nhan)).toContain("Không ai");
  });

  it("biết có phải tới lượt vai này chưa", () => {
    const b2 = buocDangCho(dongCa, "submitted")!;
    expect(denLuotVai(b2, "manager")).toBe(true);
    expect(denLuotVai(b2, "director")).toBe(false);
  });

  it("đường dẫn bám theo cơ sở đang mở, còn trang dùng chung thì giữ nguyên", () => {
    const b1 = buocDangCho(dongCa, "manager-returned")!;
    expect(hrefCuaBuoc(b1, "tam-coc")).toBe("/erp/tam-coc/ve-dat-cho");
    const b3 = buocDangCho(dongCa, "manager-approved")!;
    expect(hrefCuaBuoc(b3, "tam-coc")).toBe("/erp/finance");
  });
});
