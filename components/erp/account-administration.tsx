"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { ERP_SITES } from "@/domain/erp";
import {
  ERP_ACCOUNT_STATUS_LABELS,
  ERP_REGISTRY_ROLES,
  ERP_REGISTRY_ROLE_LABELS,
} from "@/domain/erp-account-roles";
import {
  INITIAL_ACCOUNT_ACTION_STATE,
  setAccountStatusAction,
  setRoleAssignmentAction,
  upsertAccountAction,
  type AccountActionState,
} from "@/app/erp/account-actions";
import type {
  ErpAccountAdminEvent,
  ErpRegistryAccount,
} from "@/lib/erp/account-registry-repository";

type Props = {
  accounts: readonly ErpRegistryAccount[];
  audit: readonly ErpAccountAdminEvent[];
};

const SITE_NAME_BY_ID = new Map(ERP_SITES.map((site) => [site.id, site.shortName]));

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
      className={`min-h-10 rounded-xl px-4 text-sm font-black disabled:cursor-wait disabled:opacity-60 ${className}`}
    >
      {pending ? "Đang xử lý…" : children}
    </button>
  );
}

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
          Tạo người dùng mà không cần triển khai lại phần mềm
        </h2>
      </summary>
      <form action={action} className="border-t border-[#e2e8e4] bg-[#f8faf8] p-5 sm:p-6">
        <div className="grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-3">
          <label className="grid gap-1 text-xs font-bold text-[#5f7068]">
            Mã tài khoản
            <input
              name="accountId"
              required
              placeholder="vd: employee-tam-chuc-02"
              className="min-h-11 min-w-0 rounded-xl border border-[#ced8d1] bg-white px-3 text-sm font-medium"
            />
          </label>
          <label className="grid gap-1 text-xs font-bold text-[#5f7068]">
            Họ và tên
            <input
              name="displayName"
              required
              className="min-h-11 min-w-0 rounded-xl border border-[#ced8d1] bg-white px-3 text-sm font-medium"
            />
          </label>
          <label className="grid gap-1 text-xs font-bold text-[#5f7068]">
            Chức danh
            <input
              name="jobTitle"
              required
              className="min-h-11 min-w-0 rounded-xl border border-[#ced8d1] bg-white px-3 text-sm font-medium"
            />
          </label>
          <label className="grid gap-1 text-xs font-bold text-[#5f7068]">
            Hình thức làm việc
            <select
              name="employmentType"
              required
              defaultValue="permanent"
              className="min-h-11 min-w-0 rounded-xl border border-[#ced8d1] bg-white px-3 text-sm font-medium"
            >
              <option value="permanent">Chính thức</option>
              <option value="seasonal">Thời vụ</option>
              <option value="management">Quản lý</option>
              <option value="finance">Tài chính</option>
              <option value="executive">Ban điều hành</option>
            </select>
          </label>
          <label className="grid gap-1 text-xs font-bold text-[#5f7068]">
            Trạng thái
            <select
              name="status"
              required
              defaultValue="active"
              className="min-h-11 min-w-0 rounded-xl border border-[#ced8d1] bg-white px-3 text-sm font-medium"
            >
              {Object.entries(ERP_ACCOUNT_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="mt-3 text-xs leading-5 text-[#7c8882]">
          Tài khoản mới chưa đăng nhập được cho tới khi có mật khẩu riêng — bước
          nối sang Supabase Auth vẫn đang chờ. Cấp vai trò bên dưới thì quyền có
          hiệu lực ngay với các nghiệp vụ kiểm quyền ở tầng cơ sở dữ liệu.
        </p>
        <div className="mt-4">
          <SubmitButton>Lưu tài khoản</SubmitButton>
        </div>
        <ActionMessage state={state} />
      </form>
    </details>
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

function GrantForm({ account }: { account: ErpRegistryAccount }) {
  const [state, action] = useActionState(
    setRoleAssignmentAction,
    INITIAL_ACCOUNT_ACTION_STATE,
  );
  return (
    <form action={action} className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto_auto]">
      <input type="hidden" name="accountId" value={account.accountId} />
      <label className="grid gap-1 text-xs font-bold text-[#5f7068]">
        Vai trò
        <select
          name="role"
          required
          defaultValue="regional-manager"
          className="min-h-10 min-w-0 rounded-lg border border-[#ced8d1] bg-white px-2 text-sm"
        >
          {ERP_REGISTRY_ROLES.map((role) => (
            <option key={role} value={role}>
              {ERP_REGISTRY_ROLE_LABELS[role]}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-xs font-bold text-[#5f7068]">
        Cơ sở
        <select
          name="siteId"
          defaultValue=""
          className="min-h-10 min-w-0 rounded-lg border border-[#ced8d1] bg-white px-2 text-sm"
        >
          <option value="">Toàn vùng</option>
          {ERP_SITES.map((site) => (
            <option key={site.id} value={site.id}>
              {site.shortName}
            </option>
          ))}
        </select>
      </label>
      <button
        type="submit"
        name="active"
        value="true"
        className="min-h-10 self-end rounded-lg bg-[#183f34] px-3 text-sm font-black text-white"
      >
        Cấp
      </button>
      <button
        type="submit"
        name="active"
        value="false"
        className="min-h-10 self-end rounded-lg border border-[#b9c8c1] bg-white px-3 text-sm font-black text-[#385047]"
      >
        Thu hồi
      </button>
      <div className="sm:col-span-4">
        <ActionMessage state={state} />
      </div>
    </form>
  );
}

export function AccountAdministration({ accounts, audit }: Props) {
  return (
    <div className="space-y-5">
      <header className="rounded-3xl bg-[#173f34] p-5 text-white sm:p-8">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#b9d5ca]">
          Quản trị hệ thống
        </p>
        <h1 className="mt-2 text-3xl font-black sm:text-5xl">Tài khoản & phân quyền</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-[#d4e4de]">
          Một người có thể phụ trách nhiều cơ sở: mỗi cơ sở là một dòng cấp
          quyền, thêm hay bớt đều không cần sửa mã nguồn. Vai trò{" "}
          <strong className="text-white">Quản trị hệ thống</strong> tách khỏi vai
          trò <strong className="text-white">Giám đốc</strong> để nhật ký phân
          biệt được lúc nào người đó hành động với tư cách nghiệp vụ, lúc nào với
          tư cách kỹ thuật.
        </p>
      </header>

      <CreateAccountForm />

      <section className="space-y-3">
        {accounts.map((account) => (
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
                  {account.jobTitle} · <span className="font-mono">{account.accountId}</span>
                </p>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-black ${
                  account.status === "active"
                    ? "bg-[#dff1e8] text-[#246249]"
                    : "bg-[#ffe4de] text-[#934336]"
                }`}
              >
                {ERP_ACCOUNT_STATUS_LABELS[account.status]}
              </span>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {account.grants.length === 0 ? (
                <span className="text-sm text-[#8a958f]">
                  Chưa được cấp vai trò nào — tài khoản này chưa mở được nghiệp vụ.
                </span>
              ) : (
                account.grants.map((grant) => (
                  <span
                    key={`${grant.role}:${grant.siteId ?? "all"}`}
                    className="rounded-full bg-[#eef3f0] px-3 py-1 text-xs font-black text-[#43574e]"
                  >
                    {ERP_REGISTRY_ROLE_LABELS[grant.role]} ·{" "}
                    {grant.siteId
                      ? (SITE_NAME_BY_ID.get(grant.siteId) ?? grant.siteId)
                      : "Toàn vùng"}
                  </span>
                ))
              )}
            </div>

            <GrantForm account={account} />
            <div className="mt-3 border-t border-[#eaefec] pt-3">
              <StatusForm account={account} />
            </div>
          </article>
        ))}
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
                  {event.actorAccountId} → {event.targetAccountId}
                </p>
                <p className="text-[#6e7b75]">
                  {event.action} ·{" "}
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
