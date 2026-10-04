import { chuoiJsonLd } from "@/domain/du-lieu-cau-truc";

/** Thẻ JSON-LD cho máy tìm kiếm, theo hướng dẫn `json-ld.md` của Next. */
export function JsonLd({ du }: { du: unknown }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: chuoiJsonLd(du) }} />;
}
