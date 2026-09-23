import type { ErpModuleId, ErpRole, ErpSiteId } from "@/domain/erp";

/**
 * Mạch việc — vẽ ra cái vòng quy trình vốn đã có sẵn trong dữ liệu.
 *
 * ## Vấn đề thật
 *
 * Chủ dự án tự dùng ERP và nói đúng một câu: *nhiều tính năng nhưng vào rồi
 * không hiểu phải làm gì.* Mỗi màn hình đều đúng việc của nó, nhưng không màn
 * nào nói cho người đứng đó biết **mình đang ở khúc nào của một quy trình**,
 * dữ liệu trước mặt từ đâu chảy tới, và làm xong thì ai cầm tiếp.
 *
 * ## Vì sao KHÔNG viết hướng dẫn bằng tay cho từng màn
 *
 * Trong dự án này đã có sẵn một bằng chứng: nút `?` (`ModuleContextHelp`) tồn
 * tại trên mọi màn từ lâu, nhưng 14/15 màn chỉ hiện đúng một dòng mô tả chung
 * cộng một đoạn trách nhiệm dùng chung cho mọi màn — chỉ màn Đối tác được viết
 * riêng. Viết tay 15 màn × 5 vai là 75 đoạn văn; tới ngày đổi quy trình sẽ
 * không ai nhớ sửa đủ 75 chỗ, và phần quên sửa trở thành **tài liệu nói dối** —
 * tệ hơn hẳn không có tài liệu, vì người đọc tin nó.
 *
 * ## Cách làm ở đây: khai xương sống, còn vị trí thì đọc từ dữ liệu
 *
 * Tệp này khai **bằng tay đúng một lần** những gì chỉ con người biết: một luồng
 * gồm mấy bước, ai làm bước nào, ở màn nào, dữ liệu vào từ đâu, đẩy ra cái gì.
 *
 * Nhưng **"hồ sơ đang nằm ở bước nào" thì không khai** — nó suy ra từ chính
 * trạng thái của hồ sơ, tức là từ cùng một nguồn mà màn hình đang đọc. Nhờ vậy
 * mạch dẫn không thể lệch khỏi sự thật: muốn đổi quy trình thì phải đổi máy
 * trạng thái, mà đổi máy trạng thái là bài kiểm đỏ ngay.
 *
 * Hai luồng đầu tiên được vẽ là **hai luồng tiền** — nơi sai một nhịp là mất
 * tiền thật, và cũng là nơi tài khoản giám đốc phải quyết nhiều nhất. Bốn
 * luồng thêm sau phủ nốt phần còn lại của một ngày vận hành: công của người,
 * lời xin của người, tiền mặt rời két, và chuyện bất thường ngoài hiện
 * trường. Tới đây mọi màn hình ERP có máy trạng thái đều đã nằm trên một mạch.
 *
 * Một bước mang `dangCho` rỗng là **cố ý**: đó là một hành động, không phải
 * chỗ hồ sơ nằm chờ. Không hồ sơ nào "đứng ở bước gửi đề nghị", vì trước khi
 * gửi thì hồ sơ chưa tồn tại. Thà để trống còn hơn gán bừa cho nó một trạng
 * thái để hàng số trông cho đều.
 */

/** Nơi làm một bước: một module trong cơ sở, hay một trang dùng chung. */
export type MachViecNoiLam =
  | { kieu: "module"; moduleId: ErpModuleId }
  | { kieu: "trang"; href: string };

export type MachViecBuoc = {
  id: string;
  /** Số người đọc thấy. Nhánh rẽ mang `null` vì nó không nằm trên đường thẳng. */
  thuTu: number | null;
  ten: string;
  /** Ai làm bước này. */
  vai: readonly ErpRole[];
  noiLam: MachViecNoiLam;
  /** Dữ liệu bước này nhận từ đâu — câu trả lời cho "số này ở đâu ra?". */
  nguonVao: string;
  /** Làm xong bước này thì cái gì ra đời. */
  ketQua: string;
  /**
   * Hồ sơ mang một trong các trạng thái này thì **đang chờ** bước này.
   *
   * Cố ý là "đang chờ" chứ không phải "đã làm xong": người mở màn hình cần
   * biết hồ sơ đang nằm trên bàn ai, không cần biết nó từng qua tay ai.
   */
  dangCho: readonly string[];
  /** Nhánh rẽ (trả lại, ngoại lệ) — có thật nhưng không phải đường chính. */
  nhanh?: true;
};

