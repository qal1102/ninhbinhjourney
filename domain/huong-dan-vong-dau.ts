import type { ErpSiteId } from "@/domain/erp";

/**
 * Vòng dẫn đầu tiên — "đi theo một đồng tiền".
 *
 * ## Vì sao là một câu chuyện, không phải một chuyến tham quan tính năng
 *
 * Dẫn người ta đi xem lần lượt mười lăm màn hình thì tới màn thứ tư đã quên
 * màn thứ nhất, vì giữa chúng không có sợi dây nào. Vòng này đi theo **một
 * đồng tiền**: khách trả ở cổng, nhân viên đếm cuối ca, quản lý duyệt, kế toán
 * ghi sổ, rồi tiền đi ra trả cho đối tác, và cuối cùng là khách nghĩ gì về nơi
 * mình. Đó chính là cái vòng tròn quy trình, và nó tự có thứ tự nên không phải
 * cố nhớ.
 *
 * ## Vì sao mỗi chặng phải gắn một con số thật
 *
 * "Đây là màn hình doanh thu" thì không ai buồn đọc. "Hôm nay Tràng An thu
 * 12,4 triệu — số này không ai gõ tay, nó cộng từ lượt quét ở cổng" thì vừa
 * dạy được cách hệ thống nghĩ, vừa đáng đọc. Vì thế mỗi chặng khai một `khoaSo`,
 * và trang gọi vòng dẫn có nhiệm vụ điền con số ấy từ dữ liệu đang có sẵn.
 *
 * Chặng nào chưa có số thật thì **nói thẳng là chưa có**, không bịa một con số
 * mẫu — một con số mẫu trong bài học đầu tiên sẽ dạy người dùng rằng các con
 * số ở đây không đáng tin.
 *
 * ## Không có đèn rọi, không khoá màn
 *
 * Mỗi chặng chỉ là một khối chữ ngắn cộng một đường dẫn mở màn thật. Không trỏ
 * vào toạ độ nút (vỡ ngay lần đổi bố cục), không chặn người dùng đi chỗ khác.
 */

export const VONG_TIEN_ID = "vong-tien";

/** Khoá của con số thật mà trang phải điền cho từng chặng. */
export type KhoaSo =
  | "ve-hom-nay"
  | "ca-trong-ky"
  | "ca-dang-cho-nguoi-khac"
  | "viec-cho-giam-doc"
  | "hoa-don-doi-tac"
  | "diem-khach-cham"
  | "khong-can";

export type Chang = {
  thuTu: number;
  ten: string;
  /** Một câu: chặng này nói về cái gì. */
  laGi: string;
  /** Một câu: con số ở chặng này từ đâu ra. Đây là phần dạy nghề. */
  soODau: string;
  khoaSo: KhoaSo;
  /** Nơi mở màn thật; `null` ở chặng kết vì nó không dẫn đi đâu nữa. */
  moMan: { nhan: string; duong: (siteId: ErpSiteId) => string } | null;
};

export const VONG_TIEN: readonly Chang[] = [
  {
    thuTu: 1,
    ten: "Khách trả tiền ở cổng",
    laGi: "Mỗi tấm vé bán ra hoặc quét vào đều rơi thẳng vào một con số duy nhất, tính theo ngày vận hành giờ Ninh Bình.",
    soODau:
      "Con số này không ai gõ tay. Máy cộng từ lượt quét ở cổng và vé bán tại quầy, nên chỉ sai khi có người quét sai.",
    khoaSo: "ve-hom-nay",
    moMan: { nhan: "Mở màn Vé & đặt chỗ", duong: (site) => `/erp/${site}/ve-dat-cho` },
  },
  {
    thuTu: 2,
    ten: "Hết ca, nhân viên đếm tiền",
    laGi: "Cuối ca, người trực nộp một hồ sơ gồm bốn con số: tổng thu, hoàn, tiền mặt, thẻ.",
    soODau:
      "Chênh lệch giữa tiền đếm được và tiền hệ thống ghi nhận do máy tự tính, không ai khai. Lệch quá 1.000 đồng là phải giải trình.",
    khoaSo: "ca-trong-ky",
    moMan: { nhan: "Xem các ca đã nộp", duong: (site) => `/erp/${site}/ve-dat-cho` },
  },
  {
    thuTu: 3,
    ten: "Hồ sơ đang nằm trên bàn ai",
    laGi: "Mỗi hồ sơ ca đi qua đúng bốn người: nhân viên nộp, quản lý duyệt, kế toán đối soát, kế toán trưởng ghi sổ.",
    soODau:
      "Dải mạch việc trên mỗi màn lấy thẳng từ trạng thái hồ sơ. Bước nào đang giữ bao nhiêu hồ sơ thì hiện đúng bấy nhiêu.",
    khoaSo: "ca-dang-cho-nguoi-khac",
    moMan: { nhan: "Xem mạch việc đóng ca", duong: (site) => `/erp/${site}/ve-dat-cho` },
  },
  {
    thuTu: 4,
    ten: "Việc tới tay anh",
    laGi: "Giám đốc không duyệt từng ca. Chỉ những ca lệch quá ngưỡng, kèm giải trình của kế toán, mới lên tới bàn anh.",
    soODau:
      "Hệ thống tự lọc: lệch dưới 1.000 đồng thì kế toán tự khép. Vì thế hàng việc của anh ngắn, và mỗi việc trong đó đều đã có người xác minh trước.",
    khoaSo: "viec-cho-giam-doc",
    moMan: null,
  },
  {
    thuTu: 5,
    ten: "Tiền đi ra",
    laGi: "Tiền chi ra cũng vậy: hoá đơn nhà cung cấp chỉ được trả khi khớp đủ ba thứ là đơn đặt hàng, biên bản nghiệm thu và hoá đơn.",
    soODau:
      "Lệch ở đâu, hệ thống chỉ đúng chỗ đó. Chưa khớp thì chưa chi được tiền.",
    khoaSo: "hoa-don-doi-tac",
    moMan: {
      nhan: "Mở màn Đối tác & nhà cung ứng",
      duong: (site) => `/erp/${site}/doi-tac-nha-cung-ung`,
    },
  },
  {
    thuTu: 6,
    ten: "Khách nghĩ gì về nơi mình",
    laGi: "Khách chỉ chấm sao được sau khi đã qua cổng, nên lời nhận xét nào cũng gắn với một lượt vào có thật.",
    soODau:
      "Bảng điểm chỉ kết luận khi một cơ sở đủ năm lời trở lên. Ẩn một lời phải ghi lý do, và không ai xoá hẳn được lời của khách.",
    khoaSo: "diem-khach-cham",
    moMan: { nhan: "Mở màn Khách hàng", duong: () => "/erp/khach-hang" },
  },
  {
    thuTu: 7,
    ten: "Từ mai, mỗi sáng anh xem ba ô này",
    laGi: "Việc đang chờ anh quyết, vé và doanh thu hôm qua, và nơi nào đang bị khách chấm điểm thấp.",
    soODau:
      "Cả ba đều nằm ngay trang chủ này. Các màn khác là chỗ nhân viên làm việc, anh chỉ cần mở khi muốn xem lại một hồ sơ nào đó.",
    khoaSo: "khong-can",
    moMan: null,
  },
];

