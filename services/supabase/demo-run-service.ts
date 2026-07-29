"use client";

import { createClient } from "@/lib/supabase/client";
import { DomainError } from "@/domain/errors";
import type { DemoRun, DemoRunMember } from "@/domain/models";
import type { DemoRunService } from "@/services/contracts/demo-run-service";

type CreateRunResponse = {
  run: DemoRun;
  visitorUrl: string;
  joinExpiresAt: string;
};

export class SupabaseDemoRunService implements DemoRunService {
  async ensureAnonymousSession() {
    const supabase = createClient();
    const {
      data: { user: existingUser },
    } = await supabase.auth.getUser();

    if (existingUser) {
      if (!existingUser.is_anonymous) {
        throw new DomainError(
          "PERMISSION_DENIED",
          "A named operator session cannot be used as a visitor session.",
        );
      }
      return { userId: existingUser.id };
    }

    const { data, error } = await supabase.auth.signInAnonymously();
    if (error || !data.user) {
      throw new DomainError(
        "ANONYMOUS_AUTH_UNAVAILABLE",
        "Anonymous visitor sign-in is unavailable.",
        { cause: error, retryable: true },
      );
    }
    return { userId: data.user.id };
  }

  async createRun(input: {
    label: string;
    sourceCode?: string;
    expiresInMinutes?: number;
  }) {
    const response = await fetch("/api/demo-runs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const payload = (await response.json()) as CreateRunResponse & {
      error?: { message: string };
    };
    if (!response.ok) {
      throw new DomainError(
        response.status === 403 ? "PERMISSION_DENIED" : "VALIDATION_ERROR",
        payload.error?.message ?? "Unable to create the demo room.",
      );
    }
    return payload;
  }

  async joinRun(input: { opaqueJoinToken: string }) {
    const { userId } = await this.ensureAnonymousSession();
    const response = await fetch("/api/demo-runs/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: input.opaqueJoinToken }),
    });
    const payload = (await response.json()) as {
      demoRunId?: string;
      tenantId?: string;
      sourceCode?: string;
      expiresAt?: string;
      error?: { message: string };
    };
    if (
      !response.ok ||
      !payload.demoRunId ||
      !payload.tenantId ||
      !payload.sourceCode ||
      !payload.expiresAt
    ) {
      throw new DomainError(
        "DEMO_ROOM_NOT_JOINED",
        payload.error?.message ?? "The pairing link is invalid or expired.",
      );
    }

    const member: DemoRunMember = {
      demoRunId: payload.demoRunId,
      tenantId: payload.tenantId,
      userId,
      role: "visitor",
      status: "active",
      joinedAt: new Date().toISOString(),
    };
    return {
      member,
      sourceCode: payload.sourceCode,
      expiresAt: payload.expiresAt,
    };
  }

  async getActiveRun() {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: memberships, error: membershipError } = await supabase
      .from("demo_run_members")
      .select("demo_run_id")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("joined_at", { ascending: false })
      .limit(1);
    if (membershipError || !memberships?.[0]) return null;

    const { data: run, error: runError } = await supabase
      .from("demo_runs")
      .select("*")
      .eq("id", memberships[0].demo_run_id)
      .single();
    if (runError || !run) return null;

    return {
      id: run.id,
      tenantId: run.tenant_id,
      regionId: run.region_id,
      operatorId: run.operator_id,
      ownerUserId: run.owner_user_id,
      label: run.label,
      status: run.status as DemoRun["status"],
      expiresAt: run.expires_at,
      createdAt: run.created_at,
    };
  }

  async resetRun(input: { demoRunId: string }) {
    const response = await fetch(`/api/demo-runs/${input.demoRunId}/reset`, {
      method: "POST",
    });
    const payload = (await response.json()) as { error?: { message: string } };
    if (!response.ok) {
      throw new DomainError(
        response.status === 403 ? "PERMISSION_DENIED" : "VALIDATION_ERROR",
        payload.error?.message ?? "Unable to reset this demo room.",
      );
    }
  }
}
