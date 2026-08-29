import type { ErpSiteId } from "@/domain/erp";

export type CapacitySourceKind = "estimate" | "customer" | "measured";

/**
 * TC-01. Công thức vòng quay `xe × chỗ × 60 ÷ phút` chỉ đúng với thứ **quay
 * vòng**: thuyền, xe điện, bến. Nó vô nghĩa với bãi đỗ (số chỗ tĩnh), khu vực
 * chờ (sức chứa đứng) hay tổ cứu hộ (số người trực) — nhồi ba thứ đó vào công
 * thức vòng quay là bịa ra một con số trông như đã đo.
 */
export type CapacityModel = "round-trip" | "static";

export const CAPACITY_MODEL_LABELS: Record<CapacityModel, string> = {
  "round-trip": "Quay vòng",
  static: "Sức chứa tĩnh",
};

export type CapacityBottleneckKind =
  | "boat-pier"
  | "ticket-gate"
  | "electric-shuttle"
  | "parking"
  | "waiting-area"
  | "cave-channel"
  | "drop-off"
  | "rescue"
  | "boat-crew";

export const CAPACITY_BOTTLENECK_LABELS: Record<CapacityBottleneckKind, string> = {
  "boat-pier": "Bến thuyền",
  "ticket-gate": "Cổng soát vé",
  "electric-shuttle": "Xe điện trung chuyển",
  parking: "Bãi đỗ xe",
  "waiting-area": "Khu vực chờ",
  "cave-channel": "Luồng hang",
  "drop-off": "Điểm trả khách",
  rescue: "Tổ cứu hộ",
  "boat-crew": "Người lái đò",
};
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
  bottleneckKind: CapacityBottleneckKind;
  capacityModel: CapacityModel;
  vehicleCount: number;
  seatsPerVehicle: number;
  roundTripMinutes: number;
  staticCapacity: number | null;
  safetyFactor: number;
  /**
   * Năng lực vòng quay thuần tuý, **chưa** nhân hệ số an toàn. Với ngưỡng
   * `static` con số này vô nghĩa — nó tính từ các ô vòng quay bắt buộc phải
   * điền nhưng không mô tả gì. Đừng hiển thị nó cho ngưỡng tĩnh.
   */
  hourlyCapacity: number;
  /**
   * Con số dùng để bán và để cảnh báo: lấy từ đúng nhánh mô hình rồi nhân hệ
   * số an toàn. Đây là thứ `customer_create_booking_hold` chọn MIN theo.
   */
  effectiveCapacity: number;
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
  action: "threshold.seeded" | "threshold.updated" | "threshold.created";
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

/**
 * Bản sao ở tầng ứng dụng của cột sinh `effective_capacity` trong migration
 * `202608260049`. Dùng để **xem trước** trên màn hình trước khi lưu.
 *
 * PostgreSQL vẫn là nguồn sự thật: hàm này không được dùng để ghi vào bất kỳ
 * đâu, nếu không sẽ có hai nơi cùng định nghĩa một con số.
 */
export function calculateEffectiveCapacity(input: {
  capacityModel: CapacityModel;
  vehicleCount: number;
  seatsPerVehicle: number;
  roundTripMinutes: number;
  staticCapacity: number | null;
  safetyFactor: number;
}) {
  const { capacityModel, staticCapacity, safetyFactor } = input;
  if (!Number.isFinite(safetyFactor) || safetyFactor <= 0 || safetyFactor > 1) {
    return 0;
  }
  const base =
    capacityModel === "static"
      ? Number.isFinite(staticCapacity ?? NaN) && (staticCapacity ?? 0) > 0
        ? (staticCapacity as number)
        : 0
      : calculateHourlyCapacity(input);
  return Math.floor(base * safetyFactor);
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
