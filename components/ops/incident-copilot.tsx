"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { DESTINATIONS } from "@/content/destinations";
import {
  parseIncidentDraft,
  REQUIRED_INCIDENT_SAMPLE,
} from "@/domain/incident";
import type { IncidentCategory, IncidentDraft } from "@/domain/models";
import { SupabaseOperationsService } from "@/services/supabase/operations-service";
import type { SopRow } from "@/types/database.generated";

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

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onstart: (() => void) | null;
  onresult: ((event: SpeechResultEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

const categories: Array<{ value: IncidentCategory; label: string }> = [
  { value: "crowd-capacity", label: "Crowd / capacity" },
  { value: "weather", label: "Weather" },
  { value: "medical", label: "Medical" },
  { value: "transport", label: "Transport" },
  { value: "water-safety", label: "Water safety" },
  { value: "fire-safety", label: "Fire safety" },
  { value: "infrastructure", label: "Infrastructure" },
  { value: "security", label: "Security" },
  { value: "lost-person", label: "Lost person" },
  { value: "other", label: "Other" },
];

function matchingSop(sops: SopRow[], category?: IncidentCategory) {
  return sops.find((sop) => sop.category === category);
}

export function IncidentCopilot({
  demoRunId,
  sops,
  canConfirmCritical,
  showDemoCommand,
}: {
  demoRunId: string;
  sops: SopRow[];
  canConfirmCritical: boolean;
  showDemoCommand: boolean;
}) {
  const router = useRouter();
  const [text, setText] = useState(REQUIRED_INCIDENT_SAMPLE);
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [draft, setDraft] = useState<IncidentDraft | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const service = new SupabaseOperationsService();

  function extractDraft(source = text) {
    const parsed = parseIncidentDraft({
      id: crypto.randomUUID(),
      demoRunId,
      text: source,
    });
    setDraft(parsed);
    setMessage(
      "Draft extracted locally. Review every field; nothing is saved until a named operator confirms it.",
    );
  }

  function updateDraft(patch: Partial<IncidentDraft>) {
    setDraft((current) => (current ? { ...current, ...patch } : current));
  }

  function changeCategory(category: IncidentCategory) {
    const sop = matchingSop(sops, category);
    updateDraft({ category, sopId: sop?.id });
  }

  function startVoice() {
    const browserWindow = window as typeof window & {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };
    const Recognition =
      browserWindow.SpeechRecognition ??
      browserWindow.webkitSpeechRecognition;
    if (!Recognition) {
      setVoiceState("unsupported");
      setMessage(
        "Speech recognition is unavailable in this browser. The complete text workflow remains available.",
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
      if (transcript) {
        setText(transcript);
        setDraft(null);
      }
    };
    recognition.onerror = (event) => {
      setVoiceState(event.error === "not-allowed" ? "denied" : "error");
      setMessage(
        event.error === "not-allowed"
          ? "Microphone permission was denied. Continue with the text field."
          : "Speech recognition failed. Continue with the text field.",
      );
    };
    recognition.onend = () =>
      setVoiceState((current) =>
        current === "denied" || current === "error" ? current : "stopped",
      );
    recognition.start();
  }

  async function confirmIncident() {
    if (!draft) return;
    setPending(true);
    setMessage("");
    try {
      const incident = await service.confirmIncident(draft);
      router.push(`/ops/incidents/${incident.id}`);
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "The incident could not be confirmed.",
      );
    } finally {
      setPending(false);
    }
  }

  const selectedSop = draft
    ? sops.find((sop) => sop.id === draft.sopId)
    : undefined;
  const critical =
    draft?.suggestedSeverity === "P1" ||
    draft?.suggestedSeverity === "P2";
  const complete = Boolean(
    draft?.siteId && draft.category && draft.suggestedSeverity,
  );

  return (
    <div className="grid gap-6 xl:grid-cols-[0.72fr_1.28fr]">
      <section className="rounded-3xl bg-[#151a17] p-6 text-white sm:p-8">
        <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-[#e7c78d]">
          Deterministic extraction · human decision
        </p>
        <h2 className="font-display mt-4 text-4xl leading-tight">
          Describe what is happening.
        </h2>
        <button
          type="button"
          onClick={startVoice}
          className={`mx-auto mt-8 grid aspect-square w-36 place-items-center rounded-full border-8 text-center font-bold ${
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
              {voiceState === "listening" ? "Đang nghe…" : "Use microphone"}
            </span>
          </span>
        </button>
        <p className="mt-6 text-center text-sm leading-6 text-white/62">
          Audio is not stored. Permission is requested only after this button
          is pressed. State: <strong>{voiceState}</strong>.
        </p>
        {showDemoCommand ? (
          <button
          type="button"
          onClick={() => {
            setText(REQUIRED_INCIDENT_SAMPLE);
            setDraft(null);
            setVoiceState("demo");
            setMessage(
              "Loaded a deterministic sample transcript; no audio was processed.",
            );
          }}
          className="mt-5 min-h-11 w-full rounded-full border border-white/25 px-4 text-sm font-bold"
        >
            Run demo command
          </button>
        ) : null}
      </section>

      <section className="rounded-3xl border border-[#d7d5cd] bg-white p-6 shadow-sm sm:p-8">
        <label htmlFor="incident-text" className="font-display text-2xl">
          Incident transcript
        </label>
        <textarea
          id="incident-text"
          rows={5}
          maxLength={4000}
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setDraft(null);
          }}
          className="mt-4 w-full rounded-2xl border border-[#c9ccc5] p-4 leading-7 outline-none focus:border-[#183f34]"
        />
        <button
          type="button"
          disabled={text.trim().length < 2}
          onClick={() => extractDraft()}
          className="mt-4 min-h-12 rounded-full bg-[#183f34] px-6 font-bold text-white disabled:opacity-40"
        >
          Extract editable draft
        </button>

        {draft ? (
          <div className="mt-7 border-t border-[#dedbd2] pt-7">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-display text-2xl text-[#183f34]">
                Human confirmation
              </h3>
              <span className="rounded-full bg-[#fff1d6] px-3 py-1 text-xs font-extrabold text-[#784b13]">
                NOT SAVED
              </span>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-bold">
                Site
                <select
                  value={draft.siteId ?? ""}
                  onChange={(event) =>
                    updateDraft({ siteId: event.target.value || undefined })
                  }
                  className="mt-2 min-h-11 w-full rounded-xl border border-[#c9ccc5] bg-white px-3 font-normal"
                >
                  <option value="">Select a site</option>
                  {DESTINATIONS.map((destination) => (
                    <option key={destination.id} value={destination.id}>
                      {destination.name.vi}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-bold">
                Category
                <select
                  value={draft.category ?? ""}
                  onChange={(event) =>
                    changeCategory(event.target.value as IncidentCategory)
                  }
                  className="mt-2 min-h-11 w-full rounded-xl border border-[#c9ccc5] bg-white px-3 font-normal"
                >
                  <option value="">Select a category</option>
                  {categories.map((category) => (
                    <option key={category.value} value={category.value}>
                      {category.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-bold">
                Severity
                <select
                  value={draft.suggestedSeverity ?? ""}
                  onChange={(event) =>
                    updateDraft({
                      suggestedSeverity: event.target.value as
                        | "P1"
                        | "P2"
                        | "P3"
                        | "P4",
                    })
                  }
                  className="mt-2 min-h-11 w-full rounded-xl border border-[#c9ccc5] bg-white px-3 font-normal"
                >
                  <option value="">Select severity</option>
                  <option value="P1">P1 · critical</option>
                  <option value="P2">P2 · major</option>
                  <option value="P3">P3 · operational</option>
                  <option value="P4">P4 · minor</option>
                </select>
              </label>
              <label className="text-sm font-bold">
                Wait time (minutes)
                <input
                  type="number"
                  min={0}
                  max={720}
                  value={draft.waitTimeMinutes ?? ""}
                  onChange={(event) =>
                    updateDraft({
                      waitTimeMinutes: event.target.value
                        ? Number(event.target.value)
                        : undefined,
                    })
                  }
                  className="mt-2 min-h-11 w-full rounded-xl border border-[#c9ccc5] px-3 font-normal"
                />
              </label>
              <label className="text-sm font-bold">
                Resource type
                <input
                  value={draft.resourceRequest?.resourceType ?? ""}
                  onChange={(event) =>
                    updateDraft({
                      resourceRequest: event.target.value
                        ? {
                            resourceType: event.target.value,
                            quantity: draft.resourceRequest?.quantity ?? 1,
                          }
                        : undefined,
                    })
                  }
                  placeholder="e.g. queue-support-staff"
                  className="mt-2 min-h-11 w-full rounded-xl border border-[#c9ccc5] px-3 font-normal"
                />
              </label>
              <label className="text-sm font-bold">
                Resource quantity
                <input
                  type="number"
                  min={1}
                  max={1000}
                  value={draft.resourceRequest?.quantity ?? ""}
                  onChange={(event) =>
                    updateDraft({
                      resourceRequest: draft.resourceRequest
                        ? {
                            ...draft.resourceRequest,
                            quantity: Number(event.target.value),
                          }
                        : undefined,
                    })
                  }
                  disabled={!draft.resourceRequest}
                  className="mt-2 min-h-11 w-full rounded-xl border border-[#c9ccc5] px-3 font-normal disabled:bg-[#eef0eb]"
                />
              </label>
            </div>
            <label className="mt-4 block text-sm font-bold">
              Operator summary / notes
              <textarea
                rows={3}
                maxLength={500}
                value={draft.notes ?? ""}
                onChange={(event) => updateDraft({ notes: event.target.value })}
                className="mt-2 w-full rounded-xl border border-[#c9ccc5] p-3 font-normal"
              />
            </label>

            {selectedSop ? (
              <aside className="mt-5 rounded-2xl border border-[#e0c997] bg-[#fff8e9] p-5">
                <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#784b13]">
                  Suggested reference · {selectedSop.code}
                </p>
                <h4 className="font-display mt-2 text-xl">
                  {selectedSop.title}
                </h4>
                <p className="mt-2 text-sm leading-6">
                  {selectedSop.summary}
                </p>
                <p className="mt-3 text-xs font-bold text-[#784b13]">
                  {selectedSop.approval_note}. Source:{" "}
                  {selectedSop.source_document}, p.{" "}
                  {selectedSop.source_page ?? "n/a"}.
                </p>
              </aside>
            ) : null}

            {critical && !canConfirmCritical ? (
              <p className="mt-5 rounded-xl bg-[#ffe8e4] p-4 text-sm font-bold text-[#8a2f22]">
                P1/P2 confirmation requires an authenticated site supervisor,
                ICC operator or admin. You may edit this draft, but cannot
                confirm it with the current room role.
              </p>
            ) : null}
            <button
              type="button"
              onClick={() => void confirmIncident()}
              disabled={
                pending || !complete || (critical && !canConfirmCritical)
              }
              className="mt-6 min-h-12 w-full rounded-full bg-[#d58c35] px-6 font-extrabold text-[#151a17] disabled:opacity-45"
            >
              {pending
                ? "Confirming and writing audit trail…"
                : "Confirm incident as named operator"}
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
