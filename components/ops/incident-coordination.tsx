"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { subscribeToDemoRun } from "@/services/supabase/realtime";
import { SupabaseOperationsService } from "@/services/supabase/operations-service";
import type {
  DemoRunMemberRow,
  IncidentRow,
} from "@/types/database.generated";

export function IncidentCoordination({
  incident,
  members,
  resourceStatus,
  editable,
}: {
  incident: IncidentRow;
  members: DemoRunMemberRow[];
  resourceStatus: string | null;
  editable: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [realtime, setRealtime] = useState("connecting");
  const service = new SupabaseOperationsService();

  useEffect(
    () =>
      subscribeToDemoRun({
        demoRunId: incident.demo_run_id,
        onChange: (table) => {
          if (
            table === "incidents" ||
            table === "resource_requests" ||
            table === "audit_events"
          ) {
            router.refresh();
          }
        },
        onStatus: setRealtime,
      }),
    [incident.demo_run_id, router],
  );

  return (
    <form
      className="rounded-2xl border border-[#d7d5cd] bg-white p-5"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        setPending(true);
        setMessage("");
        void service
          .updateIncident({
            id: incident.id,
            status: String(form.get("status")),
            assignedTo: String(form.get("assignedTo") || "") || null,
            resourceStatus:
              String(form.get("resourceStatus") || "") || null,
          })
          .then(() => {
            setMessage("Coordination state saved and audit event appended.");
            router.refresh();
          })
          .catch((error: unknown) =>
            setMessage(
              error instanceof Error
                ? error.message
                : "Coordination update failed.",
            ),
          )
          .finally(() => setPending(false));
      }}
    >
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-display text-2xl">Coordination</h2>
        <span className="rounded-full bg-[#eef0eb] px-3 py-1 text-xs font-bold">
          Realtime {realtime}
        </span>
      </div>
      <div className="mt-5 grid gap-4">
        <label className="text-sm font-bold">
          Incident status
          <select
            name="status"
            defaultValue={incident.status}
            disabled={!editable}
            className="mt-2 min-h-11 w-full rounded-xl border border-[#c9ccc5] bg-white px-3 font-normal"
          >
            <option value="open">Open</option>
            <option value="acknowledged">Acknowledged</option>
            <option value="in-progress">In progress</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>
        </label>
        <label className="text-sm font-bold">
          Assigned operator
          <select
            name="assignedTo"
            defaultValue={incident.assigned_to ?? ""}
            disabled={!editable}
            className="mt-2 min-h-11 w-full rounded-xl border border-[#c9ccc5] bg-white px-3 font-normal"
          >
            <option value="">Unassigned</option>
            {members.map((member) => (
              <option key={member.user_id} value={member.user_id}>
                {member.role} · …{member.user_id.slice(-6)}
              </option>
            ))}
          </select>
        </label>
        {resourceStatus ? (
          <label className="text-sm font-bold">
            Resource request
            <select
              name="resourceStatus"
              defaultValue={resourceStatus}
              disabled={!editable}
              className="mt-2 min-h-11 w-full rounded-xl border border-[#c9ccc5] bg-white px-3 font-normal"
            >
              <option value="requested">Requested</option>
              <option value="assigned">Assigned</option>
              <option value="fulfilled">Fulfilled</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </label>
        ) : (
          <input type="hidden" name="resourceStatus" value="" />
        )}
      </div>
      <button
        disabled={!editable || pending}
        className="mt-5 min-h-11 w-full rounded-full bg-[#183f34] px-5 font-bold text-white disabled:opacity-40"
      >
        {pending ? "Saving…" : "Save coordination state"}
      </button>
      {!editable ? (
        <p className="mt-3 text-xs text-[#59654b]">
          Read-only for this role. Supervisor, ICC or admin authority is
          required to change coordination state.
        </p>
      ) : null}
      {message ? (
        <p className="mt-4 rounded-xl bg-[#f4f0e7] p-3 text-sm" role="status">
          {message}
        </p>
      ) : null}
    </form>
  );
}
