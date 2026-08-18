import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  CustomerIdentityRepositoryError,
  protectCustomerContact,
} from "@/lib/customer-data/identity-repository";

describe("CUS-05 protected contact vault", () => {
  beforeEach(() => {
    process.env.CUSTOMER_CONTACT_ENCRYPTION_KEY_BASE64 = Buffer.alloc(32, 7).toString("base64");
    process.env.CUSTOMER_IDENTITY_HASH_KEY = "hash-key-for-cus05-tests-at-least-32-characters";
    process.env.CUSTOMER_CONTACT_ENCRYPTION_KEY_VERSION = "test-v1";
  });

  afterEach(() => {
    delete process.env.CUSTOMER_CONTACT_ENCRYPTION_KEY_BASE64;
    delete process.env.CUSTOMER_IDENTITY_HASH_KEY;
    delete process.env.CUSTOMER_CONTACT_ENCRYPTION_KEY_VERSION;
  });

  it("uses a stable HMAC digest and randomized AES-GCM ciphertext without raw contact", () => {
    const first = protectCustomerContact("Guest@Example.com");
    const second = protectCustomerContact("guest@example.com");
    expect(first.identityType).toBe("email");
    expect(first.digest).toMatch(/^[0-9a-f]{64}$/);
    expect(first.digest).toBe(second.digest);
    expect(first.ciphertext).not.toBe(second.ciphertext);
    expect(first.ciphertext).not.toContain("guest@example.com");
    expect(first.keyVersion).toBe("test-v1");
  });

  it("fails closed when protection keys are missing", () => {
    delete process.env.CUSTOMER_CONTACT_ENCRYPTION_KEY_BASE64;
    expect(() => protectCustomerContact("guest@example.com")).toThrow(CustomerIdentityRepositoryError);
  });
});
