import type { Metadata } from "next";
import { ChonTrangVe } from "@/components/commerce/chon-trang-ve";
import { SoDauView } from "@/components/commerce/so-dau-view";
import { ThanhDauTrang } from "@/components/shared/thanh-dau-trang";
import { docNgonNgu } from "@/lib/ngon-ngu-server";

export const metadata: Metadata = {
  title: "Sổ dấu · Ninh Bình Journey",
  description: "Quét mã QR ở Tràng An, Tam Cốc, Bái Đính, Tam Chúc và Cố đô Hoa Lư để đóng dấu vào sổ, không cần đăng nhập.",
};

export default async function SoDauPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const lang = await docNgonNgu(await searchParams);
  return (
    <>
      <ThanhDauTrang lang={lang} hienTai="ve" />
      <main lang={lang} className="min-h-screen bg-[#f4f0e7] px-5 py-10 text-[#151a17] sm:px-8 lg:py-16">
        <ChonTrangVe dangO="dau" lang={lang} />
        <SoDauView lang={lang} />
      </main>
    </>
  );
}
