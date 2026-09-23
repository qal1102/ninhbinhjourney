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
 * 1. **Cổng mở cửa Go/No-Go** — chưa có quyết định thì **cơ sở chưa được mở
 *    cửa**. Mọi việc khác đều giả định cửa đã mở, nên nó phải đứng trước.
 * 2. **Sự cố đã quá hạn SLA** — đang có chuyện ở hiện trường và đã trễ.
 * 3. **Sự cố đã leo thang, còn trong hạn** — vẫn là người, vẫn trước tiền.
 * 4. **Ca lệch quá ngưỡng** — tiền mặt đã rời két và chưa ai giải thích xong.
 *    Càng để lâu càng khó lần lại vì người trực đã về.
 * 5. **Hoá đơn đối tác chờ quyết** — cũng là tiền, nhưng là tiền chưa ra khỏi
 *    tài khoản, nên hoãn một ngày không mất gì.
 * 6. **Đề nghị đổi dự án** — ảnh hưởng ngân sách, nhưng có đường lùi.
 *
 * **Sửa thứ tự ngày 21/09/2026.** Bản đầu xếp quyết định SOP xuống chót với lý
 * do "quan trọng về dài hạn, không gấp trong ngày". Sai. Khối cũ trong
 * `executive-dashboard-live.tsx` — thứ bị khối này thay — đã ghi sẵn lý lẽ
 * đúng: `listPendingSopDecisions` đọc `erp_sop_opening_assessments`, tức là
 * **cổng mở cửa buổi sáng**, không phải quy trình bàn giấy. Lúc gộp hai khối
 * làm một mới đọc ra. Hai mức của sự cố cũng lấy từ đó.
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
  /** Tổng sự cố đã leo thang, **đã gồm** cả phần quá hạn. */
  suCoLeoThang: number;
  /** Phần đã quá hạn SLA trong số trên. Không cộng thêm vào tổng. */
  suCoQuaHan: number;
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
  if (dem.quyetDinhSop > 0) {
    return {
      id: "sop",
      cauNoi: `${dem.quyetDinhSop} cơ sở đang chờ anh quyết định cho mở cửa.`,
      viSao: "Anh chưa quyết thì cơ sở chưa mở cửa được, nên việc này cần làm trước tiên.",
      href: `/erp/${siteId}/sop-dien-tap`,
      nhanNut: "Xem hồ sơ mở cửa",
      so: dem.quyetDinhSop,
      mucDo: "gap",
    };
  }

  if (dem.suCoQuaHan > 0) {
    return {
      id: "su-co-qua-han",
      cauNoi: `${dem.suCoQuaHan} sự cố đã quá hạn xử lý.`,
      viSao: "Đã trễ hạn xử lý, ngoài hiện trường có thể đang có người chờ. Đây là việc gấp nhất hôm nay.",
      href: `/erp/${siteId}/su-co`,
      nhanNut: "Mở hàng sự cố",
      so: dem.suCoQuaHan,
      mucDo: "gap",
    };
  }

  if (dem.suCoLeoThang > 0) {
    return {
      id: "su-co",
      cauNoi: `${dem.suCoLeoThang} sự cố đã leo thang lên anh.`,
      viSao: "Nên xem trước các việc tiền bạc, vì ngoài hiện trường có thể đang có người chờ anh quyết.",
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
      viSao: "Tiền mặt đã ra khỏi két mà chưa ai chốt được. Để qua ngày thì người trực ca đã về, rất khó tìm lại chỗ lệch.",
      // Neo trong chính trang chủ, KHÔNG phải màn Vé của cơ sở.
      //
      // Bản đầu trỏ sang `/erp/{cơ sở}/ve-dat-cho`. Ở đó
      // `ShiftCloseSiteWorkflow` chỉ dựng nút cho vai nhân viên và quản lý —
      // giám đốc mở ra **đọc được mà không quyết được gì**. Đúng cái bẫy mà
      // bài `erp-access.spec.ts` ("việc chính của giám đốc dẫn tới đúng chỗ
      // quyết định được") đã dựng lên từ 09/09/2026 để chặn, và đúng cái bẫy
      // mà khối cũ trong `executive-dashboard-live.tsx` đã tránh được bằng
      // chính cái neo này. Nơi duy nhất giám đốc duyệt được ngoại lệ chốt ca
      // là khối `#quyet-dinh-giam-doc`, nằm ngay dưới trên cùng trang.
      href: "#quyet-dinh-giam-doc",
      nhanNut: "Xuống hồ sơ chốt ca",
      so: dem.caLechChoQuyet,
      mucDo: "gap",
    };
  }

  if (dem.hoaDonChoQuyet > 0) {
    return {
      id: "hoa-don",
      cauNoi: `${dem.hoaDonChoQuyet} hoá đơn đối tác đang chờ anh quyết.`,
      viSao: "Tiền này chưa chi ra nên hoãn một ngày cũng không sao, nhưng để lâu thì mất uy tín với đối tác.",
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
      viSao: "Có ảnh hưởng ngân sách nhưng vẫn sửa lại được, nên để sau các việc liên quan tiền mặt.",
      href: `/erp/${siteId}/du-an-su-kien`,
      nhanNut: "Xem đề nghị",
      so: dem.deNghiDoiDuAn,
      mucDo: "can",
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

/**
 * Tổng số việc đang chờ, để nói "còn N việc khác sau việc này".
 *
 * `suCoQuaHan` **không** cộng vào đây: nó là một lát cắt của `suCoLeoThang`,
 * không phải một loại việc riêng. Cộng cả hai là đếm đôi cùng một hồ sơ.
 */
export function tongViecCho(dem: DemViecChoGiamDoc): number {
  return (
    dem.suCoLeoThang +
    dem.caLechChoQuyet +
    dem.hoaDonChoQuyet +
    dem.deNghiDoiDuAn +
    dem.quyetDinhSop
  );
}
