"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { TripPassport } from "@/components/commerce/trip-passport";
import {
  buildTripPassport,
  litPlaceIds,
  newlyLitPlaceIds,
  type TripPassportLanguage,
} from "@/domain/trip-passport";
import {
  VISITOR_GROUP_MEMBER_CODE_PATTERN,
  type VisitorGroupMemberJourney,
} from "@/domain/visitor-group";

type MemberApiResponse =
  | { accepted: true; member: { memberCode: string; displayName: string; activated: boolean } }
  | { accepted: false; error?: { message?: string } };

type JourneyApiResponse =
  | { accepted: true; journey: VisitorGroupMemberJourney }
  | { accepted: false; error?: { code?: string; message?: string } };

type JourneyState =
  | { kind: "loading" }
  | { kind: "not-found" }
  | { kind: "not-ready" }
  | { kind: "unavailable" }
  | { kind: "ready"; journey: VisitorGroupMemberJourney; freshIds: string[] };

/**
 * Nhịp làm mới: mười lăm giây một lượt, và CHỈ khi tab đang mở trước mắt.
 *
 * Khách giơ điện thoại ở cổng rồi nhìn lại màn hình — mười lăm giây là đủ để
 * thấy nơi vừa vào sáng lên. Tab bị ẩn thì thôi hỏi; quay lại là hỏi ngay một
 * lượt rồi mới đi tiếp nhịp cũ.
 */
export const MEMBER_JOURNEY_REFRESH_INTERVAL_MS = 15_000;

const COPY = {
  vi: {
    kicker: "Ninh Bình Journey · Khách đoàn",
    loading: "Đang mở bản đồ của bạn…",
    notFound: {
      title: "Em không tìm thấy mã này",
      body: "Mời bạn kiểm tra lại đường dẫn, hoặc hỏi lại người đã gửi mã cho mình ạ.",
    },
    notReady: {
      title: "Tấm bản đồ này sắp có",
      body: "Chúng tôi đang mở dần phần này. Xong là những nơi bạn đã đi qua hiện ngay ở đây, còn việc vào cổng của bạn vẫn bình thường ạ.",
    },
    unavailable: {
      title: "Bản đồ chưa tải về kịp",
      body: "Trang tự thử lại sau ít giây, bạn không cần làm gì thêm ạ.",
    },
    passportHeading: "Những nơi bạn đã đi qua",
    nameHeading: "Ghi tên bạn vào chuyến đi này",
    optionalTitle: "Không ghi tên, bạn vẫn vào cổng bình thường",
    optionalBody:
      "Đây là chỗ để bạn ghi tên nếu muốn, không phải điều kiện để qua cổng. Bỏ trống, bạn vẫn vào các điểm tham quan như mọi khách khác trong đoàn.",
    nameLabel: "Tên của bạn (không bắt buộc)",
    namePlaceholder: "Ví dụ: Nguyễn Thị B",
    save: "Lưu tên",
    saving: "Đang lưu…",
    clear: "Xoá tên đã ghi",
    saved: (name: string) => `Dạ, đã ghi tên "${name}" vào chuyến đi này.`,
    cleared: "Đã xoá tên khỏi mã này. Bạn vẫn vào cổng bình thường ạ.",
    saveFailed: "Chưa lưu được, mời bạn thử lại.",
    codeLabel: "Mã của bạn",
    transfer: "Bận không đi được thì cứ đưa mã này cho người đi thay bạn, cổng vẫn cho vào bình thường ạ.",
  },
  en: {
    kicker: "Ninh Bình Journey · Group guest",
    loading: "Opening your map…",
    notFound: {
      title: "We couldn't find this code",
      body: "Please check the link, or ask the person who sent you the code.",
    },
    notReady: {
      title: "Your map is on its way",
      body: "We're still opening this part. Once it's ready, the places you've been will show up here — your entry at every gate works as usual.",
    },
    unavailable: {
      title: "The map hasn't loaded yet",
      body: "This page will try again in a few seconds — nothing for you to do.",
    },
    passportHeading: "Places you've been",
    nameHeading: "Add your name to this trip",
    optionalTitle: "No name needed to get through the gate",
    optionalBody:
      "This is a place to add your name if you'd like, not a condition for entry. Leave it blank and you'll still visit every stop like everyone else in your group.",
    nameLabel: "Your name (optional)",
    namePlaceholder: "e.g. Jane Nguyen",
    save: "Save name",
    saving: "Saving…",
    clear: "Remove saved name",
    saved: (name: string) => `Your name "${name}" has been added to this trip.`,
    cleared: "Your name has been removed from this code. You'll still get in as usual.",
    saveFailed: "We couldn't save that — please try again.",
    codeLabel: "Your code",
    transfer: "Can't make it? Just pass this code to whoever goes in your place — they'll get in as usual.",
  },
} as const;

