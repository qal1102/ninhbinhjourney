/**
 * Vòng dẫn "Trình diễn một vòng khách".
 *
 * ## Vì sao viết lại (26/09 rồi 28/09/2026)
 *
 * Bản đầu "đi theo một đồng tiền" qua sổ sách: chủ dự án dùng thử và nói *"cảm
 * giác không hiểu gì hết"*. Bản 26/09 đổi sang một vị khách đi trọn vòng, nhưng
 * chủ dự án vẫn thấy khó hiểu, và soát tay ngày 28/09 chỉ ra vì sao:
 *
 * 1. Lời dẫn chỉ nằm trên trang đầu. Bấm sang màn khác là lời dẫn biến mất,
 *    người dùng phải nhớ đường quay về mới đọc được bước tiếp. Nay vòng dẫn
 *    nằm trong khung ERP nên theo người dùng sang mọi màn.
 * 2. Mỗi bước là một đoạn văn gộp năm sáu việc. Nay mỗi việc một dòng đánh số.
 * 3. Bước quét cổng bắt gõ tay mã vé mười sáu ký tự, giữa hàng chục vé `WEB-`
 *    khác trong danh sách. Nay mã vé ở màn Khách hàng bấm được, mở màn soát vé
 *    với mã điền sẵn.
 * 4. Hai lần chuyển vai. Giám đốc làm được mọi việc trong vòng này, nên bỏ.
 * 5. Vé web mặc định cho ngày mai nên quét cổng hôm nay bị từ chối. Nay nút ở
 *    bước 1 mở sẵn đúng gói, ngày đi là hôm nay.
 *
 * ## Không có đèn rọi, không khoá màn
 *
 * Mỗi bước là một khối chữ cộng một nút mở màn thật. Không trỏ vào toạ độ nút
 * (vỡ ngay lần đổi bố cục), không chặn người dùng đi chỗ khác.
 */

/** Đổi về `false` là ẩn toàn bộ vòng dẫn, tiến độ trong kho giữ nguyên. */
export const HIEN_VONG_DAN = true;

/**
 * Mã vòng dẫn trong kho tiến độ. Đổi từ "vong-tien" sang mã này khi viết lại
 * kịch bản 28/09/2026: tiến độ cũ (giám đốc đang dừng ở bước 2 của bản trước)
 * mở ra giữa chừng một kịch bản khác hẳn. Mã mới thì ai cũng bắt đầu từ bước 1.
 * Viết lại kịch bản lần nữa thì đổi mã lần nữa.
 */
export const VONG_TIEN_ID = "vong-khach-2809";

type MoMan = {
  nhan: string;
  duong: string;
  /** Trang của khách: mở ở thẻ mới để ERP vẫn nằm nguyên chỗ cũ. */
  theMoi?: boolean;
};

export type Chang = {
  thuTu: number;
  ten: string;
  /** Đang đứng ở đâu khi làm bước này — câu đầu tiên người dùng đọc. */
  oDau: string;
  /** Mỗi dòng đúng một việc, viết như người đứng cạnh chỉ tay. */
  cacViec: readonly string[];
  /** Làm xong thì thấy gì, và vì sao điều đó đáng nói với khách hàng. */
  seThay: string;
  /** Nút mở màn thật; `null` khi bước này làm ngay ở màn đang đứng. */
  moMan: MoMan | null;
};