export type MachViec = {
  id: MachViecId;
  ten: string;
  /** Một câu nói trọn luồng này để làm gì. */
  motCau: string;
  buoc: readonly MachViecBuoc[];
};

export type MachViecId =
  | "dong-ca"
  | "cong-no-doi-tac"
  | "cham-cong"
  | "de-nghi-nhan-su"
  | "nop-quy"
  | "su-co";

/**
 * Luồng 1 — đóng ca bán vé.
 *
 * Trạng thái lấy đúng từ `ShiftCloseStatus` (`domain/erp-shift-close.ts`).
 * `posted` tới từ bút toán bên kế toán chứ không từ chính hồ sơ ca, nên bước
 * cuối nói rõ điều đó thay vì để người đọc tưởng ca tự ghi sổ được.
 */
const DONG_CA: MachViec = {
  id: "dong-ca",
  ten: "Đóng ca bán vé",
  motCau:
    "Tiền thu trong một ca đi từ tay nhân viên tới sổ kế toán, qua đúng bốn người, và mỗi lượt chuyển tay đều để lại vết.",
  buoc: [
    {
      id: "dong-ca-1-nop",
      thuTu: 1,
      ten: "Nhân viên nộp sổ ca",
      vai: ["employee"],
      noiLam: { kieu: "module", moduleId: "ve-dat-cho" },
      nguonVao:
        "Vé bán trong ca, cả ở cổng lẫn ở quầy, cùng số tiền mặt đếm được lúc giao ca.",
      ketQua:
        "Một hồ sơ ca mang bốn con số: tổng thu, hoàn, tiền mặt, thẻ. Chênh lệch do hệ thống tự tính, không ai gõ tay.",
      dangCho: ["manager-returned"],
    },
    {
      id: "dong-ca-2-quan-ly",
      thuTu: 2,
      ten: "Quản lý cơ sở duyệt",
      vai: ["manager"],
      noiLam: { kieu: "module", moduleId: "ve-dat-cho" },
      nguonVao: "Hồ sơ ca nhân viên vừa nộp, kèm chênh lệch đã tính sẵn.",
      ketQua:
        "Duyệt thì hồ sơ sang kế toán. Trả lại thì phải ghi lý do, và hồ sơ quay về đúng người nộp.",
      dangCho: ["submitted"],
    },
    {
      id: "dong-ca-3-ke-toan",
      thuTu: 3,
      ten: "Kế toán đối soát và lập bút toán",
      vai: ["accountant"],
      noiLam: { kieu: "trang", href: "/erp/finance" },
      nguonVao:
        "Hồ sơ ca quản lý đã duyệt, đặt cạnh vé bán ra và tiền nộp thực tế.",
      ketQua:
        "Một bút toán nháp chờ kế toán trưởng. Kế toán lập nhưng không tự duyệt được bút toán của mình.",
      dangCho: ["manager-approved", "director-approved", "director-rejected"],
    },
    {
      id: "dong-ca-4-ke-toan-truong",
      thuTu: 4,
      ten: "Kế toán trưởng duyệt và ghi sổ",
      vai: ["chief-accountant"],
      noiLam: { kieu: "trang", href: "/erp/finance" },
      nguonVao: "Bút toán kế toán vừa lập, kèm hồ sơ ca gốc để soi lại.",
      ketQua: "Ghi sổ xong thì ca khép lại. Trả lại thì bút toán quay về kế toán.",
      dangCho: ["accounting-review"],
    },
    {
      id: "dong-ca-5-xong",
      thuTu: 5,
      ten: "Đã ghi sổ",
      vai: [],
      noiLam: { kieu: "trang", href: "/erp/finance" },
      nguonVao: "Bút toán đã được kế toán trưởng duyệt.",
      ketQua: "Ca khép. Từ đây chỉ còn đường đảo bút toán, và đảo cũng để lại vết.",
      dangCho: ["posted"],
    },
    {
      id: "dong-ca-nhanh-giam-doc",
      thuTu: null,
      ten: "Giám đốc quyết ngoại lệ",
      vai: ["director"],
      noiLam: { kieu: "trang", href: "/erp" },
      nguonVao:
        "Chỉ những ca kế toán chuyển lên vì lệch quá 1.000 đ, kèm giải trình bắt buộc.",
      ketQua:
        "Quyết xong thì hồ sơ quay lại bàn kế toán để đi tiếp, dù chấp nhận hay bác.",
      dangCho: ["exception-pending-director"],
      nhanh: true,
    },
  ],
};

