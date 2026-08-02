"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { ERP_SITES } from "@/domain/erp";
import {
  ERP_ACCOUNT_STATUS_LABELS,
  ERP_REGISTRY_ROLE_LABELS,
} from "@/domain/erp-account-roles";
import { updateProfileAction } from "@/app/erp/profile-actions";
import type {
  ErpAccountAdminEvent,
  ErpRegistryAccount,
} from "@/lib/erp/account-registry-repository";

type ProfileActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

const INITIAL_PROFILE_ACTION_STATE: ProfileActionState = {
  status: "idle",
  message: "",
};

type Props = {
  account: ErpRegistryAccount;
  canEdit: boolean;
  audit: readonly ErpAccountAdminEvent[];
};

const SITE_NAME_BY_ID = new Map(ERP_SITES.map((site) => [site.id, site.shortName]));

const EMPLOYMENT_TYPE_LABELS: Record<string, string> = {
  permanent: "Chính thức",
  seasonal: "Thời vụ",
  management: "Quản lý",
  finance: "Tài chính",
  executive: "Ban điều hành",
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="min-h-11 rounded-xl bg-[#183f34] px-5 text-sm font-black text-white disabled:cursor-wait disabled:opacity-60"
    >
      {pending ? "Đang lưu…" : "Lưu hồ sơ"}
    </button>
  );
}

