import type { Metadata } from "next";
import { cookies } from "next/headers";
import { VisitorGroupMemberExperience } from "@/components/commerce/visitor-group-member-page";

export const metadata: Metadata = {
  title: "Những nơi bạn đã đi qua · Ninh Bình Journey",
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function VisitorGroupMemberPage({
  params,
  searchParams,
}: {
  params: Promise<{ ma: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Cùng một luật với trang chủ: `?lang=` trên đường dẫn trước, rồi tới cookie
  // `ninh-binh-lang` mà nút đổi ngôn ngữ ở các trang khác đã ghi lại.
  const requestedLang = firstParam(((await searchParams) ?? {}).lang);
  const savedLang = (await cookies()).get("ninh-binh-lang")?.value;
  const lang = requestedLang === "en" || (!requestedLang && savedLang === "en") ? "en" : "vi";

  return <VisitorGroupMemberExperience memberCode={(await params).ma} lang={lang} />;
}
