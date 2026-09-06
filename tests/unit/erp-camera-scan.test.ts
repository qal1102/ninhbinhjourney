import { describe, expect, it } from "vitest";
import {
  CAMERA_SCAN_HINT_MS,
  CAMERA_SCAN_INTERVAL_MS,
  MAX_SCANNED_CODE_LENGTH,
  MIN_SCANNED_CODE_LENGTH,
  describeCameraFailure,
  isUsableScannedCode,
  readCameraReadiness,
  type CameraEnvironment,
} from "@/domain/erp-camera-scan";

const READY: CameraEnvironment = { secureContext: true, mediaCapture: true, codeReader: true };

describe("readCameraReadiness", () => {
  it("cho quét khi máy có đủ đường an toàn, camera và bộ đọc mã", () => {
    expect(readCameraReadiness(READY)).toEqual({ canScan: true });
  });

  it("chặn khi trang không chạy trên đường truyền an toàn", () => {
    const readiness = readCameraReadiness({ ...READY, secureContext: false });
    expect(readiness.canScan).toBe(false);
    if (readiness.canScan) return;
    expect(readiness.reason).toBe("insecure");
    expect(readiness.message).toContain("https");
  });

  it("chặn khi trình duyệt không mở được camera", () => {
    const readiness = readCameraReadiness({ ...READY, mediaCapture: false });
    expect(readiness.canScan).toBe(false);
    if (readiness.canScan) return;
    expect(readiness.reason).toBe("no-camera-api");
  });

  it("chặn khi trình duyệt không đọc được mã — đúng trường hợp iPhone và Safari", () => {
    const readiness = readCameraReadiness({ ...READY, codeReader: false });
    expect(readiness.canScan).toBe(false);
    if (readiness.canScan) return;
    expect(readiness.reason).toBe("no-code-reader");
    // Nhân viên cầm iPhone phải đọc ra ngay là máy mình chưa quét được.
    expect(readiness.message).toContain("iPhone");
  });

  it("xét đường truyền trước, vì đó là thứ sửa được sớm nhất", () => {
    const readiness = readCameraReadiness({
      secureContext: false,
      mediaCapture: false,
      codeReader: false,
    });
    expect(readiness.canScan).toBe(false);
    if (readiness.canScan) return;
    expect(readiness.reason).toBe("insecure");
  });

  it("mọi câu chặn đều chỉ về ô gõ tay, để nhân viên không kẹt ở cổng", () => {
    for (const broken of [
      { ...READY, secureContext: false },
      { ...READY, mediaCapture: false },
      { ...READY, codeReader: false },
    ]) {
      const readiness = readCameraReadiness(broken);
      expect(readiness.canScan).toBe(false);
      if (readiness.canScan) continue;
      expect(readiness.message).toContain("gõ mã vào ô bên dưới");
    }
  });
});

describe("describeCameraFailure", () => {
  it("nói đúng chuyện chưa được cấp quyền", () => {
    for (const name of ["NotAllowedError", "PermissionDeniedError", "SecurityError"]) {
      expect(describeCameraFailure(new DOMException("", name))).toContain("quyền camera");
    }
  });

  it("nói đúng chuyện máy không có camera, không đổ oan cho người dùng", () => {
    // Bản cũ gộp mọi cớ vào một câu "bạn chưa cho phép dùng camera", khiến
    // người cầm máy không có camera đi tìm một cài đặt không tồn tại.
    for (const name of ["NotFoundError", "DevicesNotFoundError", "OverconstrainedError"]) {
      const message = describeCameraFailure(new DOMException("", name));
      expect(message).toContain("không có camera");
      expect(message).not.toContain("quyền camera");
    }
  });

  it("nói đúng chuyện camera đang bận ở ứng dụng khác", () => {
    for (const name of ["NotReadableError", "TrackStartError", "AbortError"]) {
      expect(describeCameraFailure(new DOMException("", name))).toContain("đang bận");
    }
  });

  it("lỗi lạ vẫn có một câu tử tế, không để màn hình im lặng", () => {
    for (const error of [new Error("lạ"), "hỏng", null, undefined, {}]) {
      expect(describeCameraFailure(error)).toBe("Chưa mở được camera. Mời bạn gõ mã vào ô bên dưới ạ.");
    }
  });

  it("câu nào cũng chỉ về ô gõ tay", () => {
    for (const name of ["NotAllowedError", "NotFoundError", "NotReadableError", "LaLungError"]) {
      expect(describeCameraFailure(new DOMException("", name))).toContain("gõ mã vào ô bên dưới");
    }
  });
});

describe("isUsableScannedCode", () => {
  it("nhận mã đúng khuôn ô quét đang dùng", () => {
    expect(isUsableScannedCode("TA-2026-000101")).toBe(true);
    expect(isUsableScannedCode("WEB-A1B2C3D4E5F6")).toBe(true);
  });

  it("bỏ qua mã quá ngắn thay vì đổ rác vào ô quét", () => {
    // Đọc nhầm một mảnh mã thì vòng quét chạy tiếp, không cắt ngang nhân viên.
    expect(isUsableScannedCode("")).toBe(false);
    expect(isUsableScannedCode("ABC12")).toBe(false);
    expect(isUsableScannedCode("ABC123")).toBe(true);
  });

  it("bỏ qua mã dài quá trần mà hàng đợi ngoại tuyến nhận", () => {
    expect(isUsableScannedCode("A".repeat(MAX_SCANNED_CODE_LENGTH))).toBe(true);
    expect(isUsableScannedCode("A".repeat(MAX_SCANNED_CODE_LENGTH + 1))).toBe(false);
  });

  it("giữ đúng hai mốc mà hai màn hình cổng cùng dùng", () => {
    expect(MIN_SCANNED_CODE_LENGTH).toBe(6);
    expect(MAX_SCANNED_CODE_LENGTH).toBe(60);
  });
});

describe("nhịp quét", () => {
  it("đọc đủ nhanh để khách không phải đứng chờ, và mách nước trước khi họ sốt ruột", () => {
    expect(CAMERA_SCAN_INTERVAL_MS).toBeLessThanOrEqual(500);
    expect(CAMERA_SCAN_HINT_MS).toBeGreaterThan(CAMERA_SCAN_INTERVAL_MS * 10);
    expect(CAMERA_SCAN_HINT_MS).toBeLessThanOrEqual(20_000);
  });
});
