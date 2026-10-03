import { BAN_DO_CHUC_NANG, duongDanChucNang, type ChucNang, type MucMoi } from "@/domain/ban-do-chuc-nang";
import type { ErpRole } from "@/domain/erp";

/**
 * Màn Hướng dẫn (`/erp/huong-dan`): bấm một việc là hệ thống đưa tới đúng màn
 * và khoanh sáng đúng chỗ cần bấm, giống trợ lý mở màn theo lệnh.
 *
 * ## Vì sao bỏ vòng dẫn cũ (29/09/2026)
 *
 * Vòng dẫn trước là một khung chữ bám trên đầu mọi màn, bắt người dùng đọc
 * bước rồi tự tìm nút trên màn. Chủ dự án dùng thử và thấy "ngáo": khung chữ
 * đẩy nội dung xuống, lại không chỉ được nút nằm ở đâu. Nay mỗi việc có nút
 * "Đưa tôi tới"; tới nơi, phần tử đích được khoanh sáng, một thẻ nhỏ ở góc nói
 * bây giờ bấm gì, và có nút sang bước tiếp.
 *
 * ## Cách khoanh
 *
 * Đường dẫn mang `?chi=<mã việc>`. Thành phần `ChiDiem` tìm phần tử mang
 * `data-chi="<điểm>"` và khoanh nó. Màn nào đổi trạng thái theo từng bước (trang
 * đặt vé, quầy vé) thì tự dời `data-chi` sang đúng nút của bước ấy, kèm
 * `data-chi-loi` là câu "bây giờ bấm gì". Không trỏ theo toạ độ, nên đổi bố cục
 * không làm vỡ; không tìm thấy điểm thì thẻ nói thẳng là chưa thấy.
 *
 * Mọi thao tác chạy trên dữ liệu thật như ngày thường. Không lưu tiến độ vào
 * kho: trình duyệt nhớ bước nào đã mở, chỉ để đánh dấu cho người xem.
 */

export type BuocVong = {
  id: string;
  thuTu: number;
  ten: string;
  duongDan: string;
  diem: string;
  cacViec: readonly string[];
  /** Làm xong thì thấy gì, và vì sao điều đó đáng nói với khách hàng. */
  seThay: string;
};

export const VONG_KHACH: readonly BuocVong[] = [
  {
    id: "vong-dat-ve",
    thuTu: 1,
    ten: "Khách đặt vé, trả tiền bằng QR",
    // "Nhịp chậm" chỉ bán chặng Tràng An và có chuyến rải suốt ngày, nên
    // trình diễn được tới đầu giờ chiều; gói gia đình chỉ có 08:00, 09:30.
    duongDan: "/checkout?package=slow-ninh-binh&ngay=hom-nay",
    diem: "dat-ve",
    cacViec: [
      "Bấm một khung giờ còn sáng. Hôm nay hết khung thì đổi ngày đi sang ngày mai.",
      "Bấm \"Giữ chỗ 15 phút\".",
      "Gõ một số điện thoại bất kỳ, ví dụ 0912345678, rồi bấm \"Lấy mã QR thanh toán\".",
      "Quét mã bằng điện thoại, hoặc bấm dòng \"Mở trang thanh toán trên máy này\", rồi bấm \"Xác nhận chuyển khoản\".",
    ],
    seThay:
      "Trang đặt vé tự chuyển sang tấm vé mã WEB-…, đồng hồ giữ chỗ dừng hẳn. Tiền ở đây là giả lập, không ai mất đồng nào.",
  },
  {
    id: "vong-don",
    thuTu: 2,
    ten: "Đơn vừa đặt nằm trong ERP",
    duongDan: "/erp/khach-hang",
    diem: "don-moi",
    cacViec: ["Thẻ đơn được khoanh là đơn bạn vừa đặt: tên gói, cách trả, mã vé."],
    seThay:
      "Đơn ghi \"Đã thanh toán bằng QR\". Khách đặt xong là đơn nằm đây, không ai phải nhập lại.",
  },
  {
    id: "vong-qua-cong",
    thuTu: 3,
    ten: "Khách qua cổng Tràng An",
    duongDan: "/erp/khach-hang",
    diem: "ma-ve",
    cacViec: [
      "Bấm mã vé có chữ \"→ quét\". Màn soát vé Tràng An mở ra, mã đã điền sẵn.",
      "Bấm \"Xác thực & ghi nhận\".",
    ],
    seThay:
      "Máy báo vé hợp lệ, đã thanh toán bằng QR, kèm số lượt đã dùng. Vé cho mấy người thì quét được mấy lượt; quá số ấy máy báo hết lượt. Vé đặt cho ngày mai thì máy báo \"Vé không dùng cho hôm nay\".",
  },
  {
    id: "vong-ho-chieu",
    thuTu: 4,
    ten: "Hộ chiếu của khách sáng lên",
    duongDan: "/erp/khach-hang#khach-thay-gi",
    diem: "khach-thay-gi",
    cacViec: ["Nhìn khung điện thoại: đó đúng là thứ vị khách vừa đặt vé đang thấy."],
    seThay:
      "Tràng An đã sáng trên tấm hộ chiếu, nhiệm vụ \"Bước chân đầu tiên\" xong và có mã quà. Đi đủ các vùng thì mở thêm quà: lý do để khách quay lại.",
  },
  {
    id: "vong-ban-quay",
    thuTu: 5,
    ten: "Bán một vé tại quầy",
    duongDan: "/erp/trang-an/ve-dat-cho",
    diem: "ban-quay",
    cacViec: [
      "Giữ nguyên 1 người lớn, bấm \"Đủ tiền\".",
      "Tích ô \"Tôi đã đếm đủ…\".",
      "Bấm \"Xác nhận bán\".",
    ],
    seThay:
      "Phiếu thu hiện ra, in được ngay; tiền quầy tự cộng vào đối soát cuối ca. Phiếu ghi thật vào sổ nên chỉ bán thử 1 vé. Người bán không tự huỷ được phiếu: chỉ quản lý hoặc giám đốc huỷ, và phải ghi lý do.",
  },
  {
    id: "vong-kenh-khach",
    thuTu: 6,
    ten: "Khách đến từ đâu",
    duongDan: "/erp/marketing?ky=7-ngay#phieu-khach",
    diem: "phieu-khach",
    cacViec: [
      "Đọc dải năm ô từ \"Quét mã QR\" tới \"Qua cổng\" trong 7 ngày gần nhất.",
      "Ngay dưới là bảng \"Khách đến từ đâu\", tách theo từng mã QR.",
    ],
    seThay:
      "Lượt giữ chỗ, thanh toán và qua cổng bạn vừa làm đã nằm trong phễu. Khách chưa rõ nguồn để riêng một ô, không chia bừa vào chiến dịch nào.",
  },
  {
    id: "vong-trang-dau",
    thuTu: 7,
    ten: "Mỗi sáng chỉ cần xem trang đầu",
    duongDan: "/erp",
    diem: "bon-o",
    cacViec: [
      "Đọc bốn ô lớn: khách hôm nay, tiền thu hôm nay (quầy và web), công việc hiện trường, bút toán.",
      "Kéo xuống khối \"Cần giám đốc quyết định\": mọi việc đang chờ bạn nằm ở đó.",
    ],
    seThay: "Vé quầy và đơn web vừa làm đã cộng vào ô tiền hôm nay.",
  },
];

