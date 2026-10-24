import { NextResponse, type NextRequest } from "next/server";
import { dungCsp, laLenhTuTrangKhac, nhomGioiHan } from "@/domain/bao-mat";
import { conLuotApi } from "@/lib/bao-mat/gioi-han-api";
import { updateSession } from "@/lib/supabase/update-session";

function tuChoi(status: 403 | 429, ma: string, loiNhan: string) {
  return NextResponse.json(
    { accepted: false, error: { code: ma, message: loiNhan } },
    { status, headers: { "Cache-Control": "no-store", ...(status === 429 ? { "Retry-After": "600" } : {}) } },
  );
}

export async function proxy(request: NextRequest) {
  const duong = request.nextUrl.pathname;

  if (duong.startsWith("/api/")) {
    const nhom = nhomGioiHan(duong, request.method);
    if (nhom) {
      if (laLenhTuTrangKhac(request.headers)) {
        return tuChoi(403, "ORIGIN_REJECTED", "Yêu cầu không đến từ trang Ninh Bình Journey.");
      }
      if (!(await conLuotApi(request.headers, nhom))) {
        return tuChoi(429, "RATE_LIMITED", "Bạn gửi nhiều lần quá. Mời bạn thử lại sau ít phút.");
      }
    }
    return updateSession(request);
  }

  // Tệp tĩnh (sw.js giữ CSP riêng trong next.config.ts, PDF, robots.txt) không cần nonce.
  if (/\.[a-z0-9]+$/i.test(duong)) return updateSession(request);

  // Mỗi lượt tải trang một nonce mới; Next đọc nó từ đầu trang CSP của yêu
  // cầu và tự gắn vào mọi thẻ script nó dựng.
  const nonce = btoa(crypto.randomUUID());
  const csp = dungCsp({
    nonce,
    dangPhatTrien: process.env.NODE_ENV === "development",
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL?.trim(),
    nangHttps: Boolean(process.env.VERCEL),
  });
  request.headers.set("x-nonce", nonce);
  request.headers.set("Content-Security-Policy", csp);
  const response = await updateSession(request);
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|mp4|webm|woff2?|ttf|webmanifest)$).*)",
  ],
};
