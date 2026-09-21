/**
 * Pha trăng thật cho một ngày.
 *
 * ## Vì sao cần tệp này
 *
 * Trang Trung thu từng vẽ "mặt trăng" bằng hai hình tròn tô màu be đặc, kèm
 * một dòng chữ `Ngo Dong / Moon orbit` để giải thích đó là gì. Một hình cần
 * chú thích mới hiểu là một hình đã hỏng — và tệ hơn, nó **không mang một
 * thông tin nào**: tròn y hệt nhau ở cả ba đêm của mùa.
 *
 * Mùa trăng là thứ duy nhất trên web này tự nó có dữ liệu. Trăng đêm 18.09
 * khác trăng đêm rằm, và khác trăng đêm khép mùa. Tính đúng ra rồi vẽ đúng
 * như thế thì hình ấy vừa đẹp vừa nói được một điều thật.
 *
 * ## Cách tính
 *
 * Lấy mốc một kỳ trăng mới đã biết rồi chia cho độ dài tuần trăng. Sai số của
 * phép này khoảng **vài giờ** — quá đủ để vẽ một hình tròn khuyết đúng chiều
 * và đúng độ đầy, và **không đủ** để in thành giờ mọc/lặn. Vì thế tệp này cố
 * ý **không** trả về giờ mọc, giờ lặn hay toạ độ: cái gì không tính chắc được
 * thì không nói.
 *
 * Mốc: kỳ sóc (trăng mới) ngày 06/01/2000 lúc 18:14 UTC — con số chuẩn vẫn
 * dùng trong thiên văn phổ thông.
 */

/** Trăng mới 06/01/2000 18:14 UTC, tính bằng mili giây. */
const SOC_MOC_MS = Date.UTC(2000, 0, 6, 18, 14, 0);

/** Độ dài trung bình một tuần trăng (ngày). */
export const TUAN_TRANG_NGAY = 29.530588853;

const MOT_NGAY_MS = 86_400_000;

export type TenPha =
  | "trang-moi"
  | "luoi-liem-dau"
  | "thuong-huyen"
  | "trang-khuyet-dau"
  | "trang-tron"
  | "vua-qua-ram"
  | "trang-khuyet-cuoi"
  | "ha-huyen"
  | "luoi-liem-cuoi";

export type PhaTrang = {
  /**
   * Vị trí trong tuần trăng, từ 0 tới 1.
   * 0 và 1 là trăng mới, 0,5 là trăng tròn.
   */
  pha: number;
  /** Phần đĩa trăng đang sáng, từ 0 (tối hẳn) tới 1 (tròn đầy). */
  doSang: number;
  /**
   * Trăng đang lên hay đang xuống.
   * Lên thì phần sáng nằm bên phải; xuống thì nằm bên trái.
   */
  dangLen: boolean;
  ten: TenPha;
  /** Ngày thứ mấy của tuần trăng, làm tròn — để nói "đêm 14" hay "đêm 16". */
  ngayTrang: number;
};

export const TEN_PHA_VI: Readonly<Record<TenPha, string>> = Object.freeze({
  "trang-moi": "trăng mới",
  "luoi-liem-dau": "lưỡi liềm đầu tháng",
  "thuong-huyen": "thượng huyền",
  "trang-khuyet-dau": "trăng khuyết đầu tháng",
  "trang-tron": "trăng tròn",
  "vua-qua-ram": "trăng vừa qua rằm",
  "trang-khuyet-cuoi": "trăng khuyết cuối tháng",
  "ha-huyen": "hạ huyền",
  "luoi-liem-cuoi": "lưỡi liềm cuối tháng",
});

export const TEN_PHA_EN: Readonly<Record<TenPha, string>> = Object.freeze({
  "trang-moi": "new moon",
  "luoi-liem-dau": "waxing crescent",
  "thuong-huyen": "first quarter",
  "trang-khuyet-dau": "waxing gibbous",
  "trang-tron": "full moon",
  "vua-qua-ram": "just past full",
  "trang-khuyet-cuoi": "waning gibbous",
  "ha-huyen": "last quarter",
  "luoi-liem-cuoi": "waning crescent",
});

