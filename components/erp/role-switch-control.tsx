import { ERP_ROLE_LABELS } from "@/domain/erp";
import { switchDemoRoleAction } from "@/app/erp/actions";
import { DEMO_ERP_ACCOUNTS } from "@/lib/erp/demo-data";

type Props = {
  /** The account currently being viewed, when a switch is already active. */
  currentUserId?: string;
};

export function RoleSwitchControl({ currentUserId }: Props) {
  const targets = DEMO_ERP_ACCOUNTS.filter(
    (account) => account.role !== "director" && account.id !== currentUserId,
  );

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
        <select
          name="targetUserId"
          required
          defaultValue=""
          className="mt-2 min-h-10 w-full rounded-lg border border-[#ced8d1] bg-white px-2 text-sm"
        >
          <option value="" disabled>
            Chọn một tài khoản…
          </option>
          {targets.map((account) => (
            <option key={account.id} value={account.id}>
              {ERP_ROLE_LABELS[account.role]} · {account.name} ({account.username})
            </option>
          ))}
        </select>
        <p className="mt-2 text-xs leading-5 text-[#7c8882]">
          Đổi thẳng phiên đăng nhập sang tài khoản này — thấy đúng những gì họ
          thấy, kể cả bị chặn. Ghi vào nhật ký. Đổi tiếp sang vai trò khác được
          ngay, không cần quay về giám đốc.
        </p>
        <button
          type="submit"
          className="mt-3 min-h-10 w-full rounded-lg bg-[#183f34] text-sm font-black text-white transition hover:bg-[#122e26]"
        >
          Xem thử
        </button>
      </form>
    </details>
  );
}
