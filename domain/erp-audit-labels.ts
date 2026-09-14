/**
 * Tên tiếng Việt cho từng hành động trong Nhật ký hệ thống.
 *
 * `erp_audit_timeline` gom tám bảng nhật ký lại, và cột hành động của phần
 * lớn các bảng ấy là **mã máy** như `cash-deposit.posted`,
 * `journal.approved-and-posted`, `role-switch.started`. Màn hình in thẳng mã
 * ấy ra, nên giám đốc mở Nhật ký là đọc thấy một dãy chữ tiếng Anh gạch nối —
 * đúng loại chữ trong phòng làm việc mà dự án đã cấm để lọt ra ngoài.
 *
 * Hành động của phần Dự án & sự kiện vốn đã ghi bằng tiếng Việt ("Gửi nghiệm
 * thu"), nên chuỗi nào không có dáng mã thì để nguyên.
 */

export const ERP_AUDIT_ACTION_LABELS: Readonly<Record<string, string>> = Object.freeze({
  // Xem theo vai trò
  "role-switch.started": "Bắt đầu xem thử với vai",
  "role-switch.ended": "Kết thúc xem thử với vai",
  "role-switch.session": "Xem thử với vai",

  // Tài khoản & phân quyền
  "account.created": "Tạo tài khoản",
  "account.updated": "Sửa thông tin tài khoản",
  "account.status.changed": "Đổi trạng thái tài khoản",
  "account.role.granted": "Cấp vai trò",
  "account.role.revoked": "Thu hồi vai trò",
  "account.auth.linked": "Cấp đăng nhập",
  "employee.access.updated": "Đổi quyền nghiệp vụ",
  "employee.site.revoked": "Thu hồi quyền tại cơ sở",

  // Chốt ca và phiếu việc
  "manager.assign": "Quản lý giao việc",
  "employee.check-in": "Nhân viên nhận việc",
  "employee.progress": "Nhân viên cập nhật tiến độ",
  "employee.submit": "Nhân viên gửi lên",
  "manager.review": "Quản lý duyệt",
  "accountant.reconcile": "Kế toán đối soát",
  "director.decide": "Giám đốc quyết định",
  "system.accounting-posted": "Hệ thống ghi sổ",
  "system.accounting-reversed": "Hệ thống ghi đảo sổ",
  "handover.submitted": "Gửi biên bản bàn giao",
  "handover.accepted": "Nhận bàn giao",
  "handover.disputed": "Không nhận bàn giao",

  // Sổ kế toán
  "journal.submitted": "Gửi bút toán chờ duyệt",
  "journal.resubmitted": "Gửi lại bút toán",
  "journal.returned": "Trả lại bút toán",
  "journal.approved-and-posted": "Duyệt và ghi sổ bút toán",
  "journal.reversal-created": "Lập bút toán đảo",
  "journal.reversal-posted": "Ghi sổ bút toán đảo",
  "journal.prepared-from-supplier-invoice": "Lập bút toán từ hoá đơn nhà cung cấp",
  "period.locked": "Khoá kỳ kế toán",
  "period.reopened": "Mở lại kỳ kế toán",
  "cash-deposit.submitted": "Nộp tiền mặt về quỹ",
  "cash-deposit.matched": "Khớp tiền nộp với sao kê",
  "cash-deposit.match-exception": "Tiền nộp bị lệch, chờ xử lý",
  "cash-deposit.checker-returned": "Người kiểm trả lại khoản nộp",
  "cash-deposit.exception-returned": "Trả lại khoản nộp lệch",
  "cash-deposit.exception-approved": "Duyệt khoản nộp lệch",
  "cash-deposit.posted": "Ghi sổ khoản nộp tiền",

  // Bán vé tại quầy
  "counter-sale.completed": "Bán vé",
  "counter-sale.voided": "Huỷ phiếu bán vé",
  "counter-price.set": "Đặt giá vé quầy",

  // Đề xuất & phê duyệt
  "staff-request.submitted": "Gửi đề xuất",
  "staff-request.escalated": "Chuyển đề xuất lên giám đốc",
  "staff-request.approved": "Duyệt đề xuất",
  "staff-request.rejected": "Từ chối đề xuất",
  "staff-request.cancelled": "Rút đề xuất",
  "staff-request.completed": "Hoàn tất đề xuất",

  // Thu tại điểm
  "on-site-payment.no-show": "Đóng khoản trả tại điểm vì khách không đến",

  // Hoá đơn nhà cung cấp
  "invoice.submitted-and-matched": "Gửi hoá đơn, đã khớp",
  "invoice.submitted-with-exception": "Gửi hoá đơn có chênh lệch",
  "invoice.resubmitted-and-matched": "Gửi lại hoá đơn, đã khớp",
  "invoice.resubmitted-with-exception": "Gửi lại hoá đơn, còn chênh lệch",
  "invoice.exception-escalated": "Chuyển hoá đơn lệch lên giám đốc",
  "invoice.exception-approved": "Duyệt hoá đơn lệch",
  "invoice.exception-returned": "Trả lại hoá đơn lệch",
  "invoice.liability-prepared": "Lập công nợ phải trả",
  "invoice.liability-posted": "Ghi sổ công nợ phải trả",
  "invoice.liability-returned": "Trả lại công nợ phải trả",
  "payment.requested": "Đề nghị thanh toán",
  "payment.settled": "Đã thanh toán nhà cung cấp",
  "payment.returned": "Trả lại đề nghị thanh toán",
});