/**
 * Luồng 2 — công nợ đối tác.
 *
 * Trạng thái lấy đúng từ `SupplierApStatus` (`domain/erp-supplier-ap.ts`);
 * hai bước cuối theo đúng migration `202608020030`.
 */
const CONG_NO_DOI_TAC: MachViec = {
  id: "cong-no-doi-tac",
  ten: "Công nợ đối tác",
  motCau:
    "Một hoá đơn nhà cung cấp chỉ được trả tiền sau khi khớp đủ ba chiều: đặt hàng, nghiệm thu, hoá đơn.",
  buoc: [
    {
      id: "ap-1-ho-so-nguon",
      thuTu: 1,
      ten: "Bổ sung hồ sơ nguồn",
      vai: ["manager", "accountant"],
      noiLam: { kieu: "module", moduleId: "doi-tac-nha-cung-ung" },
      nguonVao:
        "Đơn đặt hàng, biên bản nghiệm thu và hoá đơn nhà cung cấp, mỗi thứ có vào một lúc khác nhau.",
      ketQua:
        "Hệ thống tự đối chiếu ba thứ. Lệch ở đâu thì chỉ đúng chỗ đó.",
      dangCho: ["match-exception", "accounting-returned"],
    },
    {
      id: "ap-2-ke-toan",
      thuTu: 2,
      ten: "Kế toán kiểm và lập bút toán",
      vai: ["accountant"],
      noiLam: { kieu: "module", moduleId: "doi-tac-nha-cung-ung" },
      nguonVao: "Hồ sơ đã khớp ba chiều, kèm mã số thuế và ngày hoá đơn đã kiểm.",
      ketQua: "Bút toán chi phí, thuế đầu vào và phải trả, chờ người khác duyệt.",
      dangCho: ["ready-for-accounting"],
    },
    {
      id: "ap-3-ke-toan-truong",
      thuTu: 3,
      ten: "Kế toán trưởng duyệt và ghi sổ",
      vai: ["chief-accountant"],
      noiLam: { kieu: "trang", href: "/erp/finance" },
      nguonVao: "Bút toán kế toán vừa lập, kèm ba chứng từ gốc.",
      ketQua: "Ghi sổ thì khoản nợ được công nhận. Trả lại thì hồ sơ về bàn kế toán.",
      dangCho: ["accounting-review"],
    },
    {
      id: "ap-4-ghi-nhan",
      thuTu: 4,
      ten: "Đã ghi nhận công nợ",
      vai: ["accountant"],
      noiLam: { kieu: "module", moduleId: "doi-tac-nha-cung-ung" },
      nguonVao: "Khoản nợ đã vào sổ, chờ tới hạn hoặc chờ có tiền.",
      ketQua: "Kế toán lập đề nghị chi khi tới lúc trả.",
      dangCho: ["posted"],
    },
    {
      id: "ap-5-duyet-chi",
      thuTu: 5,
      ten: "Kế toán trưởng duyệt chi",
      vai: ["chief-accountant"],
      noiLam: { kieu: "trang", href: "/erp/finance" },
      nguonVao: "Đề nghị chi, kèm khoản nợ đã ghi sổ và hình thức trả.",
      ketQua: "Duyệt thì ghi nhận đã trả. Trả lại thì khoản nợ về trạng thái chờ chi.",
      dangCho: ["payment-requested"],
    },
    {
      id: "ap-6-xong",
      thuTu: 6,
      ten: "Đã thanh toán",
      vai: [],
      noiLam: { kieu: "module", moduleId: "doi-tac-nha-cung-ung" },
      nguonVao: "Lượt duyệt chi của kế toán trưởng.",
      ketQua: "Hết nợ với đối tác này ở hoá đơn này.",
      dangCho: ["paid"],
    },
    {
      id: "ap-nhanh-giam-doc",
      thuTu: null,
      ten: "Giám đốc quyết ngoại lệ",
      vai: ["director"],
      noiLam: { kieu: "trang", href: "/erp" },
      nguonVao: "Hồ sơ lệch mà kế toán không tự quyết được, kèm giải trình.",
      ketQua: "Quyết xong thì hồ sơ quay về đường chính để đi tiếp.",
      dangCho: ["director-exception"],
      nhanh: true,
    },
  ],
};

