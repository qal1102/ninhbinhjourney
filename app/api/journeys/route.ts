import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import {
  customerJourneyIntentSummary,
  customerJourneyItinerarySnapshot,
  customerJourneySourceFromRequest,
} from "@/domain/customer-journey";
import { confirmJourneyIntent, generateItinerary, parseJourneyIntent } from "@/domain/journey";
import { DomainError, toSafeError } from "@/domain/errors";
import { CreateJourneyRequestSchema } from "@/domain/schemas";
import {
  CUSTOMER_ANONYMOUS_COOKIE,
  customerCookieHeader,
} from "@/domain/customer-identity";
import {
  createAnonymousCustomerJourney,
  CustomerJourneyRepositoryError,
  isCustomerJourneyPersistenceEnabled,
} from "@/lib/customer-data/journey-repository";
import {
  isCustomerRecommendationsEnabled,
  refreshCustomerRecommendations,
} from "@/lib/customer-data/recommendation-repository";

function isSameOriginBrowserRequest(request: Request) {
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  if (!origin || origin !== new URL(request.url).origin) return false;
  return !fetchSite || fetchSite === "same-origin";
}

export async function POST(request: Request) {
  try {
    const input = CreateJourneyRequestSchema.parse(await request.json());

    const draft = parseJourneyIntent({ text: input.text, locale: input.locale });
    const intent = confirmJourneyIntent({
      draft,
      // Trường bắt buộc của lược đồ cũ. "Phòng trình diễn" từng dùng nó đã gỡ
      // ngày 27/09/2026, nên mỗi lần dựng lấy một mã mới, không nối đi đâu.
      demoRunId: randomUUID(),
      id: randomUUID(),
      durationMinutes: input.durationMinutes,
      party: input.party,
      partyContext: input.partyContext,
      pace: input.pace,
      walkingTolerance: input.walkingTolerance,
      budgetVnd: input.budgetVnd,
      visitDate: input.visitDate,
    });

    const itinerary = generateItinerary(intent, {
      visitDate: input.visitDate,
      uuTienSiteId: input.uuTienSiteId,
      batDauPhut: input.batDauPhut,
    });
    if (!itinerary.validation.valid) {
      throw new DomainError(
        "ITINERARY_INVALID",
        itinerary.validation.issues[0]?.message ??
          "No valid itinerary is available for the confirmed constraints.",
      );
    }

    if (!isCustomerJourneyPersistenceEnabled()) {
      return Response.json(
        { intent, itinerary, persisted: false, persistence: "browser" },
        { status: 200, headers: { "Cache-Control": "no-store" } },
      );
    }

    if (!isSameOriginBrowserRequest(request)) {
      return Response.json(
        {
          error: {
            code: "CUSTOMER_JOURNEY_ORIGIN_REJECTED",
            message: "Yêu cầu này không đến từ trang Ninh Bình Journey nên chưa xử lý được.",
          },
        },
        { status: 403, headers: { "Cache-Control": "no-store" } },
      );
    }

    const cookieStore = await cookies();
    const existingAnonymousId = cookieStore.get(CUSTOMER_ANONYMOUS_COOKIE)?.value;
    const anonymousId =
      existingAnonymousId && /^[0-9a-f-]{36}$/i.test(existingAnonymousId)
        ? existingAnonymousId
        : randomUUID();
    const savedJourney = await createAnonymousCustomerJourney({
      journeyId: itinerary.id,
      anonymousId,
      intentSummary: customerJourneyIntentSummary(intent),
      itinerarySnapshot: customerJourneyItinerarySnapshot(itinerary),
      sourceContext: customerJourneySourceFromRequest(request),
    });
    // Recommendation generation is separate from journey persistence. A failed
    // optional rule refresh must not make an already saved customer journey fail.
    if (isCustomerRecommendationsEnabled()) {
      try {
        await refreshCustomerRecommendations(savedJourney.profileId);
      } catch (error) {
        console.error("Customer recommendation refresh failed", error);
      }
    }

    const response = Response.json(
      { intent, itinerary, persisted: true, persistence: "anonymous" },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
    response.headers.append(
      "Set-Cookie",
      customerCookieHeader(anonymousId),
    );
    return response;
  } catch (error) {
    if (error instanceof CustomerJourneyRepositoryError) {
      return Response.json(
        {
          error: {
            code:
              error.code === "PII_FORBIDDEN"
                ? "CUSTOMER_JOURNEY_PII_FORBIDDEN"
                : "CUSTOMER_JOURNEY_PERSISTENCE_FAILED",
            message: error.message,
          },
        },
        {
          status:
            error.code === "PII_FORBIDDEN"
              ? 400
              : error.code === "ID_COLLISION"
                ? 409
                : 503,
          headers: { "Cache-Control": "no-store" },
        },
      );
    }
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
