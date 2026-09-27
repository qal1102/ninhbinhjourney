"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { ERP_SITES } from "@/domain/erp";
import {
  ERP_ACCOUNT_STATUS_LABELS,
  ERP_LOGIN_STATE_LABELS,
  ERP_REGISTRY_ROLES,
  ERP_REGISTRY_ROLE_LABELS,
  erpLoginState,
  type ErpRegistryRole,
} from "@/domain/erp-account-roles";
import { erpAuditActionLabel } from "@/domain/erp-audit-labels";
import {
  grantLoginAction,
  resetLoginPasswordAction,
  setAccountStatusAction,
  setRoleAssignmentAction,
  unlinkLoginAction,
  upsertAccountAction,
} from "@/app/erp/account-actions";
import type {
  ErpAccountAdminEvent,
  ErpRegistryAccount,
} from "@/lib/erp/account-registry-repository";

/** Quyền đang có hiệu lực của một người, đã tính sẵn ở máy chủ. */
export type QuyenHienThi = {
  /** Tên gõ ở màn đăng nhập; `null` khi chưa đăng nhập được. */
  tenDangNhap: string | null;
  coSo: { ten: string; viec: string[] }[];
  conHieuLuc: boolean;
  /** Giám đốc và quản lý có mọi việc ở cơ sở mình, không cần liệt kê. */
  moiViec: boolean;
};

type Props = {
  accounts: readonly ErpRegistryAccount[];
  audit: readonly ErpAccountAdminEvent[];
  quyen: Readonly<Record<string, QuyenHienThi>>;
  tenTheoMa: Readonly<Record<string, string>>;
};

const SITE_NAME_BY_ID = new Map(ERP_SITES.map((site) => [site.id, site.shortName]));

/** Vai nghiệp vụ chọn được khi tạo người. Quản trị hệ thống cấp riêng ở thẻ. */
const VAI_KHI_TAO: readonly ErpRegistryRole[] = [
  "employee",
  "regional-manager",
  "accountant-maker",
  "accounting-checker",
  "director",
];

// A "use server" file may only export async functions, so this screen's
// action-state type and initial value live here instead of in
// app/erp/account-actions.ts.
type AccountActionState = {
  status: "idle" | "success" | "error";
  message: string;
  temporaryPassword?: string;
};

const INITIAL_ACCOUNT_ACTION_STATE: AccountActionState = {
  status: "idle",
  message: "",
};

const O_NHAP =
  "min-h-11 min-w-0 rounded-xl border border-[#ced8d1] bg-white px-3 text-sm font-medium";

function ActionMessage({ state }: { state: AccountActionState }) {
  if (state.status === "idle") return null;
  return (
    <p
      role={state.status === "error" ? "alert" : "status"}
      className={`mt-3 rounded-xl px-4 py-3 text-sm font-bold ${
        state.status === "error"
          ? "bg-[#fff0eb] text-[#91483a]"
          : "bg-[#e3f2eb] text-[#245e48]"
      }`}
    >
      {state.message}
    </p>
  );
}

function SubmitButton({
  children,
  tone = "primary",
}: {
  children: React.ReactNode;
  tone?: "primary" | "secondary" | "danger";
}) {
  const { pending } = useFormStatus();
  const className =
    tone === "danger"
      ? "bg-[#a94e3f] text-white"
      : tone === "secondary"
        ? "border border-[#b9c8c1] bg-white text-[#385047]"
        : "bg-[#183f34] text-white";
  return (
    <button
      type="submit"
      disabled={pending}
      className={`min-h-11 rounded-xl px-4 text-sm font-black disabled:cursor-wait disabled:opacity-60 ${className}`}
    >
      {pending ? "Đang xử lý…" : children}
    </button>
  );
}

function ChonVai({ name, defaultValue, vai }: { name: string; defaultValue: ErpRegistryRole; vai: readonly ErpRegistryRole[] }) {
  return (
    <select name={name} required defaultValue={defaultValue} className={O_NHAP}>
      {vai.map((role) => (
        <option key={role} value={role}>
          {ERP_REGISTRY_ROLE_LABELS[role]}
        </option>
      ))}
    </select>
  );
}

function ChonCoSo({ name }: { name: string }) {
  // Mặc định một cơ sở cụ thể: vai mặc định là Nhân viên, mà nhân viên thì
  // bắt buộc thuộc một cơ sở. Mặc định "Toàn vùng" là mời bấm vào một lỗi.
  return (
    <select name={name} defaultValue={ERP_SITES[0]?.id ?? ""} className={O_NHAP}>
      <option value="">Toàn vùng (giám đốc, kế toán)</option>
      {ERP_SITES.map((site) => (
        <option key={site.id} value={site.id}>
          {site.shortName}
        </option>
      ))}
    </select>
  );
}