/**
 * Luồng 3 — chấm công và phiếu việc trong ca.
 *
 * Trạng thái lấy đúng từ `WORKDAY_STATUSES` (`domain/erp-workday.ts`).
 * `assigned` là lúc phiếu đã giao nhưng người được giao chưa chấm vào, nên nó
 * nằm ở bước của **nhân viên** chứ không nằm ở bước của quản lý: cái quản lý
 * làm — giao phiếu — đã xong rồi, giờ quả bóng ở chân người khác.
 */
const CHAM_CONG: MachViec = {
  id: "cham-cong",
  ten: "Chấm công theo phiếu việc",
  motCau:
    "Một buổi công chỉ được tính sau khi có đủ ba thứ: giờ vào ca có toạ độ, bằng chứng việc đã làm, và một chữ ký duyệt của quản lý.",
  buoc: [
    {
      id: "cham-cong-1-cham-vao",
      thuTu: 1,
      ten: "Nhân viên chấm vào ca",
      vai: ["employee"],
      noiLam: { kieu: "module", moduleId: "cham-cong" },
      nguonVao:
        "Phiếu việc quản lý đã giao cho ca hôm nay, kèm điểm làm việc và mốc giờ phải có mặt.",
      ketQua:
        "Giờ vào ca ghi kèm toạ độ và khoảng cách tới điểm làm việc, nên không ai chấm công hộ được.",
      dangCho: ["assigned"],
    },
    {
      id: "cham-cong-2-lam-va-nop",
      thuTu: 2,
      ten: "Nhân viên làm và nộp bằng chứng",
      vai: ["employee"],
      noiLam: { kieu: "module", moduleId: "cham-cong" },
      nguonVao:
        "Đầu việc trên phiếu, cộng ảnh chụp tại chỗ mà máy tự gắn giờ và toạ độ lúc chụp.",
      ketQua:
        "Phiếu chuyển sang chờ duyệt, mang theo giờ vào, giờ ra và toàn bộ ảnh đã nộp.",
      dangCho: ["checked-in", "in-progress"],
    },
    {
      id: "cham-cong-3-quan-ly-duyet",
      thuTu: 3,
      ten: "Quản lý duyệt công",
      vai: ["manager"],
      noiLam: { kieu: "module", moduleId: "cham-cong" },
      nguonVao:
        "Phiếu nhân viên vừa nộp, đặt cạnh giờ chấm và ảnh hiện trường để soi lại.",
      ketQua:
        "Duyệt thì buổi công được tính. Trả lại thì phải ghi lý do, và phiếu về đúng người làm.",
      dangCho: ["submitted"],
    },
    {
      id: "cham-cong-4-xong",
      thuTu: 4,
      ten: "Công đã chốt",
      vai: [],
      noiLam: { kieu: "module", moduleId: "cham-cong" },
      nguonVao: "Lượt duyệt của quản lý cơ sở, kèm toàn bộ vết của phiếu.",
      ketQua:
        "Buổi công vào bảng công của người ấy. Sửa về sau đều để lại vết trong nhật ký phiếu.",
      dangCho: ["approved"],
    },
    {
      id: "cham-cong-nhanh-tra-lai",
      thuTu: null,
      ten: "Quản lý trả phiếu về làm lại",
      vai: ["employee"],
      noiLam: { kieu: "module", moduleId: "cham-cong" },
      nguonVao:
        "Phiếu thiếu ảnh, ảnh chụp ngoài phạm vi điểm làm việc, hoặc giờ chấm không khớp ca được giao.",
      ketQua:
        "Nhân viên bổ sung rồi nộp lại, phiếu quay về bước 3 chứ không phải làm lại từ đầu.",
      dangCho: ["manager-returned"],
      nhanh: true,
    },
  ],
};

