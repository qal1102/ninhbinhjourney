import { describe, expect, it } from "vitest";
import {
  STAFF_REQUEST_DIRECTOR_THRESHOLD_VND,
  applyStaffRequestTransition,
  parseStaffRequest,
  staffRequestActionsFor,
  staffRequestNeedsDirector,
  staffRequestSummary,
  staffRequestViewerCanSubmit,
  staffRequestVisibleTo,
  staffRequestWaitsOn,
  validateStaffRequestDraft,
  type StaffRequest,
  type StaffRequestViewer,
} from "@/domain/erp-staff-requests";

const HOM_NAY = "2026-09-14";
const nv: StaffRequestViewer & { name: string } = { id: "employee-trang-an-01", name: "Lê Minh Tuấn", role: "employee", siteIds: ["trang-an"] };
const nv2: StaffRequestViewer & { name: string } = { id: "employee-trang-an-02", name: "Đỗ Thị Lan", role: "employee", siteIds: ["trang-an"] };
const ql: StaffRequestViewer & { name: string } = { id: "manager-trang-an", name: "Phạm Quang Huy", role: "manager", siteIds: ["trang-an"] };
const qlKhac: StaffRequestViewer & { name: string } = { id: "manager-tam-coc", name: "Quản lý Tam Cốc", role: "manager", siteIds: ["tam-coc"] };
const gd: StaffRequestViewer & { name: string } = { id: "director-001", name: "Nguyễn Minh Anh", role: "director", siteIds: ["trang-an", "tam-coc", "tam-chuc", "bai-dinh"] };
const kt: StaffRequestViewer & { name: string } = { id: "accountant-001", name: "Kế toán", role: "accountant", siteIds: ["trang-an", "tam-coc", "tam-chuc", "bai-dinh"] };

function deXuat(ghiDe: Partial<StaffRequest> = {}): StaffRequest {
  return {
    code: "DX-0123456789",
    siteId: "trang-an",
    type: "tam-ung",
    status: "submitted",
    details: { purpose: "Mua vật tư sơ cứu" },
    amountVnd: 2_000_000,
    requestedById: nv.id,
    requestedByName: nv.name,
    lastActorName: null,
    lastNote: null,
    createdAt: "2026-09-14T01:00:00Z",
    updatedAt: "2026-09-14T01:00:00Z",
    needsDirector: false,
    events: [],
    ...ghiDe,
  };
}

const LUC = "2026-09-14T02:00:00Z";