/**
 * Tạo người trong một bước: hồ sơ, vai, cơ sở, đăng nhập. Lưu xong là có tên
 * đăng nhập và mật khẩu tạm; không còn cảnh tài khoản nằm đó "chưa cấp vai,
 * chưa đăng nhập được" chờ ai nhớ làm nốt.
 */
function CreateAccountForm() {
  const [state, action] = useActionState(
    upsertAccountAction,
    INITIAL_ACCOUNT_ACTION_STATE,
  );
  return (
    <details className="rounded-2xl border border-[#ccd9d3] bg-white shadow-sm">
      <summary className="cursor-pointer list-none p-5 sm:p-6">
        <p className="text-xs font-black uppercase tracking-[0.17em] text-[#477565]">
          Tài khoản mới
        </p>
        <h2 className="mt-2 text-xl font-black text-[#20342c]">
          Thêm người vào hệ thống
        </h2>
      </summary>
      <form action={action} className="border-t border-[#e2e8e4] bg-[#f8faf8] p-5 sm:p-6">
        <div className="grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-3">
          <label className="grid gap-1 text-xs font-bold text-[#5f7068]">
            Họ và tên
            <input name="displayName" required className={O_NHAP} />
          </label>
          <label className="grid gap-1 text-xs font-bold text-[#5f7068]">
            Chức danh
            <input name="jobTitle" required placeholder="Ví dụ: Nhân viên soát vé" className={O_NHAP} />
          </label>
          <label className="grid gap-1 text-xs font-bold text-[#5f7068]">
            Hình thức làm việc
            <select name="employmentType" required defaultValue="permanent" className={O_NHAP}>
              <option value="permanent">Chính thức</option>
              <option value="seasonal">Thời vụ</option>
            </select>
          </label>
          <label className="grid gap-1 text-xs font-bold text-[#5f7068]">
            Vai trò
            <ChonVai name="role" defaultValue="employee" vai={VAI_KHI_TAO} />
          </label>
          <label className="grid gap-1 text-xs font-bold text-[#5f7068]">
            Cơ sở
            <ChonCoSo name="siteId" />
          </label>
          <label className="grid gap-1 text-xs font-bold text-[#5f7068]">
            Email (không bắt buộc)
            <input name="email" type="email" placeholder="Để trống cũng được" className={O_NHAP} />
          </label>
        </div>
        <p className="mt-3 text-xs leading-5 text-[#7c8882]">
          Nhân viên và quản lý chọn đúng cơ sở mình làm; giám đốc chọn Toàn vùng.
          Máy tự đặt tên đăng nhập từ họ tên (ví dụ &ldquo;Nguyễn Văn Ba&rdquo; là{" "}
          <span className="font-mono">nguyen-van-ba</span>) và cấp một mật khẩu
          tạm; người ấy đổi mật khẩu ngay lần đăng nhập đầu. Nhân viên mới có sẵn
          chấm công và báo cáo hiện trường; quản lý cơ sở giao thêm việc ở màn
          Nhân sự.
        </p>
        <div className="mt-4">
          <SubmitButton>Tạo tài khoản</SubmitButton>
        </div>
        <LoginResult state={state} />
      </form>
    </details>
  );
}

/**
 * A15-ACC-01 (audit TK-04/TK-05): the temporary password sits in its own box,
 * not inside a sentence, with a copy button and a way to hide it once copied.
 * It lives only in this component's state; reloading the page clears it.
 */
function TemporaryPassword({ value }: { value: string }) {
  const [hidden, setHidden] = useState(false);
  const [copied, setCopied] = useState(false);
  if (hidden) {
    return (
      <p className="mt-2 text-xs font-bold text-[#5f7068]">
        Đã ẩn mật khẩu tạm. Nếu chưa kịp gửi, bấm “Cấp lại mật khẩu tạm” để lấy mật khẩu mới.
      </p>
    );
  }
  return (
    <div className="mt-2 rounded-xl border border-[#e7cf9f] bg-[#fff8ea] p-3">
      <p className="text-xs font-bold text-[#7a5a1f]">
        Mật khẩu tạm — chỉ hiện ở đây một lần, không lưu ở đâu khác
      </p>
      <p className="mt-2 break-all font-mono text-base font-black tracking-wide text-[#2c3e36]" data-testid="temporary-password">
        {value}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard?.writeText(value).then(
              () => setCopied(true),
              () => setCopied(false),
            );
          }}
          className="min-h-11 rounded-xl border border-[#b9c8c1] bg-white px-4 text-sm font-black text-[#385047]"
        >
          {copied ? "Đã chép" : "Chép mật khẩu"}
        </button>
        <button
          type="button"
          onClick={() => setHidden(true)}
          className="min-h-11 rounded-xl bg-[#183f34] px-4 text-sm font-black text-white"
        >
          Đã gửi xong, ẩn mật khẩu
        </button>
      </div>
    </div>
  );
}

