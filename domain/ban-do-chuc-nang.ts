import type { ErpModuleId, ErpRole } from "@/domain/erp";

/**
 * Mọi việc hệ thống làm được, việc nào của vai nào. Là nửa "tra một việc" của
 * màn Hướng dẫn (`/erp/huong-dan`); nửa kia là vòng khách trong
 * `domain/huong-dan.ts`.
 *
 * Nhiều việc bị khoá theo vai tận trong cơ sở dữ liệu vì tách nhiệm: người bán
 * không tự huỷ phiếu mình bán, kế toán lập thì kế toán trưởng mới ghi sổ. Mở
 * hết quyền cho giám đốc là phá chính nguyên tắc ấy. Nên việc của vai khác đi
 * bằng chuyển vai: một chạm là đứng đúng vai, đúng màn, đúng chỗ cần bấm.
 */

export type ChucNang = {
  id: string;
  ten: string;
  moTa: string;
  /** Vai làm việc này ngoài đời. `director` nghĩa là giám đốc tự làm được. */
  vai: ErpRole;
  /**
   * Giám đốc làm thử được ngay bằng tài khoản mình, không cần chuyển vai.
   * Chỉ đặt cho việc đã đi thật trong vòng khách (bán quầy, quét cổng) và
   * việc giám đốc vốn vào được (gọi lượt hàng chờ ở màn Sức chứa).
   */
  giamDocLamDuoc?: true;
  /** Màn hình của việc này; `{site}` thay bằng cơ sở làm mẫu. */
  duongDan: string;
  /** Chỗ cần khoanh sáng trên màn ấy: giá trị `data-chi` của phần tử đích. */
  diem: string;
  /** Các bước, mỗi dòng một việc, viết như người đứng cạnh chỉ tay. */
  cacViec: readonly string[];
  /** Ngày làm xong (dd/mm) nếu là phần mới: hiện dấu "Mới" và lên đầu màn Thử chức năng. */
  moi?: string;
};

export type NhomChucNang = { id: string; ten: string; chucNang: readonly ChucNang[] };

const CO_SO_MAU = "trang-an" as const;

