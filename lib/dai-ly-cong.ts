import "server-only";

import QRCode from "qrcode";
import { congThang, thangHienTai } from "@/domain/dai-ly";
import { docBangDaiLy, docDonCuaDaiLy } from "@/lib/dai-ly-repository";
import { absoluteUrl } from "@/lib/site-url";

/** Dữ liệu cho `DaiLyCong`: tháng này, tháng trước, đơn gần đây, đường dẫn và mã QR. */
export async function dungCongDaiLy(daiLyId: string) {
  const thang = thangHienTai();
  const truoc = congThang(thang, -1);
  const [nay, cu, don] = await Promise.all([docBangDaiLy(thang), docBangDaiLy(truoc), docDonCuaDaiLy(daiLyId, 20)]);
  const dongNay = nay.trangThai === "co" ? nay.dong.find((d) => d.id === daiLyId) : undefined;
  if (!dongNay) return null;
  const dongCu = cu.trangThai === "co" ? cu.dong.find((d) => d.id === daiLyId) : undefined;
  const duongGioiThieu = absoluteUrl(`/dl/${dongNay.ma}`);
  const maQrSvg = await QRCode.toString(duongGioiThieu, { type: "svg", margin: 1, color: { dark: "#183f34", light: "#ffffff" } }).catch(
    () => null,
  );
  return {
    thangNay: { thang, dong: dongNay },
    thangTruoc: dongCu ? { thang: truoc, dong: dongCu } : null,
    don,
    duongGioiThieu,
    maQrSvg,
  };
}
