import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  ERP_AUDIT_ACTION_LABELS,
  ERP_ROLE_SWITCH_SESSION_ACTION,
  erpAuditActionLabel,
  gopLuotXemThu,
} from "@/domain/erp-audit-labels";
import { isErpTestMarkedNote } from "@/domain/erp-data-origin";

describe("Nhật ký không in mã máy ra màn hình", () => {
  it("dịch đúng các mã đang thật sự hiện trên production ngày 13/09/2026", () => {
    // Đọc thẳng từ trang Nhật ký của giám đốc, không đoán.
    for (const ma of [
      "role-switch.started",
      "role-switch.ended",
      "employee.submit",
      "manager.review",
      "account.role.granted",
      "journal.submitted",
      "accountant.reconcile",
      "employee.access.updated",
      "cash-deposit.posted",
      "cash-deposit.matched",
      "cash-deposit.submitted",
      "journal.approved-and-posted",
      "system.accounting-posted",
    ]) {
      const nhan = erpAuditActionLabel(ma);
      expect(nhan, ma).not.toBe(ma);
      expect(nhan, ma).not.toBe("Thao tác khác");
    }
  });

  it("mã lạ chưa có tên thì giấu đi, không in nguyên văn", () => {
    expect(erpAuditActionLabel("refund.partial-approved")).toBe("Thao tác khác");
    // Một từ tiếng Anh trơn cũng là mã máy, không phải chữ cho người đọc.
    expect(erpAuditActionLabel("lock")).toBe("Thao tác khác");
    expect(erpAuditActionLabel("approved")).toBe("Thao tác khác");
  });

  it("hành động đã viết bằng tiếng Việt thì để nguyên", () => {
    expect(erpAuditActionLabel("Gửi nghiệm thu")).toBe("Gửi nghiệm thu");
    expect(erpAuditActionLabel("Xác nhận hoàn thành")).toBe("Xác nhận hoàn thành");
  });

  it("không tên nào còn lẫn chữ tiếng Anh hay dấu gạch nối kiểu mã", () => {
    for (const [ma, nhan] of Object.entries(ERP_AUDIT_ACTION_LABELS)) {
      expect(nhan, ma).not.toMatch(/[a-z]+[.-][a-z]+|\b(role|switch|journal|invoice|payment|deposit|account)\b/i);
    }
  });

  it("mọi mã mà cơ sở dữ liệu cho phép ở các bảng có ràng buộc đều đã có tên", () => {
    // Ba bảng này khai `check (... in (...))` cho cột hành động, nên đọc thẳng
    // migration là ra đủ danh sách. Thêm một mã mới vào ràng buộc mà quên dịch
    // thì bài này đỏ, thay vì mã ấy lặng lẽ hiện ra "Thao tác khác".
    const thuMuc = "supabase/migrations";
    const sql = readdirSync(thuMuc)
      .filter((ten) => ten.endsWith(".sql"))
      .map((ten) => readFileSync(`${thuMuc}/${ten}`, "utf8"))
      .join("\n");

    const maCanCo = new Set<string>();
    for (const [bang, cot] of [
      ["erp_account_admin_audit", "action"],
      ["erp_employee_access_audit", "action"],
      ["erp_workday_audit_events", "event_type"],
    ] as const) {
      const batDau = sql.indexOf(`create table if not exists public.${bang}`);
      expect(batDau, bang).toBeGreaterThan(-1);
      const khoi = sql.slice(batDau, sql.indexOf(");\n", batDau));
      const rangBuoc = khoi.slice(khoi.indexOf(`${cot} text not null check`));
      const danhSach = rangBuoc.slice(rangBuoc.indexOf("in ("), rangBuoc.indexOf(")"));
      for (const m of danhSach.matchAll(/'([^']+)'/g)) maCanCo.add(m[1]);
    }
    // Bảng xem theo vai trò lưu `started`/`ended`, hàm nhật ký ghép thêm tiền tố.
    maCanCo.add("role-switch.started");
    maCanCo.add("role-switch.ended");

    expect(maCanCo.size).toBeGreaterThanOrEqual(12);
    const thieu = [...maCanCo].filter((ma) => !ERP_AUDIT_ACTION_LABELS[ma]);
    expect(thieu).toEqual([]);
  });

  it("nhận ra ghi chú do bộ smoke tự đặt dấu", () => {
    expect(isErpTestMarkedNote("QA-T10B-RT-1785909391844 — nộp quỹ test round-trip T10b.")).toBe(true);
    expect(isErpTestMarkedNote("Đã kiểm quỹ, khớp QA-T10B-RT-1785909391844")).toBe(false);
    expect(isErpTestMarkedNote(null)).toBe(false);
  });
});

