import {
  erpDataOriginLabel,
  type ErpDataOrigin,
} from "@/domain/erp-data-origin";

/**
 * ERP-FAKE-03 — nhãn dán lên từng dòng hồ sơ không phải nghiệp vụ thật.
 *
 * Hồ sơ gieo mẫu và cặn chạy thử vẫn ở lại màn hình nghiệp vụ để nhân viên
 * còn cái mà tập, nhưng phải nhìn ra ngay là chúng không thật. Chúng đã bị
 * loại khỏi mọi con số trên trang chủ giám đốc.
 *
 * Cùng một kiểu dáng với nhãn ở màn hình sự cố (ERP-FAKE-02), để người dùng
 * chỉ phải học một lần.
 */
export function DataOriginTag({ origin }: { origin: ErpDataOrigin }) {
  const label = erpDataOriginLabel(origin);
  if (!label) return null;
  return (
    <span className="rounded-full bg-[#fdf0dd] px-2 py-0.5 text-[10px] font-black text-[#8a5e30]">
      {label}
    </span>
  );
}
