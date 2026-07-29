export type DomainErrorCode =
  | "VALIDATION_ERROR"
  | "CAPACITY_UNAVAILABLE"
  | "QUOTE_EXPIRED"
  | "DUPLICATE_REQUEST"
  | "ADAPTER_UNAVAILABLE"
  | "MICROPHONE_DENIED"
  | "MICROPHONE_UNSUPPORTED"
  | "MAP_UNAVAILABLE"
  | "PASS_UNKNOWN"
  | "PASS_EXPIRED"
  | "PASS_CANCELLED"
  | "ALREADY_REDEEMED"
  | "AI_PARSE_INVALID"
  | "ITINERARY_INVALID"
  | "MISSING_ENVIRONMENT"
  | "ANONYMOUS_AUTH_UNAVAILABLE"
  | "DEMO_ROOM_EXPIRED"
  | "DEMO_ROOM_NOT_JOINED"
  | "REALTIME_RECOVERING"
  | "PERMISSION_DENIED";

export class DomainError extends Error {
  readonly code: DomainErrorCode;
  readonly retryable: boolean;
  readonly safeDetails?: Record<string, string | number | boolean>;

  constructor(
    code: DomainErrorCode,
    message: string,
    options?: {
      cause?: unknown;
      retryable?: boolean;
      safeDetails?: Record<string, string | number | boolean>;
    },
  ) {
    super(message, { cause: options?.cause });
    this.name = "DomainError";
    this.code = code;
    this.retryable = options?.retryable ?? false;
    this.safeDetails = options?.safeDetails;
  }
}

export class AdapterUnavailableError extends DomainError {
  constructor(adapter: string) {
    super("ADAPTER_UNAVAILABLE", `${adapter} is not configured for this experience mode.`, {
      safeDetails: { adapter },
    });
    this.name = "AdapterUnavailableError";
  }
}

export class MissingEnvironmentError extends DomainError {
  constructor(missing: string[], issues: string[] = []) {
    super(
      "MISSING_ENVIRONMENT",
      "The shared Supabase data core is not configured.",
      {
        safeDetails: {
          missingCount: missing.length,
          invalidCount: issues.length,
        },
      },
    );
    this.name = "MissingEnvironmentError";
  }
}

export function toSafeError(error: unknown) {
  if (error instanceof DomainError) {
    return {
      code: error.code,
      message: error.message,
      retryable: error.retryable,
      details: error.safeDetails,
    };
  }

  return {
    code: "UNEXPECTED_ERROR" as const,
    message: "Something went wrong. Please retry.",
    retryable: true,
  };
}
