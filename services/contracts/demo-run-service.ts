import type { DemoRun, DemoRunMember } from "@/domain/models";

export interface DemoRunService {
  ensureAnonymousSession(): Promise<{ userId: string }>;
  createRun(input: {
    label: string;
    sourceCode?: string;
    expiresInMinutes?: number;
  }): Promise<{ run: DemoRun; visitorUrl: string; joinExpiresAt: string }>;
  joinRun(input: { opaqueJoinToken: string }): Promise<{
    member: DemoRunMember;
    sourceCode: string;
    expiresAt: string;
  }>;
  getActiveRun(): Promise<DemoRun | null>;
  resetRun(input: { demoRunId: string }): Promise<void>;
}
