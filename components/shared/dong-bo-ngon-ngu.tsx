"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { chonNgonNgu, KHOA_NGON_NGU } from "@/lib/ngon-ngu";

/**
 * Giữ `<html lang>` khớp ngôn ngữ khách đang đọc. Bố cục gốc in cứng "vi" để
 * mọi trang vẫn dựng tĩnh được; soát 07/10/2026 thấy trang đã sang tiếng Anh
 * (sau cả khi tải lại) mà `lang` vẫn là "vi", trình đọc màn hình đọc chữ Anh
 * bằng giọng Việt. Cùng luật chọn với mọi trang: `?lang=` rồi tới cookie.
 * ERP chỉ có tiếng Việt nên bỏ qua.
 */
export function DongBoNgonNgu() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  useEffect(() => {
    if (pathname.startsWith("/erp")) {
      document.documentElement.lang = "vi";
      return;
    }
    const cookie = document.cookie
      .split("; ")
      .find((dong) => dong.startsWith(`${KHOA_NGON_NGU}=`))
      ?.split("=")[1];
    document.documentElement.lang = chonNgonNgu(searchParams.get("lang"), cookie);
  }, [pathname, searchParams]);
  return null;
}
