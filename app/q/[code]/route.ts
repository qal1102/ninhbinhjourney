import { NextResponse } from "next/server";
import { MarketingCodeSchema, destinationPathWithAttribution } from "@/domain/marketing-qr";
import {
  isMarketingQrRoutingEnabled,
  MarketingQrRepositoryError,
  resolveMarketingQrRedirect,
} from "@/lib/customer-data/marketing-qr-repository";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  ctx: { params: Promise<{ code: string }> },
) {
  if (!isMarketingQrRoutingEnabled()) {
    return Response.json(
      { error: { code: "MARKETING_QR_ROUTING_DISABLED", message: "QR động chưa được bật ở môi trường này." } },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const { code } = await ctx.params;
    const resolved = await resolveMarketingQrRedirect(MarketingCodeSchema.parse(code));
    const destination = destinationPathWithAttribution(resolved, new URL(request.url).origin);
    return NextResponse.redirect(destination, { status: 307, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof MarketingQrRepositoryError) {
      const status =
        error.code === "NOT_ACTIVE"
          ? 410
          : error.code === "NOT_FOUND" || error.code === "INPUT_INVALID"
            ? 404
            : 503;
      return Response.json(
        {
          error: {
            code:
              error.code === "NOT_ACTIVE"
                ? "MARKETING_QR_NOT_ACTIVE"
                : error.code === "NOT_FOUND" || error.code === "INPUT_INVALID"
                  ? "MARKETING_QR_NOT_FOUND"
                  : "MARKETING_QR_UNAVAILABLE",
            message: error.message,
          },
        },
        { status, headers: { "Cache-Control": "no-store" } },
      );
    }
    return Response.json(
      { error: { code: "MARKETING_QR_INVALID", message: "Mã QR không hợp lệ." } },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }
}
