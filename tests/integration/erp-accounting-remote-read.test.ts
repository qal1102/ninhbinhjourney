import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  listAccountingJournals,
  listAccountingPeriods,
} from "@/lib/erp/accounting-repository";
import { listShiftClosures } from "@/lib/erp/shift-close-repository";

const remoteConfigured =
  process.env.ERP_PERSISTENCE_MODE === "supabase" &&
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
  Boolean(process.env.SUPABASE_SECRET_KEY);
const describeRemote = remoteConfigured ? describe : describe.skip;

describeRemote("remote accounting read path", () => {
  it("hydrates journals, periods, audit events and shift-close sources together", async () => {
    const [journals, periods, shifts] = await Promise.all([
      listAccountingJournals(),
      listAccountingPeriods(),
      listShiftClosures(),
    ]);
    expect(journals.length).toBeGreaterThan(0);
    expect(periods.length).toBeGreaterThan(0);
    expect(shifts.length).toBeGreaterThan(0);
  });
});
