/**
 * Vệt trăng trên mặt nước.
 *
 * ## Vì sao tính chứ không vẽ đại
 *
 * Trang Trung thu đã có mặt trăng tính đúng pha (`domain/lunar-phase.ts`).
 * Đặt thêm một vệt sáng trên sông mà vệt ấy lúc nào cũng như nhau thì lại
 * đúng cái bệnh của bản mặt trăng cũ: một hình đẹp không nói điều gì.
 *
 * Ngoài đời, **đêm trăng khuyết cho vệt hẹp và mờ, đêm rằm cho vệt rộng và
 * sáng**. Ai đã từng ngồi bên sông đều thấy điều đó, nên nếu web vẽ ngược thì
 * người xem cảm được ngay mà không gọi tên được — và cảm giác "sai sai" ấy
 * chính là thứ làm một trang trông rẻ tiền.
 *
 * ## Không nói quá điều mình biết
 *
 * Đây **không** phải mô phỏng quang học. Độ rộng và độ sáng ở đây là hai
 * đường cong đơn giản đi qua đúng ba mốc mà mắt thường phân biệt được: trăng
 * mới thì gần như không có vệt, thượng huyền có vệt vừa, rằm có vệt rõ. Đủ để
 * vẽ cho đúng cảm giác, và cố ý không trả về thứ gì giống như số đo thật.
 */

export type VetTrang = {
  /** Bề rộng vệt sáng, tính bằng pixel. */
  beRong: number;
  /** Độ đậm ở tâm vệt, từ 0 tới 1. */
  doDam: number;
  /** Số gợn sáng vẽ dọc mặt nước. */
  soGon: number;
};

function kep(gia: number, min: number, max: number) {
  return Math.min(max, Math.max(min, gia));
}

/**
 * @param doSang Phần đĩa trăng đang sáng, từ 0 tới 1 (`phaTrang().doSang`).
 * @param beRongKhung Bề rộng khung nước, tính bằng pixel.
 */
export function vetTrangTrenNuoc(doSang: number, beRongKhung: number): VetTrang {
  const s = kep(doSang, 0, 1);
  // Căn bậc hai: phần đầu của tuần trăng vệt nở nhanh, về sau nở chậm lại —
  // giống mắt thường thấy hơn là một đường thẳng.
  const nangLuong = Math.sqrt(s);
  return {
    beRong: Math.round(beRongKhung * (0.06 + 0.34 * nangLuong)),
    doDam: Number((0.05 + 0.62 * nangLuong).toFixed(3)),
    // Trăng càng đầy thì mặt nước càng nhiều gợn bắt được ánh sáng.
    //
    // Con số này từng là 10–36 và cho ra một thứ trông như **mã vạch**: gợn
    // quá ít, quá dài, quá đều nên mắt đọc ra mấy cái gạch chứ không đọc ra
    // sóng. Nước cần rất nhiều nét ngắn chồng lên nhau mới thành nước.
    soGon: Math.round(90 + 190 * nangLuong),
  };
}
