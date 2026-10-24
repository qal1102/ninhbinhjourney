/**
 * Trình duyệt báo về khi CSP (`proxy.ts`) chặn một thứ gì. Chỉ ghi một dòng
 * gọn vào log máy chủ để thấy CSP có chặn nhầm thứ trang cần không; không
 * lưu kho, không trả nội dung. `proxy.ts` đã giới hạn lượt gọi.
 */

const TOI_DA_BYTE = 8 * 1024;

function cat(giaTri: unknown, dai = 200): string {
  return typeof giaTri === "string" ? giaTri.slice(0, dai) : "";
}

export async function POST(request: Request) {
  if (Number(request.headers.get("content-length") ?? "0") > TOI_DA_BYTE) {
    return new Response(null, { status: 413 });
  }
  const chu = (await request.text().catch(() => "")).slice(0, TOI_DA_BYTE);
  try {
    const goc = JSON.parse(chu) as Record<string, unknown> | Array<Record<string, unknown>>;
    // `application/csp-report` gói trong "csp-report"; Reporting API gửi mảng có "body".
    const bao = (Array.isArray(goc) ? goc[0]?.body : goc["csp-report"]) as Record<string, unknown> | undefined;
    if (bao) {
      console.warn(
        "[csp] chặn",
        cat(bao["effective-directive"] ?? bao.effectiveDirective ?? bao["violated-directive"], 60),
        cat(bao["blocked-uri"] ?? bao.blockedURL),
        "trên",
        cat(bao["document-uri"] ?? bao.documentURL),
      );
    }
  } catch {
    // Báo cáo hỏng thì bỏ qua.
  }
  return new Response(null, { status: 204 });
}