/**
 * Luồng 4 — đề nghị nhân sự (nghỉ, đổi ca, tạm ứng, mua, sửa chữa, huỷ phiếu).
 *
 * Trạng thái lấy đúng từ `STAFF_REQUEST_STATUS_LABELS`
 * (`domain/erp-staff-requests.ts`). Bước 3 **không phải bước ai cũng đi qua**:
 * chỉ khoản tiền vượt ngưỡng mới lên tới giám đốc, và câu chữ của bước nói
 * thẳng điều đó thay vì để người đọc tưởng mọi đề nghị đều phải chờ ông ấy.
 */
const DE_NGHI_NHAN_SU: MachViec = {
  id: "de-nghi-nhan-su",
  ten: "Đề nghị nhân sự",
  motCau:
    "Xin nghỉ, đổi ca, ứng tiền, mua đồ hay sửa chữa đều gửi chung một chỗ, không còn lời xin nào lọt thỏm trong tin nhắn riêng.",
  buoc: [
    {
      id: "de-nghi-1-gui",
      thuTu: 1,
      ten: "Người cần gửi đề nghị",
      vai: ["employee", "manager"],
      noiLam: { kieu: "trang", href: "/erp/de-xuat" },
      nguonVao:
        "Chính người cần: chọn loại việc rồi điền đúng mấy ô của loại ấy, máy kiểm ngay trước khi gửi.",
      ketQua:
        "Một hồ sơ mang mã DX-…, đứng tên người gửi, và từ lúc này mọi lượt chuyển tay đều có vết.",
      dangCho: [],
    },
    {
      id: "de-nghi-2-quan-ly",
      thuTu: 2,
      ten: "Quản lý cơ sở duyệt",
      vai: ["manager"],
      noiLam: { kieu: "trang", href: "/erp/de-xuat" },
      nguonVao: "Đề nghị vừa gửi của người trong cơ sở mình phụ trách.",
      ketQua:
        "Duyệt thì đề nghị đi tiếp; từ chối thì bắt buộc ghi lý do. Không ai tự duyệt đề nghị của chính mình.",
      dangCho: ["submitted"],
    },
    {
      id: "de-nghi-3-giam-doc",
      thuTu: 3,
      ten: "Giám đốc duyệt khoản vượt ngưỡng",
      vai: ["director"],
      noiLam: { kieu: "trang", href: "/erp/de-xuat" },
      nguonVao:
        "Chỉ tạm ứng, đề xuất mua và sửa chữa vượt 5.000.000 đ; dưới mức ấy đề nghị đi thẳng từ bước 2 sang bước 4.",
      ketQua:
        "Quyết xong thì đề nghị sang bước chi, hoặc dừng hẳn kèm lý do đã ghi.",
      dangCho: ["pending-director"],
    },
    {
      id: "de-nghi-4-chi",
      thuTu: 4,
      ten: "Kế toán chi, hoặc quản lý ghi đã xong",
      vai: ["accountant", "manager"],
      noiLam: { kieu: "trang", href: "/erp/de-xuat" },
      nguonVao:
        "Đề nghị đã duyệt. Tạm ứng và đề xuất mua thì kế toán chi; sửa chữa thì quản lý ghi đã sửa xong.",
      ketQua:
        "Một dòng ghi nhận bắt buộc có ghi chú, nên sau này đọc lại biết tiền đi đâu hay đồ đã sửa gì.",
      dangCho: ["approved"],
    },
    {
      id: "de-nghi-5-xong",
      thuTu: 5,
      ten: "Đã hoàn tất",
      vai: [],
      noiLam: { kieu: "trang", href: "/erp/de-xuat" },
      nguonVao: "Lượt ghi hoàn tất của kế toán hoặc quản lý.",
      ketQua: "Hồ sơ khép, giữ nguyên làm vết cho lần đối chiếu sau.",
      dangCho: ["completed"],
    },
    {
      id: "de-nghi-nhanh-tu-choi",
      thuTu: null,
      ten: "Bị từ chối",
      vai: [],
      noiLam: { kieu: "trang", href: "/erp/de-xuat" },
      nguonVao:
        "Quản lý hoặc giám đốc bác, và người bác buộc phải viết lý do dài hơn năm ký tự.",
      ketQua:
        "Hồ sơ dừng hẳn. Muốn xin lại thì gửi đề nghị mới; hồ sơ cũ giữ nguyên để còn lưu lý do bị bác.",
      dangCho: ["rejected"],
      nhanh: true,
    },
    {
      id: "de-nghi-nhanh-rut",
      thuTu: null,
      ten: "Người gửi rút lại",
      vai: [],
      noiLam: { kieu: "trang", href: "/erp/de-xuat" },
      nguonVao:
        "Người gửi tự rút, và chỉ rút được khi chưa ai duyệt. Đã duyệt rồi thì phải nhờ người duyệt bác.",
      ketQua: "Hồ sơ dừng, vẫn nằm trong nhật ký để về sau đếm được.",
      dangCho: ["cancelled"],
      nhanh: true,
    },
  ],
};