describe("ERP-DE-XUAT-01 — kiểm đầu vào trước khi gửi", () => {
  it("xin nghỉ: đúng ngày, có lý do thì gửi được, và chỉ giữ đúng trường của loại ấy", () => {
    const ketQua = validateStaffRequestDraft({
      type: "nghi-phep",
      fields: { from_date: "2026-09-16", to_date: "2026-09-17", reason: "Việc gia đình", rac: "bỏ đi" },
      today: HOM_NAY,
    });
    expect(ketQua).toEqual({
      ok: true,
      details: { from_date: "2026-09-16", to_date: "2026-09-17", reason: "Việc gia đình" },
      amountVnd: null,
    });
  });

  it("xin nghỉ: ngày kết thúc trước ngày bắt đầu, nghỉ quá 60 ngày, nghỉ bù quá 30 ngày đều bị chặn", () => {
    const thu = (from_date: string, to_date: string) =>
      validateStaffRequestDraft({ type: "nghi-phep", fields: { from_date, to_date, reason: "Việc gia đình" }, today: HOM_NAY }).ok;
    expect(thu("2026-09-20", "2026-09-18")).toBe(false);
    expect(thu("2026-09-20", "2026-11-20")).toBe(false);
    expect(thu("2026-08-01", "2026-08-02")).toBe(false);
    expect(thu("2026-09-31", "2026-10-01")).toBe(false);
    expect(thu("2026-08-20", "2026-08-21")).toBe(true);
  });

  it("đổi ca không cho ngày đã qua", () => {
    const ketQua = validateStaffRequestDraft({
      type: "doi-ca",
      fields: { shift_date: "2026-09-13", current_shift: "Sáng", desired_shift: "Chiều", reason: "Đi khám bệnh" },
      today: HOM_NAY,
    });
    expect(ketQua).toEqual({ ok: false, reason: "Không đổi ca cho ngày đã qua." });
  });

  it("tạm ứng đọc số tiền có dấu chấm, và chặn quá 100 triệu", () => {
    expect(
      validateStaffRequestDraft({ type: "tam-ung", fields: { amount_vnd: "2.500.000", purpose: "Mua vật tư sơ cứu" }, today: HOM_NAY }),
    ).toEqual({ ok: true, details: { purpose: "Mua vật tư sơ cứu" }, amountVnd: 2_500_000 });
    expect(
      validateStaffRequestDraft({ type: "tam-ung", fields: { amount_vnd: "100000001", purpose: "Mua vật tư sơ cứu" }, today: HOM_NAY }).ok,
    ).toBe(false);
  });

  it("sửa chữa không bắt buộc số tiền, nhưng phải chọn mức gấp", () => {
    expect(
      validateStaffRequestDraft({ type: "sua-chua", fields: { location: "Bến số 2", problem: "Tay vịn lung lay", urgency: "gap" }, today: HOM_NAY }),
    ).toEqual({ ok: true, details: { location: "Bến số 2", problem: "Tay vịn lung lay", urgency: "gap" }, amountVnd: null });
    expect(
      validateStaffRequestDraft({ type: "sua-chua", fields: { location: "Bến số 2", problem: "Tay vịn lung lay" }, today: HOM_NAY }).ok,
    ).toBe(false);
  });

  it("xin huỷ phiếu quầy cần đúng dạng mã phiếu và lý do đủ dài", () => {
    expect(validateStaffRequestDraft({ type: "huy-phieu-quay", fields: { sale_code: "pt-0a1b2c3d4e5f", reason: "Bán nhầm hai vé thành một" }, today: HOM_NAY })).toEqual({
      ok: true,
      details: { sale_code: "PT-0A1B2C3D4E5F", reason: "Bán nhầm hai vé thành một" },
      amountVnd: null,
    });
    expect(validateStaffRequestDraft({ type: "huy-phieu-quay", fields: { sale_code: "PT-123", reason: "Bán nhầm hai vé thành một" }, today: HOM_NAY }).ok).toBe(false);
    expect(validateStaffRequestDraft({ type: "huy-phieu-quay", fields: { sale_code: "PT-0A1B2C3D4E5F", reason: "Nhầm" }, today: HOM_NAY }).ok).toBe(false);
  });
});

describe("ERP-DE-XUAT-01 — ai gửi, ai thấy, ai xử lý", () => {
  it("giám đốc không gửi đề xuất; nhân viên chỉ gửi ở cơ sở mình; kế toán gửi ở mọi cơ sở", () => {
    expect(staffRequestViewerCanSubmit(gd, "trang-an")).toBe(false);
    expect(staffRequestViewerCanSubmit(nv, "trang-an")).toBe(true);
    expect(staffRequestViewerCanSubmit(nv, "tam-coc")).toBe(false);
    expect(staffRequestViewerCanSubmit(kt, "bai-dinh")).toBe(true);
  });

  it("nhân viên khác không thấy; quản lý cơ sở khác không thấy; kế toán chỉ thấy khoản tiền", () => {
    const ungTien = deXuat();
    const nghi = deXuat({ type: "nghi-phep", amountVnd: null, details: { from_date: "2026-09-16", to_date: "2026-09-16", reason: "Ốm" } });
    expect(staffRequestVisibleTo(nv2, ungTien)).toBe(false);
    expect(staffRequestVisibleTo(qlKhac, ungTien)).toBe(false);
    expect(staffRequestVisibleTo(ql, nghi)).toBe(true);
    expect(staffRequestVisibleTo(kt, ungTien)).toBe(true);
    expect(staffRequestVisibleTo(kt, nghi)).toBe(false);
    expect(staffRequestVisibleTo(gd, nghi)).toBe(true);
  });

  it("nút đúng người: quản lý duyệt, người gửi rút, không ai duyệt đề xuất của mình", () => {
    const r = deXuat();
    expect(staffRequestActionsFor(ql, r)).toMatchObject({ canDecide: true, canCancel: false });
    expect(staffRequestActionsFor(nv, r)).toMatchObject({ canDecide: false, canCancel: true, waitingFor: "Chờ quản lý cơ sở duyệt." });
    expect(staffRequestActionsFor(qlKhac, r).canDecide).toBe(false);
    const cuaQuanLy = deXuat({ requestedById: ql.id });
    expect(staffRequestActionsFor(ql, cuaQuanLy).canDecide).toBe(false);
    expect(staffRequestWaitsOn(gd, cuaQuanLy)).toBe(true);
  });

  it("đã duyệt: tạm ứng chờ kế toán chi, sửa chữa chờ quản lý ghi đã sửa", () => {
    expect(staffRequestActionsFor(kt, deXuat({ status: "approved" }))).toMatchObject({ canComplete: true, completeLabel: "Ghi đã chi tạm ứng" });
    expect(staffRequestActionsFor(ql, deXuat({ status: "approved" })).canComplete).toBe(false);
    const sua = deXuat({ type: "sua-chua", status: "approved", amountVnd: null });
    expect(staffRequestActionsFor(ql, sua)).toMatchObject({ canComplete: true, completeLabel: "Ghi đã sửa xong" });
    expect(staffRequestActionsFor(kt, sua).canComplete).toBe(false);
  });
});

