"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo, useState } from "react";
import { DESTINATIONS } from "@/content/destinations";
import { rebuildItineraryWithSites } from "@/domain/journey";
import type { Itinerary, JourneyIntent } from "@/domain/models";
import { JourneyContactVault } from "./journey-contact-vault";

const walkingLabel: Record<JourneyIntent["walkingTolerance"], string> = {
  low: "ít",
  moderate: "vừa",
  high: "nhiều",
};

const paceLabel: Record<JourneyIntent["pace"], string> = {
  relaxed: "thư thả",
  balanced: "cân bằng",
  active: "năng động",
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
  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(value));
}

export function ItineraryEditor({
  initialItinerary,
  intent,
  persisted = false,
  savedAnonymously = false,
  identityCollectionEnabled = false,
}: {
  initialItinerary: Itinerary;
  intent: JourneyIntent;
  persisted?: boolean;
  savedAnonymously?: boolean;
  identityCollectionEnabled?: boolean;
}) {
  const [itinerary, setItinerary] = useState(initialItinerary);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

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

  async function saveSites(nextSiteIds: string[]) {
    if (nextSiteIds.length === 0) {
      setMessage("Hành trình cần ít nhất một điểm đến.");
      return;
    }

    // Journeys created outside a demo room live in the browser only, so the
    // same domain rules are re-run locally instead of round-tripping.
    if (!persisted) {
      const rebuilt = rebuildItineraryWithSites({
        itinerary,
        intent,
        siteIds: nextSiteIds,
      });
      setItinerary(rebuilt);
      setMessage(
        rebuilt.validation.valid
          ? "Đã tính lại lịch trình theo chỉnh sửa của bạn."
          : "Đã tính lại; hãy xử lý xung đột trước khi tiếp tục.",
      );
      return;
    }

    setPending(true);
    setMessage("");
    try {
      const response = await fetch(`/api/journeys/${itinerary.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteIds: nextSiteIds }),
      });
      const payload = (await response.json()) as {
        itinerary?: Itinerary;
        error?: { message: string };
      };
      if (!response.ok || !payload.itinerary) {
        throw new Error(
          payload.error?.message ?? "Không thể lưu thay đổi hành trình.",
        );
      }
      setItinerary(payload.itinerary);
      setMessage(
        payload.itinerary.validation.valid
          ? "Đã lưu và kiểm tra lại lịch trình trong demo room."
          : "Đã lưu bản chỉnh sửa; hãy xử lý xung đột trước khi tiếp tục.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Không thể lưu thay đổi hành trình.",
      );
    } finally {
      setPending(false);
    }
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= siteIds.length) return;
    const next = [...siteIds];
    [next[index], next[target]] = [next[target], next[index]];
    void saveSites(next);
  }

  function replace(index: number) {
    const replacement = DESTINATIONS.find(
      (destination) => !siteIds.includes(destination.id),
    );
    if (!replacement) {
      setMessage("Không còn điểm cấu hình nào để thay thế.");
      return;
    }
    const next = [...siteIds];
    next[index] = replacement.id;
    void saveSites(next);
  }

  return (
    <div className="grid gap-8 xl:grid-cols-[0.95fr_1.05fr]">
      <section>
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-[#356957]">
              {persisted
                ? "Lịch trình đã xác nhận · đã lưu"
                : savedAnonymously
                  ? "Bản gốc đã lưu ẩn danh · chỉnh sửa tiếp lưu trên máy bạn"
                  : "Lịch trình đã xác nhận · lưu trên máy bạn"}
            </p>
            <h2 className="font-display mt-3 text-4xl text-[#183f34] sm:text-5xl">
              Một ngày theo nhịp nhẹ
            </h2>
          </div>
          <div className="rounded-2xl bg-white px-4 py-3 text-right shadow-sm">
            <p className="text-xs text-[#59654b]">Ước tính demo</p>
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
                    ? ` · ${item.travelMinutesFromPrevious} phút di chuyển`
                    : ""}
                </p>
                <h3 className="font-display mt-2 text-2xl text-[#183f34]">
                  {destination?.name.vi ?? "Điểm không còn trong catalog"}
                </h3>
                <p className="mt-2 text-sm leading-6 text-[#59654b]">
                  {item.reason}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={pending || index === 0}
                    onClick={() => move(index, -1)}
                    className="min-h-10 rounded-full border border-[#b9c4bd] px-3 text-xs font-bold disabled:opacity-35"
                  >
                    Lên
                  </button>
                  <button
                    type="button"
                    disabled={pending || index === itinerary.items.length - 1}
                    onClick={() => move(index, 1)}
                    className="min-h-10 rounded-full border border-[#b9c4bd] px-3 text-xs font-bold disabled:opacity-35"
                  >
                    Xuống
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => replace(index)}
                    className="min-h-10 rounded-full border border-[#b9c4bd] px-3 text-xs font-bold"
                  >
                    Thay điểm
                  </button>
                  <button
                    type="button"
                    disabled={pending || itinerary.items.length === 1}
                    onClick={() =>
                      void saveSites(
                        siteIds.filter((_, itemIndex) => itemIndex !== index),
                      )
                    }
                    className="min-h-10 rounded-full px-3 text-xs font-bold text-[#8f2f2c] disabled:opacity-35"
                  >
                    Xóa
                  </button>
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      <div className="space-y-5">
        <section className="rounded-3xl bg-[#183f34] p-5 text-white sm:p-7">
          <ItineraryRouteMap stops={routeStops} />
          <p className="mt-3 text-xs font-bold text-white/55">
            Thứ tự điểm dừng theo lịch trình đã xác nhận.
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
              ? "Lịch trình hợp lệ"
              : "Cần xử lý xung đột"}
          </h3>
          <p className="mt-2 text-sm leading-6 text-[#4d5b55]">
            {itinerary.explanation}
          </p>
          {itinerary.validation.issues.length > 0 ? (
            <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-[#8f2f2c]">
              {itinerary.validation.issues.map((issue, index) => (
                <li key={`${issue.code}-${index}`}>{issue.message}</li>
              ))}
            </ul>
          ) : null}
          <p className="mt-4 text-xs text-[#59654b]">
            Tổng {itinerary.totalMinutes} / {intent.durationMinutes} phút · đi
            bộ {walkingLabel[intent.walkingTolerance]} · nhịp{" "}
            {paceLabel[intent.pace]}
          </p>
        </section>

        {message ? (
          <p className="rounded-2xl bg-white p-4 text-sm" role="status">
            {message}
          </p>
        ) : null}

        {itinerary.validation.valid ? (
          <Link
            href={persisted ? `/packages?journey=${itinerary.id}` : "/packages"}
            className="inline-flex min-h-13 w-full items-center justify-center rounded-full bg-[#d58c35] px-6 font-extrabold text-[#151a17]"
          >
            Dùng hành trình này
          </Link>
        ) : (
          <button
            type="button"
            disabled
            className="min-h-13 w-full rounded-full bg-[#b8b8b0] px-6 font-extrabold text-white"
          >
            Xử lý xung đột để tiếp tục
          </button>
        )}

        {savedAnonymously && identityCollectionEnabled ? (
          <JourneyContactVault journeyId={itinerary.id} />
        ) : null}
      </div>
    </div>
  );
}