export const BAN_DO_CHUC_NANG: readonly NhomChucNang[] = [
  {
    id: "cong-quay",
    ten: "Ở cổng và quầy vé",
    chucNang: [
      {
        id: "ban-quay",
        ten: "Bán vé tại quầy, thu tiền mặt",
        moTa: "Chọn số vé, đếm tiền, in phiếu thu có mã QR.",
        vai: "employee",
        giamDocLamDuoc: true,
        duongDan: "/erp/{site}/ve-dat-cho",
        diem: "ban-quay",
        cacViec: [
          "Chọn số vé người lớn, trẻ em.",
          "Gõ tiền khách đưa, hoặc bấm \"Đủ tiền\".",
          "Tích ô \"Tôi đã đếm đủ…\", rồi bấm \"Xác nhận bán\".",
        ],
      },
      {
        id: "phieu-doan",
        ten: "Lập phiếu đoàn tại quầy",
        moTa: "Một phiếu cho cả đoàn, mỗi người một mã riêng; đoàn trưởng tự điền tên sau.",
        vai: "employee",
        giamDocLamDuoc: true,
        duongDan: "/erp/{site}/ve-dat-cho",
        diem: "phieu-doan",
        cacViec: [
          "Gõ số người và một nhãn dễ nhận ra, ví dụ \"Đoàn Hà Nội\".",
          "Bấm \"Lập phiếu đoàn\": máy in mã đoàn và mã từng người, quét ở cổng như vé thường.",
        ],
      },
      {
        id: "quet-cong",
        ten: "Quét vé ở cổng",
        moTa: "Quét mã vé quầy, vé web trả bằng QR, mã từng người trong đoàn.",
        vai: "employee",
        giamDocLamDuoc: true,
        duongDan: "/erp/{site}/check-in-khach",
        diem: "quet-ve",
        cacViec: [
          "Đưa mã vé vào máy quét, hoặc gõ mã vào ô quét.",
          "Bấm \"Xác thực & ghi nhận\". Máy không có đầu quét thì bấm \"Quét bằng camera\".",
        ],
      },
      {
        id: "thu-tai-diem",
        ten: "Thu tiền khách trả tại điểm",
        moTa: "Vé đặt web chọn trả tại điểm: quét, thu, cổng mở.",
        vai: "employee",
        giamDocLamDuoc: true,
        duongDan: "/erp/{site}/check-in-khach",
        diem: "quet-ve",
        cacViec: [
          "Quét mã vé của khách đã chọn trả tại điểm.",
          "Máy báo số tiền cần thu. Thu xong, bấm \"Đã thu tiền\".",
          "Quét lại mã một lần nữa là khách vào.",
        ],
      },
      {
        id: "nop-ca",
        ten: "Nộp ca và đối soát cuối ca",
        moTa: "Cộng tiền quầy, tiền thu tại điểm, lượt qua cổng trong ca.",
        vai: "employee",
        duongDan: "/erp/{site}/ve-dat-cho",
        diem: "chot-ca",
        cacViec: [
          "Ở khối \"Gửi chốt vé và tiền thu\", nhập số vé và tiền đếm được.",
          "Máy tự tính chênh lệch. Bấm \"Gửi quản lý xác nhận\".",
        ],
      },
      {
        id: "gia-ve-quay",
        ten: "Đặt giá vé quầy",
        moTa: "Giá bán tại quầy của bốn cơ sở, hẹn được ngày áp dụng cho mùa lễ.",
        vai: "director",
        duongDan: "/erp/bang-gia-quay",
        diem: "gia-ve-quay",
        cacViec: [
          "Bấm \"Sửa giá\" ở một cơ sở, gõ giá mới, chọn ngày áp dụng và ghi lý do.",
          "Phiếu đã bán giữ nguyên giá lúc bán; quầy thấy giá mới từ đúng ngày ấy.",
        ],
      },
    ],
  },
  {
    id: "hien-truong",
    ten: "Hiện trường và an toàn",
    chucNang: [
      {
        id: "bao-cao",
        ten: "Báo cáo hiện trường có ảnh",
        moTa: "Nhân viên chụp ảnh, ghi vị trí, gửi lên quản lý.",
        vai: "employee",
        duongDan: "/erp/{site}/bao-cao-hien-truong",
        diem: "bao-cao-moi",
        cacViec: [
          "Chọn khu vực, loại báo cáo, đính kèm ảnh.",
          "Bấm \"Gửi báo cáo\". Quản lý nhận được ngay.",
        ],
      },
      {
        id: "su-co",
        ten: "Điều phối sự cố",
        moTa: "Nhận sự cố, giao người, leo thang khi quá hạn.",
        vai: "manager",
        duongDan: "/erp/{site}/su-co",
        diem: "su-co",
        cacViec: [
          "Mở một hồ sơ sự cố trong danh sách.",
          "Giao người xử lý hoặc chuyển bước; quá hạn thì hồ sơ tự lên giám đốc.",
        ],
      },
      {
        id: "suc-chua",
        ten: "Sức chứa theo giờ",
        moTa: "Lượt qua cổng trong giờ so với ngưỡng từng bến, biết điểm nghẽn trước khi phải dừng luồng.",
        vai: "director",
        duongDan: "/erp/{site}/suc-chua",
        diem: "suc-chua",
        cacViec: [
          "So ô \"Lượt cổng trong giờ\" với \"Năng lực nhỏ nhất\".",
          "Kéo xuống từng ngưỡng: vượt mức nào thì thẻ đổi màu.",
          "Giám đốc sửa ngưỡng ngay trên thẻ rồi bấm \"Lưu và ghi lịch sử\".",
        ],
      },
      {
        id: "hang-cho",
        ten: "Gọi lượt hàng chờ bến đò",
        moTa: "Khách lấy số trên điện thoại hay ở kiosk; nhân viên bến gọi lượt, ghi lên đò.",
        vai: "employee",
        giamDocLamDuoc: true,
        duongDan: "/erp/tam-coc/suc-chua",
        diem: "goi-luot",
        moi: "30/09",
        cacViec: [
          "Bấm \"Mở trang khách ↗\" (hay quét mã dán ở bến) và lấy thử một số.",
          "Quay lại đây, chọn số đò đang trống rồi bấm \"Gọi … nhóm tiếp\": máy khách tự báo tới lượt.",
          "Khách ra bến thì bấm \"Đã lên đò\"; quá 10 phút không tới thì \"Bỏ lượt\", khách không đi nữa thì \"Huỷ hẳn\".",
        ],
      },
      {
        id: "thuyen-tren-song",
        ten: "Thuyền trên sông, bản đồ sống",
        moTa: "Bến Tràng An, Tam Cốc còn bao nhiêu thuyền chờ khách, bao nhiêu đang trên sông và ở đoạn nào.",
        vai: "director",
        duongDan: "/erp/thuyen",
        diem: "ban-do-thuyen",
        moi: "04/10",
        cacViec: [
          "Đọc bảng bến: còn ở bến, đang trên sông, khách đang xuống bến, sắp về. Số ước từ lượt khách qua cổng; đội thuyền lấy ở màn Sức chứa.",
          "Ngoài giờ thuyền chạy, bản đồ tự phát lại cả ngày nhanh ×30; kéo thanh giờ để xem lúc đông nhất. Đổi Tràng An / Tam Cốc ở hai nút trên bản đồ.",
          "Bấm một thuyền để xem ai đang chèo, số điện thoại, số khách, giờ về bến.",
        ],
      },
      {
        id: "so-nguoi-cheo",
        ten: "Hồ sơ người chèo, bấm thuyền biết ai chèo",
        moTa: "Mỗi người chèo có hồ sơ: quê, số năm chèo, tiếng chào khách, hôm nay đã chở mấy chuyến, đang trên sông hay ở bến. Thuyền trên bản đồ nhận người theo lượt gọi xoay vòng.",
        vai: "director",
        duongDan: "/erp/thuyen",
        diem: "so-nguoi-cheo",
        moi: "06/10",
        cacViec: [
          "Kéo xuống \"Sổ người chèo\": mỗi dòng ghi quê, số năm chèo và đang trên sông hay ở bến. Bấm một người để mở hồ sơ với các chuyến hôm nay.",
          "Kéo lên bản đồ, bấm một thuyền: thẻ ghim lại với tên người chèo, quê, số năm chèo; bấm \"Xem hồ sơ\" là mở đúng hồ sơ người ấy.",
          "Trong hồ sơ bấm \"Sửa hồ sơ\" để ghi quê, năm vào nghề, tiếng chào khách, số điện thoại.",
        ],
      },
      {
        id: "gioi-thieu-nguoi-cheo",
        ten: "Người chèo giới thiệu khách, nhận hoa hồng",
        moTa: "Mỗi người chèo có một mã QR giới thiệu. Khách quét rồi đặt gói thì đơn ghi cho người chèo; khách tới cổng thì tính hoa hồng, chi qua màn Đại lý & hoa hồng.",
        vai: "director",
        duongDan: "/erp/thuyen",
        diem: "gioi-thieu-nguoi-cheo",
        moi: "07/10",
        cacViec: [
          "Dưới ba ô \"Hôm nay\" của sổ người chèo là dòng tổng: bao nhiêu người có mã, đưa về bao nhiêu khách, hoa hồng tạm tính.",
          "Bấm một người chèo: mục \"Giới thiệu khách\" có đơn đặt qua mã, khách đã tới, doanh thu, hoa hồng và mã QR đưa khách quét.",
          "Người chưa có mã: nhập tỷ lệ rồi bấm \"Cấp mã giới thiệu\". Chi hoa hồng ở màn Đại lý & hoa hồng, nhóm \"Người chèo giới thiệu khách\".",
        ],
      },
      {
        id: "thoi-tiet-ben",
        ten: "Thời tiết bến trong giờ thuyền chạy",
        moTa: "Dự báo từng giờ ở bến Tràng An và Văn Lâm; giờ có dông, mưa to, gió giật mạnh thì báo cân nhắc tạm dừng.",
        vai: "director",
        duongDan: "/erp/thuyen",
        diem: "thoi-tiet-ben",
        moi: "04/10",
        cacViec: [
          "Nhìn nhãn mức ở góc phải: Bình thường, Lưu ý, hay Cân nhắc tạm dừng; dòng màu bên dưới ghi khoảng giờ và mưa, gió tới đâu.",
          "Kéo ngang dải giờ để xem từng giờ thuyền chạy: trời, nhiệt độ, lượng mưa, gió giật. Đổi Tràng An / Tam Cốc ở hai nút trên bản đồ.",
          "Khi có cảnh báo, nút \"Báo sự cố thời tiết\" mở màn Sự cố của cơ sở để cả đội theo SOP thời tiết.",
        ],
      },
      {
        id: "nguoi-cheo",
        ten: "Người chèo gửi vị trí từ điện thoại",
        moTa: "Nhận khách xong bấm \"Bắt đầu chuyến\"; máy gửi vị trí 5 giây một lần tới khi về bến.",
        vai: "employee",
        giamDocLamDuoc: true,
        duongDan: "/erp/thuyen",
        diem: "bat-dau-chuyen",
        moi: "04/10",
        cacViec: [
          "Mở trang này trên điện thoại (đăng nhập giám đốc cũng được), gõ số thuyền, số khách, bấm \"Bắt đầu chuyến\" và cho phép đọc vị trí.",
          "Trên máy tính mở bản đồ cùng trang: thuyền thật màu cam hiện ra, kèm vệt 20 phút vừa đi và giờ ước về bến (tính từ chỗ thuyền đang ở trên tuyến, kể cả chặng nghỉ ở đền).",
          "Xong thì bấm \"Về bến, dừng gửi vị trí\": thuyền rời bản đồ.",
        ],
      },
      {
        id: "sop",
        ten: "SOP và diễn tập",
        moTa: "Quy trình mẫu, lịch diễn tập, điều kiện mở cửa.",
        vai: "manager",
        duongDan: "/erp/{site}/sop-dien-tap",
        diem: "sop",
        cacViec: [
          "Trả lời đủ các hạng mục kiểm tra trước giờ mở cửa.",
          "Gửi để giám đốc chốt mở hay chưa mở.",
        ],
      },
      {
        id: "camera",
        ten: "Camera theo khu vực (mô phỏng)",
        moTa: "Mật độ khách từng khu vực và cảnh báo khi đông; hiện chạy bản mô phỏng, nói rõ trên màn.",
        vai: "director",
        duongDan: "/erp/{site}/camera-ai",
        diem: "camera",
        cacViec: [
          "Đọc từng ô camera: khu vực, số người mô phỏng, mức đông.",
          "Đợi chừng mười giây: sự kiện kịch bản hiện dần ở khối dưới, như một ca trực thật.",
        ],
      },
    ],
  },
  {
    id: "su-kien-ncc",
    ten: "Sự kiện và nhà cung cấp",
    chucNang: [
      {
        id: "goi-viec",
        ten: "Dự án và sự kiện lớn",
        moTa: "Lễ hội của từng cơ sở: ngày tổ chức, tiến độ, ngân sách, gói việc theo nhóm.",
        vai: "director",
        duongDan: "/erp/{site}/du-an-su-kien",
        diem: "goi-viec",
        cacViec: [
          "Đọc thanh tiến độ và số ngày còn lại tới sự kiện.",
          "Mở từng gói việc: ai phụ trách, hạn ngày nào, đã xong bao nhiêu.",
        ],
      },
      {
        id: "doi-pham-vi",
        ten: "Duyệt đề nghị đổi ngân sách, ngày, phạm vi",
        moTa: "Quản lý đề nghị, giám đốc duyệt hoặc từ chối; ngân sách tự cập nhật.",
        vai: "director",
        duongDan: "/erp/{site}/du-an-su-kien",
        diem: "doi-pham-vi",
        cacViec: [
          "Đọc từng đề nghị đang chờ: đổi gì, bao nhiêu, ai gửi.",
          "Bấm duyệt hoặc từ chối kèm ghi chú; lịch sử ghi lại cả hai.",
        ],
      },
      {
        id: "hoa-don-ncc",
        ten: "Hoá đơn và công nợ nhà cung cấp",
        moTa: "Đề nghị mua, hợp đồng, nghiệm thu, hoá đơn đối chiếu với nhau rồi mới ghi công nợ.",
        vai: "director",
        duongDan: "/erp/finance",
        diem: "hoa-don-ncc",
        cacViec: [
          "Mở một hồ sơ: ba nguồn (đề nghị mua, hợp đồng, nghiệm thu) đặt cạnh hoá đơn.",
          "Hoá đơn vượt hợp đồng thì lên giám đốc quyết; khớp thì kế toán ghi sổ.",
        ],
      },
    ],
  },
  {
    id: "nhan-su",
    ten: "Nhân sự và ca làm",
    chucNang: [
      {
        id: "cham-cong",
        ten: "Chấm công theo vị trí",
        moTa: "Nhân viên vào ca, ra ca ngay tại cơ sở.",
        vai: "employee",
        duongDan: "/erp/{site}/cham-cong",
        diem: "cham-cong",
        cacViec: [
          "Bấm \"Cho phép GPS và vào ca\". Máy kiểm bạn đang đứng trong cơ sở.",
          "Hết ca thì ghi bàn giao rồi ra ca ngay trên thẻ này.",
        ],
      },
      {
        id: "bang-cong-co-so",
        ten: "Bảng công cơ sở",
        moTa: "Bảy ngày gần nhất ai vào ca, ra ca lúc mấy giờ, ai đi muộn, hôm nay ai đang trong ca.",
        vai: "director",
        duongDan: "/erp/{site}/cham-cong",
        diem: "bang-cong-co-so",
        moi: "06/10",
        cacViec: [
          "Xem bốn ô đầu: đang trong ca, đã tan ca, chưa vào ca hôm nay, lượt vào muộn 7 ngày.",
          "Mỗi dòng một người, cột đầu là hôm nay; giờ vào màu cam là vào sau 07:30. Bấm tên để mở hồ sơ người ấy.",
        ],
      },
      {
        id: "giao-ca",
        ten: "Giao việc cho nhân viên",
        moTa: "Quản lý giao việc trong ca, xem ai đã vào ca, duyệt ngày công.",
        vai: "manager",
        duongDan: "/erp/{site}/nhan-su",
        diem: "giao-viec",
        cacViec: [
          "Chọn nhân viên, công việc, hạn hoàn thành rồi bấm \"Giao việc\".",
          "Người nhận thấy việc ở màn Chấm công, vào ca bằng GPS.",
          "Kéo xuống khối \"Đội ngũ\" để tích màn nào người ấy được mở.",
        ],
      },
      {
        id: "tai-khoan",
        ten: "Tài khoản và phân quyền",
        moTa: "Tạo tài khoản, cấp vai, cơ sở cho từng người.",
        vai: "director",
        duongDan: "/erp/tai-khoan",
        diem: "tao-tai-khoan",
        cacViec: [
          "Bấm \"Thêm người vào hệ thống\".",
          "Điền họ tên, chức danh, vai, cơ sở rồi bấm \"Tạo tài khoản\".",
          "Máy ra tên đăng nhập và mật khẩu tạm để đưa cho người ấy.",
        ],
      },
      {
        id: "ban-giao-ca",
        ten: "Bàn giao ca có ký nhận",
        moTa: "Người hết ca giao tiền mặt, sự cố còn mở, thiết bị cần lưu ý cho người nhận.",
        vai: "manager",
        duongDan: "/erp/{site}/nhan-su",
        diem: "ban-giao-ca",
        cacViec: [
          "Chọn người nhận ca, ghi tiền mặt đếm được và số hệ thống phải có.",
          "Ghi sự cố còn mở, thiết bị cần lưu ý, rồi bấm \"Gửi bàn giao\".",
        ],
      },
      {
        id: "ho-so",
        ten: "Hồ sơ từng người",
        moTa: "Vai, cơ sở và việc đã làm gần đây của một người; sửa được họ tên, chức danh.",
        vai: "director",
        duongDan: "/erp/ho-so/director-001",
        diem: "ho-so",
        cacViec: [
          "Đọc vai, cơ sở, việc gần đây của người này.",
          "Bấm vào tên bất kỳ ở màn Nhân sự hay Nhật ký là tới hồ sơ người đó.",
        ],
      },
    ],
  },
  {
    id: "tai-chinh",
    ten: "Tài chính",
    chucNang: [
      {
        id: "lap-but-toan",
        ten: "Kiểm chứng từ, lập bút toán",
        moTa: "Kế toán nhận ca đã duyệt, lập bút toán, chuyển kế toán trưởng.",
        vai: "accountant",
        duongDan: "/erp/finance",
        diem: "lap-but-toan",
        cacViec: [
          "Ở khối \"Hàng lập bút toán\", mở một ca đã đủ điều kiện.",
          "Đối chiếu nguồn, lập bút toán rồi chuyển kế toán trưởng.",
        ],
      },
      {
        id: "ghi-so",
        ten: "Ghi sổ và khoá kỳ",
        moTa: "Kế toán trưởng soát, ghi sổ, khoá hoặc mở lại kỳ.",
        vai: "chief-accountant",
        duongDan: "/erp/finance",
        diem: "so-nhat-ky",
        cacViec: [
          "Mở từng bút toán trong \"Sổ nhật ký\" để soát và ghi sổ.",
          "Cuối kỳ, khoá kỳ ở khối kỳ kế toán.",
        ],
      },
      {
        id: "duyet-hoa-hong",
        ten: "Duyệt bút toán hoa hồng đại lý",
        moTa: "Giám đốc ghi đã chi hoa hồng, máy lập Nợ 6418 / Có 1121 chia theo cơ sở; kế toán trưởng ghi sổ hoặc trả lại.",
        vai: "chief-accountant",
        duongDan: "/erp/finance",
        diem: "so-nhat-ky",
        moi: "03/10",
        cacViec: [
          "Trước đó, ở tài khoản giám đốc: Quản trị → Đại lý & hoa hồng, chọn tháng, bấm \"Ghi đã chi\" ở một thẻ đại lý.",
          "Ở \"Sổ nhật ký\", mở bút toán nhãn \"Hoa hồng đại lý\": thấy Nợ 6418, Có 1121, phần của từng cơ sở.",
          "Ghi sổ, hoặc trả lại kèm lý do: thẻ đại lý ấy hiện \"bị trả lại\" và giám đốc ghi chi lại được.",
        ],
      },
      {
        id: "ky-ke-toan",
        ten: "Kỳ kế toán tự mở mỗi tháng",
        moTa: "Sang tháng mới là có kỳ để lập bút toán, không còn kẹt vì chưa ai mở kỳ.",
        vai: "chief-accountant",
        duongDan: "/erp/finance",
        diem: "ky-ke-toan",
        moi: "03/10",
        cacViec: [
          "Hai thẻ kỳ gần nhất nằm ở khối được khoanh: kỳ tháng này đang mở.",
          "Khoá kỳ khi đã soát xong; kỳ đã khoá thì không lập thêm bút toán vào được.",
        ],
      },
      {
        id: "tien-ve-co-so",
        ten: "Tiền vé của từng cơ sở, gồm phần đơn web",
        moTa: "Đơn gói web chia về từng cơ sở theo số lượt × giá vé quầy người lớn, cộng với tiền quầy.",
        vai: "director",
        duongDan: "/erp/{site}/ve-dat-cho",
        diem: "tien-ve-co-so",
        moi: "03/10",
        cacViec: [
          "Ô \"Tiền vé của cơ sở\" = tiền quầy + phần web của cơ sở này; dòng nhỏ ghi rõ từng phần.",
          "Màn Báo cáo của cơ sở có thêm ô \"Tiền vé · 28 ngày\" tách quầy và web.",
        ],
      },
      {
        id: "duyet-ngoai-le",
        ten: "Duyệt ngoại lệ tiền",
        moTa: "Lệch quỹ, công nợ vượt mức: giám đốc quyết.",
        vai: "director",
        duongDan: "/erp",
        diem: "can-quyet",
        cacViec: [
          "Ở khối \"Cần giám đốc quyết định\", mở một hồ sơ.",
          "Bấm \"Duyệt phương án ngoại lệ\" hoặc trả lại kèm lý do.",
        ],
      },
      {
        id: "bao-cao-du-bao",
        ten: "Báo cáo và dự báo",
        moTa: "Tám tuần khách qua cổng, ngày đông giờ đông, dự báo bảy ngày tới.",
        vai: "director",
        duongDan: "/erp/{site}/bao-cao",
        diem: "du-bao",
        cacViec: [
          "Đọc dự báo bảy ngày tới ở khối được khoanh.",
          "Kéo xuống xem ngày đông, giờ đông trong tám tuần qua.",
        ],
      },
      {
        id: "doi-soat-ca",
        ten: "Đối soát cuối ca",
        moTa: "Tiền khai lúc chốt ca đặt cạnh số hệ thống đếm từ phiếu thu và lượt quét.",
        vai: "director",
        duongDan: "/erp/{site}/tai-chinh-doi-soat",
        diem: "doi-soat-ca",
        cacViec: [
          "Chọn một ca trong danh sách.",
          "Đọc phần chênh lệch: tiền mặt, lượt khách, và lời giải thích vì sao lệch.",
        ],
      },
      {
        id: "nop-quy",
        ten: "Nộp quỹ vào ngân hàng",
        moTa: "Tiền mặt nộp ngân hàng, đối chiếu sao kê, rồi kế toán trưởng ghi sổ.",
        vai: "accountant",
        duongDan: "/erp/finance",
        diem: "nop-quy",
        cacViec: [
          "Kế toán ghi lượt nộp quỹ và dòng sao kê ngân hàng.",
          "Ghép lượt nộp với dòng sao kê; lệch thì lên giám đốc, khớp thì chuyển kế toán trưởng ghi sổ.",
        ],
      },
    ],
  },
  {
    id: "khach-marketing",
    ten: "Khách và marketing",
    chucNang: [
      {
        id: "khach-hang",
        ten: "Đơn web và Khách thấy gì",
        moTa: "Đơn web, cách trả, hộ chiếu của từng khách.",
        vai: "director",
        duongDan: "/erp/khach-hang",
        diem: "don-web",
        cacViec: [
          "Mỗi thẻ là một đơn: gói, cách trả, mã vé.",
          "Bấm \"Xem như khách\" để thấy hộ chiếu khách ấy đang cầm.",
        ],
      },
      {
        id: "marketing",
        ten: "Tạo mã QR theo chiến dịch",
        moTa: "Mã QR theo dịp, đếm lượt quét, xem dịp nào ra tiền.",
        vai: "director",
        duongDan: "/erp/marketing",
        diem: "tao-qr",
        cacViec: [
          "Chọn chiến dịch, gõ nhãn vị trí (ví dụ: bảng tại bến Tam Cốc) và trang mở ra khi quét.",
          "Bấm \"Tạo QR động\". In mã lên biển là khách quét được ngay.",
        ],
      },
      {
        id: "dai-ly",
        ten: "Đại lý và hoa hồng",
        moTa: "Đường dẫn giới thiệu của từng đại lý, đơn họ mang về, hoa hồng từng tháng.",
        vai: "director",
        duongDan: "/erp/dai-ly",
        diem: "dai-ly",
        moi: "03/10",
        cacViec: [
          "Chọn một tháng đã khép ở hàng nút trên cùng.",
          "Mỗi đại lý một thẻ: đơn đã trả, khách đã tới, hoa hồng (chỉ tính khách đã qua cổng).",
          "Bấm \"Xem cổng như đại lý thấy\"; chuyển khoản xong thì \"Ghi đã chi\".",
          "Ghi đã chi xong, bút toán Nợ 6418 / Có 1121 chờ kế toán trưởng kiểm tra ở màn Tài chính (đổi vai Kế toán trưởng để duyệt).",
        ],
      },
      {
        id: "danh-gia-khach",
        ten: "Lời khách đã tới đánh giá",
        moTa: "Chỉ khách đã qua cổng mới chấm được; giám đốc ẩn được lời không phù hợp.",
        vai: "director",
        duongDan: "/erp/khach-hang",
        diem: "danh-gia-khach",
        cacViec: [
          "Đọc bảng điểm từng cơ sở; cơ sở có từ 5 lời trở lên mới có kết luận.",
          "Lời nào không phù hợp thì ẩn kèm lý do.",
        ],
      },
      {
        id: "lich-mua-vu",
        ten: "Lịch mùa vụ và sổ nhãn hàng",
        moTa: "Các dịp lễ mười hai tháng tới, ngày âm lịch tự tính; sổ theo dõi nhãn hàng đối tác.",
        vai: "director",
        duongDan: "/erp/marketing",
        diem: "lich-mua-vu",
        cacViec: [
          "Đọc dịp nào sắp tới hạn chuẩn bị.",
          "Bấm \"Mở chiến dịch\" ở một dịp: có sẵn chiến dịch nháp gắn đúng dịp ấy.",
        ],
      },
    ],
  },
  {
    id: "cong-cu",
    ten: "Công cụ của giám đốc",
    chucNang: [
      {
        id: "ghi-bang-giong-noi",
        ten: "Giao việc, ghi chú bằng giọng nói",
        moTa: "Nói một câu như nói với đồng nghiệp; trợ lý viết bản nháp người nhận, hạn, cơ sở để xem lại rồi lưu.",
        vai: "director",
        duongDan: "/erp/viec",
        diem: "ghi-bang-giong-noi",
        moi: "06/10",
        cacViec: [
          "Bấm micro rồi nói \"Giao cho quản lý Tam Cốc sáng mai kiểm áo phao bến Văn Lâm\", bấm lần nữa để dừng (hoặc gõ vào ô bên cạnh).",
          "Xem bản nháp: người nhận, hạn, cơ sở đã điền sẵn; sửa nếu cần rồi bấm Giao việc.",
          "Thử \"Ghi chú gọi lại nhà in vé chiều nay\" và \"Nhật ký hôm nay đón ba đoàn khách\"; nút Trợ lý ở mọi màn cũng nhận các câu này.",
        ],
      },
      {
        id: "future-planning",
        ten: "Future planning: kế hoạch các năm tới",
        moTa: "Lễ hội, mùa vụ, chiến dịch ba năm tới; công nghệ ERP đang chạy và nên áp dụng tiếp.",
        vai: "director",
        duongDan: "/erp/future-planning",
        diem: "future-planning",
        moi: "04/10",
        cacViec: [
          "Đổi năm ở ba nút: mỗi dịp ghi ngày cố định, đã công bố hay dự kiến, và ngày nên bắt đầu chuẩn bị.",
          "Kéo xuống phần công nghệ: thứ đang chạy, thứ nên làm tiếp và ERP còn thiếu gì.",
        ],
      },
      {
        id: "de-xuat",
        ten: "Đề xuất chờ duyệt",
        moTa: "Mọi việc đang đợi giám đốc gật đầu.",
        vai: "director",
        duongDan: "/erp/de-xuat",
        diem: "de-xuat",
        cacViec: ["Mở từng đề xuất, đọc lý do, rồi duyệt hoặc trả lại."],
      },
      {
        id: "nhat-ky",
        ten: "Nhật ký hệ thống",
        moTa: "Ai làm gì, lúc nào, kể cả khi giám đốc chuyển vai.",
        vai: "director",
        duongDan: "/erp/nhat-ky",
        diem: "nhat-ky",
        cacViec: ["Gõ tên người, chọn khu vực rồi bấm \"Lọc\". Mỗi dòng ghi ai làm gì, lúc nào."],
      },
      {
        id: "xem-theo-vai",
        ten: "Xem theo vai trò",
        moTa: "Thấy hệ thống đúng như một nhân viên, quản lý hay kế toán thấy, kể cả chỗ họ bị chặn.",
        vai: "director",
        duongDan: "/erp",
        diem: "xem-theo-vai",
        cacViec: [
          "Bấm \"Xem theo vai trò\" trên thanh đầu trang, chọn một người.",
          "Thanh trên cùng luôn có nút quay về giám đốc; mỗi lần đổi đều vào nhật ký.",
        ],
      },
      {
        id: "tro-ly",
        ten: "Trợ lý điều hành",
        moTa: "Nói hoặc gõ một việc, trợ lý đưa tới đúng màn.",
        vai: "director",
        duongDan: "/erp",
        diem: "tro-ly",
        cacViec: [
          "Bấm nút Trợ lý ở góc dưới.",
          "Nói hoặc gõ, ví dụ \"mở bản đồ thuyền\", \"bán vé Tràng An\", \"hàng chờ\".",
        ],
      },
      {
        id: "thong-bao",
        ten: "Chuông thông báo",
        moTa: "Việc cần giám đốc quyết và sự cố đã chuyển cấp, gom về một chỗ.",
        vai: "director",
        duongDan: "/erp",
        diem: "thong-bao",
        cacViec: [
          "Bấm chuông trên thanh đầu trang.",
          "Bấm một dòng là tới thẳng hồ sơ cần xử lý.",
        ],
      },
    ],
  },
];