export const VONG_TIEN: readonly Chang[] = [
  {
    thuTu: 1,
    ten: "Khách đặt vé",
    oDau: "Trang đặt vé của khách, mở ở thẻ mới.",
    cacViec: [
      "Bấm nút \"Mở trang đặt vé\" bên dưới. Trang mở sẵn gói \"Gia đình khám phá\", ngày đi là hôm nay.",
      "Bấm một khung giờ còn sáng. Khung đã qua giờ bị mờ, không bấm được.",
      "Bấm \"Giữ chỗ 15 phút\".",
      "Gõ một số điện thoại bất kỳ, ví dụ 0912345678, rồi bấm \"Lấy mã QR thanh toán\".",
    ],
    seThay:
      "Mã QR thanh toán và đồng hồ đếm ngược 15 phút: chỗ đã được giữ thật, quá giờ không trả thì tự nhả cho khách khác. Nếu hôm nay mọi khung đều mờ, đổi ngày đi sang ngày mai rồi làm tiếp; riêng bước 4, máy sẽ báo \"Vé không dùng cho hôm nay\".",
    moMan: {
      nhan: "Mở trang đặt vé",
      duong: "/checkout?package=family-discovery&ngay=hom-nay",
      theMoi: true,
    },
  },
  {
    thuTu: 2,
    ten: "Khách trả tiền bằng mã QR",
    oDau: "Vẫn ở thẻ đặt vé vừa mở.",
    cacViec: [
      "Mở camera điện thoại (hoặc Zalo), quét mã QR trên màn hình, rồi bấm \"Xác nhận chuyển khoản\" trên điện thoại.",
      "Không có điện thoại bên cạnh thì bấm dòng \"Mở trang thanh toán trên máy này\" ngay dưới mã QR, rồi bấm \"Xác nhận chuyển khoản\".",
    ],
    seThay:
      "Thẻ đặt vé tự chuyển sang tấm vé có mã WEB-…, không phải bấm gì thêm. Tiền ở đây là giả lập, không ai mất đồng nào.",
    moMan: null,
  },
  {
    thuTu: 3,
    ten: "Đơn vừa đặt nằm trong ERP",
    oDau: "Quay lại thẻ ERP này.",
    cacViec: [
      "Bấm nút \"Mở màn Khách hàng\" bên dưới.",
      "Tìm khối \"Đơn, tiền và vé của từng khách\": đơn đầu tiên là đơn bạn vừa đặt.",
    ],
    seThay:
      "Đơn ghi \"Đã thanh toán bằng QR\" cùng hai mã vé, một cho Tràng An, một cho Bái Đính. Khách đặt xong là đơn nằm đây, không ai phải nhập lại.",
    moMan: { nhan: "Mở màn Khách hàng", duong: "/erp/khach-hang" },
  },
  {
    thuTu: 4,
    ten: "Khách qua cổng Tràng An",
    oDau: "Màn Khách hàng, ở đơn đầu tiên.",
    cacViec: [
      "Bấm vào mã vé có chữ \"→ quét\" của Tràng An. Màn soát vé Tràng An mở ra, mã đã điền sẵn.",
      "Bấm \"Xác thực & ghi nhận\".",
    ],
    seThay:
      "Máy báo \"Vé hợp lệ · Đã thanh toán bằng QR\" kèm số lượt đã dùng. Vé cho mấy người thì quét được mấy lượt; quét quá số ấy, máy báo \"Vé đã dùng hết lượt\".",
    moMan: null,
  },
  {
    thuTu: 5,
    ten: "Hộ chiếu của khách sáng lên",
    oDau: "Màn Khách hàng, khối \"Khách thấy gì\".",
    cacViec: [
      "Bấm nút \"Xem Khách thấy gì\" bên dưới.",
      "Nhìn khung điện thoại: đó đúng là thứ vị khách vừa đặt vé đang thấy.",
    ],
    seThay:
      "Tràng An đã sáng trên tấm hộ chiếu, nhiệm vụ \"Bước chân đầu tiên\" xong và có mã quà. Đi đủ các vùng thì mở thêm quà: lý do để khách quay lại.",
    moMan: { nhan: "Xem Khách thấy gì", duong: "/erp/khach-hang#khach-thay-gi" },
  },
  {
    thuTu: 6,
    ten: "Bán một vé tại quầy",
    oDau: "Màn Vé & đặt chỗ của Tràng An.",
    cacViec: [
      "Bấm nút \"Mở quầy vé Tràng An\" bên dưới.",
      "Ở khối \"Ra đơn, thu tiền, đưa vé cho khách\", giữ nguyên 1 người lớn, bấm \"Đủ tiền\".",
      "Tích ô \"Tôi đã đếm đủ…\", rồi bấm \"Xác nhận bán\".",
    ],
    seThay:
      "Phiếu thu hiện ra, in được ngay; tiền quầy tự cộng vào đối soát cuối ca. Phiếu ghi thật vào sổ nên chỉ bán thử 1 vé. Người bán không tự huỷ được phiếu: chỉ quản lý hoặc giám đốc huỷ, và phải ghi lý do.",
    moMan: { nhan: "Mở quầy vé Tràng An", duong: "/erp/trang-an/ve-dat-cho" },
  },
  {
    thuTu: 7,
    ten: "Khách đến từ đâu",
    oDau: "Màn Kênh khách.",
    cacViec: [
      "Bấm nút \"Mở màn Kênh khách\" bên dưới.",
      "Chọn \"7 ngày gần nhất\".",
      "Đọc dải năm ô từ \"Quét mã QR\" tới \"Qua cổng\", rồi bảng \"Khách đến từ đâu\" ngay dưới.",
    ],
    seThay:
      "Lượt giữ chỗ, thanh toán và qua cổng bạn vừa làm đã nằm trong phễu. Mỗi ô ghi rõ đếm từ đâu; khách chưa rõ nguồn để riêng một ô, không chia bừa vào chiến dịch nào.",
    moMan: { nhan: "Mở màn Kênh khách", duong: "/erp/marketing" },
  },
  {
    thuTu: 8,
    ten: "Mỗi sáng chỉ cần xem trang đầu",
    oDau: "Trang đầu giám đốc.",
    cacViec: [
      "Bấm nút \"Về trang đầu\" bên dưới.",
      "Đọc bốn ô lớn: khách hôm nay, tiền thu hôm nay (quầy và web), công việc hiện trường, bút toán.",
      "Kéo xuống khối \"Cần giám đốc quyết định\": mọi việc đang chờ bạn nằm ở đó.",
    ],
    seThay:
      "Vé quầy và đơn web vừa làm đã cộng vào ô tiền hôm nay. Muốn thử việc của vai khác, kéo xuống cuối trang mở \"Bản đồ mọi chức năng\": mỗi việc một nút \"Làm thử\".",
    moMan: { nhan: "Về trang đầu", duong: "/erp" },
  },
];