/**
 * Luồng 5 — nộp tiền mặt về ngân hàng.
 *
 * Trạng thái lấy đúng từ `CASH_DEPOSIT_STATUS_LABELS`
 * (`domain/erp-cash-deposit.ts`). Đây là chỗ tiền mặt rời khỏi két của cơ sở,
 * nên hai bước đầu cố ý không cùng một người: kế toán đối khớp, kế toán
 * trưởng mới ghi sổ.
 */
const NOP_QUY: MachViec = {
  id: "nop-quy",
  ten: "Nộp quỹ về ngân hàng",
  motCau:
    "Tiền mặt của những ca đã chốt đi vào tài khoản ngân hàng, và chỉ được ghi sổ khi số trên phiếu nộp khớp đúng dòng sao kê.",
  buoc: [
    {
      id: "nop-quy-1-lap-va-khop",
      thuTu: 1,
      ten: "Kế toán lập phiếu nộp và đối khớp sao kê",
      vai: ["accountant"],
      noiLam: { kieu: "trang", href: "/erp/finance" },
      nguonVao:
        "Những ca đã chốt mà tiền mặt chưa nộp, cộng dòng sao kê ngân hàng đã nhập vào hệ thống.",
      ketQua:
        "Khớp đúng thì phiếu sang kế toán trưởng. Lệch thì hệ thống tự rẽ sang nhánh lệch, không cho đi tiếp.",
      dangCho: ["submitted"],
    },
    {
      id: "nop-quy-2-ghi-so",
      thuTu: 2,
      ten: "Kế toán trưởng ghi sổ",
      vai: ["chief-accountant"],
      noiLam: { kieu: "trang", href: "/erp/finance" },
      nguonVao: "Phiếu nộp đã khớp, kèm dòng sao kê và danh sách ca đã gộp vào.",
      ketQua: "Ghi sổ xong thì tiền mặt của các ca ấy coi như đã về tài khoản.",
      dangCho: ["accounting-review"],
    },
    {
      id: "nop-quy-3-xong",
      thuTu: 3,
      ten: "Đã ghi sổ",
      vai: [],
      noiLam: { kieu: "trang", href: "/erp/finance" },
      nguonVao: "Bút toán kế toán trưởng vừa ghi.",
      ketQua: "Khép một lượt nộp quỹ. Muốn sửa thì phải đảo bút toán, và đảo cũng để lại vết.",
      dangCho: ["posted"],
    },
    {
      id: "nop-quy-nhanh-lech",
      thuTu: null,
      ten: "Lệch số, chờ giải trình rồi quyết",
      vai: ["chief-accountant", "director"],
      noiLam: { kieu: "trang", href: "/erp/finance" },
      nguonVao:
        "Số trên phiếu nộp không bằng số trên dòng sao kê; hệ thống ghi rõ lệch bao nhiêu và giao cho một người chịu trách nhiệm giải trình, kèm hạn.",
      ketQua:
        "Chấp thuận thì phiếu quay lại đường chính để ghi sổ. Trả về người lập thì phải làm lại từ bước 1.",
      dangCho: ["exception"],
      nhanh: true,
    },
  ],
};