export type NhomWeb = "kham-pha" | "dat-ve" | "tai-diem" | "doi-tac" | "hieu-ung";

export const TEN_NHOM_WEB: Record<NhomWeb, string> = {
  "kham-pha": "Khám phá và lên kế hoạch",
  "dat-ve": "Đặt vé, vé và hộ chiếu",
  "tai-diem": "Tại điểm đến",
  "doi-tac": "Đối tác và mùa lễ",
  "hieu-ung": "Hiệu ứng giao diện",
};

/**
 * Phần khách thấy trên web. Không có thẻ khoanh như trong ERP (trang công khai
 * không gắn `ChiDiem`), nên mỗi mục ghi đủ bước để người thử tự làm theo.
 * Đường dẫn bắt đầu bằng `/erp` là phần khách thấy nhưng xem từ trong hệ
 * thống điều hành (hộ chiếu của một khách, cổng của một đại lý).
 */
export type ChucNangWeb = {
  id: string;
  nhom: NhomWeb;
  ten: string;
  moTa: string;
  duongDan: string;
  cacViec: readonly string[];
  moi?: string;
  /** Chỉ thấy trên máy có chuột (con trỏ theo ngữ cảnh, ánh nhũ). */
  chiMayTinh?: true;
};

export const CHUC_NANG_WEB: readonly ChucNangWeb[] = [
  {
    id: "web-ban-do",
    nhom: "kham-pha",
    ten: "Bản đồ mười lăm điểm đến",
    moTa: "Bản đồ riêng của Ninh Bình Journey: bấm tên một nơi là bản đồ nghiêng và bay tới đó.",
    duongDan: "/#map",
    cacViec: ["Kéo xuống khối bản đồ ở trang chủ.", "Bấm một tên trong danh sách: bản đồ bay tới, hiện thời gian tham quan và mức đi bộ."],
  },
  {
    id: "web-kham-pha",
    nhom: "kham-pha",
    ten: "Khám phá theo cách đi",
    moTa: "Lọc theo thời gian có, nhịp đi, mức đi bộ, người đi cùng; bản đồ và danh sách lọc theo nhau.",
    duongDan: "/explore",
    cacViec: ["Đổi \"Thời gian\" hay \"Mức đi bộ\": số điểm hợp với bạn đổi ngay.", "Chuyển giữa Bản đồ và Danh sách; bấm một nơi để sang trang của nơi ấy."],
  },
  {
    id: "web-lap-hanh-trinh",
    nhom: "kham-pha",
    ten: "Lập hành trình một ngày",
    moTa: "Chọn sở thích và nhịp đi, hệ thống xếp lịch theo giờ và gợi ý gói gần nhất.",
    duongDan: "/plan",
    cacViec: ["Bấm một gợi ý có sẵn như \"Đi cùng bố mẹ\", hoặc gõ mình muốn đi kiểu gì.", "Lịch từng điểm theo giờ hiện ra; muốn đổi thì thêm hay bỏ một điểm."],
  },
  {
    id: "web-diem-den",
    nhom: "kham-pha",
    ten: "Trang từng điểm đến",
    moTa: "Câu chuyện, lịch sử, giới hạn thật, thuyết minh để nghe, lời khách đã tới chấm điểm.",
    duongDan: "/destination/trang-an",
    cacViec: ["Đọc câu chuyện và khối \"Thông tin vận hành\" ghi giới hạn thật của nơi ấy.", "Bấm nghe thuyết minh; kéo xuống xem lời khách đã qua cổng chấm điểm."],
  },
  {
    id: "web-dat-ve-noi-nay",
    nhom: "kham-pha",
    ten: "Khối \"Đặt vé nơi này\"",
    moTa: "Bốn cơ sở có cổng vé liệt kê gói còn bán đi qua nơi ấy, bấm là sang trang gói.",
    duongDan: "/destination/tam-chuc",
    moi: "03/10",
    cacViec: ["Kéo xuống khối \"Đặt vé nơi này\", bấm một gói. Hai điểm Hoa Lư không có khối này: không bán vé tại đây."],
  },
  {
    id: "web-song-ngu",
    nhom: "kham-pha",
    ten: "Tiếng Việt và tiếng Anh",
    moTa: "Mọi trang khách có hai thứ tiếng; đổi một lần là giữ nguyên khi chuyển trang hay tải lại.",
    duongDan: "/",
    cacViec: ["Bấm nút VI / EN ở góc trên.", "Chuyển sang Khám phá, Gói, trang điểm đến: chữ vẫn giữ tiếng đã chọn."],
  },
  {
    id: "web-goi",
    nhom: "dat-ve",
    ten: "Các gói đi sẵn",
    moTa: "Các gói đi trong ngày qua bốn cơ sở có cổng, cùng Bàn Trăng theo mùa (mùa 2026 đã khép); giá minh hoạ, bấm là vào đặt.",
    duongDan: "/packages",
    cacViec: ["So các gói: thời lượng, nhịp đi, bao gồm và không bao gồm.", "Bấm \"Xem chi tiết\" hoặc \"Chọn gói\" để vào đặt."],
  },
  {
    id: "web-dat-goi",
    nhom: "dat-ve",
    ten: "Đặt gói và trả bằng QR giả lập",
    moTa: "Chọn ngày, khung giờ, số khách; giữ chỗ 15 phút, trả bằng QR giả lập, nhận vé ngay.",
    duongDan: "/checkout?package=slow-ninh-binh",
    cacViec: [
      "Chọn ngày, một khung giờ còn sáng, số khách rồi bấm giữ chỗ.",
      "Gõ một số điện thoại, lấy mã QR; bấm xác nhận trên trang thanh toán là có vé, lưu được ảnh vé.",
    ],
  },
  {
    id: "web-tra-cuu-ve",
    nhom: "dat-ve",
    ten: "Tra lại vé đã đặt",
    moTa: "Lỡ đóng trang vé thì mở lại bằng mã đặt chỗ cùng số điện thoại đã dùng.",
    duongDan: "/tra-cuu-ve",
    cacViec: ["Gõ mã đặt chỗ (bắt đầu bằng NBJ) và số điện thoại lúc đặt.", "Vé và mã QR hiện lại, đưa nhân viên quét thẳng trên màn hình."],
  },
  {
    id: "web-ho-so",
    nhom: "dat-ve",
    ten: "Hộ chiếu Ninh Bình",
    moTa: "Mọi chuyến của một khách gom về một chỗ: nơi đã qua cổng, nhiệm vụ, quà cho chuyến sau.",
    duongDan: "/ho-so",
    cacViec: ["Gõ một mã đặt chỗ cùng số điện thoại đã dùng lúc đặt.", "Nơi đã qua cổng sáng lên kèm dấu mộc; đi đủ vùng thì mở thêm quà."],
  },
  {
    id: "web-dau-moc",
    nhom: "dat-ve",
    ten: "Hộ chiếu của một khách thật, xem từ hệ thống",
    moTa: "Khách qua cổng là hộ chiếu đóng dấu mộc ghi ngày, như dấu xuất nhập cảnh.",
    duongDan: "/erp/khach-hang#khach-thay-gi",
    moi: "03/10",
    cacViec: [
      "Ở màn Khách hàng, bấm \"Xem như khách\" ở một đơn đã qua cổng.",
      "Khối \"Khách thấy gì\" hiện hộ chiếu của khách ấy, chặng đã đi có dấu mộc.",
    ],
  },
  {
    id: "web-hang-cho",
    nhom: "tai-diem",
    ten: "Lấy số hàng chờ bến đò Tam Cốc",
    moTa: "Khách quét mã ở bến, lấy số trên điện thoại, máy báo khi tới lượt.",
    duongDan: "/xep-hang/tam-coc",
    moi: "30/09",
    cacViec: [
      "Lấy một số; trang khách tự cập nhật còn bao nhiêu nhóm phía trước.",
      "Gọi lượt ở màn Tam Cốc → Sức chứa: trang khách đổi sang \"Tới lượt bạn\".",
    ],
  },
  {
    id: "web-nghe",
    nhom: "tai-diem",
    ten: "Nghe thuyết minh theo vị trí",
    moTa: "Đi tới đâu, điện thoại kể chuyện nơi ấy bằng giọng người đọc.",
    duongDan: "/nghe",
    moi: "30/09",
    cacViec: ["Cho phép đọc vị trí; ở xa Ninh Bình thì chọn một điểm trong danh sách để nghe thử."],
  },
  {
    id: "web-kiosk",
    nhom: "tai-diem",
    ten: "Kiosk tại cơ sở",
    moTa: "Màn hình đứng ở cổng: xem gói, lấy số hàng chờ, tự về màn chào sau một phút không ai chạm.",
    duongDan: "/kiosk/tam-coc",
    moi: "30/09",
    cacViec: ["Chạm thử từng nút như khách đứng trước kiosk."],
  },
  {
    id: "web-doan",
    nhom: "tai-diem",
    ten: "Đoàn tự khai tên từng người",
    moTa: "Quầy lập một phiếu đoàn; đoàn trưởng mở mã của đoàn, tự điền tên từng người trên điện thoại.",
    duongDan: "/erp/trang-an/ve-dat-cho",
    cacViec: ["Ở khối \"Lập phiếu đoàn\", gõ số người và nhãn đoàn rồi bấm lập.", "Quét mã đoàn bằng điện thoại: trang đoàn trưởng mở ra, điền tên từng người."],
  },
  {
    id: "web-dai-ly",
    nhom: "doi-tac",
    ten: "Cổng của đại lý",
    moTa: "Mỗi đại lý một đường dẫn riêng: đơn họ mang về, khách đã tới, hoa hồng từng tháng.",
    duongDan: "/erp/dai-ly",
    cacViec: ["Bấm \"Xem cổng như đại lý thấy\" ở một thẻ đại lý.", "Trang mở ra đúng như đại lý thấy khi bấm đường dẫn của họ."],
  },
  {
    id: "web-hop-tac",
    nhom: "doi-tac",
    ten: "Hồ sơ ý tưởng hợp tác thương hiệu",
    moTa: "Năm ý tưởng chụp ảnh với nhãn hàng thời trang, trình bày như một tập hồ sơ tạp chí.",
    duongDan: "/collaborations",
    cacViec: ["Cuộn qua từng hồ sơ: trang ảnh lật ra như tập hồ sơ giấy, có bóng gáy sách; phím ← → cũng lật được."],
  },
  {
    id: "web-hoa-sung",
    nhom: "doi-tac",
    ten: "Trang mùa hoa súng Tam Cốc",
    moTa: "Ảnh hoa súng thật ở đầu trang, bản đồ đường đò Tam Cốc có đoạn hoa dày và thuyền hoa trôi, lễ Sắc Hồng, gói đò sớm. Tự tính cho mọi năm.",
    duongDan: "/seasonal/hoa-sung",
    moi: "06/10",
    cacViec: [
      "Xem mùa đang tới: ngày hoa nở, ngày lễ Sắc Hồng (đã công bố hay dự kiến), bảng ba mùa tới.",
      "Kéo tới bản đồ: đường đò thật từ bến Văn Lâm tới Hang Ba, đoạn tô hồng là chỗ hoa dày, chấm hồng là thuyền hoa. Kéo, nghiêng, xoay được.",
      "Bấm \"Đặt đò sớm mùa hoa\".",
    ],
  },
  {
    id: "web-trung-thu",
    nhom: "doi-tac",
    ten: "Trang mùa Trung thu",
    moTa: "Vòng trăng tính đúng pha của đêm nay, ba đêm của mùa, Bàn Trăng bên sông Ngô Đồng.",
    duongDan: "/seasonal/mid-autumn",
    cacViec: ["Bấm từng đêm dưới vòng trăng: hình trăng và vệt trăng trên sông đổi theo.", "Mùa 2026 đã khép nên trang nói rõ và mời xem các gói đang mở."],
  },
  {
    id: "web-suong",
    nhom: "hieu-ung",
    ten: "Sương trôi trên ảnh đầu trang chủ",
    moTa: "Sương phủ núi đá, rê chuột thì sương tách theo, cuộn xuống thì các điểm đến hiện dần ra.",
    duongDan: "/",
    moi: "03/10",
    cacViec: [
      "Mở trang chủ, đứng yên vài giây nhìn sương trôi ngang qua núi.",
      "Rê chuột qua ảnh: sương rẽ ra quanh con trỏ. Cuộn xuống chậm: sương dày lên rồi nhường chỗ cho các điểm đến.",
    ],
  },
  {
    id: "web-suong-ven",
    nhom: "hieu-ung",
    ten: "Sương vén khi vào một điểm đến",
    moTa: "Mở trang một nơi là sương phủ kín, kéo dần xuống và tan, ảnh và tên nơi ấy hiện ra.",
    duongDan: "/destination/van-long",
    moi: "03/10",
    cacViec: ["Mở trang, đứng yên ba giây nhìn sương tan.", "Màu sương theo giờ thật ở Ninh Bình: sáng trắng, chiều vàng, tối ánh trăng."],
  },
  {
    id: "web-nui-suong",
    nhom: "hieu-ung",
    ten: "Dải núi thuỷ mặc",
    moTa: "Trang Lập hành trình mở đầu bằng bốn lớp núi đá vôi vẽ như tranh mực, một con đò trôi chậm.",
    duongDan: "/plan",
    moi: "03/10",
    cacViec: ["Đứng yên nhìn đò trôi qua giữa các lớp núi.", "Cuộn xuống: các lớp núi trôi lệch tầng, gần nhanh xa chậm."],
  },
  {
    id: "web-thuyen-cuon",
    nhom: "hieu-ung",
    ten: "Câu chuyện Tràng An, thuyền đi theo cuộn",
    moTa: "Cuộn tới đâu, con thuyền trên đường tiến độ đi tới đó, qua từng chặng hang và đền.",
    duongDan: "/#cau-chuyen-trang-an",
    moi: "03/10",
    cacViec: ["Cuộn chậm qua khối Tràng An: thuyền nhỏ ở đường tiến độ chạy theo, mỗi chặng đổi ảnh và lời kể."],
  },
  {
    id: "web-den-hoa-dang",
    nhom: "hieu-ung",
    ten: "Đèn hoa đăng trên vệt trăng",
    moTa: "Đèn hoa đăng trôi trên mặt sông dưới vòng trăng, nến lập loè, bóng đèn soi xuống nước.",
    duongDan: "/seasonal/mid-autumn",
    moi: "03/10",
    cacViec: ["Kéo tới vòng trăng, nhìn mặt nước ngay bên dưới."],
  },
  {
    id: "web-ve-giay",
    nhom: "hieu-ung",
    ten: "Thẻ gói kiểu vé giấy",
    moTa: "Ô giá là cuống vé răng cưa; rê chuột thì thẻ nghiêng như cầm vé, vệt nhũ vàng chạy theo.",
    duongDan: "/packages",
    moi: "03/10",
    chiMayTinh: true,
    cacViec: ["Rê chuột chậm qua một thẻ gói."],
  },
  {
    id: "web-con-tro",
    nhom: "hieu-ung",
    ten: "Con trỏ theo ngữ cảnh",
    moTa: "Đưa chuột vào dải tuyến, thẻ điểm đến, ảnh gói: con trỏ hiện chữ Kéo, Xem, Mở.",
    duongDan: "/#destinations-highlights",
    moi: "03/10",
    chiMayTinh: true,
    cacViec: ["Rê chuột lên dải tuyến hay ảnh điểm đến ở trang chủ: nhãn \"Kéo\", \"Xem\" đi theo con trỏ; rời ra là tắt."],
  },
  {
    id: "web-ben-do",
    nhom: "hieu-ung",
    ten: "Tiến trình đặt chỗ kiểu bến đò",
    moTa: "Năm bến dọc một dòng sông; con đò trôi tới bến của bước đang làm, bến đã qua sáng đèn.",
    duongDan: "/checkout?package=slow-ninh-binh",
    moi: "03/10",
    cacViec: ["Chọn khung giờ rồi giữ chỗ: đò trôi sang bến kế tiếp."],
  },
  {
    id: "web-hoa-no-theo-gio",
    nhom: "hieu-ung",
    ten: "Hoa súng nở theo giờ thật",
    moTa: "Đường cong độ nở trong buổi sáng, chấm là giờ lúc này ở Ninh Bình; bông hoa nét mảnh xoè hay khép theo giờ.",
    duongDan: "/seasonal/hoa-sung",
    moi: "06/10",
    cacViec: ["Mở trang, kéo tới \"Hoa chỉ mở buổi sáng\": chấm trên đường cong là giờ lúc này.", "Kéo thanh giờ từ 05:00 tới 12:00 để xem hoa xoè rồi khép."],
  },
  {
    id: "web-ke-mua",
    nhom: "doi-tac",
    ten: "Các mùa, kể cả mùa đã khép",
    moTa: "Trang Sự kiện theo mùa xếp mùa hoa súng đang tới cạnh Trung thu 2026 đã khép; mùa đã qua vẫn xem lại được.",
    duongDan: "/seasonal",
    moi: "06/10",
    cacViec: [
      "Mở trang: thẻ Trung thu ghi \"Đã khép mùa · xem lại\", bấm vào là trang Trung thu với dải báo mùa đã khép.",
      "Cuối trang hoa súng và trang Trung thu đều có khối \"Mùa khác\" để sang mùa kia.",
    ],
  },
];

