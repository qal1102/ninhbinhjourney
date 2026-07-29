import { toSafeError } from "@/domain/errors";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  context: { params: Promise<{ code: string }> },
) {
  try {
    const { code } = await context.params;
    const supabase = await createClient();
    const { data: booking, error } = await supabase
      .from("bookings")
      .select("*")
      .eq("code", code)
      .single();
    if (error || !booking) {
      return Response.json(
        { error: { code: "NOT_FOUND", message: "Booking was not found." } },
        { status: 404 },
      );
    }
    const [{ data: lines }, { data: payment }, { data: pass }] =
      await Promise.all([
        supabase
          .from("booking_lines")
          .select("*")
          .eq("booking_id", booking.id),
        supabase
          .from("payment_intents")
          .select("provider_intent_id, mode, status, amount_vnd, currency")
          .eq("booking_id", booking.id)
          .single(),
        supabase
          .from("passes")
          .select("id, token_hint, status, issued_at, expires_at")
          .eq("booking_id", booking.id)
          .single(),
      ]);

    return Response.json(
      {
        booking,
        lines: lines ?? [],
        payment,
        pass,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return Response.json(
      { error: toSafeError(error) },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
}
