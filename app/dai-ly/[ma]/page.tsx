import type { Metadata } from "next";
import Link from "next/link";
import { DaiLyCong } from "@/components/commerce/dai-ly-cong";
import { dungCongDaiLy } from "@/lib/dai-ly-cong";
import { moCongDaiLy } from "@/lib/dai-ly-repository";

export const metadata: Metadata = {
  title: "Cổng đại lý · Ninh Bình Journey",
  robots: { index: false, follow: false },
};

/**
 * Cổng của một đại lý, mở bằng đường dẫn có khoá (`?k=`) giám đốc cấp trong
 * ERP. Sai khoá hay khoá đã được cấp lại thì không lộ gì, kể cả mã có thật
 * hay không.
 */
export default async function DaiLyPage({
  params,
  searchParams,
}: {
  params: Promise<{ ma: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ma = (await params).ma.toUpperCase();
  const k = (await searchParams).k;
  const id = await moCongDaiLy(ma, typeof k === "string" ? k : "");
  const cong = id ? await dungCongDaiLy(id) : null;
  return (
    <main lang="vi" className="min-h-screen bg-[#f4f0e7] px-4 py-8 text-[#151a17] sm:px-8 lg:py-14">
      {cong ? (
        <DaiLyCong {...cong} />
      ) : (
        <div className="mx-auto max-w-xl rounded-3xl border border-[#d7d5cd] bg-white p-8 text-center" data-testid="dai-ly-khong-mo">
          <h1 className="font-display text-3xl text-[#183f34]">Đường dẫn cổng không còn dùng được</h1>
          <p className="mt-4 leading-7 text-[#59654b]">
            Đường dẫn có thể đã gõ thiếu, hoặc khoá đã được cấp lại. Xin liên hệ Ninh Bình Journey để nhận đường dẫn mới.
          </p>
          <Link href="/" className="mt-6 inline-flex min-h-11 items-center rounded-full border border-[#183f34] px-5 font-bold text-[#183f34]">
            Về trang chủ
          </Link>
        </div>
      )}
    </main>
  );
}