/**
 * TC-06 + TC-10 — nơi mã QR trên tấm thẻ của mỗi người trỏ tới.
 *
 * Trên cùng là tấm bản đồ những nơi chính người cầm mã đã đi qua; bên dưới là
 * chỗ ghi tên, tự nguyện, không phải cửa vào cổng. Trang phải nói rõ điều đó
 * ngay từ đầu, không phải một dòng chú thích nhỏ ở cuối.
 */
export function VisitorGroupMemberExperience({
  memberCode,
  lang = "vi",
}: {
  memberCode: string;
  lang?: TripPassportLanguage;
}) {
  const copy = COPY[lang];
  const code = memberCode.trim();
  const validFormat = VISITOR_GROUP_MEMBER_CODE_PATTERN.test(code);

  const [journey, setJourney] = useState<JourneyState>(
    validFormat ? { kind: "loading" } : { kind: "not-found" },
  );
  const [displayName, setDisplayName] = useState("");
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  // Khách đã gõ vào ô tên thì lượt làm mới bản đồ không được ghi đè lên.
  const nameTouched = useRef(false);

  useEffect(() => {
    if (!validFormat) return;
    let alive = true;
    let stopped = false;
    let timer: number | null = null;
    let sequence = 0;
    let shown = false;
    let previousLit: Set<string> | null = null;

    function stopTimer() {
      if (timer !== null) {
        window.clearInterval(timer);
        timer = null;
      }
    }
    function startTimer() {
      if (timer === null && !stopped) {
        timer = window.setInterval(() => void load(), MEMBER_JOURNEY_REFRESH_INTERVAL_MS);
      }
    }

    async function load() {
      const mine = ++sequence;
      try {
        const response = await fetch(
          `/api/customer-group-members?member_code=${encodeURIComponent(code)}`,
          { credentials: "same-origin", cache: "no-store" },
        );
        const payload = (await response.json().catch(() => null)) as JourneyApiResponse | null;
        // Lượt cũ về muộn hơn lượt mới thì bỏ, đừng để bản đồ lùi lại.
        if (!alive || mine !== sequence) return;
        if (response.ok && payload?.accepted) {
          const passport = buildTripPassport(payload.journey.entries);
          const freshIds = newlyLitPlaceIds(previousLit, passport);
          previousLit = litPlaceIds(passport);
          if (!shown && !nameTouched.current) setDisplayName(payload.journey.displayName);
          shown = true;
          setJourney({ kind: "ready", journey: payload.journey, freshIds });
          return;
        }
        const errorCode = payload && !payload.accepted ? payload.error?.code : undefined;
        if (response.status === 404) {
          stopped = true;
          stopTimer();
          setJourney({ kind: "not-found" });
          return;
        }
        if (errorCode === "CUSTOMER_BOOKING_DISABLED") {
          stopped = true;
          stopTimer();
          if (!shown) setJourney({ kind: "not-ready" });
          return;
        }
        // Hàm đọc chưa được áp: cứ hỏi tiếp theo nhịp cũ, để trang tự chuyển
        // sang bản đồ ngay khi phần này mở, không bắt khách tải lại.
        if (errorCode === "VISITOR_GROUP_JOURNEY_NOT_READY") {
          if (!shown) setJourney({ kind: "not-ready" });
          return;
        }
        // Lượt làm mới hỏng thì GIỮ NGUYÊN bản đồ đang hiện.
        if (!shown) setJourney({ kind: "unavailable" });
      } catch {
        if (alive && mine === sequence && !shown) setJourney({ kind: "unavailable" });
      }
    }

    function onVisibilityChange() {
      if (stopped) return;
      if (document.visibilityState === "visible") {
        void load();
        startTimer();
      } else {
        stopTimer();
      }
    }

    void load();
    if (document.visibilityState === "visible") startTimer();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      alive = false;
      stopTimer();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [code, validFormat]);

  const passport = useMemo(
    () => (journey.kind === "ready" ? buildTripPassport(journey.journey.entries) : null),
    [journey],
  );

  async function save(nameToSend: string) {
    if (pending) return;
    setPending(true);
    setStatus(null);
    try {
      const response = await fetch("/api/customer-group-members", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ member_code: memberCode, display_name: nameToSend.trim() }),
      });
      const payload = (await response.json().catch(() => null)) as MemberApiResponse | null;
      if (!response.ok || !payload?.accepted) {
        setStatus({
          tone: "error",
          text:
            (lang === "vi" && payload && !payload.accepted && payload.error?.message) || copy.saveFailed,
        });
        return;
      }
      setDisplayName(payload.member.displayName);
      setStatus({
        tone: "success",
        text: payload.member.displayName ? copy.saved(payload.member.displayName) : copy.cleared,
      });
    } catch {
      setStatus({ tone: "error", text: copy.saveFailed });
    } finally {
      setPending(false);
    }
  }

  function renderNameSection(className: string) {
    return (
      <section aria-labelledby="member-name-heading" className={className}>
        <h2 id="member-name-heading" className="font-display text-3xl leading-tight text-[#183f34]">
          {copy.nameHeading}
        </h2>

        <div className="mt-5 rounded-2xl border border-[#ddb77d] bg-[#fff8eb] p-5 text-[#6c4b1f]">
          <p className="font-bold">{copy.optionalTitle}</p>
          <p className="mt-2 text-sm leading-6">{copy.optionalBody}</p>
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            void save(displayName);
          }}
          className="mt-7 space-y-4"
        >
          <label className="block text-sm font-bold text-[#27362f]">
            {copy.nameLabel}
            <input
              value={displayName}
              onChange={(event) => {
                nameTouched.current = true;
                setDisplayName(event.target.value);
              }}
              placeholder={copy.namePlaceholder}
              className="mt-2 min-h-12 w-full rounded-xl border border-[#bec7bf] bg-white px-4 font-normal text-[#27362f]"
            />
          </label>

          {status ? (
            <p
              role={status.tone === "error" ? "alert" : "status"}
              className={`text-sm leading-6 ${status.tone === "error" ? "text-[#9a3b2f]" : "text-[#1f6b45]"}`}
            >
              {status.text}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={pending}
              className="min-h-12 flex-1 rounded-full bg-[#183f34] px-6 font-extrabold text-white transition-colors hover:bg-[#122e26] disabled:opacity-50"
            >
              {pending ? copy.saving : copy.save}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                nameTouched.current = true;
                setDisplayName("");
                void save("");
              }}
              className="min-h-12 rounded-full border border-[#bec7bf] px-6 font-bold text-[#27362f] transition-colors hover:border-[#183f34] disabled:opacity-50"
            >
              {copy.clear}
            </button>
          </div>
        </form>

        <p className="mt-8 text-xs leading-5 text-[#6b786f]">
          {copy.codeLabel} · <code className="font-mono">{memberCode}</code>
        </p>
        <p className="mt-2 text-xs leading-5 text-[#6b786f]">{copy.transfer}</p>
      </section>
    );
  }

  return (
    <main lang={lang} className="min-h-screen bg-[#f4f0e7] px-5 py-10 text-[#151a17] sm:px-8 lg:py-16">
      <div className="mx-auto max-w-6xl">
        <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-[#9a6328]">{copy.kicker}</p>

        {journey.kind === "ready" && passport ? (
          <TripPassport
            passport={passport}
            freshIds={journey.freshIds}
            lang={lang}
            audience="member"
            headingLevel={1}
            layout="wide"
            visitDate={journey.journey.visitDate}
          >
            {/* Trên màn rộng, chỗ ghi tên nằm cùng cột với danh sách, cạnh bản
                đồ; trên điện thoại nó đi tiếp ngay bên dưới. */}
            {renderNameSection("mt-12 border-t border-[#183f34]/15 pt-10")}
          </TripPassport>
        ) : (
          <section data-testid="trip-passport-state" data-state={journey.kind} aria-labelledby="trip-passport-heading">
            <h1
              id="trip-passport-heading"
              className="font-display mt-3 text-[2.6rem] leading-[1.05] text-[#183f34] sm:text-6xl"
            >
              {copy.passportHeading}
            </h1>
            {journey.kind === "loading" ? (
              <p role="status" className="mt-4 text-lg leading-8 text-[#3d4a43]">{copy.loading}</p>
            ) : (
              <div
                role={journey.kind === "not-found" ? "alert" : "status"}
                className="mt-6 max-w-2xl border-l-2 border-[#c89a55] pl-5"
              >
                <p className="font-display text-2xl leading-snug text-[#183f34]">
                  {copy[journey.kind === "not-found" ? "notFound" : journey.kind === "not-ready" ? "notReady" : "unavailable"].title}
                </p>
                <p className="mt-2 text-base leading-7 text-[#3d4a43]">
                  {copy[journey.kind === "not-found" ? "notFound" : journey.kind === "not-ready" ? "notReady" : "unavailable"].body}
                </p>
              </div>
            )}
          </section>
        )}

        {journey.kind === "ready"
          ? null
          : renderNameSection("mt-14 max-w-lg border-t border-[#183f34]/15 pt-10 lg:mt-20")}
      </div>
    </main>
  );
}
