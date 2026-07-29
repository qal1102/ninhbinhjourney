import { cookies } from "next/headers";
import { CreateQuoteRequestSchema } from "@/domain/schemas";
import { DomainError, toSafeError } from "@/domain/errors";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database.generated";

export async function POST(request: Request) {
  try {
    const input = CreateQuoteRequestSchema.parse(await request.json());
    const demoRunId = (await cookies()).get("nbj-active-run")?.value;
    if (!demoRunId) {
      throw new DomainError(
        "DEMO_ROOM_NOT_JOINED",
        "Pair this visitor with an active demo room before requesting a quote.",
      );
    }
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("create_server_quote", {
      p_demo_run_id: demoRunId,
      p_itinerary_id: input.itineraryId ?? null,
      p_product_selections: input.productSelections as unknown as Json,
      p_visit_date: input.visitDate,
      p_party_size: input.partySize,
    });
    if (error || !data) throw error ?? new Error("Quote creation failed.");

    return Response.json(
      {
        quote: {
          id: data.id,
          demoRunId: data.demo_run_id,
          itineraryId: data.itinerary_id,
          visitDate: data.slot_date,
          partySize: data.party_size,
          lines: data.selections,
          subtotalVnd: data.subtotal_vnd,
          totalVnd: data.total_vnd,
          currency: data.currency,
          status: data.status,
          expiresAt: data.expires_at,
        },
      },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const safeError = toSafeError(error);
    const message =
      error &&
      typeof error === "object" &&
      "message" in error &&
      error.message === "CAPACITY_UNAVAILABLE"
        ? {
            code: "CAPACITY_UNAVAILABLE" as const,
            message:
              "The selected demonstration slot no longer has enough capacity.",
            retryable: true,
          }
        : safeError;
    return Response.json(
      { error: message },
      {
        status:
          message.code === "MISSING_ENVIRONMENT"
            ? 503
            : message.code === "DEMO_ROOM_NOT_JOINED"
              ? 409
              : message.code === "CAPACITY_UNAVAILABLE"
                ? 409
                : 400,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
