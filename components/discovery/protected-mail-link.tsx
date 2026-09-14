"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { contactMailto } from "@/content/contact";

const subscribeNothing = () => () => {};

/**
 * QA-P2-09 — nút gửi thư không để lộ địa chỉ trong HTML máy chủ.
 *
 * Máy chủ dựng thẻ với `href="#lien-he"`; tới trình duyệt mới ghép địa chỉ
 * thật vào. Người dùng thật không thấy khác gì, còn bộ quét chỉ đọc HTML thì
 * không nhặt được địa chỉ.
 */
export function ProtectedMailLink({
  subject,
  className,
  children,
  track,
}: {
  subject?: string;
  className?: string;
  children: ReactNode;
  track?: string;
}) {
  const mounted = useSyncExternalStore(subscribeNothing, () => true, () => false);
  return (
    <a href={mounted ? contactMailto(subject) : "#lien-he"} data-customer-track={track} className={className}>
      {children}
    </a>
  );
}
