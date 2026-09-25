import type { ErpRole, ErpSiteId } from "@/domain/erp";

/**
 * Vòng dẫn đầu tiên: trình diễn một vị khách đi trọn một vòng.
 *
 * ## Vì sao viết lại (26/09/2026)
 *
 * Bản trước "đi theo một đồng tiền" qua sổ sách: nộp ca, bốn người duyệt,
 * khớp ba chứng từ. Chủ dự án dùng thử và nói thẳng: *"cảm giác không hiểu gì
 * hết"*. Đúng thôi: đó là chuyện của kế toán, toàn chữ, và không chặng nào bảo
 * người đọc phải bấm vào đâu. Ba chặng liền còn mở cùng một màn.
 *
 * Chủ dự án dùng hệ thống để TRÌNH DIỄN cho khách hàng. Nên vòng dẫn nay là
 * một kịch bản làm theo được: một vị khách đặt vé trên điện thoại, quét QR trả
 * tiền, nhân viên quét cổng, hộ chiếu sáng lên. Mỗi chặng có đúng hai phần:
 * **bấm vào đâu** và **để ý thấy gì**, cộng một nút đưa thẳng tới chỗ ấy (kể
 * cả chuyển vai khi việc đó là của nhân viên).
 *
 * ## Không có đèn rọi, không khoá màn
 *
 * Mỗi chặng chỉ là một khối chữ ngắn cộng một nút mở màn thật. Không trỏ vào
 * toạ độ nút (vỡ ngay lần đổi bố cục), không chặn người dùng đi chỗ khác.
 */

export const VONG_TIEN_ID = "vong-tien";

/** Khoá của con số thật mà trang có thể điền cho từng chặng. */
export type KhoaSo =
  | "ve-hom-nay"
  | "ca-trong-ky"
  | "ca-dang-cho-nguoi-khac"
  | "viec-cho-giam-doc"
  | "hoa-don-doi-tac"
  | "diem-khach-cham"
  | "khong-can";

export type MoMan = {
  nhan: string;
  duong: (siteId: ErpSiteId) => string;
  /** Trang của khách: mở ở thẻ mới để ERP vẫn nằm nguyên chỗ cũ. */
  theMoi?: boolean;
  /** Việc của vai khác: nút chuyển sang đúng vai rồi đưa tới màn này. */
  vai?: ErpRole;
};

export type Chang = {
  thuTu: number;
  ten: string;
  /** Bấm vào đâu, làm gì. Viết như người đứng cạnh chỉ tay. */
  lamGi: string;
  /** Làm xong thì để ý thấy gì, và vì sao điều đó đáng nói với khách hàng. */
  deY: string;
  khoaSo: KhoaSo;
  /** Nút mở màn thật; `null` ở chặng kết vì nó không dẫn đi đâu nữa. */
  moMan: MoMan | null;
};

