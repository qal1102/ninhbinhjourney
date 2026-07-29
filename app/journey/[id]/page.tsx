import { notFound } from "next/navigation";
import { readPublicEnvironment } from "@/config/experience";
import { JourneyIntentSchema } from "@/domain/schemas";
import type { Itinerary } from "@/domain/models";
import { createClient } from "@/lib/supabase/server";
import { ItineraryEditor } from "@/components/journey/itinerary-editor";
import { SetupState } from "@/components/shared/setup-state";

export default async function JourneyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const environment = readPublicEnvironment();
  if (environment.status === "missing") {
    return <SetupState environment={environment} surface="Saved journey" />;
  }
  const { id } = await params;
  const supabase = await createClient();
  const { data: row } = await supabase
    .from("itineraries")
    .select("*")
    .eq("id", id)
    .single();
  if (!row) notFound();
  const [{ data: itemRows }, { data: intentRow }] = await Promise.all([
    supabase
      .from("itinerary_items")
      .select("*")
      .eq("itinerary_id", id)
      .order("item_order"),
    supabase
      .from("journey_intents")
      .select("*")
      .eq("id", row.intent_id)
      .single(),
  ]);
  if (!intentRow) notFound();

  const intent = JourneyIntentSchema.parse(intentRow.structured_intent);
  const itinerary: Itinerary = {
    id: row.id,
    demoRunId: row.demo_run_id,
    tenantId: row.tenant_id,
    regionId: row.region_id,
    intentId: row.intent_id,
    items: (itemRows ?? []).map((item) => ({
      id: item.id,
      siteId: item.site_id,
      startAt: item.start_at,
      endAt: item.end_at,
      travelMinutesFromPrevious: item.travel_minutes_from_previous,
      reason: item.reason,
    })),
    totalMinutes: row.total_minutes,
    estimatedPriceVnd: row.estimated_price_vnd,
    validation: row.validation as Itinerary["validation"],
    explanation: row.explanation,
  };

  return (
    <main className="min-h-screen bg-[#f4f0e7] px-5 py-10 text-[#151a17] sm:px-8">
      <div className="mx-auto max-w-7xl">
        <ItineraryEditor initialItinerary={itinerary} intent={intent} />
      </div>
    </main>
  );
}
