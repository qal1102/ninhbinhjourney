import { rebuildItineraryWithSites } from "@/domain/journey";
import { DomainError, toSafeError } from "@/domain/errors";
import {
  JourneyIntentSchema,
  UpdateJourneyRequestSchema,
} from "@/domain/schemas";
import { createClient } from "@/lib/supabase/server";
import type { Itinerary } from "@/domain/models";
import type { Json } from "@/types/database.generated";

function asJson(value: unknown): Json {
  return JSON.parse(JSON.stringify(value)) as Json;
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const input = UpdateJourneyRequestSchema.parse(await request.json());
    const { id } = await context.params;
    const supabase = await createClient();
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

    const { data: row, error: itineraryError } = await supabase
      .from("itineraries")
      .select("*")
      .eq("id", id)
      .single();
    if (itineraryError || !row || row.created_by !== user.id) {
      throw new DomainError(
        "PERMISSION_DENIED",
        "This journey cannot be edited by the current visitor.",
      );
    }
    const { data: intentRow, error: intentError } = await supabase
      .from("journey_intents")
      .select("*")
      .eq("id", row.intent_id)
      .single();
    if (intentError || !intentRow) throw intentError;
    const intent = JourneyIntentSchema.parse(intentRow.structured_intent);
    const itinerary: Itinerary = {
      id: row.id,
      demoRunId: row.demo_run_id,
      tenantId: row.tenant_id,
      regionId: row.region_id,
      intentId: row.intent_id,
      items: [],
      totalMinutes: row.total_minutes,
      estimatedPriceVnd: row.estimated_price_vnd,
      validation: row.validation as Itinerary["validation"],
      explanation: row.explanation,
    };
    const rebuilt = rebuildItineraryWithSites({
      itinerary,
      intent,
      siteIds: input.siteIds,
    });

    const { error } = await supabase.rpc("update_saved_journey", {
      p_itinerary_id: row.id,
      p_items: asJson(rebuilt.items),
      p_total_minutes: rebuilt.totalMinutes,
      p_validation: asJson(rebuilt.validation),
      p_explanation: rebuilt.explanation,
    });
    if (error) throw error;

    return Response.json(
      { itinerary: rebuilt },
      { headers: { "Cache-Control": "no-store" } },
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
              : 400,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
