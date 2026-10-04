import {
  CAC_DIP,
  congNgay,
  doChacChan,
  homNayTheoGioVN,
  ngayCuaDipTrongNam,
  soNgayGiua,
  type ChacChan,
  type DipMuaVu,
} from "@/domain/lich-mua-vu";

/**
 * Future planning (chủ dự án đặt tên 04/10/2026): nhìn trước nhiều năm.
 *
 * 1. Lịch sự kiện các năm tới: lấy thẳng từ Lịch mùa vụ, tính cho từng năm,
 *    ghi rõ ngày nào cố định theo lịch, ngày nào ban tổ chức đã công bố, ngày
 *    nào chỉ là dự kiến. Không có nguồn ngày thứ hai.
 * 2. Công nghệ của ERP: thứ đang chạy thật, và thứ nên áp dụng tiếp kèm lý
 *    do, cái đang có, cái còn thiếu. Viết thật: chưa làm thì nói chưa làm.
 */

export type SuKienNam = {
  dip: DipMuaVu;
  nam: number;
  batDau: string;
  ketThuc: string;
  chacChan: ChacChan;
  /** Ngày nên bắt đầu chuẩn bị. */
  chuanBiTu: string;
  trangThai: "da-qua" | "dang-dien-ra" | "sap-toi";
  conBaoNhieuNgay: number;
};

/** Mọi dịp trong `soNam` năm dương lịch tính từ năm nay, xếp theo ngày. */
export function lichCacNamToi(bayGio: Date, soNam = 3): { nam: number; suKien: SuKienNam[] }[] {
  const homNay = homNayTheoGioVN(bayGio);
  const namNay = Number(homNay.slice(0, 4));
  return Array.from({ length: soNam }, (_, i) => namNay + i).map((nam) => {
    const suKien: SuKienNam[] = [];
    for (const dip of CAC_DIP) {
      const ngay = ngayCuaDipTrongNam(dip, nam);
      if (!ngay || Number(ngay.batDau.slice(0, 4)) !== nam) continue;
      const con = soNgayGiua(homNay, ngay.batDau);
      suKien.push({
        dip,
        nam,
        batDau: ngay.batDau,
        ketThuc: ngay.ketThuc,
        chacChan: doChacChan(dip, nam),
        chuanBiTu: congNgay(ngay.batDau, -dip.chuanBiTruoc),
        trangThai: ngay.ketThuc < homNay ? "da-qua" : ngay.batDau <= homNay ? "dang-dien-ra" : "sap-toi",
        conBaoNhieuNgay: con,
      });
    }
    suKien.sort((a, b) => a.batDau.localeCompare(b.batDau));
    return { nam, suKien };
  });
}

export type CongNgheDangDung = {
  id: string;
  ten: string;
  lamGi: string;
  /** Thấy ở đâu trong hệ thống. */
  oDau: string;
  duongDan?: string;
};

export const CONG_NGHE_DANG_DUNG: readonly CongNgheDangDung[] = [
  {
    id: "qr-dong",
    ten: "Mã QR vé và quét bằng camera điện thoại",
    lamGi: "Mỗi vé, mỗi người trong đoàn một mã; nhân viên cổng quét bằng camera điện thoại, quét lần hai bị chặn.",
    oDau: "Vé & cổng, Check-in",
    duongDan: "/erp/trang-an/check-in-khach",
  },
  {
    id: "gps",
    ten: "Định vị GPS",
    lamGi: "Chấm công theo vị trí cơ sở; thuyền gửi vị trí từ điện thoại người chèo lên bản đồ sống.",
    oDau: "Chấm công, Thuyền trên sông",
    duongDan: "/erp/thuyen",
  },
  {
    id: "ban-do",
    ten: "Bản đồ vector MapLibre",
    lamGi: "Bản đồ tự vẽ theo màu thương hiệu, tuyến sông thật dựng từ OpenStreetMap, thuyền trượt liên tục.",
    oDau: "Thuyền trên sông, trang Khám phá",
    duongDan: "/erp/thuyen",
  },
  {
    id: "du-bao",
    ten: "Dự báo từ dữ liệu cổng",
    lamGi: "Dự báo giờ chạm trần sức chứa theo lượt qua cổng; ước số thuyền trên sông; ngày và giờ đông tám tuần.",
    oDau: "Sức chứa, Báo cáo & dự báo",
    duongDan: "/erp/trang-an/suc-chua",
  },
  {
    id: "ke-toan",
    ten: "Bút toán kép, người lập và người duyệt tách nhau",
    lamGi: "Chốt ca, hoá đơn nhà cung cấp, nộp quỹ, hoa hồng đại lý đều thành bút toán chờ kế toán trưởng kiểm tra; kỳ kế toán tự mở.",
    oDau: "Tài chính",
    duongDan: "/erp/finance",
  },
  {
    id: "giong-noi",
    ten: "Giọng nói trên trình duyệt",
    lamGi: "Trợ lý điều hành nghe lệnh nói; trang khách đọc thuyết minh bằng giọng tự nhiên của máy.",
    oDau: "Trợ lý, Nghe thuyết minh",
  },
  {
    id: "ngoai-tuyen",
    ten: "Ứng dụng web chạy ngoại tuyến",
    lamGi: "ERP cài được như ứng dụng trên điện thoại; có chế độ soát vé khi mất mạng, đang chờ thử bằng máy cầm tay thật ở cổng.",
    oDau: "Vé & cổng",
  },
  {
    id: "tu-dong",
    ten: "Việc tự chạy trong kho dữ liệu",
    lamGi: "Mỗi phút xoá lượt giữ chỗ quá hạn; mỗi giờ làm mới lịch sử mẫu; kiểm quyền ngay trong hàm của kho.",
    oDau: "Đặt vé web, mọi màn số liệu",
  },
  {
    id: "may-in",
    ten: "In phiếu thu qua Bluetooth",
    lamGi: "Quầy in phiếu bằng máy in nhiệt khổ 58 hoặc 80 mm, nhớ khổ giấy của từng máy.",
    oDau: "Quầy vé",
  },
];

