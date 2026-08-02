"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { changePasswordErpAction } from "@/app/erp/actions";

// A "use server" file may only export async functions, so this form's own
// state type and initial value live here instead of in app/erp/actions.ts.
type ChangePasswordActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

const INITIAL_CHANGE_PASSWORD_STATE: ChangePasswordActionState = {
  status: "idle",
  message: "",
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="min-h-12 w-full rounded-xl bg-[#e7c78d] px-5 font-black text-[#17352c] transition hover:bg-[#f2d69f] disabled:opacity-60"
    >
      {pending ? "Đang lưu..." : "Đặt mật khẩu mới"}
    </button>
  );
}

export function ChangePasswordForm() {
  const [state, action] = useActionState(
    changePasswordErpAction,
    INITIAL_CHANGE_PASSWORD_STATE,
  );

  return (
    <form action={action} className="mt-8 space-y-5">
      <label className="block">
        <span className="text-sm font-bold text-white/78">Mật khẩu mới</span>
        <input
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          className="mt-2 min-h-12 w-full rounded-xl border border-white/16 bg-white/[0.07] px-4 text-white outline-none transition placeholder:text-white/30 focus:border-[#e7c78d]"
          placeholder="Ít nhất 8 ký tự"
        />
      </label>
      <label className="block">
        <span className="text-sm font-bold text-white/78">Nhập lại mật khẩu mới</span>
        <input
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          className="mt-2 min-h-12 w-full rounded-xl border border-white/16 bg-white/[0.07] px-4 text-white outline-none transition placeholder:text-white/30 focus:border-[#e7c78d]"
          placeholder="Gõ lại để xác nhận"
        />
      </label>
      {state.status === "error" ? (
        <p role="alert" className="rounded-xl border border-[#efb6aa]/30 bg-[#9e4636]/20 px-4 py-3 text-sm text-[#ffd9d1]">
          {state.message}
        </p>
      ) : null}
      <SubmitButton />
    </form>
  );
}
