import { createHash } from "node:crypto";

/**
 * Chặn gọi dồn theo IP cho các ô công khai nhận số điện thoại (đăng ký sự
 * kiện, gửi ảnh dự thi). Bộ đếm nằm trong bộ nhớ của từng máy chủ, chỉ là
 * hàng rào mỏng chống dò số hay gửi rác hàng loạt, không phải bảo mật.
 */
const DEM = new Map<string, number[]>();

export function conLuot(request: Request, nhom: string, toiDa: number, khungMs: number, bayGio = Date.now()): boolean {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "khong-ro";
  const khoa = createHash("sha256").update(`${nhom}:${ip}`).digest("hex").slice(0, 24);
  const cu = (DEM.get(khoa) ?? []).filter((t) => bayGio - t < khungMs);
  if (cu.length >= toiDa) {
    DEM.set(khoa, cu);
    return false;
  }
  cu.push(bayGio);
  DEM.set(khoa, cu);
  if (DEM.size > 5_000) DEM.delete(DEM.keys().next().value as string);
  return true;
}