export const VONG_TIEN_COPY = {
  ten: "Trình diễn một vòng khách",
  moiChaoLai: "Tám bước, chừng mười lăm phút: một vị khách đặt vé, trả tiền bằng QR, qua cổng, rồi hiện trên phễu và trang đầu.",
  batDau: "Bắt đầu",
  diLai: "Làm lại từ đầu",
  tiep: "Xong, sang bước tiếp",
  lui: "Quay lại",
  boQua: "Để sau",
  xong: "Xong rồi",
  thuGon: "Thu gọn",
  moRong: "Xem hướng dẫn",
  daXong:
    "Bạn đã đi hết tám bước. Cần trình diễn lại lúc nào cũng được.",
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
 * Mở khi đang đi dở: kịch bản bắt người dùng sang màn khác, và ở màn nào cũng
 * phải thấy ngay bước đang làm. Đã đi hết, hay đã bấm "Để sau", thì thôi: tự
 * bung ra mãi là thứ khiến người ta ghét phần mềm.
 */
export function nenTuMo(tienDo: TienDoVongDan): boolean {
  return !tienDo.daXong && !tienDo.boQua;
}

/**
 * Vòng dẫn có hiện ở màn này không.
 *
 * Trang đầu luôn hiện: đang đi thì hiện bước, đang nghỉ thì một dòng mời.
 * Màn khác chỉ hiện khi người dùng đã thật sự bắt đầu (kho ghi `tung_di`) và
 * chưa xong, chưa "Để sau": đi dở thì lời dẫn đi theo sang màn Khách hàng,
 * màn soát vé…; chưa từng bấm gì thì không chen vào màn nghiệp vụ.
 */
export function hienVongDanTai(tienDo: TienDoVongDan, trangDau: boolean): boolean {
  if (trangDau) return true;
  return tienDo.tungDi && nenTuMo(tienDo);
}

/**
 * Tài khoản giữ tiến độ vòng dẫn. Vòng dẫn chỉ dành cho giám đốc; đang xem
 * thử một vai khác thì vẫn là tiến độ của giám đốc ấy, không phải của vai kia.
 */
export function chuVongDan(user: {
  id: string;
  role: string;
  actingAs?: { directorId: string } | undefined;
}): string | null {
  if (user.actingAs) return user.actingAs.directorId;
  return user.role === "director" ? user.id : null;
}
