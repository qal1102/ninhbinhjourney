"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import type { ReactNode } from "react";
import {
  formatVisitDate,
  formatVisitMoment,
  type TripPassport as TripPassportData,
  type TripPassportLanguage,
} from "@/domain/trip-passport";

function MapWaiting() {
  return <div aria-hidden className="h-full w-full bg-[#e9e4d8]" />;
}

const TripPassportMapCanvas = dynamic(() => import("./trip-passport-map-canvas"), {
  ssr: false,
  loading: MapWaiting,
});

type Audience = "member" | "group";

/**
 * Chữ nói với khách. Không dùng chữ của cái cổng ("soát vé", "quét mã",
 * "điểm chạm", "check-in"), không giục giã, không đếm ngược.
 */
export const TRIP_PASSPORT_COPY = {
  vi: {
    heading: { member: "Những nơi bạn đã đi qua", group: "Những nơi cả đoàn đã đi qua" },
    lead: {
      member: (lit: number, total: number) =>
        lit === 0
          ? "Bản đồ còn mờ, vì bạn chưa vào nơi nào. Tới đâu, nơi ấy sáng lên ở đây."
          : `Bạn đã ghé ${lit} trong ${total} nơi trên tấm bản đồ này. Nơi nào bạn vào, nơi ấy sáng lên.`,
      group: (lit: number, total: number) =>
        lit === 0
          ? "Bản đồ còn mờ, vì chưa ai trong đoàn vào nơi nào bằng mã riêng của mình."
          : `Cả đoàn đã ghé ${lit} trong ${total} nơi. Nơi nào có người trong đoàn vào, nơi ấy sáng lên.`,
    },
    later: { member: "Chờ bạn lần sau", group: "Chờ cả đoàn lần sau" },
    people: (count: number, total: number) => `${count} trong ${total} người đã vào`,
    visitDate: (date: string) => `Ngày đi ${date} · giờ ghi theo giờ Việt Nam`,
    timesOnly: "Giờ ghi theo giờ Việt Nam",
    note: {
      member:
        "Bản đồ chỉ sáng ở nơi có ghi nhận lượt vào bằng mã của bạn, nên chỗ nào bạn ghé mà không đi qua cổng thì không hiện ở đây. Ai cầm mã này cũng mở được trang này, như cầm một tấm vé ạ.",
      group:
        "Bản đồ gộp lượt vào bằng mã riêng của từng người trong đoàn. Ai vào bằng vé chung của đoàn thì lượt ấy không hiện ở đây ạ.",
    },
    mapLabel: (lit: number, total: number) => `Bản đồ Ninh Bình: ${lit} trong ${total} nơi đã sáng`,
  },
  en: {
    heading: { member: "Places you've been", group: "Places your group has been" },
    lead: {
      member: (lit: number, total: number) =>
        lit === 0
          ? "Your map is still dim — you haven't entered any place yet. Wherever you go in, it lights up here."
          : `You've been to ${lit} of the ${total} places on this map. Each place lights up once you've entered.`,
      group: (lit: number, total: number) =>
        lit === 0
          ? "The map is still dim — no one in the group has entered anywhere with their own code yet."
          : `Your group has been to ${lit} of the ${total} places. A place lights up once anyone in the group enters.`,
    },
    later: { member: "For next time", group: "For the group's next trip" },
    people: (count: number, total: number) => `${count} of ${total} people entered`,
    visitDate: (date: string) => `Visit date ${date} · times in Vietnam time`,
    timesOnly: "Times in Vietnam time",
    note: {
      member:
        "The map only lights up where an entry with your code is recorded, so places you wander into without passing a gate won't appear here. Anyone holding this code can open this page, just like a ticket.",
      group:
        "The map combines entries made with each person's own code. Entries on the shared group ticket don't appear here.",
    },
    mapLabel: (lit: number, total: number) => `Map of Ninh Binh: ${lit} of ${total} places lit`,
  },
} as const;

/**
 * TC-10 — tấm bản đồ của riêng một người (hoặc cả đoàn), sáng dần theo nơi
 * đã đi qua. Chỉ trình bày: dữ liệu đã dựng sẵn ở `domain/trip-passport.ts`.
 */