export const VONG_TIEN_COPY = {
  ten: "Đi theo một đồng tiền",
  moiChao:
    "Lần đầu mở hệ thống, anh chưa cần biết hết mười lăm màn hình. Anh chỉ cần đi một vòng sáu phút, theo đường tiền của khách đi từ cổng vào tới sổ sách, là nắm được cả hệ thống.",
  moiChaoLai: "Xem lại vòng dẫn sáu phút: một đồng tiền của khách đi qua những đâu.",
  batDau: "Bắt đầu đi vòng",
  diLai: "Đi lại một vòng",
  tiep: "Chặng tiếp theo",
  lui: "Quay lại",
  boQua: "Để sau",
  xong: "Xong rồi, tôi hiểu",
  daXong:
    "Anh đã đi hết vòng này. Cần xem lại lúc nào cũng được, nó không mất đi đâu.",
  chuaCoSo: "chưa có số hôm nay",
} as const;

export function changTheoThuTu(thuTu: number): Chang | null {
  return VONG_TIEN.find((chang) => chang.thuTu === thuTu) ?? null;
}

/**
 * Chặng nên mở ra khi người dùng quay lại.
 *
 * Kẹp vào khoảng hợp lệ thay vì tin thẳng số từ kho: kho có thể mang số chặng
 * của một phiên bản vòng dẫn cũ dài hơn, và khi ấy thà mở chặng cuối còn hơn
 * hiện một màn trống.
 */
export function changMoLai(changDaLuu: number): number {
  if (!Number.isFinite(changDaLuu)) return 1;
  const tron = Math.round(changDaLuu);
  if (tron < 1) return 1;
  return Math.min(tron, VONG_TIEN.length);
}

export function laChangCuoi(thuTu: number): boolean {
  return thuTu >= VONG_TIEN.length;
}

/** Bao nhiêu phần trăm đã đi, để vẽ thanh tiến độ. */
export function phanTramDaDi(thuTu: number): number {
  const trong = changMoLai(thuTu);
  return Math.round((trong / VONG_TIEN.length) * 100);
}

export type TienDoVongDan = {
  changHienTai: number;
  daXong: boolean;
  boQua: boolean;
  tungDi: boolean;
};

export function tienDoFrom(value: unknown): TienDoVongDan {
  const hang = (value ?? {}) as Record<string, unknown>;
  const so = Number(hang.chang_hien_tai);
  return {
    changHienTai: changMoLai(Number.isFinite(so) ? so : 1),
    daXong: hang.da_xong === true,
    boQua: hang.bo_qua === true,
    tungDi: hang.tung_di === true,
  };
}

/**
 * Có nên tự mở vòng dẫn ra không.
 *
 * Chỉ tự mở đúng một lần, cho người **chưa từng đi**. Đã đi rồi, đã đi hết,
 * hay đã bấm "để sau" thì vòng dẫn thu về một dòng mời — tự bung ra mỗi lần
 * đăng nhập là thứ khiến người ta ghét phần mềm.
 */
export function nenTuMo(tienDo: TienDoVongDan): boolean {
  return !tienDo.tungDi && !tienDo.daXong && !tienDo.boQua;
}
