import { ERP_ROLE_LABELS } from "@/domain/erp";
import { endRoleSwitchAction } from "@/app/erp/actions";
import type { CurrentErpUser } from "@/lib/erp/demo-session";

type Props = {
  user: CurrentErpUser;
};

export function RoleSwitchBanner({ user }: Props) {
  if (!user.actingAs) return null;
  return (
    <div
      role="status"
      className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e7c78d]/50 bg-[#3a2a12] px-4 py-3 text-sm text-white sm:px-6"
    >
      <p className="font-bold">
        Đang xem với vai trò{" "}
        <span className="text-[#e7c78d]">
          {ERP_ROLE_LABELS[user.role]} · {user.name}
        </span>{" "}
        — {user.actingAs.directorName} đang xem thử.
      </p>
      <form action={endRoleSwitchAction}>
        <button
          type="submit"
          className="min-h-9 rounded-lg bg-[#e7c78d] px-4 text-xs font-black text-[#17352c] transition hover:bg-[#f2d69f]"
        >
          Quay lại giám đốc
        </button>
      </form>
    </div>
  );
}
