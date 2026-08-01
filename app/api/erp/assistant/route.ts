import { NextResponse } from "next/server";
import { z } from "zod";
import { canViewRegionalFinance } from "@/domain/erp-role-policy";
import type { ShiftCloseRecord } from "@/domain/erp-shift-close";
import type { SupplierApInvoice } from "@/domain/erp-supplier-ap";
import type { WorkdayRecord } from "@/domain/erp-workday";
import { listAccountingJournals } from "@/lib/erp/accounting-repository";
import { getCurrentErpUser } from "@/lib/erp/demo-session";
import { getIncidentCases } from "@/lib/erp/incident-repository";
import { listPendingProjectChangeRequests } from "@/lib/erp/project-repository";
import { listShiftClosures } from "@/lib/erp/shift-close-repository";
import { listSupplierAp } from "@/lib/erp/supplier-ap-repository";
import { listWorkdaysForUser } from "@/lib/erp/workday-view";

const RequestSchema = z.object({
  intent: z.enum([
    "revenue",
    "cost",
    "profit",
    "guests",
    "supplier-payables",
    "urgent",
    "inbox",
  ]),
});

type InboxItem = { label: string; count: number; href: string; hrefLabel: string };

function formatVnd(value: number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value);
}

function vietnamDateKey(value = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(value);
}

function displayDate(value: string) {
  const parsed = new Date(`${value}T00:00:00+07:00`);
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(parsed);
}

function mostRecentBusinessDate(records: readonly ShiftCloseRecord[]) {
  return records.reduce(
    (latest, record) =>
      record.businessDate > latest ? record.businessDate : latest,
    "",
  );
}

function operationalRecords(
  records: readonly ShiftCloseRecord[],
  userId: string,
  employeeOnly: boolean,
) {
  const scoped = employeeOnly
    ? records.filter((record) => record.submittedBy.id === userId)
    : records;
  const today = vietnamDateKey();
  const latest = mostRecentBusinessDate(scoped);
  const businessDate = scoped.some((record) => record.businessDate === today)
    ? today
    : latest;
  return {
    today,
    businessDate,
    records: scoped.filter((record) => record.businessDate === businessDate),
  };
}

function urgentWorkCount(
  role: string,
  userId: string,
  shifts: readonly ShiftCloseRecord[],
  workdays: readonly WorkdayRecord[],
  pendingJournals: number,
  supplierApActions: number,
) {
  if (role === "employee") {
    return (
      shifts.filter(
        (record) =>
          record.submittedBy.id === userId &&
          record.status === "manager-returned",
      ).length +
      workdays.filter(
        (record) =>
          record.employee.id === userId &&
          (record.status === "manager-returned" ||
            (record.priority === "critical" &&
              !["submitted", "approved"].includes(record.status))),
      ).length
    );
  }
  if (role === "manager") {
    return (
      shifts.filter((record) => record.status === "submitted").length +
      workdays.filter(
        (record) =>
          record.status === "submitted" ||
          (record.priority === "critical" && record.status !== "approved"),
      ).length +
      supplierApActions
    );
  }
  if (role === "accountant") {
    return (
      shifts.filter((record) =>
        ["manager-approved", "accounting-review", "director-approved"].includes(
          record.status,
        ),
      ).length +
      pendingJournals +
      supplierApActions
    );
  }
  if (role === "chief-accountant") {
    return pendingJournals + supplierApActions;
  }
  return (
    shifts.filter(
      (record) => record.status === "exception-pending-director",
    ).length + supplierApActions
  );
}

