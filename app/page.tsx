import { cookies } from "next/headers";
import NinhBinhLanding, { type Language } from "./ninh-binh-landing";
import {
  getExperienceSurfaceAttributes,
  readPublicEnvironment,
} from "@/config/experience";
import { isCustomerBookingEnabled } from "@/lib/customer-data/booking-repository";
import { DESTINATIONS } from "@/content/destinations";
import { DESTINATION_PAGE_SLUGS } from "@/content/landing-destinations";
import { PACKAGES } from "@/content/packages";
import { goiDaHetMua } from "@/content/packages-en";
import { CONTACT } from "@/content/contact";
import { JsonLd } from "@/components/shared/json-ld";
import { jsonLdDoanhNghiep } from "@/domain/du-lieu-cau-truc";
import { absoluteUrl } from "@/lib/site-url";

export const metadata = {
  // Trang chủ đổi ngôn ngữ bằng `?lang=`; các biến thể ấy cùng một nội dung.
  alternates: { canonical: "/" },
};

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
  // Nguon that duy nhat cho "co hua dat cho duoc khong": bien
  // CUSTOMER_BOOKING_ENABLED, dung dung mot ham voi /packages va
  // /checkout (xem lib/customer-data/booking-repository.ts). Da curl
  // production va thay /checkout tra ve nhanh "Gói A · giữ chỗ trên lõi
  // ERP" -- tuc bien nay dang BAT tren production, khong con la "Online
  // checkout is not configured" nhu chu thich cu tung ghi.
  const bookingEnabled = isCustomerBookingEnabled();
  // Trang chủ tự khai cấu hình đang phục vụ ra DOM, cùng một hàm với /plan và
  // /packages. Tính ở phía máy chủ rồi truyền xuống, vì `NinhBinhLanding` là
  // client component.
  const surfaceAttributes = getExperienceSurfaceAttributes(
    readPublicEnvironment(),
    { customerBookingEnabled: bookingEnabled },
  );

  return (
    <>
    <JsonLd
      du={jsonLdDoanhNghiep({
        ten: "Ninh Bình Journey",
        url: absoluteUrl("/"),
        anh: absoluteUrl("/images/og/ninh-binh-journey.jpg"),
        dienThoai: CONTACT.phoneLabel,
        moTa: "Núi đá vôi, sông nước và cố đô Hoa Lư: điểm đến, lịch trình và gói tham quan Ninh Bình.",
      })}
    />
    <NinhBinhLanding
      initialLang={lang}
      key={`${lang}-${source}-${presentationMode ? "presentation" : "standard"}`}
      source={source}
      bookingEnabled={bookingEnabled}
      presentationMode={presentationMode}
      surfaceAttributes={surfaceAttributes}
      bayGio={new Date().toISOString()}
      soLieuCong={{
        // Mọi trang điểm đến (9 nơi trên bản đồ lịch trình + 6 trang hồ sơ),
        // đúng con số "mười lăm điểm đến" trang chủ in ra bên dưới.
        soDiemDen: new Set([...DESTINATIONS.map((d) => d.slug), ...Object.values(DESTINATION_PAGE_SLUGS)]).size,
        // Năm chương hồ sơ trong `collaboration-editorial.tsx`. Đếm tay vì
        // dữ liệu ấy nằm ngay trong component chứ chưa tách ra kho riêng;
        // tách được thì thay bằng `.length`.
        soHoSo: 5,
        // Chỉ đếm gói còn bán: Bàn Trăng hết mùa vẫn trưng ở /packages nhưng
        // không đặt được, nên cổng "Đặt chỗ" không tính nó.
        soGoi: PACKAGES.filter((goi) => !goiDaHetMua(goi)).length,
      }}
    />
    </>
  );
}