/**
 * Điểm khoanh ở màn kế tiếp khi người dùng bấm vào chính phần tử đang được
 * khoanh. Bước 3 bắt đầu ở màn Khách hàng (mã vé) rồi sang màn soát vé (nút
 * xác thực); không có dòng này thì sang màn soát vé là mất thẻ chỉ dẫn.
 */
export const DIEM_SAU_KHI_BAM: Readonly<Record<string, string>> = {
  "ma-ve": "quet-ve",
};

/** Một việc đang được hướng dẫn, dù là bước trong vòng khách hay việc tra cứu. */
export type MucDangChi = {
  id: string;
  ten: string;
  diem: string;
  cacViec: readonly string[];
  vai: ErpRole;
  /** Có khi là bước trong vòng khách. */
  vong?: { thuTu: number; tong: number; ke: BuocVong | null };
};

function tuChucNang(cn: ChucNang): MucDangChi {
  return { id: cn.id, ten: cn.ten, diem: cn.diem, cacViec: cn.cacViec, vai: cn.vai };
}

export function timMucDangChi(id: string | null | undefined): MucDangChi | null {
  if (!id) return null;
  const buoc = VONG_KHACH.find((b) => b.id === id);
  if (buoc) {
    return {
      id: buoc.id,
      ten: buoc.ten,
      diem: buoc.diem,
      cacViec: buoc.cacViec,
      vai: "director",
      vong: {
        thuTu: buoc.thuTu,
        tong: VONG_KHACH.length,
        ke: VONG_KHACH.find((b) => b.thuTu === buoc.thuTu + 1) ?? null,
      },
    };
  }
  for (const nhom of BAN_DO_CHUC_NANG) {
    const cn = nhom.chucNang.find((c) => c.id === id);
    if (cn) return tuChucNang(cn);
  }
  return null;
}

/**
 * Gắn `chi` (và `diem` khi khác điểm mặc định) vào đường dẫn, giữ nguyên
 * tham số sẵn có và phần `#` ở cuối.
 */
export function kemChi(duongDan: string, id: string, diem?: string): string {
  const [truocThang, thang] = duongDan.split("#", 2);
  const noi = truocThang.includes("?") ? "&" : "?";
  const them = `chi=${encodeURIComponent(id)}${diem ? `&diem=${encodeURIComponent(diem)}` : ""}`;
  return `${truocThang}${noi}${them}${thang ? `#${thang}` : ""}`;
}

export function duongDenBuoc(buoc: BuocVong): string {
  return kemChi(buoc.duongDan, buoc.id);
}

export function duongDenChucNang(cn: ChucNang): string {
  return kemChi(duongDanChucNang(cn), cn.id);
}

export const TONG_VIEC_TRA_CUU = BAN_DO_CHUC_NANG.reduce((n, nhom) => n + nhom.chucNang.length, 0);

/** Đường dẫn của một mục mới: việc ERP kèm `?chi=`, phần web giữ nguyên. */
export function duongDenMucMoi(muc: MucMoi): string {
  return muc.loai === "erp" ? duongDenChucNang(muc.cn) : muc.cn.duongDan;
}
