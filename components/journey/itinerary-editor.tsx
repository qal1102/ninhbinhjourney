"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { DESTINATIONS, NINH_BINH_TOURISM_CORE } from "@/content/destinations";
import type { Itinerary, JourneyIntent } from "@/domain/models";

function timeLabel(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(value));
}

function pointPosition(siteId: string) {
  const destination = DESTINATIONS.find((item) => item.id === siteId);
  if (!destination) return { left: "50%", top: "50%" };
  const [latitude, longitude] = destination.coordinates;
  const { south, west, north, east } = NINH_BINH_TOURISM_CORE.bounds;
  return {
    left: `${((longitude - west) / (east - west)) * 100}%`,
    top: `${((north - latitude) / (north - south)) * 100}%`,
  };
}

export function ItineraryEditor({
  initialItinerary,
  intent,
}: {
  initialItinerary: Itinerary;
  intent: JourneyIntent;
}) {
  const [itinerary, setItinerary] = useState(initialItinerary);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  const siteIds = useMemo(
    () => itinerary.items.map((item) => item.siteId),
    [itinerary.items],
  );

  async function saveSites(nextSiteIds: string[]) {
    if (nextSiteIds.length === 0) {
      setMessage("Hành trình cần ít nhất một điểm đến.");
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
              Lịch trình đã xác nhận · Supabase
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
          <div className="relative min-h-[24rem] overflow-hidden rounded-2xl bg-[radial-gradient(circle_at_35%_70%,rgba(255,255,255,.13),transparent_22%),linear-gradient(145deg,#315e4b,#111a17)]">
            <svg
              aria-hidden="true"
              viewBox="0 0 100 100"
              className="absolute inset-[8%] h-[84%] w-[84%]"
              preserveAspectRatio="none"
            >
              <path
                d="M 10 88 L 10 40 L 20 7 L 55 7 L 90 40 L 90 84 L 55 95 Z"
                fill="rgba(255,255,255,.04)"
                stroke="#a8cec1"
                strokeWidth="1"
                strokeDasharray="2 2"
              />
              {itinerary.items.slice(1).map((item, index) => {
                const previous = itinerary.items[index];
                const start = pointPosition(previous.siteId);
                const end = pointPosition(item.siteId);
                return (
                  <line
                    key={`${previous.id}-${item.id}`}
                    x1={start.left}
                    y1={start.top}
                    x2={end.left}
                    y2={end.top}
                    stroke="#e7c78d"
                    strokeWidth="1.6"
                    strokeDasharray="3 2"
                  />
                );
              })}
            </svg>
            {itinerary.items.map((item, index) => (
              <span
                key={item.id}
                className="absolute z-10 grid h-9 w-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-white bg-[#d58c35] text-sm font-extrabold text-[#151a17]"
                style={pointPosition(item.siteId)}
              >
                {index + 1}
              </span>
            ))}
            <p className="absolute bottom-3 left-4 text-xs font-bold text-white/55">
              Route reveal · local tourism-core canvas
            </p>
          </div>
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
            Tổng {itinerary.totalMinutes} / {intent.durationMinutes} phút · mức
            đi bộ {intent.walkingTolerance} · nhịp {intent.pace}
          </p>
        </section>

        {message ? (
          <p className="rounded-2xl bg-white p-4 text-sm" role="status">
            {message}
          </p>
        ) : null}

        {itinerary.validation.valid ? (
          <Link
            href={`/packages?journey=${itinerary.id}`}
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
      </div>
    </div>
  );
}
