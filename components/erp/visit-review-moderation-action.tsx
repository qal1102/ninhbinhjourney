"use client";

import { useState } from "react";

import { moderateVisitReviewAction } from "@/app/erp/actions";
import { MODERATION_COPY } from "@/domain/visit-review-moderation";

/**
 * TC-12 mục 3 — nút ẩn một lời khách.
 *
 * Mở ra mới thấy ô lý do, và không có nút nào ẩn được mà không ghi lý do —
 * đúng như luật dưới cơ sở dữ liệu. Câu từ chối (hết hạn mức, toàn 5 sao, sai
 * vai) hiện nguyên văn ở đây, vì đó là câu đã được viết cho người đọc.
 *
 * Trang này không tự quyết gì cả: mọi luật nằm trong `erp_hide_visit_review`.
 */
export function VisitReviewModerationAction({ reviewId }: { reviewId: string }) {
  const [moRong, setMoRong] = useState(false);
  const [lyDo, setLyDo] = useState("");
  const [dangGui, setDangGui] = useState(false);
  const [ketQua, setKetQua] = useState<{ ok: boolean; message: string } | null>(null);

  if (ketQua?.ok) {
    return (
      <p data-testid="visit-review-moderation-done" className="mt-2 text-xs font-bold text-[#3d6b50]">
        {ketQua.message}
      </p>
    );
  }

  return (
    <div className="mt-2">
      {moRong ? (
        <form
          action={async (formData) => {
            setDangGui(true);
            try {
              setKetQua(await moderateVisitReviewAction(formData));
            } finally {
              setDangGui(false);
            }
          }}
          className="rounded-xl border border-[#e6d7c9] bg-[#fdf8f2] p-3"
        >
          <input type="hidden" name="reviewId" value={reviewId} />
          <input type="hidden" name="action" value="hide" />
          <label className="block text-xs font-black text-[#7a5a1f]">
            Lý do ẩn (được lưu lại kèm tên bạn)
            <input
              name="reason"
              value={lyDo}
              onChange={(event) => setLyDo(event.target.value)}
              minLength={5}
              maxLength={400}
              required
              placeholder="Ví dụ: lời quảng cáo, không nói về chuyến đi"
              className="mt-1 min-h-11 w-full rounded-lg border border-[#d9c9b4] bg-white px-3 text-sm text-[#2f3d37]"
            />
          </label>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={dangGui || lyDo.trim().length < 5}
              className="inline-flex min-h-11 items-center rounded-lg bg-[#8a3f3f] px-4 text-xs font-black text-white disabled:opacity-50"
            >
              {dangGui ? "Đang ẩn…" : "Ẩn lời này"}
            </button>
            <button
              type="button"
              onClick={() => {
                setMoRong(false);
                setKetQua(null);
              }}
              className="inline-flex min-h-11 items-center rounded-lg border border-[#ced8d1] bg-white px-4 text-xs font-black text-[#42554c]"
            >
              Thôi
            </button>
          </div>
          {ketQua && !ketQua.ok ? (
            <p role="alert" data-testid="visit-review-moderation-error" className="mt-2 text-xs leading-5 text-[#8a3f3f]">
              {ketQua.message}
            </p>
          ) : (
            <p className="mt-2 text-xs leading-5 text-[#7a6a52]">{MODERATION_COPY.thieuLyDo}</p>
          )}
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setMoRong(true)}
          data-testid="visit-review-moderation-open"
          className="inline-flex min-h-11 items-center rounded-lg border border-[#ddd5c9] bg-white px-3 text-xs font-black text-[#7a5a1f]"
        >
          Ẩn lời này
        </button>
      )}
    </div>
  );
}
