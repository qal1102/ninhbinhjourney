"use client";

import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

const runScopedTables = [
  "demo_run_members",
  "capacity_slots",
  "bookings",
  "passes",
  "pass_entitlements",
  "redemptions",
  "incidents",
  "resource_requests",
  "audit_events",
] as const;

export type RealtimeConnectionState =
  | "connecting"
  | "connected"
  | "recovering"
  | "closed";

export function subscribeToDemoRun(input: {
  demoRunId: string;
  onChange: (table: (typeof runScopedTables)[number]) => void;
  onStatus: (status: RealtimeConnectionState) => void;
}) {
  const supabase = createClient();
  let channel: RealtimeChannel = supabase.channel(
    `demo-run:${input.demoRunId}`,
  );

  runScopedTables.forEach((table) => {
    channel = channel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table,
        filter: `demo_run_id=eq.${input.demoRunId}`,
      },
      () => input.onChange(table),
    );
  });

  channel.subscribe((status) => {
    if (status === "SUBSCRIBED") input.onStatus("connected");
    else if (status === "CLOSED") input.onStatus("closed");
    else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
      input.onStatus("recovering");
    } else {
      input.onStatus("connecting");
    }
  });

  return () => {
    void supabase.removeChannel(channel);
  };
}