export function duongDanChucNang(chucNang: ChucNang, site: string = CO_SO_MAU) {
  return chucNang.duongDan.replace("{site}", site);
}

/**
 * Chỉ nhận đường dẫn nội bộ ERP gọn gàng, để lệnh chuyển vai không bị lợi
 * dụng chuyển hướng ra ngoài. Cho kèm đúng một tham số `chi` (việc đang được
 * hướng dẫn), để chuyển vai xong vẫn khoanh đúng chỗ cần bấm.
 */
export function laDuongDanErpAnToan(value: string): boolean {
  return /^\/erp(\/[a-z0-9-]{1,40}){0,3}(\?chi=[a-z0-9-]{1,40})?$/.test(value);
}

type TaiKhoanChon = { accountId: string; role: ErpRole; active: boolean; siteIds: readonly string[] };
type QuyenNhanVien = Record<string, { moduleIdsBySite: Partial<Record<string, readonly string[]>> }>;

/**
 * Chọn tài khoản để "làm thử" một việc. Nhân viên chỉ vào được nghiệp vụ giám
 * đốc đã tích cho họ, nên với vai nhân viên phải chọn đúng người đã được giao
 * màn hình ấy ở cơ sở mẫu; chọn bừa là bị trả về "Nghiệp vụ này chưa được mở".
 */
