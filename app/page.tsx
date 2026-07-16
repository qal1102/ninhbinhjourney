import NinhBinhLanding, { type Language } from "./ninh-binh-landing";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function Home({ searchParams }: PageProps) {
  const params = (await searchParams) ?? {};
  const requestedLang = firstParam(params.lang);
  const lang: Language = requestedLang === "vi" ? "vi" : "en";
  const source = firstParam(params.source) ?? "";
  const presentationMode =
    firstParam(params.presentation) === "1" ||
    firstParam(params.mode) === "presentation" ||
    process.env.NEXT_PUBLIC_PRESENTATION_MODE === "true";

  return (
    <NinhBinhLanding
      initialLang={lang}
      key={`${lang}-${source}-${presentationMode ? "presentation" : "standard"}`}
      source={source}
      presentationMode={presentationMode}
    />
  );
}
