import type { DemoRole, InternalRole } from "./models";

export type Capability =
  | "view-masked-bookings"
  | "view-full-demo-contact"
  | "redeem-pass"
  | "create-incident"
  | "confirm-p1-p2-incident"
  | "view-service-commerce"
  | "edit-content"
  | "change-safety-operation"
  | "reset-demo-run";

const permissions: Record<InternalRole, ReadonlySet<Capability>> = {
  "check-in-agent": new Set([
    "view-masked-bookings",
    "redeem-pass",
    "create-incident",
  ]),
  "site-supervisor": new Set([
    "view-masked-bookings",
    "view-full-demo-contact",
    "redeem-pass",
    "create-incident",
    "confirm-p1-p2-incident",
    "view-service-commerce",
    "change-safety-operation",
  ]),
  "icc-operator": new Set([
    "view-masked-bookings",
    "view-full-demo-contact",
    "redeem-pass",
    "create-incident",
    "confirm-p1-p2-incident",
    "view-service-commerce",
    "change-safety-operation",
  ]),
  finance: new Set(["view-masked-bookings", "view-service-commerce"]),
  content: new Set(["edit-content"]),
  admin: new Set([
    "view-masked-bookings",
    "view-full-demo-contact",
    "redeem-pass",
    "create-incident",
    "confirm-p1-p2-incident",
    "view-service-commerce",
    "edit-content",
    "change-safety-operation",
    "reset-demo-run",
  ]),
  "ritual-authority": new Set(),
};

export function can(role: DemoRole, capability: Capability): boolean {
  if (role === "visitor") return false;
  return permissions[role].has(capability);
}

export function effectiveCapability(input: {
  authenticatedRole: DemoRole;
  previewRole?: DemoRole;
  capability: Capability;
}) {
  return can(input.authenticatedRole, input.capability);
}

export const PERMISSION_MATRIX = permissions;