/**
 * Luồng 6 — sự cố hiện trường.
 *
 * Trạng thái lấy đúng từ `INCIDENT_STATUSES` (`domain/incident.ts`).
 * "Leo thang" **không phải một trạng thái** mà là một cờ đi kèm, nên nó nằm ở
 * nhánh rẽ và mang danh sách trạng thái rỗng — nói đúng như nó có, thay vì
 * bịa thêm một trạng thái không tồn tại trong dữ liệu.
 */
const SU_CO: MachViec = {
  id: "su-co",
  ten: "Sự cố hiện trường",
  motCau:
    "Từ lúc có người thấy chuyện bất thường tới lúc đóng hồ sơ, mốc nào cũng có người đứng tên và có hạn xử lý đếm ngược.",
  buoc: [
    {
      id: "su-co-1-bao",
      thuTu: 1,
      ten: "Hiện trường báo sự cố",
      vai: ["employee", "manager"],
      noiLam: { kieu: "module", moduleId: "su-co" },
      nguonVao:
        "Người trực thấy tận mắt, hoặc camera AI tự bắt được rồi mở hồ sơ thay người.",
      ketQua:
        "Một hồ sơ có mức độ P1–P4 và hạn xử lý, bắt đầu đếm ngay từ lúc mở.",
      dangCho: [],
    },
    {
      id: "su-co-2-tiep-nhan",
      thuTu: 2,
      ten: "Quản lý tiếp nhận và giữ mốc SLA",
      vai: ["manager"],
      noiLam: { kieu: "module", moduleId: "su-co" },
      nguonVao: "Hồ sơ vừa mở, kèm mức độ và thời gian đã trôi.",
      ketQua: "Có người đứng tên điều phối; hồ sơ hết cảnh không ai nhận.",
      dangCho: ["reported"],
    },
    {
      id: "su-co-3-giao-to",
      thuTu: 3,
      ten: "Quản lý giao tổ phụ trách",
      vai: ["manager"],
      noiLam: { kieu: "module", moduleId: "su-co" },
      nguonVao: "Quy trình SOP hợp với loại sự cố này, cộng người đang có mặt trong ca.",
      ketQua: "Hồ sơ có tên người xử lý và mốc phải cập nhật tiếp theo.",
      dangCho: ["acknowledged"],
    },
    {
      id: "su-co-4-xu-ly",
      thuTu: 4,
      ten: "Tổ được giao xử lý rồi báo đã xong",
      vai: ["employee"],
      noiLam: { kieu: "module", moduleId: "su-co" },
      nguonVao:
        "Các bước checklist của SOP, cộng ảnh và biên bản chụp tại hiện trường.",
      ketQua:
        "Hồ sơ sang chờ xác minh. Chỉ đúng người được giao mới báo xong được, không ai báo hộ.",
      dangCho: ["in-progress"],
    },
    {
      id: "su-co-5-xac-minh",
      thuTu: 5,
      ten: "Quản lý xác minh và đóng",
      vai: ["manager"],
      noiLam: { kieu: "module", moduleId: "su-co" },
      nguonVao: "Kết quả tổ xử lý báo, cộng bằng chứng đã nộp để soi lại.",
      ketQua: "Đạt thì hồ sơ đóng kèm tổng thời gian. Chưa đạt thì trả về cho tổ làm tiếp.",
      dangCho: ["verification"],
    },
    {
      id: "su-co-6-dong",
      thuTu: 6,
      ten: "Đã đóng",
      vai: [],
      noiLam: { kieu: "module", moduleId: "su-co" },
      nguonVao: "Lượt xác minh của quản lý cơ sở.",
      ketQua:
        "Hồ sơ đóng kèm số phút đã mất. Về sau nhìn con số này là biết quy trình nào xử lý chậm.",
      dangCho: ["closed"],
    },
    {
      id: "su-co-nhanh-leo-thang",
      thuTu: null,
      ten: "Sự cố leo thang lên giám đốc",
      vai: ["director"],
      noiLam: { kieu: "trang", href: "/erp" },
      nguonVao:
        "Hồ sơ được gắn thêm dấu leo thang, nhưng vẫn ở nguyên bước đang xử lý.",
      ketQua:
        "Giám đốc thấy ngay ở trang chủ. Hồ sơ vẫn đi tiếp như thường; leo thang để giám đốc cùng theo dõi, không làm thay ai.",
      dangCho: [],
      nhanh: true,
    },
  ],
};

