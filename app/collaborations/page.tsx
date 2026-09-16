import { cookies } from "next/headers";
import { CollaborationEditorial } from "@/components/discovery/collaboration-editorial";

export const metadata = {
  title: "Hồ sơ kết nối | Ninh Bình Journey",
  description: "Các đề xuất biên tập độc lập để trao đổi về Ninh Bình.",
  alternates: { canonical: "/collaborations" },
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function CollaborationsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const savedLang = (await cookies()).get("ninh-binh-lang")?.value;
  const requestedLang = firstParam(params.lang);
  const lang = requestedLang === "en" || (!requestedLang && savedLang === "en") ? "en" : "vi";
  return <CollaborationEditorial lang={lang} source={firstParam(params.source) ?? ""} />;
}