/**
 * Gọi tên theo **độ sáng nhìn thấy**, không chỉ theo góc pha.
 *
 * Chính bài kiểm bắt ra chỗ này. Đêm rằm Trung thu 2026 là **25/09** theo âm
 * lịch — ngày 15 của tháng tám — nhưng trăng đầy nhất thật ra rơi vào
 * **26/09**. Rằm là một mốc của lịch, trăng tròn là một mốc của bầu trời, và
 * hai thứ lệch nhau được tới một ngày.
 *
 * Nếu gọi tên thuần theo góc pha thì đêm rằm, giữa trang Trung thu, mặt trăng
 * sáng 98,8% sẽ bị gọi là "trăng khuyết đầu tháng" — đúng về thiên văn và sai
 * với mọi người Việt đang ngẩng lên nhìn. Nên: sáng từ 98,5% trở lên thì gọi
 * là trăng tròn, tối dưới 1,5% thì gọi là trăng mới, còn lại mới xét góc pha.
 *
 * **Không đụng vào ngày tháng của trang.** "25.09 · rằm" là đúng, và nó ở lại.
 */
function tenTheoPha(pha: number, doSang: number): TenPha {
  // Gần đầy thì phải phân biệt HAI PHÍA của đỉnh, nếu không đêm 27.09 hiện ra
  // y hệt đêm rằm — cùng 99% sáng, vì chúng nằm gần đối xứng quanh đêm trăng
  // đầy nhất 26.09. Hai đêm ấy sáng bằng nhau là đúng; gọi tên giống nhau mới
  // là sai, và làm hỏng đúng cái thông tin vòng trăng sinh ra để nói.
  // "Trăng vừa qua rằm" là cách người Việt vẫn gọi đêm mười sáu, mười bảy.
  if (doSang >= 0.985) return pha < 0.5 ? "trang-tron" : "vua-qua-ram";
  if (doSang <= 0.015) return "trang-moi";
  // Hai kỳ huyền lấy dải rộng ±1,5 ngày quanh mốc. Dải hẹp hơn thì một đêm
  // sáng 43% bị gọi là "lưỡi liềm" — sai với mắt thường, vì lưỡi liềm trong
  // tiếng Việt là vầng trăng MỎNG, không phải gần nửa đĩa.
  if (pha < 0.2) return "luoi-liem-dau";
  if (pha < 0.3) return "thuong-huyen";
  if (pha < 0.5) return "trang-khuyet-dau";
  if (pha < 0.7) return "trang-khuyet-cuoi";
  if (pha < 0.8) return "ha-huyen";
  return "luoi-liem-cuoi";
}

/**
 * Tính pha trăng cho một thời điểm.
 *
 * Nhận `Date` chứ không nhận chuỗi ngày, để nơi gọi tự quyết định múi giờ.
 * Trang Trung thu truyền vào 21 giờ giờ Việt Nam — giờ người ta thật sự ngẩng
 * lên nhìn, chứ không phải 0 giờ.
 */
export function phaTrang(luc: Date): PhaTrang {
  const troiQua = (luc.getTime() - SOC_MOC_MS) / MOT_NGAY_MS;
  const trongKy = troiQua / TUAN_TRANG_NGAY;
  // `% 1` của một số âm vẫn âm, nên cộng 1 rồi lấy dư lần nữa.
  const pha = ((trongKy % 1) + 1) % 1;
  // Đĩa trăng sáng theo hình sin: tối hẳn ở 0, đầy ở 0,5.
  const doSang = (1 - Math.cos(2 * Math.PI * pha)) / 2;
  return {
    pha,
    doSang,
    dangLen: pha < 0.5,
    ten: tenTheoPha(pha, doSang),
    ngayTrang: Math.round(pha * TUAN_TRANG_NGAY),
  };
}

/**
 * Bề rộng của phần khuyết, để vẽ.
 *
 * Trả về một số từ -1 tới 1 dùng làm hệ số co ngang cho hình bóng đè lên đĩa
 * trăng. Dấu âm nghĩa là bóng cong về phía ngược lại — đó là cách một hình
 * lưỡi liềm và một hình khuyết gần đầy khác nhau, và cũng là chỗ hầu hết mặt
 * trăng vẽ tay bị sai.
 */
export function heSoBongTrang(pha: number): number {
  return Math.cos(2 * Math.PI * pha);
}
