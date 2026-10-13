import { chuanHoaMaMoi, COOKIE_MA_MOI, NGAY_NHO_MA_MOI } from "@/domain/ma-moi";
import { maMoiCoThat } from "@/lib/customer-data/booking-repository";

/**
 * Đường dẫn bạn bè gửi nhau: `/moi/MOI-AB12CD`. Mã có thật thì trình duyệt
 * nhớ 30 ngày để trang thanh toán điền sẵn ô "Mã mời" (cookie chức năng,
 * không theo dõi hành vi), rồi đưa khách tới trang Mua vé.
 */
export async function GET(request: Request, { params }: { params: Promise<{ ma: string }> }) {
  const ma = chuanHoaMaMoi((await params).ma);
  const coThat = ma ? await maMoiCoThat(ma) : false;
  const dich = new URL("/packages", request.url);
  dich.searchParams.set("moi", coThat ? "co" : "sai");
  dich.hash = "ve";
  const headers = new Headers({ Location: dich.toString(), "Cache-Control": "no-store" });
  if (ma && coThat) {
    headers.append(
      "Set-Cookie",
      `${COOKIE_MA_MOI}=${ma}; Path=/; Max-Age=${NGAY_NHO_MA_MOI * 86_400}; SameSite=Lax; HttpOnly${process.env.NODE_ENV === "production" ? "; Secure" : ""}`,
    );
  }
  return new Response(null, { status: 302, headers });
}