function LoginResult({ state }: { state: AccountActionState }) {
  if (state.status === "idle") return null;
  return (
    <div>
      <ActionMessage state={state} />
      {state.status === "success" && state.temporaryPassword ? (
        <TemporaryPassword key={state.temporaryPassword} value={state.temporaryPassword} />
      ) : null}
    </div>
  );
}

/**
 * All three login actions keep their state here, above the branch on
 * `account.hasAuthUser`: that flag flips as soon as revalidatePath refetches,
 * and a result kept inside the branch that just disappeared would vanish with
 * it -- which is how the one-time password used to be lost before anyone had
 * a real chance to copy it.
 */
function LoginPanel({ account, tenDangNhap }: { account: ErpRegistryAccount; tenDangNhap: string | null }) {
  const [grantState, grantAction] = useActionState(grantLoginAction, INITIAL_ACCOUNT_ACTION_STATE);
  const [resetState, resetAction] = useActionState(resetLoginPasswordAction, INITIAL_ACCOUNT_ACTION_STATE);
  const [unlinkState, unlinkAction] = useActionState(unlinkLoginAction, INITIAL_ACCOUNT_ACTION_STATE);

  if (!account.hasAuthUser) {
    return (
      <div className="space-y-2">
        <LoginResult state={unlinkState} />
        {tenDangNhap ? (
          <p className="text-sm text-[#5f7068]">
            Đang đăng nhập bằng tài khoản mẫu <span className="font-mono font-bold">{tenDangNhap}</span>.
            Cấp đăng nhập riêng để người này có mật khẩu của mình.
          </p>
        ) : null}
        <form action={grantAction} className="grid gap-2 sm:grid-cols-[1fr_auto]">
          <input type="hidden" name="accountId" value={account.accountId} />
          <label className="grid gap-1 text-xs font-bold text-[#5f7068]">
            Email (không bắt buộc)
            <input
              name="email"
              type="email"
              placeholder={`Để trống: đăng nhập bằng ${account.accountId}`}
              className="min-h-11 min-w-0 rounded-lg border border-[#ced8d1] bg-white px-2 text-sm"
            />
          </label>
          <SubmitButton tone="secondary">Cấp đăng nhập</SubmitButton>
        </form>
        <LoginResult state={grantState} />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <LoginResult state={grantState} />
      <p className="text-sm font-bold text-[#245e48]">
        Tên đăng nhập · <span className="font-mono">{account.accountId}</span>
        {account.email && !account.email.endsWith("@taikhoan.ninhbinhjourney.vn") ? (
          <span className="font-normal text-[#5f7068]"> · hoặc {account.email}</span>
        ) : null}
      </p>
      <div className="flex flex-wrap items-start gap-2">
        <form action={resetAction}>
          <input type="hidden" name="accountId" value={account.accountId} />
          <SubmitButton tone="secondary">Cấp lại mật khẩu tạm</SubmitButton>
        </form>
        <details>
          <summary className="flex min-h-11 cursor-pointer list-none items-center rounded-xl border border-[#e0b8ae] bg-white px-4 text-sm font-black text-[#934336]">
            Gỡ đăng nhập…
          </summary>
          <form action={unlinkAction} className="mt-2 max-w-md rounded-xl border border-[#f0d3cb] bg-[#fff6f3] p-3">
            <input type="hidden" name="accountId" value={account.accountId} />
            <p className="text-xs leading-5 text-[#7d4a3f]">
              Người này sẽ không đăng nhập được nữa. Hồ sơ, vai trò và nhật ký
              của tài khoản vẫn giữ nguyên; cấp lại đăng nhập được bất cứ lúc nào.
            </p>
            <label className="mt-2 flex min-h-11 items-center gap-2 text-sm font-bold text-[#7d4a3f]">
              <input type="checkbox" name="confirm" value="yes" required className="h-5 w-5" />
              Tôi hiểu, gỡ đăng nhập của {account.displayName}
            </label>
            <div className="mt-2">
              <SubmitButton tone="danger">Gỡ đăng nhập</SubmitButton>
            </div>
          </form>
        </details>
      </div>
      <LoginResult state={resetState} />
      <LoginResult state={unlinkState} />
    </div>
  );
}

function StatusForm({ account }: { account: ErpRegistryAccount }) {
  const [state, action] = useActionState(
    setAccountStatusAction,
    INITIAL_ACCOUNT_ACTION_STATE,
  );
  const nextStatus = account.status === "active" ? "suspended" : "active";
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="accountId" value={account.accountId} />
      <input type="hidden" name="status" value={nextStatus} />
      <SubmitButton tone={nextStatus === "active" ? "secondary" : "danger"}>
        {nextStatus === "active" ? "Mở lại tài khoản" : "Tạm khoá tài khoản"}
      </SubmitButton>
      <ActionMessage state={state} />
    </form>
  );
}