function supplierApActionsForRole(
  role: string,
  invoices: readonly SupplierApInvoice[],
) {
  return invoices.filter((invoice) => {
    if (role === "manager") {
      return (
        invoice.ownerRole === "manager" &&
        invoice.status === "match-exception"
      );
    }
    if (role === "accountant") {
      return (
        invoice.ownerRole === "accountant" &&
        [
          "match-exception",
          "ready-for-accounting",
          "accounting-returned",
        ].includes(invoice.status)
      );
    }
    if (role === "chief-accountant") {
      return (
        invoice.ownerRole === "chief-accountant" &&
        invoice.status === "accounting-review"
      );
    }
    if (role === "director") {
      return (
        invoice.ownerRole === "director" &&
        invoice.status === "director-exception"
      );
    }
    return false;
  });
}

export async function POST(request: Request) {
  const user = await getCurrentErpUser();
  if (!user) {
    return NextResponse.json(
      { message: "Phiên đăng nhập đã hết hạn." },
      { status: 401 },
    );
  }

  try {
    const { intent } = RequestSchema.parse(await request.json());
    const [allShifts, workdays, journals, supplierAp] = await Promise.all([
      listShiftClosures({ siteIds: user.siteIds }),
      listWorkdaysForUser(user),
      canViewRegionalFinance(user.role)
        ? listAccountingJournals({ siteIds: user.siteIds })
        : Promise.resolve([]),
      user.role === "employee"
        ? Promise.resolve({ suppliers: [], invoices: [] })
        : listSupplierAp({ siteIds: user.siteIds }),
    ]);
    const supplierApActions = supplierApActionsForRole(
      user.role,
      supplierAp.invoices,
    );
    const scoped = operationalRecords(
      allShifts,
      user.id,
      user.role === "employee",
    );
    const dateNote =
      scoped.businessDate && scoped.businessDate !== scoped.today
        ? `Chưa có ca chốt ngày ${displayDate(scoped.today)}; số gần nhất là ngày ${displayDate(scoped.businessDate)}.`
        : `Số ca ngày ${displayDate(scoped.businessDate || scoped.today)}.`;

    if (intent === "revenue") {
      const gross = scoped.records.reduce(
        (total, record) => total + record.amounts.grossVnd,
        0,
      );
      const refunds = scoped.records.reduce(
        (total, record) => total + record.amounts.refundVnd,
        0,
      );
      const tickets = scoped.records.reduce(
        (total, record) => total + record.ticketsSold,
        0,
      );
      return NextResponse.json({
        answer: scoped.records.length
          ? `${formatVnd(gross - refunds)} doanh thu thuần`
          : "Chưa có ca nào được chốt",
        detail: scoped.records.length
          ? `${dateNote} ${scoped.records.length} ca, ${tickets.toLocaleString("vi-VN")} vé, hoàn ${formatVnd(refunds)}.`
          : "Khi nhân viên gửi chốt ca, quản lý xác nhận và kế toán nhận hồ sơ, số sẽ xuất hiện tại đây.",
        href: canViewRegionalFinance(user.role)
          ? "/erp/finance"
          : "/erp",
        hrefLabel: "Mở số liệu nguồn",
      });
    }

    if (intent === "guests") {
      const tickets = scoped.records.reduce(
        (total, record) => total + record.ticketsSold,
        0,
      );
      return NextResponse.json({
        answer: scoped.records.length
          ? `${tickets.toLocaleString("vi-VN")} vé đã bán`
          : "Chưa có số bán vé trong ca",
        detail: scoped.records.length
          ? `${dateNote} Tổng hợp từ ${scoped.records.length} hồ sơ chốt ca.`
          : "Chưa có hồ sơ ca trong phạm vi tài khoản này.",
        href: "/erp",
        hrefLabel: "Mở tổng quan vận hành",
      });
    }

    if (intent === "supplier-payables") {
      if (user.role === "employee") {
        return NextResponse.json({
          answer: "Tài khoản này không có quyền xem công nợ",
          detail:
            "Việc nhận hàng hoặc nộp ảnh nghiệm thu nằm trong phiếu việc được giao.",
          href: "/erp",
          hrefLabel: "Mở việc của tôi",
        });
      }
      const postedSupplierAp = supplierAp.invoices.filter(
        (invoice) => invoice.status === "posted",
      );
      const postedSupplierPayable = postedSupplierAp.reduce(
        (total, invoice) => total + invoice.totalVnd,
        0,
      );
      const actionValue = supplierApActions.reduce(
        (total, invoice) => total + invoice.totalVnd,
        0,
      );
      const actionLabel =
        user.role === "director"
          ? "ngoại lệ cần quyết định"
          : user.role === "chief-accountant"
            ? "hóa đơn chờ kiểm tra"
            : user.role === "accountant"
              ? "hồ sơ công nợ cần xử lý"
              : "hóa đơn cần bổ sung hồ sơ";
      const managerSiteId =
        supplierApActions[0]?.siteId ?? user.siteIds[0];
      const href =
        user.role === "manager"
          ? managerSiteId
            ? `/erp/${managerSiteId}/doi-tac-nha-cung-ung`
            : "/erp"
          : "/erp/finance#supplier-payables";

      return NextResponse.json({
        count: supplierApActions.length,
        answer: supplierApActions.length
          ? `${supplierApActions.length} ${actionLabel}`
          : `${formatVnd(postedSupplierPayable)} công nợ đã ghi nhận`,
        detail: supplierApActions.length
          ? `Giá trị cần xử lý ${formatVnd(actionValue)}. Đã ghi sổ ${postedSupplierAp.length} hóa đơn, tổng ${formatVnd(postedSupplierPayable)}.`
          : `${postedSupplierAp.length} hóa đơn nhà cung cấp đã được ghi sổ trong phạm vi tài khoản.`,
        href,
        hrefLabel:
          user.role === "manager"
            ? "Mở hồ sơ nhà cung cấp"
            : "Mở báo cáo công nợ",
      });
    }

    const postedJournals = journals.filter(
      (journal) => journal.status === "posted",
    );
    const postedRevenue = postedJournals.reduce(
      (total, journal) =>
        total +
        journal.lines
          .filter((line) => line.accountCode.startsWith("511"))
          .reduce(
            (value, line) => value + line.creditVnd - line.debitVnd,
            0,
          ),
      0,
    );
    const postedCost = postedJournals.reduce(
      (total, journal) =>
        total +
        journal.lines
          .filter(
            (line) =>
              line.accountCode.startsWith("6") ||
              line.accountCode.startsWith("811"),
          )
          .reduce(
            (value, line) => value + line.debitVnd - line.creditVnd,
            0,
          ),
      0,
    );

    if (intent === "cost") {
      return NextResponse.json({
        answer: postedCost
          ? `${formatVnd(postedCost)} chi phí đã ghi sổ`
          : "Chưa có chi phí được ghi sổ",
        detail: postedCost
          ? `Tính từ ${postedJournals.length} bút toán đã được kế toán trưởng duyệt.`
          : "Sổ hiện chưa có bút toán tài khoản chi phí; hệ thống không tự ước lượng số còn thiếu.",
        href: "/erp/finance",
        hrefLabel: "Mở sổ tài khoản",
      });
    }

    if (intent === "profit") {
      const complete = postedRevenue > 0 && postedCost > 0;
      return NextResponse.json({
        answer: complete
          ? `${formatVnd(postedRevenue - postedCost)} chênh lệch doanh thu – chi phí`
          : "Chưa đủ dữ liệu để tính lợi nhuận",
        detail: complete
          ? `Doanh thu ghi sổ ${formatVnd(postedRevenue)}, chi phí ghi sổ ${formatVnd(postedCost)}.`
          : `Doanh thu đã ghi sổ ${formatVnd(postedRevenue)}; chi phí đã ghi sổ ${formatVnd(postedCost)}. Không hiển thị lợi nhuận giả khi thiếu một vế.`,
        href: "/erp/finance",
        hrefLabel: "Mở cân đối phát sinh",
      });
    }

    const pendingJournals =
      user.role === "chief-accountant"
        ? journals.filter(
            (journal) =>
              journal.sourceType === "shift-close" &&
              journal.status === "pending-checker",
          ).length
        : user.role === "accountant"
          ? journals.filter(
              (journal) =>
                journal.sourceType === "shift-close" &&
                journal.status === "checker-returned",
            ).length
          : 0;
    const shiftDirectorExceptions = allShifts.filter(
      (record) => record.status === "exception-pending-director",
    ).length;
    const accountingShiftActions = allShifts.filter((record) =>
      ["manager-approved", "accounting-review", "director-approved"].includes(
        record.status,
      ),
    ).length;
    const managerShiftActions = allShifts.filter(
      (record) => record.status === "submitted",
    ).length;

    if (intent === "inbox") {
      const [incidentCases, projectChangeRequests] = await Promise.all([
        user.role === "accountant" || user.role === "chief-accountant"
          ? Promise.resolve([])
          : Promise.all(
              user.siteIds.map((siteId) => getIncidentCases(siteId)),
            ).then((bySite) => bySite.flat()),
        user.role === "director"
          ? listPendingProjectChangeRequests(user.siteIds)
          : Promise.resolve([]),
      ]);

      const items: InboxItem[] = [];
      const firstSiteHref = (siteId: string | undefined, path: string) =>
        siteId ? `/erp/${siteId}/${path}` : "/erp";

      if (user.role === "employee") {
        items.push({
          label: "Ca bị trả lại",
          count: allShifts.filter(
            (record) =>
              record.submittedBy.id === user.id &&
              record.status === "manager-returned",
          ).length,
          href: "/erp",
          hrefLabel: "Xem ca của tôi",
        });
        items.push({
          label: "Phiếu việc bị trả lại hoặc khẩn",
          count: workdays.filter(
            (record) =>
              record.employee.id === user.id &&
              (record.status === "manager-returned" ||
                (record.priority === "critical" &&
                  !["submitted", "approved"].includes(record.status))),
          ).length,
          href: "/erp",
          hrefLabel: "Xem phiếu việc",
        });
        const myIncidents = incidentCases.filter(
          (item) =>
            item.assigneeId === user.id &&
            (item.status === "acknowledged" || item.status === "in-progress"),
        );
        items.push({
          label: "Sự cố đang xử lý",
          count: myIncidents.length,
          href: firstSiteHref(myIncidents[0]?.siteId ?? user.siteIds[0], "su-co"),
          hrefLabel: "Mở Sự cố",
        });
      } else if (user.role === "manager") {
        items.push({
          label: "Ca chờ xác nhận",
          count: managerShiftActions,
          href: "/erp",
          hrefLabel: "Xem chốt ca",
        });
        items.push({
          label: "Phiếu việc chờ duyệt hoặc khẩn",
          count: workdays.filter(
            (record) =>
              record.status === "submitted" ||
              (record.priority === "critical" && record.status !== "approved"),
          ).length,
          href: "/erp",
          hrefLabel: "Xem phiếu việc",
        });
        items.push({
          label: "Hoá đơn nhà cung cấp cần bổ sung",
          count: supplierApActions.length,
          href: firstSiteHref(
            supplierApActions[0]?.siteId ?? user.siteIds[0],
            "doi-tac-nha-cung-ung",
          ),
          hrefLabel: "Mở hồ sơ NCC",
        });
        const managerIncidents = incidentCases.filter(
          (item) => item.status === "reported" || item.status === "verification",
        );
        items.push({
          label: "Sự cố mới hoặc chờ xác minh",
          count: managerIncidents.length,
          href: firstSiteHref(managerIncidents[0]?.siteId ?? user.siteIds[0], "su-co"),
          hrefLabel: "Mở Sự cố",
        });
      } else if (user.role === "accountant") {
        items.push({
          label: "Ca cần đối soát",
          count: accountingShiftActions,
          href: "/erp/finance",
          hrefLabel: "Mở đối soát",
        });
        items.push({
          label: "Hồ sơ công nợ cần xử lý",
          count: supplierApActions.length,
          href: "/erp/finance#supplier-payables",
          hrefLabel: "Mở công nợ",
        });
        items.push({
          label: "Bút toán bị trả",
          count: pendingJournals,
          href: "/erp/finance",
          hrefLabel: "Mở sổ",
        });
      } else if (user.role === "chief-accountant") {
        items.push({
          label: "Bút toán chờ duyệt",
          count: pendingJournals,
          href: "/erp/finance",
          hrefLabel: "Mở sổ",
        });
        items.push({
          label: "Hoá đơn NCC chờ kiểm tra",
          count: supplierApActions.length,
          href: "/erp/finance#supplier-payables",
          hrefLabel: "Mở công nợ",
        });
      } else {
        items.push({
          label: "Ngoại lệ chốt ca",
          count: shiftDirectorExceptions,
          href: "/erp",
          hrefLabel: "Xem chốt ca",
        });
        items.push({
          label: "Hồ sơ NCC cần quyết định",
          count: supplierApActions.length,
          href: "/erp/finance#supplier-payables",
          hrefLabel: "Mở công nợ",
        });
        const escalated = incidentCases.filter(
          (item) => item.escalated && item.status !== "closed",
        );
        items.push({
          label: "Sự cố đã chuyển cấp",
          count: escalated.length,
          href: firstSiteHref(escalated[0]?.siteId, "su-co"),
          hrefLabel: "Mở Sự cố",
        });
        items.push({
          label: "Yêu cầu đổi phạm vi dự án",
          count: projectChangeRequests.length,
          href: firstSiteHref(projectChangeRequests[0]?.siteId, "du-an-su-kien"),
          hrefLabel: "Mở Dự án",
        });
      }

      return NextResponse.json({
        items,
        count: items.reduce((total, item) => total + item.count, 0),
      });
    }

    const urgent = urgentWorkCount(
      user.role,
      user.id,
      allShifts,
      workdays,
      pendingJournals,
      supplierApActions.length,
    );
    const urgentDetail =
      user.role === "director"
        ? `${shiftDirectorExceptions} ngoại lệ chốt ca · ${supplierApActions.length} hồ sơ nhà cung cấp cần quyết định.`
        : user.role === "chief-accountant"
          ? `${pendingJournals} bút toán ca · ${supplierApActions.length} hóa đơn nhà cung cấp chờ kiểm tra.`
          : user.role === "accountant"
            ? `${accountingShiftActions} ca cần đối soát · ${supplierApActions.length} hồ sơ công nợ cần xử lý · ${pendingJournals} bút toán bị trả.`
            : user.role === "manager"
              ? `${managerShiftActions} ca chờ xác nhận · ${supplierApActions.length} hóa đơn cần bổ sung; công việc hiện trường được liệt kê trên trang chủ.`
              : "Chỉ gồm việc bị trả lại hoặc việc khẩn đang được giao cho tài khoản.";
    return NextResponse.json({
      count: urgent,
      answer: urgent
        ? `${urgent} việc cần tài khoản này xử lý`
        : "Không có việc gấp đang chờ tài khoản này",
      detail: urgentDetail,
      href:
        user.role === "accountant" || user.role === "chief-accountant"
          ? "/erp/finance"
          : user.role === "director" &&
              supplierApActions.length > 0 &&
              shiftDirectorExceptions === 0
            ? "/erp/finance#supplier-payables"
          : "/erp",
      hrefLabel: "Mở hàng việc của tôi",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Câu hỏi chưa thuộc nhóm dữ liệu được hỗ trợ." },
        { status: 400 },
      );
    }
    console.error("ERP assistant query failed", error);
    return NextResponse.json(
      {
        message:
          "Kho dữ liệu chưa phản hồi. Vui lòng thử lại sau ít phút.",
      },
      { status: 503 },
    );
  }
}