describe("ERP-DE-XUAT-01 — chuyển trạng thái, chép đúng các hàm SQL", () => {
  it("ngưỡng lên giám đốc là trên 5.000.000 đồng, chỉ cho khoản có tiền", () => {
    expect(STAFF_REQUEST_DIRECTOR_THRESHOLD_VND).toBe(5_000_000);
    expect(staffRequestNeedsDirector("tam-ung", 5_000_000)).toBe(false);
    expect(staffRequestNeedsDirector("tam-ung", 5_000_001)).toBe(true);
    expect(staffRequestNeedsDirector("sua-chua", 9_000_000)).toBe(true);
    expect(staffRequestNeedsDirector("nghi-phep", 9_000_000)).toBe(false);
  });

  it("tạm ứng 8 triệu: quản lý đồng ý thì chuyển giám đốc, giám đốc duyệt, kế toán chi", () => {
    const r0 = deXuat({ amountVnd: 8_000_000 });
    const b1 = applyStaffRequestTransition(r0, ql, { kind: "decide", decision: "approve", note: "" }, LUC);
    expect(b1).toMatchObject({ ok: true, eventType: "staff-request.escalated", request: { status: "pending-director" } });
    if (!b1.ok) return;
    expect(applyStaffRequestTransition(b1.request, ql, { kind: "decide", decision: "approve", note: "" }, LUC)).toEqual({
      ok: false,
      code: "STAFF_REQUEST_DIRECTOR_ONLY",
    });
    const b2 = applyStaffRequestTransition(b1.request, gd, { kind: "decide", decision: "approve", note: "Đồng ý" }, LUC);
    expect(b2).toMatchObject({ ok: true, request: { status: "approved" } });
    if (!b2.ok) return;
    expect(applyStaffRequestTransition(b2.request, ql, { kind: "complete", note: "Đã chi xong" }, LUC)).toEqual({
      ok: false,
      code: "STAFF_REQUEST_COMPLETE_NOT_ALLOWED",
    });
    const b3 = applyStaffRequestTransition(b2.request, kt, { kind: "complete", note: "Đã chi, phiếu chi PC-01" }, LUC);
    expect(b3).toMatchObject({ ok: true, request: { status: "completed", lastNote: "Đã chi, phiếu chi PC-01" } });
    if (b3.ok) expect(b3.request.events.map((e) => e.toStatus)).toEqual(["pending-director", "approved", "completed"]);
  });

  it("giám đốc duyệt thẳng khoản vượt ngưỡng thì không tự chuyển lên chính mình", () => {
    const ketQua = applyStaffRequestTransition(deXuat({ amountVnd: 8_000_000 }), gd, { kind: "decide", decision: "approve", note: "" }, LUC);
    expect(ketQua).toMatchObject({ ok: true, request: { status: "approved" } });
  });

  it("từ chối phải có lý do; tự duyệt, tự rút của người khác, rút khi đã xét đều bị chặn", () => {
    const r = deXuat();
    expect(applyStaffRequestTransition(r, ql, { kind: "decide", decision: "reject", note: "" }, LUC)).toEqual({ ok: false, code: "STAFF_REQUEST_REASON_REQUIRED" });
    expect(applyStaffRequestTransition(r, nv, { kind: "decide", decision: "approve", note: "" }, LUC)).toEqual({ ok: false, code: "STAFF_REQUEST_OWN_REQUEST" });
    expect(applyStaffRequestTransition(r, nv2, { kind: "cancel" }, LUC)).toEqual({ ok: false, code: "STAFF_REQUEST_CANCEL_NOT_ALLOWED" });
    expect(applyStaffRequestTransition(deXuat({ status: "approved" }), nv, { kind: "cancel" }, LUC)).toEqual({ ok: false, code: "STAFF_REQUEST_NOT_PENDING" });
    expect(applyStaffRequestTransition(r, qlKhac, { kind: "decide", decision: "approve", note: "" }, LUC)).toEqual({ ok: false, code: "STAFF_REQUEST_DECIDE_NOT_ALLOWED" });
    expect(applyStaffRequestTransition(deXuat({ type: "nghi-phep", status: "approved", amountVnd: null }), ql, { kind: "complete", note: "Xong rồi nhé" }, LUC)).toEqual({
      ok: false,
      code: "STAFF_REQUEST_NOT_COMPLETABLE",
    });
  });
});