/** Dáng một mã máy: một cụm chữ thường không dấu, không khoảng trắng, có thể nối bằng chấm hoặc gạch. */
const DANG_MA_MAY = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/;

/**
 * Tên hiển thị cho một hành động.
 *
 * Mã chưa có trong bảng thì **không** in mã ra: trả về "Thao tác khác", và
 * màn hình giữ mã gốc trong chú thích khi rê chuột, để người cần truy vết vẫn
 * lần ra được mà giám đốc không phải đọc chữ máy.
 */
export function erpAuditActionLabel(action: string): string {
  const nhan = ERP_AUDIT_ACTION_LABELS[action];
  if (nhan) return nhan;
  if (DANG_MA_MAY.test(action)) return "Thao tác khác";
  return action;
}

/** Hành động tổng hợp: một lượt xem thử đã gộp cả lúc bắt đầu lẫn lúc kết thúc. */
export const ERP_ROLE_SWITCH_SESSION_ACTION = "role-switch.session";

/**
 * Ba hành động xem thử đều ghi tên người được xem vào ô ghi chú, nên màn hình
 * đặt tên ấy ngay sau nhãn thay vì để một dòng "Bắt đầu xem thử với vai" cụt.
 *
 * Bộ smoke chuyển thẳng từ vai này sang vai khác mà không kết thúc ở giữa,
 * nên nhiều dòng "bắt đầu" không có cặp để gộp — đo trên production ngày
 * 13/09/2026 còn 28 dòng như vậy, và trước lượt sửa này không dòng nào nói
 * được là xem thử với ai.
 */
export function isErpRoleSwitchAction(action: string) {
  return action.startsWith("role-switch.");
}

type DongNhatKy = {
  action: string;
  actorAccountId: string;
  entityId: string | null;
  occurredAt: string;
};

/**
 * Gộp mỗi cặp "bắt đầu xem thử" + "kết thúc xem thử" thành một dòng.
 *
 * Đọc thẳng Nhật ký trên production ngày 13/09/2026: **180 trên 200 dòng mới
 * nhất** là hai hành động này, phần lớn do bộ smoke chuyển vai tạo ra. Mỗi lượt
 * xem thử đẻ ra hai dòng, nên những việc thật (chốt ca, ghi sổ, cấp quyền) bị
 * vùi dưới cả trăm dòng lặp. Gộp lại thì chỉ còn một nửa, và mỗi dòng nói trọn
 * một ý: ai xem thử với vai nào, từ lúc nào tới lúc nào.
 *
 * Chỉ gộp khi hai dòng **liền nhau** trong danh sách (mới nhất đứng trước),
 * cùng người thao tác và cùng tài khoản được xem. Lệch bất cứ điều gì thì để
 * nguyên cả hai — thà dài hơn một dòng còn hơn ghép nhầm hai lượt khác nhau.
 */
export function gopLuotXemThu<T extends DongNhatKy>(
  entries: readonly T[],
): Array<T & { endedAt?: string }> {
  const ra: Array<T & { endedAt?: string }> = [];
  for (let i = 0; i < entries.length; i += 1) {
    const hienTai = entries[i];
    const truocDo = entries[i + 1];
    if (
      hienTai.action === "role-switch.ended" &&
      truocDo?.action === "role-switch.started" &&
      truocDo.actorAccountId === hienTai.actorAccountId &&
      truocDo.entityId === hienTai.entityId
    ) {
      ra.push({
        ...truocDo,
        action: ERP_ROLE_SWITCH_SESSION_ACTION,
        endedAt: hienTai.occurredAt,
      });
      i += 1;
      continue;
    }
    ra.push({ ...hienTai });
  }
  return ra;
}
