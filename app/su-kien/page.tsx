import type { Metadata } from "next";
import Link from "next/link";
import { ThanhDauTrang } from "@/components/shared/thanh-dau-trang";
import { ch } from "@/lib/ngon-ngu";
import { docNgonNgu } from "@/lib/ngon-ngu-server";
import { suKienDangMo } from "@/lib/customer-data/su-kien-repository";

export const metadata: Metadata = {
  title: "Sự kiện và thi ảnh · Ninh Bình Journey",
  description: "Gặp gỡ nghệ sĩ khách mời ở Tràng An, rút thăm suất giao lưu, và thi ảnh đẹp Ninh Bình hằng tháng.",
};

function ngay(iso: string, lang: "vi" | "en") {
  return new Date(iso).toLocaleDateString(lang === "en" ? "en-GB" : "vi-VN", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", year: "numeric" });
}

export default async function SuKienIndex({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const lang = await docNgonNgu(await searchParams);
  const ds = await suKienDangMo();
  const duoi = lang === "en" ? "?lang=en" : "";
  return (
    <>
      <ThanhDauTrang lang={lang} hienTai="mua" />
      <main lang={lang} className="min-h-screen bg-[#f4f0e7] px-5 py-10 text-[#151a17] sm:px-8 lg:py-16">
        <div className="mx-auto max-w-4xl">
          <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-[#9a6328]">{ch(lang, "Đang diễn ra", "Happening now")}</p>
          <h1 className="font-display mt-2 text-4xl leading-tight text-[#183f34] sm:text-5xl">{ch(lang, "Sự kiện và thi ảnh", "Events and photo contest")}</h1>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2" data-testid="ds-su-kien">
            {ds.map((sk) => (
              <li key={sk.slug} className="flex flex-col rounded-3xl bg-[#183f34] p-6 text-white">
                <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#e7c78d]">{ch(lang, "Sự kiện", "Event")} · {ngay(sk.dienRaLuc, lang)}</p>
                <h2 className="font-display mt-2 text-2xl leading-snug">{sk.ten}</h2>
                <p className="mt-2 text-sm text-white/75">{sk.khachMoi}</p>
                <p className="mt-3 text-sm text-white/75">
                  {sk.trangThai === "da-rut"
                    ? ch(lang, "Đã rút thăm · xem người trúng", "Drawn · see the winners")
                    : ch(lang, `${sk.soGiai} suất giao lưu · ${sk.soNguoi} người đã đăng ký · hạn ${ngay(sk.hanDangKy, lang)}`, `${sk.soGiai} places · ${sk.soNguoi} entered · closes ${ngay(sk.hanDangKy, lang)}`)}
                </p>
                <Link href={`/su-kien/${sk.slug}${duoi}`} className="mt-5 inline-flex min-h-12 items-center justify-center rounded-full bg-white px-5 font-extrabold text-[#183f34]">
                  {sk.trangThai === "da-rut" ? ch(lang, "Xem kết quả", "See results") : ch(lang, "Đăng ký rút thăm", "Enter the draw")}
                </Link>
              </li>
            ))}
            <li className="flex flex-col rounded-3xl border border-[#e2d3b4] bg-[#fbf7ee] p-6">
              <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#9a6328]">{ch(lang, "Hằng tháng", "Every month")}</p>
              <h2 className="font-display mt-2 text-2xl leading-snug text-[#183f34]">{ch(lang, "Ảnh đẹp Ninh Bình", "Ninh Binh photo of the month")}</h2>
              <p className="mt-2 text-sm leading-6 text-[#4a554e]">{ch(lang, "Gửi ảnh bạn chụp ở Tràng An, Tam Cốc, Bái Đính, Tam Chúc hay Hoa Lư. Giải nhất 4 vé gói Tràng An sáng, Tam Cốc chiều.", "Send a photo you took at Trang An, Tam Coc, Bai Dinh, Tam Chuc or Hoa Lu. First prize: 4 tickets for the Trang An morning, Tam Coc afternoon plan.")}</p>
              <Link href={`/thi-anh${duoi}`} className="mt-5 inline-flex min-h-12 items-center justify-center rounded-full bg-[#183f34] px-5 font-extrabold text-white">
                {ch(lang, "Xem ảnh và gửi ảnh", "See photos and enter")}
              </Link>
            </li>
          </ul>
        </div>
      </main>
    </>
  );
}
