/**
 * Quét mã bằng camera điện thoại của nhân viên (TC-16).
 *
 * Camera chỉ là MỘT CÁCH NHẬP LIỆU MỚI cho đúng luồng quét đã có: đọc được mã
 * thì đổ vào ô quét, rồi mọi thứ chạy y như khi nhân viên gõ tay. Không có
 * đường quét thứ hai, không có hàm RPC nào mới. Quyền quét vẫn do
 * `erp_gate_actor_can_scan` gác, và mỗi lượt quét vẫn ghi ai quét, lúc nào.
 *
 * File này giữ phần QUYẾT ĐỊNH, cố ý tách khỏi component để kiểm thử được:
 * máy có mở nổi camera không, hỏng thì nói với nhân viên câu gì. Phần chạm
 * vào camera thật nằm ở `lib/erp/use-gate-camera-scanner.ts`.
 *
 * Nguyên tắc cứng: hỏng kiểu gì cũng KHÔNG được để nhân viên kẹt. Ô gõ tay
 * luôn còn đó, nên mỗi câu báo lỗi đều phải chỉ về đúng lối lui ấy.
 */

/** Ô quét đang đòi ít nhất 6 ký tự; camera dùng chung một mức để không lệch. */
export const MIN_SCANNED_CODE_LENGTH = 6;
/** Trần độ dài của bản quét ngoại tuyến, giữ nguyên cho cả hai đường nhập. */
export const MAX_SCANNED_CODE_LENGTH = 60;
/** Nhịp đọc khung hình. Dày hơn thì nóng máy, thưa hơn thì khách phải đứng chờ. */
export const CAMERA_SCAN_INTERVAL_MS = 350;
/** Chưa đọc ra gì sau chừng này thì mách nước, đừng để nhân viên đoán. */
export const CAMERA_SCAN_HINT_MS = 12_000;

export type CameraEnvironment = {
  /** `window.isSecureContext` — trình duyệt chỉ mở camera trên đường an toàn. */
  secureContext: boolean;
  /** Có `navigator.mediaDevices.getUserMedia` để xin hình từ camera. */
  mediaCapture: boolean;
  /** Có `BarcodeDetector` sẵn trong trình duyệt để đọc mã QR. */
  codeReader: boolean;
};

export type CameraBlockedReason = "insecure" | "no-camera-api" | "no-code-reader";

export type CameraReadiness =
  | { canScan: true }
  | { canScan: false; reason: CameraBlockedReason; message: string };

const BLOCKED_MESSAGES: Readonly<Record<CameraBlockedReason, string>> = Object.freeze({
  insecure:
    "Trình duyệt chỉ mở camera khi trang chạy trên đường truyền an toàn. Mời bạn mở lại địa chỉ bắt đầu bằng https, hoặc gõ mã vào ô bên dưới ạ.",
  "no-camera-api":
    "Trình duyệt trên máy này không mở được camera. Mời bạn gõ mã vào ô bên dưới ạ.",
  "no-code-reader":
    "Trình duyệt trên máy này chưa đọc được mã QR — iPhone và Safari đều chưa làm được. Mời bạn quét bằng máy Android dùng Chrome, hoặc gõ mã vào ô bên dưới ạ.",
});

/** Camera mở được nhưng phần đọc mã dựng không xong — hiếm, vẫn phải có câu trả lời. */
export const CAMERA_READER_BROKEN_MESSAGE =
  "Máy mở được camera nhưng chưa đọc được mã QR. Mời bạn gõ mã vào ô bên dưới ạ.";

/** Đưa mã vào khung mãi mà không ra gì: mách nước rồi vẫn để camera chạy tiếp. */
export const CAMERA_SCAN_HINT_MESSAGE =
  "Vẫn chưa đọc ra mã. Bạn đưa mã gần hơn, giữ máy yên một nhịp cho nét, hoặc gõ mã vào ô bên dưới ạ.";

const FAILURE_MESSAGES = Object.freeze({
  denied:
    "Máy chưa cho trang này dùng camera. Bạn vào cài đặt trình duyệt bật lại quyền camera, hoặc gõ mã vào ô bên dưới ạ.",
  missing:
    "Máy này không có camera nào dùng được. Mời bạn gõ mã vào ô bên dưới ạ.",
  busy:
    "Camera đang bận ở một ứng dụng khác. Bạn đóng ứng dụng đó rồi mở lại, hoặc gõ mã vào ô bên dưới ạ.",
  unknown:
    "Chưa mở được camera. Mời bạn gõ mã vào ô bên dưới ạ.",
});

/**
 * Ba lớp chặn, xét theo thứ tự sửa được: đường truyền → trình duyệt có mở nổi
 * camera không → trình duyệt có đọc nổi mã không. Máy không có camera thì
 * không lộ ra ở đây mà lộ lúc xin hình, nên `describeCameraFailure` bắt tiếp.
 */
export function readCameraReadiness(environment: CameraEnvironment): CameraReadiness {
  if (!environment.secureContext) {
    return { canScan: false, reason: "insecure", message: BLOCKED_MESSAGES.insecure };
  }
  if (!environment.mediaCapture) {
    return { canScan: false, reason: "no-camera-api", message: BLOCKED_MESSAGES["no-camera-api"] };
  }
  if (!environment.codeReader) {
    return { canScan: false, reason: "no-code-reader", message: BLOCKED_MESSAGES["no-code-reader"] };
  }
  return { canScan: true };
}

function readErrorName(error: unknown): string {
  if (typeof error === "object" && error !== null && "name" in error) {
    const name = (error as { name?: unknown }).name;
    if (typeof name === "string") return name;
  }
  return "";
}

/**
 * `getUserMedia` từ chối bằng một `DOMException` có tên riêng cho từng cớ. Gộp
 * hết vào một câu "bạn chưa cho phép dùng camera" là nói sai với người đang
 * cầm cái máy không có camera — họ sẽ đi tìm một cài đặt không tồn tại.
 */
export function describeCameraFailure(error: unknown): string {
  switch (readErrorName(error)) {
    case "NotAllowedError":
    case "PermissionDeniedError":
    case "SecurityError":
      return FAILURE_MESSAGES.denied;
    case "NotFoundError":
    case "DevicesNotFoundError":
    case "OverconstrainedError":
    case "ConstraintNotSatisfiedError":
      return FAILURE_MESSAGES.missing;
    case "NotReadableError":
    case "TrackStartError":
    case "AbortError":
      return FAILURE_MESSAGES.busy;
    default:
      return FAILURE_MESSAGES.unknown;
  }
}

/** Mã đọc từ khung hình chỉ được đổ vào ô quét khi vừa đúng khuôn ô ấy nhận. */
export function isUsableScannedCode(code: string): boolean {
  return code.length >= MIN_SCANNED_CODE_LENGTH && code.length <= MAX_SCANNED_CODE_LENGTH;
}
