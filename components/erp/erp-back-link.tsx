import Link from "next/link";

type Props = {
  /** Đích quay lại — nơi người dùng vừa rời để vào màn hình hiện tại. */
  href: string;
  /**
   * Phần chữ sau mũi tên, ví dụ "Quay lại Tràng An" hoặc "Quay lại tổng
   * quan". Nhận nguyên câu (không phải chỉ tên riêng) để mỗi trang tự quyết
   * đúng nghĩa của đích đến, tránh component tự bịa cách ghép câu.
   */
  label: string;
  className?: string;
};

/**
 * ERP-UX-08: mọi màn hình con trong ERP phải có đường quay lại chỗ vừa rời,
 * không chỉ có nút logo về `/erp` hoặc nút quay lại của trình duyệt.
 *
 * Cố tình nhận `href` + `label` tường minh thay vì dùng `router.back()`:
 * `router.back()` có thể đưa người dùng ra khỏi hẳn ứng dụng nếu họ mở thẳng
 * đường dẫn này (không có lịch sử điều hướng nội bộ để quay lại), và nó
 * không nói được sẽ quay về đâu trước khi bấm.
 */
export function ErpBackLink({ href, label, className }: Props) {
  return (
    <Link
      href={href}
      className={`mb-4 inline-flex min-h-11 items-center gap-1.5 rounded-lg px-1 text-sm font-bold text-[#5e7068] outline-none transition hover:text-[#183f34] focus-visible:ring-2 focus-visible:ring-[#4f8875] focus-visible:ring-offset-2 ${className ?? ""}`}
    >
      <span aria-hidden="true">←</span>
      <span>{label}</span>
    </Link>
  );
}
