import Link from "next/link";
import type { ErpSite } from "@/domain/erp";
import {
  deriveShiftPresence,
  type ShiftPresenceRow,
} from "@/domain/erp-shift-presence";
import type { AttendanceEvent } from "@/lib/erp/demo-session";
import type { ErpStaffDirectoryEntry } from "@/lib/erp/staff-directory";

/*
 * Màn hình này từng hiển thị ba nhân viên KHÔNG CÓ THẬT, đủ họ tên, kèm
 * "462 vé · 79,4 triệu", "12 triệu chờ đối soát" và một dòng "bình quân 3
 * năm: 91%" trong khi hệ thống mới chạy hai tháng. Nó nằm giữa hai khối dữ
 * liệu thật (bàn giao ca, phân quyền) nên mượn được vẻ đáng tin của hàng
 * xóm, và mọi quản lý ở mọi cơ sở đều thấy đúng ba con người đó.
 *
 * Nay chỉ còn đúng câu hỏi mà dữ liệu hiện có trả lời được: ai được phân
 * công ở đây, và hôm nay ai đã vào ca. Năng suất, doanh thu theo đầu người
 * và tỉ lệ đúng hạn thì chưa có nguồn -- nói thẳng là chưa đo, đừng dựng số
 * cho kín ô.
 */

type Props = {
  site: ErpSite;
  directory: readonly ErpStaffDirectoryEntry[];
  attendance: readonly AttendanceEvent[];
};

const STATE_STYLE = {
  "on-shift": { label: "Đang trong ca", className: "bg-[#dff1e8] text-[#246249]" },
  "off-shift": { label: "Đã tan ca", className: "bg-[#eef1ef] text-[#5c6b64]" },
  "not-started": { label: "Chưa vào ca", className: "bg-[#fdf0dd] text-[#8a5e30]" },
} as const;

function formatTime(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(value));
}

function presenceNote(row: ShiftPresenceRow) {
  if (!row.latestAt) return "Hôm nay chưa chấm công tại cơ sở này";
  const time = formatTime(row.latestAt);
  const suffix = row.demoLocation ? " · vị trí mô phỏng" : "";
  return row.state === "on-shift"
    ? `Vào ca lúc ${time}${suffix}`
    : `Tan ca lúc ${time}${suffix}`;
}

export function StaffPerformanceWorkspace({ site, directory, attendance }: Props) {
  const { rows, summary } = deriveShiftPresence({
    directory,
    events: attendance,
    siteId: site.id,
    at: new Date(),
  });

  return (
    <section className="rounded-2xl border border-[#d8e0db] bg-white p-5 shadow-sm sm:p-6">
      <p className="text-xs font-black uppercase tracking-[0.17em] text-[#477565]">
        Nhân sự & công việc
      </p>
      <h2 className="mt-2 text-2xl font-black text-[#20342c]">
        Ca làm tại {site.shortName}
      </h2>
      <p className="mt-2 text-sm text-[#65756e]">
        Đọc từ phân công tài khoản và lượt chấm công hôm nay tại cơ sở này.
      </p>

      {summary.assigned === 0 ? (
        <div className="mt-5 rounded-xl border border-[#e0e6e2] bg-[#f8faf8] p-5">
          <p className="font-black text-[#2d4138]">
            Chưa ai được phân công vào {site.shortName}.
          </p>
          <p className="mt-2 text-sm leading-6 text-[#65756e]">
            Cấp vai trò cho một tài khoản tại màn hình Tài khoản &amp; phân
            quyền, người đó sẽ hiện ở đây ngay. Màn hình này không dựng nhân
            sự mẫu để lấp chỗ trống.
          </p>
          <Link
            href="/erp/tai-khoan"
            className="mt-4 inline-flex min-h-10 items-center rounded-lg bg-[#183f34] px-4 text-sm font-black text-white"
          >
            Mở Tài khoản &amp; phân quyền
          </Link>
        </div>
      ) : (
        <>
          <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              ["Được phân công", summary.assigned, "Tài khoản đang hoạt động"],
              ["Đang trong ca", summary.onShift, "Đã chấm vào, chưa chấm ra"],
              ["Đã tan ca", summary.finished, "Đã chấm ra hôm nay"],
              ["Chưa vào ca", summary.notStarted, "Hôm nay chưa chấm công"],
            ].map(([label, value, note]) => (
              <article key={String(label)} className="rounded-xl bg-[#f3f6f4] p-4">
                <p className="text-xs text-[#718078]">{label}</p>
                <p className="mt-2 text-xl font-black">{value}</p>
                <p className="mt-2 text-xs text-[#7b8881]">{note}</p>
              </article>
            ))}
          </div>

          <ul className="mt-5 space-y-2">
            {rows.map((row) => {
              const style = STATE_STYLE[row.state];
              return (
                <li
                  key={row.accountId}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#e0e6e2] p-4"
                >
                  <div>
                    <Link
                      href={`/erp/ho-so/${row.accountId}`}
                      className="font-black text-[#2d4138] underline-offset-2 hover:underline"
                    >
                      {row.displayName}
                    </Link>
                    <p className="mt-1 text-xs text-[#7b8881]">
                      {row.jobTitle} · {presenceNote(row)}
                    </p>
                  </div>
                  <span
                    className={`w-fit rounded-full px-2.5 py-1 text-xs font-black ${style.className}`}
                  >
                    {style.label}
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      )}

      <p className="mt-5 border-t border-[#e6ebe8] pt-4 text-xs leading-5 text-[#7b8881]">
        Năng suất theo đầu người, doanh thu từng nhân viên và tỉ lệ đúng hạn
        chưa có nguồn dữ liệu, nên chưa hiển thị ở đây. Tiến độ từng việc xem
        tại Chấm công &amp; phiếu việc.
      </p>
    </section>
  );
}
