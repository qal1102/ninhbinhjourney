import { COOKIE_DAI_LY, NGAY_NHO_DAI_LY } from "@/domain/dai-ly";
import { daiLyConHopTac } from "@/lib/dai-ly-repository";

/**
 * Đường dẫn giới thiệu của đại lý: `/dl/HONGHA`. Đại lý còn hợp tác thì trình
 * duyệt nhớ mã 30 ngày (cookie chức năng, chỉ để ghi đơn cho đúng người giới
 * thiệu, không theo dõi hành vi), rồi đưa khách tới trang Gói.
 */
export async function GET(request: Request, { params }: { params: Promise<{ ma: string }> }) {
  const ma = (await params).ma.toUpperCase();
  const headers = new Headers({
    Location: new URL("/packages", request.url).toString(),
    "Cache-Control": "no-store",
  });
  if (await daiLyConHopTac(ma)) {
    headers.append(
      "Set-Cookie",
      `${COOKIE_DAI_LY}=${ma}; Path=/; Max-Age=${NGAY_NHO_DAI_LY * 86_400}; SameSite=Lax; HttpOnly${process.env.NODE_ENV === "production" ? "; Secure" : ""}`,
    );
  }
  return new Response(null, { status: 302, headers });
}