describe("ERP-DE-XUAT-01 — đọc từ máy chủ và tóm tắt", () => {
  const coSo = new Map([["10000000-0000-4000-8000-000000000001", "trang-an" as const]]);

  it("đọc đúng đề xuất, bỏ qua loại hay trạng thái lạ", () => {
    const goc = {
      request_code: "DX-0123456789",
      site_id: "10000000-0000-4000-8000-000000000001",
      request_type: "tam-ung",
      status: "pending-director",
      details: { purpose: "Mua vật tư", la: { long: 1 } },
      amount_vnd: 8000000,
      requested_by_account_id: "employee-trang-an-01",
      requested_by_name: "Lê Minh Tuấn",
      needs_director: true,
      events: [{ event_type: "staff-request.submitted", from_status: null, to_status: "submitted", actor_name: "Lê Minh Tuấn", note: "", occurred_at: LUC }],
    };
    const r = parseStaffRequest(goc, coSo);
    expect(r).toMatchObject({ code: "DX-0123456789", siteId: "trang-an", amountVnd: 8_000_000, needsDirector: true, details: { purpose: "Mua vật tư" } });
    expect(r?.events).toHaveLength(1);
    expect(parseStaffRequest({ ...goc, request_type: "an-trua" }, coSo)).toBeNull();
    expect(parseStaffRequest({ ...goc, status: "archived" }, coSo)).toBeNull();
    expect(parseStaffRequest({ ...goc, site_id: "khac" }, coSo)).toBeNull();
  });

  it("tóm tắt bằng tiếng Việt, ngày theo kiểu Việt Nam", () => {
    expect(staffRequestSummary({ type: "nghi-phep", amountVnd: null, details: { from_date: "2026-09-16", to_date: "2026-09-17", reason: "Việc nhà" } })).toBe(
      "Nghỉ từ 16/09/2026 tới 17/09/2026: Việc nhà",
    );
    expect(staffRequestSummary({ type: "tam-ung", amountVnd: 2_000_000, details: { purpose: "Mua vật tư" } })).toBe("Ứng 2.000.000 đ: Mua vật tư");
    expect(staffRequestSummary({ type: "huy-phieu-quay", amountVnd: null, details: { sale_code: "PT-0A1B2C3D4E5F", sale_total_vnd: 250000, reason: "Bán nhầm" } })).toBe(
      "Phiếu PT-0A1B2C3D4E5F (250.000 đ): Bán nhầm",
    );
  });
});
