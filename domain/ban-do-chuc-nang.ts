import type { ErpRole } from "@/domain/erp";

/**
 * Bản đồ mọi chức năng, cho giám đốc trình diễn trên MỘT tài khoản.
 *
 * Chủ dự án chỉ dùng tài khoản giám đốc, và muốn mọi chức năng hiện ra ở đó.
 * Nhưng nhiều việc bị khoá theo vai tận trong cơ sở dữ liệu vì tách nhiệm:
 * người bán không tự huỷ phiếu mình bán, kế toán lập thì kế toán trưởng mới
 * ghi sổ. Mở hết quyền cho giám đốc là phá chính nguyên tắc ấy.
 *
 * Nên bản đồ làm hai việc: kể đủ các việc hệ thống làm được, việc nào của vai
 * nào; và cho giám đốc chuyển sang đúng vai ấy, vào thẳng đúng màn hình, chỉ
 * một chạm. Các tài khoản kia vẫn chạy ngầm; nhật ký chuyển vai vẫn ghi đủ.
 */

export type ChucNang = {
  id: string;
  ten: string;
  moTa: string;
  /** Vai làm việc này ngoài đời. `director` nghĩa là giám đốc tự làm được. */
  vai: ErpRole;
  /** Màn hình của việc này; `{site}` thay bằng cơ sở làm mẫu. */
  duongDan: string;
};

export type NhomChucNang = { id: string; ten: string; chucNang: readonly ChucNang[] };

export const CO_SO_MAU = "trang-an" as const;

export const BAN_DO_CHUC_NANG: readonly NhomChucNang[] = [
  {
    id: "cong-quay",
    ten: "Ở cổng và quầy vé",
    chucNang: [
      { id: "ban-quay", ten: "Bán vé tại quầy, thu tiền mặt", moTa: "Chọn số vé, đếm tiền, in phiếu thu có mã QR.", vai: "employee", duongDan: "/erp/{site}/ve-dat-cho" },
      { id: "quet-cong", ten: "Quét vé ở cổng", moTa: "Quét mã vé quầy, vé web trả bằng QR, mã từng người trong đoàn.", vai: "employee", duongDan: "/erp/{site}/check-in-khach" },
      { id: "thu-tai-diem", ten: "Thu tiền khách trả tại điểm", moTa: "Vé đặt web chọn trả tại điểm: quét, thu, cổng mở.", vai: "employee", duongDan: "/erp/{site}/check-in-khach" },
      { id: "nop-ca", ten: "Nộp ca và đối soát cuối ca", moTa: "Cộng tiền quầy, tiền thu tại điểm, lượt qua cổng trong ca.", vai: "employee", duongDan: "/erp/{site}/ve-dat-cho" },
    ],
  },
  {
    id: "hien-truong",
    ten: "Hiện trường và an toàn",
    chucNang: [
      { id: "bao-cao", ten: "Báo cáo hiện trường có ảnh", moTa: "Nhân viên chụp ảnh, ghi vị trí, gửi lên quản lý.", vai: "employee", duongDan: "/erp/{site}/bao-cao-hien-truong" },
      { id: "su-co", ten: "Báo và điều phối sự cố", moTa: "Mở sự cố, giao người, leo thang khi quá hạn.", vai: "manager", duongDan: "/erp/{site}/su-co" },
      { id: "suc-chua", ten: "Sức chứa và dừng luồng", moTa: "Theo dõi ngưỡng, tạm dừng khung giờ khi đông.", vai: "manager", duongDan: "/erp/{site}/suc-chua" },
      { id: "sop", ten: "SOP và diễn tập", moTa: "Quy trình mẫu, lịch diễn tập, điều kiện mở cửa.", vai: "manager", duongDan: "/erp/{site}/sop-dien-tap" },
    ],
  },
  {
    id: "nhan-su",
    ten: "Nhân sự và ca làm",
    chucNang: [
      { id: "cham-cong", ten: "Chấm công theo vị trí", moTa: "Nhân viên vào ca, ra ca ngay tại cơ sở.", vai: "employee", duongDan: "/erp/{site}/cham-cong" },
      { id: "giao-ca", ten: "Giao việc trong ngày, duyệt công", moTa: "Quản lý giao ca, xem ai chưa vào, duyệt ngày công.", vai: "manager", duongDan: "/erp/{site}/nhan-su" },
      { id: "tai-khoan", ten: "Tài khoản và phân quyền", moTa: "Tạo tài khoản, cấp vai, tích nghiệp vụ cho từng người.", vai: "director", duongDan: "/erp/tai-khoan" },
    ],
  },
  {
    id: "tai-chinh",
    ten: "Tài chính",
    chucNang: [
      { id: "lap-but-toan", ten: "Kiểm chứng từ, lập bút toán", moTa: "Kế toán nhận chứng từ, lập bút toán, chuẩn bị thanh toán.", vai: "accountant", duongDan: "/erp/finance" },
      { id: "ghi-so", ten: "Ghi sổ và khoá kỳ", moTa: "Kế toán trưởng soát, ghi sổ, khoá hoặc mở lại kỳ.", vai: "chief-accountant", duongDan: "/erp/finance" },
      { id: "duyet-ngoai-le", ten: "Duyệt ngoại lệ tiền", moTa: "Lệch quỹ, công nợ vượt mức: giám đốc quyết.", vai: "director", duongDan: "/erp/finance" },
    ],
  },
  {
    id: "khach-marketing",
    ten: "Khách và marketing",
    chucNang: [
      { id: "khach-hang", ten: "Khách hàng và Khách thấy gì", moTa: "Đơn web, cách trả, hộ chiếu của từng khách.", vai: "director", duongDan: "/erp/khach-hang" },
      { id: "marketing", ten: "Mã QR, chiến dịch, lịch mùa vụ", moTa: "Tạo mã QR theo dịp, xem dịp nào ra tiền, sổ đối tác.", vai: "director", duongDan: "/erp/marketing" },
      { id: "de-xuat", ten: "Đề xuất chờ duyệt", moTa: "Mọi việc đang đợi giám đốc gật đầu.", vai: "director", duongDan: "/erp/de-xuat" },
      { id: "nhat-ky", ten: "Nhật ký hệ thống", moTa: "Ai làm gì, lúc nào, kể cả khi giám đốc chuyển vai.", vai: "director", duongDan: "/erp/nhat-ky" },
    ],
  },
];

export function duongDanChucNang(chucNang: ChucNang, site: string = CO_SO_MAU) {
  return chucNang.duongDan.replace("{site}", site);
}

/** Chỉ nhận đường dẫn nội bộ ERP gọn gàng, để lệnh chuyển vai không bị lợi dụng chuyển hướng ra ngoài. */
export function laDuongDanErpAnToan(value: string): boolean {
  return /^\/erp(\/[a-z0-9-]{1,40}){0,3}$/.test(value);
}
