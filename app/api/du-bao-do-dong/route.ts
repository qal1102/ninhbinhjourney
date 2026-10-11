import type { ErpSiteId } from "@/domain/erp";
import { duBaoDoDongNgay, ngayVietNam } from "@/lib/hom-nay-repository";

const CO_SO: readonly ErpSiteId[] = ["trang-an", "tam-coc", "bai-dinh", "tam-chuc"];

// H1 — chỉ đọc: độ đông thường gặp theo giờ cho một ngày đi, từ lượt qua cổng
// thật tám tuần trước. Không cookie, không ghi; số thay chậm nên để đệm 30 phút.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const site = url.searchParams.get("site") as ErpSiteId | null;
  const ngay = url.searchParams.get("ngay") ?? "";
  const homNay = ngayVietNam();
  const toiDa = new Date(Date.parse(`${homNay}T00:00:00Z`) + 60 * 86_400_000).toISOString().slice(0, 10);
  if (!site || !CO_SO.includes(site) || !/^\d{4}-\d{2}-\d{2}$/.test(ngay) || ngay < homNay || ngay > toiDa) {
    return Response.json({ accepted: false }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
  const ketQua = await duBaoDoDongNgay(site, ngay).catch(() => ({ trangThai: "chua-noi" as const }));
  return Response.json(
    { accepted: true, ...ketQua },
    { headers: { "Cache-Control": ketQua.trangThai === "co" ? "public, s-maxage=1800, stale-while-revalidate=3600" : "no-store" } },
  );
}
