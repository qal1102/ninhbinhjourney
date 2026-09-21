/**
 * "Hôm nay anh nên làm gì trước" — một câu duy nhất trên trang chủ.
 *
 * ## Vấn đề thật
 *
 * Trang chủ giám đốc hiện đủ thứ: doanh thu, vé, ca, công nợ, sự cố, dự án.
 * Đủ thứ nghĩa là không thứ nào nổi lên, và người mở ra vẫn phải tự quyết định
 * bắt đầu từ đâu. Chủ dự án nói đúng câu ấy: *vào rồi không hiểu phải làm gì.*
 *
 * ## Luật xếp hạng, và vì sao theo thứ tự này
 *
 * 1. **Sự cố đã leo thang** — có thể đang có người gặp chuyện ở hiện trường.
 *    Tiền chờ được, người thì không.
 * 2. **Ca lệch quá ngưỡng** — tiền mặt đã rời két và chưa ai giải thích xong.
 *    Càng để lâu càng khó lần lại vì người trực đã về.
 * 3. **Hoá đơn đối tác chờ quyết** — cũng là tiền, nhưng là tiền chưa ra khỏi
 *    tài khoản, nên hoãn một ngày không mất gì.
 * 4. **Đề nghị đổi dự án** — ảnh hưởng ngân sách, nhưng có đường lùi.
 * 5. **Quyết định SOP** — quan trọng về dài hạn, không gấp trong ngày.
 *
 * Cố ý **chỉ trả về một việc**. Trả về một danh sách năm việc là quay lại đúng
 * cái bệnh đang chữa: người đọc lại phải tự xếp hạng.
 *
 * ## Không có việc nào cũng là một câu trả lời
 *
 * Ngày rảnh thì nói thẳng là rảnh. Bịa ra một "việc gợi ý" để màn hình đỡ
 * trống sẽ dạy người dùng rằng cái ô này không đáng tin.
 */

export type MucDoGap = "gap" | "can" | "ranh";

export type ViecDauTien = {
  id: string;
  /** Câu hiện ra, đã ghép sẵn số. */
  cauNoi: string;
  /** Vì sao việc này đứng trước các việc khác. */
  viSao: string;
  /** Nơi mở ra để làm; rỗng khi không có việc nào. */
  href: string;
  nhanNut: string;
  so: number;
  mucDo: MucDoGap;
};

export type DemViecChoGiamDoc = {
  suCoLeoThang: number;
  caLechChoQuyet: number;
  hoaDonChoQuyet: number;
  deNghiDoiDuAn: number;
  quyetDinhSop: number;
};

export const VIEC_DAU_TIEN_COPY = {
  nhan: "Việc nên làm trước",
  ranh: "Hôm nay không có việc nào chờ anh quyết.",
  ranhViSao:
    "Mọi hồ sơ đang nằm đúng bàn của người phụ trách. Anh chỉ cần mở lại khi có ai chuyển lên.",
} as const;

/**
 * Chọn đúng một việc để nói.
 *
 * Nhận số đếm chứ không nhận hồ sơ: tầng thuần này không cần biết hồ sơ ca,
 * hoá đơn và sự cố có hình dạng khác nhau ra sao.
 */
export function viecDauTien(
  dem: DemViecChoGiamDoc,
  /** Cơ sở dùng để dựng đường dẫn cho những việc nằm trong một cơ sở. */
  siteId: string,
): ViecDauTien {
  if (dem.suCoLeoThang > 0) {
    return {
      id: "su-co",
      cauNoi: `${dem.suCoLeoThang} sự cố đã leo thang lên anh.`,
      viSao: "Việc này đứng trước mọi việc tiền bạc: ngoài hiện trường có thể đang có người cần quyết định của anh.",
      href: `/erp/${siteId}/su-co`,
      nhanNut: "Mở hàng sự cố",
      so: dem.suCoLeoThang,
      mucDo: "gap",
    };
  }

  if (dem.caLechChoQuyet > 0) {
    return {
      id: "ca-lech",
      cauNoi: `${dem.caLechChoQuyet} ca bán vé lệch quá ngưỡng, đang chờ anh quyết.`,
      viSao: "Tiền mặt đã rời két và chưa ai khép lại được. Để qua ngày thì người trực ca hôm ấy đã về, rất khó lần lại.",
      href: `/erp/${siteId}/ve-dat-cho`,
      nhanNut: "Xem các ca lệch",
      so: dem.caLechChoQuyet,
      mucDo: "gap",
    };
  }

  if (dem.hoaDonChoQuyet > 0) {
    return {
      id: "hoa-don",
      cauNoi: `${dem.hoaDonChoQuyet} hoá đơn đối tác đang chờ anh quyết.`,
      viSao: "Cũng là tiền, nhưng là tiền chưa ra khỏi tài khoản — hoãn một ngày không mất gì, để lâu thì mất uy tín với đối tác.",
      href: `/erp/${siteId}/doi-tac-nha-cung-ung`,
      nhanNut: "Mở hàng hoá đơn",
      so: dem.hoaDonChoQuyet,
      mucDo: "can",
    };
  }

  if (dem.deNghiDoiDuAn > 0) {
    return {
      id: "doi-du-an",
      cauNoi: `${dem.deNghiDoiDuAn} đề nghị đổi dự án đang chờ anh duyệt.`,
      viSao: "Ảnh hưởng ngân sách nhưng còn đường lùi, nên xếp sau những việc đã động tới tiền mặt.",
      href: `/erp/${siteId}/du-an-su-kien`,
      nhanNut: "Xem đề nghị",
      so: dem.deNghiDoiDuAn,
      mucDo: "can",
    };
  }

  if (dem.quyetDinhSop > 0) {
    return {
      id: "sop",
      cauNoi: `${dem.quyetDinhSop} quyết định quy trình đang chờ anh.`,
      viSao: "Quan trọng về dài hạn, không gấp trong ngày — làm khi anh có một lúc yên tĩnh.",
      href: `/erp/${siteId}/sop-dien-tap`,
      nhanNut: "Mở quy trình",
      so: dem.quyetDinhSop,
      mucDo: "ranh",
    };
  }

  return {
    id: "khong-co",
    cauNoi: VIEC_DAU_TIEN_COPY.ranh,
    viSao: VIEC_DAU_TIEN_COPY.ranhViSao,
    href: "",
    nhanNut: "",
    so: 0,
    mucDo: "ranh",
  };
}

/** Tổng số việc đang chờ, để nói "còn N việc khác sau việc này". */
export function tongViecCho(dem: DemViecChoGiamDoc): number {
  return (
    dem.suCoLeoThang +
    dem.caLechChoQuyet +
    dem.hoaDonChoQuyet +
    dem.deNghiDoiDuAn +
    dem.quyetDinhSop
  );
}
