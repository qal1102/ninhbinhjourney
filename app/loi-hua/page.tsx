import type { Metadata } from "next";
import { LoiHuaView } from "@/components/commerce/loi-hua-view";
import { ThanhDauTrang } from "@/components/shared/thanh-dau-trang";
import { docNgonNgu } from "@/lib/ngon-ngu-server";

export const metadata: Metadata = {
  title: "Lời hứa giữ di sản Tràng An · Ninh Bình Journey",
  description: "Năm điều khách hứa khi đi thuyền ở Tràng An, di sản thế giới. Hứa xong được một dấu vào sổ dấu.",
};

export default async function LoiHuaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const lang = await docNgonNgu(await searchParams);
  return (
    <>
      <ThanhDauTrang lang={lang} />
      <main lang={lang} className="min-h-screen bg-[#f4f0e7] px-5 py-10 text-[#151a17] sm:px-8 lg:py-16">
        <LoiHuaView lang={lang} />
      </main>
    </>
  );
}
