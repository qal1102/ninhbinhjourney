"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { CONTACT } from "@/content/contact";
import {
  parseJourneyIntent,
  REQUIRED_VIETNAMESE_SAMPLE,
} from "@/domain/journey";
import {
  matchPackagesToIntent,
  PACKAGE_MATCH_REASON_LABEL,
  PACKAGE_NO_MATCH_LABEL,
  type PackageMatchResult,
} from "@/domain/package-match";
import type {
  Itinerary,
  JourneyIntent,
  JourneyIntentDraft,
} from "@/domain/models";
import { ItineraryEditor } from "./itinerary-editor";
import { formatVietnameseDate } from "@/lib/vietnamese-date";

const PLAN_RESULT_STORAGE_KEY = "nbj-plan-result";
const PLAN_RESULT_STORAGE_VERSION = 1;

type Language = "vi" | "en";

type VoiceState =
  | "idle"
  | "listening"
  | "transcribing"
  | "stopped"
  | "denied"
  | "unsupported"
  | "error"
  | "demo";

type SpeechResultEvent = {
  results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }>;
};

type SpeechErrorEvent = { error: string };

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onstart: (() => void) | null;
  onresult: ((event: SpeechResultEvent) => void) | null;
  onerror: ((event: SpeechErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

/*
 * Bốn lối vào bấm một cái là chạy.
 *
 * Trước đây trang này mở ra bằng một ô trống rồi **chín ô nữa** phải điền
 * trước khi khách thấy được bất cứ thứ gì. Chủ dự án nói đúng chỗ đau: người
 * mới tới một vùng đất còn chưa biết mình muốn gì, hỏi họ chín câu thì họ
 * đóng trang. Nếp chung của các trang du lịch lớn là ngược lại — cho xem kết
 * quả trước, rồi mới cho chỉnh; ô nhập chi tiết là lối lui, không phải cửa
 * chính.
 *
 * Câu chữ dưới đây KHÔNG phải viết cho hay. Chúng là những câu bộ phân tích
 * **thật sự đọc được**: nó dò "một ngày", "N giờ", "bố mẹ", "2 người lớn",
 * "ít đi bộ". Đặt một câu nghe tự nhiên mà nó không hiểu thì bấm vào ra toàn
 * giá trị mặc định, và khách sẽ tưởng trang hỏng. Sửa câu nào ở đây thì thử
 * lại câu đó với `parseJourneyIntent` trước.
 */
/** Chữ cho dòng tóm tắt — nói bằng lời người, không phải bằng khoá dữ liệu. */
const PACE_SUMMARY: Record<NonNullable<JourneyIntent["pace"]>, string> = {
  relaxed: "Nhịp thư thả",
  balanced: "Nhịp cân bằng",
  active: "Nhịp năng động",
};

const WALKING_SUMMARY: Record<
  NonNullable<JourneyIntent["walkingTolerance"]>,
  string
> = {
  low: "ít đi bộ",
  moderate: "đi bộ vừa phải",
  high: "đi bộ nhiều được",
};

/**
 * Đúng những mức thời lượng ô chọn đang có. Khách gõ "7 tiếng" thì máy đọc ra
 * 420 phút — một giá trị không nằm trong danh sách, và ô chọn hiện ra trống
 * trơn. Kéo về mức gần nhất rồi hiện lên, để khách còn thấy mình đang bị hiểu
 * thành gì mà sửa.
 */
const DURATION_CHOICES = [300, 360, 480, 600] as const;

function nearestDurationChoice(minutes: number) {
  return DURATION_CHOICES.reduce((best, choice) =>
    Math.abs(choice - minutes) < Math.abs(best - minutes) ? choice : best,
  );
}

const PRESETS = [
  {
    id: "lan-dau",
    title: { vi: "Lần đầu tới, có một ngày", en: "First time, one day" },
    hint: { vi: "Đi vừa phải, xem được nhiều", en: "Steady pace, see a lot" },
    text: "Tôi có một ngày ở Ninh Bình, lần đầu tới đây, muốn đi vừa phải.",
  },
  {
    id: "bo-me",
    title: { vi: "Đi cùng bố mẹ", en: "With my parents" },
    hint: { vi: "Nhẹ nhàng, ít đi bộ", en: "Gentle, little walking" },
    text: REQUIRED_VIETNAMESE_SAMPLE,
  },
  {
    id: "gia-dinh",
    title: { vi: "Cả nhà có trẻ nhỏ", en: "Family with children" },
    hint: { vi: "Hai lớn hai nhỏ, một ngày", en: "Two adults, two children" },
    text: "Gia đình tôi có 2 người lớn và 2 trẻ em, muốn một ngày cân bằng ở Ninh Bình.",
  },
  {
    id: "chup-anh",
    title: { vi: "Đi chụp ảnh", en: "Here for the photographs" },
    hint: { vi: "Sáu tiếng, thiên nhiên", en: "Six hours, landscapes" },
    text: "Tôi có 6 giờ, thích thiên nhiên và nhiếp ảnh, muốn đi bộ vừa phải.",
  },
  {
    id: "hai-vo-chong",
    title: { vi: "Hai vợ chồng", en: "Just the two of us" },
    hint: { vi: "Một ngày cho hai người", en: "One day for two" },
    text: "Hai vợ chồng tôi có một ngày, muốn nhẹ nhàng và ít đi bộ.",
  },
  {
    id: "mot-minh",
    title: { vi: "Đi một mình", en: "Travelling alone" },
    hint: { vi: "Trọn ngày, đi bộ nhiều", en: "A full day, plenty of walking" },
    text: "Tôi đi một mình, có một ngày, muốn đi bộ nhiều và thích thiên nhiên.",
  },
] as const;

/*
 * Chữ cho khối "gói hợp với bạn".
 *
 * Viết tiếng Việt trước rồi mới dịch sang tiếng Anh, theo đúng lối
 * `content/destinations.ts` và `components/discovery/package-showcase.tsx`
 * đang làm. Giọng phải giữ đúng mức khiêm tốn: đây là phép so khớp từ khoá
 * có luật rõ ràng, không phải máy hiểu tiếng người, nên chữ trên màn hình
 * không được hứa quá điều nó làm.
 */
const MATCH_COPY: Record<
  Language,
  {
    eyebrow: string;
    title: string;
    emptyTitle: string;
    method: string;
    strong: string;
    partial: string;
    detail: string;
    viewAll: string;
    call: string;
    emptyGuide: string;
    emptyGeneric: string;
  }
> = {
  vi: {
    eyebrow: "Dựa trên điều bạn vừa kể",
    title: "Gói hợp với bạn",
    emptyTitle: "Lần này chưa có gói nào hợp",
    method:
      "Chúng tôi dò từ khoá trong câu bạn viết, rồi đối chiếu nhịp đi, thời lượng, người đi cùng với năm gói có sẵn. Giá đứng ngoài phép so này, vì giá trên trang gói mới chỉ là dữ liệu minh hoạ.",
    strong: "Hợp rõ",
    partial: "Hợp một phần",
    detail: "Xem gói này",
    viewAll: "Xem cả năm gói",
    call: `Gọi ${CONTACT.phoneLabel}`,
    emptyGuide:
      "Mời bạn xem hết năm gói, hoặc gọi cho chúng tôi một tiếng để xếp riêng một ngày theo đúng ý bạn.",
    emptyGeneric: "Chưa gói nào hợp với điều bạn vừa kể.",
  },
  en: {
    eyebrow: "From what you just told us",
    title: "Packages that fit",
    emptyTitle: "Nothing fits this time",
    method:
      "We look for keywords in your sentence, then hold them against the pace, the length and the intended guests of the five packages we run. Price stays out of it: the figures on the package pages are illustrative.",
    strong: "Close fit",
    partial: "Partial fit",
    detail: "See this package",
    viewAll: "See all five packages",
    call: `Call ${CONTACT.phoneLabel}`,
    emptyGuide:
      "Do look through all five packages, or give us a ring and we will lay out a day around what you described.",
    emptyGeneric: "Nothing here fits what you just described.",
  },
};

function PackageMatchPanel({
  lang,
  result,
}: {
  lang: Language;
  result: PackageMatchResult;
}) {
  const copy = MATCH_COPY[lang];
  const matched = result.matches.length > 0;

  return (
    <section
      data-plan-package-match={matched ? "matched" : "empty"}
      className="mt-7 border-t border-[#dedbd2] pt-7"
    >
      <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-[#356957]">
        {copy.eyebrow}
      </p>
      <h3 className="font-display mt-3 text-2xl text-[#183f34]">
        {matched ? copy.title : copy.emptyTitle}
      </h3>
      <p className="mt-3 text-sm leading-6 text-[#59654b]">{copy.method}</p>

      {matched ? (
        <ul className="mt-5 grid gap-4">
          {result.matches.map((match) => (
            <li
              key={match.slug}
              data-plan-package-slug={match.slug}
              className="rounded-2xl border border-[#dedbd2] bg-[#fbfaf6] p-4"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-display text-xl text-[#183f34]">
                  {match.name}
                </p>
                <span className="rounded-full bg-[#eef3ef] px-3 py-1 text-xs font-bold text-[#356957]">
                  {match.strength === "strong" ? copy.strong : copy.partial}
                </span>
              </div>
              <ul className="mt-3 grid gap-1 text-sm leading-6">
                {match.reasons.map((reason) => (
                  <li key={reason}>
                    · {PACKAGE_MATCH_REASON_LABEL[reason][lang]}
                  </li>
                ))}
              </ul>
              <Link
                data-customer-track="planner-package-match"
                data-customer-content-id={match.item.id}
                data-customer-content-type="package"
                href={`/packages/${match.slug}?lang=${lang}`}
                className="mt-4 inline-flex min-h-11 items-center rounded-full bg-[#183f34] px-5 text-sm font-bold text-white"
              >
                {copy.detail}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-4 rounded-2xl bg-[#f4f0e7] p-4 text-sm leading-6">
          <p>
            {result.noMatchReason
              ? PACKAGE_NO_MATCH_LABEL[result.noMatchReason][lang]
              : copy.emptyGeneric}
          </p>
          <p className="mt-2">{copy.emptyGuide}</p>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-3">
        <Link
          data-customer-track="planner-packages-view-all"
          data-customer-content-id="packages-catalog"
          data-customer-content-type="secondary-cta"
          href={`/packages?lang=${lang}`}
          className="inline-flex min-h-11 items-center rounded-full border border-[#183f34] px-5 text-sm font-bold text-[#183f34]"
        >
          {copy.viewAll}
        </Link>
        <a
          data-customer-track="planner-packages-call"
          href={CONTACT.phoneHref}
          className="inline-flex min-h-11 items-center rounded-full border border-[#c9ccc5] px-5 text-sm font-bold text-[#183f34]"
        >
          {copy.call}
        </a>
      </div>
    </section>
  );
}

/** Local (Asia/Ho_Chi_Minh) calendar date, offset by whole days. */
function localDateInDays(offsetDays: number) {
  const now = new Date();
  const local = new Date(
    now.getTime() + 7 * 60 * 60 * 1000 + offsetDays * 24 * 60 * 60 * 1000,
  );
  return local.toISOString().slice(0, 10);
}

export function PlanExperience({
  showDemoCommand,
  identityCollectionEnabled,
  lang = "vi",
}: {
  showDemoCommand: boolean;
  identityCollectionEnabled: boolean;
  lang?: Language;
}) {
  const [text, setText] = useState("");
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [draft, setDraft] = useState<JourneyIntentDraft | null>(null);
  const [visitDate, setVisitDate] = useState("");
  const [minVisitDate, setMinVisitDate] = useState("");
  const [showDetails, setShowDetails] = useState(false);
  const [durationMinutes, setDurationMinutes] = useState(600);
  const [adults, setAdults] = useState(3);
  const [children, setChildren] = useState(0);
  const [seniors, setSeniors] = useState(0);
  const [pace, setPace] = useState<JourneyIntent["pace"]>("relaxed");
  const [walking, setWalking] =
    useState<JourneyIntent["walkingTolerance"]>("low");
  const [budget, setBudget] = useState(2_000_000);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  // True while the visitor still wants the mic open. Chrome (and others) will
  // auto-stop a `continuous` recognizer after a stretch of silence even though
  // no one tapped stop; onend below checks this flag to tell "browser cut me
  // off mid-sentence" apart from "visitor tapped stop / denied / hard error".
  const keepListeningRef = useRef(false);

  useEffect(() => {
    return () => {
      keepListeningRef.current = false;
      recognitionRef.current?.stop();
    };
  }, []);
  const [result, setResult] = useState<{
    intent: JourneyIntent;
    itinerary: Itinerary;
    persisted: boolean;
    persistence: "browser" | "demo" | "anonymous";
  } | null>(null);

  // QA-P2-09: bấm "Dùng hành trình này" sang trang gói rồi quay lại thì lịch
  // vừa dựng mất sạch, khách phải kể lại từ đầu. Nhớ nó trong phiên của tab
  // này; đóng tab là hết. Bấm "Chỉnh yêu cầu" thì xoá.
  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(PLAN_RESULT_STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as { version?: number; value?: typeof result };
      const value = saved?.version === PLAN_RESULT_STORAGE_VERSION ? saved.value : null;
      if (value && Array.isArray(value.itinerary?.items) && typeof value.intent?.durationMinutes === "number") {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- khôi phục lịch vừa dựng sau khi dựng xong trang, tránh lệch HTML máy chủ
        setResult(value);
      }
    } catch {
      // Trình duyệt chặn bộ nhớ phiên thì khách dựng lại, không hỏng gì.
    }
  }, []);

  useEffect(() => {
    try {
      if (result) {
        window.sessionStorage.setItem(
          PLAN_RESULT_STORAGE_KEY,
          JSON.stringify({ version: PLAN_RESULT_STORAGE_VERSION, value: result }),
        );
      } else {
        window.sessionStorage.removeItem(PLAN_RESULT_STORAGE_KEY);
      }
    } catch {
      // Như trên.
    }
  }, [result]);

  // Ghép lại mỗi lần khách sửa một ô, chứ không chỉ lúc bấm "hiểu yêu cầu":
  // khách chỉnh nhịp đi hay số người là thấy danh sách gói đổi theo ngay.
  const packageMatch = useMemo(() => {
    if (!draft) return null;
    return matchPackagesToIntent({
      pace,
      durationMinutes,
      party: { adults, children, seniors },
      partyContext: draft.partyContext ?? [],
      visitDate: visitDate || undefined,
    });
  }, [
    draft,
    pace,
    durationMinutes,
    adults,
    children,
    seniors,
    visitDate,
  ]);

  // `source` cho phép bấm một thẻ gợi ý là chạy ngay trong cùng một nhịp.
  // Gọi `setText()` rồi `parseText()` thì `parseText` vẫn đọc giá trị cũ của
  // lần dựng trước -- lỗi kinh điển, và ở đây nó biểu hiện thành "bấm thẻ mà
  // ra kết quả của thẻ bấm trước đó".
  function parseText(source?: string) {
    const parsed = parseJourneyIntent({ text: source ?? text, locale: lang });
    setDraft(parsed);
    // Resolved here rather than on mount: the date field only exists after this
    // click, so today's date never has to match server-rendered markup.
    setMinVisitDate(localDateInDays(0));
    setVisitDate(
      (current) => parsed.visitDate ?? (current || localDateInDays(7)),
    );
    setDurationMinutes(
      parsed.durationMinutes ? nearestDurationChoice(parsed.durationMinutes) : 600,
    );
    setAdults(parsed.party?.adults ?? 1);
    setChildren(parsed.party?.children ?? 0);
    setSeniors(parsed.party?.seniors ?? 0);
    setPace(parsed.pace ?? "balanced");
    setWalking(parsed.walkingTolerance ?? "moderate");
    setBudget(parsed.budgetVnd?.target ?? 2_000_000);
    setMessage(
      "Đây là những gì chúng tôi hiểu được. Bạn xem giúp có đúng không, chưa có gì được lưu lại cả.",
    );
  }

  function stopVoice() {
    keepListeningRef.current = false;
    recognitionRef.current?.stop();
  }

  function startVoice() {
    if (voiceState === "listening") {
      stopVoice();
      return;
    }

    const Recognition = (
      window as typeof window & {
        SpeechRecognition?: SpeechRecognitionConstructor;
        webkitSpeechRecognition?: SpeechRecognitionConstructor;
      }
    ).SpeechRecognition ??
      (
        window as typeof window & {
          webkitSpeechRecognition?: SpeechRecognitionConstructor;
        }
      ).webkitSpeechRecognition;
    if (!Recognition) {
      setVoiceState("unsupported");
      setMessage(
        "Trình duyệt không hỗ trợ nhận dạng giọng nói. Toàn bộ luồng vẫn dùng được bằng văn bản.",
      );
      return;
    }
    const recognition = new Recognition();
    // Trang này chưa có công tắc chọn ngôn ngữ hiển thị, nên lấy đúng ngôn ngữ
    // trình duyệt của khách thay vì ghim cứng vi-VN — trước đây khách nói tiếng
    // Anh vẫn bị nhận dạng bằng mô hình tiếng Việt nên ra chữ sai lung tung.
    recognition.lang = navigator.language?.toLowerCase().startsWith("en")
      ? "en-US"
      : "vi-VN";
    recognition.interimResults = true;
    // continuous=true giữ mic mở qua những chỗ ngừng tự nhiên giữa câu; để
    // false thì trình duyệt đóng cả phiên ngay khi gặp một quãng lặng, đúng
    // như phàn nàn "chưa nói xong nó đã tắt".
    recognition.continuous = true;
    recognition.onstart = () => setVoiceState("listening");
    recognition.onresult = (event) => {
      setVoiceState("transcribing");
      const transcript = Array.from(event.results)
        .map((result) => result[0]?.transcript ?? "")
        .join(" ")
        .trim();
      if (transcript) setText(transcript);
    };
    recognition.onerror = (event) => {
      keepListeningRef.current = false;
      setVoiceState(event.error === "not-allowed" ? "denied" : "error");
      setMessage(
        event.error === "not-allowed"
          ? "Quyền microphone bị từ chối. Hãy tiếp tục bằng ô văn bản."
          : "Không thể nhận dạng giọng nói. Hãy tiếp tục bằng ô văn bản.",
      );
    };
    recognition.onend = () => {
      // Ngay cả khi continuous=true, một số trình duyệt vẫn tự ngắt phiên sau
      // một quãng lặng dài mà khách không hề bấm dừng. Còn muốn nghe thì nối
      // lại ngay; chỉ dừng thật khi khách tự bấm, bị từ chối quyền, hoặc gặp lỗi.
      if (keepListeningRef.current) {
        try {
          recognition.start();
          return;
        } catch {
          // Trình duyệt từ chối nối lại (ví dụ tab vừa mất focus) — coi như dừng.
        }
      }
      setVoiceState((current) =>
        current === "denied" || current === "error" ? current : "stopped",
      );
    };
    keepListeningRef.current = true;
    recognitionRef.current = recognition;
    recognition.start();
  }

  async function confirmAndGenerate() {
    if (!draft) return;
    setPending(true);
    setMessage("");
    try {
      const response = await fetch("/api/journeys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          locale: lang,
          durationMinutes,
          party: { adults, children, seniors },
          partyContext: draft.partyContext ?? [],
          pace,
          walkingTolerance: walking,
          budgetVnd: { target: budget, tolerancePercent: 20 },
          visitDate,
        }),
      });
      const payload = (await response.json()) as {
        intent?: JourneyIntent;
        itinerary?: Itinerary;
        persisted?: boolean;
        persistence?: "browser" | "demo" | "anonymous";
        error?: { message: string };
      };
      if (!response.ok || !payload.intent || !payload.itinerary) {
        throw new Error(
          payload.error?.message ?? "Chưa thể tạo hành trình. Hãy thử lại.",
        );
      }
      setResult({
        intent: payload.intent,
        itinerary: payload.itinerary,
        // The legacy editor can persist subsequent edits only inside a demo
        // room. CUS-03 still stores the confirmed anonymous original safely;
        // later browser edits remain local until their dedicated revision
        // contract exists, rather than silently mutating the saved record.
        persisted: payload.persistence === "demo",
        persistence: payload.persistence ?? "browser",
      });
      setMessage("");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Chưa thể tạo hành trình. Hãy thử lại.",
      );
    } finally {
      setPending(false);
    }
  }

  if (result) {
    return (
      <div>
        <button
          data-customer-track="planner-parse-intent"
          data-customer-content-id="journey-intent"
          data-customer-content-type="planner-action"
          type="button"
          onClick={() => setResult(null)}
          className="mb-6 min-h-11 rounded-full border border-[#183f34] px-4 text-sm font-bold"
        >
          ← Chỉnh yêu cầu
        </button>
        <ItineraryEditor
          initialItinerary={result.itinerary}
          intent={result.intent}
          persisted={result.persisted}
          savedAnonymously={result.persistence === "anonymous"}
          identityCollectionEnabled={identityCollectionEnabled}
        />
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[0.82fr_1.18fr]">
      <section className="rounded-3xl bg-[#183f34] p-6 text-white sm:p-8">
        <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-[#e7c78d]">
          Nói hoặc gõ · đều dùng được
        </p>
        <h2 className="font-display mt-4 text-4xl leading-tight sm:text-5xl">
          Kể về ngày bạn muốn có.
        </h2>
        <button
          type="button"
          onClick={startVoice}
          className={`mx-auto mt-9 grid aspect-square w-40 place-items-center rounded-full border-8 text-center font-extrabold shadow-2xl transition ${
            voiceState === "listening"
              ? "animate-pulse border-[#e7c78d]/35 bg-[#d58c35] text-[#151a17]"
              : "border-white/10 bg-white/8"
          }`}
        >
          <span>
            <span className="block text-4xl" aria-hidden="true">
              ◉
            </span>
            <span className="mt-2 block text-sm">
              {voiceState === "listening"
                ? "Đang nghe, bấm lại để dừng"
                : "Dùng microphone"}
            </span>
          </span>
        </button>
        <p className="mt-6 text-center text-sm leading-6 text-white/62">
          {/* Trạng thái máy (`idle`/`listening`) là chữ dành cho lập trình
              viên. Khách chỉ cần biết hai điều: giọng nói không bị lưu lại, và
              micro chỉ bật khi họ chủ động bấm. */}
          Giọng nói của bạn không được lưu lại. Micro chỉ bật sau khi bạn bấm
          nút.
        </p>
        {showDemoCommand ? (
          <button
          type="button"
          onClick={() => {
            setText(REQUIRED_VIETNAMESE_SAMPLE);
            setVoiceState("demo");
            setMessage(
              "Đã nạp transcript mẫu xác định; không có âm thanh nào đang được xử lý.",
            );
          }}
          className="mt-5 min-h-11 w-full rounded-full border border-white/25 px-4 text-sm font-bold"
          >
            Run demo command
          </button>
        ) : null}
      </section>

      <section className="rounded-3xl border border-[#d7d5cd] bg-white p-6 shadow-sm sm:p-8">
        <h2 className="font-display text-2xl text-[#183f34]">
          Bạn định đi kiểu gì?
        </h2>
        <p className="mt-2 text-sm leading-6 text-[#59654b]">
          Chọn một tình huống gần với bạn nhất, chúng tôi xếp thử một ngày rồi
          bạn chỉnh sau. Hoặc bạn cứ kể bằng lời của mình ở ô bên dưới.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              data-plan-preset={preset.id}
              onClick={() => {
                setText(preset.text);
                parseText(preset.text);
              }}
              className="rounded-2xl border border-[#dedbd2] bg-[#fbfaf6] p-4 text-left transition-colors hover:border-[#356957]"
            >
              <span className="block font-bold text-[#183f34]">
                {preset.title[lang]}
              </span>
              <span className="mt-1 block text-sm text-[#6b7660]">
                {preset.hint[lang]}
              </span>
            </button>
          ))}
        </div>

        <label
          htmlFor="journey-text"
          className="mt-7 block border-t border-[#dedbd2] pt-6 text-sm font-bold text-[#43564d]"
        >
          Hoặc kể bằng lời của bạn
        </label>
        <textarea
          id="journey-text"
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setDraft(null);
          }}
          rows={5}
          maxLength={4000}
          placeholder={REQUIRED_VIETNAMESE_SAMPLE}
          className="mt-4 w-full rounded-2xl border border-[#c9ccc5] p-4 leading-7 outline-none focus:border-[#183f34]"
        />
        <button
          type="button"
          onClick={() => parseText()}
          disabled={text.trim().length < 2}
          className="mt-5 min-h-12 rounded-full bg-[#183f34] px-6 font-bold text-white disabled:opacity-40"
        >
          Xem thử một ngày cho tôi
        </button>

        {draft ? (
          <div className="mt-7 border-t border-[#dedbd2] pt-7">
            <h3 className="font-display text-2xl text-[#183f34]">
              Chúng tôi hiểu thế này
            </h3>
            {/* Một dòng tóm tắt thay cho chín ô. Chín ô vẫn còn nguyên, chỉ
                gập lại -- giấu đi thì khách không biết mình đang bị đoán hộ
                những gì, mà bày cả ra thì lại đúng bức tường cũ. */}
            <p
              data-plan-summary
              className="mt-3 text-sm leading-6 text-[#59654b]"
            >
              {PACE_SUMMARY[pace]} · {WALKING_SUMMARY[walking]} ·{" "}
              {Math.round(durationMinutes / 60)} tiếng · {adults} người lớn
              {children > 0 ? `, ${children} trẻ em` : ""}
              {seniors > 0 ? `, ${seniors} người cao tuổi` : ""}
              {visitDate ? ` · đi ngày ${visitDate.split("-").reverse().join("/")}` : ""}
            </p>
            {/* Khách nói "hai ngày" thì phải trả lời cho đúng chuyện ấy. Máy
                mới xếp được một ngày, nên nói thẳng ra là mình xếp ngày đầu.
                Im lặng đưa một ngày rồi để khách tự đoán là cách nhanh nhất
                làm họ nghĩ trang này hỏng. */}
            {draft.tripDays && draft.tripDays >= 2 ? (
              <p
                data-plan-multiday
                className="mt-3 rounded-xl bg-[#f1ede2] px-4 py-3 text-sm leading-6 text-[#59654b]"
              >
                Bạn nói chuyến này đi {draft.tripDays} ngày ạ. Em xếp ngày đầu
                trước để bạn xem thử; những ngày sau bạn đổi ngày đi rồi bấm
                lại là có tiếp.
              </p>
            ) : null}
            <button
              type="button"
              onClick={() => setShowDetails((current) => !current)}
              className="mt-3 min-h-10 text-sm font-bold text-[#356957] underline underline-offset-2"
            >
              {showDetails ? "Thu gọn" : "Chỉnh lại cho đúng"}
            </button>
            <div
              hidden={!showDetails}
              className="mt-5 grid gap-4 sm:grid-cols-2"
            >
              <label className="text-sm font-bold">
                Ngày đi
                <input
                  type="date"
                  value={visitDate}
                  min={minVisitDate}
                  onChange={(event) => setVisitDate(event.target.value)}
                  className="mt-2 min-h-11 w-full rounded-xl border border-[#c9ccc5] bg-white px-3 font-normal"
                />
                {visitDate ? (
                  <span className="mt-1 block text-xs font-normal text-[#59654b]">{formatVietnameseDate(visitDate)}</span>
                ) : null}
              </label>
              <label className="text-sm font-bold">
                Thời lượng
                <select
                  value={durationMinutes}
                  onChange={(event) =>
                    setDurationMinutes(Number(event.target.value))
                  }
                  className="mt-2 min-h-11 w-full rounded-xl border border-[#c9ccc5] bg-white px-3 font-normal"
                >
                  {/* Mục "2 ngày" cũ đã bỏ, và đây là lý do: chọn nó xong,
                      lịch trình trả về GIỐNG HỆT từng chữ so với chọn một
                      ngày -- cùng ba chặng, cùng 450 phút. Máy dựng đúng một
                      ngày: mốc tám giờ sáng, giờ mở cửa từng nơi, nhiều nhất
                      ba chặng. Để mục ấy lại là mời khách chọn một thứ mình
                      không làm, rồi im lặng đưa họ thứ khác. */}
                  <option value={300}>Nửa ngày · 5 giờ</option>
                  <option value={360}>6 giờ</option>
                  <option value={480}>8 giờ</option>
                  <option value={600}>Trọn ngày · 10 giờ</option>
                </select>
              </label>
              <label className="text-sm font-bold">
                Nhịp đi
                <select
                  value={pace}
                  onChange={(event) =>
                    setPace(event.target.value as JourneyIntent["pace"])
                  }
                  className="mt-2 min-h-11 w-full rounded-xl border border-[#c9ccc5] bg-white px-3 font-normal"
                >
                  <option value="relaxed">Thư thả</option>
                  <option value="balanced">Cân bằng</option>
                  <option value="active">Năng động</option>
                </select>
              </label>
              <label className="text-sm font-bold">
                Mức đi bộ
                <select
                  value={walking}
                  onChange={(event) =>
                    setWalking(
                      event.target.value as JourneyIntent["walkingTolerance"],
                    )
                  }
                  className="mt-2 min-h-11 w-full rounded-xl border border-[#c9ccc5] bg-white px-3 font-normal"
                >
                  <option value="low">Thấp</option>
                  <option value="moderate">Vừa</option>
                  <option value="high">Cao</option>
                </select>
              </label>
              <label className="text-sm font-bold">
                Ngân sách VND
                <input
                  type="number"
                  min={0}
                  step={100000}
                  value={budget}
                  onChange={(event) => setBudget(Number(event.target.value))}
                  className="mt-2 min-h-11 w-full rounded-xl border border-[#c9ccc5] px-3 font-normal"
                />
              </label>
              {[
                ["Người lớn", adults, setAdults],
                ["Trẻ em", children, setChildren],
                ["Người cao tuổi", seniors, setSeniors],
              ].map(([label, value, setter]) => (
                <label key={label as string} className="text-sm font-bold">
                  {label as string}
                  <input
                    type="number"
                    min={0}
                    max={20}
                    value={value as number}
                    onChange={(event) =>
                      (setter as (value: number) => void)(
                        Number(event.target.value),
                      )
                    }
                    className="mt-2 min-h-11 w-full rounded-xl border border-[#c9ccc5] px-3 font-normal"
                  />
                </label>
              ))}
            </div>
            {draft.partyContext?.includes("travelling-with-parents") ? (
              <p className="mt-4 rounded-xl bg-[#edf3f0] p-3 text-sm">
                Ngữ cảnh: đi cùng bố mẹ. Hệ thống không tự suy đoán khuyết tật
                hay nhu cầu y tế từ thông tin này.
              </p>
            ) : null}
            <button
              data-customer-track="planner-generate"
              data-customer-content-id="journey-itinerary"
              data-customer-content-type="planner-action"
              type="button"
              onClick={confirmAndGenerate}
              disabled={pending || !visitDate || adults + children + seniors < 1}
              className="mt-6 min-h-12 w-full rounded-full bg-[#d58c35] px-6 font-extrabold text-[#151a17] disabled:opacity-50"
            >
              {pending
                ? "Đang kiểm tra và lưu…"
                : "Xác nhận và tạo hành trình"}
            </button>
            {packageMatch ? (
              <PackageMatchPanel lang={lang} result={packageMatch} />
            ) : null}
          </div>
        ) : null}

        {message ? (
          <p className="mt-5 rounded-xl bg-[#f4f0e7] p-4 text-sm" role="status">
            {message}
          </p>
        ) : null}
      </section>
    </div>
  );
}
