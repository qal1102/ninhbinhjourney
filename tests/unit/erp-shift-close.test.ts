import { describe, expect, it } from "vitest";
import {
  SHIFT_CLOSE_MATERIALITY_VND,
  buildShiftCloseJournalProposal,
  computeShiftCloseDifference,
  createShiftCloseSubmission,
  filterShiftCloseQueue,
  isBalancedJournalProposal,
  journalProposalTotals,
  transitionShiftClose,
  type ShiftCloseActor,
} from "@/domain/erp-shift-close";

const employee: ShiftCloseActor = {
  id: "employee-trang-an-01",
  name: "Đỗ Thị Lan",
  role: "employee",
};
const manager: ShiftCloseActor = {
  id: "manager-trang-an",
  name: "Lê Hoàng Nam",
  role: "manager",
};
const accountant: ShiftCloseActor = {
  id: "accountant-001",
  name: "Phạm Thu Trang",
  role: "accountant",
};
const director: ShiftCloseActor = {
  id: "director-001",
  name: "Nguyễn Minh Anh",
  role: "director",
};

function submission(differenceVnd = 0) {
  const grossVnd = 79_400_000;
  const refundVnd = 0;
  const cashVnd = 32_000_000;
  const cardVnd = grossVnd + differenceVnd - cashVnd;
  return createShiftCloseSubmission({
    id: "90000000-0000-4000-8000-000000000001",
    shiftCode: "SHIFT-TA-GATE-A-20260728-AM",
    idempotencyKey: "test-shift-ta-am",
    siteId: "trang-an",
    businessDate: "2026-07-28",
    station: "Cổng A",
    shiftLabel: "07:30–12:15",
    shiftStartedAt: "2026-07-28T07:30:00+07:00",
    shiftEndedAt: "2026-07-28T12:15:00+07:00",
    ticketsSold: 462,
    financeCode: "OPS-TA-SHIFT",
    note: "Đã kiểm đếm đủ vé và tiền bàn giao.",
    amounts: { grossVnd, refundVnd, cashVnd, cardVnd },
    actor: employee,
    now: "2026-07-28T12:16:00+07:00",
    auditEventId: "audit-submit",
  });
}

