"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CAMERA_READER_BROKEN_MESSAGE,
  CAMERA_SCAN_HINT_MESSAGE,
  CAMERA_SCAN_HINT_MS,
  CAMERA_SCAN_INTERVAL_MS,
  describeCameraFailure,
  isUsableScannedCode,
  readCameraReadiness,
  type CameraEnvironment,
} from "@/domain/erp-camera-scan";
import { normalizeScannedCode } from "@/lib/erp/offline-gate-store";

/**
 * Camera đọc mã cho hai màn hình cổng: `ticket-guest-workspace` (có mạng) và
 * `offline-gate-console` (mất mạng). Trước đây mỗi màn hình giữ một bản sao,
 * nên vá một chỗ là chỗ kia lệch ngay. Gom về đây, và phần quyết định thì nằm
 * ở `domain/erp-camera-scan.ts` để kiểm thử được.
 *
 * Camera phải tắt hẳn khi đọc xong, khi bấm đóng và khi rời màn hình. Để đèn
 * camera sáng nền vừa tốn pin vừa làm khách đứng trước cổng nghi ngại.
 */

type BarcodeDetectorLike = {
  detect(source: HTMLVideoElement): Promise<Array<{ rawValue: string }>>;
};
type BarcodeDetectorConstructor = new (input?: {
  formats?: string[];
}) => BarcodeDetectorLike;

type WindowWithDetector = Window & { BarcodeDetector?: BarcodeDetectorConstructor };

function readEnvironment(): CameraEnvironment {
  if (typeof window === "undefined") {
    return { secureContext: false, mediaCapture: false, codeReader: false };
  }
  return {
    // Trình duyệt cũ không có `isSecureContext`; đừng vì thiếu nó mà chặn oan.
    secureContext: window.isSecureContext !== false,
    mediaCapture: typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia),
    // Máy nào cũng đọc được mã: không có bộ đọc của trình duyệt thì đã có
    // lối lui `jsqr`. Giữ cờ này để phần quyết định vẫn kiểm được.
    codeReader: true,
  };
}

/**
 * Dựng bộ đọc mã TRƯỚC khi xin camera. Dựng hỏng thì đèn camera không bật lên
 * một giây nào, và nhân viên nhận câu trả lời ngay thay vì nhìn khung hình
 * chạy mãi mà chẳng ra mã.
 */
async function createCodeReader(): Promise<BarcodeDetectorLike | null> {
  const Detector = (window as WindowWithDetector).BarcodeDetector;
  if (Detector) {
    try {
      return new Detector({ formats: ["qr_code"] });
    } catch {
      // Rơi xuống lối lui bên dưới thay vì bỏ cuộc: có máy khai có
      // `BarcodeDetector` nhưng dựng lên là hỏng.
    }
  }
  return createFallbackReader();
}

/**
 * Lối lui cho iPhone và Safari — chúng không có `BarcodeDetector`.
 *
 * Chọn `jsqr` (Apache-2.0, 45 KB nén, không kéo theo gì) thay vì bản vá
 * `barcode-detector`. Bản vá kia chỉ 15 KB nhưng kéo theo một tệp wasm 448 KB
 * và **mặc định tải nó từ CDN ngoài lúc chạy**. Máy ở cổng chạy 4G, và đó là
 * lúc đang thu tiền của khách — một cuộc gọi ra mạng ngoài ngay lúc ấy là rủi
 * ro vận hành, không phải rủi ro kỹ thuật.
 *
 * Nạp động: máy Android có sẵn bộ đọc của trình duyệt thì không phải tải một
 * byte nào của thư viện này.
 */
async function createFallbackReader(): Promise<BarcodeDetectorLike | null> {
  try {
    const jsQR = (await import("jsqr")).default;
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return null;
    return {
      async detect(video: HTMLVideoElement) {
        const width = video.videoWidth;
        const height = video.videoHeight;
        // Khung hình chưa có kích thước nghĩa là video chưa chạy — đọc lúc này
        // chỉ tổ ném lỗi, cứ trả rỗng rồi vòng sau đọc lại.
        if (width === 0 || height === 0) return [];
        canvas.width = width;
        canvas.height = height;
        context.drawImage(video, 0, 0, width, height);
        const frame = context.getImageData(0, 0, width, height);
        const found = jsQR(frame.data, width, height, {
          inversionAttempts: "dontInvert",
        });
        return found ? [{ rawValue: found.data }] : [];
      },
    };
  } catch {
    return null;
  }
}