export function TripPassport({
  passport,
  freshIds,
  lang,
  audience,
  headingLevel,
  layout,
  visitDate = "",
  memberCount,
  renderStopExtra,
  children,
}: {
  passport: TripPassportData;
  freshIds: readonly string[];
  lang: TripPassportLanguage;
  audience: Audience;
  headingLevel: 1 | 2;
  layout: "wide" | "stacked";
  visitDate?: string;
  memberCount?: number;
  /**
   * TC-12 — chỗ gắn thêm cho từng nơi đã tới, ví dụ ô chấm sao. Tấm hộ chiếu
   * không biết gì về đánh giá; nó chỉ chừa chỗ.
   */
  renderStopExtra?: (stopId: string, stopName: string) => ReactNode;
  /** Nội dung đi tiếp ngay dưới danh sách, cùng cột với nó trên màn rộng. */
  children?: ReactNode;
}) {
  const copy = TRIP_PASSPORT_COPY[lang];
  const Heading = headingLevel === 1 ? "h1" : "h2";
  const lit = passport.stops.filter((stop) => stop.lit);
  const dim = passport.stops.filter((stop) => !stop.lit);
  const fresh = new Set(freshIds);
  const date = formatVisitDate(visitDate, lang);
  const wide = layout === "wide";

  return (
    <section
      data-testid="trip-passport"
      data-lit-count={passport.litCount}
      aria-labelledby="trip-passport-heading"
    >
      <Heading
        id="trip-passport-heading"
        className={`font-display text-balance leading-[1.05] text-[#183f34] ${
          wide ? "mt-3 text-[2.6rem] sm:text-6xl" : "mt-2 text-3xl sm:text-4xl"
        }`}
      >
        {copy.heading[audience]}
      </Heading>
      <p
        data-testid="trip-passport-lead"
        className={`mt-4 max-w-2xl text-[#3d4a43] ${wide ? "text-lg leading-8" : "text-base leading-7"}`}
      >
        {copy.lead[audience](passport.litCount, passport.totalCount)}
      </p>

      <div className={`mt-8 grid gap-8 ${wide ? "lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-14" : ""}`}>
        <figure className={`min-w-0 ${wide ? "lg:sticky lg:top-10 lg:self-start" : ""}`}>
          <div
            className={`relative isolate z-0 w-full overflow-hidden rounded-[6px] border border-[#183f34]/15 bg-[#e9e4d8] shadow-[0_24px_60px_-32px_rgba(24,63,52,0.45)] ${
              wide ? "aspect-[4/5] sm:aspect-[5/4] lg:aspect-square" : "aspect-[4/5] sm:aspect-[5/4]"
            }`}
            aria-label={copy.mapLabel(passport.litCount, passport.totalCount)}
            role="group"
          >
            <TripPassportMapCanvas stops={passport.stops} freshIds={freshIds} lang={lang} />
          </div>
          <figcaption className="mt-3 text-xs tracking-[0.04em] text-[#6b786f]">
            {date ? copy.visitDate(date) : copy.timesOnly}
          </figcaption>
        </figure>

        <div className="min-w-0">
          {lit.length > 0 ? (
            <ol data-testid="trip-passport-lit" className="border-t border-[#183f34]/15">
              {lit.map((stop) => (
                <li
                  key={stop.id}
                  data-place-id={stop.id}
                  className={`nb-passport-row border-b border-[#183f34]/15 py-4 ${
                    fresh.has(stop.id) ? "is-fresh" : ""
                  }`}
                >
                  <div className="flex items-center gap-4">
                  <span className="relative size-14 shrink-0">
                    <Image
                      src={stop.image}
                      alt=""
                      fill
                      sizes="56px"
                      className="rounded-full object-cover ring-1 ring-[#183f34]/20"
                    />
                    <span className="absolute -bottom-1 -right-1 grid size-6 place-items-center rounded-full border-2 border-[#f4f0e7] bg-[#183f34] text-[11px] font-extrabold tabular-nums text-[#fbfaf6]">
                      {stop.visitOrder}
                    </span>
                  </span>
                  <span className="min-w-0">
                    <span className="font-display block text-xl leading-tight text-[#183f34]">
                      {stop.name[lang]}
                    </span>
                    <span className="mt-1 block text-sm tabular-nums text-[#5b6a61]">
                      {stop.firstVisitAt ? formatVisitMoment(stop.firstVisitAt, lang) : ""}
                      {audience === "group" && memberCount
                        ? ` · ${copy.people(stop.visitorCount, memberCount)}`
                        : ""}
                    </span>
                  </span>
                  </div>
                  {renderStopExtra ? renderStopExtra(stop.id, stop.name[lang]) : null}
                </li>
              ))}
            </ol>
          ) : null}

          {dim.length > 0 ? (
            <div className={lit.length > 0 ? "mt-8" : ""}>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-[#9a6328]">
                {copy.later[audience]}
              </p>
              <ul data-testid="trip-passport-dim" className="mt-2">
                {dim.map((stop) => (
                  <li
                    key={stop.id}
                    data-place-id={stop.id}
                    className="flex items-center gap-4 border-b border-dashed border-[#183f34]/15 py-3"
                  >
                    <span className="relative size-10 shrink-0">
                      <Image
                        src={stop.image}
                        alt=""
                        fill
                        sizes="40px"
                        className="rounded-full object-cover opacity-45 grayscale"
                      />
                    </span>
                    <span className="font-display text-lg leading-tight text-[#6b786f]">
                      {stop.name[lang]}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <p className="mt-8 text-sm leading-6 text-[#5b6a61]">{copy.note[audience]}</p>
          {children}
        </div>
      </div>
    </section>
  );
}
