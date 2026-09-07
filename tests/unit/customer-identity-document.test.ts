import { describe, expect, it } from "vitest";
import {
  IDENTITY_DOCUMENT_COLLECTION_REASONS,
  IDENTITY_DOCUMENT_RETENTION_DAYS,
  IDENTITY_DOCUMENT_TYPES,
  computeIdentityDocumentExpiryAt,
  isCustomerIdentityDocumentCollectionEnabled,
  isIdentityDocumentExpired,
  validateIdentityDocumentCollectionInput,
} from "@/domain/customer-identity-document";

const TENANT_ID = "00000000-0000-4000-8000-000000000001";
const PROFILE_ID = "11111111-1111-4111-8111-111111111111";
const CIPHERTEXT = "a".repeat(40);
const KEY_VERSION = "v1";

function validInput(overrides: Record<string, unknown> = {}) {
  return {
    tenantId: TENANT_ID,
    profileId: PROFILE_ID,
    documentType: "cccd",
    collectionReason: "authority_request",
    departureDate: new Date("2026-09-10T00:00:00.000Z"),
    documentCiphertext: CIPHERTEXT,
    encryptionKeyVersion: KEY_VERSION,
    ...overrides,
  };
}

describe("IDENTITY_DOCUMENT_RETENTION_DAYS", () => {
  it("is a single named constant fixed at 30 days", () => {
    expect(IDENTITY_DOCUMENT_RETENTION_DAYS).toBe(30);
  });
});

describe("computeIdentityDocumentExpiryAt", () => {
  it("adds exactly the retention window in days to the departure date", () => {
    const departure = new Date("2026-09-10T08:00:00.000Z");
    const expiry = computeIdentityDocumentExpiryAt(departure);
    expect(expiry.toISOString()).toBe("2026-10-10T08:00:00.000Z");
  });

  it("does not mutate the input date", () => {
    const departure = new Date("2026-09-10T08:00:00.000Z");
    const before = departure.toISOString();
    computeIdentityDocumentExpiryAt(departure);
    expect(departure.toISOString()).toBe(before);
  });

  it("crosses month and year boundaries correctly", () => {
    const departure = new Date("2026-12-15T00:00:00.000Z");
    const expiry = computeIdentityDocumentExpiryAt(departure);
    expect(expiry.toISOString()).toBe("2027-01-14T00:00:00.000Z");
  });

  it("is pure: same input always yields the same output regardless of call order", () => {
    const departure = new Date("2026-09-10T00:00:00.000Z");
    const first = computeIdentityDocumentExpiryAt(departure);
    const second = computeIdentityDocumentExpiryAt(departure);
    expect(first.toISOString()).toBe(second.toISOString());
  });
});

describe("isIdentityDocumentExpired", () => {
  it("treats a row past its expiry as expired", () => {
    const expiresAt = new Date("2026-09-10T00:00:00.000Z");
    const now = new Date("2026-09-11T00:00:00.000Z");
    expect(isIdentityDocumentExpired(expiresAt, now)).toBe(true);
  });

  it("treats the exact expiry instant as expired (inclusive boundary)", () => {
    const expiresAt = new Date("2026-09-10T00:00:00.000Z");
    expect(isIdentityDocumentExpired(expiresAt, expiresAt)).toBe(true);
  });

  it("treats a row before its expiry as not expired", () => {
    const expiresAt = new Date("2026-09-10T00:00:00.000Z");
    const now = new Date("2026-09-09T00:00:00.000Z");
    expect(isIdentityDocumentExpired(expiresAt, now)).toBe(false);
  });
});

describe("IDENTITY_DOCUMENT_COLLECTION_REASONS", () => {
  it("is a fixed, non-empty controlled vocabulary", () => {
    expect(IDENTITY_DOCUMENT_COLLECTION_REASONS.length).toBeGreaterThan(0);
    expect(new Set(IDENTITY_DOCUMENT_COLLECTION_REASONS).size).toBe(
      IDENTITY_DOCUMENT_COLLECTION_REASONS.length,
    );
  });

  it("does not claim a confirmed legal obligation for the anticipatory reason", () => {
    expect(IDENTITY_DOCUMENT_COLLECTION_REASONS).toContain(
      "residence_notification_pending_legal_review",
    );
  });
});

