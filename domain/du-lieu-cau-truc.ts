/**
 * Dữ liệu có cấu trúc (JSON-LD, schema.org) cho máy tìm kiếm.
 *
 * Chỉ ghi điều đã có trong nội dung trang. Gói không kèm giá: giá trên web là
 * giá minh hoạ, đưa cho máy tìm kiếm như giá bán thật là sai.
 */

export type DiemDenCauTruc = {
  ten: string;
  moTa: string;
  url: string;
  anh: string;
  /** [vĩ độ, kinh độ] */
  toaDo: readonly [number, number];
};

export function jsonLdDiemDen(d: DiemDenCauTruc) {
  return {
    "@context": "https://schema.org",
    "@type": "TouristAttraction",
    name: d.ten,
    description: d.moTa,
    url: d.url,
    image: d.anh,
    geo: { "@type": "GeoCoordinates", latitude: d.toaDo[0], longitude: d.toaDo[1] },
    address: { "@type": "PostalAddress", addressRegion: "Ninh Bình", addressCountry: "VN" },
  };
}

export type GoiCauTruc = {
  ten: string;
  moTa: string;
  url: string;
  anh: string;
  thoiLuongPhut: number;
  /** Tên các điểm trong gói, theo thứ tự đi. */
  cacDiem: readonly string[];
  nhaToChuc: { ten: string; url: string };
};

/** `PT…H…M` theo ISO 8601. */
export function thoiLuongIso(phut: number): string {
  const gio = Math.floor(phut / 60);
  const du = phut % 60;
  return `PT${gio ? `${gio}H` : ""}${du || !gio ? `${du}M` : ""}`;
}

export function jsonLdGoi(g: GoiCauTruc) {
  return {
    "@context": "https://schema.org",
    "@type": "TouristTrip",
    name: g.ten,
    description: g.moTa,
    url: g.url,
    image: g.anh,
    duration: thoiLuongIso(g.thoiLuongPhut),
    itinerary: {
      "@type": "ItemList",
      itemListElement: g.cacDiem.map((ten, i) => ({
        "@type": "ListItem",
        position: i + 1,
        item: { "@type": "TouristAttraction", name: ten },
      })),
    },
    provider: { "@type": "TravelAgency", name: g.nhaToChuc.ten, url: g.nhaToChuc.url },
  };
}

/**
 * Không có email: địa chỉ thư cố ý không nằm trong HTML máy chủ (QA-P2-09,
 * `content/contact.ts`), bộ quét thư rác đọc HTML là lấy được.
 */
export function jsonLdDoanhNghiep(input: { ten: string; url: string; anh: string; dienThoai: string; moTa: string }) {
  return {
    "@context": "https://schema.org",
    "@type": "TravelAgency",
    name: input.ten,
    url: input.url,
    image: input.anh,
    description: input.moTa,
    telephone: input.dienThoai,
    areaServed: { "@type": "AdministrativeArea", name: "Ninh Bình" },
    address: { "@type": "PostalAddress", addressRegion: "Ninh Bình", addressCountry: "VN" },
  };
}

/** Chuỗi an toàn để nhét vào thẻ `<script>`: thoát `<` để không đóng thẻ sớm. */
export function chuoiJsonLd(du: unknown): string {
  return JSON.stringify(du).replace(/</g, "\\u003c");
}
