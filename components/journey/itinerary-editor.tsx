"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo, useState } from "react";
import { DESTINATIONS } from "@/content/destinations";
import { rebuildItineraryWithSites } from "@/domain/journey";
import { matchPackagesToIntent } from "@/domain/package-match";
import type { Itinerary, JourneyIntent } from "@/domain/models";
import { JourneyContactVault } from "./journey-contact-vault";
import { goiHienThi } from "@/content/packages-en";
import type { NgonNgu } from "@/lib/ngon-ngu";

const walkingLabel: Record<JourneyIntent["walkingTolerance"], { vi: string; en: string }> = {
  low: { vi: "ít", en: "little" },
  moderate: { vi: "vừa", en: "moderate" },
  high: { vi: "nhiều", en: "plenty" },
};

const paceLabel: Record<JourneyIntent["pace"], { vi: string; en: string }> = {
  relaxed: { vi: "thư thả", en: "relaxed" },
  balanced: { vi: "cân bằng", en: "balanced" },
  active: { vi: "năng động", en: "active" },
};

/*
 * Lý do từng chặng, lời giải thích và các cảnh báo được `domain/journey.ts`
 * viết bằng tiếng Việt (bài kiểm và API dùng đúng các câu ấy). Khách chọn EN
 * thì dựng lại câu tiếng Anh ngay tại đây từ cùng dữ kiện.
 */
const MOBILITY_EN = { low: "is easy on the legs", moderate: "needs some walking", high: "needs a lot of walking" } as const;
const ISSUE_EN: Record<string, string> = {
  UNKNOWN_SITE: "The plan has a stop that is not on our list.",
  SITE_UNAVAILABLE: "A stop is closed at the chosen time.",
  MOBILITY_CONFLICT: "A stop needs more walking than you chose.",
  INVALID_TIME: "A stop has a wrong start or end time.",
  OVERLAP: "A stop overlaps the one before it.",
  OUTSIDE_DEMO_WINDOW: "A stop falls outside its opening hours.",
  NO_FEASIBLE_STOPS: "No stop fits the time and walking you chose.",
  DURATION_EXCEEDED: "The plan is longer than the time you have.",
};

const ItineraryRouteMap = dynamic(() => import("./itinerary-route-map"), {
  loading: () => (
    <div className="grid min-h-[24rem] place-items-center rounded-2xl bg-[#12211c]">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#a8cec1] border-t-[#e7c78d]" />
    </div>
  ),
  ssr: false,
});

function timeLabel(value: string) {
  // Giờ 24h như "08:00" đọc được bằng cả hai thứ tiếng.
  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(value));
}

