import { describe, expect, it } from "vitest";
import {
  createWorkdayAssignment,
  transitionWorkday,
  workdayLocationFromCheckIn,
  type WorkdayActor,
  type WorkdayEvidence,
} from "@/domain/erp-workday";

const manager: WorkdayActor = {
  id: "manager-trang-an",
  name: "Lê Hoàng Nam",
  role: "manager",
};

const employee: WorkdayActor = {
  id: "employee-trang-an-01",
  name: "Đỗ Thị Lan",
  role: "employee",
};

const photo: WorkdayEvidence = {
  id: "evidence-001",
  kind: "photo",
  fileName: "cong-a.jpg",
  storagePath: "trang-an/employee-trang-an-01/cong-a.jpg",
  mimeType: "image/jpeg",
  sizeBytes: 1_024,
  uploadedAt: "2026-07-29T03:15:00.000Z",
  uploadedBy: employee.id,
  capturedAt: "2026-07-29T03:14:58.000Z",
  latitude: 20.25245,
  longitude: 105.91755,
  accuracy: 12,
  distanceMeters: 0,
  siteVerified: true,
};

function assignedRecord() {
  return createWorkdayAssignment({
    id: "workday-record-001",
    code: "WD-TA-20260729-001",
    siteId: "trang-an",
    businessDate: "2026-07-29",
    employee,
    manager,
    moduleId: "check-in-khach",
    station: "Cổng A",
    shiftLabel: "07:30–12:15",
    taskTitle: "Xác thực đoàn TA-018",
    instructions: "Kiểm tra quyền lợi trước khi cho đoàn qua cổng.",
    priority: "high",
    dueAt: "2026-07-29T04:30:00.000Z",
    evidenceRequired: true,
    idempotencyKey: "assign-workday-001",
    createdAt: "2026-07-29T00:15:00.000Z",
    auditEventId: "audit-assign-001",
  });
}

