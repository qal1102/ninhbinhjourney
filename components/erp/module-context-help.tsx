"use client";

import { useEffect, useId, useState } from "react";
import {
  ERP_ROLE_LABELS,
  type ErpModule,
  type ErpRole,
  type ErpSite,
} from "@/domain/erp";

const roleGuidance: Record<
  ErpRole,
  { responsibility: string; nextStep: string }
> = {
  employee: {
    responsibility:
      "Chỉ xử lý việc được giao cho tài khoản của bạn; cập nhật đúng số liệu thực tế và nộp bằng chứng được yêu cầu.",
    nextStep:
      "Khi hoàn thành, gửi hồ sơ cho quản lý. Nếu dữ liệu không đúng hoặc không thuộc ca của bạn, báo quản lý thay vì tự sửa hồ sơ của người khác.",
  },
  manager: {
    responsibility:
      "Theo dõi công việc trong phạm vi cơ sở được phân công, giao đúng người và kiểm tra dữ liệu nguồn trước khi xác nhận.",
    nextStep:
      "Trả lại đúng người phụ trách nếu thiếu thông tin; chỉ chuyển cấp những việc vượt thẩm quyền hoặc cần quyết định.",
  },
  accountant: {
    responsibility:
      "Kiểm tra chứng từ nguồn, mã hạch toán và tính khớp đúng; không sửa thay số liệu vận hành đã được xác nhận.",
    nextStep:
      "Hồ sơ thiếu phải trả về người sở hữu kèm lý do cụ thể; hồ sơ đủ mới được đưa sang bước đối soát hoặc hạch toán.",
  },
  "chief-accountant": {
    responsibility:
      "Kiểm tra độc lập bút toán, hồ sơ nguồn và kỳ hạch toán; không tự lập rồi tự duyệt cùng một hồ sơ.",
    nextStep:
      "Duyệt hoặc trả lại bút toán kèm lý do; chỉ ghi sổ, đảo bút toán hoặc khóa kỳ khi đủ điều kiện kiểm soát.",
  },
  director: {
    responsibility:
      "Tập trung vào ngoại lệ, chênh lệch và quyết định đã được cấp dưới xác minh; không cần xử lý toàn bộ hàng việc thường ngày.",
    nextStep:
      "Mở hồ sơ nguồn để xem người phụ trách, bằng chứng và tác động trước khi quyết định hoặc giao lại đầu mối xử lý.",
  },
};

type Props = {
  module: ErpModule;
  role: ErpRole;
  site: ErpSite;
};

export function ModuleContextHelp({ module, role, site }: Props) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const guidance = roleGuidance[role];

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  return (
    <>
      <button
        type="button"
        aria-label={`Trợ giúp về ${module.name}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-[#cdd9d3] bg-white text-lg font-black text-[#285e49] shadow-sm transition hover:border-[#8eaa9d] hover:bg-[#f3f7f5] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#285e49]"
      >
        ?
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[80] grid place-items-end bg-[#10251e]/45 p-0 sm:place-items-center sm:p-5"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) setOpen(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="max-h-[88dvh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:max-w-xl sm:rounded-3xl sm:p-7"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.15em] text-[#477565]">
                  Trợ giúp theo công việc
                </p>
                <h2
                  id={titleId}
                  className="mt-2 text-2xl font-black text-[#20342c]"
                >
                  {module.name}
                </h2>
                <p className="mt-1 text-sm text-[#6d7a74]">
                  {site.shortName} · {ERP_ROLE_LABELS[role]}
                </p>
              </div>
              <button
                type="button"
                aria-label="Đóng trợ giúp"
                onClick={() => setOpen(false)}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#eef3f0] text-xl text-[#315346]"
              >
                ×
              </button>
            </div>

            <div className="mt-6 space-y-3 text-sm leading-6 text-[#43564e]">
              <article className="rounded-2xl bg-[#f3f7f5] p-4">
                <h3 className="font-black text-[#29483b]">
                  Màn hình này dùng để làm gì?
                </h3>
                <p className="mt-1">{module.description}</p>
              </article>
              <article className="rounded-2xl border border-[#dce5e0] p-4">
                <h3 className="font-black text-[#29483b]">
                  Trách nhiệm của bạn
                </h3>
                <p className="mt-1">{guidance.responsibility}</p>
              </article>
              <article className="rounded-2xl border border-[#dce5e0] p-4">
                <h3 className="font-black text-[#29483b]">
                  Khi hồ sơ đã đủ hoặc còn thiếu
                </h3>
                <p className="mt-1">{guidance.nextStep}</p>
              </article>
            </div>

            <button
              type="button"
              onClick={() => setOpen(false)}
              className="mt-6 w-full rounded-xl bg-[#1f604c] px-4 py-3 text-sm font-black text-white"
            >
              Đã hiểu
            </button>
          </section>
        </div>
      ) : null}
    </>
  );
}