export function chonTaiKhoanMau<T extends TaiKhoanChon>(
  targets: readonly T[],
  quyen: QuyenNhanVien,
  vai: ErpRole,
  duongDan: string,
): T | null {
  const phan = duongDan.split(/[/#?]/).filter(Boolean);
  const moduleId = phan.length >= 3 ? (phan[2] as ErpModuleId) : null;
  const hop = (t: T) => {
    if (!t.active || t.role !== vai) return false;
    if (vai !== "employee" || !moduleId) return true;
    return Boolean(quyen[t.accountId]?.moduleIdsBySite[CO_SO_MAU]?.includes(moduleId));
  };
  return targets.find((t) => hop(t) && t.siteIds.includes(CO_SO_MAU)) ?? targets.find(hop) ?? null;
}

export type MucMoi = { loai: "erp"; cn: ChucNang } | { loai: "web"; cn: ChucNangWeb };

function soNgay(moi: string) {
  const [ngay, thang] = moi.split("/").map(Number);
  return thang * 100 + ngay;
}

/**
 * Phần mới làm, cả ERP lẫn web, ngày gần nhất trước; cùng ngày thì giữ thứ tự
 * trong danh mục. Đứng đầu màn Thử chức năng và trên trang đầu giám đốc.
 */
export const CHUC_NANG_MOI: readonly MucMoi[] = [
  ...BAN_DO_CHUC_NANG.flatMap((nhom) => nhom.chucNang)
    .filter((cn) => cn.moi)
    .map((cn) => ({ loai: "erp" as const, cn })),
  ...CHUC_NANG_WEB.filter((cn) => cn.moi).map((cn) => ({ loai: "web" as const, cn })),
]
  .map((muc, i) => ({ muc, i }))
  .sort((a, b) => soNgay(b.muc.cn.moi!) - soNgay(a.muc.cn.moi!) || a.i - b.i)
  .map(({ muc }) => muc);
