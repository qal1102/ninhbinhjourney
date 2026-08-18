"use client";

import { useState } from "react";
import {
  parseJourneyIntent,
  REQUIRED_VIETNAMESE_SAMPLE,
} from "@/domain/journey";
import type {
  Itinerary,
  JourneyIntent,
  JourneyIntentDraft,
} from "@/domain/models";
import { ItineraryEditor } from "./itinerary-editor";

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

const examples = [
  REQUIRED_VIETNAMESE_SAMPLE,
  "Tôi có 6 giờ, thích thiên nhiên và nhiếp ảnh, muốn đi bộ vừa phải.",
  "Gia đình tôi có 2 người lớn và 2 trẻ em, muốn một ngày cân bằng ở Ninh Bình.",
] as const;

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
}: {
  showDemoCommand: boolean;
  identityCollectionEnabled: boolean;
}) {
  const [text, setText] = useState("");
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [draft, setDraft] = useState<JourneyIntentDraft | null>(null);
  const [visitDate, setVisitDate] = useState("");
  const [minVisitDate, setMinVisitDate] = useState("");
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
  const [result, setResult] = useState<{
    intent: JourneyIntent;
    itinerary: Itinerary;
    persisted: boolean;
    persistence: "browser" | "demo" | "anonymous";
  } | null>(null);

  function parseText() {
    const parsed = parseJourneyIntent({ text, locale: "vi" });
    setDraft(parsed);
    // Resolved here rather than on mount: the date field only exists after this
    // click, so today's date never has to match server-rendered markup.
    setMinVisitDate(localDateInDays(0));
    setVisitDate(
      (current) => parsed.visitDate ?? (current || localDateInDays(7)),
    );
    setDurationMinutes(parsed.durationMinutes ?? 600);
    setAdults(parsed.party?.adults ?? 1);
    setChildren(parsed.party?.children ?? 0);
    setSeniors(parsed.party?.seniors ?? 0);
    setPace(parsed.pace ?? "balanced");
    setWalking(parsed.walkingTolerance ?? "moderate");
    setBudget(parsed.budgetVnd?.target ?? 2_000_000);
    setMessage(
      "Hãy kiểm tra các trường đã trích xuất. Chưa có hành trình nào được tạo hoặc lưu.",
    );
  }

  function startVoice() {
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
    recognition.lang = "vi-VN";
    recognition.interimResults = true;
    recognition.continuous = false;
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
      setVoiceState(event.error === "not-allowed" ? "denied" : "error");
      setMessage(
        event.error === "not-allowed"
          ? "Quyền microphone bị từ chối. Hãy tiếp tục bằng ô văn bản."
          : "Không thể nhận dạng giọng nói. Hãy tiếp tục bằng ô văn bản.",
      );
    };
    recognition.onend = () =>
      setVoiceState((current) =>
        current === "denied" || current === "error" ? current : "stopped",
      );
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
          locale: "vi",
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
              {voiceState === "listening" ? "Đang nghe…" : "Dùng microphone"}
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
        <label htmlFor="journey-text" className="font-display text-2xl">
          Yêu cầu bằng văn bản
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
        <div className="mt-4 grid gap-2">
          {examples.map((example, index) => (
            <button
              key={example}
              type="button"
              onClick={() => {
                setText(example);
                setDraft(null);
              }}
              className="rounded-xl bg-[#f4f0e7] p-3 text-left text-sm leading-6"
            >
              Ví dụ {index + 1}: {example}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={parseText}
          disabled={text.trim().length < 2}
          className="mt-5 min-h-12 rounded-full bg-[#183f34] px-6 font-bold text-white disabled:opacity-40"
        >
          Hiểu yêu cầu
        </button>

        {draft ? (
          <div className="mt-7 border-t border-[#dedbd2] pt-7">
            <div className="flex items-center justify-between gap-4">
              <h3 className="font-display text-2xl text-[#183f34]">
                Xác nhận ý định
              </h3>
              <span className="rounded-full bg-[#eef3ef] px-3 py-1 text-xs font-bold text-[#356957]">
                Có thể sửa
              </span>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-bold">
                Ngày đi
                <input
                  type="date"
                  value={visitDate}
                  min={minVisitDate}
                  onChange={(event) => setVisitDate(event.target.value)}
                  className="mt-2 min-h-11 w-full rounded-xl border border-[#c9ccc5] bg-white px-3 font-normal"
                />
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
                  <option value={360}>6 giờ</option>
                  <option value={600}>1 ngày · 10 giờ</option>
                  <option value={1200}>2 ngày</option>
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
