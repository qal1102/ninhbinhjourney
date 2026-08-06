import type { ErpSiteId } from "@/domain/erp";

export type CapacitySourceKind = "estimate" | "customer" | "measured";
export type CapacityAlertLevel = "green" | "yellow" | "orange" | "red";
export type CapacityOwnerRole = "employee" | "manager" | "director";

export type CapacityResponseRule = {
  level: CapacityAlertLevel;
  actionText: string;
  ownerRole: CapacityOwnerRole;
  slaMinutes: number | null;
};

export type CapacityThreshold = {
  id: string;
  siteId: ErpSiteId;
  thresholdCode: string;
  bottleneckName: string;
  bottleneckKind: "boat-pier" | "ticket-gate" | "electric-shuttle";
  vehicleCount: number;
  seatsPerVehicle: number;
  roundTripMinutes: number;
  hourlyCapacity: number;
  watchPercent: number;
  restrictPercent: number;
  stopPercent: number;
  sourceKind: CapacitySourceKind;
  sourceNote: string;
  effectiveFrom: string;
  version: number;
  updatedByDisplayName: string;
  updatedAt: string;
  responseRules: CapacityResponseRule[];
};

export type CapacityAuditEvent = {
  id: string;
  thresholdId: string;
  action: "threshold.seeded" | "threshold.updated";
  actorDisplayName: string;
  createdAt: string;
  detail: Record<string, unknown>;
};

export type CapacityWorkspaceData = {
  siteId: ErpSiteId;
  windowStartedAt: string;
  windowEndsAt: string;
  acceptedEntriesThisHour: number;
  lastAcceptedScanAt: string | null;
  thresholds: CapacityThreshold[];
  auditEvents: CapacityAuditEvent[];
};

export function calculateHourlyCapacity(input: {
  vehicleCount: number;
  seatsPerVehicle: number;
  roundTripMinutes: number;
}) {
  const { vehicleCount, seatsPerVehicle, roundTripMinutes } = input;
  if (
    !Number.isFinite(vehicleCount) ||
    !Number.isFinite(seatsPerVehicle) ||
    !Number.isFinite(roundTripMinutes) ||
    vehicleCount <= 0 ||
    seatsPerVehicle <= 0 ||
    roundTripMinutes <= 0
  ) {
    return 0;
  }
  return Math.floor((vehicleCount * seatsPerVehicle * 60) / roundTripMinutes);
}

export function capacityLoadPercent(entries: number, hourlyCapacity: number) {
  if (!Number.isFinite(entries) || entries <= 0 || hourlyCapacity <= 0) return 0;
  return Math.round((entries / hourlyCapacity) * 100);
}

export function capacityAlertLevel(
  loadPercent: number,
  threshold: Pick<
    CapacityThreshold,
    "watchPercent" | "restrictPercent" | "stopPercent"
  >,
): CapacityAlertLevel {
  if (loadPercent >= threshold.stopPercent) return "red";
  if (loadPercent >= threshold.restrictPercent) return "orange";
  if (loadPercent >= threshold.watchPercent) return "yellow";
  return "green";
}

export function vietnamHourWindow(now = new Date()) {
  const vietnamOffsetMs = 7 * 60 * 60 * 1_000;
  const localClock = new Date(now.getTime() + vietnamOffsetMs);
  localClock.setUTCMinutes(0, 0, 0);
  const start = new Date(localClock.getTime() - vietnamOffsetMs);
  const end = new Date(start.getTime() + 60 * 60 * 1_000);
  return { start: start.toISOString(), end: end.toISOString() };
}
