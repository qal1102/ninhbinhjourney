import { ERP_ROLE_LABELS, ERP_SITES } from "@/domain/erp";
import { switchDemoRoleAction } from "@/app/erp/actions";
import type { ErpStaffDirectoryEntry } from "@/lib/erp/staff-directory";

type Props = {
  /** The account currently being viewed, when a switch is already active. */
  currentUserId?: string;
  /**
   * T14b: đọc từ registry, không phải từ `DEMO_ERP_ACCOUNTS`. Truyền xuống
   * bằng prop vì thành phần này còn được dựng bên trong menu di động — một
   * client component, không tự `await` được.
   */
  targets: readonly ErpStaffDirectoryEntry[];
};

function siteLabel(entry: ErpStaffDirectoryEntry) {
  if (entry.siteIds.length === 0) return "toàn vùng";
  return entry.siteIds
    .map((siteId) => ERP_SITES.find((site) => site.id === siteId)?.shortName ?? siteId)
    .join(", ");
}

export function RoleSwitchControl({ currentUserId, targets }: Props) {
  return (
    <details className="relative">
      <summary className="flex min-h-10 cursor-pointer list-none items-center rounded-xl border border-[#ced8d1] bg-white px-4 text-sm font-bold text-[#43554e] transition hover:border-[#8fa99f] hover:bg-[#f7f9f7]">
        {currentUserId ? "Đổi vai trò khác" : "Xem theo vai trò"}
      </summary>
      <form
        action={switchDemoRoleAction}
        className="absolute right-0 z-50 mt-2 w-80 rounded-xl border border-[#d8e0db] bg-white p-4 shadow-xl"
      >
        <label className="block text-xs font-black uppercase tracking-[0.14em] text-[#718078]">
          Xem hệ thống như tài khoản
        </label>
        {targets.length === 0 ? (
          <p className="mt-2 rounded-lg bg-[#f4f7f5] p-3 text-xs leading-5 text-[#6d7d75]">
            Chưa có tài khoản nào đang hoạt động để xem thử. Tạo tài khoản và cấp
            vai trò ở <span className="font-bold">Tài khoản &amp; phân quyền</span>{" "}
            trước.
          </p>
        ) : (
          <select
            name="targetUserId"
            required
            defaultValue=""
            className="mt-2 min-h-10 w-full rounded-lg border border-[#ced8d1] bg-white px-2 text-sm"
          >
            <option value="" disabled>
              Chọn một tài khoản…
            </option>
            {targets.map((entry) => (
              <option key={entry.accountId} value={entry.accountId}>
                {ERP_ROLE_LABELS[entry.role]} · {entry.displayName} ({siteLabel(entry)})
              </option>
            ))}
          </select>
        )}
        <p className="mt-2 text-xs leading-5 text-[#7c8882]">
          Đổi thẳng phiên đăng nhập sang tài khoản này — thấy đúng những gì họ
          thấy, kể cả bị chặn. Ghi vào nhật ký. Đổi tiếp sang vai trò khác được
          ngay, không cần quay về giám đốc.
        </p>
        <button
          type="submit"
          disabled={targets.length === 0}
          className="mt-3 min-h-10 w-full rounded-lg bg-[#183f34] text-sm font-black text-white transition hover:bg-[#122e26] disabled:cursor-not-allowed disabled:bg-[#9aada4]"
        >
          Xem thử
        </button>
      </form>
    </details>
  );
}
