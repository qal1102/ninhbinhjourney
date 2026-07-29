import { createHash, randomBytes } from "node:crypto";
import { readPublicEnvironment } from "@/config/experience";
import { ConfirmBookingRequestSchema } from "@/domain/schemas";
import { DomainError, toSafeError } from "@/domain/errors";
import { createClient } from "@/lib/supabase/server";
import { SandboxPaymentAdapter } from "@/services/adapters/sandbox-payment";

function deterministicOpaque(label: string, idempotencyKey: string) {
  const sandboxSalt =
    process.env.PAYMENT_WEBHOOK_SECRET ??
    "destinationos-client-demo-sandbox-v1";
  return createHash("sha256")
    .update(`${label}:${idempotencyKey}:${sandboxSalt}`)
    .digest("base64url");
}

export async function POST(request: Request) {
  try {
    const environment = readPublicEnvironment();
    if (
      environment.status === "missing" ||
      !environment.config.sandboxPaymentEnabled
    ) {
      throw new DomainError(
        "ADAPTER_UNAVAILABLE",
        "Sandbox payment is available only in configured client-demo mode.",
      );
    }
    const input = ConfirmBookingRequestSchema.parse(await request.json());
    const supabase = await createClient();
    const callbackSecret = deterministicOpaque(
      "callback",
      input.idempotencyKey,
    );
    const providerIntentId = `pi_demo_${deterministicOpaque(
      "intent",
      input.idempotencyKey,
    ).slice(0, 24)}`;
    const providerEventId = `evt_demo_${deterministicOpaque(
      "approved",
      input.idempotencyKey,
    ).slice(0, 24)}`;
    const passToken = deterministicOpaque("pass", input.idempotencyKey);

    const { data: payment, error: paymentError } = await supabase.rpc(
      "create_sandbox_payment_intent",
      {
        p_quote_id: input.quoteId,
        p_idempotency_key: input.idempotencyKey,
        p_provider_intent_id: providerIntentId,
        p_callback_secret: callbackSecret,
      },
    );
    if (paymentError || !payment) {
      throw paymentError ?? new Error("Sandbox payment intent failed.");
    }

    const callback = {
      providerEventId,
      providerIntentId,
      event: "approved" as const,
      occurredAt: new Date().toISOString(),
    };
    const adapter = new SandboxPaymentAdapter();
    const signature = adapter.sign(callback, callbackSecret);
    adapter.verify(callback, signature, callbackSecret);

    const { data, error } = await supabase.rpc("process_sandbox_payment", {
      p_payment_intent_id: payment.id,
      p_provider_event_id: callback.providerEventId,
      p_event_type: callback.event,
      p_callback_secret: callbackSecret,
      p_pass_token: passToken,
      p_customer_display_name: input.customerDisplayName,
      p_contact_kind: input.contactKind,
      p_contact_value: input.contactValue,
      p_consent_at: new Date().toISOString(),
    });
    const result = data?.[0];
    if (error || !result?.booking_id || !result.booking_code || !result.pass_id) {
      throw error ?? new Error("Sandbox booking confirmation failed.");
    }

    return Response.json(
      {
        booking: {
          id: result.booking_id,
          code: result.booking_code,
          status: "confirmed",
        },
        payment: {
          providerIntentId,
          status: result.payment_status,
          mode: "simulation",
        },
        pass: {
          id: result.pass_id,
          token: passToken,
          path: `/pass/${encodeURIComponent(passToken)}`,
        },
        idempotentReplay: result.was_duplicate,
      },
      {
        status: result.was_duplicate ? 200 : 201,
        headers: {
          "Cache-Control": "no-store",
          "X-Demo-Nonce": randomBytes(8).toString("hex"),
        },
      },
    );
  } catch (error) {
    const safeError = toSafeError(error);
    const rawMessage =
      error && typeof error === "object" && "message" in error
        ? String(error.message)
        : "";
    const mapped =
      rawMessage === "CAPACITY_UNAVAILABLE"
        ? {
            code: "CAPACITY_UNAVAILABLE" as const,
            message:
              "Capacity changed before confirmation. No booking or charge was created.",
            retryable: true,
          }
        : rawMessage === "QUOTE_EXPIRED"
          ? {
              code: "QUOTE_EXPIRED" as const,
              message: "The quote expired. Request a fresh server quote.",
              retryable: true,
            }
          : safeError;
    return Response.json(
      { error: mapped },
      {
        status:
          mapped.code === "MISSING_ENVIRONMENT"
            ? 503
            : mapped.code === "PERMISSION_DENIED"
              ? 403
              : mapped.code === "CAPACITY_UNAVAILABLE" ||
                  mapped.code === "QUOTE_EXPIRED"
                ? 409
                : 400,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
