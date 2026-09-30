import "server-only";

import { cookies } from "next/headers";
import { chonNgonNgu, KHOA_NGON_NGU, type NgonNgu } from "@/lib/ngon-ngu";

/** Ngôn ngữ cho một trang máy chủ, theo luật ở `lib/ngon-ngu.ts`. */
export async function docNgonNgu(
  params?: Record<string, string | string[] | undefined>,
): Promise<NgonNgu> {
  const daLuu = (await cookies()).get(KHOA_NGON_NGU)?.value;
  return chonNgonNgu(params?.lang, daLuu);
}