export const VONG_TIEN: readonly Chang[] = [
  {
    thuTu: 1,
    ten: "Khách đặt vé trên điện thoại",
    lamGi:
      "Bấm nút bên dưới, trang đặt chỗ mở ở thẻ mới. Chọn một gói, chọn giờ, bấm \"Giữ chỗ 15 phút\", gõ một số điện thoại rồi bấm \"Lấy mã QR thanh toán\".",
    deY: "Chỗ được giữ thật trong 15 phút, có đồng hồ đếm ngược. Quá giờ không trả thì chỗ tự nhả cho khách khác.",
    khoaSo: "khong-can",
    moMan: { nhan: "Mở trang đặt chỗ", duong: () => "/packages", theMoi: true },
  },
  {
    thuTu: 2,
    ten: "Quét mã QR để trả tiền",
    lamGi:
      "Giơ điện thoại quét mã QR trên màn hình (camera hoặc Zalo đều được), rồi bấm \"Xác nhận chuyển khoản\". Đang đặt bằng điện thoại thì bấm \"Thanh toán ngay\".",
    deY: "Màn hình đặt chỗ tự chuyển sang vé, không phải bấm gì thêm. Khách bấm \"Lưu ảnh vé về máy\" là có vé trong thư viện ảnh. Tiền ở đây là giả lập, không ai mất đồng nào.",
    khoaSo: "khong-can",
    moMan: null,
  },
  {
    thuTu: 3,
    ten: "Đơn vừa đặt hiện trong ERP",
    lamGi: "Quay lại thẻ ERP này, bấm nút bên dưới để mở màn Khách hàng, tìm đơn trên cùng.",
    deY: "Dòng đơn ghi \"Đã thanh toán bằng QR\" cùng mã vé. Không ai phải gõ lại gì: khách đặt xong là đơn nằm đây.",
    khoaSo: "khong-can",
    moMan: { nhan: "Mở màn Khách hàng", duong: () => "/erp/khach-hang" },
  },
  {
    thuTu: 4,
    ten: "Nhân viên quét vé ở cổng",
    lamGi:
      "Bấm \"Làm thử như Nhân viên\": anh thành nhân viên cổng Tràng An. Gõ mã vé WEB-… vừa nhận vào ô quét (hoặc bấm \"Quét bằng camera\" rồi quét ảnh vé), bấm \"Xác thực & ghi nhận\".",
    deY: "Máy báo \"Vé hợp lệ · Đã thanh toán bằng QR\". Quét lần hai thì máy báo đã ghi trước đó, không cho vào thêm. Xong bấm \"Quay lại giám đốc\" trên dải nâu.",
    khoaSo: "khong-can",
    moMan: { nhan: "Mở màn quét vé", duong: (site) => `/erp/${site}/check-in-khach`, vai: "employee" },
  },
  {
    thuTu: 5,
    ten: "Hộ chiếu của khách sáng lên",
    lamGi: "Mở màn Khách hàng, kéo xuống khối \"Khách thấy gì\".",
    deY: "Khung điện thoại hiện đúng thứ khách thấy: Tràng An đã sáng, nhiệm vụ \"Bước chân đầu tiên\" xong và có mã quà. Đi đủ các vùng thì mở thêm quà, lý do để khách quay lại.",
    khoaSo: "khong-can",
    moMan: { nhan: "Xem Khách thấy gì", duong: () => "/erp/khach-hang#khach-thay-gi" },
  },
  {
    thuTu: 6,
    ten: "Bán vé tại quầy, cuối ca đếm tiền",
    lamGi:
      "Bấm \"Làm thử như Nhân viên\" để đứng ở quầy vé Tràng An. Chọn 1 vé, gõ tiền khách đưa, tick ô đã đếm tiền rồi bấm bán. Phiếu bán ghi thật vào sổ, nên chỉ bán thử 1 vé.",
    deY: "Tiền quầy tự cộng vào bảng đối soát cuối ca. Người bán không tự huỷ được phiếu của mình, chỉ quản lý mới huỷ, và phải ghi lý do.",
    khoaSo: "ve-hom-nay",
    moMan: { nhan: "Mở quầy vé", duong: (site) => `/erp/${site}/ve-dat-cho`, vai: "employee" },
  },
  {
    thuTu: 7,
    ten: "Mỗi sáng giám đốc chỉ cần xem trang này",
    lamGi: "Quay về trang đầu. Ô trên cùng là việc đang chờ anh quyết; dưới nữa là vé, doanh thu và điểm khách chấm.",
    deY: "Muốn trình diễn việc của vai nào khác, mở \"Bản đồ mọi chức năng\" ngay trên đầu trang: mỗi việc một nút \"Làm thử\".",
    khoaSo: "viec-cho-giam-doc",
    moMan: null,
  },
];

export const VONG_TIEN_COPY = {
  ten: "Trình diễn một vòng khách",
  moiChao:
    "Bảy bước, chừng mười phút: một vị khách đặt vé trên điện thoại, quét QR trả tiền, qua cổng, và hộ chiếu của họ sáng lên. Làm theo từng bước là trình diễn được cho khách hàng.",
  moiChaoLai: "Làm lại bảy bước trình diễn: từ lúc khách đặt vé tới lúc hộ chiếu sáng lên.",
  batDau: "Bắt đầu",
  diLai: "Làm lại từ đầu",
  tiep: "Bước tiếp theo",
  lui: "Quay lại",
  boQua: "Để sau",
  xong: "Xong rồi",
  daXong:
    "Anh đã đi hết bảy bước. Cần trình diễn lại lúc nào cũng được.",
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
 * Mở khi đang đi dở: kịch bản trình diễn bắt người dùng rời trang (sang trang
 * khách, chuyển vai) rồi quay về, và lúc quay về phải thấy ngay bước kế tiếp.
 * Đã đi hết, hay đã bấm "Để sau", thì thu về một dòng mời: tự bung ra mãi là
 * thứ khiến người ta ghét phần mềm.
 */
export function nenTuMo(tienDo: TienDoVongDan): boolean {
  return !tienDo.daXong && !tienDo.boQua;
}
