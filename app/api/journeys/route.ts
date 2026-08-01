import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { confirmJourneyIntent, generateItinerary, parseJourneyIntent } from "@/domain/journey";
import { DomainError, toSafeError } from "@/domain/errors";
import { CreateJourneyRequestSchema } from "@/domain/schemas";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database.generated";

function asJson(value: unknown): Json {
  return JSON.parse(JSON.stringify(value)) as Json;
}

export async function POST(request: Request) {
  try {
    const input = CreateJourneyRequestSchema.parse(await request.json());

    // A demo room is required only to PERSIST a journey. Ordinary visitors who
    // never joined one still get a fully generated, validated itinerary back —
    // it simply lives in the browser instead of Supabase.
    const demoRunId = (await cookies()).get("nbj-active-run")?.value ?? null;

    const draft = parseJourneyIntent({ text: input.text, locale: input.locale });
    const intent = confirmJourneyIntent({
      draft,
      demoRunId: demoRunId ?? randomUUID(),
      id: randomUUID(),
      durationMinutes: input.durationMinutes,
      party: input.party,
      partyContext: input.partyContext,
      pace: input.pace,
      walkingTolerance: input.walkingTolerance,
      budgetVnd: input.budgetVnd,
      visitDate: input.visitDate,
    });

    const supabase = demoRunId ? await createClient() : null;
    let unavailable = new Set<string>();

    if (supabase && demoRunId) {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user || !user.is_anonymous) {
        throw new DomainError(
          "PERMISSION_DENIED",
          "An authenticated anonymous visitor session is required.",
        );
      }

      const { data: slots, error: slotError } = await supabase
        .from("capacity_slots")
        .select("site_id, capacity, reserved, status")
        .eq("demo_run_id", demoRunId)
        .eq("slot_date", input.visitDate);
      if (slotError) throw slotError;
      unavailable = new Set(
        (slots ?? [])
          .filter(
            (slot) =>
              slot.status !== "available" || slot.reserved >= slot.capacity,
          )
          .map((slot) => slot.site_id),
      );
    }

    const itinerary = generateItinerary(intent, {
      unavailableSiteIds: unavailable,
      visitDate: input.visitDate,
    });
    if (!itinerary.validation.valid) {
      throw new DomainError(
        "ITINERARY_INVALID",
        itinerary.validation.issues[0]?.message ??
          "No valid itinerary is available for the confirmed constraints.",
      );
    }

    if (!supabase || !demoRunId) {
      return Response.json(
        { intent, itinerary, persisted: false },
        { status: 200, headers: { "Cache-Control": "no-store" } },
      );
    }

    const { data, error } = await supabase.rpc("save_generated_journey", {
      p_demo_run_id: demoRunId,
      p_locale: input.locale,
      p_raw_text: input.text,
      p_structured_intent: asJson(intent),
      p_itinerary: asJson(itinerary),
    });
    const saved = data?.[0];
    if (error || !saved) {
      throw error ?? new Error("Journey persistence failed.");
    }

    return Response.json(
      {
        intent: { ...intent, id: saved.intent_id },
        itinerary: {
          ...itinerary,
          id: saved.itinerary_id,
          intentId: saved.intent_id,
        },
        persisted: true,
      },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const safeError = toSafeError(error);
    return Response.json(
      { error: safeError },
      {
        status:
          safeError.code === "MISSING_ENVIRONMENT"
            ? 503
            : safeError.code === "PERMISSION_DENIED"
              ? 403
              : safeError.code === "DEMO_ROOM_NOT_JOINED"
                ? 409
                : 400,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