export type GateCameraScanner = {
  /** Camera đang mở hay không — dùng để hiện khung hình và đổi chữ trên nút. */
  open: boolean;
  /** Câu tiếng Việt giải thích vì sao chưa quét được; rỗng nghĩa là không có gì phải nói. */
  message: string;
  /** Bấm nút quét: đang mở thì đóng, đang đóng thì xin quyền rồi mở. */
  toggle: () => void;
  /** Tắt camera ngay, dùng khi màn hình chuyển sang việc khác. */
  stop: () => void;
};

/**
 * Ô `<video>` do màn hình gọi tự giữ và tự gắn. Trả ref ra khỏi hook thì luật
 * lint `react-hooks/refs` coi cả cụm trả về là ref và cấm đọc lúc dựng giao
 * diện — mà `open` với `message` thì phải đọc được ở đúng lúc ấy.
 */
export function useGateCameraScanner(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  onCode: (code: string) => void,
): GateCameraScanner {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<BarcodeDetectorLike | null>(null);
  const intervalRef = useRef<number | null>(null);
  const hintRef = useRef<number | null>(null);
  const onCodeRef = useRef(onCode);

  useEffect(() => {
    onCodeRef.current = onCode;
  });

  const stop = useCallback(() => {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (hintRef.current !== null) {
      window.clearTimeout(hintRef.current);
      hintRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    detectorRef.current = null;
    setOpen(false);
  }, []);

  const start = useCallback(async () => {
    const readiness = readCameraReadiness(readEnvironment());
    if (!readiness.canScan) {
      setMessage(readiness.message);
      return;
    }
    const detector = await createCodeReader();
    if (!detector) {
      setMessage(CAMERA_READER_BROKEN_MESSAGE);
      return;
    }
    setMessage("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        // Camera sau: nhân viên chìa máy về phía mã khách đang giơ.
        video: { facingMode: "environment" },
        audio: false,
      });
      streamRef.current = stream;
      detectorRef.current = detector;
      setOpen(true);
    } catch (error) {
      setMessage(describeCameraFailure(error));
      setOpen(false);
    }
  }, []);

  const toggle = useCallback(() => {
    if (open) {
      stop();
      return;
    }
    void start();
  }, [open, start, stop]);

  // Vòng đọc chạy khi camera đã mở: đọc tới khi thấy mã hoặc tới khi bị đóng.
  useEffect(() => {
    if (!open) return;
    const video = videoRef.current;
    const stream = streamRef.current;
    const detector = detectorRef.current;
    if (!video || !stream || !detector) return;
    video.srcObject = stream;
    void video.play().catch(() => {});

    let cancelled = false;
    let reading = false;
    const interval = window.setInterval(() => {
      // Khung trước còn đang đọc dở thì bỏ nhịp này, đừng chồng lệnh lên nhau.
      if (cancelled || reading) return;
      const target = videoRef.current;
      if (!target) return;
      reading = true;
      detector
        .detect(target)
        .then((found) => {
          if (cancelled) return;
          // Mã vé là mã trần, mã thành viên đoàn là địa chỉ web — cắt về cùng
          // một dạng, đúng luật máy chủ đang dùng, rồi mới đổ vào ô quét.
          const code = normalizeScannedCode(found[0]?.rawValue ?? "");
          if (!isUsableScannedCode(code)) return;
          setMessage("");
          onCodeRef.current(code);
          stop();
        })
        .catch(() => {
          // Khung mờ hoặc chưa lấy nét thì bỏ qua, vòng đọc vẫn chạy tiếp.
        })
        .finally(() => {
          reading = false;
        });
    }, CAMERA_SCAN_INTERVAL_MS);
    intervalRef.current = interval;

    const hint = window.setTimeout(() => {
      if (!cancelled) setMessage(CAMERA_SCAN_HINT_MESSAGE);
    }, CAMERA_SCAN_HINT_MS);
    hintRef.current = hint;

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.clearTimeout(hint);
    };
  }, [open, stop, videoRef]);

  // Rời màn hình hoặc component gỡ khỏi cây thì tắt hẳn, không để camera chạy nền.
  useEffect(() => {
    return () => {
      if (intervalRef.current !== null) window.clearInterval(intervalRef.current);
      if (hintRef.current !== null) window.clearTimeout(hintRef.current);
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      detectorRef.current = null;
    };
  }, []);

  return { open, message, toggle, stop };
}