export type UuTien = "lam-ngay" | "nen-lam" | "khi-co-ngan-sach";

export const NHAN_UU_TIEN: Record<UuTien, string> = {
  "lam-ngay": "Làm được ngay",
  "nen-lam": "Nên làm tiếp",
  "khi-co-ngan-sach": "Khi có ngân sách",
};

export type CongNgheDeXuat = {
  id: string;
  ten: string;
  giaiQuyet: string;
  hienCo: string;
  canGi: string;
  uuTien: UuTien;
};

/**
 * Xếp theo ưu tiên. Không đề xuất cổng thanh toán thật hay dịch vụ gửi tin
 * (chủ dự án đã chốt không dùng).
 */
export const CONG_NGHE_DE_XUAT: readonly CongNgheDeXuat[] = [
  {
    id: "thoi-tiet",
    ten: "Cảnh báo thời tiết cho bến thuyền",
    giaiQuyet: "Mưa lớn, dông, nắng nóng ảnh hưởng thẳng tới đò và khách; quản lý biết trước vài giờ để tạm dừng bến hay đổi giờ.",
    hienCo: "Sự cố có loại \"thời tiết\" nhưng phải nhập tay.",
    canGi: "Nối một nguồn dự báo miễn phí (như Open-Meteo), đặt ngưỡng cảnh báo theo bến. Chỉ cần viết mã.",
    uuTien: "lam-ngay",
  },
  {
    id: "tro-ly-ai",
    ten: "Trợ lý AI đọc số liệu điều hành",
    giaiQuyet: "Giám đốc hỏi bằng lời thường (\"tuần này Tam Cốc lệch tiền mấy ca?\") và nhận báo cáo cuối ngày tự viết.",
    hienCo: "Trợ lý hiểu một bộ lệnh cố định và dẫn tới đúng màn.",
    canGi: "Một mô hình ngôn ngữ lớn (như Claude) chỉ được đọc, không được ghi; ghi nhật ký mọi câu hỏi.",
    uuTien: "nen-lam",
  },
  {
    id: "hoa-don-dien-tu",
    ten: "Hoá đơn điện tử",
    giaiQuyet: "Vận hành thật phải phát hành hoá đơn điện tử theo Nghị định 123/2020 và Nghị định 70/2025.",
    hienCo: "ERP theo dõi trạng thái hoá đơn nhà cung cấp; chưa phát hành hoá đơn bán ra.",
    canGi: "Hợp đồng với một nhà cung cấp hoá đơn điện tử và chữ ký số của doanh nghiệp.",
    uuTien: "nen-lam",
  },
  {
    id: "du-bao-hoc-may",
    ten: "Dự báo khách bằng học máy",
    giaiQuyet: "Dự báo theo lịch lễ, thời tiết và mùa hoa thay vì trung bình tám tuần, để xếp người và thuyền sát hơn.",
    hienCo: "Dự báo thống kê từ tám tuần gần nhất.",
    canGi: "Ít nhất một năm dữ liệu bán thật để mô hình học được mùa.",
    uuTien: "nen-lam",
  },
  {
    id: "gps-thuyen",
    ten: "Thiết bị định vị gắn trên thuyền",
    giaiQuyet: "Vị trí liên tục kể cả khi người chèo tắt màn hình; biết chính xác thuyền nào đang ở đâu.",
    hienCo: "Vị trí từ điện thoại người chèo, cộng số thuyền ước từ lượt qua cổng.",
    canGi: "Thiết bị GPS có SIM dữ liệu gắn mỗi thuyền; ERP nhận vị trí qua đúng cổng đang dùng cho điện thoại.",
    uuTien: "khi-co-ngan-sach",
  },
  {
    id: "camera-ai",
    ten: "Camera AI đếm người thật",
    giaiQuyet: "Biết mật độ thật ở bến, cổng, lối hẹp để điều phối trước khi đông.",
    hienCo: "Màn Camera AI đang chạy kịch bản mô phỏng, ghi rõ trên màn.",
    canGi: "Camera ở điểm nghẽn và máy xử lý đặt tại chỗ, không gửi hình người ra ngoài; đánh giá quyền riêng tư trước.",
    uuTien: "khi-co-ngan-sach",
  },
  {
    id: "nfc",
    ten: "Vé vòng tay chạm (NFC) cho ngày lễ",
    giaiQuyet: "Ngày lễ đông như Sắc Hồng, chạm vòng tay qua cổng nhanh hơn mở mã QR trên điện thoại.",
    hienCo: "Vé QR trên điện thoại và giấy.",
    canGi: "Đầu đọc NFC ở cổng và vòng tay; ERP đã có sẵn luồng một lượt qua cổng cho mỗi mã.",
    uuTien: "khi-co-ngan-sach",
  },
  {
    id: "muc-nuoc",
    ten: "Cảm biến mực nước ở bến",
    giaiQuyet: "Mùa mưa, nước lên làm thấp lối qua hang; biết mực nước thật để dừng tuyến đúng lúc.",
    hienCo: "Chưa có.",
    canGi: "Cảm biến mực nước và bộ thu tín hiệu ở mỗi bến; ERP nhận số đo và cảnh báo như ngưỡng sức chứa.",
    uuTien: "khi-co-ngan-sach",
  },
];