describe("ERP shift-close golden path", () => {
  it("computes the variance on the server-side model", () => {
    expect(
      computeShiftCloseDifference({
        grossVnd: 79_400_000,
        refundVnd: 1_000_000,
        cashVnd: 30_000_000,
        cardVnd: 48_400_000,
      }),
    ).toBe(0);
  });

  it("moves a matched shift through employee, manager and accountant without the director", () => {
    const created = submission();
    const approved = transitionShiftClose(created, {
      type: "manager.review",
      decision: "approve",
      actor: manager,
      note: "Đã kiểm quỹ và đối chiếu báo cáo máy bán vé.",
      now: "2026-07-28T12:25:00+07:00",
      auditEventId: "audit-manager",
    });
    const reviewed = transitionShiftClose(approved, {
      type: "accountant.reconcile",
      decision: "review",
      actor: accountant,
      note: "Đã nhận đủ báo cáo ca và biên bản bàn giao.",
      now: "2026-07-28T12:40:00+07:00",
      auditEventId: "audit-accounting-review",
    });
    const posted = transitionShiftClose(reviewed, {
      type: "accountant.reconcile",
      decision: "post",
      actor: accountant,
      note: "Số liệu khớp, ghi nhận sổ doanh thu ca.",
      journalReference: "JV-20260728-001",
      now: "2026-07-28T12:45:00+07:00",
      auditEventId: "audit-accounting-post",
    });

    expect(posted.status).toBe("posted");
    expect(posted.version).toBe(4);
    expect(posted.auditTrail).toHaveLength(4);
    expect(
      filterShiftCloseQueue([posted], {
        role: "director",
        siteIds: ["trang-an"],
      }),
    ).toHaveLength(0);
  });

  it("requires a director decision before posting a material exception", () => {
    const created = submission(-18_000_000);
    const approved = transitionShiftClose(created, {
      type: "manager.review",
      decision: "approve",
      actor: manager,
      note: "Đã xác minh chênh lệch và chuyển kế toán.",
      now: "2026-07-28T12:25:00+07:00",
      auditEventId: "audit-manager",
    });
    expect(() =>
      transitionShiftClose(approved, {
        type: "accountant.reconcile",
        decision: "post",
        actor: accountant,
        note: "Thử ghi sổ khi chưa duyệt ngoại lệ.",
        journalReference: "JV-INVALID",
        now: "2026-07-28T12:40:00+07:00",
        auditEventId: "audit-invalid",
      }),
    ).toThrow(/giám đốc/);

    const escalated = transitionShiftClose(approved, {
      type: "accountant.reconcile",
      decision: "escalate",
      actor: accountant,
      note: "Thiếu 18 triệu, settlement QR chưa về tài khoản.",
      now: "2026-07-28T12:41:00+07:00",
      auditEventId: "audit-escalate",
    });
    expect(escalated.status).toBe("exception-pending-director");
    expect(
      filterShiftCloseQueue([escalated], {
        role: "director",
        siteIds: ["trang-an"],
      }),
    ).toHaveLength(1);

    const decided = transitionShiftClose(escalated, {
      type: "director.decide",
      decision: "approve",
      actor: director,
      note: "Treo khoản chênh lệch và theo dõi settlement trong ngày.",
      now: "2026-07-28T12:50:00+07:00",
      auditEventId: "audit-director",
    });
    const posted = transitionShiftClose(decided, {
      type: "accountant.reconcile",
      decision: "post",
      actor: accountant,
      note: "Ghi sổ theo phương án ngoại lệ đã được duyệt.",
      journalReference: "JV-20260728-002",
      now: "2026-07-28T13:00:00+07:00",
      auditEventId: "audit-post",
    });
    expect(posted.status).toBe("posted");
  });

  it("returns a shift to its employee and preserves one audit trail when resubmitted", () => {
    const created = submission();
    const returned = transitionShiftClose(created, {
      type: "manager.review",
      decision: "return",
      actor: manager,
      note: "Bổ sung biên bản kiểm quỹ và bảng kê giao dịch QR.",
      now: "2026-07-28T12:25:00+07:00",
      auditEventId: "audit-manager-return",
    });
    const resubmitted = transitionShiftClose(returned, {
      type: "employee.submit",
      actor: employee,
      note: "Đã bổ sung biên bản kiểm quỹ và bảng kê QR theo yêu cầu.",
      now: "2026-07-28T12:35:00+07:00",
      auditEventId: "audit-employee-resubmit",
    });
    const approved = transitionShiftClose(resubmitted, {
      type: "manager.review",
      decision: "approve",
      actor: manager,
      note: "Hồ sơ bổ sung đầy đủ, chuyển kế toán đối soát.",
      now: "2026-07-28T12:40:00+07:00",
      auditEventId: "audit-manager-approve",
    });

    expect(returned.status).toBe("manager-returned");
    expect(resubmitted.status).toBe("submitted");
    expect(approved.status).toBe("manager-approved");
    expect(approved.version).toBe(4);
    expect(approved.auditTrail.map((event) => event.toStatus)).toEqual([
      "submitted",
      "manager-returned",
      "submitted",
      "manager-approved",
    ]);
    expect(approved.amounts).toEqual(created.amounts);
    expect(approved.financeCode).toBe(created.financeCode);
  });

  it("blocks an exception below the materiality threshold", () => {
    const approved = transitionShiftClose(submission(SHIFT_CLOSE_MATERIALITY_VND), {
      type: "manager.review",
      decision: "approve",
      actor: manager,
      note: "Đã duyệt.",
      now: "2026-07-28T12:25:00+07:00",
      auditEventId: "audit-manager",
    });
    expect(() =>
      transitionShiftClose(approved, {
        type: "accountant.reconcile",
        decision: "escalate",
        actor: accountant,
        note: "Chuyển ngoại lệ.",
        now: "2026-07-28T12:30:00+07:00",
        auditEventId: "audit-escalate",
      }),
    ).toThrow(/không vượt ngưỡng/);
  });

  it("keeps the proposed accounting entry balanced for shortage and excess", () => {
    for (const difference of [-18_000_000, 0, 2_000_000]) {
      const lines = buildShiftCloseJournalProposal(submission(difference));
      expect(isBalancedJournalProposal(lines)).toBe(true);
      const totals = journalProposalTotals(lines);
      expect(totals.debitVnd).toBe(totals.creditVnd);
    }
  });

  it("rejects role and status skipping", () => {
    const created = submission();
    expect(() =>
      transitionShiftClose(created, {
        type: "director.decide",
        decision: "approve",
        actor: director,
        note: "Không được bỏ qua quản lý và kế toán.",
        now: "2026-07-28T12:20:00+07:00",
        auditEventId: "audit-skip",
      }),
    ).toThrow(/chỉ xử lý ngoại lệ/);
    expect(() =>
      transitionShiftClose(created, {
        type: "manager.review",
        decision: "approve",
        actor: employee,
        note: "Sai vai trò.",
        now: "2026-07-28T12:20:00+07:00",
        auditEventId: "audit-role",
      }),
    ).toThrow(/không được thực hiện/);
  });
});
