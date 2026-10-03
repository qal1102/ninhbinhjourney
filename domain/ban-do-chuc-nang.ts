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
        moTa: "Từng thuyền đang ở đoạn nào của tuyến Tràng An, Tam Cốc, theo điện thoại người chèo đò.",
        vai: "director",
        duongDan: "/erp/thuyen",
        diem: "ban-do-thuyen",
        moi: "03/10",
        cacViec: [
          "Bản đồ vẽ tuyến sông thật; thuyền trượt liên tục, vệt trắng sau thuyền là đường vừa đi. Đổi Tràng An / Tam Cốc ở hai nút ngay trên bản đồ.",
          "Bấm \"Xem nhanh ×30\" để thấy cả đội thuyền mô phỏng chạy; bấm lại là về giờ thật.",
          "Bấm vào một thuyền để xem người chèo, số khách, đã đi bao lâu.",
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
        moi: "03/10",
        cacViec: [
          "Mở trang này trên điện thoại (đăng nhập giám đốc cũng được), gõ số thuyền, số khách, bấm \"Bắt đầu chuyến\" và cho phép đọc vị trí.",
          "Trên máy tính mở bản đồ cùng trang: thuyền thật màu vàng hiện ra, kèm vệt cam 20 phút vừa đi.",
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
    ],
  },
];

/**
 * Phần khách thấy trên web. Không có thẻ khoanh như trong ERP (trang công khai
 * không gắn `ChiDiem`), nên mỗi mục ghi đủ bước để người thử tự làm theo.
 */
export type ChucNangWeb = {
  id: string;
  ten: string;
  moTa: string;
  duongDan: string;
  cacViec: readonly string[];
  moi?: string;
  /** Chỉ thấy trên máy có chuột (con trỏ theo ngữ cảnh). */
  chiMayTinh?: true;
};

export const CHUC_NANG_WEB: readonly ChucNangWeb[] = [
  {
    id: "web-suong",
    ten: "Sương trôi trên ảnh đầu trang chủ",
    moTa: "Sương phủ núi đá, rê chuột thì sương tách theo, cuộn xuống thì các điểm đến hiện dần ra.",
    duongDan: "/",
    moi: "03/10",
    cacViec: [
      "Mở trang chủ, đứng yên vài giây nhìn sương trôi ngang qua núi.",
      "Rê chuột qua ảnh: sương rẽ ra quanh con trỏ.",
      "Cuộn xuống chậm: sương dày lên rồi nhường chỗ cho các điểm đến.",
    ],
  },
  {
    id: "web-thuyen-cuon",
    ten: "Câu chuyện Tràng An, thuyền đi theo cuộn",
    moTa: "Cuộn tới đâu, con thuyền trên đường tiến độ đi tới đó, qua từng chặng hang và đền.",
    duongDan: "/#cau-chuyen-trang-an",
    moi: "03/10",
    cacViec: ["Cuộn chậm qua khối Tràng An: thuyền nhỏ ở đường tiến độ chạy theo, mỗi chặng đổi ảnh và lời kể."],
  },
  {
    id: "web-con-tro",
    ten: "Con trỏ theo ngữ cảnh",
    moTa: "Đưa chuột vào dải tuyến, thẻ điểm đến, ảnh gói: con trỏ hiện chữ Kéo, Xem, Mở.",
    duongDan: "/packages",
    moi: "03/10",
    chiMayTinh: true,
    cacViec: ["Rê chuột lên ảnh một gói: nhãn \"Xem\" đi theo con trỏ; rời ảnh là tắt. Trên điện thoại không có."],
  },
  {
    id: "web-dat-ve-noi-nay",
    ten: "Trang điểm đến có khối \"Đặt vé nơi này\"",
    moTa: "Bốn cơ sở có cổng vé liệt kê gói còn bán đi qua nơi ấy, bấm là sang trang gói.",
    duongDan: "/destination/tam-chuc",
    moi: "03/10",
    cacViec: ["Kéo xuống khối \"Đặt vé nơi này\", bấm một gói. Hai điểm Hoa Lư không có khối này: không bán vé tại đây."],
  },
  {
    id: "web-dau-moc",
    ten: "Hộ chiếu khách có dấu mộc",
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
    ten: "Lấy số hàng chờ bến đò Tam Cốc",
    moTa: "Khách quét mã ở bến, lấy số trên điện thoại, máy báo khi tới lượt.",
    duongDan: "/xep-hang/tam-coc",
    moi: "30/09",
    cacViec: [
      "Lấy một số; trang khách tự cập nhật còn bao nhiêu nhóm phía trước.",
      "Gọi lượt ở ERP (Tam Cốc → Sức chứa): trang khách đổi sang \"Tới lượt bạn\".",
    ],
  },
  {
    id: "web-nghe",
    ten: "Nghe thuyết minh theo vị trí",
    moTa: "Đi tới đâu, điện thoại đọc thuyết minh của điểm gần nhất.",
    duongDan: "/nghe",
    moi: "30/09",
    cacViec: ["Cho phép đọc vị trí; ở xa Ninh Bình thì chọn một điểm trong danh sách để nghe thử."],
  },
  {
    id: "web-kiosk",
    ten: "Kiosk tại cơ sở",
    moTa: "Màn hình đứng ở cổng: xem gói, lấy số hàng chờ, tự về màn chào sau một phút không ai chạm.",
    duongDan: "/kiosk/tam-coc",
    moi: "30/09",
    cacViec: ["Chạm thử từng nút như khách đứng trước kiosk."],
  },
  {
    id: "web-dat-goi",
    ten: "Đặt gói và trả bằng QR giả lập",
    moTa: "Chọn gói, ngày, khung giờ, trả bằng QR giả lập, nhận vé và hộ chiếu.",
    duongDan: "/packages",
    cacViec: [
      "Chọn một gói, ngày, số khách, bấm giữ chỗ.",
      "Trang thanh toán hiện QR giả lập; bấm xác nhận đã trả là có vé, lưu được ảnh vé.",
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
