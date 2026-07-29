import type { ReactNode } from "react";
import { SetupState } from "@/components/shared/setup-state";
import { readPublicEnvironment } from "@/config/experience";

// Internal routes are request-bound: auth cookies, active-room membership and
// RLS context must be evaluated per request, never during static generation.
export const dynamic = "force-dynamic";

export default function OperationsLayout({
  children,
}: {
  children: ReactNode;
}) {
  const environment = readPublicEnvironment();
  if (environment.status !== "ready") {
    return (
      <SetupState
        environment={environment}
        surface="DestinationOS operations"
        demoHref="/demo/ops"
      />
    );
  }

  return children;
}
