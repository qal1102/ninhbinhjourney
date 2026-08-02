"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { updateRegistryProfile } from "@/lib/erp/account-registry-repository";
import { getCurrentErpUser } from "@/lib/erp/demo-session";

// Not exported: a "use server" file may only export async functions -- see
// the note in app/erp/actions.ts next to ChangePasswordActionState for what
// broke `next build` the first time this was tried. The type and initial
// value live with the one client component that calls this action.
type ProfileActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

const ProfileSchema = z.object({
  accountId: z.string().trim().min(2).max(100),
  displayName: z.string().trim().min(2, "Họ tên phải có ít nhất 2 ký tự.").max(120),
  jobTitle: z.string().trim().min(2, "Chức danh phải có ít nhất 2 ký tự.").max(160),
  phone: z
    .string()
    .trim()
    .max(20)
    .refine((value) => value === "" || /^[0-9+][0-9 ()+-]{6,19}$/.test(value), {
      message: "Số điện thoại chưa đúng định dạng.",
    }),
  employmentType: z.enum([
    "permanent",
    "seasonal",
    "management",
    "finance",
    "executive",
  ]),
});

/**
 * Employees never reach this action -- there is no edit form rendered for
 * them (SO_TAY_HE_THONG_VI.md mục 6) -- but the check here is what actually
 * stops a crafted request, not the missing button. `erp_manager_update_profile`
 * checks the same thing again in the database, on purpose.
 */
export async function updateProfileAction(
  _previous: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> {
  try {
    const actor = await getCurrentErpUser();
    if (!actor) {
      return { status: "error", message: "Phiên đăng nhập đã hết hạn." };
    }
    const input = ProfileSchema.parse({
      accountId: formData.get("accountId"),
      displayName: formData.get("displayName"),
      jobTitle: formData.get("jobTitle"),
      phone: formData.get("phone"),
      employmentType: formData.get("employmentType"),
    });
    await updateRegistryProfile({
      actorAccountId: actor.id,
      accountId: input.accountId,
      displayName: input.displayName,
      jobTitle: input.jobTitle,
      phone: input.phone,
      employmentType: input.employmentType,
    });
    revalidatePath(`/erp/nhan-su/${input.accountId}`);
    return { status: "success", message: "Đã lưu hồ sơ." };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        status: "error",
        message: error.issues[0]?.message ?? "Dữ liệu gửi lên chưa đúng định dạng.",
      };
    }
    if (error instanceof Error) return { status: "error", message: error.message };
    return { status: "error", message: "Không thể lưu hồ sơ lúc này." };
  }
}
