"use client";

import { useId, useState } from "react";

import {
  VISIT_REVIEW_COMMENT_MAX,
  VISIT_REVIEW_COPY,
  type VisitReview,
} from "@/domain/visit-review";
import type { TripPassportLanguage } from "@/domain/trip-passport";

type TrangThai = "idle" | "sending" | "saved" | "failed";

/**
 * TC-12 — ô kể một câu về đúng một nơi khách đã vào.
 *
 * Chấm sao là gửi luôn, không cần bấm thêm nút: trên điện thoại ở giữa chuyến
 * đi, mỗi lần bấm thêm là một lần khách bỏ cuộc. Lời kể thì để riêng, ai muốn
 * viết mới mở ra.
 *
 * Trang này không tự quyết ai được viết. Máy chủ mới quyết, và nó đòi một lượt
 * quét ở cổng đứng sau mỗi lời (`erp_submit_visit_review`).
 */
export function VisitReviewRow({
  memberCode,
  siteId,
  siteName,
  lang,
  initial,
}: {
  memberCode: string;
  siteId: string;
  siteName: string;
  lang: TripPassportLanguage;
  initial?: VisitReview;
}) {
  const copy = VISIT_REVIEW_COPY[lang];
  const [rating, setRating] = useState(initial?.rating ?? 0);
  const [comment, setComment] = useState(initial?.comment ?? "");
  const [moRong, setMoRong] = useState(Boolean(initial?.comment));
  const [trangThai, setTrangThai] = useState<TrangThai>(initial ? "saved" : "idle");
  const vungId = useId();

  async function gui(soSao: number, loiKe: string) {
    setTrangThai("sending");
    try {
      const response = await fetch("/api/customer-visit-reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          member_code: memberCode,
          site_id: siteId,
          rating: soSao,
          comment: loiKe.trim(),
        }),
      });
      setTrangThai(response.ok ? "saved" : "failed");
    } catch {
      setTrangThai("failed");
    }
  }

  return (
    <div data-testid="visit-review-row" data-site-id={siteId} className="mt-3 pl-[4.5rem]">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {/*
          Cố ý KHÔNG dùng `role="radiogroup"`: vai trò ấy hứa với trình đọc màn
          hình rằng phím mũi tên chuyển được giữa các mức, mà ở đây thì không.
          Năm cái nút bật/tắt có nhãn nhóm là lời hứa đúng với thứ đang có.
        */}
        <div role="group" aria-label={copy.ratingLabel(siteName)} className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((muc) => {
            const dangChon = muc === rating;
            return (
              <button
                key={muc}
                type="button"
                aria-pressed={dangChon}
                aria-label={`${muc} — ${copy.stars[muc - 1]}`}
                data-testid={`visit-review-star-${muc}`}
                onClick={() => {
                  setRating(muc);
                  void gui(muc, comment);
                }}
                className={`grid size-11 place-items-center rounded-full text-xl leading-none transition ${
                  muc <= rating ? "text-[#c58a2b]" : "text-[#b9c2bb] hover:text-[#8a9990]"
                } focus-visible:ring-2 focus-visible:ring-[#183f34] focus-visible:ring-offset-2`}
              >
                <span aria-hidden>{muc <= rating ? "★" : "☆"}</span>
              </button>
            );
          })}
        </div>

        {rating > 0 ? (
          <button
            type="button"
            onClick={() => setMoRong((truoc) => !truoc)}
            aria-expanded={moRong}
            aria-controls={vungId}
            className="min-h-11 rounded-full px-3 text-sm font-bold text-[#2f5d50] underline decoration-[#8fa99f] underline-offset-4 hover:text-[#183f34]"
          >
            {initial?.comment ? copy.edit : copy.commentLabel}
          </button>
        ) : null}

        <span
          data-testid="visit-review-status"
          role="status"
          className="text-sm text-[#5b6a61]"
        >
          {trangThai === "sending" ? copy.submitting : null}
          {trangThai === "saved" ? copy.saved : null}
          {trangThai === "failed" ? copy.failed : null}
        </span>
      </div>

      {moRong && rating > 0 ? (
        <div id={vungId} className="mt-3">
          <textarea
            value={comment}
            onChange={(event) => setComment(event.target.value.slice(0, VISIT_REVIEW_COMMENT_MAX))}
            rows={3}
            maxLength={VISIT_REVIEW_COMMENT_MAX}
            aria-label={copy.commentLabel}
            className="w-full rounded-xl border border-[#ced8d1] bg-white px-3 py-3 text-base text-[#1d2925] outline-none focus-visible:ring-2 focus-visible:ring-[#183f34]"
          />
          <p className="mt-1 text-xs text-[#6b786f]">{copy.commentHint}</p>
          <button
            type="button"
            onClick={() => void gui(rating, comment)}
            disabled={trangThai === "sending"}
            className="mt-2 inline-flex min-h-11 items-center rounded-full bg-[#183f34] px-5 text-sm font-bold text-[#fbfaf6] transition hover:bg-[#12332a] disabled:opacity-60"
          >
            {trangThai === "sending" ? copy.submitting : copy.submit}
          </button>
        </div>
      ) : null}
    </div>
  );
}