describe("ERP workday lifecycle", () => {
  it("runs one employee from assignment through GPS check-in, evidence and manager approval", () => {
    const checkedIn = transitionWorkday(assignedRecord(), {
      type: "employee.check-in",
      actor: employee,
      latitude: 20.25245,
      longitude: 105.91755,
      accuracy: 12,
      at: "2026-07-29T00:30:00.000Z",
      auditEventId: "audit-check-in",
    });
    const inProgress = transitionWorkday(checkedIn, {
      type: "employee.progress",
      actor: employee,
      progressPercent: 60,
      note: "Đã xác thực 26 trong 42 khách của đoàn.",
      at: "2026-07-29T02:00:00.000Z",
      auditEventId: "audit-progress",
    });
    const submitted = transitionWorkday(inProgress, {
      type: "employee.submit",
      actor: employee,
      note: "Đoàn 42 khách đã qua cổng, không phát sinh vé sai.",
      evidence: photo,
      at: "2026-07-29T03:15:00.000Z",
      auditEventId: "audit-submit",
    });
    const approved = transitionWorkday(submitted, {
      type: "manager.review",
      actor: manager,
      decision: "approve",
      note: "Ảnh và số khách đã khớp.",
      at: "2026-07-29T03:25:00.000Z",
      auditEventId: "audit-approve",
    });

    expect(approved.status).toBe("approved");
    expect(approved.progressPercent).toBe(100);
    expect(approved.checkInAt).toBe("2026-07-29T00:30:00.000Z");
    expect(approved.checkOutAt).toBe("2026-07-29T03:15:00.000Z");
    expect(approved.evidence).toHaveLength(1);
    expect(approved.version).toBe(5);
    expect(approved.auditTrail.map((event) => event.action)).toEqual([
      "manager.assign",
      "employee.check-in",
      "employee.progress",
      "employee.submit",
      "manager.review",
    ]);
  });

  it("returns the same record to the employee and lets them resubmit evidence", () => {
    const checkedIn = transitionWorkday(assignedRecord(), {
      type: "employee.check-in",
      actor: employee,
      latitude: 20.25245,
      longitude: 105.91755,
      accuracy: 12,
      at: "2026-07-29T00:30:00.000Z",
      auditEventId: "audit-check-in",
    });
    const submitted = transitionWorkday(checkedIn, {
      type: "employee.submit",
      actor: employee,
      note: "Đã hoàn tất kiểm tra cổng.",
      evidence: photo,
      at: "2026-07-29T03:15:00.000Z",
      auditEventId: "audit-submit",
    });
    const returned = transitionWorkday(submitted, {
      type: "manager.review",
      actor: manager,
      decision: "return",
      note: "Cần bổ sung ảnh toàn cảnh cổng.",
      at: "2026-07-29T03:20:00.000Z",
      auditEventId: "audit-return",
    });
    expect(returned.checkOutAt).toBeNull();
    const resubmitted = transitionWorkday(returned, {
      type: "employee.submit",
      actor: employee,
      note: "Đã bổ sung ảnh toàn cảnh theo yêu cầu.",
      evidence: {
        ...photo,
        id: "evidence-002",
        storagePath: "trang-an/employee-trang-an-01/cong-a-toan-canh.jpg",
        fileName: "cong-a-toan-canh.jpg",
        capturedAt: "2026-07-29T03:29:58.000Z",
        uploadedAt: "2026-07-29T03:30:00.000Z",
      },
      at: "2026-07-29T03:30:00.000Z",
      auditEventId: "audit-resubmit",
    });

    expect(resubmitted.id).toBe(returned.id);
    expect(resubmitted.status).toBe("submitted");
    expect(resubmitted.evidence).toHaveLength(2);
    expect(resubmitted.checkOutAt).toBe("2026-07-29T03:30:00.000Z");
  });

  it("blocks work before check-in and blocks handover without required photo", () => {
    const assigned = assignedRecord();
    expect(() =>
      transitionWorkday(assigned, {
        type: "employee.progress",
        actor: employee,
        progressPercent: 25,
        note: "Bắt đầu kiểm tra cổng.",
        at: "2026-07-29T00:20:00.000Z",
        auditEventId: "audit-invalid-progress",
      }),
    ).toThrow(/trạng thái assigned/);

    const checkedIn = transitionWorkday(assigned, {
      type: "employee.check-in",
      actor: employee,
      latitude: 20.25245,
      longitude: 105.91755,
      accuracy: 12,
      at: "2026-07-29T00:30:00.000Z",
      auditEventId: "audit-check-in",
    });
    expect(() =>
      transitionWorkday(checkedIn, {
        type: "employee.submit",
        actor: employee,
        note: "Đã hoàn tất.",
        at: "2026-07-29T03:15:00.000Z",
        auditEventId: "audit-submit-without-photo",
      }),
    ).toThrow(/một ảnh mới/);
  });

  it("does not let a progress photo satisfy required final handover evidence", () => {
    const checkedIn = transitionWorkday(assignedRecord(), {
      type: "employee.check-in",
      actor: employee,
      latitude: 20.25245,
      longitude: 105.91755,
      accuracy: 12,
      at: "2026-07-29T00:30:00.000Z",
      auditEventId: "audit-check-in",
    });
    const inProgress = transitionWorkday(checkedIn, {
      type: "employee.progress",
      actor: employee,
      progressPercent: 50,
      note: "Đã kiểm tra một nửa số khách.",
      evidence: { ...photo, capturedAt: "2026-07-29T02:00:00.000Z" },
      at: "2026-07-29T02:00:00.000Z",
      auditEventId: "audit-progress-photo",
    });

    expect(() =>
      transitionWorkday(inProgress, {
        type: "employee.submit",
        actor: employee,
        note: "Đã hoàn tất kiểm tra.",
        at: "2026-07-29T03:15:00.000Z",
        auditEventId: "audit-submit-with-progress-photo",
      }),
    ).toThrow(/Mỗi lần bàn giao.*ảnh mới/);
  });

  it("requires a fresh photo recorded after a manager return", () => {
    const checkedIn = transitionWorkday(assignedRecord(), {
      type: "employee.check-in",
      actor: employee,
      latitude: 20.25245,
      longitude: 105.91755,
      accuracy: 12,
      at: "2026-07-29T00:30:00.000Z",
      auditEventId: "audit-check-in",
    });
    const submitted = transitionWorkday(checkedIn, {
      type: "employee.submit",
      actor: employee,
      note: "Đã hoàn tất kiểm tra cổng.",
      evidence: photo,
      at: "2026-07-29T03:15:00.000Z",
      auditEventId: "audit-submit",
    });
    const returned = transitionWorkday(submitted, {
      type: "manager.review",
      actor: manager,
      decision: "return",
      note: "Cần bổ sung ảnh toàn cảnh cổng.",
      at: "2026-07-29T03:20:00.000Z",
      auditEventId: "audit-return",
    });

    expect(() =>
      transitionWorkday(returned, {
        type: "employee.submit",
        actor: employee,
        note: "Đã bổ sung nội dung nhưng chưa chụp ảnh mới.",
        at: "2026-07-29T03:30:00.000Z",
        auditEventId: "audit-resubmit-no-photo",
      }),
    ).toThrow(/một ảnh mới/);
    expect(() =>
      transitionWorkday(returned, {
        type: "employee.submit",
        actor: employee,
        note: "Đã chọn lại ảnh cũ.",
        evidence: {
          ...photo,
          id: "evidence-old-copy",
          storagePath: "trang-an/employee-trang-an-01/old-copy.jpg",
        },
        at: "2026-07-29T03:30:00.000Z",
        auditEventId: "audit-resubmit-old-photo",
      }),
    ).toThrow(/sau yêu cầu của quản lý/);
  });

  it("requires finite GPS accuracy from 1 to 250 metres at check-in", () => {
    for (const accuracy of [null, 0, -1, 251, Number.NaN]) {
      expect(() =>
        transitionWorkday(assignedRecord(), {
          type: "employee.check-in",
          actor: employee,
          latitude: 20.25245,
          longitude: 105.91755,
          accuracy,
          at: "2026-07-29T00:30:00.000Z",
          auditEventId: `audit-invalid-accuracy-${String(accuracy)}`,
        }),
      ).toThrow(/Độ chính xác GPS.*250 m/);
    }
  });

  it("synthesizes the latest location from a committed check-in", () => {
    const checkedIn = transitionWorkday(assignedRecord(), {
      type: "employee.check-in",
      actor: employee,
      latitude: 20.25245,
      longitude: 105.91755,
      accuracy: 12,
      at: "2026-07-29T00:30:00.000Z",
      auditEventId: "audit-check-in",
    });

    expect(
      workdayLocationFromCheckIn(checkedIn, {
        distanceMeters: 8,
        insideGeofence: true,
      }),
    ).toMatchObject({
      workdayId: checkedIn.id,
      employeeAccountId: employee.id,
      latitude: 20.25245,
      longitude: 105.91755,
      accuracy: 12,
      distanceMeters: 8,
      insideGeofence: true,
      recordedAt: "2026-07-29T00:30:00.000Z",
    });
  });

  it("blocks another employee and another manager from acting on the record", () => {
    const assigned = assignedRecord();
    expect(() =>
      transitionWorkday(assigned, {
        type: "employee.check-in",
        actor: { ...employee, id: "employee-other" },
        latitude: 20.25245,
        longitude: 105.91755,
        accuracy: 12,
        at: "2026-07-29T00:30:00.000Z",
        auditEventId: "audit-wrong-employee",
      }),
    ).toThrow(/không đúng/);
  });
});