describe("validateIdentityDocumentCollectionInput", () => {
  it("accepts a well-formed collection request and attaches the computed expiry", () => {
    const result = validateIdentityDocumentCollectionInput(validInput());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.expiresAt.toISOString()).toBe("2026-10-10T00:00:00.000Z");
    }
  });

  it.each(IDENTITY_DOCUMENT_TYPES)("accepts document type %s", (documentType) => {
    const result = validateIdentityDocumentCollectionInput(validInput({ documentType }));
    expect(result.ok).toBe(true);
  });

  it.each(IDENTITY_DOCUMENT_COLLECTION_REASONS)("accepts collection reason %s", (collectionReason) => {
    const result = validateIdentityDocumentCollectionInput(validInput({ collectionReason }));
    expect(result.ok).toBe(true);
  });

  it("rejects a reason outside the controlled vocabulary", () => {
    const result = validateIdentityDocumentCollectionInput(
      validInput({ collectionReason: "because_we_felt_like_it" }),
    );
    expect(result.ok).toBe(false);
  });

  it("rejects free-text document type outside the fixed list", () => {
    const result = validateIdentityDocumentCollectionInput(
      validInput({ documentType: "driving_license" }),
    );
    expect(result.ok).toBe(false);
  });

  it("rejects a non-uuid tenant or profile id", () => {
    expect(validateIdentityDocumentCollectionInput(validInput({ tenantId: "not-a-uuid" })).ok).toBe(
      false,
    );
    expect(validateIdentityDocumentCollectionInput(validInput({ profileId: "not-a-uuid" })).ok).toBe(
      false,
    );
  });

  it("rejects a ciphertext shorter than the sealed minimum", () => {
    const result = validateIdentityDocumentCollectionInput(
      validInput({ documentCiphertext: "short" }),
    );
    expect(result.ok).toBe(false);
  });

  it("rejects a missing encryption key version", () => {
    const result = validateIdentityDocumentCollectionInput(
      validInput({ encryptionKeyVersion: "" }),
    );
    expect(result.ok).toBe(false);
  });

  it("rejects unknown extra fields", () => {
    const result = validateIdentityDocumentCollectionInput(
      validInput({ unexpectedField: "leak" }),
    );
    expect(result.ok).toBe(false);
  });

  it("rejects a non-date departureDate", () => {
    const result = validateIdentityDocumentCollectionInput(
      validInput({ departureDate: "2026-09-10" }),
    );
    expect(result.ok).toBe(false);
  });
});

describe("isCustomerIdentityDocumentCollectionEnabled", () => {
  it("defaults to disabled when the flag is unset", () => {
    expect(isCustomerIdentityDocumentCollectionEnabled({})).toBe(false);
  });

  it("stays disabled for any value other than the literal string 'true'", () => {
    expect(
      isCustomerIdentityDocumentCollectionEnabled({
        CUSTOMER_IDENTITY_DOCUMENT_COLLECTION_ENABLED: "1",
      }),
    ).toBe(false);
    expect(
      isCustomerIdentityDocumentCollectionEnabled({
        CUSTOMER_IDENTITY_DOCUMENT_COLLECTION_ENABLED: "TRUE",
      }),
    ).toBe(false);
  });

  it("enables only on the exact literal string 'true'", () => {
    expect(
      isCustomerIdentityDocumentCollectionEnabled({
        CUSTOMER_IDENTITY_DOCUMENT_COLLECTION_ENABLED: "true",
      }),
    ).toBe(true);
  });

  it("trims surrounding whitespace before comparing", () => {
    expect(
      isCustomerIdentityDocumentCollectionEnabled({
        CUSTOMER_IDENTITY_DOCUMENT_COLLECTION_ENABLED: "  true  ",
      }),
    ).toBe(true);
  });
});