export const MACH_VIEC: readonly MachViec[] = [
  DONG_CA,
  CONG_NO_DOI_TAC,
  CHAM_CONG,
  DE_NGHI_NHAN_SU,
  NOP_QUY,
  SU_CO,
];

export function machViecTheoId(id: string): MachViec | null {
  return MACH_VIEC.find((mach) => mach.id === id) ?? null;
}

/** Những luồng có ít nhất một bước làm tại module này. */
export function machViecCuaModule(moduleId: string): MachViec[] {
  return MACH_VIEC.filter((mach) =>
    mach.buoc.some((b) => b.noiLam.kieu === "module" && b.noiLam.moduleId === moduleId),
  );
}

/** Những luồng có ít nhất một bước làm tại trang dùng chung này. */
export function machViecCuaTrang(href: string): MachViec[] {
  return MACH_VIEC.filter((mach) =>
    mach.buoc.some((b) => b.noiLam.kieu === "trang" && b.noiLam.href === href),
  );
}

/** Các bước trên đường chính, đã xếp theo thứ tự. */
export function buocChinh(mach: MachViec): MachViecBuoc[] {
  return mach.buoc
    .filter((b) => b.thuTu !== null)
    .sort((a, b) => (a.thuTu ?? 0) - (b.thuTu ?? 0));
}

export function buocNhanh(mach: MachViec): MachViecBuoc[] {
  return mach.buoc.filter((b) => b.thuTu === null);
}

/** Hồ sơ mang trạng thái này thì đang chờ bước nào. */
export function buocDangCho(mach: MachViec, status: string): MachViecBuoc | null {
  return mach.buoc.find((b) => b.dangCho.includes(status)) ?? null;
}

/**
 * Bước kế tiếp trên đường chính.
 *
 * Từ một nhánh rẽ thì không đoán bừa: nhánh trả về `null` và câu chữ ngoài
 * màn hình nói rõ "quay lại đường chính", vì đường về của mỗi nhánh mỗi khác.
 */
export function buocKeTiep(mach: MachViec, buoc: MachViecBuoc): MachViecBuoc | null {
  if (buoc.thuTu === null) return null;
  return buocChinh(mach).find((b) => (b.thuTu ?? 0) > (buoc.thuTu ?? 0)) ?? null;
}

/** Đường dẫn tới nơi làm một bước, trong ngữ cảnh một cơ sở. */
export function hrefCuaBuoc(buoc: MachViecBuoc, siteId: ErpSiteId): string {
  return buoc.noiLam.kieu === "trang"
    ? buoc.noiLam.href
    : `/erp/${siteId}/${buoc.noiLam.moduleId}`;
}

/**
 * Đếm hồ sơ đang nằm ở từng bước.
 *
 * Nhận thẳng danh sách trạng thái chứ không nhận hồ sơ, để tầng thuần này
 * không cần biết hồ sơ đóng ca và hoá đơn đối tác có hình dạng khác nhau.
 */
export function demTheoBuoc(
  mach: MachViec,
  trangThai: readonly string[],
): Map<string, number> {
  const dem = new Map<string, number>();
  for (const buoc of mach.buoc) dem.set(buoc.id, 0);
  for (const tt of trangThai) {
    const buoc = buocDangCho(mach, tt);
    if (buoc) dem.set(buoc.id, (dem.get(buoc.id) ?? 0) + 1);
  }
  return dem;
}

/** "Kế toán trưởng" / "Quản lý cơ sở hoặc Kế toán" / "Không ai — đã xong". */
export function dangChoAi(
  buoc: MachViecBuoc,
  nhanVai: (role: ErpRole) => string,
): string {
  if (buoc.vai.length === 0) return "Không ai, bước này đã xong";
  return buoc.vai.map(nhanVai).join(" hoặc ");
}

/** Vai này có phải người phải ra tay ở bước ấy không. */
export function denLuotVai(buoc: MachViecBuoc, role: ErpRole): boolean {
  return buoc.vai.includes(role);
}