function EditForm({ account }: { account: ErpRegistryAccount }) {
  const [state, action] = useActionState(
    updateProfileAction,
    INITIAL_PROFILE_ACTION_STATE,
  );
  return (
    <form action={action} className="grid gap-3 md:grid-cols-2">
      <input type="hidden" name="accountId" value={account.accountId} />
      <label className="grid gap-1 text-xs font-bold text-[#5f7068]">
        Họ và tên
        <input
          name="displayName"
          defaultValue={account.displayName}
          required
          className="min-h-11 rounded-xl border border-[#ced8d1] bg-white px-3 text-sm font-medium"
        />
      </label>
      <label className="grid gap-1 text-xs font-bold text-[#5f7068]">
        Chức danh
        <input
          name="jobTitle"
          defaultValue={account.jobTitle}
          required
          className="min-h-11 rounded-xl border border-[#ced8d1] bg-white px-3 text-sm font-medium"
        />
      </label>
      <label className="grid gap-1 text-xs font-bold text-[#5f7068]">
        Số điện thoại
        <input
          name="phone"
          type="tel"
          defaultValue={account.phone ?? ""}
          placeholder="09xx xxx xxx"
          className="min-h-11 rounded-xl border border-[#ced8d1] bg-white px-3 text-sm font-medium"
        />
      </label>
      <label className="grid gap-1 text-xs font-bold text-[#5f7068]">
        Hình thức làm việc
        <select
          name="employmentType"
          required
          defaultValue={account.employmentType}
          className="min-h-11 rounded-xl border border-[#ced8d1] bg-white px-3 text-sm font-medium"
        >
          {Object.entries(EMPLOYMENT_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <p className="text-xs leading-5 text-[#7c8882] md:col-span-2">
        Đổi <strong>chức danh</strong> ở đây chỉ đổi cái nhãn hiển thị —
        không thêm quyền nào. Cấp hoặc thu hồi vai trò chỉ thực hiện được ở{" "}
        <span className="font-mono">/erp/tai-khoan</span>.
      </p>
      {state.status !== "idle" ? (
        <p
          role={state.status === "error" ? "alert" : "status"}
          className={`md:col-span-2 rounded-xl px-4 py-3 text-sm font-bold ${
            state.status === "error"
              ? "bg-[#fff0eb] text-[#91483a]"
              : "bg-[#e3f2eb] text-[#245e48]"
          }`}
        >
          {state.message}
        </p>
      ) : null}
      <div className="md:col-span-2">
        <SubmitButton />
      </div>
    </form>
  );
}

export function StaffProfileView({ account, canEdit, audit }: Props) {
  return (
    <div className="space-y-5">
      <header className="rounded-3xl bg-[#173f34] p-5 text-white sm:p-8">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#b9d5ca]">
          Hồ sơ nhân sự
        </p>
        <h1 className="mt-2 text-3xl font-black sm:text-5xl">{account.displayName}</h1>
        <p className="mt-3 text-sm text-[#d4e4de]">
          {account.jobTitle} · <span className="font-mono">{account.accountId}</span>
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-[#d8e0db] bg-white p-5 shadow-sm">
          <h2 className="text-sm font-black uppercase tracking-[0.1em] text-[#477565]">
            Danh tính
          </h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-[#6e7b75]">Mã nhân viên</dt>
              <dd className="font-mono text-[#20342c]">{account.accountId}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-[#6e7b75]">Số điện thoại</dt>
              <dd className="text-[#20342c]">{account.phone ?? "Chưa có"}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-[#6e7b75]">Email đăng nhập</dt>
              <dd className="text-[#20342c]">{account.email ?? "Chưa cấp"}</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-2xl border border-[#d8e0db] bg-white p-5 shadow-sm">
          <h2 className="text-sm font-black uppercase tracking-[0.1em] text-[#477565]">
            Công việc
          </h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-[#6e7b75]">Hình thức</dt>
              <dd className="text-[#20342c]">
                {EMPLOYMENT_TYPE_LABELS[account.employmentType] ?? account.employmentType}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-[#6e7b75]">Ngày vào làm</dt>
              <dd className="text-[#20342c]">
                {account.startedAt
                  ? new Date(account.startedAt).toLocaleDateString("vi-VN")
                  : "Chưa có"}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-[#6e7b75]">Trạng thái</dt>
              <dd
                className={
                  account.status === "active" ? "text-[#246249]" : "text-[#934336]"
                }
              >
                {ERP_ACCOUNT_STATUS_LABELS[account.status]}
              </dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="rounded-2xl border border-[#d8e0db] bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-sm font-black uppercase tracking-[0.1em] text-[#477565]">
          Quyền hạn
        </h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {account.grants.length === 0 ? (
            <span className="text-sm text-[#8a958f]">Chưa được cấp vai trò nào.</span>
          ) : (
            account.grants.map((grant) => (
              <span
                key={`${grant.role}:${grant.siteId ?? "all"}`}
                className="rounded-full bg-[#eef3f0] px-3 py-1 text-xs font-black text-[#43574e]"
              >
                {ERP_REGISTRY_ROLE_LABELS[grant.role]} ·{" "}
                {grant.siteId ? (SITE_NAME_BY_ID.get(grant.siteId) ?? grant.siteId) : "Toàn vùng"}
              </span>
            ))
          )}
        </div>
        <p className="mt-3 text-xs text-[#7c8882]">
          Thay đổi vai trò chỉ thực hiện được ở{" "}
          <span className="font-mono">/erp/tai-khoan</span>, bởi tài khoản có
          quyền quản trị hệ thống.
        </p>
      </section>

      {canEdit ? (
        <section className="rounded-2xl border border-[#d8e0db] bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-sm font-black uppercase tracking-[0.1em] text-[#477565]">
            Sửa hồ sơ
          </h2>
          <div className="mt-3">
            <EditForm account={account} />
          </div>
        </section>
      ) : null}

      <section className="rounded-2xl border border-[#d8e0db] bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-sm font-black uppercase tracking-[0.1em] text-[#477565]">
          Hoạt động gần đây
        </h2>
        <p className="mt-1 text-xs text-[#8a958f]">
          Đây mới là nhật ký quản trị tài khoản (tạo, sửa hồ sơ, cấp/thu hồi
          vai trò). Nhật ký đầy đủ mọi thao tác nghiệp vụ là T15, chưa làm.
        </p>
        {audit.length === 0 ? (
          <p className="mt-3 text-sm text-[#7b8881]">Chưa có thay đổi nào được ghi nhận.</p>
        ) : (
          <ul className="mt-3 divide-y divide-[#eef2f0]">
            {audit.map((event) => (
              <li key={event.id} className="py-3 text-sm">
                <p className="font-bold text-[#2c3e36]">
                  {event.action} · thực hiện bởi{" "}
                  <span className="font-mono">{event.actorAccountId}</span>
                </p>
                <p className="text-[#6e7b75]">
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
