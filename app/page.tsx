import { cookies } from "next/headers";
import NinhBinhLanding, { type Language } from "./ninh-binh-landing";
import {
  getExperienceSurfaceAttributes,
  readPublicEnvironment,
} from "@/config/experience";
import { isCustomerBookingEnabled } from "@/lib/customer-data/booking-repository";
import { DESTINATIONS } from "@/content/destinations";
import { PACKAGES } from "@/content/packages";

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
    <NinhBinhLanding
      initialLang={lang}
      key={`${lang}-${source}-${presentationMode ? "presentation" : "standard"}`}
      source={source}
      bookingEnabled={bookingEnabled}
      presentationMode={presentationMode}
      surfaceAttributes={surfaceAttributes}
      bayGio={new Date().toISOString()}
      soLieuCong={{
        soDiemDen: DESTINATIONS.length,
        // Năm chương hồ sơ trong `collaboration-editorial.tsx`. Đếm tay vì
        // dữ liệu ấy nằm ngay trong component chứ chưa tách ra kho riêng;
        // tách được thì thay bằng `.length`.
        soHoSo: 5,
        soGoi: PACKAGES.length,
      }}
    />
  );
}
