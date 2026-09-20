"use client";

import { useEffect, useState } from "react";

import {
  formatAverage,
  shouldShowAverage,
  siteReviewSummariesFromApi,
  VISIT_REVIEW_COPY,
  type SiteReviewSummary,
} from "@/domain/visit-review";

/**
 * TC-12 — bảng điểm của một nơi, hiện trên trang điểm đến.
 *
 * Đọc ở phía trình duyệt để trang điểm đến vẫn dựng sẵn được như cũ. Chưa ai
 * kể thì khối này biến mất hẳn, không để lại một khung rỗng hay một con số 0
 * — một nơi chưa có ai nói thì đừng dựng nó thành "0 sao".
 *
 * Dưới ba lượt vẫn nói thật là có mấy người kể, chỉ không dựng thành điểm số.
 */
export function VerifiedRatingPanel({
  siteId,
  lang = "vi",
}: {
  siteId: string;
  lang?: "vi" | "en";
}) {
  const copy = VISIT_REVIEW_COPY[lang];
  const [summary, setSummary] = useState<SiteReviewSummary | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const response = await fetch(`/api/site-reviews?site_id=${encodeURIComponent(siteId)}`);
        const payload = (await response.json().catch(() => null)) as
          | { accepted: true; summaries: unknown }
          | null;
        if (!alive || !response.ok || !payload?.accepted) return;
        setSummary(siteReviewSummariesFromApi(payload.summaries)[0] ?? null);
      } catch {
        // Im lặng: bảng điểm không về thì trang điểm đến vẫn đủ nghĩa như cũ.
      }
    })();
    return () => {
      alive = false;
    };
  }, [siteId]);

  if (!summary) return null;
  const duDeChamDiem = shouldShowAverage(summary);

  return (
    <aside
      data-testid="verified-rating-panel"
      data-site-id={siteId}
      className="mt-10 rounded-2xl border border-[#d8cfbc] bg-[#f6f1e7] p-6"
    >
      <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#9a6328]">
        Người đã tới đây nói gì
      </p>

      {duDeChamDiem ? (
        <p className="font-display mt-3 text-3xl leading-tight text-[#183f34]">
          {copy.summary(formatAverage(summary.average), summary.count)}
        </p>
      ) : (
        <p className="mt-3 text-lg leading-8 text-[#4d5b55]">{copy.summaryThin(summary.count)}</p>
      )}

      {summary.recentVoices.length > 0 ? (
        <ul className="mt-4 space-y-3">
          {summary.recentVoices.slice(0, 3).map((voice, index) => (
            <li key={index} className="border-t border-[#dcd9d1] pt-3">
              <span aria-label={`${voice.rating} sao`} className="text-sm text-[#c58a2b]">
                <span aria-hidden>{"★".repeat(voice.rating)}</span>
              </span>
              <p className="mt-1 leading-7 text-[#4d5b55]">{voice.comment}</p>
            </li>
          ))}
        </ul>
      ) : null}

      <p className="mt-4 text-sm leading-6 text-[#6b786f]">{copy.note}</p>
    </aside>
  );
}