/** Một vai đang giữ, kèm nút thu hồi ngay tại chỗ. */
function VaiDangGiu({
  account,
  grant,
}: {
  account: ErpRegistryAccount;
  grant: ErpRegistryAccount["grants"][number];
}) {
  const [state, action] = useActionState(setRoleAssignmentAction, INITIAL_ACCOUNT_ACTION_STATE);
  const nhan = `${ERP_REGISTRY_ROLE_LABELS[grant.role]} · ${
    grant.siteId ? (SITE_NAME_BY_ID.get(grant.siteId) ?? grant.siteId) : "Toàn vùng"
  }`;
  return (
    <form action={action} className="inline-flex flex-col">
      <input type="hidden" name="accountId" value={account.accountId} />
      <input type="hidden" name="role" value={grant.role} />
      <input type="hidden" name="siteId" value={grant.siteId ?? ""} />
      <input type="hidden" name="active" value="false" />
      <span className="inline-flex min-h-11 items-center gap-1 rounded-full bg-[#eef3f0] pl-3 text-xs font-black text-[#43574e]">
        {nhan}
        <button
          type="submit"
          aria-label={`Thu hồi ${nhan} của ${account.displayName}`}
          title="Thu hồi vai này"
          className="grid h-11 w-11 place-items-center rounded-full text-base text-[#8a4b3f] hover:bg-[#f6e3de]"
        >
          ×
        </button>
      </span>
      {state.status === "error" ? <ActionMessage state={state} /> : null}
    </form>
  );
}

function GrantForm({ account }: { account: ErpRegistryAccount }) {
  const [state, action] = useActionState(
    setRoleAssignmentAction,
    INITIAL_ACCOUNT_ACTION_STATE,
  );
  return (
    <details className="mt-3">
      <summary className="inline-flex min-h-11 cursor-pointer list-none items-center rounded-xl border border-[#ced8d1] bg-white px-4 text-sm font-black text-[#385047]">
        Cấp thêm vai hoặc cơ sở…
      </summary>
      <form action={action} className="mt-2 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <input type="hidden" name="accountId" value={account.accountId} />
        <input type="hidden" name="active" value="true" />
        <label className="grid gap-1 text-xs font-bold text-[#5f7068]">
          Vai trò
          <ChonVai name="role" defaultValue="employee" vai={ERP_REGISTRY_ROLES} />
        </label>
        <label className="grid gap-1 text-xs font-bold text-[#5f7068]">
          Cơ sở
          <ChonCoSo name="siteId" />
        </label>
        <div className="self-end">
          <SubmitButton>Cấp</SubmitButton>
        </div>
        <div className="sm:col-span-3">
          <ActionMessage state={state} />
        </div>
      </form>
    </details>
  );
}

function QuyenHieuLucHienThi({ quyen }: { quyen: QuyenHienThi | undefined }) {
  if (!quyen || quyen.coSo.length === 0) {
    return (
      <p className="text-sm font-bold text-[#8a5a12]">
        {quyen && !quyen.conHieuLuc
          ? "Tài khoản đang khoá hoặc hết hạn, chưa mở được nghiệp vụ nào."
          : "Chưa có vai nghiệp vụ nào, nên chưa mở được nghiệp vụ nào."}
      </p>
    );
  }
  return (
    <ul className="space-y-1 text-sm text-[#43574e]">
      {quyen.coSo.map((coSo) => (
        <li key={coSo.ten}>
          <strong>{coSo.ten}</strong>
          {" · "}
          {quyen.moiViec
            ? `mọi việc (${coSo.viec.length})`
            : coSo.viec.length
              ? coSo.viec.join(", ")
              : "chưa được giao việc nào"}
        </li>
      ))}
    </ul>
  );
}

