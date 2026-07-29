import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const doubles = vi.hoisted(() => ({
  cookies: vi.fn(),
  createClient: vi.fn(),
  storageFrom: vi.fn(),
  upload: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: doubles.createClient,
}));

vi.mock("next/headers", () => ({
  cookies: doubles.cookies,
}));

import { uploadWorkdayEvidence } from "@/lib/erp/workday-repository";

beforeEach(() => {
  vi.stubEnv("ERP_PERSISTENCE_MODE", "supabase");
  vi.stubEnv(
    "NEXT_PUBLIC_SUPABASE_URL",
    "https://workday-evidence-test.supabase.co",
  );
  vi.stubEnv("SUPABASE_SECRET_KEY", "test-server-secret");
  for (const double of Object.values(doubles)) {
    double.mockReset();
  }
  doubles.upload.mockResolvedValue({
    data: { path: "stored" },
    error: null,
  });
  doubles.storageFrom.mockReturnValue({
    upload: doubles.upload,
  });
  doubles.createClient.mockReturnValue({
    storage: {
      from: doubles.storageFrom,
    },
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("ERP workday evidence storage", () => {
  it("uses a unique immutable object path, no upsert and a content checksum", async () => {
    const bytes = new TextEncoder().encode("workday-photo-content");
    const file = new File([bytes], "Ảnh cổng A ca sáng.jpg", {
      type: "image/jpeg",
    });
    const input = {
      file,
      siteId: "trang-an" as const,
      employeeAccountId: "employee-trang-an-01",
      workdayId: "workday-evidence-storage",
      actionKey: "evidence-storage-action",
      uploadedBy: "employee-trang-an-01",
      uploadedAt: "2026-07-29T03:00:00.000Z",
      capturedAt: "2026-07-29T03:00:00.000Z",
      latitude: 20.25245,
      longitude: 105.91755,
      accuracy: 12,
    };

    const first = await uploadWorkdayEvidence(input);
    const second = await uploadWorkdayEvidence({
      ...input,
      actionKey: "evidence-storage-action-retry",
    });

    const expectedChecksum = createHash("sha256")
      .update(Buffer.from(bytes))
      .digest("hex");
    expect(first.sha256).toBe(expectedChecksum);
    expect(second.sha256).toBe(expectedChecksum);
    expect(first.storagePath).not.toBe(second.storagePath);
    for (const evidence of [first, second]) {
      expect(evidence.storagePath).toMatch(
        /^trang-an\/employee-trang-an-01\/workday-evidence-storage\/[0-9a-f-]{36}-/,
      );
      expect(evidence.storagePath).not.toContain(" ");
    }
    expect(doubles.storageFrom).toHaveBeenCalledWith(
      "erp-workday-evidence",
    );
    expect(doubles.upload).toHaveBeenCalledTimes(2);
    for (const [index, evidence] of [first, second].entries()) {
      const [path, body, options] = doubles.upload.mock.calls[index];
      expect(path).toBe(evidence.storagePath);
      expect(Buffer.isBuffer(body)).toBe(true);
      expect(Buffer.from(body as Buffer).equals(Buffer.from(bytes))).toBe(true);
      expect(options).toEqual({
        contentType: "image/jpeg",
        upsert: false,
        cacheControl: "3600",
      });
    }
  });
});
