"use client";

import { useSyncExternalStore } from "react";
import { isMidAutumnSeasonOpen } from "./mid-autumn-season";

function subscribeNothing() {
  return () => {};
}

/**
 * Cờ "mùa Trung thu 2026 còn mở" tính đúng lúc trình duyệt thật sự dựng
 * trang — không đóng băng theo thời điểm build tĩnh. Snapshot phía máy chủ
 * luôn trả "còn mở" (đúng với thực tế từ giờ tới hết 27/09) để không lệch
 * hydrate trước ngày khép mùa; sau khi gắn xong, trình duyệt tự tính lại
 * theo đồng hồ thật của khách và tự sửa — không cần build hay deploy lại.
 *
 * Cùng khuôn `useSyncExternalStore(subscribeNothing, ...)` đã dùng cho
 * `hasIntroPlayedThisSession`/`mounted` trong `app/ninh-binh-landing.tsx`,
 * để không lặp thêm một cách né hydration-mismatch mới.
 */
export function useMidAutumnSeasonOpen(): boolean {
  return useSyncExternalStore(
    subscribeNothing,
    () => isMidAutumnSeasonOpen(),
    () => true,
  );
}