export function AccountAdministration({ accounts, audit, quyen, tenTheoMa }: Props) {
  const ten = (ma: string) => tenTheoMa[ma] ?? ma;
  return (
    <div className="space-y-5">
      <header className="rounded-3xl bg-[#173f34] p-5 text-white sm:p-8">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#b9d5ca]">
          Quản trị hệ thống
        </p>
        <h1 className="mt-2 text-3xl font-black sm:text-5xl">Tài khoản & phân quyền</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-[#d4e4de]">
          Đây là nơi duy nhất quyết ai giữ vai gì, ở cơ sở nào. Cấp hay thu hồi ở
          đây là có hiệu lực ngay lần tải trang kế tiếp của người đó. Quản lý có
          mọi việc ở cơ sở mình; việc của từng nhân viên do quản lý giao ở màn
          Nhân sự.
        </p>
      </header>

      <CreateAccountForm />

      <section className="space-y-3">
        {accounts.map((account) => {
          const q = quyen[account.accountId];
          return (
            <article
              key={account.accountId}
              className="rounded-2xl border border-[#d8e0db] bg-white p-5 shadow-sm sm:p-6"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-lg font-black text-[#20342c]">
                    {account.displayName}
                  </p>
                  <p className="text-sm text-[#6e7b75]">
                    {account.jobTitle}
                    {q?.tenDangNhap ? (
                      <>
                        {" · đăng nhập bằng "}
                        <span className="font-mono font-bold">{q.tenDangNhap}</span>
                      </>
                    ) : null}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-black ${
                      account.status === "active"
                        ? "bg-[#dff1e8] text-[#246249]"
                        : "bg-[#ffe4de] text-[#934336]"
                    }`}
                  >
                    {ERP_ACCOUNT_STATUS_LABELS[account.status]}
                  </span>
                  <span
                    data-testid="login-state"
                    className={`rounded-full px-3 py-1 text-xs font-black ${
                      erpLoginState(account) === "in-use"
                        ? "bg-[#e3eef8] text-[#28506f]"
                        : erpLoginState(account) === "awaiting-first-change"
                          ? "bg-[#fff2df] text-[#8a5a12]"
                          : "bg-[#eef0ef] text-[#5c6863]"
                    }`}
                  >
                    {!account.hasAuthUser && q?.tenDangNhap
                      ? "Tài khoản mẫu"
                      : ERP_LOGIN_STATE_LABELS[erpLoginState(account)]}
                  </span>
                  <Link
                    href={`/erp/ho-so/${account.accountId}`}
                    className="inline-flex min-h-11 items-center rounded-full border border-[#ced8d1] bg-white px-4 text-xs font-black text-[#385047] hover:border-[#8fa99f]"
                  >
                    Xem hồ sơ
                  </Link>
                </div>
              </div>

              <div className="mt-4 rounded-xl bg-[#f6f9f7] p-3" data-testid="quyen-hieu-luc">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-[#607b70]">
                  Đang vào được
                </p>
                <div className="mt-2">
                  <QuyenHieuLucHienThi quyen={q} />
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {account.grants.map((grant) => (
                  <VaiDangGiu key={`${grant.role}:${grant.siteId ?? "all"}`} account={account} grant={grant} />
                ))}
              </div>

              <GrantForm account={account} />
              <div className="mt-3 border-t border-[#eaefec] pt-3">
                <LoginPanel account={account} tenDangNhap={q?.tenDangNhap ?? null} />
              </div>
              <div className="mt-3 border-t border-[#eaefec] pt-3">
                <StatusForm account={account} />
              </div>
            </article>
          );
        })}
      </section>

      <section className="rounded-2xl border border-[#d8e0db] bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-lg font-black text-[#20342c]">Nhật ký thay đổi quyền</h2>
        {audit.length === 0 ? (
          <p className="mt-2 text-sm text-[#7b8881]">
            Chưa có thay đổi nào được ghi nhận.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-[#eef2f0]">
            {audit.map((event) => (
              <li key={event.id} className="py-3 text-sm">
                <p className="font-bold text-[#2c3e36]">
                  {ten(event.actorAccountId)} → {ten(event.targetAccountId)}
                </p>
                <p className="text-[#6e7b75]">
                  {erpAuditActionLabel(event.action)} ·{" "}
                  {new Date(event.createdAt).toLocaleString("vi-VN", {
                    timeZone: "Asia/Ho_Chi_Minh",
                  })}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
