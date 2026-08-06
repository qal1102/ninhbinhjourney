/**
 * Business rules live in PostgreSQL, so the reason a command was refused
 * arrives as a machine code raised by an RPC: `AP_MANAGER_ROLE_REQUIRED`,
 * `ACCOUNTING_PERIOD_IS_LOCKED`, and so on.
 *
 * Until this table existed, every one of those collapsed into the same
 * sentence at the action layer -- "Kho công nợ chưa phản hồi đầy đủ. Vui lòng
 * báo bộ phận hệ thống." That is wrong in two directions at once: it tells a
 * manager who simply lacks a permission that the system is broken, and it
 * hides a genuine outage inside a sentence people learn to ignore. It also
 * made the permission gate untestable from a browser, which is exactly how
 * three of four site managers stayed locked out of supplier AP unnoticed
 * (mục 3 in docs/HANDOFF.md).
 *
 * A refusal the user can act on is not an error message -- it is the product
 * working. Only codes absent from this table fall back to "contact support".
 */

const RPC_ERROR_MESSAGES: Readonly<Record<string, string>> = Object.freeze({
  // --- Quyền và phân tách nhiệm vụ ---
  AP_MANAGER_ROLE_REQUIRED:
    "Bạn chưa được ghi nhận là quản lý vận hành của cơ sở này nên không gửi được hóa đơn nhà cung cấp. Đề nghị giám đốc cấp lại vai trò trước khi thử lại.",
  AP_ACCOUNTANT_ROLE_REQUIRED:
    "Bước này thuộc về kế toán tổng hợp. Tài khoản của bạn chưa giữ vai trò đó.",
  AP_CHECKER_ROLE_REQUIRED:
    "Bước này thuộc về kế toán trưởng. Tài khoản của bạn chưa giữ vai trò đó.",
  AP_DIRECTOR_ROLE_REQUIRED:
    "Chỉ giám đốc mới quyết định được ngoại lệ này.",
  ACCOUNTING_MAKER_ROLE_REQUIRED:
    "Bước lập bút toán thuộc về kế toán tổng hợp. Tài khoản của bạn chưa giữ vai trò đó.",
  ACCOUNTING_CHECKER_ROLE_REQUIRED:
    "Bước duyệt bút toán thuộc về kế toán trưởng. Tài khoản của bạn chưa giữ vai trò đó.",
  ACCOUNTING_MAKER_CHECKER_SEPARATION_REQUIRED:
    "Người lập và người duyệt phải là hai người khác nhau. Hãy chuyển hồ sơ cho người có quyền duyệt.",
  ACCOUNTING_RETURNED_JOURNAL_WRONG_MAKER:
    "Bút toán bị trả về phải do chính người lập ban đầu chỉnh sửa lại.",

  // --- Trạng thái hồ sơ ---
  AP_INVOICE_NOT_FOUND: "Không tìm thấy hóa đơn trong phạm vi được giao.",
  AP_INVOICE_ALREADY_POSTED:
    "Hóa đơn đã ghi sổ nên không sửa được nữa. Muốn điều chỉnh phải lập bút toán đảo.",
  AP_INVOICE_NOT_READY_FOR_ACCOUNTING:
    "Hóa đơn chưa ở trạng thái sẵn sàng cho kế toán. Hãy tải lại danh sách.",
  AP_INVOICE_NOT_MATCH_EXCEPTION:
    "Hóa đơn không còn ở trạng thái lệch ba chiều. Hãy tải lại danh sách.",
  AP_INVOICE_NOT_RETURNED_TO_MANAGER:
    "Hóa đơn không ở trạng thái bị trả về cho quản lý. Hãy tải lại danh sách.",
  AP_INVOICE_NOT_PENDING_CHECKER:
    "Hóa đơn chưa chờ kế toán trưởng duyệt. Hãy tải lại danh sách.",
  AP_INVOICE_NOT_DIRECTOR_EXCEPTION:
    "Hồ sơ không ở trạng thái chờ giám đốc quyết định.",
  AP_INVOICE_TRANSITION_NOT_ALLOWED:
    "Bước chuyển trạng thái này không hợp lệ với quy trình công nợ.",
  AP_JOURNAL_STATE_NOT_PREPARABLE:
    "Bút toán của hóa đơn này không ở trạng thái lập được.",
  AP_JOURNAL_ALREADY_PENDING_CHECKER:
    "Bút toán đã chờ kế toán trưởng duyệt rồi.",
  AP_JOURNAL_NOT_FOUND: "Chưa có bút toán gắn với hóa đơn này.",
  ACCOUNTING_JOURNAL_NOT_FOUND: "Không tìm thấy bút toán.",
  ACCOUNTING_JOURNAL_NOT_PENDING_CHECKER:
    "Bút toán chưa ở trạng thái chờ duyệt.",
  ACCOUNTING_JOURNAL_STATE_NOT_PREPARABLE:
    "Bút toán không ở trạng thái lập được.",
  ACCOUNTING_JOURNAL_ALREADY_REVERSED: "Bút toán này đã được đảo trước đó.",
  ACCOUNTING_JOURNAL_ALREADY_PENDING_CHECKER:
    "Bút toán đã chờ kế toán trưởng duyệt rồi.",
  ACCOUNTING_SOURCE_NOT_READY:
    "Chứng từ gốc chưa đủ điều kiện để hạch toán.",
  ACCOUNTING_SOURCE_NOT_IN_REVIEW:
    "Chứng từ gốc không ở bước soát xét kế toán.",
  ACCOUNTING_SOURCE_ALREADY_POSTED: "Chứng từ gốc đã được ghi sổ.",
  ACCOUNTING_SHIFT_CLOSE_NOT_FOUND: "Không tìm thấy phiếu chốt ca tương ứng.",
  ACCOUNTING_CASH_DEPOSIT_NOT_FOUND: "Không tìm thấy lượt nộp quỹ tương ứng.",

  // --- Kỳ kế toán ---
  ACCOUNTING_PERIOD_IS_LOCKED:
    "Kỳ kế toán đã khóa. Muốn ghi nhận vào kỳ này phải mở khóa kỳ trước.",
  ACCOUNTING_PERIOD_NOT_FOUND:
    "Chưa mở kỳ kế toán cho tháng của chứng từ này.",
  ACCOUNTING_PERIOD_ALREADY_LOCKED: "Kỳ kế toán đã ở trạng thái khóa.",
  ACCOUNTING_PERIOD_ALREADY_OPEN: "Kỳ kế toán đang mở.",
  ACCOUNTING_PERIOD_HAS_OPEN_JOURNALS:
    "Không khóa được kỳ khi vẫn còn bút toán chưa ghi sổ.",
  ACCOUNTING_PERIOD_HAS_OPEN_AP_INVOICES:
    "Không khóa được kỳ khi vẫn còn hóa đơn nhà cung cấp chưa xử lý xong.",

  // --- Dữ liệu và cấu hình ---
  AP_SUPPLIER_NOT_FOUND:
    "Nhà cung cấp không thuộc cơ sở này hoặc đã ngừng hoạt động.",
  AP_POSTING_RULE_NOT_FOUND:
    "Chưa có quy tắc hạch toán cho nhóm chi phí và ngày hóa đơn này. Đề nghị kế toán bổ sung quy tắc trước.",
  AP_DUPLICATE_INVOICE:
    "Hóa đơn này đã tồn tại theo mã số thuế, ký hiệu và số hóa đơn.",
  AP_INVOICE_LINES_DO_NOT_MATCH_HEADER:
    "Tổng các dòng hóa đơn không khớp với phần tổng ở đầu hóa đơn.",
  AP_JOURNAL_NOT_BALANCED: "Bút toán chưa cân giữa bên nợ và bên có.",
  ACCOUNTING_JOURNAL_NOT_BALANCED:
    "Bút toán chưa cân giữa bên nợ và bên có.",
  ACCOUNTING_REVERSAL_NOT_BALANCED: "Bút toán đảo chưa cân.",
  ACCOUNTING_SOURCE_AMOUNT_INVALID:
    "Số tiền trên chứng từ gốc không hợp lệ.",
  CAPACITY_THRESHOLD_NOT_FOUND:
    "Không tìm thấy ngưỡng sức chứa cần cập nhật.",
  CAPACITY_DIRECTOR_REQUIRED:
    "Chỉ giám đốc mới được thay đổi giả định sức chứa.",
  CAPACITY_INPUT_INVALID:
    "Thông tin phương tiện, số chỗ, thời gian vòng hoặc nguồn chưa hợp lệ.",
  CAPACITY_VERSION_CONFLICT:
    "Ngưỡng sức chứa vừa được người khác cập nhật. Hãy tải lại trước khi tiếp tục.",

  // --- Ngoại lệ và ngưỡng ---
  AP_EXCEPTION_BELOW_DIRECTOR_THRESHOLD:
    "Sai lệch chưa tới ngưỡng cần giám đốc. Quản lý và kế toán tự xử lý ở bước trước.",
  AP_EXCEPTION_MUST_RETURN_TO_MANAGER:
    "Ngoại lệ này phải trả về quản lý cơ sở xử lý, không chuyển tiếp lên trên.",
  AP_NON_MONETARY_EXCEPTION_NOT_APPROVABLE:
    "Ngoại lệ không phải sai lệch tiền thì không duyệt bằng cách này; phải bổ sung chứng từ.",
  AP_MATCH_OR_DIRECTOR_APPROVAL_REQUIRED:
    "Hóa đơn còn lệch ba chiều nên cần giám đốc phê duyệt trước khi ghi nhận công nợ.",
  ACCOUNTING_DIRECTOR_APPROVAL_REQUIRED_FOR_DIFFERENCE:
    "Chênh lệch vượt ngưỡng, cần giám đốc phê duyệt trước khi ghi sổ.",
  SHIFT_CLOSE_POST_REQUIRES_CHECKER_APPROVED_JOURNAL:
    "Phải có bút toán đã được kế toán trưởng duyệt trước khi ghi sổ phiếu chốt ca.",

  // --- Bất biến ---
  AP_AUDIT_IS_APPEND_ONLY:
    "Nhật ký kiểm toán chỉ ghi thêm, không sửa và không xóa.",
  ACCOUNTING_AUDIT_IS_APPEND_ONLY:
    "Nhật ký kiểm toán chỉ ghi thêm, không sửa và không xóa.",
  AP_INVOICE_DELETE_NOT_ALLOWED: "Không được xóa hóa đơn đã vào hệ thống.",
  AP_INVOICE_IDENTITY_IMMUTABLE:
    "Không được đổi định danh của hóa đơn đã tạo.",
  AP_POSTED_SOURCE_IMMUTABLE: "Chứng từ đã ghi sổ không sửa được.",
  AP_INVOICE_LINES_IMMUTABLE_AFTER_ACCOUNTING:
    "Không sửa được dòng hóa đơn sau khi kế toán đã tiếp nhận.",
  ACCOUNTING_POSTED_JOURNAL_IMMUTABLE: "Bút toán đã ghi sổ không sửa được.",
  ACCOUNTING_POSTED_JOURNAL_LINES_IMMUTABLE:
    "Dòng của bút toán đã ghi sổ không sửa được.",
  ACCOUNTING_JOURNAL_DELETE_NOT_ALLOWED: "Không được xóa bút toán.",
  ACCOUNTING_JOURNAL_IDENTITY_IMMUTABLE:
    "Không được đổi định danh của bút toán.",
  CAPACITY_AUDIT_IMMUTABLE:
    "Lịch sử cấu hình sức chứa chỉ ghi thêm, không sửa và không xoá.",
  ACCOUNTING_PERIOD_DELETE_NOT_ALLOWED: "Không được xóa kỳ kế toán.",
  ACCOUNTING_PERIOD_IDENTITY_IMMUTABLE:
    "Không được đổi định danh của kỳ kế toán.",
  ACCOUNTING_ONLY_POSTED_ORIGINAL_CAN_BE_REVERSED:
    "Chỉ đảo được bút toán gốc đã ghi sổ.",
  ACCOUNTING_POSTED_SOURCE_REQUIRED_FOR_REVERSAL:
    "Phải có chứng từ gốc đã ghi sổ mới lập được bút toán đảo.",
  ACCOUNTING_REVERSAL_SOURCE_TYPE_NOT_SUPPORTED:
    "Nguồn bút toán này chưa hỗ trợ đảo bút toán.",
  AP_JOURNAL_REQUIRES_AP_WORKFLOW:
    "Bút toán công nợ phải đi theo quy trình hóa đơn nhà cung cấp.",

  // --- Đầu vào ---
  AP_SUBMIT_INPUT_INVALID: "Dữ liệu hóa đơn gửi lên chưa hợp lệ.",
  AP_RESUBMIT_INPUT_INVALID: "Dữ liệu bổ sung chưa hợp lệ.",
  AP_ESCALATE_INPUT_INVALID: "Dữ liệu chuyển cấp chưa hợp lệ.",
  AP_DIRECTOR_DECISION_INPUT_INVALID: "Dữ liệu quyết định chưa hợp lệ.",
  AP_ACCOUNTING_PREPARE_INPUT_INVALID: "Dữ liệu lập bút toán chưa hợp lệ.",
  AP_ACCOUNTING_REVIEW_INPUT_INVALID: "Dữ liệu soát xét chưa hợp lệ.",
  ACCOUNTING_PREPARE_INPUT_INVALID: "Dữ liệu lập bút toán chưa hợp lệ.",
  ACCOUNTING_REVIEW_INPUT_INVALID: "Dữ liệu soát xét chưa hợp lệ.",
  ACCOUNTING_REVERSAL_INPUT_INVALID: "Dữ liệu bút toán đảo chưa hợp lệ.",
  ACCOUNTING_PERIOD_COMMAND_INPUT_INVALID: "Dữ liệu thao tác kỳ chưa hợp lệ.",
  ATTENDANCE_INPUT_INVALID: "Dữ liệu chấm công chưa hợp lệ.",
  ATTENDANCE_ALREADY_CHECKED_IN: "Bạn đang trong ca, không cần chấm vào nữa.",
  ATTENDANCE_NO_OPEN_CHECK_IN: "Chưa có ca nào đang mở để chấm ra.",
  ATTENDANCE_SITE_TENANT_MISMATCH: "Cơ sở chấm công không thuộc đơn vị này.",
  EMPLOYEE_ACCESS_ACTOR_INVALID: "Tài khoản thao tác không hợp lệ.",
  EMPLOYEE_ACCESS_SITE_TENANT_MISMATCH: "Cơ sở không thuộc đơn vị này.",
  EMPLOYEE_ACCESS_TOO_MANY_MODULES:
    "Vượt quá số nghiệp vụ tối đa cấp được cho một người.",

  // --- Chốt ca ---
  SHIFT_CLOSE_WORKFLOW_NOT_FOUND: "Không tìm thấy phiếu chốt ca.",
  SHIFT_CLOSE_TRANSITION_NOT_ALLOWED:
    "Bước này không hợp lệ với trạng thái hiện tại của phiếu chốt ca.",
  SHIFT_CLOSE_ACTION_DOES_NOT_MATCH_ACTOR_ROLE:
    "Vai trò của bạn không thực hiện được bước này của quy trình chốt ca.",
  SHIFT_CLOSE_TRANSITION_ACTOR_IS_INVALID:
    "Người thực hiện bước chốt ca không hợp lệ.",
  SHIFT_CLOSE_CREATE_ROLE_OR_STATUS_IS_INVALID:
    "Vai trò hoặc trạng thái khởi tạo phiếu chốt ca không hợp lệ.",
  SHIFT_CLOSE_VERSION_CONFLICT:
    "Phiếu chốt ca vừa được người khác cập nhật. Hãy tải lại trước khi tiếp tục.",
  SHIFT_CLOSE_VERSION_MUST_INCREMENT: "Phiên bản phiếu chốt ca phải tăng.",
  SHIFT_CLOSE_IDEMPOTENCY_CONFLICT:
    "Thao tác này đã được gửi với nội dung khác. Hãy tải lại và thử lại.",
  SHIFT_CLOSE_IDENTITY_IS_IMMUTABLE:
    "Không được đổi định danh của phiếu chốt ca.",
  SHIFT_CLOSE_ID_AND_VERSION_ARE_REQUIRED:
    "Thiếu mã phiếu hoặc phiên bản phiếu chốt ca.",
  SHIFT_CLOSE_PAYLOAD_MUST_BE_AN_OBJECT: "Dữ liệu phiếu chốt ca không hợp lệ.",
  SHIFT_CLOSE_PRODUCT_MIX_OR_EVIDENCE_IS_INVALID:
    "Cơ cấu vé hoặc chứng từ kèm theo chưa hợp lệ.",
  SHIFT_CLOSE_SCOPE_AND_TIME_ARE_REQUIRED:
    "Thiếu phạm vi hoặc khung giờ của ca.",
  SHIFT_CLOSE_SCOPE_OR_TIME_IS_INVALID:
    "Phạm vi hoặc khung giờ của ca không hợp lệ.",
  SHIFT_CLOSE_TRANSITION_METADATA_IS_INVALID:
    "Thông tin kèm theo bước chuyển không hợp lệ.",
  SHIFT_CLOSE_ACTOR_OR_IDEMPOTENCY_IS_INVALID:
    "Người thao tác hoặc khóa chống trùng không hợp lệ.",
  SHIFT_CLOSE_SITE_TENANT_MISMATCH: "Cơ sở không thuộc đơn vị này.",

  // --- Phiếu công việc ---
  WORKDAY_NOT_FOUND: "Không tìm thấy phiếu công việc.",
  WORKDAY_WRONG_EMPLOYEE: "Phiếu công việc này không giao cho bạn.",
  WORKDAY_WRONG_MANAGER:
    "Chỉ quản lý đã giao phiếu này mới nghiệm thu được.",
  WORKDAY_ALREADY_ASSIGNED: "Phiếu công việc này đã được giao rồi.",
  WORKDAY_TRANSITION_NOT_ALLOWED:
    "Bước này không hợp lệ với trạng thái hiện tại của phiếu công việc.",
  WORKDAY_TRANSITION_INPUT_INVALID: "Dữ liệu chuyển bước chưa hợp lệ.",
  WORKDAY_ASSIGN_PAYLOAD_INVALID: "Dữ liệu giao việc chưa hợp lệ.",
  WORKDAY_ASSIGN_ACTOR_OR_KEY_INVALID:
    "Người giao việc hoặc khóa chống trùng không hợp lệ.",
  WORKDAY_PROGRESS_INVALID: "Tiến độ báo cáo không hợp lệ.",
  WORKDAY_EVIDENCE_REQUIRED:
    "Bước này bắt buộc có bằng chứng hiện trường kèm theo.",
  WORKDAY_FINAL_EVIDENCE_REQUIRED:
    "Phải có bằng chứng ở bước cuối trước khi kết thúc phiếu.",
  WORKDAY_EVIDENCE_MUST_BE_NEW:
    "Bằng chứng phải chụp mới, không dùng lại ảnh đã nộp.",
  WORKDAY_RETURNED_EVIDENCE_NOT_FRESH:
    "Phiếu bị trả về phải nộp bằng chứng mới, không dùng lại ảnh cũ.",
  WORKDAY_EVIDENCE_IMMUTABLE: "Bằng chứng đã nộp không sửa được.",
  WORKDAY_EVIDENCE_INVALID: "Bằng chứng kèm theo không hợp lệ.",
  WORKDAY_EVIDENCE_APPEND_INVALID: "Không thêm được bằng chứng vào phiếu này.",
  WORKDAY_EVIDENCE_IDENTITY_INVALID: "Định danh bằng chứng không hợp lệ.",
  WORKDAY_EVIDENCE_LOCATION_INVALID: "Tọa độ của bằng chứng không hợp lệ.",
  WORKDAY_EVIDENCE_OUTSIDE_GEOFENCE:
    "Bằng chứng được chụp ngoài phạm vi cho phép của cơ sở.",
  WORKDAY_CHECK_IN_OUTSIDE_GEOFENCE:
    "Bạn đang ở ngoài phạm vi cho phép của cơ sở nên chưa nhận việc được.",
  WORKDAY_CHECK_IN_ACCURACY_INVALID:
    "Định vị chưa đủ chính xác. Hãy ra chỗ thoáng và thử lại.",
  WORKDAY_GEOFENCE_NOT_FOUND: "Cơ sở này chưa khai báo phạm vi định vị.",
  WORKDAY_LOCATION_INPUT_INVALID: "Dữ liệu định vị không hợp lệ.",
  WORKDAY_LOCATION_NOT_ALLOWED: "Vị trí này không được phép cho bước đang làm.",
  WORKDAY_VERSION_CONFLICT:
    "Phiếu công việc vừa được người khác cập nhật. Hãy tải lại trước khi tiếp tục.",
  WORKDAY_VERSION_MUST_INCREMENT: "Phiên bản phiếu công việc phải tăng.",
  WORKDAY_IDEMPOTENCY_CONFLICT:
    "Thao tác này đã được gửi với nội dung khác. Hãy tải lại và thử lại.",
  WORKDAY_IDENTITY_IS_IMMUTABLE: "Không được đổi định danh của phiếu công việc.",
  WORKDAY_SITE_TENANT_MISMATCH: "Cơ sở không thuộc đơn vị này.",

  // --- Sự cố ---
  INCIDENT_NOT_FOUND: "Không tìm thấy hồ sơ sự cố.",
  INCIDENT_NOT_ASSIGNED: "Hồ sơ sự cố này không được giao cho bạn.",
  INCIDENT_NO_TRANSITION:
    "Hồ sơ sự cố không chuyển tiếp được từ trạng thái hiện tại.",
  INCIDENT_ACTOR_INVALID: "Người xử lý sự cố không hợp lệ.",
  INCIDENT_SITE_INVALID: "Cơ sở của sự cố không hợp lệ.",
  INCIDENT_TENANT_MISMATCH: "Cơ sở không thuộc đơn vị này.",
  INCIDENT_CAMERA_INPUT_INVALID: "Dữ liệu cảnh báo camera chưa hợp lệ.",

  // --- Dự án và sự kiện ---
  PROJECT_WORK_ITEM_NOT_FOUND: "Không tìm thấy gói việc.",
  PROJECT_WORK_ITEM_NO_TRANSITION:
    "Gói việc không chuyển tiếp được từ trạng thái hiện tại.",
  PROJECT_WORK_ITEM_SELF_ACCEPT:
    "Người gửi nghiệm thu và người xác nhận phải là hai người khác nhau.",
  PROJECT_WORK_ITEM_DEPENDENCY_NOT_DONE:
    "Còn gói việc phụ thuộc chưa hoàn thành nên chưa gửi nghiệm thu được.",
  PROJECT_BLOCKER_REASON_REQUIRED: "Phải nêu lý do khi báo tắc.",
  PROJECT_ACTOR_INVALID: "Người thao tác không hợp lệ.",
  PROJECT_ACTOR_NOT_ALLOWED: "Vai trò của bạn không thực hiện được bước này.",
  PROJECT_CHANGE_NOT_FOUND: "Không tìm thấy yêu cầu thay đổi.",
  PROJECT_CHANGE_ALREADY_DECIDED: "Yêu cầu này đã được quyết định trước đó.",
  PROJECT_CHANGE_BUDGET_REQUIRED:
    "Yêu cầu đổi ngân sách phải ghi rõ mức ngân sách đề xuất.",
  PROJECT_CHANGE_DATE_REQUIRED:
    "Yêu cầu đổi mốc thời gian phải ghi rõ ngày đề xuất.",
  PROJECT_SETTLEMENT_NOT_ELIGIBLE:
    "Chỉ quyết toán được gói việc đã nghiệm thu và có yêu cầu quyết toán.",
  PROJECT_EVENT_TENANT_MISMATCH: "Sự kiện không thuộc đơn vị này.",

  // --- Hiện trường, cổng soát vé, đổi vai trò ---
  FIELD_REPORT_ACTOR_INVALID: "Người gửi báo cáo hiện trường không hợp lệ.",
  FIELD_REPORT_SITE_TENANT_MISMATCH: "Cơ sở không thuộc đơn vị này.",
  GATE_SCAN_CODE_INVALID: "Mã quét không hợp lệ.",
  GATE_SCAN_SITE_TENANT_MISMATCH: "Cơ sở không thuộc đơn vị này.",
  ROLE_SWITCH_ACTOR_INVALID: "Tài khoản không được phép đổi vai trò trình diễn.",
  ROLE_SWITCH_TENANT_MISMATCH: "Cơ sở không thuộc đơn vị này.",

  // --- Khóa phiên bản và chống trùng ---
  AP_INVOICE_VERSION_CONFLICT:
    "Hồ sơ vừa được người khác cập nhật. Hãy tải lại trước khi tiếp tục.",
  AP_INVOICE_VERSION_MUST_INCREMENT: "Phiên bản hóa đơn phải tăng.",
  AP_IDEMPOTENCY_CONFLICT:
    "Thao tác này đã được gửi với nội dung khác. Hãy tải lại và thử lại.",
  ACCOUNTING_IDEMPOTENCY_CONFLICT:
    "Thao tác này đã được gửi với nội dung khác. Hãy tải lại và thử lại.",
  ACCOUNTING_JOURNAL_VERSION_CONFLICT:
    "Bút toán vừa được người khác cập nhật. Hãy tải lại trước khi tiếp tục.",
  ACCOUNTING_JOURNAL_VERSION_MUST_INCREMENT: "Phiên bản bút toán phải tăng.",
  ACCOUNTING_JOURNAL_TRANSITION_NOT_ALLOWED:
    "Bước chuyển trạng thái này không hợp lệ với bút toán.",
  ACCOUNTING_PERIOD_VERSION_CONFLICT:
    "Kỳ kế toán vừa được người khác cập nhật. Hãy tải lại trước khi tiếp tục.",
  ACCOUNTING_PERIOD_VERSION_MUST_INCREMENT: "Phiên bản kỳ kế toán phải tăng.",
  ACCOUNTING_PERIOD_TRANSITION_NOT_ALLOWED:
    "Bước chuyển trạng thái này không hợp lệ với kỳ kế toán.",
  ACCOUNTING_SOURCE_VERSION_CONFLICT:
    "Chứng từ gốc vừa được người khác cập nhật. Hãy tải lại trước khi tiếp tục.",
  AP_EXCEPTION_REQUIRES_ACCOUNTANT_VERIFICATION:
    "Ngoại lệ phải được kế toán kiểm tra trước khi trình giám đốc.",

  // --- Thanh toán nhà cung cấp ---
  AP_INVOICE_NOT_PAYABLE:
    "Chỉ hóa đơn đã ghi nhận công nợ mới lập được đề nghị chi.",
  AP_INVOICE_NOT_PENDING_PAYMENT: "Hóa đơn không còn chờ duyệt chi.",
  AP_PAYMENT_INPUT_INVALID: "Thông tin đề nghị chi chưa hợp lệ.",
  AP_PAYMENT_AMOUNT_INVALID:
    "Số tiền chi phải lớn hơn 0 và không vượt giá trị hóa đơn.",

  // --- Bàn giao ca ---
  SHIFT_HANDOVER_NOT_FOUND: "Không tìm thấy phiếu bàn giao ca.",
  SHIFT_HANDOVER_INPUT_INVALID: "Dữ liệu bàn giao ca chưa hợp lệ.",
  SHIFT_HANDOVER_SAME_PERSON:
    "Người bàn giao và người nhận ca phải là hai người khác nhau.",
  SHIFT_HANDOVER_WRONG_ACTOR:
    "Chỉ người được bàn giao mới xác nhận nhận ca được.",
  SHIFT_HANDOVER_ALREADY_DECIDED: "Phiếu bàn giao này đã được xử lý.",
  SHIFT_HANDOVER_DISPUTE_NEEDS_REASON: "Từ chối nhận ca phải nêu lý do.",
  SHIFT_HANDOVER_VERSION_CONFLICT:
    "Phiếu bàn giao vừa được cập nhật. Hãy tải lại trước khi tiếp tục.",
  SHIFT_HANDOVER_SITE_TENANT_MISMATCH: "Cơ sở không thuộc đơn vị này.",

  // --- Quản trị tài khoản ---
  ACCOUNT_ADMIN_ROLE_REQUIRED:
    "Chỉ tài khoản có quyền quản trị hệ thống mới tạo, khoá hoặc cấp vai trò được.",
  ACCOUNT_ADMIN_ACCOUNT_NOT_FOUND: "Không tìm thấy tài khoản này.",
  ACCOUNT_ADMIN_INPUT_INVALID: "Thông tin tài khoản chưa hợp lệ.",
  ACCOUNT_ADMIN_SITE_TENANT_MISMATCH: "Cơ sở không thuộc đơn vị này.",
  ACCOUNT_ADMIN_CANNOT_LOCK_SELF:
    "Không tự khoá hoặc tự thu hồi quyền quản trị của chính mình được — sẽ không còn đường mở lại.",
  ACCOUNT_ADMIN_EMAIL_ALREADY_LINKED:
    "Email này đã được dùng để đăng nhập cho một tài khoản khác.",
  PROFILE_MANAGER_SCOPE_REQUIRED:
    "Bạn chỉ sửa được hồ sơ của nhân sự thuộc cơ sở mình quản lý.",
  PROFILE_INPUT_INVALID: "Thông tin hồ sơ chưa hợp lệ.",
  PROFILE_ACCOUNT_NOT_FOUND: "Không tìm thấy tài khoản này.",

  // --- Thương mại (stack /ops) ---
  CAPACITY_UNAVAILABLE: "Khung giờ này đã hết chỗ.",
  QUOTE_EXPIRED: "Báo giá đã hết hiệu lực. Hãy tạo lại báo giá mới.",

  // --- Đối soát tiền mặt (T10b) ---
  CASH_DEPOSIT_INPUT_INVALID: "Thông tin lượt nộp quỹ chưa hợp lệ.",
  CASH_ACCOUNTANT_ROLE_REQUIRED:
    "Bạn chưa được ghi nhận là kế toán tại cơ sở này.",
  CASH_SHIFT_NOT_POSTED_OR_NOT_FOUND:
    "Có ca chưa chốt xong hoặc không thuộc cơ sở này trong danh sách chọn.",
  CASH_DEPOSIT_AMOUNT_MUST_BE_POSITIVE:
    "Tổng tiền mặt của các ca đã chọn phải lớn hơn 0.",
  CASH_SHIFT_ALREADY_DEPOSITED:
    "Có ca đã được gộp vào một lượt nộp khác rồi — mỗi ca chỉ nộp một lần.",
  CASH_DEPOSIT_NOT_FOUND: "Không tìm thấy lượt nộp quỹ này.",
  CASH_DEPOSIT_VERSION_CONFLICT:
    "Lượt nộp quỹ vừa được cập nhật. Hãy tải lại trước khi tiếp tục.",
  CASH_DEPOSIT_NOT_MATCHABLE:
    "Lượt nộp quỹ không còn ở trạng thái chờ đối khớp.",
  CASH_STATEMENT_LINE_INPUT_INVALID: "Thông tin dòng sao kê chưa hợp lệ.",
  CASH_STATEMENT_LINE_NOT_FOUND: "Không tìm thấy dòng sao kê này.",
  CASH_STATEMENT_LINE_ACCOUNT_MISMATCH:
    "Dòng sao kê không cùng tài khoản ngân hàng hoặc cơ sở với lượt nộp.",
  CASH_STATEMENT_LINE_VERSION_CONFLICT:
    "Dòng sao kê vừa được cập nhật. Hãy tải lại trước khi tiếp tục.",
  CASH_STATEMENT_LINE_NOT_AVAILABLE:
    "Dòng sao kê này đã được khớp với một lượt nộp khác.",
  CASH_MATCH_INPUT_INVALID: "Thông tin đối khớp chưa hợp lệ.",
  CASH_JOURNAL_REQUIRES_CASH_WORKFLOW:
    "Bút toán của lượt nộp quỹ chỉ được sửa qua luồng đối soát tiền mặt.",
  CASH_EXCEPTION_INPUT_INVALID: "Thông tin quyết định ngoại lệ chưa hợp lệ.",
  CASH_CHECKER_OR_DIRECTOR_ROLE_REQUIRED:
    "Chỉ kế toán trưởng hoặc giám đốc mới quyết định được ngoại lệ chênh lệch.",
  CASH_DEPOSIT_NOT_PENDING_EXCEPTION_DECISION:
    "Lượt nộp quỹ không còn chờ quyết định ngoại lệ.",
  CASH_REVIEW_INPUT_INVALID: "Thông tin duyệt bút toán chưa hợp lệ.",
  CASH_CHECKER_ROLE_REQUIRED:
    "Bạn chưa được ghi nhận là kế toán trưởng tại cơ sở này.",
  CASH_DEPOSIT_NOT_PENDING_REVIEW:
    "Lượt nộp quỹ không còn chờ kế toán trưởng ghi sổ.",
  CASH_JOURNAL_NOT_PENDING_CHECKER: "Bút toán không còn chờ duyệt.",
  CASH_JOURNAL_VERSION_CONFLICT:
    "Bút toán vừa được cập nhật. Hãy tải lại trước khi tiếp tục.",
  CASH_JOURNAL_NOT_BALANCED: "Bút toán chưa cân đối Nợ và Có.",
});

/**
 * Codes that mean "you cannot do this", as opposed to "the system is having a
 * problem". They are shown verbatim to the user and must never be logged as
 * an incident: a refused command is a normal outcome of a controlled workflow.
 */
export function isBusinessRuleCode(code: string): boolean {
  return Object.hasOwn(RPC_ERROR_MESSAGES, code);
}

/**
 * Pulls the first known business code out of whatever PostgREST handed back --
 * `error.message`, `error.details` or `error.hint`, since the wrapping differs
 * per transport -- and returns the sentence for it.
 */
export function findRpcBusinessMessage(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  const source = error as {
    message?: unknown;
    details?: unknown;
    hint?: unknown;
  };
  const haystack = [source.message, source.details, source.hint]
    .filter((value): value is string => typeof value === "string")
    .join(" | ");
  if (!haystack) return null;

  // Longest first, so `AP_INVOICE_NOT_READY_FOR_ACCOUNTING` is never matched
  // as the shorter `AP_INVOICE_NOT_FOUND`-style prefix of another code.
  const match = Object.keys(RPC_ERROR_MESSAGES)
    .sort((left, right) => right.length - left.length)
    .find((code) => haystack.includes(code));
  return match ? RPC_ERROR_MESSAGES[match] : null;
}
