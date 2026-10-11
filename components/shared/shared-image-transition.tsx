import { ViewTransition, type ReactNode } from "react";

export function SharedImageTransition({
  name,
  className,
  children,
}: {
  name: string;
  className: string;
  children: ReactNode;
}) {
  return (
    <ViewTransition
      name={name}
      share="page-continuity-morph"
      default="none"
    >
      <div data-continuity-image={name} className={className}>
        {children}
      </div>
    </ViewTransition>
  );
}

/**
 * Chữ bay cùng ảnh (E5): bọc thẳng thẻ tiêu đề, không thêm khung. Chỉ dùng
 * khi mỗi trang có đúng một phần tử mang tên này, trùng tên là trình duyệt
 * bỏ cả lượt chuyển cảnh.
 */
export function SharedTitleTransition({ name, children }: { name: string; children: ReactNode }) {
  return (
    <ViewTransition name={name} share="page-continuity-morph" default="none">
      {children}
    </ViewTransition>
  );
}