describe("gộp mỗi lượt xem thử thành một dòng", () => {
  const dong = (action: string, occurredAt: string, entityId = "accountant-001", actorAccountId = "director-001") => ({
    action,
    occurredAt,
    entityId,
    actorAccountId,
    note: "Phạm Thu Trang",
  });

  it("một cặp bắt đầu, kết thúc liền nhau thành một dòng có giờ đầu và giờ cuối", () => {
    // Danh sách xếp mới nhất trước: "kết thúc" đứng trên "bắt đầu".
    const ra = gopLuotXemThu([
      dong("role-switch.ended", "2026-09-13T01:03:00Z"),
      dong("role-switch.started", "2026-09-13T01:02:00Z"),
    ]);
    expect(ra).toHaveLength(1);
    expect(ra[0]).toMatchObject({
      action: ERP_ROLE_SWITCH_SESSION_ACTION,
      occurredAt: "2026-09-13T01:02:00Z",
      endedAt: "2026-09-13T01:03:00Z",
      note: "Phạm Thu Trang",
    });
  });

  it("một trăm tám mươi dòng xem thử theo cặp còn đúng chín mươi dòng", () => {
    const rows = [];
    for (let i = 0; i < 90; i += 1) {
      rows.push(dong("role-switch.ended", `2026-09-13T01:${String(59 - (i % 60)).padStart(2, "0")}:30Z`));
      rows.push(dong("role-switch.started", `2026-09-13T01:${String(59 - (i % 60)).padStart(2, "0")}:00Z`));
    }
    expect(gopLuotXemThu(rows)).toHaveLength(90);
  });

  it("không gộp khi khác tài khoản được xem, khác người xem, hay có việc khác chen giữa", () => {
    expect(
      gopLuotXemThu([
        dong("role-switch.ended", "2026-09-13T01:03:00Z", "manager-tam-chuc"),
        dong("role-switch.started", "2026-09-13T01:02:00Z", "accountant-001"),
      ]),
    ).toHaveLength(2);
    expect(
      gopLuotXemThu([
        dong("role-switch.ended", "2026-09-13T01:03:00Z", "accountant-001", "director-002"),
        dong("role-switch.started", "2026-09-13T01:02:00Z", "accountant-001", "director-001"),
      ]),
    ).toHaveLength(2);
    expect(
      gopLuotXemThu([
        dong("role-switch.ended", "2026-09-13T01:03:00Z"),
        dong("journal.submitted", "2026-09-13T01:02:30Z"),
        dong("role-switch.started", "2026-09-13T01:02:00Z"),
      ]),
    ).toHaveLength(3);
  });

  it("ba hành động xem thử đều được nhận ra để đặt tên người ngay sau nhãn", async () => {
    const { isErpRoleSwitchAction } = await import("@/domain/erp-audit-labels");
    for (const ma of ["role-switch.started", "role-switch.ended", ERP_ROLE_SWITCH_SESSION_ACTION]) {
      expect(isErpRoleSwitchAction(ma), ma).toBe(true);
    }
    expect(isErpRoleSwitchAction("journal.submitted")).toBe(false);
  });

  it("dòng bắt đầu chưa có dòng kết thúc thì giữ nguyên", () => {
    const ra = gopLuotXemThu([dong("role-switch.started", "2026-09-13T01:02:00Z")]);
    expect(ra).toHaveLength(1);
    expect(ra[0].action).toBe("role-switch.started");
  });
});
