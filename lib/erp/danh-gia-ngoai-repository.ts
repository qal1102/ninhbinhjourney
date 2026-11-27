import { DUONG_DAN_DU_LIEU_MAC_DINH, docDuLieuDanhGia, type DuLieuDanhGiaNgoai } from "@/domain/danh-gia-ngoai";

export type KetQuaDocDanhGia =
  | { trangThai: "co"; duLieu: DuLieuDanhGiaNgoai }
  | { trangThai: "chua-co" }
  | { trangThai: "loi" };

/**
 * Đọc tệp đánh giá ngoài trên nhánh dữ liệu. Giữ bản đọc 10 phút: dữ liệu
 * chỉ đổi hai lần mỗi ngày, không cần gọi lại mỗi lượt mở màn hình.
 * 404 nghĩa là lịch lấy chưa chạy lần nào (chưa có nhánh), khác với lỗi mạng.
 */
export async function docDanhGiaNgoai(): Promise<KetQuaDocDanhGia> {
  const url = process.env.DANH_GIA_NGOAI_URL || DUONG_DAN_DU_LIEU_MAC_DINH;
  try {
    const res = await fetch(url, { next: { revalidate: 600 }, signal: AbortSignal.timeout(8000) });
    if (res.status === 404) return { trangThai: "chua-co" };
    if (!res.ok) return { trangThai: "loi" };
    const duLieu = docDuLieuDanhGia(await res.json());
    return duLieu ? { trangThai: "co", duLieu } : { trangThai: "loi" };
  } catch (error) {
    console.error("Đọc đánh giá ngoài thất bại", error);
    return { trangThai: "loi" };
  }
}
