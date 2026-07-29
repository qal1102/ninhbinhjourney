import { cookies } from "next/headers";
import NinhBinhLanding, { type Language } from "./ninh-binh-landing";
import { readPublicEnvironment } from "@/config/experience";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function Home({ searchParams }: PageProps) {
  const params = (await searchParams) ?? {};
  const cookieStore = await cookies();
  const requestedLang = firstParam(params.lang);
  const savedLang = cookieStore.get("ninh-binh-lang")?.value;
  const lang: Language =
    requestedLang === "en" || (!requestedLang && savedLang === "en") ? "en" : "vi";
  const source = firstParam(params.source) ?? "";
  const presentationMode =
    firstParam(params.presentation) === "1" ||
    firstParam(params.mode) === "presentation" ||
    process.env.NEXT_PUBLIC_PRESENTATION_MODE === "true";
  const environment = readPublicEnvironment();
  const clientDemo =
    environment.status === "ready" &&
    environment.config.mode === "client-demo";

  return (
    <NinhBinhLanding
      initialLang={lang}
      key={`${lang}-${source}-${presentationMode ? "presentation" : "standard"}`}
      source={source}
      clientDemo={clientDemo}
      presentationMode={presentationMode}
    />
  );
}