export function ItineraryEditor({
  initialItinerary,
  intent,
  savedAnonymously = false,
  identityCollectionEnabled = false,
  lang = "vi",
}: {
  initialItinerary: Itinerary;
  intent: JourneyIntent;
  savedAnonymously?: boolean;
  identityCollectionEnabled?: boolean;
  lang?: NgonNgu;
}) {
  const t = (vi: string, en: string) => (lang === "en" ? en : vi);
  const [itinerary, setItinerary] = useState(initialItinerary);
  const [message, setMessage] = useState("");

  const siteIds = useMemo(
    () => itinerary.items.map((item) => item.siteId),
    [itinerary.items],
  );

  const routeStops = useMemo(
    () =>
      itinerary.items.map((item) => ({
        id: item.id,
        siteId: item.siteId,
        label: `${timeLabel(item.startAt)}–${timeLabel(item.endAt)}`,
      })),
    [itinerary.items],
  );

  function saveSites(nextSiteIds: string[]) {
    if (nextSiteIds.length === 0) {
      setMessage(t("Hành trình cần ít nhất một điểm đến.", "The day needs at least one stop."));
      return;
    }

    // Lịch trình sống trong trình duyệt của khách (bản gốc có thể đã lưu ẩn
    // danh ở máy chủ), nên mọi chỉnh sửa tính lại ngay tại chỗ bằng đúng luật
    // của lúc dựng. Lối lưu chỉnh sửa về "phòng trình diễn" đã gỡ 27/09/2026.
    const rebuilt = rebuildItineraryWithSites({
      itinerary,
      intent,
      siteIds: nextSiteIds,
    });
    setItinerary(rebuilt);
    setMessage(
      rebuilt.validation.valid
        ? t("Đã tính lại lịch trình theo chỉnh sửa của bạn.", "Recalculated with your changes.")
        : t("Đã tính lại; hãy xử lý xung đột trước khi tiếp tục.", "Recalculated; please resolve the conflicts before continuing."),
    );
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= siteIds.length) return;
    const next = [...siteIds];
    [next[index], next[target]] = [next[target], next[index]];
    saveSites(next);
  }

  function replace(index: number) {
    const replacement = DESTINATIONS.find(
      (destination) => !siteIds.includes(destination.id),
    );
    if (!replacement) {
      setMessage(t("Không còn điểm cấu hình nào để thay thế.", "There are no other stops to swap in."));
      return;
    }
    const next = [...siteIds];
    next[index] = replacement.id;
    saveSites(next);
  }

  // QA-P2-09: nút này từng dẫn về `/packages` trơn khi hành trình không lưu
  // vào phòng trình diễn — trên production là mọi lần — nên khách sang trang gói
  // mà không còn gì của lịch vừa dựng. Nay mang theo gói khớp nhất (cùng phép
  // ghép với trang lập hành trình) để trang gói làm nổi đúng gói ấy.
  const goiGanNhat = matchPackagesToIntent({
    pace: intent.pace,
    durationMinutes: intent.durationMinutes,
    party: intent.party,
    partyContext: intent.partyContext,
    visitDate: intent.visitDate,
  }).matches[0] ?? null;
  // `from=plan`: danh mục gói biết khách đi từ lịch trình sang, nút quay lại về đúng đây.
  const thamSoGoi = new URLSearchParams({ from: "plan" });
  if (goiGanNhat) thamSoGoi.set("goi", goiGanNhat.slug);
  if (lang === "en") thamSoGoi.set("lang", "en");
  const huongDiGoi = `/packages?${thamSoGoi.toString()}`;

  return (
    <div className="grid gap-8 xl:grid-cols-[0.95fr_1.05fr]">
      <section>
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-[#356957]">
              {savedAnonymously
                  ? t("Bản gốc đã lưu ẩn danh · chỉnh sửa tiếp lưu trên máy bạn", "Original saved anonymously · edits stay on your device")
                  : t("Lịch trình đã xác nhận · lưu trên máy bạn", "Plan confirmed · saved on your device")}
            </p>
            <h2 className="font-display mt-3 text-4xl text-[#183f34] sm:text-5xl">
              {t("Một ngày đi nhẹ nhàng", "An easy-going day")}
            </h2>
          </div>
          <div className="rounded-2xl bg-white px-4 py-3 text-right shadow-sm">
            <p className="text-xs text-[#59654b]">{t("Ước tính minh hoạ", "Sample estimate")}</p>
            <p className="font-display text-xl text-[#183f34]">
              {itinerary.estimatedPriceVnd.toLocaleString("vi-VN")} VND
            </p>
          </div>
        </div>

        <ol className="mt-8 space-y-4">
          {itinerary.items.map((item, index) => {
            const destination = DESTINATIONS.find(
              (candidate) => candidate.id === item.siteId,
            );
            return (
              <li
                key={item.id}
                className="relative rounded-3xl border border-[#d7d5cd] bg-white p-5 pl-16 shadow-sm"
              >
                <span className="absolute left-5 top-5 grid h-8 w-8 place-items-center rounded-full bg-[#183f34] text-sm font-bold text-white">
                  {index + 1}
                </span>
                <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#557568]">
                  {timeLabel(item.startAt)}–{timeLabel(item.endAt)}
                  {item.travelMinutesFromPrevious > 0
                    ? t(` · ${item.travelMinutesFromPrevious} phút di chuyển`, ` · ${item.travelMinutesFromPrevious} min travel`)
                    : ""}
                </p>
                <h3 className="font-display mt-2 text-2xl text-[#183f34]">
                  {destination?.name[lang] ?? t("Điểm không còn trong danh sách", "No longer on our list")}
                </h3>
                <p className="mt-2 text-sm leading-6 text-[#59654b]">
                  {lang === "en" && destination
                    ? intent.walkingTolerance === "low"
                      ? `${destination.name.en} ${MOBILITY_EN[destination.mobilityLevel]}, which suits the walking you asked for, and it is still open in time.`
                      : `${destination.name.en} fits your ${paceLabel[intent.pace].en} pace and is within its opening hours.`
                    : item.reason}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                    className="min-h-10 rounded-full border border-[#b9c4bd] px-3 text-xs font-bold disabled:opacity-35"
                  >
                    {t("Lên", "Up")}
                  </button>
                  <button
                    type="button"
                    disabled={index === itinerary.items.length - 1}
                    onClick={() => move(index, 1)}
                    className="min-h-10 rounded-full border border-[#b9c4bd] px-3 text-xs font-bold disabled:opacity-35"
                  >
                    {t("Xuống", "Down")}
                  </button>
                  <button
                    type="button"
                    onClick={() => replace(index)}
                    className="min-h-10 rounded-full border border-[#b9c4bd] px-3 text-xs font-bold"
                  >
                    {t("Thay điểm", "Swap")}
                  </button>
                  <button
                    type="button"
                    disabled={itinerary.items.length === 1}
                    onClick={() =>
                      saveSites(
                        siteIds.filter((_, itemIndex) => itemIndex !== index),
                      )
                    }
                    className="min-h-10 rounded-full px-3 text-xs font-bold text-[#8f2f2c] disabled:opacity-35"
                  >
                    {t("Xóa", "Remove")}
                  </button>
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      <div className="space-y-5">
        <section className="rounded-3xl bg-[#183f34] p-5 text-white sm:p-7">
          <ItineraryRouteMap stops={routeStops} lang={lang} />
          <p className="mt-3 text-xs font-bold text-white/55">
            {t("Thứ tự điểm dừng theo lịch trình đã xác nhận.", "Stops in the order of your confirmed plan.")}
          </p>
        </section>

        <section
          className={`rounded-3xl border p-5 ${
            itinerary.validation.valid
              ? "border-[#9fc4ad] bg-[#edf5ef]"
              : "border-[#d5a09d] bg-[#fff0ef]"
          }`}
        >
          <h3 className="font-display text-2xl text-[#183f34]">
            {itinerary.validation.valid
              ? t("Lịch trình hợp lệ", "The plan works")
              : t("Cần xử lý xung đột", "Conflicts to resolve")}
          </h3>
          <p className="mt-2 text-sm leading-6 text-[#4d5b55]">
            {t(
              itinerary.explanation,
              "The plan follows opening hours, total time, walking and distance first, then budget and interests.",
            )}
          </p>
          {itinerary.validation.issues.length > 0 ? (
            <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-[#8f2f2c]">
              {itinerary.validation.issues.map((issue, index) => (
                <li key={`${issue.code}-${index}`}>{lang === "en" ? (ISSUE_EN[issue.code] ?? issue.message) : issue.message}</li>
              ))}
            </ul>
          ) : null}
          <p className="mt-4 text-xs text-[#59654b]">
            {t(
              `Tổng ${itinerary.totalMinutes} / ${intent.durationMinutes} phút · đi bộ ${walkingLabel[intent.walkingTolerance].vi} · nhịp ${paceLabel[intent.pace].vi}`,
              `Total ${itinerary.totalMinutes} / ${intent.durationMinutes} min · ${walkingLabel[intent.walkingTolerance].en} walking · ${paceLabel[intent.pace].en} pace`,
            )}
          </p>
        </section>

        {message ? (
          <p className="rounded-2xl bg-white p-4 text-sm" role="status">
            {message}
          </p>
        ) : null}

        {itinerary.validation.valid ? (
          <>
            <Link
              href={huongDiGoi}
              className="inline-flex min-h-13 w-full items-center justify-center rounded-full bg-[#d58c35] px-6 font-extrabold text-[#151a17]"
            >
              {t("Dùng hành trình này", "Use this plan")}
            </Link>
            {goiGanNhat ? (
              <p className="text-center text-sm text-[#4d5b55]">
                {t("Gói gần nhất với hành trình này:", "Closest package to this plan:")}{" "}
                <strong className="text-[#183f34]">{goiHienThi(goiGanNhat.item, lang).name}</strong>.
              </p>
            ) : null}
          </>
        ) : (
          <button
            type="button"
            disabled
            className="min-h-13 w-full rounded-full bg-[#b8b8b0] px-6 font-extrabold text-white"
          >
            {t("Xử lý xung đột để tiếp tục", "Resolve conflicts to continue")}
          </button>
        )}

        {savedAnonymously && identityCollectionEnabled ? (
          <JourneyContactVault journeyId={itinerary.id} lang={lang} />
        ) : null}
      </div>
    </div>
  );
}
