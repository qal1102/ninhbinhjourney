import { NextResponse } from "next/server";
import { z } from "zod";
import { canViewRegionalFinance } from "@/domain/erp-role-policy";
import type { ShiftCloseRecord } from "@/domain/erp-shift-close";
import type { WorkdayRecord } from "@/domain/erp-workday";
import { listAccountingJournals } from "@/lib/erp/accounting-repository";
import { getCurrentErpUser } from "@/lib/erp/demo-session";
import { listShiftClosures } from "@/lib/erp/shift-close-repository";
import { listWorkdaysForUser } from "@/lib/erp/workday-view";

const RequestSchema = z.object({
  intent: z.enum(["revenue", "cost", "profit", "guests", "urgent"]),
});

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
      ).length
    );
  }
  if (role === "accountant") {
    return (
      shifts.filter((record) =>
        ["manager-approved", "accounting-review", "director-approved"].includes(
          record.status,
        ),
      ).length + pendingJournals
    );
  }
  if (role === "chief-accountant") return pendingJournals;
  return shifts.filter(
    (record) => record.status === "exception-pending-director",
  ).length;
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
    const [allShifts, workdays, journals] = await Promise.all([
      listShiftClosures({ siteIds: user.siteIds }),
      listWorkdaysForUser(user),
      canViewRegionalFinance(user.role)
        ? listAccountingJournals({ siteIds: user.siteIds })
        : Promise.resolve([]),
    ]);
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
        ? journals.filter((journal) => journal.status === "pending-checker")
            .length
        : user.role === "accountant"
          ? journals.filter(
              (journal) => journal.status === "checker-returned",
            ).length
          : 0;
    const urgent = urgentWorkCount(
      user.role,
      user.id,
      allShifts,
      workdays,
      pendingJournals,
    );
    return NextResponse.json({
      count: urgent,
      answer: urgent
        ? `${urgent} việc cần tài khoản này xử lý`
        : "Không có việc gấp đang chờ tài khoản này",
      detail:
        user.role === "director"
          ? "Chỉ tính ngoại lệ đã được cấp dưới xác minh và chuyển giám đốc."
          : "Chỉ tính việc đúng vai trò, đúng cơ sở và đang ở bước của tài khoản này.",
      href:
        user.role === "accountant" || user.role === "chief-accountant"
          ? "/erp/finance"
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
